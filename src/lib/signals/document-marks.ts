import type { DocumentMarks, TipoDocumento } from "@/lib/document-data/types";
import type { Causa } from "@/lib/intake/causes";

// RN-11 (firma ausente), RN-12 (sello ausente) and RN-13 (formato no
// corresponde a la causa): the three signals that read what the secretary
// registered by hand, never what the extraction found (manual-document-data,
// MD-12 to MD-16). Pure and unwired: the input is the current documents only
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
// The result types are local for now: SIGNAL_CODES and the closed reason set of
// `types.ts` still hold the five signals until the wiring change folds these
// in. They are shaped to fold in unchanged.

/** One current document: its id and its three marks. */
export type MarkedDocument = { documentId: number; marks: DocumentMarks };

/** The map of RN-13: the causes each document type corresponds to (MD-15). */
export type DocumentTypeCauses = Readonly<
  Record<TipoDocumento, readonly Causa[]>
>;

export type MarkSignalCode = "rn11" | "rn12" | "rn13";

/** The only two reasons these signals can carry (MD-16). */
export type MarkNotEvaluableReason = "no_eligible_documents" | "not_registered";

/** Document ids only: the ones that raise the signal, none when absent. */
export type MarkEvidence = { kind: "documents"; documentIds: number[] };

/** Never `not_applicable`: it is not a member of this type (MD-12 to MD-14). */
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
