# Archive Report: data-retention

**Change**: data-retention (RNF-04, RN-27)
**Archived**: 2026-11-19, to `openspec/changes/archive/2026-11-19-data-retention/`
**Artifact store**: openspec (repo-local). Engram mirror: topic key `sdd/data-retention/archive-report`.
**Branch and worktree**: `docs/archive-data-retention` at `C:/justifia-worktrees/p1`, based on origin/main (includes PR #88 as 7533b98 and PR #89 as 43c40bc).
**Archive mode**: complete, not partial. No stale-checkbox reconciliation was used. No CRITICAL issue is open.
**Whole-change verdict**: `pass_with_warnings` (`verify-report.md`, `evidence_revision` sha256:b44f65e4046b0740d0f7fd58177f51bc1953f8b0fed3da271345ece283085467, 0 critical, 14/14 requirements, 27/27 scenarios). Its warnings are resolved as described in section 2. One follow-up remains open at close (section 6, item 1).

## 1. Artifacts read

| Artifact | Locator (openspec) | Read |
|---|---|---|
| proposal | `openspec/changes/data-retention/proposal.md` | yes |
| spec (delta, data-retention) | `openspec/changes/data-retention/specs/data-retention/spec.md` | yes |
| spec (delta, audit-log) | `openspec/changes/data-retention/specs/audit-log/spec.md` | yes |
| design | `openspec/changes/data-retention/design.md` | yes |
| tasks | `openspec/changes/data-retention/tasks.md` | yes (67 tasks) |
| verify-report | `openspec/changes/data-retention/verify-report.md` | yes |

No Engram observation was read: the store is openspec, so no observation ID is recorded as a source. `verify-report-pr1.md` and `apply-progress.md` are in the folder and move with it; they are historical snapshots and were not used as final-state sources.

## 2. Final-state facts (ranked)

Ranking follows `sdd-archive` Final-State Authority: tasks artifact first, then the launch prompt, then intermediate snapshots.

| Fact at close | Rank and source | Where it landed |
|---|---|---|
| Migration 0014 applied to production, 2026-11-19 12:54 Managua, with owner yes | 1, tasks | tasks 6.6, 6.7 |
| PR #88 merged as 7533b98 | 1, tasks | tasks 6.7 |
| RNF-04 integration run, 2026-11-19 13:33:57 Managua, commit 653d761, 9 of 9; mutation check (enrollment clause removed) aborted the suite as expected, rerun 9 of 9 | 1, tasks | tasks 12.2, 12.4 |
| Disposable branch `retention-it` deleted, 13:38 Managua | 1, tasks | tasks 12.5 |
| PR #89 merged as 43c40bc, 2026-11-19 15:01 Managua; Vercel production deploy succeeded | 1, tasks; launch prompt | tasks 13.3 |
| Production read-only check, 15:03 Managua: due 0, sentinel valid | 1, tasks; launch prompt | tasks 13.4 |
| Verify W1 (delivery and archive tasks open) | Resolved. Tasks 13.1 to 13.4 and 14.1 to 14.4 are `[x]` | tasks.md, this archive |
| Verify W2 (production dry run before the first firing) | Resolved by the owner-approved substitute recorded in task 13.4 | tasks 13.4, see section 3 |

## 3. Snapshot claims superseded at close

Each intermediate snapshot claim below is historical. It was true when written and is not current.

- `verify-report` Completeness: "71 tasks, 63 complete, 8 open". Superseded. `tasks.md` contains 67 checkboxes, all `[x]` at close (phases 0 to 14). The 71 figure does not match the file; the file governs. Recorded as a discrepancy in section 5.
- `verify-report` W1 (tasks 13.x and 14.x open). Superseded. Resolved, see section 2.
- `verify-report` W2 (production dry run must answer 200 with due 0 before the first 11:00 UTC firing). Partly resolved. The literal check was not met: a manual `?dry=1` call with the bearer answered 401, because `CRON_SECRET` is a Vercel Sensitive variable (task 13.4). The owner approved a substitute: a read-only production query that mirrors the due rule (sentinel valid 1, students 1, cutoff 2021-11-19, due 0, cancelled 0, audit rows for `usuario.cancelado` 0). The substitute proves the data state and the sentinel row. It does not exercise the route's actor lookup over HTTP in production. This limitation is carried as follow-up 2.
- `verify-report` S1 (DR-10 wording "no-store" versus the code's "private, no-store"). Superseded. Resolved in the main spec, see section 4.
- `verify-report` "Archive readiness: not yet archivable" and "Remaining before archive". Superseded by the closed state above.
- `verify-report` "Branch / HEAD: feat/data-retention-2 @ 8c6161a". Superseded. PR 2 merged as 43c40bc. Commits after 8c6161a are `aa3fe8a` (verify report and checkbox record, `openspec/` and `.engram/` only) and the merge. Verified with `git log 8c6161a..HEAD` and `git show --stat aa3fe8a`. No code changed after the verified revision, so the verify evidence still covers the code.

## 4. Specs synced

| Domain | Action | Details |
|---|---|---|
| data-retention | Created (verbatim copy of the delta) | 12 requirements (DR-1 to DR-12) and 19 scenarios. The delta type note is kept, as in the `coordination-reports` archive. Copied with `cp`, `diff -r` empty before any edit. |
| audit-log | Updated (delta merged) | ADDED "Closed set of retention events (RNF-04, RN-27, RNF-06)" with 3 scenarios. MODIFIED "Audit record content" (3 to 5 scenarios, with "(Previously: ...)" note kept, as in other main specs). No other requirement touched. Main file 1177 to 1220 lines. CRLF line endings kept. |

### Deliberate deviation: DR-10 wording (main spec only)

- **What**: in `openspec/specs/data-retention/spec.md`, three occurrences in DR-10 changed from `no-store` to `private, no-store` (lines 188, 190, 197). The delta in this archive keeps the original wording.
- **Why**: the code sends `NO_STORE = { "Cache-Control": "private, no-store" }` (`src/app/api/cron/scheduler-auth.ts:10`), used by all three responses of `src/app/api/cron/retention/route.ts` (lines 21, 34, 38). Behavior is equal or stricter. The owner asked for the main spec to match the code.
- **Effect on readback**: the main copy differs from the archived delta only on those three lines. This is the one intended difference from the mechanical copy. It was produced with `perl` on the main copy after the verified copy, not by model Read/Write.

### Spec-sync verification (delta requirements present in main)

- data-retention main: requirements DR-1 to DR-12 present, one heading each; scenario set identical to the delta except the three DR-10 wording lines.
- audit-log main: "Closed set of retention events" (ADDED) and "Audit record content" (MODIFIED) each appear once. The MODIFIED block (main lines 52 to 94) and the ADDED block (main lines 1169 to 1195) are byte-equal to the delta blocks, with CR endings ignored. No duplicate heading. All other main requirements unchanged: the merge removed only the six replaced lines of the old "Audit record content" paragraph (`diff --strip-trailing-cr`).

## 5. Task reconciliation and discrepancies

- `tasks.md`: 67 checkboxes, 67 `[x]`, 0 `[ ]`. No stale checkboxes; no exceptional reconciliation was needed.
- Uncommitted: the `[x]` marks on 13.3, 13.4 and 14.1 to 14.4 are working-tree changes. HEAD (`43c40bc`) still shows 13.3 and 13.4 as `[ ]`. The owner commits them.
- Discrepancy: `verify-report` counts 71 tasks (63 complete, 8 open). `tasks.md` has 67. Ranked: tasks artifact wins. No other count is affected.
- Discrepancy: `design.md` "Open Questions" (two unchecked items on DR-4) and `proposal.md` "Success Criteria" (four unchecked items). Neither file is a task artifact. Both are resolved by task 0.2 and by the spec text and verify matrix (DR-4 now drops the `SolicitudRevision` item and uses the redact rule; success criteria are covered by the RNF-04 run and the passing suite). Not edited, because the archive is the audit trail. Recorded here so no reader treats them as open.
- Contradiction recorded, not resolved silently: the owner-approved W2 substitute (section 3) versus the verify requirement for a literal production `?dry=1` answer. Both statements are kept. The owner's substitute is accepted as the final state for the data check; the HTTP-level check is open.

## 6. Follow-ups (not blocking the archive)

1. **Open**: confirm the first scheduled firing, 2026-11-20 at 11:00 UTC, in the Vercel logs: HTTP 200, `cancelled` 0, and no `usuario.cancelado` rows added. Owner.
2. Optional: a bearer call with `?dry=1` from the owner's own environment, to exercise the production actor lookup over HTTP. The substitute in section 3 did not cover it.
3. Legal review by the UAM: anonymization as "cancelación" under Ley 787, arts. 19 f and 24, is a recorded assumption (proposal, spec, design), not a verified legal conclusion.
4. Backups are outside the cancellation (RNF-08); out of scope.
5. Staff accounts and the last-access timestamp are out of scope (proposal).
6. Audit partition for 2036: create `EventoAuditoria_2036` before 2036-01-01 (design D8; `modelo_datos_sql.md`). Maintenance task.
7. Backlog entry UX-19, "Ocultar las cuentas del sistema y las canceladas en el listado de usuarios", in `docs/flow-experience-backlog.md` (design D9). The listing query has no filter for system or cancelled accounts.
8. Thesis flag for the owner (task 14.4): thesis Anexo F and section 4.9 record RNF-04 as not built. The evidence to cite is the integration outcome in section 2 (9 of 9, commit 653d761, 2026-11-19). The thesis was not edited.
9. Non-blocking suggestions from verify, carried as they are: S2 (a staff fixture aged past five years in a real-database run), S3 (a test that drains more than one run's worth of students), S4 (the 500 path logs nothing; a closed error code could help the owner), S5 (a duplicate assertion in the integration test), S6 (integration tests are order-dependent; keep the order), S7 (`.engram/` files are inside the PR 2 commit), S8 (a stale "never executed" note in `apply-progress.md`, superseded by Phase 12).
10. Process: the rename was recorded with `git mv`, so it is staged. All other changes are unstaged and uncommitted, for the owner to commit.

## 7. Readback and traceability

- Mechanical move: the change folder was snapshotted with `cp -R` before `git mv` to `openspec/changes/archive/2026-11-19-data-retention/`. The readback is `diff -r` of the snapshot against the archived folder. Its verbatim output is in the archive phase result, not in this file, because it is produced after this file is written and this file is part of the archived tree.
- Engram: `sdd/data-retention/archive-report` is saved with the same content. Its observation ID is returned in the archive phase result.
