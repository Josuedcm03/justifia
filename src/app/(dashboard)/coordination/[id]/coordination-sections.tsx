import { useFormatter, useTranslations } from "next-intl";

import { BUSINESS_TIME_ZONE } from "@/app/(dashboard)/review/queue-parts";
import { Fact, Section } from "@/app/(dashboard)/review/[id]/request-sections";
import type {
  NoticeDetail,
  OpenEscalationDetail,
} from "@/lib/data/coordination-queue";

// The cards of the coordinator detail (E1, E10, RNF-02). They show only what the
// coordination needs: the student's name, CIF and career (never the email or
// the consent), the cause and dates of an escalated request, the secretary's
// note, and for a notice the teacher, the date and the note. The subjects and
// the documents reuse the staff cards, which carry no extra personal data.

function useDays() {
  const format = useFormatter();
  return {
    instant: (date: Date) =>
      format.dateTime(date, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: BUSINESS_TIME_ZONE,
      }),
    day: (iso: string) =>
      format.dateTime(new Date(`${iso}T00:00:00Z`), {
        dateStyle: "medium",
        timeZone: "UTC",
      }),
  };
}

export function CoordinationStudentSection({
  student,
}: {
  student: OpenEscalationDetail["estudiante"];
}) {
  const t = useTranslations("coordination.detail");

  return (
    <Section id="student" title={t("sections.student")}>
      <dl className="grid gap-4 sm:grid-cols-2">
        <Fact label={t("fields.name")}>{student.nombre ?? t("notSet")}</Fact>
        <Fact label={t("fields.cif")}>{student.cif ?? t("notSet")}</Fact>
        <Fact label={t("fields.career")}>{student.carrera}</Fact>
      </dl>
    </Section>
  );
}

/** The absence cause and dates of an escalated request. */
export function CoordinationRequestSection({
  detail,
}: {
  detail: OpenEscalationDetail;
}) {
  const t = useTranslations("coordination.detail");
  const tCauses = useTranslations("intake.causes");
  const dates = useDays();
  const { fechaInicio, fechaFin } = detail;

  return (
    <Section id="request" title={t("sections.request")}>
      <dl className="grid gap-4 sm:grid-cols-2">
        <Fact label={t("fields.cause")}>
          {detail.causa ? tCauses(detail.causa) : t("notSet")}
        </Fact>
        <Fact label={t("fields.period")}>
          {fechaInicio && fechaFin
            ? fechaInicio === fechaFin
              ? dates.day(fechaInicio)
              : t("period", {
                  start: dates.day(fechaInicio),
                  end: dates.day(fechaFin),
                })
            : t("notSet")}
        </Fact>
      </dl>
    </Section>
  );
}

/** Why the secretary escalated, and when. */
export function CoordinationEscalationSection({
  detail,
}: {
  detail: OpenEscalationDetail;
}) {
  const t = useTranslations("coordination.detail");
  const tReasons = useTranslations("review.escalation.reasons");
  const dates = useDays();

  return (
    <Section id="escalation" title={t("sections.escalation")}>
      <dl className="grid gap-4 sm:grid-cols-2">
        <Fact label={t("fields.reason")}>{tReasons(detail.motivo)}</Fact>
        <Fact label={t("fields.escalated")}>
          {dates.instant(detail.creadoEn)}
        </Fact>
      </dl>
      <dl>
        <Fact label={t("fields.note")}>
          <span className="whitespace-pre-wrap">{detail.nota}</span>
        </Fact>
      </dl>
    </Section>
  );
}

/** An informational notice: the teacher, the communicated date and the note. */
export function CoordinationNoticeSection({
  detail,
}: {
  detail: NoticeDetail;
}) {
  const t = useTranslations("coordination.detail");
  const dates = useDays();

  return (
    <Section id="notice" title={t("sections.notice")}>
      <dl className="grid gap-4 sm:grid-cols-2">
        <Fact label={t("fields.teacher")}>{detail.docenteNombre}</Fact>
        <Fact label={t("fields.communicated")}>
          {dates.day(detail.comunicadoEl)}
        </Fact>
      </dl>
      <dl>
        <Fact label={t("fields.reportNote")}>
          <span className="whitespace-pre-wrap">
            {detail.nota ?? t("noNote")}
          </span>
        </Fact>
      </dl>
    </Section>
  );
}
