import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ColumnDef } from "@tanstack/react-table";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { DataTable } from "@/components/tables/data-table";
import { messages, renderWithIntl } from "@/test/intl";

type Person = { id: number; name: string; login: string; status: string };

const ROWS: Person[] = [
  { id: 3, name: "Zoe", login: "zoe", status: "Active" },
  { id: 1, name: "Ana", login: "ana", status: "Inactive" },
  { id: 2, name: "Beatriz", login: "bea", status: "Active" },
];

const COLUMNS: ColumnDef<Person>[] = [
  {
    id: "name",
    header: "Name",
    enableSorting: true,
    cell: ({ row }) => row.original.name,
  },
  {
    id: "login",
    header: "Login",
    enableSorting: true,
    meta: { className: "font-mono" },
    cell: ({ row }) => row.original.login,
  },
  {
    id: "status",
    header: "Status",
    enableSorting: true,
    meta: { align: "end" },
    cell: ({ row }) => row.original.status,
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => <a href={`/people/${row.original.id}`}>Edit</a>,
  },
];

type Props = ComponentProps<typeof DataTable<Person>>;

function renderTable(overrides: Partial<Props> = {}) {
  const onSort = vi.fn();
  const props: Props = {
    columns: COLUMNS,
    rows: ROWS,
    getRowId: (row) => `p-${row.id}`,
    caption: "People list",
    sorting: { sort: { key: "name", dir: "asc" }, onSort },
    ...overrides,
  };
  const view = renderWithIntl(<DataTable<Person> {...props} />, "en");
  return { ...view, onSort, props };
}

const header = (name: string) =>
  screen.getByRole("columnheader", { name: new RegExp(`^${name}`) });

describe("DataTable server-driven mode (DT-MODE-1, DT-SORT-1)", () => {
  it("calls onSort with the column id when a sortable header is activated", async () => {
    const { onSort } = renderTable();

    await userEvent.click(screen.getByRole("button", { name: "Login" }));

    expect(onSort).toHaveBeenCalledExactlyOnceWith("login");
  });

  it("reports the id of whichever column was activated", async () => {
    const { onSort } = renderTable();

    await userEvent.click(screen.getByRole("button", { name: "Status" }));

    expect(onSort).toHaveBeenCalledExactlyOnceWith("status");
  });

  it("never sorts, pages or filters the rows itself", () => {
    // Rows arrive in server order (Zoe, Ana, Beatriz): not alphabetical, not
    // by login, and more than one page of ten would not change that.
    renderTable({
      sorting: { sort: { key: "name", dir: "asc" }, onSort: vi.fn() },
    });

    const names = screen
      .getAllByRole("row")
      .slice(1)
      .map((row) => within(row).getAllByRole("cell")[0].textContent);

    expect(names).toEqual(["Zoe", "Ana", "Beatriz"]);
  });

  it("renders every delivered row even beyond one default page of ten", () => {
    const many = Array.from({ length: 25 }, (_, i) => ({
      id: i + 1,
      name: `Person ${i + 1}`,
      login: `p${i + 1}`,
      status: "Active",
    }));

    renderTable({ rows: many });

    expect(screen.getAllByRole("row")).toHaveLength(26);
  });

  it.each([
    [{ key: "name", dir: "asc" }, "Name", "ascending"],
    [{ key: "login", dir: "desc" }, "Login", "descending"],
    [{ key: "status", dir: "asc" }, "Status", "ascending"],
  ] as const)(
    "marks only the sorted column with aria-sort (%j)",
    (sort, column, value) => {
      renderTable({ sorting: { sort, onSort: vi.fn() } });

      const sorted = screen
        .getAllByRole("columnheader")
        .filter((th) => th.hasAttribute("aria-sort"));

      expect(sorted).toHaveLength(1);
      expect(sorted[0]).toBe(header(column));
      expect(sorted[0]).toHaveAttribute("aria-sort", value);
    },
  );

  it("renders no visible sort state text in any header: only icons", () => {
    renderTable({
      sorting: { sort: { key: "login", dir: "desc" }, onSort: vi.fn() },
    });

    expect(header("Name").textContent).toBe("Name");
    expect(header("Login").textContent).toBe("Login");
    expect(header("Status").textContent).toBe("Status");
    expect(header("Actions").textContent).toBe("Actions");
    // The accessible names are still exactly the column labels.
    expect(screen.getByRole("button", { name: "Login" })).toBeInTheDocument();
  });

  it("gives non-sortable columns no button and no aria-sort", () => {
    renderTable();

    const actions = header("Actions");

    expect(within(actions).queryByRole("button")).toBeNull();
    expect(actions).not.toHaveAttribute("aria-sort");
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("marks no column when the sorted key matches no column", () => {
    renderTable({
      sorting: { sort: { key: "unknown", dir: "asc" }, onSort: vi.fn() },
    });

    for (const th of screen.getAllByRole("columnheader")) {
      expect(th).not.toHaveAttribute("aria-sort");
    }
  });

  it("renders no button when no column opts in to sorting", () => {
    renderTable({
      columns: COLUMNS.map((column) => ({ ...column, enableSorting: false })),
    });

    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("DataTable bounded mode (DT-MODE-1)", () => {
  it("renders no button and no aria-sort anywhere without a sorting prop", () => {
    renderTable({ sorting: undefined });

    expect(screen.queryByRole("button")).toBeNull();
    for (const th of screen.getAllByRole("columnheader")) {
      expect(th).not.toHaveAttribute("aria-sort");
    }
    expect(screen.getAllByRole("columnheader")).toHaveLength(4);
  });

  it("keeps the row order and content as delivered", () => {
    renderTable({ sorting: undefined });

    expect(
      screen
        .getAllByRole("row")
        .slice(1)
        .map((row) => within(row).getAllByRole("cell")[0].textContent),
    ).toEqual(["Zoe", "Ana", "Beatriz"]);
  });
});

describe("DataTable structure (DT-A11Y-1)", () => {
  it("renders nothing for zero rows", () => {
    const { container } = renderTable({ rows: [] });

    expect(screen.queryByRole("table")).toBeNull();
    expect(container).toBeEmptyDOMElement();
  });

  it("names the table through a visually hidden caption plus the sort sentence", () => {
    renderTable();

    const table = screen.getByRole("table");
    const caption = table.querySelector("caption")!;

    expect(caption).toHaveClass("sr-only");
    expect(caption).toHaveTextContent("People list");
    expect(caption).toHaveTextContent(messages.en.tables.caption.sortable);
    expect(table).toHaveAccessibleName(
      `People list ${messages.en.tables.caption.sortable}`,
    );
  });

  it("omits the sort sentence when nothing can be sorted", () => {
    renderTable({ sorting: undefined });

    const table = screen.getByRole("table");

    expect(table).toHaveAccessibleName("People list");
    expect(table.querySelector("caption")).not.toHaveTextContent(
      messages.en.tables.caption.sortable,
    );
  });

  it("scopes every column header to its column", () => {
    renderTable();

    const headers = screen.getAllByRole("columnheader");

    expect(headers).toHaveLength(4);
    for (const th of headers) expect(th).toHaveAttribute("scope", "col");
  });

  it("keeps the header row at the documented 48px for both kinds of header", () => {
    renderTable();

    expect(header("Name")).toHaveClass("h-12");
    expect(header("Actions")).toHaveClass("h-12");
  });

  it("uses getRowId for the row id, not the index", () => {
    renderTable({
      columns: [{ id: "rowId", header: "Row", cell: ({ row }) => row.id }],
      sorting: undefined,
    });

    expect(
      screen
        .getAllByRole("row")
        .slice(1)
        .map((row) => row.textContent),
    ).toEqual(["p-3", "p-1", "p-2"]);
  });

  it("keys rows by that id: a reordered row keeps its DOM node", () => {
    const view = renderTable();
    const ana = screen.getByText("Ana").closest("tr");

    view.rerender(
      <DataTable<Person> {...view.props} rows={[...ROWS].reverse()} />,
    );

    expect(screen.getByText("Ana").closest("tr")).toBe(ana);
  });

  it("applies column meta align and className to the header and the cells", () => {
    renderTable();

    expect(header("Status")).toHaveClass("text-right");
    expect(header("Login")).toHaveClass("font-mono");
    const first = screen.getAllByRole("row")[1];
    const cells = within(first).getAllByRole("cell");
    expect(cells[1]).toHaveClass("font-mono");
    expect(cells[2]).toHaveClass("text-right");
    expect(cells[0]).not.toHaveClass("text-right", "font-mono");
  });

  it("renders the cell content through the column's renderer", () => {
    renderTable();

    expect(screen.getAllByRole("link", { name: "Edit" })).toHaveLength(3);
    expect(screen.getAllByRole("link", { name: "Edit" })[1]).toHaveAttribute(
      "href",
      "/people/1",
    );
  });
});

describe("DataTable pending state (DT-PEND-1, BS-MOT-1)", () => {
  it("dims the body by opacity only while pending and keeps the rows", () => {
    renderTable({ pending: true });

    const body = screen.getByRole("table").querySelector("tbody")!;

    expect(body).toHaveClass("opacity-60", "transition-opacity");
    expect(body.className).not.toMatch(/transition-(all|colors)/);
    expect(within(body).getAllByRole("row")).toHaveLength(3);
  });

  it("does not dim when idle", () => {
    renderTable({ pending: false });

    expect(screen.getByRole("table").querySelector("tbody")).not.toHaveClass(
      "opacity-60",
    );
  });

  it("never animates the header", () => {
    renderTable({ pending: true });

    expect(
      screen.getByRole("table").querySelector("thead")!.className,
    ).not.toMatch(/transition|opacity/);
  });
});
