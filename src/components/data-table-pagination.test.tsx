import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DataTablePagination } from "@/components/data-table-pagination";

const labels = {
  region: "Users pagination",
  previous: "Previous",
  next: "Next",
};

describe("DataTablePagination", () => {
  it("renders nothing when the total fits in one page", () => {
    const { container } = render(
      <DataTablePagination
        page={1}
        pageSize={10}
        total={10}
        hrefFor={(p) => `/users?page=${p}`}
        labels={{ ...labels, status: "Page 1 of 1" }}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("on page 1 of 3, disables previous and links next", () => {
    render(
      <DataTablePagination
        page={1}
        pageSize={10}
        total={25}
        hrefFor={(p) => `/users?page=${p}`}
        labels={{ ...labels, status: "Page 1 of 3" }}
      />,
    );

    const previous = screen.getByText("Previous");
    expect(previous.tagName.toLowerCase()).not.toBe("a");
    expect(previous).toHaveAttribute("aria-disabled", "true");

    const next = screen.getByRole("link", { name: "Next" });
    expect(next).toHaveAttribute("href", "/users?page=2");
  });

  it("on the last page, disables next and links previous", () => {
    render(
      <DataTablePagination
        page={3}
        pageSize={10}
        total={25}
        hrefFor={(p) => `/users?page=${p}`}
        labels={{ ...labels, status: "Page 3 of 3" }}
      />,
    );

    const next = screen.getByText("Next");
    expect(next.tagName.toLowerCase()).not.toBe("a");
    expect(next).toHaveAttribute("aria-disabled", "true");

    const previous = screen.getByRole("link", { name: "Previous" });
    expect(previous).toHaveAttribute("href", "/users?page=2");
  });

  it("renders the caller-supplied status string verbatim", () => {
    render(
      <DataTablePagination
        page={2}
        pageSize={10}
        total={25}
        hrefFor={(p) => `/users?page=${p}`}
        labels={{ ...labels, status: "Page 2 of 3" }}
      />,
    );

    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
  });

  it("gives the nav an accessible name", () => {
    render(
      <DataTablePagination
        page={2}
        pageSize={10}
        total={25}
        hrefFor={(p) => `/users?page=${p}`}
        labels={{ ...labels, status: "Page 2 of 3" }}
      />,
    );

    expect(
      screen.getByRole("navigation", { name: "Users pagination" }),
    ).toBeInTheDocument();
  });

  it("marks the current page and only the current page", () => {
    const { container } = render(
      <DataTablePagination
        page={2}
        pageSize={10}
        total={25}
        hrefFor={(p) => `/users?page=${p}`}
        labels={{ ...labels, status: "Page 2 of 3" }}
      />,
    );

    const current = container.querySelectorAll('[aria-current="page"]');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent("Page 2 of 3");
  });

  it("meets the 44px touch floor on both controls", () => {
    render(
      <DataTablePagination
        page={2}
        pageSize={10}
        total={25}
        hrefFor={(p) => `/users?page=${p}`}
        labels={{ ...labels, status: "Page 2 of 3" }}
      />,
    );

    expect(screen.getByRole("link", { name: "Previous" }).className).toContain(
      "h-11",
    );
    expect(screen.getByRole("link", { name: "Next" }).className).toContain(
      "h-11",
    );
  });
});
