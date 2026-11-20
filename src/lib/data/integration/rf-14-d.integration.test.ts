import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { documentoRespaldo, extraccionDocumento } from "@/db/schema";
import {
  createWorld,
  documentValues,
  extractionValues,
  integrationGate,
  manualSignals,
  outcomeOf,
  PRESENTED_AFTER_AUGUST,
  PRESENTED_AFTER_NOVEMBER,
  resultOf,
  type ExtractionSpec,
} from "@/lib/data/integration/rf-14-support";
import type { Causa } from "@/lib/intake/causes";

// RF-14 (d) and RF-05 (e), acceptance on a real database (manual-document-data,
// task 8.10). Thesis criterion: «Registrar el tipo de documento. Queda
// guardado y se contrasta con la causa (RN-13).» The suite registers the type
// through `saveDocumentData` and reads RN-13 for the A5 scenarios SC-05 (tipo
// discordante), SC-01 (aprobación estándar, sin señales) and SC-11 b (formato
// especial de la FIA, firmado y sellado). It also proves the precedence rules
// end to end: the strict rule of A5 for several documents and the precedence of
// a manual value over the extracted one (RN-24) all the way to the verdict.
// Hoja step: «Registrar el tipo de documento» (RF-14, inciso d).
//
// HOW TO RUN (never part of `npm test`; owner-run, task 9.2): see
// `rf-14-support.ts`. Spec: MD-4, MD-14, MD-19, MD-21.

const gate = integrationGate();

/** Seeds the extraction row of a document (the insert lives in the suite). */
async function seedExtraction(documentoId: number, spec: ExtractionSpec) {
  await db
    .insert(extraccionDocumento)
    .values(extractionValues(documentoId, spec));
}

describe.skipIf(gate !== "run")(
  "RF-14 (d) document type (real Postgres)",
  () => {
    const world = createWorld();

    /** A current student document with a fingerprint of its own. */
    async function seedDocument(requestId: number, name?: string) {
      const [row] = await db
        .insert(documentoRespaldo)
        .values({
          ...documentValues(requestId, name),
          huellaSha256: world.fingerprint(),
        })
        .returning({ id: documentoRespaldo.id });
      return row.id;
    }

    beforeAll(() => world.setup());
    afterAll(() => world.teardown());

    /** A request for November with one document and nothing registered. */
    async function november(causa: Causa) {
      const request = await world.request({
        causa,
        from: "2026-11-09",
        to: "2026-11-10",
        presentedAt: PRESENTED_AFTER_NOVEMBER,
      });
      return {
        requestId: request.id,
        documentoId: await seedDocument(request.id),
      };
    }

    /**
     * SC-01: a medical request for 24 to 26 August, presented on time, whose
     * certificate the extraction read in full and whose rest covers the
     * absence. Nothing is registered yet.
     */
    async function sc01() {
      const request = await world.request({
        causa: "medica",
        from: "2026-08-24",
        to: "2026-08-26",
        presentedAt: PRESENTED_AFTER_AUGUST,
      });
      const documentoId = await seedDocument(request.id);
      await seedExtraction(documentoId, {
        state: "completada",
        studentName: "OCR Ana Perez",
        issuer: "OCR Clinica Central",
        issueDate: "2026-08-24",
        restFrom: "2026-08-24",
        restTo: "2026-08-26",
      });
      return { requestId: request.id, documentoId };
    }

    const SIGNED_AND_SEALED = {
      type: "constancia_medica",
      hasSignature: true,
      hasSeal: true,
    } as const;

    it("SC-05: a medical certificate for a sports cause raises RN-13 and the verdict is review carefully", async () => {
      const { requestId, documentoId } = await november(
        "actividad_representativa",
      );

      await world.saveOk(requestId, documentoId, SIGNED_AND_SEALED);

      const report = await world.signals(requestId);
      expect(resultOf(report, "rn13")).toMatchObject({
        outcome: "present",
        evidence: { kind: "documents", documentIds: [documentoId] },
      });
      expect(manualSignals(report)).toEqual({
        rn11: "absent",
        rn12: "absent",
        rn13: "present",
      });
      expect(report.verdict).toBe("review_carefully");
    });

    it("SC-01: a medical certificate for a medical cause, signed and sealed, leaves no alert", async () => {
      const { requestId, documentoId } = await sc01();

      await world.saveOk(requestId, documentoId, SIGNED_AND_SEALED);

      const report = await world.signals(requestId);
      expect(report.results.map((r) => [r.signal, r.outcome])).toEqual([
        ["rn07", "absent"],
        ["rn09", "absent"],
        ["rn10", "absent"],
        ["rn11", "absent"],
        ["rn12", "absent"],
        ["rn13", "absent"],
        ["rn14", "absent"],
        ["rn26", "absent"],
      ]);
      expect(report.verdict).toBe("no_alerts");
      expect(report.notEvaluable).toEqual([]);
    });

    it("SC-01 stays inconclusive until the type and the marks are registered (D1)", async () => {
      const { requestId } = await sc01();

      const report = await world.signals(requestId);

      expect(report.verdict).toBe("inconclusive");
      expect(report.notEvaluable).toEqual([
        { signal: "rn11", reason: "not_registered" },
        { signal: "rn12", reason: "not_registered" },
        { signal: "rn13", reason: "not_registered" },
      ]);
    });

    it("SC-11 b: the special format of the FIA, signed and sealed and registered as institutional, raises none of RN-11, RN-12 and RN-13", async () => {
      const { requestId, documentoId } = await november("fuerza_mayor");

      await world.saveOk(requestId, documentoId, {
        type: "constancia_institucional",
        hasSignature: true,
        hasSeal: true,
      });

      const report = await world.signals(requestId);
      expect(manualSignals(report)).toEqual({
        rn11: "absent",
        rn12: "absent",
        rn13: "absent",
      });
      // A force majeure request has no rest period to check.
      expect(outcomeOf(report, "rn09")).toBe("not_applicable");
      expect(outcomeOf(report, "rn10")).toBe("not_applicable");
    });

    it.each([
      ["medica", "constancia_medica", "absent"],
      ["medica", "constancia_institucional", "present"],
      ["actividad_representativa", "constancia_institucional", "absent"],
      ["fuerza_mayor", "constancia_medica", "present"],
      ["intercambio_academico", "otro", "present"],
    ] as const)(
      "stores the type and contrasts it with the cause %s: %s gives RN-13 %s",
      async (causa, type, expected) => {
        const { requestId, documentoId } = await november(causa);

        await world.saveOk(requestId, documentoId, {
          type,
          hasSignature: true,
          hasSeal: true,
        });

        const item = await world.staffItem(requestId, documentoId);
        expect(item.marks.type).toBe(type);
        expect(
          (await world.coordinationItem(requestId, documentoId)).type,
        ).toBe(type);
        expect(outcomeOf(await world.signals(requestId), "rn13")).toBe(
          expected,
        );
      },
    );

    it("applies the strict rule of A5 across documents: a mismatch anywhere is present, and an unregistered one keeps the rest not registered", async () => {
      const { requestId, documentoId: first } = await november("medica");
      const second = await seedDocument(requestId, "segunda.pdf");

      // One document registered as `otro`, the other not registered: present
      // beats not registered.
      await world.saveOk(requestId, first, { type: "otro" });
      expect(outcomeOf(await world.signals(requestId), "rn13")).toBe("present");

      // One document that corresponds and one not registered: not evaluable.
      await world.saveOk(requestId, first, { type: "constancia_medica" });
      const pending = await world.signals(requestId);
      expect(resultOf(pending, "rn13")).toMatchObject({
        outcome: "not_evaluable",
        reason: "not_registered",
      });
      expect(pending.verdict).toBe("inconclusive");

      // Both registered and corresponding: absent.
      await world.saveOk(requestId, second, { type: "constancia_medica" });
      expect(outcomeOf(await world.signals(requestId), "rn13")).toBe("absent");

      // Clearing the type of one returns it to not registered.
      await world.saveOk(requestId, second, {});
      expect(resultOf(await world.signals(requestId), "rn13")).toMatchObject({
        outcome: "not_evaluable",
        reason: "not_registered",
      });
    });

    it("keeps the precedence of RN-24 end to end: a manual rest wins over the extracted one down to the verdict, and clearing it reverts (A5 SC-01)", async () => {
      const { requestId, documentoId } = await sc01();
      await world.saveOk(requestId, documentoId, SIGNED_AND_SEALED);
      expect((await world.signals(requestId)).verdict).toBe("no_alerts");

      // The secretary corrects the rest to one day: it no longer covers the
      // absence, and the manual value, not the extracted one, decides.
      await world.saveOk(requestId, documentoId, {
        ...SIGNED_AND_SEALED,
        restFrom: "2026-08-24",
        restTo: "2026-08-24",
      });
      const corrected = await world.signals(requestId);
      expect(outcomeOf(corrected, "rn10")).toBe("present");
      expect(corrected.verdict).toBe("review_carefully");

      // Clearing the correction reverts to the extracted rest.
      await world.saveOk(requestId, documentoId, SIGNED_AND_SEALED);
      const reverted = await world.signals(requestId);
      expect(outcomeOf(reverted, "rn10")).toBe("absent");
      expect(reverted.verdict).toBe("no_alerts");
    });
  },
);
