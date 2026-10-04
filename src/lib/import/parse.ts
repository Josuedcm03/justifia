import { createHash } from "node:crypto";

import ExcelJS from "exceljs";

import { MAX_ROWS_PER_SHEET, MAX_ROWS_TOTAL } from "./limits";
import { findMissingColumns, resolveHeaderIndex, SHEETS } from "./sheets";
import type { ParsedRow, ParsedWorkbook, RowError } from "./types";

// exceljs -> ParsedWorkbook (decision 6/D2). The ONLY read-side xlsx library
// import in `src` (besides WU3b's `template.ts`, not yet built). Everything
// else in `src/lib/import` stays a pure consumer of `ParsedWorkbook`.

export type ParseResult =
  { ok: true; workbook: ParsedWorkbook } | { ok: false; error: RowError };

/** Internal signal used to break out of exceljs's `eachRow` as soon as a cap
 *  is hit, instead of materializing the rest of an oversized sheet first. */
class RowCapExceeded {
  constructor(public readonly error: RowError) {}
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("result" in value) {
      // Formula cell: read the cached result, never the formula string.
      return cellText(value.result as ExcelJS.CellValue);
    }
    if ("richText" in value) {
      return value.richText
        .map((part) => part.text)
        .join("")
        .trim();
    }
    if ("text" in value) {
      return String((value as { text: unknown }).text).trim();
    }
    return "";
  }
  return String(value).trim();
}

function isBlankRow(row: ExcelJS.Row, columnCount: number): boolean {
  for (let column = 1; column <= columnCount; column++) {
    if (cellText(row.getCell(column).value) !== "") return false;
  }
  return true;
}

export async function parseWorkbook(bytes: Uint8Array): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook();
  try {
    // exceljs's bundled .d.ts redeclares an ambient `Buffer extends
    // ArrayBuffer`, which merges awkwardly with @types/node's generic
    // `Buffer<T>` and rejects a real Node Buffer at the type level only
    // (the runtime value is a genuine Buffer instance).
    await workbook.xlsx.load(Buffer.from(bytes) as never);
  } catch {
    return {
      ok: false,
      error: { sheet: "", row: 0, reason: "workbook.invalid" },
    };
  }

  const sheets = {} as ParsedWorkbook["sheets"];
  let totalRows = 0;

  for (const contract of SHEETS) {
    const worksheet = workbook.getWorksheet(contract.name);
    if (!worksheet) {
      return {
        ok: false,
        error: { sheet: contract.name, row: 0, reason: "sheet.missing" },
      };
    }

    const headers: string[] = [];
    worksheet
      .getRow(1)
      .eachCell(
        { includeEmpty: false },
        (cell, columnNumber) =>
          (headers[columnNumber - 1] = cellText(cell.value)),
      );

    const missing = findMissingColumns(contract, headers);
    if (missing.length > 0) {
      return {
        ok: false,
        error: {
          sheet: contract.name,
          row: 1,
          reason: "column.missing",
          value: missing[0].column,
        },
      };
    }

    const columns = [...contract.required, ...contract.optional];
    const columnIndex = new Map<string, number>();
    for (const column of columns) {
      const index = resolveHeaderIndex(headers, column);
      if (index !== undefined) columnIndex.set(column, index);
    }

    const rows: ParsedRow[] = [];
    try {
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return; // header
        if (isBlankRow(row, headers.length)) return;

        if (rows.length >= MAX_ROWS_PER_SHEET) {
          throw new RowCapExceeded({
            sheet: contract.name,
            row: rowNumber,
            reason: "sheet.tooManyRows",
          });
        }
        if (totalRows >= MAX_ROWS_TOTAL) {
          throw new RowCapExceeded({
            sheet: contract.name,
            row: rowNumber,
            reason: "workbook.tooManyRows",
          });
        }

        const cells: Record<string, string> = {};
        for (const column of columns) {
          const index = columnIndex.get(column);
          cells[column] =
            index === undefined ? "" : cellText(row.getCell(index + 1).value);
        }
        rows.push({ row: rowNumber, cells });
        totalRows++;
      });
    } catch (thrown) {
      if (thrown instanceof RowCapExceeded) {
        return { ok: false, error: thrown.error };
      }
      throw thrown;
    }

    sheets[contract.name] = rows;
  }

  return {
    ok: true,
    workbook: {
      fileSha256: createHash("sha256").update(bytes).digest("hex"),
      sheets,
    },
  };
}
