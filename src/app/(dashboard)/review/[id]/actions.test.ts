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
  afterMock,
  dispatchMock,
  depsMock,
} = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  getSessionMock: vi.fn(),
  scopeMock: vi.fn(),
  decideMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  afterMock: vi.fn(),
  dispatchMock: vi.fn(),
  depsMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("next/server", () => ({ after: afterMock }));
vi.mock("@/lib/data/remission-dispatch", () => ({
  dispatchRemissions: dispatchMock,
}));
vi.mock("@/lib/intake/deps", () => ({ getIntakeDeps: depsMock }));
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
  decideMock.mockResolvedValue({
    ok: true,
    remisionIds: [],
    formatoEspecial: false,
  });
  afterMock.mockReset();
  dispatchMock.mockReset();
  dispatchMock.mockResolvedValue({});
  depsMock.mockReset();
  depsMock.mockReturnValue({ store: "store", mail: "mail" });
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

  it.each([
    ["approve", APPROVE],
    ["reject", REJECT],
    ["return", RETURN],
  ])(
    "denies a coordinacion the %s decision: the coordinator never decides (RNF-01)",
    async (_name, payload) => {
      getSessionMock.mockResolvedValue(sessionFor("coordinacion"));

      await expect(decideAction(payload)).rejects.toThrow(
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

describe("decideAction remission dispatch after approval (RF-09 a, RNF-07, TR-8)", () => {
  const created = { ok: true, remisionIds: [31, 32], formatoEspecial: false };

  beforeEach(() => {
    decideMock.mockResolvedValue(created);
  });

  it("schedules the dispatch once, after the approval commits", async () => {
    await expect(decideAction(APPROVE)).rejects.toThrow(
      "REDIRECT:/review?resultado=aprobada",
    );

    expect(afterMock).toHaveBeenCalledTimes(1);
    expect(dispatchMock).not.toHaveBeenCalled();

    await afterMock.mock.calls[0][0]();

    expect(dispatchMock).toHaveBeenCalledTimes(1);
    expect(dispatchMock).toHaveBeenCalledWith(
      [31, 32],
      { trigger: "aprobacion", actorId: 7 },
      { store: "store", mail: "mail" },
    );
  });

  it("captures the actor before after() and never reads the session inside it", async () => {
    await expect(decideAction(APPROVE)).rejects.toThrow("REDIRECT:");
    const readsBefore = getSessionMock.mock.calls.length;

    await afterMock.mock.calls[0][0]();

    expect(getSessionMock.mock.calls.length).toBe(readsBefore);
    expect(dispatchMock.mock.calls[0][1].actorId).toBe(7);
  });

  it("builds the dispatch dependencies inside the callback, after the response", async () => {
    await expect(decideAction(APPROVE)).rejects.toThrow("REDIRECT:");
    expect(depsMock).not.toHaveBeenCalled();

    await afterMock.mock.calls[0][0]();

    expect(depsMock).toHaveBeenCalledTimes(1);
  });

  it("sends a marked approval to that request's detail, an unmarked one to the queue", async () => {
    decideMock.mockResolvedValue({ ...created, formatoEspecial: true });
    await expect(decideAction(APPROVE)).rejects.toThrow("REDIRECT:/review/12");

    decideMock.mockResolvedValue(created);
    await expect(decideAction(APPROVE)).rejects.toThrow(
      "REDIRECT:/review?resultado=aprobada",
    );
  });

  it("schedules nothing for a marked approval: every row is born blocked until the format is uploaded", async () => {
    decideMock.mockResolvedValue({ ...created, formatoEspecial: true });

    await expect(decideAction(APPROVE)).rejects.toThrow("REDIRECT:/review/12");

    expect(afterMock).not.toHaveBeenCalled();
  });

  it("schedules nothing when the approval created no remission", async () => {
    decideMock.mockResolvedValue({
      ok: true,
      remisionIds: [],
      formatoEspecial: false,
    });

    await expect(decideAction(APPROVE)).rejects.toThrow("REDIRECT:");

    expect(afterMock).not.toHaveBeenCalled();
  });

  it.each([
    ["rejection", REJECT],
    ["return", RETURN],
  ])("schedules nothing for a %s", async (_name, input) => {
    decideMock.mockResolvedValue({
      ok: true,
      remisionIds: [],
      formatoEspecial: false,
    });

    await expect(decideAction(input)).rejects.toThrow("REDIRECT:");

    expect(afterMock).not.toHaveBeenCalled();
  });

  it.each(["conflict", "not_found", "invalid"] as const)(
    "schedules nothing when the decision is %s",
    async (reason) => {
      decideMock.mockResolvedValue({ ok: false, reason });

      await decideAction(APPROVE);

      expect(afterMock).not.toHaveBeenCalled();
      expect(redirectMock).not.toHaveBeenCalled();
    },
  );

  it("schedules nothing for an invalid schedule request (validation refused it)", async () => {
    await decideAction({ ...REJECT, texto: "" });

    expect(afterMock).not.toHaveBeenCalled();
  });

  describe("a mail failure never changes the outcome", () => {
    it("redirects as usual when the dispatch rejects inside after()", async () => {
      dispatchMock.mockRejectedValue(new Error("mail down for ana@uam.edu.ni"));
      const log = vi.spyOn(console, "error").mockImplementation(() => {});

      await expect(decideAction(APPROVE)).rejects.toThrow(
        "REDIRECT:/review?resultado=aprobada",
      );
      await expect(afterMock.mock.calls[0][0]()).resolves.toBeUndefined();

      expect(JSON.stringify(log.mock.calls)).not.toContain("@");
      log.mockRestore();
    });

    it("keeps the callback quiet when the dependencies cannot be built", async () => {
      depsMock.mockImplementation(() => {
        throw new Error("BLOB_READ_WRITE_TOKEN is not configured.");
      });
      const log = vi.spyOn(console, "error").mockImplementation(() => {});

      await expect(decideAction(APPROVE)).rejects.toThrow("REDIRECT:");
      await expect(afterMock.mock.calls[0][0]()).resolves.toBeUndefined();

      expect(dispatchMock).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalledTimes(1);
      log.mockRestore();
    });

    it("redirects even when after() itself cannot schedule", async () => {
      afterMock.mockImplementation(() => {
        throw new Error("outside a request scope");
      });
      const log = vi.spyOn(console, "error").mockImplementation(() => {});

      await expect(decideAction(APPROVE)).rejects.toThrow(
        "REDIRECT:/review?resultado=aprobada",
      );
      log.mockRestore();
    });
  });
});

describe("decideAction special-format mark (RN-19)", () => {
  it("passes the mark of an approval to the decision", async () => {
    await expect(
      decideAction({ ...APPROVE, formatoEspecial: true }),
    ).rejects.toThrow("REDIRECT:");

    expect(decideMock).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: expect.objectContaining({
          tipo: "aprobada",
          formatoEspecial: true,
        }),
      }),
    );
  });

  it("leaves the mark out of an approval that did not send it", async () => {
    await expect(decideAction(APPROVE)).rejects.toThrow("REDIRECT:");
    await expect(
      decideAction({ ...APPROVE, formatoEspecial: false }),
    ).rejects.toThrow("REDIRECT:");

    for (const [call] of decideMock.mock.calls) {
      expect(call.decision).not.toHaveProperty("formatoEspecial");
    }
    expect(decideMock).toHaveBeenCalledTimes(2);
  });

  it.each([REJECT, RETURN])(
    "refuses the mark on a $tipo before deciding",
    async (payload) => {
      await expect(
        decideAction({ ...payload, formatoEspecial: true }),
      ).resolves.toEqual({
        ok: false,
        reason: "invalid",
        errors: [
          { field: "formatoEspecial", code: "special_format_not_allowed" },
        ],
      });

      expect(decideMock).not.toHaveBeenCalled();
    },
  );

  it("treats a mark that is not a boolean as a malformed payload", async () => {
    await expect(
      decideAction({ ...APPROVE, formatoEspecial: "yes" }),
    ).resolves.toEqual({
      ok: false,
      reason: "invalid",
      errors: [{ field: "tipo", code: "tipo_invalid" }],
    });

    expect(decideMock).not.toHaveBeenCalled();
  });
});
