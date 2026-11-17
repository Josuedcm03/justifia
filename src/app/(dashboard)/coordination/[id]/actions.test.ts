import { beforeEach, describe, expect, it, vi } from "vitest";

import { sessionFor } from "@/app/(dashboard)/review/test-support";
import { calendar } from "@/lib/intake/calendar";
import { ACCESS_DENIED_PATH } from "@/lib/auth/routes";
import { rolesUsuario } from "@/lib/validations/auth";

vi.mock("server-only", () => ({}));

const {
  redirectMock,
  getSessionMock,
  scopeMock,
  answerMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  getSessionMock: vi.fn(),
  scopeMock: vi.fn(),
  answerMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
// The REAL dal runs on a mocked session source (RNF-01: the action re-checks).
vi.mock("@/lib/auth/cookies", () => ({ getSession: getSessionMock }));
vi.mock("@/lib/data/coordination-scope", () => ({
  resolveCoordinationScope: scopeMock,
}));
vi.mock("@/lib/data/escalation-answer", () => ({
  answerEscalation: answerMock,
}));

import { answerEscalationAction } from "@/app/(dashboard)/coordination/[id]/actions";

const SCOPE = { kind: "carrera", carreraId: 4 } as const;
const ANSWER = "Los documentos son consistentes con la causa declarada.";
const INPUT = { escalamientoId: 9, texto: ANSWER };
const NOT_FOUND = { ok: false, reason: "not_found" };

beforeEach(() => {
  redirectMock.mockClear();
  revalidatePathMock.mockClear();
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue(sessionFor("coordinacion"));
  scopeMock.mockReset();
  scopeMock.mockResolvedValue(SCOPE);
  answerMock.mockReset();
  answerMock.mockResolvedValue({ ok: true, solicitudId: 41 });
});

describe("answerEscalationAction authorisation (RNF-01, ES-9)", () => {
  it.each(rolesUsuario.filter((r) => r !== "coordinacion"))(
    "sends %s to /denied before reading scope or writing",
    async (rol) => {
      getSessionMock.mockResolvedValue(sessionFor(rol));

      await expect(answerEscalationAction(INPUT)).rejects.toThrow(
        `REDIRECT:${ACCESS_DENIED_PATH}`,
      );

      expect(scopeMock).not.toHaveBeenCalled();
      expect(answerMock).not.toHaveBeenCalled();
    },
  );

  it("sends an anonymous caller to /login", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(answerEscalationAction(INPUT)).rejects.toThrow(
      "REDIRECT:/login",
    );
    expect(answerMock).not.toHaveBeenCalled();
  });

  it("sends a session that must still change the password to the change screen", async () => {
    getSessionMock.mockResolvedValue(sessionFor("coordinacion", true));

    await expect(answerEscalationAction(INPUT)).rejects.toThrow(
      "REDIRECT:/change-password",
    );
    expect(answerMock).not.toHaveBeenCalled();
  });

  it("answers the nonexistent-id outcome, writing nothing, for a coordinacion without a career", async () => {
    scopeMock.mockResolvedValue({ kind: "none" });

    await expect(answerEscalationAction(INPUT)).resolves.toEqual(NOT_FOUND);
    expect(answerMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("re-checks the career of the session user on every call", async () => {
    await expect(answerEscalationAction(INPUT)).rejects.toThrow("REDIRECT:");

    expect(scopeMock).toHaveBeenCalledWith(7, "coordinacion");
  });

  it.each([0, -3, 1.5, "9", null, undefined, Number.MAX_VALUE])(
    "answers not_found for the escalation id %j after re-checking the scope",
    async (escalamientoId) => {
      await expect(
        answerEscalationAction({ ...INPUT, escalamientoId }),
      ).resolves.toEqual(NOT_FOUND);

      expect(scopeMock).toHaveBeenCalledTimes(1);
      expect(answerMock).not.toHaveBeenCalled();
    },
  );

  it.each([null, "text", 9, []])(
    "answers not_found for the malformed payload %j",
    async (payload) => {
      await expect(answerEscalationAction(payload)).resolves.toEqual(NOT_FOUND);
      expect(answerMock).not.toHaveBeenCalled();
    },
  );
});

describe("answerEscalationAction (RF-10, E1, E3)", () => {
  it("takes the actor from the session and the scope from the database, never from the payload", async () => {
    await expect(
      answerEscalationAction({
        ...INPUT,
        actorId: 99,
        scope: { kind: "carrera", carreraId: 77 },
        solicitudId: 5,
      }),
    ).rejects.toThrow("REDIRECT:");

    expect(answerMock).toHaveBeenCalledWith({
      actorId: 7,
      scope: SCOPE,
      escalamientoId: 9,
      respuesta: ANSWER,
      now: expect.any(Date),
      calendar,
    });
  });

  it("hands the raw text to the data layer, which validates it before any write", async () => {
    answerMock.mockResolvedValue({
      ok: false,
      reason: "invalid",
      errors: [{ field: "texto", code: "texto_required" }],
    });

    await expect(
      answerEscalationAction({ escalamientoId: 9, texto: "   " }),
    ).resolves.toEqual({
      ok: false,
      reason: "invalid",
      errors: [{ field: "texto", code: "texto_required" }],
    });
    expect(answerMock.mock.calls[0][0].respuesta).toBe("   ");
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("goes back to the list with the answered banner on success", async () => {
    await expect(answerEscalationAction(INPUT)).rejects.toThrow(
      "REDIRECT:/coordination?resultado=respondida",
    );
  });

  it("never revalidates or refreshes a page (the audited read runs once)", async () => {
    await expect(answerEscalationAction(INPUT)).rejects.toThrow("REDIRECT:");

    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it.each([
    ["not_found", { ok: false, reason: "not_found" }],
    ["conflict", { ok: false, reason: "conflict" }],
  ] as const)(
    "maps the data refusal %s without a redirect, so the form shows it",
    async (_label, outcome) => {
      answerMock.mockResolvedValue(outcome);

      await expect(answerEscalationAction(INPUT)).resolves.toEqual(outcome);
      expect(redirectMock).not.toHaveBeenCalled();
    },
  );

  it("answers unexpected, logging the error name only, when the write throws", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    answerMock.mockRejectedValue(new TypeError("password=secret in message"));

    await expect(answerEscalationAction(INPUT)).resolves.toEqual({
      ok: false,
      reason: "unexpected",
    });

    expect(JSON.stringify(log.mock.calls)).toContain("TypeError");
    expect(JSON.stringify(log.mock.calls)).not.toContain("secret");
    log.mockRestore();
  });
});
