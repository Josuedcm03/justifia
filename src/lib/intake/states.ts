// Request states (D7): `borrador` is the intake-only draft state, the rest are
// the RN-16 workflow states. This change writes `borrador` and `pendiente` only.
export const ESTADOS_SOLICITUD = [
  "borrador",
  "pendiente",
  "en_revision_coordinacion",
  "devuelta",
  "aprobada",
  "rechazada",
] as const;

export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[number];

/**
 * States a request listing, count or detail view may return. Every query meant
 * for requests MUST filter by this list so a draft never leaks (D7).
 */
export const VISIBLE_STATES: readonly EstadoSolicitud[] =
  ESTADOS_SOLICITUD.filter((estado) => estado !== "borrador");

export function isVisibleState(value: unknown): value is EstadoSolicitud {
  return (
    typeof value === "string" &&
    (VISIBLE_STATES as readonly string[]).includes(value)
  );
}
