import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EmptyState } from "@/components/empty-state";

describe("EmptyState (BS-STATE-1)", () => {
  describe("empty variant", () => {
    it("shows one sentence and no action by default", () => {
      render(<EmptyState variant="empty" message="No users yet." />);

      expect(screen.getByText("No users yet.")).toBeInTheDocument();
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });

    it("offers the create action as a link when given", () => {
      render(
        <EmptyState
          variant="empty"
          message="No users yet."
          action={{ href: "/users/new", label: "New user" }}
        />,
      );

      const action = screen.getByRole("link", { name: "New user" });
      expect(action).toHaveAttribute("href", "/users/new");
    });
  });

  describe("no-results variant", () => {
    const clear = { href: "/users", label: "Clear search and filters" };

    it("names what matches nothing, hints, and always offers the clear link", () => {
      render(
        <EmptyState
          variant="no-results"
          title="No results for “calc”"
          hint="Check the spelling or try another term."
          clear={clear}
        />,
      );

      expect(screen.getByText("No results for “calc”")).toBeInTheDocument();
      expect(
        screen.getByText("Check the spelling or try another term."),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Clear search and filters" }),
      ).toHaveAttribute("href", "/users");
    });

    it("keeps the clear link for a filter-only miss (no term)", () => {
      render(
        <EmptyState
          variant="no-results"
          title="No inactive users"
          hint="Change the filter."
          clear={{ href: "/users?status=all", label: "Show all" }}
        />,
      );

      expect(screen.getByRole("link", { name: "Show all" })).toHaveAttribute(
        "href",
        "/users?status=all",
      );
    });

    it("does not render the empty-state create action", () => {
      render(
        <EmptyState
          variant="no-results"
          title="Nothing"
          hint="Hint"
          clear={clear}
        />,
      );

      expect(screen.getAllByRole("link")).toHaveLength(1);
    });

    it("rejects a missing clear link at compile time and at runtime", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      expect(() =>
        render(
          // @ts-expect-error the clear link is required for no-results
          <EmptyState variant="no-results" title="Nothing" hint="Hint" />,
        ),
      ).toThrow(/clear/i);

      spy.mockRestore();
    });
  });

  it("is hook-free: it renders outside any provider", () => {
    expect(() =>
      render(<EmptyState variant="empty" message="Nothing yet." />),
    ).not.toThrow();
  });
});
