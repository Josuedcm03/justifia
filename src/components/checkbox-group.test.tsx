import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { CheckboxGroup } from "@/components/checkbox-group";

// Labels are plain prop strings: the component is generic and knows nothing
// about days, so no message catalog is involved.

const OPTIONS = [
  { value: "lunes", label: "Monday" },
  { value: "martes", label: "Tuesday" },
  { value: "miercoles", label: "Wednesday" },
  { value: "jueves", label: "Thursday" },
  { value: "viernes", label: "Friday" },
  { value: "sabado", label: "Saturday" },
  { value: "domingo", label: "Sunday" },
] as const;

type GroupProps = Partial<Parameters<typeof CheckboxGroup>[0]>;

function Harness(props: GroupProps) {
  return (
    <form aria-label="harness">
      <CheckboxGroup
        id="dias"
        legend="Meeting days"
        name="dias"
        options={OPTIONS}
        {...props}
      />
    </form>
  );
}

function submitted(name = "dias") {
  const form = screen.getByRole("form", { name: "harness" }) as HTMLFormElement;
  return new FormData(form).getAll(name);
}

const group = () => screen.getByRole("group", { name: "Meeting days" });
const box = (label: string) => screen.getByRole("checkbox", { name: label });
const describedBy = (el: HTMLElement) =>
  (el.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean);

describe("CheckboxGroup (CM-GRP-6: the control is accessible)", () => {
  it("is a fieldset whose legend is the group name", () => {
    render(<Harness />);

    expect(group().tagName).toBe("FIELDSET");
    expect(group().querySelector("legend")).toHaveTextContent("Meeting days");
  });

  it("renders one checkbox per option, found by its label, all sharing the name", () => {
    render(<Harness />);

    const boxes = screen.getAllByRole("checkbox");
    expect(boxes.map((b) => b.getAttribute("value"))).toEqual(
      OPTIONS.map((o) => o.value),
    );
    for (const option of OPTIONS) {
      expect(box(option.label)).toHaveAttribute("name", "dias");
    }
  });

  it("starts unchecked when there are no default values", () => {
    render(<Harness />);

    for (const option of OPTIONS) {
      expect(box(option.label)).not.toBeChecked();
    }
    expect(submitted()).toEqual([]);
  });

  it("checks exactly the default values", () => {
    render(<Harness defaultValues={["martes", "viernes"]} />);

    for (const option of OPTIONS) {
      const expected = option.value === "martes" || option.value === "viernes";
      if (expected) expect(box(option.label)).toBeChecked();
      else expect(box(option.label)).not.toBeChecked();
    }
  });

  it("clicking the label text toggles the checkbox", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByText("Wednesday"));
    expect(box("Wednesday")).toBeChecked();

    await user.click(screen.getByText("Wednesday"));
    expect(box("Wednesday")).not.toBeChecked();
  });

  it("gives every label row a 44px minimum height", () => {
    render(<Harness />);

    for (const option of OPTIONS) {
      const row = box(option.label).closest("label");
      expect(row, option.label).not.toBeNull();
      expect(row?.className.split(/\s+/)).toContain("min-h-11");
    }
  });

  it("submits one form entry per checked option under the shared name", async () => {
    const user = userEvent.setup();
    render(<Harness defaultValues={["lunes"]} />);

    await user.click(screen.getByText("Friday"));
    await user.click(screen.getByText("Sunday"));
    await user.click(screen.getByText("Monday"));

    expect(submitted()).toEqual(["viernes", "domingo"]);
  });

  it("submits the default values untouched", () => {
    render(<Harness defaultValues={["lunes", "jueves"]} />);

    expect(submitted()).toEqual(["lunes", "jueves"]);
  });

  it("shows a state that is the native checked property, not a status class", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const before = box("Monday").className;
    await user.click(screen.getByText("Monday"));

    expect((box("Monday") as HTMLInputElement).checked).toBe(true);
    expect(box("Monday").className).toBe(before);
    expect(group().innerHTML).not.toMatch(
      /data-state|aria-checked|text-destructive|text-success|bg-success/,
    );
  });

  it("with no hint and no error, the fieldset is not described and no alert exists", () => {
    render(<Harness />);

    expect(group()).not.toHaveAttribute("aria-describedby");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("links the hint to the fieldset", () => {
    render(<Harness hint="Select at least one day" />);

    const hint = screen.getByText("Select at least one day");
    expect(describedBy(group())).toEqual([hint.id]);
    expect(hint.id).not.toBe("");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders the error with role=alert, linked to the fieldset", () => {
    render(<Harness error="Select at least one day" />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Select at least one day");
    expect(describedBy(group())).toEqual([alert.id]);
    expect(group().contains(alert)).toBe(true);
  });

  it("links both ids, hint first, when both exist", () => {
    render(<Harness hint="Pick the meeting days" error="Select a day" />);

    const hint = screen.getByText("Pick the meeting days");
    const alert = screen.getByRole("alert");
    expect(describedBy(group())).toEqual([hint.id, alert.id]);
    expect(hint.id).not.toBe(alert.id);
  });

  it.each([undefined, ""])(
    "renders no alert for an empty error (%j)",
    (error) => {
      render(<Harness error={error} />);

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(group()).not.toHaveAttribute("aria-describedby");
    },
  );

  it("never sets aria-invalid or aria-required on the fieldset", () => {
    render(<Harness hint="Pick" error="Select a day" />);

    expect(group()).not.toHaveAttribute("aria-invalid");
    expect(group()).not.toHaveAttribute("aria-required");
  });

  it("is reached by Tab one option at a time, in order, and toggled with Space", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    for (const option of OPTIONS) {
      await user.tab();
      expect(box(option.label)).toHaveFocus();

      await user.keyboard(" ");
      expect(box(option.label)).toBeChecked();
    }
    expect(submitted()).toEqual(OPTIONS.map((o) => o.value));

    // Shift+Tab walks back and Space clears.
    for (const option of [...OPTIONS].reverse()) {
      expect(box(option.label)).toHaveFocus();
      await user.keyboard(" ");
      expect(box(option.label)).not.toBeChecked();
      await user.tab({ shift: true });
    }
    expect(submitted()).toEqual([]);
  });

  it("keeps the checked values when a re-render adds an error", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Harness defaultValues={["lunes"]} />);

    await user.click(screen.getByText("Thursday"));
    expect(submitted()).toEqual(["lunes", "jueves"]);

    rerender(<Harness defaultValues={["lunes"]} error="Select a day" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Select a day");
    expect(box("Monday")).toBeChecked();
    expect(box("Thursday")).toBeChecked();
    expect(submitted()).toEqual(["lunes", "jueves"]);

    rerender(<Harness defaultValues={["lunes"]} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(submitted()).toEqual(["lunes", "jueves"]);
  });
});

describe("CheckboxGroup disabled", () => {
  it("is enabled by default", () => {
    render(<Harness />);

    expect(group()).not.toHaveAttribute("disabled");
    for (const option of OPTIONS) {
      expect(box(option.label)).toBeEnabled();
    }
  });

  it("disables every checkbox, submits no entry and keeps legend and description", () => {
    render(
      <Harness
        disabled
        defaultValues={["lunes", "jueves"]}
        hint="Pick the meeting days"
        error="Select a day"
      />,
    );

    expect(group()).toBeDisabled();
    expect(group().querySelector("legend")).toHaveTextContent("Meeting days");
    for (const option of OPTIONS) {
      expect(box(option.label)).toBeDisabled();
    }
    expect(box("Monday")).toBeChecked();
    expect(submitted()).toEqual([]);
    const hint = screen.getByText("Pick the meeting days");
    const alert = screen.getByRole("alert");
    expect(describedBy(group())).toEqual([hint.id, alert.id]);
  });
});
