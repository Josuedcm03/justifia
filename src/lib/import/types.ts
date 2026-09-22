import type { RolUsuario } from "@/lib/validations/auth";

/**
 * Row types of the catalog snapshot read by `loadCatalogSnapshot` and consumed
 * by the pure planner. WU2a extends this file with the parser and plan types.
 * Rows carry no credentials: `hashClave` is never part of a snapshot.
 */

export type FacultadRow = { id: number; nombre: string };

export type CarreraRow = { id: number; nombre: string; facultadId: number };

export type AsignaturaRow = {
  id: number;
  codigo: string;
  nombre: string;
  carreraId: number;
  horasTotales: number;
};

/** A user with its role CODE (resolved by join), inactive accounts included. */
export type UsuarioRow = {
  id: number;
  login: string;
  correo: string | null;
  cif: string | null;
  nombreCompleto: string;
  carreraId: number | null;
  activo: boolean;
  rol: RolUsuario;
};

/** Inactive groups are included so a corrected re-import can reactivate them. */
export type GrupoRow = {
  id: number;
  asignaturaId: number;
  periodo: string;
  numeroGrupo: string;
  docenteId: number;
  activo: boolean;
};

/** Inactive enrollments are included so a corrected re-import can reactivate them. */
export type InscripcionRow = {
  estudianteId: number;
  grupoId: number;
  activo: boolean;
};

export type CatalogSnapshot = {
  facultades: FacultadRow[];
  carreras: CarreraRow[];
  asignaturas: AsignaturaRow[];
  usuarios: UsuarioRow[];
  grupos: GrupoRow[];
  inscripciones: InscripcionRow[];
};

/**
 * Parser and planner types (WU2a extension, tasks 3.10/3.11). Types only: no
 * logic here to RED-test, verified by `npm run typecheck`.
 */

/** A row-level validation or structural failure, always naming its sheet and
 *  row so the report can point the operator at the exact location. */
export type RowError = {
  sheet: string;
  row: number;
  reason: string;
  value?: string;
};

/** The three entities the import ever creates/updates/deactivates. Docentes
 *  become Usuario rows; Facultad/Carrera/Estudiante/Inscripcion are out of
 *  scope for this import (scope reduction). */
export type EntityName = "Asignatura" | "Usuario" | "Grupo";

export type EntityCounts = {
  create: number;
  update: number;
  unchanged: number;
  deactivate: number;
  error: number;
};

/** One parsed data row: its Excel row number and its trimmed cell values,
 *  keyed by column name. */
export type ParsedRow = { row: number; cells: Record<string, string> };

/** The parsed, validated shape of an uploaded workbook: one entry per sheet
 *  (Asignaturas, Docentes, Grupos), with Excel row numbers and trimmed cell
 *  values. Built only by `parse.ts`. */
export type ParsedWorkbook = {
  fileSha256: string;
  sheets: Record<"Asignaturas" | "Docentes" | "Grupos", ParsedRow[]>;
};

/** The pure planner's output (decision: preview leaves the database
 *  untouched). Shape only here — `plan.ts` (WU2b-1) supplies the logic. */
export type ImportPlan = {
  ok: boolean; // false when errors.length > 0
  errors: RowError[]; // ALL of them, never just the first
  counts: Record<EntityName, EntityCounts>;
  accountsToCreate: number;
  writes: Record<string, unknown>; // per-entity create/update payloads, in dependency order
  deactivateGrupoIds: number[];
  // No `deactivateInscripcionKeys`: Inscripciones is not imported (scope
  // reduction). `Inscripcion` rows stay under academic-catalog's own lifecycle.
};

/** The structured-log-friendly record of an applied import. NO credential
 *  field exists anywhere on this type — that is what makes "logs are clean"
 *  a compile-time property (decision 16). */
export type ImportSummary = {
  actor: string;
  at: string;
  fileSha256: string;
  counts: Record<EntityName, EntityCounts>;
  accountsCreated: number;
  accountsUpdated: number;
};

/** Never placed on `ImportSummary` or any audited/logged shape (decision 16). */
export type TemporaryCredential = {
  login: string;
  nombreCompleto: string;
  clave: string;
};
