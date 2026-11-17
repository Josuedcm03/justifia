import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

// Located by name, never by number: the number is whatever drizzle-kit
// generated as the next migration (VS-5).
const DRIZZLE_DIR = resolve(process.cwd(), "drizzle");
const JOURNAL_PATH = resolve(DRIZZLE_DIR, "meta/_journal.json");

/**
 * `when` of migration 0012 (escalation, applied in production); ours must be
 * later, or the drizzle migrator skips it.
 */
const LAST_APPLIED_WHEN = 1793384505116;

type Journal = { entries: { tag: string; when: number }[] };

function journal(): Journal {
  return JSON.parse(readFileSync(JOURNAL_PATH, "utf8")) as Journal;
}

function readSql(): string {
  const matches = readdirSync(DRIZZLE_DIR).filter((f) =>
    /^\d{4}_validation_signals\.sql$/.test(f),
  );
  expect(matches).toHaveLength(1);
  return readFileSync(resolve(DRIZZLE_DIR, matches[0]), "utf8");
}

/** Collapse whitespace and drop the table qualifier drizzle adds in CHECKs. */
function flat(sql: string): string {
  return sql.replace(/\s+/g, " ").replace(/"DocumentoRespaldo"\./g, "");
}

describe("validation-signals migration (VS-5, RN-26)", () => {
  it("is registered once in the journal, later than the last applied migration", () => {
    const entries = journal().entries.filter((e) =>
      e.tag.endsWith("_validation_signals"),
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].when).toBeGreaterThan(LAST_APPLIED_WHEN);
  });

  it("adds exactly one nullable char(64) column, with no default", () => {
    const adds = [
      ...flat(readSql()).matchAll(
        /ALTER TABLE "([^"]+)" ADD COLUMN "([^"]+)" ([^;]+);/g,
      ),
    ].map((m) => `${m[1]}.${m[2]} ${m[3].trim()}`);
    expect(adds).toEqual(["DocumentoRespaldo.HuellaSha256 char(64)"]);
  });

  it("accepts only NULL or 64 lower-case hex on a valid document (CK_Documento_Huella)", () => {
    expect(flat(readSql())).toContain(
      `ALTER TABLE "DocumentoRespaldo" ADD CONSTRAINT "CK_Documento_Huella" CHECK ("HuellaSha256" IS NULL OR ("Estado" = 'valido' AND "HuellaSha256" ~ '^[0-9a-f]{64}$'));`,
    );
  });

  it("indexes only the hashed rows (IX_Documento_Huella)", () => {
    expect(flat(readSql())).toContain(
      `CREATE INDEX "IX_Documento_Huella" ON "DocumentoRespaldo" USING btree ("HuellaSha256") WHERE "HuellaSha256" IS NOT NULL;`,
    );
  });

  it("is purely additive: no drop, update, retype, rename or cascade", () => {
    const sql = readSql();
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(sql).not.toMatch(/\bINSERT\b/i);
    // "ON UPDATE no action" is part of an FK; only a statement counts.
    expect(sql).not.toMatch(/^\s*UPDATE\b/im);
    expect(sql).not.toMatch(/ALTER\s+\S+\s+TYPE/i);
    expect(sql).not.toMatch(/\bALTER COLUMN\b/i);
    expect(sql).not.toMatch(/\bSET NOT NULL\b/i);
    expect(sql).not.toMatch(/\bRENAME\b/i);
    expect(sql).not.toMatch(/\bCASCADE\b/i);
  });

  it("holds only ADD COLUMN, ADD CONSTRAINT and CREATE INDEX statements", () => {
    const statements = readSql()
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    expect(statements).toHaveLength(3);
    const kinds = statements.map(
      (s) =>
        s.match(
          /^(ALTER TABLE "[^"]+" ADD (?:COLUMN|CONSTRAINT)|CREATE INDEX)/,
        )?.[1],
    );
    expect(kinds.sort()).toEqual(
      [
        'ALTER TABLE "DocumentoRespaldo" ADD COLUMN',
        'ALTER TABLE "DocumentoRespaldo" ADD CONSTRAINT',
        "CREATE INDEX",
      ].sort(),
    );
  });
});
