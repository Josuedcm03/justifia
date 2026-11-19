```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:ba8d8f5f7f901be03fdf9253c3e2e55db93beb9b78100d523a0b5143cb42cc50
verdict: fail
blockers: 0
critical_findings: 0
requirements: 3/14
scenarios: 12/27
test_command: DATABASE_URL=postgres://u:p@127.0.0.1:9/x npx vitest run
test_exit_code: 0
test_output_hash: sha256:49e820a51771549c9818c31962243f6012a0182fae0d2be75f8692a1ee3c5105
build_command: DATABASE_URL=postgres://u:p@127.0.0.1:9/x npm run typecheck
build_exit_code: 0
build_output_hash: sha256:67d1fc6f094cf715091e7d1a2d3052f1850098c09943bd7fa81afbe386e92a94
```

> **Envelope note.** The envelope verdict is `fail` only because native admission (`gentle-ai sdd-verify-validate`) refuses a passing verdict while completed counts are below the whole-change totals: 7 scenarios are DEFERRED to PR 2 by design (option A) and 8 are PARTIAL. It does not mean an implementation failure: there are 0 blockers, 0 CRITICAL findings, 0 failing tests. The verdict for the PR 1 scope, which is what merge gate 6.7 asks for, is **PASS WITH WARNINGS** (see Verdict). The whole change is not archive-ready until PR 2 lands and is verified.

## Verification Report

**Change**: data-retention (scope: PR 1 only, work units 1-5)
**Branch / HEAD**: `feat/data-retention` @ 49f67bb, diffed against base bf91506 (origin/main; the local `main` ref is stale and was not used)
**Version**: N/A
**Mode**: Strict TDD (`openspec/config.yaml` `strict_tdd: true`, vitest runner)

Scope note: PR 1 ships the pure policy, migration 0014 with schema and journal, the audit event, the data module `src/lib/data/retention.ts`, the structural carve-outs and RN-27. The route, `vercel.json`, matrix row, column-inventory test, integration test and SQL-shape cases are PR 2 (option A, apply-progress 0.1). Scenarios that need them are marked DEFERRED (PR 2) and are not failures. The envelope counts (3/14 requirements, 12/27 scenarios) are completed over the whole change, so the deferred and partial items keep them below total by design.

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total (tasks.md) | 71 |
| PR 1 implementation tasks (0.1-0.4, 1.1-5.1, 6.1, 6.4) | all complete |
| PR 1 tasks open by design: 6.2, 6.3, 6.5, 6.6, 6.7 | 5 (owner-run database steps, push and PR, this merge gate) |
| PR 2 and later tasks (7.x-14.x) | open, out of scope |

6.6 (apply 0014 to production, owner's explicit yes, then read-only verification) is a precondition of the PR 1 merge per the "Merge gate" section of tasks.md. It is a process gate, not an implementation defect, and is listed as a WARNING below so it is not forgotten.

### Build and Tests Execution

**Typecheck** (`npm run typecheck`, exit 0): passed, 0 errors. No `npm run build`, as instructed.

**Focused run** (dummy DB `postgres://u:p@127.0.0.1:9/x`):
`npx vitest run src/lib/retention src/lib/data/retention.test.ts src/db src/lib/audit src/lib/data/append-only.test.ts src/lib/data/remision-writes.test.ts src/lib/data/escalamiento-writes.test.ts src/lib/data/users`
Result: 28 files passed, 508 tests passed, 0 failed, 0 skipped (40 s).

**Full run** (`npx vitest run`, same dummy DB, exit 0): 353 files passed, 8382 tests passed, 0 failed, 0 skipped (263 s). The apply report said 8381 at 63a067a; the extra test is the M3 pin added in 49f67bb. No database was touched and no integration test was run.

**Lint**: `npx eslint` on the touched files reports only the known CRLF prettier noise (precedent recorded in tasks.md); nothing else. **Coverage**: no coverage provider installed, skipped, not a failure.

A temporary scratch test was used to render the exact SQL that `retention.ts` builds (real code output fed to a mock drizzle builder, no connection). It was deleted; `git status` is clean.

### Spec Compliance Matrix

Statuses: COMPLIANT (covering test passed), PARTIAL (test passes but covers only part), DEFERRED (needs a PR 2 artifact), UNTESTED (no covering test).

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| DR-1 Due rule | Boundary (table-driven) | `src/lib/retention/policy.test.ts > retentionCutoff (DR-1) > anchor %s at now %s is due` (4 rows), `treats exactly five years as due...`, `treats one day less...`, `clamps a missing Feb 29 cutoff...`, `keeps the day of month...` | COMPLIANT (cutoff arithmetic; SQL use of the cutoff is in the rows below) |
| DR-1 | Recent request moves the anchor | none in PR 1 (needs the `greatest(PresentadaEn, ReenviadaEn)` clause on a real database; integration fixture B, PR 2) | DEFERRED (PR 2) |
| DR-2 Exclusions | Enrolled student | `src/lib/data/retention.test.ts > builds a due rule that excludes students with an active enrollment (DR-2)` plus `skips a student whose guarded update matches no row: no other write, no audit row` | PARTIAL (clause and skip path pinned; end to end is PR 2 fixture C) |
| DR-2 | Staff and cancelled accounts | none in PR 1 (role subselect and `CanceladoEn IS NULL` are not pinned; SQL-shape cases and integration second run, PR 2) | DEFERRED (PR 2) |
| DR-3 Account cancellation | Account anonymized | `retention.test.ts > anonymizes the account and redacts the snapshots and free text (DR-3, DR-4)` (exact SET object: placeholder, login `cancelado-7`, NULL correo/telefono/cif, hash `!cancelado`, `activo` false, `canceladoEn` now) | PARTIAL (values pinned; "cannot authenticate" has no committed test, see W1) |
| DR-4 Requests, text, documents | Requests and documents | same test (exact column sets for Solicitud, SolicitudDecision, Remision, ReporteInasistencia, Escalamiento; redact is `CASE WHEN ... IS NULL THEN NULL ELSE '[cancelado]'`), `writes every table inside the transaction...` (statement order incl. the `DocumentoRespaldo` delete) | PARTIAL (statement shape pinned on a double; extraction cascade and real rows are PR 2 integration) |
| DR-5 Residue kept | Residue intact | same exact-column-set assertions (only listed columns are written; no other table is written except the `DocumentoRespaldo` delete) | PARTIAL (inventory test and integration are PR 2) |
| DR-6 One transaction, one audit row | Success | `retention.test.ts > writes every table inside the transaction, then one audit row on its handle`, `writes one audit row per student with the system actor id`; `src/lib/audit/events.test.ts > account cancelled event` (3 cases, incl. smuggled personal fields dropped) | COMPLIANT |
| DR-6 | One failure does not stop the run | `retention.test.ts > rolls back a failing student, counts it and carries on (DR-6)` | COMPLIANT |
| DR-7 Blob deletion after commit | Blob delete fails | `retention.test.ts > counts a failed file delete and leaves the student cancelled` | COMPLIANT |
| DR-7 | Rollback keeps files | `retention.test.ts > keeps the files of a student whose transaction fails at the audit row`, `deletes the files only after the audit row, never before`, and the DR-6 failure test (`store.has("intake/2/a.pdf")` stays true) | COMPLIANT |
| DR-8 Idempotence and batching | Second run | `retention.test.ts > a second run with the same now finds nothing due and writes no audit row (DR-8)` (scripted `due 0`; real idempotence rests on `CanceladoEn IS NULL`, PR 2) | PARTIAL |
| DR-8 | Over the batch bound | `retention.test.ts > pins the batch size and the batch count, and stops after the last full batch` (50 x 10; an 11th read would throw) | PARTIAL (bound pinned; "each student exactly once across runs" and keyset advance are PR 2) |
| DR-9 Dry run | Dry run | `retention.test.ts > counts the due students and issues only reads` (two selects, zero transactions, no audit, blob kept) | PARTIAL (data-module part; route `?dry=1` is PR 2) |
| DR-10 Scheduled route | Identity matrix | PR 2 | DEFERRED (PR 2) |
| DR-10 | Scheduler call | PR 2 | DEFERRED (PR 2) |
| DR-11 Daily schedule | Config pinned | PR 2 | DEFERRED (PR 2) |
| DR-12 Evidence test | End to end | PR 2 (owner-run) | DEFERRED (PR 2) |
| DR-12 | Second run and immutability | PR 2 (owner-run) | DEFERRED (PR 2) |
| Audit: Closed set of retention events | Action to entity type | `events.test.ts > maps to usuario.cancelado on the student`; `src/lib/audit/types.test.ts > AUDIT_ACTIONS ... one retention one` | COMPLIANT |
| Audit: Closed set | Payload has counts and a code | `events.test.ts > carries exactly the closed code and the two counts, whatever the student`; `drops a name, email, CIF, free text or request ids smuggled into the call` | COMPLIANT |
| Audit: Closed set | Existing events unchanged | `types.test.ts` (existing codes unchanged, list pinned) and every pre-existing events test, passing (the four narrowing guards now test `accion`, no assertion changed) | COMPLIANT |
| Audit: Audit record content (MODIFIED) | Record carries all fields | pre-existing audit tests, unchanged and passing (`src/lib/audit`, `src/lib/data/audit.test.ts`) | COMPLIANT |
| Audit: Audit record content | Actor comes from the session | pre-existing, unchanged and passing | COMPLIANT |
| Audit: Audit record content | Structured summary is machine-readable | pre-existing, unchanged and passing | COMPLIANT |
| Audit: Audit record content | Retention rows carry the system actor | `retention.test.ts > writes one audit row per student with the system actor id` (`insertAuditEvents(tx, ACTOR, ...)`) | COMPLIANT |
| Audit: Audit record content | System actor is not usable | `retention.test.ts > lets only the retention module and the policy name the system account` (no other writer) covers the second half; the login half has no committed test (W1) | PARTIAL |

**Compliance summary**: 12/27 scenarios COMPLIANT, 8 PARTIAL, 7 DEFERRED to PR 2, 0 UNTESTED within PR 1 scope, 0 FAILING. Requirements fully compliant: 3/14 (DR-6, DR-7, audit "Closed set").

### Correctness (Static Evidence)

| Item | Status | Notes |
|------|--------|-------|
| Guarded first UPDATE rechecks the due rule | Implemented | `src/lib/data/retention.ts:132-147`: `where(and(eq(usuario.id,id), due(cutoff)))` with `returning`; zero rows returns `null` before any other write or audit row. Rendered SQL confirmed it carries the full predicate (role subselect, `CanceladoEn is null`, `CreadoEn <= $`, both NOT EXISTS). Idempotent (a cancelled row fails `CanceladoEn is null`) and race-safe against a new enrollment or request, because the UPDATE takes a fresh statement snapshot. |
| One due predicate shared | Implemented | `due()` at `retention.ts:72-80` feeds `countDue`, `dueAfter` and the guarded UPDATE. `greatest` ignores NULLs, so drafts (both NULL) never count as activity. The cutoff reaches the `greatest` comparison as `$n::timestamptz` from an ISO string. |
| Redact rule keeps NULL | Implemented | `redact()` at `:57-59`; rendered `CASE WHEN col IS NULL THEN NULL ELSE $n::text END` for the four Solicitud snapshot columns, SolicitudDecision.Texto, Remision.Correo, ReporteInasistencia.Nota, Escalamiento.Nota and Respuesta. `Remision.DocenteNombre` and `ReporteInasistencia.DocenteNombre` are NOT NULL columns and get the placeholder (varchar 160; `Cif` is varchar 20 and the placeholder is 11 characters). |
| CHECKs satisfied | Implemented | `CK_Usuario_Cancelado`: one UPDATE sets Activo false and NULLs Correo, Telefono and Cif together with `CanceladoEn`. `CK_Solicitud_Presentada`: a non-NULL snapshot stays non-NULL. `CK_Remision_Correo`: NULL-ness of Correo kept. `CK_SolicitudDecision_Texto`: only `aprobada` may be NULL and stays NULL; the others become a non-blank placeholder. `CK_Escalamiento_Kind` and `_Respuesta`: NULL-ness kept, `RespondidaEn >= CreadoEn` untouched. `CK_ReporteInasistencia_Nota`: NULL or non-blank. No unique index touches a redacted column (`Login` is `cancelado-{id}`, unique per id). |
| Documents deleted in the transaction, blobs after commit | Implemented | Pathnames are selected before the redactions, the `DocumentoRespaldo` rows are deleted at `:190-192` (the only FK to it is `ExtraccionDocumento`, `onDelete: cascade`, schema.ts:822), and `store.delete` runs at `:246`, after `db.transaction` returned. A blob failure increments `failures` and leaves the student cancelled. |
| Exactly one audit row per student, no personal data | Implemented | `insertAuditEvents(tx, actorId, [accountCancelledEvent(...)])` inside the transaction; the builder copies three fields by name (`motivo`, `solicitudes`, `documentos`), the code coming from `RETENTION_REASON`. |
| System actor lookup | Implemented | `findSystemActor` (`:84-98`): login, hash and `NOT Activo`; throws when absent so the run fails closed; no literal id anywhere. Naming is pinned structurally (only `retention.ts` and `policy.ts` name `SYSTEM_LOGIN` or `SYSTEM_HASH`). |
| Staff and sentinel never due | Implemented | Role subselect `Rol.Codigo = 'estudiante'`; the sentinel is an `administrador`. Not pinned by a PR 1 test (W2). |
| Dry run writes nothing | Implemented | Returns after `countDue` (`:226`); the test shows only two selects and zero transactions. The actor lookup still runs first, so a dry run also proves the actor exists, as designed. |
| Batching | Implemented | Keyset on `Id > lastId`, `BATCH_SIZE 50`, `MAX_BATCHES 10`, a short batch stops the run; `lastId` advances before the attempt, so a failing student is not re-read in the same run. |
| Migration 0014 additive | Implemented | 19 statements: 2 ADD COLUMN (nullable, no default), 1 ADD CONSTRAINT (every existing row has `CanceladoEn` NULL, so it validates trivially), 1 sentinel INSERT (`ON CONFLICT ("Login") DO NOTHING`, role looked up from `Rol` by code, no literal id, unusable non-bcrypt hash), 5 partitions 2031-2035 contiguous with `+00` bounds, each with its own `TR_EventoAuditoria_YYYY_truncate` trigger and `REVOKE UPDATE, DELETE, TRUNCATE ... FROM PUBLIC`, matching 0004 exactly (same function, same statement-trigger form, same REVOKE). No DROP, DELETE, UPDATE, ALTER COLUMN, RENAME, CASCADE or BEGIN, and no new DEFAULT partition, function or row trigger. Not run against any database. |
| Journal | Implemented | 15 entries, `when` strictly increasing; 0014 is 1795111590732, later than 0013 (1793660241921); the `0014_snapshot.json` `prevId` equals the 0013 snapshot `id`; the snapshot holds both columns and the check. |
| Carve-outs narrow | Implemented | Only `lib/data/retention.ts`. `append-only.test.ts`: the file is excluded from the general scan but its hits are listed and must equal exactly `.update(solicitudDecision` and `.update(reporteInasistencia`, non-vacuous (the helper regex is also proven on a synthetic delete and revision string), so a delete or a `solicitudRevision` write there fails. `remision-writes.test.ts` and `escalamiento-writes.test.ts`: `["update"]` only. `extraction`, `fingerprint-exposure` and `inscripcion-writes` untouched and green. |
| Unplanned edit | Accepted | `src/lib/data/users.ts:51-60`: `UsuarioConRol` omits `canceladoEn` (type only, no SQL or pinned query changed); needed by typecheck and documented in apply-progress. |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| D1 sentinel `Usuario`, role `administrador`, `Activo=false`, hash `!sistema-sin-clave` | Yes | Migration insert matches; bcryptjs `compare` returns `false` for both `!sistema-sin-clave` and `!cancelado` (probed in this verify). |
| D2 lookup, no hardcoded id | Yes | |
| D3 redact keeps NULL | Yes | |
| D4 guarded first UPDATE | Yes | |
| D5 keyset, 50 x 10 | Yes | |
| D7 `CK_Usuario_Cancelado` | Yes | Schema and migration text equal the design expression. |
| D8 partitions 2031-2035 | Yes | |
| D9 admin listings unchanged | Yes | No listing SQL touched. |
| D10 UTC cutoff, Feb 29 clamp | Yes | |
| Write order (guard, select docs, redacts, delete docs, audit) | Yes | Pinned by `writes every table inside the transaction...`. |
| Interface `RetentionCounts` and `runRetention(now, store, options)` | Yes | One `failures` counter for rollback and file failures, as in the design interface. |
| Order deviation (policy before migration), design open questions | Yes | Recorded in tasks.md; spec DR-4 updated per 0.2. |
| Size | Yes | 1204 changed lines (1191 added, 13 deleted) against bf91506, excluding `openspec/`, `.engram/` and the snapshot (2343 lines, separate); within the owner's exception for PR 1 recorded in apply-progress (about 1205). Re-measured here with `git diff --numstat`. |

### TDD Compliance

| Check | Result | Details |
|-------|--------|---------|
| TDD evidence reported | PASS | `apply-progress.md` has per-unit RED/GREEN evidence tables with the failing messages, a mutation table (M1-M7) and a Work Unit Evidence block per unit. The format differs from the template's single "TDD Cycle Evidence" table but carries the same content. |
| All tasks have tests | PASS | Units 1-4 have test files; unit 5 is documents only (structural readback) and says so. |
| RED confirmed | PASS | Unit 1 import failure then a clamp failure; unit 2 nine of nine failed; unit 3 four failed; unit 4 module missing and three ENOENT carve-out failures. All test files exist. |
| GREEN confirmed | PASS | Every listed file passes in the focused and full runs above. |
| Triangulation | PASS | Boundary table plus ms, day and leap cases; two-student and zero-count payloads; a three-student failure run. |
| Safety net for modified files | PASS | Baseline of 106 files and 2054 tests recorded before edits; the carve-out files were in it. |
| Pass-at-write tests carry mutation checks | PASS | M1, and M3 (a survivor was found, then closed with a new pinned test and a revert-only mutation check). |

Weak spot: tasks 4.4-4.6 were written as one module with a single GREEN run; apply-progress admits that part-by-part GREEN is not separately evidenced (S4).

**Test layer distribution**: unit only (vitest node environment, a scripted transaction double and file-reading structural tests). About 42 new or changed tests: policy 11, migration 9, data module 15, audit 4, carve-outs 3. Integration is deliberately PR 2 and owner-run.

### Assertion Quality

No tautologies, no orphan empty checks, no ghost loops (the migration `for` loops iterate constants or a collection first asserted to hold the five years), and no assertion that skips production code. Mock use is proportionate (3 `vi.mock` against many assertions). Coupling to rendered SQL text at `retention.test.ts:121-123` is noted in S2.

**Assertion quality**: 0 CRITICAL, 0 WARNING (1 SUGGESTION).

### Issues Found

**CRITICAL**: None.

**WARNING**:
- W1. No committed test proves that the sentinel or a cancelled student cannot authenticate (audit-log scenario "System actor is not usable", login half, and the "cannot authenticate" line of DR-3). `src/app/(auth)/login/actions.test.ts` has no inactive-account case and PR 2's DR-12 does not log in. Behavior is correct (checked here: `src/app/(auth)/login/actions.ts:30` rejects `!user.activo`, and `bcryptjs.compare("anything", "!sistema-sin-clave")` and `"!cancelado"` both resolve `false`), but no test pins it. Suggested fix: a small unit test (PR 2 or PR 1) asserting `verifyPassword(x, SYSTEM_HASH)` and `verifyPassword(x, CANCELLED_HASH)` are false, plus `loginAction` returning the invalid error for an inactive user.
- W2. The due predicate is pinned in PR 1 only for the active-enrollment clause (`src/lib/data/retention.test.ts:115-124`). The role subselect, `CanceladoEn IS NULL`, the cutoff parameters, the `greatest(PresentadaEn, ReenviadaEn)` clause and the keyset advance have no PR 1 test; the mutation that dropped the enrollment clause survived until that pin was added, and the same class of mutation survives for these clauses. PR 2 task 9.2 plans cutoff, `estudiante`, keyset and payload-key pins, but it does not list the `greatest` Solicitud clause or the `CanceladoEn IS NULL` clause, and the 12.4 mutation check covers only the enrollment clause. Before PR 2 is verified, add those two pins with revert-only mutation checks (or confirm that integration fixture B and the second run fail under those mutations).
- W3. Merge-gate preconditions still open (process, not code): task 6.6 (migration 0014 applied to production with the owner's explicit yes, then read-only verification of the sentinel, the partitions and `CK_Usuario_Cancelado`), 6.2 (read-only check that no user owns login `sistema`; if one does, the sentinel INSERT is skipped by `ON CONFLICT DO NOTHING` and the run fails closed with `retention_failed`), 6.3, 6.5 and 6.7. This report satisfies the "sdd-verify passes" half of 6.7 only. None of these may run without the owner's explicit yes per `CLAUDE.md`.

**SUGGESTION**:
- S1. `retention.ts` logs nothing, so a persistently failing student is visible only as `failures` (the route log is PR 2). Failing students are re-read first each day (the keyset resets per run), so more than 500 persistent failures would starve the backlog. Low likelihood; consider logging the student id (an id is not personal data) or a failure code in PR 2.
- S2. `retention.test.ts:121-123` asserts the exact rendered SQL string of the enrollment clause; it will break on a drizzle formatting change even if behavior holds. Acceptable as a pin, but a regex on `NOT EXISTS ... "Inscripcion" ... "Activo"` would be less brittle.
- S3. `.engram/` chunks are committed inside 8544bcc and inside the code commit 49f67bb. tasks.md says not to stage `.engram/` except as the owner directs; earlier changes have precedent, so no action unless the owner wants them out of the PR diff.
- S4. Tasks 4.4-4.6 share one GREEN run (admitted in apply-progress). Separately, a document uploaded between the pathname select and the delete would leave an orphan blob, which the existing orphan sweep handles (note only).
- S5. The shared `failures` counter merges rollback and file-delete failures; the DR-7 wording "one file failure" is met by `failures: 1, blobsDeleted: 0`, but a separate counter would make the response clearer. The design chose one counter on purpose.

### Other checks

- Commit messages (`git log bf91506..HEAD --format=%B`): 8 commits, all Conventional Commits, no body, no `Co-Authored-By`, no AI attribution, no "Generated with" line (a search for those terms returned nothing).
- Diff scope: 29 files, none outside `src/`, `drizzle/`, `docs/`, `openspec/` and `.engram/`; no `package-lock.json`, route, `vercel.json` or matrix change (PR 2 content is absent, as option A requires).
- No database was contacted: dummy URL only, no migrate, no integration test, no push.

### Verdict

PR 1 scope: PASS WITH WARNINGS (envelope: `fail`, whole-change completeness only, see the envelope note)

PR 1 matches the specs and design in scope: 508 focused and 8382 full tests green, typecheck clean, migration and carve-outs correct and narrow, TDD evidence present, size within the owner's exception. There is no CRITICAL issue; the three warnings are a missing login-rejection test (W1), predicate clauses that only PR 2 will pin (W2), and the owner-run production migration that must precede the merge (W3). Next phase: owner steps 6.2-6.6, then PR 1 can merge; fold W1 and W2 into PR 2.
