import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// One recorded statement per `select(...)` / `update(...)`: every chained call
// with its arguments, in order. Awaiting a statement resolves the next queued
// result, or rejects with a queued `rejecting(...)` error.
type Call = { method: string; args: unknown[] };
const statements: Call[][] = [];
const owners: string[] = [];
const results: unknown[] = [];
let failure: unknown = null;
let savepoints = 0;

function statement(first: Call) {
  const calls: Call[] = [first];
  statements.push(calls);
  const chain: object = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") {
          return (
            resolve: (value: unknown) => void,
            reject: (reason: unknown) => void,
          ) => (failure ? reject(failure) : resolve(results.shift() ?? []));
        }
        return (...args: unknown[]) => {
          calls.push({ method: String(prop), args });
          return chain;
        };
      },
    },
  );
  return chain;
}

vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => statement({ method: "select", args }),
  },
}));

import { grupo } from "@/db/schema";
import type { Transaction } from "@/lib/data/audit";
import {
  getDocenteById,
  setDocenteActivo,
  updateDocente,
  type DocenteDetail,
} from "@/lib/data/docentes";

const dialect = new PgDialect();
const render = (fragment: SQL | undefined) => {
  if (!fragment) return { sql: "", params: [] as unknown[] };
  const { sql: text, params } = dialect.sqlToQuery(fragment);
  return { sql: text, params };
};

const calls = (index: number, method: string) =>
  statements[index].filter((c) => c.method === method);
const whereOf = (index: number) =>
  render(calls(index, "where")[0]?.args[0] as SQL | undefined);

beforeEach(() => {
  statements.length = 0;
  owners.length = 0;
  results.length = 0;
  failure = null;
  savepoints = 0;
});

// ---- Writes. The functions take the transaction handle; this double records
// which handle ran each statement. `tx.transaction` is the savepoint: the
// callback receives a second handle, so a statement that must run inside it is
// told apart from one that runs on the outer handle.
const handle = (owner: string) => ({
  select: (...args: unknown[]) => {
    owners.push(owner);
    return statement({ method: "select", args });
  },
  update: (...args: unknown[]) => {
    owners.push(owner);
    return statement({ method: "update", args });
  },
});
const savepoint = handle("savepoint");
const tx = {
  ...handle("tx"),
  transaction: async (work: (inner: unknown) => Promise<unknown>) => {
    savepoints += 1;
    return work(savepoint);
  },
} as unknown as Transaction;
const rejecting = (error: unknown) => ({
  // resolve() adopts a thenable, so this queued value rejects the awaiter
  then: (_resolve: unknown, reject: (reason: unknown) => void) => reject(error),
});
const methods = () => statements.map((s) => s[0].method);
const setOf = (i: number) => calls(i, "set")[0].args[0] as object;

const ROLE_WHERE = (id: number) => ({
  sql: '("Usuario"."Id" = $1 and "Rol"."Codigo" = $2)',
  params: [id, "docente"],
});
const ROW_WHERE = (id: number, rolId: number) => ({
  sql: '("Usuario"."Id" = $1 and "Usuario"."RolId" = $2)',
  params: [id, rolId],
});

describe("getDocenteById (DM-2)", () => {
  const detail: DocenteDetail = {
    id: 5,
    nombreCompleto: "Ana Perez",
    correo: "ana@uni.edu",
    telefono: "555-0100",
    activo: true,
    gruposActivos: 2,
  };

  it("reads Usuario joined to Rol, with the id and the docente role in one WHERE", async () => {
    results.push([detail]);
    await getDocenteById(5);
    expect(statements).toHaveLength(1);
    expect(calls(0, "innerJoin")).toHaveLength(1);
    expect(whereOf(0)).toEqual(ROLE_WHERE(5));
  });

  it("projects only the six fields, with the active grupos as a subquery of the same statement", async () => {
    results.push([detail]);
    expect(await getDocenteById(5)).toEqual(detail);
    const fields = calls(0, "select")[0].args[0] as Record<string, SQL>;
    expect(Object.keys(fields)).toEqual([
      "id",
      "nombreCompleto",
      "correo",
      "telefono",
      "activo",
      "gruposActivos",
    ]);
    const count = render(fields.gruposActivos).sql;
    expect(count).toContain('from "Grupo"');
    expect(count).toContain('"Grupo"."DocenteId" = "Usuario"."Id"');
    expect(count).toContain('"Grupo"."Activo"');
  });

  it("is null identically for a missing id and for an account of another role", async () => {
    results.push([], []);
    expect(await getDocenteById(999)).toBeNull();
    expect(await getDocenteById(6)).toBeNull();
    expect(whereOf(1).params).toEqual([6, "docente"]);
  });

  it("fails loud: a database error is thrown, never turned into null", async () => {
    const boom = new Error("boom");
    failure = boom;
    await expect(getDocenteById(5)).rejects.toBe(boom);
  });

  it("holds no login, hash, Cif or role in its result type", () => {
    expectTypeOf<keyof DocenteDetail>().toEqualTypeOf<
      | "id"
      | "nombreCompleto"
      | "correo"
      | "telefono"
      | "activo"
      | "gruposActivos"
    >();
  });
});

describe("updateDocente (DM-3, DM-4, DM-5, DM-6)", () => {
  const row = {
    id: 5,
    rolId: 3,
    nombreCompleto: "Ana Perez",
    correo: "ana@uni.edu",
    telefono: "555-0100" as string | null,
    activo: true,
  };
  const input = {
    nombreCompleto: "Ana Maria Perez",
    correo: "ana@uni.edu",
    telefono: "555-0100" as string | null,
  };

  it("reads the row first on the transaction, with the id and the docente role in one WHERE", async () => {
    results.push([row], [{ id: 5 }]);
    await updateDocente(tx, 5, input);
    expect(owners[0]).toBe("tx");
    expect(methods()[0]).toBe("select");
    expect(calls(0, "innerJoin")).toHaveLength(1);
    expect(whereOf(0)).toEqual(ROLE_WHERE(5));
    expect(
      Object.keys(calls(0, "select")[0].args[0] as object).toSorted(),
    ).toEqual(
      [
        "activo",
        "correo",
        "id",
        "nombreCompleto",
        "rolId",
        "telefono",
      ].toSorted(),
    );
  });

  it("answers not_found for a missing id or another role, with no other statement", async () => {
    results.push([]);
    expect(await updateDocente(tx, 5, input)).toEqual({ kind: "not_found" });
    expect(methods()).toEqual(["select"]);
    expect(savepoints).toBe(0);
  });

  it("refuses an inactive docente, with no other statement", async () => {
    results.push([{ ...row, activo: false }]);
    expect(await updateDocente(tx, 5, input)).toEqual({ kind: "inactive" });
    expect(methods()).toEqual(["select"]);
    expect(savepoints).toBe(0);
  });

  it("answers unchanged when no editable field differs, with no lookup and no write", async () => {
    results.push([row]);
    expect(
      await updateDocente(tx, 5, {
        nombreCompleto: "Ana Perez",
        correo: "ana@uni.edu",
        telefono: "555-0100",
      }),
    ).toEqual({ kind: "unchanged", id: 5 });
    expect(methods()).toEqual(["select"]);
    expect(savepoints).toBe(0);
  });

  it("an empty phone over no phone is not a change", async () => {
    results.push([{ ...row, telefono: null }]);
    expect(
      await updateDocente(tx, 5, {
        nombreCompleto: "Ana Perez",
        correo: "ana@uni.edu",
        telefono: null,
      }),
    ).toEqual({ kind: "unchanged", id: 5 });
    expect(methods()).toEqual(["select"]);
  });

  it("runs no email lookup when the email is unchanged", async () => {
    results.push([row], [{ id: 5 }]);
    await updateDocente(tx, 5, input);
    expect(methods()).toEqual(["select", "update"]);
  });

  it("looks the email up by lower-case equality, excluding the account itself, with no role or state filter", async () => {
    results.push([row], [{ id: 9 }]);
    expect(
      await updateDocente(tx, 5, { ...input, correo: "new@uni.edu" }),
    ).toEqual({ kind: "correo_taken" });
    expect(owners).toEqual(["tx", "tx"]);
    expect(whereOf(1)).toEqual({
      sql: '(lower("Usuario"."Correo") = $1 and "Usuario"."Id" <> $2)',
      params: ["new@uni.edu", 5],
    });
    expect(calls(1, "innerJoin")).toHaveLength(0);
    expect(whereOf(1).sql).not.toMatch(/Activo|RolId|Rol"/);
    expect(calls(1, "limit")[0].args).toEqual([1]);
  });

  it("a taken email writes nothing: no savepoint, no update", async () => {
    results.push([row], [{ id: 9 }]);
    await updateDocente(tx, 5, { ...input, correo: "new@uni.edu" });
    expect(savepoints).toBe(0);
    expect(methods()).toEqual(["select", "select"]);
  });

  it("re-saving an own mixed-case email in lower case is a change of correo and excludes the own row", async () => {
    results.push([{ ...row, correo: "Ana@Uni.edu" }], [], [{ id: 5 }]);
    expect(
      await updateDocente(tx, 5, {
        nombreCompleto: "Ana Perez",
        correo: "ana@uni.edu",
        telefono: "555-0100",
      }),
    ).toEqual({ kind: "updated", id: 5, campos: ["correo"] });
    expect(whereOf(1).sql).toContain('"Usuario"."Id" <> $2');
    expect(whereOf(1).params).toEqual(["ana@uni.edu", 5]);
  });

  it("a docente with no stored email needs the lookup when it gets one", async () => {
    results.push([{ ...row, correo: null }], [], [{ id: 5 }]);
    expect(await updateDocente(tx, 5, input)).toEqual({
      kind: "updated",
      id: 5,
      campos: ["nombreCompleto", "correo"],
    });
    expect(methods()).toEqual(["select", "select", "update"]);
  });

  it("updates inside a savepoint, with only the changed fields in the SET and the role in the WHERE", async () => {
    results.push([row], [{ id: 5 }]);
    expect(await updateDocente(tx, 5, input)).toEqual({
      kind: "updated",
      id: 5,
      campos: ["nombreCompleto"],
    });
    expect(savepoints).toBe(1);
    expect(owners).toEqual(["tx", "savepoint"]);
    expect(setOf(1)).toEqual({ nombreCompleto: "Ana Maria Perez" });
    expect(whereOf(1)).toEqual(ROW_WHERE(5, 3));
    expect(Object.keys(calls(1, "returning")[0].args[0] as object)).toEqual([
      "id",
    ]);
  });

  it("stores all changed fields in one write, a cleared phone as null", async () => {
    results.push([row], [], [{ id: 5 }]);
    expect(
      await updateDocente(tx, 5, {
        nombreCompleto: "Ana Maria Perez",
        correo: "ana.maria@uni.edu",
        telefono: null,
      }),
    ).toEqual({
      kind: "updated",
      id: 5,
      campos: ["nombreCompleto", "correo", "telefono"],
    });
    expect(setOf(2)).toEqual({
      nombreCompleto: "Ana Maria Perez",
      correo: "ana.maria@uni.edu",
      telefono: null,
    });
    expect(methods().filter((m) => m === "update")).toHaveLength(1);
  });

  it("never puts the login, the hash, the role, the state or the password flag in the SET", async () => {
    results.push([row], [], [{ id: 5 }]);
    await updateDocente(tx, 5, {
      nombreCompleto: "Ana Maria Perez",
      correo: "ana.maria@uni.edu",
      telefono: null,
      login: "hack",
      hashClave: "hack",
      rolId: 1,
      activo: false,
      debeCambiarClave: true,
    } as typeof input);
    const keys = Object.keys(setOf(2));
    expect(keys).toEqual(["nombreCompleto", "correo", "telefono"]);
    for (const forbidden of [
      "login",
      "hashClave",
      "rolId",
      "activo",
      "debeCambiarClave",
    ]) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it("maps a 23505 raised inside the savepoint to correo_taken", async () => {
    results.push([row], [], rejecting({ cause: { code: "23505" } }));
    expect(
      await updateDocente(tx, 5, { ...input, correo: "new@uni.edu" }),
    ).toEqual({ kind: "correo_taken" });
    expect(savepoints).toBe(1);
  });

  it.each([
    ["a lock timeout (the busy mapping)", { code: "55P03" }],
    ["any other failure", new Error("boom")],
  ])("lets %s propagate", async (_label, error) => {
    results.push([row], rejecting(error));
    await expect(updateDocente(tx, 5, input)).rejects.toBe(error);
  });

  it("answers not_found when the UPDATE returns no row", async () => {
    results.push([row], []);
    expect(await updateDocente(tx, 5, input)).toEqual({ kind: "not_found" });
  });
});

describe("setDocenteActivo (DM-7, DM-8, DM-9, DM-18)", () => {
  const row = { id: 5, rolId: 3, activo: true };

  it("reads the row first on the transaction, with the id and the docente role in one WHERE", async () => {
    results.push([row], [{ count: 0 }], [{ id: 5 }]);
    await setDocenteActivo(tx, 5, false);
    expect(owners[0]).toBe("tx");
    expect(calls(0, "innerJoin")).toHaveLength(1);
    expect(whereOf(0)).toEqual(ROLE_WHERE(5));
  });

  it("answers not_found for a missing id or another role", async () => {
    results.push([]);
    expect(await setDocenteActivo(tx, 5, false)).toEqual({
      kind: "not_found",
    });
    expect(methods()).toEqual(["select"]);
  });

  it.each([
    ["deactivating an inactive docente", false, false],
    ["reactivating an active docente", true, true],
  ])(
    "%s is unchanged with no count and no write",
    async (_l, wanted, stored) => {
      results.push([{ ...row, activo: stored }]);
      expect(await setDocenteActivo(tx, 5, wanted)).toEqual({
        kind: "unchanged",
        id: 5,
      });
      expect(methods()).toEqual(["select"]);
    },
  );

  it("deactivation counts the active grupos of any period and any asignatura state, then updates", async () => {
    results.push([row], [{ count: 0 }], [{ id: 5 }]);
    expect(await setDocenteActivo(tx, 5, false)).toEqual({
      kind: "changed",
      id: 5,
      activo: false,
    });
    expect(methods()).toEqual(["select", "select", "update"]);
    expect(owners).toEqual(["tx", "tx", "tx"]);
    expect(calls(1, "from")[0].args[0]).toBe(grupo);
    expect(whereOf(1)).toEqual({
      sql: '("Grupo"."DocenteId" = $1 and "Grupo"."Activo" = $2)',
      params: [5, true],
    });
    expect(calls(1, "innerJoin")).toHaveLength(0);
    expect(whereOf(1).sql).not.toMatch(/Periodo|Asignatura/);
    expect(setOf(2)).toEqual({ activo: false });
    expect(whereOf(2)).toEqual(ROW_WHERE(5, 3));
  });

  it("active grupos refuse with their count and no UPDATE", async () => {
    results.push([row], [{ count: 3 }]);
    expect(await setDocenteActivo(tx, 5, false)).toEqual({
      kind: "has_active_groups",
      count: 3,
    });
    expect(methods()).toEqual(["select", "select"]);
  });

  it("answers not_found when the deactivating UPDATE returns no row", async () => {
    results.push([row], [{ count: 0 }], []);
    expect(await setDocenteActivo(tx, 5, false)).toEqual({
      kind: "not_found",
    });
  });

  it("reactivation runs no count, sets only Activo and carries the role in the WHERE", async () => {
    results.push([{ ...row, activo: false }], [{ id: 5 }]);
    expect(await setDocenteActivo(tx, 5, true)).toEqual({
      kind: "changed",
      id: 5,
      activo: true,
    });
    expect(methods()).toEqual(["select", "update"]);
    expect(setOf(1)).toEqual({ activo: true });
    expect(whereOf(1)).toEqual(ROW_WHERE(5, 3));
    expect(statements.flat().some((c) => c.args.some((a) => a === grupo))).toBe(
      false,
    );
  });

  it("the module writes only Usuario: no DELETE, no TRUNCATE, no statement on Grupo, Inscripcion, SolicitudAsignatura or remision (DM-18)", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/data/docentes.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/\.delete\(|\btruncate\b|\bdelete from\b/i);
    expect(source).not.toMatch(/\.insert\(/);
    const writes = [...source.matchAll(/\.update\(\s*(\w+)\s*\)/g)].map(
      (match) => match[1],
    );
    expect(writes).toEqual(["usuario", "usuario"]);
    expect(source).not.toMatch(
      /\.update\(\s*(grupo|inscripcion|solicitudAsignatura|remision)\b/,
    );
  });
});
