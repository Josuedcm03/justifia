// Remission limits (D3, TR-10, TR-12). Pure constants.

/**
 * Largest total of attachment bytes (raw, before base64) one message may
 * carry: 25 MiB. Resend documents a 40 MB message limit including base64,
 * which adds about a third; 25 MiB raw is about 35 MB encoded plus the body.
 */
export const MAX_REMISSION_ATTACHMENT_BYTES = 25 * 1024 * 1024;

/** Automatic retries per remission before only a manual resend is left (TR-12). */
export const MAX_AUTO_ATTEMPTS = 8;

/** Rows one run of the retry job dispatches (TR-12). */
export const RETRY_BATCH_SIZE = 20;

/** True when the summed raw size is strictly over the message limit. */
export function exceedsAttachmentLimit(sizes: readonly number[]): boolean {
  const total = sizes.reduce((sum, size) => sum + size, 0);
  return total > MAX_REMISSION_ATTACHMENT_BYTES;
}
