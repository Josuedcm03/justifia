import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Structural check behind the request-review requirement "Decision data is
 * append-only" (secretary-review, SR-1). `SolicitudDecision` and
 * `SolicitudRevision` keep the history across return cycles, so no production
 * module may update or delete their rows; the foreign keys carry no cascade, so
 * deleting a decided request fails instead of erasing its history. A trigger
 * was rejected (custom SQL outside the snapshot for a table only this code
 * writes), which makes this file scan the guard. Inserts are the only write.
 */

const SRC = join(process.cwd(), "src");

const TABLES = ["solicitudDecision", "solicitudRevision"] as const;
const SQL_TABLES = ["SolicitudDecision", "SolicitudRevision"] as const;

/** Drizzle writes (`update(solicitudDecision)`) and raw SQL writes. */
const WRITE_PATTERNS = [
  new RegExp(`\\.(update|delete)\\(\\s*(${TABLES.join("|")})\\b`),
  new RegExp(
    `\\b(update|delete\\s+from)\\s+"?(${SQL_TABLES.join("|")})"?`,
    "i",
  ),
];

function findAppendOnlyWrites(source: string): string[] {
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

describe("append-only decision data", () => {
  it.each(TABLES)("detects an update or delete of %s", (table) => {
    expect(
      findAppendOnlyWrites(`await tx.update(${table}).set(x)`),
    ).not.toEqual([]);
    expect(findAppendOnlyWrites(`db.delete( ${table} )`)).not.toEqual([]);
  });

  it.each(SQL_TABLES)("detects raw SQL writes on %s", (table) => {
    expect(
      findAppendOnlyWrites(`sql\`UPDATE "${table}" SET a = 1\``),
    ).not.toEqual([]);
    expect(
      findAppendOnlyWrites(`sql\`delete from ${table} where true\``),
    ).not.toEqual([]);
  });

  it("allows inserts and reads, the only operations the history needs", () => {
    expect(
      findAppendOnlyWrites("await tx.insert(solicitudDecision).values(row)"),
    ).toEqual([]);
    expect(findAppendOnlyWrites("db.select().from(solicitudRevision)")).toEqual(
      [],
    );
    expect(findAppendOnlyWrites("tx.update(solicitud).set(x)")).toEqual([]);
  });

  it("has no production module under src that updates or deletes either table", () => {
    const files = productionSources(SRC);
    expect(files.length).toBeGreaterThan(0);

    const offenders = files.flatMap((file) =>
      findAppendOnlyWrites(readFileSync(file, "utf8")).map(
        (hit) => `${relative(SRC, file)}: ${hit}`,
      ),
    );

    expect(offenders).toEqual([]);
  });

  it("scans the module that writes the history, so the pin is not vacuous", () => {
    const writer = readFileSync(
      join(SRC, "lib", "data", "solicitud-decision.ts"),
      "utf8",
    );

    expect(writer).toContain(".insert(solicitudDecision)");
    expect(writer).toContain(".insert(solicitudRevision)");
    expect(productionSources(SRC)).toContain(
      join(SRC, "lib", "data", "solicitud-decision.ts"),
    );
  });
});
