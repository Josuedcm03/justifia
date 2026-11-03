import { describe, expect, it } from "vitest";

import type { ExtractionRowView } from "@/lib/extraction/display";

import { evaluateRecurrence, normalizeIssuer } from "./issuer";
import { DEFAULT_SIGNAL_PARAMS } from "./params";
import type { IssuerHistoryRow, SignalDocument } from "./types";

// validation-signals: "Recurrence, RN-14".

describe("normalizeIssuer", () => {
  it("equates accents, case, punctuation and whitespace", () => {
    expect(normalizeIssuer("Clínica  Santa Fe")).toBe(
      normalizeIssuer("CLINICA SANTA FE."),
    );
    expect(normalizeIssuer("  Clínica\tSanta\nFe ")).toBe("clinica santa fe");
  });

  it("keeps a legal suffix as a difference (known heuristic limit)", () => {
    expect(normalizeIssuer("Clinica Santa Fe S.A.")).not.toBe(
      normalizeIssuer("Clínica  Santa Fe"),
    );
  });

  it("removes punctuation instead of splitting on it", () => {
    expect(normalizeIssuer("Hosp. Vivian-Pellas, S.A.")).toBe(
      "hosp vivianpellas sa",
    );
  });

  it("decomposes accents and the tilde", () => {
    expect(normalizeIssuer("Peña Ñandú Sánchez")).toBe("pena nandu sanchez");
  });

  it("returns an empty string for text with no letters or digits", () => {
    expect(normalizeIssuer(" ... ")).toBe("");
  });
});

function row(issuer: string | null, state = "completada"): ExtractionRowView {
  return {
    state: state as ExtractionRowView["state"],
    studentName: null,
    issuer,
    issueDate: "2026-10-02",
    restFrom: "2026-10-05",
    restTo: "2026-10-07",
    restDays: 3,
  };
}

function docs(...issuers: (string | null)[]): SignalDocument[] {
  return issuers.map((issuer, i) => ({
    documentId: i + 1,
    extraction: row(issuer),
  }));
}

const history = (...entries: [number, string][]): IssuerHistoryRow[] =>
  entries.map(([solicitudId, issuer]) => ({ solicitudId, issuer }));

const PERIOD = ["2026-S2"];

function evaluate(
  overrides: Partial<Parameters<typeof evaluateRecurrence>[0]> = {},
  threshold = DEFAULT_SIGNAL_PARAMS.issuerRecurrenceThreshold,
) {
  return evaluateRecurrence(
    {
      solicitudId: 40,
      documents: docs("Clinica Central"),
      periods: PERIOD,
      history: [],
      ...overrides,
    },
    { issuerRecurrenceThreshold: threshold },
  );
}

describe("evaluateRecurrence Nth request", () => {
  it.each([
    ["1st", [], "absent", 1],
    ["2nd", [[10, "Clinica Central"]], "absent", 2],
    [
      "3rd",
      [
        [10, "Clinica Central"],
        [20, "Clinica Central"],
      ],
      "present",
      3,
    ],
    [
      "4th",
      [
        [10, "Clinica Central"],
        [20, "Clinica Central"],
        [30, "Clinica Central"],
      ],
      "present",
      4,
    ],
  ] as const)("the %s request is %s", (_n, rows, outcome, count) => {
    const result = evaluate({
      history: history(...(rows as unknown as [number, string][])),
    });

    expect(result.signal).toBe("rn14");
    expect(result.outcome).toBe(outcome);
    expect(result).toMatchObject({
      evidence: {
        kind: "recurrence",
        issuer: "clinica central",
        count,
        threshold: 3,
      },
    });
  });

  it("does not change an earlier request when a later one exists", () => {
    // The 2nd request reads only what is earlier: one row, whatever follows.
    const second = evaluate({
      solicitudId: 20,
      history: history([10, "Clinica Central"]),
    });

    expect(second.outcome).toBe("absent");
  });

  it("matches issuers across accents, case and punctuation", () => {
    const result = evaluate({
      history: history([10, "CLÍNICA CENTRAL."], [20, " clinica   central "]),
    });

    expect(result.outcome).toBe("present");
  });

  it("does not count another issuer", () => {
    const result = evaluate({
      history: history([10, "Clinica Norte"], [20, "Clinica Sur"]),
    });

    expect(result).toMatchObject({ outcome: "absent", evidence: { count: 1 } });
  });
});

describe("evaluateRecurrence one request counts once", () => {
  it("adds 1 for a request with two documents of the same issuer", () => {
    const result = evaluate({
      documents: docs("Clinica Central", "CLINICA CENTRAL"),
    });

    expect(result).toMatchObject({ evidence: { count: 1 } });
  });

  it("adds 1 for an earlier request that appears in two rows", () => {
    const result = evaluate({
      history: history([10, "Clinica Central"], [10, "Clínica Central"]),
    });

    expect(result).toMatchObject({ evidence: { count: 2 } });
  });

  it("ignores a history row of the request itself", () => {
    const result = evaluate({ history: history([40, "Clinica Central"]) });

    expect(result).toMatchObject({ evidence: { count: 1 } });
  });

  it("reports the issuer with the highest count", () => {
    const result = evaluate({
      documents: docs("Clinica Norte", "Clinica Sur"),
      history: history([10, "Clinica Sur"], [20, "Clinica Sur"]),
    });

    expect(result).toMatchObject({
      outcome: "present",
      evidence: { issuer: "clinica sur", count: 3 },
    });
  });
});

describe("evaluateRecurrence threshold is a parameter", () => {
  it("is absent with 3 and present with 2 on the 2nd request", () => {
    const rows = history([10, "Clinica Central"]);

    expect(evaluate({ history: rows }, 3).outcome).toBe("absent");
    expect(evaluate({ history: rows }, 2).outcome).toBe("present");
  });
});

describe("evaluateRecurrence missing inputs", () => {
  const reasonOf = (overrides: Parameters<typeof evaluate>[0]) => {
    const result = evaluate(overrides);
    return result.outcome === "not_evaluable" ? result.reason : result.outcome;
  };

  it.each([
    ["two periods", ["2026-S1", "2026-S2"]],
    ["no period", []],
  ])("%s gives no_period", (_label, periods) => {
    expect(reasonOf({ periods })).toBe("no_period");
  });

  it("puts no_period before every other reason", () => {
    expect(reasonOf({ periods: [], documents: [] })).toBe("no_period");
  });

  it("is not evaluable without a current document", () => {
    expect(reasonOf({ documents: [] })).toBe("no_eligible_documents");
  });

  it.each([
    ["pending", "pendiente"],
    ["processing", "procesando"],
  ])("a %s document gives extraction_pending", (_label, state) => {
    expect(
      reasonOf({
        documents: [{ documentId: 1, extraction: row(null, state) }],
      }),
    ).toBe("extraction_pending");
  });

  it("a missing row gives extraction_pending", () => {
    expect(reasonOf({ documents: [{ documentId: 1, extraction: null }] })).toBe(
      "extraction_pending",
    );
  });

  it("every document failed gives extraction_failed", () => {
    expect(
      reasonOf({
        documents: [{ documentId: 1, extraction: row(null, "fallida") }],
      }),
    ).toBe("extraction_failed");
  });

  it("completed documents without an issuer give field_missing", () => {
    expect(reasonOf({ documents: docs(null, "  ... ") })).toBe("field_missing");
  });

  it("evaluates with the documents that have an issuer when others are pending", () => {
    const result = evaluate({
      documents: [
        { documentId: 1, extraction: row("Clinica Central") },
        { documentId: 2, extraction: row(null, "pendiente") },
      ],
    });

    expect(result.outcome).toBe("absent");
  });
});
