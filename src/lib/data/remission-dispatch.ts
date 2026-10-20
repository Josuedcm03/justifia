import "server-only";

import {
  claimRemission,
  completeBlocked,
  completeFailed,
  completeSent,
  findApprovingSecretaryId,
  findTeacherEmail,
  loadRequestForRemission,
  refreshRemissionEmail,
  type DispatchDocument,
  type RemissionClaim,
} from "@/lib/data/remision";
import type {
  DocumentStore,
  MailAttachment,
  MailSender,
} from "@/lib/intake/ports";
import { planRemission } from "@/lib/remission/plan";
import type { RemissionTrigger } from "@/lib/remission/states";
import type { RemissionFailureCode } from "@/lib/audit/types";

// Post-commit dispatch of the teacher remissions (teacher-remission, TR-7):
// claim -> pure plan -> read the documents -> send -> guarded completion with
// its audit row. Approval never depends on this module: every failure is
// contained per row and leaves the remission retryable (RNF-07 a, b).

export type DispatchOptions = {
  trigger: RemissionTrigger;
  /**
   * Session user for audit. Absent only for the scheduled retry, which has no
   * session: the approving secretary of the request is used instead (TR-13).
   */
  actorId?: number;
};

export type DispatchDeps = {
  store: DocumentStore;
  mail: MailSender;
  now?: () => Date;
};

export type DispatchResult =
  /** The claim matched no row: sent already, or another attempt holds it. */
  | { outcome: "skipped" }
  | { outcome: "sent" }
  | { outcome: "failed"; codigo: RemissionFailureCode }
  | { outcome: "blocked"; motivo: string }
  /** The lease was taken over meanwhile; the completion wrote nothing. */
  | { outcome: "lost" };

export type DispatchSummary = {
  sent: number;
  failed: number;
  blocked: number;
  skipped: number;
  lost: number;
  errored: number;
};

const CONTENT_TYPES = {
  pdf: "application/pdf",
  png: "image/png",
  jpeg: "image/jpeg",
} as const;

async function readAll(
  stream: ReadableStream<Uint8Array>,
): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

/**
 * Reads the planned documents from storage. Null when any is missing or the
 * read fails: the remission then stays pending (`error_envio`) for a retry.
 */
async function loadAttachments(
  store: DocumentStore,
  documents: readonly DispatchDocument[],
): Promise<MailAttachment[] | null> {
  const attachments: MailAttachment[] = [];
  for (const document of documents) {
    try {
      const stream = await store.stream(document.pathname);
      if (!stream) return null;
      attachments.push({
        filename: document.nombreOriginal,
        contentType: CONTENT_TYPES[document.tipoDetectado],
        content: await readAll(stream),
      });
    } catch {
      return null;
    }
  }
  return attachments;
}

/** Manual resend after the catalog email was fixed (TR-7 step 1, D6). */
async function withFreshEmail(
  claim: RemissionClaim,
  now: Date,
): Promise<RemissionClaim> {
  if (claim.correo !== null) return claim;
  const fresh = await findTeacherEmail(claim.docenteId);
  if (!fresh) return claim;
  await refreshRemissionEmail(claim, fresh, now);
  return { ...claim, correo: fresh };
}

export async function dispatchRemission(
  id: number,
  options: DispatchOptions,
  deps: DispatchDeps,
): Promise<DispatchResult> {
  const now = (deps.now ?? (() => new Date()))();
  const claimed = await claimRemission(id, options.trigger, now);
  if (!claimed) return { outcome: "skipped" };

  const actorId =
    options.actorId ?? (await findApprovingSecretaryId(claimed.solicitudId));
  // Every approved request has its approval decision; a missing one is a data
  // defect. The claim is left to expire so the retry job tries again.
  if (actorId === null) throw new Error("remission_actor_missing");
  const completion = { now, actorId, origen: options.trigger } as const;

  const claim = await withFreshEmail(claimed, now);
  const context = await loadRequestForRemission(claim.solicitudId);
  if (!context) throw new Error("remission_request_missing");

  const plan = planRemission({
    remisionId: claim.id,
    correo: claim.correo,
    clases: claim.clases,
    solicitud: context.solicitud,
    documentos: context.documentos,
  });

  if (plan.kind === "blocked") {
    const stored = await completeBlocked(claim, {
      ...completion,
      motivo: plan.motivo,
    });
    return stored
      ? { outcome: "blocked", motivo: plan.motivo }
      : { outcome: "lost" };
  }

  const byId = new Map(context.documentos.map((d) => [d.id, d]));
  const selected = plan.documentIds.map((documentId) => {
    const document = byId.get(documentId);
    if (!document) throw new Error("remission_document_missing");
    return document;
  });
  const attachments = await loadAttachments(deps.store, selected);
  if (!attachments) {
    const codigo = "documento_no_disponible";
    const stored = await completeFailed(claim, { ...completion, codigo });
    return stored ? { outcome: "failed", codigo } : { outcome: "lost" };
  }

  const result = await deps.mail.send({
    to: plan.draft.to,
    cc: plan.draft.cc,
    subject: plan.draft.subject,
    text: plan.draft.text,
    attachments,
    idempotencyKey: plan.idempotencyKey,
  });

  if (!result.ok) {
    const stored = await completeFailed(claim, {
      ...completion,
      codigo: result.code,
    });
    return stored
      ? { outcome: "failed", codigo: result.code }
      : { outcome: "lost" };
  }

  const stored = await completeSent(claim, {
    ...completion,
    providerId: result.providerId,
    adjuntos: attachments.length,
  });
  return stored ? { outcome: "sent" } : { outcome: "lost" };
}

/**
 * Dispatches the rows one after another and never throws: a row that blows up
 * is logged by code only (never a message, which could carry an address) and
 * the rest still run (RNF-07 a).
 */
export async function dispatchRemissions(
  ids: readonly number[],
  options: DispatchOptions,
  deps: DispatchDeps,
): Promise<DispatchSummary> {
  const summary: DispatchSummary = {
    sent: 0,
    failed: 0,
    blocked: 0,
    skipped: 0,
    lost: 0,
    errored: 0,
  };
  for (const id of ids) {
    try {
      const result = await dispatchRemission(id, options, deps);
      summary[result.outcome] += 1;
    } catch (error) {
      summary.errored += 1;
      console.error("remission_dispatch_failed", {
        remisionId: id,
        code: error instanceof Error ? error.name : "unknown",
      });
    }
  }
  return summary;
}
