import { describe, expect, it } from "vitest";

import {
  detailPeriod,
  parseReportParams,
  reportsHref,
  requestsReportHref,
} from "@/lib/reports/params";

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

describe("parseReportParams: docente (CR-6, CR-DET-2)", () => {
  it.each([
    ["1", 1],
    ["42", 42],
    ["9007199254740991", Number.MAX_SAFE_INTEGER],
  ])("reads the plain positive integer %s", (raw, expected) => {
    expect(parseReportParams({ docente: raw }).docenteId).toBe(expected);
  });

  it.each([
    ["zero", "0"],
    ["a negative number", "-1"],
    ["a leading zero", "01"],
    ["a decimal", "1.5"],
    ["an exponent", "1e3"],
    ["a padded value", " 7"],
    ["a number beyond the safe range", "9007199254740993"],
    ["junk", "all"],
    ["an empty value", ""],
    ["a repeated parameter", ["1", "2"]],
  ])("ignores %s", (_name, raw) => {
    expect(parseReportParams({ docente: raw }).docenteId).toBeNull();
  });

  it("is null when the parameter is absent", () => {
    expect(parseReportParams({}).docenteId).toBeNull();
  });
});

describe("parseReportParams: causa (CR-DET-2)", () => {
  it.each(["maternidad_paternidad", "medica", "fuerza_mayor"])(
    "reads the cause %s",
    (causa) => {
      expect(parseReportParams({ causa }).causa).toBe(causa);
    },
  );

  it.each([
    ["a cause outside the five", "vacaciones"],
    ["another case", "Medica"],
    ["a padded value", " medica"],
    ["an empty value", ""],
    ["a repeated parameter", ["medica", "fuerza_mayor"]],
  ])("ignores %s", (_name, raw) => {
    expect(parseReportParams({ causa: raw }).causa).toBeNull();
  });

  it("is null when the parameter is absent", () => {
    expect(parseReportParams({}).causa).toBeNull();
  });
});

describe("parseReportParams: q and page (CR-6)", () => {
  it("trims, collapses whitespace and caps the student term at 100", () => {
    expect(parseReportParams({ q: "  Ana   Lopez " }).q).toBe("Ana Lopez");
    expect(parseReportParams({ q: "x".repeat(150) }).q).toHaveLength(100);
  });

  it("is an empty term when absent or repeated", () => {
    expect(parseReportParams({}).q).toBe("");
    expect(parseReportParams({ q: ["a", "b"] }).q).toBe("");
  });

  it("reads a plain page number and falls back to 1", () => {
    expect(parseReportParams({ page: "3" }).page).toBe(3);
    expect(parseReportParams({ page: "0" }).page).toBe(1);
    expect(parseReportParams({ page: "x" }).page).toBe(1);
    expect(parseReportParams({}).page).toBe(1);
  });
});

describe("detailPeriod (CR-DET-2: no hidden default)", () => {
  it("turns the dashboard default into every period", () => {
    expect(detailPeriod({ kind: "latest" })).toEqual({ kind: "all" });
    expect(parseReportParams({}).period).toEqual({ kind: "latest" });
    expect(
      detailPeriod(parseReportParams({ period: "2026-S9" }).period),
    ).toEqual({ kind: "all" });
  });

  it("keeps a chosen period and every period as they are", () => {
    expect(detailPeriod({ kind: "all" })).toEqual({ kind: "all" });
    expect(detailPeriod({ kind: "code", periodo: "2026-S1" })).toEqual({
      kind: "code",
      periodo: "2026-S1",
    });
  });
});

describe("requestsReportHref (CR-6)", () => {
  const base = {
    period: { kind: "code", periodo: "2026-S1" },
    docenteId: null,
    causa: null,
    q: "",
  } as const;

  it("always carries the resolved period and omits empty filters", () => {
    expect(requestsReportHref(base)).toBe("/reports/requests?period=2026-S1");
    expect(requestsReportHref({ ...base, period: { kind: "all" } })).toBe(
      "/reports/requests?period=all",
    );
  });

  it("carries every active filter and the page above 1", () => {
    expect(
      requestsReportHref(
        { ...base, docenteId: 12, causa: "medica", q: "Ana Lopez" },
        3,
      ),
    ).toBe(
      "/reports/requests?q=Ana+Lopez&period=2026-S1&docente=12&causa=medica&page=3",
    );
  });

  it("omits page 1", () => {
    expect(requestsReportHref({ ...base, causa: "fuerza_mayor" }, 1)).toBe(
      "/reports/requests?period=2026-S1&causa=fuerza_mayor",
    );
  });

  it("round-trips through the parser", () => {
    const query = {
      period: { kind: "all" },
      docenteId: 5,
      causa: "intercambio_academico",
      q: "Mora",
    } as const;
    const search = requestsReportHref(query, 2).split("?")[1];
    const raw = Object.fromEntries(new URLSearchParams(search));
    const parsed = parseReportParams(raw);

    expect(parsed).toEqual({ ...query, page: 2 });
  });
});
