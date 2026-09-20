import { QueryBuilder } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ db: {} }));

import {
  buildListUsuariosQuery,
  buildUsersWhere,
  clampPage,
} from "@/lib/data/users";

const qb = new QueryBuilder();

function toSql(
  where: ReturnType<typeof buildUsersWhere>,
  page: number,
  pageSize: number,
) {
  return buildListUsuariosQuery(qb, where, { page, pageSize }).toSQL();
}

describe("buildUsersWhere + buildListUsuariosQuery — toSQL proof (no database)", () => {
  it("scopes the where clause to exactly the viewer's visible codes, via the joined Rol.Codigo (WU2)", () => {
    const { sql, params } = toSql(buildUsersWhere("secretaria", ""), 1, 10);
    expect(sql).toContain('"Rol"."Codigo" in ($1)');
    expect(params[0]).toBe("docente");
    expect(params).not.toContain("administrador");
  });

  it("administrador sees all five codes in the scope", () => {
    const { params } = toSql(buildUsersWhere("administrador", ""), 1, 10);
    expect(params.slice(0, 5).sort()).toEqual(
      [
        "administrador",
        "coordinacion",
        "docente",
        "estudiante",
        "secretaria",
      ].sort(),
    );
  });

  it("an unknown or missing viewer role emits a literal false, zero rows", () => {
    const { sql } = toSql(buildUsersWhere(undefined as never, ""), 1, 10);
    expect(sql).toContain("where false");
  });

  it("orders newest first with the Id as a tie-break, and joins Rol", () => {
    const { sql } = toSql(buildUsersWhere("administrador", ""), 1, 10);
    expect(sql).toContain('inner join "Rol"');
    expect(sql).toContain(
      'order by "Usuario"."CreadoEn" desc, "Usuario"."Id" desc',
    );
  });

  it("puts the search term only in params, escaped, OR-ed across three columns", () => {
    const { sql, params } = toSql(
      buildUsersWhere("administrador", "a%b"),
      1,
      10,
    );
    expect(sql).not.toContain("a%b");
    expect(sql).not.toContain("a\\%b");
    expect(sql).toContain('"NombreCompleto" ilike');
    expect(sql).toContain('"Login" ilike');
    expect(sql).toContain('"Correo" ilike');
    const escaped = params.filter((p) => p === "%a\\%b%");
    expect(escaped).toHaveLength(3);
  });

  it("limit/offset reflect pageSize and (page-1)*pageSize", () => {
    const page1 = toSql(buildUsersWhere("administrador", ""), 1, 10);
    expect(page1.sql).not.toContain("offset");
    expect(page1.params.at(-1)).toBe(10);

    const page3 = toSql(buildUsersWhere("administrador", ""), 3, 10);
    expect(page3.sql).toContain("limit $");
    expect(page3.sql).toContain("offset $");
    expect(page3.params.at(-2)).toBe(10);
    expect(page3.params.at(-1)).toBe(20);
  });

  it("an empty scope emits literal false, never all rows", () => {
    const { sql } = toSql(buildUsersWhere("docente", ""), 1, 10);
    expect(sql).toContain("where false");
  });
});

describe("clampPage", () => {
  it.each([
    [5, 0, 20, 1],
    [99, 12, 20, 1],
    [99, 41, 20, 3],
    [0, 40, 20, 1],
    [2, 40, 20, 2],
  ])("clampPage(%i, %i, %i) -> %i", (requested, total, pageSize, expected) => {
    expect(clampPage(requested, total, pageSize)).toBe(expected);
  });
});
