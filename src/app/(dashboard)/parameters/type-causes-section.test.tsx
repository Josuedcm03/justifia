import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import enMessages from "../../../../i18n/en.json";
import { TypeCausesSection } from "@/app/(dashboard)/parameters/type-causes-section";
import type { ParameterFormState } from "@/lib/parameters/form-state";
import { DOCUMENT_TYPE_CAUSES } from "@/lib/signals/document-type-causes";
import { renderWithIntl } from "@/test/intl";

type Action = (
  previous: ParameterFormState,
  formData: FormData,
) => Promise<ParameterFormState>;

const CAUSES = enMessages.intake.causes;

function renderSection(action?: Action) {
  const dispatch = vi.fn<Action>(action ?? (async () => ({ kind: "saved" })));
  renderWithIntl(
    <TypeCausesSection action={dispatch} map={DOCUMENT_TYPE_CAUSES} />,
    "en",
  );
  return dispatch;
}

const group = (name: string) => screen.getByRole("group", { name });

describe("TypeCausesSection (NP-12)", () => {
  it("has one fieldset per document type, with the stored cells checked", () => {
    renderSection();

    expect(screen.getAllByRole("group")).toHaveLength(3);
    const medical = group("Medical certificate");
    expect(
      within(medical).getByRole("checkbox", { name: CAUSES.medica }),
    ).toBeChecked();
    expect(
      within(medical).getByRole("checkbox", { name: CAUSES.fuerza_mayor }),
    ).not.toBeChecked();
    expect(within(medical).getAllByRole("checkbox")).toHaveLength(5);
  });

  it("gives `otro` no editable cell and says it corresponds to no cause", () => {
    renderSection();

    const other = group("Other");
    expect(within(other).queryAllByRole("checkbox")).toHaveLength(0);
    expect(within(other).getByText(/corresponds to no cause/i)).toBeVisible();
  });

  it("leaves every cell editable, whatever the cause", () => {
    renderSection();

    for (const checkbox of screen.getAllByRole("checkbox")) {
      expect(checkbox).toBeEnabled();
    }
  });

  it("saves the whole table with one press and no confirmation step", async () => {
    const user = userEvent.setup();
    const action = renderSection();

    await user.click(
      within(group("Medical certificate")).getByRole("checkbox", {
        name: CAUSES.fuerza_mayor,
      }),
    );
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const sent = action.mock.calls[0][1];
    expect([...sent.keys()]).toEqual(["tipo_documento_causa"]);
    expect(JSON.parse(String(sent.get("tipo_documento_causa")))).toEqual({
      constancia_medica: ["maternidad_paternidad", "medica", "fuerza_mayor"],
      constancia_institucional: [
        "actividad_representativa",
        "intercambio_academico",
        "fuerza_mayor",
      ],
      otro: [],
    });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("shows the refusal of the table as an announced error", async () => {
    const user = userEvent.setup();
    renderSection(async () => ({
      kind: "invalid",
      fieldErrors: { tipo_documento_causa: "The table is not valid." },
      values: {},
    }));

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The table is not valid.",
    );
  });
});
