import { createHash } from "node:crypto";

// Provider idempotency key shared by the outbound mails (TR-6): stable for an
// equal payload, new when the recipients or the content that defines the
// message change. `payload` is any JSON-serialisable value.

export function mailIdempotencyKey(
  prefix: string,
  id: number,
  payload: unknown,
): string {
  const digest = createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, 16);
  return `${prefix}-${id}-${digest}`;
}
