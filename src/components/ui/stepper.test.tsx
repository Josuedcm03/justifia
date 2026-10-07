import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Stepper } from "@/components/ui/stepper";

const STEPS = [
  { key: "a", label: "Cause", href: "/flow?step=1" },
  { key: "b", label: "Subjects", href: "/flow?step=2" },
  { key: "c", label: "Documents", href: "/flow?step=3" },
  { key: "d", label: "Review", href: "/flow?step=4" },
];

function renderStepper(current: number) {
  return render(
    <Stepper
      steps={STEPS}
      current={current}
      label="Request steps"
      summary={`Step ${current} of 4`}
    />,
  );
}

describe("Stepper", () => {
  it("marks only the current step with aria-current", () => {
    renderStepper(2);
    const list = screen.getByRole("list");
    const current = within(list)
      .getAllByRole("listitem")
      .filter((item) => item.querySelector('[aria-current="step"]'));
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent("Subjects");
  });

  it("links earlier steps and leaves later ones as plain text", () => {
    renderStepper(3);
    const list = screen.getByRole("list");
    expect(within(list).getByRole("link", { name: "Cause" })).toHaveAttribute(
      "href",
      "/flow?step=1",
    );
    expect(
      within(list).getByRole("link", { name: "Subjects" }),
    ).toHaveAttribute("href", "/flow?step=2");
    expect(within(list).queryByRole("link", { name: "Documents" })).toBeNull();
    expect(within(list).queryByRole("link", { name: "Review" })).toBeNull();
    expect(within(list).getByText("Review")).toBeInTheDocument();
  });

  it("states the position in words for narrow screens", () => {
    renderStepper(4);
    expect(screen.getByText("Step 4 of 4")).toBeInTheDocument();
    expect(screen.getByRole("navigation")).toHaveAccessibleName(
      "Request steps",
    );
  });

  it("has no earlier step to link from the first step", () => {
    renderStepper(1);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
