import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { documentoRespaldo } from "@/db/schema";
import {
  createWorld,
  documentValues,
  integrationGate,
  manualSignals,
  outcomeOf,
  PRESENTED_AFTER_NOVEMBER,
  resultOf,
} from "@/lib/data/integration/rf-14-support";

// RF-14 (b), acceptance on a real database (manual-document-data, task 8.8).
// Thesis criterion: «Marcar firma y sello. Las marcas quedan guardadas.» The
// suite registers firma and sello through `saveDocumentData` with true, false
// and null, and reads the signals RN-11 and RN-12 of the A5 scenarios SC-08
// (constancia sin sello del emisor) and SC-14 (constancia sin firma del
// responsable). Hoja step: «Marcar firma y sello» (RF-14, inciso b).
//
// HOW TO RUN (never part of `npm test`; owner-run, task 9.2): see
// `rf-14-support.ts`. Spec: MD-5, MD-12, MD-13.

const gate = integrationGate();

const ABSENCE = { from: "2026-11-09", to: "2026-11-10" } as const;

describe.skipIf(gate !== "run")(
  "RF-14 (b) firma and sello (real Postgres)",
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

    /** A medical request with one document, nothing registered yet. */
    async function medicalRequest() {
      const request = await world.request({
        causa: "medica",
        ...ABSENCE,
        presentedAt: PRESENTED_AFTER_NOVEMBER,
      });
      return {
        requestId: request.id,
        documentoId: await seedDocument(request.id),
      };
    }

    it("SC-08: a certificate without the issuer's sello raises RN-12 and the verdict is review carefully", async () => {
      const { requestId, documentoId } = await medicalRequest();

      await world.saveOk(requestId, documentoId, {
        type: "constancia_medica",
        hasSignature: true,
        hasSeal: false,
      });

      const report = await world.signals(requestId);
      expect(manualSignals(report)).toEqual({
        rn11: "absent",
        rn12: "present",
        rn13: "absent",
      });
      expect(resultOf(report, "rn12")).toMatchObject({
        evidence: { kind: "documents", documentIds: [documentoId] },
      });
      expect(report.verdict).toBe("review_carefully");
    });

    it("SC-14: a certificate without the signature of the responsible raises RN-11 and the verdict is review carefully", async () => {
      const { requestId, documentoId } = await medicalRequest();

      await world.saveOk(requestId, documentoId, {
        type: "constancia_medica",
        hasSignature: false,
        hasSeal: true,
      });

      const report = await world.signals(requestId);
      expect(manualSignals(report)).toEqual({
        rn11: "present",
        rn12: "absent",
        rn13: "absent",
      });
      expect(resultOf(report, "rn11")).toMatchObject({
        evidence: { kind: "documents", documentIds: [documentoId] },
      });
      expect(report.verdict).toBe("review_carefully");
    });

    it("keeps the three mark states apart after a read: not registered, No and Sí (MD-5)", async () => {
      const { requestId, documentoId } = await medicalRequest();
      const read = async () => {
        const staff = await world.staffItem(requestId, documentoId);
        const coordination = await world.coordinationItem(
          requestId,
          documentoId,
        );
        // The staff read and the coordination read agree on every state.
        expect({
          hasSignature: coordination.hasSignature,
          hasSeal: coordination.hasSeal,
        }).toEqual({
          hasSignature: staff.marks.hasSignature,
          hasSeal: staff.marks.hasSeal,
        });
        return staff.marks;
      };

      expect(await read()).toEqual({
        type: null,
        hasSignature: null,
        hasSeal: null,
      });

      await world.saveOk(requestId, documentoId, {
        hasSignature: false,
        hasSeal: null,
      });
      expect(await read()).toEqual({
        type: null,
        hasSignature: false,
        hasSeal: null,
      });

      await world.saveOk(requestId, documentoId, {
        hasSignature: null,
        hasSeal: true,
      });
      expect(await read()).toEqual({
        type: null,
        hasSignature: null,
        hasSeal: true,
      });

      await world.saveOk(requestId, documentoId, {
        hasSignature: true,
        hasSeal: false,
      });
      expect(await read()).toEqual({
        type: null,
        hasSignature: true,
        hasSeal: false,
      });

      // Clearing a mark returns it to "not registered", never to "No".
      await world.saveOk(requestId, documentoId, {});
      expect(await read()).toEqual({
        type: null,
        hasSignature: null,
        hasSeal: null,
      });
    });

    it("tells the three states apart in RN-11 and RN-12, each independent of the other (D1)", async () => {
      const { requestId, documentoId } = await medicalRequest();
      const signature = async (hasSignature: boolean | null) => {
        await world.saveOk(requestId, documentoId, {
          type: "constancia_medica",
          hasSignature,
          hasSeal: true,
        });
        return resultOf(await world.signals(requestId), "rn11");
      };

      expect(await signature(true)).toMatchObject({ outcome: "absent" });
      expect(await signature(false)).toMatchObject({ outcome: "present" });
      expect(await signature(null)).toMatchObject({
        outcome: "not_evaluable",
        reason: "not_registered",
      });
      // The sello is registered the whole time: firma never moves RN-12.
      expect(outcomeOf(await world.signals(requestId), "rn12")).toBe("absent");
    });

    it("writes the marks without touching the extraction: they never promote a row (A4)", async () => {
      const { requestId, documentoId } = await medicalRequest();

      await world.saveOk(requestId, documentoId, {
        hasSignature: false,
        hasSeal: true,
      });

      const item = await world.staffItem(requestId, documentoId);
      expect(item.row).toBeNull();
      expect(item.manual).toBeNull();
      expect(await world.storedExtraction(documentoId)).toBeNull();
      const rows = await world.auditRows(documentoId);
      expect(rows).toHaveLength(1);
      expect(rows[0].datos).toEqual({
        solicitudId: requestId,
        campos: ["tieneFirma", "tieneSello"],
      });
    });
  },
);
