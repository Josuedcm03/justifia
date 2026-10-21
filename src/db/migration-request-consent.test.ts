import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

// Located by name, never by number: the number is whatever drizzle-kit
// generated as the next migration (RC-2).
const DRIZZLE_DIR = resolve(process.cwd(), "drizzle");
const JOURNAL_PATH = resolve(DRIZZLE_DIR, "meta/_journal.json");

/** `when` of migration 0009 (teacher_remission); ours must be later. */
const LAST_APPLIED_WHEN = 1792429485555;

type Journal = { entries: { tag: string; when: number }[] };

function journal(): Journal {
  return JSON.parse(readFileSync(JOURNAL_PATH, "utf8")) as Journal;
}

function readSql(): string {
  const matches = readdirSync(DRIZZLE_DIR).filter((f) =>
    /^\d{4}_request_consent\.sql$/.test(f),
  );
  expect(matches).toHaveLength(1);
  return readFileSync(resolve(DRIZZLE_DIR, matches[0]), "utf8");
}

/**
 * Collapse whitespace and drop the `"Solicitud".` qualifier drizzle adds inside
 * CHECK predicates, so assertions read like the design (RC-1).
 */
function flat(sql: string): string {
  return sql.replace(/\s+/g, " ").replace(/"Solicitud"\./g, "");
}

// The two predicates of RC-1 as functions, evaluated over the constraint-case
// table below. The SQL bodies are asserted separately, so a drift between the
// design, these functions and the generated SQL fails one of the two tests.
type Row = {
  consentimientoEn: number | null;
  version: string | null;
  presentadaEn: number | null;
};

const bothOrNeither = (r: Row) =>
  (r.consentimientoEn === null) === (r.version === null);

const notAfterPresentation = (r: Row) =>
  r.consentimientoEn === null ||
  (r.presentadaEn !== null && r.consentimientoEn <= r.presentadaEn);

const accepted = (r: Row) => bothOrNeither(r) && notAfterPresentation(r);

describe("request_consent migration (RC-1, RC-2)", () => {
  it("is registered once in the journal, later than the last applied migration", () => {
    const entries = journal().entries.filter((e) =>
      e.tag.endsWith("_request_consent"),
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].when).toBeGreaterThan(LAST_APPLIED_WHEN);
  });

  describe("additive only, no backfill", () => {
    it("never drops, deletes, inserts, updates, retypes or renames", () => {
      const sql = readSql();
      expect(sql).not.toMatch(/\bDROP\b/i);
      expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
      expect(sql).not.toMatch(/\bINSERT\b/i);
      // "ON UPDATE no action" is part of an FK; only a statement counts.
      expect(sql).not.toMatch(/^\s*UPDATE\b/im);
      expect(sql).not.toMatch(/\bALTER COLUMN\b/i);
      expect(sql).not.toMatch(/\bSET NOT NULL\b/i);
      expect(sql).not.toMatch(/\bRENAME\b/i);
      expect(sql).not.toMatch(/ALTER\s+\S+\s+TYPE/i);
    });

    it("creates no table and no index", () => {
      expect(readSql()).not.toMatch(/\bCREATE\s+(TABLE|INDEX|UNIQUE)\b/i);
    });

    it("adds only the two nullable columns, without a default", () => {
      const adds = [
        ...flat(readSql()).matchAll(
          /ALTER TABLE "([^"]+)" ADD COLUMN "([^"]+)" ([^;]+);/g,
        ),
      ].map((m) => `${m[1]}.${m[2]} ${m[3].trim()}`);
      expect(adds.sort()).toEqual(
        [
          "Solicitud.ConsentimientoEn timestamp with time zone",
          "Solicitud.ConsentimientoVersion varchar(20)",
        ].sort(),
      );
    });

    it("adds only the two CHECK constraints", () => {
      const constraints = [
        ...flat(readSql()).matchAll(/ADD CONSTRAINT "([^"]+)"/g),
      ].map((m) => m[1]);
      expect(constraints.sort()).toEqual([
        "CK_Solicitud_Consentimiento",
        "CK_Solicitud_ConsentimientoFecha",
      ]);
    });
  });

  describe("CK_Solicitud_Consentimiento (both or neither)", () => {
    it("compares the nullness of the two columns", () => {
      expect(flat(readSql())).toMatch(
        /ALTER TABLE "Solicitud" ADD CONSTRAINT "CK_Solicitud_Consentimiento" CHECK \(\("ConsentimientoEn" IS NULL\) = \("ConsentimientoVersion" IS NULL\)\);/,
      );
    });

    it.each([
      [
        "both set",
        { consentimientoEn: 5, version: "2026-10-20", presentadaEn: 5 },
        true,
      ],
      [
        "only the version set",
        { consentimientoEn: null, version: "2026-10-20", presentadaEn: 5 },
        false,
      ],
      [
        "only the instant set",
        { consentimientoEn: 5, version: null, presentadaEn: 5 },
        false,
      ],
      [
        "both empty (legacy)",
        { consentimientoEn: null, version: null, presentadaEn: 5 },
        true,
      ],
    ] as [string, Row, boolean][])("%s", (_name, row, expected) => {
      expect(bothOrNeither(row)).toBe(expected);
    });
  });

  describe("CK_Solicitud_ConsentimientoFecha (not after the presentation)", () => {
    it("allows consent only on a presented request, at or before its time", () => {
      expect(flat(readSql())).toMatch(
        /ALTER TABLE "Solicitud" ADD CONSTRAINT "CK_Solicitud_ConsentimientoFecha" CHECK \("ConsentimientoEn" IS NULL OR \("PresentadaEn" IS NOT NULL AND "ConsentimientoEn" <= "PresentadaEn"\)\);/,
      );
    });

    it.each([
      [
        "same instant as the presentation",
        { consentimientoEn: 5, version: "v", presentadaEn: 5 },
        true,
      ],
      [
        "earlier than the presentation",
        { consentimientoEn: 4, version: "v", presentadaEn: 5 },
        true,
      ],
      [
        "later than the presentation",
        { consentimientoEn: 6, version: "v", presentadaEn: 5 },
        false,
      ],
      [
        "on a draft (never presented)",
        { consentimientoEn: 5, version: "v", presentadaEn: null },
        false,
      ],
      [
        "legacy request, nothing recorded",
        { consentimientoEn: null, version: null, presentadaEn: 5 },
        true,
      ],
      [
        "draft, nothing recorded",
        { consentimientoEn: null, version: null, presentadaEn: null },
        true,
      ],
    ] as [string, Row, boolean][])("%s", (_name, row, expected) => {
      expect(notAfterPresentation(row)).toBe(expected);
      expect(accepted(row)).toBe(expected);
    });
  });
});
