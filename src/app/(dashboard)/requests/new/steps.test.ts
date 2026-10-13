import { describe, expect, it } from "vitest";

import {
  AVAILABLE_STEPS,
  defaultStep,
  draftRange,
  parseFromReview,
  parseStep,
  reviewEditHref,
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
