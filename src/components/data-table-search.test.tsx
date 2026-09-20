import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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
});
