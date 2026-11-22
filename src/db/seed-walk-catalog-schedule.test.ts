import { describe, expect, it } from "vitest";

import {
  assertWalkTarget,
  chooseWalkPeriod,
  DEFAULT_WALK_PERIOD,
  previousPeriod,
  walkSeedPassword,
} from "@/db/seed-walk-catalog-schedule";

// Placeholder hosts only: real endpoint ids never appear in the source.
const WALK_HOST = "walk-branch.db.example";
const url = (host: string) =>
  `postgresql://user:pw@${host}/app?sslmode=require`;

describe("assertWalkTarget", () => {
  it("returns the hostname when it equals the expected host exactly", () => {
    expect(
      assertWalkTarget({
        DATABASE_URL: url(WALK_HOST),
        WALK_SEED_EXPECTED_HOST: WALK_HOST,
      }),
    ).toBe(WALK_HOST);
  });

  it.each([
    ["another host", url("main-branch.db.example"), WALK_HOST],
    ["a suffix match", url(`x.${WALK_HOST}`), WALK_HOST],
    ["a prefix of the host", url(WALK_HOST), "walk-branch"],
    ["a different case", url(WALK_HOST), WALK_HOST.toUpperCase()],
    ["surrounding spaces", url(WALK_HOST), ` ${WALK_HOST} `],
  ])("refuses %s", (_label, databaseUrl, expected) => {
    expect(() =>
      assertWalkTarget({
        DATABASE_URL: databaseUrl,
        WALK_SEED_EXPECTED_HOST: expected,
      }),
    ).toThrow(/Refusing to seed/);
  });

  it("refuses when the expected host is missing or empty", () => {
    expect(() => assertWalkTarget({ DATABASE_URL: url(WALK_HOST) })).toThrow(
      /WALK_SEED_EXPECTED_HOST must be set/,
    );
    expect(() =>
      assertWalkTarget({
        DATABASE_URL: url(WALK_HOST),
        WALK_SEED_EXPECTED_HOST: "",
      }),
    ).toThrow(/WALK_SEED_EXPECTED_HOST must be set/);
  });

  it("refuses a missing or invalid DATABASE_URL", () => {
    expect(() =>
      assertWalkTarget({ WALK_SEED_EXPECTED_HOST: WALK_HOST }),
    ).toThrow(/DATABASE_URL must be set/);
    expect(() =>
      assertWalkTarget({
        DATABASE_URL: "not a url",
        WALK_SEED_EXPECTED_HOST: WALK_HOST,
      }),
    ).toThrow(/not a valid URL/);
  });
});

describe("walkSeedPassword", () => {
  it("requires 8 characters or more", () => {
    expect(() => walkSeedPassword({})).toThrow(/SEED_PASSWORD/);
    expect(() => walkSeedPassword({ SEED_PASSWORD: "1234567" })).toThrow(
      /SEED_PASSWORD/,
    );
    expect(walkSeedPassword({ SEED_PASSWORD: "12345678" })).toBe("12345678");
  });
});

describe("periods", () => {
  it("steps back one term", () => {
    expect(previousPeriod("2026-S2")).toBe("2026-S1");
    expect(previousPeriod("2026-S1")).toBe("2025-S2");
    expect(() => previousPeriod("2026-s1")).toThrow(/Invalid period/);
  });

  it("prefers an earlier walk period, then the offered latest, then the default", () => {
    expect(chooseWalkPeriod("2026-S1", "2026-S2")).toBe("2026-S1");
    expect(chooseWalkPeriod(null, "2026-S2")).toBe("2026-S2");
    expect(chooseWalkPeriod(null, null)).toBe(DEFAULT_WALK_PERIOD);
  });
});
