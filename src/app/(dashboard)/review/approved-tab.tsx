import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";

import {
  ApprovedQueueTable,
  type ApprovedQueueTableRow,
} from "@/app/(dashboard)/review/approved-queue-table";
import { buttonVariants } from "@/components/ui/button";
import type { ApprovedRow } from "@/lib/data/revision-queue";

const BASE = "/review";
const BUSINESS_TIME_ZONE = "America/Managua";

/**
 * The Aprobadas tab (RF-15): the newest approvals with the number of absence
 * reports recorded on each. Only the latest 50 are read, so the note says so
 * (search is not part of this change). No deadline mark: the request is decided.
 */
export function ApprovedTab({ rows }: { rows: readonly ApprovedRow[] }) {
  const t = useTranslations("review.queue");
  const format = useFormatter();

  if (rows.length === 0) {
    return (
      <div className="border-border bg-card flex flex-col items-start gap-4 rounded-xl border px-6 py-12 text-center sm:items-center">
        <p className="text-muted-foreground max-w-prose">
          {t("approved.empty")}
        </p>
      </div>
    );
  }

  const day = (date: Date) =>
    format.dateTime(date, {
      dateStyle: "medium",
      timeZone: BUSINESS_TIME_ZONE,
    });
  const name = (row: ApprovedRow) => row.estudianteNombre ?? t("unnamed");
  const reports = (row: ApprovedRow) =>
    t("approved.reportsCount", { count: row.reportes });

  const tableRows: ApprovedQueueTableRow[] = rows.map((row) => ({
    id: row.id,
    approvedText: day(row.aprobadaEn),
    name: name(row),
    cif: row.estudianteCif,
    career: row.estudianteCarrera ?? "",
    reportsText: reports(row),
    reviewLabel: t("review"),
    reviewAriaLabel: t("reviewNamed", { name: name(row) }),
  }));

  return (
    <>
      <p className="text-muted-foreground max-w-prose text-sm">
        {t("approved.latest")}
      </p>

      <ul
        aria-label={t("approved.caption")}
        className="flex flex-col gap-4 md:hidden"
      >
        {rows.map((row) => (
          <li
            key={row.id}
            className="border-border bg-card shadow-soft flex flex-col gap-3 rounded-xl border p-4"
          >
            <div className="flex flex-col">
              <span className="font-medium break-words">{name(row)}</span>
              {row.estudianteCif ? (
                <span className="text-muted-foreground text-xs">
                  {row.estudianteCif}
                </span>
              ) : null}
            </div>
            <p className="text-muted-foreground text-sm break-words">
              {row.estudianteCarrera}
            </p>
            <p className="text-sm">
              {t("approved.columns.approved")}: {day(row.aprobadaEn)}
            </p>
            <p className="text-muted-foreground text-sm">{reports(row)}</p>
            <Link
              href={`${BASE}/${row.id}`}
              prefetch={false}
              aria-label={t("reviewNamed", { name: name(row) })}
              className={`${buttonVariants({ variant: "outline", size: "lg" })} w-full sm:w-auto`}
            >
              {t("review")}
            </Link>
          </li>
        ))}
      </ul>

      <div className="border-border bg-card shadow-soft hidden overflow-hidden rounded-xl border md:block">
        <ApprovedQueueTable rows={tableRows} caption={t("approved.caption")} />
      </div>
    </>
  );
}
