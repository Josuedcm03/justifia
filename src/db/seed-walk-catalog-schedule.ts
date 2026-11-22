// Practice data for the owner's manual walk of the SDD change
// `catalog-schedule` (tasks.md Phase 16, W1-W3). Run ONLY against a
// disposable walk branch: `npm run db:seed:walk`.
//
// Every row it writes is marked with a `walk` prefix (logins `walk.*`, emails
// `@walk.example`, CIFs `WALK*`, asignatura codes `WALK-*`). It is idempotent:
// rows are inserted with `onConflictDoNothing` or after a lookup, so a second
// run changes nothing (and does NOT restore a row the walk itself changed).
//
// The database modules are imported inside `main()` only, so the pure
// helpers below can be unit tested without a database or an environment.

import { encodeDias } from "@/lib/catalog/dias";
import { PERIODO_RE } from "@/lib/import/normalize";
import { CONSENT_VERSION } from "@/lib/intake/consent";
import { CANCELLED_HASH, CANCELLED_TEXT } from "@/lib/retention/policy";
import type { RolUsuario } from "@/lib/validations/auth";

// `process.env` or a test literal; only the three walk keys are read.
type WalkEnv = Readonly<Record<string, string | undefined>>;

/**
 * Safety guard, run before any write: the hostname of `DATABASE_URL` must
 * equal `WALK_SEED_EXPECTED_HOST` exactly (no trimming, no case folding, no
 * suffix match). Returns the hostname so the caller can print it.
 */
export function assertWalkTarget(env: WalkEnv): string {
  const expected = env.WALK_SEED_EXPECTED_HOST;
  if (!expected) {
    throw new Error(
      "WALK_SEED_EXPECTED_HOST must be set to the hostname of the walk branch.",
    );
  }
  const url = env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL must be set.");
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    throw new Error("DATABASE_URL is not a valid URL.");
  }
  if (hostname === "" || hostname !== expected) {
    throw new Error(
      `Refusing to seed: DATABASE_URL points at "${hostname}", not at WALK_SEED_EXPECTED_HOST "${expected}". Nothing was written.`,
    );
  }
  return hostname;
}

/** Same rule as `seed.ts`: 8 characters or more, from the environment only. */
export function walkSeedPassword(env: WalkEnv): string {
  const value = env.SEED_PASSWORD;
  if (!value || value.length < 8) {
    throw new Error("SEED_PASSWORD must be set (8 characters or more).");
  }
  return value;
}

/** The period right before `periodo` (`2026-S2` -> `2026-S1` -> `2025-S2`). */
export function previousPeriod(periodo: string): string {
  if (!PERIODO_RE.test(periodo)) {
    throw new Error(`Invalid period "${periodo}"`);
  }
  const [year, term] = periodo.split("-S").map(Number);
  return term === 2 ? `${year}-S1` : `${year - 1}-S2`;
}

/** Used only when the branch offers no group at all. */
export const DEFAULT_WALK_PERIOD = "2026-S2";

/**
 * The walk joins the period the app already offers, so the walk groups sit
 * next to the real offering instead of hiding it. Order: the period of walk
 * groups from an earlier run (stable reruns), else the latest period as the
 * app derives it (`getLatestPeriod`), else the default.
 */
export function chooseWalkPeriod(
  existingWalkPeriod: string | null,
  latestPeriod: string | null,
): string {
  return existingWalkPeriod ?? latestPeriod ?? DEFAULT_WALK_PERIOD;
}

const FACULTAD_A = "Facultad de Ingeniería y Arquitectura";
const FACULTAD_B = "Facultad de Ciencias Médicas";
const CARRERA_A1 = "Ingeniería de Sistemas";
const CARRERA_A2 = "Ingeniería Civil";
const CARRERA_B1 = "Medicina General";

type Summary = { login: string; rol: string; facultad: string; uso: string };

/** Managua-agnostic `YYYY-MM-DD` of `now` shifted by `days`. */
function isoDay(now: Date, days: number): string {
  return new Date(now.getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 86_400_000);
}

async function main() {
  await import("dotenv/config");

  // Guard first: nothing below runs, not even the connection, on a mismatch.
  const hostname = assertWalkTarget(process.env);
  const password = walkSeedPassword(process.env);
  console.log(`Walk seed target host: ${hostname}`);

  const { and, eq, inArray, like, max } = await import("drizzle-orm");
  const { db, schema } = await import("@/db");
  const { hashPassword } = await import("@/lib/auth/password");
  const s = schema;

  const hash = await hashPassword(password);
  const now = new Date();
  const summary: Summary[] = [];

  await db.transaction(async (tx) => {
    // ---- Prerequisites: roles and the Facultad/Carrera catalog by name.
    const roles = await tx
      .select({ id: s.rol.id, codigo: s.rol.codigo })
      .from(s.rol);
    const rolId = (codigo: RolUsuario) => {
      const row = roles.find((r) => r.codigo === codigo);
      if (!row) {
        throw new Error(
          `Role "${codigo}" is missing: run \`npm run db:seed:roles\` first.`,
        );
      }
      return row.id;
    };

    const facultades = await tx
      .select({ id: s.facultad.id, nombre: s.facultad.nombre })
      .from(s.facultad)
      .where(inArray(s.facultad.nombre, [FACULTAD_A, FACULTAD_B]));
    const carreras = await tx
      .select({
        id: s.carrera.id,
        nombre: s.carrera.nombre,
        facultadId: s.carrera.facultadId,
      })
      .from(s.carrera)
      .where(inArray(s.carrera.nombre, [CARRERA_A1, CARRERA_A2, CARRERA_B1]));
    const facultadId = (nombre: string) => {
      const row = facultades.find((f) => f.nombre === nombre);
      if (!row) {
        throw new Error(
          `Facultad "${nombre}" is missing: run \`npm run db:seed:carreras\` first.`,
        );
      }
      return row.id;
    };
    const carreraId = (nombre: string, facultad: string) => {
      const row = carreras.find((c) => c.nombre === nombre);
      if (!row || row.facultadId !== facultadId(facultad)) {
        throw new Error(
          `Carrera "${nombre}" of "${facultad}" is missing: run \`npm run db:seed:carreras\` first.`,
        );
      }
      return row.id;
    };
    const facA = facultadId(FACULTAD_A);
    const facB = facultadId(FACULTAD_B);
    const carA1 = carreraId(CARRERA_A1, FACULTAD_A);
    const carA2 = carreraId(CARRERA_A2, FACULTAD_A);
    const carB1 = carreraId(CARRERA_B1, FACULTAD_B);

    // ---- Usuarios.
    type UserSpec = Omit<
      typeof s.usuario.$inferInsert,
      "hashClave" | "rolId"
    > & { rol: RolUsuario; facultad: string; uso: string };

    const ensureUser = async (spec: UserSpec): Promise<number> => {
      const { rol, facultad, uso, ...values } = spec;
      await tx
        .insert(s.usuario)
        .values({
          ...values,
          // A cancelled account cannot sign in, like a real one (DR-3).
          hashClave: values.canceladoEn ? CANCELLED_HASH : hash,
          rolId: rolId(rol),
        })
        .onConflictDoNothing();
      const [row] = await tx
        .select({ id: s.usuario.id })
        .from(s.usuario)
        .where(eq(s.usuario.login, values.login))
        .limit(1);
      if (!row) {
        throw new Error(
          `User "${values.login}" was not created: another account already holds its email or CIF.`,
        );
      }
      summary.push({ login: values.login, rol, facultad, uso });
      return row.id;
    };

    const mail = (login: string) => `${login}@walk.example`;

    const secA = await ensureUser({
      login: "walk.sec.a",
      nombreCompleto: "Walk Secretaria FIA",
      correo: mail("walk.sec.a"),
      facultadId: facA,
      rol: "secretaria",
      facultad: "A",
      uso: "W1-W3 staff of facultad A",
    });
    await ensureUser({
      login: "walk.sec.b",
      nombreCompleto: "Walk Secretaria Medicas",
      correo: mail("walk.sec.b"),
      facultadId: facB,
      rol: "secretaria",
      facultad: "B",
      uso: "W1 scope (sees only B); W3 out-of-scope URL of A rows",
    });
    await ensureUser({
      login: "walk.coord.a",
      nombreCompleto: "Walk Coordinacion Sistemas",
      correo: mail("walk.coord.a"),
      carreraId: carA1,
      rol: "coordinacion",
      facultad: "A",
      uso: "W1 other role denied",
    });
    const docA = await ensureUser({
      login: "walk.doc.a",
      nombreCompleto: "Walk Docente FIA",
      correo: mail("walk.doc.a"),
      rol: "docente",
      facultad: "A",
      uso: "W1 other role denied; teaches WALK-A*",
    });
    const docB = await ensureUser({
      login: "walk.doc.b",
      nombreCompleto: "Walk Docente Medicas",
      correo: mail("walk.doc.b"),
      rol: "docente",
      facultad: "B",
      uso: "teaches WALK-B*",
    });

    const student = (
      login: string,
      nombre: string,
      cif: string,
      carrera: number,
      facultad: string,
      uso: string,
    ) =>
      ensureUser({
        login,
        nombreCompleto: nombre,
        correo: mail(login),
        cif,
        carreraId: carrera,
        rol: "estudiante",
        facultad,
        uso,
      });

    await student(
      "walk.est.a.nuevo",
      "Walk Estudiante Nuevo",
      "WALK0001",
      carA1,
      "A",
      "W3 create (no inscripcion)",
    );
    const estActivo = await student(
      "walk.est.a.activo",
      "Walk Estudiante Activo",
      "WALK0002",
      carA1,
      "A",
      "W2 deactivate (count 2, draft not counted); W3 change group; D9 older period",
    );
    const estInactivo = await student(
      "walk.est.a.inactivo",
      "Walk Estudiante Inactivo",
      "WALK0003",
      carA1,
      "A",
      "W2 reactivate in place (no sibling)",
    );
    const estHermano = await student(
      "walk.est.a.hermano",
      "Walk Estudiante Hermano",
      "WALK0004",
      carA2,
      "A",
      "W2 reactivate with active sibling -> replace link",
    );
    const estBloqueado = await student(
      "walk.est.a.bloqueado",
      "Walk Estudiante Bloqueado",
      "WALK0005",
      carA1,
      "A",
      "W2 reactivate refused (inactive group / inactive asignatura)",
    );
    await ensureUser({
      login: "walk.est.a.cancelado",
      nombreCompleto: CANCELLED_TEXT,
      carreraId: carA1,
      activo: false,
      canceladoEn: daysAgo(now, 30),
      rol: "estudiante",
      facultad: "A",
      uso: "W3 cancelled: not found by search (cannot sign in)",
    });
    const estBActivo = await student(
      "walk.est.b.activo",
      "Walk Estudiante Medicas Activo",
      "WALK0101",
      carB1,
      "B",
      "W1 row hidden from walk.sec.a; W3 out-of-scope URL",
    );
    await student(
      "walk.est.b.nuevo",
      "Walk Estudiante Medicas Nuevo",
      "WALK0102",
      carB1,
      "B",
      "W1/W3 hidden from walk.sec.a search",
    );

    // ---- Periods: join the period the app offers (see `chooseWalkPeriod`).
    const [walkRow] = await tx
      .select({ periodo: max(s.grupo.periodo) })
      .from(s.grupo)
      .innerJoin(s.asignatura, eq(s.asignatura.id, s.grupo.asignaturaId))
      .where(like(s.asignatura.codigo, "WALK-%"));
    // Same query as `getLatestPeriod` in src/lib/data/enrollment-picker.ts.
    const [latestRow] = await tx
      .select({ periodo: max(s.grupo.periodo) })
      .from(s.grupo)
      .innerJoin(s.asignatura, eq(s.asignatura.id, s.grupo.asignaturaId))
      .where(and(eq(s.grupo.activo, true), eq(s.asignatura.activo, true)));
    const periodo = chooseWalkPeriod(
      walkRow?.periodo ?? null,
      latestRow?.periodo ?? null,
    );
    const anterior = previousPeriod(periodo);

    // ---- Asignaturas.
    const ensureAsignatura = async (
      codigo: string,
      nombre: string,
      carrera: number,
      activo = true,
    ) => {
      await tx
        .insert(s.asignatura)
        .values({
          codigo,
          nombre,
          carreraId: carrera,
          horasTotales: 60,
          activo,
        })
        .onConflictDoNothing();
      const [row] = await tx
        .select({ id: s.asignatura.id })
        .from(s.asignatura)
        .where(eq(s.asignatura.codigo, codigo))
        .limit(1);
      return row.id;
    };
    const asgA1 = await ensureAsignatura(
      "WALK-A1",
      "Walk Programacion I",
      carA1,
    );
    const asgA2 = await ensureAsignatura("WALK-A2", "Walk Estatica", carA2);
    const asgAX = await ensureAsignatura(
      "WALK-AX",
      "Walk Asignatura Inactiva",
      carA1,
      false,
    );
    const asgB1 = await ensureAsignatura("WALK-B1", "Walk Anatomia", carB1);
    const asgB2 = await ensureAsignatura("WALK-B2", "Walk Fisiologia", carB1);

    // ---- Grupos.
    const lunMie = encodeDias(["lunes", "miercoles"]);
    const marJue = encodeDias(["martes", "jueves"]);
    const ensureGrupo = async (
      asignaturaId: number,
      per: string,
      numeroGrupo: string,
      docenteId: number,
      activo = true,
    ) => {
      await tx
        .insert(s.grupo)
        .values({
          asignaturaId,
          periodo: per,
          numeroGrupo,
          docenteId,
          activo,
          origen: "manual",
          dias: numeroGrupo === "01" ? lunMie : marJue,
        })
        .onConflictDoNothing();
      const [row] = await tx
        .select({ id: s.grupo.id })
        .from(s.grupo)
        .where(
          and(
            eq(s.grupo.asignaturaId, asignaturaId),
            eq(s.grupo.periodo, per),
            eq(s.grupo.numeroGrupo, numeroGrupo),
          ),
        )
        .limit(1);
      return row.id;
    };
    const gA1_01 = await ensureGrupo(asgA1, periodo, "01", docA);
    // WALK-A1 02: the change-group target of walk.est.a.activo (W3).
    await ensureGrupo(asgA1, periodo, "02", docA);
    const gA1_03 = await ensureGrupo(asgA1, periodo, "03", docA, false);
    const gA1_old = await ensureGrupo(asgA1, anterior, "01", docA);
    const gA2_01 = await ensureGrupo(asgA2, periodo, "01", docA);
    const gA2_02 = await ensureGrupo(asgA2, periodo, "02", docA);
    const gAX_01 = await ensureGrupo(asgAX, periodo, "01", docA);
    const gB1_01 = await ensureGrupo(asgB1, periodo, "01", docB);
    await ensureGrupo(asgB1, periodo, "02", docB);
    await ensureGrupo(asgB2, periodo, "01", docB);
    await ensureGrupo(asgB2, periodo, "02", docB);

    // ---- Inscripciones (PK estudiante + grupo, so a rerun is a no-op).
    await tx
      .insert(s.inscripcion)
      .values([
        // Active: deactivate (W2) and change group to WALK-A1 02 (W3).
        { estudianteId: estActivo, grupoId: gA1_01, activo: true },
        { estudianteId: estActivo, grupoId: gA2_01, activo: true },
        // D9: staff deactivation of a row of an older period.
        { estudianteId: estActivo, grupoId: gA1_old, activo: true },
        // Inactive, no sibling: reactivate in place.
        { estudianteId: estInactivo, grupoId: gA1_01, activo: false },
        // Inactive with an active sibling in the same asignatura and period.
        { estudianteId: estHermano, grupoId: gA2_01, activo: true },
        { estudianteId: estHermano, grupoId: gA2_02, activo: false },
        // Refusals: inactive group, inactive asignatura (not offered).
        { estudianteId: estBloqueado, grupoId: gA1_03, activo: false },
        { estudianteId: estBloqueado, grupoId: gAX_01, activo: false },
        // Facultad B row, out of scope for walk.sec.a.
        { estudianteId: estBActivo, grupoId: gB1_01, activo: true },
      ])
      .onConflictDoNothing();

    // ---- Solicitudes of walk.est.a.activo naming WALK-A1 01: one pendiente,
    // one devuelta and one borrador. The dialog count is 2. Seeded once: a
    // rerun skips them when the student already has any request.
    const [existing] = await tx
      .select({ id: s.solicitud.id })
      .from(s.solicitud)
      .where(eq(s.solicitud.estudianteId, estActivo))
      .limit(1);
    if (!existing) {
      const snapshot = {
        estudianteNombre: "Walk Estudiante Activo",
        estudianteCif: "WALK0002",
        estudianteCarrera: CARRERA_A1,
        estudianteCorreo: mail("walk.est.a.activo"),
      };

      const presentadaP = daysAgo(now, 2);
      const [pendiente] = await tx
        .insert(s.solicitud)
        .values({
          estudianteId: estActivo,
          estado: "pendiente",
          causa: "medica",
          fechaInicio: isoDay(now, -5),
          fechaFin: isoDay(now, -4),
          presentadaEn: presentadaP,
          consentimientoEn: presentadaP,
          consentimientoVersion: CONSENT_VERSION,
          ...snapshot,
          creadoEn: daysAgo(now, 3),
          actualizadoEn: presentadaP,
        })
        .returning({ id: s.solicitud.id });

      const presentadaD = daysAgo(now, 8);
      const devueltaEn = daysAgo(now, 7);
      const [devuelta] = await tx
        .insert(s.solicitud)
        .values({
          estudianteId: estActivo,
          estado: "devuelta",
          causa: "fuerza_mayor",
          fechaInicio: isoDay(now, -12),
          fechaFin: isoDay(now, -12),
          presentadaEn: presentadaD,
          consentimientoEn: presentadaD,
          consentimientoVersion: CONSENT_VERSION,
          ...snapshot,
          creadoEn: daysAgo(now, 9),
          actualizadoEn: devueltaEn,
        })
        .returning({ id: s.solicitud.id });

      const [borrador] = await tx
        .insert(s.solicitud)
        .values({
          estudianteId: estActivo,
          estado: "borrador",
          causa: "medica",
          fechaInicio: isoDay(now, -1),
          fechaFin: isoDay(now, -1),
          creadoEn: daysAgo(now, 1),
          actualizadoEn: daysAgo(now, 1),
        })
        .returning({ id: s.solicitud.id });

      await tx.insert(s.solicitudAsignatura).values(
        [pendiente.id, devuelta.id, borrador.id].map((solicitudId) => ({
          solicitudId,
          grupoId: gA1_01,
        })),
      );

      // The return as the app records it: revision snapshot plus decision.
      const [revision] = await tx
        .insert(s.solicitudRevision)
        .values({
          solicitudId: devuelta.id,
          numero: 1,
          causa: "fuerza_mayor",
          fechaInicio: isoDay(now, -12),
          fechaFin: isoDay(now, -12),
          clases: [
            {
              asignaturaId: asgA1,
              codigo: "WALK-A1",
              nombre: "Walk Programacion I",
              numeroGrupo: "01",
            },
          ],
          documentoIds: [],
          creadaEn: devueltaEn,
        })
        .returning({ id: s.solicitudRevision.id });
      await tx.insert(s.solicitudDecision).values({
        solicitudId: devuelta.id,
        tipo: "devuelta",
        plantillaCodigo: "devolucion.fecha_incorrecta",
        motivoCodigo: "fecha_incorrecta",
        texto: "Walk: la fecha indicada no coincide con el documento.",
        revisionId: revision.id,
        secretariaId: secA,
        decididaEn: devueltaEn,
      });
    }

    // Read-back so the owner sees what the walk will find.
    const walkInscripciones = await tx
      .select({ grupoId: s.inscripcion.grupoId })
      .from(s.inscripcion)
      .innerJoin(s.usuario, eq(s.usuario.id, s.inscripcion.estudianteId))
      .where(like(s.usuario.login, "walk.%"));
    console.log(
      `Periods: latest "${periodo}", older "${anterior}". Walk inscripciones: ${walkInscripciones.length}.`,
    );
  });

  console.table(summary);
  console.log(
    "Password of every walk account: the one in SEED_PASSWORD (walk.est.a.cancelado cannot sign in).",
  );
  process.exit(0);
}

// Vitest imports this file for the pure helpers; only a direct run seeds.
if (!process.env.VITEST) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
