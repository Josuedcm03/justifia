import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { usuario } from "@/db/schema";
import { canReviewRequests } from "@/lib/auth/permissions";
import { requestScopeFor, type RequestScope } from "@/lib/intake/request-scope";
import type { RolUsuario } from "@/lib/validations/auth";

/**
 * The caller's request scope, read from the database on every call and never
 * cached (SR-6): a secretary reassigned mid-session is scoped correctly on the
 * next request. Fail loud on a database error, fail closed on a missing
 * account or facultad. A role that cannot review gets `none` without a read.
 */
export async function resolveRequestScope(
  userId: number,
  rol: RolUsuario,
): Promise<RequestScope> {
  if (!canReviewRequests(rol)) return { kind: "none" };
  const [actor] = await db
    .select({ facultadId: usuario.facultadId })
    .from(usuario)
    .where(eq(usuario.id, userId))
    .limit(1);
  return requestScopeFor(rol, actor ?? null);
}
