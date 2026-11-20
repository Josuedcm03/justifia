import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderIntl } from "@/app/(dashboard)/requests/new/test-support";
import { ResubmitDialog } from "@/app/(dashboard)/requests/new/resubmit-dialog";

// FE-16 (RF-08 a, c): before the student resubmits a corrected request, the
// dialog names the files the resubmission will carry and where each one comes
// from. Listing reads nothing from the server and adds no step.

const D1 = { id: 1, nombreOriginal: "receta-vieja.pdf" };
const D2 = { id: 2, nombreOriginal: "constancia.pdf" };
const D3 = { id: 3, nombreOriginal: "foto-nueva.png" };

function ui(props: Partial<Parameters<typeof ResubmitDialog>[0]> = {}) {
  return (
    <ResubmitDialog
      action={vi.fn().mockResolvedValue({ ok: true })}
      onErrors={vi.fn()}
      documents={[D2, D3]}
      previousDocumentIds={[1, 2]}
      {...props}
    />
  );
}

async function open() {
  await userEvent.click(
    screen.getByRole("button", { name: /^(Reenviar solicitud|Resubmit)/ }),
  );
  return screen.findByRole("alertdialog");
}

describe("ResubmitDialog: the files it will send (FE-16)", () => {
  it("lists the kept file as Anterior and the added file as Nuevo, and not the retired one", async () => {
    renderIntl(ui());
    const dialog = await open();

    expect(
      within(dialog).getByText("Documentos que se enviarán"),
    ).toBeInTheDocument();
    const items = within(dialog).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("constancia.pdf");
    expect(items[0]).toHaveTextContent("Anterior");
    expect(items[1]).toHaveTextContent("foto-nueva.png");
    expect(items[1]).toHaveTextContent("Nuevo");
    expect(within(dialog).queryByText(D1.nombreOriginal)).toBeNull();
  });

  it("marks every file Nuevo when the returned version listed no document", async () => {
    renderIntl(ui({ previousDocumentIds: [] }));
    const dialog = await open();

    for (const item of within(dialog).getAllByRole("listitem")) {
      expect(item).toHaveTextContent("Nuevo");
    }
  });

  it("lists the names with no mark when the returned ids could not be read", async () => {
    renderIntl(ui({ previousDocumentIds: null }));
    const dialog = await open();

    const items = within(dialog).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "constancia.pdf",
      "foto-nueva.png",
    ]);
  });

  it("words the list and the marks in English", async () => {
    renderIntl(ui(), "en");
    const dialog = await open();

    expect(
      within(dialog).getByText("Documents that will be sent"),
    ).toBeInTheDocument();
    const items = within(dialog).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Previous");
    expect(items[1]).toHaveTextContent("New");
  });

  it("shows no list when the request holds no document", async () => {
    renderIntl(ui({ documents: [] }));
    const dialog = await open();

    expect(within(dialog).queryByRole("list")).toBeNull();
    expect(within(dialog).queryByText("Documentos que se enviarán")).toBeNull();
  });

  it("keeps the title, the description and the two buttons it had", async () => {
    renderIntl(ui());
    const dialog = await open();

    expect(
      within(dialog).getByRole("heading", {
        name: "¿Reenviar la solicitud corregida?",
      }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/La secretaría la revisará de nuevo/),
    ).toBeInTheDocument();
    expect(
      within(dialog)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Cancelar", "Sí, reenviar"]);
  });
});

describe("ResubmitDialog: confirming is unchanged (RNF-12)", () => {
  it("resubmits once on one confirmation, with no extra step", async () => {
    const action = vi.fn().mockResolvedValue({ ok: true });
    renderIntl(ui({ action }));
    const dialog = await open();
    expect(action).not.toHaveBeenCalled();

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Sí, reenviar" }),
    );

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(action).toHaveBeenCalledWith();
  });

  it("resubmits nothing when the student cancels", async () => {
    const action = vi.fn().mockResolvedValue({ ok: true });
    renderIntl(ui({ action }));
    const dialog = await open();

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancelar" }),
    );

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(action).not.toHaveBeenCalled();
  });

  it("hands a refusal to the page and closes, as before", async () => {
    const errors = [{ field: "documents", key: "intake.errors.too_large" }];
    const action = vi.fn().mockResolvedValue({ ok: false, errors });
    const onErrors = vi.fn();
    renderIntl(ui({ action, onErrors }));
    const dialog = await open();

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Sí, reenviar" }),
    );

    await waitFor(() => expect(onErrors).toHaveBeenCalledWith(errors));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });
});

describe("ResubmitDialog: no read, long names (FE-16, RNF-11)", () => {
  it("links nothing to the document route and never calls fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    renderIntl(ui());
    const dialog = await open();

    expect(dialog.querySelector('a[href*="/api/intake/documents"]')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("wraps a 120-character name and sets no width above the 360 px viewport", async () => {
    const name = `${"constancia-".repeat(11)}.pdf`.slice(0, 120);
    expect(name).toHaveLength(120);
    renderIntl(ui({ documents: [{ id: 2, nombreOriginal: name }] }));
    const dialog = await open();

    const label = within(dialog).getByText(name);
    expect(label).toHaveClass("break-words", "min-w-0");
    expect(label.className).not.toMatch(/\btruncate\b/);
    expect(dialog.innerHTML).not.toMatch(/\b(?:min-)?w-\[\d+(?:px|rem)\]/);
  });

  it("gives the mark text, not just a colour", async () => {
    renderIntl(ui());
    const dialog = await open();

    expect(within(dialog).getByText("Nuevo")).toBeInTheDocument();
    expect(within(dialog).getByText("Anterior")).toBeInTheDocument();
  });
});
