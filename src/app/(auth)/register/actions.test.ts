import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  setSessionCookie: vi.fn(),
  hashPassword: vi.fn(async () => "hashed"),
  signSession: vi.fn(async () => "signed-token"),
  listCarreras: vi.fn(),
  createUsuario: vi.fn(),
  // Forbidden spies: registration runs no guard and never reads the session.
  getSession: vi.fn(),
  requireUser: vi.fn(),
  requireRole: vi.fn(),
  requireUserAllowingPasswordChange: vi.fn(),
  // The parsed env; each test sets the REGISTRATION_OPEN switch.
  env: { REGISTRATION_OPEN: true },
}));

vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth/cookies", () => ({
  setSessionCookie: mocks.setSessionCookie,
  getSession: mocks.getSession,
}));
vi.mock("@/lib/auth/password", () => ({ hashPassword: mocks.hashPassword }));
vi.mock("@/lib/auth/session", () => ({ signSession: mocks.signSession }));
vi.mock("@/lib/data/carreras", () => ({ listCarreras: mocks.listCarreras }));
vi.mock("@/lib/data/users", () => ({ createUsuario: mocks.createUsuario }));
vi.mock("@/env", () => ({ env: mocks.env }));
vi.mock("@/lib/auth/dal", () => ({
  requireUser: mocks.requireUser,
  requireRole: mocks.requireRole,
  requireUserAllowingPasswordChange: mocks.requireUserAllowingPasswordChange,
}));

import { registerAction } from "@/app/(auth)/register/actions";

function form(overrides: Record<string, string> = {}) {
  const f = new FormData();
  const fields = {
    login: "nueva.cuenta",
    password: "long-enough-pass",
    confirmPassword: "long-enough-pass",
    nombreCompleto: "Nueva Cuenta",
    correo: "nueva@example.test",
    telefono: "",
    cif: "9999-NOT-VERIFIED",
    carreraId: "2",
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) f.set(key, value);
  return f;
}

function submit(overrides: Record<string, string> = {}) {
  return registerAction({ error: null }, form(overrides));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.env.REGISTRATION_OPEN = true;
  mocks.listCarreras.mockResolvedValue([
    { id: 1, nombre: "Ingenieria" },
    { id: 2, nombre: "Derecho" },
  ]);
  mocks.createUsuario.mockResolvedValue({ id: 41 });
});

describe("registerAction with registration closed (REGISTRATION_OPEN)", () => {
  beforeEach(() => {
    mocks.env.REGISTRATION_OPEN = false;
  });

  it("refuses a complete, valid form and creates nothing", async () => {
    await expect(submit()).resolves.toEqual({ error: "errors.closed" });

    expect(mocks.createUsuario).not.toHaveBeenCalled();
    expect(mocks.hashPassword).not.toHaveBeenCalled();
    expect(mocks.signSession).not.toHaveBeenCalled();
    expect(mocks.setSessionCookie).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("refuses before reading the form or the database", async () => {
    const posted = form();
    const read = vi.spyOn(posted, "get");

    await expect(registerAction({ error: null }, posted)).resolves.toEqual({
      error: "errors.closed",
    });

    expect(read).not.toHaveBeenCalled();
    expect(mocks.listCarreras).not.toHaveBeenCalled();
    expect(mocks.createUsuario).not.toHaveBeenCalled();
  });
});

// Characterization pins (AEA-4): what `registerAction` does while the switch
// is open, unchanged by REGISTRATION_OPEN (the default setup opens it).
describe("registerAction pins with registration open (AEA-4)", () => {
  it("creates an estudiante even when the form posts rol=administrador", async () => {
    await expect(submit({ rol: "administrador" })).rejects.toThrow(
      "REDIRECT:/",
    );

    expect(mocks.createUsuario).toHaveBeenCalledTimes(1);
    expect(mocks.createUsuario).toHaveBeenCalledWith(
      expect.objectContaining({ login: "nueva.cuenta", rol: "estudiante" }),
    );
    expect(mocks.signSession).toHaveBeenCalledWith(
      expect.objectContaining({ sub: "41", rol: "estudiante" }),
    );
    expect(mocks.setSessionCookie).toHaveBeenCalledWith("signed-token");
  });

  it("runs no guard and never reads the session", async () => {
    await expect(submit()).rejects.toThrow("REDIRECT:/");

    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(mocks.requireUser).not.toHaveBeenCalled();
    expect(mocks.requireRole).not.toHaveBeenCalled();
    expect(mocks.requireUserAllowingPasswordChange).not.toHaveBeenCalled();
  });

  it("stores the CIF as posted, with no lookup of it", async () => {
    await expect(submit({ cif: "1234-ZZZ" })).rejects.toThrow("REDIRECT:/");

    expect(mocks.createUsuario).toHaveBeenCalledWith(
      expect.objectContaining({ cif: "1234-ZZZ" }),
    );
    // The only data read is the careers list; `@/lib/data/users` exposes only
    // `createUsuario` here, so any CIF lookup would have thrown.
    expect(mocks.listCarreras).toHaveBeenCalledTimes(1);
  });

  it("answers a password mismatch without creating anything", async () => {
    await expect(
      submit({ confirmPassword: "different-pass" }),
    ).resolves.toEqual({ error: "errors.passwordMismatch" });

    expect(mocks.createUsuario).not.toHaveBeenCalled();
    expect(mocks.setSessionCookie).not.toHaveBeenCalled();
  });

  it("answers invalid input without creating anything", async () => {
    await expect(submit({ correo: "not-an-email" })).resolves.toEqual({
      error: "errors.invalid",
    });

    expect(mocks.createUsuario).not.toHaveBeenCalled();
  });

  it("answers an unknown career without creating anything", async () => {
    await expect(submit({ carreraId: "99" })).resolves.toEqual({
      error: "errors.invalidCarrera",
    });

    expect(mocks.listCarreras).toHaveBeenCalledTimes(1);
    expect(mocks.createUsuario).not.toHaveBeenCalled();
  });

  it("answers a duplicate login without opening a session", async () => {
    mocks.createUsuario.mockRejectedValue(new Error("unique violation"));

    await expect(submit()).resolves.toEqual({ error: "errors.duplicate" });

    expect(mocks.signSession).not.toHaveBeenCalled();
    expect(mocks.setSessionCookie).not.toHaveBeenCalled();
  });
});
