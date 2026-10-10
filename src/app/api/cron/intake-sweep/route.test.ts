// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { runIntakeSweepMock, envMock, depsMock } = vi.hoisted(() => ({
  runIntakeSweepMock: vi.fn(),
  envMock: { CRON_SECRET: undefined as string | undefined },
  depsMock: { store: { id: "store" }, schedule: { id: "schedule" } },
}));

vi.mock("@/env", () => ({ env: envMock }));
vi.mock("@/lib/data/intake-sweep", () => ({
  runIntakeSweep: runIntakeSweepMock,
}));
vi.mock("@/lib/intake/deps", () => ({ getIntakeDeps: () => depsMock }));

import * as routeModule from "@/app/api/cron/intake-sweep/route";

const SECRET = "s3cret-value-of-16+chars";
const COUNTS = {
  draftsDeleted: 3,
  pendingDocumentsDeleted: 1,
  orphanBlobsDeleted: 2,
  failures: 0,
};

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
    expect(Object.keys(routeModule).sort()).toEqual(["GET"]);
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
