// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ExtractionClaim } from "@/lib/data/extraction";
import { createFakeDocumentStore } from "@/lib/intake/fakes";

import {
  createFakeFieldExtractor,
  createFakePreparer,
  type FakeFieldExtractor,
  type FakePreparer,
} from "./fakes";
import { modelTimeoutMs } from "./limits";
import {
  processRequestExtractions,
  runDocumentExtraction,
  runExtractionSweep,
  type ExtractionDeps,
} from "./run";
import { ENGINE_ID } from "./template";
import type { ExtractResult } from "./ports";

vi.mock("server-only", () => ({}));

const dataMock = vi.hoisted(() => ({
  claimExtraction: vi.fn(),
  completeExtraction: vi.fn(),
  failExtraction: vi.fn(),
  registerPendingExtractions: vi.fn(),
  abandonExpiredExtractions: vi.fn(),
  selectExtractionCandidates: vi.fn(),
}));
vi.mock("@/lib/data/extraction", () => dataMock);

// 15:00 UTC is 09:00 in Managua (UTC-6): the same calendar day.
const NOW = new Date("2026-10-22T15:00:00.000Z");
const PDF_BYTES = [0x25, 0x50, 0x44, 0x46];
const PATHNAME = "intake/42/a.pdf";

function claim(overrides: Partial<ExtractionClaim> = {}): ExtractionClaim {
  return {
    documentoId: 11,
    pathname: PATHNAME,
    tipoDetectado: "pdf",
    intentos: 1,
    reclamoId: "11111111-1111-4111-8111-111111111111",
    submittedAt: NOW,
    ...overrides,
  };
}

function answer(raw: Record<string, unknown> = {}): ExtractResult {
  return { ok: true, raw };
}

type Setup = {
  deps: ExtractionDeps;
  store: ReturnType<typeof createFakeDocumentStore>;
  preparer: FakePreparer;
  extractor: FakeFieldExtractor;
};

function setup(now: () => Date = () => NOW): Setup {
  const store = createFakeDocumentStore();
  store.seed(PATHNAME, PDF_BYTES);
  const preparer = createFakePreparer();
  const extractor = createFakeFieldExtractor();
  return {
    deps: { store, preparer, extractor, now },
    store,
    preparer,
    extractor,
  };
}

const DEADLINE = new Date(NOW.getTime() + 275_000);

function resetDataMock() {
  for (const mock of Object.values(dataMock)) mock.mockReset();
  dataMock.claimExtraction.mockResolvedValue(claim());
  dataMock.completeExtraction.mockResolvedValue(true);
  dataMock.failExtraction.mockResolvedValue(true);
}

describe("runDocumentExtraction (DE-6)", () => {
  beforeEach(resetDataMock);
  afterEach(() => vi.restoreAllMocks());

  describe("claim", () => {
    it("skips a document nobody may take and touches nothing else", async () => {
      dataMock.claimExtraction.mockResolvedValue(null);
      const { deps, preparer, extractor, store } = setup();
      const stream = vi.spyOn(store, "stream");

      const result = await runDocumentExtraction(11, deps, {
        deadline: DEADLINE,
      });

      expect(result).toEqual({ outcome: "skipped" });
      expect(dataMock.claimExtraction).toHaveBeenCalledWith(11, NOW);
      expect(extractor.configuredChecks).toBe(0);
      expect(stream).not.toHaveBeenCalled();
      expect(preparer.calls).toHaveLength(0);
      expect(extractor.calls).toHaveLength(0);
      expect(dataMock.completeExtraction).not.toHaveBeenCalled();
      expect(dataMock.failExtraction).not.toHaveBeenCalled();
    });
  });

  describe("not configured", () => {
    it("hands the claim back before reading the store or calling the network", async () => {
      const { deps, store, preparer, extractor } = setup();
      extractor.setConfigured(false);
      const stream = vi.spyOn(store, "stream");

      const result = await runDocumentExtraction(11, deps, {
        deadline: DEADLINE,
      });

      expect(result).toEqual({ outcome: "failed", code: "not_configured" });
      expect(dataMock.failExtraction).toHaveBeenCalledWith(
        claim(),
        "not_configured",
        NOW,
      );
      expect(stream).not.toHaveBeenCalled();
      expect(preparer.calls).toHaveLength(0);
      expect(extractor.calls).toHaveLength(0);
    });
  });

  describe("document unavailable", () => {
    it("fails when the store has no such file", async () => {
      const { deps, store, preparer } = setup();
      await store.delete([PATHNAME]);

      const result = await runDocumentExtraction(11, deps, {
        deadline: DEADLINE,
      });

      expect(result).toEqual({
        outcome: "failed",
        code: "document_unavailable",
      });
      expect(dataMock.failExtraction).toHaveBeenCalledWith(
        claim(),
        "document_unavailable",
        NOW,
      );
      expect(preparer.calls).toHaveLength(0);
    });

    it("fails when the store read throws, without leaking its message", async () => {
      const { deps, store } = setup();
      vi.spyOn(store, "stream").mockRejectedValue(
        new Error("blob token abc123 rejected"),
      );
      const log = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await runDocumentExtraction(11, deps, {
        deadline: DEADLINE,
      });

      expect(result).toEqual({
        outcome: "failed",
        code: "document_unavailable",
      });
      expect(dataMock.failExtraction).toHaveBeenCalledWith(
        claim(),
        "document_unavailable",
        NOW,
      );
      expect(JSON.stringify(log.mock.calls)).not.toContain("abc123");
    });

    it("fails when the body breaks halfway", async () => {
      const { deps, store } = setup();
      vi.spyOn(store, "stream").mockResolvedValue(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.error(new Error("connection reset"));
          },
        }),
      );

      const result = await runDocumentExtraction(11, deps, {
        deadline: DEADLINE,
      });

      expect(result).toEqual({
        outcome: "failed",
        code: "document_unavailable",
      });
    });
  });

  describe("preparation", () => {
    it.each(["unreadable_document", "render_unavailable"] as const)(
      "passes the preparer code %s through and never calls the model",
      async (code) => {
        const { deps, extractor, preparer } = setup();
        preparer.respondWith({ ok: false, code });

        const result = await runDocumentExtraction(11, deps, {
          deadline: DEADLINE,
        });

        expect(result).toEqual({ outcome: "failed", code });
        expect(dataMock.failExtraction).toHaveBeenCalledWith(
          claim(),
          code,
          NOW,
        );
        expect(extractor.calls).toHaveLength(0);
      },
    );

    it("hands the stored bytes and the detected kind to the preparer", async () => {
      dataMock.claimExtraction.mockResolvedValue(
        claim({ tipoDetectado: "jpeg" }),
      );
      const { deps, preparer, extractor } = setup();
      extractor.queue(answer());

      await runDocumentExtraction(11, deps, { deadline: DEADLINE });

      expect(preparer.calls).toHaveLength(1);
      expect(preparer.calls[0].kind).toBe("jpeg");
      expect([...preparer.calls[0].bytes]).toEqual(PDF_BYTES);
    });
  });

  describe("model errors", () => {
    it.each(["timeout", "model_error", "invalid_response"] as const)(
      "maps the extractor failure %s to the closed set",
      async (code) => {
        const { deps, extractor } = setup();
        extractor.queue({ ok: false, code });

        const result = await runDocumentExtraction(11, deps, {
          deadline: DEADLINE,
        });

        expect(result).toEqual({ outcome: "failed", code });
        expect(dataMock.failExtraction).toHaveBeenCalledWith(
          claim(),
          code,
          NOW,
        );
        expect(dataMock.completeExtraction).not.toHaveBeenCalled();
      },
    );

    it.each([
      [275_000, 120_000],
      [100_000, 90_000],
      [40_000, 30_000],
      [5_000, 0],
    ])(
      "gives the model call min(120 s, remaining - 10 s): %i ms left -> %i ms",
      async (remainingMs, expected) => {
        const { deps, extractor } = setup();
        extractor.queue(answer());

        await runDocumentExtraction(11, deps, {
          deadline: new Date(NOW.getTime() + remainingMs),
        });

        expect(extractor.calls[0].timeoutMs).toBe(expected);
        expect(expected).toBe(modelTimeoutMs(remainingMs));
      },
    );
  });

  describe("success", () => {
    it("validates the answer against the Managua date of the clock start and completes with the engine id", async () => {
      const { deps, extractor } = setup();
      extractor.queue(
        answer({
          student_name: "  Ana   Perez ",
          issuer: "Clinica Central",
          issue_date: "2026-10-20",
          rest_from: "2026-10-20",
          rest_to: "2026-10-24",
          rest_days: 4,
        }),
      );

      const result = await runDocumentExtraction(11, deps, {
        deadline: DEADLINE,
      });

      expect(result).toEqual({ outcome: "completed" });
      expect(dataMock.completeExtraction).toHaveBeenCalledWith(
        claim(),
        {
          studentName: "Ana Perez",
          issuer: "Clinica Central",
          issueDate: "2026-10-20",
          restFrom: "2026-10-20",
          restTo: "2026-10-24",
          restDays: 5,
        },
        ENGINE_ID,
        NOW,
      );
      expect(dataMock.failExtraction).not.toHaveBeenCalled();
    });

    it("reads the submission date in Managua, not in UTC", async () => {
      // 03:00 UTC on the 23rd is 21:00 on the 22nd in Managua: a document dated
      // the 23rd is after submission there, so it is not recognized.
      dataMock.claimExtraction.mockResolvedValue(
        claim({ submittedAt: new Date("2026-10-23T03:00:00.000Z") }),
      );
      const { deps, extractor } = setup();
      extractor.queue(
        answer({ issuer: "Clinica Central", issue_date: "2026-10-23" }),
      );

      await runDocumentExtraction(11, deps, { deadline: DEADLINE });

      expect(dataMock.completeExtraction.mock.calls[0][1]).toEqual({
        studentName: null,
        issuer: "Clinica Central",
        issueDate: null,
        restFrom: null,
        restTo: null,
        restDays: null,
      });
    });

    it("still completes when validation discards every value", async () => {
      const { deps, extractor } = setup();
      extractor.queue(
        answer({ issue_date: "2019-01-01", rest_from: "2026-10-22" }),
      );

      const result = await runDocumentExtraction(11, deps, {
        deadline: DEADLINE,
      });

      expect(result).toEqual({ outcome: "completed" });
      expect(dataMock.completeExtraction.mock.calls[0][1]).toEqual({
        studentName: null,
        issuer: null,
        issueDate: null,
        restFrom: null,
        restTo: null,
        restDays: null,
      });
      expect(dataMock.failExtraction).not.toHaveBeenCalled();
    });

    it("completes on an empty answer", async () => {
      const { deps, extractor } = setup();
      extractor.queue(answer({}));

      expect(
        await runDocumentExtraction(11, deps, { deadline: DEADLINE }),
      ).toEqual({ outcome: "completed" });
      expect(dataMock.completeExtraction).toHaveBeenCalledTimes(1);
    });

    it("reports a lost lease when the guarded completion matches nothing", async () => {
      dataMock.completeExtraction.mockResolvedValue(false);
      const { deps, extractor } = setup();
      extractor.queue(answer({ issuer: "Clinica Central" }));

      expect(
        await runDocumentExtraction(11, deps, { deadline: DEADLINE }),
      ).toEqual({ outcome: "lost" });
    });

    it("reports a lost lease when the guarded failure matches nothing", async () => {
      dataMock.failExtraction.mockResolvedValue(false);
      const { deps, extractor } = setup();
      extractor.queue({ ok: false, code: "model_error" });

      expect(
        await runDocumentExtraction(11, deps, { deadline: DEADLINE }),
      ).toEqual({ outcome: "lost" });
    });
  });

  describe("unexpected failure", () => {
    it("logs the error name only, keeps the lease and neither completes nor fails the row", async () => {
      const { deps, extractor } = setup();
      const secret = "https://model.internal key=abc123 Ana Perez";
      vi.spyOn(extractor, "extract").mockRejectedValue(new RangeError(secret));
      const log = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await runDocumentExtraction(11, deps, {
        deadline: DEADLINE,
      });

      expect(result).toEqual({ outcome: "errored" });
      expect(dataMock.failExtraction).not.toHaveBeenCalled();
      expect(dataMock.completeExtraction).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalledTimes(1);
      expect(log).toHaveBeenCalledWith("extraction_document_failed", {
        documentoId: 11,
        code: "RangeError",
      });
      expect(JSON.stringify(log.mock.calls)).not.toContain("model.internal");
    });

    it("also contains a failing claim or a failing completion", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      dataMock.claimExtraction.mockRejectedValueOnce(new TypeError("db down"));
      const first = setup();

      expect(
        await runDocumentExtraction(11, first.deps, { deadline: DEADLINE }),
      ).toEqual({ outcome: "errored" });

      dataMock.completeExtraction.mockRejectedValueOnce(
        new TypeError("db down"),
      );
      const second = setup();
      second.extractor.queue(answer());

      expect(
        await runDocumentExtraction(11, second.deps, { deadline: DEADLINE }),
      ).toEqual({ outcome: "errored" });
      expect(dataMock.failExtraction).not.toHaveBeenCalled();
    });
  });

  describe("logs", () => {
    it("write nothing on the success path and nothing from the document", async () => {
      const spies = (["log", "info", "warn", "error"] as const).map((level) =>
        vi.spyOn(console, level).mockImplementation(() => {}),
      );
      const { deps, extractor } = setup();
      extractor.queue(
        answer({ student_name: "Ana Perez", issuer: "Clinica Central" }),
      );

      await runDocumentExtraction(11, deps, { deadline: DEADLINE });

      for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    });
  });
});

/** A clock the test moves forward; each model call costs `msPerCall`. */
function setupWithClock(msPerCall: number, start: Date = NOW) {
  let at = start.getTime();
  const base = setup(() => new Date(at));
  const original = base.extractor.extract.bind(base.extractor);
  vi.spyOn(base.extractor, "extract").mockImplementation(
    async (prepared, options) => {
      at += msPerCall;
      return original(prepared, options);
    },
  );
  return base;
}

describe("processRequestExtractions (DE-5, DE-7)", () => {
  beforeEach(() => {
    resetDataMock();
    dataMock.registerPendingExtractions.mockResolvedValue([11]);
    dataMock.claimExtraction.mockImplementation(async (id: number) =>
      claim({ documentoId: id }),
    );
  });
  afterEach(() => vi.restoreAllMocks());

  it("registers first, then processes the ids it got back one at a time", async () => {
    dataMock.registerPendingExtractions.mockResolvedValue([11, 12, 13]);
    const events: string[] = [];
    dataMock.claimExtraction.mockImplementation(async (id: number) => {
      events.push(`claim:${id}`);
      return claim({ documentoId: id });
    });
    dataMock.completeExtraction.mockImplementation(
      async (c: ExtractionClaim) => {
        events.push(`complete:${c.documentoId}`);
        return true;
      },
    );
    const { deps, extractor } = setup();
    extractor.queue(answer(), answer(), answer());

    const summary = await processRequestExtractions(42, deps, {
      startedAt: NOW,
    });

    expect(dataMock.registerPendingExtractions).toHaveBeenCalledWith(42, NOW);
    expect(
      dataMock.registerPendingExtractions.mock.invocationCallOrder[0],
    ).toBeLessThan(dataMock.claimExtraction.mock.invocationCallOrder[0]);
    expect(events).toEqual([
      "claim:11",
      "complete:11",
      "claim:12",
      "complete:12",
      "claim:13",
      "complete:13",
    ]);
    expect(summary).toEqual({ processed: 3, errored: 0 });
  });

  describe("not configured", () => {
    it("registers the rows but claims nothing and burns no attempt", async () => {
      dataMock.registerPendingExtractions.mockResolvedValue([11, 12]);
      const { deps, extractor, store } = setup();
      extractor.setConfigured(false);
      const stream = vi.spyOn(store, "stream");

      const summary = await processRequestExtractions(42, deps, {
        startedAt: NOW,
      });

      expect(dataMock.registerPendingExtractions).toHaveBeenCalledTimes(1);
      expect(dataMock.claimExtraction).not.toHaveBeenCalled();
      expect(dataMock.failExtraction).not.toHaveBeenCalled();
      expect(stream).not.toHaveBeenCalled();
      expect(extractor.calls).toHaveLength(0);
      expect(summary).toEqual({ processed: 0, errored: 0 });
    });

    it("does process the same rows once the extractor is configured", async () => {
      dataMock.registerPendingExtractions.mockResolvedValue([11, 12]);
      const { deps, extractor } = setup();
      extractor.queue(answer(), answer());

      const summary = await processRequestExtractions(42, deps, {
        startedAt: NOW,
      });

      expect(dataMock.claimExtraction).toHaveBeenCalledTimes(2);
      expect(summary.processed).toBe(2);
    });
  });

  describe("deadline", () => {
    it("with five rows and a budget for two, processes two and leaves three untouched", async () => {
      dataMock.registerPendingExtractions.mockResolvedValue([1, 2, 3, 4, 5]);
      // Each call takes 200 s of the 275 s available, so a second document
      // starts with 75 s left and a third has none.
      const { deps, extractor } = setupWithClock(200_000);
      extractor.queue(answer(), answer(), answer(), answer(), answer());

      const summary = await processRequestExtractions(42, deps, {
        startedAt: NOW,
      });

      expect(summary).toEqual({ processed: 2, errored: 0 });
      expect(dataMock.claimExtraction.mock.calls.map((c) => c[0])).toEqual([
        1, 2,
      ]);
    });

    it("gives each model call min(120 s, remaining - 10 s)", async () => {
      dataMock.registerPendingExtractions.mockResolvedValue([1, 2, 3]);
      const { deps, extractor } = setupWithClock(200_000);
      extractor.queue(answer(), answer(), answer());

      await processRequestExtractions(42, deps, { startedAt: NOW });

      expect(extractor.calls.map((c) => c.timeoutMs)).toEqual([
        modelTimeoutMs(275_000),
        modelTimeoutMs(75_000),
      ]);
      expect(extractor.calls.map((c) => c.timeoutMs)).toEqual([
        120_000, 65_000,
      ]);
    });

    it.each([
      [19_999, 0],
      [20_000, 1],
    ])(
      "with %i ms left starts %i documents (the minimum is 20 s)",
      async (remainingMs, started) => {
        // The deadline is startedAt + 275 s, so shift startedAt to leave
        // exactly `remainingMs` when processing begins.
        const startedAt = new Date(NOW.getTime() - (275_000 - remainingMs));
        const { deps, extractor } = setup();
        extractor.queue(answer());

        const summary = await processRequestExtractions(42, deps, {
          startedAt,
        });

        expect(summary.processed).toBe(started);
        expect(dataMock.claimExtraction).toHaveBeenCalledTimes(started);
      },
    );

    it("counts the time since the action began, not since the callback ran", async () => {
      // The action started 270 s ago: 5 s remain, below the minimum.
      const { deps } = setup();

      const summary = await processRequestExtractions(42, deps, {
        startedAt: new Date(NOW.getTime() - 270_000),
      });

      expect(summary.processed).toBe(0);
      expect(dataMock.claimExtraction).not.toHaveBeenCalled();
    });

    it("honors an explicit deadline over the one derived from startedAt", async () => {
      const { deps, extractor } = setup();
      extractor.queue(answer());

      const tight = await processRequestExtractions(42, deps, {
        deadline: new Date(NOW.getTime() + 19_000),
      });
      expect(tight.processed).toBe(0);

      const roomy = await processRequestExtractions(42, deps, {
        deadline: new Date(NOW.getTime() + 60_000),
      });
      expect(roomy.processed).toBe(1);
    });
  });

  describe("outcomes", () => {
    it("does not count a document nobody could claim", async () => {
      dataMock.registerPendingExtractions.mockResolvedValue([11, 12]);
      dataMock.claimExtraction.mockImplementation(async (id: number) =>
        id === 11 ? null : claim({ documentoId: id }),
      );
      const { deps, extractor } = setup();
      extractor.queue(answer());

      const summary = await processRequestExtractions(42, deps, {
        startedAt: NOW,
      });

      expect(summary).toEqual({ processed: 1, errored: 0 });
    });

    it("keeps going after a document throws and counts it as errored", async () => {
      dataMock.registerPendingExtractions.mockResolvedValue([11, 12]);
      vi.spyOn(console, "error").mockImplementation(() => {});
      const { deps, extractor } = setup();
      vi.spyOn(extractor, "extract")
        .mockRejectedValueOnce(new TypeError("boom"))
        .mockResolvedValueOnce(answer());

      const summary = await processRequestExtractions(42, deps, {
        startedAt: NOW,
      });

      expect(summary).toEqual({ processed: 2, errored: 1 });
      expect(dataMock.completeExtraction).toHaveBeenCalledTimes(1);
    });

    it("lets a registration failure reach the caller", async () => {
      dataMock.registerPendingExtractions.mockRejectedValue(
        new Error("db down"),
      );
      const { deps } = setup();

      await expect(
        processRequestExtractions(42, deps, { startedAt: NOW }),
      ).rejects.toThrow("db down");
      expect(dataMock.claimExtraction).not.toHaveBeenCalled();
    });
  });
});

describe("runExtractionSweep (DE-11)", () => {
  beforeEach(() => {
    resetDataMock();
    dataMock.abandonExpiredExtractions.mockResolvedValue(0);
    dataMock.selectExtractionCandidates.mockResolvedValue([]);
    dataMock.registerPendingExtractions.mockImplementation(
      async (solicitudId: number) => [solicitudId * 10],
    );
    dataMock.claimExtraction.mockImplementation(async (id: number) =>
      claim({ documentoId: id }),
    );
  });
  afterEach(() => vi.restoreAllMocks());

  it("closes the expired last-attempt leases first, then selects a bounded batch", async () => {
    dataMock.abandonExpiredExtractions.mockResolvedValue(2);
    const { deps } = setup();

    const report = await runExtractionSweep(NOW, DEADLINE, deps);

    expect(dataMock.abandonExpiredExtractions).toHaveBeenCalledWith(NOW);
    expect(dataMock.selectExtractionCandidates).toHaveBeenCalledWith(NOW, 10);
    expect(
      dataMock.abandonExpiredExtractions.mock.invocationCallOrder[0],
    ).toBeLessThan(
      dataMock.selectExtractionCandidates.mock.invocationCallOrder[0],
    );
    expect(report).toEqual({ run: 0, abandoned: 2, failures: 0 });
  });

  it("skips the candidates when not configured but still closes the leases", async () => {
    dataMock.abandonExpiredExtractions.mockResolvedValue(3);
    dataMock.selectExtractionCandidates.mockResolvedValue([5, 6]);
    const { deps, extractor } = setup();
    extractor.setConfigured(false);

    const report = await runExtractionSweep(NOW, DEADLINE, deps);

    expect(dataMock.abandonExpiredExtractions).toHaveBeenCalledTimes(1);
    expect(dataMock.selectExtractionCandidates).not.toHaveBeenCalled();
    expect(dataMock.registerPendingExtractions).not.toHaveBeenCalled();
    expect(dataMock.claimExtraction).not.toHaveBeenCalled();
    expect(report).toEqual({ run: 0, abandoned: 3, failures: 0 });
  });

  it("processes each candidate request through the use case and sums the documents", async () => {
    dataMock.selectExtractionCandidates.mockResolvedValue([5, 6, 7]);
    const { deps, extractor } = setup();
    extractor.queue(answer(), answer(), answer());

    const report = await runExtractionSweep(NOW, DEADLINE, deps);

    expect(
      dataMock.registerPendingExtractions.mock.calls.map((c) => c[0]),
    ).toEqual([5, 6, 7]);
    expect(dataMock.claimExtraction.mock.calls.map((c) => c[0])).toEqual([
      50, 60, 70,
    ]);
    expect(report).toEqual({ run: 3, abandoned: 0, failures: 0 });
  });

  it("stops taking up requests once the deadline leaves no room for a document", async () => {
    dataMock.selectExtractionCandidates.mockResolvedValue([5, 6, 7]);
    // 60 s of budget; the first document takes 50 s, leaving 10 s (< 20 s).
    const { deps, extractor } = setupWithClock(50_000);
    extractor.queue(answer(), answer(), answer());

    const report = await runExtractionSweep(
      NOW,
      new Date(NOW.getTime() + 60_000),
      deps,
    );

    expect(report.run).toBe(1);
    expect(dataMock.registerPendingExtractions).toHaveBeenCalledTimes(1);
    expect(dataMock.registerPendingExtractions).toHaveBeenCalledWith(
      5,
      expect.any(Date),
    );
  });

  it("counts a request that throws as a failure and still runs the next one", async () => {
    dataMock.selectExtractionCandidates.mockResolvedValue([5, 6]);
    dataMock.registerPendingExtractions
      .mockRejectedValueOnce(new TypeError("db down at host-x"))
      .mockImplementation(async (solicitudId: number) => [solicitudId * 10]);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { deps, extractor } = setup();
    extractor.queue(answer());

    const report = await runExtractionSweep(NOW, DEADLINE, deps);

    expect(report).toEqual({ run: 1, abandoned: 0, failures: 1 });
    expect(log).toHaveBeenCalledWith("extraction_sweep_request_failed", {
      solicitudId: 5,
      code: "TypeError",
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain("host-x");
  });

  it("counts documents that ended in an unexpected throw as failures", async () => {
    dataMock.selectExtractionCandidates.mockResolvedValue([5, 6]);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { deps, extractor } = setup();
    vi.spyOn(extractor, "extract")
      .mockRejectedValueOnce(new RangeError("boom"))
      .mockResolvedValueOnce(answer());

    const report = await runExtractionSweep(NOW, DEADLINE, deps);

    expect(report).toEqual({ run: 2, abandoned: 0, failures: 1 });
  });

  it("lets a failing leases step reach the caller before anything is selected", async () => {
    dataMock.abandonExpiredExtractions.mockRejectedValue(new Error("db down"));
    const { deps } = setup();

    await expect(runExtractionSweep(NOW, DEADLINE, deps)).rejects.toThrow(
      "db down",
    );
    expect(dataMock.selectExtractionCandidates).not.toHaveBeenCalled();
  });
});
