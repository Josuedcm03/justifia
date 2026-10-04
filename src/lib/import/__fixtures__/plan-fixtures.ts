import type {
  CarreraRow,
  CatalogSnapshot,
  FacultadRow,
  ParsedRow,
  ParsedWorkbook,
} from "../types";

// Hand-built fixtures for `plan.test.ts` (WU2b-1). No `.xlsx`, no I/O: every
// value here is a plain object, so `planImport` stays provably pure.

const FACULTAD: FacultadRow = { id: 1, nombre: "Facultad de Ingeniería" };
const CARRERA: CarreraRow = {
  id: 1,
  nombre: "Ingeniería en Sistemas",
  facultadId: FACULTAD.id,
};

/** A ready-to-use snapshot: one Facultad/Carrera, no Asignatura/Usuario/Grupo
 *  yet — every stage's "create" scenarios start from here. Pass `overrides`
 *  to extend any array. */
export function makeSnapshot(
  overrides: Partial<CatalogSnapshot> = {},
): CatalogSnapshot {
  return {
    facultades: [FACULTAD],
    carreras: [CARRERA],
    asignaturas: [],
    usuarios: [],
    grupos: [],
    inscripciones: [],
    ...overrides,
  };
}

function row(cells: Record<string, string>, rowNumber: number): ParsedRow {
  return { row: rowNumber, cells };
}

/** Builds a row for each sheet at consecutive Excel row numbers (2, 3, 4, …
 *  — header is row 1) from plain cell-value arrays, so a test can write a
 *  fixture as a short list of records without repeating row numbers. */
export function makeWorkbook(overrides: {
  asignaturas?: Record<string, string>[];
  docentes?: Record<string, string>[];
  grupos?: Record<string, string>[];
  fileSha256?: string;
}): ParsedWorkbook {
  const toRows = (cells: Record<string, string>[] = []) =>
    cells.map((c, i) => row(c, i + 2));
  return {
    fileSha256: overrides.fileSha256 ?? "0".repeat(64),
    sheets: {
      Asignaturas: toRows(overrides.asignaturas),
      Docentes: toRows(overrides.docentes),
      Grupos: toRows(overrides.grupos),
    },
  };
}

export { FACULTAD, CARRERA };
