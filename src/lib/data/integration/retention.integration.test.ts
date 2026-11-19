import { and, eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { eventoAuditoria } from "@/db/audit-schema";
import {
  documentoRespaldo,
  escalamiento,
  extraccionDocumento,
  inscripcion,
  remision,
  reporteInasistencia,
  solicitud,
  solicitudDecision,
  usuario,
} from "@/db/schema";
import { createFixtures, PDF_BYTES } from "@/lib/data/integration/fixtures";
import { createFakeDocumentStore } from "@/lib/intake/fakes";
import { SYSTEM_LOGIN } from "@/lib/retention/policy";

// Real-Postgres proof of RNF-04 (data-retention, DR-12): the scheduled route
// cancels the students whose last activity is more than five years old, and
// only them. The unit tests script the data module against a double; this suite
// makes the database accept the writes: every CHECK on the redacted columns,
// the cascade of the extraction row, the sentinel actor and the append-only
// audit table.
//
// It enters through `GET /api/cron/retention` with the scheduler bearer, as the
// scheduled task does. Fixture rows are aged by rewriting their timestamps,
// never by shifting `now`, and only rows of this run are touched. The run
// writes to the account table for real, so it first asks for a dry run and
// aborts unless that run counts exactly the one aged student this suite
// created: leftovers or real aged accounts on the branch stop it before any
// cancellation.
//
// HOW TO RUN (never part of `npm test`; owner-run, task 12.2):
//   INTEGRATION_DATABASE_URL=<disposable branch url> \
//   INTEGRATION_ALLOW_WRITES=1 npm run test:integration -- \
//     src/lib/data/integration/retention.integration.test.ts
// The branch needs migration `0014_data_retention` applied. Without
// INTEGRATION_DATABASE_URL the suite is skipped; the opt-in guard is the one of
// `intake-concurrency.integration.test.ts`. The audit row and the sentinel
// stay on the branch by design (the table is append-only).

// Decided by vitest.integration.setup.ts before it replaced DATABASE_URL.
const gate = { mode: process.env.INTEGRATION_GATE_MODE ?? "skip" };
if (gate.mode === "refuse") {
  throw new Error(
    `Refusing to run the integration suite: ${process.env.INTEGRATION_GATE_REASON}`,
  );
}

// The route builds its blob store from `@/lib/intake/deps`; a fake one stands
// in so no file is stored or deleted anywhere.
const { holder } = vi.hoisted(() => ({
  holder: { store: null as null | { has(pathname: string): boolean } },
}));
vi.mock("@/lib/intake/deps", () => ({
  getIntakeDeps: () => ({ store: holder.store }),
}));

import { GET } from "@/app/api/cron/retention/route";

const PLACEHOLDER = "[cancelado]";

/** `years` before the real clock; `now` itself is never shifted. */
function yearsAgo(years: number): Date {
  const at = new Date();
  at.setUTCFullYear(at.getUTCFullYear() - years);
  return at;
}

function call(query = "") {
  return GET(
    new Request(`http://localhost/api/cron/retention${query}`, {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    }),
  );
}

/** SQLSTATE of a database error, read through `cause`. */
function sqlState(error: unknown): string | undefined {
  let current: unknown = error;
  while (current && typeof current === "object") {
    const { code } = current as { code?: unknown };
    if (typeof code === "string" && /^[0-9]{2}[0-9A-Z]{3}$/.test(code)) {
      return code;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

describe.skipIf(gate.mode !== "run")(
  "data retention through the scheduled route (real Postgres, RNF-04)",
  () => {
    const fixtures = createFixtures();
    const store = createFakeDocumentStore();
    const enrolled: number[] = [];

    let a: { id: number; nombre: string; cif: string; correo: string };
    let b: number;
    let c: number;
    let requestIds: number[];
    let pathname: string;
    let documentId: number;
    let before: Awaited<ReturnType<typeof readStudentRows>>;
    let untouched: Awaited<ReturnType<typeof readStudentRows>>[];
    let dryRun: { status: number; body: Record<string, unknown> };

    const readAccount = (id: number) =>
      db
        .select()
        .from(usuario)
        .where(eq(usuario.id, id))
        .then((rows) => rows[0]);

    /** Every row of the student that retention may touch, by table. */
    async function readStudentRows(id: number) {
      const requests = await db
        .select()
        .from(solicitud)
        .where(eq(solicitud.estudianteId, id))
        .orderBy(solicitud.id);
      const ids = requests.map((r) => r.id);
      const ofRequests = <T extends { solicitudId: unknown }>(table: T) =>
        ids.length ? inArray(table.solicitudId as never, ids) : sql`false`;
      return {
        account: await readAccount(id),
        requests,
        decisions: await db
          .select()
          .from(solicitudDecision)
          .where(ofRequests(solicitudDecision))
          .orderBy(solicitudDecision.id),
        remissions: await db
          .select()
          .from(remision)
          .where(ofRequests(remision))
          .orderBy(remision.id),
        reports: await db
          .select()
          .from(reporteInasistencia)
          .where(ofRequests(reporteInasistencia))
          .orderBy(reporteInasistencia.id),
        escalations: await db
          .select()
          .from(escalamiento)
          .where(ofRequests(escalamiento))
          .orderBy(escalamiento.id),
      };
    }

    /** A presented request, aged by one UPDATE (DR-12): the consent and the
     *  presentation move together, a resubmission and a deadline start do not
     *  exist. */
    async function addRequest(
      studentId: number,
      estado: "rechazada" | "aprobada" | "pendiente",
      presentedAt: Date,
    ): Promise<number> {
      const [row] = await db
        .select({
          nombre: usuario.nombreCompleto,
          cif: usuario.cif,
          correo: usuario.correo,
        })
        .from(usuario)
        .where(eq(usuario.id, studentId));
      const [created] = await db
        .insert(solicitud)
        .values({
          estudianteId: studentId,
          estado,
          causa: "medica",
          fechaInicio: "2020-10-01",
          fechaFin: "2020-10-03",
          presentadaEn: new Date(),
          consentimientoEn: new Date(),
          consentimientoVersion: "v1",
          estudianteNombre: row.nombre,
          estudianteCif: row.cif,
          estudianteCarrera: "IT carrera",
          estudianteCorreo: row.correo,
        })
        .returning({ id: solicitud.id });
      await db
        .update(solicitud)
        .set({
          presentadaEn: presentedAt,
          consentimientoEn: presentedAt,
          reenviadaEn: null,
          plazoInicioEn: null,
        })
        .where(eq(solicitud.id, created.id));
      return created.id;
    }

    beforeAll(async () => {
      // Fail fast and readable when the branch is unreachable or unmigrated.
      await db.select({ at: usuario.canceladoEn }).from(usuario).limit(1);
      holder.store = store;

      const secretariaId = (await fixtures.addSecretaria()).id;
      const teacherId = await fixtures.addTeacher();
      const coordinatorId = (await fixtures.addCoordinator()).id;
      const decide = (
        solicitudId: number,
        tipo: "aprobada" | "rechazada",
        texto: string | null,
      ) =>
        db.insert(solicitudDecision).values({
          solicitudId,
          tipo,
          plantillaCodigo: "it_plantilla",
          texto,
          secretariaId,
        });

      // A: aged. A rejected request with decision text and one document (with
      // its extraction row and a stored file), and an approved request with a
      // remission, an absence report, an escalation note and its answer.
      const studentA = await fixtures.addStudent();
      const [accountA] = await db
        .select()
        .from(usuario)
        .where(eq(usuario.id, studentA.id));
      a = {
        id: studentA.id,
        nombre: accountA.nombreCompleto,
        cif: studentA.cif,
        correo: accountA.correo as string,
      };
      const rejected = await addRequest(a.id, "rechazada", yearsAgo(6));
      const approved = await addRequest(a.id, "aprobada", yearsAgo(6));
      requestIds = [rejected, approved];
      await decide(
        rejected,
        "rechazada",
        "Rejected: the certificate is not valid",
      );
      await decide(approved, "aprobada", null);
      await db.insert(remision).values({
        solicitudId: approved,
        docenteId: teacherId,
        docenteNombre: "IT Docente Remision",
        correo: "docente@integration.invalid",
        clases: [],
      });
      await db.insert(reporteInasistencia).values({
        solicitudId: approved,
        docenteId: teacherId,
        docenteNombre: "IT Docente Reporte",
        comunicadoEl: "2020-10-04",
        nota: "Report note about the student",
        registradoPorId: secretariaId,
      });
      const asked = yearsAgo(6);
      await db.insert(escalamiento).values({
        solicitudId: approved,
        tipo: "caso_especial",
        estadoPrevio: "pendiente",
        nota: "Escalation note about the student",
        secretariaId,
        creadoEn: asked,
        respuesta: "Coordination answer about the student",
        respondidaPorId: coordinatorId,
        respondidaEn: new Date(asked.getTime() + 3_600_000),
      });
      pathname = await fixtures.addValidDocument(rejected);
      store.seed(pathname, PDF_BYTES);
      const [document] = await db
        .select({ id: documentoRespaldo.id })
        .from(documentoRespaldo)
        .where(eq(documentoRespaldo.pathname, pathname));
      documentId = document.id;
      await db.insert(extraccionDocumento).values({ documentoId: documentId });

      // B: aged account, but a request presented two years ago.
      b = (await fixtures.addStudent()).id;
      const recent = await addRequest(b, "pendiente", yearsAgo(2));
      await decide(recent, "rechazada", "Recent decision text");

      // C: aged account and request, but an active enrollment.
      c = (await fixtures.addStudent()).id;
      enrolled.push(c);
      const old = await addRequest(c, "rechazada", yearsAgo(6));
      await decide(old, "rechazada", "Enrolled student decision text");
      await db
        .insert(inscripcion)
        .values({ estudianteId: c, grupoId: await fixtures.addGroup() });

      // Aging the accounts; the phone and the flag give DR-3 something to clear.
      await db
        .update(usuario)
        .set({ creadoEn: yearsAgo(6) })
        .where(inArray(usuario.id, [a.id, b, c]));
      await db
        .update(usuario)
        .set({ telefono: "+505 8888 0000", debeCambiarClave: true })
        .where(eq(usuario.id, a.id));

      before = await readStudentRows(a.id);
      untouched = [await readStudentRows(b), await readStudentRows(c)];

      // The guard: a dry run must count exactly the one aged student.
      const response = await call("?dry=1");
      dryRun = { status: response.status, body: await response.json() };
      if (dryRun.status !== 200 || dryRun.body.due !== 1) {
        throw new Error(
          `Aborting before the real run: the dry run answered ${dryRun.status} with due=${String(dryRun.body.due)}, expected exactly 1. The branch holds other due accounts or leftovers.`,
        );
      }
    });

    afterAll(async () => {
      // Inscripcion references the student and the group, so it goes before
      // the fixtures delete them.
      if (enrolled.length > 0) {
        await db
          .delete(inscripcion)
          .where(inArray(inscripcion.estudianteId, enrolled));
      }
      await fixtures.cleanup();
    });

    it("counts the aged student on a dry run and changes nothing (DR-9)", async () => {
      expect(dryRun.body).toEqual({
        dryRun: true,
        due: 1,
        cancelled: 0,
        documentsDeleted: 0,
        blobsDeleted: 0,
        failures: 0,
      });
      expect((await readAccount(a.id)).canceladoEn).toBeNull();
      expect(store.has(pathname)).toBe(true);
    });

    it("cancels the aged student through the route", async () => {
      const response = await call();

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        dryRun: false,
        due: 1,
        cancelled: 1,
        documentsDeleted: 1,
        blobsDeleted: 1,
        failures: 0,
      });
    });

    it("anonymizes the account in place (DR-3)", async () => {
      expect((await readStudentRows(a.id)).account).toEqual({
        ...before.account,
        nombreCompleto: PLACEHOLDER,
        login: `cancelado-${a.id}`,
        correo: null,
        telefono: null,
        cif: null,
        hashClave: "!cancelado",
        activo: false,
        debeCambiarClave: false,
        canceladoEn: expect.any(Date),
      });
    });

    it("redacts the snapshots and the free text and keeps the residue (DR-4, DR-5)", async () => {
      const after = await readStudentRows(a.id);
      // A value becomes the placeholder and NULL stays NULL (D3); every other
      // column of the row is the one it had.
      const redacted = <T extends Record<string, unknown>>(
        row: T,
        columns: (keyof T)[],
      ) => ({
        ...row,
        ...Object.fromEntries(
          columns.map((column) => [
            column,
            row[column] === null ? null : PLACEHOLDER,
          ]),
        ),
      });

      expect(after.requests).toEqual(
        before.requests.map((request) => ({
          ...redacted(request, [
            "estudianteNombre",
            "estudianteCif",
            "estudianteCarrera",
            "estudianteCorreo",
          ]),
          canceladaEn: expect.any(Date),
        })),
      );
      expect(after.decisions).toEqual(
        before.decisions.map((row) => redacted(row, ["texto"])),
      );
      expect(after.remissions).toEqual(
        before.remissions.map((row) =>
          redacted(row, ["docenteNombre", "correo"]),
        ),
      );
      expect(after.reports).toEqual(
        before.reports.map((row) => redacted(row, ["docenteNombre", "nota"])),
      );
      expect(after.escalations).toEqual(
        before.escalations.map((row) => redacted(row, ["nota", "respuesta"])),
      );
      // The fixtures carry text to redact and one decision without any.
      expect(before.decisions.map((d) => d.texto === null).sort()).toEqual([
        false,
        true,
      ]);
      expect(after.decisions).toEqual(
        before.decisions.map((row) => redacted(row, ["texto"])),
      );
    });

    it("deletes the documents, the extraction row and the stored file (DR-4, DR-7)", async () => {
      expect(
        await db
          .select({ id: documentoRespaldo.id })
          .from(documentoRespaldo)
          .where(inArray(documentoRespaldo.solicitudId, requestIds)),
      ).toEqual([]);
      expect(
        await db
          .select({ id: extraccionDocumento.documentoId })
          .from(extraccionDocumento)
          .where(eq(extraccionDocumento.documentoId, documentId)),
      ).toEqual([]);
      expect(store.has(pathname)).toBe(false);
    });

    it("writes exactly one audit row, by the system account, without personal data (DR-6)", async () => {
      const rows = await db
        .select()
        .from(eventoAuditoria)
        .where(
          and(
            eq(eventoAuditoria.accion, "usuario.cancelado"),
            inArray(eventoAuditoria.entidadId, [a.id, b, c]),
          ),
        );
      const [sentinel] = await db
        .select({ id: usuario.id })
        .from(usuario)
        .where(eq(usuario.login, SYSTEM_LOGIN));

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        actorId: sentinel.id,
        entidadTipo: "Usuario",
        entidadId: a.id,
      });
      expect(rows[0].datos).toEqual({
        motivo: "retencion_5_anios",
        solicitudes: 2,
        documentos: 1,
      });
      const serialized = JSON.stringify(rows[0]);
      for (const personal of [a.nombre, a.cif, a.correo]) {
        expect(serialized).not.toContain(personal);
      }
    });

    it("leaves the younger and the enrolled students untouched (DR-1, DR-2)", async () => {
      const after = [await readStudentRows(b), await readStudentRows(c)];

      expect(after).toEqual(untouched);
      expect(after.map((rows) => rows.account.canceladoEn)).toEqual([
        null,
        null,
      ]);
    });

    it("cancels nobody on a second run and adds no audit row (DR-8)", async () => {
      const audit = () =>
        db
          .select({ id: eventoAuditoria.id })
          .from(eventoAuditoria)
          .where(
            and(
              eq(eventoAuditoria.accion, "usuario.cancelado"),
              eq(eventoAuditoria.entidadId, a.id),
            ),
          );
      const rowsBefore = await audit();

      const response = await call();

      expect(await response.json()).toMatchObject({
        due: 0,
        cancelled: 0,
        failures: 0,
      });
      expect(await audit()).toEqual(rowsBefore);
    });

    it("rejects an UPDATE on the audit table with insufficient_privilege (42501)", async () => {
      const outcome = await db
        .execute(
          sql`UPDATE "EventoAuditoria" SET "Datos" = '{}'::jsonb WHERE "EntidadId" = ${a.id} AND "Accion" = 'usuario.cancelado'`,
        )
        .then(
          () => "accepted",
          (error: unknown) => sqlState(error),
        );

      expect(outcome).toBe("42501");
    });
  },
);
