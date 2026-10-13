import { QueryBuilder } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ db: {} }));

import {
  buildListUsuariosQuery,
  buildUsersWhere,
  clampPage,
  listUsuarios,
  usuarioListColumns,
} from "@/lib/data/users";
import type { ListSort, StatusFilterValue } from "@/lib/list-params";
import {
  USERS_DEFAULT_SORT,
  USERS_SORT_KEYS,
  type UsersSortKey,
} from "@/lib/users/list-params";

const qb = new QueryBuilder();

function toSql(
  where: ReturnType<typeof buildUsersWhere>,
  page: number,
  pageSize: number,
  sort?: ListSort<UsersSortKey>,
) {
  return buildListUsuariosQuery(qb, where, { page, pageSize, sort }).toSQL();
}

describe("buildUsersWhere + buildListUsuariosQuery — toSQL proof (no database)", () => {
  it("scopes the where clause to exactly the viewer's visible codes, via the joined Rol.Codigo (WU2)", () => {
    const { sql, params } = toSql(
      buildUsersWhere("secretaria", "", "all"),
      1,
      10,
    );
    expect(sql).toContain('"Rol"."Codigo" in ($1)');
    expect(params[0]).toBe("docente");
    expect(params).not.toContain("administrador");
  });

  it("administrador sees all five codes in the scope", () => {
    const { params } = toSql(
      buildUsersWhere("administrador", "", "all"),
      1,
      10,
    );
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
    const { sql } = toSql(
      buildUsersWhere(undefined as never, "", "all"),
      1,
      10,
    );
    expect(sql).toContain("where false");
  });

  it("orders newest first with the Id as a tie-break, and joins Rol", () => {
    const { sql } = toSql(buildUsersWhere("administrador", "", "all"), 1, 10);
    expect(sql).toContain('inner join "Rol"');
    expect(sql).toContain(
      'order by "Usuario"."CreadoEn" desc, "Usuario"."Id" desc',
    );
  });

  it("puts the search term only in params, escaped, OR-ed across three columns", () => {
    const { sql, params } = toSql(
      buildUsersWhere("administrador", "a%b", "all"),
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
    const page1 = toSql(buildUsersWhere("administrador", "", "all"), 1, 10);
    expect(page1.sql).not.toContain("offset");
    expect(page1.params.at(-1)).toBe(10);

    const page3 = toSql(buildUsersWhere("administrador", "", "all"), 3, 10);
    expect(page3.sql).toContain("limit $");
    expect(page3.sql).toContain("offset $");
    expect(page3.params.at(-2)).toBe(10);
    expect(page3.params.at(-1)).toBe(20);
  });

  it("an empty scope emits literal false, never all rows", () => {
    const { sql } = toSql(buildUsersWhere("docente", "", "all"), 1, 10);
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
    [3, 25, 25, 1],
    [99, 60, 10, 6],
    [99, 60, 25, 3],
    [99, 60, 50, 2],
  ])("clampPage(%i, %i, %i) -> %i", (requested, total, pageSize, expected) => {
    expect(clampPage(requested, total, pageSize)).toBe(expected);
  });
});

const STATUSES: StatusFilterValue[] = ["active", "inactive", "all"];

function whereClause(sql: string) {
  const match = /where (.*?)(?: order by | limit |$)/.exec(sql);
  if (!match) throw new Error(`no where in: ${sql}`);
  return match[1];
}

describe("buildUsersWhere — status (UL:status, UL:scope)", () => {
  it.each(STATUSES)(
    "keeps the role scope as the first term for a secretaria when status=%s",
    (status) => {
      const { sql, params } = toSql(
        buildUsersWhere("secretaria", "", status),
        1,
        10,
      );
      const clause = whereClause(sql).replace(/^[(]/, "");
      expect(clause.startsWith('"Rol"."Codigo" in ($1)')).toBe(true);
      expect(params[0]).toBe("docente");
      expect(params).not.toContain("administrador");
    },
  );

  it.each([
    ["all", '"Rol"."Codigo" in ($1)'],
    ["active", '("Rol"."Codigo" in ($1) and "Usuario"."Activo")'],
    ["inactive", '("Rol"."Codigo" in ($1) and not "Usuario"."Activo")'],
  ] as const)("status=%s narrows only through an AND", (status, expected) => {
    const { sql } = toSql(buildUsersWhere("secretaria", "", status), 1, 10);
    expect(whereClause(sql)).toBe(expected);
  });

  it("status and search combine inside the same scope", () => {
    const { sql, params } = toSql(
      buildUsersWhere("secretaria", "ana", "inactive"),
      1,
      10,
    );
    expect(
      whereClause(sql).startsWith(
        '("Rol"."Codigo" in ($1) and not "Usuario"."Activo" and (',
      ),
    ).toBe(true);
    expect(params[0]).toBe("docente");
    expect(params.filter((p) => p === "%ana%")).toHaveLength(3);
  });

  it("an empty scope stays closed whatever the status", () => {
    for (const status of STATUSES) {
      const { sql } = toSql(buildUsersWhere("docente", "", status), 1, 10);
      const clause = whereClause(sql);
      expect(clause === "false" || clause.startsWith("(false and ")).toBe(true);
    }
  });
});

describe("buildListUsuariosQuery — sorting (UL:sort)", () => {
  const where = buildUsersWhere("administrador", "", "all");

  it("the default sort produces today's order text", () => {
    const { sql } = toSql(where, 1, 10, USERS_DEFAULT_SORT);
    expect(sql).toContain(
      'order by "Usuario"."CreadoEn" desc, "Usuario"."Id" desc',
    );
  });

  it.each(
    USERS_SORT_KEYS.flatMap(
      (key) =>
        [
          [key, "asc"],
          [key, "desc"],
        ] as const,
    ),
  )("sort %s %s ends with the id in the same direction", (key, dir) => {
    const { sql } = toSql(where, 1, 10, { key, dir });
    const clause = /order by (.*?) limit /.exec(sql)?.[1] ?? "";
    expect(clause.endsWith(`"Usuario"."Id" ${dir}`)).toBe(true);
  });

  it.each([
    ["name", "asc", '"Usuario"."NombreCompleto" collate "es-x-icu" asc, '],
    ["login", "desc", '"Usuario"."Login" collate "es-x-icu" desc, '],
    ["role", "asc", '"Rol"."Codigo" asc, '],
    ["status", "asc", '"Usuario"."Activo" desc, '],
    ["status", "desc", '"Usuario"."Activo" asc, '],
    ["created", "asc", '"Usuario"."CreadoEn" asc, '],
  ] as const)(
    "sort %s %s leads with its whitelisted expression",
    (key, dir, lead) => {
      const { sql } = toSql(where, 1, 10, { key, dir });
      expect(sql).toContain(`order by ${lead}`);
    },
  );

  it("ties on a non-default key fall back to newest first, then the id", () => {
    const { sql } = toSql(where, 1, 10, { key: "role", dir: "asc" });
    expect(sql).toContain(
      'order by "Rol"."Codigo" asc, "Usuario"."CreadoEn" desc, "Usuario"."Id" asc',
    );
  });
});

describe("the list projection (UL:fields)", () => {
  const where = buildUsersWhere("administrador", "ana", "all");

  it("selects exactly the six displayed columns", () => {
    expect(Object.keys(usuarioListColumns).sort()).toEqual(
      ["activo", "creadoEn", "id", "login", "nombreCompleto", "rol"].sort(),
    );
  });

  it("the select list never names hashClave, cif, telefono or correo", () => {
    const { sql } = toSql(where, 1, 10);
    const selectList = sql.slice(0, sql.indexOf(" from "));
    for (const forbidden of [
      "HashClave",
      "Cif",
      "Telefono",
      "Correo",
      "DebeCambiarClave",
    ]) {
      expect(selectList).not.toContain(forbidden);
    }
    expect(selectList).toContain('"Usuario"."NombreCompleto"');
  });

  it("search by e-mail still builds its predicate", () => {
    const { sql } = toSql(where, 1, 10);
    expect(whereClause(sql)).toContain('"Usuario"."Correo" ilike');
  });
});

describe("listUsuarios — fail-soft", () => {
  it.each([10, 25, 50] as const)(
    "a failed read is degraded and echoes the requested pageSize %i",
    async (pageSize) => {
      const result = await listUsuarios({
        viewerRol: "administrador",
        q: "ana",
        status: "inactive",
        sort: { key: "name", dir: "desc" },
        page: 2,
        pageSize,
      });
      expect(result).toEqual({
        data: [],
        total: 0,
        page: 1,
        pageSize,
        degraded: true,
      });
    },
  );
});
