import "server-only";

import { and, count, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";

import { db } from "@/db";
import {
  documentoRespaldo,
  solicitud,
  solicitudAsignatura,
  solicitudRevision,
} from "@/db/schema";
import { solicitudCorregidaEvent } from "@/lib/audit/events";
import { insertAuditEvents } from "@/lib/data/audit";
import { listEligibleGroups } from "@/lib/data/enrollment";
import {
  getLiveDraft,
  ownedWhere,
  type EditTarget,
} from "@/lib/data/solicitudes";
import { isIsoDate, managuaToday } from "@/lib/intake/dates";
import { MAX_DOCUMENTS_PER_DRAFT } from "@/lib/intake/limits";
import type { GroupScheduleProvider } from "@/lib/intake/ports";
import {
  validateSubmission,
  type SubmissionError,
  type SubmissionErrorCode,
} from "@/lib/intake/submission";

// Resubmission of a returned request (RF-08 a, RF-08 c, RN-16; SR-13). The
// request was edited in place while `devuelta`; the snapshot of the returned
// version was written by the return itself, so this writes none. One
// transaction: guarded UPDATE to `pendiente` with `ReenviadaEn` (restarts the
// RN-08 clock), drift re-checks, one `solicitud.corregida` row. The student
// snapshot columns (RN-02) are never touched, the filing window (RN-23) is not
// re-applied, and no `borrador` exists at any point.
//
// No consent is asked here: a resubmission must not ask for it again, and a
// request presented before consent existed stays correctable (RN-25). If RF-11
// extraction must rerun for documents added in a correction, this is the hook.

export type CorrectionInput = {
  userId: number;
  solicitudId: number;
  now: Date;
  schedule: GroupScheduleProvider;
};

export type CorrectionError = Omit<SubmissionError, "code"> & {
  code: SubmissionErrorCode | "too_many_documents";
};

export type CorrectionOutcome =
  | { ok: true }
  | { ok: false; reason: "not_found" | "conflict" }
  | { ok: false; reason: "invalid"; errors: CorrectionError[] };

class Drift extends Error {}

export async function resubmitCorrection(
  input: CorrectionInput,
): Promise<CorrectionOutcome> {
  const { userId, solicitudId, now, schedule } = input;
  const target: EditTarget = { kind: "correction", solicitudId };

  const request = await getLiveDraft(userId, now, target);
  if (!request) return { ok: false, reason: "not_found" };

  const { causa, fechaInicio, fechaFin } = request;
  const range =
    isIsoDate(fechaInicio) && isIsoDate(fechaFin) && fechaInicio <= fechaFin
      ? { from: fechaInicio, to: fechaFin }
      : null;
  const valid = request.documents.filter((d) => d.estado === "valido").length;
  const validation = validateSubmission(
    {
      causa,
      fechaInicio,
      fechaFin,
      selections: request.subjects,
      eligibleGroups: await listEligibleGroups(userId, range, schedule),
      validDocumentCount: valid,
    },
    managuaToday(now),
    { filingWindow: false },
  );
  const errors: CorrectionError[] = [
    ...(validation.ok ? [] : validation.errors),
    ...(valid > MAX_DOCUMENTS_PER_DRAFT
      ? [{ field: "documents", code: "too_many_documents" } as const]
      : []),
  ];
  if (errors.length > 0) return { ok: false, reason: "invalid", errors };

  try {
    return await db.transaction(async (tx): Promise<CorrectionOutcome> => {
      const updated = await tx
        .update(solicitud)
        .set({ estado: "pendiente", reenviadaEn: now, actualizadoEn: now })
        .where(
          and(
            ownedWhere(userId, target),
            eq(solicitud.causa, causa as string),
            eq(solicitud.fechaInicio, fechaInicio as string),
            eq(solicitud.fechaFin, fechaFin as string),
          ),
        )
        .returning({ id: solicitud.id });
      if (updated.length === 0) return { ok: false, reason: "conflict" };

      // The update holds the row lock: what is stored now is what is submitted.
      const stored = await tx
        .select({ grupoId: solicitudAsignatura.grupoId })
        .from(solicitudAsignatura)
        .where(eq(solicitudAsignatura.solicitudId, solicitudId));
      const expected = new Set(request.subjects.map((s) => s.grupoId));
      if (
        stored.length !== expected.size ||
        !stored.every((s) => expected.has(s.grupoId))
      ) {
        throw new Drift();
      }

      const [documents] = await tx
        .select({ n: count() })
        .from(documentoRespaldo)
        .where(
          and(
            eq(documentoRespaldo.solicitudId, solicitudId),
            eq(documentoRespaldo.estado, "valido"),
            isNull(documentoRespaldo.retiradoEn),
          ),
        );
      if (
        !documents ||
        documents.n === 0 ||
        documents.n > MAX_DOCUMENTS_PER_DRAFT
      ) {
        throw new Drift();
      }

      const [revision] = await tx
        .select({
          numero: solicitudRevision.numero,
          documentoIds: solicitudRevision.documentoIds,
        })
        .from(solicitudRevision)
        .where(eq(solicitudRevision.solicitudId, solicitudId))
        .orderBy(desc(solicitudRevision.numero))
        .limit(1);
      if (!revision) {
        throw new Error(`Returned request ${solicitudId} has no revision`);
      }
      const [retired] = await tx
        .select({ n: count() })
        .from(documentoRespaldo)
        .where(
          and(
            inArray(documentoRespaldo.id, revision.documentoIds),
            isNotNull(documentoRespaldo.retiradoEn),
          ),
        );

      await insertAuditEvents(tx, userId, [
        solicitudCorregidaEvent({
          solicitudId,
          revision: revision.numero,
          asignaturas: stored.length,
          documentos: documents.n,
          documentosRetirados: retired?.n ?? 0,
        }),
      ]);
      return { ok: true };
    });
  } catch (error) {
    if (error instanceof Drift) return { ok: false, reason: "conflict" };
    throw error;
  }
}
