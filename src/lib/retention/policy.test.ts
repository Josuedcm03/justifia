import { describe, expect, it } from "vitest";

import {
  CANCELLED_HASH,
  CANCELLED_TEXT,
  RETENTION_REASON,
  RETENTION_YEARS,
  SYSTEM_HASH,
  SYSTEM_LOGIN,
  cancelledLogin,
  retentionCutoff,
} from "./policy";

/** The due rule as the data module applies it: anchor <= cutoff (D10). */
function isDue(anchor: string, now: string): boolean {
  return new Date(anchor).getTime() <= retentionCutoff(new Date(now)).getTime();
}

describe("retention constants", () => {
  it("pins the five years, the placeholders, the system actor and the code", () => {
    expect(RETENTION_YEARS).toBe(5);
    expect(CANCELLED_TEXT).toBe("[cancelado]");
    expect(CANCELLED_HASH).toBe("!cancelado");
    expect(SYSTEM_LOGIN).toBe("sistema");
    expect(SYSTEM_HASH).toBe("!sistema-sin-clave");
    expect(RETENTION_REASON).toBe("retencion_5_anios");
  });

  it("builds the cancelled login from the student id", () => {
    expect(cancelledLogin(7)).toBe("cancelado-7");
    expect(cancelledLogin(1042)).toBe("cancelado-1042");
  });
});

describe("retentionCutoff (DR-1)", () => {
  it.each([
    ["2026-03-10T09:00:00Z", "2031-03-10T09:00:00Z", true],
    ["2026-03-10T09:00:00Z", "2031-03-09T09:00:00Z", false],
    ["2028-02-29T00:00:00Z", "2033-02-28T00:00:00Z", false],
    ["2028-02-29T00:00:00Z", "2033-03-01T00:00:00Z", true],
  ])("anchor %s at now %s is due: %s", (anchor, now, due) => {
    expect(isDue(anchor, now)).toBe(due);
  });

  it("treats exactly five years as due and one millisecond less as not due", () => {
    const anchor = "2026-03-10T09:00:00.000Z";
    expect(isDue(anchor, "2031-03-10T09:00:00.000Z")).toBe(true);
    expect(isDue(anchor, "2031-03-10T08:59:59.999Z")).toBe(false);
  });

  it("treats one day less than five years as not due", () => {
    expect(isDue("2026-03-10T09:00:00Z", "2031-03-09T09:00:00Z")).toBe(false);
    expect(isDue("2026-03-10T09:00:00Z", "2031-03-11T09:00:00Z")).toBe(true);
  });

  it("subtracts exactly five UTC years from now", () => {
    expect(retentionCutoff(new Date("2031-03-10T09:15:30.250Z"))).toEqual(
      new Date("2026-03-10T09:15:30.250Z"),
    );
  });

  it("clamps a missing Feb 29 cutoff to Feb 28 at the same time of day", () => {
    const cutoff = retentionCutoff(new Date("2032-02-29T09:00:00.000Z"));
    expect(cutoff).toEqual(new Date("2027-02-28T09:00:00.000Z"));
    // The clamped cutoff never makes a student due before five full years.
    expect(isDue("2027-02-28T09:00:00.000Z", "2032-02-29T09:00:00.000Z")).toBe(
      true,
    );
    expect(isDue("2027-02-28T09:00:01.000Z", "2032-02-29T09:00:00.000Z")).toBe(
      false,
    );
  });

  it("keeps the day of month when the cutoff date exists", () => {
    // 2028 is a leap year, but five years before Feb 28 is still Feb 28.
    expect(retentionCutoff(new Date("2033-02-28T12:00:00.000Z"))).toEqual(
      new Date("2028-02-28T12:00:00.000Z"),
    );
    expect(retentionCutoff(new Date("2033-03-01T12:00:00.000Z"))).toEqual(
      new Date("2028-03-01T12:00:00.000Z"),
    );
  });
});
