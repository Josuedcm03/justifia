"use server";

import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/dal";
import { rolesRevisores } from "@/lib/auth/permissions";
import { saveDocumentData } from "@/lib/data/document-data";
import { resolveRequestScope } from "@/lib/data/request-scope";
import {
  validateDocumentData,
  type DocumentDataErrors,
} from "@/lib/document-data/validation";

// The secretary's save of the manual data of one document (RF-14 a-d, MD-7,
// MD-9, MD-11, MD-24). It re-checks the session, the role and the facultad scope
// itself, before it reads the payload: a page guard does not protect a Server
// Action (RNF-01). The actor is the session user and the scope comes from the
// database, never from the form. The form arrives as FormData; the validation
// of the eight values is shared with the data layer's contract (D7, D8), and the
// write is one audited transaction in `saveDocumentData`.
//
// A success, whether it changed something or not, redirects to the route the
// form was shown on and never revalidates or refreshes the page, so the audited
// detail read runs once (SR-11); only refusals come back to the form. Any throw
// maps to "unexpected" and the log holds a fixed code and the two ids: a
// Postgres error message can embed the row values (a CHECK violation prints the
// failing row), so the message, the stack and the cause are never logged (MD-11).

export type DocumentDataActionFailure =
  | { ok: false; reason: "not_found" | "not_editable" | "unexpected" }
  | { ok: false; reason: "invalid"; errors: DocumentDataErrors };

const REVIEW_PATH = "/review";
const NOT_FOUND = { ok: false, reason: "not_found" } as const;
const UNEXPECTED: DocumentDataActionFailure = {
  ok: false,
  reason: "unexpected",
};

// The radio value of "Sin registrar", for the marks and for the type select.
const UNREGISTERED = "unregistered";

const POSITIVE_INTEGER = /^[1-9]\d*$/;

function idOf(entry: FormDataEntryValue | null): number | null {
  if (typeof entry !== "string" || !POSITIVE_INTEGER.test(entry)) return null;
  const id = Number(entry);
  return Number.isSafeInteger(id) ? id : null;
}

/** A text, date or choice entry; a file or a missing entry reads as empty. */
function textOf(entry: FormDataEntryValue | null): string | null {
  return typeof entry === "string" ? entry : null;
}

/**
 * The radio of a mark: "yes" is true, "no" is false and "Sin registrar" or an
 * empty entry is null. Anything else passes through as text, so the validation
 * refuses it instead of the mapping clearing a stored mark.
 */
function markOf(entry: FormDataEntryValue | null): unknown {
  const value = textOf(entry);
  if (value === null || value === "" || value === UNREGISTERED) return null;
  if (value === "yes") return true;
  if (value === "no") return false;
  return value;
}

function typeOf(entry: FormDataEntryValue | null): unknown {
  const value = textOf(entry);
  return value === UNREGISTERED ? null : value;
}

/**
 * The session, role and scope checks first, then the form and its two ids.
 * `null` means the document is not found for this caller.
 */
async function authorize(input: unknown) {
  const user = await requireRole(...rolesRevisores);
  const actorId = Number(user.sub);

  const scope = await resolveRequestScope(actorId, user.rol);
  if (scope.kind === "none") return null;
  if (!(input instanceof FormData)) return null;
  const solicitudId = idOf(input.get("solicitudId"));
  const documentoId = idOf(input.get("documentoId"));
  if (solicitudId === null || documentoId === null) return null;
  return { actorId, scope, form: input, solicitudId, documentoId };
}

export async function saveDocumentDataAction(
  input: unknown,
): Promise<DocumentDataActionFailure> {
  const guard = await authorize(input);
  if (!guard) return NOT_FOUND;
  const { actorId, scope, form, solicitudId, documentoId } = guard;

  let outcome;
  try {
    const checked = validateDocumentData({
      studentName: textOf(form.get("studentName")),
      issuer: textOf(form.get("issuer")),
      issueDate: textOf(form.get("issueDate")),
      restFrom: textOf(form.get("restFrom")),
      restTo: textOf(form.get("restTo")),
      type: typeOf(form.get("type")),
      hasSignature: markOf(form.get("hasSignature")),
      hasSeal: markOf(form.get("hasSeal")),
    });
    if (!checked.ok) {
      return { ok: false, reason: "invalid", errors: checked.errors };
    }
    outcome = await saveDocumentData({
      actorId,
      scope,
      solicitudId,
      documentoId,
      data: checked.data,
    });
  } catch {
    console.error("document_data_save_failed", { solicitudId, documentoId });
    return UNEXPECTED;
  }
  if (!outcome.ok) return outcome;
  redirect(`${REVIEW_PATH}/${solicitudId}`);
}
