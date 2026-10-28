import "server-only";

import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import {
  carrera,
  documentoRespaldo,
  escalamiento,
  reporteInasistencia,
  solicitud,
  usuario,
} from "@/db/schema";
import { escalationInScope } from "@/lib/data/coordination-scope-sql";
import {
  listRequestClasses,
  type RequestClass,
} from "@/lib/data/solicitud-clases";
import type { CoordinationScope } from "@/lib/intake/coordination-scope";
import {
  ESCALATION_REASON,
  EXCESS_NOTICE_KIND,
  type EscalationKind,
} from "@/lib/intake/escalation";
import { VISIBLE_STATES, type EstadoSolicitud } from "@/lib/intake/states";
import { sourceOf } from "@/lib/intake/transitions";

// What a coordinator reads (E1, E10, RNF-01): the open suspicions of the own
// career, the informational notices, and the detail of either. Read only, and
// deliberately separate from the secretary readers: every statement is scoped by
// `escalationInScope` (the student's CURRENT career), none selects the student's
// email, the consent or the decision history, and the class data comes only
// through the `solicitud-clases` seam. `none` reads nothing.

/** The state a suspicion holds the request in (the coordinator's source state). */
const COORDINATION_STATE = sourceOf("pendiente", "coordinacion");

export type OpenEscalationRow = {
  /** The escalation id: the detail is keyed by it, not by the request. */
  id: number;
  estudianteNombre: string | null;
  estudianteCif: string | null;
  motivo: EscalationKind;
  /** When the secretary escalated it (oldest first). */
  creadoEn: Date;
};

export type NoticeRow = {
  id: number;
  estudianteNombre: string | null;
  estudianteCif: string | null;
  docenteNombre: string;
  /** Managua `YYYY-MM-DD`: the day the teacher communicated it. */
  comunicadoEl: string;
  creadoEn: Date;
};

/**
 * The open suspicions of the career, oldest first, whatever their notification
 * state (a blocked notice must not hide one), then its notices, newest first.
 */
export async function listCoordinationEscalations(
  scope: CoordinationScope,
): Promise<{ open: OpenEscalationRow[]; notices: NoticeRow[] }> {
  if (scope.kind === "none") return { open: [], notices: [] };

  const [open, notices] = await Promise.all([
    db
      .select({
        id: escalamiento.id,
        estudianteNombre: solicitud.estudianteNombre,
        estudianteCif: solicitud.estudianteCif,
        motivo: escalamiento.tipo,
        creadoEn: escalamiento.creadoEn,
      })
      .from(escalamiento)
      .innerJoin(solicitud, eq(solicitud.id, escalamiento.solicitudId))
      .where(
        and(
          eq(escalamiento.tipo, ESCALATION_REASON),
          isNull(escalamiento.respondidaEn),
          eq(solicitud.estado, COORDINATION_STATE),
          escalationInScope(scope),
        ),
      )
      .orderBy(asc(escalamiento.creadoEn), asc(escalamiento.id)),
    db
      .select({
        id: escalamiento.id,
        estudianteNombre: solicitud.estudianteNombre,
        estudianteCif: solicitud.estudianteCif,
        docenteNombre: reporteInasistencia.docenteNombre,
        comunicadoEl: reporteInasistencia.comunicadoEl,
        creadoEn: escalamiento.creadoEn,
      })
      .from(escalamiento)
      .innerJoin(solicitud, eq(solicitud.id, escalamiento.solicitudId))
      .innerJoin(
        reporteInasistencia,
        eq(reporteInasistencia.id, escalamiento.reporteId),
      )
      .where(
        and(
          eq(escalamiento.tipo, EXCESS_NOTICE_KIND),
          inArray(solicitud.estado, [...VISIBLE_STATES]),
          escalationInScope(scope),
        ),
      )
      .orderBy(desc(escalamiento.creadoEn), desc(escalamiento.id)),
  ]);

  return {
    open: open.map((row) => ({ ...row, motivo: row.motivo as EscalationKind })),
    notices,
  };
}

type Student = { nombre: string | null; cif: string | null; carrera: string };

/** A document the coordinator may open; no storage location, as for staff. */
export type CoordinationDocument = {
  id: number;
  nombreOriginal: string;
  tipoDetectado: string | null;
  tamanoBytes: number;
  creadoEn: Date;
};

/**
 * An open suspicion: everything needed to answer it. Never the student's email,
 * the consent state or the decision history.
 */
export type OpenEscalationDetail = {
  kind: "escalation";
  id: number;
  solicitudId: number;
  estado: EstadoSolicitud;
  motivo: EscalationKind;
  nota: string;
  creadoEn: Date;
  estudiante: Student;
  causa: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  clases: RequestClass[];
  documentos: CoordinationDocument[];
};

/** An informational notice: no documents, cause or dates, and nothing to answer. */
export type NoticeDetail = {
  kind: "notice";
  id: number;
  solicitudId: number;
  estado: EstadoSolicitud;
  creadoEn: Date;
  estudiante: Student;
  docenteNombre: string;
  comunicadoEl: string;
  nota: string | null;
};

export type CoordinationDetail = OpenEscalationDetail | NoticeDetail;

const student = alias(usuario, "estudiante");

/**
 * The detail of one escalation record of the career, or `null`: an unknown id,
 * another career, an answered suspicion and a draft are indistinguishable
 * (RNF-01). The career of the student is read live (ES-3).
 */
export async function getCoordinationDetail(
  scope: CoordinationScope,
  escalamientoId: number,
): Promise<CoordinationDetail | null> {
  if (scope.kind === "none") return null;

  const [row] = await db
    .select({
      id: escalamiento.id,
      solicitudId: solicitud.id,
      tipo: escalamiento.tipo,
      nota: escalamiento.nota,
      creadoEn: escalamiento.creadoEn,
      respondidaEn: escalamiento.respondidaEn,
      estado: solicitud.estado,
      causa: solicitud.causa,
      fechaInicio: solicitud.fechaInicio,
      fechaFin: solicitud.fechaFin,
      estudianteNombre: solicitud.estudianteNombre,
      estudianteCif: solicitud.estudianteCif,
      carrera: carrera.nombre,
      docenteNombre: reporteInasistencia.docenteNombre,
      comunicadoEl: reporteInasistencia.comunicadoEl,
      reporteNota: reporteInasistencia.nota,
    })
    .from(escalamiento)
    .innerJoin(solicitud, eq(solicitud.id, escalamiento.solicitudId))
    .innerJoin(student, eq(student.id, solicitud.estudianteId))
    .innerJoin(carrera, eq(carrera.id, student.carreraId))
    .leftJoin(
      reporteInasistencia,
      eq(reporteInasistencia.id, escalamiento.reporteId),
    )
    .where(and(eq(escalamiento.id, escalamientoId), escalationInScope(scope)));
  if (!row) return null;

  const estado = row.estado as EstadoSolicitud;
  const estudiante: Student = {
    nombre: row.estudianteNombre,
    cif: row.estudianteCif,
    carrera: row.carrera,
  };

  if (row.tipo === EXCESS_NOTICE_KIND) {
    if (
      !(VISIBLE_STATES as readonly string[]).includes(estado) ||
      row.docenteNombre === null ||
      row.comunicadoEl === null
    ) {
      return null;
    }
    return {
      kind: "notice",
      id: row.id,
      solicitudId: row.solicitudId,
      estado,
      creadoEn: row.creadoEn,
      estudiante,
      docenteNombre: row.docenteNombre,
      comunicadoEl: row.comunicadoEl,
      nota: row.reporteNota,
    };
  }

  // A suspicion is reachable only while it is open and the request waits in
  // coordination; once answered it leaves the coordinator's reach.
  if (
    row.tipo !== ESCALATION_REASON ||
    row.respondidaEn !== null ||
    row.nota === null ||
    estado !== COORDINATION_STATE
  ) {
    return null;
  }

  const [classes, documents] = await Promise.all([
    listRequestClasses(db, [row.solicitudId]),
    db
      .select({
        id: documentoRespaldo.id,
        nombreOriginal: documentoRespaldo.nombreOriginal,
        tipoDetectado: documentoRespaldo.tipoDetectado,
        tamanoBytes: documentoRespaldo.tamanoBytes,
        creadoEn: documentoRespaldo.creadoEn,
      })
      .from(documentoRespaldo)
      .where(
        and(
          eq(documentoRespaldo.solicitudId, row.solicitudId),
          eq(documentoRespaldo.estado, "valido"),
          isNull(documentoRespaldo.retiradoEn),
          eq(documentoRespaldo.formatoEspecial, false),
        ),
      )
      .orderBy(asc(documentoRespaldo.id)),
  ]);

  return {
    kind: "escalation",
    id: row.id,
    solicitudId: row.solicitudId,
    estado,
    motivo: ESCALATION_REASON,
    nota: row.nota,
    creadoEn: row.creadoEn,
    estudiante,
    causa: row.causa,
    fechaInicio: row.fechaInicio,
    fechaFin: row.fechaFin,
    clases: classes.get(row.solicitudId) ?? [],
    documentos: documents,
  };
}
