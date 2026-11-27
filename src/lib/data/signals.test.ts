// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDbDouble, type Step } from "./test-support/db-double";

vi.mock("server-only", () => ({}));

const { holder, listExtractionsMock, getParametersMock } = vi.hoisted(() => ({
  holder: { current: null as unknown },
  listExtractionsMock: vi.fn(),
  getParametersMock: vi.fn(),
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
// The loader is the only source of the parameters (NP-4, A11). Its own SQL is
// covered by `loader.test.ts`; here it is a scripted double, so the statements
// of the signals read stay exactly the five of `fullScript`.
vi.mock("@/lib/parameters/loader", () => ({
  getNormativeParameters: getParametersMock,
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
import { constantCalendar } from "@/lib/intake/adapters/constant-calendar";
import {
  DEFAULT_PARAMETERS,
  PARAMETER_KEYS,
  type NormativeParameters,
} from "@/lib/parameters/registry";

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

// What the secretary registered for the document: no signal for a medical
// request. The loader hands it to the evaluators as it comes from the read.
const MARKS = {
  type: "constancia_medica",
  hasSignature: true,
  hasSeal: true,
};

function extractions(row: unknown, degraded = false, marks: unknown = MARKS) {
  return {
    degraded,
    data: degraded
      ? []
      : [
          {
            documentoId: 31,
            nombreOriginal: "constancia-privada.pdf",
            row,
            marks,
          },
        ],
  };
}

const find = (result: Awaited<ReturnType<typeof load>>, signal: string) =>
  result.data?.results.find((r) => r.signal === signal);

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

/** What the loader returns when every key is in force at the given values. */
const read = (values: Partial<NormativeParameters> = {}) => ({
  values: { ...DEFAULT_PARAMETERS, ...values },
  fallback: [] as readonly string[],
  degraded: false,
});

beforeEach(() => {
  holder.current = null;
  listExtractionsMock.mockReset();
  listExtractionsMock.mockResolvedValue(extractions(COMPLETE));
  getParametersMock.mockReset();
  getParametersMock.mockResolvedValue(read());
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("loadSignals assembly", () => {
  it("evaluates the eight signals from Q1, the extractions, Q3, Q4 and Q5", async () => {
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
      ["rn11", "absent"],
      ["rn12", "absent"],
      ["rn13", "absent"],
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

    expect(find(result, "rn14")).toEqual({
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
    listExtractionsMock.mockResolvedValue(
      extractions(incoherent, false, {
        ...MARKS,
        type: "constancia_institucional",
      }),
    );
    const double = use(withCausa("fuerza_mayor"));

    const result = await load();

    expect(result.degraded).toBe(false);
    expect(result.data?.results.map((r) => [r.signal, r.outcome])).toEqual([
      ["rn07", "absent"],
      ["rn09", "not_applicable"],
      ["rn10", "not_applicable"],
      ["rn11", "absent"],
      ["rn12", "absent"],
      ["rn13", "absent"],
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
    find(result, "rn26");

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
    find(result, "rn26");

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

// validation-signals: "Aggregation and reasons of RN-11, RN-12 and RN-13" and
// "Manual data removes the extraction reason". The loader maps the marks of the
// effective read into the documents; the signals read them, never the row.
describe("loadSignals marks (RN-11, RN-12, RN-13)", () => {
  const withMarks = (marks: unknown, row: unknown = COMPLETE) =>
    listExtractionsMock.mockResolvedValue(extractions(row, false, marks));

  it("hands the marks of the effective read to the evaluators", async () => {
    withMarks({
      type: "constancia_institucional",
      hasSignature: false,
      hasSeal: true,
    });
    use(fullScript());

    const result = await load();

    expect(find(result, "rn11")).toEqual({
      signal: "rn11",
      outcome: "present",
      evidence: { kind: "documents", documentIds: [31] },
    });
    expect(find(result, "rn12")).toMatchObject({ outcome: "absent" });
    expect(find(result, "rn13")).toEqual({
      signal: "rn13",
      outcome: "present",
      evidence: { kind: "documents", documentIds: [31] },
    });
    expect(result.data?.verdict).toBe("review_carefully");
  });

  it("lists the three apart as not registered, and stays inconclusive, for a document with no marks", async () => {
    withMarks({ type: null, hasSignature: null, hasSeal: null });
    use(fullScript());

    const result = await load();

    for (const signal of ["rn11", "rn12", "rn13"]) {
      expect(find(result, signal)).toEqual({
        signal,
        outcome: "not_evaluable",
        reason: "not_registered",
      });
    }
    expect(result.data?.verdict).toBe("inconclusive");
    expect(result.data?.notEvaluable).toEqual([
      { signal: "rn11", reason: "not_registered" },
      { signal: "rn12", reason: "not_registered" },
      { signal: "rn13", reason: "not_registered" },
    ]);
  });

  it("reads the marks whatever the extraction state is", async () => {
    withMarks(
      { type: "otro", hasSignature: false, hasSeal: false },
      { ...COMPLETE, state: "fallida" },
    );
    use(fullScript());

    const result = await load();

    for (const signal of ["rn11", "rn12", "rn13"]) {
      expect(find(result, signal)).toMatchObject({ outcome: "present" });
    }
  });

  it("evaluates the type with the map of the params", async () => {
    withMarks({
      type: "constancia_institucional",
      hasSignature: true,
      hasSeal: true,
    });
    use(fullScript());
    const defaults = await load();

    use(fullScript());
    const custom = await loadSignals({
      solicitudId: 42,
      referenceScope: SCOPE,
      params: {
        issuerRecurrenceThreshold: 3,
        documentTypeCauses: {
          constancia_medica: ["medica"],
          constancia_institucional: ["medica"],
          otro: [],
        },
      },
    });

    // The request is medica: the default map says an institutional certificate
    // does not correspond, the injected one says it does.
    expect(find(defaults, "rn13")).toMatchObject({ outcome: "present" });
    expect(find(custom, "rn13")).toMatchObject({ outcome: "absent" });
  });

  it("serializes no type code, mark value or document name", async () => {
    withMarks({
      type: "constancia_institucional",
      hasSignature: false,
      hasSeal: false,
    });
    use(fullScript());

    const text = JSON.stringify(await load());

    expect(text).not.toContain("constancia_institucional");
    expect(text).not.toContain("constancia-privada");
    expect(text).not.toMatch(/hasSignature|hasSeal|tieneFirma|tieneSello/);
  });
});

// validation-signals: "The parameter in force is read, with its default", "The
// stored table is read, with the default as fallback", "Late-filing days change
// the deadline" (design A10, A11). `loadSignals` takes the three inputs of the
// evaluation from the loader when the caller passes none, and reads it once.
describe("loadSignals reads the parameters from the loader (A11)", () => {
  // Presented Wednesday 14th in Managua: the third business day after the end
  // date Friday 9th, so late with 2 days and on time with 3.
  const WEDNESDAY = { ...BASE, presentadaEn: new Date("2026-10-14T15:00:00Z") };
  const onWednesday = (history: unknown[] = []): Step[] => [
    { kind: "select", rows: [WEDNESDAY] },
    { kind: "select", rows: [{ periodo: "2026-S2" }] },
    { kind: "select", rows: history },
    { kind: "select", rows: HASHED },
    { kind: "select", rows: [] },
  ];
  const SAME_ISSUER = [{ solicitudId: 10, emisor: "Clinica Central" }];

  it("evaluates RN-14 with the threshold in force: 3 by default, 2 once saved", async () => {
    use(fullScript(SAME_ISSUER));
    const byDefault = await load();

    getParametersMock.mockResolvedValue(read({ issuerRecurrenceThreshold: 2 }));
    use(fullScript(SAME_ISSUER));
    const saved = await load();

    // The second request of one issuer.
    expect(find(byDefault, "rn14")).toMatchObject({ outcome: "absent" });
    expect(find(saved, "rn14")).toMatchObject({
      outcome: "present",
      evidence: { threshold: 2 },
    });
  });

  it("evaluates RN-13 with the stored map: a flipped cell makes it absent", async () => {
    // A medica request with an institutional certificate: present by default.
    listExtractionsMock.mockResolvedValue(
      extractions(COMPLETE, false, {
        type: "constancia_institucional",
        hasSignature: true,
        hasSeal: true,
      }),
    );
    use(fullScript());
    const byDefault = await load();

    getParametersMock.mockResolvedValue(
      read({
        documentTypeCauses: {
          ...DEFAULT_PARAMETERS.documentTypeCauses,
          constancia_institucional: [
            ...DEFAULT_PARAMETERS.documentTypeCauses.constancia_institucional,
            "medica",
          ],
        },
      }),
    );
    use(fullScript());
    const flipped = await load();

    expect(find(byDefault, "rn13")).toMatchObject({ outcome: "present" });
    expect(find(flipped, "rn13")).toMatchObject({ outcome: "absent" });
  });

  it("evaluates RN-07 with the late-filing days in force: late with 2, on time with 3", async () => {
    use(onWednesday());
    const byDefault = await load();

    getParametersMock.mockResolvedValue(read({ lateFilingBusinessDays: 3 }));
    use(onWednesday());
    const saved = await load();

    expect(find(byDefault, "rn07")).toMatchObject({ outcome: "present" });
    expect(find(saved, "rn07")).toMatchObject({ outcome: "absent" });
  });

  it("keeps RN-07 apart from the remission days of RN-08", async () => {
    getParametersMock.mockResolvedValue(read({ remissionBusinessDays: 3 }));
    use(onWednesday());

    expect(find(await load(), "rn07")).toMatchObject({ outcome: "present" });
  });

  it("reads the calendar in force: a listed holiday moves the RN-07 deadline", async () => {
    // Tuesday 13th listed as non-working: the deadline moves to Wednesday 14th.
    getParametersMock.mockResolvedValue(
      read({ nonWorkingDays: [{ fecha: "2026-10-13", descripcion: null }] }),
    );
    use(onWednesday());

    expect(find(await load(), "rn07")).toMatchObject({
      outcome: "absent",
      evidence: { deadline: "2026-10-14" },
    });
  });

  it("is not evaluable when the stored calendar has no date of the deadline year", async () => {
    getParametersMock.mockResolvedValue(
      read({ nonWorkingDays: [{ fecha: "2027-01-01", descripcion: null }] }),
    );
    use(onWednesday());

    expect(find(await load(), "rn07")).toEqual({
      signal: "rn07",
      outcome: "not_evaluable",
      reason: "calendar_not_covering_year",
    });
  });

  it("reads the loader once per read, whatever the number of signals", async () => {
    use(fullScript());

    await load();

    expect(getParametersMock).toHaveBeenCalledTimes(1);
  });

  it("lets an injected value win, and reads the loader only for what is missing", async () => {
    getParametersMock.mockResolvedValue(
      read({ issuerRecurrenceThreshold: 2, lateFilingBusinessDays: 3 }),
    );
    const params = {
      issuerRecurrenceThreshold: 3,
      documentTypeCauses: DEFAULT_PARAMETERS.documentTypeCauses,
    };

    // The three injected: the loader is not read at all.
    use(onWednesday(SAME_ISSUER));
    const injected = await loadSignals({
      solicitudId: 42,
      referenceScope: SCOPE,
      params,
      timing: { lateFilingBusinessDays: 2 },
      calendar: constantCalendar({ 2026: ["2026-12-26"] }),
    });
    expect(getParametersMock).not.toHaveBeenCalled();
    expect(find(injected, "rn14")).toMatchObject({ outcome: "absent" });
    expect(find(injected, "rn07")).toMatchObject({ outcome: "present" });

    // Only the params injected: the days and the calendar come from the loader.
    use(onWednesday(SAME_ISSUER));
    const partial = await loadSignals({
      solicitudId: 42,
      referenceScope: SCOPE,
      params,
    });
    expect(getParametersMock).toHaveBeenCalledTimes(1);
    expect(find(partial, "rn14")).toMatchObject({ outcome: "absent" });
    expect(find(partial, "rn07")).toMatchObject({ outcome: "absent" });
  });

  it("falls back to the default behaviour when the loader read failed, and does not throw", async () => {
    getParametersMock.mockResolvedValue({
      values: DEFAULT_PARAMETERS,
      fallback: PARAMETER_KEYS,
      degraded: true,
    });
    use(onWednesday(SAME_ISSUER));

    const result = await load();

    expect(result.degraded).toBe(false);
    expect(find(result, "rn07")).toMatchObject({ outcome: "present" });
    expect(find(result, "rn14")).toMatchObject({ outcome: "absent" });
    expect(find(result, "rn13")).toMatchObject({ outcome: "absent" });
  });

  it("stays fail-soft when the loader itself rejects", async () => {
    getParametersMock.mockRejectedValue(new Error("boom"));
    use(fullScript());

    await expect(load()).resolves.toEqual({ data: null, degraded: true });
  });

  it("evaluates the rest signals and the marks whatever the active flag of a cause", async () => {
    use(fullScript());
    const allActive = await load();

    getParametersMock.mockResolvedValue(
      read({
        causes: DEFAULT_PARAMETERS.causes.map((c) => ({
          ...c,
          activa: c.codigo !== "medica" && c.codigo !== "fuerza_mayor",
        })),
      }),
    );
    use(fullScript());
    const deactivated = await load();

    // The request is `medica`, now deactivated: RN-09, RN-10 and RN-13 are
    // evaluated as before (NP-11).
    for (const signal of ["rn09", "rn10", "rn13"]) {
      expect(find(deactivated, signal)).toEqual(find(allActive, signal));
    }
    expect(find(deactivated, "rn09")).toMatchObject({ outcome: "absent" });
    expect(find(deactivated, "rn10")).toMatchObject({ outcome: "absent" });
  });
});
