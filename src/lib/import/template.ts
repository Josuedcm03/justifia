import ExcelJS from "exceljs";

import { SHEETS } from "./sheets";

// Template builder (decision D2). The ONLY write-side xlsx library import in
// `src`, next to `parse.ts` on the read side. The sheets and headers come from
// `SHEETS`, so the template cannot drift from what the importer accepts, and
// the file carries headers only: uploaded unchanged it parses to zero rows.

export function buildTemplateWorkbook(): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  for (const contract of SHEETS) {
    const sheet = workbook.addWorksheet(contract.name);
    sheet.addRow([...contract.required, ...contract.optional]);
    sheet.getRow(1).font = { bold: true };
  }
  return workbook;
}

export async function buildTemplate(): Promise<Uint8Array> {
  const buffer = await buildTemplateWorkbook().xlsx.writeBuffer();
  return new Uint8Array(buffer);
}
