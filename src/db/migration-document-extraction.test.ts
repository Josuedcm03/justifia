import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { EXTRACTION_ERRORS, EXTRACTION_STATES } from "@/lib/extraction/states";

// Located by name, never by number: the number is whatever drizzle-kit
// generated as the next migration (DE-2).
const DRIZZLE_DIR = resolve(process.cwd(), "drizzle");
const JOURNAL_PATH = resolve(DRIZZLE_DIR, "meta/_journal.json");
const TABLE = '"ExtraccionDocumento"';

type Journal = { entries: { tag: string; when: number }[] };

function journal(): Journal {
  return JSON.parse(readFileSync(JOURNAL_PATH, "utf8")) as Journal;
}

function readSql(): string {
  const matches = readdirSync(DRIZZLE_DIR).filter((f) =>
    /^\d{4}_document_extraction\.sql$/.test(f),
  );
  expect(matches).toHaveLength(1);
  return readFileSync(resolve(DRIZZLE_DIR, matches[0]), "utf8");
}

/** Drizzle's statements, whitespace collapsed and the table qualifier dropped. */
function statements(): string[] {
  return readSql()
    .split("--> statement-breakpoint")
    .map((s) => s.replace(/\s+/g, " ").replaceAll(`${TABLE}.`, "").trim())
    .filter(Boolean);
}

/** The body of `CONSTRAINT "name" CHECK (...)`, parentheses balanced. */
function checkBody(name: string): string {
  const sql = statements().find((s) => s.startsWith("CREATE TABLE")) ?? "";
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

const list = (values: readonly string[]) =>
  values.map((v) => `'${v}'`).join(", ");

const DATA_COLUMNS = [
  "NombreEstudiante",
  "Emisor",
  "FechaEmision",
  "ReposoDesde",
  "ReposoHasta",
  "ReposoDias",
] as const;

// Every CHECK body of DE-2 (the SQL is asserted against this table, and the
// constraint-case table below against `violations`, so a drift between the
// design, the cases and the generated SQL fails one of the two).
const BODIES: Record<string, string> = {
  CK_Extraccion_Estado: `"Estado" IN (${list(EXTRACTION_STATES)})`,
  CK_Extraccion_Error: `"ErrorCodigo" IS NULL OR "ErrorCodigo" IN (${list(EXTRACTION_ERRORS)})`,
  CK_Extraccion_Reclamo: `("ReclamoId" IS NULL) = ("ReclamadaEn" IS NULL)`,
  CK_Extraccion_Procesando: `("Estado" = 'procesando') = ("ReclamoId" IS NOT NULL)`,
  CK_Extraccion_Fallida: `"Estado" <> 'fallida' OR "ErrorCodigo" IS NOT NULL`,
  CK_Extraccion_Completada: `"Estado" <> 'completada' OR ("ErrorCodigo" IS NULL AND "ProcesadoEn" IS NOT NULL AND "Motor" IS NOT NULL)`,
  CK_Extraccion_Datos: `"Estado" = 'completada' OR (${DATA_COLUMNS.map((c) => `"${c}" IS NULL`).join(" AND ")})`,
  CK_Extraccion_Reposo: `("ReposoDias" IS NULL OR "ReposoDias" > 0) AND ("ReposoHasta" IS NULL OR "ReposoDesde" IS NULL OR "ReposoHasta" >= "ReposoDesde")`,
  CK_Extraccion_Intentos: `"Intentos" >= 0`,
};

const COLUMNS: Record<string, string> = {
  DocumentoId: "bigint PRIMARY KEY NOT NULL",
  Estado: "varchar(12) DEFAULT 'pendiente' NOT NULL",
  Intentos: "smallint DEFAULT 0 NOT NULL",
  ErrorCodigo: "varchar(30)",
  ReclamoId: "uuid",
  ReclamadaEn: "timestamp with time zone",
  NombreEstudiante: "varchar(160)",
  Emisor: "varchar(200)",
  FechaEmision: "date",
  ReposoDesde: "date",
  ReposoHasta: "date",
  ReposoDias: "smallint",
  Motor: "varchar(40)",
  ProcesadoEn: "timestamp with time zone",
  CreadaEn: "timestamp with time zone DEFAULT now() NOT NULL",
  ActualizadaEn: "timestamp with time zone DEFAULT now() NOT NULL",
};

type Row = {
  estado: string;
  intentos: number;
  error: string | null;
  claimId: boolean;
  claimedAt: boolean;
  motor: string | null;
  procesadoEn: string | null;
  nombre: string | null;
  from: string | null;
  to: string | null;
  days: number | null;
};

const PENDING: Row = {
  estado: "pendiente",
  intentos: 0,
  error: null,
  claimId: false,
  claimedAt: false,
  motor: null,
  procesadoEn: null,
  nombre: null,
  from: null,
  to: null,
  days: null,
};
const DONE: Row = {
  ...PENDING,
  estado: "completada",
  motor: "nuextract3-4b/image",
  procesadoEn: "t",
};

// The nine predicates of DE-2 as functions over the table below.
const PREDICATES: Record<string, (r: Row) => boolean> = {
  CK_Extraccion_Estado: (r) => EXTRACTION_STATES.some((s) => s === r.estado),
  CK_Extraccion_Error: (r) =>
    r.error === null || EXTRACTION_ERRORS.some((e) => e === r.error),
  CK_Extraccion_Reclamo: (r) => r.claimId === r.claimedAt,
  CK_Extraccion_Procesando: (r) => (r.estado === "procesando") === r.claimId,
  CK_Extraccion_Fallida: (r) => r.estado !== "fallida" || r.error !== null,
  CK_Extraccion_Completada: (r) =>
    r.estado !== "completada" ||
    (r.error === null && r.procesadoEn !== null && r.motor !== null),
  CK_Extraccion_Datos: (r) =>
    r.estado === "completada" ||
    (r.nombre === null && r.from === null && r.to === null && r.days === null),
  CK_Extraccion_Reposo: (r) =>
    (r.days === null || r.days > 0) &&
    (r.to === null || r.from === null || r.to >= r.from),
  CK_Extraccion_Intentos: (r) => r.intentos >= 0,
};

const violations = (r: Row) =>
  Object.entries(PREDICATES)
    .filter(([, ok]) => !ok(r))
    .map(([name]) => name);

describe("document_extraction migration (DE-2)", () => {
  it("is registered once in the journal, later than request_consent", () => {
    const { entries } = journal();
    const ours = entries.filter((e) => e.tag.endsWith("_document_extraction"));
    const consent = entries.find((e) => e.tag.endsWith("_request_consent"));
    expect(ours).toHaveLength(1);
    expect(consent).toBeDefined();
    expect(ours[0].when).toBeGreaterThan(consent!.when);
  });

  describe("additive only", () => {
    it("holds one CREATE TABLE, one foreign key and one index, nothing else", () => {
      const all = statements();
      expect(all).toHaveLength(3);
      expect(all[0]).toMatch(new RegExp(`^CREATE TABLE ${TABLE} \\(`));
      expect(all[1]).toMatch(
        new RegExp(`^ALTER TABLE ${TABLE} ADD CONSTRAINT`),
      );
      expect(all[2]).toMatch(
        new RegExp(`^CREATE INDEX "IX_Extraccion_Abierta" ON ${TABLE}`),
      );
    });

    it("never drops, deletes, inserts, updates or retypes", () => {
      const sql = readSql();
      expect(sql).not.toMatch(/\bDROP\b/i);
      expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
      expect(sql).not.toMatch(/\bINSERT\b/i);
      expect(sql).not.toMatch(/^\s*UPDATE\b/im);
      expect(sql).not.toMatch(/ALTER\s+\S+\s+TYPE/i);
    });
  });

  describe("columns", () => {
    it("has exactly the DE-2 columns with their types and defaults", () => {
      const found = Object.fromEntries(
        readSql()
          .split(/\r?\n/)
          .map((line) => /^\t"(\w+)" (.+?),?$/.exec(line))
          .filter((m): m is RegExpExecArray => m !== null)
          .map((m) => [m[1], m[2]]),
      );
      expect(found).toEqual(COLUMNS);
    });

    it("stores no confidence, name-match flag, text or raw answer", () => {
      const create = statements()[0];
      for (const name of [
        "Confianza",
        "NombreCoincide",
        "Texto",
        "Respuesta",
      ]) {
        expect(create).not.toContain(`"${name}"`);
      }
      expect(Object.keys(COLUMNS)).toHaveLength(16);
    });

    it("cascades the row away with its document", () => {
      expect(statements()[1]).toMatch(
        /FOREIGN KEY \("DocumentoId"\) REFERENCES "public"\."DocumentoRespaldo"\("Id"\) ON DELETE cascade/,
      );
    });
  });

  describe("CHECK constraints", () => {
    it.each(Object.entries(BODIES))("%s matches the design", (name, body) => {
      expect(checkBody(name)).toBe(body);
    });

    it("declares only the nine constraints", () => {
      const names = [...statements()[0].matchAll(/CONSTRAINT "(\w+)" CHECK/g)]
        .map((m) => m[1])
        .sort();
      expect(names).toEqual(Object.keys(BODIES).sort());
    });

    it("lists the closed sets of states and error codes in the same order", () => {
      expect(checkBody("CK_Extraccion_Estado")).toContain(
        `(${list(EXTRACTION_STATES)})`,
      );
      expect(checkBody("CK_Extraccion_Error")).toContain(
        `(${list(EXTRACTION_ERRORS)})`,
      );
    });

    it.each([
      ["a pending row", PENDING, []],
      [
        "a completed row with all data",
        { ...DONE, nombre: "A", from: "2026-07-20", to: "2026-07-24", days: 5 },
        [],
      ],
      ["a completed row with every data column empty", DONE, []],
      [
        "a failed row with its code",
        { ...PENDING, estado: "fallida", error: "timeout", intentos: 3 },
        [],
      ],
      [
        "a processing row with a claim",
        {
          ...PENDING,
          estado: "procesando",
          claimId: true,
          claimedAt: true,
          intentos: 1,
        },
        [],
      ],
      [
        "a claim id without its claim time",
        { ...PENDING, estado: "procesando", claimId: true },
        ["CK_Extraccion_Reclamo"],
      ],
      [
        "processing without a claim",
        { ...PENDING, estado: "procesando" },
        ["CK_Extraccion_Procesando"],
      ],
      [
        "a claim on a pending row",
        { ...PENDING, claimId: true, claimedAt: true },
        ["CK_Extraccion_Procesando"],
      ],
      [
        "failed without a code",
        { ...PENDING, estado: "fallida" },
        ["CK_Extraccion_Fallida"],
      ],
      [
        "completed without an engine",
        { ...DONE, motor: null },
        ["CK_Extraccion_Completada"],
      ],
      [
        "completed with an error code",
        { ...DONE, error: "timeout" },
        ["CK_Extraccion_Completada"],
      ],
      [
        "data on a pending row",
        { ...PENDING, nombre: "A" },
        ["CK_Extraccion_Datos"],
      ],
      [
        "rest days on a failed row",
        { ...PENDING, estado: "fallida", error: "timeout", days: 3 },
        ["CK_Extraccion_Datos"],
      ],
      [
        "rest to before rest from",
        { ...DONE, from: "2026-07-24", to: "2026-07-20" },
        ["CK_Extraccion_Reposo"],
      ],
      [
        "rest days equal to zero",
        { ...DONE, days: 0 },
        ["CK_Extraccion_Reposo"],
      ],
      ["a lone rest date", { ...DONE, from: "2026-07-20" }, []],
      [
        "negative attempts",
        { ...PENDING, intentos: -1 },
        ["CK_Extraccion_Intentos"],
      ],
      [
        "an unknown state",
        { ...PENDING, estado: "hecha" },
        ["CK_Extraccion_Estado"],
      ],
      [
        "an unknown error code",
        { ...PENDING, error: "boom" },
        ["CK_Extraccion_Error"],
      ],
    ] as [string, Row, string[]][])("%s", (_name, row, expected) => {
      expect(violations(row)).toEqual(expected);
    });
  });

  it("indexes the open rows by creation time", () => {
    expect(statements()[2]).toMatch(
      /USING btree \("CreadaEn"\) WHERE "Estado" IN \('pendiente', 'procesando'\);$/,
    );
  });
});
