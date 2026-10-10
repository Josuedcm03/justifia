"use server";

import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { asignaturaWriteEvents } from "@/lib/audit/events";
import { requireCatalogAccess } from "@/lib/auth/catalog-access";
import {
  actionOutcomes,
  addressed,
  fieldErrors,
  revalidateRecord,
} from "@/lib/catalog/action-helpers";
import type {
  ActiveToggleState,
  AsignaturaActiveResult,
  AsignaturaWriteResult,
  CatalogFormState,
} from "@/lib/catalog/types";
import {
  createAsignatura,
  getAsignaturaById,
  setAsignaturaActivo,
  updateAsignatura,
} from "@/lib/data/asignaturas";
import { withCatalogWrite } from "@/lib/data/catalog-write";
import {
  asignaturaCreateSchema,
  asignaturaUpdateSchema,
} from "@/lib/validations/catalog";

// Server Actions are reachable by a direct POST, so each one authorizes first
// (nothing of the body is read before the guard resolves), takes actor and
// scope only from the guard, and writes only through `withCatalogWrite`, which
// owns the lock, the transaction and the audit rows. `redirect` throws, so it
// is always called outside any `try`.

const LIST_PATH = "/catalog/asignaturas";

// The id parse, the lock-free pre-check, the busy/unexpected mapping and the
// field-error translation are shared with the Grupo actions.
const { unexpected, failure } = actionOutcomes("asignaturas.errors.unexpected");

export async function createAsignaturaAction(
  _prev: CatalogFormState,
  formData: FormData,
): Promise<CatalogFormState> {
  const { actorId, scope } = await requireCatalogAccess();
  const t = await getTranslations("catalog");
  if (scope.kind === "none") {
    return { kind: "error", message: t("shared.noCarrera.message") };
  }

  const parsed = asignaturaCreateSchema.safeParse({
    codigo: formData.get("codigo"),
    nombre: formData.get("nombre"),
    carreraId: formData.get("carreraId"),
    horasTotales: formData.get("horasTotales"),
  });
  if (!parsed.success) {
    return { kind: "invalid", fieldErrors: fieldErrors(t, parsed.error) };
  }

  let result: AsignaturaWriteResult;
  try {
    result = await withCatalogWrite(
      actorId,
      (tx) => createAsignatura(tx, scope, parsed.data),
      asignaturaWriteEvents,
    );
  } catch (error) {
    return failure(error, t);
  }

  switch (result.kind) {
    case "created":
      break;
    case "codigo_taken":
      // Only a record the caller may see can be named as inactive (CM-ASG-2).
      // The refusal is a field error, so it appears under Codigo.
      return {
        kind: "invalid",
        fieldErrors: {
          codigo: t(
            result.inScope && !result.activo
              ? "shared.fieldErrors.codigo.takenInactive"
              : "shared.fieldErrors.codigo.taken",
          ),
        },
      };
    case "carrera_invalid":
      return {
        kind: "invalid",
        fieldErrors: { carreraId: t("shared.fieldErrors.carreraId.invalid") },
      };
    default:
      return unexpected(t);
  }

  revalidatePath(LIST_PATH);
  redirect(LIST_PATH);
}

export async function updateAsignaturaAction(
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
    getAsignaturaById,
  );
  if (target === "gone") return { kind: "gone" };
  if (target === "failed") return unexpected(t);

  // `codigo` is not in the schema: a submitted one is stripped (AC-CODE).
  const parsed = asignaturaUpdateSchema.safeParse({
    nombre: formData.get("nombre"),
    carreraId: formData.get("carreraId"),
    horasTotales: formData.get("horasTotales"),
  });
  if (!parsed.success) {
    return { kind: "invalid", fieldErrors: fieldErrors(t, parsed.error) };
  }

  let result: AsignaturaWriteResult;
  try {
    result = await withCatalogWrite(
      actorId,
      (tx) => updateAsignatura(tx, scope, target.id, parsed.data),
      asignaturaWriteEvents,
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
    case "carrera_invalid":
      return {
        kind: "invalid",
        fieldErrors: { carreraId: t("shared.fieldErrors.carreraId.invalid") },
      };
    default:
      return unexpected(t);
  }

  revalidateRecord(LIST_PATH, target.id);
  redirect(LIST_PATH);
}

const INTENTS = { deactivate: false, reactivate: true } as const;

export async function setAsignaturaActivoAction(
  _prev: ActiveToggleState,
  formData: FormData,
): Promise<ActiveToggleState> {
  const { actorId, scope } = await requireCatalogAccess();
  const t = await getTranslations("catalog");
  if (scope.kind === "none") {
    return { kind: "error", message: t("shared.noCarrera.message") };
  }

  // The desired state arrives as a closed intent, never as a free boolean.
  const intent = formData.get("intent");
  if (intent !== "deactivate" && intent !== "reactivate") {
    return { kind: "gone" };
  }
  const activo = INTENTS[intent];

  const target = await addressed(
    actorId,
    scope,
    formData.get("id"),
    getAsignaturaById,
  );
  if (target === "gone") return { kind: "gone" };
  if (target === "failed") return unexpected(t);

  let result: AsignaturaActiveResult;
  try {
    result = await withCatalogWrite(
      actorId,
      (tx) => setAsignaturaActivo(tx, scope, target.id, activo),
      asignaturaWriteEvents,
    );
  } catch (error) {
    return failure(error, t);
  }

  switch (result.kind) {
    case "changed":
      revalidateRecord(LIST_PATH, target.id);
      return { kind: "done", activo: result.activo };
    case "unchanged":
      return { kind: "unchanged" };
    case "not_found":
      return { kind: "gone" };
    case "has_active_groups":
      return {
        kind: "error",
        message: t("shared.refusals.activeGrupos", { count: result.count }),
      };
  }
}
