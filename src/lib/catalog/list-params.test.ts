import { describe, expect, it } from "vitest";

import {
  ASIGNATURAS_SORT_KEYS,
  CATALOG_OPTIONS_MAX,
  DOCENTES_SORT_KEYS,
  catalogListHref,
  parseAsignaturasListParams,
  parseDocentesListParams,
} from "@/lib/catalog/list-params";

describe("constants", () => {
  it("the option cap is 2000", () => {
    expect(CATALOG_OPTIONS_MAX).toBe(2000);
  });
});

describe("catalog list parsers — status, page and q", () => {
  it.each([
    ["asignaturas", parseAsignaturasListParams],
    ["docentes", parseDocentesListParams],
  ] as const)("%s: status defaults to active", (_name, parse) => {
    expect(parse(undefined).status).toBe("active");
    expect(parse({}).status).toBe("active");
  });

  it.each(["inactive", "all", "active"])("accepts status %s", (status) => {
    expect(parseAsignaturasListParams({ status }).status).toBe(status);
    expect(parseDocentesListParams({ status }).status).toBe(status);
  });

  it.each([
    ["unknown", "archived"],
    ["empty", ""],
    ["wrong case", "ALL"],
    ["padded", " all"],
    ["array", ["all", "inactive"]],
  ])("falls back to active for a %s status", (_label, status) => {
    expect(parseAsignaturasListParams({ status }).status).toBe("active");
    expect(parseDocentesListParams({ status }).status).toBe("active");
  });

  it("falls back to page 1 for a zero page and collapses the q", () => {
    const result = parseDocentesListParams({ page: "0", q: "  mat  101 " });
    expect(result.page).toBe(1);
    expect(result.q).toBe("mat 101");
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

  it("works for the other list base", () => {
    expect(catalogListHref("/catalog/docentes", { q: "ana" })).toBe(
      "/catalog/docentes?q=ana",
    );
  });

  it("no longer accepts the retired Grupos list as a base (compile-time pin)", () => {
    // @ts-expect-error `/catalog/grupos` is not a list route any more.
    catalogListHref("/catalog/grupos", { page: 2 });
  });

  it("resets the page when q or status change: a link built without page has none", () => {
    // The caller builds the filter link from {q, status} only; no page leaks.
    expect(catalogListHref(base, { q: "x", status: "inactive" })).not.toContain(
      "page",
    );
  });

  it("round-trips through parseAsignaturasListParams", () => {
    const href = catalogListHref(base, {
      page: 4,
      q: "ana maría",
      status: "inactive",
    });
    const sp = Object.fromEntries(new URLSearchParams(href.split("?")[1]));
    expect(parseAsignaturasListParams(sp)).toMatchObject({
      page: 4,
      q: "ana maría",
      status: "inactive",
    });
  });
});

describe("sort keys", () => {
  it("lists the whitelisted columns of each catalog list (CM-LST-1)", () => {
    expect([...ASIGNATURAS_SORT_KEYS]).toEqual([
      "code",
      "name",
      "hours",
      "status",
    ]);
    expect([...DOCENTES_SORT_KEYS]).toEqual([
      "name",
      "login",
      "email",
      "status",
    ]);
  });
});

describe("parseAsignaturasListParams / parseDocentesListParams — defaults", () => {
  it("asignaturas: active, code ascending, size 10, page 1, empty q", () => {
    const expected = {
      page: 1,
      q: "",
      status: "active",
      sort: { key: "code", dir: "asc" },
      size: 10,
    };
    expect(parseAsignaturasListParams(undefined)).toEqual(expected);
    expect(parseAsignaturasListParams({})).toEqual(expected);
  });

  it("docentes: active, name ascending, size 10, page 1, empty q", () => {
    const expected = {
      page: 1,
      q: "",
      status: "active",
      sort: { key: "name", dir: "asc" },
      size: 10,
    };
    expect(parseDocentesListParams(undefined)).toEqual(expected);
    expect(parseDocentesListParams({})).toEqual(expected);
  });

  it("returns a fresh sort object on every call", () => {
    const a = parseDocentesListParams({});
    a.sort.dir = "desc";
    expect(parseDocentesListParams({}).sort.dir).toBe("asc");
  });
});

describe("parseAsignaturasListParams / parseDocentesListParams — sort fallback", () => {
  it.each([
    ["groups", "groups"],
    ["actions", "actions"],
    ["hashClave", "hashClave"],
    ["cif", "cif"],
    ["password", "password"],
    ["wrong case", "Name"],
    ["trailing punctuation", "name;"],
    ["empty", ""],
    ["repeated", ["name", "code"]],
  ])("falls back to the default pair for %s", (_label, sort) => {
    const raw = { sort, dir: "desc" };
    expect(parseAsignaturasListParams(raw).sort).toEqual({
      key: "code",
      dir: "asc",
    });
    expect(parseDocentesListParams(raw).sort).toEqual({
      key: "name",
      dir: "asc",
    });
  });

  it("rejects `hours` on docentes and `email` on asignaturas", () => {
    expect(
      parseDocentesListParams({ sort: "hours", dir: "desc" }).sort,
    ).toEqual({ key: "name", dir: "asc" });
    expect(
      parseAsignaturasListParams({ sort: "email", dir: "desc" }).sort,
    ).toEqual({ key: "code", dir: "asc" });
  });

  it.each(ASIGNATURAS_SORT_KEYS)("asignaturas accepts %s", (key) => {
    expect(parseAsignaturasListParams({ sort: key, dir: "desc" }).sort).toEqual(
      { key, dir: "desc" },
    );
  });

  it.each(DOCENTES_SORT_KEYS)("docentes accepts %s", (key) => {
    expect(parseDocentesListParams({ sort: key, dir: "desc" }).sort).toEqual({
      key,
      dir: "desc",
    });
  });
});

describe("parseAsignaturasListParams / parseDocentesListParams — dir, size, others", () => {
  it("a valid sort without a valid dir is ascending", () => {
    for (const dir of [undefined, "", "DESC", "up", ["desc"]]) {
      expect(parseDocentesListParams({ sort: "login", dir }).sort).toEqual({
        key: "login",
        dir: "asc",
      });
    }
  });

  it("dir alone is ignored", () => {
    expect(parseAsignaturasListParams({ dir: "desc" }).sort).toEqual({
      key: "code",
      dir: "asc",
    });
  });

  it("honours only the sizes 10, 25 and 50", () => {
    expect(parseAsignaturasListParams({ size: "25" }).size).toBe(25);
    expect(parseDocentesListParams({ size: "50" }).size).toBe(50);
    for (const size of ["100", "010", "1e1", "0", "", ["25"]]) {
      expect(parseDocentesListParams({ size }).size).toBe(10);
    }
  });

  it("parses page, q and status and ignores a scope", () => {
    const result = parseAsignaturasListParams({
      page: "3",
      q: "  mat  101 ",
      status: "all",
      scope: "all",
      carreraId: "7",
    });
    expect(result).toEqual({
      page: 3,
      q: "mat 101",
      status: "all",
      sort: { key: "code", dir: "asc" },
      size: 10,
    });
  });
});

describe("catalogListHref — sort and size", () => {
  it("omits the default sort and size for each base", () => {
    expect(
      catalogListHref("/catalog/asignaturas", {
        sort: { key: "code", dir: "asc" },
        size: 10,
      }),
    ).toBe("/catalog/asignaturas");
    expect(
      catalogListHref("/catalog/docentes", {
        sort: { key: "name", dir: "asc" },
        size: 10,
      }),
    ).toBe("/catalog/docentes");
  });

  it("a sort that is default for one base is not default for the other", () => {
    expect(
      catalogListHref("/catalog/docentes", {
        sort: { key: "status", dir: "asc" },
      }),
    ).toBe("/catalog/docentes?sort=status&dir=asc");
    expect(
      catalogListHref("/catalog/asignaturas", {
        sort: { key: "name", dir: "asc" },
      }),
    ).toBe("/catalog/asignaturas?sort=name&dir=asc");
  });

  it("writes sort and dir together when only the direction differs", () => {
    expect(
      catalogListHref("/catalog/asignaturas", {
        sort: { key: "code", dir: "desc" },
      }),
    ).toBe("/catalog/asignaturas?sort=code&dir=desc");
  });

  it("writes q, status, sort, dir, size and page in canonical order", () => {
    expect(
      catalogListHref("/catalog/docentes", {
        q: "ana",
        status: "all",
        sort: { key: "email", dir: "desc" },
        size: 50,
        page: 2,
      }),
    ).toBe(
      "/catalog/docentes?q=ana&status=all&sort=email&dir=desc&size=50&page=2",
    );
  });

  it("round-trips through the new parsers", () => {
    const state = {
      page: 3,
      q: "mat",
      status: "inactive" as const,
      sort: { key: "hours" as const, dir: "desc" as const },
      size: 25 as const,
    };
    const href = catalogListHref("/catalog/asignaturas", state);
    const sp = Object.fromEntries(new URLSearchParams(href.split("?")[1]));
    expect(parseAsignaturasListParams(sp)).toEqual(state);
  });

  it("rejects a sort key of the other list at compile time", () => {
    catalogListHref("/catalog/asignaturas", {
      // @ts-expect-error `login` is a docentes column, not an asignaturas one.
      sort: { key: "login", dir: "asc" },
    });
  });
});
