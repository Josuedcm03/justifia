import { and, asc, eq, gt, max, sql } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";

import { db } from "@/db";
import { eventoAuditoria } from "@/db/audit-schema";
import { documentoRespaldo, parametroNormativo, solicitud } from "@/db/schema";
import { parameterWriteEvents } from "@/lib/audit/events";
import {
  acquireCatalogWriteLock,
  CatalogBusyError,
  sqlStateOf,
  withCatalogWrite,
} from "@/lib/data/catalog-write";
import { createFixtures } from "@/lib/data/integration/fixtures";
import { resolveRequestScope } from "@/lib/data/request-scope";
import { getRequestDetail } from "@/lib/data/solicitud-detail";
import {
  dropKey,
  putRow,
  refusal,
  restoreSeeds,
  SEED_DATE,
  seedValue,
  STRING_TOO_LONG,
  UNIQUE_VIOLATION,
} from "@/lib/data/integration/normative-parameters-support";
import { addDays, managuaToday } from "@/lib/intake/dates";
import { loadNormativeParameters, readInForce } from "@/lib/parameters/loader";
import {
  DEFAULT_PARAMETERS,
  PARAMETER_KEYS,
  PARAMETER_REGISTRY,
  type ParameterChange,
  type ParameterKey,
} from "@/lib/parameters/registry";
import { writeParameters } from "@/lib/parameters/write";

// Real-Postgres suite of the normative parameters (RNF-14). It runs
// the REAL loader against the REAL table, so the database, not JavaScript,
// decides each constraint and each "newest row not after today" choice:
//   PG-1  one row per key and day, a key of at most 60 characters, and the nine
//         seed rows of migration 0017 read back equal to the code defaults
//   PG-3  (read part) the row in force is the newest one not after today in
//         Managua; an invalid row, a deleted row or a future row gives the
//         default of that key only; an unknown key is ignored
// The second describe, "write side", runs the REAL write path inside the REAL
// `withCatalogWrite` with its audit rows:
//   PG-3  (write part) a first save keeps the seed row, a same-day second save
//         leaves one row, a save on another day adds one
//   PG-4  one audit row per changed key in the same transaction; none for an
//         unchanged save, a failed audit insert or a busy lock; `antes` of a
//         same-day second save is the first `despues`; no description leaks
//   PG-5  a stored document and a stored `PlazoInicioEn` are untouched by a
//         later change of the limit or of the calendar
//
// HOW TO RUN (never part of `npm test`; owner-run, phase 14):
//   1. Create a DISPOSABLE Neon branch of the project with migration
//      `0017_normative_parameters` applied (a schema command: the owner's yes).
//   2. INTEGRATION_DATABASE_URL=<branch url> INTEGRATION_ALLOW_WRITES=1 \
//        npm run test:integration -- normative-parameters
// Without INTEGRATION_DATABASE_URL the file is skipped. With it but without
// INTEGRATION_ALLOW_WRITES=1, or with a URL equal to DATABASE_URL, or one whose
// host or database name contains "prod", the run fails on purpose.
//
// Residue: after every case the table is back to its seed rows (rows dated after
// the seed date and rows of unknown keys are deleted, a deleted seed row is put
// back). A seed row that is still there is never overwritten, so the first run
// on a fresh branch proves what the migration really stored.

// Decided by vitest.integration.setup.ts before it replaced DATABASE_URL.
const gate = { mode: process.env.INTEGRATION_GATE_MODE ?? "skip" };
if (gate.mode === "refuse") {
  throw new Error(
    `Refusing to run the integration suite: ${process.env.INTEGRATION_GATE_REASON}`,
  );
}

// A fixed instant: 21:00 of 2026-11-27 in Managua, already 2026-11-28 in UTC.
// Every case reads with it, so the Managua date (not the UTC one) is what counts
// and no case depends on the clock of the machine.
const NOW = new Date("2026-11-28T03:00:00.000Z");
const TODAY = "2026-11-27";
const at = (offset: number): string => addDays(TODAY, offset);

const UNIQUE_CONSTRAINT = "UQ_ParametroNormativo_Clave_Vigencia";
const SCRATCH_KEY = "zz_suite_scratch";
const SENTINEL = "SENTINEL-STORED-VALUE-7731";

const SCALARS = [
  "plazo_remision_dias",
  "alerta_dias",
  "presentacion_tardia_dias",
  "ventana_presentacion_dias",
  "umbral_reincidencia",
  "tamano_maximo_mib",
] as const satisfies readonly ParameterKey[];

/** A valid, non-default value per scalar, so a key that leaks shows up. */
const OTHER_VALUES: Record<(typeof SCALARS)[number], number> = {
  plazo_remision_dias: 4,
  alerta_dias: 3,
  presentacion_tardia_dias: 5,
  ventana_presentacion_dias: 15,
  umbral_reincidencia: 6,
  tamano_maximo_mib: 7,
};

type Row = { offset: number; valor: unknown };

describe.skipIf(gate.mode !== "run")(
  "normative parameters, read side (real Postgres)",
  () => {
    let errorLog: MockInstance;

    beforeEach(() => {
      // The loader logs every fallback; the cases read those lines back.
      errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(async () => {
      errorLog.mockRestore();
      await restoreSeeds();
    });

    afterAll(async () => {
      await restoreSeeds();
    });

    /** The sanitised lines the loader wrote, parsed. */
    function logged(): Record<string, string>[] {
      return errorLog.mock.calls.map(
        ([line]) => JSON.parse(String(line)) as Record<string, string>,
      );
    }

    describe("PG-1: the table and its seeds (NP-1, NP-16)", () => {
      it("holds the nine seed rows of the migration, equal to the code defaults", async () => {
        const rows = await db
          .select()
          .from(parametroNormativo)
          .orderBy(asc(parametroNormativo.clave));

        // Compared as sets: the collation of the branch decides the SQL order.
        expect(rows.map((row) => row.clave).sort()).toEqual(
          [...PARAMETER_KEYS].sort(),
        );
        for (const row of rows) {
          expect(row.vigenteDesde).toBe(SEED_DATE);
          expect(row.valor).toEqual(seedValue(row.clave as ParameterKey));
        }
      });

      it("reads every key from its stored row, with no fallback", async () => {
        const read = await loadNormativeParameters(NOW);

        expect(read.values).toEqual(DEFAULT_PARAMETERS);
        expect(read.fallback).toEqual([]);
        expect(read.degraded).toBe(false);
        expect(logged()).toEqual([]);
      });

      it("refuses a second row for the same key and day, and accepts another day", async () => {
        await putRow(SCRATCH_KEY, 1, at(0));

        const duplicate = await refusal(() => putRow(SCRATCH_KEY, 2, at(0)));
        expect(duplicate).toEqual({
          code: UNIQUE_VIOLATION,
          constraint: UNIQUE_CONSTRAINT,
        });

        await putRow(SCRATCH_KEY, 2, at(1));
        const stored = await db
          .select({ vigenteDesde: parametroNormativo.vigenteDesde })
          .from(parametroNormativo)
          .where(eq(parametroNormativo.clave, SCRATCH_KEY))
          .orderBy(asc(parametroNormativo.vigenteDesde));
        expect(stored.map((row) => row.vigenteDesde)).toEqual([at(0), at(1)]);
      });

      it("refuses a second row for a seeded key on the seed day", async () => {
        const duplicate = await refusal(() =>
          putRow("umbral_reincidencia", 9, SEED_DATE),
        );

        expect(duplicate).toEqual({
          code: UNIQUE_VIOLATION,
          constraint: UNIQUE_CONSTRAINT,
        });
      });

      it("refuses a key of 61 characters and accepts one of 60", async () => {
        const tooLong = await refusal(() => putRow("k".repeat(61), 1, at(0)));
        expect(tooLong.code).toBe(STRING_TOO_LONG);

        await putRow("k".repeat(60), 1, at(0));
        const stored = await db
          .select({ clave: parametroNormativo.clave })
          .from(parametroNormativo)
          .where(eq(parametroNormativo.vigenteDesde, at(0)));
        expect(stored.map((row) => row.clave.length)).toEqual([60]);
      });
    });

    describe("PG-3 read part: the row in force (NP-3, NP-4)", () => {
      it("reads the newest row not after today, ignoring older and future rows", async () => {
        await putRow("umbral_reincidencia", 2, at(-10));
        await putRow("umbral_reincidencia", 4, at(-1));
        await putRow("umbral_reincidencia", 6, at(1));

        const read = await loadNormativeParameters(NOW);

        expect(read.values.issuerRecurrenceThreshold).toBe(4);
        expect(read.fallback).toEqual([]);
      });

      it("counts a row dated today as in force", async () => {
        await putRow("ventana_presentacion_dias", 45, at(0));

        const read = await loadNormativeParameters(NOW);

        expect(read.values.filingWindowDays).toBe(45);
      });

      it("judges today by the Managua date, not the UTC date", async () => {
        expect(managuaToday(NOW)).toBe(TODAY);
        // The UTC date of NOW is already tomorrow in Managua terms.
        await putRow("alerta_dias", 0, at(1));

        const read = await loadNormativeParameters(NOW);

        expect(read.values.alertBusinessDays).toBe(
          DEFAULT_PARAMETERS.alertBusinessDays,
        );
        const next = await loadNormativeParameters(
          new Date("2026-11-28T07:00:00.000Z"),
        );
        expect(next.values.alertBusinessDays).toBe(0);
      });

      it("serves one row per key, newest first, in one statement", async () => {
        await putRow("umbral_reincidencia", 2, at(-10));
        await putRow("umbral_reincidencia", 4, at(-1));
        await putRow("tamano_maximo_mib", 8, at(-1));
        await putRow("tamano_maximo_mib", 9, at(2));

        const rows = await readInForce(db, TODAY);

        expect(rows.map((row) => row.clave).sort()).toEqual(
          [...PARAMETER_KEYS].sort(),
        );
        const byKey = new Map(rows.map((row) => [row.clave, row.valor]));
        expect(byKey.get("umbral_reincidencia")).toBe(4);
        expect(byKey.get("tamano_maximo_mib")).toBe(8);
      });

      describe("per-key outcome (NP-4 table)", () => {
        const CASES: {
          name: string;
          key: (typeof SCALARS)[number];
          rows: Row[];
          dropSeed?: boolean;
          expected: number;
          fellBack: boolean;
        }[] = [
          {
            name: "a valid row in force gives that value",
            key: "tamano_maximo_mib",
            rows: [{ offset: -1, valor: 8 }],
            expected: 8,
            fellBack: false,
          },
          {
            name: "no row gives the default",
            key: "alerta_dias",
            rows: [],
            dropSeed: true,
            expected: 1,
            fellBack: true,
          },
          {
            name: "a row out of range (99 MiB) gives the default",
            key: "tamano_maximo_mib",
            rows: [{ offset: -1, valor: 99 }],
            expected: 10,
            fellBack: true,
          },
          {
            name: 'a row of the wrong type ("tres") gives the default',
            key: "umbral_reincidencia",
            rows: [{ offset: -1, valor: "tres" }],
            expected: 3,
            fellBack: true,
          },
          {
            name: "an invalid newest row with an older valid one gives the default, not the older row",
            key: "tamano_maximo_mib",
            rows: [
              { offset: -10, valor: 7 },
              { offset: -1, valor: 99 },
            ],
            expected: 10,
            fellBack: true,
          },
          {
            name: "only a row dated tomorrow gives the default",
            key: "umbral_reincidencia",
            rows: [{ offset: 1, valor: 6 }],
            dropSeed: true,
            expected: 3,
            fellBack: true,
          },
        ];

        it.each(CASES)(
          "$name; the other keys keep their own rows",
          async ({ key, rows, dropSeed, expected, fellBack }) => {
            const others = SCALARS.filter((other) => other !== key);
            for (const other of others) {
              await putRow(other, OTHER_VALUES[other], at(-1));
            }
            if (dropSeed) await dropKey(key);
            for (const row of rows)
              await putRow(key, row.valor, at(row.offset));

            const read = await loadNormativeParameters(NOW);

            const field = (k: ParameterKey) => PARAMETER_REGISTRY[k].field;
            expect(read.values[field(key)]).toBe(expected);
            expect(read.fallback).toEqual(fellBack ? [key] : []);
            for (const other of others) {
              expect(read.values[field(other)]).toBe(OTHER_VALUES[other]);
            }
          },
        );
      });

      describe("structured keys", () => {
        const REVERSED = DEFAULT_PARAMETERS.causes.map((cause, index) => ({
          ...cause,
          posicion: DEFAULT_PARAMETERS.causes.length - index,
          activa: index !== 0,
        }));

        const CASES: {
          name: string;
          key: ParameterKey;
          valor: unknown;
          expected: unknown;
          fellBack: boolean;
        }[] = [
          {
            name: "a valid calendar is read sorted by date",
            key: "calendario",
            valor: [
              { fecha: "2026-12-31", descripcion: null },
              { fecha: "2026-12-30", descripcion: "Cierre" },
            ],
            expected: [
              { fecha: "2026-12-30", descripcion: "Cierre" },
              { fecha: "2026-12-31", descripcion: null },
            ],
            fellBack: false,
          },
          {
            name: "a calendar with a repeated date gives the default",
            key: "calendario",
            valor: [
              { fecha: "2026-12-30", descripcion: null },
              { fecha: "2026-12-30", descripcion: null },
            ],
            expected: DEFAULT_PARAMETERS.nonWorkingDays,
            fellBack: true,
          },
          {
            name: "reordered causes are read by position, with an inactive one kept",
            key: "causas",
            valor: REVERSED,
            expected: [...REVERSED].sort((a, b) => a.posicion - b.posicion),
            fellBack: false,
          },
          {
            name: "causes that are all inactive give the default",
            key: "causas",
            valor: DEFAULT_PARAMETERS.causes.map((cause) => ({
              ...cause,
              activa: false,
            })),
            expected: DEFAULT_PARAMETERS.causes,
            fellBack: true,
          },
          {
            name: "a flipped map cell is read as stored",
            key: "tipo_documento_causa",
            valor: {
              constancia_medica: ["medica"],
              constancia_institucional:
                DEFAULT_PARAMETERS.documentTypeCauses.constancia_institucional,
              otro: [],
            },
            expected: {
              constancia_medica: ["medica"],
              constancia_institucional:
                DEFAULT_PARAMETERS.documentTypeCauses.constancia_institucional,
              otro: [],
            },
            fellBack: false,
          },
          {
            name: "a map that gives otro a cause gives the default",
            key: "tipo_documento_causa",
            valor: {
              constancia_medica: ["medica"],
              constancia_institucional: [],
              otro: ["medica"],
            },
            expected: DEFAULT_PARAMETERS.documentTypeCauses,
            fellBack: true,
          },
        ];

        it.each(CASES)("$name", async ({ key, valor, expected, fellBack }) => {
          await putRow(key, valor, at(-1));

          const read = await loadNormativeParameters(NOW);

          expect(read.values[PARAMETER_REGISTRY[key].field]).toEqual(expected);
          expect(read.fallback).toEqual(fellBack ? [key] : []);
        });
      });

      it("ignores a row of a key outside the registry", async () => {
        await putRow("otra_cosa", 7, at(-1));

        const read = await loadNormativeParameters(NOW);

        expect(Object.keys(read.values).sort()).toEqual(
          Object.keys(DEFAULT_PARAMETERS).sort(),
        );
        expect(read.values).toEqual(DEFAULT_PARAMETERS);
        expect(read.fallback).toEqual([]);
        expect(logged()).toEqual([]);
      });

      it("logs the key and a code of a fallback, never the stored value", async () => {
        await putRow("tamano_maximo_mib", SENTINEL, at(-1));
        await dropKey("alerta_dias");

        await loadNormativeParameters(NOW);

        expect(logged()).toEqual(
          expect.arrayContaining([
            {
              event: "parameter_invalid",
              clave: "tamano_maximo_mib",
              code: "invalid_type",
            },
            {
              event: "parameter_invalid",
              clave: "alerta_dias",
              code: "no_row",
            },
          ]),
        );
        expect(JSON.stringify(errorLog.mock.calls)).not.toContain(SENTINEL);
      });
    });
  },
);

/** An actor id no account has: the audit insert fails with a foreign key error. */
const NO_SUCH_ACTOR = 9_000_000_000_000;
const FK_VIOLATION = "23503";
const SENTINEL_DESCRIPTION = "SENTINEL-DESCRIPTION-5521";
const EIGHT_MIB = 8 * 1_048_576;

const save = (
  actorId: number,
  changes: readonly ParameterChange[],
  today: string = TODAY,
) =>
  withCatalogWrite(
    actorId,
    (tx) => writeParameters(tx, changes, today),
    parameterWriteEvents,
  );

/** The error a promise rejects with, or null when it resolves. */
const rejection = (work: Promise<unknown>): Promise<unknown> =>
  work.then(
    () => null,
    (error: unknown) => error,
  );

async function lastAuditId(): Promise<number> {
  const [row] = await db
    .select({ id: max(eventoAuditoria.id) })
    .from(eventoAuditoria);
  return row.id ?? 0;
}

/** The parameter audit rows written after `afterId`, oldest first. */
async function parameterAudit(afterId: number) {
  return db
    .select({
      accion: eventoAuditoria.accion,
      actorId: eventoAuditoria.actorId,
      entidadTipo: eventoAuditoria.entidadTipo,
      entidadId: eventoAuditoria.entidadId,
      datos: eventoAuditoria.datos,
    })
    .from(eventoAuditoria)
    .where(
      and(
        eq(eventoAuditoria.entidadTipo, "Parametro"),
        gt(eventoAuditoria.id, afterId),
      ),
    )
    .orderBy(asc(eventoAuditoria.id));
}

async function rowsOf(clave: ParameterKey) {
  return db
    .select({
      vigenteDesde: parametroNormativo.vigenteDesde,
      valor: parametroNormativo.valor,
    })
    .from(parametroNormativo)
    .where(eq(parametroNormativo.clave, clave))
    .orderBy(asc(parametroNormativo.vigenteDesde));
}

/** A third connection that holds the catalog write lock until `release()`. */
async function holdCatalogLock(): Promise<{ release: () => Promise<void> }> {
  let open!: () => void;
  const gateOpen = new Promise<void>((resolve) => (open = resolve));
  let held!: () => void;
  const ready = new Promise<void>((resolve) => (held = resolve));
  const settled = rejection(
    db.transaction(async (tx) => {
      await acquireCatalogWriteLock(tx);
      held();
      await gateOpen;
    }),
  );
  await Promise.race([ready, settled]);
  return {
    release: async () => {
      open();
      const error = await settled;
      if (error !== null) throw error;
    },
  };
}

describe.skipIf(gate.mode !== "run")(
  "normative parameters, write side (real Postgres)",
  () => {
    const fixtures = createFixtures();
    let actor: { id: number; facultadId: number };

    beforeAll(async () => {
      actor = await fixtures.addSecretaria();
    });

    afterEach(async () => {
      await restoreSeeds();
    });

    afterAll(async () => {
      await restoreSeeds();
      await fixtures.cleanup();
    });

    describe("PG-3 write part: effective from today, history kept (NP-3)", () => {
      it("keeps the seed row on a first save and adds the row of today", async () => {
        const result = await save(actor.id, [
          { clave: "umbral_reincidencia", valor: 2 },
        ]);

        expect(result.kind).toBe("updated");
        expect(await rowsOf("umbral_reincidencia")).toEqual([
          { vigenteDesde: SEED_DATE, valor: 3 },
          { vigenteDesde: TODAY, valor: 2 },
        ]);
      });

      it("replaces the row of today on a same-day second save", async () => {
        await save(actor.id, [{ clave: "umbral_reincidencia", valor: 2 }]);
        await save(actor.id, [{ clave: "umbral_reincidencia", valor: 4 }]);

        expect(await rowsOf("umbral_reincidencia")).toEqual([
          { vigenteDesde: SEED_DATE, valor: 3 },
          { vigenteDesde: TODAY, valor: 4 },
        ]);
      });

      it("adds a row on another day and keeps the earlier one", async () => {
        await save(
          actor.id,
          [{ clave: "umbral_reincidencia", valor: 2 }],
          at(-1),
        );
        await save(actor.id, [{ clave: "umbral_reincidencia", valor: 4 }]);

        expect(await rowsOf("umbral_reincidencia")).toEqual([
          { vigenteDesde: SEED_DATE, valor: 3 },
          { vigenteDesde: at(-1), valor: 2 },
          { vigenteDesde: TODAY, valor: 4 },
        ]);
      });

      it("is seen by the next read of the loader (NP-5)", async () => {
        await save(actor.id, [{ clave: "alerta_dias", valor: 0 }]);

        const read = await loadNormativeParameters(NOW);

        expect(read.values.alertBusinessDays).toBe(0);
      });
    });

    describe("PG-4: one audit row per changed key, same transaction (NP-9, NP-AUD-2, NP-AUD-3)", () => {
      it("writes two parameter rows and two audit rows for two keys in one save", async () => {
        const before = await lastAuditId();

        await save(actor.id, [
          { clave: "alerta_dias", valor: 0 },
          { clave: "umbral_reincidencia", valor: 4 },
        ]);

        expect(await parameterAudit(before)).toEqual([
          {
            accion: "parametro.actualizado",
            actorId: actor.id,
            entidadTipo: "Parametro",
            entidadId: null,
            datos: { clave: "alerta_dias", antes: 1, despues: 0 },
          },
          {
            accion: "parametro.actualizado",
            actorId: actor.id,
            entidadTipo: "Parametro",
            entidadId: null,
            datos: { clave: "umbral_reincidencia", antes: 3, despues: 4 },
          },
        ]);
        expect(await rowsOf("alerta_dias")).toHaveLength(2);
        expect(await rowsOf("umbral_reincidencia")).toHaveLength(2);
      });

      it("writes no row at all for a value equal to the one in force", async () => {
        const before = await lastAuditId();

        const result = await save(actor.id, [
          { clave: "umbral_reincidencia", valor: 3 },
        ]);

        expect(result).toEqual({ kind: "unchanged" });
        expect(await parameterAudit(before)).toEqual([]);
        expect(await rowsOf("umbral_reincidencia")).toEqual([
          { vigenteDesde: SEED_DATE, valor: 3 },
        ]);
      });

      it("leaves no parameter row when the audit insert fails", async () => {
        const before = await lastAuditId();

        const error = await rejection(
          save(NO_SUCH_ACTOR, [{ clave: "umbral_reincidencia", valor: 2 }]),
        );

        expect(sqlStateOf(error)).toBe(FK_VIOLATION);
        expect(await parameterAudit(before)).toEqual([]);
        expect(await rowsOf("umbral_reincidencia")).toEqual([
          { vigenteDesde: SEED_DATE, valor: 3 },
        ]);
      });

      it("is busy while a third connection holds the lock, and writes nothing", async () => {
        const before = await lastAuditId();

        const holder = await holdCatalogLock();
        const error = await rejection(
          save(actor.id, [{ clave: "umbral_reincidencia", valor: 2 }]),
        );
        await holder.release();

        expect(error).toBeInstanceOf(CatalogBusyError);
        expect(await parameterAudit(before)).toEqual([]);
        expect(await rowsOf("umbral_reincidencia")).toEqual([
          { vigenteDesde: SEED_DATE, valor: 3 },
        ]);
      });

      it("shows the first save as the before of a same-day second save", async () => {
        const before = await lastAuditId();

        await save(actor.id, [{ clave: "umbral_reincidencia", valor: 2 }]);
        await save(actor.id, [{ clave: "umbral_reincidencia", valor: 4 }]);

        expect((await parameterAudit(before)).map((row) => row.datos)).toEqual([
          { clave: "umbral_reincidencia", antes: 3, despues: 2 },
          { clave: "umbral_reincidencia", antes: 2, despues: 4 },
        ]);
      });

      it("keeps a calendar description out of every payload", async () => {
        const before = await lastAuditId();

        await save(actor.id, [
          {
            clave: "calendario",
            valor: [{ fecha: "2026-12-25", descripcion: SENTINEL_DESCRIPTION }],
          },
        ]);

        const rows = await parameterAudit(before);
        expect(rows).toHaveLength(1);
        expect(JSON.stringify(rows)).not.toContain(SENTINEL_DESCRIPTION);
        // The description is stored with the parameter row, which is not audit.
        expect(JSON.stringify(await rowsOf("calendario"))).toContain(
          SENTINEL_DESCRIPTION,
        );
      });
    });

    describe("PG-5: stored data is not rewritten by a later change (NP-13)", () => {
      it("still lists an 8 MiB document after the limit is lowered to 5", async () => {
        const group = await fixtures.addGroup();
        const request = await fixtures.addSubmittedRequest(group);
        await db
          .update(documentoRespaldo)
          .set({ tamanoBytes: EIGHT_MIB })
          .where(eq(documentoRespaldo.pathname, request.pathname));

        await save(actor.id, [{ clave: "tamano_maximo_mib", valor: 5 }]);

        const read = await loadNormativeParameters(NOW);
        expect(read.values.maxDocumentMib).toBe(5);
        const scope = await resolveRequestScope(actor.id, "secretaria");
        const detail = await getRequestDetail(scope, request.requestId);
        expect(detail?.documentos.map((doc) => doc.tamanoBytes)).toEqual([
          EIGHT_MIB,
        ]);
      });

      it("leaves a stored PlazoInicioEn byte-identical after a calendar change", async () => {
        const group = await fixtures.addGroup();
        const request = await fixtures.addSubmittedRequest(group);
        await db
          .update(solicitud)
          .set({ plazoInicioEn: new Date("2099-01-01T12:34:56.789Z") })
          .where(eq(solicitud.id, request.requestId));
        const stored = async () => {
          const [row] = await db
            .select({ text: sql<string>`${solicitud.plazoInicioEn}::text` })
            .from(solicitud)
            .where(eq(solicitud.id, request.requestId));
          return row.text;
        };
        const before = await stored();

        await save(actor.id, [
          {
            clave: "calendario",
            valor: [{ fecha: "2026-12-24", descripcion: null }],
          },
        ]);

        expect(await stored()).toBe(before);
      });
    });
  },
);
