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
} = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  getSessionMock: vi.fn(),
  scopeMock: vi.fn(),
  escalateMock: vi.fn(),
  reportMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
// The REAL dal runs on a mocked session source (RNF-01: the action re-checks).
vi.mock("@/lib/auth/cookies", () => ({ getSession: getSessionMock }));
vi.mock("@/lib/data/request-scope", () => ({ resolveRequestScope: scopeMock }));
vi.mock("@/lib/data/solicitud-escalation", () => ({
  escalateRequest: escalateMock,
  recordExcessReport: reportMock,
}));

import {
  escalateRequestAction,
  recordExcessReportAction,
} from "@/app/(dashboard)/review/[id]/escalation-actions";

const SCOPE = { kind: "facultad", facultadId: 4 } as const;
const NOTE = "La firma del medico no coincide con el sello.";

const ESCALATE = { solicitudId: 12, nota: NOTE };
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
