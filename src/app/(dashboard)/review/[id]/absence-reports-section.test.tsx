import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { messages, renderIntl } from "@/app/(dashboard)/review/test-support";

vi.mock("@/app/(dashboard)/review/[id]/escalation-actions", () => ({
  escalateRequestAction: vi.fn(),
  recordExcessReportAction: vi.fn(),
  resendEscalationNoticeAction: vi.fn(),
}));

import { AbsenceReportsSection } from "@/app/(dashboard)/review/[id]/absence-reports-section";
import type { DetailReport } from "@/lib/data/solicitud-detail";

const en = messages.en.review.report;
const TEACHERS = [
  { remisionId: 31, nombre: "Luis Mora" },
  { remisionId: 32, nombre: "Pedro Ruiz" },
];

function report(overrides: Partial<DetailReport> = {}): DetailReport {
  return {
    id: 71,
    escalamientoId: 81,
    docenteNombre: "Luis Mora",
    comunicadoEl: "2026-10-09",
    nota: "Supera el limite de faltas.",
    registradoPorNombre: "Rosa Lopez",
    // 10:00 on 10 October 2026 in America/Managua.
    registradoEn: new Date("2026-10-10T16:00:00Z"),
    notificacionEstado: "pendiente",
    notificacionMotivo: null,
    enviadaEn: null,
    ...overrides,
  };
}

function show(
  props: Partial<Parameters<typeof AbsenceReportsSection>[0]> = {},
  locale: "en" | "es" = "en",
) {
  return renderIntl(
    <AbsenceReportsSection
      solicitudId={12}
      reports={[report()]}
      canReport
      teachers={TEACHERS}
      maxDate="2026-10-14"
      {...props}
    />,
    locale,
  );
}

describe("AbsenceReportsSection list (RF-15, RF-10 b)", () => {
  it("lists each report with teacher, communicated date, note, author and time", () => {
    show();

    const region = screen.getByRole("region", { name: en.section.title });
    expect(region).toHaveTextContent("Luis Mora");
    expect(region).toHaveTextContent(
      "Communicated by the teacher on Oct 9, 2026",
    );
    expect(region).toHaveTextContent("Supera el limite de faltas.");
    expect(region).toHaveTextContent("Recorded by Rosa Lopez, Oct 10, 2026");
  });

  it("lists several reports for one teacher as separate entries, in the order given", () => {
    show({
      reports: [
        report({ id: 71, nota: "Primero" }),
        report({ id: 72, nota: "Segundo" }),
      ],
    });

    const items = within(
      screen.getByRole("list", { name: en.section.title }),
    ).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Primero");
    expect(items[1]).toHaveTextContent("Segundo");
  });

  it("omits the note line for a report without a note", () => {
    show({ reports: [report({ nota: null })] });

    expect(screen.queryByText(en.entry.note)).toBeNull();
  });

  it.each([
    [
      "pendiente",
      null,
      null,
      messages.en.review.escalation.notification.pendiente,
    ],
    [
      "pendiente",
      "error_envio",
      null,
      messages.en.review.escalation.notification.pendienteFallido,
    ],
    ["enviada", null, new Date("2026-10-10T16:01:00Z"), "Sent on Oct 10, 2026"],
    [
      "bloqueada",
      "sin_destinatarios",
      null,
      messages.en.review.escalation.notification.bloqueada,
    ],
  ] as const)(
    "shows the notice %s (%s) as text",
    (notificacionEstado, notificacionMotivo, enviadaEn, text) => {
      show({
        reports: [
          report({ notificacionEstado, notificacionMotivo, enviadaEn }),
        ],
      });

      expect(
        within(
          screen.getByRole("region", { name: en.section.title }),
        ).getByText(text),
      ).toBeInTheDocument();
    },
  );

  it("shows no percentage or absence count of any kind", () => {
    show();

    expect(
      screen.getByRole("region", { name: en.section.title }).textContent,
    ).not.toMatch(/%|percent|porcentaje/i);
  });

  it("wraps a long note instead of widening the page at 360px", () => {
    const note = "n".repeat(300);
    show({ reports: [report({ nota: note })] });

    expect(screen.getByText(note)).toHaveClass(
      "break-words",
      "whitespace-pre-wrap",
    );
  });
});

describe("AbsenceReportsSection notice resend (RF-10 b)", () => {
  const resendName = (teacher: string, date: string) =>
    `${messages.en.review.escalation.resend.actionNamed.replace("{name}", `${teacher}, ${date}`)}`;

  it.each([
    ["pendiente", null, null],
    ["pendiente", "error_envio", null],
    ["bloqueada", "sin_destinatarios", null],
  ] as const)(
    "offers a resend named after the report for a %s (%s) notice",
    (notificacionEstado, notificacionMotivo, enviadaEn) => {
      show({
        canReport: false,
        reports: [
          report({ notificacionEstado, notificacionMotivo, enviadaEn }),
        ],
      });

      expect(
        screen.getByRole("button", {
          name: resendName("Luis Mora", "Oct 9, 2026"),
        }),
      ).toHaveTextContent(messages.en.review.escalation.resend.action);
    },
  );

  it("offers no resend for a sent notice", () => {
    show({
      canReport: false,
      reports: [
        report({
          notificacionEstado: "enviada",
          enviadaEn: new Date("2026-10-10T16:01:00Z"),
        }),
      ],
    });

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("offers one resend per unsent notice, each named after its own report", () => {
    show({
      canReport: false,
      reports: [
        report({ id: 71, escalamientoId: 81 }),
        report({
          id: 72,
          escalamientoId: 82,
          docenteNombre: "Pedro Ruiz",
          comunicadoEl: "2026-10-12",
        }),
        report({
          id: 73,
          escalamientoId: 83,
          notificacionEstado: "enviada",
          enviadaEn: new Date("2026-10-10T16:01:00Z"),
        }),
      ],
    });

    expect(
      screen.getAllByRole("button").map((b) => b.getAttribute("aria-label")),
    ).toEqual([
      resendName("Luis Mora", "Oct 9, 2026"),
      resendName("Pedro Ruiz", "Oct 12, 2026"),
    ]);
  });
});

describe("AbsenceReportsSection action (RF-15)", () => {
  it("offers the report action while the request is approved", () => {
    show();

    expect(
      screen.getByRole("button", { name: en.dialog.trigger }),
    ).toBeInTheDocument();
  });

  it("says nothing was recorded yet when there is no report", () => {
    show({ reports: [] });

    expect(screen.getByText(en.section.empty)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: en.dialog.trigger }),
    ).toBeInTheDocument();
  });

  it("offers no report action when the request is not approved, but still lists old reports", () => {
    show({ canReport: false });

    expect(
      screen.queryByRole("button", { name: en.dialog.trigger }),
    ).toBeNull();
    expect(screen.getByText("Supera el limite de faltas.")).toBeInTheDocument();
  });

  it("renders nothing when it cannot report and there is nothing to list", () => {
    const { container } = show({ canReport: false, reports: [] });

    expect(container).toBeEmptyDOMElement();
  });

  it("renders in Spanish", () => {
    show({}, "es");

    expect(
      screen.getByRole("region", {
        name: messages.es.review.report.section.title,
      }),
    ).toBeInTheDocument();
  });
});
