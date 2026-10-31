import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Structural pins for the exactly-once audited dashboard read (CR-AUDIT-1,
// CR-9, finding N2). Source-text checks: they prove WHERE the audit write lives
// and how the links are written, not how they behave (the page tests do that).
// A speculative render of /reports would write a false audit row, so the guards
// are independent and each one is pinned:
//   1. the report audit writers are only in the report page.tsx bodies;
//   2. every link under reports/ and every link to /reports opts out of prefetch;
//   3. no loading, layout, template or default file sits under reports/;
//   4. nothing revalidates or refreshes a report page.
// Slices 2 and 3 extend the allow-lists with the detail page and the route.

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const REPORTS_DIR = join(SRC, "app/(dashboard)/reports");

function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

const isSource = (path: string) =>
  /\.(ts|tsx)$/.test(path) && !/\.test\.(ts|tsx)$/.test(path);

function read(path: string) {
  return {
    path: relative(ROOT, path).replace(/\\/g, "/"),
    text: readFileSync(path, "utf8"),
  };
}

const sources = filesUnder(SRC).filter(isSource).map(read);
const reportSources = filesUnder(REPORTS_DIR).filter(isSource).map(read);
const reportFiles = filesUnder(REPORTS_DIR).map((path) =>
  relative(ROOT, path).replace(/\\/g, "/"),
);

const DASHBOARD_PAGE = "src/app/(dashboard)/reports/page.tsx";
const READS_MODULE = "src/lib/data/report-reads.ts";

/** Every audit writer of the reports; later slices add their page or route. */
const WRITERS = [
  "recordReportDashboardRead",
  "recordReportRequestsRead",
  "recordReportDownload",
] as const;

/** Files whose text calls (or imports) a writer. */
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

describe("reports structure: the file scan itself", () => {
  it("finds the dashboard page, its cards and the reads module", () => {
    const paths = sources.map((s) => s.path);

    expect(paths).toContain(DASHBOARD_PAGE);
    expect(paths).toContain(READS_MODULE);
    expect(reportSources.length).toBeGreaterThanOrEqual(3);
  });

  it("reads a whole <Link> tag, including an arrow function in a prop", () => {
    const sample = [
      '<Link href="/reports" prefetch={false} className="a">x</Link>',
      "<Link href={`/reports?p=${a > b}`} onClick={() => go()}>y</Link>",
    ].join("\n");

    expect(linkTags(sample)).toEqual([
      '<Link href="/reports" prefetch={false} className="a">',
      "<Link href={`/reports?p=${a > b}`} onClick={() => go()}>",
    ]);
  });
});

describe("reports structure: the audit write lives in the page bodies (CR-AUDIT-1, guard 1)", () => {
  it("calls recordReportDashboardRead only from the dashboard page", () => {
    expect(usersOf("recordReportDashboardRead")).toEqual(
      [READS_MODULE, DASHBOARD_PAGE].sort(),
    );
  });

  it("calls no other report writer yet: later slices add their own", () => {
    for (const writer of WRITERS.filter(
      (name) => name !== "recordReportDashboardRead",
    )) {
      expect(
        usersOf(writer).filter((path) => path !== READS_MODULE),
        writer,
      ).toEqual([]);
    }
  });

  it("never writes a report read from a layout or a loading file", () => {
    const offenders = sources.filter(
      (s) =>
        /(^|\/)(layout|loading|template|default)\.tsx$/.test(s.path) &&
        new RegExp(`\\b(${WRITERS.join("|")})\\b`).test(s.text),
    );

    expect(offenders.map((s) => s.path)).toEqual([]);
  });

  it("calls the writer exactly once in the page, after the guard and the data load", () => {
    const text = sources.find((s) => s.path === DASHBOARD_PAGE)?.text ?? "";
    const calls = text.match(/\brecordReportDashboardRead\(/g) ?? [];

    expect(calls).toHaveLength(1);
    expect(text.indexOf("recordReportDashboardRead(")).toBeGreaterThan(
      text.indexOf("loadReportDashboard("),
    );
    expect(text.indexOf("loadReportDashboard(")).toBeGreaterThan(
      text.indexOf("requireRole("),
    );
  });

  it("keeps the page free of client-side audit triggers", () => {
    const text = sources.find((s) => s.path === DASHBOARD_PAGE)?.text ?? "";

    expect(text).not.toMatch(/["']use client["']/);
    expect(text).not.toMatch(/useEffect/);
  });
});

describe("reports structure: links opt out of prefetch (CR-AUDIT-1, N2, guard 2)", () => {
  /** A link the guard covers: written under reports/ or aimed at /reports. */
  const isReportLink = (path: string, tag: string) =>
    path.startsWith("src/app/(dashboard)/reports/") ||
    /["'`{]\/reports/.test(tag);
  const optsOut = (tag: string) => tag.includes("prefetch={false}");

  it("classifies a link by where it lives and where it points", () => {
    expect(isReportLink("src/x.tsx", '<Link href="/reports">')).toBe(true);
    expect(isReportLink("src/x.tsx", "<Link href={`/reports/a`}>")).toBe(true);
    expect(
      isReportLink("src/app/(dashboard)/reports/a.tsx", "<Link href={h}>"),
    ).toBe(true);
    expect(isReportLink("src/x.tsx", '<Link href="/review/1">')).toBe(false);
    expect(optsOut('<Link href="/reports" prefetch={false}>')).toBe(true);
    expect(optsOut('<Link href="/reports">')).toBe(false);
  });

  it("every <Link> under reports/ or aimed at /reports has prefetch={false}", () => {
    const offenders = sources
      .flatMap((s) => linkTags(s.text).map((tag) => ({ path: s.path, tag })))
      .filter(({ path, tag }) => isReportLink(path, tag) && !optsOut(tag));

    expect(offenders).toEqual([]);
  });

  it("adds no link to the detail page from the dashboard files", () => {
    const dashboardFiles = reportSources.filter((s) =>
      /\/reports\/(page|ranking-card|period-filter)\.tsx$/.test(s.path),
    );

    expect(dashboardFiles).toHaveLength(3);
    expect(
      dashboardFiles.filter((s) => s.text.includes("/reports/requests")),
    ).toEqual([]);
  });
});

describe("reports structure: nothing prefetches or re-renders a report page (CR-9, guards 3 and 4)", () => {
  it("has no loading, layout, template or default file under reports/", () => {
    const offenders = reportFiles.filter((path) =>
      /(^|\/)(loading|layout|template|default)\.(tsx|ts|jsx|js)$/.test(path),
    );

    expect(offenders).toEqual([]);
  });

  it("never revalidates a path or tag, and never refreshes the router", () => {
    const offenders = reportSources.filter((s) =>
      /revalidatePath|revalidateTag|updateTag|router\.refresh|refresh\(\)/.test(
        s.text,
      ),
    );

    expect(offenders.map((s) => s.path)).toEqual([]);
  });
});
