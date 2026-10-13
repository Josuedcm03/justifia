import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { messages, renderIntl } from "@/app/(dashboard)/review/test-support";

const { decideAction } = vi.hoisted(() => ({ decideAction: vi.fn() }));
vi.mock("@/app/(dashboard)/review/[id]/actions", () => ({ decideAction }));
vi.mock("next/link", async () =>
  (await import("@/app/(dashboard)/review/test-support")).linkDouble(),
);

import {
  DecisionDialog,
  type DialogTemplate,
} from "@/app/(dashboard)/review/[id]/decision-dialog";

const en = messages.en.review.decision;

const APPROVE_TEXT = "Buenos días, Ana. Su solicitud ha sido aprobada.";
const REJECT_GENERAL =
  "Rechazada por el siguiente motivo: [indique el motivo].";
const REJECT_DOC = "Rechazada: el documento no acredita la inasistencia.";
const RETURN_ILEGIBLE = "Devuelta: el documento no es legible.";
const RETURN_FECHA = "Devuelta: la fecha no coincide.";

const TEMPLATES: Record<string, DialogTemplate[]> = {
  aprobada: [
    { codigo: "aprobacion.general", motivo: null, texto: APPROVE_TEXT },
  ],
  rechazada: [
    { codigo: "rechazo.general", motivo: null, texto: REJECT_GENERAL },
    {
      codigo: "rechazo.documento_no_acredita",
      motivo: null,
      texto: REJECT_DOC,
    },
  ],
  devuelta: [
    {
      codigo: "devolucion.fecha_incorrecta",
      motivo: "fecha_incorrecta",
      texto: RETURN_FECHA,
    },
    {
      codigo: "devolucion.documento_ilegible",
      motivo: "documento_ilegible",
      texto: RETURN_ILEGIBLE,
    },
  ],
};

function show(kind: "aprobada" | "rechazada" | "devuelta") {
  return renderIntl(
    <DecisionDialog kind={kind} solicitudId={12} templates={TEMPLATES[kind]} />,
  );
}

async function open(kind: "aprobada" | "rechazada" | "devuelta") {
  const trigger = {
    aprobada: en.approve.trigger,
    rechazada: en.reject.trigger,
    devuelta: en.return.trigger,
  }[kind];
  await userEvent.click(screen.getByRole("button", { name: trigger }));
  return screen.findByRole("alertdialog");
}

// An action that never answers. React entangles async transitions, so a promise
// left pending would stall the transitions of every later test: release them.
const hanging: Array<() => void> = [];
function hang() {
  return new Promise<void>((resolve) => hanging.push(resolve));
}

beforeEach(() => {
  decideAction.mockReset();
});

afterEach(() => {
  for (const release of hanging.splice(0)) release();
});

describe("DecisionDialog approve (RF-07 a)", () => {
  it("decides nothing until the dialog is opened and confirmed", async () => {
    show("aprobada");
    expect(screen.queryByRole("alertdialog")).toBeNull();

    const dialog = await open("aprobada");

    expect(dialog).toHaveAccessibleName(en.approve.title);
    expect(decideAction).not.toHaveBeenCalled();
  });

  it("prefills the message from the template and keeps it editable", async () => {
    show("aprobada");
    const dialog = await open("aprobada");

    const text = within(dialog).getByRole("textbox", { name: en.textLabel });
    expect(text).toHaveValue(APPROVE_TEXT);
    expect(
      within(dialog).getByRole("radio", {
        name: en.templates.aprobacion_general,
      }),
    ).toBeChecked();

    await userEvent.clear(text);
    await userEvent.type(text, "Aprobada con gusto.");
    expect(text).toHaveValue("Aprobada con gusto.");
  });

  it("sends the edited text with the template code, once, on confirm", async () => {
    decideAction.mockReturnValue(hang());
    show("aprobada");
    const dialog = await open("aprobada");
    const text = within(dialog).getByRole("textbox", { name: en.textLabel });
    await userEvent.clear(text);
    await userEvent.type(text, "Editada.");

    await userEvent.click(
      within(dialog).getByRole("button", { name: en.approve.confirm }),
    );

    expect(decideAction).toHaveBeenCalledTimes(1);
    expect(decideAction).toHaveBeenCalledWith({
      solicitudId: 12,
      tipo: "aprobada",
      plantilla: "aprobacion.general",
      motivo: null,
      texto: "Editada.",
    });
  });

  it("allows approving with an empty message", async () => {
    decideAction.mockReturnValue(hang());
    show("aprobada");
    const dialog = await open("aprobada");
    await userEvent.clear(
      within(dialog).getByRole("textbox", { name: en.textLabel }),
    );

    await userEvent.click(
      within(dialog).getByRole("button", { name: en.approve.confirm }),
    );

    expect(decideAction).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: "aprobada", texto: "" }),
    );
  });
});

describe("DecisionDialog return (RF-07 b, RN-17)", () => {
  it("offers only the three RN-17 reasons, none chosen, with an empty message", async () => {
    show("devuelta");
    const dialog = await open("devuelta");

    const radios = within(dialog).getAllByRole("radio");
    expect(radios.map((r) => r.getAttribute("aria-checked"))).toEqual([
      "false",
      "false",
    ]);
    expect(
      within(dialog).getByRole("radio", { name: en.reasons.fecha_incorrecta }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("textbox", { name: en.textLabel }),
    ).toHaveValue("");
  });

  it("choosing a reason selects its template and fills the message", async () => {
    decideAction.mockReturnValue(hang());
    show("devuelta");
    const dialog = await open("devuelta");

    await userEvent.click(
      within(dialog).getByRole("radio", {
        name: en.reasons.documento_ilegible,
      }),
    );
    expect(
      within(dialog).getByRole("textbox", { name: en.textLabel }),
    ).toHaveValue(RETURN_ILEGIBLE);

    await userEvent.click(
      within(dialog).getByRole("button", { name: en.return.confirm }),
    );
    expect(decideAction).toHaveBeenCalledWith({
      solicitudId: 12,
      tipo: "devuelta",
      plantilla: "devolucion.documento_ilegible",
      motivo: "documento_ilegible",
      texto: RETURN_ILEGIBLE,
    });
  });

  it("changing the reason swaps the template text", async () => {
    show("devuelta");
    const dialog = await open("devuelta");
    await userEvent.click(
      within(dialog).getByRole("radio", {
        name: en.reasons.documento_ilegible,
      }),
    );

    await userEvent.click(
      within(dialog).getByRole("radio", { name: en.reasons.fecha_incorrecta }),
    );

    expect(
      within(dialog).getByRole("textbox", { name: en.textLabel }),
    ).toHaveValue(RETURN_FECHA);
  });

  it("shows the server's missing-reason refusal under the reasons", async () => {
    decideAction.mockResolvedValue({
      ok: false,
      reason: "invalid",
      errors: [
        { field: "motivo", code: "motivo_required" },
        { field: "texto", code: "text_required" },
      ],
    });
    show("devuelta");
    const dialog = await open("devuelta");

    await userEvent.click(
      within(dialog).getByRole("button", { name: en.return.confirm }),
    );

    const alerts = await within(dialog).findAllByRole("alert");
    expect(alerts.map((a) => a.textContent)).toEqual([
      en.errors.motivo_required,
      en.errors.text_required,
    ]);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});

describe("DecisionDialog reject (RF-07, RNF-12)", () => {
  it("opens as a confirmation and calls nothing until confirmed", async () => {
    show("rechazada");
    const dialog = await open("rechazada");

    expect(dialog).toHaveAccessibleName(en.reject.title);
    expect(dialog).toHaveAccessibleDescription(en.reject.description);
    expect(decideAction).not.toHaveBeenCalled();
  });

  it("lists both rejection templates with the first chosen and filled in", async () => {
    show("rechazada");
    const dialog = await open("rechazada");

    expect(
      within(dialog).getByRole("radio", { name: en.templates.rechazo_general }),
    ).toBeChecked();
    expect(
      within(dialog).getByRole("radio", {
        name: en.templates.rechazo_documento_no_acredita,
      }),
    ).not.toBeChecked();
    expect(
      within(dialog).getByRole("textbox", { name: en.textLabel }),
    ).toHaveValue(REJECT_GENERAL);
  });

  it("switching template replaces the text and sends the new code", async () => {
    decideAction.mockReturnValue(hang());
    show("rechazada");
    const dialog = await open("rechazada");

    await userEvent.click(
      within(dialog).getByRole("radio", {
        name: en.templates.rechazo_documento_no_acredita,
      }),
    );
    expect(
      within(dialog).getByRole("textbox", { name: en.textLabel }),
    ).toHaveValue(REJECT_DOC);

    await userEvent.click(
      within(dialog).getByRole("button", { name: en.reject.confirm }),
    );
    expect(decideAction).toHaveBeenCalledWith({
      solicitudId: 12,
      tipo: "rechazada",
      plantilla: "rechazo.documento_no_acredita",
      motivo: null,
      texto: REJECT_DOC,
    });
  });

  it("shows the unresolved-marker refusal under the text", async () => {
    decideAction.mockResolvedValue({
      ok: false,
      reason: "invalid",
      errors: [{ field: "texto", code: "text_placeholder" }],
    });
    show("rechazada");
    const dialog = await open("rechazada");

    await userEvent.click(
      within(dialog).getByRole("button", { name: en.reject.confirm }),
    );

    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent(en.errors.text_placeholder);
    expect(
      within(dialog).getByRole("textbox", { name: en.textLabel }),
    ).toHaveAccessibleDescription(en.errors.text_placeholder);
  });

  it("cancel closes without deciding and the next open starts fresh", async () => {
    show("rechazada");
    let dialog = await open("rechazada");
    const text = within(dialog).getByRole("textbox", { name: en.textLabel });
    await userEvent.clear(text);
    await userEvent.type(text, "Texto a medias");

    await userEvent.click(
      within(dialog).getByRole("button", { name: en.cancel }),
    );
    await vi.waitFor(() =>
      expect(screen.queryByRole("alertdialog")).toBeNull(),
    );
    expect(decideAction).not.toHaveBeenCalled();

    dialog = await open("rechazada");
    expect(
      within(dialog).getByRole("textbox", { name: en.textLabel }),
    ).toHaveValue(REJECT_GENERAL);
  });

  it("Escape cancels as well", async () => {
    show("rechazada");
    await open("rechazada");

    await userEvent.keyboard("{Escape}");

    await vi.waitFor(() =>
      expect(screen.queryByRole("alertdialog")).toBeNull(),
    );
    expect(decideAction).not.toHaveBeenCalled();
  });
});

describe("DecisionDialog message counter and pending state", () => {
  it("counts the characters out of 1000 as the secretary types", async () => {
    show("aprobada");
    const dialog = await open("aprobada");
    const text = within(dialog).getByRole("textbox", { name: en.textLabel });

    expect(
      within(dialog).getByText(`${APPROVE_TEXT.length}/1000`),
    ).toBeInTheDocument();

    await userEvent.clear(text);
    await userEvent.type(text, "abc");
    expect(within(dialog).getByText("3/1000")).toBeInTheDocument();
  });

  it("keeps the dialog open and blocks a second run while the action works", async () => {
    decideAction.mockReturnValue(hang());
    show("aprobada");
    const dialog = await open("aprobada");

    await userEvent.click(
      within(dialog).getByRole("button", { name: en.approve.confirm }),
    );

    const pending = await screen.findByRole("button", {
      name: en.approve.pending,
    });
    expect(pending).toBeDisabled();
    await userEvent.click(pending);
    expect(decideAction).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: en.cancel }),
    ).toBeDisabled();
  });
});

describe("DecisionDialog conflict and not found", () => {
  it.each(["conflict", "not_found"] as const)(
    "shows the %s refusal as an alert banner with a way back to the queue",
    async (reason) => {
      decideAction.mockResolvedValue({ ok: false, reason });
      show("aprobada");
      const dialog = await open("aprobada");

      await userEvent.click(
        within(dialog).getByRole("button", { name: en.approve.confirm }),
      );

      const alert = await within(dialog).findByRole("alert");
      expect(alert).toHaveTextContent(en.errors[reason]);
      const back = within(dialog).getByRole("link", { name: en.backToQueue });
      expect(back).toHaveAttribute("href", "/review");
      expect(back).toHaveAttribute("data-prefetch", "false");
    },
  );

  it("shows a generic failure when the server refuses without naming a field", async () => {
    decideAction.mockResolvedValue({
      ok: false,
      reason: "invalid",
      errors: [],
    });
    show("aprobada");
    const dialog = await open("aprobada");

    await userEvent.click(
      within(dialog).getByRole("button", { name: en.approve.confirm }),
    );

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      en.errors.unexpected,
    );
    expect(
      await within(dialog).findByRole("button", { name: en.approve.confirm }),
    ).toBeEnabled();
  });

  it("clears an earlier refusal when the secretary confirms again", async () => {
    decideAction.mockResolvedValueOnce({ ok: false, reason: "conflict" });
    decideAction.mockReturnValueOnce(hang());
    show("aprobada");
    const dialog = await open("aprobada");
    const confirm = within(dialog).getByRole("button", {
      name: en.approve.confirm,
    });

    await userEvent.click(confirm);
    await within(dialog).findByRole("alert");
    await userEvent.click(confirm);

    await vi.waitFor(() =>
      expect(within(dialog).queryByRole("alert")).toBeNull(),
    );
  });

  it("renders in Spanish with the Spanish catalog", async () => {
    renderIntl(
      <DecisionDialog
        kind="rechazada"
        solicitudId={12}
        templates={TEMPLATES.rechazada}
      />,
      "es",
    );

    await userEvent.click(
      screen.getByRole("button", {
        name: messages.es.review.decision.reject.trigger,
      }),
    );
    expect(await screen.findByRole("alertdialog")).toHaveAccessibleName(
      messages.es.review.decision.reject.title,
    );
  });
});
