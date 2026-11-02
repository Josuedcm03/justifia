// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDbDouble, type Step } from "./test-support/db-double";

vi.mock("server-only", () => ({}));

const { holder, listExtractionsMock } = vi.hoisted(() => ({
  holder: { current: null as unknown },
  listExtractionsMock: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: new Proxy(
    {},
    {
      get: (_t, prop) =>
        (holder.current as Record<string | symbol, unknown>)[prop],
    },
  ),
}));
vi.mock("@/lib/data/extraction", () => ({
  listExtractions: listExtractionsMock,
}));

import { loadSignals } from "@/lib/data/signals";

// validation-signals: "Signals are fail-soft and add no audit row", "Computed
// on read, nothing persisted". The real SQL is covered by `signals-sql.test.ts`;
// here a scripted double feeds the loader so the assembly is pinned.

const SCOPE = { kind: "facultad", facultadId: 4 } as const;

const BASE = {
  presentadaEn: new Date("2026-10-13T15:00:00Z"),
  fechaInicio: "2026-10-05",
  fechaFin: "2026-10-09",
  estudianteId: 7,
};

const COMPLETE = {
  state: "completada",
  studentName: "Maria Perez",
  issuer: "Clinica Central",
  issueDate: "2026-10-02",
  restFrom: "2026-10-05",
  restTo: "2026-10-09",
  restDays: 5,
};

function extractions(row: unknown, degraded = false) {
  return {
    degraded,
    data: degraded
      ? []
      : [{ documentoId: 31, nombreOriginal: "constancia-privada.pdf", row }],
  };
}

function use(script: Step[]) {
  const double = createDbDouble(script);
  holder.current = double.db;
  return double;
}

/** Q1 base, Q3 periods, Q4 history: the three statements of a full read. */
function fullScript(history: unknown[] = []): Step[] {
  return [
    { kind: "select", rows: [BASE] },
    { kind: "select", rows: [{ periodo: "2026-S2" }] },
    { kind: "select", rows: history },
  ];
}

const load = (solicitudId = 42) =>
  loadSignals({ solicitudId, referenceScope: SCOPE });

beforeEach(() => {
  holder.current = null;
  listExtractionsMock.mockReset();
  listExtractionsMock.mockResolvedValue(extractions(COMPLETE));
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("loadSignals assembly", () => {
  it("evaluates the four signals from Q1, the extractions, Q3 and Q4", async () => {
    const double = use(
      fullScript([
        { solicitudId: 10, emisor: "CLÍNICA CENTRAL." },
        { solicitudId: 20, emisor: "Clinica Central" },
      ]),
    );

    const result = await load();

    expect(result.degraded).toBe(false);
    expect(result.data?.results.map((r) => [r.signal, r.outcome])).toEqual([
      ["rn07", "absent"],
      ["rn09", "absent"],
      ["rn10", "absent"],
      ["rn14", "present"],
    ]);
    expect(result.data?.verdict).toBe("review_carefully");
    expect(listExtractionsMock).toHaveBeenCalledWith(42);
    expect(double.exhausted).toBe(true);
  });

  it("uses the first presentation for RN-07", async () => {
    // Presented Wednesday 14th in Managua, deadline Tuesday 13th.
    const late = { ...BASE, presentadaEn: new Date("2026-10-14T15:00:00Z") };
    use([
      { kind: "select", rows: [late] },
      { kind: "select", rows: [{ periodo: "2026-S2" }] },
      { kind: "select", rows: [] },
    ]);

    const result = await load();

    expect(result.data?.results[0].outcome).toBe("present");
  });

  it("skips the history query when the subjects do not give one period", async () => {
    const double = use([
      { kind: "select", rows: [BASE] },
      {
        kind: "select",
        rows: [{ periodo: "2026-S1" }, { periodo: "2026-S2" }],
      },
    ]);

    const result = await load();

    expect(result.data?.results[3]).toEqual({
      signal: "rn14",
      outcome: "not_evaluable",
      reason: "no_period",
    });
    expect(double.log).toHaveLength(2);
  });

  it("holds no name, document name or fingerprint in the report", async () => {
    use(fullScript([{ solicitudId: 10, emisor: "Clinica Central" }]));

    const text = JSON.stringify(await load());

    expect(text).not.toContain("Maria Perez");
    expect(text).not.toContain("constancia-privada");
    expect(text).not.toMatch(/huella|fingerprint|nombre|cif|correo/i);
  });

  it("changes the next read when the extraction completes later, storing nothing", async () => {
    listExtractionsMock.mockResolvedValue(
      extractions({ ...COMPLETE, state: "pendiente" }),
    );
    use(fullScript());
    const before = await load();

    listExtractionsMock.mockResolvedValue(
      extractions({ ...COMPLETE, restTo: "2026-10-01" }),
    );
    const double = use(fullScript());
    const after = await load();

    expect(before.data?.results[1]).toMatchObject({
      outcome: "not_evaluable",
      reason: "extraction_pending",
    });
    expect(after.data?.results[1].outcome).toBe("present");
    expect(double.log.every((s) => s.kind === "select")).toBe(true);
  });
});

describe("loadSignals fail-soft", () => {
  const degraded = { data: null, degraded: true };

  it("degrades when the base read throws, with the error name only in the log", async () => {
    use([{ kind: "select", error: new TypeError("secret host db.example") }]);

    await expect(load(42)).resolves.toEqual(degraded);

    expect(console.error).toHaveBeenCalledWith("signals_read_failed", {
      solicitudId: 42,
      code: "TypeError",
    });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      "secret host",
    );
  });

  it("degrades when the RN-14 query throws, whatever the other signals gave", async () => {
    use([
      { kind: "select", rows: [BASE] },
      { kind: "select", rows: [{ periodo: "2026-S2" }] },
      { kind: "select", error: new Error("history down") },
    ]);

    await expect(load()).resolves.toEqual(degraded);
  });

  it("degrades, with no partial verdict, when the extraction read is degraded", async () => {
    listExtractionsMock.mockResolvedValue(extractions(null, true));
    use(fullScript());

    await expect(load()).resolves.toEqual(degraded);
  });

  it("degrades when the extraction read throws", async () => {
    listExtractionsMock.mockRejectedValue(new Error("connection lost"));
    use(fullScript());

    await expect(load()).resolves.toEqual(degraded);
  });

  it.each([
    ["no row", []],
    ["no presentation time", [{ ...BASE, presentadaEn: null }]],
    ["no end date", [{ ...BASE, fechaFin: null }]],
    ["no start date", [{ ...BASE, fechaInicio: null }]],
  ])(
    "degrades when the request has %s (a read failure, not a reason)",
    async (_l, rows) => {
      use([{ kind: "select", rows }]);

      await expect(load()).resolves.toEqual(degraded);
    },
  );

  it("never writes: every statement is a read and no audit helper is imported", async () => {
    const double = use(fullScript());

    await load();

    expect(double.log.map((s) => s.kind)).toEqual([
      "select",
      "select",
      "select",
    ]);
    expect(double.transactions).toBe(0);
  });
});
