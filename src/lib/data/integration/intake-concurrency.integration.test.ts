import { and, count, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { eventoAuditoria } from "@/db/audit-schema";
import { documentoRespaldo, solicitud } from "@/db/schema";
import { finalizeDocument } from "@/lib/data/documentos";
import { createFixtures, PDF_BYTES } from "@/lib/data/integration/fixtures";
import { discardDraft, openDraft, submitDraft } from "@/lib/data/solicitudes";
import { createFakeDocumentStore } from "@/lib/intake/fakes";
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
//     at the cap of 5 (RN-04, D12).
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
