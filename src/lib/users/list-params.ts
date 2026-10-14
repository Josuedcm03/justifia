/**
 * Pure URL-parameter normalisation for the users list (design.md decision
 * 21). No React, no Next, no `@/db` — this is the seam Strict TDD can prove
 * with no database. The UPPER page bound needs `total` and therefore lives
 * in the data layer (`clampPage` in `@/lib/data/users`, decision 23). The
 * parsing itself is the generic module `@/lib/list-params`.
 *
 * URL contract (DT-URL-1): `q`, `status`, `sort`, `dir`, `size`, `page`, in
 * that canonical order, every default omitted.
 */

import {
  DEFAULT_PAGE_SIZE,
  firstValue,
  listHref,
  parseEnum,
  parsePage,
  parsePageSize,
  parseQ,
  parseSort,
  type ListSort,
  type PageSize,
  type RawSearchParams,
  type StatusFilterValue,
} from "@/lib/list-params";

export const USERS_PAGE_SIZE = DEFAULT_PAGE_SIZE;
export const USERS_SEARCH_MAX = 100;

export const USERS_SORT_KEYS = [
  "name",
  "login",
  "role",
  "status",
  "created",
] as const;
export type UsersSortKey = (typeof USERS_SORT_KEYS)[number];

/** Today's order: newest first (the `Id` tie-break is added by the query). */
export const USERS_DEFAULT_SORT: ListSort<UsersSortKey> = {
  key: "created",
  dir: "desc",
};

/** The users list shows both states unless the viewer narrows it (D10). */
const USERS_DEFAULT_STATUS: StatusFilterValue = "all";
const STATUS_VALUES: readonly StatusFilterValue[] = [
  "active",
  "inactive",
  "all",
];

export type UsersListState = {
  page: number;
  q: string;
  status: StatusFilterValue;
  sort: ListSort<UsersSortKey>;
  size: PageSize;
};

export function parseUsersListParams(
  sp: RawSearchParams | undefined,
): UsersListState {
  const raw = sp ?? {};
  return {
    page: parsePage(firstValue(raw.page)),
    q: parseQ(firstValue(raw.q), USERS_SEARCH_MAX),
    status: parseEnum(raw.status, STATUS_VALUES, USERS_DEFAULT_STATUS),
    sort: parseSort(raw.sort, raw.dir, USERS_SORT_KEYS, USERS_DEFAULT_SORT),
    size: parsePageSize(raw.size),
  };
}

/** The single place that knows the URL shape, so links and the form agree.
 *  Every default is omitted; `sort` and `dir` are written together or not at
 *  all, between `status` and `size`. */
export function usersListHref(params: Partial<UsersListState>): string {
  const extra: Record<string, string> = {};
  if (params.status && params.status !== USERS_DEFAULT_STATUS) {
    extra.status = params.status;
  }
  const { sort } = params;
  if (
    sort &&
    (sort.key !== USERS_DEFAULT_SORT.key || sort.dir !== USERS_DEFAULT_SORT.dir)
  ) {
    extra.sort = sort.key;
    extra.dir = sort.dir;
  }
  if (params.size && params.size !== DEFAULT_PAGE_SIZE) {
    extra.size = String(params.size);
  }
  return listHref("/users", { q: params.q, page: params.page, extra });
}
