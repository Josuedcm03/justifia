import "server-only";

import { and, eq, notExists, sql } from "drizzle-orm";
import { QueryBuilder } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { documentoRespaldo, solicitud } from "@/db/schema";
import {
  documentoFormatoEspecialEvent,
  documentRejectedEvent,
} from "@/lib/audit/events";
import type { DocumentRejectionReason } from "@/lib/audit/types";
import { insertAuditEvents } from "@/lib/data/audit";
import { inspectStoredFile } from "@/lib/data/documentos";
import { unblockSpecialFormat } from "@/lib/data/remision";
import { requestRowInScope } from "@/lib/data/request-scope-sql";
import { isUnderDraftPrefix } from "@/lib/intake/pathnames";
import type { DocumentStore } from "@/lib/intake/ports";
import type { RequestScope } from "@/lib/intake/request-scope";
import type { TipoDetectado } from "@/lib/intake/signature";

// The signed special format of RN-19 (teacher-remission, TR-15, TR-16): one
// staff-uploaded document per approved, marked request. The bytes reach the
// private store from the browser; this module reads them back (never trusting
// the client type), stores the record and unblocks the remissions in one
// transaction. Mutating and security-critical: every function fails loud.

const MAX_NAME_LENGTH = 255;
const FALLBACK_NAME = "documento";
const UNIQUE_VIOLATION = "23505";

const qb = new QueryBuilder();

export type SpecialFormatContext = { solicitudId: number };

export type AttachFailure = Extract<
  DocumentRejectionReason,
  | "not_found"
  | "not_allowed"
  | "empty_file"
  | "too_large"
  | "unsupported_format"
>;

export type AttachResult =
  | {
      ok: true;
      documentId: number;
      tipo: TipoDetectado;
      tamanoBytes: number;
      /** Remissions to dispatch: the unblocked ones plus other pending rows. */
      dispatchIds: number[];
    }
  | { ok: false; reason: AttachFailure | "already_attached" };

function normalizeName(name: string): string {
  const trimmed = name.trim().slice(0, MAX_NAME_LENGTH);
  return trimmed.length > 0 ? trimmed : FALLBACK_NAME;
}

function isUniqueViolation(error: unknown): boolean {
  const code = (value: unknown) => (value as { code?: unknown } | null)?.code;
  return (
    code(error) === UNIQUE_VIOLATION ||
    code((error as { cause?: unknown } | null)?.cause) === UNIQUE_VIOLATION
  );
}

/** The request is approved and marked for the special format (RN-19). */
function eligible(scope: RequestScope, solicitudId: number) {
  return and(
    requestRowInScope(scope, solicitudId),
    eq(solicitud.estado, "aprobada"),
    eq(solicitud.formatoEspecial, true),
  );
}

function hasNoFormat() {
  return notExists(
    qb
      .select({ one: sql`1` })
      .from(documentoRespaldo)
      .where(
        and(
          eq(documentoRespaldo.solicitudId, solicitud.id),
          eq(documentoRespaldo.formatoEspecial, true),
        ),
      ),
  );
}

/**
 * The request a special format may be uploaded to: in the caller's scope,
 * `aprobada`, marked and without a format yet. Unknown, out-of-scope, unmarked,
 * undecided and already-formatted requests are the same `null`, so the token
 * route and the action leak nothing about which one it was (RNF-01).
 */
export async function getSpecialFormatContext(
  solicitudId: number,
  scope: RequestScope,
): Promise<SpecialFormatContext | null> {
  if (scope.kind === "none") return null;
  const [row] = await db
    .select({ id: solicitud.id })
    .from(solicitud)
    .where(and(eligible(scope, solicitudId), hasNoFormat()))
    .limit(1);
  return row ? { solicitudId: row.id } : null;
}

async function isReferenced(pathname: string): Promise<boolean> {
  const rows = await db
    .select({ id: documentoRespaldo.id })
    .from(documentoRespaldo)
    .where(eq(documentoRespaldo.pathname, pathname))
    .limit(1);
  return rows.length > 0;
}

async function deleteQuietly(store: DocumentStore, pathname: string) {
  try {
    await store.delete([pathname]);
  } catch {
    // The orphan sweep removes an unfinalized blob later.
  }
}

/**
 * Attaches the uploaded file as the request's special format (TR-15). Order:
 * the request and the pathname are checked before any byte is read; the file
 * is inspected; then one transaction locks the request, refuses a second
 * format, inserts the `valido` document, unblocks the `formato_especial_faltante`
 * remissions and writes `documento.formato_especial`.
 *
 * A refused file is deleted and audited as `documento.rechazado`. A file that
 * a document row already references is never deleted: it is somebody's
 * evidence. Denials and `already_attached` write no audit row.
 */
export async function attachSpecialFormat(
  input: {
    actorId: number;
    scope: RequestScope;
    solicitudId: number;
    pathname: string;
    nombreOriginal: string;
  },
  store: DocumentStore,
): Promise<AttachResult> {
  const { actorId, scope, solicitudId, pathname } = input;
  const denied: AttachResult = { ok: false, reason: "not_allowed" };

  if (!isUnderDraftPrefix(pathname, solicitudId)) return denied;
  if (!(await getSpecialFormatContext(solicitudId, scope))) return denied;
  if (await isReferenced(pathname)) return denied;

  const inspection = await inspectStoredFile(pathname, store);
  if (!inspection.ok && inspection.reason === "not_found") {
    return { ok: false, reason: "not_found" };
  }
  if (!inspection.ok) {
    await deleteQuietly(store, pathname);
    await db.transaction(async (tx) => {
      await insertAuditEvents(tx, actorId, [
        documentRejectedEvent({ solicitudId, reason: inspection.reason }),
      ]);
    });
    return { ok: false, reason: inspection.reason };
  }
  const { tipo, size } = inspection;

  let outcome: AttachResult | "duplicate";
  try {
    outcome = await db.transaction(
      async (tx): Promise<AttachResult | "duplicate"> => {
        const [locked] = await tx
          .select({ id: solicitud.id })
          .from(solicitud)
          .where(eligible(scope, solicitudId))
          .limit(1)
          .for("update");
        if (!locked) return denied;

        const [existing] = await tx
          .select({ id: documentoRespaldo.id })
          .from(documentoRespaldo)
          .where(
            and(
              eq(documentoRespaldo.solicitudId, solicitudId),
              eq(documentoRespaldo.formatoEspecial, true),
            ),
          )
          .limit(1);
        if (existing) return "duplicate";

        const [document] = await tx
          .insert(documentoRespaldo)
          .values({
            solicitudId,
            pathname,
            nombreOriginal: normalizeName(input.nombreOriginal),
            estado: "valido",
            tipoDetectado: tipo,
            tamanoBytes: size,
            subidoPorId: actorId,
            formatoEspecial: true,
          })
          .returning({ id: documentoRespaldo.id });

        const { unblockedIds, dispatchIds } = await unblockSpecialFormat(
          tx,
          solicitudId,
        );
        await insertAuditEvents(tx, actorId, [
          documentoFormatoEspecialEvent({
            documentoId: document.id,
            solicitudId,
            tipo,
            tamanoBytes: size,
            remisionesDesbloqueadas: unblockedIds.length,
          }),
        ]);
        return {
          ok: true,
          documentId: document.id,
          tipo,
          tamanoBytes: size,
          dispatchIds,
        };
      },
    );
  } catch (error) {
    // A concurrent attach: the backstop of the row lock. The file stays (the
    // winner may reference it); the orphan sweep removes it otherwise.
    if (isUniqueViolation(error)) {
      return { ok: false, reason: "already_attached" };
    }
    throw error;
  }

  if (outcome === "duplicate") {
    await deleteQuietly(store, pathname);
    return { ok: false, reason: "already_attached" };
  }
  return outcome;
}
