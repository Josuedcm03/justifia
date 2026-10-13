import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageFrame } from "@/components/page-frame";

describe("PageFrame (BS-FRM-1)", () => {
  it("renders a vertical stack with the 32px rhythm", () => {
    render(
      <PageFrame data-testid="frame">
        <h1>Title</h1>
      </PageFrame>,
    );

    expect(screen.getByTestId("frame")).toHaveClass(
      "flex",
      "flex-col",
      "gap-8",
    );
  });

  it("renders its children in order", () => {
    render(
      <PageFrame>
        <h1>Header</h1>
        <p>Card</p>
      </PageFrame>,
    );

    const header = screen.getByRole("heading", { name: "Header" });
    const card = screen.getByText("Card");
    expect(
      header.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("merges an extra class without losing the stack", () => {
    render(
      <PageFrame data-testid="frame" className="max-w-3xl">
        x
      </PageFrame>,
    );

    expect(screen.getByTestId("frame")).toHaveClass("gap-8", "max-w-3xl");
  });
});
