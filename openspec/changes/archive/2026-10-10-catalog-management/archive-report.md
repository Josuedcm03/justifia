# Archive Report: catalog-management

**Change**: catalog-management
**Archive Date**: 2026-10-10
**Repository**: justifia (branch `feat/sidebar-catalogs`, HEAD `d3a3997`, not committed)
**Archive Type**: intentional-with-warnings (owner-authorized on 2026-10-10)
**Final Status**: ARCHIVED with four owner tasks carried over open. Verification verdict `pass_with_warnings` (0 CRITICAL, 6 WARNING, 6 SUGGESTION).

---

## Executive Summary

The `catalog-management` change is archived. Its delta specs were merged into the main specs: three existing capabilities were updated (`academic-catalog`, `audit-log`, `catalog-excel-import`) and one new capability was created (`catalog-management`). The owner authorized the archive explicitly on 2026-10-10, including the destructive removal of the requirement "Facultad, Carrera and Asignatura are never deactivated" from `academic-catalog` (re-stated narrower under "Asignatura lifecycle") and archiving with four owner tasks still open. The next change, `merge-grupo-into-asignatura`, is planned and has not started.

---

## Final-State Facts (at close)

These facts come from the launch authorization of 2026-10-10 and the repository. They outrank the intermediate snapshots `verify-report.md` and `apply-progress.md`.

- Implementation: Phases 1-22 applied and committed. HEAD is `d3a3997` ("feat(catalog-management): enhance i18n and add groups functionality for Asignaturas"). Uncommitted at close: `tasks.md` (waivers, the 15.8 tick, the 15.9 tick) and `verify-report.md`.
- Tests and checks (per the verification of 2026-10-10 and the final-state facts): `npm test` 99 files, 2347/2347 passed; typecheck clean; build OK.
- Migrations `0005` (catalog management columns and `Origen`) and `0006` (meeting days, `Dias`) are applied and verified on production.
- Tasks at close: 376 total; 372 ticked (15.9 ticked by this archive; 17 of the ticked are WAIVED, see below); 4 open (see "Carried-over open tasks").
- The verify-report counts (370 ticked, 6 open, including 15.8 and 15.9) are superseded: 15.8 was ticked on 2026-10-10 and 15.9 is ticked by this archive.
- `catalog-excel-import` was archived on 2026-10-04 (`openspec/changes/archive/2026-10-04-catalog-excel-import`), so the archive order required by task 15.9 is satisfied.

### Native review gate

`gentle-ai review mode status` (read-only) reports receipt-driven development off, decided by default. Per the Native Review Receipt Gate, `reviewGate` is structurally absent, so archive proceeds under ordinary repository policy.

### Task Completion Gate

Four implementation-adjacent owner tasks remain unchecked. They are not stale checkboxes: they are open owner checks and housekeeping. The owner explicitly authorized archiving with them open, so the archive is intentional-with-warnings. No checkbox was reconciled as stale.

---

## Specs Merged (Archive Time)

Merge procedure: the delta requirement blocks were copied by a script that slices the delta file's bytes (CRLF preserved). No requirement text was typed by the model. Each title was checked to exist exactly once before a MODIFIED or REMOVED operation. Each ADDED or MODIFIED block was verified present verbatim exactly once in the merged file, and each REMOVED heading was verified absent. The merged file was read back from disk.

| Capability | Req before | Added | Modified | Removed | Req after | Scen before | Scen added | Scen modified (net) | Scen removed | Scen after |
|---|---|---|---|---|---|---|---|---|---|---|
| academic-catalog | 7 | 7 | 3 | 1 | 13 | 20 | +14 | +2 | -1 | 35 |
| audit-log | 5 | 4 | 0 | 0 | 9 | 15 | +17 | 0 | 0 | 32 |
| catalog-excel-import | 13 | 8 | 5 | 0 | 21 | 40 | +33 | +8 | 0 | 81 |
| catalog-management (new) | 0 | 30 | 0 | 0 | 30 | 0 | +102 | 0 | 0 | 102 |

Per-capability detail:

- **academic-catalog**. ADDED: "Asignatura lifecycle", "Asignatura Codigo is immutable after creation", "Grupo origin marker", "Manual writes require an active Asignatura and an active docente", "Additive schema for catalog management", "Grupo meeting days (AC-DIAS)", "Additive schema for meeting days (AC-DIAS-ADD)". MODIFIED: "Active-only reads for downstream consumers" (4 to 6 scenarios), "Asignatura shape and natural key" (4 to 4), "Grupo shape, natural key and period format" (4 to 4). REMOVED: "Facultad, Carrera and Asignatura are never deactivated" (1 scenario, "Absent asignatura stays"; re-stated under "Asignatura lifecycle" as "Absent asignatura stays unchanged").
- **audit-log**. ADDED: "Closed set of manual catalog events", "One audit row per manual write, in the same transaction", "Manual event payloads carry field names only", "Import audit: import-level record plus one event per reactivated Asignatura". No MODIFIED or REMOVED.
- **catalog-excel-import**. ADDED: "Import precedence over manual edits", "Preview reports manual-group deactivations and reactivations", "Copy for the new preview figures", "Apply reports busy when it cannot start", "Grupos sheet accepts an optional days column (CEI-DIAS-1)", "Day tokens in the Dias cell (CEI-DIAS-2)", "Days semantics on apply (CEI-DIAS-3)", "Template and contract document the days column (CEI-DIAS-4)". MODIFIED: "Per-row validation with row-level errors", "Dry-run report persists nothing", "Natural-key upserts", "Deactivate absent, never delete", "Import-level audit record". REMOVED: none (the delta's REMOVED section is "None").
- **catalog-management**. New capability. `openspec/specs/catalog-management/spec.md` is an exact copy of the delta spec (30 requirements, 102 scenarios), made with `cp`, with no edits.

Requirement titles and ids are preserved exactly, as `merge-grupo-into-asignatura` requires.

### Scope of the merge

Per the archive procedure, only requirement blocks were merged. Two kinds of delta text were not merged into the main specs (they remain in the archived delta files):

- The preface blockquotes and the "Assumptions and open questions" sections of the three delta files. Notably, the `academic-catalog` main Purpose sentence ("`Facultad`, `Carrera` and `Asignatura` have no `Activo` column") and its Entity table row for `Grupo` (no `Origen`) still show the pre-change facts.
- The `catalog-management` main spec is a verbatim copy, so its header blockquote still reads "Delta type: this whole file is ADDED. There is no base spec for `catalog-management`." That sentence is stale after this archive.

---

## Verification (intermediate snapshot, per `verify-report.md`, 2026-10-10)

Verdict `pass_with_warnings`: 0 CRITICAL, 6 WARNING, 6 SUGGESTION. 57 of 57 requirements covered by passing tests; 209 scenarios mapped at requirement level (the delta files contain 209 scenario headings: 102 + 28 + 62 + 17).

The six warnings, one line each:

- **W1**: 17 owner checks are waived and were not executed; browser, accessibility and coordinacion-role behaviour are unexercised, with partial real-database evidence on `rehearsal-0006` (secretaria only).
- **W2**: Owner acceptance of the over-budget review pieces was never recorded (no `size:exception`; about 22,830 lines against a forecast of 11,800-18,650).
- **W3**: No TDD RED-first evidence for tasks 13.8-13.11 (the tests exist and pass).
- **W4**: Some behaviours are proven only by test doubles (COMMIT after a caught 23505; real-group days replace/keep; a mixed multi-row insert; coordinacion scope in a real session; `not-found.tsx` in the dashboard layout; combobox and checkbox behaviour in a browser).
- **W5**: Owner decisions still open: the generic message for an inactive Asignatura on Grupo edit; the docente combobox shows the name only; whether the 2026-10-06 production import was intentional; a browser recheck of the `nav.catalogGrupos` message.
- **W6**: Branch housekeeping (15.7) not done: `rehearsal-0006`, `backup-before-0006`, `backup-before-0005` and `backup-before-0004-audit` still exist; production is unaffected.

The six verify SUGGESTIONS (S1 CRLF lint noise; S2 `db:push` script still in `package.json`; S3 mechanical scenario trace; S4 archive before the next change, satisfied by this archive; S5 stale dated counts in the `tasks.md` header; S6 `NumeroGrupo` text ordering) remain open and are not blockers.

---

## Waived Tasks (17, owner decision 2026-10-09, not executed as written)

Superseded by `merge-grupo-into-asignatura`, which removes or rewrites these screens. Partial evidence is in `apply-progress.md`.

9.12, 9.13, 10.15, 12.13, 13.13, 13.14, 15.6, 17.30, 17.31, 19.14, 19.15, 20.13, 20.14, 21.7, 21.8, 22.10, 22.11.

---

## Carried-over Open Tasks (4, owner-authorized archive with these open)

- **14.10** [USER] Read-only smoke as each role (the Docentes page needs no write).
- **14.11** Checkpoint WU5 for the owner (no credential field in the projection, `/users` link, complete sidebar table).
- **15.7** [USER][CONFIRM] Neon branch housekeeping: `rehearsal-0006`, `backup-before-0006`, `backup-before-0005`, `backup-before-0004-audit` still exist.
- **18.11** Checkpoint WU-D3 for the owner (days selector: native controls, fieldset/legend, 44px rows, no colour-only state, parity of day names).

Task 15.9 (this archive) is ticked with the date.

---

## Follow-ups for the Next Change (`merge-grupo-into-asignatura`)

- Its delta specs were written against the main specs as they stand after this archive. Requirement titles and ids are unchanged.
- It removes the Grupo entity and the Grupos screens. The `catalog-management` main spec (CM-GRP-6, CM-GRP-7, CM-GRP-8, CM-ASG-7, CM-ASG-8 and others) will then need MODIFIED or REMOVED deltas; verify S4 recommends this sequencing.
- Stale text carried verbatim (see "Scope of the merge"): the `academic-catalog` Purpose sentence and Grupo table row; the `catalog-management` header blockquote; the delta "Assumptions" sections, which were not merged.
- Verify S2: the `db:push` script in `package.json` remains a standing hazard for the shared database. Removing it is a candidate follow-up.
- The four open tasks above (14.10, 14.11, 15.7, 18.11) are carried over and need owner action; they are not blockers for the next change.

---

## Engram Traceability

This executor could not call Engram (`mem_search`, `mem_get_observation`, `mem_save`) from its tools. The artifacts were read from the OpenSpec files in hybrid mode, so no observation IDs were retrieved. The orchestrator is responsible for persisting `sdd/catalog-management/archive-report` with this file's content.

---

## Archive Folder Contents

Archived to `openspec/changes/archive/2026-10-10-catalog-management/` (10 files at move time, verified by `diff -r` against a pre-move snapshot):

- `proposal.md`, `exploration.md`, `design.md`
- `specs/academic-catalog/spec.md`, `specs/audit-log/spec.md`, `specs/catalog-excel-import/spec.md`, `specs/catalog-management/spec.md`
- `tasks.md` (372 ticked, 4 open; 15.9 ticked with the date)
- `apply-progress.md`, `verify-report.md`
- `archive-report.md` (this file, written after the readback)

Main specs updated: `openspec/specs/academic-catalog/spec.md`, `openspec/specs/audit-log/spec.md`, `openspec/specs/catalog-excel-import/spec.md`; created: `openspec/specs/catalog-management/spec.md`.

Nothing was committed, staged, pushed, stashed or branched. No source file under `src/` and no database was touched.

---

## Change Closure

**SDD Cycle**: Proposal, specs, design, tasks, apply (Phases 1-22), verify (`pass_with_warnings`) and archive (intentional-with-warnings, owner-authorized 2026-10-10).

The change is archived. Its four carried-over owner tasks and the six verify warnings are recorded above and are not blockers for the next change.
