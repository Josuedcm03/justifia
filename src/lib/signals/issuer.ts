import type { ExtractionRowView } from "@/lib/extraction/display";

import type { SignalParams } from "./params";
import {
  pickReason,
  type IssuerHistoryRow,
  type NotEvaluableReason,
  type SignalDocument,
  type SignalResult,
} from "./types";

/**
 * RN-14 issuer comparison key: Unicode decomposition with the diacritics
 * removed, lower case, punctuation removed, whitespace collapsed and trimmed.
 * "Clinica  Santa Fe" equals "CLINICA SANTA FE." and differs from "... S.A."
 * (a known heuristic limit). Done in TypeScript: `unaccent` is not available.
 */
export function normalizeIssuer(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\p{P}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * RN-14 comparison key: the normalized issuer with every run of one repeated
 * letter collapsed to a single letter. Real photos showed the extraction model
 * doubling a letter at random ("ODONTOLOÓGICA"), which split one clinic into
 * several issuers. Digits are kept as they are ("Clinica 11" is not
 * "Clinica 1"). Two issuers that differ only by a doubled letter ("Correa",
 * "Corea") compare equal (known heuristic limit). The evidence still shows the
 * normalized issuer, not this key.
 */
export function issuerKey(raw: string): string {
  return normalizeIssuer(raw).replace(/(\p{L})\1+/gu, "$1");
}

/** The normalized issuer of a completed row, or null when there is none. */
function issuerOf(row: ExtractionRowView | null): string | null {
  if (row?.state !== "completada" || row.issuer === null) return null;
  return normalizeIssuer(row.issuer) || null;
}

/** Why no issuer could be read, when no current document gave one. */
function missingIssuerReason(
  documents: readonly SignalDocument[],
): NotEvaluableReason {
  return pickReason(
    documents.map(({ extraction }) => {
      if (extraction?.state === "completada") return "field_missing";
      return extraction?.state === "fallida"
        ? "extraction_failed"
        : "extraction_pending";
    }),
  );
}

type RecurrenceInput = {
  solicitudId: number;
  documents: readonly SignalDocument[];
  periods: readonly string[];
  /** Earlier presented requests of the same student and period, raw issuers. */
  history: readonly IssuerHistoryRow[];
};

function notEvaluable(reason: NotEvaluableReason): SignalResult {
  return { signal: "rn14", outcome: "not_evaluable", reason };
}

/**
 * RN-14: for each normalized issuer of the request, the number of distinct
 * presented requests of the same student and period, up to and including this
 * one, that carry it. Present when any count reaches the threshold, which is an
 * input. The history holds earlier requests only (the loader filters by the
 * order of presentation), so a later request never changes an earlier result;
 * a request counts once however many of its documents share the issuer.
 */
export function evaluateRecurrence(
  input: RecurrenceInput,
  params: SignalParams,
): SignalResult {
  if (input.periods.length !== 1) return notEvaluable("no_period");
  if (input.documents.length === 0) {
    return notEvaluable("no_eligible_documents");
  }

  const current = new Set(
    input.documents.flatMap(({ extraction }) => issuerOf(extraction) ?? []),
  );
  if (current.size === 0) {
    return notEvaluable(missingIssuerReason(input.documents));
  }

  // Keyed by `issuerKey`; the first current issuer with a key is what is shown.
  const byKey = new Map<string, { issuer: string; requests: Set<number> }>();
  for (const issuer of current) {
    const key = issuerKey(issuer);
    if (!byKey.has(key)) {
      byKey.set(key, { issuer, requests: new Set([input.solicitudId]) });
    }
  }
  for (const { solicitudId, issuer } of input.history) {
    byKey.get(issuerKey(issuer))?.requests.add(solicitudId);
  }

  let top = { issuer: "", count: 0 };
  for (const { issuer, requests } of byKey.values()) {
    if (requests.size > top.count) top = { issuer, count: requests.size };
  }
  const threshold = params.issuerRecurrenceThreshold;
  return {
    signal: "rn14",
    outcome: top.count >= threshold ? "present" : "absent",
    evidence: { kind: "recurrence", ...top, threshold },
  };
}
