import { describe, expect, it } from "vitest";

import { firstValue, listHref, parsePage, parseQ } from "@/lib/list-params";

describe("firstValue", () => {
  it("returns a string as is, the first of an array, undefined otherwise", () => {
    expect(firstValue("a")).toBe("a");
    expect(firstValue(["a", "b"])).toBe("a");
    expect(firstValue([])).toBeUndefined();
    expect(firstValue(undefined)).toBeUndefined();
  });
});

describe("parsePage", () => {
  it.each([
    ["x", 1],
    ["0", 1],
    ["-3", 1],
    ["1.5", 1],
    ["", 1],
    ["1e9", 1],
    ["99999999999999999999", 1],
    ["1", 1],
    ["2", 2],
    ["7", 7],
  ])("page=%s -> %i", (raw, expected) => {
    expect(parsePage(raw)).toBe(expected);
  });

  it("falls back to 1 for undefined and for an array value", () => {
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage(["2", "7"])).toBe(1);
  });
});

describe("parseQ", () => {
  it("trims and collapses internal whitespace", () => {
    expect(parseQ("  Ana  María  ", 100)).toBe("Ana María");
  });

  it("returns an empty string for undefined and for an array value", () => {
    expect(parseQ(undefined, 100)).toBe("");
    expect(parseQ(["a", "b"], 100)).toBe("");
  });

  it("caps the term at the given maximum", () => {
    expect(parseQ("a".repeat(500), 100)).toHaveLength(100);
  });

  it("leaves wildcard characters untouched", () => {
    expect(parseQ("%_", 100)).toBe("%_");
  });
});

describe("listHref", () => {
  it("returns the bare base when every parameter is a default", () => {
    expect(listHref("/x", {})).toBe("/x");
    expect(listHref("/x", { page: 1, q: "" })).toBe("/x");
  });

  it("includes page only above 1", () => {
    expect(listHref("/x", { page: 2 })).toBe("/x?page=2");
  });

  it("percent-encodes q", () => {
    const href = listHref("/x", { q: "ana maría&x=1" });
    expect(href).not.toContain(" ");
    expect(href).not.toContain("&x=1");
    const [, qs] = href.split("?");
    expect(new URLSearchParams(qs).get("q")).toBe("ana maría&x=1");
  });

  it("writes q, then extra entries, then page", () => {
    expect(listHref("/x", { q: "a", page: 3, extra: { status: "all" } })).toBe(
      "/x?q=a&status=all&page=3",
    );
  });
});
