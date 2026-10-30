// Code-side validation of a model answer (DE-10, RF-11 b). Pure: runs on every
// answer, whatever the source, and never trusts the model. Each field is
// recognized or not on its own; a field that is not recognized is `null`, shown
// to staff as "no reconocido". An all-null result is still a valid result.

import { addDays, isIsoDate } from "@/lib/intake/dates";

/** Widths of the `NombreEstudiante` and `Emisor` columns (DE-2). */
export const STUDENT_NAME_MAX_LENGTH = 160;
export const ISSUER_MAX_LENGTH = 200;

/** Days after the reference date that a rest end may still fall (decision 4). */
const REST_END_LOOKAHEAD_DAYS = 30;

/** Longest duration accepted when the document gives days and no dates. */
const MAX_REST_DAYS = 366;

const MS_PER_DAY = 86_400_000;

/** What the model may return, per key; the adapter's schema is looser still. */
export interface RawExtraction {
  student_name?: unknown;
  issuer?: unknown;
  issue_date?: unknown;
  rest_from?: unknown;
  rest_to?: unknown;
  rest_days?: unknown;
}

export interface ValidationContext {
  /**
   * Managua calendar date (`YYYY-MM-DD`) of `COALESCE(ReenviadaEn,
   * PresentadaEn)`, computed by the caller.
   */
  submittedOn: string;
}

export interface ValidatedFields {
  studentName: string | null;
  issuer: string | null;
  issueDate: string | null;
  restFrom: string | null;
  restTo: string | null;
  restDays: number | null;
}

/** Trim, collapse whitespace; empty or longer than the column becomes null. */
function cleanString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const collapsed = value.trim().replace(/\s+/g, " ");
  if (collapsed === "" || collapsed.length > maxLength) return null;
  return collapsed;
}

/** Same month and day one year earlier; 29 February maps to 28 February. */
function oneYearBefore(iso: string): string {
  const year = Number(iso.slice(0, 4)) - 1;
  const monthDay = iso.slice(5) === "02-29" ? "02-28" : iso.slice(5);
  return `${String(year).padStart(4, "0")}-${monthDay}`;
}

/** A real calendar date inside `[lower, upper]` (ISO strings sort by date). */
function dateWithin(value: unknown, lower: string, upper: string) {
  if (!isIsoDate(value)) return null;
  return value >= lower && value <= upper ? value : null;
}

type RestPeriod = Pick<ValidatedFields, "restFrom" | "restTo" | "restDays">;

const NO_REST: RestPeriod = { restFrom: null, restTo: null, restDays: null };

/** A value the model actually filled in (blank strings count as absent). */
function isPresent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  return typeof value !== "string" || value.trim() !== "";
}

/** A whole number, sent as a number or as a string of digits. */
function wholeNumber(value: unknown): number | null {
  const candidate =
    typeof value === "string" && /^\d+$/.test(value.trim())
      ? Number(value.trim())
      : value;
  return typeof candidate === "number" && Number.isInteger(candidate)
    ? candidate
    : null;
}

/** Calendar days from `from` to `to`, counting both ends. */
function inclusiveDays(from: string, to: string): number {
  const toUtc = (iso: string) =>
    Date.UTC(
      Number(iso.slice(0, 4)),
      Number(iso.slice(5, 7)) - 1,
      Number(iso.slice(8, 10)),
    );
  return Math.round((toUtc(to) - toUtc(from)) / MS_PER_DAY) + 1;
}

/**
 * Exactly two forms are recognized (spec "Code-side validation of fields"):
 * (a) both dates, from not after to, days computed here and the model's value
 * ignored; or (b) a whole number of days from 1 to 366 and no dates. Any other
 * combination, including a lone date, voids the whole period.
 */
function validateRestPeriod(
  raw: RawExtraction,
  submittedOn: string,
): RestPeriod {
  if (isPresent(raw.rest_from) || isPresent(raw.rest_to)) {
    const from = dateWithin(
      raw.rest_from,
      oneYearBefore(submittedOn),
      submittedOn,
    );
    const to = dateWithin(
      raw.rest_to,
      oneYearBefore(submittedOn),
      addDays(submittedOn, REST_END_LOOKAHEAD_DAYS),
    );
    if (from === null || to === null || to < from) return NO_REST;
    return { restFrom: from, restTo: to, restDays: inclusiveDays(from, to) };
  }

  const days = wholeNumber(raw.rest_days);
  if (days === null || days < 1 || days > MAX_REST_DAYS) return NO_REST;
  return { restFrom: null, restTo: null, restDays: days };
}

export function validateFields(
  raw: RawExtraction,
  ctx: ValidationContext,
): ValidatedFields {
  return {
    studentName: cleanString(raw.student_name, STUDENT_NAME_MAX_LENGTH),
    issuer: cleanString(raw.issuer, ISSUER_MAX_LENGTH),
    issueDate: dateWithin(
      raw.issue_date,
      oneYearBefore(ctx.submittedOn),
      ctx.submittedOn,
    ),
    ...validateRestPeriod(raw, ctx.submittedOn),
  };
}
