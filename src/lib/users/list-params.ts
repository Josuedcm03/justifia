/**
 * Pure URL-parameter normalisation for the users list (design.md decision
 * 21). No React, no Next, no `@/db` — this is the seam Strict TDD can prove
 * with no database. The UPPER page bound needs `total` and therefore lives
 * in the data layer (`clampPage` in `@/lib/data/users`, decision 23).
 */

export const USERS_PAGE_SIZE = 10;
export const USERS_SEARCH_MAX = 100;

type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Only plain ASCII digits count as a page number; anything else -> 1. */
function parsePage(raw: string | undefined): number {
  if (raw === undefined || !/^[0-9]+$/.test(raw)) return 1;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : 1;
}

function parseQ(raw: string | string[] | undefined): string {
  const first = firstValue(raw);
  if (typeof first !== "string") return "";
  const collapsed = first.trim().replace(/\s+/g, " ");
  return collapsed.slice(0, USERS_SEARCH_MAX);
}

export function parseUsersListParams(sp: RawSearchParams | undefined): {
  page: number;
  q: string;
} {
  const raw = sp ?? {};
  return {
    page: parsePage(firstValue(raw.page)),
    q: parseQ(raw.q),
  };
}

/** The single place that knows the URL shape, so links and the form agree. */
export function usersListHref(params: { page?: number; q?: string }): string {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.page && params.page > 1) search.set("page", String(params.page));
  const qs = search.toString();
  return qs ? `/users?${qs}` : "/users";
}
