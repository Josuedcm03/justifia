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
  getUsuarioByCorreo: vi.fn(),
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
vi.mock("@/lib/data/users", () => ({
  createUsuario: mocks.createUsuario,
  getUsuarioByCorreo: mocks.getUsuarioByCorreo,
}));
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
  mocks.getUsuarioByCorreo.mockResolvedValue(null);
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
      expect.objectContaining({
        login: "nueva@example.test",
        rol: "estudiante",
      }),
    );
    expect(mocks.signSession).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: "41",
        login: "nueva@example.test",
        rol: "estudiante",
      }),
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
    // The only data read is the careers list and the email lookup;
    // `@/lib/data/users` exposes no CIF lookup here, so one would have thrown.
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

// FE-26, FE-28, FE-22 (UX-21): the registration asks no "Usuario"; the Login is
// derived from the normalized email, and the email and the CIF are required.
describe("registerAction by email and CIF (FE-26, FE-28, FE-22)", () => {
  function nothingCreated() {
    expect(mocks.createUsuario).not.toHaveBeenCalled();
    expect(mocks.hashPassword).not.toHaveBeenCalled();
    expect(mocks.signSession).not.toHaveBeenCalled();
    expect(mocks.setSessionCookie).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  }

  it("derives the Login from the normalized email and stores the email normalized", async () => {
    await expect(submit({ correo: "  Ana.Perez@UNI.edu " })).rejects.toThrow(
      "REDIRECT:/",
    );

    expect(mocks.createUsuario).toHaveBeenCalledTimes(1);
    expect(mocks.createUsuario).toHaveBeenCalledWith(
      expect.objectContaining({
        login: "ana.perez@uni.edu",
        correo: "ana.perez@uni.edu",
        rol: "estudiante",
      }),
    );
  });

  it("ignores a login posted by a hand-crafted request", async () => {
    await expect(submit({ login: "other" })).rejects.toThrow("REDIRECT:/");

    expect(mocks.createUsuario).toHaveBeenCalledWith(
      expect.objectContaining({ login: "nueva@example.test" }),
    );
    expect(mocks.signSession).toHaveBeenCalledWith(
      expect.objectContaining({ login: "nueva@example.test" }),
    );
  });

  it("issues the session as before: the derived Login, the role, no extra claim", async () => {
    await expect(submit()).rejects.toThrow("REDIRECT:/");

    expect(mocks.signSession).toHaveBeenCalledWith({
      sub: "41",
      login: "nueva@example.test",
      rol: "estudiante",
      nombre: "Nueva Cuenta",
    });
    expect(mocks.setSessionCookie).toHaveBeenCalledWith("signed-token");
  });

  it.each([
    ["the email is empty", { correo: "" }],
    ["the email is only spaces", { correo: "   " }],
    ["the CIF is empty", { cif: "" }],
    ["the CIF is only spaces", { cif: "   " }],
    ["both are empty", { correo: "", cif: "" }],
  ])("refuses the registration when %s and creates nothing", async (_l, o) => {
    await expect(submit(o)).resolves.toEqual({ error: "errors.invalid" });

    nothingCreated();
  });

  it("refuses a form without the email or the CIF fields", async () => {
    const f = form();
    f.delete("correo");
    f.delete("cif");

    await expect(registerAction({ error: null }, f)).resolves.toEqual({
      error: "errors.invalid",
    });

    nothingCreated();
  });

  it("refuses an email equal ignoring case to an existing one and creates nothing", async () => {
    mocks.getUsuarioByCorreo.mockResolvedValue({
      id: 3,
      correo: "ana@uni.edu",
    });

    await expect(submit({ correo: "Ana@Uni.edu" })).resolves.toEqual({
      error: "errors.duplicate",
    });

    expect(mocks.getUsuarioByCorreo).toHaveBeenCalledWith("ana@uni.edu");
    nothingCreated();
  });

  it("answers a derived Login that is already taken with the duplicate error", async () => {
    mocks.createUsuario.mockRejectedValue(new Error("unique violation"));

    await expect(submit()).resolves.toEqual({ error: "errors.duplicate" });

    expect(mocks.createUsuario).toHaveBeenCalledTimes(1);
    expect(mocks.signSession).not.toHaveBeenCalled();
    expect(mocks.setSessionCookie).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("shows an email whose Login would exceed 60 characters as an email error", async () => {
    const correo = `${"a".repeat(53)}@uni.edu`;
    expect(correo).toHaveLength(61);

    await expect(submit({ correo })).resolves.toEqual({
      error: "errors.emailTooLong",
    });

    nothingCreated();
  });

  it("accepts an email that gives a Login of exactly 60 characters", async () => {
    const correo = `${"a".repeat(52)}@uni.edu`;
    expect(correo).toHaveLength(60);

    await expect(submit({ correo })).rejects.toThrow("REDIRECT:/");

    expect(mocks.createUsuario).toHaveBeenCalledWith(
      expect.objectContaining({ login: correo, correo }),
    );
  });

  it("looks the email up only after the form and the career are valid", async () => {
    await expect(submit({ carreraId: "99" })).resolves.toEqual({
      error: "errors.invalidCarrera",
    });
    await expect(
      submit({ confirmPassword: "different-pass" }),
    ).resolves.toEqual({ error: "errors.passwordMismatch" });

    expect(mocks.getUsuarioByCorreo).not.toHaveBeenCalled();
  });
});
