import { count, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { documentoRespaldo, extraccionDocumento } from "@/db/schema";
import {
  claimExtraction,
  registerPendingExtractions,
} from "@/lib/data/extraction";
import { createFixtures } from "@/lib/data/integration/fixtures";
import { submitDraft } from "@/lib/data/solicitudes";
import { CONSENT_VERSION } from "@/lib/intake/consent";

// Real-Postgres suite for document-extraction (task 2.17), opt-in and never
// part of `npm test`. The database, not JavaScript, decides each case:
//   - concurrent claim (RF-11): the guarded `UPDATE ... RETURNING` lets one of
//     several parallel claims of one row win, and exactly one attempt is
//     counted;
//   - cascade (RNF-04): deleting a document deletes its extraction row.
// It needs migration `0011_document_extraction` applied to the branch.
//
// HOW TO RUN: the same rules as `intake-concurrency.integration.test.ts`
// (a DISPOSABLE Neon branch, the owner's explicit yes, direct connection):
//   INTEGRATION_DATABASE_URL=<branch url> INTEGRATION_ALLOW_WRITES=1 \
//     npm run test:integration
// Without INTEGRATION_DATABASE_URL the suite is skipped; the guard refuses a
// URL equal to DATABASE_URL or naming "prod". No Blob call is made.

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
  "document-extraction claim and cascade (real Postgres)",
  () => {
    const fixtures = createFixtures();

    beforeAll(async () => {
      // Fail fast and readable when the branch lacks migration 0011.
      await db.select({ n: count() }).from(extraccionDocumento);
    });

    afterAll(async () => {
      await fixtures.cleanup();
    });

    /** A presented request with one finalized student document, registered. */
    async function registeredDocument(): Promise<number> {
      const student = await fixtures.addStudent();
      const group = await fixtures.addGroup();
      const draftId = await fixtures.addDraft(student.id);
      await fixtures.fillDraft(draftId, DETAILS, group);
      const pathname = await fixtures.addValidDocument(draftId);
      const submitted = await submitDraft({
        userId: student.id,
        solicitudId: draftId,
        now: new Date(),
        ...DETAILS,
        grupoIds: [group],
        consentimientoVersion: CONSENT_VERSION,
      });
      expect(submitted.ok).toBe(true);

      const [document] = await db
        .select({ id: documentoRespaldo.id })
        .from(documentoRespaldo)
        .where(eq(documentoRespaldo.pathname, pathname));
      await expect(registerPendingExtractions(draftId)).resolves.toEqual([
        document.id,
      ]);
      return document.id;
    }

    it("lets exactly one of several simultaneous claims win, and counts one attempt", async () => {
      const documentoId = await registeredDocument();

      const claims = await Promise.all(
        Array.from({ length: CONCURRENCY }, () => claimExtraction(documentoId)),
      );

      const winners = claims.filter((claim) => claim !== null);
      expect(winners).toHaveLength(1);
      expect(winners[0]).toMatchObject({ documentoId, intentos: 1 });

      const [row] = await db
        .select({
          estado: extraccionDocumento.estado,
          intentos: extraccionDocumento.intentos,
          reclamoId: extraccionDocumento.reclamoId,
        })
        .from(extraccionDocumento)
        .where(eq(extraccionDocumento.documentoId, documentoId));
      expect(row).toEqual({
        estado: "procesando",
        intentos: 1,
        reclamoId: winners[0]?.reclamoId,
      });
    });

    it("deletes the extraction row with its document", async () => {
      const documentoId = await registeredDocument();
      const rowsOf = async () =>
        (
          await db
            .select({ n: count() })
            .from(extraccionDocumento)
            .where(eq(extraccionDocumento.documentoId, documentoId))
        )[0].n;
      expect(await rowsOf()).toBe(1);

      await db
        .delete(documentoRespaldo)
        .where(eq(documentoRespaldo.id, documentoId));

      expect(await rowsOf()).toBe(0);
    });
  },
);
