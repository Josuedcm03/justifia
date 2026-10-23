import { QueryBuilder } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { escalamiento } from "@/db/schema";
import { escalationInScope } from "@/lib/data/coordination-scope-sql";
import type { CoordinationScope } from "@/lib/intake/coordination-scope";

const qb = new QueryBuilder();

const CARRERA: CoordinationScope = { kind: "carrera", carreraId: 9 };
const NONE: CoordinationScope = { kind: "none" };
const BOGUS = { kind: "other" } as unknown as CoordinationScope;

function whereSql(where: ReturnType<typeof escalationInScope>) {
  const { sql, params } = qb.select().from(escalamiento).where(where).toSQL();
  return {
    where: sql.slice(sql.indexOf(" where ") + " where ".length),
    params,
  };
}

describe("escalationInScope (ES-3, ES-9: the student's current career)", () => {
  it("is an EXISTS on the student's current CarreraId, bound as a parameter", () => {
    const { where, params } = whereSql(escalationInScope(CARRERA));

    expect(where).toMatch(/^exists \(select 1 from "Solicitud" "sc"/);
    expect(where).toContain(
      'inner join "Usuario" "ec" on "ec"."Id" = "sc"."EstudianteId"',
    );
    expect(where).toContain('"sc"."Id" = "Escalamiento"."SolicitudId"');
    expect(where).toContain('"ec"."CarreraId" = $1');
    expect(params).toEqual([9]);
  });

  it("binds the career of the scope, not a constant", () => {
    const { params } = whereSql(
      escalationInScope({ kind: "carrera", carreraId: 12 }),
    );

    expect(params).toEqual([12]);
  });

  it("needs a career: a student without one cannot match", () => {
    const { where } = whereSql(escalationInScope(CARRERA));

    // `NULL = $1` is never true, and the join keeps the student row required.
    expect(where).toContain("inner join");
    expect(where).not.toContain("left join");
  });

  it("never uses the snapshot career name", () => {
    const { where } = whereSql(escalationInScope(CARRERA));

    expect(where).not.toContain("EstudianteCarrera");
  });

  it("is a literal false for none", () => {
    const { where, params } = whereSql(escalationInScope(NONE));

    expect(where).toBe("false");
    expect(params).toEqual([]);
  });

  it("throws on an unknown scope kind instead of failing open", () => {
    expect(() => escalationInScope(BOGUS)).toThrow();
  });
});
