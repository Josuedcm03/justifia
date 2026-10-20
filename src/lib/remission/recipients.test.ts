import { describe, expect, it } from "vitest";

import { buildRemissionRows, type RequestTeacher } from "./recipients";

const mat = {
  asignaturaId: 10,
  codigo: "MAT101",
  nombre: "Matematica I",
  numeroGrupo: "A",
};
const fis = {
  asignaturaId: 11,
  codigo: "FIS101",
  nombre: "Fisica I",
  numeroGrupo: "B",
};
const qui = {
  asignaturaId: 12,
  codigo: "QUI101",
  nombre: "Quimica I",
  numeroGrupo: "C",
};

function teacher(overrides: Partial<RequestTeacher> = {}): RequestTeacher {
  return {
    docenteId: 1,
    nombre: "Ana Perez",
    correo: "ana@uam.edu.ni",
    clases: [mat],
    ...overrides,
  };
}

describe("buildRemissionRows (RF-09 a, D6)", () => {
  it("snapshots id, name, email and groups of a teacher with an email", () => {
    expect(buildRemissionRows([teacher()])).toEqual([
      {
        docenteId: 1,
        docenteNombre: "Ana Perez",
        correo: "ana@uam.edu.ni",
        clases: [mat],
        estado: "pendiente",
        motivoCodigo: null,
      },
    ]);
  });

  it("creates one row per distinct teacher, in input order", () => {
    const rows = buildRemissionRows([
      teacher({ docenteId: 1, clases: [mat] }),
      teacher({
        docenteId: 2,
        nombre: "Luis Mora",
        correo: "luis@uam.edu.ni",
        clases: [fis],
      }),
    ]);
    expect(rows.map((r) => [r.docenteId, r.clases])).toEqual([
      [1, [mat]],
      [2, [fis]],
    ]);
  });

  it("merges two groups of the same teacher into one row", () => {
    const rows = buildRemissionRows([
      teacher({ clases: [mat] }),
      teacher({ clases: [fis, qui] }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].clases).toEqual([mat, fis, qui]);
  });

  it("blocks a teacher without an email with sin_correo", () => {
    const [row] = buildRemissionRows([teacher({ correo: null })]);
    expect(row.estado).toBe("bloqueada");
    expect(row.motivoCodigo).toBe("sin_correo");
    expect(row.correo).toBeNull();
  });

  it("treats a blank email as missing", () => {
    const [row] = buildRemissionRows([teacher({ correo: "   " })]);
    expect(row.estado).toBe("bloqueada");
    expect(row.motivoCodigo).toBe("sin_correo");
    expect(row.correo).toBeNull();
  });

  it("blocks every row of a special-format approval until the format exists", () => {
    const rows = buildRemissionRows(
      [
        teacher({ docenteId: 1 }),
        teacher({ docenteId: 2, correo: "luis@uam.edu.ni", clases: [fis] }),
      ],
      { formatoEspecial: true },
    );
    expect(rows.map((r) => [r.estado, r.motivoCodigo])).toEqual([
      ["bloqueada", "formato_especial_faltante"],
      ["bloqueada", "formato_especial_faltante"],
    ]);
  });

  it("reports sin_correo before the missing format (gate order)", () => {
    const [row] = buildRemissionRows([teacher({ correo: null })], {
      formatoEspecial: true,
    });
    expect(row.motivoCodigo).toBe("sin_correo");
  });

  it("yields no row for a group without an identified teacher", () => {
    const rows = buildRemissionRows([
      teacher({ docenteId: null, nombre: null, clases: [mat] }),
      teacher({ docenteId: 2, nombre: "Luis Mora", clases: [fis] }),
    ]);
    expect(rows.map((r) => r.docenteId)).toEqual([2]);
  });

  it("yields nothing when no group has a teacher", () => {
    expect(
      buildRemissionRows([teacher({ docenteId: null, nombre: null })]),
    ).toEqual([]);
  });
});
