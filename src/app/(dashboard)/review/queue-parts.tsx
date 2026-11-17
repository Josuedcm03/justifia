import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import type { ReactNode } from "react";

import { buttonVariants } from "@/components/ui/button";

// The pieces every review tab repeats: the student cell, the review link, the
// mobile card list, the desktop frame and the empty state. No hooks, so the
// server tabs and the client tables share them.

const BASE = "/review";

export const BUSINESS_TIME_ZONE = "America/Managua";

/** The display values every tab row carries, whatever its state. */
export type QueueRowBase = {
  id: number;
  name: string;
  cif: string | null;
  career: string;
  reviewLabel: string;
  reviewAriaLabel: string;
};

export function QueueStudent({
  name,
  cif,
  career,
}: {
  name: string;
  cif: string | null;
  /** The career under the CIF, for a table that has no column for it. */
  career?: string;
}) {
  return (
    <div className="flex flex-col">
      <span className="font-medium break-words">{name}</span>
      {cif ? (
        <span className="text-muted-foreground text-xs">{cif}</span>
      ) : null}
      {career ? (
        <span className="text-muted-foreground text-sm break-words">
          {career}
        </span>
      ) : null}
    </div>
  );
}

/**
 * The link to the detail; never prefetched, the detail is an audited read. The
 * coordinator list reuses it with its own `base`.
 */
export function QueueReviewLink({
  id,
  label,
  ariaLabel,
  base = BASE,
}: {
  id: number;
  label: string;
  ariaLabel: string;
  base?: string;
}) {
  return (
    <Link
      href={`${base}/${id}`}
      prefetch={false}
      aria-label={ariaLabel}
      className={`${buttonVariants({ variant: "outline", size: "lg" })} w-full sm:w-auto`}
    >
      {label}
    </Link>
  );
}

export function QueueEmpty({ message }: { message: string }) {
  return (
    <div className="border-border bg-card flex flex-col items-start gap-4 rounded-xl border px-6 py-12 text-center sm:items-center">
      <p className="text-muted-foreground max-w-prose">{message}</p>
    </div>
  );
}

/** Cards below md, the table from md; both carry the same rows. */
export function QueueLayout({
  caption,
  cards,
  table,
}: {
  caption: string;
  cards: ReactNode;
  table: ReactNode;
}) {
  return (
    <>
      <ul aria-label={caption} className="flex flex-col gap-4 md:hidden">
        {cards}
      </ul>

      <div className="border-border bg-card shadow-soft hidden overflow-hidden rounded-xl border md:block">
        {table}
      </div>
    </>
  );
}

export function QueueCard({ children }: { children: ReactNode }) {
  return (
    <li className="border-border bg-card shadow-soft flex flex-col gap-3 rounded-xl border p-4">
      {children}
    </li>
  );
}

/**
 * A table cell may wrap. The table kit keeps every cell on one line (right for
 * a date or a count); a name, a career or a notice is longer than its column at
 * a desktop width, so these cells wrap instead of pushing the actions column out
 * of the card behind a horizontal scrollbar.
 */
export const WRAP = "whitespace-normal";

/** The student and career columns, in that order; both wrap. */
export function studentColumns<T extends QueueRowBase>(headers: {
  student: string;
  career: string;
}): ColumnDef<T>[] {
  return [
    {
      id: "student",
      header: headers.student,
      cell: ({ row }) => (
        <QueueStudent name={row.original.name} cif={row.original.cif} />
      ),
      meta: { className: WRAP },
    },
    {
      id: "career",
      header: headers.career,
      cell: ({ row }) => row.original.career,
      meta: { className: `text-muted-foreground ${WRAP}` },
    },
  ];
}

/**
 * The closing review-link column: a narrow fixed width, so the link keeps its
 * own size and the wrapping columns give way first.
 */
export function actionColumn<T extends QueueRowBase>(
  header: string,
): ColumnDef<T> {
  return {
    id: "action",
    header,
    cell: ({ row }) => (
      <QueueReviewLink
        id={row.original.id}
        label={row.original.reviewLabel}
        ariaLabel={row.original.reviewAriaLabel}
      />
    ),
    meta: { align: "end", className: "w-36" },
  };
}
