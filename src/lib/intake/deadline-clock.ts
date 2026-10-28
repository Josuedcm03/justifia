import { addBusinessDays, countBusinessDays } from "./business-days";
import { managuaToday } from "./dates";
import type { NonWorkingDaysProvider } from "./ports";

// RN-08 effective clock start (ES-5). Pure: the stored columns come in as plain
// values and the calendar is the injected `NonWorkingDaysProvider`. Time a
// request spends in coordination does not count toward the deadline, so the
// coordinator answer stores the shifted start in `PlazoInicioEn`; every reader
// then feeds the unchanged `deadlineOf` with the Managua date of that start.

/**
 * The three columns the effective start is read from. `plazoInicioEn` is
 * required, not optional: a reader that forgot to select it would ignore the
 * time a request spent in coordination and show a wrong deadline.
 */
export interface ClockRow {
  plazoInicioEn: Date | null;
  reenviadaEn: Date | null;
  presentadaEn: Date | null;
}

/** Managua midnight (UTC-6, no DST) of an ISO date, as an instant. */
function managuaMidnight(iso: string): Date {
  return new Date(`${iso}T06:00:00Z`);
}

/** `coalesce(PlazoInicioEn, ReenviadaEn, PresentadaEn)`; throws if all NULL. */
export function clockStartOf(row: ClockRow): Date {
  const start = row.plazoInicioEn ?? row.reenviadaEn ?? row.presentadaEn;
  if (start === null) throw new Error("Request has no clock start");
  return start;
}

/**
 * The `PlazoInicioEn` an answer must store, or `null` when no business day was
 * paused. `P` is the number of business days `d` with `E <= d < A` (Managua
 * dates of the escalation and the answer); the new start is the P-th business
 * day strictly after the current start date, at Managua midnight.
 */
export function pausedStartOnAnswer(
  input: { clockStart: Date; escalatedAt: Date; answeredAt: Date },
  calendar: NonWorkingDaysProvider,
): Date | null {
  const paused = countBusinessDays(
    managuaToday(input.escalatedAt),
    managuaToday(input.answeredAt),
    calendar,
  );
  if (paused === 0) return null;
  return managuaMidnight(
    addBusinessDays(managuaToday(input.clockStart), paused, calendar),
  );
}
