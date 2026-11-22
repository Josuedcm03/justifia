```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:82bb16a40faadae393ba79c9061bd5899b4d27f181b8482271fbf9e8f4d2f957
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 21/21
scenarios: 70/70
test_command: npm test
test_exit_code: 0
test_output_hash: sha256:eb85d718e4c2b57c1eccff930e64d0d6e552679504c6f5f00426dcdb3734c1b9
build_command: npm run build
build_exit_code: 0
build_output_hash: sha256:2f370677b8154b9e7ab1f66546c97ccd02714767641d2287376968820c38592f
```

## Verification Report

**Change**: catalog-schedule
**Version**: N/A (five spec deltas, no versioned base)
**Mode**: Strict TDD (vitest, `npm test`)
**Date**: 2026-11-21
**Branch**: `feat/catalog-schedule-archive` (17 chained slice commits, seed commit `97de35d`, walk-feedback commit `ab37d5d`, uncommitted walk record in `tasks.md`)
**Evidence revision**: `git diff HEAD -- openspec/changes/catalog-schedule | sha256sum`. The diff is the uncommitted `tasks.md` walk record; this report is a new untracked file and is not part of that digest.

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 121 (checkbox items) |
| Tasks complete | 114 |
| Tasks incomplete | 7 (16.7, 17.1 to 17.6) |

All 7 pending tasks are delivery or closeout and expected pending: 16.7 (delete the walk branch, owner), 17.1 (re-run gates on `main` after the merges), 17.2 (this verification), 17.3 to 17.5 (archive), 17.6 (merge order, owner). No core or implementation task is pending. Every `[x]` task was cross-checked against code: `canManageEnrollments`, `requireEnrollmentAccess`, `enrollmentInScope` and `studentRowInScope`, `listInscripciones`, `searchStudents`, `loadAssignPage`, `recordEnrollmentListRead` and `recordEnrollmentStudentSearch`, `staffDropGroup` and `staffEnrollInGroup`, both server actions, the table, the assign page and form, the nav entry and the docs hunks all exist and are exercised by passing tests.

### Build and Tests Execution

| Command | Exit | Result |
|---------|------|--------|
| `npm test` (vitest run, full suite, once) | 0 | 378 test files passed (378), 9623 tests passed (9623), 0 failed, 0 skipped; 178.7 s. None of the three known load-flaky files failed, so no isolated re-run was needed. |
| `npx tsc --noEmit -p .` | 0 | 0 errors |
| `npm run lint` | 1 | CRLF checkout artifact plus pre-existing files (see below); no change-introduced finding |
| `npx eslint --rule "prettier/prettier: [error, {endOfLine: auto}]"` (whole repo, extra) | 1 | 23 errors, 1 warning, all in files this change does not touch (see below) |
| `npm run build` (inline dummy `DATABASE_URL` and 32-char `AUTH_SECRET`, no `.env` written) | 0 | Compiled successfully; `/catalog/inscripciones` and `/catalog/inscripciones/assign` listed as dynamic routes |

No vitest or node process was left running.

**Lint detail.**
- `npm run lint` reports 156,739 errors and 1 warning across 788 files. 156,420 of the prettier errors are "Delete CR": the working-copy CRLF (autocrlf) artifact, since git normalizes these files to LF. Reported separately, not counted as defects.
- With `endOfLine: auto` the whole-repo run still reports 23 prettier errors and 1 warning. They are in `docs/utils/ocr-spike/{batch,nuextract,pdfpages,retry,run}.mjs`, `src/test/access/inventory.ts` (2 quote-style errors) and `src/components/app-sidebar.tsx` (warning: `SidebarGroupLabel` unused, last blamed 2026-09-17). None is part of this change's diff against `main`, except that the sidebar diff is one added line (`prefetch={prefetchOf(link)}`). Pre-existing debt.
- ESLint with `endOfLine: auto` on the changed `.ts` and `.tsx` files of the change reports 0 errors and the same single pre-existing warning.
- `npx prettier --end-of-line auto --check` on the 127 changed `.ts`, `.tsx`, `.mjs`, `.json` and `.md` files reports 3 files: `.engram/manifest.json`, `docs/requirements.md`, `docs/roadmap.md`. All three also fail the same check on `main` (verified with `git show main:<file> | prettier --stdin-filepath`), so they are pre-existing.

**Coverage**: not available (no coverage tool in this project, `openspec/config.yaml`). Not a failure.

### TDD Compliance

| Check | Result | Details |
|-------|--------|---------|
| TDD evidence reported | OK | `apply-progress.md` has a "TDD Cycle Evidence" table in each of the 16 batches (1 to 15 and 14b). |
| All tasks have tests | OK | Every behavior task names a RED test file that exists in the tree. |
| RED confirmed (tests exist) | OK | The files named in the tables exist and ran in this suite. |
| GREEN confirmed (tests pass) | OK | The full suite passes: 378/378 files, 9623/9623 tests. |
| Triangulation | OK | Tables use `it.each` (denied identities, refusal tables, count table, states table, sibling cases) and per-locale `describe.each`. |
| Safety net for modified files | OK | Each batch records a safety net before editing; `enrollment-write.test.ts` and `inscripcion-writes.test.ts` stayed unedited as the byte-identity proof for the student path (CS-1). |
| Post-walk commit `ab37d5d` | WARNING | Its tests were added in the commit, but `apply-progress.md` has no batch or TDD table for it (W2). |

**Assertion quality**: a scan of the change test files for tautologies, type-only assertions and loops over possibly empty sets found nothing blocking. The two `toBeDefined()` calls in `CI/guards.test.ts` (lines 121 and 318) are non-vacuity guards followed by value assertions. The `forEach` loops in `CI/page.test.tsx` (663) and `CI/assign/page.test.tsx` (719) run after `getAllByRole("heading")`, which throws on an empty set. Mutation checks are recorded per batch in `apply-progress.md`. Result: 0 CRITICAL, 0 WARNING on assertion quality.

### Test Layer Distribution

| Layer | Files (change) | Tools |
|-------|----------------|-------|
| Unit (pure, SQL render with `PgDialect`, DB double) | `permissions`, `enrollment-access`, `request-scope-sql`, `list-params`, `inscripciones`, `enrollment-write-staff`, `request-reads`, `audit/events`, `audit/types`, `validations/inscripcion`, `enrollment`, `enrollment-picker` tests | vitest |
| Integration (Testing Library, mocked guard and actions) | `CI/inscripciones-table`, `CI/page`, `CI/assign/page`, `CI/assign/assign-form`, `CI/actions`, `app-sidebar`, `page-context`, `(home)/page`, `navigation-mock` tests | vitest + Testing Library |
| Structural (source scans, parity, access matrix) | `CI/guards`, `inscripcion-writes`, `i18n/catalog-parity`, `access-matrix.{pages,actions,routes}`, `route-coverage` tests | vitest |
| E2E | none (no E2E tool in the project) | not installed |

Per-file test counts were not re-extracted; the suite total is 9623 tests in 378 files. The staff writer is covered only at the DB-double layer (W3).

### Spec Compliance Matrix

Legend: COMPLIANT = a covering test passed in this run (or, for the one documents scenario, an executed readback); PARTIAL = covered in part (none). `CI/` = `src/app/(dashboard)/catalog/inscripciones/`. Owner walk = `tasks.md` 16.3 to 16.6 (2026-11-21). The owner walk is supporting evidence only; no COMPLIANT row rests on it alone.

#### enrollment-administration (13 requirements, 36 scenarios)

| Requirement | Scenario | Evidence | Result |
|---|---|---|---|
| EA-ACC-1 | Other identities denied (6 rows) | `CI/actions.test.ts` > "setInscripcionActivoAction access" and "assignInscripcionAction access": "covers the six denied identities of the spec table" + `it.each(denied)`; `CI/assign/page.test.tsx` > "AssignPage access" `it.each(denied)`; `CI/page.test.tsx` > "InscripcionesPage access" (anonymous, pending password change); `src/app/access-matrix.{pages,actions}` tests with the rows of `src/test/access/matrix-table.ts` for `page.tsx`, `assign/page.tsx`, `actions.ts`; `enrollment-access.test.ts`. Walk 16.3 (other roles denied). | COMPLIANT |
| EA-ACC-1 | Secretaría allowed | `CI/page.test.tsx` > "renders the list for a secretaria of a facultad". | COMPLIANT |
| EA-ACC-1 | Catalog predicate unchanged | `permissions.test.ts` > "canManageEnrollments (EA-ACC-1: only secretaria)" > "leaves the catalog predicate unchanged for administrador and coordinacion". | COMPLIANT |
| EA-ACC-1 | Forged actor is ignored | `CI/actions.test.ts` > "takes the actor and the scope from the session, never from the payload" (both actions) and "hands the writer exactly the two guard fields". | COMPLIANT |
| EA-SCOPE-1 | Only own facultad | `inscripciones.test.ts` > "listInscripciones core" `it.each([3, 9])` (facultad bound per call); `request-scope-sql.test.ts` > "enrollmentInScope"; `CI/page.test.tsx` "lists with the facultad scope of the session and the default params". Walk 16.3. | COMPLIANT |
| EA-SCOPE-1 | Out-of-scope action refused (deactivate, reactivate, change group, create) | `enrollment-write-staff.test.ts` > "staff lock" refusal `it.each` (foreign facultad, unknown id, scope none: one statement, no audit), "refuses an out-of-scope, unknown or non-student target with not_student" (reactivate), "refuses a student out of scope with not_student and writes nothing" (replace and change group), create out-of-scope case (line 766); `CI/actions.test.ts` "maps not_student (out of scope, unknown) to gone" (both actions). Walk 16.5 (cross-facultad URLs not found in both directions). | COMPLIANT |
| EA-SCOPE-1 | No facultad, no carrera | `enrollment-access.test.ts` > "returns scope none for a secretaria without a facultad"; `request-scope-sql.test.ts` "needs a carrera ... (inner join)" and "is a literal false for none" for both new predicates; `inscripciones.test.ts` "reads nothing for a secretaria without a facultad" (list, periods, search, assign). | COMPLIANT |
| EA-PII-1 | No contact data reaches the browser | `inscripciones.test.ts` "selects the student name and CIF only, never a contact column", "drops any column the read did not ask for", "selects no contact column" (search); `CI/page.test.tsx` > "leaks no personal data (EA-PII-1)"; `CI/inscripciones-table.test.tsx` > "delivers nothing beyond the row fields"; `CI/assign/page.test.tsx` "sends the results list only the name, the CIF and the id". | COMPLIANT |
| EA-LIST-1 | States shown (4 rows) | `CI/inscripciones-table.test.tsx` > "states (EA-LIST-1 table, as text)" (active and effective, active and not effective, inactive); `inscripciones.test.ts` > "listInscripciones core" effective and writable tables. | COMPLIANT |
| EA-LIST-1 | Default view | `inscripciones.test.ts` > "lists the latest period, raw state active, with no search by default"; `CI/page.test.tsx` "lists with the facultad scope of the session and the default params". | COMPLIANT |
| EA-LIST-1 | Nothing in scope | `CI/inscripciones-table.test.tsx` > "shows the shared empty state and no table when nothing is in the default view"; `CI/page.test.tsx` > "structure and copy" `it.each` variants including "empty". | COMPLIANT |
| EA-FILT-1 | Filters combine (5 rows) | `inscripciones.test.ts` > "listInscripciones filters": student on name or CIF, asignatura on code or name, "matches the group number exactly", "filters the RAW state", "combines every filter with AND", "uses an existing period other than the latest"; `list-params.test.ts` > "parseInscripcionesListParams" and "catalogListHref - /catalog/inscripciones"; `CI/inscripciones-table.test.tsx` "applies every filter at once through the URL". | COMPLIANT |
| EA-FILT-1 | Invalid parameter and no results | `inscripciones.test.ts` "falls back to the latest period when the period does not exist"; `list-params.test.ts` "treats a repeated or oversized filter as unset or capped"; `CI/inscripciones-table.test.tsx` "names the search term in no-results and clears every filter but sort and size" plus the `ab37d5d` clear-link tests (see the section on that commit). Walk 16.3 feedback. | COMPLIANT |
| EA-DEG-1 | Read fails | `inscripciones.test.ts` degraded results (lines 254, 661, 924); `CI/page.test.tsx` > "writes no row and shows no data when the read is degraded" and "renders no toggle when the read is degraded"; `CI/assign/page.test.tsx` > "AssignPage degraded". | COMPLIANT |
| EA-DEG-1 | Write fails | `enrollment-write-staff.test.ts` > "staff atomicity and failure" (data statement or audit insert throwing: rethrow, one sanitized log line with the staff actor, no audit reported), "logs the STAFF actor when the reactivation audit insert fails and rolls everything back", replace "an audit insert failing on the second row rolls back both"; `CI/actions.test.ts` > "setInscripcionActivoAction failure" and "turns a thrown writer error into the unexpected copy". Rollback is asserted at double level (W3). | COMPLIANT |
| EA-DEACT-1 | Confirm deactivation | `enrollment-write-staff.test.ts` > "staffDropGroup": "deactivates the student's row and writes one baja audit row with the STAFF actor"; `CI/actions.test.ts` "drops through the staff writer only and revalidates the list once"; `CI/inscripciones-table.test.tsx` "confirm posts the group id and the deactivate intent for the row's student". Walk 16.4 and 16.6. | COMPLIANT |
| EA-DEACT-1 | Cancel | `CI/inscripciones-table.test.tsx` "cancel closes the dialog and calls no action". Walk 16.4 and 16.6 (cancelled dialogs left no row). | COMPLIANT |
| EA-DEACT-1 | Request count excludes drafts (4 rows) | `inscripciones.test.ts` > "filters by every visible state and never names a draft" (SQL render) and "counts this student's requests that name this group"; `CI/inscripciones-table.test.tsx` > "deactivation notice (EA-DEACT-1 count table)" and "mentions no request and no draft when the count is zero"; `CI/page.test.tsx` "passes the dependent-request count of each row and nothing that would reveal a draft". | COMPLIANT |
| EA-DEACT-1 | Requests unchanged | `enrollment-write-staff.test.ts` > "staffDropGroup": the writer issues only the `Inscripcion` update and the audit insert, all inside one transaction ("runs in one transaction with every statement inside it"); no `Solicitud*` statement exists in the scripted sequence. | COMPLIANT |
| EA-DEACT-1 | Last active inscription | `CI/inscripciones-table.test.tsx` "always carries the RN-27 retention sentence (%d requests)" and "says nothing is cancelled automatically". Walk 16.4. | COMPLIANT |
| EA-DEACT-1 | Refusals (4 rows) | `enrollment-write-staff.test.ts` "staff lock" refusal table (out-of-scope, unknown, non-estudiante) and "writes no audit row for a refusal" (already inactive or foreign group: `not_enrolled`); `CI/actions.test.ts` "maps not_enrolled to unchanged without revalidating". | COMPLIANT |
| EA-REACT-1 | Reactivate an offered group | `enrollment-write-staff.test.ts` > "by default, reactivate only": "reactivates an inactive row of an offered group with no sibling and writes one reactivada with the STAFF actor"; `CI/inscripciones-table.test.tsx` "is one press with no dialog when the row can be reactivated". Walk 16.4. | COMPLIANT |
| EA-REACT-1 | Refusals (5 rows) | `enrollment-write-staff.test.ts` reactivate refusal table (older period, grupo inactive, asignatura inactive, row already active, out-of-scope or unknown, no existing row) and "sibling found inside the transaction, under the lock" (refuses, nothing changed); `inscripciones.test.ts` "marks %s writable=%s" table; `CI/inscripciones-table.test.tsx` "offers no control on an inactive row that cannot be reactivated, not even a dead one". The `walk.est.a.bloqueado` case (inactive group or asignatura) is covered by these tests; the owner did not separately confirm it (W5). | COMPLIANT |
| EA-SIB-1 | Replace after confirm | `enrollment-write-staff.test.ts` > "replace and change group": "reactivating a group with an active sibling replaces it ... desactivada then reactivada"; `CI/assign/assign-form.test.tsx` > "confirm step (EA-SIB-1: names what changes)" `it.each(ROWS)`. Walk 16.4 (`desactivada` motivo `reemplazo`, then `reactivada`) and 16.5. | COMPLIANT |
| EA-SIB-1 | Cancel replace | `CI/assign/assign-form.test.tsx` "sends nothing when she cancels"; walk 16.6 (cancelled dialogs left no row). | COMPLIANT |
| EA-SIB-1 | Other asignaturas and periods untouched | `enrollment-write-staff.test.ts` "scopes the sibling update to the target's asignatura and period and to other groups only" and "a target of another asignatura replaces nothing of the first". | COMPLIANT |
| EA-CHG-1 | Change to another group | `enrollment-write-staff.test.ts` "changing to a group the student has no row in replaces the current group and creates the new row: desactivada then creada" and "writes both audit rows in one insert on the same transaction"; `CI/actions.test.ts` > "assignInscripcionAction outcomes (EA-CRE-1, EA-CHG-1, EA-SIB-1)". Walk 16.5 (`walk.est.a.activo` WALK-A1 01 to 02, two audit rows at the same instant). | COMPLIANT |
| EA-CHG-1 | Refusals (5 rows) | `enrollment-write-staff.test.ts` "refuses the student's current group with already_enrolled and leaves every sibling alone", "refuses a student out of scope", and the `not_eligible` rows; `CI/assign/assign-form.test.tsx` "marks the current group and offers no way to submit it"; `CI/inscripciones-table.test.tsx` row-links table (no change link on a non-offered group); `CI/assign/page.test.tsx` "shows no groups for a subject that is not one of the student's offered subjects". A target of another asignatura is an independent create at the writer; the same-asignatura candidates are the assign page's (apply-progress, Batch 12). | COMPLIANT |
| EA-CRE-1 | Create outcomes (6 rows) | `enrollment-write-staff.test.ts` > "staffEnrollInGroup create": "creates the row active for the student and writes one creada with the STAFF actor", "sets an existing inactive row active instead of inserting a second one, with one reactivada", "changes nothing when the row is already active"; not offered and non-estudiante refusals from the eligibility and lock tables; `inscripciones.test.ts` "keeps only active estudiantes". Walk 16.5 (`walk.est.a.nuevo`). | COMPLIANT |
| EA-CRE-1 | Search is limited | `inscripciones.test.ts` > "searchStudents": "limits the search to facultad %i", "keeps only active estudiantes: not another role, not an inactive or cancelled account", "returns the id, the name and the CIF of each match, in that shape only". Walk 16.5 (5 non-cancelled students of A, none of B, no cancelled student). | COMPLIANT |
| EA-WRITE-1 | Race with the student | `enrollment-write-staff.test.ts` "takes the one lock select first: the student's Usuario row ... FOR NO KEY UPDATE" and "not sticky and serialized". The lock is asserted by SQL render on the DB double; no concurrent run exists, which the design accepted for the DB-double strategy; the limit is recorded as W3. | COMPLIANT |
| EA-WRITE-1 | Not sticky | `enrollment-write-staff.test.ts` > "not sticky and serialized": "a staff deactivation is undone by the student's own enrollInGroup: one reactivada, by the student, on the same row". | COMPLIANT |
| EA-WRITE-1 | Atomic failure | `enrollment-write-staff.test.ts` replace "an audit insert failing on the second row rolls back both" and "staff atomicity and failure". Double level. | COMPLIANT |
| EA-WRITE-1 | Staff change reaches the student and the intake | `enrollment.test.ts` (line 100) and `enrollment-picker.test.ts` (line 124): "reads only Inscripcion.Activo of the row, with no author or origin column, so a staff change shows at once (EA-WRITE-1)". The student `/enrollment` view after a staff write was not separately confirmed by the owner (W5). | COMPLIANT |
| EA-UI-1 | Key parity | `src/i18n/catalog-parity.test.ts` (`catalog.inscripciones.*`, `assign.*`, `assign.form.*`, `errors.*`, nav and shortcut keys: identical key sets, non-empty values). | COMPLIANT |
| EA-UI-1 | Documents synchronised | No automated test exists for documents. Static readback during this verification: `rg` finds `canManageEnrollments` and the row 0 scope in `docs/roadmap.md`, and a changelog row and note in `docs/requirements.md`; `git diff main...HEAD -- docs/requirements.md` has only added lines (1 changelog row, 3 note lines) and no removed line, so the RF-12, RF-17 and RN-21 rows are unchanged. A document scenario cannot have a vitest test; the executed readback is the evidence, and the limit is recorded as W6. | COMPLIANT |

#### student-enrollment (1 requirement, 5 scenarios)

| Requirement | Scenario | Evidence | Result |
|---|---|---|---|
| Student writes only their own; the secretaría writes under RF-12 (a) | Student cannot touch another student's row | `enrollment-write.test.ts` dropGroup table incl. "another student's inscripcion" (line 351) and "locks the student's own active estudiante row first, only that row"; `(dashboard)/enrollment/actions.test.ts` "takes the student from the session, never from a forged payload"; `(dashboard)/enrollment/page.test.tsx` "reads for the session student only, never for an id from the request". | COMPLIANT |
| (same) | Staff change shows to the student | `enrollment.test.ts` (line 100) and `enrollment-picker.test.ts` (line 124): no author column, only `Inscripcion.Activo` is read. | COMPLIANT |
| (same) | Student re-enrolls after a staff deactivation | `enrollment-write-staff.test.ts` "a staff deactivation is undone by the student's own enrollInGroup: one reactivada, by the student, on the same row". | COMPLIANT |
| (same) | Student replace still rules after a staff write | `enrollment-write.test.ts` > "replace and audit": "deactivates only same-asignatura same-period siblings, then audits last on the same tx" (student path unedited and green); the schema has no author column, so a staff-created row is indistinguishable for the student replace. | COMPLIANT |
| (same) | Last writer wins | `enrollment-write-staff.test.ts` "not sticky and serialized" and "staffEnrollInGroup refuses a stale replace (EA-SIB-1, EA-CHG-1: the optimistic check)"; both writers share one lock statement shape. Double level (W3). | COMPLIANT |

#### academic-catalog (1 requirement, 6 scenarios)

| Requirement | Scenario | Evidence | Result |
|---|---|---|---|
| Estudiante role integrity of Inscripcion.EstudianteId | Only the allowlisted writer writes Inscripcion | `inscripcion-writes.test.ts` > "has no module outside the allowlist that inserts, updates or deletes Inscripcion" and `it.each(ALLOWED_WRITERS)` "really writes Inscripcion (the allowlist cannot rot) and never deletes". | COMPLIANT |
| (same) | Role of the referenced user (5 rows, student or secretaría) | `enrollment-write.test.ts` > "role integrity (RNF-01, academic-catalog role table)"; `enrollment-write-staff.test.ts` "staff lock" refusal row "a docente, secretaria, coordinacion or administrador target" (no further statement, no audit). | COMPLIANT |
| (same) | Duplicate pair keeps one row | `enrollment-write.test.ts` "already enrolled changes nothing and writes no audit row"; `enrollment-write-staff.test.ts` "changes nothing when the row is already active". | COMPLIANT |
| (same) | Inactive pair is reactivated, not duplicated | `enrollment-write.test.ts` "reactivates only a row that is still inactive"; staff "sets an existing inactive row active instead of inserting a second one, with one reactivada". | COMPLIANT |
| (same) | Unknown estudiante or grupo is refused | `enrollment-write.test.ts` role-integrity and eligibility refusals; staff lock "an unknown id" and "answers a foreign student and a missing one alike". | COMPLIANT |
| (same) | Staff actor is not the referenced student | `enrollment-write-staff.test.ts` "keeps the student on the row: the staff user id never reaches the Inscripcion statement" and create "creates the row active for the student". | COMPLIANT |

#### audit-log (3 requirements, 8 scenarios)

| Requirement | Scenario | Evidence | Result |
|---|---|---|---|
| One audit row per enrollment change, same transaction | Successful operations (7 rows) | `enrollment-write-staff.test.ts`: staff deactivation (`desactivada`), reactivation (`reactivada`), create (`creada`), change group and replace (two rows in one insert, last, same `tx`); student rows in `enrollment-write.test.ts`. Walk 16.6 (write rows carry the staff actor, entity `Inscripcion` with the student id). | COMPLIANT |
| (same) | Operations that leave no row (8 rows) | Already active, not offered, already inactive or foreign, role denied (`CI/actions.test.ts` denied tables), out-of-scope (staff lock), data write fails and audit insert fails (staff atomicity), cancelled dialog (`CI/inscripciones-table.test.tsx` cancel; `assign-form.test.tsx` "sends nothing when she cancels"). | COMPLIANT |
| (same) | Actor from the session | `CI/actions.test.ts` "takes the actor and the scope from the session, never from the payload". | COMPLIANT |
| Staff enrollment events are distinguishable and add nothing | Staff and student event shape is identical | `enrollment-write-staff.test.ts` "student drop and staff deactivation rows match except the actor"; `audit/types.test.ts` closed sets unchanged for writes. | COMPLIANT |
| (same) | Staff payload has ids and no names | `enrollment-write-staff.test.ts` "carries ids and closed codes only: no staff id, name, CIF, email or request count". Walk 16.6 (write payload only `grupoId` and `motivo`). | COMPLIANT |
| One audit row per staff read of inscriptions | List load writes one row without student data | `CI/page.test.tsx` > "audited read": "writes one row after the data loaded, with the session actor and the facultad" and "carries which filters are present as booleans and never the search text"; `audit/events.test.ts` builders (line 1425); `request-reads.test.ts` "recordEnrollmentListRead". Walk 16.6 (`q: true`, no text). | COMPLIANT |
| (same) | Student search writes one row | `CI/assign/page.test.tsx` > "student search": "searches with the facultad scope and the trimmed term, then audits once, after the results"; `request-reads.test.ts` "recordEnrollmentStudentSearch". The payload carries `periodo: ""` (W1). | COMPLIANT |
| (same) | Degraded read writes nothing | `CI/page.test.tsx` "writes no row and shows no data when the read is degraded"; `CI/assign/page.test.tsx` "AssignPage degraded" (`auditMock` not called). | COMPLIANT |

#### backoffice-shell (3 requirements, 15 scenarios)

| Requirement | Scenario | Evidence | Result |
|---|---|---|---|
| BS-NAV-1 | Entries per role (5 rows) | `app-sidebar.test.tsx` > "AppSidebar entries per role (BS-NAV-1, table-driven)" and "Inscripciones item (BS-NAV-4, RF-12 a)"; `navigation.test.ts` per-role oracle (line 277: `catalogInscripciones` visible to `secretaria` only). | COMPLIANT |
| (same) | Settings entry unchanged | `navigation.test.ts` "keeps the settings entry last and pointing at /settings"; `app-sidebar.test.tsx` "shows dashboard and settings for each role". | COMPLIANT |
| (same) | Active marker | `app-sidebar.test.tsx` "marks only Asignaturas on a nested grupos route, with the group open" and "marks only Asignaturas current on /catalog/asignaturas, never Inscripciones". | COMPLIANT |
| (same) | Administration group hidden when empty | `app-sidebar.test.tsx` entries-per-role table (docente and estudiante render no Administration group). | COMPLIANT |
| (same) | Reports entry not prefetched | `navigation.test.ts` "opts the reports entry out of prefetching (it writes an audited read)"; `(home)/page.test.tsx` "offers coordinacion the Reports shortcut right after the escalated requests, not prefetched". | COMPLIANT |
| (same) | Reports routes and active marker | `app-sidebar.test.tsx` > "AppSidebar reports item" for `/reports` and `/reports/requests`; `page-context.test.tsx` trail cases. | COMPLIANT |
| BS-HOME-1 | Home per role (5 rows) | `(home)/page.test.tsx` > "offers secretaria the Inscripciones shortcut between Docentes and Import, not prefetched", the "no Inscripciones card and no link" cases for the other roles, and the per-role card cases. | COMPLIANT |
| (same) | Counts hidden from student and docente | `(home)/page.test.tsx` stats cases ("does not show an alert to a role that never read the stats"; the stats read is not performed for those roles). | COMPLIANT |
| (same) | No shortcut to settings | `navigation.test.ts` "never offers the dashboard or settings to each role". | COMPLIANT |
| (same) | Stats read degrades | `(home)/page.test.tsx` > "when the stats read degrades". | COMPLIANT |
| (same) | Predicates stay in step | `(home)/page.test.tsx` "hides Asignaturas and Docentes from both when the catalog predicate flips" (Inscripciones stays: it reads `canManageEnrollments`). | COMPLIANT |
| (same) | Reports shortcut only for coordination | `(home)/page.test.tsx` Reports shortcut cases for the other roles (unchanged by this change, green). | COMPLIANT |
| BS-NAV-4 | Entry, active marker and trail (es, en) | `navigation.test.ts` trail cases (lines 342 to 358, including `/catalog/inscripciones/assign`); `page-context.test.tsx` (`/catalog/inscripciones` in both locales and the assign trail); `app-sidebar.test.tsx` "marks only Inscripciones current on /catalog/inscripciones, and opens the group"; one `h1` in `CI/page.test.tsx` > "structure and copy". | COMPLIANT |
| (same) | Hidden from other roles (4 rows) | `app-sidebar.test.tsx` "hides the Inscripciones item and its link" per role; `(home)/page.test.tsx` "no Inscripciones card and no link to /catalog/inscripciones"; `navigation.test.ts` per-role oracle. | COMPLIANT |
| (same) | Asignaturas stays the entry of its own paths | `navigation.test.ts` (lines 239 to 241: `/catalog/asignaturas` and `/catalog/inscripciones` active matching); `app-sidebar.test.tsx` "marks only Asignaturas current on /catalog/asignaturas, never Inscripciones". | COMPLIANT |

**Compliance summary**: 70/70 scenarios COMPLIANT, 0 PARTIAL, 0 UNTESTED, 0 FAILING; 21/21 requirements compliant. Two scenarios rest on evidence weaker than a runtime test of the real behavior and are kept as warnings: EA-WRITE-1 "Race with the student" (lock proven on the DB double, W3) and EA-UI-1 "Documents synchronised" (executed readback, W6).

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| EA-ACC-1 | Implemented | `canManageEnrollments` (secretaria only) is distinct from `canManageCatalog`; `requireEnrollmentAccess()` is the first await of every page and action. |
| EA-SCOPE-1 | Implemented | `enrollmentInScope` and `studentRowInScope` live in the SR-6 module; the staff lock adds `Carrera.FacultadId`; foreign and missing ids answer alike. |
| EA-PII-1 | Implemented | Name and CIF only in the read selects; the table receives only displayed fields plus the control ids. |
| EA-LIST-1, EA-FILT-1, EA-DEG-1 | Implemented | Fail-soft list, raw and effective state as text, URL-held filters, clear link. |
| EA-DEACT-1, EA-REACT-1 | Implemented | `ActiveToggle` with `confirmIn="dialog"` in the table; draft-blind count through `VISIBLE_STATES`. |
| EA-SIB-1, EA-CHG-1, EA-CRE-1 | Implemented | `staffEnrollInGroup` fails closed to reactivate only; `{ allowReplaceAndCreate: true, expectedReplaced }` runs the full path with the optimistic stale check (owner decision, task 13.6). |
| EA-WRITE-1 | Implemented | One writer module, one lock, audit last on the same `tx`; student path signatures unchanged. |
| EA-UI-1 | Implemented | Copy in both locales with parity pins; the docs hunks are additive. |
| student-enrollment, academic-catalog, audit-log, backoffice-shell deltas | Implemented | See the matrix. |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| CS-1 actor-aware writer (private `enrollWork` and `dropWork`, student exports unchanged) | Yes | Student writer tests unedited and green. |
| CS-2 reuse `not_student`, no new reason | Yes | The staff result `stale` is staff-only and not a member of the shared unions (owner decision 13.6). |
| CS-3 period rule (D9: deactivate any period) | Yes | `staffDropGroup` has no period filter; tested. |
| CS-4 guard and predicate | Yes | |
| CS-5 scope SQL in one module | Yes | `requestInScope` rendered SQL pinned unchanged. |
| CS-6 and CS-6b list and audited reads | Yes | CS-6 reconciled to the raw-state filter (task 3.10); `resolvedPeriodo` added for the list audit (6.9). The search audit writes an empty period (W1). |
| CS-7 draft-blind count | Yes | |
| CS-8 confirmation flows | Yes, with a documented change | The deactivation confirm is a modal alert dialog (`ab37d5d`), not the inline panel the design names; reuse of `ActiveToggle` unchanged became an opt-in mode (W2). The RN-27 sentence is fixed and always shown (design wording), a superset of the spec text (S4). |
| CS-9 server actions | Yes | Two actions, guard first, zod, then the staff writer. `assignInscripcionAction` takes a third argument `expectedReplaced` (13.6). |
| CS-10 guard tests and nav | Yes | New `CI/guards.test.ts`; `catalog/guards.test.ts` untouched. The sidebar gained the `prefetch` opt-out for group children (apply-progress, Batch 6). |
| D8 (RF-17 (a) not amended) | Yes | Requirement rows unchanged. |

### Walk-feedback commit `ab37d5d` against the specs

- **RNF-12 confirm (EA-DEACT-1)**: the confirm is now a modal alert dialog (`ActiveToggle confirmIn="dialog"`). It states the title with student, subject and group, the count notice and the RN-27 sentence, and cancel calls no action. Covered by `CI/inscripciones-table.test.tsx` (`findByRole("alertdialog")`, "opens the confirmation as a modal outside the table, so it never stretches the row", cancel, count table, "confirm posts the group id and the deactivate intent"). The inline default of `ActiveToggle` is unchanged for the other catalog pages.
- **EA-FILT-1 clear control**: a clear link appears in the filter bar only when a filter is active and rows exist, keeps sort and size, and resets the filters (the no-results state keeps its own clear link). Covered by "offers no clear link in the filter bar when no filter is active" and, per locale, "puts one clear link in the filter bar over rows that keeps sort and size".
- **No prefetch on the audited page (D10)**: the clear link uses `prefetch={false}`; `CI/page.test.tsx` "opts every page link out of prefetch while the audited page is shown" now counts 7 links, all `data-prefetch="false"`; `CI/guards.test.ts` scans every `Link` under `inscripciones/` for `prefetch={false}`.
- **No gap against the specs.** The process gaps are recorded as W2.

### Issues Found

**CRITICAL**: None.

**WARNING**:

- W1. The student-search audit row (`inscripcion.estudiantes.consultada`) records `periodo: ""` (payload built in `CI/assign/page.tsx`, pinned by `CI/assign/page.test.tsx` line 332, seen in the walk, 16.6). The audit-log requirement says the payload carries the period. The list read was fixed in task 6.9 to record the resolved period; the search has no resolved period. Owner decision needed: accept an empty period for the search, or define a closed value.
  - Resolved 2026-11-22 by the owner, with no code change: the audit-log delta now states that the student search is not bound to a period and records `periodo: ""`, `status: active` and only `q` as a present filter, and that a blank term reads and audits nothing. The existing tests (`CI/assign/page.test.tsx`, payload at line 332 and the blank-term case at line 306) already pin both.
- W2. Walk-feedback commit `ab37d5d` has no batch or TDD Cycle Evidence in `apply-progress.md` (no RED record); its tests were added in the same commit. The new `confirmIn="dialog"` mode of the shared `ActiveToggle` has no direct test in `active-toggle.test.tsx`; it is covered only through the inscripciones table tests.
- W3. Writer integrity (lock, scope predicate, rollback, race) is proven on the scripted DB double (SQL render and statement order), not against a real database. This is the risk the proposal accepted (no Neon integration proof). The owner walk exercised the real paths (replace, create, cross-facultad URLs, cancelled student) on a disposable branch, which mitigates but does not replace a concurrency test. This is the evidence limit of "Race with the student".
- W4. `npm run lint` exits 1 in this working copy. Cause 1: the CRLF checkout artifact (156,420 "Delete CR" errors; git normalizes these files). Cause 2 (pre-existing, outside this change): 23 prettier errors in `docs/utils/ocr-spike/*.mjs` and `src/test/access/inventory.ts`, plus 1 unused-import warning in `src/components/app-sidebar.tsx`. Prettier on the changed files fails only for `.engram/manifest.json`, `docs/requirements.md` and `docs/roadmap.md`, which also fail on `main`. No lint or format finding was introduced by this change.
- W5. Owner points not separately confirmed in the walk: the refused reactivation of `walk.est.a.bloqueado` and the student `/enrollment` view after a staff write. Both are covered by automated tests (`inscripciones.test.ts` writable table, `enrollment-write-staff.test.ts` reactivate refusal table, `CI/inscripciones-table.test.tsx` "offers no control on an inactive row that cannot be reactivated", `enrollment.test.ts` line 100, `enrollment-picker.test.ts` line 124). The student-facing reflection is proven by mechanism (only `Inscripcion.Activo` is read), not by an end-to-end run.
- W6. EA-UI-1 "Documents synchronised" has no automated test; the evidence is the static readback done during this verification (and task 6.7). Documents are Spanish by project convention.
- W7. The working copy has an uncommitted change (`tasks.md`, walk record 16.1 to 16.6); the evidence revision covers it. Task 16.7 (delete the walk branch) remains open and owner-owned.

**SUGGESTION**:

- S1. Add a direct `confirmIn="dialog"` test to `src/app/(dashboard)/catalog/active-toggle.test.tsx` and record `ab37d5d` in `apply-progress.md` with its RED evidence.
- S2. Consider a real-database integration test (the repository already has `src/lib/data/integration/*`) for the staff lock and replace under concurrency, run only against a disposable branch with explicit owner confirmation.
- S3. At archive, update the Purpose sentence of `student-enrollment` (staff view or editing listed as out of scope) as the delta header requests (task 17.3), and record the size exceptions and the `ab37d5d` change in `archive-report.md`.
- S4. The RN-27 sentence is always shown in the deactivation dialog (design CS-8 wording) while the spec says it applies when the row is the last active one. The wording is conditional and a superset, so it is compliant; a conditional dialog would need a last-row flag in the list read.

### Verdict

**PASS WITH WARNINGS**

0 CRITICAL, 7 WARNING, 4 SUGGESTION. The full suite (378 files, 9623 tests), typecheck and production build are green. Every scenario of the five spec deltas is covered by a passing test with two evidence limits: a concurrency scenario proven only at DB-double level (W3), and a documents scenario verified by executed readback instead of a test (W6). The lint failures are the CRLF checkout artifact and pre-existing files outside this change. Ready for archive once the owner accepts W1 and the pending closeout tasks run.
