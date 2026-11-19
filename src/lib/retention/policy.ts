// src/lib/retention/policy.ts — PURE. No db, no clock, no I/O, no "server-only":
// the due rule and the closed values the data module and the migration share.

export const RETENTION_YEARS = 5;
export const CANCELLED_TEXT = "[cancelado]";
export const CANCELLED_HASH = "!cancelado";
export const SYSTEM_LOGIN = "sistema";
export const SYSTEM_HASH = "!sistema-sin-clave";
export const RETENTION_REASON = "retencion_5_anios";

/** The anchor instant at or before which a student is due (D10): `now` minus
 *  five UTC years. A Feb 29 `now` has no such date five years back, so the
 *  cutoff clamps to Feb 28 at the same time of day: nobody is due early. */
export function retentionCutoff(now: Date): Date {
  const month = now.getUTCMonth();
  const year = now.getUTCFullYear() - RETENTION_YEARS;
  const existsInYear = new Date(Date.UTC(year, month, now.getUTCDate()));
  const day = existsInYear.getUTCMonth() === month ? now.getUTCDate() : 28;
  return new Date(
    Date.UTC(
      year,
      month,
      day,
      now.getUTCHours(),
      now.getUTCMinutes(),
      now.getUTCSeconds(),
      now.getUTCMilliseconds(),
    ),
  );
}

export function cancelledLogin(id: number): string {
  return `cancelado-${id}`;
}
