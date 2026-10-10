import { describe, expect, it, vi } from "vitest";

import { encodeDias } from "@/lib/catalog/dias";

import { createWeekdaySchedule } from "./weekday-schedule";

// 2026-10-05 Monday ... 2026-10-09 Friday, 2026-10-10 Saturday.
const MONDAY = { from: "2026-10-05", to: "2026-10-05" };
const WEEK = { from: "2026-10-05", to: "2026-10-11" };

describe("createWeekdaySchedule (F.4, RN-22)", () => {
  it("keeps the groups whose meeting days touch the range", async () => {
    const load = vi.fn().mockResolvedValue([
      { id: 1, dias: encodeDias(["lunes"]) },
      { id: 2, dias: encodeDias(["martes"]) },
      { id: 3, dias: encodeDias(["lunes", "viernes"]) },
    ]);
    const schedule = createWeekdaySchedule(load);

    const result = await schedule.groupsWithClass([1, 2, 3], MONDAY);

    expect([...result].sort()).toEqual([1, 3]);
    expect(load).toHaveBeenCalledWith([1, 2, 3]);
  });

  it("keeps a group with days not recorded (mask 0)", async () => {
    const schedule = createWeekdaySchedule(async () => [
      { id: 4, dias: 0 },
      { id: 5, dias: encodeDias(["jueves"]) },
    ]);

    const result = await schedule.groupsWithClass([4, 5], MONDAY);

    expect([...result]).toEqual([4]);
  });

  it("keeps every group with any day set when the range covers a week", async () => {
    const schedule = createWeekdaySchedule(async () => [
      { id: 1, dias: encodeDias(["domingo"]) },
      { id: 2, dias: encodeDias(["miercoles"]) },
    ]);

    const result = await schedule.groupsWithClass([1, 2], WEEK);

    expect([...result].sort()).toEqual([1, 2]);
  });

  it("drops requested ids the data layer does not return", async () => {
    const schedule = createWeekdaySchedule(async () => [
      { id: 1, dias: encodeDias(["lunes"]) },
    ]);

    const result = await schedule.groupsWithClass([1, 99], MONDAY);

    expect([...result]).toEqual([1]);
  });

  it("does not read when nothing is requested", async () => {
    const load = vi.fn();
    const schedule = createWeekdaySchedule(load);

    const result = await schedule.groupsWithClass([], MONDAY);

    expect(result.size).toBe(0);
    expect(load).not.toHaveBeenCalled();
  });

  it("propagates a read failure so the submit re-check fails loud", async () => {
    const schedule = createWeekdaySchedule(async () => {
      throw new Error("db down");
    });

    await expect(schedule.groupsWithClass([1], MONDAY)).rejects.toThrow(
      "db down",
    );
  });
});
