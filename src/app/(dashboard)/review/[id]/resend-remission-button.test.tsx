import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { messages, renderIntl } from "@/app/(dashboard)/review/test-support";

const { resendRemissionAction } = vi.hoisted(() => ({
  resendRemissionAction: vi.fn(),
}));
vi.mock("@/app/(dashboard)/review/[id]/remission-actions", () => ({
  resendRemissionAction,
}));

import { ResendRemissionButton } from "@/app/(dashboard)/review/[id]/resend-remission-button";

const en = messages.en.review.remission.resend;
const NAMED = "Resend the notice to Pedro Ruiz";

// An action that never answers; release it so later transitions are not stalled.
const hanging: Array<() => void> = [];

function show() {
  return renderIntl(
    <ResendRemissionButton remisionId={31} teacherName="Pedro Ruiz" />,
  );
}

beforeEach(() => {
  resendRemissionAction.mockReset();
});

afterEach(() => {
  for (const release of hanging.splice(0)) release();
});

describe("ResendRemissionButton (RF-09 c)", () => {
  it("is a large button named after the teacher", () => {
    show();

    const button = screen.getByRole("button", { name: NAMED });
    expect(button).toHaveTextContent(en.action);
    expect(button).toBeEnabled();
  });

  it("calls the action with the remission id and is disabled while it runs", async () => {
    resendRemissionAction.mockReturnValue(
      new Promise<void>((resolve) => hanging.push(resolve)),
    );
    show();

    await userEvent.click(screen.getByRole("button", { name: NAMED }));

    expect(resendRemissionAction).toHaveBeenCalledWith(31);
    expect(await screen.findByRole("button", { name: NAMED })).toBeDisabled();
    expect(screen.getByRole("button", { name: NAMED })).toHaveTextContent(
      en.pending,
    );
  });

  it("says the notice was sent and takes the button away", async () => {
    resendRemissionAction.mockResolvedValue({
      ok: true,
      estado: "enviada",
      motivo: null,
    });
    show();

    await userEvent.click(screen.getByRole("button", { name: NAMED }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      en.result.enviada,
    );
    expect(
      screen.queryByRole("button", { name: NAMED }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["pendiente", en.result.pendiente],
    ["bloqueada", en.result.bloqueada],
  ] as const)(
    "reports a %s outcome and keeps the button for another attempt",
    async (estado, text) => {
      resendRemissionAction.mockResolvedValue({
        ok: true,
        estado,
        motivo: null,
      });
      show();

      await userEvent.click(screen.getByRole("button", { name: NAMED }));

      expect(await screen.findByRole("status")).toHaveTextContent(text);
      expect(screen.getByRole("button", { name: NAMED })).toBeEnabled();
    },
  );

  it.each([
    ["not_found", en.errors.not_found],
    ["unexpected", en.errors.unexpected],
  ] as const)("shows a %s refusal in an alert", async (reason, text) => {
    resendRemissionAction.mockResolvedValue({ ok: false, reason });
    show();

    await userEvent.click(screen.getByRole("button", { name: NAMED }));

    expect(await screen.findByRole("alert")).toHaveTextContent(text);
    expect(screen.getByRole("button", { name: NAMED })).toBeEnabled();
  });
});
