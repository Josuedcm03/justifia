import { useFormatter, useTranslations } from "next-intl";

// Dates of the student screens. Instants are shown in the business zone, not the
// server's; the absence dates are plain calendar days, shown as they are.
const BUSINESS_TIME_ZONE = "America/Managua";

export function useRequestDates() {
  const format = useFormatter();
  const t = useTranslations("requests");
  const day = (iso: string) =>
    format.dateTime(new Date(`${iso}T00:00:00Z`), {
      dateStyle: "medium",
      timeZone: "UTC",
    });

  return {
    instant: (date: Date) =>
      format.dateTime(date, {
        dateStyle: "medium",
        timeZone: BUSINESS_TIME_ZONE,
      }),
    period: (start: string, end: string) =>
      start === end
        ? day(start)
        : t("period", { start: day(start), end: day(end) }),
  };
}
