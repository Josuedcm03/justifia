import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderIntl } from "@/app/(dashboard)/requests/new/test-support";

// F.3: pins for the docs/design-system.md fixes (tokens that exist, touch
// targets of 44px, one alert pattern, dialog button hierarchy). Class-level on
// purpose: jsdom has no layout or computed styles for these utilities.

vi.mock("@/app/(dashboard)/requests/new/actions", () => ({
  saveDetailsAction: vi.fn(),
  saveSubjectsAction: vi.fn(),
  finalizeDocumentAction: vi.fn(),
  removeDocumentAction: vi.fn(),
  submitRequestAction: vi.fn(),
  discardDraftAction: vi.fn(),
}));
vi.mock("@vercel/blob/client", () => ({ upload: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { submitRequestAction } from "@/app/(dashboard)/requests/new/actions";
import { CauseDatesStep } from "@/app/(dashboard)/requests/new/cause-dates-step";
import { DiscardDialog } from "@/app/(dashboard)/requests/new/discard-dialog";
import { DocumentsStep } from "@/app/(dashboard)/requests/new/documents-step";
import { FieldErrors } from "@/app/(dashboard)/requests/new/form-field";
import { ReviewStep } from "@/app/(dashboard)/requests/new/review-step";
import { SubjectsStep } from "@/app/(dashboard)/requests/new/subjects-step";

const DRAFT = {
  causa: "medica",
  fechaInicio: "2026-10-01",
  fechaFin: "2026-10-03",
};
const DOC = { id: 5, nombreOriginal: "constancia.pdf", tamanoBytes: 2048 };
const GROUPS = [1, 2].map((n) => ({
  grupoId: n,
  asignaturaId: 10,
  asignaturaCodigo: "MAT-101",
  asignaturaNombre: "Cálculo",
  periodo: "2026-2",
  numeroGrupo: String(n),
  docenteNombre: null,
}));

describe("design-system fixes (F.3)", () => {
  it("uses the destructive ink for field errors", () => {
    renderIntl(
      <FieldErrors
        id="causa"
        errors={[{ field: "causa", key: "intake.errors.causa_required" }]}
      />,
    );
    expect(screen.getByRole("alert")).toHaveClass("text-destructive-ink");
  });

  it("titles a step with a defined type token", () => {
    renderIntl(<CauseDatesStep initial={DRAFT} />);
    const title = screen.getAllByRole("heading", { level: 2 })[0];
    expect(title).toHaveClass("text-headline");
    expect(title).not.toHaveClass("text-h3");
  });

  it("gives radio labels a 44px touch target", () => {
    renderIntl(<CauseDatesStep initial={DRAFT} />);
    const label = screen.getAllByRole("radio")[0].closest("label");
    expect(label).toHaveClass("min-h-11", "items-center");
  });

  it("gives subject checkbox and group radio labels a 44px touch target", () => {
    renderIntl(
      <SubjectsStep
        groups={GROUPS}
        selected={[{ asignaturaId: 10, grupoId: 1 }]}
        hasDates
        degraded={false}
      />,
    );
    for (const control of [
      ...screen.getAllByRole("checkbox"),
      ...screen.getAllByRole("radio"),
    ]) {
      expect(control.closest("label")).toHaveClass("min-h-11", "items-center");
    }
  });

  it("renders the degraded subjects notice as the catalog alert", () => {
    renderIntl(
      <SubjectsStep groups={[]} selected={[]} hasDates degraded={true} />,
    );
    const notice = screen.getByRole("status");
    expect(notice).toHaveClass("border-l-4", "text-destructive-ink");
  });

  it("sizes the review Edit and View links to 44px and titles sections", () => {
    renderIntl(
      <ReviewStep
        draft={DRAFT}
        groups={[]}
        documents={[DOC]}
        degraded={false}
      />,
    );
    // The consent link is inline text inside a sentence, not a button-sized
    // action (WCAG 2.5.8 exempts it); only the review's own actions are checked.
    const actions = screen
      .getAllByRole("link")
      .filter((link) => link.closest("label") === null);
    expect(actions.length).toBeGreaterThan(0);
    for (const link of actions) {
      expect(link).toHaveClass("h-11");
    }
    const section = screen.getAllByRole("heading", { level: 3 })[0];
    expect(section).toHaveClass("text-title");
  });

  it("builds the consent row from existing tokens only (§5 Checkbox group)", async () => {
    vi.mocked(submitRequestAction).mockResolvedValue({
      ok: false,
      errors: [{ field: "consent", key: "intake.errors.consent_required" }],
    });
    renderIntl(
      <ReviewStep
        draft={DRAFT}
        groups={[]}
        documents={[DOC]}
        degraded={false}
      />,
    );

    const box = screen.getByRole("checkbox");
    expect(box).toHaveClass("accent-primary", "size-5");
    const row = box.parentElement;
    expect(row).toHaveClass("flex", "items-start", "gap-3");
    const label = row?.querySelector("label");
    expect(label).toHaveClass("text-sm", "min-h-11");
    expect(
      screen.getByRole("link", { name: /aviso de privacidad/ }),
    ).toHaveClass("text-primary", "underline");

    await userEvent.click(
      screen.getByRole("button", { name: "Presentar solicitud" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Sí, presentar" }),
    );
    expect(await screen.findByRole("alert")).toHaveClass(
      "text-destructive-ink",
      "text-sm",
    );
  });

  it("renders the degraded review notice as the catalog alert", () => {
    renderIntl(
      <ReviewStep draft={DRAFT} groups={[]} documents={[]} degraded={true} />,
    );
    expect(screen.getByRole("status")).toHaveClass(
      "border-l-4",
      "text-destructive-ink",
    );
  });

  it("sizes the documents View link to 44px", () => {
    renderIntl(<DocumentsStep draftId={4} documents={[DOC]} />);
    expect(screen.getByRole("link", { name: /Ver/ })).toHaveClass("h-11");
  });

  it("keeps the discard trigger secondary and the dialog on the soft shadow", async () => {
    renderIntl(<DiscardDialog onErrors={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "Descartar borrador" });
    expect(trigger).toHaveClass("bg-secondary");
    expect(trigger).not.toHaveClass("bg-destructive/10");

    await userEvent.click(trigger);
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveClass("p-6", "shadow-soft");
    expect(dialog).not.toHaveClass("shadow-lg");

    const [cancel, confirm] = screen
      .getAllByRole("button", {
        hidden: false,
      })
      .filter((b) => dialog.contains(b));
    expect(cancel).toHaveClass("h-11", "hover:bg-muted");
    expect(confirm).toHaveClass("h-11", "bg-destructive/10");
  });
});
