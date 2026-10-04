# Apply progress: catalog-management

## Phase 0: preconditions (2026-10-04)

- [x] 0.1 `catalog-excel-import` work committed by the user and merged to `main` (PR #4, merge commit `30a27a4`; content commit `88f0d14`). Verified by the orchestrator: working tree clean, `src/app/(dashboard)/catalog/`, `src/lib/import/apply.ts`, `src/app/change-password/`, `src/components/ui/collapsible.tsx`, `drizzle/0004_audit_log.sql` and both `openspec/changes/` folders are tracked.
- [x] 0.7 Delivery: option D, one branch with a PR per stretch (user decision).
- [x] 0.8 Branch `feat/sidebar-catalogs` created by the user from `main` (0 commits ahead, 0 behind; no upstream yet).
- [x] 0.9 Baseline on `30a27a4`:
  - `npm test`: 805 tests, 800 passed, 5 failed (57 files, 3 failed). The five failures are the known environment-flaky set and are the reference for later REDs:
    - `src/app/(dashboard)/users/page.test.tsx` > UsersPage > renders users.noResults.* and a clear control when a search has no results
    - `src/app/(dashboard)/users/page.test.tsx` > UsersPage > shows the new-user button to every creator
    - `src/app/denied/page.test.tsx` > DeniedPage > gives the way-back control the 44px touch floor and leaves the global focus ring alone
    - `src/app/denied/page.test.tsx` > DeniedPage > renders one h1, the explanation and a single control leading to /
    - `src/components/data-table-search.test.tsx` > DataTableSearch > renders a clear link to the bare action only when the value is non-empty
  - Also seen failing intermittently in earlier runs, not in this one: `users/page.test.tsx` "guards with exactly rolesQueCreanUsuarios" and `users/new/new-user-form.test.tsx` (role options).
  - `npm run typecheck`: clean.
  - `npm run build`: succeeded; routes `/`, `/api/catalog/template`, `/catalog/import`, `/change-password`, `/denied`, `/login`, `/profile`, `/register`, `/users`, `/users/new`.

Pending in Phase 0: 0.2 to 0.6 (the `catalog-excel-import` manual gates 8.20, 9.25, 9.26, 9.27, its stale checkboxes, and its verify and archive, or a recorded decision to proceed without them), and 0.10 (Next.js docs reading, done by the first apply batch).

## Phase 0 closed except 0.10 (2026-10-04)

The user chose to close `catalog-excel-import` before implementing this change.

- [x] 0.2 `catalog-excel-import` 8.20 run by the user on Neon branch `rehearsal-import-smoke` with the account the rehearsal import created (`jdcano@uamv.edu.ni`): redirect to `/change-password`, one successful change, flag cleared, dashboard reachable. Error paths of the form were not exercised.
- [x] 0.3 9.25 preview smoke run by the user on the same branch.
- [x] 0.4 9.26 real apply run by the user on the same branch through the pooled host without `prepare: false`: 1 Asignatura, 1 docente account, 1 Grupo created; two audit rows in the same transaction in partition 2026; no credential in the server log. An earlier, unplanned test apply on `production` (2026-10-04 04:47 UTC) was kept by the user's decision.
- [x] 0.5 `catalog-excel-import` tasks reconciled to 160/160 (3.17, 4.16 and 6.6 marked skipped, optional).
- [x] 0.6 `sdd-verify`: first run `fail` on the gate, remediated (navigation links exposed as buttons, intermittent tests, the `Inscripcion` requirement reworded as deferred), second run `pass_with_warnings` (`sha256:d2d7c35b…4169`; `npm test` 807/807 exit 0). `sdd-archive` done: main specs now live under `openspec/specs/` (40 requirements, 120 scenarios) and the change is at `openspec/changes/archive/2026-10-04-catalog-excel-import/`.

New baseline for this change (supersedes the 0.9 record above): `npm test` 807/807 passed, exit 0, with no known failing tests; `vitest.setup.ts` sets a 5 s async-utility timeout and `vitest.config.mts` a 15 s test timeout. Any failing test from here on is a real finding.

Follow-up before the first code unit: the four delta specs of this change were written against the pre-archive base. The base changed afterwards (UI wording in `catalog-excel-import`: "Only secretaria may import", "Secretaria opens the page", "Rejected uploads", "Import UI flow and copy"; and `academic-catalog`: the `Inscripcion` requirement reworded with a deferred note). Every `## MODIFIED Requirements` block in this change's deltas that restates one of those requirements in full must be re-based on the current text in `openspec/specs/`, otherwise archiving this change would overwrite the updated wording.

Still open in Phase 0: 0.10 (Next.js docs reading, done by the first apply batch). The Neon branch `rehearsal-import-smoke` still exists.

Neon housekeeping (2026-10-04): branch `rehearsal-import-smoke` (`br-polished-tree-ayn6sdxx`) deleted with the user's confirmation and verified absent. Remaining branches: `production` (default), `backup-before-0004-audit`, `rehearsal-0002-roles`, and the archived `backup-before-0002-roles` and `abort-rehearsal-0002`.

Neon housekeeping, continued (2026-10-04): at the user's request the three branches left from the `roles-lookup-table` migration were deleted and verified absent: `abort-rehearsal-0002` (`br-dry-base-ayngeqfm`), `rehearsal-0002-roles` (`br-rough-band-ayu3kv9t`) and `backup-before-0002-roles` (`br-tiny-bread-aypqu93y`). Remaining: `production` (default) and `backup-before-0004-audit` (kept pending the user's decision; it is the only copy of the pre-`0004` state).
