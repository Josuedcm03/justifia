# Archive Report: student-enrollment

**Archived**: 2026-10-25
**Archive folder**: `openspec/changes/archive/2026-10-25-student-enrollment/`
**Branch**: `chore/archive-student-enrollment` (worktree `justifia-worktrees/student-enrollment`), from `origin/main` at `4abd752`
**Store mode**: hybrid (files plus Engram)
**Close status**: `intentional-with-warnings`. The owner decided on 2026-10-25 to close the change with a PARTIAL owner walk (Phase 13). The open items are listed under "Warnings and open items".

## Artifact sources

Engram tools (`mem_search`, `mem_get_observation`, `mem_save`) were not available to this executor, so the `sdd/student-enrollment/*` topics could not be read or saved. The archive used the file artifacts in this folder instead. No Engram observation IDs are recorded here. The Engram topic `sdd/student-enrollment/archive-report` was NOT saved; this file is the persisted report.

Files read: `proposal.md`, `exploration.md`, `design.md`, `tasks.md`, `verify-report.md`, and the six delta specs under `specs/`.

## Gates

- **Native review gate**: `gentle-ai review status --next-transition` returned `rdd_disabled` (receipt-driven development is off, decided by default). `reviewGate` is structurally absent, so the archive proceeds under ordinary repository policy.
- **CRITICAL findings**: `verify-report.md` front matter reports `critical_findings: 0`, `blockers: 0`, verdict `pass_with_warnings`. No CRITICAL blocks the archive.
- **Task Completion Gate**: unchecked items remain. The owner-approved partial archive covers Phase 13 (13.2 to 13.5). Item 12.3 is not covered by that approval and is recorded as an intentional warning. No stale checkbox was reconciled by the archive; every checked box was either already checked or closed with recorded evidence.

## Verification snapshot (intermediate)

Per `verify-report.md` at verification time: `npm test` 246 files, 5344 tests passed; `npm run build` exit 0; 24/24 requirements, 92/92 scenarios (83 COMPLIANT, 9 PARTIAL, 0 FAILING, 0 UNTESTED). The verify-report `Remediation` section records a later gate run after the remediation commits: 246 files, 5342 tests, all green. That later run is the latest recorded count. It is not re-run at archive time.

The 9 PARTIAL scenarios need a real database or a browser: atomicity, the race between writers, and the 360 px layout. The owner walk (Phase 13) is the planned evidence for them and is incomplete.

## Specs synced to `openspec/specs/`

| Capability | Action | Requirements |
|------------|--------|--------------|
| `student-enrollment` | Created (new capability, whole-file copy) | 13 added |
| `academic-catalog` | Updated | 2 replaced (`Estudiante role integrity of Inscripcion.EstudianteId`, `Active-only reads for downstream consumers`); Assumptions bullet "scope reduction" superseded |
| `audit-log` | Updated | 3 added (`Closed set of enrollment events (RNF-06)`, `One audit row per enrollment change, same transaction (RNF-06)`, `Enrollment payloads carry identifiers only (RNF-06, RNF-02)`) |
| `justification-intake` | Updated | 1 replaced (`Subject eligibility and group display (RF-04, RN-21, RN-22, D5, D15)`), 1 added (`Entry nudge when the student has no enrollment (RF-04, RN-21, RNF-11)`) |
| `student-requests` | Updated | 1 replaced (`Own requests list (RF-07 c, RNF-01)`) |
| `backoffice-shell` | Updated | 2 replaced (`BS-NAV-1 Sidebar entries are unchanged`, `BS-HOME-1 Role-aware dashboard home`), 1 added (`BS-NAV-3 Enrollment destination for students`) |

The academic-catalog Assumptions bullet "Assumption (scope reduction): no code in this change writes `Inscripcion`" is now a "Superseded" note that points to `student-enrollment` as the only writer of `Inscripcion`. The old text is kept in parentheses as history.

### Merge method

Replaced and added requirement blocks were spliced from the delta files with a byte-preserving script (`merge`). No artifact text was copied through model Read/Write. The merged working copies were normalized to CRLF to match the existing spec files; the delta sources are LF, so the only byte difference is line endings. The new `student-enrollment/spec.md` is a byte-identical copy (LF).

### Readback: new capability (verbatim)

```
$ diff -r changes/student-enrollment/specs/student-enrollment/spec.md specs/student-enrollment/spec.md
(no output, exit 0)
```

### Readback: merged requirement blocks

Each replaced or added block was extracted from the delta and from the merged main spec and compared with `diff --strip-trailing-cr` (line endings ignored). All 11 blocks match. The three ADDED blocks that are followed by another heading differ by one blank separator line in the main spec, which the delta block does not include (delta blocks end at end of file):

```
-- audit-log [added] Enrollment payloads carry identifiers only (RNF-06, RNF-02)
21a22
> 
-- justification-intake [added] Entry nudge when the student has no enrollment (RF-04, RN-21, RNF-11)
27a28
> 
-- backoffice-shell [added] BS-NAV-3 Enrollment destination for students
34a35
> 
```

## Files moved (`git mv`)

Source `openspec/changes/student-enrollment/` moved to `openspec/changes/archive/2026-10-25-student-enrollment/` (11 files: `proposal.md`, `exploration.md`, `design.md`, `tasks.md`, `verify-report.md`, six delta specs). The source directory no longer exists.

Readback against a pre-move recursive snapshot (verbatim):

```
$ diff -r <snapshot>/source openspec/changes/archive/2026-10-25-student-enrollment
(no output, exit 0)
```

Post-move edits (authored, not copied): `tasks.md` (Phase 12.2b, 12.3, 13, 14 records) and this `archive-report.md`. The readback after those edits differs from the snapshot in `tasks.md` only, as intended.

## Roadmap

`docs/roadmap.md` row 14 `student-enrollment`: `pendiente` changed to `archivado` (same value as the archived rows 1, 2, 3, 9, 11). The row's Notas bullet adds the archive date and a pointer to this partial-walk record.

## Phase 13 owner walk (PARTIAL, owner decision 2026-10-25)

Done:

- 13.1: disposable Neon branch `walk-student-enrollment` created.
- 13.3 (partial): enroll and full request passed with student `jdlevi`.
- 13.4 (partial): audit row `inscripcion.creada` has entity id equal to the student id and datos `{grupoId}`.

Incident: the local app ran against production. The worktree `.env` held the production `DATABASE_URL`, so the walk writes landed in production: `Inscripcion` (4,3), request #1 presented, and audit rows #10 to #13. The owner decided to keep them. They were not reverted.

Not done: 13.2 secretaria account walk; 13.3 replace, drop with draft warning and reactivation, empty states and nudges, other roles' nav, cross-carrera search, 360 px, es/en, keyboard; 13.4 remaining audit checks; 13.5 deletion of the walk branch.

## Delivery record

- PRs #44 to #51: feature-branch chain (tracker `feat/student-enrollment` #44, then slices #46 to #51).
- PR #52: landed #46 to #51 on `main`, because #44 merged before its children.
- Merge commits on `main`: `5e9c40a` (#44), `4abd752` (#52).
- Lesson: merge child into parent first, and the tracker last.

## Warnings and open items

1. **Production data**: the walk writes listed above are in production. The owner kept them. Their cleanup is not part of this archive.
2. **Worktree `.env`**: it held a production `DATABASE_URL`. The archive did not read or modify it. The owner should confirm it points to a non-production database.
3. **Unchecked tasks kept open**: 12.3 (gate re-run on the tracker head), 13.2, 13.3, 13.4, 13.5. Recorded as an intentional warning under the owner's partial-walk decision (12.3 is outside that decision and is flagged for the orchestrator).
4. **Walk-dependent evidence**: 9 PARTIAL scenarios (atomicity, race, 360 px) remain unproven against a real database or browser.
5. **Shared pins with `document-extraction`** (verify WARNING 4): `src/lib/audit/types.ts`, its pinned-count test, `i18n/*.json`, and `catalog-parity.test.ts` are shared. Whichever change merges second must reconcile the pins.
6. **Test count**: 5344 at verification; 5342 after the remediation commits per the verify-report. Not re-run at archive.
7. **Slice branches**: deletion of merged slice branches is not verified (14.5).
8. **Verify WARNING 3**: no `apply-progress` artifact exists for this change; RED-before-GREEN is not provable from history.
9. **Engram**: unavailable to this executor. No observation IDs recorded; the Engram archive-report topic was not saved.
