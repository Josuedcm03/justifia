import { describe, expect, it } from "vitest";

import { REVIEW_TABS, reviewTabOf } from "./review-tabs";

// The closed set of the `/review?estado=` selector (RF-06, E14). Each tab code
// is the request state the tab lists, so it is also the audit payload code.

describe("reviewTabOf (request-review: Review state tabs)", () => {
  it("lists the three tabs in display order", () => {
    expect(REVIEW_TABS).toEqual([
      "pendiente",
      "en_revision_coordinacion",
      "aprobada",
    ]);
  });

  it.each(REVIEW_TABS)("accepts the tab code %s", (tab) => {
    expect(reviewTabOf(tab)).toBe(tab);
  });

  it.each([
    ["no value", undefined],
    ["an empty string", ""],
    ["a state that has no tab", "rechazada"],
    ["a draft", "borrador"],
    ["another case", "APROBADA"],
    ["markup", "<b>x</b>"],
    ["a repeated parameter", ["aprobada", "pendiente"]],
    ["a number", 3],
  ])("falls back to Pendientes for %s", (_label, value) => {
    expect(reviewTabOf(value)).toBe("pendiente");
  });
});
