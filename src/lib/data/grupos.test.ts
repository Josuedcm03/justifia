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
    grupoRowInScope: (...args: Parameters<typeof actual.grupoRowInScope>) =>
      sentinel.on ? sql`SCOPE_SENTINEL` : actual.grupoRowInScope(...args),
  };
});

import { inscripcion } from "@/db/schema";
import { encodeDias } from "@/lib/catalog/dias";
import { ASIGNATURA_GRUPOS_MAX } from "@/lib/catalog/list-params";
import type { CatalogScope } from "@/lib/catalog/scope";
import type { Transaction } from "@/lib/data/audit";
import {
  buildGruposWhere,
  createGrupo,
  getGrupoById,
  listGrupos,
  listGruposByAsignatura,
  setGrupoActivo,
  updateGrupo,
} from "@/lib/data/grupos";

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

// A stored row as the database returns it: the days are still a mask.
const storedRow = {
  id: 11,
  asignaturaId: 5,
  asignaturaCodigo: "MAT101",
  asignaturaNombre: "Calculus",
  periodo: "2026-1",
  numeroGrupo: "1",
  docenteId: 3,
  docenteNombre: "Ada Lovelace",
  activo: true,
  origen: "manual" as const,
  dias: 17, // Monday (bit 0) + Friday (bit 4)
};
// The item that leaves the module: decoded days in week order, no mask.
const item = { ...storedRow, dias: ["lunes", "viernes"] };

describe("buildGruposWhere", () => {
  it("is undefined for the all scope with every state and no search", () => {
    expect(buildGruposWhere(ALL, { status: "all", q: "" })).toBeUndefined();
  });

  it("scopes through the Asignatura, not through the Grupo", () => {
    const { sql: text, params } = render(
      buildGruposWhere(OWN, { status: "all", q: "" }),
    );
    expect(text).toBe('"Asignatura"."CarreraId" = $1');
    expect(params).toEqual([7]);
  });

  it("active keeps only active rows, inactive only inactive ones", () => {
    expect(render(buildGruposWhere(ALL, { status: "active", q: "" })).sql).toBe(
      '"Grupo"."Activo"',
    );
    expect(
      render(buildGruposWhere(ALL, { status: "inactive", q: "" })).sql,
    ).toBe('not "Grupo"."Activo"');
  });

  it("searches asignatura Codigo and Nombre, Periodo, NumeroGrupo and docente name, escaped, as parameters", () => {
    const { sql: text, params } = render(
      buildGruposWhere(ALL, { status: "all", q: "a%b_c" }),
    );
    expect(text).toBe(
      '("Asignatura"."Codigo" ilike $1 or "Asignatura"."Nombre" ilike $2 or "Grupo"."Periodo" ilike $3 or "Grupo"."NumeroGrupo" ilike $4 or "Usuario"."NombreCompleto" ilike $5)',
    );
    expect(params).toEqual(Array(5).fill("%a\\%b\\_c%"));
    expect(text).not.toContain("a%b_c");
  });

  it("combines scope, state and search with AND", () => {
    const { sql: text, params } = render(
      buildGruposWhere(OWN, { status: "active", q: "mat" }),
    );
    expect(text).toBe(
      '("Asignatura"."CarreraId" = $1 and "Grupo"."Activo" and ("Asignatura"."Codigo" ilike $2 or "Asignatura"."Nombre" ilike $3 or "Grupo"."Periodo" ilike $4 or "Grupo"."NumeroGrupo" ilike $5 or "Usuario"."NombreCompleto" ilike $6))',
    );
    expect(params).toEqual([7, ...Array(5).fill("%mat%")]);
  });

  it("carries a literal false for the none scope", () => {
    expect(render(buildGruposWhere(NONE, { status: "all", q: "" })).sql).toBe(
      "false",
    );
  });

  it("never mentions the days: no filter and no search (A-DIAS-NOSEARCH)", () => {
    for (const scope of [ALL, OWN, NONE]) {
      for (const status of ["active", "inactive", "all"] as const) {
        for (const q of ["", "lunes", "17", "Dias"]) {
          const { sql: text } = render(buildGruposWhere(scope, { status, q }));
          expect(text).not.toContain("Dias");
        }
      }
    }
  });
});

describe("listGrupos", () => {
  const params = (page: number) => ({
    scope: OWN,
    status: "active" as const,
    q: "mat",
    page,
    pageSize: 10,
  });

  it("returns the page with decoded days, the total and the clamped page", async () => {
    results.push([{ count: 1 }], [storedRow]);
    expect(await listGrupos(params(1))).toEqual({
      data: [item],
      total: 1,
      page: 1,
      pageSize: 10,
      degraded: false,
    });
  });

  it("decodes a stored mask into week order, whatever the bit order of the sum", async () => {
    results.push(
      [{ count: 3 }],
      [
        { ...storedRow, id: 1, dias: 17 },
        { ...storedRow, id: 2, dias: 0 },
        { ...storedRow, id: 3, dias: 127 },
      ],
    );
    const { data } = await listGrupos(params(1));
    expect(data.map((row) => row.dias)).toEqual([
      ["lunes", "viernes"],
      [],
      [
        "lunes",
        "martes",
        "miercoles",
        "jueves",
        "viernes",
        "sabado",
        "domingo",
      ],
    ]);
  });

  it("never lets the mask leave the module: no numeric dias on an item", async () => {
    results.push([{ count: 1 }], [storedRow]);
    const { data } = await listGrupos(params(1));
    expect(Array.isArray(data[0].dias)).toBe(true);
    expect(typeof data[0].dias).not.toBe("number");
  });

  it("uses one where for the count and the page", async () => {
    results.push([{ count: 1 }], [storedRow]);
    await listGrupos(params(1));
    expect(statements).toHaveLength(2);
    expect(whereOf(0)).toEqual(whereOf(1));
    expect(whereOf(0).sql).toContain('"Asignatura"."CarreraId" = $1');
    expect(whereOf(0).sql).toContain('"Grupo"."Activo"');
    expect(whereOf(0).sql).toContain('"Usuario"."NombreCompleto" ilike');
  });

  it("joins the asignatura and the docente in the count too, so the shared where resolves", async () => {
    results.push([{ count: 1 }], [storedRow]);
    await listGrupos(params(1));
    expect(calls(0, "innerJoin")).toHaveLength(2);
    expect(calls(1, "innerJoin")).toHaveLength(2);
  });

  it("clamps an out-of-range page to the last page", async () => {
    results.push([{ count: 25 }], [storedRow]);
    const result = await listGrupos(params(99));
    expect(result.page).toBe(3);
    expect(calls(1, "limit")[0].args).toEqual([10]);
    expect(calls(1, "offset")[0].args).toEqual([20]);
  });

  it("clamps to page 1 when there are no rows", async () => {
    results.push([{ count: 0 }], []);
    const result = await listGrupos(params(4));
    expect(result).toMatchObject({ data: [], total: 0, page: 1 });
    expect(calls(1, "offset")[0].args).toEqual([0]);
  });

  it("projects the names, the origin and the stored Dias column, ordered deterministically", async () => {
    results.push([{ count: 1 }], [storedRow]);
    await listGrupos(params(1));
    const fields = calls(1, "select")[0].args[0] as Record<string, unknown>;
    expect(Object.keys(fields)).toEqual([
      "id",
      "asignaturaId",
      "asignaturaCodigo",
      "asignaturaNombre",
      "periodo",
      "numeroGrupo",
      "docenteId",
      "docenteNombre",
      "activo",
      "origen",
      "dias",
    ]);
    expect(render(sql`${fields.dias}`).sql).toBe('"Grupo"."Dias"');
    const order = (calls(1, "orderBy")[0].args as SQL[]).map(
      (part) => render(part).sql,
    );
    expect(order).toEqual([
      '"Asignatura"."Codigo" asc',
      '"Grupo"."Periodo" desc',
      '"Grupo"."NumeroGrupo" asc',
      '"Grupo"."Id" asc',
    ]);
  });

  it("projects no credential of the docente", async () => {
    results.push([{ count: 1 }], [storedRow]);
    await listGrupos(params(1));
    const fields = calls(1, "select")[0].args[0] as Record<string, unknown>;
    for (const key of ["hashClave", "cif", "correo", "telefono"]) {
      expect(fields).not.toHaveProperty(key);
    }
  });

  it("degrades to an empty page when the database throws", async () => {
    failure = new Error("connection refused");
    expect(await listGrupos(params(2))).toEqual({
      data: [],
      total: 0,
      page: 1,
      pageSize: 10,
      degraded: true,
    });
  });

  it("degrades instead of leaking a mask that is out of range", async () => {
    results.push([{ count: 1 }], [{ ...storedRow, dias: 128 }]);
    expect(await listGrupos(params(1))).toMatchObject({
      data: [],
      degraded: true,
    });
  });
});

describe("getGrupoById", () => {
  it("carries the id and the scope in one WHERE, through the Asignatura", async () => {
    results.push([storedRow]);
    await getGrupoById(OWN, 11);
    expect(whereOf(0)).toEqual({
      sql: '("Grupo"."Id" = $1 and "Grupo"."AsignaturaId" in (select "Asignatura"."Id" from "Asignatura" where "Asignatura"."CarreraId" = $2))',
      params: [11, 7],
    });
  });

  it("returns the item with decoded days from one statement", async () => {
    results.push([storedRow]);
    expect(await getGrupoById(ALL, 11)).toEqual(item);
    expect(statements).toHaveLength(1);
    expect(whereOf(0)).toEqual({ sql: '"Grupo"."Id" = $1', params: [11] });
    const fields = calls(0, "select")[0].args[0] as Record<string, unknown>;
    expect(render(sql`${fields.dias}`).sql).toBe('"Grupo"."Dias"');
  });

  it("returns an empty set for a group whose days were never recorded", async () => {
    results.push([{ ...storedRow, dias: 0 }]);
    expect((await getGrupoById(ALL, 11))?.dias).toEqual([]);
  });

  it("is null identically for a missing id and for a foreign one", async () => {
    results.push([], []);
    const missing = await getGrupoById(ALL, 999);
    const foreign = await getGrupoById(OWN, 11);
    expect(missing).toBeNull();
    expect(foreign).toBeNull();
    expect(whereOf(1).sql).toContain('"Asignatura"."CarreraId" = $2');
  });

  it("matches nothing for the none scope", async () => {
    results.push([]);
    expect(await getGrupoById(NONE, 11)).toBeNull();
    expect(whereOf(0).sql).toContain("false");
  });

  it("is not fail-soft: a thrown error reaches the caller", async () => {
    failure = new Error("connection refused");
    await expect(getGrupoById(OWN, 11)).rejects.toThrow("connection refused");
  });
});

describe("listGruposByAsignatura", () => {
  const rowsOf = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ ...storedRow, id: i + 1 }));

  it("filters by the bound AsignaturaId and the scope, with no status term", async () => {
    results.push([]);
    await listGruposByAsignatura(OWN, 5);
    expect(statements).toHaveLength(1);
    const { sql: text, params } = whereOf(0);
    expect(text).toBe(
      '("Grupo"."AsignaturaId" = $1 and "Asignatura"."CarreraId" = $2)',
    );
    expect(params).toEqual([5, 7]);
    expect(text).not.toContain('"Grupo"."Activo"');
  });

  it("joins the asignatura and the docente, projecting the list columns", async () => {
    results.push([]);
    await listGruposByAsignatura(ALL, 5);
    expect(calls(0, "innerJoin")).toHaveLength(2);
    const fields = calls(0, "select")[0].args[0] as Record<string, unknown>;
    expect(Object.keys(fields)).toEqual([
      "id",
      "asignaturaId",
      "asignaturaCodigo",
      "asignaturaNombre",
      "periodo",
      "numeroGrupo",
      "docenteId",
      "docenteNombre",
      "activo",
      "origen",
      "dias",
    ]);
  });

  it("orders by period desc, number asc, id asc and reads one row past the cap", async () => {
    results.push([]);
    await listGruposByAsignatura(ALL, 5);
    const order = (calls(0, "orderBy")[0].args as SQL[]).map(
      (part) => render(part).sql,
    );
    expect(order).toEqual([
      '"Grupo"."Periodo" desc',
      '"Grupo"."NumeroGrupo" asc',
      '"Grupo"."Id" asc',
    ]);
    expect(calls(0, "limit")[0].args).toEqual([ASIGNATURA_GRUPOS_MAX + 1]);
    expect(calls(0, "offset")).toHaveLength(0);
  });

  it("answers MAX rows and truncated when MAX + 1 rows come back", async () => {
    results.push(rowsOf(ASIGNATURA_GRUPOS_MAX + 1));
    const result = await listGruposByAsignatura(ALL, 5);
    expect(result.data).toHaveLength(ASIGNATURA_GRUPOS_MAX);
    expect(result.data.at(-1)?.id).toBe(ASIGNATURA_GRUPOS_MAX);
    expect(result).toMatchObject({ truncated: true, degraded: false });
  });

  it("answers exactly MAX rows as not truncated", async () => {
    results.push(rowsOf(ASIGNATURA_GRUPOS_MAX));
    const result = await listGruposByAsignatura(ALL, 5);
    expect(result.data).toHaveLength(ASIGNATURA_GRUPOS_MAX);
    expect(result).toMatchObject({ truncated: false, degraded: false });
  });

  it("returns active and inactive rows with decoded days, never the mask", async () => {
    results.push([
      { ...storedRow, id: 1, dias: 17 },
      { ...storedRow, id: 2, activo: false, dias: 0 },
    ]);
    expect(await listGruposByAsignatura(ALL, 5)).toEqual({
      data: [
        { ...item, id: 1 },
        { ...item, id: 2, activo: false, dias: [] },
      ],
      truncated: false,
      degraded: false,
    });
  });

  it("degrades when the database throws", async () => {
    failure = new Error("connection refused");
    expect(await listGruposByAsignatura(OWN, 5)).toEqual({
      data: [],
      truncated: false,
      degraded: true,
    });
  });

  it("degrades instead of leaking a mask that is out of range", async () => {
    results.push([{ ...storedRow, dias: 128 }]);
    expect(await listGruposByAsignatura(ALL, 5)).toEqual({
      data: [],
      truncated: false,
      degraded: true,
    });
  });

  it("matches nothing for the none scope", async () => {
    results.push([]);
    await listGruposByAsignatura(NONE, 5);
    expect(whereOf(0).sql).toContain("false");
  });
});

describe("scope sentinel: every Grupo read carries the scope predicate", () => {
  beforeEach(() => {
    sentinel.on = true;
  });

  it("listGrupos: the count and the page", async () => {
    results.push([{ count: 1 }], []);
    await listGrupos({
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

  it("getGrupoById", async () => {
    results.push([]);
    await getGrupoById(OWN, 11);
    expect(whereOf(0).sql).toContain("SCOPE_SENTINEL");
  });

  it("listGruposByAsignatura", async () => {
    results.push([]);
    await listGruposByAsignatura(OWN, 5);
    expect(statements).toHaveLength(1);
    expect(whereOf(0).sql).toContain("SCOPE_SENTINEL");
  });

  it("every statement issued has a where, and every where has the sentinel", async () => {
    results.push([{ count: 0 }], [], [], []);
    await listGrupos({
      scope: OWN,
      status: "active",
      q: "x",
      page: 1,
      pageSize: 10,
    });
    await getGrupoById(OWN, 1);
    await listGruposByAsignatura(OWN, 1);
    expect(statements).toHaveLength(4);
    for (let i = 0; i < statements.length; i += 1) {
      expect(calls(i, "where")).toHaveLength(1);
      expect(whereOf(i).sql).toContain("SCOPE_SENTINEL");
    }
  });
});

// ---- Writes. The functions take the transaction handle; this double records
// every statement it issues into `statements` and resolves the queued results
// in order. `rejecting` queues a thrown error.
const tx = {
  select: (...args: unknown[]) => statement({ method: "select", args }),
  insert: (...args: unknown[]) => statement({ method: "insert", args }),
  update: (...args: unknown[]) => statement({ method: "update", args }),
} as unknown as Transaction;
const rejecting = (error: unknown) => ({
  then: (_resolve: unknown, reject: (reason: unknown) => void) => reject(error),
});
const methods = () => statements.map((s) => s[0].method);
const valuesOf = (i: number) => calls(i, "values")[0].args[0] as object;

describe("createGrupo", () => {
  const input = {
    asignaturaId: 5,
    periodo: "2026-1",
    numeroGrupo: "1",
    docenteId: 3,
    dias: ["lunes", "miercoles"] as const,
  };
  const activeAsignatura = { id: 5, activo: true };
  const activeDocente = { activo: true, rol: "docente" };
  // asignatura select, docente select, natural-key select, insert
  const happy = () =>
    results.push([activeAsignatura], [activeDocente], [], [{ id: 77 }]);

  it("reads the Asignatura first, with the scope predicate", async () => {
    happy();
    await createGrupo(tx, OWN, input);
    expect(methods()).toEqual(["select", "select", "select", "insert"]);
    expect(whereOf(0)).toEqual({
      sql: '("Asignatura"."Id" = $1 and "Asignatura"."CarreraId" = $2)',
      params: [5, 7],
    });
  });

  it("the Asignatura read carries the scope predicate (sentinel)", async () => {
    sentinel.on = true;
    happy();
    await createGrupo(tx, OWN, input);
    expect(whereOf(0).sql).toContain("SCOPE_SENTINEL");
  });

  it.each([
    ["missing", []],
    ["inactive", [{ id: 5, activo: false }]],
  ])(
    "an %s Asignatura is asignatura_unavailable with zero inserts",
    async (_name, row) => {
      results.push(row);
      expect(await createGrupo(tx, OWN, input)).toEqual({
        kind: "asignatura_unavailable",
      });
      expect(methods()).toEqual(["select"]);
    },
  );

  it("a foreign Asignatura answers like a missing one (scoped read finds no row)", async () => {
    results.push([], []);
    const foreign = await createGrupo(tx, OWN, input);
    const missing = await createGrupo(tx, ALL, { ...input, asignaturaId: 999 });
    expect(foreign).toEqual(missing);
    expect(foreign).toEqual({ kind: "asignatura_unavailable" });
    expect(methods()).toEqual(["select", "select"]);
  });

  it("the none scope reaches nothing", async () => {
    results.push([]);
    expect(await createGrupo(tx, NONE, input)).toEqual({
      kind: "asignatura_unavailable",
    });
    expect(whereOf(0).sql).toContain("false");
    expect(methods()).toEqual(["select"]);
  });

  it("reads the docente by id after the Asignatura", async () => {
    happy();
    await createGrupo(tx, ALL, input);
    expect(whereOf(1).params).toEqual([3]);
    expect(whereOf(1).sql).toContain('"Usuario"."Id"');
  });

  it.each([
    ["administrador"],
    ["coordinacion"],
    ["secretaria"],
    ["estudiante"],
  ])("a user with role %s is docente_unavailable", async (rol) => {
    results.push([activeAsignatura], [{ activo: true, rol }]);
    expect(await createGrupo(tx, ALL, input)).toEqual({
      kind: "docente_unavailable",
    });
    expect(methods()).toEqual(["select", "select"]);
  });

  it.each([
    ["inactive", [{ activo: false, rol: "docente" }]],
    ["missing", []],
  ])("an %s docente is docente_unavailable", async (_name, row) => {
    results.push([activeAsignatura], row);
    expect(await createGrupo(tx, ALL, input)).toEqual({
      kind: "docente_unavailable",
    });
    expect(methods()).toEqual(["select", "select"]);
  });

  it("checks the Asignatura before the docente", async () => {
    results.push([], [activeDocente]);
    expect(await createGrupo(tx, ALL, input)).toEqual({
      kind: "asignatura_unavailable",
    });
    expect(methods()).toEqual(["select"]);
  });

  it("looks the natural key up with the asignaturaId of the scoped select", async () => {
    results.push([{ id: 6, activo: true }], [activeDocente], [], [{ id: 77 }]);
    await createGrupo(tx, OWN, input);
    expect(whereOf(2).params).toEqual([6, "2026-1", "1"]);
    expect(whereOf(2).sql).toContain('"Grupo"."Periodo"');
    expect(whereOf(2).sql).toContain('"Grupo"."NumeroGrupo"');
    expect(whereOf(2).sql).not.toMatch(/ilike|lower/i);
  });

  it.each([
    [true, "active"],
    [false, "inactive"],
  ])(
    "a match with activo=%s is grupo_taken and inserts nothing",
    async (activo) => {
      results.push([activeAsignatura], [activeDocente], [{ activo }]);
      expect(await createGrupo(tx, ALL, input)).toEqual({
        kind: "grupo_taken",
        activo,
      });
      expect(methods()).toEqual(["select", "select", "select"]);
    },
  );

  it("a duplicate natural key with other days is still grupo_taken", async () => {
    results.push([activeAsignatura], [activeDocente], [{ activo: true }]);
    expect(await createGrupo(tx, ALL, { ...input, dias: ["domingo"] })).toEqual(
      { kind: "grupo_taken", activo: true },
    );
    expect(methods()).not.toContain("insert");
  });

  it("inserts a manual, active-by-default Grupo and returns created", async () => {
    happy();
    expect(await createGrupo(tx, OWN, input)).toEqual({
      kind: "created",
      id: 77,
    });
    expect(valuesOf(3)).toEqual({
      asignaturaId: 5,
      periodo: "2026-1",
      numeroGrupo: "1",
      docenteId: 3,
      origen: "manual",
      dias: encodeDias(["lunes", "miercoles"]),
    });
  });

  it("takes the inserted asignaturaId from the scoped select, never the input", async () => {
    results.push([{ id: 6, activo: true }], [activeDocente], [], [{ id: 77 }]);
    await createGrupo(tx, OWN, input);
    expect(valuesOf(3)).toMatchObject({ asignaturaId: 6 });
  });

  it("stores the set of days whatever the selection order or duplicates", async () => {
    happy();
    await createGrupo(tx, ALL, { ...input, dias: ["miercoles", "lunes"] });
    expect(valuesOf(3)).toMatchObject({
      dias: encodeDias(["lunes", "miercoles"]),
    });
    statements.length = 0;
    happy();
    await createGrupo(tx, ALL, { ...input, dias: ["lunes", "lunes"] });
    expect(valuesOf(3)).toMatchObject({ dias: encodeDias(["lunes"]) });
  });

  it("accepts an empty set of days and stores 0 (the schema owns the minimum)", async () => {
    happy();
    expect(await createGrupo(tx, ALL, { ...input, dias: [] })).toEqual({
      kind: "created",
      id: 77,
    });
    expect(valuesOf(3)).toMatchObject({ dias: 0 });
  });

  it.each([
    ["another period", { periodo: "2026-2" }, 5],
    ["another asignatura", {}, 8],
  ])("(%s) next to an existing group proceeds", async (_n, patch, asigId) => {
    results.push(
      [{ id: asigId, activo: true }],
      [activeDocente],
      [],
      [{ id: 78 }],
    );
    expect(await createGrupo(tx, ALL, { ...input, ...patch })).toEqual({
      kind: "created",
      id: 78,
    });
  });

  it("two groups of one Asignatura with different days both insert", async () => {
    happy();
    await createGrupo(tx, ALL, { ...input, numeroGrupo: "1", dias: ["lunes"] });
    results.push([activeAsignatura], [activeDocente], [], [{ id: 78 }]);
    await createGrupo(tx, ALL, {
      ...input,
      numeroGrupo: "2",
      dias: ["martes"],
    });
    expect(methods().filter((m) => m === "insert")).toHaveLength(2);
  });

  it("maps a 23505 from the insert to a conservative grupo_taken (A-7)", async () => {
    results.push(
      [activeAsignatura],
      [activeDocente],
      [],
      rejecting({ cause: { code: "23505" } }),
    );
    expect(await createGrupo(tx, ALL, input)).toEqual({
      kind: "grupo_taken",
      activo: false,
    });
  });

  it("rethrows any other failure of the insert", async () => {
    const boom = new Error("boom");
    results.push([activeAsignatura], [activeDocente], [], rejecting(boom));
    await expect(createGrupo(tx, ALL, input)).rejects.toBe(boom);
  });

  it("never deletes and never writes an Inscripcion", async () => {
    happy();
    await createGrupo(tx, ALL, input);
    expect(methods().every((m) => m === "select" || m === "insert")).toBe(true);
  });
});

describe("updateGrupo", () => {
  const MON_WED = ["lunes", "miercoles"] as const;
  const stored = {
    asignaturaId: 5,
    docenteId: 3,
    activo: true,
    dias: encodeDias(MON_WED),
  };
  const same = { docenteId: 3, dias: MON_WED };
  const parent = { activo: true };
  const docente = { activo: true, rol: "docente" };
  const setOf = (i: number) => calls(i, "set")[0].args[0] as object;
  const NOT_FOUND = { kind: "not_found" };

  it("reads the Grupo first, through the scope, with the stored mask", async () => {
    results.push([stored]);
    await updateGrupo(tx, OWN, 11, same);
    expect(whereOf(0)).toEqual({
      sql: '("Grupo"."Id" = $1 and "Grupo"."AsignaturaId" in (select "Asignatura"."Id" from "Asignatura" where "Asignatura"."CarreraId" = $2))',
      params: [11, 7],
    });
    expect(Object.keys(calls(0, "select")[0].args[0] as object)).toEqual([
      "asignaturaId",
      "docenteId",
      "activo",
      "dias",
    ]);
  });

  it("is not_found for a missing or foreign Grupo, with no update", async () => {
    results.push([], []);
    const missing = await updateGrupo(tx, ALL, 999, same);
    const foreign = await updateGrupo(tx, OWN, 11, same);
    expect(missing).toEqual(NOT_FOUND);
    expect(foreign).toEqual(NOT_FOUND);
    expect(methods()).toEqual(["select", "select"]);
  });

  it("is inactive for an inactive Grupo, with nothing else issued (A-1)", async () => {
    results.push([{ ...stored, activo: false }]);
    expect(await updateGrupo(tx, ALL, 11, { ...same, docenteId: 4 })).toEqual({
      kind: "inactive",
    });
    expect(methods()).toEqual(["select"]);
  });

  it("case 1: nothing changed is unchanged, with no update and no parent read", async () => {
    results.push([stored]);
    expect(await updateGrupo(tx, ALL, 11, same)).toEqual({
      kind: "unchanged",
      id: 11,
    });
    expect(methods()).toEqual(["select"]);
  });

  it.each([
    ["reordered", ["miercoles", "lunes"]],
    ["with duplicates", ["lunes", "miercoles", "lunes"]],
  ] as const)("the same set %s is unchanged", async (_n, dias) => {
    results.push([stored]);
    expect(await updateGrupo(tx, ALL, 11, { docenteId: 3, dias })).toEqual({
      kind: "unchanged",
      id: 11,
    });
    expect(methods()).toEqual(["select"]);
  });

  it("case 1 does not validate the current docente, even if it became inactive", async () => {
    // Only one result is queued: any docente read would resolve to [] and fail.
    results.push([stored]);
    expect(await updateGrupo(tx, ALL, 11, same)).toMatchObject({
      kind: "unchanged",
    });
    expect(statements).toHaveLength(1);
  });

  it("case 2: docente only reads the Asignatura, then the docente, then updates", async () => {
    results.push([stored], [parent], [docente], [{ id: 11 }]);
    expect(await updateGrupo(tx, OWN, 11, { ...same, docenteId: 4 })).toEqual({
      kind: "updated",
      id: 11,
      campos: ["docenteId"],
    });
    expect(methods()).toEqual(["select", "select", "select", "update"]);
    expect(Object.keys(setOf(3))).toEqual(["docenteId"]);
    expect(setOf(3)).toEqual({ docenteId: 4 });
    expect(whereOf(2).params).toEqual([4]);
  });

  it("the parent Asignatura read uses the Grupo's own asignaturaId and the scope", async () => {
    results.push([{ ...stored, asignaturaId: 6 }], [parent], [docente], [{}]);
    await updateGrupo(tx, OWN, 11, { ...same, docenteId: 4 });
    expect(whereOf(1).params).toEqual([6, 7]);
    statements.length = 0;
    sentinel.on = true;
    results.push([stored], [parent], [docente], [{}]);
    await updateGrupo(tx, OWN, 11, { ...same, docenteId: 4 });
    expect(whereOf(1).sql).toContain("SCOPE_SENTINEL");
  });

  it.each([
    ["missing", []],
    ["inactive", [{ activo: false }]],
  ])(
    "a docente change with a %s Asignatura is asignatura_unavailable",
    async (_n, row) => {
      results.push([stored], row);
      expect(await updateGrupo(tx, ALL, 11, { ...same, docenteId: 4 })).toEqual(
        {
          kind: "asignatura_unavailable",
        },
      );
      expect(methods()).toEqual(["select", "select"]);
    },
  );

  it.each([
    ["administrador"],
    ["coordinacion"],
    ["secretaria"],
    ["estudiante"],
  ])("a new docente with role %s is docente_unavailable", async (rol) => {
    results.push([stored], [parent], [{ activo: true, rol }]);
    expect(await updateGrupo(tx, ALL, 11, { ...same, docenteId: 4 })).toEqual({
      kind: "docente_unavailable",
    });
    expect(methods()).not.toContain("update");
  });

  it.each([
    ["inactive", [{ activo: false, rol: "docente" }]],
    ["missing", []],
  ])("a new %s docente is docente_unavailable", async (_n, row) => {
    results.push([stored], [parent], row);
    expect(await updateGrupo(tx, ALL, 11, { ...same, docenteId: 4 })).toEqual({
      kind: "docente_unavailable",
    });
    expect(methods()).toEqual(["select", "select", "select"]);
  });

  it("case 3: days only runs no parent read and sets exactly dias", async () => {
    results.push([stored], [{ id: 11 }]);
    expect(
      await updateGrupo(tx, OWN, 11, { docenteId: 3, dias: ["martes"] }),
    ).toEqual({
      kind: "updated",
      id: 11,
      campos: ["dias"],
    });
    expect(methods()).toEqual(["select", "update"]);
    expect(Object.keys(setOf(1))).toEqual(["dias"]);
    expect(setOf(1)).toEqual({ dias: encodeDias(["martes"]) });
  });

  it("case 3 stores the set whatever the order or duplicates, and an empty set as 0", async () => {
    results.push([{ ...stored, dias: 0 }], [{ id: 11 }]);
    await updateGrupo(tx, ALL, 11, {
      docenteId: 3,
      dias: ["viernes", "lunes", "lunes"],
    });
    expect(setOf(1)).toEqual({ dias: encodeDias(["lunes", "viernes"]) });
    statements.length = 0;
    results.push([stored], [{ id: 11 }]);
    await updateGrupo(tx, ALL, 11, { docenteId: 3, dias: [] });
    expect(setOf(1)).toEqual({ dias: 0 });
  });

  it("a group with no recorded days and an empty selection is unchanged", async () => {
    results.push([{ ...stored, dias: 0 }]);
    expect(await updateGrupo(tx, ALL, 11, { docenteId: 3, dias: [] })).toEqual({
      kind: "unchanged",
      id: 11,
    });
  });

  it("case 4: both changed run the parent checks and set docenteId then dias", async () => {
    results.push([stored], [parent], [docente], [{ id: 11 }]);
    expect(
      await updateGrupo(tx, ALL, 11, { docenteId: 4, dias: ["jueves"] }),
    ).toEqual({
      kind: "updated",
      id: 11,
      campos: ["docenteId", "dias"],
    });
    expect(methods()).toEqual(["select", "select", "select", "update"]);
    expect(Object.keys(setOf(3))).toEqual(["docenteId", "dias"]);
    expect(setOf(3)).toEqual({ docenteId: 4, dias: encodeDias(["jueves"]) });
  });

  it("case 4 refuses on an unavailable docente without writing the days", async () => {
    results.push([stored], [parent], []);
    expect(
      await updateGrupo(tx, ALL, 11, { docenteId: 4, dias: ["jueves"] }),
    ).toEqual({
      kind: "docente_unavailable",
    });
    expect(methods()).not.toContain("update");
  });

  it("the update carries the scope predicate and zero rows is not_found", async () => {
    sentinel.on = true;
    results.push([stored], []);
    expect(
      await updateGrupo(tx, OWN, 11, { docenteId: 3, dias: ["martes"] }),
    ).toEqual(NOT_FOUND);
    expect(whereOf(0).sql).toContain("SCOPE_SENTINEL");
    expect(whereOf(1).sql).toContain("SCOPE_SENTINEL");
    expect(calls(1, "returning")).toHaveLength(1);
  });

  it("diffs against the row read inside the transaction (last writer wins)", async () => {
    results.push([{ ...stored, dias: encodeDias(["martes"]) }], [{ id: 11 }]);
    const result = await updateGrupo(tx, ALL, 11, {
      docenteId: 3,
      dias: ["martes", "jueves"],
    });
    expect(result).toMatchObject({ campos: ["dias"] });
  });

  it("never names the natural key, the origin or the active flag, and never deletes", async () => {
    results.push([stored], [parent], [docente], [{ id: 11 }]);
    await updateGrupo(tx, ALL, 11, { docenteId: 4, dias: ["jueves"] });
    for (const key of [
      "asignaturaId",
      "periodo",
      "numeroGrupo",
      "origen",
      "activo",
    ]) {
      expect(setOf(3)).not.toHaveProperty(key);
    }
    expect(methods().every((m) => m === "select" || m === "update")).toBe(true);
  });
});

describe("setGrupoActivo", () => {
  const row = (activo: boolean) => ({ asignaturaId: 5, docenteId: 3, activo });
  const parent = { activo: true };
  const docente = { activo: true, rol: "docente" };
  const setOf = (i: number) => calls(i, "set")[0].args[0] as object;

  it("reads the Grupo first, through the scope, without the days", async () => {
    results.push([row(true)]);
    await setGrupoActivo(tx, OWN, 11, true);
    expect(whereOf(0)).toEqual({
      sql: '("Grupo"."Id" = $1 and "Grupo"."AsignaturaId" in (select "Asignatura"."Id" from "Asignatura" where "Asignatura"."CarreraId" = $2))',
      params: [11, 7],
    });
    expect(Object.keys(calls(0, "select")[0].args[0] as object)).toEqual([
      "asignaturaId",
      "docenteId",
      "activo",
    ]);
  });

  it("is not_found for a missing or foreign Grupo, with no update", async () => {
    results.push([], []);
    expect(await setGrupoActivo(tx, ALL, 999, false)).toEqual({
      kind: "not_found",
    });
    expect(await setGrupoActivo(tx, OWN, 11, true)).toEqual({
      kind: "not_found",
    });
    expect(methods()).toEqual(["select", "select"]);
  });

  // The parent states of the table are never read: only the Grupo is.
  it.each([
    ["the Asignatura is inactive"],
    ["the docente is inactive"],
    ["the docente has another role"],
  ])("deactivates even when %s, reading no parent", async () => {
    results.push([row(true)], [{ id: 11 }]);
    expect(await setGrupoActivo(tx, ALL, 11, false)).toEqual({
      kind: "changed",
      id: 11,
      activo: false,
    });
    expect(methods()).toEqual(["select", "update"]);
  });

  it("never issues a statement that touches Inscripcion", async () => {
    results.push([row(true)], [{ id: 11 }]);
    await setGrupoActivo(tx, ALL, 11, false);
    results.push([row(false)], [parent], [docente], [{ id: 11 }]);
    await setGrupoActivo(tx, ALL, 11, true);
    expect(statements.flat().some((c) => c.args.includes(inscripcion))).toBe(
      false,
    );
    expect(methods().every((m) => m === "select" || m === "update")).toBe(true);
  });

  it.each([
    [false, false],
    [true, true],
  ])(
    "a Grupo already at activo=%s answers unchanged with no write",
    async (current, target) => {
      results.push([row(current)]);
      expect(await setGrupoActivo(tx, ALL, 11, target)).toEqual({
        kind: "unchanged",
        id: 11,
      });
      expect(methods()).toEqual(["select"]);
    },
  );

  it("the SET names only activo, in both directions", async () => {
    results.push([row(true)], [{ id: 11 }]);
    await setGrupoActivo(tx, ALL, 11, false);
    expect(setOf(1)).toEqual({ activo: false });
    statements.length = 0;
    results.push([row(false)], [parent], [docente], [{ id: 11 }]);
    await setGrupoActivo(tx, ALL, 11, true);
    expect(setOf(3)).toEqual({ activo: true });
  });

  it("reactivates when both parents are valid, reading them by the Grupo's own ids", async () => {
    results.push(
      [{ asignaturaId: 6, docenteId: 4, activo: false }],
      [parent],
      [docente],
      [{ id: 11 }],
    );
    expect(await setGrupoActivo(tx, OWN, 11, true)).toEqual({
      kind: "changed",
      id: 11,
      activo: true,
    });
    expect(methods()).toEqual(["select", "select", "select", "update"]);
    expect(whereOf(1).params).toEqual([6, 7]);
    expect(whereOf(2).params).toEqual([4]);
  });

  it.each([
    ["missing", []],
    ["inactive", [{ activo: false }]],
  ])(
    "an %s Asignatura blocks reactivation, checked before the docente",
    async (_n, found) => {
      results.push([row(false)], found, [docente]);
      expect(await setGrupoActivo(tx, ALL, 11, true)).toEqual({
        kind: "asignatura_unavailable",
      });
      expect(methods()).toEqual(["select", "select"]);
    },
  );

  it.each([
    ["inactive", { activo: false, rol: "docente" }],
    ["administrador", { activo: true, rol: "administrador" }],
    ["coordinacion", { activo: true, rol: "coordinacion" }],
    ["secretaria", { activo: true, rol: "secretaria" }],
    ["estudiante", { activo: true, rol: "estudiante" }],
  ])("a %s docente blocks reactivation", async (_n, found) => {
    results.push([row(false)], [parent], [found]);
    expect(await setGrupoActivo(tx, ALL, 11, true)).toEqual({
      kind: "docente_unavailable",
    });
    expect(methods()).not.toContain("update");
  });

  it("a missing docente blocks reactivation", async () => {
    results.push([row(false)], [parent], []);
    expect(await setGrupoActivo(tx, ALL, 11, true)).toEqual({
      kind: "docente_unavailable",
    });
  });

  it("the parent read and the update carry the scope predicate (sentinel); zero rows is not_found", async () => {
    sentinel.on = true;
    results.push([row(false)], [parent], [docente], []);
    expect(await setGrupoActivo(tx, OWN, 11, true)).toEqual({
      kind: "not_found",
    });
    expect(whereOf(0).sql).toContain("SCOPE_SENTINEL");
    expect(whereOf(1).sql).toContain("SCOPE_SENTINEL");
    expect(whereOf(3).sql).toContain("SCOPE_SENTINEL");
  });

  it("is blind to the days: a group with mask 0 toggles like any other", async () => {
    results.push([{ ...row(true), dias: 0 }], [{ id: 11 }]);
    expect(await setGrupoActivo(tx, ALL, 11, false)).toMatchObject({
      kind: "changed",
    });
    statements.length = 0;
    results.push(
      [{ ...row(false), dias: 0 }],
      [parent],
      [docente],
      [{ id: 11 }],
    );
    expect(await setGrupoActivo(tx, ALL, 11, true)).toMatchObject({
      kind: "changed",
    });
    for (let i = 0; i < statements.length; i += 1) {
      const fields = calls(i, "select")[0]?.args[0] as object | undefined;
      expect(Object.keys(fields ?? {})).not.toContain("dias");
    }
    expect(Object.keys(setOf(3))).toEqual(["activo"]);
  });
});
