import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { documentoRespaldo, extraccionDocumento } from "@/db/schema";
import {
  createWorld,
  documentValues,
  extractionValues,
  integrationGate,
  outcomeOf,
  PRESENTED_AFTER_NOVEMBER,
  resultOf,
  type ExtractionSpec,
} from "@/lib/data/integration/rf-14-support";

// RF-14 (a), acceptance on a real database (manual-document-data, task 8.7).
// Thesis criterion: «Registrar o corregir nombre, emisor, fecha de emisión y
// reposo. Cada dato queda marcado "ingresado manualmente".» The suite calls
// `saveDocumentData` directly, as the review action does, and reads back
// through the staff read and the signals, so each value is proven to be stored,
// to win over the extracted one (RN-24), to revert when cleared, to count
// toward RN-14 and to leave the extraction row and the audit payload as the
// specs say. Hoja step: «Registrar o corregir nombre, emisor, fecha de emisión
// y reposo» (RF-14, inciso a).
//
// HOW TO RUN (never part of `npm test`; owner-run, task 9.2): see
// `rf-14-support.ts`. Spec: MD-1, MD-2, MD-18, MD-21, MD-22, MD-32, MD-33.

const gate = integrationGate();

/** Seeds the extraction row of a document (the insert lives in the suite). */
async function seedExtraction(documentoId: number, spec: ExtractionSpec) {
  await db
    .insert(extraccionDocumento)
    .values(extractionValues(documentoId, spec));
}

const NAME = "IT Ana Lopez";
const ISSUER = "IT Clinica Santa Fe";
const OTHER_ISSUER = "IT Hospital Nuevo";

/** The absence of the SC-12 scenario: Monday 9 and Tuesday 10 of November. */
const ABSENCE = { from: "2026-11-09", to: "2026-11-10" } as const;

describe.skipIf(gate !== "run")(
  "RF-14 (a) four data marked as entered manually (real Postgres)",
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

    /** A pending request with one document the extraction read in full. */
    async function extractedRequest() {
      const request = await world.request({
        causa: "medica",
        ...ABSENCE,
        presentedAt: PRESENTED_AFTER_NOVEMBER,
      });
      const documentoId = await seedDocument(request.id);
      await seedExtraction(documentoId, {
        state: "completada",
        studentName: "OCR Ana Perez",
        issuer: "OCR Clinica Central",
        issueDate: "2026-11-09",
        restFrom: "2026-11-09",
        restTo: "2026-11-09",
      });
      return { requestId: request.id, documentoId };
    }

    it("stores the four data and reads them back as manual, through the staff read and the signals (round trip)", async () => {
      const request = await world.request({
        causa: "medica",
        ...ABSENCE,
        presentedAt: PRESENTED_AFTER_NOVEMBER,
      });
      const documentoId = await seedDocument(request.id);
      const before = await world.signals(request.id);
      expect(resultOf(before, "rn10")).toMatchObject({
        outcome: "not_evaluable",
        reason: "extraction_pending",
      });

      const changed = await world.saveOk(request.id, documentoId, {
        studentName: NAME,
        issuer: ISSUER,
        issueDate: "2026-11-09",
        restFrom: "2026-11-09",
        restTo: "2026-11-10",
      });

      expect(changed).toBe(true);
      const item = await world.staffItem(request.id, documentoId);
      expect(item.manual).toEqual({
        studentName: NAME,
        issuer: ISSUER,
        issueDate: "2026-11-09",
        restFrom: "2026-11-09",
        restTo: "2026-11-10",
      });
      expect(item.ocr).toBeNull();
      // The days are derived from the two dates, never entered or stored.
      expect(item.row).toEqual({
        state: "completada",
        studentName: NAME,
        issuer: ISSUER,
        issueDate: "2026-11-09",
        restFrom: "2026-11-09",
        restTo: "2026-11-10",
        restDays: 2,
      });
      const after = await world.signals(request.id);
      expect(outcomeOf(after, "rn09")).toBe("absent");
      expect(outcomeOf(after, "rn10")).toBe("absent");
      expect(await world.requestState(request.id)).toBe("pendiente");
    });

    it("lets a manual value win over the extracted one, datum by datum (RN-24)", async () => {
      const { requestId, documentoId } = await extractedRequest();
      expect(outcomeOf(await world.signals(requestId), "rn10")).toBe("present");

      await world.saveOk(requestId, documentoId, {
        issuer: OTHER_ISSUER,
        restFrom: "2026-11-09",
        restTo: "2026-11-10",
      });

      const item = await world.staffItem(requestId, documentoId);
      expect(item.row).toEqual({
        state: "completada",
        // Typed by hand: wins.
        issuer: OTHER_ISSUER,
        restFrom: "2026-11-09",
        restTo: "2026-11-10",
        restDays: 2,
        // Not typed: the extracted value stays.
        studentName: "OCR Ana Perez",
        issueDate: "2026-11-09",
      });
      expect(item.ocr).toMatchObject({
        issuer: "OCR Clinica Central",
        restTo: "2026-11-09",
      });
      expect(outcomeOf(await world.signals(requestId), "rn10")).toBe("absent");
    });

    it("reverts to the extracted value when a manual value is cleared (RN-24, D8)", async () => {
      const { requestId, documentoId } = await extractedRequest();
      await world.saveOk(requestId, documentoId, {
        issuer: OTHER_ISSUER,
        restFrom: "2026-11-09",
        restTo: "2026-11-10",
      });
      expect(outcomeOf(await world.signals(requestId), "rn10")).toBe("absent");

      await world.saveOk(requestId, documentoId, {});

      const item = await world.staffItem(requestId, documentoId);
      expect(item.manual).toBeNull();
      expect(item.row).toEqual(item.ocr);
      expect(item.row?.issuer).toBe("OCR Clinica Central");
      expect(outcomeOf(await world.signals(requestId), "rn10")).toBe("present");
    });

    it("counts the manual issuer of an earlier request toward RN-14, and stops counting it once cleared (MD-18)", async () => {
      const student = await world.fixtures.addStudent();
      const at = (hours: number) =>
        new Date(Date.UTC(2026, 8, 1, 15 + hours, 0, 0));
      const presented = async (hours: number) =>
        world.request({
          causa: "medica",
          from: "2026-08-24",
          to: "2026-08-26",
          presentedAt: at(hours),
          studentId: student.id,
        });
      const first = await presented(1);
      await seedExtraction(await seedDocument(first.id), {
        state: "completada",
        issuer: ISSUER,
      });
      // The second request has no extraction row: its issuer exists only by
      // hand.
      const second = await presented(2);
      const secondDocument = await seedDocument(second.id);
      const current = await presented(3);
      await seedExtraction(await seedDocument(current.id), {
        state: "completada",
        issuer: ISSUER,
      });
      expect(outcomeOf(await world.signals(current.id), "rn14")).toBe("absent");

      await world.saveOk(second.id, secondDocument, { issuer: ISSUER });

      expect(resultOf(await world.signals(current.id), "rn14")).toMatchObject({
        outcome: "present",
        evidence: { kind: "recurrence", count: 3, threshold: 3 },
      });

      await world.saveOk(second.id, secondDocument, {});

      expect(outcomeOf(await world.signals(current.id), "rn14")).toBe("absent");
    });

    it("leaves the extraction row byte-equal through every save (MD-22)", async () => {
      const { requestId, documentoId } = await extractedRequest();
      const stored = await world.storedExtraction(documentoId);
      expect(stored?.estado).toBe("completada");

      await world.saveOk(requestId, documentoId, { issuer: OTHER_ISSUER });
      expect(await world.storedExtraction(documentoId)).toStrictEqual(stored);

      await world.saveOk(requestId, documentoId, {
        studentName: NAME,
        issuer: OTHER_ISSUER,
        restFrom: "2026-11-09",
        restTo: "2026-11-10",
      });
      expect(await world.storedExtraction(documentoId)).toStrictEqual(stored);

      await world.saveOk(requestId, documentoId, {});
      expect(await world.storedExtraction(documentoId)).toStrictEqual(stored);
    });

    it("writes one audit row per save that changed something, with field names only (MD-32, MD-33)", async () => {
      const request = await world.request({
        causa: "medica",
        ...ABSENCE,
        presentedAt: PRESENTED_AFTER_NOVEMBER,
      });
      const documentoId = await seedDocument(request.id);
      expect(await world.auditRows(documentoId)).toHaveLength(0);

      const entered = { studentName: NAME, issuer: ISSUER };
      expect(await world.saveOk(request.id, documentoId, entered)).toBe(true);
      expect(await world.auditRows(documentoId)).toHaveLength(1);

      // The same values again change nothing, so they write nothing.
      expect(await world.saveOk(request.id, documentoId, entered)).toBe(false);
      expect(await world.auditRows(documentoId)).toHaveLength(1);

      await world.saveOk(request.id, documentoId, { studentName: NAME });
      const rows = await world.auditRows(documentoId);

      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({
        actorId: world.staffId,
        accion: "documento.datos_registrados",
        entidadTipo: "DocumentoRespaldo",
        entidadId: documentoId,
        datos: {
          solicitudId: request.id,
          campos: ["nombreEstudiante", "emisor"],
        },
      });
      expect(rows[1].datos).toEqual({
        solicitudId: request.id,
        campos: ["emisor"],
      });
      const text = JSON.stringify(rows);
      expect(text).not.toContain(NAME);
      expect(text).not.toContain(ISSUER);
    });
  },
);
