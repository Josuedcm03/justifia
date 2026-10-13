import { cn } from "cn";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { StatePill } from "@/app/(dashboard)/requests/state-pill";
import { useRequestDates } from "@/app/(dashboard)/requests/use-request-dates";
import { buttonVariants } from "@/components/ui/button";
import type { OwnRequestRow } from "@/lib/data/student-requests";

/**
 * One request of the student's list. A single stacked card serves every width,
 * so there is no second rendering to keep in step at 360 px (RNF-11). No
 * deadline is shown: the RN-08 clock is the secretary's concern.
 */
export function RequestCard({ request }: { request: OwnRequestRow }) {
  const t = useTranslations("requests.list");
  const tCauses = useTranslations("intake.causes");
  const dates = useRequestDates();
  const { id, estado, causa, fechaInicio, fechaFin, presentadaEn } = request;

  return (
    <li className="border-border bg-card shadow-soft flex flex-col gap-3 rounded-xl border p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-title">{t("number", { id })}</span>
        <StatePill estado={estado} />
      </div>
      <div className="flex flex-col gap-1 text-sm">
        {causa ? <span className="break-words">{tCauses(causa)}</span> : null}
        {fechaInicio && fechaFin ? (
          <span className="text-muted-foreground">
            {dates.period(fechaInicio, fechaFin)}
          </span>
        ) : null}
        {presentadaEn ? (
          <span className="text-muted-foreground">
            {t("presented", { date: dates.instant(presentadaEn) })}
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
