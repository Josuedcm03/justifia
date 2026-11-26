import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  asignatura,
  carrera,
  documentoRespaldo,
  escalamiento,
  facultad,
  grupo,
  remision,
  reporteInasistencia,
  rol,
  solicitud,
  solicitudAsignatura,
  solicitudDecision,
  solicitudRevision,
  usuario,
} from "@/db/schema";
import { submitDraft } from "@/lib/data/solicitudes";
import { CONSENT_VERSION } from "@/lib/intake/consent";
import { buildPathname } from "@/lib/intake/pathnames";
import type { RolUsuario } from "@/lib/validations/auth";

// Isolated fixtures of the real-Postgres suites. Every row a test needs is
// created here under a unique run id and removed by `cleanup()`. Audit rows are
// append-only (a trigger rejects DELETE), so a student that wrote one cannot be
// deleted (FK); that residue, and the catalog rows it pins, stay on the
// disposable branch by design. Rows created by the code under test (grupos,
// accounts, requests) are handed over with `adopt` so they are removed too.
// Enrollments are not removed here: only `enrollment-write.ts` may write
// `Inscripcion` among the production sources (a structural test), so a suite
// that plants enrollments deletes them itself before `cleanup()`.

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

export type StudentInOtherFacultad = Student & { facultadId: number };

export type Secretaria = { id: number; facultadId: number };

export type Coordinator = { id: number; carreraId: number };

/** An account the fixtures created, with the values a test compares against. */
export type Account = {
  id: number;
  correo: string | null;
  nombre: string;
};

export type Docente = Account & { correo: string };

export type Subject = { id: number; codigo: string };

/** A submitted request with one stored document, on a given grupo. */
export type SubmittedRequest = {
  studentId: number;
  requestId: number;
  pathname: string;
};

/** What every fixture request is filed with (the intake suite's values). */
const SUBMIT_DETAILS = {
  causa: "medica",
  fechaInicio: "2026-10-01",
  fechaFin: "2026-10-03",
};

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
  const coordinatorIds: number[] = [];
  /** Accounts and requests the code under test created (`adopt`). */
  const adoptedAccountIds: number[] = [];
  const adoptedRequestIds: number[] = [];

  let careerId: number | null = null;
  let careerFacultadId: number | null = null;
  let otherCareer: { carreraId: number; facultadId: number } | null = null;

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

  /** A second facultad with its own career, for scope-confinement cases. */
  async function ensureOtherCareer(): Promise<{
    carreraId: number;
    facultadId: number;
  }> {
    if (otherCareer !== null) return otherCareer;
    const [fac] = await db
      .insert(facultad)
      .values({ nombre: `IT otra facultad ${run}` })
      .returning({ id: facultad.id });
    facultadIds.push(fac.id);
    const [car] = await db
      .insert(carrera)
      .values({ nombre: `IT otra carrera ${run}`, facultadId: fac.id })
      .returning({ id: carrera.id });
    carreraIds.push(car.id);
    otherCareer = { carreraId: car.id, facultadId: fac.id };
    return otherCareer;
  }

  async function insertStudent(carreraId: number): Promise<Student> {
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
        carreraId,
      })
      .returning({ id: usuario.id, cif: usuario.cif });
    studentIds.push(row.id);
    return { id: row.id, cif: row.cif as string };
  }

  async function insertAccount(options: {
    rol: RolUsuario;
    nombreRol: string;
    login: string;
    nombre: string;
    correo?: string | null;
    telefono?: string | null;
    activo?: boolean;
  }): Promise<number> {
    const [row] = await db
      .insert(usuario)
      .values({
        login: options.login,
        hashClave: "integration-not-a-real-hash",
        rolId: await ensureRole(options.rol, options.nombreRol),
        nombreCompleto: options.nombre,
        ...(options.correo ? { correo: options.correo } : {}),
        ...(options.telefono ? { telefono: options.telefono } : {}),
        ...(options.activo === undefined ? {} : { activo: options.activo }),
      })
      .returning({ id: usuario.id });
    return row.id;
  }

  async function insertDraft(studentId: number): Promise<number> {
    const [row] = await db
      .insert(solicitud)
      .values({ estudianteId: studentId })
      .returning({ id: solicitud.id });
    draftIds.push(row.id);
    return row.id;
  }

  async function fillDraftRows(
    draftId: number,
    details: { causa: string; fechaInicio: string; fechaFin: string },
    group: number,
  ): Promise<void> {
    await db.update(solicitud).set(details).where(eq(solicitud.id, draftId));
    await db
      .insert(solicitudAsignatura)
      .values({ solicitudId: draftId, grupoId: group });
  }

  async function insertValidDocument(draftId: number): Promise<string> {
    const pathname = buildPathname(draftId, randomUUID(), "pdf");
    await db.insert(documentoRespaldo).values({
      solicitudId: draftId,
      pathname,
      nombreOriginal: "constancia.pdf",
      tipoDetectado: "pdf",
      tamanoBytes: PDF_BYTES.length,
      estado: "valido",
    });
    return pathname;
  }

  return {
    run,

    /** A student with the account data a submission snapshots. */
    async addStudent(): Promise<Student> {
      return insertStudent(await ensureCareer());
    },

    /**
     * A student whose current career belongs to a SECOND facultad, so a
     * secretaria of the facultad of `addStudent` / `addSecretaria` sees this
     * student's requests as out of scope (RN-26 reference, RNF-01).
     */
    async addStudentInOtherFacultad(): Promise<StudentInOtherFacultad> {
      const other = await ensureOtherCareer();
      const student = await insertStudent(other.carreraId);
      return { ...student, facultadId: other.facultadId };
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

    /**
     * An active `coordinacion` account of the career every student of this run
     * belongs to: the recipient an escalation needs (escalation, E17).
     */
    async addCoordinator(
      options: { correo?: string } = {},
    ): Promise<Coordinator> {
      const carreraId = await ensureCareer();
      const tag = next();
      const [row] = await db
        .insert(usuario)
        .values({
          login: `it-coord-${tag}`,
          hashClave: "integration-not-a-real-hash",
          rolId: await ensureRole("coordinacion", "Coordinacion"),
          nombreCompleto: `IT Coordinacion ${tag}`,
          carreraId,
          ...(options.correo ? { correo: options.correo } : {}),
        })
        .returning({ id: usuario.id });
      coordinatorIds.push(row.id);
      return { id: row.id, carreraId };
    },

    /** A teacher account, for rows that name one (an absence report). */
    async addTeacher(): Promise<number> {
      const tag = next();
      const [row] = await db
        .insert(usuario)
        .values({
          login: `it-teacher-${tag}`,
          hashClave: "integration-not-a-real-hash",
          rolId: await ensureRole("docente", "Docente"),
          nombreCompleto: `IT Docente ${tag}`,
        })
        .returning({ id: usuario.id });
      docenteIds.push(row.id);
      return row.id;
    },

    /**
     * A group (with its subject and teacher) a draft can point at. Pass the
     * teacher's `correo` for a remission that can be sent (teacher-remission),
     * and `periodo` for a period other than the default `IT` (RN-14). Pass
     * `docenteId` to name an existing teacher (none is created), `asignaturaId`
     * to put the group under an existing subject (then vary `numeroGrupo`: the
     * natural key is the subject, the period and the number), and `activo`
     * false for an inactive group.
     */
    async addGroup(
      options: {
        correo?: string;
        periodo?: string;
        docenteId?: number;
        asignaturaId?: number;
        numeroGrupo?: string;
        activo?: boolean;
      } = {},
    ): Promise<number> {
      const tag = next();
      let docenteId = options.docenteId;
      if (docenteId === undefined) {
        docenteId = await insertAccount({
          rol: "docente",
          nombreRol: "Docente",
          login: `it-doc-${tag}`,
          nombre: `IT Docente ${tag}`,
          correo: options.correo,
        });
        docenteIds.push(docenteId);
      }
      let asignaturaId = options.asignaturaId;
      if (asignaturaId === undefined) {
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
        asignaturaId = subject.id;
      }
      const [group] = await db
        .insert(grupo)
        .values({
          asignaturaId,
          periodo: options.periodo ?? "IT",
          numeroGrupo: options.numeroGrupo ?? "1",
          docenteId,
          ...(options.activo === undefined ? {} : { activo: options.activo }),
        })
        .returning({ id: grupo.id });
      grupoIds.push(group.id);
      return group.id;
    },

    /**
     * An account of any role, for the cases that need another holder of an
     * email (docente-maintenance DM-4) or a creator of accounts. `correo` is
     * stored as given, so a mixed-case legacy value can be planted.
     */
    async addAccount(options: {
      rol: RolUsuario;
      correo?: string;
      activo?: boolean;
      telefono?: string;
    }): Promise<Account> {
      const tag = next();
      const nombre = `IT ${options.rol} ${tag}`;
      const id = await insertAccount({
        rol: options.rol,
        nombreRol: options.rol,
        login: `it-${options.rol}-${tag}`,
        nombre,
        correo: options.correo,
        telefono: options.telefono,
        activo: options.activo,
      });
      adoptedAccountIds.push(id);
      return { id, correo: options.correo ?? null, nombre };
    },

    /**
     * A docente with an email (unique per run), active unless told otherwise.
     * It owns no group; `addGroup({ docenteId })` gives it some.
     */
    async addDocente(
      options: { correo?: string; activo?: boolean; telefono?: string } = {},
    ): Promise<Docente> {
      const tag = next();
      const correo = options.correo ?? `it-docente-${tag}@integration.invalid`;
      const nombre = `IT Docente ${tag}`;
      const id = await insertAccount({
        rol: "docente",
        nombreRol: "Docente",
        login: `it-doc-${tag}`,
        nombre,
        correo,
        telefono: options.telefono,
        activo: options.activo,
      });
      docenteIds.push(id);
      return { id, correo, nombre };
    },

    /** A subject of this run's career, active unless told otherwise. */
    async addSubject(options: { activo?: boolean } = {}): Promise<Subject> {
      const tag = next();
      const codigo = `IT-${tag}`.slice(0, 32);
      const [subject] = await db
        .insert(asignatura)
        .values({
          codigo,
          nombre: `IT asignatura ${tag}`,
          carreraId: await ensureCareer(),
          horasTotales: 48,
          ...(options.activo === undefined ? {} : { activo: options.activo }),
        })
        .returning({ id: asignatura.id });
      asignaturaIds.push(subject.id);
      return { id: subject.id, codigo };
    },

    /**
     * A new student's request, submitted and left pending, with one stored
     * document, on `group`. The same calls as the intake suite (draft, step 1
     * values and subject, a `valido` document, `submitDraft`); the caller
     * seeds the fake store with `PDF_BYTES` under the returned pathname when a
     * remission is to be sent.
     */
    async addSubmittedRequest(group: number): Promise<SubmittedRequest> {
      const student = await insertStudent(await ensureCareer());
      const requestId = await insertDraft(student.id);
      await fillDraftRows(requestId, SUBMIT_DETAILS, group);
      const pathname = await insertValidDocument(requestId);
      const submitted = await submitDraft({
        userId: student.id,
        solicitudId: requestId,
        now: new Date(),
        ...SUBMIT_DETAILS,
        grupoIds: [group],
        consentimientoVersion: CONSENT_VERSION,
      });
      if (!submitted.ok) {
        throw new Error(`fixture request not submitted: ${submitted.reason}`);
      }
      return { studentId: student.id, requestId, pathname };
    },

    /**
     * Hands over rows the code under test created, so `cleanup()` removes them
     * as it removes its own: grupos, accounts (any role) and requests.
     */
    adopt(created: {
      grupos?: readonly number[];
      accounts?: readonly number[];
      requests?: readonly number[];
    }): void {
      grupoIds.push(...(created.grupos ?? []));
      adoptedAccountIds.push(...(created.accounts ?? []));
      adoptedRequestIds.push(...(created.requests ?? []));
    },

    /** An empty draft owned by `studentId`, inserted directly. */
    async addDraft(studentId: number): Promise<number> {
      return insertDraft(studentId);
    },

    /** Step 1 values and one subject, as a draft ready to submit. */
    async fillDraft(
      draftId: number,
      details: { causa: string; fechaInicio: string; fechaFin: string },
      group: number,
    ): Promise<void> {
      await fillDraftRows(draftId, details, group);
    },

    /** A finalized (`valido`) document row; returns its pathname. */
    async addValidDocument(draftId: number): Promise<string> {
      return insertValidDocument(draftId);
    },

    /** Delete everything created above, children first. */
    async cleanup(): Promise<void> {
      const owners = [...studentIds];
      if (owners.length > 0 || adoptedRequestIds.length > 0) {
        // Decisions and revisions have no cascade (append-only history), so
        // the rows of this run go first. Disposable branch only.
        const requests =
          owners.length > 0
            ? await db
                .select({ id: solicitud.id })
                .from(solicitud)
                .where(inArray(solicitud.estudianteId, owners))
            : [];
        const requestIds = [
          ...new Set([...requests.map((r) => r.id), ...adoptedRequestIds]),
        ];
        if (requestIds.length > 0) {
          // Escalations reference their report, so they go first (escalation).
          await db
            .delete(escalamiento)
            .where(inArray(escalamiento.solicitudId, requestIds));
          await db
            .delete(reporteInasistencia)
            .where(inArray(reporteInasistencia.solicitudId, requestIds));
          await db
            .delete(remision)
            .where(inArray(remision.solicitudId, requestIds));
          await db
            .delete(solicitudDecision)
            .where(inArray(solicitudDecision.solicitudId, requestIds));
          await db
            .delete(solicitudRevision)
            .where(inArray(solicitudRevision.solicitudId, requestIds));
        }
        // Drafts created by the code under test have ids we never saw.
        if (owners.length > 0) {
          await db
            .delete(solicitud)
            .where(inArray(solicitud.estudianteId, owners));
        }
        if (adoptedRequestIds.length > 0) {
          await db
            .delete(solicitud)
            .where(inArray(solicitud.id, adoptedRequestIds));
        }
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
      for (const id of [
        ...studentIds,
        ...secretariaIds,
        ...coordinatorIds,
        ...adoptedAccountIds,
      ]) {
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
