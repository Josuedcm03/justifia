import "server-only";

import type { MailFailureCode } from "@/lib/audit/types";
import {
  claimEscalationNotice,
  completeNoticeBlocked,
  completeNoticeFailed,
  completeNoticeNotConfigured,
  completeNoticeSent,
  listCoordinationRecipients,
  loadNoticeContext,
  releaseNoticeClaim,
  type EscalationNoticeClaim,
} from "@/lib/data/escalamiento";
import { dispatchEach, type DispatchSummary } from "@/lib/data/dispatch-batch";
import { planEscalationNotice } from "@/lib/escalation/plan";
import {
  reasonAfterUnconfiguredRelease,
  type EscalationNoticeReason,
  type EscalationNoticeTrigger,
} from "@/lib/intake/escalation";
import type { MailSender } from "@/lib/intake/ports";

// Post-commit dispatch of the coordination notices (escalation, ES-11): claim
// -> resolve the recipients now -> pure plan -> send -> guarded completion with
// its audit row. An escalation or a report never depends on this module: every
// failure is contained per row and leaves the notice retryable (RNF-07 a, b).

export type EscalationDispatchOptions = {
  trigger: EscalationNoticeTrigger;
  /**
   * Session user for audit. Absent only for the scheduled retry, which has no
   * session: the secretary who created the notice is used instead.
   */
  actorId?: number;
};

export type EscalationDispatchDeps = {
  mail: MailSender;
  /** `APP_BASE_URL`; unset leaves the notice `pendiente`. */
  baseUrl: string | undefined;
  now?: () => Date;
};

export type EscalationDispatchResult =
  /**
   * Nothing was attempted. Without a reason the claim matched no row (sent
   * already, or another attempt holds it); `not_configured` means the mail
   * service has no keys yet: the notice stays `pendiente` with no failure, no
   * audit row and no attempt counted. `motivo` is the reason the notice keeps
   * (an earlier send failure stays), so the caller reports what is stored.
   */
  | {
      outcome: "skipped";
      reason?: "not_configured";
      motivo?: EscalationNoticeReason | null;
    }
  | { outcome: "sent" }
  | { outcome: "failed"; codigo: MailFailureCode }
  | { outcome: "blocked"; motivo: "sin_destinatarios" }
  /** The lease was taken over meanwhile; the completion wrote nothing. */
  | { outcome: "lost" };

async function releaseUnconfigured(
  claim: EscalationNoticeClaim,
  now: Date,
): Promise<EscalationDispatchResult> {
  const stored = await completeNoticeNotConfigured(claim, { now });
  return stored
    ? {
        outcome: "skipped",
        reason: "not_configured",
        motivo: reasonAfterUnconfiguredRelease(claim),
      }
    : { outcome: "lost" };
}

export async function dispatchEscalationNotice(
  id: number,
  options: EscalationDispatchOptions,
  deps: EscalationDispatchDeps,
): Promise<EscalationDispatchResult> {
  const now = (deps.now ?? (() => new Date()))();
  const claim = await claimEscalationNotice(id, options.trigger, now);
  if (!claim) return { outcome: "skipped" };

  const completion = {
    now,
    actorId: options.actorId ?? claim.secretariaId,
    origen: options.trigger,
  } as const;

  // Recipients are resolved at every attempt, never frozen at escalation time.
  const [context, recipients] = await Promise.all([
    loadNoticeContext(id),
    listCoordinationRecipients(claim.solicitudId),
  ]);
  if (!context) {
    // A data defect, not a send failure: free the claim so the lease does not
    // hold off the resend, and still surface the error to the caller's log.
    await releaseNoticeClaim(claim, { now }).catch(() => false);
    throw new Error("escalation_notice_context_missing");
  }

  const plan = planEscalationNotice({
    ...context,
    recipients,
    baseUrl: deps.baseUrl,
  });

  if (plan.kind === "blocked") {
    const stored = await completeNoticeBlocked(claim, completion);
    return stored
      ? { outcome: "blocked", motivo: plan.motivo }
      : { outcome: "lost" };
  }

  if (plan.kind === "not_configured") {
    return releaseUnconfigured(claim, completion.now);
  }

  const result = await deps.mail.send({
    to: plan.draft.to,
    cc: plan.draft.cc,
    subject: plan.draft.subject,
    text: plan.draft.text,
    html: plan.draft.html,
    // Only the inline brand image: a coordination notice never attaches a
    // request document (E6).
    attachments: plan.draft.attachments,
    idempotencyKey: plan.idempotencyKey,
  });

  // The provider's own "no key yet" is the same: it never saw the message.
  if (!result.ok && result.code === "not_configured") {
    return releaseUnconfigured(claim, completion.now);
  }

  if (!result.ok) {
    const stored = await completeNoticeFailed(claim, {
      ...completion,
      codigo: result.code,
    });
    return stored
      ? { outcome: "failed", codigo: result.code }
      : { outcome: "lost" };
  }

  const stored = await completeNoticeSent(claim, {
    ...completion,
    providerId: result.providerId,
    destinatarios: plan.destinatarios,
  });
  return stored ? { outcome: "sent" } : { outcome: "lost" };
}

/** Dispatches the notices one after another and never throws. */
export function dispatchEscalationNotices(
  ids: readonly number[],
  options: EscalationDispatchOptions,
  deps: EscalationDispatchDeps,
): Promise<DispatchSummary> {
  return dispatchEach(
    ids,
    (id) => dispatchEscalationNotice(id, options, deps),
    {
      event: "escalation_notice_dispatch_failed",
      idKey: "escalamientoId",
    },
  );
}
