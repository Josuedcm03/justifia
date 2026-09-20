import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { rol } from "@/db/schema";
import type { RolUsuario } from "@/lib/validations/auth";

/**
 * Thrown when a role code has no matching catalog row. Fail-loud (design.md
 * decision 4): security-critical writes never silently coerce or drop a
 * role, unlike the fail-soft `{ data, degraded }` contract used by listings.
 */
export class RolDesconocidoError extends Error {
  constructor(codigo: string) {
    super(`Rol desconocido: "${codigo}"`);
    this.name = "RolDesconocidoError";
  }
}

/**
 * Resolves a role CODE to its catalog id. Used by `createUsuario` so every
 * caller keeps working with the code (design.md decision 4).
 */
export async function getRolIdByCodigo(codigo: RolUsuario): Promise<number> {
  const [row] = await db
    .select({ id: rol.id })
    .from(rol)
    .where(eq(rol.codigo, codigo))
    .limit(1);
  if (!row) throw new RolDesconocidoError(codigo);
  return row.id;
}
