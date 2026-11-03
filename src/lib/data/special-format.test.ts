// @vitest-environment node
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeDocumentStore } from "@/lib/intake/fakes";
import type { RequestScope } from "@/lib/intake/request-scope";

import { createDbDouble, type Step } from "./test-support/db-double";

vi.mock("server-only", () => ({}));

const { holder, insertAuditMock, unblockMock } = vi.hoisted(() => ({
  holder: { current: null as unknown },
  insertAuditMock: vi.fn(),
  unblockMock: vi.fn(),
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
vi.mock("@/lib/data/remision", () => ({ unblockSpecialFormat: unblockMock }));

import {
  attachSpecialFormat,
  getSpecialFormatContext,
} from "@/lib/data/special-format";

const SCOPE: RequestScope = { kind: "facultad", facultadId: 3 };
const ACTOR = 20;
const REQUEST = 12;
const PATH = `intake/${REQUEST}/0b9f6c1e-4f0a-4d57-9a64-2f3f8f1d2c11.pdf`;
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00];
const EXE = [0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00];

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

// Statement scripts of `attachSpecialFormat`, one per phase.
const context: Step = { kind: "select", rows: [{ id: REQUEST }] };
const unreferenced: Step = { kind: "select", rows: [] };
const lock: Step = { kind: "select", rows: [{ id: REQUEST }] };
const noFormatYet: Step = { kind: "select", rows: [] };
const insertDoc = (id = 21): Step => ({ kind: "insert", rows: [{ id }] });

function input(
  overrides: Partial<{
    pathname: string;
    nombreOriginal: string;
    solicitudId: number;
  }> = {},
) {
  return {
    actorId: ACTOR,
    scope: SCOPE,
    solicitudId: REQUEST,
    pathname: PATH,
    nombreOriginal: "formato.pdf",
    ...overrides,
  };
}

beforeEach(() => {
  insertAuditMock.mockReset().mockResolvedValue(undefined);
  unblockMock
    .mockReset()
    .mockResolvedValue({ unblockedIds: [5], dispatchIds: [5, 6] });
});

describe("getSpecialFormatContext (TR-15)", () => {
  it("returns the request when it is in scope, approved, marked and has no format", async () => {
    const double = use([context]);

    expect(await getSpecialFormatContext(REQUEST, SCOPE)).toEqual({
      solicitudId: REQUEST,
    });

    const query = render(double.log[0].where);
    expect(query.params).toEqual(
      expect.arrayContaining([REQUEST, "aprobada", 3]),
    );
    expect(query.sql).toContain('"FormatoEspecial"');
    expect(query.sql.toLowerCase()).toContain("not exists");
  });

  it("returns null for an unknown, unmarked, unapproved, formatted or out-of-scope request alike", async () => {
    use([{ kind: "select", rows: [] }]);

    expect(await getSpecialFormatContext(REQUEST, SCOPE)).toBeNull();
  });

  it("returns null without a query for a scope of none", async () => {
    const double = use([]);

    expect(await getSpecialFormatContext(REQUEST, { kind: "none" })).toBeNull();
    expect(double.log).toHaveLength(0);
  });
});

describe("attachSpecialFormat: accepted (RN-19)", () => {
  it.each([
    ["pdf", PDF, "formato.pdf", "formato.pdf"],
    ["png", PNG, "  sello.png  ", "sello.png"],
  ] as const)(
    "stores a real %s as a valido staff document and unblocks the remissions",
    async (tipo, bytes, name, stored) => {
      const double = use([
        context,
        unreferenced,
        lock,
        noFormatYet,
        insertDoc(),
      ]);
      const store = createFakeDocumentStore();
      store.seed(PATH, bytes);

      const result = await attachSpecialFormat(
        input({ nombreOriginal: name }),
        store,
      );

      expect(result).toEqual({
        ok: true,
        documentId: 21,
        tipo,
        tamanoBytes: bytes.length,
        dispatchIds: [5, 6],
      });
      const insert = double.log.find((s) => s.kind === "insert");
      expect(insert?.values).toEqual({
        solicitudId: REQUEST,
        pathname: PATH,
        nombreOriginal: stored,
        estado: "valido",
        tipoDetectado: tipo,
        tamanoBytes: bytes.length,
        subidoPorId: ACTOR,
        formatoEspecial: true,
      });
      expect(unblockMock).toHaveBeenCalledTimes(1);
      expect(unblockMock.mock.calls[0][1]).toBe(REQUEST);
      expect(insertAuditMock).toHaveBeenCalledTimes(1);
      const [, actorId, events] = insertAuditMock.mock.calls[0];
      expect(actorId).toBe(ACTOR);
      expect(events).toEqual([
        {
          accion: "documento.formato_especial",
          entidadTipo: "DocumentoRespaldo",
          entidadId: 21,
          datos: {
            solicitudId: REQUEST,
            tipo,
            tamanoBytes: bytes.length,
            remisionesDesbloqueadas: 1,
          },
        },
      ]);
      expect(store.has(PATH)).toBe(true);
      expect(double.exhausted).toBe(true);
    },
  );

  it("takes the row lock and writes the document, the unblock and the audit row in one transaction", async () => {
    const double = use([context, unreferenced, lock, noFormatYet, insertDoc()]);
    const store = createFakeDocumentStore();
    store.seed(PATH, PDF);

    await attachSpecialFormat(input(), store);

    expect(double.transactions).toBe(1);
    expect(double.log.map((s) => [s.kind, s.inTransaction])).toEqual([
      ["select", false],
      ["select", false],
      ["select", true],
      ["select", true],
      ["insert", true],
    ]);
    expect(unblockMock.mock.calls[0][0]).toBe(double.tx);
    expect(insertAuditMock.mock.calls[0][0]).toBe(double.tx);
  });

  it("names the document by a fallback when the file name is blank", async () => {
    const double = use([context, unreferenced, lock, noFormatYet, insertDoc()]);
    const store = createFakeDocumentStore();
    store.seed(PATH, PDF);

    await attachSpecialFormat(input({ nombreOriginal: "   " }), store);

    const insert = double.log.find((s) => s.kind === "insert");
    expect(insert?.values).toMatchObject({ nombreOriginal: "documento" });
  });
});

describe("attachSpecialFormat: denied (RNF-01)", () => {
  it("answers not_allowed, reads no file and audits nothing when the request is not eligible", async () => {
    const double = use([{ kind: "select", rows: [] }]);
    const store = createFakeDocumentStore();
    store.seed(PATH, PDF);
    const read = vi.spyOn(store, "readHead");
    const remove = vi.spyOn(store, "delete");

    expect(await attachSpecialFormat(input(), store)).toEqual({
      ok: false,
      reason: "not_allowed",
    });

    expect(read).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(store.has(PATH)).toBe(true);
    expect(insertAuditMock).not.toHaveBeenCalled();
    expect(double.exhausted).toBe(true);
  });

  it.each([
    ["another request", "intake/99/0b9f6c1e-4f0a-4d57-9a64-2f3f8f1d2c11.pdf"],
    ["a numeric prefix collision", "intake/120/a.pdf"],
    ["traversal", "intake/12/../99/a.pdf"],
  ])(
    "answers not_allowed for a pathname under %s without any statement",
    async (_label, pathname) => {
      const double = use([]);
      const store = createFakeDocumentStore();
      store.seed(pathname, PDF);

      expect(await attachSpecialFormat(input({ pathname }), store)).toEqual({
        ok: false,
        reason: "not_allowed",
      });

      expect(double.log).toHaveLength(0);
      expect(store.has(pathname)).toBe(true);
    },
  );

  it("never touches a file that a document already references (a student's evidence)", async () => {
    use([context, { kind: "select", rows: [{ id: 3 }] }]);
    const store = createFakeDocumentStore();
    store.seed(PATH, PDF);
    const remove = vi.spyOn(store, "delete");

    expect(await attachSpecialFormat(input(), store)).toEqual({
      ok: false,
      reason: "not_allowed",
    });

    expect(remove).not.toHaveBeenCalled();
    expect(store.has(PATH)).toBe(true);
    expect(insertAuditMock).not.toHaveBeenCalled();
  });

  it("answers not_allowed, with no audit row, when the request changed before the lock", async () => {
    const double = use([context, unreferenced, { kind: "select", rows: [] }]);
    const store = createFakeDocumentStore();
    store.seed(PATH, PDF);

    expect(await attachSpecialFormat(input(), store)).toEqual({
      ok: false,
      reason: "not_allowed",
    });

    expect(double.log.some((s) => s.kind === "insert")).toBe(false);
    expect(unblockMock).not.toHaveBeenCalled();
    expect(insertAuditMock).not.toHaveBeenCalled();
  });
});

describe("attachSpecialFormat: one format per request (already_attached)", () => {
  it("answers already_attached when the lock shows a format, deletes the loser's file and audits nothing", async () => {
    const double = use([
      context,
      unreferenced,
      lock,
      { kind: "select", rows: [{ id: 9 }] },
    ]);
    const store = createFakeDocumentStore();
    store.seed(PATH, PDF);

    expect(await attachSpecialFormat(input(), store)).toEqual({
      ok: false,
      reason: "already_attached",
    });

    expect(store.has(PATH)).toBe(false);
    expect(double.log.some((s) => s.kind === "insert")).toBe(false);
    expect(unblockMock).not.toHaveBeenCalled();
    expect(insertAuditMock).not.toHaveBeenCalled();
  });

  it("maps a unique violation to already_attached, keeps the file and writes nothing else", async () => {
    use([
      context,
      unreferenced,
      lock,
      noFormatYet,
      {
        kind: "insert",
        error: Object.assign(new Error("dup"), { code: "23505" }),
      },
    ]);
    const store = createFakeDocumentStore();
    store.seed(PATH, PDF);

    expect(await attachSpecialFormat(input(), store)).toEqual({
      ok: false,
      reason: "already_attached",
    });

    expect(store.has(PATH)).toBe(true);
    expect(unblockMock).not.toHaveBeenCalled();
    expect(insertAuditMock).not.toHaveBeenCalled();
  });

  it("rethrows any other failure of the insert", async () => {
    use([
      context,
      unreferenced,
      lock,
      noFormatYet,
      { kind: "insert", error: new Error("connection reset") },
    ]);
    const store = createFakeDocumentStore();
    store.seed(PATH, PDF);

    await expect(attachSpecialFormat(input(), store)).rejects.toThrow(
      "connection reset",
    );
    expect(insertAuditMock).not.toHaveBeenCalled();
  });
});

describe("attachSpecialFormat: refused file (RN-04)", () => {
  it.each([
    ["an executable named .pdf", EXE, "unsupported_format"],
    ["a zero-byte file", [], "empty_file"],
  ] as const)(
    "refuses %s: file deleted, documento.rechazado audited, nothing stored, rows untouched",
    async (_label, bytes, reason) => {
      const double = use([context, unreferenced]);
      const store = createFakeDocumentStore();
      store.seed(PATH, bytes);

      expect(await attachSpecialFormat(input(), store)).toEqual({
        ok: false,
        reason,
      });

      expect(store.has(PATH)).toBe(false);
      expect(double.log.some((s) => s.kind === "insert")).toBe(false);
      expect(unblockMock).not.toHaveBeenCalled();
      expect(insertAuditMock).toHaveBeenCalledTimes(1);
      const [, actorId, events] = insertAuditMock.mock.calls[0];
      expect(actorId).toBe(ACTOR);
      expect(events).toEqual([
        {
          accion: "documento.rechazado",
          entidadTipo: "Solicitud",
          entidadId: REQUEST,
          datos: { reason },
        },
      ]);
    },
  );

  it("keeps the refusal when the blob delete fails (the orphan sweep is the backstop)", async () => {
    use([context, unreferenced]);
    const store = createFakeDocumentStore();
    store.seed(PATH, EXE);
    store.delete = vi.fn().mockRejectedValue(new Error("blob down"));

    expect(await attachSpecialFormat(input(), store)).toEqual({
      ok: false,
      reason: "unsupported_format",
    });
    expect(insertAuditMock).toHaveBeenCalledTimes(1);
  });

  it("answers not_found for a missing file: nothing stored, nothing audited, nothing deleted", async () => {
    const double = use([context, unreferenced]);
    const store = createFakeDocumentStore();
    const remove = vi.spyOn(store, "delete");

    expect(await attachSpecialFormat(input(), store)).toEqual({
      ok: false,
      reason: "not_found",
    });

    expect(remove).not.toHaveBeenCalled();
    expect(insertAuditMock).not.toHaveBeenCalled();
    expect(double.exhausted).toBe(true);
  });

  it("rethrows a store failure and writes nothing", async () => {
    use([context, unreferenced]);
    const store = createFakeDocumentStore();
    store.readHead = vi.fn().mockRejectedValue(new Error("store down"));

    await expect(attachSpecialFormat(input(), store)).rejects.toThrow(
      "store down",
    );
    expect(insertAuditMock).not.toHaveBeenCalled();
  });
});
