import { describe, expect, it } from "vitest";

import { constantCalendar } from "./constant-calendar";

const FIXTURE = {
  2030: ["2030-01-01", "2030-04-18"],
  2031: [],
} as const;

describe("constantCalendar (SR-5)", () => {
  const calendar = constantCalendar(FIXTURE);

  it("flags a listed date and not an unlisted one", () => {
    expect(calendar.isNonWorkingDay("2030-01-01")).toBe(true);
    expect(calendar.isNonWorkingDay("2030-01-02")).toBe(false);
  });

  it("does not flag a date of a year without entries", () => {
    expect(calendar.isNonWorkingDay("2029-01-01")).toBe(false);
  });

  it("covers a year only when it lists at least one date", () => {
    expect(calendar.coversYear(2030)).toBe(true);
    expect(calendar.coversYear(2029)).toBe(false);
  });

  it("treats a year with an empty list as not covered", () => {
    expect(calendar.coversYear(2031)).toBe(false);
    expect(calendar.isNonWorkingDay("2031-01-01")).toBe(false);
  });
});
