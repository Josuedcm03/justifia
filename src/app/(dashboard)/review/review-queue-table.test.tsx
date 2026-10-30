import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  ApprovedQueueTable,
  type ApprovedQueueTableRow,
} from "@/app/(dashboard)/review/approved-queue-table";
import {
  ReviewQueueTable,
  type ReviewQueueTableRow,
} from "@/app/(dashboard)/review/review-queue-table";
import { messages, renderWithIntl, type TestLocale } from "@/test/intl";

vi.mock("next/link", async () =>
  (await import("@/app/(dashboard)/review/test-support")).linkDouble(),
);

// The page computes every display string on the server and delivers only plain
// rows; this module builds the columns inside the client (design decision 5).

const ROW: ReviewQueueTableRow = {
  id: 12,
  receivedText: "Oct 8, 2026",
  resubmittedNote: null,
  name: "Ana Lopez",
  cif: "2021-0042",
  career: "Ingenieria de Sistemas",
  subjectsText: "3 subjects",
  deadlineStatus: "por_vencer",
  deadlineLabel: "Due soon",
  dueOnText: "Due Oct 12, 2026",
  reviewLabel: "Review",
  reviewAriaLabel: "Review request from Ana Lopez",
};

function show(rows: ReviewQueueTableRow[], locale: TestLocale = "en") {
  return renderWithIntl(
    <ReviewQueueTable
      rows={rows}
      caption={messages[locale].review.queue.caption}
    />,
    locale,
  );
}

describe("ReviewQueueTable (bounded kit, RF-06)", () => {
  it.each(["es", "en"] as const)(
    "writes the six headers in order in %s, as plain column headers",
    (locale) => {
      show([ROW], locale);
      const c = messages[locale].review.queue.columns;

      const headers = screen.getAllByRole("columnheader");
      expect(headers.map((h) => h.textContent)).toEqual([
        c.received,
        c.student,
        c.career,
        c.subjects,
        c.deadline,
        c.action,
      ]);
      for (const header of headers) {
        expect(header).toHaveAttribute("scope", "col");
        expect(header).not.toHaveAttribute("aria-sort");
      }
      expect(
        within(screen.getByRole("table")).queryByRole("button"),
      ).toBeNull();
    },
  );

  it("names the table with the caption, without a sortable hint", () => {
    show([ROW]);

    const table = screen.getByRole("table", {
      name: messages.en.review.queue.caption,
    });
    expect(table.querySelector("caption")).toHaveClass("sr-only");
    expect(table.querySelector("caption")).toHaveTextContent(
      messages.en.review.queue.caption,
    );
  });

  it("renders the cell content of every column", () => {
    show([{ ...ROW, resubmittedNote: "Resubmitted" }]);

    const row = screen.getAllByRole("row")[1];
    const cells = within(row).getAllByRole("cell");
    expect(cells).toHaveLength(6);
    expect(cells[0]).toHaveTextContent("Oct 8, 2026");
    expect(cells[0]).toHaveTextContent("Resubmitted");
    expect(cells[0]).toHaveClass("tabular-nums");
    expect(within(cells[1]).getByText("Ana Lopez")).toHaveClass("break-words");
    expect(within(cells[1]).getByText("2021-0042")).toHaveClass(
      "text-muted-foreground",
    );
    expect(cells[2]).toHaveTextContent("Ingenieria de Sistemas");
    expect(cells[2]).toHaveClass("text-muted-foreground");
    expect(cells[3]).toHaveTextContent("3 subjects");
    expect(within(cells[4]).getByText("Due soon")).toHaveClass(
      "rounded-full",
      "bg-warning/10",
    );
    expect(cells[4]).toHaveTextContent("Due Oct 12, 2026");
  });

  it("omits the CIF and the resubmitted note when absent", () => {
    show([{ ...ROW, cif: null }]);

    const row = screen.getAllByRole("row")[1];
    expect(row).not.toHaveTextContent("2021-0042");
    expect(row).not.toHaveTextContent("Resubmitted");
  });

  it("links to the request with prefetch off and the named label, end-aligned", () => {
    show([ROW]);

    const link = screen.getByRole("link", {
      name: "Review request from Ana Lopez",
    });
    expect(link).toHaveAttribute("href", "/review/12");
    expect(link).toHaveAttribute("data-prefetch", "false");
    expect(link).toHaveTextContent("Review");
    expect(link.closest("td")).toHaveClass("text-right");
    expect(screen.getAllByRole("columnheader")[5]).toHaveClass("text-right");
  });

  it("keeps the order of the delivered rows", () => {
    show([
      { ...ROW, id: 9, name: "Zoe" },
      { ...ROW, id: 3, name: "Abel" },
    ]);

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Zoe");
    expect(rows[1]).toHaveTextContent("Abel");
  });

  it("delivers only the fields it shows (RNF-06)", () => {
    expect(Object.keys(ROW).sort()).toEqual(
      [
        "id",
        "receivedText",
        "resubmittedNote",
        "name",
        "cif",
        "career",
        "subjectsText",
        "deadlineStatus",
        "deadlineLabel",
        "dueOnText",
        "reviewLabel",
        "reviewAriaLabel",
      ].sort(),
    );
    expect(JSON.stringify(ROW)).not.toMatch(/causa|motivo|clockStart/i);
  });

  it("renders nothing for zero rows", () => {
    const { container } = show([]);

    expect(container).toBeEmptyDOMElement();
  });
});

// The three tabs share the student, career and actions columns, so the fit that
// the En coordinacion walk asked for holds in each of them.
describe("the shared columns of the three queue tables fit the desktop", () => {
  const APPROVED_ROW: ApprovedQueueTableRow = {
    id: 31,
    approvedText: "Oct 9, 2026",
    name: "Ana Lopez",
    cif: "2021-0042",
    career: "Ingenieria en Sistemas de Informacion",
    reportsText: "2 reports",
    reviewLabel: "Review",
    reviewAriaLabel: "Review request from Ana Lopez",
  };
  const NOWRAP = "whitespace-nowrap";

  it("lets the career wrap, and keeps the actions narrow, in Pendientes", () => {
    show([ROW]);

    const cells = screen.getAllByRole("cell");
    expect(cells[2]).toHaveClass("whitespace-normal");
    expect(cells[2]).not.toHaveClass(NOWRAP);
    expect(cells[5]).toHaveClass("w-36");
    expect(
      screen.getByRole("columnheader", {
        name: messages.en.review.queue.columns.action,
      }),
    ).toHaveClass("w-36");
  });

  it("lets the career wrap, and keeps the actions narrow, in Aprobadas", () => {
    renderWithIntl(
      <ApprovedQueueTable rows={[APPROVED_ROW]} caption="Approved" />,
      "en",
    );

    const cells = screen.getAllByRole("cell");
    expect(cells[2]).toHaveClass("whitespace-normal");
    expect(cells[2]).not.toHaveClass(NOWRAP);
    expect(cells[4]).toHaveClass("w-36");
  });
});
