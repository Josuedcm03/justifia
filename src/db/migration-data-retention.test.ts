import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { SYSTEM_HASH, SYSTEM_LOGIN } from "@/lib/retention/policy";

// Located by name, never by number: the number is whatever drizzle-kit
// generated as the next migration (DR-2, DR-3, DR-6).
const DRIZZLE_DIR = resolve(process.cwd(), "drizzle");
const JOURNAL_PATH = resolve(DRIZZLE_DIR, "meta/_journal.json");

/**
 * `when` of migration 0013 (validation signals, applied in production); ours
 * must be later, or the drizzle migrator skips it.
 */
const LAST_APPLIED_WHEN = 1793660241921;

type Journal = { entries: { tag: string; when: number }[] };

function journal(): Journal {
  return JSON.parse(readFileSync(JOURNAL_PATH, "utf8")) as Journal;
}

function readSql(): string {
  const matches = readdirSync(DRIZZLE_DIR).filter((f) =>
    /^\d{4}_data_retention\.sql$/.test(f),
  );
  expect(matches).toHaveLength(1);
  return readFileSync(resolve(DRIZZLE_DIR, matches[0]), "utf8");
}

/** Collapse whitespace and drop the table qualifier drizzle adds in CHECKs. */
function flat(sql: string): string {
  return sql.replace(/\s+/g, " ").replace(/"Usuario"\./g, "");
}

/** Statements without comment lines, split on drizzle's breakpoint marker. */
function statements(): string[] {
  return readSql()
    .split("--> statement-breakpoint")
    .map((s) =>
      s
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter(Boolean);
}

const PARTITION_YEARS = [2031, 2032, 2033, 2034, 2035];

describe("data-retention migration (DR-2, DR-3, DR-6, D1, D3, D7, D8)", () => {
  it("is registered once in the journal, later than the last applied migration", () => {
    const entries = journal().entries.filter((e) =>
      e.tag.endsWith("_data_retention"),
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].tag).toBe("0014_data_retention");
    expect(entries[0].when).toBeGreaterThan(LAST_APPLIED_WHEN);
  });

  it("adds exactly two nullable timestamptz columns, with no default", () => {
    const adds = [
      ...flat(readSql()).matchAll(
        /ALTER TABLE "([^"]+)" ADD COLUMN "([^"]+)" ([^;]+);/g,
      ),
    ].map((m) => `${m[1]}.${m[2]} ${m[3].trim()}`);
    expect(adds.sort()).toEqual([
      "Solicitud.CanceladaEn timestamp with time zone",
      "Usuario.CanceladoEn timestamp with time zone",
    ]);
  });

  it("requires a cancelled account to be anonymous and inactive (CK_Usuario_Cancelado)", () => {
    expect(flat(readSql())).toContain(
      `ALTER TABLE "Usuario" ADD CONSTRAINT "CK_Usuario_Cancelado" CHECK ("CanceladoEn" IS NULL OR (NOT "Activo" AND "Correo" IS NULL AND "Telefono" IS NULL AND "Cif" IS NULL));`,
    );
  });

  it("inserts exactly one row into Usuario: the system account, by policy constants, with no literal Id", () => {
    const inserts = statements().filter((s) => /\bINSERT\b/i.test(s));
    expect(inserts).toHaveLength(1);
    const insert = flat(inserts[0]);
    expect(insert).toMatch(/^INSERT INTO "Usuario" \(/);
    expect(insert).toContain(
      `("Login", "HashClave", "RolId", "NombreCompleto", "Activo", "DebeCambiarClave")`,
    );
    expect(insert).toContain(`'${SYSTEM_LOGIN}'`);
    expect(insert).toContain(`'${SYSTEM_HASH}'`);
    expect(insert).toContain(`'Sistema (tarea programada)'`);
    expect(insert).toContain(`FROM "Rol" r WHERE r."Codigo" = 'administrador'`);
    // The role is looked up and the identity column is left to its sequence.
    expect(insert).not.toMatch(/\("[^)]*"Id"[^)]*\)\s+SELECT/);
    expect(insert).not.toMatch(/OVERRIDING/i);
    expect(insert.trim()).toMatch(/ON CONFLICT \("Login"\) DO NOTHING;?$/);
  });

  it("creates the five contiguous 2031-2035 partitions with +00 bounds", () => {
    const parts = [
      ...flat(readSql()).matchAll(
        /CREATE TABLE "EventoAuditoria_(\d{4})" PARTITION OF "EventoAuditoria" FOR VALUES FROM \('(\d{4}-\d{2}-\d{2} [\d:]+\+00)'\) TO \('(\d{4}-\d{2}-\d{2} [\d:]+\+00)'\);/g,
      ),
    ].map((m) => ({ year: Number(m[1]), from: m[2], to: m[3] }));
    expect(parts.map((p) => p.year)).toEqual(PARTITION_YEARS);
    for (const p of parts) {
      expect(p.from).toBe(`${p.year}-01-01 00:00:00+00`);
      expect(p.to).toBe(`${p.year + 1}-01-01 00:00:00+00`);
    }
    expect(parts[0].from).toBe("2031-01-01 00:00:00+00");
    expect(parts[parts.length - 1].to).toBe("2036-01-01 00:00:00+00");
  });

  it("gives each new partition its truncate trigger and a REVOKE", () => {
    const sql = flat(readSql());
    for (const year of PARTITION_YEARS) {
      expect(sql).toContain(
        `CREATE TRIGGER "TR_EventoAuditoria_${year}_truncate" BEFORE TRUNCATE ON "EventoAuditoria_${year}" FOR EACH STATEMENT EXECUTE FUNCTION "fn_EventoAuditoria_inmutable"();`,
      );
      expect(sql).toContain(
        `REVOKE UPDATE, DELETE, TRUNCATE ON "EventoAuditoria_${year}" FROM PUBLIC;`,
      );
    }
  });

  it("adds no new default partition, function or row trigger", () => {
    const sql = readSql();
    expect(sql).not.toMatch(/\bDEFAULT\b/i);
    expect(sql).not.toMatch(/\bCREATE\s+(OR\s+REPLACE\s+)?FUNCTION\b/i);
    expect(sql).not.toMatch(/\bFOR EACH ROW\b/i);
  });

  it("is purely additive: no drop, delete, update, retype, rename, cascade or transaction", () => {
    const sql = readSql();
    expect(sql).not.toMatch(/\bDROP\b/i);
    // The REVOKE names DELETE and UPDATE as privileges; only statements count.
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(sql).not.toMatch(/^\s*UPDATE\b/im);
    expect(sql).not.toMatch(/ALTER\s+\S+\s+TYPE/i);
    expect(sql).not.toMatch(/\bALTER COLUMN\b/i);
    expect(sql).not.toMatch(/\bRENAME\b/i);
    expect(sql).not.toMatch(/\bCASCADE\b/i);
    expect(sql).not.toMatch(/\bBEGIN\b/i);
  });

  it("holds exactly the planned statements: 2 columns, 1 check, 1 insert, 5 partitions, 5 triggers, 5 revokes", () => {
    const all = statements();
    expect(all).toHaveLength(19);
    const counts: Record<string, number> = {};
    for (const s of all) {
      const match = s.match(
        /^(ALTER TABLE "[^"]+" ADD (?:COLUMN|CONSTRAINT)|INSERT INTO "Usuario"|CREATE TABLE "EventoAuditoria_\d{4}"|CREATE TRIGGER|REVOKE)/,
      );
      const key = (match?.[1] ?? `UNKNOWN: ${s.slice(0, 40)}`).replace(
        /_\d{4}/,
        "_YYYY",
      );
      counts[key] = (counts[key] ?? 0) + 1;
    }
    expect(counts).toEqual({
      'ALTER TABLE "Usuario" ADD COLUMN': 1,
      'ALTER TABLE "Solicitud" ADD COLUMN': 1,
      'ALTER TABLE "Usuario" ADD CONSTRAINT': 1,
      'INSERT INTO "Usuario"': 1,
      'CREATE TABLE "EventoAuditoria_YYYY"': 5,
      "CREATE TRIGGER": 5,
      REVOKE: 5,
    });
  });
});
