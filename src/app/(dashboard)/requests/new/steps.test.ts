import { describe, expect, it } from "vitest";

import {
  AVAILABLE_STEPS,
  correctionStartStep,
  defaultStep,
  draftRange,
  parseFromReview,
  parseStep,
  reviewEditHref,
  startsAfterToday,
  stepHref,
} from "@/app/(dashboard)/requests/new/steps";

describe("parseStep (A7: the step lives in the URL)", () => {
  it.each([
    ["1", 1],
    ["2", 2],
    ["3", 3],
    ["4", 4],
  ])("accepts %s", (raw, expected) => {
    expect(parseStep(raw)).toBe(expected);
  });

  it("uses the first value of a repeated parameter", () => {
    expect(parseStep(["3", "1"])).toBe(3);
  });

  it.each([undefined, "", "0", "-1", "1.5", "abc", "2abc", " 2"])(
    "treats %j as no step",
    (raw) => {
      expect(parseStep(raw)).toBeNull();
    },
  );

  it("clamps steps beyond the review step to the last one", () => {
    expect(AVAILABLE_STEPS).toBe(4);
    expect(parseStep("5")).toBe(AVAILABLE_STEPS);
    expect(parseStep("99")).toBe(AVAILABLE_STEPS);
  });
});

describe("defaultStep (resume where the draft left off)", () => {
  const empty = { causa: null, fechaInicio: null, fechaFin: null };
  const details = {
    causa: "medica",
    fechaInicio: "2026-10-01",
    fechaFin: "2026-10-02",
  };

  it("starts at the details while any of them is missing", () => {
    expect(defaultStep({ ...empty, subjects: [] })).toBe(1);
    expect(
      defaultStep({ ...details, fechaFin: null, subjects: [{ grupoId: 1 }] }),
    ).toBe(1);
  });

  it("goes to the subjects once the details are saved", () => {
    expect(defaultStep({ ...details, subjects: [] })).toBe(2);
  });

  it("goes to the documents once subjects are saved", () => {
    expect(defaultStep({ ...details, subjects: [{ grupoId: 7 }] })).toBe(3);
  });
});

describe("draftRange", () => {
  it("returns the range when both dates are real and ordered", () => {
    expect(
      draftRange({ fechaInicio: "2026-10-01", fechaFin: "2026-10-01" }),
    ).toEqual({ from: "2026-10-01", to: "2026-10-01" });
  });

  it.each([
    [null, "2026-10-02"],
    ["2026-10-01", null],
    ["2026-10-03", "2026-10-02"],
    ["2026-13-01", "2026-13-02"],
  ])("is null for %s .. %s", (fechaInicio, fechaFin) => {
    expect(draftRange({ fechaInicio, fechaFin })).toBeNull();
  });
});

describe("stepHref", () => {
  it("points at the intake page with the step in the query", () => {
    expect(stepHref(2)).toBe("/requests/new?step=2");
  });
});

describe("reviewEditHref (edit links of the review return to it)", () => {
  it("flags the step as opened from the review", () => {
    expect(reviewEditHref(1)).toBe("/requests/new?step=1&from=review");
  });
});

describe("parseFromReview", () => {
  it("is true only for from=review", () => {
    expect(parseFromReview("review")).toBe(true);
    expect(parseFromReview(["review", "x"])).toBe(true);
  });

  it.each([undefined, "", "Review", "other"])("is false for %j", (raw) => {
    expect(parseFromReview(raw)).toBe(false);
  });
});

describe("hrefs under another base path (the correction flow)", () => {
  it("keeps the step in the query of the given path", () => {
    expect(stepHref(3, "/requests/31/correct")).toBe(
      "/requests/31/correct?step=3",
    );
    expect(reviewEditHref(2, "/requests/31/correct")).toBe(
      "/requests/31/correct?step=2&from=review",
    );
  });

  it("still defaults to the new request flow", () => {
    expect(stepHref(4)).toBe("/requests/new?step=4");
  });
});

describe("correctionStartStep (RN-17, SR-17)", () => {
  it.each([
    ["documento_ilegible", 3],
    ["fecha_alterada", 3],
    ["fecha_incorrecta", 1],
  ] as const)("opens %s at step %i", (reason, expected) => {
    expect(correctionStartStep(reason)).toBe(expected);
  });

  it("opens at step 1 when the reason is unknown", () => {
    expect(correctionStartStep(null)).toBe(1);
  });
});

describe("startsAfterToday (FE-19: a future start gets a notice, never a block)", () => {
  const TODAY = "2026-11-02";
  const range = (from: string) => ({ from, to: "2026-12-31" });

  it.each([
    ["tomorrow", "2026-11-03", true],
    ["today", "2026-11-02", false],
    ["yesterday", "2026-11-01", false],
    ["far in the past", "2025-01-15", false],
    ["far in the future", "2027-06-30", true],
  ])("gives the right answer for a start %s", (_label, from, expected) => {
    expect(startsAfterToday(range(from), TODAY)).toBe(expected);
  });

  it("compares calendar days across a month and a year boundary", () => {
    expect(startsAfterToday(range("2026-12-01"), "2026-11-30")).toBe(true);
    expect(startsAfterToday(range("2027-01-01"), "2026-12-31")).toBe(true);
    expect(startsAfterToday(range("2026-11-30"), "2026-12-01")).toBe(false);
  });

  it.each([null, { from: "" }, { from: "2026-13-45" }, { from: "tomorrow" }])(
    "is false for an invalid range %j",
    (invalid) => {
      expect(startsAfterToday(invalid, TODAY)).toBe(false);
    },
  );

  it("needs only the start: a draft whose end is not typed yet still gets the notice", () => {
    expect(startsAfterToday({ from: "2026-11-10" }, TODAY)).toBe(true);
  });

  it("is false when today is not a real date, instead of guessing", () => {
    expect(startsAfterToday(range("2026-11-10"), "")).toBe(false);
  });
});
