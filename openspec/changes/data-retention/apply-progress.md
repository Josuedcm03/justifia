# Apply progress: data-retention

## Unit 0: owner decisions

- 0.1 (2026-11-19): the owner chose option A. The SQL-shape cases of `src/lib/data/retention.test.ts` move to PR 2, and the generated snapshot `drizzle/meta/0014_snapshot.json` is excluded from the 1000-line count. Every checkpoint still reports the snapshot separately.
- 0.2 (2026-11-18): (a) DR-4 no longer lists "SolicitudRevision free text" (the table holds no names or free text), and the snapshot rule now reads as the redact rule (a non-NULL value becomes the placeholder, NULL stays NULL). (b) `EstudianteCarrera` is redacted, not kept as residue. Reports still read the program from the live `Usuario` row.

## Unit 0 (continued)

- 0.3 (2026-11-19): baseline confirmed. Branch "feat/data-retention" sits on origin/main bf91506 (HEAD 8544bcc is the docs commit). The local ref "main" in this repository is stale (b82b359, ten commits behind), so every diff in this change is measured against bf91506 (origin/main), not the local "main" ref. Baseline run "npm test -- src/lib/data src/db src/lib/audit src/lib/intake" with the dummy DB: 106 files, 2054 tests, all passed (57.5 s).
- 0.4 (2026-11-19): committed earlier as 8544bcc ("docs(data-retention): add the SDD planning documents").

## Unit 1: cutoff policy (DR-1, DR-3, DR-6)

Mode: Strict TDD. Layer: unit (pure functions). Safety net: N/A (new files).

| Task | RED evidence | GREEN evidence |
|------|--------------|----------------|
| 1.1 | "npm test -- src/lib/retention": suite failed to load, "Failed to resolve import "./policy" from "src/lib/retention/policy.test.ts". Does the file exist?" (0 tests) | n/a |
| 1.2 | With a naive first version of retentionCutoff (plain year minus 5, no clamp): 10 passed, 1 failed, "retentionCutoff (DR-1) > clamps a missing Feb 29 cutoff to Feb 28 at the same time of day: expected 2027-03-01T09:00:00.000Z to deeply equal 2027-02-28T09:00:00.000Z" | n/a |
| 1.3 | n/a | clamp added: 11 of 11 passed in `src/lib/retention/policy.test.ts` |
| 1.4 | n/a | gates: focused vitest 11/11; "npm run typecheck" clean; "npx eslint src/lib/retention" clean; "npx prettier --check src/lib/retention --end-of-line auto" clean |

Triangulation: four DR-1 boundary rows, exact 5 years, 1 ms less, 1 day less, the clamp, and two rows where the cutoff date exists. Refactor: none needed (the day-exists probe is the minimum code).

Work Unit Evidence:

| Evidence | Value |
|---|---|
| Focused test command and exact result | "npm test -- src/lib/retention" with the dummy DB: 1 file, 11 tests passed |
| Runtime harness | N/A: pure functions, no runtime boundary |
| Rollback boundary | Revert `src/lib/retention/` |

Commit: "feat(retention): add the five-year cutoff policy".

## Unit 2: migration 0014 and schema (DR-2, DR-3, DR-6, D1, D3, D7, D8)

Mode: Strict TDD. Layer: unit (static migration text). Safety net: "npm test -- src/db" before touching `src/db/schema.ts`: covered by the unit 0 baseline (106 files, 2054 tests green, which includes `src/db`).

| Task | RED evidence | GREEN evidence |
|------|--------------|----------------|
| 2.1 | "npm test -- src/db/migration-data-retention.test.ts": 9 failed of 9. "is registered once in the journal, later than the last applied migration: expected [] to have a length of 1 but got +0" and the other eight fail on "expected [] to have a length of 1 but got +0" (migration located by name, missing) | n/a |
| 2.2 | n/a | `src/db/schema.ts`: Usuario.canceladoEn, Solicitud.canceladaEn (nullable timestamptz, no default) and the CK_Usuario_Cancelado check with the sibling check pattern |
| 2.3 | n/a | "npx drizzle-kit generate --name data_retention" with the dummy DATABASE_URL (no connection): wrote `drizzle/0014_data_retention.sql`, the journal entry (idx 14, when 1795111590732, later than 1793660241921) and `drizzle/meta/0014_snapshot.json` (2342 lines, generated, untouched). Generated statements: 2 ADD COLUMN and the CHECK (drizzle emitted the check, so no hand-appended CHECK) |
| 2.4 | n/a | hand-appended: the sentinel INSERT, then per year 2031 to 2035 the partition, its truncate trigger and its REVOKE; every statement after a breakpoint marker; the partition comment is attached to the first partition statement so no breakpoint chunk is comment-only |
| 2.5 | n/a | "npm test -- src/db": 17 files, 232 tests passed (includes `src/db/schema.test.ts`; no pin needed adjusting); migration test 9 of 9 |
| 2.6 | n/a | gates: "npm run typecheck" clean after one fix (below); "npx eslint" clean (CRLF noise filtered); "npx prettier --check --end-of-line auto" clean |

Unplanned edit (deviation): the new `Usuario.CanceladoEn` column made "npm run typecheck" fail in `src/lib/data/users.ts` (4 errors, property canceladoEn missing from `UsuarioConRol` in the projections). Smallest fix: `UsuarioConRol` is now `Omit<Usuario, "rolId" | "canceladoEn">` with a comment, so no SQL projection or pinned query changed. After the fix: "npm test -- src/db src/lib/data/users": 20 files, 337 tests passed.

Work Unit Evidence:

| Evidence | Value |
|---|---|
| Focused test command and exact result | "npm test -- src/db" with the dummy DB: 17 files, 232 tests passed |
| Runtime harness | Owner-run: disposable Neon branch rehearsal (tasks 6.2-6.3). Nothing was applied to any database here |
| Rollback boundary | Revert `drizzle/0014_data_retention.sql`, its journal entry and snapshot, `src/db/schema.ts`, the test and the `UsuarioConRol` type edit |

Commit: "feat(db): add retention markers, system account and 2031-2035 audit partitions".

## Unit 3: audit event "usuario.cancelado" (audit-log "Closed set of retention events", DR-6)

Mode: Strict TDD. Layer: unit (pure builder). Safety net: "npm test -- src/lib/audit": 3 files, 119 tests passed before the edits (the 123 after the new cases is 119 plus 4 new or changed).

| Task | RED evidence | GREEN evidence |
|------|--------------|----------------|
| 3.1 | "npm test -- src/lib/audit": `src/lib/audit/types.test.ts` "AUDIT_ACTIONS > keeps the existing codes unchanged and adds exactly the ... and one retention one: expected [ 'asignatura.actualizada', ...(42) ] to deeply equal [ 'asignatura.actualizada', ...(43) ]" | `src/lib/audit/types.ts`: the action, the payload type and the union member (entity "Usuario"); list test green |
| 3.2 | same run, three failures in `src/lib/audit/events.test.ts` "account cancelled event": "TypeError: accountCancelledEvent is not a function" (maps to usuario.cancelado on the student; carries exactly the closed code and the two counts; drops a name, email, CIF, free text or request ids smuggled into the call). Total 4 failed, 119 passed | n/a |
| 3.3 | n/a | `src/lib/audit/events.ts`: accountCancelledEvent copies the three fields by name and takes the code from RETENTION_REASON. "npm test -- src/lib/audit": 3 files, 123 tests passed |
| 3.4 | n/a (comment only) | `src/lib/data/audit.ts` doc comment of insertAuditEvents: "or the system account, retention only"; no signature change |
| 3.5 | n/a | gates: "npm test -- src/lib/audit src/lib/data/audit.test.ts": 4 files, 130 tests passed; "npm run typecheck" clean; "npx eslint" clean (CRLF noise filtered); "npx prettier --check --end-of-line auto" clean |

Triangulation: the payload is asserted for two different students and counts (2 and 3, then 0 and 0), plus a smuggling case with six extra fields. Refactor: none needed.

Deviation (type fallout): a second audit event on entity type "Usuario" stopped `entidadTipo !== "Usuario"` from narrowing the payload, so "npm run typecheck" reported 8 errors in `src/lib/audit/events.test.ts` (campos and importacionSha256 missing on the union). The four existing narrowing guards now test `accion` ("usuario.creado" or "usuario.actualizado") instead of `entidadTipo`. Test-only edit, no assertion changed.

Work Unit Evidence:

| Evidence | Value |
|---|---|
| Focused test command and exact result | "npm test -- src/lib/audit" with the dummy DB: 3 files, 123 tests passed |
| Runtime harness | N/A: pure builder tests, no runtime boundary |
| Rollback boundary | Revert the two audit files, their tests and the comment in `src/lib/data/audit.ts` |

Commit: "feat(audit): add the usuario.cancelado event".

### Interim checkpoint 3.6 (after unit 3)

"git diff --numstat bf91506...HEAD" (bf91506 is origin/main; the local "main" ref is stale) excluding "openspec/", ".engram/" and `drizzle/meta/0014_snapshot.json`:

| File | Added | Deleted |
|------|-------|---------|
| `drizzle/0014_data_retention.sql` | 56 | 0 |
| `drizzle/meta/_journal.json` | 7 | 0 |
| `src/db/migration-data-retention.test.ts` | 171 | 0 |
| `src/db/schema.ts` | 11 | 0 |
| `src/lib/audit/events.test.ts` | 64 | 5 |
| `src/lib/audit/events.ts` | 22 | 0 |
| `src/lib/audit/types.test.ts` | 2 | 1 |
| `src/lib/audit/types.ts` | 18 | 0 |
| `src/lib/data/audit.ts` | 4 | 3 |
| `src/lib/data/users.ts` | 6 | 2 |
| `src/lib/retention/policy.test.ts` | 83 | 0 |
| `src/lib/retention/policy.ts` | 34 | 0 |
| Total | 478 | 11 |

Cumulative: 489 changed lines. Snapshot reported separately: `drizzle/meta/0014_snapshot.json` 2342 lines. The threshold of 520 is not exceeded (31 lines of margin), so apply continues with unit 4. Unit 4 plus unit 5 project at ~474 (file lines only: retention.ts ~210, retention.test.ts ~165 raw plus carve-outs ~30 raw plus RN-27 ~10), giving ~960 against the 1000 budget.

## Unit 4: data module and structural carve-outs (DR-1 to DR-9, audit-log "Audit record content")

Mode: Strict TDD. Layer: unit (transaction double, no database). Safety net: the three carve-out test files and the structural tests were green in the unit 0 baseline (106 files, 2054 tests).

| Task | RED evidence | GREEN evidence |
|------|--------------|----------------|
| 4.1 | "npm test -- src/lib/data/retention.test.ts": suite failed to load, "Cannot find module '/src/lib/data/retention' imported from src/lib/data/retention.test.ts" (0 tests). 12 behavior cases written: dry run reads only, missing actor throws (also on a dry run), full cancellation order and audit on the transaction handle, DR-3 and DR-4 written values, one audit row per student with the actor id, guarded zero-row skip, failing student rolled back while the others finish, second run, blobs after the audit row, audit failure keeps the files, failed file delete counted, bounded run (50 by 10) | n/a |
| 4.2 | same run (same file): two structural cases, only the retention module and the policy name the system account; the module names no extraction or fingerprint column and writes no enrollment | n/a |
| 4.3 | "npm test -- src/lib/data/append-only.test.ts src/lib/data/remision-writes.test.ts src/lib/data/escalamiento-writes.test.ts": 3 failed, 19 passed. "append-only: lets the retention module update exactly SolicitudDecision and ReporteInasistencia, never delete (DR-4)", "remision-writes: finds both allowed writers, so the pin is not vacuous", "escalamiento-writes: finds every allowed writer, so the pin is not vacuous", all with "ENOENT: no such file or directory, open src/lib/data/retention.ts" | n/a |
| 4.4, 4.5, 4.6 | n/a | `src/lib/data/retention.ts` written as one module (findSystemActor, the single due predicate, countDue, dueAfter, cancelStudent, runRetention). First run after writing: 36 of 36 passed in the four files. The three parts were not run separately: the tests above exercise them together, so part-by-part GREEN is not separately evidenced |
| 4.7 | n/a | "npm test -- src/lib/data/retention.test.ts src/lib/data/append-only.test.ts src/lib/data/remision-writes.test.ts src/lib/data/escalamiento-writes.test.ts": 4 files, 36 tests passed |
| 4.8 | pass at write: "npm test -- src/lib/data/extraction.test.ts src/lib/signals/fingerprint-exposure.test.ts src/lib/data/inscripcion-writes.test.ts": 3 files, 56 tests passed with no edit | Mutation check M1 (temporary, restored): a comment naming huellaSha256 appended to `src/lib/data/retention.ts` made "fingerprint-exposure: names the fingerprint only in the schema, the finalize path and the Q5 reader" fail (1 failed, 7 passed); restored |
| 4.9 | see the mutation table below | see the mutation table below |
| 4.10 | n/a | gates: "npm run typecheck" clean; "npx eslint" on the five files clean (CRLF noise filtered); "npx prettier --check --end-of-line auto" clean |

Mutation checks (each applied to the staged `src/lib/data/retention.ts` with "git restore" afterwards; "git status" showed no unstaged change before the commit):

| Id | Temporary edit | Result |
|----|----------------|--------|
| M1 | name huellaSha256 in a comment | fingerprint test fails (1 failed) |
| M2 | call store.delete inside the transaction, before the audit row | 3 failed: "deletes the files only after the audit row, never before", "keeps the files of a student whose transaction fails at the audit row", "counts a failed file delete and leaves the student cancelled" |
| M3 | drop the NOT EXISTS active-enrollment clause from the due predicate | SURVIVED: 14 of 14 passed. The scripted double never inspects the predicate, so no PR 1 test pins it. The clause is pinned by the SQL-shape cases moved to PR 2 (option A) and by integration fixture C with the revert-only check of task 12.4. Reported as a risk |
| M4 | add a delete of solicitudDecision to the module | append-only "lets the retention module update exactly SolicitudDecision and ReporteInasistencia, never delete (DR-4)" fails (the transaction cases fail too, on the unscripted statement) |
| M5 | drop the zero-row guard | 2 failed: "skips a student whose guarded update matches no row ..." and "pins the batch size and the batch count ..." |
| M6 | never stop on a short batch | 8 or more failed (every case that ends on a short batch hits an unscripted read) |
| M7 | MAX_BATCHES 11 | 1 failed: "pins the batch size and the batch count, and stops after the last full batch" |

Rendered SQL check (temporary scratch test, deleted, not committed): the due predicate renders as expected for the count, the keyset read and the guarded write: the role subselect on "Rol"."Codigo" = $1, "CanceladoEn" is null, "CreadoEn" <= $2, the two NOT EXISTS clauses with "greatest(...) > $3::timestamptz" (an ISO string with a cast, so no raw Date reaches the driver), and "Id" > $4 on the keyset read.

Deviations from the design: none in behavior or order of the writes (select documents before the redactions, delete after, one audit row last). Notes: (a) the module logs nothing, so a failing student is visible only as the failures count; (b) the redact helper casts the placeholder with "::text" so the CASE branch types are known to the server; (c) `RetentionCounts.failures` is one counter for both a rolled-back student and a failed file delete, as the interface in the design has no second counter.

Work Unit Evidence:

| Evidence | Value |
|---|---|
| Focused test command and exact result | "npm test -- src/lib/data/retention.test.ts src/lib/data/append-only.test.ts src/lib/data/remision-writes.test.ts src/lib/data/escalamiento-writes.test.ts" with the dummy DB: 4 files, 36 tests passed (14 in `src/lib/data/retention.test.ts`) |
| Runtime harness | N/A: transaction double; the real database runs only in PR 2 (integration, owner-run) |
| Rollback boundary | Revert `src/lib/data/retention.ts` and the carve-outs (`src/lib/data/append-only.test.ts`, `src/lib/data/remision-writes.test.ts`, `src/lib/data/escalamiento-writes.test.ts`) together with `src/lib/data/retention.test.ts` |

Size note: `src/lib/data/retention.test.ts` is 397 lines and `src/lib/data/retention.ts` 256 (design raw 165 and 210; weighed 215 and 210). The test is far over its estimate. See checkpoint 6.1.

Commit: "feat(data): cancel due students one transaction each".

## Unit 5: RN-27 (RN-27, DR-1)

Mode: documents only, structural readback (no behavior, no test).

- 5.1 (2026-11-19): `docs/requirements.md` gains RN-27 after RN-26, in the format of its neighbors (ID, rule, applies to RNF-04), column widths aligned. It states the subject (students), the anchor (the latest of the account creation and the newest presentation or resubmission), five calendar years, the exclusion of an active enrollment, and the meaning of cancellation (anonymization in place, documents deleted, one audit row, irreversible). Readback: "git diff --stat docs/requirements.md" shows 2 insertions and 0 deletions, and the file keeps its CRLF line endings.
- One addition beyond the task text: the change table of the same file ("Todo cambio se hace en los dos a la vez y se anota aquí") gets a row dated 2026-11-19 recording RN-27, the new count (18 RF, 14 RNF, 27 RN), the pending sync with the thesis matrix, and the legal-sufficiency limitation (Ley 787, arts. 19 f y 24) as an assumption. This follows the file's own convention; it is one line.

Work Unit Evidence:

| Evidence | Value |
|---|---|
| Focused test command and exact result | N/A: documents only |
| Runtime harness | N/A: no runtime boundary |
| Rollback boundary | Revert the RN-27 row and the change-table row in `docs/requirements.md` |

Commit: "docs(requirements): add RN-27".

## Checkpoint 6.1: PR 1 size after unit 5 (STOP: over the 1000-line budget)

"git diff --numstat bf91506...HEAD" (bf91506 is origin/main; the local "main" ref is stale) taken on the five unit commits plus the staged RN-27 row, excluding "openspec/", ".engram/" and `drizzle/meta/0014_snapshot.json`:

| File | Added | Deleted |
|------|-------|---------|
| `docs/requirements.md` | 2 | 0 |
| `drizzle/0014_data_retention.sql` | 56 | 0 |
| `drizzle/meta/_journal.json` | 7 | 0 |
| `src/db/migration-data-retention.test.ts` | 171 | 0 |
| `src/db/schema.ts` | 11 | 0 |
| `src/lib/audit/events.test.ts` | 64 | 5 |
| `src/lib/audit/events.ts` | 22 | 0 |
| `src/lib/audit/types.test.ts` | 2 | 1 |
| `src/lib/audit/types.ts` | 18 | 0 |
| `src/lib/data/append-only.test.ts` | 43 | 2 |
| `src/lib/data/audit.ts` | 4 | 3 |
| `src/lib/data/escalamiento-writes.test.ts` | 2 | 0 |
| `src/lib/data/remision-writes.test.ts` | 2 | 0 |
| `src/lib/data/retention.test.ts` | 397 | 0 |
| `src/lib/data/retention.ts` | 256 | 0 |
| `src/lib/data/users.ts` | 6 | 2 |
| `src/lib/retention/policy.test.ts` | 83 | 0 |
| `src/lib/retention/policy.ts` | 34 | 0 |
| Total | 1180 | 13 |

Total: 1193 changed lines, 193 over the 1000 budget (target was ~949). Snapshot, reported separately: `drizzle/meta/0014_snapshot.json` is 2343 added lines (generated, untouched, excluded). Per the checkpoint rule, apply STOPS here and reports to the owner; no test was trimmed and no exception was assumed.

Where the overage comes from, against the design's raw estimate:

| File | Design raw | Measured | Over |
|------|-----------|----------|------|
| `src/lib/data/retention.test.ts` | 165 (215 weighed) | 397 | +232 (+182 weighed) |
| `src/lib/data/retention.ts` | 210 | 256 | +46 |
| `src/db/migration-data-retention.test.ts` | 120 (156 weighed) | 171 | +15 |
| `src/lib/data/append-only.test.ts` and the two other carve-outs | 30 (39 weighed) | 49 | +10 |
| `src/lib/audit/events.test.ts` and `types.test.ts` | 40 (52 weighed) | 72 | +20 |
| `src/lib/data/users.ts` (unplanned type fix) | 0 | 8 | +8 |

`src/lib/data/retention.test.ts` is the driver: prettier expands each scripted-double call to one argument per line, and the file holds 12 behavior cases plus 2 structural cases. By content, the separable blocks of the file are: the structural describe (36 lines), the bounded-run case (23 lines, it builds 10 batches of 50) and the blobs-after-commit describe (50 lines, three cases). Moving all three to PR 2 would remove about 109 lines and leave PR 1 at about 1084, still over, so either a size exception or a deeper cut is needed. That cut would also drop the mutation-verified blob-ordering and system-account pin evidence from PR 1. The owner decides; nothing was moved.

## Task 6.4: full run for PR 1

"npm test" with the dummy DATABASE_URL, at commit 63a067a: 353 files, 8381 tests, all passed, no failure, wall time 4 min 1 s (vitest duration 239 s). The baseline of unit 0 covered a subset (106 files, 2054 tests); this run is the whole suite.

## Status at the end of this apply batch (PR 1)

Units 1 to 5 are implemented and committed: dde46a4, bddf278, acca573, 25215a9, 63a067a (unit 0 is 8544bcc). Tasks 6.2, 6.3, 6.5, 6.6 and 6.7 are not done (owner-run database steps, push and PR, merge gate). Task 6.1 found PR 1 over the 1000-line budget (1193), so apply stops for the owner's decision before 6.5 (push and PR).

## Follow-up (2026-11-19): size exception granted and the M3 pin

Owner decisions: the owner granted a size exception for PR 1 on 2026-11-19 (precedent: auth-route-tests, 1220 lines) and asked for one small test that kills the M3 survivor.

New test in `src/lib/data/retention.test.ts`: "builds a due rule that excludes students with an active enrollment (DR-2)". It runs a dry run against the scripted double and renders the where clause of the count read, which is the predicate exactly as `src/lib/data/retention.ts` built it from its drizzle chunks, then asserts it contains the NOT EXISTS clause on "Inscripcion" with the active flag.

- Pass at write: it pins already-built behavior, so there was no RED step. Run: "npm test -- src/lib/data/retention.test.ts": 1 file, 15 tests passed.
- Revert-only mutation check (temporary, restored with "git restore src/lib/data/retention.ts", "git status" showed only the staged test): dropping the NOT EXISTS enrollment clause from the due predicate made the new test fail ("builds a due rule that excludes students with an active enrollment (DR-2)", 1 failed, 14 passed). This closes the M3 survivor.
- Gates: "npm run typecheck" clean; "npx eslint" clean (CRLF noise filtered); "npx prettier --check --end-of-line auto" clean.

Re-measured total against bf91506, excluding "openspec/", ".engram/" and the snapshot: 1204 changed lines (1191 added, 13 deleted); `src/lib/data/retention.test.ts` is now 408 lines. Snapshot, separate: 2343 lines. Within the accepted exception (about 1205).

Commit: "test(data): pin the active-enrollment exclusion of the due rule".

## Phase 6 database steps (owner-run with explicit yes)

- 6.2 (2026-11-19 12:44 Managua, read-only): production has no user with login "sistema"; 14 migrations applied (0000-0013); no retention columns or 2031+ partitions yet.
- 6.3 (2026-11-19 12:49 Managua): disposable branch "retention-it" (child of "dev-arnia") created and 0014 applied there only. Read-only verification: sentinel inactive with an unusable 18-character hash; both marker columns nullable; partitions 2031-2035 attached with the same triggers as 2030 and no public TRUNCATE; "CK_Usuario_Cancelado" present. The branch stays for the RNF-04 integration run (Phase 12).

- 6.6 (2026-11-19 12:54 Managua, owner yes): 0014 applied to production; the read-only verification matches the disposable branch (15 migrations, sentinel inactive, marker columns, partitions 2031-2035, "CK_Usuario_Cancelado").

# PR 2 (branch "feat/data-retention-2", from origin/main 7533b98)

PR 1 merged as #88, so PR 2 is based on "main" directly (no stacking, no retarget). Every PR 2 diff is measured against 7533b98, excluding "openspec/" and ".engram/".

## Unit 6: retention route and matrix row (DR-9, DR-10, RNF-01)

Mode: Strict TDD. Layer: unit (route called as a function with a plain Request). Safety net: `src/app/route-coverage.test.ts` and `src/app/access-matrix.routes.test.ts` were green in the PR 1 full run.

Docs check (7.0): "node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/" lists "maxDuration" as a number set by the deployment platform, and "dynamic" is removed under Cache Components. The route therefore exports a literal "maxDuration = 300" and no "dynamic", as the design says. No drift.

| Task | RED evidence | GREEN evidence |
|------|--------------|----------------|
| 7.1 | "npm test -- src/app/api/cron/retention": suite failed to load, "Cannot find package '@/app/api/cron/retention/route'" (0 tests). 20 cases written: 7 bad bearers, unset secret, a dry run without the bearer, GET only, literal ceiling 300, real run options, "?dry=1" forwarded, "?dry=0", "?dry=" and "?other=1" stay real runs, counts-only body, one "retention.run" log line, failures in the counts, generic 500 | n/a |
| 7.2 | "npm test -- src/app/api/cron/retention src/app/route-coverage.test.ts" with the route and no matrix row: 1 failed, "the table lists every protected entry point and nothing else: missing [ 'api/cron/retention/route.ts' ]" | n/a |
| 7.3 | n/a | `src/app/api/cron/retention/route.ts`: 20 of 20 in the route test |
| 7.4 | n/a | `src/test/access/matrix-table.ts` row added: "npm test -- src/app/api/cron/retention src/app/route-coverage.test.ts src/app/access-matrix.routes.test.ts": 3 files, 162 tests passed |
| 7.5 | n/a | gates: "npm run typecheck" clean; "npx eslint" on the three touched paths: only the known CRLF noise; "npx prettier --check --end-of-line auto" clean |

Decision: only the literal value "1" asks for a dry run, as the spec says ("?dry=1"). "?dry=0", an empty value and unrelated keys run for real, and two cases pin that so a "has('dry')" shortcut would fail.

Work Unit Evidence:

| Evidence | Value |
|---|---|
| Focused test command and exact result | "npm test -- src/app/api/cron/retention src/app/route-coverage.test.ts src/app/access-matrix.routes.test.ts" with the dummy DB: 3 files, 162 tests passed |
| Runtime harness | N/A: the route is called as a function with a plain Request; the real database run is the owner-run integration test (Phase 12) |
| Rollback boundary | Revert the route folder and the matrix row |

Commit: "feat(cron): add the retention route".

## Unit 7: daily schedule (DR-11)

Mode: Strict TDD. Layer: unit (static JSON parse). Safety net: `src/lib/intake/vercel-config.test.ts` 4 of 4 passed before the edit.

| Task | RED evidence | GREEN evidence |
|------|--------------|----------------|
| 8.1 | "npm test -- src/lib/intake/vercel-config.test.ts": 2 failed, 3 passed. "runs data retention daily at 11:00 UTC (05:00 Managua, DR-11)": the crons array does not contain the retention entry; "registers exactly the three scheduled jobs, each once": two paths instead of three. The two existing job tests untouched and green | n/a |
| 8.2 | n/a | `vercel.json` gains `{ "path": "/api/cron/retention", "schedule": "0 11 * * *" }`: 5 of 5 passed. Gates: "npm run typecheck" clean; "npx eslint" only the known CRLF noise (52 "Delete" lines, nothing else); "npx prettier --check --end-of-line auto" clean on both files |

Work Unit Evidence:

| Evidence | Value |
|---|---|
| Focused test command and exact result | "npm test -- src/lib/intake/vercel-config.test.ts" with the dummy DB: 1 file, 5 tests passed |
| Runtime harness | N/A: static JSON parse; the scheduler registers the entry on the deploy of PR 2 (task 13.4 checks it) |
| Rollback boundary | Revert `vercel.json` and `src/lib/intake/vercel-config.test.ts` |

Commit: "feat(cron): schedule retention daily at 11:00 UTC".

## Unit 8: column inventory, cut cases, login pins and the RNF-04 integration test (DR-4, DR-5, DR-12; verify PR 1 W1 and W2)

Mode: Strict TDD. Layer: unit (transaction double, static schema reads) plus one owner-run integration suite. Safety net: `src/lib/data/retention.test.ts` (15 tests) and `src/app/(auth)/login/actions.test.ts` (6 tests) were green before any edit.

All the unit tests of this unit pin behavior that PR 1 already built, so they pass at write and have no RED step. Each carries revert-only mutation checks (a temporary edit, then "git restore <file>", "git status" clean of it before the commit).

| Task | Pass-at-write evidence | Mutation checks (each killed) |
|------|------------------------|-------------------------------|
| 9.1 | `src/lib/data/retention-inventory.test.ts`, "column inventory of the tables retention touches (DR-4, DR-5)": 7 cases, one per table (Usuario, Solicitud, SolicitudDecision, Remision, ReporteInasistencia, Escalamiento, DocumentoRespaldo); every column of "getTableColumns" is classified exactly once as rewritten, kept or deleted | IM1: a fake personal column "telefonoContacto" added to Solicitud in `src/db/schema.ts` made "solicitud: every column is classified exactly once" fail (1 failed, 14 passed); restored |
| 9.2 cut cases | same file: "binds the student role and the cutoff five years before now" (params "estudiante", cutoff, cutoff), "uses the same rule to count, to select and to guard the write", "reads in ascending id order and resumes after the last id of the batch", "carries the closed code and the two counts, and nothing else" | IM2 cutoff of the account-age clause moved one day: 1 failed. IM3 role "docente": 1 failed. IM8 "lastId = id" removed (keyset advance): 1 failed. IM9 guarded write without the due rule: 1 failed. IM10 keyset read without the id bound: 1 failed. IM11 "orderBy(asc(usuario.id))" removed: 1 failed. IM12 extra key in the audit payload (`src/lib/audit/events.ts`): 1 failed |
| 9.2 W2 | same file, 4 clause cases ("requires the student role only", "accounts not yet cancelled", "an account old enough", "no request presented or resubmitted after the cutoff", the last pinning "greatest(PresentadaEn, ReenviadaEn) > cutoff" on the student's own requests) | IM4 "CanceladoEn IS NULL" dropped: 1 failed (its own case). IM5 the whole "greatest" clause dropped: 2 failed. IM6 "ReenviadaEn" dropped from the "greatest": 1 failed. IM7 role subselect dropped: 4 failed. IM13 "CreadoEn <= cutoff" dropped: 3 failed |
| 9.2 W1 | `src/app/(auth)/login/actions.test.ts`, "loginAction on retention accounts (DR-3)": 4 cases. The sentinel account and a cancelled student (inactive rows with their hashes) get the invalid error with a verifier that accepts everything, no session, no cookie; and with the real bcrypt, neither hash is well formed and no password (including the hash text itself) verifies | LM1 "!user.activo" dropped from `src/app/(auth)/login/actions.ts`: 2 failed (the two turn-away cases). LM2 SYSTEM_HASH replaced by a well-formed bcrypt string in `src/lib/retention/policy.ts`: 1 failed. LM3 the same for CANCELLED_HASH: 1 failed |
| 9.3 | "npm test -- src/lib/data/integration/guard.test.ts" green (21 tests with the integration folder) | n/a |
| 9.4 | `src/lib/data/integration/retention.integration.test.ts` written and typechecked, NOT run against any database. Skip mode ("vitest run --config vitest.integration.config.mts" with INTEGRATION_DATABASE_URL unset): 1 file skipped, 9 tests skipped. "npm test" does not collect it (the default config excludes "src/**/*.integration.test.ts") | n/a: owner-run, Phase 12 |
| 9.5 | gates: focused "npm test -- src/lib/data/retention-inventory.test.ts src/app/(auth)/login/actions.test.ts src/lib/data/integration/guard.test.ts src/lib/data/retention.test.ts": 4 files, 61 tests passed; "npm run typecheck" clean; "npx eslint" on the four files: only the known CRLF noise after renaming a helper that eslint read as a React hook (rule "react-hooks/rules-of-hooks" on a function named "use"); "npx prettier --check --end-of-line auto" clean | n/a |

Integration test design (what the owner will run): it enters through "GET /api/cron/retention" with the scheduler bearer; "@/lib/intake/deps" is mocked to a fake document store; a dry run in "beforeAll" must report exactly "due: 1" or the suite aborts before the real run (so leftovers or real aged accounts on the branch stop it; "afterAll" still removes its fixtures). Fixture A is aged (rejected request with decision text and one document with an extraction row and a seeded file; approved request with a remission, an absence report, an escalation note and its answer; phone set and password-change flag set), B has an aged account and a request presented two years ago, C is aged with an active enrollment. Aging is one UPDATE per request (consent and presentation at six years ago, no resubmission, no deadline start) plus Usuario.CreadoEn; "now" is never shifted. It asserts the account columns (DR-3), every other table as "before with only the redacted columns changed" (DR-4, DR-5), zero document and extraction rows and the file gone, one audit row by the sentinel with no name, CIF or email, B and C byte-equal to before, a second run that cancels none and adds no audit row, and an UPDATE on the audit table rejected with 42501. Risk: it was never executed, so a CHECK or fixture mistake can only show on the owner's run.

Decision: the verify W2 clause pins sit in `src/lib/data/retention-inventory.test.ts` next to the cut cases (same helper, same double) rather than in `src/lib/data/retention.test.ts`, so PR 1 files are not edited.

Work Unit Evidence:

| Evidence | Value |
|---|---|
| Focused test command and exact result | "npm test -- src/lib/data/retention-inventory.test.ts src/app/(auth)/login/actions.test.ts src/lib/data/integration/guard.test.ts src/lib/data/retention.test.ts" with the dummy DB: 4 files, 61 tests passed |
| Runtime harness | Owner-run: "npm run test:integration" against the disposable branch (task 12.2); here only the skip-mode run (9 skipped) |
| Rollback boundary | Delete `src/lib/data/retention-inventory.test.ts` and `src/lib/data/integration/retention.integration.test.ts`, revert the four login cases and the setup line |

Commit: "test(retention): prove RNF-04 through the scheduled route".

## Unit 9: partition window note (D8)

Mode: documents only, structural readback (no behavior, no test).

- 10.1 (2026-11-19): `modelo_datos_sql.md` note 13 now says the yearly partitions run 2026..2035 (2031 to 2035 come from migration 0014), the window ends 2035-12-31 and the 2036 partition must be created before 2036 begins; the partition comment above the audit table says 2026..2035. The file keeps its CRLF line endings and its Spanish text. Readback: "git diff --stat modelo_datos_sql.md" shows 2 insertions and 2 deletions. No test or other document pins the old window.

Work Unit Evidence:

| Evidence | Value |
|---|---|
| Focused test command and exact result | N/A: documents only |
| Runtime harness | N/A: no runtime boundary |
| Rollback boundary | Revert the note in `modelo_datos_sql.md` |

Commit: "docs: note the 2036 audit partition window".

## Checkpoint 11.1: PR 2 size after unit 9 (STOP: over the 1000-line budget)

"git diff --numstat 7533b98...HEAD" (7533b98 is origin/main with PR 1 merged, so it is also the base of PR 2) taken on the four PR 2 unit commits, excluding "openspec/" and ".engram/":

| File | Added | Deleted |
|------|-------|---------|
| `modelo_datos_sql.md` | 2 | 2 |
| `src/app/(auth)/login/actions.test.ts` | 59 | 0 |
| `src/app/api/cron/retention/route.test.ts` | 175 | 0 |
| `src/app/api/cron/retention/route.ts` | 41 | 0 |
| `src/lib/data/integration/retention.integration.test.ts` | 516 | 0 |
| `src/lib/data/retention-inventory.test.ts` | 319 | 0 |
| `src/lib/intake/vercel-config.test.ts` | 10 | 1 |
| `src/test/access/matrix-table.ts` | 8 | 0 |
| `vercel.json` | 2 | 1 |
| `vitest.integration.setup.ts` | 2 | 0 |
| Total | 1134 | 4 |

Total: 1138 changed lines, 138 over the 1000 budget (the weighed forecast was ~847). No generated snapshot is part of PR 2. Per the checkpoint rule, apply STOPS here and reports to the owner; no test was trimmed and no exception was assumed. Task 11.2 (the full "npm test" run) is not done: it follows the owner decision, as 6.4 did for PR 1.

Where the overage comes from, against the design's raw estimate and the tasks weighed figure:

| File | Design raw (weighed) | Measured | Over (weighed) |
|------|----------------------|----------|----------------|
| `src/lib/data/integration/retention.integration.test.ts` | 300 (390) | 516 | +216 (+126) |
| `src/lib/data/retention-inventory.test.ts` | 140 (182) | 319 | +179 (+137) |
| `src/app/api/cron/retention/route.test.ts` | 145 (189) | 175 | +30 (-14) |
| `src/app/(auth)/login/actions.test.ts` (verify W1, not in the design) | 0 | 59 | +59 |
| `src/app/api/cron/retention/route.ts` | 50 | 41 | -9 |
| the five small files (`vercel.json`, its test, the matrix row, the setup line, `modelo_datos_sql.md`) | 29 | 28 | -1 |

Prettier expands every object literal and call to one item per line, which is the driver again. By content, the separable blocks are: the reviewed column list of `src/lib/data/retention-inventory.test.ts` (137 lines of arrays, lines 46 to 182), the W1 login cases (59 lines), and in the integration test the fixture setup of `beforeAll` (about 115 lines). Dropping the W1 cases and compacting nothing else would still leave ~1079. The owner decides; nothing was moved or cut.

## Size exception for PR 2 and task 11.2: full run

- Owner decision (2026-11-19): a size exception is granted for PR 2 at 1138 changed lines against 7533b98, excluding "openspec/" and ".engram/" (precedents: PR 1 at 1204 and auth-route-tests at 1220). Checkpoint 11.1 stays as measured; nothing was trimmed.
- 11.2 (2026-11-19): "npm test" once with the dummy DATABASE_URL at the checkpoint commit: 355 files, 8430 tests, all passed, none failed or skipped, wall time 237 s (vitest duration 235.66 s). PR 1's full run was 353 files and 8382 tests; the difference is the two new test files and 48 new tests of PR 2. No database was contacted.

## Phase 12: RNF-04 integration run (evidence for the thesis)

- Date: 2026-11-19, green run 13:33:57-13:34:29 Managua (19:33:57 UTC), rerun after the mutation check 13:35:32 Managua.
- Commit: 653d761 on "feat/data-retention-2" (base main 7533b98).
- Database: disposable Neon branch "retention-it", child of "dev-arnia", with migration 0014; never production or "validacion-secretaria". Guarded by INTEGRATION_ALLOW_WRITES=1 and the production-endpoint refusal.
- Entry point: "GET /api/cron/retention" with the scheduler bearer, as thesis 4.9 describes (simulated age over five years; scheduled task; cancellation and audit log).
- Result: 9 of 9 tests passed.
  - Dry run: due 1, nothing written (DR-9).
  - Real run: due 1, cancelled 1, documents deleted 1, stored files deleted 1, failures 0.
  - Account anonymized in place (DR-3); request snapshots and free text redacted, residue kept (DR-4, DR-5).
  - Document row, extraction row and stored file gone (DR-4, DR-7).
  - Exactly one "usuario.cancelado" audit row, by the system account, without personal data (DR-6).
  - Younger student and enrolled student untouched (DR-1, DR-2).
  - Second run: due 0, cancelled 0, no new audit row (DR-8).
  - UPDATE on the audit table rejected with 42501 (RNF-06).
- First run (13:32 Managua) failed 1 of 9 on a test bug: JavaScript's default sort placed null after "[cancelado]". The stored values were right. Fixed in 653d761 by comparing the decisions row by row, like the other tables.
- Mutation check (12.4): with the active-enrollment clause removed, the dry run reported due 2 and the suite aborted before the real run (exit 1, nobody cancelled). Restored with "git restore"; the rerun passed 9 of 9.
