import "server-only";

import { and, asc, eq, inArray, isNull, lt } from "drizzle-orm";

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
  remisionReenviadaEvent,
} from "@/lib/audit/events";
import type { RemissionFailureCode } from "@/lib/audit/types";
import { insertAuditEvents, type Transaction } from "@/lib/data/audit";
import {
  attemptGivenBack,
  claimRelease,
  claimStamp,
  completeHeld,
  heldBy,
  leaseFree,
  sentStamp,
} from "@/lib/data/outbox";
import { requestInScope } from "@/lib/data/request-scope-sql";
import type { Causa } from "@/lib/intake/causes";
import type { RequestScope } from "@/lib/intake/request-scope";
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
    .set(claimStamp(remision, now))
    .where(
      and(
        eq(remision.id, id),
        inArray(remision.estado, [...claimableStates(trigger)]),
        leaseFree(remision.reclamadaEn, now),
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

type Completion = {
  now: Date;
  /** Session user, or the approving secretary for the scheduled retry. */
  actorId: number;
  origen: RemissionTrigger;
};

/** The provider accepted the message (RF-09 c: the send time is recorded). */
export function completeSent(
  claim: RemissionClaim,
  args: Completion & { providerId: string; adjuntos: number },
): Promise<boolean> {
  return completeHeld(
    remision,
    claim,
    args.actorId,
    {
      estado: "enviada",
      motivoCodigo: null,
      ...sentStamp(args.providerId, args.now),
      ...claimRelease(args.now),
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

/** A failed attempt stays `pendiente` with `error_envio` (RNF-07 b). */
export function completeFailed(
  claim: RemissionClaim,
  args: Completion & { codigo: RemissionFailureCode },
): Promise<boolean> {
  return completeHeld(
    remision,
    claim,
    args.actorId,
    {
      estado: "pendiente",
      motivoCodigo: "error_envio",
      ...attemptGivenBack(remision, args.codigo),
      ...claimRelease(args.now),
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
  return completeHeld(
    remision,
    claim,
    args.actorId,
    {
      estado: "bloqueada",
      motivoCodigo: args.motivo,
      ...claimRelease(args.now),
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
    .where(heldBy(remision, claim))
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
 * The remission a secretary asked to resend, when its request is in her scope.
 * An unknown id and an out-of-scope one are the same `null` (RNF-01), with no
 * audit row. Any resend that is not a no-op (`enviada` sends nothing) writes
 * `remision.reenviada` with the state it started from.
 */
export async function authorizeResend(
  scope: RequestScope,
  remisionId: number,
  actorId: number,
): Promise<{
  id: number;
  solicitudId: number;
  estado: RemissionState;
} | null> {
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select({
        id: remision.id,
        solicitudId: remision.solicitudId,
        estado: remision.estado,
      })
      .from(remision)
      .innerJoin(solicitud, eq(solicitud.id, remision.solicitudId))
      .where(and(eq(remision.id, remisionId), requestInScope(scope)))
      .limit(1);
    if (!target) return null;
    if (target.estado !== "enviada") {
      await insertAuditEvents(tx, actorId, [
        remisionReenviadaEvent({
          remisionId: target.id,
          solicitudId: target.solicitudId,
          estadoPrevio: target.estado,
        }),
      ]);
    }
    return target;
  });
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
        leaseFree(remision.reclamadaEn, now),
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
