import { describe, expect, it } from "vitest";

import { DEFAULT_PAGE_SIZE } from "@/lib/list-params";

import {
  parseUsersListParams,
  USERS_DEFAULT_SORT,
  USERS_PAGE_SIZE,
  USERS_SEARCH_MAX,
  USERS_SORT_KEYS,
  usersListHref,
} from "@/lib/users/list-params";

describe("constants", () => {
  it("USERS_PAGE_SIZE is 10", () => {
    expect(USERS_PAGE_SIZE).toBe(10);
  });

  it("USERS_SEARCH_MAX is 100", () => {
    expect(USERS_SEARCH_MAX).toBe(100);
  });
});

describe("parseUsersListParams — page", () => {
  it("defaults to 1 when searchParams is undefined", () => {
    expect(parseUsersListParams(undefined).page).toBe(1);
  });

  it("defaults to 1 for an empty object", () => {
    expect(parseUsersListParams({}).page).toBe(1);
  });

  it.each([
    ["0", 1],
    ["-3", 1],
    ["abc", 1],
    ["1.5", 1],
    ["2.5", 1],
    ["", 1],
    ["1e9", 1],
    ["٣", 1],
    ["1", 1],
    ["2", 2],
    ["7", 7],
  ])("page=%s -> %i", (raw, expected) => {
    expect(parseUsersListParams({ page: raw }).page).toBe(expected);
  });

  it("takes the first value when page is array-valued", () => {
    expect(parseUsersListParams({ page: ["2", "7"] }).page).toBe(2);
  });

  it("ignores extra keys such as rol, role, scope, viewerRol", () => {
    const result = parseUsersListParams({
      page: "2",
      q: "ana",
      rol: "administrador",
      role: "administrador",
      scope: "all",
      viewerRol: "administrador",
    } as never);
    expect(result).toEqual({
      page: 2,
      q: "ana",
      status: "all",
      sort: { key: "created", dir: "desc" },
      size: 10,
    });
  });
});

describe("parseUsersListParams — q", () => {
  it("defaults to an empty string", () => {
    expect(parseUsersListParams({}).q).toBe("");
  });

  it("takes the first value when q is array-valued", () => {
    expect(parseUsersListParams({ q: ["a", "b"] }).q).toBe("a");
  });

  it("trims and collapses internal whitespace", () => {
    expect(parseUsersListParams({ q: "  Ana  María  " }).q).toBe("Ana María");
  });

  it("caps an over-long term to USERS_SEARCH_MAX characters", () => {
    const long = "a".repeat(5000);
    const result = parseUsersListParams({ q: long }).q;
    expect(result).toHaveLength(USERS_SEARCH_MAX);
  });

  it("leaves wildcard characters untouched (escaping happens at the query layer)", () => {
    expect(parseUsersListParams({ q: "%" }).q).toBe("%");
  });
});

describe("usersListHref", () => {
  it("omits page when it is 1", () => {
    expect(usersListHref({ page: 1 })).toBe("/users");
  });

  it("omits q when it is empty", () => {
    expect(usersListHref({ q: "" })).toBe("/users");
  });

  it("returns the bare path when both are absent", () => {
    expect(usersListHref({})).toBe("/users");
  });

  it("includes page when greater than 1", () => {
    expect(usersListHref({ page: 2 })).toBe("/users?page=2");
  });

  it("percent-encodes q", () => {
    expect(usersListHref({ q: "ana maría" })).toContain("q=ana");
    expect(usersListHref({ q: "ana maría" })).not.toContain(" ");
  });

  it("round-trips through parseUsersListParams", () => {
    const href = usersListHref({ page: 3, q: "ana maría" });
    const [, qs] = href.split("?");
    const sp = Object.fromEntries(new URLSearchParams(qs));
    expect(parseUsersListParams(sp)).toMatchObject({ page: 3, q: "ana maría" });
  });
});

describe("users list constants", () => {
  it("lists exactly the five sortable columns and the default pair", () => {
    expect([...USERS_SORT_KEYS]).toEqual([
      "name",
      "login",
      "role",
      "status",
      "created",
    ]);
    expect(USERS_DEFAULT_SORT).toEqual({ key: "created", dir: "desc" });
  });

  it("USERS_PAGE_SIZE equals the shared default page size", () => {
    expect(USERS_PAGE_SIZE).toBe(DEFAULT_PAGE_SIZE);
  });
});

describe("parseUsersListParams — defaults", () => {
  it.each([[undefined], [{}]])("%j gives the full default state", (sp) => {
    expect(parseUsersListParams(sp)).toEqual({
      page: 1,
      q: "",
      status: "all",
      sort: { key: "created", dir: "desc" },
      size: 10,
    });
  });
});

describe("parseUsersListParams — status (UL:status)", () => {
  it.each([
    ["all", "all"],
    ["active", "active"],
    ["inactive", "inactive"],
  ])("status=%s -> %s", (raw, expected) => {
    expect(parseUsersListParams({ status: raw }).status).toBe(expected);
  });

  it.each([["bogus"], ["ACTIVE"], [""], ["active,inactive"], ["__proto__"]])(
    "status=%j falls back to all",
    (raw) => {
      expect(parseUsersListParams({ status: raw }).status).toBe("all");
    },
  );

  it("a repeated status falls back to all", () => {
    expect(
      parseUsersListParams({ status: ["inactive", "active"] }).status,
    ).toBe("all");
  });
});

describe("parseUsersListParams — sort and dir (UL:sort)", () => {
  it.each([
    [{}, { key: "created", dir: "desc" }],
    [{ sort: "name" }, { key: "name", dir: "asc" }],
    [
      { sort: "name", dir: "desc" },
      { key: "name", dir: "desc" },
    ],
    [
      { sort: "login", dir: "asc" },
      { key: "login", dir: "asc" },
    ],
    [{ sort: "role" }, { key: "role", dir: "asc" }],
    [{ sort: "status" }, { key: "status", dir: "asc" }],
    [
      { sort: "status", dir: "desc" },
      { key: "status", dir: "desc" },
    ],
    [{ sort: "created" }, { key: "created", dir: "asc" }],
    [
      { sort: "created", dir: "desc" },
      { key: "created", dir: "desc" },
    ],
    [
      { sort: "created", dir: "asc" },
      { key: "created", dir: "asc" },
    ],
  ])("%j -> %j", (sp, expected) => {
    expect(parseUsersListParams(sp).sort).toEqual(expected);
  });

  it.each([
    [{ sort: "password" }, { key: "created", dir: "desc" }],
    [{ sort: "Name" }, { key: "created", dir: "desc" }],
    [
      { sort: "name", dir: "sideways" },
      { key: "name", dir: "asc" },
    ],
    [{ sort: ["name", "login"] }, { key: "created", dir: "desc" }],
    [
      { sort: "name", dir: ["desc", "asc"] },
      { key: "name", dir: "asc" },
    ],
    [
      { sort: "hashClave", dir: "desc" },
      { key: "created", dir: "desc" },
    ],
    [
      { sort: "__proto__", dir: "asc" },
      { key: "created", dir: "desc" },
    ],
    [
      { sort: "hours", dir: "asc" },
      { key: "created", dir: "desc" },
    ],
    [{ sort: '\'; DROP TABLE "Usuario"; --' }, { key: "created", dir: "desc" }],
    [{ sort: "a".repeat(500) }, { key: "created", dir: "desc" }],
    [{ dir: "asc" }, { key: "created", dir: "desc" }],
  ])("hostile or partial %j -> %j", (sp, expected) => {
    expect(parseUsersListParams(sp).sort).toEqual(expected);
  });
});

describe("parseUsersListParams — size (DT-URL-1)", () => {
  it.each([
    ["10", 10],
    ["25", 25],
    ["50", 50],
    ["5", 10],
    ["100", 10],
    ["1000", 10],
    ["0", 10],
    ["-5", 10],
    ["10.5", 10],
    ["010", 10],
    ["abc", 10],
    ["", 10],
    ["1e1", 10],
  ])("size=%j -> %i", (raw, expected) => {
    expect(parseUsersListParams({ size: raw }).size).toBe(expected);
  });

  it("a repeated size falls back to 10", () => {
    expect(parseUsersListParams({ size: ["25", "50"] }).size).toBe(10);
  });
});

describe("usersListHref — canonical order and omitted defaults (DT-URL-1)", () => {
  it.each([
    [{}, "/users"],
    [{ q: "", status: "all", size: 10, page: 1 }, "/users"],
    [{ sort: { key: "created", dir: "desc" } }, "/users"],
    [{ q: "ana", page: 2 }, "/users?q=ana&page=2"],
    [
      { sort: { key: "name", dir: "asc" }, size: 25 },
      "/users?sort=name&dir=asc&size=25",
    ],
    [{ sort: { key: "created", dir: "asc" } }, "/users?sort=created&dir=asc"],
    [{ status: "inactive" }, "/users?status=inactive"],
    [
      {
        page: 4,
        size: 50,
        sort: { key: "role", dir: "desc" },
        status: "active",
        q: "ana",
      },
      "/users?q=ana&status=active&sort=role&dir=desc&size=50&page=4",
    ],
  ] as const)("%j -> %s", (state, expected) => {
    expect(usersListHref(state as never)).toBe(expected);
  });

  it("writes sort and dir together or not at all", () => {
    for (const sort of [
      { key: "created", dir: "desc" },
      { key: "created", dir: "asc" },
      { key: "login", dir: "desc" },
    ] as const) {
      const qs = new URLSearchParams(usersListHref({ sort }).split("?")[1]);
      expect(qs.has("sort")).toBe(qs.has("dir"));
    }
  });

  it("round-trips every non-default field through parseUsersListParams", () => {
    const state = {
      page: 3,
      q: "ana maría & co",
      status: "inactive",
      sort: { key: "login", dir: "desc" },
      size: 25,
    } as const;
    const [, qs] = usersListHref(state).split("?");
    const sp = Object.fromEntries(new URLSearchParams(qs));
    expect(parseUsersListParams(sp)).toEqual(state);
  });
});
