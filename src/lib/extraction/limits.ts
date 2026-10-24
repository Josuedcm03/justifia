// Extraction constants (DE-3, DE-7, DE-9, DE-11). Pure: no imports, so the
// schema, the use case and the adapters can all read them.

/** DE-3: attempts a document gets before its row becomes `fallida`. */
export const MAX_ATTEMPTS = 3;

/**
 * DE-7: ceiling of one invocation that runs extraction. Pinned equal to the
 * three literal `maxDuration` exports by a file-scan test (segment config must
 * be a static literal).
 */
export const EXTRACTION_MAX_DURATION_S = 300;

/**
 * DE-3: a `procesando` claim older than this is reclaimable. Longer than one
 * invocation can run, so only a killed invocation is ever taken over.
 */
export const CLAIM_LEASE_MS = 10 * 60 * 1000;

/** DE-7: room left after the deadline for the guarded completion writes. */
export const DEADLINE_SAFETY_MS = 25_000;

/** DE-7: a document that cannot finish in this budget is not started. */
export const MIN_DOCUMENT_BUDGET_MS = 20_000;

/** DE-7: ceiling of one model call; covers a serverless GPU cold start. */
export const FETCH_TIMEOUT_MS = 120_000;

/** DE-7: margin kept between a model call's timeout and the deadline. */
const MODEL_TIMEOUT_MARGIN_MS = 10_000;

/** DE-9: pages of a PDF that are rendered and sent. */
export const MAX_PDF_PAGES = 5;

/** DE-9: widest image sent to the model, in pixels (never enlarged). */
export const IMAGE_MAX_WIDTH = 1600;

/**
 * DE-9: tallest page, in pixels, the preparer draws at `IMAGE_MAX_WIDTH`. With
 * a 1600 px width that is a 16 MP canvas (about 64 MB of RGBA), at ratio 6.25.
 * Letter, A4, legal and a 400 mm receipt are far below it; a 1 x 14400 pt strip
 * would be 23 million pixels high.
 */
export const MAX_RENDERED_PAGE_HEIGHT = 10_000;

/** DE-11: requests one sweep run takes up (the backfill bound). */
export const SWEEP_BATCH_SIZE = 10;

/**
 * DE-9: true when a page of this size (points, as the viewer shows it) can be
 * drawn at `IMAGE_MAX_WIDTH` without exceeding `MAX_RENDERED_PAGE_HEIGHT`. A
 * degenerate size (zero, negative, not finite) never fits.
 */
export function fitsRenderCap(width: number, height: number): boolean {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return false;
  if (width <= 0 || height <= 0) return false;
  return (height * IMAGE_MAX_WIDTH) / width <= MAX_RENDERED_PAGE_HEIGHT;
}

/** DE-7: the instant after which no further document is started. */
export function deadlineFor(startedAt: Date): Date {
  return new Date(
    startedAt.getTime() + EXTRACTION_MAX_DURATION_S * 1000 - DEADLINE_SAFETY_MS,
  );
}

/** DE-7: true when the remaining budget still covers one document. */
export function canStartDocument(remainingMs: number): boolean {
  return remainingMs >= MIN_DOCUMENT_BUDGET_MS;
}

/**
 * DE-7: timeout of one model call, `min(120 s, remaining - 10 s)`. Clamped at
 * zero so an exhausted budget never yields a negative timeout.
 */
export function modelTimeoutMs(remainingMs: number): number {
  return Math.max(
    0,
    Math.min(FETCH_TIMEOUT_MS, remainingMs - MODEL_TIMEOUT_MARGIN_MS),
  );
}
