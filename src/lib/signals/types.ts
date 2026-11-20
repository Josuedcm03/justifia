import type { DocumentMarks } from "@/lib/document-data/types";
import type { ExtractionRowView } from "@/lib/extraction/display";
import type { Causa } from "@/lib/intake/causes";

import type { RepeatedDocumentInput } from "./repeated-document";

// Validation signals (RF-05, RN-15). Pure types and tables shared by the
// evaluators: no database, no `server-only`. A signal yields exactly one
// outcome; `not_evaluable` carries exactly one reason from a closed set, and
// `present` / `absent` carry none. Reason codes are the spec's closed set.
// RN-09 and RN-10 have a fourth outcome, `not_applicable`: the declared cause
// admits no rest period. It carries no reason and no evidence, and is never a
// reason code nor a `not_evaluable` (that one means an input is missing).
// RN-11, RN-12 and RN-13 read what the secretary registered by hand; they are
// never `not_applicable` and carry one extra reason, `not_registered`.

export const SIGNAL_CODES = [
  "rn07",
  "rn09",
  "rn10",
  "rn11",
  "rn12",
  "rn13",
  "rn14",
  "rn26",
] as const;
export type SignalCode = (typeof SIGNAL_CODES)[number];

/**
 * The reasons of the documents, in precedence order: when several explain a
 * `not_evaluable` outcome the first match wins ("Four outcomes with a closed
 * set of reasons"). `calendar_not_covering_year` is RN-07's alone, and
 * `not_registered` (a mark the secretary has not registered) belongs to RN-11,
 * RN-12 and RN-13.
 */
export const REASON_PRECEDENCE = [
  "no_period",
  "no_eligible_documents",
  "extraction_pending",
  "extraction_failed",
  "days_only",
  "field_missing",
  "no_fingerprint",
  "not_registered",
] as const;

export const NOT_EVALUABLE_REASONS = [
  ...REASON_PRECEDENCE,
  "calendar_not_covering_year",
] as const;
export type NotEvaluableReason = (typeof NOT_EVALUABLE_REASONS)[number];

/** Which reason codes each signal may carry. */
export const ALLOWED_REASONS: Record<
  SignalCode,
  readonly NotEvaluableReason[]
> = {
  rn07: ["calendar_not_covering_year"],
  rn09: [
    "no_eligible_documents",
    "extraction_pending",
    "extraction_failed",
    "days_only",
    "field_missing",
  ],
  rn10: [
    "no_eligible_documents",
    "extraction_pending",
    "extraction_failed",
    "days_only",
    "field_missing",
  ],
  rn11: ["no_eligible_documents", "not_registered"],
  rn12: ["no_eligible_documents", "not_registered"],
  rn13: ["no_eligible_documents", "not_registered"],
  rn14: [
    "no_period",
    "no_eligible_documents",
    "extraction_pending",
    "extraction_failed",
    "field_missing",
  ],
  rn26: ["no_eligible_documents", "no_fingerprint"],
};

/** The first of `reasons` in precedence order. */
export function pickReason(
  reasons: readonly NotEvaluableReason[],
): NotEvaluableReason {
  const picked = REASON_PRECEDENCE.find((reason) => reasons.includes(reason));
  if (!picked) throw new Error("A not evaluable outcome needs a reason");
  return picked;
}

/**
 * What the secretary sees next to an outcome. Dates are ISO calendar strings;
 * the issuer is the normalized form only. Never a name, a CIF or a fingerprint.
 */
export type SignalEvidence =
  | { kind: "timing"; presented: string; deadline: string }
  | {
      kind: "incoherent";
      documents: { documentId: number; issueDate: string; restTo: string }[];
    }
  | {
      kind: "uncovered";
      absenceFrom: string;
      absenceTo: string;
      /** The dated rest periods merged by calendar day. */
      covered: { from: string; to: string }[];
    }
  | { kind: "recurrence"; issuer: string; count: number; threshold: number }
  /**
   * RN-26: the numbers of the earlier requests INSIDE the caller's scope. A
   * match outside it adds nothing here, not even a count (RNF-01).
   */
  | { kind: "repeated"; references: number[] }
  /**
   * RN-11, RN-12 and RN-13: the ids of the documents that raise the signal, none
   * when it is absent. Never a name, an issuer, a date, a type code or a mark.
   */
  | { kind: "documents"; documentIds: number[] };

/** RN-09 / RN-10 only: typed so no other signal can be marked not applicable. */
export type NotApplicableResult = {
  signal: "rn09" | "rn10";
  outcome: "not_applicable";
};

/** The three signals of the marks, which are never `not_applicable`. */
export type MarkSignalCode = "rn11" | "rn12" | "rn13";

/** The only two reasons these signals can carry (MD-16). */
export type MarkNotEvaluableReason = Extract<
  NotEvaluableReason,
  "no_eligible_documents" | "not_registered"
>;

/** Document ids only: the ones that raise the signal, none when absent. */
export type MarkEvidence = Extract<SignalEvidence, { kind: "documents" }>;

/** RN-11, RN-12 and RN-13: typed so none of them can be marked not applicable. */
export type MarkSignalResult =
  | {
      signal: MarkSignalCode;
      outcome: "present" | "absent";
      evidence: MarkEvidence;
    }
  | {
      signal: MarkSignalCode;
      outcome: "not_evaluable";
      reason: MarkNotEvaluableReason;
    };

export type SignalResult =
  | {
      signal: SignalCode;
      outcome: "present" | "absent";
      evidence: SignalEvidence;
    }
  | {
      signal: SignalCode;
      outcome: "not_evaluable";
      reason: NotEvaluableReason;
    }
  | MarkSignalResult
  | NotApplicableResult;

export const VERDICTS = [
  "review_carefully",
  "no_alerts",
  "inconclusive",
] as const;
export type Verdict = (typeof VERDICTS)[number];

export type NotEvaluableEntry = {
  signal: SignalCode;
  reason: NotEvaluableReason;
};

/** What the evaluation returns: verdict, one result per signal, what was not checked. */
export type SignalReport = {
  verdict: Verdict;
  results: readonly SignalResult[];
  notEvaluable: readonly NotEvaluableEntry[];
};

/**
 * What a screen renders. Evidence is optional so a stripped projection (the
 * coordination view) is the same shape; a report is assignable to it.
 */
export type SignalViewResult =
  | {
      signal: SignalCode;
      outcome: "present" | "absent";
      evidence?: SignalEvidence;
    }
  | Extract<SignalResult, { outcome: "not_evaluable" }>
  | NotApplicableResult;

export type SignalView = {
  verdict: Verdict;
  results: readonly SignalViewResult[];
  notEvaluable: readonly NotEvaluableEntry[];
};

/** One current document of the request and what was read from it. */
export type SignalDocument = {
  documentId: number;
  /** Null when the document has no extraction row yet. */
  extraction: ExtractionRowView | null;
  /** What the secretary registered: type, firma and sello (null: not yet). */
  marks: DocumentMarks;
};

/** An earlier presented request of the same student and period, one issuer. */
export type IssuerHistoryRow = { solicitudId: number; issuer: string };

/** Everything the eight signals read. Plain data, no connection. */
export type SignalInput = {
  solicitudId: number;
  /** First presentation (`PresentadaEn`), never the resubmission time. */
  presentedAt: Date;
  absenceFrom: string;
  absenceTo: string;
  /** Declared cause (RN-01): decides whether RN-09 and RN-10 apply. */
  causa: Causa;
  /** Current documents only: not retired, student-uploaded, not special format. */
  documents: readonly SignalDocument[];
  /** Distinct `Grupo.periodo` of the request's subjects. */
  periods: readonly string[];
  /** Raw issuers of the earlier requests; normalized by the evaluator. */
  issuerHistory: readonly IssuerHistoryRow[];
  /** RN-26: fingerprint presence of the current documents and earlier matches. */
  repeated: RepeatedDocumentInput;
};
