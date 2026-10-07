"use server";

import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ZodError } from "zod";

import { asignaturaWriteEvents } from "@/lib/audit/events";
import { requireCatalogAccess } from "@/lib/auth/catalog-access";
import type { CatalogScope } from "@/lib/catalog/scope";
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
import {
  CatalogBusyError,
  logCatalogFailure,
  withCatalogWrite,
} from "@/lib/data/catalog-write";
import {
  asignaturaCreateSchema,
  asignaturaUpdateSchema,
  parseRecordId,
} from "@/lib/validations/catalog";

// Server Actions are reachable by a direct POST, so each one authorizes first
// (nothing of the body is read before the guard resolves), takes actor and
// scope only from the guard, and writes only through `withCatalogWrite`, which
// owns the lock, the transaction and the audit rows. `redirect` throws, so it
// is always called outside any `try`.

const LIST_PATH = "/catalog/asignaturas";

/** The list and the one edit page of the record whose state changed. */
function revalidateAsignatura(id: number) {
  revalidatePath(LIST_PATH);
  revalidatePath(`${LIST_PATH}/${id}/edit`);
}

type Translate = Awaited<ReturnType<typeof getTranslations>>;

/** First message per field, translated from the schema's i18n keys. */
function fieldErrors(t: Translate, error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0]);
    if (!(field in out)) out[field] = t(`shared.fieldErrors.${issue.message}`);
  }
  return out;
}

function unexpected(t: Translate) {
  return {
    kind: "error" as const,
    message: t("asignaturas.errors.unexpected"),
  };
}

/** A lock timeout is its own outcome (CM-NFR-4); anything else is generic and
 *  never carries the thrown text (`withCatalogWrite` already logged it). */
function failure(error: unknown, t: Translate) {
  return error instanceof CatalogBusyError
    ? { kind: "busy" as const }
    : unexpected(t);
}

/**
 * The lock-free pre-check (amendment A-6): parses the hidden id and reads the
 * record through the scope BEFORE `withCatalogWrite`, so a missing and a foreign
 * id answer the same `gone` without ever waiting on the lock (CM-NFR-4: busy
 * does not bypass authorization). The write re-validates inside its
 * transaction. This read is outside the wrapper, so it logs its own failure.
 */
async function addressed(
  actorId: number,
  scope: CatalogScope,
  rawId: unknown,
): Promise<{ id: number } | "gone" | "failed"> {
  const id = parseRecordId(rawId);
  if (id === null) return "gone";
  try {
    return (await getAsignaturaById(scope, id)) ? { id } : "gone";
  } catch (error) {
    logCatalogFailure({ actor: actorId, error });
    return "failed";
  }
}

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
      return {
        kind: "error",
        message: t(
          result.inScope && !result.activo
            ? "shared.refusals.duplicateInactive"
            : "shared.refusals.duplicate",
        ),
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

  const target = await addressed(actorId, scope, formData.get("id"));
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

  revalidateAsignatura(target.id);
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

  const target = await addressed(actorId, scope, formData.get("id"));
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
      revalidateAsignatura(target.id);
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
