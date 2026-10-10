import { render, screen } from "@testing-library/react";
import { createTranslator } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "../../../../i18n/en.json";
import esMessages from "../../../../i18n/es.json";

const state = vi.hoisted(() => ({ locale: "en" as "en" | "es" }));

// The real catalogs, resolved by next-intl's own translator; a missing key
// throws instead of rendering its path.
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) =>
    createTranslator({
      locale: state.locale,
      messages: state.locale === "es" ? esMessages : enMessages,
      namespace: namespace as "catalog.shared.notFound",
      onError: (error: Error) => {
        throw error;
      },
    }),
}));

import NotFound from "@/app/(dashboard)/catalog/not-found";

const COPY = {
  en: {
    title: "This record is not available",
    back: "Back to the dashboard",
  },
  es: {
    title: "Este registro no está disponible",
    back: "Volver al panel",
  },
} as const;

describe("catalog not-found (CM-SCOPE-1: Foreign record by id is not revealed; CM-NFR-3)", () => {
  beforeEach(() => {
    state.locale = "en";
  });

  it.each(["en", "es"] as const)(
    "renders one h1, an explanation and one way back to / in %s",
    async (locale) => {
      state.locale = locale;

      render(await NotFound());

      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading).toHaveTextContent(COPY[locale].title);
      expect(screen.getAllByRole("heading")).toHaveLength(1);

      const links = screen.getAllByRole("link");
      expect(links).toHaveLength(1);
      expect(links[0]).toHaveAttribute("href", "/");
      expect(links[0]).toHaveAccessibleName(COPY[locale].back);

      // The explanation is a paragraph of its own, not the heading again.
      const explanation = document.querySelector("p");
      expect(explanation?.textContent?.trim()).not.toBe("");
    },
  );

  it("gives the way-back control the 44px touch floor", async () => {
    render(await NotFound());

    expect(
      screen.getByRole("link", { name: COPY.en.back }).className.split(/\s+/),
    ).toContain("h-11");
  });

  it("takes no props, so a missing and a foreign record cannot render differently", async () => {
    expect(NotFound.length).toBe(0);

    const first = render(await NotFound());
    const firstHtml = first.container.innerHTML;
    first.unmount();
    const second = render(await NotFound());

    expect(second.container.innerHTML).toBe(firstHtml);
  });

  it("states that the record is not available without saying why", async () => {
    const { container } = render(await NotFound());

    const text = container.textContent ?? "";
    expect(text).toMatch(/not available/i);
    expect(text).not.toMatch(
      /forbidden|denied|permission|another career|carrera/i,
    );
  });
});
