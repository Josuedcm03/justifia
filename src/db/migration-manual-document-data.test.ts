import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

// Located by name, never by number: the number is whatever drizzle-kit
// generated as the next migration (MD-4, MD-5, MD-35).
const DRIZZLE_DIR = resolve(process.cwd(), "drizzle");
const JOURNAL_PATH = resolve(DRIZZLE_DIR, "meta/_journal.json");

/**
 * `when` of migration 0014 (data retention, applied in production); ours must
 * be later, or the drizzle migrator skips it.
 */
const LAST_APPLIED_WHEN = 1795111590732;

const DOCUMENT = '"DocumentoRespaldo"';
const MANUAL = '"DocumentoDatoManual"';

type Journal = { entries: { tag: string; when: number }[] };

function journal(): Journal {
  return JSON.parse(readFileSync(JOURNAL_PATH, "utf8")) as Journal;
}

function readSql(): string {
  const matches = readdirSync(DRIZZLE_DIR).filter((f) =>
    /^\d{4}_manual_document_data\.sql$/.test(f),
  );
  expect(matches).toHaveLength(1);
  return readFileSync(resolve(DRIZZLE_DIR, matches[0]), "utf8");
}

/** Drizzle's statements, whitespace collapsed and table qualifiers dropped. */
function statements(): string[] {
  return readSql()
    .split("--> statement-breakpoint")
    .map((s) =>
      s
        .replace(/\s+/g, " ")
        .replaceAll(`${DOCUMENT}.`, "")
        .replaceAll(`${MANUAL}.`, "")
        .trim(),
    )
    .filter(Boolean);
}

/** The body of `CONSTRAINT "name" CHECK (...)`, parentheses balanced. */
function checkBody(name: string): string {
  const sql =
    statements().find((s) => s.includes(`CONSTRAINT "${name}" `)) ?? "";
  const start = sql.indexOf(`CONSTRAINT "${name}" CHECK (`);
  expect(start, `${name} is declared`).toBeGreaterThanOrEqual(0);
  let depth = 0;
  const open = sql.indexOf("(", start);
  for (let i = open; i < sql.length; i++) {
    if (sql[i] === "(") depth += 1;
    if (sql[i] === ")" && --depth === 0) return sql.slice(open + 1, i);
  }
  throw new Error(`${name} is not closed`);
}

const BODIES: Record<string, string> = {
  CK_Documento_TipoDocumento: `"TipoDocumento" IS NULL OR "TipoDocumento" IN ('constancia_medica', 'constancia_institucional', 'otro')`,
  CK_DatoManual_Reposo: `("ReposoDesde" IS NULL) = ("ReposoHasta" IS NULL) AND ("ReposoHasta" IS NULL OR "ReposoHasta" >= "ReposoDesde")`,
  CK_DatoManual_Texto: `("NombreEstudiante" IS NULL OR btrim("NombreEstudiante") <> '') AND ("Emisor" IS NULL OR btrim("Emisor") <> '')`,
  CK_DatoManual_NoVacio: `"NombreEstudiante" IS NOT NULL OR "Emisor" IS NOT NULL OR "FechaEmision" IS NOT NULL OR "ReposoDesde" IS NOT NULL`,
};

const MANUAL_COLUMNS: Record<string, string> = {
  DocumentoId: "bigint PRIMARY KEY NOT NULL",
  NombreEstudiante: "varchar(160)",
  Emisor: "varchar(200)",
  FechaEmision: "date",
  ReposoDesde: "date",
  ReposoHasta: "date",
  RegistradoPorId: "bigint NOT NULL",
  ActualizadoEn: "timestamp with time zone DEFAULT now() NOT NULL",
};

describe("manual-document-data migration (MD-4, MD-5, MD-22, MD-35)", () => {
  it("is registered once in the journal, later than the last applied migration", () => {
    const entries = journal().entries.filter((e) =>
      e.tag.endsWith("_manual_document_data"),
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].tag).toBe("0015_manual_document_data");
    expect(entries[0].when).toBeGreaterThan(LAST_APPLIED_WHEN);
  });

  it("adds exactly the three nullable mark columns to DocumentoRespaldo, with no default", () => {
    const adds = readSql()
      .split("--> statement-breakpoint")
      .map((s) => s.replace(/\s+/g, " ").trim())
      .filter((s) => /\bADD COLUMN\b/.test(s));
    expect(adds.sort()).toEqual([
      `ALTER TABLE ${DOCUMENT} ADD COLUMN "TieneFirma" boolean;`,
      `ALTER TABLE ${DOCUMENT} ADD COLUMN "TieneSello" boolean;`,
      `ALTER TABLE ${DOCUMENT} ADD COLUMN "TipoDocumento" varchar(40);`,
    ]);
  });

  it("creates exactly one table, DocumentoDatoManual, with the A2 columns", () => {
    const creates = statements().filter((s) => s.startsWith("CREATE TABLE"));
    expect(creates).toHaveLength(1);
    expect(creates[0]).toMatch(new RegExp(`^CREATE TABLE ${MANUAL} \\(`));

    // Column lines come before the first CONSTRAINT of the table body.
    const body = readSql().split(/\n\tCONSTRAINT /)[0];
    const columns = Object.fromEntries(
      [...body.matchAll(/^\t"([^"]+)" ([^\n]+?),?$/gm)].map((m) => [
        m[1],
        m[2],
      ]),
    );
    expect(columns).toEqual(MANUAL_COLUMNS);
  });

  it("cascades from the document and not from the user", () => {
    const fks = statements().filter((s) => s.includes("FOREIGN KEY"));
    expect(fks).toHaveLength(2);
    expect(fks).toContain(
      `ALTER TABLE ${MANUAL} ADD CONSTRAINT "DocumentoDatoManual_DocumentoId_DocumentoRespaldo_Id_fk" FOREIGN KEY ("DocumentoId") REFERENCES "public".${DOCUMENT}("Id") ON DELETE cascade ON UPDATE no action;`,
    );
    expect(fks).toContain(
      `ALTER TABLE ${MANUAL} ADD CONSTRAINT "DocumentoDatoManual_RegistradoPorId_Usuario_Id_fk" FOREIGN KEY ("RegistradoPorId") REFERENCES "public"."Usuario"("Id") ON DELETE no action ON UPDATE no action;`,
    );
  });

  it.each(Object.entries(BODIES))(
    "declares %s with the design expression",
    (name, body) => {
      expect(checkBody(name)).toBe(body);
    },
  );

  it("declares exactly the four named CHECKs", () => {
    const names = [...readSql().matchAll(/CONSTRAINT "([^"]+)" CHECK/g)]
      .map((m) => m[1])
      .sort();
    expect(names).toEqual(Object.keys(BODIES).sort());
  });

  it("is purely additive: no drop, delete, update, insert, retype, rename or transaction", () => {
    const sql = readSql();
    expect(sql).not.toMatch(/\bDROP\b/i);
    // The foreign keys name DELETE and UPDATE as actions; only statements count.
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(sql).not.toMatch(/^\s*UPDATE\b/im);
    expect(sql).not.toMatch(/\bINSERT\b/i);
    expect(sql).not.toMatch(/ALTER\s+\S+\s+TYPE/i);
    expect(sql).not.toMatch(/\bALTER COLUMN\b/i);
    expect(sql).not.toMatch(/\bRENAME\b/i);
    expect(sql).not.toMatch(/\bBEGIN\b/i);
  });

  it("holds exactly the planned statements: 3 columns, 1 table, 1 check, 2 foreign keys", () => {
    const all = statements();
    expect(all).toHaveLength(7);
    const counts: Record<string, number> = {};
    for (const s of all) {
      const match = s.match(
        /^(ALTER TABLE "[^"]+" ADD COLUMN|ALTER TABLE "[^"]+" ADD CONSTRAINT "[^"]+" (?:CHECK|FOREIGN KEY)|CREATE TABLE "[^"]+")/,
      );
      const key = (match?.[1] ?? `UNKNOWN: ${s.slice(0, 40)}`).replace(
        / "(?:CK_|DocumentoDatoManual_)[^"]+"/,
        "",
      );
      counts[key] = (counts[key] ?? 0) + 1;
    }
    expect(counts).toEqual({
      'ALTER TABLE "DocumentoRespaldo" ADD COLUMN': 3,
      'CREATE TABLE "DocumentoDatoManual"': 1,
      'ALTER TABLE "DocumentoRespaldo" ADD CONSTRAINT CHECK': 1,
      'ALTER TABLE "DocumentoDatoManual" ADD CONSTRAINT FOREIGN KEY': 2,
    });
  });
});
