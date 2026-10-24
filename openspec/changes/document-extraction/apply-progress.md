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
