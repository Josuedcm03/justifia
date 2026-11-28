import { describe, expect, it } from "vitest";

import type { DeadlineRules } from "@/lib/parameters/derive";

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

/** The Reglamento values: remit in 2 business days, alert at 1 left. */
const DEFAULT_RULES: DeadlineRules = {
  remissionBusinessDays: 2,
  alertBusinessDays: 1,
};

function rules(
  remissionBusinessDays: number,
  alertBusinessDays: number,
): DeadlineRules {
  return { remissionBusinessDays, alertBusinessDays };
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
    expect(deadlineOf(start, calendar(), 2)).toBe(due);
  });

  it("skips a holiday inside the span", () => {
    expect(deadlineOf(MON, calendar([TUE]), 2)).toBe(THU);
  });

  it("skips a holiday on the first business day after a weekend start", () => {
    expect(deadlineOf(SAT, calendar([NEXT_MON]), 2)).toBe(NEXT_WED);
  });

  it("counts a holiday start from the next business day", () => {
    expect(deadlineOf(MON, calendar([MON]), 2)).toBe(WED);
  });

  it("crosses the year edge", () => {
    // 2026-12-30 is a Wednesday; 2027-01-01 (Friday) is a holiday.
    expect(deadlineOf("2026-12-30", calendar(["2027-01-01"]), 2)).toBe(
      "2027-01-04",
    );
  });

  it("still computes, weekends only, when the year is not covered", () => {
    expect(deadlineOf(FRI, calendar([], false), 2)).toBe(NEXT_TUE);
  });

  it("uses the Managua date, not UTC (2026-10-12 02:00 UTC is Sunday)", () => {
    const start = managuaToday(new Date("2026-10-12T02:00:00Z"));
    expect(start).toBe(SUN);
    expect(deadlineOf(start, calendar(), 2)).toBe(NEXT_TUE);
  });
});

describe("deadlineOf takes the remission days as an input (RN-08, RNF-14)", () => {
  it.each([
    ["1 from Mon", MON, 1, TUE],
    ["2 from Mon", MON, 2, WED],
    ["3 from Mon", MON, 3, THU],
    ["3 from Fri", FRI, 3, NEXT_WED],
    ["3 from Sat", SAT, 3, NEXT_WED],
    ["5 from Mon", MON, 5, NEXT_MON],
    ["10 from Mon", MON, 10, "2026-10-19"],
  ])("%s is the N-th business day strictly after", (_l, start, n, due) => {
    expect(deadlineOf(start, calendar(), n)).toBe(due);
  });

  it("skips a holiday inside a longer span", () => {
    expect(deadlineOf(MON, calendar([TUE]), 3)).toBe(FRI);
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
      expect(
        deadlineStatus(start, today, calendar(), DEFAULT_RULES).status,
      ).toBe(status);
    },
  );

  it("returns the deadline with the status", () => {
    expect(deadlineStatus(MON, MON, calendar(), DEFAULT_RULES)).toEqual({
      status: "en_plazo",
      deadline: WED,
    });
  });

  it("alerts instead of overdue when a holiday pushes the deadline", () => {
    const result = deadlineStatus(MON, WED, calendar([TUE]), DEFAULT_RULES);
    expect(result).toEqual({ status: "por_vencer", deadline: THU });
  });

  it("is not overdue on the due day itself, and is the day after", () => {
    expect(deadlineStatus(MON, WED, calendar(), DEFAULT_RULES).status).toBe(
      "por_vencer",
    );
    expect(deadlineStatus(MON, THU, calendar(), DEFAULT_RULES).status).toBe(
      "vencida",
    );
  });

  it("is overdue across a long gap", () => {
    expect(
      deadlineStatus(MON, "2026-11-30", calendar(), DEFAULT_RULES).status,
    ).toBe("vencida");
  });

  it("still computes when the year is not covered", () => {
    expect(
      deadlineStatus(MON, TUE, calendar([], false), DEFAULT_RULES).status,
    ).toBe("por_vencer");
  });
});

type State = "en_plazo" | "por_vencer" | "vencida";

describe("deadlineStatus with other remission days (alert days 1)", () => {
  const table: [number, string, string, string, State][] = [
    [3, "Mon", MON, MON, "en_plazo"],
    [3, "Mon", MON, TUE, "en_plazo"],
    [3, "Mon", MON, WED, "por_vencer"],
    [3, "Mon", MON, THU, "por_vencer"],
    [3, "Mon", MON, FRI, "vencida"],
    [1, "Mon", MON, MON, "por_vencer"],
    [1, "Mon", MON, WED, "vencida"],
  ];

  it.each(table)(
    "remission %d, presented %s, today %s -> %s",
    (days, _d, start, today, state) => {
      expect(
        deadlineStatus(start, today, calendar(), rules(days, 1)).status,
      ).toBe(state);
    },
  );

  it("returns the deadline of the given days with the status", () => {
    expect(deadlineStatus(MON, TUE, calendar(), rules(3, 1))).toEqual({
      status: "en_plazo",
      deadline: THU,
    });
  });
});

describe("deadlineStatus with other alert days (remission days 2, presented Mon)", () => {
  const table: [number, string, State][] = [
    [0, TUE, "en_plazo"],
    [0, WED, "por_vencer"],
    [2, MON, "por_vencer"],
    [2, THU, "vencida"],
    [1, MON, "en_plazo"],
    [1, TUE, "por_vencer"],
  ];

  it.each(table)("alert %d, today %s -> %s", (alert, today, state) => {
    expect(deadlineStatus(MON, today, calendar(), rules(2, alert)).status).toBe(
      state,
    );
  });

  it("counts the alert in business days, not calendar days", () => {
    // Presented Mon, remission 4: deadline Fri. Alert 2 starts on Wed (Thu and
    // Fri left).
    expect(deadlineStatus(MON, TUE, calendar(), rules(4, 2)).status).toBe(
      "en_plazo",
    );
    expect(deadlineStatus(MON, WED, calendar(), rules(4, 2)).status).toBe(
      "por_vencer",
    );
    // Presented Thu, remission 2: deadline next Mon. On Fri one business day
    // is left (the weekend does not count), so alert 1 holds.
    expect(deadlineStatus(THU, THU, calendar(), rules(2, 1)).status).toBe(
      "en_plazo",
    );
    expect(deadlineStatus(THU, FRI, calendar(), rules(2, 1)).status).toBe(
      "por_vencer",
    );
  });
});

describe("the remission-days constant is gone (A12)", () => {
  it("exports no BUSINESS_DAYS_TO_REMIT and requires the days", async () => {
    const days = await import("./business-days");

    expect(Object.keys(days)).not.toContain("BUSINESS_DAYS_TO_REMIT");
    expect(days.deadlineOf.length).toBe(3);
    expect(days.deadlineStatus.length).toBe(4);
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
