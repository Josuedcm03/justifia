// @vitest-environment node
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeDocumentStore } from "@/lib/intake/fakes";

import {
  createDbDouble,
  type LoggedStatement,
  type Step,
} from "./test-support/db-double";

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
  DRAFT_TARGET,
  discardDraft,
  editableWhere,
  getLiveDraft,
  openDraft,
  ownedWhere,
  saveDraftDetails,
  saveDraftSubjects,
  submitDraft,
} from "./solicitudes";

const USER = 7;
const DRAFT = 4;
const NOW = new Date("2026-10-07T15:00:00.000Z");
const CUTOFF_ISO = "2026-09-07T15:00:00.000Z";
const PATH = `intake/${DRAFT}/0b9f6c1e-4f0a-4d57-9a64-2f3f8f1d2c11.pdf`;

const draftRow = {
  id: DRAFT,
  causa: "medica",
  fechaInicio: "2026-10-01",
  fechaFin: "2026-10-03",
  actualizadoEn: new Date("2026-10-06T10:00:00.000Z"),
};
const subjectRows = [{ grupoId: 21, asignaturaId: 10 }];
const documentRows = [
  {
    id: 11,
    nombreOriginal: "constancia.pdf",
    tipoDetectado: "pdf",
    tamanoBytes: 2048,
    estado: "valido",
  },
];
const loaded = (): Step[] => [
  { kind: "select", rows: [draftRow] },
  { kind: "select", rows: subjectRows },
  { kind: "select", rows: documentRows },
];
const expectedDraft = {
  id: DRAFT,
  causa: "medica",
  fechaInicio: "2026-10-01",
  fechaFin: "2026-10-03",
  actualizadoEn: draftRow.actualizadoEn,
  subjects: [{ grupoId: 21, asignaturaId: 10 }],
  documents: [
    {
      id: 11,
      nombreOriginal: "constancia.pdf",
      tipo: "pdf",
      tamanoBytes: 2048,
      estado: "valido",
    },
  ],
};

function use(script: Step[]) {
  const double = createDbDouble(script);
  holder.current = double.db;
  return double;
}

function rendered(statement: LoggedStatement) {
  return new PgDialect().sqlToQuery(
    statement.where as Parameters<PgDialect["sqlToQuery"]>[0],
  );
}

describe("solicitudes data layer (drafts)", () => {
  beforeEach(() => {
    insertAuditMock.mockReset();
    insertAuditMock.mockResolvedValue(undefined);
  });

  describe("getLiveDraft", () => {
    it("returns the draft with its subjects and documents", async () => {
      use(loaded());

      expect(await getLiveDraft(USER, NOW)).toEqual(expectedDraft);
    });

    it("only reads the caller's own borrador not older than 30 days (D8)", async () => {
      const double = use(loaded());

      await getLiveDraft(USER, NOW);

      const query = rendered(double.log[0]);
      expect(query.sql).toContain('"Solicitud"."EstudianteId"');
      expect(query.sql).toContain('"Solicitud"."ActualizadoEn"');
      expect(query.params).toContain(USER);
      expect(query.params).toContain("borrador");
      expect(query.params).toContain(CUTOFF_ISO);
    });

    it("returns null and reads nothing else when there is no live draft", async () => {
      const double = use([{ kind: "select", rows: [] }]);

      expect(await getLiveDraft(USER, NOW)).toBeNull();
      expect(double.log).toHaveLength(1);
    });
  });

  describe("openDraft (D8)", () => {
    it("resumes the live draft without creating or deleting anything", async () => {
      const double = use(loaded());
      const store = createFakeDocumentStore();

      expect(await openDraft(USER, NOW, store)).toEqual(expectedDraft);
      expect(double.log.map((s) => s.kind)).toEqual([
        "select",
        "select",
        "select",
      ]);
    });

    it("creates an empty draft owned by the session user, never by input", async () => {
      const double = use([
        { kind: "select", rows: [] }, // no live draft
        { kind: "select", rows: [] }, // nothing expired to purge
        { kind: "insert", rows: [{ id: 9, actualizadoEn: NOW }] },
      ]);

      const draft = await openDraft(USER, NOW, createFakeDocumentStore());

      expect(draft).toEqual({
        id: 9,
        causa: null,
        fechaInicio: null,
        fechaFin: null,
        actualizadoEn: NOW,
        subjects: [],
        documents: [],
      });
      const insert = double.log.find((s) => s.kind === "insert");
      expect(insert?.values).toMatchObject({ estudianteId: USER });
    });

    it("concurrent creation: the loser resumes the draft the winner created", async () => {
      use([
        { kind: "select", rows: [] },
        { kind: "select", rows: [] },
        { kind: "insert", rows: [] }, // unique index: conflict, nothing inserted
        ...loaded(),
      ]);

      expect(await openDraft(USER, NOW, createFakeDocumentStore())).toEqual(
        expectedDraft,
      );
    });

    it("an expired draft is purged with its files and a new empty one is created", async () => {
      const double = use([
        { kind: "select", rows: [] }, // not live
        {
          kind: "select",
          rows: [
            { id: 3, pathname: "intake/3/a.pdf" },
            { id: 3, pathname: "intake/3/b.png" },
          ],
        },
        { kind: "delete" },
        { kind: "insert", rows: [{ id: 9, actualizadoEn: NOW }] },
      ]);
      const store = createFakeDocumentStore();
      store.seed("intake/3/a.pdf", [0x25]);
      store.seed("intake/3/b.png", [0x89]);

      const draft = await openDraft(USER, NOW, store);

      expect(draft.id).toBe(9);
      expect(store.has("intake/3/a.pdf")).toBe(false);
      expect(store.has("intake/3/b.png")).toBe(false);
      expect(double.log.map((s) => s.kind)).toEqual([
        "select",
        "select",
        "delete",
        "insert",
      ]);
    });

    it("writes no audit row for creation, resume or expiry purge (D14)", async () => {
      use([
        { kind: "select", rows: [] },
        { kind: "select", rows: [{ id: 3, pathname: null }] },
        { kind: "delete" },
        { kind: "insert", rows: [{ id: 9, actualizadoEn: NOW }] },
      ]);

      await openDraft(USER, NOW, createFakeDocumentStore());

      expect(insertAuditMock).not.toHaveBeenCalled();
    });
  });

  describe("saveDraftDetails", () => {
    const details = {
      causa: "medica" as const,
      fechaInicio: "2026-10-01",
      fechaFin: "2026-10-03",
    };

    it("updates the step data and restarts the inactivity clock (D8)", async () => {
      const double = use([{ kind: "update", rows: [{ id: DRAFT }] }]);

      expect(await saveDraftDetails(USER, NOW, details)).toBe(true);

      expect(double.log[0].set).toEqual({ ...details, actualizadoEn: NOW });
      const query = rendered(double.log[0]);
      expect(query.params).toContain(USER);
      expect(query.params).toContain(CUTOFF_ISO);
    });

    it("returns false when the caller has no live draft", async () => {
      use([{ kind: "update", rows: [] }]);

      expect(await saveDraftDetails(USER, NOW, details)).toBe(false);
    });

    it("writes no audit row (D14)", async () => {
      use([{ kind: "update", rows: [{ id: DRAFT }] }]);

      await saveDraftDetails(USER, NOW, details);

      expect(insertAuditMock).not.toHaveBeenCalled();
    });
  });

  describe("saveDraftSubjects", () => {
    it("replaces the draft's groups in one transaction and bumps activity", async () => {
      const double = use([
        { kind: "update", rows: [{ id: DRAFT }] },
        { kind: "delete" },
        { kind: "insert" },
      ]);

      expect(await saveDraftSubjects(USER, NOW, [21, 30])).toBe(true);

      expect(double.transactions).toBe(1);
      expect(double.log[0].set).toEqual({ actualizadoEn: NOW });
      expect(double.log[2].values).toEqual([
        { solicitudId: DRAFT, grupoId: 21 },
        { solicitudId: DRAFT, grupoId: 30 },
      ]);
    });

    it("an empty selection clears the groups and inserts nothing", async () => {
      const double = use([
        { kind: "update", rows: [{ id: DRAFT }] },
        { kind: "delete" },
      ]);

      expect(await saveDraftSubjects(USER, NOW, [])).toBe(true);
      expect(double.log.map((s) => s.kind)).toEqual(["update", "delete"]);
    });

    it("returns false and changes nothing when there is no live draft", async () => {
      const double = use([{ kind: "update", rows: [] }]);

      expect(await saveDraftSubjects(USER, NOW, [21])).toBe(false);
      expect(double.log).toHaveLength(1);
    });
  });

  describe("discardDraft (RNF-12, D14)", () => {
    it("deletes the draft and its stored files, with no audit row", async () => {
      const double = use([
        {
          kind: "select",
          rows: [
            { id: DRAFT, pathname: PATH },
            { id: DRAFT, pathname: `intake/${DRAFT}/other.png` },
          ],
        },
        { kind: "delete" },
      ]);
      const store = createFakeDocumentStore();
      store.seed(PATH, [0x25]);
      store.seed(`intake/${DRAFT}/other.png`, [0x89]);

      expect(await discardDraft(USER, store)).toBe(true);

      expect(double.log.map((s) => s.kind)).toEqual(["select", "delete"]);
      expect(store.has(PATH)).toBe(false);
      expect(store.has(`intake/${DRAFT}/other.png`)).toBe(false);
      expect(insertAuditMock).not.toHaveBeenCalled();
    });

    it("scopes the lookup to the caller's borrador only", async () => {
      const double = use([{ kind: "select", rows: [] }]);

      await discardDraft(USER, createFakeDocumentStore());

      const query = rendered(double.log[0]);
      expect(query.params).toContain(USER);
      expect(query.params).toContain("borrador");
    });

    it("returns false when there is nothing to discard (submitted or foreign)", async () => {
      const double = use([{ kind: "select", rows: [] }]);

      expect(await discardDraft(USER, createFakeDocumentStore())).toBe(false);
      expect(double.log).toHaveLength(1);
    });

    it("a draft without documents is deleted without touching the store", async () => {
      use([
        { kind: "select", rows: [{ id: DRAFT, pathname: null }] },
        { kind: "delete" },
      ]);
      const store = createFakeDocumentStore();
      const spy = vi.spyOn(store, "delete");

      expect(await discardDraft(USER, store)).toBe(true);
      expect(spy).not.toHaveBeenCalled();
    });

    it("the row delete stands even when the blob delete fails (orphan sweep backstop)", async () => {
      use([
        { kind: "select", rows: [{ id: DRAFT, pathname: PATH }] },
        { kind: "delete" },
      ]);
      const store = createFakeDocumentStore();
      vi.spyOn(store, "delete").mockRejectedValue(new Error("blob down"));

      expect(await discardDraft(USER, store)).toBe(true);
    });
  });

  describe("submitDraft (RN-02, RN-06, D9)", () => {
    const input = {
      userId: USER,
      solicitudId: DRAFT,
      now: NOW,
      causa: "medica",
      fechaInicio: "2026-10-01",
      fechaFin: "2026-10-03",
      grupoIds: [21, 30],
      consentimientoVersion: "2026-10-20",
    };
    const snapshot = {
      nombre: "Ana Perez",
      cif: "20240001",
      correo: "ana@uam.edu.ni",
      carrera: "Ingenieria",
    };
    const happy = (): Step[] => [
      { kind: "select", rows: [snapshot] },
      { kind: "update", rows: [{ id: DRAFT }] },
      { kind: "select", rows: [{ grupoId: 21 }, { grupoId: 30 }] },
      { kind: "select", rows: [{ n: 2 }] },
    ];

    it("flips borrador to pendiente with server time and the account snapshot, and audits once, in one transaction", async () => {
      const double = use(happy());

      expect(await submitDraft(input)).toEqual({ ok: true });

      expect(double.transactions).toBe(1);
      const update = double.log.find((s) => s.kind === "update");
      expect(update?.set).toEqual({
        estado: "pendiente",
        presentadaEn: NOW,
        actualizadoEn: NOW,
        estudianteNombre: "Ana Perez",
        estudianteCif: "20240001",
        estudianteCorreo: "ana@uam.edu.ni",
        estudianteCarrera: "Ingenieria",
        consentimientoEn: NOW,
        consentimientoVersion: "2026-10-20",
      });
      expect(insertAuditMock).toHaveBeenCalledTimes(1);
      const [, actor, events] = insertAuditMock.mock.calls[0];
      expect(actor).toBe(USER);
      expect(events).toEqual([
        {
          accion: "solicitud.presentada",
          entidadTipo: "Solicitud",
          entidadId: DRAFT,
          datos: {
            asignaturas: 2,
            documentos: 2,
            consentimientoVersion: "2026-10-20",
          },
        },
      ]);
    });

    it("stamps the consent with the same instant as the presentation, never a second clock (RC-6)", async () => {
      const double = use(happy());

      await submitDraft(input);

      const set = double.log.find((s) => s.kind === "update")!.set as Record<
        string,
        unknown
      >;
      expect(set.consentimientoEn).toBe(set.presentadaEn);
      expect(set.consentimientoEn).toBe(NOW);
    });

    it("stores and audits the version it is handed, not a fixed one", async () => {
      const double = use(happy());

      await submitDraft({ ...input, consentimientoVersion: "2027-03-01" });

      const set = double.log.find((s) => s.kind === "update")!.set as Record<
        string,
        unknown
      >;
      expect(set.consentimientoVersion).toBe("2027-03-01");
      const [, , events] = insertAuditMock.mock.calls[0];
      expect(events[0].datos).toMatchObject({
        consentimientoVersion: "2027-03-01",
      });
    });

    it("writes the consent inside the submit transaction, so a guard conflict leaves none", async () => {
      const double = use([
        { kind: "select", rows: [snapshot] },
        { kind: "update", rows: [] },
      ]);

      await submitDraft(input);

      const update = double.log.find((s) => s.kind === "update")!;
      expect(update.inTransaction).toBe(true);
      expect(double.transactions).toBe(1);
      expect(insertAuditMock).not.toHaveBeenCalled();
    });

    it("rolls the consent back with the presentation when drift is found after the update", async () => {
      const double = use([
        { kind: "select", rows: [snapshot] },
        { kind: "update", rows: [{ id: DRAFT }] },
        { kind: "select", rows: [{ grupoId: 21 }, { grupoId: 99 }] },
      ]);

      expect(await submitDraft(input)).toEqual({
        ok: false,
        reason: "conflict",
      });

      const update = double.log.find((s) => s.kind === "update")!;
      expect(update.set).toMatchObject({ consentimientoVersion: "2026-10-20" });
      expect(update.inTransaction).toBe(true);
      expect(insertAuditMock).not.toHaveBeenCalled();
    });

    it("guards the update with owner, borrador, liveness and the validated values", async () => {
      const double = use(happy());

      await submitDraft(input);

      const update = double.log.find((s) => s.kind === "update")!;
      const query = rendered(update);
      for (const param of [
        DRAFT,
        USER,
        "borrador",
        "medica",
        "2026-10-01",
        "2026-10-03",
        CUTOFF_ISO,
      ]) {
        expect(query.params).toContain(param);
      }
    });

    it("reports a conflict when the draft is no longer an open borrador (double submit)", async () => {
      const double = use([
        { kind: "select", rows: [snapshot] },
        { kind: "update", rows: [] },
      ]);

      expect(await submitDraft(input)).toEqual({
        ok: false,
        reason: "conflict",
      });
      expect(insertAuditMock).not.toHaveBeenCalled();
      expect(double.exhausted).toBe(true);
    });

    it("rolls back as a conflict when the groups changed after validation", async () => {
      use([
        { kind: "select", rows: [snapshot] },
        { kind: "update", rows: [{ id: DRAFT }] },
        { kind: "select", rows: [{ grupoId: 21 }, { grupoId: 99 }] },
      ]);

      expect(await submitDraft(input)).toEqual({
        ok: false,
        reason: "conflict",
      });
      expect(insertAuditMock).not.toHaveBeenCalled();
    });

    it("rolls back as a conflict when no valid document remains", async () => {
      use([
        { kind: "select", rows: [snapshot] },
        { kind: "update", rows: [{ id: DRAFT }] },
        { kind: "select", rows: [{ grupoId: 21 }, { grupoId: 30 }] },
        { kind: "select", rows: [{ n: 0 }] },
      ]);

      expect(await submitDraft(input)).toEqual({
        ok: false,
        reason: "conflict",
      });
      expect(insertAuditMock).not.toHaveBeenCalled();
    });

    it("refuses without writing when the account lacks a snapshot field", async () => {
      const double = use([
        { kind: "select", rows: [{ ...snapshot, cif: null }] },
      ]);

      expect(await submitDraft(input)).toEqual({
        ok: false,
        reason: "snapshot_incomplete",
      });
      expect(double.log).toHaveLength(1);
    });

    it("propagates an audit failure so the transaction rolls back", async () => {
      use(happy());
      insertAuditMock.mockRejectedValue(new Error("audit down"));

      await expect(submitDraft(input)).rejects.toThrow("audit down");
    });
  });
});

describe("EditTarget (RF-08: in-place correction, never a borrador)", () => {
  const RETURNED = 31;
  const correction = { kind: "correction", solicitudId: RETURNED } as const;
  const sql = (where: unknown) =>
    new PgDialect().sqlToQuery(where as Parameters<PgDialect["sqlToQuery"]>[0]);

  describe("editableWhere", () => {
    it("a correction matches the caller's own devuelta request by id, with no liveness cut-off", () => {
      const query = sql(editableWhere(USER, correction, NOW));

      expect(query.sql).toContain('"Solicitud"."Id"');
      expect(query.sql).toContain('"Solicitud"."EstudianteId"');
      expect(query.params).toEqual([RETURNED, USER, "devuelta"]);
    });

    it("never matches a borrador for a correction", () => {
      expect(sql(editableWhere(USER, correction, NOW)).params).not.toContain(
        "borrador",
      );
    });

    it("the draft target is still the caller's live borrador (D8)", () => {
      const query = sql(editableWhere(USER, DRAFT_TARGET, NOW));

      expect(query.params).toEqual([USER, "borrador", CUTOFF_ISO]);
    });

    it("ownedWhere ignores liveness for both targets", () => {
      expect(sql(ownedWhere(USER, DRAFT_TARGET)).params).toEqual([
        USER,
        "borrador",
      ]);
      expect(sql(ownedWhere(USER, correction)).params).toEqual([
        RETURNED,
        USER,
        "devuelta",
      ]);
    });
  });

  describe("getLiveDraft", () => {
    it("loads the returned request with its current documents only (retired excluded)", async () => {
      const double = use([
        { kind: "select", rows: [{ ...draftRow, id: RETURNED }] },
        { kind: "select", rows: subjectRows },
        { kind: "select", rows: documentRows },
      ]);

      const draft = await getLiveDraft(USER, NOW, correction);

      expect(draft?.id).toBe(RETURNED);
      expect(draft?.documents).toHaveLength(1);
      expect(rendered(double.log[0]).params).toEqual([
        RETURNED,
        USER,
        "devuelta",
      ]);
      expect(rendered(double.log[2]).sql).toMatch(/"RetiradoEn" is null/i);
    });

    it("returns null for a foreign or not returned request (nothing matches)", async () => {
      const double = use([{ kind: "select", rows: [] }]);

      expect(await getLiveDraft(USER, NOW, correction)).toBeNull();
      expect(double.log).toHaveLength(1);
    });
  });

  describe("saveDraftDetails", () => {
    const details = {
      causa: "medica",
      fechaInicio: "2026-10-01",
      fechaFin: "2026-10-03",
    } as const;

    it("edits the returned request in place, guarded by owner and devuelta", async () => {
      const double = use([{ kind: "update", rows: [{ id: RETURNED }] }]);

      expect(await saveDraftDetails(USER, NOW, details, correction)).toBe(true);

      expect(rendered(double.log[0]).params).toEqual([
        RETURNED,
        USER,
        "devuelta",
      ]);
      expect(double.log[0].set).toEqual({ ...details, actualizadoEn: NOW });
    });

    it("refuses a request that is not the caller's returned one", async () => {
      use([{ kind: "update", rows: [] }]);

      expect(await saveDraftDetails(USER, NOW, details, correction)).toBe(
        false,
      );
    });
  });

  describe("saveDraftSubjects", () => {
    it("replaces the groups of the returned request in one transaction", async () => {
      const double = use([
        { kind: "update", rows: [{ id: RETURNED }] },
        { kind: "delete" },
        { kind: "insert" },
      ]);

      expect(await saveDraftSubjects(USER, NOW, [21], correction)).toBe(true);

      expect(rendered(double.log[0]).params).toEqual([
        RETURNED,
        USER,
        "devuelta",
      ]);
      expect(double.log[2].values).toEqual([
        { solicitudId: RETURNED, grupoId: 21 },
      ]);
    });

    it("changes nothing for a foreign or not returned request", async () => {
      const double = use([{ kind: "update", rows: [] }]);

      expect(await saveDraftSubjects(USER, NOW, [21], correction)).toBe(false);
      expect(double.log).toHaveLength(1);
    });
  });
});
