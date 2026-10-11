import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

import { LEGACY_GRUPOS_REDIRECTS } from "@/lib/catalog/legacy-redirects";
import { parseRecordId } from "@/lib/validations/catalog";

// The retired `/catalog/grupos` and `/catalog/grupos/new` URLs (CM-RTE-1 rows
// 1 to 3, design UG-4).
// The table is plain data read by `next.config.ts`; these tests apply it the
// way Next does: a `has`/`missing` value is a regex anchored as `^value$`, and
// a rule applies when its source matches, every `has` item matches and no
// `missing` item matches.

const NEW_SOURCE = "/catalog/grupos/new";
const LIST_SOURCE = "/catalog/grupos";

type QueryItem = { type: string; key: string; value?: string };
type Rule = (typeof LEGACY_GRUPOS_REDIRECTS)[number];

/** Next anchors the value of a `has`/`missing` item as `^value$`. */
function itemMatches(item: QueryItem, query: string | undefined): boolean {
  if (query === undefined) return false;
  return item.value === undefined || new RegExp(`^${item.value}$`).test(query);
}

/** Whether Next would apply `rule` to `/catalog/grupos/new?asignaturaId=...`. */
function applies(rule: Rule, query: string | undefined): boolean {
  if (rule.source !== NEW_SOURCE) return false;
  const has = (rule.has ?? []) as QueryItem[];
  const missing = (rule.missing ?? []) as QueryItem[];
  return (
    has.every((item) => itemMatches(item, query)) &&
    !missing.some((item) => itemMatches(item, query))
  );
}

const listRule = LEGACY_GRUPOS_REDIRECTS.find((r) => r.source === LIST_SOURCE)!;
const hasRule = LEGACY_GRUPOS_REDIRECTS.find((r) => r.has !== undefined)!;
const missingRule = LEGACY_GRUPOS_REDIRECTS.find(
  (r) => r.missing !== undefined,
)!;

// Values the destination page would accept or reject; the redirect must agree
// with `parseRecordId` on every one of them.
const IDS = [
  "1",
  "12",
  "007",
  "0",
  "-1",
  "1.5",
  "12abc",
  "abc",
  "",
  " 12",
  "12 ",
  "999999999999999",
  "1000000000000000",
  "٣",
];

describe("LEGACY_GRUPOS_REDIRECTS (the three config rules)", () => {
  it("holds exactly three rules, all temporary (U4: never 308 or 301)", () => {
    expect(LEGACY_GRUPOS_REDIRECTS).toHaveLength(3);
    for (const rule of LEGACY_GRUPOS_REDIRECTS) {
      expect(rule.permanent).toBe(false);
      expect(rule).not.toHaveProperty("statusCode");
    }
  });

  it("keeps the two new-group rules on /catalog/grupos/new and the list rule on /catalog/grupos", () => {
    expect(LEGACY_GRUPOS_REDIRECTS.map((rule) => rule.source).sort()).toEqual([
      LIST_SOURCE,
      NEW_SOURCE,
      NEW_SOURCE,
    ]);
  });

  it("sends a valid asignaturaId to the new-group route of that Asignatura", () => {
    expect(hasRule.destination).toBe(
      "/catalog/asignaturas/:asignaturaId/grupos/new",
    );
    expect(hasRule.has).toHaveLength(1);
    expect(hasRule.has![0]).toMatchObject({
      type: "query",
      key: "asignaturaId",
    });
  });

  it("captures the id by name so the destination can use it", () => {
    const value = (hasRule.has![0] as QueryItem).value!;
    expect(new RegExp(`^${value}$`).exec("12")?.groups).toEqual({
      asignaturaId: "12",
    });
  });

  it("sends an absent or unusable asignaturaId to the Asignaturas list (U12)", () => {
    expect(missingRule.destination).toBe("/catalog/asignaturas");
    expect(missingRule.missing).toHaveLength(1);
    expect(missingRule.missing![0]).toMatchObject({
      type: "query",
      key: "asignaturaId",
    });
  });

  it.each(IDS)(
    "the `has` value anchored as ^value$ agrees with parseRecordId on %j",
    (id) => {
      expect(applies(hasRule, id)).toBe(parseRecordId(id) !== null);
    },
  );

  it("accepts the ids the destination accepts and rejects `abc`, `12abc`, `0`, `007` and the empty string", () => {
    expect(applies(hasRule, "12")).toBe(true);
    expect(applies(hasRule, "999999999999999")).toBe(true);
    for (const rejected of ["abc", "12abc", "0", "007", ""]) {
      expect(applies(hasRule, rejected), rejected).toBe(false);
    }
  });

  it.each([...IDS, undefined])(
    "exactly one rule applies to asignaturaId=%j (the two are complements, so order is irrelevant)",
    (id) => {
      const applied = LEGACY_GRUPOS_REDIRECTS.filter((r) => applies(r, id));
      expect(applied).toHaveLength(1);
      expect(applied[0]).toBe(
        id !== undefined && parseRecordId(id) !== null ? hasRule : missingRule,
      );
    },
  );

  it("treats an absent query like an empty one: the list rule applies", () => {
    expect(applies(missingRule, undefined)).toBe(true);
    expect(applies(missingRule, "")).toBe(true);
    expect(applies(hasRule, undefined)).toBe(false);
  });
});

// Next compiles a redirect `source` with its bundled path-to-regexp; use the
// same matcher to see which paths a source captures.
const nodeRequire = createRequire(import.meta.url);
const { pathToRegexp } = nodeRequire("next/dist/compiled/path-to-regexp") as {
  pathToRegexp: (source: string) => RegExp;
};

describe("the /catalog/grupos rule (CM-RTE-1 row 1, design UG-4)", () => {
  it("sends the old list to the Asignaturas list at its defaults, so the old status and page cannot filter or page Asignaturas", () => {
    expect(listRule).toEqual({
      source: "/catalog/grupos",
      destination: "/catalog/asignaturas?status=active&page=1",
      permanent: false,
    });
  });

  it("carries no has or missing condition (it applies to every query)", () => {
    expect(listRule).not.toHaveProperty("has");
    expect(listRule).not.toHaveProperty("missing");
  });

  it("matches the bare list path only", () => {
    const matcher = pathToRegexp(listRule.source);

    expect(matcher.test("/catalog/grupos")).toBe(true);
  });

  it.each([
    "/catalog/grupos/new",
    "/catalog/grupos/5/edit",
    "/catalog/grupos/12",
    "/catalog/grupos/12/other",
    "/catalog/gruposx",
    "/catalog/asignaturas/12/grupos/new",
  ])("does not capture %s (its own rule or page answers it)", (path) => {
    expect(pathToRegexp(listRule.source).test(path)).toBe(false);
  });

  it("is declared without any pattern character, so it cannot grow into a wildcard", () => {
    expect(listRule.source).toMatch(/^[a-z/]+$/);
  });

  it("leaves the new-group rules to their own source", () => {
    for (const rule of [hasRule, missingRule]) {
      expect(pathToRegexp(rule.source).test("/catalog/grupos")).toBe(false);
    }
  });
});
