import { cn } from "cn";
import { useFormatter, useTranslations } from "next-intl";

import { Fact, Section } from "@/app/(dashboard)/review/[id]/request-sections";
import { ResendEscalationButton } from "@/app/(dashboard)/review/[id]/resend-escalation-button";
import {
  noticeStatusKey,
  type NoticeStatusKey,
} from "@/app/(dashboard)/review/notice-status";
import { BUSINESS_TIME_ZONE } from "@/app/(dashboard)/review/queue-parts";
import type { DetailEscalation } from "@/lib/data/solicitud-detail";
import type {
  EscalationNoticeReason,
  EscalationNoticeState,
} from "@/lib/intake/escalation";

// The escalation history of the staff detail (RF-10 a, RN-16): for every
// suspicion escalation its reason, note, author and time, the coordination
// answer when there is one, and the delivery of the notice to coordination.
// Staff only; the student detail never receives this data (ES-14). It offers no
// decision control: while a request is in coordination there is nothing to
// decide. The only control is the resend of a notice that is not `enviada`
// (RF-10 b). Sync component, like the other sections: text, dates and times
// resolve on the server in the business zone.

const STATUS_TONES: Record<NoticeStatusKey, string> = {
  pendiente: "bg-warning/10 text-warning-ink",
  pendienteFallido: "bg-warning/10 text-warning-ink",
  enviada: "bg-success/10 text-success-ink",
  bloqueada: "bg-destructive/10 text-destructive-ink",
  respondida: "bg-muted text-muted-foreground",
};

/** The notification status as a pill; the state is always the text (§7). */
export function NoticeStatusPill({
  estado,
  motivo,
  enviadaEn,
  answered = false,
}: {
  estado: EscalationNoticeState;
  motivo: EscalationNoticeReason | null;
  enviadaEn: Date | null;
  /** The escalation was answered: an unsent notice will not be sent. */
  answered?: boolean;
}) {
  const t = useTranslations("review.escalation.notification");
  const format = useFormatter();
  const key = noticeStatusKey(estado, motivo, answered);

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-medium",
        STATUS_TONES[key],
      )}
    >
      {t(key, {
        date: enviadaEn
          ? format.dateTime(enviadaEn, {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: BUSINESS_TIME_ZONE,
            })
          : "",
      })}
    </span>
  );
}

/**
 * The delivery of one notice to coordination: its status as text and, unless it
 * was sent or its escalation was answered, the control to resend it (RF-10 b). `label` names the notice for
 * assistive technology when a request has several.
 */
export function NoticeDelivery({
  escalamientoId,
  label,
  estado,
  motivo,
  enviadaEn,
  answered = false,
}: {
  escalamientoId: number;
  label: string;
  estado: EscalationNoticeState;
  motivo: EscalationNoticeReason | null;
  enviadaEn: Date | null;
  answered?: boolean;
}) {
  return (
    <div className="flex flex-col items-start gap-2">
      <NoticeStatusPill
        estado={estado}
        motivo={motivo}
        enviadaEn={enviadaEn}
        answered={answered}
      />
      {estado === "enviada" || answered ? null : (
        <ResendEscalationButton escalamientoId={escalamientoId} label={label} />
      )}
    </div>
  );
}

export function EscalationSection({
  escalations,
}: {
  escalations: readonly DetailEscalation[];
}) {
  const t = useTranslations("review.escalation");
  const format = useFormatter();

  if (escalations.length === 0) return null;

  const when = (date: Date) =>
    format.dateTime(date, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: BUSINESS_TIME_ZONE,
    });

  return (
    <Section id="escalation" title={t("section.title")}>
      <ul aria-label={t("section.title")} className="flex flex-col gap-6">
        {escalations.map((e) => (
          <li
            key={e.id}
            className="border-border flex flex-col gap-3 border-l-2 pl-4"
          >
            <dl className="grid gap-4 sm:grid-cols-2">
              <Fact label={t("section.fields.reason")}>
                {t(`reasons.${e.motivo}`)}
              </Fact>
              <Fact label={t("section.fields.escalated")}>
                {t("section.escalatedBy", {
                  name: e.autorNombre,
                  date: when(e.creadoEn),
                })}
              </Fact>
              <Fact label={t("section.fields.notice")}>
                <NoticeDelivery
                  escalamientoId={e.id}
                  label={`${t(`reasons.${e.motivo}`)}, ${when(e.creadoEn)}`}
                  estado={e.notificacionEstado}
                  motivo={e.notificacionMotivo}
                  enviadaEn={e.enviadaEn}
                  answered={e.respondidaEn !== null}
                />
              </Fact>
            </dl>
            <div className="flex flex-col gap-1">
              <span className="text-label text-muted-foreground">
                {t("section.fields.note")}
              </span>
              <p className="text-sm break-words whitespace-pre-wrap">
                {e.nota}
              </p>
            </div>
            {e.respondidaEn && e.respuesta ? (
              <div className="flex flex-col gap-1">
                <span className="text-label text-muted-foreground">
                  {t("section.fields.answer")}
                </span>
                <p className="text-sm break-words whitespace-pre-wrap">
                  {e.respuesta}
                </p>
                <span className="text-muted-foreground text-xs">
                  {t("section.answeredBy", {
                    name: e.respondidaPorNombre ?? "",
                    date: when(e.respondidaEn),
                  })}
                </span>
              </div>
            ) : (
              <p className="text-muted-foreground max-w-prose text-sm">
                {t("section.waiting")}
              </p>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}
