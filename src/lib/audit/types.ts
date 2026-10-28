import type { EstadoSolicitud } from "@/lib/intake/states";
import type { ReturnReason } from "@/lib/intake/return-reasons";
import type {
  RemissionReason,
  RemissionState,
  RemissionTrigger,
} from "@/lib/remission/states";
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
  "solicitud.aprobada",
  "solicitud.rechazada",
  "solicitud.devuelta",
  "solicitud.corregida",
  "solicitud.consultada",
  "solicitud.cola.consultada",
  "documento.retirado",
  "remision.creada",
  "remision.enviada",
  "remision.fallida",
  "remision.bloqueada",
  "remision.reenviada",
  "documento.formato_especial",
  "asignatura.creada",
  "asignatura.actualizada",
  "asignatura.desactivada",
  "asignatura.reactivada",
  "grupo.creado",
  "grupo.actualizado",
  "grupo.desactivado",
  "grupo.reactivado",
  "inscripcion.creada",
  "inscripcion.reactivada",
  "inscripcion.desactivada",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditEntityType =
  | "Importacion"
  | "Usuario"
  | "Solicitud"
  | "DocumentoRespaldo"
  | "Facultad"
  | "Asignatura"
  | "Grupo"
  | "Remision"
  | "Inscripcion";

/** Closed list. A field not named here can never be reported as changed.
 *  `login` and `hashClave` are ABSENT on purpose: `hashClave` is a
 *  credential, and `login` is never rewritten by an import (decision 7). */
export const AUDITABLE_USER_FIELDS = [
  "nombreCompleto",
  "correo",
  "telefono",
  "cif",
  "carreraId",
  "facultadId",
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

/**
 * Counts and the consent version code: no cause, dates or student data
 * (RNF-02, RN-02), and neither the consent text nor its instant (RC-7).
 */
type RequestSubmittedPayload = {
  asignaturas: number;
  documentos: number;
  consentimientoVersion: string;
};

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

/** How a document was opened: inline in the browser or as an attachment. */
export type DocumentMode = "ver" | "descarga";

type DocumentDownloadedPayload = {
  solicitudId: number;
  tipo: "pdf" | "png" | "jpeg";
  modo: DocumentMode;
};

/** Review events (secretary-review, SR-9). Ids, codes and counts only: no
 *  decision text, name, CIF, email, cause, dates, file name or id list
 *  (RNF-06, RN-02). */
type DecisionPayload = {
  decisionId: number;
  /** Template code, never its body. */
  plantilla: string;
  /** RN-17 code; present only on a return. */
  motivo?: ReturnReason;
  /** Whether the secretary changed the rendered template text. */
  textoEditado: boolean;
};

type RequestCorrectedPayload = {
  revision: number;
  asignaturas: number;
  documentos: number;
  documentosRetirados: number;
};

type RequestReadPayload = { estado: EstadoSolicitud };

/** Count only: never the list of request ids. */
type QueueReadPayload = { total: number };

type DocumentRetiredPayload = { solicitudId: number };

/** Remission events (teacher-remission, TR-13). Ids, closed codes and counts
 *  only: no email, name, CIF, cause, dates, file name, pathname, provider id
 *  or message text (RNF-06, RNF-02). */
type RemissionCreatedPayload = {
  solicitudId: number;
  estado: RemissionState;
  /** Present only when the remission is born blocked. */
  motivo?: RemissionReason;
};

type RemissionSentPayload = {
  solicitudId: number;
  origen: RemissionTrigger;
  intentos: number;
  adjuntos: number;
};

/** Closed reason a send failed; never the provider's own message. */
export type RemissionFailureCode =
  "not_configured" | "rejected" | "unavailable" | "documento_no_disponible";

type RemissionFailedPayload = {
  solicitudId: number;
  origen: RemissionTrigger;
  intentos: number;
  codigo: RemissionFailureCode;
};

type RemissionBlockedPayload = {
  solicitudId: number;
  origen: RemissionTrigger;
  motivo: RemissionReason;
};

type RemissionResentPayload = {
  solicitudId: number;
  estadoPrevio: RemissionState;
};

type SpecialFormatPayload = {
  solicitudId: number;
  tipo: "pdf" | "png" | "jpeg";
  tamanoBytes: number;
  remisionesDesbloqueadas: number;
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
  "dias",
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

/** Enrollment events (student-enrollment, SE-8). Ids and a closed reason code
 *  only: no period, group number, asignatura, docente or student data
 *  (RNF-05). */
type InscripcionPayload = {
  grupoId: number;
  /** Present only on a deactivation: a drop or a replace. */
  motivo?: "baja" | "reemplazo";
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
    }
  | {
      accion:
        "solicitud.aprobada" | "solicitud.rechazada" | "solicitud.devuelta";
      entidadTipo: "Solicitud";
      entidadId: number;
      datos: DecisionPayload;
    }
  | {
      accion: "solicitud.corregida";
      entidadTipo: "Solicitud";
      entidadId: number;
      datos: RequestCorrectedPayload;
    }
  | {
      accion: "solicitud.consultada";
      entidadTipo: "Solicitud";
      entidadId: number;
      datos: RequestReadPayload;
    }
  | {
      // The entity is the caller's faculty: the queue is a scope, not a request.
      accion: "solicitud.cola.consultada";
      entidadTipo: "Facultad";
      entidadId: number;
      datos: QueueReadPayload;
    }
  | {
      accion: "documento.retirado";
      entidadTipo: "DocumentoRespaldo";
      entidadId: number;
      datos: DocumentRetiredPayload;
    }
  | {
      accion: "remision.creada";
      entidadTipo: "Remision";
      entidadId: number;
      datos: RemissionCreatedPayload;
    }
  | {
      accion: "remision.enviada";
      entidadTipo: "Remision";
      entidadId: number;
      datos: RemissionSentPayload;
    }
  | {
      accion: "remision.fallida";
      entidadTipo: "Remision";
      entidadId: number;
      datos: RemissionFailedPayload;
    }
  | {
      accion: "remision.bloqueada";
      entidadTipo: "Remision";
      entidadId: number;
      datos: RemissionBlockedPayload;
    }
  | {
      accion: "remision.reenviada";
      entidadTipo: "Remision";
      entidadId: number;
      datos: RemissionResentPayload;
    }
  | {
      accion: "documento.formato_especial";
      entidadTipo: "DocumentoRespaldo";
      entidadId: number;
      datos: SpecialFormatPayload;
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
    }
  | {
      // The entity is the student: history per student hits the entity index.
      accion:
        | "inscripcion.creada"
        | "inscripcion.reactivada"
        | "inscripcion.desactivada";
      entidadTipo: "Inscripcion";
      entidadId: number;
      datos: InscripcionPayload;
    };
