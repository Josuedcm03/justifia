import "server-only";

import { requireRole } from "@/lib/auth/dal";
import { rolesQueGestionanDocentes } from "@/lib/auth/permissions";
import type { SessionPayload } from "@/lib/auth/session";

export type DocenteAccess = {
  session: SessionPayload;
  actorId: number;
};

/**
 * First statement of every docente-maintenance page and action (DM-1).
 * `requireRole` runs first, so the login, forced-password-change and denied
 * redirects win and nothing is read for a caller who may not be here.
 * `requireCatalogAccess` is deliberately not used: it admits administrador and
 * coordinacion and reads the actor's scope. Docentes have no Facultad or
 * Carrera, so there is no scope to resolve and no database read at all: any
 * secretaria, whatever her own Facultad, maintains any docente.
 * Fail loud: a malformed session subject throws.
 */
export async function requireDocenteAccess(): Promise<DocenteAccess> {
  const session = await requireRole(...rolesQueGestionanDocentes);
  if (!/^[1-9]\d*$/.test(session.sub)) {
    throw new Error("Docente access: session subject is not a valid user id");
  }
  const actorId = Number(session.sub);
  if (!Number.isSafeInteger(actorId)) {
    throw new Error("Docente access: session subject is not a valid user id");
  }
  return { session, actorId };
}
