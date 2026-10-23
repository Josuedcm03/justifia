import "server-only";

import { and, count, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  carrera,
  escalamiento,
  remision,
  reporteInasistencia,
  rol,
  solicitud,
  usuario,
} from "@/db/schema";
import {
  solicitudEscaladaEvent,
  solicitudReporteInasistenciasEvent,
} from "@/lib/audit/events";
import { insertAuditEvents, type Transaction } from "@/lib/data/audit";
import {
  requestInScope,
  requestRowInScope,
} from "@/lib/data/request-scope-sql";
import {
  ESCALATION_REASON,
  EXCESS_NOTICE_KIND,
  EXCESS_REPORT_STATE,
  validateEscalationDraft,
  validateReportDraft,
  type EscalationError,
} from "@/lib/intake/escalation";
import type { RequestScope } from "@/lib/intake/request-scope";
import { VISIBLE_STATES } from "@/lib/intake/states";
import { sourceOf } from "@/lib/intake/transitions";

// Escalation of a request to the career coordination (RF-10 a, RN-20, RN-16;
// ES-3, ES-6). One transaction per write, like `decideRequest`: a guarded
// UPDATE whose `WHERE "Estado" = <from>` comes off the RN-16 table, the
// escalation row (also its notification outbox, born `pendiente`) and the audit
// row. Two concurrent writers serialise on the row lock of the UPDATE; the
// loser matches nothing and reports `conflict`. The caller (a Server Action)
// authorises the role and resolves the scope; the actor is the session user,
// never request input. Nothing here sends mail: the post-commit notice belongs
// to the dispatch unit, so a mail outage can never undo an escalation.

type Db = typeof db;

/** The state a suspicion moves the request into. */
const COORDINATION_STATE = "en_revision_coordinacion";

export type EscalationOutcome =
  | { ok: true; escalamientoId: number }
  | { ok: false; reason: "not_found" | "conflict" }
  | { ok: false; reason: "invalid"; errors: EscalationError[] }
  | { ok: false; reason: "sin_coordinacion"; carreraNombre: string };

/** Thrown inside the transaction to roll it back with `sin_coordinacion`. */
class NoCoordination extends Error {
  constructor(readonly carreraNombre: string) {
    super(`The career ${carreraNombre} has no active coordination account`);
  }
}

/** SQLSTATE `unique_violation`, read from `error.cause.code` or `code`. */
function isUniqueViolation(error: unknown): boolean {
  const code = (e: unknown) => (e as { code?: unknown } | null)?.code;
  return (
    code(error) === "23505" ||
    code((error as { cause?: unknown } | null)?.cause) === "23505"
  );
}

/**
 * The student's live career (never the snapshot name, ES-3) and how many active
 * `coordinacion` accounts it has. The email is ignored on purpose: an account
 * without one still refuses nothing (E17), its notice is blocked later. `null`
 * when the request or its student's career does not exist.
 */
export async function countCoordinationAccounts(
  q: Db | Transaction,
  solicitudId: number,
): Promise<{ carreraNombre: string; cuentas: number } | null> {
  const [career] = await q
    .select({ carreraId: carrera.id, carreraNombre: carrera.nombre })
    .from(solicitud)
    .innerJoin(usuario, eq(usuario.id, solicitud.estudianteId))
    .innerJoin(carrera, eq(carrera.id, usuario.carreraId))
    .where(eq(solicitud.id, solicitudId));
  if (!career) return null;

  const [accounts] = await q
    .select({ n: count() })
    .from(usuario)
    .innerJoin(rol, eq(rol.id, usuario.rolId))
    .where(
      and(
        eq(usuario.carreraId, career.carreraId),
        eq(usuario.activo, true),
        eq(rol.codigo, "coordinacion"),
      ),
    );
  return { carreraNombre: career.carreraNombre, cuentas: accounts?.n ?? 0 };
}

/**
 * The count for the staff detail (E17): the caller has already proven the
 * request is in scope, so this only reads the student's live career and its
 * active coordination accounts to decide whether to offer the escalation.
 */
export function coordinationAccountsOf(solicitudId: number) {
  return countCoordinationAccounts(db, solicitudId);
}

export type EscalateInput = {
  actorId: number;
  scope: RequestScope;
  solicitudId: number;
  nota: string;
  now: Date;
};

export async function escalateRequest(
  input: EscalateInput,
): Promise<EscalationOutcome> {
  const { actorId, scope, solicitudId, now } = input;
  const checked = validateEscalationDraft({
    motivo: ESCALATION_REASON,
    nota: input.nota,
  });
  if (!checked.ok) {
    return { ok: false, reason: "invalid", errors: checked.errors };
  }
  const from = sourceOf(COORDINATION_STATE, "secretaria");

  try {
    return await db.transaction(async (tx): Promise<EscalationOutcome> => {
      const [moved] = await tx
        .update(solicitud)
        .set({ estado: COORDINATION_STATE, actualizadoEn: now })
        .where(
          and(
            eq(solicitud.id, solicitudId),
            eq(solicitud.estado, from),
            requestInScope(scope),
          ),
        )
        .returning({ id: solicitud.id });
      if (!moved) {
        const [existing] = await tx
          .select({ id: solicitud.id })
          .from(solicitud)
          .where(
            and(
              requestRowInScope(scope, solicitudId),
              inArray(solicitud.estado, [...VISIBLE_STATES]),
            ),
          )
          .limit(1);
        return { ok: false, reason: existing ? "conflict" : "not_found" };
      }

      // E17: a career with nobody to answer refuses the escalation. Throwing
      // rolls the state change back, so the request stays `pendiente`.
      const accounts = await countCoordinationAccounts(tx, solicitudId);
      if (accounts === null) {
        throw new Error(`Request ${solicitudId} has no student career`);
      }
      if (accounts.cuentas === 0) {
        throw new NoCoordination(accounts.carreraNombre);
      }

      const [row] = await tx
        .insert(escalamiento)
        .values({
          solicitudId,
          tipo: ESCALATION_REASON,
          estadoPrevio: from,
          nota: checked.nota,
          secretariaId: actorId,
          creadoEn: now,
          notificacionEstado: "pendiente",
        })
        .returning({ id: escalamiento.id });

      await insertAuditEvents(tx, actorId, [
        solicitudEscaladaEvent({
          solicitudId,
          escalamientoId: row.id,
          motivo: ESCALATION_REASON,
          estadoPrevio: from,
          estadoNuevo: COORDINATION_STATE,
        }),
      ]);
      return { ok: true, escalamientoId: row.id };
    });
  } catch (error) {
    if (error instanceof NoCoordination) {
      return {
        ok: false,
        reason: "sin_coordinacion",
        carreraNombre: error.carreraNombre,
      };
    }
    // E12: the partial unique index backs the guarded update.
    if (isUniqueViolation(error)) return { ok: false, reason: "conflict" };
    throw error;
  }
}

export type ReportOutcome =
  | { ok: true; reporteId: number; escalamientoId: number }
  | { ok: false; reason: "not_found" | "conflict" }
  | { ok: false; reason: "invalid"; errors: EscalationError[] };

export type ReportInput = {
  actorId: number;
  scope: RequestScope;
  solicitudId: number;
  /** The request's own remission row that names the teacher. */
  remisionId: number;
  comunicadoEl: unknown;
  nota?: unknown;
  now: Date;
};

/**
 * RF-15 / RF-10 b (ES-7): record that a teacher communicated excess absences of
 * an approved request. The request is locked `FOR UPDATE` so the state cannot
 * move under the insert; it stays `aprobada` and its remissions are untouched.
 * The report is append-only and carries the teacher's id and name snapshot, a
 * calendar date and an optional note, never a percentage. Its notice is born
 * `pendiente` and is recorded even when the career has no recipient (E17): the
 * post-commit dispatch blocks it with `sin_destinatarios`.
 */
export async function recordExcessReport(
  input: ReportInput,
): Promise<ReportOutcome> {
  const { actorId, scope, solicitudId, remisionId, now } = input;
  const checked = validateReportDraft(
    { comunicadoEl: input.comunicadoEl, nota: input.nota },
    now,
  );
  if (!checked.ok) {
    return { ok: false, reason: "invalid", errors: checked.errors };
  }

  return db.transaction(async (tx): Promise<ReportOutcome> => {
    const [locked] = await tx
      .select({ id: solicitud.id })
      .from(solicitud)
      .where(
        and(
          eq(solicitud.id, solicitudId),
          eq(solicitud.estado, EXCESS_REPORT_STATE),
          requestInScope(scope),
        ),
      )
      .for("update");
    if (!locked) {
      const [existing] = await tx
        .select({ id: solicitud.id })
        .from(solicitud)
        .where(
          and(
            requestRowInScope(scope, solicitudId),
            inArray(solicitud.estado, [...VISIBLE_STATES]),
          ),
        )
        .limit(1);
      return { ok: false, reason: existing ? "conflict" : "not_found" };
    }

    const [teacher] = await tx
      .select({
        docenteId: remision.docenteId,
        docenteNombre: remision.docenteNombre,
      })
      .from(remision)
      .where(
        and(eq(remision.id, remisionId), eq(remision.solicitudId, solicitudId)),
      );
    if (!teacher) {
      return {
        ok: false,
        reason: "invalid",
        errors: [{ field: "docente", code: "docente_invalid" }],
      };
    }

    const [report] = await tx
      .insert(reporteInasistencia)
      .values({
        solicitudId,
        docenteId: teacher.docenteId,
        docenteNombre: teacher.docenteNombre,
        comunicadoEl: checked.comunicadoEl,
        nota: checked.nota,
        registradoPorId: actorId,
        registradoEn: now,
      })
      .returning({ id: reporteInasistencia.id });
    const [notice] = await tx
      .insert(escalamiento)
      .values({
        solicitudId,
        tipo: EXCESS_NOTICE_KIND,
        estadoPrevio: EXCESS_REPORT_STATE,
        reporteId: report.id,
        secretariaId: actorId,
        creadoEn: now,
        notificacionEstado: "pendiente",
      })
      .returning({ id: escalamiento.id });

    await insertAuditEvents(tx, actorId, [
      solicitudReporteInasistenciasEvent({
        solicitudId,
        reporteId: report.id,
        escalamientoId: notice.id,
        docenteId: teacher.docenteId,
      }),
    ]);
    return { ok: true, reporteId: report.id, escalamientoId: notice.id };
  });
}
