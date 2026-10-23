import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { messages, renderIntl } from "@/app/(dashboard)/review/test-support";

const { actionMock } = vi.hoisted(() => ({ actionMock: vi.fn() }));

vi.mock("@/app/(dashboard)/review/[id]/escalation-actions", () => ({
  escalateRequestAction: vi.fn(),
  recordExcessReportAction: actionMock,
}));

import { ReportDialog } from "@/app/(dashboard)/review/[id]/report-dialog";

const en = messages.en.review.report;
const TEACHERS = [
  { remisionId: 31, nombre: "Luis Mora" },
  { remisionId: 32, nombre: "Pedro Ruiz" },
];

beforeEach(() => {
  actionMock.mockReset();
  actionMock.mockResolvedValue(undefined);
});

function show(teachers = TEACHERS) {
  return renderIntl(
    <ReportDialog solicitudId={12} teachers={teachers} maxDate="2026-10-14" />,
  );
}

async function open() {
  await userEvent.click(
    screen.getByRole("button", { name: en.dialog.trigger }),
  );
  return screen.findByRole("alertdialog");
}

describe("ReportDialog form (RF-15 a: teacher, date, optional note)", () => {
  it("offers the request's remitted teachers only, after a placeholder", async () => {
    show();
    const dialog = await open();

    const select = within(dialog).getByRole("combobox", {
      name: en.dialog.teacherLabel,
    });
    expect(
      within(select)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual([en.dialog.teacherPlaceholder, "Luis Mora", "Pedro Ruiz"]);
  });

  it("limits the date to today and asks for nothing else but an optional note", async () => {
    show();
    const dialog = await open();

    const date = within(dialog).getByLabelText(en.dialog.dateLabel);
    expect(date).toHaveAttribute("type", "date");
    expect(date).toHaveAttribute("max", "2026-10-14");
    expect(
      within(dialog).getByRole("textbox", { name: en.dialog.noteLabel }),
    ).toBeInTheDocument();
    // No percentage or absence count is asked for (RF-15 a).
    expect(within(dialog).queryByRole("spinbutton")).toBeNull();
    expect(
      within(dialog).queryByLabelText(/percent|%|count|number of/i),
    ).toBeNull();
    expect(within(dialog).getAllByRole("textbox")).toHaveLength(1);
    expect(within(dialog).getAllByRole("combobox")).toHaveLength(1);
  });

  it("offers nothing and says why when the request has no remitted teacher", () => {
    show([]);

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("note")).toHaveTextContent(en.section.noTeachers);
  });
});

describe("ReportDialog confirmation (RNF-12)", () => {
  it("sends the chosen remission, the date and the note only when confirmed", async () => {
    show();
    const dialog = await open();

    await userEvent.selectOptions(
      within(dialog).getByRole("combobox", { name: en.dialog.teacherLabel }),
      "32",
    );
    await userEvent.type(
      within(dialog).getByLabelText(en.dialog.dateLabel),
      "2026-10-13",
    );
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: en.dialog.noteLabel }),
      "Supera el limite",
    );
    expect(actionMock).not.toHaveBeenCalled();
    await userEvent.click(
      within(dialog).getByRole("button", { name: en.dialog.confirm }),
    );

    await waitFor(() => expect(actionMock).toHaveBeenCalledTimes(1));
    expect(actionMock).toHaveBeenCalledWith({
      solicitudId: 12,
      remisionId: 32,
      comunicadoEl: "2026-10-13",
      nota: "Supera el limite",
    });
  });

  it("sends no teacher when none is chosen, and the server's answer is shown", async () => {
    actionMock.mockResolvedValue({
      ok: false,
      reason: "invalid",
      errors: [
        { field: "docente", code: "docente_invalid" },
        { field: "comunicadoEl", code: "date_invalid" },
      ],
    });
    show();
    const dialog = await open();

    await userEvent.click(
      within(dialog).getByRole("button", { name: en.dialog.confirm }),
    );

    await waitFor(() => expect(actionMock).toHaveBeenCalledTimes(1));
    expect(actionMock.mock.calls[0][0].remisionId).toBeNull();
    const select = within(dialog).getByRole("combobox", {
      name: en.dialog.teacherLabel,
    });
    expect(
      await within(dialog).findByText(en.errors.docente_invalid),
    ).toBeVisible();
    expect(select).toHaveAttribute("aria-invalid", "true");
    expect(within(dialog).getByText(en.errors.date_invalid)).toBeVisible();
    expect(within(dialog).getByLabelText(en.dialog.dateLabel)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("shows a future date and a note error under their own fields", async () => {
    actionMock.mockResolvedValue({
      ok: false,
      reason: "invalid",
      errors: [
        { field: "comunicadoEl", code: "date_future" },
        { field: "nota", code: "nota_blank" },
      ],
    });
    show();
    const dialog = await open();

    await userEvent.click(
      within(dialog).getByRole("button", { name: en.dialog.confirm }),
    );

    expect(
      await within(dialog).findByText(en.errors.date_future),
    ).toBeVisible();
    expect(within(dialog).getByText(en.errors.nota_blank)).toBeVisible();
  });

  it.each([
    ["conflict", en.errors.conflict],
    ["not_found", en.errors.not_found],
    ["unexpected", en.errors.unexpected],
  ])("shows the %s refusal as an alert banner", async (reason, text) => {
    actionMock.mockResolvedValue({ ok: false, reason });
    show();
    const dialog = await open();

    await userEvent.click(
      within(dialog).getByRole("button", { name: en.dialog.confirm }),
    );

    expect(await within(dialog).findByText(text)).toBeVisible();
    expect(within(dialog).getByRole("alert")).toHaveTextContent(text);
  });

  it("changes nothing when cancelled and discards the draft", async () => {
    show();
    let dialog = await open();
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: en.dialog.noteLabel }),
      "Borrador",
    );

    await userEvent.click(
      within(dialog).getByRole("button", { name: en.dialog.cancel }),
    );

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(actionMock).not.toHaveBeenCalled();
    dialog = await open();
    expect(
      within(dialog).getByRole("textbox", { name: en.dialog.noteLabel }),
    ).toHaveValue("");
  });
});
