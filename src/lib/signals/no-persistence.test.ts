// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";

import { getTableColumns, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import * as schema from "@/db/schema";

// Computed on read, nothing persisted (SNAP; "Decision does not store the
// verdict"). A guard: it passes at write and fails the day a column, an audit
// payload or a decision write starts to carry an outcome, a verdict or a
// reason code.

const SIGNAL_WORDS =
  /verdict|veredicto|se[ñn]al|signal|not_?evaluable|extraction_pending|extraction_failed|calendar_not_covering_year|no_period|days_only|field_missing|no_eligible_documents|no_fingerprint|review_carefully|no_alerts|inconclusive/i;

/** Source with its comments removed, so a word in prose is not a field. */
function code(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const tables = Object.values(schema).filter((value) =>
  is(value, PgTable),
) as PgTable[];

describe("the schema stores no signal", () => {
  it("has many tables to check", () => {
    expect(tables.length).toBeGreaterThan(10);
  });

  it("names no column after an outcome, a verdict or a reason code", () => {
    const names = tables.flatMap((table) =>
      Object.entries(getTableColumns(table)).flatMap(([key, column]) => [
        key,
        column.name,
      ]),
    );

    expect(names.length).toBeGreaterThan(100);
    expect(names.filter((name) => SIGNAL_WORDS.test(name))).toEqual([]);
  });

  it("holds no signal word in the schema source, checks included", () => {
    expect(code("src/db/schema.ts").match(SIGNAL_WORDS)).toBeNull();
  });
});

describe("the audit log stores no signal", () => {
  const files = readdirSync("src/lib/audit")
    .filter((name) => /\.ts$/.test(name) && !/\.test\.ts$/.test(name))
    .map((name) => `src/lib/audit/${name}`);

  it.each(files)("%s has no outcome, verdict or reason code", (path) => {
    expect(code(path).match(SIGNAL_WORDS)).toBeNull();
  });

  it("scans the audit sources", () => {
    expect(files).toContain("src/lib/audit/events.ts");
  });
});

describe("the decision write sets only its existing columns", () => {
  const source = code("src/lib/data/solicitud-decision.ts");

  /** The keys of every object literal handed to `.name({ ... })`. */
  function keysOf(call: "set" | "values"): string[][] {
    const pattern = new RegExp(String.raw`\.${call}\(\{([^}]*)\}\)`, "g");
    return [...source.matchAll(pattern)].map((m) =>
      m[1]
        .split(",")
        .map((entry) => entry.trim().split(":")[0].trim())
        .filter(Boolean),
    );
  }

  it("updates only Solicitud columns", () => {
    const columns = Object.keys(getTableColumns(schema.solicitud));
    const sets = keysOf("set");

    expect(sets.length).toBeGreaterThanOrEqual(2);
    for (const keys of sets) {
      expect(keys.length).toBeGreaterThan(0);
      for (const key of keys) expect(columns).toContain(key);
    }
  });

  it("inserts the decision with the existing decision columns and nothing else", () => {
    const columns = Object.keys(getTableColumns(schema.solicitudDecision));
    const inserted = keysOf("values").find((keys) => keys.includes("tipo"));

    expect(inserted).toEqual([
      "solicitudId",
      "tipo",
      "plantillaCodigo",
      "motivoCodigo",
      "texto",
      "revisionId",
      "secretariaId",
      "decididaEn",
    ]);
    for (const key of inserted ?? []) expect(columns).toContain(key);
  });

  it("holds no signal word and no import of the signals", () => {
    expect(source.match(SIGNAL_WORDS)).toBeNull();
    expect(source).not.toMatch(/lib\/signals|data\/signals/);
  });
});
