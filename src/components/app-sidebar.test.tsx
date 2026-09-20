import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import type { RolUsuario } from "@/lib/validations/auth";

// jsdom does not implement matchMedia; the Sidebar's mobile-breakpoint hook
// subscribes to it on mount.
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
});

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

const ALL_ROLES: readonly RolUsuario[] = [
  "estudiante",
  "docente",
  "coordinacion",
  "secretaria",
  "administrador",
];

function renderSidebar(rol: RolUsuario) {
  return render(
    <SidebarProvider>
      <AppSidebar rol={rol} />
    </SidebarProvider>,
  );
}

describe("AppSidebar", () => {
  it.each(ALL_ROLES)("shows dashboard and settings for %s", (rol) => {
    renderSidebar(rol);

    expect(screen.getByText("dashboard")).toBeInTheDocument();
    expect(screen.getByText("settings")).toBeInTheDocument();
  });

  it.each(["administrador", "coordinacion", "secretaria"] as const)(
    "shows the Usuarios item for %s",
    (rol) => {
      renderSidebar(rol);

      expect(screen.getByText("users")).toBeInTheDocument();
    },
  );

  it.each(["docente", "estudiante"] as const)(
    "hides the Usuarios item for %s",
    (rol) => {
      renderSidebar(rol);

      expect(screen.queryByText("users")).not.toBeInTheDocument();
    },
  );
});
