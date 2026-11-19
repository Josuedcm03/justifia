// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { runRetentionMock, envMock, depsMock } = vi.hoisted(() => ({
  runRetentionMock: vi.fn(),
  envMock: { CRON_SECRET: undefined as string | undefined },
  depsMock: { store: { id: "store" }, schedule: { id: "schedule" } },
}));

vi.mock("@/env", () => ({ env: envMock }));
vi.mock("@/lib/data/retention", () => ({ runRetention: runRetentionMock }));
vi.mock("@/lib/intake/deps", () => ({ getIntakeDeps: () => depsMock }));

import * as routeModule from "@/app/api/cron/retention/route";

const SECRET = "s3cret-value-of-16+chars";
const COUNTS = {
  dryRun: false,
  due: 3,
  cancelled: 2,
  documentsDeleted: 4,
  blobsDeleted: 4,
  failures: 1,
};

function call(authorization?: string, query = ""): Promise<Response> {
  return routeModule.GET(
    new Request(`http://localhost/api/cron/retention${query}`, {
      headers: authorization === undefined ? {} : { authorization },
    }),
  );
}

let info: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  runRetentionMock.mockReset();
  runRetentionMock.mockResolvedValue(COUNTS);
  envMock.CRON_SECRET = SECRET;
  info = vi.spyOn(console, "info").mockImplementation(() => undefined);
});

afterEach(() => {
  info.mockRestore();
});

describe("GET /api/cron/retention: scheduler credential (DR-10)", () => {
  it.each([
    ["no header", undefined],
    ["an empty header", ""],
    ["a wrong secret", `Bearer ${SECRET}x`],
    ["a shorter secret", "Bearer s3cret"],
    ["the secret without the scheme", SECRET],
    ["another scheme", `Basic ${SECRET}`],
    ["a lowercase scheme", `bearer ${SECRET}`],
  ])("rejects %s and cancels nothing", async (_label, header) => {
    const response = await call(header);

    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ error: "unauthorized" });
    expect(runRetentionMock).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
  });

  it("fails closed when the secret is not configured", async () => {
    envMock.CRON_SECRET = undefined;

    const response = await call("Bearer undefined");

    expect(response.status).toBe(401);
    expect(runRetentionMock).not.toHaveBeenCalled();
  });

  it("does not run a dry run for a caller without the bearer", async () => {
    const response = await call(undefined, "?dry=1");

    expect(response.status).toBe(401);
    expect(runRetentionMock).not.toHaveBeenCalled();
  });

  it("only answers GET", () => {
    expect(
      Object.keys(routeModule).filter((name) => name !== "maxDuration"),
    ).toEqual(["GET"]);
  });

  it("declares the literal ceiling that Next reads statically", () => {
    expect(routeModule.maxDuration).toBe(300);
  });
});

describe("GET /api/cron/retention: the run (DR-9, DR-10)", () => {
  it("runs once with the clock, the real store and a real (not dry) run", async () => {
    const before = Date.now();
    const response = await call(`Bearer ${SECRET}`);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual(COUNTS);
    expect(runRetentionMock).toHaveBeenCalledTimes(1);
    const [now, store, options] = runRetentionMock.mock.calls[0];
    expect(now.getTime()).toBeGreaterThanOrEqual(before);
    expect(store).toBe(depsMock.store);
    expect(options).toEqual({ dryRun: false });
  });

  it("forwards ?dry=1 as a dry run", async () => {
    runRetentionMock.mockResolvedValue({ ...COUNTS, dryRun: true });

    const response = await call(`Bearer ${SECRET}`, "?dry=1");

    expect(response.status).toBe(200);
    expect(runRetentionMock.mock.calls[0][2]).toEqual({ dryRun: true });
    expect(await response.json()).toMatchObject({ dryRun: true });
  });

  it.each(["?dry=0", "?dry=", "?other=1"])(
    "treats %s as a real run: only dry=1 asks for a dry run",
    async (query) => {
      await call(`Bearer ${SECRET}`, query);

      expect(runRetentionMock.mock.calls[0][2]).toEqual({ dryRun: false });
    },
  );

  it("returns counts only, with no ids, names or text", async () => {
    const response = await call(`Bearer ${SECRET}`);
    const body = await response.json();

    expect(Object.keys(body).sort()).toEqual([
      "blobsDeleted",
      "cancelled",
      "documentsDeleted",
      "dryRun",
      "due",
      "failures",
    ]);
  });

  it("logs one structured line with counts only", async () => {
    await call(`Bearer ${SECRET}`);

    expect(info).toHaveBeenCalledTimes(1);
    expect(JSON.parse(info.mock.calls[0][0] as string)).toEqual({
      event: "retention.run",
      ...COUNTS,
    });
    expect(String(info.mock.calls[0][0])).not.toContain(SECRET);
  });

  it("reports failed students in the counts without failing the call", async () => {
    runRetentionMock.mockResolvedValue({ ...COUNTS, failures: 2 });

    const response = await call(`Bearer ${SECRET}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ failures: 2 });
  });

  it("answers 500 with a generic body when the whole run fails", async () => {
    runRetentionMock.mockRejectedValue(
      new Error("retention system actor not found: postgres://x"),
    );

    const response = await call(`Bearer ${SECRET}`);

    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ error: "retention_failed" });
    expect(info).not.toHaveBeenCalled();
  });
});
