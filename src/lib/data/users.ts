import "server-only";

import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { usuario, type NuevoUsuario, type Usuario } from "@/db/schema";

export type UsuarioListResult = {
  data: Usuario[];
  degraded: boolean;
};

export async function listUsuarios(): Promise<UsuarioListResult> {
  try {
    const data = await db
      .select()
      .from(usuario)
      .orderBy(desc(usuario.creadoEn))
      .limit(100);
    return { data, degraded: false };
  } catch {
    return { data: [], degraded: true };
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
