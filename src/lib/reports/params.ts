import { PERIODO_RE } from "@/lib/import/normalize";
import type { RawSearchParams } from "@/lib/list-params";

// URL parameters of the coordination reports (CR-6). Pure: no React, no Next,
// no `@/db`. The page resolves `latest` to a concrete code (or null when there
// is no data) before querying, so every outgoing href carries a resolved period.

/** What the URL asked for. `latest` is the default and is never written back. */
export type PeriodFilter =
  { kind: "all" } | { kind: "code"; periodo: string } | { kind: "latest" };

/** A period the page has resolved: what hrefs and queries carry. */
export type ResolvedPeriod = Exclude<PeriodFilter, { kind: "latest" }>;

export type ReportParams = { period: PeriodFilter };

/**
 * `period=all` -> every period; a code of `PERIODO_RE` -> that period; anything
 * else (absent, empty, repeated, malformed, other case) -> the default. A
 * well-formed code absent from the options is kept: the query returns zero rows.
 */
export function parseReportParams(raw: RawSearchParams): ReportParams {
  return { period: parsePeriod(raw.period) };
}

function parsePeriod(raw: string | string[] | undefined): PeriodFilter {
  if (typeof raw !== "string") return { kind: "latest" };
  if (raw === "all") return { kind: "all" };
  return PERIODO_RE.test(raw)
    ? { kind: "code", periodo: raw }
    : { kind: "latest" };
}

/** The dashboard URL for a resolved period, so screen and links agree. */
export function reportsHref(period: ResolvedPeriod): string {
  const value = period.kind === "all" ? "all" : period.periodo;
  return `/reports?${new URLSearchParams({ period: value }).toString()}`;
}
