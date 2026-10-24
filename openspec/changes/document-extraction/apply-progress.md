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
