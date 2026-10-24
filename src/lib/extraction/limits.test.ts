import { describe, expect, it } from "vitest";

import {
  CLAIM_LEASE_MS,
  DEADLINE_SAFETY_MS,
  EXTRACTION_MAX_DURATION_S,
  FETCH_TIMEOUT_MS,
  IMAGE_MAX_WIDTH,
  MAX_ATTEMPTS,
  MAX_PDF_PAGES,
  MIN_DOCUMENT_BUDGET_MS,
  SWEEP_BATCH_SIZE,
  canStartDocument,
  deadlineFor,
  modelTimeoutMs,
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
    expect(SWEEP_BATCH_SIZE).toBe(10);
  });

  it("keeps the claim lease longer than one invocation can run", () => {
    expect(CLAIM_LEASE_MS).toBeGreaterThan(EXTRACTION_MAX_DURATION_S * 1000);
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
