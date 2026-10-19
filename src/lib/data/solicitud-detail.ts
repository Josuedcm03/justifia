import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  documentoRespaldo,
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

export type RequestDetail = {
  id: number;
  estado: string;
  causa: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  presentadaEn: Date | null;
  reenviadaEn: Date | null;
  /** RN-19: the approval was marked for the signed special format. */
  formatoEspecial: boolean;
  /** The special format a secretary uploaded; never among `documentos`. */
  formato: DetailDocument | null;
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
};

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
      estudianteNombre: solicitud.estudianteNombre,
      estudianteCif: solicitud.estudianteCif,
      estudianteCarrera: solicitud.estudianteCarrera,
      estudianteCorreo: solicitud.estudianteCorreo,
      formatoEspecial: solicitud.formatoEspecial,
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

  const [classes, documents, decisions, revisions] = await Promise.all([
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
    formatoEspecial: request.formatoEspecial,
    formato: format,
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
  };
}
