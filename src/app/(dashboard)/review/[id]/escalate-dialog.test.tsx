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

/** Picks one of the motives by its visible label. */
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

  it("offers the three motives as a labelled radio group with none chosen (E18, FE-9)", async () => {
    renderIntl(<EscalateDialog solicitudId={12} unavailableCareer={null} />);

    const dialog = await open();

    const group = within(dialog).getByRole("radiogroup", {
      name: en.dialog.motivoLabel,
    });
    const radios = within(group).getAllByRole("radio");
    expect(radios.map((r) => r.getAttribute("aria-checked"))).toEqual([
      "false",
      "false",
      "false",
    ]);
    expect(radios.map((r) => r.closest("label")?.textContent)).toEqual([
      en.dialog.motivo.sospecha_documento,
      en.dialog.motivo.caso_especial,
      en.dialog.motivo.otro,
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
    expect(
      within(group).getByRole("radio", { name: en.dialog.motivo.otro }),
    ).toBeInTheDocument();
    expect(actionMock).not.toHaveBeenCalled();
  });

  it("words the three motives in Spanish for the secretary", async () => {
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
    expect(
      within(dialog).getByRole("radio", { name: "Otro" }),
    ).toBeInTheDocument();
  });

  it.each([
    ["sospecha_documento", en.dialog.motivo.sospecha_documento],
    ["caso_especial", en.dialog.motivo.caso_especial],
    ["otro", en.dialog.motivo.otro],
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
    ).toEqual(["false", "false", "false"]);
  });

  it("closes on Escape without calling the action", async () => {
    renderIntl(<EscalateDialog solicitudId={12} unavailableCareer={null} />);
    await open();

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(actionMock).not.toHaveBeenCalled();
  });
});

describe("EscalateDialog earlier answer notice (FE-12, RF-16 c)", () => {
  const PREVIOUS = {
    text: "Verified with the teacher; the document is valid.",
    byline: "Marta Gomez, Oct 9, 2026, 3:00 PM",
  };

  it("shows the earlier answer, its author and date above the motive, as a note", async () => {
    renderIntl(
      <EscalateDialog
        solicitudId={12}
        unavailableCareer={null}
        previousAnswer={PREVIOUS}
      />,
    );
    const dialog = await open();

    const note = within(dialog).getByRole("note");
    expect(note).toHaveTextContent(PREVIOUS.text);
    expect(note).toHaveTextContent(
      "Coordination already answered this request (Marta Gomez, Oct 9, 2026, 3:00 PM):",
    );
    expect(note).toHaveTextContent(en.dialog.previousAnswer.hint);
    const motive = within(dialog).getByRole("radiogroup", {
      name: en.dialog.motivoLabel,
    });
    expect(
      note.compareDocumentPosition(motive) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("is informational: no alert, no error styling and confirm stays enabled", async () => {
    renderIntl(
      <EscalateDialog
        solicitudId={12}
        unavailableCareer={null}
        previousAnswer={PREVIOUS}
      />,
    );
    const dialog = await open();

    const note = within(dialog).getByRole("note");
    expect(within(dialog).queryByRole("alert")).toBeNull();
    expect(note.className).not.toMatch(/destructive/);
    expect(note.querySelector("[class*=destructive]")).toBeNull();
    expect(
      within(dialog).getByRole("button", { name: en.dialog.confirm }),
    ).toBeEnabled();
  });

  it("still escalates a second time with one confirmation and one action call", async () => {
    renderIntl(
      <EscalateDialog
        solicitudId={12}
        unavailableCareer={null}
        previousAnswer={PREVIOUS}
      />,
    );
    const dialog = await open();

    await pick(dialog, en.dialog.motivo.caso_especial);
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
      motivo: "caso_especial",
      nota: NOTE,
    });
  });

  it.each([
    ["omitted", undefined],
    ["null", null],
  ])(
    "shows no notice when the earlier answer is %s",
    async (_name, previous) => {
      renderIntl(
        <EscalateDialog
          solicitudId={12}
          unavailableCareer={null}
          previousAnswer={previous}
        />,
      );
      const dialog = await open();

      expect(within(dialog).queryByRole("note")).toBeNull();
      expect(within(dialog).queryByText(/already answered/)).toBeNull();
    },
  );

  it("keeps a long answer inside a scrollable box that wraps", async () => {
    const long = "respuesta-larga-".repeat(60);
    renderIntl(
      <EscalateDialog
        solicitudId={12}
        unavailableCareer={null}
        previousAnswer={{ ...PREVIOUS, text: long }}
      />,
    );
    const dialog = await open();

    expect(within(dialog).getByText(long)).toHaveClass(
      "max-h-32",
      "overflow-y-auto",
      "break-words",
      "whitespace-pre-wrap",
    );
  });

  it("words the notice in Spanish for the secretary", async () => {
    renderIntl(
      <EscalateDialog
        solicitudId={12}
        unavailableCareer={null}
        previousAnswer={{
          text: "El documento es válido.",
          byline: "Marta Gomez, 9 oct 2026, 15:00",
        }}
      />,
      "es",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Escalar a coordinación" }),
    );
    const dialog = await screen.findByRole("alertdialog");

    const note = within(dialog).getByRole("note");
    expect(note).toHaveTextContent(
      "La coordinación ya respondió esta solicitud (Marta Gomez, 9 oct 2026, 15:00):",
    );
    expect(note).toHaveTextContent(
      "Si la escala de nuevo, vuelve a coordinación y no podrá decidir hasta que responda.",
    );
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

// flow-experience S3 (RF-10 a, b; FE-10, FE-11): the note is announced as
// required, and a field message never outlives the input it describes. The
// literals pin the copy, not just the catalog keys.
describe("EscalateDialog required note and stale messages (FE-10, FE-11)", () => {
  const MOTIVO_ERROR = { field: "motivo", code: "motivo_invalid" };
  const NOTA_ERROR = { field: "nota", code: "nota_required" };
  const BOTH = {
    ok: false,
    reason: "invalid",
    errors: [MOTIVO_ERROR, NOTA_ERROR],
  };
  const NOTE_ONLY = { ok: false, reason: "invalid", errors: [NOTA_ERROR] };

  async function confirm(dialog: HTMLElement) {
    await userEvent.click(
      within(dialog).getByRole("button", { name: en.dialog.confirm }),
    );
  }

  /** Opens the dialog and confirms it empty; the server names both errors. */
  async function confirmedEmpty() {
    actionMock.mockResolvedValueOnce(BOTH);
    renderIntl(<EscalateDialog solicitudId={12} unavailableCareer={null} />);
    const dialog = await open();
    await confirm(dialog);
    await within(dialog).findByText(en.errors.motivo_invalid);
    return dialog;
  }

  const noteBox = (dialog: HTMLElement) =>
    within(dialog).getByRole("textbox", { name: en.dialog.noteLabel });
  const motiveGroup = (dialog: HTMLElement) =>
    within(dialog).getByRole("radiogroup", { name: en.dialog.motivoLabel });

  describe("the note is announced as required (FE-10)", () => {
    it("labels it as required, with the example and the staff-only statement, and shows no error", async () => {
      renderIntl(<EscalateDialog solicitudId={12} unavailableCareer={null} />);
      const dialog = await open();

      const note = within(dialog).getByRole("textbox", {
        name: "Note for coordination (required)",
      });
      expect(note).toHaveAttribute("aria-required", "true");
      expect(note).not.toHaveAttribute("aria-invalid");
      expect(note).toHaveAccessibleDescription(
        "Explain why you are escalating the request; for example, which document detail does not match or which situation the regulation does not cover. Only staff can see it.",
      );
      expect(within(dialog).queryByRole("alert")).toBeNull();
    });

    it("words the label and the hint in Spanish for the secretary", async () => {
      renderIntl(
        <EscalateDialog solicitudId={12} unavailableCareer={null} />,
        "es",
      );
      await userEvent.click(
        screen.getByRole("button", { name: "Escalar a coordinación" }),
      );
      const dialog = await screen.findByRole("alertdialog");

      const note = within(dialog).getByRole("textbox", {
        name: "Nota para coordinación (obligatoria)",
      });
      expect(note).toHaveAccessibleDescription(
        "Explique por qué escala la solicitud; por ejemplo, qué dato del documento no coincide o qué situación no prevé el reglamento. Solo la ve el personal.",
      );
    });

    it("does not turn on the browser's validation: the server stays the authority", async () => {
      renderIntl(<EscalateDialog solicitudId={12} unavailableCareer={null} />);
      const dialog = await open();

      expect(noteBox(dialog)).not.toHaveAttribute("required");
    });
  });

  describe("messages follow the input (FE-11)", () => {
    it("shows both errors after confirming with nothing filled", async () => {
      const dialog = await confirmedEmpty();

      expect(within(dialog).getByText(en.errors.motivo_invalid)).toBeVisible();
      expect(within(dialog).getByText(en.errors.nota_required)).toBeVisible();
      expect(motiveGroup(dialog)).toHaveAttribute("aria-invalid", "true");
      expect(noteBox(dialog)).toHaveAttribute("aria-invalid", "true");
    });

    it("clears only the motive error when a motive is chosen", async () => {
      const dialog = await confirmedEmpty();

      await pick(dialog, en.dialog.motivo.caso_especial);

      expect(within(dialog).queryByText(en.errors.motivo_invalid)).toBeNull();
      expect(motiveGroup(dialog)).not.toHaveAttribute("aria-invalid");
      expect(within(dialog).getByText(en.errors.nota_required)).toBeVisible();
      expect(noteBox(dialog)).toHaveAttribute("aria-invalid", "true");
      expect(noteBox(dialog)).toHaveAccessibleDescription(
        en.errors.nota_required,
      );
    });

    it("clears only the note error when the note is typed in", async () => {
      const dialog = await confirmedEmpty();

      await userEvent.type(noteBox(dialog), "x");

      expect(within(dialog).queryByText(en.errors.nota_required)).toBeNull();
      expect(noteBox(dialog)).not.toHaveAttribute("aria-invalid");
      expect(within(dialog).getByText(en.errors.motivo_invalid)).toBeVisible();
      expect(motiveGroup(dialog)).toHaveAttribute("aria-invalid", "true");
    });

    it("leaves no refusal banner behind once both are cleared", async () => {
      const dialog = await confirmedEmpty();

      await pick(dialog, en.dialog.motivo.sospecha_documento);
      await userEvent.type(noteBox(dialog), NOTE);

      expect(within(dialog).queryByRole("alert")).toBeNull();
      expect(within(dialog).queryByText(en.errors.unexpected)).toBeNull();
      expect(within(dialog).queryByText(en.errors.motivo_invalid)).toBeNull();
      expect(within(dialog).queryByText(en.errors.nota_required)).toBeNull();
    });

    it("leaves no refusal banner behind in the other order either", async () => {
      const dialog = await confirmedEmpty();

      await userEvent.type(noteBox(dialog), NOTE);
      await pick(dialog, en.dialog.motivo.caso_especial);

      expect(within(dialog).queryByRole("alert")).toBeNull();
      expect(within(dialog).queryByText(en.errors.unexpected)).toBeNull();
    });

    it("fails again when the form is still invalid: the note error comes back", async () => {
      const dialog = await confirmedEmpty();
      await userEvent.type(noteBox(dialog), "x");
      await userEvent.clear(noteBox(dialog));
      await pick(dialog, en.dialog.motivo.caso_especial);
      expect(within(dialog).queryByText(en.errors.nota_required)).toBeNull();

      actionMock.mockResolvedValueOnce(NOTE_ONLY);
      await confirm(dialog);

      expect(
        await within(dialog).findByText(en.errors.nota_required),
      ).toBeVisible();
      expect(within(dialog).queryByText(en.errors.motivo_invalid)).toBeNull();
      expect(actionMock).toHaveBeenCalledTimes(2);
      expect(actionMock).toHaveBeenLastCalledWith({
        solicitudId: 12,
        motivo: "caso_especial",
        nota: "",
      });
      expect(screen.getByRole("alertdialog")).toBe(dialog);
    });

    it.each([
      ["conflict", { ok: false, reason: "conflict" }, en.errors.conflict],
      ["not_found", { ok: false, reason: "not_found" }, en.errors.not_found],
      ["unexpected", { ok: false, reason: "unexpected" }, en.errors.unexpected],
      [
        "sin_coordinacion",
        {
          ok: false,
          reason: "sin_coordinacion",
          carreraNombre: "Ingenieria Civil",
        },
        "Ingenieria Civil has no registered coordination; ask the administrator to create the account.",
      ],
    ])(
      "keeps the %s message while the fields are edited, until the next confirmation",
      async (_reason, failure, text) => {
        actionMock.mockResolvedValueOnce(failure);
        renderIntl(
          <EscalateDialog solicitudId={12} unavailableCareer={null} />,
        );
        const dialog = await open();
        await confirm(dialog);
        expect(await within(dialog).findByText(text)).toBeVisible();

        await pick(dialog, en.dialog.motivo.caso_especial);
        await userEvent.type(noteBox(dialog), NOTE);

        expect(within(dialog).getByText(text)).toBeVisible();
        expect(within(dialog).getByRole("alert")).toHaveTextContent(text);

        // The next confirmation replaces it.
        await confirm(dialog);
        await waitFor(() =>
          expect(within(dialog).queryByRole("alert")).toBeNull(),
        );
        expect(actionMock).toHaveBeenCalledTimes(2);
      },
    );

    it("starts with no message when the dialog is reopened", async () => {
      const dialog = await confirmedEmpty();

      await userEvent.click(
        within(dialog).getByRole("button", { name: en.dialog.cancel }),
      );
      await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
      const reopened = await open();

      expect(within(reopened).queryByRole("alert")).toBeNull();
      expect(within(reopened).queryByText(en.errors.motivo_invalid)).toBeNull();
      expect(within(reopened).queryByText(en.errors.nota_required)).toBeNull();
      expect(noteBox(reopened)).not.toHaveAttribute("aria-invalid");
    });
  });
});

// flow-experience S8 (RF-10 a, b; FE-9, FE-10): the motive "otro" is offered as
// the third radio and its note is the description of the reason, so choosing it
// swaps the hint. Staff screens address the secretary as "usted".
describe("EscalateDialog motive otro (FE-9, FE-10)", () => {
  const HINT_OTRO_ES =
    "Esta nota es la descripción del motivo: explique la situación que lo lleva a escalar la solicitud y por qué no corresponde a los otros dos motivos. Solo la ve el personal.";
  const HINT_OTRO_EN =
    "This note is the description of the reason: explain the situation that leads you to escalate the request and why it fits neither of the other two reasons. Only staff can see it.";
  const noteBox = (dialog: HTMLElement) =>
    within(dialog).getByRole("textbox", { name: en.dialog.noteLabel });

  it("labels the third motive Otro in Spanish and Other in English", () => {
    expect(en.dialog.motivo.otro).toBe("Other");
    expect(messages.es.review.escalation.dialog.motivo.otro).toBe("Otro");
  });

  it("keeps the standard hint until Other is chosen, then says the note is the description", async () => {
    renderIntl(<EscalateDialog solicitudId={12} unavailableCareer={null} />);
    const dialog = await open();
    expect(noteBox(dialog)).toHaveAccessibleDescription(en.dialog.noteHint);

    await pick(dialog, en.dialog.motivo.otro);

    expect(en.dialog.noteHintOtro).toBe(HINT_OTRO_EN);
    expect(noteBox(dialog)).toHaveAccessibleDescription(HINT_OTRO_EN);
    expect(within(dialog).queryByText(en.dialog.noteHint)).toBeNull();
  });

  it("words the hint of Otro in Spanish with usted", async () => {
    renderIntl(
      <EscalateDialog solicitudId={12} unavailableCareer={null} />,
      "es",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Escalar a coordinación" }),
    );
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("radio", { name: "Otro" }));

    expect(
      within(dialog).getByRole("textbox", {
        name: "Nota para coordinación (obligatoria)",
      }),
    ).toHaveAccessibleDescription(HINT_OTRO_ES);
  });

  it("returns to the standard hint when another motive is chosen", async () => {
    renderIntl(<EscalateDialog solicitudId={12} unavailableCareer={null} />);
    const dialog = await open();

    await pick(dialog, en.dialog.motivo.otro);
    await pick(dialog, en.dialog.motivo.caso_especial);

    expect(noteBox(dialog)).toHaveAccessibleDescription(en.dialog.noteHint);
    expect(within(dialog).queryByText(HINT_OTRO_EN)).toBeNull();
  });

  it("keeps the standard hint for the two original motives", async () => {
    renderIntl(<EscalateDialog solicitudId={12} unavailableCareer={null} />);
    const dialog = await open();

    await pick(dialog, en.dialog.motivo.sospecha_documento);
    expect(noteBox(dialog)).toHaveAccessibleDescription(en.dialog.noteHint);
    await pick(dialog, en.dialog.motivo.caso_especial);
    expect(noteBox(dialog)).toHaveAccessibleDescription(en.dialog.noteHint);
  });

  it("shows the note error for Other with an empty note, and nothing is escalated", async () => {
    actionMock.mockResolvedValueOnce({
      ok: false,
      reason: "invalid",
      errors: [{ field: "nota", code: "nota_required" }],
    });
    renderIntl(<EscalateDialog solicitudId={12} unavailableCareer={null} />);
    const dialog = await open();

    await pick(dialog, en.dialog.motivo.otro);
    await userEvent.click(
      within(dialog).getByRole("button", { name: en.dialog.confirm }),
    );

    expect(
      await within(dialog).findByText(en.errors.nota_required),
    ).toBeVisible();
    expect(actionMock).toHaveBeenCalledWith({
      solicitudId: 12,
      motivo: "otro",
      nota: "",
    });
    expect(noteBox(dialog)).toHaveAttribute("aria-invalid", "true");
    expect(noteBox(dialog)).toHaveAccessibleDescription(
      en.errors.nota_required,
    );
    expect(screen.getByRole("alertdialog")).toBe(dialog);
  });
});
