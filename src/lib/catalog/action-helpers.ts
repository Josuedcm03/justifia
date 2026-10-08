import "server-only";

import type { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";

import type { CatalogScope } from "@/lib/catalog/scope";
import { CatalogBusyError, logCatalogFailure } from "@/lib/data/catalog-write";
import { parseRecordId } from "@/lib/validations/catalog";

// Plumbing shared by the Asignatura and Grupo Server Action modules. This is
// NOT a "use server" module: it exports plain helpers, so it can never be
// reached by a POST. It performs no authorization and reads no form data;
// `requireCatalogAccess()` and every `formData` read stay visible in each
// action file, in that order (guards.test.ts proves it from the source).

export type Translate = Awaited<ReturnType<typeof getTranslations>>;

/** First message per field, translated from the schema's i18n keys. */
export function fieldErrors(
  t: Translate,
  error: ZodError,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0]);
    if (!(field in out)) out[field] = t(`shared.fieldErrors.${issue.message}`);
  }
  return out;
}

/**
 * The generic and the busy outcomes of an entity's actions. The key of the
 * entity's own `errors.unexpected` message is passed as a literal by the
 * action file, so the parity test that scans that source still sees it.
 */
export function actionOutcomes(unexpectedKey: string) {
  function unexpected(t: Translate) {
    return { kind: "error" as const, message: t(unexpectedKey) };
  }

  /** A lock timeout is its own outcome (CM-NFR-4); anything else is generic
   *  and never carries the thrown text (`withCatalogWrite` already logged it). */
  function failure(error: unknown, t: Translate) {
    return error instanceof CatalogBusyError
      ? { kind: "busy" as const }
      : unexpected(t);
  }

  return { unexpected, failure };
}

/**
 * The lock-free pre-check for a record that already exists (amendment A-6):
 * parses the hidden id and reads the record through the scope BEFORE
 * `withCatalogWrite`, so a missing and a foreign id answer the same `gone`
 * without ever waiting on the lock (CM-NFR-4: busy does not bypass
 * authorization). The write re-validates inside its transaction. This read is
 * outside the wrapper, so it logs its own failure. The item it returns was
 * read inside the actor's scope.
 */
export async function addressed<T>(
  actorId: number,
  scope: CatalogScope,
  rawId: unknown,
  read: (scope: CatalogScope, id: number) => Promise<T | null | undefined>,
): Promise<{ id: number; item: T } | "gone" | "failed"> {
  const id = parseRecordId(rawId);
  if (id === null) return "gone";
  try {
    const item = await read(scope, id);
    return item ? { id, item } : "gone";
  } catch (error) {
    logCatalogFailure({ actor: actorId, error });
    return "failed";
  }
}

/** The list and the one edit page of the record whose state changed. */
export function revalidateRecord(listPath: string, id: number) {
  revalidatePath(listPath);
  revalidatePath(`${listPath}/${id}/edit`);
}
