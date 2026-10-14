import { QueryBuilder } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { solicitud } from "@/db/schema";
import {
  requestInScope,
  requestRowInScope,
} from "@/lib/data/request-scope-sql";
import type { RequestScope } from "@/lib/intake/request-scope";

const qb = new QueryBuilder();

const FACULTAD: RequestScope = { kind: "facultad", facultadId: 7 };
const NONE: RequestScope = { kind: "none" };
const BOGUS = { kind: "other" } as unknown as RequestScope;

function whereSql(where: ReturnType<typeof requestInScope>) {
  const { sql, params } = qb.select().from(solicitud).where(where).toSQL();
  return {
    where: sql.slice(sql.indexOf(" where ") + " where ".length),
    params,
  };
}

describe("requestInScope (SR-6: facultad of the student's current career)", () => {
  it("is an EXISTS on the student's career facultad, bound as a parameter", () => {
    const { where, params } = whereSql(requestInScope(FACULTAD));

    expect(where).toMatch(/^exists \(select 1 from "Usuario" "e"/);
    expect(where).toContain(
      'inner join "Carrera" "c" on "c"."Id" = "e"."CarreraId"',
    );
    expect(where).toContain('"e"."Id" = "Solicitud"."EstudianteId"');
    expect(where).toContain('"c"."FacultadId" = $1');
    expect(params).toEqual([7]);
  });

  it("binds the facultad of the scope, not a constant", () => {
    const { params } = whereSql(
      requestInScope({ kind: "facultad", facultadId: 12 }),
    );

    expect(params).toEqual([12]);
  });

  it("needs a carrera: a student without one cannot match (inner join)", () => {
    const { where } = whereSql(requestInScope(FACULTAD));

    expect(where).toContain("inner join");
    expect(where).not.toContain("left join");
  });

  it("never uses the snapshot career name", () => {
    const { where } = whereSql(requestInScope(FACULTAD));

    expect(where).not.toContain("EstudianteCarrera");
  });

  it("is a literal false for none", () => {
    const { where, params } = whereSql(requestInScope(NONE));

    expect(where).toBe("false");
    expect(params).toEqual([]);
  });

  it("throws on an unknown scope kind instead of failing open", () => {
    expect(() => requestInScope(BOGUS)).toThrow();
  });
});

describe("requestRowInScope", () => {
  it("combines the request id with the facultad scope", () => {
    const { where, params } = whereSql(requestRowInScope(FACULTAD, 42));

    expect(where).toMatch(/^\("Solicitud"\."Id" = \$1 and exists \(/);
    expect(params).toEqual([42, 7]);
  });

  it("matches nothing for none", () => {
    const { where, params } = whereSql(requestRowInScope(NONE, 42));

    expect(where).toBe('("Solicitud"."Id" = $1 and false)');
    expect(params).toEqual([42]);
  });

  it("throws on an unknown scope kind", () => {
    expect(() => requestRowInScope(BOGUS, 42)).toThrow();
  });
});
