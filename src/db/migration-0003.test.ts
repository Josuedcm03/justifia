import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const DRIZZLE_DIR = resolve(process.cwd(), "drizzle");
const JOURNAL_PATH = resolve(DRIZZLE_DIR, "meta/_journal.json");

function readMigrationSql(): string {
  const file = readdirSync(DRIZZLE_DIR).find((f) => /^0003_.*\.sql$/.test(f));
  if (!file) throw new Error("drizzle/0003_*.sql not found");
  return readFileSync(resolve(DRIZZLE_DIR, file), "utf8");
}

describe("drizzle/0003_*.sql (AC: Additive schema and existing-data safety)", () => {
  it("creates the three new tables", () => {
    const sql = readMigrationSql();
    for (const table of ["Asignatura", "Grupo", "Inscripcion"]) {
      expect(sql).toContain(`CREATE TABLE "${table}"`);
    }
  });

  it("adds DebeCambiarClave as boolean DEFAULT false NOT NULL (existing rows survive)", () => {
    expect(readMigrationSql()).toMatch(
      /ALTER TABLE "Usuario" ADD COLUMN "DebeCambiarClave" boolean DEFAULT false NOT NULL/,
    );
  });

  it('adds a unique constraint on "Usuario"."Correo" (multiple NULLs still coexist)', () => {
    expect(readMigrationSql()).toMatch(
      /ALTER TABLE "Usuario" ADD CONSTRAINT "[^"]+" UNIQUE\("Correo"\)/,
    );
  });

  it("carries the CK_Asignatura_Horas CHECK", () => {
    expect(readMigrationSql()).toMatch(
      /CONSTRAINT "CK_Asignatura_Horas" CHECK \("Asignatura"\."HorasTotales" > 0\)/,
    );
  });

  it("creates the four named indexes, with the partial WHERE on IX_Grupo_Activo only", () => {
    const sql = readMigrationSql();
    for (const name of [
      "IX_Grupo_Docente",
      "IX_Grupo_Activo",
      "IX_Inscripcion_Grupo",
    ]) {
      expect(sql).toContain(`CREATE INDEX "${name}"`);
    }
    expect(sql).toMatch(
      /CREATE INDEX "IX_Grupo_Activo" ON "Grupo" USING btree \("AsignaturaId","Periodo"\) WHERE "Grupo"\."Activo"/,
    );
    expect(sql).not.toMatch(/CREATE INDEX "IX_Inscripcion_Grupo"[^;]*WHERE/);
  });

  it("is purely additive: no DROP, RENAME, column type change or transaction control", () => {
    const sql = readMigrationSql();
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(sql).not.toMatch(/\bRENAME\b/i);
    expect(sql).not.toMatch(/ALTER COLUMN[^;]*\bTYPE\b/i);
    expect(sql).not.toMatch(/\bBEGIN\b/i);
    expect(sql).not.toMatch(/\bCOMMIT\b/i);
  });

  it("does not create the audit table (D20/D26: it lives in 0004)", () => {
    expect(readMigrationSql()).not.toContain("EventoAuditoria");
  });
});

describe("drizzle/meta/_journal.json", () => {
  it("has a 0003 entry", () => {
    const journal = JSON.parse(readFileSync(JOURNAL_PATH, "utf8")) as {
      entries: { tag: string }[];
    };
    expect(
      journal.entries.find((e) => e.tag.startsWith("0003_")),
    ).toBeDefined();
  });
});
