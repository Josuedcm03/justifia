import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import enMessages from "../../../../i18n/en.json";
import esMessages from "../../../../i18n/es.json";
import HomeLoading from "./loading";

function renderLoading(locale: "es" | "en" = "es") {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "es" ? esMessages : enMessages}
      onError={(error) => {
        throw error;
      }}
    >
      <HomeLoading />
    </NextIntlClientProvider>,
  );
}

describe("home loading boundary (BS-LOAD-1, home shape)", () => {
  it("is a synchronous component, so the skeleton shows without awaiting", () => {
    expect(HomeLoading.constructor.name).not.toBe("AsyncFunction");
  });

  it.each([
    ["es", "Cargando..."],
    ["en", "Loading..."],
  ] as const)(
    "is busy and names itself for assistive technology in %s",
    (locale, label) => {
      const { container } = renderLoading(locale);

      expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
      const status = screen.getByRole("status");
      expect(status).toHaveTextContent(label);
      expect(status).toHaveClass("sr-only");
    },
  );

  it("draws a title bar and a one-line subtitle, then the card grids", () => {
    const { container } = renderLoading();

    const title = container.querySelector('[data-slot="loading-title"]');
    const context = container.querySelector('[data-slot="loading-context"]');
    const grids = container.querySelectorAll('[data-slot="loading-grid"]');

    expect(title).not.toBeNull();
    expect(context).not.toBeNull();
    expect(grids).toHaveLength(2);
    expect(
      title!.compareDocumentPosition(context!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      context!.compareDocumentPosition(grids[0]) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("shows 2 count cards first, then 4 shortcut cards, each with chip, title and sentence", () => {
    const { container } = renderLoading();
    const [counts, shortcuts] = container.querySelectorAll(
      '[data-slot="loading-grid"]',
    );

    expect(counts.querySelectorAll('[data-slot="loading-card"]')).toHaveLength(
      2,
    );
    expect(
      shortcuts.querySelectorAll('[data-slot="loading-card"]'),
    ).toHaveLength(4);
    for (const card of container.querySelectorAll(
      '[data-slot="loading-card"]',
    )) {
      // Icon-chip block, title line and muted sentence line.
      expect(card.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(3);
    }
  });

  it("uses the same responsive grid classes as the real home", () => {
    const { container } = renderLoading();

    for (const grid of container.querySelectorAll(
      '[data-slot="loading-grid"]',
    )) {
      expect(grid).toHaveClass(
        "grid",
        "gap-6",
        "sm:grid-cols-2",
        "lg:grid-cols-3",
      );
      expect(grid.className).not.toMatch(/(^|\s)grid-cols-\d/);
    }
  });

  it("is built from the Skeleton primitive and pulses only with motion allowed", () => {
    const { container } = renderLoading();
    const blocks = [...container.querySelectorAll('[data-slot="skeleton"]')];

    // Three blocks for each of the six cards.
    expect(blocks.length).toBeGreaterThanOrEqual(6 * 3);
    for (const block of blocks) {
      const classes = block.className.split(/\s+/);
      expect(classes).toContain("motion-safe:animate-pulse");
      expect(classes).not.toContain("animate-pulse");
    }
  });

  it("adds no heading and no landmark of its own", () => {
    renderLoading();

    expect(screen.queryAllByRole("heading")).toHaveLength(0);
    expect(screen.queryByRole("main")).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
});
