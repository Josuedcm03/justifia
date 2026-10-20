# Archive report: teacher-remission

Change: teacher-remission (roadmap row 3: RF-09 a, b, c; RN-18, RN-19; RNF-07 a, b)
Project: justifia | Store mode: openspec | Archived: 2026-10-20
Archive location: openspec/changes/archive/2026-10-20-teacher-remission/
Close outcome: archived with warnings (verify PASS WITH WARNINGS, 0 CRITICAL; mail rollout deferred to the owner and UAM IT).

## State at close

This section records the state at close and outranks the earlier snapshots in apply-progress.md and verify-report.md (both written 2026-10-19).

- Implementation: slices S1 to S6 merged into the tracker `feat/teacher-remission` through PRs #28 to #33. S7 (PR #34, merge 41fcf36) fixed the owner-walk finding: the resend control is hidden on a remission blocked with `formato_especial_faltante`, and the request-review delta and `remission-section.test.tsx` were updated. The tracker-to-main PR is not yet open; the orchestrator opens it after this archive.
- Verify (2026-10-19): PASS WITH WARNINGS, 0 CRITICAL, 16/16 requirements, 44/44 scenarios, 10 WARNING and 6 SUGGESTION at verification time. Warning status at close is in the next section.
- Real Postgres (task 4.11, owner-confirmed, 2026-10-20): disposable Neon branch `test-teacher-remission` from production; `db:migrate` applied 0009 there (migrations 9 to 10); `npm run test:integration` passed 8/8, including the two concurrent-dispatch cases of 4.10. The branch was deleted after the walk (4.11 (d)).
- Owner walk (task 9.11, 2026-10-20): on the disposable branch; the one finding is fixed in S7 (see above).
- Production rollout (Phase 7, owner-confirmed, 2026-10-20): backup branch `backup-before-teacher-remission`; `drizzle-kit migrate` over the direct URL (migrations 9 to 10); row counts unchanged; `Remision` empty; no `FormatoEspecial` true and no `SubidoPorId` set; drift check clean.
- Tasks: 65/65 implementation and archive tasks checked at close. Task 7.6 (mail rollout) is DEFERRED to the owner and UAM IT: operational, not a change deliverable.
- Gates at close (task 10.3, 2026-10-20, `DATABASE_URL=postgres://u:p@127.0.0.1:9/x`, no database targeted, run one at a time): `npm test` 229 files, 4,947 passed, 0 failed; `npm run build` exit 0.
- Before the archive move, the tasks artifact had no unchecked implementation task (Task Completion Gate).

## Verify warnings carried (verify-report 2026-10-19, numbering as in that report)

Final status at close, ranked by the launch facts and the repository:

- W1 real-Postgres proof: CLOSED for the dispatch concurrency (4.11, 8/8, 2026-10-20). NOT evidenced: a real-Postgres case for a concurrent special-format attach. The 4.11 record names only the two concurrent-dispatch cases, and verify SUGGESTION 1 asked for an attach case. The concurrent second upload stays covered at DB-double level only. Open follow-up, not a closure blocker.
- W2 migration 0009 unapplied: CLOSED. Applied to production 2026-10-20 (task 7.3); drift check clean (task 7.5); also applied on the disposable branch (4.11).
- W3 real Resend send never exercised: REMAINS OPEN. Task 7.6 deferred to the owner and UAM IT (sender domain verification, then `RESEND_API_KEY` and `MAIL_FROM` in Vercel).
- W4 accepted deviations not in design.md: CLOSED. design.md section "Accepted deviations during apply".
- W5 Strict-TDD evidence caveats: unchanged; informational.
- W6 test-quality profile (DB doubles, SQL-text assertions, class-level CSS pins): unchanged; project convention; informational.
- W7 tasks and apply-progress stale: CLOSED (commit 4822a7c and later).
- W8 `.env.example` mail lines uncommitted: CLOSED (commit f37db9c on S2). The archive did not inspect `.env.example` (`.env*` is out of scope for archive).
- W9 operational: cron is daily (Hobby-compatible); the Vercel plan is unconfirmed (hourly on Pro). Until mail is configured, remissions stay `pendiente` with `error_envio`, by design. REMAINS OPEN, owner decision.
- W10 later email change proven by the insert values and the claimed row, not by a real catalog change: unchanged. The 4.11 record does not state that this scenario ran against Postgres.

Verify SUGGESTION status: 2 (design deviations) CLOSED; 3 (tasks and apply-progress refresh) CLOSED; 6 (wrong-format follow-up recorded in the roadmap) CLOSED in task 10.2. SUGGESTIONS 1 (attach integration case), 4 (student fetch of the staff format by direct id; owner decision) and 5 (coverage tool, CI with ephemeral Postgres) REMAIN OPEN as follow-ups.

## Spec sync

- `openspec/specs/request-review/spec.md`: MODIFIED `Approve` replaced in place (new title `Approve (RF-07 a, RN-15, RF-09, RN-19)`, matched against the old title `Approve (RF-07 a, RN-15)`); 3 ADDED blocks appended (remission state and resend on the staff detail; special-format upload on the staff detail; remission UI i18n). The `(Previously: ...)` note was not merged. The Purpose sentence on RF-09 was edited by hand: remission now lives in `teacher-remission`.
- `openspec/specs/audit-log/spec.md`: 3 ADDED blocks appended (closed set of remission events; remission and format-upload payloads are code-only; actor of remission events). Purpose checked and left unchanged: remission and format-upload events are write events, already covered by its wording.
- `openspec/specs/teacher-remission/spec.md`: new capability, copied from the delta (9 requirements). Its delta is already a full spec, so no block was rewritten. It keeps LF line endings as in the delta; the base specs are CRLF in the working tree, and git autocrlf normalizes on commit.
- Totals: 16 requirements in the delta set (9 teacher-remission, 1 MODIFIED and 3 ADDED in request-review, 3 ADDED in audit-log), matching verify.
- Readbacks: `diff -r` of `openspec/specs/teacher-remission/spec.md` against the delta file: empty. Each merged delta block read back from the main specs against the delta block: `diff -r` empty for request-review (4 blocks) and audit-log (3 blocks).

## Archive move

- Moved with `git mv openspec/changes/teacher-remission openspec/changes/archive/2026-10-20-teacher-remission` after a pre-move recursive snapshot. The readback `diff -r` of the snapshot against the archived folder is recorded in the closing message of the archive step.
- This report was written into the change folder before the move, so it is part of the snapshot and the readback; it is not additive to the archive.

## Roadmap

`docs/roadmap.md`: row 3 set to `archivado` (Responsable unchanged; row 11 and `backoffice-ui-refresh` untouched). Notas bullet added for `teacher-remission` with the follow-ups: mail rollout pending (`RESEND_API_KEY`, `MAIL_FROM` in Vercel after UAM IT verifies the sender domain); replacing or removing a wrong special format is out of scope; prefilled printable format is roadmap #12 `printable-forms`; RN-19 overlaps `validation-signals` (RF-14 d).

## Commits

- `c0fdd25` docs(specs): sync teacher-remission into the main specs
- Second commit on `feat/teacher-remission`: `docs(teacher-remission): archive change and mark roadmap archived` (roadmap, tasks 10.1 to 10.3, this report, archive move). Its hash is the branch head after that commit.

Not pushed.

## Engram

Topic key: `sdd/teacher-remission/archive-report`. The store mode is openspec; the Engram copy is additional traceability and does not change this file.
