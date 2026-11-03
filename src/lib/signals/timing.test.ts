import { describe, expect, it } from "vitest";

import { constantCalendar } from "@/lib/intake/adapters/constant-calendar";

import { evaluateLatePresentation } from "./timing";

// validation-signals: "Late presentation, RN-07". The calendar below lists one
// weekend day per year, so it covers 2026 and 2027 and has no weekday holiday.
const calendar = constantCalendar({
  2026: ["2026-12-26"],
  2027: ["2027-12-25"],
});

// Managua is UTC-6 all year, so 15:00Z is 09:00 there.
const at = (iso: string) => new Date(`${iso}T15:00:00Z`);

describe("evaluateLatePresentation boundary dates", () => {
  it.each([
    ["Fri 2026-10-09", "2026-10-13", "absent"],
    ["Fri 2026-10-09", "2026-10-14", "present"],
    ["Fri 2026-10-09", "2026-10-12", "absent"],
    ["Sat 2026-10-10", "2026-10-13", "absent"],
    ["Sat 2026-10-10", "2026-10-14", "present"],
  ] as const)("fechaFin %s presented %s is %s", (end, presented, outcome) => {
    const result = evaluateLatePresentation(
      { absenceTo: end.slice(-10), presentedAt: at(presented) },
      calendar,
    );

    expect(result.signal).toBe("rn07");
    expect(result.outcome).toBe(outcome);
    expect(result).toMatchObject({
      evidence: { presented, deadline: "2026-10-13" },
    });
  });

  it("uses the Managua date, not the UTC date", () => {
    // 03:00Z on the 14th is Tuesday 21:00 on the 13th in Managua.
    const result = evaluateLatePresentation(
      {
        absenceTo: "2026-10-09",
        presentedAt: new Date("2026-10-14T03:00:00Z"),
      },
      calendar,
    );

    expect(result.outcome).toBe("absent");
  });

  it("counts the first presentation only: a late resubmission never restarts it", () => {
    // The input has no resubmission time at all, so it cannot be read.
    const late = evaluateLatePresentation(
      { absenceTo: "2026-10-09", presentedAt: at("2026-10-14") },
      calendar,
    );
    const onTime = evaluateLatePresentation(
      { absenceTo: "2026-10-09", presentedAt: at("2026-10-13") },
      calendar,
    );

    expect(late.outcome).toBe("present");
    expect(onTime.outcome).toBe("absent");
  });
});

describe("evaluateLatePresentation calendar coverage", () => {
  it("is not evaluable when the deadline falls in a year the calendar lacks", () => {
    // Thu 2027-12-30: Fri 31st is day 1, Mon 2028-01-03 is day 2.
    const result = evaluateLatePresentation(
      { absenceTo: "2027-12-30", presentedAt: at("2028-01-05") },
      calendar,
    );

    expect(result).toEqual({
      signal: "rn07",
      outcome: "not_evaluable",
      reason: "calendar_not_covering_year",
    });
  });

  it("evaluates normally when the deadline falls in a covered year", () => {
    // Wed 2027-12-29: Thu 30th and Fri 31st, still 2027.
    const result = evaluateLatePresentation(
      { absenceTo: "2027-12-29", presentedAt: at("2027-12-31") },
      calendar,
    );

    expect(result.outcome).toBe("absent");
  });

  it("is not evaluable when the absence ends in a year the calendar lacks", () => {
    const result = evaluateLatePresentation(
      { absenceTo: "2025-06-02", presentedAt: at("2025-06-03") },
      calendar,
    );

    expect(result).toMatchObject({
      outcome: "not_evaluable",
      reason: "calendar_not_covering_year",
    });
  });
});
