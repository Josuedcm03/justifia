import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ db: {} }));

import { db } from "@/db";
import { usuario } from "@/db/schema";
import type { CatalogExecutor } from "@/lib/data/catalog";
import {
  createUsuariosBulk,
  getCatalogActor,
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
