import { beforeEach, describe, expect, it, vi } from "vitest";

import { rolesQueCreanUsuarios } from "@/lib/auth/permissions";
import { ACCESS_DENIED_PATH } from "@/lib/auth/routes";
import { RolDesconocidoError } from "@/lib/data/roles";
import type { RolUsuario } from "@/lib/validations/auth";

vi.mock("server-only", () => ({}));
// RolDesconocidoError is imported directly (below) from the real, unmocked
// `@/lib/data/roles` module so the two errors compared in the "rethrows"
// test are the exact same class; only its `@/db` import needs a stub so
// module evaluation never runs `src/env.ts` in the test runner.
vi.mock("@/db", () => ({ db: {} }));

const {
  redirectMock,
  requireRoleMock,
  hashPasswordMock,
  createUsuarioMock,
  getUsuarioByCorreoMock,
  listCarrerasMock,
  getUserFacultadIdMock,
} = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  requireRoleMock: vi.fn(),
  hashPasswordMock: vi.fn(),
  createUsuarioMock: vi.fn(),
  getUsuarioByCorreoMock: vi.fn(),
  listCarrerasMock: vi.fn(),
  getUserFacultadIdMock: vi.fn(),
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
  getUsuarioByCorreo: getUsuarioByCorreoMock,
  getUserFacultadId: getUserFacultadIdMock,
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
  password: "password123",
  nombreCompleto: "Nueva Persona",
  correo: "nuevo@uni.edu",
  telefono: "",
};

describe("createStaffAction", () => {
  beforeEach(() => {
    redirectMock.mockClear();
    requireRoleMock.mockReset();
    hashPasswordMock.mockReset();
    createUsuarioMock.mockReset();
    getUsuarioByCorreoMock.mockReset();
    listCarrerasMock.mockReset();
    getUserFacultadIdMock.mockReset();
    getUsuarioByCorreoMock.mockResolvedValue(null);
    getUserFacultadIdMock.mockResolvedValue(5);
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

  describe("SR-16: a new secretaria inherits the creating coordinator's facultad", () => {
    it("derives FacultadId from the creator's carrera, not from the form", async () => {
      allowSession("coordinacion");
      const fd = buildFormData({ ...validPayload, rol: "secretaria" });

      await expect(createStaffAction({ error: null }, fd)).rejects.toThrow(
        "REDIRECT:/users",
      );

      expect(getUserFacultadIdMock).toHaveBeenCalledWith(1);
      expect(createUsuarioMock).toHaveBeenCalledTimes(1);
      expect(createUsuarioMock).toHaveBeenCalledWith(
        expect.objectContaining({
          rol: "secretaria",
          facultadId: 5,
          carreraId: null,
        }),
      );
    });

    it("uses the facultad the database returns for each creator", async () => {
      allowSession("coordinacion");
      getUserFacultadIdMock.mockResolvedValue(9);
      const fd = buildFormData({ ...validPayload, rol: "secretaria" });

      await expect(createStaffAction({ error: null }, fd)).rejects.toThrow();

      expect(createUsuarioMock).toHaveBeenCalledWith(
        expect.objectContaining({ facultadId: 9 }),
      );
    });

    it("ignores a forged facultadId (and carreraId) in the request", async () => {
      allowSession("coordinacion");
      const fd = buildFormData({
        ...validPayload,
        rol: "secretaria",
        facultadId: "99",
        carreraId: "7",
      });

      await expect(createStaffAction({ error: null }, fd)).rejects.toThrow(
        "REDIRECT:/users",
      );

      expect(createUsuarioMock).toHaveBeenCalledWith(
        expect.objectContaining({ facultadId: 5, carreraId: null }),
      );
    });

    it("refuses a coordinator with no derivable facultad: nothing is created and no redirect", async () => {
      allowSession("coordinacion");
      getUserFacultadIdMock.mockResolvedValue(null);
      const fd = buildFormData({ ...validPayload, rol: "secretaria" });

      const result = await createStaffAction({ error: null }, fd);

      expect(result).toEqual({ error: "errors.facultadRequired" });
      expect(createUsuarioMock).not.toHaveBeenCalled();
      expect(hashPasswordMock).not.toHaveBeenCalled();
      expect(redirectMock).not.toHaveBeenCalled();
    });

    it("does not read the creator's facultad when the role check redirects first", async () => {
      allowSession("secretaria");
      const fd = buildFormData({ ...validPayload, rol: "secretaria" });

      await expect(createStaffAction({ error: null }, fd)).rejects.toThrow(
        `REDIRECT:${ACCESS_DENIED_PATH}`,
      );

      expect(getUserFacultadIdMock).not.toHaveBeenCalled();
    });

    it.each([
      ["administrador", "coordinacion", { carreraId: "7" }],
      ["secretaria", "docente", {}],
    ] as const)(
      "gives a %s -> %s account no facultad and reads none",
      async (caller, target, extra) => {
        allowSession(caller);
        listCarrerasMock.mockResolvedValue([{ id: 7, nombre: "Ingeniería" }]);
        const fd = buildFormData({
          ...validPayload,
          rol: target,
          facultadId: "99",
          ...extra,
        });

        await expect(createStaffAction({ error: null }, fd)).rejects.toThrow(
          "REDIRECT:/users",
        );

        expect(getUserFacultadIdMock).not.toHaveBeenCalled();
        expect(createUsuarioMock).toHaveBeenCalledWith(
          expect.objectContaining({ facultadId: null }),
        );
      },
    );
  });

  it("rethrows RolDesconocidoError from createUsuario (decision 7: a config error is not a duplicate)", async () => {
    allowSession("administrador");
    listCarrerasMock.mockResolvedValue([{ id: 7, nombre: "Ingeniería" }]);
    createUsuarioMock.mockRejectedValue(
      new RolDesconocidoError("coordinacion"),
    );
    const fd = buildFormData({
      ...validPayload,
      rol: "coordinacion",
      carreraId: "7",
    });

    await expect(createStaffAction({ error: null }, fd)).rejects.toBeInstanceOf(
      RolDesconocidoError,
    );
  });

  it("keeps errors.duplicate for any other createUsuario failure", async () => {
    allowSession("secretaria");
    createUsuarioMock.mockRejectedValue(new Error("duplicate key value"));
    const fd = buildFormData({ ...validPayload, rol: "docente" });

    const result = await createStaffAction({ error: null }, fd);

    expect(result).toEqual({ error: "errors.duplicate" });
  });
});

// FE-27, FE-28 (UX-21): staff are created by their institutional email; the
// server derives the Login from it and nothing in the request can set it.
describe("createStaffAction by email (FE-27, FE-28)", () => {
  beforeEach(() => {
    redirectMock.mockClear();
    requireRoleMock.mockReset();
    hashPasswordMock.mockReset();
    createUsuarioMock.mockReset();
    getUsuarioByCorreoMock.mockReset();
    listCarrerasMock.mockReset();
    getUserFacultadIdMock.mockReset();
    getUsuarioByCorreoMock.mockResolvedValue(null);
    getUserFacultadIdMock.mockResolvedValue(5);
    hashPasswordMock.mockResolvedValue("hashed");
    createUsuarioMock.mockResolvedValue({});
    listCarrerasMock.mockResolvedValue([{ id: 7, nombre: "Ingeniería" }]);
    allowSession("secretaria");
  });

  function nothingCreated() {
    expect(createUsuarioMock).not.toHaveBeenCalled();
    expect(hashPasswordMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  }

  it("stores the email normalized and derives the Login from it", async () => {
    const fd = buildFormData({
      ...validPayload,
      correo: "  Ana.Perez@UNI.edu ",
      rol: "docente",
    });

    await expect(createStaffAction({ error: null }, fd)).rejects.toThrow(
      "REDIRECT:/users",
    );

    expect(createUsuarioMock).toHaveBeenCalledTimes(1);
    expect(createUsuarioMock).toHaveBeenCalledWith(
      expect.objectContaining({
        login: "ana.perez@uni.edu",
        correo: "ana.perez@uni.edu",
        rol: "docente",
      }),
    );
  });

  it("ignores a login posted by a hand-crafted request", async () => {
    const fd = buildFormData({
      ...validPayload,
      login: "other",
      rol: "docente",
    });

    await expect(createStaffAction({ error: null }, fd)).rejects.toThrow(
      "REDIRECT:/users",
    );

    expect(createUsuarioMock).toHaveBeenCalledWith(
      expect.objectContaining({ login: "nuevo@uni.edu" }),
    );
  });

  it.each([
    ["absent", null],
    ["empty", ""],
    ["only spaces", "   "],
    ["not an address", "not-an-email"],
    ["161 characters", `${"a".repeat(153)}@uni.edu`],
  ])(
    "refuses an email that is %s with an error on the email and creates nothing",
    async (_label, correo) => {
      const fd = buildFormData({ ...validPayload, rol: "docente" });
      if (correo === null) fd.delete("correo");
      else fd.set("correo", correo);

      await expect(createStaffAction({ error: null }, fd)).resolves.toEqual({
        error: "errors.emailInvalid",
      });

      nothingCreated();
      expect(getUsuarioByCorreoMock).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["administrador", "coordinacion", { carreraId: "7" }],
    ["coordinacion", "secretaria", {}],
    ["secretaria", "docente", {}],
  ] as const)(
    "every assignable role needs the email: %s -> %s",
    async (caller, target, extra) => {
      allowSession(caller);
      const fd = buildFormData({
        ...validPayload,
        correo: "",
        rol: target,
        ...extra,
      });

      await expect(createStaffAction({ error: null }, fd)).resolves.toEqual({
        error: "errors.emailInvalid",
      });

      nothingCreated();
    },
  );

  it("shows loginTooLong as the emailTooLong error: nothing is truncated or suffixed", async () => {
    const correo = `${"a".repeat(53)}@uni.edu`;
    expect(correo).toHaveLength(61);
    const fd = buildFormData({ ...validPayload, correo, rol: "docente" });

    await expect(createStaffAction({ error: null }, fd)).resolves.toEqual({
      error: "errors.emailTooLong",
    });

    nothingCreated();
  });

  it("accepts an email that gives a Login of exactly 60 characters", async () => {
    const correo = `${"a".repeat(52)}@uni.edu`;
    expect(correo).toHaveLength(60);
    const fd = buildFormData({ ...validPayload, correo, rol: "docente" });

    await expect(createStaffAction({ error: null }, fd)).rejects.toThrow(
      "REDIRECT:/users",
    );

    expect(createUsuarioMock).toHaveBeenCalledWith(
      expect.objectContaining({ login: correo, correo }),
    );
  });

  it("refuses an email equal ignoring case to an existing one: nothing is created", async () => {
    getUsuarioByCorreoMock.mockResolvedValue({ id: 3, correo: "ana@uni.edu" });
    const fd = buildFormData({
      ...validPayload,
      correo: "ANA@uni.edu",
      rol: "docente",
    });

    await expect(createStaffAction({ error: null }, fd)).resolves.toEqual({
      error: "errors.duplicate",
    });

    expect(getUsuarioByCorreoMock).toHaveBeenCalledWith("ana@uni.edu");
    nothingCreated();
  });

  it("returns a form error, without a redirect or a suffix, when the derived Login is taken", async () => {
    createUsuarioMock.mockRejectedValue(new Error("duplicate key value"));
    const fd = buildFormData({ ...validPayload, rol: "docente" });

    await expect(createStaffAction({ error: null }, fd)).resolves.toEqual({
      error: "errors.duplicate",
    });

    expect(createUsuarioMock).toHaveBeenCalledTimes(1);
    expect(createUsuarioMock).toHaveBeenCalledWith(
      expect.objectContaining({ login: "nuevo@uni.edu" }),
    );
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("does not look up the email when the role check redirects first", async () => {
    allowSession("secretaria");
    const fd = buildFormData({ ...validPayload, rol: "administrador" });

    await expect(createStaffAction({ error: null }, fd)).rejects.toThrow(
      `REDIRECT:${ACCESS_DENIED_PATH}`,
    );

    expect(getUsuarioByCorreoMock).not.toHaveBeenCalled();
    expect(createUsuarioMock).not.toHaveBeenCalled();
  });
});
