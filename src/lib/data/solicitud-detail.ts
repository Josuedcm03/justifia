import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import {
  documentoRespaldo,
  escalamiento,
  reporteInasistencia,
  solicitud,
  solicitudDecision,
  solicitudRevision,
  usuario,
  type RevisionClase,
} from "@/db/schema";
import { requestRowInScope } from "@/lib/data/request-scope-sql";
import {
  listRequestClasses,
  type RequestClass,
} from "@/lib/data/solicitud-clases";
import {
  ESCALATION_REASONS,
  type EscalationReason,
  type EscalationNoticeReason,
  type EscalationNoticeState,
} from "@/lib/intake/escalation";
import type { RequestScope } from "@/lib/intake/request-scope";
import { VISIBLE_STATES } from "@/lib/intake/states";

// Staff detail of one request with its history (RF-06, RF-08 b, RN-16). Read
// only. The alert state is computed by the caller from `reenviadaEn ??
// presentadaEn` and the calendar, never stored here. Documents carry no
// storage location: bytes are served only by the authenticated route.

export type DetailDocument = {
  id: number;
  nombreOriginal: string;
  tipoDetectado: string | null;
  tamanoBytes: number;
  creadoEn: Date;
};

export type RetiredDocument = DetailDocument & { retiradoEn: Date };

export type DetailDecision = {
  id: number;
  tipo: string;
  plantillaCodigo: string;
  motivoCodigo: string | null;
  texto: string | null;
  revisionId: number | null;
  secretariaNombre: string;
  decididaEn: Date;
};

export type DetailRevision = {
  id: number;
  numero: number;
  causa: string;
  fechaInicio: string;
  fechaFin: string;
  clases: RevisionClase[];
  documentoIds: number[];
  creadaEn: Date;
};

/** The delivery of a coordination notice, as the outbox stores it. */
type NoticeDelivery = {
  notificacionEstado: EscalationNoticeState;
  notificacionMotivo: EscalationNoticeReason | null;
  enviadaEn: Date | null;
};

/**
 * One escalation of the request, of either motive (RF-10 a, E18). Staff only: the note and
 * the answer are never part of any student payload (ES-14).
 */
export type DetailEscalation = NoticeDelivery & {
  id: number;
  motivo: EscalationReason;
  nota: string | null;
  autorNombre: string;
  creadoEn: Date;
  respuesta: string | null;
  respondidaPorNombre: string | null;
  respondidaEn: Date | null;
};

/**
 * One RF-15 absence report with the delivery of its notice. There is no
 * percentage or count of absences anywhere (RF-15 a).
 */
export type DetailReport = NoticeDelivery & {
  id: number;
  /** The report's notice: the record the resend control acts on. */
  escalamientoId: number;
  docenteNombre: string;
  /** Managua `YYYY-MM-DD`: the day the teacher communicated it. */
  comunicadoEl: string;
  nota: string | null;
  registradoPorNombre: string;
  registradoEn: Date;
};

export type RequestDetail = {
  id: number;
  estado: string;
  causa: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  presentadaEn: Date | null;
  reenviadaEn: Date | null;
  /**
   * The effective clock start a coordination answer stored (RN-08, ES-5), or
   * `null`. The deadline starts at `clockStartOf(detail)`.
   */
  plazoInicioEn: Date | null;
  /** RN-19: the approval was marked for the signed special format. */
  formatoEspecial: boolean;
  /** The special format a secretary uploaded; never among `documentos`. */
  formato: DetailDocument | null;
  /**
   * The consent of the first presentation (RF-01 d, RN-25), or `null` for a
   * request presented before consent existed. A correction never changes it.
   * Staff only: `getOwnRequestDetail` does not select it.
   */
  consentimiento: { version: string; en: Date } | null;
  estudiante: {
    nombre: string | null;
    cif: string | null;
    carrera: string | null;
    correo: string | null;
  };
  clases: RequestClass[];
  documentos: DetailDocument[];
  documentosRetirados: RetiredDocument[];
  decisiones: DetailDecision[];
  revisiones: DetailRevision[];
  escalamientos: DetailEscalation[];
  reportes: DetailReport[];
};

const answerer = alias(usuario, "respondedor");

/**
 * The request when it is in the caller's scope and is not a draft, else
 * `null`: an absent id, a draft and an out-of-scope request are
 * indistinguishable (RNF-01). A `devuelta` or decided request is viewable.
 */
export async function getRequestDetail(
  scope: RequestScope,
  id: number,
): Promise<RequestDetail | null> {
  const [request] = await db
    .select({
      id: solicitud.id,
      estado: solicitud.estado,
      causa: solicitud.causa,
      fechaInicio: solicitud.fechaInicio,
      fechaFin: solicitud.fechaFin,
      presentadaEn: solicitud.presentadaEn,
      reenviadaEn: solicitud.reenviadaEn,
      plazoInicioEn: solicitud.plazoInicioEn,
      estudianteNombre: solicitud.estudianteNombre,
      estudianteCif: solicitud.estudianteCif,
      estudianteCarrera: solicitud.estudianteCarrera,
      estudianteCorreo: solicitud.estudianteCorreo,
      formatoEspecial: solicitud.formatoEspecial,
      consentimientoEn: solicitud.consentimientoEn,
      consentimientoVersion: solicitud.consentimientoVersion,
    })
    .from(solicitud)
    .where(
      and(
        requestRowInScope(scope, id),
        inArray(solicitud.estado, [...VISIBLE_STATES]),
      ),
    )
    .limit(1);
  if (!request) return null;

  const [classes, documents, decisions, revisions, escalations, reports] =
    await Promise.all([
      listRequestClasses(db, [id]),
      db
        .select({
          id: documentoRespaldo.id,
          nombreOriginal: documentoRespaldo.nombreOriginal,
          tipoDetectado: documentoRespaldo.tipoDetectado,
          tamanoBytes: documentoRespaldo.tamanoBytes,
          retiradoEn: documentoRespaldo.retiradoEn,
          formatoEspecial: documentoRespaldo.formatoEspecial,
          creadoEn: documentoRespaldo.creadoEn,
        })
        .from(documentoRespaldo)
        .where(
          and(
            eq(documentoRespaldo.solicitudId, id),
            eq(documentoRespaldo.estado, "valido"),
          ),
        )
        .orderBy(asc(documentoRespaldo.id)),
      db
        .select({
          id: solicitudDecision.id,
          tipo: solicitudDecision.tipo,
          plantillaCodigo: solicitudDecision.plantillaCodigo,
          motivoCodigo: solicitudDecision.motivoCodigo,
          texto: solicitudDecision.texto,
          revisionId: solicitudDecision.revisionId,
          secretariaNombre: usuario.nombreCompleto,
          decididaEn: solicitudDecision.decididaEn,
        })
        .from(solicitudDecision)
        .innerJoin(usuario, eq(usuario.id, solicitudDecision.secretariaId))
        .where(eq(solicitudDecision.solicitudId, id))
        .orderBy(asc(solicitudDecision.decididaEn), asc(solicitudDecision.id)),
      db
        .select({
          id: solicitudRevision.id,
          numero: solicitudRevision.numero,
          causa: solicitudRevision.causa,
          fechaInicio: solicitudRevision.fechaInicio,
          fechaFin: solicitudRevision.fechaFin,
          clases: solicitudRevision.clases,
          documentoIds: solicitudRevision.documentoIds,
          creadaEn: solicitudRevision.creadaEn,
        })
        .from(solicitudRevision)
        .where(eq(solicitudRevision.solicitudId, id))
        .orderBy(asc(solicitudRevision.numero)),
      db
        .select({
          id: escalamiento.id,
          motivo: escalamiento.tipo,
          nota: escalamiento.nota,
          autorNombre: usuario.nombreCompleto,
          creadoEn: escalamiento.creadoEn,
          respuesta: escalamiento.respuesta,
          respondidaPorNombre: answerer.nombreCompleto,
          respondidaEn: escalamiento.respondidaEn,
          notificacionEstado: escalamiento.notificacionEstado,
          notificacionMotivo: escalamiento.notificacionMotivo,
          enviadaEn: escalamiento.enviadaEn,
        })
        .from(escalamiento)
        .innerJoin(usuario, eq(usuario.id, escalamiento.secretariaId))
        .leftJoin(answerer, eq(answerer.id, escalamiento.respondidaPorId))
        .where(
          and(
            eq(escalamiento.solicitudId, id),
            inArray(escalamiento.tipo, [...ESCALATION_REASONS]),
          ),
        )
        .orderBy(asc(escalamiento.creadoEn), asc(escalamiento.id)),
      // Each report has exactly one notice (the same transaction creates both).
      db
        .select({
          id: reporteInasistencia.id,
          escalamientoId: escalamiento.id,
          docenteNombre: reporteInasistencia.docenteNombre,
          comunicadoEl: reporteInasistencia.comunicadoEl,
          nota: reporteInasistencia.nota,
          registradoPorNombre: usuario.nombreCompleto,
          registradoEn: reporteInasistencia.registradoEn,
          notificacionEstado: escalamiento.notificacionEstado,
          notificacionMotivo: escalamiento.notificacionMotivo,
          enviadaEn: escalamiento.enviadaEn,
        })
        .from(reporteInasistencia)
        .innerJoin(usuario, eq(usuario.id, reporteInasistencia.registradoPorId))
        .innerJoin(
          escalamiento,
          eq(escalamiento.reporteId, reporteInasistencia.id),
        )
        .where(eq(reporteInasistencia.solicitudId, id))
        .orderBy(
          asc(reporteInasistencia.registradoEn),
          asc(reporteInasistencia.id),
        ),
    ]);

  const current: DetailDocument[] = [];
  const retired: RetiredDocument[] = [];
  let format: DetailDocument | null = null;
  for (const { retiradoEn, formatoEspecial, ...doc } of documents) {
    if (formatoEspecial) format = doc;
    else if (retiradoEn === null) current.push(doc);
    else retired.push({ ...doc, retiradoEn });
  }

  return {
    id: request.id,
    estado: request.estado,
    causa: request.causa,
    fechaInicio: request.fechaInicio,
    fechaFin: request.fechaFin,
    presentadaEn: request.presentadaEn,
    reenviadaEn: request.reenviadaEn,
    plazoInicioEn: request.plazoInicioEn,
    formatoEspecial: request.formatoEspecial,
    formato: format,
    // Both or neither (CK_Solicitud_Consentimiento); half a pair is never shown.
    consentimiento:
      request.consentimientoEn && request.consentimientoVersion
        ? {
            version: request.consentimientoVersion,
            en: request.consentimientoEn,
          }
        : null,
    estudiante: {
      nombre: request.estudianteNombre,
      cif: request.estudianteCif,
      carrera: request.estudianteCarrera,
      correo: request.estudianteCorreo,
    },
    clases: classes.get(id) ?? [],
    documentos: current,
    documentosRetirados: retired,
    decisiones: decisions,
    revisiones: revisions,
    escalamientos: escalations.map((e) => ({
      ...e,
      motivo: e.motivo as EscalationReason,
    })),
    reportes: reports,
  };
}
