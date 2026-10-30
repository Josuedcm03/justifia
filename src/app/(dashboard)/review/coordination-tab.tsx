import { useFormatter, useTranslations } from "next-intl";

import {
  CoordinationQueueTable,
  type CoordinationQueueTableRow,
} from "@/app/(dashboard)/review/coordination-queue-table";
import { DeadlineBadge } from "@/app/(dashboard)/review/deadline-badge";
import { noticeStatusKey } from "@/app/(dashboard)/review/notice-status";
import {
  BUSINESS_TIME_ZONE,
  QueueCard,
  QueueEmpty,
  QueueLayout,
  QueueReviewLink,
  QueueStudent,
} from "@/app/(dashboard)/review/queue-parts";
import type { CoordinationQueueRow } from "@/lib/data/revision-queue";

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
    return <QueueEmpty message={t("coordination.empty")} />;
  }

  const day = (date: Date) =>
    format.dateTime(date, {
      dateStyle: "medium",
      timeZone: BUSINESS_TIME_ZONE,
    });
  const sentAt = (date: Date) =>
    format.dateTime(date, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: BUSINESS_TIME_ZONE,
    });

  const tableRows: CoordinationQueueTableRow[] = rows.map((row) => {
    const name = row.estudianteNombre ?? t("unnamed");
    return {
      id: row.id,
      escalatedText: day(row.escaladaEn),
      name,
      cif: row.estudianteCif,
      career: row.estudianteCarrera ?? "",
      reasonText: tEscalation(`reasons.${row.motivo}`),
      pausedLabel: t("deadline.paused"),
      noticeText: tEscalation(
        `notification.${noticeStatusKey(row.notificacionEstado, row.notificacionMotivo)}`,
        { date: row.enviadaEn ? sentAt(row.enviadaEn) : "" },
      ),
      reviewLabel: t("review"),
      reviewAriaLabel: t("reviewNamed", { name }),
    };
  });

  return (
    <QueueLayout
      caption={t("coordination.caption")}
      cards={tableRows.map((row, i) => (
        <QueueCard key={row.id}>
          <QueueStudent name={row.name} cif={row.cif} />
          <p className="text-muted-foreground text-sm break-words">
            {row.career} · {t("subjectsCount", { count: rows[i].asignaturas })}
          </p>
          <p className="text-sm">
            {t("coordination.columns.escalated")}: {row.escalatedText}
          </p>
          <p className="text-sm">{row.reasonText}</p>
          <DeadlineBadge status="en_pausa" label={row.pausedLabel} />
          <p className="text-muted-foreground text-sm">{row.noticeText}</p>
          <QueueReviewLink
            id={row.id}
            label={row.reviewLabel}
            ariaLabel={row.reviewAriaLabel}
          />
        </QueueCard>
      ))}
      table={
        <CoordinationQueueTable
          rows={tableRows}
          caption={t("coordination.caption")}
        />
      }
    />
  );
}
