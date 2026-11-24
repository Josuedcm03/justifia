/**
 * Pure URL-state parsing for the catalog lists (design Decision 8, CM-LST-1).
 * `page`, `q` and `status` live in the query string; `status` defaults to
 * `active` and any unrecognised value falls back to it. No React, no Next,
 * no `@/db`.
 */

import type {
  CatalogStatusFilter,
  InscripcionStatusFilter,
} from "@/lib/catalog/types";
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

/** Longest stored `Grupo.Periodo` and `Grupo.NumeroGrupo` (VARCHAR(12)). */
const INSCRIPCION_PERIODO_MAX = 12;
const INSCRIPCION_GRUPO_MAX = 12;

export type CatalogListBase =
  "/catalog/asignaturas" | "/catalog/docentes" | "/catalog/inscripciones";

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
export const INSCRIPCIONES_SORT_KEYS = ["student", "subject", "group"] as const;
export type InscripcionesSortKey = (typeof INSCRIPCIONES_SORT_KEYS)[number];

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
export const INSCRIPCIONES_DEFAULT_SORT: ListSort<InscripcionesSortKey> = {
  key: "student",
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

/** The URL state of the inscripciones list (EA-FILT-1). `periodo` is "" when
 *  unset, which means the latest period; the data layer resolves it. */
export type InscripcionesListState = {
  page: number;
  q: string;
  asignatura: string;
  grupo: string;
  periodo: string;
  status: InscripcionStatusFilter;
  sort: ListSort<InscripcionesSortKey>;
  size: PageSize;
};

const DEFAULT_INSCRIPCION_STATUS: InscripcionStatusFilter = "active";
const INSCRIPCION_STATUS_VALUES: readonly InscripcionStatusFilter[] = [
  "active",
  "inactive",
];

export function parseInscripcionesListParams(
  sp: RawSearchParams | undefined,
): InscripcionesListState {
  const raw = sp ?? {};
  return {
    page: parsePage(firstValue(raw.page)),
    q: parseQ(firstValue(raw.q), USERS_SEARCH_MAX),
    asignatura: parseQ(raw.asignatura, USERS_SEARCH_MAX),
    grupo: parseQ(raw.grupo, INSCRIPCION_GRUPO_MAX),
    periodo: parseQ(raw.periodo, INSCRIPCION_PERIODO_MAX),
    status: parseEnum(
      raw.status,
      INSCRIPCION_STATUS_VALUES,
      DEFAULT_INSCRIPCION_STATUS,
    ),
    sort: parseSort(
      raw.sort,
      raw.dir,
      INSCRIPCIONES_SORT_KEYS,
      INSCRIPCIONES_DEFAULT_SORT,
    ),
    size: parsePageSize(raw.size),
  };
}

type SortKeyFor<B extends CatalogListBase> = B extends "/catalog/asignaturas"
  ? AsignaturasSortKey
  : B extends "/catalog/inscripciones"
    ? InscripcionesSortKey
    : DocentesSortKey;

type StatusFor<B extends CatalogListBase> = B extends "/catalog/inscripciones"
  ? InscripcionStatusFilter
  : CatalogStatusFilter;

/** The filters only the inscripciones list has; "" or absent is the default. */
type InscripcionesFilters = {
  asignatura?: string;
  grupo?: string;
  periodo?: string;
};

const DEFAULT_SORT_FOR: Record<CatalogListBase, ListSort<string>> = {
  "/catalog/asignaturas": ASIGNATURAS_DEFAULT_SORT,
  "/catalog/docentes": DOCENTES_DEFAULT_SORT,
  "/catalog/inscripciones": INSCRIPCIONES_DEFAULT_SORT,
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
    status?: StatusFor<B>;
    sort?: ListSort<SortKeyFor<B>>;
    size?: PageSize;
  } & (B extends "/catalog/inscripciones" ? InscripcionesFilters : unknown),
): string {
  const extra: Record<string, string> = {};
  // Only the inscripciones base types these three keys; the others never carry
  // them, so reading them off `p` is a no-op there.
  const filters = p as InscripcionesFilters;
  if (filters.asignatura) extra.asignatura = filters.asignatura;
  if (filters.grupo) extra.grupo = filters.grupo;
  if (filters.periodo) extra.periodo = filters.periodo;
  if (p.status && p.status !== DEFAULT_STATUS) extra.status = p.status;
  const fallback = DEFAULT_SORT_FOR[base];
  if (p.sort && (p.sort.key !== fallback.key || p.sort.dir !== fallback.dir)) {
    extra.sort = p.sort.key;
    extra.dir = p.sort.dir;
  }
  if (p.size && p.size !== DEFAULT_PAGE_SIZE) extra.size = String(p.size);
  return listHref(base, { page: p.page, q: p.q, extra });
}
