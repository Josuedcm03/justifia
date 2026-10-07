/**
 * Pure URL-state parsing for the catalog lists (design Decision 8, CM-LST-1).
 * `page`, `q` and `status` live in the query string; `status` defaults to
 * `active` and any unrecognised value falls back to it. No React, no Next,
 * no `@/db`.
 */

import type { CatalogStatusFilter } from "@/lib/catalog/types";
import {
  listHref,
  parsePage,
  parseQ,
  type RawSearchParams,
} from "@/lib/list-params";
import { USERS_PAGE_SIZE, USERS_SEARCH_MAX } from "@/lib/users/list-params";

/** Same page size as `/users` (CM-LST-1, amendment A-4); derived so the two
 *  cannot drift apart. */
export const CATALOG_PAGE_SIZE = USERS_PAGE_SIZE;
/** Cap on the rows a select or combobox loads (design Decision 8). */
export const CATALOG_OPTIONS_MAX = 2000;

const DEFAULT_STATUS: CatalogStatusFilter = "active";

/** Exact, case-sensitive match; an array or anything else is the default. */
function parseStatus(raw: string | string[] | undefined): CatalogStatusFilter {
  return raw === "active" || raw === "inactive" || raw === "all"
    ? raw
    : DEFAULT_STATUS;
}

export function parseCatalogListParams(sp: RawSearchParams | undefined): {
  page: number;
  q: string;
  status: CatalogStatusFilter;
} {
  const raw = sp ?? {};
  return {
    page: parsePage(raw.page),
    q: parseQ(raw.q, USERS_SEARCH_MAX),
    status: parseStatus(raw.status),
  };
}

export type CatalogListBase =
  "/catalog/asignaturas" | "/catalog/grupos" | "/catalog/docentes";

/** The single place that knows the catalog list URL shape. Defaults (page 1,
 *  empty `q`, `status=active`) are omitted. A link that changes `q` or
 *  `status` is built without `page`, so the page resets. */
export function catalogListHref(
  base: CatalogListBase,
  p: { page?: number; q?: string; status?: CatalogStatusFilter },
): string {
  const extra: Record<string, string> =
    p.status && p.status !== DEFAULT_STATUS ? { status: p.status } : {};
  return listHref(base, { page: p.page, q: p.q, extra });
}
