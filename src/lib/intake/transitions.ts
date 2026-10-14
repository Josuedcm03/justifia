import type { RolUsuario } from "@/lib/validations/auth";

import type { EstadoSolicitud } from "./states";

// RN-15 / RN-16 state machine as a pure table (SR-4). Every data write derives
// its `WHERE "Estado" = <from>` guard from this table, and a test pins that the
// SQL guard and the table agree. `en_revision_coordinacion` stays a valid state
// with no edge (RF-10 is out of scope); `aprobada` and `rechazada` are terminal.

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
