# Archive report: secretary-review

Change: secretary-review (roadmap row 2: RF-06 to RF-08; RN-08, RN-15 to RN-17)
Project: justifia | Store mode: hybrid | Archived: 2026-10-13
Archive location: openspec/changes/archive/2026-10-13-secretary-review/
Close outcome: archived with warnings (verify PASS WITH WARNINGS; backup branch kept by owner decision).

## State at close

This section records the state at close and outranks the earlier snapshots in apply-progress.md and verify-report.md.

- Implementation: slices S1 to S6 merged into the tracker `feat/secretary-review` through PRs #18 to #24 (S4 shipped with an owner `size:exception`).
- Verify (2026-10-13): PASS WITH WARNINGS, 29/29 requirements, 120/120 scenarios, 0 CRITICAL, accepted by `gentle-ai sdd-verify-validate`.
- Real Postgres (owner-approved, disposable branch, 2026-10-12): `npm run test:integration` 6/6 on two runs, including two concurrent-decision cases; this also rehearsed migration 0008.
- Owner manual walk (disposable branch with 0008 and seeded accounts, 2026-10-13): S4 to S6 passed at 1280 and 360 px; read-only audit check found one row per read and per decision.
- Production rollout (Phase 7, owner-confirmed, 2026-10-13): backup branch `backup-before-secretary-review`; `0008_secretary_review` applied over the direct URL (migrations 8 -> 9); all row counts identical before and after; drift check clean; secretaria `jdkno` (id 2) given `FacultadId` 4 (Facultad de Ingenieria y Arquitectura).
- Tasks: 104/104 checked. Task 7.8 (delete the backup branch) is DEFERRED to the owner: the backup is kept until production is confirmed with the new code.
- Before the archive move, `gentle-ai sdd-status` reported `dependencies.archive: ready`, `nextRecommended: archive`, no blocked reasons.

## Warnings carried (none blocking)

- W1: concurrent resubmit of a correction is covered at unit level (db double and the guarded `UPDATE` pin) only; the real-Postgres run covers concurrent decisions, not resubmit.
- W2: the store-side refusal of an oversize file was never observed; the upload token cap and the finalize refusal are unit-tested.
- W3: the calendar staleness test uses the real clock and fails at the start of 2028 until `NON_WORKING_DAYS[2028]` is added.
- W4: the real-Postgres suite is opt-in and not part of CI.
- W5: owner item: delete `backup-before-secretary-review` after checking production, and rotate the `neondb_owner` password (a branch connection string was shared during the walk).

## Spec sync

- New capabilities: `openspec/specs/request-review/spec.md` and `openspec/specs/student-requests/spec.md` (`## ADDED Requirements` became `## Requirements`).
- Modified capabilities: `supporting-documents` (3 MODIFIED, 1 ADDED), `audit-log` (2 MODIFIED, 4 ADDED), `staff-account-creation` (1 MODIFIED, 1 ADDED). MODIFIED blocks replaced in place by exact title; ADDED blocks appended.
- `audit-log` Purpose edited by hand (task 8.2): staff reads of requests (queue and detail opens) and supporting-document views and downloads are audited; a student reading their own requests is not. The requirement title "Scope limited to write events" was kept so the MODIFIED delta matched by title; its body now covers reads.
- Line endings: base files kept their CRLF; LF deltas were converted on merge.
- Readbacks: staged vs installed specs, empty diff for all five capabilities; structural check confirmed unmodified base blocks are byte-identical.

## Archive move

- The change folder was moved with `git mv`; a recursive diff of a pre-move snapshot against the archived folder was empty.
- After the move, `sdd-status` falls back to Engram topics and reports the archive as blocked ("tasks.md has no markdown task checkboxes"). This is expected once the active folder is gone and is not a closure blocker.

## Roadmap

`docs/roadmap.md`: row 2 set to `archivado`; a note records the UAM-validated 2026-2027 calendar and the yearly extension; the stale Vercel deployment note was updated.

## Commits

- `12eaa21` docs(secretary-review): merge delta specs into main specs
- `034ff11` docs(secretary-review): archive change and mark roadmap archived

## Engram

Topic key: `sdd/secretary-review/archive-report` (observation #223). Verify report: `sdd/secretary-review/verify-report` (#221).
