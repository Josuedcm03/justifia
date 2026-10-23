import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { REMISSION_REASONS, REMISSION_STATES } from "@/lib/remission/states";

// Located by name, never by number: the number is whatever drizzle-kit
// generated as the next migration (TR-3).
const DRIZZLE_DIR = resolve(process.cwd(), "drizzle");
const JOURNAL_PATH = resolve(DRIZZLE_DIR, "meta/_journal.json");

/** `when` of migration 0008 (secretary_review); ours must be later. */
const LAST_APPLIED_WHEN = 1791852138908;

type Journal = { entries: { tag: string; when: number }[] };

function journal(): Journal {
  return JSON.parse(readFileSync(JOURNAL_PATH, "utf8")) as Journal;
}

function findMigrationFile(): string {
  const matches = readdirSync(DRIZZLE_DIR).filter((f) =>
    /^\d{4}_teacher_remission\.sql$/.test(f),
  );
  expect(matches).toHaveLength(1);
  return resolve(DRIZZLE_DIR, matches[0]);
}

function readSql(): string {
  return readFileSync(findMigrationFile(), "utf8");
}

/** The CREATE TABLE statement of one table, up to its statement end. */
function tableSql(sql: string, table: string): string {
  const match = sql.match(
    new RegExp(`CREATE TABLE "${table}" \\([\\s\\S]*?\\n\\);`),
  );
  expect(match, `CREATE TABLE "${table}" missing`).not.toBeNull();
  return match![0];
}

/**
 * Collapse whitespace and drop the `"Table".` qualifier drizzle adds inside
 * CHECK and index predicates, so assertions read like the design.
 */
function flat(sql: string): string {
  return sql
    .replace(/\s+/g, " ")
    .replace(/"(?:Remision|Solicitud|DocumentoRespaldo)"\./g, "");
}

/** The quoted values listed inside one named CHECK. */
function checkValues(sql: string, constraint: string): string[] {
  const match = flat(sql).match(
    new RegExp(`CONSTRAINT "${constraint}" CHECK \\(([^)]*)\\)`),
  );
  expect(match, `${constraint} missing`).not.toBeNull();
  return [...match![1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}

describe("teacher_remission migration (TR-1, TR-3)", () => {
  it("is registered once in the journal, later than the last applied migration", () => {
    const entries = journal().entries.filter((e) =>
      e.tag.endsWith("_teacher_remission"),
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].when).toBeGreaterThan(LAST_APPLIED_WHEN);
  });

  it("creates exactly one new table", () => {
    const creates = [...readSql().matchAll(/CREATE TABLE "([^"]+)"/g)].map(
      (m) => m[1],
    );
    expect(creates).toEqual(["Remision"]);
  });

  describe("additive only", () => {
    it("never drops, deletes, inserts, updates or retypes existing objects", () => {
      const sql = readSql();
      expect(sql).not.toMatch(/\bDROP\b/i);
      expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
      expect(sql).not.toMatch(/\bINSERT\b/i);
      // "ON UPDATE no action" is part of every FK; only a statement counts.
      expect(sql).not.toMatch(/^\s*UPDATE\b/im);
      expect(sql).not.toMatch(/\bALTER COLUMN\b/i);
      expect(sql).not.toMatch(/\bSET NOT NULL\b/i);
      expect(sql).not.toMatch(/\bRENAME\b/i);
      expect(sql).not.toMatch(/ALTER\s+\S+\s+TYPE/i);
    });

    it("adds only the three columns to existing tables", () => {
      const adds = [
        ...flat(readSql()).matchAll(
          /ALTER TABLE "([^"]+)" ADD COLUMN "([^"]+)" ([^;]+);/g,
        ),
      ].map((m) => `${m[1]}.${m[2]} ${m[3].trim()}`);
      expect(adds.sort()).toEqual(
        [
          "DocumentoRespaldo.FormatoEspecial boolean DEFAULT false NOT NULL",
          "DocumentoRespaldo.SubidoPorId bigint",
          "Solicitud.FormatoEspecial boolean DEFAULT false NOT NULL",
        ].sort(),
      );
    });

    it("never cascades a delete: a decided request is never erased", () => {
      expect(readSql()).not.toMatch(/ON DELETE cascade/i);
    });
  });

  describe("Remision", () => {
    it("holds the per-teacher snapshot and the claim columns", () => {
      const t = flat(tableSql(readSql(), "Remision"));
      expect(t).toMatch(/"Id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY/);
      expect(t).toMatch(/"SolicitudId" bigint NOT NULL/);
      expect(t).toMatch(/"DocenteId" bigint NOT NULL/);
      expect(t).toMatch(/"DocenteNombre" varchar\(160\) NOT NULL/);
      expect(t).toMatch(/"Correo" varchar\(160\)(?! NOT NULL)/);
      expect(t).toMatch(/"Clases" jsonb NOT NULL/);
      expect(t).toMatch(/"Estado" varchar\(20\) DEFAULT 'pendiente' NOT NULL/);
      expect(t).toMatch(/"MotivoCodigo" varchar\(40\)(?! NOT NULL)/);
      expect(t).toMatch(/"Intentos" smallint DEFAULT 0 NOT NULL/);
      expect(t).toMatch(/"ReclamoId" uuid(?! NOT NULL)/);
      expect(t).toMatch(
        /"ReclamadaEn" timestamp with time zone(?! DEFAULT)(?! NOT NULL)/,
      );
      expect(t).toMatch(
        /"EnviadaEn" timestamp with time zone(?! DEFAULT)(?! NOT NULL)/,
      );
      expect(t).toMatch(/"ProveedorMensajeId" varchar\(100\)(?! NOT NULL)/);
      expect(t).toMatch(
        /"CreadaEn" timestamp with time zone DEFAULT now\(\) NOT NULL/,
      );
      expect(t).toMatch(
        /"ActualizadaEn" timestamp with time zone DEFAULT now\(\) NOT NULL/,
      );
    });

    it("allows one remission per teacher and request (UQ_Remision_SolicitudDocente)", () => {
      expect(flat(tableSql(readSql(), "Remision"))).toMatch(
        /CONSTRAINT "UQ_Remision_SolicitudDocente" UNIQUE\("SolicitudId","DocenteId"\)/,
      );
    });

    it("restricts Estado and MotivoCodigo to the TR-2 constants", () => {
      const t = tableSql(readSql(), "Remision");
      expect(checkValues(t, "CK_Remision_Estado")).toEqual([
        ...REMISSION_STATES,
      ]);
      expect(checkValues(t, "CK_Remision_Motivo")).toEqual([
        ...REMISSION_REASONS,
      ]);
      expect(flat(t)).toMatch(
        /CONSTRAINT "CK_Remision_Motivo" CHECK \("MotivoCodigo" IS NULL OR "MotivoCodigo" IN \(/,
      );
    });

    it("ties the send time to the sent state (CK_Remision_Enviada)", () => {
      expect(flat(tableSql(readSql(), "Remision"))).toMatch(
        /CONSTRAINT "CK_Remision_Enviada" CHECK \(\("Estado" = 'enviada'\) = \("EnviadaEn" IS NOT NULL\)\)/,
      );
    });

    it("ties the reason to the state (CK_Remision_MotivoEstado)", () => {
      expect(flat(tableSql(readSql(), "Remision"))).toMatch(
        /CONSTRAINT "CK_Remision_MotivoEstado" CHECK \(\("Estado" <> 'enviada' OR "MotivoCodigo" IS NULL\) AND \("Estado" <> 'bloqueada' OR \("MotivoCodigo" IS NOT NULL AND "MotivoCodigo" <> 'error_envio'\)\) AND \("Estado" <> 'pendiente' OR "MotivoCodigo" IS NULL OR "MotivoCodigo" = 'error_envio'\)\)/,
      );
    });

    it("requires an email unless the reason is sin_correo (CK_Remision_Correo)", () => {
      expect(flat(tableSql(readSql(), "Remision"))).toMatch(
        /CONSTRAINT "CK_Remision_Correo" CHECK \("Correo" IS NOT NULL OR "MotivoCodigo" = 'sin_correo'\)/,
      );
    });

    it("keeps the claim id and time together and attempts non-negative", () => {
      const t = flat(tableSql(readSql(), "Remision"));
      expect(t).toMatch(
        /CONSTRAINT "CK_Remision_Reclamo" CHECK \(\("ReclamoId" IS NULL\) = \("ReclamadaEn" IS NULL\)\)/,
      );
      expect(t).toMatch(
        /CONSTRAINT "CK_Remision_Intentos" CHECK \("Intentos" >= 0\)/,
      );
    });

    it("references request and teacher without cascade", () => {
      const sql = flat(readSql());
      for (const [column, target] of [
        ["SolicitudId", "Solicitud"],
        ["DocenteId", "Usuario"],
      ]) {
        expect(sql).toMatch(
          new RegExp(
            `ALTER TABLE "Remision" ADD CONSTRAINT "[^"]+" FOREIGN KEY \\("${column}"\\) REFERENCES "public"\\."${target}"\\("Id"\\) ON DELETE no action`,
          ),
        );
      }
    });

    it("indexes pending rows for the retry job and rows by request", () => {
      const sql = flat(readSql());
      expect(sql).toMatch(
        /CREATE INDEX "IX_Remision_Pendiente" ON "Remision" USING btree \("CreadaEn","Id"\) WHERE "Estado" = 'pendiente'/,
      );
      expect(sql).toMatch(
        /CREATE INDEX "IX_Remision_Solicitud" ON "Remision" USING btree \("SolicitudId"\)/,
      );
    });
  });

  describe("Solicitud.FormatoEspecial (RN-19)", () => {
    it("is only allowed on an approved force-majeure request", () => {
      expect(flat(readSql())).toMatch(
        /ALTER TABLE "Solicitud" ADD CONSTRAINT "CK_Solicitud_FormatoEspecial" CHECK \(NOT "FormatoEspecial" OR \("Estado" = 'aprobada' AND "Causa" = 'fuerza_mayor'\)\)/,
      );
    });
  });

  describe("DocumentoRespaldo staff upload (TR-16)", () => {
    it("references the uploader without cascade", () => {
      expect(flat(readSql())).toMatch(
        /ALTER TABLE "DocumentoRespaldo" ADD CONSTRAINT "[^"]+" FOREIGN KEY \("SubidoPorId"\) REFERENCES "public"\."Usuario"\("Id"\) ON DELETE no action/,
      );
    });

    it("ties the format flag to a staff upload and a valid document", () => {
      expect(flat(readSql())).toMatch(
        /ALTER TABLE "DocumentoRespaldo" ADD CONSTRAINT "CK_Documento_FormatoEspecial" CHECK \("FormatoEspecial" = \("SubidoPorId" IS NOT NULL\) AND \(NOT "FormatoEspecial" OR "Estado" = 'valido'\)\)/,
      );
    });

    it("allows at most one format per request (UX_Documento_FormatoEspecial)", () => {
      expect(flat(readSql())).toMatch(
        /CREATE UNIQUE INDEX "UX_Documento_FormatoEspecial" ON "DocumentoRespaldo" USING btree \("SolicitudId"\) WHERE "FormatoEspecial"/,
      );
    });
  });
});
