// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  APP_ROOT,
  PUBLIC_ENTRY_POINTS,
  listAppEntries,
} from "@/test/access/inventory";
import {
  ACTIONS,
  IDENTITIES,
  PAGES,
  ROUTES,
  denialsOf,
} from "@/test/access/matrix-table";

// Source-text ratchet (RAC-1..RAC-3, RNF-01 c): a new entry point cannot land
// without a test, a new dashboard page cannot land without a guard, and a new
// protected entry point cannot land outside the access matrix table (RAC-5).

const ENTRIES = listAppEntries();

// `requireCatalogAccess` and `requireEnrollmentAccess` are the named helpers of
// the catalog and inscripciones pages: each calls `requireRole` before it reads
// anything.
const GUARDS = [
  "requireUser",
  "requireUserAllowingPasswordChange",
  "requireRole",
  "requireCatalogAccess",
  "requireEnrollmentAccess",
];

/** Callee of the first `await` after the default export, or why there is none. */
function firstAwaitedCall(source: string): string {
  const start = source.search(/export\s+default\s+async\s+function/);
  if (start < 0) return "<no async default export>";
  const rest = source.slice(start);
  const index = rest.search(/\bawait\b/);
  if (index < 0) return "<no await>";
  const call = /^await\s+([A-Za-z_$][\w$]*)\s*\(/.exec(rest.slice(index));
  return call ? call[1] : "<not a call>";
}

function siblingTest(entry: string): string | undefined {
  const base = entry.replace(/\.tsx?$/, "");
  return [`${base}.test.ts`, `${base}.test.tsx`].find((candidate) =>
    existsSync(join(APP_ROOT, candidate)),
  );
}

describe("the entry point inventory", () => {
  it("finds pages, routes and server actions files", () => {
    expect(ENTRIES).toContain("(dashboard)/profile/page.tsx");
    expect(ENTRIES).toContain("api/cron/intake-sweep/route.ts");
    expect(ENTRIES).toContain("(dashboard)/review/[id]/escalation-actions.ts");
    expect(ENTRIES.every((entry) => !/\.test\.tsx?$/.test(entry))).toBe(true);
  });
});

describe("RAC-1 every entry point has a test", () => {
  it.each(ENTRIES)("%s has a sibling test", (entry) => {
    expect(siblingTest(entry), `no test next to ${entry}`).toBeDefined();
  });
});

describe("RAC-2 every dashboard page calls a guard first", () => {
  const pages = ENTRIES.filter(
    (entry) =>
      entry.startsWith("(dashboard)/") &&
      entry.endsWith("/page.tsx") &&
      !(entry in PUBLIC_ENTRY_POINTS),
  );

  it.each(pages)("%s awaits a guard before anything else", (page) => {
    const source = readFileSync(join(APP_ROOT, page), "utf8");

    expect(GUARDS).toContain(firstAwaitedCall(source));
  });

  it("reads the guard out of a guarded source and rejects the rest", () => {
    const guarded =
      "export default async function P() {\n await requireRole(1);";
    const late =
      "export default async function P() {\n await load();\n await requireRole(1);";

    expect(firstAwaitedCall(guarded)).toBe("requireRole");
    expect(firstAwaitedCall(late)).toBe("load");
    expect(firstAwaitedCall("export default function P() {}")).toBe(
      "<no async default export>",
    );
    expect(firstAwaitedCall("export default async function P() {}")).toBe(
      "<no await>",
    );
  });
});

describe("RAC-3 exemptions are justified and current", () => {
  it.each(Object.entries(PUBLIC_ENTRY_POINTS))(
    "%s exists and says why it is public",
    (entry, reason) => {
      expect(ENTRIES, `${entry} matches no file`).toContain(entry);
      expect(reason.trim(), `${entry} has no reason`).not.toBe("");
    },
  );
});

// Entry points counted as the matrix runs them: an actions file contributes one
// entry per exported function.
const TABLE_KEYS = [PAGES, ROUTES, ACTIONS].flatMap((rows) =>
  Object.keys(rows),
);
const N =
  Object.keys(PAGES).length +
  Object.keys(ROUTES).length +
  Object.values(ACTIONS).reduce((sum, row) => sum + row.exports.length, 0);

describe(`RAC-5 ${N} entry points x 7 identities`, () => {
  const protectedEntries = ENTRIES.filter(
    (entry) => !(entry in PUBLIC_ENTRY_POINTS),
  );

  it("the table lists every protected entry point and nothing else", () => {
    expect({
      missing: protectedEntries.filter((entry) => !TABLE_KEYS.includes(entry)),
      stale: TABLE_KEYS.filter((key) => !protectedEntries.includes(key)),
    }).toEqual({ missing: [], stale: [] });
  });

  it("keeps each row in its own group", () => {
    expect(Object.keys(PAGES).filter((k) => !k.endsWith("/page.tsx"))).toEqual(
      [],
    );
    expect(Object.keys(ROUTES).filter((k) => !k.endsWith("/route.ts"))).toEqual(
      [],
    );
    expect(
      Object.keys(ACTIONS).filter((k) => /\/(page\.tsx|route\.ts)$/.test(k)),
    ).toEqual([]);
    expect(new Set(TABLE_KEYS).size).toBe(TABLE_KEYS.length);
  });

  it("states the figure: entry points x identities, denials, admissions", () => {
    const rows = [
      ...Object.values(PAGES),
      ...Object.values(ROUTES),
      ...Object.values(ACTIONS).flatMap((row) => row.exports.map(() => row)),
    ];
    const cases = rows.length * IDENTITIES.length;
    const denied = rows.reduce((sum, row) => sum + denialsOf(row), 0);

    console.info(
      `access matrix total: ${N} entry points x ${IDENTITIES.length} identities = ${cases} cases, ${denied} denied, ${cases - denied} admitted`,
    );
    expect(rows).toHaveLength(N);
    expect(IDENTITIES).toHaveLength(7);
    expect(denied).toBeGreaterThan(0);
  });
});
