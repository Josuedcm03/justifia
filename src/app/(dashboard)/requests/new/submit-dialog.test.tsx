import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderIntl } from "@/app/(dashboard)/requests/new/test-support";
import { CONSENT_VERSION } from "@/lib/intake/consent";

const { submitRequestAction } = vi.hoisted(() => ({
  submitRequestAction: vi.fn(),
}));
vi.mock("@/app/(dashboard)/requests/new/actions", () => ({
  submitRequestAction,
}));

import { SubmitDialog } from "@/app/(dashboard)/requests/new/submit-dialog";

const onErrors = vi.fn();

beforeEach(() => {
  submitRequestAction.mockReset();
  onErrors.mockReset();
});

async function open() {
  await userEvent.click(
    screen.getByRole("button", { name: "Presentar solicitud" }),
  );
  return screen.findByRole("alertdialog");
}

describe("SubmitDialog (RNF-12: explicit confirmation)", () => {
  it("submits nothing until the dialog is opened and confirmed", async () => {
    renderIntl(<SubmitDialog consentVersion={null} onErrors={onErrors} />);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(submitRequestAction).not.toHaveBeenCalled();

    const dialog = await open();
    expect(dialog).toHaveAccessibleName("¿Presentar la solicitud?");
    expect(dialog).toHaveAccessibleDescription(
      "Una vez presentada no podrás modificarla.",
    );
    expect(submitRequestAction).not.toHaveBeenCalled();
  });

  it("cancel closes the dialog and changes nothing", async () => {
    renderIntl(<SubmitDialog consentVersion={null} onErrors={onErrors} />);
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    await vi.waitFor(() =>
      expect(screen.queryByRole("alertdialog")).toBeNull(),
    );
    expect(submitRequestAction).not.toHaveBeenCalled();
    expect(onErrors).not.toHaveBeenCalled();
  });

  it("Escape cancels as well", async () => {
    renderIntl(<SubmitDialog consentVersion={null} onErrors={onErrors} />);
    await open();
    await userEvent.keyboard("{Escape}");
    await vi.waitFor(() =>
      expect(screen.queryByRole("alertdialog")).toBeNull(),
    );
    expect(submitRequestAction).not.toHaveBeenCalled();
  });

  it("confirming runs the submit action once and keeps the dialog while it works", async () => {
    submitRequestAction.mockReturnValue(new Promise(() => {}));
    renderIntl(<SubmitDialog consentVersion={null} onErrors={onErrors} />);
    await open();
    await userEvent.click(
      screen.getByRole("button", { name: "Sí, presentar" }),
    );

    expect(submitRequestAction).toHaveBeenCalledTimes(1);
    const pending = await screen.findByRole("button", {
      name: "Presentando…",
    });
    expect(pending).toBeDisabled();
    await userEvent.click(pending);
    expect(submitRequestAction).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("on refusal it closes and hands the errors to the page", async () => {
    const errors = [
      { field: "documents", key: "intake.errors.documents_required" },
    ];
    submitRequestAction.mockResolvedValue({ ok: false, errors });
    renderIntl(<SubmitDialog consentVersion={null} onErrors={onErrors} />);
    await open();
    await userEvent.click(
      screen.getByRole("button", { name: "Sí, presentar" }),
    );

    await vi.waitFor(() => expect(onErrors).toHaveBeenCalledWith(errors));
    await vi.waitFor(() =>
      expect(screen.queryByRole("alertdialog")).toBeNull(),
    );
  });

  it("speaks English", async () => {
    renderIntl(
      <SubmitDialog consentVersion={null} onErrors={onErrors} />,
      "en",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Submit request" }),
    );
    expect(await screen.findByRole("alertdialog")).toHaveAccessibleName(
      "Submit the request?",
    );
  });
});

describe("SubmitDialog consent payload (RC-8; spec: Checked box sends the version)", () => {
  async function confirm() {
    await open();
    await userEvent.click(
      screen.getByRole("button", { name: "Sí, presentar" }),
    );
  }

  it("sends the version when the box was checked", async () => {
    submitRequestAction.mockResolvedValue({ ok: false, errors: [] });
    renderIntl(
      <SubmitDialog consentVersion={CONSENT_VERSION} onErrors={onErrors} />,
    );
    await confirm();

    await vi.waitFor(() =>
      expect(submitRequestAction).toHaveBeenCalledTimes(1),
    );
    expect(submitRequestAction).toHaveBeenCalledWith({
      consentVersion: "2026-10-20",
    });
  });

  it("sends null when the box was not checked", async () => {
    submitRequestAction.mockResolvedValue({ ok: false, errors: [] });
    renderIntl(<SubmitDialog consentVersion={null} onErrors={onErrors} />);
    await confirm();

    await vi.waitFor(() =>
      expect(submitRequestAction).toHaveBeenCalledTimes(1),
    );
    expect(submitRequestAction).toHaveBeenCalledWith({ consentVersion: null });
  });

  it("hands a consent refusal to the page like any other", async () => {
    const errors = [
      { field: "consent", key: "intake.errors.consent_required" },
    ];
    submitRequestAction.mockResolvedValue({ ok: false, errors });
    renderIntl(<SubmitDialog consentVersion={null} onErrors={onErrors} />);
    await confirm();

    await vi.waitFor(() => expect(onErrors).toHaveBeenCalledWith(errors));
  });
});
