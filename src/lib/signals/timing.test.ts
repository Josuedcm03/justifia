import { describe, expect, it } from "vitest";

import { constantCalendar } from "@/lib/intake/adapters/constant-calendar";

import type { TimingParams } from "@/lib/parameters/derive";

import { evaluateLatePresentation } from "./timing";

// validation-signals: "Late presentation, RN-07". The calendar below lists one
// weekend day per year, so it covers 2026 and 2027 and has no weekday holiday.
const calendar = constantCalendar({
  2026: ["2026-12-26"],
  2027: ["2027-12-25"],
});

// Managua is UTC-6 all year, so 15:00Z is 09:00 there.
const at = (iso: string) => new Date(`${iso}T15:00:00Z`);

// The late-filing days of RN-07 (key `presentacion_tardia_dias`, default 2).
const days = (lateFilingBusinessDays: number): TimingParams => ({
  lateFilingBusinessDays,
});
const TWO_DAYS = days(2);

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
      TWO_DAYS,
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
      TWO_DAYS,
    );

    expect(result.outcome).toBe("absent");
  });

  it("counts the first presentation only: a late resubmission never restarts it", () => {
    // The input has no resubmission time at all, so it cannot be read.
    const late = evaluateLatePresentation(
      { absenceTo: "2026-10-09", presentedAt: at("2026-10-14") },
      calendar,
      TWO_DAYS,
    );
    const onTime = evaluateLatePresentation(
      { absenceTo: "2026-10-09", presentedAt: at("2026-10-13") },
      calendar,
      TWO_DAYS,
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
      TWO_DAYS,
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
      TWO_DAYS,
    );

    expect(result.outcome).toBe("absent");
  });

  it("is not evaluable when the absence ends in a year the calendar lacks", () => {
    const result = evaluateLatePresentation(
      { absenceTo: "2025-06-02", presentedAt: at("2025-06-03") },
      calendar,
      TWO_DAYS,
    );

    expect(result).toMatchObject({
      outcome: "not_evaluable",
      reason: "calendar_not_covering_year",
    });
  });
});

// validation-signals: "Late-filing days change the deadline". `fechaFin` is
// Fri 2026-10-09 and the calendar has no weekday holiday, so the 1st, 2nd and
// 3rd business days after it are Mon 12th, Tue 13th and Wed 14th.
describe("evaluateLatePresentation late-filing days (RN-07)", () => {
  it.each([
    [3, "2026-10-14", "absent", "2026-10-14"],
    [3, "2026-10-15", "present", "2026-10-14"],
    [1, "2026-10-12", "absent", "2026-10-12"],
    [1, "2026-10-13", "present", "2026-10-12"],
    [2, "2026-10-13", "absent", "2026-10-13"],
    [2, "2026-10-14", "present", "2026-10-13"],
  ] as const)(
    "with %i days, a first presentation on %s is %s (deadline %s)",
    (lateDays, presented, outcome, deadline) => {
      const result = evaluateLatePresentation(
        { absenceTo: "2026-10-09", presentedAt: at(presented) },
        calendar,
        days(lateDays),
      );

      expect(result.outcome).toBe(outcome);
      expect(result).toMatchObject({ evidence: { presented, deadline } });
    },
  );

  it("files on the third business day: late with 2 days, on time with 3", () => {
    const input = { absenceTo: "2026-10-09", presentedAt: at("2026-10-14") };

    expect(evaluateLatePresentation(input, calendar, days(2)).outcome).toBe(
      "present",
    );
    expect(evaluateLatePresentation(input, calendar, days(3)).outcome).toBe(
      "absent",
    );
  });

  it("has its own key: only the late-filing days move the deadline", () => {
    // The remission days of RN-08 are not an input of this function at all, so
    // the same filing is judged by the late-filing days alone.
    const wednesday = {
      absenceTo: "2026-10-09",
      presentedAt: at("2026-10-14"),
    };

    expect(
      evaluateLatePresentation(wednesday, calendar, days(2)),
    ).toMatchObject({
      outcome: "present",
      evidence: { deadline: "2026-10-13" },
    });
    expect(
      evaluateLatePresentation(wednesday, calendar, days(3)),
    ).toMatchObject({
      outcome: "absent",
      evidence: { deadline: "2026-10-14" },
    });
  });

  it("moves the deadline past a listed holiday", () => {
    // Tue 2026-10-13 listed as non-working: with 2 days the deadline is Wed 14th.
    const withHoliday = constantCalendar({
      2026: ["2026-10-13"],
      2027: ["2027-12-25"],
    });
    const result = evaluateLatePresentation(
      { absenceTo: "2026-10-09", presentedAt: at("2026-10-14") },
      withHoliday,
      days(2),
    );

    expect(result).toMatchObject({
      outcome: "absent",
      evidence: { deadline: "2026-10-14" },
    });
  });

  it("is not evaluable when a longer deadline reaches a year the calendar lacks", () => {
    // Wed 2027-12-29 with 3 days: Thu 30th, Fri 31st, Mon 2028-01-03.
    const input = { absenceTo: "2027-12-29", presentedAt: at("2028-01-05") };

    expect(evaluateLatePresentation(input, calendar, days(2)).outcome).toBe(
      "present",
    );
    expect(evaluateLatePresentation(input, calendar, days(3))).toEqual({
      signal: "rn07",
      outcome: "not_evaluable",
      reason: "calendar_not_covering_year",
    });
  });
});
