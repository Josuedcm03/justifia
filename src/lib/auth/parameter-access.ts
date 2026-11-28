import "server-only";

import { requireRole } from "@/lib/auth/dal";
import { rolesQueGestionanParametros } from "@/lib/auth/permissions";
import type { SessionPayload } from "@/lib/auth/session";

export type ParameterAccess = {
  session: SessionPayload;
  actorId: number;
};

/**
 * First statement of the parameters page and of every parameter action (NP-6).
 * `requireRole` runs first, so the login, forced-password-change and denied
 * redirects win and nothing is read for a caller who may not be here.
 * Parameters have no Facultad or Carrera, so there is no scope to resolve and
 * no database read at all: any secretaria, whatever her own Facultad, may edit.
 * Fail loud: a malformed session subject throws.
 */
export async function requireParameterAccess(): Promise<ParameterAccess> {
  const session = await requireRole(...rolesQueGestionanParametros);
  if (!/^[1-9]\d*$/.test(session.sub)) {
    throw new Error("Parameter access: session subject is not a valid user id");
  }
  const actorId = Number(session.sub);
  if (!Number.isSafeInteger(actorId)) {
    throw new Error("Parameter access: session subject is not a valid user id");
  }
  return { session, actorId };
}
