import "server-only";

import {
  and,
  asc,
  eq,
  ilike,
  inArray,
  not,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { QueryBuilder } from "drizzle-orm/pg-core";

import { db } from "@/db";
import {
  carrera,
  rol,
  usuario,
  type NuevoUsuario,
  type Usuario,
} from "@/db/schema";
import { rolesVisiblesPara } from "@/lib/auth/permissions";
import {
  CATALOG_OPTIONS_MAX,
  DOCENTES_DEFAULT_SORT,
  type DocentesSortKey,
} from "@/lib/catalog/list-params";
import type {
  CatalogListResult,
  CatalogStatusFilter,
  DocenteListItem,
} from "@/lib/catalog/types";
import {
  activeFirst,
  collatedText,
  emailLast,
  orderByFor,
  plainColumn,
  type SortExpr,
} from "@/lib/data/sort-sql";
import { containsPattern } from "@/lib/data/sql-like";
import type { CatalogExecutor } from "@/lib/data/catalog";
import { getRolIdByCodigo } from "@/lib/data/roles";
import { WRITE_CHUNK_ROWS } from "@/lib/import/limits";
import type { ListSort, PageSize, StatusFilterValue } from "@/lib/list-params";
import { USERS_DEFAULT_SORT, type UsersSortKey } from "@/lib/users/list-params";
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
  facultadId: usuario.facultadId,
  activo: usuario.activo,
  debeCambiarClave: usuario.debeCambiarClave,
  creadoEn: usuario.creadoEn,
  rol: rol.codigo,
} as const;

/**
 * What the users list reads and shows, and nothing else: no `hashClave`,
 * `cif`, `telefono` or `correo` (UL:fields, DT-DATA-1). The search still
 * matches on `correo` inside the predicate without selecting it.
 */
export type UsuarioListItem = {
  id: number;
  nombreCompleto: string;
  login: string;
  rol: RolUsuario;
  activo: boolean;
  creadoEn: Date;
};

/** The list projection, shared by the real read and the proof query. */
export const usuarioListColumns = {
  id: usuario.id,
  nombreCompleto: usuario.nombreCompleto,
  login: usuario.login,
  rol: rol.codigo,
  activo: usuario.activo,
  creadoEn: usuario.creadoEn,
} as const;

/**
 * Whitelist of sortable users columns (DT-SORT-1). The URL value is only a
 * lookup key, already narrowed to `UsersSortKey` by the parser; it is never
 * interpolated. Names and logins are collated, the role code is the plain
 * column, `status` ascending means active first.
 */
const USERS_SORT_MAP = {
  name: collatedText(usuario.nombreCompleto),
  login: collatedText(usuario.login),
  role: plainColumn(rol.codigo),
  status: activeFirst(usuario.activo),
  created: plainColumn(usuario.creadoEn),
} satisfies Record<UsersSortKey, SortExpr>;

function usersOrderBy(sort: ListSort<UsersSortKey>) {
  return orderByFor(USERS_SORT_MAP, sort, USERS_DEFAULT_SORT, usuario.id);
}

export type ListUsuariosParams = {
  /** From the SESSION only — never from `searchParams` (design.md decision 18). */
  viewerRol: RolUsuario;
  /** Already normalised by `parseUsersListParams`. */
  q: string;
  /** Already narrowed to the closed set; required so no caller omits it. */
  status: StatusFilterValue;
  /** Already narrowed to a whitelisted key and a direction. */
  sort: ListSort<UsersSortKey>;
  /** Already >= 1; the upper bound is clamped here, against `total`. */
  page: number;
  /** One of 10, 25, 50 by the time it arrives. */
  pageSize: PageSize;
};

export type UsuarioListResult = {
  data: UsuarioListItem[];
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
 * The scope is always the first, unconditional term; `status` and the search
 * term can only narrow it through `and`.
 */
export function buildUsersWhere(
  viewerRol: RolUsuario | undefined,
  q: string,
  status: StatusFilterValue,
) {
  const scope = inArray(rol.codigo, [...rolesVisiblesPara(viewerRol)]);
  const state =
    status === "active"
      ? sql`${usuario.activo}`
      : status === "inactive"
        ? not(usuario.activo)
        : undefined;
  const term = q
    ? or(
        ilike(usuario.nombreCompleto, containsPattern(q)),
        ilike(usuario.login, containsPattern(q)),
        ilike(usuario.correo, containsPattern(q)),
      )
    : undefined;
  const narrowing = [state, term].filter(
    (part): part is SQL => part !== undefined,
  );
  return narrowing.length > 0 ? (and(scope, ...narrowing) as SQL) : scope;
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
  page: {
    page: number;
    pageSize: number;
    sort?: ListSort<UsersSortKey>;
  },
) {
  return qb
    .select(usuarioListColumns)
    .from(usuario)
    .innerJoin(rol, eq(usuario.rolId, rol.id))
    .where(where)
    .orderBy(...usersOrderBy(page.sort ?? USERS_DEFAULT_SORT))
    .limit(page.pageSize)
    .offset((page.page - 1) * page.pageSize);
}

export async function listUsuarios(
  p: ListUsuariosParams,
): Promise<UsuarioListResult> {
  try {
    const where = buildUsersWhere(p.viewerRol, p.q, p.status);
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(usuario)
      .innerJoin(rol, eq(usuario.rolId, rol.id))
      .where(where);
    const total = count;
    const page = clampPage(p.page, total, p.pageSize);
    const data = await db
      .select(usuarioListColumns)
      .from(usuario)
      .innerJoin(rol, eq(usuario.rolId, rol.id))
      .where(where)
      .orderBy(...usersOrderBy(p.sort))
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
 * The facultad of the user's CURRENT carrera (`Usuario.CarreraId ->
 * Carrera.FacultadId`), or null when the user has no carrera (SR-16). Used to
 * stamp a new secretaria with her creator's facultad. It projects only the
 * facultad and is fail-loud, like `getCatalogActor`: a database error must
 * reject the creation rather than create an account without a scope.
 */
export async function getUserFacultadId(id: number): Promise<number | null> {
  const [row] = await db
    .select({ facultadId: carrera.facultadId })
    .from(usuario)
    .innerJoin(carrera, eq(carrera.id, usuario.carreraId))
    .where(eq(usuario.id, id))
    .limit(1);
  return row?.facultadId ?? null;
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

/**
 * The one `where` clause of the Docentes list, shared by the count and the
 * page: users whose role code is `docente`, narrowed by state and by a partial,
 * case-insensitive search over name and Correo. It takes no scope: the list is
 * not Carrera-scoped (CM-LST-1). The term is escaped and bound as a parameter.
 */
export function buildDocentesWhere(f: {
  status: CatalogStatusFilter;
  q: string;
}): SQL {
  const parts = [
    eq(rol.codigo, "docente"),
    f.status === "active"
      ? sql`${usuario.activo}`
      : f.status === "inactive"
        ? not(usuario.activo)
        : undefined,
    f.q
      ? or(
          ilike(usuario.nombreCompleto, containsPattern(f.q)),
          ilike(usuario.correo, containsPattern(f.q)),
        )
      : undefined,
  ].filter((part): part is SQL => part !== undefined);
  return and(...parts) as SQL;
}

/**
 * Whitelist of sortable Docentes columns (DT-SORT-1). The URL value is only a
 * lookup key, already narrowed to `DocentesSortKey` by the parser; it is never
 * interpolated. Names and logins are collated, an empty e-mail sorts last in
 * both directions, `status` ascending means active first.
 */
const DOCENTES_SORT_MAP = {
  name: collatedText(usuario.nombreCompleto),
  login: collatedText(usuario.login),
  email: emailLast(usuario.correo),
  status: activeFirst(usuario.activo),
} satisfies Record<DocentesSortKey, SortExpr>;

/**
 * Docentes for the read-only catalog list. It projects ONLY the five fields
 * the list shows (never the hash, CIF or phone) and is fail-soft like
 * `listUsuarios`: a thrown error is an empty, degraded page.
 */
export async function listDocentes(p: {
  status: CatalogStatusFilter;
  q: string;
  page: number;
  pageSize: number;
  /** Already narrowed to a whitelisted key and a direction; omitted = name
   *  ascending, then `Id`. */
  sort?: ListSort<DocentesSortKey>;
}): Promise<CatalogListResult<DocenteListItem>> {
  try {
    const where = buildDocentesWhere(p);
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(usuario)
      .innerJoin(rol, eq(usuario.rolId, rol.id))
      .where(where);
    const page = clampPage(p.page, count, p.pageSize);
    const data = await db
      .select({
        id: usuario.id,
        nombreCompleto: usuario.nombreCompleto,
        login: usuario.login,
        correo: usuario.correo,
        activo: usuario.activo,
      })
      .from(usuario)
      .innerJoin(rol, eq(usuario.rolId, rol.id))
      .where(where)
      .orderBy(
        ...orderByFor(
          DOCENTES_SORT_MAP,
          p.sort ?? DOCENTES_DEFAULT_SORT,
          DOCENTES_DEFAULT_SORT,
          usuario.id,
        ),
      )
      .limit(p.pageSize)
      .offset((page - 1) * p.pageSize);
    return { data, total: count, page, pageSize: p.pageSize, degraded: false };
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
    facultadId: row.facultadId,
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
