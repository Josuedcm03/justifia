import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DataTable, type DataTableColumn } from "@/components/data-table";

type Row = { id: number; name: string; total: number };

const rows: Row[] = [
  { id: 1, name: "Ana", total: 10 },
  { id: 2, name: "Beto", total: 20 },
];

const columns: readonly DataTableColumn<Row>[] = [
  { key: "name", header: "Name", cell: (row) => row.name },
  {
    key: "total",
    header: "Total",
    cell: (row) => `$${row.total}`,
    align: "end",
  },
];

describe("DataTable", () => {
  it("renders header cells in column order", () => {
    render(
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        empty={<p>empty</p>}
      />,
    );

    const headers = screen.getAllByRole("columnheader");
    expect(headers).toHaveLength(2);
    expect(headers[0]).toHaveTextContent("Name");
    expect(headers[1]).toHaveTextContent("Total");
  });

  it("renders one row per item with the cell() output", () => {
    render(
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        empty={<p>empty</p>}
      />,
    );

    const dataRows = screen.getAllByRole("row").slice(1); // drop the header row
    expect(dataRows).toHaveLength(2);
    expect(dataRows[0]).toHaveTextContent("Ana");
    expect(dataRows[1]).toHaveTextContent("Beto");
    expect(screen.getByText("$10")).toBeInTheDocument();
    expect(screen.getByText("$20")).toBeInTheDocument();
  });

  it("uses getRowKey even when two rows have identical content", () => {
    const equalRows: Row[] = [
      { id: 1, name: "Ana", total: 10 },
      { id: 2, name: "Ana", total: 10 },
    ];

    render(
      <DataTable
        columns={columns}
        rows={equalRows}
        getRowKey={(row) => row.id}
        empty={<p>empty</p>}
      />,
    );

    const dataRows = screen.getAllByRole("row").slice(1);
    expect(dataRows).toHaveLength(2);
  });

  it("renders the empty slot and no table when rows is empty", () => {
    render(
      <DataTable
        columns={columns}
        rows={[]}
        getRowKey={(row) => row.id}
        empty={<p>Nothing here</p>}
      />,
    );

    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders a visually hidden caption naming the table for assistive tech", () => {
    render(
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        caption="Users list"
        empty={<p>empty</p>}
      />,
    );

    const caption = screen.getByText("Users list");
    expect(caption.tagName.toLowerCase()).toBe("caption");
    expect(caption.className).toContain("sr-only");
  });

  it("applies the align=end class to the header and cell of that column", () => {
    render(
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        empty={<p>empty</p>}
      />,
    );

    const headers = screen.getAllByRole("columnheader");
    expect(headers[1].className).toContain("text-right");

    const dataRows = screen.getAllByRole("row").slice(1);
    const totalCell = dataRows[0].querySelectorAll("td")[1];
    expect(totalCell.className).toContain("text-right");
  });
});
