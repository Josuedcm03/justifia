import type { RolUsuario } from "@/lib/validations/auth";

// Which requests a staff member may see and decide (SR-6, RN-15, RNF-01). Pure
// and fail-closed: only a `secretaria` with a facultad gets a scope; everything
// else, including an unresolved actor, gets `none`. The data layer resolves the
// actor from the database per request and renders the scope as SQL.

export type RequestScope =
  { kind: "facultad"; facultadId: number } | { kind: "none" };

export function requestScopeFor(
  rol: RolUsuario,
  actor: { facultadId: number | null } | null,
): RequestScope {
  if (rol === "secretaria" && actor !== null && actor.facultadId !== null) {
    return { kind: "facultad", facultadId: actor.facultadId };
  }
  return { kind: "none" };
}
