import { screen, within } from "@testing-library/react";
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
  it("has no editable control inside the review", () => {
    renderIntl(ui());
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
