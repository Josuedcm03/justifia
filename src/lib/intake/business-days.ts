import { addDays } from "./dates";
import type { NonWorkingDaysProvider } from "./ports";

// RN-08 business-day clock (SR-5). Pure: dates are Managua `YYYY-MM-DD` strings
// (the caller derives them with `managuaToday`) and holidays come from the
// injected `NonWorkingDaysProvider`. A business day is Monday to Friday that is
// not a listed non-working day. The deadline is computed on read; an answer
// from the career coordination stores the shifted start (ES-5).

/** Business days allowed to remit a request, counted after the start date. */
const BUSINESS_DAYS_TO_REMIT = 2;

export type DeadlineStatus = "en_plazo" | "por_vencer" | "vencida";

function isWeekend(iso: string): boolean {
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

function isBusinessDay(iso: string, calendar: NonWorkingDaysProvider): boolean {
  return !isWeekend(iso) && !calendar.isNonWorkingDay(iso);
}

/** First business day strictly after `iso`. */
function nextBusinessDay(
  iso: string,
  calendar: NonWorkingDaysProvider,
): string {
  let day = addDays(iso, 1);
  while (!isBusinessDay(day, calendar)) day = addDays(day, 1);
  return day;
}

/**
 * The 2nd business day strictly after the clock start date; due at the end of
 * that day. A weekend or holiday start therefore counts from the next business
 * day (presented Saturday: Monday is day 1, Tuesday is the deadline).
 */
export function deadlineOf(
  start: string,
  calendar: NonWorkingDaysProvider,
): string {
  let day = start;
  for (let i = 0; i < BUSINESS_DAYS_TO_REMIT; i += 1) {
    day = nextBusinessDay(day, calendar);
  }
  return day;
}

/**
 * `vencida` once `today` is after the deadline; `por_vencer` when at most one
 * business day remains after today; otherwise `en_plazo` (RF-06 b).
 */
export function deadlineStatus(
  start: string,
  today: string,
  calendar: NonWorkingDaysProvider,
): { status: DeadlineStatus; deadline: string } {
  const deadline = deadlineOf(start, calendar);
  if (today > deadline) return { status: "vencida", deadline };

  let remaining = 0;
  for (let day = addDays(today, 1); day <= deadline; day = addDays(day, 1)) {
    if (isBusinessDay(day, calendar)) remaining += 1;
  }
  return {
    status: remaining <= 1 ? "por_vencer" : "en_plazo",
    deadline,
  };
}

/**
 * Business days `d` with `from <= d < to` (RN-08 pause): the escalation day
 * counts, the answer day does not. Zero when `to` is not after `from`.
 */
export function countBusinessDays(
  from: string,
  to: string,
  calendar: NonWorkingDaysProvider,
): number {
  let count = 0;
  for (let day = from; day < to; day = addDays(day, 1)) {
    if (isBusinessDay(day, calendar)) count += 1;
  }
  return count;
}

/** The `days`-th business day strictly after `start`; `start` itself for 0. */
export function addBusinessDays(
  start: string,
  days: number,
  calendar: NonWorkingDaysProvider,
): string {
  let day = start;
  for (let i = 0; i < days; i += 1) day = nextBusinessDay(day, calendar);
  return day;
}
