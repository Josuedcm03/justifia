# Archive Report: normative-parameters (roadmap row 8, RNF-14)

**Archived**: 2026-11-28 to `openspec/changes/archive/2026-11-28-normative-parameters/`
**Artifact store**: hybrid (openspec files plus this Engram topic `sdd/normative-parameters/archive-report`). Sources were read from the repository paths listed below. No Engram observation IDs were read for this archive.
**Production build at close**: `9f10c13` (PR 184 `feat/normative-parameters` merged into `main`).
**Owner system test build**: `7b75e3a` (tracker tip, Phase 14).
**Delivery**: the archive commit is local on `docs/normative-parameters-archive`. Nothing was pushed, tagged, or deleted by this archive.

## Final State at Close

This section reports the state at close. Per the Final-State Authority, the launch prompt (the most recent account) outranks the intermediate snapshots `verify-report.md` and `apply-progress.md`.

- **Tasks**: Phases 0 to 14 are checked. Task 15.4 is "Removed" (scope cut 2026-11-27: no migration 0018). Tasks 15.3, 15.5 to 15.8 and 16.0 to 16.3 are checked (Phase 15 is recorded in `apply-progress.md`, section "Phase 15: merge gate and production (2026-11-28)").
- **Still open, owner-run, deliberately not done by this archive**: 16.4 (archive commit to `main` through a documentation PR, then tag `normative-parameters-archived`, both with the owner's yes) and 16.5 (delete the Neon disposable branch `params-it` with the owner's exact command). The `tasks.md` file keeps them unchecked on purpose.
- **Production migration**: 0017 applied to the Neon branch `production` (owner's yes, direct URL, host asserted). Before: 17 migrations (0000 to 0016), no `ParametroNormativo`. After: 18 migrations, last journal `when` 1795817587621, one harmless notice `42P07`.
- **Seed count on production**: `ParametroNormativo` = 9, all dated 2026-01-01 (read-only check, 2026-11-28).
- **Merge and deploy**: PR 184 merged as `9f10c13`; Vercel production deploy success; `/login` answers 200. Branches kept.
- **Production smoke test** (owner, 2026-11-28, build `9f10c13`, fictitious data): a secretaria opening `/parameters` saw the nine default values; a coordinacion opening it was sent to `/denied`; no value was saved. Owner's remark (Spanish): "todo bien al igual que en las pruebas".
- **Verification**: per `verify-report.md`, at verification time, verdict PASS WITH WARNINGS, 0 CRITICAL, 7 WARNING, 3 SUGGESTION; that run reported 415 test files and 11641 tests passed. The owner accepted the warnings. No CRITICAL issue exists, so the archive gate is satisfied.
- **Rollback** (task 15.8): revert PR 184 (or the slice PRs in reverse order) and redeploy `main`. Old code ignores `ParametroNormativo`. There is no 0018. Audit rows stay. The table can stay in place.
- **Contradictions**: none found between the launch prompt and the repository evidence.

## Spec Sync (task 16.1)

Mechanical application, then a block-level readback. Every delta requirement block was compared with the merged main spec: the `diff` was empty for all 13 MODIFIED and ADDED blocks, except the ADDED block `NP-AUD-3`, which differs only by one blank line that separates it from the next `## ` heading.

| Domain | Action | Details |
|--------|--------|---------|
| `normative-parameters` | Created | Copied with `cp`; `diff -r` empty. 17 requirements (NP-1 to NP-17), 66 scenarios. |
| `audit-log` | Updated | ADDED NP-AUD-1, NP-AUD-2, NP-AUD-3 at the end of `## Requirements`. Requirements 40 to 43. |
| `request-review` | Updated | MODIFIED "Queue ordering and RN-08 alert". Scenarios 11 to 18. |
| `validation-signals` | Updated | RENAMED MD-15 (old name to "one parameter table behind an injectable seam (RN-13, RNF-14, D3, D4)"). MODIFIED "Late presentation" (4 to 8 scenarios), "Recurrence" (10 to 13), MD-15 (3 to 7). Purpose edited (see below). |
| `justification-intake` | Updated | MODIFIED "Cause and dates rules" (4 to 12 scenarios) and "Submit blocking, per field" (5 to 9). |
| `supporting-documents` | Updated | MODIFIED "Upload authorization and limits" (4 to 7) and "Finalize with magic-byte validation" (9 to 13). ADDED "Maximum size reaches every upload path and the client" (6 scenarios). |
| `backoffice-shell` | Updated | MODIFIED "BS-NAV-1 Sidebar entries are unchanged" (6 to 9 scenarios). Purpose edited (see below). |

### Destructive changes applied (warning)

Each MODIFIED block replaces the whole main requirement with the delta text. Scenario comparison by title:

- **Removed scenario**: `request-review`, "Calendar year not loaded". The delta note says it is replaced by the new "Calendar coverage notice" scenario. This is the only real removal.
- **Retitled scenarios** (content is in the delta text): "Alert and overdue boundaries (table-driven)" is now "... (table-driven, defaults 2 and 1)"; "Boundary dates (table-driven, calendar without holidays)" is now "... late-filing days 2)"; "Window boundary (table-driven)" is now "... (table-driven, window 30)".
- **RENAMED** MD-15 in `validation-signals`: the main requirement keeps its three original scenarios, all still present. Four scenarios were added.
- No REMOVED sections exist in any delta.

### Purpose edits (from the delta "Notes for archive")

- `validation-signals`, Purpose: removed the sentence "RNF-14 is not met, because the recurrence threshold is a code constant until roadmap #8;" from "Known limitations". The other limitations stay.
- `backoffice-shell`, Purpose: added `canManageParameters` (Parámetros normativos) to the predicate list of the sidebar entries.
- All other Purpose sections: unchanged, as the notes say.

### Main-spec byte check

`git diff --stat` on `openspec/specs/` shows changes only inside the delta blocks and the two Purpose lines. Line endings stay CRLF.

## Thesis Sync List (owner-facing; flagged, not edited)

The thesis repository was not touched. The owner applies these edits.

1. **5.1 Table 14**: the "Parámetros normativos" module is built (secretaria only, page `/parameters`).
2. **5.3 Table 16**: RNF-14 moves to "Cumple". Evidence: the owner's system test of 2026-11-28 (ST-1 to ST-7, build `7b75e3a`, recorded in `apply-progress.md`, Phase 14), and production build `9f10c13` (deploy and smoke test, 2026-11-28).
3. **Anexo F**: the RNF-14 row follows the same evidence.
4. **Flag**: the maximum upload size is configurable from 1 to 10 MiB. It cannot be raised above 10 MiB without a migration (`CK_Documento_Tamano`).
5. **CU-13**: thesis 4.3 has a single row (Configure normative parameters; actor secretaria académica; RNF-14) with no steps. There is no Anexo E item for it.

## Follow-ups (task 16.3)

These are not done by this change and are not blockers:

1. RF-13 (c) coordination report still uses its own defaults.
2. Creating or renaming causes.
3. Retention, RNF-04.
4. The shared catalog lock reports busy during a long import.
5. Corrections accept a deactivated cause (A14).
6. Raising the maximum size above 10 MiB needs a migration of `CK_Documento_Tamano`.
7. An upload token keeps its old limit until it expires.
8. No staleness alert for the calendar on the parameters page (the queue coverage note stays).
9. Display and confirmation extras cut on 2026-11-27: confirmation of every save with a changes list; Reglamento default and range in words; per-year date counts; "default in use" mark; degraded locked forms; 360/320 px checks of the staff page; per-family Postgres effect cases; mutation checks. The owner may move these to `docs/flow-experience-backlog.md` (roadmap row 13). This archive did not touch that file.

## Roadmap (task 16.2)

`docs/roadmap.md` row 8: Estado `pendiente` changed to `archivado`. The column width is unchanged. `npx prettier --check docs/roadmap.md --end-of-line auto` already fails on the HEAD version, and this edit adds no new differing lines.

## Archive Verification

- Source snapshot taken before the move; `git mv` used; source directory confirmed gone.
- `diff -r` of the pre-move snapshot against `openspec/changes/archive/2026-11-28-normative-parameters/`: empty (exit 0). This report was created after that readback and is additive.
- Tasks in the archived `tasks.md`: no unchecked implementation task. Unchecked: 16.4 and 16.5 (owner-run, post-archive, see above).
- Active `openspec/changes/normative-parameters/` no longer exists.

## Traceability Sources

- `openspec/changes/archive/2026-11-28-normative-parameters/proposal.md`, `design.md`, `exploration.md`, `tasks.md`, `apply-progress.md`, `verify-report.md`, `specs/*/spec.md` (the seven deltas).
- Main specs updated: `openspec/specs/{normative-parameters,audit-log,request-review,validation-signals,justification-intake,supporting-documents,backoffice-shell}/spec.md`.
