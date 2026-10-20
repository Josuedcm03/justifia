import { createHash, timingSafeEqual } from "node:crypto";

// Credential check shared by the scheduled routes (intake sweep, remission
// retry). Only the platform scheduler may call them: Vercel sends
// `Authorization: Bearer ${CRON_SECRET}`. The proxy never sees `/api`, so each
// handler checks the credential itself, fails closed when the secret is not
// configured, and compares in constant time. This file is not a route, so it
// may export helpers.

export const NO_STORE = { "Cache-Control": "private, no-store" } as const;

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/** Constant-time check of `Authorization` against `Bearer ${secret}`. */
export function isScheduler(
  request: Request,
  secret: string | undefined,
): boolean {
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  // Equal-length digests: the comparison time does not depend on the input.
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
}
