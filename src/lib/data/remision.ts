import "server-only";

import { randomUUID } from "node:crypto";

import { and, asc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import type { PgUpdateSetSource } from "drizzle-orm/pg-core";

import { db } from "@/db";
import {
  documentoRespaldo,
  remision,
  solicitud,
  solicitudDecision,
  usuario,
  type RevisionClase,
} from "@/db/schema";
import {
  remisionBloqueadaEvent,
  remisionEnviadaEvent,
  remisionFallidaEvent,
} from "@/lib/audit/events";
import type { RemissionFailureCode } from "@/lib/audit/types";
import { insertAuditEvents, type Transaction } from "@/lib/data/audit";
import type { Causa } from "@/lib/intake/causes";
import { MAX_AUTO_ATTEMPTS, RETRY_BATCH_SIZE } from "@/lib/remission/limits";
import type { PlanBlocker, PlanDocument } from "@/lib/remission/plan";
import {
  claimableStates,
  type RemissionReason,
  type RemissionState,
  type RemissionTrigger,
} from "@/lib/remission/states";

// The ONLY module that writes `Remision` after creation (teacher-remission,
// TR-1): the claim, the guarded completions, the unblock of RN-19 and the
// reads of the outbox. Creation is the one insert elsewhere, inside the
// approval transaction (`solicitud-decision.ts`); a structural test pins both.

/**
 * How long a claim blocks other attempts (TR-6). Longer than any function
 * duration, so only a crashed or cut-off attempt is ever taken over.
 */
export const CLAIM_LEASE_MS = 10 * 60 * 1000;

/** Longest provider message id the column holds. */
const PROVIDER_ID_MAX = 100;

/** A remission as the dispatcher sees it right after winning the claim. */
export type RemissionClaim = {
  id: number;
  solicitudId: number;
  docenteId: number;
  docenteNombre: string;
  correo: string | null;
  clases: RevisionClase[];
  /** State when claimed, i.e. before this attempt changes anything. */
  estado: RemissionState;
  motivoCodigo: RemissionReason | null;
  /** Attempts including this one. */
  intentos: number;
  reclamoId: string;
};

function leaseCutoff(now: Date): Date {
  return new Date(now.getTime() - CLAIM_LEASE_MS);
}

/**
 * Guarded claim of one remission (TR-6): `UPDATE ... WHERE ... RETURNING`.
 * Matches only a state the trigger may start from and a claim that is absent
 * or expired; `enviada` is in no trigger's list. Null means another attempt
 * holds it or it is already sent: skip silently.
 */
export async function claimRemission(
  id: number,
  trigger: RemissionTrigger,
  now: Date = new Date(),
): Promise<RemissionClaim | null> {
  const [claimed] = await db
    .update(remision)
    .set({
      reclamoId: randomUUID(),
      reclamadaEn: now,
      intentos: sql`${remision.intentos} + 1`,
      actualizadaEn: now,
    })
    .where(
      and(
        eq(remision.id, id),
        inArray(remision.estado, [...claimableStates(trigger)]),
        or(
          isNull(remision.reclamadaEn),
          lt(remision.reclamadaEn, leaseCutoff(now)),
        ),
      ),
    )
    .returning({
      id: remision.id,
      solicitudId: remision.solicitudId,
      docenteId: remision.docenteId,
      docenteNombre: remision.docenteNombre,
      correo: remision.correo,
      clases: remision.clases,
      estado: remision.estado,
      motivoCodigo: remision.motivoCodigo,
      intentos: remision.intentos,
      reclamoId: remision.reclamoId,
    });
  return (claimed as RemissionClaim | undefined) ?? null;
}

/** Matches the row only while this attempt still holds its claim. */
function heldBy(claim: RemissionClaim) {
  return and(
    eq(remision.id, claim.id),
    eq(remision.reclamoId, claim.reclamoId),
  );
}

type Completion = {
  now: Date;
  /** Session user, or the approving secretary for the scheduled retry. */
  actorId: number;
  origen: RemissionTrigger;
};

/**
 * Applies one guarded completion and its audit row in a single transaction.
 * A worker whose lease was taken over matches no row, writes nothing and
 * reports `false`. The claim is always released (TR-6).
 */
async function complete(
  claim: RemissionClaim,
  actorId: number,
  set: PgUpdateSetSource<typeof remision>,
  event: Parameters<typeof insertAuditEvents>[2][number],
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(remision)
      .set(set)
      .where(heldBy(claim))
      .returning({ id: remision.id });
    if (updated.length === 0) return false;
    await insertAuditEvents(tx, actorId, [event]);
    return true;
  });
}

/** The provider accepted the message (RF-09 c: the send time is recorded). */
export function completeSent(
  claim: RemissionClaim,
  args: Completion & { providerId: string; adjuntos: number },
): Promise<boolean> {
  return complete(
    claim,
    args.actorId,
    {
      estado: "enviada",
      enviadaEn: args.now,
      proveedorMensajeId: args.providerId.slice(0, PROVIDER_ID_MAX),
      motivoCodigo: null,
      reclamoId: null,
      reclamadaEn: null,
      actualizadaEn: args.now,
    },
    remisionEnviadaEvent({
      remisionId: claim.id,
      solicitudId: claim.solicitudId,
      origen: args.origen,
      intentos: claim.intentos,
      adjuntos: args.adjuntos,
    }),
  );
}

/**
 * A failed attempt stays `pendiente` with `error_envio` (RNF-07 b). When the
 * mail service is not configured yet the attempt is given back: rows wait for
 * the keys without exhausting the automatic-retry cap before the first send.
 */
export function completeFailed(
  claim: RemissionClaim,
  args: Completion & { codigo: RemissionFailureCode },
): Promise<boolean> {
  return complete(
    claim,
    args.actorId,
    {
      estado: "pendiente",
      motivoCodigo: "error_envio",
      ...(args.codigo === "not_configured"
        ? { intentos: sql`greatest(${remision.intentos} - 1, 0)` }
        : {}),
      reclamoId: null,
      reclamadaEn: null,
      actualizadaEn: args.now,
    },
    remisionFallidaEvent({
      remisionId: claim.id,
      solicitudId: claim.solicitudId,
      origen: args.origen,
      intentos: claim.intentos,
      codigo: args.codigo,
    }),
  );
}

/** A blocker found at dispatch: nothing is sent, the reason is shown. */
export function completeBlocked(
  claim: RemissionClaim,
  args: Completion & { motivo: PlanBlocker },
): Promise<boolean> {
  return complete(
    claim,
    args.actorId,
    {
      estado: "bloqueada",
      motivoCodigo: args.motivo,
      reclamoId: null,
      reclamadaEn: null,
      actualizadaEn: args.now,
    },
    remisionBloqueadaEvent({
      remisionId: claim.id,
      solicitudId: claim.solicitudId,
      origen: args.origen,
      motivo: args.motivo,
    }),
  );
}

/**
 * Manual resend of a `sin_correo` remission after the catalog email was fixed
 * (TR-7 step 1): stores the new address while the claim is still held.
 */
export async function refreshRemissionEmail(
  claim: RemissionClaim,
  correo: string,
  now: Date = new Date(),
): Promise<boolean> {
  const updated = await db
    .update(remision)
    .set({ correo, actualizadaEn: now })
    .where(heldBy(claim))
    .returning({ id: remision.id });
  return updated.length > 0;
}

/** One teacher's remission as the staff detail shows it (RF-09 c). */
export type RemissionView = {
  id: number;
  docenteNombre: string;
  correo: string | null;
  clases: RevisionClase[];
  estado: RemissionState;
  motivoCodigo: RemissionReason | null;
  enviadaEn: Date | null;
  intentos: number;
};

/**
 * The remissions of a request, for the staff detail. The caller has already
 * proven the request is in scope (`getRequestDetail`); no claim columns are
 * returned.
 */
export async function listRemissions(
  solicitudId: number,
): Promise<RemissionView[]> {
  return db
    .select({
      id: remision.id,
      docenteNombre: remision.docenteNombre,
      correo: remision.correo,
      clases: remision.clases,
      estado: remision.estado,
      motivoCodigo: remision.motivoCodigo,
      enviadaEn: remision.enviadaEn,
      intentos: remision.intentos,
    })
    .from(remision)
    .where(eq(remision.solicitudId, solicitudId))
    .orderBy(asc(remision.docenteNombre), asc(remision.id));
}

/**
 * RN-19, on the upload's transaction: `formato_especial_faltante` rows become
 * `pendiente`; a row blocked for another reason (for example `sin_correo`)
 * stays blocked. `dispatchIds` adds the request's other pending rows, so a
 * dispatch that was cut off before blocking them is finished too (TR-15).
 */
export async function unblockSpecialFormat(
  tx: Transaction,
  solicitudId: number,
  now: Date = new Date(),
): Promise<{ unblockedIds: number[]; dispatchIds: number[] }> {
  const unblocked = await tx
    .update(remision)
    .set({ estado: "pendiente", motivoCodigo: null, actualizadaEn: now })
    .where(
      and(
        eq(remision.solicitudId, solicitudId),
        eq(remision.estado, "bloqueada"),
        eq(remision.motivoCodigo, "formato_especial_faltante"),
      ),
    )
    .returning({ id: remision.id });
  const others = await tx
    .select({ id: remision.id })
    .from(remision)
    .where(
      and(
        eq(remision.solicitudId, solicitudId),
        eq(remision.estado, "pendiente"),
      ),
    )
    .orderBy(asc(remision.id));

  const unblockedIds = unblocked.map((r) => r.id);
  const already = new Set(unblockedIds);
  return {
    unblockedIds,
    dispatchIds: [
      ...unblockedIds,
      ...others.map((r) => r.id).filter((id) => !already.has(id)),
    ],
  };
}

/**
 * Rows the retry job may dispatch (TR-12): pending, free or expired claim,
 * under the automatic-attempt cap, oldest first, one bounded batch.
 */
export async function selectRetryCandidates(
  now: Date = new Date(),
): Promise<number[]> {
  const rows = await db
    .select({ id: remision.id })
    .from(remision)
    .where(
      and(
        eq(remision.estado, "pendiente"),
        or(
          isNull(remision.reclamadaEn),
          lt(remision.reclamadaEn, leaseCutoff(now)),
        ),
        lt(remision.intentos, MAX_AUTO_ATTEMPTS),
      ),
    )
    .orderBy(asc(remision.creadaEn), asc(remision.id))
    .limit(RETRY_BATCH_SIZE);
  return rows.map((r) => r.id);
}

/**
 * The secretary who approved the request: the audit actor of the scheduled
 * retry, which has no session (TR-13). Never taken from request input.
 */
export async function findApprovingSecretaryId(
  solicitudId: number,
): Promise<number | null> {
  const [row] = await db
    .select({ secretariaId: solicitudDecision.secretariaId })
    .from(solicitudDecision)
    .where(
      and(
        eq(solicitudDecision.solicitudId, solicitudId),
        eq(solicitudDecision.tipo, "aprobada"),
      ),
    )
    .orderBy(asc(solicitudDecision.decididaEn))
    .limit(1);
  return row?.secretariaId ?? null;
}

/** What the plan needs about the request, as recorded at submission. */
export type RemissionRequestContext = {
  solicitud: {
    causa: Causa;
    fechaInicio: string;
    fechaFin: string;
    estudianteNombre: string;
    estudianteCif: string;
    estudianteCorreo: string;
    formatoEspecial: boolean;
  };
  /** Current valid documents, student uploads and the staff format alike. */
  documentos: DispatchDocument[];
};

/** A plan document plus the storage path the dispatcher reads bytes from. */
export type DispatchDocument = PlanDocument & { pathname: string };

/**
 * The request fields and current valid documents behind a remission (TR-7
 * step 2). Null when the request is gone or lacks a presented-request field.
 */
export async function loadRequestForRemission(
  solicitudId: number,
): Promise<RemissionRequestContext | null> {
  const [row] = await db
    .select({
      causa: solicitud.causa,
      fechaInicio: solicitud.fechaInicio,
      fechaFin: solicitud.fechaFin,
      estudianteNombre: solicitud.estudianteNombre,
      estudianteCif: solicitud.estudianteCif,
      estudianteCorreo: solicitud.estudianteCorreo,
      formatoEspecial: solicitud.formatoEspecial,
    })
    .from(solicitud)
    .where(eq(solicitud.id, solicitudId))
    .limit(1);
  if (
    !row ||
    !row.causa ||
    !row.fechaInicio ||
    !row.fechaFin ||
    !row.estudianteNombre ||
    !row.estudianteCif ||
    !row.estudianteCorreo
  ) {
    return null;
  }

  const documentos = await db
    .select({
      id: documentoRespaldo.id,
      pathname: documentoRespaldo.pathname,
      nombreOriginal: documentoRespaldo.nombreOriginal,
      tipoDetectado: documentoRespaldo.tipoDetectado,
      tamanoBytes: documentoRespaldo.tamanoBytes,
      subidoPorId: documentoRespaldo.subidoPorId,
      formatoEspecial: documentoRespaldo.formatoEspecial,
    })
    .from(documentoRespaldo)
    .where(
      and(
        eq(documentoRespaldo.solicitudId, solicitudId),
        eq(documentoRespaldo.estado, "valido"),
        isNull(documentoRespaldo.retiradoEn),
      ),
    )
    .orderBy(asc(documentoRespaldo.id));

  return {
    solicitud: {
      causa: row.causa as Causa,
      fechaInicio: row.fechaInicio,
      fechaFin: row.fechaFin,
      estudianteNombre: row.estudianteNombre,
      estudianteCif: row.estudianteCif,
      estudianteCorreo: row.estudianteCorreo,
      formatoEspecial: row.formatoEspecial,
    },
    documentos: documentos as DispatchDocument[],
  };
}

/** Current catalog email of a teacher (resend after the email was fixed). */
export async function findTeacherEmail(
  docenteId: number,
): Promise<string | null> {
  const [row] = await db
    .select({ correo: usuario.correo })
    .from(usuario)
    .where(eq(usuario.id, docenteId))
    .limit(1);
  return row?.correo ?? null;
}
