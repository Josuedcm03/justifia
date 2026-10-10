import { PgDialect } from "drizzle-orm/pg-core";
import { sql, type SQL } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// One recorded statement per `db.select(...)`: every chained call with its
// arguments, in order. Awaiting a statement resolves the next queued result.
type Call = { method: string; args: unknown[] };
const statements: Call[][] = [];
const results: unknown[] = [];
let failure: unknown = null;

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

// The real scope predicates, except while `sentinel.on`: then each one is a
// unique SQL marker, so a read that forgets the predicate is caught.
const sentinel = vi.hoisted(() => ({ on: false }));
vi.mock("@/lib/data/catalog-scope-sql", async (importActual) => {
  const actual =
    await importActual<typeof import("@/lib/data/catalog-scope-sql")>();
  return {
    ...actual,
    asignaturaInScope: (
      ...args: Parameters<typeof actual.asignaturaInScope>
    ) =>
      sentinel.on ? sql`SCOPE_SENTINEL` : actual.asignaturaInScope(...args),
    asignaturaRowInScope: (
      ...args: Parameters<typeof actual.asignaturaRowInScope>
    ) =>
      sentinel.on ? sql`SCOPE_SENTINEL` : actual.asignaturaRowInScope(...args),
  };
});

import { CATALOG_OPTIONS_MAX } from "@/lib/catalog/list-params";
import type { CatalogScope } from "@/lib/catalog/scope";
import { grupo } from "@/db/schema";
import { AUDITABLE_ASIGNATURA_FIELDS } from "@/lib/audit/types";
import type { Transaction } from "@/lib/data/audit";
import {
  buildAsignaturasWhere,
  createAsignatura,
  getAsignaturaById,
  listAsignaturaOptions,
  listAsignaturas,
  listCarreraOptions,
  setAsignaturaActivo,
  updateAsignatura,
} from "@/lib/data/asignaturas";

const dialect = new PgDialect();
const render = (fragment: SQL | undefined) => {
  if (!fragment) return { sql: "", params: [] as unknown[] };
  const { sql: text, params } = dialect.sqlToQuery(fragment);
  return { sql: text, params };
};

const ALL: CatalogScope = { kind: "all" };
const OWN: CatalogScope = { kind: "carrera", carreraId: 7 };
const NONE: CatalogScope = { kind: "none" };

const calls = (index: number, method: string) =>
  statements[index].filter((c) => c.method === method);
const whereOf = (index: number) =>
  render(calls(index, "where")[0]?.args[0] as SQL | undefined);

beforeEach(() => {
  statements.length = 0;
  results.length = 0;
  failure = null;
  sentinel.on = false;
});

describe("buildAsignaturasWhere", () => {
  it("is undefined for the all scope with every state and no search", () => {
    expect(
      buildAsignaturasWhere(ALL, { status: "all", q: "" }),
    ).toBeUndefined();
  });

  it("active keeps only active rows, inactive only inactive ones", () => {
    expect(
      render(buildAsignaturasWhere(ALL, { status: "active", q: "" })).sql,
    ).toBe('"Asignatura"."Activo"');
    expect(
      render(buildAsignaturasWhere(ALL, { status: "inactive", q: "" })).sql,
    ).toBe('not "Asignatura"."Activo"');
  });

  it("the all state adds no state predicate, only the scope", () => {
    const { sql: text, params } = render(
      buildAsignaturasWhere(OWN, { status: "all", q: "" }),
    );
    expect(text).toBe('"Asignatura"."CarreraId" = $1');
    expect(params).toEqual([7]);
  });

  it("searches Codigo OR Nombre partially, escaped, as parameters", () => {
    const { sql: text, params } = render(
      buildAsignaturasWhere(ALL, { status: "all", q: "a%b_c" }),
    );
    expect(text).toBe(
      '("Asignatura"."Codigo" ilike $1 or "Asignatura"."Nombre" ilike $2)',
    );
    expect(params).toEqual(["%a\\%b\\_c%", "%a\\%b\\_c%"]);
    expect(text).not.toContain("a%b_c");
  });

  it("combines scope, state and search with AND", () => {
    const { sql: text, params } = render(
      buildAsignaturasWhere(OWN, { status: "active", q: "mat" }),
    );
    expect(text).toBe(
      '("Asignatura"."CarreraId" = $1 and "Asignatura"."Activo" and ("Asignatura"."Codigo" ilike $2 or "Asignatura"."Nombre" ilike $3))',
    );
    expect(params).toEqual([7, "%mat%", "%mat%"]);
  });

  it("carries a literal false for the none scope", () => {
    expect(
      render(buildAsignaturasWhere(NONE, { status: "all", q: "" })).sql,
    ).toBe("false");
  });
});

describe("listAsignaturas", () => {
  const item = {
    id: 1,
    codigo: "MAT101",
    nombre: "Calculus",
    carreraId: 7,
    carreraNombre: "Engineering",
    horasTotales: 48,
    activo: true,
    grupos: "1, 2" as string | null,
  };
  const params = (page: number) => ({
    scope: OWN,
    status: "active" as const,
    q: "mat",
    page,
    pageSize: 10,
  });

  it("returns the page, the total and the clamped page", async () => {
    results.push([{ count: 1 }], [item]);
    expect(await listAsignaturas(params(1))).toEqual({
      data: [item],
      total: 1,
      page: 1,
      pageSize: 10,
      degraded: false,
    });
  });

  it("uses one where for the count and the page", async () => {
    results.push([{ count: 1 }], [item]);
    await listAsignaturas(params(1));
    expect(statements).toHaveLength(2);
    expect(whereOf(0)).toEqual(whereOf(1));
    expect(whereOf(0).sql).toContain('"Asignatura"."CarreraId" = $1');
    expect(whereOf(0).sql).toContain('"Asignatura"."Activo"');
  });

  it("clamps an out-of-range page to the last page", async () => {
    results.push([{ count: 25 }], [item]);
    const result = await listAsignaturas(params(99));
    expect(result.page).toBe(3);
    expect(calls(1, "limit")[0].args).toEqual([10]);
    expect(calls(1, "offset")[0].args).toEqual([20]);
  });

  it("clamps to page 1 when there are no rows", async () => {
    results.push([{ count: 0 }], []);
    const result = await listAsignaturas(params(4));
    expect(result).toMatchObject({ data: [], total: 0, page: 1 });
    expect(calls(1, "offset")[0].args).toEqual([0]);
  });

  it("joins the carrera name and orders by Codigo (unique)", async () => {
    results.push([{ count: 1 }], [item]);
    await listAsignaturas(params(1));
    const [select] = calls(1, "select");
    expect(Object.keys(select.args[0] as object)).toEqual([
      "id",
      "codigo",
      "nombre",
      "carreraId",
      "carreraNombre",
      "horasTotales",
      "activo",
      "grupos",
    ]);
    expect(calls(1, "innerJoin")).toHaveLength(1);
    const order = (calls(1, "orderBy")[0].args as SQL[]).map(
      (part) => render(part).sql,
    );
    expect(order).toEqual(['"Asignatura"."Codigo" asc']);
  });

  it("aggregates the distinct, ordered numbers of the active groups in one subquery column", async () => {
    results.push([{ count: 1 }], [item]);
    const result = await listAsignaturas(params(1));
    expect(result.data[0].grupos).toBe("1, 2");
    expect(statements).toHaveLength(2);
    const fields = calls(1, "select")[0].args[0] as Record<string, SQL>;
    expect(render(fields.grupos).sql).toBe(
      `(select string_agg(distinct "Grupo"."NumeroGrupo", ', ' order by "Grupo"."NumeroGrupo") from "Grupo" where "Grupo"."AsignaturaId" = "Asignatura"."Id" and "Grupo"."Activo")`,
    );
  });

  it("passes a null aggregate (no active group) through untouched", async () => {
    results.push([{ count: 1 }], [{ ...item, grupos: null }]);
    const result = await listAsignaturas(params(1));
    expect(result.data[0].grupos).toBeNull();
  });

  it("degrades to an empty page when the database throws", async () => {
    failure = new Error("connection refused");
    expect(await listAsignaturas(params(2))).toEqual({
      data: [],
      total: 0,
      page: 1,
      pageSize: 10,
      degraded: true,
    });
  });
});

describe("getAsignaturaById", () => {
  const detail = {
    id: 5,
    codigo: "MAT101",
    nombre: "Calculus",
    carreraId: 7,
    carreraNombre: "Engineering",
    horasTotales: 48,
    activo: true,
    gruposActivos: 2,
  };

  it("carries the id and the scope in one WHERE", async () => {
    results.push([detail]);
    await getAsignaturaById(OWN, 5);
    expect(whereOf(0)).toEqual({
      sql: '("Asignatura"."Id" = $1 and "Asignatura"."CarreraId" = $2)',
      params: [5, 7],
    });
  });

  it("returns the detail with the active group count in the same statement", async () => {
    results.push([detail]);
    expect(await getAsignaturaById(ALL, 5)).toEqual(detail);
    expect(statements).toHaveLength(1);
    const fields = calls(0, "select")[0].args[0] as Record<string, SQL>;
    const count = render(fields.gruposActivos).sql;
    expect(count).toContain('from "Grupo"');
    expect(count).toContain('"Grupo"."AsignaturaId" = "Asignatura"."Id"');
    expect(count).toContain('"Grupo"."Activo"');
  });

  it("is null identically for a missing id and for a foreign one", async () => {
    results.push([], []);
    const missing = await getAsignaturaById(ALL, 999);
    const foreign = await getAsignaturaById(OWN, 5);
    expect(missing).toBeNull();
    expect(foreign).toBeNull();
    expect(whereOf(1).sql).toContain('"Asignatura"."CarreraId" = $2');
  });

  it("matches nothing for the none scope", async () => {
    results.push([]);
    expect(await getAsignaturaById(NONE, 5)).toBeNull();
    expect(whereOf(0).sql).toContain("false");
  });
});

describe("listAsignaturaOptions", () => {
  it("lists only active, in-scope asignaturas, capped, ordered by Codigo", async () => {
    const rows = [{ id: 1, codigo: "MAT101", nombre: "Calculus" }];
    results.push(rows);
    expect(await listAsignaturaOptions(OWN)).toEqual(rows);
    expect(whereOf(0)).toEqual({
      sql: '("Asignatura"."CarreraId" = $1 and "Asignatura"."Activo")',
      params: [7],
    });
    expect(calls(0, "limit")[0].args).toEqual([CATALOG_OPTIONS_MAX]);
    expect(Object.keys(calls(0, "select")[0].args[0] as object)).toEqual([
      "id",
      "codigo",
      "nombre",
    ]);
    expect(
      (calls(0, "orderBy")[0].args as SQL[]).map((part) => render(part).sql),
    ).toEqual(['"Asignatura"."Codigo" asc']);
  });

  it("matches nothing for the none scope", async () => {
    results.push([]);
    await listAsignaturaOptions(NONE);
    expect(whereOf(0).sql).toBe('(false and "Asignatura"."Activo")');
  });
});

describe("listCarreraOptions", () => {
  const rows = [
    { id: 7, nombre: "Engineering" },
    { id: 9, nombre: "Law" },
  ];

  it("offers every carrera to the all scope", async () => {
    results.push(rows);
    expect(await listCarreraOptions(ALL)).toEqual(rows);
  });

  it("offers only the own carrera to a carrera scope", async () => {
    results.push(rows);
    expect(await listCarreraOptions(OWN)).toEqual([rows[0]]);
  });

  it("offers nothing when the own carrera does not exist", async () => {
    results.push(rows);
    expect(
      await listCarreraOptions({ kind: "carrera", carreraId: 99 }),
    ).toEqual([]);
  });

  it("offers nothing to the none scope and issues no statement", async () => {
    expect(await listCarreraOptions(NONE)).toEqual([]);
    expect(statements).toHaveLength(0);
  });
});

describe("scope sentinel: every Asignatura read carries the scope predicate", () => {
  beforeEach(() => {
    sentinel.on = true;
  });

  it("listAsignaturas: the count and the page", async () => {
    results.push([{ count: 1 }], []);
    await listAsignaturas({
      scope: OWN,
      status: "all",
      q: "",
      page: 1,
      pageSize: 10,
    });
    expect(statements).toHaveLength(2);
    expect(whereOf(0).sql).toContain("SCOPE_SENTINEL");
    expect(whereOf(1).sql).toContain("SCOPE_SENTINEL");
  });

  it("getAsignaturaById", async () => {
    results.push([]);
    await getAsignaturaById(OWN, 5);
    expect(whereOf(0).sql).toContain("SCOPE_SENTINEL");
  });

  it("listAsignaturaOptions", async () => {
    results.push([]);
    await listAsignaturaOptions(OWN);
    expect(whereOf(0).sql).toContain("SCOPE_SENTINEL");
  });

  it("every statement issued has a where, and every where has the sentinel", async () => {
    results.push([{ count: 0 }], [], [], []);
    await listAsignaturas({
      scope: OWN,
      status: "active",
      q: "x",
      page: 1,
      pageSize: 10,
    });
    await getAsignaturaById(OWN, 1);
    await listAsignaturaOptions(OWN);
    for (let i = 0; i < statements.length; i += 1) {
      expect(calls(i, "where")).toHaveLength(1);
      expect(whereOf(i).sql).toContain("SCOPE_SENTINEL");
    }
  });
});

// ---- Writes. The functions take the transaction handle; this double records
// every statement it issues (select, insert, update) into `statements` and
// resolves the queued results in order. `rejecting` queues a thrown error.
const tx = {
  select: (...args: unknown[]) => statement({ method: "select", args }),
  insert: (...args: unknown[]) => statement({ method: "insert", args }),
  update: (...args: unknown[]) => statement({ method: "update", args }),
} as unknown as Transaction;
const rejecting = (error: unknown) => ({
  // resolve() adopts a thenable, so this queued value rejects the awaiter
  then: (_resolve: unknown, reject: (reason: unknown) => void) => reject(error),
});
const methods = () => statements.map((s) => s[0].method);
const setOf = (i: number) => calls(i, "set")[0].args[0] as object;
const valuesOf = (i: number) => calls(i, "values")[0].args[0] as object;
const OWN_ROW_WHERE = {
  sql: '("Asignatura"."Id" = $1 and "Asignatura"."CarreraId" = $2)',
  params: [5, 7],
};

describe("createAsignatura", () => {
  const input = { codigo: "MAT101", nombre: "Calculus", horasTotales: 48 };

  it.each([
    ["none scope", NONE, undefined],
    ["own scope naming another carrera", OWN, 9],
    ["all scope without a carrera", ALL, undefined],
  ])(
    "refuses %s as carrera_invalid with zero statements",
    async (_name, scope, carreraId) => {
      expect(
        await createAsignatura(tx, scope, { ...input, carreraId }),
      ).toEqual({ kind: "carrera_invalid" });
      expect(statements).toHaveLength(0);
    },
  );

  it("refuses a carrera that does not exist and issues no insert", async () => {
    results.push([]);
    expect(
      await createAsignatura(tx, ALL, { ...input, carreraId: 99 }),
    ).toEqual({ kind: "carrera_invalid" });
    expect(methods()).toEqual(["select"]);
    expect(whereOf(0).params).toEqual([99]);
    expect(whereOf(0).sql).toContain('"Carrera"');
  });

  it("looks the natural key up by exact equality on the trimmed Codigo, unscoped", async () => {
    sentinel.on = true;
    results.push([{ id: 7 }], [], [{ id: 55 }]);
    await createAsignatura(tx, OWN, { ...input, codigo: " MAT101 " });
    expect(whereOf(1)).toEqual({
      sql: '"Asignatura"."Codigo" = $1',
      params: ["MAT101"],
    });
    expect(whereOf(1).sql).not.toMatch(/ilike|lower/i);
    expect(whereOf(1).sql).not.toContain("SCOPE_SENTINEL");
  });

  it("treats mat101 as a different code than MAT101 (no case folding)", async () => {
    results.push([{ id: 7 }], [], [{ id: 56 }]);
    expect(
      await createAsignatura(tx, OWN, { ...input, codigo: "mat101" }),
    ).toEqual({ kind: "created", id: 56 });
    expect(whereOf(1).params).toEqual(["mat101"]);
    expect(valuesOf(2)).toMatchObject({ codigo: "mat101" });
  });

  it.each([
    ["active, in scope", OWN, { carreraId: 7, activo: true }, true, true],
    ["inactive, in scope", OWN, { carreraId: 7, activo: false }, true, false],
    ["active, other carrera", OWN, { carreraId: 9, activo: true }, false, true],
    [
      "inactive, other carrera",
      OWN,
      { carreraId: 9, activo: false },
      false,
      false,
    ],
    [
      "any carrera for the all scope",
      ALL,
      { carreraId: 9, activo: false },
      true,
      false,
    ],
  ])(
    "returns codigo_taken for a match (%s) and inserts nothing",
    async (_name, scope, row, inScope, activo) => {
      results.push([{ id: 7 }], [row]);
      const carreraId = scope.kind === "all" ? 7 : undefined;
      expect(
        await createAsignatura(tx, scope, { ...input, carreraId }),
      ).toEqual({ kind: "codigo_taken", inScope, activo });
      expect(methods()).toEqual(["select", "select"]);
    },
  );

  it("inserts with the carrera from carreraIdForWrite and returns the new id", async () => {
    results.push([{ id: 7 }], [], [{ id: 55 }]);
    expect(await createAsignatura(tx, OWN, input)).toEqual({
      kind: "created",
      id: 55,
    });
    expect(methods()).toEqual(["select", "select", "insert"]);
    expect(valuesOf(2)).toEqual({
      codigo: "MAT101",
      nombre: "Calculus",
      carreraId: 7,
      horasTotales: 48,
    });
  });

  it("an unscoped actor chooses the carrera", async () => {
    results.push([{ id: 9 }], [], [{ id: 57 }]);
    await createAsignatura(tx, ALL, { ...input, carreraId: 9 });
    expect(valuesOf(2)).toMatchObject({ carreraId: 9 });
  });

  it("maps a 23505 read from error.cause.code to a conservative codigo_taken (A-7)", async () => {
    results.push([{ id: 7 }], [], rejecting({ cause: { code: "23505" } }));
    expect(await createAsignatura(tx, OWN, input)).toEqual({
      kind: "codigo_taken",
      inScope: false,
      activo: false,
    });
  });

  it("rethrows any other failure of the insert", async () => {
    const boom = new Error("boom");
    results.push([{ id: 7 }], [], rejecting(boom));
    await expect(createAsignatura(tx, OWN, input)).rejects.toBe(boom);
  });
});

describe("updateAsignatura", () => {
  const row = {
    id: 5,
    nombre: "Calculus",
    carreraId: 7,
    horasTotales: 48,
    activo: true,
  };
  const input = { nombre: "Calculus II", horasTotales: 64 };

  it("reads the row first, with the id and the scope in one WHERE", async () => {
    results.push([row], [{ id: 5 }]);
    await updateAsignatura(tx, OWN, 5, input);
    expect(methods()).toEqual(["select", "update"]);
    expect(whereOf(0)).toEqual(OWN_ROW_WHERE);
  });

  it("answers not_found without updating when the scoped select is empty", async () => {
    results.push([]);
    expect(await updateAsignatura(tx, OWN, 5, input)).toEqual({
      kind: "not_found",
    });
    expect(methods()).toEqual(["select"]);
  });

  it("refuses an inactive record (A-1) without updating", async () => {
    results.push([{ ...row, activo: false }]);
    expect(await updateAsignatura(tx, OWN, 5, input)).toEqual({
      kind: "inactive",
    });
    expect(methods()).toEqual(["select"]);
  });

  it("refuses a scoped actor naming another carrera and leaves the row", async () => {
    results.push([row]);
    expect(
      await updateAsignatura(tx, OWN, 5, { ...input, carreraId: 9 }),
    ).toEqual({ kind: "carrera_invalid" });
    expect(methods()).toEqual(["select"]);
  });

  it("lets an unscoped actor move the record to an existing carrera", async () => {
    results.push([row], [{ id: 9 }], [{ id: 5 }]);
    expect(
      await updateAsignatura(tx, ALL, 5, { ...input, carreraId: 9 }),
    ).toEqual({
      kind: "updated",
      id: 5,
      campos: ["nombre", "carreraId", "horasTotales"],
    });
    expect(methods()).toEqual(["select", "select", "update"]);
    expect(whereOf(1).params).toEqual([9]);
    expect(setOf(2)).toMatchObject({ carreraId: 9 });
  });

  it("refuses an unscoped actor naming a carrera that does not exist", async () => {
    results.push([row], []);
    expect(
      await updateAsignatura(tx, ALL, 5, { ...input, carreraId: 99 }),
    ).toEqual({ kind: "carrera_invalid" });
    expect(methods()).toEqual(["select", "select"]);
  });

  it("keeps the current carrera when none is named", async () => {
    results.push([row], [{ id: 5 }]);
    await updateAsignatura(tx, ALL, 5, input);
    expect(methods()).toEqual(["select", "update"]);
    expect(setOf(1)).toMatchObject({ carreraId: 7 });
  });

  it("diffs against the row read inside the transaction (last writer wins)", async () => {
    // another writer changed the horas after the form was rendered
    results.push(
      [{ ...row, nombre: "Calculus II", horasTotales: 99 }],
      [{ id: 5 }],
    );
    expect(await updateAsignatura(tx, OWN, 5, input)).toEqual({
      kind: "updated",
      id: 5,
      campos: ["horasTotales"],
    });
  });

  it("writes nothing when no field differs (no UPDATE statement)", async () => {
    results.push([row]);
    expect(
      await updateAsignatura(tx, OWN, 5, {
        nombre: "Calculus",
        horasTotales: 48,
        carreraId: 7,
      }),
    ).toEqual({ kind: "unchanged", id: 5 });
    expect(methods()).toEqual(["select"]);
  });

  it("updates by id and scope with exactly the editable keys, returning the id", async () => {
    results.push([row], [{ id: 5 }]);
    await updateAsignatura(tx, OWN, 5, input);
    expect(whereOf(1)).toEqual(OWN_ROW_WHERE);
    expect(Object.keys(setOf(1))).toEqual([
      "nombre",
      "carreraId",
      "horasTotales",
    ]);
    expect(setOf(1)).toEqual({
      nombre: "Calculus II",
      carreraId: 7,
      horasTotales: 64,
    });
    expect(Object.keys(calls(1, "returning")[0].args[0] as object)).toEqual([
      "id",
    ]);
  });

  it("never sets codigo or activo, even if the input carries them", async () => {
    results.push([row], [{ id: 5 }]);
    await updateAsignatura(tx, OWN, 5, {
      ...input,
      codigo: "HACK",
      activo: false,
    } as typeof input);
    expect(Object.keys(setOf(1))).not.toContain("codigo");
    expect(Object.keys(setOf(1))).not.toContain("activo");
  });

  it("answers not_found when the update returns no row", async () => {
    results.push([row], []);
    expect(await updateAsignatura(tx, OWN, 5, input)).toEqual({
      kind: "not_found",
    });
  });

  it("reports campos as a subset of the closed list", async () => {
    results.push([row], [{ id: 5 }]);
    const result = await updateAsignatura(tx, OWN, 5, input);
    if (result.kind !== "updated") throw new Error("expected updated");
    for (const field of result.campos) {
      expect(AUDITABLE_ASIGNATURA_FIELDS).toContain(field);
    }
    expect(result.campos).not.toContain("codigo");
    expect(result.campos).not.toContain("activo");
  });

  it("scope sentinel: the select and the update both carry the scope predicate", async () => {
    sentinel.on = true;
    results.push([row], [{ id: 5 }]);
    await updateAsignatura(tx, OWN, 5, input);
    expect(whereOf(0).sql).toContain("SCOPE_SENTINEL");
    expect(whereOf(1).sql).toContain("SCOPE_SENTINEL");
  });
});

describe("setAsignaturaActivo", () => {
  const row = { id: 5, activo: true };

  it("deactivate: not_found when the scoped select is empty", async () => {
    results.push([]);
    expect(await setAsignaturaActivo(tx, OWN, 5, false)).toEqual({
      kind: "not_found",
    });
    expect(methods()).toEqual(["select"]);
    expect(whereOf(0)).toEqual(OWN_ROW_WHERE);
  });

  it("deactivate: an already inactive record is unchanged with no update", async () => {
    results.push([{ ...row, activo: false }]);
    expect(await setAsignaturaActivo(tx, OWN, 5, false)).toEqual({
      kind: "unchanged",
      id: 5,
    });
    expect(methods()).toEqual(["select"]);
  });

  it("deactivate: counts the active grupos, then updates, on the same handle", async () => {
    results.push([row], [{ count: 0 }], [{ id: 5 }]);
    expect(await setAsignaturaActivo(tx, OWN, 5, false)).toEqual({
      kind: "changed",
      id: 5,
      activo: false,
    });
    expect(methods()).toEqual(["select", "select", "update"]);
    expect(calls(1, "from")[0].args[0]).toBe(grupo);
    expect(whereOf(1)).toEqual({
      sql: '("Grupo"."AsignaturaId" = $1 and "Grupo"."Activo" = $2)',
      params: [5, true],
    });
    expect(setOf(2)).toEqual({ activo: false });
    expect(whereOf(2)).toEqual(OWN_ROW_WHERE);
  });

  it("deactivate: active grupos refuse with their count and no update", async () => {
    results.push([row], [{ count: 3 }]);
    expect(await setAsignaturaActivo(tx, OWN, 5, false)).toEqual({
      kind: "has_active_groups",
      count: 3,
    });
    expect(methods()).toEqual(["select", "select"]);
  });

  it("deactivate: only inactive grupos do not block (the count sees none)", async () => {
    // the count statement filters on "Grupo"."Activo", so inactive grupos
    // never reach it; zero counted means the update proceeds
    results.push([row], [{ count: 0 }], [{ id: 5 }]);
    const result = await setAsignaturaActivo(tx, OWN, 5, false);
    expect(result.kind).toBe("changed");
    expect(whereOf(1).sql).toContain('"Grupo"."Activo"');
  });

  it("deactivate: answers not_found when the update returns no row", async () => {
    results.push([row], [{ count: 0 }], []);
    expect(await setAsignaturaActivo(tx, OWN, 5, false)).toEqual({
      kind: "not_found",
    });
  });

  it("reactivate: updates with no count query and nothing touching Grupo", async () => {
    results.push([{ ...row, activo: false }], [{ id: 5 }]);
    expect(await setAsignaturaActivo(tx, OWN, 5, true)).toEqual({
      kind: "changed",
      id: 5,
      activo: true,
    });
    expect(methods()).toEqual(["select", "update"]);
    expect(setOf(1)).toEqual({ activo: true });
    expect(statements.flat().some((c) => c.args.some((a) => a === grupo))).toBe(
      false,
    );
  });

  it("reactivate: an already active record is unchanged with no update", async () => {
    results.push([row]);
    expect(await setAsignaturaActivo(tx, ALL, 5, true)).toEqual({
      kind: "unchanged",
      id: 5,
    });
    expect(methods()).toEqual(["select"]);
  });

  it("scope sentinel: the select and the update both carry the scope predicate", async () => {
    sentinel.on = true;
    results.push([{ ...row, activo: false }], [{ id: 5 }]);
    await setAsignaturaActivo(tx, OWN, 5, true);
    expect(whereOf(0).sql).toContain("SCOPE_SENTINEL");
    expect(whereOf(1).sql).toContain("SCOPE_SENTINEL");
  });
});
