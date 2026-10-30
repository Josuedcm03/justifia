// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_MODEL_RESPONSE_BYTES } from "../limits";
import type { ExtractResult, PreparedDocument } from "../ports";
import { buildChatRequest } from "../template";
import { createNuExtractHttpExtractor } from "./nuextract-http-extractor";

// Every request goes through an injected `fetch`: no network, no container, no
// real document (RNF-03, RNF-04). The key and the address below are fakes.

const BASE_URL = "http://127.0.0.1:8080";
const API_KEY = "test-key-0123456789";
const URL_ONLY = { EXTRACTION_API_URL: BASE_URL };
const WITH_KEY = { ...URL_ONLY, EXTRACTION_API_KEY: API_KEY };

const PREPARED: PreparedDocument = {
  kind: "images",
  images: [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5])],
};

const ANSWER = {
  student_name: "Ana Perez",
  issuer: "Clinica Central",
  issue_date: "2026-07-20",
  rest_from: "2026-07-20",
  rest_to: "2026-07-24",
  rest_days: null,
};

const OPTIONS = { timeoutMs: 120_000 };

function completion(content: unknown, status = 200): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

type FetchFn = typeof fetch;

function build(fetchImpl: FetchFn, env: Record<string, string> = URL_ONLY) {
  return createNuExtractHttpExtractor({ env: () => env, fetch: fetchImpl });
}

/** A fetch double that answers every call with a fresh response. */
function answering(make: () => Response) {
  return vi.fn<FetchFn>(async () => make());
}

function requestOf(fetchMock: ReturnType<typeof vi.fn<FetchFn>>, call = 0) {
  const [input, init] = fetchMock.mock.calls[call];
  return { url: String(input), init: init as RequestInit };
}

beforeEach(() => {
  // The default config logger writes to the console once per process.
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("NuExtract HTTP extractor, request (DE-8, DE-12)", () => {
  it("POSTs the DE-8 body to {base}/v1/chat/completions", async () => {
    const fetchMock = answering(() => completion(JSON.stringify(ANSWER)));

    await build(fetchMock).extract(PREPARED, OPTIONS);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const { url, init } = requestOf(fetchMock);
    expect(url).toBe(`${BASE_URL}/v1/chat/completions`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual(buildChatRequest(PREPARED));
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
  });

  it("keeps a path in the address and drops a trailing slash", async () => {
    const fetchMock = answering(() => completion(JSON.stringify(ANSWER)));

    await build(fetchMock, {
      EXTRACTION_API_URL: "https://model.example.test/api/",
    }).extract(PREPARED, OPTIONS);

    expect(requestOf(fetchMock).url).toBe(
      "https://model.example.test/api/v1/chat/completions",
    );
  });

  it("sends no authorization header without a key", async () => {
    const fetchMock = answering(() => completion(JSON.stringify(ANSWER)));

    await build(fetchMock, URL_ONLY).extract(PREPARED, OPTIONS);

    expect(requestOf(fetchMock).init.headers).not.toHaveProperty(
      "Authorization",
    );
  });

  it("sends the bearer when a key is set, on the same address", async () => {
    const fetchMock = answering(() => completion(JSON.stringify(ANSWER)));

    await build(fetchMock, WITH_KEY).extract(PREPARED, OPTIONS);

    expect(requestOf(fetchMock).init.headers).toEqual({
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    });
  });

  it("refuses to follow a redirect, which could move the document to another host", async () => {
    const fetchMock = answering(() => completion(JSON.stringify(ANSWER)));

    await build(fetchMock).extract(PREPARED, OPTIONS);

    expect(requestOf(fetchMock).init.redirect).toBe("error");
  });

  it("aborts the call after the timeout it is given", async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    const fetchMock = answering(() => completion(JSON.stringify(ANSWER)));

    await build(fetchMock).extract(PREPARED, { timeoutMs: 45_000 });

    expect(timeoutSpy).toHaveBeenCalledWith(45_000);
    const signal = requestOf(fetchMock).init.signal;
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal?.aborted).toBe(false);
  });

  it.each([0, -1, -5_000])(
    "answers timeout at once, sending nothing, when the budget is %i ms",
    async (timeoutMs) => {
      const fetchMock = answering(() => completion(JSON.stringify(ANSWER)));

      const result = await build(fetchMock).extract(PREPARED, { timeoutMs });

      expect(result).toEqual({ ok: false, code: "timeout" });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
});

describe("NuExtract HTTP extractor, configuration", () => {
  it("is configured with an https address, or http toward loopback", () => {
    const fetchMock = answering(() => completion("{}"));

    expect(
      build(fetchMock, {
        EXTRACTION_API_URL: "https://model.example.test",
      }).isConfigured(),
    ).toBe(true);
    expect(build(fetchMock, URL_ONLY).isConfigured()).toBe(true);
  });

  it.each([
    ["no address", {}],
    ["an empty address", { EXTRACTION_API_URL: "  " }],
    [
      "plain http to a remote host",
      { EXTRACTION_API_URL: "http://example.com" },
    ],
    ["an unparsable address", { EXTRACTION_API_URL: "not a url" }],
  ])("is not configured with %s and sends nothing", async (_label, env) => {
    const fetchMock = answering(() => completion(JSON.stringify(ANSWER)));
    const extractor = build(fetchMock, env);

    expect(extractor.isConfigured()).toBe(false);
    const result = await extractor.extract(PREPARED, OPTIONS);

    expect(result).toEqual({ ok: false, code: "model_error" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads the environment at use, so a value set later takes effect", () => {
    let env: Record<string, string> = {};
    const extractor = createNuExtractHttpExtractor({
      env: () => env,
      fetch: answering(() => completion("{}")),
    });

    expect(extractor.isConfigured()).toBe(false);
    env = URL_ONLY;
    expect(extractor.isConfigured()).toBe(true);
  });
});

describe("NuExtract HTTP extractor, responses (DE-8)", () => {
  async function run(make: () => Response): Promise<ExtractResult> {
    return build(answering(make)).extract(PREPARED, OPTIONS);
  }

  it("returns the six fields of a JSON answer", async () => {
    expect(await run(() => completion(JSON.stringify(ANSWER)))).toEqual({
      ok: true,
      raw: ANSWER,
    });
  });

  it.each([
    ["a json fence", "```json\n" + JSON.stringify(ANSWER) + "\n```"],
    ["a bare fence", "```\n" + JSON.stringify(ANSWER) + "\n```"],
    ["surrounding whitespace", "\n  " + JSON.stringify(ANSWER) + "  \n"],
  ])("strips %s around the answer", async (_label, content) => {
    expect(await run(() => completion(content))).toEqual({
      ok: true,
      raw: ANSWER,
    });
  });

  it("ignores extra keys and accepts missing ones and numbers", async () => {
    const content = JSON.stringify({
      student_name: "Ana Perez",
      rest_days: 3,
      confidence: 0.9,
      notes: { free: "text" },
    });

    expect(await run(() => completion(content))).toEqual({
      ok: true,
      raw: { student_name: "Ana Perez", rest_days: 3 },
    });
  });

  it("accepts an all-null answer", async () => {
    const allNull = {
      student_name: null,
      issuer: null,
      issue_date: null,
      rest_from: null,
      rest_to: null,
      rest_days: null,
    };

    expect(await run(() => completion(JSON.stringify(allNull)))).toEqual({
      ok: true,
      raw: allNull,
    });
  });

  it.each([
    ["text that is not JSON", completion("I could not read this document")],
    ["a JSON array", completion("[1, 2]")],
    ["a JSON string", completion('"Ana"')],
    ["an object value", completion('{"student_name": {"first": "Ana"}}')],
    ["a boolean value", completion('{"issuer": true}')],
    ["an array value", completion('{"rest_days": [3]}')],
    ["a non-string content", completion({ student_name: "Ana" })],
    [
      "no choices",
      new Response(JSON.stringify({ choices: [] }), { status: 200 }),
    ],
    [
      "a body that is not JSON",
      new Response("<html>ok</html>", { status: 200 }),
    ],
    ["an empty body", new Response("", { status: 200 })],
  ])("answers invalid_response for %s", async (_label, response) => {
    const result = await run(() => response.clone());

    expect(result).toEqual({ ok: false, code: "invalid_response" });
  });

  it("reads a body of exactly 64 KiB", async () => {
    const head = JSON.stringify({
      choices: [{ message: { content: JSON.stringify(ANSWER) } }],
    });
    const body = head + " ".repeat(MAX_MODEL_RESPONSE_BYTES - head.length);
    expect(body.length).toBe(64 * 1024);

    const result = await run(() => new Response(body, { status: 200 }));

    expect(result).toEqual({ ok: true, raw: ANSWER });
  });

  it("answers invalid_response for a body over 64 KiB and stops reading it", async () => {
    let cancelled = false;
    let sent = 0;
    const chunk = new Uint8Array(16 * 1024).fill(0x20);
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        sent += chunk.length;
        controller.enqueue(chunk);
      },
      cancel() {
        cancelled = true;
      },
    });

    const result = await run(() => new Response(stream, { status: 200 }));

    expect(result).toEqual({ ok: false, code: "invalid_response" });
    expect(cancelled).toBe(true);
    // Stopped soon after the cap, not after draining an endless stream.
    expect(sent).toBeLessThanOrEqual(
      MAX_MODEL_RESPONSE_BYTES + 2 * chunk.length,
    );
  });

  it("answers model_error when the body stream breaks", async () => {
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new Error("socket hang up secret-host"));
      },
    });

    const result = await run(() => new Response(stream, { status: 200 }));

    expect(result).toEqual({ ok: false, code: "model_error" });
  });
});

describe("NuExtract HTTP extractor, failures (DE-7)", () => {
  it.each([400, 401, 403, 404, 429, 500])(
    "answers model_error for HTTP %i without retrying",
    async (status) => {
      const fetchMock = answering(() => new Response("nope", { status }));

      const result = await build(fetchMock, WITH_KEY).extract(
        PREPARED,
        OPTIONS,
      );

      expect(result).toEqual({ ok: false, code: "model_error" });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it("answers timeout when the call is aborted by its deadline", async () => {
    const controller = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    const fetchMock = vi.fn<FetchFn>(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(init.signal?.reason),
          );
        }),
    );

    const pending = build(fetchMock).extract(PREPARED, OPTIONS);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    controller.abort(new DOMException("deadline", "TimeoutError"));

    expect(await pending).toEqual({ ok: false, code: "timeout" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("answers model_error for a network error and never repeats its message", async () => {
    const secret = "connect ECONNREFUSED 10.9.8.7:8080 token=hunter2";
    const fetchMock = vi.fn<FetchFn>(async () => {
      throw new TypeError(secret);
    });
    // Out of retry budget on purpose: this test is about the error, not the retry.
    const result = await build(fetchMock, WITH_KEY).extract(PREPARED, {
      timeoutMs: 1_000,
    });

    expect(result).toEqual({ ok: false, code: "model_error" });
    const everything = JSON.stringify([
      result,
      vi.mocked(console.error).mock.calls,
    ]);
    for (const leaked of [secret, "hunter2", "10.9.8.7", API_KEY, BASE_URL]) {
      expect(everything).not.toContain(leaked);
    }
  });

  it("writes nothing to the console on any outcome", async () => {
    const log = vi.spyOn(console, "log");
    const warn = vi.spyOn(console, "warn");
    const error = vi.mocked(console.error);
    error.mockClear();

    await build(answering(() => completion("not json"))).extract(
      PREPARED,
      OPTIONS,
    );
    await build(answering(() => new Response("", { status: 401 }))).extract(
      PREPARED,
      OPTIONS,
    );

    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});

describe("NuExtract HTTP extractor, cold start retry (DE-7)", () => {
  const down = () => new TypeError("fetch failed");

  /** Starts a call and lets the 5 s wait elapse. */
  async function settle(
    pending: Promise<ExtractResult>,
    waitMs = 5_000,
  ): Promise<ExtractResult> {
    await vi.advanceTimersByTimeAsync(waitMs);
    return pending;
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("retries once after 5 s on a connection error, then returns the answer", async () => {
    const fetchMock = vi
      .fn<FetchFn>()
      .mockRejectedValueOnce(down())
      .mockImplementationOnce(async () => completion(JSON.stringify(ANSWER)));

    const pending = build(fetchMock).extract(PREPARED, OPTIONS);
    await vi.advanceTimersByTimeAsync(4_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const result = await settle(pending, 1);

    expect(result).toEqual({ ok: true, raw: ANSWER });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Same request twice: same attempt of the same document.
    expect(requestOf(fetchMock, 1).init.body).toBe(
      requestOf(fetchMock, 0).init.body,
    );
    expect(requestOf(fetchMock, 1).url).toBe(requestOf(fetchMock, 0).url);
  });

  it.each([502, 503, 504])("retries once on HTTP %i", async (status) => {
    const fetchMock = vi
      .fn<FetchFn>()
      .mockImplementationOnce(async () => new Response("", { status }))
      .mockImplementationOnce(async () => completion(JSON.stringify(ANSWER)));

    const result = await settle(build(fetchMock).extract(PREPARED, OPTIONS));

    expect(result).toEqual({ ok: true, raw: ANSWER });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([500, 401, 403, 429])("does not retry on HTTP %i", async (status) => {
    const fetchMock = answering(() => new Response("", { status }));

    const result = await build(fetchMock).extract(PREPARED, OPTIONS);

    expect(result).toEqual({ ok: false, code: "model_error" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gives up after the second failure: a connection error twice is model_error", async () => {
    const fetchMock = vi.fn<FetchFn>().mockRejectedValue(down());

    const result = await settle(build(fetchMock).extract(PREPARED, OPTIONS));

    expect(result).toEqual({ ok: false, code: "model_error" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after the second failure: 503 twice is model_error", async () => {
    const fetchMock = answering(() => new Response("", { status: 503 }));

    const result = await settle(build(fetchMock).extract(PREPARED, OPTIONS));

    expect(result).toEqual({ ok: false, code: "model_error" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a second time after a retried 502 then 502", async () => {
    const fetchMock = answering(() => new Response("", { status: 502 }));

    const result = await settle(build(fetchMock).extract(PREPARED, OPTIONS));
    await vi.advanceTimersByTimeAsync(60_000);

    expect(result).toEqual({ ok: false, code: "model_error" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("answers timeout when the retry is cut off by the deadline", async () => {
    const controller = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    const fetchMock = vi
      .fn<FetchFn>()
      .mockRejectedValueOnce(down())
      .mockImplementationOnce(
        (_input, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(init.signal?.reason),
            );
          }),
      );

    const pending = build(fetchMock).extract(PREPARED, OPTIONS);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    controller.abort(new DOMException("deadline", "TimeoutError"));

    expect(await pending).toEqual({ ok: false, code: "timeout" });
  });

  it.each([
    [25_000, true],
    [24_999, false],
    [20_000, false],
    [120_000, true],
  ])(
    "with a %i ms budget the retry is %s (5 s wait must leave 20 s)",
    async (timeoutMs, retried) => {
      const fetchMock = vi.fn<FetchFn>().mockRejectedValue(down());

      const result = await settle(
        build(fetchMock).extract(PREPARED, { timeoutMs }),
      );

      expect(result).toEqual({ ok: false, code: "model_error" });
      expect(fetchMock).toHaveBeenCalledTimes(retried ? 2 : 1);
    },
  );

  it("counts the time the first attempt already used against the retry budget", async () => {
    const fetchMock = vi.fn<FetchFn>(async () => {
      // The failed first call took 10 s: 30 s - 10 s - 5 s = 15 s < 20 s.
      vi.setSystemTime(Date.now() + 10_000);
      throw down();
    });

    const pending = build(fetchMock).extract(PREPARED, { timeoutMs: 30_000 });
    const result = await settle(pending, 0);

    expect(result).toEqual({ ok: false, code: "model_error" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
