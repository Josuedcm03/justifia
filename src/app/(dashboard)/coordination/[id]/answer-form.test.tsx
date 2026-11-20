import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { messages, renderIntl } from "@/app/(dashboard)/review/test-support";

const { actionMock } = vi.hoisted(() => ({ actionMock: vi.fn() }));

vi.mock("@/app/(dashboard)/coordination/[id]/actions", () => ({
  answerEscalationAction: actionMock,
}));

import { AnswerForm } from "@/app/(dashboard)/coordination/[id]/answer-form";

const en = messages.en.coordination.answer;
const ANSWER = "Los documentos son consistentes con la causa declarada.";

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

describe("AnswerForm confirmation (RF-10, E3, RNF-12)", () => {
  it("asks for confirmation with a required answer and a live counter", async () => {
    renderIntl(<AnswerForm escalamientoId={9} />);

    const dialog = await open();

    expect(within(dialog).getByText(en.dialog.title)).toBeInTheDocument();
    const field = within(dialog).getByRole("textbox", {
      name: en.dialog.noteLabel,
    });
    expect(within(dialog).getByText("0 of 1000")).toBeInTheDocument();
    await userEvent.type(field, "Firma");
    expect(within(dialog).getByText("5 of 1000")).toBeInTheDocument();
    expect(actionMock).not.toHaveBeenCalled();
  });

  it("sends only the escalation id and the typed text when confirmed", async () => {
    renderIntl(<AnswerForm escalamientoId={9} />);
    const dialog = await open();

    await userEvent.type(
      within(dialog).getByRole("textbox", { name: en.dialog.noteLabel }),
      ANSWER,
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: en.dialog.confirm }),
    );

    await waitFor(() => expect(actionMock).toHaveBeenCalledTimes(1));
    expect(actionMock).toHaveBeenCalledWith({
      escalamientoId: 9,
      texto: ANSWER,
    });
  });

  it("changes nothing when cancelled: no call, dialog closed, draft discarded", async () => {
    renderIntl(<AnswerForm escalamientoId={9} />);
    let dialog = await open();
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: en.dialog.noteLabel }),
      ANSWER,
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

  it("closes on Escape without calling the action", async () => {
    renderIntl(<AnswerForm escalamientoId={9} />);
    await open();

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(actionMock).not.toHaveBeenCalled();
  });

  it("words the dialog in neutral Spanish", async () => {
    renderIntl(<AnswerForm escalamientoId={9} />, "es");

    const dialog = await (async () => {
      await userEvent.click(
        screen.getByRole("button", {
          name: messages.es.coordination.answer.dialog.trigger,
        }),
      );
      return screen.findByRole("alertdialog");
    })();

    expect(
      within(dialog).getByText(messages.es.coordination.answer.dialog.title),
    ).toBeInTheDocument();
  });
});

describe("AnswerForm server refusals", () => {
  async function confirmWith(result: unknown) {
    actionMock.mockResolvedValue(result);
    renderIntl(<AnswerForm escalamientoId={9} />);
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

  it("shows the text refusal under the field and keeps the draft", async () => {
    const dialog = await confirmWith({
      ok: false,
      reason: "invalid",
      errors: [{ field: "texto", code: "texto_too_long" }],
    });

    expect(
      await within(dialog).findByText(en.errors.texto_too_long),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("textbox", { name: en.dialog.noteLabel }),
    ).toHaveValue("x");
  });

  it.each(["conflict", "not_found", "unexpected"] as const)(
    "shows the %s refusal as a banner",
    async (reason) => {
      const dialog = await confirmWith({ ok: false, reason });

      expect(
        await within(dialog).findByText(en.errors[reason]),
      ).toBeInTheDocument();
    },
  );

  it.each(["conflict", "not_found"] as const)(
    "offers the way back to the coordinator list, not the secretary queue, on %s",
    async (reason) => {
      const dialog = await confirmWith({ ok: false, reason });

      const link = await within(dialog).findByRole("link", {
        name: en.dialog.backToQueue,
      });
      expect(link).toHaveAttribute("href", "/coordination");
    },
  );

  it("offers no way back for a plain validation refusal", async () => {
    const dialog = await confirmWith({
      ok: false,
      reason: "invalid",
      errors: [{ field: "texto", code: "texto_required" }],
    });

    await within(dialog).findByText(en.errors.texto_required);
    expect(within(dialog).queryByRole("link")).toBeNull();
  });
});

// flow-experience S3 (FE-11, RNF-12): the coordinator's answer drops its error
// as soon as the text is edited, with the same helper as the staff dialogs.
describe("AnswerForm stale messages (FE-11, RNF-12)", () => {
  const REQUIRED = {
    ok: false,
    reason: "invalid",
    errors: [{ field: "texto", code: "texto_required" }],
  };

  async function confirmedEmpty() {
    actionMock.mockResolvedValueOnce(REQUIRED);
    renderIntl(<AnswerForm escalamientoId={9} />);
    const dialog = await open();
    await userEvent.click(
      within(dialog).getByRole("button", { name: en.dialog.confirm }),
    );
    await within(dialog).findByText(en.errors.texto_required);
    return dialog;
  }

  it("clears the text error when the text is edited", async () => {
    const dialog = await confirmedEmpty();
    const field = within(dialog).getByRole("textbox", {
      name: en.dialog.noteLabel,
    });
    expect(field).toHaveAttribute("aria-invalid", "true");

    await userEvent.type(field, "x");

    expect(within(dialog).queryByText(en.errors.texto_required)).toBeNull();
    expect(field).not.toHaveAttribute("aria-invalid");
  });

  it("leaves no refusal banner behind once the error is cleared", async () => {
    const dialog = await confirmedEmpty();

    await userEvent.type(
      within(dialog).getByRole("textbox", { name: en.dialog.noteLabel }),
      ANSWER,
    );

    expect(within(dialog).queryByRole("alert")).toBeNull();
    expect(within(dialog).queryByText(en.errors.unexpected)).toBeNull();
  });

  it("fails again when the text is still empty on the next confirmation", async () => {
    const dialog = await confirmedEmpty();
    const field = within(dialog).getByRole("textbox", {
      name: en.dialog.noteLabel,
    });
    await userEvent.type(field, "x");
    await userEvent.clear(field);

    actionMock.mockResolvedValueOnce(REQUIRED);
    await userEvent.click(
      within(dialog).getByRole("button", { name: en.dialog.confirm }),
    );

    expect(
      await within(dialog).findByText(en.errors.texto_required),
    ).toBeVisible();
    expect(actionMock).toHaveBeenCalledTimes(2);
  });

  it.each(["conflict", "unexpected"] as const)(
    "keeps the %s message while the text is edited",
    async (reason) => {
      actionMock.mockResolvedValueOnce({ ok: false, reason });
      renderIntl(<AnswerForm escalamientoId={9} />);
      const dialog = await open();
      await userEvent.click(
        within(dialog).getByRole("button", { name: en.dialog.confirm }),
      );
      expect(await within(dialog).findByText(en.errors[reason])).toBeVisible();

      await userEvent.type(
        within(dialog).getByRole("textbox", { name: en.dialog.noteLabel }),
        "x",
      );

      expect(within(dialog).getByText(en.errors[reason])).toBeVisible();
    },
  );
});
