// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

// D10: the sweep runs on the platform scheduler, once a day (the Hobby ceiling).
// D11: functions run next to the database. Neon is in aws-us-east-2 (Ohio),
// whose Vercel counterpart is cle1 (Cleveland).

const CONFIG = resolve(__dirname, "../../../vercel.json");

describe("vercel.json (task 5.5)", () => {
  it("schedules the intake sweep daily at 09:00 UTC (03:00 Managua)", () => {
    expect(existsSync(CONFIG)).toBe(true);
    const config = JSON.parse(readFileSync(CONFIG, "utf8"));
    expect(config.crons).toEqual([
      { path: "/api/cron/intake-sweep", schedule: "0 9 * * *" },
    ]);
  });

  it("pins functions to cle1, next to Neon aws-us-east-2", () => {
    const config = JSON.parse(readFileSync(CONFIG, "utf8"));
    expect(config.regions).toEqual(["cle1"]);
  });
});
