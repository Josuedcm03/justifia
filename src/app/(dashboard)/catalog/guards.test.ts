import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Structural pins over the catalog pages (CM-ACC-2, CM-UX-1; design Threat
// Matrix: authorisation order, mutation by GET). Source-text checks: they prove
// the shape of a page, not its behaviour. Pages are discovered by directory, so
// the Grupos and Docentes pages of later units are covered automatically.

const ROOT = process.cwd();
const CATALOG_DIR = join(ROOT, "src/app/(dashboard)/catalog");
const SEGMENTS = ["asignaturas", "grupos", "docentes"] as const;

function pagesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return pagesUnder(path);
    return entry.name === "page.tsx" ? [path] : [];
  });
}

const pages = SEGMENTS.flatMap((segment) =>
  pagesUnder(join(CATALOG_DIR, segment)).map((path) => ({
    path: relative(ROOT, path).replace(/\\/g, "/"),
    // A list page sits directly under its segment: `<segment>/page.tsx`.
    isList: SEGMENTS.some((s) => path === join(CATALOG_DIR, s, "page.tsx")),
    text: readFileSync(path, "utf8"),
  })),
);

describe("catalog pages (structure)", () => {
  it("discovers at least one page", () => {
    expect(pages.length).toBeGreaterThan(0);
  });

  // A misplaced or deleted page must fail here instead of shrinking the
  // coverage below, and an extra page under `grupos` would be a retired URL
  // that answers something other than "not found" (CM-RTE-1).
  it("discovers exactly the expected catalog pages", () => {
    const base = "src/app/(dashboard)/catalog";

    expect(pages.map((p) => p.path).sort()).toEqual(
      [
        "asignaturas/page.tsx",
        "asignaturas/new/page.tsx",
        "asignaturas/[id]/edit/page.tsx",
        "asignaturas/[id]/grupos/new/page.tsx",
        "asignaturas/[id]/grupos/[grupoId]/edit/page.tsx",
        "docentes/page.tsx",
        "grupos/[id]/edit/page.tsx",
      ]
        .map((path) => `${base}/${path}`)
        .sort(),
    );
  });

  it("keeps no list page under grupos (the standalone list is retired)", () => {
    expect(
      pages
        .filter((p) => p.isList)
        .map((p) => p.path)
        .sort(),
    ).toEqual([
      "src/app/(dashboard)/catalog/asignaturas/page.tsx",
      "src/app/(dashboard)/catalog/docentes/page.tsx",
    ]);
  });

  it.each(pages.map((p) => [p.path, p] as const))(
    "%s calls requireCatalogAccess( before any other await",
    (_path, page) => {
      const guard = page.text.indexOf("requireCatalogAccess(");
      expect(guard).toBeGreaterThanOrEqual(0);

      const firstAwait = page.text.indexOf("await ");
      expect(firstAwait).toBeGreaterThanOrEqual(0);
      expect(page.text.slice(firstAwait)).toMatch(
        /^await requireCatalogAccess\(/,
      );

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

  it.each(pages.filter((p) => p.isList).map((p) => [p.path, p] as const))(
    "%s renders no mutating control (GET never mutates)",
    (_path, page) => {
      expect(page.text).not.toMatch(/<form[\s>]/);
      expect(page.text).not.toMatch(/<button[\s>]/i);
      expect(page.text).not.toMatch(/onClick|onSubmit|formAction/);
      expect(page.text).not.toMatch(
        /href=[^\n]*(deactivate|reactivate|toggle|delete|remove)/i,
      );
    },
  );
});

// Server actions (CM-ACC-2: a denied caller's body is never read). Every
// exported action must resolve the guard before anything else and must not
// touch the form data until it has.
const ACTION_SEGMENTS = ["asignaturas", "grupos"] as const;

const actionFiles = ACTION_SEGMENTS.map((segment) =>
  join(CATALOG_DIR, segment, "actions.ts"),
)
  .filter((path) => existsSync(path))
  .map((path) => ({
    path: relative(ROOT, path).replace(/\\/g, "/"),
    text: readFileSync(path, "utf8"),
  }));

/** A form read: `get` and also `getAll` (the Grupo days travel as
 *  `formData.getAll("dias")`, finding F-11). */
const FORM_READ = /\b(formData|fd)\.get(All)?\(/;

/** True when the source reads the form before the first `await`. */
function readsFormBeforeAwait(source: string): boolean {
  const firstAwait = source.indexOf("await ");
  return FORM_READ.test(source.slice(0, firstAwait));
}

/** Each exported function with its body (up to the next export or the end). */
function exportedFunctions(text: string) {
  const starts = [...text.matchAll(/^export async function (\w+)\(/gm)];
  return starts.map((match, i) => ({
    name: match[1],
    body: text.slice(match.index, starts[i + 1]?.index ?? text.length),
  }));
}

describe("catalog server actions (structure)", () => {
  it("discovers at least one actions module", () => {
    expect(actionFiles.length).toBeGreaterThan(0);
  });

  it("covers every expected actions module (a missing file is a failure)", () => {
    expect(actionFiles.map((f) => f.path)).toEqual([
      "src/app/(dashboard)/catalog/asignaturas/actions.ts",
      "src/app/(dashboard)/catalog/grupos/actions.ts",
    ]);
  });

  it.each([
    ["get", 'const d = formData.get("dias");'],
    ["getAll", 'const d = formData.getAll("dias");'],
    ["fd.getAll", 'const d = fd.getAll("dias");'],
  ])("the form-read check catches %s before the guard", (_name, read) => {
    const early = `export async function a(_p, formData) {\n  ${read}\n  await requireCatalogAccess();\n}`;
    const late = `export async function a(_p, formData) {\n  await requireCatalogAccess();\n  ${read}\n}`;

    expect(readsFormBeforeAwait(early)).toBe(true);
    expect(readsFormBeforeAwait(late)).toBe(false);
  });

  it.each(actionFiles.map((f) => [f.path, f] as const))(
    "%s: every exported action awaits requireCatalogAccess() first, before any form read",
    (_path, file) => {
      const actions = exportedFunctions(file.text);
      expect(actions.length).toBeGreaterThan(0);

      for (const action of actions) {
        const firstAwait = action.body.indexOf("await ");
        expect(firstAwait, action.name).toBeGreaterThanOrEqual(0);
        expect(action.body.slice(firstAwait), action.name).toMatch(
          /^await requireCatalogAccess\(\)/,
        );
        expect(action.body.slice(0, firstAwait), action.name).not.toMatch(
          FORM_READ,
        );
      }
    },
  );

  it.each(actionFiles.map((f) => [f.path, f] as const))(
    "%s: only async functions are exported (a Server Actions module)",
    (_path, file) => {
      const exported = [
        ...file.text.matchAll(/^export (?!type |async function )/gm),
      ];
      expect(exported).toEqual([]);
    },
  );
});
