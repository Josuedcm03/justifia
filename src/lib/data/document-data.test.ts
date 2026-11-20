// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { documentoDatoManual, documentoRespaldo, solicitud } from "@/db/schema";
import { documentDataRecordedEvent } from "@/lib/audit/events";
import type { RequestScope } from "@/lib/intake/request-scope";

import { createDbDouble, type Step } from "./test-support/db-double";

vi.mock("server-only", () => ({}));

const { holder, insertAuditMock } = vi.hoisted(() => ({
  holder: { current: null as unknown },
  insertAuditMock: vi.fn(),
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
vi.mock("@/lib/data/audit", () => ({ insertAuditEvents: insertAuditMock }));

import { saveDocumentData } from "@/lib/data/document-data";

const SCOPE: RequestScope = { kind: "facultad", facultadId: 3 };
const ACTOR = 20;
const REQUEST = 12;
const DOCUMENT = 41;
const NOW = new Date("2026-11-19T15:00:00.000Z");

type Saved = Parameters<typeof saveDocumentData>[0]["data"];

const EMPTY: Saved = {
  studentName: null,
  issuer: null,
  issueDate: null,
  restFrom: null,
  restTo: null,
  type: null,
  hasSignature: null,
  hasSeal: null,
};

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

function save(
  data: Partial<Saved>,
  overrides: Partial<Parameters<typeof saveDocumentData>[0]> = {},
) {
  return saveDocumentData(
    {
      actorId: ACTOR,
      scope: SCOPE,
      solicitudId: REQUEST,
      documentoId: DOCUMENT,
      data: { ...EMPTY, ...data },
      ...overrides,
    },
    NOW,
  );
}

// Statement scripts of `saveDocumentData`, one per phase: the locked request,
// the document with its three marks, and the manual record (none or one).
const lock = (estado = "pendiente"): Step => ({
  kind: "select",
  rows: [{ id: REQUEST, estado }],
});
const noRequest: Step = { kind: "select", rows: [] };
const document = (
  marks: Partial<Pick<Saved, "type" | "hasSignature" | "hasSeal">> = {},
): Step => ({
  kind: "select",
  rows: [
    {
      id: DOCUMENT,
      type: null,
      hasSignature: null,
      hasSeal: null,
      ...marks,
    },
  ],
});
const noDocument: Step = { kind: "select", rows: [] };
const noManual: Step = { kind: "select", rows: [] };
const manual = (stored: Partial<Saved> = {}): Step => ({
  kind: "select",
  rows: [
    {
      studentName: null,
      issuer: null,
      issueDate: null,
      restFrom: null,
      restTo: null,
      ...stored,
    },
  ],
});
const write = (kind: "update" | "insert" | "delete"): Step => ({
  kind,
  rows: [],
});

function writesOf(double: ReturnType<typeof use>) {
  return double.log
    .filter((entry) => entry.kind !== "select")
    .map((entry) => ({
      kind: entry.kind,
      table: entry.table,
      values: entry.values,
      set: entry.set,
    }));
}

beforeEach(() => {
  insertAuditMock.mockReset().mockResolvedValue(undefined);
});

describe("saveDocumentData: guards (MD-6, MD-7)", () => {
  it("answers not_found without a query for a scope of none", async () => {
    const double = use([]);

    const result = await save(
      { issuer: "Clinica Santa Fe" },
      { scope: { kind: "none" } },
    );

    expect(result).toEqual({ ok: false, reason: "not_found" });
    expect(double.log).toHaveLength(0);
    expect(double.transactions).toBe(0);
    expect(insertAuditMock).not.toHaveBeenCalled();
  });

  it("answers not_found for an unknown or out-of-scope request, with no write and no audit row", async () => {
    const double = use([noRequest]);

    const result = await save({ issuer: "Clinica Santa Fe" });

    expect(result).toEqual({ ok: false, reason: "not_found" });
    expect(double.log).toHaveLength(1);
    expect(writesOf(double)).toEqual([]);
    expect(insertAuditMock).not.toHaveBeenCalled();
    // The request is looked up by id inside the caller's scope (facultad 3).
    const query = render(double.log[0].where);
    expect(query.params).toEqual(expect.arrayContaining([REQUEST, 3]));
  });

  it("reads the request with a FOR UPDATE lock, first, inside the transaction (race of MD-6)", async () => {
    const double = use([lock("aprobada")]);

    await save({ issuer: "Clinica Santa Fe" });

    expect(double.transactions).toBe(1);
    expect(double.log[0].table).toBe(solicitud);
    expect(double.log[0].inTransaction).toBe(true);
    expect(double.log[0].lock?.strength).toBe("update");
  });

  it.each([
    "aprobada",
    "rechazada",
    "devuelta",
    "en_revision_coordinacion",
    "borrador",
  ])(
    "refuses a request in %s as not_editable, with no further read, no write and no audit row",
    async (estado) => {
      const double = use([lock(estado)]);

      const result = await save({ issuer: "Clinica Santa Fe" });

      expect(result).toEqual({ ok: false, reason: "not_editable" });
      // The state is checked right after the lock: the document is never read.
      expect(double.log).toHaveLength(1);
      expect(writesOf(double)).toEqual([]);
      expect(insertAuditMock).not.toHaveBeenCalled();
    },
  );

  it("accepts a request in pendiente (triangulates the refusals)", async () => {
    use([lock("pendiente"), document(), noManual, write("insert")]);

    expect(await save({ issuer: "Clinica Santa Fe" })).toEqual({
      ok: true,
      changed: true,
    });
  });

  it("answers not_found for an unknown document, a document of another request, a retired one and a staff-uploaded one alike", async () => {
    const double = use([lock(), noDocument]);

    const result = await save({ issuer: "Clinica Santa Fe" });

    expect(result).toEqual({ ok: false, reason: "not_found" });
    expect(double.log).toHaveLength(2);
    expect(writesOf(double)).toEqual([]);
    expect(insertAuditMock).not.toHaveBeenCalled();

    // The one query that decides it: this document, of this request, valido,
    // not retired and uploaded by the student.
    expect(double.log[1].table).toBe(documentoRespaldo);
    const query = render(double.log[1].where);
    expect(query.params).toEqual(
      expect.arrayContaining([DOCUMENT, REQUEST, "valido"]),
    );
    expect(query.sql).toContain('"RetiradoEn" is null');
    expect(query.sql).toContain('"SubidoPorId" is null');
  });
});

describe("saveDocumentData: writes (MD-1, MD-2, MD-9, MD-32, MD-33)", () => {
  it("saves nothing when every submitted value equals the stored one", async () => {
    const double = use([
      lock(),
      document({ type: "otro", hasSignature: false, hasSeal: null }),
      manual({
        issuer: "Clinica Santa Fe",
        restFrom: "2026-11-05",
        restTo: "2026-11-07",
      }),
    ]);

    const result = await save({
      issuer: "Clinica Santa Fe",
      restFrom: "2026-11-05",
      restTo: "2026-11-07",
      type: "otro",
      hasSignature: false,
      hasSeal: null,
    });

    expect(result).toEqual({ ok: true, changed: false });
    expect(writesOf(double)).toEqual([]);
    expect(insertAuditMock).not.toHaveBeenCalled();
  });

  it("saves nothing when nothing is stored and nothing is submitted", async () => {
    const double = use([lock(), document(), noManual]);

    expect(await save({})).toEqual({ ok: true, changed: false });
    expect(writesOf(double)).toEqual([]);
    expect(insertAuditMock).not.toHaveBeenCalled();
  });

  it("writes the mark update, the manual insert and exactly one audit row for an issuer and a firma, in one transaction", async () => {
    const double = use([
      lock(),
      document(),
      noManual,
      write("update"),
      write("insert"),
    ]);

    const result = await save({
      issuer: "Clinica Santa Fe",
      hasSignature: false,
    });

    expect(result).toEqual({ ok: true, changed: true });
    expect(writesOf(double)).toEqual([
      {
        kind: "update",
        table: documentoRespaldo,
        values: undefined,
        set: { tipoDocumento: null, tieneFirma: false, tieneSello: null },
      },
      {
        kind: "insert",
        table: documentoDatoManual,
        values: {
          documentoId: DOCUMENT,
          nombreEstudiante: null,
          emisor: "Clinica Santa Fe",
          fechaEmision: null,
          reposoDesde: null,
          reposoHasta: null,
          registradoPorId: ACTOR,
          actualizadoEn: NOW,
        },
        set: undefined,
      },
    ]);
    expect(double.transactions).toBe(1);
    expect(double.log.every((entry) => entry.inTransaction)).toBe(true);

    expect(insertAuditMock).toHaveBeenCalledTimes(1);
    expect(insertAuditMock).toHaveBeenCalledWith(double.tx, ACTOR, [
      documentDataRecordedEvent({
        documentoId: DOCUMENT,
        solicitudId: REQUEST,
        campos: ["emisor", "tieneFirma"],
      }),
    ]);
  });

  it("names the changed fields in the order of the closed list, one row for any number of changes", async () => {
    use([lock(), document(), noManual, write("update"), write("insert")]);

    await save({
      studentName: "Ana Lopez",
      issuer: "Clinica Santa Fe",
      issueDate: "2026-11-05",
      restFrom: "2026-11-05",
      restTo: "2026-11-07",
      type: "constancia_medica",
      hasSignature: true,
      hasSeal: false,
    });

    expect(insertAuditMock).toHaveBeenCalledTimes(1);
    const [, , events] = insertAuditMock.mock.calls[0];
    expect(events).toEqual([
      documentDataRecordedEvent({
        documentoId: DOCUMENT,
        solicitudId: REQUEST,
        campos: [
          "nombreEstudiante",
          "emisor",
          "fechaEmision",
          "reposo",
          "tipoDocumento",
          "tieneFirma",
          "tieneSello",
        ],
      }),
    ]);
  });

  it("takes the audit actor from the actorId argument, not from the data", async () => {
    use([lock(), document(), noManual, write("insert")]);

    await save(
      { issuer: "Clinica Santa Fe", ...{ actorId: 999 } } as Partial<Saved>,
      { actorId: 31 },
    );

    expect(insertAuditMock.mock.calls[0][1]).toBe(31);
  });

  it("stores the rest period as two dates and no day count, and reports it as one field", async () => {
    const double = use([lock(), document(), noManual, write("insert")]);

    await save({ restFrom: "2026-11-05", restTo: "2026-11-07" });

    const [insert] = writesOf(double);
    expect(insert.values).toMatchObject({
      reposoDesde: "2026-11-05",
      reposoHasta: "2026-11-07",
    });
    expect(Object.keys(insert.values as object).sort()).toEqual([
      "actualizadoEn",
      "documentoId",
      "emisor",
      "fechaEmision",
      "nombreEstudiante",
      "registradoPorId",
      "reposoDesde",
      "reposoHasta",
    ]);
    expect(insertAuditMock.mock.calls[0][2]).toEqual([
      documentDataRecordedEvent({
        documentoId: DOCUMENT,
        solicitudId: REQUEST,
        campos: ["reposo"],
      }),
    ]);
  });

  it("reports a change of only the rest end as the reposo field", async () => {
    const double = use([
      lock(),
      document(),
      manual({ restFrom: "2026-11-05", restTo: "2026-11-07" }),
      write("update"),
    ]);

    await save({ restFrom: "2026-11-05", restTo: "2026-11-09" });

    expect(writesOf(double)).toHaveLength(1);
    expect(insertAuditMock.mock.calls[0][2]).toEqual([
      documentDataRecordedEvent({
        documentoId: DOCUMENT,
        solicitudId: REQUEST,
        campos: ["reposo"],
      }),
    ]);
  });

  it("updates the stored manual record, with the actor and the instant, when a value is corrected", async () => {
    const double = use([
      lock(),
      document(),
      manual({ issuer: "Clinica Santa Fe", studentName: "Ana Lopez" }),
      write("update"),
    ]);

    const result = await save({
      issuer: "Clinica Santa Fe S.A.",
      studentName: "Ana Lopez",
    });

    expect(result).toEqual({ ok: true, changed: true });
    expect(writesOf(double)).toEqual([
      {
        kind: "update",
        table: documentoDatoManual,
        values: undefined,
        set: {
          nombreEstudiante: "Ana Lopez",
          emisor: "Clinica Santa Fe S.A.",
          fechaEmision: null,
          reposoDesde: null,
          reposoHasta: null,
          registradoPorId: ACTOR,
          actualizadoEn: NOW,
        },
      },
    ]);
    const query = render(double.log[3].where);
    expect(query.params).toEqual(expect.arrayContaining([DOCUMENT]));
  });

  it("deletes the manual record when the last manual value is cleared", async () => {
    const double = use([
      lock(),
      document(),
      manual({ issuer: "Clinica Santa Fe" }),
      write("delete"),
    ]);

    const result = await save({});

    expect(result).toEqual({ ok: true, changed: true });
    expect(writesOf(double)).toEqual([
      {
        kind: "delete",
        table: documentoDatoManual,
        values: undefined,
        set: undefined,
      },
    ]);
    expect(render(double.log[3].where).params).toEqual(
      expect.arrayContaining([DOCUMENT]),
    );
    expect(insertAuditMock.mock.calls[0][2]).toEqual([
      documentDataRecordedEvent({
        documentoId: DOCUMENT,
        solicitudId: REQUEST,
        campos: ["emisor"],
      }),
    ]);
  });

  it("keeps the other manual values when one is cleared", async () => {
    const double = use([
      lock(),
      document(),
      manual({ issuer: "Clinica Santa Fe", studentName: "Ana Lopez" }),
      write("update"),
    ]);

    await save({ studentName: "Ana Lopez" });

    const writes = writesOf(double);
    expect(writes.map((w) => w.kind)).toEqual(["update"]);
    expect(writes[0].set).toMatchObject({
      nombreEstudiante: "Ana Lopez",
      emisor: null,
    });
  });

  it("clears a rest period as one unit and deletes nothing while another value stays", async () => {
    const double = use([
      lock(),
      document(),
      manual({
        issuer: "Clinica Santa Fe",
        restFrom: "2026-11-05",
        restTo: "2026-11-07",
      }),
      write("update"),
    ]);

    await save({ issuer: "Clinica Santa Fe" });

    expect(writesOf(double)[0].set).toMatchObject({
      reposoDesde: null,
      reposoHasta: null,
    });
    expect(insertAuditMock.mock.calls[0][2]).toEqual([
      documentDataRecordedEvent({
        documentoId: DOCUMENT,
        solicitudId: REQUEST,
        campos: ["reposo"],
      }),
    ]);
  });

  it("updates only the document marks for a mark or type change, and leaves the manual table alone", async () => {
    const double = use([
      lock(),
      document({ hasSignature: true }),
      manual({ issuer: "Clinica Santa Fe" }),
      write("update"),
    ]);

    const result = await save({
      issuer: "Clinica Santa Fe",
      type: "constancia_institucional",
      hasSignature: true,
      hasSeal: true,
    });

    expect(result).toEqual({ ok: true, changed: true });
    expect(writesOf(double)).toEqual([
      {
        kind: "update",
        table: documentoRespaldo,
        values: undefined,
        set: {
          tipoDocumento: "constancia_institucional",
          tieneFirma: true,
          tieneSello: true,
        },
      },
    ]);
    expect(render(double.log[3].where).params).toEqual(
      expect.arrayContaining([DOCUMENT]),
    );
    expect(insertAuditMock.mock.calls[0][2]).toEqual([
      documentDataRecordedEvent({
        documentoId: DOCUMENT,
        solicitudId: REQUEST,
        campos: ["tipoDocumento", "tieneSello"],
      }),
    ]);
  });

  it("returns a mark to not registered by writing null, apart from No", async () => {
    const double = use([
      lock(),
      document({ hasSignature: false, hasSeal: false }),
      noManual,
      write("update"),
    ]);

    await save({ hasSignature: false, hasSeal: null });

    expect(writesOf(double)[0].set).toEqual({
      tipoDocumento: null,
      tieneFirma: false,
      tieneSello: null,
    });
    expect(insertAuditMock.mock.calls[0][2]).toEqual([
      documentDataRecordedEvent({
        documentoId: DOCUMENT,
        solicitudId: REQUEST,
        campos: ["tieneSello"],
      }),
    ]);
  });

  it("never touches the extraction row or the request state, whatever the save", async () => {
    const double = use([
      lock(),
      document(),
      noManual,
      write("update"),
      write("insert"),
    ]);

    await save({
      issuer: "Clinica Santa Fe",
      type: "otro",
      hasSignature: true,
    });

    const tables = writesOf(double).map((w) => w.table);
    expect(tables).toEqual([documentoRespaldo, documentoDatoManual]);
    // The request is only locked and read, never updated.
    expect(double.log.filter((e) => e.table === solicitud)).toHaveLength(1);
    expect(double.log[0].kind).toBe("select");
    expect(double.log.map((e) => e.kind)).toEqual([
      "select",
      "select",
      "select",
      "update",
      "insert",
    ]);
  });

  it("rolls back everything when the audit insert fails: the error escapes the transaction after the data writes", async () => {
    const failure = new Error("audit unavailable");
    insertAuditMock.mockRejectedValue(failure);
    const double = use([
      lock(),
      document(),
      noManual,
      write("update"),
      write("insert"),
    ]);

    await expect(
      save({ issuer: "Clinica Santa Fe", hasSignature: true }),
    ).rejects.toBe(failure);

    // Both writes ran inside the transaction that the failure aborts, and the
    // audit insert went through that same handle.
    expect(writesOf(double)).toHaveLength(2);
    expect(double.log.every((entry) => entry.inTransaction)).toBe(true);
    expect(insertAuditMock.mock.calls[0][0]).toBe(double.tx);
  });

  it("rolls back everything when a statement fails after the first data write, and writes no audit row", async () => {
    const failure = new Error("constraint failed");
    const double = use([
      lock(),
      document(),
      noManual,
      write("update"),
      { kind: "insert", error: failure },
    ]);

    await expect(
      save({ issuer: "Clinica Santa Fe", hasSignature: true }),
    ).rejects.toBe(failure);

    expect(double.log.map((entry) => entry.kind)).toEqual([
      "select",
      "select",
      "select",
      "update",
      "insert",
    ]);
    expect(double.log.every((entry) => entry.inTransaction)).toBe(true);
    expect(insertAuditMock).not.toHaveBeenCalled();
  });
});

describe("saveDocumentData: logs (MD-11)", () => {
  const spies = (["log", "info", "warn", "error", "debug"] as const).map(
    (method) => vi.spyOn(console, method).mockImplementation(() => {}),
  );

  afterEach(() => {
    for (const spy of spies) spy.mockClear();
  });

  it("writes no manual value to any log, on success or on failure", async () => {
    use([lock(), document(), noManual, write("update"), write("insert")]);
    await save({
      studentName: "Ana Lopez",
      issuer: "Clinica Santa Fe",
      type: "constancia_medica",
      hasSignature: false,
    });

    insertAuditMock.mockRejectedValueOnce(new Error("audit unavailable"));
    use([lock(), document(), noManual, write("update"), write("insert")]);
    await save({
      studentName: "Ana Lopez",
      issuer: "Clinica Santa Fe",
      type: "constancia_medica",
      hasSignature: false,
    }).catch(() => undefined);

    const output = JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
    expect(output).not.toMatch(/Ana|Lopez|Clinica|Santa Fe|constancia_medica/);
  });
});

// Structural pins (MD-9, MD-11, MD-22; VS-2). The manual record and the three
// marks have one writer, which reads no signal and does not touch extraction.
describe("document data write surface", () => {
  const SRC = join(process.cwd(), "src");
  const MODULE = "lib/data/document-data.ts";

  type Verb = "insert" | "update" | "delete";
  const WRITE_PATTERNS: Record<Verb, RegExp[]> = {
    insert: [
      /\.insert\(\s*documentoDatoManual\b/,
      /insert\s+into\s+"?DocumentoDatoManual"?/i,
    ],
    update: [
      /\.update\(\s*documentoDatoManual\b/,
      /update\s+"?DocumentoDatoManual"?/i,
    ],
    delete: [
      /\.delete\(\s*documentoDatoManual\b/,
      /delete\s+from\s+"?DocumentoDatoManual"?/i,
    ],
  };

  function manualWritesOf(source: string): Verb[] {
    return (Object.keys(WRITE_PATTERNS) as Verb[]).filter((verb) =>
      WRITE_PATTERNS[verb].some((pattern) => pattern.test(source)),
    );
  }

  /** The text between the parenthesis that opens at `open` and its match. */
  function argumentsAt(source: string, open: number): string {
    let depth = 0;
    for (let i = open; i < source.length; i += 1) {
      if (source[i] === "(") depth += 1;
      if (source[i] === ")") {
        depth -= 1;
        if (depth === 0) return source.slice(open + 1, i);
      }
    }
    return source.slice(open + 1);
  }

  /** What each `.update(documentoRespaldo).set(...)` / `.insert(...).values(...)` writes. */
  function documentWrites(source: string): string[] {
    return [
      ...source.matchAll(
        /\.(?:insert|update)\(\s*documentoRespaldo\s*\)\s*\.(?:values|set)\(/g,
      ),
    ].map((m) => argumentsAt(source, m.index + m[0].length - 1));
  }

  const MARK_COLUMN = /\b(?:tipoDocumento|tieneFirma|tieneSello)\b/;
  const MARK_SQL = /"(?:TipoDocumento|TieneFirma|TieneSello)"/;

  function writesMarks(source: string): boolean {
    return (
      documentWrites(source).some((block) => MARK_COLUMN.test(block)) ||
      /(?:update|insert\s+into)\s+"?DocumentoRespaldo"?[^;`]*"(?:TipoDocumento|TieneFirma|TieneSello)"/i.test(
        source,
      ) ||
      (MARK_SQL.test(source) && /\bupdate\s+"DocumentoRespaldo"/i.test(source))
    );
  }

  function productionSources(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return productionSources(path);
      return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
        ? [path]
        : [];
    });
  }

  const source = readFileSync(join(SRC, MODULE), "utf8");
  const others = productionSources(SRC)
    .map((file) => relative(SRC, file).split(sep).join("/"))
    .filter((name) => name !== MODULE);

  it("detects the manual record write shapes it guards against", () => {
    expect(manualWritesOf("tx.insert(documentoDatoManual).values(r)")).toEqual([
      "insert",
    ]);
    expect(manualWritesOf("db.update( documentoDatoManual ).set(x)")).toEqual([
      "update",
    ]);
    expect(manualWritesOf("db.delete(documentoDatoManual)")).toEqual([
      "delete",
    ]);
    expect(
      manualWritesOf('sql`DELETE FROM "DocumentoDatoManual" WHERE x`'),
    ).toEqual(["delete"]);
    expect(manualWritesOf("db.select().from(documentoDatoManual)")).toEqual([]);
  });

  it("detects a write of the three mark columns it guards against", () => {
    expect(
      writesMarks(
        "tx.update(documentoRespaldo).set({ tieneFirma: true }).where(x)",
      ),
    ).toBe(true);
    expect(
      writesMarks(
        "tx.insert(documentoRespaldo).values({ pathname, tipoDocumento: 'otro' })",
      ),
    ).toBe(true);
    expect(
      writesMarks(
        'sql`UPDATE "DocumentoRespaldo" SET "TieneSello" = true WHERE x`',
      ),
    ).toBe(true);
    expect(
      writesMarks(
        "tx.update(documentoRespaldo).set({ retiradoEn: now }).where(x)",
      ),
    ).toBe(false);
    expect(
      writesMarks(
        "db.select({ tieneFirma: documentoRespaldo.tieneFirma }).from(documentoRespaldo)",
      ),
    ).toBe(false);
  });

  it("is the writer of the manual record and of the marks, so the pin is not vacuous", () => {
    expect(manualWritesOf(source)).toEqual(["insert", "update", "delete"]);
    expect(writesMarks(source)).toBe(true);
  });

  it("has no module outside document-data.ts that writes the manual record", () => {
    expect(others.length).toBeGreaterThan(0);

    const offenders = others.flatMap((name) =>
      manualWritesOf(readFileSync(join(SRC, name), "utf8")).map(
        (verb) => `${name}: ${verb}`,
      ),
    );

    expect(offenders).toEqual([]);
  });

  it("has no module outside document-data.ts that writes the type or a mark", () => {
    const offenders = others.filter((name) =>
      writesMarks(readFileSync(join(SRC, name), "utf8")),
    );

    expect(offenders).toEqual([]);
  });

  it("does not import the signals module (VS-2) and never names the extraction table or the fingerprint", () => {
    expect(source).not.toMatch(/from\s+"@\/lib\/data\/signals"/);
    expect(source).not.toMatch(/from\s+"@\/lib\/signals/);
    expect(source).not.toMatch(/extraccionDocumento|ExtraccionDocumento/);
    expect(source).not.toMatch(/huellaSha256|HuellaSha256/);
  });

  it("logs no manual value: any console call names ids, states or codes only", () => {
    const calls = [...source.matchAll(/console\.\w+\(([\s\S]*?)\);/g)].map(
      (m) => m[1],
    );
    for (const call of calls) {
      expect(call).not.toMatch(
        /\bdata\b|studentName|issuer|issueDate|restFrom|restTo|nombre|emisor|message|stack/i,
      );
    }
    // The module writes no log of its own: a failure escapes to the caller.
    expect(calls).toEqual([]);
  });
});
