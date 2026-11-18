// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  APP_ROOT,
  PUBLIC_ENTRY_POINTS,
  listAppEntries,
} from "@/test/access/inventory";

// Source-text ratchet (RAC-1..RAC-3, RNF-01 c): a new entry point cannot land
// without a test, and a new dashboard page cannot land without a guard.

const ENTRIES = listAppEntries();

// `requireCatalogAccess` is the catalog pages' named helper: it calls
// `requireRole` before it reads anything.
const GUARDS = [
  "requireUser",
  "requireUserAllowingPasswordChange",
  "requireRole",
  "requireCatalogAccess",
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
