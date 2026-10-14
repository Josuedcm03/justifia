import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Structural pins for the exactly-once audited read (SR-11, SR-11 amendment
// "Main Sync 2026-10-12", task 4.9). Source-text checks: they prove WHERE the
// audit write lives and how the links are written, not how they behave (the
// page tests do that). A speculative render of a review page would write a
// false audit row, so the guards are independent and each one is pinned:
//   1. the audit write is only in the review page.tsx bodies;
//   2. every link to /review opts out of prefetch;
//   3. nothing revalidates or refreshes a review page;
//   4. the Next.js settings that would prefetch page bodies stay off.

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const REVIEW_DIR = join(SRC, "app/(dashboard)/review");

function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

const isSource = (path: string) =>
  /\.(ts|tsx)$/.test(path) && !/\.test\.(ts|tsx)$/.test(path);

const sources = filesUnder(SRC)
  .filter(isSource)
  .map((path) => ({
    path: relative(ROOT, path).replace(/\\/g, "/"),
    text: readFileSync(path, "utf8"),
  }));

const REVIEW_PAGE = "src/app/(dashboard)/review/page.tsx";
const DETAIL_PAGE = "src/app/(dashboard)/review/[id]/page.tsx";
const READS_MODULE = "src/lib/data/request-reads.ts";

/** Files whose text calls (or imports) the audited read helper. */
function usersOf(name: string): string[] {
  return sources
    .filter((s) => new RegExp(`\\b${name}\\b`).test(s.text))
    .map((s) => s.path)
    .sort();
}

/** The opening tag of every `<Link ...>` in a source text. */
function linkTags(text: string): string[] {
  const tags: string[] = [];
  for (
    let at = text.indexOf("<Link");
    at !== -1;
    at = text.indexOf("<Link", at + 1)
  ) {
    let depth = 0;
    let end = at;
    for (; end < text.length; end++) {
      const char = text[end];
      if (char === "{") depth++;
      else if (char === "}") depth--;
      else if (char === ">" && depth === 0 && text[end - 1] !== "=") break;
    }
    tags.push(text.slice(at, end + 1));
  }
  return tags;
}

describe("review structure: the audit write lives in the page bodies (SR-11, guard 1)", () => {
  it("finds the review pages and the read module", () => {
    const paths = sources.map((s) => s.path);
    expect(paths).toContain(REVIEW_PAGE);
    expect(paths).toContain(DETAIL_PAGE);
    expect(paths).toContain(READS_MODULE);
  });

  it("calls recordRequestRead only from the detail page", () => {
    expect(usersOf("recordRequestRead")).toEqual(
      [READS_MODULE, DETAIL_PAGE].sort(),
    );
  });

  it("calls recordQueueRead only from the queue page", () => {
    expect(usersOf("recordQueueRead")).toEqual(
      [READS_MODULE, REVIEW_PAGE].sort(),
    );
  });

  it("never writes a read from a layout or a loading file", () => {
    const offenders = sources.filter(
      (s) =>
        /(^|\/)(layout|loading|template|default)\.tsx$/.test(s.path) &&
        /\brecord(Request|Queue)Read\b/.test(s.text),
    );

    expect(offenders.map((s) => s.path)).toEqual([]);
  });

  it("calls each helper exactly once in its page, after the data load", () => {
    for (const [path, helper, load] of [
      [REVIEW_PAGE, "recordQueueRead", "listReviewQueue("],
      [DETAIL_PAGE, "recordRequestRead", "getRequestDetail("],
    ] as const) {
      const text = sources.find((s) => s.path === path)?.text ?? "";
      const calls = text.match(new RegExp(`\\b${helper}\\(`, "g")) ?? [];

      expect(calls, path).toHaveLength(1);
      expect(text.indexOf(`${helper}(`), path).toBeGreaterThan(
        text.indexOf(load),
      );
    }
  });

  it("keeps the pages free of client-side audit triggers", () => {
    for (const path of [REVIEW_PAGE, DETAIL_PAGE]) {
      const text = sources.find((s) => s.path === path)?.text ?? "";
      expect(text, path).not.toMatch(/["']use client["']/);
      expect(text, path).not.toMatch(/useEffect/);
    }
  });
});

describe("review structure: links opt out of prefetch (SR-11, guard 2)", () => {
  // A page may name the route through `const BASE = "/review"`.
  const reviewLinks = sources.flatMap((s) => {
    const namesBase = /const BASE = "\/review"/.test(s.text);
    return linkTags(s.text)
      .filter(
        (tag) =>
          /["'`{]\/review/.test(tag) || (namesBase && /\$\{BASE\}/.test(tag)),
      )
      .map((tag) => ({ path: s.path, tag }));
  });

  it("finds the Link elements that point at /review", () => {
    expect(reviewLinks.length).toBeGreaterThanOrEqual(4);
    expect(new Set(reviewLinks.map((l) => l.path))).toContain(REVIEW_PAGE);
    expect(new Set(reviewLinks.map((l) => l.path))).toContain(DETAIL_PAGE);
  });

  it.each(reviewLinks.map((l) => [l.path, l.tag] as const))(
    "%s: every <Link> to a review page has prefetch={false}",
    (_path, tag) => {
      expect(tag).toContain("prefetch={false}");
    },
  );

  it("opts the sidebar entry out as well", () => {
    // The entry lives in the shared navigation config (single source for the
    // sidebar, the home shortcuts and the trail); the sidebar and the home
    // read the flag from it.
    const textOf = (path: string) =>
      sources.find((s) => s.path === path)?.text ?? "";
    const config = textOf("src/lib/navigation.ts");
    const entry = config.match(/\{[^{}]*href:\s*"\/review"[^{}]*\}/)?.[0];

    expect(entry).toBeDefined();
    expect(entry).toContain("prefetch: false");
    expect(textOf("src/components/app-sidebar.tsx")).toContain(
      "prefetch={prefetchOf(item)}",
    );
    expect(textOf("src/app/(dashboard)/(home)/page.tsx")).toContain(
      "prefetch=",
    );
  });

  it("never links to a review page with a plain prefetching <Link> elsewhere", () => {
    const everyLink = sources.flatMap((s) =>
      linkTags(s.text).map((tag) => ({ path: s.path, tag })),
    );
    const prefetching = everyLink.filter(
      ({ tag }) =>
        /["'`]\/review/.test(tag) && !tag.includes("prefetch={false}"),
    );

    expect(prefetching).toEqual([]);
  });
});

describe("review structure: nothing re-renders a review page (SR-11, guard 4)", () => {
  const reviewSources = filesUnder(REVIEW_DIR)
    .filter(isSource)
    .map((path) => ({
      path: relative(ROOT, path).replace(/\\/g, "/"),
      text: readFileSync(path, "utf8"),
    }));

  it("scans the review modules", () => {
    expect(reviewSources.length).toBeGreaterThan(5);
  });

  it("never revalidates a path or tag, and never refreshes the router", () => {
    const offenders = reviewSources.filter((s) =>
      /revalidatePath|revalidateTag|updateTag|router\.refresh|refresh\(\)/.test(
        s.text,
      ),
    );

    expect(offenders.map((s) => s.path)).toEqual([]);
  });

  it("keeps the decision action ending in a redirect", () => {
    const actions =
      reviewSources.find((s) => s.path.endsWith("[id]/actions.ts"))?.text ?? "";

    expect(actions).toMatch(/redirect\(`\$\{QUEUE_PATH\}\?resultado=/);
  });
});

describe("review structure: page bodies are not prefetched (SR-11 amendment)", () => {
  const config = readFileSync(join(ROOT, "next.config.ts"), "utf8");

  it("keeps cacheComponents and partial prefetching off", () => {
    expect(config).not.toMatch(/cacheComponents\s*:\s*true/);
    expect(config).not.toMatch(/partialPrefetching\s*:\s*true/);
  });
});

describe("review structure: the queue table is a client module of the kit (RF-06)", () => {
  const reviewSources = filesUnder(REVIEW_DIR)
    .filter(isSource)
    .map((path) => ({
      path: relative(ROOT, path).replace(/\\/g, "/"),
      text: readFileSync(path, "utf8"),
    }));
  const TABLE = "src/app/(dashboard)/review/review-queue-table.tsx";

  it("imports no legacy table component from the review folder", () => {
    const offenders = reviewSources.filter((s) =>
      /from\s+["']@\/components\/data-table["']/.test(s.text),
    );

    expect(offenders.map((s) => s.path)).toEqual([]);
  });

  it("builds the columns in a client module, never in the server page", () => {
    const table = reviewSources.find((s) => s.path === TABLE)?.text ?? "";
    const page = reviewSources.find((s) => s.path === REVIEW_PAGE)?.text ?? "";

    expect(table).toMatch(/^"use client";/);
    expect(table).toContain("@/components/tables/data-table");
    expect(page).not.toContain("DataTableColumn");
    expect(page).not.toMatch(/<DataTable/);
    expect(page).toContain("<ReviewQueueTable");
  });

  it("renders the table in bounded mode: no sorting, paging or toolbar", () => {
    const table = reviewSources.find((s) => s.path === TABLE)?.text ?? "";

    expect(table).not.toMatch(
      /sorting=|enableSorting|ListTable|TableToolbar|TablePagination/,
    );
  });
});
