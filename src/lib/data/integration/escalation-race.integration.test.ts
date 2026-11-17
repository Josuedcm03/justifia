import { and, count, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { eventoAuditoria } from "@/db/audit-schema";
import { escalamiento, solicitud, solicitudDecision } from "@/db/schema";
import { createFixtures } from "@/lib/data/integration/fixtures";
import { resolveRequestScope } from "@/lib/data/request-scope";
import { escalateRequest } from "@/lib/data/solicitud-escalation";
import { decideRequest } from "@/lib/data/solicitud-decision";
import { submitDraft } from "@/lib/data/solicitudes";
import { CONSENT_VERSION } from "@/lib/intake/consent";
import type { DecisionInput } from "@/lib/intake/decision-validation";

// Real-Postgres race between the two secretary writes on one pending request
// (escalation, task 12.11, ES-3, E12). `escalateRequest` and `decideRequest`
// (approve) both start with a guarded UPDATE on `Estado = 'pendiente'`, so the
// row lock of the first one makes the other match nothing. The database, not
// JavaScript, decides the winner; this proves the final state is consistent
// whichever one it is:
//   - the escalation wins: the request is in `en_revision_coordinacion`, one
//     escalation row, no decision row, and the approval reports `conflict`;
//   - the approval wins: the request is `aprobada`, one decision row, no
//     escalation row, and the escalation reports `conflict`.
// Several rounds, each on its own request, so both orders can occur.
//
// HOW TO RUN (never part of `npm test`; owner-run, phase 14):
//   INTEGRATION_DATABASE_URL=<disposable branch url> \
//   INTEGRATION_ALLOW_WRITES=1 npm run test:integration
// The branch needs migration `0012_escalation` applied. The opt-in guard is the
// one of `intake-concurrency.integration.test.ts`.
//
// Residue: audit rows are append-only, so the students of this run (with their
// catalog rows) stay on the branch; `cleanup()` removes the rest.

// Decided by vitest.integration.setup.ts before it replaced DATABASE_URL.
const gate = { mode: process.env.INTEGRATION_GATE_MODE ?? "skip" };
if (gate.mode === "refuse") {
  throw new Error(
    `Refusing to run the integration suite: ${process.env.INTEGRATION_GATE_REASON}`,
  );
}

const ROUNDS = 8;
// Each round builds a request and runs two transactions over the network; on a
// remote branch eight rounds outlast the 60 s default (phase 14 run, 2026-10-30).
const RACE_TIMEOUT_MS = 300_000;
const DETAILS = {
  causa: "medica",
  fechaInicio: "2026-10-01",
  fechaFin: "2026-10-03",
};
const APPROVE: DecisionInput = {
  tipo: "aprobada",
  plantilla: "aprobacion.general",
  texto: null,
};
const NOTE = "The certificate looks altered";

describe.skipIf(gate.mode !== "run")(
  "escalation versus approval on one request (real Postgres)",
  () => {
    const fixtures = createFixtures();
    let secretariaId: number;
    let scope: Awaited<ReturnType<typeof resolveRequestScope>>;

    beforeAll(async () => {
      // Fail fast and readable when the branch is unreachable or unmigrated.
      await db.select({ n: count() }).from(escalamiento);
      secretariaId = (await fixtures.addSecretaria()).id;
      // E17: an escalation needs an active coordination account in the career.
      await fixtures.addCoordinator();
      scope = await resolveRequestScope(secretariaId, "secretaria");
    });

    afterAll(async () => {
      await fixtures.cleanup();
    });

    async function pendingRequest(): Promise<number> {
      const student = await fixtures.addStudent();
      const group = await fixtures.addGroup();
      const draftId = await fixtures.addDraft(student.id);
      await fixtures.fillDraft(draftId, DETAILS, group);
      await fixtures.addValidDocument(draftId);
      const submitted = await submitDraft({
        userId: student.id,
        solicitudId: draftId,
        now: new Date(),
        ...DETAILS,
        grupoIds: [group],
        consentimientoVersion: CONSENT_VERSION,
      });
      expect(submitted).toEqual({ ok: true });
      return draftId;
    }

    it(
      `leaves one winner and a consistent state in each of ${ROUNDS} races`,
      async () => {
        for (let round = 0; round < ROUNDS; round++) {
          const requestId = await pendingRequest();
          const now = new Date();

          const [escalation, approval] = await Promise.all([
            escalateRequest({
              actorId: secretariaId,
              scope,
              solicitudId: requestId,
              motivo: "sospecha_documento",
              nota: NOTE,
              now,
            }),
            decideRequest({
              actorId: secretariaId,
              scope,
              solicitudId: requestId,
              decision: APPROVE,
              now,
            }),
          ]);

          // Exactly one of the two writes won; the other one reports a conflict.
          expect([escalation.ok, approval.ok].filter(Boolean)).toHaveLength(1);

          const [row] = await db
            .select({ estado: solicitud.estado })
            .from(solicitud)
            .where(eq(solicitud.id, requestId));
          const escalations = await db
            .select({ id: escalamiento.id, tipo: escalamiento.tipo })
            .from(escalamiento)
            .where(eq(escalamiento.solicitudId, requestId));
          const decisions = await db
            .select({ tipo: solicitudDecision.tipo })
            .from(solicitudDecision)
            .where(eq(solicitudDecision.solicitudId, requestId));
          const audits = await db
            .select({ accion: eventoAuditoria.accion })
            .from(eventoAuditoria)
            .where(
              and(
                eq(eventoAuditoria.entidadId, requestId),
                inArray(eventoAuditoria.accion, [
                  "solicitud.escalada",
                  "solicitud.aprobada",
                ]),
              ),
            );

          if (escalation.ok) {
            expect(approval).toEqual({ ok: false, reason: "conflict" });
            expect(row.estado).toBe("en_revision_coordinacion");
            expect(escalations).toEqual([
              { id: escalation.escalamientoId, tipo: "sospecha_documento" },
            ]);
            expect(decisions).toEqual([]);
            expect(audits).toEqual([{ accion: "solicitud.escalada" }]);
          } else {
            expect(escalation).toEqual({ ok: false, reason: "conflict" });
            expect(row.estado).toBe("aprobada");
            expect(escalations).toEqual([]);
            expect(decisions).toEqual([{ tipo: "aprobada" }]);
            expect(audits).toEqual([{ accion: "solicitud.aprobada" }]);
          }
        }
      },
      RACE_TIMEOUT_MS,
    );
  },
);
