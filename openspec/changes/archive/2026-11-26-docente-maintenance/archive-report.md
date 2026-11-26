# Archive Report: docente-maintenance

**Change**: docente-maintenance (roadmap row 19; RF-12 (a), (b) for docentes; RNF-01, RNF-06 (a), RNF-12, RNF-13 (b))
**Archived**: 2026-11-26, to `openspec/changes/archive/2026-11-26-docente-maintenance/`
**Artifact store**: openspec (repo-local)
**Branch**: `feat/docente-maintenance-8-archive`, from `main` 2ef0ef1 (the merge of the tracker)
**Archive mode**: intentional-with-warnings. The folder was moved with 7.0 to 7.4 done. Tasks 7.5 (commit, documentation PR, tag) and 7.6 (delete the Neon branch `docente-it`) stay open by explicit instruction of the orchestrator: both need the owner's explicit yes. They are close-out steps, not implementation tasks, so the Task Completion Gate does not block on them. No stale implementation checkbox was found, so no reconciliation was performed.
**Verdict**: `pass_with_warnings` (`verify-report.md`, evidence at 9f747d0): 0 critical, 7 warnings at verification time. Strict coverage: 166 of 168 scenarios and 29 of 31 requirements; 2 PARTIAL (DM-11 student offer, DM-17 narrow viewport). See section 2 for the state of each warning at close.

## 1. Final state

Facts at close. They outrank the snapshot claims of `verify-report.md` and `apply-progress.md`, which were written earlier in the cycle.

| Fact at close | Evidence |
|---|---|
| Tracker `feat/docente-maintenance` merged into `main` | PR #166, merge commit 2ef0ef1, 2026-11-26 |
| Slices and evidence into the tracker | Slices #157 to #163; evidence #164 and #165 |
| Production deploy | Vercel production deploy success; `/login` answers 200; 2026-11-26 |
| Production gate, grupo under an inactive docente | 0 before the deploy (19:50 UTC) and 0 after it (19:56 UTC), read-only |
| Production gate, duplicate emails | 0 (informative count) |
| Migrations | 17, unchanged; no migration, dependency or environment variable changed by this change |
| Owner smoke test in production | 2026-11-26: as expected |
| Full test suite | `npm test`: 400 files, 10943 tests, exit 0 |
| Typecheck and ESLint | 0 and 0 |
| Build | `npm run build` rerun by the orchestrator at 9f747d0: exit 0 (resolves W5) |
| Postgres suite | 62 of 62 (owner-run) |
| Integration suite | 238 of 239; the one failure is the known `queue-index` baseline failure, unchanged by this change |
| Postgres mutation checks | 3 of 3 killed |
| RF-12 system test (ST-1 to ST-13) | Each step as expected, 2026-11-26 (`apply-progress.md`, phase 5) |
| Neon branch `docente-it` | Still exists; deletion is task 7.6, pending the owner's yes |
| Requirements and scenarios in the spec set | `docente-maintenance`: 18 requirements, 83 scenarios (new main spec) |

## 2. Warnings carried at close

Source: `verify-report.md` (PASS WITH WARNINGS, at 9f747d0). Each warning is reported with its state at close, from the highest-ranked source available.

- **W1** (14 open tasks at verification time, 6.0 to 6.6 and 7.0 to 7.6): resolved, except 7.5 and 7.6. Phase 6 is done (merge, deploy, production checks, rollback note). Phase 7 is done up to 7.4 (this archive). 7.5 and 7.6 remain open by instruction, as stated above.
- **W2** (DM-11 "The student offer after a deactivation [PG]" is PARTIAL): still open. The new-request page did not render its offer in the run (no Blob key on purpose), so the offer for a new request was not observed. The enrollment offer and the grupo create and edit forms were. The risk is bounded by DM-8, proven on Postgres (IT-4, IT-7): a docente with an active grupo cannot be deactivated.
- **W3** (DM-17 "Narrow viewport" is PARTIAL): still open. The 360 px and 320 px rules rest on jsdom class guards and one owner capture at 360 px. The expected "nothing clipped at 320 px" is not recorded as observed.
- **W4** (three owner-run steps run in part): still open as recorded. (a) DM-5 "a live session survives the edit" has no automated test; its evidence is ST-3 and ST-4. (b) ST-3 did not change the name in the run; the three-field case is covered by IT-1 and `events.test.ts`. (c) ST-11 did not replay the POST requests with another role's session; the unit tests of slice 2 and the access matrix cover that path.
- **W5** (`npm run build` not rerun by the verifier): resolved. The orchestrator reran `npm run build` at 9f747d0: exit 0.
- **W6** (TDD evidence tables have no Safety net or Triangulation column): documentation-only. The evidence exists inside the RED cells and the table-driven tests. Accepted.
- **W7** (design deviations, slice 3 deviations 1, 3, 5, 9): recorded in `apply-progress.md`. The shared `ActiveToggle` gained an optional `unchangedText` prop and a `break-words` class; `EditDocenteForm` keys itself by `activo`; `phone-exposure.test.ts` was added. No spec requirement is broken by any of them.

Suggestions from `verify-report.md`, state at close:

- S1 (non-empty guards in `docentes-table.test.tsx`): open.
- S2 (no automated pin for "no schema change" and "no grupo repaired"): verified by diff and source scan at verification time; a ratchet test over the migration count would keep it checked. Open.
- S3 (`docs/roadmap.md` and `docs/requirements.md` fail `prettier --check`): the failure predates this change. See section 4.
- S4 (local `main` in this worktree was older than the base `c5ea22e` when the verifier ran): an environment note; `main` now points at 2ef0ef1.

## 3. Specs synced

Delta-to-main merge, performed by splicing the delta blocks into the main specs. Every delta block was checked against its main block after the splice (the readback, section 7).

| Main spec | Added | Replaced | Other edits at archive time |
|---|---|---|---|
| `audit-log` | 3 (DM-AUD-1 to DM-AUD-3) | 0 | none (Purpose not edited, as the delta notes require) |
| `staff-account-creation` | 1 (SAC-AUD-1) | 2 (SR-16, FE-27) | assumption bullet on the D5 decision and the unaudited self-registration |
| `catalog-management` | 0 | 2 (CM-ACC-1, CM-LST-1) | Purpose sentence on the docente list; Vocabulary entry "Docente maintainer"; A-GRP-4, A-DOC-FIELDS and A-C12 replaced |
| `academic-catalog` | 0 | 1 ("Manual writes require an active Asignatura and an active docente") | assumption bullet: invariant kept by the application |
| `catalog-excel-import` | 0 | 3 ("Per-row validation with row-level errors", "Natural-key upserts", "Import UI flow and copy") | none (the delta notes say no edit) |
| `imported-account-provisioning` | 0 | 1 ("Existing accounts keep their credentials") | assumption "updated but not reactivated... Confirm at design" replaced by the D3 decision |
| `docente-maintenance` | new main spec | n/a | promoted from the delta; delta-only title suffix and quote block removed |

Scenario and requirement counts after the sync: `audit-log` 40 requirements and 133 scenarios; `staff-account-creation` 11 and 39; `catalog-management` 33 and 150; `academic-catalog` 13 and 44; `catalog-excel-import` 21 and 89; `imported-account-provisioning` 8 and 27; `docente-maintenance` 18 and 83.

Destructive-change check (task 7.1 asked for a warning): the MODIFIED blocks are authored rewrites by the delta, not deletions. Every main-spec scenario was compared with its delta block: no main scenario was dropped. One scenario was renamed by the delta, as written there: "Docentes list is read-only and unscoped" became "Docentes list is read-only and unscoped for the other roles", and the delta added "Secretaria sees the actions column" and "Coordinacion can list docentes but not maintain them". Lines removed from main were checked against the delta blocks and the notes; all removed lines belong to a replaced block or to a note the delta asks to replace. The "(Previously: ...)" notes of the deltas were kept, following the convention of the other main specs.

## 4. Roadmap and backlog

- `docs/roadmap.md`, row 19: state "pendiente" changed to "archivado" (same column width, table format kept). The prose note at the former line 232 now reads "(fila 19, archivado el 2026-11-26)".
- `docs/roadmap.md` prettier check: `npx prettier --check docs/roadmap.md --end-of-line auto` fails. The same check on the `HEAD` version fails with the same number of differing lines (42 against 42), so this edit adds no formatting failure. The failure predates this change (also noted as S3 in `verify-report.md`).
- `docs/flow-experience-backlog.md`: no diff in this worktree (`git diff HEAD` empty, 0 bytes).
- Not touched: `.engram/`, `package-lock.json`, the thesis, `docs/requirements.md`, `docs/design-system.md`.

## 5. Thesis sync list (flag for the owner; no thesis file was edited)

From task 7.4 and the proposal's "Thesis Sync" section:

1. 5.2 line 33 and Anexo F RF-12-a: docentes are no longer only imported, and enrollments are no longer only declared by the student.
2. 5.3, 5.7 and conclusions: the count 20 of 21, after the execution sheet passes.
3. Anexo E: the manual steps to edit, deactivate and reactivate a docente.
4. Matriz: unaffected.

## 6. Coordination notes

- `main` moved while the change was in progress: the tracker merged as 2ef0ef1.
- No migration, dependency or environment variable was added; the schema is unchanged (17 migrations).
- Neon branch `docente-it` still exists; it is deleted only by task 7.6 with the owner's explicit yes.
- Commit, tag and documentation PR are task 7.5 and are not done here. Nothing was committed, pushed or tagged by the archive step; the archive move is staged as a rename.

## 7. Follow-ups

- Password reset (out of scope of this change).
- Live-session revocation: a deactivated docente's live session is not revoked (A12 of the design).
- Docente scope by facultad (out of scope).
- RN-22 clock hours (out of scope).
- Student self-registration (`/register`) is not audited (A8 of `staff-account-creation`; RNF-06 (a) gap recorded and out of scope).
- Same-handle `23505` catches of `createAsignatura` and `createGrupo` cannot return their result (design, residual risks). Not changed here.
- Emails of 61 to 160 characters are accepted by the form but fail with `correo.loginTooLong` in a workbook row (design, residual risks). Loud; no data risk.
- Legacy active grupo under an inactive docente (A9): not repaired by this change. The production count was 0 on the day of the merge.
- The real mail sender path (Resend) is not exercised by the suite; only the fakes.
- Duplicate notice on inactive edit pages: the same pair of messages as the grupo edit page. Kept as a catalog-wide pattern.
- Reactivation has no confirmation step by design (DM-9).
- Verification residuals: W2 (DM-11 student offer on a new request), W3 (DM-17 at 320 px), W4 (partial owner runs: DM-5 live session, ST-3 name change, ST-11 replay with another role's session).
- Suggestions S1 and S2 of `verify-report.md`.
- Tasks 7.5 and 7.6, with the owner's yes.

## 8. Move and spec readback

Move (task 7.4): `git mv openspec/changes/docente-maintenance openspec/changes/archive/2026-11-26-docente-maintenance`. The readback `diff -r` between the pre-move snapshot of the source folder and the destination (13 files) printed nothing and exited 0.

Spec sync readback: each delta block was extracted from its delta and from its main spec and compared with `diff`: 13 of 13 blocks identical (0 differing lines). The new main spec `openspec/specs/docente-maintenance/spec.md` was copied with `cp` and read back with `diff -r`, empty, exit 0; afterwards only the delta-only title suffix and quote block were removed (lines 1 to 8).

## 9. Artifacts read for this archive

Read, openspec mode (file locators from the orchestrator):

Paths below are the pre-move locators, now under `openspec/changes/archive/2026-11-26-docente-maintenance/`:

- `proposal.md`: Out of Scope and the Thesis Sync section (read in part).
- `specs/`: all seven deltas (`docente-maintenance`, `audit-log`, `staff-account-creation`, `catalog-management`, `academic-catalog`, `catalog-excel-import`, `imported-account-provisioning`); read in full for the sync.
- `design.md`: Residual risks and Open Questions (read in part).
- `tasks.md`: read in full; the 7.0 to 7.4 ticks were set in this run.
- `verify-report.md`: Issues Found and Verdict (read in part); the outline of all sections was also read.

Not read in this run: `apply-progress.md` and `exploration.md`. The ST-1 to ST-13 outcomes and the test counts are taken from the orchestrator's final-state facts, which outrank the snapshots (Final-State Authority).

Engram observation IDs are not applicable: the store is openspec.
