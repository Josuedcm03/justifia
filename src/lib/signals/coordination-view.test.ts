import { describe, expect, it } from "vitest";

import { toCoordinationView } from "@/lib/signals/coordination-view";
import type { SignalReport } from "@/lib/signals/types";

// coordination-escalation: "Signal outcomes on the open escalation detail"
// (RF-05 a, RN-15, RN-26, RNF-01, RNF-02). The coordinator sees outcomes,
// not-evaluable reason labels and the suggested verdict; nothing else leaves
// the projection. Pure function, so every scenario is a table row.

const FULL_REPORT: SignalReport = {
  verdict: "review_carefully",
  results: [
    {
      signal: "rn07",
      outcome: "present",
      evidence: {
        kind: "timing",
        presented: "2026-10-14",
        deadline: "2026-10-13",
      },
    },
    {
      signal: "rn09",
      outcome: "absent",
      evidence: {
        kind: "incoherent",
        documents: [
          { documentId: 31, issueDate: "2026-10-09", restTo: "2026-10-12" },
        ],
      },
    },
    {
      signal: "rn10",
      outcome: "present",
      evidence: {
        kind: "uncovered",
        absenceFrom: "2026-10-05",
        absenceTo: "2026-10-07",
        covered: [{ from: "2026-10-05", to: "2026-10-06" }],
      },
    },
    { signal: "rn14", outcome: "not_evaluable", reason: "no_period" },
    {
      signal: "rn26",
      outcome: "present",
      evidence: { kind: "repeated", references: [41, 55] },
    },
  ],
  notEvaluable: [{ signal: "rn14", reason: "no_period" }],
};

describe("toCoordinationView keeps outcomes, reasons and the verdict", () => {
  it("keeps the signal, the outcome and the reason of every result, in order", () => {
    const view = toCoordinationView(FULL_REPORT);

    expect(view.results).toEqual([
      { signal: "rn07", outcome: "present" },
      { signal: "rn09", outcome: "absent" },
      { signal: "rn10", outcome: "present" },
      { signal: "rn14", outcome: "not_evaluable", reason: "no_period" },
      { signal: "rn26", outcome: "present" },
    ]);
    expect(view.notEvaluable).toEqual([
      { signal: "rn14", reason: "no_period" },
    ]);
  });

  it.each(["review_carefully", "no_alerts", "inconclusive"] as const)(
    "gives the %s verdict the secretary gets",
    (verdict) => {
      expect(toCoordinationView({ ...FULL_REPORT, verdict }).verdict).toBe(
        verdict,
      );
    },
  );

  it("keeps a list with several not-evaluable reasons whole", () => {
    const view = toCoordinationView({
      verdict: "inconclusive",
      results: [
        {
          signal: "rn09",
          outcome: "not_evaluable",
          reason: "extraction_failed",
        },
        { signal: "rn26", outcome: "not_evaluable", reason: "no_fingerprint" },
      ],
      notEvaluable: [
        { signal: "rn09", reason: "extraction_failed" },
        { signal: "rn26", reason: "no_fingerprint" },
      ],
    });

    expect(view.notEvaluable).toEqual([
      { signal: "rn09", reason: "extraction_failed" },
      { signal: "rn26", reason: "no_fingerprint" },
    ]);
    expect(view.results).toHaveLength(2);
  });
});

describe("toCoordinationView drops every evidence field", () => {
  it("carries no evidence key on any result", () => {
    const view = toCoordinationView(FULL_REPORT);

    expect(view.results).toHaveLength(5);
    for (const result of view.results) {
      expect(result).not.toHaveProperty("evidence");
    }
  });

  it("holds no date, issuer, count, threshold or document id in the serialized view", () => {
    const withRecurrence: SignalReport = {
      ...FULL_REPORT,
      results: [
        ...FULL_REPORT.results,
        {
          signal: "rn14",
          outcome: "present",
          evidence: {
            kind: "recurrence",
            issuer: "clinica santa fe",
            count: 3,
            threshold: 3,
          },
        },
      ],
    };

    const text = JSON.stringify(toCoordinationView(withRecurrence));

    expect(text).not.toMatch(/2026|clinica|santa fe|issuer|threshold|count/);
    expect(text).not.toMatch(/documentId|issueDate|restTo|absenceFrom/);
    expect(text).not.toContain("31");
  });

  it("never gives an RN-26 reference or count, in scope or not", () => {
    const text = JSON.stringify(toCoordinationView(FULL_REPORT));

    expect(text).not.toMatch(/references|repeated/);
    expect(text).not.toMatch(/41|55/);
  });

  it("gives an RN-26 present with no reference the same shape as one with references", () => {
    const withNone = toCoordinationView({
      ...FULL_REPORT,
      results: [
        {
          signal: "rn26",
          outcome: "present",
          evidence: { kind: "repeated", references: [] },
        },
      ],
    });
    const withTwo = toCoordinationView({
      ...FULL_REPORT,
      results: [
        {
          signal: "rn26",
          outcome: "present",
          evidence: { kind: "repeated", references: [41, 55] },
        },
      ],
    });

    expect(withNone.results).toEqual([{ signal: "rn26", outcome: "present" }]);
    expect(withTwo.results).toEqual(withNone.results);
  });

  it("does not pass along a field the report type does not declare", () => {
    const leaky = {
      ...FULL_REPORT,
      extracted: { nombre: "Ana Lopez" },
      results: FULL_REPORT.results.map((r) => ({ ...r, nombre: "Ana Lopez" })),
    } as unknown as SignalReport;

    const text = JSON.stringify(toCoordinationView(leaky));

    expect(text).not.toContain("Ana Lopez");
    expect(Object.keys(toCoordinationView(leaky)).sort()).toEqual([
      "notEvaluable",
      "results",
      "verdict",
    ]);
  });
});
