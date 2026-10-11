import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DataTableSearch } from "@/components/data-table-search";

describe("DataTableSearch", () => {
  it("renders a GET form with the given action and the search role", () => {
    render(
      <DataTableSearch
        action="/users"
        value=""
        label="Search users"
        placeholder="Name, username or email"
        submitLabel="Search"
        clearLabel="Clear search"
      />,
    );

    const form = screen.getByRole("search");
    expect(form.tagName.toLowerCase()).toBe("form");
    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", "/users");
  });

  it("never emits a page field, so a new search resets to page 1", () => {
    const { container } = render(
      <DataTableSearch
        action="/users"
        value=""
        label="Search users"
        placeholder="Name, username or email"
        submitLabel="Search"
        clearLabel="Clear search"
      />,
    );

    expect(container.querySelector('[name="page"]')).toBeNull();
  });

  it("names the input q, gives it the defaultValue and associates it with its label", () => {
    render(
      <DataTableSearch
        action="/users"
        value="ana"
        label="Search users"
        placeholder="Name, username or email"
        submitLabel="Search"
        clearLabel="Clear search"
      />,
    );

    const input = screen.getByLabelText("Search users") as HTMLInputElement;
    expect(input).toHaveAttribute("name", "q");
    expect(input).toHaveValue("ana");
  });

  it("follows the value when the same form re-renders with another one, without a Base UI default-value warning", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const props = {
      action: "/users",
      label: "Search users",
      placeholder: "Name, username or email",
      submitLabel: "Search",
      clearLabel: "Clear search",
    };
    const { rerender } = render(<DataTableSearch {...props} value="ana" />);

    rerender(<DataTableSearch {...props} value="" />);

    expect(screen.getByLabelText("Search users")).toHaveValue("");
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it("gives the input and the submit button the 44px touch classes", () => {
    render(
      <DataTableSearch
        action="/users"
        value=""
        label="Search users"
        placeholder="Name, username or email"
        submitLabel="Search"
        clearLabel="Clear search"
      />,
    );

    const input = screen.getByLabelText("Search users");
    expect(input.className).toContain("h-11");

    const submit = screen.getByRole("button", { name: "Search" });
    expect(submit.className).toContain("h-11");
  });

  it("renders no clear control when the value is empty", () => {
    render(
      <DataTableSearch
        action="/users"
        value=""
        label="Search users"
        placeholder="Name, username or email"
        submitLabel="Search"
        clearLabel="Clear search"
      />,
    );

    expect(
      screen.queryByRole("link", { name: "Clear search" }),
    ).not.toBeInTheDocument();
  });

  it("renders a clear link to the bare action only when the value is non-empty", () => {
    render(
      <DataTableSearch
        action="/users"
        value="ana"
        label="Search users"
        placeholder="Name, username or email"
        submitLabel="Search"
        clearLabel="Clear search"
      />,
    );

    const clear = screen.getByRole("link", { name: "Clear search" });
    expect(clear).toHaveAttribute("href", "/users");
  });

  describe("optional hidden and clearHref props", () => {
    const base = {
      action: "/catalog/asignaturas",
      label: "Search subjects",
      placeholder: "Code or name",
      submitLabel: "Search",
      clearLabel: "Clear search",
    };

    it("renders one hidden input per entry, so the status survives a search", () => {
      const { container } = render(
        <DataTableSearch
          {...base}
          value=""
          hidden={{ status: "inactive", other: "x" }}
        />,
      );

      const hidden = Array.from(
        container.querySelectorAll<HTMLInputElement>('input[type="hidden"]'),
      );
      expect(hidden.map((i) => [i.name, i.value])).toEqual([
        ["status", "inactive"],
        ["other", "x"],
      ]);
      expect(container.querySelector('[name="page"]')).toBeNull();
    });

    it("renders no hidden input by default", () => {
      const { container } = render(<DataTableSearch {...base} value="" />);

      expect(container.querySelector('input[type="hidden"]')).toBeNull();
    });

    it("points the clear control at clearHref instead of the bare action", () => {
      render(
        <DataTableSearch
          {...base}
          value="calc"
          clearHref="/catalog/asignaturas?status=all"
        />,
      );

      expect(
        screen.getByRole("link", { name: "Clear search" }),
      ).toHaveAttribute("href", "/catalog/asignaturas?status=all");
    });

    it("still renders no clear control for an empty value, even with clearHref", () => {
      render(
        <DataTableSearch {...base} value="" clearHref="/catalog/asignaturas" />,
      );

      expect(
        screen.queryByRole("link", { name: "Clear search" }),
      ).not.toBeInTheDocument();
    });

    it("keeps the bare action as the clear target when clearHref is omitted", () => {
      render(
        <DataTableSearch {...base} value="calc" hidden={{ status: "all" }} />,
      );

      expect(
        screen.getByRole("link", { name: "Clear search" }),
      ).toHaveAttribute("href", "/catalog/asignaturas");
    });
  });
});
