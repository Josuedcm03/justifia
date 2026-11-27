// @vitest-environment node
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";

// The loader of the normative parameters (NP-4, NP-5, A3, A4). Two doubles:
//  - `react` is the real react-server build, whose `cache()` is the one that
//    deduplicates inside a render. The plain build used by vitest makes `cache`
//    a pass-through, and `react-dom/server` renders with that same build, so the
//    request scope a Server Component render provides is installed by hand
//    below (`inRender`), exactly the `getCacheForType` shape React gives it.
//  - `@/db` is a tiny in-memory table that answers the two query shapes the
//    tests care about with the semantics of the database: `selectDistinctOn`
//    (the newest row per key not after today) and a plain `select` (every row not
//    after today, newest first), so a loader that scanned back to an older row
//    would give a different answer than the one the spec demands.

const { cacheSpy, holder } = vi.hoisted(() => ({
  cacheSpy: vi.fn(),
  holder: { current: null as unknown },
}));

vi.mock("server-only", () => ({}));
vi.mock("react", async () => {
  const { createRequire } = await import("node:module");
  const { dirname, join } = await import("node:path");
  const require = createRequire(import.meta.url);
  // A file path, because the package `exports` do not list the server build.
  const real = require(
    join(
      dirname(require.resolve("react/package.json")),
      "cjs",
      "react.react-server.development.js",
    ),
  ) as typeof import("react");
  cacheSpy.mockImplementation((fn: never) => real.cache(fn));
  return { ...real, cache: cacheSpy };
});
vi.mock("@/db", () => ({
  db: new Proxy(
    {},
    {
      get: (_target, prop) =>
        (holder.current as Record<string | symbol, unknown>)[prop],
    },
  ),
}));

import * as React from "react";

import {
  DEFAULT_PARAMETERS,
  PARAMETER_KEYS,
  type NormativeParameters,
  type ParameterKey,
} from "./registry";
import {
  getNormativeParameters,
  loadNormativeParameters,
  readInForce,
} from "./loader";

// Captured at load: the setup file clears mock history between tests.
const cacheCallsAtLoad = [...cacheSpy.mock.calls];

const NOW = new Date("2026-11-27T15:00:00Z"); // 09:00 in Managua, the same day

type StoredRow = { clave: string; valor: unknown; vigenteDesde: string };

const dialect = new PgDialect();

/** An in-memory `ParametroNormativo` that records every read it serves. */
function fakeDb(stored: readonly StoredRow[], failure?: unknown) {
  const reads: string[] = [];

  function read(kind: "selectDistinctOn" | "select") {
    reads.push(kind);
    let today: string | undefined;
    const chain: object = new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === "then") {
            return (
              resolve: (rows: unknown) => void,
              reject: (error: unknown) => void,
            ) => {
              if (failure !== undefined) return reject(failure);
              const notAfter = stored
                .filter((r) => today === undefined || r.vigenteDesde <= today)
                .sort((a, b) => (a.vigenteDesde < b.vigenteDesde ? 1 : -1));
              if (kind === "select") return resolve(notAfter);
              const newest = new Map<string, StoredRow>();
              for (const row of notAfter) {
                if (!newest.has(row.clave)) newest.set(row.clave, row);
              }
              return resolve(
                [...newest.values()].map(({ clave, valor }) => ({
                  clave,
                  valor,
                })),
              );
            };
          }
          return (...args: unknown[]) => {
            if (prop === "where") {
              today = dialect.sqlToQuery(args[0] as SQL).params[0] as string;
            }
            return chain;
          };
        },
      },
    );
    return chain;
  }

  return {
    reads,
    selectDistinctOn: () => read("selectDistinctOn"),
    select: () => read("select"),
  };
}

function use(stored: readonly StoredRow[], failure?: unknown) {
  const db = fakeDb(stored, failure);
  holder.current = db;
  return db;
}

const SEED = "2026-01-01";

// A valid, non-default value for every key.
const VALID: Record<ParameterKey, unknown> = {
  plazo_remision_dias: 3,
  alerta_dias: 0,
  presentacion_tardia_dias: 4,
  ventana_presentacion_dias: 45,
  umbral_reincidencia: 5,
  tamano_maximo_mib: 20,
  calendario: [{ fecha: "2026-05-04", descripcion: "Dia local" }],
  causas: [
    { codigo: "medica", activa: true, posicion: 1 },
    { codigo: "fuerza_mayor", activa: false, posicion: 2 },
    { codigo: "maternidad_paternidad", activa: true, posicion: 3 },
    { codigo: "actividad_representativa", activa: true, posicion: 4 },
    { codigo: "intercambio_academico", activa: true, posicion: 5 },
  ],
  tipo_documento_causa: {
    constancia_medica: ["medica"],
    constancia_institucional: [
      "actividad_representativa",
      "intercambio_academico",
    ],
    otro: [],
  },
};

const VALID_VALUES: NormativeParameters = {
  remissionBusinessDays: 3,
  alertBusinessDays: 0,
  lateFilingBusinessDays: 4,
  filingWindowDays: 45,
  issuerRecurrenceThreshold: 5,
  maxDocumentMib: 20,
  nonWorkingDays: [{ fecha: "2026-05-04", descripcion: "Dia local" }],
  causes: VALID.causas as NormativeParameters["causes"],
  documentTypeCauses:
    VALID.tipo_documento_causa as NormativeParameters["documentTypeCauses"],
};

function seeded(except?: ParameterKey): StoredRow[] {
  return PARAMETER_KEYS.filter((key) => key !== except).map((key) => ({
    clave: key,
    valor: VALID[key],
    vigenteDesde: SEED,
  }));
}

let errorLog: MockInstance<typeof console.error>;

function loggedLines(): Record<string, unknown>[] {
  return errorLog.mock.calls.map(([line]) => JSON.parse(String(line)));
}

beforeEach(() => {
  errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  errorLog.mockRestore();
  vi.useRealTimers();
});

describe("readInForce (A3)", () => {
  it("is one DISTINCT ON statement over the newest row per key not after today", async () => {
    const logged: { sql: string; params: unknown[] }[] = [];
    const exec = drizzle.mock({
      logger: {
        logQuery(sql: string, params: unknown[]) {
          logged.push({ sql, params });
        },
      },
    });

    await readInForce(exec, "2026-11-27").catch(() => undefined);

    expect(logged).toHaveLength(1);
    expect(logged[0].sql).toBe(
      'select distinct on ("ParametroNormativo"."Clave") "Clave", "Valor" ' +
        'from "ParametroNormativo" ' +
        'where "ParametroNormativo"."VigenteDesde" <= $1 ' +
        'order by "ParametroNormativo"."Clave" asc, "ParametroNormativo"."VigenteDesde" desc',
    );
    expect(logged[0].params).toEqual(["2026-11-27"]);
  });

  it("returns the claves and values of the rows in force", async () => {
    const db = use([
      { clave: "plazo_remision_dias", valor: 4, vigenteDesde: "2026-02-01" },
      { clave: "plazo_remision_dias", valor: 6, vigenteDesde: "2026-03-01" },
      { clave: "alerta_dias", valor: 2, vigenteDesde: "2026-01-01" },
    ]);

    const rows = await readInForce(
      db as unknown as Parameters<typeof readInForce>[0],
      "2026-11-27",
    );

    expect(rows).toEqual([
      { clave: "plazo_remision_dias", valor: 6 },
      { clave: "alerta_dias", valor: 2 },
    ]);
  });
});

describe("loadNormativeParameters per key (NP-4)", () => {
  const DEFAULT_REMISSION = DEFAULT_PARAMETERS.remissionBusinessDays;

  type Case = {
    name: string;
    key: ParameterKey;
    field: keyof NormativeParameters;
    rows: { valor: unknown; vigenteDesde: string }[];
    expected: unknown;
    /** The `code` of the fallback line, "*" for any code, null for a valid row. */
    code: string | null;
  };

  const cases: Case[] = [
    {
      name: "a valid row in force gives that value",
      key: "plazo_remision_dias",
      field: "remissionBusinessDays",
      rows: [{ valor: 4, vigenteDesde: SEED }],
      expected: 4,
      code: null,
    },
    {
      name: "no row gives the default",
      key: "plazo_remision_dias",
      field: "remissionBusinessDays",
      rows: [],
      expected: DEFAULT_REMISSION,
      code: "no_row",
    },
    {
      name: "a row in force out of range (tamano_maximo_mib 99) gives the default",
      key: "tamano_maximo_mib",
      field: "maxDocumentMib",
      rows: [{ valor: 99, vigenteDesde: SEED }],
      expected: 10,
      code: "too_big",
    },
    {
      name: 'a row in force of the wrong type (umbral_reincidencia "3") gives the default',
      key: "umbral_reincidencia",
      field: "issuerRecurrenceThreshold",
      rows: [{ valor: "3", vigenteDesde: SEED }],
      expected: 3,
      code: "invalid_type",
    },
    {
      name: "an invalid newest row with an older valid one gives the default, not the older row",
      key: "plazo_remision_dias",
      field: "remissionBusinessDays",
      rows: [
        { valor: 4, vigenteDesde: SEED },
        { valor: 99, vigenteDesde: "2026-11-01" },
      ],
      expected: DEFAULT_REMISSION,
      code: "too_big",
    },
    {
      name: "only a row dated tomorrow gives the default",
      key: "plazo_remision_dias",
      field: "remissionBusinessDays",
      rows: [{ valor: 6, vigenteDesde: "2026-11-28" }],
      expected: DEFAULT_REMISSION,
      code: "no_row",
    },
    {
      name: "the latest row not after today wins over an older and a future one",
      key: "ventana_presentacion_dias",
      field: "filingWindowDays",
      rows: [
        { valor: 10, vigenteDesde: "2026-11-17" },
        { valor: 40, vigenteDesde: "2026-11-26" },
        { valor: 90, vigenteDesde: "2026-11-28" },
      ],
      expected: 40,
      code: null,
    },
    {
      name: "a row dated today is in force",
      key: "alerta_dias",
      field: "alertBusinessDays",
      rows: [
        { valor: 2, vigenteDesde: SEED },
        { valor: 0, vigenteDesde: "2026-11-27" },
      ],
      expected: 0,
      code: null,
    },
    {
      name: "a calendar with a repeated date gives the default calendar",
      key: "calendario",
      field: "nonWorkingDays",
      rows: [
        {
          valor: [
            { fecha: "2026-05-04", descripcion: null },
            { fecha: "2026-05-04", descripcion: null },
          ],
          vigenteDesde: SEED,
        },
      ],
      expected: DEFAULT_PARAMETERS.nonWorkingDays,
      code: "custom",
    },
    {
      name: "a causes list with no active cause gives the default causes",
      key: "causas",
      field: "causes",
      rows: [
        {
          valor: DEFAULT_PARAMETERS.causes.map((c) => ({
            ...c,
            activa: false,
          })),
          vigenteDesde: SEED,
        },
      ],
      expected: DEFAULT_PARAMETERS.causes,
      code: "custom",
    },
    {
      name: "a map with a cause on otro gives the default map",
      key: "tipo_documento_causa",
      field: "documentTypeCauses",
      rows: [
        {
          valor: { ...DEFAULT_PARAMETERS.documentTypeCauses, otro: ["medica"] },
          vigenteDesde: SEED,
        },
      ],
      expected: DEFAULT_PARAMETERS.documentTypeCauses,
      code: "*",
    },
  ];

  it.each(cases)(
    "$name; the other keys keep their own rows",
    async ({ key, field, rows, expected, code }) => {
      use([...seeded(key), ...rows.map((row) => ({ clave: key, ...row }))]);

      const result = await loadNormativeParameters(NOW);

      expect(result.values[field]).toEqual(expected);
      for (const other of Object.keys(
        VALID_VALUES,
      ) as (keyof NormativeParameters)[]) {
        if (other !== field) {
          expect(result.values[other]).toEqual(VALID_VALUES[other]);
        }
      }
      expect(result.fallback).toEqual(code === null ? [] : [key]);
      expect(result.degraded).toBe(false);
      expect(loggedLines()).toEqual(
        code === null
          ? []
          : [
              {
                event: "parameter_invalid",
                clave: key,
                code: code === "*" ? expect.any(String) : code,
              },
            ],
      );
    },
  );

  it("a failure of two keys leaves every other key alone", async () => {
    use([
      ...seeded("alerta_dias").filter((r) => r.clave !== "tamano_maximo_mib"),
      { clave: "alerta_dias", valor: 2.5, vigenteDesde: SEED },
      { clave: "tamano_maximo_mib", valor: null, vigenteDesde: SEED },
    ]);

    const result = await loadNormativeParameters(NOW);

    expect(result.values.alertBusinessDays).toBe(1);
    expect(result.values.maxDocumentMib).toBe(10);
    expect(result.values.remissionBusinessDays).toBe(3);
    expect(result.values.filingWindowDays).toBe(45);
    expect(result.values.causes).toEqual(VALID_VALUES.causes);
    expect([...result.fallback].sort()).toEqual(
      ["alerta_dias", "tamano_maximo_mib"].sort(),
    );
    expect(result.degraded).toBe(false);
  });

  it("ignores a row of a key outside the registry", async () => {
    use([
      ...seeded(),
      { clave: "otra_cosa", valor: 99, vigenteDesde: SEED },
      { clave: "plazo_remision_dias_x", valor: 1, vigenteDesde: SEED },
    ]);

    const result = await loadNormativeParameters(NOW);

    expect(result.values).toEqual(VALID_VALUES);
    expect(Object.keys(result.values).sort()).toEqual(
      Object.keys(DEFAULT_PARAMETERS).sort(),
    );
    expect(result.fallback).toEqual([]);
    expect(loggedLines()).toEqual([]);
  });

  it("reads the Managua date, not the UTC one", async () => {
    const rows = [
      ...seeded("plazo_remision_dias"),
      { clave: "plazo_remision_dias", valor: 3, vigenteDesde: "2026-11-27" },
      { clave: "plazo_remision_dias", valor: 5, vigenteDesde: "2026-11-28" },
    ];
    use(rows);

    // 2026-11-28 03:00 UTC is 2026-11-27 21:00 in Managua: the 28th is tomorrow.
    const lateEvening = await loadNormativeParameters(
      new Date("2026-11-28T03:00:00Z"),
    );
    // 06:00 UTC is midnight in Managua: the 28th has begun.
    const nextMorning = await loadNormativeParameters(
      new Date("2026-11-28T06:00:00Z"),
    );

    expect(lateEvening.values.remissionBusinessDays).toBe(3);
    expect(nextMorning.values.remissionBusinessDays).toBe(5);
  });
});

describe("loadNormativeParameters when the read fails (NP-4)", () => {
  class PostgresError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "PostgresError";
    }
  }

  it("returns every default as degraded, does not throw, and logs the error name only", async () => {
    use(
      seeded(),
      new PostgresError("connect postgres://user:SENTINEL-PASSWORD@host/db"),
    );

    const result = await loadNormativeParameters(NOW);

    expect(result.values).toEqual(DEFAULT_PARAMETERS);
    expect(result.fallback).toEqual([...PARAMETER_KEYS]);
    expect(result.degraded).toBe(true);
    expect(loggedLines()).toEqual([
      { event: "parameters_read_failed", code: "PostgresError" },
    ]);
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(
      "SENTINEL-PASSWORD",
    );
  });

  it("is fail-soft when the statement cannot even be built, and for a thrown string", async () => {
    holder.current = {
      selectDistinctOn() {
        throw "SENTINEL-THROWN";
      },
    };

    const result = await loadNormativeParameters(NOW);

    expect(result.values).toEqual(DEFAULT_PARAMETERS);
    expect(result.degraded).toBe(true);
    expect(loggedLines()).toEqual([
      { event: "parameters_read_failed", code: "string" },
    ]);
  });
});

describe("the log never carries a stored value (NP-4)", () => {
  it("names the key and a code only, whatever the invalid row holds", async () => {
    use([
      ...seeded()
        .filter((r) => r.clave !== "umbral_reincidencia")
        .filter((r) => r.clave !== "calendario")
        .filter((r) => r.clave !== "causas")
        .filter((r) => r.clave !== "tipo_documento_causa"),
      {
        clave: "umbral_reincidencia",
        valor: "SENTINEL-STORED-VALUE",
        vigenteDesde: SEED,
      },
      {
        clave: "calendario",
        valor: [
          {
            fecha: "SENTINEL-STORED-VALUE",
            descripcion: "SENTINEL-STORED-VALUE",
          },
        ],
        vigenteDesde: SEED,
      },
      {
        clave: "causas",
        valor: [{ SENTINEL_STORED_VALUE: "SENTINEL-STORED-VALUE" }],
        vigenteDesde: SEED,
      },
      {
        clave: "tipo_documento_causa",
        valor: { "SENTINEL-STORED-VALUE": ["SENTINEL-STORED-VALUE"] },
        vigenteDesde: SEED,
      },
    ]);

    const result = await loadNormativeParameters(NOW);

    expect([...result.fallback].sort()).toEqual(
      [
        "calendario",
        "causas",
        "tipo_documento_causa",
        "umbral_reincidencia",
      ].sort(),
    );
    const lines = loggedLines();
    expect(lines).toHaveLength(4);
    for (const line of lines) {
      expect(Object.keys(line).sort()).toEqual(["clave", "code", "event"]);
      expect(line.event).toBe("parameter_invalid");
    }
    expect(JSON.stringify(errorLog.mock.calls)).not.toMatch(/SENTINEL/i);
  });
});

describe("getNormativeParameters (NP-5, A4)", () => {
  /**
   * One Server Component render: a request scope in which React `cache()`
   * deduplicates, installed the way the Flight renderer installs its own.
   */
  function inRender<T>(work: () => T): T {
    const internals = (
      React as unknown as {
        __SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: {
          A: unknown;
        };
      }
    ).__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
    const scope = new Map<unknown, unknown>();
    internals.A = {
      getCacheForType(create: () => unknown) {
        if (!scope.has(create)) scope.set(create, create());
        return scope.get(create);
      },
    };
    try {
      return work();
    } finally {
      internals.A = null;
    }
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  it("wraps one zero-argument loader call in React cache(), once, at module load", () => {
    expect(cacheCallsAtLoad).toHaveLength(1);
    const [fn] = cacheCallsAtLoad[0];
    expect(fn).toBeTypeOf("function");
    expect(fn).toHaveLength(0);
  });

  it("reads the database once for two consumers in one render", async () => {
    const db = use(seeded());

    const [first, second] = inRender(() => [
      getNormativeParameters(),
      getNormativeParameters(),
    ]);
    const [a, b] = await Promise.all([first, second]);

    expect(db.reads).toHaveLength(1);
    expect(a).toBe(b);
    expect(a.values).toEqual(VALID_VALUES);
  });

  it("reads again in the next render, so a saved value is seen by the next request", async () => {
    const db = use(seeded());
    const before = await inRender(() => getNormativeParameters());
    expect(before.values.alertBusinessDays).toBe(0);

    use([
      ...seeded("alerta_dias"),
      { clave: "alerta_dias", valor: 2, vigenteDesde: SEED },
    ]);
    const after = await inRender(() => getNormativeParameters());

    expect(db.reads).toHaveLength(1);
    expect(after.values.alertBusinessDays).toBe(2);
  });

  it("reads twice for two renders", async () => {
    const db = use(seeded());

    await inRender(() => getNormativeParameters());
    await inRender(() => getNormativeParameters());

    expect(db.reads).toHaveLength(2);
  });

  it("reads on every call outside a render scope (an action or a route handler)", async () => {
    const db = use(seeded());

    await getNormativeParameters();
    await getNormativeParameters();

    expect(db.reads).toHaveLength(2);
  });

  it("keeps nothing inside the cached function itself", async () => {
    const db = use(seeded());
    const [load] = cacheCallsAtLoad[0] as [() => Promise<unknown>];

    await load();
    await load();

    expect(db.reads).toHaveLength(2);
  });
});
