"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowData,
  type SortingState,
} from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { cn } from "cn";

import { SortableHeader } from "@/components/tables/sortable-header";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ListSort } from "@/lib/list-params";

declare module "@tanstack/react-table" {
  // The type parameters must match the library's declaration to merge, even
  // though the members below do not use them.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** `end` right-aligns the header and its cells (numbers, actions). */
    align?: "start" | "end";
    /** Extra classes for the header and the cells of the column. */
    className?: string;
  }
}

export type DataTableProps<T> = {
  columns: ColumnDef<T>[];
  rows: readonly T[];
  getRowId: (row: T) => string;
  /** Visually hidden; names the table for assistive technology. */
  caption: string;
  /**
   * Present: server-driven mode. A column with `enableSorting: true` is
   * sortable and its `id` is the URL sort key. Absent: bounded mode, a static
   * table with no sort control.
   */
  sorting?: { sort: ListSort<string>; onSort: (key: string) => void };
  /** A list navigation is in flight: dim the rows, keep them visible. */
  pending?: boolean;
};

/**
 * The table of every list and every bounded table (DT-MODE-1). TanStack Table
 * only describes the columns, headers and rows here; it never sorts, pages or
 * filters (all three are manual): the server delivers the rows of the view
 * already ordered, and a header only reports which column was activated.
 *
 * Function-valued `cell` renderers live in the columns, so this module and
 * every module that builds columns are client modules; columns never cross a
 * server boundary (design decision 5). Zero rows render nothing: the caller
 * shows the empty or no-results state instead.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowId,
  caption,
  sorting,
  pending = false,
}: DataTableProps<T>) {
  const t = useTranslations("tables");

  const sortKey = sorting?.sort.key;
  const sortDir = sorting?.sort.dir;
  const sortingState = useMemo<SortingState>(
    () => (sortKey ? [{ id: sortKey, desc: sortDir === "desc" }] : []),
    [sortKey, sortDir],
  );

  // `useReactTable` returns functions that cannot be memoized safely, which
  // `react-hooks/incompatible-library` reports. The React Compiler is not
  // enabled here and no table value is passed to a memoized child, so the
  // skipped memoization has no effect (apply-progress 0.6).
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows as T[],
    columns,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    manualFiltering: true,
    enableSorting: sorting !== undefined,
    state: { sorting: sortingState },
  });

  if (rows.length === 0) return null;

  const isSortable = (column: { columnDef: { enableSorting?: boolean } }) =>
    sorting !== undefined && column.columnDef.enableSorting === true;
  const hasSortable = table.getAllLeafColumns().some(isSortable);

  return (
    <Table>
      <TableCaption className="sr-only">
        <span>{caption}</span>
        {hasSortable ? (
          <>
            {" "}
            <span>{t("caption.sortable")}</span>
          </>
        ) : null}
      </TableCaption>
      <TableHeader>
        {table.getHeaderGroups().map((group) => (
          <TableRow key={group.id}>
            {group.headers.map((header) => {
              const { column } = header;
              const meta = column.columnDef.meta;
              const label = header.isPlaceholder
                ? null
                : flexRender(column.columnDef.header, header.getContext());

              if (sorting && isSortable(column)) {
                return (
                  <SortableHeader
                    key={header.id}
                    direction={column.getIsSorted()}
                    onSort={() => sorting.onSort(column.id)}
                    align={meta?.align}
                    className={meta?.className}
                  >
                    {label}
                  </SortableHeader>
                );
              }
              return (
                <TableHead
                  key={header.id}
                  scope="col"
                  className={cn(
                    meta?.align === "end" && "text-right",
                    meta?.className,
                  )}
                >
                  {label}
                </TableHead>
              );
            })}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody
        className={cn(
          "ease-ui transition-opacity duration-150",
          pending && "opacity-60",
        )}
      >
        {table.getRowModel().rows.map((row) => (
          <TableRow key={row.id}>
            {row.getVisibleCells().map((cell) => {
              const meta = cell.column.columnDef.meta;
              return (
                <TableCell
                  key={cell.id}
                  className={cn(
                    meta?.align === "end" && "text-right",
                    meta?.className,
                  )}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              );
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
