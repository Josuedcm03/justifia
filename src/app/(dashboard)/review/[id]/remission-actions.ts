"use server";

import { requireRole } from "@/lib/auth/dal";
import { rolesRevisores } from "@/lib/auth/permissions";
import { authorizeResend } from "@/lib/data/remision";
import { dispatchRemission } from "@/lib/data/remission-dispatch";
import { resolveRequestScope } from "@/lib/data/request-scope";
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
