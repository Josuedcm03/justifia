import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function renderTable() {
  render(
    <Table>
      <TableHeader>
        <TableRow data-testid="head-row">
          <TableHead>Name</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow data-testid="body-row">
          <TableCell>Ana</TableCell>
        </TableRow>
      </TableBody>
    </Table>,
  );
}

describe("ui/table: row hover is instant (DT-SORT-2, BS-MOT-1, R12)", () => {
  it("does not animate the row on hover", () => {
    renderTable();

    expect(screen.getByTestId("body-row").className).not.toMatch(
      /transition|animate|duration/,
    );
  });

  it("applies the 5% hover tint only through the hover variant", () => {
    renderTable();

    const tokens = screen.getByTestId("body-row").className.split(/\s+/);

    expect(tokens).toContain("hover:bg-primary/5");
    // No unconditional tint on the row: every `bg-primary/5` is behind a
    // variant, and `hover:` is the one that only fires on hover-capable
    // pointers in Tailwind v4.
    expect(tokens).not.toContain("bg-primary/5");
  });

  it("keeps the horizontal divider and the muted header row", () => {
    renderTable();

    expect(screen.getByTestId("body-row")).toHaveClass("border-b");
    expect(screen.getByTestId("head-row").closest("thead")).toHaveClass(
      "bg-muted",
    );
  });

  it("does not animate headers or cells", () => {
    renderTable();

    expect(screen.getByRole("columnheader").className).not.toMatch(
      /transition|animate/,
    );
    expect(screen.getByRole("cell").className).not.toMatch(
      /transition|animate/,
    );
  });
});
