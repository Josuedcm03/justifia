"use client";

import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";

import { startsAfterToday } from "@/app/(dashboard)/requests/new/steps";

/**
 * Informational notice for a start date that is still ahead (FE-19). It is a
 * note, not an alert: future dates are valid (RN-05, RN-23), so it blocks
 * nothing, is no field error and uses the warning tokens with words, never
 * colour alone.
 */
export function FutureStartNotice() {
  const t = useTranslations("intake.datesRecap");

  return (
    <p
      role="note"
      className="border-warning/30 border-l-warning bg-warning/8 text-warning-ink rounded-lg border border-l-4 px-3 py-2 text-sm break-words"
    >
      {t("futureStart")}
    </p>
  );
}

/**
 * The dates of the absence, read only, at the top of the subjects and documents
 * steps (FE-18, RF-01). The dates are plain calendar days: each one is read as
 * midnight UTC and formatted in UTC, so the host zone never moves it (the
 * pattern of `use-request-dates.ts`). With a `today`, a start that is still
 * ahead carries the notice of FE-19.
 */
export function DatesRecap({
  range,
  today,
  editHref,
}: {
  range: { from: string; to: string };
  /** The Managua calendar day, from the server; absent means no notice. */
  today?: string;
  editHref: string;
}) {
  const t = useTranslations("intake.datesRecap");
  const format = useFormatter();

  const day = (iso: string) =>
    format.dateTime(new Date(`${iso}T00:00:00Z`), {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  const period =
    range.from === range.to
      ? day(range.from)
      : t("range", { start: day(range.from), end: day(range.to) });

  return (
    <div className="border-border flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-muted-foreground text-xs font-medium">
            {t("label")}
          </p>
          <p className="text-sm break-words">{period}</p>
        </div>
        <Link
          href={editHref}
          className="text-primary inline-flex min-h-11 items-center text-sm underline underline-offset-4"
        >
          {t("edit")}
        </Link>
      </div>
      {today !== undefined && startsAfterToday(range, today) ? (
        <FutureStartNotice />
      ) : null}
    </div>
  );
}
