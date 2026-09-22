import { describe, expect, it } from "vitest";

import {
  AsignaturaRowSchema,
  DocenteRowSchema,
  GrupoRowSchema,
} from "./schemas";

// AC: Non-positive or missing HorasTotales is rejected (table-driven).
// CEI: HorasTotales missing is a row error, Invalid rows are reported with
// location. Per-sheet zod schemas, table-driven `safeParse`. Error messages
// are i18n KEYS, never prose (WU3b resolves them against es/en catalogs).

function validAsignatura() {
  return {
    Codigo: "MAT101",
    Nombre: "Matematicas I",
    Carrera: "Ingenieria de Sistemas",
    HorasTotales: 64,
  };
}

function validDocente() {
  return {
    Correo: "docente@uni.edu",
    Nombre: "Ana Perez",
  };
}

function validGrupo() {
  return {
    CodigoAsignatura: "MAT101",
    Periodo: "2026-S1",
    NumGrupo: "1",
    CorreoDocente: "docente@uni.edu",
  };
}

describe("AsignaturaRowSchema", () => {
  it("accepts a fully valid row", () => {
    const result = AsignaturaRowSchema.safeParse(validAsignatura());
    expect(result.success).toBe(true);
  });

  it.each(["Codigo", "Nombre", "Carrera", "HorasTotales"])(
    "rejects a row missing required field %s",
    (field) => {
      const row = validAsignatura() as Record<string, unknown>;
      delete row[field];
      const result = AsignaturaRowSchema.safeParse(row);
      expect(result.success).toBe(false);
    },
  );

  it.each([
    [undefined, false],
    [0, false],
    [-8, false],
    [3.5, false],
    ["abc", false],
    [8, true],
  ])("HorasTotales %p is accepted=%p", (value, expected) => {
    const row = { ...validAsignatura(), HorasTotales: value };
    const result = AsignaturaRowSchema.safeParse(row);
    expect(result.success).toBe(expected);
  });

  it("reports a stable i18n key, not prose, when HorasTotales is missing", () => {
    const row = validAsignatura() as Record<string, unknown>;
    delete row.HorasTotales;
    const result = AsignaturaRowSchema.safeParse(row);
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message);
      expect(messages).toContain("horasTotales.required");
      for (const message of messages) {
        expect(message).not.toMatch(/\s/);
      }
    }
  });

  it("reports an i18n key when HorasTotales is non-positive or non-integer", () => {
    for (const value of [0, -8, 3.5, "abc"]) {
      const row = { ...validAsignatura(), HorasTotales: value };
      const result = AsignaturaRowSchema.safeParse(row);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.map((issue) => issue.message)).toContain(
          "horasTotales.invalid",
        );
      }
    }
  });

  it("rejects Codigo longer than 32 characters (matches Asignatura.Codigo varchar(32))", () => {
    const row = { ...validAsignatura(), Codigo: "x".repeat(33) };
    const result = AsignaturaRowSchema.safeParse(row);
    expect(result.success).toBe(false);
  });

  it("accepts Codigo at exactly 32 characters", () => {
    const row = { ...validAsignatura(), Codigo: "x".repeat(32) };
    const result = AsignaturaRowSchema.safeParse(row);
    expect(result.success).toBe(true);
  });

  it("rejects Nombre longer than 160 characters (matches Asignatura.Nombre varchar(160))", () => {
    const row = { ...validAsignatura(), Nombre: "x".repeat(161) };
    const result = AsignaturaRowSchema.safeParse(row);
    expect(result.success).toBe(false);
  });

  it("accepts Nombre at exactly 160 characters", () => {
    const row = { ...validAsignatura(), Nombre: "x".repeat(160) };
    const result = AsignaturaRowSchema.safeParse(row);
    expect(result.success).toBe(true);
  });
});

describe("DocenteRowSchema", () => {
  it("accepts a fully valid row", () => {
    const result = DocenteRowSchema.safeParse(validDocente());
    expect(result.success).toBe(true);
  });

  it.each(["Correo", "Nombre"])(
    "rejects a row missing required field %s",
    (field) => {
      const row = validDocente() as Record<string, unknown>;
      delete row[field];
      const result = DocenteRowSchema.safeParse(row);
      expect(result.success).toBe(false);
    },
  );

  it.each([
    ["docente@uni.edu", true],
    ["not-an-email", false],
    ["missing-at.com", false],
    ["@no-local.com", false],
    ["no-domain@", false],
  ])("Correo %p accepted=%p", (correo, expected) => {
    const result = DocenteRowSchema.safeParse({
      ...validDocente(),
      Correo: correo,
    });
    expect(result.success).toBe(expected);
  });

  it("rejects Correo longer than 160 characters (matches Usuario.Correo varchar(160))", () => {
    const local = "a".repeat(153);
    const row = { ...validDocente(), Correo: `${local}@uni.edu` };
    expect(row.Correo.length).toBeGreaterThan(160);
    const result = DocenteRowSchema.safeParse(row);
    expect(result.success).toBe(false);
  });

  it("rejects Nombre longer than 160 characters", () => {
    const row = { ...validDocente(), Nombre: "x".repeat(161) };
    const result = DocenteRowSchema.safeParse(row);
    expect(result.success).toBe(false);
  });

  it("rejects a Correo whose normalized form exceeds deriveLogin's 60-char LOGIN_MAX, even though it is under 160 chars", () => {
    // "a"x54 + "@uni.edu" (8 chars) = 62 chars: under the 160 varchar cap but
    // over deriveLogin's LOGIN_MAX (60) since Login is the whole email.
    const local = "a".repeat(54);
    const correo = `${local}@uni.edu`;
    expect(correo.length).toBe(62);
    expect(correo.length).toBeLessThanOrEqual(160);
    const result = DocenteRowSchema.safeParse({
      ...validDocente(),
      Correo: correo,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a Correo whose normalized form is exactly 60 characters", () => {
    const local = "a".repeat(52);
    const correo = `${local}@uni.edu`;
    expect(correo.length).toBe(60);
    const result = DocenteRowSchema.safeParse({
      ...validDocente(),
      Correo: correo,
    });
    expect(result.success).toBe(true);
  });
});

describe("GrupoRowSchema", () => {
  it("accepts a fully valid row", () => {
    const result = GrupoRowSchema.safeParse(validGrupo());
    expect(result.success).toBe(true);
  });

  it.each(["CodigoAsignatura", "Periodo", "NumGrupo", "CorreoDocente"])(
    "rejects a row missing required field %s",
    (field) => {
      const row = validGrupo() as Record<string, unknown>;
      delete row[field];
      const result = GrupoRowSchema.safeParse(row);
      expect(result.success).toBe(false);
    },
  );

  it.each([
    ["2026-S1", true],
    ["2026-S2", true],
    ["2026-s1", false],
    ["2026-S3", false],
    ["26-S1", false],
    ["2026-S1 ", false],
    ["", false],
  ])(
    "Periodo %p accepted=%p (case-sensitive, PERIODO_RE)",
    (periodo, expected) => {
      const result = GrupoRowSchema.safeParse({
        ...validGrupo(),
        Periodo: periodo,
      });
      expect(result.success).toBe(expected);
    },
  );

  it.each([
    ["docente@uni.edu", true],
    ["not-an-email", false],
  ])("CorreoDocente %p accepted=%p", (correo, expected) => {
    const result = GrupoRowSchema.safeParse({
      ...validGrupo(),
      CorreoDocente: correo,
    });
    expect(result.success).toBe(expected);
  });

  it("rejects NumGrupo longer than 12 characters (matches Grupo.NumeroGrupo varchar(12))", () => {
    const row = { ...validGrupo(), NumGrupo: "x".repeat(13) };
    const result = GrupoRowSchema.safeParse(row);
    expect(result.success).toBe(false);
  });

  it("accepts NumGrupo at exactly 12 characters", () => {
    const row = { ...validGrupo(), NumGrupo: "x".repeat(12) };
    const result = GrupoRowSchema.safeParse(row);
    expect(result.success).toBe(true);
  });

  it("coerces a numeric NumGrupo cell (Excel stores `1` as a JS number) to a trimmed string", () => {
    const result = GrupoRowSchema.safeParse({ ...validGrupo(), NumGrupo: 1 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NumGrupo).toBe("1");
      expect(typeof result.data.NumGrupo).toBe("string");
    }
  });

  it("still accepts a string NumGrupo cell and trims it", () => {
    const result = GrupoRowSchema.safeParse({
      ...validGrupo(),
      NumGrupo: " 1 ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NumGrupo).toBe("1");
    }
  });

  it("rejects a numeric NumGrupo cell whose stringified length exceeds 12", () => {
    const result = GrupoRowSchema.safeParse({
      ...validGrupo(),
      NumGrupo: 1234567890123,
    });
    expect(result.success).toBe(false);
  });
});
