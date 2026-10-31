import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
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
 * One request as the page delivers it: plain display text, already formatted on
 * the server (dates in the business time zone, labels translated). Nothing
 * beyond the CR-DET-1 columns can ride along.
 */
export type RequestsTableRow = {
  id: number;
  student: string;
  cif: string;
  cause: string;
  state: string;
  absence: string;
  submitted: string;
  /** One line per justified class, each with its teacher and period. */
  classes: readonly string[];
};

export type RequestsTableColumns = {
  student: string;
  cif: string;
  cause: string;
  state: string;
  absence: string;
  submitted: string;
  classes: string;
};

/**
 * The request detail table (CR-DET-1): one row per request, the classes of a
 * request together in one cell. Hook-free, so the server page renders it as is.
 * The table scrolls inside its own container, so a narrow screen never widens
 * the page; the classes cell wraps instead of forcing the width. Zero rows are
 * never rendered here: the page shows the no-results state instead.
 */
export function RequestsTable({
  caption,
  columns,
  rows,
}: {
  /** Visually hidden; names the table for assistive technology. */
  caption: string;
  columns: RequestsTableColumns;
  rows: readonly RequestsTableRow[];
}) {
  return (
    <Table>
      <TableCaption className="sr-only">{caption}</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>{columns.student}</TableHead>
          <TableHead>{columns.cif}</TableHead>
          <TableHead>{columns.cause}</TableHead>
          <TableHead>{columns.state}</TableHead>
          <TableHead>{columns.absence}</TableHead>
          <TableHead>{columns.submitted}</TableHead>
          <TableHead>{columns.classes}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-medium">{row.student}</TableCell>
            <TableCell className="text-muted-foreground tabular-nums">
              {row.cif}
            </TableCell>
            <TableCell>{row.cause}</TableCell>
            <TableCell>{row.state}</TableCell>
            <TableCell className="tabular-nums">{row.absence}</TableCell>
            <TableCell className="tabular-nums">{row.submitted}</TableCell>
            <TableCell className="min-w-64 whitespace-normal">
              <ul className="flex flex-col gap-1">
                {row.classes.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

const CONTROL =
  "inline-flex min-h-11 items-center justify-center gap-1 rounded-lg px-3";

/**
 * Previous and next page of the detail. Every href comes from the caller, which
 * carries the resolved period and filters, and every link opts out of prefetch:
 * the target writes an audit row when it renders. At an edge a control is muted
 * text with `aria-disabled`, never a dead link.
 */
export function RequestsPagination({
  page,
  pages,
  labels,
  hrefFor,
}: {
  page: number;
  pages: number;
  labels: { region: string; previous: string; next: string; status: string };
  hrefFor: (page: number) => string;
}) {
  const control = (
    label: string,
    target: number,
    available: boolean,
    icon: "previous" | "next",
  ) => {
    const Icon = icon === "previous" ? ChevronLeft : ChevronRight;
    const content = (
      <>
        {icon === "previous" ? (
          <Icon aria-hidden="true" className="size-5 shrink-0" />
        ) : null}
        {label}
        {icon === "next" ? (
          <Icon aria-hidden="true" className="size-5 shrink-0" />
        ) : null}
      </>
    );
    return available ? (
      <Link
        href={hrefFor(target)}
        prefetch={false}
        className={cn(
          CONTROL,
          "text-primary hover:bg-primary/5 focus-visible:ring-ring focus-visible:ring-offset-background outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        )}
      >
        {content}
      </Link>
    ) : (
      <span
        aria-disabled="true"
        className={cn(CONTROL, "text-muted-foreground")}
      >
        {content}
      </span>
    );
  };

  return (
    <nav
      aria-label={labels.region}
      className="flex flex-wrap items-center justify-center gap-2"
    >
      {control(labels.previous, page - 1, page > 1, "previous")}
      <span aria-current="page" className="px-2 text-sm font-medium">
        {labels.status}
      </span>
      {control(labels.next, page + 1, page < pages, "next")}
    </nav>
  );
}
