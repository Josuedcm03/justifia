// @vitest-environment node
//
// Real bytes through the real library (exceljs), never jsdom: avoids the
// jsdom realm mismatch for Uint8Array/Buffer. One block per fixture case
// from tasks.md 3.15 — table-driven where the fixtures are simple pass/fail,
// explicit assertions where a specific value must be proven.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { MAX_ROWS_PER_SHEET } from "./limits";
import { parseWorkbook } from "./parse";
import type { ParsedWorkbook } from "./types";

const FIXTURES = resolve(__dirname, "__fixtures__");

function loadFixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(resolve(FIXTURES, name)));
}

function allCellValues(workbook: ParsedWorkbook): string[] {
  return Object.values(workbook.sheets).flatMap((rows) =>
    rows.flatMap((row) => Object.values(row.cells)),
  );
}

describe("parseWorkbook (CEI: File guards, design threat matrix)", () => {
  it("parses a valid workbook into Excel row numbers and trimmed values, ignoring the trailing blank row", async () => {
    const result = await parseWorkbook(loadFixture("valid.xlsx"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Header is row 1; the two data rows are Excel rows 2 and 3, matching
    // what a user sees in Excel. The trailing blank row (row 4) is ignored:
    // not counted, not reported as an error.
    expect(result.workbook.sheets.Asignaturas).toEqual([
      {
        row: 2,
        cells: {
          Codigo: "CS101",
          Nombre: "Introduccion a la Programacion",
          Carrera: "Ingenieria en Sistemas",
          HorasTotales: "64",
        },
      },
      {
        row: 3,
        cells: {
          Codigo: "CS102",
          Nombre: "Estructuras de Datos",
          Carrera: "Ingenieria en Sistemas",
          HorasTotales: "64",
        },
      },
    ]);
    expect(result.workbook.sheets.Grupos).toHaveLength(2);
    expect(result.workbook.fileSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("reports a structural error naming the missing sheet", async () => {
    const result = await parseWorkbook(loadFixture("missing-sheet.xlsx"));

    expect(result).toEqual({
      ok: false,
      error: { sheet: "Grupos", row: 0, reason: "sheet.missing" },
    });
  });

  it("reports a structural error naming the sheet and the renamed column", async () => {
    const result = await parseWorkbook(loadFixture("renamed-header.xlsx"));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.sheet).toBe("Asignaturas");
    expect(result.error.reason).toBe("column.missing");
    expect(result.error.value).toBe("Codigo");
  });

  it("reads a formula cell's cached value and never evaluates the formula", async () => {
    const result = await parseWorkbook(loadFixture("formula-cell.xlsx"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const cs101 = result.workbook.sheets.Asignaturas.find(
      (row) => row.cells.Codigo === "CS101",
    );
    expect(cs101?.cells.HorasTotales).toBe("64");
    expect(allCellValues(result.workbook)).not.toContain("32+32");
  });

  it("returns a validation error for a corrupt zip, never an uncaught throw", async () => {
    await expect(
      parseWorkbook(loadFixture("corrupt-zip.xlsx")),
    ).resolves.toEqual({
      ok: false,
      error: { sheet: "", row: 0, reason: "workbook.invalid" },
    });
  });

  it("returns a validation error for bytes that are not a zip at all", async () => {
    await expect(
      parseWorkbook(loadFixture("text-as-xlsx.xlsx")),
    ).resolves.toEqual({
      ok: false,
      error: { sheet: "", row: 0, reason: "workbook.invalid" },
    });
  });

  it("raises a validation error during parsing when a sheet exceeds MAX_ROWS_PER_SHEET, without reading the whole sheet first", async () => {
    const result = await parseWorkbook(loadFixture("row-cap-exceeded.xlsx"));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.sheet).toBe("Asignaturas");
    expect(result.error.reason).toBe("sheet.tooManyRows");
    // Stops at the cap boundary rather than materializing every row first:
    // the reported row is the first one past the cap, not the sheet's last.
    expect(result.error.row).toBe(MAX_ROWS_PER_SHEET + 2); // +1 header, +1 1-indexed
  });

  it("parses a sheet by its real row count, ignoring a lying <dimension> tag", async () => {
    const result = await parseWorkbook(loadFixture("dimension-lie.xlsx"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The fixture's <dimension> claims 10,000,000 rows; only 2 are real.
    expect(result.workbook.sheets.Asignaturas).toHaveLength(2);
  });

  it("never expands an external/XXE-style entity reference into the parsed output", async () => {
    const result = await parseWorkbook(loadFixture("external-reference.xlsx"));

    // Must not crash the process either way (guarded by the fixture-level
    // try/catch inside parseWorkbook already covered above); the invariant
    // that matters here is that the entity is never resolved.
    if (result.ok) {
      expect(allCellValues(result.workbook)).not.toContain("PWNED-BY-XXE");
    } else {
      expect(result.error.reason).not.toBe("");
    }
  });
});
