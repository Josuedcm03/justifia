// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

// D10: the sweep runs on the platform scheduler, once a day (the Hobby ceiling).
// `regions` is deliberately absent until the owner confirms the Neon region.

const CONFIG = resolve(__dirname, "../../../vercel.json");

describe("vercel.json (task 5.5)", () => {
  it("schedules the intake sweep daily at 09:00 UTC (03:00 Managua)", () => {
    expect(existsSync(CONFIG)).toBe(true);
    const config = JSON.parse(readFileSync(CONFIG, "utf8"));
    expect(config.crons).toEqual([
      { path: "/api/cron/intake-sweep", schedule: "0 9 * * *" },
    ]);
  });

  it("sets no region yet: it must match Neon, which is not known", () => {
    const config = JSON.parse(readFileSync(CONFIG, "utf8"));
    expect(config).not.toHaveProperty("regions");
  });
});
