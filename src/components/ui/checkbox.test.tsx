import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Checkbox } from "@/components/ui/checkbox";

// The primitive renders no text, so no message catalog is needed.

describe("Checkbox (CM-GRP-6: the control is accessible)", () => {
  it("is a native checkbox input with no role override", () => {
    render(<Checkbox aria-label="Monday" />);

    const box = screen.getByRole("checkbox", { name: "Monday" });
    expect(box.tagName).toBe("INPUT");
    expect(box).toHaveAttribute("type", "checkbox");
    expect(box).not.toHaveAttribute("role");
  });

  it("forwards name, value, id, defaultChecked, disabled and aria-describedby", () => {
    render(
      <Checkbox
        aria-label="Monday"
        id="dias-lunes"
        name="dias"
        value="lunes"
        defaultChecked
        disabled
        aria-describedby="hint-1 error-1"
      />,
    );

    const box = screen.getByRole("checkbox", { name: "Monday" });
    expect(box).toHaveAttribute("id", "dias-lunes");
    expect(box).toHaveAttribute("name", "dias");
    expect(box).toHaveAttribute("value", "lunes");
    expect(box).toHaveAttribute("aria-describedby", "hint-1 error-1");
    expect(box).toBeChecked();
    expect(box).toBeDisabled();
  });

  it("is unchecked and enabled by default", () => {
    render(<Checkbox aria-label="Monday" />);

    const box = screen.getByRole("checkbox", { name: "Monday" });
    expect(box).not.toBeChecked();
    expect(box).toBeEnabled();
  });

  it("is 20px, tinted with the primary token and shows the section 7 focus ring", () => {
    render(<Checkbox aria-label="Monday" />);

    const classes = screen
      .getByRole("checkbox", { name: "Monday" })
      .className.split(/\s+/);
    expect(classes).toEqual(
      expect.arrayContaining([
        "size-5",
        "accent-primary",
        "focus-visible:ring-3",
        "focus-visible:ring-ring/40",
      ]),
    );
  });

  it("merges a caller className without dropping the base classes", () => {
    render(<Checkbox aria-label="Monday" className="shrink-0" />);

    const classes = screen
      .getByRole("checkbox", { name: "Monday" })
      .className.split(/\s+/);
    expect(classes).toEqual(
      expect.arrayContaining(["shrink-0", "size-5", "accent-primary"]),
    );
  });

  it("toggles with Space and clears with Space again", async () => {
    const user = userEvent.setup();
    render(<Checkbox aria-label="Monday" />);

    await user.tab();
    const box = screen.getByRole("checkbox", { name: "Monday" });
    expect(box).toHaveFocus();

    await user.keyboard(" ");
    expect(box).toBeChecked();

    await user.keyboard(" ");
    expect(box).not.toBeChecked();
  });
});
