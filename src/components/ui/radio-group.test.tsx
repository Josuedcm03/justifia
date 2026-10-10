import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

function Groups({
  onValueChange = () => {},
  value,
}: {
  onValueChange?: (value: string) => void;
  value?: string;
}) {
  return (
    <RadioGroup
      aria-label="Group"
      value={value}
      onValueChange={(next) => onValueChange(next as string)}
    >
      <RadioGroupItem value="1" aria-label="Group 1" />
      <RadioGroupItem value="2" aria-label="Group 2" />
    </RadioGroup>
  );
}

describe("RadioGroup", () => {
  it("preselects nothing and reports the chosen value", async () => {
    const onValueChange = vi.fn();
    render(<Groups onValueChange={onValueChange} />);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);
    for (const radio of radios) {
      expect(radio).toHaveAttribute("aria-checked", "false");
    }

    await userEvent.click(screen.getByRole("radio", { name: "Group 2" }));
    expect(onValueChange).toHaveBeenCalledWith("2");
  });

  it("shows the controlled value as the only checked radio", () => {
    render(<Groups value="1" />);
    expect(screen.getByRole("radio", { name: "Group 1" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: "Group 2" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("moves the choice with the arrow keys", async () => {
    const onValueChange = vi.fn();
    render(<Groups onValueChange={onValueChange} />);
    await userEvent.tab();
    await userEvent.keyboard("{ArrowDown}");
    expect(onValueChange).toHaveBeenCalledWith("2");
  });
});
