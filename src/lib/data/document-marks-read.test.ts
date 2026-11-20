// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PgDialect } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDbDouble, type Step } from "./test-support/db-double";

vi.mock("server-only", () => ({}));

const { holder } = vi.hoisted(() => ({
  holder: { current: null as unknown },
}));

vi.mock("@/db", () => ({
  db: new Proxy(
    {},
    {
      get: (_t, prop) =>
        (holder.current as Record<string | symbol, unknown>)[prop],
    },
  ),
}));

import { listDocumentMarks } from "@/lib/data/document-marks-read";
import { listExtractions } from "@/lib/data/extraction";

// MD-30: the narrow read behind the coordination block. It carries the type,
// the firma and the sello of each current student document and nothing else:
// the key set is asserted, so no name, issuer, date or rest period can leak
// into a screen the coordinator opens (RNF-01, RNF-02).

const REQUEST = 42;

function use(script: Step[]) {
  const double = createDbDouble(script);
  holder.current = double.db;
  return double;
}

function render(fragment: unknown) {
  return new PgDialect().sqlToQuery(
    fragment as Parameters<PgDialect["sqlToQuery"]>[0],
  );
}

beforeEach(() => {
  holder.current = null;
});

const UNREGISTERED = {
  documentoId: 12,
  nombreOriginal: "foto.jpg",
  tipoDocumento: null,
  tieneFirma: null,
  tieneSello: null,
};
const REGISTERED = {
  documentoId: 11,
  nombreOriginal: "constancia.pdf",
  tipoDocumento: "constancia_medica",
  tieneFirma: false,
  tieneSello: true,
};

describe("listDocumentMarks (MD-30, RF-14 b, RF-14 d)", () => {
  it("returns, for each current document, exactly its id, name, type, firma and sello", async () => {
    use([{ kind: "select", rows: [REGISTERED, UNREGISTERED] }]);

    const read = await listDocumentMarks(REQUEST);

    expect(read).toEqual({
      degraded: false,
      data: [
        {
          documentoId: 11,
          nombreOriginal: "constancia.pdf",
          type: "constancia_medica",
          hasSignature: false,
          hasSeal: true,
        },
        {
          documentoId: 12,
          nombreOriginal: "foto.jpg",
          type: null,
          hasSignature: null,
          hasSeal: null,
        },
      ],
    });
    for (const item of read.data) {
      expect(Object.keys(item).sort()).toEqual([
        "documentoId",
        "hasSeal",
        "hasSignature",
        "nombreOriginal",
        "type",
      ]);
    }
  });

  it.each([
    ["not registered", null, null, null],
    ["firma yes, sello yes", "otro", true, true],
    ["firma no, sello no", "constancia_institucional", false, false],
  ] as const)(
    "keeps the three mark states apart: %s",
    async (_label, type, firma, sello) => {
      use([
        {
          kind: "select",
          rows: [
            {
              ...UNREGISTERED,
              tipoDocumento: type,
              tieneFirma: firma,
              tieneSello: sello,
            },
          ],
        },
      ]);

      const { data } = await listDocumentMarks(REQUEST);

      expect(data[0]).toMatchObject({
        type,
        hasSignature: firma,
        hasSeal: sello,
      });
    },
  );

  it("leaks nothing even when the row carries more columns than the read asked for", async () => {
    use([
      {
        kind: "select",
        rows: [
          {
            ...REGISTERED,
            nombreEstudiante: "Ana Lopez",
            emisor: "Clinica Central",
            fechaEmision: "2026-10-19",
            reposoDesde: "2026-10-19",
            reposoHasta: "2026-10-23",
            manualEmisor: "Hospital Nuevo",
          },
        ],
      },
    ]);

    const read = await listDocumentMarks(REQUEST);

    const text = JSON.stringify(read);
    for (const value of [
      "Ana Lopez",
      "Clinica Central",
      "2026-10-19",
      "2026-10-23",
      "Hospital Nuevo",
    ]) {
      expect(text).not.toContain(value);
    }
  });

  it("selects the id, the name and the three mark columns, nothing more", async () => {
    const double = use([{ kind: "select", rows: [] }]);

    await listDocumentMarks(REQUEST);

    expect(Object.keys(double.log[0].selection as object)).toEqual([
      "documentoId",
      "nombreOriginal",
      "tipoDocumento",
      "tieneFirma",
      "tieneSello",
    ]);
  });

  it("filters the documents exactly as listExtractions does and orders them by id", async () => {
    const marks = use([{ kind: "select", rows: [] }]);
    await listDocumentMarks(REQUEST);
    const extractions = use([{ kind: "select", rows: [] }]);
    await listExtractions(REQUEST);

    const mine = render(marks.log[0].where);
    const theirs = render(extractions.log[0].where);
    expect(mine.sql).toBe(theirs.sql);
    expect(mine.params).toEqual(theirs.params);
    expect(mine.params).toEqual([REQUEST, "valido", "no_aplica"]);
    expect(render(marks.log[0].orderBy?.[0]).sql).toBe(
      '"DocumentoRespaldo"."Id" asc',
    );
  });

  it("returns an empty degraded result, with no partial data, when the query throws, logging the error name only", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    use([
      { kind: "select", error: new Error("password authentication failed") },
    ]);

    await expect(listDocumentMarks(REQUEST)).resolves.toEqual({
      data: [],
      degraded: true,
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]).toEqual([
      "document_marks_read_failed",
      { solicitudId: REQUEST, code: "Error" },
    ]);
    expect(JSON.stringify(spy.mock.calls)).not.toContain("password");
    spy.mockRestore();
  });

  it("logs the fixed code for a thrown value that is not an error", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    use([{ kind: "select", error: "boom" }]);

    await listDocumentMarks(REQUEST);

    expect(spy.mock.calls[0]).toEqual([
      "document_marks_read_failed",
      { solicitudId: REQUEST, code: "unknown" },
    ]);
    spy.mockRestore();
  });
});

describe("listDocumentMarks statement (MD-30, RNF-02)", () => {
  const logged: { sql: string; params: unknown[] }[] = [];

  async function statement() {
    logged.length = 0;
    // A driver-less drizzle instance: the logger sees the emitted statement,
    // then the missing driver makes the read fail soft.
    holder.current = drizzle.mock({
      logger: {
        logQuery(sql: string, params: unknown[]) {
          logged.push({ sql, params });
        },
      },
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    await listDocumentMarks(REQUEST);
    expect(logged).toHaveLength(1);
    return logged[0].sql;
  }

  it("selects only the three mark columns, the id and the name", async () => {
    const sql = await statement();
    const selected = sql.slice(0, sql.indexOf(' from "DocumentoRespaldo"'));

    expect(selected).toBe(
      'select "DocumentoRespaldo"."Id", "DocumentoRespaldo"."NombreOriginal", "DocumentoRespaldo"."TipoDocumento", "DocumentoRespaldo"."TieneFirma", "DocumentoRespaldo"."TieneSello"',
    );
  });

  it("never reads the manual table nor an extracted value", async () => {
    const sql = await statement();

    expect(sql).not.toContain("DocumentoDatoManual");
    for (const column of [
      "NombreEstudiante",
      '"Emisor"',
      "FechaEmision",
      "ReposoDesde",
      "ReposoHasta",
      "ReposoDias",
    ]) {
      expect(sql).not.toContain(column);
    }
  });

  it("reads the extraction state only to leave out a no_aplica row", async () => {
    const sql = await statement();

    expect(sql).toMatch(
      /^select .* from "DocumentoRespaldo" left join "ExtraccionDocumento" on "ExtraccionDocumento"\."DocumentoId" = "DocumentoRespaldo"\."Id" where .* order by "DocumentoRespaldo"\."Id" asc$/,
    );
  });
});

describe("document-marks-read module (MD-30)", () => {
  const text = readFileSync(
    join(process.cwd(), "src/lib/data/document-marks-read.ts"),
    "utf8",
  );

  it("is a pure read: no write, no audit row, no signal", () => {
    expect(text).not.toMatch(/\.(insert|update|delete)\(/);
    expect(text).not.toMatch(/insertAuditEvents|recordRequestRead/);
    expect(text).not.toMatch(
      /@\/lib\/data\/signals|@\/lib\/data\/document-data"/,
    );
  });

  it("never names the manual table", () => {
    expect(text).not.toMatch(/documentoDatoManual/);
  });
});
