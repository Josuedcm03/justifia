import "server-only";

import { and, count, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import {
  carrera,
  documentoRespaldo,
  solicitud,
  solicitudRevision,
  usuario,
} from "@/db/schema";
import {
  documentAttachedEvent,
  documentDownloadedEvent,
  documentRejectedEvent,
  documentRemovedEvent,
  documentoRetiradoEvent,
} from "@/lib/audit/events";
import type { DocumentMode, DocumentRejectionReason } from "@/lib/audit/types";
import { insertAuditEvents, type Transaction } from "@/lib/data/audit";
import {
  DRAFT_TARGET,
  editableWhere,
  ownedWhere,
  type EditTarget,
} from "@/lib/data/solicitudes";
import {
  MAX_DOCUMENT_BYTES,
  MAX_DOCUMENTS_PER_DRAFT,
} from "@/lib/intake/limits";
import { isUnderDraftPrefix } from "@/lib/intake/pathnames";
import type { DocumentStore } from "@/lib/intake/ports";
import {
  detectSignature,
  SIGNATURE_HEAD_BYTES,
  type TipoDetectado,
} from "@/lib/intake/signature";

// Persistence of supporting documents (supporting-documents, D3, D12, D13).
// Security-critical and mutating: every function fails loud, none is fail-soft.

const MAX_NAME_LENGTH = 255;
const FALLBACK_NAME = "documento";

/**
 * `TamanoBytes` is NOT NULL and CHECKed `> 0`, but the real size is unknown
 * until the stored file is read. The `pendiente` claim carries this placeholder
 * and the accepted update replaces it with the stored size.
 */
const PENDING_PLACEHOLDER_BYTES = 1;

export type FinalizeResult =
  | { ok: true; documentId: number; tipo: TipoDetectado }
  | { ok: false; reason: DocumentRejectionReason };

export type UploadContext = { solicitudId: number; documentCount: number };

export type DownloadableDocument = {
  id: number;
  solicitudId: number;
  estudianteId: number;
  /** `Carrera.FacultadId` of the student's current career; null without one. */
  estudianteFacultadId: number | null;
  solicitudEstado: string;
  /** Set when a correction retired the document (still `valido`). */
  retiradoEn: Date | null;
  pathname: string;
  tipo: TipoDetectado;
  nombreOriginal: string;
};

function normalizeName(name: string): string {
  const trimmed = name.trim().slice(0, MAX_NAME_LENGTH);
  return trimmed.length > 0 ? trimmed : FALLBACK_NAME;
}

/** Documents that count toward the cap: `pendiente` and `valido`, not retired. */
function currentDocuments(solicitudId: number) {
  return and(
    eq(documentoRespaldo.solicitudId, solicitudId),
    isNull(documentoRespaldo.retiradoEn),
  );
}

async function countDocuments(
  tx: Transaction,
  solicitudId: number,
): Promise<number> {
  const [row] = await tx
    .select({ n: count() })
    .from(documentoRespaldo)
    .where(currentDocuments(solicitudId));
  return row?.n ?? 0;
}

/**
 * The student's open target (a live draft, D8, or an own `devuelta` request)
 * and how many documents it holds, `pendiente` and `valido` alike and retired
 * ones excluded (D12). `null` when there is nothing open to attach to.
 */
export async function getUploadContext(
  estudianteId: number,
  now: Date,
  target: EditTarget = DRAFT_TARGET,
): Promise<UploadContext | null> {
  const [open] = await db
    .select({ id: solicitud.id })
    .from(solicitud)
    .where(editableWhere(estudianteId, target, now))
    .limit(1);
  if (!open) return null;

  const [row] = await db
    .select({ n: count() })
    .from(documentoRespaldo)
    .where(currentDocuments(open.id));
  return { solicitudId: open.id, documentCount: row?.n ?? 0 };
}

type Claim =
  | { kind: "claimed"; documentId: number }
  | { kind: "over_cap" }
  | { kind: "refused" };

/**
 * Finalize an uploaded file (RN-04, D3, D12). Order: ownership of the path,
 * claim a `pendiente` row under a row lock on the draft (cap and pathname
 * uniqueness hold under concurrency), read the stored bytes, then either mark
 * the row `valido` or delete row and file. Never trusts the client type or the
 * upload callback.
 *
 * Audit: `documento.adjuntado` on accept, `documento.rechazado` when a stored
 * file was inspected and refused (format, size, empty, cap). `not_allowed` and
 * `not_found` write no row: the first is an unauthorized call, the second has
 * nothing stored to report.
 */
export async function finalizeDocument(
  input: {
    userId: number;
    pathname: string;
    nombreOriginal: string;
    target?: EditTarget;
  },
  store: DocumentStore,
): Promise<FinalizeResult> {
  const { userId, pathname, target = DRAFT_TARGET } = input;

  const [draft] = await db
    .select({ id: solicitud.id })
    .from(solicitud)
    .where(ownedWhere(userId, target))
    .limit(1);
  if (!draft || !isUnderDraftPrefix(pathname, draft.id)) {
    return { ok: false, reason: "not_allowed" };
  }
  const solicitudId = draft.id;

  const claim = await db.transaction(async (tx): Promise<Claim> => {
    // The UPDATE takes the row lock on the draft and records the activity
    // (ActualizadoEn is set explicitly, no trigger). Concurrent finalizes of
    // one draft serialise here, so the count below cannot be stale (D12).
    const locked = await tx
      .update(solicitud)
      .set({ actualizadoEn: new Date() })
      .where(and(eq(solicitud.id, solicitudId), ownedWhere(userId, target)))
      .returning({ id: solicitud.id });
    if (locked.length === 0) return { kind: "refused" };

    // A pathname that already has a row is somebody's document: refuse without
    // touching the file, so a repeated finalize can never delete a valid one.
    const existing = await tx
      .select({ id: documentoRespaldo.id })
      .from(documentoRespaldo)
      .where(eq(documentoRespaldo.pathname, pathname))
      .limit(1);
    if (existing.length > 0) return { kind: "refused" };

    if ((await countDocuments(tx, solicitudId)) >= MAX_DOCUMENTS_PER_DRAFT) {
      return { kind: "over_cap" };
    }

    const [row] = await tx
      .insert(documentoRespaldo)
      .values({
        solicitudId,
        pathname,
        nombreOriginal: normalizeName(input.nombreOriginal),
        estado: "pendiente",
        tamanoBytes: PENDING_PLACEHOLDER_BYTES,
      })
      .returning({ id: documentoRespaldo.id });
    return { kind: "claimed", documentId: row.id };
  });

  if (claim.kind === "refused") return { ok: false, reason: "not_allowed" };
  if (claim.kind === "over_cap") {
    return reject(
      { userId, solicitudId, pathname, reason: "too_many_documents" },
      store,
    );
  }
  const claimId = claim.documentId;

  let inspection: StoredFileInspection;
  try {
    inspection = await inspectStoredFile(pathname, store);
  } catch (error) {
    await db.delete(documentoRespaldo).where(eq(documentoRespaldo.id, claimId));
    throw error;
  }

  if (!inspection.ok && inspection.reason === "not_found") {
    await db.delete(documentoRespaldo).where(eq(documentoRespaldo.id, claimId));
    return { ok: false, reason: "not_found" };
  }
  if (!inspection.ok) {
    return reject(
      { userId, solicitudId, pathname, reason: inspection.reason, claimId },
      store,
    );
  }
  const { tipo, size } = inspection;

  await db.transaction(async (tx) => {
    await tx
      .update(documentoRespaldo)
      .set({ estado: "valido", tipoDetectado: tipo, tamanoBytes: size })
      .where(eq(documentoRespaldo.id, claimId));
    await insertAuditEvents(tx, userId, [
      documentAttachedEvent({
        documentoId: claimId,
        solicitudId,
        tipo,
        tamanoBytes: size,
      }),
    ]);
  });
  return { ok: true, documentId: claimId, tipo };
}

/** What the stored bytes of an uploaded file say about it (RN-04, D3). */
export type StoredFileInspection =
  | { ok: true; tipo: TipoDetectado; size: number }
  | { ok: false; reason: InspectionRefusal };

type InspectionRefusal = Extract<
  DocumentRejectionReason,
  "not_found" | "empty_file" | "too_large" | "unsupported_format"
>;

/**
 * Reads the head of a stored file and decides what it really is: never the
 * client type or the upload callback. Shared by the student finalize and the
 * staff special-format attach. A store failure throws; it is the caller's job
 * to clean up whatever it claimed before reading.
 */
export async function inspectStoredFile(
  pathname: string,
  store: DocumentStore,
): Promise<StoredFileInspection> {
  const head = await store.readHead(pathname, SIGNATURE_HEAD_BYTES);
  if (head === null) return { ok: false, reason: "not_found" };

  const refusal = refusalFor(head);
  if (refusal !== null) return { ok: false, reason: refusal };
  return {
    ok: true,
    tipo: detectSignature(head.head) as TipoDetectado,
    size: head.size,
  };
}

function refusalFor(head: {
  size: number;
  head: Uint8Array;
}): Exclude<InspectionRefusal, "not_found"> | null {
  if (head.size === 0) return "empty_file";
  if (head.size > MAX_DOCUMENT_BYTES) return "too_large";
  if (detectSignature(head.head) === null) return "unsupported_format";
  return null;
}

/**
 * Refuse a stored file: delete it (best effort: the orphan sweep is the
 * backstop), drop the claim row if any, and audit `documento.rechazado` in one
 * transaction.
 */
async function reject(
  args: {
    userId: number;
    solicitudId: number;
    pathname: string;
    reason: DocumentRejectionReason;
    claimId?: number;
  },
  store: DocumentStore,
): Promise<FinalizeResult> {
  try {
    await store.delete([args.pathname]);
  } catch {
    // The rejection stands; the orphan sweep removes the blob later.
  }
  await db.transaction(async (tx) => {
    if (args.claimId !== undefined) {
      await tx
        .delete(documentoRespaldo)
        .where(eq(documentoRespaldo.id, args.claimId));
    }
    await insertAuditEvents(tx, args.userId, [
      documentRejectedEvent({
        solicitudId: args.solicitudId,
        reason: args.reason,
      }),
    ]);
  });
  return { ok: false, reason: args.reason };
}

/** Whether the latest returned revision lists the document (RF-08 b). */
async function inLatestRevision(
  tx: Transaction,
  solicitudId: number,
  documentId: number,
): Promise<boolean> {
  const [latest] = await tx
    .select({ documentoIds: solicitudRevision.documentoIds })
    .from(solicitudRevision)
    .where(eq(solicitudRevision.solicitudId, solicitudId))
    .orderBy(desc(solicitudRevision.numero))
    .limit(1);
  return latest?.documentoIds.includes(documentId) ?? false;
}

/**
 * Remove a document from the caller's own draft or returned request. A draft
 * document, or one uploaded during the current correction, is deleted: record,
 * stored file and one `documento.eliminado` row. A document of the latest
 * returned revision is only retired (`RetiradoEn`, record and file kept, one
 * `documento.retirado` row) so staff still see what the student replaced. The
 * record change and the audit row commit together; a deleted file goes after,
 * best effort.
 */
export async function removeDocument(
  input: { userId: number; documentId: number; target?: EditTarget },
  store: DocumentStore,
): Promise<{ ok: true } | { ok: false; reason: "not_found" }> {
  const { userId, documentId, target = DRAFT_TARGET } = input;

  const removed = await db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        id: documentoRespaldo.id,
        solicitudId: documentoRespaldo.solicitudId,
        pathname: documentoRespaldo.pathname,
      })
      .from(documentoRespaldo)
      .innerJoin(solicitud, eq(solicitud.id, documentoRespaldo.solicitudId))
      .where(
        and(
          eq(documentoRespaldo.id, documentId),
          isNull(documentoRespaldo.retiradoEn),
          ownedWhere(userId, target),
        ),
      )
      .limit(1);
    if (!row) return null;

    const retire =
      target.kind === "correction" &&
      (await inLatestRevision(tx, row.solicitudId, row.id));
    const now = new Date();
    await tx
      .update(solicitud)
      .set({ actualizadoEn: now })
      .where(eq(solicitud.id, row.solicitudId));
    if (retire) {
      await tx
        .update(documentoRespaldo)
        .set({ retiradoEn: now })
        .where(eq(documentoRespaldo.id, row.id));
    } else {
      await tx
        .delete(documentoRespaldo)
        .where(eq(documentoRespaldo.id, row.id));
    }
    const audit = { documentoId: row.id, solicitudId: row.solicitudId };
    await insertAuditEvents(tx, userId, [
      retire ? documentoRetiradoEvent(audit) : documentRemovedEvent(audit),
    ]);
    return { ...row, retire };
  });

  if (!removed) return { ok: false, reason: "not_found" };
  if (removed.retire) return { ok: true };
  try {
    await store.delete([removed.pathname]);
  } catch {
    // Orphan sweep is the backstop for a failed blob delete.
  }
  return { ok: true };
}

/**
 * A `valido` document with its owner, the owner's facultad (via the student's
 * current career), the request state and any retirement, or null. Retired
 * documents stay `valido`, so they are returned. Authorization is the caller's
 * job (`canViewDocument`): this only answers "what is this document".
 */
export async function getDocumentForDownload(
  documentId: number,
): Promise<DownloadableDocument | null> {
  const [row] = await db
    .select({
      id: documentoRespaldo.id,
      solicitudId: documentoRespaldo.solicitudId,
      estudianteId: solicitud.estudianteId,
      estudianteFacultadId: carrera.facultadId,
      solicitudEstado: solicitud.estado,
      pathname: documentoRespaldo.pathname,
      tipoDetectado: documentoRespaldo.tipoDetectado,
      nombreOriginal: documentoRespaldo.nombreOriginal,
      retiradoEn: documentoRespaldo.retiradoEn,
    })
    .from(documentoRespaldo)
    .innerJoin(solicitud, eq(solicitud.id, documentoRespaldo.solicitudId))
    .innerJoin(usuario, eq(usuario.id, solicitud.estudianteId))
    .leftJoin(carrera, eq(carrera.id, usuario.carreraId))
    .where(
      and(
        eq(documentoRespaldo.id, documentId),
        eq(documentoRespaldo.estado, "valido"),
      ),
    )
    .limit(1);
  if (!row || row.tipoDetectado === null) return null;
  return {
    id: row.id,
    solicitudId: row.solicitudId,
    estudianteId: row.estudianteId,
    estudianteFacultadId: row.estudianteFacultadId,
    solicitudEstado: row.solicitudEstado,
    retiradoEn: row.retiradoEn,
    pathname: row.pathname,
    tipo: row.tipoDetectado as TipoDetectado,
    nombreOriginal: row.nombreOriginal,
  };
}

/** Writes the `documento.descargado` row (D13). Throws if the insert fails. */
export async function recordDocumentDownload(
  actorId: number,
  doc: {
    id: number;
    solicitudId: number;
    tipo: TipoDetectado;
    /** Defaults to `ver`, the inline view the route serves today. */
    modo?: DocumentMode;
  },
): Promise<void> {
  await db.transaction(async (tx) => {
    await insertAuditEvents(tx, actorId, [
      documentDownloadedEvent({
        documentoId: doc.id,
        solicitudId: doc.solicitudId,
        tipo: doc.tipo,
        modo: doc.modo ?? "ver",
      }),
    ]);
  });
}
