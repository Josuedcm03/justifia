// Ports of the extraction slice (DE-1, DE-6). The use case depends on these
// interfaces only; the adapters live in `./adapters`. Every failure crosses a
// port as a closed-set code, never as a message, so no free text from the
// model, the network or an exception can reach a row or a log (RF-11, RNF-04).

import type { ExtractionError } from "./states";
import type { PreparedDocument } from "./template";
import type { RawExtraction } from "./validate";

export type { PreparedDocument };

/** Kinds the intake pipeline stores (`TipoDetectado`). */
export type DocumentKind = "pdf" | "png" | "jpeg";

/** Why a document could not be turned into model input (DE-9). */
export type PrepareFailure = Extract<
  ExtractionError,
  "unreadable_document" | "render_unavailable"
>;

export type PrepareResult =
  | { ok: true; prepared: PreparedDocument }
  | { ok: false; code: PrepareFailure };

/** Turns stored bytes into the images the model reads (DE-9). */
export interface DocumentPreparer {
  prepare(bytes: Uint8Array, kind: DocumentKind): Promise<PrepareResult>;
}

/** Why the model server gave no usable answer (DE-7, DE-8). */
export type ExtractFailure = Extract<
  ExtractionError,
  "timeout" | "model_error" | "invalid_response"
>;

export type ExtractResult =
  { ok: true; raw: RawExtraction } | { ok: false; code: ExtractFailure };

export interface ExtractOptions {
  /** `AbortSignal` timeout of the model call, from the remaining budget. */
  timeoutMs: number;
}

/** Reads the RF-11 fields of a prepared document from the model server. */
export interface FieldExtractor {
  /** False when no usable address is set: nothing may be sent (DE-4, DE-12). */
  isConfigured(): boolean;
  extract(
    prepared: PreparedDocument,
    options: ExtractOptions,
  ): Promise<ExtractResult>;
}

/**
 * Post-commit hand-off of a request to extraction (DE-5). Fire and forget: an
 * implementation swallows its own failure, so a producer never has to guard it
 * beyond what the submission already does.
 */
export interface ExtractionQueue {
  enqueue(solicitudId: number, startedAt: Date): void;
}
