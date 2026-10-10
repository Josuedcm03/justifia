import { isIsoDate } from "@/lib/intake/dates";

// Pure helpers of the stepper (A7: `?step=` is the only wizard state; the draft
// on the server is the truth). No I/O, so the page and the tests share them.

export const FLOW_PATH = "/requests/new";

/** Steps the flow always shows: details, subjects, documents, review. */
export const STEP_KEYS = [
  "details",
  "subjects",
  "documents",
  "review",
] as const;

/** Steps that can be opened: all four, the last one being the review. */
export const AVAILABLE_STEPS = 4;

export type StepNumber = 1 | 2 | 3 | 4;

export function stepHref(step: number): string {
  return `${FLOW_PATH}?step=${step}`;
}

/** Edit link of the review: the step returns to the review once saved. */
export function reviewEditHref(step: number): string {
  return `${stepHref(step)}&from=review`;
}

/** True when the URL says the step was opened from the review's edit link. */
export function parseFromReview(raw: string | string[] | undefined): boolean {
  return (Array.isArray(raw) ? raw[0] : raw) === "review";
}

/** The requested step, or null when the URL names none usable. */
export function parseStep(
  raw: string | string[] | undefined,
): StepNumber | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined || !/^[1-9]\d*$/.test(value)) return null;
  return Math.min(Number(value), AVAILABLE_STEPS) as StepNumber;
}

type DraftProgress = {
  causa: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  subjects: readonly unknown[];
};

/** Where an unqualified visit resumes: the first step the draft has not done. */
export function defaultStep(draft: DraftProgress): StepNumber {
  if (!draft.causa || !draft.fechaInicio || !draft.fechaFin) return 1;
  return draft.subjects.length === 0 ? 2 : 3;
}

/** Dates usable as a schedule range: both real, start not after end. */
export function draftRange(draft: {
  fechaInicio: string | null;
  fechaFin: string | null;
}): { from: string; to: string } | null {
  const { fechaInicio: from, fechaFin: to } = draft;
  return isIsoDate(from) && isIsoDate(to) && from <= to ? { from, to } : null;
}
