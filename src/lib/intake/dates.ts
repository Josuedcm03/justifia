// Calendar-date helpers (A6, RN-05, RN-23). Absence dates are plain ISO
// `YYYY-MM-DD` strings with no time zone; only "today" depends on the business
// zone (America/Managua, UTC-6, no DST). All arithmetic runs in UTC so the
// host zone never matters.

const BUSINESS_TIME_ZONE = "America/Managua";
const MS_PER_DAY = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const managuaFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Managua calendar date of an instant, as `YYYY-MM-DD`. */
export function managuaToday(now: Date): string {
  return managuaFormat.format(now);
}

function toUtcMs(iso: string): number {
  const [, y, m, d] = iso.match(ISO_DATE) ?? [];
  return Date.UTC(Number(y), Number(m) - 1, Number(d));
}

export function addDays(iso: string, days: number): string {
  return new Date(toUtcMs(iso) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/**
 * Days of an inclusive calendar range: the same day is 1 (RN-10). `from` and
 * `to` are real ISO dates with `from <= to`; the caller has validated them.
 */
export function inclusiveDays(from: string, to: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / MS_PER_DAY) + 1;
}

/**
 * RN-23: earliest end date a submission made on `today` may carry, with the
 * filing window in force (`windowDays`, a parameter).
 */
export function earliestAllowedEndDate(
  today: string,
  windowDays: number,
): string {
  return addDays(today, -windowDays);
}

/** RN-23: exactly `windowDays` before submission is still allowed. */
export function isEndWithinWindow(
  end: string,
  today: string,
  windowDays: number,
): boolean {
  return end >= earliestAllowedEndDate(today, windowDays);
}

/** True for a well-formed, real calendar date (rejects 2026-02-30). */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  return new Date(toUtcMs(value)).toISOString().slice(0, 10) === value;
}
