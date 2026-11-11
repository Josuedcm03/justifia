import { describe, expect, it } from "vitest";

import { admitsRest, CAUSAS, CAUSAS_CON_REPOSO, isCausa } from "./causes";

describe("CAUSAS (RN-01)", () => {
  it("lists exactly five distinct codes", () => {
    expect(CAUSAS).toHaveLength(5);
    expect(new Set(CAUSAS).size).toBe(5);
  });

  it("keeps every code within the Causa varchar(30) column", () => {
    for (const causa of CAUSAS) {
      expect(causa.length).toBeLessThanOrEqual(30);
    }
  });
});

describe("isCausa", () => {
  it("accepts each of the five codes", () => {
    for (const causa of CAUSAS) {
      expect(isCausa(causa)).toBe(true);
    }
  });

  it("rejects a cause outside the list, empty, and non-strings", () => {
    expect(isCausa("vacaciones")).toBe(false);
    expect(isCausa("")).toBe(false);
    expect(isCausa(null)).toBe(false);
    expect(isCausa(undefined)).toBe(false);
    expect(isCausa(3)).toBe(false);
  });
});

describe("CAUSAS_CON_REPOSO (RN-09, RN-10)", () => {
  it("holds exactly the medical and the maternity or paternity causes", () => {
    expect([...CAUSAS_CON_REPOSO].sort()).toEqual([
      "maternidad_paternidad",
      "medica",
    ]);
  });

  it("is a subset of the five causes of RN-01", () => {
    for (const causa of CAUSAS_CON_REPOSO) {
      expect(isCausa(causa)).toBe(true);
    }
  });
});

describe("admitsRest", () => {
  it.each(["medica", "maternidad_paternidad"] as const)(
    "is true for %s",
    (causa) => {
      expect(admitsRest(causa)).toBe(true);
    },
  );

  it.each([
    "actividad_representativa",
    "intercambio_academico",
    "fuerza_mayor",
  ] as const)("is false for %s", (causa) => {
    expect(admitsRest(causa)).toBe(false);
  });

  it("agrees with CAUSAS_CON_REPOSO for every cause", () => {
    for (const causa of CAUSAS) {
      expect(admitsRest(causa)).toBe(
        (CAUSAS_CON_REPOSO as readonly string[]).includes(causa),
      );
    }
  });
});
