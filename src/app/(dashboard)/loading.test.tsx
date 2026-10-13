import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import enMessages from "../../../i18n/en.json";
import esMessages from "../../../i18n/es.json";
import DashboardLoading from "./loading";

function renderLoading(locale: "es" | "en" = "es") {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "es" ? esMessages : enMessages}
      onError={(error) => {
        throw error;
      }}
    >
      <DashboardLoading />
    </NextIntlClientProvider>,
  );
}

describe("(dashboard) loading boundary (BS-LOAD-1)", () => {
  it("is a synchronous component, so the skeleton shows without awaiting", () => {
    // An async server component returns a promise; this one must return JSX.
    expect(DashboardLoading.constructor.name).not.toBe("AsyncFunction");
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

  it("draws the page frame: title bar, one context line, then a table card of five rows", () => {
    const { container } = renderLoading();

    const title = container.querySelector('[data-slot="loading-title"]');
    const context = container.querySelector('[data-slot="loading-context"]');
    const card = container.querySelector('[data-slot="table-card"]');
    const rows = container.querySelectorAll('[data-slot="loading-row"]');

    expect(title).not.toBeNull();
    expect(context).not.toBeNull();
    expect(card).not.toBeNull();
    expect(rows).toHaveLength(5);
    for (const row of rows) expect(card!.contains(row)).toBe(true);
    expect(
      title!.compareDocumentPosition(context!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      context!.compareDocumentPosition(card!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("is built from the Skeleton primitive", () => {
    const { container } = renderLoading();

    // Title, context line and three blocks per row.
    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length,
    ).toBeGreaterThanOrEqual(2 + 5);
  });

  it("pulses only when the user has not asked for reduced motion", () => {
    const { container } = renderLoading();
    const blocks = [...container.querySelectorAll('[data-slot="skeleton"]')];

    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      const classes = block.className.split(/\s+/);
      expect(classes).toContain("motion-safe:animate-pulse");
      expect(classes).not.toContain("animate-pulse");
    }
  });

  it("adds no heading, so the page that replaces it keeps its single h1", () => {
    renderLoading();

    expect(screen.queryAllByRole("heading")).toHaveLength(0);
  });

  it("keeps the shell out of it: no navigation or main landmark of its own", () => {
    renderLoading();

    // The layout owns the single `main`; the boundary renders inside it.
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByRole("main")).not.toBeInTheDocument();
  });
});
