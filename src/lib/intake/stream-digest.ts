import { createHash } from "node:crypto";

// One pass over a stored file (validation-signals, VS-4, X1): the leading
// bytes for the signature check, the byte count for the size check and the
// SHA-256 of the whole content, in flat memory. No `server-only`: pure over a
// web stream, importable by the adapters and by tests.

export type StreamDigest = {
  /** Bytes counted from the stream (past `maxBytes`, only up to the cancel). */
  size: number;
  /** The first `headBytes` bytes, or fewer when the stream is shorter. */
  head: Uint8Array;
  /** 64 lower-case hex characters, or null once the stream exceeded `maxBytes`. */
  sha256: string | null;
};

/**
 * Reads `stream` once. The head is filled across chunk boundaries and every
 * byte feeds the hash. The moment the count exceeds `maxBytes` the stream is
 * cancelled and no hash is returned: the caller refuses the file on the counted
 * size, never on blob metadata. A stream error propagates.
 */
export async function digestStream(
  stream: ReadableStream<Uint8Array>,
  headBytes: number,
  maxBytes: number,
): Promise<StreamDigest> {
  const reader = stream.getReader();
  const hash = createHash("sha256");
  const head = new Uint8Array(headBytes);
  let filled = 0;
  let size = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      size += value.length;
      if (size > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { size, head: head.slice(0, filled), sha256: null };
      }
      hash.update(value);
      if (filled < headBytes) {
        const take = Math.min(value.length, headBytes - filled);
        head.set(value.subarray(0, take), filled);
        filled += take;
      }
    }
  } finally {
    reader.releaseLock();
  }
  return { size, head: head.slice(0, filled), sha256: hash.digest("hex") };
}
