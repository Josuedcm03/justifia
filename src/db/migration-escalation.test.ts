import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

// Located by name, never by number: the number is whatever drizzle-kit
// generated as the next migration, and the second change to merge regenerates
// (ES-16).
const DRIZZLE_DIR = resolve(process.cwd(), "drizzle");
const JOURNAL_PATH = resolve(DRIZZLE_DIR, "meta/_journal.json");

/**
 * `when` of migration 0011 (document_extraction, applied in production); ours
 * must be later, or the drizzle migrator skips it.
 */
const LAST_APPLIED_WHEN = 1792808788271;

type Journal = { entries: { tag: string; when: number }[] };

function journal(): Journal {
  return JSON.parse(readFileSync(JOURNAL_PATH, "utf8")) as Journal;
}

function readSql(): string {
  const matches = readdirSync(DRIZZLE_DIR).filter((f) =>
    /^\d{4}_escalation\.sql$/.test(f),
  );
  expect(matches).toHaveLength(1);
  return readFileSync(resolve(DRIZZLE_DIR, matches[0]), "utf8");
}

/** Collapse whitespace and drop the table qualifier drizzle adds in CHECKs. */
function flat(sql: string): string {
  return sql
    .replace(/\s+/g, " ")
    .replace(/"(Escalamiento|ReporteInasistencia|Solicitud)"\./g, "");
}

/** Column name -> definition of one `CREATE TABLE`, in declaration order. */
function columnsOf(table: string): Map<string, string> {
  const block = readSql().match(
    new RegExp(`CREATE TABLE "${table}" \\(\\r?\\n([\\s\\S]*?)\\r?\\n\\);`),
  );
  expect(block).not.toBeNull();
  const columns = new Map<string, string>();
  for (const line of (block as RegExpMatchArray)[1].split(/\r?\n/)) {
    const col = line.trim().match(/^"([^"]+)" (.*?),?$/);
    if (col) columns.set(col[1], col[2].replace(/ GENERATED.*$/, ""));
  }
  return columns;
}

const check = (name: string, body: string) =>
  `CONSTRAINT "${name}" CHECK (${body})`;

describe("escalation migration (ES-1, ES-2, ES-5, ES-16)", () => {
  it("is registered once in the journal, later than the last applied migration", () => {
    const entries = journal().entries.filter((e) =>
      e.tag.endsWith("_escalation"),
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].when).toBeGreaterThan(LAST_APPLIED_WHEN);
  });

  describe("destructive statements", () => {
    it("drops only IX_Solicitud_Cola, then recreates it", () => {
      const sql = readSql();
      const drops = [...sql.matchAll(/\bDROP\b[^;]*;/gi)].map((m) => m[0]);
      expect(drops).toEqual(['DROP INDEX "IX_Solicitud_Cola";']);
      expect(sql.indexOf("DROP INDEX")).toBeLessThan(
        sql.indexOf('CREATE INDEX "IX_Solicitud_Cola"'),
      );
    });

    it("never updates, deletes, inserts, retypes, renames or cascades", () => {
      const sql = readSql();
      expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
      expect(sql).not.toMatch(/\bINSERT\b/i);
      // "ON UPDATE no action" is part of an FK; only a statement counts.
      expect(sql).not.toMatch(/^\s*UPDATE\b/im);
      expect(sql).not.toMatch(/ALTER\s+\S+\s+TYPE/i);
      expect(sql).not.toMatch(/\bALTER COLUMN\b/i);
      expect(sql).not.toMatch(/\bSET NOT NULL\b/i);
      expect(sql).not.toMatch(/\bRENAME\b/i);
      expect(sql).not.toMatch(/\bCASCADE\b/i);
    });

    it("creates exactly the two tables", () => {
      const created = [...readSql().matchAll(/CREATE TABLE "([^"]+)"/g)].map(
        (m) => m[1],
      );
      expect(created.sort()).toEqual(["Escalamiento", "ReporteInasistencia"]);
    });
  });

  describe("Escalamiento columns (ES-1)", () => {
    const expected: [string, string][] = [
      ["Id", "bigint PRIMARY KEY"],
      ["SolicitudId", "bigint NOT NULL"],
      ["Tipo", "varchar(30) NOT NULL"],
      ["EstadoPrevio", "varchar(30) NOT NULL"],
      ["Nota", "varchar(1000)"],
      ["ReporteId", "bigint"],
      ["SecretariaId", "bigint NOT NULL"],
      ["CreadoEn", "timestamp with time zone DEFAULT now() NOT NULL"],
      ["Respuesta", "varchar(1000)"],
      ["RespondidaPorId", "bigint"],
      ["RespondidaEn", "timestamp with time zone"],
      ["NotificacionEstado", "varchar(20) DEFAULT 'pendiente' NOT NULL"],
      ["NotificacionMotivo", "varchar(30)"],
      ["Intentos", "smallint DEFAULT 0 NOT NULL"],
      ["ReclamoId", "uuid"],
      ["ReclamadaEn", "timestamp with time zone"],
      ["EnviadaEn", "timestamp with time zone"],
      ["ProveedorMensajeId", "varchar(100)"],
      ["ActualizadaEn", "timestamp with time zone DEFAULT now() NOT NULL"],
    ];

    it("has every column and no other", () => {
      expect([...columnsOf("Escalamiento")]).toEqual(expected);
    });
  });

  describe("ReporteInasistencia columns (ES-2)", () => {
    const expected: [string, string][] = [
      ["Id", "bigint PRIMARY KEY"],
      ["SolicitudId", "bigint NOT NULL"],
      ["DocenteId", "bigint NOT NULL"],
      ["DocenteNombre", "varchar(160) NOT NULL"],
      ["ComunicadoEl", "date NOT NULL"],
      ["Nota", "varchar(1000)"],
      ["RegistradoPorId", "bigint NOT NULL"],
      ["RegistradoEn", "timestamp with time zone DEFAULT now() NOT NULL"],
    ];

    it("has every column and no other, with no percentage field", () => {
      const columns = columnsOf("ReporteInasistencia");
      expect([...columns]).toEqual(expected);
      expect([...columns.keys()].join(" ")).not.toMatch(/porcentaje|conteo/i);
    });
  });

  describe("CHECK constraints", () => {
    const state = `"NotificacionEstado"`;
    const bodies: [string, string][] = [
      [
        "CK_Escalamiento_Tipo",
        `"Tipo" IN ('sospecha_documento', 'exceso_inasistencias')`,
      ],
      [
        "CK_Escalamiento_Kind",
        `("Tipo" = 'sospecha_documento' AND "EstadoPrevio" = 'pendiente' AND "ReporteId" IS NULL AND "Nota" IS NOT NULL AND length(btrim("Nota")) > 0) OR ("Tipo" = 'exceso_inasistencias' AND "EstadoPrevio" = 'aprobada' AND "ReporteId" IS NOT NULL AND "Nota" IS NULL)`,
      ],
      [
        "CK_Escalamiento_Respuesta",
        `("Respuesta" IS NULL) = ("RespondidaPorId" IS NULL) AND ("Respuesta" IS NULL) = ("RespondidaEn" IS NULL) AND ("Respuesta" IS NULL OR (length(btrim("Respuesta")) > 0 AND "RespondidaEn" >= "CreadoEn"))`,
      ],
      [
        "CK_Escalamiento_SinRespuesta",
        `"Tipo" = 'sospecha_documento' OR "RespondidaEn" IS NULL`,
      ],
      [
        "CK_Escalamiento_NotificacionEstado",
        `${state} IN ('pendiente', 'enviada', 'bloqueada')`,
      ],
      [
        "CK_Escalamiento_NotificacionMotivo",
        `"NotificacionMotivo" IS NULL OR "NotificacionMotivo" IN ('sin_destinatarios', 'error_envio')`,
      ],
      [
        "CK_Escalamiento_Enviada",
        `(${state} = 'enviada') = ("EnviadaEn" IS NOT NULL)`,
      ],
      [
        "CK_Escalamiento_MotivoEstado",
        `(${state} <> 'enviada' OR "NotificacionMotivo" IS NULL) AND (${state} <> 'bloqueada' OR ("NotificacionMotivo" IS NOT NULL AND "NotificacionMotivo" = 'sin_destinatarios')) AND (${state} <> 'pendiente' OR "NotificacionMotivo" IS NULL OR "NotificacionMotivo" = 'error_envio')`,
      ],
      [
        "CK_Escalamiento_Reclamo",
        `("ReclamoId" IS NULL) = ("ReclamadaEn" IS NULL)`,
      ],
      ["CK_Escalamiento_Intentos", `"Intentos" >= 0`],
      [
        "CK_ReporteInasistencia_Nota",
        `"Nota" IS NULL OR length(btrim("Nota")) > 0`,
      ],
      [
        "CK_Solicitud_PlazoInicio",
        `"PlazoInicioEn" IS NULL OR "PlazoInicioEn" >= coalesce("ReenviadaEn", "PresentadaEn")`,
      ],
    ];

    it.each(bodies)("%s", (name, body) => {
      expect(flat(readSql())).toContain(check(name, body));
    });

    it("declares no other constraint", () => {
      const names = [
        ...flat(readSql()).matchAll(/CONSTRAINT "(CK_[^"]+)" CHECK/g),
      ].map((m) => m[1]);
      expect(names.sort()).toEqual(bodies.map(([n]) => n).sort());
    });
  });

  describe("foreign keys", () => {
    it("reference the request, report and users without cascade", () => {
      const fks = [...readSql().matchAll(/ADD CONSTRAINT "([^"]+_fk)"/g)].map(
        (m) => m[1],
      );
      expect(fks.sort()).toEqual(
        [
          "Escalamiento_SolicitudId_Solicitud_Id_fk",
          "Escalamiento_ReporteId_ReporteInasistencia_Id_fk",
          "Escalamiento_SecretariaId_Usuario_Id_fk",
          "Escalamiento_RespondidaPorId_Usuario_Id_fk",
          "ReporteInasistencia_SolicitudId_Solicitud_Id_fk",
          "ReporteInasistencia_DocenteId_Usuario_Id_fk",
          "ReporteInasistencia_RegistradoPorId_Usuario_Id_fk",
        ].sort(),
      );
      expect(readSql()).not.toMatch(/ON DELETE (cascade|set null)/i);
    });
  });

  describe("indexes", () => {
    it.each([
      [
        "UX_Escalamiento_Abierto: one open suspicion per request (E12)",
        `CREATE UNIQUE INDEX "UX_Escalamiento_Abierto" ON "Escalamiento" USING btree ("SolicitudId") WHERE "Tipo" = 'sospecha_documento' AND "RespondidaEn" IS NULL;`,
      ],
      [
        "IX_Escalamiento_Pendiente: the retry job reads pending notices",
        `CREATE INDEX "IX_Escalamiento_Pendiente" ON "Escalamiento" USING btree ("CreadoEn","Id") WHERE "NotificacionEstado" = 'pendiente';`,
      ],
      [
        "IX_Escalamiento_Solicitud",
        `CREATE INDEX "IX_Escalamiento_Solicitud" ON "Escalamiento" USING btree ("SolicitudId","CreadoEn");`,
      ],
      [
        "IX_ReporteInasistencia_Solicitud",
        `CREATE INDEX "IX_ReporteInasistencia_Solicitud" ON "ReporteInasistencia" USING btree ("SolicitudId");`,
      ],
      [
        "IX_Solicitud_Cola: the three-way effective clock start (ES-5)",
        `CREATE INDEX "IX_Solicitud_Cola" ON "Solicitud" USING btree (coalesce("PlazoInicioEn", "ReenviadaEn", "PresentadaEn"),"Id") WHERE "Estado" = 'pendiente';`,
      ],
    ])("%s", (_name, statement) => {
      expect(flat(readSql())).toContain(statement);
    });
  });

  describe("Solicitud.PlazoInicioEn (ES-5)", () => {
    it("is added nullable, without a default, and is the only column added", () => {
      const adds = [
        ...flat(readSql()).matchAll(
          /ALTER TABLE "([^"]+)" ADD COLUMN "([^"]+)" ([^;]+);/g,
        ),
      ].map((m) => `${m[1]}.${m[2]} ${m[3].trim()}`);
      expect(adds).toEqual([
        "Solicitud.PlazoInicioEn timestamp with time zone",
      ]);
    });
  });
});
