import "server-only";

import { and, desc, eq, ilike, inArray, or } from "drizzle-orm";
import type { QueryBuilder } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { usuario, type NuevoUsuario, type Usuario } from "@/db/schema";
import { rolesVisiblesPara } from "@/lib/auth/permissions";
import { containsPattern } from "@/lib/data/sql-like";
import type { RolUsuario } from "@/lib/validations/auth";

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
  data: Usuario[];
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
 * (design.md decision 18, finding 8). Written against the existing
 * `Usuario.Rol` column; WU2 swaps this one column reference to `Rol.Codigo`.
 */
export function buildUsersWhere(viewerRol: RolUsuario | undefined, q: string) {
  const scope = inArray(usuario.rol, [...rolesVisiblesPara(viewerRol)]);
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
 * is, which carries no scope logic to drift.
 */
export function buildListUsuariosQuery(
  qb: QueryBuilder,
  where: ReturnType<typeof buildUsersWhere>,
  page: { page: number; pageSize: number },
) {
  return qb
    .select()
    .from(usuario)
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
    const total = await db.$count(usuario, where);
    const page = clampPage(p.page, total, p.pageSize);
    const data = await db
      .select()
      .from(usuario)
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
): Promise<Usuario | null> {
  const [row] = await db
    .select()
    .from(usuario)
    .where(eq(usuario.login, login))
    .limit(1);
  return row ?? null;
}

export async function createUsuario(data: NuevoUsuario): Promise<Usuario> {
  const [row] = await db.insert(usuario).values(data).returning();
  return row;
}
