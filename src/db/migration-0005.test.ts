import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { GRUPO_ORIGENES } from "@/lib/catalog/origen";

const DRIZZLE_DIR = resolve(process.cwd(), "drizzle");
const JOURNAL_PATH = resolve(DRIZZLE_DIR, "meta/_journal.json");
const SNAPSHOT_0004 = resolve(DRIZZLE_DIR, "meta/0004_snapshot.json");
const SNAPSHOT_0005 = resolve(DRIZZLE_DIR, "meta/0005_snapshot.json");

/** The `0005_*.sql` file is generated, so its name is looked up, never hardcoded. */
function readSql(): string {
  const files = readdirSync(DRIZZLE_DIR).filter((f) =>
    /^0005_.+\.sql$/.test(f),
  );
  if (files.length !== 1) {
    throw new Error(
      `expected exactly one drizzle/0005_*.sql, found ${files.length}`,
    );
  }
  return readFileSync(resolve(DRIZZLE_DIR, files[0]), "utf8");
}

function statements(sql: string): string[] {
  return sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);
}

function stripComments(sql: string): string {
  return sql.replace(/^\s*--.*$/gm, "");
}

describe("drizzle/0005_*.sql (AC-ADD: Existing data survives, Old code keeps working)", () => {
  it("adds Asignatura.Activo as boolean DEFAULT true NOT NULL", () => {
    expect(readSql()).toContain(
      'ALTER TABLE "Asignatura" ADD COLUMN "Activo" boolean DEFAULT true NOT NULL',
    );
  });

  it("adds Grupo.Origen as varchar(12) DEFAULT 'importacion' NOT NULL", () => {
    expect(readSql()).toContain(
      `ALTER TABLE "Grupo" ADD COLUMN "Origen" varchar(12) DEFAULT 'importacion' NOT NULL`,
    );
  });

  it("adds CK_Grupo_Origen listing exactly GRUPO_ORIGENES, in order", () => {
    const m = readSql().match(
      /ADD CONSTRAINT "CK_Grupo_Origen" CHECK \(([^;]*)\)\s*;/,
    );
    expect(m).not.toBeNull();
    const listed = [...m![1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    expect(listed).toEqual([...GRUPO_ORIGENES]);
  });

  it("is exactly the three expected statements", () => {
    expect(statements(readSql())).toHaveLength(3);
  });

  it("is purely additive: no DROP, RENAME, type change, data change or transaction control", () => {
    const sql = stripComments(readSql());
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(sql).not.toMatch(/\bRENAME\b/i);
    expect(sql).not.toMatch(/\bALTER\s+COLUMN\b[^;]*\bTYPE\b/i);
    expect(sql).not.toMatch(/\bUPDATE\b/i);
    expect(sql).not.toMatch(/\bINSERT\b/i);
    expect(sql).not.toMatch(/\bDELETE\b/i);
    expect(sql).not.toMatch(/\b(BEGIN|COMMIT|ROLLBACK)\b/i);
  });

  it("never touches the audit table", () => {
    expect(readSql()).not.toMatch(/EventoAuditoria/);
  });
});

describe("drizzle/meta for 0005", () => {
  it("has a journal entry with idx 5 whose tag names a 0005_ file", () => {
    const journal = JSON.parse(readFileSync(JOURNAL_PATH, "utf8")) as {
      entries: { idx: number; tag: string }[];
    };
    const entry = journal.entries.find((e) => e.idx === 5);
    expect(entry).toBeDefined();
    expect(entry!.tag).toMatch(/^0005_/);
  });

  it("has a snapshot chained to the 0004 snapshot and free of EventoAuditoria", () => {
    expect(existsSync(SNAPSHOT_0005)).toBe(true);
    const prev = JSON.parse(readFileSync(SNAPSHOT_0004, "utf8")) as {
      id: string;
    };
    const next = JSON.parse(readFileSync(SNAPSHOT_0005, "utf8")) as {
      prevId: string;
    };
    expect(next.prevId).toBe(prev.id);
    expect(readFileSync(SNAPSHOT_0005, "utf8")).not.toContain(
      "EventoAuditoria",
    );
  });
});
