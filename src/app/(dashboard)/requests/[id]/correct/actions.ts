"use server";

import { redirect } from "next/navigation";

import type { ActionResult } from "@/app/(dashboard)/requests/new/actions";
import {
  fail,
  finalize,
  remove,
  saveDetails,
  saveSubjects,
  scheduleExtraction,
  submissionErrors,
} from "@/app/(dashboard)/requests/new/step-actions";
import { requireRole } from "@/lib/auth/dal";
import { rolesSolicitantes } from "@/lib/auth/permissions";
import { resubmitCorrection } from "@/lib/data/solicitud-correction";
import { getIntakeDeps } from "@/lib/intake/deps";
import { requestIdSchema } from "@/lib/validations/solicitud";

// Server actions of the correction flow (RF-08, RNF-01). The same discipline as
// the intake actions: each one re-checks the session and the student role, takes
// the student from the session only and edits only that student's own returned
// request. The request id is the one thing the client names; the data layer
// guards every write by owner and `devuelta`, so a foreign or already
// resubmitted id changes nothing. A resubmission is handed to document
// extraction once it committed (DE-5); the hand-off never fails it.

const notCorrectable = () => fail("form", "not_correctable");

async function correctionOf(solicitudId: unknown) {
  const user = await requireRole(...rolesSolicitantes);
  const id = requestIdSchema.safeParse(solicitudId);
  return id.success
    ? {
        userId: Number(user.sub),
        target: { kind: "correction", solicitudId: id.data } as const,
      }
    : null;
}

export async function saveCorrectionDetailsAction(
  solicitudId: unknown,
  input: unknown,
): Promise<ActionResult> {
  const edit = await correctionOf(solicitudId);
  return edit ? saveDetails(edit.userId, edit.target, input) : notCorrectable();
}

export async function saveCorrectionSubjectsAction(
  solicitudId: unknown,
  input: unknown,
): Promise<ActionResult> {
  const edit = await correctionOf(solicitudId);
  return edit
    ? saveSubjects(edit.userId, edit.target, input)
    : notCorrectable();
}

export async function finalizeCorrectionDocumentAction(
  solicitudId: unknown,
  input: unknown,
): Promise<ActionResult & { documentId?: number }> {
  const edit = await correctionOf(solicitudId);
  return edit ? finalize(edit.userId, edit.target, input) : notCorrectable();
}

export async function removeCorrectionDocumentAction(
  solicitudId: unknown,
  documentId: unknown,
): Promise<ActionResult> {
  const edit = await correctionOf(solicitudId);
  return edit ? remove(edit.userId, edit.target, documentId) : notCorrectable();
}

/**
 * Resubmit the caller's corrected request. The payload is only the id: the
 * data, subjects and documents come from the stored request, the timestamp from
 * this server's clock and the student snapshot stays as presented (RN-02).
 */
export async function resubmitCorrectionAction(
  solicitudId: unknown,
): Promise<ActionResult> {
  const edit = await correctionOf(solicitudId);
  if (!edit) return notCorrectable();

  const now = new Date();
  const outcome = await resubmitCorrection({
    userId: edit.userId,
    solicitudId: edit.target.solicitudId,
    now,
    schedule: getIntakeDeps().schedule,
  });
  if (outcome.ok) {
    await scheduleExtraction(edit.target.solicitudId, now);
    redirect(`/requests/${edit.target.solicitudId}?corrected=1`);
  }
  if (outcome.reason === "invalid") {
    return { ok: false, errors: submissionErrors(outcome.errors) };
  }
  return outcome.reason === "conflict"
    ? fail("form", "submit_conflict")
    : notCorrectable();
}
