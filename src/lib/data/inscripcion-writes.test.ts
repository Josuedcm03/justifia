import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Structural check behind the academic-catalog scenario "Only the allowlisted
 * writer writes Inscripcion" (student-enrollment SE-12, D7). The import never
 * writes `Inscripcion`; the student enrollment writer is the one module that
 * may, and it never deletes. A second writer appears only by being added to
 * the allowlist together with the role-integrity rule it must honour.
 */

const SRC = join(process.cwd(), "src");

/** Paths relative to `src`, normalized to `/` so the list is Windows-safe. */
const ALLOWED_WRITERS = ["lib/data/enrollment-write.ts"];

const relativePath = (file: string) => relative(SRC, file).split(sep).join("/");

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

  it("has no module outside the allowlist that inserts, updates or deletes Inscripcion", () => {
    const files = productionSources(SRC);
    expect(files.length).toBeGreaterThan(0);

    const offenders = files
      .filter((file) => !ALLOWED_WRITERS.includes(relativePath(file)))
      .flatMap((file) =>
        findInscripcionWrites(readFileSync(file, "utf8")).map(
          (hit) => `${relativePath(file)}: ${hit}`,
        ),
      );

    expect(offenders).toEqual([]);
  });

  it.each(ALLOWED_WRITERS)(
    "%s really writes Inscripcion (the allowlist cannot rot) and never deletes",
    (writer) => {
      const hits = findInscripcionWrites(
        readFileSync(join(SRC, writer), "utf8"),
      );

      expect(hits).not.toEqual([]);
      expect(hits.filter((hit) => /delete/i.test(hit))).toEqual([]);
    },
  );
});
