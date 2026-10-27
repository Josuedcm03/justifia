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

import {
  authorizeNoticeResend,
  claimEscalationNotice,
  completeNoticeBlocked,
  completeNoticeFailed,
  completeNoticeSent,
  listCoordinationRecipients,
  loadNoticeContext,
  selectEscalationRetryCandidates,
  type EscalationNoticeClaim,
} from "@/lib/data/escalamiento";
import { CLAIM_LEASE_MS } from "@/lib/data/outbox";

const NOW = new Date("2026-10-22T15:00:00.000Z");
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

const claimedRow = {
  id: 7,
  solicitudId: 42,
  tipo: "sospecha_documento",
  secretariaId: 20,
  estado: "pendiente",
  motivo: null,
  intentos: 1,
  reclamoId: "11111111-1111-4111-8111-111111111111",
};

const claim = { ...claimedRow } as EscalationNoticeClaim;

beforeEach(() => {
  holder.current = null;
  insertAuditMock.mockReset();
  insertAuditMock.mockResolvedValue(undefined);
});

describe("listCoordinationRecipients (RF-10 b, E4, ES-3)", () => {
  it("returns the emails of the active coordinators of the student's live career, by id", async () => {
    const double = use([
      {
        kind: "select",
        rows: [{ correo: "uno@uam.edu.ni" }, { correo: "dos@uam.edu.ni" }],
      },
    ]);

    await expect(listCoordinationRecipients(42)).resolves.toEqual([
      "uno@uam.edu.ni",
      "dos@uam.edu.ni",
    ]);

    const query = render(double.log[0].where);
    expect(query.sql).toContain('"Solicitud"."Id" = $');
    expect(query.sql).toContain('"Rol"."Codigo" = $');
    expect(query.sql).toContain('"Usuario"."Activo" = $');
    expect(query.sql).toContain('"Usuario"."Correo" is not null');
    expect(query.params).toEqual([42, "coordinacion", true]);
    expect(double.log[0].orderBy).toHaveLength(1);
  });

  it("compares the coordinator's career with the student's CURRENT career, not a snapshot", async () => {
    const double = use([{ kind: "select", rows: [] }]);

    await listCoordinationRecipients(42);

    // One statement joins Solicitud -> student Usuario -> coordinator Usuario
    // on CarreraId, so a later career change or account is read fresh.
    expect(double.log).toHaveLength(1);
    expect(double.log[0].kind).toBe("select");
  });

  it("returns an empty list when the career has no coordinator with an email", async () => {
    use([{ kind: "select", rows: [] }]);

    await expect(listCoordinationRecipients(42)).resolves.toEqual([]);
  });

  it("drops a null or blank address the query let through", async () => {
    use([
      {
        kind: "select",
        rows: [
          { correo: null },
          { correo: "  " },
          { correo: "uno@uam.edu.ni" },
        ],
      },
    ]);

    await expect(listCoordinationRecipients(42)).resolves.toEqual([
      "uno@uam.edu.ni",
    ]);
  });
});

describe("loadNoticeContext (ES-10)", () => {
  const row = {
    escalamientoId: 7,
    solicitudId: 42,
    tipo: "sospecha_documento",
    nota: "La firma no coincide.",
    reporteNota: null,
    estudianteNombre: "Carlos Ruiz",
    estudianteCif: "2021-0042",
    carreraNombre: "Ingeniería de Sistemas",
  };

  it("returns what the message needs, with the live career name", async () => {
    const double = use([{ kind: "select", rows: [row] }]);

    await expect(loadNoticeContext(7)).resolves.toEqual({
      escalamientoId: 7,
      solicitudId: 42,
      tipo: "sospecha_documento",
      nota: "La firma no coincide.",
      estudianteNombre: "Carlos Ruiz",
      estudianteCif: "2021-0042",
      carreraNombre: "Ingeniería de Sistemas",
    });
    expect(render(double.log[0].where).params).toEqual([7]);
  });

  it("takes the report note for an excess notice, and no note when the report has none", async () => {
    use([
      {
        kind: "select",
        rows: [
          {
            ...row,
            tipo: "exceso_inasistencias",
            nota: null,
            reporteNota: "Supera el límite.",
          },
        ],
      },
    ]);
    await expect(loadNoticeContext(7)).resolves.toMatchObject({
      tipo: "exceso_inasistencias",
      nota: "Supera el límite.",
    });

    use([
      {
        kind: "select",
        rows: [
          {
            ...row,
            tipo: "exceso_inasistencias",
            nota: null,
            reporteNota: null,
          },
        ],
      },
    ]);
    await expect(loadNoticeContext(7)).resolves.toMatchObject({ nota: null });
  });

  it("returns null when the escalation is gone or a field the message needs is missing", async () => {
    use([{ kind: "select", rows: [] }]);
    await expect(loadNoticeContext(7)).resolves.toBeNull();

    use([{ kind: "select", rows: [{ ...row, estudianteCif: null }] }]);
    await expect(loadNoticeContext(7)).resolves.toBeNull();
  });
});

describe("claimEscalationNotice (RNF-07, concurrent attempts)", () => {
  it("returns the claimed row with its fresh claim id", async () => {
    use([{ kind: "update", rows: [claimedRow] }]);

    await expect(
      claimEscalationNotice(7, "escalamiento", NOW),
    ).resolves.toEqual(claimedRow);
  });

  it("returns null when another attempt holds the claim or the notice is sent", async () => {
    use([{ kind: "update", rows: [] }]);

    await expect(
      claimEscalationNotice(7, "escalamiento", NOW),
    ).resolves.toBeNull();
  });

  it("stamps a new uuid claim, the time and one more attempt", async () => {
    const double = use([{ kind: "update", rows: [claimedRow] }]);

    await claimEscalationNotice(7, "escalamiento", NOW);

    const set = double.log[0].set as Record<string, unknown>;
    expect(set.reclamoId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(set.reclamadaEn).toEqual(NOW);
    expect(set.actualizadaEn).toEqual(NOW);
    expect(render(set.intentos).sql).toBe('"Escalamiento"."Intentos" + 1');
  });

  it.each([
    ["escalamiento", ["pendiente"]],
    ["reintento_automatico", ["pendiente"]],
    ["reenvio_manual", ["pendiente", "bloqueada"]],
  ] as const)("a %s attempt may claim only %j", async (trigger, states) => {
    const double = use([{ kind: "update", rows: [claimedRow] }]);

    await claimEscalationNotice(7, trigger, NOW);

    const query = render(double.log[0].where);
    expect(query.sql).toContain('"Escalamiento"."Id" = $');
    expect(query.sql).toContain('"Escalamiento"."NotificacionEstado" in (');
    expect(query.params).toEqual([
      7,
      ...states,
      new Date(NOW.getTime() - CLAIM_LEASE_MS).toISOString(),
    ]);
    expect(query.params).not.toContain("enviada");
  });

  it("takes over only a missing or expired lease", async () => {
    const double = use([{ kind: "update", rows: [claimedRow] }]);

    await claimEscalationNotice(7, "escalamiento", NOW);

    const query = render(double.log[0].where);
    expect(query.sql).toContain('"Escalamiento"."ReclamadaEn" is null or');
    expect(query.sql).toContain('"Escalamiento"."ReclamadaEn" < $');
    expect(query.params.at(-1)).toBe("2026-10-22T14:50:00.000Z");
  });
});

describe("guarded completion by claim id", () => {
  it("completes a sent notice once with the send time, and audits it in the same transaction", async () => {
    const double = use([{ kind: "update", rows: [{ id: 7 }] }]);

    const done = await completeNoticeSent(claim, {
      now: NOW,
      providerId: "49a3999c",
      actorId: ACTOR,
      origen: "escalamiento",
      destinatarios: 2,
    });

    expect(done).toBe(true);
    expect(double.transactions).toBe(1);
    expect(double.log[0].inTransaction).toBe(true);
    expect(double.log[0].set).toEqual({
      notificacionEstado: "enviada",
      enviadaEn: NOW,
      proveedorMensajeId: "49a3999c",
      notificacionMotivo: null,
      reclamoId: null,
      reclamadaEn: null,
      actualizadaEn: NOW,
    });
    expect(insertAuditMock).toHaveBeenCalledTimes(1);
    expect(insertAuditMock.mock.calls[0][1]).toBe(ACTOR);
    expect(insertAuditMock.mock.calls[0][2]).toEqual([
      {
        accion: "escalamiento.notificacion_enviada",
        entidadTipo: "Escalamiento",
        entidadId: 7,
        datos: {
          solicitudId: 42,
          origen: "escalamiento",
          intentos: 1,
          destinatarios: 2,
        },
      },
    ]);
  });

  it("matches the row by id and claim id so a stale worker writes nothing", async () => {
    const double = use([{ kind: "update", rows: [] }]);

    const done = await completeNoticeSent(claim, {
      now: NOW,
      providerId: "x",
      actorId: ACTOR,
      origen: "escalamiento",
      destinatarios: 1,
    });

    const query = render(double.log[0].where);
    expect(query.sql).toContain('"Escalamiento"."Id" = $');
    expect(query.sql).toContain('"Escalamiento"."ReclamoId" = $');
    expect(query.params).toEqual([7, claim.reclamoId]);
    expect(done).toBe(false);
    expect(insertAuditMock).not.toHaveBeenCalled();
  });

  it("cuts a provider id that is too long for the column", async () => {
    const double = use([{ kind: "update", rows: [{ id: 7 }] }]);

    await completeNoticeSent(claim, {
      now: NOW,
      providerId: "p".repeat(300),
      actorId: ACTOR,
      origen: "escalamiento",
      destinatarios: 1,
    });

    expect(
      (double.log[0].set as { proveedorMensajeId: string }).proveedorMensajeId,
    ).toHaveLength(100);
  });

  it("returns a failed send to pendiente with error_envio, the attempt counted, and the closed code audited", async () => {
    const double = use([{ kind: "update", rows: [{ id: 7 }] }]);

    const done = await completeNoticeFailed(claim, {
      now: NOW,
      actorId: ACTOR,
      origen: "reintento_automatico",
      codigo: "unavailable",
    });

    expect(done).toBe(true);
    expect(double.log[0].set).toEqual({
      notificacionEstado: "pendiente",
      notificacionMotivo: "error_envio",
      reclamoId: null,
      reclamadaEn: null,
      actualizadaEn: NOW,
    });
    expect(insertAuditMock.mock.calls[0][2][0]).toEqual({
      accion: "escalamiento.notificacion_fallida",
      entidadTipo: "Escalamiento",
      entidadId: 7,
      datos: {
        solicitudId: 42,
        origen: "reintento_automatico",
        intentos: 1,
        codigo: "unavailable",
      },
    });
  });

  it("gives the attempt back when the mail service is not configured yet", async () => {
    const double = use([{ kind: "update", rows: [{ id: 7 }] }]);

    await completeNoticeFailed(claim, {
      now: NOW,
      actorId: ACTOR,
      origen: "reintento_automatico",
      codigo: "not_configured",
    });

    const set = double.log[0].set as Record<string, unknown>;
    expect(render(set.intentos).sql).toBe(
      'greatest("Escalamiento"."Intentos" - 1, 0)',
    );
    expect(set.notificacionMotivo).toBe("error_envio");
  });

  it("stores a notice without recipients as bloqueada with sin_destinatarios", async () => {
    const double = use([{ kind: "update", rows: [{ id: 7 }] }]);

    const done = await completeNoticeBlocked(claim, {
      now: NOW,
      actorId: ACTOR,
      origen: "reenvio_manual",
    });

    expect(done).toBe(true);
    expect(double.log[0].set).toEqual({
      notificacionEstado: "bloqueada",
      notificacionMotivo: "sin_destinatarios",
      reclamoId: null,
      reclamadaEn: null,
      actualizadaEn: NOW,
    });
    expect(insertAuditMock.mock.calls[0][2].at(-1)).toEqual({
      accion: "escalamiento.notificacion_bloqueada",
      entidadTipo: "Escalamiento",
      entidadId: 7,
      datos: {
        solicitudId: 42,
        origen: "reenvio_manual",
        motivo: "sin_destinatarios",
      },
    });
  });

  it("writes no audit row for a stale failure or block", async () => {
    use([{ kind: "update", rows: [] }]);
    await expect(
      completeNoticeFailed(claim, {
        now: NOW,
        actorId: ACTOR,
        origen: "escalamiento",
        codigo: "rejected",
      }),
    ).resolves.toBe(false);

    use([{ kind: "update", rows: [] }]);
    await expect(
      completeNoticeBlocked(claim, {
        now: NOW,
        actorId: ACTOR,
        origen: "escalamiento",
      }),
    ).resolves.toBe(false);

    expect(insertAuditMock).not.toHaveBeenCalled();
  });

  it("rejects when the audit insert fails so the completion rolls back", async () => {
    use([{ kind: "update", rows: [{ id: 7 }] }]);
    insertAuditMock.mockRejectedValue(new Error("audit down"));

    await expect(
      completeNoticeSent(claim, {
        now: NOW,
        providerId: "x",
        actorId: ACTOR,
        origen: "escalamiento",
        destinatarios: 1,
      }),
    ).rejects.toThrow("audit down");
  });
});

describe("selectEscalationRetryCandidates (RNF-07, scheduled job)", () => {
  it("selects pending notices that are free, under the attempt cap, oldest first, bounded", async () => {
    const double = use([{ kind: "select", rows: [{ id: 7 }, { id: 8 }] }]);

    const ids = await selectEscalationRetryCandidates(NOW);

    expect(ids).toEqual([7, 8]);
    const query = render(double.log[0].where);
    expect(query.sql).toContain('"Escalamiento"."NotificacionEstado" = $');
    expect(query.sql).toContain('"Escalamiento"."ReclamadaEn" is null or');
    expect(query.sql).toContain('"Escalamiento"."Intentos" < $');
    expect(query.params).toEqual([
      "pendiente",
      new Date(NOW.getTime() - CLAIM_LEASE_MS).toISOString(),
      MAX_AUTO_ATTEMPTS,
    ]);
    expect(query.params).not.toContain("bloqueada");
    expect(query.params).not.toContain("enviada");
    expect(RETRY_BATCH_SIZE).toBe(20);
    expect(double.log[0].limit).toBe(RETRY_BATCH_SIZE);
    expect(double.log[0].orderBy).toHaveLength(2);
  });

  it("returns an empty list when nothing is due", async () => {
    use([{ kind: "select", rows: [] }]);

    await expect(selectEscalationRetryCandidates(NOW)).resolves.toEqual([]);
  });
});

describe("authorizeNoticeResend (RF-10 b, RNF-01)", () => {
  const SCOPE = { kind: "facultad", facultadId: 4 } as const;

  it("returns the target in scope and writes no audit row: the row belongs to the attempt", async () => {
    const double = use([
      {
        kind: "select",
        rows: [{ id: 7, solicitudId: 42, estado: "bloqueada" }],
      },
    ]);

    const target = await authorizeNoticeResend(SCOPE, 7);

    expect(target).toEqual({ id: 7, solicitudId: 42, estado: "bloqueada" });
    expect(double.transactions).toBe(0);
    expect(render(double.log[0].where).params).toEqual([7, 4]);
    expect(insertAuditMock).not.toHaveBeenCalled();
  });

  it("returns a pending and a sent notice alike, without an audit row", async () => {
    use([
      {
        kind: "select",
        rows: [{ id: 7, solicitudId: 42, estado: "pendiente" }],
      },
    ]);
    await expect(authorizeNoticeResend(SCOPE, 7)).resolves.toMatchObject({
      estado: "pendiente",
    });

    use([
      {
        kind: "select",
        rows: [{ id: 7, solicitudId: 42, estado: "enviada" }],
      },
    ]);
    await expect(authorizeNoticeResend(SCOPE, 7)).resolves.toMatchObject({
      estado: "enviada",
    });
    expect(insertAuditMock).not.toHaveBeenCalled();
  });

  it("returns null when the id is unknown or out of scope", async () => {
    use([{ kind: "select", rows: [] }]);

    await expect(authorizeNoticeResend(SCOPE, 99)).resolves.toBeNull();
    expect(insertAuditMock).not.toHaveBeenCalled();
  });
});

describe("the resend audit row belongs to the attempt (audit-log: one row per operation)", () => {
  const reenviada = (estadoPrevio: string) => ({
    accion: "escalamiento.notificacion_reenviada",
    entidadTipo: "Escalamiento",
    entidadId: 7,
    datos: { solicitudId: 42, estadoPrevio },
  });
  const manual = {
    now: NOW,
    actorId: ACTOR,
    origen: "reenvio_manual",
  } as const;

  it("adds the resend row before the outcome row of a resend that sends, in the same transaction", async () => {
    const double = use([{ kind: "update", rows: [{ id: 7 }] }]);

    await completeNoticeSent(
      { ...claim, estado: "bloqueada", motivo: "sin_destinatarios" },
      { ...manual, providerId: "p", destinatarios: 1 },
    );

    expect(double.transactions).toBe(1);
    expect(insertAuditMock).toHaveBeenCalledTimes(1);
    const rows = insertAuditMock.mock.calls[0][2];
    expect(rows.map((r: { accion: string }) => r.accion)).toEqual([
      "escalamiento.notificacion_reenviada",
      "escalamiento.notificacion_enviada",
    ]);
    expect(rows[0]).toEqual(reenviada("bloqueada"));
    expect(insertAuditMock.mock.calls[0][1]).toBe(ACTOR);
  });

  it("adds it to a resend that fails and to a resend that finds no recipient", async () => {
    use([{ kind: "update", rows: [{ id: 7 }] }]);
    await completeNoticeFailed(claim, { ...manual, codigo: "rejected" });
    use([{ kind: "update", rows: [{ id: 7 }] }]);
    await completeNoticeBlocked(claim, manual);

    expect(
      insertAuditMock.mock.calls.map((call) =>
        call[2].map((r: { accion: string }) => r.accion),
      ),
    ).toEqual([
      [
        "escalamiento.notificacion_reenviada",
        "escalamiento.notificacion_fallida",
      ],
      [
        "escalamiento.notificacion_reenviada",
        "escalamiento.notificacion_bloqueada",
      ],
    ]);
    expect(insertAuditMock.mock.calls[0][2][0]).toEqual(reenviada("pendiente"));
  });

  it("writes no resend row when the claim was lost: the completion matches no row", async () => {
    use([{ kind: "update", rows: [] }]);

    await expect(
      completeNoticeSent(claim, {
        ...manual,
        providerId: "p",
        destinatarios: 1,
      }),
    ).resolves.toBe(false);
    expect(insertAuditMock).not.toHaveBeenCalled();
  });

  it.each(["escalamiento", "reintento_automatico"] as const)(
    "writes no resend row for a %s attempt",
    async (origen) => {
      use([{ kind: "update", rows: [{ id: 7 }] }]);

      await completeNoticeSent(claim, {
        now: NOW,
        actorId: ACTOR,
        origen,
        providerId: "p",
        destinatarios: 1,
      });

      expect(insertAuditMock.mock.calls[0][2]).toHaveLength(1);
    },
  );
});
