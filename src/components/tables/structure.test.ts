import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

// Structural pins (there is no browser layer): DT-DENS-1 "Header height" and
// BS-MOT-1 "No `all` transitions", checked over every non-test source under
// `src/components` and `src/app` so a new table or shell component cannot
// reintroduce either by accident.

const ROOT = process.cwd();

function sourcesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourcesUnder(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
      ? [path]
      : [];
  });
}

const sources = [
  ...sourcesUnder(join(ROOT, "src/components")),
  ...sourcesUnder(join(ROOT, "src/app")),
].map((path) => ({
  path: relative(ROOT, path).replace(/\\/g, "/"),
  code: readFileSync(path, "utf8"),
}));

// Third-party primitives vendored from the component generator. They are not
// shell components and this change does not touch them; the pin lists them so
// that any other file gaining an `all` transition fails.
const VENDORED_PRIMITIVES = [
  "src/components/ui/button.tsx",
  "src/components/ui/sidebar.tsx",
];

describe("structure of the tables and the shell", () => {
  it("scans the component and app trees", () => {
    expect(sources.length).toBeGreaterThan(50);
  });

  it("writes no `all` transition outside the two vendored primitives (BS-MOT-1)", () => {
    const offenders = sources
      .filter((s) => /transition-all|transition:\s*all/.test(s.code))
      .map((s) => s.path)
      .sort();

    expect(offenders).toEqual([...VENDORED_PRIMITIVES].sort());
  });

  it("keeps the header row at 48px in the one table head primitive (DT-DENS-1)", () => {
    const table = sources.find((s) => s.path === "src/components/ui/table.tsx");

    expect(table).toBeDefined();
    const head = table!.code.slice(table!.code.indexOf("function TableHead("));
    expect(head.slice(0, head.indexOf("/>"))).toMatch(/\bh-12\b/);
    expect(head.slice(0, head.indexOf("/>"))).toMatch(/\bpx-6\b/);
  });

  it("never sets a height or padding on a column through its meta className (DT-DENS-1)", () => {
    // `meta.className` is applied to the header and to every cell of a column.
    const classNames = sources.flatMap((s) =>
      [...s.code.matchAll(/meta:\s*\{[^}]*?className:\s*"([^"]*)"/g)].map(
        (m) => ({ path: s.path, value: m[1] }),
      ),
    );

    expect(classNames.length).toBeGreaterThan(0);
    for (const { path, value } of classNames) {
      expect(value, path).not.toMatch(/(^|\s)(h|min-h|max-h|p|px|py|pt|pb)-/);
    }
  });

  it("gives the sortable header button a 44px target inside the 48px row", () => {
    const header = sources.find(
      (s) => s.path === "src/components/tables/sortable-header.tsx",
    );

    expect(header?.code).toMatch(/\bmin-h-11\b/);
    expect(header?.code).not.toMatch(/\bh-(1[3-9]|[2-9]\d)\b/);
  });
});
