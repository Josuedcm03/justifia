import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Structural pins of the coordinator surface (RNF-01, ES-9, SR-11). Source-text
// checks, in the pattern of `review/structure.test.ts`: they prove WHERE the
// guards live, not how they behave (the page and action tests do that).
//   1. every page and action guards the role and resolves the career scope;
//   2. the coordinator surface imports no secretary data module;
//   3. the audited reads live in the page bodies, once, after the data load;
//   4. every link to a coordinator page opts out of prefetch;
//   5. nothing revalidates or refreshes a coordinator page.

const ROOT = process.cwd();
const COORDINATION_DIR = join(ROOT, "src/app/(dashboard)/coordination");

function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

const isSource = (path: string) =>
  /\.(ts|tsx)$/.test(path) && !/\.test\.(ts|tsx)$/.test(path);

const sources = filesUnder(COORDINATION_DIR)
  .filter(isSource)
  .map((path) => ({
    path: relative(ROOT, path).replace(/\\/g, "/"),
    text: readFileSync(path, "utf8"),
  }));

const LIST_PAGE = "src/app/(dashboard)/coordination/page.tsx";
const DETAIL_PAGE = "src/app/(dashboard)/coordination/[id]/page.tsx";
const ACTIONS = "src/app/(dashboard)/coordination/[id]/actions.ts";
const GUARDED = [LIST_PAGE, DETAIL_PAGE, ACTIONS];

const textOf = (path: string) =>
  sources.find((s) => s.path === path)?.text ?? "";

/** Data modules the coordinator surface may import: its own, nothing of staff. */
const ALLOWED_DATA = [
  "@/lib/data/coordination-queue",
  "@/lib/data/coordination-scope",
  "@/lib/data/escalation-answer",
  "@/lib/data/request-reads",
];

function importsOf(text: string): string[] {
  return [...text.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
}

describe("coordination structure: every page and action guards the role and the career (RNF-01)", () => {
  it("finds the coordinator pages and action", () => {
    const paths = sources.map((s) => s.path);
    for (const path of GUARDED) expect(paths).toContain(path);
  });

  it.each(GUARDED)(
    "%s requires the coordinating role, then resolves the career scope",
    (path) => {
      const text = textOf(path);

      expect(text).toMatch(/requireRole\(\s*\.\.\.rolesCoordinadores\s*\)/);
      expect(text).toContain("resolveCoordinationScope(");
      expect(text.indexOf("requireRole(")).toBeLessThan(
        text.indexOf("resolveCoordinationScope("),
      );
    },
  );

  it("never guards a coordinator surface with the secretary roles", () => {
    for (const { path, text } of sources) {
      expect(text, path).not.toContain("rolesRevisores");
      expect(text, path).not.toContain("resolveRequestScope");
    }
  });
});

describe("coordination structure: no secretary data module (RNF-01)", () => {
  it("imports from @/lib/data only the coordinator modules", () => {
    const offenders = sources.flatMap((s) =>
      importsOf(s.text)
        .filter((from) => from.startsWith("@/lib/data/"))
        .filter((from) => !ALLOWED_DATA.includes(from))
        .map((from) => `${s.path}: ${from}`),
    );

    expect(offenders).toEqual([]);
  });

  it("scans the coordinator modules, so the pin is not vacuous", () => {
    expect(sources.length).toBeGreaterThanOrEqual(6);
    const imported = new Set(
      sources
        .flatMap((s) => importsOf(s.text))
        .filter((f) => f.startsWith("@/lib/data/")),
    );
    for (const dataModule of ALLOWED_DATA) {
      expect(imported).toContain(dataModule);
    }
  });

  it("never reaches the facultad request scope", () => {
    for (const { path, text } of sources) {
      expect(importsOf(text), path).not.toContain("@/lib/intake/request-scope");
    }
  });
});

describe("coordination structure: the audit write lives in the page bodies (SR-11)", () => {
  it("writes the list read only from the list page, once, after the data load", () => {
    const calls = sources.filter((s) =>
      /\brecordEscalationQueueRead\(/.test(s.text),
    );
    expect(calls.map((s) => s.path)).toEqual([LIST_PAGE]);

    const text = textOf(LIST_PAGE);
    expect(text.match(/\brecordEscalationQueueRead\(/g)).toHaveLength(1);
    expect(text.indexOf("recordEscalationQueueRead(")).toBeGreaterThan(
      text.indexOf("listCoordinationEscalations("),
    );
  });

  it("writes the detail read only from the detail page, once, after the data load", () => {
    const calls = sources.filter((s) => /\brecordRequestRead\(/.test(s.text));
    expect(calls.map((s) => s.path)).toEqual([DETAIL_PAGE]);

    const text = textOf(DETAIL_PAGE);
    expect(text.match(/\brecordRequestRead\(/g)).toHaveLength(1);
    expect(text.indexOf("recordRequestRead(")).toBeGreaterThan(
      text.indexOf("getCoordinationDetail("),
    );
  });

  it("keeps the pages free of client-side audit triggers", () => {
    for (const path of [LIST_PAGE, DETAIL_PAGE]) {
      const text = textOf(path);
      expect(text, path).not.toMatch(/["']use client["']/);
      expect(text, path).not.toMatch(/useEffect/);
    }
  });

  it("never writes a read from a layout or a loading file", () => {
    const offenders = sources.filter(
      (s) =>
        /(^|\/)(layout|loading|template|default)\.tsx$/.test(s.path) &&
        /\brecord\w*Read\b/.test(s.text),
    );

    expect(offenders.map((s) => s.path)).toEqual([]);
  });
});

describe("coordination structure: links and re-renders (SR-11)", () => {
  it("opts every <Link> of the coordinator pages out of prefetch", () => {
    const tags = sources.flatMap((s) =>
      [...s.text.matchAll(/<Link[\s\S]*?>/g)].map((m) => ({
        path: s.path,
        tag: m[0],
      })),
    );

    expect(tags.length).toBeGreaterThan(0);
    for (const { path, tag } of tags) {
      expect(tag, path).toContain("prefetch={false}");
    }
  });

  it("links the list rows through the shared review link, which never prefetches", () => {
    const parts = readFileSync(
      join(ROOT, "src/app/(dashboard)/review/queue-parts.tsx"),
      "utf8",
    );
    const link = parts.match(/<Link[\s\S]*?>/)?.[0] ?? "";

    expect(link).toContain("prefetch={false}");
    expect(
      textOf("src/app/(dashboard)/coordination/coordination-list.tsx"),
    ).toContain("<QueueReviewLink");
  });

  it("never revalidates a path or tag, and never refreshes the router", () => {
    const offenders = sources.filter((s) =>
      /revalidatePath|revalidateTag|updateTag|router\.refresh|refresh\(\)/.test(
        s.text,
      ),
    );

    expect(offenders.map((s) => s.path)).toEqual([]);
  });

  it("keeps the answer action ending in a redirect to the list", () => {
    expect(textOf(ACTIONS)).toMatch(/redirect\(`\$\{LIST_PATH\}\?resultado=/);
  });
});
