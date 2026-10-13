import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TableCard } from "@/components/table-card";

function card() {
  return screen.getByTestId("card");
}

function region(name: "toolbar" | "body" | "footer") {
  return card().querySelector(`[data-slot="table-card-${name}"]`);
}

describe("TableCard (BS-FRM-1, DT-PEND-1, BS-MOT-1)", () => {
  it("draws the card frame once: radius, border, shadow, clipped", () => {
    render(
      <TableCard data-testid="card">
        <p>rows</p>
      </TableCard>,
    );

    expect(card()).toHaveClass(
      "rounded-xl",
      "border",
      "shadow-soft",
      "overflow-hidden",
    );
  });

  it("renders toolbar, body and footer in that order, divided by hairlines", () => {
    render(
      <TableCard
        data-testid="card"
        toolbar={<span>toolbar-content</span>}
        footer={<span>footer-content</span>}
      >
        <span>body-content</span>
      </TableCard>,
    );

    const toolbar = region("toolbar");
    const body = region("body");
    const footer = region("footer");

    expect(toolbar).toHaveTextContent("toolbar-content");
    expect(body).toHaveTextContent("body-content");
    expect(footer).toHaveTextContent("footer-content");
    expect(
      toolbar!.compareDocumentPosition(body!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      body!.compareDocumentPosition(footer!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(toolbar).toHaveClass("border-b", "px-6", "py-4");
    expect(footer).toHaveClass("border-t", "px-6", "py-4");
  });

  it("omits the toolbar and footer regions when they are not passed", () => {
    render(
      <TableCard data-testid="card">
        <span>only-body</span>
      </TableCard>,
    );

    expect(region("body")).toHaveTextContent("only-body");
    expect(region("toolbar")).toBeNull();
    expect(region("footer")).toBeNull();
  });

  it("is not busy by default", () => {
    render(<TableCard data-testid="card">rows</TableCard>);

    expect(card()).not.toHaveAttribute("aria-busy", "true");
    expect(region("body")).not.toHaveClass("opacity-60");
  });

  it("is aria-busy and dims the rows by opacity only while pending", () => {
    render(
      <TableCard data-testid="card" pending>
        rows
      </TableCard>,
    );

    expect(card()).toHaveAttribute("aria-busy", "true");
    expect(region("body")).toHaveClass(
      "opacity-60",
      "transition-opacity",
      "duration-150",
    );
  });

  it("never animates all properties", () => {
    render(
      <TableCard
        data-testid="card"
        pending
        toolbar={<span>t</span>}
        footer={<span>f</span>}
      >
        rows
      </TableCard>,
    );

    expect(card().outerHTML).not.toContain("transition-all");
  });

  it("keeps the toolbar and footer interactive while pending", () => {
    render(
      <TableCard
        data-testid="card"
        pending
        toolbar={<button type="button">search</button>}
        footer={<button type="button">next</button>}
      >
        rows
      </TableCard>,
    );

    expect(screen.getByRole("button", { name: "search" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "next" })).toBeEnabled();
    expect(region("toolbar")).not.toHaveClass("opacity-60");
  });
});
