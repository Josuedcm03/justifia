// @vitest-environment node
import { PgDialect } from "drizzle-orm/pg-core";
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

import { listGrupoDias } from "./grupo-dias";

function use(script: Step[]) {
  const double = createDbDouble(script);
  holder.current = double.db;
  return double;
}

describe("listGrupoDias (F.4)", () => {
  beforeEach(() => {
    holder.current = null;
  });

  it("returns id and day mask for the requested groups", async () => {
    const double = use([
      {
        kind: "select",
        rows: [
          { id: 1, dias: 5 },
          { id: 2, dias: 0 },
        ],
      },
    ]);

    const rows = await listGrupoDias([1, 2]);

    expect(rows).toEqual([
      { id: 1, dias: 5 },
      { id: 2, dias: 0 },
    ]);
    const where = double.log[0].where as Parameters<PgDialect["sqlToQuery"]>[0];
    const query = new PgDialect().sqlToQuery(where);
    expect(query.sql).toContain('"Grupo"."Id"');
    expect(query.params).toEqual(expect.arrayContaining([1, 2]));
  });

  it("issues no statement for an empty id list", async () => {
    const double = use([]);

    expect(await listGrupoDias([])).toEqual([]);
    expect(double.log).toHaveLength(0);
  });

  it("fails loud when the read fails", async () => {
    use([{ kind: "select", error: new Error("boom") }]);

    await expect(listGrupoDias([1])).rejects.toThrow("boom");
  });
});
