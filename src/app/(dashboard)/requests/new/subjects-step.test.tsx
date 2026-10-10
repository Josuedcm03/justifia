import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderIntl } from "@/app/(dashboard)/requests/new/test-support";
import type { EnrollmentGroup } from "@/lib/data/enrollment";

const { saveSubjectsAction, push } = vi.hoisted(() => ({
  saveSubjectsAction: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/app/(dashboard)/requests/new/actions", () => ({
  saveSubjectsAction,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { SubjectsStep } from "@/app/(dashboard)/requests/new/subjects-step";

function group(overrides: Partial<EnrollmentGroup>): EnrollmentGroup {
  return {
    grupoId: 1,
    asignaturaId: 10,
    asignaturaCodigo: "MAT-101",
    asignaturaNombre: "Cálculo I",
    periodo: "2026-2",
    numeroGrupo: "1",
    docenteNombre: "Ana Pérez",
    ...overrides,
  };
}

const CALCULO = group({});
const FISICA = group({
  grupoId: 2,
  asignaturaId: 20,
  asignaturaCodigo: "FIS-101",
  asignaturaNombre: "Física I",
  docenteNombre: null,
});
const QUIMICA_A = group({
  grupoId: 3,
  asignaturaId: 30,
  asignaturaCodigo: "QUI-101",
  asignaturaNombre: "Química I",
  numeroGrupo: "1",
  docenteNombre: "Luis Mora",
});
const QUIMICA_B = group({
  grupoId: 4,
  asignaturaId: 30,
  asignaturaCodigo: "QUI-101",
  asignaturaNombre: "Química I",
  numeroGrupo: "2",
  docenteNombre: null,
});
const ALL = [CALCULO, FISICA, QUIMICA_A, QUIMICA_B];

type Props = Partial<Parameters<typeof SubjectsStep>[0]>;
function ui(props: Props = {}) {
  return (
    <SubjectsStep
      groups={ALL}
      selected={[]}
      hasDates
      degraded={false}
      {...props}
    />
  );
}

beforeEach(() => {
  saveSubjectsAction.mockReset();
  push.mockReset();
});

const subjectBox = (name: string) =>
  screen.getByRole("checkbox", { name: new RegExp(name) });

describe("SubjectsStep: what is offered (RF-04, D5, D15)", () => {
  it("lists each enrolled subject once, even with several groups", () => {
    renderIntl(ui());
    expect(
      screen.getByRole("heading", { level: 2, name: "Asignaturas afectadas" }),
    ).toBeInTheDocument();
    for (const box of screen.getAllByRole("checkbox")) {
      expect(box).not.toBeChecked();
    }
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    expect(subjectBox("MAT-101")).toHaveAccessibleName(/Cálculo I/);
    expect(subjectBox("QUI-101")).toHaveAccessibleName(/Química I/);
  });

  it("shows group and teacher with no further input for a single group", async () => {
    renderIntl(ui());
    expect(screen.queryByText("Docente: Ana Pérez")).toBeNull();

    await userEvent.click(subjectBox("MAT-101"));
    expect(screen.getByText("Grupo 1")).toBeInTheDocument();
    expect(screen.getByText("Docente: Ana Pérez")).toBeInTheDocument();
    expect(screen.queryByRole("radio")).toBeNull();
  });

  it("labels a group without teacher and does not block it (D15)", async () => {
    renderIntl(ui());
    await userEvent.click(subjectBox("FIS-101"));
    expect(screen.getByText("Sin docente asignado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar" })).toBeEnabled();
  });

  it("asks for a group when enrollment is ambiguous, none preselected", async () => {
    renderIntl(ui());
    await userEvent.click(subjectBox("QUI-101"));

    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);
    expect(radios.map((r) => r.getAttribute("aria-checked"))).toEqual([
      "false",
      "false",
    ]);
    expect(
      screen.getByRole("radiogroup", {
        name: "Elige el grupo de esta asignatura",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /Grupo 1.*Luis Mora/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /Grupo 2.*Sin docente asignado/ }),
    ).toBeInTheDocument();
  });

  it("restores a resumed selection, including the chosen group", () => {
    renderIntl(
      ui({
        selected: [
          { asignaturaId: 10, grupoId: 1 },
          { asignaturaId: 30, grupoId: 4 },
        ],
      }),
    );
    expect(subjectBox("MAT-101")).toBeChecked();
    expect(subjectBox("QUI-101")).toBeChecked();
    expect(screen.getByRole("radio", { name: /Grupo 2/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: /Grupo 1/ })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });
});

describe("SubjectsStep: the states without a list", () => {
  it("asks for dates first and links to step 1", () => {
    renderIntl(ui({ hasDates: false }));
    expect(
      screen.getByText(
        "Indica primero las fechas de la ausencia para ver tus asignaturas.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(
      screen.getByRole("link", { name: "Ir a causa y fechas" }),
    ).toHaveAttribute("href", "/requests/new?step=1");
  });

  it("says so when the enrollment could not be read", () => {
    renderIntl(ui({ degraded: true, groups: [] }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "No pudimos cargar tus asignaturas.",
    );
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("says so when there is nothing to offer, in English", () => {
    renderIntl(ui({ groups: [] }), "en");
    expect(
      screen.getByText("You have no active subjects you are enrolled in."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
  });
});

describe("SubjectsStep: saving", () => {
  it("returns to the review after saving when opened from it", async () => {
    saveSubjectsAction.mockResolvedValue({ ok: true });
    renderIntl(ui({ fromReview: true }));

    await userEvent.click(subjectBox("MAT-101"));
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/requests/new?step=4"),
    );
  });

  it("goes back to the review, not the previous step, when opened from it", () => {
    renderIntl(ui({ fromReview: true }));
    expect(screen.getByRole("link", { name: "Atrás" })).toHaveAttribute(
      "href",
      "/requests/new?step=4",
    );
  });

  it("sends the picked subjects with their groups and moves on", async () => {
    saveSubjectsAction.mockResolvedValue({ ok: true });
    renderIntl(ui());

    await userEvent.click(subjectBox("MAT-101"));
    await userEvent.click(subjectBox("QUI-101"));
    await userEvent.click(screen.getByRole("radio", { name: /Grupo 2/ }));
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/requests/new?step=3"),
    );
    expect(saveSubjectsAction).toHaveBeenCalledWith({
      selections: [
        { asignaturaId: 10, grupoId: 1 },
        { asignaturaId: 30, grupoId: 4 },
      ],
    });
  });

  it("leaves an unticked subject out", async () => {
    saveSubjectsAction.mockResolvedValue({ ok: true });
    renderIntl(ui({ selected: [{ asignaturaId: 20, grupoId: 2 }] }));

    await userEvent.click(subjectBox("MAT-101"));
    await userEvent.click(subjectBox("FIS-101"));
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await waitFor(() => expect(saveSubjectsAction).toHaveBeenCalled());
    expect(saveSubjectsAction).toHaveBeenCalledWith({
      selections: [{ asignaturaId: 10, grupoId: 1 }],
    });
  });

  it("sends a null group for an ambiguous subject and shows the error under it", async () => {
    saveSubjectsAction.mockResolvedValue({
      ok: false,
      errors: [
        {
          field: "subjects",
          key: "intake.errors.group_required",
          asignaturaId: 30,
        },
      ],
    });
    renderIntl(ui());
    await userEvent.click(subjectBox("MAT-101"));
    await userEvent.click(subjectBox("QUI-101"));
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Elige el grupo de esta asignatura.");
    expect(saveSubjectsAction).toHaveBeenCalledWith({
      selections: [
        { asignaturaId: 10, grupoId: 1 },
        { asignaturaId: 30, grupoId: null },
      ],
    });
    // The message belongs to the Química card, not to Cálculo.
    const card = alert.closest("[data-subject]") as HTMLElement;
    expect(card).toHaveAttribute("data-subject", "30");
    expect(within(card).getByRole("radiogroup")).toBeInvalid();
    expect(push).not.toHaveBeenCalled();
  });

  it("shows a step-level error that names no subject", async () => {
    saveSubjectsAction.mockResolvedValue({
      ok: false,
      errors: [{ field: "subjects", key: "intake.errors.dates_required" }],
    });
    renderIntl(ui());
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Indica primero las fechas de la ausencia.",
    );
  });

  it("goes back to step 1 without saving", () => {
    renderIntl(ui());
    expect(screen.getByRole("link", { name: "Atrás" })).toHaveAttribute(
      "href",
      "/requests/new?step=1",
    );
    expect(saveSubjectsAction).not.toHaveBeenCalled();
  });
});
