import { isCausa } from "./causes";
import { CONSENT_VERSION } from "./consent";
import { isEndWithinWindow, isIsoDate } from "./dates";
import {
  validateSubjectSelections,
  type EligibleGroup,
  type SubjectErrorCode,
  type SubjectSelection,
} from "./eligibility";

// Submit-time validation (RF-03, RN-01..RN-05, RN-23, D15). Pure and
// side-effect free: the action passes the draft, the eligible groups and the
// Managua "today" derived from its single `now` (A5). Every invalid field is
// reported at once, each with a stable code the UI maps to an i18n message that
// states the expected correction (`intake.errors.<code>`).

export interface SubmissionInput {
  causa: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  selections: readonly SubjectSelection[];
  eligibleGroups: readonly EligibleGroup[];
  /** Documents in state `valido` only (RN-03). */
  validDocumentCount: number;
  /**
   * The consent version the client says it showed (RF-01 d). `undefined`, `null`
   * and anything that is not a string count as "not given".
   */
  consentVersion?: string | null;
}

export type SubmissionField =
  "causa" | "fechaInicio" | "fechaFin" | "subjects" | "documents" | "consent";

export type SubmissionErrorCode =
  | "causa_required"
  | "causa_invalid"
  | "start_required"
  | "start_invalid"
  | "end_required"
  | "end_invalid"
  | "end_before_start"
  | "end_too_old"
  | "subjects_required"
  | SubjectErrorCode
  | "documents_required"
  | "consent_required"
  | "consent_outdated";

export interface SubmissionError {
  field: SubmissionField;
  code: SubmissionErrorCode;
  /** Set for per-subject errors so the review step can mark the subject. */
  asignaturaId?: number;
}

/** Options of `validateSubmission`. */
export interface SubmissionOptions {
  /**
   * Apply the RN-23 filing window (default). A correction resubmit passes
   * `false`: the window was met when the request was first presented, so it is
   * not re-applied (RF-08 c). RN-05 and eligibility are always applied.
   */
  filingWindow?: boolean;
  /**
   * Require the consent of a first presentation (default, fail closed; RC-4). A
   * correction resubmit passes `false`: the request already carries the consent
   * given when it was first presented, or none when it predates consent (C4).
   */
  consent?: boolean;
}

export type SubmissionResult =
  { ok: true } | { ok: false; errors: SubmissionError[] };

function causeErrors(causa: string | null): SubmissionError[] {
  if (causa === null || causa === "") {
    return [{ field: "causa", code: "causa_required" }];
  }
  return isCausa(causa) ? [] : [{ field: "causa", code: "causa_invalid" }];
}

function startErrors(start: string | null): SubmissionError[] {
  if (start === null || start === "") {
    return [{ field: "fechaInicio", code: "start_required" }];
  }
  return isIsoDate(start)
    ? []
    : [{ field: "fechaInicio", code: "start_invalid" }];
}

function endErrors(
  start: string | null,
  end: string | null,
  today: string,
  filingWindow: boolean,
): SubmissionError[] {
  if (end === null || end === "") {
    return [{ field: "fechaFin", code: "end_required" }];
  }
  if (!isIsoDate(end)) return [{ field: "fechaFin", code: "end_invalid" }];
  if (start !== null && isIsoDate(start) && end < start) {
    return [{ field: "fechaFin", code: "end_before_start" }];
  }
  return !filingWindow || isEndWithinWindow(end, today)
    ? []
    : [{ field: "fechaFin", code: "end_too_old" }];
}

function subjectErrors(input: SubmissionInput): SubmissionError[] {
  if (input.selections.length === 0) {
    return [{ field: "subjects", code: "subjects_required" }];
  }
  return validateSubjectSelections(input.selections, input.eligibleGroups).map(
    (e) => ({ field: "subjects", code: e.code, asignaturaId: e.asignaturaId }),
  );
}

function consentErrors(
  consentVersion: SubmissionInput["consentVersion"],
): SubmissionError[] {
  if (typeof consentVersion !== "string" || consentVersion === "") {
    return [{ field: "consent", code: "consent_required" }];
  }
  return consentVersion === CONSENT_VERSION
    ? []
    : [{ field: "consent", code: "consent_outdated" }];
}

export function validateSubmission(
  input: SubmissionInput,
  today: string,
  { filingWindow = true, consent = true }: SubmissionOptions = {},
): SubmissionResult {
  const errors: SubmissionError[] = [
    ...causeErrors(input.causa),
    ...startErrors(input.fechaInicio),
    ...endErrors(input.fechaInicio, input.fechaFin, today, filingWindow),
    ...subjectErrors(input),
    ...(input.validDocumentCount > 0
      ? []
      : [{ field: "documents", code: "documents_required" } as const]),
    ...(consent ? consentErrors(input.consentVersion) : []),
  ];
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
