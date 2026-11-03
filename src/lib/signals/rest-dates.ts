import type { ExtractionRowView } from "@/lib/extraction/display";
import { addDays } from "@/lib/intake/dates";

import {
  pickReason,
  type NotEvaluableReason,
  type SignalDocument,
  type SignalEvidence,
  type SignalResult,
} from "./types";

// RN-09 and RN-10 read the dates the extraction took from the documents. Pure:
// the input holds the current documents only (not retired, student-uploaded,
// not `no_aplica`), so nothing here filters them.

type Completed = ExtractionRowView & { state: "completada" };

/** The reason an extraction row cannot give data yet, or null when it can. */
function extractionReason(
  row: ExtractionRowView | null,
): NotEvaluableReason | null {
  if (row === null || row.state === "pendiente" || row.state === "procesando") {
    return "extraction_pending";
  }
  return row.state === "fallida" ? "extraction_failed" : null;
}

/** A rest period of days with no dates cannot be placed on the calendar. */
function isDaysOnly(row: Completed): boolean {
  return row.restFrom === null && row.restTo === null && row.restDays !== null;
}

/** `days_only` outranks `field_missing`, as the closed set's precedence says. */
function missingReason(row: Completed): NotEvaluableReason {
  return isDaysOnly(row) ? "days_only" : "field_missing";
}

function requestReason(
  reasons: readonly NotEvaluableReason[],
  signal: "rn09" | "rn10",
): SignalResult {
  return {
    signal,
    outcome: "not_evaluable",
    reason: pickReason(reasons),
  };
}

type IncoherenceCheck =
  | { kind: "present" | "absent"; issueDate: string; restTo: string }
  | { kind: "unknown"; reason: NotEvaluableReason };

function checkIncoherence(row: ExtractionRowView | null): IncoherenceCheck {
  const reason = extractionReason(row);
  if (reason !== null) return { kind: "unknown", reason };

  const done = row as Completed;
  if (done.issueDate === null || done.restTo === null) {
    return { kind: "unknown", reason: missingReason(done) };
  }
  return {
    kind: done.restTo < done.issueDate ? "present" : "absent",
    issueDate: done.issueDate,
    restTo: done.restTo,
  };
}

/**
 * RN-09: the rest ends before the document's issue date. Per document, then
 * the request: present if any document is, absent if at least one is evaluable
 * and none is present, otherwise not evaluable by the reason precedence.
 */
export function evaluateIncoherentDates(
  documents: readonly SignalDocument[],
): SignalResult {
  if (documents.length === 0) {
    return requestReason(["no_eligible_documents"], "rn09");
  }

  const checks = documents.map((d) => ({
    documentId: d.documentId,
    check: checkIncoherence(d.extraction),
  }));
  const incoherent = checks.flatMap(({ documentId, check }) =>
    check.kind === "present"
      ? [{ documentId, issueDate: check.issueDate, restTo: check.restTo }]
      : [],
  );
  const evidence = (list: typeof incoherent): SignalEvidence => ({
    kind: "incoherent",
    documents: list,
  });

  if (incoherent.length > 0) {
    return {
      signal: "rn09",
      outcome: "present",
      evidence: evidence(incoherent),
    };
  }
  if (checks.some(({ check }) => check.kind === "absent")) {
    return { signal: "rn09", outcome: "absent", evidence: evidence([]) };
  }
  return requestReason(
    checks.flatMap(({ check }) =>
      check.kind === "unknown" ? [check.reason] : [],
    ),
    "rn09",
  );
}

type DatedPeriod = { from: string; to: string };

type PeriodCheck =
  | { kind: "dated"; period: DatedPeriod }
  | { kind: "unknown"; reason: NotEvaluableReason };

function checkPeriod(row: ExtractionRowView | null): PeriodCheck {
  const reason = extractionReason(row);
  if (reason !== null) return { kind: "unknown", reason };

  const done = row as Completed;
  if (done.restFrom === null || done.restTo === null) {
    return { kind: "unknown", reason: missingReason(done) };
  }
  return { kind: "dated", period: { from: done.restFrom, to: done.restTo } };
}

/**
 * The union at calendar-day granularity: a period that starts the day after
 * the previous one ends merges with it; a one-day gap does not.
 */
function mergePeriods(periods: readonly DatedPeriod[]): DatedPeriod[] {
  const merged: DatedPeriod[] = [];
  for (const period of [...periods].sort((a, b) =>
    a.from.localeCompare(b.from),
  )) {
    const last = merged.at(-1);
    if (last && period.from <= addDays(last.to, 1)) {
      if (period.to > last.to) last.to = period.to;
    } else {
      merged.push({ ...period });
    }
  }
  return merged;
}

/**
 * RN-10: the dated rest periods must cover the whole absence range. Covered is
 * absent whatever else shows. Uncovered is present only when every current
 * document gave a dated period; with any document that did not (days only,
 * missing, pending, failed) it is not evaluable, never present.
 */
export function evaluateUncoveredDates(
  documents: readonly SignalDocument[],
  absence: { from: string; to: string },
): SignalResult {
  if (documents.length === 0) {
    return requestReason(["no_eligible_documents"], "rn10");
  }

  const checks = documents.map((d) => checkPeriod(d.extraction));
  const covered = mergePeriods(
    checks.flatMap((check) => (check.kind === "dated" ? [check.period] : [])),
  );
  const evidence: SignalEvidence = {
    kind: "uncovered",
    absenceFrom: absence.from,
    absenceTo: absence.to,
    covered,
  };

  if (covered.some((p) => p.from <= absence.from && p.to >= absence.to)) {
    return { signal: "rn10", outcome: "absent", evidence };
  }
  const unknown = checks.flatMap((check) =>
    check.kind === "unknown" ? [check.reason] : [],
  );
  if (unknown.length > 0) return requestReason(unknown, "rn10");
  return { signal: "rn10", outcome: "present", evidence };
}
