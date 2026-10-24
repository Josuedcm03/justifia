// src/lib/enrollment/types.ts — PURE. Types only. Results of the student
// enrollment writer, kept out of the `server-only` writer so the audit
// builders can map them to events (student-enrollment SE-2, SE-8).

export type EnrollResult =
  | {
      ok: true;
      kind: "created" | "reactivated";
      grupoId: number;
      /** Sibling groups of the same asignatura and period that were deactivated. */
      replaced: number[];
    }
  | { ok: false; reason: "not_student" | "not_eligible" | "already_enrolled" };

export type DropResult =
  | { ok: true; grupoId: number }
  | { ok: false; reason: "not_student" | "not_enrolled" };
