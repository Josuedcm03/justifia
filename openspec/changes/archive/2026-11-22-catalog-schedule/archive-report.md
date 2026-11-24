# Archive Report: catalog-schedule

**Change**: catalog-schedule (RF-12 (a) to (c), RF-17 (b), (d), (e), RN-21, RNF-01, RNF-02, RNF-06, RNF-12; RN-27 related)
**Archived**: 2026-11-22, to `openspec/changes/archive/2026-11-22-catalog-schedule/`
**Artifact store**: openspec (repo-local). No Engram observation IDs are recorded: the store is openspec, and this archive phase ran without Engram tool access, so no `mem_search` or `mem_get_observation` call was made.
**Branch**: `feat/catalog-schedule-archive`. Everything this phase changed is uncommitted; the owner commits. No push and no PR were made by the archive phase.
**Archive mode**: intentional-with-warnings. All 119 top-level checkboxes for implementation, verification and walk work are `[x]`. Two closeout items stay open by design: 17.1 (re-run on `main` after the merge chain) and 17.6 (owner merge order). Neither is an implementation task, and the archive was directed with them open (orchestrator instruction, 2026-11-22). No stale-checkbox reconciliation was used.
**Whole-change verdict**: `pass_with_warnings` (`verify-report.md`, `evidence_revision` sha256:82bb16a40faadae393ba79c9061bd5899b4d27f181b8482271fbf9e8f4d2f957, 0 critical, 21/21 requirements, 70/70 scenarios, `npm test` 9623/9623, `tsc` 0 errors, build ok, all at the verify revision of 2026-11-21). The warnings are listed in section 6. W1 was resolved on 2026-11-22.

## 1. Artifacts read

| Artifact | Locator (openspec) | Read |
|---|---|---|
| tasks | `openspec/changes/catalog-schedule/tasks.md` | yes (121 top-level checkboxes) |
| verify-report | `openspec/changes/catalog-schedule/verify-report.md` | yes (intermediate snapshot, 2026-11-21) |
| spec (delta, student-enrollment) | `openspec/changes/catalog-schedule/specs/student-enrollment/spec.md` | yes |
| spec (delta, academic-catalog) | `openspec/changes/catalog-schedule/specs/academic-catalog/spec.md` | yes |
| spec (delta, audit-log) | `openspec/changes/catalog-schedule/specs/audit-log/spec.md` | yes (amended on 2026-11-22 for W1) |
| spec (delta, backoffice-shell) | `openspec/changes/catalog-schedule/specs/backoffice-shell/spec.md` | yes |
| spec (delta, enrollment-administration) | `openspec/changes/catalog-schedule/specs/enrollment-administration/spec.md` | yes |
| roadmap | `docs/roadmap.md` (row 0 and the notes) | yes |
| format reference | `openspec/changes/archive/2026-11-19-data-retention/archive-report.md` | yes (shape only) |

`proposal.md`, `design.md`, `exploration.md` and `apply-progress.md` were not read in this phase. They move with the folder and were not used as final-state sources. Engram was not consulted.

## 2. Final-state facts (ranked)

Ranking follows the `sdd-archive` Final-State Authority: (1) native review authority, (2) the persisted tasks artifact, (3) the launch prompt, (4) intermediate snapshots (`verify-report`, `apply-progress`). This change has no native review receipt in its status (no review was started), so rank 1 does not apply.

| Fact at close | Rank and source | Where it landed |
|---|---|---|
| Verify 17.2 done: PASS WITH WARNINGS, 0 critical, 21/21 requirements, 70/70 scenarios | 4, `verify-report` (2026-11-21), marked done by 2, tasks | tasks 17.2 |
| W1 (student-search audit `periodo: ""`) resolved by the owner; no code change | 3, launch prompt; the audit-log delta now states it | audit-log delta, "One audit row per staff read of inscriptions"; tests pinned in `CI/assign/page.test.tsx` |
| Walk 16.1 to 16.7 done; walk branch `br-rough-pond-aykqxjdg` deleted on 2026-11-21 | 2, tasks | tasks 16.1 to 16.7 |
| Walk feedback fixed in `ab37d5d` (modal `ActiveToggle` confirm, clear-filters link) | 3, launch prompt; `verify-report` section "Walk-feedback commit" | tasks 16.3, 16.4 |
| Walk seed in `97de35d` (`npm run db:seed:walk`) | 3, launch prompt; tasks 16.2 | tasks 16.2 |
| Code PRs #99, #100, #101, #103, #105, #108, #130 to #140: all open, none merged | 3, launch prompt | tasks 17.6 (owner) |
| 17.1 and 17.6 open | 2, tasks | tasks 17.1, 17.6 |
| Out of scope: Docentes gap of RF-12 (a); RN-22 clock-time schedules | 3, launch prompt | roadmap row 0 note, kept |

### Verify-report statements superseded at close

Each statement below was true when `verify-report` was written (2026-11-21) and is not the state of the change at close. They are recorded here so no reader treats them as open.

- "Tasks incomplete 7 (16.7, 17.1 to 17.6)". Superseded. At close, 119 of 121 top-level tasks are `[x]`; 16.7 was `[x]` in `tasks.md` (rank 2) and 17.2 to 17.5 are now `[x]`. Open: 17.1 and 17.6.
- "W1 ... Owner decision needed". Superseded. Resolved 2026-11-22 by the owner (section 6).
- "Remaining before archive" (17.2 to 17.5, 16.7). Superseded. Done in this archive, or in `tasks.md` (16.7 done 2026-11-21).
- "Working copy has an uncommitted change (W7)". Still true at archive: the tasks walk record and the spec and roadmap edits of this archive are uncommitted.

## 3. Specs synced

| Domain | Action | Details |
|---|---|---|
| student-enrollment | Updated (delta merged) | ADDED 1 requirement "Student writes only their own; the secretaría writes under RF-12 (a) (RF-17 a, RF-12 a, RN-21) [S2, S3]" with 5 scenarios. Purpose sentence updated (section 3.1). Requirements 13 to 14. |
| academic-catalog | Updated (delta merged) | MODIFIED "Estudiante role integrity of Inscripcion.EstudianteId" (6 scenarios, "(Previously: ...)" note kept). Requirements 13 to 13. |
| audit-log | Updated (delta merged) | MODIFIED "One audit row per enrollment change, same transaction (RNF-06)" (3 scenarios). ADDED "Staff enrollment events are distinguishable and add nothing" (2 scenarios) and "One audit row per staff read of inscriptions" (4 scenarios, including the blank search and the `periodo: ""` payload of W1). Requirements 35 to 37. |
| backoffice-shell | Updated (delta merged) | MODIFIED "BS-NAV-1 Sidebar entries are unchanged" (6 scenarios) and "BS-HOME-1 Role-aware dashboard home" (6 scenarios), each with its "(Previously: ...)" note kept. ADDED "BS-NAV-4 Inscripciones destination for the secretaría" (3 scenarios). Requirements 15 to 16. |
| enrollment-administration | Created (new capability, no delta headers) | 13 requirements (EA-ACC-1, EA-SCOPE-1, EA-PII-1, EA-LIST-1, EA-FILT-1, EA-DEG-1, EA-DEACT-1, EA-REACT-1, EA-SIB-1, EA-CHG-1, EA-CRE-1, EA-WRITE-1, EA-UI-1) and 36 scenarios. Its Purpose and Terms are kept. |

### 3.1 Purpose sentence (student-enrollment)

Before: "Out of scope (D9, D10): staff view or editing of enrollments, an `Origen` column or any schema change, a secretaria approval queue, past or configurable periods, institutional API sync."

After: "Out of scope (D9, D10): an `Origen` column or any schema change, a secretaria approval queue, past or configurable periods, institutional API sync. Staff maintenance of enrollments (the secretaría's view and edits) is specified in the `enrollment-administration` capability, not here."

This is the update the delta header requested, and it is task 17.3.

### 3.2 Deliberate differences from the delta text

- **Line endings.** Main specs are CRLF; the change folder stores its deltas as LF. Every inserted block was converted to CRLF. The text itself is unchanged (see section 4, which compares with CR stripped).
- **enrollment-administration header.** The delta's `## ADDED Requirements` heading and the blank line after it were removed, because a main spec carries no delta headers (launch instruction). The title, the "(new capability)" line and the Purpose stay.
- **Not changed.** Requirement text and scenarios of every delta are byte-equal to the main spec blocks, apart from line endings.

## 4. Spec-sync readback

### 4.1 Copy readback (mechanical, before any edit)

The new capability was copied with `cp`. The `diff -r` of the copy against its source was run before any edit and was empty. Its verbatim output is in the archive phase result.

### 4.2 Block readback (each delta block against its main block, CR stripped)

| Delta block | Delta lines | Main file | Main line | Lines | Result |
|---|---|---|---|---|---|
| "Student writes only their own" | 9 to 51 | student-enrollment | 407 | 43 | MATCH |
| "Estudiante role integrity of Inscripcion.EstudianteId" | 5 to 72 | academic-catalog | 142 | 68 | MATCH |
| "One audit row per enrollment change, same transaction (RNF-06)" | 5 to 56 | audit-log | 880 | 52 | MATCH |
| "Staff enrollment events are distinguishable" | 60 to 129 (both ADDED blocks) | audit-log | 1312 | 70 | MATCH |
| "One audit row per staff read of inscriptions" | 85 to 129 | audit-log | 1337 | 45 | MATCH |
| "BS-NAV-1 Sidebar entries are unchanged" | 9 to 73 | backoffice-shell | 94 | 65 | MATCH |
| "BS-HOME-1 Role-aware dashboard home" | 75 to 136 | backoffice-shell | 339 | 62 | MATCH |
| "BS-NAV-4 Inscripciones destination for the secretaría" | 140 to 172 | backoffice-shell | 543 | 33 | MATCH |

### 4.3 Structural readback

- Requirement headings (`### Requirement:`) before to after: student-enrollment 13 to 14, academic-catalog 13 to 13, audit-log 35 to 37, backoffice-shell 15 to 16. Each delta title occurs once as a heading. The academic-catalog title string also appears once in the body at line 488 ("Assumptions and open questions"); that is a reference, not a second heading.
- Scenarios (`#### Scenario`) after the merge: student-enrollment 44, academic-catalog 41, audit-log 119, backoffice-shell 46, enrollment-administration 36 (= delta count 36).
- Line counts: student-enrollment 405 to 449; academic-catalog 479 to 491; audit-log 1331 to 1407; backoffice-shell 560 to 597. Each matches the removed and added block sizes.
- Line endings: all lines of the four main specs and the new capability are CRLF.
- The new capability differs from its delta only by the removed header: the readback `diff --strip-trailing-cr` shows `45,46d44` (the two header lines) and nothing else.

## 5. Task reconciliation and roadmap

- `tasks.md`: 121 top-level items, 119 `[x]`, 2 `[ ]` (17.1 and 17.6). Sub-notes are dated (2026-11-21 and 2026-11-22). No stale checkbox was reconciled.
- 17.2 to 17.5 are `[x]` with dated notes. 17.1 and 17.6 are `[ ]` with the reason recorded in the sub-note.
- Roadmap row 0: state `archivado` (same width as `pendiente`). Its note now reads "(archivado el 2026-11-22)", the sentence "El estado pasa a `archivado` cuando se archive el change." is removed, and the notes on the RF-12 (a) docentes gap and RN-22 are kept.

## 6. Warnings carried at close (final state, ranked)

Numbers come from `verify-report` (2026-11-21), which is an intermediate snapshot. Status at close is stated next to each item.

- **W1, resolved 2026-11-22.** The student-search audit row carries `periodo: ""`. Owner decision: the audit-log delta now states that the student search is not bound to a period (`periodo ""`, `status active`, only `q` present) and that a blank term reads and audits nothing. No code change. Pinned by `CI/assign/page.test.tsx`.
- **W2, open.** Walk-feedback commit `ab37d5d` has no batch or TDD evidence in `apply-progress.md`. The `ActiveToggle` `confirmIn="dialog"` mode has no direct test in `active-toggle.test.tsx`; it is covered only through the inscripciones table tests (verify suggestion S1, not done).
- **W3, open (evidence limit).** Writer lock, scope predicate, rollback and race are proven on the scripted DB double, not against a real database. The owner walk exercised the real paths on a disposable branch. A real-database concurrency test (verify suggestion S2) was not written.
- **W4, pre-existing.** `npm run lint` exits 1 because of the CRLF checkout artifact (156,420 "Delete CR") and pre-existing findings in `docs/utils/ocr-spike/*.mjs`, `src/test/access/inventory.ts` and an unused import in `src/components/app-sidebar.tsx`. None was introduced by this change. ESLint on the changed files reports 0 errors.
- **W5, open (evidence limit).** Not separately confirmed in the walk: the refused reactivation of `walk.est.a.bloqueado`, and the student `/enrollment` view after a staff write. Both are covered by automated tests; the student view is proven by mechanism (only `Inscripcion.Activo` is read).
- **W6, open (evidence limit).** EA-UI-1 "Documents synchronised" has no automated test. Evidence is the executed readback of `docs/roadmap.md` and `docs/requirements.md`, and `docs/requirements.md` changed only by additions.
- **W7, still true at close.** The change is uncommitted: the walk record in `tasks.md`, the spec merges, the roadmap row and this archive. The owner commits.

Verify suggestions at close: S3 (Purpose sentence) done in this archive; S4 (the RN-27 sentence is always shown in the deactivation dialog, a superset of the conditional spec text, compliant) recorded, not changed; S1 and S2 open (see W2 and W3).

### Walk-feedback commit and size exceptions

- `ab37d5d`: the deactivation confirm is a modal alert dialog (`ActiveToggle confirmIn="dialog"`), not the inline panel named in design CS-8. The inline default of `ActiveToggle` is unchanged for the other catalog pages. The clear-filters link follows the same commit.
- Size exceptions accepted by the owner, recorded per the verify request: S1c-1 table (1064 authored lines, 2026-11-19); S1c-2 page (852, 2026-11-20); S3a-3 assign action (993 for the branch total, 616 for the optimistic-check commit, 2026-11-21); S3b-1a assign page (1728, then 1848 with 14b, 2026-11-21). All are in `tasks.md` Phases 4, 5, 13 and 14.

## 7. Out of scope (for the roadmap and the report)

- The docentes gap of RF-12 (a): docente maintenance is not covered by this change.
- RN-22: clock-time schedules are not covered by this change.

## 8. Open items (not blocking this archive)

1. 17.1: re-run `npm test`, typecheck, lint and `npm run build` on `main` after the last slice merges, and record the result in `tasks.md`. Owner or post-merge.
2. 17.6: merge order of PRs #99 to #140 into `main`, retargeting, and deletion of the merged slice branches and `feat/catalog-schedule`. Owner.
3. Commit this archive (folder move, spec merges, roadmap row, tasks notes, `verify-report.md`). Owner.
4. W2, W3, W5, W6 and verify suggestions S1 and S2 (section 6).

## 9. Mechanical copy and move readback

- Spec sync: the new capability was copied with `cp` and checked with `diff -r` before any edit (section 4.1). The four merged main specs were produced by splicing the delta blocks with `head`, `tail` and `perl` (no model Read/Write of artifact content); the block readback is in section 4.2.
- Archive move: the change folder was snapshotted with `cp -R` before the move, then moved with `git mv` (or `mv` if `git mv` refused). This report was written before the snapshot, so it is part of the compared tree. The readback is `diff -r` of the snapshot against `openspec/changes/archive/2026-11-22-catalog-schedule/`; its verbatim output is in the archive phase result, not in this file, because the file is part of the compared tree.
- Nothing was committed, pushed or opened as a PR.
