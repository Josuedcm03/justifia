import { describe, expect, it } from "vitest";

import {
  addDays,
  earliestAllowedEndDate,
  isEndWithinWindow,
  isIsoDate,
  managuaToday,
} from "./dates";

describe("managuaToday (RN-23, A6)", () => {
  it("crosses UTC midnight: 2026-11-01 02:00 UTC is 2026-10-31 in Managua", () => {
    expect(managuaToday(new Date("2026-11-01T02:00:00Z"))).toBe("2026-10-31");
  });

  it("matches the UTC date when both are already the same day", () => {
    expect(managuaToday(new Date("2026-10-06T15:00:00Z"))).toBe("2026-10-06");
  });

  it("flips to the next day at 06:00 UTC (UTC-6)", () => {
    expect(managuaToday(new Date("2026-10-06T05:59:59Z"))).toBe("2026-10-05");
    expect(managuaToday(new Date("2026-10-06T06:00:00Z"))).toBe("2026-10-06");
  });
});

describe("addDays", () => {
  it("moves across month and year boundaries", () => {
    expect(addDays("2026-10-31", -30)).toBe("2026-10-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
  });
});

describe("earliestAllowedEndDate (RN-23)", () => {
  it("is 30 calendar days before the submission date", () => {
    expect(earliestAllowedEndDate("2026-10-31")).toBe("2026-10-01");
    expect(earliestAllowedEndDate("2026-03-01")).toBe("2026-01-30");
  });
});

describe("isEndWithinWindow table (RN-23)", () => {
  const rows: [string, string, boolean][] = [
    ["2026-10-31", "2026-10-01", true], // exactly 30 days
    ["2026-10-31", "2026-09-30", false], // 31 days
    ["2026-10-06", "2026-10-20", true], // future allowed
    ["2026-10-31", "2026-10-31", true], // today
  ];
  it.each(rows)("today %s, end %s -> %s", (today, end, expected) => {
    expect(isEndWithinWindow(end, today)).toBe(expected);
  });
});

describe("isIsoDate", () => {
  it("accepts real calendar dates", () => {
    expect(isIsoDate("2026-10-31")).toBe(true);
    expect(isIsoDate("2028-02-29")).toBe(true);
  });

  it("rejects malformed and impossible dates", () => {
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("31/10/2026")).toBe(false);
    expect(isIsoDate("")).toBe(false);
    expect(isIsoDate(null)).toBe(false);
  });
});
