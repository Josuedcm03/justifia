"use server";

import { redirect } from "next/navigation";

import {
  fail,
  finalize,
  remove,
  saveDetails,
  saveSubjects,
  scheduleExtraction,
  submissionErrors,
} from "@/app/(dashboard)/requests/new/step-actions";
import { draftRange } from "@/app/(dashboard)/requests/new/steps";
import { requireRole } from "@/lib/auth/dal";
import { rolesSolicitantes } from "@/lib/auth/permissions";
import { listEligibleGroups } from "@/lib/data/enrollment";
import {
  discardDraft,
  getLiveDraft,
  submitDraft,
} from "@/lib/data/solicitudes";
import { CONSENT_VERSION } from "@/lib/intake/consent";
import { managuaToday } from "@/lib/intake/dates";
import { getIntakeDeps } from "@/lib/intake/deps";
import { validateSubmission } from "@/lib/intake/submission";
import {
  submitPayloadSchema,
  type FieldError,
} from "@/lib/validations/solicitud";

// Server actions of the intake flow (RNF-01). Every action re-checks the
// session and the student role itself (pages do not protect actions), takes the
// student identity from the session only, and finds the draft through it: no
// action receives a draft id, so another student's draft cannot even be named.
// Draft operations write no audit row (D14); the submit audits inside its own
// transaction (see `submitDraft`). Once that transaction commits, the request
// is handed to document extraction (DE-5); the hand-off never fails the submit.

const FLOW_PATH = "/requests/new";
const CONFIRMATION_PATH = "/requests/new/confirmation";
const DRAFT = { kind: "draft" } as const;

export type ActionResult = { ok: true } | { ok: false; errors: FieldError[] };

async function currentStudentId(): Promise<number> {
  const user = await requireRole(...rolesSolicitantes);
  return Number(user.sub);
}

export async function saveDetailsAction(input: unknown): Promise<ActionResult> {
  return saveDetails(await currentStudentId(), DRAFT, input);
}

export async function saveSubjectsAction(
  input: unknown,
): Promise<ActionResult> {
  return saveSubjects(await currentStudentId(), DRAFT, input);
}

export async function finalizeDocumentAction(
  input: unknown,
): Promise<ActionResult & { documentId?: number }> {
  return finalize(await currentStudentId(), DRAFT, input);
}

export async function removeDocumentAction(
  documentId: unknown,
): Promise<ActionResult> {
  return remove(await currentStudentId(), DRAFT, documentId);
}

/** Confirmed discard (RNF-12): the confirmation dialog lives in the UI. */
export async function discardDraftAction(): Promise<ActionResult> {
  const userId = await currentStudentId();

  const discarded = await discardDraft(userId, getIntakeDeps().store);
  if (!discarded) return fail("form", "no_draft");
  redirect(FLOW_PATH);
}

/**
 * Submit the caller's stored draft. The payload carries only the consent
 * version the client showed (RC-5): cause, dates, subjects and documents come
 * from the draft, the student snapshot from the account and the timestamp from
 * this server's clock (RN-02, RN-06, A5). A missing, malformed or outdated
 * version is refused with `consent_required` / `consent_outdated` beside every
 * other error (fail closed); what is stored is the server's own constant.
 */
export async function submitRequestAction(
  input: unknown,
): Promise<ActionResult> {
  const userId = await currentStudentId();
  const now = new Date();
  const payload = submitPayloadSchema.safeParse(input);
  const consentVersion = payload.success ? payload.data.consentVersion : null;

  const draft = await getLiveDraft(userId, now);
  if (!draft) return fail("form", "no_draft");

  const groups = await listEligibleGroups(
    userId,
    draftRange(draft),
    getIntakeDeps().schedule,
  );
  const validation = validateSubmission(
    {
      causa: draft.causa,
      fechaInicio: draft.fechaInicio,
      fechaFin: draft.fechaFin,
      selections: draft.subjects,
      eligibleGroups: groups,
      validDocumentCount: draft.documents.filter((d) => d.estado === "valido")
        .length,
      consentVersion,
    },
    managuaToday(now),
  );
  if (!validation.ok) {
    return { ok: false, errors: submissionErrors(validation.errors) };
  }

  const outcome = await submitDraft({
    userId,
    solicitudId: draft.id,
    now,
    causa: draft.causa as string,
    fechaInicio: draft.fechaInicio as string,
    fechaFin: draft.fechaFin as string,
    grupoIds: draft.subjects.map((s) => s.grupoId),
    // The server constant, once validation proved the client showed it.
    consentimientoVersion: CONSENT_VERSION,
  });
  if (!outcome.ok) {
    return fail(
      "form",
      outcome.reason === "conflict" ? "submit_conflict" : "profile_incomplete",
    );
  }
  await scheduleExtraction(draft.id, now);
  redirect(CONFIRMATION_PATH);
}
