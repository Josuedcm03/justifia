import { randomUUID } from "node:crypto";

import { and, asc, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { eventoAuditoria } from "@/db/audit-schema";
import {
  documentoRespaldo,
  inscripcion,
  solicitud,
  solicitudAsignatura,
} from "@/db/schema";
import { finalizeDocument, removeDocument } from "@/lib/data/documentos";
import { createFixtures, PDF_BYTES } from "@/lib/data/integration/fixtures";
import { resolveRequestScope } from "@/lib/data/request-scope";
import { resubmitCorrection } from "@/lib/data/solicitud-correction";
import { decideRequest } from "@/lib/data/solicitud-decision";
import { getRequestDetail } from "@/lib/data/solicitud-detail";
import {
  saveDraftDetails,
  saveDraftSubjects,
  submitDraft,
  type EditTarget,
} from "@/lib/data/solicitudes";
import { getOwnRequestDetail } from "@/lib/data/student-requests";
import { permissiveSchedule } from "@/lib/intake/adapters/permissive-schedule";
import { CONSENT_VERSION } from "@/lib/intake/consent";
import { createFakeDocumentStore } from "@/lib/intake/fakes";
import { buildPathname } from "@/lib/intake/pathnames";

// Real-Postgres check of RF-08: the correction of a returned request is recorded
// in the same request. (a) it creates no new request; (b) the detail keeps the
// earlier states, data and documents; (c) the corrected request goes back to
// `pendiente`. The unit suite of `resubmitCorrection` proves the same rules on a
// simulated database; nothing proved them on Postgres (task 12.2).
//
// Every step goes through the function the application calls: `submitDraft`,
// `decideRequest`, the correction writes, `resubmitCorrection` and the two
// detail readers. Only the stored files are a double.
//
// HOW TO RUN: see intake-concurrency.integration.test.ts (disposable Neon
// branch, INTEGRATION_DATABASE_URL and INTEGRATION_ALLOW_WRITES=1). The audit
// log is append-only, so the audited accounts and their catalog rows stay.

const gate = { mode: process.env.INTEGRATION_GATE_MODE ?? "skip" };
if (gate.mode === "refuse") {
  throw new Error(
    `Refusing to run the integration suite: ${process.env.INTEGRATION_GATE_REASON}`,
  );
}

const CONCURRENCY = 6;
const ORIGINAL = {
  causa: "medica",
  fechaInicio: "2026-10-01",
  fechaFin: "2026-10-03",
} as const;
const CORRECTED = {
  causa: "fuerza_mayor",
  fechaInicio: "2026-10-05",
  fechaFin: "2026-10-06",
} as const;
const RETURN_TEXT = "Adjunte una copia legible (dato de prueba).";

describe.skipIf(gate.mode !== "run")(
  "request correction (real Postgres, RF-08)",
  () => {
    const fixtures = createFixtures();
    const store = createFakeDocumentStore();
    const students: number[] = [];

    beforeAll(async () => {
      // Fail fast and readable when the branch is unreachable or unmigrated.
      await db.select({ id: solicitud.id }).from(solicitud).limit(1);
    });

    afterAll(async () => {
      // Inscripcion references the student and the group, so it goes before
      // the fixtures delete them.
      if (students.length > 0) {
        await db
          .delete(inscripcion)
          .where(inArray(inscripcion.estudianteId, students));
      }
      await fixtures.cleanup();
    });

    async function attach(
      userId: number,
      solicitudId: number,
      nombreOriginal: string,
      target?: EditTarget,
    ) {
      const pathname = buildPathname(solicitudId, randomUUID(), "pdf");
      store.seed(pathname, PDF_BYTES);
      const result = await finalizeDocument(
        { userId, pathname, nombreOriginal, target, maxBytes: 10_485_760 },
        store,
      );
      if (!result.ok) throw new Error(`Not attached: ${result.reason}`);
      return { id: result.documentId, pathname };
    }

    async function giveBack(requestId: number) {
      const secretaria = await fixtures.addSecretaria();
      const scope = await resolveRequestScope(secretaria.id, "secretaria");
      const outcome = await decideRequest({
        actorId: secretaria.id,
        scope,
        solicitudId: requestId,
        decision: {
          tipo: "devuelta",
          plantilla: "devolucion.documento_ilegible",
          motivo: "documento_ilegible",
          texto: RETURN_TEXT,
        },
        now: new Date(),
      });
      expect(outcome.ok).toBe(true);
      return { secretaria, scope };
    }

    /** A request presented with two documents and then returned. */
    async function returnedRequest() {
      const student = await fixtures.addStudent();
      students.push(student.id);
      const first = await fixtures.addGroup();
      const second = await fixtures.addGroup();
      await db.insert(inscripcion).values(
        [first, second].map((grupoId) => ({
          estudianteId: student.id,
          grupoId,
          activo: true,
        })),
      );

      const id = await fixtures.addDraft(student.id);
      await fixtures.fillDraft(id, ORIGINAL, first);
      const illegible = await attach(student.id, id, "ilegible.pdf");
      const kept = await attach(student.id, id, "vigente.pdf");
      const submitted = await submitDraft({
        userId: student.id,
        solicitudId: id,
        now: new Date(),
        ...ORIGINAL,
        grupoIds: [first],
        consentimientoVersion: CONSENT_VERSION,
      });
      expect(submitted).toEqual({ ok: true });
      const { scope } = await giveBack(id);

      const target: EditTarget = { kind: "correction", solicitudId: id };
      return { student, id, first, second, illegible, kept, scope, target };
    }

    const readRequest = async (id: number) => {
      const [row] = await db
        .select()
        .from(solicitud)
        .where(eq(solicitud.id, id));
      return row;
    };

    const requestsOf = (studentId: number) =>
      db
        .select({ id: solicitud.id, estado: solicitud.estado })
        .from(solicitud)
        .where(eq(solicitud.estudianteId, studentId));

    const auditsOf = (id: number, accion: string) =>
      db
        .select({
          actorId: eventoAuditoria.actorId,
          datos: eventoAuditoria.datos,
        })
        .from(eventoAuditoria)
        .where(
          and(
            eq(eventoAuditoria.entidadTipo, "Solicitud"),
            eq(eventoAuditoria.entidadId, id),
            eq(eventoAuditoria.accion, accion),
          ),
        );

    const resubmit = (userId: number, solicitudId: number, now = new Date()) =>
      resubmitCorrection({
        userId,
        solicitudId,
        now,
        schedule: permissiveSchedule,
      });

    it("records the correction in the same request, keeps the earlier version and goes back to pendiente (a, b, c)", async () => {
      const r = await returnedRequest();
      const before = await readRequest(r.id);
      expect(before.estado).toBe("devuelta");

      expect(
        await saveDraftDetails(r.student.id, new Date(), CORRECTED, r.target),
      ).toBe(true);
      expect(
        await saveDraftSubjects(r.student.id, new Date(), [r.second], r.target),
      ).toBe(true);
      expect(
        await removeDocument(
          {
            userId: r.student.id,
            documentId: r.illegible.id,
            target: r.target,
          },
          store,
        ),
      ).toEqual({ ok: true });
      const added = await attach(r.student.id, r.id, "legible.pdf", r.target);

      const now = new Date();
      expect(await resubmit(r.student.id, r.id, now)).toEqual({ ok: true });

      // (a) The only request of the student is the one returned.
      expect(await requestsOf(r.student.id)).toEqual([
        { id: r.id, estado: "pendiente" },
      ]);

      // (c) Back to `pendiente`, with the new data and the first presentation.
      const after = await readRequest(r.id);
      expect(after).toMatchObject({ estado: "pendiente", ...CORRECTED });
      expect(after.reenviadaEn).toEqual(now);
      expect(after.presentadaEn).toEqual(before.presentadaEn);
      expect(after.plazoInicioEn).toBeNull();
      expect(after.estudianteNombre).toBe(before.estudianteNombre);
      expect(after.estudianteCif).toBe(before.estudianteCif);
      expect(after.consentimientoEn).toEqual(before.consentimientoEn);
      expect(after.consentimientoVersion).toBe(before.consentimientoVersion);

      expect(
        await db
          .select({ grupoId: solicitudAsignatura.grupoId })
          .from(solicitudAsignatura)
          .where(eq(solicitudAsignatura.solicitudId, r.id)),
      ).toEqual([{ grupoId: r.second }]);

      // (b) Both details keep the earlier state, data and documents.
      const own = await getOwnRequestDetail(r.student.id, r.id);
      const staff = await getRequestDetail(r.scope, r.id);
      for (const detail of [own, staff]) {
        expect(detail?.documentos.map((d) => d.nombreOriginal)).toEqual([
          "vigente.pdf",
          "legible.pdf",
        ]);
        expect(detail?.clases).toHaveLength(1);
        expect(detail?.revisiones).toHaveLength(1);
        expect(detail?.revisiones[0]).toMatchObject({ numero: 1, ...ORIGINAL });
        expect(detail?.revisiones[0].clases).toHaveLength(1);
        expect(detail?.revisiones[0].clases[0].asignaturaId).not.toBe(
          detail?.clases[0].asignaturaId,
        );
        expect(
          [...(detail?.revisiones[0].documentoIds ?? [])].sort((a, b) => a - b),
        ).toEqual([r.illegible.id, r.kept.id]);
      }
      expect(own?.decision).toBeNull();
      expect(own?.historial).toMatchObject([
        {
          tipo: "devuelta",
          motivoCodigo: "documento_ilegible",
          texto: RETURN_TEXT,
        },
      ]);
      expect(staff?.decisiones).toMatchObject([
        { tipo: "devuelta", revisionId: staff?.revisiones[0].id },
      ]);
      expect(staff?.documentosRetirados.map((d) => d.id)).toEqual([
        r.illegible.id,
      ]);

      // The replaced document is retired, not deleted: row and file stay.
      const documents = await db
        .select({
          id: documentoRespaldo.id,
          retiradoEn: documentoRespaldo.retiradoEn,
        })
        .from(documentoRespaldo)
        .where(eq(documentoRespaldo.solicitudId, r.id))
        .orderBy(asc(documentoRespaldo.id));
      expect(documents.map((d) => d.id)).toEqual([
        r.illegible.id,
        r.kept.id,
        added.id,
      ]);
      expect(documents.map((d) => d.retiradoEn !== null)).toEqual([
        true,
        false,
        false,
      ]);
      expect(store.has(r.illegible.pathname)).toBe(true);

      expect(await auditsOf(r.id, "solicitud.presentada")).toHaveLength(1);
      expect(await auditsOf(r.id, "solicitud.devuelta")).toHaveLength(1);
      expect(await auditsOf(r.id, "solicitud.corregida")).toEqual([
        {
          actorId: r.student.id,
          datos: {
            revision: 1,
            asignaturas: 1,
            documentos: 2,
            documentosRetirados: 1,
          },
        },
      ]);
    });

    it("keeps one version per return when the request is returned and corrected twice", async () => {
      const r = await returnedRequest();
      expect(
        await saveDraftDetails(r.student.id, new Date(), CORRECTED, r.target),
      ).toBe(true);
      expect(await resubmit(r.student.id, r.id)).toEqual({ ok: true });
      await giveBack(r.id);
      expect(await resubmit(r.student.id, r.id)).toEqual({ ok: true });

      expect(await requestsOf(r.student.id)).toEqual([
        { id: r.id, estado: "pendiente" },
      ]);
      const own = await getOwnRequestDetail(r.student.id, r.id);
      expect(own?.revisiones).toMatchObject([
        { numero: 1, ...ORIGINAL },
        { numero: 2, ...CORRECTED },
      ]);
      expect(own?.historial.map((d) => d.tipo)).toEqual([
        "devuelta",
        "devuelta",
      ]);
      expect(await auditsOf(r.id, "solicitud.corregida")).toHaveLength(2);
    });

    it("lets exactly one of several simultaneous resubmissions through, with one audit row", async () => {
      const r = await returnedRequest();

      const outcomes = await Promise.all(
        Array.from({ length: CONCURRENCY }, () => resubmit(r.student.id, r.id)),
      );

      expect(outcomes.filter((o) => o.ok)).toHaveLength(1);
      for (const loser of outcomes.filter((o) => !o.ok)) {
        expect(loser).toMatchObject({
          reason: expect.stringMatching(/^(conflict|not_found)$/),
        });
      }
      expect((await readRequest(r.id)).estado).toBe("pendiente");
      expect(await auditsOf(r.id, "solicitud.corregida")).toHaveLength(1);
    });

    it("refuses a correction left with no document and one by another student, changing nothing", async () => {
      const r = await returnedRequest();
      const other = await fixtures.addStudent();
      students.push(other.id);

      expect(await resubmit(other.id, r.id)).toEqual({
        ok: false,
        reason: "not_found",
      });
      for (const { id } of [r.illegible, r.kept]) {
        expect(
          await removeDocument(
            { userId: r.student.id, documentId: id, target: r.target },
            store,
          ),
        ).toEqual({ ok: true });
      }
      expect(await resubmit(r.student.id, r.id)).toMatchObject({
        ok: false,
        reason: "invalid",
      });

      const row = await readRequest(r.id);
      expect(row).toMatchObject({ estado: "devuelta", ...ORIGINAL });
      expect(row.reenviadaEn).toBeNull();
      expect(await requestsOf(other.id)).toEqual([]);
      expect(await auditsOf(r.id, "solicitud.corregida")).toEqual([]);
    });
  },
);
