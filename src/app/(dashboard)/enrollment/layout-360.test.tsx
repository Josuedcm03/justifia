import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { renderIntl } from "@/app/(dashboard)/requests/new/test-support";

// RNF-11 (student-enrollment "No horizontal scroll"): jsdom has no layout, so
// this is the same static guard as `requests/new/layout-360.test.tsx`. It cannot
// prove the absence of a horizontal scrollbar; it catches the usual causes at
// 360 px: a fixed width above the viewport, an action that does not fill the
// row, and a long name that cannot wrap. The real check is the owner walk at
// 360 px (tasks, phase 13).

vi.mock("@/app/(dashboard)/enrollment/actions", () => ({
  enrollAction: vi.fn(),
  dropAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

import { GroupPicker } from "@/app/(dashboard)/enrollment/group-picker";
import { MyEnrollments } from "@/app/(dashboard)/enrollment/my-enrollments";
import type { MyEnrollment } from "@/lib/data/enrollment-picker";

const VIEWPORT = 360;
const REM = 16;
const SPACING_PX = 4;

const LONG: MyEnrollment = {
  grupoId: 1,
  asignaturaId: 10,
  asignaturaCodigo: "MAT-101",
  asignaturaNombre: "Cálculo diferencial e integral para ingeniería civil",
  periodo: "2026-S2",
  numeroGrupo: "01",
  docenteNombre: "Ana María de los Ángeles Pérez Castellón",
  inOpenRequest: true,
};

/** Width in px a base (non-breakpoint) width utility forces, or null. */
function fixedWidth(token: string): number | null {
  const arbitrary = /^(?:min-)?w-\[(\d+(?:\.\d+)?)(px|rem)\]$/.exec(token);
  if (arbitrary) {
    const value = Number(arbitrary[1]);
    return arbitrary[2] === "rem" ? value * REM : value;
  }
  const scale = /^(?:min-)?w-(\d+)$/.exec(token);
  return scale ? Number(scale[1]) * SPACING_PX : null;
}

/** Elements whose unprefixed width class exceeds the 360 px viewport. */
function tooWide(root: ParentNode): string[] {
  return [...root.querySelectorAll("[class]")].flatMap((element) =>
    element.className
      .toString()
      .split(/\s+/)
      .filter((token) => (fixedWidth(token) ?? 0) > VIEWPORT),
  );
}

describe("the width guard itself", () => {
  it("flags a fixed width above the viewport and passes the ones below", () => {
    const { container } = render(
      <div>
        <div className="w-[400px]" />
        <div className="min-w-[30rem] sm:w-96" />
        <div className="w-96" />
        <div className="w-[320px] w-full max-w-md sm:w-auto" />
      </div>,
    );
    expect(tooWide(container)).toEqual(["w-[400px]", "min-w-[30rem]", "w-96"]);
  });
});

describe("the enrollment list at 360 px", () => {
  it("sets no width above the viewport", () => {
    renderIntl(<MyEnrollments enrollments={[LONG]} />);

    expect(tooWide(document.body)).toEqual([]);
  });

  it("wraps long names instead of widening the row, and the drop control fills it", () => {
    renderIntl(<MyEnrollments enrollments={[LONG]} />);

    const name = screen.getByText(/Cálculo diferencial/);
    expect(name).toHaveClass("break-words");
    expect(name.parentElement).toHaveClass("min-w-0");
    expect(screen.getByText(/Ana María/)).toHaveClass("break-words");
    expect(screen.getByRole("button", { name: /^Dar de baja/ })).toHaveClass(
      "w-full",
    );
  });
});

describe("the drop dialog at 360 px", () => {
  it("opens within the viewport with stacked, reachable actions and a wrapping title", async () => {
    renderIntl(<MyEnrollments enrollments={[LONG]} />);
    await userEvent.click(screen.getByRole("button", { name: /^Dar de baja/ }));
    const dialog = await screen.findByRole("alertdialog");

    expect(tooWide(document.body)).toEqual([]);
    expect(dialog).toHaveClass("w-[calc(100%-2rem)]");
    expect(screen.getByText(/¿Dar de baja MAT-101/)).toHaveClass("break-words");
    const confirm = screen.getByRole("button", { name: "Sí, dar de baja" });
    expect(confirm).toBeVisible();
    expect(confirm.parentElement).toHaveClass("flex-col-reverse");
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeVisible();
  });
});

const PICKER: ComponentProps<typeof GroupPicker> = {
  periodo: "2026-S2",
  asignaturas: [
    {
      id: 10,
      codigo: "MAT-101",
      nombre: LONG.asignaturaNombre,
      carreraNombre: "Ingeniería",
      ownCarrera: true,
    },
  ],
  truncated: false,
  selectedId: 10,
  groups: [
    {
      grupoId: 2,
      numeroGrupo: "02",
      docenteNombre: LONG.docenteNombre,
      dias: ["lunes", "martes", "miercoles", "jueves", "viernes"],
    },
  ],
  enrollments: [LONG],
};

describe("the picker at 360 px", () => {
  it("sets no width above the viewport, stacks the enroll control and wraps a long docente name", () => {
    renderIntl(<GroupPicker {...PICKER} />);

    expect(tooWide(document.body)).toEqual([]);
    expect(
      screen.getByRole("button", { name: "Inscribirme en Grupo 02" }),
    ).toHaveClass("w-full");
    const meta = screen.getByText(/Ana María/);
    expect(meta).toHaveClass("break-words");
    expect(meta.parentElement).toHaveClass("min-w-0");
  });

  it("opens the replace dialog within the viewport with stacked, reachable actions", async () => {
    renderIntl(<GroupPicker {...PICKER} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Inscribirme en Grupo 02" }),
    );
    const dialog = await screen.findByRole("alertdialog");

    expect(tooWide(document.body)).toEqual([]);
    expect(dialog).toHaveClass("w-[calc(100%-2rem)]");
    expect(screen.getByText(/¿Reemplazar MAT-101/)).toHaveClass("break-words");
    const confirm = screen.getByRole("button", { name: "Sí, reemplazar" });
    expect(confirm).toBeVisible();
    expect(confirm.parentElement).toHaveClass("flex-col-reverse");
  });
});
