import { describe, expect, it } from "vitest";

import {
  EXTRACTION_ERRORS,
  EXTRACTION_STATES,
  PERMANENT_ERRORS,
  failureOutcome,
  isExtractionError,
  isExtractionState,
  isPermanentError,
} from "./states";

describe("extraction constants (DE-3)", () => {
  it("lists the five states", () => {
    expect(EXTRACTION_STATES).toEqual([
      "pendiente",
      "procesando",
      "completada",
      "fallida",
      "no_aplica",
    ]);
  });

  it("lists the seven closed-set error codes", () => {
    expect(EXTRACTION_ERRORS).toEqual([
      "not_configured",
      "document_unavailable",
      "unreadable_document",
      "render_unavailable",
      "timeout",
      "model_error",
      "invalid_response",
    ]);
  });

  it("marks only an unreadable document as permanent", () => {
    expect(PERMANENT_ERRORS).toEqual(["unreadable_document"]);
  });

  it("keeps every permanent code inside the closed error set", () => {
    for (const code of PERMANENT_ERRORS) {
      expect(EXTRACTION_ERRORS).toContain(code);
    }
  });
});

describe("guards", () => {
  it("recognises only listed states", () => {
    expect(isExtractionState("procesando")).toBe(true);
    expect(isExtractionState("no_aplica")).toBe(true);
    expect(isExtractionState("cancelada")).toBe(false);
    expect(isExtractionState(null)).toBe(false);
    expect(isExtractionState(3)).toBe(false);
  });

  it("recognises only listed error codes", () => {
    expect(isExtractionError("model_error")).toBe(true);
    expect(isExtractionError("socket hang up")).toBe(false);
    expect(isExtractionError(undefined)).toBe(false);
  });

  it("recognises only the permanent code as permanent", () => {
    expect(isPermanentError("unreadable_document")).toBe(true);
    expect(isPermanentError("timeout")).toBe(false);
    expect(isPermanentError("anything else")).toBe(false);
  });
});

describe("failureOutcome (attempts used including the failed one)", () => {
  it.each([
    ["timeout", 1, "pendiente"],
    ["model_error", 2, "pendiente"],
    ["invalid_response", 2, "pendiente"],
    ["document_unavailable", 1, "pendiente"],
    ["render_unavailable", 2, "pendiente"],
  ] as const)(
    "%s on attempt %i goes back to %s (scenario: retries below the cap)",
    (error, attempts, expected) => {
      expect(failureOutcome(error, attempts)).toBe(expected);
    },
  );

  it.each([
    ["timeout", 3],
    ["model_error", 3],
    ["invalid_response", 3],
  ] as const)(
    "%s on the third attempt is final (scenario: Third failure is final)",
    (error, attempts) => {
      expect(failureOutcome(error, attempts)).toBe("fallida");
    },
  );

  it("treats an unreadable document as final on the first attempt", () => {
    expect(failureOutcome("unreadable_document", 1)).toBe("fallida");
  });

  it("hands a not-configured attempt back even at the cap", () => {
    expect(failureOutcome("not_configured", 1)).toBe("pendiente");
    expect(failureOutcome("not_configured", 3)).toBe("pendiente");
  });
});
