import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CalendarSection } from "@/app/(dashboard)/parameters/calendar-section";
import type { ParameterFormState } from "@/lib/parameters/form-state";
import { renderWithIntl } from "@/test/intl";

type Action = (
  previous: ParameterFormState,
  formData: FormData,
) => Promise<ParameterFormState>;

const ENTRIES = [
  { fecha: "2026-12-25", descripcion: "Christmas" },
  { fecha: "2026-12-31", descripcion: null },
  { fecha: "2027-01-01", descripcion: "New Year" },
];

function renderSection(action?: Action) {
  const dispatch = vi.fn<Action>(action ?? (async () => ({ kind: "saved" })));
  renderWithIntl(<CalendarSection action={dispatch} entries={ENTRIES} />, "en");
  return dispatch;
}

const save = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("button", { name: "Save changes" }));

/** The whole list the form sent, as the action reads it. */
const sentList = (action: ReturnType<typeof renderSection>) =>
  JSON.parse(String(action.mock.calls[0][1].get("calendario")));

describe("CalendarSection (NP-10)", () => {
  it("lists the dates in a table card with their optional descriptions", () => {
    renderSection();

    expect(document.querySelector('[data-slot="table-card"]')).not.toBeNull();
    expect(screen.getByLabelText("Date, row 1")).toHaveValue("2026-12-25");
    expect(screen.getByLabelText("Description, row 1")).toHaveValue(
      "Christmas",
    );
    expect(screen.getByLabelText("Description, row 2")).toHaveValue("");
    expect(screen.getByLabelText("Date, row 3")).toHaveValue("2027-01-01");
  });

  it("saves the whole list once, with an added row and no confirmation step", async () => {
    const user = userEvent.setup();
    const action = renderSection();

    await user.click(screen.getByRole("button", { name: "Add date" }));
    fireEvent.change(screen.getByLabelText("Date, row 4"), {
      target: { value: "2027-05-01" },
    });
    await user.type(screen.getByLabelText("Description, row 4"), "Labour Day");
    await save(user);

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(sentList(action)).toEqual([
      { fecha: "2026-12-25", descripcion: "Christmas" },
      { fecha: "2026-12-31", descripcion: "" },
      { fecha: "2027-01-01", descripcion: "New Year" },
      { fecha: "2027-05-01", descripcion: "Labour Day" },
    ]);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("marks a row removed, leaves it out of the save, and restores it", async () => {
    const user = userEvent.setup();
    const action = renderSection();

    await user.click(screen.getByRole("button", { name: "Remove row 2" }));

    expect(screen.getByText("Will be removed when you save")).toBeVisible();
    expect(screen.queryByLabelText("Date, row 2")).not.toBeInTheDocument();
    await save(user);
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(
      sentList(action).map((entry: { fecha: string }) => entry.fecha),
    ).toEqual(["2026-12-25", "2027-01-01"]);

    await user.click(screen.getByRole("button", { name: "Restore row 2" }));
    expect(screen.getByLabelText("Date, row 2")).toHaveValue("2026-12-31");
    expect(
      screen.queryByText("Will be removed when you save"),
    ).not.toBeInTheDocument();
  });

  it("shows no per-year count and no current-year warning", () => {
    renderSection();

    expect(screen.queryByText(/year/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+ dates/i)).not.toBeInTheDocument();
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
  });

  it("ties each error to its field, counting rows of the submitted list", async () => {
    const user = userEvent.setup();
    const action = renderSection(async () => ({
      kind: "invalid",
      fieldErrors: {
        "fecha.1": "Enter a real date.",
        "descripcion.0": "At most 120 characters.",
        calendario: "The calendar is not valid.",
      },
      values: {},
    }));

    // Row 1 is removed, so the submitted list starts at the old row 2.
    await user.click(screen.getByRole("button", { name: "Remove row 1" }));
    await save(user);

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByLabelText("Date, row 3"),
    ).toHaveAccessibleDescription("Enter a real date.");
    expect(
      screen.getByLabelText("Description, row 2"),
    ).toHaveAccessibleDescription("At most 120 characters.");
    expect(screen.getByLabelText("Date, row 3")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    const alerts = screen
      .getAllByRole("alert")
      .map((alert) => alert.textContent);
    expect(alerts).toEqual(
      expect.arrayContaining([
        "Enter a real date.",
        "At most 120 characters.",
        "The calendar is not valid.",
      ]),
    );
    expect(
      within(screen.getByRole("status")).queryByText("Enter a real date."),
    ).not.toBeInTheDocument();
  });
});
