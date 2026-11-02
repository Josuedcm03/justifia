# Apply progress: Validation Signals

Cumulative across slices: S1 (36 checkboxes) and S2 (27 checkboxes, below). S3 and the owner-run Phase 10 are untouched.

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
