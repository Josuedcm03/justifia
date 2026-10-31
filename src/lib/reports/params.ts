import { PERIODO_RE } from "@/lib/import/normalize";
import { CAUSAS, type Causa } from "@/lib/intake/causes";
import {
  listHref,
  parsePage,
  parseQ,
  type RawSearchParams,
} from "@/lib/list-params";

// URL parameters of the coordination reports (CR-6). Pure: no React, no Next,
// no `@/db`. The page resolves `latest` to a concrete code (or null when there
// is no data) before querying, so every outgoing href carries a resolved period.

/** What the URL asked for. `latest` is the default and is never written back. */
export type PeriodFilter =
  { kind: "all" } | { kind: "code"; periodo: string } | { kind: "latest" };

/** A period the page has resolved: what hrefs and queries carry. */
export type ResolvedPeriod = Exclude<PeriodFilter, { kind: "latest" }>;

/** The longest student term the detail filter keeps. */
const SEARCH_MAX = 100;

export type ReportParams = {
  period: PeriodFilter;
  /** A teacher id (`Usuario.Id`), or null for every teacher. */
  docenteId: number | null;
  /** One of the five causes, or null for every cause. */
  causa: Causa | null;
  /** Contains-match on the student name or CIF; empty means no filter. */
  q: string;
  page: number;
};

/**
 * `period=all` -> every period; a code of `PERIODO_RE` -> that period; anything
 * else (absent, empty, repeated, malformed, other case) -> the default. A
 * well-formed code absent from the options is kept: the query returns zero rows.
 * The detail filters ignore any value they cannot read (CR-DET-2).
 */
export function parseReportParams(raw: RawSearchParams): ReportParams {
  return {
    period: parsePeriod(raw.period),
    docenteId: parseDocente(raw.docente),
    causa: parseCausa(raw.causa),
    q: parseQ(raw.q, SEARCH_MAX),
    page: parsePage(raw.page),
  };
}

function parsePeriod(raw: string | string[] | undefined): PeriodFilter {
  if (typeof raw !== "string") return { kind: "latest" };
  if (raw === "all") return { kind: "all" };
  return PERIODO_RE.test(raw)
    ? { kind: "code", periodo: raw }
    : { kind: "latest" };
}

function parseDocente(raw: string | string[] | undefined): number | null {
  if (typeof raw !== "string" || !/^[1-9]\d*$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) ? id : null;
}

function parseCausa(raw: string | string[] | undefined): Causa | null {
  if (typeof raw !== "string") return null;
  return CAUSAS.find((causa) => causa === raw) ?? null;
}

/**
 * The detail has no hidden default (CR-DET-2): where the dashboard falls back to
 * its newest period, the detail lists every period.
 */
export function detailPeriod(period: PeriodFilter): ResolvedPeriod {
  return period.kind === "latest" ? { kind: "all" } : period;
}

/** The dashboard URL for a resolved period, so screen and links agree. */
export function reportsHref(period: ResolvedPeriod): string {
  const value = period.kind === "all" ? "all" : period.periodo;
  return `/reports?${new URLSearchParams({ period: value }).toString()}`;
}

/** The filters of the detail as the page resolved them. */
export type DetailQuery = {
  period: ResolvedPeriod;
  docenteId: number | null;
  causa: Causa | null;
  q: string;
};

/** The query-string pairs of resolved filters, shared by the detail and the file. */
function filterParams(query: DetailQuery): Record<string, string> {
  const extra: Record<string, string> = {
    period: query.period.kind === "all" ? "all" : query.period.periodo,
  };
  if (query.docenteId !== null) extra.docente = String(query.docenteId);
  if (query.causa !== null) extra.causa = query.causa;
  return extra;
}

/**
 * The detail URL for resolved filters (CR-6): the resolved period is always
 * written so the screen and the file query the same period; empty filters and
 * page 1 are left out.
 */
export function requestsReportHref(query: DetailQuery, page = 1): string {
  return listHref("/reports/requests", {
    q: query.q,
    page,
    extra: filterParams(query),
  });
}

/** The workbook route for the same resolved filters; it never pages (CR-XLS-2). */
export function exportHref(query: DetailQuery): string {
  return listHref("/api/reports/justifications", {
    q: query.q,
    extra: filterParams(query),
  });
}
