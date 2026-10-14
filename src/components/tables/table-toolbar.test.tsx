import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TableToolbar } from "@/components/tables/table-toolbar";
import { messages, renderWithIntl } from "@/test/intl";
import {
  listNavigation,
  resetListNavigation,
} from "@/test/list-navigation-mock";
import { resetNavigationMock } from "@/test/navigation-mock";

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

type Props = ComponentProps<typeof TableToolbar>;

const field = () => screen.getByRole("searchbox", { name: "Search users" });

// The fake builder drops `page` and keeps another parameter, like the real
// ones do; the toolbar must hand it only the term.
const hrefFor = (q: string) =>
  q
    ? `/users?q=${encodeURIComponent(q)}&status=inactive`
    : "/users?status=inactive";

function baseProps(overrides: Partial<Props> = {}): Props {
  return {
    q: "",
    searchLabel: "Search users",
    searchPlaceholder: "Name, username or email",
    action: "/users",
    hidden: { status: "inactive", sort: "name", dir: "desc" },
    hrefFor,
    total: 25,
    ...overrides,
  };
}

function renderToolbar(
  overrides: Partial<Props> = {},
  locale: "es" | "en" = "en",
) {
  const props = baseProps(overrides);
  const view = renderWithIntl(<TableToolbar {...props} />, locale);
  return { ...view, props };
}

describe("TableToolbar search (DT-TOOL-1, DT-URL-2)", () => {
  it("has a visible label bound to the input", () => {
    renderToolbar();

    const input = field();
    expect(input).toHaveAttribute("name", "q");
    expect(input).toHaveAttribute("type", "search");
    const label = screen.getByText("Search users", { selector: "label" });
    expect(label).toBeVisible();
    expect(label).not.toHaveClass("sr-only");
  });

  it("is a labelled search landmark that submits as a plain GET form", () => {
    renderToolbar();

    const form = screen.getByRole("search", { name: "Search users" });
    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", "/users");
  });

  it("carries the other parameters as hidden fields and never page", () => {
    renderToolbar();
    const form = screen.getByRole("search");

    const hidden = [
      ...form.querySelectorAll<HTMLInputElement>('input[type="hidden"]'),
    ].map((field) => [field.name, field.value]);

    expect(hidden).toEqual([
      ["status", "inactive"],
      ["sort", "name"],
      ["dir", "desc"],
    ]);
    expect(form.querySelector('[name="page"]')).toBeNull();
  });

  it("shows the current term and follows a new one from the URL", () => {
    const { rerender, props } = renderToolbar({ q: "ana" });
    expect(field()).toHaveValue("ana");

    rerender(<TableToolbar {...props} q="beatriz" />);

    expect(field()).toHaveValue("beatriz");
  });

  it("does nothing while the user types", async () => {
    renderToolbar();

    await userEvent.type(field(), "ana");

    expect(listNavigation.navigate).not.toHaveBeenCalled();
  });

  it("submits with Enter as a push to the href the caller built", async () => {
    renderToolbar();

    await userEvent.type(field(), "ana{Enter}");

    expect(listNavigation.navigate).toHaveBeenCalledExactlyOnceWith(
      "/users?q=ana&status=inactive",
      "push",
    );
  });

  it("submits with the button", async () => {
    renderToolbar();

    await userEvent.type(field(), "luis");
    await userEvent.click(
      screen.getByRole("button", { name: messages.en.tables.search.submit }),
    );

    expect(listNavigation.navigate).toHaveBeenCalledExactlyOnceWith(
      "/users?q=luis&status=inactive",
      "push",
    );
  });

  it("trims and collapses the term before building the href", async () => {
    renderToolbar();

    await userEvent.type(field(), "  ana   maria  {Enter}");

    expect(listNavigation.navigate).toHaveBeenCalledExactlyOnceWith(
      "/users?q=ana%20maria&status=inactive",
      "push",
    );
  });

  it("passes a literal percent sign and underscore through untouched (D3)", async () => {
    renderToolbar();

    await userEvent.type(field(), "50%_x{Enter}");

    expect(listNavigation.navigate).toHaveBeenCalledExactlyOnceWith(
      "/users?q=50%25_x&status=inactive",
      "push",
    );
  });

  it("submits an emptied field as the unfiltered href", async () => {
    renderToolbar({ q: "ana" });

    await userEvent.clear(field());
    await userEvent.type(field(), "{Enter}");

    expect(listNavigation.navigate).toHaveBeenCalledExactlyOnceWith(
      "/users?status=inactive",
      "push",
    );
  });

  it("caps what can be typed at the 100 character limit", () => {
    renderToolbar();

    expect(field()).toHaveAttribute("maxlength", "100");
  });
});

describe("TableToolbar count and filter (DT-TOOL-1, DT-PEND-1)", () => {
  it("renders the count in a polite status region", () => {
    renderToolbar({ total: 25 });

    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveTextContent("25 results");
  });

  it.each([
    [0, "No results"],
    [1, "1 result"],
    [25, "25 results"],
  ])("pluralizes the count for %i", (total, text) => {
    renderToolbar({ total });

    expect(screen.getByRole("status")).toHaveTextContent(text);
  });

  it("counts in Spanish when the locale is es", () => {
    renderToolbar({ total: 1 }, "es");

    expect(screen.getByRole("status")).toHaveTextContent("1 resultado");
  });

  it("reads the updating text while pending, then the count again", () => {
    listNavigation.pending = true;
    const { rerender, props } = renderToolbar({ total: 25 });

    const region = screen.getByRole("status");
    expect(region).toHaveTextContent(messages.en.tables.updating);
    expect(region).not.toHaveTextContent("25 results");

    listNavigation.pending = false;
    rerender(<TableToolbar {...props} total={30} />);

    expect(screen.getByRole("status")).toHaveTextContent("30 results");
    expect(screen.getByRole("status")).not.toHaveTextContent(
      messages.en.tables.updating,
    );
  });

  it("keeps the controls enabled while pending", () => {
    listNavigation.pending = true;
    renderToolbar();

    expect(field()).toBeEnabled();
    expect(
      screen.getByRole("button", { name: messages.en.tables.search.submit }),
    ).toBeEnabled();
  });

  it("does not move focus when the count changes", () => {
    const { rerender, props } = renderToolbar({ total: 25 });
    const input = field();
    input.focus();

    rerender(<TableToolbar {...props} total={3} />);

    expect(screen.getByRole("status")).toHaveTextContent("3 results");
    expect(input).toHaveFocus();
  });

  it("renders the status filter next to the search when one is given", () => {
    renderToolbar({
      status: { selected: "inactive", hrefFor: (v) => `/users?status=${v}` },
    });
    const group = screen.getByRole("group", {
      name: messages.en.tables.filter.label,
    });

    expect(
      within(group).getByRole("link", { name: "Inactive" }),
    ).toHaveAttribute("aria-current", "true");
  });

  it("renders no filter group when the list has none", () => {
    renderToolbar();

    expect(
      screen.queryByRole("group", { name: messages.en.tables.filter.label }),
    ).toBeNull();
  });

  it("groups the controls under the toolbar label and wraps on narrow widths", () => {
    renderToolbar();

    const toolbar = screen.getByRole("group", {
      name: messages.en.tables.toolbar.label,
    });
    expect(toolbar).toHaveClass("flex-wrap");
    expect(toolbar.className).not.toMatch(/(^|\s)w-\d/);
    expect(field()).toHaveClass("h-11");
  });
});
