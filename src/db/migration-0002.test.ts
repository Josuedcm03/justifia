import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { rolesUsuario } from "@/lib/validations/auth";

const SQL_PATH = resolve(process.cwd(), "drizzle/0002_roles_lookup_table.sql");
const JOURNAL_PATH = resolve(process.cwd(), "drizzle/meta/_journal.json");

function readMigrationSql(): string {
  return readFileSync(SQL_PATH, "utf8");
}

describe("drizzle/0002_roles_lookup_table.sql (UR: Migration guarantees)", () => {
  it("inserts all 5 role codes before the backfill UPDATE", () => {
    const sql = readMigrationSql();
    const insertIndex = sql.indexOf('INSERT INTO "Rol"');
    const updateIndex = sql.indexOf('UPDATE "Usuario"');
    expect(insertIndex).toBeGreaterThanOrEqual(0);
    expect(updateIndex).toBeGreaterThan(insertIndex);
    for (const codigo of rolesUsuario) {
      expect(sql).toContain(`'${codigo}'`);
    }
  });

  it("orders the 7 statements exactly: CREATE, INSERT, ADD COLUMN, UPDATE, SET NOT NULL, ADD CONSTRAINT, DROP COLUMN Rol last", () => {
    const sql = readMigrationSql();
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    expect(statements).toHaveLength(7);
    expect(statements[0]).toMatch(/^CREATE TABLE "Rol"/);
    expect(statements[1]).toMatch(/^INSERT INTO "Rol"/);
    expect(statements[2]).toMatch(/^ALTER TABLE "Usuario" ADD COLUMN "RolId"/);
    expect(statements[3]).toMatch(/^UPDATE "Usuario"/);
    expect(statements[4]).toMatch(
      /^ALTER TABLE "Usuario" ALTER COLUMN "RolId" SET NOT NULL/,
    );
    expect(statements[5]).toMatch(
      /^ALTER TABLE "Usuario" ADD CONSTRAINT .* FOREIGN KEY \("RolId"\)/,
    );
    expect(statements[6]).toMatch(/^ALTER TABLE "Usuario" DROP COLUMN "Rol"/);
  });

  it("has exactly 6 statement-breakpoints", () => {
    const sql = readMigrationSql();
    const count = sql.split("--> statement-breakpoint").length - 1;
    expect(count).toBe(6);
  });

  it("never hand-writes BEGIN or COMMIT (the driver's own transaction wraps every pending migration)", () => {
    const sql = readMigrationSql();
    expect(sql).not.toMatch(/\bBEGIN\b/i);
    expect(sql).not.toMatch(/\bCOMMIT\b/i);
  });
});

describe("drizzle/meta/_journal.json", () => {
  it("has a 0002 entry", () => {
    const journal = JSON.parse(readFileSync(JOURNAL_PATH, "utf8")) as {
      entries: { tag: string }[];
    };
    const entry = journal.entries.find((e) => e.tag.startsWith("0002_"));
    expect(entry).toBeDefined();
  });
});
