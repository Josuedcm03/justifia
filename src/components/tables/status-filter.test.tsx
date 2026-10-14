import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StatusFilter } from "@/components/tables/status-filter";
import type { StatusFilterValue } from "@/lib/list-params";
import {
  listNavigation,
  resetListNavigation,
} from "@/test/list-navigation-mock";
import { messages, renderWithIntl } from "@/test/intl";
import { resetNavigationMock, router } from "@/test/navigation-mock";

vi.mock(
  "@/components/tables/list-navigation",
  async () => (await import("@/test/list-navigation-mock")).module,
);
vi.mock(
  "next/link",
  async () => (await import("@/test/navigation-mock")).linkModule,
);

beforeEach(() => {
  resetListNavigation();
  resetNavigationMock();
});

// The caller owns the URL shape; the filter only receives finished hrefs.
const hrefFor = (value: StatusFilterValue) =>
  value === "all" ? "/users" : `/users?status=${value}`;

function renderFilter(
  selected: StatusFilterValue = "all",
  locale: "es" | "en" = "en",
) {
  renderWithIntl(
    <StatusFilter selected={selected} hrefFor={hrefFor} />,
    locale,
  );
}

describe("StatusFilter (DT-TOOL-1, DT-NAV-1)", () => {
  it("renders three real links with the hrefs the caller built", () => {
    renderFilter();
    const t = messages.en.tables.filter;

    expect(screen.getAllByRole("link")).toHaveLength(3);
    expect(screen.getByRole("link", { name: t.active })).toHaveAttribute(
      "href",
      "/users?status=active",
    );
    expect(screen.getByRole("link", { name: t.inactive })).toHaveAttribute(
      "href",
      "/users?status=inactive",
    );
    expect(screen.getByRole("link", { name: t.all })).toHaveAttribute(
      "href",
      "/users",
    );
  });

  it.each([
    ["active", "Active"],
    ["inactive", "Inactive"],
    ["all", "All"],
  ] as const)("marks only %s as current", (selected, name) => {
    renderFilter(selected);

    const current = screen
      .getAllByRole("link")
      .filter((link) => link.hasAttribute("aria-current"));

    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAccessibleName(name);
    expect(current[0]).toHaveAttribute("aria-current", "true");
  });

  it("labels the group for assistive technology", () => {
    renderFilter();

    expect(
      screen.getByRole("group", { name: messages.en.tables.filter.label }),
    ).toContainElement(screen.getByRole("link", { name: "Active" }));
  });

  it("speaks Spanish when the locale is es", () => {
    renderFilter("active", "es");

    expect(
      screen.getByRole("group", { name: "Filtrar por estado" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Activos" })).toBeVisible();
  });

  it("pushes through the shared navigation and cancels the default", async () => {
    renderFilter("all");

    await userEvent.click(screen.getByRole("link", { name: "Inactive" }));

    expect(listNavigation.navigate).toHaveBeenCalledExactlyOnceWith(
      "/users?status=inactive",
      "push",
    );
    // `onNavigate` cancelled the link's own client navigation.
    expect(router.push).not.toHaveBeenCalled();
  });

  it("reports a different option with its own href", async () => {
    renderFilter("inactive");

    await userEvent.click(screen.getByRole("link", { name: "All" }));

    expect(listNavigation.navigate).toHaveBeenCalledExactlyOnceWith(
      "/users",
      "push",
    );
  });

  it("leaves modifier-key clicks to the browser", () => {
    renderFilter();
    const link = screen.getByRole("link", { name: "Active" });

    fireEvent.click(link, { ctrlKey: true });
    fireEvent.click(link, { metaKey: true });
    fireEvent.click(link, { shiftKey: true });

    expect(listNavigation.navigate).not.toHaveBeenCalled();
  });

  it("does not scroll to the top", () => {
    renderFilter();

    for (const link of screen.getAllByRole("link")) {
      expect(link).toHaveAttribute("data-scroll", "false");
    }
  });

  it("gives every option a 44px target that wraps on narrow widths", () => {
    renderFilter();

    for (const link of screen.getAllByRole("link")) {
      expect(link).toHaveClass("h-11");
      expect(link.className).not.toMatch(/(^|\s)w-/);
      expect(link.className).not.toMatch(/transition-all/);
    }
    expect(screen.getByRole("group")).toHaveClass("flex-wrap");
  });
});
