import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { messages, renderIntl } from "@/app/(dashboard)/review/test-support";

const { resendEscalationNoticeAction } = vi.hoisted(() => ({
  resendEscalationNoticeAction: vi.fn(),
}));
vi.mock("@/app/(dashboard)/review/[id]/escalation-actions", () => ({
  resendEscalationNoticeAction,
}));

import { ResendEscalationButton } from "@/app/(dashboard)/review/[id]/resend-escalation-button";

const en = messages.en.review.escalation.resend;
const NAMED =
  "Resend the notice to the coordination: Document suspicion, Oct 8, 2026";

// An action that never answers; release it so later transitions are not stalled.
const hanging: Array<() => void> = [];

function show(locale: "en" | "es" = "en") {
  return renderIntl(
    <ResendEscalationButton
      escalamientoId={61}
      label="Document suspicion, Oct 8, 2026"
    />,
    locale,
  );
}

beforeEach(() => {
  resendEscalationNoticeAction.mockReset();
});

afterEach(() => {
  for (const release of hanging.splice(0)) release();
});

describe("ResendEscalationButton (RF-10 b)", () => {
  it("is a large button named after the notice it resends", () => {
    show();

    const button = screen.getByRole("button", { name: NAMED });
    expect(button).toHaveTextContent(en.action);
    expect(button).toBeEnabled();
  });

  it("calls the action with the escalation id and is disabled while it runs", async () => {
    resendEscalationNoticeAction.mockReturnValue(
      new Promise<void>((resolve) => hanging.push(resolve)),
    );
    show();

    await userEvent.click(screen.getByRole("button", { name: NAMED }));

    expect(resendEscalationNoticeAction).toHaveBeenCalledWith(61);
    expect(await screen.findByRole("button", { name: NAMED })).toBeDisabled();
    expect(screen.getByRole("button", { name: NAMED })).toHaveTextContent(
      en.pending,
    );
  });

  it("says the notice was sent and takes the button away", async () => {
    resendEscalationNoticeAction.mockResolvedValue({
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
    ["pendiente", "error_envio", en.result.pendiente],
    ["bloqueada", "sin_destinatarios", en.result.bloqueada],
  ] as const)(
    "reports a %s outcome and keeps the button for another attempt",
    async (estado, motivo, text) => {
      resendEscalationNoticeAction.mockResolvedValue({
        ok: true,
        estado,
        motivo,
      });
      show();

      await userEvent.click(screen.getByRole("button", { name: NAMED }));

      expect(await screen.findByRole("status")).toHaveTextContent(text);
      expect(screen.getByRole("button", { name: NAMED })).toBeEnabled();
    },
  );

  it.each([
    ["pendiente", "en_curso", en.result.en_curso],
    ["bloqueada", "sin_correo", en.result.sin_correo],
  ] as const)(
    "words a %s outcome with the %s notice and keeps the button",
    async (estado, aviso, text) => {
      resendEscalationNoticeAction.mockResolvedValue({
        ok: true,
        estado,
        motivo: estado === "bloqueada" ? "sin_destinatarios" : null,
        aviso,
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
    resendEscalationNoticeAction.mockResolvedValue({ ok: false, reason });
    show();

    await userEvent.click(screen.getByRole("button", { name: NAMED }));

    expect(await screen.findByRole("alert")).toHaveTextContent(text);
    expect(screen.getByRole("button", { name: NAMED })).toBeEnabled();
  });

  it("reads in Spanish with the Spanish catalog", () => {
    show("es");

    const es = messages.es.review.escalation.resend;
    expect(
      screen.getByRole("button", {
        name: es.actionNamed.replace(
          "{name}",
          "Document suspicion, Oct 8, 2026",
        ),
      }),
    ).toHaveTextContent(es.action);
  });
});
