import type { ActionResult } from "@/app/(dashboard)/requests/new/actions";
import { draftRange } from "@/app/(dashboard)/requests/new/steps";
import type { DocumentRejectionReason } from "@/lib/audit/types";
import { finalizeDocument, removeDocument } from "@/lib/data/documentos";
import { listEligibleGroups } from "@/lib/data/enrollment";
import {
  getLiveDraft,
  saveDraftDetails,
  saveDraftSubjects,
  type EditTarget,
} from "@/lib/data/solicitudes";
import { managuaToday } from "@/lib/intake/dates";
import {
  resolveGroupChoices,
  validateSubjectSelections,
} from "@/lib/intake/eligibility";
import { getIntakeDeps } from "@/lib/intake/deps";
import {
  documentIdSchema,
  errorKey,
  finalizeDocumentSchema,
  makeDetailsStepSchema,
  subjectsStepSchema,
  toFieldErrors,
  type FieldError,
} from "@/lib/validations/solicitud";

// Logic of the intake steps shared by the new-request actions and the
// correction actions (SR-13). Deliberately NOT a "use server" module: every
// export of one would become a public endpoint. The callers resolve the
// student from the session and the `EditTarget` (the caller's draft, or the
// caller's own returned request) and pass both in, so no identity ever comes
// from the payload.

export function fail(
  field: string,
  code: string,
): { ok: false; errors: FieldError[] } {
  return { ok: false, errors: [{ field, key: errorKey(code) }] };
}

/** Field errors for the codes a submit validation reports. */
export function submissionErrors(
  errors: readonly { field: string; code: string; asignaturaId?: number }[],
): FieldError[] {
  return errors.map(({ field, code, asignaturaId }) => ({
    field,
    key: errorKey(code),
    ...(asignaturaId === undefined ? {} : { asignaturaId }),
  }));
}

/** What the student sees when the target is gone, taken, or no longer open. */
function unavailable(target: EditTarget) {
  return fail("form", target.kind === "draft" ? "no_draft" : "not_correctable");
}

export async function saveDetails(
  userId: number,
  target: EditTarget,
  input: unknown,
): Promise<ActionResult> {
  const now = new Date();

  const parsed = makeDetailsStepSchema(managuaToday(now), {
    filingWindow: target.kind === "draft",
  }).safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: toFieldErrors(parsed.error) };
  }
  const saved = await saveDraftDetails(userId, now, parsed.data, target);
  return saved ? { ok: true } : unavailable(target);
}

export async function saveSubjects(
  userId: number,
  target: EditTarget,
  input: unknown,
): Promise<ActionResult> {
  const now = new Date();

  const parsed = subjectsStepSchema.safeParse(input);
  if (!parsed.success) return fail("form", "invalid_input");

  const draft = await getLiveDraft(userId, now, target);
  if (!draft) return unavailable(target);
  const range = draftRange(draft);
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
    target,
  );
  return saved ? { ok: true } : unavailable(target);
}

export async function finalize(
  userId: number,
  target: EditTarget,
  input: unknown,
): Promise<ActionResult & { documentId?: number }> {
  const parsed = finalizeDocumentSchema.safeParse(input);
  if (!parsed.success) return fail("form", "invalid_input");

  const result = await finalizeDocument(
    { userId, ...parsed.data, target },
    getIntakeDeps().store,
  );
  return result.ok
    ? { ok: true, documentId: result.documentId }
    : fail("documents", result.reason satisfies DocumentRejectionReason);
}

export async function remove(
  userId: number,
  target: EditTarget,
  documentId: unknown,
): Promise<ActionResult> {
  const parsed = documentIdSchema.safeParse(documentId);
  if (!parsed.success) return fail("form", "invalid_input");

  const result = await removeDocument(
    { userId, documentId: parsed.data, target },
    getIntakeDeps().store,
  );
  return result.ok ? { ok: true } : fail("documents", result.reason);
}
