/**
 * Pure URL-parameter normalisation for the users list (design.md decision
 * 21). No React, no Next, no `@/db` — this is the seam Strict TDD can prove
 * with no database. The UPPER page bound needs `total` and therefore lives
 * in the data layer (`clampPage` in `@/lib/data/users`, decision 23). The
 * parsing itself is the generic module `@/lib/list-params`.
 */

import {
  firstValue,
  listHref,
  parsePage,
  parseQ,
  type RawSearchParams,
} from "@/lib/list-params";

export const USERS_PAGE_SIZE = 10;
export const USERS_SEARCH_MAX = 100;

export function parseUsersListParams(sp: RawSearchParams | undefined): {
  page: number;
  q: string;
} {
  const raw = sp ?? {};
  return {
    page: parsePage(firstValue(raw.page)),
    q: parseQ(firstValue(raw.q), USERS_SEARCH_MAX),
  };
}

/** The single place that knows the URL shape, so links and the form agree. */
export function usersListHref(params: { page?: number; q?: string }): string {
  return listHref("/users", params);
}
