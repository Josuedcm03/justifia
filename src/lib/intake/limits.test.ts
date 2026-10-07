import { describe, expect, it } from "vitest";

import {
  ALLOWED_CONTENT_TYPES,
  DRAFT_TTL_DAYS,
  LATE_WINDOW_DAYS,
  MAX_DOCUMENTS_PER_DRAFT,
  MAX_DOCUMENT_BYTES,
  ORPHAN_GRACE_HOURS,
  PENDING_GRACE_HOURS,
  UPLOAD_TOKEN_TTL_MINUTES,
} from "./limits";

describe("intake limits (RN-04, D4, D8, D12)", () => {
  it("caps a document at 10 MiB", () => {
    expect(MAX_DOCUMENT_BYTES).toBe(10_485_760);
  });

  it("allows PDF, PNG and JPEG content types only", () => {
    expect([...ALLOWED_CONTENT_TYPES]).toEqual([
      "application/pdf",
      "image/png",
      "image/jpeg",
    ]);
  });

  it("holds at most five documents per draft (D12)", () => {
    expect(MAX_DOCUMENTS_PER_DRAFT).toBe(5);
  });

  it("uses the 30-day draft TTL, 24 h orphan grace, 1 h pending grace (D8)", () => {
    expect(DRAFT_TTL_DAYS).toBe(30);
    expect(ORPHAN_GRACE_HOURS).toBe(24);
    expect(PENDING_GRACE_HOURS).toBe(1);
  });

  it("uses a 30-day RN-23 window and a short-lived upload token", () => {
    expect(LATE_WINDOW_DAYS).toBe(30);
    expect(UPLOAD_TOKEN_TTL_MINUTES).toBe(10);
  });
});
