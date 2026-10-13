import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TablePagination } from "@/components/tables/table-pagination";
import { messages, renderWithIntl } from "@/test/intl";
import {
  listNavigation,
  resetListNavigation,
} from "@/test/list-navigation-mock";
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

type Props = ComponentProps<typeof TablePagination>;

// Fake builders: the component must use them verbatim and never compose a
// URL of its own.
const hrefFor = (page: number) =>
  page === 1 ? "/users?q=ana" : `/users?q=ana&page=${page}`;
const sizeHrefFor = (size: number) =>
  size === 10 ? "/users?q=ana" : `/users?q=ana&size=${size}`;

function renderPagination(
  overrides: Partial<Props> = {},
  locale: "es" | "en" = "en",
) {
  const props: Props = {
    page: 1,
    pageSize: 10,
    total: 25,
    hrefFor,
    sizeHrefFor,
    ...overrides,
  };
  const view = renderWithIntl(<TablePagination {...props} />, locale);
  return { ...view, props };
}

const t = messages.en.tables.pagination;
const CONTROLS = [t.first, t.previous, t.next, t.last] as const;

function state(name: string) {
  const link = screen.queryByRole("link", { name });
  if (link) return { available: true, element: link };
  const span = screen.getByText(name);
  return { available: false, element: span };
}

describe("TablePagination bounds (DT-PAG-1)", () => {
  it.each([
    [1, [false, false, true, true]],
    [2, [true, true, true, true]],
    [3, [true, true, false, false]],
  ] as const)(
    "page %i of 3 makes first, previous, next, last available as %j",
    (page, available) => {
      renderPagination({ page });

      const actual = CONTROLS.map((name) => state(name).available);

      expect(actual).toEqual(available);
    },
  );

  it("exposes an unavailable control as disabled text, not a dead link", () => {
    renderPagination({ page: 1 });

    for (const name of [t.first, t.previous]) {
      const { element } = state(name);
      expect(element.tagName).toBe("SPAN");
      expect(element).toHaveAttribute("aria-disabled", "true");
      expect(element).not.toHaveAttribute("href");
    }
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("links first, previous, next and last to the hrefs the caller built", () => {
    renderPagination({ page: 2 });

    expect(screen.getByRole("link", { name: t.first })).toHaveAttribute(
      "href",
      "/users?q=ana",
    );
    expect(screen.getByRole("link", { name: t.previous })).toHaveAttribute(
      "href",
      "/users?q=ana",
    );
    expect(screen.getByRole("link", { name: t.next })).toHaveAttribute(
      "href",
      "/users?q=ana&page=3",
    );
    expect(screen.getByRole("link", { name: t.last })).toHaveAttribute(
      "href",
      "/users?q=ana&page=3",
    );
  });

  it("targets the last page computed from total and size", () => {
    renderPagination({ page: 1, total: 60, pageSize: 25 });

    expect(screen.getByRole("link", { name: t.last })).toHaveAttribute(
      "href",
      "/users?q=ana&page=3",
    );
  });

  it("marks the page status as the current page and fills the interpolation", () => {
    renderPagination({ page: 2 });

    const status = screen.getByText("Page 2 of 3");
    expect(status).toHaveAttribute("aria-current", "page");
  });

  it("shows the total count in the footer", () => {
    renderPagination({ page: 2, total: 25 });

    expect(screen.getByText("25 results")).toBeVisible();
  });

  it("shows 1 of 1 with every control unavailable for 20 results at size 25", () => {
    renderPagination({ page: 1, total: 20, pageSize: 25 });

    expect(screen.getByText("Page 1 of 1")).toBeVisible();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    for (const name of CONTROLS) {
      expect(state(name).available).toBe(false);
    }
  });

  it("words the controls in Spanish when the locale is es", () => {
    renderPagination({ page: 2 }, "es");

    expect(screen.getByText("Página 2 de 3")).toBeVisible();
    expect(screen.getByRole("link", { name: "Primera" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Última" })).toBeVisible();
    expect(
      screen.getByRole("navigation", { name: "Paginación" }),
    ).toBeVisible();
  });
});

describe("TablePagination navigation (DT-NAV-1)", () => {
  it("pushes through the shared navigation and cancels the default", async () => {
    renderPagination({ page: 2 });

    await userEvent.click(screen.getByRole("link", { name: t.last }));

    expect(listNavigation.navigate).toHaveBeenCalledExactlyOnceWith(
      "/users?q=ana&page=3",
      "push",
    );
    expect(router.push).not.toHaveBeenCalled();
  });

  it("pushes the first page with its own href", async () => {
    renderPagination({ page: 3 });

    await userEvent.click(screen.getByRole("link", { name: t.first }));

    expect(listNavigation.navigate).toHaveBeenCalledExactlyOnceWith(
      "/users?q=ana",
      "push",
    );
  });

  it("leaves modifier-key clicks to the browser and never scrolls", () => {
    renderPagination({ page: 2 });
    const next = screen.getByRole("link", { name: t.next });

    fireEvent.click(next, { ctrlKey: true });
    fireEvent.click(next, { metaKey: true });

    expect(listNavigation.navigate).not.toHaveBeenCalled();
    for (const link of screen.getAllByRole("link")) {
      expect(link).toHaveAttribute("data-scroll", "false");
    }
  });
});

describe("TablePagination page size (DT-PAG-1, DT-URL-2, DT-NAV-1)", () => {
  it("offers exactly 10, 25 and 50 with the current size selected", () => {
    renderPagination({ pageSize: 25 });

    const select = screen.getByRole("combobox", {
      name: messages.en.tables.pageSize.label,
    });
    const options = within(select).getAllByRole("option");

    expect(options.map((option) => option.textContent)).toEqual([
      "10",
      "25",
      "50",
    ]);
    expect(select).toHaveValue("25");
  });

  it("replaces the history entry with the href for the chosen size", async () => {
    renderPagination({ pageSize: 10 });

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: messages.en.tables.pageSize.label }),
      "25",
    );

    expect(listNavigation.navigate).toHaveBeenCalledExactlyOnceWith(
      "/users?q=ana&size=25",
      "replace",
    );
  });

  it("reports 50 with its own href", async () => {
    renderPagination({ pageSize: 25 });

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: messages.en.tables.pageSize.label }),
      "50",
    );

    expect(listNavigation.navigate).toHaveBeenCalledExactlyOnceWith(
      "/users?q=ana&size=50",
      "replace",
    );
  });
});

describe("TablePagination structure (DT-A11Y-1, DT-DENS-1)", () => {
  it("is a labelled navigation landmark", () => {
    renderPagination();

    expect(screen.getByRole("navigation", { name: t.region })).toBeVisible();
  });

  it("gives every control a 44px target and no fixed width", () => {
    renderPagination({ page: 2 });
    const nav = screen.getByRole("navigation");

    const controls = [
      ...within(nav).getAllByRole("link"),
      screen.getByRole("combobox"),
    ];
    for (const control of controls) {
      expect(control).toHaveClass("h-11");
      expect(control.className).not.toMatch(/(^|\s)w-\d/);
    }
    expect(nav).toHaveClass("flex-wrap");
  });

  it("keeps the controls enabled while a navigation is pending", () => {
    listNavigation.pending = true;
    renderPagination({ page: 2 });

    expect(screen.getByRole("combobox")).toBeEnabled();
    expect(screen.getAllByRole("link")).toHaveLength(4);
  });
});
