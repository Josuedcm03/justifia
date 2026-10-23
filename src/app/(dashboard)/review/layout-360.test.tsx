import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { describe, expect, it, vi } from "vitest";

import { messages, renderIntl } from "@/app/(dashboard)/review/test-support";

// RNF-11 for the escalation screens (task 5.19). jsdom has no layout, so this
// is a static guard like the intake one: it catches the usual causes of
// horizontal scroll at 360 px (a fixed width above the viewport, an action
// that does not fill the row, an unbreakable note) and runs axe on the tab
// bodies, the sections and both open dialogs. The real check is the owner walk
// at 360 px (tasks 15.4). Contrast cannot be computed without layout.

vi.mock("@/app/(dashboard)/review/[id]/escalation-actions", () => ({
  escalateRequestAction: vi.fn(),
  recordExcessReportAction: vi.fn(),
}));

import { AbsenceReportsSection } from "@/app/(dashboard)/review/[id]/absence-reports-section";
import { EscalateDialog } from "@/app/(dashboard)/review/[id]/escalate-dialog";
import { EscalationSection } from "@/app/(dashboard)/review/[id]/escalation-section";
import { ApprovedTab } from "@/app/(dashboard)/review/approved-tab";
import { CoordinationTab } from "@/app/(dashboard)/review/coordination-tab";
import { ReviewTabs } from "@/app/(dashboard)/review/review-tabs";

const VIEWPORT = 360;
const REM = 16;
const SPACING_PX = 4;
const LONG_NOTE = "nota-sin-espacios-".repeat(20);

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

const COORDINATION_ROW = {
  id: 21,
  estudianteNombre: "Luis Mora Castellón de los Ángeles",
  estudianteCif: "2022-0100",
  estudianteCarrera: "Ingeniería Civil e Hidráulica",
  asignaturas: 2,
  motivo: "sospecha_documento",
  escaladaEn: new Date("2026-10-13T15:00:00Z"),
  notificacionEstado: "bloqueada",
  notificacionMotivo: "sin_destinatarios",
  enviadaEn: null,
} as const;

const APPROVED_ROW = {
  id: 31,
  estudianteNombre: "Rosa Mena",
  estudianteCif: "2020-0007",
  estudianteCarrera: "Arquitectura",
  aprobadaEn: new Date("2026-10-12T15:00:00Z"),
  reportes: 2,
} as const;

const ESCALATION = {
  id: 61,
  motivo: "sospecha_documento",
  nota: LONG_NOTE,
  autorNombre: "Rosa Lopez",
  creadoEn: new Date("2026-10-08T15:00:00Z"),
  respuesta: LONG_NOTE,
  respondidaPorNombre: "Marta Gomez",
  respondidaEn: new Date("2026-10-09T21:00:00Z"),
  notificacionEstado: "enviada",
  notificacionMotivo: null,
  enviadaEn: new Date("2026-10-08T15:05:00Z"),
} as const;

const REPORT = {
  id: 71,
  docenteNombre: "Luis Mora",
  comunicadoEl: "2026-10-09",
  nota: LONG_NOTE,
  registradoPorNombre: "Rosa Lopez",
  registradoEn: new Date("2026-10-10T16:00:00Z"),
  notificacionEstado: "pendiente",
  notificacionMotivo: "error_envio",
  enviadaEn: null,
} as const;

const TEACHERS = [{ remisionId: 31, nombre: "Luis Mora" }];

describe.each([
  ["the state tabs", () => <ReviewTabs current="en_revision_coordinacion" />],
  [
    "the En coordinacion tab",
    () => <CoordinationTab rows={[COORDINATION_ROW]} />,
  ],
  ["the Aprobadas tab", () => <ApprovedTab rows={[APPROVED_ROW]} />],
  [
    "the escalation section",
    () => <EscalationSection escalations={[ESCALATION]} />,
  ],
  [
    "the absence reports section",
    () => (
      <AbsenceReportsSection
        solicitudId={12}
        reports={[REPORT]}
        canReport
        teachers={TEACHERS}
        maxDate="2026-10-14"
      />
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

describe("tabs and queues at 360 px", () => {
  it("stacks the tab links in a column and gives each the full row, side by side from sm", () => {
    renderIntl(<ReviewTabs current="pendiente" />);

    const nav = screen.getByRole("navigation", {
      name: messages.en.review.queue.tabs.label,
    });
    expect(nav).toHaveClass("flex-col", "sm:flex-row");
    for (const link of within(nav).getAllByRole("link")) {
      expect(link).toHaveClass("w-full", "sm:w-auto", "h-11");
    }
  });

  it("stacks the En coordinacion cards below md and shows the table from md", () => {
    renderIntl(<CoordinationTab rows={[COORDINATION_ROW]} />);

    const caption = messages.en.review.queue.coordination.caption;
    expect(screen.getByRole("list", { name: caption })).toHaveClass(
      "md:hidden",
    );
    expect(screen.getByRole("table").closest(".hidden")).toHaveClass(
      "hidden",
      "md:block",
    );
    const card = within(
      screen.getByRole("list", { name: caption }),
    ).getAllByRole("listitem")[0];
    expect(
      within(card).getByText("Luis Mora Castellón de los Ángeles"),
    ).toHaveClass("break-words");
  });

  it("stacks the Aprobadas cards below md and shows the table from md", () => {
    renderIntl(<ApprovedTab rows={[APPROVED_ROW]} />);

    expect(
      screen.getByRole("list", {
        name: messages.en.review.queue.approved.caption,
      }),
    ).toHaveClass("md:hidden");
  });

  it("gives the card review link the full row below sm", () => {
    renderIntl(<ApprovedTab rows={[APPROVED_ROW]} />);

    const card = within(
      screen.getByRole("list", {
        name: messages.en.review.queue.approved.caption,
      }),
    ).getAllByRole("listitem")[0];
    expect(within(card).getByRole("link")).toHaveClass("w-full", "sm:w-auto");
  });
});

describe("long notes at 360 px", () => {
  it("wraps the escalation note and the answer instead of widening the page", () => {
    renderIntl(<EscalationSection escalations={[ESCALATION]} />);

    for (const text of screen.getAllByText(LONG_NOTE)) {
      expect(text).toHaveClass("break-words", "whitespace-pre-wrap");
    }
  });

  it("wraps the report note and stacks the facts on one column", () => {
    renderIntl(
      <AbsenceReportsSection
        solicitudId={12}
        reports={[REPORT]}
        canReport={false}
        teachers={[]}
        maxDate="2026-10-14"
      />,
    );

    expect(screen.getByText(LONG_NOTE)).toHaveClass(
      "break-words",
      "whitespace-pre-wrap",
    );
  });
});

describe("dialogs at 360 px", () => {
  it.each([
    [
      "escalate",
      messages.en.review.escalation.dialog,
      () => <EscalateDialog solicitudId={12} unavailableCareer={null} />,
    ],
    [
      "report",
      messages.en.review.report.dialog,
      () => (
        <AbsenceReportsSection
          solicitudId={12}
          reports={[]}
          canReport
          teachers={TEACHERS}
          maxDate="2026-10-14"
        />
      ),
    ],
  ] as const)(
    "opens the %s dialog inside the viewport, with stacked reachable actions and no axe violation",
    async (_name, t, view) => {
      renderIntl(view());
      await userEvent.click(screen.getByRole("button", { name: t.trigger }));
      const dialog = await screen.findByRole("alertdialog");

      expect(tooWide(document.body)).toEqual([]);
      expect(dialog).toHaveClass("w-[calc(100%-2rem)]");
      expect(screen.getByRole("button", { name: t.cancel })).toBeVisible();
      expect(
        screen.getByRole("button", { name: t.confirm }).parentElement,
      ).toHaveClass("flex-col-reverse");
      expect(await violations(dialog)).toEqual([]);
    },
  );

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
