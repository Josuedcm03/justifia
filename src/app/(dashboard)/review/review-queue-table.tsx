"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { DeadlineBadge } from "@/app/(dashboard)/review/deadline-badge";
import {
  actionColumn,
  studentColumns,
  type QueueRowBase,
} from "@/app/(dashboard)/review/queue-parts";
import { DataTable } from "@/components/tables/data-table";
import type { DeadlineStatus } from "@/lib/intake/business-days";

/**
 * One queue row as the page delivers it: plain, serializable display values
 * only, already formatted on the server. Nothing private rides along; the
 * absence cause is health data and is never part of a row (RNF-06).
 */
export type ReviewQueueTableRow = QueueRowBase & {
  receivedText: string;
  /** The "resubmitted" note, or `null` for a first submission. */
  resubmittedNote: string | null;
  subjectsText: string;
  deadlineStatus: DeadlineStatus;
  deadlineLabel: string;
  dueOnText: string;
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
      ...studentColumns<ReviewQueueTableRow>({
        student: t("student"),
        career: t("career"),
      }),
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
      actionColumn<ReviewQueueTableRow>(t("action")),
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
