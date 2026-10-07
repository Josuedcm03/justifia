import type { EntityCounts, EntityName } from "@/lib/import/types";
import type { RolUsuario } from "@/lib/validations/auth";

// PURE. No db, no clock, no I/O (decisions 18, 22). Types and constants only:
// the closed `AuditEvent` union is constructible ONLY through the builders in
// `src/lib/audit/events.ts` (WU2b-2), never by hand elsewhere.

export const AUDIT_ACTIONS = [
  "catalogo.importacion.aplicada",
  "usuario.creado",
  "usuario.actualizado",
  "solicitud.presentada",
  "documento.adjuntado",
  "documento.rechazado",
  "documento.eliminado",
  "documento.descargado",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditEntityType =
  "Importacion" | "Usuario" | "Solicitud" | "DocumentoRespaldo";

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
};

type UserChangedPayload = {
  /** FIELD NAMES ONLY — never values (RNF-05, decision 22). */
  campos: readonly AuditableUserField[];
  rol: RolUsuario;
  origen: "importacion";
  importacionSha256: string;
};

/** Counts only: no cause, dates or student data (RNF-02, RN-02). */
type RequestSubmittedPayload = { asignaturas: number; documentos: number };

/** Reason codes of a rejected finalize (supporting-documents). */
export type DocumentRejectionReason =
  | "unsupported_format"
  | "too_large"
  | "empty_file"
  | "not_found"
  | "not_allowed"
  | "too_many_documents";

/** Payloads carry ids, detected type, size and the reason code only: never a
 *  file name, content or storage location (RNF-02, D13). */
type DocumentAttachedPayload = {
  solicitudId: number;
  tipo: "pdf" | "png" | "jpeg";
  tamanoBytes: number;
};

type DocumentRejectedPayload = { reason: DocumentRejectionReason };

type DocumentRemovedPayload = { solicitudId: number };

type DocumentDownloadedPayload = {
  solicitudId: number;
  tipo: "pdf" | "png" | "jpeg";
};

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
      accion: "solicitud.presentada";
      entidadTipo: "Solicitud";
      entidadId: number;
      datos: RequestSubmittedPayload;
    }
  | {
      accion: "documento.adjuntado";
      entidadTipo: "DocumentoRespaldo";
      entidadId: number;
      datos: DocumentAttachedPayload;
    }
  | {
      // Concerns no persisted document: the entity is the draft (Solicitud).
      accion: "documento.rechazado";
      entidadTipo: "Solicitud";
      entidadId: number;
      datos: DocumentRejectedPayload;
    }
  | {
      accion: "documento.eliminado";
      entidadTipo: "DocumentoRespaldo";
      entidadId: number;
      datos: DocumentRemovedPayload;
    }
  | {
      accion: "documento.descargado";
      entidadTipo: "DocumentoRespaldo";
      entidadId: number;
      datos: DocumentDownloadedPayload;
    };
