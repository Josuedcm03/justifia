import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { describe, expect, it, vi } from "vitest";

import { messages, renderIntl } from "@/app/(dashboard)/review/test-support";

// RNF-11 for the coordinator screens (task 10.11). jsdom has no layout, so this
// is a static guard like the review one: it catches the usual causes of
// horizontal scroll at 360 px (a fixed width above the viewport, an action that
// does not fill the row, an unbreakable note) and runs axe on the list, the
// detail cards and the open answer dialog. The real check is the owner walk at
// 360 px. Contrast cannot be computed without layout.

vi.mock("@/app/(dashboard)/coordination/[id]/actions", () => ({
  answerEscalationAction: vi.fn(),
}));

import { AnswerForm } from "@/app/(dashboard)/coordination/[id]/answer-form";
import {
  CoordinationEscalationSection,
  CoordinationNoticeSection,
  CoordinationRequestSection,
  CoordinationStudentSection,
} from "@/app/(dashboard)/coordination/[id]/coordination-sections";
import { CoordinationList } from "@/app/(dashboard)/coordination/coordination-list";
import type {
  NoticeDetail,
  OpenEscalationDetail,
} from "@/lib/data/coordination-queue";

const VIEWPORT = 360;
const REM = 16;
const SPACING_PX = 4;
const LONG_NOTE = "nota-sin-espacios-".repeat(20);
const LONG_NAME = "Luis Mora Castellón de los Ángeles y Fernández";

function fixedWidth(token: string): number | null {
  const arbitrary = /^(?:min-)?w-\[(\d+(?:\.\d+)?)(px|rem)\]$/.exec(token);
  if (arbitrary) {
    const value = Number(arbitrary[1]);
    return arbitrary[2] === "rem" ? value * REM : value;
  }
  const scale = /^(?:min-)?w-(\d+)$/.exec(token);
  return scale ? Number(scale[1]) * SPACING_PX : null;
}

function tooWide(root: ParentNode): string[] {
  return [...root.querySelectorAll("[class]")].flatMap((element) =>
    element.className
      .toString()
      .split(/\s+/)
      .filter((token) => (fixedWidth(token) ?? 0) > VIEWPORT),
  );
}

async function violations(root: HTMLElement) {
  const results = await axe.run(root, {
    runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
    rules: { "color-contrast": { enabled: false } },
  });
  expect(results.passes.length).toBeGreaterThan(0);
  return results.violations.map((v) => `${v.id}: ${v.help}`);
}

const OPEN = {
  id: 9,
  estudianteNombre: LONG_NAME,
  estudianteCif: "2022-0100",
  motivo: "sospecha_documento",
  creadoEn: new Date("2026-10-13T15:00:00Z"),
} as const;

const NOTICE = {
  id: 12,
  estudianteNombre: LONG_NAME,
  estudianteCif: "2022-0101",
  docenteNombre: LONG_NAME,
  comunicadoEl: "2026-10-12",
  creadoEn: new Date("2026-10-13T15:00:00Z"),
} as const;

const ESCALATION: OpenEscalationDetail = {
  kind: "escalation",
  id: 9,
  solicitudId: 41,
  estado: "en_revision_coordinacion",
  motivo: "sospecha_documento",
  nota: LONG_NOTE,
  creadoEn: new Date("2026-10-13T15:00:00Z"),
  estudiante: { nombre: LONG_NAME, cif: "2022-0100", carrera: "Arquitectura" },
  causa: "medica",
  fechaInicio: "2026-10-05",
  fechaFin: "2026-10-07",
  clases: [],
  documentos: [],
};

const NOTICE_DETAIL: NoticeDetail = {
  kind: "notice",
  id: 12,
  solicitudId: 41,
  estado: "aprobada",
  creadoEn: new Date("2026-10-13T15:00:00Z"),
  estudiante: ESCALATION.estudiante,
  docenteNombre: LONG_NAME,
  comunicadoEl: "2026-10-12",
  nota: LONG_NOTE,
};

describe.each([
  ["the list", () => <CoordinationList open={[OPEN]} notices={[NOTICE]} />],
  ["the empty list", () => <CoordinationList open={[]} notices={[]} />],
  [
    "the escalation cards",
    () => (
      <>
        <CoordinationStudentSection student={ESCALATION.estudiante} />
        <CoordinationRequestSection detail={ESCALATION} />
        <CoordinationEscalationSection detail={ESCALATION} />
      </>
    ),
  ],
  [
    "the notice cards",
    () => (
      <>
        <CoordinationStudentSection student={NOTICE_DETAIL.estudiante} />
        <CoordinationNoticeSection detail={NOTICE_DETAIL} />
      </>
    ),
  ],
] as const)("%s at 360 px", (_name, view) => {
  it("sets no width above the viewport", () => {
    renderIntl(view());

    expect(tooWide(document.body)).toEqual([]);
  });

  it("has no accessibility violation (spanish)", async () => {
    const { container } = renderIntl(view(), "es");

    expect(await violations(container)).toEqual([]);
  });

  it("has no accessibility violation (english)", async () => {
    const { container } = renderIntl(view(), "en");

    expect(await violations(container)).toEqual([]);
  });
});

describe("the list at 360 px", () => {
  it("stacks the cards in one column and lets a long name wrap", () => {
    renderIntl(<CoordinationList open={[OPEN]} notices={[NOTICE]} />);

    const list = screen.getByRole("list", {
      name: messages.en.coordination.list.open.caption,
    });
    expect(list).toHaveClass("flex-col");
    const card = within(list).getAllByRole("listitem")[0];
    expect(within(card).getByText(LONG_NAME)).toHaveClass("break-words");
  });

  it("gives the card link the full row below sm", () => {
    renderIntl(<CoordinationList open={[OPEN]} notices={[]} />);

    expect(screen.getByRole("link")).toHaveClass("w-full", "sm:w-auto");
  });
});

describe("long notes at 360 px", () => {
  it("wraps the secretary note and the notice note instead of widening the page", () => {
    renderIntl(
      <>
        <CoordinationEscalationSection detail={ESCALATION} />
        <CoordinationNoticeSection detail={NOTICE_DETAIL} />
      </>,
    );

    const notes = screen.getAllByText(LONG_NOTE);
    expect(notes).toHaveLength(2);
    for (const text of notes) {
      expect(text).toHaveClass("whitespace-pre-wrap");
      expect(text.parentElement).toHaveClass("break-words");
    }
  });
});

describe("the answer dialog at 360 px", () => {
  const t = messages.en.coordination.answer.dialog;

  it("opens inside the viewport, with stacked reachable actions and no axe violation", async () => {
    renderIntl(<AnswerForm escalamientoId={9} />);
    await userEvent.click(screen.getByRole("button", { name: t.trigger }));
    const dialog = await screen.findByRole("alertdialog");

    expect(tooWide(document.body)).toEqual([]);
    expect(dialog).toHaveClass("w-[calc(100%-2rem)]");
    expect(screen.getByRole("button", { name: t.cancel })).toBeVisible();
    expect(
      screen.getByRole("button", { name: t.confirm }).parentElement,
    ).toHaveClass("flex-col-reverse");
    expect(await violations(dialog)).toEqual([]);
  });

  it("flags a fixed width above the viewport (guard self-test)", () => {
    const { container } = render(
      <div>
        <div className="w-[400px]" />
        <div className="w-[320px] w-full sm:w-auto" />
      </div>,
    );

    expect(tooWide(container)).toEqual(["w-[400px]"]);
  });
});
