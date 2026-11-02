import type { ExtractionRowView } from "@/lib/extraction/display";

// Validation signals (RF-05, RN-15). Pure types and tables shared by the
// evaluators: no database, no `server-only`. A signal yields exactly one
// outcome; `not_evaluable` carries exactly one reason from a closed set, and
// `present` / `absent` carry none. Reason codes are the spec's set (S1 half):
// `no_fingerprint` arrives with RN-26.

export const SIGNAL_CODES = ["rn07", "rn09", "rn10", "rn14"] as const;
export type SignalCode = (typeof SIGNAL_CODES)[number];

/**
 * The reasons of the documents, in precedence order: when several explain a
 * `not_evaluable` outcome the first match wins ("Three outcomes with a closed
 * set of reasons"). `calendar_not_covering_year` is RN-07's alone.
 */
export const REASON_PRECEDENCE = [
  "no_period",
  "no_eligible_documents",
  "extraction_pending",
  "extraction_failed",
  "days_only",
  "field_missing",
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
  rn14: [
    "no_period",
    "no_eligible_documents",
    "extraction_pending",
    "extraction_failed",
    "field_missing",
  ],
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
  | { kind: "recurrence"; issuer: string; count: number; threshold: number };

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
    };

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
  | Extract<SignalResult, { outcome: "not_evaluable" }>;

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
};

/** An earlier presented request of the same student and period, one issuer. */
export type IssuerHistoryRow = { solicitudId: number; issuer: string };

/** Everything the four S1 signals read. Plain data, no connection. */
export type SignalInput = {
  solicitudId: number;
  /** First presentation (`PresentadaEn`), never the resubmission time. */
  presentedAt: Date;
  absenceFrom: string;
  absenceTo: string;
  /** Current documents only: not retired, student-uploaded, not special format. */
  documents: readonly SignalDocument[];
  /** Distinct `Grupo.periodo` of the request's subjects. */
  periods: readonly string[];
  /** Raw issuers of the earlier requests; normalized by the evaluator. */
  issuerHistory: readonly IssuerHistoryRow[];
};
