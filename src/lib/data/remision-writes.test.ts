import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Structural pin of the `Remision` write surface (teacher-remission, TR-1).
 * The table is a state machine, not append-only, so its guarded claim and
 * completions must stay in one module: `remision.ts` is the only writer after
 * creation, and `solicitud-decision.ts` may only INSERT (the rows born inside
 * the approval transaction). Dispatch writes through `remision.ts`.
 */

const SRC = join(process.cwd(), "src");

type Verb = "insert" | "update" | "delete";

/** Drizzle writes (`insert(remision)`) and raw SQL writes on the table. */
const WRITE_PATTERNS: Record<Verb, RegExp[]> = {
  insert: [/\.insert\(\s*remision\b/, /insert\s+into\s+"?Remision"?/i],
  update: [/\.update\(\s*remision\b/, /update\s+"?Remision"?/i],
  delete: [/\.delete\(\s*remision\b/, /delete\s+from\s+"?Remision"?/i],
};

function remisionWrites(source: string): Verb[] {
  return (Object.keys(WRITE_PATTERNS) as Verb[]).filter((verb) =>
    WRITE_PATTERNS[verb].some((pattern) => pattern.test(source)),
  );
}

/** Module (relative to src, forward slashes) -> verbs it may use. */
const ALLOWED: Record<string, readonly Verb[]> = {
  "lib/data/remision.ts": ["insert", "update", "delete"],
  "lib/data/solicitud-decision.ts": ["insert"],
  // Cleanup of the opt-in real-Postgres suite on a disposable branch only.
  "lib/data/integration/fixtures.ts": ["delete"],
};

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

describe("Remision write surface", () => {
  it("detects the write shapes it guards against", () => {
    expect(remisionWrites("await tx.insert(remision).values(r)")).toEqual([
      "insert",
    ]);
    expect(remisionWrites("db.update( remision ).set(x)")).toEqual(["update"]);
    expect(remisionWrites("db.delete(remision)")).toEqual(["delete"]);
    expect(remisionWrites('sql`UPDATE "Remision" SET x = 1`')).toEqual([
      "update",
    ]);
    expect(remisionWrites("db.select().from(remision)")).toEqual([]);
  });

  it("has no module outside the allowed writers that writes Remision", () => {
    const files = productionSources(SRC);
    expect(files.length).toBeGreaterThan(0);

    const offenders = files.flatMap((file) => {
      const name = relative(SRC, file).split(sep).join("/");
      const allowed = ALLOWED[name] ?? [];
      return remisionWrites(readFileSync(file, "utf8"))
        .filter((verb) => !allowed.includes(verb))
        .map((verb) => `${name}: ${verb}`);
    });

    expect(offenders).toEqual([]);
  });

  it("finds both allowed writers, so the pin is not vacuous", () => {
    for (const name of Object.keys(ALLOWED)) {
      expect(
        remisionWrites(readFileSync(join(SRC, name), "utf8")).length,
      ).toBeGreaterThan(0);
    }
  });

  it("never lets the approval transaction update or delete Remision", () => {
    const source = readFileSync(
      join(SRC, "lib/data/solicitud-decision.ts"),
      "utf8",
    );
    expect(remisionWrites(source)).toEqual(["insert"]);
  });
});
