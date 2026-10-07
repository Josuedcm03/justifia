import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { Checkbox } from "@/components/ui/checkbox";

function Controlled({ onChange }: { onChange: (value: boolean) => void }) {
  const [checked, setChecked] = useState(false);
  return (
    <Checkbox
      aria-label="Calculus"
      checked={checked}
      onCheckedChange={(value) => {
        setChecked(value);
        onChange(value);
      }}
    />
  );
}

describe("Checkbox", () => {
  it("toggles on click and reports the new value", async () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    const box = screen.getByRole("checkbox", { name: "Calculus" });
    expect(box).toHaveAttribute("aria-checked", "false");

    await userEvent.click(box);
    expect(box).toHaveAttribute("aria-checked", "true");
    expect(onChange).toHaveBeenLastCalledWith(true);

    await userEvent.click(box);
    expect(box).toHaveAttribute("aria-checked", "false");
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it("toggles from the keyboard", async () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    await userEvent.tab();
    await userEvent.keyboard(" ");
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("does not toggle when disabled", async () => {
    const onChange = vi.fn();
    render(
      <Checkbox aria-label="Locked" disabled onCheckedChange={onChange} />,
    );
    await userEvent.click(screen.getByRole("checkbox", { name: "Locked" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
