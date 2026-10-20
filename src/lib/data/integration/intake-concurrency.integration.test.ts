import { and, count, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { eventoAuditoria } from "@/db/audit-schema";
import {
  documentoRespaldo,
  remision,
  solicitud,
  solicitudDecision,
} from "@/db/schema";
import { finalizeDocument } from "@/lib/data/documentos";
import { createFixtures, PDF_BYTES } from "@/lib/data/integration/fixtures";
import { dispatchRemission } from "@/lib/data/remission-dispatch";
import { resolveRequestScope } from "@/lib/data/request-scope";
import { decideRequest } from "@/lib/data/solicitud-decision";
import { discardDraft, openDraft, submitDraft } from "@/lib/data/solicitudes";
import type { DecisionInput } from "@/lib/intake/decision-validation";
import {
  createFakeDocumentStore,
  createFakeMailSender,
} from "@/lib/intake/fakes";
import { MAX_DOCUMENTS_PER_DRAFT } from "@/lib/intake/limits";
import { buildPathname } from "@/lib/intake/pathnames";

// Real-Postgres concurrency suite for justification-intake (task F.6).
//
// It exercises the REAL data-layer functions against a real database so the
// database, not JavaScript, decides each race:
//   - concurrent draft creation: the partial unique index `UX_Solicitud_Borrador`
//     leaves one live draft and the losers resume it (D8);
//   - double submit: the guarded UPDATE (`WHERE Estado = 'borrador'`) lets one
//     submission through and writes one `solicitud.presentada` row (RN-02, D9);
//   - concurrent finalize: the row lock on the draft keeps the document count
//     at the cap of 5 (RN-04, D12);
//   - concurrent decisions (secretary-review, SR-7): the row lock of the
//     guarded UPDATE lets one secretary decide a pending request; the others
//     get `conflict` and leave one decision row and one audit row. This needs
//     migration `0008_secretary_review` applied to the branch;
//   - concurrent remission dispatch (teacher-remission, TR-6): the guarded
//     claim lets one of several parallel dispatches of one remission reach
//     the mail port, so there is one `send` call and one `EnviadaEn`. This
//     needs migration `0009_teacher_remission` applied to the branch.
// Blob I/O goes through the in-memory `DocumentStore` fake: no Vercel Blob call.
//
// HOW TO RUN (never part of `npm test`):
//   1. Create a DISPOSABLE Neon branch of the project and apply the migrations
//      to it. Prefer its direct (non-`-pooler`) connection string.
//   2. INTEGRATION_DATABASE_URL=<branch url> INTEGRATION_ALLOW_WRITES=1 \
//        npm run test:integration
// Without INTEGRATION_DATABASE_URL the suite is skipped. With it but without
// INTEGRATION_ALLOW_WRITES=1, or with a URL equal to DATABASE_URL or whose host
// or database name contains "prod", the run fails on purpose.
//
// Residue: each test deletes the rows it created. Audit rows are append-only,
// so a student that submitted stays (with its catalog rows) on the branch.

// Decided by vitest.integration.setup.ts before it replaced DATABASE_URL.
const gate = { mode: process.env.INTEGRATION_GATE_MODE ?? "skip" };
if (gate.mode === "refuse") {
  throw new Error(
    `Refusing to run the integration suite: ${process.env.INTEGRATION_GATE_REASON}`,
  );
}

const CONCURRENCY = 6;
const DETAILS = {
  causa: "medica",
  fechaInicio: "2026-10-01",
  fechaFin: "2026-10-03",
};

describe.skipIf(gate.mode !== "run")(
  "justification-intake concurrency (real Postgres)",
  () => {
    const fixtures = createFixtures();

    beforeAll(async () => {
      // Fail fast and readable when the branch is unreachable or unmigrated.
      await db.select({ n: count() }).from(solicitud);
    });

    afterAll(async () => {
      await fixtures.cleanup();
    });

    it("keeps one live draft when creations race, and the losers resume it", async () => {
      const student = await fixtures.addStudent();
      const store = createFakeDocumentStore();
      const now = new Date();

      const drafts = await Promise.all(
        Array.from({ length: CONCURRENCY }, () =>
          openDraft(student.id, now, store),
        ),
      );

      const [first] = drafts;
      expect(drafts.every((draft) => draft.id === first.id)).toBe(true);

      const [open] = await db
        .select({ n: count() })
        .from(solicitud)
        .where(
          and(
            eq(solicitud.estudianteId, student.id),
            eq(solicitud.estado, "borrador"),
          ),
        );
      expect(open.n).toBe(1);

      expect(await discardDraft(student.id, store)).toBe(true);
    });

    it("lets exactly one of several simultaneous submits through, with one audit row", async () => {
      const student = await fixtures.addStudent();
      const group = await fixtures.addGroup();
      const draftId = await fixtures.addDraft(student.id);
      await fixtures.fillDraft(draftId, DETAILS, group);
      await fixtures.addValidDocument(draftId);

      const input = {
        userId: student.id,
        solicitudId: draftId,
        now: new Date(),
        ...DETAILS,
        grupoIds: [group],
      };
      const outcomes = await Promise.all(
        Array.from({ length: CONCURRENCY }, () => submitDraft(input)),
      );

      expect(outcomes.filter((o) => o.ok)).toHaveLength(1);
      for (const loser of outcomes.filter((o) => !o.ok)) {
        expect(loser).toEqual({ ok: false, reason: "conflict" });
      }

      const [row] = await db
        .select({ estado: solicitud.estado, cif: solicitud.estudianteCif })
        .from(solicitud)
        .where(eq(solicitud.id, draftId));
      expect(row).toEqual({ estado: "pendiente", cif: student.cif });

      const [audit] = await db
        .select({ n: count() })
        .from(eventoAuditoria)
        .where(
          and(
            eq(eventoAuditoria.accion, "solicitud.presentada"),
            eq(eventoAuditoria.entidadId, draftId),
          ),
        );
      expect(audit.n).toBe(1);
    });

    describe("concurrent decisions on one pending request (SR-7)", () => {
      const APPROVE: DecisionInput = {
        tipo: "aprobada",
        plantilla: "aprobacion.general",
        texto: null,
      };
      const REJECT: DecisionInput = {
        tipo: "rechazada",
        plantilla: "rechazo.documento_no_acredita",
        texto: "El documento no acredita las fechas.",
      };

      async function pendingRequest(studentId: number) {
        const group = await fixtures.addGroup();
        const draftId = await fixtures.addDraft(studentId);
        await fixtures.fillDraft(draftId, DETAILS, group);
        await fixtures.addValidDocument(draftId);
        const submitted = await submitDraft({
          userId: studentId,
          solicitudId: draftId,
          now: new Date(),
          ...DETAILS,
          grupoIds: [group],
        });
        expect(submitted).toEqual({ ok: true });
        return draftId;
      }

      it.each([2, CONCURRENCY])(
        "lets exactly one of %i simultaneous decisions through: one decision row, one audit row, the rest conflict",
        async (deciders) => {
          const student = await fixtures.addStudent();
          const requestId = await pendingRequest(student.id);
          const secretarias = [];
          for (let i = 0; i < deciders; i++) {
            secretarias.push(await fixtures.addSecretaria());
          }
          const scope = await resolveRequestScope(
            secretarias[0].id,
            "secretaria",
          );
          expect(scope).toEqual({
            kind: "facultad",
            facultadId: secretarias[0].facultadId,
          });

          const now = new Date();
          const outcomes = await Promise.all(
            secretarias.map((secretaria, i) =>
              decideRequest({
                actorId: secretaria.id,
                scope,
                solicitudId: requestId,
                decision: i % 2 === 0 ? APPROVE : REJECT,
                now,
              }),
            ),
          );

          expect(outcomes.filter((o) => o.ok)).toHaveLength(1);
          for (const loser of outcomes.filter((o) => !o.ok)) {
            expect(loser).toEqual({ ok: false, reason: "conflict" });
          }

          const decisions = await db
            .select({
              tipo: solicitudDecision.tipo,
              secretariaId: solicitudDecision.secretariaId,
            })
            .from(solicitudDecision)
            .where(eq(solicitudDecision.solicitudId, requestId));
          expect(decisions).toHaveLength(1);

          const [row] = await db
            .select({ estado: solicitud.estado })
            .from(solicitud)
            .where(eq(solicitud.id, requestId));
          expect(row.estado).toBe(decisions[0].tipo);

          const audits = await db
            .select({
              accion: eventoAuditoria.accion,
              actorId: eventoAuditoria.actorId,
            })
            .from(eventoAuditoria)
            .where(
              and(
                eq(eventoAuditoria.entidadId, requestId),
                inArray(eventoAuditoria.accion, [
                  "solicitud.aprobada",
                  "solicitud.rechazada",
                  "solicitud.devuelta",
                ]),
              ),
            );
          expect(audits).toEqual([
            {
              accion: `solicitud.${decisions[0].tipo}`,
              actorId: decisions[0].secretariaId,
            },
          ]);
        },
      );
    });

    describe("concurrent dispatch of one remission (TR-6, RNF-07)", () => {
      it.each([2, CONCURRENCY])(
        "sends once when %i dispatches race on the same remission",
        async (dispatchers) => {
          const student = await fixtures.addStudent();
          const secretaria = await fixtures.addSecretaria();
          const group = await fixtures.addGroup({
            correo: `it-docente-${fixtures.run}-${dispatchers}@integration.invalid`,
          });
          const draftId = await fixtures.addDraft(student.id);
          await fixtures.fillDraft(draftId, DETAILS, group);
          const pathname = await fixtures.addValidDocument(draftId);
          const submitted = await submitDraft({
            userId: student.id,
            solicitudId: draftId,
            now: new Date(),
            ...DETAILS,
            grupoIds: [group],
          });
          expect(submitted).toEqual({ ok: true });

          const scope = await resolveRequestScope(secretaria.id, "secretaria");
          const decided = await decideRequest({
            actorId: secretaria.id,
            scope,
            solicitudId: draftId,
            decision: {
              tipo: "aprobada",
              plantilla: "aprobacion.general",
              texto: null,
            },
            now: new Date(),
          });
          if (!decided.ok) throw new Error("approval failed");
          expect(decided.remisionIds).toHaveLength(1);
          const [remisionId] = decided.remisionIds;

          const store = createFakeDocumentStore();
          store.seed(pathname, PDF_BYTES);
          const mail = createFakeMailSender();
          const deps = { store, mail };

          const results = await Promise.all(
            Array.from({ length: dispatchers }, () =>
              dispatchRemission(
                remisionId,
                { trigger: "reenvio_manual", actorId: secretaria.id },
                deps,
              ),
            ),
          );

          expect(mail.calls).toHaveLength(1);
          expect(results.filter((r) => r.outcome === "sent")).toHaveLength(1);
          expect(results.filter((r) => r.outcome === "skipped")).toHaveLength(
            dispatchers - 1,
          );

          const [row] = await db
            .select({
              estado: remision.estado,
              enviadaEn: remision.enviadaEn,
              intentos: remision.intentos,
            })
            .from(remision)
            .where(eq(remision.id, remisionId));
          expect(row.estado).toBe("enviada");
          expect(row.enviadaEn).not.toBeNull();
          expect(row.intentos).toBe(1);

          const sent = await db
            .select({ n: count() })
            .from(eventoAuditoria)
            .where(
              and(
                eq(eventoAuditoria.accion, "remision.enviada"),
                eq(eventoAuditoria.entidadId, remisionId),
              ),
            );
          expect(sent[0].n).toBe(1);
        },
      );
    });

    describe("finalize beyond the document cap", () => {
      async function finalizeAll(
        studentId: number,
        draftId: number,
        files: number,
      ) {
        const store = createFakeDocumentStore();
        const pathnames = Array.from({ length: files }, (_, i) =>
          buildPathname(
            draftId,
            `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
            "pdf",
          ),
        );
        for (const pathname of pathnames) store.seed(pathname, PDF_BYTES);

        return Promise.all(
          pathnames.map((pathname, i) =>
            finalizeDocument(
              { userId: studentId, pathname, nombreOriginal: `doc-${i}.pdf` },
              store,
            ),
          ),
        );
      }

      async function documentCount(draftId: number, estado?: string) {
        const [row] = await db
          .select({ n: count() })
          .from(documentoRespaldo)
          .where(
            and(
              eq(documentoRespaldo.solicitudId, draftId),
              estado ? eq(documentoRespaldo.estado, estado) : undefined,
            ),
          );
        return row.n;
      }

      it("never ends with more than 5 documents when 8 finalize at once", async () => {
        const student = await fixtures.addStudent();
        const draftId = await fixtures.addDraft(student.id);

        const results = await finalizeAll(student.id, draftId, 8);

        expect(results.filter((r) => r.ok)).toHaveLength(
          MAX_DOCUMENTS_PER_DRAFT,
        );
        for (const refused of results.filter((r) => !r.ok)) {
          expect(refused).toEqual({ ok: false, reason: "too_many_documents" });
        }
        expect(await documentCount(draftId)).toBe(MAX_DOCUMENTS_PER_DRAFT);
        expect(await documentCount(draftId, "pendiente")).toBe(0);
      });

      it("admits only the remaining slot when 4 documents already exist", async () => {
        const student = await fixtures.addStudent();
        const draftId = await fixtures.addDraft(student.id);
        for (let i = 0; i < MAX_DOCUMENTS_PER_DRAFT - 1; i++) {
          await fixtures.addValidDocument(draftId);
        }

        const results = await finalizeAll(student.id, draftId, 4);

        expect(results.filter((r) => r.ok)).toHaveLength(1);
        expect(await documentCount(draftId)).toBe(MAX_DOCUMENTS_PER_DRAFT);
      });
    });
  },
);
