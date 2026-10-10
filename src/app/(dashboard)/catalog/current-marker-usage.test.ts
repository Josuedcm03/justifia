import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Characterization pin (cannot be RED; proven live by a mutation check, see
// apply-progress). The "you are here" marker `.is-current` (docs/design-system.md
// section 2.3, design Decision 8) marks the current breadcrumb segment and
// nothing else. The status filter selection uses the `accent` pair, the toggle
// uses `secondary` and `destructive`, and the forms use no marker at all.
// Source-text check: it proves where the class is written, not how it renders.

const ROOT = process.cwd();
const CATALOG_DIR = join(ROOT, "src/app/(dashboard)/catalog");
const MARKER = "is-current";

// Catalog-specific components that live outside the catalog route directory.
const SHARED_CATALOG_COMPONENTS = [
  "src/components/status-filter.tsx",
  "src/components/status-pill.tsx",
  "src/components/form-field.tsx",
  "src/components/checkbox-group.tsx",
  "src/components/data-table-search.tsx",
  "src/components/ui/checkbox.tsx",
  "src/components/ui/combobox.tsx",
];

function sourcesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourcesUnder(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
      ? [path]
      : [];
  });
}

// Comments may legitimately name the class (status-filter.tsx documents it);
// only executable text counts.
function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

function load(path: string) {
  return {
    path: relative(ROOT, path).replace(/\\/g, "/"),
    code: stripComments(readFileSync(path, "utf8")),
  };
}

const sources = [
  ...sourcesUnder(CATALOG_DIR).map(load),
  ...SHARED_CATALOG_COMPONENTS.map((p) => load(join(ROOT, p))),
];

const byPath = (suffix: string) => {
  const found = sources.find((s) => s.path.endsWith(suffix));
  if (!found) throw new Error(`source not found: ${suffix}`);
  return found;
};

const BREADCRUMB_PAGES = [
  "catalog/asignaturas/new/page.tsx",
  "catalog/asignaturas/[id]/edit/page.tsx",
  "catalog/grupos/new/page.tsx",
  "catalog/grupos/[id]/edit/page.tsx",
];

describe("current-marker usage (characterization)", () => {
  it("scans the catalog sources and the shared catalog components", () => {
    expect(sources.length).toBeGreaterThan(SHARED_CATALOG_COMPONENTS.length);
  });

  it("writes the marker only in the breadcrumb pages", () => {
    const withMarker = sources
      .filter((s) => s.code.includes(MARKER))
      .map((s) => s.path.replace("src/app/(dashboard)/", ""))
      .sort();
    expect(withMarker).toEqual([...BREADCRUMB_PAGES].sort());
  });

  it.each(BREADCRUMB_PAGES)(
    "%s writes the marker once, on the current breadcrumb segment",
    (suffix) => {
      const { code } = byPath(suffix);
      expect(code.split(MARKER)).toHaveLength(2);
      expect(code).toMatch(/<BreadcrumbPage\s+className="is-current">/);
    },
  );

  it("keeps the status filter on the accent pair", () => {
    const { code } = byPath("src/components/status-filter.tsx");
    expect(code).toContain("bg-accent");
    expect(code).toContain("text-accent-foreground");
    expect(code).not.toContain(MARKER);
  });

  it("keeps the toggle on the secondary and destructive variants", () => {
    const { code } = byPath("catalog/active-toggle.tsx");
    expect(code).toContain('variant="secondary"');
    expect(code).toContain('variant="destructive"');
    expect(code).not.toContain(MARKER);
  });

  it.each([
    "catalog/asignaturas/asignatura-form.tsx",
    "catalog/grupos/grupo-form.tsx",
  ])("%s uses no marker and signals errors with destructive", (suffix) => {
    const { code } = byPath(suffix);
    expect(code).toContain("destructive");
    expect(code).not.toContain(MARKER);
  });
});
