import { beforeEach, describe, expect, it, vi } from "vitest";

import { sessionFor } from "@/app/(dashboard)/review/test-support";
import { ACCESS_DENIED_PATH } from "@/lib/auth/routes";
import { rolesUsuario } from "@/lib/validations/auth";

vi.mock("server-only", () => ({}));

const {
  redirectMock,
  getSessionMock,
  scopeMock,
  escalateMock,
  reportMock,
  revalidatePathMock,
  afterMock,
  authorizeResendMock,
  dispatchOneMock,
  dispatchManyMock,
  depsMock,
} = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  getSessionMock: vi.fn(),
  scopeMock: vi.fn(),
  escalateMock: vi.fn(),
  reportMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  afterMock: vi.fn(),
  authorizeResendMock: vi.fn(),
  dispatchOneMock: vi.fn(),
  dispatchManyMock: vi.fn(),
  depsMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("next/server", () => ({ after: afterMock }));
// The REAL dal runs on a mocked session source (RNF-01: the action re-checks).
vi.mock("@/lib/auth/cookies", () => ({ getSession: getSessionMock }));
vi.mock("@/lib/data/request-scope", () => ({ resolveRequestScope: scopeMock }));
vi.mock("@/lib/data/solicitud-escalation", () => ({
  escalateRequest: escalateMock,
  recordExcessReport: reportMock,
}));
vi.mock("@/lib/data/escalamiento", () => ({
  authorizeNoticeResend: authorizeResendMock,
}));
vi.mock("@/lib/data/escalation-dispatch", () => ({
  dispatchEscalationNotice: dispatchOneMock,
  dispatchEscalationNotices: dispatchManyMock,
}));
vi.mock("@/lib/escalation/deps", () => ({ getEscalationDeps: depsMock }));

import {
  escalateRequestAction,
  recordExcessReportAction,
  resendEscalationNoticeAction,
} from "@/app/(dashboard)/review/[id]/escalation-actions";

const SCOPE = { kind: "facultad", facultadId: 4 } as const;
const NOTE = "La firma del medico no coincide con el sello.";

const ESCALATE = { solicitudId: 12, nota: NOTE };
const DEPS = { mail: "mail", baseUrl: "https://justifia.example.edu" };
const NOT_FOUND = { ok: false, reason: "not_found" };
const REPORT = {
  solicitudId: 12,
  remisionId: 31,
  comunicadoEl: "2026-10-13",
  nota: "Supera el limite de faltas.",
};

beforeEach(() => {
  redirectMock.mockClear();
  revalidatePathMock.mockClear();
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue(sessionFor("secretaria"));
  scopeMock.mockReset();
  scopeMock.mockResolvedValue(SCOPE);
  escalateMock.mockReset();
  escalateMock.mockResolvedValue({ ok: true, escalamientoId: 5 });
  reportMock.mockReset();
  reportMock.mockResolvedValue({ ok: true, reporteId: 6, escalamientoId: 7 });
  afterMock.mockReset();
  authorizeResendMock.mockReset();
  authorizeResendMock.mockResolvedValue({
    id: 5,
    solicitudId: 12,
    estado: "pendiente",
  });
  dispatchOneMock.mockReset();
  dispatchOneMock.mockResolvedValue({ outcome: "sent" });
  dispatchManyMock.mockReset();
  dispatchManyMock.mockResolvedValue({});
  depsMock.mockReset();
  depsMock.mockReturnValue(DEPS);
});

const actions = [
  ["escalateRequestAction", escalateRequestAction, ESCALATE, escalateMock],
  ["recordExcessReportAction", recordExcessReportAction, REPORT, reportMock],
] as const;

describe.each(actions)(
  "%s authorisation (RNF-01)",
  (_n, action, input, write) => {
    it.each(rolesUsuario.filter((r) => r !== "secretaria"))(
      "sends %s to /denied before reading scope or writing",
      async (rol) => {
        getSessionMock.mockResolvedValue(sessionFor(rol));

        await expect(action(input)).rejects.toThrow(
          `REDIRECT:${ACCESS_DENIED_PATH}`,
        );

        expect(scopeMock).not.toHaveBeenCalled();
        expect(write).not.toHaveBeenCalled();
      },
    );

    it("sends an anonymous caller to /login", async () => {
      getSessionMock.mockResolvedValue(null);

      await expect(action(input)).rejects.toThrow("REDIRECT:/login");
      expect(write).not.toHaveBeenCalled();
    });

    it("answers not_found, and writes nothing, for a secretaria without a faculty", async () => {
      scopeMock.mockResolvedValue({ kind: "none" });

      await expect(action(input)).resolves.toEqual({
        ok: false,
        reason: "not_found",
      });
      expect(write).not.toHaveBeenCalled();
      expect(redirectMock).not.toHaveBeenCalled();
    });

    it.each([0, -3, 1.5, "12", null, undefined, Number.MAX_VALUE])(
      "answers not_found for the request id %j after re-checking the scope",
      async (solicitudId) => {
        await expect(action({ ...input, solicitudId })).resolves.toEqual({
          ok: false,
          reason: "not_found",
        });

        expect(scopeMock).toHaveBeenCalledWith(7, "secretaria");
        expect(write).not.toHaveBeenCalled();
      },
    );

    it.each([null, "text", 12, []])(
      "answers not_found for the malformed payload %j",
      async (payload) => {
        await expect(action(payload)).resolves.toEqual({
          ok: false,
          reason: "not_found",
        });
        expect(write).not.toHaveBeenCalled();
      },
    );

    it("never revalidates or refreshes the page (the audited read runs once)", async () => {
      await expect(action(input)).rejects.toThrow("REDIRECT:");

      expect(revalidatePathMock).not.toHaveBeenCalled();
    });

    it.each([
      ["not_found", { ok: false, reason: "not_found" }],
      ["conflict", { ok: false, reason: "conflict" }],
    ] as const)(
      "maps the data refusal %s without a redirect, so the dialog shows it",
      async (_label, outcome) => {
        write.mockResolvedValue(outcome);

        await expect(action(input)).resolves.toEqual(outcome);
        expect(redirectMock).not.toHaveBeenCalled();
      },
    );

    it("answers unexpected, logging the error name only, when the write throws", async () => {
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      write.mockRejectedValue(new TypeError("password=secret in message"));

      await expect(action(input)).resolves.toEqual({
        ok: false,
        reason: "unexpected",
      });

      expect(JSON.stringify(log.mock.calls)).toContain("TypeError");
      expect(JSON.stringify(log.mock.calls)).not.toContain("secret");
      log.mockRestore();
    });
  },
);

describe("escalateRequestAction (RF-10 a, RN-20, E17)", () => {
  it("takes the actor from the session and the scope from the database, and fixes the reason server-side", async () => {
    await expect(
      escalateRequestAction({
        ...ESCALATE,
        motivo: "exceso_inasistencias",
        actorId: 99,
        scope: { kind: "all" },
      }),
    ).rejects.toThrow("REDIRECT:");

    expect(escalateMock).toHaveBeenCalledWith({
      actorId: 7,
      scope: SCOPE,
      solicitudId: 12,
      nota: NOTE,
      now: expect.any(Date),
    });
    expect(Object.keys(escalateMock.mock.calls[0][0])).not.toContain("motivo");
  });

  it("goes back to the queue with the escalated banner on success", async () => {
    await expect(escalateRequestAction(ESCALATE)).rejects.toThrow(
      "REDIRECT:/review?resultado=escalada",
    );
  });

  it("hands the raw note to the data layer, which validates it before any write", async () => {
    escalateMock.mockResolvedValue({
      ok: false,
      reason: "invalid",
      errors: [{ field: "nota", code: "nota_required" }],
    });

    await expect(
      escalateRequestAction({ solicitudId: 12, nota: "   " }),
    ).resolves.toEqual({
      ok: false,
      reason: "invalid",
      errors: [{ field: "nota", code: "nota_required" }],
    });
    expect(escalateMock.mock.calls[0][0].nota).toBe("   ");
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("passes a missing note on so the validator refuses it", async () => {
    await expect(escalateRequestAction({ solicitudId: 12 })).rejects.toThrow(
      "REDIRECT:",
    );
    expect(escalateMock.mock.calls[0][0].nota).toBeUndefined();
  });

  it("maps a career without a coordination account to its i18n code with the career name", async () => {
    escalateMock.mockResolvedValue({
      ok: false,
      reason: "sin_coordinacion",
      carreraNombre: "Ingenieria Civil",
    });

    await expect(escalateRequestAction(ESCALATE)).resolves.toEqual({
      ok: false,
      reason: "sin_coordinacion",
      carreraNombre: "Ingenieria Civil",
    });
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe("recordExcessReportAction (RF-15, RF-10 b)", () => {
  it("takes the actor from the session and the scope from the database", async () => {
    await expect(
      recordExcessReportAction({ ...REPORT, actorId: 99, porcentaje: 40 }),
    ).rejects.toThrow("REDIRECT:");

    expect(reportMock).toHaveBeenCalledWith({
      actorId: 7,
      scope: SCOPE,
      solicitudId: 12,
      remisionId: 31,
      comunicadoEl: "2026-10-13",
      nota: "Supera el limite de faltas.",
      now: expect.any(Date),
    });
  });

  it("stays on the request detail on success", async () => {
    await expect(recordExcessReportAction(REPORT)).rejects.toThrow(
      "REDIRECT:/review/12",
    );
  });

  it.each([0, -1, 2.5, "31", null, undefined])(
    "refuses the remission id %j as an error on the teacher without a write",
    async (remisionId) => {
      await expect(
        recordExcessReportAction({ ...REPORT, remisionId }),
      ).resolves.toEqual({
        ok: false,
        reason: "invalid",
        errors: [{ field: "docente", code: "docente_invalid" }],
      });
      expect(reportMock).not.toHaveBeenCalled();
    },
  );

  it("passes the date and the optional note on for the data layer to validate", async () => {
    reportMock.mockResolvedValue({
      ok: false,
      reason: "invalid",
      errors: [{ field: "comunicadoEl", code: "date_future" }],
    });

    await expect(
      recordExcessReportAction({ ...REPORT, comunicadoEl: "2999-01-01" }),
    ).resolves.toEqual({
      ok: false,
      reason: "invalid",
      errors: [{ field: "comunicadoEl", code: "date_future" }],
    });
    expect(reportMock.mock.calls[0][0].comunicadoEl).toBe("2999-01-01");
  });
});

describe.each([
  ["escalateRequestAction", escalateRequestAction, ESCALATE, 5],
  ["recordExcessReportAction", recordExcessReportAction, REPORT, 7],
] as const)(
  "%s notice dispatch after commit (ES-11)",
  (_n, action, input, noticeId) => {
    it("schedules the notice dispatch once, before redirecting, and does not run it inline", async () => {
      await expect(action(input)).rejects.toThrow("REDIRECT:");

      expect(afterMock).toHaveBeenCalledTimes(1);
      expect(dispatchManyMock).not.toHaveBeenCalled();
    });

    it("dispatches the new notice after the response, as a creation attempt by the session user", async () => {
      await expect(action(input)).rejects.toThrow("REDIRECT:");
      await afterMock.mock.calls[0][0]();

      expect(dispatchManyMock).toHaveBeenCalledWith(
        [noticeId],
        { trigger: "escalamiento", actorId: 7 },
        DEPS,
      );
    });

    it.each([
      ["a refusal", { ok: false, reason: "conflict" }],
      ["a missing request", { ok: false, reason: "not_found" }],
      [
        "invalid input",
        {
          ok: false,
          reason: "invalid",
          errors: [{ field: "nota", code: "nota_required" }],
        },
      ],
      [
        "a career without coordination",
        {
          ok: false,
          reason: "sin_coordinacion",
          carreraNombre: "Ingenieria Civil",
        },
      ],
    ])("schedules nothing after %s", async (_label, outcome) => {
      escalateMock.mockResolvedValue(outcome);
      reportMock.mockResolvedValue(outcome);

      await action(input);

      expect(afterMock).not.toHaveBeenCalled();
    });

    it("schedules nothing when the caller has no scope", async () => {
      scopeMock.mockResolvedValue({ kind: "none" });

      await action(input);

      expect(afterMock).not.toHaveBeenCalled();
    });

    it("schedules nothing when the write throws", async () => {
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      escalateMock.mockRejectedValue(new Error("db down"));
      reportMock.mockRejectedValue(new Error("db down"));

      await action(input);

      expect(afterMock).not.toHaveBeenCalled();
      log.mockRestore();
    });

    it("keeps the committed write and still redirects when the dispatch cannot be scheduled", async () => {
      afterMock.mockImplementation(() => {
        throw new Error("outside a request scope");
      });
      const log = vi.spyOn(console, "error").mockImplementation(() => {});

      await expect(action(input)).rejects.toThrow("REDIRECT:");

      expect(log).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(log.mock.calls)).not.toContain("outside");
      log.mockRestore();
    });

    it("contains a failed dispatch: the write stands and only a code is logged", async () => {
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      dispatchManyMock.mockRejectedValue(new Error("coord1@uam.edu.ni leaked"));

      await expect(action(input)).rejects.toThrow("REDIRECT:");
      await afterMock.mock.calls[0][0]();

      expect(log).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(log.mock.calls)).not.toContain("coord1@uam.edu.ni");
      log.mockRestore();
    });
  },
);

describe("resendEscalationNoticeAction authorisation (RNF-01)", () => {
  it.each(rolesUsuario.filter((r) => r !== "secretaria"))(
    "sends %s to /denied before reading scope or sending",
    async (rol) => {
      getSessionMock.mockResolvedValue(sessionFor(rol));

      await expect(resendEscalationNoticeAction(5)).rejects.toThrow(
        `REDIRECT:${ACCESS_DENIED_PATH}`,
      );

      expect(scopeMock).not.toHaveBeenCalled();
      expect(dispatchOneMock).not.toHaveBeenCalled();
    },
  );

  it("sends an anonymous caller to /login", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(resendEscalationNoticeAction(5)).rejects.toThrow(
      "REDIRECT:/login",
    );
    expect(dispatchOneMock).not.toHaveBeenCalled();
  });

  it("answers not_found for a scope of none without looking the id up", async () => {
    scopeMock.mockResolvedValue({ kind: "none" });

    await expect(resendEscalationNoticeAction(5)).resolves.toEqual(NOT_FOUND);

    expect(authorizeResendMock).not.toHaveBeenCalled();
    expect(dispatchOneMock).not.toHaveBeenCalled();
  });

  it.each([0, -3, 1.5, "5", null, undefined, Number.MAX_VALUE])(
    "answers not_found for the malformed id %j after re-checking the scope",
    async (id) => {
      await expect(resendEscalationNoticeAction(id)).resolves.toEqual(
        NOT_FOUND,
      );

      expect(scopeMock).toHaveBeenCalledWith(7, "secretaria");
      expect(authorizeResendMock).not.toHaveBeenCalled();
    },
  );

  it("answers an unknown id and an out-of-scope id the same, and sends nothing", async () => {
    authorizeResendMock.mockResolvedValue(null);

    await expect(resendEscalationNoticeAction(5)).resolves.toEqual(NOT_FOUND);

    expect(authorizeResendMock).toHaveBeenCalledWith(SCOPE, 5, 7);
    expect(dispatchOneMock).not.toHaveBeenCalled();
  });
});

describe("resendEscalationNoticeAction (RF-10 b)", () => {
  it("sends nothing for a sent notice and reports it as sent", async () => {
    authorizeResendMock.mockResolvedValue({
      id: 5,
      solicitudId: 12,
      estado: "enviada",
    });

    await expect(resendEscalationNoticeAction(5)).resolves.toEqual({
      ok: true,
      estado: "enviada",
      motivo: null,
    });

    expect(dispatchOneMock).not.toHaveBeenCalled();
    expect(depsMock).not.toHaveBeenCalled();
  });

  it.each(["pendiente", "bloqueada"])(
    "dispatches a %s notice as a manual resend by the session user",
    async (estado) => {
      authorizeResendMock.mockResolvedValue({ id: 5, solicitudId: 12, estado });

      await expect(resendEscalationNoticeAction(5)).resolves.toEqual({
        ok: true,
        estado: "enviada",
        motivo: null,
      });

      expect(dispatchOneMock).toHaveBeenCalledWith(
        5,
        { trigger: "reenvio_manual", actorId: 7 },
        DEPS,
      );
    },
  );

  it.each([
    [{ outcome: "failed", codigo: "unavailable" }, "pendiente", "error_envio"],
    [
      { outcome: "blocked", motivo: "sin_destinatarios" },
      "bloqueada",
      "sin_destinatarios",
    ],
    [{ outcome: "skipped" }, "pendiente", null],
    [{ outcome: "lost" }, "pendiente", null],
  ])("reports %j as %s", async (result, estado, motivo) => {
    dispatchOneMock.mockResolvedValue(result);

    await expect(resendEscalationNoticeAction(5)).resolves.toEqual({
      ok: true,
      estado,
      motivo,
    });
  });

  it("never revalidates or redirects: the audited detail read runs once (SR-11)", async () => {
    await resendEscalationNoticeAction(5);

    expect(revalidatePathMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("answers unexpected, logging the error name only, when the dispatch throws", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    dispatchOneMock.mockRejectedValue(
      new TypeError("coord1@uam.edu.ni leaked"),
    );

    await expect(resendEscalationNoticeAction(5)).resolves.toEqual({
      ok: false,
      reason: "unexpected",
    });

    expect(JSON.stringify(log.mock.calls)).toContain("TypeError");
    expect(JSON.stringify(log.mock.calls)).not.toContain("coord1");
    log.mockRestore();
  });
});
