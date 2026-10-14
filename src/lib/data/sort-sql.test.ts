import { eq } from "drizzle-orm";
import { QueryBuilder } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { rol, usuario } from "@/db/schema";
import type { ListSort } from "@/lib/list-params";
import {
  activeFirst,
  collatedText,
  emailLast,
  orderByFor,
  plainColumn,
  TEXT_SORT_COLLATION,
  type SortExpr,
} from "@/lib/data/sort-sql";

const qb = new QueryBuilder();

type Key = "name" | "login" | "role" | "status" | "created" | "email";

const map = {
  name: collatedText(usuario.nombreCompleto),
  login: collatedText(usuario.login),
  role: plainColumn(rol.codigo),
  status: activeFirst(usuario.activo),
  created: plainColumn(usuario.creadoEn),
  email: emailLast(usuario.correo),
} satisfies Record<Key, SortExpr>;

const fallback: ListSort<Key> = { key: "created", dir: "desc" };

function orderBySql(sort: ListSort<Key>, withFallback = fallback) {
  return qb
    .select()
    .from(usuario)
    .innerJoin(rol, eq(usuario.rolId, rol.id))
    .orderBy(...orderByFor(map, sort, withFallback, usuario.id))
    .toSQL().sql;
}

const ORDER = /order by (.*)$/;
function orderClause(sql: string) {
  const match = ORDER.exec(sql);
  if (!match) throw new Error(`no order by in: ${sql}`);
  return match[1];
}

const CREATED = '"Usuario"."CreadoEn"';
const ID = '"Usuario"."Id"';

describe("TEXT_SORT_COLLATION", () => {
  it("is the Spanish ICU collation confirmed by gate S1", () => {
    expect(TEXT_SORT_COLLATION).toBe("es-x-icu");
  });
});

describe("orderByFor — chosen key, then default key, then id", () => {
  it.each([
    [
      "name",
      "asc",
      `"Usuario"."NombreCompleto" collate "es-x-icu" asc, ${CREATED} desc, ${ID} asc`,
    ],
    [
      "name",
      "desc",
      `"Usuario"."NombreCompleto" collate "es-x-icu" desc, ${CREATED} desc, ${ID} desc`,
    ],
    [
      "login",
      "asc",
      `"Usuario"."Login" collate "es-x-icu" asc, ${CREATED} desc, ${ID} asc`,
    ],
    [
      "login",
      "desc",
      `"Usuario"."Login" collate "es-x-icu" desc, ${CREATED} desc, ${ID} desc`,
    ],
    ["role", "asc", `"Rol"."Codigo" asc, ${CREATED} desc, ${ID} asc`],
    ["role", "desc", `"Rol"."Codigo" desc, ${CREATED} desc, ${ID} desc`],
    ["status", "asc", `"Usuario"."Activo" desc, ${CREATED} desc, ${ID} asc`],
    ["status", "desc", `"Usuario"."Activo" asc, ${CREATED} desc, ${ID} desc`],
    [
      "email",
      "asc",
      `nullif("Usuario"."Correo", '') asc nulls last, ${CREATED} desc, ${ID} asc`,
    ],
    [
      "email",
      "desc",
      `nullif("Usuario"."Correo", '') desc nulls last, ${CREATED} desc, ${ID} desc`,
    ],
  ] as const)("%s %s", (key, dir, expected) => {
    expect(orderClause(orderBySql({ key, dir }))).toBe(expected);
  });

  it("the default pair reproduces today's users order: created desc, id desc", () => {
    expect(orderClause(orderBySql(fallback))).toBe(
      `${CREATED} desc, ${ID} desc`,
    );
  });

  it("the default key in the other direction ends with the id of that direction", () => {
    expect(orderClause(orderBySql({ key: "created", dir: "asc" }))).toBe(
      `${CREATED} asc, ${ID} asc`,
    );
  });

  it("a catalog-style default (code asc) adds only the id term", () => {
    const catalog: ListSort<Key> = { key: "login", dir: "asc" };
    expect(orderClause(orderBySql(catalog, catalog))).toBe(
      `"Usuario"."Login" collate "es-x-icu" asc, ${ID} asc`,
    );
  });

  it("always ends with the id, in the direction of the chosen key", () => {
    for (const key of Object.keys(map) as Key[]) {
      for (const dir of ["asc", "desc"] as const) {
        const terms = orderClause(orderBySql({ key, dir })).split(", ");
        expect(terms.at(-1)).toBe(`${ID} ${dir}`);
      }
    }
  });
});

describe("collation scope", () => {
  const collate = `collate "${TEXT_SORT_COLLATION}"`;

  it.each([["name"], ["login"]] as const)("%s is collated", (key) => {
    expect(orderBySql({ key, dir: "asc" })).toContain(collate);
  });

  it.each([["role"], ["status"], ["created"], ["email"]] as const)(
    "%s is not collated (codes and dates use the plain column)",
    (key) => {
      expect(orderBySql({ key, dir: "asc" })).not.toContain("collate");
    },
  );
});

describe("empty e-mails and status", () => {
  it.each([["asc"], ["desc"]] as const)(
    "empty e-mails come last with nullif and nulls last when %s",
    (dir) => {
      const clause = orderClause(orderBySql({ key: "email", dir }));
      expect(
        clause.startsWith(`nullif("Usuario"."Correo", '') ${dir} nulls last, `),
      ).toBe(true);
    },
  );

  it("status ascending means active first (boolean descending)", () => {
    expect(orderClause(orderBySql({ key: "status", dir: "asc" }))).toMatch(
      /^"Usuario"\."Activo" desc,/,
    );
    expect(orderClause(orderBySql({ key: "status", dir: "desc" }))).toMatch(
      /^"Usuario"\."Activo" asc,/,
    );
  });
});

describe("a key outside the map", () => {
  it("a map without an entry for every key does not compile", () => {
    // @ts-expect-error `email` has no entry, so the map is not a full Record.
    const incomplete: Record<Key, SortExpr> = {
      name: map.name,
      login: map.login,
      role: map.role,
      status: map.status,
      created: map.created,
    };
    expect(Object.keys(incomplete)).not.toContain("email");
  });

  it("falls back to the default order and never interpolates the key", () => {
    const hostile = {
      key: '\'; DROP TABLE "Usuario"; --',
      dir: "asc",
    } as unknown as ListSort<Key>;
    const sql = orderBySql(hostile);
    expect(orderClause(sql)).toBe(`${CREATED} desc, ${ID} desc`);
    expect(sql).not.toContain("DROP");
  });

  it("an inherited property name such as __proto__ is not a map entry", () => {
    const sort = { key: "__proto__", dir: "desc" } as unknown as ListSort<Key>;
    expect(orderClause(orderBySql(sort))).toBe(`${CREATED} desc, ${ID} desc`);
  });
});
