"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { DeadlineBadge } from "@/app/(dashboard)/review/deadline-badge";
import {
  actionColumn,
  QueueStudent,
  WRAP,
  type QueueRowBase,
} from "@/app/(dashboard)/review/queue-parts";
import { DataTable } from "@/components/tables/data-table";

/**
 * One En coordinacion row as the page delivers it: plain display values,
 * already formatted on the server. The cause and the escalation note are never
 * part of a row; the note is read on the detail (RNF-06).
 */
export type CoordinationQueueTableRow = QueueRowBase & {
  escalatedText: string;
  reasonText: string;
  pausedLabel: string;
  noticeText: string;
};

/**
 * The En coordinacion tab in bounded mode, like the Pendientes table: rows in
 * the order delivered (oldest escalation first), no sort, paging or toolbar.
 * The paused deadline (the muted `en_pausa` badge: the clock is stopped) sits
 * under the escalation date and the career under the student, so the table has
 * five columns and fits a desktop without a horizontal scroll; the student, the
 * reason and the notice wrap.
 */
export function CoordinationQueueTable({
  rows,
  caption,
}: {
  rows: readonly CoordinationQueueTableRow[];
  caption: string;
}) {
  const t = useTranslations("review.queue");
  const columns = useMemo<ColumnDef<CoordinationQueueTableRow>[]>(
    () => [
      {
        id: "escalated",
        header: t("coordination.columns.escalated"),
        cell: ({ row }) => (
          <div className="flex flex-col items-start gap-1">
            <span>{row.original.escalatedText}</span>
            <DeadlineBadge status="en_pausa" label={row.original.pausedLabel} />
          </div>
        ),
        meta: { className: "tabular-nums" },
      },
      {
        id: "student",
        header: t("columns.student"),
        cell: ({ row }) => (
          <QueueStudent
            name={row.original.name}
            cif={row.original.cif}
            career={row.original.career}
          />
        ),
        meta: { className: WRAP },
      },
      {
        id: "reason",
        header: t("coordination.columns.reason"),
        cell: ({ row }) => row.original.reasonText,
        meta: { className: WRAP },
      },
      {
        id: "notice",
        header: t("coordination.columns.notice"),
        cell: ({ row }) => row.original.noticeText,
        meta: { className: WRAP },
      },
      actionColumn<CoordinationQueueTableRow>(t("columns.action")),
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
