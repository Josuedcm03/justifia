# Archive Report: catalog-excel-import

**Change**: catalog-excel-import  
**Archive Date**: 2026-10-04  
**Repository**: justifia (branch `feat/sidebar-catalogs`, implementation merged to `main`)  
**Final Status**: ARCHIVED — implementation complete, verified pass_with_warnings, all 160 tasks completed, no CRITICAL issues blocking archive.

---

## Executive Summary

The `catalog-excel-import` change has been fully implemented, verified, and archived. The feature enables academic staff (secretaria role) to import catalog data (Asignaturas, Docentes, Grupos) from an Excel workbook, with built-in validation, audit logging, forced password changes for new accounts, and role-based access control. Implementation was merged to `main` via PR #2, #3, and #4 (merge commit `30a27a4`). Verification verdict is `pass_with_warnings` (0 CRITICAL, 10 WARNING, 9 SUGGESTION); 40/40 requirements and 120/120 in-scope scenarios are demonstrated or legitimately deferred. Migrations `0003` (academic catalog schema) and `0004` (audit log schema) are applied to the shared Neon `production` database.

---

## Implementation State (At Close)

### Merge and Commits
- **Merged to main**: PR #2, #3, and #4 (merge commit `30a27a4`, 2026-10-04, branch `feat/sidebar-catalogs`)
- **Implementation branch base**: `feat/catalog-excel-import` (no commits in the archive; all work committed to `main`)
- **Task completion**: 160/160 tasks marked complete; 3 tasks marked skipped (3.17, 4.16, 6.6 — optional scope reductions, reasons recorded in `apply-progress`)

### Specification Compliance

| Metric | Value |
|--------|-------|
| Requirements (40 total) | 40 demonstrated or deferred |
| Scenarios (120 in scope, 121 total) | 120 demonstrated; 1 deferred (Inscripcion future writer) |
| CRITICAL issues | 0 |
| WARNING issues | 10 (all carried, none block archive) |
| SUGGESTION issues | 9 |

**Verification Verdict** (per `verify-report`, evidence_revision `sha256:d2d7c35b72292249cd60cf8ff4a5514632c68f3ce608d9310cb0a9b41b084169`):
- Full suite: `npm test` exit 0 (807/807 tests passed, twice)
- Typecheck: `npm run typecheck` exit 0
- Build: `npm run build` exit 0, routes include `/catalog/import`, `/api/catalog/template`, `/change-password`, `/users`, `/denied`, `/users/new`
- ESLint: 0 real errors (pre-existing CRLF noise filtered out)
- Remediation: 5 blocking test failures from prior run closed; link accessibility fixed (Button render issue, `role="button"` on navigation anchors removed); test robustness improved (async timeouts, mock cleanup); Inscripcion requirement reworded honestly; new structural test `src/lib/data/inscripcion-writes.test.ts` confirms no write paths to Inscripcion in this change

### Database State (At Close)

**Migrations applied to Neon `production` branch:**
- `0003_late_groot.sql` (academic catalog schema): Asignatura, Grupo, Docente (as Usuario), Inscripcion with role integrity, active-only reads. Hash: `62e422f64149a52b9956a7bf2723d56d69e2eb9214e23f6047e6269191e76f3f`. Already applied before this change.
- `0004_audit_log.sql` (EventoAuditoria partition table with immutability enforcement): 5 yearly partitions (2026–2030) + DEFAULT trap, statement BEFORE TRUNCATE triggers, row immutability triggers, `REVOKE` grants. Hash: `d8832f7d8dff7c25df83461ca37752e16070a83477e78df895eee4fd8740d720`. Applied 2026-10-04 with user confirmation.

**Backup branch** `backup-before-0004-audit` exists on Neon.

**Test import applied during manual testing** (2026-10-04, on `production`, kept by user decision): 2 Asignaturas, 1 docente account (Usuario), 2 Grupos, 2 audit rows.

**Manual smoke test branch**: `rehearsal-import-smoke` (now deleted). Executed all manual gates (preview, real apply, credentials download, forced password change, role denial).

### User-Requested Post-Implementation Changes (Reflected in Specs Before Archive)

Per user request and approval, two UI changes were implemented after the core feature and reflected in the specs:

1. **Sidebar group "Administración"**: collapsible group containing import item and other admin functions
2. **Import form redesign** (`/catalog/import`):
   - Contract card with header strips (describes sheet/column expectations and validation rules)
   - Dropzone that runs the preview on file selection
   - Errors block (displays validation errors before the preview table)

**Spec updates at archive** (per verify-report section "Spec scenarios and design texts to update at archive time"):
- `catalog-excel-import` > "Secretaria opens the page": updated to reflect workbook-contract card + dropzone and sidebar group
- `catalog-excel-import` > "Import UI flow and copy": taking a file runs preview (no submit button); errors in their own block before preview
- `catalog-excel-import` > "Only secretaria may import": reworded for group-with-children model
- `design.md`: updated file table and decision naming (`nav.catalogImport`, `workbook-contract.tsx`, `file-dropzone.tsx`, `import-errors.tsx`) and task wording
- `academic-catalog` > "Estudiante role integrity of Inscripcion.EstudianteId": requirement reworded to bind future writer; one scenario deferred (labelled in spec)

### Specs Synced to Main (Archive Time)

Five domain specs created/initialized in `openspec/specs/`:

| Domain | Requirements | Scenarios | Notes |
|--------|--------------|-----------|-------|
| academic-catalog | 7 | 21 (20 demonstrated; 1 future Inscripcion scenario deferred) | Asignatura, Grupo, Docente, Inscripcion (role integrity and active-only reads) |
| audit-log | 5 | 15 | Append-only EventoAuditoria with partitioning and immutability |
| catalog-excel-import | 13 | 40 | Parser, preview, apply, credential management, rollback (proven by doubles) |
| forced-password-change | 7 | 22 | Forced change on first login, change-password flow, role denial |
| imported-account-provisioning | 8 | 23 | Docente account creation, credential delivery, role provisioning |

**Total at archive**: 40 requirements, 120/121 scenarios (1 legitimately deferred to future Inscripcion writer).

---

## Open Issues Carried Forward

### Warnings (10 total, none block archive)

**W1 Rollback and atomicity rest on doubles**: Failure mid-apply, audit-write failure, rollback of created accounts, and "no credentials on failure" are proven by hand-rolled test doubles; the real database only ran successful applies. Recommend running all manual smoke-test gates on a Neon branch to close (S1).

**W2 Spec and design text drifted after the user-approved UI redesign**: Updated at archive time per verify-report list; this is resolved.

**W3 Idempotent re-import, deactivate-absent, existing-account update, and update paths have no real-database run**: Covered by test doubles only. Recommend Neon smoke test (S1).

**W4 Future audit partitions are not protected automatically**: New partitions inherit the row trigger (immutability) but not the TRUNCATE trigger. Window ends 2030-12-31; runbook-only (no automated provision). Future work to add per-partition trigger and TRUNCATE trigger automation (S2).

**W6 Documentation discrepancy on SQLSTATE `42501`**: In practice, DML/TRUNCATE blocks fire via the `fn_EventoAuditoria_inmutable` row trigger (custom exception), not SQLSTATE `42501` (which requires a non-owner role; rehearsal ran as owner). The `REVOKE` grants remain correct defense-in-depth for future least-privilege role. Reconcile notes in `0004_audit_log.sql`, `migration-0004.test.ts`, and `model_datos_sql.md` (S5).

**W7 Database-level constraints asserted by declaration only**: No live rejected write for natural keys (duplicate emails, duplicate group numbers) recorded in rehearsal. Recommend live constraint test on Neon (S1).

**W8 The abort of `0003` on duplicate emails was not rehearsed**: Schema-level constraint exists; live trigger not exercised. Recommend Neon smoke test covering a duplicate-email scenario (S1).

**W9 Strict-TDD evidence is thin for Phases 4 and 5, plus type-only `toBeDefined()` pair**: Early phases and the `events.test.ts` pair do not have RED-first evidence. Acceptable for this change; flag for future phase discipline review.

**W10 Forced-change table row "settings" cannot be exercised**: `/settings` route has no handler (pre-existing, outside this change scope). Follow-up: implement /settings route.

**W11 `package.json` keeps a `db:push` script** (`drizzle-kit push`): Pre-existing from initial commit `b1cd401`. Standing hazard for the shared Neon instance. Recommend removal or replacement (S5).

### Suggestions (9 total)

**S1** Run the manual gates not yet exercised (identical second apply, failed apply, deactivate-absent, change-password error paths, live constraint tests) on a Neon branch; closes W1 and W3 with real evidence.

**S2** Add an automated check that every `EventoAuditoria_*` partition has the TRUNCATE trigger and that `EventoAuditoria_default` is empty; closes W4.

**S3** `src/db/index.ts` creates the postgres client without `prepare: false` while `DATABASE_URL` is the pooled host; it worked in the rehearsal, record the decision.

**S4** `loadCatalogSnapshot` reads the whole `Usuario`, `Grupo`, and `Inscripcion` tables per preview and apply; `Inscripcion` is unused by the planner. Narrow it before real enrolment data exists.

**S5** Remove or replace the `db:push` script (W11) and reconcile SQLSTATE 42501 notes (W6); commit the reconciled artifacts.

**S6** Clean up old Neon rehearsal branches.

**S7** (New) `src/components/ui/button.tsx` still sets `nativeButton={nativeButton ?? !render}`; any future `<Button render={<Link/>}>` renders with `role="button"` and breaks `getByRole("link")` again. Consider a link-button helper or lint rule.

**S8** (New) Global `asyncUtilTimeout: 5000` and `testTimeout: 15000` slow failure of genuinely hanging tests to 5–15 s. Acceptable (suite wall time 28 s); revisit if CI duration grows.

**S9** (New) When a writer of `Inscripcion` is introduced, the deferred scenario must become real tests, and `inscripcion-writes.test.ts` will fail by design until the rule is specified and tested.

---

## Dependent Changes

### catalog-management (PLANNED)
**State**: Proposal, specs, design, tasks written; no code yet.  
**Dependency**: Depends on these five `openspec/specs/` domains (academic-catalog, audit-log, catalog-excel-import, forced-password-change, imported-account-provisioning).  
**Action required at archive**: Update delta spec base-path statements in `openspec/changes/catalog-management/specs/*/spec.md` to point at `openspec/specs/` instead of `openspec/changes/catalog-excel-import/specs/`.

### roles-lookup-table
**State**: Verified (pass_with_warnings) but not yet archived.

---

## Archive Folder Contents

Archived to: `openspec/changes/archive/2026-10-04-catalog-excel-import/`

All artifacts preserved intact:
- `proposal.md` — original proposal and scope
- `design.md` — architecture, decisions, component diagrams (updated with post-implementation UI changes and "Post-implementation notes (2026-10-04)" section)
- `apply-progress.md` — full batch/phase logs, TDD cycle evidence, task completions, database rehearsal logs
- `verify-report.md` — verification evidence, blocker resolutions, spec compliance matrix, issue findings
- `tasks.md` — all 160 tasks marked complete; 3 marked skipped (optional scope)
- `specs/` — five spec files (academic-catalog, audit-log, catalog-excel-import, forced-password-change, imported-account-provisioning)
- `archive-report.md` — this file

---

## Change Closure

**SDD Cycle**: Fully completed (Proposal → Specs → Design → Tasks → Apply → Verify → Archive).

**No further work** on this change; all implementation is merged to `main`, all tasks are checked, verification is pass_with_warnings with no blockers, and the change is archived. The next change may now be planned and proposed.

**Follow-on work** is tracked in open Suggestions S1–S9 and Warnings W1–W11 above, which may be addressed as part of follow-on changes (e.g., additional Neon smoke tests, future Inscripcion writer, settings route, lint rules).
