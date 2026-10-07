import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderIntl } from "@/app/(dashboard)/requests/new/test-support";

const { discardDraftAction } = vi.hoisted(() => ({
  discardDraftAction: vi.fn(),
}));
vi.mock("@/app/(dashboard)/requests/new/actions", () => ({
  discardDraftAction,
}));

import { DiscardDialog } from "@/app/(dashboard)/requests/new/discard-dialog";

const onErrors = vi.fn();

beforeEach(() => {
  discardDraftAction.mockReset();
  onErrors.mockReset();
});

async function open() {
  await userEvent.click(
    screen.getByRole("button", { name: "Descartar borrador" }),
  );
  return screen.findByRole("alertdialog");
}

describe("DiscardDialog (RNF-12, D14)", () => {
  it("warns that the discard is permanent before doing anything", async () => {
    renderIntl(<DiscardDialog onErrors={onErrors} />);
    const dialog = await open();
    expect(dialog).toHaveAccessibleName("¿Descartar el borrador?");
    expect(dialog).toHaveAccessibleDescription(
      "Se eliminarán tus datos y documentos. Esta acción no se puede deshacer.",
    );
    expect(discardDraftAction).not.toHaveBeenCalled();
  });

  it("cancel changes nothing", async () => {
    renderIntl(<DiscardDialog onErrors={onErrors} />);
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await vi.waitFor(() =>
      expect(screen.queryByRole("alertdialog")).toBeNull(),
    );
    expect(discardDraftAction).not.toHaveBeenCalled();
  });

  it("confirming runs the discard action once", async () => {
    discardDraftAction.mockReturnValue(new Promise(() => {}));
    renderIntl(<DiscardDialog onErrors={onErrors} />);
    await open();
    await userEvent.click(
      screen.getByRole("button", { name: "Sí, descartar" }),
    );

    expect(discardDraftAction).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByRole("button", { name: "Descartando…" }),
    ).toBeDisabled();
  });

  it("reports a refusal and closes", async () => {
    const errors = [{ field: "form", key: "intake.errors.no_draft" }];
    discardDraftAction.mockResolvedValue({ ok: false, errors });
    renderIntl(<DiscardDialog onErrors={onErrors} />);
    await open();
    await userEvent.click(
      screen.getByRole("button", { name: "Sí, descartar" }),
    );

    await vi.waitFor(() => expect(onErrors).toHaveBeenCalledWith(errors));
    await vi.waitFor(() =>
      expect(screen.queryByRole("alertdialog")).toBeNull(),
    );
  });

  it("speaks English", async () => {
    renderIntl(<DiscardDialog onErrors={onErrors} />, "en");
    await userEvent.click(
      screen.getByRole("button", { name: "Discard draft" }),
    );
    expect(await screen.findByRole("alertdialog")).toHaveAccessibleName(
      "Discard the draft?",
    );
  });
});
