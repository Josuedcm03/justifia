"use server";

import { redirect } from "next/navigation";

import type { DocumentRejectionReason } from "@/lib/audit/types";
import { requireRole } from "@/lib/auth/dal";
import { rolesSolicitantes } from "@/lib/auth/permissions";
import { finalizeDocument, removeDocument } from "@/lib/data/documentos";
import { listEligibleGroups } from "@/lib/data/enrollment";
import {
  discardDraft,
  getLiveDraft,
  saveDraftDetails,
  saveDraftSubjects,
  submitDraft,
  type Draft,
} from "@/lib/data/solicitudes";
import { isIsoDate, managuaToday } from "@/lib/intake/dates";
import {
  resolveGroupChoices,
  validateSubjectSelections,
} from "@/lib/intake/eligibility";
import { getIntakeDeps } from "@/lib/intake/deps";
import { validateSubmission } from "@/lib/intake/submission";
import {
  documentIdSchema,
  errorKey,
  finalizeDocumentSchema,
  makeDetailsStepSchema,
  subjectsStepSchema,
  toFieldErrors,
  type FieldError,
} from "@/lib/validations/solicitud";

// Server actions of the intake flow (RNF-01). Every action re-checks the
// session and the student role itself (pages do not protect actions), takes the
// student identity from the session only, and finds the draft through it: no
// action receives a draft id, so another student's draft cannot even be named.
// Draft operations write no audit row (D14); the submit audits inside its own
// transaction (see `submitDraft`).

const FLOW_PATH = "/requests/new";
const CONFIRMATION_PATH = "/requests/new/confirmation";

export type ActionResult = { ok: true } | { ok: false; errors: FieldError[] };

function fail(
  field: string,
  code: string,
): { ok: false; errors: FieldError[] } {
  return { ok: false, errors: [{ field, key: errorKey(code) }] };
}

async function currentStudentId(): Promise<number> {
  const user = await requireRole(...rolesSolicitantes);
  return Number(user.sub);
}

/** Dates usable as a schedule range: both real dates, start not after end. */
function rangeOf(draft: Draft): { from: string; to: string } | null {
  const { fechaInicio: from, fechaFin: to } = draft;
  return isIsoDate(from) && isIsoDate(to) && from <= to ? { from, to } : null;
}

export async function saveDetailsAction(input: unknown): Promise<ActionResult> {
  const userId = await currentStudentId();
  const now = new Date();

  const parsed = makeDetailsStepSchema(managuaToday(now)).safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: toFieldErrors(parsed.error) };
  }
  const saved = await saveDraftDetails(userId, now, parsed.data);
  return saved ? { ok: true } : fail("form", "no_draft");
}

export async function saveSubjectsAction(
  input: unknown,
): Promise<ActionResult> {
  const userId = await currentStudentId();
  const now = new Date();

  const parsed = subjectsStepSchema.safeParse(input);
  if (!parsed.success) return fail("form", "invalid_input");

  const draft = await getLiveDraft(userId, now);
  if (!draft) return fail("form", "no_draft");
  const range = rangeOf(draft);
  if (!range) return fail("subjects", "dates_required");

  const groups = await listEligibleGroups(
    userId,
    range,
    getIntakeDeps().schedule,
  );
  const selections = resolveGroupChoices(parsed.data.selections, groups);
  const errors = validateSubjectSelections(selections, groups);
  if (errors.length > 0) {
    return {
      ok: false,
      errors: errors.map((e) => ({
        field: "subjects",
        key: errorKey(e.code),
        asignaturaId: e.asignaturaId,
      })),
    };
  }

  const saved = await saveDraftSubjects(
    userId,
    now,
    selections.flatMap((s) => (s.grupoId === null ? [] : [s.grupoId])),
  );
  return saved ? { ok: true } : fail("form", "no_draft");
}

export async function finalizeDocumentAction(
  input: unknown,
): Promise<ActionResult & { documentId?: number }> {
  const userId = await currentStudentId();

  const parsed = finalizeDocumentSchema.safeParse(input);
  if (!parsed.success) return fail("form", "invalid_input");

  const result = await finalizeDocument(
    { userId, ...parsed.data },
    getIntakeDeps().store,
  );
  return result.ok
    ? { ok: true, documentId: result.documentId }
    : fail("documents", result.reason satisfies DocumentRejectionReason);
}

export async function removeDocumentAction(
  documentId: unknown,
): Promise<ActionResult> {
  const userId = await currentStudentId();

  const parsed = documentIdSchema.safeParse(documentId);
  if (!parsed.success) return fail("form", "invalid_input");

  const result = await removeDocument(
    { userId, documentId: parsed.data },
    getIntakeDeps().store,
  );
  return result.ok ? { ok: true } : fail("documents", result.reason);
}

/** Confirmed discard (RNF-12): the confirmation dialog lives in the UI. */
export async function discardDraftAction(): Promise<ActionResult> {
  const userId = await currentStudentId();

  const discarded = await discardDraft(userId, getIntakeDeps().store);
  if (!discarded) return fail("form", "no_draft");
  redirect(FLOW_PATH);
}

/**
 * Submit the caller's stored draft. The payload is deliberately empty: cause,
 * dates, subjects and documents come from the draft, the student snapshot from
 * the account and the timestamp from this server's clock (RN-02, RN-06, A5).
 */
export async function submitRequestAction(): Promise<ActionResult> {
  const userId = await currentStudentId();
  const now = new Date();

  const draft = await getLiveDraft(userId, now);
  if (!draft) return fail("form", "no_draft");

  const groups = await listEligibleGroups(
    userId,
    rangeOf(draft),
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
    },
    managuaToday(now),
  );
  if (!validation.ok) {
    return {
      ok: false,
      errors: validation.errors.map(({ field, code, asignaturaId }) => ({
        field,
        key: errorKey(code),
        ...(asignaturaId === undefined ? {} : { asignaturaId }),
      })),
    };
  }

  const outcome = await submitDraft({
    userId,
    solicitudId: draft.id,
    now,
    causa: draft.causa as string,
    fechaInicio: draft.fechaInicio as string,
    fechaFin: draft.fechaFin as string,
    grupoIds: draft.subjects.map((s) => s.grupoId),
  });
  if (!outcome.ok) {
    return fail(
      "form",
      outcome.reason === "conflict" ? "submit_conflict" : "profile_incomplete",
    );
  }
  redirect(CONFIRMATION_PATH);
}
