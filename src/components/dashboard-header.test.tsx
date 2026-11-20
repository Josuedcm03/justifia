import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  messages,
  sessionFor,
  type Locale,
} from "@/app/(dashboard)/review/test-support";
import { PASSWORD_CHANGE_PATH } from "@/lib/auth/routes";
import { rolesUsuario } from "@/lib/validations/auth";

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({ locale: "es" as Locale }));

vi.mock("next-intl/server", async () =>
  (await import("@/app/(dashboard)/review/test-support")).serverIntl(state),
);
vi.mock("@/i18n/locale", () => ({
  getUserLocale: async () => state.locale,
}));
vi.mock("@/app/(auth)/login/actions", () => ({ logoutAction: vi.fn() }));
// The pieces around the user menu need providers of their own and are not what
// is under test here.
vi.mock("@/components/locale-switcher", () => ({ LocaleSwitcher: () => null }));
vi.mock("@/components/theme-toggle", () => ({ ThemeToggle: () => null }));
vi.mock("@/components/page-context", () => ({ PageContext: () => null }));
vi.mock("@/components/ui/sidebar", () => ({ SidebarTrigger: () => null }));

import { DashboardHeader } from "@/components/dashboard-header";

beforeEach(() => {
  state.locale = "es";
});

async function openMenu(rol: (typeof rolesUsuario)[number] = "estudiante") {
  const user = { ...sessionFor(rol), nombre: "Ana Pérez" };
  render(await DashboardHeader({ user }));
  await userEvent.click(screen.getByRole("button", { name: "Ana Pérez" }));
  return screen.findByRole("menu");
}

// FE-20 (UX-20): the user menu offers the voluntary password change next to the
// profile entry, to every role.
describe("DashboardHeader user menu: change password (FE-20)", () => {
  it.each(rolesUsuario)(
    "offers 'Cambiar contraseña' to %s, pointing to the existing change screen",
    async (rol) => {
      const menu = await openMenu(rol);

      const item = within(menu).getByRole("menuitem", {
        name: "Cambiar contraseña",
      });
      expect(item).toHaveAttribute("href", PASSWORD_CHANGE_PATH);
      expect(PASSWORD_CHANGE_PATH).toBe("/change-password");
    },
  );

  it("says it in English", async () => {
    state.locale = "en";
    const menu = await openMenu();

    expect(
      within(menu).getByRole("menuitem", { name: "Change password" }),
    ).toHaveAttribute("href", "/change-password");
  });

  it("keeps the profile entry and the sign-out, with the new entry between them", async () => {
    const menu = await openMenu();

    const items = within(menu)
      .getAllByRole("menuitem")
      .map((item) => item.textContent);
    expect(items).toEqual([
      "Ver perfil",
      "Cambiar contraseña",
      "Cerrar sesión",
    ]);
    expect(
      within(menu).getByRole("menuitem", { name: "Ver perfil" }),
    ).toHaveAttribute("href", "/profile");
  });

  it("adds no other link and no route of its own", async () => {
    const menu = await openMenu();

    const hrefs = within(menu)
      .getAllByRole("menuitem")
      .map((item) => item.getAttribute("href"))
      .filter((href) => href !== null);
    expect(hrefs).toEqual(["/profile", "/change-password"]);
  });
});

describe("user menu copy (FE-20)", () => {
  it("has the entry in both catalogs, as a label with no verb to conjugate", () => {
    expect(messages.es.auth.userMenu.changePassword).toBe("Cambiar contraseña");
    expect(messages.en.auth.userMenu.changePassword).toBe("Change password");
  });
});
