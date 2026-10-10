import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { DIAS_MASK_MAX } from "@/lib/catalog/dias";

const DRIZZLE_DIR = resolve(process.cwd(), "drizzle");
const JOURNAL_PATH = resolve(DRIZZLE_DIR, "meta/_journal.json");
const SNAPSHOT_0005 = resolve(DRIZZLE_DIR, "meta/0005_snapshot.json");
const SNAPSHOT_0006 = resolve(DRIZZLE_DIR, "meta/0006_snapshot.json");

/** The `0006_*.sql` file is generated, so its name is looked up, never hardcoded. */
function readSql(): string {
  const files = readdirSync(DRIZZLE_DIR).filter((f) =>
    /^0006_.+\.sql$/.test(f),
  );
  if (files.length !== 1) {
    throw new Error(
      `expected exactly one drizzle/0006_*.sql, found ${files.length}`,
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

describe("drizzle/0006_*.sql (AC-DIAS-ADD: Existing data survives, Old code keeps working)", () => {
  it("is exactly the two expected statements", () => {
    expect(statements(readSql())).toHaveLength(2);
  });

  it("adds Grupo.Dias as smallint DEFAULT 0 NOT NULL, first", () => {
    const [first] = statements(readSql());
    expect(first).toContain(
      'ALTER TABLE "Grupo" ADD COLUMN "Dias" smallint DEFAULT 0 NOT NULL',
    );
  });

  it("adds CK_Grupo_Dias between 0 and DIAS_MASK_MAX, second", () => {
    const second = statements(readSql())[1];
    const m = second?.match(
      /^ALTER TABLE "Grupo" ADD CONSTRAINT "CK_Grupo_Dias" CHECK \(([^;]*)\)\s*;?$/,
    );
    expect(m).not.toBeNull();
    expect(m![1]).toMatch(/\bbetween\b/i);
    const bounds = [...m![1].matchAll(/\b\d+\b/g)].map((x) => Number(x[0]));
    expect(bounds).toEqual([0, DIAS_MASK_MAX]);
  });

  it("is purely additive: no DROP, RENAME, ALTER COLUMN, data change or transaction control", () => {
    const sql = stripComments(readSql());
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(sql).not.toMatch(/\bRENAME\b/i);
    expect(sql).not.toMatch(/\bALTER\s+COLUMN\b/i);
    expect(sql).not.toMatch(/\bUPDATE\b/i);
    expect(sql).not.toMatch(/\bINSERT\b/i);
    expect(sql).not.toMatch(/\bDELETE\b/i);
    expect(sql).not.toMatch(/\b(BEGIN|COMMIT|ROLLBACK)\b/i);
  });

  it("touches neither the audit table, Asignatura, CK_Grupo_Origen nor a unique constraint", () => {
    const sql = readSql();
    expect(sql).not.toMatch(/EventoAuditoria/);
    expect(sql).not.toMatch(/Asignatura/);
    expect(sql).not.toMatch(/CK_Grupo_Origen/);
    expect(sql).not.toMatch(/\bUNIQUE\b/i);
  });
});

describe("drizzle/meta for 0006", () => {
  it("has a journal entry with idx 6 whose tag names a 0006_ file", () => {
    const journal = JSON.parse(readFileSync(JOURNAL_PATH, "utf8")) as {
      entries: { idx: number; tag: string }[];
    };
    const entry = journal.entries.find((e) => e.idx === 6);
    expect(entry).toBeDefined();
    expect(entry!.tag).toMatch(/^0006_/);
  });

  it("has a snapshot chained to the 0005 snapshot and free of EventoAuditoria", () => {
    expect(existsSync(SNAPSHOT_0006)).toBe(true);
    const prev = JSON.parse(readFileSync(SNAPSHOT_0005, "utf8")) as {
      id: string;
    };
    const next = JSON.parse(readFileSync(SNAPSHOT_0006, "utf8")) as {
      prevId: string;
    };
    expect(next.prevId).toBe(prev.id);
    expect(readFileSync(SNAPSHOT_0006, "utf8")).not.toContain(
      "EventoAuditoria",
    );
  });
});
