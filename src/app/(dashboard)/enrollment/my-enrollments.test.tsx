import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderIntl } from "@/app/(dashboard)/requests/new/test-support";

const { dropAction } = vi.hoisted(() => ({ dropAction: vi.fn() }));
vi.mock("@/app/(dashboard)/enrollment/actions", () => ({ dropAction }));

import { MyEnrollments } from "@/app/(dashboard)/enrollment/my-enrollments";

import es from "../../../../i18n/es.json";

const CALCULO = {
  grupoId: 11,
  asignaturaId: 1,
  asignaturaCodigo: "MAT-101",
  asignaturaNombre: "Cálculo",
  periodo: "2026-S2",
  numeroGrupo: "01",
  docenteNombre: "Ana Pérez",
  inOpenRequest: false,
};
const FISICA = {
  grupoId: 12,
  asignaturaId: 2,
  asignaturaCodigo: "FIS-110",
  asignaturaNombre: "Física",
  periodo: "2026-S1",
  numeroGrupo: "02",
  docenteNombre: null,
  inOpenRequest: true,
};

beforeEach(() => {
  dropAction.mockReset();
});

describe("MyEnrollments list (RF-16, RF-04)", () => {
  it("shows code, name, period, group and docente of each entry", () => {
    renderIntl(<MyEnrollments enrollments={[CALCULO, FISICA]} />);

    const items = within(
      screen.getByRole("list", { name: es.enrollment.list.caption }),
    ).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("MAT-101 · Cálculo");
    expect(items[0]).toHaveTextContent("Periodo 2026-S2");
    expect(items[0]).toHaveTextContent("Grupo 01");
    expect(items[0]).toHaveTextContent("Docente: Ana Pérez");
    expect(items[1]).toHaveTextContent("FIS-110 · Física");
    expect(items[1]).toHaveTextContent("Periodo 2026-S1");
  });

  it("labels a group without a docente instead of leaving it blank", () => {
    renderIntl(<MyEnrollments enrollments={[FISICA]} />);

    expect(screen.getByRole("listitem")).toHaveTextContent(
      es.enrollment.list.noTeacher,
    );
    expect(screen.queryByText(/Docente:/)).toBeNull();
  });

  it("offers a drop control per entry, at least 44 px high", () => {
    renderIntl(<MyEnrollments enrollments={[CALCULO, FISICA]} />);

    const drops = screen.getAllByRole("button", { name: /^Dar de baja/ });
    expect(drops).toHaveLength(2);
    expect(drops[0]).toHaveAccessibleName(
      "Dar de baja MAT-101 · Cálculo, Grupo 01",
    );
    for (const drop of drops) expect(drop).toHaveClass("h-11");
  });

  it("invites the student to the picker when there is no enrollment", () => {
    renderIntl(<MyEnrollments enrollments={[]} />);

    expect(screen.getByText(es.enrollment.list.empty)).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("speaks English", () => {
    renderIntl(<MyEnrollments enrollments={[CALCULO]} />, "en");

    expect(screen.getByRole("listitem")).toHaveTextContent("Period 2026-S2");
    expect(
      screen.getByRole("button", { name: /^Drop MAT-101/ }),
    ).toBeInTheDocument();
  });
});

describe("MyEnrollments drop confirmation (RNF-12, D5)", () => {
  async function openFor(name: RegExp) {
    await userEvent.click(screen.getByRole("button", { name }));
    return screen.findByRole("alertdialog");
  }

  it("opens a dialog that names the group and drops nothing yet", async () => {
    renderIntl(<MyEnrollments enrollments={[CALCULO, FISICA]} />);

    const dialog = await openFor(/MAT-101/);

    expect(dialog).toHaveAccessibleName(
      "¿Dar de baja MAT-101 · Cálculo, Grupo 01?",
    );
    expect(dropAction).not.toHaveBeenCalled();
  });

  it("warns only for a group a draft or returned request uses", async () => {
    renderIntl(<MyEnrollments enrollments={[CALCULO, FISICA]} />);

    await openFor(/MAT-101/);
    expect(screen.queryByText(es.enrollment.dialog.warning)).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: es.enrollment.dialog.cancel }),
    );
    await vi.waitFor(() =>
      expect(screen.queryByRole("alertdialog")).toBeNull(),
    );

    await openFor(/FIS-110/);
    expect(screen.getByText(es.enrollment.dialog.warning)).toBeInTheDocument();
  });

  it("cancel closes the dialog and keeps the enrollment", async () => {
    renderIntl(<MyEnrollments enrollments={[CALCULO]} />);
    await openFor(/MAT-101/);

    await userEvent.click(
      screen.getByRole("button", { name: es.enrollment.dialog.cancel }),
    );

    await vi.waitFor(() =>
      expect(screen.queryByRole("alertdialog")).toBeNull(),
    );
    expect(dropAction).not.toHaveBeenCalled();
    expect(screen.getByRole("listitem")).toHaveTextContent("MAT-101");
  });

  it("confirming drops that group and closes the dialog", async () => {
    dropAction.mockResolvedValue({ ok: true });
    renderIntl(<MyEnrollments enrollments={[CALCULO, FISICA]} />);
    await openFor(/FIS-110/);

    await userEvent.click(
      screen.getByRole("button", { name: es.enrollment.dialog.drop.confirm }),
    );

    await vi.waitFor(() =>
      expect(screen.queryByRole("alertdialog")).toBeNull(),
    );
    expect(dropAction).toHaveBeenCalledTimes(1);
    expect(dropAction).toHaveBeenCalledWith({ grupoId: 12 });
  });

  it("a refused drop shows its error and keeps the dialog", async () => {
    dropAction.mockResolvedValue({ ok: false, error: "not_enrolled" });
    renderIntl(<MyEnrollments enrollments={[CALCULO]} />);
    await openFor(/MAT-101/);

    await userEvent.click(
      screen.getByRole("button", { name: es.enrollment.dialog.drop.confirm }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      es.enrollment.errors.not_enrolled,
    );
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});
