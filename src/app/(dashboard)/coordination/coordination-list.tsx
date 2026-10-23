import { useFormatter, useTranslations } from "next-intl";

import {
  BUSINESS_TIME_ZONE,
  QueueCard,
  QueueEmpty,
  QueueReviewLink,
  QueueStudent,
} from "@/app/(dashboard)/review/queue-parts";
import type {
  NoticeRow,
  OpenEscalationRow,
} from "@/lib/data/coordination-queue";

const BASE = "/coordination";

/**
 * The coordinator's list (E1, E10): the open escalations of the own career,
 * oldest first, then the informational notices, newest first. Cards at every
 * width. Only the student, the reason and the dates the rows carry are shown:
 * the cause, the note and the delivery state of a notice are never listed
 * (RNF-06), and a notice offers no action. The row links are never prefetched,
 * the detail is an audited read.
 */
export function CoordinationList({
  open,
  notices,
}: {
  open: readonly OpenEscalationRow[];
  notices: readonly NoticeRow[];
}) {
  const t = useTranslations("coordination.list");
  const tReasons = useTranslations("review.escalation.reasons");
  const format = useFormatter();

  const day = (date: Date) =>
    format.dateTime(date, {
      dateStyle: "medium",
      timeZone: BUSINESS_TIME_ZONE,
    });
  const calendarDay = (iso: string) =>
    format.dateTime(new Date(`${iso}T00:00:00Z`), {
      dateStyle: "medium",
      timeZone: "UTC",
    });
  const nameOf = (row: { estudianteNombre: string | null }) =>
    row.estudianteNombre ?? t("unnamed");

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="open-title" className="flex flex-col gap-4">
        <h2 id="open-title" className="text-headline">
          {t("open.title")}
        </h2>
        {open.length === 0 ? (
          <QueueEmpty message={t("open.empty")} />
        ) : (
          <ul aria-label={t("open.caption")} className="flex flex-col gap-4">
            {open.map((row) => (
              <QueueCard key={row.id}>
                <QueueStudent name={nameOf(row)} cif={row.estudianteCif} />
                <p className="text-muted-foreground text-sm">
                  {tReasons(row.motivo)} ·{" "}
                  {t("open.escalated", { date: day(row.creadoEn) })}
                </p>
                <QueueReviewLink
                  base={BASE}
                  id={row.id}
                  label={t("open.attend")}
                  ariaLabel={t("open.attendNamed", { name: nameOf(row) })}
                />
              </QueueCard>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="notices-title" className="flex flex-col gap-4">
        <h2 id="notices-title" className="text-headline">
          {t("notices.title")}
        </h2>
        {notices.length === 0 ? (
          <QueueEmpty message={t("notices.empty")} />
        ) : (
          <ul aria-label={t("notices.caption")} className="flex flex-col gap-4">
            {notices.map((row) => (
              <QueueCard key={row.id}>
                <QueueStudent name={nameOf(row)} cif={row.estudianteCif} />
                <p className="text-muted-foreground text-sm break-words">
                  {t("notices.teacher", { name: row.docenteNombre })} ·{" "}
                  {t("notices.communicated", {
                    date: calendarDay(row.comunicadoEl),
                  })}
                </p>
                <QueueReviewLink
                  base={BASE}
                  id={row.id}
                  label={t("notices.view")}
                  ariaLabel={t("notices.viewNamed", { name: nameOf(row) })}
                />
              </QueueCard>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
