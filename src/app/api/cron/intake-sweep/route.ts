import { createHash, timingSafeEqual } from "node:crypto";

import { env } from "@/env";
import { runIntakeSweep } from "@/lib/data/intake-sweep";
import { getIntakeDeps } from "@/lib/intake/deps";

// Daily cleanup of drafts, failed finalizations and orphan files (D8, D10).
// Only the platform scheduler may call it: Vercel sends
// `Authorization: Bearer ${CRON_SECRET}`. The proxy never sees `/api`, so the
// handler checks the credential itself, fails closed when the secret is not
// configured, and compares in constant time. It writes no audit row (D14) and
// logs counts only.

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/** Constant-time check of `Authorization` against `Bearer ${secret}`. */
function isScheduler(request: Request, secret: string | undefined): boolean {
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  // Equal-length digests: the comparison time does not depend on the input.
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
}

export async function GET(request: Request): Promise<Response> {
  if (!isScheduler(request, env.CRON_SECRET)) {
    return Response.json(
      { error: "unauthorized" },
      { status: 401, headers: NO_STORE },
    );
  }

  try {
    const counts = await runIntakeSweep(new Date(), getIntakeDeps().store);
    console.info(JSON.stringify({ event: "intake.sweep", ...counts }));
    return Response.json(counts, { headers: NO_STORE });
  } catch {
    return Response.json(
      { error: "sweep_failed" },
      { status: 500, headers: NO_STORE },
    );
  }
}
