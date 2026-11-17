import { describe, expect, it } from "vitest";

import {
  addBusinessDays,
  countBusinessDays,
  deadlineOf,
  deadlineStatus,
} from "./business-days";
import { managuaToday } from "./dates";
import type { NonWorkingDaysProvider } from "./ports";

function calendar(
  days: readonly string[] = [],
  covered = true,
): NonWorkingDaysProvider {
  return {
    isNonWorkingDay: (iso) => days.includes(iso),
    coversYear: () => covered,
  };
}

// 2026-10-05 is a Monday.
const MON = "2026-10-05";
const TUE = "2026-10-06";
const WED = "2026-10-07";
const THU = "2026-10-08";
const FRI = "2026-10-09";
const SAT = "2026-10-10";
const SUN = "2026-10-11";
const NEXT_MON = "2026-10-12";
const NEXT_TUE = "2026-10-13";
const NEXT_WED = "2026-10-14";

describe("deadlineOf (RN-08, SR-5)", () => {
  it.each([
    ["Mon", MON, WED],
    ["Tue", TUE, THU],
    ["Wed", WED, FRI],
    ["Thu", THU, NEXT_MON],
    ["Fri", FRI, NEXT_TUE],
    ["Sat", SAT, NEXT_TUE],
    ["Sun", SUN, NEXT_TUE],
  ])("started %s: due the 2nd business day after", (_day, start, due) => {
    expect(deadlineOf(start, calendar())).toBe(due);
  });

  it("skips a holiday inside the span", () => {
    expect(deadlineOf(MON, calendar([TUE]))).toBe(THU);
  });

  it("skips a holiday on the first business day after a weekend start", () => {
    expect(deadlineOf(SAT, calendar([NEXT_MON]))).toBe(NEXT_WED);
  });

  it("counts a holiday start from the next business day", () => {
    expect(deadlineOf(MON, calendar([MON]))).toBe(WED);
  });

  it("crosses the year edge", () => {
    // 2026-12-30 is a Wednesday; 2027-01-01 (Friday) is a holiday.
    expect(deadlineOf("2026-12-30", calendar(["2027-01-01"]))).toBe(
      "2027-01-04",
    );
  });

  it("still computes, weekends only, when the year is not covered", () => {
    expect(deadlineOf(FRI, calendar([], false))).toBe(NEXT_TUE);
  });

  it("uses the Managua date, not UTC (2026-10-12 02:00 UTC is Sunday)", () => {
    const start = managuaToday(new Date("2026-10-12T02:00:00Z"));
    expect(start).toBe(SUN);
    expect(deadlineOf(start, calendar())).toBe(NEXT_TUE);
  });
});

describe("deadlineStatus boundary table (RF-06 b)", () => {
  const rows: [
    string,
    string,
    string,
    "en_plazo" | "por_vencer" | "vencida",
  ][] = [
    ["Mon", MON, MON, "en_plazo"],
    ["Mon", MON, TUE, "por_vencer"],
    ["Mon", MON, WED, "por_vencer"],
    ["Mon", MON, THU, "vencida"],
    ["Fri", FRI, NEXT_MON, "por_vencer"],
    ["Sat", SAT, NEXT_MON, "por_vencer"],
    ["Sat", SAT, NEXT_TUE, "por_vencer"],
    ["Sat", SAT, NEXT_WED, "vencida"],
  ];

  it.each(rows)(
    "presented %s %s, today %s -> %s",
    (_d, start, today, status) => {
      expect(deadlineStatus(start, today, calendar()).status).toBe(status);
    },
  );

  it("returns the deadline with the status", () => {
    expect(deadlineStatus(MON, MON, calendar())).toEqual({
      status: "en_plazo",
      deadline: WED,
    });
  });

  it("alerts instead of overdue when a holiday pushes the deadline", () => {
    const result = deadlineStatus(MON, WED, calendar([TUE]));
    expect(result).toEqual({ status: "por_vencer", deadline: THU });
  });

  it("is not overdue on the due day itself, and is the day after", () => {
    expect(deadlineStatus(MON, WED, calendar()).status).toBe("por_vencer");
    expect(deadlineStatus(MON, THU, calendar()).status).toBe("vencida");
  });

  it("is overdue across a long gap", () => {
    expect(deadlineStatus(MON, "2026-11-30", calendar()).status).toBe(
      "vencida",
    );
  });

  it("still computes when the year is not covered", () => {
    expect(deadlineStatus(MON, TUE, calendar([], false)).status).toBe(
      "por_vencer",
    );
  });
});

describe("countBusinessDays (ES-5, RN-08)", () => {
  it.each([
    ["Mon to Thu", MON, THU, 3],
    ["same day", MON, MON, 0],
    ["Tue to the next Mon", TUE, NEXT_MON, 4],
    ["Mon to Tue", MON, TUE, 1],
    ["Fri to the next Mon", FRI, NEXT_MON, 1],
    ["Sat to the next Mon", SAT, NEXT_MON, 0],
  ])("%s counts E <= d < A", (_label, from, to, expected) => {
    expect(countBusinessDays(from, to, calendar())).toBe(expected);
  });

  it("excludes a holiday inside the span", () => {
    expect(countBusinessDays(MON, THU, calendar([TUE]))).toBe(2);
  });

  it("counts the escalation day itself when it is a business day", () => {
    expect(countBusinessDays(WED, THU, calendar())).toBe(1);
    expect(countBusinessDays(WED, THU, calendar([WED]))).toBe(0);
  });

  it("is zero when the answer is before the escalation date", () => {
    expect(countBusinessDays(THU, MON, calendar())).toBe(0);
  });
});

describe("addBusinessDays (ES-5, RN-08)", () => {
  it.each([
    ["1 from Mon", MON, 1, TUE],
    ["3 from Mon", MON, 3, THU],
    ["4 from Tue", TUE, 4, NEXT_MON],
    ["1 from Fri", FRI, 1, NEXT_MON],
    ["1 from Sat", SAT, 1, NEXT_MON],
    ["5 from Mon", MON, 5, NEXT_MON],
  ])("%s is the P-th business day strictly after", (_l, start, p, due) => {
    expect(addBusinessDays(start, p, calendar())).toBe(due);
  });

  it("is the start itself for zero days", () => {
    expect(addBusinessDays(MON, 0, calendar())).toBe(MON);
  });

  it("skips a holiday inside the span", () => {
    expect(addBusinessDays(MON, 2, calendar([TUE]))).toBe(THU);
  });
});
