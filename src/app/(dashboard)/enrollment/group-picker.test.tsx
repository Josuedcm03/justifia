import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderIntl } from "@/app/(dashboard)/requests/new/test-support";

const { enrollAction, replace } = vi.hoisted(() => ({
  enrollAction: vi.fn(),
  replace: vi.fn(),
}));
vi.mock("@/app/(dashboard)/enrollment/actions", () => ({ enrollAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

import { GroupPicker } from "@/app/(dashboard)/enrollment/group-picker";

import type {
  EnrollableAsignatura,
  EnrollableGroup,
  MyEnrollment,
} from "@/lib/data/enrollment-picker";

import es from "../../../../i18n/es.json";

const asig = (
  id: number,
  codigo: string,
  nombre: string,
  carreraNombre: string,
  ownCarrera = true,
): EnrollableAsignatura => ({ id, codigo, nombre, carreraNombre, ownCarrera });

const OWN_A = asig(1, "MAT-101", "Álgebra", "Ingeniería");
const OWN_B = asig(2, "MAT-102", "Geometría", "Ingeniería");
const OTHER = asig(3, "ECO-201", "Cálculo mercantil", "Administración", false);

const G1: EnrollableGroup = {
  grupoId: 11,
  numeroGrupo: "01",
  docenteNombre: "Ana Pérez",
  dias: ["lunes", "miercoles"],
};
const G2: EnrollableGroup = {
  grupoId: 12,
  numeroGrupo: "02",
  docenteNombre: null,
  dias: [],
};

function enrolled(overrides: Partial<MyEnrollment> = {}): MyEnrollment {
  return {
    grupoId: 11,
    asignaturaId: 1,
    asignaturaCodigo: "MAT-101",
    asignaturaNombre: "Álgebra",
    periodo: "2026-S2",
    numeroGrupo: "01",
    docenteNombre: "Ana Pérez",
    inOpenRequest: false,
    ...overrides,
  };
}

type Props = Parameters<typeof GroupPicker>[0];

function show(props: Partial<Props> = {}, locale: "es" | "en" = "es") {
  return renderIntl(
    <GroupPicker
      periodo="2026-S2"
      asignaturas={[OWN_A, OWN_B, OTHER]}
      truncated={false}
      selectedId={null}
      groups={[]}
      enrollments={[]}
      {...props}
    />,
    locale,
  );
}

const search = () => screen.getByRole("combobox", { name: /Asignatura/ });

async function closePopup(user: ReturnType<typeof userEvent.setup>) {
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryAllByRole("option")).toHaveLength(0));
}

const press = (name: string) =>
  userEvent.click(screen.getByRole("button", { name }));
const enrollG2 = () => press("Inscribirme en Grupo 02");

beforeEach(() => {
  enrollAction.mockReset();
  replace.mockReset();
});

describe("GroupPicker subjects (RF-16, RN-21)", () => {
  it.each([
    [
      "lists the student's own carrera first, whatever order it receives",
      [OTHER, OWN_A, OWN_B],
      [
        "MAT-101 · Álgebra",
        "MAT-102 · Geometría",
        "ECO-201 · Cálculo mercantil (Administración)",
      ],
    ],
    [
      "offers every subject in one searchable list to a student without carrera",
      [{ ...OWN_A, ownCarrera: false }, { ...OWN_B, ownCarrera: false }, OTHER],
      [
        "MAT-101 · Álgebra (Ingeniería)",
        "MAT-102 · Geometría (Ingeniería)",
        "ECO-201 · Cálculo mercantil (Administración)",
      ],
    ],
  ])("%s", async (_l, asignaturas, labels) => {
    const user = userEvent.setup();
    show({ asignaturas });

    await user.click(search());

    const options = await screen.findAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(labels);
    await closePopup(user);
  });

  it.each([
    ["name without accent", "calculo"],
    ["code", "eco-2"],
    ["carrera name", "administr"],
  ])("finds another carrera's subject by %s", async (_l, term) => {
    const user = userEvent.setup();
    show();

    await user.type(search(), term);

    const options = await screen.findAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      "ECO-201 · Cálculo mercantil (Administración)",
    ]);
    expect(screen.queryByText(/Sin resultados/)).toBeNull();
    await closePopup(user);
  });

  it("shows the shared no-results state with the term and clears it on demand", async () => {
    const user = userEvent.setup();
    show();

    await user.type(search(), "zzz");

    expect(
      await screen.findByText("Sin resultados para «zzz»"),
    ).toBeInTheDocument();
    await closePopup(user);
    const clear = screen.getByRole("button", { name: "Borrar búsqueda" });
    await user.click(clear);

    expect(screen.queryByText(/Sin resultados/)).toBeNull();
    expect(search()).toHaveValue("");
  });

  it("puts the chosen asignatura in the URL", async () => {
    const user = userEvent.setup();
    show();

    await user.click(search());
    await user.click(
      await screen.findByRole("option", { name: "MAT-102 · Geometría" }),
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith("?asignatura=2"));
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it("starts on the asignatura of the URL", () => {
    show({ selectedId: 2, groups: [G1] });

    expect(search()).toHaveValue("MAT-102 · Geometría");
  });

  it.each([true, false])(
    "shows the cut notice only if truncated is %s",
    (truncated) => {
      show({ truncated });

      const notice = screen.queryByText(es.enrollment.picker.truncated);

      if (truncated) expect(notice).toBeVisible();
      else expect(notice).not.toBeInTheDocument();
    },
  );
});

describe("GroupPicker groups (RF-16)", () => {
  it("lists the groups with docente and days and marks the one the student is in", () => {
    show({ selectedId: 1, groups: [G1, G2], enrollments: [enrolled()] });

    const items = within(
      screen.getByRole("list", { name: es.enrollment.picker.groupsCaption }),
    ).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Grupo 01");
    expect(items[0]).toHaveTextContent("Docente: Ana Pérez");
    expect(items[0]).toHaveTextContent("Días: Lun, Mié");
    expect(items[1]).toHaveTextContent("Grupo 02");
    expect(items[1]).toHaveTextContent(es.enrollment.list.noTeacher);
    expect(items[1]).toHaveTextContent("Días: Días sin definir");
    expect(items[0]).toHaveTextContent(es.enrollment.picker.enrolled);
    expect(within(items[0]).queryByRole("button")).toBeNull();
    expect(
      within(items[1]).getByRole("button", { name: "Inscribirme en Grupo 02" }),
    ).toHaveClass("h-11");
  });

  it("shows no group list without a chosen subject or without groups", () => {
    const { unmount } = show({ selectedId: null, groups: [] });
    expect(screen.queryByRole("list")).toBeNull();
    unmount();

    show({ selectedId: 99, groups: [] });
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("shows the error of a refused enrollment", async () => {
    enrollAction.mockResolvedValue({ ok: false, error: "not_eligible" });
    show({ selectedId: 1, groups: [G1, G2] });

    await enrollG2();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      es.enrollment.errors.not_eligible,
    );
  });

  it("speaks English", () => {
    show({ selectedId: 1, groups: [G1, G2], enrollments: [enrolled()] }, "en");

    expect(
      screen.getByRole("button", { name: "Enroll in Group 02" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")[0]).toHaveTextContent(
      "Days: Mon, Wed",
    );
  });
});

describe("GroupPicker replace (RF-16, RNF-12, D5)", () => {
  // The student is in group 11 (G1) of asignatura 1 for 2026-S2 and picks G2.
  const props = { selectedId: 1, groups: [G1, G2], enrollments: [enrolled()] };

  async function pickG2() {
    await enrollG2();
    return screen.findByRole("alertdialog");
  }

  it("asks first, naming the group being replaced, and enrolls nothing yet", async () => {
    show(props);

    const dialog = await pickG2();

    expect(dialog).toHaveAccessibleName(
      "¿Reemplazar MAT-101 · Álgebra, Grupo 01?",
    );
    expect(dialog).toHaveAccessibleDescription(
      /MAT-101 · Álgebra, Grupo 01.*Grupo 02/,
    );
    expect(screen.queryByText(es.enrollment.dialog.warning)).toBeNull();
    expect(enrollAction).not.toHaveBeenCalled();
  });

  it("cancel changes nothing", async () => {
    show(props);
    await pickG2();

    await press(es.enrollment.dialog.cancel);

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(enrollAction).not.toHaveBeenCalled();
  });

  it("confirming enrolls in the new group and closes", async () => {
    enrollAction.mockResolvedValue({ ok: true });
    show(props);
    await pickG2();

    await press(es.enrollment.dialog.replace.confirm);

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(enrollAction).toHaveBeenCalledTimes(1);
    expect(enrollAction).toHaveBeenCalledWith({ grupoId: 12 });
  });

  it("warns when a draft or returned request uses the group being replaced", async () => {
    show({ ...props, enrollments: [enrolled({ inOpenRequest: true })] });

    await pickG2();

    expect(screen.getByText(es.enrollment.dialog.warning)).toBeInTheDocument();
  });

  it.each([
    ["no group of that subject", []],
    [
      "a group of another asignatura",
      [enrolled({ grupoId: 99, asignaturaId: 2 })],
    ],
    [
      "a group of another period",
      [enrolled({ grupoId: 99, periodo: "2026-S1" })],
    ],
  ])("enrolls directly when the student has %s", async (_l, enrollments) => {
    enrollAction.mockResolvedValue({ ok: true });
    show({ ...props, enrollments });

    await enrollG2();

    await waitFor(() =>
      expect(enrollAction).toHaveBeenCalledWith({ grupoId: 12 }),
    );
    expect(enrollAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});
