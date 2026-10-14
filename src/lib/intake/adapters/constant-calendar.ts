import type { NonWorkingDaysProvider } from "../ports";

/**
 * Constant adapter for the `NonWorkingDaysProvider` port (SR-5). It receives the
 * per-year ISO date lists as a parameter, so it is tested with fixture data and
 * never imports `calendar.ts`. A year with no entries (or an empty list) is not
 * "covered", which the queue surfaces as a muted note; it never blocks.
 */
export function constantCalendar(
  days: Readonly<Record<number, readonly string[]>>,
): NonWorkingDaysProvider {
  return {
    isNonWorkingDay(iso) {
      return days[Number(iso.slice(0, 4))]?.includes(iso) ?? false;
    },
    coversYear(year) {
      return (days[year]?.length ?? 0) > 0;
    },
  };
}
