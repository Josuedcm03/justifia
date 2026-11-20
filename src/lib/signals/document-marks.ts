import type { DocumentMarks, TipoDocumento } from "@/lib/document-data/types";
import type { Causa } from "@/lib/intake/causes";

import type { MarkSignalCode, MarkSignalResult } from "./types";

// RN-11 (firma ausente), RN-12 (sello ausente) and RN-13 (formato no
// corresponde a la causa): the three signals that read what the secretary
// registered by hand, never what the extraction found (manual-document-data,
// MD-12 to MD-16). Pure: the input is the current documents only
// (not retired, student-uploaded, not special format), as ids and marks, so
// nothing here filters them and nothing can leak a name, an issuer, a date or a
// fingerprint.
//
// The aggregation is STRICT (D1; thesis 4.6, line 33): present if any document
// is present; absent only when EVERY document has the datum registered and none
// is present; otherwise not evaluable. It is deliberately stricter than RN-09,
// where one evaluable document is enough: an unregistered document is the very
// one these signals exist to catch, so it keeps the signal open.
//
// The result types live in `types.ts` with the rest of the signal model.

/**
 * One current document: its id and its three marks. A `SignalDocument` is
 * assignable to it, so the evaluators receive the documents of the input as they
 * are and cannot see the extraction row.
 */
export type MarkedDocument = { documentId: number; marks: DocumentMarks };

/** The map of RN-13: the causes each document type corresponds to (MD-15). */
export type DocumentTypeCauses = Readonly<
  Record<TipoDocumento, readonly Causa[]>
>;

/** What one document says about one signal. */
type DocumentCheck = "present" | "absent" | "not_registered";

function aggregate(
  signal: MarkSignalCode,
  documents: readonly MarkedDocument[],
  check: (marks: DocumentMarks) => DocumentCheck,
): MarkSignalResult {
  if (documents.length === 0) {
    return {
      signal,
      outcome: "not_evaluable",
      reason: "no_eligible_documents",
    };
  }

  const checks = documents.map(({ documentId, marks }) => ({
    documentId,
    check: check(marks),
  }));
  const raising = checks
    .filter(({ check }) => check === "present")
    .map(({ documentId }) => documentId);

  if (raising.length > 0) {
    return {
      signal,
      outcome: "present",
      evidence: { kind: "documents", documentIds: raising },
    };
  }
  if (checks.every(({ check }) => check === "absent")) {
    return {
      signal,
      outcome: "absent",
      evidence: { kind: "documents", documentIds: [] },
    };
  }
  return { signal, outcome: "not_evaluable", reason: "not_registered" };
}

/** A mark of `No` raises the signal, `Sí` clears it, null is not registered. */
function checkMark(mark: boolean | null): DocumentCheck {
  if (mark === null) return "not_registered";
  return mark ? "absent" : "present";
}

/** RN-11: the document was registered without the firma of the issuer. */
export function evaluateMissingSignature(
  documents: readonly MarkedDocument[],
): MarkSignalResult {
  return aggregate("rn11", documents, (marks) => checkMark(marks.hasSignature));
}

/** RN-12: the document was registered without the sello of the issuer. */
export function evaluateMissingSeal(
  documents: readonly MarkedDocument[],
): MarkSignalResult {
  return aggregate("rn12", documents, (marks) => checkMark(marks.hasSeal));
}

/**
 * RN-13: the registered type does not correspond to the declared cause. The
 * correspondence is the injected map, not a table read here, so replacing it
 * (RNF-14, roadmap row 8) changes no evaluator. `otro` is in no list of the
 * default map, so it is present for every cause.
 */
export function evaluateTypeMismatch(
  documents: readonly MarkedDocument[],
  causa: Causa,
  documentTypeCauses: DocumentTypeCauses,
): MarkSignalResult {
  return aggregate("rn13", documents, ({ type }) => {
    if (type === null) return "not_registered";
    return documentTypeCauses[type].includes(causa) ? "absent" : "present";
  });
}
