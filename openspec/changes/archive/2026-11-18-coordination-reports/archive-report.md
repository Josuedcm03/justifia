# Archive report: coordination-reports

Change: coordination-reports (roadmap row 7: RF-13 (a, b, d) and the dashboard requirement cited as RF-17; RN-16, RNF-01, RNF-06 (a))
Project: justifia | Store mode: openspec | Archived: 2026-11-18
Archive location: openspec/changes/archive/2026-11-18-coordination-reports/
Branch: `docs/coordination-reports-archive`, from `main` b82b359. The implementation is already on `main` (b82b359 merges `feat/coordination-reports-3-export`, the last of the stacked slices planned in `tasks.md`; `git branch -a` in this worktree lists no slice branch, so their local presence was not verified). The archive commit is made by the parent. Slice branches are not to be deleted (memory `keep-change-branches`).

## Final state at close

Ranking used (per `sdd-archive` Final-State Authority): persisted tasks artifact (rank 1), then launch-prompt final-state facts (rank 2), then `verify-report` and `apply-progress` (rank 3, intermediate snapshots).

| Fact                       | Final state                                                                                                                                                                                                                                   | Source (rank)                                                                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Tasks                      | 73 of 73 complete; no unchecked task. Task 5.4 was the only open task at verify time and is closed by this archive                                                                                                                            | `tasks.md` (1); `gentle-ai sdd-status` after 5.4 was checked: `completed: 73, pending: 0, allComplete: true`, `archive: ready` |
| Verify verdict             | pass_with_warnings; 0 CRITICAL; 7 WARNING; 4 SUGGESTION. The owner approved verify and archive on 2026-11-18                                                                                                                                  | `verify-report` (3), written on b82b359; launch prompt (2)                                                                     |
| Requirements and scenarios | 25/25 requirements; 52/52 scenarios compliant. Eight rest on compiled-SQL pins, not executed rows (see W1)                                                                                                                                    | `verify-report` (3), snapshot                                                                                                  |
| Unit gates                 | Full `npm test`: 341 files, 7,764 tests passed, 0 failed. `npm run typecheck`: exit 0. No source file changed after the verify run (only docs and the change folder), so the numbers stand                                                    | `verify-report` (3); launch prompt (2) confirms the runtime verify attempt is settled                                          |
| Build                      | `npm run build` was not run by the verifier; the orchestrator built b82b359 the same day                                                                                                                                                      | `verify-report` (3)                                                                                                            |
| Database-backed tests      | None written for this change. Nothing was run against Neon during verify or archive. Task 4.12 (below) used a disposable branch with the owner's approval                                                                                     | `verify-report` (3); `apply-progress`                                                                                          |
| Authored size              | Slices measured at apply time: 1a-i and 1a-ii (see apply-progress), 1b-ii 1,032, 2-i 1,238, 2-ii 2,004, 3 2,146 (502 production, 1,644 tests). Every slice passed the 800-line session budget and was delivered as an accepted size exception | `tasks.md` (1)                                                                                                                 |

## CR-LIMIT-1: documented limitations (task 5.4)

Both limitations are stated in the `coordination-reports` spec (CR-LIMIT-1, CR-SCOPE-1), in the design and here.

1. The teacher shown or counted is the live `Grupo.DocenteId`, not a snapshot. Reassigning a group changes past rows and past rankings: a justified class counts for the new teacher, never the old one.
2. The career is the student's current `Usuario.CarreraId`, not the career name stored on the request. A student who changes career moves their whole history to the new career's coordinator.
3. No recidivism figure, column or placeholder appears in any view. The student ranking is a count of requests, not RN-14 recidivism (no issuer, no threshold, no signal).

## Audit actions added (all with entity type `Carrera`, entity id = the coordinator's `carreraId`)

| Action                         | Written by                                                                                                     | Payload (codes and counts only)                              |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `solicitud.ranking.consultado` | the dashboard `/reports`, once per open, after the data load                                                   | period code, counts per ranking                              |
| `solicitud.reporte.consultado` | the detail `/reports/requests`, once per open, after the data load                                             | period, `docenteId`, cause code, `busqueda` (boolean), total |
| `solicitud.reporte.descargado` | the route `/api/reports/justifications`, once per download, after authorization and build and before the bytes | same shape as the detail, `total` = row count                |

The typed student search term is never stored: only the boolean `busqueda`. A denied, `none`-scope, degraded or failed operation writes no row. An insert failure returns no data (page) or a 500 with no bytes (route). Repeated downloads each write their own row. The `Carrera` entity type already existed in the main `audit-log` spec (added by `escalation`); this change reuses it.

## Export limits and residual risks (verify suggestion S1)

- Row cap: none. The workbook holds every matching request. The classes of the whole export are read in one `IN (...)` batch with one bind parameter per request. Postgres allows 65,535 bind parameters per statement, so a career with more than about 65,000 matching requests would fail with a 500 (`{ "error": "export_failed" }`) instead of a file. This is far above pilot volume. Fix if volume grows: chunked batches or a subquery.
- Excel formula-on-edit (residual): a student name such as `=1+1` is stored as a string cell, so Excel does not evaluate it on open (proved by reading the written file back and by a mutation check). Excel would still turn it into a formula if a user edits that cell and presses Enter, because ExcelJS 4.4 has no `quotePrefix` style. Accepted; the owner decides if a visible prefix is wanted.

## RF numbering note (verify suggestion S2)

The proposal, specs, design and tasks cite RF-17 (a-e) for the coordination dashboard. `docs/requirements.md` renumbered it to RF-18 on 2026-11-09; RF-17 is now the student enrollment. Read "RF-17" in this change and in the synced `coordination-reports`, `audit-log` and `backoffice-shell` specs as RF-18 today. RF-13 (a, b, d) is unchanged. By the project convention (the `requirements.md` change log) archived changes keep the numbering they were archived with, so the texts were not rewritten. The roadmap carries the pending thesis-matrix sync as "sincronizar RF-18 con la matriz de la tesis" (task 5.3).

## RF-13 (c) moved to validation-signals

RF-13 (c), recidivism per student, is out of scope here and is a follow-up of `validation-signals` (roadmap row 5, RN-14). `docs/roadmap.md` row 5 now lists `RF-13 (c)` in "Cubre" and states that the student ranking is not RN-14 recidivism (task 5.2, done 2026-11-18). A static scan at verify time found no recidivism string in any report source or `reports.*` catalog key.

## Task 4.12 evidence (real download)

Done 2026-11-18 on `main` b82b359 (`next build` plus `next start`) against a disposable Neon branch `rf13-medicion` (child of `dev-arnia`, deleted afterwards), as the coordinator of Ingenieria de Sistemas. The 11 accounts with real names or addresses were renamed to fictitious ones on that branch only. Owner approval was given through Armando.

| Case                 | Screen total | Data rows | Summary total | Download audit rows |
| -------------------- | ------------ | --------- | ------------- | ------------------- |
| all periods          | 101          | 101       | 101           | 1                   |
| period 2026-S2       | 66           | 66        | 66            | 1                   |
| one teacher          | 21           | 21        | 21            | 1                   |
| one CIF              | 11           | 11        | 11            | 1                   |
| cause medical        | 50           | 50        | 50            | 1                   |
| 2026-S2 plus medical | 32           | 32        | 32            | 1                   |

Limits of that evidence, stated plainly:

- The files were read back with ExcelJS. They were NOT opened in Excel or LibreOffice, although the task text names both.
- Checklist items 6 (a student name starting with `=`, `+`, `-` or `@`), 7 (the audit row's entity and fields; only the row count per click was checked) and 8 (the English download) were not checked in the real run. They are covered by tests only: `build-workbook.test.ts`, `route.test.ts` (locale), `events.test.ts`.
- The three rankings were not exercised in the real run (see W1).

## Verify warnings at close

Each statement is attributed to `verify-report` at verification time (2026-11-18, b82b359), then given its status at close.

| #   | `verify-report` statement (verification time)                                                                                                                                                                               | Status at close                                                                                                                                                                   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W1  | Four scenarios ("Pairs, not requests", "Period limits pairs", "Cut and tie", "Reassigned group") are accepted on SQL pins only; their GIVEN data was never executed, and no `*.integration.test.ts` exists for the rankings | Open, accepted. The owner walked `/reports` on 2026-10-31 (task 2.13). An optional integration test on a disposable branch needs the owner's consent per `CLAUDE.md`. Not written |
| W2  | The delta specs are stale against main (audit-log scope exception, `Carrera` wording, `backoffice-shell` tables missing `Solicitudes escaladas`) and must be rebased before sync                                            | Closed by this archive. The deltas were rebased, not blind-replaced (see Spec sync)                                                                                               |
| W3  | Task 4.12 closed with weaker evidence than its text (ExcelJS read-back, items 6-8 unchecked)                                                                                                                                | Open, accepted. Recorded above under Task 4.12 evidence                                                                                                                           |
| W4  | `npm run lint` warning: `SidebarGroupLabel` is unused in `src/components/app-sidebar.tsx` (from commit 40b9edf, outside this change)                                                                                        | Open, outside this change; a hygiene item for the owner. Not checked again at archive time                                                                                        |
| W5  | Disclosed TDD irregularities (parity test passed first time by design and was mutation-proven; one vacuous assertion in `b772548` fixed in `f2ea790`)                                                                       | Closed, nothing to do                                                                                                                                                             |
| W6  | Task 5.4 unchecked                                                                                                                                                                                                          | Closed by this archive (task 5.4 `[x]`, status `allComplete: true`)                                                                                                               |
| W7  | Roadmap row 7 reads `archivado` before the change is archived                                                                                                                                                               | Closed. The roadmap edit and the archive land in the same commit                                                                                                                  |

Suggestions: S1 and S2 are recorded in this report. S3 was applied (the stale "still open" wording in tasks 3.18 and 4.13 now says those tasks were closed afterwards, before the move). S4 (the export has no row cap; the live teacher rewrites history) is recorded above and is not tracked elsewhere; the owner may want a roadmap or backlog line.

## Contradictions recorded

- Task count: `verify-report` (rank 3) says 72 of 73 complete. `tasks.md` (rank 1) at archive says 73 of 73. The tasks artifact is authoritative; the difference is exactly task 5.4, which this archive performed.
- Roadmap row 7 status: `verify-report` W7 (rank 3) flags it as premature; at close it is correct (same commit as the archive). No unrankable contradiction remains.

## Spec sync

Method: `coordination-reports` was copied with `cp` and checked with `diff -r` (empty). For the two modified specs, the new text was sliced mechanically from the delta bytes by a script (requirement and scenario blocks); the only authored text is the rebase edits listed below, each asserted to match exactly one place in main. All three files stay CRLF (zero LF-only lines). The `(Previously: ...)` annotation lines are dropped as change-specific, as in the precedent archive. Each merged requirement was compared line by line against the current main block and against the delta block.

| Domain               | Action  | Details                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| coordination-reports | Created | 18 requirements (CR-ACC-1 to CR-XLS-4), copied verbatim from the delta. It keeps the delta's "Delta type: this whole file is ADDED" note, as `backoffice-shell` does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| audit-log            | Updated | MODIFIED 1: "Scope limited to write events" kept main's text (including the coordinator escalation exception and the scenario "Coordinator read is in scope") and added the report read and download exceptions (`solicitud.ranking.consultado`, `solicitud.reporte.consultado`, `solicitud.reporte.descargado`) plus the delta scenario "Coordination report read is in scope". ADDED 3: "Closed set of report events", "One audit row per report view and download", "Report payloads are codes and counts only", inserted before "Assumptions and open questions". Only rebase edit: in "Closed set of report events", "The entity types MUST gain `Carrera`, and each event MUST use it" became "Each event MUST use the entity type `Carrera` (already in the set, added by the escalation events)", so `Carrera` is not added twice. 28 to 31 requirements                                                                                                                                              |
| backoffice-shell     | Updated | MODIFIED 3, count unchanged at 15. BS-NAV-1: "one addition" became "three additions" (Enrollment, the Escalated requests entry for `coordinacion` through `canCoordinate`, not prefetched, which `escalation` shipped without syncing this spec, and Reports through `canViewReports`, not prefetched); the `coordinacion` table row is now Dashboard, Escalated requests, Reports, Administration, Settings, matching `src/lib/navigation.ts` and `src/components/app-sidebar.test.tsx`; two delta scenarios added ("Reports entry not prefetched", "Reports routes and active marker"). BS-HOME-1: shortcut order now names Escalated requests and Reports; the `coordinacion` row is Escalated requests, Reports, Asignaturas, Docentes, Users, matching `src/lib/navigation.ts` and the home `page.test.tsx`; scenario "Reports shortcut only for coordination" added. BS-I18N-1: applied as in the delta (Reports label and shortcut text; "AND the Reports navigation and shortcut keys exist in both") |

Drift correction to note: main `backoffice-shell` never listed the `escalation` entry (`/coordination`, label "Solicitudes escaladas" in `es`, "Escalated requests" in `en`) in its tables. The tables now match what ships, which is a small addition beyond the delta, requested for this archive. The user-roles spec scenario "Menu per role" still covers the entry's role gating.

Readback (expected = delta block, actual = merged main block, paths abbreviated). The only differences are the rebase edits above, the dropped `(Previously: ...)` lines and, in "Scope limited to write events", the order of two scenarios (main keeps its own "Coordinator read is in scope" before "Student own read is out of scope"):

```
audit-log__Closed-set-of-report-events:
< (S3). The entity types MUST gain `Carrera`, and each event MUST use it with the
< coordinator's `carreraId` as entity id. Events MUST be built only through the
< central builders. Existing events and payloads MUST be unchanged, and no schema
< change to the audit log is required.
---
> (S3). Each event MUST use the entity type `Carrera` (already in the set, added
> by the escalation events) with the coordinator's `carreraId` as entity id.
> Events MUST be built only through the central builders. Existing events and
> payloads MUST be unchanged, and no schema change to the audit log is required.
audit-log__Scope-limited-to-write-events:
< and the coordination report views and downloads (`solicitud.ranking.consultado`,
---
> and the coordinator's opens of the escalation list and of an escalated request
> detail (`escalamiento.cola.consultada`, `solicitud.consultada`), and the
> coordination report views and downloads (`solicitud.ranking.consultado`,
< (Previously: the exception list stopped at the supporting-document reads and the staff queue and detail opens.)
> #### Scenario: Coordinator read is in scope  (kept from main; delta lacked it)
backoffice-shell__BS-HOME-1:
< Enrollment, Review requests, Reports, Asignaturas, Docentes, Import, Users);
> Enrollment, Review requests, Escalated requests, Reports, Asignaturas,
> Docentes, Import, Users);
< (Previously: ...)                          [dropped]
< | `coordinacion` | Reports, Asignaturas, Docentes, Users | yes |
> | `coordinacion` | Escalated requests, Reports, Asignaturas, Docentes, Users | yes |
backoffice-shell__BS-I18N-1:
< (Previously: ...)                          [dropped]
backoffice-shell__BS-NAV-1:
< ... with two additions: the Enrollment entry ... and the Reports entry ...
> ... with three additions: Enrollment; Escalated requests (`canCoordinate`); Reports (`canViewReports`) ...
< (Previously: ...)                          [dropped]
< | `coordinacion` | Dashboard, Reports, Administration (Asignaturas, Docentes, Users), Settings |
> | `coordinacion` | Dashboard, Escalated requests, Reports, Administration (Asignaturas, Docentes, Users), Settings |
```

`diff -r` of the `coordination-reports` copy (`openspec/changes/coordination-reports/specs/coordination-reports/spec.md` vs `openspec/specs/coordination-reports/spec.md`): empty, exit 0.

## Archive move

`git mv openspec/changes/coordination-reports openspec/changes/archive/2026-11-18-coordination-reports`. The source is absent afterwards. Readback `diff -r <pre-move snapshot> openspec/changes/archive/2026-11-18-coordination-reports`: empty, exit 0. The rename is staged by `git mv`; untracked files (`verify-report.md`) moved with the folder and are not yet added.

Archive contents: `proposal.md`, `explore.md`, `design.md`, `specs/` (three delta specs), `tasks.md`, `apply-progress.md`, `verify-report.md` and this `archive-report.md` (additive, excluded from the readback).

Task completion gate: no unchecked task in `tasks.md`. No stale-checkbox reconciliation was performed; task 5.4 was completed by doing it.

## Roadmap

`docs/roadmap.md` was updated before this phase (task 5.1 to 5.3, 2026-11-18): row 7 `archivado`, row 5 gains `RF-13 (c)`, and the closing "Pendiente: sincronizar RF-18 con la matriz de la tesis" note. It was not edited again here.

## Open items after close (outside this change)

1. Commit and merge this archive branch (`docs/coordination-reports-archive`); `main` auto-deploys, and this branch carries documentation only. Keep the change branches.
2. Optional: an integration test of the three rankings on a disposable Neon branch (W1), and a manual open in Excel or LibreOffice (W3), each needing the owner's consent.
3. Owner decisions left open: a visible prefix for formula-like names; a row cap or chunked batches for the export; whether a teacher snapshot is wanted (CR-LIMIT-1).
4. Thesis review: sync the RF-18 row with the thesis requirements matrix (roadmap note).
5. Repo hygiene (W4): the unused `SidebarGroupLabel` import from commit 40b9edf.

## Traceability

- Engram observation IDs read: none. The store is `openspec`; every required artifact was read from its file locator under `openspec/changes/coordination-reports/` (`proposal.md`, `specs/*`, `design.md`, `tasks.md`, `verify-report.md`, plus `apply-progress.md` and `explore.md`).
- Engram counterparts that exist but were not read (topic keys in project `justifia`): `sdd/coordination-reports/explore` #457, `proposal` #458, `spec` #459, `design` #460, `tasks` #461, `apply-progress` #462, `verify-report` #466.
- Commits referenced: b82b359 (`main` tip at verify and archive), 34e40bb (compact detail table fix), f2ea790 (anchored export no-limit assertion), 40b9edf (sidebar label commit behind W4), 37af974 (reports navigation entry).
- Engram save: topic key `sdd/coordination-reports/archive-report`, type `architecture`, project `justifia`.
