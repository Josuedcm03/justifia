// @vitest-environment node
import { QueryBuilder } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDbDouble, type Step } from "./test-support/db-double";

vi.mock("server-only", () => ({}));

const { holder } = vi.hoisted(() => ({ holder: { current: null as unknown } }));

vi.mock("@/db", () => ({
  db: new Proxy(
    {},
    {
      get: (_t, prop) =>
        (holder.current as Record<string | symbol, unknown>)[prop],
    },
  ),
}));

import type { RankingSource } from "@/lib/data/report-rankings";
import {
  classesQuery,
  docentesQuery,
  listReportClasses,
  listReportDocentes,
  listReportRequests,
  loadReportRequests,
  requestsCountQuery,
  requestsPageQuery,
} from "@/lib/data/report-requests";
import { VISIBLE_STATES } from "@/lib/intake/states";
import { REPORT_PAGE_SIZE } from "@/lib/reports/constants";
import type { ReportScope } from "@/lib/reports/scope";

const source = new QueryBuilder() as unknown as RankingSource;
const CARRERA: ReportScope = { kind: "carrera", carreraId: 7 };
const ALL = { periodo: null } as const;

function toSql(query: { toSQL(): { sql: string; params: unknown[] } }) {
  return query.toSQL();
}

function use(script: Step[]) {
  const double = createDbDouble(script);
  holder.current = double.db;
  return double;
}

function request(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    estudianteNombre: `Student ${id}`,
    estudianteCif: `2021-00${id}`,
    causa: "medica",
    estado: "pendiente",
    fechaInicio: "2026-03-02",
    fechaFin: "2026-03-04",
    presentadaEn: new Date("2026-03-05T15:00:00Z"),
    ...overrides,
  };
}

function pair(solicitudId: number, overrides: Record<string, unknown> = {}) {
  return {
    solicitudId,
    codigo: "MAT101",
    asignatura: "Calculo I",
    periodo: "2026-S1",
    docente: "Marta Ruiz",
    ...overrides,
  };
}

describe("request detail SQL (CR-DET-1..3)", () => {
  it("counts requests, not pairs: no join in the count", () => {
    const { sql, params } = toSql(
      requestsCountQuery(source, CARRERA, {
        periodo: "2026-S1",
        docenteId: 12,
      }),
    );

    expect(sql.startsWith('select count(*) from "Solicitud" where ')).toBe(
      true,
    );
    expect(sql).not.toMatch(/from "Solicitud"\s+(inner|left) join/);
    expect(params).toEqual([7, ...VISIBLE_STATES, "2026-S1", 12]);
  });

  it("lists the visible states only: no borrador", () => {
    const { params } = toSql(requestsCountQuery(source, CARRERA, ALL));

    expect(params).toEqual([7, ...VISIBLE_STATES]);
    expect(params).not.toContain("borrador");
    expect(params).toEqual(
      expect.arrayContaining(["rechazada", "devuelta", "pendiente"]),
    );
  });

  it("pages newest submission first, then the highest id (A-SORT)", () => {
    const { sql, params } = toSql(requestsPageQuery(source, CARRERA, ALL, 3));

    expect(sql).toContain(
      'order by "Solicitud"."PresentadaEn" desc, "Solicitud"."Id" desc limit $',
    );
    expect(params.slice(-2)).toEqual([REPORT_PAGE_SIZE, 2 * REPORT_PAGE_SIZE]);
  });

  it("selects the snapshot fields of the CR-DET-1 columns, one row per request", () => {
    const { sql } = toSql(requestsPageQuery(source, CARRERA, ALL, 1));
    const selected = sql.slice(0, sql.indexOf(" from "));

    for (const column of [
      "EstudianteNombre",
      "EstudianteCif",
      "Causa",
      "Estado",
      "FechaInicio",
      "FechaFin",
      "PresentadaEn",
    ]) {
      expect(selected, column).toContain(`"${column}"`);
    }
    expect(sql).not.toMatch(/from "Solicitud"\s+(inner|left) join/);
  });

  it("applies the same where as the count", () => {
    const filters = { periodo: "2026-S2", docenteId: 4, q: "Ana" } as const;
    const count = toSql(requestsCountQuery(source, CARRERA, filters));
    const page = toSql(requestsPageQuery(source, CARRERA, filters, 1));

    expect(count.params).toEqual(page.params.slice(0, count.params.length));
    expect(count.params).toContain("%Ana%");
  });

  it("batches the classes of every listed request in ONE query", () => {
    const { sql, params } = toSql(classesQuery(source, [11, 12, 13]));

    expect(sql).toContain(
      '"SolicitudAsignatura"."SolicitudId" in ($1, $2, $3)',
    );
    expect(sql).toContain('inner join "Grupo"');
    expect(sql).toContain('inner join "Asignatura"');
    expect(sql).toContain('inner join "Usuario" "d"');
    expect(sql).toContain('"Grupo"."Periodo"');
    expect(params).toEqual([11, 12, 13]);
  });

  it("lists only the teachers with a pair in the career scope", () => {
    const { sql, params } = toSql(docentesQuery(source, CARRERA));

    expect(sql.startsWith("select distinct ")).toBe(true);
    expect(sql).toContain('from "Usuario" "e"');
    expect(sql).toContain('order by "d"."NombreCompleto" asc, "d"."Id" asc');
    expect(params).toEqual([7, ...VISIBLE_STATES]);
  });
});

describe("listReportRequests", () => {
  beforeEach(() => (holder.current = null));

  it("counts 3 requests that hold 7 pairs as 3", async () => {
    const double = use([
      { kind: "select", rows: [{ total: 3 }] },
      { kind: "select", rows: [request(3), request(2), request(1)] },
    ]);

    const result = await listReportRequests(CARRERA, ALL, 1);

    expect(result.total).toBe(3);
    expect(result.rows.map((row) => row.id)).toEqual([3, 2, 1]);
    expect(result.page).toBe(1);
    expect(double.exhausted).toBe(true);
  });

  it("clamps a page past the end to the last page", async () => {
    use([
      { kind: "select", rows: [{ total: 30 }] },
      { kind: "select", rows: [request(1)] },
    ]);

    const result = await listReportRequests(CARRERA, ALL, 9);

    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(REPORT_PAGE_SIZE);
  });

  it("clamps a page below 1 to the first", async () => {
    use([
      { kind: "select", rows: [{ total: 30 }] },
      { kind: "select", rows: [request(1)] },
    ]);

    expect((await listReportRequests(CARRERA, ALL, 0)).page).toBe(1);
  });

  it("reads no page when nothing matches (a foreign teacher yields zero rows)", async () => {
    const double = use([{ kind: "select", rows: [{ total: 0 }] }]);

    const result = await listReportRequests(
      CARRERA,
      { periodo: null, docenteId: 99 },
      1,
    );

    expect(result).toEqual({
      rows: [],
      total: 0,
      page: 1,
      pageSize: REPORT_PAGE_SIZE,
    });
    expect(double.log).toHaveLength(1);
  });

  it("propagates a failed read", async () => {
    use([{ kind: "select", error: new Error("down") }]);

    await expect(listReportRequests(CARRERA, ALL, 1)).rejects.toThrow("down");
  });
});

describe("listReportClasses", () => {
  it("reads no rows and issues no query for no requests", async () => {
    const double = use([]);

    await expect(listReportClasses([])).resolves.toEqual([]);
    expect(double.log).toHaveLength(0);
  });

  it("returns every pair with its teacher and period from ONE query", async () => {
    const double = use([
      {
        kind: "select",
        rows: [pair(1), pair(1, { periodo: "2026-S2" }), pair(2)],
      },
    ]);

    const classes = await listReportClasses([1, 2]);

    expect(classes.map((row) => [row.solicitudId, row.periodo])).toEqual([
      [1, "2026-S1"],
      [1, "2026-S2"],
      [2, "2026-S1"],
    ]);
    expect(classes[0].docente).toBe("Marta Ruiz");
    expect(double.log).toHaveLength(1);
  });
});

describe("listReportDocentes", () => {
  it("returns the teachers the scope can see, by name", async () => {
    use([
      {
        kind: "select",
        rows: [
          { id: 4, name: "Ana Mora" },
          { id: 9, name: "Marta Ruiz" },
        ],
      },
    ]);

    await expect(listReportDocentes(CARRERA)).resolves.toEqual([
      { id: 4, name: "Ana Mora" },
      { id: 9, name: "Marta Ruiz" },
    ]);
  });
});

describe("loadReportRequests (CR-DET-1..3: fail-soft view)", () => {
  const periods = [{ periodo: "2026-S2" }, { periodo: "2026-S1" }];
  const docentes = [{ id: 9, name: "Marta Ruiz" }];

  it("joins every pair of a request into its row, in one batch", async () => {
    const double = use([
      { kind: "select", rows: [{ total: 3 }] },
      { kind: "select", rows: [request(3), request(2), request(1)] },
      {
        kind: "select",
        rows: [
          pair(3),
          pair(3, { codigo: "FIS101", asignatura: "Fisica", docente: "Luis" }),
          pair(3, { periodo: "2026-S2" }),
          pair(1),
          pair(1, { codigo: "QUI101", asignatura: "Quimica" }),
          pair(1, { codigo: "BIO101", asignatura: "Biologia" }),
          pair(1, { codigo: "LEN101", asignatura: "Lengua" }),
        ],
      },
      { kind: "select", rows: periods },
      { kind: "select", rows: docentes },
    ]);

    const view = await loadReportRequests(CARRERA, ALL, 1);

    expect(view.degraded).toBe(false);
    expect(view.total).toBe(3);
    expect(view.rows.map((row) => [row.id, row.classes.length])).toEqual([
      [3, 3],
      [2, 0],
      [1, 4],
    ]);
    expect(view.rows[0].classes.map((c) => c.asignatura)).toEqual([
      "Calculo I",
      "Fisica",
      "Calculo I",
    ]);
    expect(view.periods).toEqual(["2026-S2", "2026-S1"]);
    expect(view.docentes).toEqual(docentes);
    expect(double.log).toHaveLength(5);
    expect(double.exhausted).toBe(true);
  });

  it("with no match: no rows, no class query, but the filter options still load", async () => {
    const double = use([
      { kind: "select", rows: [{ total: 0 }] },
      { kind: "select", rows: periods },
      { kind: "select", rows: docentes },
    ]);

    const view = await loadReportRequests(
      CARRERA,
      { periodo: null, docenteId: 99 },
      1,
    );

    expect(view.rows).toEqual([]);
    expect(view.total).toBe(0);
    expect(view.degraded).toBe(false);
    expect(view.periods).toEqual(["2026-S2", "2026-S1"]);
    expect(double.log).toHaveLength(3);
  });

  it("drops an ill-formed period code from the options", async () => {
    use([
      { kind: "select", rows: [{ total: 0 }] },
      { kind: "select", rows: [{ periodo: "2026-S1" }, { periodo: "junk" }] },
      { kind: "select", rows: [] },
    ]);

    expect((await loadReportRequests(CARRERA, ALL, 1)).periods).toEqual([
      "2026-S1",
    ]);
  });

  it.each([
    ["the count", 0],
    ["the page", 1],
    ["the classes", 2],
    ["the periods", 3],
    ["the teachers", 4],
  ])("is degraded, with no partial data, when %s fails", async (_name, at) => {
    const script: Step[] = [
      { kind: "select", rows: [{ total: 1 }] },
      { kind: "select", rows: [request(1)] },
      { kind: "select", rows: [pair(1)] },
      { kind: "select", rows: periods },
      { kind: "select", rows: docentes },
    ];
    script[at] = { kind: "select", error: new Error("down") };
    use(script);

    const view = await loadReportRequests(CARRERA, ALL, 1);

    expect(view).toEqual({
      rows: [],
      total: 0,
      page: 1,
      pageSize: REPORT_PAGE_SIZE,
      periods: [],
      docentes: [],
      degraded: true,
    });
  });
});
