import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DegradedAlert } from "@/components/degraded-alert";

describe("DegradedAlert (BS-STATE-2)", () => {
  it("is a status region that carries the localized text", () => {
    render(<DegradedAlert message="No se pudieron cargar los datos." />);

    const alert = screen.getByRole("status");
    expect(alert).toHaveTextContent("No se pudieron cargar los datos.");
  });

  it("states the problem in text, not by colour alone", () => {
    render(<DegradedAlert message="The data could not be loaded." />);

    expect(
      screen.getByText("The data could not be loaded."),
    ).toBeInTheDocument();
    expect(screen.getByRole("status").textContent?.trim()).not.toBe("");
  });

  it("keeps the markup of the page copies: a paragraph with the destructive left bar", () => {
    render(<DegradedAlert message="x" />);

    const alert = screen.getByRole("status");
    expect(alert.tagName).toBe("P");
    expect(alert).toHaveClass(
      "border-l-4",
      "border-l-destructive",
      "text-destructive-ink",
    );
  });

  it("accepts an extra class without losing the base markup", () => {
    render(<DegradedAlert message="x" className="mt-4" />);

    expect(screen.getByRole("status")).toHaveClass("mt-4", "border-l-4");
  });

  it("is hook-free: it renders outside any provider", () => {
    expect(() => render(<DegradedAlert message="x" />)).not.toThrow();
  });
});
