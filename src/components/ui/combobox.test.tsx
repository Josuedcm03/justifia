import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FormField } from "@/components/form-field";
import { Combobox, type ComboboxProps } from "@/components/ui/combobox";

// Real Base UI under jsdom. The popup is portalled and mounted asynchronously,
// so nothing in the popup is ever read synchronously: every option query is a
// `findBy*` or sits inside `waitFor`, and every test closes what it opened.

const ITEMS = [
  { value: "a1", label: "ALG-101 Algebra" },
  { value: "a2", label: "CAL-201 Calculus" },
  { value: "a3", label: "FIS-110 Physics" },
] as const;

function Harness({
  error,
  hint,
  ...props
}: Partial<ComboboxProps> & { error?: string; hint?: string }) {
  return (
    <form aria-label="harness">
      <FormField id="asignatura" label="Subject" error={error} hint={hint}>
        {(control) => (
          <Combobox
            name="asignaturaId"
            items={ITEMS}
            emptyText="No subjects match"
            {...control}
            {...props}
          />
        )}
      </FormField>
    </form>
  );
}

function submitted() {
  const form = screen.getByRole("form", { name: "harness" }) as HTMLFormElement;
  return new FormData(form);
}

function input() {
  return screen.getByRole("combobox", { name: "Subject" });
}

async function closePopup(user: ReturnType<typeof userEvent.setup>) {
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryAllByRole("option")).toHaveLength(0));
}

describe("Combobox", () => {
  it("is labelled by its FormField label", () => {
    render(<Harness />);

    expect(input()).toBeInTheDocument();
    expect(screen.getByLabelText("Subject")).toBe(input());
  });

  it("lists every option once the user opens it", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(input());

    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(
      ITEMS.map((item) => item.label),
    );
    await closePopup(user);
  });

  it("filters the options as the user types", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // `type` clicks the input first (which opens the popup); while the popup
    // is open Base UI hides the rest of the page from the accessibility tree,
    // so the input is not queried again after opening.
    await user.type(input(), "calc");

    expect(
      await screen.findByRole("option", { name: "CAL-201 Calculus" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(1));
    await closePopup(user);
  });

  it("submits the id of the chosen option under its name, never the label", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(input());
    await user.click(
      await screen.findByRole("option", { name: "CAL-201 Calculus" }),
    );

    await waitFor(() => expect(submitted().get("asignaturaId")).toBe("a2"));
    await waitFor(() => expect(input()).toHaveValue("CAL-201 Calculus"));
    // The visible text input carries no name: only one entry is submitted.
    expect([...submitted().keys()]).toEqual(["asignaturaId"]);
    await waitFor(() =>
      expect(screen.queryAllByRole("option")).toHaveLength(0),
    );
  });

  it("submits an empty value while nothing is chosen", () => {
    render(<Harness />);

    expect(submitted().get("asignaturaId")).toBe("");
  });

  it("starts with the option whose id is `defaultValue`", () => {
    render(<Harness defaultValue="a3" />);

    expect(input()).toHaveValue("FIS-110 Physics");
    expect(submitted().get("asignaturaId")).toBe("a3");
  });

  it("reports the chosen id through onValueChange", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Harness onValueChange={onValueChange} />);

    await user.click(input());
    await user.click(
      await screen.findByRole("option", { name: "ALG-101 Algebra" }),
    );

    await waitFor(() => expect(onValueChange).toHaveBeenCalledWith("a1"));
    await waitFor(() =>
      expect(screen.queryAllByRole("option")).toHaveLength(0),
    );
  });

  it("blocks a form submission while required and nothing is chosen", async () => {
    const user = userEvent.setup();
    render(<Harness required />);
    const form = screen.getByRole("form", {
      name: "harness",
    }) as HTMLFormElement;

    expect(input()).toBeRequired();
    expect(form.checkValidity()).toBe(false);

    await user.click(input());
    await user.click(
      await screen.findByRole("option", { name: "ALG-101 Algebra" }),
    );

    await waitFor(() => expect(form.checkValidity()).toBe(true));
    await waitFor(() =>
      expect(screen.queryAllByRole("option")).toHaveLength(0),
    );
  });

  it("is not required unless asked", () => {
    render(<Harness />);

    expect(input()).not.toBeRequired();
  });

  it("shows the empty-result text when nothing matches", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(input(), "zzz");

    expect(await screen.findByText("No subjects match")).toBeInTheDocument();
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByText("No subjects match")).not.toBeInTheDocument(),
    );
  });

  it("shows the cap note, linked to the input, only when truncated", () => {
    const { rerender } = render(<Harness />);
    expect(
      screen.queryByText("Showing the first 2000"),
    ).not.toBeInTheDocument();

    rerender(<Harness truncated truncatedText="Showing the first 2000" />);

    const note = screen.getByText("Showing the first 2000");
    expect(note).toBeVisible();
    expect(input()).toHaveAccessibleDescription("Showing the first 2000");
  });

  it("keeps the FormField hint, the error and the cap note all in the description", () => {
    render(
      <Harness
        hint="Pick one"
        error="Choose a subject"
        truncated
        truncatedText="Showing the first 2000"
      />,
    );

    expect(input()).toHaveAccessibleDescription(
      "Pick one Choose a subject Showing the first 2000",
    );
  });

  it("does not render a cap note when truncated but without text", () => {
    render(<Harness truncated />);

    expect(input()).not.toHaveAttribute("aria-describedby");
  });

  it("opens with ArrowDown, chooses with Enter and closes", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    input().focus();
    await user.keyboard("{ArrowDown}");
    await screen.findAllByRole("option");
    await user.keyboard("{ArrowDown}");
    const highlighted = await waitFor(() => {
      const found = screen
        .getAllByRole("option")
        .find((option) => option.hasAttribute("data-highlighted"));
      expect(found).toBeDefined();
      return found!;
    });
    const label = highlighted.textContent;
    await user.keyboard("{Enter}");

    await waitFor(() => expect(input()).toHaveValue(label));
    const chosen = ITEMS.find((item) => item.label === label)!;
    await waitFor(() =>
      expect(submitted().get("asignaturaId")).toBe(chosen.value),
    );
    await waitFor(() =>
      expect(screen.queryAllByRole("option")).toHaveLength(0),
    );
  });

  it("closes with Escape and leaves the value as it was", async () => {
    const user = userEvent.setup();
    render(<Harness defaultValue="a1" />);

    await user.click(input());
    await screen.findAllByRole("option");
    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(screen.queryAllByRole("option")).toHaveLength(0),
    );
    expect(submitted().get("asignaturaId")).toBe("a1");
  });

  it("marks the input invalid and links the error", () => {
    render(<Harness error="Choose a subject" />);

    expect(input()).toBeInvalid();
    expect(input()).toHaveAccessibleDescription("Choose a subject");
    expect(screen.getByRole("alert")).toHaveTextContent("Choose a subject");
  });

  it("is not invalid without an error", () => {
    render(<Harness />);

    expect(input()).not.toBeInvalid();
  });

  it("ignores interaction and submits nothing while disabled", async () => {
    const user = userEvent.setup();
    render(<Harness disabled defaultValue="a1" />);

    expect(input()).toBeDisabled();
    await user.click(input());

    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(submitted().has("asignaturaId")).toBe(false);
  });
});
