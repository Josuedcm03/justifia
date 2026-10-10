import { describe, expect, it } from "vitest";

import {
  CATALOG_OPTIONS_MAX,
  CATALOG_PAGE_SIZE,
  catalogListHref,
  parseCatalogListParams,
} from "@/lib/catalog/list-params";
import { USERS_PAGE_SIZE } from "@/lib/users/list-params";

describe("constants", () => {
  it("the page size equals the one of /users (A-4, CM-LST-1)", () => {
    expect(CATALOG_PAGE_SIZE).toBe(USERS_PAGE_SIZE);
    expect(CATALOG_PAGE_SIZE).toBe(10);
  });

  it("the option cap is 2000", () => {
    expect(CATALOG_OPTIONS_MAX).toBe(2000);
  });
});

describe("parseCatalogListParams — status", () => {
  it("defaults to active", () => {
    expect(parseCatalogListParams(undefined).status).toBe("active");
    expect(parseCatalogListParams({}).status).toBe("active");
  });

  it.each(["inactive", "all", "active"])("accepts %s", (status) => {
    expect(parseCatalogListParams({ status }).status).toBe(status);
  });

  it.each([
    ["unknown", "archived"],
    ["empty", ""],
    ["wrong case", "ALL"],
    ["padded", " all"],
    ["array", ["all", "inactive"]],
  ])("falls back to active for a %s value", (_label, status) => {
    expect(parseCatalogListParams({ status }).status).toBe("active");
  });
});

describe("parseCatalogListParams — page and q", () => {
  it("parses page and q like the users list", () => {
    expect(parseCatalogListParams({ page: "3", q: "  mat  101 " })).toEqual({
      page: 3,
      q: "mat 101",
      status: "active",
    });
    expect(parseCatalogListParams({ page: "0", q: ["a"] })).toEqual({
      page: 1,
      q: "",
      status: "active",
    });
  });

  it("ignores unrecognised keys such as a scope or a carrera", () => {
    const result = parseCatalogListParams({
      scope: "all",
      carreraId: "7",
    });
    expect(result).toEqual({ page: 1, q: "", status: "active" });
  });
});

describe("catalogListHref", () => {
  const base = "/catalog/asignaturas";

  it("omits page 1, an empty q and status=active", () => {
    expect(catalogListHref(base, {})).toBe(base);
    expect(catalogListHref(base, { page: 1, q: "", status: "active" })).toBe(
      base,
    );
  });

  it("keeps status when it is not the default", () => {
    expect(catalogListHref(base, { status: "inactive" })).toBe(
      `${base}?status=inactive`,
    );
    expect(catalogListHref(base, { status: "all" })).toBe(`${base}?status=all`);
  });

  it("keeps q, status and page together, page last", () => {
    expect(catalogListHref(base, { q: "mat", status: "all", page: 2 })).toBe(
      `${base}?q=mat&status=all&page=2`,
    );
  });

  it("works for the other two list bases", () => {
    expect(catalogListHref("/catalog/grupos", { page: 2 })).toBe(
      "/catalog/grupos?page=2",
    );
    expect(catalogListHref("/catalog/docentes", { q: "ana" })).toBe(
      "/catalog/docentes?q=ana",
    );
  });

  it("resets the page when q or status change: a link built without page has none", () => {
    // The caller builds the filter link from {q, status} only; no page leaks.
    expect(catalogListHref(base, { q: "x", status: "inactive" })).not.toContain(
      "page",
    );
  });

  it("round-trips through parseCatalogListParams", () => {
    const href = catalogListHref(base, {
      page: 4,
      q: "ana maría",
      status: "inactive",
    });
    const sp = Object.fromEntries(new URLSearchParams(href.split("?")[1]));
    expect(parseCatalogListParams(sp)).toEqual({
      page: 4,
      q: "ana maría",
      status: "inactive",
    });
  });
});
