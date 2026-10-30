import "server-only";

import {
  abandonExpiredExtractions,
  claimExtraction,
  completeExtraction,
  failExtraction,
  registerPendingExtractions,
  selectExtractionCandidates,
  type ExtractionClaim,
} from "@/lib/data/extraction";
import { managuaToday } from "@/lib/intake/dates";
import type { DocumentStore } from "@/lib/intake/ports";

import {
  canStartDocument,
  deadlineFor,
  modelTimeoutMs,
  SWEEP_BATCH_SIZE,
} from "./limits";
import type { DocumentPreparer, FieldExtractor } from "./ports";
import type { ExtractionError } from "./states";
import { ENGINE_ID } from "./template";
import { validateFields } from "./validate";

// Use case of document extraction (DE-5, DE-6): claim -> read the bytes ->
// prepare -> extract -> validate in code -> guarded completion. The data layer
// owns every write; this module only decides the order and maps each failure
// to the closed set of codes. It logs ids and error names, never a value, a
// pathname, the address or the key (RNF-04, RNF-06).

export type ExtractionDeps = {
  store: DocumentStore;
  preparer: DocumentPreparer;
  extractor: FieldExtractor;
  /** Injectable clock for the deadline arithmetic; defaults to the system. */
  now?: () => Date;
};

export type DocumentOutcome =
  /** The claim matched no row: final, held by another worker, or retired. */
  | { outcome: "skipped" }
  | { outcome: "completed" }
  /** The attempt failed with a closed-set code and the row was updated. */
  | { outcome: "failed"; code: ExtractionError }
  /** The lease was taken over meanwhile; the guarded write changed nothing. */
  | { outcome: "lost" }
  /** An unexpected throw: logged by name, the lease is kept for the sweep. */
  | { outcome: "errored" };

function clock(deps: ExtractionDeps): Date {
  return (deps.now ?? (() => new Date()))();
}

async function readAll(
  stream: ReadableStream<Uint8Array>,
): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

/** Bytes of a stored file, or null when it is missing or cannot be read. */
async function loadBytes(
  store: DocumentStore,
  pathname: string,
): Promise<Uint8Array | null> {
  try {
    const stream = await store.stream(pathname);
    return stream ? await readAll(stream) : null;
  } catch {
    return null;
  }
}

async function runClaimed(
  claim: ExtractionClaim,
  deps: ExtractionDeps,
  deadline: Date,
): Promise<DocumentOutcome> {
  const fail = async (code: ExtractionError): Promise<DocumentOutcome> =>
    (await failExtraction(claim, code, clock(deps)))
      ? { outcome: "failed", code }
      : { outcome: "lost" };

  if (!deps.extractor.isConfigured()) return fail("not_configured");

  const bytes = await loadBytes(deps.store, claim.pathname);
  if (!bytes) return fail("document_unavailable");

  const prepared = await deps.preparer.prepare(bytes, claim.tipoDetectado);
  if (!prepared.ok) return fail(prepared.code);

  const remainingMs = deadline.getTime() - clock(deps).getTime();
  const answer = await deps.extractor.extract(prepared.prepared, {
    timeoutMs: modelTimeoutMs(remainingMs),
  });
  if (!answer.ok) return fail(answer.code);

  const fields = validateFields(answer.raw, {
    submittedOn: managuaToday(claim.submittedAt),
  });
  return (await completeExtraction(claim, fields, ENGINE_ID, clock(deps)))
    ? { outcome: "completed" }
    : { outcome: "lost" };
}

/**
 * Extracts one document (DE-6). Never throws: an unexpected failure is logged
 * by error name and leaves the row `procesando`, so the sweep reclaims it once
 * the lease expires (DE-5). `deadline` is the instant the invocation must end.
 */
export async function runDocumentExtraction(
  documentoId: number,
  deps: ExtractionDeps,
  { deadline }: { deadline: Date },
): Promise<DocumentOutcome> {
  try {
    const claim = await claimExtraction(documentoId, clock(deps));
    if (!claim) return { outcome: "skipped" };
    return await runClaimed(claim, deps, deadline);
  } catch (error) {
    console.error("extraction_document_failed", {
      documentoId,
      code: error instanceof Error ? error.name : "unknown",
    });
    return { outcome: "errored" };
  }
}

export type RequestSummary = {
  /** Documents this run took on (a claim that matched nothing is not one). */
  processed: number;
  /** Of those, how many ended in an unexpected throw. */
  errored: number;
};

/**
 * The instant processing must stop: `startedAt` is the action's own clock
 * (DE-7), so validation and commit time already count; the sweep passes its
 * own `deadline` instead.
 */
export type ProcessOptions = { startedAt: Date } | { deadline: Date };

/**
 * Post-commit work for one request (DE-5): register its documents, then run
 * them one at a time while the remaining budget still covers a document. What
 * is left stays `pendiente` for the sweep. With no usable extractor address the
 * rows are registered and nothing is claimed, so no attempt is burned (DE-4).
 * A registration failure is the caller's to contain.
 */
export async function processRequestExtractions(
  solicitudId: number,
  deps: ExtractionDeps,
  options: ProcessOptions,
): Promise<RequestSummary> {
  const deadline =
    "deadline" in options ? options.deadline : deadlineFor(options.startedAt);
  const summary: RequestSummary = { processed: 0, errored: 0 };

  const ids = await registerPendingExtractions(solicitudId, clock(deps));
  if (!deps.extractor.isConfigured()) return summary;

  for (const id of ids) {
    const remainingMs = deadline.getTime() - clock(deps).getTime();
    if (!canStartDocument(remainingMs)) break;
    const result = await runDocumentExtraction(id, deps, { deadline });
    if (result.outcome === "skipped") continue;
    summary.processed += 1;
    if (result.outcome === "errored") summary.errored += 1;
  }
  return summary;
}

export type SweepReport = {
  /** Documents the sweep took on. */
  run: number;
  /** Rows closed as `fallida` because their last lease expired. */
  abandoned: number;
  /** Requests that threw plus documents that ended in an unexpected throw. */
  failures: number;
};

/**
 * Step 4 of the daily sweep (DE-11). First closes the leases that expired on
 * the last attempt, then, when the extractor is configured, takes up to
 * `SWEEP_BATCH_SIZE` pending requests (oldest clock start first: the bounded
 * backfill) and processes them until `deadline`. One request failing never
 * stops the next. A failure of the lease step or of the candidate read
 * reaches the caller, which counts the whole step as failed. Counts only.
 */
export async function runExtractionSweep(
  now: Date,
  deadline: Date,
  deps: ExtractionDeps,
): Promise<SweepReport> {
  const report: SweepReport = {
    run: 0,
    abandoned: await abandonExpiredExtractions(now),
    failures: 0,
  };
  if (!deps.extractor.isConfigured()) return report;

  const candidates = await selectExtractionCandidates(now, SWEEP_BATCH_SIZE);
  for (const solicitudId of candidates) {
    if (!canStartDocument(deadline.getTime() - clock(deps).getTime())) break;
    try {
      const summary = await processRequestExtractions(solicitudId, deps, {
        deadline,
      });
      report.run += summary.processed;
      report.failures += summary.errored;
    } catch (error) {
      report.failures += 1;
      console.error("extraction_sweep_request_failed", {
        solicitudId,
        code: error instanceof Error ? error.name : "unknown",
      });
    }
  }
  return report;
}
