import "server-only";

import { and, eq, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { grupo, rol, usuario } from "@/db/schema";
import { changedFields } from "@/lib/audit/diff";
import type {
  DocenteActiveResult,
  DocenteWriteResult,
} from "@/lib/catalog/types";
import type { Transaction } from "@/lib/data/audit";
import { sqlStateOf } from "@/lib/data/catalog-write";

/** What the edit page receives: the six fields and nothing else. No `Login`,
 *  `HashClave`, `Cif`, role, `Carrera` or `Facultad` (DM-2). */
export type DocenteDetail = {
  id: number;
  nombreCompleto: string;
  correo: string | null;
  telefono: string | null;
  activo: boolean;
  gruposActivos: number;
};

/** Only an account whose role is `docente` can be addressed (DM-2, RN-02). */
const isDocente = eq(rol.codigo, "docente");

/**
 * The docente with this id, or `null` for a missing id and for an account of
 * any other role alike. Not fail-soft: callers decide on a thrown error.
 */
export async function getDocenteById(
  id: number,
): Promise<DocenteDetail | null> {
  const [row] = await db
    .select({
      id: usuario.id,
      nombreCompleto: usuario.nombreCompleto,
      correo: usuario.correo,
      telefono: usuario.telefono,
      activo: usuario.activo,
      gruposActivos:
        sql<number>`(select count(*) from ${grupo} where ${grupo.docenteId} = ${usuario.id} and ${grupo.activo})`.mapWith(
          Number,
        ),
    })
    .from(usuario)
    .innerJoin(rol, eq(usuario.rolId, rol.id))
    .where(and(eq(usuario.id, id), isDocente))
    .limit(1);
  return row ?? null;
}

// ---- Writes. Each takes the transaction handle opened by `withCatalogWrite`
// (which owns the lock, the transaction and the audit rows) and only reads and
// writes through it. No statement here deletes a row, and the only table
// written is `Usuario`.

/** The docente row read through `tx`, with the role id the UPDATE repeats. */
async function readDocenteRow(tx: Transaction, id: number) {
  const [row] = await tx
    .select({
      id: usuario.id,
      rolId: usuario.rolId,
      nombreCompleto: usuario.nombreCompleto,
      correo: usuario.correo,
      telefono: usuario.telefono,
      activo: usuario.activo,
    })
    .from(usuario)
    .innerJoin(rol, eq(usuario.rolId, rol.id))
    .where(and(eq(usuario.id, id), isDocente))
    .limit(1);
  return row;
}

/**
 * Edits the name, the email and the phone of an active docente. `Login`,
 * `HashClave`, `RolId`, `Activo` and `DebeCambiarClave` are never part of the
 * SET (DM-5). The diff runs against the row read inside the transaction, so a
 * concurrent edit is overwritten (last writer wins) and `campos` names what
 * this write really changed. The email lookup runs only when the email
 * changed, over every account whatever its role or state, and excludes the
 * docente itself (DM-4).
 *
 * The UPDATE runs in a savepoint: a failed statement poisons its scope in the
 * driver even when the caller catches the error, so a `23505` from a
 * concurrent writer of the same email can only be turned into `correo_taken`
 * by a scope of its own. Any other error, `55P03` included, propagates.
 */
export async function updateDocente(
  tx: Transaction,
  id: number,
  input: { nombreCompleto: string; correo: string; telefono: string | null },
): Promise<DocenteWriteResult> {
  const row = await readDocenteRow(tx, id);
  if (!row) return { kind: "not_found" };
  if (!row.activo) return { kind: "inactive" };
  const next = {
    nombreCompleto: input.nombreCompleto,
    correo: input.correo,
    telefono: input.telefono,
  };
  const campos = changedFields(
    ["nombreCompleto", "correo", "telefono"],
    row,
    next,
  );
  if (campos.length === 0) return { kind: "unchanged", id };
  if (campos.includes("correo")) {
    const [taken] = await tx
      .select({ id: usuario.id })
      .from(usuario)
      .where(
        and(
          eq(sql`lower(${usuario.correo})`, input.correo),
          ne(usuario.id, id),
        ),
      )
      .limit(1);
    if (taken) return { kind: "correo_taken" };
  }
  const set = Object.fromEntries(
    campos.map((field) => [field, next[field]]),
  ) as Partial<typeof next>;
  try {
    const updated = await tx.transaction(async (savepoint) =>
      savepoint
        .update(usuario)
        .set(set)
        .where(and(eq(usuario.id, id), eq(usuario.rolId, row.rolId)))
        .returning({ id: usuario.id }),
    );
    return updated.length === 0
      ? { kind: "not_found" }
      : { kind: "updated", id, campos };
  } catch (error) {
    if (sqlStateOf(error) === "23505") return { kind: "correo_taken" };
    throw error;
  }
}

/**
 * Deactivates or reactivates a docente. Deactivation counts the active Grupos
 * of every period and whatever the state of their Asignatura, through the same
 * handle (the caller's advisory lock makes count-then-update atomic against
 * every Grupo writer), and is refused when any exist. Reactivation has no
 * precondition and never touches Grupo. A no-op answers `unchanged`.
 */
export async function setDocenteActivo(
  tx: Transaction,
  id: number,
  activo: boolean,
): Promise<DocenteActiveResult> {
  const row = await readDocenteRow(tx, id);
  if (!row) return { kind: "not_found" };
  if (row.activo === activo) return { kind: "unchanged", id };
  if (!activo) {
    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(grupo)
      .where(and(eq(grupo.docenteId, id), eq(grupo.activo, true)));
    if (count > 0) return { kind: "has_active_groups", count };
  }
  const updated = await tx
    .update(usuario)
    .set({ activo })
    .where(and(eq(usuario.id, id), eq(usuario.rolId, row.rolId)))
    .returning({ id: usuario.id });
  return updated.length === 0
    ? { kind: "not_found" }
    : { kind: "changed", id, activo };
}
