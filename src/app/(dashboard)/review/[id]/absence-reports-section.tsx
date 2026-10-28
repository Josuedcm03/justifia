import { useFormatter, useTranslations } from "next-intl";

import { NoticeStatusPill } from "@/app/(dashboard)/review/[id]/escalation-section";
import {
  ReportDialog,
  type ReportTeacher,
} from "@/app/(dashboard)/review/[id]/report-dialog";
import { Section } from "@/app/(dashboard)/review/[id]/request-sections";
import type { DetailReport } from "@/lib/data/solicitud-detail";

// The RF-15 absence reports of the staff detail, apart from the remission
// section: a report never changes a remission. Append-only records, so the list
// has no edit or delete control; the only action is to record another report,
// offered while the request is approved. Each entry shows the delivery of its
// notice to coordination as text (RNF-07). There is no percentage or absence
// count anywhere (RF-15 a).

const BUSINESS_TIME_ZONE = "America/Managua";

export function AbsenceReportsSection({
  solicitudId,
  reports,
  canReport,
  teachers,
  maxDate,
}: {
  solicitudId: number;
  reports: readonly DetailReport[];
  /** True only for an `aprobada` request. */
  canReport: boolean;
  teachers: readonly ReportTeacher[];
  /** Today in Managua, the latest date a report may carry. */
  maxDate: string;
}) {
  const t = useTranslations("review.report");
  const tEscalation = useTranslations("review.escalation");
  const format = useFormatter();

  if (!canReport && reports.length === 0) return null;

  const day = (iso: string) =>
    format.dateTime(new Date(`${iso}T00:00:00Z`), {
      dateStyle: "medium",
      timeZone: "UTC",
    });
  const when = (date: Date) =>
    format.dateTime(date, {
      dateStyle: "medium",
      timeZone: BUSINESS_TIME_ZONE,
    });

  return (
    <Section id="reports" title={t("section.title")}>
      {reports.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("section.empty")}</p>
      ) : (
        <ul aria-label={t("section.title")} className="flex flex-col gap-6">
          {reports.map((report) => (
            <li
              key={report.id}
              className="border-border flex flex-col gap-3 border-l-2 pl-4"
            >
              <span className="text-sm font-medium break-words">
                {report.docenteNombre}
              </span>
              <span className="text-muted-foreground text-sm">
                {t("entry.communicated", { date: day(report.comunicadoEl) })}
              </span>
              {report.nota ? (
                <div className="flex flex-col gap-1">
                  <span className="text-label text-muted-foreground">
                    {t("entry.note")}
                  </span>
                  <p className="text-sm break-words whitespace-pre-wrap">
                    {report.nota}
                  </p>
                </div>
              ) : null}
              <span className="text-muted-foreground text-xs">
                {t("entry.recordedBy", {
                  name: report.registradoPorNombre,
                  date: when(report.registradoEn),
                })}
              </span>
              <div className="flex flex-col gap-1">
                <span className="text-label text-muted-foreground">
                  {tEscalation("section.fields.notice")}
                </span>
                <NoticeStatusPill
                  estado={report.notificacionEstado}
                  motivo={report.notificacionMotivo}
                  enviadaEn={report.enviadaEn}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      {canReport ? (
        <ReportDialog
          solicitudId={solicitudId}
          teachers={teachers}
          maxDate={maxDate}
        />
      ) : null}
    </Section>
  );
}
