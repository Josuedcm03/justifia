import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { messages, renderIntl } from "@/app/(dashboard)/review/test-support";

const { actionMock } = vi.hoisted(() => ({ actionMock: vi.fn() }));

vi.mock("@/app/(dashboard)/review/[id]/escalation-actions", () => ({
  escalateRequestAction: actionMock,
  recordExcessReportAction: vi.fn(),
}));

import { EscalateDialog } from "@/app/(dashboard)/review/[id]/escalate-dialog";

const en = messages.en.review.escalation;
const NOTE = "La firma del medico no coincide con el sello.";

beforeEach(() => {
  actionMock.mockReset();
  actionMock.mockResolvedValue(undefined);
});

async function open() {
  await userEvent.click(
    screen.getByRole("button", { name: en.dialog.trigger }),
  );
  return screen.findByRole("alertdialog");
}

/** Picks one of the two motives by its visible label. */
async function pick(dialog: HTMLElement, label: string) {
  await userEvent.click(within(dialog).getByRole("radio", { name: label }));
}

describe("EscalateDialog availability (E17)", () => {
  it("offers the escalation when the career has a coordination account", () => {
    renderIntl(<EscalateDialog solicitudId={12} unavailableCareer={null} />);

    expect(
      screen.getByRole("button", { name: en.dialog.trigger }),
    ).toBeEnabled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("offers nothing and names the career when it has no coordination account", () => {
    renderIntl(
      <EscalateDialog solicitudId={12} unavailableCareer="Ingenieria Civil" />,
    );

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("note")).toHaveTextContent(
      "Ingenieria Civil has no registered coordination; ask the administrator to create the account.",
    );
  });

  it("words the unavailable text in neutral Spanish with the career name", () => {
    renderIntl(
      <EscalateDialog solicitudId={12} unavailableCareer="Ingeniería Civil" />,
      "es",
    );

    expect(screen.getByRole("note")).toHaveTextContent(
      "Ingeniería Civil no tiene coordinación registrada; solicite al administrador que cree la cuenta.",
    );
  });
});

describe("EscalateDialog confirmation (RF-10 a, RNF-12)", () => {
  it("asks for confirmation with a required note and a live counter", async () => {
    renderIntl(<EscalateDialog solicitudId={12} unavailableCareer={null} />);

    const dialog = await open();

    expect(within(dialog).getByText(en.dialog.title)).toBeInTheDocument();
    const note = within(dialog).getByRole("textbox", {
      name: en.dialog.noteLabel,
    });
    expect(within(dialog).getByText("0 of 1000")).toBeInTheDocument();
    await userEvent.type(note, "Sello");
    expect(within(dialog).getByText("5 of 1000")).toBeInTheDocument();
    expect(actionMock).not.toHaveBeenCalled();
  });

  it("counts the trimmed note, as the server limit does", async () => {
    renderIntl(<EscalateDialog solicitudId={12} unavailableCareer={null} />);
    const dialog = await open();
    const note = within(dialog).getByRole("textbox", {
      name: en.dialog.noteLabel,
    });

    await userEvent.click(note);
    await userEvent.paste(`  Sello  `);
    expect(within(dialog).getByText("5 of 1000")).toBeInTheDocument();

    // 1000 characters plus trailing spaces is within the limit once trimmed.
    await userEvent.clear(note);
    await userEvent.paste(`${"a".repeat(1000)}   `);
    const counter = within(dialog).getByText("1000 of 1000");
    expect(counter).not.toHaveClass("text-destructive-ink");
  });

  it("offers the two motives as a labelled radio group with none chosen (E18)", async () => {
    renderIntl(<EscalateDialog solicitudId={12} unavailableCareer={null} />);

    const dialog = await open();

    const group = within(dialog).getByRole("radiogroup", {
      name: en.dialog.motivoLabel,
    });
    const radios = within(group).getAllByRole("radio");
    expect(radios.map((r) => r.getAttribute("aria-checked"))).toEqual([
      "false",
      "false",
    ]);
    expect(
      within(group).getByRole("radio", {
        name: en.dialog.motivo.sospecha_documento,
      }),
    ).toBeInTheDocument();
    expect(
      within(group).getByRole("radio", {
        name: en.dialog.motivo.caso_especial,
      }),
    ).toBeInTheDocument();
    expect(actionMock).not.toHaveBeenCalled();
  });

  it("words both motives in neutral Spanish for the secretary", async () => {
    renderIntl(
      <EscalateDialog solicitudId={12} unavailableCareer={null} />,
      "es",
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Escalar a coordinación" }),
    );
    const dialog = await screen.findByRole("alertdialog");

    expect(
      within(dialog).getByRole("radiogroup", {
        name: "Motivo del escalamiento",
      }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("radio", {
        name: "Sospecha sobre un documento",
      }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("radio", {
        name: "Caso especial (fuera de las causas del reglamento)",
      }),
    ).toBeInTheDocument();
  });

  it.each([
    ["sospecha_documento", en.dialog.motivo.sospecha_documento],
    ["caso_especial", en.dialog.motivo.caso_especial],
  ])(
    "sends the request id, the chosen motive %s and the typed note when confirmed",
    async (motivo, label) => {
      renderIntl(<EscalateDialog solicitudId={12} unavailableCareer={null} />);
      const dialog = await open();

      await pick(dialog, label);
      await userEvent.type(
        within(dialog).getByRole("textbox", { name: en.dialog.noteLabel }),
        NOTE,
      );
      await userEvent.click(
        within(dialog).getByRole("button", { name: en.dialog.confirm }),
      );

      await waitFor(() => expect(actionMock).toHaveBeenCalledTimes(1));
      expect(actionMock).toHaveBeenCalledWith({
        solicitudId: 12,
        motivo,
        nota: NOTE,
      });
    },
  );

  it("sends an empty motive when none is chosen, so the server refuses it (E18)", async () => {
    renderIntl(<EscalateDialog solicitudId={12} unavailableCareer={null} />);
    const dialog = await open();

    await userEvent.type(
      within(dialog).getByRole("textbox", { name: en.dialog.noteLabel }),
      NOTE,
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: en.dialog.confirm }),
    );

    await waitFor(() => expect(actionMock).toHaveBeenCalledTimes(1));
    expect(actionMock).toHaveBeenCalledWith({
      solicitudId: 12,
      motivo: "",
      nota: NOTE,
    });
  });

  it("changes nothing when cancelled: no call, dialog closed, draft discarded", async () => {
    renderIntl(<EscalateDialog solicitudId={12} unavailableCareer={null} />);
    let dialog = await open();
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: en.dialog.noteLabel }),
      NOTE,
    );

    await pick(dialog, en.dialog.motivo.caso_especial);

    await userEvent.click(
      within(dialog).getByRole("button", { name: en.dialog.cancel }),
    );

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(actionMock).not.toHaveBeenCalled();
    dialog = await open();
    expect(
      within(dialog).getByRole("textbox", { name: en.dialog.noteLabel }),
    ).toHaveValue("");
    expect(
      within(dialog)
        .getAllByRole("radio")
        .map((r) => r.getAttribute("aria-checked")),
    ).toEqual(["false", "false"]);
  });

  it("closes on Escape without calling the action", async () => {
    renderIntl(<EscalateDialog solicitudId={12} unavailableCareer={null} />);
    await open();

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(actionMock).not.toHaveBeenCalled();
  });
});

describe("EscalateDialog server refusals", () => {
  async function confirmWith(result: unknown) {
    actionMock.mockResolvedValue(result);
    renderIntl(<EscalateDialog solicitudId={12} unavailableCareer={null} />);
    const dialog = await open();
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: en.dialog.noteLabel }),
      "x",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: en.dialog.confirm }),
    );
    return dialog;
  }

  it("shows the motive error under the motive group, with the note error beside it (E18)", async () => {
    const dialog = await confirmWith({
      ok: false,
      reason: "invalid",
      errors: [
        { field: "motivo", code: "motivo_invalid" },
        { field: "nota", code: "nota_required" },
      ],
    });

    const group = within(dialog).getByRole("radiogroup", {
      name: en.dialog.motivoLabel,
    });
    expect(
      await within(dialog).findByText(en.errors.motivo_invalid),
    ).toBeVisible();
    expect(en.errors.motivo_invalid).toBe("Select the escalation reason.");
    expect(group).toHaveAttribute("aria-invalid", "true");
    expect(group).toHaveAccessibleDescription(en.errors.motivo_invalid);
    expect(within(dialog).getByText(en.errors.nota_required)).toBeVisible();
    expect(screen.getByRole("alertdialog")).toBe(dialog);
  });

  it("shows a note error under the note and keeps the dialog open", async () => {
    const dialog = await confirmWith({
      ok: false,
      reason: "invalid",
      errors: [{ field: "nota", code: "nota_required" }],
    });

    const note = within(dialog).getByRole("textbox", {
      name: en.dialog.noteLabel,
    });
    expect(
      await within(dialog).findByText(en.errors.nota_required),
    ).toBeVisible();
    expect(note).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alertdialog")).toBe(dialog);
  });

  it.each([
    ["conflict", en.errors.conflict],
    ["not_found", en.errors.not_found],
    ["unexpected", en.errors.unexpected],
  ])("shows the %s refusal as an alert banner", async (reason, text) => {
    const dialog = await confirmWith({ ok: false, reason });

    expect(await within(dialog).findByText(text)).toBeVisible();
    expect(within(dialog).getByRole("alert")).toHaveTextContent(text);
  });

  it("shows the career-named refusal when the server finds no coordination account", async () => {
    const dialog = await confirmWith({
      ok: false,
      reason: "sin_coordinacion",
      carreraNombre: "Ingenieria Civil",
    });

    expect(
      await within(dialog).findByText(
        "Ingenieria Civil has no registered coordination; ask the administrator to create the account.",
      ),
    ).toBeVisible();
  });
});
