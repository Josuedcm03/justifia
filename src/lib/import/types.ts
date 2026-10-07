import type { AuditableUserField } from "@/lib/audit/types";
import type { GrupoOrigen } from "@/lib/catalog/origen";
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
  /** Inactive rows are part of the snapshot so a re-import can reactivate them. */
  activo: boolean;
};

/** A user with its role CODE (resolved by join), inactive accounts included. */
export type UsuarioRow = {
  id: number;
  login: string;
  correo: string | null;
  cif: string | null;
  nombreCompleto: string;
  telefono: string | null;
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
  /** How the row was created; an import never rewrites it. */
  origen: GrupoOrigen;
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

/** `Asignatura` create/update payloads (WU2b-1, `plan.ts`). `Carrera` is
 *  resolved to an id by read-only lookup against the snapshot — the import
 *  never writes `Carrera` (scope reduction, X5). */
export type AsignaturaWrite =
  | {
      kind: "create";
      codigo: string;
      nombre: string;
      carreraId: number;
      horasTotales: number;
    }
  | {
      kind: "update";
      id: number;
      nombre: string;
      carreraId: number;
      horasTotales: number;
      /** Present (true) only when the matched row was inactive: the apply sets
       *  `activo: true` for it and for no other update. */
      reactivated?: true;
    };

/** `Usuario` (docente) create/update payloads. `changedFields` names only
 *  `AUDITABLE_USER_FIELDS` that actually differ from the snapshot row — it
 *  feeds `buildAuditEvents` (WU2b-2) directly, unchanged. Re-importing an
 *  existing docente never touches `login`/`hashClave` (decision 7): an
 *  `update` carries no credential. */
export type UsuarioWrite =
  | {
      kind: "create";
      correo: string;
      login: string;
      nombreCompleto: string;
      telefono: string | null;
    }
  | {
      kind: "update";
      id: number;
      nombreCompleto: string;
      telefono: string | null;
      changedFields: readonly AuditableUserField[];
    };

/** `Grupo` create/update payloads. Cross-sheet references travel as
 *  NATURAL KEYS (never an id): the referenced Asignatura/Usuario may itself
 *  be a same-workbook `create`, whose id does not exist yet when the plan is
 *  built (pure, no DB) — `apply.ts` (WU2c) resolves both after the
 *  Asignatura/Usuario writes land, in dependency order. `kind: "update"`
 *  covers both a docente reassignment and a reactivation (deactivated grupo
 *  reappearing in the workbook): `EntityCounts.update` covers both, there is
 *  no separate "reactivate" count (task 4.9). */
export type GrupoWrite =
  | {
      kind: "create";
      asignaturaCodigo: string;
      periodo: string;
      numeroGrupo: string;
      docenteCorreo: string;
    }
  | {
      kind: "update";
      id: number;
      docenteCorreo: string;
      reactivated: boolean;
    };

export type ImportWrites = {
  asignaturas: AsignaturaWrite[];
  usuarios: UsuarioWrite[];
  grupos: GrupoWrite[];
};

/** The pure planner's output (decision: preview leaves the database
 *  untouched). */
export type ImportPlan = {
  ok: boolean; // false when errors.length > 0
  errors: RowError[]; // ALL of them, never just the first
  counts: Record<EntityName, EntityCounts>;
  accountsToCreate: number;
  writes: ImportWrites; // per-entity create/update payloads, in dependency order
  deactivateGrupoIds: number[];
  /** Asignaturas the apply will reactivate (writes flagged `reactivated`). */
  asignaturasToReactivate: number;
  /** How many of `deactivateGrupoIds` have origin `manual`. */
  manualGruposToDeactivate: number;
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
  /** Counts only, taken from the plan (CEI-AUD): never a code or a cell. */
  asignaturasReactivated: number;
  manualGruposDeactivated: number;
};

/** Never placed on `ImportSummary` or any audited/logged shape (decision 16). */
export type TemporaryCredential = {
  login: string;
  nombreCompleto: string;
  clave: string;
};
