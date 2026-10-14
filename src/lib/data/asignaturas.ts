import "server-only";

import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  not,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { db } from "@/db";
import { asignatura, carrera, grupo, usuario } from "@/db/schema";
import {
  ASIGNATURA_MATCHES_MAX,
  ASIGNATURAS_DEFAULT_SORT,
  CATALOG_OPTIONS_MAX,
  type AsignaturasSortKey,
} from "@/lib/catalog/list-params";
import { changedFields } from "@/lib/audit/diff";
import { carreraIdForWrite, type CatalogScope } from "@/lib/catalog/scope";
import type {
  AsignaturaActiveResult,
  AsignaturaDetail,
  AsignaturaGrupoMatch,
  AsignaturaListItem,
  AsignaturaWriteResult,
  CatalogListResult,
  CatalogStatusFilter,
} from "@/lib/catalog/types";
import type { Transaction } from "@/lib/data/audit";
import {
  asignaturaInScope,
  asignaturaRowInScope,
} from "@/lib/data/catalog-scope-sql";
import {
  activeFirst,
  collatedText,
  orderByFor,
  plainColumn,
  type SortExpr,
} from "@/lib/data/sort-sql";
import { containsPattern } from "@/lib/data/sql-like";
import { clampPage } from "@/lib/data/users";
import type { ListSort } from "@/lib/list-params";

const listColumns = {
  id: asignatura.id,
  codigo: asignatura.codigo,
  nombre: asignatura.nombre,
  carreraId: asignatura.carreraId,
  carreraNombre: carrera.nombre,
  horasTotales: asignatura.horasTotales,
  activo: asignatura.activo,
} as const;

/**
 * Whitelist of sortable Asignatura columns (DT-SORT-1). The URL value is only a
 * lookup key, already narrowed to `AsignaturasSortKey` by the parser; it is
 * never interpolated. The name is collated, the code and hours are the plain
 * columns, `status` ascending means active first. The Groups column is not a
 * key.
 */
const ASIGNATURAS_SORT_MAP = {
  code: plainColumn(asignatura.codigo),
  name: collatedText(asignatura.nombre),
  hours: plainColumn(asignatura.horasTotales),
  status: activeFirst(asignatura.activo),
} satisfies Record<AsignaturasSortKey, SortExpr>;

/**
 * The ONE definition of "a group matches the search term" (CM-ASG-9): its
 * Periodo or its docente name contains the term. The group number and the days
 * are not search fields (B7) and the group status is not a condition (U9), so
 * flipping U9 later is one term here. `pattern` is already escaped.
 */
function grupoMatchesTerm(pattern: string): SQL {
  return or(
    ilike(grupo.periodo, pattern),
    ilike(usuario.nombreCompleto, pattern),
  ) as SQL;
}

/**
 * The one `where` clause of the Asignatura list, shared by the count and the
 * page. The scope predicate comes only from `catalog-scope-sql` (design
 * decision 2). `q` is a partial, case-insensitive match on Codigo OR Nombre OR,
 * through a correlated `exists`, the Periodo or docente name of one of the
 * Asignatura's groups (one row per Asignatura by construction); the term is
 * escaped and bound as a parameter, never interpolated.
 */
export function buildAsignaturasWhere(
  scope: CatalogScope,
  f: { status: CatalogStatusFilter; q: string },
): SQL | undefined {
  const parts = [
    asignaturaInScope(scope),
    f.status === "active"
      ? sql`${asignatura.activo}`
      : f.status === "inactive"
        ? not(asignatura.activo)
        : undefined,
    f.q
      ? or(
          ilike(asignatura.codigo, containsPattern(f.q)),
          ilike(asignatura.nombre, containsPattern(f.q)),
          sql`exists (select 1 from ${grupo} inner join ${usuario} on ${eq(usuario.id, grupo.docenteId)} where ${and(eq(grupo.asignaturaId, asignatura.id), grupoMatchesTerm(containsPattern(f.q)))})`,
        )
      : undefined,
  ].filter((part): part is SQL => part !== undefined);
  return parts.length > 0 ? and(...parts) : undefined;
}

type GrupoMatchRow = AsignaturaGrupoMatch & { asignaturaId: number };

function toGrupoMatch({
  asignaturaId,
  ...match
}: GrupoMatchRow): AsignaturaGrupoMatch {
  void asignaturaId;
  return match;
}

/**
 * The groups of the page's Asignaturas that match the term, by Asignatura. It
 * is not exported: a read inside `listAsignaturas`, so a failure degrades the
 * list like the other statements. It uses the same scope predicate and the
 * same `grupoMatchesTerm` as the search, and the group status is no filter
 * (U9). Days, credentials and contact data are not selected.
 */
async function listMatchingGrupos(
  scope: CatalogScope,
  asignaturaIds: number[],
  q: string,
): Promise<Map<number, GrupoMatchRow[]>> {
  const rows = await db
    .select({
      id: grupo.id,
      asignaturaId: grupo.asignaturaId,
      periodo: grupo.periodo,
      numeroGrupo: grupo.numeroGrupo,
      docenteNombre: usuario.nombreCompleto,
      activo: grupo.activo,
    })
    .from(grupo)
    .innerJoin(asignatura, eq(grupo.asignaturaId, asignatura.id))
    .innerJoin(usuario, eq(grupo.docenteId, usuario.id))
    .where(
      and(
        inArray(grupo.asignaturaId, asignaturaIds),
        asignaturaInScope(scope),
        grupoMatchesTerm(containsPattern(q)),
      ),
    )
    .orderBy(
      asc(grupo.asignaturaId),
      desc(grupo.periodo),
      asc(grupo.numeroGrupo),
      asc(grupo.id),
    );
  const byAsignatura = new Map<number, GrupoMatchRow[]>();
  for (const row of rows) {
    const list = byAsignatura.get(row.asignaturaId);
    if (list) list.push(row);
    else byAsignatura.set(row.asignaturaId, [row]);
  }
  return byAsignatura;
}

/** Fail-soft like `listUsuarios`: a thrown error is an empty, degraded page. */
export async function listAsignaturas(p: {
  scope: CatalogScope;
  status: CatalogStatusFilter;
  q: string;
  page: number;
  pageSize: number;
  /** Already narrowed to a whitelisted key and a direction; omitted = today's
   *  order (`Codigo` ascending, then `Id`). */
  sort?: ListSort<AsignaturasSortKey>;
}): Promise<CatalogListResult<AsignaturaListItem>> {
  try {
    const where = buildAsignaturasWhere(p.scope, p);
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(asignatura)
      .where(where);
    const page = clampPage(p.page, count, p.pageSize);
    const data = await db
      .select({
        ...listColumns,
        // One aggregated subquery column: no extra query per row.
        grupos: sql<
          string | null
        >`(select string_agg(distinct ${grupo.numeroGrupo}, ', ' order by ${grupo.numeroGrupo}) from ${grupo} where ${grupo.asignaturaId} = ${asignatura.id} and ${grupo.activo})`,
      })
      .from(asignatura)
      .innerJoin(carrera, eq(asignatura.carreraId, carrera.id))
      .where(where)
      .orderBy(
        ...orderByFor(
          ASIGNATURAS_SORT_MAP,
          p.sort ?? ASIGNATURAS_DEFAULT_SORT,
          ASIGNATURAS_DEFAULT_SORT,
          asignatura.id,
        ),
      )
      .limit(p.pageSize)
      .offset((page - 1) * p.pageSize);
    const matches =
      p.q && data.length > 0
        ? await listMatchingGrupos(
            p.scope,
            data.map((row) => row.id),
            p.q,
          )
        : new Map<number, GrupoMatchRow[]>();
    return {
      data: data.map((row) => {
        const found = matches.get(row.id) ?? [];
        return {
          ...row,
          gruposCoincidentes: found
            .slice(0, ASIGNATURA_MATCHES_MAX)
            .map(toGrupoMatch),
          gruposCoincidentesTotal: found.length,
        };
      }),
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
 * One Asignatura inside the scope, with its active group count. `null` for a
 * missing id and for a foreign one alike (CM-SCOPE-1). Not fail-soft: callers
 * decide on a thrown error.
 */
export async function getAsignaturaById(
  scope: CatalogScope,
  id: number,
): Promise<AsignaturaDetail | null> {
  const [row] = await db
    .select({
      ...listColumns,
      gruposActivos:
        sql<number>`(select count(*) from ${grupo} where ${grupo.asignaturaId} = ${asignatura.id} and ${grupo.activo})`.mapWith(
          Number,
        ),
    })
    .from(asignatura)
    .innerJoin(carrera, eq(asignatura.carreraId, carrera.id))
    .where(asignaturaRowInScope(scope, id))
    .limit(1);
  return row ?? null;
}

/** Active, in-scope asignaturas for a select or combobox, capped. */
export async function listAsignaturaOptions(
  scope: CatalogScope,
): Promise<{ id: number; codigo: string; nombre: string }[]> {
  return db
    .select({
      id: asignatura.id,
      codigo: asignatura.codigo,
      nombre: asignatura.nombre,
    })
    .from(asignatura)
    .where(and(asignaturaInScope(scope), sql`${asignatura.activo}`))
    .orderBy(asc(asignatura.codigo))
    .limit(CATALOG_OPTIONS_MAX);
}

/**
 * The carreras a Carrera select may offer (amendment A-8): all for `all`, only
 * the own for `carrera`, none for `none` (no statement issued). The scope is
 * applied in TypeScript because `catalog-scope-sql` is the only place a scope
 * becomes SQL and it speaks about Asignatura rows; the list is a handful of
 * names.
 */
export async function listCarreraOptions(
  scope: CatalogScope,
): Promise<{ id: number; nombre: string }[]> {
  if (scope.kind === "none") return [];
  const rows = await db
    .select({ id: carrera.id, nombre: carrera.nombre })
    .from(carrera)
    .orderBy(asc(carrera.nombre));
  return scope.kind === "carrera"
    ? rows.filter((row) => row.id === scope.carreraId)
    : rows;
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

async function carreraExists(tx: Transaction, id: number): Promise<boolean> {
  const rows = await tx
    .select({ id: carrera.id })
    .from(carrera)
    .where(eq(carrera.id, id))
    .limit(1);
  return rows.length > 0;
}

/**
 * Creates an Asignatura. The carrera comes from `carreraIdForWrite`, never
 * from the form. The natural-key lookup is deliberately UNSCOPED (a duplicate
 * outside the scope must still be refused) and compares the trimmed Codigo by
 * exact equality, as the import does (CM-ASG-6); `inScope` lets the caller keep
 * the message generic for a foreign record. A `23505` from the insert is the
 * backstop and answers conservatively (A-7).
 */
export async function createAsignatura(
  tx: Transaction,
  scope: CatalogScope,
  input: {
    codigo: string;
    nombre: string;
    carreraId?: number;
    horasTotales: number;
  },
): Promise<AsignaturaWriteResult> {
  const carreraId = carreraIdForWrite(scope, input.carreraId);
  if (carreraId === null || !(await carreraExists(tx, carreraId))) {
    return { kind: "carrera_invalid" };
  }
  const codigo = input.codigo.trim();
  const [existing] = await tx
    .select({ carreraId: asignatura.carreraId, activo: asignatura.activo })
    .from(asignatura)
    .where(eq(asignatura.codigo, codigo))
    .limit(1);
  if (existing) {
    return {
      kind: "codigo_taken",
      inScope:
        scope.kind === "all" ||
        (scope.kind === "carrera" && scope.carreraId === existing.carreraId),
      activo: existing.activo,
    };
  }
  try {
    const [created] = await tx
      .insert(asignatura)
      .values({
        codigo,
        nombre: input.nombre,
        carreraId,
        horasTotales: input.horasTotales,
      })
      .returning({ id: asignatura.id });
    return { kind: "created", id: created.id };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { kind: "codigo_taken", inScope: false, activo: false };
    }
    throw error;
  }
}

/** The scoped, active-or-not row of an Asignatura, read through `tx`. */
async function readScopedRow(tx: Transaction, scope: CatalogScope, id: number) {
  const [row] = await tx
    .select({
      id: asignatura.id,
      nombre: asignatura.nombre,
      carreraId: asignatura.carreraId,
      horasTotales: asignatura.horasTotales,
      activo: asignatura.activo,
    })
    .from(asignatura)
    .where(asignaturaRowInScope(scope, id))
    .limit(1);
  return row;
}

/**
 * Edits Nombre, HorasTotales and (unscoped actors) the carrera. `Codigo` and
 * `Activo` are never part of the SET (AC-CODE). The diff runs against the row
 * read inside the transaction, so a concurrent edit is simply overwritten (last
 * writer wins) and `campos` names what this write really changed.
 */
export async function updateAsignatura(
  tx: Transaction,
  scope: CatalogScope,
  id: number,
  input: { nombre: string; carreraId?: number; horasTotales: number },
): Promise<AsignaturaWriteResult> {
  const row = await readScopedRow(tx, scope, id);
  if (!row) return { kind: "not_found" };
  if (!row.activo) return { kind: "inactive" };
  // An absent carrera keeps the current one; a named one must be allowed by
  // the scope and exist (a scoped actor cannot move a record).
  const carreraId =
    input.carreraId === undefined
      ? row.carreraId
      : carreraIdForWrite(scope, input.carreraId);
  if (
    carreraId === null ||
    (carreraId !== row.carreraId && !(await carreraExists(tx, carreraId)))
  ) {
    return { kind: "carrera_invalid" };
  }
  const next = {
    nombre: input.nombre,
    carreraId,
    horasTotales: input.horasTotales,
  };
  const campos = changedFields(
    ["nombre", "carreraId", "horasTotales"],
    row,
    next,
  );
  if (campos.length === 0) return { kind: "unchanged", id };
  const updated = await tx
    .update(asignatura)
    .set(next)
    .where(asignaturaRowInScope(scope, id))
    .returning({ id: asignatura.id });
  return updated.length === 0
    ? { kind: "not_found" }
    : { kind: "updated", id, campos };
}

/**
 * Deactivates or reactivates. Deactivation counts the active Grupos through
 * the same handle (the caller's advisory lock makes count-then-update atomic
 * against Grupo writers, design decision 4) and is refused when any exist; the
 * count needs no scope predicate of its own because the scoped read above
 * already proved the Asignatura is in scope. Reactivation has no precondition
 * and never touches Grupo (AC-PAR). A no-op answers `unchanged`.
 */
export async function setAsignaturaActivo(
  tx: Transaction,
  scope: CatalogScope,
  id: number,
  activo: boolean,
): Promise<AsignaturaActiveResult> {
  const row = await readScopedRow(tx, scope, id);
  if (!row) return { kind: "not_found" };
  if (row.activo === activo) return { kind: "unchanged", id };
  if (!activo) {
    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(grupo)
      .where(and(eq(grupo.asignaturaId, id), eq(grupo.activo, true)));
    if (count > 0) return { kind: "has_active_groups", count };
  }
  const updated = await tx
    .update(asignatura)
    .set({ activo })
    .where(asignaturaRowInScope(scope, id))
    .returning({ id: asignatura.id });
  return updated.length === 0
    ? { kind: "not_found" }
    : { kind: "changed", id, activo };
}
