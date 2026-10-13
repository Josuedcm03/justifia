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

/** The page sizes a list offers; anything else in the URL is the default
 *  (DT-URL-1, decision D11). */
export const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 10;

export type SortDir = "asc" | "desc";
export type ListSort<K extends string> = { key: K; dir: SortDir };
export type StatusFilterValue = "active" | "inactive" | "all";

/** Exact, case-sensitive match against a closed set. An array (repeated
 *  parameter), an unknown value, a different case or an empty string is the
 *  fallback. Never throws. */
export function parseEnum<T extends string>(
  raw: string | string[] | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  if (typeof raw !== "string") return fallback;
  return allowed.find((value) => value === raw) ?? fallback;
}

/** Only the literal strings "10", "25" and "50" are honoured. `010`, `1e1`,
 *  `10.5`, padded or signed values and arrays all fall back to 10. */
export function parsePageSize(raw: string | string[] | undefined): PageSize {
  if (typeof raw !== "string") return DEFAULT_PAGE_SIZE;
  return (
    PAGE_SIZE_OPTIONS.find((option) => String(option) === raw) ??
    DEFAULT_PAGE_SIZE
  );
}

/** `sort` and `dir` resolve together (DT-URL-1): a valid `sort` takes a valid
 *  `dir` or ascending; an invalid or missing `sort` is the list's default pair
 *  and `dir` is ignored. The result is always a fresh object. */
export function parseSort<K extends string>(
  rawSort: string | string[] | undefined,
  rawDir: string | string[] | undefined,
  keys: readonly K[],
  fallback: ListSort<K>,
): ListSort<K> {
  const key =
    typeof rawSort === "string"
      ? keys.find((candidate) => candidate === rawSort)
      : undefined;
  if (key === undefined) return { key: fallback.key, dir: fallback.dir };
  return { key, dir: parseEnum<SortDir>(rawDir, ["asc", "desc"], "asc") };
}

/** Header activation: the same key flips, a new key starts ascending. */
export function nextSort<K extends string>(
  current: ListSort<K>,
  key: K,
): ListSort<K> {
  if (current.key === key) {
    return { key, dir: current.dir === "asc" ? "desc" : "asc" };
  }
  return { key, dir: "asc" };
}

/** The one reset rule (DT-URL-2): any change that is not a page change returns
 *  to page 1; a page-only change keeps everything else. Pure. */
export function applyListChange<S extends { page: number }>(
  state: S,
  change: Partial<S>,
): S {
  const changesView = Object.keys(change).some((key) => key !== "page");
  return changesView
    ? { ...state, ...change, page: 1 }
    : { ...state, ...change };
}
