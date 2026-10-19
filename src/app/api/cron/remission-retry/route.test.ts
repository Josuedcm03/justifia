// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { selectMock, dispatchMock, envMock, depsMock } = vi.hoisted(() => ({
  selectMock: vi.fn(),
  dispatchMock: vi.fn(),
  envMock: { CRON_SECRET: undefined as string | undefined },
  depsMock: vi.fn(),
}));

vi.mock("@/env", () => ({ env: envMock }));
vi.mock("@/lib/data/remision", () => ({ selectRetryCandidates: selectMock }));
vi.mock("@/lib/data/remission-dispatch", () => ({
  dispatchRemissions: dispatchMock,
}));
vi.mock("@/lib/intake/deps", () => ({ getIntakeDeps: depsMock }));

import * as routeModule from "@/app/api/cron/remission-retry/route";

const SECRET = "s3cret-value-of-16+chars";
const DEPS = { store: { id: "store" }, mail: { id: "mail" } };
const SUMMARY = {
  sent: 2,
  failed: 1,
  blocked: 0,
  skipped: 0,
  lost: 0,
  errored: 0,
};

function call(authorization?: string): Promise<Response> {
  return routeModule.GET(
    new Request("http://localhost/api/cron/remission-retry", {
      headers: authorization === undefined ? {} : { authorization },
    }),
  );
}

let info: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  selectMock.mockReset();
  selectMock.mockResolvedValue([31, 32, 33]);
  dispatchMock.mockReset();
  dispatchMock.mockResolvedValue(SUMMARY);
  depsMock.mockReset();
  depsMock.mockReturnValue(DEPS);
  envMock.CRON_SECRET = SECRET;
  info = vi.spyOn(console, "info").mockImplementation(() => undefined);
});

afterEach(() => {
  info.mockRestore();
});

describe("GET /api/cron/remission-retry: scheduler credential (RNF-01, RNF-07)", () => {
  it.each([
    ["no header", undefined],
    ["an empty header", ""],
    ["a wrong secret", `Bearer ${SECRET}x`],
    ["the secret without the scheme", SECRET],
    ["another scheme", `Basic ${SECRET}`],
  ])("rejects %s and sends nothing", async (_label, header) => {
    const response = await call(header);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
    expect(selectMock).not.toHaveBeenCalled();
    expect(dispatchMock).not.toHaveBeenCalled();
    expect(depsMock).not.toHaveBeenCalled();
  });

  it("fails closed when the secret is not configured", async () => {
    envMock.CRON_SECRET = undefined;

    const response = await call("Bearer undefined");

    expect(response.status).toBe(401);
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it("only answers GET", () => {
    expect(Object.keys(routeModule).sort()).toEqual(["GET"]);
  });
});

describe("GET /api/cron/remission-retry: the retry run", () => {
  it("dispatches exactly the due rows the data layer selected, as an automatic retry", async () => {
    const before = Date.now();
    const response = await call(`Bearer ${SECRET}`);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(selectMock).toHaveBeenCalledTimes(1);
    expect(selectMock.mock.calls[0][0].getTime()).toBeGreaterThanOrEqual(
      before,
    );
    expect(dispatchMock).toHaveBeenCalledTimes(1);
    expect(dispatchMock).toHaveBeenCalledWith(
      [31, 32, 33],
      { trigger: "reintento_automatico" },
      DEPS,
    );
  });

  it("takes no actor from the request: the dispatcher resolves the approving secretary", async () => {
    await call(`Bearer ${SECRET}`);

    const [, options] = dispatchMock.mock.calls[0];
    expect(Object.keys(options)).toEqual(["trigger"]);
  });

  it("responds with counts only", async () => {
    const response = await call(`Bearer ${SECRET}`);

    expect(await response.json()).toEqual({ selected: 3, ...SUMMARY });
  });

  it("logs one structured line with counts only", async () => {
    await call(`Bearer ${SECRET}`);

    expect(info).toHaveBeenCalledTimes(1);
    expect(JSON.parse(info.mock.calls[0][0] as string)).toEqual({
      event: "remission.retry",
      selected: 3,
      ...SUMMARY,
    });
    expect(String(info.mock.calls[0][0])).not.toContain(SECRET);
  });

  it("dispatches nothing and builds no dependencies when no row is due", async () => {
    selectMock.mockResolvedValue([]);

    const response = await call(`Bearer ${SECRET}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      selected: 0,
      sent: 0,
      failed: 0,
      blocked: 0,
      skipped: 0,
      lost: 0,
      errored: 0,
    });
    expect(dispatchMock).not.toHaveBeenCalled();
    expect(depsMock).not.toHaveBeenCalled();
  });

  it("answers 500 with a generic body when the selection fails", async () => {
    selectMock.mockRejectedValue(new Error("db down: postgres://x"));

    const response = await call(`Bearer ${SECRET}`);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "retry_failed" });
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it("answers 500 with a generic body when the dependencies cannot be built", async () => {
    depsMock.mockImplementation(() => {
      throw new Error("BLOB_READ_WRITE_TOKEN is not configured.");
    });

    const response = await call(`Bearer ${SECRET}`);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "retry_failed" });
  });
});
