import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import enMessages from "../../../../i18n/en.json";
import { CausesSection } from "@/app/(dashboard)/parameters/causes-section";
import { CAUSAS } from "@/lib/intake/causes";
import type { ParameterFormState } from "@/lib/parameters/form-state";
import type { CauseSetting } from "@/lib/parameters/registry";
import { renderWithIntl } from "@/test/intl";

type Action = (
  previous: ParameterFormState,
  formData: FormData,
) => Promise<ParameterFormState>;

const LABEL = enMessages.intake.causes;
const STORED: readonly CauseSetting[] = CAUSAS.map((codigo, index) => ({
  codigo,
  activa: true,
  posicion: index + 1,
}));

function renderSection(causes: readonly CauseSetting[] = STORED) {
  const action = vi.fn<Action>(async () => ({ kind: "saved" }));
  renderWithIntl(<CausesSection action={action} causes={causes} />, "en");
  return action;
}

const user = () => userEvent.setup();
const save = () => screen.getByRole("button", { name: "Save changes" });
const box = (cause: keyof typeof LABEL) =>
  screen.getByRole("checkbox", { name: LABEL[cause] });
const sentList = (action: ReturnType<typeof renderSection>) =>
  JSON.parse(String(action.mock.calls[0][1].get("causas")));

describe("CausesSection (NP-11)", () => {
  it("lists the five causes in stored order with an active box and move buttons", () => {
    renderSection();

    expect(screen.getAllByRole("checkbox")).toHaveLength(5);
    expect(
      screen.getAllByRole("listitem").map((item) => item.textContent),
    ).toEqual(CAUSAS.map((cause) => LABEL[cause]));
    expect(
      screen.getAllByRole("button", { name: /^Move .* up$/ }),
    ).toHaveLength(5);
    expect(
      screen.getByRole("button", {
        name: `Move ${LABEL.maternidad_paternidad} up`,
      }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: /add|rename|delete/i }),
    ).not.toBeInTheDocument();
  });

  it("submits a save that only reorders at once, with no dialog", async () => {
    const u = user();
    const action = renderSection();

    await u.click(
      screen.getByRole("button", { name: `Move ${LABEL.medica} up` }),
    );
    await u.click(save());

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(sentList(action).map((c: { codigo: string }) => c.codigo)).toEqual([
      "maternidad_paternidad",
      "actividad_representativa",
      "medica",
      "intercambio_academico",
      "fuerza_mayor",
    ]);
    expect(
      sentList(action).map((c: { posicion: number }) => c.posicion),
    ).toEqual([1, 2, 3, 4, 5]);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("submits a reactivation at once, with no dialog", async () => {
    const u = user();
    const action = renderSection(
      STORED.map((c) => (c.codigo === "medica" ? { ...c, activa: false } : c)),
    );

    await u.click(box("medica"));
    await u.click(save());

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("asks first when a save deactivates a cause, naming it, and submits nothing yet", async () => {
    const u = user();
    const action = renderSection();

    await u.click(box("medica"));
    await u.click(save());

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveAccessibleName(expect.stringContaining(LABEL.medica));
    expect(action).not.toHaveBeenCalled();
  });

  it("submits the form once when the deactivation is confirmed", async () => {
    const u = user();
    const action = renderSection();

    await u.click(box("medica"));
    await u.click(save());
    await u.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Yes, deactivate",
      }),
    );

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(
      sentList(action).find((c: { codigo: string }) => c.codigo === "medica"),
    ).toEqual({ codigo: "medica", activa: false, posicion: 4 });
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
  });

  it("calls no action on cancel, keeps the typed values and returns focus to save", async () => {
    const u = user();
    const action = renderSection();

    await u.click(box("medica"));
    await u.click(save());
    await u.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Cancel",
      }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(action).not.toHaveBeenCalled();
    expect(box("medica")).not.toBeChecked();
    await waitFor(() => expect(save()).toHaveFocus());
  });
});
