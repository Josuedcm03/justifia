// @vitest-environment node
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_AUTO_ATTEMPTS, RETRY_BATCH_SIZE } from "@/lib/remission/limits";

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

import type { Transaction } from "@/lib/data/audit";
import { CLAIM_LEASE_MS } from "@/lib/data/outbox";
import {
  authorizeResend,
  claimRemission,
  completeBlocked,
  completeFailed,
  completeSent,
  findApprovingSecretaryId,
  findTeacherEmail,
  listRemissions,
  loadRequestForRemission,
  refreshRemissionEmail,
  selectRetryCandidates,
  unblockSpecialFormat,
  type RemissionClaim,
} from "@/lib/data/remision";

const NOW = new Date("2026-10-19T15:00:00.000Z");
const ACTOR = 20;

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

const clase = {
  asignaturaId: 10,
  codigo: "MAT101",
  nombre: "Matematica I",
  numeroGrupo: "A",
};

const claimedRow = {
  id: 31,
  solicitudId: 42,
  docenteId: 5,
  docenteNombre: "Ana Perez",
  correo: "ana@uam.edu.ni",
  clases: [clase],
  estado: "pendiente",
  motivoCodigo: null,
  intentos: 1,
  reclamoId: "11111111-1111-4111-8111-111111111111",
};

const claim: RemissionClaim = { ...claimedRow } as RemissionClaim;

describe("claimRemission (TR-6)", () => {
  beforeEach(() => {
    holder.current = null;
    insertAuditMock.mockReset();
    insertAuditMock.mockResolvedValue(undefined);
  });

  it("returns the claimed row with its fresh claim id", async () => {
    use([{ kind: "update", rows: [claimedRow] }]);

    await expect(claimRemission(31, "aprobacion", NOW)).resolves.toEqual(
      claimedRow,
    );
  });

  it("returns null when another attempt holds the claim or the row is sent", async () => {
    use([{ kind: "update", rows: [] }]);

    await expect(claimRemission(31, "aprobacion", NOW)).resolves.toBeNull();
  });

  it("stamps a new uuid claim, the time and one more attempt", async () => {
    const double = use([{ kind: "update", rows: [claimedRow] }]);

    await claimRemission(31, "aprobacion", NOW);

    const set = double.log[0].set as Record<string, unknown>;
    expect(set.reclamoId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(set.reclamadaEn).toEqual(NOW);
    expect(set.actualizadaEn).toEqual(NOW);
    expect(render(set.intentos).sql).toBe('"Remision"."Intentos" + 1');
  });

  it("uses a different claim id each time", async () => {
    const first = use([{ kind: "update", rows: [claimedRow] }]);
    await claimRemission(31, "aprobacion", NOW);
    const second = use([{ kind: "update", rows: [claimedRow] }]);
    await claimRemission(31, "aprobacion", NOW);

    expect((first.log[0].set as { reclamoId: string }).reclamoId).not.toBe(
      (second.log[0].set as { reclamoId: string }).reclamoId,
    );
  });

  it.each([
    ["aprobacion", ["pendiente"]],
    ["reintento_automatico", ["pendiente"]],
    ["formato_especial", ["pendiente"]],
    ["reenvio_manual", ["pendiente", "bloqueada"]],
  ] as const)("a %s attempt may claim only %j", async (trigger, states) => {
    const double = use([{ kind: "update", rows: [claimedRow] }]);

    await claimRemission(31, trigger, NOW);

    const query = render(double.log[0].where);
    expect(query.sql).toContain('"Remision"."Id" = $');
    expect(query.sql).toContain('"Remision"."Estado" in (');
    expect(query.params).toEqual([
      31,
      ...states,
      new Date(NOW.getTime() - CLAIM_LEASE_MS).toISOString(),
    ]);
    expect(query.params).not.toContain("enviada");
  });

  it("takes over only a missing or expired lease of ten minutes", async () => {
    const double = use([{ kind: "update", rows: [claimedRow] }]);

    await claimRemission(31, "aprobacion", NOW);

    const query = render(double.log[0].where);
    expect(CLAIM_LEASE_MS).toBe(10 * 60 * 1000);
    expect(query.sql).toContain('"Remision"."ReclamadaEn" is null or');
    expect(query.sql).toContain('"Remision"."ReclamadaEn" < $');
    expect(query.params.at(-1)).toBe("2026-10-19T14:50:00.000Z");
  });
});

describe("guarded completion by claim id (TR-6)", () => {
  beforeEach(() => {
    holder.current = null;
    insertAuditMock.mockReset();
    insertAuditMock.mockResolvedValue(undefined);
  });

  it("completes a sent remission and audits it in the same transaction", async () => {
    const double = use([{ kind: "update", rows: [{ id: 31 }] }]);

    const done = await completeSent(claim, {
      now: NOW,
      providerId: "49a3999c",
      actorId: ACTOR,
      origen: "aprobacion",
      adjuntos: 2,
    });

    expect(done).toBe(true);
    expect(double.transactions).toBe(1);
    expect(double.log[0].inTransaction).toBe(true);
    expect(double.log[0].set).toEqual({
      estado: "enviada",
      enviadaEn: NOW,
      proveedorMensajeId: "49a3999c",
      motivoCodigo: null,
      reclamoId: null,
      reclamadaEn: null,
      actualizadaEn: NOW,
    });
    expect(insertAuditMock).toHaveBeenCalledTimes(1);
    expect(insertAuditMock.mock.calls[0][1]).toBe(ACTOR);
    expect(insertAuditMock.mock.calls[0][2]).toEqual([
      {
        accion: "remision.enviada",
        entidadTipo: "Remision",
        entidadId: 31,
        datos: {
          solicitudId: 42,
          origen: "aprobacion",
          intentos: 1,
          adjuntos: 2,
        },
      },
    ]);
  });

  it("matches the row by id and claim id so a stale worker writes nothing", async () => {
    const double = use([{ kind: "update", rows: [] }]);

    const done = await completeSent(claim, {
      now: NOW,
      providerId: "x",
      actorId: ACTOR,
      origen: "aprobacion",
      adjuntos: 1,
    });

    const query = render(double.log[0].where);
    expect(query.sql).toContain('"Remision"."Id" = $');
    expect(query.sql).toContain('"Remision"."ReclamoId" = $');
    expect(query.params).toEqual([31, claim.reclamoId]);
    expect(done).toBe(false);
    expect(insertAuditMock).not.toHaveBeenCalled();
  });

  it("cuts a provider id that is too long for the column", async () => {
    const double = use([{ kind: "update", rows: [{ id: 31 }] }]);

    await completeSent(claim, {
      now: NOW,
      providerId: "p".repeat(300),
      actorId: ACTOR,
      origen: "aprobacion",
      adjuntos: 1,
    });

    expect(
      (double.log[0].set as { proveedorMensajeId: string }).proveedorMensajeId,
    ).toHaveLength(100);
  });

  it("returns a failed send to pendiente with error_envio and the closed code", async () => {
    const double = use([{ kind: "update", rows: [{ id: 31 }] }]);

    const done = await completeFailed(claim, {
      now: NOW,
      actorId: ACTOR,
      origen: "reintento_automatico",
      codigo: "unavailable",
    });

    expect(done).toBe(true);
    expect(double.log[0].set).toEqual({
      estado: "pendiente",
      motivoCodigo: "error_envio",
      reclamoId: null,
      reclamadaEn: null,
      actualizadaEn: NOW,
    });
    expect(insertAuditMock.mock.calls[0][2][0]).toEqual({
      accion: "remision.fallida",
      entidadTipo: "Remision",
      entidadId: 31,
      datos: {
        solicitudId: 42,
        origen: "reintento_automatico",
        intentos: 1,
        codigo: "unavailable",
      },
    });
  });

  it("gives the attempt back when the mail service is not configured yet", async () => {
    const double = use([{ kind: "update", rows: [{ id: 31 }] }]);

    await completeFailed(claim, {
      now: NOW,
      actorId: ACTOR,
      origen: "reintento_automatico",
      codigo: "not_configured",
    });

    const set = double.log[0].set as Record<string, unknown>;
    expect(render(set.intentos).sql).toBe(
      'greatest("Remision"."Intentos" - 1, 0)',
    );
    expect(set.motivoCodigo).toBe("error_envio");
  });

  it("keeps the attempt counted for every other failure code", async () => {
    const double = use([{ kind: "update", rows: [{ id: 31 }] }]);

    await completeFailed(claim, {
      now: NOW,
      actorId: ACTOR,
      origen: "reintento_automatico",
      codigo: "unavailable",
    });

    expect(double.log[0].set).not.toHaveProperty("intentos");
  });

  it("stores a blocker as bloqueada with its reason", async () => {
    const double = use([{ kind: "update", rows: [{ id: 31 }] }]);

    const done = await completeBlocked(claim, {
      now: NOW,
      actorId: ACTOR,
      origen: "reenvio_manual",
      motivo: "adjuntos_exceden_limite",
    });

    expect(done).toBe(true);
    expect(double.log[0].set).toEqual({
      estado: "bloqueada",
      motivoCodigo: "adjuntos_exceden_limite",
      reclamoId: null,
      reclamadaEn: null,
      actualizadaEn: NOW,
    });
    expect(insertAuditMock.mock.calls[0][2][0]).toMatchObject({
      accion: "remision.bloqueada",
      datos: {
        solicitudId: 42,
        origen: "reenvio_manual",
        motivo: "adjuntos_exceden_limite",
      },
    });
  });

  it("writes no audit row for a stale failure or block", async () => {
    use([{ kind: "update", rows: [] }]);
    await expect(
      completeFailed(claim, {
        now: NOW,
        actorId: ACTOR,
        origen: "aprobacion",
        codigo: "rejected",
      }),
    ).resolves.toBe(false);

    use([{ kind: "update", rows: [] }]);
    await expect(
      completeBlocked(claim, {
        now: NOW,
        actorId: ACTOR,
        origen: "aprobacion",
        motivo: "sin_correo",
      }),
    ).resolves.toBe(false);

    expect(insertAuditMock).not.toHaveBeenCalled();
  });

  it("rejects when the audit insert fails so the completion rolls back", async () => {
    use([{ kind: "update", rows: [{ id: 31 }] }]);
    insertAuditMock.mockRejectedValue(new Error("audit down"));

    await expect(
      completeSent(claim, {
        now: NOW,
        providerId: "x",
        actorId: ACTOR,
        origen: "aprobacion",
        adjuntos: 1,
      }),
    ).rejects.toThrow("audit down");
  });
});

describe("refreshRemissionEmail", () => {
  beforeEach(() => {
    holder.current = null;
  });

  it("stores the new email only while the claim is still held", async () => {
    const double = use([{ kind: "update", rows: [{ id: 31 }] }]);

    const done = await refreshRemissionEmail(claim, "nuevo@uam.edu.ni", NOW);

    expect(done).toBe(true);
    expect(double.log[0].set).toEqual({
      correo: "nuevo@uam.edu.ni",
      actualizadaEn: NOW,
    });
    const query = render(double.log[0].where);
    expect(query.params).toEqual([31, claim.reclamoId]);
  });

  it("reports a lost claim", async () => {
    use([{ kind: "update", rows: [] }]);

    await expect(
      refreshRemissionEmail(claim, "nuevo@uam.edu.ni", NOW),
    ).resolves.toBe(false);
  });
});

describe("listRemissions", () => {
  beforeEach(() => {
    holder.current = null;
  });

  it("returns the remission views of a request without claim internals", async () => {
    use([
      {
        kind: "select",
        rows: [
          {
            id: 31,
            docenteNombre: "Ana Perez",
            correo: "ana@uam.edu.ni",
            clases: [clase],
            estado: "enviada",
            motivoCodigo: null,
            enviadaEn: NOW,
            intentos: 1,
          },
          {
            id: 32,
            docenteNombre: "Luis Mora",
            correo: null,
            clases: [clase],
            estado: "bloqueada",
            motivoCodigo: "sin_correo",
            enviadaEn: null,
            intentos: 0,
          },
        ],
      },
    ]);

    const list = await listRemissions(42);

    expect(list.map((r) => [r.id, r.estado, r.motivoCodigo])).toEqual([
      [31, "enviada", null],
      [32, "bloqueada", "sin_correo"],
    ]);
    expect(list[0].enviadaEn).toEqual(NOW);
    expect(list[1].correo).toBeNull();
    expect(Object.keys(list[0])).not.toContain("reclamoId");
  });

  it("returns an empty list for a request without remissions", async () => {
    const double = use([{ kind: "select", rows: [] }]);

    await expect(listRemissions(42)).resolves.toEqual([]);
    expect(render(double.log[0].where).params).toEqual([42]);
  });
});

describe("unblockSpecialFormat (RN-19, TR-15)", () => {
  const tx = (script: Step[]) => {
    const double = createDbDouble(script);
    return { double, tx: double.tx as unknown as Transaction };
  };

  it("moves only formato_especial_faltante rows to pendiente and clears the reason", async () => {
    const { double, tx: handle } = tx([
      { kind: "update", rows: [{ id: 31 }, { id: 32 }] },
      { kind: "select", rows: [] },
    ]);

    const result = await unblockSpecialFormat(handle, 42, NOW);

    expect(double.log[0].set).toEqual({
      estado: "pendiente",
      motivoCodigo: null,
      actualizadaEn: NOW,
    });
    const query = render(double.log[0].where);
    expect(query.sql).toContain('"Remision"."SolicitudId" = $');
    expect(query.sql).toContain('"Remision"."Estado" = $');
    expect(query.sql).toContain('"Remision"."MotivoCodigo" = $');
    expect(query.params).toEqual([
      42,
      "bloqueada",
      "formato_especial_faltante",
    ]);
    expect(result.unblockedIds).toEqual([31, 32]);
  });

  it("also returns the other pending rows so a cut-off dispatch is finished", async () => {
    const { tx: handle } = tx([
      { kind: "update", rows: [{ id: 31 }] },
      { kind: "select", rows: [{ id: 33 }] },
    ]);

    const result = await unblockSpecialFormat(handle, 42, NOW);

    expect(result.unblockedIds).toEqual([31]);
    expect(result.dispatchIds).toEqual([31, 33]);
  });

  it("looks for other pending rows of the same request only", async () => {
    const { double, tx: handle } = tx([
      { kind: "update", rows: [] },
      { kind: "select", rows: [{ id: 33 }] },
    ]);

    const result = await unblockSpecialFormat(handle, 42, NOW);

    expect(render(double.log[1].where).params).toEqual([42, "pendiente"]);
    expect(result).toEqual({ unblockedIds: [], dispatchIds: [33] });
  });
});

describe("selectRetryCandidates (TR-12)", () => {
  beforeEach(() => {
    holder.current = null;
  });

  it("selects pending rows that are free, under the attempt cap, oldest first, bounded", async () => {
    const double = use([{ kind: "select", rows: [{ id: 31 }, { id: 32 }] }]);

    const ids = await selectRetryCandidates(NOW);

    expect(ids).toEqual([31, 32]);
    const query = render(double.log[0].where);
    expect(query.sql).toContain('"Remision"."Estado" = $');
    expect(query.sql).toContain('"Remision"."ReclamadaEn" is null or');
    expect(query.sql).toContain('"Remision"."Intentos" < $');
    expect(query.params).toEqual([
      "pendiente",
      new Date(NOW.getTime() - CLAIM_LEASE_MS).toISOString(),
      MAX_AUTO_ATTEMPTS,
    ]);
    expect(RETRY_BATCH_SIZE).toBe(20);
    expect(double.log[0].orderBy).toHaveLength(2);
  });

  it("returns an empty list when nothing is due", async () => {
    use([{ kind: "select", rows: [] }]);

    await expect(selectRetryCandidates(NOW)).resolves.toEqual([]);
  });
});

describe("findApprovingSecretaryId (TR-13 actor of the retry job)", () => {
  beforeEach(() => {
    holder.current = null;
  });

  it("returns the secretary of the approval decision", async () => {
    const double = use([{ kind: "select", rows: [{ secretariaId: 20 }] }]);

    await expect(findApprovingSecretaryId(42)).resolves.toBe(20);
    expect(render(double.log[0].where).params).toEqual([42, "aprobada"]);
  });

  it("returns null when the request has no approval decision", async () => {
    use([{ kind: "select", rows: [] }]);

    await expect(findApprovingSecretaryId(42)).resolves.toBeNull();
  });
});

describe("loadRequestForRemission (TR-7 step 2)", () => {
  beforeEach(() => {
    holder.current = null;
  });

  const solicitudRow = {
    causa: "medica",
    fechaInicio: "2026-10-01",
    fechaFin: "2026-10-03",
    estudianteNombre: "Carlos Ruiz",
    estudianteCif: "2021-0042",
    estudianteCorreo: "estudiante@uam.edu.ni",
    formatoEspecial: false,
  };

  it("returns the request snapshot and its current valid documents", async () => {
    const double = use([
      { kind: "select", rows: [solicitudRow] },
      {
        kind: "select",
        rows: [
          {
            id: 1,
            pathname: "intake/42/a.pdf",
            nombreOriginal: "constancia.pdf",
            tipoDetectado: "pdf",
            tamanoBytes: 1000,
            subidoPorId: null,
            formatoEspecial: false,
          },
        ],
      },
    ]);

    const context = await loadRequestForRemission(42);

    expect(context?.solicitud).toEqual(solicitudRow);
    expect(context?.documentos).toEqual([
      {
        id: 1,
        pathname: "intake/42/a.pdf",
        nombreOriginal: "constancia.pdf",
        tipoDetectado: "pdf",
        tamanoBytes: 1000,
        subidoPorId: null,
        formatoEspecial: false,
      },
    ]);
    const documents = render(double.log[1].where);
    expect(documents.sql).toContain('"DocumentoRespaldo"."RetiradoEn" is null');
    expect(documents.params).toEqual([42, "valido"]);
  });

  it("returns null when the request is missing", async () => {
    use([{ kind: "select", rows: [] }]);

    await expect(loadRequestForRemission(42)).resolves.toBeNull();
  });

  it("returns null when a presented-request field is missing", async () => {
    use([
      { kind: "select", rows: [{ ...solicitudRow, estudianteCorreo: null }] },
    ]);

    await expect(loadRequestForRemission(42)).resolves.toBeNull();
  });
});

describe("findTeacherEmail", () => {
  beforeEach(() => {
    holder.current = null;
  });

  it("returns the current catalog email of the teacher", async () => {
    const double = use([
      { kind: "select", rows: [{ correo: "ana@uam.edu.ni" }] },
    ]);

    await expect(findTeacherEmail(5)).resolves.toBe("ana@uam.edu.ni");
    expect(render(double.log[0].where).params).toEqual([5]);
  });

  it("returns null when the teacher still has no email or is unknown", async () => {
    use([{ kind: "select", rows: [{ correo: null }] }]);
    await expect(findTeacherEmail(5)).resolves.toBeNull();

    use([{ kind: "select", rows: [] }]);
    await expect(findTeacherEmail(5)).resolves.toBeNull();
  });
});

describe("authorizeResend (RF-09 c, RNF-01)", () => {
  const SCOPE = { kind: "facultad", facultadId: 4 } as const;

  beforeEach(() => {
    insertAuditMock.mockReset();
    insertAuditMock.mockResolvedValue(undefined);
  });

  it("returns the target and audits the resend with the state before it", async () => {
    const double = use([
      {
        kind: "select",
        rows: [{ id: 31, solicitudId: 42, estado: "bloqueada" }],
      },
    ]);

    const target = await authorizeResend(SCOPE, 31, ACTOR);

    expect(target).toEqual({ id: 31, solicitudId: 42, estado: "bloqueada" });
    expect(double.transactions).toBe(1);
    expect(render(double.log[0].where).params).toEqual([31, 4]);
    expect(insertAuditMock).toHaveBeenCalledWith(expect.anything(), ACTOR, [
      {
        accion: "remision.reenviada",
        entidadTipo: "Remision",
        entidadId: 31,
        datos: { solicitudId: 42, estadoPrevio: "bloqueada" },
      },
    ]);
  });

  it("returns an already sent remission without an audit row", async () => {
    use([
      {
        kind: "select",
        rows: [{ id: 31, solicitudId: 42, estado: "enviada" }],
      },
    ]);

    await expect(authorizeResend(SCOPE, 31, ACTOR)).resolves.toEqual({
      id: 31,
      solicitudId: 42,
      estado: "enviada",
    });
    expect(insertAuditMock).not.toHaveBeenCalled();
  });

  it("returns null without an audit row when the id is unknown or out of scope", async () => {
    use([{ kind: "select", rows: [] }]);

    await expect(authorizeResend(SCOPE, 99, ACTOR)).resolves.toBeNull();
    expect(insertAuditMock).not.toHaveBeenCalled();
  });
});
