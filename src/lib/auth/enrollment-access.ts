import "server-only";

import { requireRole } from "@/lib/auth/dal";
import { rolesQueGestionanInscripciones } from "@/lib/auth/permissions";
import type { SessionPayload } from "@/lib/auth/session";
import { resolveRequestScope } from "@/lib/data/request-scope";
import type { RequestScope } from "@/lib/intake/request-scope";

export type EnrollmentAccess = {
  session: SessionPayload;
  actorId: number;
  scope: RequestScope;
};

/**
 * First statement of every enrollment-administration page and action
 * (EA-ACC-1). `requireRole` runs first, so the login, forced-password-change
 * and denied redirects win and the database is never read for a caller who may
 * not be here. `requireCatalogAccess` is deliberately not used: it admits
 * administrador and coordinacion. The facultad scope (SR-6) is read from the
 * database on every call and never from the session or a cache, so a
 * secretaria reassigned mid-session is scoped correctly on the next request.
 * Fail loud: any error propagates; there is no fallback scope.
 */
export async function requireEnrollmentAccess(): Promise<EnrollmentAccess> {
  const session = await requireRole(...rolesQueGestionanInscripciones);
  if (!/^[1-9]\d*$/.test(session.sub)) {
    throw new Error(
      "Enrollment access: session subject is not a valid user id",
    );
  }
  const actorId = Number(session.sub);
  if (!Number.isSafeInteger(actorId)) {
    throw new Error(
      "Enrollment access: session subject is not a valid user id",
    );
  }
  const scope = await resolveRequestScope(actorId, session.rol);
  return { session, actorId, scope };
}
