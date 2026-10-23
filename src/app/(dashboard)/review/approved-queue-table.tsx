"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import {
  actionColumn,
  studentColumns,
  type QueueRowBase,
} from "@/app/(dashboard)/review/queue-parts";
import { DataTable } from "@/components/tables/data-table";

/**
 * One Aprobadas row as the page delivers it: plain display values only. The
 * report count is a number written as text; the reports themselves are read on
 * the detail (RF-15).
 */
export type ApprovedQueueTableRow = QueueRowBase & {
  approvedText: string;
  reportsText: string;
};

/** The Aprobadas tab in bounded mode: newest approval first, no controls. */
export function ApprovedQueueTable({
  rows,
  caption,
}: {
  rows: readonly ApprovedQueueTableRow[];
  caption: string;
}) {
  const t = useTranslations("review.queue");
  const columns = useMemo<ColumnDef<ApprovedQueueTableRow>[]>(
    () => [
      {
        id: "approved",
        header: t("approved.columns.approved"),
        cell: ({ row }) => row.original.approvedText,
        meta: { className: "tabular-nums" },
      },
      ...studentColumns<ApprovedQueueTableRow>({
        student: t("columns.student"),
        career: t("columns.career"),
      }),
      {
        id: "reports",
        header: t("approved.columns.reports"),
        cell: ({ row }) => row.original.reportsText,
      },
      actionColumn<ApprovedQueueTableRow>(t("columns.action")),
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
