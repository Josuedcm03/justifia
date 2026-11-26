import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ db: {} }));

import { db } from "@/db";
import { eventoAuditoria } from "@/db/audit-schema";
import { carrera, rol, usuario } from "@/db/schema";
import { AUDITABLE_USER_FIELDS } from "@/lib/audit/types";
import { CATALOG_OPTIONS_MAX } from "@/lib/catalog/list-params";
import type { CatalogExecutor } from "@/lib/data/catalog";
import { RolDesconocidoError } from "@/lib/data/roles";
import {
  buildDocentesWhere,
  createStaffUsuario,
  createUsuario,
  createUsuariosBulk,
  findLoginAccount,
  getCatalogActor,
  getUserFacultadId,
  getUsuarioByLogin,
  listDocenteOptions,
  listDocentes,
  updateClaveAndClearFlag,
  type NuevaCuentaImportada,
} from "@/lib/data/users";
import { WRITE_CHUNK_ROWS } from "@/lib/import/limits";

type Statement = { table: unknown; values: Record<string, unknown>[] };

type ReturnedRow = { id: number; login: string };

/**
 * Recording `tx` double: each insert is one statement; ids are sequential in
 * VALUES order. `reorder` lets a test change what `RETURNING` hands back
 * (PostgreSQL does not formally promise VALUES order).
 */
function makeTx(reorder: (rows: ReturnedRow[]) => ReturnedRow[] = (r) => r) {
  const statements: Statement[] = [];
  let nextId = 100;
  const tx = {
    insert(table: unknown) {
      return {
        values(values: Record<string, unknown>[]) {
          statements.push({ table, values });
          return {
            returning: async () =>
              reorder(
                values.map((v) => ({ id: nextId++, login: v.login as string })),
              ),
          };
        },
      };
    },
  };
  return { tx: tx as unknown as CatalogExecutor, statements };
}

const row = (n: number): NuevaCuentaImportada => ({
  login: `user${n}`,
  hashClave: `$2b$12$hash${n}`,
  nombreCompleto: `User ${n}`,
  correo: `user${n}@uni.edu`,
  rolId: 3,
});

describe("createUsuariosBulk (IAP: Created accounts, Hash stored)", () => {
  it("inserts into Usuario and returns ids in input order", async () => {
    const { tx, statements } = makeTx();
    const ids = await createUsuariosBulk(tx, [row(1), row(2), row(3)]);
    expect(ids).toEqual([100, 101, 102]);
    expect(statements).toHaveLength(1);
    expect(statements[0].table).toBe(usuario);
    expect(statements[0].values.map((v) => v.login)).toEqual([
      "user1",
      "user2",
      "user3",
    ]);
  });

  it("flags every account for a password change (FPC)", async () => {
    const { tx, statements } = makeTx();
    await createUsuariosBulk(tx, [row(1), row(2)]);
    for (const v of statements[0].values) {
      expect(v.debeCambiarClave).toBe(true);
    }
  });

  it("writes the supplied hash and role, never a plaintext password", async () => {
    const { tx, statements } = makeTx();
    await createUsuariosBulk(tx, [row(1)]);
    const [v] = statements[0].values;
    expect(v.hashClave).toBe("$2b$12$hash1");
    expect(v.rolId).toBe(3);
    expect(Object.keys(v)).not.toContain("clave");
    expect(Object.keys(v)).not.toContain("password");
  });

  it("chunks at WRITE_CHUNK_ROWS: 501 rows -> 2 statements, order kept", async () => {
    const { tx, statements } = makeTx();
    const rows = Array.from({ length: WRITE_CHUNK_ROWS + 1 }, (_, i) => row(i));
    const ids = await createUsuariosBulk(tx, rows);
    expect(statements.map((s) => s.values.length)).toEqual([
      WRITE_CHUNK_ROWS,
      1,
    ]);
    expect(ids).toHaveLength(WRITE_CHUNK_ROWS + 1);
    expect(ids).toEqual(ids.toSorted((a, b) => a - b));
    expect(statements[1].values[0].login).toBe(`user${WRITE_CHUNK_ROWS}`);
  });

  it("issues no statement for an empty list", async () => {
    const { tx, statements } = makeTx();
    expect(await createUsuariosBulk(tx, [])).toEqual([]);
    expect(statements).toHaveLength(0);
  });

  it("maps ids by login, so a shuffled RETURNING still yields input order", async () => {
    const { tx } = makeTx((rows) => rows.toReversed());
    const rows = Array.from({ length: WRITE_CHUNK_ROWS + 2 }, (_, i) => row(i));
    const ids = await createUsuariosBulk(tx, rows);
    // Ids are assigned in VALUES order (100, 101, ...) even though each
    // chunk came back reversed.
    expect(ids).toEqual(rows.map((_, i) => 100 + i));
  });

  it("throws when a returned login has no matching input row", async () => {
    const { tx } = makeTx((rows) =>
      rows.map((r, i) => (i === 0 ? { ...r, login: "stranger" } : r)),
    );
    await expect(createUsuariosBulk(tx, [row(1), row(2)])).rejects.toThrow(
      /stranger/,
    );
  });

  it("throws when an input row gets no id back", async () => {
    const { tx } = makeTx((rows) => rows.slice(1));
    await expect(createUsuariosBulk(tx, [row(1), row(2)])).rejects.toThrow(
      /user1/,
    );
  });

  it("throws on duplicate input logins instead of mapping ambiguously", async () => {
    const { tx } = makeTx();
    await expect(createUsuariosBulk(tx, [row(1), row(1)])).rejects.toThrow(
      /duplicate/i,
    );
  });
});

describe("updateClaveAndClearFlag (FPC: Successful change)", () => {
  it("issues ONE UPDATE setting the hash and clearing the flag for that id", async () => {
    const calls: { table: unknown; set: unknown; where: unknown }[] = [];
    (db as unknown as Record<string, unknown>).update = (table: unknown) => ({
      set: (set: unknown) => ({
        where: async (where: unknown) => {
          calls.push({ table, set, where });
        },
      }),
    });

    await updateClaveAndClearFlag(42, "$2b$12$newhash");

    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe(usuario);
    expect(calls[0].set).toEqual({
      hashClave: "$2b$12$newhash",
      debeCambiarClave: false,
    });
    const { sql: text, params } = new PgDialect().sqlToQuery(
      calls[0].where as Parameters<PgDialect["sqlToQuery"]>[0],
    );
    expect(text).toBe('"Usuario"."Id" = $1');
    expect(params).toEqual([42]);
  });
});

describe("createUsuario (SR-16: facultadId is accepted and persisted)", () => {
  function stubInsert(inserted: Record<string, unknown>) {
    const calls: { table: unknown; values: Record<string, unknown> }[] = [];
    (db as unknown as Record<string, unknown>).select = () => ({
      from: () => ({
        where: () => ({ limit: async () => [{ id: 4 }] }),
      }),
    });
    (db as unknown as Record<string, unknown>).insert = (table: unknown) => ({
      values: (values: Record<string, unknown>) => {
        calls.push({ table, values });
        return { returning: async () => [{ ...values, id: 77, ...inserted }] };
      },
    });
    return calls;
  }

  const base = {
    login: "sec1",
    hashClave: "hash",
    rol: "secretaria" as const,
    nombreCompleto: "Rosa Lopez",
  };

  it("writes the facultadId it was given and returns it", async () => {
    const calls = stubInsert({ facultadId: 3, carreraId: null });

    const created = await createUsuario({ ...base, facultadId: 3 });

    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe(usuario);
    expect(calls[0].values).toMatchObject({ facultadId: 3, rolId: 4 });
    expect(created.facultadId).toBe(3);
    expect(created.rol).toBe("secretaria");
  });

  it("leaves facultadId out when none is given, and returns null", async () => {
    const calls = stubInsert({ facultadId: null, carreraId: null });

    const created = await createUsuario(base);

    expect(calls[0].values).not.toHaveProperty("facultadId");
    expect(created.facultadId).toBeNull();
  });
});

describe("getUserFacultadId (SR-16: facultad of the user's current carrera)", () => {
  function stubSelect(rows: unknown[]) {
    const calls: {
      projection: unknown;
      table: unknown;
      joined: unknown[];
      where: unknown;
    }[] = [];
    (db as unknown as Record<string, unknown>).select = (
      projection: unknown,
    ) => ({
      from: (table: unknown) => {
        const joined: unknown[] = [];
        const chain = {
          innerJoin: (target: unknown) => {
            joined.push(target);
            return chain;
          },
          where: (where: unknown) => ({
            limit: async () => {
              calls.push({ projection, table, joined, where });
              return rows;
            },
          }),
        };
        return chain;
      },
    });
    return calls;
  }

  it("selects only the facultadId through an inner join on Carrera, by user id", async () => {
    const calls = stubSelect([{ facultadId: 3 }]);

    await getUserFacultadId(42);

    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe(usuario);
    expect(calls[0].joined).toEqual([carrera]);
    expect(Object.keys(calls[0].projection as object)).toEqual(["facultadId"]);
    const { sql: text, params } = new PgDialect().sqlToQuery(
      calls[0].where as Parameters<PgDialect["sqlToQuery"]>[0],
    );
    expect(text).toBe('"Usuario"."Id" = $1');
    expect(params).toEqual([42]);
  });

  it("returns the facultad", async () => {
    stubSelect([{ facultadId: 3 }]);

    expect(await getUserFacultadId(1)).toBe(3);
  });

  it("returns null when the user has no carrera (no joined row)", async () => {
    stubSelect([]);

    expect(await getUserFacultadId(1)).toBeNull();
  });

  it("fails loud: a database error propagates", async () => {
    (db as unknown as Record<string, unknown>).select = () => {
      throw new Error("db down");
    };

    await expect(getUserFacultadId(1)).rejects.toThrow("db down");
  });
});

describe("getCatalogActor (CM-SCOPE-1, CM-SCOPE-2: scope follows the stored Carrera)", () => {
  function stubSelect(rows: unknown[]) {
    const calls: { projection: unknown; table: unknown; where: unknown }[] = [];
    (db as unknown as Record<string, unknown>).select = (
      projection: unknown,
    ) => ({
      from: (table: unknown) => ({
        where: (where: unknown) => ({
          limit: async () => {
            calls.push({ projection, table, where });
            return rows;
          },
        }),
      }),
    });
    return calls;
  }

  it("selects ONLY carreraId, by primary key", async () => {
    const calls = stubSelect([{ carreraId: 7 }]);
    await getCatalogActor(42);
    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe(usuario);
    const projection = calls[0].projection as Record<string, unknown>;
    expect(Object.keys(projection)).toEqual(["carreraId"]);
    expect(projection).not.toHaveProperty("hashClave");
    expect(projection).not.toHaveProperty("cif");
    expect(projection).not.toHaveProperty("correo");
    const { sql: text, params } = new PgDialect().sqlToQuery(
      calls[0].where as Parameters<PgDialect["sqlToQuery"]>[0],
    );
    expect(text).toBe('"Usuario"."Id" = $1');
    expect(params).toEqual([42]);
  });

  it("returns the carrera, including null", async () => {
    stubSelect([{ carreraId: 7 }]);
    expect(await getCatalogActor(1)).toEqual({ carreraId: 7 });
    stubSelect([{ carreraId: null }]);
    expect(await getCatalogActor(1)).toEqual({ carreraId: null });
  });

  it("returns null when the row is missing", async () => {
    stubSelect([]);
    expect(await getCatalogActor(1)).toBeNull();
  });

  it("fails loud: a database error propagates", async () => {
    (db as unknown as Record<string, unknown>).select = () => ({
      from: () => ({
        where: () => ({
          limit: async () => {
            throw new Error("db down");
          },
        }),
      }),
    });
    await expect(getCatalogActor(1)).rejects.toThrow("db down");
  });
});

describe("listDocenteOptions (CM-GRP-1 Docente, CM-LST-1: no credential)", () => {
  type Link = { method: string; args: unknown[] };

  function stubSelect(rows: unknown[]) {
    const links: Link[] = [];
    const chain: object = new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === "then") {
            return (resolve: (value: unknown) => void) => resolve(rows);
          }
          return (...args: unknown[]) => {
            links.push({ method: String(prop), args });
            return chain;
          };
        },
      },
    );
    (db as unknown as Record<string, unknown>).select = (
      ...args: unknown[]
    ) => {
      links.push({ method: "select", args });
      return chain;
    };
    return links;
  }
  const of = (links: Link[], method: string) =>
    links.filter((link) => link.method === method);
  const dialect = new PgDialect();
  const text = (part: unknown) =>
    dialect.sqlToQuery(part as Parameters<PgDialect["sqlToQuery"]>[0]);

  it("returns the rows it reads", async () => {
    const rows = [{ id: 1, nombreCompleto: "Ada", correo: null }];
    stubSelect(rows);
    expect(await listDocenteOptions()).toEqual(rows);
  });

  it("projects exactly id, nombreCompleto and correo", async () => {
    const links = stubSelect([]);
    await listDocenteOptions();
    const projection = of(links, "select")[0].args[0] as Record<
      string,
      unknown
    >;
    expect(Object.keys(projection)).toEqual(["id", "nombreCompleto", "correo"]);
    for (const key of ["hashClave", "cif", "telefono", "login"]) {
      expect(projection).not.toHaveProperty(key);
    }
    expect(of(links, "from")[0].args[0]).toBe(usuario);
  });

  it("keeps only active users whose role code is docente", async () => {
    const links = stubSelect([]);
    await listDocenteOptions();
    expect(of(links, "innerJoin")[0].args[0]).toBe(rol);
    expect(text(of(links, "innerJoin")[0].args[1]).sql).toBe(
      '"Usuario"."RolId" = "Rol"."Id"',
    );
    const { sql: where, params } = text(of(links, "where")[0].args[0]);
    expect(where).toBe('("Rol"."Codigo" = $1 and "Usuario"."Activo" = $2)');
    expect(params).toEqual(["docente", true]);
  });

  it("is ordered by name with the id as a tie-break, and capped", async () => {
    const links = stubSelect([]);
    await listDocenteOptions();
    expect(
      (of(links, "orderBy")[0].args as unknown[]).map((o) => text(o).sql),
    ).toEqual(['"Usuario"."NombreCompleto" asc', '"Usuario"."Id" asc']);
    expect(of(links, "limit")[0].args).toEqual([CATALOG_OPTIONS_MAX]);
  });

  it("is not fail-soft: a database error propagates", async () => {
    (db as unknown as Record<string, unknown>).select = () => {
      throw new Error("db down");
    };
    await expect(listDocenteOptions()).rejects.toThrow("db down");
  });
});

describe("buildDocentesWhere (CM-LST-1: Docentes list, Search for docentes)", () => {
  const dialect = new PgDialect();
  const render = (fragment: SQL | undefined) => {
    const { sql: text, params } = dialect.sqlToQuery(fragment as SQL);
    return { sql: text, params };
  };

  it("always keeps only users whose role code is docente", () => {
    expect(render(buildDocentesWhere({ status: "all", q: "" }))).toEqual({
      sql: '"Rol"."Codigo" = $1',
      params: ["docente"],
    });
  });

  it("active keeps only active rows, inactive only inactive ones", () => {
    expect(render(buildDocentesWhere({ status: "active", q: "" })).sql).toBe(
      '("Rol"."Codigo" = $1 and "Usuario"."Activo")',
    );
    expect(render(buildDocentesWhere({ status: "inactive", q: "" })).sql).toBe(
      '("Rol"."Codigo" = $1 and not "Usuario"."Activo")',
    );
  });

  it("searches name OR Correo partially, escaped, as parameters", () => {
    const { sql: text, params } = render(
      buildDocentesWhere({ status: "all", q: "a%b_c" }),
    );
    expect(text).toBe(
      '("Rol"."Codigo" = $1 and ("Usuario"."NombreCompleto" ilike $2 or "Usuario"."Correo" ilike $3))',
    );
    expect(params).toEqual(["docente", "%a\\%b\\_c%", "%a\\%b\\_c%"]);
    expect(text).not.toContain("a%b_c");
  });

  it("combines role, state and search with AND", () => {
    const { sql: text, params } = render(
      buildDocentesWhere({ status: "inactive", q: "ana" }),
    );
    expect(text).toBe(
      '("Rol"."Codigo" = $1 and not "Usuario"."Activo" and ("Usuario"."NombreCompleto" ilike $2 or "Usuario"."Correo" ilike $3))',
    );
    expect(params).toEqual(["docente", "%ana%", "%ana%"]);
  });
});

describe("listDocentes (CM-LST-1: Docentes list carries no credential, Database unavailable; CM-ACC-1)", () => {
  type Call = { method: string; args: unknown[] };
  const statements: Call[][] = [];
  const results: unknown[] = [];
  let failure: unknown = null;

  beforeEach(() => {
    statements.length = 0;
    results.length = 0;
    failure = null;
    (db as unknown as Record<string, unknown>).select = (
      ...args: unknown[]
    ) => {
      const calls: Call[] = [{ method: "select", args }];
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
            return (...a: unknown[]) => {
              calls.push({ method: String(prop), args: a });
              return chain;
            };
          },
        },
      );
      return chain;
    };
  });

  const dialect = new PgDialect();
  const render = (part: unknown) =>
    dialect.sqlToQuery(part as SQL) as { sql: string; params: unknown[] };
  const calls = (index: number, method: string) =>
    statements[index].filter((c) => c.method === method);
  const whereOf = (index: number) => render(calls(index, "where")[0].args[0]);
  const orderOf = (index: number) =>
    (calls(index, "orderBy")[0].args as unknown[]).map((o) => render(o).sql);
  const NAME = '"Usuario"."NombreCompleto" collate "es-x-icu"';
  const LOGIN = '"Usuario"."Login" collate "es-x-icu"';
  const NAME_ASC = `${NAME} asc`;
  const NAME_DESC = `${NAME} desc`;
  const LOGIN_ASC = `${LOGIN} asc`;
  const LOGIN_DESC = `${LOGIN} desc`;
  const EMAIL_ASC = `nullif("Usuario"."Correo", '') asc nulls last`;
  const EMAIL_DESC = `nullif("Usuario"."Correo", '') desc nulls last`;
  const ID_ASC = '"Usuario"."Id" asc';
  const ID_DESC = '"Usuario"."Id" desc';

  const item = {
    id: 1,
    nombreCompleto: "Ana Perez",
    login: "aperez",
    correo: "ana@uni.edu",
    activo: true,
  };
  const params = (page: number) => ({
    status: "active" as const,
    q: "ana",
    page,
    pageSize: 10,
  });

  it("returns the page, the total and the clamped page", async () => {
    results.push([{ count: 1 }], [item]);
    expect(await listDocentes(params(1))).toEqual({
      data: [item],
      total: 1,
      page: 1,
      pageSize: 10,
      degraded: false,
    });
  });

  it("takes no scope parameter: the list is not Carrera-scoped", async () => {
    results.push([{ count: 0 }], []);
    await listDocentes({
      // @ts-expect-error a scope is not a parameter of the Docentes list
      scope: { kind: "carrera", carreraId: 3 },
      ...params(1),
    });
    expect(whereOf(0).params).toEqual(["docente", "%ana%", "%ana%"]);
    expect(whereOf(0).sql).not.toContain("Carrera");
  });

  it("uses one where for the count and the page, both joined to Rol", async () => {
    results.push([{ count: 1 }], [item]);
    await listDocentes(params(1));
    expect(statements).toHaveLength(2);
    expect(whereOf(0)).toEqual(whereOf(1));
    expect(whereOf(0).sql).toContain('"Rol"."Codigo" = $1');
    expect(whereOf(0).sql).toContain('"Usuario"."Activo"');
    for (const index of [0, 1]) {
      expect(calls(index, "from")[0].args[0]).toBe(usuario);
      expect(calls(index, "innerJoin")[0].args[0]).toBe(rol);
      expect(render(calls(index, "innerJoin")[0].args[1]).sql).toBe(
        '"Usuario"."RolId" = "Rol"."Id"',
      );
    }
  });

  it("projects exactly id, nombreCompleto, login, correo and activo", async () => {
    results.push([{ count: 1 }], [item]);
    await listDocentes(params(1));
    const projection = calls(1, "select")[0].args[0] as Record<string, unknown>;
    expect(Object.keys(projection)).toEqual([
      "id",
      "nombreCompleto",
      "login",
      "correo",
      "activo",
    ]);
    for (const key of ["hashClave", "cif", "telefono", "carreraId", "rol"]) {
      expect(projection).not.toHaveProperty(key);
    }
  });

  it("orders by name with the id as a tie-break", async () => {
    results.push([{ count: 1 }], [item]);
    await listDocentes(params(1));
    expect(
      (calls(1, "orderBy")[0].args as unknown[]).map((o) => render(o).sql),
    ).toEqual([NAME_ASC, ID_ASC]);
  });

  it("the default name order is alphabetical under the Spanish collation (OC-6)", async () => {
    results.push([{ count: 1 }], [item]);
    await listDocentes(params(1));
    expect(orderOf(1)[0]).toContain('collate "es-x-icu"');
  });

  describe("sorting (CM-LST-1, DT-SORT-1)", () => {
    it.each([
      ["name", "asc", [NAME_ASC, ID_ASC]],
      ["name", "desc", [NAME_DESC, ID_DESC]],
      ["login", "asc", [LOGIN_ASC, NAME_ASC, ID_ASC]],
      ["login", "desc", [LOGIN_DESC, NAME_ASC, ID_DESC]],
      ["email", "asc", [EMAIL_ASC, NAME_ASC, ID_ASC]],
      ["email", "desc", [EMAIL_DESC, NAME_ASC, ID_DESC]],
      ["status", "asc", ['"Usuario"."Activo" desc', NAME_ASC, ID_ASC]],
      ["status", "desc", ['"Usuario"."Activo" asc', NAME_ASC, ID_DESC]],
    ] as const)(
      "orders by %s %s, then the default order, then the id",
      async (key, dir, expected) => {
        results.push([{ count: 1 }], [item]);
        await listDocentes({ ...params(1), sort: { key, dir } });
        expect(orderOf(1)).toEqual([...expected]);
      },
    );

    it("an empty or missing e-mail comes last in both directions", async () => {
      for (const dir of ["asc", "desc"] as const) {
        statements.length = 0;
        results.push([{ count: 1 }], [item]);
        await listDocentes({ ...params(1), sort: { key: "email", dir } });
        expect(orderOf(1)[0]).toBe(
          `nullif("Usuario"."Correo", '') ${dir} nulls last`,
        );
      }
    });

    it("sorting leaves the where, the count and the projection unchanged", async () => {
      results.push([{ count: 1 }], [item], [{ count: 1 }], [item]);
      await listDocentes(params(1));
      await listDocentes({
        ...params(1),
        sort: { key: "status", dir: "desc" },
      });
      expect(whereOf(2)).toEqual(whereOf(0));
      expect(whereOf(3)).toEqual(whereOf(1));
      expect(calls(3, "select")[0].args[0]).toEqual(
        calls(1, "select")[0].args[0],
      );
    });
  });

  it("projection and returned items hold no credential, temporary password or Cif (DT-DATA-1)", async () => {
    results.push([{ count: 1 }], [item]);
    const result = await listDocentes({
      ...params(1),
      sort: { key: "login", dir: "desc" },
    });
    const projection = calls(1, "select")[0].args[0] as Record<string, unknown>;
    for (const key of [
      "hashClave",
      "cif",
      "telefono",
      "debeCambiarClave",
      "password",
      "temporaryPassword",
    ]) {
      expect(projection).not.toHaveProperty(key);
      expect(result.data[0]).not.toHaveProperty(key);
    }
  });

  it.each([
    [25, 60, 99, 3, 50],
    [50, 60, 99, 2, 50],
  ])(
    "with size %s and %s rows, page %s clamps to %s (offset %s)",
    async (size, count, requested, page, offset) => {
      results.push([{ count }], [item]);
      const result = await listDocentes({
        ...params(requested),
        pageSize: size,
      });
      expect(result.page).toBe(page);
      expect(calls(1, "limit")[0].args).toEqual([size]);
      expect(calls(1, "offset")[0].args).toEqual([offset]);
    },
  );

  it("a degraded page echoes the requested size", async () => {
    failure = new Error("connection refused");
    const result = await listDocentes({ ...params(1), pageSize: 50 });
    expect(result).toMatchObject({ degraded: true, pageSize: 50 });
  });

  it("clamps an out-of-range page to the last page", async () => {
    results.push([{ count: 25 }], [item]);
    const result = await listDocentes(params(99));
    expect(result.page).toBe(3);
    expect(calls(1, "limit")[0].args).toEqual([10]);
    expect(calls(1, "offset")[0].args).toEqual([20]);
  });

  it("clamps to page 1 when there are no rows", async () => {
    results.push([{ count: 0 }], []);
    const result = await listDocentes(params(4));
    expect(result).toMatchObject({ data: [], total: 0, page: 1 });
    expect(calls(1, "offset")[0].args).toEqual([0]);
  });

  it("degrades to an empty page when the database throws", async () => {
    failure = new Error("connection refused");
    expect(await listDocentes(params(2))).toEqual({
      data: [],
      total: 0,
      page: 1,
      pageSize: 10,
      degraded: true,
    });
  });
});

// FE-21, FE-22, FE-25: the sign-in identifier resolves by email (any role) or by
// CIF (students only), and never through the stored Login.
describe("findLoginAccount (FE-21, FE-22, FE-25)", () => {
  type Call = {
    projection: unknown;
    table: unknown;
    joined: unknown[];
    where: unknown;
    limit: number;
  };

  function stubSelect(rows: unknown[]) {
    const calls: Call[] = [];
    (db as unknown as Record<string, unknown>).select = (
      projection: unknown,
    ) => ({
      from: (table: unknown) => {
        const joined: unknown[] = [];
        const chain = {
          innerJoin: (target: unknown) => {
            joined.push(target);
            return chain;
          },
          where: (where: unknown) => ({
            limit: async (limit: number) => {
              calls.push({ projection, table, joined, where, limit });
              return rows;
            },
          }),
        };
        return chain;
      },
    });
    return calls;
  }

  function render(where: unknown) {
    return new PgDialect().sqlToQuery(
      where as Parameters<PgDialect["sqlToQuery"]>[0],
    );
  }

  const student = {
    id: 7,
    login: "legacy-student",
    hashClave: "$2b$12$hash",
    nombreCompleto: "Ana Perez",
    cif: "26001234",
    correo: null,
    activo: true,
    debeCambiarClave: false,
    rol: "estudiante" as const,
  };
  const staff = { ...student, id: 9, rol: "secretaria" as const, cif: null };

  describe("by email", () => {
    it("compares lower(Correo) to the normalized value and reads at most two rows", async () => {
      const calls = stubSelect([staff]);

      await findLoginAccount("  Ana.Perez@UNI.edu ");

      expect(calls).toHaveLength(1);
      expect(calls[0].table).toBe(usuario);
      expect(calls[0].joined).toEqual([rol]);
      expect(calls[0].limit).toBe(2);
      const { sql: text, params } = render(calls[0].where);
      expect(text).toBe('lower("Usuario"."Correo") = $1');
      expect(params).toEqual(["ana.perez@uni.edu"]);
    });

    it.each([
      ["secretaria", staff],
      ["estudiante", student],
    ])("resolves one match for a %s", async (_role, account) => {
      stubSelect([account]);

      expect(await findLoginAccount("ana.perez@uni.edu")).toBe(account);
    });

    it("fails closed when two accounts share the email ignoring case (FE-22)", async () => {
      stubSelect([staff, { ...staff, id: 10 }]);

      expect(await findLoginAccount("ana@uni.edu")).toBeNull();
    });

    it("gives null when nothing matches", async () => {
      stubSelect([]);

      expect(await findLoginAccount("nobody@uni.edu")).toBeNull();
    });
  });

  describe("by CIF", () => {
    it("matches Cif exactly on the cleaned value and only for role estudiante", async () => {
      const calls = stubSelect([student]);

      await findLoginAccount("  26-00 1234 ");

      expect(calls).toHaveLength(1);
      expect(calls[0].table).toBe(usuario);
      expect(calls[0].joined).toEqual([rol]);
      expect(calls[0].limit).toBe(1);
      const { sql: text, params } = render(calls[0].where);
      expect(text).toBe('("Usuario"."Cif" = $1 and "Rol"."Codigo" = $2)');
      expect(params).toEqual(["26001234", "estudiante"]);
    });

    it("resolves the student", async () => {
      stubSelect([student]);

      expect(await findLoginAccount("26001234")).toBe(student);
    });

    it("never resolves a staff row, even if one came back", async () => {
      stubSelect([staff]);

      expect(await findLoginAccount("26001234")).toBeNull();
    });

    it("gives null when nothing matches", async () => {
      stubSelect([]);

      expect(await findLoginAccount("26001299")).toBeNull();
    });

    it("runs no query for a CIF that is empty after cleaning", async () => {
      const calls = stubSelect([student]);

      expect(await findLoginAccount(" - - ")).toBeNull();
      expect(calls).toHaveLength(0);
    });
  });

  it("runs no query for a blank identifier", async () => {
    const calls = stubSelect([student]);

    expect(await findLoginAccount("   ")).toBeNull();
    expect(calls).toHaveLength(0);
  });

  // Owner decision 2026-11-20 (task 9.1): no Login fallback ships. The stored
  // Login is read only as data of the matched account, never as a key.
  it.each([
    ["an email", "maria@uni.edu"],
    ["a CIF", "26001234"],
    ["a former username", "maria.perez"],
  ])("never selects on Login when the identifier is %s", async (_k, raw) => {
    const calls = stubSelect([student]);

    await findLoginAccount(raw);

    for (const call of calls) {
      expect(render(call.where).sql).not.toContain('"Login"');
    }
  });

  it("returns the shape of getUsuarioByLogin, so the session claims are unchanged", async () => {
    const byEmail = stubSelect([staff]);
    await findLoginAccount("ana@uni.edu");
    const byCif = stubSelect([student]);
    await findLoginAccount("26001234");
    const byLogin = stubSelect([staff]);
    await getUsuarioByLogin("maria");

    const keys = (p: unknown) => Object.keys(p as object).sort();
    expect(keys(byEmail[0].projection)).toEqual(keys(byLogin[0].projection));
    expect(keys(byCif[0].projection)).toEqual(keys(byLogin[0].projection));
    expect(keys(byEmail[0].projection)).toEqual(
      expect.arrayContaining([
        "id",
        "login",
        "rol",
        "nombreCompleto",
        "activo",
        "hashClave",
        "debeCambiarClave",
      ]),
    );
  });

  it("fails loud: a database error propagates", async () => {
    (db as unknown as Record<string, unknown>).select = () => {
      throw new Error("db down");
    };

    await expect(findLoginAccount("ana@uni.edu")).rejects.toThrow("db down");
  });
});

describe("createStaffUsuario (SAC-AUD-1, D5: audited staff creation)", () => {
  const input = {
    login: "rosa@uni.edu",
    hashClave: "$2b$12$hashhashhashhashhashhash",
    rol: "secretaria" as const,
    nombreCompleto: "Rosa Lopez",
    correo: "rosa@uni.edu",
    telefono: "8888-0000",
    facultadId: 3,
  };

  type Recorded = { table: unknown; values: unknown };

  /**
   * Doubles the pooled client and the transaction it opens. `steps` is the
   * order of everything that touched the database, so the tests can pin that
   * the role lookup runs before the transaction and the audit insert is the
   * last statement inside it.
   */
  function stubStaff(
    options: {
      roles?: { id: number }[];
      insertError?: Error;
      auditError?: Error;
    } = {},
  ) {
    const steps: string[] = [];
    const writes: Recorded[] = [];
    (db as unknown as Record<string, unknown>).select = () => ({
      from: () => ({
        where: () => ({
          limit: async () => {
            steps.push("role lookup");
            return options.roles ?? [{ id: 4 }];
          },
        }),
      }),
    });
    const tx = {
      insert: (table: unknown) => ({
        values: (values: unknown) => {
          writes.push({ table, values });
          if (table === eventoAuditoria) {
            steps.push("insert audit");
            return options.auditError
              ? Promise.reject(options.auditError)
              : Promise.resolve();
          }
          steps.push("insert usuario");
          return {
            returning: async () => {
              if (options.insertError) throw options.insertError;
              return [{ ...(values as object), id: 77 }];
            },
          };
        },
      }),
    };
    (db as unknown as Record<string, unknown>).transaction = async (
      work: (handle: typeof tx) => Promise<unknown>,
    ) => {
      steps.push("begin");
      try {
        const result = await work(tx);
        steps.push("commit");
        return result;
      } catch (error) {
        steps.push("rollback");
        throw error;
      }
    };
    return { steps, writes };
  }

  it("resolves the role before the transaction, inserts the account, then audits as the last statement", async () => {
    const { steps } = stubStaff();

    await createStaffUsuario(9, input);

    expect(steps).toEqual([
      "role lookup",
      "begin",
      "insert usuario",
      "insert audit",
      "commit",
    ]);
  });

  it("throws RolDesconocidoError as createUsuario does, before any transaction opens", async () => {
    const { steps, writes } = stubStaff({ roles: [] });

    await expect(createStaffUsuario(9, input)).rejects.toBeInstanceOf(
      RolDesconocidoError,
    );

    expect(steps).toEqual(["role lookup"]);
    expect(writes).toEqual([]);
  });

  it("inserts the account with the resolved role id and the code removed, and returns the same DTO as createUsuario", async () => {
    const { writes } = stubStaff({ roles: [{ id: 6 }] });

    const created = await createStaffUsuario(9, input);

    const [account] = writes;
    expect(account.table).toBe(usuario);
    expect(account.values).toMatchObject({
      login: "rosa@uni.edu",
      hashClave: input.hashClave,
      nombreCompleto: "Rosa Lopez",
      correo: "rosa@uni.edu",
      facultadId: 3,
      rolId: 6,
    });
    expect(account.values).not.toHaveProperty("rol");
    expect(created).toMatchObject({
      id: 77,
      login: "rosa@uni.edu",
      facultadId: 3,
      rol: "secretaria",
    });
  });

  it.each(["docente", "coordinacion", "secretaria"] as const)(
    "audits one usuario.creado for a %s, with the creator as actor, the new id as entity and field names only",
    async (rolCode) => {
      const { writes } = stubStaff();

      await createStaffUsuario(9, { ...input, rol: rolCode });

      const audits = writes.filter((w) => w.table === eventoAuditoria);
      expect(audits).toHaveLength(1);
      expect(audits[0].values).toEqual([
        {
          actorId: 9,
          accion: "usuario.creado",
          entidadTipo: "Usuario",
          entidadId: 77,
          datos: {
            campos: AUDITABLE_USER_FIELDS,
            rol: rolCode,
            origen: "manual",
          },
        },
      ]);
    },
  );

  it("puts no value of the account in the audit row: no name, email, phone, login or hash", async () => {
    const { writes } = stubStaff();

    await createStaffUsuario(9, input);

    const audit = JSON.stringify(
      writes.find((w) => w.table === eventoAuditoria)?.values,
    );
    for (const secret of [
      "Rosa Lopez",
      "rosa@uni.edu",
      "8888-0000",
      input.hashClave,
    ]) {
      expect(audit).not.toContain(secret);
    }
    expect(audit).not.toContain("importacionSha256");
  });

  it("rejects when the audit insert fails, so the transaction rolls the account back", async () => {
    const { steps } = stubStaff({ auditError: new Error("audit down") });

    await expect(createStaffUsuario(9, input)).rejects.toThrow("audit down");

    expect(steps).toEqual([
      "role lookup",
      "begin",
      "insert usuario",
      "insert audit",
      "rollback",
    ]);
  });

  it("writes no audit row when the account insert fails", async () => {
    const { steps } = stubStaff({ insertError: new Error("unique violation") });

    await expect(createStaffUsuario(9, input)).rejects.toThrow(
      "unique violation",
    );

    expect(steps).not.toContain("insert audit");
    expect(steps.at(-1)).toBe("rollback");
  });

  it("leaves createUsuario unchanged: no transaction and no audit row", async () => {
    const { steps, writes } = stubStaff();
    (db as unknown as Record<string, unknown>).insert = (table: unknown) => ({
      values: (values: object) => {
        writes.push({ table, values });
        steps.push("insert usuario");
        return { returning: async () => [{ ...values, id: 78 }] };
      },
    });

    await createUsuario(input);

    expect(steps).toEqual(["role lookup", "insert usuario"]);
    expect(writes.map((w) => w.table)).toEqual([usuario]);
  });
});
