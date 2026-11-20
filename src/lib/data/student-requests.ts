import "server-only";

import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/db";
import {
  documentoRespaldo,
  solicitud,
  solicitudDecision,
  solicitudRevision,
} from "@/db/schema";
import { decisionExcerpt } from "@/lib/data/decision-excerpt";
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

/**
 * The states whose card shows the reason of the latest decision (FE-15). An
 * approved card shows none (owner decision 2026-11-20: the approval text is
 * template boilerplate), so its decision is never read for the list.
 */
const CARD_REASON_STATES: readonly string[] = ["devuelta", "rechazada"];

/** A decision as the student sees it: no secretary, no template code. */
export type OwnDecision = {
  id: number;
  tipo: string;
  motivoCodigo: string | null;
  texto: string | null;
  decididaEn: Date;
};

/**
 * The reason a list card shows. `motivoCodigo` is the RN-17 code of a returned
 * request (always null for a rejected one); `texto` is the excerpt of the
 * decision text, already cut on the server (140 characters), so the complete
 * text never leaves it.
 */
export type OwnCardDecision = {
  motivoCodigo: string | null;
  texto: string | null;
};

/** One card of the student's list: the request, its subjects and its reason. */
export type OwnRequestListItem = OwnRequestRow & {
  /** In the order of `listRequestClasses`: subject code, then group. */
  asignaturas: { codigo: string; nombre: string }[];
  /** Only for a returned or rejected request, else null. */
  decision: OwnCardDecision | null;
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

/**
 * The caller's presented requests, newest first (never a draft), with the
 * subjects and, for a returned or rejected request, the reason of its latest
 * decision. At most three selects for any number of requests: the rows, the
 * classes of every row (`listRequestClasses`) and the decisions of the
 * returned and rejected ones; the latest decision of each is picked in
 * TypeScript. An empty list issues one select.
 */
export async function listOwnRequests(
  userId: number,
): Promise<OwnRequestListItem[]> {
  const rows = await db
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
  if (rows.length === 0) return [];

  const withReason = rows
    .filter((row) => CARD_REASON_STATES.includes(row.estado))
    .map((row) => row.id);
  const [classes, decisions] = await Promise.all([
    listRequestClasses(
      db,
      rows.map((row) => row.id),
    ),
    withReason.length === 0
      ? []
      : db
          .select({
            solicitudId: solicitudDecision.solicitudId,
            motivoCodigo: solicitudDecision.motivoCodigo,
            texto: solicitudDecision.texto,
          })
          .from(solicitudDecision)
          .where(inArray(solicitudDecision.solicitudId, withReason))
          .orderBy(
            asc(solicitudDecision.decididaEn),
            asc(solicitudDecision.id),
          ),
  ]);

  const latest = new Map<number, (typeof decisions)[number]>();
  for (const decision of decisions) latest.set(decision.solicitudId, decision);

  return rows.map((row) => {
    const decision = CARD_REASON_STATES.includes(row.estado)
      ? latest.get(row.id)
      : undefined;
    return {
      ...row,
      asignaturas: (classes.get(row.id) ?? []).map(({ codigo, nombre }) => ({
        codigo,
        nombre,
      })),
      decision: decision
        ? {
            motivoCodigo:
              row.estado === "devuelta" ? decision.motivoCodigo : null,
            texto: decisionExcerpt(decision.texto),
          }
        : null,
    };
  });
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
          // A staff upload (the RN-19 format) is not the student's evidence.
          isNull(documentoRespaldo.subidoPorId),
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

/** The reason the student's own returned request carries, as the secretary wrote it. */
export type CorrectionReason = {
  motivo: string | null;
  texto: string | null;
};

/**
 * The latest decision of the caller's own `devuelta` request: the RN-17 code
 * and the message the correction screen shows (SR-17). Another student's id, a
 * request in any other state and an unknown id are the same `null`. Not
 * audited, like every own read.
 */
export async function getCorrectionReason(
  userId: number,
  id: number,
): Promise<CorrectionReason | null> {
  const [row] = await db
    .select({
      motivo: solicitudDecision.motivoCodigo,
      texto: solicitudDecision.texto,
    })
    .from(solicitudDecision)
    .innerJoin(solicitud, eq(solicitud.id, solicitudDecision.solicitudId))
    .where(
      and(
        eq(solicitudDecision.solicitudId, id),
        eq(solicitud.estudianteId, userId),
        eq(solicitud.estado, "devuelta"),
      ),
    )
    .orderBy(desc(solicitudDecision.decididaEn), desc(solicitudDecision.id))
    .limit(1);
  return row ?? null;
}
