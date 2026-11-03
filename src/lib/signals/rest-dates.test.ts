import { describe, expect, it } from "vitest";

import type { ExtractionRowView } from "@/lib/extraction/display";

import { evaluateIncoherentDates, evaluateUncoveredDates } from "./rest-dates";
import type { SignalDocument } from "./types";

// validation-signals: "Incoherent dates, RN-09".

const COMPLETE: ExtractionRowView = {
  state: "completada",
  studentName: "Ana Lopez",
  issuer: "Clinica Central",
  issueDate: "2026-07-12",
  restFrom: "2026-07-10",
  restTo: "2026-07-14",
  restDays: 5,
};

function doc(
  id: number,
  row: Partial<ExtractionRowView> | null,
): SignalDocument {
  return {
    documentId: id,
    extraction: row === null ? null : { ...COMPLETE, ...row },
  };
}

const present = (id = 1) => doc(id, { restFrom: null, restTo: "2026-07-10" });
const absent = (id = 1) => doc(id, {});
const pending = (id = 1) => doc(id, { state: "pendiente" });
const failed = (id = 1) => doc(id, { state: "fallida" });
const daysOnly = (id = 1) =>
  doc(id, { restFrom: null, restTo: null, restDays: 3 });
const fieldMissing = (id = 1) => doc(id, { issueDate: null });

describe("evaluateIncoherentDates document boundaries", () => {
  it.each([
    ["rest ends before the issue date", { restTo: "2026-07-10" }, "present"],
    ["equal dates", { restTo: "2026-07-12" }, "absent"],
    ["rest ends after the issue date", { restTo: "2026-07-14" }, "absent"],
  ] as const)("%s is %s", (_label, row, outcome) => {
    const result = evaluateIncoherentDates([doc(1, row)]);

    expect(result.signal).toBe("rn09");
    expect(result.outcome).toBe(outcome);
  });

  it.each([
    ["days only, no dates", daysOnly(), "days_only"],
    ["no issue date", doc(1, { issueDate: null }), "field_missing"],
    [
      "no rest at all",
      doc(1, { restFrom: null, restTo: null, restDays: null }),
      "field_missing",
    ],
    ["a failed extraction", failed(), "extraction_failed"],
    ["a pending extraction", pending(), "extraction_pending"],
    [
      "a processing extraction",
      doc(1, { state: "procesando" }),
      "extraction_pending",
    ],
    ["no extraction row", doc(1, null), "extraction_pending"],
  ] as const)("%s is not evaluable with %s", (_label, document, reason) => {
    expect(evaluateIncoherentDates([document])).toEqual({
      signal: "rn09",
      outcome: "not_evaluable",
      reason,
    });
  });

  it("reports the offending document as evidence", () => {
    const result = evaluateIncoherentDates([doc(7, { restTo: "2026-07-10" })]);

    expect(result).toMatchObject({
      outcome: "present",
      evidence: {
        kind: "incoherent",
        documents: [
          { documentId: 7, issueDate: "2026-07-12", restTo: "2026-07-10" },
        ],
      },
    });
  });
});

describe("evaluateIncoherentDates aggregation", () => {
  it.each([
    ["present + pending", [present(1), pending(2)], "present"],
    ["absent + pending", [absent(1), pending(2)], "absent"],
    ["absent + absent", [absent(1), absent(2)], "absent"],
    ["pending + failed", [pending(1), failed(2)], "extraction_pending"],
    ["days only + field missing", [daysOnly(1), fieldMissing(2)], "days_only"],
    ["failed + days only", [failed(1), daysOnly(2)], "extraction_failed"],
  ] as const)("%s gives %s", (_label, documents, expected) => {
    const result = evaluateIncoherentDates(documents);

    if (result.outcome === "not_evaluable") {
      expect(result.reason).toBe(expected);
    } else {
      expect(result.outcome).toBe(expected);
    }
  });

  it("is present when any one document is, whatever the others show", () => {
    const result = evaluateIncoherentDates([absent(1), present(2), failed(3)]);

    expect(result.outcome).toBe("present");
    expect(result).toMatchObject({
      evidence: { documents: [{ documentId: 2 }] },
    });
  });

  it("is not evaluable with no current document", () => {
    expect(evaluateIncoherentDates([])).toEqual({
      signal: "rn09",
      outcome: "not_evaluable",
      reason: "no_eligible_documents",
    });
  });
});

// validation-signals: "Uncovered dates, RN-10". Absence Mon 2026-10-05 to Fri
// 2026-10-09; the rest periods below are all in October 2026.

const ABSENCE = { from: "2026-10-05", to: "2026-10-09" };

function rest(id: number, from: string, to: string): SignalDocument {
  return doc(id, {
    restFrom: `2026-10-${from}`,
    restTo: `2026-10-${to}`,
    restDays: 1,
  });
}

describe("evaluateUncoveredDates containment", () => {
  it.each([
    ["exact cover", [["05", "09"]], "absent"],
    ["wider cover", [["01", "20"]], "absent"],
    ["last day uncovered", [["05", "08"]], "present"],
    ["first day uncovered", [["06", "09"]], "present"],
    [
      "adjacent periods merge",
      [
        ["05", "07"],
        ["08", "09"],
      ],
      "absent",
    ],
    [
      "a one-day gap",
      [
        ["05", "06"],
        ["08", "09"],
      ],
      "present",
    ],
    ["a single day", [["07", "07"]], "present"],
  ] as const)("%s is %s", (_label, periods, outcome) => {
    const documents = periods.map(([from, to], i) => rest(i + 1, from, to));

    const result = evaluateUncoveredDates(documents, ABSENCE);

    expect(result.signal).toBe("rn10");
    expect(result.outcome).toBe(outcome);
  });

  it("merges overlapping and unordered periods", () => {
    const result = evaluateUncoveredDates(
      [rest(1, "08", "09"), rest(2, "05", "08")],
      ABSENCE,
    );

    expect(result).toMatchObject({
      outcome: "absent",
      evidence: {
        kind: "uncovered",
        absenceFrom: "2026-10-05",
        absenceTo: "2026-10-09",
        covered: [{ from: "2026-10-05", to: "2026-10-09" }],
      },
    });
  });

  it("keeps a gap visible in the evidence", () => {
    const result = evaluateUncoveredDates(
      [rest(1, "05", "06"), rest(2, "08", "09")],
      ABSENCE,
    );

    expect(result).toMatchObject({
      outcome: "present",
      evidence: {
        covered: [
          { from: "2026-10-05", to: "2026-10-06" },
          { from: "2026-10-08", to: "2026-10-09" },
        ],
      },
    });
  });

  it("compares calendar days, so month ends are adjacent", () => {
    const result = evaluateUncoveredDates(
      [
        doc(1, { restFrom: "2026-09-28", restTo: "2026-09-30" }),
        doc(2, { restFrom: "2026-10-01", restTo: "2026-10-03" }),
      ],
      { from: "2026-09-29", to: "2026-10-02" },
    );

    expect(result.outcome).toBe("absent");
  });
});

describe("evaluateUncoveredDates days-only documents", () => {
  it.each([
    [
      "covered by the dated union",
      [rest(1, "05", "09"), daysOnly(2)],
      "absent",
    ],
    ["uncovered", [rest(1, "05", "07"), daysOnly(2)], "days_only"],
    ["no dated period at all", [daysOnly(1)], "days_only"],
  ] as const)("%s gives %s", (_label, documents, expected) => {
    const result = evaluateUncoveredDates(documents, ABSENCE);

    if (result.outcome === "not_evaluable") {
      expect(result.reason).toBe(expected);
    } else {
      expect(result.outcome).toBe(expected);
    }
  });
});

describe("evaluateUncoveredDates pending or failed documents", () => {
  it.each([
    ["pending", pending(2), "extraction_pending"],
    ["failed", failed(2), "extraction_failed"],
    ["without a row", doc(2, null), "extraction_pending"],
  ] as const)(
    "an uncovered range with a %s document is not evaluable, never present",
    (_label, other, reason) => {
      expect(
        evaluateUncoveredDates([rest(1, "05", "07"), other], ABSENCE),
      ).toEqual({ signal: "rn10", outcome: "not_evaluable", reason });
    },
  );

  it("is absent when the dated union covers the range, whatever else shows", () => {
    const result = evaluateUncoveredDates(
      [rest(1, "05", "09"), pending(2), failed(3)],
      ABSENCE,
    );

    expect(result.outcome).toBe("absent");
  });

  it("applies the precedence when several documents explain it", () => {
    const result = evaluateUncoveredDates(
      [failed(1), daysOnly(2), fieldMissing(3)],
      ABSENCE,
    );

    expect(result).toMatchObject({ reason: "extraction_failed" });
  });

  it("is not evaluable with no current document", () => {
    expect(evaluateUncoveredDates([], ABSENCE)).toEqual({
      signal: "rn10",
      outcome: "not_evaluable",
      reason: "no_eligible_documents",
    });
  });

  it("is not evaluable for a completed document without dates or days", () => {
    const result = evaluateUncoveredDates(
      [doc(1, { restFrom: null, restTo: null, restDays: null })],
      ABSENCE,
    );

    expect(result).toMatchObject({ reason: "field_missing" });
  });
});
