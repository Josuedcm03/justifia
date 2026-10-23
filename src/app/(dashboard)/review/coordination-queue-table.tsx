"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { DeadlineBadge } from "@/app/(dashboard)/review/deadline-badge";
import { DataTable } from "@/components/tables/data-table";
import { buttonVariants } from "@/components/ui/button";

const BASE = "/review";

/**
 * One En coordinacion row as the page delivers it: plain display values,
 * already formatted on the server. The cause and the escalation note are never
 * part of a row; the note is read on the detail (RNF-06).
 */
export type CoordinationQueueTableRow = {
  id: number;
  escalatedText: string;
  name: string;
  cif: string | null;
  career: string;
  reasonText: string;
  pausedLabel: string;
  noticeText: string;
  reviewLabel: string;
  reviewAriaLabel: string;
};

/**
 * The En coordinacion tab in bounded mode, like the Pendientes table: rows in
 * the order delivered (oldest escalation first), no sort, paging or toolbar.
 * The deadline column is the muted `en_pausa` badge: the clock is stopped.
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
        cell: ({ row }) => row.original.escalatedText,
        meta: { className: "tabular-nums" },
      },
      {
        id: "student",
        header: t("columns.student"),
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
        header: t("columns.career"),
        cell: ({ row }) => row.original.career,
        meta: { className: "text-muted-foreground" },
      },
      {
        id: "reason",
        header: t("coordination.columns.reason"),
        cell: ({ row }) => row.original.reasonText,
      },
      {
        id: "status",
        header: t("coordination.columns.status"),
        cell: ({ row }) => (
          <DeadlineBadge status="en_pausa" label={row.original.pausedLabel} />
        ),
      },
      {
        id: "notice",
        header: t("coordination.columns.notice"),
        cell: ({ row }) => row.original.noticeText,
      },
      {
        id: "action",
        header: t("columns.action"),
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
