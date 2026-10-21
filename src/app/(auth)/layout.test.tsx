import fs from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "../../../i18n/en.json";
import esMessages from "../../../i18n/es.json";

// RC-12, RF-01 (d): one link in the shared auth layout reaches the privacy
// notice from both the login and the register page, in the same tab.

const { locale } = vi.hoisted(() => ({ locale: { current: "es" } }));

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) => {
    const catalog = (locale.current === "es"
      ? esMessages
      : enMessages) as unknown as Record<string, Record<string, string>>;
    const dict = catalog[namespace] ?? {};
    return (key: string) => dict[key];
  },
}));
vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => <button type="button">theme</button>,
}));

beforeEach(() => {
  locale.current = "es";
});

async function renderLayout() {
  const { default: AuthLayout } = await import("@/app/(auth)/layout");
  return render(await AuthLayout({ children: <p>page body</p> }));
}

describe("(auth) layout privacy link", () => {
  it.each([
    ["es", esMessages.common.privacyNotice],
    ["en", enMessages.common.privacyNotice],
  ] as const)("links to /privacy in the same tab (%s)", async (l, label) => {
    locale.current = l;
    await renderLayout();

    const link = screen.getByRole("link", { name: label });
    expect(link).toHaveAttribute("href", "/privacy");
    expect(link).not.toHaveAttribute("target");
    expect(screen.getByText("page body")).toBeInTheDocument();
  });

  it("sits beside the institution line and keeps the 44 px touch floor", async () => {
    const { container } = await renderLayout();

    const link = screen.getByRole("link", {
      name: esMessages.common.privacyNotice,
    });
    const institution = screen.getByText(esMessages.common.institution);
    expect(link.parentElement).toBe(institution.parentElement);
    expect(link).toHaveClass("min-h-11");
    expect(container.querySelectorAll('a[href="/privacy"]')).toHaveLength(1);
  });

  it("is the layout of both the login and the register page", () => {
    const authDir = path.resolve(process.cwd(), "src/app/(auth)");
    expect(fs.existsSync(path.join(authDir, "layout.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(authDir, "login", "page.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(authDir, "register", "page.tsx"))).toBe(
      true,
    );
    expect(
      fs.existsSync(path.join(authDir, "login", "layout.tsx")) ||
        fs.existsSync(path.join(authDir, "register", "layout.tsx")),
    ).toBe(false);
  });
});
