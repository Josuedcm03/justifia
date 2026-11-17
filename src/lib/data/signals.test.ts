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
vi.mock("@/lib/data/request-scope-sql", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/data/request-scope-sql")>();
  return {
    ...original,
    requestInScope: vi.fn(original.requestInScope),
  };
});

import { requestInScope } from "@/lib/data/request-scope-sql";
import { loadSignals } from "@/lib/data/signals";

// validation-signals: "Signals are fail-soft and add no audit row", "Computed
// on read, nothing persisted". The real SQL is covered by `signals-sql.test.ts`;
// here a scripted double feeds the loader so the assembly is pinned.

const SCOPE = { kind: "facultad", facultadId: 4 } as const;

const BASE = {
  presentadaEn: new Date("2026-10-13T15:00:00Z"),
  fechaInicio: "2026-10-05",
  fechaFin: "2026-10-09",
  causa: "medica",
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

const HASH = "a".repeat(64);
const HASHED = [{ documentId: 31, huella: HASH }];

/**
 * Q1 base, Q3 periods, Q4 history, Q5 current fingerprints and, when some
 * current document has one, the Q5 earlier matches: the statements of a full
 * read. The matches are the rows the database returns, with the other request
 * id already nulled when it is out of the caller's scope.
 */
function fullScript(
  history: unknown[] = [],
  current: unknown[] = HASHED,
  matches: unknown[] = [],
): Step[] {
  const hashed = current.some((d) => (d as { huella: unknown }).huella);
  return [
    { kind: "select", rows: [BASE] },
    { kind: "select", rows: [{ periodo: "2026-S2" }] },
    { kind: "select", rows: history },
    { kind: "select", rows: current },
    ...(hashed ? [{ kind: "select", rows: matches } as Step] : []),
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
  it("evaluates the five signals from Q1, the extractions, Q3, Q4 and Q5", async () => {
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
      ["rn26", "absent"],
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
      { kind: "select", rows: HASHED },
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
      { kind: "select", rows: HASHED },
      { kind: "select", rows: [] },
    ]);

    const result = await load();

    expect(result.data?.results[3]).toEqual({
      signal: "rn14",
      outcome: "not_evaluable",
      reason: "no_period",
    });
    // Q1, Q3, then Q5 only: the history query is skipped.
    expect(double.log).toHaveLength(4);
  });

  it("holds no name, document name or fingerprint in the report", async () => {
    use(fullScript([{ solicitudId: 10, emisor: "Clinica Central" }]));

    const text = JSON.stringify(await load());

    expect(text).not.toContain("Maria Perez");
    expect(text).not.toContain("constancia-privada");
    expect(text).not.toMatch(/huella|fingerprint|nombre|cif|correo/i);
    expect(text).not.toContain(HASH);
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

describe("loadSignals cause scope (RN-09, RN-10)", () => {
  const incoherent = { ...COMPLETE, issueDate: "2026-10-12" };

  function withCausa(causa: string) {
    const script = fullScript();
    script[0] = { kind: "select", rows: [{ ...BASE, causa }] };
    return script;
  }

  it("hands the declared cause to the evaluator: fuerza_mayor makes RN-09 and RN-10 not applicable", async () => {
    listExtractionsMock.mockResolvedValue(extractions(incoherent));
    const double = use(withCausa("fuerza_mayor"));

    const result = await load();

    expect(result.degraded).toBe(false);
    expect(result.data?.results.map((r) => [r.signal, r.outcome])).toEqual([
      ["rn07", "absent"],
      ["rn09", "not_applicable"],
      ["rn10", "not_applicable"],
      ["rn14", "absent"],
      ["rn26", "absent"],
    ]);
    expect(result.data?.verdict).toBe("no_alerts");
    expect(double.exhausted).toBe(true);
  });

  it("keeps RN-09 present for the same extraction on a medical request", async () => {
    listExtractionsMock.mockResolvedValue(extractions(incoherent));
    use(withCausa("medica"));

    const result = await load();

    expect(result.data?.results[1]).toMatchObject({
      signal: "rn09",
      outcome: "present",
    });
    expect(result.data?.verdict).toBe("review_carefully");
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

  it.each([
    ["the current fingerprints", 3],
    ["the earlier matches", 4],
  ])(
    "degrades the whole result when the RN-26 read of %s throws",
    async (_label, failing) => {
      const script = fullScript();
      script[failing] = { kind: "select", error: new Error("rn26 down") };
      use(script);

      await expect(load()).resolves.toEqual(degraded);
      expect(console.error).toHaveBeenCalledWith("signals_read_failed", {
        solicitudId: 42,
        code: "Error",
      });
    },
  );

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

  it.each([
    ["a null cause", null],
    ["a cause outside the five of RN-01", "vacaciones"],
    ["an empty cause", ""],
  ])(
    "degrades with no verdict and reads nothing else when the request has %s",
    async (_label, causa) => {
      const double = use([{ kind: "select", rows: [{ ...BASE, causa }] }]);

      await expect(load()).resolves.toEqual(degraded);

      // Fail loud: no default cause is assumed, the read stops at Q1.
      expect(double.log).toHaveLength(1);
      expect(listExtractionsMock).not.toHaveBeenCalled();
    },
  );

  it("never writes: every statement is a read and no audit helper is imported", async () => {
    const double = use(fullScript());

    await load();

    expect(double.log.map((s) => s.kind)).toEqual([
      "select",
      "select",
      "select",
      "select",
      "select",
    ]);
    expect(double.transactions).toBe(0);
  });
});

describe("RN-26 through the loader (Documents from before the change)", () => {
  const rn26 = (result: Awaited<ReturnType<typeof load>>) =>
    result.data?.results[4];

  it("is not evaluable and runs no lookup when every current document has no fingerprint", async () => {
    const double = use(fullScript([], [{ documentId: 31, huella: null }]));

    const result = await load();

    expect(rn26(result)).toEqual({
      signal: "rn26",
      outcome: "not_evaluable",
      reason: "no_fingerprint",
    });
    expect(double.log).toHaveLength(4);
    expect(double.exhausted).toBe(true);
  });

  it("is not evaluable when the request has no current student document", async () => {
    use(fullScript([], []));

    expect(rn26(await load())).toMatchObject({
      outcome: "not_evaluable",
      reason: "no_eligible_documents",
    });
  });

  it("ignores a NULL document and decides on the hashed one", async () => {
    use(
      fullScript(
        [],
        [
          { documentId: 30, huella: null },
          { documentId: 31, huella: HASH },
        ],
        [],
      ),
    );

    expect(rn26(await load())).toMatchObject({ outcome: "absent" });
  });
});

describe("RN-26 reference is confined to the scope (RNF-01)", () => {
  const SECRETARY_A = { kind: "facultad", facultadId: 4 } as const;
  const rn26 = (result: Awaited<ReturnType<typeof load>>) =>
    result.data?.results[4];

  beforeEach(() => {
    vi.mocked(requestInScope).mockClear();
  });

  it("gives the secretary of facultad A present and no number for a match in B", async () => {
    use(fullScript([], HASHED, [{ solicitudId: null }]));

    const result = await loadSignals({
      solicitudId: 42,
      referenceScope: SECRETARY_A,
    });

    expect(rn26(result)).toEqual({
      signal: "rn26",
      outcome: "present",
      evidence: { kind: "repeated", references: [] },
    });
    expect(result.data?.verdict).toBe("review_carefully");
    expect(
      JSON.stringify((rn26(result) as { evidence: unknown }).evidence),
    ).not.toMatch(/\d/);
  });

  it("references 41 only when 41 is in scope and 55 is not", async () => {
    // The database returned 41 and nulled 55.
    use(fullScript([], HASHED, [{ solicitudId: 41 }, { solicitudId: null }]));

    const result = await loadSignals({
      solicitudId: 42,
      referenceScope: SECRETARY_A,
    });

    expect(rn26(result)).toMatchObject({
      outcome: "present",
      evidence: { references: [41] },
    });
    expect(JSON.stringify(result.data)).not.toContain("55");
  });

  it("renders the secretary's scope into the lookup", async () => {
    use(fullScript([], HASHED, []));

    await loadSignals({ solicitudId: 42, referenceScope: SECRETARY_A });

    expect(requestInScope).toHaveBeenCalledWith(SECRETARY_A);
  });

  it("gives the coordinator present and no reference, asking the database for none", async () => {
    use(fullScript([], HASHED, [{ solicitudId: null }]));

    const result = await loadSignals({
      solicitudId: 42,
      referenceScope: { kind: "none" },
    });

    expect(requestInScope).toHaveBeenCalledWith({ kind: "none" });
    expect(rn26(result)).toEqual({
      signal: "rn26",
      outcome: "present",
      evidence: { kind: "repeated", references: [] },
    });
  });

  it("flags a correction that reuses another request's document and leaves the earlier one absent", async () => {
    use(fullScript([], HASHED, [{ solicitudId: 41 }]));
    const later = await loadSignals({
      solicitudId: 42,
      referenceScope: SECRETARY_A,
    });

    // The earlier request E sees no earlier match: a later reuse never changes it.
    use(fullScript([], HASHED, []));
    const earlier = await loadSignals({
      solicitudId: 41,
      referenceScope: SECRETARY_A,
    });

    expect(rn26(later)).toMatchObject({ outcome: "present" });
    expect(rn26(earlier)).toMatchObject({ outcome: "absent" });
  });

  it("serializes no name, CIF, e-mail, document name or hash", async () => {
    use(fullScript([], HASHED, [{ solicitudId: 41 }]));

    const text = JSON.stringify(
      await loadSignals({ solicitudId: 42, referenceScope: SECRETARY_A }),
    );

    expect(text).not.toMatch(/nombre|cif|correo|huella|fingerprint/i);
    expect(text).not.toContain("constancia-privada");
    expect(text).not.toContain(HASH);
  });
});
