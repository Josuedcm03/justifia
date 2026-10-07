```yaml
schema: gentle-ai.sdd-research/v1
request_ids: [justification-intake-research-001, justification-intake-research-002]
revision: 2
status: done
admission:
  requested_classes: [documentation, open-web]
  observed_grants: [documentation, open-web]
```

# Research: justification-intake storage and upload architecture

Revision 1 answers Q1-Q3 with admitted evidence. Q4 and Q5 hit the 8-source cap
and are listed under gaps (not admitted claims). Revision 2 pending.

## Sources

| ID | Class | Title | Publisher | URL | accessed_at | Excerpt |
|---|---|---|---|---|---|---|
| S1 | documentation | Vercel Functions Limits | Vercel | https://vercel.com/docs/functions/limitations | 2026-10-06 | "The maximum payload size for the request body or the response body of a Vercel Function is 4.5 MB. If a Vercel Function receives a payload in excess of the limit it will return an error 413: FUNCTION_PAYLOAD_TOO_LARGE." |
| S2 | documentation | Client Uploads with Vercel Blob | Vercel | https://vercel.com/docs/vercel-blob/client-upload | 2026-10-06 | "When you need to upload files larger than 4.5 MB, you can use client uploads... directly from the browser to Vercel Blob." "You must authenticate and authorize users in the onBeforeGenerateToken callback." "When running your application locally, the onUploadCompleted callback will not work as Vercel Blob cannot contact your localhost..." |
| S3 | documentation | Private Storage (Vercel Blob) | Vercel | https://vercel.com/docs/vercel-blob/private-storage | 2026-10-06 | "Private Blob stores require authentication for all read and write operations." "Fetch its content with the get() SDK method." "For sensitive data (tokens, banking, PII), use Cache-Control: private, no-store." Requires `@vercel/blob` >= 2.3. |
| S4 | documentation | Vercel Blob Security | Vercel | https://vercel.com/docs/vercel-blob/security | 2026-10-06 | "All files stored on Vercel Blob are secured using AES-256 encryption. This encryption process is applied at rest and is transparent." |
| S5 | documentation | Vercel Blob Pricing | Vercel | https://vercel.com/docs/vercel-blob/usage-and-pricing | 2026-10-06 | Hobby: 1 GB/month storage, 10,000 simple ops, 2,000 advanced ops, 10 GB transfer; over-limit Hobby use blocks Blob access for 30 days. Storage "$0.023/GB". |
| S6 | documentation | Neon Object Storage overview | Neon | https://neon.com/docs/storage/overview | 2026-10-06 | "currently in beta"; 4 AWS regions; max object 5 GiB; private buckets; presigned URLs; Free plan 5 GB per project. Encryption at rest not specified. |
| S7 | documentation | Neon Security Overview | Neon | https://neon.com/docs/security/security-overview | 2026-10-06 | "All customer and sensitive data is encrypted using AES-256 encryption at rest." "Neon requires that all connections use SSL/TLS." |
| S8 | documentation | serverActions (Next.js config) | Vercel / Next.js | https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions | 2026-10-06 | "By default, the maximum size of the request body sent to a Server Action is 1MB... configure this limit using serverActions.bodySizeLimit." Multipart overhead "10-20 KB". |

## Claims

### Q1 — Vercel body limit
- C1. Vercel Function request/response body limit is 4.5 MB; excess returns 413 `FUNCTION_PAYLOAD_TOO_LARGE`. [S1]
- C2. No plan-specific variation or setting to raise the payload limit is documented. [S1]
- C3. Vercel recommends client uploads for files larger than 4.5 MB. [S2]
- C4. Server actions and route handlers run as Vercel Functions, so the limit applies to them (inference, not quoted). [S1, S8]
- C5. Next.js server actions default to a 1 MB body limit (`serverActions.bodySizeLimit`), separate from Vercel's; the lower wins. [S8]

### Q2 — Neon
- C6. Neon offers S3-compatible Object Storage, documented as beta: private buckets, presigned URLs, 5 GiB max object, 4 AWS regions. [S6]
- C7. Free plan includes 5 GB Object Storage per project; paid plans metered per GB. [S6]
- C8. Neon Postgres data is AES-256 encrypted at rest; TLS 1.2/1.3 enforced in transit. [S7]
- C9. Neon Object Storage encryption at rest is not documented. [S6]
- C10. No admitted Neon guidance on bytea/TOAST/egress for blobs (see gaps).

### Q3 — Vercel Blob
- C11. Private stores require authentication for every read; content served through your own function via `get()`; access mode is fixed at store creation. [S3, S4]
- C12. All Blob files are AES-256 encrypted at rest. [S4]
- C13. Client uploads bypass the 4.5 MB limit, incur no transfer charge, and the token route authenticates in `onBeforeGenerateToken`, which can return `allowedContentTypes`. [S2, S3]
- C14. `BLOB_READ_WRITE_TOKEN` is required by `handleUpload`. [S2]
- C15. `onUploadCompleted` does not fire on localhost without a tunnel and `VERCEL_BLOB_CALLBACK_URL`. [S2]
- C16. Server can read a private blob back with `get(pathname, { access: 'private' })` as a stream, enabling a magic-byte check on the first bytes; no Range option documented. [S3]
- C17. Authenticated downloads: route authenticates, calls `get()`, streams with `Cache-Control: private, no-store`. [S3]
- C18. Hobby includes 1 GB storage / 10 GB transfer; exceeding Hobby limits blocks access for 30 days; private delivery also incurs Fast Data Transfer. [S5, S3]

### Q5 — Validation pattern (partial)
- C20. Neon Object Storage supports `Range` on `GetObject`. [S6]
- C21. Vercel Blob offers no native post-upload content inspection; only client-declared `allowedContentTypes`. Server must read the object back. [S2, S3]

## Non-authoritative product choices

- A. Vercel Blob private store + client upload + server read-back validation (leading candidate).
- B. Neon Object Storage (beta, object encryption at rest undocumented).
- C. Server-action uploads capped below 4.5 MB per file (conflicts with RN-04 10 MB).
- D. Postgres bytea (impossible for 10 MB through Vercel Functions anyway; no admitted guidance).
- Validation sketch for A: authorize token → client upload → client-triggered finalize server action reads first bytes with `get()` → `del()` and reject on mismatch. Do not rely on `onUploadCompleted` alone (fails locally).

## Gaps (not admitted; to collect in revision 2)

- Q4 R2 / S3 / Supabase facts collected but not admitted (pricing, encryption, presigned uploads, Supabase Free 50 MB limit).
- Q5 vendor support, OWASP File Upload Cheat Sheet, `file-type` docs.
- Neon bytea guidance; Neon pricing page; Neon Object Storage GA vs beta status.
- Vercel Blob: Range on `get()`, region list, store-level limits, maximumSizeInBytes on token.
- Local Next.js version is 16.3.4; fetched docs were 16.4.0 (check local docs).

## Risks

- Hobby plan over-limit blocks Blob for 30 days.
- 10 MB uploads through server actions are impossible on Vercel (4.5 MB cap).
- `allowedContentTypes` is client-declared; magic-byte check stays mandatory.
- Direct uploads create orphan objects; cleanup required.
- No BAA / data residency evidence for Vercel Blob or Neon.
- Local dev cannot receive `onUploadCompleted` without a tunnel.

---

# Revision 2 (request justification-intake-research-002) — status: done

Closes Q4-Q7. Revision 1 gaps on Q4/Q5 are superseded by the claims below.

## Sources (revision 2)

| ID | Class | Title | Publisher | URL | accessed_at | Excerpt |
|---|---|---|---|---|---|---|
| S9 | documentation | Vercel Blob SDK Reference | Vercel | https://vercel.com/docs/vercel-blob/using-blob-sdk | 2026-10-06 | `get()` returns `stream: ReadableStream<Uint8Array>` plus `contentType`, `size`, `uploadedAt`; `del()` accepts one or many; `list({limit,prefix,cursor})` returns `uploadedAt`; token options `maximumSizeInBytes`, `allowedContentTypes`, `validUntil`, `addRandomSuffix`. |
| S10 | documentation | Usage & Pricing for Cron Jobs | Vercel | https://vercel.com/docs/cron-jobs/usage-and-pricing | 2026-10-06 | "Cron Jobs are available on all plans." Hobby: minimum once per day, ±59 min precision; more frequent expressions fail deployment. |
| S11 | documentation | Fair Use Guidelines — Commercial usage | Vercel | https://vercel.com/docs/limits/fair-use-guidelines | 2026-10-06 | "Hobby teams are restricted to non-commercial personal use only. All commercial usage... requires either a Pro or Enterprise plan." |
| S12 | documentation | File Upload Cheat Sheet | OWASP | https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html | 2026-10-06 | "The Content-Type for uploaded files is provided by the user, and as such cannot be trusted." Signature validation, allowlist, size limits, random filenames, authorization. |
| S13 | documentation | Presigned URLs | Cloudflare R2 | https://developers.cloudflare.com/r2/api/s3/presigned-urls/ | 2026-10-06 | PUT presigned with ContentType restriction; "POST ... is not currently supported"; expiry 1 s to 7 days. |
| S14 | documentation | R2 Pricing | Cloudflare | https://developers.cloudflare.com/r2/pricing/ | 2026-10-06 | Free tier 10 GB-month, 1M Class A, 10M Class B; $0.015/GB-month after; egress free. |
| S15 | documentation | R2 Data security | Cloudflare | https://developers.cloudflare.com/r2/reference/data-security/ | 2026-10-06 | "All objects stored in R2, including their metadata, are encrypted at rest... AES-256." |
| S16 | documentation | Default encryption FAQ | AWS | https://docs.aws.amazon.com/AmazonS3/latest/userguide/default-encryption-faq.html | 2026-10-06 | Since 2023-01-05 all new S3 uploads are encrypted with SSE-S3 (AES-256) at no cost; cannot be disabled. |

## Claims (revision 2)

### Q4 — R2 / S3
- C22. R2 supports presigned PUT and can restrict Content-Type. [S13]
- C23. R2 does not support presigned POST; no content-length limit documented for presigned URLs. [S13]
- C24. R2 presigned expiry: 1 s to 7 days. [S13]
- C25. R2 encrypts objects and metadata at rest with AES-256 by default. [S15]
- C26. S3 applies SSE-S3 (AES-256) by default to all new objects. [S16]
- C27. R2 is $0 within the free tier, no egress fees; $0.015/GB-month beyond. [S14]

### Q5 — Validation
- C28. OWASP: client Content-Type is untrusted; use extension allowlist + signature validation (+ re-encoding for images), size limits, random filenames, authorization. [S12]
- C29. `get(pathname, { access: 'private' })` returns a `ReadableStream` plus metadata, so server-side header sniffing is feasible; `abortSignal` documented, range option not. [S9]
- C30. `del()` removes one or many blobs; usable after a magic-byte mismatch. [S9]

### Q6 — Token options and cleanup
- C31. `onBeforeGenerateToken` may return `allowedContentTypes`, `maximumSizeInBytes` (no limit by default), `validUntil` (default 1 h), `addRandomSuffix` (default true), `allowOverwrite`, `tokenPayload`, `callbackUrl`. [S9]
- C32. `list()` supports `prefix`/`cursor`/`limit` and returns `uploadedAt`/`size`, enabling a sweep of orphan blobs. [S9]
- C33. Cron Jobs exist on Hobby: at most once per day, ±59 min precision; Pro allows once per minute. [S10]

### Q7 — Hobby terms
- C34. Hobby is non-commercial personal use only; commercial use needs Pro or Enterprise. [S11]
- C35. Commercial use includes financial gain of anyone in production, including a paid developer. [S11]
- C36. When unsure, Vercel says to contact Support. [S11]

## Non-authoritative product choices (revision 2)

- Always set `maximumSizeInBytes` (10485760) and `allowedContentTypes` (pdf, png, jpeg) explicitly; short `validUntil` (10-15 min).
- Store draft blobs under a per-user/per-draft prefix so `list()` can be scoped.
- One daily cron sweep deletes unreferenced blobs older than 24-48 h.
- R2/S3 remain fallbacks behind the `DocumentStore` port.

## Remaining gaps (non-blocking)

- S3 presigned POST `content-length-range` not admitted (S3 is a fallback only).
- Supabase not researched (optional).
- `maximumSizeInBytes` default wording conflicts in S9; always set it explicitly.
- No byte-range on `get()`; early stream cancellation transfer cost unverified.
- Whether a university pilot is "commercial" under S11 is undecided (product decision).

## Risks (revision 2)

- Hobby + paid/funded pilot may violate Vercel terms (C34-C35).
- Orphans can live ~24 h+ with a daily sweep.
- Missing size/type limits would make the token an unbounded upload path.
- A short window exists in which an unvalidated file sits in the private store before deletion.
