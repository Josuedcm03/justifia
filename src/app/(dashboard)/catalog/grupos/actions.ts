"use server";

import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { grupoWriteEvents } from "@/lib/audit/events";
import { requireCatalogAccess } from "@/lib/auth/catalog-access";
import {
  actionOutcomes,
  addressed,
  fieldErrors,
  revalidateRecord,
  type Translate,
} from "@/lib/catalog/action-helpers";
import type {
  ActiveToggleState,
  CatalogFormState,
  GrupoActiveResult,
  GrupoWriteResult,
} from "@/lib/catalog/types";
import { getAsignaturaById } from "@/lib/data/asignaturas";
import { logCatalogFailure, withCatalogWrite } from "@/lib/data/catalog-write";
import {
  createGrupo,
  getGrupoById,
  setGrupoActivo,
  updateGrupo,
} from "@/lib/data/grupos";
import {
  grupoCreateSchema,
  grupoUpdateSchema,
} from "@/lib/validations/catalog";

// Server Actions are reachable by a direct POST, so each one authorizes first
// (nothing of the body is read before the guard resolves, `getAll` included),
// takes actor and scope only from the guard, and writes only through
// `withCatalogWrite`, which owns the lock, the transaction and the audit rows.
// `redirect` throws, so it is always called outside any `try`.

const LIST_PATH = "/catalog/grupos";

// The id parse, the lock-free pre-check, the busy/unexpected mapping and the
// field-error translation are shared with the Asignatura actions.
const { unexpected, failure } = actionOutcomes("grupos.errors.unexpected");

/** The one answer for an Asignatura the actor cannot use, whether it is
 *  missing, inactive or foreign (CM-SCOPE-1). */
function asignaturaUnavailable(t: Translate) {
  return {
    kind: "invalid" as const,
    fieldErrors: { asignaturaId: t("shared.fieldErrors.asignaturaId.invalid") },
  };
}

export async function createGrupoAction(
  _prev: CatalogFormState,
  formData: FormData,
): Promise<CatalogFormState> {
  const { actorId, scope } = await requireCatalogAccess();
  const t = await getTranslations("catalog");
  if (scope.kind === "none") {
    return { kind: "error", message: t("shared.noCarrera.message") };
  }

  // The days are the multi-valued field: seven checkboxes sharing one name.
  const parsed = grupoCreateSchema.safeParse({
    asignaturaId: formData.get("asignaturaId"),
    periodo: formData.get("periodo"),
    numeroGrupo: formData.get("numeroGrupo"),
    docenteId: formData.get("docenteId"),
    dias: formData.getAll("dias"),
  });
  if (!parsed.success) {
    return { kind: "invalid", fieldErrors: fieldErrors(t, parsed.error) };
  }

  // Lock-free pre-check (amendment A-6): the Asignatura is read through the
  // scope BEFORE the lock, so a missing, inactive and foreign parent answer
  // alike and a busy lock cannot stand in for "not found". The write
  // re-validates inside its transaction. This read is outside the wrapper, so
  // it logs its own failure.
  try {
    const parent = await getAsignaturaById(scope, parsed.data.asignaturaId);
    if (!parent || !parent.activo) return asignaturaUnavailable(t);
  } catch (error) {
    logCatalogFailure({ actor: actorId, error });
    return unexpected(t);
  }

  let result: GrupoWriteResult;
  try {
    result = await withCatalogWrite(
      actorId,
      (tx) => createGrupo(tx, scope, parsed.data),
      grupoWriteEvents,
    );
  } catch (error) {
    return failure(error, t);
  }

  switch (result.kind) {
    case "created":
      break;
    case "grupo_taken":
      // The parent was read inside the actor's scope, so the existing group's
      // state may be named (CM-GRP-1).
      return {
        kind: "error",
        message: t(
          result.activo
            ? "shared.refusals.duplicate"
            : "shared.refusals.duplicateInactive",
        ),
      };
    case "asignatura_unavailable":
      return asignaturaUnavailable(t);
    case "docente_unavailable":
      return {
        kind: "invalid",
        fieldErrors: { docenteId: t("shared.fieldErrors.docenteId.invalid") },
      };
    default:
      return unexpected(t);
  }

  revalidatePath(LIST_PATH);
  redirect(LIST_PATH);
}

export async function updateGrupoAction(
  _prev: CatalogFormState,
  formData: FormData,
): Promise<CatalogFormState> {
  const { actorId, scope } = await requireCatalogAccess();
  const t = await getTranslations("catalog");
  if (scope.kind === "none") {
    return { kind: "error", message: t("shared.noCarrera.message") };
  }

  const target = await addressed(
    actorId,
    scope,
    formData.get("id"),
    getGrupoById,
  );
  if (target === "gone") return { kind: "gone" };
  if (target === "failed") return unexpected(t);

  // Only the docente and the days are in the schema: a submitted `periodo`,
  // `numeroGrupo` or `asignaturaId` is stripped (CM-GRP-2). The days are
  // required even for a docente-only edit (A-DIAS-REQ).
  const parsed = grupoUpdateSchema.safeParse({
    docenteId: formData.get("docenteId"),
    dias: formData.getAll("dias"),
  });
  if (!parsed.success) {
    return { kind: "invalid", fieldErrors: fieldErrors(t, parsed.error) };
  }

  let result: GrupoWriteResult;
  try {
    result = await withCatalogWrite(
      actorId,
      (tx) => updateGrupo(tx, scope, target.id, parsed.data),
      grupoWriteEvents,
    );
  } catch (error) {
    return failure(error, t);
  }

  switch (result.kind) {
    case "updated":
      break;
    case "unchanged":
      return { kind: "unchanged" };
    case "inactive":
      return { kind: "inactive" };
    case "not_found":
      return { kind: "gone" };
    case "docente_unavailable":
      return {
        kind: "invalid",
        fieldErrors: { docenteId: t("shared.fieldErrors.docenteId.invalid") },
      };
    default:
      // Includes `asignatura_unavailable` (the group's own, inactive Asignatura):
      // the edit form has no Asignatura field to attach it to.
      return unexpected(t);
  }

  revalidateRecord(LIST_PATH, target.id);
  redirect(LIST_PATH);
}

const INTENTS = { deactivate: false, reactivate: true } as const;

export async function setGrupoActivoAction(
  _prev: ActiveToggleState,
  formData: FormData,
): Promise<ActiveToggleState> {
  const { actorId, scope } = await requireCatalogAccess();
  const t = await getTranslations("catalog");
  if (scope.kind === "none") {
    return { kind: "error", message: t("shared.noCarrera.message") };
  }

  // The desired state arrives as a closed intent, never as a free boolean. The
  // days are neither read nor written: activation never depends on them.
  const intent = formData.get("intent");
  if (intent !== "deactivate" && intent !== "reactivate") {
    return { kind: "gone" };
  }
  const activo = INTENTS[intent];

  const target = await addressed(
    actorId,
    scope,
    formData.get("id"),
    getGrupoById,
  );
  if (target === "gone") return { kind: "gone" };
  if (target === "failed") return unexpected(t);

  let result: GrupoActiveResult;
  try {
    result = await withCatalogWrite(
      actorId,
      (tx) => setGrupoActivo(tx, scope, target.id, activo),
      grupoWriteEvents,
    );
  } catch (error) {
    return failure(error, t);
  }

  // A refused reactivation names the blocking parent. The label is the group's
  // own Asignatura or docente as the scoped pre-check read it, so only
  // something the actor may already see can be named.
  switch (result.kind) {
    case "changed":
      revalidateRecord(LIST_PATH, target.id);
      return { kind: "done", activo: result.activo };
    case "unchanged":
      return { kind: "unchanged" };
    case "not_found":
      return { kind: "gone" };
    case "asignatura_unavailable":
      return {
        kind: "error",
        message: t("shared.refusals.parentInactive.asignatura", {
          parent: `${target.item.asignaturaCodigo} - ${target.item.asignaturaNombre}`,
        }),
      };
    case "docente_unavailable":
      return {
        kind: "error",
        message: t("shared.refusals.parentInactive.docente", {
          parent: target.item.docenteNombre,
        }),
      };
  }
}
