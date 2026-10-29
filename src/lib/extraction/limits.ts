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

/** DE-7: wait before the single cold-start retry of a model call. */
export const COLD_START_RETRY_DELAY_MS = 5_000;

/** DE-8: most bytes read from a model response; more is `invalid_response`. */
export const MAX_MODEL_RESPONSE_BYTES = 64 * 1024;

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

/**
 * DE-9: side, in pixels, of the block the model server bills as one image
 * token (NuExtract3, Qwen3-VL family): an image costs one token per started
 * 32 x 32 block.
 */
export const IMAGE_TOKEN_BLOCK_PX = 32;

/**
 * DE-9: image tokens all the images of one document may cost together. The
 * server runs with an 8192-token context; this leaves about 2k for the prompt
 * and the JSON output. A 3-page letter at `IMAGE_MAX_WIDTH` costs 10,650.
 */
export const MAX_IMAGE_TOKENS = 6144;

/** DE-9: tokens the model server bills for an image of this size, in pixels. */
export function imageTokenCost(width: number, height: number): number {
  return (
    Math.ceil(width / IMAGE_TOKEN_BLOCK_PX) *
    Math.ceil(height / IMAGE_TOKEN_BLOCK_PX)
  );
}

/**
 * DE-9: widest render width, at most `IMAGE_MAX_WIDTH`, whose image costs no
 * more than `tokenBudget`. The height scales with the width and is rounded up,
 * so the bound holds however the renderer rounds. A PDF page (size in points)
 * may be enlarged; a raster image passes `enlarge: false` and never grows past
 * its own width. A degenerate size yields 0; nothing narrower than 1 px.
 */
export function widthWithinImageTokens(
  width: number,
  height: number,
  tokenBudget: number,
  { enlarge = true }: { enlarge?: boolean } = {},
): number {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return 0;
  if (width <= 0 || height <= 0) return 0;
  let w = Math.floor(
    enlarge ? IMAGE_MAX_WIDTH : Math.min(IMAGE_MAX_WIDTH, width),
  );
  while (
    w > 1 &&
    imageTokenCost(w, Math.ceil((height * w) / width)) > tokenBudget
  ) {
    w--;
  }
  return Math.max(1, w);
}

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
