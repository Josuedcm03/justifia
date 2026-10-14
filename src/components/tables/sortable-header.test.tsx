import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SortableHeader } from "@/components/tables/sortable-header";
import { messages, renderWithIntl } from "@/test/intl";

type Direction = "asc" | "desc" | false;

function renderHeader(
  props: {
    direction?: Direction;
    onSort?: () => void;
    align?: "start" | "end";
  } = {},
  locale: "es" | "en" = "en",
) {
  const onSort = props.onSort ?? vi.fn();
  renderWithIntl(
    <table>
      <thead>
        <tr>
          <SortableHeader
            direction={props.direction ?? false}
            onSort={onSort}
            align={props.align}
          >
            Name
          </SortableHeader>
        </tr>
      </thead>
    </table>,
    locale,
  );
  return {
    onSort,
    th: screen.getByRole("columnheader"),
    button: screen.getByRole("button"),
  };
}

describe("SortableHeader (DT-SORT-2, DT-DENS-1)", () => {
  it("renders a native button named by the column label inside the th", () => {
    const { th, button } = renderHeader();

    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("type", "button");
    expect(within(th).getByRole("button", { name: "Name" })).toBe(button);
  });

  it("is at least 44px tall and offsets its padding so the label stays aligned", () => {
    const { th, button } = renderHeader();

    // 44px target inside the 48px header row; the negative margin equals the
    // inline padding the button gives its focus ring.
    expect(button).toHaveClass("min-h-11", "px-3", "-mx-3");
    expect(th).toHaveClass("h-12", "px-6");
  });

  it("keeps the label's position for an end-aligned column", () => {
    const { th } = renderHeader({ align: "end" });

    expect(th).toHaveClass("text-right");
  });

  it.each([
    ["asc", "ascending"],
    ["desc", "descending"],
  ] as const)("marks the th aria-sort=%s only for %s", (direction, value) => {
    const { th } = renderHeader({ direction });

    expect(th).toHaveAttribute("aria-sort", value);
  });

  it("has no aria-sort when it is not the sorted column", () => {
    const { th } = renderHeader({ direction: false });

    expect(th).not.toHaveAttribute("aria-sort");
  });

  it("shows a different icon for ascending, descending and unsorted", () => {
    const iconOf = (direction: Direction) => {
      const { button } = renderHeader({ direction });
      const icon = button.querySelector("svg");
      expect(icon, String(direction)).not.toBeNull();
      expect(icon).toHaveAttribute("aria-hidden", "true");
      const signature = icon!.getAttribute("class");
      document.body.innerHTML = "";
      return signature;
    };

    const icons = [iconOf("asc"), iconOf("desc"), iconOf(false)];

    expect(new Set(icons).size).toBe(3);
  });

  it("keeps the column name as the accessible name in every state", () => {
    for (const direction of ["asc", "desc", false] as const) {
      const { button } = renderHeader({ direction });
      expect(button).toHaveAccessibleName("Name");
      document.body.innerHTML = "";
    }
  });

  it.each([
    ["asc", "ascending"],
    ["desc", "descending"],
    [false, "sortable"],
  ] as const)(
    "describes the %s state in words, not by icon or colour alone",
    (direction, key) => {
      const { button } = renderHeader({ direction });

      expect(button).toHaveAccessibleDescription(messages.en.tables.sort[key]);
    },
  );

  it("describes the state in Spanish when the locale is es", () => {
    const { button } = renderHeader({ direction: "asc" }, "es");

    expect(button).toHaveAccessibleDescription(
      messages.es.tables.sort.ascending,
    );
    expect(messages.es.tables.sort.ascending).not.toBe(
      messages.en.tables.sort.ascending,
    );
  });

  it.each([
    ["asc", "ascending"],
    ["desc", "descending"],
    [false, "sortable"],
  ] as const)(
    "renders no visible state text for the %s state: the icon is the only indicator",
    (direction, key) => {
      const { button } = renderHeader({ direction });
      const words = messages.en.tables.sort;

      expect(button).toHaveTextContent(/^Name$/);
      expect(button.textContent).toBe("Name");
      expect(button.querySelector("span")).toBeNull();
      expect(button).not.toHaveTextContent(words[key]);
      // The state is still exposed through the description and aria-sort.
      expect(button).toHaveAccessibleName("Name");
      expect(button).toHaveAccessibleDescription(words[key]);
    },
  );

  it("renders no visible state text in Spanish either", () => {
    const { button } = renderHeader({ direction: "desc" }, "es");

    expect(button.textContent).toBe("Name");
    expect(button).toHaveAccessibleName("Name");
  });

  it("keeps the 44px target without wrapping classes or fixed widths", () => {
    const { button } = renderHeader({ direction: "asc" });

    expect(button).toHaveClass("min-h-11");
    expect(button).not.toHaveClass("flex-wrap");
    expect(button.className).not.toMatch(/(^|\s)(w|min-w|max-w)-/);
  });

  it("activates onSort with Enter", async () => {
    const { onSort, button } = renderHeader();
    button.focus();

    await userEvent.keyboard("{Enter}");

    expect(onSort).toHaveBeenCalledTimes(1);
  });

  it("activates onSort with Space", async () => {
    const { onSort, button } = renderHeader();
    button.focus();

    await userEvent.keyboard(" ");

    expect(onSort).toHaveBeenCalledTimes(1);
  });

  it("activates onSort with a pointer click", async () => {
    const { onSort, button } = renderHeader();

    await userEvent.click(button);

    expect(onSort).toHaveBeenCalledTimes(1);
  });

  it("keeps focus on the same control after activation", async () => {
    const { button } = renderHeader();

    await userEvent.click(button);

    expect(button).toHaveFocus();
  });

  it("shows a visible focus indicator", () => {
    const { button } = renderHeader();

    expect(button).toHaveClass(
      "focus-visible:ring-2",
      "focus-visible:ring-ring",
    );
  });

  it("does not animate: no transition on the header cell or the button", () => {
    const { th, button } = renderHeader({ direction: "asc" });

    expect(th.className).not.toMatch(/transition|animate/);
    expect(button.className).not.toMatch(/transition|animate/);
    expect(button.querySelector("svg")!.getAttribute("class")).not.toMatch(
      /transition|animate/,
    );
  });
});

describe("SortableHeader control id (DT-SORT-2)", () => {
  it("marks the button with the control id it is given, for focus restoration", () => {
    renderWithIntl(
      <table>
        <thead>
          <tr>
            <SortableHeader
              direction={false}
              onSort={() => undefined}
              controlId="sort:name"
            >
              Name
            </SortableHeader>
          </tr>
        </thead>
      </table>,
      "en",
    );

    expect(screen.getByRole("button", { name: "Name" })).toHaveAttribute(
      "data-list-control",
      "sort:name",
    );
  });

  it("renders no marker when no id is given", () => {
    const { button } = renderHeader();

    expect(button).not.toHaveAttribute("data-list-control");
  });
});
