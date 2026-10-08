import "server-only";

import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import type { QueryBuilder } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { rol, usuario, type NuevoUsuario, type Usuario } from "@/db/schema";
import { rolesVisiblesPara } from "@/lib/auth/permissions";
import { CATALOG_OPTIONS_MAX } from "@/lib/catalog/list-params";
import { containsPattern } from "@/lib/data/sql-like";
import type { CatalogExecutor } from "@/lib/data/catalog";
import { getRolIdByCodigo } from "@/lib/data/roles";
import { WRITE_CHUNK_ROWS } from "@/lib/import/limits";
import type { RolUsuario } from "@/lib/validations/auth";

/**
 * Read DTO: the field is still named `rol` and still carries the CODE, via
 * `innerJoin` (design.md decision 3). Every existing consumer of `.rol`
 * (login, users list, profile) keeps working unchanged.
 */
export type UsuarioConRol = Omit<Usuario, "rolId"> & { rol: RolUsuario };

/**
 * Write DTO: callers pass the CODE; `createUsuario` resolves it to the
 * catalog id internally (design.md decision 4).
 */
export type NuevoUsuarioConRol = Omit<NuevoUsuario, "rolId"> & {
  rol: RolUsuario;
};

/** Columns shared by every `UsuarioConRol` projection (login, list, byLogin). */
const usuarioConRolColumns = {
  id: usuario.id,
  login: usuario.login,
  hashClave: usuario.hashClave,
  nombreCompleto: usuario.nombreCompleto,
  correo: usuario.correo,
  telefono: usuario.telefono,
  cif: usuario.cif,
  carreraId: usuario.carreraId,
  activo: usuario.activo,
  debeCambiarClave: usuario.debeCambiarClave,
  creadoEn: usuario.creadoEn,
  rol: rol.codigo,
} as const;

export type ListUsuariosParams = {
  /** From the SESSION only — never from `searchParams` (design.md decision 18). */
  viewerRol: RolUsuario;
  /** Already normalised by `parseUsersListParams`. */
  q: string;
  /** Already >= 1; the upper bound is clamped here, against `total`. */
  page: number;
  pageSize: number;
};

export type UsuarioListResult = {
  data: UsuarioConRol[];
  total: number;
  /** The CLAMPED page actually rendered. */
  page: number;
  pageSize: number;
  degraded: boolean;
};

/**
 * The one `where` clause, built once and reused by both the count and the
 * page query (design.md decision 19). The scope is a branch-free `inArray`
 * fed by `rolesVisiblesPara`: an unknown or empty scope makes `inArray` emit
 * a literal `false`, i.e. zero rows — it fails closed, never open
 * (design.md decision 18, finding 8). WU2: the scope now names
 * `"Rol"."Codigo"` (via the join), never the dropped `Usuario.Rol` column.
 */
export function buildUsersWhere(viewerRol: RolUsuario | undefined, q: string) {
  const scope = inArray(rol.codigo, [...rolesVisiblesPara(viewerRol)]);
  const term = q
    ? or(
        ilike(usuario.nombreCompleto, containsPattern(q)),
        ilike(usuario.login, containsPattern(q)),
        ilike(usuario.correo, containsPattern(q)),
      )
    : undefined;
  return term ? and(scope, term) : scope;
}

/**
 * An out-of-range page clamps to the last page instead of erroring or
 * showing an empty table for a stale request (design.md decision 23).
 */
export function clampPage(
  requested: number,
  total: number,
  pageSize: number,
): number {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  return Math.min(Math.max(requested, 1), lastPage);
}

/**
 * The pure query shape used ONLY to prove the emitted SQL and params in
 * `users-query.test.ts`, via a DB-free `new QueryBuilder()` from
 * `drizzle-orm/pg-core` (design.md finding 8: `toSQL()` needs no connection
 * and no `@/db` import). `listUsuarios` below composes the same `where`
 * (`buildUsersWhere`) against the real `db`, so the security-critical
 * predicate is never written twice; only this inert order/limit/offset shape
 * is, which carries no scope logic to drift. WU2 adds the `innerJoin` that
 * `buildUsersWhere`'s scope now depends on.
 */
export function buildListUsuariosQuery(
  qb: QueryBuilder,
  where: ReturnType<typeof buildUsersWhere>,
  page: { page: number; pageSize: number },
) {
  return qb
    .select()
    .from(usuario)
    .innerJoin(rol, eq(usuario.rolId, rol.id))
    .where(where)
    .orderBy(desc(usuario.creadoEn), desc(usuario.id))
    .limit(page.pageSize)
    .offset((page.page - 1) * page.pageSize);
}

export async function listUsuarios(
  p: ListUsuariosParams,
): Promise<UsuarioListResult> {
  try {
    const where = buildUsersWhere(p.viewerRol, p.q);
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(usuario)
      .innerJoin(rol, eq(usuario.rolId, rol.id))
      .where(where);
    const total = count;
    const page = clampPage(p.page, total, p.pageSize);
    const data = await db
      .select(usuarioConRolColumns)
      .from(usuario)
      .innerJoin(rol, eq(usuario.rolId, rol.id))
      .where(where)
      .orderBy(desc(usuario.creadoEn), desc(usuario.id))
      .limit(p.pageSize)
      .offset((page - 1) * p.pageSize);
    return { data, total, page, pageSize: p.pageSize, degraded: false };
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

export type DashboardStats = {
  totalUsuarios: number;
  usuariosActivos: number;
  degraded: boolean;
};

export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    const [total, activos] = await Promise.all([
      db.$count(usuario),
      db.$count(usuario, eq(usuario.activo, true)),
    ]);
    return { totalUsuarios: total, usuariosActivos: activos, degraded: false };
  } catch {
    return { totalUsuarios: 0, usuariosActivos: 0, degraded: true };
  }
}

export async function getUsuarioByLogin(
  login: string,
): Promise<UsuarioConRol | null> {
  const [row] = await db
    .select(usuarioConRolColumns)
    .from(usuario)
    .innerJoin(rol, eq(usuario.rolId, rol.id))
    .where(eq(usuario.login, login))
    .limit(1);
  return row ?? null;
}

/**
 * Identity resolution by email (IAP). The input is trimmed and lowercased and
 * the column is compared through `lower()`, so a stored mixed-case address
 * still matches. Returns the first match; `Usuario.Correo` is unique.
 */
export async function getUsuarioByCorreo(
  correo: string,
): Promise<UsuarioConRol | null> {
  const normalized = correo.trim().toLowerCase();
  const [row] = await db
    .select(usuarioConRolColumns)
    .from(usuario)
    .innerJoin(rol, eq(usuario.rolId, rol.id))
    .where(sql`lower(${usuario.correo}) = ${normalized}`)
    .limit(1);
  return row ?? null;
}

/** Identity resolution by CIF (IAP). `Usuario.Cif` is unique. */
export async function getUsuarioByCif(
  cif: string,
): Promise<UsuarioConRol | null> {
  const [row] = await db
    .select(usuarioConRolColumns)
    .from(usuario)
    .innerJoin(rol, eq(usuario.rolId, rol.id))
    .where(eq(usuario.cif, cif))
    .limit(1);
  return row ?? null;
}

/**
 * The caller's stored Carrera, by primary key, for the catalog guard. It
 * projects ONLY `carreraId` (never the hash, CIF or email) and is fail-loud:
 * no `try/catch`, no fallback. It is security-critical, so a database error
 * must reject the request rather than guess a scope. `null` means the row no
 * longer exists.
 */
export async function getCatalogActor(
  id: number,
): Promise<{ carreraId: number | null } | null> {
  const [row] = await db
    .select({ carreraId: usuario.carreraId })
    .from(usuario)
    .where(eq(usuario.id, id))
    .limit(1);
  return row ?? null;
}

/**
 * Active users whose role code is `docente`, for the Grupo docente select.
 * It projects ONLY what a select needs (never the hash, CIF or phone), is
 * capped at `CATALOG_OPTIONS_MAX` and is not fail-soft: a thrown error
 * reaches the caller.
 */
export async function listDocenteOptions(): Promise<
  { id: number; nombreCompleto: string; correo: string | null }[]
> {
  return db
    .select({
      id: usuario.id,
      nombreCompleto: usuario.nombreCompleto,
      correo: usuario.correo,
    })
    .from(usuario)
    .innerJoin(rol, eq(usuario.rolId, rol.id))
    .where(and(eq(rol.codigo, "docente"), eq(usuario.activo, true)))
    .orderBy(asc(usuario.nombreCompleto), asc(usuario.id))
    .limit(CATALOG_OPTIONS_MAX);
}

/** Sets or clears the forced-password-change flag (FPC). */
export async function setDebeCambiarClave(
  id: number,
  value: boolean,
): Promise<void> {
  await db
    .update(usuario)
    .set({ debeCambiarClave: value })
    .where(eq(usuario.id, id));
}

/**
 * Replaces the hash and clears the forced-change flag in ONE statement scoped
 * to one id, so the two columns cannot diverge (FPC: Successful change). The
 * caller has already hashed the new password; nothing here sees plaintext.
 */
export async function updateClaveAndClearFlag(
  id: number,
  hashClave: string,
): Promise<void> {
  await db
    .update(usuario)
    .set({ hashClave, debeCambiarClave: false })
    .where(eq(usuario.id, id));
}

export async function createUsuario(
  data: NuevoUsuarioConRol,
): Promise<UsuarioConRol> {
  const { rol: codigo, ...resto } = data;
  const rolId = await getRolIdByCodigo(codigo);
  const [row] = await db
    .insert(usuario)
    .values({ ...resto, rolId })
    .returning();
  return {
    id: row.id,
    login: row.login,
    hashClave: row.hashClave,
    nombreCompleto: row.nombreCompleto,
    correo: row.correo,
    telefono: row.telefono,
    cif: row.cif,
    carreraId: row.carreraId,
    activo: row.activo,
    debeCambiarClave: row.debeCambiarClave,
    creadoEn: row.creadoEn,
    rol: codigo,
  };
}

/**
 * One import-created account. The caller has already hashed the temporary
 * password (bcrypt, outside the transaction); `debeCambiarClave` is forced to
 * `true` here and is deliberately not part of the input.
 */
export type NuevaCuentaImportada = Omit<NuevoUsuario, "debeCambiarClave">;

/**
 * Bulk insert for the import, on the TRANSACTION handle (never `db`). Chunked
 * at `WRITE_CHUNK_ROWS`; returns the new ids in input order. PostgreSQL does
 * not formally promise that `RETURNING` follows VALUES order, so each chunk
 * returns `Login` with `Id` and ids are mapped back by login (unique). A
 * mismatch throws: a silent one would attach audit events and group
 * references to the wrong account.
 */
export async function createUsuariosBulk(
  tx: CatalogExecutor,
  rows: readonly NuevaCuentaImportada[],
): Promise<number[]> {
  const indexByLogin = new Map<string, number>();
  rows.forEach((r, i) => {
    if (indexByLogin.has(r.login)) {
      throw new Error(`createUsuariosBulk: duplicate login "${r.login}"`);
    }
    indexByLogin.set(r.login, i);
  });

  const ids: (number | undefined)[] = new Array(rows.length).fill(undefined);
  for (let i = 0; i < rows.length; i += WRITE_CHUNK_ROWS) {
    const chunk = rows
      .slice(i, i + WRITE_CHUNK_ROWS)
      .map((r) => ({ ...r, debeCambiarClave: true }));
    const inserted = await tx
      .insert(usuario)
      .values(chunk)
      .returning({ id: usuario.id, login: usuario.login });
    for (const r of inserted) {
      const index = indexByLogin.get(r.login);
      if (index === undefined) {
        throw new Error(`createUsuariosBulk: unexpected login "${r.login}"`);
      }
      ids[index] = r.id;
    }
  }

  return rows.map((r, i) => {
    const id = ids[i];
    if (id === undefined) {
      throw new Error(`createUsuariosBulk: no id returned for "${r.login}"`);
    }
    return id;
  });
}
