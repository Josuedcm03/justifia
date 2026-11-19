```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:b44f65e4046b0740d0f7fd58177f51bc1953f8b0fed3da271345ece283085467
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 14/14
scenarios: 27/27
test_command: DATABASE_URL=postgres://u:p@127.0.0.1:9/x npx vitest run
test_exit_code: 0
test_output_hash: sha256:bc395f533c905784665a787f19057020eeff41f6995c691c4eaad7ba613c99cb
build_command: DATABASE_URL=postgres://u:p@127.0.0.1:9/x npm run typecheck
build_exit_code: 0
build_output_hash: sha256:67d1fc6f094cf715091e7d1a2d3052f1850098c09943bd7fa81afbe386e92a94
```

> **Envelope note.** `evidence_revision` is the sha256 of `git diff bf91506..HEAD` (the whole change at HEAD 8c6161a). `test_output_hash` is the sha256 of the console log of the full vitest run (the run wrote its JSON report to a scratch file). `build_output_hash` is the sha256 of the `npm run typecheck` output (identical to the PR 1 report because the output is the two npm banner lines). Counts are completed/total over the whole change: 12 requirements `DR-1..DR-12` plus the two audit-log requirements (one ADDED, one MODIFIED) make 14; 19 data-retention scenarios plus 8 audit-log scenarios make 27. The RNF-04 integration run is the owner's recorded run (Phase 12), used as runtime evidence and NOT re-run here.

## Verification Report

**Change**: data-retention (whole change: PR 1 merged as #88 at 7533b98, plus PR 2)
**Branch / HEAD**: `feat/data-retention-2` @ 8c6161a. PR 2 is diffed against 7533b98 (origin/main), the whole change against bf91506. The local `main` ref was not used.
**Version**: N/A
**Mode**: Strict TDD (`openspec/config.yaml` `strict_tdd: true`, vitest runner)
**Relation to PR 1**: `verify-report-pr1.md` stays as the PR 1 record (PASS WITH WARNINGS). Its W1 and W2 are closed here (see Issues).

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total (`tasks.md`) | 71 |
| Complete | 63 (Phases 0-12, all checked) |
| Open | 8: 13.1-13.4 (PR 2 delivery) and 14.1-14.4 (archive-time) |

The eight open tasks cannot be completed before this verification: 13.3 is the merge gate that consumes this report, 13.4 is a post-deploy production dry run, and Phase 14 is written in the archive commit (the requester excluded it). Under a strict reading of the skill, unchecked tasks are CRITICAL; they are recorded as a WARNING because they are process gates after verify, not unfinished implementation (see W1). Every implementation task, every owner-run database step (6.2, 6.3, 6.6, 12.1-12.5) and both size checkpoints are marked done with evidence in `apply-progress.md`.

### Build and Tests Execution

**Typecheck** (`npm run typecheck`, dummy DB, exit 0): 0 errors. No `npm run build`, as instructed.

**Focused run** (dummy DB `postgres://u:p@127.0.0.1:9/x`, exit 0):
`npx vitest run src/app/api/cron/retention src/lib/data/retention-inventory.test.ts src/lib/data/retention.test.ts "src/app/(auth)/login" src/lib/intake/vercel-config.test.ts src/app/route-coverage.test.ts src/app/access-matrix.routes.test.ts`
Result: 8 files, 225 tests passed, 0 failed, 0 skipped (4.8 s). Per file in the full run: route test 20, inventory 15, data module 15, login actions 10, login page (same folder), vercel-config 5, route-coverage 86, access-matrix routes 56 (8 routes x 7 identities).

**Full run** (`npm test` is `vitest run`, same dummy DB, exit 0): 355 files, 8430 tests passed, 0 failed, 0 skipped, 0 todo (about 228 s). It matches apply-progress task 11.2 exactly (355 files, 8430 tests). `retention.integration.test.ts` is NOT collected by the default run (`vitest.config.mts` excludes `src/**/*.integration.test.ts`; the JSON report lists no integration file).

**Integration file in skip mode** (`vitest run --config vitest.integration.config.mts src/lib/data/integration/retention.integration.test.ts` with `INTEGRATION_DATABASE_URL` and `INTEGRATION_ALLOW_WRITES` unset, so the setup file points `DATABASE_URL` at an unroutable placeholder): 1 file skipped, 9 tests skipped, exit 0. No connection was attempted.

**Runtime evidence not re-run (owner-run, recorded)**: `apply-progress.md` Phase 12: 9 of 9 passed on commit 653d761 at 2026-11-19 13:33:57 Managua on the disposable Neon branch "retention-it" (child of "dev-arnia", migration 0014 applied); the revert-only mutation check (enrollment clause removed) made the dry run report due 2 and aborted the suite before the real run, exit 1, nobody cancelled; the rerun after `git restore` passed 9 of 9; the branch was deleted. `git diff --name-only 653d761..HEAD` touches only `openspec/` and `.engram/`, so the code that ran is the code at HEAD.

**Lint/format**: not re-run here; apply-progress records `eslint` (only the known CRLF noise) and `prettier --check --end-of-line auto` clean per unit. **Coverage**: no provider installed, skipped, not a failure.

No database was contacted, no push, no migrate, no build.

### Spec Compliance Matrix

Test names are `describe > it` titles or file paths at HEAD. "IT" is the recorded owner-run integration run (runtime evidence, not re-run).

| Requirement | Scenario | Covering tests (passed here unless marked IT) | Result |
|-------------|----------|------|--------|
| DR-1 Due rule | Boundary (table-driven) | `src/lib/retention/policy.test.ts > retentionCutoff (DR-1)` (4 table rows, exact 5 years, 1 ms and 1 day less, Feb 29 clamp, day of month kept); `src/lib/data/retention-inventory.test.ts > the due rule as built > binds the student role and the cutoff five years before now`; IT (aged student due) | COMPLIANT |
| DR-1 | Recent request moves the anchor | `retention-inventory.test.ts > the due rule as built > requires no request presented or resubmitted after the cutoff` (pins `greatest(PresentadaEn, ReenviadaEn) > $3::timestamptz`; mutations IM5 and IM6 killed); IT fixture B (account aged six years, request two years ago, byte-equal before and after, not cancelled) | COMPLIANT |
| DR-2 Exclusions | Enrolled student | `src/lib/data/retention.test.ts > builds a due rule that excludes students with an active enrollment (DR-2)`, `> skips a student whose guarded update matches no row: no other write, no audit row`; IT fixture C untouched; IT mutation check (clause removed: due 2, suite aborted) | COMPLIANT |
| DR-2 | Staff and cancelled accounts | `retention-inventory.test.ts > requires the student role only` (role subselect, IM7 killed) and `> requires accounts not yet cancelled` (IM4 killed); IT second run (due 0, nobody re-processed) | COMPLIANT (see S2: no aged staff account at runtime) |
| DR-3 Account cancellation | Account anonymized | `retention.test.ts > anonymizes the account and redacts the snapshots and free text (DR-3, DR-4)`; `src/app/(auth)/login/actions.test.ts > loginAction on retention accounts (DR-3) > turns %s away as invalid and opens no session` (2 cases) and `> keeps the hash of %s out of reach of any password` (2 cases); IT `anonymizes the account in place (DR-3)` | COMPLIANT |
| DR-4 Requests, text, documents | Requests and documents | `retention.test.ts` (same test: exact column sets, statement order including the `DocumentoRespaldo` delete); `retention-inventory.test.ts > column inventory of the tables retention touches (DR-4, DR-5)` (7 cases); IT `redacts the snapshots and the free text and keeps the residue (DR-4, DR-5)` and `deletes the documents, the extraction row and the stored file (DR-4, DR-7)` (real CHECKs, real cascade) | COMPLIANT |
| DR-5 Residue kept | Residue intact | inventory test (every column classified once as rewritten, kept or deleted; IM1 killed); IT before/after row equality with only the redacted columns changed | COMPLIANT |
| DR-6 One transaction, one audit row | Success | `retention.test.ts > writes every table inside the transaction, then one audit row on its handle`, `> writes one audit row per student with the system actor id`; `src/lib/audit/events.test.ts` account cancelled event (3 cases); `retention-inventory.test.ts > the audit row of a cancellation (DR-6)` (IM12 killed); IT `writes exactly one audit row, by the system account, without personal data (DR-6)` | COMPLIANT |
| DR-6 | One failure does not stop the run | `retention.test.ts > rolls back a failing student, counts it and carries on (DR-6)` | COMPLIANT (unit, scripted double) |
| DR-7 Blob deletion after commit | Blob delete fails | `retention.test.ts > counts a failed file delete and leaves the student cancelled` | COMPLIANT |
| DR-7 | Rollback keeps files | `retention.test.ts > keeps the files of a student whose transaction fails at the audit row`, `> deletes the files only after the audit row, never before` | COMPLIANT |
| DR-8 Idempotence and batching | Second run | `retention.test.ts > a second run with the same now finds nothing due and writes no audit row (DR-8)`; IT `cancels nobody on a second run and adds no audit row (DR-8)` (real database) | COMPLIANT |
| DR-8 | Over the batch bound | `retention.test.ts > pins the batch size and the batch count, and stops after the last full batch`; `retention-inventory.test.ts > keyset batching on the account id (D5)` (ascending id order, resume after the last id; IM8, IM10, IM11 killed); the `CanceladoEn IS NULL` pin; IT second run | COMPLIANT (composed, see S3) |
| DR-9 Dry run | Dry run | `retention.test.ts > counts the due students and issues only reads`; `route.test.ts > forwards ?dry=1 as a dry run`, `> treats %s as a real run: only dry=1 asks for a dry run` (3 cases); IT `counts the aged student on a dry run and changes nothing (DR-9)` | COMPLIANT |
| DR-10 Scheduled route | Identity matrix | `src/app/access-matrix.routes.test.ts` (row `api/cron/retention/route.ts`, 7 identities, 401 "unauthorized", with `@/db` and `@/lib/intake/deps` as tripwires so any data call throws `PAST_GUARD`); `src/app/api/cron/retention/route.test.ts > rejects %s and cancels nothing` (7 bad bearers), `> fails closed when the secret is not configured`, `> does not run a dry run for a caller without the bearer`; `src/app/route-coverage.test.ts` (route has its test and its matrix row) | COMPLIANT |
| DR-10 | Scheduler call | `route.test.ts > runs once with the clock, the real store and a real (not dry) run`, `> returns counts only, with no ids, names or text`, `> logs one structured line with counts only`; IT `cancels the aged student through the route` | COMPLIANT |
| DR-11 Daily schedule | Config pinned | `src/lib/intake/vercel-config.test.ts > runs data retention daily at 11:00 UTC (05:00 Managua, DR-11)` and `> registers exactly the three scheduled jobs, each once` | COMPLIANT |
| DR-12 RNF-04 evidence test | End to end | IT (9 of 9, 653d761): enters through `GET /api/cron/retention` with the bearer; aged student cancelled, documents gone, one audit row without personal data; younger and enrolled untouched. Skip mode here: 9 skipped, not collected by `npm test` | COMPLIANT (recorded run) |
| DR-12 | Second run and immutability | IT `cancels nobody on a second run and adds no audit row (DR-8)` and `rejects an UPDATE on the audit table with insufficient_privilege (42501)` | COMPLIANT (recorded run) |
| Audit: Closed set of retention events | Action to entity type | `src/lib/audit/events.test.ts > maps to usuario.cancelado on the student`; `src/lib/audit/types.test.ts` (closed list); IT audit row (action, entity type `Usuario`, entity id the student) | COMPLIANT |
| Audit: Closed set | Payload has counts and a code | `events.test.ts` (exact keys, smuggled personal fields dropped); the inventory payload test; IT deep-equals `{motivo, solicitudes: 2, documentos: 1}` and the serialized row holds no name, CIF or email | COMPLIANT |
| Audit: Closed set | Existing events unchanged | `types.test.ts` plus every pre-existing audit test, unchanged and passing in the full run | COMPLIANT |
| Audit: Audit record content (MODIFIED) | Record carries all fields | pre-existing audit tests, passing in the full run | COMPLIANT |
| Audit: Audit record content | Actor comes from the session | pre-existing, passing | COMPLIANT |
| Audit: Audit record content | Structured summary is machine-readable | pre-existing, passing | COMPLIANT |
| Audit: Audit record content | Retention rows carry the system actor | `retention.test.ts > writes one audit row per student with the system actor id`; IT (actor equals the sentinel looked up by login) | COMPLIANT |
| Audit: Audit record content | System actor is not usable | the login tests above (sentinel turned away, a verifier that accepts everything is never called, real bcrypt rejects `SYSTEM_HASH` and `CANCELLED_HASH`); `retention.test.ts > lets only the retention module and the policy name the system account` (no other writer) | COMPLIANT |

**Compliance summary**: 27/27 scenarios COMPLIANT, 14/14 requirements fully compliant, 0 FAILING, 0 UNTESTED, 0 PARTIAL. The 8 PARTIAL and 7 DEFERRED rows of the PR 1 report are closed by PR 2: the route, the schedule, the matrix row, the column inventory, the SQL-shape pins and the login cases, plus the recorded integration run.

### Correctness (Static Evidence)

| Item | Status | Notes |
|------|--------|-------|
| Scheduler auth fails closed | Implemented | `src/app/api/cron/retention/route.ts:17-22` calls `isScheduler(request, env.CRON_SECRET)` (`src/app/api/cron/scheduler-auth.ts`): false when the secret is unset or empty, then it compares the sha256 digests of the header and `Bearer ${secret}` with `timingSafeEqual` (constant time, equal lengths). The check precedes the URL read and any data call. |
| 401 for every identity, no data read | Implemented | The route never reads a session, so every identity gets the same 401 `{error:"unauthorized"}`. The matrix row (`src/test/access/matrix-table.ts:122-129`) has the same scheduler-only shape as `intake-sweep` and `remission-retry`; the harness trips on any `@/db` or deps access. |
| `no-store` on every response | Implemented (wording, S1) | 401, 200 and 500 all use `NO_STORE` = `"private, no-store"`. The spec text says `Cache-Control: no-store`; the shared constant contains it and is what the sibling cron routes send. |
| Counts-only JSON | Implemented | The body is exactly `RetentionCounts` (`dryRun, due, cancelled, documentsDeleted, blobsDeleted, failures`); a test pins the six keys. The log line is `JSON.stringify({event:"retention.run", ...counts})`, counts only. |
| Only `?dry=1` is a dry run | Implemented | `route.ts:25` is `searchParams.get("dry") === "1"`; `?dry=0`, `?dry=` and `?other=1` stay real runs, pinned by three cases (a `has("dry")` shortcut would fail). |
| Errors return 500 without detail | Implemented | The `catch` returns `{error:"retention_failed"}` with status 500 and `NO_STORE`; the test throws an error whose message holds a connection string and asserts the body is generic. Nothing is logged on that path (S4). |
| Next 16 conventions | Implemented, no drift | `node_modules/next` is 16.3.4. `route-segment-config/maxDuration.md` documents `export const maxDuration = <number>` as a platform hint; the route exports the literal `300` (Next reads it statically, so no import). No `dynamic` export: `route.md` history records that the default caching for GET handlers changed from static to dynamic in v15, and `dynamic` is removed under Cache Components. The handler is `GET(request: Request)` using `new URL(request.url)`; a test asserts the module exports only `GET` and `maxDuration`. |
| `vercel.json` | Implemented | Exactly three crons: intake-sweep `0 9 * * *`, remission-retry `0 10 * * *`, retention `0 11 * * *`, in that order; the existing jobs are unchanged (the diff is one added line and a trailing comma). |
| Matrix row scheduler-only | Implemented | `row([], {anonymous, flagged, role: unauthorized})`: no identity admitted. The routes matrix went from 49 to 56 cases. |
| Integration test safety | Implemented | Write gate: the file throws at import when the gate says `refuse` and runs only when the gate mode is `run` (`describe.skipIf`); `resolveIntegrationGate` (unit-tested by `guard.test.ts`, green) refuses unless `INTEGRATION_ALLOW_WRITES` equals 1, checks the production endpoint id first, and the setup file re-checks the final `DATABASE_URL`. Production refusal: `isProductionEndpoint` plus a "prod" name heuristic. Dry-run guard: `beforeAll` calls `?dry=1` and throws unless it answers 200 with `due` equal to 1 before any real call (the mutation run proved it aborts with nobody cancelled). Cleanup: `afterAll` deletes its own `inscripcion` rows then calls `fixtures.cleanup()`, which deletes by ids it tracked (never by pattern), so only the rows of this run go; the audit row and the sentinel stay by design (append-only table, no FK on `EntidadId`). `now` is never shifted: the route uses `new Date()` and fixtures age timestamps with one UPDATE per request and one for `Usuario.CreadoEn`. The blob store is `createFakeDocumentStore` behind `vi.mock("@/lib/intake/deps")`, so no real file is touched. |
| PR 2 touches no PR 1 production code | Implemented | `git diff 7533b98..HEAD --stat` shows no change in `src/lib/data/retention.ts`, `src/lib/retention/policy.ts`, `src/lib/audit/*`, `src/db/*` or `drizzle/`. The mutation checks left no residue (`git status` clean, no stray edit in the diff). |
| Migration, data module, carve-outs, audit event | Implemented | As verified in `verify-report-pr1.md`; unchanged since 7533b98. |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| D1-D5, D7, D8, D10 (actor, lookup, redact, guarded UPDATE, keyset 50 x 10, CHECK, partitions 2031-2035, UTC cutoff) | Yes | Verified in PR 1; the PR 2 SQL-shape pins now hold D4 and D5 against regression. |
| D6 no partial indexes, D9 listings unchanged | Yes | No index or listing SQL in the diff. The backlog entry for hiding system accounts is Phase 14.3. |
| Route shape (literal `maxDuration` 300, no `dynamic`, `new URL`, `NO_STORE`, 401 `unauthorized` / 500 `retention_failed`) | Yes | Matches the design paragraph line for line. |
| Tests copied from `intake-sweep` (7 bad bearers, unset secret, GET-only, `dry` forwarded, counts only, one log line, generic 500) | Yes | 20 cases, a superset of the design list. |
| Integration design (hoisted holder, `vi.mock` deps, fixtures A/B/C, dry-run guard, steps 1-4, cleanup) | Yes | Step 4 reads SQLSTATE 42501 through `cause`. |
| Slicing and size | Yes, with the owner exception | PR 2 measures 1137 changed lines (1133 added, 4 deleted) against 7533b98 excluding `openspec/` and `.engram/`, re-measured here with `git diff --numstat`. The checkpoint recorded 1138; fix commit 653d761 removed one line. Both are over the 1000 budget and within the granted exception (precedents 1204 and 1220). The whole change is 2341 changed lines against bf91506 (PR 1 at 1204 plus PR 2 at 1137), with the generated snapshot (2343 lines) excluded and reported separately. |
| Order deviation, option A cut | Yes | Recorded in `tasks.md` and `apply-progress.md`. |

### TDD Compliance

| Check | Result | Details |
|-------|--------|---------|
| TDD evidence reported | PASS | `apply-progress.md` carries per-unit RED/GREEN tables, a mutation table and a Work Unit Evidence block for units 6 to 9, and the Phase 12 run. The format differs from the template single table but holds the same fields. |
| RED confirmed | PASS | Unit 6: the route test suite failed to load (route missing), then `route-coverage` failed with the missing matrix row. Unit 7: 2 failed, 3 passed before `vercel.json` changed. Unit 8 tests are declared pass-at-write (they pin PR 1 behavior) and carry mutations instead. |
| GREEN confirmed | PASS | Every file passes in the focused and full runs above. |
| Pass-at-write tests carry revert-only mutation checks | PASS | IM1-IM13 (inventory, SQL shape, W2 clauses) and LM1-LM3 (login) each killed and restored with `git restore`; the IT mutation check (12.4) killed. |
| Triangulation | PASS | Seven bad bearers, three non-dry query shapes, four W2 clause cases, two accounts times two login assertions. |
| Safety net | PASS | Route-coverage and matrix tests were green before the edit; `retention.test.ts` (15) and login actions (6) were green before unit 8. |

**Test layer distribution (PR 2)**: unit 48 new tests (8382 to 8430 in the full run) across the route test, inventory test, login cases, vercel-config and matrix row; integration 9 tests in 1 owner-run file (skipped by default); no E2E. Tool: vitest 5.0.0; a Neon branch for the integration layer.

### Assertion Quality

Scanned `route.test.ts`, `retention-inventory.test.ts`, `retention.integration.test.ts`, the login additions and the config and matrix edits. No tautologies, no orphan empty checks without a companion, no ghost loops (the audit `not.toContain` loop runs over three non-empty values, so it cannot pass vacuously; the other loops iterate constants), no assertion that skips production code, and mock use is proportionate (`route.test.ts` has 3 `vi.mock` against about 40 assertions). Two items are SUGGESTION-level (S5, S6).

**Assertion quality**: 0 CRITICAL, 0 WARNING (2 SUGGESTION).

### Issues Found

**CRITICAL**: None.

**WARNING**:
- W1. Tasks 13.1-13.4 (PR 2 delivery) and 14.1-14.4 (archive-time) are open. They are post-verify gates, not implementation, but the strict skill rule treats unchecked tasks as CRITICAL, so the orchestrator should proceed knowing 13.x remains. `openspec/changes/data-retention/tasks.md:190-191`: tasks 13.1 and 13.2 are stale (PR 1 merged, so the base of PR 2 is "main", not "feat/data-retention", and the retarget in 13.2 is moot); the PR body must say "PR 2 of 2, base main" and carry the 12.3 outcome. Task 13.4 (production dry run, must answer 200 with due 0) is the only proof that the actor lookup works in production.
- W2. Operational sequencing (`tasks.md:192-193`): merging PR 2 deploys and registers the cron, and the next 11:00 UTC firing performs a REAL, irreversible run. Task 13.4 must therefore run, with `?dry=1`, before that firing, and that firing is the first time the route executes against production data. The sentinel and partitions are already live in production (6.6). If the owner merges close to 11:00 UTC, run 13.4 first or hold the merge. No code change is needed.

**SUGGESTION**:
- S1. `src/app/api/cron/retention/route.ts:20,30,36` and `src/app/api/cron/scheduler-auth.ts` (`NO_STORE`): the header is `private, no-store`, while `specs/data-retention/spec.md` DR-10 words it `Cache-Control: no-store`. Behavior is equal or stricter and matches the sibling cron routes; align the spec wording at archive instead of changing code.
- S2. DR-2 "Staff and cancelled accounts": the role subselect and `CanceladoEn IS NULL` are pinned by SQL-shape tests with killed mutations, but no real-database case ages a staff account, because the integration fixtures create staff now. A staff fixture with `CreadoEn` six years back would add runtime proof. Not required: the guard is a pinned role clause.
- S3. DR-8 "Over the batch bound" has no test that drains more than one run worth of students; exactly-once rests on the keyset reset per run plus the `CanceladoEn IS NULL` exclusion, both pinned, and on the unit-tested 50 x 10 bound. Acceptable for the current volume.
- S4. `src/app/api/cron/retention/route.ts:34-39`: the `catch` swallows the error without any log (the generic 500 body is intentional and leaks nothing). A failure such as a missing system actor then leaves only the 500 status in the platform logs. Logging a closed error code (never the message) would help the owner, consistent with S1 of the PR 1 report (the data module also logs nothing per failing student; an id is not personal data). The sibling cron routes behave the same, so this is convention, not regression.
- S5. `src/lib/data/integration/retention.integration.test.ts:416-418` repeats the assertion already made at lines 397-399 (`after.decisions` equals the redacted `before.decisions`); the trailing copy can go.
- S6. The integration `it` blocks are order-dependent (the real run happens in the second test and later tests read its result). This is the shape of the sibling suites and is safe under `fileParallelism: false`; noted so nobody reorders them.
- S7. `.engram/chunks/9eac67a2.jsonl.gz` and `.engram/manifest.json` are committed inside docs commit 6d178da, the same pattern as PR 1 (S3 of the PR 1 report); `tasks.md` says not to stage `.engram/` unless the owner directs. No action unless the owner wants them out of the PR diff.
- S8. `apply-progress.md` unit 8 still says the integration test was never executed and carries an "Integration test design" risk note; Phase 12 supersedes it. No edit is required, but a reader should take Phase 12 as the final status.

**Closed from the PR 1 report**: W1 (login rejection test) is closed by the four login cases; W2 (due-predicate pins) is closed by the clause cases and mutations IM2-IM13; W3 (merge-gate process) was completed for PR 1 (6.2-6.7); S2 (brittle exact SQL string) remains as an accepted pin.

### Other checks

- Commit messages: `git log 7533b98..HEAD --format=%B` lists 10 commits, all Conventional Commits, no body, no `Co-Authored-By`, no "Generated with", no AI attribution (a search for those terms and for the assistant and vendor names returned nothing). The same search over `bf91506..HEAD` (23 commits) is also empty.
- Diff scope (PR 2): 14 files, none outside `src/`, `openspec/`, `.engram/`, `modelo_datos_sql.md`, `vercel.json` and `vitest.integration.setup.ts`; no `package-lock.json`, no migration, no schema change, no PR 1 production file.
- Documentation: `modelo_datos_sql.md` note 13 and the partition comment now say 2026..2035 and require the 2036 partition before 2036 begins (D8).
- No database was contacted: dummy URL only; the integration file ran in skip mode only.

### Archive readiness (whole change)

Implementation is complete and verified: 27 of 27 scenarios and 14 of 14 requirements have passing covering tests, with the RNF-04 runtime proof taken from the recorded owner run on a disposable branch (9 of 9 on the code that is at HEAD). Remaining before archive, in order: 13.1 push and PR 2 against main, 13.3 owner OK and merge (deploys and registers the cron), 13.4 production dry run answering 200 with due 0 before the next 11:00 UTC firing (W2), then the archive commit with Phase 14 (roadmap row 17 and the RNF-04 note, spec sync of `data-retention` and the audit-log delta rebased on main at archive time, follow-ups, and the thesis flag for Anexo F and section 4.9). The change is not yet archivable until PR 2 is merged and 13.4 is recorded.

### Verdict

PASS WITH WARNINGS

The whole change matches the specs and design: 355 files and 8430 tests green, typecheck clean, the route fails closed with counts-only no-store responses, the schedule and matrix row are exactly as specified, and the integration test is gated, self-cleaning and was run green on a disposable branch. There is no CRITICAL issue; the two warnings are the open PR 2 delivery tasks (13.x) and the irreversible first scheduled run (W2), not code defects.
