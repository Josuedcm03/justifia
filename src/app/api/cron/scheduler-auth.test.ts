// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { timingSafeEqualSpy } = vi.hoisted(() => ({
  timingSafeEqualSpy: vi.fn(),
}));

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  timingSafeEqualSpy.mockImplementation(actual.timingSafeEqual);
  return { ...actual, timingSafeEqual: timingSafeEqualSpy };
});

import { NO_STORE, isScheduler } from "@/app/api/cron/scheduler-auth";

const SECRET = "s3cret-value-of-16+chars";

function requestWith(authorization?: string): Request {
  return new Request("http://localhost/api/cron/anything", {
    headers: authorization === undefined ? {} : { authorization },
  });
}

describe("isScheduler (D10, RNF-01)", () => {
  beforeEach(() => {
    timingSafeEqualSpy.mockClear();
  });

  it("accepts the exact Bearer secret", () => {
    expect(isScheduler(requestWith(`Bearer ${SECRET}`), SECRET)).toBe(true);
  });

  it.each([
    ["no header", undefined],
    ["an empty header", ""],
    ["a wrong secret", `Bearer ${SECRET}x`],
    ["a shorter secret", "Bearer s3cret"],
    ["the secret without the scheme", SECRET],
    ["another scheme", `Basic ${SECRET}`],
    ["a lowercase scheme", `bearer ${SECRET}`],
  ])("rejects %s", (_label, header) => {
    expect(isScheduler(requestWith(header), SECRET)).toBe(false);
  });

  it.each([undefined, ""])(
    "fails closed when the secret is %j, even for a matching header",
    (secret) => {
      expect(isScheduler(requestWith("Bearer undefined"), secret)).toBe(false);
      expect(isScheduler(requestWith("Bearer "), secret)).toBe(false);
      expect(timingSafeEqualSpy).not.toHaveBeenCalled();
    },
  );

  it("compares equal-length digests in constant time, whatever the input length", () => {
    isScheduler(requestWith("x"), SECRET);
    isScheduler(requestWith(`Bearer ${SECRET.repeat(50)}`), SECRET);

    expect(timingSafeEqualSpy).toHaveBeenCalledTimes(2);
    for (const [a, b] of timingSafeEqualSpy.mock.calls) {
      expect(a.length).toBe(32);
      expect(b.length).toBe(32);
    }
  });
});

describe("NO_STORE", () => {
  it("keeps scheduler responses out of every cache", () => {
    expect(NO_STORE).toEqual({ "Cache-Control": "private, no-store" });
  });
});
