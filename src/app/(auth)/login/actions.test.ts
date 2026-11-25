import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  setSessionCookie: vi.fn(),
  clearSessionCookie: vi.fn(),
  signSession: vi.fn(async () => "signed-token"),
  verifyPassword: vi.fn(),
  findLoginAccount: vi.fn(),
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
  findLoginAccount: mocks.findLoginAccount,
}));
vi.mock("@/lib/auth/dal", () => ({
  requireUser: mocks.requireUser,
  requireRole: mocks.requireRole,
  requireUserAllowingPasswordChange: mocks.requireUserAllowingPasswordChange,
}));

import { loginAction, logoutAction } from "@/app/(auth)/login/actions";
import { DUMMY_PASSWORD_HASH } from "@/lib/auth/dummy-hash";
import {
  CANCELLED_HASH,
  SYSTEM_HASH,
  SYSTEM_LOGIN,
  cancelledLogin,
} from "@/lib/retention/policy";
import { messages } from "@/test/intl";

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

function form(identifier = "maria", password = "temporary-pass") {
  const f = new FormData();
  f.set("login", identifier);
  f.set("password", password);
  return f;
}

async function login() {
  await expect(loginAction({ error: null }, form())).rejects.toThrow(
    /^REDIRECT:/,
  );
}

// Every failed sign-in answers with this one value (FE-23).
const GENERIC = { error: "errors.invalid" };

function expectNoSession() {
  expect(mocks.signSession).not.toHaveBeenCalled();
  expect(mocks.setSessionCookie).not.toHaveBeenCalled();
  expect(mocks.redirect).not.toHaveBeenCalled();
}

describe("loginAction session payload (FPC)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyPassword.mockResolvedValue(true);
  });

  it("puts debeCambiarClave: true in the session of a flagged account", async () => {
    mocks.findLoginAccount.mockResolvedValue(account(true));

    await login();

    expect(mocks.signSession).toHaveBeenCalledWith(
      expect.objectContaining({ sub: "7", debeCambiarClave: true }),
    );
    expect(mocks.setSessionCookie).toHaveBeenCalledWith("signed-token", false);
  });

  it("puts debeCambiarClave: false in the session of a normal account", async () => {
    mocks.findLoginAccount.mockResolvedValue(account(false));

    await login();

    expect(mocks.signSession).toHaveBeenCalledWith(
      expect.objectContaining({ sub: "7", debeCambiarClave: false }),
    );
  });

  it("redirects to / when the next target starts with a backslash (AEA-3)", async () => {
    mocks.findLoginAccount.mockResolvedValue(account(false));
    const f = form();
    f.set("next", "/\\evil.com");

    await expect(loginAction({ error: null }, f)).rejects.toThrow(
      /^REDIRECT:\/$/,
    );
    expect(mocks.redirect).toHaveBeenCalledWith("/");
  });

  it("redirects to a safe next target (AEA-3)", async () => {
    mocks.findLoginAccount.mockResolvedValue(account(false));
    const f = form();
    f.set("next", "/requests");

    await expect(loginAction({ error: null }, f)).rejects.toThrow(
      "REDIRECT:/requests",
    );
  });

  it("calls no guard, so the login screen is reachable while signed out", async () => {
    mocks.findLoginAccount.mockResolvedValue(account(true));

    await login();

    expect(mocks.requireUser).not.toHaveBeenCalled();
    expect(mocks.requireRole).not.toHaveBeenCalled();
    expect(mocks.requireUserAllowingPasswordChange).not.toHaveBeenCalled();
  });
});

// FE-21, FE-22: the typed identifier goes to findLoginAccount, trimmed by the
// schema and otherwise as typed; the classification (email or CIF, case,
// spaces and hyphens) is the data layer's, pinned in `users.test.ts`.
describe("loginAction identifier resolution (FE-21, FE-22)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyPassword.mockResolvedValue(true);
  });

  const student = {
    ...account(false),
    id: 11,
    login: "student-login",
    rol: "estudiante" as const,
  };

  it.each([
    ["a student's CIF", "26001234", "26001234", student],
    ["a CIF with spaces and hyphens", "  26-00 1234 ", "26-00 1234", student],
    [
      "a mixed-case email with surrounding spaces, a student",
      "  Ana.Perez@UNI.edu ",
      "Ana.Perez@UNI.edu",
      student,
    ],
    [
      "a mixed-case email with surrounding spaces, staff",
      "  Ana.Perez@UNI.edu ",
      "Ana.Perez@UNI.edu",
      account(false),
    ],
  ])(
    "signs in with %s",
    async (_label, typed, reachesLookup, resolvedAccount) => {
      mocks.findLoginAccount.mockResolvedValue(resolvedAccount);

      await expect(loginAction({ error: null }, form(typed))).rejects.toThrow(
        /^REDIRECT:/,
      );

      expect(mocks.findLoginAccount).toHaveBeenCalledTimes(1);
      expect(mocks.findLoginAccount).toHaveBeenCalledWith(reachesLookup);
      expect(mocks.verifyPassword).toHaveBeenCalledWith(
        "temporary-pass",
        resolvedAccount.hashClave,
      );
      expect(mocks.signSession).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: String(resolvedAccount.id),
          login: resolvedAccount.login,
          rol: resolvedAccount.rol,
        }),
      );
      expect(mocks.setSessionCookie).toHaveBeenCalledWith(
        "signed-token",
        false,
      );
    },
  );

  it("accepts an identifier of exactly 160 characters", async () => {
    mocks.findLoginAccount.mockResolvedValue(account(false));
    const exact = "b".repeat(160);

    await expect(loginAction({ error: null }, form(exact))).rejects.toThrow(
      /^REDIRECT:/,
    );
    expect(mocks.findLoginAccount).toHaveBeenCalledWith(exact);
  });
});

// FE-23: one message and one response shape for every cause, no session and no
// cookie. Whatever the cause, nothing in the answer tells the cases apart.
describe("loginAction failures are generic (FE-23)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyPassword.mockResolvedValue(true);
  });

  // findLoginAccount answers null for an unknown identifier, for two accounts
  // that share the email and for a staff account typed with a CIF-shaped value.
  const lookups = [
    ["an unknown identifier", null],
    ["an ambiguous email", null],
    ["a staff account typed with a CIF-shaped value", null],
    ["an inactive account", { ...account(false), activo: false }],
  ] as const;

  it.each(lookups)(
    "answers %s with the generic error and opens no session",
    async (_label, found) => {
      mocks.findLoginAccount.mockResolvedValue(found);

      await expect(loginAction({ error: null }, form())).resolves.toEqual(
        GENERIC,
      );
      expectNoSession();
    },
  );

  it("answers a wrong password with the generic error and opens no session", async () => {
    mocks.findLoginAccount.mockResolvedValue(account(false));
    mocks.verifyPassword.mockResolvedValue(false);

    await expect(loginAction({ error: null }, form())).resolves.toEqual(
      GENERIC,
    );
    expectNoSession();
  });

  // D13: no rate limiter exists, so an unknown identifier still pays one
  // password check, against a constant hash of the cost hashPassword uses.
  it("still verifies the password against the dummy hash for an unknown identifier", async () => {
    mocks.findLoginAccount.mockResolvedValue(null);
    mocks.verifyPassword.mockResolvedValue(true);

    await expect(
      loginAction({ error: null }, form("nobody@uni.edu", "typed-password")),
    ).resolves.toEqual(GENERIC);

    expect(mocks.verifyPassword).toHaveBeenCalledTimes(1);
    expect(mocks.verifyPassword).toHaveBeenCalledWith(
      "typed-password",
      DUMMY_PASSWORD_HASH,
    );
    expectNoSession();
  });

  // The same holds for an inactive account: answering it before any password
  // check would tell it apart by the time of the answer. Its own hash is never
  // used, so not even the right password changes the outcome.
  it.each([true, false])(
    "pays one check against the dummy hash, and never its own, for an inactive account (verifier says %s)",
    async (accepted) => {
      mocks.findLoginAccount.mockResolvedValue({
        ...account(false),
        activo: false,
      });
      mocks.verifyPassword.mockResolvedValue(accepted);

      await expect(
        loginAction({ error: null }, form("maria@uni.edu", "typed-password")),
      ).resolves.toEqual(GENERIC);

      expect(mocks.verifyPassword).toHaveBeenCalledTimes(1);
      expect(mocks.verifyPassword).toHaveBeenCalledWith(
        "typed-password",
        DUMMY_PASSWORD_HASH,
      );
      expectNoSession();
    },
  );

  it("checks a known account against its own hash and not the dummy one", async () => {
    mocks.findLoginAccount.mockResolvedValue(account(false));
    mocks.verifyPassword.mockResolvedValue(false);

    await loginAction({ error: null }, form("maria@uni.edu", "typed-password"));

    expect(mocks.verifyPassword).toHaveBeenCalledTimes(1);
    expect(mocks.verifyPassword).toHaveBeenCalledWith(
      "typed-password",
      "$2b$12$hash",
    );
  });

  const unreadable = [
    ["an empty identifier", "", "temporary-pass"],
    ["an identifier of only spaces", "   ", "temporary-pass"],
    ["an identifier of 161 characters", "c".repeat(161), "temporary-pass"],
    ["a password of 3 characters", "maria@uni.edu", "abc"],
    ["a password of 7 characters", "maria@uni.edu", "1234567"],
  ] as const;

  it.each(unreadable)(
    "answers %s with the generic error and reads no account",
    async (_label, identifier, password) => {
      await expect(
        loginAction({ error: null }, form(identifier, password)),
      ).resolves.toEqual(GENERIC);

      expect(mocks.findLoginAccount).not.toHaveBeenCalled();
      expect(mocks.verifyPassword).not.toHaveBeenCalled();
      expectNoSession();
    },
  );

  it("answers a form without the fields with the generic error", async () => {
    await expect(loginAction({ error: null }, new FormData())).resolves.toEqual(
      GENERIC,
    );

    expect(mocks.findLoginAccount).not.toHaveBeenCalled();
    expectNoSession();
  });

  it("gives the same answer for every cause", async () => {
    const answers: unknown[] = [];
    const causes: [string, () => void][] = [
      ["unknown", () => mocks.findLoginAccount.mockResolvedValue(null)],
      [
        "inactive",
        () =>
          mocks.findLoginAccount.mockResolvedValue({
            ...account(false),
            activo: false,
          }),
      ],
      [
        "wrong password",
        () => {
          mocks.findLoginAccount.mockResolvedValue(account(false));
          mocks.verifyPassword.mockResolvedValue(false);
        },
      ],
    ];
    for (const [, arrange] of causes) {
      vi.clearAllMocks();
      mocks.verifyPassword.mockResolvedValue(true);
      arrange();
      answers.push(await loginAction({ error: null }, form()));
    }

    expect(new Set(answers.map((a) => JSON.stringify(a))).size).toBe(1);
    expect(answers[0]).toEqual(GENERIC);
  });
});

// The exact copy of the generic message, pinned here because no auth messages
// test exists. The sign-in page is a "usted" screen (owner resolution 1).
describe("generic sign-in message wording (FE-23)", () => {
  const es = messages.es.auth.errors.invalid;
  const en = messages.en.auth.errors.invalid;

  it("is the exact Spanish line", () => {
    expect(es).toBe(
      "Los datos de acceso no son correctos. Revise su CIF o correo y su contraseña.",
    );
  });

  it("is the exact English line", () => {
    expect(en).toBe(
      "The sign-in details are not correct. Check your CIF or email and your password.",
    );
  });

  it.each([
    ["es", es],
    ["en", en],
  ])("does not reveal what was wrong in %s", (_locale, text) => {
    for (const word of [
      "usuario",
      "user",
      "no existe",
      "inactiv",
      "inactive",
    ]) {
      expect(text.toLowerCase()).not.toContain(word);
    }
    // It names both parts together, so neither one is singled out as the fault.
    expect(text).toMatch(/CIF/);
    expect(text.toLowerCase()).toMatch(/contraseña|password/);
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
      mocks.findLoginAccount.mockResolvedValue({
        ...account(false),
        login: loginName,
        hashClave: hash,
        rol,
        activo: false,
      });
      const f = form(loginName);

      await expect(loginAction({ error: null }, f)).resolves.toEqual({
        error: "errors.invalid",
      });
      // One check against the dummy hash (FE-23) and never against its own.
      expect(mocks.verifyPassword.mock.calls).toEqual([
        [f.get("password"), DUMMY_PASSWORD_HASH],
      ]);
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
    mocks.findLoginAccount.mockResolvedValue(account(true));

    await expect(logoutAction()).rejects.toThrow("REDIRECT:/login");
    await login();

    expect(mocks.signSession).toHaveBeenCalledWith(
      expect.objectContaining({ sub: "7", debeCambiarClave: true }),
    );
  });
});

// FE-32 (UX-22): the box "Mantener la sesión iniciada" decides the duration of
// the session, and nothing else about the sign-in changes.
describe("loginAction keep the session signed in (FE-32)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyPassword.mockResolvedValue(true);
  });

  function keepForm(value: string | null = "on", identifier = "maria") {
    const f = form(identifier);
    if (value !== null) f.set("mantener", value);
    return f;
  }

  it("signs with the claim and sets the 30-day cookie when the box is checked", async () => {
    mocks.findLoginAccount.mockResolvedValue(account(false));

    await expect(loginAction({ error: null }, keepForm())).rejects.toThrow(
      /^REDIRECT:/,
    );

    expect(mocks.signSession).toHaveBeenCalledWith({
      sub: "7",
      login: "maria",
      rol: "secretaria",
      nombre: "Maria Perez",
      debeCambiarClave: false,
      mantenerSesion: true,
    });
    expect(mocks.setSessionCookie).toHaveBeenCalledWith("signed-token", true);
  });

  it("gives today's payload, with no claim key, and the 8-hour cookie when the box is absent", async () => {
    mocks.findLoginAccount.mockResolvedValue(account(false));

    await expect(loginAction({ error: null }, keepForm(null))).rejects.toThrow(
      /^REDIRECT:/,
    );

    const payload = signedPayload() as Record<string, unknown>;
    expect(payload).toEqual({
      sub: "7",
      login: "maria",
      rol: "secretaria",
      nombre: "Maria Perez",
      debeCambiarClave: false,
    });
    expect(payload).not.toHaveProperty("mantenerSesion");
    expect(mocks.setSessionCookie).toHaveBeenCalledWith("signed-token", false);
  });

  // A native checkbox posts "on"; any other value is not the box.
  it.each(["", "off", "true", "1", "ON", "yes"])(
    "reads the value %j as an unchecked box",
    async (value) => {
      mocks.findLoginAccount.mockResolvedValue(account(false));

      await expect(
        loginAction({ error: null }, keepForm(value)),
      ).rejects.toThrow(/^REDIRECT:/);

      expect(signedPayload()).not.toHaveProperty("mantenerSesion");
      expect(mocks.setSessionCookie).toHaveBeenCalledWith(
        "signed-token",
        false,
      );
    },
  );

  it.each([
    ["an unknown identifier", () => null],
    ["an inactive account", () => ({ ...account(false), activo: false })],
  ])(
    "signs nothing and sets no cookie for %s with the box checked",
    async (_label, lookup) => {
      mocks.findLoginAccount.mockResolvedValue(lookup());

      await expect(loginAction({ error: null }, keepForm())).resolves.toEqual(
        GENERIC,
      );

      expectNoSession();
    },
  );

  it("signs nothing and sets no cookie for a wrong password with the box checked", async () => {
    mocks.findLoginAccount.mockResolvedValue(account(false));
    mocks.verifyPassword.mockResolvedValue(false);

    await expect(loginAction({ error: null }, keepForm())).resolves.toEqual(
      GENERIC,
    );

    expectNoSession();
  });

  it("carries both the flag and the claim for a flagged account with the box checked", async () => {
    mocks.findLoginAccount.mockResolvedValue(account(true));

    await expect(loginAction({ error: null }, keepForm())).rejects.toThrow(
      /^REDIRECT:/,
    );

    expect(mocks.signSession).toHaveBeenCalledWith(
      expect.objectContaining({ debeCambiarClave: true, mantenerSesion: true }),
    );
    expect(mocks.setSessionCookie).toHaveBeenCalledWith("signed-token", true);
  });

  it("keeps the safe next redirect with the box checked", async () => {
    mocks.findLoginAccount.mockResolvedValue(account(false));
    const f = keepForm();
    f.set("next", "/requests");

    await expect(loginAction({ error: null }, f)).rejects.toThrow(
      "REDIRECT:/requests",
    );

    const bad = keepForm();
    bad.set("next", "//evil.com");
    await expect(loginAction({ error: null }, bad)).rejects.toThrow(
      "REDIRECT:/",
    );
  });

  // Pass at write: sign-out clears the cookie whatever the box said.
  it("clears the session cookie on sign-out after a kept sign-in", async () => {
    mocks.findLoginAccount.mockResolvedValue(account(false));
    await expect(loginAction({ error: null }, keepForm())).rejects.toThrow(
      /^REDIRECT:/,
    );

    await expect(logoutAction()).rejects.toThrow("REDIRECT:/login");

    expect(mocks.clearSessionCookie).toHaveBeenCalledTimes(1);
  });
});

/** The claims of the first signed session (the mock has no typed parameters). */
function signedPayload() {
  return (mocks.signSession.mock.calls as unknown[][])[0][0] as Record<
    string,
    unknown
  >;
}
