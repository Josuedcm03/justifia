# Archive report: rest-signals-cause-scope

Change: rest-signals-cause-scope (roadmap row 15: RF-05 (a), (b); RN-09, RN-10, RN-15)
Project: justifia | Store mode: hybrid | Archived: 2026-11-11
Archive location: openspec/changes/archive/2026-11-11-rest-signals-cause-scope/
Branch: `fix/rest-signals-cause-scope` (head at archive: 96a115f). Not merged to `main`; no PR opened. The change branch is kept (memory `keep-change-branches`).

## Final state at close

Ranking used (per `sdd-archive` Final-State Authority): persisted tasks artifact (rank 1), then launch-prompt final-state facts (rank 2), then `verify-report` and `apply-progress` (rank 3, intermediate snapshots).

| Fact | Final state | Source (rank) |
|---|---|---|
| Tasks | 37 of 37 complete; no unchecked implementation task | `tasks.md` at 96a115f (1) |
| Verify verdict | pass_with_warnings; 0 CRITICAL; 2 WARNING; 5 SUGGESTION | `verify-report` (3), written at head ea258fd |
| Requirements and scenarios | 10/10 requirements; 47/47 scenarios compliant at runtime | `verify-report` (3), snapshot |
| Integration suite | Run on 2026-11-11 against throwaway Neon branch `test-rest-signals-cause-scope-pg` (parent `production`; created and deleted the same day, each command with the owner's explicit yes). 7 files, 120 tests: 119 passed, 1 failed. `validation-signals.integration.test.ts` passed, including the non-rest cause case | `tasks.md` 9.1-9.4 (1); launch prompt (2) |
| Integration failure | `queue-index.integration.test.ts` failed in the full run (planner chose `Bitmap Heap Scan` instead of `Index Scan` on `IX_Solicitud_Cola`); it passed when re-run alone on the same branch and code. It imports nothing this change touched. Recorded as an intermittent follow-up outside this change. Root cause NOT investigated | `tasks.md` 9.3 (1) |
| Unit gates | `npm test` (dummy `DATABASE_URL`): 320 files, 7286 tests passed. `npm run typecheck`: exit 0. `npx eslint src`: only CRLF `Delete ␍` noise. Format check passes for changed `src/` and `i18n/` files. Gates measured at 1a3ad50 and last full lint at ea258fd | `tasks.md` 11.1 (1); launch prompt (2) |
| Authored size | 1020 lines (967 additions + 53 deletions) excluding `openspec/` and `.engram/`, measured at apply time; budget 1200 | `tasks.md` 11.2 (1) |
| Branch commits over base 245ad57 | 16a7fa9, 2d5757c, 60525e9, 7aeeef8, 5566f90, ea258fd, 1a3ad50, a15aa79, 96a115f | launch prompt (2); `git log` |

## Verify warnings at close

Each statement is attributed to `verify-report` at verification time, then given its status at close.

| # | `verify-report` statement (verification time) | Status at close |
|---|---|---|
| 1 | The integration case for brief criterion 7 has never run | Closed. Run under `tasks.md` 9.3 (see Final state). Current state, not the snapshot's "not executed" |
| 2 | Commit 16a7fa9 also carries `.engram/` sync files not mentioned in its message | Accepted at verify time (apply deviation a). Open note for the PR description. Commit 1a3ad50 also carries `.engram/chunks/f4533cf0.jsonl.gz` and `.engram/manifest.json`, which the verify report did not cover |

## Verify suggestions at close

| # | Suggestion (`verify-report`, verification time) | Status at close |
|---|---|---|
| 1 | Extend the closed-set sweep in `evaluate.test.ts` to all five causes | Applied in 1a3ad50 (launch prompt, rank 2; commit stat shows `evaluate.test.ts` changed) |
| 2 | Two docstring lines in `verdict.ts` and `evaluate.ts` exceed 80 columns | Applied in 1a3ad50 (reflowed; cosmetic) |
| 3 | Add a test that the extraction section still renders a stored rest period under `not_applicable` | Not added. `ExtractionSection` takes no cause input, so such a test would be a tautology. Covered by construction: `extraction-section.tsx` has no diff |
| 4 | Task 7.3 checked though no fixture needed a fix | Note only; no action |
| 5 | `docs/requirements.md` and `docs/roadmap.md` not prettier-clean | Pre-existing at 245ad57; no action in this change |

## Contradictions recorded

- Warning 1 status: the launch prompt and `tasks.md` 9.3 (ranks 2 and 1) say closed; `verify-report` (rank 3) says open. Resolved in favor of the higher-ranked sources. The integration run is recorded as performed; the snapshot statement is kept only as history.
- Task count: `verify-report` says 32 of 37 complete. `tasks.md` at 96a115f says 37 of 37. The tasks artifact (rank 1) is authoritative.

## Spec sync

| Domain | Action | Details |
|---|---|---|
| validation-signals | Updated | RENAMED 1: "Three outcomes with a closed set of reasons (RF-05 a, RN-15)" to "Four outcomes with a closed set of reasons (RF-05 a, RN-15)". MODIFIED 5: "Four outcomes...", "Incoherent dates, RN-09" (its cross-reference now names "Four outcomes"), "Uncovered dates, RN-10", "Three-state suggested verdict", "Signals text, i18n and accessibility (RNF-12)". ADDED 1: "Rest signals apply only to causes that admit rest (RF-05 a, RF-05 b, RN-09, RN-10)", appended at the end of Requirements. 12 to 13 requirements |
| request-review | Updated | MODIFIED 2: "Signals section and suggested verdict on the staff detail", "Signals UI i18n (RNF-12)". 26 requirements, count unchanged |
| coordination-escalation | Updated | MODIFIED 1: "Signal outcomes on the open escalation detail". 12 requirements, count unchanged |

Method: delta blocks were copied by a script (`fs` read/write of the delta bytes, no model-generated block content). The three main specs stay CRLF (verified: zero LF-only lines). The `(Previously: ...)` annotation lines are dropped as change-specific, matching the validation-signals domain, which has none. The RENAMED `(Reason: ...)` and `(Migration: ...)` notes are delta-only and are not copied. No other requirement was touched. Only "Three outcomes" references in main specs were the one inside "Incoherent dates, RN-09", now replaced.

Readback (`diff -r`, expected = delta block with annotation lines, actual = merged block). The only differences are the five removed annotation lines:

```
diff -r .../readback/expected/coordination-escalation/...Signal-outcomes-...md .../readback/actual/coordination-escalation/...Signal-outcomes-...md
23d22
< (Previously: three outcomes; no `not_applicable` in the projection.)
diff -r .../readback/expected/request-review/...Signals-section-and-suggested-verdict-on-the-staff-detail-.md .../readback/actual/request-review/...
22d21
< (Previously: three outcomes; no `not_applicable` entry or explanation line.)
diff -r .../readback/expected/request-review/Requirement-Signals-UI-i18n-RNF-12.md .../readback/actual/request-review/Requirement-Signals-UI-i18n-RNF-12.md
9d8
< (Previously: no `not_applicable` outcome or explanation line in the list.)
diff -r .../readback/expected/validation-signals/...Four-outcomes-...md .../readback/actual/validation-signals/...
12d11
< (Previously: three outcomes, no `not_applicable`.)
diff -r .../readback/expected/validation-signals/...Incoherent-dates-RN-09-...md .../readback/actual/validation-signals/...
16d15
< (Previously: evaluated for every cause; cross-reference named "Three outcomes".)
diff -r .../readback/expected/validation-signals/...Signals-text-i18n-and-accessibility-RNF-12.md .../readback/actual/validation-signals/...
11d10
< (Previously: no `not_applicable` label or explanation line.)
diff -r .../readback/expected/validation-signals/...Three-state-suggested-verdict-...md .../readback/actual/validation-signals/...
15d14
< (Previously: computed over all signals; `no_alerts` required every signal `absent`; no `not_applicable`.)
diff -r .../readback/expected/validation-signals/...Uncovered-dates-RN-10-...md .../readback/actual/validation-signals/...
17d16
< (Previously: evaluated for every cause.)
```

The ADDED block "Rest signals apply only to causes that admit rest" shows no difference. The scratch directory holding the expected and actual files is outside the repository.

## Archive move

`git mv openspec/changes/rest-signals-cause-scope openspec/changes/archive/2026-11-11-rest-signals-cause-scope`. The source is absent afterwards. Readback `diff -r <pre-move snapshot> openspec/changes/archive/2026-11-11-rest-signals-cause-scope`: empty, exit 0. The rename is staged by `git mv`.

Archive contents: `proposal.md`, `exploration.md`, `design.md`, `specs/` (three delta specs), `tasks.md`, `apply-progress.md`, `verify-report.md`, and this `archive-report.md` (additive, excluded from the readback).

Task completion gate: no unchecked implementation task in `tasks.md`. No exceptional stale-checkbox reconciliation was performed.

## Roadmap

`docs/roadmap.md` row 15 (`rest-signals-cause-scope`): status `pendiente` changed to `archivado`. No other line changed.

## Open items after close (outside this change)

1. Merge `fix/rest-signals-cause-scope` to `main` (merge gate in `tasks.md`: before the tag; `main` auto-deploys). Keep the change branch after merge.
2. `queue-index.integration.test.ts` is intermittent under the full integration suite (root cause not investigated).
3. Post-merge follow-ups in `tasks.md`: extraction check with real photos, ensayo-secretaria rehearsal, `scripts/session-verify.local.ts` expectations (RN-09/RN-10 to "no aplica" for SC-06, SC-10, SC-11 a/b, SC-13, P2, P3, P5), thesis review (review 4.x and A.5; requirements matrix).
4. Known limitation (documented in the `validation-signals` delta): a rest-admitting cause with a non-medical document still evaluates RN-09 and RN-10. That case belongs to RN-13 and RF-14 (out of scope).

## Traceability

- Engram observation IDs read: none. The hybrid store declared file locators for every required artifact; they were read from the filesystem (`openspec/changes/rest-signals-cause-scope/{proposal.md, exploration.md, design.md, specs/*, tasks.md, apply-progress.md, verify-report.md}`).
- Engram counterparts that exist but were not read (topic keys in project `justifia`): `sdd/rest-signals-cause-scope/explore` #406, `proposal` #407, `design` #408, `spec` #409, `tasks` #410, `apply-progress` #411, `verify-report` #412.
- Commits referenced: `96a115f` (tasks at close), `a15aa79` (verify report), `1a3ad50` (verify suggestions), `5566f90` (docs and roadmap row 15), `ea258fd` (apply progress and gates).
- Engram save: topic key `sdd/rest-signals-cause-scope/archive-report`, type `architecture`, project `justifia`.
