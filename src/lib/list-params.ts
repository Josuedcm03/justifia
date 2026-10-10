/**
 * Generic URL-parameter helpers shared by every paginated list (users and the
 * catalog screens). Pure: no React, no Next, no `@/db`. The UPPER page bound
 * needs `total` and therefore lives in the data layer (`clampPage`).
 */

export type RawSearchParams = Record<string, string | string[] | undefined>;

export function firstValue(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Only plain ASCII digits count as a page number; anything else -> 1. An
 *  array value is not a single page, so it falls back to 1 as well. */
export function parsePage(raw: string | string[] | undefined): number {
  if (typeof raw !== "string" || !/^[0-9]+$/.test(raw)) return 1;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : 1;
}

/** Trims, collapses whitespace and caps the term; an array or a missing value
 *  is an empty term. Wildcards are left alone (escaped at the query layer). */
export function parseQ(
  raw: string | string[] | undefined,
  max: number,
): string {
  if (typeof raw !== "string") return "";
  return raw.trim().replace(/\s+/g, " ").slice(0, max);
}

/** The single place that knows the URL shape, so links and forms agree.
 *  Defaults (empty `q`, page 1) are omitted; `extra` entries are written
 *  between `q` and `page` and the caller decides which of them are defaults. */
export function listHref(
  base: string,
  params: { page?: number; q?: string; extra?: Record<string, string> },
): string {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  for (const [key, value] of Object.entries(params.extra ?? {})) {
    search.set(key, value);
  }
  if (params.page && params.page > 1) search.set("page", String(params.page));
  const qs = search.toString();
  return qs ? `${base}?${qs}` : base;
}
