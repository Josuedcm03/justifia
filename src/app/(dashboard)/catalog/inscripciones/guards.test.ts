import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Structural pins over the inscripciones pages (EA-ACC-1, CS-10; design Threat
// Matrix: authorisation order, mutation by GET, audited read by prefetch).
// Source-text checks: they prove the shape of a page, not its behaviour. They
// repeat the checks of `catalog/guards.test.ts` for `requireEnrollmentAccess(`
// because that file lists its segments explicitly and asserts the catalog guard.

const ROOT = process.cwd();
const SEGMENT_DIR = join(ROOT, "src/app/(dashboard)/catalog/inscripciones");

function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

const pages = filesUnder(SEGMENT_DIR)
  .filter((path) => path.endsWith("page.tsx"))
  .map((path) => ({
    path: relative(ROOT, path).replace(/\\/g, "/"),
    text: readFileSync(path, "utf8"),
  }));

/** The opening tag of every `<Link>` and `<TablePagination>` in a source text
 *  (an arrow `=>` inside an attribute does not end the tag). */
function prefetchingTags(source: string): string[] {
  return [...source.matchAll(/<(?:Link|TablePagination)\b(?:=>|[^>])*>/g)].map(
    (match) => match[0],
  );
}

const optsOut = (tag: string) => tag.includes("prefetch={false}");

describe("inscripciones pages (structure)", () => {
  // A misplaced or extra page must fail here instead of shrinking the
  // coverage below. The assign page of S3 extends this list when it lands.
  it("discovers exactly the expected pages", () => {
    expect(pages.map((p) => p.path)).toEqual([
      "src/app/(dashboard)/catalog/inscripciones/page.tsx",
    ]);
  });

  it.each(pages.map((p) => [p.path, p] as const))(
    "%s calls requireEnrollmentAccess( before any other await",
    (_path, page) => {
      const guard = page.text.indexOf("requireEnrollmentAccess(");
      expect(guard).toBeGreaterThanOrEqual(0);

      const firstAwait = page.text.indexOf("await ");
      expect(firstAwait).toBeGreaterThanOrEqual(0);
      expect(page.text.slice(firstAwait)).toMatch(
        /^await requireEnrollmentAccess\(/,
      );
      expect(page.text).not.toContain("requireCatalogAccess(");

      for (const request of ["await searchParams", "await params"]) {
        const at = page.text.indexOf(request);
        if (at >= 0) expect(guard).toBeLessThan(at);
      }
    },
  );

  it.each(pages.map((p) => [p.path, p] as const))(
    "%s never reaches a server action itself",
    (_path, page) => {
      expect(page.text).not.toMatch(/from\s+["'][^"']*\/actions["']/);
      expect(page.text).not.toMatch(/["']use server["']/);
    },
  );

  it.each(pages.map((p) => [p.path, p] as const))(
    "%s renders no mutating control (GET never mutates)",
    (_path, page) => {
      expect(page.text).not.toMatch(/<form[\s>]/);
      expect(page.text).not.toMatch(/<button[\s>]/i);
      expect(page.text).not.toMatch(/\baction=|onClick|onSubmit|formAction/);
      expect(page.text).not.toContain("ActiveToggle");
    },
  );
});

// The page writes one audit row per render (D10), so nothing may prefetch it.
// Without a nearer `loading.tsx` this holds only because the dashboard
// boundary stops a default prefetch above the page (Next `create-component-tree`,
// no PPR); an explicit opt-out on every link does not depend on that.
describe("inscripciones links never prefetch the audited page (D10)", () => {
  const sources = filesUnder(SEGMENT_DIR)
    .filter((path) => /\.tsx$/.test(path) && !/\.test\.tsx$/.test(path))
    .map((path) => ({
      path: relative(ROOT, path).replace(/\\/g, "/"),
      text: readFileSync(path, "utf8"),
    }));

  it.each([
    ['<Link href="/x" prefetch={false}>a</Link>', true],
    ["<Link href={x}>a</Link>", false],
    [
      "<TablePagination page={1} hrefFor={(p) => h(p)} prefetch={false} />",
      true,
    ],
    ["<TablePagination page={1} hrefFor={(p) => h(p)} />", false],
  ])("the tag check reads %s as opted out = %s", (tag, expected) => {
    const found = prefetchingTags(tag);

    expect(found).toHaveLength(1);
    expect(optsOut(found[0])).toBe(expected);
  });

  it("finds the pagination of the table, so the check below is not vacuous", () => {
    const table = sources.find((s) =>
      s.path.endsWith("inscripciones-table.tsx"),
    );

    expect(table).toBeDefined();
    expect(
      prefetchingTags(table!.text).map((tag) => tag.slice(0, 16)),
    ).toContain("<TablePagination");
  });

  it("every Link and TablePagination under inscripciones/ has prefetch={false}", () => {
    const offenders = sources.flatMap((s) =>
      prefetchingTags(s.text)
        .filter((tag) => !optsOut(tag))
        .map((tag) => `${s.path}: ${tag.slice(0, 40)}`),
    );

    expect(offenders).toEqual([]);
  });
});
