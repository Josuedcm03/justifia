# Archive report: auth-route-tests

Change: auth-route-tests (roadmap row 16: RNF-01 (c))
Project: justifia | Store mode: openspec | Archived: 2026-11-18
Archive location: openspec/changes/archive/2026-11-18-auth-route-tests/
Branch: `feat/auth-route-tests`, from `main` c7c0c20, HEAD 428122a at verify. The archive commit is made by the parent; nothing was committed, pushed or run against a database by this phase. The change branch is not to be deleted after merge (memory `keep-change-branches`); `main` auto-deploys to production, so the merge needs the owner's explicit OK (merge gate in `tasks.md`).

## Final state at close

Ranking used (per `sdd-archive` Final-State Authority): persisted tasks artifact (rank 1), then launch-prompt final-state facts (rank 2), then `verify-report` and `apply-progress` (rank 3, intermediate snapshots).

| Fact                       | Final state                                                                                                                                                                                                                                        | Source (rank)                                                                                           |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Tasks                      | 42 of 42 complete by `gentle-ai sdd-status` (`completed: 42, pending: 0, allComplete: true`, `archive` next). Tasks 5.1 to 5.3 were the only open ones at verify time and are closed by this archive                                               | `tasks.md` (1); `gentle-ai sdd-status auth-route-tests --cwd . --json` run after 5.3 was checked        |
| Verify verdict             | pass_with_warnings; 0 CRITICAL; 2 WARNING; 5 SUGGESTION. The owner approved archive on 2026-11-18                                                                                                                                                  | `verify-report` (3), written on 428122a; launch prompt (2); the runtime verify attempt is settled       |
| Requirements and scenarios | 11/11 requirements (AEA-1 to AEA-4, RAC-1 to RAC-7); 18/18 scenarios compliant (AEA-3 "Same rule in page and action" by composition, see S5)                                                                                                       | `verify-report` (3), snapshot                                                                           |
| Unit gates                 | Full `npm test` with a dummy `DATABASE_URL`: 350 files, 8,343 tests passed, 0 failed. `npm run typecheck`: exit 0. No source file changed after the verify run (this archive touched only docs, specs and the change folder), so the numbers stand | `verify-report` (3); launch prompt (2)                                                                  |
| Build                      | `next build` was not run (the brief forbade it); typecheck is the build gate                                                                                                                                                                       | `verify-report` (3)                                                                                     |
| Database                   | Nothing in this change touches a database. Tests run with a dummy `DATABASE_URL` (`postgres://u:p@127.0.0.1:9/x`). No `drizzle-kit`, seed, `neon` or SQL was run during apply, verify or archive                                                   | `tasks.md` (1); `verify-report` (3)                                                                     |
| Authored size              | 1,208 added + 12 deleted = 1,220 changed lines (`openspec/` and `.engram/` excluded). See the size exception below                                                                                                                                 | `tasks.md` 4.11 (1); `verify-report` (3), confirmed by `git diff --numstat c7c0c20..428122a` at archive |

## Commits

| Commit  | Subject                                                                            | Unit |
| ------- | ---------------------------------------------------------------------------------- | ---- |
| 5e68ea3 | `docs(auth-route-tests): add the SDD planning documents`                           | 0    |
| cab684b | `fix(auth): reject backslash and non-path values in the login next target`         | 1    |
| 4f9ec5e | `fix(auth): apply the shared next rule on the login page`                          | 2    |
| 5a2c916 | `test(auth): add the route coverage ratchet and the register and profile tests`    | 3    |
| efe47ca | `test(auth): add the role access matrix over every entry point`                    | 4    |
| 428122a | `docs(auth-route-tests): write test inputs so tooling does not read them as paths` | docs |

Process note on efe47ca: it was made with `--no-verify`. The repository `.githooks/pre-commit` only exports Engram memory to `.engram/` and runs no lint, format or test step, so no quality gate was skipped (per `verify-report`, process notes).

## Size exception

Delivery strategy `exception-ok`, option A of task 0.1 (one PR, one commit per work unit). After unit 3 the authored diff was 707 lines and the projection for unit 4 reached about 1,140, over the 1,000-line session budget. The owner accepted a `size:exception` with a hard cap of 1,250 changed lines. The final measure is 1,220 lines (cap 1,250, margin 30; budget exceeded by 220). Tests were not trimmed to fit.

## Matrix figure (RAC-7, task 4.12)

Printed by the run: 62 entry points (25 pages, 7 routes, 30 server actions in 12 files) x 7 identities (five roles, anonymous, flagged) = 434 cases; 320 denied (pages 119, routes 40, actions 161) and 114 admitted (56, 9, 49). Every denial is asserted against the exact documented outcome with a tripwire proving that no data module was reached, and each matrix file fails unless 100% of the unauthorized combinations were denied. Each case goes through the real `src/lib/auth/dal.ts`; only the session source is mocked. The table is forced to equal the tree by RAC-1 and RAC-5.

The figure lines are printed through `console.info`, so they show with `--reporter=default` or `verbose` and not under the non-TTY reporter of plain `npm test` (S3). The describe titles carry the same numbers.

## Flag for the owner: thesis 5.3 (task 5.2)

Flag only; the thesis was not edited. The thesis 5.3 keeps RNF-01 at "Parcial" because no test checked every route with every role. The matrix figure above is the evidence to cite. Word it as "every page, route handler and exported server action under src/app, invoked through the real guard", not as end-to-end HTTP: the matrix calls pages as functions, routes with a `Request` and actions directly, and does not drive routing through `middleware.ts` (W2). Whether RNF-01 stays "Parcial" is the owner's decision.

## Verify warnings and suggestions at close

Each statement is attributed to `verify-report` at verification time (2026-11-18, 428122a), then given its status at close.

| #   | `verify-report` statement (verification time)                                                                                                                                                                                                    | Status at close                                                                                                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W1  | `src/i18n/locale.ts` is a "use server" file outside `src/app`, with no test and not inventoried; RAC-1 as written says every "use server" file MUST have an actions test. Either extend the walker or narrow the wording when the spec is synced | Closed by this archive (wording option). RAC-1 now covers "use server" files under `src/app` and states that `src/i18n/locale.ts` (locale cookie only, no protected data) is outside the inventory. The same wording is in the change delta and in the synced main spec. See Spec sync. No code was changed |
| W2  | The thesis wording "by URL" holds only at page-guard level; `middleware.ts` has no test, so the figure must not be quoted as end-to-end HTTP                                                                                                     | Open, accepted, handled by wording. Flagged for the thesis (above) and kept as a follow-up (the `middleware.ts` test). Pages still deny through their own guard (RAC-2), so authorization does not depend on the middleware                                                                                 |
| S1  | The admitted branch of the matrix only proves "not a denial"                                                                                                                                                                                     | Open, accepted. This is what RAC-4 "Allowed identity" requires; a positive-render check is a possible later strengthening                                                                                                                                                                                   |
| S2  | Add a test for `(dashboard)/layout.tsx` and extend the RAC-2 ratchet to `layout.tsx`, as defence in depth                                                                                                                                        | Open, not done. The layout is a second layer, not an addressable entry point; every page guards itself                                                                                                                                                                                                      |
| S3  | The figure lines are hidden under the non-TTY reporter of plain `npm test`; consider a dedicated npm script                                                                                                                                      | Open, not done. The 100% result is an assertion, not a print; reproduce the figure with `vitest run src/app/access-matrix src/app/route-coverage.test.ts --reporter=default` and the dummy `DATABASE_URL`                                                                                                   |
| S4  | AEA-4 "with or without a signed-in caller": only the no-session variant is run                                                                                                                                                                   | Open, accepted. The forbidden `getSession` and guard spies prove the action never consults a session, so the signed-in variant follows by construction                                                                                                                                                      |
| S5  | AEA-3 "Same rule in page and action": the action is tested with the backslash value only, not `//evil.com`                                                                                                                                       | Open, accepted. Covered through the shared helper test and the page test; one more `it.each` row in `login/actions.test.ts` would make it direct                                                                                                                                                            |

Other verify caveats carried as history, not as open items: the lint check shows only CRLF working-copy noise on three files (`core.autocrlf=true`; committed blobs have 0 CR characters), and coverage tooling is not installed.

## Contradictions recorded

- Task count: `verify-report` (rank 3) says 36 of 39 complete (5.1 to 5.3 pending by design). `tasks.md` (rank 1) at archive says all complete, and `gentle-ai sdd-status` reports 42 of 42 (its total counts more lines than the 39 the verifier counted). The tasks artifact is authoritative; the difference is exactly tasks 5.1 to 5.3, which this archive performed. The 39 versus 42 total is a counting difference of the tooling, not a pending task.
- The `verify-report` Completeness section says phase 5 is pending; at close it is done. No unrankable contradiction remains.

## Spec sync

Method: both capabilities are new (all requirements ADDED, no base spec), so each delta is the full spec. Each was copied with `cp` and checked with `diff -r` (empty, exit 0). Neither was read and rewritten through the model. Both keep the delta's "Delta type: this whole file is ADDED" note, as `coordination-reports` does. The only authored edit is the W1 wording in RAC-1, made in the change delta before the copy so that delta and main spec are byte-identical.

| Domain                | Action  | Details                                                                                                                                                                                                                                           |
| --------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| auth-entry-access     | Created | 4 requirements (AEA-1 to AEA-4), 9 scenarios, copied verbatim from the delta. AEA-4 stays a characterization: the later "/register" closing change edits it on purpose                                                                            |
| route-access-coverage | Created | 7 requirements (RAC-1 to RAC-7), 9 scenarios. RAC-1 narrowed for W1: "use server" files under `src/app`, with `src/i18n/locale.ts` stated as outside the inventory; the vocabulary line and the "Missing test" scenario say "under `src/app`" too |

`diff -r openspec/changes/auth-route-tests/specs/auth-entry-access/spec.md openspec/specs/auth-entry-access/spec.md`: empty, exit 0.
`diff -r openspec/changes/auth-route-tests/specs/route-access-coverage/spec.md openspec/specs/route-access-coverage/spec.md`: empty, exit 0.

## Archive move

`.gentle-ai-instance` (a per-change tooling marker, tracked in git, absent from every other archived change) was removed with `git rm -f` before the move so it does not enter the archive. `verify-report.md` was untracked and was staged with `git add` first, so the move is complete. Then `git mv openspec/changes/auth-route-tests openspec/changes/archive/2026-11-18-auth-route-tests`. The source is absent afterwards. Readback `diff -r <pre-move snapshot> openspec/changes/archive/2026-11-18-auth-route-tests` (this `archive-report.md` is additive and excluded): empty, exit 0.

Archive contents: `proposal.md`, `exploration.md`, `design.md`, `specs/` (two delta specs), `tasks.md`, `apply-progress.md`, `verify-report.md` and this `archive-report.md`.

Task completion gate: no unchecked task in `tasks.md`. No stale-checkbox reconciliation was performed; 5.1 to 5.3 were completed by doing them.

## Roadmap

`docs/roadmap.md` (task 5.1): row 16 `auth-route-tests` added (owner Armando, RNF-01 (c), "Si alcanza el tiempo", `archivado`), with a Spanish note in "Notas" (archive date, deliverables, the matrix figure, the open-redirect fix and the pending follow-ups). The file keeps its CRLF working-copy line endings; the diff is 13 added lines and no other change.

## Open items after close (outside this change)

1. Commit and merge the archive together with the implementation; `main` auto-deploys, so the merge needs the owner's explicit OK. Keep the change branch.
2. Follow-ups named in the roadmap note: closing the open "/register" (point 0.6 of the thesis plan; it edits the AEA-4 pins), a test for `middleware.ts`, and the deactivated-account window inside the 8-hour session (JWT lifetime; out of scope here).
3. Thesis: cite the matrix figure with the wording above in 5.3; the owner decides whether RNF-01 stays "Parcial".
4. Optional hardening from the suggestions: a `layout.tsx` test and RAC-2 extension (S2), a one-command npm script for the figure (S3), and the missing direct rows (S4, S5).
5. If a "use server" file is ever added outside `src/app`, it escapes the ratchet by design (RAC-1 as narrowed); revisit the walker then.

## Traceability

- Engram observation IDs read: none. The store is `openspec`; every required artifact was read from its file locator under `openspec/changes/auth-route-tests/` (`proposal.md`, `specs/*`, `design.md`, `tasks.md`, `verify-report.md`, plus `apply-progress.md` and `exploration.md`).
- Engram counterparts that exist but were not read (topic keys in project `justifia`): `sdd/auth-route-tests/explore` #470, `preproposal` #471, `proposal` #472, `spec` #473, `design` #474, `tasks` #475, `apply-progress` #476, `verify-report` #477.
- Commits referenced: 5e68ea3, cab684b, 4f9ec5e, 5a2c916, efe47ca, 428122a; base c7c0c20.
- Engram save: topic key `sdd/auth-route-tests/archive-report`, type `architecture`, project `justifia`.
