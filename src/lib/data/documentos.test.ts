// @vitest-environment node
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeDocumentStore } from "@/lib/intake/fakes";
import { MAX_DOCUMENT_BYTES } from "@/lib/intake/limits";

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

import {
  finalizeDocument,
  getDocumentForDownload,
  getUploadContext,
  recordDocumentDownload,
  removeDocument,
} from "@/lib/data/documentos";

const USER = 7;
const DRAFT = 4;
const PATH = `intake/${DRAFT}/0b9f6c1e-4f0a-4d57-9a64-2f3f8f1d2c11.pdf`;
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00];
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0x00];
const EXE = [0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00];

function use(script: Step[]) {
  const double = createDbDouble(script);
  holder.current = double.db;
  return double;
}

// Statement scripts of `finalizeDocument`, one per phase.
const lookupDraft: Step = { kind: "select", rows: [{ id: DRAFT }] };
const claim = (count: number, claimedId = 11): Step[] => [
  { kind: "update", rows: [{ id: DRAFT }] }, // row lock + activity bump
  { kind: "select", rows: [] }, // pathname not referenced yet
  { kind: "select", rows: [{ n: count }] }, // documents already in the draft
  { kind: "insert", rows: [{ id: claimedId }] }, // pendiente claim
];
const accept: Step = { kind: "update", rows: [{ id: 11 }] };
const dropClaim: Step = { kind: "delete" };

function input(
  overrides: Partial<{ pathname: string; nombreOriginal: string }> = {},
) {
  return {
    userId: USER,
    pathname: PATH,
    nombreOriginal: "scan.pdf",
    ...overrides,
  };
}

describe("documentos data layer", () => {
  beforeEach(() => {
    insertAuditMock.mockReset();
    insertAuditMock.mockResolvedValue(undefined);
  });

  describe("getUploadContext", () => {
    it("returns the open draft id and the count of its documents", async () => {
      use([
        { kind: "select", rows: [{ id: DRAFT }] },
        { kind: "select", rows: [{ n: 2 }] },
      ]);

      expect(
        await getUploadContext(USER, new Date("2026-10-07T00:00:00Z")),
      ).toEqual({ solicitudId: DRAFT, documentCount: 2 });
    });

    it("returns null, and counts nothing, when there is no live draft", async () => {
      const double = use([{ kind: "select", rows: [] }]);

      expect(await getUploadContext(USER, new Date())).toBeNull();
      expect(double.log).toHaveLength(1);
    });
  });

  describe("finalizeDocument", () => {
    it.each([
      ["pdf", PDF, "scan.pdf"],
      ["png", PNG, "foto.png"],
      ["jpeg", JPEG, "foto.jpg"],
    ] as const)(
      "accepts a real %s and records it as valido",
      async (tipo, bytes, name) => {
        const double = use([lookupDraft, ...claim(1), accept]);
        const store = createFakeDocumentStore();
        store.seed(PATH, bytes);

        const result = await finalizeDocument(
          input({ nombreOriginal: name }),
          store,
        );

        expect(result).toEqual({ ok: true, documentId: 11, tipo });
        const insert = double.log.find((s) => s.kind === "insert");
        expect(insert?.values).toMatchObject({
          solicitudId: DRAFT,
          pathname: PATH,
          nombreOriginal: name,
          estado: "pendiente",
        });
        const update = double.log.filter((s) => s.kind === "update")[1];
        expect(update.set).toEqual({
          estado: "valido",
          tipoDetectado: tipo,
          tamanoBytes: bytes.length,
        });
        expect(insertAuditMock).toHaveBeenCalledTimes(1);
        const [, actorId, events] = insertAuditMock.mock.calls[0];
        expect(actorId).toBe(USER);
        expect(events).toEqual([
          {
            accion: "documento.adjuntado",
            entidadTipo: "DocumentoRespaldo",
            entidadId: 11,
            datos: { solicitudId: DRAFT, tipo, tamanoBytes: bytes.length },
          },
        ]);
        expect(store.has(PATH)).toBe(true);
        expect(double.exhausted).toBe(true);
      },
    );

    it("rejects a spoofed .exe named scan.pdf, deletes the file and audits the rejection", async () => {
      const double = use([lookupDraft, ...claim(0), dropClaim]);
      const store = createFakeDocumentStore();
      store.seed(PATH, EXE);

      const result = await finalizeDocument(input(), store);

      expect(result).toEqual({ ok: false, reason: "unsupported_format" });
      expect(store.has(PATH)).toBe(false);
      expect(double.log.at(-1)?.kind).toBe("delete");
      expect(insertAuditMock.mock.calls[0][2]).toEqual([
        {
          accion: "documento.rechazado",
          entidadTipo: "Solicitud",
          entidadId: DRAFT,
          datos: { reason: "unsupported_format" },
        },
      ]);
      expect(double.exhausted).toBe(true);
    });

    it("rejects a zero-byte file as empty_file and deletes it", async () => {
      use([lookupDraft, ...claim(0), dropClaim]);
      const store = createFakeDocumentStore();
      store.seed(PATH, []);

      expect(await finalizeDocument(input(), store)).toEqual({
        ok: false,
        reason: "empty_file",
      });
      expect(store.has(PATH)).toBe(false);
      expect(insertAuditMock.mock.calls[0][2][0].datos).toEqual({
        reason: "empty_file",
      });
    });

    it("rejects a file over 10 MiB as too_large and deletes it", async () => {
      use([lookupDraft, ...claim(0), dropClaim]);
      const store = createFakeDocumentStore();
      store.seed(PATH, PDF);
      store.readHead = vi.fn().mockResolvedValue({
        size: MAX_DOCUMENT_BYTES + 1,
        head: new Uint8Array(PDF),
      });
      const deleteSpy = vi.spyOn(store, "delete");

      expect(await finalizeDocument(input(), store)).toEqual({
        ok: false,
        reason: "too_large",
      });
      expect(deleteSpy).toHaveBeenCalledWith([PATH]);
    });

    it("accepts a file of exactly 10 MiB", async () => {
      use([lookupDraft, ...claim(0), accept]);
      const store = createFakeDocumentStore();
      store.readHead = vi.fn().mockResolvedValue({
        size: MAX_DOCUMENT_BYTES,
        head: new Uint8Array(PDF),
      });

      expect(await finalizeDocument(input(), store)).toMatchObject({
        ok: true,
      });
    });

    it("answers not_found for a missing file: claim dropped, nothing audited, nothing deleted", async () => {
      const double = use([lookupDraft, ...claim(0), dropClaim]);
      const store = createFakeDocumentStore();
      const deleteSpy = vi.spyOn(store, "delete");

      expect(await finalizeDocument(input(), store)).toEqual({
        ok: false,
        reason: "not_found",
      });
      expect(deleteSpy).not.toHaveBeenCalled();
      expect(insertAuditMock).not.toHaveBeenCalled();
      expect(double.exhausted).toBe(true);
    });

    it("answers not_allowed for another draft path and never touches that file", async () => {
      const double = use([lookupDraft]);
      const store = createFakeDocumentStore();
      const foreign = "intake/99/0b9f6c1e-4f0a-4d57-9a64-2f3f8f1d2c11.pdf";
      store.seed(foreign, PDF);

      expect(
        await finalizeDocument(input({ pathname: foreign }), store),
      ).toEqual({ ok: false, reason: "not_allowed" });
      expect(store.has(foreign)).toBe(true);
      expect(double.log).toHaveLength(1);
      expect(insertAuditMock).not.toHaveBeenCalled();
    });

    it("answers not_allowed when the student has no draft", async () => {
      use([{ kind: "select", rows: [] }]);
      const store = createFakeDocumentStore();
      store.seed(PATH, PDF);

      expect(await finalizeDocument(input(), store)).toEqual({
        ok: false,
        reason: "not_allowed",
      });
      expect(store.has(PATH)).toBe(true);
    });

    it("rejects a 6th document with too_many_documents, deletes its file and creates no record (D12)", async () => {
      const double = use([
        lookupDraft,
        { kind: "update", rows: [{ id: DRAFT }] },
        { kind: "select", rows: [] },
        { kind: "select", rows: [{ n: 5 }] },
      ]);
      const store = createFakeDocumentStore();
      store.seed(PATH, PDF);

      expect(await finalizeDocument(input(), store)).toEqual({
        ok: false,
        reason: "too_many_documents",
      });
      expect(store.has(PATH)).toBe(false);
      expect(double.log.some((s) => s.kind === "insert")).toBe(false);
      expect(insertAuditMock.mock.calls[0][2]).toEqual([
        {
          accion: "documento.rechazado",
          entidadTipo: "Solicitud",
          entidadId: DRAFT,
          datos: { reason: "too_many_documents" },
        },
      ]);
    });

    it("under concurrent finalizes beyond the cap exactly one becomes a document", async () => {
      // The row lock serialises the claims: the first sees 4, the second 5.
      const double = use([
        lookupDraft,
        ...claim(4, 15),
        accept,
        lookupDraft,
        { kind: "update", rows: [{ id: DRAFT }] },
        { kind: "select", rows: [] },
        { kind: "select", rows: [{ n: 5 }] },
      ]);
      const store = createFakeDocumentStore();
      const second = `intake/${DRAFT}/aaaaaaaa-4f0a-4d57-9a64-2f3f8f1d2c11.png`;
      store.seed(PATH, PDF);
      store.seed(second, PNG);

      const first = await finalizeDocument(input(), store);
      const other = await finalizeDocument(input({ pathname: second }), store);

      expect(first).toMatchObject({ ok: true });
      expect(other).toEqual({ ok: false, reason: "too_many_documents" });
      expect(double.log.filter((s) => s.kind === "insert")).toHaveLength(1);
      expect(store.has(PATH)).toBe(true);
      expect(store.has(second)).toBe(false);
    });

    it("never deletes a file that another document row already references", async () => {
      use([
        lookupDraft,
        { kind: "update", rows: [{ id: DRAFT }] },
        { kind: "select", rows: [{ id: 3 }] }, // pathname already referenced
      ]);
      const store = createFakeDocumentStore();
      store.seed(PATH, PDF);

      expect(await finalizeDocument(input(), store)).toEqual({
        ok: false,
        reason: "not_allowed",
      });
      expect(store.has(PATH)).toBe(true);
      expect(insertAuditMock).not.toHaveBeenCalled();
    });

    it("drops the pendiente claim and rethrows when the store cannot be read", async () => {
      const double = use([lookupDraft, ...claim(0), dropClaim]);
      const store = createFakeDocumentStore();
      store.readHead = vi.fn().mockRejectedValue(new Error("store down"));

      await expect(finalizeDocument(input(), store)).rejects.toThrow(
        "store down",
      );
      expect(double.log.at(-1)?.kind).toBe("delete");
      expect(insertAuditMock).not.toHaveBeenCalled();
    });

    it("does not report success when the audit insert fails", async () => {
      use([lookupDraft, ...claim(0), accept]);
      insertAuditMock.mockRejectedValue(new Error("audit down"));
      const store = createFakeDocumentStore();
      store.seed(PATH, PDF);

      await expect(finalizeDocument(input(), store)).rejects.toThrow(
        "audit down",
      );
    });

    it("keeps the rejection even when the stored file cannot be deleted", async () => {
      use([lookupDraft, ...claim(0), dropClaim]);
      const store = createFakeDocumentStore();
      store.seed(PATH, EXE);
      store.delete = vi.fn().mockRejectedValue(new Error("blob delete failed"));

      expect(await finalizeDocument(input(), store)).toEqual({
        ok: false,
        reason: "unsupported_format",
      });
    });

    it("stores the original name only in the database, bounded to 255 characters", async () => {
      const double = use([lookupDraft, ...claim(0), accept]);
      const store = createFakeDocumentStore();
      store.seed(PATH, PDF);

      await finalizeDocument(
        input({ nombreOriginal: `  ${"n".repeat(300)}.pdf ` }),
        store,
      );

      const insert = double.log.find((s) => s.kind === "insert");
      expect(
        (insert?.values as { nombreOriginal: string }).nombreOriginal,
      ).toHaveLength(255);
      expect(JSON.stringify(insertAuditMock.mock.calls[0][2])).not.toContain(
        "nnnn",
      );
    });
  });

  describe("removeDocument", () => {
    const row = { id: 11, solicitudId: DRAFT, pathname: PATH };

    it("deletes the record and the stored file and audits one documento.eliminado", async () => {
      const double = use([
        { kind: "select", rows: [row] },
        { kind: "update" },
        { kind: "delete" },
      ]);
      const store = createFakeDocumentStore();
      store.seed(PATH, PDF);

      expect(
        await removeDocument({ userId: USER, documentId: 11 }, store),
      ).toEqual({ ok: true });
      expect(store.has(PATH)).toBe(false);
      expect(insertAuditMock).toHaveBeenCalledTimes(1);
      expect(insertAuditMock.mock.calls[0][1]).toBe(USER);
      expect(insertAuditMock.mock.calls[0][2]).toEqual([
        {
          accion: "documento.eliminado",
          entidadTipo: "DocumentoRespaldo",
          entidadId: 11,
          datos: { solicitudId: DRAFT },
        },
      ]);
      expect(double.exhausted).toBe(true);
    });

    it("answers not_found for a document that is not in the caller draft", async () => {
      use([{ kind: "select", rows: [] }]);
      const store = createFakeDocumentStore();
      store.seed(PATH, PDF);

      expect(
        await removeDocument({ userId: USER, documentId: 99 }, store),
      ).toEqual({ ok: false, reason: "not_found" });
      expect(store.has(PATH)).toBe(true);
      expect(insertAuditMock).not.toHaveBeenCalled();
    });

    it("still succeeds when the file delete fails after the commit (orphan sweep is the backstop)", async () => {
      use([
        { kind: "select", rows: [row] },
        { kind: "update" },
        { kind: "delete" },
      ]);
      const store = createFakeDocumentStore();
      store.delete = vi.fn().mockRejectedValue(new Error("blob down"));

      expect(
        await removeDocument({ userId: USER, documentId: 11 }, store),
      ).toEqual({ ok: true });
    });
  });

  describe("getDocumentForDownload", () => {
    const downloadRow = {
      id: 11,
      solicitudId: DRAFT,
      estudianteId: USER,
      estudianteFacultadId: 3,
      solicitudEstado: "pendiente",
      pathname: PATH,
      tipoDetectado: "pdf",
      nombreOriginal: "scan.pdf",
      retiradoEn: null,
    };

    it("returns the valid document with its owner, facultad, state and retirement", async () => {
      use([{ kind: "select", rows: [downloadRow] }]);

      expect(await getDocumentForDownload(11)).toEqual({
        id: 11,
        solicitudId: DRAFT,
        estudianteId: USER,
        estudianteFacultadId: 3,
        solicitudEstado: "pendiente",
        retiradoEn: null,
        pathname: PATH,
        tipo: "pdf",
        nombreOriginal: "scan.pdf",
      });
    });

    it("returns the retirement time of a retired document", async () => {
      const retiradoEn = new Date("2026-10-07T10:00:00.000Z");
      use([{ kind: "select", rows: [{ ...downloadRow, retiradoEn }] }]);

      expect((await getDocumentForDownload(11))?.retiradoEn).toEqual(
        retiradoEn,
      );
    });

    it("returns a null facultad for a student without a carrera", async () => {
      use([
        {
          kind: "select",
          rows: [{ ...downloadRow, estudianteFacultadId: null }],
        },
      ]);

      expect(
        (await getDocumentForDownload(11))?.estudianteFacultadId,
      ).toBeNull();
    });

    it("returns null for an unknown document", async () => {
      use([{ kind: "select", rows: [] }]);

      expect(await getDocumentForDownload(404)).toBeNull();
    });

    it("returns null for a row without a detected type", async () => {
      use([
        { kind: "select", rows: [{ ...downloadRow, tipoDetectado: null }] },
      ]);

      expect(await getDocumentForDownload(11)).toBeNull();
    });

    it("only matches the document id in the valido state, never a pendiente claim", async () => {
      const double = use([{ kind: "select", rows: [] }]);

      await getDocumentForDownload(11);

      const query = new PgDialect().sqlToQuery(
        double.log[0].where as Parameters<PgDialect["sqlToQuery"]>[0],
      );
      expect(query.sql).toContain('"DocumentoRespaldo"."Id" = $1');
      expect(query.sql).toContain('"DocumentoRespaldo"."Estado" = $2');
      expect(query.params).toEqual([11, "valido"]);
    });
  });

  describe("recordDocumentDownload", () => {
    it("writes one documento.descargado row for the downloading user inside a transaction", async () => {
      const double = use([]);

      await recordDocumentDownload(USER, {
        id: 11,
        solicitudId: DRAFT,
        tipo: "png",
      });

      expect(double.transactions).toBe(1);
      expect(insertAuditMock).toHaveBeenCalledTimes(1);
      expect(insertAuditMock.mock.calls[0][1]).toBe(USER);
      expect(insertAuditMock.mock.calls[0][2]).toEqual([
        {
          accion: "documento.descargado",
          entidadTipo: "DocumentoRespaldo",
          entidadId: 11,
          datos: { solicitudId: DRAFT, tipo: "png", modo: "ver" },
        },
      ]);
    });

    it("records the download mode when the caller names one", async () => {
      use([]);

      await recordDocumentDownload(USER, {
        id: 11,
        solicitudId: DRAFT,
        tipo: "pdf",
        modo: "descarga",
      });

      expect(insertAuditMock.mock.calls[0][2][0].datos).toEqual({
        solicitudId: DRAFT,
        tipo: "pdf",
        modo: "descarga",
      });
    });

    it("propagates an audit failure so the caller can refuse the bytes", async () => {
      use([]);
      insertAuditMock.mockRejectedValue(new Error("audit down"));

      await expect(
        recordDocumentDownload(USER, {
          id: 11,
          solicitudId: DRAFT,
          tipo: "pdf",
        }),
      ).rejects.toThrow("audit down");
    });
  });
});

describe("documentos data layer: EditTarget (RF-08, supporting-documents)", () => {
  const RETURNED = 31;
  const correction = { kind: "correction", solicitudId: RETURNED } as const;
  const RETURNED_PATH = `intake/${RETURNED}/0b9f6c1e-4f0a-4d57-9a64-2f3f8f1d2c11.pdf`;
  const params = (where: unknown) =>
    new PgDialect().sqlToQuery(where as Parameters<PgDialect["sqlToQuery"]>[0])
      .params;
  const sqlOf = (where: unknown) =>
    new PgDialect().sqlToQuery(where as Parameters<PgDialect["sqlToQuery"]>[0])
      .sql;

  beforeEach(() => {
    insertAuditMock.mockReset();
    insertAuditMock.mockResolvedValue(undefined);
  });

  describe("getUploadContext", () => {
    it("finds the caller's own devuelta request by id, with no liveness cut-off", async () => {
      const double = use([
        { kind: "select", rows: [{ id: RETURNED }] },
        { kind: "select", rows: [{ n: 3 }] },
      ]);

      expect(
        await getUploadContext(
          USER,
          new Date("2026-10-07T00:00:00Z"),
          correction,
        ),
      ).toEqual({ solicitudId: RETURNED, documentCount: 3 });
      expect(params(double.log[0].where)).toEqual([RETURNED, USER, "devuelta"]);
    });

    it("answers null for a foreign or not returned request and counts nothing", async () => {
      const double = use([{ kind: "select", rows: [] }]);

      expect(await getUploadContext(USER, new Date(), correction)).toBeNull();
      expect(double.log).toHaveLength(1);
    });

    it.each([
      ["draft", undefined],
      ["correction", correction],
    ] as const)(
      "the %s cap count excludes retired documents",
      async (_name, target) => {
        const double = use([
          { kind: "select", rows: [{ id: RETURNED }] },
          { kind: "select", rows: [{ n: 2 }] },
        ]);

        await getUploadContext(USER, new Date(), target);

        expect(sqlOf(double.log[1].where)).toMatch(/"RetiradoEn" is null/i);
      },
    );
  });

  describe("finalizeDocument", () => {
    const returnedClaim = (count: number): Step[] => [
      { kind: "update", rows: [{ id: RETURNED }] },
      { kind: "select", rows: [] },
      { kind: "select", rows: [{ n: count }] },
      { kind: "insert", rows: [{ id: 11 }] },
    ];
    const lookupReturned: Step = { kind: "select", rows: [{ id: RETURNED }] };

    it("accepts a file under the returned request's prefix, guarded by owner and devuelta", async () => {
      const double = use([lookupReturned, ...returnedClaim(1), accept]);
      const store = createFakeDocumentStore();
      store.seed(RETURNED_PATH, PDF);

      const result = await finalizeDocument(
        { ...input({ pathname: RETURNED_PATH }), target: correction },
        store,
      );

      expect(result).toEqual({ ok: true, documentId: 11, tipo: "pdf" });
      expect(params(double.log[0].where)).toEqual([RETURNED, USER, "devuelta"]);
      expect(params(double.log[1].where)).toEqual([
        RETURNED,
        RETURNED,
        USER,
        "devuelta",
      ]);
      expect(double.log.find((s) => s.kind === "insert")?.values).toMatchObject(
        {
          solicitudId: RETURNED,
          estado: "pendiente",
        },
      );
    });

    it("refuses a path under another prefix and never touches that file", async () => {
      use([lookupReturned]);
      const store = createFakeDocumentStore();
      store.seed(PATH, PDF);

      expect(
        await finalizeDocument(
          { ...input({ pathname: PATH }), target: correction },
          store,
        ),
      ).toEqual({ ok: false, reason: "not_allowed" });
      expect(store.has(PATH)).toBe(true);
    });

    it("is not_allowed for a request that is not the caller's returned one", async () => {
      use([{ kind: "select", rows: [] }]);
      const store = createFakeDocumentStore();
      store.seed(RETURNED_PATH, PDF);

      expect(
        await finalizeDocument(
          { ...input({ pathname: RETURNED_PATH }), target: correction },
          store,
        ),
      ).toEqual({ ok: false, reason: "not_allowed" });
      expect(store.has(RETURNED_PATH)).toBe(true);
    });

    it("re-checks the cap at claim time counting only documents that are not retired", async () => {
      const double = use([
        lookupReturned,
        { kind: "update", rows: [{ id: RETURNED }] },
        { kind: "select", rows: [] },
        { kind: "select", rows: [{ n: 5 }] },
      ]);
      const store = createFakeDocumentStore();
      store.seed(RETURNED_PATH, PDF);

      expect(
        await finalizeDocument(
          { ...input({ pathname: RETURNED_PATH }), target: correction },
          store,
        ),
      ).toEqual({ ok: false, reason: "too_many_documents" });
      expect(sqlOf(double.log[3].where)).toMatch(/"RetiradoEn" is null/i);
      expect(double.log.some((s) => s.kind === "insert")).toBe(false);
      expect(store.has(RETURNED_PATH)).toBe(false);
    });

    it("a sixth upload is accepted once a current document has been retired (4 of 5 count)", async () => {
      use([lookupReturned, ...returnedClaim(4), accept]);
      const store = createFakeDocumentStore();
      store.seed(RETURNED_PATH, PDF);

      expect(
        await finalizeDocument(
          { ...input({ pathname: RETURNED_PATH }), target: correction },
          store,
        ),
      ).toMatchObject({ ok: true });
    });
  });
});

describe("removeDocument during a correction (RF-08 b, supporting-documents)", () => {
  const RETURNED = 31;
  const correction = { kind: "correction", solicitudId: RETURNED } as const;
  const RETURNED_PATH = `intake/${RETURNED}/0b9f6c1e-4f0a-4d57-9a64-2f3f8f1d2c11.pdf`;
  const row = { id: 11, solicitudId: RETURNED, pathname: RETURNED_PATH };
  const remove = (store = createFakeDocumentStore()) =>
    removeDocument({ userId: USER, documentId: 11, target: correction }, store);

  beforeEach(() => {
    insertAuditMock.mockReset();
    insertAuditMock.mockResolvedValue(undefined);
  });

  it("retires a document of the latest revision: marks RetiradoEn, keeps record and file, one documento.retirado in the same transaction", async () => {
    const double = use([
      { kind: "select", rows: [row] },
      { kind: "select", rows: [{ documentoIds: [11, 12] }] },
      { kind: "update" },
      { kind: "update" },
    ]);
    const store = createFakeDocumentStore();
    store.seed(RETURNED_PATH, PDF);

    expect(await remove(store)).toEqual({ ok: true });

    expect(double.transactions).toBe(1);
    expect(double.log.map((s) => s.kind)).toEqual([
      "select",
      "select",
      "update",
      "update",
    ]);
    expect(double.log[3].set).toEqual({ retiradoEn: expect.any(Date) });
    expect(store.has(RETURNED_PATH)).toBe(true);
    expect(insertAuditMock).toHaveBeenCalledTimes(1);
    expect(insertAuditMock.mock.calls[0][1]).toBe(USER);
    expect(insertAuditMock.mock.calls[0][2]).toEqual([
      {
        accion: "documento.retirado",
        entidadTipo: "DocumentoRespaldo",
        entidadId: 11,
        datos: { solicitudId: RETURNED },
      },
    ]);
  });

  it("deletes a document uploaded during this correction, record and file, with no documento.retirado", async () => {
    const double = use([
      { kind: "select", rows: [row] },
      { kind: "select", rows: [{ documentoIds: [12] }] },
      { kind: "update" },
      { kind: "delete" },
    ]);
    const store = createFakeDocumentStore();
    store.seed(RETURNED_PATH, PDF);

    expect(await remove(store)).toEqual({ ok: true });

    expect(double.log.map((s) => s.kind)).toEqual([
      "select",
      "select",
      "update",
      "delete",
    ]);
    expect(store.has(RETURNED_PATH)).toBe(false);
    expect(insertAuditMock.mock.calls[0][2]).toEqual([
      {
        accion: "documento.eliminado",
        entidadTipo: "DocumentoRespaldo",
        entidadId: 11,
        datos: { solicitudId: RETURNED },
      },
    ]);
  });

  it("an earlier revision's list is irrelevant: only the latest revision decides", async () => {
    const double = use([
      { kind: "select", rows: [row] },
      { kind: "select", rows: [{ documentoIds: [12] }] },
      { kind: "update" },
      { kind: "delete" },
    ]);

    await remove();

    const [order] = double.log[1].orderBy ?? [];
    expect(
      new PgDialect().sqlToQuery(
        order as Parameters<PgDialect["sqlToQuery"]>[0],
      ).sql,
    ).toMatch(/"Numero" desc/i);
  });

  it("looks the document up by id, owner, request and devuelta, ignoring retired ones", async () => {
    const double = use([{ kind: "select", rows: [] }]);
    const store = createFakeDocumentStore();
    store.seed(RETURNED_PATH, PDF);

    expect(await remove(store)).toEqual({ ok: false, reason: "not_found" });

    const query = new PgDialect().sqlToQuery(
      double.log[0].where as Parameters<PgDialect["sqlToQuery"]>[0],
    );
    expect(query.params).toEqual([11, RETURNED, USER, "devuelta"]);
    expect(query.sql).toMatch(/"RetiradoEn" is null/i);
    expect(store.has(RETURNED_PATH)).toBe(true);
    expect(insertAuditMock).not.toHaveBeenCalled();
  });

  it("propagates an audit failure: nothing is reported removed and the file stays", async () => {
    use([
      { kind: "select", rows: [row] },
      { kind: "select", rows: [{ documentoIds: [11] }] },
      { kind: "update" },
      { kind: "update" },
    ]);
    insertAuditMock.mockRejectedValue(new Error("audit down"));
    const store = createFakeDocumentStore();
    store.seed(RETURNED_PATH, PDF);

    await expect(remove(store)).rejects.toThrow("audit down");
    expect(store.has(RETURNED_PATH)).toBe(true);
  });
});
