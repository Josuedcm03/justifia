import { useFormatter, useTranslations } from "next-intl";

import { BUSINESS_TIME_ZONE } from "@/app/(dashboard)/review/queue-parts";
import type { DetailEscalation } from "@/lib/data/solicitud-detail";
import { isEscalationReason } from "@/lib/intake/escalation";

// The coordination answer at the top of the staff detail (FE-3, RF-16 c, RF-10
// a). The answer already shows inside the escalations section, far down a long
// page; the secretary returns to a `pendiente` request to read it, so the
// detail repeats it first. Staff only: only the staff detail imports this
// module. It is text, never colour alone, and offers no action; the link only
// moves to the full escalation. Sync component, like the other sections: text,
// dates and times resolve on the server in the business zone.

/** The `dateTime` options of every answer date and time (America/Managua). */
export const ANSWER_DATE_OPTIONS = {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: BUSINESS_TIME_ZONE,
} as const;

/** What the banner, the decision copy and the escalate dialog quote. */
export type CoordinationAnswer = {
  text: string;
  authorName: string;
  answeredAt: Date;
};

/** The part of an escalation record that `latestAnswer` reads. */
export type AnswerSource = Pick<
  DetailEscalation,
  "respuesta" | "respondidaPorNombre" | "respondidaEn"
> & {
  /** A string, so a notice that slipped through is recognised and skipped. */
  motivo: string;
};

/**
 * The answer of the most recent escalation that coordination answered, or
 * `null`. The records come oldest first. Only an escalation motive can carry
 * the answer: a notice (`exceso_inasistencias`) is never one. An answer is a
 * text and a time together; half of that pair is not an answer.
 */
export function latestAnswer(
  escalations: readonly AnswerSource[],
): CoordinationAnswer | null {
  for (let i = escalations.length - 1; i >= 0; i--) {
    const escalation = escalations[i];
    if (
      isEscalationReason(escalation.motivo) &&
      escalation.respuesta &&
      escalation.respondidaEn
    ) {
      return {
        text: escalation.respuesta,
        authorName: escalation.respondidaPorNombre ?? "",
        answeredAt: escalation.respondidaEn,
      };
    }
  }
  return null;
}

export function AnswerBanner({ answer }: { answer: CoordinationAnswer }) {
  const t = useTranslations("review.detail.answerBanner");
  const format = useFormatter();

  return (
    <section
      aria-labelledby="answer-banner-title"
      className="border-border border-l-primary bg-primary/5 shadow-soft flex flex-col gap-3 rounded-xl border border-l-4 p-6"
    >
      <h2 id="answer-banner-title" className="text-headline">
        {t("title")}
      </h2>
      <p className="text-sm break-words whitespace-pre-wrap">{answer.text}</p>
      <p className="text-muted-foreground text-xs">
        {t("byline", {
          name: answer.authorName,
          date: format.dateTime(answer.answeredAt, ANSWER_DATE_OPTIONS),
        })}
      </p>
      <p className="text-muted-foreground text-sm">{t("hint")}</p>
      <a
        href="#escalation-title"
        className="text-primary inline-flex min-h-11 w-fit items-center font-medium underline underline-offset-4"
      >
        {t("link")}
      </a>
    </section>
  );
}
