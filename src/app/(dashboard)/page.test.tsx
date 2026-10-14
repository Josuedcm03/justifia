import { render, screen, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import type { RolUsuario } from "@/lib/validations/auth";

import enMessages from "../../../i18n/en.json";
import esMessages from "../../../i18n/es.json";

const { requireUserMock, getDashboardStatsMock, perms } = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  getDashboardStatsMock: vi.fn(),
  // `catalogOverride` lets a test flip one sidebar predicate to prove the home
  // reads the same one.
  perms: { catalogOverride: null as boolean | null },
}));

vi.mock("@/lib/auth/dal", () => ({ requireUser: requireUserMock }));

vi.mock("@/lib/data/users", () => ({
  getDashboardStats: getDashboardStatsMock,
}));

vi.mock("@/lib/auth/permissions", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/auth/permissions")>();
  return {
    ...actual,
    canManageCatalog: (rol: RolUsuario | undefined) =>
      perms.catalogOverride ?? actual.canManageCatalog(rol),
  };
});

// The page echoes keys, like the other page tests.
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
}));

// The real sidebar reads the real catalogs through this mock (the same shape
// as `app-sidebar.test.tsx`), so a missing label shows up as a missing label.
vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => {
    const catalog = esMessages as Record<
      string,
      Record<string, unknown> | undefined
    >;
    return catalog[namespace]?.[key] as string | undefined;
  },
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

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

beforeEach(() => {
  requireUserMock.mockReset();
  getDashboardStatsMock.mockReset();
  getDashboardStatsMock.mockResolvedValue({
    totalUsuarios: 42,
    usuariosActivos: 17,
    degraded: false,
  });
  perms.catalogOverride = null;
});

function sessionFor(rol: RolUsuario) {
  return { sub: "1", login: "caller", rol, nombre: "Caller" };
}

async function renderHome(rol: RolUsuario) {
  requireUserMock.mockResolvedValue(sessionFor(rol));
  const { default: DashboardPage } = await import("@/app/(dashboard)/page");
  return render(await DashboardPage());
}

function shortcutHrefs() {
  return screen.queryAllByRole("link").map((a) => a.getAttribute("href"));
}

// BS-HOME-1 "Home per role" table.
const HOME_PER_ROLE: readonly (readonly [RolUsuario, string[], boolean])[] = [
  ["estudiante", ["/requests/new"], false],
  ["docente", [], false],
  [
    "administrador",
    ["/catalog/asignaturas", "/catalog/docentes", "/users"],
    true,
  ],
  [
    "coordinacion",
    ["/catalog/asignaturas", "/catalog/docentes", "/users"],
    true,
  ],
  [
    "secretaria",
    ["/catalog/asignaturas", "/catalog/docentes", "/catalog/import", "/users"],
    true,
  ],
];

describe("DashboardPage (BS-HOME-1)", () => {
  beforeAll(async () => {
    // The first dynamic import transforms the whole page tree.
    await import("@/app/(dashboard)/page");
  }, 60_000);

  it.each(HOME_PER_ROLE)(
    "%s sees exactly its shortcut cards, in menu order",
    async (rol, hrefs) => {
      await renderHome(rol);

      expect(shortcutHrefs()).toEqual(hrefs);
    },
  );

  it.each(HOME_PER_ROLE)(
    "%s sees user-count cards only when it may open /users",
    async (rol, _hrefs, showsCounts) => {
      await renderHome(rol);

      if (showsCounts) {
        expect(screen.getByText("totalUsers")).toBeInTheDocument();
        expect(screen.getByText("42")).toBeInTheDocument();
        expect(screen.getByText("activeUsers")).toBeInTheDocument();
        expect(screen.getByText("17")).toBeInTheDocument();
      } else {
        expect(screen.queryByText("totalUsers")).not.toBeInTheDocument();
        expect(screen.queryByText("activeUsers")).not.toBeInTheDocument();
        expect(screen.queryByText("42")).not.toBeInTheDocument();
      }
    },
  );

  it.each([["estudiante"], ["docente"]] as const)(
    "does not perform the stats read for %s",
    async (rol) => {
      await renderHome(rol);

      expect(getDashboardStatsMock).not.toHaveBeenCalled();
    },
  );

  it.each([["administrador"], ["coordinacion"], ["secretaria"]] as const)(
    "performs the stats read once for %s",
    async (rol) => {
      await renderHome(rol);

      expect(getDashboardStatsMock).toHaveBeenCalledTimes(1);
    },
  );

  it("shows one short sentence, no cards and no links, to a docente", async () => {
    await renderHome("docente");

    expect(screen.getByText("empty")).toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it.each([
    "estudiante",
    "administrador",
    "coordinacion",
    "secretaria",
  ] as const)(
    "shows no empty sentence to %s, who has shortcuts",
    async (rol) => {
      await renderHome(rol);

      expect(screen.queryByText("empty")).not.toBeInTheDocument();
    },
  );

  it.each(HOME_PER_ROLE)(
    "%s has exactly one h1 and no card links to /settings or /",
    async (rol) => {
      await renderHome(rol);

      expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
      // The layout owns the single `main`; the page must not add a second.
      expect(screen.queryByRole("main")).not.toBeInTheDocument();
      const hrefs = shortcutHrefs();
      expect(hrefs).not.toContain("/settings");
      expect(hrefs).not.toContain("/");
    },
  );

  it.each(HOME_PER_ROLE)(
    "%s wraps its content in the page frame with exactly one h1",
    async (rol) => {
      await renderHome(rol);

      const frames = document.querySelectorAll('[data-slot="page-frame"]');
      expect(frames).toHaveLength(1);
      const frame = frames[0] as HTMLElement;
      expect(frame).toHaveClass("flex", "flex-col", "gap-8");
      expect(within(frame).getAllByRole("heading", { level: 1 })).toHaveLength(
        1,
      );
      expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    },
  );

  it("gives each shortcut a title, one muted sentence and a hidden icon chip", async () => {
    await renderHome("secretaria");

    const link = screen.getByRole("link", { name: /catalogImport/ });
    expect(within(link).getByText("catalogImport")).toBeInTheDocument();
    const description = within(link).getByText("shortcuts.catalogImport");
    expect(description).toHaveClass("text-muted-foreground");
    expect(link.querySelector("[aria-hidden='true']")).not.toBeNull();
  });

  it("tints a shortcut on hover only (hover-capable pointers)", async () => {
    await renderHome("estudiante");

    const link = screen.getByRole("link");
    expect(link.className).toContain("hover:bg-primary/5");
    expect(link.className.split(/\s+/)).not.toContain("bg-primary/5");
  });

  it("keeps the shortcut grid to one column below sm", async () => {
    await renderHome("secretaria");

    const grid = screen.getByRole("link", { name: /users/ }).parentElement!;
    expect(grid).toHaveClass("grid");
    expect(grid.className).toMatch(/\bsm:grid-cols-2\b/);
    expect(grid.className).not.toMatch(/(^|\s)grid-cols-[2-9]/);
  });

  describe("when the stats read degrades", () => {
    beforeEach(() => {
      getDashboardStatsMock.mockResolvedValue({
        totalUsuarios: 0,
        usuariosActivos: 0,
        degraded: true,
      });
    });

    it.each([["administrador"], ["coordinacion"], ["secretaria"]] as const)(
      "%s sees the degraded alert and no zeros presented as counts",
      async (rol) => {
        await renderHome(rol);

        expect(screen.getByRole("status")).toHaveTextContent("degraded");
        expect(screen.queryByText("totalUsers")).not.toBeInTheDocument();
        expect(screen.queryByText("activeUsers")).not.toBeInTheDocument();
        expect(screen.queryByText("0")).not.toBeInTheDocument();
      },
    );

    it("still shows the shortcut cards beside the alert", async () => {
      await renderHome("administrador");

      expect(shortcutHrefs()).toEqual([
        "/catalog/asignaturas",
        "/catalog/docentes",
        "/users",
      ]);
    });

    it("does not show an alert to a role that never read the stats", async () => {
      await renderHome("estudiante");

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });

  // BS-HOME-1 "Predicates stay in step": the home and the sidebar read the same
  // configuration, so flipping one predicate moves both.
  describe("stays in step with the sidebar", () => {
    function sidebarDestinations() {
      const links = screen.getAllByRole("link", { hidden: true });
      return links
        .map((a) => a.getAttribute("href"))
        .filter((href) => href !== "/" && href !== "/settings");
    }

    async function homeAndSidebar(rol: RolUsuario) {
      const home = await renderHome(rol);
      const homeHrefs = shortcutHrefs();
      home.unmount();

      render(
        <SidebarProvider>
          <AppSidebar rol={rol} nombre="Caller" />
        </SidebarProvider>,
      );
      return { homeHrefs, sidebarHrefs: sidebarDestinations() };
    }

    it.each(HOME_PER_ROLE)(
      "%s: every home shortcut is a sidebar destination and vice versa",
      async (rol) => {
        const { homeHrefs, sidebarHrefs } = await homeAndSidebar(rol);

        expect(homeHrefs.length).toBe(sidebarHrefs.length);
        expect([...homeHrefs].sort()).toEqual([...sidebarHrefs].sort());
      },
    );

    it("hides Asignaturas and Docentes from both when the catalog predicate flips", async () => {
      perms.catalogOverride = false;

      const { homeHrefs, sidebarHrefs } = await homeAndSidebar("secretaria");

      expect(homeHrefs).toEqual(["/catalog/import", "/users"]);
      expect([...sidebarHrefs].sort()).toEqual([...homeHrefs].sort());
    });
  });
});

describe("DashboardPage copy", () => {
  it("is built from the catalogs: every shortcut description exists in both locales", () => {
    for (const messages of [esMessages, enMessages]) {
      const shortcuts = (
        messages as unknown as {
          dashboard: { shortcuts: Record<string, string> };
        }
      ).dashboard.shortcuts;
      for (const key of [
        "newRequest",
        "catalogAsignaturas",
        "catalogDocentes",
        "catalogImport",
        "users",
      ]) {
        expect(shortcuts[key]?.trim()).toBeTruthy();
      }
    }
  });
});
