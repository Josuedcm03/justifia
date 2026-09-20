import { describe, expect, it } from "vitest";

import { containsPattern, escapeLikePattern } from "@/lib/data/sql-like";

describe("escapeLikePattern", () => {
  it.each([
    ["100%", "100\\%"],
    ["a_b", "a\\_b"],
    ["c:\\x", "c:\\\\x"],
    ["%_\\", "\\%\\_\\\\"],
    ["", ""],
    ["plain text", "plain text"],
    ["ünïcödé", "ünïcödé"],
  ])("escapes %s to the literal-matching pattern", (input, expected) => {
    expect(escapeLikePattern(input)).toBe(expected);
  });
});

describe("containsPattern", () => {
  it("wraps the escaped term in % wildcards", () => {
    expect(containsPattern("a%b")).toBe("%a\\%b%");
  });

  it("returns bare % wildcards for an empty term", () => {
    expect(containsPattern("")).toBe("%%");
  });
});
