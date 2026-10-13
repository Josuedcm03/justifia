import { beforeEach, describe, expect, it, vi } from "vitest";

import { sessionFor } from "@/app/(dashboard)/review/test-support";
import { ACCESS_DENIED_PATH } from "@/lib/auth/routes";
import { rolesUsuario } from "@/lib/validations/auth";

vi.mock("server-only", () => ({}));

const {
  redirectMock,
  getSessionMock,
  scopeMock,
  decideMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  getSessionMock: vi.fn(),
  scopeMock: vi.fn(),
  decideMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
// The REAL dal runs on a mocked session source (RNF-01: the action re-checks).
vi.mock("@/lib/auth/cookies", () => ({ getSession: getSessionMock }));
vi.mock("@/lib/data/request-scope", () => ({ resolveRequestScope: scopeMock }));
vi.mock("@/lib/data/solicitud-decision", () => ({ decideRequest: decideMock }));

import { decideAction } from "@/app/(dashboard)/review/[id]/actions";

const SCOPE = { kind: "facultad", facultadId: 4 } as const;

const APPROVE = {
  solicitudId: 12,
  tipo: "aprobada",
  plantilla: "aprobacion.general",
  motivo: null,
  texto: "  Aprobada.  ",
};
const REJECT = {
  solicitudId: 12,
  tipo: "rechazada",
  plantilla: "rechazo.general",
  motivo: null,
  texto: "El documento no corresponde a las fechas.",
};
const RETURN = {
  solicitudId: 12,
  tipo: "devuelta",
  plantilla: "devolucion.documento_ilegible",
  motivo: "documento_ilegible",
  texto: "Adjunte una copia legible.",
};

beforeEach(() => {
  redirectMock.mockClear();
  revalidatePathMock.mockClear();
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue(sessionFor("secretaria"));
  scopeMock.mockReset();
  scopeMock.mockResolvedValue(SCOPE);
  decideMock.mockReset();
  decideMock.mockResolvedValue({ ok: true });
});

describe("decideAction authorisation (RNF-01, RN-15)", () => {
  it.each(rolesUsuario.filter((r) => r !== "secretaria"))(
    "sends %s to /denied before reading scope or deciding",
    async (rol) => {
      getSessionMock.mockResolvedValue(sessionFor(rol));

      await expect(decideAction(APPROVE)).rejects.toThrow(
        `REDIRECT:${ACCESS_DENIED_PATH}`,
      );

      expect(scopeMock).not.toHaveBeenCalled();
      expect(decideMock).not.toHaveBeenCalled();
    },
  );

  it("sends an anonymous caller to /login", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(decideAction(APPROVE)).rejects.toThrow("REDIRECT:/login");
    expect(decideMock).not.toHaveBeenCalled();
  });

  it("answers not_found, and decides nothing, for a secretaria without a faculty", async () => {
    scopeMock.mockResolvedValue({ kind: "none" });

    await expect(decideAction(APPROVE)).resolves.toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(decideMock).not.toHaveBeenCalled();
  });

  it("takes the actor from the session and the scope from the database, never from the payload", async () => {
    await expect(
      decideAction({ ...APPROVE, actorId: 99, scope: { kind: "all" } }),
    ).rejects.toThrow("REDIRECT:");

    expect(scopeMock).toHaveBeenCalledWith(7, "secretaria");
    expect(decideMock).toHaveBeenCalledWith({
      actorId: 7,
      scope: SCOPE,
      solicitudId: 12,
      decision: {
        tipo: "aprobada",
        plantilla: "aprobacion.general",
        texto: "Aprobada.",
      },
      now: expect.any(Date),
    });
  });
});

describe("decideAction validation (RF-07, RN-17, RNF-12: client bypass)", () => {
  it("refuses a direct reject call with empty text and decides nothing", async () => {
    await expect(decideAction({ ...REJECT, texto: "" })).resolves.toEqual({
      ok: false,
      reason: "invalid",
      errors: [{ field: "texto", code: "text_required" }],
    });
    expect(decideMock).not.toHaveBeenCalled();
  });

  it("refuses whitespace-only reject text", async () => {
    const result = await decideAction({ ...REJECT, texto: "   \n " });

    expect(result).toMatchObject({ ok: false, reason: "invalid" });
    expect(decideMock).not.toHaveBeenCalled();
  });

  it("refuses 1001 characters and accepts 1000", async () => {
    await expect(
      decideAction({ ...REJECT, texto: "a".repeat(1001) }),
    ).resolves.toEqual({
      ok: false,
      reason: "invalid",
      errors: [{ field: "texto", code: "text_too_long" }],
    });
    expect(decideMock).not.toHaveBeenCalled();

    await expect(
      decideAction({ ...REJECT, texto: "a".repeat(1000) }),
    ).rejects.toThrow("REDIRECT:");
    expect(decideMock).toHaveBeenCalledTimes(1);
  });

  it("refuses an unresolved template marker in reject text", async () => {
    await expect(
      decideAction({
        ...REJECT,
        texto: "Por el siguiente motivo: [indique el motivo].",
      }),
    ).resolves.toEqual({
      ok: false,
      reason: "invalid",
      errors: [{ field: "texto", code: "text_placeholder" }],
    });
  });

  it.each([
    [null, "motivo_required"],
    ["", "motivo_required"],
    ["otro_motivo", "motivo_invalid"],
  ])("refuses a return with reason %j (%s)", async (motivo, code) => {
    const result = await decideAction({ ...RETURN, motivo });

    expect(result).toMatchObject({
      ok: false,
      reason: "invalid",
      errors: expect.arrayContaining([{ field: "motivo", code }]),
    });
    expect(decideMock).not.toHaveBeenCalled();
  });

  it("refuses a template of another kind", async () => {
    await expect(
      decideAction({ ...REJECT, plantilla: "aprobacion.general" }),
    ).resolves.toMatchObject({ ok: false, reason: "invalid" });
    expect(decideMock).not.toHaveBeenCalled();
  });

  it.each([null, "x", { solicitudId: "12" }, [], { ...APPROVE, texto: 5 }])(
    "refuses a malformed payload %j without deciding",
    async (payload) => {
      const result = await decideAction(payload);

      expect(result).toMatchObject({ ok: false });
      expect(decideMock).not.toHaveBeenCalled();
    },
  );

  it.each([0, -3, 1.5, "12"])(
    "treats the request id %j as not found",
    async (id) => {
      await expect(
        decideAction({ ...APPROVE, solicitudId: id }),
      ).resolves.toEqual({ ok: false, reason: "not_found" });
      expect(decideMock).not.toHaveBeenCalled();
    },
  );
});

describe("decideAction outcome (SR-7, SR-11: redirect, never re-render the detail)", () => {
  it.each([
    [APPROVE, "aprobada"],
    [REJECT, "rechazada"],
    [RETURN, "devuelta"],
  ])("redirects to the queue with a status for %#", async (input, tipo) => {
    await expect(decideAction(input)).rejects.toThrow(
      `REDIRECT:/review?resultado=${tipo}`,
    );
    expect(decideMock).toHaveBeenCalledTimes(1);
    expect(decideMock.mock.calls[0][0].decision).toMatchObject({ tipo });
  });

  it("passes the return reason and the trimmed text of a return", async () => {
    await expect(decideAction(RETURN)).rejects.toThrow("REDIRECT:");

    expect(decideMock.mock.calls[0][0].decision).toEqual({
      tipo: "devuelta",
      plantilla: "devolucion.documento_ilegible",
      motivo: "documento_ilegible",
      texto: "Adjunte una copia legible.",
    });
  });

  it.each(["conflict", "not_found"] as const)(
    "returns %s to the dialog without redirecting",
    async (reason) => {
      decideMock.mockResolvedValue({ ok: false, reason });

      await expect(decideAction(APPROVE)).resolves.toEqual({
        ok: false,
        reason,
      });
      expect(redirectMock).not.toHaveBeenCalled();
    },
  );

  it("never revalidates a path (the detail must not re-render)", async () => {
    await expect(decideAction(APPROVE)).rejects.toThrow("REDIRECT:");
    decideMock.mockResolvedValue({ ok: false, reason: "conflict" });
    await decideAction(APPROVE);

    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
