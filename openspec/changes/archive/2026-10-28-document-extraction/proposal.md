# Proposal: Document Extraction

## Intent

Staff read every supporting document by hand to find issuer, issue date and rest period. Deliver roadmap row 4: RF-11 (a, b) and RNF-03 (2026-10-22 criterion), respecting RN-02, RNF-02, RNF-04 and FA-04. Decisions closed in `docs/investigacion/ocr-document-extraction.md` section 11, the spike results and exploration `sdd/document-extraction/explore` are authoritative.

## Scope

### In Scope
- Engine: NuExtract3 4B, no reasoning, temperature 0.2, over llama.cpp's OpenAI-compatible API (local Docker `nuextract3` in dev). Images and scanned pages sent as images (sharp: EXIF rotate, max width 1600).
- Text-layer PDFs: unpdf text sent to NuExtract3; returned values must appear in the text. Any page without a text layer -> render pages (capped) as images. First apply task measures text mode on 2-3 PDFs; if it fails, text-layer PDFs take the image path (no rules extractor).
- Code-side validation: rest period only with explicit dates or duration; days computed in code; year plausibility window (defined in specs).
- `ExtraccionDocumento` table (1:1, claim/lease like `Remision`); no `Confianza`, no `NombreCoincide`, never raw text.
- Post-commit `after()` in submit and correction actions: idempotent registration (valid, non-retired, student-uploaded docs without a row; retired -> `no_aplica`), sequential per-document extraction under a deadline.
- Cron `intake-sweep` step 4: re-enqueue `pendiente`, expired leases and missing rows, scoped to `pendiente` requests, bounded batch (covers backfill).
- `EXTRACTION_API_URL` + optional `EXTRACTION_API_KEY` bearer; HTTPS required for non-loopback hosts.
- `maxDuration = 300` on `requests/new`, `requests/[id]/correct` and the cron route.
- Staff-only "Extracted data" section, fail-soft; null -> "no reconocido"; extracted name never replaces the snapshot name (RN-02).
- RNF-03 test: fetch interception over 10 extractions.

### Out of Scope
- `validation-signals` (RF-05, RF-14, RN-24 manual entry, name-match flag), `escalation`, `coordination-reports`.
- Deploying the model server to serverless GPU; Tesseract; audit events (D14 precedent).

### Decisions from the proposal review (2026-10-22)

1. The "Extracted data" section is visible to the roles that can already open the staff detail (`permissions.ts`).
2. A document whose extraction fails permanently shows as unavailable ("review the document") with no action, until `validation-signals` adds manual entry.
3. Without `EXTRACTION_API_URL`, staff see an explicit configuration-needed message, not a perpetual "extracting" state. Copy (es), neutral register like the existing staff strings: «Hace falta configurar el servicio de extracción. Contacte al administrador del sistema.» It never names the environment variable.
4. Issue and rest dates outside a plausibility window relative to submission are discarded as "no reconocido": issue date and rest start from one year before submission up to submission; rest end up to 30 days after submission, so a request filed mid-rest keeps its rest period. Exact rules in specs.
5. Requests already `pendiente` when the change ships are extracted too, in bounded batches.

## Capabilities

### New Capabilities
- `document-extraction`: triggers, state machine, engine contract, validation, retries, RNF-03 boundary.

### Modified Capabilities
- `justification-intake`: sweep gains the re-enqueue step.
- `request-review`: staff detail shows extracted data per document.

## Approach

Hexagonal slice `src/lib/extraction/` (ports `DocumentPreparer`, `FieldExtractor`, `ExtractionQueue`; `run.ts`; fakes), data layer `src/lib/data/extraction.ts`, approach B from exploration. Strict TDD.

## Affected Areas

| Area | Impact |
|------|--------|
| `src/lib/extraction/**`, `src/lib/data/extraction.ts` | New |
| `src/db/schema.ts`, `drizzle/0011_*` | Modified/New |
| `requests/new`, `requests/[id]/correct` actions and pages | Modified |
| `src/lib/data/intake-sweep.ts`, cron route | Modified |
| `review/[id]/page.tsx`, `i18n/{es,en}.json` | Modified |
| `src/env.ts`, `package.json`, `next.config.ts` | Modified |

**DB schema: YES** (migration 0011). Generated only; applied to Neon only after explicit per-command user confirmation.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| ~2,000-2,500 lines vs 800 budget with `single-pr` | High | Tasks phase forces the decision; suggested 3 slices (domain+data; adapters+RNF-03; producers+sweep+UI) |
| Model invents rest periods, completes years | Med | Code validation; RN-24 later |
| `@napi-rs/canvas` packaging, text mode unproven | Med | Lazy import -> error code; preview proof; measure first |
| GPU cold start vs `maxDuration` | Med | Deadline, fetch timeout, lease |
| Daily cron delays failed docs 24 h | Med | `after()` primary path |
| PII in logs | Low | Codes only, never values (RNF-04) |

## Rollback Plan

Revert the PR. If 0011 was applied, a confirmed down-migration drops `ExtraccionDocumento`; requests and documents are untouched. Unset `EXTRACTION_API_URL` to stop extraction without a code change (rows stay `pendiente`).

## Dependencies

- Local `nuextract3` container; migration 0011 applied with confirmation before the code deploys.

## Success Criteria

- [ ] Submit/correction extracts each eligible document; staff see issuer, issue date, rest period, name, or "no reconocido".
- [ ] Model outage never blocks submission; rows recover via cron.
- [ ] RNF-03 test: across 10 extractions, only the configured model host receives document content.
