import { readFileSync } from "node:fs";
import path from "node:path";

import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/lib/data/catalog", () => ({ loadCatalogSnapshot: vi.fn() }));
vi.mock("@/lib/data/catalog-write", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data/catalog-write")>()),
  acquireCatalogWriteLock: vi.fn(),
}));

import { eventoAuditoria } from "@/db/audit-schema";
import { asignatura, grupo, rol, usuario } from "@/db/schema";
import { loadCatalogSnapshot } from "@/lib/data/catalog";
import {
  acquireCatalogWriteLock,
  CatalogBusyError,
} from "@/lib/data/catalog-write";
import type { Transaction } from "@/lib/data/audit";
import { WRITE_CHUNK_ROWS } from "@/lib/import/limits";
import {
  applyImport,
  ImportRejectedError,
  runImportApply,
  type ApplyContext,
  type ProvisionedAccount,
} from "@/lib/import/apply";
import {
  CARRERA,
  makeSnapshot,
  makeWorkbook,
} from "@/lib/import/__fixtures__/plan-fixtures";
import type {
  EntityCounts,
  ImportPlan,
  ImportWrites,
} from "@/lib/import/types";

// ---------------------------------------------------------------------------
// Hand-rolled recording `tx` double. Ids are sequential from 1000 in the order
// the statements are issued, so the expected ids below are deterministic.
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;
type Statement = {
  op: "insert" | "update" | "delete";
  table: unknown;
  values?: Row[];
  set?: Row;
  where?: Parameters<PgDialect["sqlToQuery"]>[0];
};

function makeTx(
  roleRows: { id: number }[] = [{ id: 9 }],
  failOn: (s: Statement) => boolean = () => false,
) {
  const buffer: Statement[] = [];
  let nextId = 1000;
  const record = (s: Statement) => {
    if (failOn(s)) throw new Error("boom");
    buffer.push(s);
  };
  const tx = {
    insert(table: unknown) {
      return {
        values(input: Row | Row[]) {
          const values = Array.isArray(input) ? input : [input];
          record({ op: "insert", table, values });
          return Object.assign(Promise.resolve(), {
            returning: async (cols: Row) =>
              values.map((v) => ({
                id: nextId++,
                ...Object.fromEntries(
                  Object.keys(cols)
                    .filter((k) => k !== "id")
                    .map((k) => [k, v[k]]),
                ),
              })),
          });
        },
      };
    },
    update(table: unknown) {
      return {
        set(set: Row) {
          return {
            where(where: Statement["where"]) {
              record({ op: "update", table, set, where });
              return Promise.resolve();
            },
          };
        },
      };
    },
    delete(table: unknown) {
      record({ op: "delete", table });
      return { where: () => Promise.resolve() };
    },
    select() {
      return {
        from(table: unknown) {
          const rows = table === rol ? roleRows : [];
          const chain = {
            where: () => chain,
            limit: () => chain,
            then: (
              res: (v: unknown) => unknown,
              rej?: (e: unknown) => unknown,
            ) => Promise.resolve(rows).then(res, rej),
          };
          return chain;
        },
      };
    },
  };
  return { tx: tx as unknown as Transaction, buffer };
}

const TABLE_NAME = new Map<unknown, string>([
  [asignatura, "Asignatura"],
  [usuario, "Usuario"],
  [grupo, "Grupo"],
  [eventoAuditoria, "Audit"],
]);
const label = (s: Statement) => `${s.op}:${TABLE_NAME.get(s.table)}`;
const entityStatements = (buffer: Statement[]) =>
  buffer.filter((s) => s.table !== eventoAuditoria);
const paramsOf = (s: Statement) => new PgDialect().sqlToQuery(s.where!).params;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const zero = (): EntityCounts => ({
  create: 0,
  update: 0,
  unchanged: 0,
  deactivate: 0,
  error: 0,
});

function makePlan(
  writes: Partial<ImportWrites> = {},
  deactivateGrupoIds: number[] = [],
  overrides: Partial<ImportPlan> = {},
): ImportPlan {
  return {
    ok: true,
    errors: [],
    counts: { Asignatura: zero(), Usuario: zero(), Grupo: zero() },
    accountsToCreate: (writes.usuarios ?? []).filter((u) => u.kind === "create")
      .length,
    writes: {
      asignaturas: writes.asignaturas ?? [],
      usuarios: writes.usuarios ?? [],
      grupos: writes.grupos ?? [],
    },
    deactivateGrupoIds,
    asignaturasToReactivate: 0,
    manualGruposToDeactivate: 0,
    ...overrides,
  };
}

const snapshot = makeSnapshot({
  asignaturas: [
    {
      id: 10,
      codigo: "MAT1",
      nombre: "Matematica",
      carreraId: 1,
      horasTotales: 60,
      activo: true,
    },
  ],
  usuarios: [
    {
      id: 20,
      login: "ana@uni.edu",
      correo: "ana@uni.edu",
      cif: null,
      nombreCompleto: "Ana",
      telefono: null,
      carreraId: null,
      activo: true,
      rol: "docente",
    },
    {
      id: 21,
      login: "inactiva@uni.edu",
      correo: "inactiva@uni.edu",
      cif: null,
      nombreCompleto: "Inactiva",
      telefono: null,
      carreraId: null,
      activo: false,
      rol: "docente",
    },
  ],
});

const ctx: ApplyContext = {
  snapshot,
  actorId: 7,
  actor: "secretaria1",
  at: "2026-10-03T12:00:00.000Z",
  fileSha256: "f".repeat(64),
};

const nuevaCuenta: ProvisionedAccount = {
  login: "nueva@uni.edu",
  nombreCompleto: "Nueva",
  clave: "PLAINTEXTCLAVE123",
  hashClave: "$2b$12$hashed",
};

const createUsuario = {
  kind: "create" as const,
  correo: "nueva@uni.edu",
  login: "nueva@uni.edu",
  nombreCompleto: "Nueva",
  telefono: null,
};

// ---------------------------------------------------------------------------
// 7.11 - entity writer
// ---------------------------------------------------------------------------

describe("applyImport - entity writes (CEI: All-or-nothing apply)", () => {
  it("throws before the first statement when plan.ok is false", async () => {
    const { tx, buffer } = makeTx();
    const plan = makePlan({ asignaturas: [] }, [], {
      ok: false,
      errors: [{ sheet: "Grupos", row: 2, reason: "x" }],
    });
    await expect(applyImport(tx, plan, [], ctx)).rejects.toThrow();
    expect(buffer).toHaveLength(0);
  });

  it("issues Asignatura -> Usuario -> Grupo -> deactivations, in that order", async () => {
    const { tx, buffer } = makeTx();
    const plan = makePlan(
      {
        asignaturas: [
          {
            kind: "create",
            codigo: "FIS1",
            nombre: "Fisica",
            carreraId: 1,
            horasTotales: 48,
          },
          {
            kind: "update",
            id: 10,
            nombre: "Matematica I",
            carreraId: 1,
            horasTotales: 64,
          },
        ],
        usuarios: [
          createUsuario,
          {
            kind: "update",
            id: 20,
            nombreCompleto: "Ana B",
            telefono: "555",
            changedFields: ["nombreCompleto", "telefono"],
          },
        ],
        grupos: [
          {
            kind: "create",
            asignaturaCodigo: "FIS1",
            periodo: "2026-1",
            numeroGrupo: "1",
            docenteCorreo: "nueva@uni.edu",
          },
          {
            kind: "update",
            id: 300,
            docenteCorreo: "ana@uni.edu",
            reactivated: false,
          },
        ],
      },
      [301],
    );
    await applyImport(tx, plan, [nuevaCuenta], ctx);
    expect(entityStatements(buffer).map(label)).toEqual([
      "insert:Asignatura",
      "update:Asignatura",
      "insert:Usuario",
      "update:Usuario",
      "insert:Grupo",
      "update:Grupo",
      "update:Grupo",
    ]);
  });

  it("writes only the planned Asignatura fields", async () => {
    const { tx, buffer } = makeTx();
    await applyImport(
      tx,
      makePlan({
        asignaturas: [
          {
            kind: "create",
            codigo: "FIS1",
            nombre: "Fisica",
            carreraId: 1,
            horasTotales: 48,
          },
          {
            kind: "update",
            id: 10,
            nombre: "Matematica I",
            carreraId: 2,
            horasTotales: 64,
          },
        ],
      }),
      [],
      ctx,
    );
    expect(buffer[0].values).toEqual([
      { codigo: "FIS1", nombre: "Fisica", carreraId: 1, horasTotales: 48 },
    ]);
    expect(buffer[1].set).toEqual({
      nombre: "Matematica I",
      carreraId: 2,
      horasTotales: 64,
    });
    expect(paramsOf(buffer[1])).toContain(10);
  });

  it("creates docentes with the supplied hash and the resolved role id", async () => {
    const { tx, buffer } = makeTx([{ id: 9 }]);
    await applyImport(
      tx,
      makePlan({ usuarios: [createUsuario] }),
      [nuevaCuenta],
      ctx,
    );
    const writes = entityStatements(buffer);
    expect(writes).toHaveLength(1);
    expect(writes[0].values).toEqual([
      {
        login: "nueva@uni.edu",
        correo: "nueva@uni.edu",
        nombreCompleto: "Nueva",
        telefono: null,
        hashClave: "$2b$12$hashed",
        rolId: 9,
        debeCambiarClave: true,
      },
    ]);
  });

  it("never writes a plaintext password anywhere", async () => {
    const { tx, buffer } = makeTx();
    await applyImport(
      tx,
      makePlan({ usuarios: [createUsuario] }),
      [nuevaCuenta],
      ctx,
    );
    expect(JSON.stringify(buffer.map((s) => s.values ?? s.set))).not.toContain(
      nuevaCuenta.clave,
    );
  });

  it("fails loudly when a planned new account has no credential", async () => {
    const { tx, buffer } = makeTx();
    await expect(
      applyImport(tx, makePlan({ usuarios: [createUsuario] }), [], ctx),
    ).rejects.toThrow(/nueva@uni\.edu/);
    expect(buffer).toHaveLength(0);
  });

  it("fails loudly when the docente role does not exist", async () => {
    const { tx } = makeTx([]);
    await expect(
      applyImport(
        tx,
        makePlan({ usuarios: [createUsuario] }),
        [nuevaCuenta],
        ctx,
      ),
    ).rejects.toThrow(/docente/);
  });

  it("updates existing accounts without touching HashClave, login or activo (IAP: keep credentials)", async () => {
    const { tx, buffer } = makeTx();
    await applyImport(
      tx,
      makePlan({
        usuarios: [
          {
            kind: "update",
            id: 21,
            nombreCompleto: "Inactiva B",
            telefono: "1",
            changedFields: ["nombreCompleto", "telefono"],
          },
        ],
      }),
      [],
      ctx,
    );
    const writes = entityStatements(buffer);
    expect(writes).toHaveLength(1);
    expect(writes[0].op).toBe("update");
    expect(writes[0].set).toEqual({
      nombreCompleto: "Inactiva B",
      telefono: "1",
    });
    expect(paramsOf(writes[0])).toContain(21);
  });

  it("resolves group references from created ids and the snapshot", async () => {
    const { tx, buffer } = makeTx();
    await applyImport(
      tx,
      makePlan({
        asignaturas: [
          {
            kind: "create",
            codigo: "FIS1",
            nombre: "Fisica",
            carreraId: 1,
            horasTotales: 48,
          },
        ],
        usuarios: [createUsuario],
        grupos: [
          {
            kind: "create",
            asignaturaCodigo: "FIS1", // created -> id 1000
            periodo: "2026-1",
            numeroGrupo: "1",
            docenteCorreo: "ana@uni.edu", // snapshot -> id 20
          },
          {
            kind: "create",
            asignaturaCodigo: "MAT1", // snapshot -> id 10
            periodo: "2026-1",
            numeroGrupo: "2",
            docenteCorreo: "nueva@uni.edu", // created -> id 1001
          },
        ],
      }),
      [nuevaCuenta],
      ctx,
    );
    const grupos = buffer.find((s) => s.table === grupo)!;
    expect(grupos.values).toEqual([
      {
        asignaturaId: 1000,
        periodo: "2026-1",
        numeroGrupo: "1",
        docenteId: 20,
      },
      {
        asignaturaId: 10,
        periodo: "2026-1",
        numeroGrupo: "2",
        docenteId: 1001,
      },
    ]);
  });

  it("throws on an unresolved group reference", async () => {
    const { tx } = makeTx();
    const plan = makePlan({
      grupos: [
        {
          kind: "create",
          asignaturaCodigo: "NOPE",
          periodo: "2026-1",
          numeroGrupo: "1",
          docenteCorreo: "ana@uni.edu",
        },
      ],
    });
    await expect(applyImport(tx, plan, [], ctx)).rejects.toThrow(/NOPE/);
  });

  it("reactivation writes Activo = true; a plain reassignment does not", async () => {
    const { tx, buffer } = makeTx();
    await applyImport(
      tx,
      makePlan({
        grupos: [
          {
            kind: "update",
            id: 300,
            docenteCorreo: "ana@uni.edu",
            reactivated: true,
          },
          {
            kind: "update",
            id: 301,
            docenteCorreo: "ana@uni.edu",
            reactivated: false,
          },
        ],
      }),
      [],
      ctx,
    );
    expect(buffer[0].set).toEqual({ docenteId: 20, activo: true });
    expect(paramsOf(buffer[0])).toContain(300);
    expect(buffer[1].set).toEqual({ docenteId: 20 });
  });

  it("deactivates the planned groups with Activo = false (Nothing is ever deleted)", async () => {
    const { tx, buffer } = makeTx();
    await applyImport(tx, makePlan({}, [5, 6, 7]), [], ctx);
    const deactivations = entityStatements(buffer);
    expect(deactivations).toHaveLength(1);
    expect(label(deactivations[0])).toBe("update:Grupo");
    expect(deactivations[0].set).toEqual({ activo: false });
    expect(paramsOf(deactivations[0])).toEqual([5, 6, 7]);
  });

  it("chunks every writer at WRITE_CHUNK_ROWS (501 -> 2 statements)", async () => {
    const n = WRITE_CHUNK_ROWS + 1;
    const { tx, buffer } = makeTx();
    const plan = makePlan(
      {
        asignaturas: Array.from({ length: n }, (_, i) => ({
          kind: "create" as const,
          codigo: `A${i}`,
          nombre: `Asig ${i}`,
          carreraId: 1,
          horasTotales: 10,
        })),
        usuarios: Array.from({ length: n }, (_, i) => ({
          ...createUsuario,
          correo: `d${i}@uni.edu`,
          login: `d${i}@uni.edu`,
        })),
        grupos: Array.from({ length: n }, (_, i) => ({
          kind: "create" as const,
          asignaturaCodigo: `A${i}`,
          periodo: "2026-1",
          numeroGrupo: String(i),
          docenteCorreo: `d${i}@uni.edu`,
        })),
      },
      Array.from({ length: n }, (_, i) => 5000 + i),
    );
    const credentials = Array.from({ length: n }, (_, i) => ({
      ...nuevaCuenta,
      login: `d${i}@uni.edu`,
    }));
    await applyImport(tx, plan, credentials, ctx);
    const sizes = (s: string) =>
      entityStatements(buffer)
        .filter((x) => label(x) === s)
        .map((x) => x.values?.length ?? paramsOf(x).length);
    expect(sizes("insert:Asignatura")).toEqual([WRITE_CHUNK_ROWS, 1]);
    expect(sizes("insert:Usuario")).toEqual([WRITE_CHUNK_ROWS, 1]);
    expect(sizes("insert:Grupo")).toEqual([WRITE_CHUNK_ROWS, 1]);
    expect(sizes("update:Grupo")).toEqual([WRITE_CHUNK_ROWS, 1]);
  });

  it("issues no DELETE statement, and apply.ts has no delete call", async () => {
    const { tx, buffer } = makeTx();
    await applyImport(tx, makePlan({}, [1, 2, 3]), [], ctx);
    expect(buffer.some((s) => s.op === "delete")).toBe(false);
    const source = readFileSync(
      path.resolve(process.cwd(), "src/lib/import/apply.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/\.delete\(/);
  });
});

// ---------------------------------------------------------------------------
// 7.13 - the audit rows are written in the same transaction, last
// ---------------------------------------------------------------------------

/** `db` double whose transaction commits its buffer only if the callback
 *  resolves; a throw discards everything, like a real ROLLBACK. */
function makeDb(failOn?: (s: Statement) => boolean) {
  const committed: Statement[] = [];
  const handles: Transaction[] = [];
  const db = {
    async transaction<T>(cb: (tx: Transaction) => Promise<T>): Promise<T> {
      const { tx, buffer } = makeTx(undefined, failOn);
      handles.push(tx);
      const result = await cb(tx);
      committed.push(...buffer);
      return result;
    },
  };
  return { db, committed, handles };
}

const auditRows = (buffer: Statement[]) =>
  buffer.filter((s) => s.table === eventoAuditoria).flatMap((s) => s.values!);

const updateAna = {
  kind: "update" as const,
  id: 20,
  nombreCompleto: "Ana B",
  telefono: null,
  changedFields: ["nombreCompleto" as const],
};

describe("applyImport - in-transaction audit (AL: same transaction as its change)", () => {
  it("writes the audit rows last, after every entity statement, on the same handle", async () => {
    const { tx, buffer } = makeTx();
    await applyImport(
      tx,
      makePlan({ usuarios: [createUsuario, updateAna] }, [5]),
      [nuevaCuenta],
      ctx,
    );
    const labels = buffer.map(label);
    expect(labels.at(-1)).toBe("insert:Audit");
    expect(labels.filter((l) => l === "insert:Audit")).toHaveLength(1);
    expect(labels.indexOf("insert:Audit")).toBe(labels.length - 1);
    expect(labels.slice(0, -1)).toEqual([
      "insert:Usuario",
      "update:Usuario",
      "update:Grupo",
    ]);
  });

  it("carries the ids returned by the account inserts and the real actor", async () => {
    const { tx, buffer } = makeTx();
    await applyImport(
      tx,
      makePlan({ usuarios: [createUsuario, updateAna] }),
      [nuevaCuenta],
      ctx,
    );
    const rows = auditRows(buffer);
    expect(rows.map((r) => [r.accion, r.entidadTipo, r.entidadId])).toEqual([
      ["catalogo.importacion.aplicada", "Importacion", null],
      ["usuario.creado", "Usuario", 1000], // the id RETURNING handed back
      ["usuario.actualizado", "Usuario", 20],
    ]);
    expect(rows.every((r) => r.actorId === 7)).toBe(true);
    expect(rows[2].datos).toMatchObject({
      campos: ["nombreCompleto"],
      rol: "docente",
      importacionSha256: ctx.fileSha256,
    });
  });

  it("an idempotent re-import (only unchanged accounts) writes exactly the import row", async () => {
    const { tx, buffer } = makeTx();
    const counts = { Asignatura: zero(), Usuario: zero(), Grupo: zero() };
    counts.Usuario.unchanged = 3;
    await applyImport(tx, makePlan({}, [], { counts }), [], ctx);
    expect(auditRows(buffer).map((r) => r.accion)).toEqual([
      "catalogo.importacion.aplicada",
    ]);
  });

  it("an invalid plan emits no audit statement at all", async () => {
    const { tx, buffer } = makeTx();
    await expect(
      applyImport(tx, makePlan({}, [], { ok: false }), [], ctx),
    ).rejects.toThrow();
    expect(buffer).toHaveLength(0);
  });

  it("a failing entity write leaves no audit statement behind", async () => {
    const { tx, buffer } = makeTx(undefined, (s) => s.table === grupo);
    await expect(
      applyImport(
        tx,
        makePlan({ usuarios: [createUsuario] }, [5]),
        [nuevaCuenta],
        ctx,
      ),
    ).rejects.toThrow("boom");
    expect(auditRows(buffer)).toHaveLength(0);
  });

  it("a failing audit insert propagates and nothing is committed", async () => {
    const { db, committed } = makeDb((s) => s.table === eventoAuditoria);
    await expect(
      db.transaction((tx) =>
        applyImport(
          tx,
          makePlan({ usuarios: [createUsuario] }),
          [nuevaCuenta],
          ctx,
        ),
      ),
    ).rejects.toThrow("boom");
    expect(committed).toHaveLength(0);
  });

  it("a throw after the entity writes rolls the audit rows back with them", async () => {
    const { db, committed } = makeDb();
    await expect(
      db.transaction(async (tx) => {
        await applyImport(
          tx,
          makePlan({ usuarios: [createUsuario] }),
          [nuevaCuenta],
          ctx,
        );
        throw new Error("late failure");
      }),
    ).rejects.toThrow("late failure");
    expect(committed).toHaveLength(0);
    expect(auditRows(committed)).toHaveLength(0);
  });

  it("puts no credential in any audit payload (IAP: Rollback removes account audit records)", async () => {
    const { tx, buffer } = makeTx();
    await applyImport(
      tx,
      makePlan({ usuarios: [createUsuario] }),
      [nuevaCuenta],
      ctx,
    );
    const text = JSON.stringify(auditRows(buffer));
    expect(text).not.toContain(nuevaCuenta.clave);
    expect(text).not.toContain(nuevaCuenta.hashClave);
    expect(text).not.toMatch(/clave|password|hash/i);
  });
});

// ---------------------------------------------------------------------------
// 7.15 - orchestration: runImportApply
// ---------------------------------------------------------------------------

const workbook = makeWorkbook({
  asignaturas: [
    {
      Codigo: "MAT1",
      Nombre: "Matematica",
      Carrera: CARRERA.nombre,
      HorasTotales: "60",
    },
  ],
  docentes: [
    { Correo: "Nueva@Uni.edu", Nombre: "Nueva" },
    { Correo: "ana@uni.edu", Nombre: "Ana" },
  ],
  grupos: [
    {
      CodigoAsignatura: "MAT1",
      Periodo: "2026-S1",
      NumGrupo: "1",
      CorreoDocente: "ana@uni.edu",
    },
  ],
});
const SHA = "b".repeat(64);
const actor = { id: 7, login: "secretaria1" };

/** `snapshot` plus the Carrera the workbook names, so the plan is valid. */
const withCarrera = (s: typeof snapshot): typeof snapshot => ({
  ...s,
  carreras: makeSnapshot().carreras,
});

const nuevaExistente = {
  id: 50,
  login: "nueva@uni.edu",
  correo: "nueva@uni.edu",
  cif: null,
  nombreCompleto: "Nueva",
  telefono: null,
  carreraId: null,
  activo: true,
  rol: "docente" as const,
};

function setup(
  opts: {
    /** What the preview-time read (on `db`) sees. */
    dbSnapshot?: typeof snapshot;
    /** What the in-transaction read (on `tx`) sees. */
    txSnapshot?: typeof snapshot;
    failOn?: (s: Statement) => boolean;
  } = {},
) {
  const calls: string[] = [];
  const { db, committed, handles } = makeDb(opts.failOn);
  const wrapped = {
    transaction: <T>(cb: (tx: Transaction) => Promise<T>) => {
      calls.push("transaction");
      return db.transaction(cb);
    },
  };
  const first = withCarrera(opts.dbSnapshot ?? snapshot);
  const second = withCarrera(opts.txSnapshot ?? opts.dbSnapshot ?? snapshot);
  vi.mocked(loadCatalogSnapshot).mockReset();
  vi.mocked(loadCatalogSnapshot).mockImplementation(async (exec) => {
    const onDb = (exec as unknown) === wrapped;
    calls.push(onDb ? "snapshot:db" : "snapshot:tx");
    return onDb ? first : second;
  });
  vi.mocked(acquireCatalogWriteLock)
    .mockReset()
    .mockImplementation(async () => {
      calls.push("lock");
    });
  const generate = vi.fn(() => {
    calls.push("generate");
    return "CLAVE-GENERADA";
  });
  const hash = vi.fn(async (plain: string) => {
    calls.push("hash");
    return `hashed(${plain})`;
  });
  const run = (parsed = workbook) =>
    runImportApply({
      db: wrapped as unknown as Parameters<typeof runImportApply>[0]["db"],
      parsed,
      sha256: SHA,
      actor,
      hash,
      generate,
      now: () => new Date("2026-10-03T12:00:00.000Z"),
    });
  return { run, calls, committed, handles, generate, hash };
}

describe("runImportApply (IAP: Temporary password, CEI: Stateless confirm)", () => {
  it("generates and hashes a password only for planned new accounts", async () => {
    const { run, generate, hash } = setup();
    await run();
    expect(generate).toHaveBeenCalledTimes(1); // Nueva only, never ana
    expect(hash).toHaveBeenCalledTimes(1);
    expect(hash).toHaveBeenCalledWith("CLAVE-GENERADA");
  });

  it("hashes (bcrypt) BEFORE the transaction opens, never inside it", async () => {
    const { run, calls } = setup();
    await run();
    const open = calls.indexOf("transaction");
    expect(calls.indexOf("hash")).toBeGreaterThanOrEqual(0);
    expect(calls.indexOf("hash")).toBeLessThan(open);
    expect(calls.slice(open)).not.toContain("hash");
    expect(calls.slice(open)).not.toContain("generate");
  });

  it("re-reads the snapshot on tx inside the transaction and plans again", async () => {
    const { run, calls, handles } = setup();
    await run();
    expect(calls.indexOf("snapshot:db")).toBeLessThan(
      calls.indexOf("transaction"),
    );
    expect(calls.indexOf("snapshot:tx")).toBeGreaterThan(
      calls.indexOf("transaction"),
    );
    expect(handles).toHaveLength(1);
    const onTx = vi
      .mocked(loadCatalogSnapshot)
      .mock.calls.filter(([exec]) => (exec as unknown) === handles[0]);
    expect(onTx).toHaveLength(1);
  });

  it("returns the credentials and a summary, and stores only the hash", async () => {
    const { run, committed } = setup();
    const result = await run();
    expect(result.credentials).toEqual([
      {
        login: "nueva@uni.edu",
        nombreCompleto: "Nueva",
        clave: "CLAVE-GENERADA",
      },
    ]);
    expect(result.summary).toMatchObject({
      actor: "secretaria1",
      at: "2026-10-03T12:00:00.000Z",
      fileSha256: SHA,
      accountsCreated: 1,
      accountsUpdated: 0,
    });
    const usuarioInsert = committed.find((s) => s.table === usuario)!;
    expect(usuarioInsert.values![0].hashClave).toBe("hashed(CLAVE-GENERADA)");
    const written = JSON.stringify(committed.map((s) => s.values ?? s.set));
    expect(written).not.toContain('"CLAVE-GENERADA"');
    expect(JSON.stringify(result.summary)).not.toMatch(/clave|hash/i);
    expect(auditRows(committed).map((r) => r.accion)).toContain(
      "usuario.creado",
    );
  });

  it("rejects a plan with row errors before any hashing or transaction", async () => {
    const { run, calls, committed, generate } = setup();
    const bad = makeWorkbook({
      asignaturas: [
        { Codigo: "X", Nombre: "X", Carrera: "No existe", HorasTotales: "10" },
      ],
    });
    await expect(run(bad)).rejects.toBeInstanceOf(ImportRejectedError);
    expect(generate).not.toHaveBeenCalled();
    expect(calls).not.toContain("transaction");
    expect(committed).toHaveLength(0);
  });

  it("a plan that turns invalid inside the transaction aborts with nothing committed", async () => {
    // Between preview and confirm an unrelated account took Nueva's login.
    const stolen = {
      ...snapshot,
      usuarios: [
        ...snapshot.usuarios,
        { ...nuevaExistente, id: 99, correo: "otro@uni.edu" },
      ],
    };
    const { run, committed } = setup({ txSnapshot: stolen });
    await expect(run()).rejects.toBeInstanceOf(ImportRejectedError);
    expect(committed).toHaveLength(0);
  });

  it("a new account only the in-transaction plan wants has no credential: abort", async () => {
    // Preview saw Nueva as existing (nothing to provision); by confirm time
    // she is gone, so the second plan wants to create her.
    const withNueva = {
      ...snapshot,
      usuarios: [...snapshot.usuarios, nuevaExistente],
    };
    const { run, committed, generate } = setup({
      dbSnapshot: withNueva,
      txSnapshot: snapshot,
    });
    await expect(run()).rejects.toThrow(/nueva@uni\.edu/);
    expect(generate).not.toHaveBeenCalled();
    expect(committed).toHaveLength(0);
  });

  it("returns no credentials when the account already exists by confirm time", async () => {
    const withNueva = {
      ...snapshot,
      usuarios: [...snapshot.usuarios, nuevaExistente],
    };
    const { run } = setup({ txSnapshot: withNueva });
    const result = await run();
    expect(result.credentials).toEqual([]); // hashed in vain, never returned
    expect(result.summary.accountsCreated).toBe(0);
  });

  it("a failure mid-apply rolls everything back and returns no credentials", async () => {
    const { run, committed } = setup({ failOn: (s) => s.table === grupo });
    await expect(run()).rejects.toThrow("boom");
    expect(committed).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// WU4-B (4.19) - Asignatura reactivation, per-record events, the catalog lock
// ---------------------------------------------------------------------------

const reactivate = {
  kind: "update" as const,
  id: 10,
  nombre: "Matematica",
  carreraId: 1,
  horasTotales: 60,
  reactivated: true as const,
};
const inactiveSnapshot = {
  ...snapshot,
  asignaturas: [{ ...snapshot.asignaturas[0], activo: false }],
};

describe("applyImport - Asignatura reactivation (CEI-UPS, AL-IMP)", () => {
  it("writes Activo = true only for a reactivation", async () => {
    const { tx, buffer } = makeTx();
    const plain = { ...reactivate, id: 11, reactivated: undefined };
    await applyImport(
      tx,
      makePlan({ asignaturas: [reactivate, plain] }),
      [],
      ctx,
    );
    expect(buffer[0].set).toEqual({
      nombre: "Matematica",
      carreraId: 1,
      horasTotales: 60,
      activo: true,
    });
    expect(buffer[1].set).not.toHaveProperty("activo");
  });

  it("inserts name neither activo nor origen (the defaults apply)", async () => {
    const { tx, buffer } = makeTx();
    const plan = makePlan({
      asignaturas: [
        {
          kind: "create",
          codigo: "F",
          nombre: "F",
          carreraId: 1,
          horasTotales: 8,
        },
      ],
      grupos: [
        {
          kind: "create",
          asignaturaCodigo: "MAT1",
          periodo: "2026-S1",
          numeroGrupo: "1",
          docenteCorreo: "ana@uni.edu",
        },
      ],
    });
    await applyImport(tx, plan, [], ctx);
    const inserted = buffer.filter((s) => s.op === "insert" && s.values);
    const keys = inserted.flatMap((s) => Object.keys(s.values![0]));
    expect(keys).not.toContain("activo");
    expect(keys).not.toContain("origen");
  });

  it("appends one asignatura.reactivada per reactivated id after the import and account events", async () => {
    const { tx, buffer } = makeTx();
    const second = { ...reactivate, id: 11 };
    await applyImport(
      tx,
      makePlan({
        asignaturas: [reactivate, second],
        usuarios: [createUsuario],
      }),
      [nuevaCuenta],
      ctx,
    );
    expect(buffer.filter((s) => s.table === eventoAuditoria)).toHaveLength(1);
    const rows = auditRows(buffer);
    expect(rows.map((r) => [r.accion, r.entidadTipo, r.entidadId])).toEqual([
      ["catalogo.importacion.aplicada", "Importacion", null],
      ["usuario.creado", "Usuario", 1000],
      ["asignatura.reactivada", "Asignatura", 10],
      ["asignatura.reactivada", "Asignatura", 11],
    ]);
    expect(rows[2].datos).toEqual({
      campos: ["activo"],
      origen: "importacion",
      importacionSha256: ctx.fileSha256,
    });
    expect(JSON.stringify(rows[2])).not.toMatch(/MAT1|Matematica|clave|hash/i);
  });

  it("emits no asignatura or grupo event when nothing is reactivated", async () => {
    const { tx, buffer } = makeTx();
    const plain = { ...reactivate, reactivated: undefined };
    await applyImport(tx, makePlan({ asignaturas: [plain] }, [5]), [], ctx);
    expect(auditRows(buffer).map((r) => r.accion)).toEqual([
      "catalogo.importacion.aplicada",
    ]);
  });
});

describe("runImportApply - catalog write lock (CEI-BUSY, AL-IMP)", () => {
  it("takes the lock first inside the transaction, before the snapshot read and the audit", async () => {
    const { run, calls, handles, committed } = setup({
      dbSnapshot: inactiveSnapshot,
    });
    await run();
    expect(calls.slice(calls.indexOf("transaction"))).toEqual([
      "transaction",
      "lock",
      "snapshot:tx",
    ]);
    expect(acquireCatalogWriteLock).toHaveBeenCalledTimes(1);
    expect(acquireCatalogWriteLock).toHaveBeenCalledWith(handles[0]);
    expect(committed.at(-1)!.table).toBe(eventoAuditoria);
    expect(auditRows(committed).map((r) => r.accion)).toContain(
      "asignatura.reactivada",
    );
  });

  it("a busy lock aborts before any statement, audit row or credential", async () => {
    const { run, calls, committed, handles } = setup();
    vi.mocked(acquireCatalogWriteLock).mockRejectedValueOnce(
      new CatalogBusyError(),
    );
    await expect(run()).rejects.toBeInstanceOf(CatalogBusyError);
    expect(calls).not.toContain("snapshot:tx");
    expect(handles).toHaveLength(1);
    expect(committed).toHaveLength(0);
  });

  it("a failure after planning inserts no audit row", async () => {
    const { run, committed } = setup({
      dbSnapshot: inactiveSnapshot,
      failOn: (s) => s.op === "update" && s.table === asignatura,
    });
    await expect(run()).rejects.toThrow("boom");
    expect(auditRows(committed)).toHaveLength(0);
    expect(committed).toHaveLength(0);
  });
});
