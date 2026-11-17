import "server-only";

import { env } from "@/env";
import type { MailMessage, MailResult, MailSender } from "@/lib/intake/ports";

// Resend implementation of `MailSender` (TR-9). One endpoint, so plain `fetch`
// instead of the SDK: no dependency and trivially faked. Verified against the
// Resend docs on 2026-10-19: `POST /emails`, `Authorization: Bearer`, optional
// `Idempotency-Key` (max 256 chars, kept 24 h), attachments as base64
// `content` + `filename`, message limit 40 MB including base64, response
// `{ id }`. Verified on 2026-10-30: `html` beside `text`, and an inline image
// as an attachment with `content_id` (under 128 characters, referenced as
// `cid:<id>` in the HTML) and `content_type`; inline images are not supported
// by the batch endpoint, which this sender never uses.

const RESEND_EMAILS_URL = "https://api.resend.com/emails";

/** Upper bound of one provider call (TR-9). */
const SEND_TIMEOUT_MS = 20_000;

/**
 * 4xx statuses that a later attempt may clear: request timeout, a concurrent
 * or stale idempotency key (409) and rate or quota limits (429). Any other
 * 4xx is a defect of the request itself.
 */
const RETRYABLE_CLIENT_ERRORS = new Set([408, 409, 429]);

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function payload(from: string, message: MailMessage) {
  return {
    from,
    to: [message.to],
    cc: [...message.cc],
    subject: message.subject,
    text: message.text,
    ...(message.html === undefined ? {} : { html: message.html }),
    attachments: message.attachments.map((a) => ({
      filename: a.filename,
      content: toBase64(a.content),
      // An inline image: `content_id` is what `cid:` in the HTML points at.
      ...(a.contentId === undefined
        ? {}
        : { content_id: a.contentId, content_type: a.contentType }),
    })),
  };
}

async function providerId(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { id?: unknown };
    return typeof body.id === "string" && body.id ? body.id : "unknown";
  } catch {
    return "unknown";
  }
}

function failureCode(status: number): "rejected" | "unavailable" {
  if (status >= 500 || RETRYABLE_CLIENT_ERRORS.has(status)) {
    return "unavailable";
  }
  return "rejected";
}

/**
 * The key and the sender address are read from the environment at send time,
 * never at construction: `getIntakeDeps()` also serves routes that must keep
 * working without mail configuration. The provider's error text is dropped:
 * only the closed `MailResult` code leaves this module.
 */
export function createResendMailSender(
  fetchImpl: typeof fetch = fetch,
): MailSender {
  return {
    async send(message): Promise<MailResult> {
      const apiKey = env.RESEND_API_KEY;
      const from = env.MAIL_FROM;
      if (!apiKey || !from) return { ok: false, code: "not_configured" };

      try {
        const response = await fetchImpl(RESEND_EMAILS_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": message.idempotencyKey,
          },
          body: JSON.stringify(payload(from, message)),
          signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
        });
        if (response.ok) {
          return { ok: true, providerId: await providerId(response) };
        }
        return { ok: false, code: failureCode(response.status) };
      } catch {
        return { ok: false, code: "unavailable" };
      }
    },
  };
}
