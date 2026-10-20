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
  dispatchManyMock,
  attachMock,
  afterMock,
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
  dispatchManyMock: vi.fn(),
  attachMock: vi.fn(),
  afterMock: vi.fn(),
  depsMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("next/server", () => ({ after: afterMock }));
// The REAL dal runs on a mocked session source (RNF-01: the action re-checks).
vi.mock("@/lib/auth/cookies", () => ({ getSession: getSessionMock }));
vi.mock("@/lib/data/request-scope", () => ({ resolveRequestScope: scopeMock }));
vi.mock("@/lib/data/remision", () => ({ authorizeResend: authorizeMock }));
vi.mock("@/lib/data/remission-dispatch", () => ({
  dispatchRemission: dispatchMock,
  dispatchRemissions: dispatchManyMock,
}));
vi.mock("@/lib/data/special-format", () => ({
  attachSpecialFormat: attachMock,
}));
vi.mock("@/lib/intake/deps", () => ({ getIntakeDeps: depsMock }));

import {
  attachSpecialFormatAction,
  resendRemissionAction,
} from "@/app/(dashboard)/review/[id]/remission-actions";

const SCOPE = { kind: "facultad", facultadId: 4 } as const;
const NOT_FOUND = { ok: false, reason: "not_found" };

const PATH = "intake/12/0b9f6c1e-4f0a-4d57-9a64-2f3f8f1d2c11.pdf";
const FILE = { pathname: PATH, nombreOriginal: "formato.pdf" };
const ATTACHED = {
  ok: true,
  documentId: 21,
  tipo: "pdf",
  tamanoBytes: 2048,
  dispatchIds: [5, 6],
};

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
  dispatchManyMock.mockReset();
  dispatchManyMock.mockResolvedValue({});
  attachMock.mockReset();
  attachMock.mockResolvedValue(ATTACHED);
  afterMock.mockReset();
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

describe("attachSpecialFormatAction authorisation (RNF-01)", () => {
  it.each(rolesUsuario.filter((r) => r !== "secretaria"))(
    "sends %s to /denied before reading scope or attaching",
    async (rol) => {
      getSessionMock.mockResolvedValue(sessionFor(rol));

      await expect(attachSpecialFormatAction(12, FILE)).rejects.toThrow(
        `REDIRECT:${ACCESS_DENIED_PATH}`,
      );

      expect(scopeMock).not.toHaveBeenCalled();
      expect(attachMock).not.toHaveBeenCalled();
    },
  );

  it("answers not_allowed for a scope of none without attaching", async () => {
    scopeMock.mockResolvedValue({ kind: "none" });

    await expect(attachSpecialFormatAction(12, FILE)).resolves.toEqual({
      ok: false,
      reason: "not_allowed",
    });

    expect(attachMock).not.toHaveBeenCalled();
  });

  it.each([
    [0, FILE],
    [1.5, FILE],
    ["12", FILE],
    [12, null],
    [12, { pathname: PATH }],
    [12, { pathname: 7, nombreOriginal: "a.pdf" }],
    [12, { pathname: "", nombreOriginal: "a.pdf" }],
  ])("answers not_allowed for malformed input %j %j", async (id, payload) => {
    await expect(attachSpecialFormatAction(id, payload)).resolves.toEqual({
      ok: false,
      reason: "not_allowed",
    });

    expect(attachMock).not.toHaveBeenCalled();
  });
});

describe("attachSpecialFormatAction (RN-19)", () => {
  it("attaches as the session user, in the caller's scope, with the store", async () => {
    await attachSpecialFormatAction(12, FILE);

    expect(attachMock).toHaveBeenCalledTimes(1);
    expect(attachMock).toHaveBeenCalledWith(
      {
        actorId: 7,
        scope: SCOPE,
        solicitudId: 12,
        pathname: PATH,
        nombreOriginal: "formato.pdf",
      },
      "store",
    );
  });

  it("returns the document and the remissions as pending, and dispatches them after the response", async () => {
    await expect(attachSpecialFormatAction(12, FILE)).resolves.toEqual({
      ok: true,
      documentId: 21,
      remisionIds: [5, 6],
    });

    expect(afterMock).toHaveBeenCalledTimes(1);
    expect(dispatchManyMock).not.toHaveBeenCalled();
    await afterMock.mock.calls[0][0]();
    expect(dispatchManyMock).toHaveBeenCalledWith(
      [5, 6],
      { trigger: "formato_especial", actorId: 7 },
      { store: "store", mail: "mail" },
    );
  });

  it("schedules nothing when no remission needs a dispatch", async () => {
    attachMock.mockResolvedValue({ ...ATTACHED, dispatchIds: [] });

    await expect(attachSpecialFormatAction(12, FILE)).resolves.toEqual({
      ok: true,
      documentId: 21,
      remisionIds: [],
    });

    expect(afterMock).not.toHaveBeenCalled();
  });

  it.each([
    "not_allowed",
    "not_found",
    "already_attached",
    "empty_file",
    "too_large",
    "unsupported_format",
  ])("maps the %s outcome through and schedules nothing", async (reason) => {
    attachMock.mockResolvedValue({ ok: false, reason });

    await expect(attachSpecialFormatAction(12, FILE)).resolves.toEqual({
      ok: false,
      reason,
    });

    expect(afterMock).not.toHaveBeenCalled();
  });

  it("never revalidates or redirects: the audited detail read runs once (SR-11)", async () => {
    await attachSpecialFormatAction(12, FILE);

    expect(revalidatePathMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("contains a failed dispatch: the attach stands and only a code is logged", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    dispatchManyMock.mockRejectedValue(new Error("ana@uam.edu.ni leaked"));

    await attachSpecialFormatAction(12, FILE);
    await afterMock.mock.calls[0][0]();

    expect(log).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(log.mock.calls)).not.toContain("ana@uam.edu.ni");
    log.mockRestore();
  });

  it("keeps the attach when the dispatch cannot be scheduled", async () => {
    afterMock.mockImplementation(() => {
      throw new Error("outside a request scope");
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(attachSpecialFormatAction(12, FILE)).resolves.toEqual({
      ok: true,
      documentId: 21,
      remisionIds: [5, 6],
    });

    expect(log).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });

  it("answers unexpected, without the cause, when the attach throws", async () => {
    attachMock.mockRejectedValue(new Error("db down for ana@uam.edu.ni"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(attachSpecialFormatAction(12, FILE)).resolves.toEqual({
      ok: false,
      reason: "unexpected",
    });

    expect(JSON.stringify(log.mock.calls)).not.toContain("ana@uam.edu.ni");
    expect(afterMock).not.toHaveBeenCalled();
    log.mockRestore();
  });
});
