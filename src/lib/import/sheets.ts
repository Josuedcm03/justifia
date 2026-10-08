import { normalizeKey } from "./normalize";

// The sheet/column contract, as data (decision 6). Pure: no xlsx import here
// — only `parse.ts` touches the library.
//
// Scope reduction (product-owner decision): Facultades, Carreras, Estudiantes
// and Inscripciones are no longer imported. Facultad/Carrera are seeded once
// outside this feature; the import never creates a student account.
// FROZEN against the real sample workbook (task 3.9, docs/PlantillaCatalogo.xlsx,
// 2026-09-22): "Nombre" (not "NombreCompleto") for Docentes, "NumGrupo" (not
// "NumeroGrupo") for Grupos — the file's real headers win over the proposal.
export const SHEETS = [
  {
    name: "Asignaturas",
    required: ["Codigo", "Nombre", "Carrera", "HorasTotales"],
    optional: [],
  },
  {
    name: "Docentes",
    required: ["Correo", "Nombre"],
    optional: ["Telefono"],
  },
  {
    name: "Grupos",
    required: ["CodigoAsignatura", "Periodo", "NumGrupo", "CorreoDocente"],
    optional: ["Dias"],
  },
] as const;

/** Optional columns whose ABSENCE differs from an empty cell, per sheet name:
 *  `parse.ts` leaves the key out of the row cells when the header is missing
 *  and keeps `""` when the header exists with a blank cell (CEI-DIAS-1). Only
 *  `Grupos.Dias` today; every other optional column reads a missing header as
 *  `""`. */
export const ABSENCE_SIGNIFICANT: Readonly<
  Partial<Record<string, readonly string[]>>
> = { Grupos: ["Dias"] };
// Every cross-sheet reference is a NATURAL KEY. No Id column is ever accepted,
// on any sheet.

export type SheetContract = (typeof SHEETS)[number];

/** Finds the index of `columnName` inside `headers`, comparing with
 *  `normalizeKey` (trim -> lowercase -> strip diacritics), so "Código",
 *  "codigo " and "CODIGO" all match "Codigo". Returns `undefined` when no
 *  header matches. */
export function resolveHeaderIndex(
  headers: readonly string[],
  columnName: string,
): number | undefined {
  const target = normalizeKey(columnName);
  const index = headers.findIndex((header) => normalizeKey(header) === target);
  return index === -1 ? undefined : index;
}

export type MissingColumn = { sheet: string; column: string };

/** Returns one entry per required column of `sheet` that has no matching
 *  header in `headers` (structural error naming both the sheet and the
 *  column). Unknown extra columns and missing optional columns are never
 *  reported. */
export function findMissingColumns(
  sheet: SheetContract,
  headers: readonly string[],
): MissingColumn[] {
  const missing: MissingColumn[] = [];
  for (const column of sheet.required) {
    if (resolveHeaderIndex(headers, column) === undefined) {
      missing.push({ sheet: sheet.name, column });
    }
  }
  return missing;
}
