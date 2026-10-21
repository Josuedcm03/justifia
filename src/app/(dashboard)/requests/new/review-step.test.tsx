import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderIntl } from "@/app/(dashboard)/requests/new/test-support";

const { submitRequestAction, discardDraftAction } = vi.hoisted(() => ({
  submitRequestAction: vi.fn(),
  discardDraftAction: vi.fn(),
}));

vi.mock("@/app/(dashboard)/requests/new/actions", () => ({
  submitRequestAction,
  discardDraftAction,
}));

import { ReviewStep } from "@/app/(dashboard)/requests/new/review-step";
import { CONSENT_VERSION } from "@/lib/intake/consent";

const GROUP = {
  grupoId: 1,
  asignaturaId: 10,
  asignaturaCodigo: "MAT-101",
  asignaturaNombre: "Cálculo I",
  periodo: "2026-2",
  numeroGrupo: "2",
  docenteNombre: "Ana Pérez",
};
const NO_TEACHER = {
  ...GROUP,
  grupoId: 3,
  asignaturaId: 11,
  numeroGrupo: "1",
  asignaturaCodigo: "FIS-201",
  asignaturaNombre: "Física",
  docenteNombre: null,
};
const DOC = { id: 5, nombreOriginal: "receta.pdf", tamanoBytes: 2048 };
const FILLED = {
  causa: "medica",
  fechaInicio: "2026-10-01",
  fechaFin: "2026-10-03",
};

function ui(props: Partial<Parameters<typeof ReviewStep>[0]> = {}) {
  return (
    <ReviewStep
      draft={FILLED}
      groups={[GROUP, NO_TEACHER]}
      documents={[DOC]}
      degraded={false}
      {...props}
    />
  );
}

const section = (name: string) => screen.getByRole("region", { name });

beforeEach(() => {
  submitRequestAction.mockReset();
  discardDraftAction.mockReset();
});

describe("ReviewStep: what is shown (RF-01)", () => {
  it("shows cause, dates, subjects with group and teacher, and documents", () => {
    renderIntl(ui());
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Revisa y presenta tu solicitud",
      }),
    ).toBeInTheDocument();

    const details = within(section("Causa y fechas"));
    expect(details.getByText("Causa médica")).toBeInTheDocument();
    expect(
      details.getByText("Del 1 de octubre de 2026 al 3 de octubre de 2026"),
    ).toBeInTheDocument();

    const subjects = within(section("Asignaturas"));
    expect(subjects.getByText("MAT-101 · Cálculo I")).toBeInTheDocument();
    expect(subjects.getByText("Grupo 2")).toBeInTheDocument();
    expect(subjects.getByText("Docente: Ana Pérez")).toBeInTheDocument();
    expect(subjects.getByText("FIS-201 · Física")).toBeInTheDocument();
    expect(subjects.getByText("Sin docente asignado")).toBeInTheDocument();

    const documents = within(section("Documentos"));
    expect(documents.getByText("receta.pdf")).toBeInTheDocument();
    expect(documents.getByText("2,0 KB")).toBeInTheDocument();
  });

  it("links each document to its inline view in a new tab", () => {
    renderIntl(ui());
    const view = within(section("Documentos")).getByRole("link", {
      name: "Ver receta.pdf",
    });
    expect(view).toHaveAttribute("href", "/api/intake/documents/5");
    expect(view).toHaveAttribute("target", "_blank");
    expect(view).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("labels the view link in English", () => {
    renderIntl(ui(), "en");
    expect(
      screen.getByRole("link", { name: "View receta.pdf" }),
    ).toHaveTextContent("View");
  });

  it("marks missing data instead of hiding it, and speaks English", () => {
    renderIntl(
      ui({
        draft: { causa: null, fechaInicio: null, fechaFin: null },
        groups: [],
        documents: [],
      }),
      "en",
    );
    expect(
      within(section("Cause and dates")).getAllByText("Not filled in"),
    ).toHaveLength(2);
    expect(
      within(section("Subjects")).getByText("Not filled in"),
    ).toBeInTheDocument();
    expect(
      within(section("Documents")).getByText("Not filled in"),
    ).toBeInTheDocument();
  });

  it("says when the subject details could not be loaded", () => {
    renderIntl(ui({ groups: [], degraded: true }));
    expect(
      within(section("Asignaturas")).getByRole("status"),
    ).toHaveTextContent("No pudimos cargar tus asignaturas.");
  });
});

describe("ReviewStep: read only with links to edit (spec: Review is read-only)", () => {
  it("has no editable control but the consent checkbox", () => {
    renderIntl(ui());
    for (const role of ["textbox", "radio", "combobox", "switch", "slider"]) {
      expect(screen.queryAllByRole(role), role).toHaveLength(0);
    }
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
  });

  it("has no editable control at all in the correction flow", () => {
    renderIntl(
      ui({
        flow: {
          basePath: "/requests/31/correct",
          actions: { resubmit: vi.fn() },
        },
      }),
    );
    for (const role of ["textbox", "radio", "checkbox", "combobox"]) {
      expect(screen.queryAllByRole(role), role).toHaveLength(0);
    }
  });

  it.each([
    ["Editar Causa y fechas", "/requests/new?step=1&from=review"],
    ["Editar Asignaturas", "/requests/new?step=2&from=review"],
    ["Editar Documentos", "/requests/new?step=3&from=review"],
  ])("%s links to its step", (name, href) => {
    renderIntl(ui());
    expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
  });

  it("goes back to the documents step", () => {
    renderIntl(ui());
    expect(screen.getByRole("link", { name: "Atrás" })).toHaveAttribute(
      "href",
      "/requests/new?step=3",
    );
  });
});

async function submitWith(errors: unknown[]) {
  submitRequestAction.mockResolvedValue({ ok: false, errors });
  await userEvent.click(
    screen.getByRole("button", { name: "Presentar solicitud" }),
  );
  await userEvent.click(
    await screen.findByRole("button", { name: "Sí, presentar" }),
  );
  await vi.waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
}

describe("ReviewStep: per-field submit errors (RF-03)", () => {
  it("puts each error under its own section and subject", async () => {
    renderIntl(ui());
    await submitWith([
      { field: "causa", key: "intake.errors.causa_invalid" },
      { field: "fechaFin", key: "intake.errors.end_too_old" },
      {
        field: "subjects",
        key: "intake.errors.group_required",
        asignaturaId: 11,
      },
      { field: "documents", key: "intake.errors.documents_required" },
      { field: "form", key: "intake.errors.submit_conflict" },
    ]);

    const details = within(section("Causa y fechas"));
    expect(
      details.getByText("Elige una de las causas de la lista."),
    ).toBeInTheDocument();
    expect(
      details.getByText(
        "La fecha de fin no puede ser anterior a 30 días antes de hoy.",
      ),
    ).toBeInTheDocument();
    const physics = screen.getByText("FIS-201 · Física").closest("li");
    expect(
      within(physics as HTMLElement).getByText(
        "Elige el grupo de esta asignatura.",
      ),
    ).toBeInTheDocument();
    const calculus = screen.getByText("MAT-101 · Cálculo I").closest("li");
    expect(within(calculus as HTMLElement).queryByRole("alert")).toBeNull();
    expect(
      within(section("Documentos")).getByText(
        "Adjunta al menos un documento de respaldo.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/La solicitud cambió mientras la enviabas/),
    ).toBeInTheDocument();
  });

  it("shows a subjects-level error under the subjects section", async () => {
    renderIntl(ui());
    await submitWith([
      { field: "subjects", key: "intake.errors.subjects_required" },
    ]);
    expect(
      within(section("Asignaturas")).getByText(
        "Marca al menos una asignatura.",
      ),
    ).toBeInTheDocument();
  });

  it("shows no alert before anything is submitted", () => {
    renderIntl(ui());
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

const CONSENT_ERROR = {
  field: "consent",
  key: "intake.errors.consent_required",
};
const consentBox = () =>
  screen.getByRole("checkbox", { name: /Acepto que la UAM/ });
const consentLabelText = () =>
  screen.getByText(/Acepto que la UAM use los datos de esta solicitud/);

describe("ReviewStep: consent checkbox (RF-03 e, RN-25)", () => {
  it("starts unchecked, above the footer, labelled with the approved text", () => {
    renderIntl(ui());

    expect(consentBox()).not.toBeChecked();
    expect(consentLabelText()).toHaveTextContent(
      "incluidos los datos de salud que contengan, solo para tramitarla, y que se envíen a los docentes de las asignaturas afectadas.",
    );
    const footer = document.querySelector('[data-slot="card-footer"]');
    expect(footer).not.toBeNull();
    expect(
      consentBox().compareDocumentPosition(footer as Node) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("is unchecked again when the step is opened again, storing nothing", async () => {
    const first = renderIntl(ui());
    await userEvent.click(consentBox());
    expect(consentBox()).toBeChecked();
    first.unmount();

    renderIntl(ui());
    expect(consentBox()).not.toBeChecked();
    expect(submitRequestAction).not.toHaveBeenCalled();
    expect(discardDraftAction).not.toHaveBeenCalled();
  });

  it("speaks English", () => {
    renderIntl(ui(), "en");
    expect(
      screen.getByRole("checkbox", { name: /I agree that UAM may use/ }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("link", { name: /View privacy notice/ }),
    ).toHaveAttribute("href", "/privacy");
  });

  it("links the notice in a new tab and says so to a screen reader", () => {
    renderIntl(ui());
    const link = screen.getByRole("link", {
      name: "Ver aviso de privacidad (se abre en una pestaña nueva)",
    });
    expect(link).toHaveAttribute("href", "/privacy");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(
      within(link).getByText("(se abre en una pestaña nueva)"),
    ).toHaveClass("sr-only");
  });

  it("toggles on a click on the label text", async () => {
    renderIntl(ui());
    await userEvent.click(consentLabelText());
    expect(consentBox()).toBeChecked();
    await userEvent.click(consentLabelText());
    expect(consentBox()).not.toBeChecked();
  });

  it("does not toggle on a click on the privacy link", async () => {
    renderIntl(ui());
    await userEvent.click(consentBox());
    expect(consentBox()).toBeChecked();

    // A raw click event: jsdom applies the label rule (an interactive
    // descendant does not activate the label's control), as a browser does.
    // user-event would emulate its own label click and mask the rule.
    fireEvent.click(
      screen.getByRole("link", { name: /Ver aviso de privacidad/ }),
    );

    expect(consentBox()).toBeChecked();
  });

  it("keeps the submit button enabled and opens the dialog while unchecked", async () => {
    renderIntl(ui());
    const submit = screen.getByRole("button", { name: "Presentar solicitud" });
    expect(submit).toBeEnabled();

    await userEvent.click(submit);

    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(submitRequestAction).not.toHaveBeenCalled();
  });

  it("sends null when unchecked and the version when checked", async () => {
    submitRequestAction.mockResolvedValue({ ok: false, errors: [] });
    renderIntl(ui());
    await submitWith([]);
    expect(submitRequestAction).toHaveBeenLastCalledWith({
      consentVersion: null,
    });

    await userEvent.click(consentBox());
    await submitWith([]);
    expect(submitRequestAction).toHaveBeenLastCalledWith({
      consentVersion: CONSENT_VERSION,
    });
    expect(submitRequestAction).toHaveBeenCalledTimes(2);
  });

  it("shows a consent error under the box, tied to it, not in the form-level block", async () => {
    renderIntl(ui());
    await submitWith([
      CONSENT_ERROR,
      { field: "form", key: "intake.errors.submit_conflict" },
    ]);

    const alert = await screen.findByText(
      "Marca la casilla de consentimiento para presentar la solicitud.",
    );
    expect(alert).toBeInTheDocument();
    const box = consentBox();
    expect(box).toHaveAttribute("aria-invalid", "true");
    const describedBy = box.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)).toContainElement(
      alert,
    );
    // The form-level block only holds the unrelated conflict message.
    const formLevel = document.getElementById("review-form-error");
    expect(formLevel).not.toBeNull();
    expect(formLevel).not.toContainElement(alert);
    expect(formLevel).toHaveTextContent(/La solicitud cambió/);
  });

  it("does not claim a consent error exists before one is returned", () => {
    renderIntl(ui());
    expect(consentBox()).not.toHaveAttribute("aria-invalid");
    expect(consentBox()).not.toHaveAttribute("aria-describedby");
  });

  it("clears the consent error when the box is checked, keeping the others", async () => {
    renderIntl(ui());
    await submitWith([
      CONSENT_ERROR,
      { field: "documents", key: "intake.errors.documents_required" },
    ]);
    const message =
      "Marca la casilla de consentimiento para presentar la solicitud.";
    expect(await screen.findByText(message)).toBeInTheDocument();

    await userEvent.click(consentBox());

    expect(screen.queryByText(message)).toBeNull();
    expect(consentBox()).not.toHaveAttribute("aria-invalid");
    expect(
      within(section("Documentos")).getByText(
        "Adjunta al menos un documento de respaldo.",
      ),
    ).toBeInTheDocument();
  });

  it("keeps the box checked after a refusal, and shows an outdated-text error", async () => {
    renderIntl(ui());
    await userEvent.click(consentBox());
    await submitWith([
      { field: "consent", key: "intake.errors.consent_outdated" },
    ]);

    expect(consentBox()).toBeChecked();
    expect(
      await screen.findByText(/El texto del consentimiento cambió/),
    ).toBeInTheDocument();
  });
});

describe("ReviewStep inside the correction flow", () => {
  const resubmit = vi.fn();
  const flow = { basePath: "/requests/31/correct", actions: { resubmit } };

  beforeEach(() => resubmit.mockReset());

  it("offers resubmit instead of submit and discard, under the flow's path", () => {
    renderIntl(ui({ flow }));

    expect(
      screen.getByRole("button", { name: "Reenviar solicitud" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Presentar solicitud" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Descartar borrador" }),
    ).toBeNull();
    expect(screen.getByRole("link", { name: "Atrás" })).toHaveAttribute(
      "href",
      "/requests/31/correct?step=3",
    );
    expect(
      screen.getByRole("link", { name: "Editar Causa y fechas" }),
    ).toHaveAttribute("href", "/requests/31/correct?step=1&from=review");
  });

  it("shows no consent checkbox, text or link (C4: consent is given once)", () => {
    renderIntl(ui({ flow }));

    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByText(/Acepto que la UAM/)).toBeNull();
    expect(
      screen.queryByRole("link", { name: /aviso de privacidad/i }),
    ).toBeNull();
  });

  it("resubmits only after the confirmation", async () => {
    resubmit.mockResolvedValue({ ok: true });
    renderIntl(ui({ flow }));

    await userEvent.click(
      screen.getByRole("button", { name: "Reenviar solicitud" }),
    );
    expect(resubmit).not.toHaveBeenCalled();
    await userEvent.click(
      await screen.findByRole("button", { name: "Cancelar" }),
    );
    expect(resubmit).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole("button", { name: "Reenviar solicitud" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Sí, reenviar" }),
    );
    await vi.waitFor(() => expect(resubmit).toHaveBeenCalledTimes(1));
    expect(submitRequestAction).not.toHaveBeenCalled();
  });

  it("puts the resubmit refusals under their sections", async () => {
    resubmit.mockResolvedValue({
      ok: false,
      errors: [{ field: "documents", key: "intake.errors.documents_required" }],
    });
    renderIntl(ui({ flow }));

    await userEvent.click(
      screen.getByRole("button", { name: "Reenviar solicitud" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Sí, reenviar" }),
    );

    expect(
      await within(section("Documentos")).findByText(
        "Adjunta al menos un documento de respaldo.",
      ),
    ).toBeInTheDocument();
  });
});
