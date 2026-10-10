import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Structural check behind the academic-catalog scenario "No code path in this
 * change writes Inscripcion". The Inscripciones sheet was cut from the import
 * (scope reduction), so nothing may insert, update or delete `Inscripcion`
 * rows; the role-integrity rule of `EstudianteId` is deferred to the future
 * writer. This is a characterization pin: it passes today and fails the moment
 * a writer appears without the rule being specified and tested.
 */

const SRC = join(process.cwd(), "src");

/** Drizzle writes (`insert(inscripcion)`) and raw SQL writes on the table. */
const WRITE_PATTERNS = [
  /\.(insert|update|delete)\(\s*inscripcion\b/,
  /\b(insert\s+into|update|delete\s+from)\s+"?Inscripcion"?/i,
];

function findInscripcionWrites(source: string): string[] {
  return WRITE_PATTERNS.flatMap((pattern) => {
    const match = pattern.exec(source);
    return match ? [match[0]] : [];
  });
}

function productionSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "__fixtures__" ? [] : productionSources(path);
    }
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
      ? [path]
      : [];
  });
}

describe("Inscripcion write surface", () => {
  it("detects the write shapes it guards against", () => {
    expect(
      findInscripcionWrites("await tx.insert(inscripcion).values(r)"),
    ).not.toEqual([]);
    expect(
      findInscripcionWrites("db.update( inscripcion ).set(x)"),
    ).not.toEqual([]);
    expect(findInscripcionWrites("db.delete(inscripcion)")).not.toEqual([]);
    expect(
      findInscripcionWrites('sql`INSERT INTO "Inscripcion" (a)`'),
    ).not.toEqual([]);
    expect(findInscripcionWrites("db.select().from(inscripcion)")).toEqual([]);
  });

  it("has no module under src that inserts, updates or deletes Inscripcion", () => {
    const files = productionSources(SRC);
    expect(files.length).toBeGreaterThan(0);

    const offenders = files.flatMap((file) =>
      findInscripcionWrites(readFileSync(file, "utf8")).map(
        (hit) => `${relative(SRC, file)}: ${hit}`,
      ),
    );

    expect(offenders).toEqual([]);
  });
});
