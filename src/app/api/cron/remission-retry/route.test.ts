// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  selectMock,
  dispatchMock,
  selectNoticesMock,
  dispatchNoticesMock,
  envMock,
  depsMock,
  noticeDepsMock,
} = vi.hoisted(() => ({
  selectMock: vi.fn(),
  dispatchMock: vi.fn(),
  selectNoticesMock: vi.fn(),
  dispatchNoticesMock: vi.fn(),
  envMock: { CRON_SECRET: undefined as string | undefined },
  depsMock: vi.fn(),
  noticeDepsMock: vi.fn(),
}));

vi.mock("@/env", () => ({ env: envMock }));
vi.mock("@/lib/data/remision", () => ({ selectRetryCandidates: selectMock }));
vi.mock("@/lib/data/remission-dispatch", () => ({
  dispatchRemissions: dispatchMock,
}));
vi.mock("@/lib/data/escalamiento", () => ({
  selectEscalationRetryCandidates: selectNoticesMock,
}));
vi.mock("@/lib/data/escalation-dispatch", () => ({
  dispatchEscalationNotices: dispatchNoticesMock,
}));
vi.mock("@/lib/intake/deps", () => ({ getIntakeDeps: depsMock }));
vi.mock("@/lib/escalation/deps", () => ({ getEscalationDeps: noticeDepsMock }));

import * as routeModule from "@/app/api/cron/remission-retry/route";

const SECRET = "s3cret-value-of-16+chars";
const DEPS = { store: { id: "store" }, mail: { id: "mail" } };
const NOTICE_DEPS = { mail: { id: "mail" }, baseUrl: "https://j.example.edu" };
const SUMMARY = {
  sent: 2,
  failed: 1,
  blocked: 0,
  skipped: 0,
  lost: 0,
  errored: 0,
};
const NOTICE_SUMMARY = {
  sent: 1,
  failed: 0,
  blocked: 1,
  skipped: 0,
  lost: 0,
  errored: 0,
};
const EMPTY = {
  sent: 0,
  failed: 0,
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
let error: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  selectMock.mockReset();
  selectMock.mockResolvedValue([31, 32, 33]);
  dispatchMock.mockReset();
  dispatchMock.mockResolvedValue(SUMMARY);
  selectNoticesMock.mockReset();
  selectNoticesMock.mockResolvedValue([7, 8]);
  dispatchNoticesMock.mockReset();
  dispatchNoticesMock.mockResolvedValue(NOTICE_SUMMARY);
  depsMock.mockReset();
  depsMock.mockReturnValue(DEPS);
  noticeDepsMock.mockReset();
  noticeDepsMock.mockReturnValue(NOTICE_DEPS);
  envMock.CRON_SECRET = SECRET;
  info = vi.spyOn(console, "info").mockImplementation(() => undefined);
  error = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  info.mockRestore();
  error.mockRestore();
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
    expect(selectNoticesMock).not.toHaveBeenCalled();
    expect(dispatchNoticesMock).not.toHaveBeenCalled();
    expect(noticeDepsMock).not.toHaveBeenCalled();
  });

  it("fails closed when the secret is not configured", async () => {
    envMock.CRON_SECRET = undefined;

    const response = await call("Bearer undefined");

    expect(response.status).toBe(401);
    expect(dispatchMock).not.toHaveBeenCalled();
    expect(dispatchNoticesMock).not.toHaveBeenCalled();
  });

  it("only answers GET", () => {
    expect(Object.keys(routeModule).sort()).toEqual(["GET"]);
  });
});

describe("GET /api/cron/remission-retry: the remission batch", () => {
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

  it("keeps the remission counts at the top level of the response", async () => {
    const body = await (await call(`Bearer ${SECRET}`)).json();

    expect(body).toMatchObject({ selected: 3, ...SUMMARY });
  });

  it("dispatches nothing and builds no dependencies when no row is due", async () => {
    selectMock.mockResolvedValue([]);

    const response = await call(`Bearer ${SECRET}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ selected: 0, ...EMPTY });
    expect(dispatchMock).not.toHaveBeenCalled();
    expect(depsMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/cron/remission-retry: the coordination notice batch (RNF-07)", () => {
  it("dispatches exactly the pending notices the data layer selected, as an automatic retry", async () => {
    await call(`Bearer ${SECRET}`);

    expect(selectNoticesMock).toHaveBeenCalledTimes(1);
    expect(selectNoticesMock.mock.calls[0][0]).toBeInstanceOf(Date);
    expect(dispatchNoticesMock).toHaveBeenCalledWith(
      [7, 8],
      { trigger: "reintento_automatico" },
      NOTICE_DEPS,
    );
  });

  it("takes no actor from the request: the notice carries the escalating secretary", async () => {
    await call(`Bearer ${SECRET}`);

    const [, options] = dispatchNoticesMock.mock.calls[0];
    expect(Object.keys(options)).toEqual(["trigger"]);
  });

  it("runs the remission batch first, then the notices", async () => {
    const order: string[] = [];
    dispatchMock.mockImplementation(async () => {
      order.push("remissions");
      return SUMMARY;
    });
    dispatchNoticesMock.mockImplementation(async () => {
      order.push("notices");
      return NOTICE_SUMMARY;
    });

    await call(`Bearer ${SECRET}`);

    expect(order).toEqual(["remissions", "notices"]);
  });

  it("adds the notice counts under escalamientos, apart from the remission counts", async () => {
    const body = await (await call(`Bearer ${SECRET}`)).json();

    expect(body).toEqual({
      selected: 3,
      ...SUMMARY,
      escalamientos: { selected: 2, ...NOTICE_SUMMARY },
    });
  });

  it("logs one structured line with counts only", async () => {
    await call(`Bearer ${SECRET}`);

    expect(info).toHaveBeenCalledTimes(1);
    expect(JSON.parse(info.mock.calls[0][0] as string)).toEqual({
      event: "remission.retry",
      selected: 3,
      ...SUMMARY,
      escalamientos: { selected: 2, ...NOTICE_SUMMARY },
    });
    expect(String(info.mock.calls[0][0])).not.toContain(SECRET);
  });

  it("dispatches nothing and builds no notice dependencies when no notice is due", async () => {
    selectNoticesMock.mockResolvedValue([]);

    const response = await call(`Bearer ${SECRET}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      escalamientos: { selected: 0, ...EMPTY },
    });
    expect(dispatchNoticesMock).not.toHaveBeenCalled();
    expect(noticeDepsMock).not.toHaveBeenCalled();
  });

  it("does not select a notice that is bloqueada or enviada: it dispatches only what the selection returns", async () => {
    selectNoticesMock.mockResolvedValue([9]);

    await call(`Bearer ${SECRET}`);

    expect(dispatchNoticesMock.mock.calls[0][0]).toEqual([9]);
  });
});

describe("GET /api/cron/remission-retry: one outbox never stops the other", () => {
  it("still dispatches the notices when the remission selection fails", async () => {
    selectMock.mockRejectedValue(new Error("db down: postgres://x"));

    const response = await call(`Bearer ${SECRET}`);

    expect(dispatchMock).not.toHaveBeenCalled();
    expect(dispatchNoticesMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "retry_failed" });
  });

  it("still dispatches the notices when the remission dispatch throws", async () => {
    dispatchMock.mockRejectedValue(new Error("mail down"));

    const response = await call(`Bearer ${SECRET}`);

    expect(dispatchNoticesMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(500);
  });

  it("still dispatches the notices when the remission dependencies cannot be built", async () => {
    depsMock.mockImplementation(() => {
      throw new Error("BLOB_READ_WRITE_TOKEN is not configured.");
    });

    const response = await call(`Bearer ${SECRET}`);

    expect(dispatchNoticesMock).toHaveBeenCalledWith(
      [7, 8],
      { trigger: "reintento_automatico" },
      NOTICE_DEPS,
    );
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "retry_failed" });
  });

  it("still dispatches the remissions when the notice selection fails", async () => {
    selectNoticesMock.mockRejectedValue(new Error("db down"));

    const response = await call(`Bearer ${SECRET}`);

    expect(dispatchMock).toHaveBeenCalledTimes(1);
    expect(dispatchNoticesMock).not.toHaveBeenCalled();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "retry_failed" });
  });

  it("answers 500 once both batches ran when either failed, with a generic body and codes only in the log", async () => {
    dispatchNoticesMock.mockRejectedValue(
      new TypeError("coord1@uam.edu.ni leaked"),
    );

    const response = await call(`Bearer ${SECRET}`);

    expect(dispatchMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "retry_failed" });
    expect(JSON.stringify(error.mock.calls)).toContain("TypeError");
    expect(JSON.stringify(error.mock.calls)).not.toContain("coord1");
  });
});
