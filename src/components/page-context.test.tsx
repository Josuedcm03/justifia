import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PageContext } from "@/components/page-context";

import enMessages from "../../i18n/en.json";
import esMessages from "../../i18n/es.json";

const env = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => env.pathname,
}));

beforeEach(() => {
  env.pathname = "/";
});

function renderContext(locale: "es" | "en" = "es") {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "es" ? esMessages : enMessages}
      onError={(error) => {
        throw error;
      }}
    >
      <PageContext />
    </NextIntlClientProvider>,
  );
}

const LABELS = {
  es: {
    trail: "Ubicación de la página",
    dashboard: "Panel",
    newRequest: "Nueva solicitud",
    administration: "Administración",
    asignaturas: "Asignaturas",
    docentes: "Docentes",
    users: "Usuarios",
    profile: "Mi perfil",
  },
  en: {
    trail: "Page location",
    dashboard: "Dashboard",
    newRequest: "New request",
    administration: "Administration",
    asignaturas: "Subjects",
    docentes: "Teachers",
    users: "Users",
    profile: "My profile",
  },
} as const;

type Key = Exclude<keyof (typeof LABELS)["es"], "trail" | "administration">;

// BS-CTX-1 path table: [path, group shown?, entry key, entry is the page,
// href of the entry].
const TRAILS: readonly (readonly [string, boolean, Key, boolean, string])[] = [
  ["/", false, "dashboard", true, "/"],
  ["/users", true, "users", true, "/users"],
  ["/catalog/asignaturas", true, "asignaturas", true, "/catalog/asignaturas"],
  [
    "/catalog/asignaturas/3/edit",
    true,
    "asignaturas",
    false,
    "/catalog/asignaturas",
  ],
  [
    "/catalog/asignaturas/3/grupos/5/edit",
    true,
    "asignaturas",
    false,
    "/catalog/asignaturas",
  ],
  ["/catalog/docentes", true, "docentes", true, "/catalog/docentes"],
  ["/requests/new", false, "newRequest", true, "/requests/new"],
  ["/profile", false, "profile", true, "/profile"],
];

describe("PageContext (BS-CTX-1)", () => {
  describe.each(["es", "en"] as const)("in %s", (locale) => {
    const labels = LABELS[locale];

    it.each(TRAILS)(
      "%s shows the section trail with the sidebar's labels",
      (pathname, hasGroup, key, exact, href) => {
        env.pathname = pathname;
        renderContext(locale);

        const nav = screen.getByRole("navigation", { name: labels.trail });
        const items = within(nav).getAllByRole("listitem");

        expect(items).toHaveLength(hasGroup ? 2 : 1);
        if (hasGroup) {
          expect(items[0]).toHaveTextContent(labels.administration);
        }
        expect(items.at(-1)).toHaveTextContent(labels[key]);

        if (exact) {
          const entry = within(nav).getByText(labels[key]);
          expect(entry).toHaveAttribute("aria-current", "page");
          expect(entry.closest("a")).toBeNull();
        } else {
          const link = within(nav).getByRole("link", { name: labels[key] });
          expect(link).toHaveAttribute("href", href);
          expect(link).not.toHaveAttribute("aria-current");
          expect(nav.querySelector("[aria-current]")).toBeNull();
        }
      },
    );
  });

  it("shows the group as muted text without a link", () => {
    env.pathname = "/users";
    renderContext();

    const nav = screen.getByRole("navigation", {
      name: LABELS.es.trail,
    });
    const group = within(nav).getByText("Administración");

    expect(within(nav).queryAllByRole("link")).toEqual([]);
    expect(group.closest("a")).toBeNull();
    expect(group.closest("li")).toHaveClass("text-muted-foreground");
  });

  it("never shows a record name, code or id", () => {
    env.pathname = "/catalog/asignaturas/12345/grupos/987/edit";
    renderContext();

    const nav = screen.getByRole("navigation", { name: LABELS.es.trail });

    expect(nav.textContent).toBe("AdministraciónAsignaturas");
    expect(nav.innerHTML).not.toContain("12345");
    expect(nav.innerHTML).not.toContain("987");
  });

  it.each(["/nope", "/catalog", "/users-archive"])(
    "renders no trail for the unknown route %s",
    (pathname) => {
      env.pathname = pathname;
      const { container } = renderContext();

      expect(container).toBeEmptyDOMElement();
      expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    },
  );

  it("is context, not a heading: it adds no heading", () => {
    env.pathname = "/users";
    renderContext();

    expect(screen.queryAllByRole("heading")).toEqual([]);
  });

  it("shows only the entry below md: the group is hidden until md, the entry never", () => {
    env.pathname = "/users";
    renderContext();

    const nav = screen.getByRole("navigation", { name: LABELS.es.trail });
    const [group, entry] = within(nav).getAllByRole("listitem", {
      hidden: true,
    });

    expect(group).toHaveClass("hidden", "md:flex");
    expect(entry).not.toHaveClass("hidden");
  });

  it("takes neither the sidebar bar nor the breadcrumb underline", () => {
    env.pathname = "/catalog/asignaturas/3/edit";
    const { container } = renderContext();

    expect(container.innerHTML).not.toContain("shadow-[inset");
    expect(container.innerHTML).not.toContain("is-current");
    expect(container.querySelector("[data-active]")).toBeNull();
  });

  it("is a labelled landmark distinct from the sidebar's own", () => {
    env.pathname = "/users";
    renderContext();

    const label = screen
      .getByRole("navigation")
      .getAttribute("aria-label") as string;

    expect(label).toBe(LABELS.es.trail);
    expect(label).not.toBe(esMessages.nav.sectionLabel);
  });

  it("traps no focus: below an entry the single link is tabbed into and out of", async () => {
    const user = userEvent.setup();
    env.pathname = "/users/new";
    renderContext();

    const nav = screen.getByRole("navigation", { name: LABELS.es.trail });
    const link = within(nav).getByRole("link", { name: "Usuarios" });

    expect(nav.querySelectorAll("a, button, [tabindex]")).toHaveLength(1);

    await user.tab();
    expect(link).toHaveFocus();

    await user.tab();
    expect(link).not.toHaveFocus();
    expect(nav).not.toContainElement(document.activeElement as HTMLElement);
  });

  it("gives the link back to the list a 44px target", () => {
    env.pathname = "/catalog/docentes/9/edit";
    renderContext();

    expect(screen.getByRole("link", { name: "Docentes" })).toHaveClass(
      "min-h-11",
    );
  });
});
