import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";

import { db } from "@/db";
import { eventoAuditoria } from "@/db/audit-schema";
import {
  asignatura,
  documentoRespaldo,
  grupo,
  inscripcion,
  remision,
  rol,
  solicitud,
  solicitudAsignatura,
  solicitudDecision,
  usuario,
} from "@/db/schema";
import { docenteWriteEvents, grupoWriteEvents } from "@/lib/audit/events";
import { AUDITABLE_USER_FIELDS } from "@/lib/audit/types";
import { hashPassword } from "@/lib/auth/password";
import type { CatalogScope } from "@/lib/catalog/scope";
import { loadCatalogSnapshot } from "@/lib/data/catalog";
import {
  acquireCatalogWriteLock,
  CatalogBusyError,
  sqlStateOf,
  withCatalogWrite,
} from "@/lib/data/catalog-write";
import {
  getDocenteById,
  setDocenteActivo,
  updateDocente,
} from "@/lib/data/docentes";
import { createGrupo, setGrupoActivo, updateGrupo } from "@/lib/data/grupos";
import { createFixtures, PDF_BYTES } from "@/lib/data/integration/fixtures";
import { dispatchRemission } from "@/lib/data/remission-dispatch";
import { loadReportDashboard } from "@/lib/data/report-rankings";
import { resolveRequestScope } from "@/lib/data/request-scope";
import { getRequestDetail } from "@/lib/data/solicitud-detail";
import { decideRequest } from "@/lib/data/solicitud-decision";
import { createStaffUsuario, findLoginAccount } from "@/lib/data/users";
import { ImportRejectedError, runImportApply } from "@/lib/import/apply";
import { makeWorkbook } from "@/lib/import/__fixtures__/plan-fixtures";
import { planImport } from "@/lib/import/plan";
import type { DecisionInput } from "@/lib/intake/decision-validation";
import {
  createFakeDocumentStore,
  createFakeMailSender,
} from "@/lib/intake/fakes";
import type { RolUsuario } from "@/lib/validations/auth";

// Real-Postgres suite for docente-maintenance (RF-12 a, b for docentes). It
// runs the REAL data layer (`updateDocente`, `setDocenteActivo`,
// `createStaffUsuario`, the grupo writers, the import planner and apply, the
// remission dispatcher and the readers) against a real database, so the
// database, not JavaScript, decides each race and each constraint:
//   SC-1  an edit stores three fields and nothing else, sign-in follows the email
//   SC-2  the email is unique across every role ignoring case, and the own
//         mixed-case email is re-saved as lower case
//   SC-3  a unique violation raised by a concurrent writer is `correo_taken`
//         (the savepoint, A4); an edit and an account creation of one email
//   SC-4  the active-grupo block with its count, both toggles, nothing else touched
//   SC-5  an id of another role is `null` and `not_found`
//   SC-6  an audit insert that fails (a real foreign-key error) rolls everything back
//   SC-7  the catalog lock: deactivation against every grupo writer, both orders
//   SC-8  one `usuario.creado` per staff role, field names only
//   SC-9  plan-only reads of the import over real rows (it is never applied
//         with effect: that would deactivate every absent grupo of the branch)
//   SC-10 / SC-13 remissions keep their snapshot, readers show the live name
//   SC-11 no value in an audit payload or a logged line
//   SC-12 no row count ever falls
//
// HOW TO RUN (never part of `npm test`):
//   1. Create a DISPOSABLE Neon branch of the project with the current
//      migrations applied. Prefer its direct (non-`-pooler`) connection string.
//   2. INTEGRATION_DATABASE_URL=<branch url> INTEGRATION_ALLOW_WRITES=1 \
//        npm run test:integration -- docente-maintenance
// Without INTEGRATION_DATABASE_URL the file is skipped. With it but without
// INTEGRATION_ALLOW_WRITES=1, or with a URL equal to DATABASE_URL, or one whose
// host or database name contains "prod", the run fails on purpose.
//
// No mail leaves the process: the dispatcher gets the fakes of
// `@/lib/intake/fakes`, never `getIntakeDeps`.
//
// Residue: each file deletes the rows it created. Audit rows are append-only,
// so the secretaria and the other actors that wrote one stay (with their
// facultad) on the branch, as in the other suites.

// Decided by vitest.integration.setup.ts before it replaced DATABASE_URL.
const gate = { mode: process.env.INTEGRATION_GATE_MODE ?? "skip" };
if (gate.mode === "refuse") {
  throw new Error(
    `Refusing to run the integration suite: ${process.env.INTEGRATION_GATE_REASON}`,
  );
}

const ALL: CatalogScope = { kind: "all" };
/** A well-formed period nobody else uses, so the reports see only this run. */
const PERIOD = "2098-S1";
/** An actor id no account has: the audit insert fails with a foreign key error. */
const NO_SUCH_ACTOR = 9_000_000_000_000;
const FK_VIOLATION = "23503";
const UNIQUE_VIOLATION = "23505";
const APPROVE: DecisionInput = {
  tipo: "aprobada",
  plantilla: "aprobacion.general",
  texto: null,
};

type Settled<T> = { ok: true; value: T } | { ok: false; error: unknown };

/** A promise that never rejects, so a race cannot raise an unhandled rejection. */
function settle<T>(promise: Promise<T>): Promise<Settled<T>> {
  return promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

async function waiters(
  locktype: "advisory" | "transactionid",
): Promise<number> {
  const rows = (await db.execute(
    sql`select count(*)::int as n from pg_locks where locktype = ${locktype} and not granted`,
  )) as unknown as { n: number }[];
  return Number(rows[0].n);
}

/** Polls until `locktype` has at least `atLeast` waiting requests. */
async function waitForWaiters(
  locktype: "advisory" | "transactionid",
  atLeast: number,
  what: string,
): Promise<void> {
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    if ((await waiters(locktype)) >= atLeast) return;
    await sleep(25);
  }
  throw new Error(`Timed out waiting for ${what}`);
}

/**
 * A third connection that holds the catalog write lock until `release()`. The
 * writers started meanwhile queue behind it (CM-NFR-2).
 */
async function holdCatalogLock(): Promise<{ release: () => Promise<void> }> {
  let open!: () => void;
  const gateOpen = new Promise<void>((resolve) => (open = resolve));
  let held!: () => void;
  const ready = new Promise<void>((resolve) => (held = resolve));
  const holder = db.transaction(async (tx) => {
    await acquireCatalogWriteLock(tx);
    held();
    await gateOpen;
  });
  const settled = settle(holder);
  await Promise.race([ready, settled]);
  return {
    release: async () => {
      open();
      const outcome = await settled;
      if (!outcome.ok) throw outcome.error;
    },
  };
}

type EditInput = {
  nombreCompleto: string;
  correo: string;
  telefono: string | null;
};

const edit = (actorId: number, id: number, input: EditInput) =>
  withCatalogWrite(
    actorId,
    (tx) => updateDocente(tx, id, input),
    docenteWriteEvents,
  );

const toggle = (actorId: number, id: number, activo: boolean) =>
  withCatalogWrite(
    actorId,
    (tx) => setDocenteActivo(tx, id, activo),
    docenteWriteEvents,
  );

const unwrap = <T>(outcome: Settled<T>): T => {
  if (!outcome.ok) throw outcome.error;
  return outcome.value;
};

async function auditRows(entidadId: number, entidadTipo = "Usuario") {
  return db
    .select({
      accion: eventoAuditoria.accion,
      actorId: eventoAuditoria.actorId,
      datos: eventoAuditoria.datos,
    })
    .from(eventoAuditoria)
    .where(
      and(
        eq(eventoAuditoria.entidadTipo, entidadTipo),
        eq(eventoAuditoria.entidadId, entidadId),
      ),
    )
    .orderBy(asc(eventoAuditoria.id));
}

async function accountRow(id: number) {
  const [row] = await db.select().from(usuario).where(eq(usuario.id, id));
  return row;
}

const COUNTED: Record<string, PgTable> = {
  Usuario: usuario,
  Grupo: grupo,
  Asignatura: asignatura,
  Inscripcion: inscripcion,
  Solicitud: solicitud,
  SolicitudAsignatura: solicitudAsignatura,
  DocumentoRespaldo: documentoRespaldo,
  Remision: remision,
  SolicitudDecision: solicitudDecision,
  EventoAuditoria: eventoAuditoria,
};

async function rowCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const [name, table] of Object.entries(COUNTED)) {
    const [row] = await db.select({ n: count() }).from(table);
    counts[name] = row.n;
  }
  return counts;
}

/** Active grupos whose docente is inactive, among these docentes. */
async function activeGruposOfInactive(docenteIds: number[]): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(grupo)
    .innerJoin(usuario, eq(usuario.id, grupo.docenteId))
    .where(
      and(
        inArray(grupo.docenteId, docenteIds),
        eq(grupo.activo, true),
        eq(usuario.activo, false),
      ),
    );
  return row.n;
}

describe.skipIf(gate.mode !== "run")(
  "docente maintenance (real Postgres)",
  () => {
    const fixtures = createFixtures();
    let serial = 0;
    // "it-sc-" keeps these addresses apart from the fixture ones
    // ("it-docente-<run>-<n>"), whose counter is independent of `serial`.
    const mail = (label: string) =>
      `it-sc-${label}-${fixtures.run}-${++serial}@integration.invalid`;

    let actor: { id: number; facultadId: number };
    let before: Record<string, number>;

    beforeAll(async () => {
      // Fail fast and readable when the branch is unreachable or unmigrated.
      await db.select({ n: count() }).from(usuario);
      before = await rowCounts();
      actor = await fixtures.addSecretaria();
    });

    /** Grupos this file planted enrollments in: removed before the grupos. */
    const enrolledGroups: number[] = [];

    afterAll(async () => {
      // `fixtures.cleanup()` cannot delete enrollments (see its header), and a
      // grupo with one cannot be deleted.
      if (enrolledGroups.length > 0) {
        await db
          .delete(inscripcion)
          .where(inArray(inscripcion.grupoId, enrolledGroups));
      }
      await fixtures.cleanup();
    });

    /** Creates a staff account the way the form does and hands it over. */
    async function createStaff(
      actorId: number,
      data: {
        rol: RolUsuario;
        nombreCompleto: string;
        correo: string;
        telefono?: string | null;
        hashClave?: string;
        carreraId?: number | null;
        facultadId?: number | null;
      },
    ) {
      const created = await createStaffUsuario(actorId, {
        login: data.correo,
        hashClave: data.hashClave ?? "integration-not-a-real-hash",
        rol: data.rol,
        nombreCompleto: data.nombreCompleto,
        correo: data.correo,
        telefono: data.telefono ?? null,
        cif: null,
        carreraId: data.carreraId ?? null,
        facultadId: data.facultadId ?? null,
      });
      fixtures.adopt({ accounts: [created.id] });
      return created;
    }

    describe("SC-1: an edit is stored and nothing else changes (DM-3, DM-5)", () => {
      it("stores name, email and phone, keeps Login and HashClave byte-identical, writes one row, and sign-in follows the new email", async () => {
        const docente = await fixtures.addDocente({
          telefono: "555-0100",
        });
        const stored = await accountRow(docente.id);
        const correo = mail("new");

        const result = await edit(actor.id, docente.id, {
          nombreCompleto: `${docente.nombre} edited`,
          correo,
          telefono: "555-0200",
        });

        expect(result).toEqual({
          kind: "updated",
          id: docente.id,
          campos: ["nombreCompleto", "correo", "telefono"],
        });
        const after = await accountRow(docente.id);
        expect(after).toMatchObject({
          nombreCompleto: `${docente.nombre} edited`,
          correo,
          telefono: "555-0200",
        });
        // Everything else is byte-identical.
        expect({
          ...after,
          nombreCompleto: stored.nombreCompleto,
          correo: stored.correo,
          telefono: stored.telefono,
        }).toEqual(stored);
        expect(after.login).toBe(stored.login);
        expect(after.hashClave).toBe(stored.hashClave);

        const rows = await auditRows(docente.id);
        expect(rows).toEqual([
          {
            accion: "usuario.actualizado",
            actorId: actor.id,
            datos: {
              campos: ["nombreCompleto", "correo", "telefono"],
              rol: "docente",
              origen: "manual",
            },
          },
        ]);

        // Sign-in is by email (DM-5): the new one finds the account, the old
        // one finds nothing.
        expect((await findLoginAccount(correo))?.id).toBe(docente.id);
        expect(await findLoginAccount(docente.correo)).toBeNull();
      });

      it("keeps the account findable by its email through a deactivation and a reactivation, and the Login stays", async () => {
        const docente = await fixtures.addDocente();
        const login = (await accountRow(docente.id)).login;

        expect(await toggle(actor.id, docente.id, false)).toEqual({
          kind: "changed",
          id: docente.id,
          activo: false,
        });
        // The lookup still finds it; the sign-in refuses an inactive account.
        expect(await findLoginAccount(docente.correo)).toMatchObject({
          id: docente.id,
          activo: false,
        });

        expect(await toggle(actor.id, docente.id, true)).toEqual({
          kind: "changed",
          id: docente.id,
          activo: true,
        });
        expect(await findLoginAccount(docente.correo)).toMatchObject({
          id: docente.id,
          activo: true,
          rol: "docente",
        });
        expect((await accountRow(docente.id)).login).toBe(login);
      });

      it("an edit with no changed field writes nothing and no row; an inactive docente is refused", async () => {
        const docente = await fixtures.addDocente();

        expect(
          await edit(actor.id, docente.id, {
            nombreCompleto: docente.nombre,
            correo: docente.correo,
            telefono: null,
          }),
        ).toEqual({ kind: "unchanged", id: docente.id });
        expect(await auditRows(docente.id)).toEqual([]);

        await toggle(actor.id, docente.id, false);
        const inactiveRows = (await auditRows(docente.id)).length;
        expect(
          await edit(actor.id, docente.id, {
            nombreCompleto: "Refused",
            correo: docente.correo,
            telefono: null,
          }),
        ).toEqual({ kind: "inactive" });
        expect((await accountRow(docente.id)).nombreCompleto).toBe(
          docente.nombre,
        );
        expect((await auditRows(docente.id)).length).toBe(inactiveRows);
      });
    });

    describe("SC-2: the email is unique across every role, ignoring case (DM-4)", () => {
      it.each([
        ["an active docente", { rol: "docente" as const }],
        ["an inactive docente", { rol: "docente" as const, activo: false }],
        ["a student", { rol: "estudiante" as const }],
        ["a coordinacion", { rol: "coordinacion" as const }],
        ["a secretaria", { rol: "secretaria" as const }],
        ["an administrador", { rol: "administrador" as const }],
      ])(
        "refuses an email held by %s, with no change and no row",
        async (_label, holder) => {
          const docente = await fixtures.addDocente();
          const held = mail("held");
          await fixtures.addAccount({ ...holder, correo: held });

          const result = await edit(actor.id, docente.id, {
            nombreCompleto: `${docente.nombre} renamed`,
            correo: held,
            telefono: "555-0300",
          });

          expect(result).toEqual({ kind: "correo_taken" });
          const after = await accountRow(docente.id);
          expect(after.correo).toBe(docente.correo);
          expect(after.nombreCompleto).toBe(docente.nombre);
          expect(after.telefono).toBeNull();
          expect(await auditRows(docente.id)).toEqual([]);
        },
      );

      it("refuses an email another account stored in upper case, which the case-sensitive constraint does not see (legacy row)", async () => {
        const docente = await fixtures.addDocente();
        const held = mail("legacy");
        await fixtures.addAccount({
          rol: "estudiante",
          correo: held.toUpperCase(),
        });

        const result = await edit(actor.id, docente.id, {
          nombreCompleto: docente.nombre,
          correo: held,
          telefono: null,
        });

        expect(result).toEqual({ kind: "correo_taken" });
        expect((await accountRow(docente.id)).correo).toBe(docente.correo);
        expect(await auditRows(docente.id)).toEqual([]);
      });

      it("saves an email nobody holds, also when another account has no email at all", async () => {
        const docente = await fixtures.addDocente();
        await fixtures.addAccount({ rol: "docente" });
        const free = mail("free");

        const result = await edit(actor.id, docente.id, {
          nombreCompleto: docente.nombre,
          correo: free,
          telefono: null,
        });

        expect(result).toEqual({
          kind: "updated",
          id: docente.id,
          campos: ["correo"],
        });
        expect((await accountRow(docente.id)).correo).toBe(free);
      });

      it("re-saves an own mixed-case email as lower case and reports the field correo", async () => {
        const mixed = `Own.Mixed.${fixtures.run}.${++serial}@Integration.invalid`;
        const docente = await fixtures.addDocente({ correo: mixed });

        const result = await edit(actor.id, docente.id, {
          nombreCompleto: docente.nombre,
          correo: mixed.toLowerCase(),
          telefono: null,
        });

        expect(result).toEqual({
          kind: "updated",
          id: docente.id,
          campos: ["correo"],
        });
        expect((await accountRow(docente.id)).correo).toBe(mixed.toLowerCase());
        expect(await auditRows(docente.id)).toHaveLength(1);
      });

      it("a legacy case pair does not block an edit that leaves the email alone", async () => {
        const stored = mail("pair");
        const docente = await fixtures.addDocente({ correo: stored });
        await fixtures.addAccount({
          rol: "estudiante",
          correo: stored.toUpperCase(),
        });

        const result = await edit(actor.id, docente.id, {
          nombreCompleto: `${docente.nombre} renamed`,
          correo: stored,
          telefono: null,
        });

        expect(result).toEqual({
          kind: "updated",
          id: docente.id,
          campos: ["nombreCompleto"],
        });
      });
    });

    describe("SC-3: concurrent writers of one email (DM-4, A4)", () => {
      it("maps the unique violation of a concurrent insert to correo_taken, with nothing written and no audit row", async () => {
        const docente = await fixtures.addDocente();
        const target = mail("race");
        const [docenteRol] = await db
          .select({ id: rol.id })
          .from(rol)
          .where(eq(rol.codigo, "docente"));

        // Connection 1 inserts the email and holds its transaction open.
        let open!: () => void;
        const gateOpen = new Promise<void>((resolve) => (open = resolve));
        let inserted!: () => void;
        const ready = new Promise<void>((resolve) => (inserted = resolve));
        const holder = settle(
          db.transaction(async (tx) => {
            const [row] = await tx
              .insert(usuario)
              .values({
                login: `it-sc3-${fixtures.run}-${++serial}`,
                hashClave: "integration-not-a-real-hash",
                rolId: docenteRol.id,
                nombreCompleto: `IT holder ${fixtures.run}`,
                correo: target,
              })
              .returning({ id: usuario.id });
            fixtures.adopt({ accounts: [row.id] });
            inserted();
            await gateOpen;
          }),
        );
        await Promise.race([ready, holder]);

        // Connection 2 edits: its lookup cannot see the uncommitted row, so
        // only the unique index stops it, and it blocks on that row.
        const editing = settle(
          edit(actor.id, docente.id, {
            nombreCompleto: docente.nombre,
            correo: target,
            telefono: null,
          }),
        );
        await waitForWaiters(
          "transactionid",
          1,
          "the edit to wait on the uncommitted email",
        );
        open();

        const [held, edited] = await Promise.all([holder, editing]);

        expect(held.ok).toBe(true);
        expect(edited).toEqual({ ok: true, value: { kind: "correo_taken" } });
        expect((await accountRow(docente.id)).correo).toBe(docente.correo);
        expect(await auditRows(docente.id)).toEqual([]);
      });

      it("lets exactly one of an edit and a staff account creation of the same new email commit", async () => {
        const docente = await fixtures.addDocente();
        const target = mail("both");

        const [edited, created] = await Promise.all([
          settle(
            edit(actor.id, docente.id, {
              nombreCompleto: docente.nombre,
              correo: target,
              telefono: null,
            }),
          ),
          settle(
            createStaffUsuario(actor.id, {
              login: target,
              hashClave: "integration-not-a-real-hash",
              rol: "docente",
              nombreCompleto: `IT created ${fixtures.run}`,
              correo: target,
              telefono: null,
              cif: null,
              carreraId: null,
              facultadId: null,
            }),
          ),
        ]);
        if (created.ok) fixtures.adopt({ accounts: [created.value.id] });

        const editWon =
          edited.ok && edited.value.kind === "updated" && !created.ok;
        const createWon =
          created.ok && edited.ok && edited.value.kind === "correo_taken";
        expect(editWon || createWon).toBe(true);
        if (!created.ok)
          expect(sqlStateOf(created.error)).toBe(UNIQUE_VIOLATION);

        const [{ n }] = await db
          .select({ n: count() })
          .from(usuario)
          .where(eq(usuario.correo, target));
        expect(n).toBe(1);
        expect(
          (await auditRows(docente.id)).filter(
            (r) => r.accion === "usuario.actualizado",
          ),
        ).toHaveLength(editWon ? 1 : 0);
        if (created.ok) {
          expect(await auditRows(created.value.id)).toHaveLength(1);
        }
      });
    });

    describe("SC-4: the active-grupo block, both toggles and nothing else touched (DM-7, DM-8, DM-9, AC-MW)", () => {
      type GrupoSpec = {
        periodo?: string;
        activo?: boolean;
        subjectActive?: boolean;
        ofOther?: boolean;
      };

      async function docenteWith(specs: readonly GrupoSpec[]) {
        const docente = await fixtures.addDocente();
        const other = await fixtures.addDocente();
        let number = 0;
        for (const spec of specs) {
          const subject = await fixtures.addSubject({
            activo: spec.subjectActive,
          });
          await fixtures.addGroup({
            docenteId: spec.ofOther ? other.id : docente.id,
            asignaturaId: subject.id,
            periodo: spec.periodo,
            numeroGrupo: String(++number),
            activo: spec.activo,
          });
        }
        return docente;
      }

      it.each([
        ["no grupo", [], 0],
        [
          "five inactive grupos",
          Array.from({ length: 5 }, () => ({ activo: false })),
          0,
        ],
        [
          "four active grupos that name another docente",
          Array.from({ length: 4 }, () => ({ ofOther: true })),
          0,
        ],
        ["one active grupo of another period", [{ periodo: "2024-S1" }], 1],
        [
          "one active grupo under an inactive asignatura",
          [{ subjectActive: false }],
          1,
        ],
        ["three active grupos", [{}, {}, {}], 3],
        [
          "two active and five inactive grupos",
          [{}, {}, ...Array.from({ length: 5 }, () => ({ activo: false }))],
          2,
        ],
      ] as const)(
        "with %s the deactivation follows the count of active grupos",
        async (_label, specs, active) => {
          const docente = await docenteWith(specs);

          const outcome = await toggle(actor.id, docente.id, false);

          if (active === 0) {
            expect(outcome).toEqual({
              kind: "changed",
              id: docente.id,
              activo: false,
            });
            expect((await accountRow(docente.id)).activo).toBe(false);
            expect((await auditRows(docente.id)).map((r) => r.accion)).toEqual([
              "usuario.desactivado",
            ]);
          } else {
            expect(outcome).toEqual({
              kind: "has_active_groups",
              count: active,
            });
            expect((await accountRow(docente.id)).activo).toBe(true);
            expect(await auditRows(docente.id)).toEqual([]);
            expect((await getDocenteById(docente.id))?.gruposActivos).toBe(
              active,
            );
          }
        },
      );

      it("reads the count it refuses with from the same grupos the page reads (getDocenteById)", async () => {
        const docente = await docenteWith([{}, { periodo: "2024-S1" }]);

        expect(await getDocenteById(docente.id)).toEqual({
          id: docente.id,
          nombreCompleto: docente.nombre,
          correo: docente.correo,
          telefono: null,
          activo: true,
          gruposActivos: 2,
        });
      });

      it("toggles both ways with one row each, and a no-op or a refusal writes none", async () => {
        const docente = await fixtures.addDocente();

        expect(await toggle(actor.id, docente.id, true)).toEqual({
          kind: "unchanged",
          id: docente.id,
        });
        expect(await auditRows(docente.id)).toEqual([]);

        await toggle(actor.id, docente.id, false);
        expect(await toggle(actor.id, docente.id, false)).toEqual({
          kind: "unchanged",
          id: docente.id,
        });
        await toggle(actor.id, docente.id, true);
        expect(await toggle(actor.id, docente.id, true)).toEqual({
          kind: "unchanged",
          id: docente.id,
        });

        expect(await auditRows(docente.id)).toEqual([
          {
            accion: "usuario.desactivado",
            actorId: actor.id,
            datos: { campos: ["activo"], rol: "docente", origen: "manual" },
          },
          {
            accion: "usuario.reactivado",
            actorId: actor.id,
            datos: { campos: ["activo"], rol: "docente", origen: "manual" },
          },
        ]);
      });

      it("a deactivation touches no Grupo, Inscripcion, SolicitudAsignatura or remision row, and no other column", async () => {
        const docente = await fixtures.addDocente();
        const groups: number[] = [];
        for (let i = 1; i <= 2; i++) {
          groups.push(
            await fixtures.addGroup({
              docenteId: docente.id,
              periodo: PERIOD,
              numeroGrupo: String(i),
              activo: i !== 1,
            }),
          );
        }
        // Two filed requests and their remissions, on the grupo that is active.
        const scope = await resolveRequestScope(actor.id, "secretaria");
        const requests = [
          await fixtures.addSubmittedRequest(groups[1]),
          await fixtures.addSubmittedRequest(groups[1]),
        ];
        for (const request of requests) {
          const decided = await decideRequest({
            actorId: actor.id,
            scope,
            solicitudId: request.requestId,
            decision: APPROVE,
            now: new Date(),
          });
          expect(decided.ok).toBe(true);
        }
        // Enrollments in both grupos.
        const students = [
          await fixtures.addStudent(),
          await fixtures.addStudent(),
          await fixtures.addStudent(),
        ];
        enrolledGroups.push(...groups);
        for (const [i, student] of students.entries()) {
          await db
            .insert(inscripcion)
            .values({ estudianteId: student.id, grupoId: groups[i % 2] });
        }
        // The active grupo goes first: deactivation is refused until then.
        await withCatalogWrite(
          actor.id,
          (tx) => setGrupoActivo(tx, ALL, groups[1], false),
          grupoWriteEvents,
        );

        const snapshot = async () => ({
          grupos: await db
            .select()
            .from(grupo)
            .where(inArray(grupo.id, groups))
            .orderBy(asc(grupo.id)),
          inscripciones: await db
            .select()
            .from(inscripcion)
            .where(inArray(inscripcion.grupoId, groups))
            .orderBy(asc(inscripcion.estudianteId)),
          clases: await db
            .select()
            .from(solicitudAsignatura)
            .where(inArray(solicitudAsignatura.grupoId, groups))
            .orderBy(asc(solicitudAsignatura.solicitudId)),
          remisiones: await db
            .select()
            .from(remision)
            .where(eq(remision.docenteId, docente.id))
            .orderBy(asc(remision.id)),
          cuenta: await accountRow(docente.id),
        });
        const untouched = await snapshot();
        expect(untouched.remisiones).toHaveLength(2);
        expect(untouched.inscripciones).toHaveLength(3);

        const outcome = await toggle(actor.id, docente.id, false);

        expect(outcome).toMatchObject({ kind: "changed", activo: false });
        const after = await snapshot();
        expect({ ...after, cuenta: { ...after.cuenta, activo: true } }).toEqual(
          untouched,
        );
        expect(after.cuenta.activo).toBe(false);
      });

      it("reactivation reactivates no grupo and touches no other column", async () => {
        const docente = await fixtures.addDocente({ activo: false });
        const groupIds = [
          await fixtures.addGroup({
            docenteId: docente.id,
            activo: false,
            numeroGrupo: "1",
          }),
          await fixtures.addGroup({
            docenteId: docente.id,
            activo: false,
            numeroGrupo: "2",
          }),
        ];
        const stored = await accountRow(docente.id);

        const outcome = await toggle(actor.id, docente.id, true);

        expect(outcome).toEqual({
          kind: "changed",
          id: docente.id,
          activo: true,
        });
        expect({ ...(await accountRow(docente.id)), activo: false }).toEqual(
          stored,
        );
        const groups = await db
          .select({ activo: grupo.activo })
          .from(grupo)
          .where(inArray(grupo.id, groupIds));
        expect(groups).toEqual([{ activo: false }, { activo: false }]);
      });

      it("reassign the grupos to another docente, then deactivate: it succeeds and no active grupo names the docente", async () => {
        const docente = await fixtures.addDocente();
        const next = await fixtures.addDocente();
        const groupIds = [
          await fixtures.addGroup({ docenteId: docente.id, numeroGrupo: "1" }),
          await fixtures.addGroup({ docenteId: docente.id, numeroGrupo: "2" }),
        ];
        expect(await toggle(actor.id, docente.id, false)).toEqual({
          kind: "has_active_groups",
          count: 2,
        });

        for (const id of groupIds) {
          const moved = await withCatalogWrite(
            actor.id,
            (tx) => updateGrupo(tx, ALL, id, { docenteId: next.id, dias: [] }),
            grupoWriteEvents,
          );
          expect(moved).toMatchObject({ kind: "updated", id });
        }

        expect(await toggle(actor.id, docente.id, false)).toMatchObject({
          kind: "changed",
          activo: false,
        });
        expect(await activeGruposOfInactive([docente.id, next.id])).toBe(0);
      });

      it("deactivate the grupos, then the docente: it succeeds and both grupos stay inactive", async () => {
        const docente = await fixtures.addDocente();
        const groupIds = [
          await fixtures.addGroup({ docenteId: docente.id, numeroGrupo: "1" }),
          await fixtures.addGroup({ docenteId: docente.id, numeroGrupo: "2" }),
        ];
        for (const id of groupIds) {
          await withCatalogWrite(
            actor.id,
            (tx) => setGrupoActivo(tx, ALL, id, false),
            grupoWriteEvents,
          );
        }

        expect(await toggle(actor.id, docente.id, false)).toMatchObject({
          kind: "changed",
        });
        const groups = await db
          .select({ activo: grupo.activo })
          .from(grupo)
          .where(inArray(grupo.id, groupIds));
        expect(groups).toEqual([{ activo: false }, { activo: false }]);
      });

      it("a grupo whose reactivation was refused (inactive docente) can be reactivated once the docente is", async () => {
        const docente = await fixtures.addDocente();
        const groupId = await fixtures.addGroup({
          docenteId: docente.id,
          activo: false,
        });
        await toggle(actor.id, docente.id, false);
        const reactivate = () =>
          withCatalogWrite(
            actor.id,
            (tx) => setGrupoActivo(tx, ALL, groupId, true),
            grupoWriteEvents,
          );

        expect(await reactivate()).toEqual({ kind: "docente_unavailable" });

        await toggle(actor.id, docente.id, true);
        expect(await reactivate()).toEqual({
          kind: "changed",
          id: groupId,
          activo: true,
        });
      });
    });

    describe("SC-5: an id of another role is not a docente (DM-2, RN-02)", () => {
      it.each([
        "estudiante",
        "coordinacion",
        "secretaria",
        "administrador",
      ] as const)(
        "a %s id is null and not_found for the read, the edit and both toggles, and nothing changes",
        async (rolCode) => {
          const other = await fixtures.addAccount({
            rol: rolCode,
            correo: mail("other"),
          });
          const stored = await accountRow(other.id);

          expect(await getDocenteById(other.id)).toBeNull();
          expect(
            await edit(actor.id, other.id, {
              nombreCompleto: "Hijacked",
              correo: mail("hijack"),
              telefono: null,
            }),
          ).toEqual({ kind: "not_found" });
          expect(await toggle(actor.id, other.id, false)).toEqual({
            kind: "not_found",
          });
          expect(await toggle(actor.id, other.id, true)).toEqual({
            kind: "not_found",
          });

          expect(await accountRow(other.id)).toEqual(stored);
          expect(await auditRows(other.id)).toEqual([]);
        },
      );

      it("an id that does not exist is the same null and not_found", async () => {
        expect(await getDocenteById(NO_SUCH_ACTOR)).toBeNull();
        expect(await toggle(actor.id, NO_SUCH_ACTOR, false)).toEqual({
          kind: "not_found",
        });
      });
    });

    describe("SC-6: an audit insert that fails rolls everything back (DM-14)", () => {
      let errorLog: MockInstance;
      beforeAll(() => {
        errorLog = vi
          .spyOn(console, "error")
          .mockImplementation(() => undefined);
      });
      afterAll(() => errorLog.mockRestore());

      it("an edit by an actor that does not exist fails with a real foreign key error and leaves the docente unchanged", async () => {
        const docente = await fixtures.addDocente();
        const stored = await accountRow(docente.id);

        const outcome = await settle(
          edit(NO_SUCH_ACTOR, docente.id, {
            nombreCompleto: "Never stored",
            correo: mail("never"),
            telefono: "555-9999",
          }),
        );

        expect(outcome.ok).toBe(false);
        if (!outcome.ok) expect(sqlStateOf(outcome.error)).toBe(FK_VIOLATION);
        expect(await accountRow(docente.id)).toEqual(stored);
        expect(await auditRows(docente.id)).toEqual([]);
      });

      it.each([
        ["a deactivation", true],
        ["a reactivation", false],
      ] as const)(
        "%s by an actor that does not exist fails and leaves the state as it was",
        async (_label, startsActive) => {
          const docente = await fixtures.addDocente({ activo: startsActive });

          const outcome = await settle(
            toggle(NO_SUCH_ACTOR, docente.id, !startsActive),
          );

          expect(outcome.ok).toBe(false);
          if (!outcome.ok) expect(sqlStateOf(outcome.error)).toBe(FK_VIOLATION);
          expect((await accountRow(docente.id)).activo).toBe(startsActive);
          expect(await auditRows(docente.id)).toEqual([]);
        },
      );

      it("a staff account creation by an actor that does not exist leaves no account", async () => {
        const correo = mail("orphan");

        const outcome = await settle(
          createStaffUsuario(NO_SUCH_ACTOR, {
            login: correo,
            hashClave: "integration-not-a-real-hash",
            rol: "docente",
            nombreCompleto: `IT orphan ${fixtures.run}`,
            correo,
            telefono: null,
            cif: null,
            carreraId: null,
            facultadId: null,
          }),
        );

        expect(outcome.ok).toBe(false);
        if (!outcome.ok) expect(sqlStateOf(outcome.error)).toBe(FK_VIOLATION);
        const accounts = await db
          .select({ id: usuario.id })
          .from(usuario)
          .where(eq(usuario.correo, correo));
        expect(accounts).toEqual([]);
      });
    });

    describe("SC-7: writes are serialised with every catalog writer (DM-10, AC-MW)", () => {
      type Outcome = { kind: string; count?: number };
      type Writer = {
        /** What the other writer runs. */
        run: () => Promise<Outcome>;
        /** The kind it answers when it went first and wrote. */
        wrote: string;
        /** The kind it answers when the deactivation went first. */
        refused: string;
      };

      const writers: Record<string, (docenteId: number) => Promise<Writer>> = {
        "create an active grupo naming the docente": async (docenteId) => {
          const subject = await fixtures.addSubject();
          return {
            wrote: "created",
            refused: "docente_unavailable",
            run: async () => {
              const result = await withCatalogWrite(
                actor.id,
                (tx) =>
                  createGrupo(tx, ALL, {
                    asignaturaId: subject.id,
                    periodo: "IT",
                    numeroGrupo: "1",
                    docenteId,
                    dias: [],
                  }),
                grupoWriteEvents,
              );
              if (result.kind === "created") {
                fixtures.adopt({ grupos: [result.id] });
              }
              return result;
            },
          };
        },
        "change the docente of an active grupo to the docente": async (
          docenteId,
        ) => {
          const holder = await fixtures.addDocente();
          const groupId = await fixtures.addGroup({ docenteId: holder.id });
          return {
            wrote: "updated",
            refused: "docente_unavailable",
            run: () =>
              withCatalogWrite(
                actor.id,
                (tx) => updateGrupo(tx, ALL, groupId, { docenteId, dias: [] }),
                grupoWriteEvents,
              ),
          };
        },
        "reactivate an inactive grupo naming the docente": async (
          docenteId,
        ) => {
          const groupId = await fixtures.addGroup({
            docenteId,
            activo: false,
          });
          return {
            wrote: "changed",
            refused: "docente_unavailable",
            run: () =>
              withCatalogWrite(
                actor.id,
                (tx) => setGrupoActivo(tx, ALL, groupId, true),
                grupoWriteEvents,
              ),
          };
        },
      };

      const ROUNDS = 2;

      const cases: [string, "deactivation first" | "grupo write first"][] =
        Object.keys(writers).flatMap((name) => [
          [name, "deactivation first"],
          [name, "grupo write first"],
        ]);

      it.each(cases)(
        "%s, started with the lock held by a third connection, %s in the queue: exactly one wins and no active grupo ends under an inactive docente",
        async (name, order) => {
          for (let round = 0; round < ROUNDS; round++) {
            const docente = await fixtures.addDocente();
            const writer = await writers[name](docente.id);
            const deactivate = (): Promise<Outcome> =>
              toggle(actor.id, docente.id, false);
            const [first, second] =
              order === "deactivation first"
                ? [deactivate, writer.run]
                : [writer.run, deactivate];

            const holder = await holdCatalogLock();
            const a = settle(first());
            await waitForWaiters("advisory", 1, "the first writer to queue");
            const b = settle(second());
            await waitForWaiters("advisory", 2, "the second writer to queue");
            await holder.release();
            const outcomes = [await a, await b];
            const byWriter =
              order === "deactivation first"
                ? { deactivation: outcomes[0], grupo: outcomes[1] }
                : { deactivation: outcomes[1], grupo: outcomes[0] };

            const deactivation = unwrap(byWriter.deactivation);
            const grupoWrite = unwrap(byWriter.grupo);
            const grupoWon = grupoWrite.kind === writer.wrote;
            const deactivationWon = deactivation.kind === "changed";
            // Exactly one wins; the other one is refused for that reason.
            expect(grupoWon).not.toBe(deactivationWon);
            if (grupoWon) {
              expect(deactivation).toEqual({
                kind: "has_active_groups",
                count: 1,
              });
            } else {
              expect(grupoWrite.kind).toBe(writer.refused);
            }
            expect(await activeGruposOfInactive([docente.id])).toBe(0);
            expect(
              (await auditRows(docente.id)).filter(
                (r) => r.accion === "usuario.desactivado",
              ),
            ).toHaveLength(deactivationWon ? 1 : 0);
          }
        },
      );

      it("many create-versus-deactivate rounds started together never leave an active grupo under an inactive docente", async () => {
        const docentes: number[] = [];
        for (let round = 0; round < 12; round++) {
          const docente = await fixtures.addDocente();
          const subject = await fixtures.addSubject();
          docentes.push(docente.id);

          const [created, deactivated] = await Promise.all([
            settle(
              withCatalogWrite(
                actor.id,
                (tx) =>
                  createGrupo(tx, ALL, {
                    asignaturaId: subject.id,
                    periodo: "IT",
                    numeroGrupo: "1",
                    docenteId: docente.id,
                    dias: [],
                  }),
                grupoWriteEvents,
              ),
            ),
            settle(toggle(actor.id, docente.id, false)),
          ]);

          const grupoResult = unwrap(created);
          if (grupoResult.kind === "created") {
            fixtures.adopt({ grupos: [grupoResult.id] });
          }
          const toggled = unwrap(deactivated);
          expect(
            (grupoResult.kind === "created") !== (toggled.kind === "changed"),
          ).toBe(true);
        }

        expect(await activeGruposOfInactive(docentes)).toBe(0);
      });

      it("two edits of one docente: the later commit is stored and two audit rows exist", async () => {
        const docente = await fixtures.addDocente();
        const second = await fixtures.addSecretaria();
        const names = new Map([
          [actor.id, `First writer ${fixtures.run}`],
          [second.id, `Second writer ${fixtures.run}`],
        ]);

        const outcomes = await Promise.all(
          [actor.id, second.id].map((id) =>
            settle(
              edit(id, docente.id, {
                nombreCompleto: names.get(id) as string,
                correo: docente.correo,
                telefono: null,
              }),
            ),
          ),
        );

        for (const outcome of outcomes) {
          expect(unwrap(outcome)).toMatchObject({
            kind: "updated",
            campos: ["nombreCompleto"],
          });
        }
        const rows = await auditRows(docente.id);
        expect(rows.map((r) => r.accion)).toEqual([
          "usuario.actualizado",
          "usuario.actualizado",
        ]);
        // The last row written belongs to the writer that committed last.
        const last = rows[rows.length - 1];
        expect((await accountRow(docente.id)).nombreCompleto).toBe(
          names.get(last.actorId),
        );
      });

      it("two deactivations of one docente: one writes the change and one row, the other says nothing changed", async () => {
        const docente = await fixtures.addDocente();

        const outcomes = await Promise.all([
          settle(toggle(actor.id, docente.id, false)),
          settle(toggle(actor.id, docente.id, false)),
        ]);

        expect(outcomes.map((o) => unwrap(o).kind).sort()).toEqual([
          "changed",
          "unchanged",
        ]);
        expect((await auditRows(docente.id)).map((r) => r.accion)).toEqual([
          "usuario.desactivado",
        ]);
      });

      it.each([
        ["an edit", "edit", true],
        ["a deactivation", "deactivate", true],
        ["a reactivation", "reactivate", false],
      ] as const)(
        "%s that cannot start within the bounded wait is busy: nothing is saved and no row is written",
        async (_label, operation, startsActive) => {
          const docente = await fixtures.addDocente({ activo: startsActive });
          const stored = await accountRow(docente.id);
          const run = (): Promise<{ kind: string }> => {
            if (operation === "edit") {
              return edit(actor.id, docente.id, {
                nombreCompleto: "Never saved",
                correo: docente.correo,
                telefono: null,
              });
            }
            return toggle(actor.id, docente.id, operation === "reactivate");
          };

          const holder = await holdCatalogLock();
          const outcome = await settle(run());
          await holder.release();

          expect(outcome.ok).toBe(false);
          if (!outcome.ok)
            expect(outcome.error).toBeInstanceOf(CatalogBusyError);
          expect(await accountRow(docente.id)).toEqual(stored);
          expect(await auditRows(docente.id)).toEqual([]);
        },
      );
    });

    describe("SC-8: one usuario.creado per staff role, field names only (SAC-AUD-1)", () => {
      it.each([
        ["docente", "secretaria"],
        ["coordinacion", "administrador"],
        ["secretaria", "coordinacion"],
      ] as const)(
        "creating a %s as a %s writes exactly one row with the creator as actor, origin manual and no value",
        async (created, creator) => {
          const coordinator = await fixtures.addCoordinator();
          const creatorId =
            creator === "secretaria"
              ? actor.id
              : creator === "coordinacion"
                ? coordinator.id
                : (await fixtures.addAccount({ rol: "administrador" })).id;
          const correo = mail(created);
          const nombre = `IT ${created} ${fixtures.run}`;

          const account = await createStaff(creatorId, {
            rol: created,
            nombreCompleto: nombre,
            correo,
            telefono: "555-0700",
            carreraId:
              created === "coordinacion" ? coordinator.carreraId : null,
            facultadId: created === "secretaria" ? actor.facultadId : null,
          });

          expect(account).toMatchObject({ rol: created, correo, activo: true });
          const rows = await auditRows(account.id);
          expect(rows).toEqual([
            {
              accion: "usuario.creado",
              actorId: creatorId,
              datos: {
                campos: [...AUDITABLE_USER_FIELDS],
                rol: created,
                origen: "manual",
              },
            },
          ]);
          const payload = JSON.stringify(rows);
          for (const value of [nombre, correo, "555-0700"]) {
            expect(payload).not.toContain(value);
          }
        },
      );

      it("a Login equal to a former email refuses the insert and writes no account and no row", async () => {
        const old = mail("former");
        const first = await createStaff(actor.id, {
          rol: "docente",
          nombreCompleto: `IT former ${fixtures.run}`,
          correo: old,
        });
        const renamed = mail("current");
        await edit(actor.id, first.id, {
          nombreCompleto: first.nombreCompleto,
          correo: renamed,
          telefono: null,
        });
        const rowsBefore = await rowCounts();

        const outcome = await settle(
          createStaffUsuario(actor.id, {
            login: old,
            hashClave: "integration-not-a-real-hash",
            rol: "docente",
            nombreCompleto: `IT again ${fixtures.run}`,
            correo: old,
            telefono: null,
            cif: null,
            carreraId: null,
            facultadId: null,
          }),
        );

        expect(outcome.ok).toBe(false);
        if (!outcome.ok)
          expect(sqlStateOf(outcome.error)).toBe(UNIQUE_VIOLATION);
        const afterCounts = await rowCounts();
        expect(afterCounts.Usuario).toBe(rowsBefore.Usuario);
        expect(afterCounts.EventoAuditoria).toBe(rowsBefore.EventoAuditoria);
        expect((await accountRow(first.id)).correo).toBe(renamed);
      });
    });

    describe("SC-9: the import over real rows, planned only (DM-13, CEI-VAL)", () => {
      const grupoRow = (codigo: string, correo: string) => ({
        CodigoAsignatura: codigo,
        Periodo: PERIOD,
        NumGrupo: "1",
        CorreoDocente: correo,
      });

      it("a Grupos row of an inactive docente is docente.inactive, and the Docentes row of the same workbook is an update", async () => {
        const docente = await fixtures.addDocente({ activo: false });
        const subject = await fixtures.addSubject();

        const plan = planImport(
          makeWorkbook({
            docentes: [
              { Correo: docente.correo, Nombre: "Name in the workbook" },
            ],
            grupos: [grupoRow(subject.codigo, docente.correo)],
          }),
          await loadCatalogSnapshot(db),
        );

        expect(plan.ok).toBe(false);
        expect(plan.errors).toEqual([
          {
            sheet: "Grupos",
            row: 2,
            reason: "docente.inactive",
            value: docente.correo,
          },
        ]);
        expect(plan.counts.Usuario).toMatchObject({ update: 1, error: 0 });
        expect(plan.counts.Grupo).toMatchObject({ error: 1, create: 0 });
        expect(plan.writes.grupos).toEqual([]);
        expect(plan.writes.usuarios[0]).not.toHaveProperty("activo");
      });

      it("the old email of an edited docente is login.collision and creates nothing; the new email is unchanged", async () => {
        const old = mail("old");
        const account = await createStaff(actor.id, {
          rol: "docente",
          nombreCompleto: `IT renamed ${fixtures.run}`,
          correo: old,
        });
        const renamed = mail("renamed");
        await edit(actor.id, account.id, {
          nombreCompleto: account.nombreCompleto,
          correo: renamed,
          telefono: null,
        });

        const plan = planImport(
          makeWorkbook({
            docentes: [
              { Correo: old, Nombre: "Someone else" },
              { Correo: renamed, Nombre: account.nombreCompleto },
            ],
          }),
          await loadCatalogSnapshot(db),
        );

        expect(plan.errors).toEqual([
          { sheet: "Docentes", row: 2, reason: "login.collision", value: old },
        ]);
        expect(plan.counts.Usuario).toMatchObject({
          create: 0,
          unchanged: 1,
          error: 1,
        });
        expect(plan.writes.usuarios).toEqual([]);
        expect(plan.accountsToCreate).toBe(0);
      });

      it("a confirm after a deactivation is rejected with docente.inactive and every row count is unchanged", async () => {
        const docente = await fixtures.addDocente();
        const subject = await fixtures.addSubject();
        const workbook = makeWorkbook({
          grupos: [grupoRow(subject.codigo, docente.correo)],
        });
        // The preview was clean: the docente was active.
        expect(planImport(workbook, await loadCatalogSnapshot(db)).ok).toBe(
          true,
        );
        expect(await toggle(actor.id, docente.id, false)).toMatchObject({
          kind: "changed",
        });
        // Guard of this suite: it never applies an import with effect, which
        // would deactivate every grupo of the branch the workbook does not list.
        const replanned = planImport(workbook, await loadCatalogSnapshot(db));
        expect(replanned.ok).toBe(false);
        const countsBefore = await rowCounts();

        const outcome = await settle(
          runImportApply({
            db,
            parsed: workbook,
            sha256: "0".repeat(64),
            actor: { id: actor.id, login: "it-actor" },
            hash: async () => {
              throw new Error("no account may be provisioned");
            },
            generate: () => {
              throw new Error("no password may be generated");
            },
          }),
        );

        expect(outcome.ok).toBe(false);
        if (!outcome.ok) {
          expect(outcome.error).toBeInstanceOf(ImportRejectedError);
          expect((outcome.error as ImportRejectedError).errors).toEqual([
            {
              sheet: "Grupos",
              row: 2,
              reason: "docente.inactive",
              value: docente.correo,
            },
          ]);
        }
        expect(await rowCounts()).toEqual(countsBefore);
        expect((await accountRow(docente.id)).activo).toBe(false);
      });
    });

    describe("SC-10 and SC-13: remissions keep their snapshot, readers show the live name (DM-11, DM-12)", () => {
      /**
       * R1 is approved for a grupo of docente T, then T is renamed and moves to
       * a new email, then R2 is approved for the same grupo.
       */
      async function twoRemissions() {
        const docente = await fixtures.addDocente();
        const groupId = await fixtures.addGroup({
          docenteId: docente.id,
          periodo: PERIOD,
        });
        const scope = await resolveRequestScope(actor.id, "secretaria");
        const approve = async (requestId: number) => {
          const decided = await decideRequest({
            actorId: actor.id,
            scope,
            solicitudId: requestId,
            decision: APPROVE,
            now: new Date(),
          });
          if (!decided.ok) throw new Error("approval failed");
          expect(decided.remisionIds).toHaveLength(1);
          const [row] = await db
            .select()
            .from(remision)
            .where(eq(remision.id, decided.remisionIds[0]));
          return row;
        };

        const r1 = await fixtures.addSubmittedRequest(groupId);
        const remission1 = await approve(r1.requestId);
        const detail1 = await getRequestDetail(scope, r1.requestId);

        const renamed = {
          nombreCompleto: `IT Docente renamed ${fixtures.run}-${++serial}`,
          correo: mail("renamed"),
        };
        expect(
          await edit(actor.id, docente.id, { ...renamed, telefono: null }),
        ).toMatchObject({ kind: "updated" });

        const r2 = await fixtures.addSubmittedRequest(groupId);
        const remission2 = await approve(r2.requestId);
        return {
          docente,
          groupId,
          scope,
          renamed,
          r1,
          r2,
          remission1,
          remission2,
          detail1,
        };
      }

      it("an email and name edit leaves the existing remission as written, and the next approval reads the new data", async () => {
        const s = await twoRemissions();

        // R1 keeps the snapshot of the approval: old name, old email, pending.
        const [r1Now] = await db
          .select()
          .from(remision)
          .where(eq(remision.id, s.remission1.id));
        expect(r1Now).toEqual(s.remission1);
        expect(r1Now).toMatchObject({
          docenteId: s.docente.id,
          docenteNombre: s.docente.nombre,
          correo: s.docente.correo,
          estado: "pendiente",
        });
        // R2 is addressed to the new email with the current name. (The mail
        // draft itself carries no teacher name; the remision row does.)
        expect(s.remission2).toMatchObject({
          docenteId: s.docente.id,
          docenteNombre: s.renamed.nombreCompleto,
          correo: s.renamed.correo,
          estado: "pendiente",
        });
      });

      it("a pending remission is still sent to its snapshot address after the grupo and the docente are deactivated, and the next one goes to the new address", async () => {
        const s = await twoRemissions();
        await withCatalogWrite(
          actor.id,
          (tx) => setGrupoActivo(tx, ALL, s.groupId, false),
          grupoWriteEvents,
        );
        expect(await toggle(actor.id, s.docente.id, false)).toMatchObject({
          kind: "changed",
        });

        const store = createFakeDocumentStore();
        store.seed(s.r1.pathname, PDF_BYTES);
        store.seed(s.r2.pathname, PDF_BYTES);
        const sender = createFakeMailSender();
        const deps = { store, mail: sender };
        const options = {
          trigger: "reenvio_manual",
          actorId: actor.id,
        } as const;

        expect(await dispatchRemission(s.remission1.id, options, deps)).toEqual(
          {
            outcome: "sent",
          },
        );
        expect(sender.sent[0].to).toBe(s.docente.correo);
        const [r1Row] = await db
          .select({ estado: remision.estado, correo: remision.correo })
          .from(remision)
          .where(eq(remision.id, s.remission1.id));
        expect(r1Row).toEqual({ estado: "enviada", correo: s.docente.correo });

        expect(await dispatchRemission(s.remission2.id, options, deps)).toEqual(
          {
            outcome: "sent",
          },
        );
        expect(sender.sent[1].to).toBe(s.renamed.correo);
        expect(sender.sent).toHaveLength(2);
      });

      it("the staff detail and the teachers ranking show the live name after a rename and a deactivation, and nothing else of the request changes", async () => {
        const s = await twoRemissions();
        await withCatalogWrite(
          actor.id,
          (tx) => setGrupoActivo(tx, ALL, s.groupId, false),
          grupoWriteEvents,
        );
        await toggle(actor.id, s.docente.id, false);

        const detail = await getRequestDetail(s.scope, s.r1.requestId);

        expect(s.detail1).not.toBeNull();
        expect(detail).not.toBeNull();
        expect(detail?.clases.map((c) => c.docenteNombre)).toEqual([
          s.renamed.nombreCompleto,
        ]);
        expect(s.detail1?.clases.map((c) => c.docenteNombre)).toEqual([
          s.docente.nombre,
        ]);
        // The request, its classes and its documents are otherwise the same.
        expect(detail).toEqual({
          ...s.detail1,
          clases: s.detail1?.clases.map((c) => ({
            ...c,
            docenteNombre: s.renamed.nombreCompleto,
          })),
        });
        expect(detail?.documentos).toHaveLength(1);

        const coordinator = await fixtures.addCoordinator();
        const dashboard = await loadReportDashboard(
          { kind: "carrera", carreraId: coordinator.carreraId },
          { kind: "code", periodo: PERIOD },
        );
        expect(dashboard.degraded).toBe(false);
        expect(
          dashboard.rankings.docentes.find((d) => d.id === s.docente.id),
        ).toEqual({
          id: s.docente.id,
          name: s.renamed.nombreCompleto,
          total: 2,
        });
      });
    });

    describe("SC-11: no value reaches an audit payload or a logged line (DM-15, SAC-AUD-1)", () => {
      const logs: MockInstance[] = [];
      afterEach(() => {
        for (const spy of logs.splice(0)) spy.mockRestore();
      });

      it("searches every payload and every logged line of an edit, a deactivation, a reactivation, a forced failure and every staff creation for the values and for the hash", async () => {
        const lines: string[] = [];
        for (const method of ["error", "warn", "info", "log"] as const) {
          logs.push(
            vi.spyOn(console, method).mockImplementation((...args) => {
              lines.push(args.map((a) => String(a)).join(" "));
            }),
          );
        }
        const run = fixtures.run;
        const password = `Sentinel-Passw0rd-${run}`;
        const hashClave = await hashPassword(password);
        const sentinels = {
          oldName: `Sentinel Name ${run}`,
          oldEmail: `sentinel-old-${run}@integration.invalid`,
          oldPhone: "555-0001",
          newName: `Other Name ${run}`,
          newEmail: `sentinel-new-${run}@integration.invalid`,
          newPhone: "555-0002",
          failedName: `Failed Name ${run}`,
        };

        const docente = await createStaff(actor.id, {
          rol: "docente",
          nombreCompleto: sentinels.oldName,
          correo: sentinels.oldEmail,
          telefono: sentinels.oldPhone,
          hashClave,
        });
        await edit(actor.id, docente.id, {
          nombreCompleto: sentinels.newName,
          correo: sentinels.newEmail,
          telefono: sentinels.newPhone,
        });
        await toggle(actor.id, docente.id, false);
        await toggle(actor.id, docente.id, true);
        const failed = await settle(
          edit(NO_SUCH_ACTOR, docente.id, {
            nombreCompleto: sentinels.failedName,
            correo: sentinels.newEmail,
            telefono: sentinels.newPhone,
          }),
        );
        expect(failed.ok).toBe(false);

        const coordinator = await fixtures.addCoordinator();
        const staff = [
          await createStaff(actor.id, {
            rol: "docente",
            nombreCompleto: `Sentinel Docente ${run}`,
            correo: `sentinel-docente-${run}@integration.invalid`,
            telefono: "555-0003",
            hashClave,
          }),
          await createStaff(actor.id, {
            rol: "coordinacion",
            nombreCompleto: `Sentinel Coordinacion ${run}`,
            correo: `sentinel-coord-${run}@integration.invalid`,
            telefono: "555-0004",
            hashClave,
            carreraId: coordinator.carreraId,
          }),
          await createStaff(coordinator.id, {
            rol: "secretaria",
            nombreCompleto: `Sentinel Secretaria ${run}`,
            correo: `sentinel-sec-${run}@integration.invalid`,
            telefono: "555-0005",
            hashClave,
            facultadId: actor.facultadId,
          }),
        ];

        const payloads: string[] = [];
        for (const id of [docente.id, ...staff.map((s) => s.id)]) {
          payloads.push(JSON.stringify(await auditRows(id)));
        }
        const haystacks = [...payloads, ...lines];
        expect(payloads).toHaveLength(4);
        expect(lines.length).toBeGreaterThan(0);

        const values = [
          ...Object.values(sentinels),
          `Sentinel Docente ${run}`,
          `sentinel-docente-${run}@integration.invalid`,
          "555-0003",
          `Sentinel Coordinacion ${run}`,
          `sentinel-coord-${run}@integration.invalid`,
          "555-0004",
          `Sentinel Secretaria ${run}`,
          `sentinel-sec-${run}@integration.invalid`,
          "555-0005",
          password,
          hashClave,
          "HashClave",
        ];
        for (const haystack of haystacks) {
          for (const value of values) {
            expect(haystack).not.toContain(value);
          }
          expect(haystack).not.toMatch(/\$2[aby]\$\d{2}\$/);
        }
        // The failure line is the sanitised one: actor, error name, SQLSTATE.
        const failure = lines.find((line) =>
          line.includes("catalog.write.failed"),
        );
        expect(failure).toBeDefined();
        expect(JSON.parse(failure as string)).toMatchObject({
          event: "catalog.write.failed",
          actor: NO_SUCH_ACTOR,
          errorCode: FK_VIOLATION,
        });
      });
    });

    describe("SC-12: nothing is deleted (DM-18)", () => {
      it("the row count of every table is no lower than before the whole sequence", async () => {
        const after = await rowCounts();

        for (const [table, was] of Object.entries(before)) {
          expect(after[table], table).toBeGreaterThanOrEqual(was);
        }
      });
    });
  },
);
