"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { DeadlineBadge } from "@/app/(dashboard)/review/deadline-badge";
import { DataTable } from "@/components/tables/data-table";
import { buttonVariants } from "@/components/ui/button";
import type { DeadlineStatus } from "@/lib/intake/business-days";

const BASE = "/review";

/**
 * One queue row as the page delivers it: plain, serializable display values
 * only, already formatted on the server. Nothing private rides along; the
 * absence cause is health data and is never part of a row (RNF-06).
 */
export type ReviewQueueTableRow = {
  id: number;
  receivedText: string;
  /** The "resubmitted" note, or `null` for a first submission. */
  resubmittedNote: string | null;
  name: string;
  cif: string | null;
  career: string;
  subjectsText: string;
  deadlineStatus: DeadlineStatus;
  deadlineLabel: string;
  dueOnText: string;
  reviewLabel: string;
  reviewAriaLabel: string;
};

/**
 * The staff queue in bounded mode (DT-MODE-1): rows in the order delivered,
 * no sort control, paging or toolbar. Columns are built here, inside the
 * client, because function-valued cell renderers never cross a server
 * boundary (design decision 5). Zero rows render nothing.
 */
export function ReviewQueueTable({
  rows,
  caption,
}: {
  rows: readonly ReviewQueueTableRow[];
  caption: string;
}) {
  const t = useTranslations("review.queue.columns");
  const columns = useMemo<ColumnDef<ReviewQueueTableRow>[]>(
    () => [
      {
        id: "received",
        header: t("received"),
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span>{row.original.receivedText}</span>
            {row.original.resubmittedNote ? (
              <span className="text-muted-foreground text-xs">
                {row.original.resubmittedNote}
              </span>
            ) : null}
          </div>
        ),
        meta: { className: "tabular-nums" },
      },
      {
        id: "student",
        header: t("student"),
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium break-words">{row.original.name}</span>
            {row.original.cif ? (
              <span className="text-muted-foreground text-xs">
                {row.original.cif}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        id: "career",
        header: t("career"),
        cell: ({ row }) => row.original.career,
        meta: { className: "text-muted-foreground" },
      },
      {
        id: "subjects",
        header: t("subjects"),
        cell: ({ row }) => row.original.subjectsText,
      },
      {
        id: "deadline",
        header: t("deadline"),
        cell: ({ row }) => (
          <div className="flex flex-col gap-1">
            <DeadlineBadge
              status={row.original.deadlineStatus}
              label={row.original.deadlineLabel}
            />
            <span className="text-muted-foreground text-xs">
              {row.original.dueOnText}
            </span>
          </div>
        ),
      },
      {
        id: "action",
        header: t("action"),
        cell: ({ row }) => (
          <Link
            href={`${BASE}/${row.original.id}`}
            prefetch={false}
            aria-label={row.original.reviewAriaLabel}
            className={`${buttonVariants({ variant: "outline", size: "lg" })} w-full sm:w-auto`}
          >
            {row.original.reviewLabel}
          </Link>
        ),
        meta: { align: "end" },
      },
    ],
    [t],
  );

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowId={(row) => String(row.id)}
      caption={caption}
    />
  );
}
