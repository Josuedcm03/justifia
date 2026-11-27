import { describe, expect, it } from "vitest";

import type { DocumentMarks, TipoDocumento } from "@/lib/document-data/types";
import { constantCalendar } from "@/lib/intake/adapters/constant-calendar";
import { CAUSAS, type Causa } from "@/lib/intake/causes";
import type { ExtractionRowView } from "@/lib/extraction/display";

import type { TimingParams } from "@/lib/parameters/derive";

import { DOCUMENT_TYPE_CAUSES } from "./document-type-causes";
import { evaluateSignals } from "./evaluate";
import * as issuerModule from "./issuer";
import { DEFAULT_SIGNAL_PARAMS, type SignalParams } from "./params";
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

// The type that corresponds to each cause, written out here rather than read
// from the map under test, so a fixture never restates the code.
const MATCHING_TYPE: Record<Causa, TipoDocumento> = {
  medica: "constancia_medica",
  maternidad_paternidad: "constancia_medica",
  actividad_representativa: "constancia_institucional",
  intercambio_academico: "constancia_institucional",
  fuerza_mayor: "constancia_institucional",
};

/** Firma, sello and a type that corresponds to the cause: no signal. */
const registered = (causa: Causa): DocumentMarks => ({
  type: MATCHING_TYPE[causa],
  hasSignature: true,
  hasSeal: true,
});

const UNREGISTERED: DocumentMarks = {
  type: null,
  hasSignature: null,
  hasSeal: null,
};

// A fixture document may leave its marks out: they default to registered ones
// that raise nothing for the declared cause, so the tests that look at the
// other signals keep their expected verdicts.
type FixtureDocument = Omit<SignalDocument, "marks"> & {
  marks?: DocumentMarks;
};
type FixtureInput = Omit<Partial<SignalInput>, "documents"> & {
  documents?: readonly FixtureDocument[];
};

function input(overrides: FixtureInput = {}): SignalInput {
  const causa = overrides.causa ?? "medica";
  const documents = overrides.documents ?? [
    { documentId: 1, extraction: COMPLETE },
  ];
  return {
    solicitudId: 40,
    presentedAt: new Date("2026-10-13T15:00:00Z"),
    absenceFrom: "2026-10-05",
    absenceTo: "2026-10-09",
    periods: ["2026-S2"],
    issuerHistory: [],
    repeated: {
      documents: [{ documentId: 1, fingerprinted: true }],
      matches: [],
    },
    ...overrides,
    causa,
    documents: documents.map((document) => ({
      ...document,
      marks: document.marks ?? registered(causa),
    })),
  };
}

// RN-07 days (key `presentacion_tardia_dias`, default 2): an explicit input.
const TIMING: TimingParams = { lateFilingBusinessDays: 2 };

const evaluateWith = (
  value: SignalInput,
  params: Partial<SignalParams>,
  timing: TimingParams = TIMING,
) =>
  evaluateSignals(
    value,
    { ...DEFAULT_SIGNAL_PARAMS, ...params },
    calendar,
    timing,
  );

const evaluate = (value: SignalInput, threshold?: number) =>
  evaluateWith(
    value,
    threshold === undefined ? {} : { issuerRecurrenceThreshold: threshold },
  );

const ALL_CODES = [
  "rn07",
  "rn09",
  "rn10",
  "rn11",
  "rn12",
  "rn13",
  "rn14",
  "rn26",
] as const;

const result = (report: ReturnType<typeof evaluate>, signal: string) =>
  report.results.find((r) => r.signal === signal);

describe("evaluateSignals", () => {
  it("returns the eight results in order, with the verdict", () => {
    const report = evaluate(input());

    expect(report.results.map((r) => r.signal)).toEqual(SIGNAL_CODES);
    expect(SIGNAL_CODES).toEqual(ALL_CODES);
    expect(report.results.map((r) => r.outcome)).toEqual([
      "absent",
      "absent",
      "absent",
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

    expect(result(report, "rn26")).toEqual({
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

    expect(result(report, "rn26")).toMatchObject({
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

    expect(result(evaluate(input(rows), 3), "rn14")?.outcome).toBe("absent");
    expect(result(evaluate(input(rows), 2), "rn14")?.outcome).toBe("present");
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
  const incoherent: FixtureDocument[] = [
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

    const pick = (results: typeof reference, signal: string) =>
      results.find((r) => r.signal === signal);
    expect(pick(reference, "rn07")?.outcome).toBe("present");
    expect(pick(reference, "rn14")?.outcome).toBe("present");
    expect(pick(reference, "rn26")?.outcome).toBe("present");
    for (const causa of CAUSAS) {
      const { results } = evaluate(input({ causa, ...rows }));

      for (const signal of ["rn07", "rn14", "rn26"]) {
        expect(pick(results, signal)).toEqual(pick(reference, signal));
      }
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

  it.each(CAUSAS)(
    "returns the eight results in fixed order for %s",
    (causa) => {
      const report = evaluate(input({ causa }));

      expect(report.results.map((r) => r.signal)).toEqual(SIGNAL_CODES);
    },
  );
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

  it("runs no_period, no_eligible_documents, pending, failed, days_only, field_missing, no_fingerprint, not_registered", () => {
    expect(REASON_PRECEDENCE).toEqual([
      "no_period",
      "no_eligible_documents",
      "extraction_pending",
      "extraction_failed",
      "days_only",
      "field_missing",
      "no_fingerprint",
      "not_registered",
    ]);
  });

  it("ends with not_registered, which is also a not evaluable reason", () => {
    expect(REASON_PRECEDENCE.at(-1)).toBe("not_registered");
    expect(NOT_EVALUABLE_REASONS).toContain("not_registered");
    expect(pickReason(["not_registered", "no_fingerprint"])).toBe(
      "no_fingerprint",
    );
    expect(pickReason(["not_registered"])).toBe("not_registered");
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
  const documentSets: FixtureDocument[][] = [
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

  // Every cause is swept. The causes without rest are spelled out here rather
  // than derived from `admitsRest`, so the sweep does not restate the code.
  const causas: readonly Causa[] = CAUSAS;
  const withoutRest: readonly Causa[] = [
    "fuerza_mayor",
    "actividad_representativa",
    "intercambio_academico",
  ];

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
          expect(withoutRest).toContain(causa);
          expect(Object.keys(result).sort()).toEqual(["outcome", "signal"]);
          seen.add(`${result.signal}:not_applicable`);
          seen.add(`${causa}:${result.signal}:not_applicable`);
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
    // Each cause without rest reaches both cuts; no cause with rest does.
    expect(
      [...seen].filter((key) => key.split(":").length === 3).sort(),
    ).toEqual(
      withoutRest
        .flatMap((causa) => [
          `${causa}:rn09:not_applicable`,
          `${causa}:rn10:not_applicable`,
        ])
        .sort(),
    );
  });

  it("makes RN-09 and RN-10 not applicable in every case of a cause without rest, and in none of a cause with rest", () => {
    for (const { documents, periods, absenceTo, repeated, causa } of cases) {
      const outcomes = evaluate(
        input({ documents, periods, absenceTo, repeated, causa }),
      ).results.map((result) => result.outcome);

      expect(outcomes.slice(1, 3).every((o) => o === "not_applicable")).toBe(
        withoutRest.includes(causa),
      );
      expect(outcomes.some((o) => o === "not_applicable")).toBe(
        withoutRest.includes(causa),
      );
    }
  });
});

// validation-signals: "Four outcomes with a closed set of reasons" (MD-17),
// "Rest signals apply only to causes that admit rest" (MD-20) and "Type-to-cause
// correspondence is one table behind an injectable seam" (MD-15). RN-11, RN-12
// and RN-13 read the marks the secretary registered, never the extraction.
describe("evaluateSignals marks (RN-11, RN-12, RN-13)", () => {
  const MARK_CODES = ["rn11", "rn12", "rn13"] as const;
  const noMarks = [
    { documentId: 1, extraction: COMPLETE, marks: UNREGISTERED },
  ];

  it("allows only no_eligible_documents and not_registered for the three codes", () => {
    for (const signal of MARK_CODES) {
      expect(ALLOWED_REASONS[signal]).toEqual([
        "no_eligible_documents",
        "not_registered",
      ]);
    }
  });

  it("does not allow not_registered to any other signal", () => {
    expect(SIGNAL_CODES).toHaveLength(8);
    for (const signal of SIGNAL_CODES) {
      expect(ALLOWED_REASONS[signal].includes("not_registered")).toBe(
        (MARK_CODES as readonly string[]).includes(signal),
      );
    }
  });

  it.each(CAUSAS)(
    "gives not_registered to rn11, rn12 and rn13 alone over unregistered marks (%s)",
    (causa) => {
      const report = evaluate(input({ causa, documents: noMarks }));

      for (const signal of MARK_CODES) {
        expect(result(report, signal)).toEqual({
          signal,
          outcome: "not_evaluable",
          reason: "not_registered",
        });
      }
      expect(
        report.notEvaluable
          .filter((entry) => entry.reason === "not_registered")
          .map((entry) => entry.signal),
      ).toEqual(MARK_CODES);
      expect(report.verdict).toBe("inconclusive");
    },
  );

  it("gives no_eligible_documents to the three codes when there are no documents", () => {
    const report = evaluate(input({ documents: [] }));

    for (const signal of MARK_CODES) {
      expect(result(report, signal)).toEqual({
        signal,
        outcome: "not_evaluable",
        reason: "no_eligible_documents",
      });
    }
  });

  // MD-20: the cause cut touches RN-09 and RN-10 only.
  it("raises the three signals for a fuerza_mayor request with firma No, sello No and type constancia_medica, while RN-09 and RN-10 are not applicable", () => {
    const report = evaluate(
      input({
        causa: "fuerza_mayor",
        documents: [
          {
            documentId: 1,
            extraction: COMPLETE,
            marks: {
              type: "constancia_medica",
              hasSignature: false,
              hasSeal: false,
            },
          },
        ],
      }),
    );

    expect(report.results.map((r) => r.outcome)).toEqual([
      "absent",
      "not_applicable",
      "not_applicable",
      "present",
      "present",
      "present",
      "absent",
      "absent",
    ]);
    for (const signal of MARK_CODES) {
      expect(result(report, signal)).toMatchObject({
        outcome: "present",
        evidence: { kind: "documents", documentIds: [1] },
      });
    }
    expect(report.verdict).toBe("review_carefully");
  });

  it.each(CAUSAS)(
    "never makes the three codes not applicable (%s)",
    (causa) => {
      const report = evaluate(input({ causa, documents: noMarks }));

      for (const signal of MARK_CODES) {
        expect(result(report, signal)).toBeDefined();
        expect(result(report, signal)?.outcome).not.toBe("not_applicable");
      }
    },
  );

  it("reads no extraction: the three codes ignore its state", () => {
    const states = [null, ...(["pendiente", "fallida"] as const)].map((state) =>
      evaluate(
        input({
          documents: [
            {
              documentId: 1,
              extraction: state === null ? null : { ...COMPLETE, state },
              marks: { type: "otro", hasSignature: false, hasSeal: true },
            },
          ],
        }),
      ),
    );

    for (const report of states) {
      expect(result(report, "rn11")?.outcome).toBe("present");
      expect(result(report, "rn12")?.outcome).toBe("absent");
      expect(result(report, "rn13")?.outcome).toBe("present");
    }
  });

  it("takes the type-to-cause map from the params", () => {
    const wider = {
      ...DOCUMENT_TYPE_CAUSES,
      constancia_medica: [
        ...DOCUMENT_TYPE_CAUSES.constancia_medica,
        "fuerza_mayor",
      ],
    } as SignalParams["documentTypeCauses"];
    const request = input({
      causa: "fuerza_mayor",
      documents: [
        {
          documentId: 1,
          extraction: COMPLETE,
          marks: {
            type: "constancia_medica",
            hasSignature: true,
            hasSeal: true,
          },
        },
      ],
    });

    expect(result(evaluate(request), "rn13")?.outcome).toBe("present");
    expect(
      result(evaluateWith(request, { documentTypeCauses: wider }), "rn13")
        ?.outcome,
    ).toBe("absent");
  });

  it("defaults the map to the code constant", () => {
    expect(DEFAULT_SIGNAL_PARAMS.documentTypeCauses).toBe(DOCUMENT_TYPE_CAUSES);
  });

  it("keeps every reason of the three codes in their allowed pair over a sweep of marks", () => {
    const sets: DocumentMarks[] = [
      UNREGISTERED,
      registered("medica"),
      { type: "otro", hasSignature: false, hasSeal: false },
      { type: "constancia_medica", hasSignature: null, hasSeal: true },
      { type: null, hasSignature: true, hasSeal: false },
    ];
    const documentSets: FixtureDocument[][] = [
      [],
      ...sets.map((marks, i) => [
        { documentId: i, extraction: COMPLETE, marks },
      ]),
      ...sets.flatMap((a, i) =>
        sets.map((b, j) => [
          { documentId: 10 + i, extraction: COMPLETE, marks: a },
          { documentId: 20 + j, extraction: COMPLETE, marks: b },
        ]),
      ),
    ];

    for (const causa of CAUSAS) {
      for (const documents of documentSets) {
        const report = evaluate(input({ causa, documents }));

        for (const signal of MARK_CODES) {
          const outcome = result(report, signal);
          expect(outcome).toBeDefined();
          expect(outcome?.outcome).not.toBe("not_applicable");
          if (outcome?.outcome === "not_evaluable") {
            expect(ALLOWED_REASONS[signal]).toContain(outcome.reason);
          } else {
            expect(outcome && "reason" in outcome).toBe(false);
          }
        }
      }
    }
  });
});

// validation-signals: "Late presentation, RN-07" and design A10. The days of
// RN-07 travel as their own argument; the shape of `SignalParams` is the one a
// teammate's report already reads.
describe("evaluateSignals late-filing days (RN-07)", () => {
  // Fri 2026-10-09 is the end date; Wed 14th is the third business day after.
  const wednesday = input({ presentedAt: new Date("2026-10-14T15:00:00Z") });
  const rn07 = (timing: TimingParams) =>
    result(evaluateWith(wednesday, {}, timing), "rn07");

  it("passes the late-filing days to RN-07: late with 2, on time with 3", () => {
    expect(rn07({ lateFilingBusinessDays: 2 })).toMatchObject({
      outcome: "present",
      evidence: { deadline: "2026-10-13" },
    });
    expect(rn07({ lateFilingBusinessDays: 3 })).toMatchObject({
      outcome: "absent",
      evidence: { deadline: "2026-10-14" },
    });
  });

  it("changes only RN-07 when the days change", () => {
    const two = evaluateWith(wednesday, {}, { lateFilingBusinessDays: 2 });
    const three = evaluateWith(wednesday, {}, { lateFilingBusinessDays: 3 });

    expect(three.results.slice(1)).toEqual(two.results.slice(1));
    expect(three.results[0]).not.toEqual(two.results[0]);
  });

  it("keeps the shape of SignalParams, DEFAULT_SIGNAL_PARAMS and the issuer exports", () => {
    // Pinned for the coordination report (design A10): no field is added, the
    // days of RN-07 never enter `SignalParams`.
    expect(Object.keys(DEFAULT_SIGNAL_PARAMS).sort()).toEqual([
      "documentTypeCauses",
      "issuerRecurrenceThreshold",
    ]);
    expect(DEFAULT_SIGNAL_PARAMS).toEqual({
      issuerRecurrenceThreshold: 3,
      documentTypeCauses: DOCUMENT_TYPE_CAUSES,
    });
    expect(Object.keys(issuerModule).sort()).toEqual([
      "evaluateRecurrence",
      "issuerKey",
      "normalizeIssuer",
    ]);
  });
});
