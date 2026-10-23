# Archive report: request-consent

Change: request-consent (roadmap row 9: RF-01 (d), RF-03 (e, f); RN-25; RNF-02, RNF-04, RNF-06, RNF-11, RNF-12)
Project: justifia | Store mode: hybrid | Archived: 2026-10-21
Archive location: openspec/changes/archive/2026-10-21-request-consent/
Tracker: `feat/request-consent` (draft PR #36, no-merge). Only the tracker reaches `main`; the owner merges it (task 9.6).
Slices merged into the tracker: #37 `d0db7bb`, #38 `a9b36c8`, #39 `b9f26b0`, #40 `e54103c`, #41 `043dc89`.
Production database: migrated to `0010` on 2026-10-21 (tasks 4.3 and 4.4).

## Final state at close

Ranking used (per `sdd-archive` Final-State Authority): persisted tasks artifact, then launch-prompt final-state facts, then `verify-report` (intermediate snapshot).

| Fact | Final state | Source (rank) |
|---|---|---|
| Verification outcome | pass_with_warnings; 0 CRITICAL; 9 WARNING; 9 SUGGESTION | `verify-report` (snapshot, verification time) |
| Requirements and scenarios | 15/15 requirements; 60/60 scenarios COMPLIANT | `verify-report` (snapshot) |
| Unit tests | `npm test`: 236 files, 5116 tests (verify run; not re-run by this archive step) | `verify-report` (snapshot) |
| Real-Postgres constraint proof | Done after verify: disposable branch from production, 7/7 probe cases as expected, `npm run test:integration` 8/8; branch deleted | launch prompt; commit `d1fda97` (higher rank) |
| Production schema | Migration `0010` applied 2026-10-21; both consent columns nullable, CHECKs present, 0 rows with consent | tasks 4.3 to 4.5 (tasks artifact) |
| Owner walk | Passed 2026-10-21 (tasks 8.1 to 8.6); optional 8.7 done, 8.8 done | tasks artifact |
| Closeout tasks | 9.1 to 9.5 done in this archive run; 4.6, 9.6, 9.7 remain owner-held | tasks artifact (this archive run) |

## Verify warnings at close

Each warning is reported as stated in `verify-report` (verification time), then its status at close. Snapshot claims are attributed, not restated as current facts.

| # | Verify-report statement (at verification time) | Status at close |
|---|---|---|
| 1 | Real-Postgres proof missing for the reject rows of the constraint table | Resolved in `d1fda97`: probe 7/7 on a disposable production branch, integration suite 8/8, branch deleted |
| 2 | Nine unchecked tasks (4.6, 8.7, 9.1 to 9.7) | Resolved for 8.7 and 9.1 to 9.5. Still owner-held by design: 4.6 (backup branch deletion), 9.6 (merge tracker PR #36 to `main`), 9.7 (UAM legal review) |
| 3 | `axe-core` imported by two test files but only transitive; a dependency change could break them | Open follow-up (owner decision: declare it as a devDependency once the unrelated `package-lock.json` diff is resolved) |
| 4 | 360 px scenarios rely on class-level guards and axe under jsdom; `/privacy` 360 px not in the walk record; `fixedWidths` guard has no self-test | Open follow-up (see SUGGESTION 4 below) |
| 5 | Root `middleware.ts` has no automated test; signed-in behavior only exercised by the owner walk (8.5) | Open; no automated test added by this change. Covered by the walk and the static read |
| 6 | Version longer than 20 characters answered `consent_required` (parse failure), while the spec table said `consent_outdated` | Resolved by the spec sync (task 9.2): see "Spec sync" below |
| 7 | RC-9 staff date rendered with medium date and short time in America/Managua instead of `dates.instant` | Deviation accepted and recorded here; `design.md` not amended (per verify-report). Open only as a documented deviation |
| 8 | Content items for UAM legal review: controller domicile and contact office are a visibly marked placeholder; mail provider not named | Open, owner-held (task 9.7). The placeholder is pinned in the `es` subtree, so replacing it needs a new `CONSENT_VERSION` and pin |
| 9 | Strict-TDD caveats (pins passed on arrival; DB-double tests mock-heavy) | Informational; no action. Repository precedent |

## Verify suggestions at close

| # | Suggestion (verify-report, at verification time) | Status at close |
|---|---|---|
| 1 | Forecast tests at 4 to 5 times production lines for the next change | Carried as a planning note for future changes; not an open defect |
| 2 | Declare `axe-core` as devDependency (see WARNING 3) | Open follow-up |
| 3 | Task 8.7 ran on a disposable branch | Done (see WARNING 1) |
| 4 | Add a 360 px line for `/privacy` to the walk record or run it once; add a self-test for the `fixedWidths` guard | Open follow-up |
| 5 | Long line (about 118 characters) in the `submitDraft` doc comment in `src/lib/data/solicitudes.ts` | Open, cosmetic follow-up |
| 6 | Documentation drift: apply-progress S2 says `submit-dialog.test.tsx` is 10/10 while the file has 9 tests; tasks forecasts quoted beside measured values | Not refreshed by this archive step. Recorded here. The tasks forecast table is kept as written at planning time |
| 7 | `.env.development.local` repointed to the walk branch in 8.1; branch later deleted | Owner to confirm the local environment points at the intended database before the next dev session. Not inspected by this archive step (`.env*` not read) |
| 8 | Walk 8.4 secretary-side results; student detail and one-consultada-per-open covered by tests only | Optional; not added |
| 9 | Carry design deviations (RC-9 date format, RC-8 label markup) into `design.md` or archive notes; keep the teammate note | Done: RC-9 recorded above (WARNING 7); RC-8 deviation named here by reference to verify-report; teammate note in the roadmap (see below) |

## Spec sync (task 9.2)

Method: the delta blocks were spliced into the main specs with awk, which copies the delta bytes; no model Write was used for block content. The `(Previously: ...)` annotations were dropped as change-specific. One exception was made on purpose: the `Consent required to submit` table and the `Consent version check` paragraph were edited to the WARNING 6 wording (see below), and one audit-log clause was tidied.

| Domain | Action | Details |
|---|---|---|
| justification-intake | Updated | ADDED 5 requirements (consent text and version; consent checkbox on the review step; consent required to submit; consent version check; consent recorded at submit). MODIFIED 2 (Submit blocking, per field; Four-step stepper). Consent version check fixed (WARNING 6) |
| request-review | Updated | ADDED 1 requirement (Consent shown on the staff detail), appended at the end of `## Requirements` |
| student-requests | Updated | MODIFIED 1 (Correction validation) |
| audit-log | Updated | MODIFIED 1 (Request and document payloads minimise personal data); tidied "Closed set of request and document events" so that its "payloads MUST be unchanged" clause excludes `solicitud.presentada`, which now carries `consentimientoVersion` |
| privacy-notice | Created | New domain: `openspec/specs/privacy-notice/spec.md`, a byte copy of the delta (requirements: public access; required contents; draft marker; no mail provider named; usability and i18n) |

WARNING 6 fix, as written in the main spec:
- Table row: absent, `null`, the empty string, or a string longer than 20 characters gives `consent_required`; any other string different from the current version gives `consent_outdated`.
- Paragraph: `consent_outdated` applies only to a string that differs from the current version and is not empty and not longer than 20 characters; absent, `null`, empty, non-string or longer-than-20-characters values are `consent_required`.

Audit-log tidy: "Existing events and payloads MUST be unchanged, except that the `solicitud.presentada` payload carries `consentimientoVersion`".

Main spec line endings: the four merged files are CRLF, as in the working copy before the merge. The `privacy-notice` copy is byte-identical to the delta (LF).

Readback (block bytes; carriage returns stripped on both sides). Only the intentional WARNING 6 edits differ from the deltas. The output below is abridged: the full verbatim `diff` output is in the phase result.

```
== ADDED justification-intake (delta vs merged), abridged
104c104
< | absent, `null` or the empty string | `consent_required` |
---
> | absent, `null`, the empty string, or a string longer than 20 characters | `consent_required` |
106c106
< | a non-empty string different from the current version | `consent_outdated` |
---
> | any other string different from the current version | `consent_outdated` |
148,153c148,155
  (Consent version check paragraph: WARNING 6 wording, as above; full diff in the phase result)
== MODIFIED Submit blocking, per field: identical
== MODIFIED Four-step stepper: identical
== MODIFIED student-requests Correction validation: identical
== MODIFIED audit-log Request and document payloads: identical
== ADDED request-review Consent shown on the staff detail: identical
== privacy-notice byte copy: diff -r empty
```

## Archive move (step 3)

Snapshot taken before the move (scratchpad copy of the change folder), then `git mv openspec/changes/request-consent openspec/changes/archive/2026-10-21-request-consent`. The source was absent afterwards. Readback `diff -r <snapshot> openspec/changes/archive/2026-10-21-request-consent`: empty, exit status 0. The rename is staged in the index by `git mv`; nothing is committed.

Archive contents: `proposal.md`, `specs/` (5 delta specs), `design.md`, `tasks.md`, `verify-report.md`, `apply-progress.md`, `exploration.md`, `research.md`, `preproposal.yaml`, and this `archive-report.md` (additive, excluded from the readback).

## Tasks reconciliation (task completion gate)

- Unchecked on entry: 4.6, 9.1 to 9.7. Owner-held and left unchecked as instructed: 4.6 (backup branch `backup-before-request-consent` deletion, on the owner's yes), 9.6 (owner merges tracker PR #36 to `main`, keeping the tracker branch), 9.7 (UAM legal review).
- Marked done 2026-10-21 by this archive run: 9.1 (verify report committed in `7aa4a32`), 9.2 (spec sync), 9.3 (roadmap), 9.4 (teammate note), 9.5 (archive move and this report). These are the closeout tasks of this step, not stale implementation checkboxes, so no exceptional reconciliation was required for implementation tasks.
- Gate note for 9.5: its text lists `npm test` and `npm run build` before archive. They were NOT re-run in this archive step, which changed docs only. The code gate rests on the verify run (`verify-report`, pass_with_warnings, 5116 tests) and the later docs-only commit `d1fda97`.
- 8.7 (optional real-Postgres suite) is done per the final-state facts above.

## Roadmap (tasks 9.3 and 9.4)

- Row 9 `request-consent`: `pendiente` changed to `archivado`.
- Note paragraph replaced with the archived note: archived 2026-10-21; consent checkbox v1 with `CONSENT_VERSION` 2026-10-20 and the public privacy notice at `/privacy`; requests presented before the change show «No registrado»; a correction never asks again; open items outside the code: UAM legal review of the consent text and notice, the controller domicile and contact office (placeholder; replacing it needs a new `CONSENT_VERSION`), the mail provider not named (owner decision, Ley 787 arts. 13 and 14 risk); re-consent and in-app revocation out of scope; minimizing what teachers receive by email is a `teacher-remission` follow-up.
- Teammate note (no `document-extraction` note existed, so it lives in the same note): `document-extraction` regenerates its migration as `0011` after `request-consent` reaches `main` (`0010` is taken by this change; never hand-numbered) and rebases onto `submitRequestAction(input: unknown)` and `SubmitInput.consentimientoVersion`.
- The owner's message to the teammate is not sent by this archive step.

## Open follow-ups (for the next owner decision)

1. Backup branch `backup-before-request-consent`: delete only on the owner's explicit yes (task 4.6).
2. Merge tracker PR #36 to `main` with a merge commit after S1 to S3 are merged into it, keeping the tracker branch (task 9.6).
3. UAM legal review of the consent text and notice; domicile wording (task 9.7).
4. `axe-core` declared as devDependency once the unrelated `package-lock.json` diff is resolved (WARNING 3). `package-lock.json` was not touched by this archive.
5. 360 px: add `/privacy` to the walk record or run it once, and add a self-test for the `fixedWidths` guard in `src/app/privacy/page.test.tsx` (WARNING 4, SUGGESTION 4).
6. RC-9 staff date format deviation recorded (WARNING 7); `design.md` not amended.
7. Long comment line (about 118 characters) in the `submitDraft` doc comment in `src/lib/data/solicitudes.ts` (SUGGESTION 5).
8. Middleware signed-in behavior has no automated test (WARNING 5).
9. UX items moved to `docs/flow-experience-backlog.md` (UX-01 to UX-03, from walk 8.4).

## Traceability

- Engram observation IDs read: none. The hybrid store declared path locators for every required artifact, and they were read from the filesystem (`openspec/changes/request-consent/{proposal.md, specs/*, design.md, tasks.md, verify-report.md}`). No topic-key observation was read.
- Commits referenced: `7aa4a32` (verify report), `d1fda97` (real-Postgres proof), `07d23f3` (precedent archive, teacher-remission), tracker slices listed at the top.
- Engram save: topic key `sdd/request-consent/archive-report`, type `architecture`, project `justifia`.
