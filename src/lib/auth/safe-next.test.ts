import { describe, expect, it } from "vitest";

import { safeNextPath } from "@/lib/auth/safe-next";

const ORIGIN = "https://app.test";

// Accepted values come back unchanged. "/%2F%2Fevil.com" stays accepted on
// purpose: it is a same-origin path, which the property check below proves.
const ACCEPTED = [
  "/",
  "/requests?x=1",
  "/review/12#top",
  "/%2F%2Fevil.com",
] as const;

const REJECTED: ReadonlyArray<readonly [string, unknown]> = [
  ["an empty string", ""],
  ["a protocol-relative URL", "//evil.com"],
  ["a slash followed by a backslash", "/\\evil.com"],
  ["a leading backslash", "\\evil.com"],
  ["a raw tab (browsers strip it and resolve //evil.com)", "/\t/evil.com"],
  ["an absolute URL", "https://evil.com"],
  ["a javascript: URL", "javascript:alert(1)"],
  ["null", null],
  ["an array", ["/a"]],
  ["a number", 42],
];

describe("safeNextPath (AEA-3, RNF-01 c)", () => {
  it.each(ACCEPTED)("keeps the same-origin path %s unchanged", (value) => {
    expect(safeNextPath(value)).toBe(value);
  });

  it.each(REJECTED)("falls back to / for %s", (_name, value) => {
    expect(safeNextPath(value)).toBe("/");
  });

  it("only ever resolves to the application origin", () => {
    const outputs = [...ACCEPTED, ...REJECTED.map(([, value]) => value)].map(
      (value) => safeNextPath(value),
    );

    expect(outputs).toHaveLength(ACCEPTED.length + REJECTED.length);
    for (const output of outputs) {
      expect(new URL(output, `${ORIGIN}/login`).origin).toBe(ORIGIN);
    }
  });
});
