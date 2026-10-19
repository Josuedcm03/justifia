import { beforeEach, describe, expect, it, vi } from "vitest";

import { sessionFor } from "@/app/(dashboard)/review/test-support";
import { ACCESS_DENIED_PATH } from "@/lib/auth/routes";
import { rolesUsuario } from "@/lib/validations/auth";

vi.mock("server-only", () => ({}));

const {
  redirectMock,
  revalidatePathMock,
  getSessionMock,
  scopeMock,
  authorizeMock,
  dispatchMock,
  depsMock,
} = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  revalidatePathMock: vi.fn(),
  getSessionMock: vi.fn(),
  scopeMock: vi.fn(),
  authorizeMock: vi.fn(),
  dispatchMock: vi.fn(),
  depsMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
// The REAL dal runs on a mocked session source (RNF-01: the action re-checks).
vi.mock("@/lib/auth/cookies", () => ({ getSession: getSessionMock }));
vi.mock("@/lib/data/request-scope", () => ({ resolveRequestScope: scopeMock }));
vi.mock("@/lib/data/remision", () => ({ authorizeResend: authorizeMock }));
vi.mock("@/lib/data/remission-dispatch", () => ({
  dispatchRemission: dispatchMock,
}));
vi.mock("@/lib/intake/deps", () => ({ getIntakeDeps: depsMock }));

import { resendRemissionAction } from "@/app/(dashboard)/review/[id]/remission-actions";

const SCOPE = { kind: "facultad", facultadId: 4 } as const;
const NOT_FOUND = { ok: false, reason: "not_found" };

function target(estado: string) {
  return { id: 31, solicitudId: 12, estado };
}

beforeEach(() => {
  redirectMock.mockClear();
  revalidatePathMock.mockClear();
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue(sessionFor("secretaria"));
  scopeMock.mockReset();
  scopeMock.mockResolvedValue(SCOPE);
  authorizeMock.mockReset();
  authorizeMock.mockResolvedValue(target("pendiente"));
  dispatchMock.mockReset();
  dispatchMock.mockResolvedValue({ outcome: "sent" });
  depsMock.mockReset();
  depsMock.mockReturnValue({ store: "store", mail: "mail" });
});

describe("resendRemissionAction authorisation (RNF-01)", () => {
  it.each(rolesUsuario.filter((r) => r !== "secretaria"))(
    "sends %s to /denied before reading scope or sending",
    async (rol) => {
      getSessionMock.mockResolvedValue(sessionFor(rol));

      await expect(resendRemissionAction(31)).rejects.toThrow(
        `REDIRECT:${ACCESS_DENIED_PATH}`,
      );

      expect(scopeMock).not.toHaveBeenCalled();
      expect(dispatchMock).not.toHaveBeenCalled();
    },
  );

  it("answers not_found for a scope of none without looking the id up", async () => {
    scopeMock.mockResolvedValue({ kind: "none" });

    await expect(resendRemissionAction(31)).resolves.toEqual(NOT_FOUND);

    expect(authorizeMock).not.toHaveBeenCalled();
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it.each([0, -3, 1.5, "31", null, undefined])(
    "answers not_found for the malformed id %s",
    async (id) => {
      await expect(resendRemissionAction(id)).resolves.toEqual(NOT_FOUND);

      expect(authorizeMock).not.toHaveBeenCalled();
    },
  );

  it("answers an unknown or out-of-scope id with the same denial and sends nothing", async () => {
    authorizeMock.mockResolvedValue(null);

    await expect(resendRemissionAction(31)).resolves.toEqual(NOT_FOUND);

    expect(authorizeMock).toHaveBeenCalledWith(SCOPE, 31, 7);
    expect(dispatchMock).not.toHaveBeenCalled();
  });
});

describe("resendRemissionAction (RF-09 c)", () => {
  it("reports an already sent remission and sends nothing", async () => {
    authorizeMock.mockResolvedValue(target("enviada"));

    await expect(resendRemissionAction(31)).resolves.toEqual({
      ok: true,
      estado: "enviada",
      motivo: null,
    });

    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["pendiente", { outcome: "sent" }, "enviada", null],
    ["bloqueada", { outcome: "sent" }, "enviada", null],
    [
      "pendiente",
      { outcome: "failed", codigo: "unavailable" },
      "pendiente",
      "error_envio",
    ],
    [
      "bloqueada",
      { outcome: "blocked", motivo: "sin_correo" },
      "bloqueada",
      "sin_correo",
    ],
    ["pendiente", { outcome: "skipped" }, "pendiente", null],
    ["pendiente", { outcome: "lost" }, "pendiente", null],
  ])(
    "dispatches a %s remission by manual resend and maps %j to %s",
    async (estado, outcome, expectedEstado, expectedMotivo) => {
      authorizeMock.mockResolvedValue(target(estado));
      dispatchMock.mockResolvedValue(outcome);

      await expect(resendRemissionAction(31)).resolves.toEqual({
        ok: true,
        estado: expectedEstado,
        motivo: expectedMotivo,
      });

      expect(dispatchMock).toHaveBeenCalledTimes(1);
      expect(dispatchMock).toHaveBeenCalledWith(
        31,
        { trigger: "reenvio_manual", actorId: 7 },
        { store: "store", mail: "mail" },
      );
    },
  );

  it("never revalidates or redirects: the audited detail read runs once (SR-11)", async () => {
    await resendRemissionAction(31);

    expect(revalidatePathMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("answers unexpected, without the cause, when the dispatch throws", async () => {
    dispatchMock.mockRejectedValue(new Error("ana@uam.edu.ni leaked"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(resendRemissionAction(31)).resolves.toEqual({
      ok: false,
      reason: "unexpected",
    });

    expect(JSON.stringify(log.mock.calls)).not.toContain("ana@uam.edu.ni");
    log.mockRestore();
  });
});
