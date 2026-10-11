# Archive report: roles-lookup-table

Change: roles-lookup-table
Project: justifia | Store mode: hybrid | Archived: 2026-10-11
Archive location: openspec/changes/archive/2026-10-11-roles-lookup-table/
Close outcome: archived under ordinary repository policy (receipt-driven development off, `reviewGate` absent). The owner approved the archive in conversation on 2026-10-11.

## State at close

This section records the state at close and outranks the snapshots `verify-report.md`, `state.yaml` and the handoff block where they disagree.

- Implementation: merged to main through PR #2 (`feature/rolManagement`), merge commit `cbaac00`. `cbaac00` is an ancestor of `main` (checked with git).
- Migration `drizzle/0002_roles_lookup_table.sql`: applied to the shared Neon database on 2026-09-20 (`state.yaml` `db_apply_record`, applied at 2026-09-20T18:33Z). The three Neon branches used for rehearsals are still listed for deletion (see Open items).
- Tasks: 78/78 checked in `tasks.md`, 0 unchecked. The Task Completion Gate passed without any stale-checkbox reconciliation.
- Verify: the report is dated 2026-09-20 and its verdict was `pass_with_warnings`, with 0 CRITICAL, 0 blockers, 27/27 requirements and 87/87 scenarios. Its test counts (201 tests, 22 files) are a snapshot from that date and are not the current count. The suite has grown since through later changes; the 2026-10-11 figure is 2919 tests, as stated in the launch facts and in the `merge-grupo-into-asignatura` archive report.
- Review gate: `reviewGate` is structurally absent (receipt-driven development is off). Archive proceeds under ordinary repository policy. No `gentle-ai review` command was run.
- Action context: repo-local. The only allowed edit root is the repository root.

## Open items carried into the archive (none blocking)

1. Three Neon branches still await deletion: `rehearsal-0002-roles`, `backup-before-0002-roles` and `abort-rehearsal-0002`. Their current existence was NOT checked by this archive. The owner handles them separately. No database operation (no SQL, migration, seed, branch deletion) was run by this archive.
2. An intermittent test, `new-user-form.test.tsx` (role selector for `administrador`), failed once under full-suite load in the verify session and passed in isolation. Carried from the 2026-09-20 verify report; not re-verified by this archive.
3. The apply-progress Engram artifact uses a narrative format rather than the strict-TDD evidence table. TDD evidence is embedded per task in `tasks.md`.

## Specs synced

Four new main specs were created. Each delta file is a full spec (it has no ADDED, MODIFIED, REMOVED or RENAMED headers), and none of the four targets existed under `openspec/specs/`. Each file was copied with `cp` and carries no edits.

| Domain | Action | Requirements | Scenarios |
|---|---|---|---|
| `user-roles` | Created | 6 | 15 |
| `staff-account-creation` | Created | 7 | 20 |
| `permission-denied-screen` | Created | 6 | 20 |
| `users-listing` | Created | 8 | 32 |
| Total | | 27 | 87 |

The totals match the 2026-09-20 verify report (27/27 requirements, 87/87 scenarios). The new main specs carry the content as written on 2026-09-20. They were not reconciled with later changes, as instructed.

## Contradictions and stale claims in existing main specs

Checked against the four copied specs: `imported-account-provisioning`, `forced-password-change`, `catalog-management`, `academic-catalog`, `justification-intake`, `supporting-documents`, `audit-log` and `catalog-excel-import`.

No existing main spec directly contradicts a requirement copied here. One stale claim and several alignments were found:

- Stale claim, `catalog-management` assumption A-GRP-4: it says a docente can be reactivated "in the users module (which does not exist yet)". The users list and `/users/new` already exist, and `users-listing` describes the list. The sentence is accurate only for reactivation, which none of the four new specs provides. A reader may take it as "no users module". Not resolved here.
- Alignments, not contradictions:
  - `academic-catalog`, "Existing rows survive" (lines 245-248) and the role-integrity assumptions (lines 149-150 and 444-445) presume a `Rol` lookup table and a role reached through a lookup. Migration 0002 creates exactly that, so these are consistent once the migration is applied.
  - `catalog-management` uses `/denied` for role refusals, says the denied screen is reserved for role denial (line 125), and sets the Docentes list page size to "the same as `/users`" (lines 821 and 854, 10 rows). This matches `permission-denied-screen` and `users-listing`. The page size of 10 is an unconfirmed assumption in `users-listing`, and `catalog-management` already relies on it.
  - `forced-password-change` lists the users list and `/users/new` as guarded routes and states that the forced change runs before role checks. This is consistent. Interaction to keep in mind: `/denied` is not in its guarded list, so a flagged user is sent to the change-password screen before any denial.
  - `imported-account-provisioning` and `catalog-excel-import` create `docente` accounts through the workbook import, outside the users module. They do not restate the assignment matrix, so they are consistent with the single-source rule of `staff-account-creation`.

## Stale claims inside the archived change folder (kept as written)

- `state.yaml` `next_recommended` still reads "archive (verify passed 2026-09-20; ...)". It was left unchanged on purpose. The `archive: done` line supersedes it.
- `design.md` refers to six work units in several places. Its own "Work Units and Order" note supersedes this with five units (WU3c merged into WU3b), and `tasks.md` has five phases.
- `design.md` sequence diagrams show `pageSize: 20`. The decided value is 10 (`USERS_PAGE_SIZE`, `users-listing`, `state.yaml` defaults).
- `verify-report.md` recommends proceeding to archive once the pending artifact edits are committed. That was a 2026-09-20 instruction and is historical.

## Roadmap

`docs/roadmap.md` has no row for this change. It was not edited, and no row was invented.

## Engram traceability

The Engram tools (`mem_search`, `mem_get_observation`, `mem_save`) are not exposed to this executor, so no observation IDs were retrieved. The artifacts were read from the OpenSpec files (hybrid store). The `verify-report.md` refers to the apply-progress observation (`sdd/roles-lookup-table/apply-progress`, #113) and to the explore, proposal, spec and design topics recorded in `state.yaml`; none of these were re-read here. The orchestrator is responsible for saving `sdd/roles-lookup-table/archive-report` from this file.

## Archive folder contents

Moved from `openspec/changes/roles-lookup-table/` to `openspec/changes/archive/2026-10-11-roles-lookup-table/` with a plain `mv` (nothing staged). The folder holds 10 files at move time, verified by `diff -r` against a pre-move snapshot:

- `proposal.md`, `exploration.md`, `design.md`, `tasks.md`, `verify-report.md`, `state.yaml`
- `specs/user-roles/spec.md`, `specs/staff-account-creation/spec.md`, `specs/permission-denied-screen/spec.md`, `specs/users-listing/spec.md`
- `archive-report.md` (this file, written after the readback)

## Mechanical readback

- Pre-move snapshot taken after the `state.yaml` edit and before the move. The source directory was confirmed absent after the move.
- `diff -r` of the snapshot against the archived folder: empty output, exit 0.
- `diff -r` for each new main spec against its source delta file (`user-roles`, `staff-account-creation`, `permission-denied-screen`, `users-listing`): empty output, exit 0 for all four.

## Files touched

- Created: `openspec/specs/user-roles/spec.md`, `openspec/specs/staff-account-creation/spec.md`, `openspec/specs/permission-denied-screen/spec.md`, `openspec/specs/users-listing/spec.md`.
- Edited: `openspec/changes/roles-lookup-table/state.yaml`, line 18 only (`archive: pending` changed to `archive: done`), before the move.
- Moved: `openspec/changes/roles-lookup-table/` to `openspec/changes/archive/2026-10-11-roles-lookup-table/`.
- Created: `openspec/changes/archive/2026-10-11-roles-lookup-table/archive-report.md`.
- Not touched: `docs/roadmap.md`, any file under `src/`, the Neon database, the git index, and git history.

## Change closure

The change is archived. Its implementation is on main (PR #2, `cbaac00`), its migration is applied, and its tasks are complete. The open items above are housekeeping and are not blockers for the next change.
