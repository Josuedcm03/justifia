import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((target: string) => {
    throw new Error(`REDIRECT:${target}`);
  }),
  getTranslations: vi.fn(async () => (key: string) => key),
  setSessionCookie: vi.fn(),
  signSession: vi.fn(async () => "signed-token"),
  verifyPassword: vi.fn(),
  hashPassword: vi.fn(async () => "$2b$12$brand-new-hash"),
  getUsuarioByLogin: vi.fn(),
  updateClaveAndClearFlag: vi.fn(),
  requireUser: vi.fn(),
  requireRole: vi.fn(),
  requireUserAllowingPasswordChange: vi.fn(),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: mocks.getTranslations,
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth/cookies", () => ({
  setSessionCookie: mocks.setSessionCookie,
}));
vi.mock("@/lib/auth/password", () => ({
  verifyPassword: mocks.verifyPassword,
  hashPassword: mocks.hashPassword,
}));
vi.mock("@/lib/auth/session", () => ({ signSession: mocks.signSession }));
vi.mock("@/lib/data/users", () => ({
  getUsuarioByLogin: mocks.getUsuarioByLogin,
  updateClaveAndClearFlag: mocks.updateClaveAndClearFlag,
}));
vi.mock("@/lib/auth/dal", () => ({
  requireUser: mocks.requireUser,
  requireRole: mocks.requireRole,
  requireUserAllowingPasswordChange: mocks.requireUserAllowingPasswordChange,
}));

import { changePasswordAction } from "@/app/change-password/actions";

const TEMP = "Temp-password-1";
const NEXT = "Brand-new-pass-9";
const STORED_HASH = "$2b$12$stored-temporary-hash";

// What `verifySession` hands back: the claims plus the JWT's own iat/exp.
const flaggedSession = {
  sub: "7",
  login: "maria",
  rol: "secretaria" as const,
  nombre: "Maria Perez",
  debeCambiarClave: true,
  iat: 1_700_000_000,
  exp: 1_700_028_800,
};

const storedAccount = {
  id: 7,
  login: "maria",
  hashClave: STORED_HASH,
  nombreCompleto: "Maria Perez",
  rol: "secretaria" as const,
  activo: true,
  debeCambiarClave: true,
};

function form(
  overrides: Record<string, string> = {},
  extra: Record<string, string> = {},
) {
  const f = new FormData();
  const fields = {
    currentPassword: TEMP,
    newPassword: NEXT,
    confirmPassword: NEXT,
    ...overrides,
  };
  for (const [k, v] of Object.entries({ ...fields, ...extra })) f.set(k, v);
  return f;
}

const initial = { error: null };

async function expectNoSideEffects() {
  expect(mocks.updateClaveAndClearFlag).not.toHaveBeenCalled();
  expect(mocks.signSession).not.toHaveBeenCalled();
  expect(mocks.setSessionCookie).not.toHaveBeenCalled();
  expect(mocks.redirect).not.toHaveBeenCalled();
}

describe("changePasswordAction (FPC)", () => {
  let logSpies: ReturnType<typeof vi.spyOn>[];

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUserAllowingPasswordChange.mockResolvedValue(flaggedSession);
    mocks.getUsuarioByLogin.mockResolvedValue(storedAccount);
    mocks.verifyPassword.mockResolvedValue(true);
    mocks.updateClaveAndClearFlag.mockResolvedValue(undefined);
    logSpies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
  });

  afterEach(() => {
    logSpies.forEach((s) => s.mockRestore());
  });

  describe("guard", () => {
    it("runs requireUserAllowingPasswordChange before anything else", async () => {
      await expect(changePasswordAction(initial, form())).rejects.toThrow(
        /^REDIRECT:/,
      );

      const guardOrder =
        mocks.requireUserAllowingPasswordChange.mock.invocationCallOrder[0];
      expect(guardOrder).toBeLessThan(
        mocks.getTranslations.mock.invocationCallOrder[0],
      );
      expect(guardOrder).toBeLessThan(
        mocks.getUsuarioByLogin.mock.invocationCallOrder[0],
      );
    });

    it("never calls requireUser or requireRole (a flagged user must get through)", async () => {
      await expect(changePasswordAction(initial, form())).rejects.toThrow(
        /^REDIRECT:/,
      );

      expect(mocks.requireUser).not.toHaveBeenCalled();
      expect(mocks.requireRole).not.toHaveBeenCalled();
    });

    it("does not mention requireUser or requireRole in its source", () => {
      const source = fs.readFileSync(
        path.resolve(process.cwd(), "src/app/change-password/actions.ts"),
        "utf8",
      );

      expect(source).toMatch(/requireUserAllowingPasswordChange/);
      expect(source).not.toMatch(/\brequireUser\b/);
      expect(source).not.toMatch(/\brequireRole\b/);
    });

    it("sends an anonymous caller to login and touches nothing else", async () => {
      mocks.requireUserAllowingPasswordChange.mockImplementation(async () => {
        mocks.redirect("/login");
      });

      await expect(changePasswordAction(initial, form())).rejects.toThrow(
        "REDIRECT:/login",
      );

      expect(mocks.getUsuarioByLogin).not.toHaveBeenCalled();
      expect(mocks.verifyPassword).not.toHaveBeenCalled();
      expect(mocks.hashPassword).not.toHaveBeenCalled();
      expect(mocks.updateClaveAndClearFlag).not.toHaveBeenCalled();
      expect(mocks.setSessionCookie).not.toHaveBeenCalled();
    });
  });

  describe("successful change", () => {
    it("verifies the current password against the stored hash of the session's own account", async () => {
      await expect(changePasswordAction(initial, form())).rejects.toThrow(
        /^REDIRECT:/,
      );

      expect(mocks.getUsuarioByLogin).toHaveBeenCalledWith("maria");
      expect(mocks.verifyPassword).toHaveBeenCalledWith(TEMP, STORED_HASH);
    });

    it("hashes the new password with the project helper and writes it for the session's id", async () => {
      await expect(changePasswordAction(initial, form())).rejects.toThrow(
        /^REDIRECT:/,
      );

      expect(mocks.hashPassword).toHaveBeenCalledWith(NEXT);
      expect(mocks.updateClaveAndClearFlag).toHaveBeenCalledTimes(1);
      expect(mocks.updateClaveAndClearFlag).toHaveBeenCalledWith(
        7,
        "$2b$12$brand-new-hash",
      );
    });

    it("re-issues the session cookie with debeCambiarClave false (Session refreshed after change)", async () => {
      await expect(changePasswordAction(initial, form())).rejects.toThrow(
        /^REDIRECT:/,
      );

      // Exactly the identity claims plus the cleared flag: the old iat/exp must
      // not be carried into the new token.
      expect(mocks.signSession).toHaveBeenCalledTimes(1);
      expect(mocks.signSession).toHaveBeenCalledWith({
        sub: "7",
        login: "maria",
        rol: "secretaria",
        nombre: "Maria Perez",
        debeCambiarClave: false,
      });
      expect(mocks.setSessionCookie).toHaveBeenCalledTimes(1);
      expect(mocks.setSessionCookie).toHaveBeenCalledWith("signed-token");
    });

    it("updates the row first, then re-signs, then sets the cookie, then redirects to the dashboard", async () => {
      await expect(changePasswordAction(initial, form())).rejects.toThrow(
        "REDIRECT:/",
      );

      const order = (fn: { mock: { invocationCallOrder: number[] } }) =>
        fn.mock.invocationCallOrder[0];
      expect(order(mocks.updateClaveAndClearFlag)).toBeLessThan(
        order(mocks.signSession),
      );
      expect(order(mocks.signSession)).toBeLessThan(
        order(mocks.setSessionCookie),
      );
      expect(order(mocks.setSessionCookie)).toBeLessThan(order(mocks.redirect));
      expect(mocks.redirect).toHaveBeenCalledWith("/");
    });

    it("takes the account from the session, never from the form", async () => {
      const forged = form(
        {},
        { id: "999", sub: "999", login: "intruder", rol: "administrador" },
      );

      await expect(changePasswordAction(initial, forged)).rejects.toThrow(
        /^REDIRECT:/,
      );

      expect(mocks.getUsuarioByLogin).toHaveBeenCalledWith("maria");
      expect(mocks.updateClaveAndClearFlag).toHaveBeenCalledWith(
        7,
        expect.any(String),
      );
      expect(mocks.signSession).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: "7",
          login: "maria",
          rol: "secretaria",
        }),
      );
    });

    it("permits a voluntary change by a user whose flag is already false", async () => {
      mocks.requireUserAllowingPasswordChange.mockResolvedValue({
        ...flaggedSession,
        debeCambiarClave: false,
      });

      await expect(changePasswordAction(initial, form())).rejects.toThrow(
        "REDIRECT:/",
      );

      expect(mocks.updateClaveAndClearFlag).toHaveBeenCalledWith(
        7,
        "$2b$12$brand-new-hash",
      );
    });
  });

  describe("failure paths leave the account and the cookie untouched", () => {
    it("rejects a wrong current password", async () => {
      mocks.verifyPassword.mockResolvedValue(false);

      const state = await changePasswordAction(initial, form());

      expect(state).toEqual({ error: "errors.wrongCurrent" });
      expect(mocks.hashPassword).not.toHaveBeenCalled();
      await expectNoSideEffects();
    });

    it.each([
      [
        "a weak new password",
        { newPassword: "short", confirmPassword: "short" },
        "errors.weak",
      ],
      [
        "a mismatched confirmation",
        { confirmPassword: "Something-else-1" },
        "errors.mismatch",
      ],
      [
        "a new password equal to the temporary one",
        { newPassword: TEMP, confirmPassword: TEMP },
        "errors.sameAsCurrent",
      ],
      ["an empty current password", { currentPassword: "" }, "errors.invalid"],
    ])(
      "rejects %s without verifying or writing",
      async (_name, overrides, key) => {
        const state = await changePasswordAction(initial, form(overrides));

        expect(state).toEqual({ error: key });
        expect(mocks.getUsuarioByLogin).not.toHaveBeenCalled();
        expect(mocks.verifyPassword).not.toHaveBeenCalled();
        expect(mocks.hashPassword).not.toHaveBeenCalled();
        await expectNoSideEffects();
      },
    );

    it("rejects a submission with missing fields", async () => {
      const state = await changePasswordAction(initial, new FormData());

      expect(state.error).not.toBeNull();
      await expectNoSideEffects();
    });

    it("returns an error and keeps the old cookie when the data update throws", async () => {
      mocks.updateClaveAndClearFlag.mockRejectedValue(new Error("db down"));

      const state = await changePasswordAction(initial, form());

      expect(state).toEqual({ error: "errors.unexpected" });
      expect(mocks.signSession).not.toHaveBeenCalled();
      expect(mocks.setSessionCookie).not.toHaveBeenCalled();
      expect(mocks.redirect).not.toHaveBeenCalled();
    });

    it("rejects when the session's account no longer exists", async () => {
      mocks.getUsuarioByLogin.mockResolvedValue(null);

      const state = await changePasswordAction(initial, form());

      expect(state).toEqual({ error: "errors.unexpected" });
      expect(mocks.verifyPassword).not.toHaveBeenCalled();
      await expectNoSideEffects();
    });

    it("rejects an inactive account", async () => {
      mocks.getUsuarioByLogin.mockResolvedValue({
        ...storedAccount,
        activo: false,
      });

      const state = await changePasswordAction(initial, form());

      expect(state).toEqual({ error: "errors.unexpected" });
      await expectNoSideEffects();
    });

    it("rejects when the stored account is not the session's account", async () => {
      mocks.getUsuarioByLogin.mockResolvedValue({ ...storedAccount, id: 8 });

      const state = await changePasswordAction(initial, form());

      expect(state).toEqual({ error: "errors.unexpected" });
      expect(mocks.verifyPassword).not.toHaveBeenCalled();
      await expectNoSideEffects();
    });
  });

  describe("no credential leaves the action", () => {
    it("never returns a password or hash in the action state", async () => {
      mocks.verifyPassword.mockResolvedValue(false);
      const wrong = await changePasswordAction(initial, form());
      mocks.verifyPassword.mockResolvedValue(true);
      mocks.updateClaveAndClearFlag.mockRejectedValue(new Error("db down"));
      const failed = await changePasswordAction(initial, form());

      for (const state of [wrong, failed]) {
        const serialized = JSON.stringify(state);
        for (const secret of [TEMP, NEXT, STORED_HASH, "brand-new-hash"]) {
          expect(serialized).not.toContain(secret);
        }
      }
    });

    it("logs nothing on success or on any failure path", async () => {
      await expect(changePasswordAction(initial, form())).rejects.toThrow(
        /^REDIRECT:/,
      );
      mocks.verifyPassword.mockResolvedValue(false);
      await changePasswordAction(initial, form());
      mocks.verifyPassword.mockResolvedValue(true);
      mocks.updateClaveAndClearFlag.mockRejectedValue(
        new Error(`db down near ${STORED_HASH}`),
      );
      await changePasswordAction(initial, form());

      for (const spy of logSpies) expect(spy).not.toHaveBeenCalled();
    });
  });
});
