import { describe, expect, it } from "vitest";

import { constantCalendar } from "@/lib/intake/adapters/constant-calendar";
import { CAUSAS, type Causa } from "@/lib/intake/causes";
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
    causa: "medica",
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

// validation-signals: "Rest signals apply only to causes that admit rest".
describe("evaluateSignals cause scope (RN-09, RN-10)", () => {
  const NON_REST = [
    "fuerza_mayor",
    "actividad_representativa",
    "intercambio_academico",
  ] as const;
  const REST = ["medica", "maternidad_paternidad"] as const;
  const notApplicable = (signal: "rn09" | "rn10") => ({
    signal,
    outcome: "not_applicable",
  });
  // The rest period ends before the document was issued (E-02, SC-02).
  const incoherent: SignalDocument[] = [
    {
      documentId: 1,
      extraction: {
        ...COMPLETE,
        issueDate: "2026-10-12",
        restFrom: "2026-10-05",
        restTo: "2026-10-09",
      },
    },
  ];

  it.each(NON_REST)(
    "makes RN-09 and RN-10 not applicable for %s, with no reason and no evidence",
    (causa) => {
      const report = evaluate(input({ causa, documents: incoherent }));

      expect(report.results[1]).toEqual(notApplicable("rn09"));
      expect(report.results[2]).toEqual(notApplicable("rn10"));
      expect(report.verdict).toBe("no_alerts");
      expect(report.notEvaluable).toEqual([]);
    },
  );

  it.each(REST)("still evaluates both signals for %s", (causa) => {
    const report = evaluate(input({ causa, documents: incoherent }));

    expect(report.results[1]).toMatchObject({
      signal: "rn09",
      outcome: "present",
    });
    expect(report.results[2]).toMatchObject({
      signal: "rn10",
      outcome: "absent",
    });
    expect(report.verdict).toBe("review_carefully");
  });

  it.each(["pendiente", "fallida"] as const)(
    "keeps the cut ahead of an extraction that is %s",
    (state) => {
      const documents = [{ documentId: 1, extraction: { ...COMPLETE, state } }];

      const cut = evaluate(input({ causa: "fuerza_mayor", documents }));
      const medical = evaluate(input({ causa: "medica", documents }));

      expect(cut.results[1]).toEqual(notApplicable("rn09"));
      expect(cut.results[2]).toEqual(notApplicable("rn10"));
      expect(medical.results[1]).toMatchObject({ outcome: "not_evaluable" });
      expect(medical.results[2]).toMatchObject({ outcome: "not_evaluable" });
    },
  );

  it("keeps the cut ahead of a document with no extraction row", () => {
    const documents = [{ documentId: 1, extraction: null }];

    const report = evaluate(input({ causa: "fuerza_mayor", documents }));

    expect(report.results[1]).toEqual(notApplicable("rn09"));
    expect(report.results[2]).toEqual(notApplicable("rn10"));
    expect(report.notEvaluable.map((entry) => entry.signal)).toEqual(["rn14"]);
  });

  it("evaluates RN-10 for maternity or paternity: a covered range, then a gap", () => {
    const issued = { ...COMPLETE, issueDate: "2026-10-05" };
    const covered = evaluate(
      input({
        causa: "maternidad_paternidad",
        documents: [{ documentId: 1, extraction: issued }],
      }),
    );
    const shorter = evaluate(
      input({
        causa: "maternidad_paternidad",
        documents: [
          { documentId: 1, extraction: { ...issued, restTo: "2026-10-07" } },
        ],
      }),
    );

    expect(covered.results.slice(1, 3).map((r) => r.outcome)).toEqual([
      "absent",
      "absent",
    ]);
    expect(shorter.results.slice(1, 3).map((r) => r.outcome)).toEqual([
      "absent",
      "present",
    ]);
  });

  it("evaluates RN-07, RN-14 and RN-26 the same for every cause", () => {
    const rows = {
      presentedAt: new Date("2026-10-14T15:00:00Z"),
      issuerHistory: [
        { solicitudId: 10, issuer: "Clinica Central" },
        { solicitudId: 11, issuer: "Clinica Central" },
      ],
      repeated: {
        documents: [{ documentId: 1, fingerprinted: true }],
        matches: [{ solicitudId: 41 }],
      },
    };
    const reference = evaluate(input({ causa: "medica", ...rows })).results;

    expect(reference[0].outcome).toBe("present");
    expect(reference[3].outcome).toBe("present");
    expect(reference[4].outcome).toBe("present");
    for (const causa of CAUSAS) {
      const { results } = evaluate(input({ causa, ...rows }));

      expect(results[0]).toEqual(reference[0]);
      expect(results[3]).toEqual(reference[3]);
      expect(results[4]).toEqual(reference[4]);
    }
  });

  it("suggests reviewing carefully when RN-14 is present for a non-rest cause", () => {
    const report = evaluate(
      input({
        causa: "actividad_representativa",
        issuerHistory: [
          { solicitudId: 10, issuer: "Clinica Central" },
          { solicitudId: 11, issuer: "Clinica Central" },
        ],
      }),
    );

    expect(report.verdict).toBe("review_carefully");
    expect(report.results[1]).toEqual(notApplicable("rn09"));
    expect(report.results[2]).toEqual(notApplicable("rn10"));
  });

  it("is inconclusive for a non-rest cause with RN-14 not evaluable, listing only RN-14", () => {
    const report = evaluate(
      input({
        causa: "fuerza_mayor",
        documents: [
          {
            documentId: 1,
            extraction: { ...COMPLETE, issuer: null },
          },
        ],
      }),
    );

    expect(report.verdict).toBe("inconclusive");
    expect(report.notEvaluable).toEqual([
      { signal: "rn14", reason: "field_missing" },
    ]);
  });

  it.each(CAUSAS)("returns the five results in fixed order for %s", (causa) => {
    const report = evaluate(input({ causa }));

    expect(report.results.map((r) => r.signal)).toEqual(SIGNAL_CODES);
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

  const causas: Causa[] = ["medica", "fuerza_mayor"];

  const cases = documentSets.flatMap((documents) =>
    periodSets.flatMap((periods) =>
      ends.flatMap((absenceTo) =>
        repeatedSets.flatMap((repeated) =>
          causas.map((causa) => ({
            documents,
            periods,
            absenceTo,
            repeated,
            causa,
          })),
        ),
      ),
    ),
  );

  it("has the input combinations of the spec", () => {
    expect(cases.length).toBeGreaterThan(500);
  });

  it("gives present and absent no reason, and not_evaluable one allowed for the signal", () => {
    const seen = new Set<string>();
    for (const { documents, periods, absenceTo, repeated, causa } of cases) {
      const report = evaluate(
        input({ documents, periods, absenceTo, repeated, causa }),
      );

      for (const result of report.results) {
        if (result.outcome === "not_applicable") {
          // Only RN-09 and RN-10, only for a cause without rest, never with a
          // reason or evidence.
          expect(["rn09", "rn10"]).toContain(result.signal);
          expect(causa).toBe("fuerza_mayor");
          expect(Object.keys(result).sort()).toEqual(["outcome", "signal"]);
          seen.add(`${result.signal}:not_applicable`);
        } else if (result.outcome === "not_evaluable") {
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
    expect(seen).toContain("rn09:not_applicable");
    expect(seen).toContain("rn10:not_applicable");
  });

  it("makes RN-09 and RN-10 not applicable in every case of a cause without rest, and in none of medica", () => {
    for (const { documents, periods, absenceTo, repeated, causa } of cases) {
      const outcomes = evaluate(
        input({ documents, periods, absenceTo, repeated, causa }),
      ).results.map((result) => result.outcome);

      expect(outcomes.slice(1, 3).every((o) => o === "not_applicable")).toBe(
        causa === "fuerza_mayor",
      );
      expect(outcomes.some((o) => o === "not_applicable")).toBe(
        causa === "fuerza_mayor",
      );
    }
  });
});
