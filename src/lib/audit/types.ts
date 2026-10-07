import type { EntityCounts, EntityName } from "@/lib/import/types";
import type { RolUsuario } from "@/lib/validations/auth";

// PURE. No db, no clock, no I/O (decisions 18, 22). Types and constants only:
// the closed `AuditEvent` union is constructible ONLY through the builders in
// `src/lib/audit/events.ts` (WU2b-2), never by hand elsewhere.

export const AUDIT_ACTIONS = [
  "catalogo.importacion.aplicada",
  "usuario.creado",
  "usuario.actualizado",
  "asignatura.creada",
  "asignatura.actualizada",
  "asignatura.desactivada",
  "asignatura.reactivada",
  "grupo.creado",
  "grupo.actualizado",
  "grupo.desactivado",
  "grupo.reactivado",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditEntityType =
  "Importacion" | "Usuario" | "Asignatura" | "Grupo";

/** Closed list. A field not named here can never be reported as changed.
 *  `login` and `hashClave` are ABSENT on purpose: `hashClave` is a
 *  credential, and `login` is never rewritten by an import (decision 7). */
export const AUDITABLE_USER_FIELDS = [
  "nombreCompleto",
  "correo",
  "telefono",
  "cif",
  "carreraId",
  "rolId",
  "activo",
] as const;

export type AuditableUserField = (typeof AUDITABLE_USER_FIELDS)[number];

type ImportAppliedPayload = {
  archivoSha256: string;
  conteos: Record<EntityName, EntityCounts>;
  cuentasCreadas: number;
  cuentasActualizadas: number;
  /** Counts only, so the losing side of the precedence rule stays visible
   *  after the preview is gone (CEI-AUD). */
  asignaturasReactivadas: number;
  gruposManualesDesactivados: number;
};

type UserChangedPayload = {
  /** FIELD NAMES ONLY — never values (RNF-05, decision 22). */
  campos: readonly AuditableUserField[];
  rol: RolUsuario;
  origen: "importacion";
  importacionSha256: string;
};

/** Closed lists for the manual catalog events. A field not named here can
 *  never be reported as changed (AL-PAY). */
export const AUDITABLE_ASIGNATURA_FIELDS = [
  "codigo",
  "nombre",
  "carreraId",
  "horasTotales",
  "activo",
] as const;

export type AuditableAsignaturaField =
  (typeof AUDITABLE_ASIGNATURA_FIELDS)[number];

export const AUDITABLE_GRUPO_FIELDS = [
  "asignaturaId",
  "periodo",
  "numeroGrupo",
  "docenteId",
  "activo",
  "origen",
] as const;

export type AuditableGrupoField = (typeof AUDITABLE_GRUPO_FIELDS)[number];

/** How a catalog record was written. The manual variant has no digest field at
 *  all, so it cannot be half-filled. */
export type AuditOrigin =
  { origen: "manual" } | { origen: "importacion"; importacionSha256: string };

type CatalogRecordPayload<F extends string> = {
  /** FIELD NAMES ONLY — never values (RNF-05). */
  campos: readonly F[];
} & AuditOrigin;

/** Closed discriminated union. Built ONLY by `src/lib/audit/events.ts`.
 *  `actorId` and `ocurridoEn` are NOT on this type: the actor is supplied by
 *  the writer from the session, and the timestamp is the column default, so
 *  a builder cannot forge either one. */
export type AuditEvent =
  | {
      accion: "catalogo.importacion.aplicada";
      entidadTipo: "Importacion";
      entidadId: null;
      datos: ImportAppliedPayload;
    }
  | {
      accion: "usuario.creado" | "usuario.actualizado";
      entidadTipo: "Usuario";
      entidadId: number;
      datos: UserChangedPayload;
    }
  | {
      accion:
        | "asignatura.creada"
        | "asignatura.actualizada"
        | "asignatura.desactivada"
        | "asignatura.reactivada";
      entidadTipo: "Asignatura";
      entidadId: number;
      datos: CatalogRecordPayload<AuditableAsignaturaField>;
    }
  | {
      accion:
        | "grupo.creado"
        | "grupo.actualizado"
        | "grupo.desactivado"
        | "grupo.reactivado";
      entidadTipo: "Grupo";
      entidadId: number;
      datos: CatalogRecordPayload<AuditableGrupoField>;
    };
