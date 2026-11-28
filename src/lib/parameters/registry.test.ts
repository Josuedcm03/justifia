import { describe, expect, it } from "vitest";

import { CAUSAS } from "@/lib/intake/causes";
import { DOCUMENT_TYPE_CAUSES } from "@/lib/signals/document-type-causes";
import { DEFAULT_SIGNAL_PARAMS } from "@/lib/signals/params";

import {
  DEFAULT_PARAMETERS,
  PARAMETER_KEYS,
  PARAMETER_REGISTRY,
  resolveParameters,
  type ParameterKey,
} from "./registry";

// normative-parameters, slice 1: the closed registry (NP-2), the calendar
// (NP-10), the causes (NP-11), the type-to-cause map (NP-12) and the defaults
// as the only fallback (NP-15). Pure: no database, no framework.

function accepts(key: ParameterKey, value: unknown): boolean {
  return PARAMETER_REGISTRY[key].schema.safeParse(value).success;
}

const SCALARS = [
  ["plazo_remision_dias", 1, 10, 2],
  ["alerta_dias", 0, 10, 1],
  ["presentacion_tardia_dias", 1, 10, 2],
  ["ventana_presentacion_dias", 1, 365, 30],
  ["umbral_reincidencia", 2, 20, 3],
  ["tamano_maximo_mib", 1, 10, 10],
] as const satisfies readonly (readonly [
  ParameterKey,
  number,
  number,
  number,
])[];

describe("registry keys (NP-2)", () => {
  it("holds exactly the nine keys of the Reglamento, in a closed list", () => {
    expect([...PARAMETER_KEYS]).toEqual([
      "plazo_remision_dias",
      "alerta_dias",
      "presentacion_tardia_dias",
      "ventana_presentacion_dias",
      "umbral_reincidencia",
      "tamano_maximo_mib",
      "calendario",
      "causas",
      "tipo_documento_causa",
    ]);
    expect(Object.keys(PARAMETER_REGISTRY).sort()).toEqual(
      [...PARAMETER_KEYS].sort(),
    );
  });
});

describe("scalar ranges (NP-2)", () => {
  it.each(SCALARS)(
    "%s accepts %i and %i and refuses the values just outside",
    (key, min, max) => {
      expect(accepts(key, min)).toBe(true);
      expect(accepts(key, max)).toBe(true);
      expect(accepts(key, min - 1)).toBe(false);
      expect(accepts(key, max + 1)).toBe(false);
      expect(PARAMETER_REGISTRY[key].range).toEqual({ min, max });
    },
  );

  it("accepts the whole range of every scalar", () => {
    for (const [key, min, max] of SCALARS) {
      for (let v = min; v <= max; v++) expect(accepts(key, v)).toBe(true);
    }
  });

  it.each([2.5, "2", true, null, undefined, [2], { value: 2 }, NaN, Infinity])(
    "refuses %j: only a JSON integer is a scalar",
    (value) => {
      for (const [key] of SCALARS) expect(accepts(key, value)).toBe(false);
    },
  );
});

describe("defaults (NP-2, NP-15)", () => {
  it.each(SCALARS)(
    "%s defaults to the Reglamento value %i..%i -> %i",
    (key, _min, _max, value) => {
      expect(PARAMETER_REGISTRY[key].default).toBe(value);
    },
  );

  it("every default passes its own schema and parses to itself", () => {
    for (const key of PARAMETER_KEYS) {
      const entry = PARAMETER_REGISTRY[key];
      const parsed = entry.schema.safeParse(entry.default);
      expect(parsed.success, `${key} default`).toBe(true);
      expect(parsed.data).toEqual(entry.default);
    }
  });

  it("the recurrence threshold is the one of DEFAULT_SIGNAL_PARAMS", () => {
    expect(PARAMETER_REGISTRY.umbral_reincidencia.default).toBe(
      DEFAULT_SIGNAL_PARAMS.issuerRecurrenceThreshold,
    );
    expect(DEFAULT_PARAMETERS.issuerRecurrenceThreshold).toBe(
      DEFAULT_SIGNAL_PARAMS.issuerRecurrenceThreshold,
    );
  });

  it("the type-to-cause map is DOCUMENT_TYPE_CAUSES", () => {
    expect(PARAMETER_REGISTRY.tipo_documento_causa.default).toEqual(
      DOCUMENT_TYPE_CAUSES,
    );
    expect(DEFAULT_PARAMETERS.documentTypeCauses).toEqual(DOCUMENT_TYPE_CAUSES);
  });

  it("the causes default to the five of RN-01, active, in the CAUSAS order", () => {
    expect(DEFAULT_PARAMETERS.causes).toEqual(
      CAUSAS.map((codigo, index) => ({
        codigo,
        activa: true,
        posicion: index + 1,
      })),
    );
    expect(PARAMETER_REGISTRY.causas.default).toEqual(
      DEFAULT_PARAMETERS.causes,
    );
  });

  it("DEFAULT_PARAMETERS carries each key default under its field", () => {
    for (const key of PARAMETER_KEYS) {
      const { field, default: value } = PARAMETER_REGISTRY[key];
      expect(DEFAULT_PARAMETERS[field], key).toEqual(value);
    }
  });
});

// The 30 dates and descriptions of the former constant calendar (validated by
// the owner on 2026-10-12), pinned literally so a drift is a visible edit.
const DEFAULT_CALENDAR = [
  ["2026-01-01", "Anio Nuevo"],
  ["2026-03-30", "Semana Santa"],
  ["2026-03-31", "Semana Santa"],
  ["2026-04-01", "Semana Santa"],
  ["2026-04-02", "Semana Santa"],
  ["2026-04-03", "Semana Santa"],
  ["2026-05-01", "Dia del Trabajo"],
  ["2026-05-30", "Dia de las Madres"],
  ["2026-07-19", "Dia de la Revolucion"],
  ["2026-08-01", "Santo Domingo, bajada (Managua)"],
  ["2026-08-10", "Santo Domingo, subida (Managua)"],
  ["2026-09-14", "Batalla de San Jacinto"],
  ["2026-09-15", "Independencia"],
  ["2026-12-08", "Inmaculada Concepcion"],
  ["2026-12-25", "Navidad"],
  ["2027-01-01", "Anio Nuevo"],
  ["2027-03-22", "Semana Santa"],
  ["2027-03-23", "Semana Santa"],
  ["2027-03-24", "Semana Santa"],
  ["2027-03-25", "Semana Santa"],
  ["2027-03-26", "Semana Santa"],
  ["2027-05-01", "Dia del Trabajo"],
  ["2027-05-30", "Dia de las Madres"],
  ["2027-07-19", "Dia de la Revolucion"],
  ["2027-08-01", "Santo Domingo, bajada (Managua)"],
  ["2027-08-10", "Santo Domingo, subida (Managua)"],
  ["2027-09-14", "Batalla de San Jacinto"],
  ["2027-09-15", "Independencia"],
  ["2027-12-08", "Inmaculada Concepcion"],
  ["2027-12-25", "Navidad"],
] as const;

describe("calendar (NP-10)", () => {
  const entry = (fecha: string, descripcion: string | null = null) => ({
    fecha,
    descripcion,
  });

  it("defaults to the 30 dates of 2026 and 2027 with their descriptions", () => {
    expect(PARAMETER_REGISTRY.calendario.default).toEqual(
      DEFAULT_CALENDAR.map(([fecha, descripcion]) => ({ fecha, descripcion })),
    );
    expect(DEFAULT_PARAMETERS.nonWorkingDays).toHaveLength(30);
  });

  it.each([
    ["2026-02-30", [entry("2026-02-30")]],
    ["2026-13-01", [entry("2026-13-01")]],
    ["a non-date text", [entry("tomorrow")]],
    ["a date with time", [entry("2026-03-01T00:00:00Z")]],
    ["the same date twice", [entry("2026-03-01"), entry("2026-03-01", "x")]],
    ["a description of 121 characters", [entry("2026-03-01", "x".repeat(121))]],
    ["a blank description", [entry("2026-03-01", "   ")]],
    ["an unknown field", [{ fecha: "2026-03-01", descripcion: null, x: 1 }]],
    ["a missing description field", [{ fecha: "2026-03-01" }]],
    ["an entry that is not an object", ["2026-03-01"]],
    ["a value that is not a list", { fecha: "2026-03-01" }],
  ])("refuses %s", (_label, value) => {
    expect(accepts("calendario", value)).toBe(false);
  });

  it("keeps a null description and a description of 120 characters", () => {
    const value = [entry("2026-03-01"), entry("2026-03-02", "x".repeat(120))];
    const parsed = PARAMETER_REGISTRY.calendario.schema.safeParse(value);
    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual(value);
  });

  it("trims the description it keeps", () => {
    const parsed = PARAMETER_REGISTRY.calendario.schema.safeParse([
      entry("2026-03-01", "  Dia libre  "),
    ]);
    expect(parsed.data).toEqual([entry("2026-03-01", "Dia libre")]);
  });

  it("accepts an empty list", () => {
    expect(accepts("calendario", [])).toBe(true);
  });

  it("bounds the input at 1000 entries", () => {
    const dates = (count: number) =>
      Array.from({ length: count }, (_, i) =>
        entry(new Date(Date.UTC(2000, 0, 1 + i)).toISOString().slice(0, 10)),
      );
    expect(accepts("calendario", dates(1000))).toBe(true);
    expect(accepts("calendario", dates(1001))).toBe(false);
  });

  it("stores the list ascending by date", () => {
    const parsed = PARAMETER_REGISTRY.calendario.schema.safeParse([
      entry("2026-12-25", "Navidad"),
      entry("2026-01-01"),
      entry("2025-06-30"),
    ]);
    expect(parsed.data).toEqual([
      entry("2025-06-30"),
      entry("2026-01-01"),
      entry("2026-12-25", "Navidad"),
    ]);
  });
});

describe("causes (NP-11)", () => {
  const cause = (codigo: string, posicion: number, activa = true) => ({
    codigo,
    activa,
    posicion,
  });
  const five = (active: readonly boolean[] = [true, true, true, true, true]) =>
    CAUSAS.map((codigo, index) => cause(codigo, index + 1, active[index]));

  it("accepts the five codes, all active, in the default order", () => {
    expect(accepts("causas", five())).toBe(true);
  });

  it("accepts the five codes in any order and stores them by position", () => {
    const reversed = [...CAUSAS]
      .reverse()
      .map((codigo, index) => cause(codigo, index + 1));
    const shuffled = [
      reversed[3],
      reversed[0],
      reversed[4],
      reversed[2],
      reversed[1],
    ];
    const parsed = PARAMETER_REGISTRY.causas.schema.safeParse(shuffled);
    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual(reversed);
  });

  it("accepts four active and one inactive", () => {
    expect(accepts("causas", five([true, true, true, false, true]))).toBe(true);
  });

  it("accepts a single active cause", () => {
    expect(accepts("causas", five([false, false, true, false, false]))).toBe(
      true,
    );
  });

  it.each([
    ["all five inactive", five([false, false, false, false, false])],
    ["a sixth code", [...five(), cause("otra", 6)]],
    [
      "a code outside the five in place of one",
      [...five().slice(0, 4), cause("inventada", 5)],
    ],
    [
      "a code repeated and another omitted",
      [...five().slice(0, 4), cause("maternidad_paternidad", 5)],
    ],
    ["a code omitted", five().slice(0, 4)],
    ["an empty list", []],
    [
      "positions with a repeat",
      CAUSAS.map((codigo, i) => cause(codigo, i === 4 ? 4 : i + 1)),
    ],
    ["positions starting at zero", CAUSAS.map((codigo, i) => cause(codigo, i))],
    [
      "a position above five",
      CAUSAS.map((codigo, i) => cause(codigo, i === 4 ? 6 : i + 1)),
    ],
    [
      "a position that is not an integer",
      CAUSAS.map((codigo, i) => cause(codigo, i === 0 ? 1.5 : i + 1)),
    ],
    [
      "an active flag that is not a boolean",
      CAUSAS.map((codigo, i) => ({ ...cause(codigo, i + 1), activa: "si" })),
    ],
    [
      "an unknown field",
      CAUSAS.map((codigo, i) => ({ ...cause(codigo, i + 1), etiqueta: "x" })),
    ],
  ])("refuses %s", (_label, value) => {
    expect(accepts("causas", value)).toBe(false);
  });
});

describe("type-to-cause map (NP-12)", () => {
  const base = () => ({
    constancia_medica: ["medica", "maternidad_paternidad"],
    constancia_institucional: [
      "actividad_representativa",
      "intercambio_academico",
      "fuerza_mayor",
    ],
    otro: [] as string[],
  });

  it("accepts the default", () => {
    expect(accepts("tipo_documento_causa", base())).toBe(true);
  });

  it("accepts a type also mapped to another cause", () => {
    const value = base();
    value.constancia_medica.push("fuerza_mayor");
    expect(accepts("tipo_documento_causa", value)).toBe(true);
  });

  it("accepts a type mapped to no cause other than otro", () => {
    const value = { ...base(), constancia_institucional: [] };
    expect(accepts("tipo_documento_causa", value)).toBe(true);
  });

  it.each([
    ["otro mapped to a cause", { ...base(), otro: ["medica"] }],
    [
      "a sixth cause code in a set",
      { ...base(), constancia_medica: ["medica", "inventada"] },
    ],
    ["the type recibo", { ...base(), recibo: ["medica"] }],
    [
      "a type missing from the value",
      { constancia_medica: base().constancia_medica, otro: [] },
    ],
    [
      "a cause repeated in one set",
      { ...base(), constancia_medica: ["medica", "medica"] },
    ],
    ["a set that is not a list", { ...base(), constancia_medica: "medica" }],
    ["a value that is not an object", [base()]],
    ["null", null],
  ])("refuses %s", (_label, value) => {
    expect(accepts("tipo_documento_causa", value)).toBe(false);
  });

  it("allows a cause to be mapped by two types", () => {
    const value = {
      ...base(),
      constancia_institucional: ["medica", "fuerza_mayor"],
    };
    expect(accepts("tipo_documento_causa", value)).toBe(true);
  });
});

describe("resolveParameters (NP-2, NP-4 pure part)", () => {
  const VALID: Record<ParameterKey, unknown> = {
    plazo_remision_dias: 5,
    alerta_dias: 3,
    presentacion_tardia_dias: 4,
    ventana_presentacion_dias: 60,
    umbral_reincidencia: 7,
    tamano_maximo_mib: 7,
    calendario: [{ fecha: "2030-01-01", descripcion: null }],
    causas: [
      { codigo: "fuerza_mayor", activa: true, posicion: 1 },
      { codigo: "medica", activa: false, posicion: 2 },
      { codigo: "intercambio_academico", activa: true, posicion: 3 },
      { codigo: "actividad_representativa", activa: true, posicion: 4 },
      { codigo: "maternidad_paternidad", activa: true, posicion: 5 },
    ],
    tipo_documento_causa: {
      constancia_medica: ["medica"],
      constancia_institucional: ["fuerza_mayor"],
      otro: [],
    },
  };
  const rowsOf = (overrides: Partial<Record<ParameterKey, unknown>> = {}) =>
    PARAMETER_KEYS.map((clave) => ({
      clave,
      valor: clave in overrides ? overrides[clave] : VALID[clave],
    }));

  it("returns every default and every key as fallback when there are no rows", () => {
    const { values, fallback } = resolveParameters([]);
    expect(values).toEqual(DEFAULT_PARAMETERS);
    expect([...fallback]).toEqual([...PARAMETER_KEYS]);
  });

  it("returns the stored values with an empty fallback when every row is valid", () => {
    const { values, fallback } = resolveParameters(rowsOf());
    expect(fallback).toEqual([]);
    expect(values.remissionBusinessDays).toBe(5);
    expect(values.alertBusinessDays).toBe(3);
    expect(values.lateFilingBusinessDays).toBe(4);
    expect(values.filingWindowDays).toBe(60);
    expect(values.issuerRecurrenceThreshold).toBe(7);
    expect(values.maxDocumentMib).toBe(7);
    expect(values.nonWorkingDays).toEqual(VALID.calendario);
    expect(values.causes.map((c) => c.codigo)).toEqual(
      (VALID.causas as { codigo: string }[]).map((c) => c.codigo),
    );
    expect(values.documentTypeCauses).toEqual(VALID.tipo_documento_causa);
  });

  it("ignores a key outside the registry", () => {
    const { values, fallback } = resolveParameters([
      ...rowsOf(),
      { clave: "inventada", valor: 1 },
      { clave: "otra_cosa", valor: "x" },
    ]);
    expect(fallback).toEqual([]);
    expect(Object.keys(values).sort()).toEqual(
      Object.keys(DEFAULT_PARAMETERS).sort(),
    );
  });

  it("takes the default of a missing key and lists it as fallback, leaving the rest", () => {
    const rows = rowsOf().filter((r) => r.clave !== "alerta_dias");
    const { values, fallback } = resolveParameters(rows);
    expect(values.alertBusinessDays).toBe(1);
    expect(values.remissionBusinessDays).toBe(5);
    expect([...fallback]).toEqual(["alerta_dias"]);
  });

  it.each([
    ["tamano_maximo_mib", 99],
    ["umbral_reincidencia", "3"],
    ["plazo_remision_dias", null],
    ["ventana_presentacion_dias", 2.5],
    ["calendario", [{ fecha: "2026-02-30", descripcion: null }]],
    ["causas", []],
    ["tipo_documento_causa", { otro: ["medica"] }],
  ] as const)(
    "an invalid %s (%j) takes its own default and changes no other key",
    (key, invalid) => {
      const { values, fallback } = resolveParameters(
        rowsOf({ [key]: invalid }),
      );
      const field = PARAMETER_REGISTRY[key].field;
      expect(values[field]).toEqual(PARAMETER_REGISTRY[key].default);
      expect([...fallback]).toEqual([key]);
      const others = PARAMETER_KEYS.filter((k) => k !== key);
      const expected = resolveParameters(rowsOf()).values;
      for (const other of others) {
        const otherField = PARAMETER_REGISTRY[other].field;
        expect(values[otherField], other).toEqual(expected[otherField]);
      }
    },
  );

  it("takes the stored calendar and causes in their stored order", () => {
    const { values } = resolveParameters(
      rowsOf({
        calendario: [
          { fecha: "2030-12-25", descripcion: null },
          { fecha: "2030-01-01", descripcion: "x" },
        ],
      }),
    );
    expect(values.nonWorkingDays.map((d) => d.fecha)).toEqual([
      "2030-01-01",
      "2030-12-25",
    ]);
    expect(values.causes.map((c) => c.posicion)).toEqual([1, 2, 3, 4, 5]);
  });
});
