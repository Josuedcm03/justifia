import type { SignalResult } from "./types";

/**
 * What RN-26 reads. The fingerprint itself never gets here: the loader only
 * says whether each current document has one, and which earlier requests hold
 * a document with the same one.
 */
export type RepeatedDocumentInput = {
  /** Current student documents of the request (not retired, not special format). */
  documents: readonly { documentId: number; fingerprinted: boolean }[];
  /**
   * Earlier presented requests sharing a fingerprint, one entry per request.
   * `solicitudId` is null when that request is outside the caller's scope: the
   * database nulls it, so the number never reaches this code.
   */
  matches: readonly { solicitudId: number | null }[];
};

/**
 * RN-26: a current document has the same fingerprint as a document of ANOTHER
 * request that comes earlier in the order of presentation. A document without
 * a fingerprint never matches; when none has one the signal cannot be checked.
 * Present carries only the in-scope request numbers (RNF-01): no count of the
 * rest, no name, no document, and nothing that says whose request it is.
 */
export function evaluateRepeatedDocument(
  input: RepeatedDocumentInput,
): SignalResult {
  if (input.documents.length === 0) {
    return {
      signal: "rn26",
      outcome: "not_evaluable",
      reason: "no_eligible_documents",
    };
  }
  if (!input.documents.some((document) => document.fingerprinted)) {
    return {
      signal: "rn26",
      outcome: "not_evaluable",
      reason: "no_fingerprint",
    };
  }
  if (input.matches.length === 0) {
    return {
      signal: "rn26",
      outcome: "absent",
      evidence: { kind: "repeated", references: [] },
    };
  }

  const references = [
    ...new Set(
      input.matches.flatMap((match) =>
        match.solicitudId === null ? [] : [match.solicitudId],
      ),
    ),
  ].sort((a, b) => a - b);
  return {
    signal: "rn26",
    outcome: "present",
    evidence: { kind: "repeated", references },
  };
}
