```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:688790cc532550685ffafcead1aebd46f2e8776c42ec72ae73bebcfdd03aea89
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 15/15
scenarios: 60/60
test_command: npm test
test_exit_code: 0
test_output_hash: sha256:2d315671d5b101642fe5515c83ccf79bbd44feb1eb167a559ec76c123ca5d857
build_command: npm run build
build_exit_code: 0
build_output_hash: sha256:a4cfd0f80dfd57dac621554f110ef4fd968c9d7d552a8588f75e0dc26b90cdd4
```

## Verification Report

**Change**: request-consent (whole change, slices S1a, S1b, S2a, S2b, S3; diff `59ab6aa..be90135`, task 9.1)
**Version**: N/A (delta specs: justification-intake, request-review, student-requests, audit-log, privacy-notice)
**Mode**: Strict TDD (vitest)
**Revision**: tracker branch `feat/request-consent` @ `be90135a754cf507465a01e0ff508911df39d918` (all slices merged: S1a #37, S1b #38, S2a #39, S2b #40, S3 #41; migration 0010 applied to production 2026-10-21; owner walk 8.1-8.6 and 8.8 done, 8.7 optional not run). `evidence_revision` is the sha256 of `git diff 59ab6aa be90135` (59ab6aa is the merge base with `main`). The working tree carries only the unrelated uncommitted `package-lock.json` change (not read, staged or reverted). Verified 2026-10-21.

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 74 (Phases 0-9) |
| Tasks complete | 65 checked |
| Tasks incomplete | 9 |

Incomplete tasks. None is code or test work; all are owner-gated, optional or closeout steps that run after this verify (reported as gated, not as failures, following the `teacher-remission` precedent and the orchestrator brief):
- 4.6: delete the Neon branch `backup-before-request-consent` only on the owner's explicit yes after production is stable (the recording half of the task is done in 4.1-4.5).
- 8.7: optional real-Postgres integration run on a disposable branch; not run (see WARNING 1). Done after this run, 2026-10-21: constraint probe 7/7, integration suite 8/8.
- 9.1: this verification.
- 9.2-9.7: spec sync, roadmap row 9, teammate note, archive, tracker merge to `main`, UAM legal review. Run after this verify.

The verify skill treats an unchecked core task as CRITICAL. These nine are closeout, owner or optional steps by design (the tasks file labels them so), none of them describes work missing from the code, and the orchestrator explicitly scoped 9.2-9.7 out of this run. They are recorded as WARNING 2, not CRITICAL.

All code, test, doc and walk tasks of Phases 0-3, 5-7 and 4.1-4.5, 8.1-8.6, 8.8 are checked and match the code state (every referenced file exists; every commit named in apply-progress is in the history).

### Build & Tests Execution
All gates were run on `be90135` with `DATABASE_URL=postgres://u:p@127.0.0.1:9/x` (non-routable placeholder), one at a time. No database command was run (no migrate, push, seed, Neon call or SQL), and the integration suite (`npm run test:integration`) was not run.
- `npm test` (vitest run): exit 0, 236 files, 5116 passed, 0 failed, 0 skipped, 155 s. Matches the apply-progress S3 claim (236 files, 5116).
- Focused run of the 21 test files this change touches (the integration file excluded): 526 passed, 0 failed, 0 pending.
- `npm run typecheck` (tsc --noEmit): exit 0, no errors.
- `npm run build`: exit 0, "Compiled successfully". `/privacy` is listed as a dynamic route and `Proxy (Middleware)` is still built from the root `middleware.ts`.
- `npx eslint src`: exit 1 only because of 91,059 CRLF `Delete` messages (the known Windows gotcha); 0 other errors, 0 warnings after filtering.
- `npx prettier --check --end-of-line auto src i18n middleware.ts`: clean.
- Coverage: not available (no coverage provider installed; only the vitest mocker and spy helpers).

`test_output_hash` and `build_output_hash` are the sha256 of the captured stdout and stderr of each run (they include timings, so they are not reproducible byte for byte).

### Size per slice
Authored lines = additions + deletions, excluding `drizzle/meta`, `openspec`, `.engram`, `package-lock.json`.

| Slice | Measured (apply-progress) | <= 800 budget |
|-------|--------------------------:|---------------|
| S1a schema (PR #37) | 315 | Yes |
| S1b rules (PR #38) | 601 | Yes (S1 was 916 before the split) |
| S2a review checkbox (PR #39) | 477 | Yes |
| S2b staff detail (PR #40) | 324 | Yes (S2 was 801 before the split) |
| S3 privacy page (PR #41) | 685 | Yes |

Whole change, recomputed from the tracker diff against its merge base, docs and CLAUDE.md excluded: 43 files, +2,335 / -61 = 2,396 authored lines. That is about 2.8 times the 865-line forecast of the tasks file; the cause is the strict-TDD test tables (see SUGGESTION 1).

### TDD Compliance
| Check | Result | Details |
|-------|--------|---------|
| TDD evidence reported | OK | apply-progress has a `TDD Cycle Evidence` table for S1 (9 rows), S2 (8 rows) and S3 (4 rows) with safety net, RED, GREEN, triangulation and refactor columns |
| All tasks have tests | OK | every behavior task maps to a test file (21 touched, plus the opt-in integration file); 1.6, 4.x, 7.1-7.2, 7.5 and 8.x are generate, owner or doc steps by nature |
| RED confirmed (tests exist) | OK | all 21 referenced test files exist; RED outcomes are recorded (module not found, N failed) |
| GREEN confirmed (tests pass) | OK | all 21 files pass in the full run and in the focused run (526/526) |
| Triangulation adequate | OK | table-driven or multi-case: 11 payload shapes plus 2 outdated strings (actions), 10 constraint cases (migration), 3 absent, 3 non-string, 2 outdated (submission), es and en for texts, notice and fact |
| Safety net for modified files | OK | recorded for modified suites (21/21, 36/36, 46/46, 85/85, 504-test directory baseline); N/A (new) is right for the files git shows as added (`consent.test`, `migration-request-consent.test`, `public-paths.test`, `privacy/page.test`, `(auth)/layout.test`, `request-sections.test`, `privacy-messages.test`) |

**TDD Compliance**: 6/6 checks passed, with the caveats in WARNING 9 (pins that pass on arrival).

### Test Layer Distribution
Counts are the runtime tests of each touched file (the whole file, not only the lines this change added).

| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit (pure rules, SQL-by-name, i18n catalogs, audit builders) | 187 | 8 | vitest |
| Data layer (DB double), action (hoisted mocks), structural source scan | 170 | 5 | vitest |
| Component, page, server component (Testing Library, user-event, axe-core in jsdom) | 169 | 8 | vitest, Testing Library, axe-core |
| Integration (real Postgres, opt-in) | 0 run | 1 updated (`intake-concurrency.integration.test.ts`) | NOT run (task 8.7) |
| E2E | 0 | 0 | not installed; replaced by the owner walk (phase 8) and a `curl` runtime check (7.4) |
| **Total (touched files)** | **526** | **21** | |

### Changed File Coverage
Coverage analysis skipped: no coverage tool detected. Not a failure.

### Assertion Quality
Scan of the 21 touched test files for tautologies, assertion-free tests, ghost loops, type-only assertions used alone and orphan empty checks:
- No tautologies and no assertion-free tests.
- Loops inside tests in the diff run over fixed non-empty arrays (roles, facts, rights); none iterates a query result that could be empty.
- `toEqual([])` appears on `tooWide(...)`, `fixedWidths(...)` and axe `violations`. `layout-360.test.tsx` has a self-test of its guard (the block named the width guard itself flags a fixed width above the viewport and passes the ones below) and the axe blocks assert that `passes` is not empty. The `fixedWidths` guard in `privacy/page.test.tsx` has no such companion (WARNING 4).
- `not.toBeNull()` appears next to class and attribute assertions (`review-step.test`, `layout-360.test`), never alone.
- The width, layout and token checks assert CSS classes by project convention (`docs/design-system.md` pins).
- Data-layer tests are DB-double based and assert SQL shape and call order, not execution (repository precedent).

**Assertion quality**: 0 CRITICAL, 3 WARNING (class-level layout guards under jsdom, missing guard self-test for the privacy page, mock-heavy DB doubles; all follow repository precedent, see WARNINGs 4 and 9).

### Spec Compliance Matrix
Totals: 15 requirements, 60 scenarios (justification-intake 7/31, request-review 1/6, student-requests 1/8, audit-log 1/5, privacy-notice 5/10), equal to the count of `### Requirement:` and `#### Scenario:` headings. A scenario is COMPLIANT when a covering test passed in this run. Walk means the owner walk record of tasks.md phase 8 or the runtime check of task 7.4, cited in addition to a test unless noted.

**justification-intake**

| Requirement | Scenario | Covering test or record | Result |
|---|---|---|---|
| Consent text and version | Text is the approved one | `consent.test > is the approved es text once the link tags are stripped`, `... en translation ...`, `wraps only the notice phrase in the link tag` | COMPLIANT |
| Consent text and version | Text changed without version change | `consent.test > hashes the raw es message to the pin of the current version`, `detects a text change that keeps the version`, `keeps the pinned hashes distinct, the current version last` | COMPLIANT |
| Consent checkbox on the review step | Unchecked on every visit | `review-step.test > starts unchecked, above the footer, labelled with the approved text`, `is unchecked again when the step is opened again, storing nothing`; walk 8.3(g) resumed draft unchecked | COMPLIANT |
| Consent checkbox on the review step | Submit stays enabled and the dialog opens unchecked | `review-step.test > keeps the submit button enabled and opens the dialog while unchecked`, `shows a consent error under the box, tied to it, not in the form-level block`; `submit-dialog.test > sends null when the box was not checked`; walk 8.3(a) | COMPLIANT |
| Consent checkbox on the review step | Checked box sends the version | `submit-dialog.test > sends the version when the box was checked`; `review-step.test > sends null when unchecked and the version when checked`; walk 8.3(d) | COMPLIANT |
| Consent checkbox on the review step | Checking clears the consent error | `review-step.test > clears the consent error when the box is checked, keeping the others`; walk 8.3(b) | COMPLIANT |
| Consent checkbox on the review step | Link keeps the work | `review-step.test > links the notice in a new tab and says so to a screen reader`, `does not toggle on a click on the privacy link`, `keeps the box checked after a refusal`; walk 8.3(c) | COMPLIANT |
| Consent checkbox on the review step | 360 px and accessibility | `layout-360.test > lets the label wrap beside a box that does not shrink ...`, `toggles the box when the wrapped label is clicked ...`, `reports no accessibility violation ...` (class guard and axe in jsdom); walk 8.3 at 360 px | COMPLIANT (jsdom has no layout, see WARNING 4) |
| Consent checkbox on the review step | Translation keys present | `intake-messages.test > has the consent label with the notice link in both locales`, newTab es and en; independent check: 788 keys in each catalog, empty symmetric difference | COMPLIANT |
| Consent required to submit | Box not checked | `actions.test > answers consent_required for null version and stores nothing` (field consent, submitDraft not called); walk 8.3(a) | COMPLIANT |
| Consent required to submit | Absent, empty or malformed payload (table-driven) | `actions.test > answers consent_required for %s and stores nothing` (11 rows: no key, null, empty, boolean, number, object, undefined, no payload, null payload, string payload, over-long); `submission.test` absent, null, empty, true, 1, object | COMPLIANT (over-long row, see WARNING 6) |
| Consent required to submit | Consent does not mask other errors | `actions.test > does not mask a documents error when the consent is valid`; `submission.test > does not mask the documents error when the consent is valid` | COMPLIANT |
| Consent required to submit | Consent error beside other errors | `actions.test > reports the consent error beside a documents error in one response`; `submission.test > is reported beside every other error, last`; walk 8.3(e) | COMPLIANT |
| Consent version check | Matching version | `submission.test > accepts the version the server currently serves`; `actions.test > submits the stored draft ...` with the server constant | COMPLIANT |
| Consent version check | Outdated page | `actions.test > answers consent_outdated for version %s and stores nothing`; `review-step.test > keeps the box checked after a refusal, and shows an outdated-text error` | COMPLIANT |
| Consent version check | Different string | `actions.test` and `submission.test > reports an outdated consent for version %s` (2025-01-01 and x) | COMPLIANT |
| Consent version check | Version missing is not outdated | `actions.test` (no key and null give consent_required), `submission.test` (absent, null, empty give consent_required) | COMPLIANT |
| Consent recorded at submit | Successful submit stores consent | `solicitudes.test > stamps the consent with the same instant as the presentation ...`, guarded update set and audit payload with the version, `stores and audits the version it is handed`; walk 8.6 (one `solicitud.presentada` row carrying 2026-10-20) | COMPLIANT |
| Consent recorded at submit | Client timestamp ignored | `actions.test > ignores a forged snapshot, timestamp, state or consent instant sent with the call`, `stores the server constant, never the string it received` | COMPLIANT |
| Consent recorded at submit | Constraint cases (table-driven) | `migration-request-consent.test` (both CHECK bodies matched exactly; 10 cases evaluated through JS mirrors of the two predicates). The reject rows (set/empty, empty/set, set/set later) were never executed by Postgres; the accept rows ran in the walk (new submit; legacy NULL pair) and the constraints exist in production (4.4) | COMPLIANT (SQL text and predicate mirror only; a strict reading is PARTIAL, see WARNING 1) |
| Consent recorded at submit | Failure rolls back | `solicitudes.test > writes the consent inside the submit transaction, so a guard conflict leaves none`, `rolls the consent back with the presentation when drift is found after the update`; `actions.test > lets a failure inside the submit transaction propagate (rollback)`; walk 8.6 (no audit row for refused submits) | COMPLIANT (DB-double level, see WARNING 1) |
| Consent recorded at submit | Legacy requests untouched | `migration-request-consent.test > never drops, deletes, inserts, updates, retypes or renames`, `adds only the two nullable columns, without a default`; production check 4.4 (0 rows with consent, Solicitud counts unchanged); walk 8.4 legacy detail | COMPLIANT |
| Submit blocking, per field (MODIFIED) | Required field empty | `submission.test > blocks a missing and an unknown cause` | COMPLIANT |
| Submit blocking, per field (MODIFIED) | No document | `actions.test` (documents error), `submission.test > requires at least one finalized document` | COMPLIANT |
| Submit blocking, per field (MODIFIED) | No subject | `actions.test > requires at least one subject (D15)`, `submission.test > requires at least one subject` | COMPLIANT |
| Submit blocking, per field (MODIFIED) | All errors reported together | `submission.test > reports all invalid fields at once, in field order`, `is reported beside every other error, last` (cause, end date, documents, consent) | COMPLIANT |
| Submit blocking, per field (MODIFIED) | Client bypass | `actions.test` direct calls with invalid data and the role table, including the invalid-payload row | COMPLIANT |
| Four-step stepper (MODIFIED) | Navigation keeps data | unchanged behavior, covered by existing suites that pass: `cause-dates-step.test > shows the saved values of a resumed draft`, `page.test > an explicit step wins over the resume point and prefills the draft` | COMPLIANT |
| Four-step stepper (MODIFIED) | Review is read-only | `review-step.test > has no editable control but the consent checkbox`, `has no editable control at all in the correction flow`, the edit-link and View link cases | COMPLIANT |
| Four-step stepper (MODIFIED) | Edit from review returns to review | existing: `cause-dates-step.test > returns to the review after saving when opened from it`, `subjects-step.test` (same), `documents-step.test > goes back to the review, not the subjects, when opened from it` | COMPLIANT |
| Four-step stepper (MODIFIED) | Subjects need dates | existing: `subjects-step.test > asks for dates first and links to step 1`, `actions.test > asks for the dates first when the draft has none` | COMPLIANT |

**request-review**

| Requirement | Scenario | Covering test or record | Result |
|---|---|---|---|
| Consent shown on the staff detail | Recorded consent | `request-sections.test > shows the version and the Managua date and time of a recorded consent`, `converts an instant that is already the next day in UTC to Managua time`, `speaks Spanish`; `page.test > shows the recorded consent in the student section, in Managua time`; walk 8.4 (Versión 2026-10-20, 21 oct 2026, 16:32) | COMPLIANT |
| Consent shown on the staff detail | Legacy request | `request-sections.test > says that no consent is recorded ...` (es and en), `carries text only ... no alert and no error styling`; `page.test > says no consent is recorded ...`; walk 8.4 (No registrado ...) | COMPLIANT |
| Consent shown on the staff detail | Corrected request keeps its consent | `solicitud-detail.test > keeps the original consent after a correction and resubmission`; `page.test > keeps showing the original consent after a correction and resubmission`; `solicitud-correction.test > never writes the consent columns ...`; walk 8.4 | COMPLIANT |
| Consent shown on the staff detail | Student does not see it | `student-requests.test > covers the data function and the detail screens`, `%s never selects or shows the consent` (structural source scan of the own-detail data function and every `requests/[id]` source) | COMPLIANT |
| Consent shown on the staff detail | Out of scope and audit | `page.test > adds no audit row for the consent: one read per opened detail`; out-of-scope denial from the existing review detail suites (unchanged, passing) | COMPLIANT |
| Consent shown on the staff detail | Translation keys present | `review-messages.test > %s words the consent fact and both of its states`, `words the legacy consent label as a neutral fact in each language` | COMPLIANT |

**student-requests**

| Requirement | Scenario | Covering test or record | Result |
|---|---|---|---|
| Correction validation (MODIFIED) | RN-23 not re-applied | `solicitud-correction.test > accepts an end date 40 days old: the filing window is not re-applied` | COMPLIANT |
| Correction validation (MODIFIED) | RN-05 still applies | `solicitud-correction.test > RN-05 still applies: end before start is refused and nothing is written` | COMPLIANT |
| Correction validation (MODIFIED) | Subject outside enrollment | `solicitud-correction.test > refuses a subject the student is not enrolled in` | COMPLIANT |
| Correction validation (MODIFIED) | No valid document | `solicitud-correction.test > refuses a correction left without a valid document` | COMPLIANT |
| Correction validation (MODIFIED) | Forged owner | `solicitud-correction.test > takes the identity from the caller only: the guard holds the session user`, `leaves the student snapshot columns alone` | COMPLIANT |
| Correction validation (MODIFIED) | Correction never asks for consent | `solicitud-correction.test > validates with the filing window and the consent rule both off`, `never sends a consent version to the validation`, `never writes the consent columns when moving devuelta to pendiente`; `review-step.test > shows no consent checkbox, text or link (C4: consent is given once)`; walk 8.4 (correction resubmits without the checkbox, consent unchanged) | COMPLIANT |
| Correction validation (MODIFIED) | Legacy request is correctable | `solicitud-correction.test > accepts a legacy request whose consent columns are both NULL`; walk 8.4 (legacy simulation, fact stays No registrado) | COMPLIANT |
| Correction validation (MODIFIED) | Forged consent on correction | `solicitud-correction.test > ignores a forged consent version or instant on the caller input` | COMPLIANT |

**audit-log**

| Requirement | Scenario | Covering test or record | Result |
|---|---|---|---|
| Request and document payloads minimise personal data (MODIFIED) | Submit payload | `events.test > is registered in AUDIT_ACTIONS and the payload holds no personal data` | COMPLIANT |
| Request and document payloads minimise personal data (MODIFIED) | Consent version in the payload | `events.test > targets the Solicitud and carries counts and the consent version`, `carries the version it is given, never a constant of its own`, `holds neither the consent text nor an instant: only the version code`; `solicitudes.test` audit payload; walk 8.6 | COMPLIANT |
| Request and document payloads minimise personal data (MODIFIED) | Blocked submit adds no consent audit | `actions.test` consent refusals (submitDraft not called, which is where the audit row is written); walk 8.6 (no row for the refused submits) | COMPLIANT |
| Request and document payloads minimise personal data (MODIFIED) | Rejection payload | existing `events.test` rejection payload cases (unchanged, passing) | COMPLIANT |
| Request and document payloads minimise personal data (MODIFIED) | Leak check | existing `events.test` leak test over all events (unchanged, passing with the new field) | COMPLIANT |

**privacy-notice**

| Requirement | Scenario | Covering test or record | Result |
|---|---|---|---|
| Public access | Anonymous visitor | `public-paths.test > serves the privacy notice`; `privacy/page.test > reads no session and no per-user data`, `sits outside the guarded route groups`; runtime curl 7.4 (200, no redirect); walk 8.5 private window | COMPLIANT |
| Public access | Signed-in user is let through | `public-paths.test` (exact-path allow-list) and a static read of `middleware.ts` (public check first, `NextResponse.next()` for every session state); walk 8.5 signed in, no redirect. No automated test runs `middleware.ts` (WARNING 5) | COMPLIANT (walk) |
| Public access | Other routes stay protected | `public-paths.test` false cases (`/privacy/x`, `/privacy-policy`, `/requests`, `/login`, `/` and five more); runtime curl 7.4 (`/requests` 307 to `/login`, `/privacy/x` 404); walk 8.5 | COMPLIANT |
| Public access | Links from entry pages | `(auth)/layout.test` (es and en, beside the institution line, 44 px, both pages share the layout); 7.4 `/login` carries the link; walk 8.5 | COMPLIANT |
| Required contents | All facts present (table-driven) | `privacy/page.test > states every required fact`, `marks health data as sensitive`, `names the four rights and the secretary office for revocation`, `states five years of retention, then cancellation` (es and en) | COMPLIANT |
| Required contents | Version matches the consent | `privacy/page.test > shows the version as the date of CONSENT_VERSION`; `consent.test > hashes the es privacy subtree to the pin of the current version`, `detects a notice edit that keeps the version` | COMPLIANT |
| Draft marker | Marker shown | `privacy/page.test > shows the draft marker first, then the nine items in order`, `puts the marker before the title, as the first element of the notice` (es and en); walk 8.5 | COMPLIANT |
| No mail provider named | Provider absent | `privacy/page.test > never names the mail provider`, `privacy-messages.test` (no provider name in either locale) | COMPLIANT |
| Usability and i18n | 360 px | `privacy/page.test > has no fixed width above 360 px and lets the article shrink`, `reports no accessibility violation` (es and en; class guard and axe in jsdom) | COMPLIANT (jsdom has no layout, see WARNING 4) |
| Usability and i18n | Translation keys present | `privacy-messages.test > has the same keys in es and en`, `has no empty string in either locale`, `names the facts of RC-10 as sections in both locales` | COMPLIANT |

**Compliance summary**: 60/60 scenarios COMPLIANT, 0 FAILING, 0 UNTESTED; 15/15 requirements. Five scenarios are COMPLIANT with caveats: Constraint cases (the reject rows were never executed by Postgres; a strict reading would call it PARTIAL, it is counted as complete under the DB-double precedent of the previous changes and disclosed in WARNING 1), Failure rolls back (DB-double level), the two 360 px scenarios (class-guard level under jsdom) and Signed-in user is let through (owner walk, no automated test of middleware.ts).

### Correctness (Static Evidence)
| Area | Status | Notes |
|------|--------|-------|
| Schema and migration 0010 | Implemented, applied | schema.ts columns and both CHECKs equal `drizzle/0010_request_consent.sql` (2 ADD COLUMN, 2 ADD CONSTRAINT, no default, no backfill); applied to production 2026-10-21 (migrations 10 to 11, columns nullable, constraints present, 4.4); drift check reports no schema changes (4.5) |
| Consent module and pin | Implemented | `consent.ts` pure, CONSENT_VERSION 2026-10-20; es raw message and es privacy subtree pinned by SHA-256 under the version |
| Fail-closed validation | Implemented | `consentErrors` treats non-string and empty as consent_required, other strings as consent_outdated; default consent is true; the only opt-out caller is `resubmitCorrection`; `validateSubmission` has exactly two production callers |
| Action payload | Implemented | `submitRequestAction(input: unknown)`; non-strict zod parse, failure gives null; role check before parsing; stores `CONSENT_VERSION`, never the received string |
| Persistence and audit | Implemented | guarded UPDATE sets `consentimientoEn: now` (same now as `presentadaEn`) and the version inside the existing transaction; `solicitud.presentada` carries `consentimientoVersion` only; no new audit action |
| Review step and dialog | Implemented | `consented` state never persisted; checkbox rendered only without `flow`; consent in `SECTION_FIELDS`; link target blank with noopener noreferrer and an sr-only new-tab hint; dialog sends the version or null |
| Staff detail | Implemented | `getRequestDetail` selects both columns and never shows half a pair; `getOwnRequestDetail` untouched; one text Fact, no alert |
| Public privacy page | Implemented | server component outside `(dashboard)` and `(auth)`, no session read, draft marker first, nine items in order, version as a time element, no provider named |
| Allow-list | Implemented | `isPublicPage` exact-match set; `middleware.ts` checks it before reading the session |
| Auth layout link | Implemented | one Link to `PRIVACY_PATH` beside the institution line, 44 px, same tab |
| i18n es/en parity | Implemented | 788 keys in each catalog, symmetric difference empty |

### Coherence (Design)
| Decision | Followed? | Notes |
|---|---|---|
| RC-1 schema | Yes | columns, types and both CHECK bodies match the design text exactly |
| RC-2 migration 0010 | Yes | generated as `0010_request_consent`, additive, no backfill; journal when pinned later than 0009 |
| RC-3 consent module and pin | Yes | version constant, label key, raw-message hash and distinct-and-last pin checks; the notice pin was added in S3 as designed |
| RC-4 validation | Yes | options, field and codes as designed; correction passes filingWindow false and consent false |
| RC-5 action payload | Yes, with note | schema, fail-closed parse and server constant as designed; the over-long string row is the WARNING 6 inconsistency between spec table and design |
| RC-6 persistence and timestamp | Yes | one now, no SQL clock, rollback with the presentation |
| RC-7 audit | Yes | payload with asignaturas, documentos and consentimientoVersion; AUDIT_ACTIONS unchanged; `solicitud.corregida` untouched |
| RC-8 review step UI | Yes, with deviations | block above the footer, no new tokens; Label used with block and min-h-11 instead of the default flex so the rich text wraps; the new-tab hint is sr-only text inside the link; the design-system pin every review link is 44 px now skips links inside a label (documented in apply-progress) |
| RC-9 staff detail | Yes, with deviation | the date is rendered with medium date and short time in America/Managua instead of `dates.instant`, because that helper prints the date only and the spec requires date and time (WARNING 7) |
| RC-10 public page | Yes, with note | nine items in order; the draft marker reads de la UAM where the design quotes por la UAM (wording only); the version line is a time element with the ISO date |
| RC-11 allow-list | Yes | helper extracted, `middleware.ts` keeps its name, signed-in users are not redirected |
| RC-12 auth layout link | Yes | one link in the shared layout |
| RC-13 coordination with document-extraction | Pending | the teammate note is task 9.4 (closeout); the code keeps the rerun hook comment and exposes the new `submitRequestAction(input: unknown)` and `SubmitInput.consentimientoVersion` |
| Chain and merge gate | Yes | S1 and S2 reached the tracker before any merge to main; S1 and S2 were split under auto-chain when they exceeded 800 lines |

### Issues Found
**CRITICAL**: None.

**WARNING**:
1. **Resolved after this run (2026-10-21, task 8.7).** On a disposable branch from production, Postgres rejected the four reject rows with the expected constraint names and accepted the three accept rows (7/7, every case rolled back), and `npm run test:integration` passed 8/8. Failure rolls back stays at DB-double level. Original finding: Real-Postgres proof is missing for two scenarios. The Constraint cases reject rows (set/empty, empty/set, set/set later than PresentadaEn) are verified as exact SQL text plus a JavaScript mirror of the two predicates, never by Postgres; Failure rolls back is proven with the DB double (update inside the transaction, no audit row on conflict or drift). The optional run 8.7 (test:integration, constraint cases) was not done; the integration file was updated for the new `SubmitInput` and asserts `ConsentimientoEn = PresentadaEn` but never ran. Mitigation: migration 0010 is applied in production with both constraints present (4.4), and the walk exercised the accept rows for real (new submit; legacy NULL pair).
2. Nine tasks are unchecked: 4.6, 8.7, 9.1 (this run) and 9.2-9.7. All are owner, optional or closeout steps (see Completeness). The `backup-before-request-consent` Neon branch still exists until the owner decides (4.6).
3. `axe-core` is imported by two test files (`layout-360.test.tsx`, `privacy/page.test.tsx`) but is not a declared dependency; it arrives through `eslint-config-next` and `eslint-plugin-jsx-a11y` (lock entry ^4.10.0). A dependency change could silently break two suites. Declaring it as a devDependency edits `package.json` and `package-lock.json`, and the lockfile carries an unrelated local diff, so this was left as an owner decision (apply-progress).
4. The 360 px scenarios rest on class-level guards and axe inside jsdom, which has no layout (no overflow can be measured, color contrast is disabled). The real 360 px check is the owner walk 8.3 for the review step; the walk record 8.5 does not list 360 px for `/privacy`. The `fixedWidths` guard in `privacy/page.test.tsx` has no self-test (the review-step guard has one).
5. The root `middleware.ts` is outside the vitest `src/**` include and has no unit test. Coverage is the `isPublicPage` helper tests (11), a static read (public check first, `NextResponse.next()` for every session state), the build (Proxy (Middleware) emitted), the dev-server curl check 7.4 (anonymous 200, `/requests` 307, `/privacy/x` 404) and the walk 8.5 (signed in, no redirect). The signed-in behavior was never exercised automatically.
6. A version string longer than 20 characters is answered consent_required (the zod max(20) parse fails; test row an over-long version), while the spec table says a non-empty string different from the current version is consent_outdated. Design RC-5 says a parse failure gives consent_required, so spec and design disagree on this row. Both outcomes refuse, store and audit nothing. Align the wording when the spec is synced (task 9.2).
7. Design deviation: RC-9 words the staff date as `dates.instant`; the implementation uses `format.dateTime` with medium date and short time in America/Managua (the spec scenario requires date and time). Recorded in apply-progress; `design.md` is not amended.
8. Two content items are open for the UAM legal review (task 9.7) and do not break the spec: the domicile and contact office of the controller is a visibly marked placeholder (allowed while the draft marker shows; replacing it needs a new `CONSENT_VERSION` and a new pin, because the es subtree is pinned with it), and the mail provider is not named (owner decision R2; a legal risk the design flags under Ley 787 Arts. 13-14). The no-provider tests match the provider name Resend only.
9. Strict-TDD caveats: the structural pin in `student-requests.test.ts` passed on arrival (the invariant already held); in the migration test the pure case table passed at RED; the S3 pin RED (7.8) was a placeholder mismatch rather than an independent failure; the data-layer tests are DB-double based and mock-heavy (SQL shape and call order), as in the repository precedent.

**SUGGESTION**:
1. Re-forecast with the test tables in mind: the tasks file forecast about 865 authored lines and the change measured about 2,400 (S1 916 and S2 801 had to be split). For the next change, forecast tests at 4 to 5 times the production lines.
2. Declare `axe-core` as a devDependency once the unrelated `package-lock.json` diff is resolved (WARNING 3).
3. Done 2026-10-21: task 8.7 ran on a disposable branch (constraint probe 7/7, integration 8/8), see WARNING 1.
4. Add a 360 px line for `/privacy` to the walk record or run it once at archive; add a self-test for the `fixedWidths` guard.
5. The `submitDraft` doc comment in `src/lib/data/solicitudes.ts` has a line of about 118 characters (prettier does not rewrap comments); cosmetic.
6. Documentation drift: apply-progress S2 says `submit-dialog.test.tsx` is 10/10 while the file has 9 tests today (6 existing plus 3 new); the tasks file still quotes S2 and S3 forecasts beside the measured values. Refresh at archive.
7. `.env.development.local` was repointed to the walk branch in 8.1 and the walk branch was deleted in 8.8; the demo-predefensa backup copy is no longer present and the active file was not inspected (`.env*` is unreadable by instruction). Confirm the local environment points at the intended database before the next dev session.
8. Walk 8.4 records the secretary side and the correction results; the student-detail and one-consultada-per-open observations are covered by tests only. Optional to add to the record.
9. At sync (task 9.2) carry the design deviations (RC-9 date format, RC-8 label markup) into `design.md` or the archive notes, and keep the teammate note for `document-extraction` (task 9.4, RC-13): regenerate the migration after consent reaches main and rebase onto `submitRequestAction(input: unknown)`.

### Verdict
PASS WITH WARNINGS. 0 CRITICAL, 9 WARNING, 9 SUGGESTION. All 60 scenarios (15 requirements) in the five delta specs have a covering test or a walk record that passed; the weakest, the database rejection rows of the constraint table, is covered by the exact SQL text, a mirror table, the applied production schema and the walk accept rows. Design decisions RC-1..RC-12 are followed with the recorded deviations; every slice is at or under 800 authored lines after the two splits; tests (5116), typecheck, build, eslint (CRLF noise only) and prettier are green with no database targeted. The nine unchecked tasks are optional, owner-gated or closeout and do not block the next phase.
