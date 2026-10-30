import { describe, expect, it } from "vitest";

import { mailIdempotencyKey } from "./idempotency-key";

describe("mailIdempotencyKey (TR-6)", () => {
  it("is the prefix, the id and 16 hex digits of the payload digest", () => {
    expect(mailIdempotencyKey("remision", 31, { to: "a@x.ni" })).toMatch(
      /^remision-31-[0-9a-f]{16}$/,
    );
  });

  it("is stable for an equal payload and new when the payload changes", () => {
    const base = mailIdempotencyKey("escalamiento", 7, {
      to: "a@x.ni",
      cc: [],
    });
    expect(
      mailIdempotencyKey("escalamiento", 7, { to: "a@x.ni", cc: [] }),
    ).toBe(base);
    expect(
      mailIdempotencyKey("escalamiento", 7, { to: "b@x.ni", cc: [] }),
    ).not.toBe(base);
    expect(
      mailIdempotencyKey("escalamiento", 8, { to: "a@x.ni", cc: [] }),
    ).not.toBe(base);
  });
});
