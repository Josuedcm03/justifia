import { describe, expect, it } from "vitest";

import type { GroupScheduleProvider } from "../ports";
import { permissiveSchedule } from "./permissive-schedule";

describe("permissiveSchedule (D5: temporary, every group has class)", () => {
  const provider: GroupScheduleProvider = permissiveSchedule;
  const range = { from: "2026-10-05", to: "2026-10-07" };

  it("returns every requested group id", async () => {
    const result = await provider.groupsWithClass([3, 5, 8], range);
    expect([...result].sort()).toEqual([3, 5, 8]);
  });

  it("ignores the date range", async () => {
    const other = await provider.groupsWithClass([3, 5], {
      from: "2030-01-01",
      to: "2030-01-02",
    });
    expect([...other].sort()).toEqual([3, 5]);
  });

  it("returns an empty set for an empty request", async () => {
    const result = await provider.groupsWithClass([], range);
    expect(result.size).toBe(0);
  });
});
