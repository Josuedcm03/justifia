import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  setSessionCookie: vi.fn(),
  clearSessionCookie: vi.fn(),
  signSession: vi.fn(async () => "signed-token"),
  verifyPassword: vi.fn(),
  getUsuarioByLogin: vi.fn(),
  requireUser: vi.fn(),
  requireRole: vi.fn(),
  requireUserAllowingPasswordChange: vi.fn(),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth/cookies", () => ({
  setSessionCookie: mocks.setSessionCookie,
  clearSessionCookie: mocks.clearSessionCookie,
}));
vi.mock("@/lib/auth/password", () => ({
  verifyPassword: mocks.verifyPassword,
}));
vi.mock("@/lib/auth/session", () => ({ signSession: mocks.signSession }));
vi.mock("@/lib/data/users", () => ({
  getUsuarioByLogin: mocks.getUsuarioByLogin,
}));
vi.mock("@/lib/auth/dal", () => ({
  requireUser: mocks.requireUser,
  requireRole: mocks.requireRole,
  requireUserAllowingPasswordChange: mocks.requireUserAllowingPasswordChange,
}));

import { loginAction, logoutAction } from "@/app/(auth)/login/actions";
import {
  CANCELLED_HASH,
  SYSTEM_HASH,
  SYSTEM_LOGIN,
  cancelledLogin,
} from "@/lib/retention/policy";

function account(debeCambiarClave: boolean) {
  return {
    id: 7,
    login: "maria",
    hashClave: "$2b$12$hash",
    nombreCompleto: "Maria Perez",
    rol: "secretaria" as const,
    activo: true,
    debeCambiarClave,
  };
}

function form() {
  const f = new FormData();
  f.set("login", "maria");
  f.set("password", "temporary-pass");
  return f;
}

async function login() {
  await expect(loginAction({ error: null }, form())).rejects.toThrow(
    /^REDIRECT:/,
  );
}

describe("loginAction session payload (FPC)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyPassword.mockResolvedValue(true);
  });

  it("puts debeCambiarClave: true in the session of a flagged account", async () => {
    mocks.getUsuarioByLogin.mockResolvedValue(account(true));

    await login();

    expect(mocks.signSession).toHaveBeenCalledWith(
      expect.objectContaining({ sub: "7", debeCambiarClave: true }),
    );
    expect(mocks.setSessionCookie).toHaveBeenCalledWith("signed-token");
  });

  it("puts debeCambiarClave: false in the session of a normal account", async () => {
    mocks.getUsuarioByLogin.mockResolvedValue(account(false));

    await login();

    expect(mocks.signSession).toHaveBeenCalledWith(
      expect.objectContaining({ sub: "7", debeCambiarClave: false }),
    );
  });

  it("redirects to / when the next target starts with a backslash (AEA-3)", async () => {
    mocks.getUsuarioByLogin.mockResolvedValue(account(false));
    const f = form();
    f.set("next", "/\\evil.com");

    await expect(loginAction({ error: null }, f)).rejects.toThrow(
      /^REDIRECT:\/$/,
    );
    expect(mocks.redirect).toHaveBeenCalledWith("/");
  });

  it("calls no guard, so the login screen is reachable while signed out", async () => {
    mocks.getUsuarioByLogin.mockResolvedValue(account(true));

    await login();

    expect(mocks.requireUser).not.toHaveBeenCalled();
    expect(mocks.requireRole).not.toHaveBeenCalled();
    expect(mocks.requireUserAllowingPasswordChange).not.toHaveBeenCalled();
  });
});

// Retention accounts (data-retention, DR-3; audit-log "System actor is not
// usable"). The sentinel and a cancelled student are inactive rows with a hash
// no password can match, so neither can sign in: the inactive check stops them
// first, and the hash alone would stop them if that check ever went missing.
describe("loginAction on retention accounts (DR-3)", () => {
  const accounts = [
    ["the system account", SYSTEM_LOGIN, SYSTEM_HASH, "administrador"],
    ["a cancelled student", cancelledLogin(7), CANCELLED_HASH, "estudiante"],
  ] as const;

  beforeEach(() => {
    vi.clearAllMocks();
    // Even a verifier that accepts everything must not let them in.
    mocks.verifyPassword.mockResolvedValue(true);
  });

  it.each(accounts)(
    "turns %s away as invalid and opens no session",
    async (_label, loginName, hash, rol) => {
      mocks.getUsuarioByLogin.mockResolvedValue({
        ...account(false),
        login: loginName,
        hashClave: hash,
        rol,
        activo: false,
      });
      const f = form();
      f.set("login", loginName);

      await expect(loginAction({ error: null }, f)).resolves.toEqual({
        error: "errors.invalid",
      });
      expect(mocks.verifyPassword).not.toHaveBeenCalled();
      expect(mocks.signSession).not.toHaveBeenCalled();
      expect(mocks.setSessionCookie).not.toHaveBeenCalled();
    },
  );

  it.each(accounts)(
    "keeps the hash of %s out of reach of any password",
    async (_label, _loginName, hash) => {
      const { verifyPassword } = await vi.importActual<
        typeof import("@/lib/auth/password")
      >("@/lib/auth/password");

      expect(hash).not.toMatch(/^\$2[aby]\$\d{2}\$.{53}$/);
      for (const attempt of ["temporary-pass", hash, "!".repeat(8)]) {
        expect(await verifyPassword(attempt, hash)).toBe(false);
      }
    },
  );
});

// Characterization pin (FPC: Logout remains reachable). `logoutAction` calls no
// guard today, so these pass immediately; they exist so that adding one (which
// would trap a flagged user, because every guard redirects them) fails loudly.
describe("logoutAction while flagged (FPC)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const forbidden = (name: string) => () => {
      throw new Error(`${name} must not run on logout`);
    };
    mocks.requireUser.mockImplementation(forbidden("requireUser"));
    mocks.requireRole.mockImplementation(forbidden("requireRole"));
    mocks.requireUserAllowingPasswordChange.mockImplementation(
      forbidden("requireUserAllowingPasswordChange"),
    );
    mocks.verifyPassword.mockResolvedValue(true);
  });

  afterEach(() => {
    mocks.requireUser.mockReset();
    mocks.requireRole.mockReset();
    mocks.requireUserAllowingPasswordChange.mockReset();
  });

  it("clears the session cookie and sends the user to login without any guard", async () => {
    await expect(logoutAction()).rejects.toThrow("REDIRECT:/login");

    expect(mocks.clearSessionCookie).toHaveBeenCalledTimes(1);
    expect(mocks.requireUser).not.toHaveBeenCalled();
    expect(mocks.requireRole).not.toHaveBeenCalled();
    expect(mocks.requireUserAllowingPasswordChange).not.toHaveBeenCalled();
  });

  it("leaves the flag in place: the next login of the same account is flagged again", async () => {
    // The flag lives in the DB row, which logout never touches.
    mocks.getUsuarioByLogin.mockResolvedValue(account(true));

    await expect(logoutAction()).rejects.toThrow("REDIRECT:/login");
    await login();

    expect(mocks.signSession).toHaveBeenCalledWith(
      expect.objectContaining({ sub: "7", debeCambiarClave: true }),
    );
  });
});
