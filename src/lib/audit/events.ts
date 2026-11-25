// src/lib/audit/events.ts — PURE, total, the ONLY constructors of `AuditEvent`
// (decision 22). No parameter here has a credential type; adding one would be
// a visible signature change, which is what makes a leak compile-time
// impossible. `actorId` and `ocurridoEn` are never accepted: the actor comes
// from the session at write time, and the timestamp is the column default.

import type {
  AsignaturaActiveResult,
  AsignaturaWriteResult,
  DocenteActiveResult,
  DocenteWriteResult,
  GrupoActiveResult,
  GrupoWriteResult,
} from "@/lib/catalog/types";
import type { DocumentDataField } from "@/lib/document-data/types";
import type {
  DropResult,
  EnrollResult,
  StaleResult,
} from "@/lib/enrollment/types";
import type { Causa } from "@/lib/intake/causes";
import type { DecisionKind } from "@/lib/intake/decision-templates";
import type {
  EscalationReason,
  EscalationNoticeState,
  EscalationNoticeTrigger,
} from "@/lib/intake/escalation";
import type { ReturnReason } from "@/lib/intake/return-reasons";
import type { EstadoSolicitud } from "@/lib/intake/states";
import type {
  RemissionReason,
  RemissionState,
  RemissionTrigger,
} from "@/lib/remission/states";
import { RETENTION_REASON } from "@/lib/retention/policy";
import type { RolUsuario } from "@/lib/validations/auth";

import type { ImportSummary } from "../import/types";
import {
  AUDITABLE_ASIGNATURA_FIELDS,
  AUDITABLE_GRUPO_FIELDS,
  AUDITABLE_USER_FIELDS,
} from "./types";
import type {
  AuditableAsignaturaField,
  AuditableGrupoField,
  AuditableUserField,
  AuditEvent,
  AuditOrigin,
  DocumentMode,
  DocumentRejectionReason,
  InscripcionReadPayload,
  MailFailureCode,
  RemissionFailureCode,
} from "./types";

export function importAppliedEvent(summary: ImportSummary): AuditEvent {
  return {
    accion: "catalogo.importacion.aplicada",
    entidadTipo: "Importacion",
    entidadId: null,
    datos: {
      archivoSha256: summary.fileSha256,
      conteos: summary.counts,
      cuentasCreadas: summary.accountsCreated,
      cuentasActualizadas: summary.accountsUpdated,
      asignaturasReactivadas: summary.asignaturasReactivated,
      gruposManualesDesactivados: summary.manualGruposDeactivated,
    },
  };
}

/** A newly created account has every auditable field set at once — `campos`
 *  reports the closed field-name list itself, never a value, so this stays
 *  a total function with no "which fields did I just set" bookkeeping to
 *  thread through the caller. */
export function accountCreatedEvent(args: {
  usuarioId: number;
  rol: RolUsuario;
  origin: AuditOrigin;
}): AuditEvent {
  return {
    accion: "usuario.creado",
    entidadTipo: "Usuario",
    entidadId: args.usuarioId,
    datos: {
      campos: AUDITABLE_USER_FIELDS,
      rol: args.rol,
      ...args.origin,
    },
  };
}

export function accountUpdatedEvent(args: {
  usuarioId: number;
  rol: RolUsuario;
  campos: readonly AuditableUserField[];
  origin: AuditOrigin;
}): AuditEvent {
  return {
    accion: "usuario.actualizado",
    entidadTipo: "Usuario",
    entidadId: args.usuarioId,
    datos: {
      campos: args.campos,
      rol: args.rol,
      ...args.origin,
    },
  };
}

/** A deactivation or reactivation of an account: the direction is the action
 *  itself, so the payload names only the field `activo` (DM-AUD-1). */
export function accountActiveChangedEvent(args: {
  usuarioId: number;
  rol: RolUsuario;
  activo: boolean;
  origin: AuditOrigin;
}): AuditEvent {
  return {
    accion: args.activo ? "usuario.reactivado" : "usuario.desactivado",
    entidadTipo: "Usuario",
    entidadId: args.usuarioId,
    datos: { campos: ["activo"], rol: args.rol, ...args.origin },
  };
}

export function solicitudPresentadaEvent(args: {
  solicitudId: number;
  asignaturas: number;
  documentos: number;
  /** The consent version stored with the presentation (RC-7): a code, not text. */
  consentimientoVersion: string;
}): AuditEvent {
  return {
    accion: "solicitud.presentada",
    entidadTipo: "Solicitud",
    entidadId: args.solicitudId,
    datos: {
      asignaturas: args.asignaturas,
      documentos: args.documentos,
      consentimientoVersion: args.consentimientoVersion,
    },
  };
}

export function documentAttachedEvent(args: {
  documentoId: number;
  solicitudId: number;
  tipo: "pdf" | "png" | "jpeg";
  tamanoBytes: number;
}): AuditEvent {
  return {
    accion: "documento.adjuntado",
    entidadTipo: "DocumentoRespaldo",
    entidadId: args.documentoId,
    datos: {
      solicitudId: args.solicitudId,
      tipo: args.tipo,
      tamanoBytes: args.tamanoBytes,
    },
  };
}

export function documentRejectedEvent(args: {
  solicitudId: number;
  reason: DocumentRejectionReason;
}): AuditEvent {
  return {
    accion: "documento.rechazado",
    entidadTipo: "Solicitud",
    entidadId: args.solicitudId,
    datos: { reason: args.reason },
  };
}

export function documentRemovedEvent(args: {
  documentoId: number;
  solicitudId: number;
}): AuditEvent {
  return {
    accion: "documento.eliminado",
    entidadTipo: "DocumentoRespaldo",
    entidadId: args.documentoId,
    datos: { solicitudId: args.solicitudId },
  };
}

export function documentDownloadedEvent(args: {
  documentoId: number;
  solicitudId: number;
  tipo: "pdf" | "png" | "jpeg";
  modo: DocumentMode;
}): AuditEvent {
  return {
    accion: "documento.descargado",
    entidadTipo: "DocumentoRespaldo",
    entidadId: args.documentoId,
    datos: {
      solicitudId: args.solicitudId,
      tipo: args.tipo,
      modo: args.modo,
    },
  };
}

/** One secretary decision: the action follows the decision kind. `motivo` is
 *  the RN-17 code of a return and is left out of the payload otherwise. */
export function solicitudDecididaEvent(args: {
  solicitudId: number;
  tipo: DecisionKind;
  decisionId: number;
  plantilla: string;
  motivo?: ReturnReason;
  textoEditado: boolean;
}): AuditEvent {
  return {
    accion: `solicitud.${args.tipo}`,
    entidadTipo: "Solicitud",
    entidadId: args.solicitudId,
    datos: {
      decisionId: args.decisionId,
      plantilla: args.plantilla,
      ...(args.motivo === undefined ? {} : { motivo: args.motivo }),
      textoEditado: args.textoEditado,
    },
  };
}

export function solicitudCorregidaEvent(args: {
  solicitudId: number;
  revision: number;
  asignaturas: number;
  documentos: number;
  documentosRetirados: number;
}): AuditEvent {
  return {
    accion: "solicitud.corregida",
    entidadTipo: "Solicitud",
    entidadId: args.solicitudId,
    datos: {
      revision: args.revision,
      asignaturas: args.asignaturas,
      documentos: args.documentos,
      documentosRetirados: args.documentosRetirados,
    },
  };
}

/** A staff open of one request detail (RNF-06 a). */
export function solicitudConsultadaEvent(args: {
  solicitudId: number;
  estado: EstadoSolicitud;
}): AuditEvent {
  return {
    accion: "solicitud.consultada",
    entidadTipo: "Solicitud",
    entidadId: args.solicitudId,
    datos: { estado: args.estado },
  };
}

/**
 * A staff open of one review tab: the entity is the faculty, the payload the
 * count and the tab code (the request state the tab lists), never request ids.
 */
export function solicitudColaConsultadaEvent(args: {
  facultadId: number;
  total: number;
  estado: EstadoSolicitud;
}): AuditEvent {
  return {
    accion: "solicitud.cola.consultada",
    entidadTipo: "Facultad",
    entidadId: args.facultadId,
    datos: { total: args.total, estado: args.estado },
  };
}

/**
 * The payload of a staff read of the inscriptions, rebuilt key by key so a
 * search text, an id or a count smuggled into the call never reaches the row.
 * A filter is present or not: `=== true` keeps a string out of the booleans.
 */
function inscripcionReadPayload(args: InscripcionReadPayload) {
  return {
    periodo: args.periodo,
    status: args.status,
    filters: {
      q: args.filters.q === true,
      asignatura: args.filters.asignatura === true,
      grupo: args.filters.grupo === true,
    },
    page: args.page,
    total: args.total,
  };
}

/**
 * A secretaria's successful load of the inscriptions list: the entity is her
 * faculty, the payload the closed values only (D10, RNF-06).
 */
export function inscripcionListaConsultadaEvent(
  args: { facultadId: number } & InscripcionReadPayload,
): AuditEvent {
  return {
    accion: "inscripcion.lista.consultada",
    entidadTipo: "Facultad",
    entidadId: args.facultadId,
    datos: inscripcionReadPayload(args),
  };
}

/**
 * A secretaria's successful student search of the assign page: same scope and
 * payload shape as the list read (D10, RNF-06).
 */
export function inscripcionEstudiantesConsultadaEvent(
  args: { facultadId: number } & InscripcionReadPayload,
): AuditEvent {
  return {
    accion: "inscripcion.estudiantes.consultada",
    entidadTipo: "Facultad",
    entidadId: args.facultadId,
    datos: inscripcionReadPayload(args),
  };
}

/** A coordinator opened the report dashboard: the entity is the career, the
 *  payload the period code and the rows shown per ranking (RF-17 e). */
export function solicitudRankingConsultadoEvent(args: {
  carreraId: number;
  periodo: string | null;
  estudiantes: number;
  docentes: number;
  asignaturas: number;
}): AuditEvent {
  return {
    accion: "solicitud.ranking.consultado",
    entidadTipo: "Carrera",
    entidadId: args.carreraId,
    datos: {
      periodo: args.periodo,
      estudiantes: args.estudiantes,
      docentes: args.docentes,
      asignaturas: args.asignaturas,
    },
  };
}

type ReportReadArgs = {
  carreraId: number;
  periodo: string;
  docenteId: number | null;
  causa: Causa | null;
  busqueda: boolean;
  total: number;
};

function reportReadEvent(
  accion: "solicitud.reporte.consultado" | "solicitud.reporte.descargado",
  args: ReportReadArgs,
): AuditEvent {
  return {
    accion,
    entidadTipo: "Carrera",
    entidadId: args.carreraId,
    datos: {
      periodo: args.periodo,
      docenteId: args.docenteId,
      causa: args.causa,
      busqueda: args.busqueda,
      total: args.total,
    },
  };
}

/** A coordinator opened the request detail: the entity is the career, the
 *  payload the applied filters and the total. `busqueda` says only that a term
 *  was typed; the term itself is never stored (RF-13 b, RNF-06). */
export function solicitudReporteConsultadoEvent(
  args: ReportReadArgs,
): AuditEvent {
  return reportReadEvent("solicitud.reporte.consultado", args);
}

/** A coordinator downloaded the workbook: the same payload as the detail view,
 *  with `total` the rows of the file (RF-13 a, RNF-06). */
export function solicitudReporteDescargadoEvent(
  args: ReportReadArgs,
): AuditEvent {
  return reportReadEvent("solicitud.reporte.descargado", args);
}

/** A correction retired a document of a previous revision (soft retirement). */
export function documentoRetiradoEvent(args: {
  documentoId: number;
  solicitudId: number;
}): AuditEvent {
  return {
    accion: "documento.retirado",
    entidadTipo: "DocumentoRespaldo",
    entidadId: args.documentoId,
    datos: { solicitudId: args.solicitudId },
  };
}

/** The secretary escalated a pending request to the career coordination. */
export function solicitudEscaladaEvent(args: {
  solicitudId: number;
  escalamientoId: number;
  motivo: EscalationReason;
  estadoPrevio: EstadoSolicitud;
  estadoNuevo: EstadoSolicitud;
}): AuditEvent {
  return {
    accion: "solicitud.escalada",
    entidadTipo: "Solicitud",
    entidadId: args.solicitudId,
    datos: {
      escalamientoId: args.escalamientoId,
      motivo: args.motivo,
      estadoPrevio: args.estadoPrevio,
      estadoNuevo: args.estadoNuevo,
    },
  };
}

/** The coordination answered an open escalation; the request left coordination. */
export function solicitudEscalamientoResueltoEvent(args: {
  solicitudId: number;
  escalamientoId: number;
  estadoPrevio: EstadoSolicitud;
  estadoNuevo: EstadoSolicitud;
}): AuditEvent {
  return {
    accion: "solicitud.escalamiento_resuelto",
    entidadTipo: "Solicitud",
    entidadId: args.solicitudId,
    datos: {
      escalamientoId: args.escalamientoId,
      estadoPrevio: args.estadoPrevio,
      estadoNuevo: args.estadoNuevo,
    },
  };
}

/** An RF-15 absence report was recorded on an approved request. */
export function solicitudReporteInasistenciasEvent(args: {
  solicitudId: number;
  reporteId: number;
  escalamientoId: number;
  docenteId: number;
}): AuditEvent {
  return {
    accion: "solicitud.reporte_inasistencias",
    entidadTipo: "Solicitud",
    entidadId: args.solicitudId,
    datos: {
      reporteId: args.reporteId,
      escalamientoId: args.escalamientoId,
      docenteId: args.docenteId,
    },
  };
}

/** The coordination notice was accepted by the mail provider. */
export function escalamientoNotificacionEnviadaEvent(args: {
  escalamientoId: number;
  solicitudId: number;
  origen: EscalationNoticeTrigger;
  intentos: number;
  destinatarios: number;
}): AuditEvent {
  return {
    accion: "escalamiento.notificacion_enviada",
    entidadTipo: "Escalamiento",
    entidadId: args.escalamientoId,
    datos: {
      solicitudId: args.solicitudId,
      origen: args.origen,
      intentos: args.intentos,
      destinatarios: args.destinatarios,
    },
  };
}

/** `codigo` is a closed code: the provider's own error text, which can hold an
 *  address, never reaches the audit log (RNF-06). */
export function escalamientoNotificacionFallidaEvent(args: {
  escalamientoId: number;
  solicitudId: number;
  origen: EscalationNoticeTrigger;
  intentos: number;
  codigo: MailFailureCode;
}): AuditEvent {
  return {
    accion: "escalamiento.notificacion_fallida",
    entidadTipo: "Escalamiento",
    entidadId: args.escalamientoId,
    datos: {
      solicitudId: args.solicitudId,
      origen: args.origen,
      intentos: args.intentos,
      codigo: args.codigo,
    },
  };
}

/** No recipient could be resolved for the career when a send was attempted. */
export function escalamientoNotificacionBloqueadaEvent(args: {
  escalamientoId: number;
  solicitudId: number;
  origen: EscalationNoticeTrigger;
  motivo: "sin_destinatarios";
}): AuditEvent {
  return {
    accion: "escalamiento.notificacion_bloqueada",
    entidadTipo: "Escalamiento",
    entidadId: args.escalamientoId,
    datos: {
      solicitudId: args.solicitudId,
      origen: args.origen,
      motivo: args.motivo,
    },
  };
}

/** A secretary asked to resend a notice (state before the attempt). */
export function escalamientoNotificacionReenviadaEvent(args: {
  escalamientoId: number;
  solicitudId: number;
  estadoPrevio: EscalationNoticeState;
}): AuditEvent {
  return {
    accion: "escalamiento.notificacion_reenviada",
    entidadTipo: "Escalamiento",
    entidadId: args.escalamientoId,
    datos: {
      solicitudId: args.solicitudId,
      estadoPrevio: args.estadoPrevio,
    },
  };
}

/**
 * A coordinator's open of the escalation list: the entity is the career of the
 * caller, the payload the count only (RNF-06).
 */
export function escalamientoColaConsultadaEvent(args: {
  carreraId: number;
  total: number;
}): AuditEvent {
  return {
    accion: "escalamiento.cola.consultada",
    entidadTipo: "Carrera",
    entidadId: args.carreraId,
    datos: { total: args.total },
  };
}

/** A remission row was created in the approval transaction (TR-4). */
export function remisionCreadaEvent(args: {
  remisionId: number;
  solicitudId: number;
  estado: RemissionState;
  motivo?: RemissionReason;
}): AuditEvent {
  return {
    accion: "remision.creada",
    entidadTipo: "Remision",
    entidadId: args.remisionId,
    datos: {
      solicitudId: args.solicitudId,
      estado: args.estado,
      ...(args.motivo === undefined ? {} : { motivo: args.motivo }),
    },
  };
}

export function remisionEnviadaEvent(args: {
  remisionId: number;
  solicitudId: number;
  origen: RemissionTrigger;
  intentos: number;
  adjuntos: number;
}): AuditEvent {
  return {
    accion: "remision.enviada",
    entidadTipo: "Remision",
    entidadId: args.remisionId,
    datos: {
      solicitudId: args.solicitudId,
      origen: args.origen,
      intentos: args.intentos,
      adjuntos: args.adjuntos,
    },
  };
}

/** `codigo` is a closed code: the provider's own error text never reaches
 *  the audit log (RNF-06). */
export function remisionFallidaEvent(args: {
  remisionId: number;
  solicitudId: number;
  origen: RemissionTrigger;
  intentos: number;
  codigo: RemissionFailureCode;
}): AuditEvent {
  return {
    accion: "remision.fallida",
    entidadTipo: "Remision",
    entidadId: args.remisionId,
    datos: {
      solicitudId: args.solicitudId,
      origen: args.origen,
      intentos: args.intentos,
      codigo: args.codigo,
    },
  };
}

export function remisionBloqueadaEvent(args: {
  remisionId: number;
  solicitudId: number;
  origen: RemissionTrigger;
  motivo: RemissionReason;
}): AuditEvent {
  return {
    accion: "remision.bloqueada",
    entidadTipo: "Remision",
    entidadId: args.remisionId,
    datos: {
      solicitudId: args.solicitudId,
      origen: args.origen,
      motivo: args.motivo,
    },
  };
}

/** A secretary asked to resend a remission (state before the attempt). */
export function remisionReenviadaEvent(args: {
  remisionId: number;
  solicitudId: number;
  estadoPrevio: RemissionState;
}): AuditEvent {
  return {
    accion: "remision.reenviada",
    entidadTipo: "Remision",
    entidadId: args.remisionId,
    datos: {
      solicitudId: args.solicitudId,
      estadoPrevio: args.estadoPrevio,
    },
  };
}

/** A secretary attached the signed special format (RN-19, TR-15). */
export function documentoFormatoEspecialEvent(args: {
  documentoId: number;
  solicitudId: number;
  tipo: "pdf" | "png" | "jpeg";
  tamanoBytes: number;
  remisionesDesbloqueadas: number;
}): AuditEvent {
  return {
    accion: "documento.formato_especial",
    entidadTipo: "DocumentoRespaldo",
    entidadId: args.documentoId,
    datos: {
      solicitudId: args.solicitudId,
      tipo: args.tipo,
      tamanoBytes: args.tamanoBytes,
      remisionesDesbloqueadas: args.remisionesDesbloqueadas,
    },
  };
}

/**
 * A secretary recorded manual data, the type or a mark of one document
 * (RF-14, MD-32, MD-33). One event per save that changed something. `campos`
 * lists the changed field names only: no value is accepted here, so no name,
 * issuer, date, type code or mark can reach the audit row (RNF-06).
 */
export function documentDataRecordedEvent(args: {
  documentoId: number;
  solicitudId: number;
  campos: readonly DocumentDataField[];
}): AuditEvent {
  return {
    accion: "documento.datos_registrados",
    entidadTipo: "DocumentoRespaldo",
    entidadId: args.documentoId,
    datos: { solicitudId: args.solicitudId, campos: args.campos },
  };
}

export type TouchedAccount = {
  usuarioId: number;
  rol: RolUsuario;
  kind: "creado" | "actualizado";
  /** Ignored for `kind: "creado"` (see `accountCreatedEvent`); required for
   *  `kind: "actualizado"`, where it must list only the fields that
   *  actually changed. */
  campos: readonly AuditableUserField[];
};

/** 1 import event + one per created/updated account. `unchanged` accounts
 *  (absent from `touched`) never produce an event. `importacionSha256`
 *  always propagates from `summary.fileSha256` — never re-derived, never a
 *  second source of truth. */
export function buildAuditEvents(
  summary: ImportSummary,
  touched: readonly TouchedAccount[],
): AuditEvent[] {
  const importOrigin: AuditOrigin = {
    origen: "importacion",
    importacionSha256: summary.fileSha256,
  };
  return [
    importAppliedEvent(summary),
    ...touched.map((t) =>
      t.kind === "creado"
        ? accountCreatedEvent({
            usuarioId: t.usuarioId,
            rol: t.rol,
            origin: importOrigin,
          })
        : accountUpdatedEvent({
            usuarioId: t.usuarioId,
            rol: t.rol,
            campos: t.campos,
            origin: importOrigin,
          }),
    ),
  ];
}

/** The origin of every write made through the catalog screens. It has no
 *  digest field: a manual write cannot be half-filled (AL-PAY). */
export const MANUAL_ORIGIN: AuditOrigin = { origen: "manual" };

/** A created record reports the closed field-name list itself, never a value
 *  (the chosen reading of "field names only" for `*.creada` / `*.creado`). */
export function asignaturaCreatedEvent(args: {
  asignaturaId: number;
  origin: AuditOrigin;
}): AuditEvent {
  return {
    accion: "asignatura.creada",
    entidadTipo: "Asignatura",
    entidadId: args.asignaturaId,
    datos: { campos: AUDITABLE_ASIGNATURA_FIELDS, ...args.origin },
  };
}

export function asignaturaUpdatedEvent(args: {
  asignaturaId: number;
  campos: readonly AuditableAsignaturaField[];
  origin: AuditOrigin;
}): AuditEvent {
  return {
    accion: "asignatura.actualizada",
    entidadTipo: "Asignatura",
    entidadId: args.asignaturaId,
    datos: { campos: args.campos, ...args.origin },
  };
}

export function asignaturaActiveChangedEvent(args: {
  asignaturaId: number;
  activo: boolean;
  origin: AuditOrigin;
}): AuditEvent {
  return {
    accion: args.activo ? "asignatura.reactivada" : "asignatura.desactivada",
    entidadTipo: "Asignatura",
    entidadId: args.asignaturaId,
    datos: { campos: ["activo"], ...args.origin },
  };
}

export function grupoCreatedEvent(args: {
  grupoId: number;
  origin: AuditOrigin;
}): AuditEvent {
  return {
    accion: "grupo.creado",
    entidadTipo: "Grupo",
    entidadId: args.grupoId,
    datos: { campos: AUDITABLE_GRUPO_FIELDS, ...args.origin },
  };
}

export function grupoUpdatedEvent(args: {
  grupoId: number;
  campos: readonly AuditableGrupoField[];
  origin: AuditOrigin;
}): AuditEvent {
  return {
    accion: "grupo.actualizado",
    entidadTipo: "Grupo",
    entidadId: args.grupoId,
    datos: { campos: args.campos, ...args.origin },
  };
}

export function grupoActiveChangedEvent(args: {
  grupoId: number;
  activo: boolean;
  origin: AuditOrigin;
}): AuditEvent {
  return {
    accion: args.activo ? "grupo.reactivado" : "grupo.desactivado",
    entidadTipo: "Grupo",
    entidadId: args.grupoId,
    datos: { campos: ["activo"], ...args.origin },
  };
}

/** Result -> events for a manual Asignatura write. Exactly one event for a
 *  success (`created`, `updated`, `changed`); `[]` for `unchanged` and every
 *  refusal, so a refused or no-op write can never leave an audit row (AL-ONE). */
export function asignaturaWriteEvents(
  r: AsignaturaWriteResult | AsignaturaActiveResult,
): AuditEvent[] {
  switch (r.kind) {
    case "created":
      return [
        asignaturaCreatedEvent({ asignaturaId: r.id, origin: MANUAL_ORIGIN }),
      ];
    case "updated":
      return [
        asignaturaUpdatedEvent({
          asignaturaId: r.id,
          campos: r.campos,
          origin: MANUAL_ORIGIN,
        }),
      ];
    case "changed":
      return [
        asignaturaActiveChangedEvent({
          asignaturaId: r.id,
          activo: r.activo,
          origin: MANUAL_ORIGIN,
        }),
      ];
    case "unchanged":
    case "not_found":
    case "codigo_taken":
    case "carrera_invalid":
    case "has_active_groups":
    case "inactive":
      return [];
    default: {
      const unreachable: never = r;
      return unreachable;
    }
  }
}

/** Result -> events for a manual Grupo write; same contract as
 *  `asignaturaWriteEvents`. */
export function grupoWriteEvents(
  r: GrupoWriteResult | GrupoActiveResult,
): AuditEvent[] {
  switch (r.kind) {
    case "created":
      return [grupoCreatedEvent({ grupoId: r.id, origin: MANUAL_ORIGIN })];
    case "updated":
      return [
        grupoUpdatedEvent({
          grupoId: r.id,
          campos: r.campos,
          origin: MANUAL_ORIGIN,
        }),
      ];
    case "changed":
      return [
        grupoActiveChangedEvent({
          grupoId: r.id,
          activo: r.activo,
          origin: MANUAL_ORIGIN,
        }),
      ];
    case "unchanged":
    case "not_found":
    case "grupo_taken":
    case "asignatura_unavailable":
    case "docente_unavailable":
    case "inactive":
      return [];
    default: {
      const unreachable: never = r;
      return unreachable;
    }
  }
}

/** Result -> events for a manual docente write; same contract as
 *  `asignaturaWriteEvents`. The rol is always `docente`: the data layer only
 *  reads accounts of that role. */
export function docenteWriteEvents(
  r: DocenteWriteResult | DocenteActiveResult,
): AuditEvent[] {
  switch (r.kind) {
    case "updated":
      return [
        accountUpdatedEvent({
          usuarioId: r.id,
          rol: "docente",
          campos: r.campos,
          origin: MANUAL_ORIGIN,
        }),
      ];
    case "changed":
      return [
        accountActiveChangedEvent({
          usuarioId: r.id,
          rol: "docente",
          activo: r.activo,
          origin: MANUAL_ORIGIN,
        }),
      ];
    case "unchanged":
    case "not_found":
    case "inactive":
    case "correo_taken":
    case "has_active_groups":
      return [];
    default: {
      const unreachable: never = r;
      return unreachable;
    }
  }
}

type InscripcionEventArgs = { estudianteId: number; grupoId: number } & (
  | { kind: "creada" | "reactivada" }
  | { kind: "desactivada"; motivo: "baja" | "reemplazo" }
);

/** The entity is the student (`estudianteId`), so the entity index serves "a
 *  student's enrollment history". Ids and the closed reason only (RNF-05). */
export function inscripcionEvent(args: InscripcionEventArgs): AuditEvent {
  return {
    accion: `inscripcion.${args.kind}`,
    entidadTipo: "Inscripcion",
    entidadId: args.estudianteId,
    datos:
      args.kind === "desactivada"
        ? { grupoId: args.grupoId, motivo: args.motivo }
        : { grupoId: args.grupoId },
  };
}

/** Result -> events for a student enrollment write: the deactivated siblings
 *  first, then the creation or reactivation; a drop gives one deactivation.
 *  Every refusal and no-op gives `[]`, so it can never leave a row (AL-ONE). */
export function enrollmentWriteEvents(
  estudianteId: number,
  result: EnrollResult | DropResult | StaleResult,
): AuditEvent[] {
  if (!result.ok) return [];
  if (!("kind" in result)) {
    return [
      inscripcionEvent({
        kind: "desactivada",
        estudianteId,
        grupoId: result.grupoId,
        motivo: "baja",
      }),
    ];
  }
  return [
    ...result.replaced.map((grupoId) =>
      inscripcionEvent({
        kind: "desactivada",
        estudianteId,
        grupoId,
        motivo: "reemplazo",
      }),
    ),
    inscripcionEvent({
      kind: result.kind === "created" ? "creada" : "reactivada",
      estudianteId,
      grupoId: result.grupoId,
    }),
  ];
}

/** The retention run cancelled a student (RNF-04, RN-27, DR-6). The entity is
 *  the student. Counts and the closed reason only: each field is copied by
 *  name, so a name, CIF, email or request id passed in cannot reach the
 *  payload. */
export function accountCancelledEvent(args: {
  usuarioId: number;
  solicitudes: number;
  documentos: number;
}): AuditEvent {
  return {
    accion: "usuario.cancelado",
    entidadTipo: "Usuario",
    entidadId: args.usuarioId,
    datos: {
      motivo: RETENTION_REASON,
      solicitudes: args.solicitudes,
      documentos: args.documentos,
    },
  };
}
