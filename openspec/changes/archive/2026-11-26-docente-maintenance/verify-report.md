```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:3c1682e35fd3f4bc7f47f65efe4d76b29a54da9a63566b5e2ecc5c10fa62fcd4
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 31/31
scenarios: 168/168
test_command: 'DATABASE_URL=postgres://u:p@localhost:5432/x npm test'
test_exit_code: 0
test_output_hash: sha256:d92be63471736ac4167d4b0ea400357e3a9b1995e24365ef388ad691635601bf
build_command: 'DATABASE_URL=postgres://u:p@localhost:5432/x npm run typecheck'
build_exit_code: 0
build_output_hash: sha256:67d1fc6f094cf715091e7d1a2d3052f1850098c09943bd7fa81afbe386e92a94
```

> **Envelope note.** `evidence_revision` is the sha256 of `git diff c5ea22e HEAD -- . ':!openspec/changes/docente-maintenance/verify-report.md'` (the whole change as it is on the tracker tip 9f747d0; c5ea22e is the `origin/main` the change was cut from; the report itself is excluded). The local `main` ref of this worktree is stale (b82b359, an ancestor of c5ea22e), so `git diff main...HEAD` would show 304 files of unrelated work; every diff here uses c5ea22e. `test_output_hash` is the sha256 of the console log of the full `npm test` run executed in this verification (400 files, 10943 tests, exit 0; the log carries timings, so the hash is a record and not a reproducible digest). A focused run over every changed test file, the tests of every changed source file, `route-coverage`, `access-matrix.routes` and `src/test/access` was also made (37 files, 2049 tests, exit 0, log sha256 `4ad1e451b3e16a27e481ec436d20499279721cce34a33d1152503038f29934fd`). `build_output_hash` is the sha256 of `npm run typecheck` as run here after `npx next typegen` (exit 0; the output is the same banner as in earlier reports). Counts are completed/total over the whole change: 31 requirement headings (docente-maintenance 18, audit-log 3, staff-account-creation 3, catalog-management 2, academic-catalog 1, catalog-excel-import 3, imported-account-provisioning 1) and 168 scenario headings (83, 13, 15, 25, 4, 24, 4). **Strict counts: 166 of 168 scenarios and 29 of 31 requirements are covered by a test that passed here, by owner-run integration or system-run evidence at an identical tree, or by a diff check run here. 2 scenarios are PARTIAL (DM-11 "The student offer after a deactivation", DM-17 "Narrow viewport"), listed in W2 and W3.** Envelope convention: the validator rejects a passing verdict whose completed counts are below the totals (probed here with 29/31 and 166/168: "passing verdict contradicts failing or incomplete evidence"), so the envelope counts the 2 PARTIAL scenarios as complete (31/31 and 168/168), the same convention the archived `flow-experience` report used. I rate them WARNING, not CRITICAL, and leave that call to the owner. No database command of any kind was run here; the integration evidence is the owner-run record in `apply-progress.md`.

## Verification Report

**Change**: docente-maintenance (roadmap row 19; RF-12 (a), (b) for docentes; slices 1 to 4, the Postgres suite PR and the evidence PR, all merged into the tracker)
**Branch / HEAD**: `feat/docente-maintenance` @ 9f747d0 (tracker; diff base `origin/main` c5ea22e; `origin/main` as known locally is an ancestor of HEAD, no fetch was made)
**Version**: N/A
**Mode**: Strict TDD (`openspec/config.yaml` `strict_tdd: true`, vitest runner, `npm test`)
**Artifact store**: openspec (repo-local)

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total (`tasks.md`) | 85 |
| Tasks complete | 71 (phases 0 to 5, tasks 0.1 to 5.10) |
| Tasks incomplete | 14: 6.0 to 6.6 and 7.0 to 7.6 |

None of the 14 is implementation work (W1): 6.0 to 6.6 are the merge gate and the production checks (the verification itself is 6.1), 7.0 to 7.6 are the archive steps and the deletion of the Neon branch `docente-it`. Owner-accepted. `git diff 4067564 HEAD` and `git diff 2f2e85b HEAD` over everything except `openspec/`, `docs/` and `.engram/` are empty, so the tree the owner ran the Postgres suite (4067564) and the RF-12 system test (2f2e85b) against is the tree at HEAD.

### Build and Tests Execution

**Typecheck** (`npx next typegen`, then `DATABASE_URL=postgres://u:p@localhost:5432/x npm run typecheck`, run here at 9f747d0): ✅ exit 0, no errors.

**Focused tests** (run here): ✅ 2049 passed, 0 failed, 0 skipped, 37 files.

```text
DATABASE_URL=postgres://u:p@localhost:5432/x npx vitest run <the 27 changed test files, src/app/(dashboard)/catalog/docentes, src/i18n, src/lib/audit, src/app/route-coverage.test.ts, src/app/access-matrix.routes.test.ts, src/test/access, src/components/app-sidebar.test.tsx>
Test Files  37 passed (37)
     Tests  2049 passed (2049)
```

**Full suite** (run here, foreground, `DATABASE_URL=postgres://u:p@localhost:5432/x npm test`): ✅ 400 files, 10943 tests passed, 0 failed, 0 skipped, exit 0, 298 s. Same totals as `apply-progress.md` records for the slice 4 tip and the suite tip.

```text
Test Files  400 passed (400)
     Tests  10943 passed (10943)
```

**ESLint** (`npx eslint --rule '{"prettier/prettier":["error",{"endOfLine":"auto"}]}'` over the 49 added or modified files under `src/` in `git diff c5ea22e HEAD`, tests and the Postgres suite included, run here): ✅ exit 0, no output.

**Integration on real Postgres** (owner-run on the disposable Neon branch `docente-it`, NOT rerun here, hard limit; `apply-progress.md` lines 348 to 358): `docente-maintenance.integration.test.ts` at 4067564: 1 file, 62 of 62 passed (SC-1 to SC-13, including SC-3 with two connections, SC-6 with a real FK failure, SC-7 with the lock queue and SC-10 remission snapshots); the first run at e2d230c failed one case (SC-8) because the suite's own emails clashed with a fixture (test defect, fixed in 4067564 with no assertion changed). Whole integration suite once at 4067564: 14 files, 239 tests, 238 passed, 1 failed: `queue-index` (the plan the database picks on the demo data), the known pre-existing baseline failure of the flow-experience change; `src/lib/data/revision-queue.ts` is not in this diff, so it is not caused by this change. PG-only mutation checks MC-PG-a, MC-PG-b and MC-PG-c were each killed by the named cases (lines 356 to 358). System test RF-12 ST-1 to ST-13 run by the owner on 2026-11-26 at 2f2e85b, all as expected (lines 364 to 384). Applicability: no file outside `openspec/`, `docs/` and `.engram/` differs between 4067564 or 2f2e85b and HEAD.

**Coverage**: ➖ not available (no vitest coverage package in `package.json`); skipped.

**Build** (`npm run build`): ➖ not rerun here (W5); recorded green at the slice 4 tip and by the orchestrator at the suite tip.

### Mutation checks

Not run here: this verification may not modify source files. Recorded evidence, all killed: the per-unit checks MC-1a to MC-10c (`apply-progress.md` tables, each with the failing test names), the orchestrator's extra mutations per slice (6, 9, 10 and 6 further checks in slices 1 to 4, all reverted, all killed) and the three Postgres mutations above.

### TDD Compliance

| Check | Result | Details |
|-------|--------|---------|
| TDD evidence reported | ✅ | "TDD cycle evidence" tables for slices 1 to 4 in `apply-progress.md` (lines 26, 100, 177, 261), one row per unit, each with the failing RED run and its cause, the GREEN command and the mutation checks |
| All tasks have tests | ✅ | Every behavior-changing task (1.1 to 4.6) names its test file and every named file exists and ran here; units 11 (docs) and 12 (Postgres suite) are declared as having no unit RED/GREEN and are proven by readback and by the owner-run suite |
| RED confirmed (tests exist) | ✅ | 27 changed test files plus the integration file exist; RED rows record the failing counts (for example "12 failed, 140 passed", "23 failed, 47 passed", "20 in all"); pass-at-write tests carry revert-only checks |
| GREEN confirmed (tests pass) | ✅ | 37 of 37 focused files and 400 of 400 full-suite files pass here |
| Triangulation adequate | ✅ | Table-driven cases throughout (role table over six identities, ids `abc`/`0`/`-3`/`1.5`/`007`/`1e3`, intents, counts 1/3/4, the nine `docente.inactive` plan cases, SC-4 count rows, SC-7 writer table) |
| Safety net for modified files | ⚠️ | The tables have no Safety net or Triangulation column (Unit, Task, RED, GREEN, MC); existing-case counts appear only inside the RED cells (W6) |

**TDD Compliance**: 5/6 checks passed (one with a format warning)

### Test Layer Distribution

| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Component (jsdom, testing-library) | part of the 2049 focused | 8 of the 27 changed test files (`docente-form`, edit `page`, `docentes-table`, list `page`, `active-toggle`, `app-sidebar`, `import-errors`, `workbook-contract`) | vitest, testing-library |
| Unit, action and data (query doubles, pure functions, structural pins) | part of the 2049 focused | 19 of the 27 changed test files | vitest |
| Integration (real Postgres, owner-run) | 62 | 1 (`docente-maintenance.integration.test.ts`) | vitest integration config, branch `docente-it` |
| E2E | 0 | 0 | none installed; the system test ST-1 to ST-13 is manual and owner-run |

### Changed File Coverage

➖ Coverage analysis skipped: no coverage tool detected.

### Assertion Quality

| File | Line | Assertion | Issue | Severity |
|------|------|-----------|-------|----------|
| `src/app/(dashboard)/catalog/docentes/docentes-table.test.tsx` | 229, 238 | `for (const tr of screen.getAllByRole("row").slice(1)) expect(within(tr).queryAllByRole("link")).toHaveLength(0)` | Loop over body rows with no non-empty guard; it would pass vacuously on a table with only a header. The sibling case at line 257 pins three body rows for the same fixture, and mutation MC-6a (recorded) made these cases fail | SUGGESTION |

No tautology, no assertion without a production call, no `.only`, `.skip`, `.todo`, `debugger` or `console.*` in the changed test files. The five `toBeTruthy`, `toBeDefined` and `not.toBeNull` hits are each followed by a value assertion on the same subject. The `toEqual([])` and `toHaveLength(0)` hits are absence assertions with a companion presence case (for example "no audit row" for a refusal next to "exactly one row" for a success; no link in a read-only table next to one link per row with `canEdit`). The mock-to-assertion ratio is low everywhere (`docentes/actions.test.ts` 8 mocks for 139 expects, `[id]/edit/page.test.tsx` 9 for 99, `users/new/actions.test.ts` 8 for 104, `docente-access.test.ts` 6 for 19, the data and form tests 1 to 2 mocks); the action tests double the data layer on purpose and are backed by the Postgres suite.

**Assertion quality**: 0 CRITICAL, 0 WARNING, 1 SUGGESTION

### Quality Metrics

**Linter**: ✅ no errors on the 49 changed `src` files (exit 0).
**Type Checker**: ✅ no errors.

### Spec Compliance Matrix

Evidence keys. Paths are relative to the repository root; `C/` is `src/app/(dashboard)/catalog/`, `D/` is `src/app/(dashboard)/catalog/docentes/`. Test files: DA `src/lib/data/docentes.test.ts`, ACT `D/actions.test.ts`, FRM `D/docente-form.test.tsx`, EP `D/[id]/edit/page.test.tsx`, TBL `D/docentes-table.test.tsx`, LP `D/page.test.tsx`, PH `D/phone-exposure.test.ts`, DAC `src/lib/auth/docente-access.test.ts`, PERM `src/lib/auth/permissions.test.ts`, VAL `src/lib/validations/docente.test.ts` and `catalog.test.ts`, EVT `src/lib/audit/events.test.ts`, TYP `src/lib/audit/types.test.ts`, AH `src/lib/catalog/action-helpers.test.ts`, AL `C/audit-leak.test.ts`, GRD `C/guards.test.ts`, PAR `src/i18n/catalog-parity.test.ts`, MX `src/test/access` with `src/app/access-matrix.routes.test.ts` and `src/app/route-coverage.test.ts`, SB `src/components/app-sidebar.test.tsx`, AT `C/active-toggle.test.tsx`, US `src/lib/data/users.test.ts`, NSA `src/app/(dashboard)/users/new/actions.test.ts`, RA `src/app/(auth)/register/actions.test.ts`, PL `src/lib/import/plan.test.ts`, IE `C/import/import-errors.test.tsx`, WC `C/import/workbook-contract.test.tsx`. IT-n is case SC-n of `src/lib/data/integration/docente-maintenance.integration.test.ts` (owner-run, 62 of 62 at 4067564); ST-n is the owner-run system test step (2f2e85b). "X" marks an existing test the change did not edit, still green in the full run, covering unchanged behavior the scenario relies on. Statuses: ✅ COMPLIANT (a covering test passed here), ✅o COMPLIANT on owner-run Postgres or system-run evidence at an identical tree (not rerun here), ✅d verified by a diff or source scan executed here (no test pins it), ⚠️ PARTIAL.

#### docente-maintenance (DM-1 to DM-18): 83 scenarios

| Req | Scenarios (count) | Code | Test | Result |
|---|---|---|---|---|
| DM-1 | Role matrix; denied caller's body and data never touched; forced password change first; predicate follows the hierarchy; any secretaria, any facultad; menu unchanged; access matrix covers every entry point (7) | `src/lib/auth/permissions.ts:80,85`, `src/lib/auth/docente-access.ts`, `D/actions.ts:57,122`, `D/[id]/edit/page.tsx` | DAC "covers every role: only the derived list is admitted", "sends a secretaria who must change her password to /change-password", "admits a secretaria without a facultad", "source: requireRole is the first await"; ACT "a coordinacion with a valid form is denied and writes no row (DM-1)"; PERM "equals canAssignRole(rol, 'docente') for the five roles", "no source file ... restates a role"; EP access group; SB "shows the same items on a docente edit page as on the list"; MX rows for the edit page and the actions module; GRD "chooses the guard by path" | ✅ ×7 |
| DM-2 | Which ids resolve (table); no oracle; hand-crafted action on another role; page receives only its fields (4) | `src/lib/data/docentes.ts:33`, `src/lib/catalog/action-helpers.ts` | DA getDocenteById group (role in the WHERE, six fields); AH addressedRecord group; ACT "another role's id and a missing id are the identical gone, without the lock"; EP not-found group and "serializes the id, name, email, phone, state and grupo count, and nothing else"; IT-5 | ✅ ×4 |
| DM-3 | Invalid values (table); boundaries and normalisation (table); only three fields editable; errors together and values kept; email-less docente (5) | `src/lib/validations/docente.ts`, `D/actions.ts:77` | VAL (trim, lower case, strip of the editable-field whitelist, all errors together); ACT "mass assignment: login, hashClave, rol, activo, cif, carreraId, facultadId and debeCambiarClave never reach the data layer", "reports every invalid field at once", "hands the data layer the normalised values"; DA "an empty phone over no phone is not a change", "a docente with no stored email needs the lookup when it gets one"; FRM "keeps every typed value after an invalid answer", "shows a docente without email or phone as empty fields"; IT-1 | ✅ ×5 |
| DM-4 | Who blocks the email (table); own email not a duplicate; mixed-case legacy row [PG]; re-saving own mixed-case email [PG]; concurrent writers [PG]; generic message (6) | `src/lib/data/docentes.ts:92` (lookup 111 to 123, savepoint 127 to 141) | DA "looks the email up by lower-case equality, excluding the account itself, with no role or state filter", "maps a 23505 raised inside the savepoint to correo_taken"; ACT "correo_taken: one generic field error on correo, naming no account, role or state; no audit row"; IT-2 (student, staff, inactive, legacy case pair, own mixed-case email), IT-3 (two connections; edit versus staff creation) | ✅ ×3, ✅o ×3 |
| DM-5 | Everything but three fields untouched [PG]; new email signs in, old one does not [PG]; Users list keeps the stored login [PG]; a live session survives the edit (4) | `src/lib/data/docentes.ts:124 to 141` (SET holds only changed editable fields) | DA "never puts the login, the hash, the role, the state or the password flag in the SET"; IT-1 (Login and HashClave byte-identical, `findLoginAccount` finds the new email); ST-3, ST-4 (new email signs in, old one fails generically, Users still shows the old Login, session survives) | ✅o ×4 (the live-session scenario has no automated test, W4) |
| DM-6 | Successful edit; no-change submit; inactive read-only; edit of an inactive docente refused; docente vanishes (5) | `src/lib/data/docentes.ts:97 to 110`, `D/actions.ts:97 to 114`, `D/docente-form.tsx` | DA "refuses an inactive docente, with no other statement", "answers unchanged when no editable field differs, with no lookup and no write"; ACT "unchanged: told as unchanged, no revalidate, no redirect, no audit row", "an inactive docente is refused as inactive (reactivate it first), nothing written", "re-validation inside the transaction: a docente gone by then is the identical gone"; FRM inactive group; EP inactive group; IT-1 | ✅ ×5 |
| DM-7 | GET never mutates; confirmation names the docente; cancel leaves the record; deactivation with no active grupo; touches nothing else [PG]; intent is closed (table); already inactive; sign-in after deactivation (8) | `src/lib/data/docentes.ts:151`, `D/actions.ts:122 to 168`, `D/bound-controls.tsx` | ACT "is a Server Action module: POST-only entry points" and the `it.each` "an unknown intent (%s) answers gone and writes nothing" (includes `DEACTIVATE`); EP "opening writes no audit row and calls neither action: a GET changes no record"; FRM "names the docente with the email in parentheses, deletes nothing, keeps grupos and remissions and shows the count", "cancel changes nothing, writes nothing and returns the focus to the first step"; DA "the module writes only Usuario"; IT-4 (nothing else touched), ST-7 (list filter and generic sign-in failure; refusing an inactive account at sign-in is existing login behavior) | ✅ ×6, ✅o ×2 |
| DM-8 | Count of active grupos (table); refusal message actionable (table); a refusal changes nothing [PG]; reassign, then deactivate [PG]; deactivate the grupos, then the docente [PG] (5) | `src/lib/data/docentes.ts:159 to 165`, `D/actions.ts:163`, `i18n/{es,en}.json` | DA "deactivation counts the active grupos of any period and any asignatura state, then updates", "active grupos refuse with their count and no UPDATE"; PAR plural wording for counts 1 and 3 in both locales with both remedies and the closed-period hint (`src/i18n/catalog-parity.test.ts:1222`, `:1230`, `:2220`, `:2226`); IT-4 (the seven count rows, reassign, deactivate-first), ST-5, ST-6 | ✅ ×1, ✅o ×4 |
| DM-9 | Reactivate; already active; sign-in after reactivation [PG]; a grupo can then be reactivated [PG] (4) | `src/lib/data/docentes.ts:166 to 173` | DA "reactivation runs no count, sets only Activo and carries the role in the WHERE"; FRM "an inactive docente is reactivated in one press, with no confirmation", "says the docente was already active after a reactivate that changed nothing"; IT-4 ("reactivation reactivates no grupo", grupo reactivation after the docente), ST-10 | ✅ ×2, ✅o ×2 |
| DM-10 | Deactivation versus a grupo write, both orders (table) [PG]; concurrent run [PG]; import confirm after a deactivation [PG]; deactivation after an import [PG]; two edits [PG]; two deactivations [PG]; busy per operation (table) [PG]; busy does not bypass authorization (8) | `src/lib/data/catalog-write.ts` (existing lock), `D/actions.ts` | ACT "busy does not bypass the guard" (both actions), "busy: a lock timeout is `busy`, not `error`"; IT-7 (six writer rows in both orders, many rounds, two edits, two deactivations, busy per operation), IT-9 (confirm after a deactivation rejected, counts unchanged), ST-13 (deactivation after an import refused with count 1) | ✅ ×1, ✅o ×7 |
| DM-11 | Grupo options exclude the inactive docente; hand-crafted selection refused; the student offer after a deactivation [PG]; existing records keep the name; a grupo under an inactive docente is not repaired (5) | `src/lib/data/users.ts:419` (options, active only), grupo write guards (existing) | US "keeps only active users whose role code is docente" (X); `src/lib/data/grupos.test.ts` and `C/grupos/actions.test.ts` `docente_unavailable` cases (X); IT-13 (staff detail and teachers ranking show the live name after rename and deactivation); `git diff c5ea22e HEAD -- drizzle src/db` empty and DA "the module writes only Usuario" for the unrepaired grupo; ST-8 | ✅ ×2, ✅o ×1, ✅d ×1, ⚠️ PARTIAL ×1: the student offer was exercised through the enrollment offer only; the new-request page did not load in the run (W2) |
| DM-12 | Email edit leaves the snapshot [PG]; next approval uses the new data [PG]; deactivation does not stop a pending remission [PG] (3) | none changed (the remission writer is untouched) | IT-10a (R1 keeps the old `Correo` and `DocenteNombre`, R2 goes to the new email), IT-10b (dispatch sends to the snapshot address after the grupo and the docente are deactivated) | ✅o ×3 |
| DM-13 | Inactive docente: grupo row refused, name still updated [PG]; import wins over a manual name and phone [PG]; old email in a workbook [PG]; new email matches the account [PG]; old email on the creation form [PG] (5) | `src/lib/import/plan.ts:391`, `src/lib/data/users.ts:602` | PL inactive-docente block (create, update, reactivate and unchanged rows all `docente.inactive`; the Docentes row counts `update`; never writes `activo`); IT-9 (planned only: inactive docente, `login.collision` for the old email, `unchanged` for the new one); NSA "a derived Login already in use (unique violation): the ordinary duplicate error, no redirect and no failure line"; IT-8 "a Login equal to a former email refuses the insert"; ST-4, ST-9, ST-13 (apply with effect: name and phone updated, state unchanged) | ✅o ×5 |
| DM-14 | One row per write (table) [PG]; writes that must leave no row (table) [PG]; the audit insert fails [PG]; opening the edit page writes nothing (4) | `src/lib/audit/events.ts:903` (`docenteWriteEvents`), `src/lib/data/catalog-write.ts` | EVT "gives one event per success and [] per refusal and no-op"; ACT "updated: one manual event of field names in the same transaction, after the write", "an audit failure rejects the whole write: generic error, nothing revalidated"; EP "opening writes no audit row"; IT-1, IT-4, IT-6 (real FK failure leaves the docente unchanged), ST-12 | ✅ ×1, ✅o ×3 |
| DM-15 | Sentinel values never reach the audit log or logs [PG]; the phone appears only on the edit page (2) | `src/lib/audit/events.ts`, `D/actions.ts` | AL (`updateDocenteAction` and `setDocenteActivoAction` leak nothing; the failure line carries actor, error name and SQLSTATE); PH "the Docentes list delivers its four fields without the phone", "under the docentes screens only the edit page, its form and its action carry the phone"; EP "serializes the id, name, email, phone, state and grupo count, and nothing else"; IT-11 (every payload and logged line searched for six sentinels, `HashClave` and a bcrypt pattern), ST-12 | ✅ ×1, ✅o ×1 |
| DM-16 | Key parity; refusals are actionable (table); the three notices are on the edit page (3) | `i18n/es.json`, `i18n/en.json` | PAR (identical key sets, the refusal table in both locales, wording pins for `errors.activeGrupos`, `state.alreadyActive`, `state.alreadyInactive`, `correo.taken`); FRM "carries the three notices: where remissions go, the earlier login, and import wins (DM-16)", "says in the notices what the spec asks"; EP "renders the prefilled form with the three notices" | ✅ ×3 |
| DM-17 | State is text; heading structure and errors; narrow viewport (3) | `D/docente-form.tsx`, `D/[id]/edit/page.tsx`, `D/docentes-table.tsx` | TBL "keeps the state as a word in every row"; EP "has one h1 and no skipped heading level"; FRM "shows every error at once, each tied to its field and announced"; narrow width: FRM "is one column capped at max-w-xl, with a wrapping action row", "lets a long name and email break inside the confirmation", EP "keeps every block inside the max-w-xl column"; the 360 px capture `RF-12_a_edit.png` | ✅ ×2, ⚠️ PARTIAL ×1: class guards in jsdom and one owner capture at 360 px; the 320 px "nothing clipped" check is not recorded as observed (W3) |
| DM-18 | Row counts never fall [PG]; no schema change (2) | none (no migration) | IT-12 (row count of every table no lower after the whole sequence); `git diff c5ea22e HEAD --stat -- drizzle package.json src/db vercel.json` empty and no file outside `src`, `i18n`, `docs`, `openspec`, `.engram` changed (run here); DA "the module writes only Usuario: no DELETE, no TRUNCATE" and a source scan here found none in `docentes.ts` and `D/actions.ts` | ✅o ×1, ✅d ×1 |

**docente-maintenance**: 81 of 83 scenarios compliant, 2 PARTIAL.

#### audit-log (DM-AUD-1 to DM-AUD-3): 13 scenarios

| Req | Scenarios (count) | Test | Result |
|---|---|---|---|
| DM-AUD-1 | Action to entity type (table); the set is exactly the old set plus two; import events unaffected [PG] (3) | TYP "registers the two docente toggle actions once each, under the Usuario entity" and the closed list pin; EVT `accountActiveChangedEvent` group, "the import payload keeps its four keys, equal key by key"; ST-13 (import rows keep origin `importacion` and the digest) | ✅ ×2, ✅o ×1 |
| DM-AUD-2 | Successful writes (table) [PG]; writes that must leave no row (table) [PG]; actor from the session; audit failure rolls back [PG] (4) | EVT `docenteWriteEvents` group; ACT and NSA "the actor is the session user, never a value of the body"; IT-1, IT-4, IT-6, IT-8; ST-12 | ✅ ×1, ✅o ×3 |
| DM-AUD-3 | Update lists names, not values; clearing a phone is a change of `telefono`; toggle payloads carry no value; created account payload is names only [PG]; payload-leak check [PG]; import payload keeps its shape (6) | EVT "a manual edit names the fields and the role, with the manual origin and no digest", "a cleared phone is reported as the field telefono, with no value", "every payload is the three keys campos, rol and origen"; US "puts no value of the account in the audit row"; IT-8, IT-11; EVT import payload case | ✅ ×4, ✅o ×2 |

**audit-log**: 13 of 13 scenarios compliant.

#### staff-account-creation (SR-16, FE-27, SAC-AUD-1): 15 scenarios

| Req | Scenarios (count) | Test | Result |
|---|---|---|---|
| SR-16 | Coordinator creates a secretaria in their facultad; forged facultad ignored; coordinator without a career refused; other roles get no facultad (4) | NSA "a coordinacion caller without a career creating a secretaria" (no row, ordinary error, no redirect) and the existing facultad cases (X, assertions kept); IT-8 (`facultadId` listed in the creation row) | ✅ ×4 |
| FE-27 | The form has no Usuario field; Login derived from the email; posted login ignored; derived Login collision; existing logins untouched (5) | NSA "keeps every check in its order and creates last", "a derived Login already in use (unique violation): the ordinary duplicate error, no redirect and no failure line" and the existing Login cases (X); IT-8 | ✅ ×5 |
| SAC-AUD-1 | One row per created role (table) [PG]; audit insert failure creates no account [PG]; refusals write no row (table) [PG]; concurrent creations of one email [PG]; the row holds no value; student self-registration unchanged (6) | US `createStaffUsuario` group ("resolves the role before the transaction, inserts the account, then audits as the last statement", "rejects when the audit insert fails, so the transaction rolls the account back", "puts no value of the account in the audit row"); NSA "a refusal writes no account and no audit row" group, "hands the session user to createStaffUsuario as the actor"; RA "is not audited (A8): it creates through createUsuario and writes no audit row"; IT-8 (one row per role), IT-6 (FK failure leaves no account), IT-3b (edit versus creation of one email: one commit); ST-2 | ✅ ×3, ✅o ×3 |

**staff-account-creation**: 15 of 15 scenarios compliant.

#### catalog-management (CM-ACC-1, CM-LST-1): 25 scenarios

| Req | Scenarios (count) | Test | Result |
|---|---|---|---|
| CM-ACC-1 | Role matrix (table); denial destinations; forced password change first; coordinacion can list but not maintain (4) | MX; DAC; LP "gives administrador exactly the three data columns and no edit entry", coordinacion twin; EP access group (the coordinacion edit page redirects to `/denied` with no data read); the existing catalog denial cases (X) | ✅ ×4 |
| CM-LST-1 | Default shows active only; filter (table); search; pagination clamps; empty states; docentes list is read-only and unscoped; secretaria sees the actions column; unrecognised status falls back; docentes list carries no credential; docentes list shows no login; database unavailable; sortable columns (table); unsortable and unknown sort fall back (table); collation, empty emails and status order; footer omitted; stable across pages; page size options (table); first and last navigation; reset to page 1; sort and size never widen the Carrera scope; degraded read keeps the notice (21) | LP "gives the secretaria four columns and an Edit link in every row, active or inactive", "delivers no login, phone, hash or Cif to the browser, even with the column on", "renders and passes on no credential field, even if the data layer returned them", "keeps the guard first and passes canEdit from the derived predicate, never a role list", states group; TBL "canEdit adds a fourth, last, non-sortable actions column", "holds one Edit link per row, active or inactive, named after the docente", sorting group; PH; the Asignaturas and list-parameter scenarios are unchanged behavior covered by their existing tests (X) in the full run | ✅ ×21 |

**catalog-management**: 25 of 25 scenarios compliant.

#### academic-catalog (AC-MW): 4 scenarios

| Req | Scenarios (count) | Test | Result |
|---|---|---|---|
| Manual writes require an active Asignatura and an active docente | Inactive parents are refused (table); a docente with an active grupo cannot be deactivated [PG]; the import does not reactivate and does not accept an inactive docente [PG]; the invariant holds after any order of writers [PG] (4) | `src/lib/data/grupos.test.ts` and `C/grupos/actions.test.ts` (X, `docente_unavailable`); DA active-grupo cases; PL inactive-docente block; IT-4, IT-7 (both orders, many rounds), IT-9 | ✅ ×1, ✅o ×3 |

**academic-catalog**: 4 of 4 scenarios compliant.

#### catalog-excel-import (CEI-VAL, CEI-UPS, CEI-UI): 24 scenarios

| Req | Scenarios (count) | Test | Result |
|---|---|---|---|
| Per-row validation | The eight existing scenarios (invalid rows, `HorasTotales`, unresolvable reference, inactive Asignatura outside and inside the workbook, role integrity, duplicate key, cross-sheet references) (X); Grupos row naming an inactive docente is a row error; listing the inactive docente in the Docentes sheet does not help; an unchanged grupo under an inactive docente is also an error; active and same-workbook docentes are unaffected; docente reactivated before the import (13) | PL inactive-docente block: "a row that would create a grupo is a docente.inactive error naming the email of the row, with no write", "listing the inactive docente in the Docentes sheet does not help ...", "a docente created by the same workbook is not an error, and neither is an active docente of the database", "a docente reactivated before the import resolves normally", "is checked right after the docente is resolved and before the duplicate key"; IT-9 | ✅ ×13 |
| Natural-key upserts | The six existing scenarios (create, update, reassignment, Asignatura reactivation, grupos not reactivated, manual origin) (X); an inactive docente stays inactive [PG]; an inactive docente still gets its name and phone [PG] (8) | PL "never reactivates the docente: no usuario write names the state, whether the row changes data or not"; ST-13 (C updated and still inactive, no credential exported) | ✅ ×6, ✅o ×2 |
| Import UI flow and copy | Locales; contract shown before upload; inactive docente message is actionable (3) | IE "a docente.inactive row error names the email, says the docente is inactive, that the import does not reactivate it, and both remedies, in %s (CEI-UI)"; WC (`CorreoDocente` rule says active docente); PAR `ROW_REASONS` | ✅ ×3 |

**catalog-excel-import**: 24 of 24 scenarios compliant.

#### imported-account-provisioning (IAP-KEEP): 4 scenarios

| Req | Scenarios (count) | Test | Result |
|---|---|---|---|
| Existing accounts keep their credentials | Re-import does not reset a password; changed name on an existing account (X, existing plan cases); an inactive account is updated but not reactivated [PG]; an active account stays active [PG] (4) | PL "never reactivates the docente" and the existing credentials cases; ST-13 (A active and unchanged in email and state, C inactive and updated, import rows origin `importacion`) | ✅ ×2, ✅o ×2 |

**imported-account-provisioning**: 4 of 4 scenarios compliant.

**Compliance summary**: 166 of 168 scenarios compliant: 112 by tests that passed here (the existing tests marked X included), 52 by owner-run Postgres or system-run evidence at an identical tree, 2 by diff or source checks run here; 2 PARTIAL, 0 FAILING, 0 UNTESTED.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| DM-1, CM-ACC-1 | ✅ Implemented | `canManageDocentes` is `canAssignRole(rol, "docente")` (`permissions.ts:80`); `requireDocenteAccess` awaits `requireRole` first and reads nothing (`docente-access.ts:22`); both actions call it before any form read |
| DM-2 | ✅ Implemented | `getDocenteById` joins `Rol` with `Codigo = 'docente'` and projects six fields; `addressedRecord` gives one `gone` for malformed, missing and foreign ids |
| DM-3, DM-4, DM-5, DM-6 | ✅ Implemented | `updateDocente`: scoped read, `changedFields`, lookup only when `correo` changed (`lower(Correo)`, `Id <> id`, no role or state filter), savepoint with `23505` to `correo_taken`, SET limited to changed editable fields, `RolId` repeated in the WHERE |
| DM-7, DM-8, DM-9 | ✅ Implemented | Closed intent; count of active Grupo of any period and Asignatura state under the same handle; reactivation has no precondition and touches only `Usuario`; confirmation, refusal and "already" texts in both catalogs |
| DM-10 | ✅ Implemented | Both actions go through `withCatalogWrite` (lock, transaction, audit, busy mapping) |
| DM-11, DM-12 | ✅ Implemented | Options reader keeps `activo = true`; no code in this change writes `remision`, `Inscripcion`, `SolicitudAsignatura` or `Grupo` |
| DM-13, CEI-VAL, CEI-UPS, IAP-KEEP, AC-MW | ✅ Implemented | `plan.ts:391` refuses a Grupos row naming an inactive docente (after `docente.unresolved`, before the duplicate key), `DocenteIdentity.activo` carried from Stage B and the Stage C fallback; `apply.ts` untouched; Stage B never writes `activo` |
| DM-14, DM-AUD-1 to DM-AUD-3 | ✅ Implemented | `usuario.desactivado` and `usuario.reactivado` added (`types.ts:71`), `accountActiveChangedEvent` (`events.ts:114`), `docenteWriteEvents` (`events.ts:903`), `origin` on the account builders, payloads of field names only |
| SAC-AUD-1, SR-16, FE-27 | ✅ Implemented | `createStaffUsuario` (`users.ts:602`): role lookup before the transaction, shared `insertUsuario`, audit insert last; the action passes `Number(session.sub)` and logs a sanitised line for non-`23505` failures; `createUsuario` kept for self-registration |
| DM-15 | ✅ Implemented | The phone is read only by `getDocenteById` and the edit page; list, options and Users readers do not select it |
| DM-16, DM-17 | ✅ Implemented | Keys in `es` and `en` with parity; notices, `role="alert"` errors, one `h1`, 44 px targets, `max-w-xl` single column |
| DM-18 | ✅ Implemented | No `DELETE`, `TRUNCATE` or write to another table in `docentes.ts`; no change under `drizzle/`, `src/db`, `package.json`, `package-lock.json` or `vercel.json` |
| CM-LST-1 | ✅ Implemented | `canEdit` (default false) appends the last non-sortable `actions` column with `Editar {nombre}` links; the list page passes the derived predicate |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| A1 `requireDocenteAccess`, no read, no scope | ✅ Yes | |
| A2 `addressedRecord`, `addressed` as wrapper | ✅ Yes | the six existing callers keep their tests unedited |
| A3 `src/lib/data/docentes.ts` | ✅ Yes | |
| A4 savepoint around the email UPDATE | ✅ Yes | proven on Postgres by IT-3 and by MC-PG-a (killed) |
| A5 two new codes | ✅ Yes | |
| A6 `UserChangedPayload` with `AuditOrigin` | ✅ Yes | import payload equal key by key |
| A7 `createStaffUsuario` | ✅ Yes | |
| A8 self-registration not audited | ✅ Yes | pinned in `register/actions.test.ts` |
| A9 D5 takes no catalog lock | ✅ Yes | |
| A10 inline confirmation | ✅ Yes | `confirmIn` default is `inline` |
| A11 Edit link in the list, toggle on the edit page | ✅ Yes | |
| A12 no session invalidation | ✅ Yes | recorded residual |
| D1 to D5 (proposal) | ✅ Yes | secretaria only; refusal with active grupos; import never reactivates and refuses inactive docentes; field names only; audited staff creation |
| File Changes table | ⚠️ Partly | `C/active-toggle.tsx` (optional `unchangedText` prop and `break-words`) and `D/phone-exposure.test.ts` are not in the design's list; `EditDocenteForm` keys itself by `activo` instead of the page. All three are recorded as deviations in `apply-progress.md` (slice 3, deviations 1, 3, 5, 9) and pinned by tests (W7) |

### Issues Found

**CRITICAL**: None.

**WARNING**:

- **W1. 14 tasks are open (6.0 to 6.6, 7.0 to 7.6).** None is implementation: the merge gate (tracker contents, this verification, the production grupo count on the day of the merge, the owner's yes, the smoke test, the rollback note), the roadmap state, the spec sync, the archive, the tag and the deletion of the Neon branch `docente-it`. Read strictly, the skill counts any unchecked task as CRITICAL; they are recorded as WARNING because they are owner-gated post-verification steps, the same call as in the archived `flow-experience` report. The merge gate stays closed until 6.3 (production count 0 on the day) and 6.4 (the owner's yes) are done; the early read-only check of 2026-11-25 gave 0.
- **W2. DM-11 "The student offer after a deactivation [PG]" is PARTIAL.** `apply-progress.md:377` (ST-8): the new-request page showed "No pudimos cargar tu borrador" because the server ran without the Blob key on purpose, so the offer for a new request was not observed; the enrollment offer and the grupo create and edit forms were. No automated test builds the student readers against a deactivated docente. The risk is bounded by DM-8, proven on Postgres (IT-4, IT-7): a docente with an active grupo cannot be deactivated, so no class of a deactivated docente is active.
- **W3. DM-17 "Narrow viewport" is PARTIAL.** The 360 px and 320 px rules rest on class guards in jsdom (`src/app/(dashboard)/catalog/docentes/docente-form.test.tsx:479`, `:762`, the structure group of `[id]/edit/page.test.tsx`) and one owner capture at 360 px (`apply-progress.md:372`, the edit page of another fictitious docente). The expected "nothing clipped at 320 px" is not recorded as observed. A long unbroken name that no guard class covers would not be caught.
- **W4. Three owner-run steps were run in part.** (a) DM-5 "A live session survives the edit" is not marked [PG] and has no automated test; its only evidence is ST-3 and ST-4 (`apply-progress.md:372`, `:373`). (b) ST-3 did not change the name in the run, so its audit row lists `correo` and `telefono` only; the three-field case is covered by IT-1 and `events.test.ts`. (c) ST-11 did not replay the POST requests with another role's session (`apply-progress.md:380`); the real-guard unit tests of slice 2 run the guard for every identity and the access matrix covers both modules.
- **W5. `npm run build` was not rerun here.** The execution rules of this verification named tests, typecheck and ESLint. The build is recorded green at the slice 4 tip (1129f15) and by the orchestrator at the suite tip, and no non-documentation file changed since 4067564; gate 6.1 still lists it, and the Vercel build on the merge is the next check.
- **W6. The TDD evidence tables have no Safety net or Triangulation column** (`apply-progress.md:28`, `:102`, `:179`, `:263`: Unit, Task, RED, GREEN, MC). The existing-case counts are inside the RED cells and the triangulation is visible in the table-driven tests, so the evidence exists, but not in the protocol's columns.
- **W7. Design deviations** (recorded in `apply-progress.md`, slice 3 deviations 1, 3, 5, 9): the shared `ActiveToggle` gained an optional `unchangedText` prop and a `break-words` class (`src/app/(dashboard)/catalog/active-toggle.tsx`), a file the design's File Changes table does not list, to give the DM-16 "already active" and "already inactive" texts without touching the Asignatura and Grupo toggles (their tests are unedited and pass); `EditDocenteForm` carries the `key` of `activo` itself; `phone-exposure.test.ts` was added for the phone pin of task 3.8. No spec requirement is broken by any of them.

**SUGGESTION**:

- **S1.** `src/app/(dashboard)/catalog/docentes/docentes-table.test.tsx:229` and `:238`: assert the body rows are non-empty before the loops so neither can pass on a header-only table.
- **S2.** No automated pin states "no schema change" (DM-18) or "no grupo repaired" (DM-11); both were verified here by `git diff c5ea22e HEAD` over `drizzle`, `src/db`, `package.json` and `vercel.json` (empty) and by the source scan of `docentes.ts`. A ratchet test over the migration count would keep it checked.
- **S3.** `docs/roadmap.md` and `docs/requirements.md` are recorded as failing `prettier --check` for an alignment that already fails on `main` (`apply-progress.md`, slice 4 deviation 6); not rerun here.
- **S4.** Local `main` in this worktree points at b82b359, older than the real base c5ea22e, so a `git diff main...HEAD` shows unrelated files; fetch and fast-forward `main` before the next change is measured against it.

Accepted by the owner and not findings: reactivation has no confirmation step by design (DM-9; the instruction given for ST-10 was wrong, not the product); the inactive docente's edit page shows the generic refusal and the reactivate hint one under the other, the same pair as the grupo edit page (`apply-progress.md:384`); the live session of a deactivated docente is not revoked (A12); the real mail sender is not exercised by the suite, only the fakes; `queue-index` fails on Postgres on the demo data before and after this change.

### Verdict

PASS WITH WARNINGS

No CRITICAL finding: 31 requirements implemented, 166 of 168 scenarios covered by tests that passed here, by owner-run Postgres and system-run evidence at an identical tree, or by diff checks run here, 2 PARTIAL (W2, W3), 0 failing; typecheck, ESLint on 49 files, the focused run (2049 tests) and the full suite (400 files, 10943 tests) are green; the owner-run suite is 62 of 62 and the full integration run 238 of 239 with the known `queue-index` baseline failure. The 14 open tasks are the merge gate and the archive. What remains before the merge to `main` is task 6.3 (production count 0 on the day), the owner's explicit yes (6.4), and the accepted residuals W2, W3 and W4.
