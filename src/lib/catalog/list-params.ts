/**
 * Pure URL-state parsing for the catalog lists (design Decision 8, CM-LST-1).
 * `page`, `q` and `status` live in the query string; `status` defaults to
 * `active` and any unrecognised value falls back to it. No React, no Next,
 * no `@/db`.
 */

import type { CatalogStatusFilter } from "@/lib/catalog/types";
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
} from "@/lib/list-params";
import { USERS_SEARCH_MAX } from "@/lib/users/list-params";

/** Cap on the rows a select or combobox loads (design Decision 8). */
export const CATALOG_OPTIONS_MAX = 2000;
/** Cap on the Grupos listed on the Asignatura edit page (amendment A-AGS-1). */
export const ASIGNATURA_GRUPOS_MAX = 100;
/** Matching groups named on an Asignaturas search row; the rest are counted
 *  ("+N more", CM-ASG-9, assumption U10). */
export const ASIGNATURA_MATCHES_MAX = 3;

const DEFAULT_STATUS: CatalogStatusFilter = "active";

export type CatalogListBase = "/catalog/asignaturas" | "/catalog/docentes";

/** The sortable columns of each catalog list (CM-LST-1, DT-URL-1). The Groups
 *  column and every action column are deliberately absent. */
export const ASIGNATURAS_SORT_KEYS = [
  "code",
  "name",
  "hours",
  "status",
] as const;
export type AsignaturasSortKey = (typeof ASIGNATURAS_SORT_KEYS)[number];
export const DOCENTES_SORT_KEYS = ["name", "login", "email", "status"] as const;
export type DocentesSortKey = (typeof DOCENTES_SORT_KEYS)[number];

/** Today's orders: Asignaturas by Codigo, Docentes by name (the `id`
 *  tie-break is added by the query). */
export const ASIGNATURAS_DEFAULT_SORT: ListSort<AsignaturasSortKey> = {
  key: "code",
  dir: "asc",
};
export const DOCENTES_DEFAULT_SORT: ListSort<DocentesSortKey> = {
  key: "name",
  dir: "asc",
};

/** The URL state of one catalog list. */
export type CatalogListState<K extends string> = {
  page: number;
  q: string;
  status: CatalogStatusFilter;
  sort: ListSort<K>;
  size: PageSize;
};

const STATUS_VALUES: readonly CatalogStatusFilter[] = [
  "active",
  "inactive",
  "all",
];

function parseCatalogState<K extends string>(
  sp: RawSearchParams | undefined,
  keys: readonly K[],
  fallback: ListSort<K>,
): CatalogListState<K> {
  const raw = sp ?? {};
  return {
    page: parsePage(firstValue(raw.page)),
    q: parseQ(firstValue(raw.q), USERS_SEARCH_MAX),
    status: parseEnum(raw.status, STATUS_VALUES, DEFAULT_STATUS),
    sort: parseSort(raw.sort, raw.dir, keys, fallback),
    size: parsePageSize(raw.size),
  };
}

export function parseAsignaturasListParams(
  sp: RawSearchParams | undefined,
): CatalogListState<AsignaturasSortKey> {
  return parseCatalogState(sp, ASIGNATURAS_SORT_KEYS, ASIGNATURAS_DEFAULT_SORT);
}

export function parseDocentesListParams(
  sp: RawSearchParams | undefined,
): CatalogListState<DocentesSortKey> {
  return parseCatalogState(sp, DOCENTES_SORT_KEYS, DOCENTES_DEFAULT_SORT);
}

type SortKeyFor<B extends CatalogListBase> = B extends "/catalog/asignaturas"
  ? AsignaturasSortKey
  : DocentesSortKey;

const DEFAULT_SORT_FOR: Record<CatalogListBase, ListSort<string>> = {
  "/catalog/asignaturas": ASIGNATURAS_DEFAULT_SORT,
  "/catalog/docentes": DOCENTES_DEFAULT_SORT,
};

/** The single place that knows the catalog list URL shape. Every default
 *  (page 1, empty `q`, `status=active`, the list's default sort, size 10) is
 *  omitted; `sort` and `dir` are written together, between `status` and
 *  `size`. A link that changes anything but the page is built without
 *  `page`, so the page resets. */
export function catalogListHref<B extends CatalogListBase>(
  base: B,
  p: {
    page?: number;
    q?: string;
    status?: CatalogStatusFilter;
    sort?: ListSort<SortKeyFor<B>>;
    size?: PageSize;
  },
): string {
  const extra: Record<string, string> = {};
  if (p.status && p.status !== DEFAULT_STATUS) extra.status = p.status;
  const fallback = DEFAULT_SORT_FOR[base];
  if (p.sort && (p.sort.key !== fallback.key || p.sort.dir !== fallback.dir)) {
    extra.sort = p.sort.key;
    extra.dir = p.sort.dir;
  }
  if (p.size && p.size !== DEFAULT_PAGE_SIZE) extra.size = String(p.size);
  return listHref(base, { page: p.page, q: p.q, extra });
}
