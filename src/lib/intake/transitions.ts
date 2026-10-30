import type { RolUsuario } from "@/lib/validations/auth";

import type { EstadoSolicitud } from "./states";

// RN-15 / RN-16 state machine as a pure table (SR-4). Every data write derives
// its `WHERE "Estado" = <from>` guard from this table, and a test pins that the
// SQL guard and the table agree. `en_revision_coordinacion` is entered only by
// the secretary escalation and left only by the coordinator answer (RF-10);
// `aprobada` and `rechazada` are terminal.

export interface Transition {
  from: EstadoSolicitud;
  to: EstadoSolicitud;
  actor: RolUsuario;
}

export const TRANSITIONS: readonly Transition[] = [
  // Submit (intake).
  { from: "borrador", to: "pendiente", actor: "estudiante" },
  // Secretary decision (RN-15).
  { from: "pendiente", to: "aprobada", actor: "secretaria" },
  { from: "pendiente", to: "rechazada", actor: "secretaria" },
  { from: "pendiente", to: "devuelta", actor: "secretaria" },
  // Correction resubmit (RF-08 c).
  { from: "devuelta", to: "pendiente", actor: "estudiante" },
  // Escalation to the career coordination and its answer (RF-10, ES-4).
  { from: "pendiente", to: "en_revision_coordinacion", actor: "secretaria" },
  { from: "en_revision_coordinacion", to: "pendiente", actor: "coordinacion" },
];

export function canTransition(
  from: EstadoSolicitud,
  to: EstadoSolicitud,
  actor: RolUsuario,
): boolean {
  return TRANSITIONS.some(
    (t) => t.from === from && t.to === to && t.actor === actor,
  );
}

/**
 * The only state `actor` may move a request into `to` from, read off the table
 * so a SQL guard and the table cannot drift apart. Throws when the pair has no
 * edge or more than one source.
 */
export function sourceOf(
  to: EstadoSolicitud,
  actor: RolUsuario,
): EstadoSolicitud {
  const sources = new Set(
    TRANSITIONS.filter((t) => t.to === to && t.actor === actor).map(
      (t) => t.from,
    ),
  );
  const [only] = sources;
  if (sources.size !== 1 || only === undefined) {
    throw new Error(`No unique ${actor} transition into ${to}`);
  }
  return only;
}
