import { describe, expect, it } from "vitest";

import { calendar, NON_WORKING_DAYS } from "./calendar";
import { isIsoDate } from "./dates";

describe("NON_WORKING_DAYS staleness (SR-5, RN-08)", () => {
  // Uses the real clock on purpose: it fails once the calendar is not extended
  // for the current year, so a stale list is noticed before it skews deadlines.
  it("lists at least one non-working day for the current year", () => {
    const year = new Date().getFullYear();
    expect(NON_WORKING_DAYS[year]?.length ?? 0).toBeGreaterThan(0);
    expect(calendar.coversYear(year)).toBe(true);
  });
});

describe("NON_WORKING_DAYS shape", () => {
  it.each(Object.entries(NON_WORKING_DAYS))(
    "%s holds sorted, unique, real ISO dates of its own year",
    (year, days) => {
      for (const day of days) {
        expect(isIsoDate(day)).toBe(true);
        expect(day.startsWith(`${year}-`)).toBe(true);
      }
      expect([...days]).toEqual([...new Set(days)].sort());
    },
  );

  // The UAM academic calendar closes the whole Semana Santa, Monday to Friday
  // before Easter Sunday (5 Apr 2026, 28 Mar 2027).
  it("includes the whole Semana Santa of 2026 and 2027", () => {
    expect(NON_WORKING_DAYS[2026]).toEqual(
      expect.arrayContaining([
        "2026-03-30",
        "2026-03-31",
        "2026-04-01",
        "2026-04-02",
        "2026-04-03",
      ]),
    );
    expect(NON_WORKING_DAYS[2027]).toEqual(
      expect.arrayContaining([
        "2027-03-22",
        "2027-03-23",
        "2027-03-24",
        "2027-03-25",
        "2027-03-26",
      ]),
    );
  });

  it("includes Dia de las Madres, observed by the UAM", () => {
    expect(NON_WORKING_DAYS[2026]).toContain("2026-05-30");
    expect(NON_WORKING_DAYS[2027]).toContain("2027-05-30");
  });
});
