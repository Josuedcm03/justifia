# Apply progress: Document Extraction

Mode: Strict TDD (vitest). Delivery: single PR with `size:exception` (task 0.1),
branch `feat/document-extraction`; slices are commit work units, not branches or
PRs.

## Batch 1 (2026-10-23): phase 0 and S1 (tasks 0.3-0.5, 1.1-1.18)

Status: 0.3, 0.4, 0.5 done (commit `b9a1ed1`). S1 1.1-1.18 done; 1.19 was held
at the time (authored diff 1,484 lines, over the 800 stop threshold) and the
orchestrator committed S1 afterwards as `60c357f`.

### Completed tasks

- [x] 0.3 DE-14 text-mode measurement: **FAIL** (see below)
- [x] 0.4 unpdf signatures confirmed (unpdf 1.9.1)
- [x] 0.5 Commit unit 0 (`b9a1ed1`)
- [x] 1.1 N/A (`size:exception`, stay on `feat/document-extraction`)
- [x] 1.2-1.13, 1.16, 1.17 RED/GREEN pairs for states, limits, template, config,
      validate, display
- [x] 1.14, 1.15 N/A (`[TEXT PATH]`, dropped by the 0.3 FAIL)
- [x] 1.18 Gates and diff measurement
- [ ] 1.19 Commit unit 1 (held, see "Workload / PR boundary")

### 0.3 result: FAIL

3 synthetic text-layer PDFs (fictional data) x 2 runs against the local
`nuextract3` container, text mode, DE-8 contract. Issue date and name 6/6
correct and present in the text; issuer correct 3/6 (the other 3 returned the
signing physician, who is in the text, so the appear-in-text check cannot catch
it); rest period correct 2/6 (hours returned as days; rest invented in 2 runs).
Gate fails on the issuer. Consequence: text-layer PDFs take the image path, no
rules extractor; `[TEXT PATH]` tasks 1.14, 1.15, 4.6, 4.7 are N/A. Container
stopped after the measurement (`docker ps` empty). Details in
`docs/investigacion/spike-ocr-resultados.md`.

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.4/1.5 | `src/lib/extraction/limits.test.ts` | Unit | N/A (new) | Written; run failed: `./limits` unresolved | 15/15 | `it.each` over 5 remaining-budget values and 5 timeout values, clamp at zero | Margin extracted to a named constant |
| 1.2/1.3 | `src/lib/extraction/states.test.ts` | Unit | N/A (new) | Written; run failed: `./states` unresolved | 17/17 | retry below cap, final at cap, permanent on attempt 1, `not_configured` at 1 and 3 | None needed |
| 1.6/1.7 | `src/lib/extraction/template.test.ts` | Unit | N/A (new) | Written; run failed: `./template` unresolved | 8/8 | two pages in both orders prove ordering comes from the input | None needed |
| 1.8/1.9 | `src/lib/extraction/config.test.ts` | Unit | N/A (new) | Written; run failed: `./config` unresolved | 28/28 | 8 accepted and 10 rejected addresses, key present/blank/absent, default logger once per process via `vi.resetModules()` | None needed |
| 1.10/1.11 | `src/lib/extraction/validate.test.ts` | Unit | N/A (new) | Written; run failed: `./validate` unresolved | 32/32 | window table incl. 29 Feb reference, 160/200 length edges, 9 invalid date forms | Rest rules left as stub until 1.12 |
| 1.12/1.13 | `src/lib/extraction/validate.test.ts` | Unit | 32/32 | 15 of 66 failed (the non-null rest cases; null-expecting cases passed against the stub) | 66/66 | forms (a), (b) and every other combination; window edges (+30 days, one year back) | Stub placeholders removed; helpers extracted (`isPresent`, `wholeNumber`, `inclusiveDays`) |
| 1.16/1.17 | `src/lib/extraction/display.test.ts` | Unit | N/A (new) | Written; run failed: `./display` unresolved | 24/24 | each state x request state x configured, precedence table | None needed |

### Test summary

- Total tests written: 158 (limits 15, states 17, template 8, config 28,
  validate 66, display 24)
- Total passing: 158; full suite `npm test`: 242 files, 5274 tests, all passing
- Layers: Unit (158). Approval tests: none (no refactoring tasks)
- Pure functions created: `deadlineFor`, `canStartDocument`, `modelTimeoutMs`,
  `failureOutcome`, guards (3), `buildChatRequest`, `resolveExtractionConfig`,
  `validateFields`, `toExtractionDisplay`

### Work Unit Evidence (S1)

| Evidence | Value |
|---|---|
| Focused test command and result | `npx vitest run src/lib/extraction`: 6 files, 158 tests, all passing |
| Runtime harness | N/A: pure code, no runtime boundary |
| Rollback boundary | Delete the 12 files under `src/lib/extraction/` (no other file in the repo is touched) |

### Gates (2026-10-23, dummy `DATABASE_URL`)

- `npm test`: 242 files, 5274 tests passed
- `npm run typecheck`: clean
- `npx eslint src`: 0 findings besides the CRLF `Delete ␍` noise
- `prettier --check --end-of-line auto src`: clean
- `npm run build`: not run in this batch (no Next-facing change; run at the next gate)

### Files changed

| File | Action |
|---|---|
| `docs/investigacion/spike-ocr-resultados.md` | Modified (commit `b9a1ed1`): text-mode measurement and unpdf call shapes (neutral Spanish) |
| `openspec/changes/document-extraction/tasks.md` | Modified: 0.3-0.5 and S1 marks, `[TEXT PATH]` N/A annotations |
| `src/lib/extraction/{limits,states,template,config,validate,display}.ts` | Created (496 lines) |
| `src/lib/extraction/*.test.ts` (six files) | Created (988 lines) |

### Deviations from design

1. **Text variant dropped (0.3 FAIL, owner decision 2026-10-22).**
   `PreparedDocument` is `{ kind: "images"; images: readonly Uint8Array[] }`;
   `ENGINE_ID` is the single string `nuextract3-4b/image`; `buildChatRequest`
   has no text branch; `validateFields(raw, { submittedOn })` has no
   `sourceText`; `MIN_TEXT_CHARS_PER_PAGE` and `MAX_TEXT_CHARS` are not defined.
   Untagged task text in 1.4, 1.6, 1.11, 3.4 and 5.8 still mentions the text
   path; those later tasks follow this deviation.
2. **Order:** limits (1.4/1.5) before states (1.2/1.3), because
   `failureOutcome` reads `MAX_ATTEMPTS`.
3. **Additions:** `failureOutcome(error, attempts)` in `states.ts` (the task
   asks for the rule, not its name); `STUDENT_NAME_MAX_LENGTH` (160) and
   `ISSUER_MAX_LENGTH` (200) exported from `validate.ts`; `toExtractionDisplay`
   takes `(row, { requestState, configured })`; the display model marks each
   field `{ recognized: false }` instead of a string; `config.ts` also rejects
   an address that embeds credentials and normalises the base URL (no trailing
   slash, no query).
4. **Spec and design drift to resolve at verify/archive:** spec requirements
   "Document preparation" (text-layer PDF sent as text) and "Values from text
   must appear in the text", their scenarios, and design DE-9/DE-10/DE-14 text
   rows still describe the dropped text path. Not edited in this batch.

### Issues found

- Authored diff 1,484 lines vs ~700 estimated: tests are 988 lines (the
  rest-period, window and address tables are long). The aggregate forecast of
  ~3,400 lines is likely understated by a similar factor.
- Docker Desktop lives under `%LOCALAPPDATA%\Programs\DockerDesktop`, not
  `Program Files`; cold start of the model container took about 125 s to
  `/health` ok.
- Finding for the image path: a days-only rest ("rest_days" with no dates) is
  accepted by validation, so a model-invented duration passes (seen in the
  measurement: a letter validity period returned as 30 days). RF-14/RN-24
  remain the control.

### Remaining tasks

1.19 (held; committed as `60c357f`), then phases 2-10.

### Workload / PR boundary

- Mode: `size:exception`, single PR from `feat/document-extraction`
- Current work unit: S1 (pure domain), staged, not committed
- Natural split if the owner wants smaller commits: A = limits, states,
  template, config (708 lines) and B = validate, display (776 lines)
- Estimated review budget impact: S1 alone is ~1.8x its forecast

## Batch 2 (2026-10-23): S2 schema, migration 0011, data module (tasks 2.1-2.18)

Status: 2.1-2.18 done; **2.19 (commit) held**: the authored diff is 1,890 lines,
over the 800 stop threshold. Nothing is committed; the work is in the working
tree on `feat/document-extraction` (HEAD `60c357f`). `size:exception` applies.
No database was touched: migration 0011 is generated and NOT applied (task 9.4).

### Completed tasks

- [x] 2.1 N/A (`size:exception`, stay on `feat/document-extraction`)
- [x] 2.2 `origin/main` has no `0011` (last file `0010_request_consent.sql`).
      Collision risk with the unmerged `escalation` change (see "Issues found")
- [x] 2.3 RED `src/db/migration-document-extraction.test.ts`
- [x] 2.4 GREEN `ExtraccionDocumento` in `src/db/schema.ts` (nine CHECKs, partial index)
- [x] 2.5 `db:generate` only (dummy `DATABASE_URL`): `drizzle/0011_document_extraction.sql`
- [x] 2.6-2.15 RED/GREEN pairs in `src/lib/data/extraction.test.ts` / `extraction.ts`
      (register, claim, complete, fail, abandon, candidates, read model)
- [x] 2.16 structural pins (single writer, no audit import, one log event)
- [x] 2.17 integration test written, NOT run
- [x] 2.18 gates and diff measurement (PR part N/A)
- [ ] 2.19 Commit unit 2 (held, see "Workload / PR boundary")

### 2.2 result

`git fetch origin`, then `origin/main:drizzle/` lists `0000`..`0010` only, so the
new file is `0011`. Other remote branches: the unmerged `escalation` change
(`origin/feat/escalation-s1a-schema` .. `-s5-student-consent`, head `501092b`)
carries `drizzle/0011_escalation.sql` (journal idx 11, `when` 1792695105915).
Not on `main`, so this is not the STOP case of the task, but whichever change
merges second must renumber (delete its generated 0011 files, rebase onto
`main`, re-run `db:generate --name document_extraction`). The migration test
locates the SQL by name and compares `when` with `request_consent`, so it
survives a renumber.

### Generated migration (not applied)

- `drizzle/0011_document_extraction.sql`: one `CREATE TABLE "ExtraccionDocumento"`
  (16 columns, nine named CHECKs), one `ALTER TABLE ... ADD CONSTRAINT` FK
  `DocumentoId -> DocumentoRespaldo.Id ON DELETE cascade`, one
  `CREATE INDEX "IX_Extraccion_Abierta" ... WHERE "Estado" IN ('pendiente', 'procesando')`.
  No `DROP`, `ALTER ... TYPE`, `INSERT`, `UPDATE` or `DELETE`.
- `drizzle/meta/0011_snapshot.json`, `drizzle/meta/_journal.json` (idx 11,
  `when` 1792808788271, later than 0010's 1792599892113).
- A second `npm run db:generate` reports "No schema changes, nothing to migrate".

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 2.3/2.4/2.5 | `src/db/migration-document-extraction.test.ts` | Unit (reads generated SQL) | `src/db` + `src/lib/data`: 48 files, 937/937 before touching `schema.ts` | Written; 18 of 37 failed (SQL file absent) | 37/37 after schema + generate; one expected string fixed (index statement ends in `;`) | 9 CHECK bodies, 19-row constraint-case table (each rejected case names its constraint), 16 columns, closed lists equal the S1 constants | None needed |
| 2.6-2.9 | `src/lib/data/extraction.test.ts` | Unit (scripted double, rendered SQL) | N/A (new) | Written; run failed: `@/lib/data/extraction` unresolved | 15/15 (one expectation fixed: ascending order renders `asc`) | live vs retired document, no documents (insert skipped), first presentation vs resubmission, three claim guards | `leaseCutoff`/`claimableRow` shared by claim, registration and candidates |
| 2.10/2.11 | same | Unit | 15/15 | 14 of 29 failed (functions undefined) | 29/29 | 6-row failure table (below/at cap, permanent), `not_configured` at attempts 1 and 3, empty answer, stale holder | `heldBy`/`finish` extracted |
| 2.12-2.15 | same | Unit | 29/29 | 9 of 38 failed | 38/38 | candidates: limit 10 and 3, state filter, three branches; read model: with/without row, degraded | None needed |
| 2.16 | same | Structural (file scan) | 38/38 | Pins passed on the existing module; mutation check: adding an audit import and a `pathname` log made 2 of 43 fail, reverted | 43/43 | detector tested on insert/update/delete/raw SQL/read-only shapes; finds the writer (not vacuous) | N/A |
| extra | `src/lib/data/extraction-sql.test.ts` | Characterization (driver-less `drizzle.mock`) | 43/43 | Passes at once (adds proof, not behavior) | 5/5 | claim, fail, abandon, candidates, read model: the whole emitted statement | N/A |
| 2.17 | `src/lib/data/integration/extraction-claim.integration.test.ts` | Integration | N/A | Written, NOT run (no database) | N/A | 6 parallel claims; cascade | N/A |

### Test summary

- Total tests written: 85 (migration 37, data module 43, emitted SQL 5); the
  integration file adds 2 opt-in tests that `npm test` excludes
- Total passing: 85; full suite `npm test`: 245 files, 5359 tests, all passing
  (was 242 files, 5274 tests)
- Layers: Unit (80), characterization (5), integration (2, not run)
- Approval tests: none (no refactoring task; `db-double.ts` grew additively and
  the 48-file safety net stays green)
- Pure functions created: none (data layer)

### Work Unit Evidence (S2)

| Evidence | Value |
|---|---|
| Focused test command and result | `npx vitest run src/db src/lib/data/extraction.test.ts src/lib/data/extraction-sql.test.ts`: 16 files, 239 tests, all passing |
| Runtime harness | N/A for `npm test`: the SQL is read by test and never applied. The opt-in `npm run test:integration` suite (task 2.17) was written, not run: it needs a disposable Neon branch with 0011 applied and the owner's yes (phase 9) |
| Rollback boundary | Revert `src/db/schema.ts` (the table and three imports), `drizzle/0011_document_extraction.sql`, `drizzle/meta/0011_snapshot.json`, the `_journal.json` entry, delete `src/lib/data/extraction.ts` and its three test files, revert the additive change in `src/lib/data/test-support/db-double.ts`. Nothing applied to any database, so nothing to undo there |

### Gates (2026-10-23, dummy `DATABASE_URL=postgres://u:p@127.0.0.1:9/x`)

- `npm test`: 245 files, 5359 tests passed
- `npm run typecheck`: clean
- ESLint on `src/db`, `src/lib/data`, `src/lib/extraction`: 0 findings besides
  the CRLF `Delete ␍` noise of CRLF working-tree files
- `prettier --check --end-of-line auto src`: clean
- `npm run db:generate` (second run): no schema changes
- `npm run build`: not run (the module has no caller yet; run at the next gate)

### Files changed

| File | Action | Authored lines |
|---|---|---:|
| `src/db/schema.ts` | Modified: `ExtraccionDocumento` table, nine CHECKs, index, 4 imports | 92 |
| `src/db/migration-document-extraction.test.ts` | Created | 341 |
| `src/lib/data/extraction.ts` | Created: the only writer of the table | 444 |
| `src/lib/data/extraction.test.ts` | Created | 769 |
| `src/lib/data/extraction-sql.test.ts` | Created | 99 |
| `src/lib/data/integration/extraction-claim.integration.test.ts` | Created (not run) | 129 |
| `src/lib/data/test-support/db-double.ts` | Modified: records `calls` and `limit` per statement | 16 |
| `drizzle/0011_document_extraction.sql`, `drizzle/meta/0011_snapshot.json`, `drizzle/meta/_journal.json` | Generated (excluded from the count) | n/a |
| `openspec/changes/document-extraction/{tasks,apply-progress}.md` | Modified (excluded) | n/a |

Authored diff: **1,890 lines** (prod 552 + tests 1,338), against a ~620 forecast.

### Deviations from design

1. **Registration is four statements in one transaction, not one `INSERT ...
   SELECT`.** drizzle's `insert().select()` requires the select to project
   every column of the table (`haveSameKeys`), which would list all 16 columns
   with literal defaults. The module selects the eligible student documents,
   inserts `pendiente` (or `no_aplica` for a retired one) with `ON CONFLICT DO
   NOTHING`, closes the open rows of retired documents, then selects the
   claimable ids. A document retired after the last statement is refused by the
   claim guard, so no retired document can be processed.
2. **Claim also requires `Solicitud.PresentadaEn IS NOT NULL`** (a draft has no
   clock start; the claim returns `submittedAt = ReenviadaEn ?? PresentadaEn`
   as a `Date`).
3. **The ids returned by registration include `procesando` rows with an expired
   lease under the cap**, not only `pendiente`: otherwise the sweep's "Expired
   lease recovered" scenario would select a request and then find nothing to
   process. The claim guard is the same condition.
4. **Candidates are ordered by `COALESCE(ReenviadaEn, PresentadaEn)`** (spec:
   "oldest request first by clock start"), then `Id`; task 2.12 says
   `PresentadaEn`.
5. **`fallida` rows of a retired document are left as they are** (task 2.6: only
   open rows move to `no_aplica`; the DE-3 diagram also lists `fallida`). The
   read model omits retired documents, so nothing shows.
6. `failExtraction` stores `ErrorCodigo = 'not_configured'` on the handed-back
   row (DE-4 keeps the code for diagnostics) and sets `ProcesadoEn` only on
   `fallida`. `CLAIM_LEASE_MS` and `MAX_ATTEMPTS` come from S1 `limits.ts`; the
   module does not redefine them.
7. `listExtractions` entries are `{ documentoId, nombreOriginal, row }`, where
   `row` is the S1 `ExtractionRowView` or null (no row yet).
8. `db-double.ts` (shared test support) gained `calls` and `limit` recording so
   tests can see `onConflictDoNothing` and the batch size; existing tests are
   unaffected.

### Issues found

- **Authored diff 1,890 lines vs ~620 forecast** (3x). Tests are 1,338 lines:
  the rendered-SQL assertions, the 19-row constraint-case table and the
  structural pins are long. The aggregate forecast is understated again.
- **Migration number collision risk with `escalation`** (see 2.2 result).
- The full `registerPendingExtractions` transaction cannot be emitted without a
  driver, so its statements are pinned clause by clause (scripted double), not
  as whole statements; the other five reads and writes are pinned whole
  (`extraction-sql.test.ts`). The integration test covers it against Postgres.
- Race semantics of the guarded claim (second `UPDATE` re-evaluates `WHERE`
  after the first commits) are standard READ COMMITTED behavior but only the
  opt-in integration test (2.17) proves them.

### Remaining tasks

2.19 (held), then phases 3-10.

### Workload / PR boundary

- Mode: `size:exception`, single PR from `feat/document-extraction`
- Current work unit: S2, in the working tree, not committed (nothing staged)
- Proposed split if the owner wants commits under the 800 threshold (authored
  lines, approximate): **A** schema + migration + migration test + generated
  files (433); **B** register + claim in `extraction.ts` (lines 1-192), their
  tests (`extraction.test.ts` lines 1-330), the integration test and the
  `db-double.ts` change (about 667, plus the claim case of the SQL test);
  **C** complete/fail/abandon/candidates/read model, their tests, the
  structural pins and the rest of `extraction-sql.test.ts` (about 790)
- Estimated review budget impact: S2 alone is ~3x its forecast; the remaining
  slices S3-S5b should be re-forecast with a similar factor

## Batch 3 (2026-10-23): S3 ports, fakes and use case (tasks 3.1-3.11)

Status: 3.1-3.11 done. S2 was committed by the owner as one unit
(`94ce89f`, 2.19); S3 is committed as one unit too (`size:exception`, the
owner's pattern), so 3.11 is done in this batch. No database was touched.

### Completed tasks

- [x] 3.1 N/A (`size:exception`, stay on `feat/document-extraction`)
- [x] 3.2/3.3 fakes RED/GREEN, `ports.ts` and `fakes.ts`
- [x] 3.4/3.5 `runDocumentExtraction` RED/GREEN (image path only, no `sourceText`)
- [x] 3.6/3.7 `processRequestExtractions` RED/GREEN
- [x] 3.8/3.9 `runExtractionSweep` RED/GREEN
- [x] 3.10 Gates and diff measurement (PR part N/A)
- [x] 3.11 Commit unit 3: `feat(extraction): add the extraction ports, fakes and use case`

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 3.2/3.3 | `src/lib/extraction/fakes.test.ts` | Unit | N/A (new) | Written; run failed: `./fakes` unresolved | 10/10 | ok and error answers, re-scripting, default single page; three queued results in order, calls recorded with the timeout, empty queue throws; configured default, switch, constructor option, check counter | None needed |
| 3.4/3.5 | `src/lib/extraction/run.test.ts` | Unit (fakes + `vi.mock` of the data module) | N/A (new) | Written; run failed: `./run` unresolved | 24/24 | claim null; not configured (no store read, no network); store missing / throwing / breaking mid-body; both preparer codes; the three extractor codes; model timeout table (275, 100, 40, 5 s left -> 120, 90, 30, 0 s); success; Managua vs UTC date; discarded values still complete; lost lease on complete and on fail; unexpected throw (no secret in the log); claim and completion throwing; no log on the success path | Split into `runClaimed`, `loadBytes`, `readAll` while writing GREEN; no later change |
| 3.6/3.7 | same | Unit | 24/24 | 12 of 36 failed (`processRequestExtractions` undefined) | 36/36 | registration order and strict claim/complete interleaving; not configured (registers, claims nothing) and the same rows once configured; five rows with budget for two; timeouts 120 s then 65 s; 19,999 vs 20,000 ms boundary; time since `startedAt`; explicit deadline; unclaimed doc not counted; errored doc does not stop the rest; registration failure propagates | None needed |
| 3.8/3.9 | same | Unit | 36/36 | 7 of 43 failed (`runExtractionSweep` undefined) | 43/43 | abandon before select and bounded batch; not configured; three requests summed; deadline stops taking up requests; request throwing; errored documents; lease-step failure propagates | None needed |

### Test summary

- Total tests written: 53 (fakes 10, use case 43)
- Total passing: 53; `npx vitest run src/lib/extraction`: 8 files, 211 tests;
  full suite `npm test`: 5412 tests, all passing (was 5359)
- Layers: Unit (53). Approval tests: none (no refactoring task)
- Pure functions created: none new (the use case orchestrates, the rules stay in S1)

### Work Unit Evidence (S3)

| Evidence | Value |
|---|---|
| Focused test command and result | `npx vitest run src/lib/extraction/run.test.ts src/lib/extraction/fakes.test.ts`: 2 files, 53 tests, all passing |
| Runtime harness | N/A: use case over fakes and a mocked data module; no runtime boundary (the real adapters arrive in S4a/S4b, the real SQL is covered by S2) |
| Rollback boundary | Delete `src/lib/extraction/{ports,fakes,run}.ts` and `src/lib/extraction/{fakes,run}.test.ts` (nothing else in the repo is touched, and no caller exists yet) |

### Gates (2026-10-23, dummy `DATABASE_URL=postgres://u:p@127.0.0.1:9/x`)

- `npm test`: 5412 tests passed
- `npm run typecheck`: clean
- ESLint on `src/lib/extraction`, `src/lib/data`, `src/db`: 0 findings besides
  the CRLF `Delete ␍` noise; the five new files are clean
- `prettier --check --end-of-line auto src`: clean
- `npm run build`: not run (no caller yet; run at the next gate)

### Files changed

| File | Action | Authored lines |
|---|---|---:|
| `src/lib/extraction/ports.ts` | Created: `DocumentPreparer`, `FieldExtractor`, `ExtractionQueue`, closed result unions | 61 |
| `src/lib/extraction/fakes.ts` | Created: fake preparer, scripted extractor, recording queue | 98 |
| `src/lib/extraction/run.ts` | Created: `runDocumentExtraction`, `processRequestExtractions`, `runExtractionSweep` | 235 |
| `src/lib/extraction/fakes.test.ts` | Created | 132 |
| `src/lib/extraction/run.test.ts` | Created | 790 |
| `openspec/changes/document-extraction/{tasks,apply-progress}.md` | Modified (excluded) | n/a |

Authored diff: **1,316 lines** (prod 394 + tests 922), against a ~520 forecast
(2.5x). Committed as one unit (`size:exception`).

### Deviations from design

1. **Ports return closed unions, not thrown errors:** `PrepareResult` is
   `{ ok: true, prepared } | { ok: false, code }` (code limited to
   `unreadable_document | render_unavailable`) and `ExtractResult` is
   `{ ok: true, raw } | { ok: false, code }` (code limited to `timeout |
   model_error | invalid_response`), so no free text can cross a port.
2. **`ExtractionQueue.enqueue` returns `void`** (the `after()` adapter is fire
   and forget and swallows its own failure, DE-5).
3. **`runDocumentExtraction` never throws:** it returns `skipped | completed |
   failed | lost | errored`. An unexpected throw (including a failing claim or
   completion) is logged as `extraction_document_failed` with the id and the
   error name, `failExtraction` is not called and the lease is kept (DE-5).
4. **`processRequestExtractions` options are `{ startedAt } | { deadline }`**
   and it returns `{ processed, errored }`; the sweep passes its own deadline.
   `runExtractionSweep` returns `{ run, abandoned, failures }`, where
   `failures` adds the errored documents to the requests that threw (the
   design only says "failures count"). A failure of `abandonExpiredExtractions`
   or `selectExtractionCandidates` is not caught: S5b's `runIntakeSweep`
   counts the whole step as failed.
5. **The model timeout is computed after preparation** (remaining budget at the
   moment of the call), not at claim time; rendering a PDF eats into it. When
   less than 10 s remain it is `0`: the S4b extractor must treat a zero timeout
   as an immediate `timeout` (`AbortSignal.timeout(0)` does), which counts the
   attempt.
6. **`readAll` is duplicated** privately in `run.ts` (it is private in
   `remission-dispatch.ts`); extracting a shared helper would touch an
   unrelated module, left for a cleanup.
7. `ExtractionDeps` is `{ store, preparer, extractor, now? }`; the `queue`
   entry joins `getExtractionDeps()` in S5b (task 7.6), as planned.
8. The sweep checks `canStartDocument` before taking up each request, so an
   exhausted deadline does not register rows for requests it cannot process.
9. Spec and design drift on the dropped text path (batch 1, deviation 4) is
   unchanged and still to resolve at verify/archive.

### Issues found

- Authored diff 1,316 lines vs ~520 forecast; tests are 922 (the deadline,
  budget and failure-path tables). The aggregate forecast stays understated:
  S1 1,484 + S2 1,890 + S3 1,316 so far against ~1,840 forecast for the three.
- Windows tooling: a Python text-mode rewrite of a test file silently turned
  its line endings to CRLF while the repo's working tree is LF; fixed by
  rewriting the bytes. Use the Edit/Write tools, or binary mode.

### Remaining tasks

Phases 4-10 (S4a preparer, S4b extractor/env/deps/RNF-03, S5a staff UI, S5b
producers/sweep/pins, integration check, owner DB steps, closeout).

### Workload / PR boundary

- Mode: `size:exception`, single PR from `feat/document-extraction`
- Current work unit: S3 (ports, fakes, use case), committed as one unit
- Estimated review budget impact: S3 alone is ~2.5x its forecast; S4a-S5b
  should be re-forecast with a similar factor

## Batch 4 (2026-10-23): S4a dependencies and preparer (tasks 4.1-4.10)

Status: 4.1-4.10 done (4.6 and 4.7 were already N/A). Committed as one unit
(`size:exception`): `feat(extraction): add the sharp and unpdf document
preparer`. No database was touched.

### Completed tasks

- [x] 4.1 N/A (`size:exception`, stay on `feat/document-extraction`)
- [x] 4.2 `npm install sharp unpdf @napi-rs/canvas`: `sharp 0.35.5`, `unpdf 1.9.1`,
      `@napi-rs/canvas 1.0.13` (direct dependencies, caret ranges)
- [x] 4.3 RED/GREEN `src/next-config.test.ts`, `serverExternalPackages` in `next.config.ts`
- [x] 4.4/4.5 RED/GREEN image path
- [x] 4.6, 4.7 N/A (0.3 FAIL, dropped)
- [x] 4.8/4.9 RED/GREEN render path
- [x] 4.10 gates and diff measurement (PR part N/A)

### Dependency review (4.2)

- `package.json`: three lines added. No other dependency was requested.
- `package-lock.json` (+450 / -121): adds `@napi-rs/canvas`, its 11 platform
  packages (android, darwin, linux gnu/musl/riscv/arm, win32) and `unpdf`.
  `sharp` and the `@img/*` packages move 0.35.4 -> 0.35.5 (and `sharp-libvips-*`
  1.3.3 -> 1.3.4): `next` already carried sharp as an optional dependency, and making
  it direct resolved the latest 0.35.x. Only sharp's own tree changed.
- `npm install` warns about 24 audit findings and 6 packages with unapproved
  install scripts (`esbuild`, `@parcel/watcher`, `@swc/core`, `unrs-resolver`);
  all pre-existing, none from the new packages. Not touched.

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 4.3 | `src/next-config.test.ts` | Unit (imports the config) | `src/lib/import/next-config.test.ts` 2/2 | Written; 3 of 3 failed (`serverExternalPackages` undefined) | 3/3 + safety net 2/2 | lists canvas, omits sharp, exact list | None needed |
| 4.4/4.5 | `src/lib/extraction/adapters/sharp-unpdf-preparer.test.ts` | Unit (real sharp, generated fixtures) | N/A (new) | Written; run failed: `./sharp-unpdf-preparer` unresolved | 8/8 | EXIF 6 upright (red half on top, 1600 x 2560), no tag stays landscape (1600 x 1000), 800 px not enlarged, PNG -> JPEG bytes equal to a q85 reference, transparent PNG on white, garbage jpeg/png, truncated JPEG. Mutation check: dropping `.rotate()`, `.flatten()`, `quality 85` or `withoutEnlargement` each failed exactly one test | `flatten` added after thinking through alpha (JPEG has none) |
| 4.8/4.9 | same + `sharp-unpdf-preparer.unavailable.test.ts` | Unit (real unpdf + canvas, hand-built PDFs) | 8/8 | 7 of 15 failed (PDF branch stubbed as `unreadable_document`) | 20/20 (16 + 4) | mixed PDF (text page has ink, blank page is white), 8 pages -> first 5 in order (gray levels), 3 pages -> 3, widths <= 1600 incl. 3000x1000 and 100x100 pt, same bytes prepared twice, garbage / truncated / zero-page PDF, canvas import rejecting and throwing, images still work without canvas. Mutation checks: removing the page cap, the byte copy, the `canvasFailed` branch, the render width or the empty guard each failed a test | `destroy` fixed to `loadingTask.destroy()`; PDF builder moved to `adapters/test-support/pdf.ts` |

### Test summary

- Total tests written: 23 (config 3, image path 8, render path 8, unavailable 4)
- Total passing: 23; full suite `npm test`: 250 files, 5435 tests, all passing
  (was 5412)
- Layers: Unit (23). Approval tests: none (no refactoring task)
- Pure functions created: none (adapter over native libraries)

### Work Unit Evidence (S4a)

| Evidence | Value |
|---|---|
| Focused test command and result | `npx vitest run src/lib/extraction/adapters src/next-config.test.ts`: 3 files, 23 tests, all passing |
| Runtime harness | Real sharp 0.35.5, unpdf 1.9.1 and `@napi-rs/canvas` 1.0.13 run in the tests (PDF rendering is real, not mocked); `npm run build` with a dummy `DATABASE_URL`/`AUTH_SECRET` passes with `serverExternalPackages` set. The Vercel preview proof (native addons in the deployed function) stays task 9.2 |
| Rollback boundary | Revert `package.json` (3 lines), `package-lock.json`, `next.config.ts` (3 lines); delete `src/next-config.test.ts` and `src/lib/extraction/adapters/` (no caller exists yet) |

### Gates (2026-10-23, dummy `DATABASE_URL=postgres://u:p@127.0.0.1:9/x`)

- `npm test`: 250 files, 5435 tests passed. The very first full run showed one
  failure that I could not capture; four later full runs were all green and the
  new tests take under 1.1 s each, so it looks like a load-related timeout in an
  unrelated jsdom test, unconfirmed
- `npm run typecheck`: clean
- ESLint on `src/lib/extraction`, `src/next-config.test.ts`, `next.config.ts`:
  new files clean; `next.config.ts` shows only the CRLF `Delete ␍` noise of its
  CRLF working-tree copy (index is LF)
- `prettier --check --end-of-line auto src next.config.ts package.json`: clean
- `npm run build` (dummy `DATABASE_URL` and `AUTH_SECRET`, no Neon): passes, all
  routes build

### Files changed

| File | Action | Authored lines |
|---|---|---:|
| `src/lib/extraction/adapters/sharp-unpdf-preparer.ts` | Created: `createSharpUnpdfPreparer({ canvasImport? })` | 119 |
| `src/lib/extraction/adapters/sharp-unpdf-preparer.test.ts` | Created | 307 |
| `src/lib/extraction/adapters/sharp-unpdf-preparer.unavailable.test.ts` | Created | 72 |
| `src/lib/extraction/adapters/test-support/pdf.ts` | Created: hand-built PDF fixtures | 59 |
| `src/next-config.test.ts` | Created | 21 |
| `next.config.ts` | Modified: `serverExternalPackages` | 3 |
| `package.json` | Modified: three dependencies | 3 |
| `package-lock.json` | Modified (excluded) | n/a |
| `openspec/changes/document-extraction/{tasks,apply-progress}.md` | Modified (excluded) | n/a |

Authored diff: **584 lines** (prod 125 + tests and fixtures 459), against a ~400
forecast (1.5x), under the 800 threshold. Committed as one unit.

### Deviations from design

1. **`next-config.test.ts` imports the config object** rather than scanning the
   file text (task 4.3 says "file scan"); it matches the existing
   `src/lib/import/next-config.test.ts` and cannot be fooled by a comment.
2. **The `render_unavailable` test lives in its own file**
   (`sharp-unpdf-preparer.unavailable.test.ts`) instead of the single file named
   in 4.8: unpdf caches a successful canvas import at module level and vitest
   does not reset externalized dependencies with `vi.resetModules`, so file
   isolation is the reliable guard.
3. **The sharp step also flattens transparency onto white** (`flatten`), which
   DE-9 does not list: a transparent PNG would otherwise become black.
4. **The factory takes `{ canvasImport? }`**; the default is the lazy
   `() => import("@napi-rs/canvas")` of DE-9.
5. **PDF pages are rendered with `width: 1600`** (0.4 note), so a small PDF page
   is drawn at 1600 px wide, not at its natural size; the sharp step still caps
   at 1600 and never enlarges images.
6. **Every PDF takes the render path** (DE-14 failed), so there is no text
   threshold, `extractText` is unused, and one `getDocumentProxy` counts the
   pages (cap 5) and is reused for every page render.
7. **A page that fails to render, or an unreadable PDF, is
   `unreadable_document` (permanent)**; only a failing canvas import is
   `render_unavailable` (the code that keeps the attempt, DE-4/DE-9).

### Issues found

- Authored diff 584 lines vs ~400 forecast; the tests are 379 of them.
- Open risk, not addressed (out of task scope): a PDF page with an extreme aspect
  ratio (for example 1 x 14400 pt) would be rendered at width 1600, so its
  canvas height could be millions of pixels. The render would throw and map to
  `unreadable_document`, but it can use a lot of memory first. A page-size guard
  (reject when the rendered height exceeds a cap) belongs in a follow-up; the
  upload size caps of the intake pipeline bound the file but not the page box.
- Windows tooling: `sd` is not installed here, so mutation checks used a small
  Node script in the scratchpad; the working tree of `next.config.ts` is CRLF
  while the index is LF (Edit tool preserved it; `git diff` shows only the
  three added lines).

### Remaining tasks

Phases 5-10 (S4b extractor/env/deps/RNF-03, S5a staff UI, S5b producers/sweep/
pins, integration check, owner DB steps, closeout).

### Workload / PR boundary

- Mode: `size:exception`, single PR from `feat/document-extraction`
- Current work unit: S4a (dependencies and preparer), committed as one unit
- Estimated review budget impact: 584 authored lines, 1.5x the forecast; S4b
  onward keep the 2-3x correction factor seen so far

## Batch 5 (2026-10-23): unit A page-size guard (task 4.11) and S4b (tasks 5.1-5.10)

### Unit A: PDF page-size guard (task 4.11, owner-requested)

Status: 4.11 done, committed as `fix(extraction): guard the PDF render against
extreme page sizes`. Closes the open risk noted in batch 4 ("Issues found").

#### What was built

- `limits.ts`: `MAX_RENDERED_PAGE_HEIGHT = 10_000` and the pure
  `fitsRenderCap(width, height)` (false for zero, negative, NaN, infinite sizes
  and for `height * 1600 / width > 10,000`).
- Preparer: `pagesFitRenderCap(document, pages)` reads
  `(await document.getPage(n)).getViewport({ scale: 1 })` of each page that would
  be sent (the first 5; rotation is applied by the viewport) through the proxy
  the render already uses, before the first `renderPageAsImage`. One page over
  the cap returns `unreadable_document` for the whole document.
- `test-support/pdf.ts`: optional `rotate` on a page (`/Rotate`).

#### Why this cap

The canvas is `1600 x height` RGBA. At 10,000 px that is 16 MP, about 64 MB, and
a ratio of 6.25. Legal is 1.65, A4 1.41, a 400 mm thermal receipt (227 x 1134 pt)
is 5.0 and renders at 1600 x 7992; those all pass. A 600 mm roll (7.5) and a
1 x 14400 pt strip (23 M pixels, 92 MB per page, five pages = 460 MB) are
refused. JPEG's own limit is 65,535 px, so the cap also keeps well clear of it.
The cap is on height only because the width is always forced to 1600 (a very
wide, short page renders tiny and is not a memory risk).

#### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 4.11 limits | `src/lib/extraction/limits.test.ts` | Unit | 14/14 | Written; 20 of 34 failed (`fitsRenderCap` not a function; constant undefined) | 34/34 | 10 sizes (4 standard pages, boundary 100 x 625 pass / 100 x 626 fail, 600 mm roll, 1 x 14400, 14400 x 1) and 8 degenerate sizes | None needed |
| 4.11 preparer | `sharp-unpdf-preparer.test.ts` (+ `.unavailable.test.ts`) | Unit (real unpdf + canvas, hand-built PDFs, `renderPageAsImage` spied through a pass-through `vi.mock`) | 20/20 | Written; 6 of 28 failed (the guard cases; A4, receipt and page-6 cases passed against the unguarded code, as expected) | 62/62 on `adapters` + limits | A4 + legal; 227 x 1134 receipt; 1 x 14400; only page 3 extreme with 4 pages (zero renders, not even pages 1-2); page 5 extreme; page 6 extreme ignored; rotated 1000 x 100 refused vs unrotated passes; canvas addon missing + extreme page -> `unreadable_document`, addon never imported. Mutation check: removing the guard call failed 5 tests | `PdfDocument` type alias shared by the helper and `preparePdf` |

#### Work Unit Evidence (unit A)

| Evidence | Value |
|---|---|
| Focused test command and result | `npx vitest run src/lib/extraction/adapters src/lib/extraction/limits.test.ts`: 3 files, 62 tests, all passing |
| Runtime harness | Real unpdf 1.9.1 and `@napi-rs/canvas` 1.0.13 in the tests; the spy proves no render call for refused documents |
| Rollback boundary | Revert the guard call and helper in `sharp-unpdf-preparer.ts`, the two additions in `limits.ts`, the `rotate` option of `test-support/pdf.ts`, and the added tests |

#### Gates (dummy `DATABASE_URL`)

- `npm test`: 5462 tests passed (was 5435 + 27 new)
- `npm run typecheck`: clean
- ESLint on `src/lib/extraction`: only the CRLF `Delete ␍` noise
- `prettier --check --end-of-line auto src`: clean

Authored diff: **217 lines** (214 added, 3 removed across 6 source files;
`openspec/` excluded), well under 800.

#### Deviations

- Page 6 and later are not measured: they are never rendered.
- A page whose viewport cannot be read (`getPage` throws) is refused as
  `unreadable_document` like any other failing page.

Commit: `8333dce`.

### Unit B: S4b extractor, env, composition root, RNF-03 (tasks 5.1-5.10)

Status: 5.1-5.10 done (5.1 N/A). Committed as one unit (`size:exception`):
`feat(extraction): add the NuExtract HTTP extractor and the composition root`.
No database was touched; no container was started; every model call is a stubbed
`fetch`.

#### Completed tasks

- [x] 5.1 N/A (`size:exception`, stay on `feat/document-extraction`)
- [x] 5.2 RED/GREEN `src/env.test.ts` + `src/env.ts` (`EXTRACTION_API_URL`, `EXTRACTION_API_KEY`)
- [x] 5.3-5.6 RED/GREEN `nuextract-http-extractor` (request, responses, failures, cold start)
- [x] 5.7 RED/GREEN `configured.ts` (light `isExtractionConfigured`) and `deps.ts`
- [x] 5.8, 5.9 `rnf03.test.ts` (no production change needed)
- [x] 5.10 gates and diff measurement (PR part N/A)

#### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 5.2 | `src/env.test.ts` | Unit (`vi.resetModules` + stubbed env) | 6/6 | Written; 4 of 10 failed (variables not in the schema). The "unset or empty" test passes before the change by nature | 10/10 | set / unset / empty, URL without a key, key of 5 chars rejected, key of exactly 16 accepted | None needed |
| 5.3-5.6 + `limits` | `adapters/nuextract-http-extractor.test.ts`, `limits.test.ts` | Unit (injected `fetch`, fake timers, spied `AbortSignal.timeout`) | `limits` 34/34 pre-change | Written; run failed: `./nuextract-http-extractor` unresolved; the limits pin test failed on the two new constants | 60/60 + limits 34/34 (the pin test now covers the two new constants) | request: URL with path/trailing slash, bearer with and without key, `redirect: "error"`, abort after `timeoutMs`, `timeoutMs` 0/-1/-5000 -> `timeout` with no fetch; configuration: 2 usable and 4 unusable addresses, env read at use; responses: plain, 3 fence shapes, extra/missing keys, all-null, 10 invalid shapes, exactly 64 KiB passes, over 64 KiB cancels the stream, broken stream; failures: 6 HTTP statuses without retry, abort -> `timeout`, network message and key never leak, no console output; retry: connection error, 502/503/504, no retry on 500/401/403/429, second failure, abort in the retry, budget boundary 25,000 / 24,999 / 20,000 / 120,000 ms, elapsed time counted | Retry decision split into `isColdStart` and `interpret`; mutation checks (10): dropping `redirect`, the key condition, the `timeoutMs <= 0` guard, the 64 KiB cap, a status in the retry set, the `>=` edge, the elapsed-time term, the abort mapping, fence stripping and schema parsing each failed at least one test |
| 5.7 | `configured.test.ts`, `deps.test.ts` | Unit (`vi.mock` of `server-only`, `@/env`, adapters; heavy modules mocked with load recorders) | N/A (new) | Written; run failed: modules unresolved | 9/9 + 6/6 | 3 configured and 3 unconfigured shapes, env read each time, only the two variables exposed, no sharp/unpdf/canvas load; wiring, single store build, no queue entry, extractor env read at use, unset server does not throw, store failure propagates. Mutation checks: importing the preparer into `configured.ts`, and exposing `DATABASE_URL`, each failed a test | None needed |
| 5.8/5.9 | `rnf03.test.ts` | Integration (real preparer + real HTTP adapter, stubbed global `fetch`, generated documents) | N/A (new) | Characterization: passes at once because 5.6 and S4a already exist (no production change needed); mutation checks prove it can fail: sending to another host failed 2 tests, dropping the config check failed 1, adding an `openai` import failed the scan | 8/8 | 7 images + 3 PDFs on the configured host (10 requests, 1+1+1+1+1+1+1+1+2+5 image parts), a remote https host, unset address, plain http to a remote host; guard detector positive/negative, `package.json`, scan of every `src` file | None needed |

#### Test summary

- Total tests written: 88 (env 5, extractor 60, configured 9, deps 6, rnf03 8);
  limits pin test extended (2 constants)
- Total passing: 88; full suite `npm test`: 254 files, 5550 tests, all passing
  (was 5462)
- Layers: Unit (80), integration over stubbed network (8)
- Approval tests: none (no refactoring task)
- Pure functions created: none new (`unfence`, `parseAnswer`, `readBounded` are
  module-private helpers)

#### Work Unit Evidence (S4b)

| Evidence | Value |
|---|---|
| Focused test command and result | `npx vitest run src/lib/extraction src/env.test.ts`: 15 files, 351 tests, all passing |
| Runtime harness | `rnf03.test.ts` runs the real sharp/unpdf/canvas preparer and the real HTTP adapter with the global `fetch` replaced; `npm run build` (dummy `DATABASE_URL`/`AUTH_SECRET`) passes. One real extraction against the local container stays task 9.5 (owner), the container was not started here |
| Rollback boundary | Delete `src/lib/extraction/{configured,deps}.ts`, `src/lib/extraction/rnf03.test.ts`, `src/lib/extraction/{configured,deps}.test.ts` and `src/lib/extraction/adapters/nuextract-http-extractor{,.test}.ts`; revert the two variables in `src/env.ts` (and their tests), the two constants in `limits.ts` (and the pin test), and the `configured.ts` row in `design.md`. No caller exists yet |

#### Gates (2026-10-23, dummy `DATABASE_URL=postgres://u:p@127.0.0.1:9/x`)

- `npm test`: 254 files, 5550 tests passed
- `npm run typecheck`: clean
- ESLint on `src`: only the CRLF `Delete ␍` noise
- `prettier --check --end-of-line auto src next.config.ts package.json`: clean
- `npm run build` (dummy `DATABASE_URL` and `AUTH_SECRET`, no Neon): passes. No
  Next API was touched, so `node_modules/next/dist/docs/` was not needed

#### Files changed

| File | Action | Authored lines |
|---|---|---:|
| `src/lib/extraction/adapters/nuextract-http-extractor.ts` | Created | 204 |
| `src/lib/extraction/adapters/nuextract-http-extractor.test.ts` | Created | 533 |
| `src/lib/extraction/configured.ts` / `.test.ts` | Created | 23 / 102 |
| `src/lib/extraction/deps.ts` / `.test.ts` | Created | 23 / 90 |
| `src/lib/extraction/rnf03.test.ts` | Created | 306 |
| `src/env.ts` / `src/env.test.ts` | Modified | 5 / 52 |
| `src/lib/extraction/limits.ts` / `.test.ts` | Modified: two constants | 6 / 4 |
| `openspec/changes/document-extraction/{tasks,design,apply-progress}.md` | Modified (excluded) | n/a |

Authored diff: **1,348 lines** (prod 261 + tests 1,087), against a ~420
forecast (3.2x). Committed as one unit (`size:exception`).

#### Deviations from design

1. **The "remaining budget" of the cold-start retry is the call's own
   `timeoutMs`.** The `FieldExtractor` port hands over only `timeoutMs`, so one
   `AbortSignal.timeout(timeoutMs)` bounds both attempts and the retry runs only
   when `timeoutMs - elapsed - 5 s >= 20 s`. A `timeoutMs` that S3 capped at
   120 s (plenty of budget left in reality) is therefore judged by 120 s, never
   by more, which can only make the retry rarer, never exceed the deadline.
2. **`timeoutMs <= 0` is an immediate `timeout` with no fetch** (from S3).
3. **A call to `extract` while not configured answers `model_error` and sends
   nothing** (the closed `ExtractFailure` set has no `not_configured`; the use
   case checks `isConfigured()` first, so this is a safety net).
4. **The adapter takes `env: () => ExtractionEnv` instead of importing
   `@/env`**; `configured.ts` (`extractionEnv()`) supplies it. Keeps the adapter
   free of the env-parsing side effect and testable without environment setup.
5. **`configured.ts` is a new module** (design DE-1 lists none; task 5.7 allowed
   it): the light export for the review page.
6. **A `redirect` failure is indistinguishable from a connection error** in
   fetch (`TypeError`), so it may be retried once. Harmless (same host, same
   budget).
7. **The key condition and constants:** `COLD_START_RETRY_DELAY_MS` and
   `MAX_MODEL_RESPONSE_BYTES` live in `limits.ts` (DE-7, DE-8) beside the other
   numeric constants; the limits pin test covers them.
8. **The SDK denylist** adds a few more names than the task's examples
   (`@google-cloud/documentai`, `@aws-sdk/client-rekognition`,
   `@google/generative-ai`, `@google/genai`, `@mistralai/mistralai`,
   `@huggingface/inference`, `replicate`, `groq-sdk`, ...).
9. Spec and design drift on the dropped text path (batch 1, deviation 4) is
   unchanged and still to resolve at verify/archive.

#### Issues found

- Authored diff 1,348 lines vs ~420 forecast; tests are 1,087 (the response,
  failure and retry tables). Aggregate so far: S1 1,484 + S2 1,890 + S3 1,316 +
  S4a 584 + guard 217 + S4b 1,348.
- `.env.example` was not updated with the two new variables: the file is outside
  the permissions of this session. The owner may add `EXTRACTION_API_URL=` and
  `EXTRACTION_API_KEY=` (both optional) there.
- Windows tooling: running vitest with `--reporter=json` rewrites the tracked
  `.vitest/json/output.json`; it was restored with `git checkout`. Do not use
  that reporter.
- Real `AbortSignal.timeout` is not driven by vitest fake timers, so abort
  behavior is tested with a controllable signal (spied `AbortSignal.timeout`)
  and the retry wait with fake timers.
- A body read stalled with no abort would hang with a stubbed `fetch`; with the
  real `fetch` the signal also aborts the body stream, so the shared deadline
  applies. Not testable without a real server.

### Batch 5 status

Tasks 4.11 and 5.1-5.10 done. Remaining: phases 6-10 (S5a staff UI, S5b
producers/sweep/pins, integration check, owner DB steps, closeout).

### Workload / PR boundary

- Mode: `size:exception`, single PR from `feat/document-extraction`
- Current work units: guard (`8333dce`) and S4b, each committed as one unit
- Estimated review budget impact: guard 217 lines; S4b 1,348 lines (3.2x its
  forecast); S5a/S5b should keep the 2.5-3x factor

## Batch 6 (2026-10-24): S5a staff UI (tasks 6.1-6.8)

Status: 6.1-6.8 done (the branch in 6.1 and the S5a PR in 6.7 are N/A under
`size:exception`). Committed as one unit:
`feat(extraction): show the extracted data on the staff request detail`. No
database was touched; the section only reads through `listExtractions`.

### Completed tasks

- [x] 6.1 N/A branch (`size:exception`, stay on `feat/document-extraction`);
      [READ-ONLY] Next.js docs read (see "Next.js docs read")
- [x] 6.2 RED/GREEN i18n: `review.detail.sections.extraction` and `review.extraction.*`
- [x] 6.3/6.4 RED/GREEN `extraction-section.tsx` (server component, no polling)
- [x] 6.5/6.6 RED/GREEN page wiring (`page.tsx`)
- [x] 6.7 gates and diff measurement (S5a PR part N/A)
- [x] 6.8 commit unit 6

### Next.js docs read (6.1)

`node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
and `06-fetching-data.md`: pages and layouts are Server Components by default and
may query the database directly. The section needs no client code, so it is a
plain component that uses `useTranslations` like the sibling sections of
`request-sections.tsx` (sync, no `"use client"`), and the page stays the only
async data loader. No API changed in this batch.

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 6.2 | `src/i18n/review-messages.test.ts` | Unit (real catalogs, `createTranslator`) | `(dashboard)/review` + `src/i18n`: 19 files, 621/621 | Written; 11 of 31 failed (keys absent) | 31/31; `src/i18n` 6 files, 294 tests | every key non-empty in both locales; exact es and en configuration message; no `EXTRACTION_API`, url, key or clave in any value; usted register (no tuteo, `Revise`/`Vuelva` present); ICU plural 1 vs 5 in both locales; rest placeholders | None needed |
| 6.3/6.4 | `[id]/extraction-section.test.tsx` | Component (Testing Library + axe-core, real catalogs) | N/A (new) | Written; run failed: `./extraction-section` unresolved | 24/24 (one test pattern fixed: `min-w-0` is a shrink aid, not a fixed width) | full data, unrecognized field, days only, one-day rest, no time-zone shift (2026-01-01), Spanish, order of entries; extracting for 3 row shapes, failed, decided request (2 states) never extracting, config message once for 3 waiting docs, es message, completed data still shown unconfigured, failed stays unavailable unconfigured, degraded replaces entries, empty list renders nothing; card/dl/no fixed width/`break-all`; axe clean for data, failed and degraded | Typing of the axe `it.each` fixed after `tsc` |
| 6.5/6.6 | `[id]/page.test.tsx` | Component (page with mocked data layer) | 71/71 (all tests of the file before the change) | Written; 8 of 79 failed (3 pins passed by nature: access gate, student view, one audit row) | 79/79 | after `DocumentsSection`; read once with `12` and before `recordRequestRead`; snapshot name vs document name; decided request and unconfigured flag passed through; degraded read; throwing read; one audit row; Spanish; non-reviewer roles never reach the read; no role check in the page; student detail files reference no extraction code | `loadExtractions` helper extracted |

Mutation checks (9, each failed at least one test, files restored): swapped
extracting/unavailable (8), dropped one-day branch (1), no configuration notice
(4), notice per entry (4), "not recognized" without text (1), page hardcodes
`pendiente` (1), page hardcodes `configured` (1), page without the catch (1),
extraction read moved after the audited read (1).

### Test summary

- Total tests written: 46 (i18n 11, section 24, page 11)
- Total passing: full suite 255 files, 5,596 tests (was 254 files, 5,550)
- Layers: Unit (11), component (35). Approval tests: none
- Pure functions created: none new (the display rules are S1 `toExtractionDisplay`)

### Work Unit Evidence (S5a)

| Evidence | Value |
|---|---|
| Focused test command and result | `npx vitest run "src/app/(dashboard)/review" src/i18n`: 20 files, 667 tests, all passing |
| Runtime harness | `npm run build` (dummy `DATABASE_URL` and `AUTH_SECRET`) passes with the section in the page. Component and page tests use the real catalogs, `axe-core` and the real `Section`/`DegradedAlert`. The owner walk at 360 px in `es` and `en` stays task 9.5 (needs a database) |
| Rollback boundary | Delete `[id]/extraction-section.tsx` and its test; revert `[id]/page.tsx` (imports, `loadExtractions`, the section), the `export` of `useDates` in `request-sections.tsx`, the `extraction` keys in `i18n/{es,en}.json`, and the added tests in `[id]/page.test.tsx` and `src/i18n/review-messages.test.ts` |

### Gates (2026-10-24, dummy `DATABASE_URL=postgres://u:p@127.0.0.1:9/x`)

- `npm test`: 255 files, 5,596 tests passed (run before a type-only fix in the
  new test; the focused run above was repeated after it: 667 passed)
- `npm run typecheck`: clean (after fixing the readonly literal in the axe table)
- `npx eslint src`: 0 findings besides the CRLF `Delete ␍` noise (checked from
  the JSON report: 545 files, 0 non-CRLF messages)
- `prettier --check --end-of-line auto src next.config.ts package.json i18n`: clean
- `npm run build`: passes

### Files changed

| File | Action | Authored lines |
|---|---|---:|
| `src/app/(dashboard)/review/[id]/extraction-section.tsx` | Created | 164 |
| `src/app/(dashboard)/review/[id]/extraction-section.test.tsx` | Created | 357 |
| `src/app/(dashboard)/review/[id]/page.tsx` | Modified: `loadExtractions`, section after `DocumentsSection` | 29 |
| `src/app/(dashboard)/review/[id]/page.test.tsx` | Modified: mocks, 11 tests | 202 |
| `src/app/(dashboard)/review/[id]/request-sections.tsx` | Modified: `export` of `useDates` | 2 |
| `src/i18n/review-messages.test.ts` | Modified: 11 tests | 111 |
| `i18n/es.json`, `i18n/en.json` | Modified: 20 lines each | 40 |
| `openspec/changes/document-extraction/{tasks,apply-progress}.md` | Modified (excluded) | n/a |

Authored diff: **905 lines** (prod and catalogs 235 + tests 670), against a ~300
forecast (3x). Over the 800 threshold; committed as one unit per the owner's
pattern (`size:exception`).

### Deviations from design

1. **Extra key `review.extraction.restSingleDay`** ("{date} ({days})"): a
   one-day rest (from = to, 1 day) would otherwise read "Jul 20 to Jul 20 (1
   day)". Parity is still enforced for every key.
2. **The configuration message is shown once at the top of the section** and the
   entries waiting for setup are not listed (an entry with only a name and no
   body would be empty). Documents with data or `fallida` rows are still listed.
3. **A request with no current student documents and a successful read renders
   no section** (a heading and a note with nothing under them is noise). A
   degraded read always renders the section with the notice.
4. **The page also catches a throwing `listExtractions`** (`loadExtractions`),
   although the data module is already fail-soft: it makes the "Read failure"
   scenario hold at page level for any throw. It logs only the error name.
5. **The configuration notice is a warning-tinted status banner** (the alert
   pattern of the design system with the `warning` family), not the destructive
   `DegradedAlert`: it is a setup condition, not a failed read. The degraded
   notice reuses the shared `DegradedAlert`.
6. **`useDates` is exported from `request-sections.tsx`** to reuse the Managua
   and UTC date formatting instead of duplicating it.
7. **`isExtractionConfigured()` is called in the page body** (light module, loads
   neither sharp nor unpdf).
8. No `test-support.tsx` or `design-system.test.tsx` change was needed: the
   existing token scan picks up the new file and passes.

### Issues found

- Authored diff 905 lines vs ~300 forecast (3x); the tests are 670. Aggregate so
  far: S1 1,484 + S2 1,890 + S3 1,316 + S4a 584 + guard 217 + S4b 1,348 + S5a 905.
- Windows tooling: working-tree files are a mix of CRLF and LF (index LF); the
  new files are LF and git normalizes them on commit. Appends to CRLF files were
  converted to CRLF. The first full `npm test` chain exceeded the 120 s tool
  timeout and ran in the background; results were read from its output.
- `git add -N` (intent to add) was used on the new files to measure the diff.
- ESLint's `unix` formatter is not available in this ESLint version; the JSON
  report was used to filter the CRLF noise.

### Remaining tasks

Phase 7 (S5b producers, queue adapter, `maxDuration` pins, sweep step 4), phase 8
(integration check), phase 9 (owner database and runtime steps) and phase 10
(closeout).

### Workload / PR boundary

- Mode: `size:exception`, single PR from `feat/document-extraction`
- Current work unit: S5a (staff UI), committed as one unit
- Estimated review budget impact: 905 authored lines, 3x its forecast; S5b should
  keep the 2.5-3x factor

## Batch 7 (2026-10-24): S5b producers, queue adapter, sweep and pins (tasks 7.1-7.13)

Status: 7.1-7.13 done (the branch in 7.1 and the S5b PR in 7.12 are N/A under
`size:exception`). Committed as one unit:
`feat(extraction): extract documents after submit and correction and from the daily sweep`.
No database was touched; every data call in the tests is mocked. **This is the
slice that activates extraction.** Note for the eventual single PR body:
"activates extraction; merge gate: migration 0011 applied to Neon (task 9.4,
owner-only) before this reaches `main`". Until the table exists, the `after()`
callback fails and is logged by name, the staff list is `degraded`, and the
submission itself is unaffected (DE-5).

### Completed tasks

- [x] 7.1 N/A branch (`size:exception`, stay on `feat/document-extraction`);
      [READ-ONLY] `after.md` and `maxDuration.md` re-read (see "Next.js docs read")
- [x] 7.2/7.3 RED/GREEN `adapters/after-queue.ts`
- [x] 7.4/7.5/7.6 RED/GREEN both producers and the `queue` entry of `deps.ts`
- [x] 7.7/7.8 RED/GREEN `max-duration.test.ts` and the three `maxDuration = 300`
- [x] 7.9/7.10 RED/GREEN `runIntakeSweep(now, store, extraction?)`
- [x] 7.11 RED/GREEN the cron route (step wiring and `maxDuration`)
- [x] 7.12 Gates and diff measurement (S5b PR part N/A)
- [x] 7.13 Commit unit 7

### Next.js docs read (7.1)

`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md` and
`.../03-file-conventions/02-route-segment-config/maxDuration.md`: N1 `after`
runs even when `redirect()` is called (so the hand-off may sit just before the
redirect), N2 it runs within the route's default or configured `maxDuration`,
N3 a Server Action takes its duration from the `maxDuration` of the page that
uses it. All three match the design. Runtime proof: `next build` writes
`/requests/new`, `/requests/[id]/correct` and `/api/cron/intake-sweep` with
`maxDuration: 300` into `.next/server/functions-config-manifest.json`.

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 7.2/7.3 | `adapters/after-queue.test.ts` | Unit (`vi.mock` of `next/server` `after` and of `../run`) | N/A (new); the 24 files / 466 tests of the S5b surface green before any change | Written; run failed: `./after-queue` unresolved | 9/9 | one vs two hand-offs; callback args; clock and id kept per hand-off (callbacks run out of order); schedule throwing an `Error` subclass and a non-error (`unknown`); callback rejecting; no log on success or on a working schedule; the secret in the message never reaches a log. Mutation checks (5): dropping the clock, rethrowing on schedule, rethrowing on run, logging the message, running inline instead of in `after` each failed 1-8 tests | None needed |
| 7.6 (deps) | `deps.test.ts` | Unit (adapters mocked) | green in the 466 | 2 of 7 failed (no `queue` key; no queue handed the ports) | 7/7 | queue key present beside the three ports; the queue gets the same store, preparer and extractor and no `queue` of its own. Mutations (2): no queue, queue with its own wiring each failed | `ExtractionWiring` type keeps the use case unaware of the queue |
| 7.4/7.6 | `requests/new/actions.test.ts` | Unit (`vi.hoisted` pattern of the file; `getExtractionDeps` mocked) | 58/58 | 4 of 69 failed (the negative cases pass by nature: no draft, invalid draft, conflict, incomplete profile, failing transaction, missing consent, draft steps) | 69/69 | hand-off with the action's clock and before the redirect; after `submitDraft` (consent write stays inside it); throwing `enqueue` (`RangeError`, secret not logged); composition root that cannot be built. Mutations (5): enqueue after redirect, before the transaction, on conflict, wrong clock, no catch each failed 1-6 tests | Guard lifted into `scheduleExtraction` (shared with the correction) |
| 7.5/7.6 | `requests/[id]/correct/actions.test.ts` | Unit | 22/22 | 4 of 31 failed | 31/31 | hand-off only when `outcome.ok`, before the redirect, after the resubmission, with the very instant the resubmission got; invalid / conflict / not_found / refused id / failing transaction enqueue nothing; throwing hand-off and failing root swallowed; other correction steps never touch extraction. Mutations (3): outside `ok`, second clock, after redirect each failed 1-4 tests | None needed |
| 7.6 (harness) | `requests/new/schedule-extraction.test.ts` | Integration (real helper + real `deps.ts` + real `after-queue`; only `next/server`, `run`, the store and the native adapters replaced) | N/A (new) | Characterization: passes at once because the pieces exist; it adds proof of the composition, not behavior | 6/6 | one callback and nothing run before the response; the callback gets the wired ports and the clock; a second hand-off is separate; `after` outside a request scope; store that cannot be built; failing run | None needed |
| 7.7/7.8 | `max-duration.test.ts` | Unit (file scan) | N/A (new) | Written; 3 of 13 failed (the three entry points had no export) | 13/13 | detector: 2 literal forms, 8 rejected forms (imported constant, expression, re-export, other name, string, non-exported, commented, none); 3 real files equal `EXTRACTION_MAX_DURATION_S`. Mutations (2): 200, `60 * 5` each failed | None needed |
| 7.9/7.10 | `data/intake-sweep.test.ts` | Unit (db double) | 19/19 | 9 of 28 failed (two existing whole-shape assertions that now carry the two counts, seven new) | 28/28 | step runs once with `(now, now + 275 s)`; after the three cleanup steps (order proof); counts and failures summed; cleanup failures kept beside the step's; a throwing step leaves the cleanup done and counts one; no step -> zeros; no delete, update, insert or audit row on behalf of the step; a 40-day-old pendiente request and its file untouched; structural: only `limits` imported from the extraction slice. Mutations (5): extraction first, step throw escapes, step failures dropped, counts swapped, wrong deadline each failed 1-5 tests | `sweepExtractions` extracted |
| 7.11 | `api/cron/intake-sweep/route.test.ts` | Unit (mocked `runIntakeSweep`, `run`, `deps`) | 13/13 | 2 of 19 failed | 19/19 | the step calls `runExtractionSweep(now, deadline, wiring)`; the wiring is built only when the step runs and its failure rejects only the step; 401 builds and enqueues nothing; the JSON keys are exactly the six counts. Mutations (4): no step, wrong deadline, eager wiring at request time (a first attempt at this mutation was invalid: module-level code ran before the mocks were reset) each failed 1-2 tests | None needed |

### Test summary

- Total tests written: 65 (after-queue 9, deps 2 replacing 1, new actions 11,
  correction actions 9, harness 6, max-duration 13, sweep 9, route 6) -> net 64
- Total passing: full suite `npm test`: 258 files, 5,660 tests, all passing (was 255 files, 5,596)
- Layers: Unit (59), integration over mocked edges (6). Approval tests: none
  (the changed whole-shape assertions of the sweep test are updates, not
  refactoring tasks)
- Pure functions created: `literalMaxDuration` (test helper only); production
  code is wiring (`createAfterQueue`, `scheduleExtraction`, `sweepExtractions`)
- Mutation checks: 26 in total (25 killed at once; one invalid mutation, module-level
  code that ran before the mocks reset, was redone at request time and killed).
  Files restored each time

### Work Unit Evidence (S5b)

| Evidence | Value |
|---|---|
| Focused test command and result | `npx vitest run "src/app/(dashboard)/requests" src/lib/data/intake-sweep.test.ts src/app/api/cron src/lib/extraction`: 40 files, 865 tests, all passing |
| Runtime harness | `schedule-extraction.test.ts` runs the real helper, composition root and `after` queue together; `npm run build` (dummy `DATABASE_URL` and `AUTH_SECRET`) passes and writes `maxDuration: 300` for the three entry points to `functions-config-manifest.json`. A real submit with a real `after()` on a preview, the cron call and the local container stay tasks 9.2/9.5 (owner, need a database and migration 0011) |
| Rollback boundary | Delete `adapters/after-queue.ts`, `max-duration.test.ts`, `requests/new/schedule-extraction.test.ts` and their tests; revert `deps.ts` (queue entry and `ExtractionWiring`), `step-actions.ts` (`scheduleExtraction`), the two `actions.ts` (import and one call each), the three `maxDuration` exports, `intake-sweep.ts` (injected step, two counts, `deadlineFor` import) and `route.ts` (step and export), plus the added tests. Or, with no code revert: unset `EXTRACTION_API_URL` (rows register, nothing is sent) |

### Gates (2026-10-24, dummy `DATABASE_URL=postgres://u:p@127.0.0.1:9/x`)

- `npm test` (final tree, run after the last code edit; only markdown changed
  afterwards): 258 files, **5,660 tests passed** (was 255 files, 5,596; +3 files,
  +64 tests), exit 0, 117 s
- `npm run typecheck`: clean
- `npx eslint src`: 549 files, 0 findings besides the CRLF `Delete ␍` noise
  (checked from the JSON report)
- `npx prettier --check --end-of-line auto src next.config.ts package.json`:
  clean. `npm run format:check` (`prettier --check .`) still warns on 124 files
  under `docs/`, `openspec/`, `.engram/`, `.vitest/` that pre-date this batch;
  none is under `src` or a config file
- `npm run build` (dummy `DATABASE_URL` and `AUTH_SECRET`, no Neon): passes, all
  routes build; `.next/server/functions-config-manifest.json` lists
  `/requests/new`, `/requests/[id]/correct` and `/api/cron/intake-sweep` with
  `maxDuration: 300`

### Files changed

| File | Action | Authored lines |
|---|---|---:|
| `src/lib/extraction/adapters/after-queue.ts` | Created: `createAfterQueue(deps)` | 40 |
| `src/lib/extraction/adapters/after-queue.test.ts` | Created | 142 |
| `src/lib/extraction/deps.ts` / `.test.ts` | Modified: `queue` entry, `ExtractionWiring` | 12 / 28 |
| `src/app/(dashboard)/requests/new/step-actions.ts` | Modified: `scheduleExtraction` | 25 |
| `src/app/(dashboard)/requests/new/actions.ts` / `.test.ts` | Modified: one call; 11 tests | 5 / 128 |
| `src/app/(dashboard)/requests/[id]/correct/actions.ts` / `.test.ts` | Modified: one call, one shared `now`; 9 tests | 12 / 122 |
| `src/app/(dashboard)/requests/new/schedule-extraction.test.ts` | Created: runtime harness | 125 |
| `src/app/(dashboard)/requests/new/page.tsx`, `.../[id]/correct/page.tsx` | Modified: `maxDuration = 300` and a note | 6 / 6 |
| `src/lib/extraction/max-duration.test.ts` | Created | 68 |
| `src/lib/data/intake-sweep.ts` / `.test.ts` | Modified: injected step, two counts; 9 tests | 48 / 184 |
| `src/app/api/cron/intake-sweep/route.ts` / `.test.ts` | Modified: lazy step, `maxDuration`; 6 tests | 37 / 108 |
| `openspec/changes/document-extraction/{tasks,design,apply-progress}.md` | Modified (excluded) | n/a |

Authored diff: **1,096 lines** (1,078 added, 18 deleted; prod 191 + tests 905),
against a ~440 forecast (2.5x). Over the 800 threshold; committed as one unit per
the owner's pattern (`size:exception`).

### Deviations from design

1. **The guarded hand-off is one shared helper, `scheduleExtraction`, in
   `requests/new/step-actions.ts`**, called by both actions; the tasks say each
   `actions.ts` calls `getExtractionDeps().queue.enqueue(...)` in a guarded
   block. The module is the existing shared, non-"use server" one, so the helper
   is not a public endpoint, and the guard and its log exist once.
2. **The composition root is imported on demand** (`await import(...)`) in the
   helper and in the cron route. `deps.ts` loads sharp and the PDF libraries at
   import time; a static import would make a native-addon load failure break every
   student action (and the whole cron route, cleanup included). Now it costs the
   hand-off (logged `extraction_not_scheduled`) or the extraction step (one
   counted failure) and nothing else. Task 9.2 (preview proof) still verifies the
   addons load.
3. **`getExtractionDeps()` returns `ExtractionWiring`** (`ExtractionDeps &
   { queue }`) and `createAfterQueue` receives the three ports, not the wiring;
   the use case keeps its `ExtractionDeps` without a queue (batch 3 deviation 7
   planned the entry; the type split avoids a circular shape).
4. **`runIntakeSweep` computes the extraction deadline itself**
   (`deadlineFor(now)`, imported from the pure `limits.ts`) instead of the route:
   `now` is the invocation start, so the cleanup time counts. The structural test
   allows that single import from the extraction slice (no adapter, no `run`, no
   `deps`, no data module).
5. **`SweepCounts` always carries `extractionsRun` and `extractionsAbandoned`**
   (zero without a step). Two existing whole-shape `toEqual` assertions in
   `intake-sweep.test.ts` gained the two zero counts, and the route test's
   "only answers GET" now ignores the new `maxDuration` export; no other
   existing assertion changed.
6. **The `after-queue` logs also carry the request id** (non-sensitive, like the
   document id in `run.ts`); the task asked for the error name.
7. **`maxDuration` notes name `max-duration.test.ts`** as the pin; the cron
   route's pin is in the same file (the test lives with the extraction slice).
8. Spec and design drift on the dropped text path (batch 1, deviation 4) is
   unchanged and still to resolve at verify/archive.

### Issues found

- Authored diff 1,096 lines vs ~440 forecast (2.5x); tests are 905. Aggregate so
  far: S1 1,484 + S2 1,890 + S3 1,316 + S4a 584 + guard 217 + S4b 1,348 + S5a 905
  + S5b 1,096.
- **A `git stash -u` I ran to compare `format:check` against a baseline did not
  complete** (it printed `failed to remove` for empty untracked directories under
  `openspec/changes/archive/` and the pop was refused). The working tree was
  verified byte-identical to the stash (tracked diff empty, the four untracked
  files equal), the stash was dropped, and `git status` lists only this batch's
  files. Do not use stash for baselines on this Windows tree.
- `npm run format:check` (`prettier --check .`) fails on the whole repo for
  documents that pre-date this batch (`docs/`, `openspec/`, `.engram/`,
  `.vitest/`); nothing under `src` or the config files warns. The gate used is
  `prettier --check --end-of-line auto src next.config.ts package.json`.
- The test file `intake-sweep.test.ts` defines a local `path()` helper, so the
  Node `path` import is aliased `nodePath` there.
- Windows tooling: all touched files are CRLF in the working tree (index LF,
  `core.autocrlf=true`); edits went through a small script that preserves the
  endings (`git diff` shows only the intended lines).

### Remaining tasks

Phase 8 (integration check on the final tree), phase 9 (owner-run database and
runtime steps: preview proof, backup, migration 0011, owner walk) and phase 10
(closeout).

### Workload / PR boundary

- Mode: `size:exception`, single PR from `feat/document-extraction`
- Current work unit: S5b (producers, queue adapter, sweep, pins), committed as
  one unit
- Estimated review budget impact: 1,096 authored lines, 2.5x its forecast.
  Merge gate for the single PR: migration 0011 applied to Neon first (task 9.4,
  owner-only)

## Batch 8 (2026-10-24): integration check and spec/design reconciliation (8.1, 8.2)

Status: 8.1 and 8.2 done. Strict TDD stays active. No database was touched and no
production code changed: the reconciliation went the documentation way in every
case (see "Reconciliation decisions"), and the scenario audit found scenarios
without a direct test, closed with test additions (tests only). Committed as one
unit (`size:exception`). `proposal.md` and `openspec/specs/**` are untouched
(main specs sync at archive, task 10.2).

### Completed tasks

- [x] 8.1 Gates on the final tree (all slices are commits of this one branch)
- [x] 8.2 Scenario audit: all 61 scenarios of the three delta specs mapped
      (tables below); gaps closed in this batch, none left open

### 8.1 Gates (2026-10-24, `DATABASE_URL=postgres://u:p@127.0.0.1:9/x`, dummy `AUTH_SECRET` for the build)

| Gate | Result |
|---|---|
| `npm test` on HEAD `732d299` before any change | 258 files, 5,660 tests passed, exit 0, 108 s |
| `npm test` on the final tree | 258 files, **5,663 tests passed** (+3), exit 0, 117 s |
| `npm run typecheck` | clean, exit 0 |
| `npx eslint src` | 93,991 findings, **every one** the CRLF `Delete ␍` noise of the Windows working tree (`core.autocrlf=true`, the index is LF); 0 other findings, 0 warnings (checked line by line with the filter) |
| `npx prettier --check --end-of-line auto src next.config.ts package.json` | "All matched files use Prettier code style!", exit 0 |
| `npm run build` | passes, exit 0 ("Compiled successfully"); `.next/server/functions-config-manifest.json` lists `/requests/new`, `/requests/[id]/correct` and `/api/cron/intake-sweep` with `maxDuration: 300` |
| `npm run format:check` (`prettier --check .`) | **fails, exit 2, as known**: it warns on 525 files, but 401 of them differ only by line ending (they pass with `--end-of-line auto`: the working tree is CRLF, the index LF) and the other 124 are pre-existing (109 under `openspec/`, 13 under `docs/`, plus `.engram/` and `.vitest/`); none is under `src` or a config file; `openspec/config.yaml` also fails to parse (pre-existing). Nothing was reformatted |

"All slices merged on the tracker" maps to this branch head under `size:exception`
(task 0.1): there are no slice PRs.

### 8.2 Scenario audit

Evidence key: paths are under `src/`; tests are named by their title (or by the
`describe` for tables). "9.5" is the owner walk (task 9.5), "9.2" the preview
proof. "opt-in integration" is
`lib/data/integration/extraction-claim.integration.test.ts` (task 2.17: written,
not run; it runs only on a disposable branch at 9.5, which lists it as optional).

#### `document-extraction` (39 scenarios)

| # | Scenario | Evidence |
|---|---|---|
| 1 | Eligible document registered once | `lib/data/extraction.test.ts` "registers each eligible document as pendiente and returns the claimable ids", "never overwrites a row that already exists, whatever its state" (`ON CONFLICT DO NOTHING`), "runs all four statements in one transaction"; a real double run on Postgres: 9.5(c) |
| 2 | Retired and staff documents | same file "reads only finalized student documents of the request", "gives a retired document without a row no_aplica instead of pendiente" |
| 3 | Correction extracts only new documents | same file "turns only the open rows of retired documents into no_aplica and frees their claim", "never overwrites a row that already exists, whatever its state"; `app/(dashboard)/requests/[id]/correct/actions.test.ts` "hands the resubmitted request to extraction with the action's clock, before the redirect"; 9.5(d) |
| 4 | Model outage does not block submit | `app/(dashboard)/requests/new/actions.test.ts` "a throwing hand-off is logged by name and the student still reaches the confirmation"; `lib/extraction/run.test.ts` "model errors" (timeout, model_error, invalid_response); recovery by the sweep: intake #5 and #6; 9.5(c) |
| 5 | Hand-off failure is swallowed | `requests/[id]/correct/actions.test.ts` "a throwing hand-off is logged by name and the correction is still stored without an error to the student"; `lib/extraction/adapters/after-queue.test.ts` "logs a failing schedule by error name and does not rethrow"; `requests/new/schedule-extraction.test.ts` "a store that cannot be built is swallowed too" |
| 6 | Blocked submit registers nothing | `requests/new/actions.test.ts` "enqueues nothing for %s" (blocked, refused and failing submits), "enqueues nothing when the consent is missing: nothing was stored"; `requests/[id]/correct/actions.test.ts` "enqueues nothing for %s" |
| 7 | Concurrent claim | `lib/data/extraction.test.ts` "matches a pending row, or a processing row whose lease expired, under the cap", "stamps a fresh uuid, the time and one more attempt"; `lib/data/extraction-sql.test.ts` "claims with one UPDATE ... FROM ... JOIN ... RETURNING, the attempt bumped in SQL"; the race itself: opt-in integration "lets exactly one of several simultaneous claims win, and counts one attempt" (9.5, optional) |
| 8 | Expired lease recovered | `extraction.test.ts` "matches a pending row, or a processing row whose lease expired, under the cap", "returns pending and expired-lease rows of live documents under the attempt cap, by id" |
| 9 | Stale holder cannot complete | `extraction.test.ts` completeExtraction "changes nothing for a holder whose claim was replaced", "matches the row only by its document, its claim and the processing state"; failExtraction "changes nothing for a holder whose claim was replaced"; `run.test.ts` "reports a lost lease when the guarded completion matches nothing" |
| 10 | Lease expires on the last attempt | `extraction.test.ts` "turns expired leases on the last attempt into fallida with a timeout code", "matches only processing rows with an expired lease and no attempt left"; `run.test.ts` "closes the expired last-attempt leases first, then selects a bounded batch" |
| 11 | Third failure is final | `lib/extraction/states.test.ts` `failureOutcome` tables; `extraction.test.ts` "%s on attempt %i leaves the row %s with the code and no claim" (third attempt -> fallida) |
| 12 | Unreadable document is final | `states.test.ts` "treats an unreadable document as final on the first attempt"; `extraction.test.ts` the same table, row `unreadable_document` / 1 / `fallida`; `lib/extraction/adapters/sharp-unpdf-preparer.test.ts` "fails bytes that are not a PDF as unreadable_document" |
| 13 | Not configured keeps the attempt | `run.test.ts` "hands the claim back before reading the store or calling the network", "registers the rows but claims nothing and burns no attempt"; `extraction.test.ts` "hands a not_configured claim back as pendiente and returns the attempt (attempt %i)" |
| 14 | Empty answer completes | `lib/extraction/validate.test.ts` "an empty answer"; `run.test.ts` "completes on an empty answer", "still completes when validation discards every value"; `extraction.test.ts` "completes an answer with no recognized value" |
| 15 | Cold start retried once | `lib/extraction/adapters/nuextract-http-extractor.test.ts` "cold start retry": "retries once after 5 s on a connection error, then returns the answer", "retries once on HTTP %i" (502/503/504), "does not retry on HTTP %i" (500/401/403/429), "counts the time the first attempt already used against the retry budget"; the retry sits inside one `extract` call, so `Intentos` (bumped only by the claim) cannot move |
| 16 | Deadline reached | `run.test.ts` "with five rows and a budget for two, processes two and leaves three untouched", "gives each model call min(120 s, remaining - 10 s)", the 19,999 / 20,000 ms table |
| 17 | Duration pinned | `lib/extraction/max-duration.test.ts` "maxDuration pins" (three files, detector tested) |
| 18 | Bearer only with a key | `nuextract-http-extractor.test.ts` "sends no authorization header without a key", "sends the bearer when a key is set, on the same address" |
| 19 | Plain HTTP to a remote host | `lib/extraction/config.test.ts` "rejected addresses"; `lib/extraction/rnf03.test.ts` "makes no request when the address is plain http to a remote host" |
| 20 | Loopback over HTTP allowed | `config.test.ts` "accepted addresses" (`http://localhost:8080`, `127.x`, `[::1]`); `rnf03.test.ts` "sends 10 extractions (7 images, 3 PDFs) to the configured host and nowhere else" (the configured host is the loopback `http://127.0.0.1:8080`) |
| 21 | Large rotated photo | `sharp-unpdf-preparer.test.ts` "turns a large photo with EXIF orientation 6 upright at width 1600" |
| 22 | Mixed PDF | same file "renders every page of a mixed PDF as an image, text page included" |
| 23 | Text-layer PDF | same file "renders a PDF whose every page has a text layer as images too, never as text (scenario: Text-layer PDF)" (**added in this batch**) |
| 24 | Page cap | same file "sends only the first 5 pages of an 8-page scan, in order" |
| 25 | Extreme page refused | same file "page-size guard": "refuses a 1 x 14400 pt page without rendering it", "refuses the whole document when only page 3 is extreme, rendering nothing", "renders a long receipt (227 x 1134 pt, ratio 5) at the width cap"; `lib/extraction/limits.test.ts` `fitsRenderCap` tables |
| 26 | Days computed inclusive | `validate.test.ts` "computes the days inclusive in code and ignores the model's value (scenario: Days computed inclusive)" |
| 27 | Invented rest discarded | `validate.test.ts` "rest period, any other combination is not recognized": "drops a lone rest_from equal to the issue date" |
| 28 | Duration only | `validate.test.ts` "recognizes a duration with no dates (scenario: Duration only)" |
| 29 | Window boundaries | `validate.test.ts` "issue date (DE-10, scenario: Window boundaries)" table (the four rows of the spec and the 29 Feb reference) |
| 30 | Completed year | `validate.test.ts` "drops a completed handwritten year (scenario: Completed year)" |
| 31 | Rest still running at submission | `validate.test.ts` "keeps a rest that is still running at submission (scenario: Rest still running)" |
| 32 | Rest end outside the window | `validate.test.ts` "rest end one day past the 30-day lookahead is dropped" (2026-11-22) and its kept twin at +30 days |
| 33 | Rest start after submission | `validate.test.ts` "drops the whole period when the start is after submission (scenario: Rest start after submission)" |
| 34 | No raw content kept | `run.test.ts` "write nothing on the success path and nothing from the document"; `db/migration-document-extraction.test.ts` "stores no confidence, name-match flag, text or raw answer"; `extraction.test.ts` "logs one event, by id and code only, never a pathname, name or value" |
| 35 | Snapshot untouched | `extraction.test.ts` "changes no table but ExtraccionDocumento, so the request snapshot is never touched (scenario: Snapshot untouched)" (**added in this batch**); read side: `app/(dashboard)/review/[id]/page.test.tsx` "shows the snapshot name in the student section and the document name in this one" |
| 36 | Cascade and no audit | `migration-document-extraction.test.ts` "cascades the row away with its document"; `extraction.test.ts` "imports nothing from the audit modules and writes no audit row"; `lib/data/intake-sweep.test.ts` "deletes and modifies nothing on behalf of the step, and writes no audit row"; the real cascade: opt-in integration "deletes the extraction row with its document" (9.5, optional) |
| 37 | Ten extractions, one host | `rnf03.test.ts` "sends 10 extractions (7 images, 3 PDFs) to the configured host and nowhere else", "keeps to the configured host when it is a remote https host"; one real extraction against the local container: 9.5(b) |
| 38 | Third-party SDK added | `rnf03.test.ts` "detects an import of a hosted OCR or inference SDK", "finds no such SDK in package.json", "finds no such SDK imported anywhere under src" |
| 39 | Not configured sends nothing | `rnf03.test.ts` "makes no request at all when no address is configured"; `nuextract-http-extractor.test.ts` configuration table (unusable addresses -> not configured); 9.5(a) |

#### `justification-intake` (10 scenarios)

| # | Scenario | Evidence |
|---|---|---|
| 1 | Unauthorized sweep call | `app/api/cron/intake-sweep/route.test.ts` "rejects %s and deletes nothing" (seven credential shapes; `runIntakeSweep` is never called, and the extraction step exists only as its argument), "fails closed when the secret is not configured" |
| 2 | One failure does not stop the sweep | `lib/data/intake-sweep.test.ts` "one failing blob deletion does not stop the sweep (spec: One failure)" |
| 3 | Pending requests untouched | `intake-sweep.test.ts` "leaves a pendiente request older than 30 days and its documents alone", "never selects a returned request: the draft sweep is borrador only" |
| 4 | Extraction failure does not stop cleanup | `intake-sweep.test.ts` "a throwing step still leaves the cleanup done and counts one failure (spec: Extraction failure does not stop cleanup)"; `route.test.ts` "a failing step is the sweep's to count: the call still answers 200 with the counts", "builds the extraction wiring only when the step runs, so cleanup never depends on it" |
| 5 | Missing row recovered | `extraction.test.ts` "picks up a pending row, an expired lease under the cap, or a document with no row"; `extraction-sql.test.ts` "selects candidates with two correlated EXISTS, a bounded ordered batch"; `run.test.ts` "processes each candidate request through the use case and sums the documents", "registers first, then processes the ids it got back one at a time"; 9.5(c) |
| 6 | Expired lease recovered | `extraction.test.ts` the same "picks up..." test; claim "matches a pending row, or a processing row whose lease expired, under the cap" |
| 7 | Only pending requests | `extraction.test.ts` "considers only requests still pending"; `extraction-sql.test.ts` (the emitted candidate statement) |
| 8 | Backfill is bounded | `extraction.test.ts` "returns the request ids, oldest clock start first, at most the limit", "passes the limit it is given"; `run.test.ts` "closes the expired last-attempt leases first, then selects a bounded batch" |
| 9 | Deadline stops the step | `run.test.ts` "stops taking up requests once the deadline leaves no room for a document"; `intake-sweep.test.ts` "runs once with the sweep clock and the invocation deadline" |
| 10 | Not configured | `run.test.ts` "skips the candidates when not configured but still closes the leases", "registers the rows but claims nothing and burns no attempt"; 9.5(a) |

#### `request-review` (12 scenarios)

| # | Scenario | Evidence |
|---|---|---|
| 1 | Full data shown | `app/(dashboard)/review/[id]/extraction-section.test.tsx` "shows the four fields with the rest range and its days (Full data shown)"; `lib/extraction/display.test.ts` "returns every field with its value and a rest range with days (scenario: Full data shown)"; 9.5(b) |
| 2 | Unrecognized field | `extraction-section.test.tsx` "marks a field without value as muted 'not recognized' with no value (Unrecognized field)"; `display.test.ts` "marks a field without value as not recognized (scenario: Unrecognized field)" |
| 3 | Days only | `extraction-section.test.tsx` "shows only the days when the document gave no dates (Days only)"; `display.test.ts` "returns days alone, with no dates, when the document gave none (scenario: Days only)" |
| 4 | Snapshot name wins | `extraction-section.test.tsx` "labels the name as read from the document and says it is not compared"; `review/[id]/page.test.tsx` "shows the snapshot name in the student section and the document name in this one" |
| 5 | Not for students or other roles | `lib/auth/permissions.test.ts` "canReviewRequests (RN-15: only secretaria reviews)" (`rolesRevisores` is `secretaria` only); `review/[id]/page.test.tsx` "keeps the access gate unchanged: one requireRole over rolesRevisores, no role check of its own", "gives the student detail no extraction read, section or type" |
| 6 | Extracting | `extraction-section.test.tsx` "reads 'extracting' for %s, with no action and no values" (processing, pending, missing row); `display.test.ts` "states without data" |
| 7 | Permanently failed | `extraction-section.test.tsx` "reads 'unavailable, review the document' for a failed row, with no control"; `display.test.ts` "a fallida row reads unavailable (scenario: Permanently failed)" |
| 8 | Not configured | `extraction-section.test.tsx` "shows the configuration message once for several waiting documents, without the variable name", "words the configuration message in Spanish"; `i18n/review-messages.test.ts` "%s never names the variable, the address or the key in any extraction text"; 9.5(a) |
| 9 | Decided request never extracting | `extraction-section.test.tsx` the `aprobada` / `devuelta` table; `display.test.ts` "a request that is no longer pending never shows extracting"; `review/[id]/page.test.tsx` "passes the request state: a decided request never reads 'extracting'" |
| 10 | Read failure | `extraction-section.test.tsx` "replaces every entry with the degraded notice, with no partial values"; `page.test.tsx` "renders the rest of the detail with the degraded notice when the read throws"; `extraction.test.ts` "returns an empty degraded result, with no partial data, when the query throws" |
| 11 | One audit row | `page.test.tsx` "writes exactly one audit row, with the same arguments as before", "loads the extractions for the opened request, before the audited read"; 9.5(f) |
| 12 | Translation keys present | `i18n/review-messages.test.ts` "es.json and en.json hold exactly the same review keys", "%s names the section and every extraction text" |

Gaps found by the audit and closed in this batch (tests only, no production change):

| Scenario | Gap | Closed by |
|---|---|---|
| #23 Text-layer PDF (new, from the DE-14 consequence) | No test used a PDF whose every page has a text layer; the mixed-PDF test had one blank page | `adapters/sharp-unpdf-preparer.test.ts` "renders a PDF whose every page has a text layer as images too, never as text" |
| #35 Snapshot untouched | Only the read side was pinned; nothing proved the data module writes no other table | `lib/data/extraction.test.ts` "lists the table of every ORM write call, not only this one" (detector) and "changes no table but ExtraccionDocumento..." |
| intake #1 Unauthorized sweep call | Evidence is indirect: the extraction step runs only inside `runIntakeSweep`, which the test asserts is not called | Kept as is: assertions on mocks that cannot be reached would be vacuous (strict-tdd assertion rules) |

Residual coverage that depends on the owner (phase 9, not gaps): the real race of
#7 and the real cascade of #36 are proven only by the opt-in integration test
(task 2.17), which 9.5 lists as optional; the owner should run it. The native
addons in the deployed function and the 360 px walk stay 9.2 and 9.5(e).

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 8.2 gap #23 | `src/lib/extraction/adapters/sharp-unpdf-preparer.test.ts` | Unit (real unpdf, canvas and sharp, hand-built PDF) | 24/24 in the file before the change | Characterization: the behavior exists (DE-14 consequence), so it passes at once; it pins the absence of a text branch (kind `images`, 2 pages, ink on both) | 25/25 | Complements the mixed-PDF test (a text page plus a blank page) with a PDF that is text on every page | None needed |
| 8.2 gap #35 | `src/lib/data/extraction.test.ts` | Unit (file scan of the module) | 43/43 before the change | Detector test and module test written; the module test passes at once (the module does write only its own table). Mutation check: appending `db.update(solicitud).set({})` to `extraction.ts` failed it (6 write calls, expected 5); file restored with `git checkout` | 45/45 | The detector is fed three write shapes on three tables and a read; the module check also scans every `sql` template fragment for a write verb | None needed |

Focused run after the additions: `npx vitest run src/lib/data/extraction.test.ts src/lib/extraction/adapters/sharp-unpdf-preparer.test.ts`: 2 files, 69 tests, all passing.

### Work Unit Evidence (batch 8)

| Evidence | Value |
|---|---|
| Focused test command and result | the command above: 2 files, 69 tests passed; full suite 258 files, 5,663 tests passed |
| Runtime harness | `npm run build` (dummy `DATABASE_URL` and `AUTH_SECRET`) passes and writes `maxDuration: 300` for the three entry points; the preparer test renders real PDFs through real unpdf, canvas and sharp |
| Rollback boundary | Revert this commit: `design.md` and the three delta specs, the two test additions, and the artifacts of this batch (`tasks.md`, `apply-progress.md`). No production file changes |

### Reconciliation decisions

Rule applied to every item: the code is the reference when it satisfies the
intent of the requirement and the spec or design text is merely older; the code
is changed (with tests) only when it contradicts an intended requirement. **No
code needed to change**; every item was resolved by editing the spec or the
design.

| # | Item | Chosen | Why |
|---|---|---|---|
| 1 | Text path (DE-9 text row, DE-10 text rule, DE-14 as a first task, DE-6 `sourceText`, DE-8 `<text>` content, `Motor` text value, RNF-03 "3 text PDFs", the spec requirement "Values from text must appear in the text" with its two scenarios, "text-layer" in "No raw content kept") | Removed or rewritten; DE-14 now records the measurement and the decision with a pointer to `docs/investigacion/spike-ocr-resultados.md`; new scenario "Text-layer PDF" | Measured FAIL (issuer 3/6): every PDF takes the image path; there is no text or rules extractor |
| 2 | S2-1 registration is four statements (no `INSERT ... SELECT`) | Design DE-5 | drizzle needs the select to project every column; behavior and transaction are the same |
| 3 | S2-2 claim also needs `PresentadaEn IS NOT NULL` | Spec "State machine" and DE-6 | A draft has no clock start; strictly safer |
| 4 | S2-3 registration also returns `procesando` rows with an expired lease | Design DE-5 | Needed so "Expired lease recovered" selects work it can then claim |
| 5 | S2-4 candidates ordered by `COALESCE(ReenviadaEn, PresentadaEn)` | Design DE-11 (the spec already said "clock start") | Matches the queue index and the spec |
| 6 | S2-5 `fallida` rows of a retired document are left alone | Design DE-3 diagram (`fallida` dropped from the retire arrow) and spec "Eligibility" ("open row", final rows stay) | The spec already made `fallida` final; the diagram contradicted it; the staff read omits retired documents |
| 7 | S2-6, S2-7, S2-8 (`not_configured` code stored, read-model shape, `db-double`) | No change; DE-4 already keeps the code for diagnostics | Internal shapes |
| 8 | S3: ports return closed unions; `enqueue` is `void`; `runDocumentExtraction` never throws and returns an outcome; `processRequestExtractions` options `{ startedAt } \| { deadline }` and result `{ processed, errored }`; sweep result `{ run, abandoned, failures }`; model timeout taken after preparation (0 under 10 s, immediate `timeout`); the sweep checks `canStartDocument` per request; `ExtractionDeps` / `ExtractionWiring` | Design DE-1, DE-5, DE-6, DE-11; spec "Execution budget" (zero timeout, 20 s rule, timeout formula) | Behavior matches the intent; the text was less precise |
| 9 | S4a: the sharp step also flattens transparency; every PDF rendered at width 1600; a failing page or unreadable PDF is `unreadable_document`; only a failing canvas import is `render_unavailable` | Spec "Document preparation" and design DE-9 | Black PNG backgrounds would be a defect; the codes follow DE-3 and DE-4 |
| 10 | 4.11 page-size guard | Spec "Document preparation" (new sentence) and scenario "Extreme page refused"; DE-9 already carried it | The guard postdated the spec |
| 11 | S4b: the retry budget is the call's own `timeoutMs`; `timeoutMs <= 0` is an immediate `timeout`; a `redirect: "error"` failure looks like a connection error; not configured answers `model_error`; 64 KiB body semantics | Design DE-7 and DE-8; spec "Attempts" gains the cold-start paragraph and the scenarios "Cold start retried once" and "Unreadable document is final" | The deviation only makes the retry rarer; it never exceeds the deadline |
| 12 | S4b: `configured.ts` and `env: () => ExtractionEnv` | Design DE-1 | Already listed in batch 5; confirmed |
| 13 | S5a: `restSingleDay`, the configuration notice once at the top (waiting entries not listed), no section when the request has no student document, page-level catch of a throwing read, warning-tinted banner, `useDates` exported | Spec "Extracted data section", "Extraction states", "fail-soft"; design DE-13 (now a precedence table) | Matches the intent of every scenario; the old DE-13 table contradicted the precedence of the spec |
| 14 | S5b: shared guarded `scheduleExtraction` in `step-actions.ts`, on-demand import of `deps.ts`, `runIntakeSweep` computes the deadline itself, request id in after-queue logs | Design DE-5, DE-11, DE-12; spec "Triggers" (a composition root that cannot be built is swallowed) and "Stored data and logs" (request ids may be logged) | Failure containment is exactly the spec's "queueing failure of any kind" |
| 15 | The sweep processes inline instead of "handing documents to the queue"; the batch of 10 is requests, not documents; the report counts documents processed and leases closed, not "re-enqueued" | Intake spec rewritten ("takes up", "at most 10 requests", counts) | The design (DE-11) always described it so; only the spec used queue wording |
| 16 | `abandonExpiredExtractions` closes expired last-attempt leases whatever the request state | Spec (state machine and intake): stated as the one exception to "only `pendiente` requests"; code kept | Intent preserved: it touches no request or document, and an orphan `procesando` row on a decided request would otherwise never end |
| 17 | Loopback is `127.0.0.0/8`, not only `127.0.0.1`; an address with credentials, or one that does not parse, is not configured | Spec "Engine contract" | Stricter than the old text, tested in `config.test.ts` |
| 18 | Review-workload note: authored total about 8,840 lines vs about 3,400 forecast | Design "Review Workload Forecast" (one line) | Honest record for the PR description |

Not edited on purpose: `proposal.md` (its text-path bullet already says the image
path is the fallback if the measurement fails) and the task text of earlier phases.

### Files changed

| File | Action |
|---|---|
| `openspec/changes/document-extraction/design.md` | Modified: reconciled with the build (DE-1..DE-14, file changes, testing strategy, forecast note) |
| `openspec/changes/document-extraction/specs/document-extraction/spec.md` | Modified: text path removed; preparation, guard, attempts and retry, budget, engine contract, logs |
| `openspec/changes/document-extraction/specs/justification-intake/spec.md` | Modified: sweep wording (inline processing, request batch, counts, deadline) |
| `openspec/changes/document-extraction/specs/request-review/spec.md` | Modified: omitted section, precedence, notice once at the top, page-level fail-soft |
| `src/lib/extraction/adapters/sharp-unpdf-preparer.test.ts` | Modified: +1 test |
| `src/lib/data/extraction.test.ts` | Modified: +2 tests |
| `openspec/changes/document-extraction/{tasks,apply-progress}.md` | Modified (8.1 and 8.2 marked; this section) |

### Issues found

- `npm run format:check` cannot be a clean gate on this Windows checkout: 401
  files fail on line endings alone and 124 are pre-existing document warnings
  (see 8.1). The gate used is `prettier --check --end-of-line auto` on `src`,
  `next.config.ts` and `package.json`.
- Batch 4 reported one unexplained failure in a first full run; the baseline run
  of this batch on HEAD and the final run were both fully green.
- The owner-only integration test (2.17) is the only proof of the claim race and
  of the real cascade; 9.5 lists it as optional.
- The migration `0011` number collision with the unmerged `escalation` change is
  unchanged (see batch 2, 2.2).

### Remaining tasks

Phase 9 (owner-run, 9.1-9.6) and phase 10 (10.1 verify, 10.2 spec sync, 10.3
roadmap, 10.4 archive, 10.5 merge). Next SDD phase: `sdd-verify`.

### Workload / PR boundary

- Mode: `size:exception`, single PR from `feat/document-extraction`
- Current work unit: `phase8-integration+spec-reconcile`, committed as one unit
- Estimated review budget impact: three small tests (about 55 lines) plus
  documentation rewrites; the authored-line total of the branch stays about 8,900
