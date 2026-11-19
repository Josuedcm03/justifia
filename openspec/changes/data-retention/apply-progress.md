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
