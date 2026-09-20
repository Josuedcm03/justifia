import type { ReactNode } from "react";
import { cn } from "cn";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * A reusable column config for `DataTable`: no knowledge of any particular
 * domain (design.md decision 24 — three small presentational components
 * instead of `@tanstack/react-table`).
 */
export type DataTableColumn<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  align?: "start" | "end";
  className?: string;
};

/**
 * Server component (no `"use client"`): composes the existing shadcn `Table`
 * primitives verbatim, no new tokens, no new radii or spacing steps. Renders
 * `empty` INSTEAD of the `<table>` when `rows` is empty, so an empty scope
 * never shows a table with zero rows (users-listing spec, "Empty scope shows
 * an empty state").
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  caption,
  empty,
}: {
  columns: readonly DataTableColumn<T>[];
  rows: readonly T[];
  getRowKey: (row: T) => string | number;
  /** Visually hidden; names the table for assistive technology. */
  caption?: string;
  /** The empty OR no-results slot, decided by the caller. */
  empty: ReactNode;
}) {
  if (rows.length === 0) return <>{empty}</>;

  return (
    <Table>
      {caption ? (
        <TableCaption className="sr-only">{caption}</TableCaption>
      ) : null}
      <TableHeader className="bg-muted">
        <TableRow>
          {columns.map((column) => (
            <TableHead
              key={column.key}
              className={cn(
                column.align === "end" && "text-right",
                column.className,
              )}
            >
              {column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={getRowKey(row)} className="hover:bg-accent/50">
            {columns.map((column) => (
              <TableCell
                key={column.key}
                className={cn(
                  column.align === "end" && "text-right",
                  column.className,
                )}
              >
                {column.cell(row)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
