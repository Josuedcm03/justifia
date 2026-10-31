import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { usuario } from "@/db/schema";
import { canViewReports } from "@/lib/auth/permissions";
import { reportScopeFor, type ReportScope } from "@/lib/reports/scope";
import type { RolUsuario } from "@/lib/validations/auth";

/**
 * The caller's report scope, read from the database on every call and never
 * cached (CR-2): a coordinator reassigned mid-session is scoped correctly on the
 * next request. Fail loud on a database error, fail closed on a missing account
 * or career. A role that cannot see reports gets `none` without a read.
 */
export async function resolveReportScope(
  userId: number,
  rol: RolUsuario,
): Promise<ReportScope> {
  if (!canViewReports(rol)) return { kind: "none" };
  const [actor] = await db
    .select({ carreraId: usuario.carreraId })
    .from(usuario)
    .where(eq(usuario.id, userId))
    .limit(1);
  return reportScopeFor(rol, actor ?? null);
}
