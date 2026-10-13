import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import type { RolUsuario } from "@/lib/validations/auth";

import enMessages from "../../i18n/en.json";
import esMessages from "../../i18n/es.json";

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

// What the two mocked hooks answer; each test sets what it needs.
const env = vi.hoisted(() => ({
  pathname: "/",
  locale: "es" as "es" | "en",
}));

// Labels are resolved from the real catalogs, so a key missing from either
// locale shows up here as a missing label instead of passing silently.
vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => {
    const catalog = (env.locale === "es" ? esMessages : enMessages) as Record<
      string,
      Record<string, unknown> | undefined
    >;
    return catalog[namespace]?.[key] as string | undefined;
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => env.pathname,
}));

beforeEach(() => {
  env.pathname = "/";
  env.locale = "es";
});

const ALL_ROLES: readonly RolUsuario[] = [
  "estudiante",
  "docente",
  "coordinacion",
  "secretaria",
  "administrador",
];

// The "you are here" bar: 4px of primary on the leading edge
// (docs/design-system.md §2.3).
const CURRENT_MARKER =
  "data-active:shadow-[inset_4px_0_0_0_var(--sidebar-primary)]";

function sidebarTree(rol: RolUsuario) {
  return (
    <SidebarProvider>
      <AppSidebar rol={rol} />
    </SidebarProvider>
  );
}

function renderSidebar(rol: RolUsuario) {
  return render(sidebarTree(rol));
}

function queryTrigger(name = "Administración") {
  return screen.queryByRole("button", { name });
}

function getTrigger(name = "Administración") {
  return screen.getByRole("button", { name });
}

/** The sub-list the trigger controls, resolved through `aria-controls`. */
function getGroupList() {
  const id = getTrigger().getAttribute("aria-controls");
  expect(id).toBeTruthy();

  const list = document.getElementById(id as string);
  expect(list).not.toBeNull();

  return list as HTMLElement;
}

/** Hrefs of the group's children in DOM order, collapsed or not. */
function groupHrefs() {
  return within(getGroupList())
    .getAllByRole("link", { hidden: true })
    .map((link) => link.getAttribute("href"));
}

/** Label of each top-level entry (a link, or the group trigger), in order. */
function topLevelLabels() {
  const menu = document.querySelector('[data-sidebar="menu"]');
  expect(menu).not.toBeNull();

  return Array.from((menu as Element).querySelectorAll(":scope > li")).map(
    (item) => item.firstElementChild?.textContent,
  );
}

describe("AppSidebar", () => {
  it.each(ALL_ROLES)("shows dashboard and settings for %s", (rol) => {
    renderSidebar(rol);

    expect(screen.getByRole("link", { name: "Panel" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "Configuración" })).toHaveAttribute(
      "href",
      "/settings",
    );
  });

  it.each([
    ["administrador", ["/catalog/asignaturas", "/catalog/docentes", "/users"]],
    ["coordinacion", ["/catalog/asignaturas", "/catalog/docentes", "/users"]],
    [
      "secretaria",
      [
        "/catalog/asignaturas",
        "/catalog/docentes",
        "/catalog/import",
        "/users",
      ],
    ],
  ] as const)(
    "shows the Administración group to %s with exactly its permitted children, in order",
    (rol, hrefs) => {
      renderSidebar(rol);

      expect(groupHrefs()).toEqual(hrefs);
    },
  );

  it.each(["docente", "estudiante"] as const)(
    "renders no Administración group at all for %s",
    (rol) => {
      renderSidebar(rol);

      expect(queryTrigger()).not.toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(
        document.querySelector('[data-sidebar="menu-sub"]'),
      ).not.toBeInTheDocument();
      expect(topLevelLabels()).toEqual(
        rol === "estudiante"
          ? ["Panel", "Nueva solicitud", "Configuración"]
          : ["Panel", "Configuración"],
      );
    },
  );

  it.each(["administrador", "coordinacion"] as const)(
    "orders the top level Panel, Administración, Configuración for %s",
    (rol) => {
      renderSidebar(rol);

      expect(topLevelLabels()).toEqual([
        "Panel",
        "Administración",
        "Configuración",
      ]);
    },
  );

  it("orders the top level Panel, Revisión de solicitudes, Administración, Configuración for secretaria", () => {
    renderSidebar("secretaria");

    expect(topLevelLabels()).toEqual([
      "Panel",
      "Revisión de solicitudes",
      "Administración",
      "Configuración",
    ]);
  });

  it.each([
    [
      "administrador",
      ["/", "/catalog/asignaturas", "/catalog/docentes", "/users", "/settings"],
    ],
    [
      "coordinacion",
      ["/", "/catalog/asignaturas", "/catalog/docentes", "/users", "/settings"],
    ],
    [
      "secretaria",
      [
        "/",
        "/review",
        "/catalog/asignaturas",
        "/catalog/docentes",
        "/catalog/import",
        "/users",
        "/settings",
      ],
    ],
    ["docente", ["/", "/settings"]],
    ["estudiante", ["/", "/requests/new", "/settings"]],
  ] as const)("offers exactly the permitted links to %s", (rol, hrefs) => {
    renderSidebar(rol);

    expect(
      screen
        .getAllByRole("link", { hidden: true })
        .map((link) => link.getAttribute("href")),
    ).toEqual(hrefs);
  });

  it("keeps Usuarios and the import link out of the top level", () => {
    renderSidebar("secretaria");

    const menu = document.querySelector('[data-sidebar="menu"]') as Element;
    const topLevelHrefs = Array.from(
      menu.querySelectorAll(":scope > li > a"),
    ).map((link) => link.getAttribute("href"));

    expect(topLevelHrefs).toEqual(["/", "/review", "/settings"]);
  });
});

describe("AppSidebar new request item (justification-intake, canFileRequests)", () => {
  it("offers estudiante a top-level link to the intake flow", () => {
    renderSidebar("estudiante");

    expect(
      screen.getByRole("link", { name: "Nueva solicitud" }),
    ).toHaveAttribute("href", "/requests/new");
  });

  it.each(["docente", "coordinacion", "secretaria", "administrador"] as const)(
    "hides it from %s",
    (rol) => {
      renderSidebar(rol);

      expect(
        screen.queryByRole("link", { name: "Nueva solicitud" }),
      ).not.toBeInTheDocument();
    },
  );

  it("marks it current inside the flow and labels it in English", () => {
    env.pathname = "/requests/new";
    env.locale = "en";
    renderSidebar("estudiante");

    expect(screen.getByRole("link", { name: "New request" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

describe("AppSidebar catalog import item (CEI: Only secretaria may import)", () => {
  it("shows the import item, linked to the import page, for secretaria", () => {
    renderSidebar("secretaria");

    expect(
      within(getGroupList()).getByRole("link", {
        name: "Carga de catálogo",
        hidden: true,
      }),
    ).toHaveAttribute("href", "/catalog/import");
  });

  it.each(["administrador", "coordinacion", "docente", "estudiante"] as const)(
    "hides the import item for %s",
    (rol) => {
      renderSidebar(rol);

      expect(screen.queryByText("Carga de catálogo")).not.toBeInTheDocument();
      expect(
        document.querySelector('a[href="/catalog/import"]'),
      ).not.toBeInTheDocument();
    },
  );
});

describe("AppSidebar Asignaturas item (CM-NAV-1)", () => {
  it.each(["administrador", "coordinacion", "secretaria"] as const)(
    "links Asignaturas to its own list page for %s",
    (rol) => {
      renderSidebar(rol);

      expect(
        within(getGroupList()).getByRole("link", {
          name: "Asignaturas",
          hidden: true,
        }),
      ).toHaveAttribute("href", "/catalog/asignaturas");
    },
  );

  it.each(["docente", "estudiante"] as const)(
    "hides Asignaturas for %s",
    (rol) => {
      renderSidebar(rol);

      expect(screen.queryByText("Asignaturas")).not.toBeInTheDocument();
      expect(
        document.querySelector('a[href="/catalog/asignaturas"]'),
      ).not.toBeInTheDocument();
    },
  );

  it("never claims the bare /catalog path", () => {
    renderSidebar("secretaria");

    expect(
      document.querySelector('a[href="/catalog"]'),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["/catalog/import", "Carga de catálogo"],
    ["/catalog/asignaturas", "Asignaturas"],
    ["/catalog/asignaturas/12/edit", "Asignaturas"],
    ["/catalog/asignaturas/3/grupos/new", "Asignaturas"],
    ["/catalog/asignaturas/3/grupos/5/edit", "Asignaturas"],
    ["/catalog/docentes", "Docentes"],
  ])(
    "marks exactly one item current on %s, and it is %s",
    (pathname, current) => {
      env.pathname = pathname;
      renderSidebar("secretaria");

      const marked = document.querySelectorAll("[aria-current]");

      expect(marked).toHaveLength(1);
      expect(marked[0]).toHaveTextContent(current);
    },
  );
});

describe("AppSidebar has no Grupos destination (CM-NAV-1)", () => {
  it.each(["administrador", "coordinacion", "secretaria"] as const)(
    "offers %s exactly Asignaturas and Docentes among the catalog pages",
    (rol) => {
      renderSidebar(rol);

      const catalogHrefs = groupHrefs().filter(
        (href) => href?.startsWith("/catalog/") && href !== "/catalog/import",
      );

      expect(catalogHrefs).toEqual([
        "/catalog/asignaturas",
        "/catalog/docentes",
      ]);
    },
  );

  it.each(["administrador", "coordinacion", "secretaria"] as const)(
    "renders no Grupos entry and no link to /catalog/grupos for %s",
    (rol) => {
      renderSidebar(rol);

      expect(screen.queryByText("Grupos")).not.toBeInTheDocument();
      expect(
        document.querySelector('a[href^="/catalog/grupos"]'),
      ).not.toBeInTheDocument();
    },
  );

  it.each(["es", "en"] as const)(
    "does not draw a Groups label in %s",
    (locale) => {
      env.locale = locale;
      renderSidebar("secretaria");

      expect(screen.queryByText("Grupos")).not.toBeInTheDocument();
      expect(screen.queryByText("Groups")).not.toBeInTheDocument();
    },
  );

  // Characterization of the prefix rule (no code change): cannot be RED. It
  // was proved by narrowing isCurrent to an exact match, which failed both
  // cases, and restoring it.
  it.each([
    "/catalog/asignaturas/3/grupos/new",
    "/catalog/asignaturas/3/grupos/5/edit",
  ])("marks only Asignaturas current on %s", (pathname) => {
    env.pathname = pathname;
    renderSidebar("secretaria");

    const link = screen.getByRole("link", { name: "Asignaturas" });

    expect(document.querySelectorAll("[aria-current]")).toHaveLength(1);
    expect(link).toHaveAttribute("aria-current", "page");
    expect(link).toHaveAttribute("data-active");
    expect(link).toHaveClass(CURRENT_MARKER);
    expect(screen.getByRole("link", { name: "Docentes" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});

describe("AppSidebar Docentes item (CM-NAV-1)", () => {
  it.each(["administrador", "coordinacion", "secretaria"] as const)(
    "links Docentes to its own list page for %s",
    (rol) => {
      renderSidebar(rol);

      expect(
        within(getGroupList()).getByRole("link", {
          name: "Docentes",
          hidden: true,
        }),
      ).toHaveAttribute("href", "/catalog/docentes");
    },
  );

  it.each(["docente", "estudiante"] as const)(
    "hides Docentes for %s",
    (rol) => {
      renderSidebar(rol);

      expect(screen.queryByText("Docentes")).not.toBeInTheDocument();
      expect(
        document.querySelector('a[href="/catalog/docentes"]'),
      ).not.toBeInTheDocument();
    },
  );

  it("marks Docentes with aria-current and the primary bar on its page", () => {
    env.pathname = "/catalog/docentes";
    renderSidebar("coordinacion");

    const link = screen.getByRole("link", { name: "Docentes" });

    expect(link).toHaveAttribute("aria-current", "page");
    expect(link).toHaveAttribute("data-active");
    expect(link).toHaveClass(CURRENT_MARKER);
  });

  it.each([
    "/catalog/asignaturas/3/grupos/new",
    "/catalog/asignaturas",
    "/users",
  ])("does not mark Docentes current on %s", (pathname) => {
    env.pathname = pathname;
    renderSidebar("secretaria");

    expect(screen.getByRole("link", { name: "Docentes" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("opens the group when landing on the Docentes route", () => {
    env.pathname = "/catalog/docentes";
    renderSidebar("administrador");

    expect(getTrigger()).toHaveAttribute("aria-expanded", "true");
  });

  it.each([
    ["es", "Docentes"],
    ["en", "Teachers"],
  ] as const)("takes the %s label from the catalog", (locale, label) => {
    env.locale = locale;
    env.pathname = "/catalog/docentes";
    renderSidebar("secretaria");

    expect(screen.getByRole("link", { name: label })).toHaveAttribute(
      "href",
      "/catalog/docentes",
    );
  });
});

describe("AppSidebar Administración group trigger", () => {
  it("is a real button, not a navigation target", () => {
    renderSidebar("secretaria");

    const trigger = getTrigger();

    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger).not.toHaveAttribute("href");
    expect(trigger.closest("a")).toBeNull();
  });

  it("points aria-controls at the list holding its children", () => {
    renderSidebar("secretaria");

    const list = getGroupList();

    expect(list.tagName).toBe("UL");
    expect(list).toHaveAttribute("data-sidebar", "menu-sub");
  });

  it("is closed by default on a page outside the group", () => {
    renderSidebar("secretaria");

    expect(getTrigger()).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("link", { name: "Usuarios" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Carga de catálogo" }),
    ).not.toBeInTheDocument();
  });

  it.each(["/users", "/users/new", "/catalog/import"])(
    "is open by default on %s",
    (pathname) => {
      env.pathname = pathname;
      renderSidebar("secretaria");

      expect(getTrigger()).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByRole("link", { name: "Usuarios" })).toBeVisible();
      expect(
        screen.getByRole("link", { name: "Carga de catálogo" }),
      ).toBeVisible();
    },
  );

  it("does not treat a look-alike path as inside the group", () => {
    env.pathname = "/users-archive";
    renderSidebar("secretaria");

    expect(getTrigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("toggles on click and takes collapsed children out of the accessibility tree", async () => {
    const user = userEvent.setup();
    renderSidebar("secretaria");

    await user.click(getTrigger());

    expect(getTrigger()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Usuarios" })).toBeVisible();

    await user.click(getTrigger());

    expect(getTrigger()).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("link", { name: "Usuarios" }),
    ).not.toBeInTheDocument();
    expect(getGroupList()).not.toBeVisible();
  });

  it.each([["{Enter}"], [" "]])(
    "toggles from the keyboard with %j",
    async (key) => {
      const user = userEvent.setup();
      renderSidebar("secretaria");

      getTrigger().focus();
      await user.keyboard(key);

      expect(getTrigger()).toHaveAttribute("aria-expanded", "true");

      await user.keyboard(key);

      expect(getTrigger()).toHaveAttribute("aria-expanded", "false");
    },
  );

  it("keeps collapsed children out of the tab order and reaches them once open", async () => {
    const user = userEvent.setup();
    renderSidebar("secretaria");

    getTrigger().focus();
    await user.tab();

    expect(screen.getByRole("link", { name: "Configuración" })).toHaveFocus();

    await user.click(getTrigger());
    await user.tab();

    expect(screen.getByRole("link", { name: "Asignaturas" })).toHaveFocus();

    await user.tab();

    expect(screen.getByRole("link", { name: "Docentes" })).toHaveFocus();

    await user.tab();

    expect(
      screen.getByRole("link", { name: "Carga de catálogo" }),
    ).toHaveFocus();
  });

  it("opens when navigation lands on a child route", () => {
    const { rerender } = renderSidebar("secretaria");

    expect(getTrigger()).toHaveAttribute("aria-expanded", "false");

    env.pathname = "/users";
    rerender(sidebarTree("secretaria"));

    expect(getTrigger()).toHaveAttribute("aria-expanded", "true");
  });

  it("stays as the user left it while the route does not change", async () => {
    const user = userEvent.setup();
    env.pathname = "/users";
    const { rerender } = renderSidebar("secretaria");

    await user.click(getTrigger());
    rerender(sidebarTree("secretaria"));

    expect(getTrigger()).toHaveAttribute("aria-expanded", "false");
  });
});

describe("AppSidebar 'you are here' marker", () => {
  it.each([
    ["/users", "Usuarios", "Carga de catálogo"],
    ["/users/new", "Usuarios", "Carga de catálogo"],
    ["/catalog/import", "Carga de catálogo", "Usuarios"],
  ])(
    "marks the active child on %s with aria-current and the primary bar",
    (pathname, active, inactive) => {
      env.pathname = pathname;
      renderSidebar("secretaria");

      const activeLink = screen.getByRole("link", { name: active });
      const inactiveLink = screen.getByRole("link", { name: inactive });

      expect(activeLink).toHaveAttribute("aria-current", "page");
      expect(activeLink).toHaveAttribute("data-active");
      expect(activeLink).toHaveClass(CURRENT_MARKER);

      expect(inactiveLink).not.toHaveAttribute("aria-current");
      expect(inactiveLink).not.toHaveAttribute("data-active");
    },
  );

  it("still marks the top-level items", () => {
    renderSidebar("secretaria");

    const dashboard = screen.getByRole("link", { name: "Panel" });

    expect(dashboard).toHaveAttribute("aria-current", "page");
    expect(dashboard).toHaveAttribute("data-active");
    expect(dashboard).toHaveClass(CURRENT_MARKER);
    expect(
      screen.getByRole("link", { name: "Configuración" }),
    ).not.toHaveAttribute("aria-current");
  });

  it.each(["/", "/users", "/catalog/import"])(
    "never gives the trigger aria-current or the primary bar (on %s)",
    async (pathname) => {
      const user = userEvent.setup();
      env.pathname = pathname;
      renderSidebar("secretaria");

      for (let toggles = 0; toggles < 2; toggles += 1) {
        expect(getTrigger()).not.toHaveAttribute("aria-current");
        expect(getTrigger().className).not.toContain("shadow-[inset");

        await user.click(getTrigger());
      }
    },
  );

  it("hints that the current page is inside only while the group is collapsed", async () => {
    const user = userEvent.setup();
    env.pathname = "/users";
    renderSidebar("secretaria");

    // Open: the active child carries the signal, the trigger stays quiet.
    expect(getTrigger()).not.toHaveAttribute("data-active");

    await user.click(getTrigger());

    expect(getTrigger()).toHaveAttribute("data-active");
    expect(getTrigger().className).not.toContain("shadow-[inset");
  });

  it("does not hint on a collapsed group that holds no current page", () => {
    renderSidebar("secretaria");

    expect(getTrigger()).not.toHaveAttribute("data-active");
  });
});

describe("AppSidebar copy (both locales)", () => {
  it.each([
    [
      "es",
      {
        dashboard: "Panel",
        review: "Revisión de solicitudes",
        group: "Administración",
        catalogImport: "Carga de catálogo",
        users: "Usuarios",
        settings: "Configuración",
      },
    ],
    [
      "en",
      {
        dashboard: "Dashboard",
        review: "Review requests",
        group: "Administration",
        catalogImport: "Catalog import",
        users: "Users",
        settings: "Settings",
      },
    ],
  ] as const)("takes every label from the %s catalog", (locale, labels) => {
    env.locale = locale;
    env.pathname = "/users";
    renderSidebar("secretaria");

    expect(topLevelLabels()).toEqual([
      labels.dashboard,
      labels.review,
      labels.group,
      labels.settings,
    ]);
    expect(getTrigger(labels.group)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: labels.catalogImport }),
    ).toHaveAttribute("href", "/catalog/import");
    expect(screen.getByRole("link", { name: labels.users })).toHaveAttribute(
      "href",
      "/users",
    );
  });
});

describe("AppSidebar review entry (secretary-review 4.1)", () => {
  it("shows the review queue to secretaria, linked to /review, after the dashboard", () => {
    renderSidebar("secretaria");

    expect(
      screen.getByRole("link", { name: "Revisión de solicitudes" }),
    ).toHaveAttribute("href", "/review");
    expect(topLevelLabels().slice(0, 2)).toEqual([
      "Panel",
      "Revisión de solicitudes",
    ]);
  });

  it.each(["estudiante", "docente", "coordinacion", "administrador"] as const)(
    "hides the review entry from %s",
    (rol) => {
      renderSidebar(rol);

      expect(
        screen.queryByRole("link", { name: "Revisión de solicitudes" }),
      ).not.toBeInTheDocument();
    },
  );

  it("marks the entry current on a request detail", () => {
    env.pathname = "/review/42";
    renderSidebar("secretaria");

    expect(
      screen.getByRole("link", { name: "Revisión de solicitudes" }),
    ).toHaveAttribute("aria-current", "page");
  });
});
