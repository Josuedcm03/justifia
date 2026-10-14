import { describe, expect, it } from "vitest";

import {
  applyListChange,
  DEFAULT_PAGE_SIZE,
  firstValue,
  listHref,
  nextSort,
  PAGE_SIZE_OPTIONS,
  parseEnum,
  parsePage,
  parsePageSize,
  parseQ,
  parseSort,
  type ListSort,
} from "@/lib/list-params";

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

describe("page size constants", () => {
  it("offers exactly 10, 25 and 50 with 10 as the default", () => {
    expect([...PAGE_SIZE_OPTIONS]).toEqual([10, 25, 50]);
    expect(DEFAULT_PAGE_SIZE).toBe(10);
  });
});

describe("parseEnum", () => {
  const allowed = ["active", "inactive", "all"] as const;

  it.each([
    ["active", "active"],
    ["inactive", "inactive"],
    ["all", "all"],
  ])("honours the exact value %s", (raw, expected) => {
    expect(parseEnum(raw, allowed, "all")).toBe(expected);
  });

  it.each([
    ["bogus"],
    ["ACTIVE"],
    ["Active"],
    [" active"],
    [""],
    ["__proto__"],
    ["constructor"],
  ])("falls back for %j", (raw) => {
    expect(parseEnum(raw, allowed, "inactive")).toBe("inactive");
  });

  it("falls back for undefined and for a repeated (array) value", () => {
    expect(parseEnum(undefined, allowed, "all")).toBe("all");
    expect(parseEnum(["active", "all"], allowed, "all")).toBe("all");
    expect(parseEnum(["active"], allowed, "inactive")).toBe("inactive");
  });
});

describe("parsePageSize", () => {
  it.each([
    ["10", 10],
    ["25", 25],
    ["50", 50],
  ])("size=%s is honoured", (raw, expected) => {
    expect(parsePageSize(raw)).toBe(expected);
  });

  it.each([
    ["0"],
    ["-5"],
    ["5"],
    ["100"],
    ["1000"],
    ["9999"],
    ["10.5"],
    ["010"],
    ["abc"],
    [""],
    ["1e1"],
    [" 25"],
    ["25 "],
    ["+25"],
  ])("size=%j falls back to 10", (raw) => {
    expect(parsePageSize(raw)).toBe(10);
  });

  it("falls back to 10 for undefined and for a repeated value", () => {
    expect(parsePageSize(undefined)).toBe(10);
    expect(parsePageSize(["25", "50"])).toBe(10);
  });
});

describe("parseSort", () => {
  const keys = ["name", "login", "created"] as const;
  type Key = (typeof keys)[number];
  const fallback: ListSort<Key> = { key: "created", dir: "desc" };

  it.each([
    ["name", "asc", { key: "name", dir: "asc" }],
    ["name", "desc", { key: "name", dir: "desc" }],
    ["login", "desc", { key: "login", dir: "desc" }],
    ["created", "asc", { key: "created", dir: "asc" }],
    ["created", "desc", { key: "created", dir: "desc" }],
  ])("sort=%s dir=%s is honoured", (sort, dir, expected) => {
    expect(parseSort(sort, dir, keys, fallback)).toEqual(expected);
  });

  it.each([
    ["missing dir", undefined],
    ["empty dir", ""],
    ["unknown dir", "sideways"],
    ["upper-case dir", "DESC"],
    ["numeric dir", "1"],
    ["repeated dir", ["desc", "asc"]],
  ])("a valid sort with %s is ascending", (_label, dir) => {
    expect(parseSort("name", dir, keys, fallback)).toEqual({
      key: "name",
      dir: "asc",
    });
  });

  it.each([
    ["absent", undefined],
    ["empty", ""],
    ["unknown", "nope"],
    ["upper-case", "NAME"],
    ["list", "name,id"],
    ["a private column", "hashClave"],
    ["a prototype key", "__proto__"],
    ["constructor", "constructor"],
    ["an injection attempt", "name; DROP TABLE x"],
    ["500 characters", "a".repeat(500)],
    ["a key of another list", "hours"],
    ["repeated", ["name", "login"]],
    ["a single-element array", ["name"]],
  ])("an invalid sort (%s) gives the fallback pair", (_label, sort) => {
    expect(parseSort(sort, "asc", keys, fallback)).toEqual(fallback);
  });

  it("ignores dir when the sort is invalid, even if dir is valid", () => {
    expect(parseSort("nope", "asc", keys, fallback)).toEqual({
      key: "created",
      dir: "desc",
    });
    expect(parseSort(undefined, "asc", keys, fallback).dir).toBe("desc");
  });

  it("returns a fresh object, never the fallback instance", () => {
    expect(parseSort(undefined, undefined, keys, fallback)).not.toBe(fallback);
  });
});

describe("nextSort", () => {
  const current: ListSort<"name" | "login"> = { key: "name", dir: "asc" };

  it("flips the direction when the same key is chosen", () => {
    expect(nextSort(current, "name")).toEqual({ key: "name", dir: "desc" });
    expect(nextSort({ key: "name", dir: "desc" }, "name")).toEqual({
      key: "name",
      dir: "asc",
    });
  });

  it("starts a new key ascending, whatever the current direction was", () => {
    expect(nextSort(current, "login")).toEqual({ key: "login", dir: "asc" });
    expect(nextSort({ key: "name", dir: "desc" }, "login")).toEqual({
      key: "login",
      dir: "asc",
    });
  });
});

describe("applyListChange", () => {
  const state = { page: 3, q: "ana", status: "all", size: 25 };

  it.each([
    ["a search term", { q: "luis" }, { ...state, q: "luis", page: 1 }],
    [
      "the status",
      { status: "active" },
      { ...state, status: "active", page: 1 },
    ],
    ["the page size", { size: 50 }, { ...state, size: 50, page: 1 }],
    [
      "several fields at once",
      { q: "", size: 10 },
      { ...state, q: "", size: 10, page: 1 },
    ],
  ])(
    "changing %s returns page 1 and keeps the rest",
    (_l, change, expected) => {
      expect(applyListChange(state, change)).toEqual(expected);
    },
  );

  it("a page-only change keeps every other value", () => {
    expect(applyListChange(state, { page: 4 })).toEqual({ ...state, page: 4 });
  });

  it("a non-page change wins over an accompanying page value", () => {
    expect(applyListChange(state, { q: "luis", page: 5 }).page).toBe(1);
  });

  it("does not mutate the input state", () => {
    const before = { ...state };
    applyListChange(state, { q: "luis" });
    expect(state).toEqual(before);
  });
});
