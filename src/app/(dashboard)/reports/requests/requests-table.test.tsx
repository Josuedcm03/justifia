import { render, screen, within } from "@testing-library/react";
import axe from "axe-core";
import { describe, expect, it, vi } from "vitest";

import {
  RequestsPagination,
  RequestsTable,
  type RequestsTableRow,
} from "@/app/(dashboard)/reports/requests/requests-table";

vi.mock("next/link", async () =>
  (await import("@/app/(dashboard)/review/test-support")).linkDouble(),
);

// CR-DET-1: one row per request, with the cause here and nowhere else.

const COLUMNS = {
  student: "Student",
  cif: "CIF",
  cause: "Cause",
  state: "State",
  absence: "Absence dates",
  submitted: "Submitted",
  classes: "Classes",
};

function row(
  id: number,
  overrides: Partial<RequestsTableRow> = {},
): RequestsTableRow {
  return {
    id,
    student: `Student ${id}`,
    cif: `2021-00${id}`,
    cause: "Medical",
    state: "Pending review",
    absence: "Mar 2, 2026 to Mar 4, 2026",
    submitted: "Mar 5, 2026",
    classes: ["Calculo I · Marta Ruiz · 2026-S1"],
    ...overrides,
  };
}

function show(rows: RequestsTableRow[]) {
  return render(
    <RequestsTable
      caption="Justification requests"
      columns={COLUMNS}
      rows={rows}
    />,
  );
}

describe("RequestsTable", () => {
  it("names the table and heads the seven columns of CR-DET-1 in order", () => {
    show([row(1)]);

    const table = screen.getByRole("table", { name: "Justification requests" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual([
      "Student",
      "CIF",
      "Cause",
      "State",
      "Absence dates",
      "Submitted",
      "Classes",
    ]);
  });

  it("lets headers and cells wrap so the seven columns fit without side scrolling", () => {
    show([row(1)]);

    const table = screen.getByRole("table", { name: "Justification requests" });
    expect(table.className).toContain("[&_th]:whitespace-normal");
    expect(table.className).toContain("[&_td]:whitespace-normal");
    expect(table.querySelector('[class*="min-w-"]')).toBeNull();
  });

  it("renders one row per request with each value in its column", () => {
    show([
      row(2, { student: "Luis Mora", cause: "Other force majeure" }),
      row(1, { student: "Ana Lopez", state: "Approved" }),
    ]);

    const body = screen.getAllByRole("row").slice(1);
    expect(body).toHaveLength(2);
    expect(
      within(body[0])
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual([
      "Luis Mora",
      "2021-002",
      "Other force majeure",
      "Pending review",
      "Mar 2, 2026 to Mar 4, 2026",
      "Mar 5, 2026",
      "Calculo I · Marta Ruiz · 2026-S1",
    ]);
    expect(within(body[1]).getAllByRole("cell")[0]).toHaveTextContent(
      "Ana Lopez",
    );
    expect(within(body[1]).getAllByRole("cell")[3]).toHaveTextContent(
      "Approved",
    );
  });

  it("holds all the classes of a request in one cell, one line each with teacher and period", () => {
    show([
      row(1, {
        classes: [
          "Calculo I · Marta Ruiz · 2026-S1",
          "Fisica · Luis Mora · 2026-S1",
          "Calculo I · Marta Ruiz · 2026-S2",
        ],
      }),
    ]);

    const [, body] = screen.getAllByRole("row");
    const cell = within(body).getAllByRole("cell")[6];
    const lines = within(cell).getAllByRole("listitem");
    expect(lines.map((line) => line.textContent)).toEqual([
      "Calculo I · Marta Ruiz · 2026-S1",
      "Fisica · Luis Mora · 2026-S1",
      "Calculo I · Marta Ruiz · 2026-S2",
    ]);
    expect(within(body).getAllByRole("cell")).toHaveLength(7);
  });

  it("scrolls inside its own container instead of overflowing the page (360 px)", () => {
    show([row(1)]);

    const table = screen.getByRole("table");
    expect(table.closest('[data-slot="table-container"]')).not.toBeNull();
  });

  it("is axe clean", async () => {
    const { container } = show([row(1), row(2)]);

    const results = await axe.run(container, {
      runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
      rules: { "color-contrast": { enabled: false } },
    });

    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(results.passes.length).toBeGreaterThan(0);
  });
});

describe("RequestsPagination", () => {
  const LABELS = {
    region: "Pagination",
    previous: "Previous",
    next: "Next",
    status: "Page 2 of 3",
  };
  const hrefFor = (page: number) =>
    `/reports/requests?period=2026-S1&causa=medica${page > 1 ? `&page=${page}` : ""}`;

  function paginate(page: number, pages: number) {
    return render(
      <RequestsPagination
        page={page}
        pages={pages}
        labels={LABELS}
        hrefFor={hrefFor}
      />,
    );
  }

  it("links to the previous and next page keeping the resolved filters, never prefetching", () => {
    paginate(2, 3);

    const previous = screen.getByRole("link", { name: "Previous" });
    const next = screen.getByRole("link", { name: "Next" });
    expect(previous).toHaveAttribute(
      "href",
      "/reports/requests?period=2026-S1&causa=medica",
    );
    expect(next).toHaveAttribute(
      "href",
      "/reports/requests?period=2026-S1&causa=medica&page=3",
    );
    expect(previous).toHaveAttribute("data-prefetch", "false");
    expect(next).toHaveAttribute("data-prefetch", "false");
    expect(screen.getByText("Page 2 of 3")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("shows muted text, not a dead link, at the first page", () => {
    paginate(1, 3);

    expect(screen.queryByRole("link", { name: "Previous" })).toBeNull();
    expect(screen.getByText("Previous")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/reports/requests?period=2026-S1&causa=medica&page=2",
    );
  });

  it("shows muted text, not a dead link, at the last page", () => {
    paginate(3, 3);

    expect(screen.queryByRole("link", { name: "Next" })).toBeNull();
    expect(screen.getByText("Next")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute(
      "href",
      "/reports/requests?period=2026-S1&causa=medica&page=2",
    );
  });

  it("is a labelled navigation landmark", () => {
    paginate(2, 3);

    expect(
      screen.getByRole("navigation", { name: "Pagination" }),
    ).toBeInTheDocument();
  });
});
