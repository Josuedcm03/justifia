# Archive report: escalation

**Change**: `escalation` (roadmap row 6). Spec IDs: RF-07 c), RF-10 (a, deviation), RF-15, RN-08 (E15), RN-20 (motives), RNF-01, plus the consent v2 and privacy notice items (ES-14, E13, E17, E18).
**Project**: justifia
**Store mode**: openspec (native `gentle-ai sdd-status` reports `artifactStore: openspec`; repo-local planning home)
**Archived**: 2026-10-30
**Archive folder**: `openspec/changes/archive/2026-10-30-escalation/`
**Branch**: `feat/escalation`, tracker head `1b3bf46` before this archive commit. The owner merges the tracker PR into `main` (16.11, still open by design). The branch is kept.
**Close status**: **intentional partial close, approved by the owner** with six items open (see "Open after archive"). Verdict `pass_with_warnings`, 0 CRITICAL. The verify warning W1 was accepted by the owner and closed as 13b.9. The open items are owner, teammate, or out-of-change steps, and none is implementation work.

## Artifact sources

Files read for this archive: `tasks.md` (phase 0 to 16 and the task lines cited below), `verify-report.md` (front matter and verdict), `proposal.md` (decision list E1 to E18), `design.md` (decision references). Spec deltas were not re-read here; the spec sync record below comes from the tracker line 16.2 and was confirmed by its own readback.

Engram observation IDs for traceability: verify report `309` (`sdd/escalation/verify-report`, the verdict used in this report). Blocked-status note from the first archive attempt: `376` (`sdd/escalation/archive-blocked`, superseded by this report). The proposal, spec, design, and tasks artifacts were read from the filesystem (openspec mode), not from Engram observations, so no IDs are cited for them.

Engram topic `sdd/escalation/archive-report` is saved from this file's content.

## Gates

Run on 2026-10-30 for this archive, on the tracker head before the archive commit:

- **Tests**: `DATABASE_URL=postgres://u:p@127.0.0.1:9/x npx vitest run`: 304 test files passed, 6,903 tests passed. No database was targeted; the dummy URL is unreachable by design.
- **Build**: `npm run build` with a dummy `AUTH_SECRET` of 32+ characters: exit 0.
- **Native review**: not applicable; receipt-driven development was not enabled.
- **Database**: no database command was run by this archive. Production migration work (16.7 to 16.10) was done earlier on 2026-10-30 and is recorded below, not repeated here.

## Verify verdict

Per `verify-report.md` front matter and engram 309, at verification time (phase 16.1, second run, against tracker head `a38cdd8`):

- `verdict: pass_with_warnings`, `blockers: 0`, `critical_findings: 0`.
- 31 of 31 requirements and 176 of 176 scenarios covered.
- Gates at that run: vitest 304 files / 6,903 tests green; typecheck clean; build ok; `npx eslint src` reported only CRLF `Delete CR` findings; `drizzle-kit generate` printed "No schema changes".
- W1 was closed as 13b.9 and accepted by the owner on 2026-10-30 as a known warning (the `RespondidaEn IS NULL` claim guard, an accepted window).
- W2 (`npm run format:check`, Markdown only) is pre-existing across the repository and was not introduced by this change.

Per the Final-State Authority, the native dispatcher reported `verify: blocked` and `pending: 21` before the archive. The orchestrator instructed that `verify: blocked` is stale bookkeeping, and the nine stale checkboxes were reconciled in `5452b6d`. This report records the final state, not that intermediate status.

## Final state at close

Ranking: explicit orchestrator instructions for the close state, then the tasks artifact, then `verify-report` as an intermediate snapshot.

| Fact | Final state | Source |
|---|---|---|
| Production migration `0012_escalation` | Applied 2026-10-30 (16.9, owner yes), with the Neon guard on `ep-orange-math` respected. Migrations 12 to 13 (last `when` 1793384505116) | tasks 16.9, 16.10 |
| Production tables | `Escalamiento` and `ReporteInasistencia` exist and are empty. `PlazoInicioEn` NULL on every row. The two `pendiente` requests are unchanged | tasks 16.10 |
| Production indexes and checks | New `IX_Solicitud_Cola` with `COALESCE("PlazoInicioEn", "ReenviadaEn", "PresentadaEn")`. `UX_Escalamiento_Abierto` covers both motives. The three CHECKs accept `caso_especial`. `drizzle-kit generate` drift check printed "No schema changes" and wrote nothing | tasks 16.10 |
| Pre-migration count check | 16.7: two `pendiente` requests (data changed outside the change since 4.1). 12 applied migrations, last `0011_document_extraction` | tasks 16.7 |
| Backup branch | `backup-before-escalation` created from production 2026-10-30 21:31 UTC (16.8). **Still exists**; deletion is 16.12, owner yes after production is stable | tasks 16.8, 16.12 |
| Real-Postgres proof, 14.1 | Owner yes, `test-escalation-pg` only. First run: 60 tests, 59 passed; the race test timed out at the 60 s default, with an FK violation in cleanup, and no assertion failed. After PR #67 (race timeout raised to 300 s, test code only), the race file passed in 56.8 s | tasks 14.1 |
| Real-Postgres proof, 14.4 | Regenerated `0012_escalation` on disposable `test-escalation-pg` from production. Integration suite: 5 files, 72 tests passed in 161 s, race test included. The branch was deleted the same day | tasks 14.4 |
| Owner walk, phase 15 | 15.4 to 15.8 passed on 2026-10-30 (secretary, coordinator, student walks, read-only audit counts). 15.3 (`APP_BASE_URL` in Vercel) stays open, owned by the teammate | tasks 15.4 to 15.8 |
| Spec sync, 16.2 | Eight specs in `openspec/specs/`; counts below | tasks 16.2 |
| Tracker and roadmap | Roadmap row 6 `archivado` with notes (16.3, `41e4325`). Teammate note recorded (16.4) | tasks 16.3, 16.4; roadmap |
| Migration order | The migration number was regenerated after main merged (`0011` already in production from `document-extraction`); the escalation migration is `0012_escalation`, not hand-numbered. This resolves the escalation renumber follow-up (W4) from `document-extraction` | tasks 16.4, PR #65 |

**Order note.** The original plan placed the production migration after this archive. The production migration (16.7 to 16.10) was completed before the archive, on the owner's explicit yes per command. The archive records the production state as it stands at close.

## Spec sync record (task 16.2)

Eight main specs in `openspec/specs/`, requirements and scenarios before and after:

| Capability | Before | After | Change |
|---|---|---|---|
| `request-review` | 19 / 65 | 23 / 87 | 3 MODIFIED, 4 ADDED |
| `student-requests` | 6 / 32 | 6 / 37 | 1 MODIFIED |
| `audit-log` | 24 / 79 | 28 / 89 | 4 MODIFIED, 4 ADDED |
| `justification-intake` | 21 / 89 | 21 / 94 | 1 MODIFIED |
| `privacy-notice` | 5 / 10 | 5 / 12 | 1 MODIFIED |
| `supporting-documents` | 8 / 37 | 8 / 39 | 1 MODIFIED |
| `user-roles` | 6 / 15 | 7 / 19 | 1 ADDED |
| `coordination-escalation` | (new) | 11 / 75 | created, 11 ADDED |

The 16.2 readback confirmed that every delta requirement and scenario is present verbatim in its main spec, with no ADDED or MODIFIED markers left. The deltas were not merged again by this archive.

## Slices and pull requests

Tracker `feat/escalation`. Each slice merged into the tracker with a merge commit; the tracker itself is not yet merged into `main`.

| PR | Slice | Note |
|---|---|---|
| #54 | S1a | Schema, migration, transitions, RN-08 rules. Split from S1 |
| #55 | S1b | Validation, audit, writes. `size:exception` |
| #56 | S2a | Secretary tabs and queue |
| #57 | S2b | Secretary staff detail |
| #58 | S3a | Notice, outbox, dispatch |
| #59 | S3b | Cron and resend |
| #60 | S4a | Coordinator scope, access and document reads |
| #61 | S4b | Coordinator view, answer, audit closed set. `size:exception` (1,263 production lines, owner accepted 2026-10-23) |
| #62 | S5 | Student view, consent v2, proof suite |
| #63 | S6 | Verify fixes (verify-report W3, S4, S5) |
| #64 | S7 | Review fixes from the code review of #54 to #63 (base #63) |
| #65 | Main merge | Tracker merged `main`; migration regenerated as `0012_escalation` (`dc97d76`) |
| #66 | Follow-up | Phase 13c/13d follow-up (see tasks.md phases 13c and 13d) |
| #67 | Test | Race test timeout raised to 300 s (test code only) |
| #68 | S10 | Walk findings: special case `caso_especial`, branded email, table overflow. Regenerated `0012` in place for E18 |

Per the orchestrator's reconciliation in `5452b6d`, PRs #54 to #64 merged into the tracker on 2026-10-28 and PRs #66 to #68 on 2026-10-30. The merge date of #65 is not recorded in the tasks artifact.

## Decisions E1 to E18

Decisions as recorded in `proposal.md` and `design.md`. Short titles only; see the source for the full text.

- **E1** Minimal coordinator view: escalated requests for the user's career, detail with audited document access, answer action that returns the request to `pendiente`.
- **E2** `pendiente` to `en_revision_coordinacion` with reason `sospecha_documento` or `caso_especial`, with a required note.
- **E3** Exit from coordination returns the request to `pendiente`.
- **E5 and E6** Own outbox on escalation rows, drained by `remission-retry`; email with minimal data and a link, no attachments.
- **E6** `CONSENT_VERSION` v2 naming the career coordination; privacy notice recipients updated; pin tests.
- **E7 to E9** RF-15 excess-absence report is append-only.
- **E10** On `aprobada`, one action records the RF-15 report and notifies coordination; the state stays `aprobada`. No percentage is computed.
- **E12** One open escalation per request, across both motives (new table, `UX_Escalamiento_Abierto`).
- **E13** The student sees the state and a neutral reason label; the note and the answer are staff-only.
- **E14** State tabs on `/review` (Pendientes, En coordinación, Aprobadas).
- **E15** RN-08 deadline paused while in coordination; `IX_Solicitud_Cola` changed.
- **E16** Remissions untouched by an escalation.
- **E17** `sin_coordinacion` refusal when a career has no coordination account with an email; the refusal writes nothing.
- **E18** Second motive `caso_especial`; the three CHECKs accept it, and `UX_Escalamiento_Abierto` covers both motives.

## Walk record

Phase 15 is recorded in `tasks.md` (15.4 to 15.8, all DONE 2026-10-30, owner). The walks covered the secretary at 360 px and desktop in `es` and `en`, the coordinator, the student, and the post-answer secretary flow. The read-only audit counts (15.8) were codes and counts only, with no payload containing the note or answer text.

## Backlog entries

Four UX entries were added to `docs/flow-experience-backlog.md` as inputs to the `flow-experience` change (roadmap #13):

- **UX-12** What to expect while coordination reviews the request.
- **UX-13** Why the deadline changed when a request comes back from coordination.
- **UX-14** Search within the "Aprobadas" tab.
- **UX-15** Remission status in the teacher selector.

## Commits

On `feat/escalation`, closing commits of this change:

- `41e4325`: docs, roadmap row 6 `archivado` with notes (16.3, 16.4 marked earlier)
- `ed4513a`: docs, spec sync (16.2)
- `5452b6d`: docs, reconciled the nine stale pre-archive checkboxes with PR evidence
- `1b3bf46`: docs, production migration record (16.7 to 16.10)
- This archive commit: `docs(escalation): archive the change`

## Readback outputs (verbatim)

The source for the move is a pre-move recursive snapshot in the session scratchpad (`C:\Users\Arnia\AppData\Local\Temp\claude\C--justifia\bb0b2f64-1d16-4ffd-a9d1-31bd3fde5585\scratchpad\escalation-snapshot`, 15 files). The snapshot was taken after the 16.5 checkbox edit, so the comparison covers the moved `tasks.md`.

```
$ git mv openspec/changes/escalation openspec/changes/archive/2026-10-30-escalation
(exit 0)
source openspec/changes/escalation is absent

$ diff -r <snapshot>/escalation-snapshot openspec/changes/archive/2026-10-30-escalation
(no output, exit 0)
```

The 16.5 mark in `tasks.md` is a one-line CRLF-preserving edit (316 of 316 lines CRLF before and after). The readback above was taken after that edit.

## Open after archive

These items stay unchecked by design. The owner approved an intentional partial close. Each is an owner, teammate, or out-of-change step. None is implementation.

1. **13b.8**: follow-up in another change. `teacher-remission` still writes a failure row when the mail provider answers `not_configured`. Candidate for a separate fix.
2. **15.3**: teammate sets `APP_BASE_URL` in Vercel (production, preview, and development) and in `.env.development.local`. Unset leaves notices `pendiente` with `not_configured`. The teammate owns the Vercel project.
3. **16.6**: owner syncs the `docs/requirements.md` changelog (2026-10-22 entry) with the thesis requirements matrix, so RF-10 (a) and its deviation are recorded.
4. **16.11**: owner merges the tracker PR into `main` with a merge commit. Keep `feat/escalation`. Slice branches are deleted as split.
5. **16.12**: delete `backup-before-escalation` only on the owner's explicit yes, after production is stable. Record the date next to the step.
6. **16.13**: UAM legal review of consent v2 and the privacy notice before production use. Changed wording requires a new `CONSENT_VERSION` and a new pin.

## Open warnings carried forward

- **W2**: `npm run format:check` on Markdown is pre-existing across the repository, not introduced by this change.
- **CRLF**: `npx eslint src` reports only `Delete CR` findings. These are the repository's line-ending convention, not functional issues.

## Follow-ups

1. **Escalation renumber (W4 from `document-extraction`)**: resolved. The migration is `0012_escalation`, regenerated after main merged (PR #65).
2. **`teacher-remission` failure row on `not_configured`**: 13b.8, a separate fix.
3. **Migration-order note for future changes**: the production migration was run before this archive, per 16.9. Future changes should follow the order in their own `tasks.md`.

## Traceability

- Engram observation IDs: verify report `309`; blocked-status note `376` (superseded by this report).
- Engram topic `sdd/escalation/archive-report`: saved from this file.
- Roadmap: row 6 `archivado` (`41e4325`); this archive does not change it further.
- Owner's uncommitted files (`docs/requirements.md`, `docs/roadmap.md`, `package-lock.json`, and the untracked `docs/investigacion/*.md` and `docs/pendientes-validacion-tesis.md`) were not touched or staged.
