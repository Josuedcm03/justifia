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

const OWN_A: EnrollableAsignatura = {
  id: 1,
  codigo: "MAT-101",
  nombre: "Álgebra",
  carreraNombre: "Ingeniería",
  ownCarrera: true,
};
const OWN_B: EnrollableAsignatura = {
  id: 2,
  codigo: "MAT-102",
  nombre: "Geometría",
  carreraNombre: "Ingeniería",
  ownCarrera: true,
};
const OTHER: EnrollableAsignatura = {
  id: 3,
  codigo: "ECO-201",
  nombre: "Cálculo mercantil",
  carreraNombre: "Administración",
  ownCarrera: false,
};

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

beforeEach(() => {
  enrollAction.mockReset();
  replace.mockReset();
});

describe("GroupPicker subjects (RF-16, RN-21)", () => {
  it("lists the student's own carrera first, whatever order it receives", async () => {
    const user = userEvent.setup();
    show({ asignaturas: [OTHER, OWN_A, OWN_B] });

    await user.click(search());

    const options = await screen.findAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      "MAT-101 · Álgebra",
      "MAT-102 · Geometría",
      "ECO-201 · Cálculo mercantil (Administración)",
    ]);
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

  it("does not show the no-results state while the term matches", async () => {
    const user = userEvent.setup();
    show();

    await user.type(search(), "alg");

    await screen.findAllByRole("option");
    expect(screen.queryByText(/Sin resultados/)).toBeNull();
    await closePopup(user);
  });

  it("offers every subject in one searchable list to a student without carrera", async () => {
    const user = userEvent.setup();
    show({
      asignaturas: [
        { ...OWN_A, ownCarrera: false },
        { ...OWN_B, ownCarrera: false },
        OTHER,
      ],
    });

    await user.click(search());

    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(3);
    expect(options[0]).toHaveTextContent("MAT-101 · Álgebra (Ingeniería)");
    await closePopup(user);
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

  it("says when the subject list was cut", () => {
    show({ truncated: true });

    expect(screen.getByText(es.enrollment.picker.truncated)).toBeVisible();
  });

  it("does not say it when the list is complete", () => {
    show({ truncated: false });

    expect(screen.queryByText(es.enrollment.picker.truncated)).toBeNull();
  });
});

describe("GroupPicker groups (RF-16)", () => {
  it("lists the groups of the chosen subject with docente and days", () => {
    show({ selectedId: 1, groups: [G1, G2] });

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
  });

  it("shows no group list without a chosen subject or without groups", () => {
    const { unmount } = show({ selectedId: null, groups: [] });
    expect(screen.queryByRole("list")).toBeNull();
    unmount();

    show({ selectedId: 99, groups: [] });
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("marks the group the student is already in and offers no enroll on it", () => {
    show({ selectedId: 1, groups: [G1, G2], enrollments: [enrolled()] });

    const [mine, other] = screen.getAllByRole("listitem");
    expect(mine).toHaveTextContent(es.enrollment.picker.enrolled);
    expect(within(mine).queryByRole("button")).toBeNull();
    expect(
      within(other).getByRole("button", { name: "Inscribirme en Grupo 02" }),
    ).toHaveClass("h-11");
  });

  it("enrolls directly when the student has no group of that subject", async () => {
    enrollAction.mockResolvedValue({ ok: true });
    show({ selectedId: 1, groups: [G1, G2] });

    await userEvent.click(
      screen.getByRole("button", { name: "Inscribirme en Grupo 02" }),
    );

    await waitFor(() => expect(enrollAction).toHaveBeenCalledTimes(1));
    expect(enrollAction).toHaveBeenCalledWith({ grupoId: 12 });
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("shows the error of a refused enrollment", async () => {
    enrollAction.mockResolvedValue({ ok: false, error: "not_eligible" });
    show({ selectedId: 1, groups: [G1, G2] });

    await userEvent.click(
      screen.getByRole("button", { name: "Inscribirme en Grupo 02" }),
    );

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
    await userEvent.click(
      screen.getByRole("button", { name: "Inscribirme en Grupo 02" }),
    );
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
    expect(enrollAction).not.toHaveBeenCalled();
  });

  it("cancel changes nothing", async () => {
    show(props);
    await pickG2();

    await userEvent.click(
      screen.getByRole("button", { name: es.enrollment.dialog.cancel }),
    );

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(enrollAction).not.toHaveBeenCalled();
  });

  it("confirming enrolls in the new group and closes", async () => {
    enrollAction.mockResolvedValue({ ok: true });
    show(props);
    await pickG2();

    await userEvent.click(
      screen.getByRole("button", {
        name: es.enrollment.dialog.replace.confirm,
      }),
    );

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(enrollAction).toHaveBeenCalledTimes(1);
    expect(enrollAction).toHaveBeenCalledWith({ grupoId: 12 });
  });

  it("warns when a draft or returned request uses the group being replaced", async () => {
    show({ ...props, enrollments: [enrolled({ inOpenRequest: true })] });

    await pickG2();

    expect(screen.getByText(es.enrollment.dialog.warning)).toBeInTheDocument();
  });

  it("does not warn without a dependent request", async () => {
    show(props);

    await pickG2();

    expect(screen.queryByText(es.enrollment.dialog.warning)).toBeNull();
  });

  it.each([
    ["another asignatura", { asignaturaId: 2 }],
    ["another period", { periodo: "2026-S1" }],
  ])("enrolls directly when the other group is of %s", async (_l, other) => {
    enrollAction.mockResolvedValue({ ok: true });
    show({ ...props, enrollments: [enrolled({ grupoId: 99, ...other })] });

    await userEvent.click(
      screen.getByRole("button", { name: "Inscribirme en Grupo 02" }),
    );

    await waitFor(() =>
      expect(enrollAction).toHaveBeenCalledWith({ grupoId: 12 }),
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});
