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
  // coverage below. Every page of the folder is checked by the cases that
  // follow, the assign page included (S3b-1).
  it("discovers exactly the expected pages", () => {
    expect(pages.map((p) => p.path).sort()).toEqual([
      "src/app/(dashboard)/catalog/inscripciones/assign/page.tsx",
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

  it("finds the links of the assign components, so the check below reaches that folder (S3b-1)", () => {
    const assign = sources.filter((s) => s.path.includes("/assign/"));

    expect(assign.map((s) => s.path)).toContain(
      "src/app/(dashboard)/catalog/inscripciones/assign/page.tsx",
    );
    const tags = assign.flatMap((s) => prefetchingTags(s.text));
    expect(tags.length).toBeGreaterThan(0);
    expect(tags.every(optsOut)).toBe(true);
  });

  // The assign page writes one audit row per search (D10): its search and
  // picker forms carry their state in the URL, so a submit can be repeated,
  // bookmarked and never writes. The mutation (S3b-2) is a button flow with a
  // confirm step in one client component, never a form.
  it("only one client component under assign/ reaches a server action", () => {
    const reaching = sources
      .filter((s) => s.path.includes("/assign/"))
      .filter((s) => /from\s+["'][^"']*\/actions["']/.test(s.text));

    expect(reaching.map((s) => s.path)).toEqual([
      "src/app/(dashboard)/catalog/inscripciones/assign/assign-form.tsx",
    ]);
    expect(reaching[0].text).toMatch(/^"use client";/);
  });

  it("every <form> under assign/ is a GET form", () => {
    const forms = sources
      .filter((s) => s.path.includes("/assign/"))
      .flatMap((s) =>
        [...s.text.matchAll(/<form\b[^>]*>/g)].map((m) => ({
          path: s.path,
          tag: m[0],
        })),
      );

    expect(forms.length).toBeGreaterThan(0);
    expect(forms.filter((f) => !/method="get"/.test(f.tag))).toEqual([]);
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

// Server actions (EA-ACC-1, CS-9): an action does not inherit the page guard,
// so each exported one must resolve `requireEnrollmentAccess()` before anything
// else and must not touch the form data until it has.
const actionFiles = filesUnder(SEGMENT_DIR)
  .filter((path) => /actions\.ts$/.test(path))
  .map((path) => ({
    path: relative(ROOT, path).replace(/\\/g, "/"),
    text: readFileSync(path, "utf8"),
  }));

/** A form read: `get` and `getAll`. */
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

describe("inscripciones server actions (structure)", () => {
  it("discovers exactly the expected actions module", () => {
    expect(actionFiles.map((f) => f.path)).toEqual([
      "src/app/(dashboard)/catalog/inscripciones/actions.ts",
    ]);
  });

  it.each([
    ["get", 'const d = formData.get("id");'],
    ["getAll", 'const d = formData.getAll("id");'],
    ["fd.get", 'const d = fd.get("id");'],
  ])("the form-read check catches %s before the guard", (_name, read) => {
    const early = `export async function a(_p, formData) {\n  ${read}\n  await requireEnrollmentAccess();\n}`;
    const late = `export async function a(_p, formData) {\n  await requireEnrollmentAccess();\n  ${read}\n}`;

    expect(readsFormBeforeAwait(early)).toBe(true);
    expect(readsFormBeforeAwait(late)).toBe(false);
  });

  it.each(actionFiles.map((f) => [f.path, f] as const))(
    "%s: every exported action awaits requireEnrollmentAccess() first, before any form read",
    (_path, file) => {
      const actions = exportedFunctions(file.text);
      expect(actions.map((a) => a.name)).toEqual([
        "setInscripcionActivoAction",
        "assignInscripcionAction",
      ]);

      for (const action of actions) {
        const firstAwait = action.body.indexOf("await ");
        expect(firstAwait, action.name).toBeGreaterThanOrEqual(0);
        expect(action.body.slice(firstAwait), action.name).toMatch(
          /^await requireEnrollmentAccess\(\)/,
        );
        expect(action.body.slice(0, firstAwait), action.name).not.toMatch(
          FORM_READ,
        );
      }
    },
  );

  it.each(actionFiles.map((f) => [f.path, f] as const))(
    "%s: is a 'use server' module that exports only async functions",
    (_path, file) => {
      expect(file.text.startsWith('"use server";')).toBe(true);
      const exported = [
        ...file.text.matchAll(/^export (?!type |async function )/gm),
      ];
      expect(exported).toEqual([]);
    },
  );

  it.each(actionFiles.map((f) => [f.path, f] as const))(
    "%s: uses the enrollment guard and the staff writers only, and never reads an actor from the form",
    (_path, file) => {
      // The catalog guard admits administrador and coordinacion.
      expect(file.text).not.toContain("requireCatalogAccess");
      // The student writers are the student's path (no actor, no scope).
      expect(file.text).not.toMatch(/\b(enrollInGroup|dropGroup)\b/);
      expect(file.text).not.toMatch(
        /\.get(All)?\(\s*["'](actorId|estudianteId|scope|rol)["']/,
      );
    },
  );

  // The writer fails closed (EA-SIB-1): only the assign action, behind the
  // confirmation of the assign page, opts in to create and replace. The list
  // toggle must never carry the option, or a forged POST could replace a
  // group without the confirmation. Comments are stripped so prose cannot
  // satisfy or break the check.
  const code = (text: string) =>
    text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const OPT_IN = /\ballowReplaceAndCreate\b/g;

  it.each([
    ["a bare call", "staffEnrollInGroup(staff, s, g)", 0],
    [
      "an opted-in call",
      "staffEnrollInGroup(staff, s, g, { allowReplaceAndCreate: true })",
      1,
    ],
    [
      "a comment only",
      "// allowReplaceAndCreate\n/** allowReplaceAndCreate */ f()",
      0,
    ],
  ])("the opt-in check reads %s", (_name, source, count) => {
    expect(code(source).match(OPT_IN)?.length ?? 0).toBe(count);
  });

  it.each(actionFiles.map((f) => [f.path, f] as const))(
    "%s: only assignInscripcionAction opts in to create and replace; the list toggle never does",
    (_path, file) => {
      const byName = Object.fromEntries(
        exportedFunctions(file.text).map((a) => [a.name, code(a.body)]),
      );

      expect(byName.setInscripcionActivoAction).not.toMatch(OPT_IN);
      expect(byName.assignInscripcionAction).toMatch(
        /staffEnrollInGroup\([^)]*\{\s*allowReplaceAndCreate:\s*true,\s*expectedReplaced:\s*parsed\.data\.expectedReplaced,?\s*\},?\s*\)/,
      );
      expect(code(file.text).match(OPT_IN)).toHaveLength(1);
    },
  );

  it.each(actionFiles.map((f) => [f.path, f] as const))(
    "%s: assignInscripcionAction takes explicit arguments and reads no form",
    (_path, file) => {
      const assign = exportedFunctions(file.text).find(
        (a) => a.name === "assignInscripcionAction",
      );

      expect(assign).toBeDefined();
      expect(code(assign!.body)).not.toMatch(FORM_READ);
      expect(code(assign!.body)).not.toContain("FormData");
    },
  );
});
