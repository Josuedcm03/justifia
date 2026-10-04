import fs from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "../../../i18n/en.json";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((target: string) => {
    throw new Error(`REDIRECT:${target}`);
  }),
  requireUser: vi.fn(),
  requireRole: vi.fn(),
  requireUserAllowingPasswordChange: vi.fn(),
  changePasswordAction: vi.fn(),
  logoutAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth/dal", () => ({
  requireUser: mocks.requireUser,
  requireRole: mocks.requireRole,
  requireUserAllowingPasswordChange: mocks.requireUserAllowingPasswordChange,
}));
vi.mock("@/app/change-password/actions", () => ({
  changePasswordAction: mocks.changePasswordAction,
}));
vi.mock("@/app/(auth)/login/actions", () => ({
  logoutAction: mocks.logoutAction,
}));
vi.mock("next-intl/server", () => ({
  // Resolves dotted namespaces ("auth.userMenu") against the real catalog.
  getTranslations: async (namespace: string) => {
    const dict = namespace
      .split(".")
      .reduce<unknown>(
        (node, part) => (node as Record<string, unknown>)?.[part],
        enMessages,
      ) as Record<string, string>;
    return (key: string) => dict[key];
  },
}));

import ChangePasswordPage, {
  generateMetadata,
} from "@/app/change-password/page";

const session = {
  sub: "7",
  login: "maria",
  rol: "secretaria" as const,
  nombre: "Maria Perez",
};

async function renderPage() {
  const ui = await ChangePasswordPage();
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const copy = enMessages.changePassword;

describe("ChangePasswordPage (FPC)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the form for a flagged user of any role, with no redirect", async () => {
    for (const rol of [
      "estudiante",
      "docente",
      "coordinacion",
      "secretaria",
      "administrador",
    ] as const) {
      mocks.requireUserAllowingPasswordChange.mockResolvedValue({
        ...session,
        rol,
        debeCambiarClave: true,
      });

      const { unmount } = await renderPage();

      expect(screen.getByLabelText(copy.currentPasswordLabel)).toBeVisible();
      expect(screen.getByText(copy.subtitleForced)).toBeInTheDocument();
      expect(mocks.redirect).not.toHaveBeenCalled();
      unmount();
    }
  });

  it("lets a non-flagged user open the screen for a voluntary change", async () => {
    mocks.requireUserAllowingPasswordChange.mockResolvedValue({
      ...session,
      debeCambiarClave: false,
    });

    await renderPage();

    expect(screen.getByLabelText(copy.newPasswordLabel)).toBeVisible();
    expect(screen.getByText(copy.subtitle)).toBeInTheDocument();
    expect(screen.queryByText(copy.subtitleForced)).not.toBeInTheDocument();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("treats a session issued before the flag existed as not flagged", async () => {
    mocks.requireUserAllowingPasswordChange.mockResolvedValue(session);

    await renderPage();

    expect(screen.getByText(copy.subtitle)).toBeInTheDocument();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("offers sign out, so a flagged user is never trapped on this screen", async () => {
    mocks.requireUserAllowingPasswordChange.mockResolvedValue({
      ...session,
      debeCambiarClave: true,
    });

    await renderPage();

    const logout = screen.getByRole("button", {
      name: enMessages.auth.userMenu.logout,
    });
    expect(logout).toHaveAttribute("type", "submit");
    expect(logout.closest("form")).not.toBeNull();
    // Its own form: nested forms are invalid HTML.
    expect(logout.closest("form")).not.toContainElement(
      screen.getByLabelText(copy.newPasswordLabel),
    );
  });

  it("sends an anonymous caller to login through the guard", async () => {
    mocks.requireUserAllowingPasswordChange.mockImplementation(async () => {
      mocks.redirect("/login");
    });

    await expect(ChangePasswordPage()).rejects.toThrow("REDIRECT:/login");
  });

  it("calls only the password-change guard, never requireUser or requireRole", async () => {
    mocks.requireUserAllowingPasswordChange.mockResolvedValue({
      ...session,
      debeCambiarClave: true,
    });

    await renderPage();

    expect(mocks.requireUserAllowingPasswordChange).toHaveBeenCalledTimes(1);
    expect(mocks.requireUser).not.toHaveBeenCalled();
    expect(mocks.requireRole).not.toHaveBeenCalled();
  });

  it("exposes a document title through generateMetadata", async () => {
    const metadata = await generateMetadata();

    expect(String(metadata.title)).toContain(copy.title);
  });

  it("cannot loop: the source imports the sibling guard and no redirecting one", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/change-password/page.tsx"),
      "utf8",
    );

    expect(source).toMatch(
      /import\s*\{[^}]*\brequireUserAllowingPasswordChange\b[^}]*\}\s*from\s*"@\/lib\/auth\/dal"/,
    );
    expect(source).not.toMatch(/\brequireUser\b/);
    expect(source).not.toMatch(/\brequireRole\b/);
    expect(source).not.toMatch(/\bredirect\b/);
  });
});
