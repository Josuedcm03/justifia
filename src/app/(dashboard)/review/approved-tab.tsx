import { useFormatter, useTranslations } from "next-intl";

import {
  ApprovedQueueTable,
  type ApprovedQueueTableRow,
} from "@/app/(dashboard)/review/approved-queue-table";
import {
  BUSINESS_TIME_ZONE,
  QueueCard,
  QueueEmpty,
  QueueLayout,
  QueueReviewLink,
  QueueStudent,
} from "@/app/(dashboard)/review/queue-parts";
import type { ApprovedRow } from "@/lib/data/revision-queue";

/**
 * The Aprobadas tab (RF-15): the newest approvals with the number of absence
 * reports recorded on each. Only the latest 50 are read, so the note says so
 * (search is not part of this change). No deadline mark: the request is decided.
 */
export function ApprovedTab({ rows }: { rows: readonly ApprovedRow[] }) {
  const t = useTranslations("review.queue");
  const format = useFormatter();

  if (rows.length === 0) {
    return <QueueEmpty message={t("approved.empty")} />;
  }

  const tableRows: ApprovedQueueTableRow[] = rows.map((row) => {
    const name = row.estudianteNombre ?? t("unnamed");
    return {
      id: row.id,
      approvedText: format.dateTime(row.aprobadaEn, {
        dateStyle: "medium",
        timeZone: BUSINESS_TIME_ZONE,
      }),
      name,
      cif: row.estudianteCif,
      career: row.estudianteCarrera ?? "",
      reportsText: t("approved.reportsCount", { count: row.reportes }),
      reviewLabel: t("review"),
      reviewAriaLabel: t("reviewNamed", { name }),
    };
  });

  return (
    <>
      <p className="text-muted-foreground max-w-prose text-sm">
        {t("approved.latest")}
      </p>

      <QueueLayout
        caption={t("approved.caption")}
        cards={tableRows.map((row) => (
          <QueueCard key={row.id}>
            <QueueStudent name={row.name} cif={row.cif} />
            <p className="text-muted-foreground text-sm break-words">
              {row.career}
            </p>
            <p className="text-sm">
              {t("approved.columns.approved")}: {row.approvedText}
            </p>
            <p className="text-muted-foreground text-sm">{row.reportsText}</p>
            <QueueReviewLink
              id={row.id}
              label={row.reviewLabel}
              ariaLabel={row.reviewAriaLabel}
            />
          </QueueCard>
        ))}
        table={
          <ApprovedQueueTable
            rows={tableRows}
            caption={t("approved.caption")}
          />
        }
      />
    </>
  );
}
