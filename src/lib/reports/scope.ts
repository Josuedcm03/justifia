import { canViewReports } from "@/lib/auth/permissions";
import type { RolUsuario } from "@/lib/validations/auth";

/**
 * Which requests a coordinator may see in the reports (CR-ACC-1, CR-SCOPE-1,
 * RNF-01): those of the student's CURRENT career. Resolved per request from the
 * database; never read from the session token.
 */
export type ReportScope =
  { kind: "carrera"; carreraId: number } | { kind: "none" };

/**
 * Pure and fail-closed, like `catalogScopeFor`: only a reporting role with a
 * career gets a scope; a missing career or a missing actor row gets `none`.
 */
export function reportScopeFor(
  rol: RolUsuario,
  actor: { carreraId: number | null } | null,
): ReportScope {
  if (canViewReports(rol) && actor?.carreraId != null) {
    return { kind: "carrera", carreraId: actor.carreraId };
  }
  return { kind: "none" };
}
