import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

// Located by name, never by number: the number is whatever drizzle-kit
// generated as the next migration (SR-2).
const DRIZZLE_DIR = resolve(process.cwd(), "drizzle");
const JOURNAL_PATH = resolve(DRIZZLE_DIR, "meta/_journal.json");

/** `when` of migration 0007 (justification_intake); ours must be later. */
const LAST_APPLIED_WHEN = 1791672226324;

type Journal = { entries: { tag: string; when: number }[] };

function journal(): Journal {
  return JSON.parse(readFileSync(JOURNAL_PATH, "utf8")) as Journal;
}

function findMigrationFile(): string {
  const matches = readdirSync(DRIZZLE_DIR).filter((f) =>
    /^\d{4}_secretary_review\.sql$/.test(f),
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
    .replace(
      /"(?:Usuario|Solicitud|DocumentoRespaldo|SolicitudRevision|SolicitudDecision)"\./g,
      "",
    );
}

describe("secretary_review migration (SR-1, SR-2)", () => {
  it("is registered once in the journal, later than the last applied migration", () => {
    const entries = journal().entries.filter((e) =>
      e.tag.endsWith("_secretary_review"),
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].when).toBeGreaterThan(LAST_APPLIED_WHEN);
  });

  it("creates exactly the two new tables", () => {
    const creates = [...readSql().matchAll(/CREATE TABLE "([^"]+)"/g)].map(
      (m) => m[1],
    );
    expect(creates.sort()).toEqual(
      ["SolicitudDecision", "SolicitudRevision"].sort(),
    );
  });

  describe("additive only", () => {
    it("never drops, deletes, inserts, updates or tightens existing objects", () => {
      const sql = readSql();
      expect(sql).not.toMatch(/\bDROP\b/i);
      expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
      expect(sql).not.toMatch(/\bINSERT\b/i);
      // "ON UPDATE no action" is part of every FK; only a statement counts.
      expect(sql).not.toMatch(/^\s*UPDATE\b/im);
      expect(sql).not.toMatch(/\bALTER COLUMN\b/i);
      expect(sql).not.toMatch(/\bSET NOT NULL\b/i);
      expect(sql).not.toMatch(/\bRENAME\b/i);
    });

    it("adds only the three nullable columns to existing tables", () => {
      const adds = [
        ...flat(readSql()).matchAll(
          /ALTER TABLE "([^"]+)" ADD COLUMN "([^"]+)" ([^;]+);/g,
        ),
      ].map((m) => `${m[1]}.${m[2]} ${m[3].trim()}`);
      expect(adds.sort()).toEqual(
        [
          "DocumentoRespaldo.RetiradoEn timestamp with time zone",
          "Solicitud.ReenviadaEn timestamp with time zone",
          "Usuario.FacultadId bigint",
        ].sort(),
      );
    });
  });

  it("does not reference Grupo anywhere (SR-3 isolation)", () => {
    expect(readSql()).not.toMatch(/Grupo/);
  });

  it("never cascades a delete: history is never erased (SR-1)", () => {
    expect(readSql()).not.toMatch(/ON DELETE cascade/i);
  });

  describe("Usuario.FacultadId", () => {
    it("references Facultad without cascade", () => {
      expect(flat(readSql())).toMatch(
        /ALTER TABLE "Usuario" ADD CONSTRAINT "[^"]+" FOREIGN KEY \("FacultadId"\) REFERENCES "public"\."Facultad"\("Id"\) ON DELETE no action/,
      );
    });

    it("is exclusive with CarreraId (CK_Usuario_Ambito)", () => {
      expect(flat(readSql())).toMatch(
        /ALTER TABLE "Usuario" ADD CONSTRAINT "CK_Usuario_Ambito" CHECK \("FacultadId" IS NULL OR "CarreraId" IS NULL\)/,
      );
    });
  });

  describe("Solicitud.ReenviadaEn", () => {
    it("is checked against PresentadaEn (CK_Solicitud_Reenvio)", () => {
      expect(flat(readSql())).toMatch(
        /ALTER TABLE "Solicitud" ADD CONSTRAINT "CK_Solicitud_Reenvio" CHECK \("ReenviadaEn" IS NULL OR \("PresentadaEn" IS NOT NULL AND "ReenviadaEn" >= "PresentadaEn"\)\)/,
      );
    });

    it("adds the partial queue index ordered by the effective start (IX_Solicitud_Cola)", () => {
      expect(flat(readSql())).toMatch(
        /CREATE INDEX "IX_Solicitud_Cola" ON "Solicitud" USING btree \(coalesce\("ReenviadaEn", "PresentadaEn"\),"Id"\) WHERE "Estado" = 'pendiente'/,
      );
    });
  });

  describe("DocumentoRespaldo.RetiradoEn", () => {
    it("is only allowed on a valid document (CK_Documento_Retiro)", () => {
      expect(flat(readSql())).toMatch(
        /ALTER TABLE "DocumentoRespaldo" ADD CONSTRAINT "CK_Documento_Retiro" CHECK \("RetiradoEn" IS NULL OR "Estado" = 'valido'\)/,
      );
    });
  });

  describe("SolicitudRevision", () => {
    it("stores the snapshot as typed columns and jsonb, never a Grupo reference", () => {
      const t = flat(tableSql(readSql(), "SolicitudRevision"));
      expect(t).toMatch(/"Id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY/);
      expect(t).toMatch(/"SolicitudId" bigint NOT NULL/);
      expect(t).toMatch(/"Numero" smallint NOT NULL/);
      expect(t).toMatch(/"Causa" varchar\(30\) NOT NULL/);
      expect(t).toMatch(/"FechaInicio" date NOT NULL/);
      expect(t).toMatch(/"FechaFin" date NOT NULL/);
      expect(t).toMatch(/"Clases" jsonb NOT NULL/);
      expect(t).toMatch(/"DocumentoIds" jsonb NOT NULL/);
      expect(t).toMatch(
        /"CreadaEn" timestamp with time zone DEFAULT now\(\) NOT NULL/,
      );
    });

    it("has one revision number per request (UQ_SolicitudRevision) and Numero > 0", () => {
      const t = flat(tableSql(readSql(), "SolicitudRevision"));
      expect(t).toMatch(
        /CONSTRAINT "UQ_SolicitudRevision" UNIQUE\("SolicitudId","Numero"\)/,
      );
      expect(t).toMatch(
        /CONSTRAINT "CK_SolicitudRevision_Numero" CHECK \("Numero" > 0\)/,
      );
    });

    it("keeps the Solicitud CHECKs on cause and dates", () => {
      const t = flat(tableSql(readSql(), "SolicitudRevision"));
      const ck = t.match(
        /CONSTRAINT "CK_SolicitudRevision_Causa" CHECK \(([^)]*)\)/,
      );
      expect(ck).not.toBeNull();
      expect([...ck![1].matchAll(/'([a-z_]+)'/g)]).toHaveLength(5);
      expect(t).toMatch(
        /CONSTRAINT "CK_SolicitudRevision_Fechas" CHECK \("FechaFin" >= "FechaInicio"\)/,
      );
    });

    it("references Solicitud without cascade", () => {
      expect(flat(readSql())).toMatch(
        /ALTER TABLE "SolicitudRevision" ADD CONSTRAINT "[^"]+" FOREIGN KEY \("SolicitudId"\) REFERENCES "public"\."Solicitud"\("Id"\) ON DELETE no action/,
      );
    });
  });

  describe("SolicitudDecision", () => {
    it("has the append-only history columns", () => {
      const t = flat(tableSql(readSql(), "SolicitudDecision"));
      expect(t).toMatch(/"Id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY/);
      expect(t).toMatch(/"SolicitudId" bigint NOT NULL/);
      expect(t).toMatch(/"Tipo" varchar\(20\) NOT NULL/);
      expect(t).toMatch(/"PlantillaCodigo" varchar\(40\) NOT NULL/);
      expect(t).toMatch(/"MotivoCodigo" varchar\(30\)(?! NOT NULL)/);
      expect(t).toMatch(/"Texto" varchar\(1000\)(?! NOT NULL)/);
      expect(t).toMatch(/"RevisionId" bigint(?! NOT NULL)/);
      expect(t).toMatch(/"SecretariaId" bigint NOT NULL/);
      expect(t).toMatch(
        /"DecididaEn" timestamp with time zone DEFAULT now\(\) NOT NULL/,
      );
    });

    it("restricts Tipo to the three decisions", () => {
      const t = flat(tableSql(readSql(), "SolicitudDecision"));
      const ck = t.match(
        /CONSTRAINT "CK_SolicitudDecision_Tipo" CHECK \(([^)]*)\)/,
      );
      expect(ck).not.toBeNull();
      expect([...ck![1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1])).toEqual([
        "aprobada",
        "rechazada",
        "devuelta",
      ]);
    });

    it("ties the return reason to a returned decision and to the RN-17 list", () => {
      const t = flat(tableSql(readSql(), "SolicitudDecision"));
      expect(t).toMatch(
        /CONSTRAINT "CK_SolicitudDecision_Motivo" CHECK \(\("Tipo" = 'devuelta'\) = \("MotivoCodigo" IS NOT NULL\)\)/,
      );
      const ck = t.match(
        /CONSTRAINT "CK_SolicitudDecision_MotivoCodigo" CHECK \(([^)]*\)?[^)]*)\)/,
      );
      expect(ck).not.toBeNull();
      expect(ck![1]).toContain('"MotivoCodigo" IS NULL');
      expect([...ck![1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1])).toEqual([
        "fecha_incorrecta",
        "fecha_alterada",
        "documento_ilegible",
      ]);
    });

    it("requires non-blank text unless approved (null-safe)", () => {
      const t = flat(tableSql(readSql(), "SolicitudDecision"));
      expect(t).toMatch(
        /CONSTRAINT "CK_SolicitudDecision_Texto" CHECK \("Tipo" = 'aprobada' OR \("Texto" IS NOT NULL AND length\(btrim\("Texto"\)\) > 0\)\)/,
      );
    });

    it("links the returned snapshot only to a returned decision", () => {
      const t = flat(tableSql(readSql(), "SolicitudDecision"));
      expect(t).toMatch(
        /CONSTRAINT "CK_SolicitudDecision_Revision" CHECK \(\("Tipo" = 'devuelta'\) = \("RevisionId" IS NOT NULL\)\)/,
      );
    });

    it("references request, revision and secretary without cascade", () => {
      const sql = flat(readSql());
      for (const [column, target] of [
        ["SolicitudId", "Solicitud"],
        ["RevisionId", "SolicitudRevision"],
        ["SecretariaId", "Usuario"],
      ]) {
        expect(sql).toMatch(
          new RegExp(
            `ALTER TABLE "SolicitudDecision" ADD CONSTRAINT "[^"]+" FOREIGN KEY \\("${column}"\\) REFERENCES "public"\\."${target}"\\("Id"\\) ON DELETE no action`,
          ),
        );
      }
    });

    it("indexes the history of a request by decision time", () => {
      expect(flat(readSql())).toMatch(
        /CREATE INDEX "IX_SolicitudDecision_Solicitud" ON "SolicitudDecision" USING btree \("SolicitudId","DecididaEn"\)/,
      );
    });
  });
});
