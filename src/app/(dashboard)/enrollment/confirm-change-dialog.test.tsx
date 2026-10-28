import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderIntl } from "@/app/(dashboard)/requests/new/test-support";
import { ConfirmChangeDialog } from "@/app/(dashboard)/enrollment/confirm-change-dialog";

import es from "../../../../i18n/es.json";

const action = vi.fn();
const onClose = vi.fn();

const TEXTS = {
  title: "¿Dar de baja MAT-101 · Cálculo, Grupo 01?",
  description: "Dejarás de estar inscrito en este grupo.",
  confirm: "Sí, dar de baja",
  pending: "Dando de baja…",
};
const WARNING = "Una solicitud tuya en borrador usa este grupo.";

beforeEach(() => {
  action.mockReset();
  onClose.mockReset();
});

function show(texts: Parameters<typeof ConfirmChangeDialog>[0]["texts"]) {
  return renderIntl(
    <ConfirmChangeDialog texts={texts} action={action} onClose={onClose} />,
  );
}

describe("ConfirmChangeDialog (RNF-12: explicit confirmation)", () => {
  it("names the affected group and runs nothing until confirmed", async () => {
    show(TEXTS);

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveAccessibleName(TEXTS.title);
    expect(dialog).toHaveAccessibleDescription(TEXTS.description);
    expect(action).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows the dependent-request warning only when one is given", async () => {
    const { unmount } = show({ ...TEXTS, warning: WARNING });
    expect(await screen.findByText(WARNING)).toBeInTheDocument();
    unmount();

    show(TEXTS);
    await screen.findByRole("alertdialog");
    expect(screen.queryByText(WARNING)).toBeNull();
  });

  it("the warning never blocks the confirmation", async () => {
    action.mockResolvedValue({ ok: true });
    show({ ...TEXTS, warning: WARNING });

    await userEvent.click(
      await screen.findByRole("button", { name: TEXTS.confirm }),
    );

    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("cancel closes and changes nothing", async () => {
    show(TEXTS);

    await userEvent.click(
      await screen.findByRole("button", { name: es.enrollment.dialog.cancel }),
    );

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(action).not.toHaveBeenCalled();
  });

  it("Escape cancels as well", async () => {
    show(TEXTS);
    await screen.findByRole("alertdialog");

    await userEvent.keyboard("{Escape}");

    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(action).not.toHaveBeenCalled();
  });

  it("runs the action once and stays open and disabled while it works", async () => {
    let finish: (result: { ok: true }) => void = () => {};
    action.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    show(TEXTS);

    await userEvent.click(
      await screen.findByRole("button", { name: TEXTS.confirm }),
    );

    const pending = await screen.findByRole("button", {
      name: TEXTS.pending,
    });
    expect(pending).toBeDisabled();
    await userEvent.click(pending);
    expect(action).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: es.enrollment.dialog.cancel }),
    ).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();

    // Settle the action so the dialog does not outlive the test.
    finish({ ok: true });
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("closes after a successful action", async () => {
    action.mockResolvedValue({ ok: true });
    show(TEXTS);

    await userEvent.click(
      await screen.findByRole("button", { name: TEXTS.confirm }),
    );

    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("a failed action shows its error and keeps the dialog usable", async () => {
    action.mockResolvedValueOnce({ ok: false, error: "not_enrolled" });
    action.mockResolvedValueOnce({ ok: true });
    show(TEXTS);

    await userEvent.click(
      await screen.findByRole("button", { name: TEXTS.confirm }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      es.enrollment.errors.not_enrolled,
    );
    expect(onClose).not.toHaveBeenCalled();
    const retry = await screen.findByRole("button", { name: TEXTS.confirm });
    expect(retry).toBeEnabled();

    await userEvent.click(retry);

    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(action).toHaveBeenCalledTimes(2);
  });

  it("gives both controls a 44 px target", async () => {
    show(TEXTS);

    const confirm = await screen.findByRole("button", { name: TEXTS.confirm });
    const cancel = screen.getByRole("button", {
      name: es.enrollment.dialog.cancel,
    });
    expect(confirm).toHaveClass("h-11");
    expect(cancel).toHaveClass("h-11");
  });
});
