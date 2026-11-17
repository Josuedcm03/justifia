# Apply progress: Validation Signals

Cumulative across slices: S1 (36 checkboxes), S2 (27 checkboxes) and S3 (13 checkboxes, at the end). The owner-run Phase 10 and Phase 13 are untouched.

## Slice S1 (branch `feat/validation-signals-s1-signals`), 2026-11-02

Status: tasks 0.6, 1.1-1.14, 2.1-2.6, 3.1-3.10, 4.1, 4.2, 4.5, 5.1 and 5.2 done (36 checkboxes). Open for the owner or the orchestrator: 4.3, 4.4 (owner), 5.3, 5.4 (orchestrator). No S2 or S3 task was started. Strict TDD (vitest).

### Commits (tests and code together, no AI attribution)

| Hash | Message | Tasks |
|------|---------|-------|
| e2a6d46 | feat(validation-signals): add the pure signal evaluators and the suggested verdict | 1.2-1.14 |
| 182e714 | feat(validation-signals): add the fail-soft signals read and the display-only guard | 2.1-2.6 |
| 69315b4 | feat(validation-signals): add the signals section to the secretary detail | 3.1-3.10 |

### Gates (S1 head)

- Targeted: `npx vitest run src/lib/signals src/lib/data src/app src/i18n src/lib/auth` 179 files, 4535 tests passed.
- `npm run typecheck`: 0 errors.
- `npm test` (dummy `DATABASE_URL`): 314 files, 7096 tests passed.
- `npx eslint src` (prettier `endOfLine: auto`): clean. `prettier --check --end-of-line auto src i18n`: clean.
- `npm run build` (dummy `DATABASE_URL`): ok.
- No database command of any kind was run.

### Size (task 5.2) against the tracker

| Scope | Added | Production | Tests |
|-------|------:|-----------:|------:|
| S1 total | 3441 | 1069 | 2372 |
| S1a (Phases 1-2) | 2403 | 770 | 1633 |
| S1b (Phase 3) | 1038 | 299 | 739 |

The forecast was ~900. The budget is 1500 and the split rule does not help: S1a alone is 2403. Per `tasks.md` the work stops here with a `size:exception` recommendation; nothing was golfed and no branch was split.

### Decisions and deviations

- Branch name: the orchestrator cut `feat/validation-signals-s1-signals`, not `feat/validation-signals-s1-signals-secretary` (task 1.1).
- RN-14 normalization removes punctuation (spec: "punctuation removed"); `design.md` VS-1 still says "punctuation to space". The spec wins. Example: "Hosp. Vivian-Pellas, S.A." gives `hosp vivianpellas sa`.
- Reason code and signal naming in the report: results use `signal` for the code and `notEvaluable` entries are `{ signal, reason }`.
- RN-09 per document: a days-only rest with no issue date reports `days_only` (it outranks `field_missing` by the closed precedence).
- RN-10: a completed document with a rest start but no end (or the reverse) is `field_missing`; a dated period needs both ends. Extraction validation never produces that shape, so it is defensive.
- RN-07 `calendar_not_covering_year` checks both the year of `fechaFin` and of the computed deadline.
- Q4 compares the order of presentation inside the database against the request's own row (`(PresentadaEn, Id) < (select ...)` through a `QueryBuilder` subquery), so no timestamp is rounded by the driver. Unqualified columns inside that subquery resolve to its own `"r"` alias.
- `referenceScope` is accepted by `loadSignals` but unused in S1 (RN-26 and Q5 arrive in S2).
- `src/lib/data/test-support/db-double.ts` gained `selectDistinct` (2 lines) so the loader test can script Q3.
- The page reads the signals through a fail-soft wrapper (`loadSignalsSafely`) and `signalsAccess(user.rol) === "full"`; the section is rendered after `ExtractionSection`, so it appears even when the Extracted data section renders nothing.
- i18n: `review.signals.*` in `es.json` (neutral, usted) and `en.json`; outcome words are «Señal presente», «Sin señal», «No evaluable»; verdict wording as specified.

### Task 4.x results

- 4.1: `GET http://127.0.0.1:8080/health` returned 200.
- 4.2: `EXTRACTION_API_URL` is NOT set in `.env.development.local`. It is set in `.env` (gitignored; Next loads it in every mode), is non-empty and valid per `src/lib/extraction/config.ts` (http to loopback, no credentials, port 8080). Only booleans were printed; no value was shown or edited. `EXTRACTION_API_KEY` is not set anywhere (optional for the local server).
- 4.5: expected-state note recorded next to the task in `tasks.md`.

### Risks

- Over budget: 3441 authored lines vs 1500 (decision for the orchestrator or owner).
- The Q4 history SQL and the real extraction rows are covered by SQL-rendering tests and mocks only; no database was touched, so the owner walk (4.3) is the first run against Postgres.
- `.env.development.local` lacks the extraction URL; `.env` supplies it, so a walk with `npm run dev` should work, but confirm which `DATABASE_URL` branch the owner names for 4.3.

## Slice S2 (branch `feat/validation-signals-s2-fingerprint`, cut from the S1 head), 2026-11-02

Status: tasks 6.1-6.5, 7.1-7.10, 8.1-8.10, 9.1 and 9.2 done (27 checkboxes). Open for the orchestrator: 9.3 (S2 PR), 9.4 (merge). Phase 10 (owner-run migration smoke on a disposable branch) and S3 were not started. Strict TDD (vitest). Migration 0013 was GENERATED only: no `db:migrate`, no `db:push`, no `db:seed`, no SQL, no `neonctl` and no `.env*` file was run, opened or edited.

### Commits (tests and code together, no AI attribution)

| Hash | Message | Tasks |
|------|---------|-------|
| b780d25 | feat(validation-signals): add the document fingerprint column and migration 0013 | 6.2-6.5 |
| 26f7c3a | feat(validation-signals): compute and store the SHA-256 at finalize from one stream | 7.1-7.10 |
| bc3d971 | feat(validation-signals): add the repeated-document signal with scope-confined references | 8.1-8.10 |

The repository's commit hook added `.engram/chunks/*` and `.engram/manifest.json` (memory sync) to b780d25; it is the repo's own convention (earlier docs commits carry the same files) and is not authored code.

### Migration 0013 (generated, NOT applied)

`drizzle/0013_validation_signals.sql` holds exactly three statements: `ALTER TABLE "DocumentoRespaldo" ADD COLUMN "HuellaSha256" char(64)` (nullable, no default); `CREATE INDEX "IX_Documento_Huella" ... USING btree ("HuellaSha256") WHERE "HuellaSha256" IS NOT NULL`; `ALTER TABLE ... ADD CONSTRAINT "CK_Documento_Huella" CHECK ("HuellaSha256" IS NULL OR ("Estado" = 'valido' AND "HuellaSha256" ~ '^[0-9a-f]{64}$'))`. No DROP, UPDATE, retype or backfill. Also generated: `drizzle/meta/0013_snapshot.json` and the `_journal.json` entry (idx 13, `0013_validation_signals`). A second `npm run db:generate` reported "No schema changes, nothing to migrate".

### TDD cycle evidence (S2)

| Task | Test file | Layer | RED | GREEN | Triangulate | Refactor |
|------|-----------|-------|-----|-------|-------------|----------|
| 6.2-6.4 | `src/db/migration-validation-signals.test.ts` | Unit (SQL read by name) | 6 of 6 failed (no migration) | 6 of 6 passed after `schema.ts` and `db:generate` | 6 cases: journal, column, CHECK body, partial index, purely additive, statement kinds | the statement-kind test asserts the set, not the order drizzle emits |
| 7.1-7.2 | `src/lib/intake/stream-digest.test.ts` | Unit | module missing | 8 of 8 | known vector, uneven chunks, head across boundaries, short stream, exact max, over max cancels, empty, stream error | none needed |
| 7.3-7.6 | `fakes.test.ts`, `adapters/vercel-blob-store.test.ts` | Unit | 7 failed | 412 intake tests passed | present, missing, over cap, metadata lie, non-200, store failure | none needed |
| 7.7-7.8 | `src/lib/data/documentos.test.ts` | Unit (db double) | 12 failed, then 4 after the helper fix | 84 passed (with `special-format.test.ts`) | pdf/png/jpeg, 10 MiB edge, metadata vs counted size, stream error, no hash inside the cap, same/different bytes, spoofed, empty | `writtenValues` helper replaces a circular JSON dump |
| 7.9 | `src/lib/data/special-format.test.ts` | Unit | guard (passes at write) | passed | head read kept, `readDigest` never called, no fingerprint column | none needed |
| 8.1-8.2 | `repeated-document.test.ts`, `evaluate.test.ts`, `verdict.test.ts` | Unit (pure) | module missing | 125 signals tests passed | NULL table of 4 rows, in/out of scope, dedupe and order, no personal data, closed-set combinations (3276, both RN-26 reasons reached) | none needed |
| 8.3-8.5 | `signals-sql.test.ts`, `signals.test.ts` | Unit (SQL rendering, db double) | 13 and 15 failed | 42 passed | IN, earlier-only tuple, retired kept, staff and special format excluded, `case when exists` vs `case when false`, secretary/coordinator, 41 vs 55, correction | `earlierMatchesQuery` exported as the builder |
| 8.6 | `review-messages.test.ts`, `signals-section.test.tsx` | Unit (Testing Library, axe) | 13 failed | 1039 review and i18n tests passed | links with no prefetch, no number without reference, absent, no_fingerprint, Spanish, axe | none needed |
| 8.7-8.8 | `fingerprint-exposure.test.ts`, `display-only.test.ts` | Structural scan | one scan regex too broad on the first run | passed | scanner fixtures both ways, real scan | regex narrowed to our column |
| 8.9 | `integration/validation-signals.integration.test.ts` | Integration, opt-in | compile-only | typecheck and eslint clean | accepts NULL and 64 hex; rejects 63, 65, upper-case, non-hex, non-valido; catalog; EXPLAIN | not run (needs a disposable branch, task 10.5) |

### Gates (S2 head)

- Targeted: `npx vitest run src/lib src/db src/app src/i18n` 287 files, 6698 tests passed.
- `npm run typecheck`: 0 errors.
- `npm test` (dummy `DATABASE_URL` `postgres://u:p@127.0.0.1:9/x`): 318 files, 7183 tests passed.
- `npx eslint src` (prettier `endOfLine: auto`): clean. `prettier --check --end-of-line auto src i18n`: clean.
- `npm run build` (dummy `DATABASE_URL`): ok. The first attempt failed with "Another next build process is already running" because an earlier aborted run left `.next/lock`; no build process existed, the gitignored lock was removed and the build passed.
- No database command of any kind was run.

### Size (task 9.2) against the S1 head e5ec8ba, generated files excluded

| Scope | Added | Production | Tests |
|-------|------:|-----------:|------:|
| S2 total | 2062 | 398 | 1664 |
| Unit 4 (schema, migration test) | 113 | 13 | 100 |
| Unit 5 (digest, port, finalize) | 547 | 146 | 401 |
| Unit 6 (RN-26, Q5, UI, guards) | 1402 | 239 | 1163 |

Generated and excluded: 2337 lines (0013 SQL 3, snapshot 2327, journal 7). Production lines count against the 1500 budget (owner rule): 398, one PR, no split. The forecast was ~650 authored in total; tests are 81% of the added lines (the integration test alone is 254).

### Decisions and deviations

- Branch name: the orchestrator cut `feat/validation-signals-s2-fingerprint`, not `-rn26` (task 6.1).
- Finalize split: `inspectStoredFile` (head read) is unchanged and still serves the special-format attach; finalize now calls the new `fingerprintStoredFile`, which uses `DocumentStore.readDigest`. A stream or store failure throws, the claim row is dropped and the error is rethrown, exactly as the old head-read failure behaved; a missing file stays `not_found`. The task line "fails the same way with an existing reason code" is read as: missing gives `not_found`, an unreadable stream keeps the existing loud failure (no record, no hash). The stored file is not deleted on a transient read failure (same as before; the orphan sweep is the backstop).
- A store answering inside the cap with `sha256: null` is treated as unreadable (throws), so a record is never created without a fingerprint.
- The RN-26 loader reads two statements: Q5 current side (`readCurrentFingerprints`, id and hash of the current documents) and Q5 other side (`readEarlierMatches`, skipped when no current document has a hash). The hash is reduced to a boolean before it reaches the evaluator. The other side uses `SELECT DISTINCT`, so all out-of-scope matches collapse into a single null row and nothing counts them.
- `present` and `absent` RN-26 results both carry `evidence: { kind: "repeated", references }`; the UI renders the match line and links only for `present`. The no-reference text says only that a document repeats: it does not say the other request is out of scope or whose it is.
- The new reason `no_fingerprint` is last in `REASON_PRECEDENCE`; `SignalInput` gained a required `repeated` field, so `evaluate.test.ts` and `verdict.test.ts` were updated for five signals.
- 65-character values are rejected by the column type (`value too long for type character(64)`, SQLSTATE 22001), not by the CHECK; the opt-in integration test asserts that code for that row.
- Design VS-3 says Q5 selects `CASE WHEN <scope> THEN s.Id END`; implemented as written (`requestInScope` rendered inside the CASE, `false` for the coordinator).

### Risks

- 0013 is generated and untested against Postgres: the CHECK, the partial index and the EXPLAIN of the lookup are covered by SQL-reading tests and by the opt-in suite, which only runs in Phase 10 on a disposable branch.
- Hashing and cross-request comparison are pending the UAM legal review (PRIV); fictitious data only.
- RN-26 matches exact bytes only; documents recorded before 0013 have a NULL fingerprint and never match (no backfill).

## Slice S3 (branch `feat/validation-signals-s3-coordination`, cut from the S2 head 1359098), 2026-11-02

Status: tasks 11.1-11.7, 12.1-12.6 done (13 checkboxes); 12.7 measured, the PR is for the orchestrator. Phase 10 (owner-run), Phase 13 and every `[OWNER]` and `[CONFIRM]` step were not started. Strict TDD (vitest). No database command of any kind was run and no `.env*` file was opened, printed or edited.

### Commits (tests and code together, no AI attribution)

| Hash | Message | Tasks |
|------|---------|-------|
| 47470eb | feat(validation-signals): show signal outcomes to coordination without evidence | 11.2-11.7 |
| 5a4cd41 | test(validation-signals): pin that students never see signals or fingerprints | 12.1 |
| 3a3a76d | docs(validation-signals): add RN-26 to the requirements and close the roadmap and pendientes entries | 12.2-12.5 |

### TDD cycle evidence (S3)

| Task | Test file | Layer | RED | GREEN | Triangulate | Refactor |
|------|-----------|-------|-----|-------|-------------|----------|
| 11.2-11.3 | `src/lib/signals/coordination-view.test.ts` | Unit (pure) | module missing | 10 of 10 | all five signals, three verdicts, several reasons, RN-26 with 0 / 1 / 2 references, a leaky report with undeclared fields | none needed |
| 11.6 | `src/i18n/review-messages.test.ts`, `signals-section.test.tsx` | Unit (Testing Library) | 3 failed (key and prop missing) | 98 passed | es and en, coordination vs secretary note, no link or number for RN-26, no "decision" word | none needed |
| 11.4-11.5 | `coordination/[id]/page.test.tsx`, `coordination/structure.test.ts` | Unit (page with mocked data) | 9 failed (the pin of the allowlist failed after the page was wired) | 155 coordination tests passed | open escalation, notice, other career or draft or unknown id, no career, malformed id, other role, degraded, throwing, es, order, one audit row, source pins | allowlist extended with a dedicated pin |
| 12.1 | `requests/no-signals.test.ts`, `documentos.test.ts` | Structural scan, render, db double | guard (passes at write); mutation check made the scan fail | 17 of 17 and 64 of 64 | pages in both locales and four states, list, detail keys, other student vs unknown id, upload chain, student-facing texts | none needed |

### Gates (S3 head)

- Targeted: `npx vitest run src/lib/signals "src/app/(dashboard)" src/i18n` passed (113 files, 3003 tests at unit 7).
- `npm run typecheck`: 0 errors.
- `npm test` (dummy `DATABASE_URL` `postgres://u:p@127.0.0.1:9/x`): 320 files, 7232 tests passed. The first full run had one failure, `catalog/import/import-form.test.tsx` "shows the summary and the credentials download after the apply" (822 ms, a timing flake while other commands ran); it passes alone (39 of 39) and the rerun of the whole suite was green.
- `npx eslint src` (prettier `endOfLine: auto`): clean. `prettier --check --end-of-line auto src i18n`: clean. The docs files do not pass `prettier --check` and did not before this slice (the baseline versions fail the same way); the gate scope is `src i18n`.
- `npm run build` (dummy `DATABASE_URL`): ok.
- No database command of any kind was run.

### Size (task 12.7) against the S2 head 1359098, openspec excluded

| Scope | Added | Production | Tests | Docs |
|-------|------:|-----------:|------:|-----:|
| S3 total | 1232 | 83 | 1101 | 48 |

Production lines count against the 1500 budget (owner rule): 83, one PR, no split. The forecast was ~400 authored; tests are 89% of the added lines (the student guard alone is 550).

### Decisions and deviations

- Branch name: the orchestrator cut `feat/validation-signals-s3-coordination`, not `-docs` (task 11.1).
- Unit 8 went in two commits (guard tests, then docs) instead of the single docs commit named in 12.5, so each commit holds one kind of change.
- Coordination note: the shared `review.signals.note` ends "replace your decision". The coordinator answers, not decides, and the existing coordination page test forbids the word "decision" in the page. One new key, `review.signals.coordinationNote` (es and en), and a `SignalsSection` prop `audience` ("secretary" default, "coordination") select it. This is the only coordination-only text.
- Placement: the section sits after the documents and before the answer form on the coordination detail.
- `coordination/structure.test.ts` pinned that the coordinator surface imports no secretary data module. `@/lib/data/signals` joined its allowlist, with a new pin: only the detail page imports it, with `referenceScope: { kind: "none" }`, through `toCoordinationView`.
- Local fail-soft wrapper in the coordination page, as in the review page (the loader never throws; the wrapper keeps even an unexpected throw from taking the page down and logs the error name only).
- `toCoordinationView` copies fields by name, so a field added to the report later stays out of the coordinator view until someone decides it may go in.
- "Answer unaffected" has no signals import to test in the answer path: the display-only scan (S1/S2) already pins that `coordination/[id]/actions.ts` and `escalation-answer.ts` import nothing from the signals; the page test shows the form is unchanged with RN-26 `present`.
- 12.1: the finalize-equality test lives in `documentos.test.ts` (the db double is there); an exact statement script proves a file identical to an earlier request's issues no extra statement and gives the same result and audit as any other file. The correction submit does not read fingerprints (`solicitud-correction.ts` is in the upload-chain scan).
- Docs: RN-26 row and changelog row only (`git diff docs/requirements.md` is two added lines); recount 16 RF, 14 RNF, 26 RN, marked as pending sync with the thesis matrix. Roadmap row 5 is `en curso` with coverage RF-05 (a) a (d); RN-07, RN-09, RN-10, RN-14, RN-15, RN-26, and a note for what remains. Pendientes item 1 records what shipped, the limits, PRIV, the 2026-11-03 data path and NS-12.
- The pendientes entry names RN-26 "documento repetido" (the UI name) and says it is what the 2026-10-28 note called "documento reaparecido".

### Risks

- The coordination section renders outcomes only; the owner walk (13.2) is the first check of what the coordinator sees against a real database.
- Everything in the S3 slice is read-only and fail-soft; reverting S3 leaves S1 and S2 intact (rollback boundary: `coordination-view.ts`, coordination page wiring, the guard tests and the docs commit).
- PRIV (legal review of hashing and cross-request comparison) and the production decision on 0013 (10.9) are still open and block the tracker merge.

## Remediation after verify (W4 and W3), branch `docs/validation-signals-closeout`, 2026-11-02

Scope: the two work units the orchestrator assigned from the verify report on db08b54. No task checkbox changed (102/102 stay done); a note under Phase 13 of tasks.md points here. Strict TDD (vitest). No database command of any kind was run; the opt-in integration suite was collected under its own config without `INTEGRATION_DATABASE_URL` (45 tests skipped, none executed).

### Unit 1: W4, failed finalize on an unreadable stored file

Spec: supporting-documents, "Failed finalize stores no fingerprint" (the file is deleted, no record exists, no fingerprint stored) and the clause "if the fingerprint cannot be computed because the stored content cannot be read, finalize MUST fail the same way and MUST NOT create a record without a fingerprint", "a message naming the reason returned".

Reason chosen: the spec names no reason for this case and `DocumentRejectionReason` (src/lib/audit/types.ts) has six: `unsupported_format`, `too_large`, `empty_file`, `not_found`, `not_allowed`, `too_many_documents`. `not_found` is the closest: its student message is "No encontramos el archivo. Inténtalo de nuevo." (es) and asks for a retry, which is what an unreadable stored file calls for. No new audit reason was invented: `documento.rechazado` already accepts `{ reason: "not_found" }` in its closed set, so audit types and the audit tests are unchanged.

Behavior now: the catch around `fingerprintStoredFile` in `finalizeDocument` calls the existing `reject()` with `reason: "not_found"` and the claim id. `reject()` deletes the stored blob best effort (a failing delete still returns the rejection), drops the `pendiente` claim and writes one `documento.rechazado` row in one transaction, then returns `{ ok: false, reason: "not_found" }`. Before, the claim was dropped and the error rethrown, with the blob left to the orphan sweep and no reason. The same path now covers a digest with no hash inside the size cap (store contract violation), which used to throw "Stored file read without a fingerprint". One log line, `document_finalize_read_failed`, carries the error name only (never the message, which can hold a path); the event name avoids the words that `signals/fingerprint-exposure.test.ts` bars from log calls.

Difference from a plain `not_found` (missing file): that one still writes no audit row and deletes nothing, because nothing is stored; the unreadable case has a stored blob, so it audits and deletes like the other refusals.

Files: `src/lib/data/documentos.ts`, `src/lib/data/documentos.test.ts`.

### Unit 2: W3, RN-26 and RN-14 predicates executed on Postgres (opt-in)

New describe "RN-14 and RN-26 predicates (real Postgres)" appended to `src/lib/data/integration/validation-signals.integration.test.ts`. It calls the exported statements (`readIssuerHistory`, `readEarlierMatches`) and the real `loadSignals` on committed rows; every case owns fresh students and a fingerprint derived from the run id and the case label, and `cleanup()` removes the rows. `fixtures.ts` got two additive options: `addGroup({ periodo })` and `addStudentInOtherFacultad()` (a second facultad and career, tracked by the existing cleanup arrays).

Limits found while building the rows, stated in the file header:

- `CK_Documento_FormatoEspecial` ties `SubidoPorId IS NOT NULL` to `FormatoEspecial`, so "staff upload" and "special format" are one row shape; both predicates are exercised by that one row, not independently.
- `CK_Documento_Huella` allows a fingerprint only on `valido` documents, so a non-valid document can never match on the RN-26 side. The `Estado = 'valido'` predicate of Q4 (RN-14, no fingerprint involved) is executed with a `pendiente` document.
- The spec table "Earlier request reused" says the staff-upload and special-format R1 outcome is `absent`; by the evaluator's own rule that request has no current student document, so its RN-26 would be `not_evaluable`. The suite asserts the SQL meaning of "R1 stays absent" instead: the later request reusing its file never appears as an earlier match for R1 (`readEarlierMatches(R1) = []`).

Integration test names added (45 collected, all skipped without a database), prefix `RN-14 and RN-26 predicates (real Postgres) > `:

- `RN-14 history (Q4) > same student, same period, rechazada: counted = true`
- `RN-14 history (Q4) > same student, same period, devuelta: counted = true`
- `RN-14 history (Q4) > same student, same period, aprobada: counted = true`
- `RN-14 history (Q4) > same student, same period, en_revision_coordinacion: counted = true`
- `RN-14 history (Q4) > same student, other period: counted = false`
- `RN-14 history (Q4) > other student, same period: counted = false`
- `RN-14 history (Q4) > same student, borrador: counted = false`
- `RN-14 history (Q4) > same student, retired documents only: counted = false`
- `RN-14 history (Q4) > same student, staff-uploaded special-format document: counted = false`
- `RN-14 history (Q4) > same student, document not valido: counted = false`
- `RN-14 history (Q4) > same student, extraction fallida: counted = false`
- `RN-14 history (Q4) > same student, extraction pendiente: counted = false`
- `RN-14 history (Q4) > same student, extraction no_aplica: counted = false`
- `RN-14 history (Q4) > same student, completed extraction without issuer: counted = false`
- `RN-14 history (Q4) > same student, presented later than the current request: counted = false`
- `RN-14 history (Q4) > same instant, lower id than the current request: counted = true`
- `RN-14 history (Q4) > same instant, higher id than the current request: counted = false`
- `RN-14 history (Q4) > never returns the request under evaluation`
- `RN-14 history (Q4) > through loadSignals, a rechazada request counts: the 3rd request is present`
- `RN-14 history (Q4) > through loadSignals, a request of another period does not: the 3rd stays absent`
- `RN-26 earlier-only matching (Q5) > presented pendiente, document H: the later request is present = true`
- `RN-26 earlier-only matching (Q5) > presented rechazada, document H: the later request is present = true`
- `RN-26 earlier-only matching (Q5) > presented devuelta, document H: the later request is present = true`
- `RN-26 earlier-only matching (Q5) > presented, document H retired by a correction: the later request is present = true`
- `RN-26 earlier-only matching (Q5) > draft with document H: the later request is present = false`
- `RN-26 earlier-only matching (Q5) > presented, document H uploaded by staff (special format): the later request is present = false`
- `RN-26 earlier-only matching (Q5) > presented, other student, document H: the later request is present = true`
- `RN-26 earlier-only matching (Q5) > presented, document from before the change (NULL fingerprint): the later request is present = false`
- `RN-26 earlier-only matching (Q5) > breaks a tie on the presentation instant by request id`
- `RN-26 earlier-only matching (Q5) > never matches a correction re-upload against its own request`
- `RN-26 earlier-only matching (Q5) > flags a correction that reuses a document of another, earlier request`
- `RN-26 earlier-only matching (Q5) > orders by the first presentation, never by the resubmission`
- `RN-26 reference confined to the caller's scope > nulls, inside the database, the id of a request outside the scope, and keeps the match`
- `RN-26 reference confined to the caller's scope > references the request of the facultad and hides the others (41 and 55)`
- `RN-26 reference confined to the caller's scope > shows the other facultad its own request and hides the first one`
- `RN-26 reference confined to the caller's scope > gives a caller with no scope the match and no id at all`

Run (owner yes per command, disposable branch with migration 0013): `INTEGRATION_DATABASE_URL=<branch url> INTEGRATION_ALLOW_WRITES=1 npm run test:integration -- -t "RN-14 and RN-26 predicates"`.

Verify rows addressed (once the owner runs them green): RN-14 "What does not count"; RN-26 "Earlier request reused" (all seven rows, with the staff and special-format shape caveat above), "Equal presentation time", "Correction re-upload same request", "Correction reusing another request document", "Order follows first presentation"; Scope "Cross-scope match without reference" and "In-scope match with reference (41/55)" at the SQL level.

### TDD cycle evidence (remediation; also addresses W2 for this work, with a Safety Net column)

| Unit | Test | Layer | Safety net | RED seen | GREEN | Triangulate | Refactor |
|------|------|-------|------------|----------|-------|-------------|----------|
| W4 | `documentos.test.ts` > "a stored file that cannot be read for hashing" (4 tests: store down, stream breaks, blob delete also fails, log carries the error name only) | Unit, db double and `DocumentStore` fake | `documentos.test.ts` 64 of 64 before the change | all 4 failed (as did the rewritten test below: 5 failures in the file) with the original rethrow ("store down", "connection reset", "cannot read ...") | 66 of 66 after the catch calls `reject()` | read failure by throw, stream failure, a digest with no hash inside the cap, failing blob delete, message with a path and a hash that must not be logged | event name renamed after `fingerprint-exposure.test.ts` failed in the full run (the word "fingerprint" is barred from log calls); no other change |
| W4 | `documentos.test.ts` > "never creates a record without a fingerprint: a digest with no hash inside the cap ..." (rewritten from "fails loud") | Unit | same | failed with the thrown "Stored file read without a fingerprint" | passes: `not_found`, blob gone, claim dropped, no `huellaSha256` written | covered with the two above | none |
| W3 | `validation-signals.integration.test.ts` > "RN-14 and RN-26 predicates (real Postgres)" (45 tests) | Integration, opt-in | `signals-sql.test.ts` 17 tests (rendering) and the existing 9 integration tests unchanged | not observable: no database is available to the executor. Not claimed. The suite compiles and is collected (45 skipped) | not run; the owner runs it on a disposable branch | counted and not-counted rows per predicate, both directions of the tie-break, both viewers of the scope, three scope shapes | `prettier` only |

Honest note on W3 RED: these tests pin existing behavior, so the useful RED is a mutation of each predicate (drop a `WHERE` term in `readIssuerHistory` or `earlierMatchesQuery`) against the real database. That check is the owner's run; it was not simulated here.

### Postgres run (W3 evidence, recorded at archive)

Added after verify (W5 of `verify-report`). The section above says the suite was not run; that was true at the time of the remediation head. The run below happened later on 2026-11-02.

- Environment: a disposable Neon branch `test-validation-signals-evidence` created from `dev-arnia`, with migration 0013 applied. The branch was deleted after the run. Owner's explicit yes was given for this run.
- Command shape: `INTEGRATION_DATABASE_URL=<disposable> INTEGRATION_ALLOW_WRITES=1 npm run test:integration -- src/lib/data/integration/validation-signals.integration.test.ts`.
- First run, before f5e4744: 26 passed, 10 failed. All 10 failures were `expected [ { solicitudId: '207' } ] to deeply equal [ { solicitudId: 207 } ]`. This is the RED that the unit suite could not see.
- Defect: the raw SQL `CASE` in `earlierMatchesQuery` returned the bigint request id as a string, so the earlier-match id reached the coordinator as `'207'` instead of `207`.
- Fix: f5e4744 `fix(validation-signals): return the earlier request id as a number`, adding `.mapWith(Number)` to that column (NULL stays NULL).
- Second run, after f5e4744: 1 file passed, 45 of 45 tests passed (36 new RN-14 and RN-26 predicate and scope cases plus the 9 existing integration tests).
- Limit: the run cannot be repeated without a new disposable branch and a new owner yes. The default unit suite does not pin `.mapWith(Number)` (verify S7).

### Gates (remediation head)

- `npx vitest run` (dummy `DATABASE_URL` `postgres://u:p@127.0.0.1:9/x`): 320 files, 7234 tests passed (7232 before, +2 net in `documentos.test.ts`), exit 0. The first full runs after the change failed once, `signals/fingerprint-exposure.test.ts` "logs no fingerprint" (the first log event name contained "fingerprint"); fixed by renaming the event and rerun green.
- `npm run typecheck`: 0 errors.
- `npx eslint src`: 0 problems other than the CRLF `Delete ␍` noise of `core.autocrlf` (filtered, as in the Gate set G note).
- `npx prettier --check "src/**/*.{ts,tsx}" --end-of-line auto`: clean.
- No database command of any kind was run; `drizzle-kit` was not run.

### Decisions and deviations

- W4 uses the existing `not_found` reason (no new audit reason, no change to `src/lib/audit`); the alternative of a new `read_failed` reason was left out because it would touch the audit types, their tests and the intake messages in both locales for a case a retry solves.
- design.md VS-4 still lacks the unreadable-file behavior (suggestion S1 of the verify report); this change did not edit design.md.
- `fixtures.ts` was extended (additive options), not replaced.
