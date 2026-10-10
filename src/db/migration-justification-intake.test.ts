import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

// The migration number is provisional: catalog-management owns 0005/0006 and
// this file is regenerated at the final merge (tasks F.2). Locate it by name.
const DRIZZLE_DIR = resolve(process.cwd(), "drizzle");
const JOURNAL_PATH = resolve(DRIZZLE_DIR, "meta/_journal.json");

function findMigrationFile(): string {
  const matches = readdirSync(DRIZZLE_DIR).filter((f) =>
    /^\d{4}_justification_intake\.sql$/.test(f),
  );
  expect(matches).toHaveLength(1);
  return resolve(DRIZZLE_DIR, matches[0]);
}

function readSql(): string {
  return readFileSync(findMigrationFile(), "utf8");
}

/** The CREATE TABLE statement of one table, up to its statement breakpoint. */
function tableSql(sql: string, table: string): string {
  const match = sql.match(
    new RegExp(`CREATE TABLE "${table}" \\([\\s\\S]*?\\);`),
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
    .replace(/"(?:Solicitud|DocumentoRespaldo)"\./g, "");
}

describe("justification_intake migration (RN-01, RN-05, D7, D8)", () => {
  it("is registered in the journal under the justification_intake tag", () => {
    const journal = JSON.parse(readFileSync(JOURNAL_PATH, "utf8")) as {
      entries: { tag: string }[];
    };
    const tags = journal.entries.map((e) => e.tag);
    expect(
      tags.filter((t) => t.endsWith("_justification_intake")),
    ).toHaveLength(1);
  });

  it("creates exactly the three intake tables", () => {
    const creates = [...readSql().matchAll(/CREATE TABLE "([^"]+)"/g)].map(
      (m) => m[1],
    );
    expect(creates.sort()).toEqual(
      ["DocumentoRespaldo", "Solicitud", "SolicitudAsignatura"].sort(),
    );
  });

  it("only creates: no DROP, DELETE or INSERT of existing objects", () => {
    const sql = readSql();
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(sql).not.toMatch(/\bINSERT\b/i);
  });

  describe("Solicitud", () => {
    it("defaults Estado to borrador and restricts it to the RN-16 set (D7)", () => {
      const t = flat(tableSql(readSql(), "Solicitud"));
      expect(t).toMatch(/"Estado" varchar\(30\) DEFAULT 'borrador' NOT NULL/);
      const ck = t.match(/CONSTRAINT "CK_Solicitud_Estado" CHECK \(([^)]*)\)/);
      expect(ck).not.toBeNull();
      for (const estado of [
        "borrador",
        "pendiente",
        "en_revision_coordinacion",
        "devuelta",
        "aprobada",
        "rechazada",
      ]) {
        expect(ck![1]).toContain(`'${estado}'`);
      }
    });

    it("restricts Causa to the five codes, null allowed (RN-01)", () => {
      const t = flat(tableSql(readSql(), "Solicitud"));
      const ck = t.match(/CONSTRAINT "CK_Solicitud_Causa" CHECK \(([^)]*)\)/);
      expect(ck).not.toBeNull();
      expect(ck![1]).toMatch(/"Causa" IS NULL/);
      const codes = [...ck![1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
      expect(codes).toHaveLength(5);
    });

    it("stores absence dates as date and checks FechaFin >= FechaInicio (RN-05)", () => {
      const t = flat(tableSql(readSql(), "Solicitud"));
      expect(t).toMatch(/"FechaInicio" date(?! NOT NULL)/);
      expect(t).toMatch(/"FechaFin" date(?! NOT NULL)/);
      expect(t).toMatch(
        /CONSTRAINT "CK_Solicitud_Fechas" CHECK \([^)]*"FechaFin" >= "FechaInicio"/,
      );
    });

    it("requires cause, dates, timestamp and the four snapshot columns once presented (D9)", () => {
      const t = flat(tableSql(readSql(), "Solicitud"));
      const ck = t.match(
        /CONSTRAINT "CK_Solicitud_Presentada" CHECK \((.*?)\)(?:,| \))/,
      );
      expect(ck).not.toBeNull();
      expect(ck![1]).toMatch(/"Estado" = 'borrador'/);
      for (const col of [
        "PresentadaEn",
        "Causa",
        "FechaInicio",
        "FechaFin",
        "EstudianteNombre",
        "EstudianteCif",
        "EstudianteCarrera",
        "EstudianteCorreo",
      ]) {
        expect(ck![1]).toContain(`"${col}" IS NOT NULL`);
      }
    });

    it("stores the snapshot columns nullable with the design lengths (D9)", () => {
      const t = flat(tableSql(readSql(), "Solicitud"));
      expect(t).toMatch(/"EstudianteNombre" varchar\(160\)(?! NOT NULL)/);
      expect(t).toMatch(/"EstudianteCif" varchar\(20\)(?! NOT NULL)/);
      expect(t).toMatch(/"EstudianteCarrera" varchar\(160\)(?! NOT NULL)/);
      expect(t).toMatch(/"EstudianteCorreo" varchar\(160\)(?! NOT NULL)/);
    });

    it("has timestamptz CreadoEn and ActualizadoEn defaulting to now()", () => {
      const t = flat(tableSql(readSql(), "Solicitud"));
      for (const col of ["CreadoEn", "ActualizadoEn"]) {
        expect(t).toMatch(
          new RegExp(
            `"${col}" timestamp with time zone DEFAULT now\\(\\) NOT NULL`,
          ),
        );
      }
    });

    it("has a partial unique index allowing one borrador per student (D8)", () => {
      const sql = flat(readSql());
      expect(sql).toMatch(
        /CREATE UNIQUE INDEX "UX_Solicitud_Borrador" ON "Solicitud" USING btree \("EstudianteId"\) WHERE "Estado" = 'borrador'/,
      );
    });

    it("has the state and draft-activity indexes", () => {
      const sql = flat(readSql());
      expect(sql).toMatch(
        /CREATE INDEX "IX_Solicitud_Estado" ON "Solicitud" USING btree \("Estado","PresentadaEn"\)/,
      );
      expect(sql).toMatch(
        /CREATE INDEX "IX_Solicitud_BorradorActualizado" ON "Solicitud" USING btree \("ActualizadoEn"\) WHERE "Estado" = 'borrador'/,
      );
    });
  });

  describe("SolicitudAsignatura", () => {
    it("has the composite PK and cascades on the request", () => {
      const sql = flat(readSql());
      const t = flat(tableSql(readSql(), "SolicitudAsignatura"));
      expect(t).toMatch(
        /CONSTRAINT "SolicitudAsignatura_SolicitudId_GrupoId_pk" PRIMARY KEY\("SolicitudId","GrupoId"\)/,
      );
      expect(sql).toMatch(
        /ALTER TABLE "SolicitudAsignatura" ADD CONSTRAINT "[^"]+" FOREIGN KEY \("SolicitudId"\) REFERENCES "public"\."Solicitud"\("Id"\) ON DELETE cascade/,
      );
      expect(sql).toMatch(
        /ALTER TABLE "SolicitudAsignatura" ADD CONSTRAINT "[^"]+" FOREIGN KEY \("GrupoId"\) REFERENCES "public"\."Grupo"\("Id"\) ON DELETE no action/,
      );
    });
  });

  describe("DocumentoRespaldo (RN-04, D12)", () => {
    it("has a unique pathname of at most 255 characters", () => {
      const t = flat(tableSql(readSql(), "DocumentoRespaldo"));
      expect(t).toMatch(/"Pathname" varchar\(255\) NOT NULL/);
      expect(t).toMatch(/CONSTRAINT "[^"]+" UNIQUE\("Pathname"\)/);
    });

    it("caps the size at 10 485 760 bytes and rejects empty files", () => {
      const t = flat(tableSql(readSql(), "DocumentoRespaldo"));
      expect(t).toMatch(/"TamanoBytes" integer NOT NULL/);
      expect(t).toMatch(
        /CHECK \("TamanoBytes" > 0 AND "TamanoBytes" <= 10485760\)/,
      );
    });

    it("limits the detected type to pdf, png and jpeg", () => {
      const t = flat(tableSql(readSql(), "DocumentoRespaldo"));
      expect(t).toMatch(/"TipoDetectado" varchar\(10\)(?! NOT NULL)/);
      const ck = t.match(/CONSTRAINT "CK_Documento_Tipo" CHECK \(([^)]*)\)/);
      expect(ck).not.toBeNull();
      for (const tipo of ["pdf", "png", "jpeg"]) {
        expect(ck![1]).toContain(`'${tipo}'`);
      }
    });

    it("limits Estado to pendiente or valido and requires a type once valid", () => {
      const t = flat(tableSql(readSql(), "DocumentoRespaldo"));
      const estado = t.match(
        /CONSTRAINT "CK_Documento_Estado" CHECK \(([^)]*)\)/,
      );
      expect(estado).not.toBeNull();
      expect(estado![1]).toContain("'pendiente'");
      expect(estado![1]).toContain("'valido'");
      expect(t).toMatch(
        /CONSTRAINT "CK_Documento_Validado" CHECK \("Estado" = 'pendiente' OR "TipoDetectado" IS NOT NULL\)/,
      );
    });

    it("cascades on the request", () => {
      expect(flat(readSql())).toMatch(
        /ALTER TABLE "DocumentoRespaldo" ADD CONSTRAINT "[^"]+" FOREIGN KEY \("SolicitudId"\) REFERENCES "public"\."Solicitud"\("Id"\) ON DELETE cascade/,
      );
    });
  });
});
