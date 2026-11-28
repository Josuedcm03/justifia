import { describe, expect, it } from "vitest";

import { CAUSAS } from "@/lib/intake/causes";
import { DOCUMENT_TYPE_CAUSES } from "@/lib/signals/document-type-causes";
import { DEFAULT_SIGNAL_PARAMS } from "@/lib/signals/params";

import {
  activeCausesOf,
  calendarOf,
  deadlineRulesOf,
  filingRulesOf,
  intakeLimitsOf,
  maxDocumentBytesOf,
  signalParamsOf,
  timingParamsOf,
} from "./derive";
import {
  DEFAULT_PARAMETERS,
  type CauseSetting,
  type NormativeParameters,
} from "./registry";

function params(overrides: Partial<NormativeParameters>): NormativeParameters {
  return { ...DEFAULT_PARAMETERS, ...overrides };
}

describe("calendarOf (NP-10, A15)", () => {
  it("answers the default calendar and covers a year only when it holds a date", () => {
    const calendar = calendarOf(DEFAULT_PARAMETERS);

    // 15 dates of 2026 and 15 of 2027 in the default list.
    expect(
      DEFAULT_PARAMETERS.nonWorkingDays.filter((d) =>
        d.fecha.startsWith("2026"),
      ),
    ).toHaveLength(15);
    expect(
      DEFAULT_PARAMETERS.nonWorkingDays.filter((d) =>
        d.fecha.startsWith("2027"),
      ),
    ).toHaveLength(15);
    expect(calendar.coversYear(2026)).toBe(true);
    expect(calendar.coversYear(2027)).toBe(true);
    expect(calendar.coversYear(2028)).toBe(false);
    expect(calendar.isNonWorkingDay("2026-05-01")).toBe(true);
    expect(calendar.isNonWorkingDay("2027-12-25")).toBe(true);
    expect(calendar.isNonWorkingDay("2026-05-04")).toBe(false);
    expect(calendar.isNonWorkingDay("2028-01-01")).toBe(false);
  });

  it("groups whatever list it is given by year", () => {
    const calendar = calendarOf(
      params({
        nonWorkingDays: [
          { fecha: "2028-01-01", descripcion: null },
          { fecha: "2028-03-02", descripcion: "Local" },
        ],
      }),
    );

    expect(calendar.coversYear(2028)).toBe(true);
    expect(calendar.coversYear(2026)).toBe(false);
    expect(calendar.isNonWorkingDay("2028-03-02")).toBe(true);
    expect(calendar.isNonWorkingDay("2028-03-03")).toBe(false);
  });

  it("covers no year when the list is empty", () => {
    const calendar = calendarOf(params({ nonWorkingDays: [] }));

    expect(calendar.coversYear(2026)).toBe(false);
    expect(calendar.isNonWorkingDay("2026-05-01")).toBe(false);
  });
});

describe("deadlineRulesOf, timingParamsOf (RN-08, RN-07)", () => {
  it("holds the remission and alert days at the defaults", () => {
    expect(deadlineRulesOf(DEFAULT_PARAMETERS)).toEqual({
      remissionBusinessDays: 2,
      alertBusinessDays: 1,
    });
    expect(timingParamsOf(DEFAULT_PARAMETERS)).toEqual({
      lateFilingBusinessDays: 2,
    });
  });

  it("follows the values it is given and nothing else", () => {
    const changed = params({
      remissionBusinessDays: 5,
      alertBusinessDays: 0,
      lateFilingBusinessDays: 4,
    });

    expect(deadlineRulesOf(changed)).toEqual({
      remissionBusinessDays: 5,
      alertBusinessDays: 0,
    });
    expect(timingParamsOf(changed)).toEqual({ lateFilingBusinessDays: 4 });
  });
});

describe("signalParamsOf (RN-13, RN-14, A10)", () => {
  it("equals DEFAULT_SIGNAL_PARAMS at the defaults, with the same shape", () => {
    const derived = signalParamsOf(DEFAULT_PARAMETERS);

    expect(derived).toEqual(DEFAULT_SIGNAL_PARAMS);
    expect(Object.keys(derived).sort()).toEqual(
      Object.keys(DEFAULT_SIGNAL_PARAMS).sort(),
    );
  });

  it("carries the threshold and the map it is given", () => {
    const map: NormativeParameters["documentTypeCauses"] = {
      ...DOCUMENT_TYPE_CAUSES,
      constancia_medica: ["medica"],
    };
    const derived = signalParamsOf(
      params({ issuerRecurrenceThreshold: 7, documentTypeCauses: map }),
    );

    expect(derived.issuerRecurrenceThreshold).toBe(7);
    expect(derived.documentTypeCauses).toEqual(map);
    expect(Object.keys(derived)).toHaveLength(2);
  });
});

describe("activeCausesOf, filingRulesOf (RN-01, RN-23, NP-11)", () => {
  const cause = (
    codigo: CauseSetting["codigo"],
    activa: boolean,
    posicion: number,
  ): CauseSetting => ({ codigo, activa, posicion });

  it("lists the five causes at the defaults", () => {
    expect(activeCausesOf(DEFAULT_PARAMETERS)).toEqual([...CAUSAS]);
  });

  it("keeps the stored order and omits an inactive cause", () => {
    const reordered = params({
      causes: [
        cause("fuerza_mayor", true, 1),
        cause("medica", false, 2),
        cause("intercambio_academico", true, 3),
        cause("maternidad_paternidad", false, 4),
        cause("actividad_representativa", true, 5),
      ],
    });

    expect(activeCausesOf(reordered)).toEqual([
      "fuerza_mayor",
      "intercambio_academico",
      "actividad_representativa",
    ]);
  });

  it("gives the window and the selectable causes together", () => {
    expect(filingRulesOf(DEFAULT_PARAMETERS)).toEqual({
      windowDays: 30,
      selectableCauses: [...CAUSAS],
    });

    const changed = params({
      filingWindowDays: 10,
      causes: [
        cause("medica", true, 1),
        cause("fuerza_mayor", false, 2),
        cause("maternidad_paternidad", false, 3),
        cause("actividad_representativa", false, 4),
        cause("intercambio_academico", false, 5),
      ],
    });
    expect(filingRulesOf(changed)).toEqual({
      windowDays: 10,
      selectableCauses: ["medica"],
    });
  });
});

describe("maxDocumentBytesOf, intakeLimitsOf (RN-04, RN-23)", () => {
  it("multiplies MiB by 1048576", () => {
    expect(maxDocumentBytesOf(DEFAULT_PARAMETERS)).toBe(10_485_760);
    expect(maxDocumentBytesOf(params({ maxDocumentMib: 1 }))).toBe(1_048_576);
    expect(maxDocumentBytesOf(params({ maxDocumentMib: 10 }))).toBe(10_485_760);
  });

  it("gives the two values the client needs and nothing else", () => {
    expect(intakeLimitsOf(DEFAULT_PARAMETERS)).toEqual({
      filingWindowDays: 30,
      maxDocumentMib: 10,
    });
    expect(
      intakeLimitsOf(params({ filingWindowDays: 45, maxDocumentMib: 3 })),
    ).toEqual({ filingWindowDays: 45, maxDocumentMib: 3 });
  });
});
