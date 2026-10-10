import { describe, expect, it } from "vitest";

import { encodeDias } from "@/lib/catalog/dias";

import { hasClassInRange, isoWeekdayIndex } from "./schedule";

// 2026-10-05 is a Monday; 2026-10-10 a Saturday; 2026-10-11 a Sunday.
const MON_WED = encodeDias(["lunes", "miercoles"]);

describe("isoWeekdayIndex (bit i = Postgres isodow - 1)", () => {
  it("maps Monday to 0 and Sunday to 6", () => {
    expect(isoWeekdayIndex("2026-10-05")).toBe(0);
    expect(isoWeekdayIndex("2026-10-07")).toBe(2);
    expect(isoWeekdayIndex("2026-10-10")).toBe(5);
    expect(isoWeekdayIndex("2026-10-11")).toBe(6);
  });
});

describe("hasClassInRange (RN-22)", () => {
  it("is true when a single-day range falls on a set day", () => {
    expect(
      hasClassInRange(MON_WED, { from: "2026-10-05", to: "2026-10-05" }),
    ).toBe(true);
  });

  it("is false when a single-day range falls on an unset day", () => {
    expect(
      hasClassInRange(MON_WED, { from: "2026-10-06", to: "2026-10-06" }),
    ).toBe(false);
  });

  it("includes both ends of the range", () => {
    expect(
      hasClassInRange(MON_WED, { from: "2026-10-04", to: "2026-10-05" }),
    ).toBe(true);
    expect(
      hasClassInRange(MON_WED, { from: "2026-10-07", to: "2026-10-09" }),
    ).toBe(true);
  });

  it("is false for a short range with no set day", () => {
    expect(
      hasClassInRange(MON_WED, { from: "2026-10-08", to: "2026-10-11" }),
    ).toBe(false);
  });

  it("is true for a range longer than 7 days whenever any day is set", () => {
    const saturdayOnly = encodeDias(["sabado"]);
    expect(
      hasClassInRange(saturdayOnly, { from: "2026-09-01", to: "2026-12-31" }),
    ).toBe(true);
  });

  it("wraps over a week boundary (Sunday then Monday)", () => {
    expect(
      hasClassInRange(encodeDias(["lunes"]), {
        from: "2026-10-11",
        to: "2026-10-12",
      }),
    ).toBe(true);
  });

  it("treats mask 0 (days not recorded) as having class, never hiding a subject", () => {
    expect(hasClassInRange(0, { from: "2026-10-06", to: "2026-10-06" })).toBe(
      true,
    );
  });

  it("crosses a month boundary", () => {
    expect(
      hasClassInRange(encodeDias(["sabado"]), {
        from: "2026-10-30",
        to: "2026-11-01",
      }),
    ).toBe(true);
  });
});
