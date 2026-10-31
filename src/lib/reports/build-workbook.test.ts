// @vitest-environment node
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import {
  buildWorkbook,
  type WorkbookInput,
  type WorkbookRow,
} from "@/lib/reports/build-workbook";

// The workbook is read back with ExcelJS from the bytes the builder wrote, so
// every assertion is about the file, not about the objects that produced it.

const LABELS_EN: WorkbookInput["labels"] = {
  sheets: { requests: "Requests", summary: "Summary" },
  columns: {
    student: "Student",
    cif: "CIF",
    cause: "Cause",
    state: "State",
    absence: "Absence dates",
    submitted: "Submitted",
    classes: "Classes",
  },
  summary: {
    period: "Academic period",
    teacher: "Teacher",
    student: "Student",
    cause: "Cause",
    total: "Total requests",
  },
};

const LABELS_ES: WorkbookInput["labels"] = {
  sheets: { requests: "Solicitudes", summary: "Resumen" },
  columns: {
    student: "Estudiante",
    cif: "CIF",
    cause: "Causa",
    state: "Estado",
    absence: "Fechas de ausencia",
    submitted: "Presentada",
    classes: "Clases",
  },
  summary: {
    period: "Periodo académico",
    teacher: "Docente",
    student: "Estudiante",
    cause: "Causa",
    total: "Total de solicitudes",
  },
};

const FILTERS: WorkbookInput["filters"] = {
  period: "2026-S1",
  teacher: "Marta Ruiz",
  student: "Ana",
  cause: "Medical",
};

function row(overrides: Partial<WorkbookRow> = {}): WorkbookRow {
  return {
    student: "Ana Mora",
    cif: "2021-001",
    cause: "Medical",
    state: "Approved",
    absence: "2026-03-02 to 2026-03-04",
    submitted: "2026-03-05",
    classes: ["Calculo I · Marta Ruiz · 2026-S1"],
    ...overrides,
  };
}

async function read(input: WorkbookInput) {
  const bytes = await buildWorkbook(input);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(bytes) as unknown as ExcelJS.Buffer);
  return workbook;
}

/** The cell values of one row, 1-based columns turned into a plain array. */
function valuesOf(sheet: ExcelJS.Worksheet, at: number) {
  const values = sheet.getRow(at).values as unknown[];
  return values.slice(1);
}

describe("buildWorkbook: data sheet (CR-XLS-2, RF-13 a)", () => {
  it("writes the requests sheet first and the summary second, named by the labels", async () => {
    const en = await read({ labels: LABELS_EN, filters: FILTERS, rows: [] });
    const es = await read({ labels: LABELS_ES, filters: FILTERS, rows: [] });

    expect(en.worksheets.map((sheet) => sheet.name)).toEqual([
      "Requests",
      "Summary",
    ]);
    expect(es.worksheets.map((sheet) => sheet.name)).toEqual([
      "Solicitudes",
      "Resumen",
    ]);
  });

  it("headers are the CR-DET-1 columns in the locale of the labels", async () => {
    const en = await read({ labels: LABELS_EN, filters: FILTERS, rows: [] });
    const es = await read({ labels: LABELS_ES, filters: FILTERS, rows: [] });

    expect(valuesOf(en.worksheets[0], 1)).toEqual([
      "Student",
      "CIF",
      "Cause",
      "State",
      "Absence dates",
      "Submitted",
      "Classes",
    ]);
    expect(valuesOf(es.worksheets[0], 1)).toEqual([
      "Estudiante",
      "CIF",
      "Causa",
      "Estado",
      "Fechas de ausencia",
      "Presentada",
      "Clases",
    ]);
  });

  it("writes one data row per request, in the order given, below the header", async () => {
    const workbook = await read({
      labels: LABELS_EN,
      filters: FILTERS,
      rows: [
        row(),
        row({ student: "Luis Pena", cif: "2021-002", state: "Rejected" }),
        row({ student: "Eva Soto", cif: "2021-003", cause: "Force majeure" }),
      ],
    });
    const sheet = workbook.worksheets[0];

    expect(sheet.rowCount).toBe(4);
    expect(valuesOf(sheet, 2)).toEqual([
      "Ana Mora",
      "2021-001",
      "Medical",
      "Approved",
      "2026-03-02 to 2026-03-04",
      "2026-03-05",
      "Calculo I · Marta Ruiz · 2026-S1",
    ]);
    expect([2, 3, 4].map((at) => sheet.getRow(at).getCell(1).value)).toEqual([
      "Ana Mora",
      "Luis Pena",
      "Eva Soto",
    ]);
    expect(sheet.getRow(3).getCell(4).value).toBe("Rejected");
    expect(sheet.getRow(4).getCell(3).value).toBe("Force majeure");
  });

  it("puts every class of a request in ONE cell, one line each", async () => {
    const workbook = await read({
      labels: LABELS_EN,
      filters: FILTERS,
      rows: [
        row({
          classes: [
            "Calculo I · Marta Ruiz · 2026-S1",
            "Fisica · Luis Pena · 2026-S1",
            "Quimica · Luis Pena · 2026-S2",
          ],
        }),
      ],
    });
    const sheet = workbook.worksheets[0];

    expect(sheet.rowCount).toBe(2);
    expect(sheet.getRow(2).getCell(7).value).toBe(
      [
        "Calculo I · Marta Ruiz · 2026-S1",
        "Fisica · Luis Pena · 2026-S1",
        "Quimica · Luis Pena · 2026-S2",
      ].join("\n"),
    );
    expect(sheet.getRow(2).getCell(7).alignment?.wrapText).toBe(true);
  });

  it("leaves the classes cell empty for a request with none", async () => {
    const workbook = await read({
      labels: LABELS_EN,
      filters: FILTERS,
      rows: [row({ classes: [] })],
    });

    expect(workbook.worksheets[0].getRow(2).getCell(7).value).toBe("");
  });
});

describe("buildWorkbook: summary sheet (CR-XLS-2, RF-13 a)", () => {
  async function summaryOf(input: WorkbookInput) {
    const sheet = (await read(input)).worksheets[1];
    return Array.from({ length: sheet.rowCount }, (_, at) =>
      valuesOf(sheet, at + 1),
    );
  }

  it("lists the applied filters and the total, labelled in English", async () => {
    expect(
      await summaryOf({
        labels: LABELS_EN,
        filters: FILTERS,
        rows: [row(), row(), row()],
      }),
    ).toEqual([
      ["Academic period", "2026-S1"],
      ["Teacher", "Marta Ruiz"],
      ["Student", "Ana"],
      ["Cause", "Medical"],
      ["Total requests", 3],
    ]);
  });

  it("lists them in Spanish for the Spanish labels, with the total of THOSE rows", async () => {
    expect(
      await summaryOf({
        labels: LABELS_ES,
        filters: {
          period: "Todos los periodos",
          teacher: "Todos los docentes",
          student: "Todos los estudiantes",
          cause: "Todas las causas",
        },
        rows: [row()],
      }),
    ).toEqual([
      ["Periodo académico", "Todos los periodos"],
      ["Docente", "Todos los docentes"],
      ["Estudiante", "Todos los estudiantes"],
      ["Causa", "Todas las causas"],
      ["Total de solicitudes", 1],
    ]);
  });

  it("writes the total as a number, so a spreadsheet can use it", async () => {
    const sheet = (
      await read({ labels: LABELS_EN, filters: FILTERS, rows: [row(), row()] })
    ).worksheets[1];
    const cell = sheet.getRow(5).getCell(2);

    expect(cell.type).toBe(ExcelJS.ValueType.Number);
    expect(cell.value).toBe(2);
  });
});

describe("buildWorkbook: empty result (CR-XLS-2, scenario Empty download)", () => {
  it("is a valid workbook with the headers, no data row and a total of 0", async () => {
    const workbook = await read({
      labels: LABELS_EN,
      filters: FILTERS,
      rows: [],
    });

    expect(workbook.worksheets).toHaveLength(2);
    expect(workbook.worksheets[0].rowCount).toBe(1);
    expect(valuesOf(workbook.worksheets[0], 1)).toHaveLength(7);
    expect(workbook.worksheets[1].getRow(5).getCell(1).value).toBe(
      "Total requests",
    );
    expect(workbook.worksheets[1].getRow(5).getCell(2).value).toBe(0);
  });
});

describe("buildWorkbook: text stays text (CR-XLS-2, scenario formula-like text)", () => {
  const DANGEROUS = ["=1+1", "+1", "-1", "@x", '=HYPERLINK("http://x","y")'];

  it.each(DANGEROUS)(
    "stores a student named %s as a string cell, never a formula or a number",
    async (name) => {
      const workbook = await read({
        labels: LABELS_EN,
        filters: FILTERS,
        rows: [row({ student: name })],
      });
      const cell = workbook.worksheets[0].getRow(2).getCell(1);

      expect(cell.type).toBe(ExcelJS.ValueType.String);
      expect(cell.value).toBe(name);
      expect(cell.formula).toBeUndefined();
    },
  );

  it("treats every text column the same way: CIF, cause, state, dates and classes", async () => {
    const workbook = await read({
      labels: LABELS_EN,
      filters: FILTERS,
      rows: [
        row({
          cif: "=2+2",
          cause: "+3",
          state: "-4",
          absence: "@5",
          submitted: "=6",
          classes: ["=7", "+8"],
        }),
      ],
    });
    const cells = [1, 2, 3, 4, 5, 6, 7].map((at) =>
      workbook.worksheets[0].getRow(2).getCell(at),
    );

    expect(cells.map((cell) => cell.type)).toEqual(
      Array(7).fill(ExcelJS.ValueType.String),
    );
    expect(cells.map((cell) => cell.value)).toEqual([
      "Ana Mora",
      "=2+2",
      "+3",
      "-4",
      "@5",
      "=6",
      "=7\n+8",
    ]);
    expect(cells.map((cell) => cell.formula)).toEqual(Array(7).fill(undefined));
  });

  it("keeps a typed search term that looks like a formula as text in the summary", async () => {
    const workbook = await read({
      labels: LABELS_EN,
      filters: { ...FILTERS, student: "=1+1" },
      rows: [],
    });
    const cell = workbook.worksheets[1].getRow(3).getCell(2);

    expect(cell.type).toBe(ExcelJS.ValueType.String);
    expect(cell.value).toBe("=1+1");
    expect(cell.formula).toBeUndefined();
  });

  it("does not turn a numeric-looking text into a number", async () => {
    const workbook = await read({
      labels: LABELS_EN,
      filters: FILTERS,
      rows: [row({ cif: "2021-001", student: "007", submitted: "2026-03-05" })],
    });
    const sheet = workbook.worksheets[0];

    expect(sheet.getRow(2).getCell(1).value).toBe("007");
    expect(sheet.getRow(2).getCell(1).type).toBe(ExcelJS.ValueType.String);
  });
});
