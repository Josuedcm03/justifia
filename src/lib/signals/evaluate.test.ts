import { describe, expect, it } from "vitest";

import { constantCalendar } from "@/lib/intake/adapters/constant-calendar";
import type { ExtractionRowView } from "@/lib/extraction/display";

import { evaluateSignals } from "./evaluate";
import { DEFAULT_SIGNAL_PARAMS } from "./params";
import type { RepeatedDocumentInput } from "./repeated-document";
import {
  ALLOWED_REASONS,
  NOT_EVALUABLE_REASONS,
  REASON_PRECEDENCE,
  SIGNAL_CODES,
  pickReason,
  type SignalDocument,
  type SignalInput,
} from "./types";

const calendar = constantCalendar({
  2026: ["2026-12-26"],
  2027: ["2027-12-25"],
});

const COMPLETE: ExtractionRowView = {
  state: "completada",
  studentName: "Ana Lopez",
  issuer: "Clinica Central",
  issueDate: "2026-10-02",
  restFrom: "2026-10-05",
  restTo: "2026-10-09",
  restDays: 5,
};

function input(overrides: Partial<SignalInput> = {}): SignalInput {
  return {
    solicitudId: 40,
    presentedAt: new Date("2026-10-13T15:00:00Z"),
    absenceFrom: "2026-10-05",
    absenceTo: "2026-10-09",
    documents: [{ documentId: 1, extraction: COMPLETE }],
    periods: ["2026-S2"],
    issuerHistory: [],
    repeated: {
      documents: [{ documentId: 1, fingerprinted: true }],
      matches: [],
    },
    ...overrides,
  };
}

const evaluate = (value: SignalInput, threshold?: number) =>
  evaluateSignals(
    value,
    threshold === undefined
      ? DEFAULT_SIGNAL_PARAMS
      : { issuerRecurrenceThreshold: threshold },
    calendar,
  );

describe("evaluateSignals", () => {
  it("returns the five results in order, with the verdict", () => {
    const report = evaluate(input());

    expect(report.results.map((r) => r.signal)).toEqual(SIGNAL_CODES);
    expect(SIGNAL_CODES).toEqual(["rn07", "rn09", "rn10", "rn14", "rn26"]);
    expect(report.results.map((r) => r.outcome)).toEqual([
      "absent",
      "absent",
      "absent",
      "absent",
      "absent",
    ]);
    expect(report.verdict).toBe("no_alerts");
    expect(report.notEvaluable).toEqual([]);
  });

  it("suggests reviewing carefully on a late presentation and lists what it could not check", () => {
    const report = evaluate(
      input({
        presentedAt: new Date("2026-10-14T15:00:00Z"),
        documents: [{ documentId: 1, extraction: null }],
      }),
    );

    expect(report.verdict).toBe("review_carefully");
    expect(report.results[0].outcome).toBe("present");
    expect(report.notEvaluable).toEqual([
      { signal: "rn09", reason: "extraction_pending" },
      { signal: "rn10", reason: "extraction_pending" },
      { signal: "rn14", reason: "extraction_pending" },
    ]);
  });

  it("evaluates RN-26 from the fingerprint input and suggests reviewing carefully", () => {
    const report = evaluate(
      input({
        repeated: {
          documents: [{ documentId: 1, fingerprinted: true }],
          matches: [{ solicitudId: 41 }],
        },
      }),
    );

    expect(report.results[4]).toEqual({
      signal: "rn26",
      outcome: "present",
      evidence: { kind: "repeated", references: [41] },
    });
    expect(report.verdict).toBe("review_carefully");
  });

  it("lists RN-26 as not evaluable, and never suggests no alerts, for documents from before the change", () => {
    const report = evaluate(
      input({
        repeated: {
          documents: [{ documentId: 1, fingerprinted: false }],
          matches: [],
        },
      }),
    );

    expect(report.results[4]).toMatchObject({
      outcome: "not_evaluable",
      reason: "no_fingerprint",
    });
    expect(report.verdict).toBe("inconclusive");
    expect(report.notEvaluable).toEqual([
      { signal: "rn26", reason: "no_fingerprint" },
    ]);
  });

  it("passes the threshold through to RN-14", () => {
    const rows = {
      issuerHistory: [{ solicitudId: 10, issuer: "Clinica Central" }],
    };

    expect(evaluate(input(rows), 3).results[3].outcome).toBe("absent");
    expect(evaluate(input(rows), 2).results[3].outcome).toBe("present");
  });

  it("gives extraction_failed, not days_only, for a failed plus a days-only document", () => {
    const report = evaluate(
      input({
        documents: [
          { documentId: 1, extraction: { ...COMPLETE, state: "fallida" } },
          {
            documentId: 2,
            extraction: {
              ...COMPLETE,
              restFrom: null,
              restTo: null,
              restDays: 3,
            },
          },
        ],
      }),
    );

    expect(report.results[1]).toMatchObject({ reason: "extraction_failed" });
    expect(report.results[2]).toMatchObject({ reason: "extraction_failed" });
  });

  it("holds no fingerprint and no name field", () => {
    const report = evaluate(
      input({
        issuerHistory: [{ solicitudId: 10, issuer: "Clinica Central" }],
      }),
    );
    const keys: string[] = [];
    JSON.parse(JSON.stringify(report), function (key, value) {
      keys.push(key);
      return value;
    });

    expect(
      keys.filter((k) =>
        /name|nombre|cif|correo|mail|hash|huella|fingerprint/i.test(k),
      ),
    ).toEqual([]);
    expect(JSON.stringify(report)).not.toContain("Ana Lopez");
  });
});

describe("pickReason precedence", () => {
  it("takes the first of the closed precedence list", () => {
    expect(pickReason([...REASON_PRECEDENCE].reverse())).toBe(
      REASON_PRECEDENCE[0],
    );
    for (let i = 0; i < REASON_PRECEDENCE.length; i += 1) {
      expect(pickReason([...REASON_PRECEDENCE.slice(i)].reverse())).toBe(
        REASON_PRECEDENCE[i],
      );
    }
  });

  it("runs no_period, no_eligible_documents, pending, failed, days_only, field_missing, no_fingerprint", () => {
    expect(REASON_PRECEDENCE).toEqual([
      "no_period",
      "no_eligible_documents",
      "extraction_pending",
      "extraction_failed",
      "days_only",
      "field_missing",
      "no_fingerprint",
    ]);
  });

  it("refuses an empty list", () => {
    expect(() => pickReason([])).toThrow();
  });
});

describe("evaluateSignals reasons are always from the closed set", () => {
  const rows: (ExtractionRowView | null)[] = [
    null,
    { ...COMPLETE, state: "pendiente" },
    { ...COMPLETE, state: "procesando" },
    { ...COMPLETE, state: "fallida" },
    COMPLETE,
    { ...COMPLETE, restTo: "2026-10-01" },
    { ...COMPLETE, restFrom: null, restTo: null, restDays: 3 },
    { ...COMPLETE, issueDate: null, issuer: null },
    { ...COMPLETE, restFrom: null, restTo: null, restDays: null },
  ];
  const documentSets: SignalDocument[][] = [
    [],
    ...rows.map((extraction, i) => [{ documentId: i, extraction }]),
    ...rows.flatMap((a, i) =>
      rows.map((b, j) => [
        { documentId: 100 + i, extraction: a },
        { documentId: 200 + j, extraction: b },
      ]),
    ),
  ];
  const periodSets = [[], ["2026-S2"], ["2026-S1", "2026-S2"]];
  const ends = ["2026-10-09", "2027-12-30", "2025-06-02"];
  const repeatedSets: RepeatedDocumentInput[] = [
    { documents: [], matches: [] },
    { documents: [{ documentId: 1, fingerprinted: false }], matches: [] },
    { documents: [{ documentId: 1, fingerprinted: true }], matches: [] },
    {
      documents: [{ documentId: 1, fingerprinted: true }],
      matches: [{ solicitudId: null }],
    },
  ];

  const cases = documentSets.flatMap((documents) =>
    periodSets.flatMap((periods) =>
      ends.flatMap((absenceTo) =>
        repeatedSets.map((repeated) => ({
          documents,
          periods,
          absenceTo,
          repeated,
        })),
      ),
    ),
  );

  it("has the input combinations of the spec", () => {
    expect(cases.length).toBeGreaterThan(500);
  });

  it("gives present and absent no reason, and not_evaluable one allowed for the signal", () => {
    const seen = new Set<string>();
    for (const { documents, periods, absenceTo, repeated } of cases) {
      const report = evaluate(
        input({ documents, periods, absenceTo, repeated }),
      );

      for (const result of report.results) {
        if (result.outcome === "not_evaluable") {
          expect(NOT_EVALUABLE_REASONS).toContain(result.reason);
          expect(ALLOWED_REASONS[result.signal]).toContain(result.reason);
          seen.add(`${result.signal}:${result.reason}`);
          expect(Object.keys(result).sort()).toEqual([
            "outcome",
            "reason",
            "signal",
          ]);
        } else {
          expect("reason" in result).toBe(false);
        }
      }
      expect(report.notEvaluable).toEqual(
        report.results.flatMap((r) =>
          r.outcome === "not_evaluable"
            ? [{ signal: r.signal, reason: r.reason }]
            : [],
        ),
      );
    }
    // The combinations really reach both RN-26 reasons.
    expect(seen).toContain("rn26:no_fingerprint");
    expect(seen).toContain("rn26:no_eligible_documents");
  });
});
