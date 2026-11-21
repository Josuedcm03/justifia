"use server";

import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { requireEnrollmentAccess } from "@/lib/auth/enrollment-access";
import type { ActiveToggleState } from "@/lib/catalog/types";
import {
  staffDropGroup,
  staffEnrollInGroup,
} from "@/lib/data/enrollment-write";
import type { DropResult, EnrollResult } from "@/lib/enrollment/types";
import { parseRecordId } from "@/lib/validations/catalog";
import { staffEnrollmentInputSchema } from "@/lib/validations/inscripcion";

// Server Actions of /catalog/inscripciones (enrollment-administration EA-ACC-1,
// EA-SCOPE-1, CS-9). An action is reachable by a direct POST, so it does not
// inherit the page guard: it authorizes first (nothing of the body is read
// before the guard resolves), takes the actor and the scope only from the
// guard, validates every id it was given, and writes only through the staff
// writer, which re-checks the actor and the facultad scope inside its own
// transaction and writes the audit rows. The student id is a BOUND argument,
// and bound arguments are visible to the browser (Next `forms.md`), so it is
// treated as client input like the form fields.

const LIST_PATH = "/catalog/inscripciones";

/**
 * The toggle of one inscripcion of a student: `ActiveToggle` posts the group id
 * as `id` and the closed `intent`; the table binds the student id first
 * (`setInscripcionActivoAction.bind(null, estudianteId)`). Deactivation drops
 * the row of any period (D9); reactivation is the reactivate-only mode of the
 * staff writer, which refuses a missing row, a group that is not offered and a
 * sibling with `not_eligible` and never creates or replaces: the replace needs
 * the confirmation of the assign page (EA-SIB-1), which this toggle lacks.
 */
export async function setInscripcionActivoAction(
  estudianteId: number,
  _prev: ActiveToggleState,
  formData: FormData,
): Promise<ActiveToggleState> {
  const { actorId, scope } = await requireEnrollmentAccess();
  const t = await getTranslations("catalog");
  // A secretaria without a facultad changes nothing; the writer would answer
  // `not_student` anyway, so it is not even called.
  if (scope.kind === "none") return { kind: "gone" };

  // The desired state arrives as a closed intent, never as a free boolean.
  const intent = formData.get("intent");
  if (intent !== "deactivate" && intent !== "reactivate") {
    return { kind: "gone" };
  }

  // A forged or malformed id never reaches the writer. The form field is a
  // string, so it is parsed to a number before the schema (which takes
  // numbers) sees it; an extra `actorId` in any payload is never read.
  const parsed = staffEnrollmentInputSchema.safeParse({
    estudianteId,
    grupoId: parseRecordId(formData.get("id")),
  });
  if (!parsed.success) {
    return { kind: "error", message: t("inscripciones.errors.unexpected") };
  }

  const staff = { actorId, scope };
  const { estudianteId: student, grupoId } = parsed.data;

  let result: DropResult | EnrollResult;
  try {
    result =
      intent === "deactivate"
        ? await staffDropGroup(staff, student, grupoId)
        : await staffEnrollInGroup(staff, student, grupoId, {
            reactivateOnly: true,
          });
  } catch {
    // The writer already logged one sanitised line and stored nothing; the
    // thrown text is never shown.
    return { kind: "error", message: t("inscripciones.errors.unexpected") };
  }

  if (!result.ok) {
    switch (result.reason) {
      case "not_student":
        return { kind: "gone" };
      case "not_enrolled":
        return { kind: "unchanged" };
      case "already_enrolled":
        return {
          kind: "error",
          message: t("inscripciones.errors.already_enrolled"),
        };
      case "not_eligible":
        return {
          kind: "error",
          message: t("inscripciones.errors.not_eligible"),
        };
    }
  }

  revalidatePath(LIST_PATH);
  return { kind: "done", activo: intent === "reactivate" };
}
