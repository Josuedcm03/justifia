import { QueryBuilder } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { solicitud } from "@/db/schema";
import {
  buildReportWhere,
  classFilter,
  reportInScope,
} from "@/lib/data/report-scope-sql";
import { VISIBLE_STATES } from "@/lib/intake/states";
import { RANKING_STATES } from "@/lib/reports/constants";
import type { ReportScope } from "@/lib/reports/scope";

const qb = new QueryBuilder();

const CARRERA: ReportScope = { kind: "carrera", carreraId: 7 };
const NONE: ReportScope = { kind: "none" };
const BOGUS = { kind: "other" } as unknown as ReportScope;

function whereSql(where: ReturnType<typeof buildReportWhere>) {
  const { sql, params } = qb.select().from(solicitud).where(where).toSQL();
  return {
    where: sql.slice(sql.indexOf(" where ") + " where ".length),
    params,
  };
}

describe("reportInScope (CR-2, CR-SCOPE-1: career of the student's current CarreraId)", () => {
  it("is an EXISTS on the student's career, bound as a parameter", () => {
    const { where, params } = whereSql(reportInScope(CARRERA));

    expect(where).toMatch(/^exists \(select 1 from "Usuario" "e"/);
    expect(where).toContain('"e"."Id" = "Solicitud"."EstudianteId"');
    expect(where).toContain('"e"."CarreraId" = $1');
    expect(params).toEqual([7]);
  });

  it("binds the career of the scope, not a constant", () => {
    const { params } = whereSql(
      reportInScope({ kind: "carrera", carreraId: 12 }),
    );

    expect(params).toEqual([12]);
  });

  it("never uses the snapshot career name or a join on Carrera", () => {
    const { where } = whereSql(reportInScope(CARRERA));

    expect(where).not.toContain("EstudianteCarrera");
    expect(where).not.toContain('"Carrera"');
  });

  it("is a literal false for none", () => {
    const { where, params } = whereSql(reportInScope(NONE));

    expect(where).toBe("false");
    expect(params).toEqual([]);
  });

  it("throws on an unknown scope kind instead of failing open", () => {
    expect(() => reportInScope(BOGUS)).toThrow();
  });
});

describe("classFilter (CR-3, CR-PERIOD-1)", () => {
  it("is omitted when there is no period", () => {
    expect(classFilter(null)).toBeUndefined();
  });

  it("is one EXISTS over the request's pairs, with the period of the group", () => {
    const filter = classFilter("2026-S1");
    expect(filter).toBeDefined();
    const { where, params } = whereSql(filter as NonNullable<typeof filter>);

    expect(where).toMatch(/^exists \(select 1 from "SolicitudAsignatura"/);
    expect(where.match(/exists \(/g)).toHaveLength(1);
    expect(where).toContain('inner join "Grupo"');
    expect(where).toContain('"Solicitud"."Id"');
    expect(where).toContain('."Periodo" = $1');
    expect(params).toEqual(["2026-S1"]);
  });
});

describe("buildReportWhere (CR-3: one where-builder)", () => {
  it("puts the scope first, then the states, then the period EXISTS", () => {
    const { where, params } = whereSql(
      buildReportWhere(CARRERA, { periodo: "2026-S2" }, RANKING_STATES),
    );

    const scopeAt = where.indexOf('"e"."CarreraId"');
    const statesAt = where.indexOf('"Solicitud"."Estado" in');
    const periodAt = where.indexOf('."Periodo" =');
    expect(scopeAt).toBeGreaterThan(-1);
    expect(statesAt).toBeGreaterThan(scopeAt);
    expect(periodAt).toBeGreaterThan(statesAt);
    expect(params).toEqual([7, "aprobada", "pendiente", "2026-S2"]);
  });

  it("filters the request state by the list it is given", () => {
    const rankings = whereSql(
      buildReportWhere(CARRERA, { periodo: null }, RANKING_STATES),
    );
    const visible = whereSql(
      buildReportWhere(CARRERA, { periodo: null }, VISIBLE_STATES),
    );

    expect(rankings.params).toEqual([7, "aprobada", "pendiente"]);
    expect(visible.params).toEqual([7, ...VISIBLE_STATES]);
    expect(visible.params).not.toContain("borrador");
  });

  it("adds no class EXISTS when the period is null (every period)", () => {
    const { where } = whereSql(
      buildReportWhere(CARRERA, { periodo: null }, RANKING_STATES),
    );

    expect(where).not.toContain("SolicitudAsignatura");
    expect(where.match(/exists \(/g)).toHaveLength(1);
  });

  it("matches nothing for the none scope, whatever the filters", () => {
    const { where } = whereSql(
      buildReportWhere(NONE, { periodo: "2026-S1" }, RANKING_STATES),
    );

    expect(where.startsWith("(false and ")).toBe(true);
  });

  it("throws on an unknown scope kind", () => {
    expect(() =>
      buildReportWhere(BOGUS, { periodo: null }, RANKING_STATES),
    ).toThrow();
  });
});
