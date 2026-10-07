import { canManageCatalog, isCarreraScopedRole } from "@/lib/auth/permissions";
import type { RolUsuario } from "@/lib/validations/auth";

/**
 * What part of the catalog a caller may see and write. Resolved per request
 * from the database (design decision 2); never read from the session token.
 */
export type CatalogScope =
  { kind: "all" } | { kind: "carrera"; carreraId: number } | { kind: "none" };

/**
 * Pure. A carrera-scoped role without a carrera, or whose row no longer
 * exists (`actor === null`), gets `none`: it fails closed. Roles that cannot
 * manage the catalog also get `none`.
 */
export function catalogScopeFor(
  rol: RolUsuario,
  actor: { carreraId: number | null } | null,
): CatalogScope {
  if (isCarreraScopedRole(rol)) {
    return actor?.carreraId == null
      ? { kind: "none" }
      : { kind: "carrera", carreraId: actor.carreraId };
  }
  return canManageCatalog(rol) ? { kind: "all" } : { kind: "none" };
}

/** The carrera an Asignatura write may use, or null to refuse. */
export function carreraIdForWrite(
  scope: CatalogScope,
  requested: number | undefined,
): number | null {
  switch (scope.kind) {
    case "all":
      return requested ?? null;
    case "carrera":
      return requested === undefined || requested === scope.carreraId
        ? scope.carreraId
        : null;
    case "none":
      return null;
    default: {
      const unreachable: never = scope;
      throw new Error(`Unhandled catalog scope: ${String(unreachable)}`);
    }
  }
}
