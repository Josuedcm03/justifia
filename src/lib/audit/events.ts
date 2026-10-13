// src/lib/audit/events.ts — PURE, total, the ONLY constructors of `AuditEvent`
// (decision 22). No parameter here has a credential type; adding one would be
// a visible signature change, which is what makes a leak compile-time
// impossible. `actorId` and `ocurridoEn` are never accepted: the actor comes
// from the session at write time, and the timestamp is the column default.

import type {
  AsignaturaActiveResult,
  AsignaturaWriteResult,
  GrupoActiveResult,
  GrupoWriteResult,
} from "@/lib/catalog/types";
import type { DecisionKind } from "@/lib/intake/decision-templates";
import type { ReturnReason } from "@/lib/intake/return-reasons";
import type { EstadoSolicitud } from "@/lib/intake/states";
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
  importacionSha256: string;
}): AuditEvent {
  return {
    accion: "usuario.creado",
    entidadTipo: "Usuario",
    entidadId: args.usuarioId,
    datos: {
      campos: AUDITABLE_USER_FIELDS,
      rol: args.rol,
      origen: "importacion",
      importacionSha256: args.importacionSha256,
    },
  };
}

export function accountUpdatedEvent(args: {
  usuarioId: number;
  rol: RolUsuario;
  campos: readonly AuditableUserField[];
  importacionSha256: string;
}): AuditEvent {
  return {
    accion: "usuario.actualizado",
    entidadTipo: "Usuario",
    entidadId: args.usuarioId,
    datos: {
      campos: args.campos,
      rol: args.rol,
      origen: "importacion",
      importacionSha256: args.importacionSha256,
    },
  };
}

export function solicitudPresentadaEvent(args: {
  solicitudId: number;
  asignaturas: number;
  documentos: number;
}): AuditEvent {
  return {
    accion: "solicitud.presentada",
    entidadTipo: "Solicitud",
    entidadId: args.solicitudId,
    datos: { asignaturas: args.asignaturas, documentos: args.documentos },
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

/** A staff open of the queue: the entity is the faculty, the payload a count. */
export function solicitudColaConsultadaEvent(args: {
  facultadId: number;
  total: number;
}): AuditEvent {
  return {
    accion: "solicitud.cola.consultada",
    entidadTipo: "Facultad",
    entidadId: args.facultadId,
    datos: { total: args.total },
  };
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
  return [
    importAppliedEvent(summary),
    ...touched.map((t) =>
      t.kind === "creado"
        ? accountCreatedEvent({
            usuarioId: t.usuarioId,
            rol: t.rol,
            importacionSha256: summary.fileSha256,
          })
        : accountUpdatedEvent({
            usuarioId: t.usuarioId,
            rol: t.rol,
            campos: t.campos,
            importacionSha256: summary.fileSha256,
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
