import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Structural pins over the catalog write paths (CM-NFR-1, CM-GRP-5, AC-ORIG).
// Source-text checks: they cannot prove behaviour, only that a writer did not
// slip in a delete, a second transaction opener (which would skip the lock) or
// a rewrite of the origin marker. Files that do not exist yet are skipped; the
// action files are discovered by directory so later units are covered
// automatically.

const ROOT = process.cwd();
const DATA_MODULES = [
  "src/lib/data/asignaturas.ts",
  "src/lib/data/grupos.ts",
  "src/lib/data/catalog-write.ts",
  "src/lib/data/catalog-scope-sql.ts",
];
const ACTION_DIRS = [
  "src/app/(dashboard)/catalog/asignaturas",
  "src/app/(dashboard)/catalog/grupos",
  "src/app/(dashboard)/catalog/docentes",
];

function catalogSources(): { path: string; text: string }[] {
  const paths = DATA_MODULES.map((p) => join(ROOT, p));
  for (const dir of ACTION_DIRS) {
    const file = join(ROOT, dir, "actions.ts");
    if (existsSync(file)) paths.push(file);
  }
  return paths
    .filter((p) => existsSync(p))
    .map((p) => ({
      path: relative(ROOT, p).replace(/\\/g, "/"),
      // Windows checkouts use CRLF (core.autocrlf); the pins assume LF.
      text: readFileSync(p, "utf8").replace(/\r\n/g, "\n"),
    }));
}

const sources = catalogSources();

describe("catalog write paths (structure)", () => {
  it("always inspects the wrapper, the writer of record", () => {
    expect(sources.map((s) => s.path)).toContain(
      "src/lib/data/catalog-write.ts",
    );
    expect(readdirSync(join(ROOT, "src/lib/data"))).toContain(
      "catalog-write.ts",
    );
  });

  it("inspects the Asignatura data module, which now writes (CM-NFR-1)", () => {
    expect(sources.map((s) => s.path)).toContain("src/lib/data/asignaturas.ts");
  });

  it("never deletes a row (CM-NFR-1)", () => {
    const offenders = sources
      .filter(
        ({ text }) => /\.delete\(/.test(text) || /delete\s+from/i.test(text),
      )
      .map((s) => s.path);
    expect(offenders).toEqual([]);
  });

  it("opens a transaction only in catalog-write.ts (the lock cannot be skipped)", () => {
    const offenders = sources
      .filter(({ text }) => /\.transaction\(/.test(text))
      .map((s) => s.path);
    expect(offenders).toEqual(["src/lib/data/catalog-write.ts"]);
  });

  it("never rewrites the Grupo origin marker (CM-GRP-5, AC-ORIG)", () => {
    const offenders = sources
      .filter(({ text }) => /\.set\(\s*\{[^}]*\borigen\b/.test(text))
      .map((s) => s.path);
    expect(offenders).toEqual([]);
  });
});

// The body of one top-level function: from its `export` line to the first
// closing brace in column 0. Comments above the function are not part of it.
function functionBody(text: string, name: string): string {
  const start = text.search(new RegExp(`export (async )?function ${name}\\b`));
  expect(start).toBeGreaterThanOrEqual(0);
  return text.slice(start, text.indexOf("\n}\n", start));
}

describe("Grupo data module (structure)", () => {
  const grupos = sources.find((s) => s.path === "src/lib/data/grupos.ts");
  const code = (grupos?.text ?? "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  it("is inspected by every pin above (CM-GRP-5, CM-NFR-1)", () => {
    expect(grupos).toBeDefined();
  });

  it("never mentions Inscripcion outside comments (CM-NFR-1)", () => {
    expect(code).not.toMatch(/inscripcion/i);
  });

  it("keeps the days out of setGrupoActivo (CM-GRP-6)", () => {
    const body = functionBody(grupos?.text ?? "", "setGrupoActivo");
    expect(body).toContain(".update(");
    expect(body).not.toMatch(/dias/i);
  });

  it("keeps the days out of buildGruposWhere (CM-GRP-7)", () => {
    const body = functionBody(grupos?.text ?? "", "buildGruposWhere");
    expect(body).toContain("asignaturaInScope");
    expect(body).not.toMatch(/dias/i);
  });
});
