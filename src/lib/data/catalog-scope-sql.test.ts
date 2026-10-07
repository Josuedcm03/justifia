import { QueryBuilder } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { asignatura, grupo } from "@/db/schema";
import type { CatalogScope } from "@/lib/catalog/scope";
import {
  asignaturaInScope,
  asignaturaRowInScope,
  grupoRowInScope,
} from "@/lib/data/catalog-scope-sql";

const qb = new QueryBuilder();

const ALL: CatalogScope = { kind: "all" };
const OWN: CatalogScope = { kind: "carrera", carreraId: 7 };
const NONE: CatalogScope = { kind: "none" };
const BOGUS = { kind: "other" } as unknown as CatalogScope;

/** The text after `where`, so assertions never see the select list. */
function whereOf(sqlText: string) {
  return sqlText.slice(sqlText.indexOf(" where ") + " where ".length);
}

function asignaturaSql(where: ReturnType<typeof asignaturaInScope>) {
  return qb.select().from(asignatura).where(where).toSQL();
}

function grupoSql(where: ReturnType<typeof grupoRowInScope>) {
  return qb.select().from(grupo).where(where).toSQL();
}

describe("asignaturaInScope (CM-SCOPE-1: lists are limited)", () => {
  it("adds nothing for all", () => {
    expect(asignaturaInScope(ALL)).toBeUndefined();
  });

  it("filters by the carrera, as a parameter, for carrera", () => {
    const { sql, params } = asignaturaSql(asignaturaInScope(OWN));
    expect(sql).toContain('where "Asignatura"."CarreraId" = $1');
    expect(params).toEqual([7]);
  });

  it("is a literal false for none", () => {
    const { sql, params } = asignaturaSql(asignaturaInScope(NONE));
    expect(sql).toMatch(/where false$/);
    expect(params).toEqual([]);
  });

  it("throws on an unknown scope kind instead of failing open", () => {
    expect(() => asignaturaInScope(BOGUS)).toThrow();
  });
});

describe("asignaturaRowInScope", () => {
  it("is the id alone for all", () => {
    const { sql, params } = asignaturaSql(asignaturaRowInScope(ALL, 5));
    expect(sql).toContain('where "Asignatura"."Id" = $1');
    expect(whereOf(sql)).not.toContain("CarreraId");
    expect(params).toEqual([5]);
  });

  it("adds the carrera for carrera", () => {
    const { sql, params } = asignaturaSql(asignaturaRowInScope(OWN, 5));
    expect(sql).toContain(
      'where ("Asignatura"."Id" = $1 and "Asignatura"."CarreraId" = $2)',
    );
    expect(params).toEqual([5, 7]);
  });

  it("matches nothing for none", () => {
    const { sql, params } = asignaturaSql(asignaturaRowInScope(NONE, 5));
    expect(sql).toContain('where ("Asignatura"."Id" = $1 and false)');
    expect(params).toEqual([5]);
  });

  it("throws on an unknown scope kind", () => {
    expect(() => asignaturaRowInScope(BOGUS, 5)).toThrow();
  });
});

describe("grupoRowInScope (a Grupo is scoped through its Asignatura)", () => {
  it("is the id alone for all", () => {
    const { sql, params } = grupoSql(grupoRowInScope(ALL, 9));
    expect(sql).toContain('where "Grupo"."Id" = $1');
    expect(whereOf(sql)).not.toContain("select");
    expect(params).toEqual([9]);
  });

  it("adds a subquery on the Asignatura carrera for carrera", () => {
    const { sql, params } = grupoSql(grupoRowInScope(OWN, 9));
    expect(sql).toContain('"Grupo"."Id" = $1');
    expect(whereOf(sql)).toBe(
      '("Grupo"."Id" = $1 and "Grupo"."AsignaturaId" in (select "Asignatura"."Id" from "Asignatura" where "Asignatura"."CarreraId" = $2))',
    );
    expect(params).toEqual([9, 7]);
  });

  it("matches nothing for none", () => {
    const { sql, params } = grupoSql(grupoRowInScope(NONE, 9));
    expect(whereOf(sql)).toBe(
      '("Grupo"."Id" = $1 and "Grupo"."AsignaturaId" in (select "Asignatura"."Id" from "Asignatura" where false))',
    );
    expect(params).toEqual([9]);
  });

  it("throws on an unknown scope kind", () => {
    expect(() => grupoRowInScope(BOGUS, 9)).toThrow();
  });
});
