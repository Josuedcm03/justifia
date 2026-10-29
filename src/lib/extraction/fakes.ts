import type {
  DocumentKind,
  DocumentPreparer,
  ExtractionQueue,
  ExtractOptions,
  ExtractResult,
  FieldExtractor,
  PreparedDocument,
  PrepareResult,
} from "./ports";

// Test doubles for the extraction ports. No `server-only`, no network:
// importable from any test. Not used by production code.

const ONE_PAGE: PrepareResult = {
  ok: true,
  prepared: { kind: "images", images: [new Uint8Array([0xff, 0xd8, 0xff])] },
};

export type FakePreparer = DocumentPreparer & {
  readonly calls: readonly { bytes: Uint8Array; kind: DocumentKind }[];
  /** Replace the scripted answer of every following call. */
  respondWith(result: PrepareResult): void;
};

export function createFakePreparer(
  initial: PrepareResult = ONE_PAGE,
): FakePreparer {
  const calls: { bytes: Uint8Array; kind: DocumentKind }[] = [];
  let result = initial;
  return {
    calls,
    respondWith(next) {
      result = next;
    },
    async prepare(bytes, kind) {
      calls.push({ bytes, kind });
      return result;
    },
  };
}

export type FakeFieldExtractor = FieldExtractor & {
  readonly calls: readonly {
    prepared: PreparedDocument;
    timeoutMs: number;
  }[];
  /** Times `isConfigured()` was asked. */
  readonly configuredChecks: number;
  /** Answers and errors handed out one per call, in this order. */
  queue(...results: ExtractResult[]): void;
  setConfigured(configured: boolean): void;
};

export function createFakeFieldExtractor(
  options: { configured?: boolean } = {},
): FakeFieldExtractor {
  const calls: { prepared: PreparedDocument; timeoutMs: number }[] = [];
  const queued: ExtractResult[] = [];
  let configured = options.configured ?? true;
  let configuredChecks = 0;
  return {
    calls,
    get configuredChecks() {
      return configuredChecks;
    },
    queue(...results) {
      queued.push(...results);
    },
    setConfigured(next) {
      configured = next;
    },
    isConfigured() {
      configuredChecks += 1;
      return configured;
    },
    async extract(prepared: PreparedDocument, { timeoutMs }: ExtractOptions) {
      calls.push({ prepared, timeoutMs });
      const next = queued.shift();
      if (!next) throw new Error("fake_extractor_queue_empty");
      return next;
    },
  };
}

export type RecordingQueue = ExtractionQueue & {
  readonly calls: readonly { solicitudId: number; startedAt: Date }[];
};

export function createRecordingQueue(): RecordingQueue {
  const calls: { solicitudId: number; startedAt: Date }[] = [];
  return {
    calls,
    enqueue(solicitudId, startedAt) {
      calls.push({ solicitudId, startedAt });
    },
  };
}
