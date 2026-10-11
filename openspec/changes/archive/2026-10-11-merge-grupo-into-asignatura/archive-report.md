# Archive report: merge-grupo-into-asignatura

Change: merge-grupo-into-asignatura (option A, UI and routing only; no schema change)
Project: justifia | Store mode: hybrid | Archived: 2026-10-11
Archive location: openspec/changes/archive/2026-10-11-merge-grupo-into-asignatura/
Close outcome: archived with warnings, approved by the owner on 2026-10-11.

## State at close

This section records the state at close and outranks the earlier snapshots in apply-progress.md and verify-report.md.

- Implementation: commit f873b38 "fix(catalog-management): manage groups from inside their asignatura", merged to main as PR #15. The "uncommitted" statement in apply-progress.md is a stale snapshot.
- Tasks: 60/60 ticked. Owner task 0.5 was confirmed by the owner on 2026-10-11 (every plan assumption accepted as recommended). Owner tasks 6.9 and 6.10 (browser walk-through with a session) were reported passing by the owner on 2026-10-11; they are manual evidence.
- Verify (2026-10-11, evidence_revision sha256:c1c8020b137fd5ce70b8879ca7320fd074eb251b30865d5c21f436efe63b523e): verdict pass_with_warnings, 0 blockers, 0 CRITICAL, 14/14 requirement blocks, 77/77 scenarios, `npm test` exit 0 (146 files, 2919 tests), typecheck and build exit 0. The figures in apply-progress.md (144 files, 2900 tests) are an earlier snapshot.
- Runtime attempt: settled `complete`.
- Review gate: absent (receipt-driven development is off), so ordinary repository policy applies.

## Warnings carried (none blocking)

- W1: three CM-ASG-9 row-counting scenarios (several groups, pagination, name plus group) are verified structurally on rendered SQL plus the owner check, not on executed data.
- W2: owner tasks 6.9 and 6.10 are manual evidence. The status of the old edit URL redirect and the not-found answers for signed-in users rest on them.
- W3: the DataTableSearch `key={value}` fix has a unit test but was not re-checked in a browser.
- W4: apply-progress.md is a stale snapshot, and f873b38 carries an unrelated `package-lock.json` change.

## Suggestions carried

- S1: the plan was seven commits; it landed as one.
- S2: `src/i18n/catalog-parity.test.ts` was rebuilt during batch 4 after an editing mistake and should be skimmed in review.
- S3: a vitest worker-termination notice appeared for `grupo-form.test.tsx` under full-suite load (the file passed).

## Spec sync: openspec/specs/catalog-management/spec.md

- Requirement blocks: 30 before, 33 after (5 added, 2 removed, 7 replaced in place, 21 untouched).
- ADDED: CM-GRP-9 Create a Grupo under its Asignatura; CM-GRP-10 Edit a Grupo under its Asignatura; CM-GRP-11 Outcome of saving a Grupo; CM-ASG-9 Asignaturas search also finds groups by periodo or docente; CM-RTE-1 Retired Grupos URLs redirect.
- MODIFIED (whole block replaced): CM-SCOPE-1, CM-SCOPE-2, CM-NAV-1, CM-LST-1, CM-ASG-7, CM-ASG-8, CM-GRP-1.
- REMOVED: CM-GRP-7 The Grupos list shows the days (the standalone `/catalog/grupos` list is retired; its scenarios moved into CM-ASG-7). CM-GRP-8 Preselected Asignatura on the new Grupo page (the `asignaturaId` query is retired and the Asignatura now comes from the route; covered by CM-GRP-9 and CM-RTE-1).
- A pointer bullet was appended to "Assumptions and open questions", as the delta asks.
- The delta's change-level sections (summary, traceability, assumptions, "What does not change", "Reviewed without delta") were not merged; they stay in the archived delta.
- Line endings: the main spec stays CRLF. The delta is LF and was converted on merge.
- Check: every MODIFIED and REMOVED title matched exactly once in the main spec before writing. Added and replaced blocks were read back against the delta with no difference, and untouched blocks are identical.

## Archive move

- The change folder was moved to openspec/changes/archive/2026-10-11-merge-grupo-into-asignatura/ with a plain move. Nothing was staged or committed.
- A recursive diff of a pre-move snapshot against the archived folder was empty.

## Roadmap

docs/roadmap.md has no row for this change, so it was not edited.

## Engram

Topic key: `sdd/merge-grupo-into-asignatura/archive-report`. The verify report is under `sdd/merge-grupo-into-asignatura/verify-report`.
