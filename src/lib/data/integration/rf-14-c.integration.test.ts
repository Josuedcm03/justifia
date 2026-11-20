import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { db } from "@/db";
import { documentoRespaldo, extraccionDocumento } from "@/db/schema";
import { decideRequest } from "@/lib/data/solicitud-decision";
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

// RF-14 (c), acceptance on a real database (manual-document-data, task 8.9).
// Thesis criterion: «Con la extracción apagada, resolver la solicitud. Se
// resuelve con los datos registrados.» It also runs the A5 scenario SC-12
// (extracción fallida y captura manual): a forced `fallida` extraction leaves
// RN-10 not evaluable, and the manual capture of the rest dates makes it
// evaluable and present. Hoja step: «Con la extracción apagada, resolver la
// solicitud» (RF-14, inciso c).
//
// HOW TO RUN (never part of `npm test`; owner-run, task 9.2): see
// `rf-14-support.ts`. Spec: MD-10, MD-17, MD-21.

const gate = integrationGate();

/** Seeds the extraction row of a document (the insert lives in the suite). */
async function seedExtraction(documentoId: number, spec: ExtractionSpec) {
  await db
    .insert(extraccionDocumento)
    .values(extractionValues(documentoId, spec));
}

/** SC-12: absent on Monday 9 and Tuesday 10 of November. */
const ABSENCE = { from: "2026-11-09", to: "2026-11-10" } as const;
/** The rest the secretary captures from the handwritten certificate: day 9. */
const CAPTURED = { restFrom: "2026-11-09", restTo: "2026-11-09" } as const;

describe.skipIf(gate !== "run")(
  "RF-14 (c) resolve without extraction (real Postgres)",
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
    afterEach(() => vi.restoreAllMocks());

    /** A medical request of SC-12 whose only document has the given extraction. */
    async function sc12(extraction: ExtractionSpec | null) {
      const request = await world.request({
        causa: "medica",
        ...ABSENCE,
        presentedAt: PRESENTED_AFTER_NOVEMBER,
      });
      const documentoId = await seedDocument(request.id);
      if (extraction) await seedExtraction(documentoId, extraction);
      return { requestId: request.id, documentoId };
    }

    it("SC-12: a forced fallida extraction leaves RN-10 not evaluable, and the capture of the rest dates makes it present", async () => {
      const { requestId, documentoId } = await sc12({
        state: "fallida",
        error: "unreadable_document",
      });
      expect(resultOf(await world.signals(requestId), "rn10")).toMatchObject({
        outcome: "not_evaluable",
        reason: "extraction_failed",
      });

      await world.saveOk(requestId, documentoId, CAPTURED);

      const report = await world.signals(requestId);
      expect(resultOf(report, "rn10")).toMatchObject({
        outcome: "present",
        evidence: {
          kind: "uncovered",
          absenceFrom: "2026-11-09",
          absenceTo: "2026-11-10",
          covered: [{ from: "2026-11-09", to: "2026-11-09" }],
        },
      });
      expect(report.verdict).toBe("review_carefully");
      // The row stays failed; only the effective view reads as completed.
      const item = await world.staffItem(requestId, documentoId);
      expect(item.ocr?.state).toBe("fallida");
      expect(item.row).toMatchObject({
        state: "completada",
        restFrom: "2026-11-09",
        restTo: "2026-11-09",
        restDays: 1,
      });
    });

    it("SC-12 variant: a completada row with nothing recognized reads field_missing, then present after the capture", async () => {
      const { requestId, documentoId } = await sc12({ state: "completada" });
      expect(resultOf(await world.signals(requestId), "rn10")).toMatchObject({
        outcome: "not_evaluable",
        reason: "field_missing",
      });

      await world.saveOk(requestId, documentoId, CAPTURED);

      expect(outcomeOf(await world.signals(requestId), "rn10")).toBe("present");
    });

    it("a pending row reads extraction_pending, then present after the capture (A4)", async () => {
      const { requestId, documentoId } = await sc12({ state: "pendiente" });
      expect(resultOf(await world.signals(requestId), "rn10")).toMatchObject({
        outcome: "not_evaluable",
        reason: "extraction_pending",
      });

      await world.saveOk(requestId, documentoId, CAPTURED);

      expect(outcomeOf(await world.signals(requestId), "rn10")).toBe("present");
    });

    it("a document with no extraction row (extraction off) reads extraction_pending, then present after the capture", async () => {
      const { requestId, documentoId } = await sc12(null);
      expect(await world.storedExtraction(documentoId)).toBeNull();
      expect(resultOf(await world.signals(requestId), "rn10")).toMatchObject({
        outcome: "not_evaluable",
        reason: "extraction_pending",
      });

      await world.saveOk(requestId, documentoId, CAPTURED);

      expect(outcomeOf(await world.signals(requestId), "rn10")).toBe("present");
      // Registering never starts an extraction: still no row.
      expect(await world.storedExtraction(documentoId)).toBeNull();
    });

    it("covers the whole absence once the captured rest covers both days: RN-10 absent", async () => {
      const { requestId, documentoId } = await sc12({
        state: "fallida",
        error: "unreadable_document",
      });

      await world.saveOk(requestId, documentoId, {
        restFrom: "2026-11-09",
        restTo: "2026-11-10",
      });

      expect(outcomeOf(await world.signals(requestId), "rn10")).toBe("absent");
    });

    it("resolves the request with the registered data through the decision of the review action, with no outbound extraction call (RF-14 c)", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const { requestId, documentoId } = await sc12(null);
      await world.saveOk(requestId, documentoId, {
        studentName: "IT Ana Lopez",
        issuer: "IT Clinica Santa Fe",
        issueDate: "2026-11-09",
        ...CAPTURED,
        type: "constancia_medica",
        hasSignature: true,
        hasSeal: true,
      });

      const outcome = await decideRequest({
        actorId: world.staffId,
        scope: world.scope,
        solicitudId: requestId,
        decision: {
          tipo: "aprobada",
          plantilla: "aprobacion.general",
          texto: null,
        },
        now: new Date(),
      });

      expect(outcome.ok).toBe(true);
      expect(await world.requestState(requestId)).toBe("aprobada");
      const item = await world.staffItem(requestId, documentoId);
      expect(item.manual).toMatchObject({ issuer: "IT Clinica Santa Fe" });
      expect(item.row?.state).toBe("completada");
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(await world.storedExtraction(documentoId)).toBeNull();
    });

    it("freezes the registered data once the request is decided (D6)", async () => {
      const { requestId, documentoId } = await sc12(null);
      await world.saveOk(requestId, documentoId, CAPTURED);
      const decided = await decideRequest({
        actorId: world.staffId,
        scope: world.scope,
        solicitudId: requestId,
        decision: {
          tipo: "rechazada",
          plantilla: "rechazo.documento_no_acredita",
          texto: "El documento no acredita las fechas.",
        },
        now: new Date(),
      });
      expect(decided.ok).toBe(true);

      const late = await world.save(requestId, documentoId, {
        restFrom: "2026-11-09",
        restTo: "2026-11-10",
      });

      expect(late).toEqual({ ok: false, reason: "not_editable" });
      const item = await world.staffItem(requestId, documentoId);
      expect(item.manual).toMatchObject(CAPTURED);
    });
  },
);
