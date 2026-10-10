import "server-only";

import { requireRole } from "@/lib/auth/dal";
import { rolesQueGestionanCatalogo } from "@/lib/auth/permissions";
import type { SessionPayload } from "@/lib/auth/session";
import { catalogScopeFor, type CatalogScope } from "@/lib/catalog/scope";
import { getCatalogActor } from "@/lib/data/users";

export type CatalogAccess = {
  session: SessionPayload;
  actorId: number;
  scope: CatalogScope;
};

/**
 * First statement of every catalog page and action. `requireRole` runs first,
 * so the login, forced-password-change and denied redirects win and the
 * database is never read for a caller who may not be here. The scope is read
 * from the database on every call and never cached (design decision 2): a
 * coordinator reassigned mid-session is scoped correctly on the next request.
 * Fail loud: any error propagates; there is no fallback scope.
 */
export async function requireCatalogAccess(): Promise<CatalogAccess> {
  const session = await requireRole(...rolesQueGestionanCatalogo);
  if (!/^[1-9]\d*$/.test(session.sub)) {
    throw new Error("Catalog access: session subject is not a valid user id");
  }
  const actorId = Number(session.sub);
  if (!Number.isSafeInteger(actorId)) {
    throw new Error("Catalog access: session subject is not a valid user id");
  }
  const actor = await getCatalogActor(actorId);
  return { session, actorId, scope: catalogScopeFor(session.rol, actor) };
}
