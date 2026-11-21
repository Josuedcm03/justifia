"use server";

import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { requireEnrollmentAccess } from "@/lib/auth/enrollment-access";
import type {
  ActiveToggleState,
  AssignInscripcionState,
} from "@/lib/catalog/types";
import {
  staffDropGroup,
  staffEnrollInGroup,
} from "@/lib/data/enrollment-write";
import type {
  DropResult,
  EnrollResult,
  StaffEnrollResult,
} from "@/lib/enrollment/types";
import { parseRecordId } from "@/lib/validations/catalog";
import {
  assignEnrollmentInputSchema,
  staffEnrollmentInputSchema,
} from "@/lib/validations/inscripcion";

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
 * the row of any period (D9); reactivation is the staff writer's default, which
 * is reactivate only: it refuses a missing row, a group that is not offered and
 * a sibling with `not_eligible` and never creates or replaces (the replace
 * needs the option and the confirmation of the assign page, EA-SIB-1).
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
        : await staffEnrollInGroup(staff, student, grupoId);
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

/**
 * Creates, reactivates or changes the group of one inscripcion (EA-CRE-1,
 * EA-CHG-1, EA-SIB-1). The assign page's confirm step calls it with explicit
 * arguments, `(estudianteId, grupoId, expectedReplaced)`, so there is no form to
 * read. It is the ONLY caller that passes `allowReplaceAndCreate`: the staff
 * writer fails closed, so the list toggle can never create or replace.
 *
 * `expectedReplaced` is the group the user SAW and confirmed as the one being
 * replaced, or `null` when the page showed no current group for that asignatura.
 * The confirmation itself is the client's (CS-8), but the writer compares it,
 * under the student's row lock, with the siblings it actually finds and refuses
 * with `stale` (nothing changed, no audit row) when they are not exactly that
 * group: an optimistic check, so a direct POST cannot replace a group the user
 * never saw. The replaced group ids are never sent back.
 */
export async function assignInscripcionAction(
  estudianteId: number,
  grupoId: number,
  expectedReplaced: number | null,
): Promise<AssignInscripcionState> {
  const { actorId, scope } = await requireEnrollmentAccess();
  const t = await getTranslations("catalog");
  if (scope.kind === "none") return { kind: "gone" };

  // All three are client-visible arguments: re-validated, never trusted.
  const parsed = assignEnrollmentInputSchema.safeParse({
    estudianteId,
    grupoId,
    expectedReplaced,
  });
  if (!parsed.success) {
    return { kind: "error", message: t("inscripciones.errors.unexpected") };
  }

  let result: StaffEnrollResult;
  try {
    result = await staffEnrollInGroup(
      { actorId, scope },
      parsed.data.estudianteId,
      parsed.data.grupoId,
      {
        allowReplaceAndCreate: true,
        expectedReplaced: parsed.data.expectedReplaced,
      },
    );
  } catch {
    // The writer already logged one sanitised line and stored nothing.
    return { kind: "error", message: t("inscripciones.errors.unexpected") };
  }

  if (!result.ok) {
    switch (result.reason) {
      case "not_student":
        return { kind: "gone" };
      case "stale":
        return {
          kind: "error",
          message: t("inscripciones.errors.assign_stale"),
        };
      case "already_enrolled":
        return {
          kind: "error",
          message: t("inscripciones.errors.assign_already_enrolled"),
        };
      case "not_eligible":
        return {
          kind: "error",
          message: t("inscripciones.errors.assign_not_eligible"),
        };
    }
  }

  revalidatePath(LIST_PATH);
  return {
    kind: "done",
    outcome: result.kind,
    replaced: result.replaced.length,
  };
}
