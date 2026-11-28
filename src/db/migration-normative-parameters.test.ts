import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { parametroNormativo } from "@/db/schema";
import { PARAMETER_KEYS, PARAMETER_REGISTRY } from "@/lib/parameters/registry";

// Located by name, never by number: the number is whatever drizzle-kit
// generated as the next migration, and a teammate who merges first makes the
// second one regenerate (NP-1, NP-16).
const DRIZZLE_DIR = resolve(process.cwd(), "drizzle");
const JOURNAL_PATH = resolve(DRIZZLE_DIR, "meta/_journal.json");

/** `when` of migration 0016 (escalation otro, applied in production). */
const LAST_APPLIED_WHEN = 1795216905153;

const SEED_DATE = "2026-01-01";

type Journal = { entries: { idx: number; tag: string; when: number }[] };

function journal(): Journal {
  return JSON.parse(readFileSync(JOURNAL_PATH, "utf8")) as Journal;
}

function readSql(): string {
  const matches = readdirSync(DRIZZLE_DIR).filter((f) =>
    /^\d{4}_normative_parameters\.sql$/.test(f),
  );
  expect(matches).toHaveLength(1);
  return readFileSync(resolve(DRIZZLE_DIR, matches[0]), "utf8");
}

/** The SQL without its comment lines (the breakpoint marker is not one). */
function code(): string {
  return readSql().replace(/^--(?!>).*$/gm, "");
}

/** Drizzle's statements, comments dropped, whitespace collapsed. */
function statements(): string[] {
  return code()
    .split("--> statement-breakpoint")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function createTable(): string {
  const creates = statements().filter((s) => /^CREATE TABLE /.test(s));
  expect(creates).toHaveLength(1);
  return creates[0];
}

function seedInsert(): string {
  const inserts = statements().filter((s) => /^INSERT /.test(s));
  expect(inserts).toHaveLength(1);
  return inserts[0];
}

describe("normative-parameters migration (NP-1, NP-16)", () => {
  it("is registered once in the journal, right after 0016 and later than its time", () => {
    const all = journal().entries;
    const entries = all.filter((e) => e.tag.endsWith("_normative_parameters"));
    expect(entries).toHaveLength(1);
    const previous = all.find((e) => e.tag === "0016_escalation_otro");
    expect(previous).toBeDefined();
    expect(entries[0].idx).toBe((previous?.idx ?? -1) + 1);
    expect(entries[0].when).toBeGreaterThan(LAST_APPLIED_WHEN);
    // Later migrations may follow it (the size ceiling does); the journal
    // must keep them later.
    const after = all.filter((e) => e.idx > entries[0].idx);
    expect(after.every((e) => e.when > entries[0].when)).toBe(true);
  });

  it("creates ParametroNormativo with exactly the columns of Table D19", () => {
    const create = createTable();
    expect(create).toMatch(/^CREATE TABLE "ParametroNormativo" \(/);
    const columns = [...create.matchAll(/(?:\(|,) ?"(\w+)" ([a-z]+)/g)].map(
      (m) => [m[1], m[2]],
    );
    expect(columns).toEqual([
      ["Id", "bigint"],
      ["Clave", "varchar"],
      ["Valor", "jsonb"],
      ["VigenteDesde", "date"],
    ]);
    expect(create).toContain(
      '"Id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY',
    );
    expect(create).toContain('"Clave" varchar(60) NOT NULL');
    expect(create).toContain('"Valor" jsonb NOT NULL');
    expect(create).toContain('"VigenteDesde" date NOT NULL');
  });

  it("makes the pair Clave and VigenteDesde unique and adds no other constraint", () => {
    const create = createTable();
    const constraints = [
      ...create.matchAll(/CONSTRAINT "([^"]+)" (\w+)\(([^)]*)\)/g),
    ].map((m) => [m[1], m[2], m[3]]);
    expect(constraints).toEqual([
      [
        "UQ_ParametroNormativo_Clave_Vigencia",
        "UNIQUE",
        '"Clave","VigenteDesde"',
      ],
    ]);
    expect(create).not.toMatch(/\bCHECK\b/);
    expect(create).not.toMatch(/\bREFERENCES\b/);
  });

  it("defines the same columns and the same unique constraint in the schema", () => {
    const config = getTableConfig(parametroNormativo);
    expect(config.name).toBe("ParametroNormativo");
    expect(config.columns.map((c) => [c.name, c.getSQLType()])).toEqual([
      ["Id", "bigint"],
      ["Clave", "varchar(60)"],
      ["Valor", "jsonb"],
      ["VigenteDesde", "date"],
    ]);
    expect(config.columns.every((c) => c.notNull)).toBe(true);
    expect(
      config.uniqueConstraints.map((u) => [
        u.name,
        u.columns.map((c) => c.name),
      ]),
    ).toEqual([
      ["UQ_ParametroNormativo_Clave_Vigencia", ["Clave", "VigenteDesde"]],
    ]);
    expect(config.checks).toEqual([]);
    expect(config.foreignKeys).toEqual([]);
  });

  it("holds exactly two statements: the table and the seed", () => {
    const all = statements();
    expect(all).toHaveLength(2);
    expect(all[0]).toMatch(/^CREATE TABLE "ParametroNormativo"/);
    expect(all[1]).toMatch(/^INSERT INTO "ParametroNormativo"/);
  });

  it("is additive: it alters, drops, updates or deletes nothing that exists", () => {
    const sql = code();
    expect(sql).not.toMatch(/\bALTER\b/i);
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(sql).not.toMatch(/\bRENAME\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).not.toMatch(/\bDELETE\b/i);
    expect(sql).not.toMatch(/^\s*UPDATE\b/im);
    expect(sql).not.toMatch(/\bCASCADE\b/i);
    expect(sql).not.toMatch(/\bBEGIN\b/i);
    const inserts = [...sql.matchAll(/\bINSERT\s+INTO\s+("?\w+"?)/gi)].map(
      (m) => m[1],
    );
    expect(inserts).toEqual(['"ParametroNormativo"']);
    const creates = [...sql.matchAll(/\bCREATE\s+\w+\s+("?\w+"?)/gi)].map(
      (m) => m[1],
    );
    expect(creates).toEqual(['"ParametroNormativo"']);
  });

  describe("seed", () => {
    const rows = () =>
      [
        ...seedInsert().matchAll(
          /\('([a-z_]+)', '([^']*)'::jsonb, '(\d{4}-\d{2}-\d{2})'\)/g,
        ),
      ].map((m) => ({ clave: m[1], valor: JSON.parse(m[2]), fecha: m[3] }));

    it("names its columns and is idempotent", () => {
      const insert = seedInsert();
      expect(insert).toMatch(
        /^INSERT INTO "ParametroNormativo" \("Clave", ?"Valor", ?"VigenteDesde"\) VALUES /,
      );
      expect(insert).toMatch(
        /ON CONFLICT \("Clave", ?"VigenteDesde"\) DO NOTHING;?$/,
      );
    });

    it("holds exactly the nine keys, each once", () => {
      expect(rows().map((r) => r.clave)).toEqual([...PARAMETER_KEYS]);
      expect(seedInsert().match(/::jsonb/g)).toHaveLength(
        PARAMETER_KEYS.length,
      );
    });

    it("dates every row 2026-01-01, a fixed literal", () => {
      for (const row of rows()) expect(row.fecha, row.clave).toBe(SEED_DATE);
      expect(seedInsert()).not.toMatch(/CURRENT_DATE|now\(\)/i);
    });

    it.each(PARAMETER_KEYS)("seeds %s with the registry default", (key) => {
      const row = rows().find((r) => r.clave === key);
      expect(row, key).toBeDefined();
      expect(row?.valor).toEqual(PARAMETER_REGISTRY[key].default);
    });

    it("seeds values that pass their own schema", () => {
      for (const row of rows()) {
        const key = row.clave as (typeof PARAMETER_KEYS)[number];
        expect(
          PARAMETER_REGISTRY[key].schema.safeParse(row.valor).success,
          row.clave,
        ).toBe(true);
      }
    });
  });
});
