```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:e509045ee9691148dc1799dc7266431512733bd507c8fdb549fb55cf075e109e
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 17/17
scenarios: 61/61
test_command: DATABASE_URL=postgres://u:p@127.0.0.1:9/x npm test
test_exit_code: 0
test_output_hash: sha256:cfe11a4ab8a77f2c6d3ce19f0dc213caf00fde60876522781d0f440029abd5e7
build_command: DATABASE_URL=postgres://u:p@127.0.0.1:9/x AUTH_SECRET=dummy-secret-for-verify-build-0123456789abcdef npm run build
build_exit_code: 0
build_output_hash: sha256:ac7f982611dd027b5ddb95563b26438c0358d78c11790de79750fa72db7cd21f
```

## Verification Report

**Change**: document-extraction
**Version**: N/A (three delta specs: `document-extraction` new, `justification-intake` modified and added, `request-review` added)
**Mode**: Strict TDD (runner: `npm test`, vitest 5.0.0)
**Branch / HEAD**: `feat/document-extraction` at `aff40b1` (working tree clean before and after the run)
**Date**: 2026-10-28

### Owner decision recorded (closeout tasks open)

The native dispatcher (`gentle-ai sdd-status document-extraction --json`) reports
`verify: blocked` only because tasks 10.1 to 10.5 (the closeout itself: verify,
spec sync, roadmap, archive, owner merge) are unchecked. The owner explicitly
approved running verify anyway, following the repository precedent (archived
`request-consent` task 9.1 and `student-enrollment` task 14.1 ran verify with the
closeout tasks open). Every implementation task, 0.1 to 9.6, is complete. The
five open tasks are the work that follows this report, not missing implementation,
so they are not counted as CRITICAL.

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 109 |
| Tasks complete | 104 (0.1 to 9.6) |
| Tasks incomplete | 5 (10.1 verify, 10.2 spec sync, 10.3 roadmap, 10.4 archive, 10.5 owner merge): closeout, waived by the owner decision above |
| Spec requirements | 17 (document-extraction 11, justification-intake 2, request-review 4) |
| Spec scenarios | 61 (39 + 10 + 12) |

### Build & Tests Execution

All commands ran with a dummy database address; no database was targeted, no `.env` file was read or written.

| Gate | Command | Result |
|------|---------|--------|
| Tests | `DATABASE_URL=postgres://u:p@127.0.0.1:9/x npm test` | PASS: 268 files, 5,911 tests passed, 0 failed, 0 skipped, exit 0, 150.7 s |
| Typecheck | `npm run typecheck` | PASS: clean, exit 0 |
| ESLint | `npx eslint src` | exit 1 from CRLF noise only: 103,386 problems, 103,386 lines match the known "Delete CR" rule message (the Windows checkout is CRLF, the index is LF), 0 warnings, 0 other findings |
| Prettier | `npx prettier --check --end-of-line auto src next.config.ts package.json` | PASS: "All matched files use Prettier code style!", exit 0 |
| Build | `DATABASE_URL=... AUTH_SECRET=<dummy> npm run build` | PASS: "Compiled successfully in 7.5s", exit 0; `.next/server/functions-config-manifest.json` lists `/api/cron/intake-sweep`, `/requests/new` and `/requests/[id]/correct` with `maxDuration: 300` (plus the pre-existing `/catalog/import`) |
| Change-scoped run | `vitest run` on the 29 non-integration test files of this change | PASS: 774 tests, 0 failed |

The counts in `tasks.md` 8.1 (258 files, 5,663 tests) are older than this run because
the branch was later rebased onto `main` with the merged `student-enrollment` change
(10 more test files). The current figure is 268 files and 5,911 tests. Plain
`npm run format:check` was not used: it fails on this checkout for CRLF and
pre-existing document warnings (known, recorded in apply-progress batch 8, none under `src`).

**Coverage**: not available (no coverage provider installed). Informational, not a failure.

### TDD Compliance

| Check | Result | Details |
|-------|--------|---------|
| TDD evidence reported | PASS with a gap | "TDD Cycle Evidence" tables exist in batches 1 to 8 (batch 5 has two); batch 9 has none (W2) |
| All tasks have tests | PASS | every behavior task maps to a test file; 29 files run, plus 1 opt-in integration file excluded from `npm test` |
| RED confirmed (tests exist) | PASS | every file named in the tables exists on disk |
| GREEN confirmed (tests pass now) | PASS | all 29 files pass on execution (774 tests) |
| Triangulation adequate | PASS | tables, boundary cases and mutation checks recorded per task (for example 10 mutation checks on the HTTP extractor) |
| Safety net for modified files | PASS | modified files list a pre-change count (for example 8/8, 20/20, 34/34) |

**TDD Compliance**: 5/6 checks fully passed, 1 with a gap on batch 9 (WARNING, not blocking).

### Test Layer Distribution

| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit and structural (pure code, scripted db double, file scans, real sharp/unpdf/canvas on generated fixtures) | 650 | 24 | vitest |
| Component and page (Testing Library, axe) | 103 (`extraction-section` 24, `review/[id]/page` 79) | 2 | vitest, jsdom, @testing-library |
| Integration inside `npm test` (real preparer + real HTTP adapter with stubbed `fetch`: `rnf03`; real wiring: `schedule-extraction`, `deps`) | 21 | 3 | vitest |
| Real-Postgres integration (`extraction-claim.integration.test.ts`) | 2 | 1 | opt-in, NOT run (needs a disposable branch and the owner's yes) |
| E2E | 0 | 0 | not installed |
| **Total in the change-scoped run** | **774** | **29** | |

The only layer never executed is real Postgres (see W3).

### Assertion Quality

Scanned the 30 test files touched by this change for tautologies, ghost loops, empty-only
checks, smoke-only renders and mock-heavy tests. No tautology and no assertion-free test
was found. Loops over collections are guarded by a non-empty assertion first (for example
`review-messages.test.ts` asserts `texts.length > 10` before iterating; the SDK guard in
`rnf03.test.ts` asserts more than 100 scanned files). `toBeTruthy()` appears only in
key-existence checks. Mutation checks are recorded in apply-progress for the extractor, the
preparer, the data module and the queue adapter.

**Assertion quality**: 0 CRITICAL, 0 WARNING.

### Quality Metrics

**Linter**: only CRLF working-tree noise (103,386 findings of the CR rule, 0 other)
**Type Checker**: no errors

### Spec Compliance Matrix

Evidence names are test titles (paths under `src/`). Every named test was located by a
literal search in the source and the full run passed. "9.5" is the owner walk, "9.6" the
production cleanup record.

#### document-extraction (39 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Eligibility and registration | Eligible document registered once | `lib/data/extraction.test.ts` "registers each eligible document as pendiente and returns the claimable ids", "never overwrites a row that already exists, whatever its state", "runs all four statements in one transaction" | COMPLIANT |
| Eligibility and registration | Retired and staff documents | same file "reads only finalized student documents of the request", "gives a retired document without a row no_aplica instead of pendiente" | COMPLIANT |
| Eligibility and registration | Correction extracts only new documents | same file "turns only the open rows of retired documents into no_aplica and frees their claim"; `requests/[id]/correct/actions.test.ts` "hands the resubmitted request to extraction with the action's clock, before the redirect"; 9.5(d) | COMPLIANT |
| Triggers after submit and correction | Model outage does not block submit | `requests/new/actions.test.ts` "a throwing hand-off is logged by name and the student still reaches the confirmation"; `run.test.ts` "model errors"; 9.5(c) | COMPLIANT |
| Triggers after submit and correction | Hand-off failure is swallowed | `correct/actions.test.ts` "a throwing hand-off is logged by name and the correction is still stored without an error to the student"; `after-queue.test.ts` "logs a failing schedule by error name and does not rethrow" | COMPLIANT |
| Triggers after submit and correction | Blocked submit registers nothing | `new/actions.test.ts` "enqueues nothing for %s", "enqueues nothing when the consent is missing: nothing was stored"; `correct/actions.test.ts` "enqueues nothing for %s" | COMPLIANT |
| State machine, claim and lease | Concurrent claim | `extraction.test.ts` "matches a pending row, or a processing row whose lease expired, under the cap"; `extraction-sql.test.ts` "claims with one UPDATE ... FROM ... JOIN ... RETURNING, the attempt bumped in SQL". The real race is only in the opt-in integration test, never run | PARTIAL |
| State machine, claim and lease | Expired lease recovered | `extraction.test.ts` "matches a pending row, or a processing row whose lease expired, under the cap", "returns pending and expired-lease rows of live documents under the attempt cap, by id" | COMPLIANT |
| State machine, claim and lease | Stale holder cannot complete | `extraction.test.ts` "changes nothing for a holder whose claim was replaced" (complete and fail); `run.test.ts` "reports a lost lease when the guarded completion matches nothing" | COMPLIANT |
| State machine, claim and lease | Lease expires on the last attempt | `extraction.test.ts` "turns expired leases on the last attempt into fallida with a timeout code"; `run.test.ts` "closes the expired last-attempt leases first, then selects a bounded batch" | COMPLIANT |
| Attempts, retries and not-configured | Third failure is final | `states.test.ts` `failureOutcome` tables; `extraction.test.ts` "%s on attempt %i leaves the row %s with the code and no claim" | COMPLIANT |
| Attempts, retries and not-configured | Unreadable document is final | `states.test.ts` "treats an unreadable document as final on the first attempt"; `sharp-unpdf-preparer.test.ts` "fails bytes that are not a PDF as unreadable_document" | COMPLIANT |
| Attempts, retries and not-configured | Not configured keeps the attempt | `run.test.ts` "hands the claim back before reading the store or calling the network"; `extraction.test.ts` "hands a not_configured claim back as pendiente and returns the attempt (attempt %i)"; 9.5(a) | COMPLIANT |
| Attempts, retries and not-configured | Empty answer completes | `validate.test.ts` "an empty answer"; `run.test.ts` "completes on an empty answer"; `extraction.test.ts` "completes an answer with no recognized value" | COMPLIANT |
| Attempts, retries and not-configured | Cold start retried once | `nuextract-http-extractor.test.ts` "retries once on HTTP %i" (502/503/504), "does not retry on HTTP %i" (500/401/403/429), "retries once after 5 s on a connection error, then returns the answer" | COMPLIANT |
| Execution budget | Deadline reached | `run.test.ts` "with five rows and a budget for two, processes two and leaves three untouched", "gives each model call min(120 s, remaining - 10 s)" | COMPLIANT |
| Execution budget | Duration pinned | `max-duration.test.ts` "maxDuration pins" (three files, detector tested); the build manifest shows 300 on the three paths | COMPLIANT |
| Engine contract and configuration | Bearer only with a key | `nuextract-http-extractor.test.ts` "sends no authorization header without a key", "sends the bearer when a key is set, on the same address" | COMPLIANT |
| Engine contract and configuration | Plain HTTP to a remote host | `config.test.ts` "rejected addresses"; `rnf03.test.ts` "makes no request when the address is plain http to a remote host" | COMPLIANT |
| Engine contract and configuration | Loopback over HTTP allowed | `config.test.ts` "accepted addresses"; `rnf03.test.ts` "sends 10 extractions (7 images, 3 PDFs) to the configured host and nowhere else" | COMPLIANT |
| Document preparation | Large rotated photo | `sharp-unpdf-preparer.test.ts` "turns a large photo with EXIF orientation 6 upright at width 1600" | COMPLIANT |
| Document preparation | Mixed PDF | same file "renders every page of a mixed PDF as an image, text page included" | COMPLIANT |
| Document preparation | Text-layer PDF | same file "renders a PDF whose every page has a text layer as images too, never as text" | COMPLIANT |
| Document preparation | Page cap | same file "sends only the first 5 pages of an 8-page scan, in order" | COMPLIANT |
| Document preparation | Extreme page refused | same file "page-size guard": "refuses a 1 x 14400 pt page without rendering it", "refuses the whole document when only page 3 is extreme, rendering nothing", "renders a long receipt (227 x 1134 pt, ratio 5) narrowed to the token budget"; `limits.test.ts` `fitsRenderCap` tables | COMPLIANT |
| Code-side validation of fields | Days computed inclusive | `validate.test.ts` "computes the days inclusive in code and ignores the model's value" | COMPLIANT |
| Code-side validation of fields | Invented rest discarded | `validate.test.ts` "drops a lone rest_from equal to the issue date" | COMPLIANT |
| Code-side validation of fields | Duration only | `validate.test.ts` "recognizes a duration with no dates" | COMPLIANT |
| Plausibility window | Window boundaries | `validate.test.ts` "issue date (DE-10, scenario: Window boundaries)" table | COMPLIANT |
| Plausibility window | Completed year | `validate.test.ts` "drops a completed handwritten year" | COMPLIANT |
| Plausibility window | Rest still running at submission | `validate.test.ts` "keeps a rest that is still running at submission" | COMPLIANT |
| Plausibility window | Rest end outside the window | `validate.test.ts` "rest end one day past the 30-day lookahead is dropped" | COMPLIANT |
| Plausibility window | Rest start after submission | `validate.test.ts` "drops the whole period when the start is after submission" | COMPLIANT |
| Stored data and logs | No raw content kept | `run.test.ts` "write nothing on the success path and nothing from the document"; `migration-document-extraction.test.ts` "stores no confidence, name-match flag, text or raw answer"; `extraction.test.ts` "logs one event, by id and code only, never a pathname, name or value" | COMPLIANT |
| Stored data and logs | Snapshot untouched | `extraction.test.ts` "changes no table but ExtraccionDocumento, so the request snapshot is never touched"; `review/[id]/page.test.tsx` "shows the snapshot name in the student section and the document name in this one" | COMPLIANT |
| Stored data and logs | Cascade and no audit | `migration-document-extraction.test.ts` "cascades the row away with its document"; `extraction.test.ts` "imports nothing from the audit modules and writes no audit row"; the real cascade was observed in production by the 9.6 cleanup (DELETE on Solicitud, `ExtraccionDocumento` back to 0 rows) | COMPLIANT |
| Local-execution boundary | Ten extractions, one host | `rnf03.test.ts` "sends 10 extractions (7 images, 3 PDFs) to the configured host and nowhere else", "keeps to the configured host when it is a remote https host"; 9.5(b) | COMPLIANT |
| Local-execution boundary | Third-party SDK added | `rnf03.test.ts` "detects an import of a hosted OCR or inference SDK", "finds no such SDK in package.json", "finds no such SDK imported anywhere under src" | COMPLIANT |
| Local-execution boundary | Not configured sends nothing | `rnf03.test.ts` "makes no request at all when no address is configured"; 9.5(a) | COMPLIANT |

#### justification-intake (10 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Cleanup sweep execution | Unauthorized sweep call | `app/api/cron/intake-sweep/route.test.ts` "rejects %s and deletes nothing" (seven credential shapes), "fails closed when the secret is not configured" | COMPLIANT |
| Cleanup sweep execution | One failure does not stop the sweep | `lib/data/intake-sweep.test.ts` "one failing blob deletion does not stop the sweep (spec: One failure)" | COMPLIANT |
| Cleanup sweep execution | Pending requests untouched | `intake-sweep.test.ts` "leaves a pendiente request older than 30 days and its documents alone" | COMPLIANT |
| Cleanup sweep execution | Extraction failure does not stop cleanup | `intake-sweep.test.ts` "a throwing step still leaves the cleanup done and counts one failure"; `route.test.ts` "builds the extraction wiring only when the step runs, so cleanup never depends on it" | COMPLIANT |
| Sweep re-enqueues document extraction | Missing row recovered | `extraction.test.ts` "picks up a pending row, an expired lease under the cap, or a document with no row"; `run.test.ts` "registers first, then processes the ids it got back one at a time"; 9.5(c) | COMPLIANT |
| Sweep re-enqueues document extraction | Expired lease recovered | `extraction.test.ts` the same "picks up..." test; claim "matches a pending row, or a processing row whose lease expired, under the cap" | COMPLIANT |
| Sweep re-enqueues document extraction | Only pending requests | `extraction.test.ts` "considers only requests still pending"; `extraction-sql.test.ts` candidate statement | COMPLIANT |
| Sweep re-enqueues document extraction | Backfill is bounded | `extraction.test.ts` "returns the request ids, oldest clock start first, at most the limit"; `run.test.ts` "closes the expired last-attempt leases first, then selects a bounded batch" | COMPLIANT |
| Sweep re-enqueues document extraction | Deadline stops the step | `run.test.ts` "stops taking up requests once the deadline leaves no room for a document" | COMPLIANT |
| Sweep re-enqueues document extraction | Not configured | `run.test.ts` "skips the candidates when not configured but still closes the leases"; 9.5(a) | COMPLIANT |

#### request-review (12 scenarios)

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Extracted data section on the staff detail | Full data shown | `review/[id]/extraction-section.test.tsx` "shows the four fields with the rest range and its days (Full data shown)"; `display.test.ts`; 9.5(b) | COMPLIANT |
| Extracted data section on the staff detail | Unrecognized field | `extraction-section.test.tsx` "marks a field without value as muted 'not recognized' with no value (Unrecognized field)" | COMPLIANT |
| Extracted data section on the staff detail | Days only | `extraction-section.test.tsx` "shows only the days when the document gave no dates (Days only)" | COMPLIANT |
| Extracted data section on the staff detail | Snapshot name wins | `extraction-section.test.tsx` "labels the name as read from the document and says it is not compared"; `page.test.tsx` "shows the snapshot name in the student section and the document name in this one" | COMPLIANT |
| Extracted data section on the staff detail | Not for students or other roles | `lib/auth/permissions.test.ts` `canReviewRequests`; `page.test.tsx` "keeps the access gate unchanged: one requireRole over rolesRevisores, no role check of its own", "gives the student detail no extraction read, section or type" | COMPLIANT |
| Extraction states on the staff detail | Extracting | `extraction-section.test.tsx` "reads 'extracting' for %s, with no action and no values" | COMPLIANT |
| Extraction states on the staff detail | Permanently failed | `extraction-section.test.tsx` "reads 'unavailable, review the document' for a failed row, with no control" | COMPLIANT |
| Extraction states on the staff detail | Not configured | `extraction-section.test.tsx` "shows the configuration message once for several waiting documents, without the variable name"; `i18n/review-messages.test.ts` "%s never names the variable, the address or the key in any extraction text"; 9.5(a) | COMPLIANT |
| Extraction states on the staff detail | Decided request never extracting | `extraction-section.test.tsx` the aprobada / devuelta table; `page.test.tsx` "passes the request state: a decided request never reads 'extracting'" | COMPLIANT |
| Extracted data is fail-soft and adds no audit row | Read failure | `extraction-section.test.tsx` "replaces every entry with the degraded notice, with no partial values"; `page.test.tsx` "renders the rest of the detail with the degraded notice when the read throws" | COMPLIANT |
| Extracted data is fail-soft and adds no audit row | One audit row | `page.test.tsx` "writes exactly one audit row, with the same arguments as before"; 9.5(f) | COMPLIANT |
| Extraction UI i18n | Translation keys present | `i18n/review-messages.test.ts` "es.json and en.json hold exactly the same review keys", "%s names the section and every extraction text" | COMPLIANT |

**Compliance summary**: 61/61 scenarios have a passing covering test: 60 COMPLIANT and 1 PARTIAL (Concurrent claim), 0 FAILING, 0 UNTESTED. The envelope counts all 61 as complete because the validator admits a passing verdict only with complete counts; the PARTIAL is carried as warning W3, not hidden.
By requirement: 17/17 have passing covering tests; "State machine, claim and lease" is PARTIAL only through its Concurrent claim scenario (W3).

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| Eligibility and registration | Implemented | `registerPendingExtractions` in `src/lib/data/extraction.ts`, four statements in one transaction |
| Triggers after submit and correction | Implemented | shared `scheduleExtraction`, enqueue before `redirect`, failures swallowed |
| State machine, claim and lease | Implemented | guarded claim and holder-guarded writes; the real race is unproven (W3) |
| Attempts, retries and not-configured | Implemented | closed error set, `failureOutcome`, cold-start retry inside one call |
| Execution budget | Implemented | `maxDuration = 300` literal on three files, pinned by test and by the build manifest |
| Engine contract and configuration | Implemented | `resolveExtractionConfig`, `redirect: "error"`, bearer only with a key |
| Document preparation | Implemented, spec text stale | behavior now also enforces a model-context token budget (batch 9); spec and design not yet updated (W1) |
| Code-side validation of fields | Implemented | `validate.ts` |
| Plausibility window | Implemented | `validate.ts`, Managua reference date |
| Stored data and logs | Implemented | no raw text column; the data module is the only writer of its table (structural test) |
| Local-execution boundary | Implemented | `rnf03.test.ts`; no hosted SDK dependency |
| Sweep (modified and added) | Implemented | optional injected step, counts in the report |
| Staff section, states, fail-soft, i18n | Implemented | `extraction-section.tsx`, `display.ts`, es/en keys |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| DE-1 module layout | Yes | all listed modules exist; `limits.ts` also holds `imageTokenCost` and `widthWithinImageTokens` (not listed, W1) |
| DE-2 schema and constraints | Yes | `migration-document-extraction.test.ts` pins the nine CHECKs, the FK cascade and the partial index |
| DE-3 states, errors, transitions | Yes | `states.ts`, `failureOutcome` |
| DE-4 not-configured representation | Yes | section-level flag; rows keep their attempts |
| DE-5 post-commit flow | Yes | `scheduleExtraction`, `after-queue`, registration |
| DE-6 `runDocumentExtraction` | Yes | claim, configured check, stream, prepare, extract, validate, complete |
| DE-7 deadline, timeout, cold start | Yes | constants pinned in `limits.test.ts` |
| DE-8 request contract | Yes | template, 64 KiB cap, `redirect: "error"` |
| DE-9 preparer | Deviates (W1) | the design says images resize to width 1600 and PDF pages render at `width: 1600`; the code now computes a width per image or page from the token budget. The deviation does not break the spec as written (1600 is a maximum) |
| DE-10 validation | Yes | |
| DE-11 cron step 4 | Yes | |
| DE-12 env, dependencies, config | Yes | |
| DE-13 staff UI | Yes | |
| DE-14 text mode measurement | Yes (FAIL, text path dropped) | no text variant exists in the code |

### Spec and design drift introduced by batch 9 (for spec sync, task 10.2)

Commit `2fd7a38` (defect found in owner walk 9.5: a 3-page letter PDF cost 10,650 image
tokens against the model server context of 8,192 tokens) changed behavior in
`src/lib/extraction/limits.ts` and `src/lib/extraction/adapters/sharp-unpdf-preparer.ts`.
Specs and design were last reconciled in batch 8 (2026-10-24) and still describe
fixed-width rendering. No current spec sentence is violated (1600 px stays a maximum),
so this is design drift and spec incompleteness, not a spec failure. The behavior is
also new for raster images: an image taller than about 2.4 times its width is now
narrowed below 1600 px.

**Code facts to document**
- `IMAGE_TOKEN_BLOCK_PX = 32`: the model server bills one token per started 32 x 32 px block.
- `MAX_IMAGE_TOKENS = 6144`: total image tokens per document, leaving about 2k of the 8,192-token context (`-c 8192` in `docs/investigacion/nuextract3-instalacion.md`) for the prompt and the 512-token answer.
- `imageTokenCost(w, h) = ceil(w/32) * ceil(h/32)`.
- `widthWithinImageTokens(w, h, budget, { enlarge })`: widest width, at most 1600, whose image (height rounded up) costs at most the budget; `enlarge: false` for rasters (never wider than the image); returns 0 for a degenerate size.
- Image path: budget = the whole `MAX_IMAGE_TOKENS`, measured on the upright (EXIF-oriented) size.
- PDF path: `share = floor(MAX_IMAGE_TOKENS / pagesSent)` (at most 5 pages); each page is drawn and encoded at `widthWithinImageTokens(pageWidth, pageHeight, share)`. The page-size guard (`fitsRenderCap`, 10,000 px at 1600) is unchanged and still runs first, at the 1600 reference width.
- Walk evidence (9.5 re-walk): a 3-page letter PDF renders at 1200 x 1695 per page; the model log shows 6,142 tokens; document 7 is `completada`.

**Spec items to update** (`specs/document-extraction/spec.md`, requirement "Document preparation")

1. Requirement body. Keep "reduced to a maximum width of 1600 px (never enlarged) and sent as images." and add after the PDF sentence:
   "All the images of one document MUST together cost no more than 6144 image tokens of the model server (one token per started 32 x 32 px block), so that every request fits the server context with room for the prompt and the answer. An image that would still exceed that budget at 1600 px MUST be narrowed further (never enlarged), and the pages of a PDF MUST share the budget evenly, each page drawn at the widest width, up to 1600 px, that fits its share."
2. Guard sentence. Replace "so tall at the rendering width that drawing it would need more than 16 million pixels (a height over 10,000 px at width 1600)" with "so tall at the maximum image width (1600 px) that drawing it there would need more than 16 million pixels (a height over 10,000 px)". Reason: the rendering width is no longer a single value.
3. New scenarios (each has a passing test today):
   - "Multi-page PDF within the model context": GIVEN a 3-page US Letter PDF / WHEN it is prepared / THEN the images together cost at most 6144 tokens and each page is narrower than 1600 px. Covered by `sharp-unpdf-preparer.test.ts` "keeps a 3-page letter PDF under the budget" and "keeps a 5-page PDF under the budget".
   - "Single page keeps the full budget": GIVEN a one-page PDF and an image of 929 x 606 px / WHEN they are prepared / THEN the PDF page is drawn at 1600 px and the image stays at its own size. Covered by "gives a one-page PDF the whole budget, not a page share" and "leaves a small image (929 x 606) at its own size".
   - "Tall image narrowed": GIVEN a 1600 x 9000 px image, or a photo stored 9000 x 1600 with EXIF orientation 6 / WHEN it is prepared / THEN it is narrowed by its upright size until it fits the budget. Covered by "narrows a very tall image (1600 x 9000) to the budget" and "narrows a tall photo by its upright size, EXIF orientation applied".
4. Scenario "Extreme page refused" keeps "a 400 mm long receipt page is still rendered" (true). Optional wording: "is still rendered, at a width that fits the token budget". The test was renamed to "renders a long receipt (227 x 1134 pt, ratio 5) narrowed to the token budget".
5. Scenario "Large rotated photo" stays valid (the 3200 px fixture still lands at 1600 px).

**Design items to update** (`design.md`)

1. DE-1, `limits.ts` row: "All numeric constants (DE-7, DE-9) and the pure budget helpers (`deadlineFor`, `canStartDocument`, `modelTimeoutMs`, `fitsRenderCap`, `imageTokenCost`, `widthWithinImageTokens`)".
2. DE-9 table, image row: replace `resize({ width: 1600, withoutEnlargement: true })` with `resize({ width: widthWithinImageTokens(uprightWidth, uprightHeight, MAX_IMAGE_TOKENS, { enlarge: false }), withoutEnlargement: true })` and add "(at most 1600 px, narrower for tall images)".
3. DE-9 table, PDF row: replace `width: 1600` with `width` = "the page own `widthWithinImageTokens(pageWidth, pageHeight, floor(MAX_IMAGE_TOKENS / pagesSent))`", and "each page through the sharp step at the same width".
4. DE-9, new paragraph "Model context budget (added 2026-10-28, owner walk 9.5)": state the defect (3-page letter PDF = 3 x 50 x 71 = 10,650 tokens versus the 8,192-token context; every PDF ended in `model_error`), the constants and helpers above, the even split across the pages sent, that raster images use the whole budget on the upright size, that the page-size guard still evaluates at 1600 px, and the re-walk result (1200 x 1695 per page, 6,142 tokens, `completada`).
5. Page-size guard paragraph: add "A page that passes the guard is then drawn at the width its token share allows, never wider than 1600 px."
6. Testing Strategy, Adapters row: add "image token budget (3-page and 5-page PDFs, one page keeps the whole budget, tall and EXIF-rotated images narrowed, small image untouched)"; Pure row: add "token-cost helpers".
7. Open Questions: add "- [ ] `MAX_IMAGE_TOKENS = 6144` assumes the model server context `-c 8192`; a server started with a smaller context fails again, a larger one wastes accuracy. Decide whether the context becomes a setting or stays a documented operating constraint."
8. DE-3 or DE-7 note (W5): "A context-overflow answer (HTTP 400) is mapped to the retryable `model_error`, so a deterministic overflow burns all three attempts."
9. Optional: mention batch 9 in the "Reconciled with the build" banner. `proposal.md` line 10 (max width 1600) and the historical text of tasks 1.4 and 4.11 can stay as history.

**Other stale references**: apply-progress batch 8 audit row 25 names the test "renders a long receipt (227 x 1134 pt, ratio 5) at the width cap", renamed by batch 9. `docs/investigacion/nuextract3-instalacion.md` line 211 says `-c 8192` is enough for one page; consider a note that multi-page documents rely on the token budget.

### Issues Found

**CRITICAL**: None.

**WARNING**:
- W1. Spec and design drift from batch 9 (section above): "Document preparation" and its scenarios, DE-1, DE-9 (two table rows and a new paragraph), Testing Strategy and Open Questions need the proposed wording at spec sync. Without it, `openspec/specs/document-extraction/spec.md` would be created already stale.
- W2. Batch 9 has no "TDD Cycle Evidence" table in `apply-progress.md`. The fix and its tests (`limits.test.ts` +87 lines, `sharp-unpdf-preparer.test.ts` +127 lines) landed in one commit, so RED before GREEN cannot be proven from history. The tests exist, pass, and are well triangulated (budget pins, "one pixel wider no longer fits" checks, degenerate sizes, 3-page, 5-page, one-page, tall, rotated and small images). Strict TDD asks for the table in every batch.
- W3. Scenario "Concurrent claim" is PARTIAL: unit tests pin the guarded `UPDATE ... FROM ... JOIN ... RETURNING` shape, but the real race (one winner among simultaneous claims, one attempt counted) is proven only by `extraction-claim.integration.test.ts`, written in task 2.17 and never run (it needs a disposable Neon branch and the owner yes; walk step 9.5 listed it as optional). The real cascade is covered indirectly by the 9.6 production cleanup.
- W4. Migration number collision: `drizzle/0011_document_extraction.sql` is already applied to production (9.4), and the unmerged `escalation` change (`origin/feat/escalation*`) also carries `0011_escalation`. Whichever merges second must renumber; the `escalation` change is now the one that must, because production already holds this change 0011. Record it in the roadmap Notas at 10.3.
- W5. `MAX_IMAGE_TOKENS` is a constant tied to a server setting (`-c 8192`) the code cannot read. A server run with a smaller context repeats the walk defect silently, and a context-overflow answer is an HTTP 400 mapped to the retryable `model_error`, so it burns all three attempts per document (documents 1 and 2 of the walk ended `fallida` this way and stay so). Write the operating constraint in the design (items 7 and 8) and in the `EXTRACTION_API_URL` rollout note.
- W6. Open owner question carried from the design: Vercel Hobby non-commercial terms with Fluid compute (300 s). Not a test or build issue; it remains an owner decision before production use.

**SUGGESTION**:
- S1. A 5-page PDF now gives each letter page about 985 px of width (1,228 tokens each). No extraction-accuracy measurement exists at that resolution (the spike used 1600 px). Consider one measurement on a dense 4 to 5 page sample.
- S2. Walk step 9.5(f) attributes extra `solicitud.consultada` bursts (2 to 3 events within 150 ms) to dev mode without a production-mode check. The one-audit-row behavior is covered by `page.test.tsx`; a single check on a deployed preview would close it.
- S3. Walk residue in production: 76 `EventoAuditoria` rows stay (immutable trigger) and 7 walk files are orphaned in Blob storage (recorded in 9.6). After 9.6 the Neon project has only `production`, with no restore branch; take a backup branch again before any future migration.
- S4. Apply-progress batch 8 audit row 25 and the task text 1.4 and 4.11 keep the old 1600 px wording; harmless history.
- S5. No coverage provider is installed; changed-file coverage was not measured (informational).
- S6. Plain `npm run format:check` fails on this CRLF checkout and on pre-existing `docs/` and `openspec/` files (known); consider scripting the `--end-of-line auto` gate.

### Verdict

PASS WITH WARNINGS

No CRITICAL issue: all 104 implementation tasks are complete; the full suite (268 files, 5,911 tests), typecheck, prettier and build pass; all 61 scenarios have a passing covering test (60 COMPLIANT, 1 PARTIAL: the real claim race, W3). The owner-approved closeout tasks 10.1 to 10.5 remain open by design. Apply the W1 wording at spec sync (task 10.2), then continue to archive.
