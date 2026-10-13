import "server-only";

import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/db";
import {
  documentoRespaldo,
  solicitud,
  solicitudDecision,
  solicitudRevision,
} from "@/db/schema";
import {
  listRequestClasses,
  type RequestClass,
} from "@/lib/data/solicitud-clases";
import type {
  DetailDocument,
  DetailRevision,
} from "@/lib/data/solicitud-detail";
import { VISIBLE_STATES } from "@/lib/intake/states";

// The student's own requests (RF-07 c, RF-08 b, RNF-01). Every query filters by
// the owner the caller read from the session and by the visible states, so
// another student's id, an unknown id and a draft are the same empty answer.
// Own reads are not audited (student-requests spec): nothing here writes.

/** The decided or returned states whose latest decision the detail shows. */
const DECIDED_STATES: readonly string[] = ["devuelta", "rechazada", "aprobada"];

export type OwnRequestRow = {
  id: number;
  estado: string;
  causa: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  presentadaEn: Date | null;
  reenviadaEn: Date | null;
};

/** A decision as the student sees it: no secretary, no template code. */
export type OwnDecision = {
  id: number;
  tipo: string;
  motivoCodigo: string | null;
  texto: string | null;
  decididaEn: Date;
};

export type OwnRequestDetail = OwnRequestRow & {
  clases: RequestClass[];
  documentos: DetailDocument[];
  /** The latest decision, only while the request is returned or decided. */
  decision: OwnDecision | null;
  /** Every other decision, oldest first. */
  historial: OwnDecision[];
  revisiones: DetailRevision[];
};

/** The caller's presented requests, newest first (never a draft). */
export async function listOwnRequests(
  userId: number,
): Promise<OwnRequestRow[]> {
  return db
    .select({
      id: solicitud.id,
      estado: solicitud.estado,
      causa: solicitud.causa,
      fechaInicio: solicitud.fechaInicio,
      fechaFin: solicitud.fechaFin,
      presentadaEn: solicitud.presentadaEn,
      reenviadaEn: solicitud.reenviadaEn,
    })
    .from(solicitud)
    .where(
      and(
        eq(solicitud.estudianteId, userId),
        inArray(solicitud.estado, [...VISIBLE_STATES]),
      ),
    )
    .orderBy(desc(solicitud.presentadaEn), desc(solicitud.id));
}

/** The caller's own presented request with its history, else `null`. */
export async function getOwnRequestDetail(
  userId: number,
  id: number,
): Promise<OwnRequestDetail | null> {
  const [request] = await db
    .select({
      id: solicitud.id,
      estado: solicitud.estado,
      causa: solicitud.causa,
      fechaInicio: solicitud.fechaInicio,
      fechaFin: solicitud.fechaFin,
      presentadaEn: solicitud.presentadaEn,
      reenviadaEn: solicitud.reenviadaEn,
    })
    .from(solicitud)
    .where(
      and(
        eq(solicitud.id, id),
        eq(solicitud.estudianteId, userId),
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
        creadoEn: documentoRespaldo.creadoEn,
      })
      .from(documentoRespaldo)
      .where(
        and(
          eq(documentoRespaldo.solicitudId, id),
          eq(documentoRespaldo.estado, "valido"),
          isNull(documentoRespaldo.retiradoEn),
        ),
      )
      .orderBy(asc(documentoRespaldo.id)),
    db
      .select({
        id: solicitudDecision.id,
        tipo: solicitudDecision.tipo,
        motivoCodigo: solicitudDecision.motivoCodigo,
        texto: solicitudDecision.texto,
        decididaEn: solicitudDecision.decididaEn,
      })
      .from(solicitudDecision)
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

  const showsDecision = DECIDED_STATES.includes(request.estado);
  const current = showsDecision ? (decisions.at(-1) ?? null) : null;

  return {
    ...request,
    clases: classes.get(id) ?? [],
    documentos: documents,
    decision: current,
    historial: current ? decisions.slice(0, -1) : decisions,
    revisiones: revisions,
  };
}
