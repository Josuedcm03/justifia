// One-off script (NOT part of the app or its build): generates the committed
// .xlsx fixtures consumed by parse.test.ts. Run once with:
//   node src/lib/import/__fixtures__/build-fixtures.mjs
// Re-run only when a fixture needs to change; the .xlsx bytes are committed.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import ExcelJS from "exceljs";
import JSZip from "jszip";

const DIR = path.dirname(fileURLToPath(import.meta.url));

const ASIGNATURAS = ["Codigo", "Nombre", "Carrera", "HorasTotales"];
const DOCENTES = ["Correo", "Nombre", "Telefono"];
const GRUPOS = ["CodigoAsignatura", "Periodo", "NumGrupo", "CorreoDocente"];

function addSheet(workbook, name, headers, rows) {
  const sheet = workbook.addWorksheet(name);
  sheet.addRow(headers);
  for (const row of rows) sheet.addRow(row);
  return sheet;
}

function buildBaseWorkbook() {
  const workbook = new ExcelJS.Workbook();
  addSheet(workbook, "Asignaturas", ASIGNATURAS, [
    ["CS101", "Introduccion a la Programacion", "Ingenieria en Sistemas", 64],
    ["CS102", "Estructuras de Datos", "Ingenieria en Sistemas", 64],
  ]);
  addSheet(workbook, "Docentes", DOCENTES, [
    ["juan.perez@uni.edu", "Juan Perez", "555-1234"],
    ["maria.lopez@uni.edu", "Maria Lopez", ""],
  ]);
  addSheet(workbook, "Grupos", GRUPOS, [
    ["CS101", "2026-S1", 1, "juan.perez@uni.edu"],
    ["CS102", "2026-S1", 1, "maria.lopez@uni.edu"],
  ]);
  return workbook;
}

async function writeFixture(name, workbook) {
  const buffer = await workbook.xlsx.writeBuffer();
  writeFileSync(path.join(DIR, name), buffer);
}

async function buildValid() {
  const workbook = buildBaseWorkbook();
  // A trailing blank row: must be ignored by parse.ts, not counted or errored.
  workbook.getWorksheet("Asignaturas").addRow(["", "", "", ""]);
  await writeFixture("valid.xlsx", workbook);
}

async function buildMissingSheet() {
  const workbook = new ExcelJS.Workbook();
  addSheet(workbook, "Asignaturas", ASIGNATURAS, [
    ["CS101", "Introduccion a la Programacion", "Ingenieria en Sistemas", 64],
  ]);
  addSheet(workbook, "Docentes", DOCENTES, [
    ["juan.perez@uni.edu", "Juan Perez", ""],
  ]);
  // "Grupos" intentionally absent.
  await writeFixture("missing-sheet.xlsx", workbook);
}

async function buildRenamedHeader() {
  const workbook = buildBaseWorkbook();
  workbook.getWorksheet("Asignaturas").getRow(1).getCell(1).value = "Cod";
  await writeFixture("renamed-header.xlsx", workbook);
}

async function buildFormulaCell() {
  const workbook = buildBaseWorkbook();
  const sheet = workbook.getWorksheet("Asignaturas");
  // HorasTotales for CS101 (row 2, column 4): a formula with a cached value.
  // parse.ts must read the cached `result`, never evaluate `formula`.
  sheet.getRow(2).getCell(4).value = { formula: "32+32", result: 64 };
  await writeFixture("formula-cell.xlsx", workbook);
}

async function buildRowCapExceeded(maxRowsPerSheet) {
  const workbook = new ExcelJS.Workbook();
  const rows = [];
  for (let i = 0; i < maxRowsPerSheet + 1; i++) {
    rows.push([`CS${i}`, "Materia", "Ingenieria en Sistemas", 32]);
  }
  addSheet(workbook, "Asignaturas", ASIGNATURAS, rows);
  addSheet(workbook, "Docentes", DOCENTES, [
    ["juan.perez@uni.edu", "Juan Perez", ""],
  ]);
  addSheet(workbook, "Grupos", GRUPOS, [
    ["CS0", "2026-S1", 1, "juan.perez@uni.edu"],
  ]);
  await writeFixture("row-cap-exceeded.xlsx", workbook);
}

async function buildCorruptZip() {
  const workbook = buildBaseWorkbook();
  const buffer = await workbook.xlsx.writeBuffer();
  // Keep the leading PK signature (passes the guard's ZIP check) but
  // truncate the tail, destroying the central directory record.
  const truncated = buffer.subarray(0, Math.floor(buffer.length * 0.6));
  writeFileSync(path.join(DIR, "corrupt-zip.xlsx"), truncated);
}

function buildTextAsXlsx() {
  writeFileSync(path.join(DIR, "text-as-xlsx.xlsx"), Buffer.from("hello"));
}

async function buildDimensionLie() {
  const workbook = new ExcelJS.Workbook();
  addSheet(workbook, "Asignaturas", ASIGNATURAS, [
    ["CS101", "Introduccion a la Programacion", "Ingenieria en Sistemas", 64],
    ["CS102", "Estructuras de Datos", "Ingenieria en Sistemas", 64],
  ]);
  addSheet(workbook, "Docentes", DOCENTES, [
    ["juan.perez@uni.edu", "Juan Perez", ""],
  ]);
  addSheet(workbook, "Grupos", GRUPOS, [
    ["CS101", "2026-S1", 1, "juan.perez@uni.edu"],
  ]);
  const buffer = await workbook.xlsx.writeBuffer();

  const zip = await JSZip.loadAsync(buffer);
  const sheetPath = "xl/worksheets/sheet1.xml";
  const xml = await zip.file(sheetPath).async("string");
  const lied = xml.replace(
    /<dimension ref="[^"]*"\s*\/>/,
    `<dimension ref="A1:D10000000"/>`,
  );
  if (lied === xml) {
    throw new Error("dimension-lie: no <dimension> tag found to rewrite");
  }
  zip.file(sheetPath, lied);
  const rebuilt = await zip.generateAsync({ type: "nodebuffer" });
  writeFileSync(path.join(DIR, "dimension-lie.xlsx"), rebuilt);
}

async function buildExternalReference() {
  const workbook = new ExcelJS.Workbook();
  addSheet(workbook, "Asignaturas", ASIGNATURAS, [
    ["CS101", "XXE_MARKER", "Ingenieria en Sistemas", 64],
  ]);
  addSheet(workbook, "Docentes", DOCENTES, [
    ["juan.perez@uni.edu", "Juan Perez", ""],
  ]);
  addSheet(workbook, "Grupos", GRUPOS, [
    ["CS101", "2026-S1", 1, "juan.perez@uni.edu"],
  ]);
  const buffer = await workbook.xlsx.writeBuffer();

  const zip = await JSZip.loadAsync(buffer);
  // exceljs stores cell text in xl/sharedStrings.xml (shared strings table),
  // not inline in the sheet XML, so the entity must be injected there.
  const stringsPath = "xl/sharedStrings.xml";
  const xml = await zip.file(stringsPath).async("string");
  // Internal general entity (no network/file access): if the parser ever
  // expanded it, the "XXE_MARKER" cell text would become "PWNED-BY-XXE".
  const withDoctype = xml.replace(
    /^<\?xml[^>]*\?>/,
    `$&\n<!DOCTYPE root [<!ENTITY xxe "PWNED-BY-XXE">]>`,
  );
  const withEntityRef = withDoctype.replace("XXE_MARKER", "&xxe;");
  if (withEntityRef === xml) {
    throw new Error("external-reference: injection did not change the XML");
  }
  zip.file(stringsPath, withEntityRef);
  const rebuilt = await zip.generateAsync({ type: "nodebuffer" });
  writeFileSync(path.join(DIR, "external-reference.xlsx"), rebuilt);
}

async function main() {
  // MAX_ROWS_PER_SHEET has no imports by design (limits.ts), read directly
  // to avoid a bundler-facing import from a script outside src's build graph.
  const { MAX_ROWS_PER_SHEET } = await import("../limits.ts");

  await buildValid();
  await buildMissingSheet();
  await buildRenamedHeader();
  await buildFormulaCell();
  await buildRowCapExceeded(MAX_ROWS_PER_SHEET);
  await buildCorruptZip();
  buildTextAsXlsx();
  await buildDimensionLie();
  await buildExternalReference();

  console.log("Fixtures written to", DIR);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
