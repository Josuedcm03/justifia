import { describe, expect, it } from "vitest";

import { suggestVerdict } from "./verdict";
import type { SignalResult } from "./types";

// validation-signals: "Three-state suggested verdict" (RN-15).

const evidence = {
  kind: "timing",
  presented: "2026-10-13",
  deadline: "2026-10-13",
} as const;
const present = (signal: SignalResult["signal"]): SignalResult => ({
  signal,
  outcome: "present",
  evidence,
});
const absent = (signal: SignalResult["signal"]): SignalResult => ({
  signal,
  outcome: "absent",
  evidence,
});
const unknown = (
  signal: SignalResult["signal"],
  reason: Extract<
    SignalResult,
    { outcome: "not_evaluable" }
  >["reason"] = "extraction_pending",
): SignalResult => ({ signal, outcome: "not_evaluable", reason });
const notApplicable = (signal: "rn09" | "rn10"): SignalResult => ({
  signal,
  outcome: "not_applicable",
});

describe("suggestVerdict table", () => {
  it.each([
    [
      "one present, others any",
      [
        present("rn07"),
        absent("rn09"),
        unknown("rn10"),
        absent("rn14"),
        absent("rn26"),
      ],
      "review_carefully",
      ["rn10"],
    ],
    [
      "all absent",
      [
        absent("rn07"),
        absent("rn09"),
        absent("rn10"),
        absent("rn14"),
        absent("rn26"),
      ],
      "no_alerts",
      [],
    ],
    [
      "none present, one not evaluable",
      [
        absent("rn07"),
        absent("rn09"),
        unknown("rn10"),
        absent("rn14"),
        absent("rn26"),
      ],
      "inconclusive",
      ["rn10"],
    ],
    [
      "none present, all not evaluable",
      [
        unknown("rn07", "calendar_not_covering_year"),
        unknown("rn09"),
        unknown("rn10"),
        unknown("rn14"),
        unknown("rn26", "no_fingerprint"),
      ],
      "inconclusive",
      ["rn07", "rn09", "rn10", "rn14", "rn26"],
    ],
  ] as const)("%s", (_label, results, verdict, listed) => {
    const suggestion = suggestVerdict(results);

    expect(suggestion.verdict).toBe(verdict);
    expect(suggestion.notEvaluable.map((e) => e.signal)).toEqual(listed);
  });

  it("lets present beat not evaluable and lists the three with their reasons", () => {
    const suggestion = suggestVerdict([
      present("rn07"),
      unknown("rn09", "extraction_pending"),
      unknown("rn10", "extraction_failed"),
      unknown("rn14", "no_period"),
    ]);

    expect(suggestion.verdict).toBe("review_carefully");
    expect(suggestion.notEvaluable).toEqual([
      { signal: "rn09", reason: "extraction_pending" },
      { signal: "rn10", reason: "extraction_failed" },
      { signal: "rn14", reason: "no_period" },
    ]);
  });

  it("lets a repeated document beat a signal that could not be checked", () => {
    const suggestion = suggestVerdict([
      absent("rn07"),
      unknown("rn09"),
      unknown("rn10"),
      unknown("rn14"),
      present("rn26"),
    ]);

    expect(suggestion.verdict).toBe("review_carefully");
    expect(suggestion.notEvaluable.map((e) => e.signal)).toEqual([
      "rn09",
      "rn10",
      "rn14",
    ]);
  });

  it("is inconclusive, never no_alerts, when only RN-26 has no fingerprint", () => {
    const suggestion = suggestVerdict([
      absent("rn07"),
      absent("rn09"),
      absent("rn10"),
      absent("rn14"),
      unknown("rn26", "no_fingerprint"),
    ]);

    expect(suggestion.verdict).toBe("inconclusive");
    expect(suggestion.notEvaluable).toEqual([
      { signal: "rn26", reason: "no_fingerprint" },
    ]);
  });

  it("is inconclusive, never no_alerts, while extraction is pending", () => {
    const suggestion = suggestVerdict([
      absent("rn07"),
      unknown("rn09"),
      unknown("rn10"),
      unknown("rn14"),
    ]);

    expect(suggestion.verdict).toBe("inconclusive");
    expect(suggestion.verdict).not.toBe("no_alerts");
  });

  it("is inconclusive when nothing was evaluated at all", () => {
    expect(suggestVerdict([]).verdict).toBe("inconclusive");
  });
});

// "Verdict table": the rows that involve `not_applicable` (RF-05 a, RN-15).
describe("suggestVerdict with not applicable signals", () => {
  it.each([
    [
      "not applicable plus the rest all absent",
      [
        absent("rn07"),
        notApplicable("rn09"),
        notApplicable("rn10"),
        absent("rn14"),
        absent("rn26"),
      ],
      "no_alerts",
      [],
    ],
    [
      "not applicable plus one present",
      [
        absent("rn07"),
        notApplicable("rn09"),
        notApplicable("rn10"),
        present("rn14"),
        absent("rn26"),
      ],
      "review_carefully",
      [],
    ],
    [
      "not applicable plus a present and a not evaluable",
      [
        present("rn07"),
        notApplicable("rn09"),
        notApplicable("rn10"),
        unknown("rn14", "field_missing"),
        absent("rn26"),
      ],
      "review_carefully",
      ["rn14"],
    ],
    [
      "none present, one not evaluable, not applicable ignored",
      [
        absent("rn07"),
        notApplicable("rn09"),
        notApplicable("rn10"),
        unknown("rn14", "field_missing"),
        absent("rn26"),
      ],
      "inconclusive",
      ["rn14"],
    ],
    [
      "none present, all applicable not evaluable",
      [
        unknown("rn07", "calendar_not_covering_year"),
        notApplicable("rn09"),
        notApplicable("rn10"),
        unknown("rn14"),
        unknown("rn26", "no_fingerprint"),
      ],
      "inconclusive",
      ["rn07", "rn14", "rn26"],
    ],
    [
      "only not applicable and not evaluable",
      [notApplicable("rn09"), unknown("rn10")],
      "inconclusive",
      ["rn10"],
    ],
    [
      "every signal not applicable",
      [notApplicable("rn09"), notApplicable("rn10")],
      "inconclusive",
      [],
    ],
  ] as const)("%s", (_label, results, verdict, listed) => {
    const suggestion = suggestVerdict(results);

    expect(suggestion.verdict).toBe(verdict);
    expect(suggestion.notEvaluable.map((e) => e.signal)).toEqual(listed);
  });

  it("never lists a not applicable signal among the not evaluable ones", () => {
    const suggestion = suggestVerdict([
      absent("rn07"),
      notApplicable("rn09"),
      notApplicable("rn10"),
      unknown("rn14", "no_period"),
    ]);

    expect(suggestion.notEvaluable).toEqual([
      { signal: "rn14", reason: "no_period" },
    ]);
  });
});

// validation-signals: "Three-state suggested verdict" (MD-19, D1). The verdict
// is generic over the signal code, so the three manual signals need no rule of
// their own: an unregistered datum is a not_evaluable reason like any other.
describe("suggestVerdict with the manual signals (RN-11, RN-12, RN-13)", () => {
  const unregistered = (signal: "rn11" | "rn12" | "rn13") =>
    unknown(signal, "not_registered");

  it("keeps the verdict inconclusive, and lists the three apart, while the marks are not registered", () => {
    const suggestion = suggestVerdict([
      absent("rn07"),
      absent("rn09"),
      absent("rn10"),
      unregistered("rn11"),
      unregistered("rn12"),
      unregistered("rn13"),
      absent("rn14"),
      absent("rn26"),
    ]);

    expect(suggestion.verdict).toBe("inconclusive");
    expect(suggestion.notEvaluable).toEqual([
      { signal: "rn11", reason: "not_registered" },
      { signal: "rn12", reason: "not_registered" },
      { signal: "rn13", reason: "not_registered" },
    ]);
  });

  it("restores no_alerts once the marks are registered and absent", () => {
    const suggestion = suggestVerdict([
      absent("rn07"),
      absent("rn09"),
      absent("rn10"),
      absent("rn11"),
      absent("rn12"),
      absent("rn13"),
      absent("rn14"),
      absent("rn26"),
    ]);

    expect(suggestion.verdict).toBe("no_alerts");
    expect(suggestion.notEvaluable).toEqual([]);
  });

  it("keeps a single unregistered mark from reaching no_alerts", () => {
    const suggestion = suggestVerdict([
      absent("rn07"),
      absent("rn09"),
      absent("rn10"),
      unregistered("rn11"),
      absent("rn12"),
      absent("rn13"),
      absent("rn14"),
      absent("rn26"),
    ]);

    expect(suggestion.verdict).toBe("inconclusive");
    expect(suggestion.notEvaluable).toEqual([
      { signal: "rn11", reason: "not_registered" },
    ]);
  });

  it("lets a present manual signal beat not registered, and still lists the two apart", () => {
    const suggestion = suggestVerdict([
      absent("rn07"),
      unregistered("rn11"),
      present("rn12"),
      unregistered("rn13"),
    ]);

    expect(suggestion.verdict).toBe("review_carefully");
    expect(suggestion.notEvaluable).toEqual([
      { signal: "rn11", reason: "not_registered" },
      { signal: "rn13", reason: "not_registered" },
    ]);
  });

  it("is inconclusive for a non-rest cause with only the marks unregistered", () => {
    const suggestion = suggestVerdict([
      absent("rn07"),
      notApplicable("rn09"),
      notApplicable("rn10"),
      unregistered("rn11"),
      unregistered("rn12"),
      unregistered("rn13"),
      absent("rn14"),
      absent("rn26"),
    ]);

    expect(suggestion.verdict).toBe("inconclusive");
    expect(suggestion.notEvaluable.map((e) => e.signal)).toEqual([
      "rn11",
      "rn12",
      "rn13",
    ]);
  });
});
