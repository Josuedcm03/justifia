import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";

function renderField(props: { hint?: string; error?: string } = {}) {
  return render(
    <FormField id="nombre" label="Name" {...props}>
      {(control) => <Input name="nombre" {...control} />}
    </FormField>,
  );
}

const describedBy = (el: HTMLElement) =>
  (el.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean);

describe("FormField (CM-NFR-3: errors are associated and announced)", () => {
  it("associates the label with the control", () => {
    renderField();

    const input = screen.getByLabelText("Name");
    expect(input).toHaveAttribute("id", "nombre");
    expect(input).toHaveAttribute("name", "nombre");
  });

  it("with no hint and no error, the control is neither described nor invalid", () => {
    renderField();

    const input = screen.getByLabelText("Name");
    expect(input).not.toHaveAttribute("aria-describedby");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("links the hint to the control by aria-describedby", () => {
    renderField({ hint: "At most 120 characters" });

    const input = screen.getByLabelText("Name");
    const hint = screen.getByText("At most 120 characters");
    expect(describedBy(input)).toEqual([hint.id]);
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("renders the error under the field with role=alert, linked and marking the control invalid", () => {
    const { container } = renderField({ error: "Enter a name" });

    const input = screen.getByLabelText("Name");
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Enter a name");
    expect(describedBy(input)).toEqual([alert.id]);
    expect(input).toHaveAttribute("aria-invalid", "true");

    // Directly under the control, inside the same field.
    expect(
      input.compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(container.firstElementChild?.contains(alert)).toBe(true);
  });

  it("links both the hint and the error when both are present", () => {
    renderField({ hint: "At most 120 characters", error: "Enter a name" });

    const input = screen.getByLabelText("Name");
    const hint = screen.getByText("At most 120 characters");
    const alert = screen.getByRole("alert");
    expect(describedBy(input)).toEqual([hint.id, alert.id]);
    expect(hint.id).not.toBe(alert.id);
  });

  it.each([undefined, ""])(
    "renders nothing for an empty error (%j)",
    (error) => {
      renderField({ error });

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Name")).not.toHaveAttribute("aria-invalid");
    },
  );
});
