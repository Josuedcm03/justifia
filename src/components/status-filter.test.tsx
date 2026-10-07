import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import enMessages from "../../i18n/en.json";
import esMessages from "../../i18n/es.json";
import { StatusFilter } from "@/components/status-filter";
import { catalogListHref } from "@/lib/catalog/list-params";
import type { CatalogStatusFilter } from "@/lib/catalog/types";

const LABELS = {
  en: {
    nav: "Filter by status",
    active: "Active",
    inactive: "Inactive",
    all: "All",
  },
  es: {
    nav: "Filtrar por estado",
    active: "Activos",
    inactive: "Inactivos",
    all: "Todos",
  },
} as const;

function renderFilter(
  props: { q?: string; status: CatalogStatusFilter },
  locale: "es" | "en" = "en",
) {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "es" ? esMessages : enMessages}
      onError={(error) => {
        throw error;
      }}
    >
      <StatusFilter
        base="/catalog/asignaturas"
        q={props.q ?? ""}
        status={props.status}
      />
    </NextIntlClientProvider>,
  );
}

const classTokens = (el: HTMLElement) => el.className.split(/\s+/);

describe("StatusFilter (CM-LST-1: Filter; design Decision 8)", () => {
  it.each(["en", "es"] as const)(
    "is a labelled nav with the three links in order, in %s",
    (locale) => {
      renderFilter({ status: "active" }, locale);

      const labels = LABELS[locale];
      const nav = screen.getByRole("navigation", { name: labels.nav });
      const links = within(nav).getAllByRole("link");
      expect(links.map((a) => a.textContent)).toEqual([
        labels.active,
        labels.inactive,
        labels.all,
      ]);
    },
  );

  it("builds every href with catalogListHref, keeping q and leaving the page out", () => {
    renderFilter({ q: "calc", status: "inactive" });

    const hrefs = screen
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual([
      catalogListHref("/catalog/asignaturas", { q: "calc", status: "active" }),
      catalogListHref("/catalog/asignaturas", {
        q: "calc",
        status: "inactive",
      }),
      catalogListHref("/catalog/asignaturas", { q: "calc", status: "all" }),
    ]);
    expect(hrefs).toEqual([
      "/catalog/asignaturas?q=calc",
      "/catalog/asignaturas?q=calc&status=inactive",
      "/catalog/asignaturas?q=calc&status=all",
    ]);
    for (const href of hrefs) expect(href).not.toContain("page=");
  });

  it("omits q from the hrefs when the search is empty", () => {
    renderFilter({ status: "active" });

    expect(
      screen.getAllByRole("link").map((a) => a.getAttribute("href")),
    ).toEqual([
      "/catalog/asignaturas",
      "/catalog/asignaturas?status=inactive",
      "/catalog/asignaturas?status=all",
    ]);
  });

  it.each([
    ["active", "Active"],
    ["inactive", "Inactive"],
    ["all", "All"],
  ] as const)(
    "marks only the selected link (%s) with aria-current and the accent fill, never the you-are-here marker",
    (status, name) => {
      renderFilter({ status });

      for (const link of screen.getAllByRole("link")) {
        const selected = link.textContent === name;
        const tokens = classTokens(link);

        expect(tokens).not.toContain("is-current");
        if (selected) {
          expect(link).toHaveAttribute("aria-current", "true");
          expect(tokens).toContain("bg-accent");
          expect(tokens).toContain("text-accent-foreground");
        } else {
          expect(link).not.toHaveAttribute("aria-current");
          expect(tokens).not.toContain("bg-accent");
          expect(tokens).not.toContain("text-accent-foreground");
        }
      }
    },
  );

  it("gives every link the 44px touch floor", () => {
    renderFilter({ status: "all" });

    for (const link of screen.getAllByRole("link")) {
      expect(classTokens(link)).toContain("h-11");
    }
  });
});
