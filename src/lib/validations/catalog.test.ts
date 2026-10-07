import { describe, expect, it } from "vitest";

import {
  asignaturaCreateSchema,
  asignaturaUpdateSchema,
  CATALOG_FIELD_ERROR_KEYS,
  grupoCreateSchema,
  grupoUpdateSchema,
  parseRecordId,
} from "@/lib/validations/catalog";

type AnySchema = {
  safeParse: (input: unknown) => {
    success: boolean;
    data?: unknown;
    error?: { issues: { message: string; path: PropertyKey[] }[] };
  };
};

function messages(schema: AnySchema, input: unknown): string[] {
  const result = schema.safeParse(input);
  expect(result.success).toBe(false);
  return result.error!.issues.map((i) => i.message);
}

const validAsignatura = {
  codigo: "MAT101",
  nombre: "Calculo",
  horasTotales: "64",
  carreraId: "7",
};
const validGrupo = {
  asignaturaId: "12",
  periodo: "2026-S1",
  numeroGrupo: "1",
  docenteId: "30",
};

describe("parseRecordId", () => {
  it.each(["1", "9", "123", "999999999999999"])("accepts %s", (raw) => {
    expect(parseRecordId(raw)).toBe(Number(raw));
  });

  it.each([
    ["zero", "0"],
    ["leading zero", "01"],
    ["negative", "-1"],
    ["decimal", "1.5"],
    ["letters", "abc"],
    ["empty", ""],
    ["16 digits", "1000000000000000"],
    ["padded", " 1"],
    ["exponent", "1e3"],
    ["array", ["1"]],
    ["null", null],
    ["undefined", undefined],
    ["a number", 1],
  ])("rejects %s", (_label, raw) => {
    expect(parseRecordId(raw)).toBeNull();
  });
});

describe("asignaturaCreateSchema (CM-ASG-1)", () => {
  it("accepts a valid input and returns typed values", () => {
    const result = asignaturaCreateSchema.safeParse(validAsignatura);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      codigo: "MAT101",
      nombre: "Calculo",
      horasTotales: 64,
      carreraId: 7,
    });
  });

  it('trims " MAT101 " to "MAT101" and leaves "mat101" as it is', () => {
    expect(
      asignaturaCreateSchema.parse({ ...validAsignatura, codigo: " MAT101 " })
        .codigo,
    ).toBe("MAT101");
    expect(
      asignaturaCreateSchema.parse({ ...validAsignatura, codigo: "mat101" })
        .codigo,
    ).toBe("mat101");
  });

  it.each([
    ["Codigo empty", { codigo: "" }, "codigo.required"],
    ["Codigo whitespace", { codigo: "   " }, "codigo.required"],
    ["Codigo missing", { codigo: undefined }, "codigo.required"],
    ["Codigo 33 chars", { codigo: "a".repeat(33) }, "codigo.tooLong"],
    ["Nombre empty", { nombre: "" }, "nombre.required"],
    ["Nombre 161 chars", { nombre: "a".repeat(161) }, "nombre.tooLong"],
    ["Horas empty", { horasTotales: "" }, "horasTotales.required"],
    ["Horas missing", { horasTotales: undefined }, "horasTotales.required"],
    ["Horas 0", { horasTotales: "0" }, "horasTotales.invalid"],
    ["Horas -8", { horasTotales: "-8" }, "horasTotales.invalid"],
    ["Horas 12.5", { horasTotales: "12.5" }, "horasTotales.invalid"],
    ["Horas abc", { horasTotales: "abc" }, "horasTotales.invalid"],
    ["Carrera not numeric", { carreraId: "abc" }, "carreraId.invalid"],
    ["Carrera zero", { carreraId: "0" }, "carreraId.invalid"],
  ])("refuses %s", (_label, override, key) => {
    expect(
      messages(asignaturaCreateSchema, { ...validAsignatura, ...override }),
    ).toContain(key);
  });

  it("accepts 32 and 160 character boundaries", () => {
    expect(
      asignaturaCreateSchema.safeParse({
        ...validAsignatura,
        codigo: "a".repeat(32),
        nombre: "b".repeat(160),
      }).success,
    ).toBe(true);
  });

  it("treats a missing or empty carreraId as absent (a scoped actor omits it)", () => {
    const without: Record<string, string> = { ...validAsignatura };
    delete without.carreraId;
    expect(asignaturaCreateSchema.parse(without).carreraId).toBeUndefined();
    expect(
      asignaturaCreateSchema.parse({ ...validAsignatura, carreraId: "" })
        .carreraId,
    ).toBeUndefined();
  });
});

describe("asignaturaUpdateSchema (CM-ASG-2, AC-CODE)", () => {
  it("has no codigo key in its output even when one is submitted", () => {
    const out = asignaturaUpdateSchema.parse({
      ...validAsignatura,
      codigo: "MAT102",
    });
    expect(out).toEqual({ nombre: "Calculo", horasTotales: 64, carreraId: 7 });
    expect("codigo" in out).toBe(false);
  });

  it("applies the same Nombre and Horas rules and ignores a missing codigo", () => {
    const input: Record<string, string> = { ...validAsignatura };
    delete input.codigo;
    expect(asignaturaUpdateSchema.safeParse(input).success).toBe(true);
    expect(
      messages(asignaturaUpdateSchema, { ...input, nombre: "" }),
    ).toContain("nombre.required");
    expect(
      messages(asignaturaUpdateSchema, { ...input, horasTotales: "0" }),
    ).toContain("horasTotales.invalid");
  });
});

describe("grupoCreateSchema (CM-GRP-1, AC-GRP)", () => {
  it("accepts a valid input and trims numeroGrupo", () => {
    expect(
      grupoCreateSchema.parse({ ...validGrupo, numeroGrupo: " 1 " }),
    ).toEqual({
      asignaturaId: 12,
      periodo: "2026-S1",
      numeroGrupo: "1",
      docenteId: 30,
    });
  });

  it.each(["2026-S2", "1999-S1"])("accepts the period %s", (periodo) => {
    expect(
      grupoCreateSchema.safeParse({ ...validGrupo, periodo }).success,
    ).toBe(true);
  });

  it.each(["2026-S3", "2026-1", "26-S1", "2026S1", "2026-s1", " 2026-S1"])(
    "refuses the period %j",
    (periodo) => {
      expect(messages(grupoCreateSchema, { ...validGrupo, periodo })).toContain(
        "periodo.invalid",
      );
    },
  );

  it("refuses an empty period as required", () => {
    expect(
      messages(grupoCreateSchema, { ...validGrupo, periodo: "" }),
    ).toContain("periodo.required");
  });

  it.each([
    ["empty", "", "numGrupo.required"],
    ["whitespace", "   ", "numGrupo.required"],
    ["13 chars", "1".repeat(13), "numGrupo.tooLong"],
  ])("refuses a numeroGrupo that is %s", (_label, numeroGrupo, key) => {
    expect(
      messages(grupoCreateSchema, { ...validGrupo, numeroGrupo }),
    ).toContain(key);
  });

  it("never normalises numeroGrupo numerically", () => {
    expect(
      grupoCreateSchema.parse({ ...validGrupo, numeroGrupo: " 01 " })
        .numeroGrupo,
    ).toBe("01");
  });

  it.each([
    ["asignaturaId", undefined, "asignaturaId.required"],
    ["asignaturaId", "", "asignaturaId.required"],
    ["asignaturaId", "abc", "asignaturaId.invalid"],
    ["asignaturaId", "0", "asignaturaId.invalid"],
    ["docenteId", undefined, "docenteId.required"],
    ["docenteId", "", "docenteId.required"],
    ["docenteId", "x", "docenteId.invalid"],
  ])("refuses %s = %j", (field, value, key) => {
    expect(
      messages(grupoCreateSchema, { ...validGrupo, [field]: value }),
    ).toContain(key);
  });
});

describe("grupoUpdateSchema (CM-GRP-2)", () => {
  it("keeps only docenteId; the natural key is stripped", () => {
    const out = grupoUpdateSchema.parse({
      ...validGrupo,
      periodo: "2027-S1",
      numeroGrupo: "9",
      asignaturaId: "99",
    });
    expect(out).toEqual({ docenteId: 30 });
    expect(Object.keys(out)).toEqual(["docenteId"]);
  });

  it("requires a valid docenteId", () => {
    expect(messages(grupoUpdateSchema, {})).toContain("docenteId.required");
    expect(messages(grupoUpdateSchema, { docenteId: "x" })).toContain(
      "docenteId.invalid",
    );
  });
});

describe("CATALOG_FIELD_ERROR_KEYS (CM-I18N-1)", () => {
  // One battery that makes each schema emit every key it can.
  const emitted = new Set<string>();
  const battery: [AnySchema, unknown][] = [
    [asignaturaCreateSchema, {}],
    [
      asignaturaCreateSchema,
      { codigo: "a".repeat(33), nombre: "a".repeat(161) },
    ],
    [
      asignaturaCreateSchema,
      { ...validAsignatura, horasTotales: "0", carreraId: "x" },
    ],
    [
      asignaturaCreateSchema,
      { ...validAsignatura, horasTotales: null, carreraId: [] },
    ],
    [asignaturaUpdateSchema, {}],
    [asignaturaUpdateSchema, { nombre: "a".repeat(161), horasTotales: "x" }],
    [grupoCreateSchema, {}],
    [
      grupoCreateSchema,
      {
        periodo: "bad",
        numeroGrupo: "1".repeat(13),
        asignaturaId: "x",
        docenteId: "y",
      },
    ],
    [grupoUpdateSchema, {}],
    [grupoUpdateSchema, { docenteId: "x" }],
  ];
  for (const [schema, input] of battery) {
    for (const m of messages(schema, input)) emitted.add(m);
  }

  it("every emitted message is a listed key", () => {
    for (const m of emitted) {
      expect(CATALOG_FIELD_ERROR_KEYS).toContain(m);
    }
  });

  it("every listed key can be emitted (the list is exactly the emitted set)", () => {
    expect([...emitted].sort()).toEqual([...CATALOG_FIELD_ERROR_KEYS].sort());
  });

  it("has no duplicates", () => {
    expect(new Set(CATALOG_FIELD_ERROR_KEYS).size).toBe(
      CATALOG_FIELD_ERROR_KEYS.length,
    );
  });
});
