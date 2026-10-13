import "server-only";

import { and, asc, count, eq, gt, isNull, lte, type SQL } from "drizzle-orm";

import { db } from "@/db";
import {
  carrera,
  documentoRespaldo,
  grupo,
  solicitud,
  solicitudAsignatura,
  usuario,
} from "@/db/schema";
import { solicitudPresentadaEvent } from "@/lib/audit/events";
import { insertAuditEvents } from "@/lib/data/audit";
import type { Causa } from "@/lib/intake/causes";
import { DRAFT_TTL_DAYS } from "@/lib/intake/limits";
import type { DocumentStore } from "@/lib/intake/ports";

// Persistence of the intake draft and its submission (justification-intake A1,
// A5, A8). Mutating and security-critical: every function fails loud. Draft
// operations write NO audit row (D14); only `submitDraft` audits, inside its
// own transaction. `ActualizadoEn` is set explicitly on every draft mutation
// (no trigger) and `now` always comes from the caller (one clock, A5).

const DAY_MS = 24 * 60 * 60 * 1000;

export type DraftDocument = {
  id: number;
  nombreOriginal: string;
  tipo: string | null;
  tamanoBytes: number;
  estado: string;
};

export type Draft = {
  id: number;
  causa: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  actualizadoEn: Date;
  subjects: { grupoId: number; asignaturaId: number }[];
  documents: DraftDocument[];
};

export type DraftDetails = {
  causa: Causa;
  fechaInicio: string;
  fechaFin: string;
};

/** Drafts idle for longer than this are expired (D8), whether swept or not. */
export function cutoffOf(now: Date): Date {
  return new Date(now.getTime() - DRAFT_TTL_DAYS * DAY_MS);
}

function ownLiveDraft(userId: number, now: Date): SQL | undefined {
  return and(
    eq(solicitud.estudianteId, userId),
    eq(solicitud.estado, "borrador"),
    gt(solicitud.actualizadoEn, cutoffOf(now)),
  );
}

/**
 * What the intake steps edit (SR-13): the caller's draft, or the caller's own
 * returned request (`devuelta`) in place. A correction never touches a
 * `borrador`: the 30-day draft sweep would delete a presented request.
 */
export type EditTarget =
  { kind: "draft" } | { kind: "correction"; solicitudId: number };

export const DRAFT_TARGET: EditTarget = { kind: "draft" };

function ownReturned(userId: number, solicitudId: number): SQL | undefined {
  return and(
    eq(solicitud.id, solicitudId),
    eq(solicitud.estudianteId, userId),
    eq(solicitud.estado, "devuelta"),
  );
}

/** The target's row while it is still open for editing (a draft must be live). */
export function editableWhere(
  userId: number,
  target: EditTarget,
  now: Date,
): SQL | undefined {
  return target.kind === "draft"
    ? ownLiveDraft(userId, now)
    : ownReturned(userId, target.solicitudId);
}

/** The target's row by owner and state alone, for document writes (D12). */
export function ownedWhere(
  userId: number,
  target: EditTarget,
): SQL | undefined {
  return target.kind === "draft"
    ? and(eq(solicitud.estudianteId, userId), eq(solicitud.estado, "borrador"))
    : ownReturned(userId, target.solicitudId);
}

/** The caller's resumable draft (or returned request) with its parts, or null. */
export async function getLiveDraft(
  userId: number,
  now: Date,
  target: EditTarget = DRAFT_TARGET,
): Promise<Draft | null> {
  const [row] = await db
    .select({
      id: solicitud.id,
      causa: solicitud.causa,
      fechaInicio: solicitud.fechaInicio,
      fechaFin: solicitud.fechaFin,
      actualizadoEn: solicitud.actualizadoEn,
    })
    .from(solicitud)
    .where(editableWhere(userId, target, now))
    .limit(1);
  if (!row) return null;

  const subjects = await db
    .select({
      grupoId: solicitudAsignatura.grupoId,
      asignaturaId: grupo.asignaturaId,
    })
    .from(solicitudAsignatura)
    .innerJoin(grupo, eq(grupo.id, solicitudAsignatura.grupoId))
    .where(eq(solicitudAsignatura.solicitudId, row.id));

  const documents = await db
    .select({
      id: documentoRespaldo.id,
      nombreOriginal: documentoRespaldo.nombreOriginal,
      tipoDetectado: documentoRespaldo.tipoDetectado,
      tamanoBytes: documentoRespaldo.tamanoBytes,
      estado: documentoRespaldo.estado,
    })
    .from(documentoRespaldo)
    .where(
      and(
        eq(documentoRespaldo.solicitudId, row.id),
        isNull(documentoRespaldo.retiradoEn),
      ),
    )
    .orderBy(asc(documentoRespaldo.creadoEn));

  return {
    ...row,
    subjects,
    documents: documents.map(({ tipoDetectado, ...doc }) => ({
      ...doc,
      tipo: tipoDetectado,
    })),
  };
}

/**
 * Delete the draft matched by `where` with its subjects and documents (rows
 * cascade) and then its stored files, best effort: the orphan sweep is the
 * backstop. No audit row (D14). Returns whether a draft existed.
 */
async function purgeDraft(
  where: SQL | undefined,
  store: DocumentStore,
): Promise<boolean> {
  const rows = await db
    .select({ id: solicitud.id, pathname: documentoRespaldo.pathname })
    .from(solicitud)
    .leftJoin(
      documentoRespaldo,
      eq(documentoRespaldo.solicitudId, solicitud.id),
    )
    .where(where);
  if (rows.length === 0) return false;

  await db.delete(solicitud).where(and(eq(solicitud.id, rows[0].id), where));

  const pathnames = rows.flatMap((r) =>
    r.pathname === null ? [] : [r.pathname],
  );
  if (pathnames.length > 0) {
    try {
      await store.delete(pathnames);
    } catch {
      // The rows are gone; the orphan sweep removes the blobs later.
    }
  }
  return true;
}

/**
 * Resume the caller's live draft or create an empty one (D8). An expired draft
 * is purged first so the student can start over; two concurrent creations end
 * with one draft because the partial unique index makes the loser's insert a
 * no-op, and the loser then resumes the winner's draft.
 */
export async function openDraft(
  userId: number,
  now: Date,
  store: DocumentStore,
): Promise<Draft> {
  const live = await getLiveDraft(userId, now);
  if (live) return live;

  await purgeDraft(
    and(
      eq(solicitud.estudianteId, userId),
      eq(solicitud.estado, "borrador"),
      lte(solicitud.actualizadoEn, cutoffOf(now)),
    ),
    store,
  );

  const [created] = await db
    .insert(solicitud)
    .values({ estudianteId: userId })
    .onConflictDoNothing()
    .returning({ id: solicitud.id, actualizadoEn: solicitud.actualizadoEn });
  if (created) {
    return {
      id: created.id,
      causa: null,
      fechaInicio: null,
      fechaFin: null,
      actualizadoEn: created.actualizadoEn,
      subjects: [],
      documents: [],
    };
  }

  const winner = await getLiveDraft(userId, now);
  if (!winner)
    throw new Error("Draft creation lost the race and found no draft");
  return winner;
}

/** Save step 1. False when the caller has nothing open to edit. */
export async function saveDraftDetails(
  userId: number,
  now: Date,
  details: DraftDetails,
  target: EditTarget = DRAFT_TARGET,
): Promise<boolean> {
  const updated = await db
    .update(solicitud)
    .set({ ...details, actualizadoEn: now })
    .where(editableWhere(userId, target, now))
    .returning({ id: solicitud.id });
  return updated.length > 0;
}

/** Save step 2: the chosen groups replace the previous ones. */
export async function saveDraftSubjects(
  userId: number,
  now: Date,
  grupoIds: readonly number[],
  target: EditTarget = DRAFT_TARGET,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [draft] = await tx
      .update(solicitud)
      .set({ actualizadoEn: now })
      .where(editableWhere(userId, target, now))
      .returning({ id: solicitud.id });
    if (!draft) return false;

    await tx
      .delete(solicitudAsignatura)
      .where(eq(solicitudAsignatura.solicitudId, draft.id));
    if (grupoIds.length > 0) {
      await tx
        .insert(solicitudAsignatura)
        .values(
          grupoIds.map((grupoId) => ({ solicitudId: draft.id, grupoId })),
        );
    }
    return true;
  });
}

/** Confirmed discard (RNF-12): only the caller's own `borrador`. */
export function discardDraft(
  userId: number,
  store: DocumentStore,
): Promise<boolean> {
  return purgeDraft(
    and(eq(solicitud.estudianteId, userId), eq(solicitud.estado, "borrador")),
    store,
  );
}

export type SubmitInput = {
  userId: number;
  solicitudId: number;
  now: Date;
  /** The values the caller validated; the update only applies if they still hold. */
  causa: string;
  fechaInicio: string;
  fechaFin: string;
  grupoIds: readonly number[];
};

export type SubmitOutcome =
  { ok: true } | { ok: false; reason: "conflict" | "snapshot_incomplete" };

class SubmitConflict extends Error {}

/**
 * Submit a validated draft (RN-02, RN-06, D9): in ONE transaction snapshot the
 * student's account, move `borrador` to `pendiente` at the server time and write
 * `solicitud.presentada`. The update is guarded by owner, state, liveness and
 * the validated values, so a double submit or an edit between validation and
 * here changes nothing. After the update locks the row the stored groups and
 * documents are re-checked; any drift rolls the whole transaction back.
 */
export async function submitDraft(input: SubmitInput): Promise<SubmitOutcome> {
  const { userId, solicitudId, now } = input;
  try {
    return await db.transaction(async (tx): Promise<SubmitOutcome> => {
      const [account] = await tx
        .select({
          nombre: usuario.nombreCompleto,
          cif: usuario.cif,
          correo: usuario.correo,
          carrera: carrera.nombre,
        })
        .from(usuario)
        .leftJoin(carrera, eq(carrera.id, usuario.carreraId))
        .where(eq(usuario.id, userId))
        .limit(1);
      if (!account?.cif || !account.correo || !account.carrera) {
        return { ok: false, reason: "snapshot_incomplete" };
      }

      const updated = await tx
        .update(solicitud)
        .set({
          estado: "pendiente",
          presentadaEn: now,
          actualizadoEn: now,
          estudianteNombre: account.nombre,
          estudianteCif: account.cif,
          estudianteCorreo: account.correo,
          estudianteCarrera: account.carrera,
        })
        .where(
          and(
            eq(solicitud.id, solicitudId),
            ownLiveDraft(userId, now),
            eq(solicitud.causa, input.causa),
            eq(solicitud.fechaInicio, input.fechaInicio),
            eq(solicitud.fechaFin, input.fechaFin),
          ),
        )
        .returning({ id: solicitud.id });
      if (updated.length === 0) return { ok: false, reason: "conflict" };

      const stored = await tx
        .select({ grupoId: solicitudAsignatura.grupoId })
        .from(solicitudAsignatura)
        .where(eq(solicitudAsignatura.solicitudId, solicitudId));
      const expected = new Set(input.grupoIds);
      if (
        stored.length !== expected.size ||
        !stored.every((s) => expected.has(s.grupoId))
      ) {
        throw new SubmitConflict();
      }

      const [documents] = await tx
        .select({ n: count() })
        .from(documentoRespaldo)
        .where(
          and(
            eq(documentoRespaldo.solicitudId, solicitudId),
            eq(documentoRespaldo.estado, "valido"),
          ),
        );
      if (!documents || documents.n === 0) throw new SubmitConflict();

      await insertAuditEvents(tx, userId, [
        solicitudPresentadaEvent({
          solicitudId,
          asignaturas: stored.length,
          documentos: documents.n,
        }),
      ]);
      return { ok: true };
    });
  } catch (error) {
    if (error instanceof SubmitConflict)
      return { ok: false, reason: "conflict" };
    throw error;
  }
}
