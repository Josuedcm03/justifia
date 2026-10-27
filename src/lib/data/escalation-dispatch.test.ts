// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeMailSender } from "@/lib/intake/fakes";

vi.mock("server-only", () => ({}));

const escalamientoMock = vi.hoisted(() => ({
  claimEscalationNotice: vi.fn(),
  completeNoticeBlocked: vi.fn(),
  completeNoticeFailed: vi.fn(),
  completeNoticeNotConfigured: vi.fn(),
  completeNoticeSent: vi.fn(),
  listCoordinationRecipients: vi.fn(),
  loadNoticeContext: vi.fn(),
}));
vi.mock("@/lib/data/escalamiento", () => escalamientoMock);

import type {
  EscalationNoticeClaim,
  NoticeContext,
} from "@/lib/data/escalamiento";
import {
  dispatchEscalationNotice,
  dispatchEscalationNotices,
} from "@/lib/data/escalation-dispatch";

const NOW = new Date("2026-10-22T15:00:00.000Z");
const ACTOR = 20;
const SECRETARIA = 77;
const BASE_URL = "https://justifia.example.edu";

function claim(
  overrides: Partial<EscalationNoticeClaim> = {},
): EscalationNoticeClaim {
  return {
    id: 7,
    solicitudId: 42,
    tipo: "sospecha_documento",
    secretariaId: SECRETARIA,
    estado: "pendiente",
    motivo: null,
    intentos: 1,
    reclamoId: "11111111-1111-4111-8111-111111111111",
    ...overrides,
  };
}

function context(overrides: Partial<NoticeContext> = {}): NoticeContext {
  return {
    escalamientoId: 7,
    solicitudId: 42,
    tipo: "sospecha_documento",
    nota: "La firma del médico no coincide con el sello.",
    estudianteNombre: "Carlos Ruiz",
    estudianteCif: "2021-0042",
    carreraNombre: "Ingeniería de Sistemas",
    ...overrides,
  };
}

/** `null` leaves APP_BASE_URL unset. */
function setup(baseUrl: string | null = BASE_URL) {
  const mail = createFakeMailSender();
  return {
    deps: { mail, baseUrl: baseUrl ?? undefined, now: () => NOW },
    mail,
  };
}

const creation = { trigger: "escalamiento", actorId: ACTOR } as const;

beforeEach(() => {
  for (const mock of Object.values(escalamientoMock)) mock.mockReset();
  escalamientoMock.claimEscalationNotice.mockResolvedValue(claim());
  escalamientoMock.loadNoticeContext.mockResolvedValue(context());
  escalamientoMock.listCoordinationRecipients.mockResolvedValue([
    "coord1@uam.edu.ni",
  ]);
  escalamientoMock.completeNoticeSent.mockResolvedValue(true);
  escalamientoMock.completeNoticeFailed.mockResolvedValue(true);
  escalamientoMock.completeNoticeBlocked.mockResolvedValue(true);
  escalamientoMock.completeNoticeNotConfigured.mockResolvedValue(true);
});

describe("dispatchEscalationNotice (RF-10 b, ES-11)", () => {
  describe("success", () => {
    it("sends one message to the recipients of the career with the link and no attachment", async () => {
      const { deps, mail } = setup();
      escalamientoMock.listCoordinationRecipients.mockResolvedValue([
        "coord1@uam.edu.ni",
        "coord2@uam.edu.ni",
      ]);

      const result = await dispatchEscalationNotice(7, creation, deps);

      expect(result).toEqual({ outcome: "sent" });
      expect(mail.sent).toHaveLength(1);
      const [message] = mail.sent;
      expect(message.to).toBe("coord1@uam.edu.ni");
      expect(message.cc).toEqual(["coord2@uam.edu.ni"]);
      expect(message.attachments).toEqual([]);
      expect(message.text).toContain(
        "https://justifia.example.edu/coordination/7",
      );
      expect(message.idempotencyKey).toMatch(/^escalamiento-7-[0-9a-f]{16}$/);
    });

    it("resolves the recipients for the request of the claimed notice, at this attempt", async () => {
      const { deps } = setup();

      await dispatchEscalationNotice(7, creation, deps);

      expect(escalamientoMock.listCoordinationRecipients).toHaveBeenCalledWith(
        42,
      );
      expect(escalamientoMock.claimEscalationNotice).toHaveBeenCalledWith(
        7,
        "escalamiento",
        NOW,
      );
    });

    it("completes as enviada with the provider id, the recipient count and the session actor", async () => {
      const { deps } = setup();
      escalamientoMock.listCoordinationRecipients.mockResolvedValue([
        "a@uam.edu.ni",
        "b@uam.edu.ni",
        "c@uam.edu.ni",
      ]);

      await dispatchEscalationNotice(7, creation, deps);

      expect(escalamientoMock.completeNoticeSent).toHaveBeenCalledWith(
        claim(),
        {
          now: NOW,
          actorId: ACTOR,
          origen: "escalamiento",
          providerId: "fake-1",
          destinatarios: 3,
        },
      );
      expect(escalamientoMock.completeNoticeFailed).not.toHaveBeenCalled();
      expect(escalamientoMock.completeNoticeBlocked).not.toHaveBeenCalled();
    });

    it("sends the report note of an excess notice", async () => {
      const { deps, mail } = setup();
      escalamientoMock.loadNoticeContext.mockResolvedValue(
        context({ tipo: "exceso_inasistencias", nota: "Supera el límite." }),
      );

      await dispatchEscalationNotice(7, creation, deps);

      expect(mail.sent[0].text).toContain("Motivo: Exceso de inasistencias");
      expect(mail.sent[0].text).toContain("Nota: Supera el límite.");
    });
  });

  describe("provider error", () => {
    it("leaves the notice pendiente with the closed code, never the provider text", async () => {
      const { deps, mail } = setup();
      mail.failWith("unavailable");

      const result = await dispatchEscalationNotice(7, creation, deps);

      expect(result).toEqual({ outcome: "failed", codigo: "unavailable" });
      expect(escalamientoMock.completeNoticeFailed).toHaveBeenCalledWith(
        claim(),
        {
          now: NOW,
          actorId: ACTOR,
          origen: "escalamiento",
          codigo: "unavailable",
        },
      );
      expect(escalamientoMock.completeNoticeSent).not.toHaveBeenCalled();
      expect(
        JSON.stringify(escalamientoMock.completeNoticeFailed.mock.calls),
      ).not.toContain("@");
    });

    it.each(["rejected", "unavailable"] as const)(
      "carries the %s code from the mail port",
      async (code) => {
        const { deps, mail } = setup();
        mail.failWith(code);

        await expect(
          dispatchEscalationNotice(7, creation, deps),
        ).resolves.toEqual({ outcome: "failed", codigo: code });
      },
    );
  });

  describe("no recipient", () => {
    it("blocks with sin_destinatarios, sends nothing and leaves the escalation alone", async () => {
      const { deps, mail } = setup();
      escalamientoMock.listCoordinationRecipients.mockResolvedValue([]);

      const result = await dispatchEscalationNotice(7, creation, deps);

      expect(result).toEqual({
        outcome: "blocked",
        motivo: "sin_destinatarios",
      });
      expect(mail.calls).toHaveLength(0);
      expect(escalamientoMock.completeNoticeBlocked).toHaveBeenCalledWith(
        claim(),
        { now: NOW, actorId: ACTOR, origen: "escalamiento" },
      );
    });

    it("blocks a report notice whose career has no account or no email, both tipos alike", async () => {
      const { deps, mail } = setup();
      escalamientoMock.listCoordinationRecipients.mockResolvedValue([]);
      escalamientoMock.claimEscalationNotice.mockResolvedValue(
        claim({ tipo: "exceso_inasistencias" }),
      );
      escalamientoMock.loadNoticeContext.mockResolvedValue(
        context({ tipo: "exceso_inasistencias", nota: null }),
      );

      await expect(
        dispatchEscalationNotice(7, creation, deps),
      ).resolves.toEqual({ outcome: "blocked", motivo: "sin_destinatarios" });
      expect(mail.calls).toHaveLength(0);
    });

    it("blocks when the recipients are gone after the escalation, even with mail unconfigured", async () => {
      const { deps, mail } = setup(null);
      escalamientoMock.listCoordinationRecipients.mockResolvedValue([]);

      await expect(
        dispatchEscalationNotice(7, creation, deps),
      ).resolves.toEqual({ outcome: "blocked", motivo: "sin_destinatarios" });
      expect(escalamientoMock.completeNoticeFailed).not.toHaveBeenCalled();
      expect(mail.calls).toHaveLength(0);
    });
  });

  describe("mail not configured (nothing was attempted)", () => {
    it("leaves the notice pendiente without a failure when APP_BASE_URL is unset, sending nothing", async () => {
      const { deps, mail } = setup(null);

      const result = await dispatchEscalationNotice(7, creation, deps);

      expect(result).toEqual({ outcome: "skipped", reason: "not_configured" });
      expect(mail.calls).toHaveLength(0);
      expect(escalamientoMock.completeNoticeNotConfigured).toHaveBeenCalledWith(
        claim(),
        { now: NOW },
      );
      expect(escalamientoMock.completeNoticeFailed).not.toHaveBeenCalled();
    });

    it("treats the mail port's not_configured the same: no failure, no attempt counted", async () => {
      const { deps, mail } = setup();
      mail.failWith("not_configured");

      const result = await dispatchEscalationNotice(7, creation, deps);

      expect(result).toEqual({ outcome: "skipped", reason: "not_configured" });
      expect(escalamientoMock.completeNoticeNotConfigured).toHaveBeenCalledWith(
        claim(),
        { now: NOW },
      );
      expect(escalamientoMock.completeNoticeFailed).not.toHaveBeenCalled();
    });

    it("reports a lost claim when the release matched no row", async () => {
      const { deps } = setup(null);
      escalamientoMock.completeNoticeNotConfigured.mockResolvedValue(false);

      await expect(
        dispatchEscalationNotice(7, creation, deps),
      ).resolves.toEqual({ outcome: "lost" });
    });

    it("counts the notice as skipped in a batch", async () => {
      const { deps } = setup(null);

      await expect(
        dispatchEscalationNotices(
          [7],
          { trigger: "reintento_automatico" },
          deps,
        ),
      ).resolves.toMatchObject({ skipped: 1, failed: 0 });
    });
  });

  describe("actor", () => {
    it("uses the escalating secretary for the scheduled retry, which has no session", async () => {
      const { deps } = setup();

      await dispatchEscalationNotice(
        7,
        { trigger: "reintento_automatico" },
        deps,
      );

      expect(escalamientoMock.completeNoticeSent).toHaveBeenCalledWith(
        claim(),
        expect.objectContaining({
          actorId: SECRETARIA,
          origen: "reintento_automatico",
        }),
      );
    });

    it("uses the session user for a resend", async () => {
      const { deps } = setup();

      await dispatchEscalationNotice(
        7,
        { trigger: "reenvio_manual", actorId: ACTOR },
        deps,
      );

      expect(escalamientoMock.claimEscalationNotice).toHaveBeenCalledWith(
        7,
        "reenvio_manual",
        NOW,
      );
      expect(escalamientoMock.completeNoticeSent).toHaveBeenCalledWith(
        claim(),
        expect.objectContaining({ actorId: ACTOR, origen: "reenvio_manual" }),
      );
    });
  });

  describe("claims and stale workers", () => {
    it("skips a notice that is sent already or held by another attempt, sending nothing", async () => {
      const { deps, mail } = setup();
      escalamientoMock.claimEscalationNotice.mockResolvedValue(null);

      await expect(
        dispatchEscalationNotice(7, creation, deps),
      ).resolves.toEqual({ outcome: "skipped" });
      expect(mail.calls).toHaveLength(0);
      expect(
        escalamientoMock.listCoordinationRecipients,
      ).not.toHaveBeenCalled();
    });

    it("reports lost when the lease was taken over before the completion", async () => {
      const { deps } = setup();
      escalamientoMock.completeNoticeSent.mockResolvedValue(false);

      await expect(
        dispatchEscalationNotice(7, creation, deps),
      ).resolves.toEqual({ outcome: "lost" });
    });

    it("reports lost for a stale failure and a stale block", async () => {
      const failing = setup();
      failing.mail.failWith("rejected");
      escalamientoMock.completeNoticeFailed.mockResolvedValue(false);
      await expect(
        dispatchEscalationNotice(7, creation, failing.deps),
      ).resolves.toEqual({ outcome: "lost" });

      const blocking = setup();
      escalamientoMock.listCoordinationRecipients.mockResolvedValue([]);
      escalamientoMock.completeNoticeBlocked.mockResolvedValue(false);
      await expect(
        dispatchEscalationNotice(7, creation, blocking.deps),
      ).resolves.toEqual({ outcome: "lost" });
    });

    it("throws, leaving the claim to expire, when the notice context is missing", async () => {
      const { deps, mail } = setup();
      escalamientoMock.loadNoticeContext.mockResolvedValue(null);

      await expect(dispatchEscalationNotice(7, creation, deps)).rejects.toThrow(
        "escalation_notice_context_missing",
      );
      expect(mail.calls).toHaveLength(0);
    });
  });
});

describe("dispatchEscalationNotices (RNF-07 a)", () => {
  it("dispatches the notices one after another and counts the outcomes", async () => {
    const { deps } = setup();
    const order: number[] = [];
    escalamientoMock.claimEscalationNotice.mockImplementation(
      async (id: number) => {
        order.push(id);
        return id === 9 ? null : claim({ id });
      },
    );

    const summary = await dispatchEscalationNotices([7, 8, 9], creation, deps);

    expect(order).toEqual([7, 8, 9]);
    expect(summary).toEqual({
      sent: 2,
      failed: 0,
      blocked: 0,
      skipped: 1,
      lost: 0,
      errored: 0,
    });
  });

  it("contains a throwing notice, keeps going and logs codes only", async () => {
    const { deps, mail } = setup();
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    escalamientoMock.claimEscalationNotice
      .mockRejectedValueOnce(new Error("boom for coord1@uam.edu.ni"))
      .mockResolvedValueOnce(claim({ id: 8 }));

    const summary = await dispatchEscalationNotices([7, 8], creation, deps);

    expect(summary.errored).toBe(1);
    expect(summary.sent).toBe(1);
    expect(mail.sent).toHaveLength(1);
    expect(log).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(log.mock.calls)).not.toContain("@");
    expect(JSON.stringify(log.mock.calls)).toContain("7");
    log.mockRestore();
  });

  it("never throws, even when every notice fails", async () => {
    const { deps } = setup();
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    escalamientoMock.claimEscalationNotice.mockRejectedValue(
      new Error("db down"),
    );

    await expect(
      dispatchEscalationNotices([7, 8], creation, deps),
    ).resolves.toMatchObject({ errored: 2, sent: 0 });
    log.mockRestore();
  });

  it("returns an empty summary for no ids", async () => {
    const { deps } = setup();

    await expect(
      dispatchEscalationNotices([], creation, deps),
    ).resolves.toEqual({
      sent: 0,
      failed: 0,
      blocked: 0,
      skipped: 0,
      lost: 0,
      errored: 0,
    });
    expect(escalamientoMock.claimEscalationNotice).not.toHaveBeenCalled();
  });
});
