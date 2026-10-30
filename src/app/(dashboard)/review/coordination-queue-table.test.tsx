import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  CoordinationQueueTable,
  type CoordinationQueueTableRow,
} from "@/app/(dashboard)/review/coordination-queue-table";
import { messages, renderWithIntl, type TestLocale } from "@/test/intl";

vi.mock("next/link", async () =>
  (await import("@/app/(dashboard)/review/test-support")).linkDouble(),
);

// The En coordinacion table in bounded mode. The owner's walk found it wider
// than a desktop: seven columns, each cell on one line, the actions column
// clipped behind a horizontal scrollbar. It now holds five columns, lets the
// long cells wrap and gives the actions column a narrow fixed width. jsdom has
// no layout, so the pins are on the classes that decide it, as the other
// design-system pins of the review screens are.

const ROW: CoordinationQueueTableRow = {
  id: 21,
  escalatedText: "Oct 13, 2026",
  name: "Luis Mora Castellón de los Ángeles",
  cif: "2022-0100",
  career: "Ingeniería en Sistemas de Información",
  reasonText: "Caso especial",
  pausedLabel: "Deadline paused",
  noticeText: "Pending send: the last attempt failed",
  reviewLabel: "Review",
  reviewAriaLabel: "Review request from Luis Mora",
};

function show(rows = [ROW], locale: TestLocale = "en") {
  return renderWithIntl(
    <CoordinationQueueTable rows={rows} caption="Requests in coordination" />,
    locale,
  );
}

const en = messages.en.review.queue;

describe("CoordinationQueueTable columns", () => {
  it("has five columns: escalation, student, reason, notice and actions", () => {
    show();

    expect(
      screen.getAllByRole("columnheader").map((header) => header.textContent),
    ).toEqual([
      en.coordination.columns.escalated,
      en.columns.student,
      en.coordination.columns.reason,
      en.coordination.columns.notice,
      en.columns.action,
    ]);
  });

  it("shows the date with the paused deadline under it, in one cell", () => {
    show();

    const cell = screen.getAllByRole("cell")[0];
    expect(cell).toHaveTextContent("Oct 13, 2026");
    expect(within(cell).getByText("Deadline paused")).toHaveClass(
      "rounded-full",
      "bg-muted",
    );
    expect(cell).toHaveClass("tabular-nums");
  });

  it("shows the career under the student name and CIF, in one cell", () => {
    show();

    const cell = screen.getAllByRole("cell")[1];
    expect(within(cell).getByText(ROW.name)).toBeInTheDocument();
    expect(within(cell).getByText("2022-0100")).toBeInTheDocument();
    expect(
      within(cell).getByText("Ingeniería en Sistemas de Información"),
    ).toHaveClass("text-muted-foreground");
  });

  it("shows the reason label of a special case and of a suspicion", () => {
    show([
      ROW,
      {
        ...ROW,
        id: 22,
        reasonText: messages.en.review.escalation.reasons.sospecha_documento,
      },
    ]);

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Caso especial");
    expect(rows[1]).toHaveTextContent("Suspicion about a document");
  });

  it("words the headers in Spanish", () => {
    show([ROW], "es");

    expect(
      screen.getAllByRole("columnheader").map((header) => header.textContent),
    ).toEqual([
      "Escalada",
      "Estudiante",
      "Motivo",
      "Aviso a coordinación",
      "Acciones",
    ]);
  });
});

describe("CoordinationQueueTable fits the desktop without a horizontal scroll", () => {
  const NOWRAP = "whitespace-nowrap";

  it("lets the long cells wrap: the student, the reason and the notice are not on one line", () => {
    show();

    const cells = screen.getAllByRole("cell");
    // escalation, student, reason, notice, action
    for (const index of [1, 2, 3]) {
      expect(cells[index], `cell ${index}`).toHaveClass("whitespace-normal");
      expect(cells[index], `cell ${index}`).not.toHaveClass(NOWRAP);
    }
  });

  it("lets the long notice header wrap too", () => {
    show();

    const header = screen.getByRole("columnheader", {
      name: en.coordination.columns.notice,
    });
    expect(header).toHaveClass("whitespace-normal");
    expect(header).not.toHaveClass(NOWRAP);
  });

  it("keeps the date and the actions on one line", () => {
    show();

    const cells = screen.getAllByRole("cell");
    expect(cells[0]).toHaveClass(NOWRAP);
    expect(cells[4]).toHaveClass(NOWRAP);
  });

  it("gives the actions column a narrow fixed width and the link its own size", () => {
    show();

    const header = screen.getByRole("columnheader", {
      name: en.columns.action,
    });
    const cell = screen.getAllByRole("cell")[4];
    expect(header).toHaveClass("w-36");
    expect(cell).toHaveClass("w-36");
    expect(within(cell).getByRole("link")).toHaveClass("w-full", "sm:w-auto");
  });

  it("links the row to its detail without prefetch", () => {
    show();

    const link = screen.getByRole("link", { name: ROW.reviewAriaLabel });
    expect(link).toHaveAttribute("href", "/review/21");
    expect(link).toHaveAttribute("data-prefetch", "false");
  });
});
