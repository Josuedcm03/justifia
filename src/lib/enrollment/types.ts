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

/** The one refusal only the staff assign can get (EA-SIB-1, EA-CHG-1): the
 *  siblings the writer found under the lock are not exactly the group the user
 *  saw and confirmed as replaced, so nothing was changed. It has no student
 *  counterpart, so it is NOT a member of `EnrollResult` or
 *  `EnrollmentErrorCode` and the student path never sees it. */
export type StaleResult = { ok: false; reason: "stale" };

/** What the staff writer answers: the shared result or the staff-only refusal. */
export type StaffEnrollResult = EnrollResult | StaleResult;

export type DropResult =
  | { ok: true; grupoId: number }
  | { ok: false; reason: "not_student" | "not_enrolled" };

/** The `enrollment.errors.<code>` message the UI shows for a refused or failed
 *  action: the writer refusals, `invalid` (zod) and `unexpected` (thrown). */
export type EnrollmentErrorCode =
  | "not_student"
  | "not_eligible"
  | "already_enrolled"
  | "not_enrolled"
  | "invalid"
  | "unexpected";

export type EnrollmentActionResult =
  { ok: true } | { ok: false; error: EnrollmentErrorCode };
