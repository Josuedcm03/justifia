import { describe, expect, it } from "vitest";

import {
  parseUsersListParams,
  USERS_PAGE_SIZE,
  USERS_SEARCH_MAX,
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
    expect(result).toEqual({ page: 2, q: "ana" });
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
    expect(parseUsersListParams(sp)).toEqual({ page: 3, q: "ana maría" });
  });
});
