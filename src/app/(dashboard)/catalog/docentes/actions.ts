"use server";

import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { docenteWriteEvents } from "@/lib/audit/events";
import { requireDocenteAccess } from "@/lib/auth/docente-access";
import {
  actionOutcomes,
  addressedRecord,
  fieldErrors,
  revalidateRecord,
} from "@/lib/catalog/action-helpers";
import type {
  ActiveToggleState,
  CatalogFormState,
  DocenteActiveResult,
  DocenteWriteResult,
} from "@/lib/catalog/types";
import { withCatalogWrite } from "@/lib/data/catalog-write";
import {
  getDocenteById,
  setDocenteActivo,
  updateDocente,
} from "@/lib/data/docentes";
import { docenteUpdateSchema } from "@/lib/validations/docente";

// Server Actions are reachable by a direct POST, so each one authorizes first
// (nothing of the body is read before the guard resolves), takes the actor only
// from the guard, and writes only through `withCatalogWrite`, which owns the
// lock, the transaction and the audit row. The guard is `requireDocenteAccess`
// (secretaria only, no scope), never `requireCatalogAccess`. `redirect` throws,
// so it is always called outside any `try`.

const LIST_PATH = "/catalog/docentes";

// The pre-check, the busy/unexpected mapping and the field-error translation
// are shared with the Asignatura and Grupo actions.
const { unexpected, failure } = actionOutcomes("docentes.errors.unexpected");

/**
 * What a docente write makes stale: the record and its list, the Users list
 * (name and email), the Asignaturas list (its search finds grupos by docente
 * name) and the three pages that read docente names or options. A pattern with
 * a dynamic segment needs its `type`; a literal path omits it.
 */
function revalidateDocente(id: number) {
  revalidateRecord(LIST_PATH, id);
  revalidatePath("/users");
  revalidatePath("/catalog/asignaturas");
  revalidatePath("/catalog/asignaturas/[id]/edit", "page");
  revalidatePath("/catalog/asignaturas/[id]/grupos/new", "page");
  revalidatePath("/catalog/asignaturas/[id]/grupos/[grupoId]/edit", "page");
}

export async function updateDocenteAction(
  _prev: CatalogFormState,
  formData: FormData,
): Promise<CatalogFormState> {
  const { actorId } = await requireDocenteAccess();
  const t = await getTranslations("catalog");

  // A missing id, another role's id and a malformed id answer the same `gone`
  // without waiting on the lock.
  const target = await addressedRecord(
    actorId,
    formData.get("id"),
    getDocenteById,
  );
  if (target === "gone") return { kind: "gone" };
  if (target === "failed") return unexpected(t);

  // Only the three editable fields are read: a submitted `login`, `hashClave`,
  // `rol`, `activo`, `cif`, `carreraId`, `facultadId` or `debeCambiarClave` is
  // never even looked at (DM-3).
  const parsed = docenteUpdateSchema.safeParse({
    nombreCompleto: formData.get("nombreCompleto"),
    correo: formData.get("correo"),
    telefono: formData.get("telefono"),
  });
  if (!parsed.success) {
    return { kind: "invalid", fieldErrors: fieldErrors(t, parsed.error) };
  }

  let result: DocenteWriteResult;
  try {
    result = await withCatalogWrite(
      actorId,
      (tx) => updateDocente(tx, target.id, parsed.data),
      docenteWriteEvents,
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
    case "correo_taken":
      // One generic text on the field: it names no account, role or state.
      return {
        kind: "invalid",
        fieldErrors: { correo: t("shared.fieldErrors.correo.taken") },
      };
    default:
      return unexpected(t);
  }

  revalidateDocente(target.id);
  redirect(LIST_PATH);
}

const INTENTS = { deactivate: false, reactivate: true } as const;

export async function setDocenteActivoAction(
  _prev: ActiveToggleState,
  formData: FormData,
): Promise<ActiveToggleState> {
  const { actorId } = await requireDocenteAccess();
  const t = await getTranslations("catalog");

  // The desired state arrives as a closed intent, never as a free boolean.
  const intent = formData.get("intent");
  if (intent !== "deactivate" && intent !== "reactivate") {
    return { kind: "gone" };
  }
  const activo = INTENTS[intent];

  const target = await addressedRecord(
    actorId,
    formData.get("id"),
    getDocenteById,
  );
  if (target === "gone") return { kind: "gone" };
  if (target === "failed") return unexpected(t);

  let result: DocenteActiveResult;
  try {
    result = await withCatalogWrite(
      actorId,
      (tx) => setDocenteActivo(tx, target.id, activo),
      docenteWriteEvents,
    );
  } catch (error) {
    return failure(error, t);
  }

  switch (result.kind) {
    case "changed":
      revalidateDocente(target.id);
      return { kind: "done", activo: result.activo };
    case "unchanged":
      return { kind: "unchanged" };
    case "not_found":
      return { kind: "gone" };
    case "has_active_groups":
      return {
        kind: "error",
        message: t("docentes.errors.activeGrupos", { count: result.count }),
      };
  }
}
