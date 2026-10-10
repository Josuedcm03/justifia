```yaml
schema: gentle-ai.verify-result/v1
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
warning_findings: 6
suggestion_findings: 6
requirements: 57/57
scenarios: 209/209 (requirement-level mapping, spot-checked; see "Sampled versus fully checked")
test_command: npm test
test_exit_code: 0
build_command: npm run build
build_exit_code: 0
typecheck_command: npm run typecheck
typecheck_exit_code: 0
test_output_hash: not computed (output was not captured to a file)
build_output_hash: not computed (output was not captured to a file)
```

## Verification Report

**Change**: catalog-management
**Mode**: Strict TDD (runner: Vitest, `npm test`)
**Repository**: justifia, branch `feat/sidebar-catalogs`, HEAD `d3a3997`; the working tree differs only in `openspec/` files (tasks.md modified, `merge-grupo-into-asignatura/` untracked, this report new).
**Database**: not touched (no SQL, no Neon, no drizzle command, no dev server). Migrations 0005 and 0006 verified from the SQL files, `migration-0005.test.ts`, `migration-0006.test.ts` and the gate records in apply-progress.md.
**Attempt authority**: held by the orchestrator; this executor issued no acquire, settle, reset or rescope. Task 15.8 is NOT ticked by this executor.
**Note on tooling**: this executor had no file-edit tool, so the report was written with a shell heredoc; no source or other artifact was touched.

### Executive Summary

The implementation matches the four delta specs. The full suite passes (99 files, 2347/2347), typecheck and build exit 0, and ESLint reports nothing except the known CRLF prettier noise. All 57 requirements have at least one passing covering test; none is code-only or uncovered. The weaknesses are process and evidence quality, not behaviour: 17 owner checks are waived (not executed), the owner never recorded acceptance of the over-budget review pieces, 13.8-13.11 have no TDD cycle evidence, and several behaviours are proven only by doubles (no real-database or browser proof). **Verdict: PASS WITH WARNINGS (0 CRITICAL, 6 WARNING, 6 SUGGESTION).** Ready for archive after the open owner tasks below are handled.

## Execution Evidence (one heavy command at a time, run in this session)

| Command | Result |
|---|---|
| `npm test` | exit 0; 99 files, 2347 tests: 2347 passed, 0 failed; 41.99 s |
| `npm run typecheck` (`tsc --noEmit`) | exit 0, no output |
| `npm run build` | exit 0; routes include `/catalog/asignaturas`, `/catalog/asignaturas/new`, `/catalog/asignaturas/[id]/edit`, `/catalog/grupos`, `/catalog/grupos/new`, `/catalog/grupos/[id]/edit`, `/catalog/docentes`, `/catalog/import`, `/api/catalog/template` |
| `npm run lint` (`eslint`) | exit 1; 18,321 problems, every one `prettier/prettier` "Delete CR" (CRLF working tree on Windows, pre-existing, same noise as the `catalog-excel-import` report). Filtering those lines leaves 0 other errors and 0 warnings |
| Coverage | not run (no coverage command used by the change) |

The count 2347 equals the figure recorded by the last apply batch (Phase 22.9), so no test was added or lost since.

## Completeness (tasks)

| Metric | Value |
|--------|-------|
| Tasks total | 376 |
| Ticked `[x]` | 370 (17 of them are owner tasks marked WAIVED) |
| Open `[ ]` | 6: 14.10, 14.11, 15.7, 15.8 (this verification), 15.9 (archive), 18.11 |

All six open tasks are owner/orchestrator tasks ([USER] checks, branch housekeeping, this verify, archive). None is a core implementation task, so no CRITICAL. 15.4 is ticked with the owner acceptance (2026-10-08) of the four pre-existing `users/new/*` differences recorded on the task.

## Spec compliance matrix (requirement level)

Status legend: **T** = covered by passing tests; **T+W** = covered by passing tests, plus a browser/visual or owner smoke part that is waived (not executed). No requirement is code-only or uncovered. "n" = scenario count in the spec.

### catalog-management (30 requirements, 102 scenarios): 30/30 T or T+W

| Requirement | n | Evidence (tests) | Status |
|---|---|---|---|
| CM-ACC-1 role matrix | 3 | `auth/permissions.test.ts`, `auth/catalog-access.test.ts`, page tests (anonymous/denied), `app-sidebar.test.tsx` | T |
| CM-ACC-2 authorization before body | 1 | `catalog/guards.test.ts` (every page and actions module discovered), `grupos/new/page.test.tsx` harness (searchParams never awaited when denied, mutation-proved in 19.7) | T |
| CM-SCOPE-1 Carrera scoping | 4 | `catalog/scope.test.ts`, `data/catalog-scope-sql.test.ts`, `data/scope-inventory.test.ts`, `asignaturas.test.ts:289` (missing id and foreign id both null), `asignaturas/[id]/edit/page.test.tsx:236` (same not-found) | T |
| CM-SCOPE-2 coordinacion without Carrera | 2 | `scope.test.ts:28,34`, list/edit page tests (explains a coordinacion without a Carrera) | T |
| CM-SCOPE-3 Carrera of create/edit | 4 | `scope.test.ts:49-69`, `asignaturas.test.ts:578-608` | T |
| CM-ASG-1 fields and validation | 3 | `validations/catalog-fields.test.ts`, `validations/catalog.test.ts`, `asignatura-form.test.tsx` | T |
| CM-ASG-2 Codigo immutable, duplicates refused | 5 | `asignaturas.test.ts:447-538`, `asignaturas/actions.test.ts:263-292` (field error `codigo.taken` / `codigo.takenInactive`; out-of-scope duplicate answers like an active one), `asignaturas.test.ts:659` | T |
| CM-ASG-3 edit | 3 | `asignaturas.test.ts:555-688`, `asignatura-form.test.tsx` | T |
| CM-ASG-4 deactivation | 4 | `asignaturas.test.ts:700-753`, `active-toggle.test.tsx`, edit page test lines 361-392 | T |
| CM-ASG-5 reactivation | 1 | `asignaturas.test.ts:760`, edit page test line 457 | T |
| CM-ASG-6 Codigo comparison | 2 | `asignaturas.test.ts:457,469` (exact equality, mat101 vs MAT101) | T |
| CM-ASG-7 Grupos section (2026-10-08) | 8 | `asignaturas/[id]/edit/page.test.tsx:582-927` (order, scope, cap note, empty states, degraded, link injection, source scan); smoke 20.13 waived | T+W |
| CM-ASG-8 Grupos column (2026-10-09) | 5 | `asignaturas/page.test.tsx:304,339`, `asignaturas.test.ts:228,239` (distinct ordered aggregate, null passthrough); smoke 21.7 waived | T+W |
| CM-GRP-1 fields, validation, duplicates (2026-10-09) | 5 | `data/grupos.test.ts`, `grupos/actions.test.ts:359-366` (`numGrupo.taken` / `takenInactive` as field error), `catalog-parity.test.ts` | T |
| CM-GRP-2 editable fields | 4 | `grupos.test.ts`, `grupos/actions.test.ts` | T |
| CM-GRP-3 deactivation / CM-GRP-4 reactivation | 2 + 2 | `grupos.test.ts`, `grupos/actions.test.ts`, `catalog-structure.test.ts:101` (days kept out of `setGrupoActivo`) | T |
| CM-GRP-5 origin | 2 | `catalog-structure.test.ts:71` (origin never rewritten), `catalog/origen.test.ts`, `grupos.test.ts` | T |
| CM-GRP-6 days in manual flow | 9 | `catalog/dias.test.ts`, `grupo-form.test.tsx`, `grupos/actions.test.ts`, `audit-leak.test.ts:434,449`; smoke 13.13 waived | T+W |
| CM-GRP-7 days in the list | 3 | `grupos/page.test.tsx` (41 tests: short/long spans, week order, muted days-not-set note), `catalog-structure.test.ts:107`; smoke 13.13 waived | T+W |
| CM-GRP-8 preselection (2026-10-08) | 4 | `grupos/new/page.test.tsx:403-465` (valid id handed over, foreign Carrera ignored, remount by key), `grupo-form.test.tsx:281,296`; smoke 19.14 waived | T+W |
| CM-LST-1 lists, filters, search, pagination | 9 | `catalog/list-params.test.ts`, asignaturas/grupos/docentes page tests, `data/asignaturas.test.ts:102-245` | T |
| CM-UX-1 explicit deactivation confirmation | 3 | `active-toggle.test.tsx`; smoke 9.13 waived | T+W |
| CM-NAV-1 sidebar | 2 | `components/app-sidebar.test.tsx` | T |
| CM-I18N-1 both locales | 3 | `i18n/catalog-parity.test.ts` (key sets, placeholders, real translator) | T |
| CM-NFR-1 nothing physically deleted | 1 | `catalog-structure.test.ts:55`, `inscripcion-writes.test.ts`, 15.2 sweep record | T |
| CM-NFR-2 concurrent edits | 1 | `asignaturas.test.ts:615` (diff against the row read inside the transaction); real concurrency not exercised on a database | T |
| CM-NFR-3 accessibility floor | 2 | jsdom ARIA assertions in form, toggle, checkbox-group and page tests; real keyboard, focus ring, 44px targets, contrast and screen-reader behaviour are waived smokes | T+W |
| CM-NFR-4 busy outcome | 3 | `data/catalog-write.test.ts:182-225` (55P03 from cause.code and code maps to CatalogBusyError, no audit), actions tests (busy state), A-6 pre-check answers gone without taking the lock | T |
| CM-AUD-1 audit of manual writes | 2 | `audit-leak.test.ts:401-421`, `catalog-write.test.ts:110-130`, `events.test.ts` | T |

### academic-catalog (10 requirements, 28 scenarios): 10/10 T

| Requirement | n | Evidence | Status |
|---|---|---|---|
| Asignatura lifecycle | 3 | `asignaturas.test.ts`, `schema.test.ts`, `migration-0005.test.ts:38` | T |
| Asignatura Codigo immutable | 1 | `asignaturas.test.ts:659` (never sets codigo or activo) | T |
| Grupo origin marker | 2 | `migration-0005.test.ts:44,50`, `origen.test.ts`, `catalog-structure.test.ts:71` | T |
| Manual writes need active parents | 1 | `grupos.test.ts` (create/update parent checks), `grupos/actions.test.ts` | T |
| Additive schema | 2 | `migration-0005.test.ts` (exactly three statements, purely additive, audit table untouched, journal idx 5, snapshot chain), `schema.test.ts` | T |
| Grupo meeting days (AC-DIAS) | 3 | `catalog/dias.test.ts` (127 mask, bit 0 Monday, round trip over 128 masks), `grupos.test.ts`, `schema.test.ts` | T |
| Additive schema for days (AC-DIAS-ADD) | 2 | `migration-0006.test.ts:38-90` (smallint DEFAULT 0 NOT NULL, CK_Grupo_Dias 0..127, purely additive, journal idx 6, snapshot chain); DG1-DG10 gate records | T |
| Active-only reads (modified) | 6 | `data/catalog.test.ts` | T |
| Asignatura shape (modified) | 4 | `schema.test.ts`, `catalog.test.ts` | T |
| Grupo shape and period (modified) | 4 | `schema.test.ts`, `validations/catalog.test.ts` | T |
| REMOVED: never deactivated | - | n/a; the destructive delta needs the owner confirmation at archive (15.9) | n/a |

### catalog-excel-import (13 requirements, 62 scenarios): 13/13 T

| Requirement | n | Evidence | Status |
|---|---|---|---|
| Import precedence over manual edits | 3 | `import/plan.test.ts`, `import/apply.test.ts` | T |
| Preview reports manual-group deactivations/reactivations | 7 | `plan.test.ts`, `summary.test.ts`, `import-preview.test.tsx` | T |
| Copy for the new preview figures | 1 | `catalog-parity.test.ts`, `import-preview.test.tsx` | T |
| Apply reports busy | 2 | `apply.test.ts:1271` (lock first), `import/actions.test.ts`, `import-form.test.tsx` | T |
| CEI-DIAS-1 optional column | 2 | `sheets.test.ts:45,102`, `parse.test.ts:166-203` (absent vs blank vs raw) | T |
| CEI-DIAS-2 day tokens | 2 | `import/dias.test.ts` (accepted table, NFD accents), `plan.test.ts:1484` (dias.invalid before reference checks), `schemas.test.ts:279` | T |
| CEI-DIAS-3 semantics on apply | 13 | `plan.test.ts:1335-1598` (absent keeps, empty keeps, non-empty replaces, days-only is one update, deactivation keeps days, no dias 0), `apply.test.ts:1124-1271` | T |
| CEI-DIAS-4 template and contract | 3 | `template.test.ts`, `workbook-contract.test.tsx:90`, `api/catalog/template/route.test.ts` | T |
| Per-row validation (modified) | 8 | `schemas.test.ts`, `parse.test.ts`, `import-errors.test.tsx` | T |
| Dry-run persists nothing (modified) | 3 | `import/actions.test.ts`, `audit-leak.test.ts:467` | T |
| Natural-key upserts (modified) | 6 | `apply.test.ts` | T |
| Deactivate absent, never delete (modified) | 5 | `plan.test.ts:1542`, `apply.test.ts` | T |
| Import-level audit (modified) | 7 | `audit/events.test.ts:57-182`, `audit-leak.test.ts:475,496` | T |

### audit-log (4 requirements, 17 scenarios): 4/4 T

| Requirement | n | Evidence | Status |
|---|---|---|---|
| Closed set of manual events | 2 | `audit/types.test.ts:34` (existing codes unchanged, exactly eight new), `events.test.ts:197,469` | T |
| One audit row per write, same transaction | 3 | `catalog-write.test.ts:110-180` (audit last, same handle, nothing on refusal/no-op, audit failure propagates so the data write rolls back) | T |
| Payloads carry field names only | 7 | `events.test.ts:520` (forbidden-key and value sweep over every builder), `audit-leak.test.ts` (sentinel strings through all eight actions, every audit event and console line), `types.test.ts:21` (dias appended, closed list) | T |
| Import audit | 5 | `events.test.ts:57-182`, `audit-leak.test.ts:475` | T |

**Matrix summary: requirements 57/57 covered by passing tests (7 of them also carry a waived browser/owner check); 0 code-only; 0 uncovered. Scenarios 209/209 mapped at requirement level, individually traced only for the sampled areas below.**

## Spot checks of test quality (read, not only listed)

| Area | What I read | Verdict |
|---|---|---|
| Missing equals foreign | `asignaturas.test.ts:289-296`: missing id and foreign-scope id both return null, and the single WHERE carries the CarreraId predicate | asserts the behaviour |
| Write wrapper | `catalog-write.test.ts:75-205`: key 5005001 and 5s pinned; log order SET LOCAL lock_timeout, pg_advisory_xact_lock, work, audit last; audit on the same handle with the session actor id; nothing audited on refusal; sanitised log line without message or values; audit failure rethrown; 55P03 mapped from both cause.code and code | strong |
| Single transaction | `catalog-write.ts:94` is the only db.transaction in the data layer; `guards.test.ts:64` pins it | strong |
| Audit payloads field names only | `audit-leak.test.ts` header and tests: sentinels through all eight actions, serialises every insertAuditEvents argument and console line; `types.test.ts` closed lists; the audit rows 8-17 on rehearsal-0006 carry field names only (orchestrator record) | strong |
| Soft delete only | `catalog-structure.test.ts:55` plus the 15.2 sweep record; I did not repeat the repo-wide search | adequate |
| Days bitmask | `dias.test.ts` titles: 127 = (1 << 7) - 1, Monday bit 0, Sunday bit 6, duplicates collapse, round trip over all 128 masks; `migration-0006.test.ts` pins the CHECK | strong |
| Import Dias rules | `import/dias.test.ts:13-60` (token table, accents); `plan.test.ts` and `apply.test.ts` titles (absent keeps, empty keeps, non-empty replaces, forged dias 0 treated as absent) | strong for the parser; plan/apply bodies not read |
| Amendments 2026-10-08 and 2026-10-09 | `new/page.test.tsx` and `edit/page.test.tsx` titles; `actions.test.ts:263-292, 359-366`; locale keys taken and takenInactive present in both es.json and en.json | covered; forms render the field errors through FormField (22.6 record) |
| Migrations | `drizzle/0005_catalog_management.sql` (3 statements) and `0006_grupo_dias.sql` (2 statements) read; both additive | match the tests and the spec |

## Design conformance

Sampled: the decisions on soft delete, the single write wrapper, the advisory-lock key and timeout, the audit constants, the schema deltas, the days encoding and import rule, amendments A-1..A-16 (read from the closing record and the code lines it cites), and the 2026-10-08 and 2026-10-09 amendments.

| Decision or amendment | Conformance |
|---|---|
| One writer (withCatalogWrite): lock, then work, then audit in the same transaction | conforms (`catalog-write.ts:18-19,42,94,99`) |
| Soft delete only (CM-NFR-1) | conforms (structural tests, no delete call in the data layer) |
| Migrations additive, drizzle-kit push never used | conforms; the db:push script in package.json is pre-existing and unchanged by this change |
| A-4 page size 10 | conforms (`list-params.ts:19`, per record) |
| A-7 23505 backstop | implemented; the driver behaviour after a caught 23505 inside a transaction is not proven (W4) |
| A-8 listCarreraOptions scope applied in TypeScript, not SQL | recorded deviation; behaviour covered by `asignaturas.test.ts:338-355` |
| A-11 and A-14 deviations (import error value placeholder; dias.required vs dias.invalid) | recorded, covered by tests |
| 2026-10-08 Grupos section is a synchronous server component with no actions import | conforms (edit page test line 927 scans the source) |
| 2026-10-09 duplicate refusals as field errors; generic refusals.duplicate keys removed | conforms; the parity test pins the removal |

No design deviation breaks a spec.

## Tasks conformance

Sampled, not exhaustively re-derived: all open and waived tasks; the 15.x closing group; 13.8-13.11 (checked that the sidebar and parity tests exist and pass); the DG1-DG10 and G1-G10 gate summaries in the closing record; the Phase 19-22 batch notes; the counts (376 total, 370 ticked, 6 open) by grep of the checkboxes. No ticked task was found contradicting the code. The tasks.md header still carries historical counts (357 tasks, 313 ticked, 44 open); those are dated statements, not live status (S5).

## TDD evidence quality (strict-tdd verification)

| Check | Result |
|---|---|
| Every batch records TDD cycle evidence or RED/GREEN statements | yes, except 13.8-13.11 (W3) |
| RED reasons are concrete | yes (19.3: 12 failures, listGruposByAsignatura is not a function; 22.2: 20 failures; 6.14: 22 failed of 46) |
| Characterization pins carry a mutation check | yes (15.3: status-filter sha256 recorded, 2 tests failed, restored identical; 19.7 and 20.2 mutation proofs) |
| Harness proofs | the 20.6 mutation proof could not fail when written and was redone after 20.10 (recorded honestly) |
| Copy authored before its parity RED | WU2b-1 authored seven catalog.shared keys early; the 6.14 RED was shown later for the rest. Recorded deviation |
| Test integrity | full suite stable at 99 files, count equals the last recorded batch; assertion edits recorded in Existing assertions modified sections |
| Flaky-test hygiene | import-form focus flakes were fixed owner-side; the suite passed on the first run in this session |
| Coverage and triangulation | no coverage tool run; triangulation present in the sampled areas (days matrix, token table, scope cases) |

## Findings

### CRITICAL (0)

None. No requirement is violated or unproven by a test without a waiver.

### WARNING (6)

- **W1. 17 owner checks waived, not executed.** Tasks 9.12, 9.13, 10.15, 12.13, 13.13, 13.14, 15.6, 17.30, 17.31, 19.14, 19.15, 20.13, 20.14, 21.7, 21.8, 22.10, 22.11 (marked WAIVED in tasks.md, owner decision 2026-10-09; the next change merge-grupo-into-asignatura deletes or rewrites these screens). Browser, accessibility and coordinacion-role behaviour is therefore not exercised. Partial real-database evidence only: `apply-progress.md:1906-1933` (audit events 8-17 on rehearsal-0006, secretaria role only; no coordinacion account, no en locale, no visual checks, no import that changes or keeps stored days).
- **W2. Owner acceptance of the over-budget review pieces was never recorded.** Pieces above 800 lines: Phase 7 list page 926, Phase 9 pages 1,235, Phase 12 refactor and leak sweep about 860, Grupo edit page test 845 (`apply-progress.md:1792,1827`); none has size:exception. Eleven of sixteen units exceeded the upper end of their honest range (about 22,830 lines against a forecast of 11,800-18,650; `apply-progress.md:1791`).
- **W3. No TDD cycle evidence for 13.8-13.11.** The executor stalled and the orchestrator wrote the record from the committed state (`apply-progress.md:1623`). The tests exist and pass (sidebar order test, parity guards), but the RED-first order cannot be shown.
- **W4. Behaviours proven only by doubles, not on a real database or browser** (`apply-progress.md:1835-1841`): COMMIT after a caught 23505 inside a transaction (A-7); a Dias cell replacing, or an empty cell or absent column keeping, stored days on a real group (the owner reports a first real import, no read-back recorded); a multi-row insert mixing rows with and without dias; the coordinacion scope path in a real session; not-found.tsx inside the dashboard layout (6.17); combobox and checkbox behaviour in a browser.
- **W5. Owner decisions still open** (`apply-progress.md:1825-1833`): inactive Asignatura on Grupo edit shows the generic message (item 2); docente combobox shows the name only (item 3); whether the 2026-10-06 production import was intentional (item 4); re-check of the nav.catalogGrupos browser message after a fresh start (item 7).
- **W6. Branch housekeeping (15.7) not done.** rehearsal-0006, backup-before-0006, backup-before-0005 and backup-before-0004-audit still exist per the records; production is unaffected. Owner task, listed under Open.

### SUGGESTION (6)

- **S1.** `npm run lint` exits 1 on every run because of CRLF prettier noise (18,321 lines); a .gitattributes or prettier endOfLine auto setting would let lint serve as a gate. Pre-existing, unrelated to behaviour.
- **S2.** db:push (drizzle-kit push) is still a package.json script (line 17); the project rule forbids using it. Consider removing or guarding it.
- **S3.** If a stricter gate is wanted, trace the 209 scenarios mechanically (scenario name to test name); this report maps at requirement level.
- **S4.** merge-grupo-into-asignatura removes the Grupos screens that CM-GRP-6/7/8 and CM-ASG-7 describe. Archive this change first, then let the next change carry MODIFIED and REMOVED deltas, so the main specs stay accurate.
- **S5.** Refresh the dated counts in the tasks.md header (357/313/44) or label them historical; live status is 376/370/6.
- **S6.** NumeroGrupo is varchar(12), so the Asignaturas Grupos column orders as text (10 before 2) (`apply-progress.md:1889`); acceptable, but worth a conscious owner decision.

## Waived and open owner tasks

**Waived (17, WARNING W1, not executed):** 9.12, 9.13, 10.15, 12.13, 13.13, 13.14, 15.6, 17.30, 17.31, 19.14, 19.15, 20.13, 20.14, 21.7, 21.8, 22.10, 22.11.

**Open (6, not closed by this verification):** 14.10 (read-only smoke by role), 14.11 (checkpoint WU5), 15.7 (branch housekeeping), 15.8 (this verification; the orchestrator records it), 15.9 (archive in order, with the destructive-delta confirmation), 18.11 (checkpoint WU-D3).

## Sampled versus fully checked

- **Fully checked:** the four runtime commands; the task checkbox counts; the open and waived task lists; the two migration SQL files; the closing record and the Phase 19-22 and orchestrator-smoke sections of apply-progress.
- **Read in full or in the cited ranges:** `catalog-write.test.ts:74-210`, `asignaturas.test.ts:286-300`, `audit/types.test.ts`, `import/dias.test.ts:1-60`, `audit-leak.test.ts:1-90`, key lines of `catalog-write.ts`.
- **Cited by test titles only (bodies not read):** scope SQL, grupos data layer, plan and apply days tests, page tests, form tests, parity, sidebar, active-toggle, the events sweep (`events.test.ts:520`). The requirement-to-test mapping for these rests on titles and on the suite passing.
- **Not done:** per-scenario tracing of all 209 scenarios; coverage measurement; any database or browser action.

## Archive readiness

No CRITICAL finding, so verification does not block archive. Before 15.9: the owner closes or accepts the open tasks (14.10, 14.11, 15.7, 18.11) and confirms the REMOVED requirement "Facultad, Carrera and Asignatura are never deactivated" (destructive delta). catalog-excel-import is already archived (`openspec/changes/archive/2026-10-04-catalog-excel-import`), so the archive order is satisfied. Warnings W1-W6 are recorded; none is a blocker. **Ready for archive with warnings.**
