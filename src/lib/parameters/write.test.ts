// @vitest-environment node
import { drizzle } from "drizzle-orm/postgres-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The guarded write path of the normative parameters (NP-2, NP-3, NP-9, A6, A9,
// A16). `readInForce` is a double that logs its call, and the transaction is a
// recorder: `insert` builds the real Drizzle statement (so its SQL text is the
// one the database would get) and records it instead of running it; `delete`,
// `update` and `execute` fail the test if they are ever called.

const { readInForce } = vi.hoisted(() => ({ readInForce: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("./loader", () => ({ readInForce }));

import { parametroNormativo } from "@/db/schema";
import type { Transaction } from "@/lib/data/audit";
import { managuaToday } from "@/lib/intake/dates";

import type { ParameterChange } from "./registry";
import { writeParameters } from "./write";

const TODAY = "2026-11-27";

type Statement = { sql: string; params: unknown[] };
type Row = { clave: string; valor: unknown };

const realDb = drizzle.mock();

/** Runs a Drizzle builder chain, recording its SQL when it is awaited. */
function recording(builder: object, statements: Statement[], log: string[]) {
  return new Proxy(builder, {
    get(target, prop, receiver) {
      if (prop === "then") {
        const { sql, params } = (target as { toSQL(): Statement }).toSQL();
        statements.push({ sql, params });
        log.push("insert");
        return (resolve: (value: unknown) => void) => resolve(undefined);
      }
      const member = Reflect.get(target, prop, receiver);
      if (typeof member !== "function") return member;
      return (...args: unknown[]) =>
        recording(
          (member as (...a: unknown[]) => object).apply(target, args),
          statements,
          log,
        );
    },
  });
}

function setup(rows: readonly Row[] = []) {
  const statements: Statement[] = [];
  const log: string[] = [];
  const forbidden = (name: string) =>
    vi.fn(() => {
      throw new Error(`${name} must not be called`);
    });
  const tx = {
    insert: (table: Parameters<typeof realDb.insert>[0]) =>
      recording(realDb.insert(table), statements, log),
    delete: forbidden("delete"),
    update: forbidden("update"),
    execute: forbidden("execute"),
  };
  readInForce.mockImplementation(async () => {
    log.push("read");
    return rows;
  });
  return { tx: tx as unknown as Transaction, raw: tx, statements, log };
}

function write(
  changes: readonly ParameterChange[],
  rows: readonly Row[] = [],
  today = TODAY,
) {
  const env = setup(rows);
  return {
    env,
    result: writeParameters(env.tx, changes, today),
  };
}

beforeEach(() => {
  readInForce.mockReset();
});

describe("writeParameters: order inside the transaction (A6, A9)", () => {
  it("reads the rows in force of today first, then writes each applied change", async () => {
    const { env, result } = write([
      { clave: "alerta_dias", valor: 0 },
      { clave: "umbral_reincidencia", valor: 4 },
    ]);

    await result;

    expect(env.log).toEqual(["read", "insert", "insert"]);
    expect(readInForce).toHaveBeenCalledTimes(1);
    expect(readInForce).toHaveBeenCalledWith(env.tx, TODAY);
  });

  it("writes nothing when the first change is invalid, even if another is valid", async () => {
    const { env, result } = write([
      { clave: "umbral_reincidencia", valor: 4 },
      { clave: "alerta_dias", valor: 11 },
    ]);

    await expect(result).resolves.toEqual({
      kind: "invalid",
      clave: "alerta_dias",
      reason: "schema",
    });
    expect(env.statements).toEqual([]);
  });
});

describe("writeParameters: the registry decides what may be written (NP-2)", () => {
  it.each(["inventada", "constructor", "__proto__", "toString"])(
    "refuses the key %s that is outside the registry",
    async (clave) => {
      const { env, result } = write([
        { clave, valor: 1 } as unknown as ParameterChange,
      ]);

      await expect(result).resolves.toEqual({
        kind: "invalid",
        clave,
        reason: "schema",
      });
      expect(env.statements).toEqual([]);
    },
  );

  it.each([
    ["plazo_remision_dias", 2.5],
    ["plazo_remision_dias", "2"],
    ["plazo_remision_dias", true],
    ["plazo_remision_dias", null],
    ["plazo_remision_dias", 0],
    ["plazo_remision_dias", 11],
    ["alerta_dias", -1],
    ["ventana_presentacion_dias", 366],
    ["umbral_reincidencia", 1],
    ["tamano_maximo_mib", 11],
    ["calendario", [{ fecha: "2026-02-30", descripcion: null }]],
    [
      "calendario",
      [
        { fecha: "2026-12-25", descripcion: null },
        { fecha: "2026-12-25", descripcion: null },
      ],
    ],
    ["causas", []],
    ["tipo_documento_causa", { constancia_medica: [] }],
  ] as const)(
    "re-validates %s with its schema: %j is refused",
    async (clave, valor) => {
      const { env, result } = write([{ clave, valor } as ParameterChange]);

      await expect(result).resolves.toEqual({
        kind: "invalid",
        clave,
        reason: "schema",
      });
      expect(env.statements).toEqual([]);
    },
  );
});

describe("writeParameters: the alert stays below the remission deadline (A16)", () => {
  it("refuses alerta_dias 2 while plazo_remision_dias in force is 2", async () => {
    const { env, result } = write([{ clave: "alerta_dias", valor: 2 }]);

    await expect(result).resolves.toEqual({
      kind: "invalid",
      clave: "alerta_dias",
      reason: "alert_not_below_remission",
    });
    expect(env.statements).toEqual([]);
  });

  it("refuses plazo_remision_dias 1 while alerta_dias in force is 1", async () => {
    const { env, result } = write([{ clave: "plazo_remision_dias", valor: 1 }]);

    await expect(result).resolves.toEqual({
      kind: "invalid",
      clave: "plazo_remision_dias",
      reason: "alert_not_below_remission",
    });
    expect(env.statements).toEqual([]);
  });

  it("accepts alerta_dias 1 with plazo_remision_dias 2", async () => {
    const { env, result } = write(
      [{ clave: "alerta_dias", valor: 1 }],
      [{ clave: "alerta_dias", valor: 0 }],
    );

    await expect(result).resolves.toEqual({
      kind: "updated",
      changes: [{ clave: "alerta_dias", antes: 0, despues: 1 }],
    });
    expect(env.statements).toHaveLength(1);
  });

  it("checks the merged values: both keys in one save may move together", async () => {
    const { result } = write([
      { clave: "plazo_remision_dias", valor: 5 },
      { clave: "alerta_dias", valor: 4 },
    ]);

    await expect(result).resolves.toMatchObject({ kind: "updated" });
  });

  it("refuses a pair that is inconsistent only after the merge", async () => {
    const { env, result } = write([
      { clave: "plazo_remision_dias", valor: 3 },
      { clave: "alerta_dias", valor: 3 },
    ]);

    await expect(result).resolves.toEqual({
      kind: "invalid",
      clave: "alerta_dias",
      reason: "alert_not_below_remission",
    });
    expect(env.statements).toEqual([]);
  });
});

describe("writeParameters: a value equal to the one in force is not written (A9, NP-9)", () => {
  it("returns unchanged for the default when no row is in force", async () => {
    const { env, result } = write([{ clave: "alerta_dias", valor: 1 }]);

    await expect(result).resolves.toEqual({ kind: "unchanged" });
    expect(env.statements).toEqual([]);
  });

  it("returns unchanged for an empty save", async () => {
    const { env, result } = write([]);

    await expect(result).resolves.toEqual({ kind: "unchanged" });
    expect(env.statements).toEqual([]);
  });

  it("compares by canonical JSON after the schema normalisation", async () => {
    const inForce = [
      { codigo: "medica", activa: true, posicion: 1 },
      { codigo: "maternidad_paternidad", activa: true, posicion: 2 },
      { codigo: "actividad_representativa", activa: true, posicion: 3 },
      { codigo: "intercambio_academico", activa: true, posicion: 4 },
      { codigo: "fuerza_mayor", activa: true, posicion: 5 },
    ];
    const reversed = [...inForce]
      .reverse()
      .map(({ posicion, activa, codigo }) => ({ posicion, activa, codigo }));

    const { env, result } = write(
      [{ clave: "causas", valor: reversed }],
      [{ clave: "causas", valor: inForce }],
    );

    await expect(result).resolves.toEqual({ kind: "unchanged" });
    expect(env.statements).toEqual([]);
  });

  it("writes only the changes that differ from the value in force", async () => {
    const { env, result } = write(
      [
        { clave: "alerta_dias", valor: 1 },
        { clave: "umbral_reincidencia", valor: 4 },
      ],
      [{ clave: "umbral_reincidencia", valor: 5 }],
    );

    await expect(result).resolves.toEqual({
      kind: "updated",
      changes: [{ clave: "umbral_reincidencia", antes: 5, despues: 4 }],
    });
    expect(env.statements).toHaveLength(1);
  });
});

describe("writeParameters: antes is the effective value (A9)", () => {
  it("is the stored value when a valid row is in force", async () => {
    const { result } = write(
      [{ clave: "umbral_reincidencia", valor: 4 }],
      [{ clave: "umbral_reincidencia", valor: 5 }],
    );

    await expect(result).resolves.toMatchObject({
      changes: [{ antes: 5, despues: 4 }],
    });
  });

  it("is the default when no row is in force", async () => {
    const { result } = write([{ clave: "umbral_reincidencia", valor: 2 }]);

    await expect(result).resolves.toMatchObject({
      changes: [{ antes: 3, despues: 2 }],
    });
  });

  it("is the default when the row in force is invalid", async () => {
    const { result } = write(
      [{ clave: "umbral_reincidencia", valor: 2 }],
      [{ clave: "umbral_reincidencia", valor: "3" }],
    );

    await expect(result).resolves.toMatchObject({
      changes: [{ antes: 3, despues: 2 }],
    });
  });

  it("reports the value after the schema normalisation", async () => {
    const { env, result } = write([
      {
        clave: "calendario",
        valor: [
          { fecha: "2026-12-25", descripcion: "  Navidad  " },
          { fecha: "2026-12-08", descripcion: null },
        ],
      },
    ]);

    const written = [
      { fecha: "2026-12-08", descripcion: null },
      { fecha: "2026-12-25", descripcion: "Navidad" },
    ];
    await expect(result).resolves.toMatchObject({
      kind: "updated",
      changes: [{ clave: "calendario", despues: written }],
    });
    expect(env.statements[0].params[1]).toBe(JSON.stringify(written));
  });
});

describe("writeParameters: the upsert (NP-3, A6)", () => {
  it("is one insert on the key and the day that replaces only the value", async () => {
    const { env, result } = write([{ clave: "alerta_dias", valor: 0 }]);

    await result;

    expect(env.statements).toHaveLength(1);
    const [{ sql, params }] = env.statements;
    expect(sql).toMatch(/^insert into "ParametroNormativo"/);
    expect(sql).toContain(
      'on conflict ("Clave","VigenteDesde") do update set "Valor" = excluded."Valor"',
    );
    expect(sql).not.toMatch(/delete|returning/i);
    expect(params).toEqual(["alerta_dias", "0", TODAY]);
    expect(parametroNormativo.clave.name).toBe("Clave");
    expect(parametroNormativo.vigenteDesde.name).toBe("VigenteDesde");
  });

  it("dates the row today in Managua, not in UTC, and never in the future", async () => {
    const at0300Utc = new Date("2026-11-28T03:00:00Z");
    const today = managuaToday(at0300Utc);

    const { env, result } = write(
      [{ clave: "alerta_dias", valor: 0 }],
      [],
      today,
    );
    await result;

    expect(today).toBe("2026-11-27");
    expect(readInForce).toHaveBeenCalledWith(env.tx, "2026-11-27");
    expect(env.statements[0].params[2]).toBe("2026-11-27");
  });

  it("writes one row per applied change, each dated today", async () => {
    const { env, result } = write([
      { clave: "alerta_dias", valor: 0 },
      { clave: "umbral_reincidencia", valor: 4 },
    ]);

    await result;

    expect(env.statements.map((s) => s.params)).toEqual([
      ["alerta_dias", "0", TODAY],
      ["umbral_reincidencia", "4", TODAY],
    ]);
  });

  it("never deletes, updates or runs raw SQL: earlier rows stay untouched", async () => {
    const { env, result } = write(
      [
        { clave: "alerta_dias", valor: 0 },
        { clave: "umbral_reincidencia", valor: 4 },
      ],
      [{ clave: "umbral_reincidencia", valor: 5 }],
    );

    await result;

    expect(env.raw.delete).not.toHaveBeenCalled();
    expect(env.raw.update).not.toHaveBeenCalled();
    expect(env.raw.execute).not.toHaveBeenCalled();
  });
});
