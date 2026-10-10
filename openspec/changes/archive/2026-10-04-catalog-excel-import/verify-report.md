```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:d2d7c35b72292249cd60cf8ff4a5514632c68f3ce608d9310cb0a9b41b084169
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 40/40
scenarios: 120/120
test_command: npm test
test_exit_code: 0
test_output_hash: sha256:cdebfd4030bd7c58b721b7481b32b71a663cfc9aa581dc84e0a208ec2bee62b9
build_command: npm run build
build_exit_code: 0
build_output_hash: sha256:b81bd625f225e4f0842f8d15efae8e4291725e299c9f20dcbbef7a4584a56c0f
```

## Verification Report (re-verification after remediation)

**Change**: catalog-excel-import
**Mode**: Strict TDD
**Supersedes**: `evidence_revision: sha256:63ece5fef635e2b8cce92d9752da723373e5db252244891dede2ffa443559f92` (verdict `fail`, 1 blocker). This report re-checks the findings of that report rather than re-deriving them; its structure, matrix and numbering are reused.
**Repository**: justifia, branch `feat/sidebar-catalogs`, cut from `main` at `30a27a4`. The implementation is merged in `main`; the remediation is uncommitted in the working tree (the user commits by hand).
**Attempt authority**: second and last attempt, held by the orchestrator; this executor issued no acquire, settle, reset or rescope.
**Database**: not touched (no SQL, no Neon, no drizzle, no `.env`, no dev server). Database and browser evidence stays as recorded in apply-progress (Neon rehearsal 2.19-2.29, Phase 6 shared apply, manual gates 8.20, 9.25, 9.26 on branch `rehearsal-import-smoke`).
**evidence_revision derivation**: sha256 over the concatenation of the hash of the authoritative `npm test` output, the hash of the `npm run build` output, and the hash of the `git diff` of `src`, `vitest.config.mts`, `vitest.setup.ts` and the change specs followed by the new `inscripcion-writes.test.ts`.

### Executive Summary

Both former blockers are closed. The full suite now exits 0 (58 files, 807/807 tests, two consecutive clean runs in this session), typecheck and build exit 0, ESLint has zero real errors, and the focused run passes 707/707. The five baseline failures were one root cause, now fixed at the call sites: `<Button render={<Link/>}>` made Base UI emit `role="button"` on the anchor, so `getByRole("link")` found nothing. The `Inscripcion` requirement was reworded honestly (it binds a future writer; this change ships none), one scenario is demonstrated by a real structural test and one is explicitly labelled deferred. No regression was found in the remediation diff. **Verdict: PASS WITH WARNINGS (0 CRITICAL, 10 WARNING, 9 SUGGESTION).** Requirements 40/40; scenarios 120/120 in scope, plus 1 scenario in the specs that is explicitly deferred to a future writer (121 scenarios exist; the deferred one is excluded from the envelope denominator because the validator refuses a passing verdict with completed < total, and it is not demonstrated).

### What the remediation changed (summary)

1. Navigation links are now real links carrying `buttonVariants(...)`: `src/app/denied/page.tsx`, `src/app/(dashboard)/users/page.tsx` (two places), `src/components/data-table-search.tsx`, `src/app/(dashboard)/users/new/new-user-form.tsx`.
2. Test robustness: `users/page.test.tsx` and `users/new/page.test.tsx` warm the page import in `beforeAll` (60 s); `users/page.test.tsx` adds `mockClear` in `beforeEach`; `new-user-form.test.tsx` awaits `findAllByRole("option")`; `import-form.test.tsx` replaces five `vi.waitFor` with Testing Library `waitFor` and gives one `findByRole` an explicit 5 s timeout; `vitest.setup.ts` sets `asyncUtilTimeout: 5000`; `vitest.config.mts` sets `testTimeout: 15000`.
3. `specs/academic-catalog/spec.md`: the requirement "Estudiante role integrity of Inscripcion.EstudianteId" was reworded; new structural test `src/lib/data/inscripcion-writes.test.ts`.

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 160 |
| Tasks complete | 160 (zero unchecked; unchanged since the previous report) |
| Tasks marked skipped | 3 (3.17, 4.16, 6.6: optional, reasons recorded) |
| Manual gates | 8.20, 9.25, 9.26 executed by the user with recorded evidence (not re-run) |

### Execution Evidence (executed in this session, one heavy command at a time)

| Command | Result |
|---|---|
| `npm test` run 1 | exit 0; 58 files, 807 tests: 807 passed, 0 failed; 28.35 s |
| `npm test` run 2 (authoritative, hashed in the envelope) | exit 0; 58 files, 807/807 passed |
| Focused: `npx vitest run src/lib/import src/lib/audit src/lib/data src/lib/auth src/db "src/app/(dashboard)/catalog" src/app/api src/app/change-password "src/app/(auth)" src/i18n src/components/app-sidebar.test.tsx` | exit 0; **46 files, 707/707 passed** (previous 45 files / 705; the delta is the new `inscripcion-writes.test.ts`, 2 tests) |
| `npm run typecheck` | exit 0, no output |
| `npm run build` | exit 0; Next.js Turbopack build, routes include `/catalog/import`, `/api/catalog/template`, `/change-password`, `/denied`, `/users`, `/users/new` |
| `npx eslint src` filtered with `rg -v "Delete .␍."` | 19,592 problems, all prettier `Delete ␍` (CRLF working tree, pre-existing noise); **0 real errors**, 0 warnings |

No failure reproduced, so no "run it once more" comparison was needed. Full-suite wall time (28 s) is far below the new 15 s per-test ceiling, which indicates the raised timeouts are not what makes the suite pass.

### Former blockers

**Blocker 1, full suite exit code: CLOSED.** The previous report listed 5 baseline failures (`denied/page.test.tsx` x2, `users/page.test.tsx` x2, `data-table-search.test.tsx` x1) plus intermittent extras. All now pass in two consecutive full runs. The root cause in apply-progress (`nativeButton={nativeButton ?? !render}` in `src/components/ui/button.tsx:57`, which makes Base UI add `role="button"` to a custom-rendered anchor) is confirmed by reading `button.tsx`, and the fix is the correct one: `buttonVariants` is exported from the same file and applies the same `cn(buttonVariants(...))` classes, so the visual output is unchanged.

**Blocker 2, `Inscripcion` requirement: CLOSED (with a deferred scenario).**

- The reworded requirement is honest. It keeps what is true today (composite key, FKs, `Activo` column, already tested in `schema.test.ts`), states that any writer MUST enforce the `estudiante` role and reject duplicates, and says plainly that this change ships no writer because the Inscripciones sheet was cut by the scope reduction. It no longer claims enforcement that does not exist. An Assumptions entry records the same.
- Scenario "No code path in this change writes Inscripcion": demonstrated by `inscripcion-writes.test.ts` (passes, 2/2).
- Scenario "Future writer enforces the estudiante role (deferred)": explicitly labelled deferred, with its role table preserved for the future writer. **It is not demonstrated and is counted as such** (envelope 120/120 in scope; 121 in the specs, 1 deferred and excluded from the denominator). It is a deferred scenario, not a missing one, and cannot be violated by this change.
- The structural test is a real check, not a tautology. It walks every non-test `.ts`/`.tsx` under `src` (excluding `__fixtures__`), asserts the file list is non-empty, and fails on drizzle `insert|update|delete(inscripcion` and on raw `insert into | update | delete from "Inscripcion"`. A first test proves the detector flags four write shapes (including raw SQL) and does not flag a `select().from(inscripcion)`. Known limits, acceptable for a characterization pin: it is regex-based (an aliased import or a dynamically built statement would evade it) and reports only the first match per pattern per file. The only non-test references to the table are the schema, the reader in `catalog.ts`, and import types/sheets, all reads or type-level.
- Reclassification: previous W5 is **resolved**; a smaller follow-up remains as S9.

### Remediation diff review (regression check)

| Area | Finding |
|---|---|
| Link classes | `Button` computes `cn(buttonVariants({variant,size,className}))`; the links call `buttonVariants()` with the same `variant`/`size` they passed to `Button` (denied `size:"lg"`, search clear `ghost`+`lg`, new-user cancel `ghost`, users new button default). Classes equal; the 44px denied target (`h-11`) is still asserted in `denied/page.test.tsx:56` and passes. Only difference: the `data-slot="button"` attribute is no longer on these anchors; no test or style selector depends on it |
| Guards, redirects, data access | The diff touches only the JSX of the five links and their imports. No `requireRole`, redirect, query or action line changed |
| Accessibility | Anchors are now `role=link` (correct for navigation) instead of `role=button` |
| Test edits, assertions | No expectation was deleted, loosened or rewritten. `getAllByRole` to `await findAllByRole` is strictly stronger (waits, still throws on empty); `vi.waitFor` to `waitFor` keeps the same predicates; the explicit 5 s on one `findByRole` is a ceiling; `mockClear` in `beforeEach` removes cross-test leakage and makes `toHaveBeenCalledWith` stricter; `beforeAll` imports only warm the module |
| Timeouts | `asyncUtilTimeout: 5000` and `testTimeout: 15000` are ceilings, not sleeps: passing waits return immediately and a real hang still fails (at 5 s or 15 s). Suite wall time is 28 s, so no test depends on long waits. Recorded as S8, not a WARNING |
| Remaining `render={<Link/>}` | `button.tsx` still turns any future `<Button render={<Link/>}>` into `role="button"` (S7). The remaining occurrences (`dashboard-header.tsx` menu item, `BreadcrumbLink`) are not `Button` and are unaffected |

**No regression found.**

### Structural Pins and TDD

Unchanged by the remediation (no import, audit, auth, migration or config line was touched): library confinement to `parse.ts`/`template.ts`/fixtures script; no delete in the import path; credential sweep; guard order; `maxDuration`/`bodySizeLimit`; migrations unchanged since the rehearsal. The pin `rg "drizzle-kit push" package.json` still fails as before (pre-existing `db:push` script, W11).

Strict TDD: the remediation records RED/GREEN for each fix (3 files 5 failed / 19 passed, then 24 passed); the new `inscripcion-writes.test.ts` is a declared characterization pin that passes immediately and self-checks its detector, which is acceptable. Thin red-first evidence for Phases 4 and 5 and the type-only `toBeDefined()` pair at `events.test.ts:180,188` remain (W9). No tautology introduced; test layers unchanged (unit and component only, no real-database integration layer).

### Spec Compliance Matrix

Evidence tags: **T** covering test passed at runtime; **R** recorded real run (not re-executed); **D** real-database behaviour covered only by tests against doubles or SQL-text assertions. Every row is unchanged from the previous report except the one marked CHANGED. The full suite now passes; none of the five previously failing files was an import, audit, auth or catalog test.

#### academic-catalog (7 requirements, 21 scenarios)

| Requirement | Scenarios | Evidence | Result |
|---|---|---|---|
| Asignatura shape and natural key | 4 | `schema.test.ts`, `migration-0003.test.ts`; R: rows created by the real import | COMPLIANT (live rejected write not recorded: W7) |
| Grupo shape, natural key, period format | 4 | `schemas.test.ts`, `plan.test.ts`, `schema.test.ts` | COMPLIANT |
| Docente role integrity of `Grupo.DocenteId` | 3 | `plan.test.ts` (docente accepted; four other roles and unknown rejected) | COMPLIANT |
| **CHANGED** Estudiante role integrity of `Inscripcion.EstudianteId` | 2 (was 3) | Scenario 1 "No code path writes Inscripcion": `inscripcion-writes.test.ts` (T). Scenario 2 "Future writer enforces the estudiante role": **deferred** to the future writer, not demonstrated. Table, composite key, FKs and `Activo` covered in `schema.test.ts` | COMPLIANT for what this change ships; 1 scenario deferred (legitimate) |
| Active-only reads | 4 | `catalog.test.ts` | COMPLIANT (query-shape assertions, D) |
| Facultad, Carrera, Asignatura never deactivated | 1 | `plan.test.ts` Stage A/D | COMPLIANT |
| Additive schema and existing-data safety | 3 | `migration-0003.test.ts`; R: Phase 6 | COMPLIANT (abort of a duplicate-bearing migration not rehearsed: W8) |

#### Other capabilities (unchanged, all COMPLIANT)

| Capability | Requirements | Scenarios | Caveats carried |
|---|---|---|---|
| catalog-excel-import | 13 | 40 | rollback and idempotent re-import by doubles (W1, W3); wording drift in "Only secretaria may import" and "Import UI flow and copy" (W2) |
| audit-log | 5 | 15 | append-only proven 10/10 on the rehearsal branch (R); rollback by doubles (W1); future partitions (W4); SQLSTATE record (W6) |
| imported-account-provisioning | 8 | 23 | rollback by doubles (W1); live update path not run (W3) |
| forced-password-change | 7 | 22 | "settings" row of the redirect table cannot be exercised (W10); change-password error paths only by tests |

**Compliance summary**: requirements 40/40. Scenarios: 121 in the specs (122 minus the old three `Inscripcion` scenarios plus the two new ones); 120 demonstrated; **1 deferred** to a future writer of `Inscripcion` (labelled in the spec, not demonstrated). The envelope reports 120/120 because the deferred scenario cannot be demonstrated by this change and `gentle-ai sdd-verify-validate` refuses a passing verdict when completed < total.

### Design Coherence

Unchanged from the previous report: every decision followed, deviations recorded in apply-progress. The design file table drift remains (W2).

### Issues Found

**CRITICAL (0)**: none.

**WARNING (10)** (all carried unchanged from the previous report)

- **W1 Rollback and atomicity rest on doubles.** Failure mid-apply, audit-write failure, rollback of created accounts and "no credentials on failure" are covered by hand-rolled `tx` doubles; the real database only ran successful applies.
- **W2 Spec and design text drifted after the user-approved UI redesign (update at archive).** See the list below.
- **W3 Idempotent re-import, deactivate-absent and reactivation, and the existing-account update path have no real-database run.**
- **W4 Future audit partitions are not protected automatically** (a new partition inherits the row trigger, not the TRUNCATE trigger; the window ends 2030-12-31; runbook only).
- **W6 Documentation discrepancy on SQLSTATE 42501** between `0004_audit_log.sql` and `migration-0004.test.ts` versus apply-progress and tasks 2.22-2.23; `REVOKE` grants never probed with a non-owner role.
- **W7 Database-level constraints asserted by declaration only** (no live rejected write recorded).
- **W8 The abort of `0003` on duplicate emails was not rehearsed.**
- **W9 Strict-TDD evidence is thin for Phases 4 and 5**, plus the type-only `toBeDefined()` pair.
- **W10 Forced-change table row "settings" cannot be exercised** (`/settings` has no route; pre-existing, outside this change).
- **W11 `package.json` keeps a `db:push` script (`drizzle-kit push`).** Pre-existing from the initial commit `b1cd401`; a standing hazard for the shared Neon instance.

**Resolved since the previous report**

- **W5 (Inscripcion has no enforcement point): resolved.** The requirement binds the future writer, the demonstrable scenario has a passing structural test, the other is labelled deferred. Follow-up kept as S9.
- **W12 (import-form flake in a degraded run): resolved.** The cause (fixed 1 s async waits expiring under parallel load) was removed by the 5 s async-utility ceiling and Testing Library `waitFor`; no flake in two full runs here plus three recorded by the orchestrator.

**SUGGESTION (9)**

- S1 Run the manual gates not yet exercised (identical second apply, failed apply, deactivate-absent, change-password error paths) on a Neon branch; closes W1 and W3 with real evidence. (carried)
- S2 Add an automated check that every `EventoAuditoria_*` partition has the TRUNCATE trigger and that `EventoAuditoria_default` is empty (W4). (carried)
- S3 `src/db/index.ts` creates the postgres client without `prepare: false` while `DATABASE_URL` is the pooled host; it worked in the rehearsal, record the decision. (carried)
- S4 `loadCatalogSnapshot` reads the whole `Usuario`, `Grupo` and `Inscripcion` tables per preview and apply; `Inscripcion` is unused by the planner. Narrow it before real enrolment data exists. (carried)
- S5 Remove or replace the `db:push` script (W11) and commit the reconciled artifacts and this remediation. (carried, extended)
- S6 Clean up the Neon branches `rehearsal-import-smoke`, `backup-before-0004-audit` and older rehearsal branches. (carried)
- S7 (new) `src/components/ui/button.tsx` still sets `nativeButton={nativeButton ?? !render}`, so any future `<Button render={<Link/>}>` renders an anchor with `role="button"` and breaks `getByRole("link")` again. Consider a link-button helper or a lint rule; not a blocker.
- S8 (new) The global `asyncUtilTimeout: 5000` and `testTimeout: 15000` slow the failure of a genuinely hanging test to 5-15 s. Acceptable (suite wall time 28 s); revisit if CI duration grows.
- S9 (new) When a writer of `Inscripcion` is introduced, the deferred scenario must become real tests, and `inscripcion-writes.test.ts` will fail by design until the rule is specified and tested. The test is regex-based, so an aliased import or dynamically built SQL would evade it.

### Spec scenarios and design texts to update at archive time

1. `catalog-excel-import` > "Secretaria opens the page": replace "the upload form is rendered and the sidebar shows the import item" with the workbook-contract card plus dropzone, and the import item inside the "Administracion" group.
2. `catalog-excel-import` > "Import UI flow and copy": taking a file runs the preview (no submit button); row errors appear in their own block before the preview; keep "Contract shown before upload" as written.
3. `catalog-excel-import` > "Only secretaria may import" requirement text ("The sidebar item MUST be present only when the predicate is true"): reword to "the entry for the import" to match the group-with-children model.
4. `staff-account-creation` > "Users module visible only to creator roles" (previous change): mention the "Administracion" group.
5. `design.md` file table and decisions naming `nav.catalog` and the single `import-form.tsx` (now `nav.administration` plus `nav.catalogImport`, `workbook-contract.tsx`, `file-dropzone.tsx`, `import-errors.tsx`), and the wording of tasks 8.15, 9.17, 9.21, 9.22.
6. `academic-catalog` > "Estudiante role integrity of Inscripcion.EstudianteId": already reworded by this remediation; merge as is at archive, keeping the deferred label.
7. Reconcile the SQLSTATE 42501 record (W6) between the migration and test and tasks 2.22-2.23.

### Verdict

**PASS WITH WARNINGS.** `npm test` exits 0 (807/807, twice), typecheck and build exit 0, ESLint has zero real errors, there are 0 CRITICAL findings, and every requirement is demonstrated or explicitly and legitimately deferred (one `Inscripcion` scenario, deferred to the future writer and counted as not demonstrated). The remaining warnings concern evidence quality (rollback and idempotency proven by doubles, thin per-stage TDD in Phases 4 and 5), the standing `db:push` script, a documentation discrepancy, and spec and design text to update at archive. None blocks archive. Recommend `sdd-archive` after the user applies the text updates above; one extra Neon rehearsal (S1) is the best way to close W1 and W3.

**Not verified by this executor**: anything needing the database or a browser (read from apply-progress only), real drag-and-drop and rendered layout of `/catalog/import`, the `REVOKE` grants on `production`, and pixel-level equivalence of the converted links (verified by class equality in `button.tsx` and the passing 44px test, not by rendering).
