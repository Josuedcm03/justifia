import ExcelJS from "exceljs";

// The workbook of the coordination reports (RF-13 a, CR-XLS-2). Pure: it gets
// rows and labels already in the user's locale and writes bytes, so it imports
// neither next/* nor the i18n layer (boundary rule). Every student-controlled
// value is written as a JavaScript string, which ExcelJS stores as a string
// cell: only an object with a `formula` key becomes a formula, so a name such
// as `=1+1` can never be evaluated. The test reads the written file back to
// prove it.

export type WorkbookLabels = {
  sheets: { requests: string; summary: string };
  columns: {
    student: string;
    cif: string;
    cause: string;
    state: string;
    absence: string;
    submitted: string;
    classes: string;
  };
  summary: {
    period: string;
    teacher: string;
    student: string;
    cause: string;
    total: string;
  };
};

/** The applied filters as the text the summary shows (a label or "all"). */
export type WorkbookFilters = {
  period: string;
  teacher: string;
  student: string;
  cause: string;
};

/** One request, every cell already text; the classes are one line each. */
export type WorkbookRow = {
  student: string;
  cif: string;
  cause: string;
  state: string;
  absence: string;
  submitted: string;
  classes: readonly string[];
};

export type WorkbookInput = {
  labels: WorkbookLabels;
  filters: WorkbookFilters;
  rows: readonly WorkbookRow[];
};

const COLUMN_WIDTHS = [28, 14, 24, 22, 28, 14, 56];
const SUMMARY_WIDTHS = [26, 40];

export function buildReportWorkbook(input: WorkbookInput): ExcelJS.Workbook {
  const { labels, filters, rows } = input;
  const workbook = new ExcelJS.Workbook();

  const data = workbook.addWorksheet(labels.sheets.requests, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  data.addRow([
    labels.columns.student,
    labels.columns.cif,
    labels.columns.cause,
    labels.columns.state,
    labels.columns.absence,
    labels.columns.submitted,
    labels.columns.classes,
  ]);
  data.getRow(1).font = { bold: true };
  COLUMN_WIDTHS.forEach((width, at) => {
    data.getColumn(at + 1).width = width;
  });
  for (const row of rows) {
    const added = data.addRow([
      row.student,
      row.cif,
      row.cause,
      row.state,
      row.absence,
      row.submitted,
      row.classes.join("\n"),
    ]);
    added.getCell(7).alignment = { wrapText: true, vertical: "top" };
  }

  const summary = workbook.addWorksheet(labels.sheets.summary);
  SUMMARY_WIDTHS.forEach((width, at) => {
    summary.getColumn(at + 1).width = width;
  });
  const lines: [string, string | number][] = [
    [labels.summary.period, filters.period],
    [labels.summary.teacher, filters.teacher],
    [labels.summary.student, filters.student],
    [labels.summary.cause, filters.cause],
    [labels.summary.total, rows.length],
  ];
  for (const line of lines) {
    summary.addRow(line).getCell(1).font = { bold: true };
  }

  return workbook;
}

export async function buildWorkbook(input: WorkbookInput): Promise<Uint8Array> {
  const buffer = await buildReportWorkbook(input).xlsx.writeBuffer();
  return new Uint8Array(buffer);
}
