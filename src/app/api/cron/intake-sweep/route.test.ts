// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  runIntakeSweepMock,
  runExtractionSweepMock,
  getExtractionDepsMock,
  envMock,
  depsMock,
  extractionDepsMock,
} = vi.hoisted(() => ({
  runIntakeSweepMock: vi.fn(),
  runExtractionSweepMock: vi.fn(),
  getExtractionDepsMock: vi.fn(),
  envMock: { CRON_SECRET: undefined as string | undefined },
  depsMock: { store: { id: "store" }, schedule: { id: "schedule" } },
  extractionDepsMock: { id: "extraction-deps" },
}));

vi.mock("@/env", () => ({ env: envMock }));
vi.mock("@/lib/data/intake-sweep", () => ({
  runIntakeSweep: runIntakeSweepMock,
}));
vi.mock("@/lib/intake/deps", () => ({ getIntakeDeps: () => depsMock }));
vi.mock("@/lib/extraction/run", () => ({
  runExtractionSweep: runExtractionSweepMock,
}));
vi.mock("@/lib/extraction/deps", () => ({
  getExtractionDeps: getExtractionDepsMock,
}));

import * as routeModule from "@/app/api/cron/intake-sweep/route";

const SECRET = "s3cret-value-of-16+chars";
const COUNTS = {
  draftsDeleted: 3,
  pendingDocumentsDeleted: 1,
  orphanBlobsDeleted: 2,
  extractionsRun: 4,
  extractionsAbandoned: 1,
  failures: 0,
};
const EXTRACTION_REPORT = { run: 4, abandoned: 1, failures: 0 };

function call(authorization?: string): Promise<Response> {
  return routeModule.GET(
    new Request("http://localhost/api/cron/intake-sweep", {
      headers: authorization === undefined ? {} : { authorization },
    }),
  );
}

let info: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  runIntakeSweepMock.mockReset();
  runIntakeSweepMock.mockResolvedValue(COUNTS);
  runExtractionSweepMock.mockReset();
  runExtractionSweepMock.mockResolvedValue(EXTRACTION_REPORT);
  getExtractionDepsMock.mockReset();
  getExtractionDepsMock.mockReturnValue(extractionDepsMock);
  envMock.CRON_SECRET = SECRET;
  info = vi.spyOn(console, "info").mockImplementation(() => undefined);
});

afterEach(() => {
  info.mockRestore();
});

describe("GET /api/cron/intake-sweep: scheduler credential (D10)", () => {
  it.each([
    ["no header", undefined],
    ["an empty header", ""],
    ["a wrong secret", `Bearer ${SECRET}x`],
    ["a shorter secret", "Bearer s3cret"],
    ["the secret without the scheme", SECRET],
    ["another scheme", `Basic ${SECRET}`],
    ["a lowercase scheme", `bearer ${SECRET}`],
  ])("rejects %s and deletes nothing", async (_label, header) => {
    const response = await call(header);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
    expect(runIntakeSweepMock).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
  });

  it("fails closed when the secret is not configured", async () => {
    envMock.CRON_SECRET = undefined;

    const response = await call("Bearer undefined");

    expect(response.status).toBe(401);
    expect(runIntakeSweepMock).not.toHaveBeenCalled();
  });

  it("only answers GET", () => {
    expect(
      Object.keys(routeModule).filter((name) => name !== "maxDuration"),
    ).toEqual(["GET"]);
  });
});

describe("GET /api/cron/intake-sweep: the sweep", () => {
  it("runs once with the clock and the store, and returns the counts", async () => {
    const before = Date.now();
    const response = await call(`Bearer ${SECRET}`);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual(COUNTS);
    expect(runIntakeSweepMock).toHaveBeenCalledTimes(1);
    const [now, store] = runIntakeSweepMock.mock.calls[0];
    expect(now.getTime()).toBeGreaterThanOrEqual(before);
    expect(store).toBe(depsMock.store);
  });

  it("logs one structured line with counts only", async () => {
    await call(`Bearer ${SECRET}`);

    expect(info).toHaveBeenCalledTimes(1);
    expect(JSON.parse(info.mock.calls[0][0] as string)).toEqual({
      event: "intake.sweep",
      ...COUNTS,
    });
    expect(String(info.mock.calls[0][0])).not.toContain(SECRET);
  });

  it("reports failed items in the counts without failing the call", async () => {
    runIntakeSweepMock.mockResolvedValue({ ...COUNTS, failures: 2 });

    const response = await call(`Bearer ${SECRET}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ failures: 2 });
  });

  it("answers 500 with a generic body when the whole sweep fails", async () => {
    runIntakeSweepMock.mockRejectedValue(new Error("db down: postgres://x"));

    const response = await call(`Bearer ${SECRET}`);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "sweep_failed" });
  });
});

describe("GET /api/cron/intake-sweep: extraction step (DE-11, RF-11)", () => {
  const DEADLINE = new Date("2026-10-07T15:04:35.000Z");
  const NOW = new Date("2026-10-07T15:00:00.000Z");

  /** The third argument the route handed to the sweep. */
  async function stepOf() {
    await call(`Bearer ${SECRET}`);
    const [, , step] = runIntakeSweepMock.mock.calls[0];
    return step as {
      sweep: (now: Date, deadline: Date) => Promise<unknown>;
    };
  }

  it("hands the sweep an extraction step built on the extraction wiring", async () => {
    const step = await stepOf();

    expect(typeof step.sweep).toBe("function");
    expect(await step.sweep(NOW, DEADLINE)).toEqual(EXTRACTION_REPORT);
    expect(runExtractionSweepMock).toHaveBeenCalledTimes(1);
    expect(runExtractionSweepMock).toHaveBeenCalledWith(
      NOW,
      DEADLINE,
      extractionDepsMock,
    );
  });

  it("builds the extraction wiring only when the step runs, so cleanup never depends on it", async () => {
    getExtractionDepsMock.mockImplementation(() => {
      throw new Error("sharp could not be loaded");
    });

    const step = await stepOf();

    expect(getExtractionDepsMock).not.toHaveBeenCalled();
    await expect(step.sweep(NOW, DEADLINE)).rejects.toThrow("sharp");
    expect(runExtractionSweepMock).not.toHaveBeenCalled();
  });

  it("a failing step is the sweep's to count: the call still answers 200 with the counts", async () => {
    runIntakeSweepMock.mockResolvedValue({ ...COUNTS, failures: 1 });

    const response = await call(`Bearer ${SECRET}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ failures: 1 });
  });

  it("reports the two extraction counts and no document data", async () => {
    const response = await call(`Bearer ${SECRET}`);
    const body = await response.json();

    expect(body).toEqual(COUNTS);
    expect(Object.keys(body).sort()).toEqual([
      "draftsDeleted",
      "extractionsAbandoned",
      "extractionsRun",
      "failures",
      "orphanBlobsDeleted",
      "pendingDocumentsDeleted",
    ]);
    expect(JSON.parse(info.mock.calls[0][0] as string)).toMatchObject({
      extractionsRun: COUNTS.extractionsRun,
      extractionsAbandoned: COUNTS.extractionsAbandoned,
    });
  });

  it.each([
    ["no header", undefined],
    ["a wrong secret", `Bearer ${SECRET}x`],
  ])("%s enqueues nothing and builds nothing", async (_label, header) => {
    const response = await call(header);

    expect(response.status).toBe(401);
    expect(getExtractionDepsMock).not.toHaveBeenCalled();
    expect(runExtractionSweepMock).not.toHaveBeenCalled();
    expect(runIntakeSweepMock).not.toHaveBeenCalled();
  });
});
