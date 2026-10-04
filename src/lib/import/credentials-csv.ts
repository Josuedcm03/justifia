import type { TemporaryCredential } from "@/lib/import/types";

// Pure CSV writer for the one-shot credentials export (decision D10). UTF-8
// BOM so Excel opens accents correctly; CRLF rows per RFC 4180.
const BOM = "\uFEFF";
const HEADER = ["Login", "NombreCompleto", "Clave"];

// Cells starting with these are read as formulas by spreadsheets.
const FORMULA_LEAD = /^[=+\-@\t\r]/;

function cell(value: string): string {
  const safe = FORMULA_LEAD.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function buildCredentialsCsv(
  credentials: readonly TemporaryCredential[],
): string {
  const rows = [
    HEADER,
    ...credentials.map((c) => [c.login, c.nombreCompleto, c.clave]),
  ];
  return BOM + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}
