import "server-only";

import { and, asc, desc, eq, ilike, not, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { asignatura, grupo, rol, usuario } from "@/db/schema";
import { changedFields } from "@/lib/audit/diff";
import { decodeDias, encodeDias, type DiaSemana } from "@/lib/catalog/dias";
import { ASIGNATURA_GRUPOS_MAX } from "@/lib/catalog/list-params";
import type { CatalogScope } from "@/lib/catalog/scope";
import type {
  AsignaturaGruposResult,
  CatalogListResult,
  CatalogStatusFilter,
  GrupoActiveResult,
  GrupoListItem,
  GrupoWriteResult,
} from "@/lib/catalog/types";
import type { Transaction } from "@/lib/data/audit";
import {
  asignaturaInScope,
  asignaturaRowInScope,
  grupoRowInScope,
} from "@/lib/data/catalog-scope-sql";
import { containsPattern } from "@/lib/data/sql-like";
import { clampPage } from "@/lib/data/users";

// The stored `Dias` mask is read here and decoded by `toItem`; it is the only
// place it is read, and no item that leaves this module carries it.
const listColumns = {
  id: grupo.id,
  asignaturaId: grupo.asignaturaId,
  asignaturaCodigo: asignatura.codigo,
  asignaturaNombre: asignatura.nombre,
  periodo: grupo.periodo,
  numeroGrupo: grupo.numeroGrupo,
  docenteId: grupo.docenteId,
  docenteNombre: usuario.nombreCompleto,
  activo: grupo.activo,
  origen: grupo.origen,
  dias: grupo.dias,
} as const;

function toItem(row: Omit<GrupoListItem, "dias"> & { dias: number }) {
  return { ...row, dias: decodeDias(row.dias) };
}

/**
 * The one `where` clause of the Grupo list, shared by the count and the page.
 * A Grupo is scoped through its Asignatura, so the scope predicate is the
 * Asignatura one from `catalog-scope-sql` (design decision 2) and both
 * statements join the Asignatura and the docente. `q` is a partial,
 * case-insensitive match on the asignatura Codigo and Nombre, Periodo,
 * NumeroGrupo and the docente name; the term is escaped and bound as a
 * parameter. The days are neither a filter nor a search field.
 */
export function buildGruposWhere(
  scope: CatalogScope,
  f: { status: CatalogStatusFilter; q: string },
): SQL | undefined {
  const parts = [
    asignaturaInScope(scope),
    f.status === "active"
      ? sql`${grupo.activo}`
      : f.status === "inactive"
        ? not(grupo.activo)
        : undefined,
    f.q
      ? or(
          ilike(asignatura.codigo, containsPattern(f.q)),
          ilike(asignatura.nombre, containsPattern(f.q)),
          ilike(grupo.periodo, containsPattern(f.q)),
          ilike(grupo.numeroGrupo, containsPattern(f.q)),
          ilike(usuario.nombreCompleto, containsPattern(f.q)),
        )
      : undefined,
  ].filter((part): part is SQL => part !== undefined);
  return parts.length > 0 ? and(...parts) : undefined;
}

/** Fail-soft like `listUsuarios`: a thrown error is an empty, degraded page. */
export async function listGrupos(p: {
  scope: CatalogScope;
  status: CatalogStatusFilter;
  q: string;
  page: number;
  pageSize: number;
}): Promise<CatalogListResult<GrupoListItem>> {
  try {
    const where = buildGruposWhere(p.scope, p);
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(grupo)
      .innerJoin(asignatura, eq(grupo.asignaturaId, asignatura.id))
      .innerJoin(usuario, eq(grupo.docenteId, usuario.id))
      .where(where);
    const page = clampPage(p.page, count, p.pageSize);
    const rows = await db
      .select(listColumns)
      .from(grupo)
      .innerJoin(asignatura, eq(grupo.asignaturaId, asignatura.id))
      .innerJoin(usuario, eq(grupo.docenteId, usuario.id))
      .where(where)
      .orderBy(
        asc(asignatura.codigo),
        desc(grupo.periodo),
        asc(grupo.numeroGrupo),
        asc(grupo.id),
      )
      .limit(p.pageSize)
      .offset((page - 1) * p.pageSize);
    return {
      data: rows.map(toItem),
      total: count,
      page,
      pageSize: p.pageSize,
      degraded: false,
    };
  } catch {
    return {
      data: [],
      total: 0,
      page: 1,
      pageSize: p.pageSize,
      degraded: true,
    };
  }
}

/**
 * The Grupos of one Asignatura, active and inactive, for the section of its
 * edit page (CM-ASG-7, design A-AGS-1). Newest periods first; one row past
 * `ASIGNATURA_GRUPOS_MAX` is read so `truncated` needs no count. The scope
 * predicate is the Asignatura one, as in `listGrupos`. Fail-soft: a thrown
 * error (a corrupt mask included) is an empty, degraded result.
 */
export async function listGruposByAsignatura(
  scope: CatalogScope,
  asignaturaId: number,
): Promise<AsignaturaGruposResult> {
  try {
    const rows = await db
      .select(listColumns)
      .from(grupo)
      .innerJoin(asignatura, eq(grupo.asignaturaId, asignatura.id))
      .innerJoin(usuario, eq(grupo.docenteId, usuario.id))
      .where(
        and(eq(grupo.asignaturaId, asignaturaId), asignaturaInScope(scope)),
      )
      .orderBy(desc(grupo.periodo), asc(grupo.numeroGrupo), asc(grupo.id))
      .limit(ASIGNATURA_GRUPOS_MAX + 1);
    return {
      data: rows.slice(0, ASIGNATURA_GRUPOS_MAX).map(toItem),
      truncated: rows.length > ASIGNATURA_GRUPOS_MAX,
      degraded: false,
    };
  } catch {
    return { data: [], truncated: false, degraded: true };
  }
}

/**
 * One Grupo inside the scope. `null` for a missing id and for a foreign one
 * alike (CM-SCOPE-1). Not fail-soft: callers decide on a thrown error. Usable
 * as the lock-free pre-check read of the actions (amendment A-6).
 */
export async function getGrupoById(
  scope: CatalogScope,
  id: number,
): Promise<GrupoListItem | null> {
  const [row] = await db
    .select(listColumns)
    .from(grupo)
    .innerJoin(asignatura, eq(grupo.asignaturaId, asignatura.id))
    .innerJoin(usuario, eq(grupo.docenteId, usuario.id))
    .where(grupoRowInScope(scope, id))
    .limit(1);
  return row ? toItem(row) : null;
}

// ---- Writes. Each takes the transaction handle opened by `withCatalogWrite`
// (which owns the lock, the transaction and the audit rows) and only reads and
// writes through it. No statement here deletes a row.

/** SQLSTATE `unique_violation`, read from `error.cause.code` (R6) or `code`. */
function isUniqueViolation(error: unknown): boolean {
  const code = (e: unknown) => (e as { code?: unknown } | null)?.code;
  return (
    code(error) === "23505" ||
    code((error as { cause?: unknown } | null)?.cause) === "23505"
  );
}

/**
 * Creates a manual Grupo. In order: the Asignatura is read with the scope
 * predicate and must be active (missing, inactive and foreign look alike); the
 * docente must be an active user whose role is `docente`; the natural key
 * (Asignatura, Periodo, NumeroGrupo) is looked up with the `AsignaturaId` of
 * the scoped read, never the caller's. The days are not part of the key and
 * are stored as the mask of `encodeDias`; an empty set is accepted here (the
 * "at least one day" rule belongs to the manual schema). A `23505` from the
 * insert is the backstop and answers conservatively (A-7).
 */
export async function createGrupo(
  tx: Transaction,
  scope: CatalogScope,
  input: {
    asignaturaId: number;
    periodo: string;
    numeroGrupo: string;
    docenteId: number;
    dias: readonly DiaSemana[];
  },
): Promise<GrupoWriteResult> {
  const [parent] = await tx
    .select({ id: asignatura.id, activo: asignatura.activo })
    .from(asignatura)
    .where(asignaturaRowInScope(scope, input.asignaturaId))
    .limit(1);
  if (!parent || !parent.activo) return { kind: "asignatura_unavailable" };

  const [docente] = await tx
    .select({ activo: usuario.activo, rol: rol.codigo })
    .from(usuario)
    .innerJoin(rol, eq(usuario.rolId, rol.id))
    .where(eq(usuario.id, input.docenteId))
    .limit(1);
  if (!docente || !docente.activo || docente.rol !== "docente") {
    return { kind: "docente_unavailable" };
  }

  const [existing] = await tx
    .select({ activo: grupo.activo })
    .from(grupo)
    .where(
      and(
        eq(grupo.asignaturaId, parent.id),
        eq(grupo.periodo, input.periodo),
        eq(grupo.numeroGrupo, input.numeroGrupo),
      ),
    )
    .limit(1);
  if (existing) return { kind: "grupo_taken", activo: existing.activo };

  try {
    const [created] = await tx
      .insert(grupo)
      .values({
        asignaturaId: parent.id,
        periodo: input.periodo,
        numeroGrupo: input.numeroGrupo,
        docenteId: input.docenteId,
        origen: "manual",
        dias: encodeDias(input.dias),
      })
      .returning({ id: grupo.id });
    return { kind: "created", id: created.id };
  } catch (error) {
    if (isUniqueViolation(error)) return { kind: "grupo_taken", activo: false };
    throw error;
  }
}

/**
 * The parent rules shared by a docente change and a reactivation: the
 * Asignatura (read with the scope predicate) must exist and be active, then the
 * docente must be an active user with role `docente`. `null` means both hold.
 */
async function unavailableParent(
  tx: Transaction,
  scope: CatalogScope,
  asignaturaId: number,
  docenteId: number,
): Promise<"asignatura_unavailable" | "docente_unavailable" | null> {
  const [parent] = await tx
    .select({ activo: asignatura.activo })
    .from(asignatura)
    .where(asignaturaRowInScope(scope, asignaturaId))
    .limit(1);
  if (!parent || !parent.activo) return "asignatura_unavailable";
  const [docente] = await tx
    .select({ activo: usuario.activo, rol: rol.codigo })
    .from(usuario)
    .innerJoin(rol, eq(usuario.rolId, rol.id))
    .where(eq(usuario.id, docenteId))
    .limit(1);
  return !docente || !docente.activo || docente.rol !== "docente"
    ? "docente_unavailable"
    : null;
}

/**
 * Edits the docente and the days of an active Grupo; the natural key, the
 * origin and the active flag are never part of the SET. The row is read inside
 * the transaction with the scope predicate, and the diff runs against it (last
 * writer wins). Nothing changed: `unchanged`, with no docente validation (an
 * inactive current docente does not block). Only a docente change runs the
 * parent checks; a days-only change reads no parent (finding F-J). The SET
 * holds exactly the changed fields and `campos` names them in list order. An
 * empty set of days is accepted here (the schema owns the minimum).
 */
export async function updateGrupo(
  tx: Transaction,
  scope: CatalogScope,
  id: number,
  input: { docenteId: number; dias: readonly DiaSemana[] },
): Promise<GrupoWriteResult> {
  const [row] = await tx
    .select({
      asignaturaId: grupo.asignaturaId,
      docenteId: grupo.docenteId,
      activo: grupo.activo,
      dias: grupo.dias,
    })
    .from(grupo)
    .where(grupoRowInScope(scope, id))
    .limit(1);
  if (!row) return { kind: "not_found" };
  if (!row.activo) return { kind: "inactive" };
  const next = { docenteId: input.docenteId, dias: encodeDias(input.dias) };
  const campos = changedFields(["docenteId", "dias"], row, next);
  if (campos.length === 0) return { kind: "unchanged", id };
  if (campos.includes("docenteId")) {
    const refusal = await unavailableParent(
      tx,
      scope,
      row.asignaturaId,
      input.docenteId,
    );
    if (refusal) return { kind: refusal };
  }
  const changes: { docenteId?: number; dias?: number } = {};
  if (campos.includes("docenteId")) changes.docenteId = next.docenteId;
  if (campos.includes("dias")) changes.dias = next.dias;
  const updated = await tx
    .update(grupo)
    .set(changes)
    .where(grupoRowInScope(scope, id))
    .returning({ id: grupo.id });
  return updated.length === 0
    ? { kind: "not_found" }
    : { kind: "updated", id, campos };
}

/**
 * Deactivates or reactivates a Grupo. Deactivation never depends on the
 * Asignatura or the docente and never touches an Inscripcion; reactivation
 * needs both parents valid (`unavailableParent`). A no-op answers `unchanged`
 * and writes nothing. The SET names only `activo`.
 */
export async function setGrupoActivo(
  tx: Transaction,
  scope: CatalogScope,
  id: number,
  activo: boolean,
): Promise<GrupoActiveResult> {
  const [row] = await tx
    .select({
      asignaturaId: grupo.asignaturaId,
      docenteId: grupo.docenteId,
      activo: grupo.activo,
    })
    .from(grupo)
    .where(grupoRowInScope(scope, id))
    .limit(1);
  if (!row) return { kind: "not_found" };
  if (row.activo === activo) return { kind: "unchanged", id };
  if (activo) {
    const refusal = await unavailableParent(
      tx,
      scope,
      row.asignaturaId,
      row.docenteId,
    );
    if (refusal) return { kind: refusal };
  }
  const updated = await tx
    .update(grupo)
    .set({ activo })
    .where(grupoRowInScope(scope, id))
    .returning({ id: grupo.id });
  return updated.length === 0
    ? { kind: "not_found" }
    : { kind: "changed", id, activo };
}
