import type { RolUsuario } from "@/lib/validations/auth";

// Which escalations a coordinator may see and answer (ES-9, RNF-01). Pure and
// fail-closed, like `requestScopeFor`: only an active `coordinacion` with a
// career gets a scope; everything else, including an unresolved actor, gets
// `none`. It is a separate type from `RequestScope` on purpose: a coordinator
// can never be handed to a secretary data function by type. The data layer
// resolves the actor from the database per request and renders the scope as
// SQL.

export type CoordinationScope =
  { kind: "carrera"; carreraId: number } | { kind: "none" };

export function coordinationScopeFor(
  rol: RolUsuario,
  actor: { carreraId: number | null; activo: boolean } | null,
): CoordinationScope {
  if (
    rol === "coordinacion" &&
    actor !== null &&
    actor.activo &&
    actor.carreraId !== null
  ) {
    return { kind: "carrera", carreraId: actor.carreraId };
  }
  return { kind: "none" };
}
