import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";

import {
  CoordinationQueueTable,
  type CoordinationQueueTableRow,
} from "@/app/(dashboard)/review/coordination-queue-table";
import { DeadlineBadge } from "@/app/(dashboard)/review/deadline-badge";
import { noticeStatusKey } from "@/app/(dashboard)/review/notice-status";
import { buttonVariants } from "@/components/ui/button";
import type { CoordinationQueueRow } from "@/lib/data/revision-queue";

const BASE = "/review";
const BUSINESS_TIME_ZONE = "America/Managua";

/**
 * The En coordinacion tab (RF-10): requests waiting for the career
 * coordination, oldest escalation first. Cards below md, the table from md.
 * The deadline is paused here, so every row carries the muted `en_pausa` badge
 * and no due date. Notification status is always written as text (RNF-07).
 */
export function CoordinationTab({
  rows,
}: {
  rows: readonly CoordinationQueueRow[];
}) {
  const t = useTranslations("review.queue");
  const tEscalation = useTranslations("review.escalation");
  const format = useFormatter();

  if (rows.length === 0) {
    return (
      <div className="border-border bg-card flex flex-col items-start gap-4 rounded-xl border px-6 py-12 text-center sm:items-center">
        <p className="text-muted-foreground max-w-prose">
          {t("coordination.empty")}
        </p>
      </div>
    );
  }

  const day = (date: Date) =>
    format.dateTime(date, {
      dateStyle: "medium",
      timeZone: BUSINESS_TIME_ZONE,
    });
  const name = (row: CoordinationQueueRow) =>
    row.estudianteNombre ?? t("unnamed");
  const notice = (row: CoordinationQueueRow) =>
    tEscalation(
      `notification.${noticeStatusKey(row.notificacionEstado, row.notificacionMotivo)}`,
      { date: row.enviadaEn ? day(row.enviadaEn) : "" },
    );

  const tableRows: CoordinationQueueTableRow[] = rows.map((row) => ({
    id: row.id,
    escalatedText: day(row.escaladaEn),
    name: name(row),
    cif: row.estudianteCif,
    career: row.estudianteCarrera ?? "",
    reasonText: tEscalation(`reasons.${row.motivo}`),
    pausedLabel: t("deadline.paused"),
    noticeText: notice(row),
    reviewLabel: t("review"),
    reviewAriaLabel: t("reviewNamed", { name: name(row) }),
  }));

  return (
    <>
      <ul
        aria-label={t("coordination.caption")}
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
              {row.estudianteCarrera} ·{" "}
              {t("subjectsCount", { count: row.asignaturas })}
            </p>
            <p className="text-sm">
              {t("coordination.columns.escalated")}: {day(row.escaladaEn)}
            </p>
            <p className="text-sm">{tEscalation(`reasons.${row.motivo}`)}</p>
            <DeadlineBadge status="en_pausa" label={t("deadline.paused")} />
            <p className="text-muted-foreground text-sm">{notice(row)}</p>
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
        <CoordinationQueueTable
          rows={tableRows}
          caption={t("coordination.caption")}
        />
      </div>
    </>
  );
}
