import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { usuario } from "@/db/schema";
import { canCoordinate } from "@/lib/auth/permissions";
import {
  coordinationScopeFor,
  type CoordinationScope,
} from "@/lib/intake/coordination-scope";
import type { RolUsuario } from "@/lib/validations/auth";

/**
 * The caller's coordination scope, read from the database on every call and
 * never cached (ES-9): a coordinator moved to another career, or deactivated
 * mid-session, is scoped correctly on the next request. Fail loud on a database
 * error, fail closed on a missing account, an inactive one or no career. A role
 * that cannot coordinate gets `none` without a read.
 */
export async function resolveCoordinationScope(
  userId: number,
  rol: RolUsuario,
): Promise<CoordinationScope> {
  if (!canCoordinate(rol)) return { kind: "none" };
  const [actor] = await db
    .select({ carreraId: usuario.carreraId, activo: usuario.activo })
    .from(usuario)
    .where(eq(usuario.id, userId))
    .limit(1);
  return coordinationScopeFor(rol, actor ?? null);
}
