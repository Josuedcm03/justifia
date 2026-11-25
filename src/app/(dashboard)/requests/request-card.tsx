import { cn } from "cn";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { StatePill } from "@/app/(dashboard)/requests/state-pill";
import { useRequestDates } from "@/app/(dashboard)/requests/use-request-dates";
import { buttonVariants } from "@/components/ui/button";
import type { OwnRequestListItem } from "@/lib/data/student-requests";

/** How many subject codes the card names before it counts the rest. */
const SUBJECTS_SHOWN = 3;

/**
 * One request of the student's list. A single stacked card serves every width,
 * so there is no second rendering to keep in step at 360 px (RNF-11). No
 * deadline is shown: the RN-08 clock is the secretary's concern. The card
 * holds only the student's own data: the absence dates under their label with
 * the month name, the subject codes and, for a returned or rejected request,
 * the reason (FE-14, FE-15). An approved card shows no reason, whatever its
 * item carries (owner decision 2026-11-20).
 */
export function RequestCard({ request }: { request: OwnRequestListItem }) {
  const t = useTranslations("requests.list");
  const tDetail = useTranslations("requests.detail");
  const tCauses = useTranslations("intake.causes");
  const dates = useRequestDates();
  const {
    id,
    estado,
    causa,
    fechaInicio,
    fechaFin,
    presentadaEn,
    asignaturas,
    decision,
  } = request;

  const shown = asignaturas
    .slice(0, SUBJECTS_SHOWN)
    .map((subject) => subject.codigo)
    .join(", ");
  const hidden = asignaturas.length - SUBJECTS_SHOWN;
  const subjects =
    hidden > 0 ? t("moreSubjects", { codes: shown, count: hidden }) : shown;

  // The RN-17 label for a code the catalog knows, else the excerpt of the text.
  const reasonKey = `reasons.${decision?.motivoCodigo}`;
  const reason =
    estado === "devuelta" || estado === "rechazada"
      ? decision?.motivoCodigo && tDetail.has(reasonKey)
        ? tDetail(reasonKey)
        : decision?.texto
      : null;

  return (
    <li className="border-border bg-card shadow-soft flex flex-col gap-3 rounded-xl border p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-title">{t("number", { id })}</span>
        <StatePill estado={estado} />
      </div>
      <div className="flex flex-col gap-1 text-sm">
        {causa ? <span className="break-words">{tCauses(causa)}</span> : null}
        {fechaInicio && fechaFin ? (
          <span className="text-muted-foreground break-words">
            {t("absence", { period: dates.period(fechaInicio, fechaFin) })}
          </span>
        ) : null}
        {asignaturas.length > 0 ? (
          <span className="text-muted-foreground break-words">
            {t("subjects", { codes: subjects })}
          </span>
        ) : null}
        {presentadaEn ? (
          <span className="text-muted-foreground">
            {t("presented", { date: dates.instant(presentadaEn) })}
          </span>
        ) : null}
        {reason ? (
          <span className="line-clamp-2 break-words">
            {t("reason", { reason })}
          </span>
        ) : null}
      </div>
      <Link
        href={`/requests/${id}`}
        aria-label={t("viewNamed", { id })}
        className={cn(
          buttonVariants({ variant: "outline", size: "lg" }),
          "w-full sm:w-auto sm:self-start",
        )}
      >
        {t("view")}
      </Link>
    </li>
  );
}
