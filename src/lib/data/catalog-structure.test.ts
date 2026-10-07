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
      text: readFileSync(p, "utf8"),
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
