// Pure constants and transitions of the document-extraction row (DE-3). The
// schema CHECK lists are rendered from these arrays, so a value added here
// reaches the database only through a generated migration.

import { MAX_ATTEMPTS } from "./limits";

export const EXTRACTION_STATES = [
  "pendiente",
  "procesando",
  "completada",
  "fallida",
  "no_aplica",
] as const;

export type ExtractionState = (typeof EXTRACTION_STATES)[number];

/**
 * Closed set of failure codes. A row never stores free text from the model,
 * the network or an exception (RF-11, RNF-04).
 */
export const EXTRACTION_ERRORS = [
  "not_configured",
  "document_unavailable",
  "unreadable_document",
  "render_unavailable",
  "timeout",
  "model_error",
  "invalid_response",
] as const;

export type ExtractionError = (typeof EXTRACTION_ERRORS)[number];

/** Codes that end the row at once: retrying the same bytes cannot help. */
export const PERMANENT_ERRORS: readonly ExtractionError[] = [
  "unreadable_document",
];

export function isExtractionState(value: unknown): value is ExtractionState {
  return (EXTRACTION_STATES as readonly unknown[]).includes(value);
}

export function isExtractionError(value: unknown): value is ExtractionError {
  return (EXTRACTION_ERRORS as readonly unknown[]).includes(value);
}

export function isPermanentError(value: unknown): value is ExtractionError {
  return (PERMANENT_ERRORS as readonly unknown[]).includes(value);
}

/**
 * State a `procesando` row takes after a failed attempt. `attempts` counts the
 * attempt that just failed. A permanent code, or the last allowed attempt,
 * ends the row; otherwise it goes back for another try. A not-configured
 * claim is handed back whatever the count (the attempt is returned, DE-4).
 */
export function failureOutcome(
  error: ExtractionError,
  attempts: number,
): "pendiente" | "fallida" {
  if (error === "not_configured") return "pendiente";
  if (isPermanentError(error) || attempts >= MAX_ATTEMPTS) return "fallida";
  return "pendiente";
}
