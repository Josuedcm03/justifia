// The review tabs of `/review` (RF-06, RF-10, RF-15, E14). A tab code is the
// request state the tab lists, so the same code names the URL selector, the
// query that fills it and the `solicitud.cola.consultada` audit payload.

export const REVIEW_TABS = [
  "pendiente",
  "en_revision_coordinacion",
  "aprobada",
] as const;

export type ReviewTab = (typeof REVIEW_TABS)[number];

export const DEFAULT_REVIEW_TAB: ReviewTab = "pendiente";

/**
 * The tab a `?estado=` value selects. The set is closed: anything else (no
 * value, a repeated parameter, a state without a tab) is the default.
 */
export function reviewTabOf(value: unknown): ReviewTab {
  return REVIEW_TABS.find((tab) => tab === value) ?? DEFAULT_REVIEW_TAB;
}
