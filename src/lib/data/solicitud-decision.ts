import "server-only";

import { and, eq, inArray, isNull, max } from "drizzle-orm";

import { db } from "@/db";
import {
  documentoRespaldo,
  remision,
  solicitud,
  solicitudDecision,
  solicitudRevision,
} from "@/db/schema";
import {
  remisionCreadaEvent,
  solicitudDecididaEvent,
} from "@/lib/audit/events";
import { insertAuditEvents, type Transaction } from "@/lib/data/audit";
import {
  requestInScope,
  requestRowInScope,
} from "@/lib/data/request-scope-sql";
import {
  listRequestClasses,
  listRequestTeachers,
} from "@/lib/data/solicitud-clases";
import type { Causa } from "@/lib/intake/causes";
import { renderTemplate } from "@/lib/intake/decision-templates";
import {
  validateDecision,
  type DecisionInput,
} from "@/lib/intake/decision-validation";
import type { RequestScope } from "@/lib/intake/request-scope";
import { buildRemissionRows } from "@/lib/remission/recipients";
import { VISIBLE_STATES, type EstadoSolicitud } from "@/lib/intake/states";
import { TRANSITIONS } from "@/lib/intake/transitions";

// One secretary decision (RF-07, RN-15, RN-16, RN-17; SR-4, SR-7). A single
// transaction: guarded UPDATE, the revision snapshot of a return, the decision
// row and the audit row. Two concurrent decisions serialise on the row lock of
// the UPDATE; the loser re-evaluates the guard, matches nothing and reports
// `conflict`. The caller (a Server Action) authorises the role and resolves the
// scope; the actor is the session user, never request input.

export type DecisionOutcome =
  | {
      ok: true;
      /** Remissions created by an approval, for the post-commit dispatch. */
      remisionIds: number[];
      /** The approval carried the RN-19 special-format mark. */
      formatoEspecial: boolean;
    }
  | { ok: false; reason: "not_found" | "conflict" | "invalid" };

/** Thrown inside the transaction to roll it back with an `invalid` outcome. */
class InvalidDecision extends Error {}

const FORCE_MAJEURE: Causa = "fuerza_mayor";

export type DecideInput = {
  actorId: number;
  scope: RequestScope;
  solicitudId: number;
  decision: DecisionInput;
  now: Date;
};

/**
 * The only state a secretary decision may start from, read off the RN-16 table
 * so the SQL guard and the table cannot drift apart (a test pins both).
 */
function stateBefore(target: EstadoSolicitud): EstadoSolicitud {
  const sources = new Set(
    TRANSITIONS.filter((t) => t.to === target && t.actor === "secretaria").map(
      (t) => t.from,
    ),
  );
  const [only] = sources;
  if (sources.size !== 1 || only === undefined) {
    throw new Error(`No unique secretary transition into ${target}`);
  }
  return only;
}

/** Snapshot of the version being returned (RF-08 b): `Numero = max + 1`. */
async function writeRevision(
  tx: Transaction,
  request: {
    id: number;
    causa: string | null;
    fechaInicio: string | null;
    fechaFin: string | null;
  },
): Promise<number> {
  const classes = await listRequestClasses(tx, [request.id]);
  const documents = await tx
    .select({ id: documentoRespaldo.id })
    .from(documentoRespaldo)
    .where(
      and(
        eq(documentoRespaldo.solicitudId, request.id),
        eq(documentoRespaldo.estado, "valido"),
        isNull(documentoRespaldo.retiradoEn),
      ),
    );
  const [last] = await tx
    .select({ max: max(solicitudRevision.numero) })
    .from(solicitudRevision)
    .where(eq(solicitudRevision.solicitudId, request.id));
  if (!request.causa || !request.fechaInicio || !request.fechaFin) {
    throw new Error(`Request ${request.id} lacks the data to snapshot`);
  }

  const [revision] = await tx
    .insert(solicitudRevision)
    .values({
      solicitudId: request.id,
      numero: (last?.max ?? 0) + 1,
      causa: request.causa,
      fechaInicio: request.fechaInicio,
      fechaFin: request.fechaFin,
      clases: (classes.get(request.id) ?? []).map(
        ({ asignaturaId, codigo, nombre, numeroGrupo }) => ({
          asignaturaId,
          codigo,
          nombre,
          numeroGrupo,
        }),
      ),
      documentoIds: documents.map((d) => d.id),
    })
    .returning({ id: solicitudRevision.id });
  return revision.id;
}

export async function decideRequest(
  input: DecideInput,
): Promise<DecisionOutcome> {
  const { actorId, scope, solicitudId, now } = input;
  const checked = validateDecision({
    tipo: input.decision.tipo,
    plantilla: input.decision.plantilla,
    motivo: input.decision.tipo === "devuelta" ? input.decision.motivo : null,
    texto: input.decision.texto,
    formatoEspecial: (input.decision as { formatoEspecial?: boolean })
      .formatoEspecial,
  });
  if (!checked.ok) return { ok: false, reason: "invalid" };
  const decision = checked.decision;

  const marked =
    decision.tipo === "aprobada" && decision.formatoEspecial === true;

  try {
    return await db.transaction(async (tx): Promise<DecisionOutcome> => {
      const updated = await tx
        .update(solicitud)
        .set({ estado: decision.tipo, actualizadoEn: now })
        .where(
          and(
            eq(solicitud.id, solicitudId),
            eq(solicitud.estado, stateBefore(decision.tipo)),
            requestInScope(scope),
          ),
        )
        .returning({
          id: solicitud.id,
          causa: solicitud.causa,
          fechaInicio: solicitud.fechaInicio,
          fechaFin: solicitud.fechaFin,
          estudianteNombre: solicitud.estudianteNombre,
        });
      const [request] = updated;
      if (!request) {
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

      // RN-19: the mark is only valid for force majeure. Throwing rolls the
      // whole transaction back, so the request stays `pendiente`.
      if (marked) {
        if (request.causa !== FORCE_MAJEURE) throw new InvalidDecision();
        await tx
          .update(solicitud)
          .set({ formatoEspecial: true })
          .where(eq(solicitud.id, solicitudId));
      }

      const revisionId =
        decision.tipo === "devuelta" ? await writeRevision(tx, request) : null;

      const [row] = await tx
        .insert(solicitudDecision)
        .values({
          solicitudId,
          tipo: decision.tipo,
          plantillaCodigo: decision.plantilla,
          motivoCodigo: decision.tipo === "devuelta" ? decision.motivo : null,
          texto: decision.texto,
          revisionId,
          secretariaId: actorId,
          decididaEn: now,
        })
        .returning({ id: solicitudDecision.id });

      const rendered = renderTemplate(decision.plantilla, {
        estudiante: request.estudianteNombre ?? "",
        causa: request.causa as Causa,
        fechaInicio: request.fechaInicio ?? "",
        fechaFin: request.fechaFin ?? "",
      });
      await insertAuditEvents(tx, actorId, [
        solicitudDecididaEvent({
          solicitudId,
          tipo: decision.tipo,
          decisionId: row.id,
          plantilla: decision.plantilla,
          ...(decision.tipo === "devuelta" ? { motivo: decision.motivo } : {}),
          textoEditado: (decision.texto ?? "") !== rendered,
        }),
      ]);

      const remisionIds =
        decision.tipo === "aprobada"
          ? await createRemissions(tx, actorId, solicitudId, marked)
          : [];
      return { ok: true, remisionIds, formatoEspecial: marked };
    });
  } catch (error) {
    if (error instanceof InvalidDecision) {
      return { ok: false, reason: "invalid" };
    }
    throw error;
  }
}

/**
 * One remission per distinct teacher of the approved request, inserted in the
 * approval's own transaction with the snapshot of id, name, email and groups
 * (TR-4, RF-09 a), each with its `remision.creada` event. A mail outage can
 * never undo the approval because no send happens here.
 */
async function createRemissions(
  tx: Transaction,
  actorId: number,
  solicitudId: number,
  formatoEspecial: boolean,
): Promise<number[]> {
  const drafts = buildRemissionRows(
    await listRequestTeachers(tx, solicitudId),
    {
      formatoEspecial,
    },
  );
  if (drafts.length === 0) return [];

  const created = await tx
    .insert(remision)
    .values(drafts.map((draft) => ({ solicitudId, ...draft })))
    .returning({ id: remision.id, docenteId: remision.docenteId });

  const byTeacher = new Map(created.map((r) => [r.docenteId, r.id]));
  await insertAuditEvents(
    tx,
    actorId,
    drafts.map((draft) =>
      remisionCreadaEvent({
        remisionId: byTeacher.get(draft.docenteId) as number,
        solicitudId,
        estado: draft.estado,
        ...(draft.motivoCodigo ? { motivo: draft.motivoCodigo } : {}),
      }),
    ),
  );
  return created.map((r) => r.id);
}
