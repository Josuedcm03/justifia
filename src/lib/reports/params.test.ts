import { describe, expect, it } from "vitest";

import { parseReportParams, reportsHref } from "@/lib/reports/params";

describe("parseReportParams: period (CR-6, CR-PERIOD-1)", () => {
  it("reads period=all as every period", () => {
    expect(parseReportParams({ period: "all" }).period).toEqual({
      kind: "all",
    });
  });

  it.each(["2026-S1", "2025-S2"])("reads the well-formed code %s", (code) => {
    expect(parseReportParams({ period: code }).period).toEqual({
      kind: "code",
      periodo: code,
    });
  });

  it.each([
    ["an out-of-range semester", "2026-S9"],
    ["a lowercase semester", "2026-s1"],
    ["an empty value", ""],
    ["a padded code", " 2026-S1"],
    ["junk", "everything"],
    ["a repeated parameter", ["2026-S1", "2026-S2"]],
    ["an uppercase ALL", "ALL"],
  ])("falls back to the default for %s", (_name, raw) => {
    expect(parseReportParams({ period: raw }).period).toEqual({
      kind: "latest",
    });
  });

  it("falls back to the default when the parameter is absent", () => {
    expect(parseReportParams({}).period).toEqual({ kind: "latest" });
  });
});

describe("reportsHref (CR-6)", () => {
  it("writes period=<code> for a concrete period", () => {
    expect(reportsHref({ kind: "code", periodo: "2026-S2" })).toBe(
      "/reports?period=2026-S2",
    );
  });

  it("writes period=all for every period", () => {
    expect(reportsHref({ kind: "all" })).toBe("/reports?period=all");
  });

  it("round-trips through the parser", () => {
    for (const period of [
      { kind: "all" },
      { kind: "code", periodo: "2026-S1" },
    ] as const) {
      const query = reportsHref(period).split("?")[1];
      const raw = Object.fromEntries(new URLSearchParams(query));
      expect(parseReportParams(raw).period).toEqual(period);
    }
  });
});
