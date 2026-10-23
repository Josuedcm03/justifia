"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { DataTable } from "@/components/tables/data-table";
import { buttonVariants } from "@/components/ui/button";

const BASE = "/review";

/**
 * One Aprobadas row as the page delivers it: plain display values only. The
 * report count is a number written as text; the reports themselves are read on
 * the detail (RF-15).
 */
export type ApprovedQueueTableRow = {
  id: number;
  approvedText: string;
  name: string;
  cif: string | null;
  career: string;
  reportsText: string;
  reviewLabel: string;
  reviewAriaLabel: string;
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
        id: "reports",
        header: t("approved.columns.reports"),
        cell: ({ row }) => row.original.reportsText,
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
