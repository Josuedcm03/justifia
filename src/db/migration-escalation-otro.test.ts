import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

// Located by name, never by number: the number is whatever drizzle-kit
// generated as the next migration, and the second change to merge regenerates
// (FE-8, FE-9).
const DRIZZLE_DIR = resolve(process.cwd(), "drizzle");
const JOURNAL_PATH = resolve(DRIZZLE_DIR, "meta/_journal.json");

/**
 * `when` of migration 0015 (manual document data, applied in production); ours
 * must be later, or the drizzle migrator skips it.
 */
const LAST_APPLIED_WHEN = 1795134628842;

type Journal = { entries: { idx: number; tag: string; when: number }[] };

function journal(): Journal {
  return JSON.parse(readFileSync(JOURNAL_PATH, "utf8")) as Journal;
}

function readSql(): string {
  const matches = readdirSync(DRIZZLE_DIR).filter((f) =>
    /^\d{4}_escalation_otro\.sql$/.test(f),
  );
  expect(matches).toHaveLength(1);
  return readFileSync(resolve(DRIZZLE_DIR, matches[0]), "utf8");
}

/** Drizzle's statements, whitespace collapsed and the table qualifier dropped. */
function statements(): string[] {
  return readSql()
    .split("--> statement-breakpoint")
    .map((s) => s.replace(/\s+/g, " ").replaceAll('"Escalamiento".', "").trim())
    .filter(Boolean);
}

const TABLE = 'ALTER TABLE "Escalamiento"';
const MOTIVES = `'sospecha_documento', 'caso_especial', 'otro'`;

const CHECK_BODIES: [name: string, body: string][] = [
  [
    "CK_Escalamiento_Tipo",
    `"Tipo" IN ('sospecha_documento', 'caso_especial', 'otro', 'exceso_inasistencias')`,
  ],
  [
    "CK_Escalamiento_Kind",
    `("Tipo" IN (${MOTIVES}) AND "EstadoPrevio" = 'pendiente' AND "ReporteId" IS NULL AND "Nota" IS NOT NULL AND length(btrim("Nota")) > 0) OR ("Tipo" = 'exceso_inasistencias' AND "EstadoPrevio" = 'aprobada' AND "ReporteId" IS NOT NULL AND "Nota" IS NULL)`,
  ],
  [
    "CK_Escalamiento_SinRespuesta",
    `"Tipo" IN (${MOTIVES}) OR "RespondidaEn" IS NULL`,
  ],
];

const DROP_INDEX = 'DROP INDEX "UX_Escalamiento_Abierto";';
const CREATE_INDEX = `CREATE UNIQUE INDEX "UX_Escalamiento_Abierto" ON "Escalamiento" USING btree ("SolicitudId") WHERE "Tipo" IN (${MOTIVES}) AND "RespondidaEn" IS NULL;`;
const dropCheck = (name: string) => `${TABLE} DROP CONSTRAINT "${name}";`;
const addCheck = (name: string, body: string) =>
  `${TABLE} ADD CONSTRAINT "${name}" CHECK (${body});`;

describe("escalation-otro migration (FE-8, FE-9)", () => {
  it("is registered once in the journal, right after 0015 and later than its time", () => {
    const all = journal().entries;
    const entries = all.filter((e) => e.tag.endsWith("_escalation_otro"));
    expect(entries).toHaveLength(1);
    const previous = all.find((e) => e.tag === "0015_manual_document_data");
    expect(previous).toBeDefined();
    expect(entries[0].idx).toBe((previous?.idx ?? -1) + 1);
    expect(entries[0].tag).toBe("0016_escalation_otro");
    expect(entries[0].when).toBeGreaterThan(LAST_APPLIED_WHEN);
    expect(all.at(-1)?.tag).toBe(entries[0].tag);
  });

  it("holds exactly eight statements, all on Escalamiento", () => {
    const all = statements();
    expect(all).toHaveLength(8);
    expect([...all].sort()).toEqual(
      [
        dropCheck("CK_Escalamiento_Tipo"),
        dropCheck("CK_Escalamiento_Kind"),
        dropCheck("CK_Escalamiento_SinRespuesta"),
        DROP_INDEX,
        ...CHECK_BODIES.map(([name, body]) => addCheck(name, body)),
        CREATE_INDEX,
      ].sort(),
    );
  });

  it("drops the open-escalation index and recreates it with otro in the predicate", () => {
    const all = statements();
    expect(all).toContain(DROP_INDEX);
    expect(all).toContain(CREATE_INDEX);
    expect(all.indexOf(DROP_INDEX)).toBeLessThan(all.indexOf(CREATE_INDEX));
  });

  it.each(CHECK_BODIES)(
    "drops %s and recreates it, in that order, with otro in the list",
    (name, body) => {
      const all = statements();
      const drop = all.indexOf(dropCheck(name));
      const add = all.indexOf(addCheck(name, body));
      expect(drop, `${name} is dropped`).toBeGreaterThanOrEqual(0);
      expect(add, `${name} is added`).toBeGreaterThanOrEqual(0);
      expect(drop).toBeLessThan(add);
    },
  );

  it("keeps the note rule on the reason branch: a non-blank note is still required", () => {
    const kind = CHECK_BODIES.find(([name]) => name === "CK_Escalamiento_Kind");
    expect(statements()).toContain(
      addCheck("CK_Escalamiento_Kind", kind?.[1] ?? ""),
    );
    expect(readSql()).toContain('length(btrim("Escalamiento"."Nota")) > 0');
  });

  it("only widens: no column, table, delete, update, insert, rename or transaction", () => {
    const sql = readSql();
    expect(sql).not.toMatch(/\bADD COLUMN\b/i);
    expect(sql).not.toMatch(/\bDROP COLUMN\b/i);
    expect(sql).not.toMatch(/\bDROP TABLE\b/i);
    expect(sql).not.toMatch(/\bCREATE TABLE\b/i);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(sql).not.toMatch(/^\s*UPDATE\b/im);
    expect(sql).not.toMatch(/\bINSERT\b/i);
    expect(sql).not.toMatch(/ALTER\s+\S+\s+TYPE/i);
    expect(sql).not.toMatch(/\bALTER COLUMN\b/i);
    expect(sql).not.toMatch(/\bRENAME\b/i);
    expect(sql).not.toMatch(/\bCASCADE\b/i);
    expect(sql).not.toMatch(/\bBEGIN\b/i);
  });

  it("touches only the three motive checks and the open-escalation index", () => {
    const dropped = [...readSql().matchAll(/\bDROP\b[^;]*;/gi)].map(
      (m) => m[0],
    );
    expect(dropped.sort()).toEqual(
      [
        'DROP CONSTRAINT "CK_Escalamiento_Kind";',
        'DROP CONSTRAINT "CK_Escalamiento_SinRespuesta";',
        'DROP CONSTRAINT "CK_Escalamiento_Tipo";',
        'DROP INDEX "UX_Escalamiento_Abierto";',
      ].sort(),
    );
    const named = new Set(
      [...readSql().matchAll(/"((?:CK|UX|IX)_[^"]+)"/g)].map((m) => m[1]),
    );
    expect([...named].sort()).toEqual(
      [
        "CK_Escalamiento_Kind",
        "CK_Escalamiento_SinRespuesta",
        "CK_Escalamiento_Tipo",
        "UX_Escalamiento_Abierto",
      ].sort(),
    );
  });
});
