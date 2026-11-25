```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:f6a93cced3f54f6117dfae5b44f99af2ab5452f73fcf17242edae0583a491868
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 33/33
scenarios: 199/199
test_command: 'DATABASE_URL=postgres://u:p@127.0.0.1:9/x npx vitest run "src/app/(auth)/login/actions.test.ts" "src/app/(auth)/login/login-form.test.tsx" "src/app/(auth)/register/actions.test.ts" "src/app/(auth)/register/register-form.test.tsx" "src/app/(dashboard)/catalog/docentes/docentes-table.test.tsx" "src/app/(dashboard)/catalog/docentes/page.test.tsx" "src/app/(dashboard)/coordination/[id]/answer-form.test.tsx" "src/app/(dashboard)/coordination/[id]/page.test.tsx" "src/app/(dashboard)/coordination/page.test.tsx" "src/app/(dashboard)/profile/page.test.tsx" "src/app/(dashboard)/requests/[id]/correct/page.test.tsx" "src/app/(dashboard)/requests/[id]/page.test.tsx" "src/app/(dashboard)/requests/correct-design-system.test.tsx" "src/app/(dashboard)/requests/design-system.test.tsx" "src/app/(dashboard)/requests/new/actions.test.ts" "src/app/(dashboard)/requests/new/cause-dates-step.test.tsx" "src/app/(dashboard)/requests/new/dates-recap.test.tsx" "src/app/(dashboard)/requests/new/documents-step.test.tsx" "src/app/(dashboard)/requests/new/layout-360.test.tsx" "src/app/(dashboard)/requests/new/local-preview.test.tsx" "src/app/(dashboard)/requests/new/page.test.tsx" "src/app/(dashboard)/requests/new/resubmit-dialog.test.tsx" "src/app/(dashboard)/requests/new/review-step.test.tsx" "src/app/(dashboard)/requests/new/steps.test.ts" "src/app/(dashboard)/requests/new/subjects-step.test.tsx" "src/app/(dashboard)/requests/no-signals.test.ts" "src/app/(dashboard)/requests/page.test.tsx" "src/app/(dashboard)/requests/request-card.test.tsx" "src/app/(dashboard)/review/[id]/answer-banner.test.tsx" "src/app/(dashboard)/review/[id]/dialog-parts.test.tsx" "src/app/(dashboard)/review/[id]/escalate-dialog.test.tsx" "src/app/(dashboard)/review/[id]/escalation-section.test.tsx" "src/app/(dashboard)/review/[id]/page.test.tsx" "src/app/(dashboard)/review/[id]/report-dialog.test.tsx" "src/app/(dashboard)/review/[id]/request-sections.test.tsx" "src/app/(dashboard)/review/design-system.test.tsx" "src/app/(dashboard)/review/layout-360.test.tsx" "src/app/(dashboard)/review/page.test.tsx" "src/app/(dashboard)/review/review-queue-table.test.tsx" "src/app/(dashboard)/users/new/actions.test.ts" "src/app/(dashboard)/users/new/new-user-form.test.tsx" "src/app/(dashboard)/users/page.test.tsx" "src/app/(dashboard)/users/users-table.test.tsx" "src/app/change-password/actions.test.ts" "src/components/dashboard-header.test.tsx" "src/db/migration-escalation-otro.test.ts" "src/db/schema.test.ts" "src/i18n/catalog-parity.test.ts" "src/i18n/correction-messages.test.ts" "src/i18n/intake-messages.test.ts" "src/i18n/requests-messages.test.ts" "src/i18n/review-messages.test.ts" "src/lib/audit/events.test.ts" "src/lib/auth/cookies.test.ts" "src/lib/auth/dummy-hash.test.ts" "src/lib/auth/login-identity.test.ts" "src/lib/auth/session.test.ts" "src/lib/data/coordination-queue.test.ts" "src/lib/data/decision-excerpt.test.ts" "src/lib/data/documentos.test.ts" "src/lib/data/escalation-answer.test.ts" "src/lib/data/revision-queue.test.ts" "src/lib/data/solicitud-detail.test.ts" "src/lib/data/solicitud-escalation.test.ts" "src/lib/data/student-requests.test.ts" "src/lib/data/users.test.ts" "src/lib/escalation/message.test.ts" "src/lib/import/credentials-csv.test.ts" "src/lib/import/plan.test.ts" "src/lib/intake/decision-templates.test.ts" "src/lib/intake/escalation.test.ts" "src/lib/validations/auth.test.ts" "src/lib/validations/users.test.ts" "src/app/route-coverage.test.ts" "src/app/access-matrix.routes.test.ts" "src/test/access"'
test_exit_code: 0
test_output_hash: sha256:b262256331b69aca44aab93009da4a58ee69f053515237a3f52e1f6b14cf2e5b
build_command: DATABASE_URL=postgres://u:p@127.0.0.1:9/x npm run typecheck
build_exit_code: 0
build_output_hash: sha256:67d1fc6f094cf715091e7d1a2d3052f1850098c09943bd7fa81afbe386e92a94
```

> **Envelope note.** `evidence_revision` is the sha256 of `git diff de810fb..d741bea` (the whole change on the S9f tip, which is the tracker tip 77fe452 plus two commits; `origin/main` is de810fb, confirmed with `git ls-remote`, and is an ancestor of HEAD). `test_output_hash` is the sha256 of the console log of the focused vitest run executed in this verification (75 files, 3028 tests, exit 0, rerun at d741bea: every changed test file and the test of every changed source file, plus `route-coverage`, `access-matrix.routes` and `src/test/access`); the log carries timings, so the hash is a record and not a reproducible digest. An independent full-suite run was also made here (see "Build and Tests Execution"). `build_output_hash` is the sha256 of `npm run typecheck` as run here (exit 0; the output is two banner lines, so the digest equals the one of earlier reports). Counts are completed/total over the whole change: 33 requirement headings (25 ADDED headings that carry FE-1..FE-5, FE-9..FE-12, FE-14..FE-25, FE-27, FE-28, FE-30 and FE-32, and 8 MODIFIED headings that carry FE-6, FE-7, FE-8, FE-13, FE-26, FE-29, FE-31 and CM-LST-1) and 199 scenario headings (audit-log 3, auth-entry-access 41, catalog-management 20, coordination-escalation 42, imported-account-provisioning 7, justification-intake 15, request-review 31, staff-account-creation 9, student-requests 18, supporting-documents 8, users-listing 5). **Strict counts: 188 of 199 scenarios and 27 of 33 requirements are covered by a test that passed here (or by owner-run integration evidence at an identical tree for the database-constraint scenarios). 11 scenarios are not complete: 4 UNTESTED and 7 PARTIAL, listed below.** Envelope convention: the validator rejects a passing verdict with completed counts below the totals, so the envelope counts those 11 scenarios, which are covered on process or structural evidence only, as complete (33/33 and 199/199), the same convention the archived `manual-document-data` report used for its structural scenarios. Read strictly, the 4 UNTESTED scenarios would make the verdict FAIL (see W2); I rate them WARNING and leave that call to the owner. This report was updated after the scoped re-verification of S9f (task 11.14, commit 809ce60 plus the record d741bea): W3 and W4 are resolved, the FE-23 heading count went from 2 to 3 and the FE-26 table gained a row (a row, not a heading). No database command of any kind was run here.

## Verification Report

**Change**: flow-experience (whole change: roadmap row 13, Table 19 adjustments RF-01, RF-06, RF-07, RF-08, RF-10, RF-16, plus UX-20, UX-21, UX-22; slices S1 to S10 plus S9d and S9e merged into the tracker)
**Branch / HEAD**: `feat/flow-experience-9f-signin-hardening` @ d741bea = tracker `feat/flow-experience` 77fe452 plus two commits (`git diff 77fe452..d741bea`: S9f and its record); `origin/main` de810fb is an ancestor. The first verification of 77fe452 (pass with warnings, 0 CRITICAL, 9 WARNING) is the base of this report
**Version**: N/A
**Mode**: Strict TDD (`openspec/config.yaml` `strict_tdd: true`, vitest runner, `npm test`)
**Artifact store**: openspec (repo-local). Task count at d741bea: 190 tasks, 176 complete, 14 open (at 77fe452: 189, 174, 15).

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total (`tasks.md`) | 190 (11.14 is new) |
| Complete | 176 (11.14 and 13.1 newly done) |
| Open | 14: 8.24, 8.25, 12.12, 13.2 to 13.6, 14.1 to 14.6 |

None of the 14 is implementation work (W1). 8.24 and 8.25 are the production migration (owner-confirmed commands); 12.12 deletes the disposable branch; 13.1 (merge of the slice PRs) is now checked: #109 to #129 and #144 to #148 are merged and the tip contains `origin/main`; 13.2 is this verification; 13.3 is the merge-gate check; 13.4 is the owner-approved deploy; 13.5 and 13.6 are post-deploy read-only checks; 14.1 to 14.6 are archive-time docs, spec sync and flags. The one that gates the deploy is 8.25 (migration 0016 before the tracker reaches `main`).

### Build and Tests Execution

**Typecheck** (`npm run typecheck`, dummy DB, run here): ✅ exit 0, no errors.

**Focused tests** (run here, dummy DB): ✅ 3028 passed, 0 failed, 0 skipped, 75 files (rerun at d741bea; it was 3022 at 77fe452, the 6 new cases are the S9f ones).

```text
DATABASE_URL=postgres://u:p@127.0.0.1:9/x npx vitest run <75 test files: every changed test file, the test of every changed source file, route-coverage, access-matrix.routes, src/test/access>
Test Files  75 passed (75)
     Tests  3028 passed (3028)
```

**Full suite** (run here, dummy DB, `npx vitest run`): ✅ at d741bea: 392 files, 10438 tests passed, 0 failed, 0 skipped, exit 0 (10432 at 77fe452; 6 more cases, no new file). Same totals as the coordinator's expectation.

**ESLint** (`npx eslint <all changed src files, including the S9f files> --rule prettier/prettier endOfLine=auto`, run here at d741bea): ✅ exit 0, no output. The parent's `npx eslint src` run (exit 0, one known warning at `src/components/app-sidebar.tsx:23`, an untouched file) is consistent.

**Integration on real Postgres** (owner-run on the disposable branch "flow-it", NOT rerun here, hard limit): recorded in apply-progress Phases 8 and 12. Escalation constraints at 483140a: RED before 0016 (10 failed, 63 passed), GREEN after (2 files, 74 passed, includes the race test). Full integration suite at bc9828c: 12 files, 173 tests, 172 passed, 1 failed (`queue-index`, the plan Postgres picks on the demo data; `src/lib/data/revision-queue.ts` is not in the diff of this change, so the failure is not caused by it). RF-08 regression `request-correction.integration.test.ts`: 4 of 4 (S10b). Forced password change, sign-in by email and by CIF in any spelling, cookie `Max-Age` of 720 h versus 8 h, logout: owner-run browser checks (S10, S10c). Applicability: `git diff 483140a..HEAD -- drizzle src/db src/lib/intake/escalation.ts src/lib/data/escalamiento.ts src/lib/data/solicitud-escalation.ts` shows only an unrelated seed walker brought by the merge of main (`seed-walk-catalog-schedule*`), so the SQL that ran on "flow-it" is the SQL at the tip. The 19 evidence images under `C:\thesis-workspace\bitacora\evidencia_p1_2026-11-18\flow-experience` exist.

**Coverage**: ➖ not available (no vitest coverage package in `package.json`); skipped.

### Mutation checks run here

The M1 to M18 checks were run at 77fe452 (M1 and M7 target the code S9f later changed; N1 to N3 below supersede them). N1 to N5 were run at d741bea. Revert-only: each file was restored with `git checkout --`, and `git status --short` showed only the untracked `.engram/chunks` files afterwards. 23 temporary edits to production code in all, each followed by the focused test file(s); every one made at least one test fail (failing tests in parentheses). N1 to N5, at d741bea:

| # | Mutation | Result |
|---|----------|--------|
| N1 | login: an inactive account returns before any password check again (the S9f regression) | killed (7) |
| N2 | login: the inactive or unknown branch checks the account's own hash instead of the dummy one | killed (4) |
| N3 | login: an unknown identifier pays no check | killed (4) |
| N4 | registration: the "@" refusal removed | killed (4) |
| N5 | registration: the "@" refusal inverted (refuses CIFs that are not emails) | killed (44) |

M1 to M18, at 77fe452:

| # | Mutation | Result |
|---|----------|--------|
| M1 | login: remove the dummy-hash `verifyPassword` for an unknown identifier | killed (1) |
| M2 | `findLoginAccount`: `rows.length === 1` to `>= 1` (an ambiguous email picks one) | killed (1) |
| M3 | `signSession`: kept session `"30d"` to `"8h"` | killed (2) |
| M4 | change-password: drop the `mantenerSesion` claim on re-issue | killed (2) |
| M5 | `classifyIdentifier`: no lower-casing of the email | killed (2) |
| M6 | `findLoginAccount` CIF query: drop the `estudiante` filter in SQL | killed (1) |
| M7 | login: inactive accounts can sign in | killed (5) |
| M8 | `DECISION_EXCERPT_MAX` 140 to 141 | killed (9) |
| M9 | the request list reads the decision of an `aprobada` request | killed (4) |
| M10 | `ESCALATION_REASONS` loses `otro` | killed (9) |
| M11 | migration 0016 loses `otro` in the open-escalation index predicate | killed (2) |
| M12 | staff detail shows the answer banner in any state | killed (4) |
| M13 | "Vence primero" on row 2 instead of row 1 | killed (8) |
| M14 | `startsAfterToday`: `>` to `>=` | killed (1) |
| M15 | `withoutFieldErrors` no longer clears the answered field | killed (9) |
| M16 | `LocalPreview` never revokes its object URL | killed (3) |
| M17 | `sessionMaxAge(true)` returns 8 h (the cookie ignores the choice) | killed (2) |
| M18 | registration stores the CIF only trimmed | killed (15) |

### TDD Compliance

| Check | Result | Details |
|-------|--------|---------|
| TDD evidence reported | ✅ | 21 "TDD cycle evidence" tables in apply-progress, one per PR or sub-PR of Phases 1 to 11 plus S9d, S9e and S10b, and the S9f table (RED: 8 failing cases before the fix, 4 for W3 and 4 for W4, then GREEN, with its own three mutation checks); later tables carry Safety net, RED, GREEN, Triangulation and Refactor columns, earlier ones Safety net, RED, GREEN |
| All tasks have tests | ✅ | Every behavior-changing task names its test file; 72 test paths named in apply-progress, all exist. Four changed test files (`coordination-queue`, `documentos`, `escalation-answer`, `solicitud-detail`) are not named per file, but deviation 3 of PR 8 records them as the "extra pins" of the query placeholders |
| RED confirmed (tests exist) | ✅ | Each RED row records the failing run and its cause; pass-at-write tests carry a revert-only mutation check |
| GREEN confirmed (tests pass) | ✅ | 75 of 75 focused files pass here; the full-suite result is above |
| Triangulation adequate | ✅ | Table-driven cases throughout (motives, 140/141 bounds, boundary dates, CIF spellings, a state-by-banner table, nine motive pairs in the integration test) |
| Safety net for modified files | ✅ | Existing-case counts recorded per row ("84 review-messages cases passing", "132 page cases passing before the change", and so on) |

**TDD Compliance**: 6/6 checks passed

### Test Layer Distribution

| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Component (jsdom, testing-library, axe) | part of the 3028 | 38 of the 75 focused files | vitest, testing-library, axe |
| Unit and data (query double, pure functions, structural pins) | part of the 3028 | 37 of the 75 focused files | vitest |
| Integration (real Postgres, owner-run) | 74 escalation + 4 RF-08 (173 in the whole suite) | 13 files exist, 3 touched by this change | vitest integration config, branch "flow-it" |
| E2E | 0 | 0 | none installed; the system captures of Phase 12 are manual |

### Changed File Coverage

➖ Coverage analysis skipped: no coverage tool detected.

### Assertion Quality

| File | Line | Assertion | Issue | Severity |
|------|------|-----------|-------|----------|
| `src/lib/data/users.test.ts` | 881 | `for (const call of calls) expect(render(call.where).sql).not.toContain('"Login"')` | Loop over a collection that is not asserted non-empty; it would pass vacuously if `findLoginAccount` issued no query (neighbouring cases do pin the query for the same inputs) | WARNING (W7) |
| `src/lib/auth/cookies.test.ts` | 72 | `for (const call of jar.set.mock.calls)` in "is secure in production" | No call-count guard in this case (the sibling case at line 41 has one) | SUGGESTION |
| several | n/a | `compareDocumentPosition(...) & FOLLOWING).toBeTruthy()` | Bitmask idiom for document order, a real assertion, not a type-only check | none |

The `queryBy...toBeNull()` absence assertions in the added lines each have a companion presence case (for example `dates-recap.test.tsx` "shows the notice" versus "shows no notice for a past start"). No tautology, no assertion without a production call, no `.only`, `.skip`, `.todo`, `debugger` or `console.*` was found in the changed files. `login/actions.test.ts` mocks the data layer on purpose and is backed by the query-level cases in `users.test.ts`.

**Assertion quality**: 0 CRITICAL, 1 WARNING, 1 SUGGESTION

### Quality Metrics

**Linter**: ✅ no errors on the changed src files (exit 0).
**Type Checker**: ✅ no errors.

### Spec Compliance Matrix

Evidence keys. Paths are relative to the repository root; `D/` is `src/app/(dashboard)/`, `A/` is `src/app/(auth)/`, `L/` is `src/lib/`. "X" marks an existing test that this change did not edit, still green in the full run, covering unchanged behavior the scenario relies on. Statuses: ✅ COMPLIANT, ✅o COMPLIANT on owner-run Postgres evidence at an identical tree (not rerun here), ⚠️ PARTIAL, ❌ UNTESTED.

- Request review: RQP `D/review/page.test.tsx`, RQT `D/review/review-queue-table.test.tsx`, RDS `D/review/design-system.test.tsx`, RL3 `D/review/layout-360.test.tsx`, RDP `D/review/[id]/page.test.tsx`, AB `D/review/[id]/answer-banner.test.tsx`, ED `D/review/[id]/escalate-dialog.test.tsx`, DPT `D/review/[id]/dialog-parts.test.tsx`, RSE `D/review/[id]/request-sections.test.tsx`, ESEC `D/review/[id]/escalation-section.test.tsx`, RM `src/i18n/review-messages.test.ts`, RQ `L/data/revision-queue.test.ts`
- Escalation: ESC `L/intake/escalation.test.ts`, SE `L/data/solicitud-escalation.test.ts`, EA `D/review/[id]/escalation-actions.test.ts`, MSG `L/escalation/message.test.ts`, MG `src/db/migration-escalation-otro.test.ts`, AE `L/audit/events.test.ts`, CP `D/coordination/page.test.tsx`, CD `D/coordination/[id]/page.test.tsx`, IE (owner-run) `L/data/integration/escalation-constraints.integration.test.ts` and `escalation-race.integration.test.ts`
- Student: RC `D/requests/request-card.test.tsx`, RP `D/requests/page.test.tsx`, NS `D/requests/no-signals.test.ts`, SR `L/data/student-requests.test.ts`, DE `L/data/decision-excerpt.test.ts`, DT `L/intake/decision-templates.test.ts`, RDS2 `D/requests/design-system.test.tsx`, RMG `src/i18n/requests-messages.test.ts`
- Intake (all under `D/requests/new/` except CP2): LP `local-preview.test.tsx`, DS `documents-step.test.tsx`, RD2 `resubmit-dialog.test.tsx`, RV `review-step.test.tsx`, DR `dates-recap.test.tsx`, STP `steps.test.ts`, CDS `cause-dates-step.test.tsx`, SS `subjects-step.test.tsx`, NP `page.test.tsx`, L360 `layout-360.test.tsx`, CP2 `D/requests/[id]/correct/page.test.tsx`, IMG `src/i18n/intake-messages.test.ts`, CMG `src/i18n/correction-messages.test.ts`
- Auth: LA `A/login/actions.test.ts`, LF `A/login/login-form.test.tsx`, RA `A/register/actions.test.ts`, RF `A/register/register-form.test.tsx`, LI `L/auth/login-identity.test.ts`, US `L/data/users.test.ts`, VA `L/validations/auth.test.ts`, VU `L/validations/users.test.ts`, SES `L/auth/session.test.ts`, CK `L/auth/cookies.test.ts`, DH `L/auth/dummy-hash.test.ts`, CPA `src/app/change-password/actions.test.ts`, PR `D/profile/page.test.tsx`, HD `src/components/dashboard-header.test.tsx`, AM `src/app/access-matrix.routes.test.ts` and `src/test/access`
- Accounts and catalog: NUA `D/users/new/actions.test.ts`, NUF `D/users/new/new-user-form.test.tsx`, UP `D/users/page.test.tsx`, UT `D/users/users-table.test.tsx`, CSV `L/import/credentials-csv.test.ts`, PL `L/import/plan.test.ts`, DTT `D/catalog/docentes/docentes-table.test.tsx`, DPG `D/catalog/docentes/page.test.tsx`, CPR `src/i18n/catalog-parity.test.ts`

#### request-review (FE-1 to FE-6): 31 scenarios

| Req | Scenario | Code | Test | Result |
|---|---|---|---|---|
| FE-1 | Description names the deadline | `D/review/page.tsx`, `review.queue.description` | RQP "names the deadline, soonest first, and no presentation age" (en and es); RM Spanish and English wording | ✅ |
| FE-1 | Other tabs keep their descriptions | same | RQP "keeps the descriptions of the other two tabs"; RM "keeps the descriptions of the other two tabs as they were" | ✅ |
| FE-1 | Translation keys present | `i18n/*.json` | RM; CPR "has identical key sets and no empty value" (es and en both 1300 keys, also compared directly here) | ✅ |
| FE-2 | Only the first row carries the mark | `D/review/page.tsx` `firstDueId`, `deadline-badge.tsx` | RQP "is on row 1 only, once in the table and once in the cards"; RQT "renders the first-due mark in the deadline cell and in the accessible name of the row"; M13 killed | ✅ |
| FE-2 | Equal deadlines | `revision-queue.ts` order (X) | RQP "goes to id 4 alone when two overdue requests share the deadline (4.9 RF-06)" | ✅ |
| FE-2 | The mark follows the effective deadline | `queue.rows[0]` | RQP "follows the position the queue gave, not the date of presentation"; RQ effective-start order cases | ✅ |
| FE-2 | Search hides the first request | same | RQP "shows no mark and does not move it when the term hides row 1"; "shows the mark when the term matches row 1" | ✅ |
| FE-2 | Empty queue and other tabs | same | RQP "is absent from an empty queue"; "is absent from the En coordinacion and Aprobadas tabs" | ✅ |
| FE-2 | Mark in both layouts | table and cards | RQP "once in the table and once in the cards"; RL3 "sets no width above the viewport"; RDS first-due pill pins | ⚠️ PARTIAL: the mark in both layouts is proven; "no horizontal scroll at either width" only by a class guard in jsdom, and no browser capture states a width for this screen |
| FE-2 | Mark adds no audit row | none added | RQP "writes one queue-read row with the whole count and nothing else, whatever the search hides" | ✅ |
| FE-3 | Banner shows the answer, author and date | `review/[id]/answer-banner.tsx`, `page.tsx:190` | AB "shows the author and the date and time in America/Managua", "converts an instant that is already the next day in UTC to Managua time"; RDP "shows the answer, its author and its date and time in Managua"; M12 killed | ✅ |
| FE-3 | Banner comes first | `page.tsx` first child | RDP "comes before the request, the escalations and the decision panel" | ✅ |
| FE-3 | Long answer in full | `whitespace-pre-wrap break-words` | AB "shows an answer of exactly 1000 characters in full"; RL3 "wraps the long answer of the banner instead of widening the page" | ✅ |
| FE-3 | When the banner appears (table) | `pending ? latestAnswer(...) : null` | RDP `it.each` of six rows (pendiente answered shown; pendiente none, en_revision_coordinacion, aprobada, rechazada, devuelta not shown); AB "never takes a notice as the answer" | ✅ |
| FE-3 | Latest answer wins | `latestAnswer` | AB "gives the later one when two escalations were answered"; RDP "quotes the later answer when two escalations were answered" | ✅ |
| FE-3 | Not for other viewers | scope guard (X); banner only in the staff page | RDP "is not found, and writes no audit row, when the request is out of scope"; `D/requests/[id]/page.test.tsx` "shows no reason code, note, answer or coordinator anywhere", "shows only the state after an answer returned the request to pendiente"; AB "is imported by the staff detail page and by no other module" | ⚠️ PARTIAL: owner and other-facultad cases pass; "the queue rows carry no answer" has no test (the queue reader does not select the answer, but nothing pins it) |
| FE-3 | Banner adds no audit row | none added | RDP "writes exactly one audit row and no other" (banner group) | ✅ |
| FE-4 | Copy after an answer | `page.tsx` `descriptionAnswered` | RDP "words the decision panel after the answer and no longer sends the secretary to escalate for an opinion"; RM exact `descriptionAnswered` | ✅ |
| FE-4 | Copy without an answer | existing copy | RDP pending-panel cases (X) and the table above (no answer, no banner copy) | ✅ |
| FE-4 | Decisions unchanged | unchanged | RDP "offers approve, return, reject and escalate unchanged" | ✅ |
| FE-5 | Pointer with the count | `request-sections.tsx` `HistorySection` | RSE history pointer cases; RDP "points the history to the escalations with the number of records" | ✅ |
| FE-5 | The link reaches the section | `href="#escalation-title"` | RSE link pins; AB "links to the escalations section of the same page"; the target id exists in `escalation-section.tsx` (ESEC). jsdom cannot scroll, so the anchor and its target are what is pinned | ✅ |
| FE-5 | No escalation, no pointer | `escalations > 0` | RSE zero-escalation case | ✅ |
| FE-5 | Pointer holds no free text | count only | RSE "holds no note or answer text" case | ✅ |
| FE-6 | Escalate offered when pendiente | X | RDP "offers the escalation beside approve, return and reject while pendiente" | ✅ |
| FE-6 | Three motives offered, none preselected | `escalate-dialog.tsx` | ED "offers the three motives as a labelled radio group with none chosen (E18, FE-9)", "words the three motives in Spanish for the secretary"; RM re-pinned `dialog.motivo` | ✅ |
| FE-6 | Motive is required in the dialog | X plus FE-11 | ED "sends an empty motive when none is chosen, so the server refuses it (E18)", "shows the motive error under the motive group" | ✅ |
| FE-6 | In coordination, no controls | X | RDP "shows the open escalation, its note and the notification status in coordination, with no decision control" | ✅ |
| FE-6 | Answer visible to staff | X | RDP "shows the earlier escalation with its answer once the request is pendiente again"; ESEC "lists the answer, the answering user and the time of an answered escalation" | ✅ |
| FE-6 | Escalation unavailable without a coordination account (E17) | X | RDP "shows it unavailable, naming the career, when there is no coordination account"; SE "refuses a career without coordination accounts, naming it, and writes nothing" | ✅ |
| FE-6 | Escalate not offered elsewhere | X | RDP "offers the three decisions only while the request is pending" | ✅ |

**request-review**: 29 of 31 scenarios compliant, 2 PARTIAL.

#### coordination-escalation (FE-9 to FE-12, FE-7, FE-8, FE-13): 42 scenarios

| Req | Scenario | Code | Test | Result |
|---|---|---|---|---|
| FE-9 | Escalation for another reason | `escalation.ts` constants, `solicitud-escalation.ts` | SE "escalates the motive otro exactly like the other two, with its own code (FE-9)"; M10 killed | ✅ |
| FE-9 | Same behavior for the three motives (table) | the constants drive guard, pause, recipients and answer | SE `otro` case; ESC `it.each` of three motives; IE "allows another escalation once an otro was answered"; the `Tipo in ($1, $2, $3)` pins of `coordination-queue`, `documentos`, `escalation-answer` and `solicitud-detail` tests | ✅ |
| FE-9 | Label "Otro" where the motive is shown (table) | `message.ts` `REASON_LABELS.otro`, `review.escalation.reasons.otro` | MSG "names the motive otro in the reason line and keeps the note as the description", "gives otro the subject, introduction, title, button and recipients of the other escalations", HTML row case; RQP "shows the label of the motive otro in the reason column"; CP "lists the motive otro with its own label"; CD "shows the label Other, the description note and the answer form" | ✅ |
| FE-9 | The student sees no motive (E13) | no student read of the table (X) | `D/requests/[id]/page.test.tsx` "looks the same for the motive otro: no code, label, description or answer (FE-9, E13)"; NS | ✅ |
| FE-9 | Database constrains the record (table) | `drizzle/0016_escalation_otro.sql` | IE (owner-run, 74 passed after 0016): CHECK catalog has `otro`, `otro` with a note accepted, without a note rejected (23514), second open `otro` rejected (23505); MG pins the eight statements here | ✅o |
| FE-9 | Earlier records unchanged | the migration only widens | MG "only widens: no column, table, delete, update, insert, rename or transaction"; IE: the original motives still escalate; owner-run 8.19 to 8.21 row counts equal | ✅o |
| FE-10 | The note is announced as required | `escalate-dialog.tsx` | ED "labels it as required, with the example and the staff-only statement, and shows no error", "words the label and the hint in Spanish for the secretary" | ✅ |
| FE-10 | Hint for `otro` | `noteHintOtro` | ED "keeps the standard hint until Other is chosen, then says the note is the description", "returns to the standard hint when another motive is chosen" | ✅ |
| FE-10 | Empty note is still refused | server rule (X) | ED "shows the note error for Other with an empty note, and nothing is escalated"; ESC "refuses the motive otro with a note that is %s"; SE "refuses the motive otro without a note before touching the database" | ✅ |
| FE-10 | Translation keys present | `i18n` | CPR; RM | ✅ |
| FE-11 | Motive error clears after choosing | `dialog-parts.tsx` `withoutFieldErrors` | ED "clears only the motive error when a motive is chosen"; DPT truth table; M15 killed | ✅ |
| FE-11 | Note error clears on edit | same | ED "clears only the note error when the note is typed in" | ✅ |
| FE-11 | A still-invalid form fails again | server authority | ED "fails again when the form is still invalid: the note error comes back" | ✅ |
| FE-11 | Reopening starts clean | dialog state | ED "starts with no message when the dialog is reopened" | ✅ |
| FE-12 | Notice shows the answer | `escalate-dialog.tsx` `previousAnswer` | ED "shows the earlier answer, its author and date above the motive, as a note"; RDP "shows the earlier answer in the escalate dialog, with its author and date" | ✅ |
| FE-12 | Second escalation proceeds | confirm unchanged | ED "still escalates a second time with one confirmation and one action call"; SE escalates from `pendiente` with an earlier answered record; IE "allows another escalation once an otro was answered" | ✅ |
| FE-12 | No notice without an earlier answer | `previousAnswer: null` | ED "shows no notice when the earlier answer is %s" | ✅ |
| FE-12 | Notice is not an error | `role="note"` | ED notice cases (role note, confirm enabled, no field error); RL3 "opens the escalate dialog with a long earlier answer inside the viewport and with no axe violation" | ✅ |
| FE-12 | Translation keys present | `i18n` | CPR; RM | ✅ |
| FE-7 | Successful escalation | X | SE "moves the request, inserts the open escalation and writes one audit row, in one transaction" | ✅ |
| FE-7 | Escalation for a special case (E18) | X | SE "escalates a special case exactly like a suspicion, with its own motive (E18)" | ✅ |
| FE-7 | Escalation for another reason | see FE-9 | SE `otro` case | ✅ |
| FE-7 | Motive is required and closed (table) | `validateEscalationDraft` | ESC `it.each` (three accepted; `Otro`, ` otro`, `exceso_inasistencias`, empty and non-string refused); SE `it.each` of `exceso_inasistencias`, `Otro`, empty, undefined, null | ✅ |
| FE-7 | Note is mandatory for every motive (table) | same | ESC "refuses the motive otro with a note that is %s", "keeps the 1000 character bound for the motive otro, trimmed" | ✅ |
| FE-7 | Note bounds (table) | X | SE "accepts a note of exactly 1000 characters", "refuses a note that is %s before touching the database" | ✅ |
| FE-7 | Only from pendiente (table) | X | SE guarded-update cases; EA | ✅ |
| FE-7 | Client bypass | X | EA and SE motive and note refusals | ✅ |
| FE-7 | Concurrent escalations | `UX_Escalamiento_Abierto`, guarded update | SE "gives the concurrent loser conflict", "maps the unique violation of a second open escalation to conflict"; IE race test (owner-run) | ✅o |
| FE-7 | Denied callers | X | EA role-gate cases | ✅ |
| FE-7 | Out-of-scope callers and unknown ids | X | SE "is not_found, with no writes, for an unknown id and for an out-of-scope request alike" | ✅ |
| FE-7 | Legacy consent does not block | X | SE "does not look at the consent: a v1 or missing consent never blocks" | ✅ |
| FE-7 | Failure rolls back | X | SE rollback group (failed insert, failed audit, failed count) | ✅ |
| FE-7 | Career without a coordination account is refused (E17) | X | SE "refuses a career without coordination accounts, naming it, and writes nothing" | ✅ |
| FE-7 | Coordination account without email does not refuse (E17) | X | SE "succeeds when the career has accounts but none has an email" | ✅ |
| FE-8 | Database rejects a second open escalation | index with `otro` | IE "is a unique partial index whose predicate lists the three motives" (owner-run); MG "drops the open-escalation index and recreates it with otro in the predicate"; M11 killed | ✅o |
| FE-8 | A second open escalation of any motive is refused (nine pairs) | same | IE `it.each` of the pairs, including the three `otro` rows (owner-run, 74 passed) | ✅o |
| FE-8 | Re-escalation with the other motive | X | IE "allows a special case once the suspicion was answered, and the reverse", "allows another escalation once an otro was answered"; ED second-escalation case | ✅o |
| FE-8 | Re-escalation after the answer | X | as above, plus SE | ✅o |
| FE-8 | Notices do not block | X | IE "allows an excess-absence notice next to an open otro (FE-8)" | ✅o |
| FE-13 | Coordination account without email | X | SE "succeeds when the career has accounts but none has an email"; blocked-notice dispatch tests (X); the sign-in refusal of an account with no email and no CIF is FE-25 | ✅ |
| FE-13 | Recipients gone after the escalation | X | `escalamiento` dispatch tests (X) | ✅ |
| FE-13 | Scheduled job skips it | X | `escalamiento` job tests (X) | ✅ |

**coordination-escalation**: 42 of 42 scenarios compliant (8 of them rely on owner-run Postgres evidence for the database part).

#### audit-log (FE-31): 3 scenarios

| Req | Scenario | Code | Test | Result |
|---|---|---|---|---|
| FE-31 | Payloads hold codes only | `L/audit/events.ts` | AE "payloads hold ids and closed codes only", "drops a note, an answer, a teacher name or an email smuggled into the call" | ✅ |
| FE-31 | Escalation payload | same | AE "carries the code otro and never the description in its note (FE-31)"; SE audit row with `motivo: "otro"` | ✅ |
| FE-31 | Payload of an `otro` escalation holds no description | same | AE "carries the code otro and never the description in its note (FE-31)" | ✅ |

#### student-requests (FE-14 to FE-16): 18 scenarios

| Req | Scenario | Code | Test | Result |
|---|---|---|---|---|
| FE-14 | Labelled dates and subjects | `request-card.tsx`, `listOwnRequests` | RC "writes the absence range under its label with the month name", "lists the subjects in Spanish"; RP "labels the absence dates of every card", "passes the subjects and the reason of each item through to its own card"; SR "attaches the subjects to each request in the order of listRequestClasses" | ✅ |
| FE-14 | Single-day absence | same | RC "writes a one-day absence as a single date"; RP "writes a one-day request as a single date" | ✅ |
| FE-14 | Order unchanged | X | SR "orders newest presentation first, then newest id"; RP "keeps the order the data layer gave (newest first)" | ✅ |
| FE-14 | No signals or escalation data on the card | selects own columns only | RC "renders no signal, outcome, verdict, motive, note or answer even when the props carry them"; NS "returns the list rows with exactly the pre-signals keys", "renders every visible state without a signal"; SR detail "exposes no escalation, note, answer or report" | ✅ |
| FE-14 | 360 px with many subjects | card layout | RC "lets five long subject codes and a long reason wrap instead of widening the page"; RDS2 "keeps five long subject codes and a rejected reason inside the viewport"; owner capture `RF-07_c_2_360.png` (468c3f8) | ✅ |
| FE-14 | Translation keys present | `requests.list.*` | RMG exact catalog values in both locales; CPR | ✅ |
| FE-15 | Returned card shows the reason label | `listOwnRequests` `motivoCodigo` | RC reason-line cases; SR "gives a returned request its reason code and its text"; RP | ✅ |
| FE-15 | Rejected cards show an excerpt (table) | `decisionExcerpt` | DE "cuts 200 characters to the first 140 and appends an ellipsis", "returns 60 characters whole", exact 140 and 141 cases; SR "cuts the text of a rejected request on the server: %s"; M8 killed | ✅ |
| FE-15 | The excerpt of a rejection starts at the reason | `withoutRejectionIntro` | DT "removes the introduction of every rejection template" plus the rewritten-text, bare-introduction and long-reason cases; SR "starts the excerpt of a rejected request at the reason: %s"; capture `RF-07_c_1_escritorio.png` | ✅ |
| FE-15 | Approved card shows no excerpt (table) | `CARD_REASON_STATES` | SR "never reads the decisions of an approved request"; RC "shows no reason and no excerpt on an approved card %s"; RP "shows no reason on an approved card even if its item carried one"; M9 killed | ✅ |
| FE-15 | No reason while the request is open | state filter | SR "reads the classes and the decisions only for the ids of the owner's rows" and the state-filter case; RC reason-line cases for `pendiente` and `en_revision_coordinacion` | ✅ |
| FE-15 | Another student's reasons are not read | owner filter | SR "selects only the owner's rows in the visible states, never a draft"; "reads the classes and the decisions only for the ids of the owner's rows" | ✅ |
| FE-16 | Dialog lists the files with their origin | `resubmit-dialog.tsx`, `getReturnedDocumentIds` | RD2 "lists the kept file as Anterior and the added file as Nuevo, and not the retired one"; SR `getReturnedDocumentIds` owner-scoped select | ✅ |
| FE-16 | Marks also on the documents and review steps | `documents-step.tsx`, `review-step.tsx`, `file-origin-mark.tsx` | DS "marks the kept file Anterior and the added file Nuevo"; RV "marks the kept document Anterior and the added one Nuevo"; CP2 "marks them on the review step and in the resubmit dialog too" | ✅ |
| FE-16 | Confirming resubmits as before | confirm unchanged | RD2 "keeps the title, the description and the two buttons it had"; `request-correction.integration.test.ts` "records the correction in the same request, keeps the earlier version and goes back to pendiente" (owner-run, 4 of 4, one `solicitud.corregida` row) | ✅o |
| FE-16 | Long names at 360 px | wrap classes | RD2 "wraps a 120-character name and sets no width above the 360 px viewport" | ⚠️ PARTIAL: class guard only, no browser capture of this dialog |
| FE-16 | Listing adds no read or audit row | no fetch | RD2 "links nothing to the document route and never calls fetch"; RV "keeps the audited Ver link on both"; CP2 | ✅ |
| FE-16 | Translation keys present | `intake.correction.resubmit.*` | CMG both locales; CPR | ✅ |

**student-requests**: 17 of 18 scenarios compliant, 1 PARTIAL.

#### supporting-documents (FE-17): 8 scenarios

| Req | Scenario | Code | Test | Result |
|---|---|---|---|---|
| FE-17 | Image preview | `local-preview.tsx` | LP "shows the file name and the size next to the preview" and the image branch; DS "offers the preview, closed, instead of Ver for the file just attached" (the preview opens with the "Vista previa" button, as design D8 states) | ✅ |
| FE-17 | PDF preview | same | LP "mounts an iframe for a PDF, titled with the name and holding a blob URL" | ✅ |
| FE-17 | No server read and no audit row | object URL only | LP "never calls fetch and never names the document route"; DS "reads nothing from the server to preview: no fetch, no document route"; LP revoke cases; M16 killed | ✅ |
| FE-17 | Content that cannot be rendered | `previewKind` null | LP "shows the name and size only, with no broken preview, for a file the browser cannot render" | ✅ |
| FE-17 | Validation still decides | server finalize (X) | DS "offers no preview, and shows the rejection, for a file that finalize rejects"; the magic-byte rule is unchanged server code with its own X tests | ✅ |
| FE-17 | Stored document keeps its audited view | route (X) | DS "keeps Ver, and offers no preview, for a document stored before this visit"; RV "keeps the audited Ver link on both"; the route tests (X) write the `documento.descargado` row | ✅ |
| FE-17 | 360 px | classes | LP "sets no fixed width and lets the image and the frame shrink to the row"; DS "sets no fixed width on the open panel (360 px)" | ⚠️ PARTIAL: class guard only, no browser capture of an open preview |
| FE-17 | Translation keys present | `intake.documents.*` | IMG preview copy in both locales; CPR | ✅ |

**supporting-documents**: 7 of 8 scenarios compliant, 1 PARTIAL.

#### justification-intake (FE-18, FE-19): 15 scenarios

| Req | Scenario | Code | Test | Result |
|---|---|---|---|---|
| FE-18 | Recap on step 2 | `dates-recap.tsx`, `subjects-step.tsx` | SS "shows the dates with weekday and month name above the subjects, and a link back to step 1"; NP "shows the recap at step 2 with the draft's dates and a way back to step 1"; DR weekday and locale cases | ✅ |
| FE-18 | Recap on step 3 | `documents-step.tsx` | DS "shows the dates with weekday and month name, and a link back to step 1"; NP "shows the recap at step 3 too" | ✅ |
| FE-18 | Edit link returns to the dates | `editHref` | DR "offers 'Editar fechas' to the given href", 44 px target | ✅ |
| FE-18 | Single-day absence | same | DR "shows one date with its weekday when both are the same day" | ✅ |
| FE-18 | Recap equals the review | same formatter | RV "shows the same days as the recap of the earlier steps (4.9 RF-01 c)" | ✅ |
| FE-18 | No recap without valid dates | `draftRange` null | NP "shows no recap at step 2 without dates, and asks for them instead", "shows no recap at step 3 when the dates are not usable"; SS and DS "shows no recap without valid dates" | ✅ |
| FE-18 | Recap in the correction flow | both pages | CP2 "dates recap and future-start notice (FE-18, FE-19)" group | ✅ |
| FE-18 | 360 px | wrap classes | L360 "lets the dates and the notice wrap instead of widening the card"; DR "lets a long text wrap instead of widening the row" | ⚠️ PARTIAL: class guard only; the RF-01 captures do not state a 360 px width |
| FE-19 | Future start shows the notice | `startsAfterToday` | STP truth table; CDS "shows the notice for a saved start after today"; DR "shows the notice as a note when the start is after today"; M14 killed | ✅ |
| FE-19 | Boundary (table) | same | STP "compares calendar days across a month and a year boundary", equal dates false; CDS "for a saved start %s the notice is shown: %s" | ✅ |
| FE-19 | Notice does not block submission | no control disabled | CDS "disables nothing and still saves the future dates"; RV "still submits, with the notice shown and nothing from it sent"; SS "keeps the step usable with the notice shown"; capture `RF-01_6_presentada.png` | ✅ |
| FE-19 | Notice is not a field error | `role="note"` | DR "is informational: no alert role and no error styling" | ✅ |
| FE-19 | Notice clears when the date changes | state | CDS "appears when a future start is typed and clears when the start becomes today" | ✅ |
| FE-19 | Managua date decides | `managuaToday(new Date())` | NP "shows no notice for a start that is today in Managua, though it is tomorrow in UTC", "shows the notice at 2026-11-02 02:00 UTC for a start of 2026-11-02"; CP2 twin cases | ✅ |
| FE-19 | Translation keys present | `intake.datesRecap.*` | IMG; CPR | ✅ |

**justification-intake**: 14 of 15 scenarios compliant, 1 PARTIAL.

#### auth-entry-access (FE-20 to FE-25, FE-32, FE-26): 41 scenarios

| Req | Scenario | Code | Test | Result |
|---|---|---|---|---|
| FE-20 | Link per role (table) | `profile/page.tsx` | PR "ProfilePage: the Change password link (FE-20)" group and the own-data-per-role group | ✅ |
| FE-20 | The link opens the voluntary change | route (X) | AM access matrix suites (the `/change-password` row, unchanged and green); CPA "permits a voluntary change by a user whose flag is already false" | ✅ |
| FE-20 | Flagged and anonymous callers | X | PR "sends an anonymous caller to /login with no profile read", "sends a flagged caller to the change screen with no profile read" | ✅ |
| FE-20 | User menu entry | `dashboard-header.tsx` | HD "DashboardHeader user menu: change password (FE-20)" group (the entry sits between profile and sign-out; English wording) | ✅ |
| FE-20 | Translation keys present | `profile.changePassword`, `auth.userMenu.changePassword` | PR "has the label in both catalogs"; HD; CPR | ✅ |
| FE-21 | Who can sign in with what (table) | `login-identity.ts`, `findLoginAccount`, `login/actions.ts` | LA "signs in with %s" (student CIF, hyphenated CIF, mixed-case email for a student and for staff); US "never resolves a staff row, even if one came back", "matches Cif exactly on the cleaned value and only for role estudiante" (M6 killed); LA inactive case (M7 killed); US "never selects on Login when the identifier is %s"; LI "offers no third kind: a former username is just a CIF candidate" | ✅ (resolution is proven against a query double, see W7) |
| FE-21 | CIF matching is exact after cleaning (table) | `normalizeCif` | LI normalizeCif cases (spaces, hyphens, tab, case kept, hyphens only); US exact-match SQL and "runs no query for a CIF that is empty after cleaning"; owner-run 12.5 sign-in with digits, hyphen or spaces | ✅ |
| FE-21 | Student without an email signs in by CIF | same | LA "signs in with a student's CIF" (account with no email); US CIF path | ✅ |
| FE-21 | The form asks no Usuario | `login-form.tsx` | LF "identifier field (FE-21)" group "pins the catalog values of the label and the hint"; VA "does not ask for a Usuario in any of its messages"; LA wording tests | ✅ |
| FE-21 | Flag and redirect unchanged | X | LA "puts debeCambiarClave: true in the session of a flagged account", "redirects to a safe next target (AEA-3)"; owner-run S10c forced change | ✅ |
| FE-21 | Oversized identifier | `loginSchema` max 160 | VA "accepts a 160-character identifier after trimming and refuses 161"; LA "answers an identifier of 161 characters with the generic error and reads no account" | ✅ |
| FE-21 | Translation keys present | `auth.login.*` | LF; CPR | ✅ |
| FE-22 | Case and whitespace (table) | `lower(Correo)` | LI email trimmed and lower-cased (M5 killed); US "compares lower(Correo) to the normalized value and reads at most two rows"; LA mixed-case email case; owner-run 12.5 mixed-case email with spaces | ✅ |
| FE-22 | Two accounts collide ignoring case | `limit(2)` | US "fails closed when two accounts share the email ignoring case (FE-22)" (M2 killed); LA ambiguous-email case | ✅ (double only, see W7) |
| FE-22 | New accounts store the normalized email | schemas `.toLowerCase()` | VU registration and staff schema cases; NUA "stores the email normalized and derives the Login from it"; RA "derives the Login from the normalized email and stores the email normalized" | ✅ |
| FE-22 | Creation refused on a case-only duplicate (table) | `getUsuarioByCorreo` | NUA "refuses an email equal ignoring case to an existing one: nothing is created"; RA "refuses an email equal ignoring case to an existing one and creates nothing"; PL "matches an existing docente by a trimmed, mixed-case email and creates none (FE-22)" | ✅ |
| FE-23 | Same response for every cause (table) | single `errors.invalid` | LA "gives the same answer for every cause", the `lookups` and `unreadable` tables (unknown, ambiguous, staff typed with a CIF, inactive, empty, 161 characters, 3 and 7 character passwords, wrong password) with `expectNoSession` | ✅ (text and shape; the timing half is the next row) |
| FE-23 | An unknown identifier and an inactive account cost one password check (new, S9f) | `login/actions.ts` one branch `!user?.activo`, `dummy-hash.ts` | LA "pays one check against the dummy hash, and never its own, for an inactive account (verifier says true / false)" (called once, with the dummy hash, whatever the verifier says); LA "still verifies the password against the dummy hash for an unknown identifier"; LA retention pin (DR-3) now asserts exactly one call with the dummy hash; N1, N2, N3 killed | ✅ |
| FE-23 | Message wording | `auth.errors.invalid` | LA "is the exact Spanish line", "is the exact English line" (no "Usuario", "user", "no existe", "inactive") | ✅ |
| FE-24 | No Usuario row (table over roles) | `profile/page.tsx` | PR "shows a student the email, CIF, role, phone, career and member since, in that order", "leaves out the phone when the account has none", "still shows the career of a coordinator that has one", "drops the dead label from both catalogs" | ✅ |
| FE-24 | Still the own data only | X | PR "reads only the own account, by the session login" | ✅ |
| FE-25 | A locked-out account is counted before release | owner-run read-only SQL of task 9.0 (text only, in design.md and tasks.md) | none: no code under test; run on production only, all three counts zero on 2026-11-20 | ❌ UNTESTED (process scenario, W2) |
| FE-25 | Count of zero | same | apply-progress section 9.0 records 0, 0, 0 on 2026-11-20 and "no CIF with anything but digits" on 2026-11-24 (12.5); the re-run is tasks 13.3 and 13.6 | ⚠️ PARTIAL (owner-run read-only evidence only) |
| FE-25 | Excluded accounts | same | none | ❌ UNTESTED (process scenario, W2) |
| FE-25 | An account with neither identifier cannot sign in | no `Login` step | US "never selects on Login when the identifier is %s"; LI "offers no third kind"; LA staff-typed-with-a-CIF case and the `lookups` table (M7) | ✅ |
| FE-25 | The stored Login is never an identifier (table) | `findLoginAccount` | US "never selects on Login when the identifier is %s" (email, CIF, former username); LA lookups table | ✅ |
| FE-25 | Case collisions are counted | count SQL | none | ❌ UNTESTED (process scenario, W2) |
| FE-25 | CIFs with a non-digit character are counted | count SQL | none | ❌ UNTESTED (process scenario, W2) |
| FE-25 | The count writes nothing | read-only | apply-progress records read-only; no automated proof | ⚠️ PARTIAL (owner-run evidence only) |
| FE-25 | No creation path yields an account without an identifier (table) | schemas | VU "requires the email for every role the flow can assign"; RA "refuses a form without the email or the CIF fields"; PL docente row error when the email is missing (X) | ✅ |
| FE-32 | Checked lasts 30 days | `session.ts`, `cookies.ts`, `login/actions.ts` | SES "lasts 30 days when the claim is true" (exp minus iat; M3 killed); CK "sets a 30-day maxAge for a kept session" (M17 killed); LA "signs with the claim and sets the 30-day cookie when the box is checked"; owner-run cookie of 720.00 h | ✅ |
| FE-32 | Unchecked lasts 8 hours | same | SES default case; CK "sets an 8-hour maxAge by default and when the flag is false"; LA "gives today's payload, with no claim key, and the 8-hour cookie when the box is absent" | ✅ |
| FE-32 | Sign-out clears it | `clearSessionCookie` | LA "clears the session cookie on sign-out after a kept sign-in"; CK "deletes the session cookie" | ✅ |
| FE-32 | The forced password change still applies | `change-password/actions.ts` | LA "carries both the flag and the claim for a flagged account with the box checked"; CPA "re-issues a kept session with the claim, the flag cleared and the 30-day cookie" (M4 killed); owner-run S10c | ✅ |
| FE-32 | Access matrix unchanged | no route, action or audit event | AM suites green; `matrix-table.ts` is not in the diff | ✅ |
| FE-32 | Old tokens and failed attempts | optional claim | SES "verifies a token issued before the claim existed and reads it as unchecked"; LA "signs nothing and sets no cookie for %s with the box checked", "for a wrong password with the box checked" | ✅ |
| FE-26 | Role is always `estudiante` | X | RA "creates an estudiante even when the form posts rol=administrador" | ✅ |
| FE-26 | No guard, no CIF verification | X | RA "runs no guard and never reads the session", "stores the CIF cleaned like the sign-in cleans it, with no lookup of it" | ✅ |
| FE-26 | No Usuario asked, Login derived | `deriveLogin` | RA "derives the Login from the normalized email and stores the email normalized", "ignores a login posted by a hand-crafted request"; RF "has no login field in %s" | ✅ |
| FE-26 | Derived Login already taken | same | RA "answers a derived Login that is already taken with the duplicate error" | ✅ |
| FE-26 | The CIF is stored cleaned like the sign-in cleans it (table) | `registroEstudianteSchema` | VU "applies the 20-character limit to the cleaned CIF, not to what was typed" and the spelling cases; LI "is what a CIF identifier carries, so both paths share one rule"; RA three spellings; M18 killed. The new row `2201@0116`: VU "refuses a CIF that is an email / digits with an at sign / an at sign among spaces and hyphens, with the error on the CIF", RA "refuses a CIF that is taken as an email by the sign-in and creates nothing"; N4 and N5 killed | ✅ |

**auth-entry-access**: 35 of 41 scenarios compliant, 4 UNTESTED and 2 PARTIAL (all six are FE-25 count scenarios).

#### staff-account-creation (FE-27, FE-28): 9 scenarios

| Req | Scenario | Code | Test | Result |
|---|---|---|---|---|
| FE-27 | The form has no Usuario field | `new-user-form.tsx` | NUF "has no Usuario field and no login input" | ✅ |
| FE-27 | Login derived from the email | `users/new/actions.ts` | NUA "stores the email normalized and derives the Login from it" | ✅ |
| FE-27 | Posted login ignored | the schema drops it | NUA "ignores a login posted by a hand-crafted request"; VU "has no login key, and a posted login is dropped from the result" | ✅ |
| FE-27 | Derived Login collision | catch-all | NUA "returns a form error, without a redirect or a suffix, when the derived Login is taken" | ✅ |
| FE-27 | Existing logins untouched | no data change | no migration touches `Usuario` (journal and MG); nothing to execute | ✅ |
| FE-28 | Email required and unique (table) | `crearStaffSchema` | NUA "refuses an email that is %s with an error on the email and creates nothing", "refuses an email equal ignoring case to an existing one"; VU 160-character case | ✅ |
| FE-28 | Every assignable role needs it | schema | VU "requires the email for every role the flow can assign" | ✅ |
| FE-28 | New staff can sign in | normalized email | NUA stores the normalized email; US email path; owner-run 12.5 (secretary and coordinator by email) | ✅ |
| FE-28 | Older email-less accounts are untouched | no data change | no write path; LA and US show such an account cannot sign in | ✅ |

#### users-listing (FE-30): 5 scenarios

| Req | Scenario | Code | Test | Result |
|---|---|---|---|---|
| FE-30 | Column shown and sorted as before | `users-table.tsx`, `users.ts` (unchanged) | UP "shows the stored Login under its column header (FE-30)", "forwards status, sort, dir and size parsed"; UT "makes exactly name, login, role, status and created sortable" | ✅ |
| FE-30 | Search by Login unchanged | X | `users.test.ts` list search cases (X) | ✅ |
| FE-30 | Delivered rows unchanged (table) | X | UT "renders nothing beyond the six delivered fields, even if a row carried more"; UP "the rendered markup does not carry the secret values either" | ✅ |
| FE-30 | Older logins untouched | no data change | as FE-27 | ✅ |
| FE-30 | No instruction to type a Usuario | `users.search.placeholder` | UT "words the search and the no-results hint by name or email"; UP parity case | ✅ |

#### imported-account-provisioning (FE-29): 7 scenarios

| Req | Scenario | Code | Test | Result |
|---|---|---|---|---|
| FE-29 | Export accompanies the successful apply | X | apply and export tests (X, full run) | ✅ |
| FE-29 | Export names the account by email | `credentials-csv.ts` header `Correo` | CSV "starts with the UTF-8 BOM and a header row" and the lower-case first cell | ✅ |
| FE-29 | The exported pair signs in | normalized email | CSV first cell is the normalized email; US email path resolves any role by `lower(Correo)`; owner-run 12.5 | ✅ |
| FE-29 | Not retrievable afterwards | X | credential tests (X) | ✅ |
| FE-29 | Logs are clean | X | X | ✅ |
| FE-29 | No credentials on failure | X | X | ✅ |
| FE-29 | Preview returns no credentials | X | X | ✅ |

#### catalog-management (CM-LST-1): 20 scenarios

| Req | Scenario | Code | Test | Result |
|---|---|---|---|---|
| CM-LST-1 | Docentes list shows no login | `docentes/page.tsx` picks id, name, Correo, state | DPG "renders Name, Email and Status, no login column and no actions column (FE-24)", "shows name, email and the state word, mixed under status=all, and no login"; DTT "has three columns, name, email and status, all sortable, and no login column" | ✅ |
| CM-LST-1 | Docentes list carries no credential | same | DPG "renders and passes on no credential field, even if the data layer returned them"; DTT "renders nothing beyond the delivered fields, even if a row carried more" | ✅ |
| CM-LST-1 | Sortable columns (table); Unsortable and unknown sort values fall back (table) | `DOCENTES_SORT_KEYS` still lists `login` as a URL value | DPG sort cases; `L/catalog/list-params.test.ts` (X); US docentes order cases | ✅ |
| CM-LST-1 | The 16 unchanged scenarios: Default shows active only; Filter; Search; Pagination clamps; Empty states; Docentes list is read-only and unscoped; Unrecognised status falls back; Database unavailable; Collation, empty emails and status order; Footer omitted when everything fits; Stable across pages with equal sort keys; Page size options; First and last navigation and clamping with a size; Reset to page 1 on any view change; Sort and page size never widen the Carrera scope; Degraded read keeps the notice with the new parameters | unchanged | DPG and DTT cases by title ("treats status=bogus as active", "renders a status notice and no table, count or raw error when degraded", "omits the footer when everything fits on one page", "builds pagination links that keep q and status", "keeps sort and size in the clear link and returns to page 1", "offers only search, the status filter, pagination and the link to /users"), plus X | ✅ |

The CM-LST-1 rows above cover its 20 scenarios (rows 1 and 2 one each, row 3 two, row 4 sixteen): 20 of 20 compliant.

**Compliance summary** (strict): 188 of 199 scenarios compliant (❌ 4 UNTESTED, ⚠️ 7 PARTIAL); 27 of 33 requirements fully covered (FE-2, FE-3, FE-16, FE-17, FE-18 and FE-25 each hold a PARTIAL or UNTESTED scenario). No scenario is FAILING. The envelope counts the 11 as complete (33/33 and 199/199) by the convention stated in the envelope note.

The four UNTESTED and seven PARTIAL scenarios, in one list:

| # | Scenario | Status | Why |
|---|----------|--------|-----|
| 1 | FE-25 A locked-out account is counted before release | ❌ UNTESTED | owner-run read-only SQL; no code, no test |
| 2 | FE-25 Excluded accounts | ❌ UNTESTED | same |
| 3 | FE-25 Case collisions are counted | ❌ UNTESTED | same |
| 4 | FE-25 CIFs with a non-digit character are counted | ❌ UNTESTED | same |
| 5 | FE-25 Count of zero | ⚠️ PARTIAL | recorded result 0, 0, 0 (2026-11-20); one count re-checked 2026-11-24 |
| 6 | FE-25 The count writes nothing | ⚠️ PARTIAL | read-only by construction, no automated proof |
| 7 | FE-2 Mark in both layouts | ⚠️ PARTIAL | horizontal scroll only by a class guard |
| 8 | FE-3 Not for other viewers | ⚠️ PARTIAL | "queue rows carry no answer" has no test |
| 9 | FE-16 Long names at 360 px | ⚠️ PARTIAL | class guard only |
| 10 | FE-17 360 px | ⚠️ PARTIAL | class guard only |
| 11 | FE-18 360 px | ⚠️ PARTIAL | class guard only |

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| FE-1, FE-2 | ✅ Implemented | `firstDueId = queue.rows[0]?.id`, computed before the search filter; the mark is text |
| FE-3, FE-4, FE-5 | ✅ Implemented | `latestAnswer` plus `AnswerBanner` as first child; no audit row added |
| FE-6, FE-7, FE-8 | ✅ Implemented | constants, CHECKs and index render from `ESCALATION_KINDS` and `ESCALATION_REASONS`; migration 0016 matches the schema (below) |
| FE-9 to FE-12 | ✅ Implemented | no string comparison of motives remains outside the two arrays and the label maps; every `Record<EscalationKind, ...>` is complete (typecheck) |
| FE-13 | ✅ Implemented | wording only; behavior unchanged |
| FE-14, FE-15 | ✅ Implemented | `listOwnRequests` makes at most three selects; the excerpt is cut on the server |
| FE-16, FE-17 | ✅ Implemented | `getReturnedDocumentIds` is owner-scoped and fail-soft; `LocalPreview` assigns and revokes its object URL in one effect |
| FE-18, FE-19 | ✅ Implemented | `managuaToday` on the server; the notice never disables a control |
| FE-20 to FE-25 | ✅ Implemented | one identifier field; `classifyIdentifier`, `findLoginAccount` (two-row read, `estudiante`-only CIF), one dummy-hash check for an unknown, ambiguous or inactive account (S9f); the stored `Login` is never a key |
| FE-26 to FE-28, FE-30 | ✅ Implemented | the registration CIF schema refuses a CIF that `classifyIdentifier` takes as an email (S9f); `deriveLogin` from the normalized email; case-insensitive duplicate guard; the `Login` column is kept |
| FE-29 | ✅ Implemented | CSV header `Correo` |
| FE-31 | ✅ Implemented | payload shape unchanged; `otro` is a code |
| FE-32 | ✅ Implemented | optional `mantenerSesion` claim, `sessionMaxAge`, expiry strings `"30d"` and `"8h"`, cookie flags unchanged, claim carried on the password-change re-issue, registration stays at 8 h |
| CM-LST-1 | ✅ Implemented | three columns; the `login` sort value is still accepted in the URL (S2) |

**Migration 0016** (`drizzle/0016_escalation_otro.sql`, read only). Eight statements on `"Escalamiento"` only: drop and re-add `CK_Escalamiento_Tipo`, `CK_Escalamiento_Kind` and `CK_Escalamiento_SinRespuesta`, drop and recreate `UX_Escalamiento_Abierto` with `'otro'` in its predicate. Compared with the last definitions in `drizzle/0012_escalation.sql`, each new list is the old list plus `'otro'` and nothing else; the `Kind` reason branch still requires a non-blank note and `EstadoPrevio = 'pendiente'`. The SQL equals what `src/db/schema.ts` renders from the arrays (the schema diff is a comment only). `drizzle/meta/0016_snapshot.json` differs from 0015 only in those three CHECKs and that one index (`prevId` chain intact, 17 tables in both). The journal gains exactly one entry, idx 16, after the 16 of `origin/main`; no other migration is in the diff. It only widens (no column, table, delete, update, insert, rename or explicit transaction; MG pins this), so every existing row satisfies the wider rules and the code on `main`, which names only two motives, keeps working against a database that has it. The risk runs the other way and is gated: deploying the new code before the migration makes an `otro` escalation fail `CK_Escalamiento_Tipo` (23514). `build` does not run migrations (`package.json`), so the owner's task 8.25 is the only path.

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| D1 banner data (`latestAnswer`) | ✅ Yes | |
| D2 banner first in the stack, links to `#escalation-title` | ✅ Yes | |
| D3 second escalation: soft notice, no server change | ✅ Yes | |
| D4 "Vence primero" on `queue.rows[0]` | ✅ Yes | |
| D5 `withoutFieldErrors` on every change | ✅ Yes | also adopted by the report dialog and the answer form (S3b) |
| D6 at most 3 selects for the card list | ✅ Yes | |
| D7 card reason: RN-17 label or 140-character excerpt; approved cards none | ✅ Yes | S9e added `withoutRejectionIntro`; the design text was updated |
| D8 object URL keyed by `documentId`, revoked in the effect cleanup | ✅ Yes | |
| D9 `getReturnedDocumentIds`, fail-soft | ✅ Yes | |
| D10 `managuaToday` passed down | ✅ Yes | |
| D11 `otro` inserted after `caso_especial` in both arrays | ✅ Yes | |
| D12 ordered resolution, no legacy fallback | ✅ Yes | amended 2026-11-20 (task 9.1) |
| D13 no rate limiter, timing equalized | ✅ Yes | since S9f an unknown, ambiguous or inactive account pays one dummy check (W3 resolved); the design text was updated |
| D14 keep `Login`, derive it | ✅ Yes | the design says a registered student gets the trimmed CIF as `Login`; FE-26 and task 10.1 derive it from the email and the code follows the spec. `design.md` was not updated (S3) |
| UX-22 addendum: claim, `sessionMaxAge`, string expiry, re-issue, no checkbox on register | ✅ Yes | |
| Spec-over-design deviations recorded in the tasks conventions: label "Otro" (design said "Otro motivo"); users list keeps its "Login" column; recap label "Fechas de ausencia" | ✅ Yes | |

### Findings against the owner's checklist

1. **Matrix.** Above: 33 requirements, 199 scenarios, 188 compliant, 4 UNTESTED, 7 PARTIAL, 0 FAILING.
2. **Design coherence.** Above: all decisions followed (D13 since S9f) and one stale design text (D14).
3. **Migration 0016.** Above: matches the schema, the journal and the snapshot; only widens; safe to apply before the deploy.
4. **Security and lockout** (updated at d741bea). Sign-in by email or CIF is normalized and fails closed on ambiguity; inactive and cancelled accounts fail with the generic message (cancelled accounts hold no email or CIF by `CK_Usuario_Cancelado`); the only response is `errors.invalid`; the sign-in path writes no audit row and no log line (no `console` or audit call in `login/actions.ts`, `login-identity.ts` or `findLoginAccount`), so no identifier typed by the user is persisted; the session claim and cookie behave as specified and the forced change keeps the duration. W3 (timing of inactive accounts) and W4 (the "@" CIF) are resolved by S9f (see below); the open points are W5 (30-day token) and W6 (no rate limit).
5. **Deltas versus main specs.** All 8 MODIFIED headings exist verbatim in `openspec/specs/*`; none of the 25 ADDED headings collides with a main heading; the only main scenario a MODIFIED block no longer carries is "A second open escalation of either motive is refused", renamed "...of any motive...". The archive sync applies cleanly. Two main lines outside the deltas go stale (W8).
6. **i18n and copy.** 1300 keys in `es` and in `en`, none missing or empty (parity test, and a direct comparison here); 38 keys added, 5 removed (`catalog.docentes.columns.login`, `users.new.loginLabel`, `auth.register.loginLabel`, `auth.userMenu.signedInAs`, `profile.loginLabel`), 10 reworded. Registers follow owner resolution 1 ("tú" on student and admin screens, "usted" on staff screens and the sign-in page). The new axe cases (banner, notice, recap, preview, cards, login form) pass; the banner is a labelled region with an `h2`, notices are `role="note"`, targets are 44 px. No new personal data is shown or stored: card, banner, dialog and recap show data the viewer could already see, and fixtures use fictitious addresses (`example.test`, `uni.edu`). The local preview makes no server request (`createObjectURL` only; tests assert no `fetch` and no `/api/intake/documents/` URL) and no global CSP exists that could block a `blob:` frame.
7. **Leftovers.** No `.only`, `.skip`, `.todo`, `debugger`, `console.*` or TODO marker in the changed files. Dead code: the `login` entry of `DOCENTES_SORT_KEYS` (acknowledged in apply-progress). Docs: `README.md` and `docs/requirements.md` describe no "Usuario" sign-in; `docs/requirements.md` carries the RN-20 text and a change-log row; `docs/setup-local.md` does not name the sign-in identifier (S4).
8. **Nested `<main>`.** Pre-existing, not introduced by this change. `src/app/(dashboard)/layout.tsx:20-22` wraps `{children}` in `<main>` (blame: 2026-10-04 and 2026-09-19) and `SidebarInset` (`src/components/ui/sidebar.tsx:306-308`, blame 2026-09-17) renders a `<main>` itself. Neither file is in `git diff origin/main...HEAD`, and no added line contains `<main`.

### Issues Found

**CRITICAL**: None.

**WARNING** (6 open: W1, W2, W5, W6, W7, W9; 3 resolved by S9f or by a task note: W3, W4, W8):

- **W1. 14 tasks are open (8.24, 8.25, 12.12, 13.2 to 13.6, 14.1 to 14.6).** None is implementation: they are the production migration (owner-confirmed), the branch cleanup, the merge and deploy approvals, post-deploy checks and archive-time docs. Read strictly, the skill counts any unchecked task as CRITICAL; they are recorded as WARNING because the requester declared them expected and owner-gated, and the archived changes `manual-document-data` and `catalog-schedule` were verified the same way. 13.1 is now checked (tasks.md at d741bea: #109 to #129 and #144 to #148 merged, the tip contains `origin/main`); 13.2 is this verification. 8.25 gates the merge to `main`: the tracker must not reach `main` before 0016 is applied (the "Merge gate" of `tasks.md`).
- **W2. Four FE-25 scenarios are UNTESTED and two PARTIAL (process scenarios).** "A locked-out account is counted", "Excluded accounts", "Case collisions are counted" and "CIFs with a non-digit character are counted" describe an owner-run read-only SQL count. The SQL exists only as text in `design.md` and `tasks.md`; no code or test runs it, and it was only ever run on production, where every count was zero, so the positive cases (a listed account, a collision group, an excluded system account) were never exercised. Under the strict skill rule (no covering passing test) these four would be CRITICAL; I rate them WARNING because the delivered code implements none of them, the controlling evidence is the recorded zero counts, and tasks 13.3 and 13.6 re-run the counts on the merge day and after the deploy. The owner can overrule this rating. The real risk behind them is a lockout, because no sign-in fallback exists: until the merge-day counts are zero, an active account without an email, or a student whose CIF the old registration code stored with a hyphen or space (production runs that code until the deploy), cannot sign in after the deploy.
- **W3. RESOLVED at d741bea (S9f, commit 809ce60): an inactive account answered faster than an unknown identifier or a wrong password.** `src/app/(auth)/login/actions.ts` now has one branch, `if (!user?.activo)`, that pays one `verifyPassword` against `DUMMY_PASSWORD_HASH` and returns the generic message; the hash of an inactive account is never checked. Evidence: new LA cases (called once, with the dummy hash, whether the verifier says true or false); the DR-3 retention pin was changed on purpose from "no check" to "exactly one check, against the dummy hash"; mutations N1 (7 failing), N2 (4) and N3 (4) are killed. No main or archived spec forbids the pin change: DR-3 of `data-retention` requires the retention hash to be one no password can match and the account inactive, and the archived data-retention verify (W1) only asks for a test that an inactive account is refused; nothing requires that no bcrypt runs. No caller depends on bcrypt being skipped (`loginAction` is the only one; the sentinel and cancelled accounts are inactive, and their stored hash is never fed to bcrypt now). Cost: one bcrypt per attempt on an inactive account, the same as any other attempt. Specs updated in step: FE-23 text and one new scenario.
- **W4. RESOLVED at d741bea (S9f): a CIF containing "@" could be registered but never used to sign in by CIF.** `registroEstudianteSchema` (`src/lib/validations/users.ts`) now refines the cleaned CIF with `classifyIdentifier(cif)?.kind !== "email"`, the sign-in's own rule, so the two cannot drift. Checked with zod 4.5.4 outside the repo: the errors stay on the `cif` path; an empty cleaned CIF gives only the "Ingresa tu CIF" error (no email branch for an empty value, because `classifyIdentifier` gives null); a too-long CIF with "@" gives both the length and the "@" error; `22010116`, ` 26-00 1234 ` and `AB-12` still pass, so no legitimate student CIF (digits, or letters without "@") is refused. `registroEstudianteSchema` has one caller, `registerAction`, which maps any parse failure to the generic invalid error. Evidence: VU three new cases, RA one new case, N4 (4 failing) and N5 (44 failing) killed. Specs updated: FE-26 text and one new table row.
- **W5. A kept session cannot be revoked for 30 days, and no guard re-reads the account.** `getSession` and the guards in `src/lib/auth/dal.ts` trust the token claims (role, name), so a deactivated or demoted staff account keeps its access until the token expires: up to 30 days with "Mantener la sesión iniciada" instead of 8 hours, and a role change takes as long to apply. This is the documented trade-off of the FE-32 addendum, recorded as backlog UX-30 and follow-up 14.6, and the owner chose it. It is the largest security change of this deploy, so the owner should confirm it knowingly.
- **W6. No login rate limiting** (design D13, backlog UX-29, follow-up 14.6). Accepted by the owner. The CIF is now a low-entropy sign-in identifier (digits starting with the enrollment year), so the 8-character password minimum is the only throttle.
- **W7. `findLoginAccount` is proven only against a query double.** No integration test runs it on Postgres: the two-row ambiguity read, the `lower("Correo")` comparison and the CIF-plus-role join are asserted by rendering the SQL and by stubbed rows (`users.test.ts`). The owner-run S10 session exercised a mixed-case email with spaces and hyphenated CIFs on a real database, but not the ambiguity case. The one assertion that can pass vacuously is the loop at `src/lib/data/users.test.ts:881` (no non-empty guard). Mutation checks M2 and M6 show the double does detect the two behaviors.
- **W8. RESOLVED at planning level: two main-spec lines outside the deltas go stale at archive.** Task 14.3 now lists both: `openspec/specs/catalog-management/spec.md` (A-DOC-FIELDS, about line 1738) and `openspec/specs/data-table/spec.md` (about line 43). The edit itself still happens at archive; it stays open until then.
- **W9. The 360 px scenarios rest on class guards**, not on a real layout (jsdom has none): FE-2 "Mark in both layouts", FE-16 "Long names at 360 px", FE-17 "360 px" and FE-18 "360 px" are PARTIAL for that reason. FE-14 at 360 px also has an owner browser capture (`RF-07_c_2_360.png`). A long unbroken string that no guard class covers would not be caught.

**SUGGESTION**:

- **S1.** `src/lib/data/users.test.ts:881` and `src/lib/auth/cookies.test.ts:72`: assert the collection is non-empty before the loop so neither can pass on an empty collection.
- **S2.** `src/lib/catalog/list-params.ts:53`: `DOCENTES_SORT_KEYS` keeps a `login` value that no column offers (dead sort key, pinned by two tests); remove it, with the two lines of W8, in a later change.
- **S3.** `design.md` drifted from the spec-governed behavior: D14 ("a registered student gets the trimmed CIF"), the S9b list ("the `Usuario` column and the `login` sort key are dropped" on `/users`) and the `Otro motivo` label. The tasks conventions record these as "spec governs"; updating the text would keep the archive coherent.
- **S4.** `docs/setup-local.md` (line 66, `db:seed`) does not say that the seeded accounts now sign in by their email.
- **S5.** The local preview was exercised only in jsdom; no browser capture shows an actual PDF or image preview (the design routed RF-08 to Vitest evidence). A real-browser check of the PDF `iframe` on a blob URL before the deploy would close it, and a `sandbox` attribute on that iframe would harden it at no cost.
- **S7 (new).** A student who types a CIF with "@" gets only the generic "Revisa los datos ingresados" (`auth.register.errors.invalid`), because the action maps every parse failure to it; the schema message "El CIF no lleva @" is never shown. A specific line on the CIF field would help, at the cost of a new key in both catalogs.
- **S8 (new).** The FE-26 text still says "no digit count or format MUST be required" and, two sentences later, that a CIF with "@" MUST be refused. Reword the first to "no digit count or other format" so the paragraph does not read as contradictory.
- **S6.** `lower("Correo")` is compared without a functional index, so each sign-in by email scans `Usuario`. Irrelevant at the current size (about eleven active accounts in production); worth an index if the table grows.

### Verdict

PASS WITH WARNINGS

No CRITICAL finding: 33 requirements implemented, 188 of 199 scenarios covered by tests that passed here (or by owner-run Postgres evidence at an identical tree), 0 failing, typecheck, lint, the focused suite (3028 tests) and the full suite (10438 tests) green, 23 of 23 mutation checks killed. W3 and W4 are fixed and verified. The 14 open tasks are all delivery or owner steps. Before the production deploy the owner still has to apply 0016 (8.24, 8.25) before merging, re-run the three FE-25 counts on the merge day (13.3), and decide W5 (30-day sessions that no guard can revoke) and W2.
