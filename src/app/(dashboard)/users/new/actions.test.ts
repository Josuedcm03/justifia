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
  createStaffUsuarioMock,
  getUsuarioByCorreoMock,
  listCarrerasMock,
  getUserFacultadIdMock,
} = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  requireRoleMock: vi.fn(),
  hashPasswordMock: vi.fn(),
  createStaffUsuarioMock: vi.fn(),
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
  createStaffUsuario: createStaffUsuarioMock,
  getUsuarioByCorreo: getUsuarioByCorreoMock,
  getUserFacultadId: getUserFacultadIdMock,
}));

vi.mock("@/lib/data/carreras", () => ({
  listCarreras: listCarrerasMock,
}));

import { createStaffAction } from "@/app/(dashboard)/users/new/actions";

// The action logs one sanitised line for an unexpected creation failure
// (SAC-AUD-1); the tests that exercise failures read it, the rest swallow it.
const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

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
    createStaffUsuarioMock.mockReset();
    getUsuarioByCorreoMock.mockReset();
    listCarrerasMock.mockReset();
    getUserFacultadIdMock.mockReset();
    getUsuarioByCorreoMock.mockResolvedValue(null);
    getUserFacultadIdMock.mockResolvedValue(5);
    hashPasswordMock.mockResolvedValue("hashed");
    createStaffUsuarioMock.mockResolvedValue({});
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
      expect(createStaffUsuarioMock).not.toHaveBeenCalled();
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
      expect(createStaffUsuarioMock).not.toHaveBeenCalled();
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
      expect(createStaffUsuarioMock).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["administrador", "coordinacion"],
    ["coordinacion", "secretaria"],
    ["secretaria", "docente"],
  ] as const)(
    "allowed pair %s -> %s reaches createStaffUsuario with the expected rol",
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

      expect(createStaffUsuarioMock).toHaveBeenCalledWith(
        1,
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
      expect(createStaffUsuarioMock).toHaveBeenCalledTimes(1);
      expect(createStaffUsuarioMock).toHaveBeenCalledWith(
        1,
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

      expect(createStaffUsuarioMock).toHaveBeenCalledWith(
        1,
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

      expect(createStaffUsuarioMock).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ facultadId: 5, carreraId: null }),
      );
    });

    it("refuses a coordinator with no derivable facultad: nothing is created and no redirect", async () => {
      allowSession("coordinacion");
      getUserFacultadIdMock.mockResolvedValue(null);
      const fd = buildFormData({ ...validPayload, rol: "secretaria" });

      const result = await createStaffAction({ error: null }, fd);

      expect(result).toEqual({ error: "errors.facultadRequired" });
      expect(createStaffUsuarioMock).not.toHaveBeenCalled();
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
        expect(createStaffUsuarioMock).toHaveBeenCalledWith(
          1,
          expect.objectContaining({ facultadId: null }),
        );
      },
    );
  });

  it("rethrows RolDesconocidoError from createStaffUsuario (decision 7: a config error is not a duplicate)", async () => {
    allowSession("administrador");
    listCarrerasMock.mockResolvedValue([{ id: 7, nombre: "Ingeniería" }]);
    createStaffUsuarioMock.mockRejectedValue(
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

  it("keeps errors.duplicate for any other createStaffUsuario failure", async () => {
    allowSession("secretaria");
    createStaffUsuarioMock.mockRejectedValue(new Error("duplicate key value"));
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
    createStaffUsuarioMock.mockReset();
    getUsuarioByCorreoMock.mockReset();
    listCarrerasMock.mockReset();
    getUserFacultadIdMock.mockReset();
    getUsuarioByCorreoMock.mockResolvedValue(null);
    getUserFacultadIdMock.mockResolvedValue(5);
    hashPasswordMock.mockResolvedValue("hashed");
    createStaffUsuarioMock.mockResolvedValue({});
    listCarrerasMock.mockResolvedValue([{ id: 7, nombre: "Ingeniería" }]);
    allowSession("secretaria");
  });

  function nothingCreated() {
    expect(createStaffUsuarioMock).not.toHaveBeenCalled();
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

    expect(createStaffUsuarioMock).toHaveBeenCalledTimes(1);
    expect(createStaffUsuarioMock).toHaveBeenCalledWith(
      1,
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

    expect(createStaffUsuarioMock).toHaveBeenCalledWith(
      1,
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

    expect(createStaffUsuarioMock).toHaveBeenCalledWith(
      1,
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
    createStaffUsuarioMock.mockRejectedValue(new Error("duplicate key value"));
    const fd = buildFormData({ ...validPayload, rol: "docente" });

    await expect(createStaffAction({ error: null }, fd)).resolves.toEqual({
      error: "errors.duplicate",
    });

    expect(createStaffUsuarioMock).toHaveBeenCalledTimes(1);
    expect(createStaffUsuarioMock).toHaveBeenCalledWith(
      1,
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
    expect(createStaffUsuarioMock).not.toHaveBeenCalled();
  });
});

// SAC-AUD-1 (D5): the form creates the account through the audited path. The
// transaction and its audit row are proved in users.test.ts (units) and in the
// Postgres suite; here the action only has to hand over the right actor and the
// right account, in the same order of checks as before.
describe("createStaffAction audit contract (SAC-AUD-1)", () => {
  beforeEach(() => {
    redirectMock.mockClear();
    requireRoleMock.mockReset();
    hashPasswordMock.mockReset();
    createStaffUsuarioMock.mockReset();
    getUsuarioByCorreoMock.mockReset();
    listCarrerasMock.mockReset();
    getUserFacultadIdMock.mockReset();
    errorSpy.mockClear();
    getUsuarioByCorreoMock.mockResolvedValue(null);
    getUserFacultadIdMock.mockResolvedValue(5);
    hashPasswordMock.mockResolvedValue("hashed");
    createStaffUsuarioMock.mockResolvedValue({});
    listCarrerasMock.mockResolvedValue([{ id: 7, nombre: "Ingeniería" }]);
  });

  it("hands the session user to createStaffUsuario as the actor, never a value of the body", async () => {
    requireRoleMock.mockResolvedValue({
      ...sessionFor("secretaria"),
      sub: "42",
    });
    const fd = buildFormData({
      ...validPayload,
      rol: "docente",
      actorId: "7",
      actor: "7",
    });

    await expect(createStaffAction({ error: null }, fd)).rejects.toThrow(
      "REDIRECT:/users",
    );

    expect(createStaffUsuarioMock).toHaveBeenCalledTimes(1);
    expect(createStaffUsuarioMock.mock.calls[0][0]).toBe(42);
  });

  it.each([
    ["administrador", "coordinacion", { carreraId: "7" }, 7, null],
    ["coordinacion", "secretaria", {}, null, 5],
    ["secretaria", "docente", {}, null, null],
  ] as const)(
    "creates exactly one account for %s -> %s, with the derived Login, the hash and the facultad rule, then redirects to /users",
    async (caller, target, extra, carreraId, facultadId) => {
      allowSession(caller);
      const fd = buildFormData({ ...validPayload, rol: target, ...extra });

      await expect(createStaffAction({ error: null }, fd)).rejects.toThrow(
        "REDIRECT:/users",
      );

      expect(createStaffUsuarioMock).toHaveBeenCalledTimes(1);
      expect(createStaffUsuarioMock).toHaveBeenCalledWith(1, {
        login: "nuevo@uni.edu",
        hashClave: "hashed",
        rol: target,
        nombreCompleto: "Nueva Persona",
        correo: "nuevo@uni.edu",
        telefono: null,
        cif: null,
        carreraId,
        facultadId,
      });
      expect(errorSpy).not.toHaveBeenCalled();
    },
  );

  it("keeps every check in its order and creates last", async () => {
    allowSession("coordinacion");
    const fd = buildFormData({ ...validPayload, rol: "secretaria" });

    await expect(createStaffAction({ error: null }, fd)).rejects.toThrow(
      "REDIRECT:/users",
    );

    const order = [
      requireRoleMock,
      getUsuarioByCorreoMock,
      getUserFacultadIdMock,
      hashPasswordMock,
      createStaffUsuarioMock,
    ].map((mock) => mock.mock.invocationCallOrder[0]);
    expect(order).toEqual(order.toSorted((a, b) => a - b));
    expect(order.every((n) => n > 0)).toBe(true);
  });

  describe("a refusal writes no account and no audit row", () => {
    it.each([
      [
        "check (a): a caller who may not create",
        "docente",
        { rol: "docente" },
        "REDIRECT:" + ACCESS_DENIED_PATH,
      ],
      [
        "check (b): a role outside the assignable set of the caller",
        "secretaria",
        { rol: "administrador" },
        "REDIRECT:" + ACCESS_DENIED_PATH,
      ],
      [
        "invalid data: the role estudiante",
        "administrador",
        { rol: "estudiante" },
        { error: "errors.invalid" },
      ],
      [
        "invalid data: a password that is too short",
        "secretaria",
        { rol: "docente", password: "short" },
        { error: "errors.invalid" },
      ],
      [
        "a coordinacion account without a career",
        "administrador",
        { rol: "coordinacion" },
        { error: "errors.careerRequired" },
      ],
      [
        "a coordinacion account with an unknown career",
        "administrador",
        { rol: "coordinacion", carreraId: "99" },
        { error: "errors.invalidCarrera" },
      ],
    ] as const)("%s", async (_label, caller, fields, outcome) => {
      allowSession(caller);
      const fd = buildFormData({ ...validPayload, ...fields });

      const result = createStaffAction({ error: null }, fd);

      if (typeof outcome === "string") {
        await expect(result).rejects.toThrow(outcome);
      } else {
        await expect(result).resolves.toEqual(outcome);
        expect(redirectMock).not.toHaveBeenCalled();
      }
      expect(createStaffUsuarioMock).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it("an email already held by another account, in any case", async () => {
      allowSession("secretaria");
      getUsuarioByCorreoMock.mockResolvedValue({ id: 3 });
      const fd = buildFormData({
        ...validPayload,
        correo: "NUEVO@uni.edu",
        rol: "docente",
      });

      await expect(createStaffAction({ error: null }, fd)).resolves.toEqual({
        error: "errors.duplicate",
      });

      expect(getUsuarioByCorreoMock).toHaveBeenCalledWith("nuevo@uni.edu");
      expect(createStaffUsuarioMock).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it("a coordinacion caller without a career creating a secretaria", async () => {
      allowSession("coordinacion");
      getUserFacultadIdMock.mockResolvedValue(null);
      const fd = buildFormData({ ...validPayload, rol: "secretaria" });

      await expect(createStaffAction({ error: null }, fd)).resolves.toEqual({
        error: "errors.facultadRequired",
      });

      expect(createStaffUsuarioMock).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it("a derived Login already in use (unique violation): the ordinary duplicate error, no redirect and no failure line", async () => {
      allowSession("secretaria");
      createStaffUsuarioMock.mockRejectedValue(
        Object.assign(new Error("duplicate key value"), { code: "23505" }),
      );
      const fd = buildFormData({ ...validPayload, rol: "docente" });

      await expect(createStaffAction({ error: null }, fd)).resolves.toEqual({
        error: "errors.duplicate",
      });

      expect(redirectMock).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it("also reads the unique violation when the driver wraps it in a cause", async () => {
      allowSession("secretaria");
      createStaffUsuarioMock.mockRejectedValue(
        new Error("Failed query", { cause: { code: "23505" } }),
      );
      const fd = buildFormData({ ...validPayload, rol: "docente" });

      await expect(createStaffAction({ error: null }, fd)).resolves.toEqual({
        error: "errors.duplicate",
      });

      expect(errorSpy).not.toHaveBeenCalled();
    });
  });

  describe("any other failure (an audit insert that fails included)", () => {
    const SENTINELS = [
      "nuevo@uni.edu",
      "Nueva Persona",
      "password123",
      "hashed",
    ];

    it("writes one sanitised line with the actor, the error name and the SQLSTATE, and shows the ordinary error with no redirect", async () => {
      allowSession("secretaria");
      class PostgresError extends Error {
        name = "PostgresError";
        code = "23503";
      }
      createStaffUsuarioMock.mockRejectedValue(
        new PostgresError(
          "insert into Usuario (Correo) values ($1) nuevo@uni.edu Nueva Persona password123 hashed",
        ),
      );
      const fd = buildFormData({ ...validPayload, rol: "docente" });

      await expect(createStaffAction({ error: null }, fd)).resolves.toEqual({
        error: "errors.duplicate",
      });

      expect(redirectMock).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledTimes(1);
      const [line] = errorSpy.mock.calls[0];
      expect(typeof line).toBe("string");
      expect(JSON.parse(line as string)).toEqual({
        event: "usuario.create.failed",
        actor: 1,
        errorName: "PostgresError",
        errorCode: "23503",
      });
      for (const sentinel of SENTINELS) {
        expect(line).not.toContain(sentinel);
      }
      expect(line).not.toContain("insert into");
    });

    it("names the actor from the session and omits the SQLSTATE when the error has none", async () => {
      requireRoleMock.mockResolvedValue({
        ...sessionFor("secretaria"),
        sub: "42",
      });
      createStaffUsuarioMock.mockRejectedValue(new Error("audit down"));
      const fd = buildFormData({ ...validPayload, rol: "docente" });

      await expect(createStaffAction({ error: null }, fd)).resolves.toEqual({
        error: "errors.duplicate",
      });

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(JSON.parse(errorSpy.mock.calls[0][0] as string)).toEqual({
        event: "usuario.create.failed",
        actor: 42,
        errorName: "Error",
      });
    });

    it("logs the type of a value that is not an error, never the value", async () => {
      allowSession("secretaria");
      createStaffUsuarioMock.mockRejectedValue("nuevo@uni.edu");
      const fd = buildFormData({ ...validPayload, rol: "docente" });

      await expect(createStaffAction({ error: null }, fd)).resolves.toEqual({
        error: "errors.duplicate",
      });

      const [line] = errorSpy.mock.calls[0];
      expect(JSON.parse(line as string).errorName).toBe("string");
      expect(line).not.toContain("nuevo@uni.edu");
    });

    it("still rethrows RolDesconocidoError instead of showing the form error", async () => {
      allowSession("secretaria");
      createStaffUsuarioMock.mockRejectedValue(
        new RolDesconocidoError("docente"),
      );
      const fd = buildFormData({ ...validPayload, rol: "docente" });

      await expect(
        createStaffAction({ error: null }, fd),
      ).rejects.toBeInstanceOf(RolDesconocidoError);

      expect(redirectMock).not.toHaveBeenCalled();
    });
  });
});
