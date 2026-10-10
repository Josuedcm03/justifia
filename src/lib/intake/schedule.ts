// Pure weekday logic behind the weekday schedule adapter (F.4, RN-22). Dates
// are plain ISO `YYYY-MM-DD` America/Managua calendar dates; all arithmetic
// runs in UTC so the host zone never matters.

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

function toUtcMs(iso: string): number {
  const [, y, m, d] = iso.match(ISO_DATE) ?? [];
  return Date.UTC(Number(y), Number(m) - 1, Number(d));
}

/**
 * Bit index of the weekday of an ISO date: Monday = 0 ... Sunday = 6, equal to
 * Postgres `isodow - 1` and to the position in `DIAS_SEMANA`.
 */
export function isoWeekdayIndex(iso: string): number {
  const sundayFirst = new Date(toUtcMs(iso)).getUTCDay();
  return (sundayFirst + 6) % 7;
}

/**
 * True when a group with day mask `mask` meets on at least one date of the
 * inclusive range. Mask `0` means "days not recorded" and counts as having
 * class, so a subject is never hidden for lack of data.
 */
export function hasClassInRange(
  mask: number,
  range: { from: string; to: string },
): boolean {
  if (mask === 0) return true;
  const first = toUtcMs(range.from);
  const last = toUtcMs(range.to);
  // A span of a full week or more visits every weekday: stop after 7 dates.
  const days = Math.min(Math.floor((last - first) / MS_PER_DAY) + 1, 7);
  for (let offset = 0; offset < days; offset++) {
    const iso = new Date(first + offset * MS_PER_DAY)
      .toISOString()
      .slice(0, 10);
    if ((mask & (1 << isoWeekdayIndex(iso))) !== 0) return true;
  }
  return false;
}
