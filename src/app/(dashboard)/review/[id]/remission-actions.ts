"use server";

import { after } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth/dal";
import { rolesRevisores } from "@/lib/auth/permissions";
import { authorizeResend } from "@/lib/data/remision";
import {
  dispatchRemission,
  dispatchRemissions,
} from "@/lib/data/remission-dispatch";
import { resolveRequestScope } from "@/lib/data/request-scope";
import { attachSpecialFormat } from "@/lib/data/special-format";
import { getIntakeDeps } from "@/lib/intake/deps";
import type { RemissionReason, RemissionState } from "@/lib/remission/states";

// The staff actions on a remission (teacher-remission, RF-09 c, RNF-01). Each
// one re-checks the session, the role and the facultad scope itself: a page
// guard does not protect a Server Action. An unknown id and an out-of-scope id
// get the same answer. Neither action revalidates or redirects, so the audited
// detail read cannot run a second time (SR-11); the control shows the outcome
// it receives and the next page load shows the stored state.

export type ResendResult =
  | { ok: true; estado: RemissionState; motivo: RemissionReason | null }
  | { ok: false; reason: "not_found" | "unexpected" };

const NOT_FOUND: ResendResult = { ok: false, reason: "not_found" };

export async function resendRemissionAction(
  remisionId: unknown,
): Promise<ResendResult> {
  const user = await requireRole(...rolesRevisores);
  const actorId = Number(user.sub);

  if (
    typeof remisionId !== "number" ||
    !Number.isSafeInteger(remisionId) ||
    remisionId <= 0
  ) {
    return NOT_FOUND;
  }
  const scope = await resolveRequestScope(actorId, user.rol);
  if (scope.kind === "none") return NOT_FOUND;

  const target = await authorizeResend(scope, remisionId, actorId);
  if (!target) return NOT_FOUND;
  // A sent remission is never sent twice: report it as it is.
  if (target.estado === "enviada") {
    return { ok: true, estado: "enviada", motivo: null };
  }

  try {
    const result = await dispatchRemission(
      remisionId,
      { trigger: "reenvio_manual", actorId },
      getIntakeDeps(),
    );
    switch (result.outcome) {
      case "sent":
        return { ok: true, estado: "enviada", motivo: null };
      case "failed":
        return { ok: true, estado: "pendiente", motivo: "error_envio" };
      case "blocked":
        return {
          ok: true,
          estado: "bloqueada",
          motivo: result.motivo as RemissionReason,
        };
      default:
        // Another attempt holds it, or the lease was taken over: still pending.
        return { ok: true, estado: "pendiente", motivo: null };
    }
  } catch (error) {
    console.error("remission_resend_failed", {
      remisionId,
      code: error instanceof Error ? error.name : "unknown",
    });
    return { ok: false, reason: "unexpected" };
  }
}

export type AttachSpecialFormatResult =
  | { ok: true; documentId: number; remisionIds: number[] }
  | {
      ok: false;
      reason:
        | "not_allowed"
        | "not_found"
        | "already_attached"
        | "empty_file"
        | "too_large"
        | "unsupported_format"
        | "unexpected";
    };

const NOT_ALLOWED: AttachSpecialFormatResult = {
  ok: false,
  reason: "not_allowed",
};

const attachSchema = z.object({
  pathname: z.string().min(1).max(512),
  nombreOriginal: z.string().max(1024),
});

/**
 * Sends the unblocked remissions after the response (TR-11): each carries a
 * file of up to 10 MiB, so awaiting them could outlast the action. A failure
 * is logged by code only; the retry job and "Reenviar" recover the rows.
 */
async function dispatchAttached(remisionIds: number[], actorId: number) {
  try {
    await dispatchRemissions(
      remisionIds,
      { trigger: "formato_especial", actorId },
      getIntakeDeps(),
    );
  } catch (error) {
    console.error("remission_dispatch_failed", {
      code: error instanceof Error ? error.name : "unknown",
    });
  }
}

function scheduleDispatch(remisionIds: number[], actorId: number) {
  try {
    after(() => dispatchAttached(remisionIds, actorId));
  } catch (error) {
    console.error("remission_dispatch_not_scheduled", {
      code: error instanceof Error ? error.name : "unknown",
    });
  }
}

/**
 * Attaches the uploaded special format of an approved, marked request (RN-19).
 * Every denial (role, scope, unknown id, unmarked, undecided, a pathname of
 * another request) is the same `not_allowed`.
 */
export async function attachSpecialFormatAction(
  solicitudId: unknown,
  payload: unknown,
): Promise<AttachSpecialFormatResult> {
  const user = await requireRole(...rolesRevisores);
  const actorId = Number(user.sub);

  const file = attachSchema.safeParse(payload);
  if (
    typeof solicitudId !== "number" ||
    !Number.isSafeInteger(solicitudId) ||
    solicitudId <= 0 ||
    !file.success
  ) {
    return NOT_ALLOWED;
  }
  const scope = await resolveRequestScope(actorId, user.rol);
  if (scope.kind === "none") return NOT_ALLOWED;

  try {
    const deps = getIntakeDeps();
    const result = await attachSpecialFormat(
      { actorId, scope, solicitudId, ...file.data },
      deps.store,
    );
    if (!result.ok) return { ok: false, reason: result.reason };
    if (result.dispatchIds.length > 0)
      scheduleDispatch(result.dispatchIds, actorId);
    return {
      ok: true,
      documentId: result.documentId,
      remisionIds: result.dispatchIds,
    };
  } catch (error) {
    console.error("special_format_attach_failed", {
      solicitudId,
      code: error instanceof Error ? error.name : "unknown",
    });
    return { ok: false, reason: "unexpected" };
  }
}
