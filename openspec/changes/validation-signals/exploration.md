# Exploration: validation-signals

Scope (closed by the user): RF-05 (a)–(d); RN-07, RN-09, RN-10, RN-14, RN-15 and the new RN-26 (repeated document). Deferred to RF-14: RN-11, RN-12, RN-13, RN-24, RF-05 (e). Out of scope: NS-12, anomalous issuer volume across students. Each signal has three outcomes: present, absent, not evaluable.

## Current state (verified in code)

- `DocumentoRespaldo` (`src/db/schema.ts:386`) has no hash column. Finalize (`src/lib/data/documentos.ts` `finalizeDocument` → `inspectStoredFile`) only calls `store.readHead(pathname, SIGNATURE_HEAD_BYTES)`, which opens `get()` and cancels the stream after the head. `DocumentStore.stream()` exists (`vercel-blob-store.ts`, `FakeDocumentStore` in `src/lib/intake/fakes.ts`). `inspectStoredFile` is shared with the special-format attach (`src/lib/data/special-format.ts`).
- Extraction (`src/lib/extraction/run.ts`) already reads full bytes via `store.stream` + `readAll`, but only when `extractor.isConfigured()` and only for non-retired, student-uploaded, non-`FormatoEspecial` documents. The student instance has `EXTRACTION_API_URL` empty, so a hash computed only in extraction would never exist there.
- `ExtraccionDocumento` (`schema.ts:793`): `estado` pendiente|procesando|completada|fallida|no_aplica; `nombreEstudiante`, `emisor` (free text, varchar 200), `fechaEmision`, `reposoDesde`, `reposoHasta`, `reposoDias`. Dates are null unless `completada`; `reposoHasta >= reposoDesde`; `validate.ts` accepts both dates (days computed) or days only. Read model: `listExtractions()` in `src/lib/data/extraction.ts` (fail-soft `{data, degraded}`; excludes retired, staff uploads, `no_aplica`).
- Business days: `deadlineOf(start, calendar)` in `src/lib/intake/business-days.ts` = 2nd business day strictly after `start` (RN-08). RN-07 = `managuaToday(presentadaEn) > deadlineOf(fechaFin, calendar)`. The calendar (`src/lib/intake/calendar.ts`) covers 2026–2027 only (`coversYear()`).
- No normative-parameter mechanism exists (RNF-14 = roadmap #8, pending). Constants live in `src/lib/intake/limits.ts`, `business-days.ts`, `extraction/limits.ts`.
- Academic period: `Grupo.periodo` (`^\d{4}-S[12]$`). A request reaches it only through `SolicitudAsignatura` → `Grupo`.
- Staff detail `src/app/(dashboard)/review/[id]/page.tsx`: a stack of `Section` cards; its comment anticipates the document signals as "one more entry". `ExtractionSection` is the model for a `SignalsSection`. `Section`/`Fact`/`useDates` in `review/[id]/request-sections.tsx`; `DegradedAlert`.
- Coordination detail `src/app/(dashboard)/coordination/[id]/page.tsx` via `getCoordinationDetail` (`src/lib/data/coordination-queue.ts`): dates, documents, classes; no extraction data (the spec says extracted data must not be shown to non-secretary roles). Scope: secretary = faculty, coordinator = career.
- Corrections reuse the same `Solicitud` (`reenviadaEn`; documents soft-retired via `retiradoEn`; `SolicitudRevision.documentoIds` jsonb snapshot).
- Migrations `drizzle/0000..0012`; next is 0013 via `drizzle-kit generate`; applying it needs explicit user confirmation. The intake sweep has a bounded extraction step (`SWEEP_BATCH_SIZE=10`), a precedent for a backfill step. SHA-256 precedent: `node:crypto` in `src/lib/import/parse.ts`.

## 1. Fingerprint

- Compute at **finalize**: it always runs for every student document, unlike extraction. Extend the store port so one `get()` feeds both the signature check (first bytes) and `createHash('sha256')` (whole stream, flat memory). Max 10 MiB: hashing is milliseconds; the cost is the blob transfer, negligible next to `maxDuration = 300` on the upload pages. Enforce the size from the stream too. Special-format attach does not store a hash.
- Column `DocumentoRespaldo."HuellaSha256" char(64) NULL` + hex CHECK + partial index `WHERE NOT NULL`. Additive migration 0013.
- Backfill: (a) old documents stay not evaluable and never match — zero code (recommended now); (b) lazy on read — rejected (writes on a read path); (c) bounded step in the daily sweep — ~80 lines + tests; (d) one-off local script — needs DB write confirmation.
- Thesis limitation: exact-bytes SHA-256; a re-saved, re-compressed or screenshotted image evades it.

## 2. RN-26 semantics

- Compare current, non-retired student documents of request R (`SubidoPorId IS NULL`, `FormatoEspecial = false`, `estado = 'valido'`, hash not null) with documents of requests whose id differs from R. Same-request matches (correction re-upload) never trigger. Staff uploads excluded on both sides.
- Other side: presented requests only (no drafts), in any state including `rechazada`/`devuelta` (reuse after rejection is the core case). Recommend including the other request's retired documents (they were presented in a prior version).
- No student filter (cross-student is a legitimate signal). Privacy: reveal the other request id only inside the caller's scope; otherwise show "present" with no reference. Never names.
- Open: symmetric vs earlier-only. Recommend earlier-only (compare by `presentadaEn`, id): stable after decision, mirrors RF-05 (c), reproducible concordance.
- Not evaluable when all current documents lack a hash or there are no eligible documents.

## 3. Persistence

- A) Compute on read: pure functions + two queries (RN-14 history, RN-26 hash lookup). Reflects late extraction. Weakness: the thesis cannot reconstruct what the secretary saw at decision time.
- B) A + codes-only snapshot (outcomes + verdict + params version) written in the `decideRequest` transaction. ~+100 lines. Touches `decideRequest`, schema and the audit-log spec.
- C) Persisted table recomputed by hooks — rejected for the deadline.
- Recommend A as core, B optional. No audit row beyond `solicitud.consultada`; queue untouched.

## 4. Inputs per signal

- RN-07: `presentadaEn` (first presentation, not `reenviadaEn`) + `fechaFin` + calendar; not evaluable when the calendar does not cover the deadline year.
- RN-09: per completed document with `fechaEmision` and `reposoHasta`: present iff `reposoHasta < fechaEmision`. Days-only → not evaluable for that document. Request level: present if any present; absent if ≥1 evaluable and none present; else not evaluable.
- RN-10: needs `reposoDesde` + `reposoHasta`. Options: full containment of the absence by the union of rest periods (recommended), any overlap, or class days only (RN-22). Days-only documents with an uncovered dated union → not evaluable.
- RN-14: normalize `emisor` in TypeScript (NFD, lowercase, punctuation, whitespace) — not SQL (`unaccent` needs `CREATE EXTENSION`). Count distinct presented requests of the same student in the same period with that issuer, up to and including the current one (Nth flagged). Period from `Grupo.periodo`; none → not evaluable. Heuristic: OCR variants undercount.
- Threshold: constant passed as a params object into the pure evaluator; #8 can feed it later. RNF-14 not yet met.

## 5. Verdict options (not decided)

- V1: any present → "review carefully"; none present and all evaluable → "approvable"; none present with some not evaluable → "incomplete".
- V2: V1 with hard (RN-26, RN-09, RN-10) and soft (RN-07, RN-14) severities.
- V3: map to decisions — couples to RN-17 and risks implying a state change (RN-15).
- With extraction off, V1 shows "incomplete" almost always; consider listing not-evaluable signals apart from the verdict.
- Display-only (RN-15, RF-05 d): no write path reads it; test it.

## 6. UI

- Secretary detail: `SignalsSection` with a verdict banner; reuse `Section`, `Fact`, `useDates`, `DegradedAlert`; outcome as text, never colour alone; i18n es + en under `review.signals.*`.
- Coordination detail: same read-only section from a coordination-safe projection (outcomes + labels only).
- Students see nothing.

## 7. Specs to amend

- New capability `validation-signals`.
- `request-review`: signals and suggested verdict on the staff detail.
- `supporting-documents`: finalize computes and stores the SHA-256 (MODIFIED).
- `coordination-escalation`: coordinator view and confidentiality (MODIFIED).
- `audit-log`: only with option B. `document-extraction`: none. `student-requests`: students never see signals.
- Docs: add RN-26 and the RF-05 criteria to `docs/requirements.md` + changelog row; roadmap row #5; `docs/pendientes-validacion-tesis.md`.

## 8. Risks and size

- RN-09, RN-10, RN-14 are not evaluable without the model server or RF-14; only RN-07 and RN-26 work without extraction. The 2026-11-03 system tests need seeded `completada` extraction rows or the model server.
- Migration 0013 needs explicit confirmation; regenerate if another change lands first.
- Privacy/consent: hashing and cross-request comparison of health documents is new processing not mentioned by `CONSENT_VERSION` 2026-10-22 nor `/privacy`. Owner decision.
- Cross-scope leakage via RN-26 evidence (RNF-01).
- Calendar ends in 2027; heuristic issuer normalization; exact-hash evasion; one extra full-blob read per upload.
- Size: core ~1,500–1,800 authored lines with tests, plus ~500 lines of specs/docs. Exceeds a 1,500-line single PR. Candidate slices: S1 pure evaluators + read assembly + secretary UI (RN-07/09/10/14, no schema); S2 fingerprint + RN-26 (migration); S3 coordination view (+ optional snapshot, backfill).

## Open decisions for the proposal

Verdict taxonomy; RN-26 order; RN-10 coverage rule; decision snapshot (B); consent/privacy impact; delivery strategy.
