import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  asignatura,
  carrera,
  documentoRespaldo,
  facultad,
  grupo,
  rol,
  solicitud,
  solicitudAsignatura,
  solicitudDecision,
  solicitudRevision,
  usuario,
} from "@/db/schema";
import { buildPathname } from "@/lib/intake/pathnames";
import type { RolUsuario } from "@/lib/validations/auth";

// Isolated fixtures of the real-Postgres suites. Every row a test needs is
// created here under a unique run id and removed by `cleanup()`. Audit rows are
// append-only (a trigger rejects DELETE), so a student that wrote one cannot be
// deleted (FK); that residue, and the catalog rows it pins, stay on the
// disposable branch by design.

export const PDF_BYTES = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34];

/** Postgres error code for a foreign-key violation. */
const FK_VIOLATION = "23503";

function isForeignKeyViolation(error: unknown): boolean {
  let current: unknown = error;
  while (current && typeof current === "object") {
    if ((current as { code?: unknown }).code === FK_VIOLATION) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

async function ignoringPinnedRows(run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (error) {
    if (!isForeignKeyViolation(error)) throw error;
  }
}

async function ensureRole(codigo: RolUsuario, nombre: string): Promise<number> {
  await db.insert(rol).values({ codigo, nombre }).onConflictDoNothing();
  const [row] = await db
    .select({ id: rol.id })
    .from(rol)
    .where(eq(rol.codigo, codigo))
    .limit(1);
  return row.id;
}

export type Student = { id: number; cif: string };

export type Secretaria = { id: number; facultadId: number };

export function createFixtures() {
  const run = randomUUID().replaceAll("-", "").slice(0, 12);
  let counter = 0;
  const next = () => `${run}-${++counter}`;

  const studentIds: number[] = [];
  const draftIds: number[] = [];
  const facultadIds: number[] = [];
  const carreraIds: number[] = [];
  const asignaturaIds: number[] = [];
  const grupoIds: number[] = [];
  const docenteIds: number[] = [];
  const secretariaIds: number[] = [];

  let careerId: number | null = null;
  let careerFacultadId: number | null = null;

  async function ensureCareer(): Promise<number> {
    if (careerId !== null) return careerId;
    const [fac] = await db
      .insert(facultad)
      .values({ nombre: `IT facultad ${run}` })
      .returning({ id: facultad.id });
    facultadIds.push(fac.id);
    const [car] = await db
      .insert(carrera)
      .values({ nombre: `IT carrera ${run}`, facultadId: fac.id })
      .returning({ id: carrera.id });
    carreraIds.push(car.id);
    careerId = car.id;
    careerFacultadId = fac.id;
    return car.id;
  }

  return {
    run,

    /** A student with the account data a submission snapshots. */
    async addStudent(): Promise<Student> {
      const tag = next();
      const [row] = await db
        .insert(usuario)
        .values({
          login: `it-${tag}`,
          hashClave: "integration-not-a-real-hash",
          rolId: await ensureRole("estudiante", "Estudiante"),
          nombreCompleto: `IT Estudiante ${tag}`,
          correo: `it-${tag}@integration.invalid`,
          cif: `IT${tag}`.slice(0, 20),
          carreraId: await ensureCareer(),
        })
        .returning({ id: usuario.id, cif: usuario.cif });
      studentIds.push(row.id);
      return { id: row.id, cif: row.cif as string };
    },

    /**
     * A secretaria of the facultad every student and group of this run belongs
     * to (review scope, SR-6). The facultad is created together with the career.
     */
    async addSecretaria(): Promise<Secretaria> {
      await ensureCareer();
      const facultadId = careerFacultadId as number;
      const tag = next();
      const [row] = await db
        .insert(usuario)
        .values({
          login: `it-sec-${tag}`,
          hashClave: "integration-not-a-real-hash",
          rolId: await ensureRole("secretaria", "Secretaria"),
          nombreCompleto: `IT Secretaria ${tag}`,
          facultadId,
        })
        .returning({ id: usuario.id });
      secretariaIds.push(row.id);
      return { id: row.id, facultadId };
    },

    /** A group (with its subject and teacher) a draft can point at. */
    async addGroup(): Promise<number> {
      const tag = next();
      const [docente] = await db
        .insert(usuario)
        .values({
          login: `it-doc-${tag}`,
          hashClave: "integration-not-a-real-hash",
          rolId: await ensureRole("docente", "Docente"),
          nombreCompleto: `IT Docente ${tag}`,
        })
        .returning({ id: usuario.id });
      docenteIds.push(docente.id);
      const [subject] = await db
        .insert(asignatura)
        .values({
          codigo: `IT-${tag}`.slice(0, 32),
          nombre: `IT asignatura ${tag}`,
          carreraId: await ensureCareer(),
          horasTotales: 48,
        })
        .returning({ id: asignatura.id });
      asignaturaIds.push(subject.id);
      const [group] = await db
        .insert(grupo)
        .values({
          asignaturaId: subject.id,
          periodo: "IT",
          numeroGrupo: "1",
          docenteId: docente.id,
        })
        .returning({ id: grupo.id });
      grupoIds.push(group.id);
      return group.id;
    },

    /** An empty draft owned by `studentId`, inserted directly. */
    async addDraft(studentId: number): Promise<number> {
      const [row] = await db
        .insert(solicitud)
        .values({ estudianteId: studentId })
        .returning({ id: solicitud.id });
      draftIds.push(row.id);
      return row.id;
    },

    /** Step 1 values and one subject, as a draft ready to submit. */
    async fillDraft(
      draftId: number,
      details: { causa: string; fechaInicio: string; fechaFin: string },
      group: number,
    ): Promise<void> {
      await db.update(solicitud).set(details).where(eq(solicitud.id, draftId));
      await db
        .insert(solicitudAsignatura)
        .values({ solicitudId: draftId, grupoId: group });
    },

    /** A finalized (`valido`) document row. */
    async addValidDocument(draftId: number): Promise<void> {
      await db.insert(documentoRespaldo).values({
        solicitudId: draftId,
        pathname: buildPathname(draftId, randomUUID(), "pdf"),
        nombreOriginal: "constancia.pdf",
        tipoDetectado: "pdf",
        tamanoBytes: PDF_BYTES.length,
        estado: "valido",
      });
    },

    /** Delete everything created above, children first. */
    async cleanup(): Promise<void> {
      const owners = [...studentIds];
      if (owners.length > 0) {
        // Decisions and revisions have no cascade (append-only history), so
        // the rows of this run go first. Disposable branch only.
        const requests = await db
          .select({ id: solicitud.id })
          .from(solicitud)
          .where(inArray(solicitud.estudianteId, owners));
        const requestIds = requests.map((r) => r.id);
        if (requestIds.length > 0) {
          await db
            .delete(solicitudDecision)
            .where(inArray(solicitudDecision.solicitudId, requestIds));
          await db
            .delete(solicitudRevision)
            .where(inArray(solicitudRevision.solicitudId, requestIds));
        }
        // Drafts created by the code under test have ids we never saw.
        await db
          .delete(solicitud)
          .where(inArray(solicitud.estudianteId, owners));
      }
      if (draftIds.length > 0) {
        await db.delete(solicitud).where(inArray(solicitud.id, draftIds));
      }
      if (grupoIds.length > 0) {
        await db.delete(grupo).where(inArray(grupo.id, grupoIds));
      }
      if (asignaturaIds.length > 0) {
        await db
          .delete(asignatura)
          .where(inArray(asignatura.id, asignaturaIds));
      }
      if (docenteIds.length > 0) {
        await ignoringPinnedRows(() =>
          db.delete(usuario).where(inArray(usuario.id, docenteIds)),
        );
      }
      for (const id of [...studentIds, ...secretariaIds]) {
        await ignoringPinnedRows(() =>
          db.delete(usuario).where(eq(usuario.id, id)),
        );
      }
      for (const id of carreraIds) {
        await ignoringPinnedRows(() =>
          db.delete(carrera).where(eq(carrera.id, id)),
        );
      }
      for (const id of facultadIds) {
        await ignoringPinnedRows(() =>
          db.delete(facultad).where(eq(facultad.id, id)),
        );
      }
    },
  };
}
