import { describe, expect, it } from "vitest";

import {
  CLAIM_LEASE_MS,
  COLD_START_RETRY_DELAY_MS,
  DEADLINE_SAFETY_MS,
  EXTRACTION_MAX_DURATION_S,
  FETCH_TIMEOUT_MS,
  IMAGE_MAX_WIDTH,
  IMAGE_TOKEN_BLOCK_PX,
  MAX_ATTEMPTS,
  MAX_IMAGE_TOKENS,
  MAX_MODEL_RESPONSE_BYTES,
  MAX_PDF_PAGES,
  MAX_RENDERED_PAGE_HEIGHT,
  MIN_DOCUMENT_BUDGET_MS,
  SWEEP_BATCH_SIZE,
  canStartDocument,
  deadlineFor,
  fitsRenderCap,
  imageTokenCost,
  modelTimeoutMs,
  widthWithinImageTokens,
} from "./limits";

describe("extraction limits (DE-3, DE-7, DE-9, DE-11)", () => {
  it("pins every numeric constant", () => {
    expect(MAX_ATTEMPTS).toBe(3);
    expect(EXTRACTION_MAX_DURATION_S).toBe(300);
    expect(CLAIM_LEASE_MS).toBe(10 * 60 * 1000);
    expect(DEADLINE_SAFETY_MS).toBe(25_000);
    expect(MIN_DOCUMENT_BUDGET_MS).toBe(20_000);
    expect(FETCH_TIMEOUT_MS).toBe(120_000);
    expect(MAX_PDF_PAGES).toBe(5);
    expect(IMAGE_MAX_WIDTH).toBe(1600);
    expect(MAX_RENDERED_PAGE_HEIGHT).toBe(10_000);
    expect(COLD_START_RETRY_DELAY_MS).toBe(5_000);
    expect(MAX_MODEL_RESPONSE_BYTES).toBe(64 * 1024);
    expect(SWEEP_BATCH_SIZE).toBe(10);
  });

  it("keeps the render cap at about 16 megapixels at the image width", () => {
    expect(IMAGE_MAX_WIDTH * MAX_RENDERED_PAGE_HEIGHT).toBe(16_000_000);
  });

  it("keeps the claim lease longer than one invocation can run", () => {
    expect(CLAIM_LEASE_MS).toBeGreaterThan(EXTRACTION_MAX_DURATION_S * 1000);
  });
});

describe("fitsRenderCap (page size at the image width, in points)", () => {
  it.each([
    ["US Letter", 612, 792, true],
    ["A4", 595, 842, true],
    ["US Legal", 612, 1008, true],
    ["A4 landscape", 842, 595, true],
    ["80 mm x 400 mm receipt (ratio 5)", 227, 1134, true],
    ["ratio 6.25, rendered at exactly 10,000 px", 100, 625, true],
    ["ratio 6.26, one point over the cap", 100, 626, false],
    ["80 mm x 600 mm roll (ratio 7.5)", 227, 1701, false],
    ["1 x 14400 pt strip", 1, 14_400, false],
    ["14400 x 1 pt strip (renders 0.1 px high)", 14_400, 1, true],
  ])("%s: %i x %i pt -> %s", (_label, width, height, expected) => {
    expect(fitsRenderCap(width, height)).toBe(expected);
  });

  it.each([
    ["zero width", 0, 792],
    ["zero height", 612, 0],
    ["negative width", -612, 792],
    ["negative height", 612, -792],
    ["NaN width", Number.NaN, 792],
    ["NaN height", 612, Number.NaN],
    ["infinite height", 612, Number.POSITIVE_INFINITY],
    ["infinite width", Number.POSITIVE_INFINITY, 792],
  ])("rejects a degenerate size: %s", (_label, width, height) => {
    expect(fitsRenderCap(width, height)).toBe(false);
  });
});

describe("image token budget (DE-9)", () => {
  it("pins the budget and the block size", () => {
    expect(MAX_IMAGE_TOKENS).toBe(6144);
    expect(IMAGE_TOKEN_BLOCK_PX).toBe(32);
  });

  it("leaves room in an 8192-token context for the prompt and the output", () => {
    expect(8192 - MAX_IMAGE_TOKENS).toBeGreaterThanOrEqual(2048);
  });

  it("costs one token per started 32 x 32 block", () => {
    expect(imageTokenCost(32, 32)).toBe(1);
    expect(imageTokenCost(33, 32)).toBe(2);
    expect(imageTokenCost(1600, 2260)).toBe(3550);
  });
});

describe("widthWithinImageTokens (largest width under a token budget)", () => {
  /** Height the width yields, rounded up as the helper bounds it. */
  const scaled = (w: number, width: number, height: number) =>
    Math.ceil((height * w) / width);

  it("keeps a one-page US Letter at the width cap: it fits the whole budget", () => {
    expect(widthWithinImageTokens(612, 792, MAX_IMAGE_TOKENS)).toBe(
      IMAGE_MAX_WIDTH,
    );
  });

  it.each([
    ["US Letter, a third of the budget", 612, 792, 2048],
    ["US Letter, a fifth of the budget", 612, 792, 1228],
    ["A4, half of the budget", 595, 842, 3072],
    ["80 mm x 400 mm receipt, whole budget", 227, 1134, MAX_IMAGE_TOKENS],
    ["1600 x 9000 photo, whole budget", 1600, 9000, MAX_IMAGE_TOKENS],
  ])("%s: the largest width that fits", (_label, width, height, budget) => {
    const w = widthWithinImageTokens(width, height, budget);

    expect(w).toBeLessThan(IMAGE_MAX_WIDTH);
    expect(imageTokenCost(w, scaled(w, width, height))).toBeLessThanOrEqual(
      budget,
    );
    // One pixel wider no longer fits.
    expect(imageTokenCost(w + 1, scaled(w + 1, width, height))).toBeGreaterThan(
      budget,
    );
  });

  it("never goes past the width cap, even for a page in points", () => {
    expect(widthWithinImageTokens(100, 100, MAX_IMAGE_TOKENS)).toBe(
      IMAGE_MAX_WIDTH,
    );
    expect(widthWithinImageTokens(3000, 1000, MAX_IMAGE_TOKENS)).toBe(
      IMAGE_MAX_WIDTH,
    );
  });

  it("never enlarges a raster image past its own width", () => {
    expect(
      widthWithinImageTokens(929, 606, MAX_IMAGE_TOKENS, { enlarge: false }),
    ).toBe(929);
  });

  it("still shrinks a raster image that is over the budget", () => {
    const w = widthWithinImageTokens(1600, 9000, MAX_IMAGE_TOKENS, {
      enlarge: false,
    });

    expect(w).toBeLessThan(1600);
    expect(imageTokenCost(w, scaled(w, 1600, 9000))).toBeLessThanOrEqual(
      MAX_IMAGE_TOKENS,
    );
  });

  it.each([
    ["zero width", 0, 792],
    ["zero height", 612, 0],
    ["NaN width", Number.NaN, 792],
    ["infinite height", 612, Number.POSITIVE_INFINITY],
  ])("returns 0 for a degenerate size: %s", (_label, width, height) => {
    expect(widthWithinImageTokens(width, height, MAX_IMAGE_TOKENS)).toBe(0);
  });
});

describe("deadlineFor", () => {
  it("is the start plus 275 seconds (300 s minus the 25 s safety margin)", () => {
    const startedAt = new Date("2026-10-22T15:00:00.000Z");

    expect(deadlineFor(startedAt)).toEqual(
      new Date("2026-10-22T15:04:35.000Z"),
    );
  });

  it("does not mutate the start instant", () => {
    const startedAt = new Date("2026-10-22T15:00:00.000Z");

    deadlineFor(startedAt);

    expect(startedAt.toISOString()).toBe("2026-10-22T15:00:00.000Z");
  });
});

describe("canStartDocument", () => {
  it.each([
    [275_000, true],
    [20_000, true],
    [19_999, false],
    [0, false],
    [-5_000, false],
  ])("remaining %i ms -> %s", (remaining, expected) => {
    expect(canStartDocument(remaining)).toBe(expected);
  });
});

describe("modelTimeoutMs (min of 120 s and remaining minus 10 s)", () => {
  it.each([
    [275_000, 120_000],
    [130_000, 120_000],
    [129_000, 119_000],
    [60_000, 50_000],
    [20_000, 10_000],
  ])("remaining %i ms -> %i ms", (remaining, expected) => {
    expect(modelTimeoutMs(remaining)).toBe(expected);
  });

  it("never goes negative when the budget is already spent", () => {
    expect(modelTimeoutMs(5_000)).toBe(0);
    expect(modelTimeoutMs(-1)).toBe(0);
  });
});
