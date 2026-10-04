import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const SQL_PATH = resolve(process.cwd(), "drizzle/0004_audit_log.sql");
const JOURNAL_PATH = resolve(process.cwd(), "drizzle/meta/_journal.json");

// NOTE (D20 gotcha): unlike migration-0002.test.ts this file must NOT assert
// /\bBEGIN\b/ is absent: the plpgsql trigger function body legitimately
// contains BEGIN ... END. Transaction control is checked outside the $$ body.

function readSql(): string {
  return readFileSync(SQL_PATH, "utf8");
}

function statements(sql: string): string[] {
  return sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);
}

function stripDollarBodies(sql: string): string {
  return sql.replace(/\$\$[\s\S]*?\$\$/g, "$$$$");
}

function stripComments(sql: string): string {
  return sql.replace(/^\s*--.*$/gm, "");
}

/** Every `"EventoAuditoria_x" PARTITION OF` name, in file order. */
function partitionNames(sql: string): string[] {
  return [
    ...sql.matchAll(
      /CREATE TABLE "(EventoAuditoria_[A-Za-z0-9]+)" PARTITION OF/g,
    ),
  ].map((m) => m[1]);
}

/** Targets of every `BEFORE TRUNCATE ON "x"` trigger. */
function truncateTriggerTargets(sql: string): string[] {
  return [...sql.matchAll(/BEFORE TRUNCATE ON "([^"]+)"/g)].map((m) => m[1]);
}

interface Bound {
  name: string;
  from: string;
  to: string;
}

function parseBounds(sql: string): Bound[] {
  return [
    ...sql.matchAll(
      /CREATE TABLE "(EventoAuditoria_\d{4})" PARTITION OF "EventoAuditoria"\s+FOR VALUES FROM \('([^']+)'\) TO \('([^']+)'\)/g,
    ),
  ].map((m) => ({ name: m[1], from: m[2], to: m[3] }));
}

describe("drizzle/0004_audit_log.sql (AL: Audit records are append-only)", () => {
  it("creates EventoAuditoria partitioned by range on OcurridoEn", () => {
    expect(readSql()).toMatch(
      /CREATE TABLE "EventoAuditoria" \([\s\S]*?\) PARTITION BY RANGE \("OcurridoEn"\)/,
    );
  });

  it('has the composite primary key ("Id", "OcurridoEn")', () => {
    expect(readSql()).toMatch(/PRIMARY KEY \("Id", "OcurridoEn"\)/);
  });

  it("has contiguous yearly bounds with explicit +00 covering 2026..2031", () => {
    const bounds = parseBounds(readSql());
    expect(bounds.length).toBeGreaterThanOrEqual(5);
    for (const b of bounds) {
      expect(b.from).toMatch(/\+00$/);
      expect(b.to).toMatch(/\+00$/);
    }
    for (let i = 1; i < bounds.length; i++) {
      expect(bounds[i].from).toBe(bounds[i - 1].to);
    }
    expect(bounds[0].from).toMatch(/^2026-01-01 00:00:00\+00$/);
    expect(bounds[bounds.length - 1].to).toMatch(/^2031-01-01 00:00:00\+00$/);
    // Names follow the year in the lower bound.
    for (const b of bounds) {
      expect(b.name).toBe(`EventoAuditoria_${b.from.slice(0, 4)}`);
    }
  });

  it("has exactly one DEFAULT partition", () => {
    const defaults = [
      ...readSql().matchAll(
        /CREATE TABLE "[^"]+" PARTITION OF "EventoAuditoria" DEFAULT/g,
      ),
    ];
    expect(defaults).toHaveLength(1);
  });

  it("defines exactly one function", () => {
    expect(readSql().match(/CREATE (OR REPLACE )?FUNCTION/g)).toHaveLength(1);
  });

  it("has exactly one BEFORE UPDATE OR DELETE row trigger, on the parent (cloned into partitions)", () => {
    const triggers = [
      ...readSql().matchAll(
        /CREATE TRIGGER "[^"]+"\s+BEFORE UPDATE OR DELETE ON "([^"]+)"\s+FOR EACH ROW/g,
      ),
    ];
    expect(triggers).toHaveLength(1);
    expect(triggers[0][1]).toBe("EventoAuditoria");
  });

  it("puts a BEFORE TRUNCATE trigger on every partition (statement triggers are not cloned)", () => {
    const sql = readSql();
    const partitions = partitionNames(sql).sort();
    expect(partitions.length).toBeGreaterThanOrEqual(6);
    const targets = truncateTriggerTargets(sql).filter(
      (t) => t !== "EventoAuditoria",
    );
    expect(targets.sort()).toEqual(partitions);
  });

  it("raises 42501 from the guard function", () => {
    const sql = readSql();
    expect(sql).toMatch(/RAISE EXCEPTION/);
    expect(sql).toMatch(/ERRCODE = '42501'/);
  });

  it("revokes UPDATE, DELETE, TRUNCATE once per relation (parent + every partition)", () => {
    const sql = readSql();
    const revoked = [
      ...sql.matchAll(
        /REVOKE UPDATE, DELETE, TRUNCATE ON "([^"]+)" FROM PUBLIC/g,
      ),
    ].map((m) => m[1]);
    expect(revoked.sort()).toEqual(
      ["EventoAuditoria", ...partitionNames(sql)].sort(),
    );
  });

  it("keeps the $$ body in one drizzle statement (no breakpoint inside)", () => {
    const bodies = [...readSql().matchAll(/\$\$[\s\S]*?\$\$/g)].map(
      (m) => m[0],
    );
    expect(bodies.length).toBeGreaterThanOrEqual(1);
    for (const body of bodies) {
      expect(body).not.toContain("--> statement-breakpoint");
    }
    // The function statement is exactly one chunk.
    const fnChunks = statements(readSql()).filter((s) =>
      /CREATE (OR REPLACE )?FUNCTION/.test(s),
    );
    expect(fnChunks).toHaveLength(1);
  });

  it("has no transaction control outside the dollar-quoted body", () => {
    const outside = stripComments(stripDollarBodies(readSql()));
    expect(outside).not.toMatch(/\b(BEGIN|COMMIT|ROLLBACK)\b/i);
  });

  it("only creates: no INSERT, DELETE or DROP of pre-existing objects", () => {
    const outside = stripComments(stripDollarBodies(readSql()));
    expect(outside).not.toMatch(/\bINSERT\b/i);
    expect(outside).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(outside).not.toMatch(/\bDROP\b/i);
  });
});

// Evidence-gated assertions (task 2.14). Their form was decided by rehearsal
// probes on Neon branch `rehearsal-audit` (PostgreSQL 18):
//   S1: GENERATED ALWAYS AS IDENTITY on a partitioned parent with PRIMARY KEY
//       (id, t) is accepted, so no CREATE SEQUENCE fallback.
//   S2: BEFORE TRUNCATE ... FOR EACH STATEMENT is accepted on the partitioned
//       parent; statement triggers are NOT cloned to partitions, so the parent
//       AND every partition need their own.
describe("0004 evidence-gated assertions (probes S1, S2)", () => {
  it('declares "Id" as GENERATED ALWAYS AS IDENTITY (S1) and no sequence fallback', () => {
    const sql = readSql();
    expect(sql).toMatch(/"Id" bigint GENERATED ALWAYS AS IDENTITY/);
    expect(sql).not.toMatch(/CREATE SEQUENCE/i);
    expect(sql).not.toMatch(/nextval/i);
  });

  it("has a BEFORE TRUNCATE trigger on the parent AND on every partition (S2)", () => {
    const sql = readSql();
    const expected = ["EventoAuditoria", ...partitionNames(sql)].sort();
    expect(truncateTriggerTargets(sql).sort()).toEqual(expected);
  });
});

describe("drizzle/meta/_journal.json", () => {
  it("has a 0004 entry after 0003", () => {
    const journal = JSON.parse(readFileSync(JOURNAL_PATH, "utf8")) as {
      entries: { tag: string }[];
    };
    const tags = journal.entries.map((e) => e.tag);
    const i3 = tags.findIndex((t) => t.startsWith("0003_"));
    const i4 = tags.findIndex((t) => t === "0004_audit_log");
    expect(i4).toBeGreaterThan(i3);
  });
});
