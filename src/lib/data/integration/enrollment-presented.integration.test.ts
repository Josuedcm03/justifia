import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { inscripcion, solicitud, solicitudAsignatura } from "@/db/schema";
import { dropGroup } from "@/lib/data/enrollment-write";
import { createFixtures } from "@/lib/data/integration/fixtures";
import { submitDraft } from "@/lib/data/solicitudes";
import { CONSENT_VERSION } from "@/lib/intake/consent";

// Real-Postgres check of RF-17 (e): requests already presented keep the groups
// they were presented with. The student-enrollment verify report left the
// scenario "Presented requests unaffected" PARTIAL because no test asserted it.
//
// The request is submitted through the real `submitDraft`, the enrollment is
// dropped through the real `dropGroup`, and the request row and its
// `SolicitudAsignatura` rows are read back from the database.
//
// HOW TO RUN: see intake-concurrency.integration.test.ts (disposable Neon
// branch, INTEGRATION_DATABASE_URL and INTEGRATION_ALLOW_WRITES=1).

const gate = { mode: process.env.INTEGRATION_GATE_MODE ?? "skip" };
if (gate.mode === "refuse") {
  throw new Error(
    `Refusing to run the integration suite: ${process.env.INTEGRATION_GATE_REASON}`,
  );
}

const DETAILS = {
  causa: "medica",
  fechaInicio: "2026-10-01",
  fechaFin: "2026-10-03",
};

describe.skipIf(gate.mode !== "run")(
  "student-enrollment presented requests (real Postgres, RF-17 e)",
  () => {
    const fixtures = createFixtures();
    const enrolledStudents: number[] = [];

    beforeAll(async () => {
      // Fail fast and readable when the branch is unreachable or unmigrated.
      await db
        .select({ activo: inscripcion.activo })
        .from(inscripcion)
        .limit(1);
    });

    afterAll(async () => {
      // Inscripcion references the student and the group, so it goes before
      // the fixtures delete them.
      if (enrolledStudents.length > 0) {
        await db
          .delete(inscripcion)
          .where(inArray(inscripcion.estudianteId, enrolledStudents));
      }
      await fixtures.cleanup();
    });

    it("leaves a pending request, its subjects and its state unchanged when the student drops the group", async () => {
      const student = await fixtures.addStudent();
      enrolledStudents.push(student.id);
      const group = await fixtures.addGroup();
      await db
        .insert(inscripcion)
        .values({ estudianteId: student.id, grupoId: group, activo: true });

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
      expect(submitted.ok).toBe(true);

      const readRequest = () =>
        db.select().from(solicitud).where(eq(solicitud.id, draftId));
      const readSubjects = () =>
        db
          .select()
          .from(solicitudAsignatura)
          .where(eq(solicitudAsignatura.solicitudId, draftId));
      const [before] = await readRequest();
      const subjectsBefore = await readSubjects();
      expect(before.estado).toBe("pendiente");
      expect(subjectsBefore.map((s) => s.grupoId)).toEqual([group]);

      expect(await dropGroup(student.id, group)).toEqual({
        ok: true,
        grupoId: group,
      });

      // The enrollment is deactivated, not removed (RF-17 c).
      const [enrollment] = await db
        .select({ activo: inscripcion.activo })
        .from(inscripcion)
        .where(
          and(
            eq(inscripcion.estudianteId, student.id),
            eq(inscripcion.grupoId, group),
          ),
        );
      expect(enrollment.activo).toBe(false);

      const [after] = await readRequest();
      expect(after).toEqual(before);
      expect(await readSubjects()).toEqual(subjectsBefore);
    });
  },
);
