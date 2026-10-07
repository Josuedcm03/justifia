import "server-only";

import { del, get, list } from "@vercel/blob";

import { env } from "@/env";
import type { DocumentStore } from "@/lib/intake/ports";

// Vercel Blob implementation of `DocumentStore` (D1, A4). Every call uses
// `access: "private"`: a stored file has no public URL (RNF-02). The upload
// token protocol is NOT here; it lives in the token route (A4).

function requireToken(): string {
  const token = env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not configured.");
  }
  return token;
}

/** Reads up to `bytes` bytes from the stream, then cancels it. */
async function readUpTo(
  stream: ReadableStream<Uint8Array>,
  bytes: number,
): Promise<Uint8Array> {
  const reader = stream.getReader();
  const head = new Uint8Array(bytes);
  let filled = 0;
  try {
    while (filled < bytes) {
      const { done, value } = await reader.read();
      if (done) break;
      const take = Math.min(value.length, bytes - filled);
      head.set(value.subarray(0, take), filled);
      filled += take;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return head.slice(0, filled);
}

export function createVercelBlobStore(): DocumentStore {
  const token = requireToken();

  return {
    async readHead(pathname, bytes) {
      // `useCache: false`: finalize must see the bytes just uploaded, not a
      // stale CDN entry.
      const result = await get(pathname, {
        access: "private",
        useCache: false,
        token,
      });
      if (!result || result.statusCode !== 200) return null;
      return {
        size: result.blob.size,
        head: await readUpTo(result.stream, bytes),
      };
    },

    async delete(pathnames) {
      if (pathnames.length === 0) return;
      await del([...pathnames], { token });
    },

    async list(prefix, cursor) {
      const page = await list({ prefix, cursor, token });
      return {
        blobs: page.blobs.map((b) => ({
          pathname: b.pathname,
          uploadedAt: b.uploadedAt,
        })),
        cursor: page.hasMore ? page.cursor : undefined,
      };
    },

    async stream(pathname) {
      const result = await get(pathname, { access: "private", token });
      if (!result || result.statusCode !== 200) return null;
      return result.stream;
    },
  };
}
