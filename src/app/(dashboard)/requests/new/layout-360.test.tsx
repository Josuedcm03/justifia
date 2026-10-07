import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderIntl } from "@/app/(dashboard)/requests/new/test-support";

// RNF-11 (task 5.6): jsdom has no layout, so this is a static guard. It cannot
// prove "no horizontal scroll"; it catches the usual causes of it at 360 px: a
// fixed width above the viewport, a footer action that does not fill the row,
// and a file name that cannot shrink. The real check is the manual harness item
// (apply-progress: 360 px walk of steps 1-4 and both dialogs).

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

import { CauseDatesStep } from "@/app/(dashboard)/requests/new/cause-dates-step";
import { DocumentsStep } from "@/app/(dashboard)/requests/new/documents-step";
import { IntakeStepper } from "@/app/(dashboard)/requests/new/intake-stepper";
import { ReviewStep } from "@/app/(dashboard)/requests/new/review-step";
import { SubjectsStep } from "@/app/(dashboard)/requests/new/subjects-step";

const VIEWPORT = 360;
const REM = 16;
const SPACING_PX = 4;
const LONG_NAME = `${"constancia-medica-".repeat(8)}.pdf`;

const GROUPS = [
  {
    grupoId: 1,
    asignaturaId: 10,
    asignaturaCodigo: "MAT-101",
    asignaturaNombre: "Cálculo diferencial e integral para ingeniería",
    periodo: "2026-2",
    numeroGrupo: "1",
    docenteNombre: "Ana María de los Ángeles Pérez Castellón",
  },
  {
    grupoId: 2,
    asignaturaId: 10,
    asignaturaCodigo: "MAT-101",
    asignaturaNombre: "Cálculo",
    periodo: "2026-2",
    numeroGrupo: "2",
    docenteNombre: null,
  },
];
const DOC = { id: 5, nombreOriginal: LONG_NAME, tamanoBytes: 2048 };

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

function footerActions(): HTMLElement[] {
  const footer = document.querySelector('[data-slot="card-footer"]');
  return [...(footer?.querySelectorAll<HTMLElement>("a, button") ?? [])];
}

function fillsTheRow(element: HTMLElement): boolean {
  return element.classList.contains("w-full");
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

describe.each([
  [
    "cause and dates",
    () => (
      <CauseDatesStep
        initial={{
          causa: "medica",
          fechaInicio: "2026-10-01",
          fechaFin: "2026-10-03",
        }}
      />
    ),
  ],
  [
    "subjects",
    () => (
      <SubjectsStep groups={GROUPS} selected={[]} hasDates degraded={false} />
    ),
  ],
  ["documents", () => <DocumentsStep draftId={4} documents={[DOC]} />],
  [
    "review",
    () => (
      <ReviewStep
        draft={{
          causa: "medica",
          fechaInicio: "2026-10-01",
          fechaFin: "2026-10-03",
        }}
        groups={GROUPS}
        documents={[DOC]}
        degraded={false}
      />
    ),
  ],
] as const)("step %s at 360 px", (_name, step) => {
  it("sets no width above the viewport", () => {
    renderIntl(step());
    expect(tooWide(document.body)).toEqual([]);
  });

  it("gives every navigation action the full row", () => {
    renderIntl(step());
    const actions = footerActions();
    expect(actions.length).toBeGreaterThan(0);
    for (const action of actions) {
      expect(fillsTheRow(action), action.textContent ?? "").toBe(true);
    }
  });
});

describe("long content at 360 px", () => {
  it("truncates a long file name in the documents step", () => {
    renderIntl(<DocumentsStep draftId={4} documents={[DOC]} />);
    expect(screen.getByText(LONG_NAME)).toHaveClass("truncate");
  });

  it("truncates a long file name in the review", () => {
    renderIntl(
      <ReviewStep
        draft={{
          causa: "medica",
          fechaInicio: "2026-10-01",
          fechaFin: "2026-10-03",
        }}
        groups={[]}
        documents={[DOC]}
        degraded={false}
      />,
    );
    expect(screen.getByText(LONG_NAME)).toHaveClass("truncate");
  });

  it("wraps long subject names instead of widening the review", () => {
    renderIntl(
      <ReviewStep
        draft={{
          causa: "medica",
          fechaInicio: "2026-10-01",
          fechaFin: "2026-10-03",
        }}
        groups={GROUPS}
        documents={[]}
        degraded={false}
      />,
    );
    expect(screen.getByText(/Cálculo diferencial/)).toHaveClass("break-words");
  });
});

describe("stepper at 360 px", () => {
  it("shows 'Step n of 4' with a bar and hides the full list on small screens", () => {
    renderIntl(<IntakeStepper current={4} />);
    expect(screen.getByText("Paso 4 de 4").parentElement).toHaveClass(
      "sm:hidden",
    );
    expect(screen.getByRole("list")).toHaveClass("hidden", "sm:flex");
    expect(tooWide(document.body)).toEqual([]);
  });
});

describe("dialogs at 360 px", () => {
  const review = (
    <ReviewStep
      draft={{
        causa: "medica",
        fechaInicio: "2026-10-01",
        fechaFin: "2026-10-03",
      }}
      groups={GROUPS}
      documents={[DOC]}
      degraded={false}
    />
  );

  it.each([
    ["Presentar solicitud", "Sí, presentar"],
    ["Descartar borrador", "Sí, descartar"],
  ])(
    "%s opens within the viewport with reachable actions",
    async (trigger, confirm) => {
      renderIntl(review);
      await userEvent.click(screen.getByRole("button", { name: trigger }));
      const dialog = await screen.findByRole("alertdialog");

      expect(tooWide(document.body)).toEqual([]);
      // The popup is as wide as the viewport minus margins and stacks its buttons.
      expect(dialog).toHaveClass("w-[calc(100%-2rem)]");
      expect(screen.getByRole("button", { name: "Cancelar" })).toBeVisible();
      expect(screen.getByRole("button", { name: confirm })).toBeVisible();
      expect(
        screen.getByRole("button", { name: confirm }).parentElement,
      ).toHaveClass("flex-col-reverse");
    },
  );
});
