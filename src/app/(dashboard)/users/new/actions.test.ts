import { beforeEach, describe, expect, it, vi } from "vitest";

import { rolesQueCreanUsuarios } from "@/lib/auth/permissions";
import { ACCESS_DENIED_PATH } from "@/lib/auth/routes";
import type { RolUsuario } from "@/lib/validations/auth";

vi.mock("server-only", () => ({}));

const {
  redirectMock,
  requireRoleMock,
  hashPasswordMock,
  createUsuarioMock,
  listCarrerasMock,
} = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  requireRoleMock: vi.fn(),
  hashPasswordMock: vi.fn(),
  createUsuarioMock: vi.fn(),
  listCarrerasMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
}));

vi.mock("@/lib/auth/dal", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/lib/auth/password", () => ({
  hashPassword: hashPasswordMock,
}));

vi.mock("@/lib/data/users", () => ({
  createUsuario: createUsuarioMock,
}));

vi.mock("@/lib/data/carreras", () => ({
  listCarreras: listCarrerasMock,
}));

import { createStaffAction } from "@/app/(dashboard)/users/new/actions";

function sessionFor(rol: RolUsuario) {
  return { sub: "1", login: "caller", rol, nombre: "Caller" };
}

/** Mirrors dal.ts's real `requireRole`: redirect when the caller isn't in the
 * allowed list, otherwise resolve with the session. */
function allowSession(rol: RolUsuario) {
  requireRoleMock.mockImplementation(async (...roles: RolUsuario[]) => {
    if (!roles.includes(rol)) {
      redirectMock(ACCESS_DENIED_PATH);
    }
    return sessionFor(rol);
  });
}

function buildFormData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

const validPayload = {
  login: "nuevo",
  password: "password123",
  nombreCompleto: "Nueva Persona",
  correo: "",
  telefono: "",
};

describe("createStaffAction", () => {
  beforeEach(() => {
    redirectMock.mockClear();
    requireRoleMock.mockReset();
    hashPasswordMock.mockReset();
    createUsuarioMock.mockReset();
    listCarrerasMock.mockReset();
    hashPasswordMock.mockResolvedValue("hashed");
    createUsuarioMock.mockResolvedValue({});
    listCarrerasMock.mockResolvedValue([]);
  });

  it("requireRole is called with exactly rolesQueCreanUsuarios", async () => {
    allowSession("secretaria");
    const fd = buildFormData({ ...validPayload, rol: "docente" });

    await expect(createStaffAction({ error: null }, fd)).rejects.toThrow(
      "REDIRECT:/users",
    );

    expect(requireRoleMock).toHaveBeenCalledWith(...rolesQueCreanUsuarios);
  });

  it.each(["docente", "estudiante"] as const)(
    "check (a): a non-creator caller %s is redirected before any input is parsed",
    async (rol) => {
      allowSession(rol);
      const fd = buildFormData({ ...validPayload, rol: "administrador" });

      await expect(createStaffAction({ error: null }, fd)).rejects.toThrow(
        `REDIRECT:${ACCESS_DENIED_PATH}`,
      );

      expect(requireRoleMock).toHaveBeenCalledWith(...rolesQueCreanUsuarios);
      expect(hashPasswordMock).not.toHaveBeenCalled();
      expect(createUsuarioMock).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["secretaria", "administrador"],
    ["administrador", "docente"],
    ["coordinacion", "coordinacion"],
  ] as const)(
    "check (b): %s -> %s is redirected to the denied screen, no write, no form error",
    async (caller, target) => {
      allowSession(caller);
      const fd = buildFormData({ ...validPayload, rol: target });

      const result = createStaffAction({ error: null }, fd);

      await expect(result).rejects.toThrow(`REDIRECT:${ACCESS_DENIED_PATH}`);
      expect(hashPasswordMock).not.toHaveBeenCalled();
      expect(createUsuarioMock).not.toHaveBeenCalled();
    },
  );

  it("check (a) and check (b) redirect to the same denied path", async () => {
    allowSession("docente");
    const fdA = buildFormData({ ...validPayload, rol: "administrador" });
    await expect(createStaffAction({ error: null }, fdA)).rejects.toThrow();
    const targetA = redirectMock.mock.calls.at(-1)?.[0];

    redirectMock.mockClear();
    allowSession("secretaria");
    const fdB = buildFormData({ ...validPayload, rol: "administrador" });
    await expect(createStaffAction({ error: null }, fdB)).rejects.toThrow();
    const targetB = redirectMock.mock.calls.at(-1)?.[0];

    expect(targetA).toBe(ACCESS_DENIED_PATH);
    expect(targetA).toBe(targetB);
  });

  it.each(["estudiante", "", "root"])(
    "role %j is a validation error, never a redirect",
    async (rol) => {
      allowSession("administrador");
      const fd = buildFormData({ ...validPayload, rol });

      const result = await createStaffAction({ error: null }, fd);

      expect(result).toEqual({ error: "errors.invalid" });
      expect(redirectMock).not.toHaveBeenCalled();
      expect(createUsuarioMock).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["administrador", "coordinacion"],
    ["coordinacion", "secretaria"],
    ["secretaria", "docente"],
  ] as const)(
    "allowed pair %s -> %s reaches createUsuario with the expected rol",
    async (caller, target) => {
      allowSession(caller);
      listCarrerasMock.mockResolvedValue([{ id: 7, nombre: "Ingeniería" }]);
      const fd = buildFormData({
        ...validPayload,
        rol: target,
        ...(target === "coordinacion" ? { carreraId: "7" } : {}),
      });

      await expect(createStaffAction({ error: null }, fd)).rejects.toThrow(
        "REDIRECT:/users",
      );

      expect(createUsuarioMock).toHaveBeenCalledWith(
        expect.objectContaining({ rol: target }),
      );
    },
  );
});
