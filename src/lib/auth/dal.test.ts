import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RolUsuario } from "@/lib/validations/auth";

vi.mock("server-only", () => ({}));

const { redirectMock, getSessionMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  getSessionMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/auth/cookies", () => ({
  getSession: getSessionMock,
}));

import { requireRole, requireUser } from "@/lib/auth/dal";
import { ACCESS_DENIED_PATH } from "@/lib/auth/routes";

function sessionFor(rol: RolUsuario) {
  return { sub: "1", login: "usuario", rol, nombre: "Usuario de Prueba" };
}

describe("requireUser", () => {
  beforeEach(() => {
    redirectMock.mockClear();
    getSessionMock.mockReset();
  });

  it("redirects an anonymous caller to /login", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(requireUser()).rejects.toThrow("REDIRECT:/login");
    expect(redirectMock).toHaveBeenCalledWith("/login");
    expect(redirectMock).not.toHaveBeenCalledWith(ACCESS_DENIED_PATH);
  });

  it("returns the session for an authenticated caller", async () => {
    const session = sessionFor("docente");
    getSessionMock.mockResolvedValue(session);

    await expect(requireUser()).resolves.toEqual(session);
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe("requireRole", () => {
  beforeEach(() => {
    redirectMock.mockClear();
    getSessionMock.mockReset();
  });

  it.each(["docente", "estudiante"] as const)(
    "redirects an authenticated %s to the permission-denied screen, never to /",
    async (rol) => {
      getSessionMock.mockResolvedValue(sessionFor(rol));

      await expect(
        requireRole("administrador", "coordinacion", "secretaria"),
      ).rejects.toThrow(`REDIRECT:${ACCESS_DENIED_PATH}`);
      expect(redirectMock).toHaveBeenCalledWith(ACCESS_DENIED_PATH);
      expect(redirectMock).not.toHaveBeenCalledWith("/");
    },
  );

  it.each(["administrador", "coordinacion", "secretaria"] as const)(
    "returns the session for an allowed %s without redirecting",
    async (rol) => {
      const session = sessionFor(rol);
      getSessionMock.mockResolvedValue(session);

      await expect(
        requireRole("administrador", "coordinacion", "secretaria"),
      ).resolves.toEqual(session);
      expect(redirectMock).not.toHaveBeenCalled();
    },
  );

  it("redirects an anonymous caller to /login, not to the denied screen", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(
      requireRole("administrador", "coordinacion", "secretaria"),
    ).rejects.toThrow("REDIRECT:/login");
    expect(redirectMock).toHaveBeenCalledWith("/login");
    expect(redirectMock).not.toHaveBeenCalledWith(ACCESS_DENIED_PATH);
  });
});
