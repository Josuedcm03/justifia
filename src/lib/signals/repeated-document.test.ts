import { describe, expect, it } from "vitest";

import {
  evaluateRepeatedDocument,
  type RepeatedDocumentInput,
} from "./repeated-document";

// validation-signals: "Repeated document, RN-26" and "RN-26 reference is
// confined to the caller's scope". The evaluator sees only whether each
// current document has a fingerprint and the earlier requests that share one;
// the fingerprint itself never reaches it.

const doc = (documentId: number, fingerprinted: boolean) => ({
  documentId,
  fingerprinted,
});

function evaluate(input: Partial<RepeatedDocumentInput>) {
  return evaluateRepeatedDocument({ documents: [], matches: [], ...input });
}

describe("NULL fingerprints (Documents from before the change)", () => {
  it.each([
    [
      "all NULL",
      [doc(1, false), doc(2, false)],
      [],
      { outcome: "not_evaluable", reason: "no_fingerprint" },
    ],
    [
      "one NULL plus a fingerprint that matches nothing",
      [doc(1, false), doc(2, true)],
      [],
      { outcome: "absent" },
    ],
    [
      "one NULL plus a fingerprint that matches an earlier request",
      [doc(1, false), doc(2, true)],
      [{ solicitudId: 41 }],
      { outcome: "present" },
    ],
    [
      "no current student document",
      [],
      [],
      { outcome: "not_evaluable", reason: "no_eligible_documents" },
    ],
  ] as const)("%s", (_name, documents, matches, expected) => {
    expect(evaluate({ documents, matches })).toMatchObject({
      signal: "rn26",
      ...expected,
    });
  });

  it("never matches a NULL fingerprint: all NULL stays not evaluable whatever the matches", () => {
    expect(
      evaluate({ documents: [doc(1, false)], matches: [{ solicitudId: 41 }] }),
    ).toEqual({
      signal: "rn26",
      outcome: "not_evaluable",
      reason: "no_fingerprint",
    });
  });

  it("gives no reason to present or absent", () => {
    const present = evaluate({
      documents: [doc(1, true)],
      matches: [{ solicitudId: 41 }],
    });
    const absent = evaluate({ documents: [doc(1, true)] });

    expect("reason" in present).toBe(false);
    expect("reason" in absent).toBe(false);
  });
});

describe("references are confined to the scope (Cross-scope match without reference)", () => {
  const documents = [doc(1, true)];

  it("references the in-scope earlier request", () => {
    expect(evaluate({ documents, matches: [{ solicitudId: 41 }] })).toEqual({
      signal: "rn26",
      outcome: "present",
      evidence: { kind: "repeated", references: [41] },
    });
  });

  it("is present with no reference when the only match is out of scope", () => {
    expect(evaluate({ documents, matches: [{ solicitudId: null }] })).toEqual({
      signal: "rn26",
      outcome: "present",
      evidence: { kind: "repeated", references: [] },
    });
  });

  it("references 41 only when 41 is in scope and 55 is not, with no count of the rest", () => {
    const result = evaluate({
      documents,
      matches: [{ solicitudId: 41 }, { solicitudId: null }],
    });

    expect(result).toEqual({
      signal: "rn26",
      outcome: "present",
      evidence: { kind: "repeated", references: [41] },
    });
    expect(JSON.stringify(result)).not.toContain("55");
  });

  it("lists each in-scope request once, in ascending order", () => {
    const result = evaluate({
      documents,
      matches: [
        { solicitudId: 55 },
        { solicitudId: 41 },
        { solicitudId: 55 },
        { solicitudId: null },
      ],
    });

    expect(result).toMatchObject({
      evidence: { references: [41, 55] },
    });
  });
});

describe("the outcome carries no personal data (Reference carries no personal data)", () => {
  it("serializes to the request numbers and nothing that names a person or a document", () => {
    const result = evaluate({
      documents: [doc(7, true), doc(8, true)],
      matches: [{ solicitudId: 41 }],
    });
    const keys: string[] = [];
    JSON.parse(JSON.stringify(result), function (key, value) {
      keys.push(key);
      return value;
    });

    expect(keys.filter((k) => k !== "").sort()).toEqual(
      ["signal", "outcome", "evidence", "kind", "references", "0"].sort(),
    );
    expect(
      keys.filter((k) =>
        /name|nombre|cif|correo|mail|hash|huella|fingerprint|document/i.test(k),
      ),
    ).toEqual([]);
  });
});
