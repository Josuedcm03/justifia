import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import enMessages from "../../../../i18n/en.json";
import {
  ScalarsForm,
  type ScalarField,
} from "@/app/(dashboard)/parameters/scalars-form";
import type { ParameterFormState } from "@/lib/parameters/form-state";
import { renderWithIntl } from "@/test/intl";

type Action = (
  previous: ParameterFormState,
  formData: FormData,
) => Promise<ParameterFormState>;

const FIELDS: readonly ScalarField[] = [
  { key: "plazo_remision_dias", value: 2 },
  { key: "alerta_dias", value: 1 },
  { key: "presentacion_tardia_dias", value: 2 },
  { key: "ventana_presentacion_dias", value: 30 },
  { key: "umbral_reincidencia", value: 4 },
  { key: "tamano_maximo_mib", value: 10 },
];

function renderForm(action?: Action) {
  const dispatch = vi.fn<Action>(action ?? (async () => ({ kind: "saved" })));
  renderWithIntl(<ScalarsForm action={dispatch} fields={FIELDS} />, "en");
  return dispatch;
}

describe("ScalarsForm (NP-7)", () => {
  it("shows six number inputs, each with its value in force and nothing else", () => {
    const { container } = renderWithIntl(
      <ScalarsForm action={vi.fn<Action>()} fields={FIELDS} />,
      "en",
    );

    const inputs = screen.getAllByRole("spinbutton");
    expect(inputs.map((input) => (input as HTMLInputElement).name)).toEqual(
      FIELDS.map((field) => field.key),
    );
    expect(inputs.map((input) => (input as HTMLInputElement).value)).toEqual([
      "2",
      "1",
      "2",
      "30",
      "4",
      "10",
    ]);
    // No hint, no range text and no "default in use" mark beside a field.
    expect(container.querySelectorAll("[id$='-hint']")).toHaveLength(0);
    for (const input of inputs) expect(input).toHaveAccessibleName();
  });

  it("saves with one press: no confirmation step, the typed fields are sent", async () => {
    const user = userEvent.setup();
    const action = renderForm();

    const alert = screen.getByRole("spinbutton", { name: /alert/i });
    await user.clear(alert);
    await user.type(alert, "2");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const sent = action.mock.calls[0][1];
    expect(sent.get("alerta_dias")).toBe("2");
    expect(sent.get("plazo_remision_dias")).toBe("2");
    expect([...sent.keys()]).toEqual(FIELDS.map((field) => field.key));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("shows every error at once, tied to its field, and keeps the typed values", async () => {
    const user = userEvent.setup();
    const range = "Enter a whole number between 1 and 10.";
    renderForm(async () => ({
      kind: "invalid",
      fieldErrors: {
        plazo_remision_dias: range,
        tamano_maximo_mib: "The value must be at most 10.",
      },
      values: {},
    }));

    const remission = screen.getByRole("spinbutton", { name: /remission/i });
    await user.clear(remission);
    await user.type(remission, "11");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    const alerts = await screen.findAllByRole("alert");
    expect(alerts.map((a) => a.textContent)).toEqual([
      range,
      "The value must be at most 10.",
    ]);
    expect(remission).toHaveAttribute("aria-invalid", "true");
    expect(remission).toHaveAccessibleDescription(range);
    expect(remission).toHaveValue(11);
    expect(
      screen.getByRole("spinbutton", { name: /document size/i }),
    ).toHaveAccessibleDescription("The value must be at most 10.");
  });

  it.each([
    ["saved", enMessages.parameters.state.saved],
    ["unchanged", enMessages.parameters.state.unchanged],
    ["busy", enMessages.parameters.state.busy],
  ] as const)(
    "announces the %s outcome in a live region that is mounted from the start",
    async (kind, text) => {
      const user = userEvent.setup();
      renderForm(async () => ({ kind }));

      const region = screen.getByRole("status");
      expect(region).toHaveAttribute("aria-live", "polite");
      expect(region).toBeEmptyDOMElement();

      await user.click(screen.getByRole("button", { name: "Save changes" }));

      await waitFor(() => expect(within(region).getByText(text)).toBeVisible());
    },
  );

  it("shows the message of an unexpected failure as text", async () => {
    const user = userEvent.setup();
    renderForm(async () => ({ kind: "error", message: "Could not save." }));

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(
      await within(screen.getByRole("status")).findByText("Could not save."),
    ).toBeVisible();
  });
});
