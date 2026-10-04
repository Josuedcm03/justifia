// @vitest-environment node
//
// Real exceljs through the builder, node environment (same reason as
// parse.test.ts). The workbook is inspected through the object the builder
// returns, so this file never imports the library itself.
import { describe, expect, it } from "vitest";

import { parseWorkbook } from "./parse";
import { SHEETS } from "./sheets";
import { buildTemplate, buildTemplateWorkbook } from "./template";

describe("buildTemplateWorkbook (CEI: Template download)", () => {
  it("has the three sheets in the contract order", () => {
    const names = buildTemplateWorkbook().worksheets.map((ws) => ws.name);

    expect(names).toEqual(["Asignaturas", "Docentes", "Grupos"]);
    expect(names).toEqual(SHEETS.map((s) => s.name));
  });

  it("writes the required then the optional headers of each sheet in row 1", () => {
    const sheets = buildTemplateWorkbook().worksheets;

    expect(sheets).toHaveLength(SHEETS.length);
    sheets.forEach((ws, i) => {
      const { required, optional } = SHEETS[i];
      // exceljs `row.values` is 1-based: index 0 is always empty.
      expect(ws.getRow(1).values).toEqual([
        undefined,
        ...required,
        ...optional,
      ]);
    });
    // Pin one literal per shape: all-required, and required + optional.
    expect(sheets[0].getRow(1).values).toEqual([
      undefined,
      "Codigo",
      "Nombre",
      "Carrera",
      "HorasTotales",
    ]);
    expect(sheets[1].getRow(1).values).toEqual([
      undefined,
      "Correo",
      "Nombre",
      "Telefono",
    ]);
  });

  it("carries no data rows and no Id column", () => {
    for (const ws of buildTemplateWorkbook().worksheets) {
      expect(ws.rowCount).toBe(1);
      expect(String(ws.getRow(1).values)).not.toMatch(/(^|,)id(,|$)/i);
    }
  });
});

describe("buildTemplate bytes", () => {
  it("returns a zip container (starts with PK)", async () => {
    const bytes = await buildTemplate();

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(Array.from(bytes.slice(0, 2))).toEqual([0x50, 0x4b]);
  });

  it("re-parses through parse.ts to zero rows and zero errors", async () => {
    const result = await parseWorkbook(await buildTemplate());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.workbook.sheets)).toEqual([
      "Asignaturas",
      "Docentes",
      "Grupos",
    ]);
    expect(Object.values(result.workbook.sheets).map((r) => r.length)).toEqual([
      0, 0, 0,
    ]);
  });
});
