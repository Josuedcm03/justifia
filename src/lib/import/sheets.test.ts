import { describe, expect, it } from "vitest";

import { findMissingColumns, SHEETS, resolveHeaderIndex } from "./sheets";

// CEI: File guards (Missing or renamed sheet or header). `sheets.ts` is the
// header contract as pure data plus header-matching logic (trim -> lowercase
// -> strip diacritics, delegated to normalize.ts's `normalizeKey`). It never
// imports the xlsx library: only `parse.ts` touches exceljs.
describe("SHEETS contract", () => {
  it("has the three sheets, in order, with the frozen required/optional columns", () => {
    expect(SHEETS.map((sheet) => sheet.name)).toEqual([
      "Asignaturas",
      "Docentes",
      "Grupos",
    ]);

    const asignaturas = SHEETS.find((sheet) => sheet.name === "Asignaturas");
    expect(asignaturas?.required).toEqual([
      "Codigo",
      "Nombre",
      "Carrera",
      "HorasTotales",
    ]);
    expect(asignaturas?.optional).toEqual([]);

    const docentes = SHEETS.find((sheet) => sheet.name === "Docentes");
    expect(docentes?.required).toEqual(["Correo", "Nombre"]);
    expect(docentes?.optional).toEqual(["Telefono"]);

    const grupos = SHEETS.find((sheet) => sheet.name === "Grupos");
    expect(grupos?.required).toEqual([
      "CodigoAsignatura",
      "Periodo",
      "NumGrupo",
      "CorreoDocente",
    ]);
    expect(grupos?.optional).toEqual([]);
  });

  it("never accepts an Id column as required or optional on any sheet", () => {
    for (const sheet of SHEETS) {
      expect(sheet.required).not.toContain("Id");
      expect(sheet.optional).not.toContain("Id");
    }
  });
});

describe("resolveHeaderIndex (header matching: trim -> lowercase -> strip diacritics)", () => {
  it("matches a header with an accent against its unaccented column name", () => {
    const headers = ["Código", "Nombre", "Carrera", "HorasTotales"];
    expect(resolveHeaderIndex(headers, "Codigo")).toBe(0);
  });

  it("matches a header with trailing whitespace", () => {
    const headers = ["Codigo ", "Nombre", "Carrera", "HorasTotales"];
    expect(resolveHeaderIndex(headers, "Codigo")).toBe(0);
  });

  it("matches regardless of case", () => {
    const headers = ["CODIGO", "nombre", "Carrera", "HorasTotales"];
    expect(resolveHeaderIndex(headers, "Codigo")).toBe(0);
    expect(resolveHeaderIndex(headers, "Nombre")).toBe(1);
  });

  it("returns undefined when the column is absent", () => {
    const headers = ["Codigo", "Carrera", "HorasTotales"];
    expect(resolveHeaderIndex(headers, "Nombre")).toBeUndefined();
  });
});

describe("findMissingColumns (structural error naming sheet and column)", () => {
  it("ignores unknown extra columns", () => {
    const headers = ["Codigo", "Nombre", "Carrera", "HorasTotales", "Notas"];
    const missing = findMissingColumns(SHEETS[0], headers);
    expect(missing).toEqual([]);
  });

  it("reports every missing required column, naming the sheet and the column", () => {
    const headers = ["Codigo", "Carrera"]; // Nombre and HorasTotales missing
    const missing = findMissingColumns(SHEETS[0], headers);
    expect(missing).toEqual([
      { sheet: "Asignaturas", column: "Nombre" },
      { sheet: "Asignaturas", column: "HorasTotales" },
    ]);
  });

  it("does not report a missing optional column", () => {
    const headers = ["Correo", "Nombre"]; // Telefono (optional) absent
    const missing = findMissingColumns(SHEETS[1], headers);
    expect(missing).toEqual([]);
  });

  it("matches required columns case-insensitively and diacritic-insensitively, so a renamed-but-equivalent header is not reported missing", () => {
    const headers = ["código", "NOMBRE ", "Carrera", "HorasTotales"];
    const missing = findMissingColumns(SHEETS[0], headers);
    expect(missing).toEqual([]);
  });
});
