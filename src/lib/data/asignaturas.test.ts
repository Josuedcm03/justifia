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

  // CM-ASG-9: the third member of the `or`, a correlated `exists` over the
  // groups of the Asignatura matching on Periodo or the docente name.
  const GROUP_EXISTS = (first: number) =>
    `exists (select 1 from "Grupo" inner join "Usuario" on "Usuario"."Id" = "Grupo"."DocenteId" where ("Grupo"."AsignaturaId" = "Asignatura"."Id" and ("Grupo"."Periodo" ilike $${first} or "Usuario"."NombreCompleto" ilike $${first + 1})))`;

  it("searches Codigo OR Nombre OR a group's Periodo or docente, escaped, as parameters", () => {
    const { sql: text, params } = render(
      buildAsignaturasWhere(ALL, { status: "all", q: "a%b_c" }),
    );
    expect(text).toBe(
      `("Asignatura"."Codigo" ilike $1 or "Asignatura"."Nombre" ilike $2 or ${GROUP_EXISTS(3)})`,
    );
    expect(params).toEqual([
      "%a\\%b\\_c%",
      "%a\\%b\\_c%",
      "%a\\%b\\_c%",
      "%a\\%b\\_c%",
    ]);
    expect(text).not.toContain("a%b_c");
  });

  it("does not search the group number or the days, and ignores the group status (B7, U9)", () => {
    const { sql: text } = render(
      buildAsignaturasWhere(ALL, { status: "all", q: "7" }),
    );
    expect(text).not.toContain("NumeroGrupo");
    expect(text).not.toContain('"Dias"');
    expect(text).not.toContain('"Grupo"."Activo"');
  });

  it("combines scope, state and search with AND", () => {
    const { sql: text, params } = render(
      buildAsignaturasWhere(OWN, { status: "active", q: "mat" }),
    );
    expect(text).toBe(
      `("Asignatura"."CarreraId" = $1 and "Asignatura"."Activo" and ("Asignatura"."Codigo" ilike $2 or "Asignatura"."Nombre" ilike $3 or ${GROUP_EXISTS(4)}))`,
    );
    expect(params).toEqual([7, "%mat%", "%mat%", "%mat%", "%mat%"]);
  });

  it("keeps the scope outside the group condition, so a foreign group reveals nothing", () => {
    const { sql: text } = render(
      buildAsignaturasWhere(NONE, { status: "all", q: "perez" }),
    );
    expect(text.startsWith("(false and (")).toBe(true);
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
  const params = (page: number, q = "mat") => ({
    scope: OWN,
    status: "active" as const,
    q,
    page,
    pageSize: 10,
  });
  const noMatches = { gruposCoincidentes: [], gruposCoincidentesTotal: 0 };

  it("returns the page, the total and the clamped page", async () => {
    results.push([{ count: 1 }], [item]);
    expect(await listAsignaturas(params(1))).toEqual({
      data: [{ ...item, ...noMatches }],
      total: 1,
      page: 1,
      pageSize: 10,
      degraded: false,
    });
  });

  it("uses one where for the count and the page", async () => {
    results.push([{ count: 1 }], [item]);
    await listAsignaturas(params(1));
    expect(statements).toHaveLength(3);
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
    expect(order).toEqual([
      '"Asignatura"."Codigo" asc',
      '"Asignatura"."Id" asc',
    ]);
  });

  describe("sorting and page size (CM-LST-1, DT-SORT-1)", () => {
    const orderOf = (index: number) =>
      (calls(index, "orderBy")[0].args as SQL[]).map(
        (part) => render(part).sql,
      );
    const code = '"Asignatura"."Codigo" asc';

    it.each([
      ["code", "asc", ['"Asignatura"."Codigo" asc', '"Asignatura"."Id" asc']],
      [
        "code",
        "desc",
        ['"Asignatura"."Codigo" desc', '"Asignatura"."Id" desc'],
      ],
      [
        "name",
        "asc",
        [
          '"Asignatura"."Nombre" collate "es-x-icu" asc',
          code,
          '"Asignatura"."Id" asc',
        ],
      ],
      [
        "name",
        "desc",
        [
          '"Asignatura"."Nombre" collate "es-x-icu" desc',
          code,
          '"Asignatura"."Id" desc',
        ],
      ],
      [
        "hours",
        "asc",
        ['"Asignatura"."HorasTotales" asc', code, '"Asignatura"."Id" asc'],
      ],
      [
        "hours",
        "desc",
        ['"Asignatura"."HorasTotales" desc', code, '"Asignatura"."Id" desc'],
      ],
      [
        "status",
        "asc",
        ['"Asignatura"."Activo" desc', code, '"Asignatura"."Id" asc'],
      ],
      [
        "status",
        "desc",
        ['"Asignatura"."Activo" asc', code, '"Asignatura"."Id" desc'],
      ],
    ] as const)(
      "orders by %s %s, then the default order, then the id",
      async (key, dir, expected) => {
        results.push([{ count: 1 }], [item]);
        await listAsignaturas({ ...params(1, ""), sort: { key, dir } });
        expect(orderOf(1)).toEqual([...expected]);
      },
    );

    it("the name order is collated and the code order is the plain column", async () => {
      results.push([{ count: 1 }], [item]);
      await listAsignaturas({
        ...params(1, ""),
        sort: { key: "name", dir: "asc" },
      });
      expect(orderOf(1)[0]).toContain('collate "es-x-icu"');
      expect(orderOf(1)[1]).not.toContain("collate");
    });

    it("without a sort keeps today's order, codigo then id", async () => {
      results.push([{ count: 1 }], [item]);
      await listAsignaturas(params(1, ""));
      expect(orderOf(1)).toEqual([code, '"Asignatura"."Id" asc']);
    });

    it("keeps the scope, the search and the count unchanged for a coordinacion actor with extra parameters", async () => {
      results.push([{ count: 1 }], [item], [{ count: 1 }], [item]);
      const base = params(1, "");
      await listAsignaturas(base);
      await listAsignaturas({
        ...base,
        sort: { key: "hours", dir: "desc" },
        // Extra parameters a URL could carry are not inputs of the list.
        ...({ carreraId: 99, scopeKind: "all" } as object),
      });
      expect(whereOf(2)).toEqual(whereOf(0));
      expect(whereOf(3)).toEqual(whereOf(1));
      expect(whereOf(2).sql).toContain('"Asignatura"."CarreraId" = $1');
      expect(whereOf(2).params[0]).toBe(7);
    });

    it("keeps the search fields (CM-ASG-9) whatever the sort", async () => {
      results.push([{ count: 1 }], [item], []);
      await listAsignaturas({
        ...params(1, "mat"),
        sort: { key: "status", dir: "desc" },
      });
      expect(whereOf(0).sql).toContain('"Asignatura"."Codigo" ilike');
      expect(whereOf(0).sql).toContain('"Asignatura"."Nombre" ilike');
      expect(whereOf(0).sql).toContain("exists (select 1 from");
      expect(whereOf(0)).toEqual(whereOf(1));
    });

    it.each([
      [25, 60, 99, 3, 50],
      [50, 120, 99, 3, 100],
      [50, 60, 99, 2, 50],
    ])(
      "with size %s and %s rows, page %s clamps to %s (offset %s)",
      async (size, count, requested, page, offset) => {
        results.push([{ count }], [item]);
        const result = await listAsignaturas({
          ...params(requested, ""),
          pageSize: size,
        });
        expect(result.page).toBe(page);
        expect(result.pageSize).toBe(size);
        expect(calls(1, "limit")[0].args).toEqual([size]);
        expect(calls(1, "offset")[0].args).toEqual([offset]);
      },
    );

    it("a degraded page echoes the requested size", async () => {
      failure = new Error("connection refused");
      const result = await listAsignaturas({
        ...params(1, ""),
        pageSize: 25,
        sort: { key: "name", dir: "desc" },
      });
      expect(result).toMatchObject({ degraded: true, pageSize: 25 });
    });
  });

  it("aggregates the distinct, ordered numbers of the active groups in one subquery column", async () => {
    results.push([{ count: 1 }], [item]);
    const result = await listAsignaturas(params(1, ""));
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

  describe("matching groups of a search (CM-ASG-9)", () => {
    const match = (id: number, over: Record<string, unknown> = {}) => ({
      id,
      asignaturaId: 1,
      periodo: "2026-S1",
      numeroGrupo: String(id),
      docenteNombre: "Ana Perez",
      activo: true,
      ...over,
    });
    const shaped = (m: ReturnType<typeof match>) => {
      const { asignaturaId, ...rest } = m;
      void asignaturaId;
      return rest;
    };

    it("runs a third statement for the page's groups when q is set and rows came back", async () => {
      results.push([{ count: 1 }], [item], [match(5)]);
      const result = await listAsignaturas(params(1, "perez"));
      expect(statements).toHaveLength(3);
      expect(Object.keys(calls(2, "select")[0].args[0] as object)).toEqual([
        "id",
        "asignaturaId",
        "periodo",
        "numeroGrupo",
        "docenteNombre",
        "activo",
      ]);
      expect(whereOf(2)).toEqual({
        sql: '("Grupo"."AsignaturaId" in ($1) and "Asignatura"."CarreraId" = $2 and ("Grupo"."Periodo" ilike $3 or "Usuario"."NombreCompleto" ilike $4))',
        params: [1, 7, "%perez%", "%perez%"],
      });
      expect(
        (calls(2, "orderBy")[0].args as SQL[]).map((o) => render(o).sql),
      ).toEqual([
        '"Grupo"."AsignaturaId" asc',
        '"Grupo"."Periodo" desc',
        '"Grupo"."NumeroGrupo" asc',
        '"Grupo"."Id" asc',
      ]);
      expect(result.data[0].gruposCoincidentes).toEqual([shaped(match(5))]);
      expect(result.data[0].gruposCoincidentesTotal).toBe(1);
    });

    it("keeps the first three of four matches and counts all four", async () => {
      const four = [match(1), match(2), match(3), match(4)];
      results.push([{ count: 1 }], [item], four);
      const { data } = await listAsignaturas(params(1, "2026"));
      expect(data).toHaveLength(1);
      expect(data[0].gruposCoincidentes).toEqual(four.slice(0, 3).map(shaped));
      expect(data[0].gruposCoincidentesTotal).toBe(4);
    });

    it("keeps three of five matches and counts five (the page shows +2)", async () => {
      const five = [1, 2, 3, 4, 5].map((n) => match(n));
      results.push([{ count: 1 }], [item], five);
      const { data } = await listAsignaturas(params(1, "2026"));
      expect(data[0].gruposCoincidentes).toHaveLength(3);
      expect(data[0].gruposCoincidentesTotal).toBe(5);
    });

    it("assigns each match to its own Asignatura and leaves the others empty", async () => {
      const other = { ...item, id: 2, codigo: "MAT102" };
      results.push(
        [{ count: 2 }],
        [item, other],
        [match(1), match(9, { asignaturaId: 2 })],
      );
      const { data } = await listAsignaturas(params(1, "perez"));
      expect(data.map((d) => d.gruposCoincidentesTotal)).toEqual([1, 1]);
      expect(data[1].gruposCoincidentes[0].id).toBe(9);
      expect(whereOf(2).params.slice(0, 2)).toEqual([1, 2]);
      expect(whereOf(2).sql).toContain("in ($1, $2)");
    });

    it("a row matched only by code or name has no matching group", async () => {
      results.push([{ count: 1 }], [item], []);
      const { data } = await listAsignaturas(params(1, "calc"));
      expect(data[0]).toMatchObject(noMatches);
    });

    it("issues no third statement without a search or with an empty page", async () => {
      results.push([{ count: 1 }], [item]);
      await listAsignaturas(params(1, ""));
      expect(statements).toHaveLength(2);

      statements.length = 0;
      results.push([{ count: 0 }], []);
      const empty = await listAsignaturas(params(1, "perez"));
      expect(statements).toHaveLength(2);
      expect(empty.data).toEqual([]);
    });

    it("carries the scope predicate in all three statements", async () => {
      sentinel.on = true;
      results.push([{ count: 1 }], [item], []);
      await listAsignaturas(params(1, "perez"));
      expect(statements).toHaveLength(3);
      for (let i = 0; i < 3; i += 1) {
        expect(whereOf(i).sql).toContain("SCOPE_SENTINEL");
      }
    });

    it("degrades like the other statements when the third one fails", async () => {
      results.push(
        [{ count: 1 }],
        [item],
        rejecting(new Error("connection refused")),
      );
      expect(await listAsignaturas(params(1, "perez"))).toEqual({
        data: [],
        total: 0,
        page: 1,
        pageSize: 10,
        degraded: true,
      });
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
