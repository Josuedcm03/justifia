# Apply Progress: request-consent

Mode: Strict TDD (vitest). Store: hybrid. Delivery: auto-chain, feature-branch-chain, review budget 800.

## S1 data and rules (phases 1-3), branch `feat/request-consent-s1-data-rules`

Status: tasks 1.1-3.3 complete. The measured authored diff was 916 lines (above the 800 stop rule), so under auto-chain S1 was split afterwards into S1a `feat/request-consent-s1a-consent-schema` (unit 1, PR #37, base tracker) and S1b `feat/request-consent-s1b-rules` (unit 2, PR #38, base S1a); 3.3 is ticked on that basis. 3.4 is out of this work unit. The work was first done on `feat/request-consent-s1-data-rules`.

| Commit | Unit | Authored lines (+/-) |
|--------|------|----------------------|
| `029e123` | 1 schema, migration 0010 (generated, not applied), consent module and text pin | 315 / 0 |
| `72c1845` | 2 validation, correction opt-out, action payload, persistence, audit | 560 / 41 |

Authored total vs tracker (generated SQL, `drizzle/meta/*` and `openspec/` excluded): 875 added + 41 deleted = 916. Production code is 149 of those; the rest is tests.

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | Triangulate | Refactor |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.2/1.3 | `src/lib/intake/consent.test.ts` | Unit | N/A (new) | module missing, suite did not load | 9/9 | text pin plus a "text edited, version kept" case | none needed |
| 1.4/1.5/1.6 | `src/db/migration-request-consent.test.ts` | Schema (SQL by name) | N/A (new) | 7 failed / 10 passed (SQL missing; pure case-table passed) | 17/17 after generate | 10 constraint cases | prettier only |
| 2.1/2.2 | `src/lib/intake/submission.test.ts` | Unit | 21/21 | 10 failed | 31/31 | absent, null, empty, non-string, outdated, opt-out, ordering | none needed |
| 2.3/2.4 | `src/lib/data/solicitud-correction.test.ts` | Unit (db double) | 22 tests, 19 red once consent became fail-closed by default | 23 failed / 4 passed | 27/27 | legacy NULL, forged key, set-keys pin, spy on options | none needed |
| 2.5/2.6 | `src/lib/audit/events.test.ts` | Unit | 85/85 across `src/lib/audit` | 4 failed | 85/85 | two versions, key set, corregida untouched | none needed |
| 2.7/2.8 | `src/lib/data/solicitudes.test.ts` | Unit (db double) | 36/36 | 4 failed | 40/40 | same instant, handed version, conflict, drift | none needed |
| 2.9/2.10 | `src/app/(dashboard)/requests/new/actions.test.ts` | Unit (hoisted mocks) | 46/46 | 15 failed | 58/58 | 11 payload shapes, 2 outdated, beside documents error | none needed |
| 2.11 | `src/i18n/intake-messages.test.ts` | Unit | 7/7 | 6 failed | 13/13 | es and en, required and outdated | none needed |
| 2.12 | typecheck | Type | N/A | `tsc` error TS2322 in `submit-dialog.tsx` | `tsc` clean | N/A (structural) | none needed |

Totals: tests written or changed in this unit about 100 new test cases; full suite 231 files, 5022 tests passing.

### Work Unit Evidence

| Evidence | Value |
|----------|-------|
| Focused test command and result | `npx vitest run src/db src/lib src/app src/i18n`: 201 files, 4573 tests passed. `npm test`: 231 files, 5022 passed |
| Runtime harness | N/A: DB double and SQL read by test; no database targeted. Opt-in `npm run test:integration` not run (needs a disposable Neon branch, ASK OWNER); the integration test was updated for the new `SubmitInput` and asserts `ConsentimientoEn = PresentadaEn` |
| Rollback boundary | Unit 1: `schema.ts`, `drizzle/0010*`, `drizzle/meta/*`, `consent.ts`, label key. Unit 2: `submission.ts`, `solicitud-correction.ts`, `solicitudes.ts`, `actions.ts`, `validations/solicitud.ts`, audit files, `submit-dialog.tsx` wrapper, error keys |

### Gates (dummy `DATABASE_URL=postgres://u:p@127.0.0.1:9/x`)

- `npm test`: 231 files, 5022 tests passed.
- `npm run typecheck`: clean.
- `npx eslint src`: 502 files; 89426 messages, all the repository's CRLF `Delete ␍` noise; 0 other findings.
- `prettier --check --end-of-line auto src i18n` and every changed file: clean (repository-wide the check already warns on 106 untouched files: `openspec/`, `scripts/`).
- `npm run build`: succeeded.
- No database command run: no `migrate`, `push`, `db:seed`, `neon`, no SQL.

### Deviations and notes

- None from the design. `submissionErrors` already maps any code to `intake.errors.<code>`, so no change was needed there.
- Size: forecast ~330, measured 916. Cause: the strict-TDD tables (10-case constraint table, 11 payload shapes, spy and forged-key cases) in 8 test files. Cannot shrink without removing coverage. Natural split: unit 1 alone is 315 lines, unit 2 alone is 601 (both inside 800).

## S2 UI (phases 5-6), branch `feat/request-consent-s2-ui` (from `feat/request-consent-s1b-rules` @ `d1ede71`)

Chain: tracker `feat/request-consent` (PR #36 draft) -> S1a (#37) -> S1b (#38) -> S2 (this) -> S3.

Status: tasks 5.1-5.13 and 6.1 complete. **6.2 (push + PR) NOT done**: the measured authored diff is 801 lines, 1 above the 800 stop rule. Nothing was pushed. Waiting for the owner's decision (see "Size").

| Commit | Unit | Authored lines (+/-) |
|--------|------|----------------------|
| `40e4974` | 3 review-step checkbox, submit dialog payload, `newTab` key, 360 px and design-system pins | 461 / 16 = 477 |
| `b8b97bf` | 4 staff detail consent fact, `getRequestDetail` columns, review keys | 321 / 3 = 324 |

Authored total vs the S1b head (`openspec/`, `.engram/`, `package-lock.json` excluded): 782 added + 19 deleted = 801. Production code is about 126 of those (review-step 56, submit-dialog 12, solicitud-detail 16, request-sections 15, page 5, i18n 22 across two files); the rest is tests.

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | Triangulate | Refactor |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 5.2/5.4 | `requests/new/review-step.test.tsx` | Component (Testing Library, user-event) | 18 files, 504 tests in `requests/new` + `src/i18n` | 12 consent tests plus the "only input" test failed | 30/30 | unchecked, resume, en, link attributes, label toggles, link does not (raw click), enabled button, null vs version, error under the box, cleared by check, outdated, correction flow has none | prettier only |
| 5.3/5.4 | `requests/new/submit-dialog.test.tsx` | Component | same baseline | 2 failed (received `null`, the S1b wrapper) | 10/10 | version, null, server consent error reaches `onErrors` | none needed |
| 5.5 | `src/i18n/intake-messages.test.ts` | Unit | 13/13 | 2 failed (`newTab` missing) | 15/15 | es and en wording | none needed |
| 5.6 | `layout-360.test.tsx`, `design-system.test.tsx` | Static class guard plus axe-core | same baseline | 3 failed | green; the axe run reports passes > 0 | label wraps, label click toggles with the error showing, axe with the error showing, tokens | none needed |
| 5.8/5.9 | `src/lib/data/solicitud-detail.test.ts` | Unit (db double) | 12 tests | 4 failed | 16/16 | recorded, legacy, half a pair, corrected request | none needed |
| 5.8 | `src/lib/data/student-requests.test.ts` | Structural (source scan) | 12 tests | n/a: the invariant already held | 12 + 7 | data function and every `requests/[id]` source | none needed |
| 5.10/5.11 | `review/[id]/request-sections.test.tsx` (new), `review/[id]/page.test.tsx` | Component / page | page suite green | 8 failed in `request-sections`, 3 in `page` | green | recorded, UTC-next-day instant, es, legacy es and en, no alert, original consent after resubmission, one audited read | none needed |
| 5.12 | `src/i18n/review-messages.test.ts` | Unit | all green | 3 failed | green | es and en | none needed |

Totals: 19 RED tests in unit 3 and 17 in unit 4 observed before any production change; the full suite went from 5022 tests (S1b) to 5069 in 232 files.

### Work Unit Evidence

| Evidence | Value |
|----------|-------|
| Focused test command and result | Unit 3: `npx vitest run "src/app/(dashboard)/requests/new" src/i18n`: 18 files, 527 passed. Unit 4: `npx vitest run src/lib/data/solicitud-detail.test.ts src/lib/data/student-requests.test.ts "src/app/(dashboard)/review" "src/app/(dashboard)/requests" src/i18n`: 39 files, 1061 passed |
| Runtime harness | N/A for the agent: no database may be targeted and the dev server needs a seeded login. The owner walk (phase 8: 360 px, desktop, es and en, keyboard, resumed draft, secretary detail) covers the runtime path. jsdom applies the label rule (a click on the inner link does not toggle) and axe-core runs with the error showing |
| Rollback boundary | Unit 3: `review-step.tsx`, `submit-dialog.tsx` and their tests, the layout-360 and design-system additions, `intake.review.consent.newTab` (S1b then fails closed again). Unit 4: `solicitud-detail.ts`, `request-sections.tsx`, `page.tsx` and their tests, `review.detail.fields.consent`, `review.detail.consent.*` |

### Gates (dummy `DATABASE_URL=postgres://u:p@127.0.0.1:9/x`)

- `npm test`: 232 files, 5069 tests passed.
- `npx vitest run src/lib src/app src/i18n`: 189 files, 4466 passed.
- `npm run typecheck`: clean.
- `npx eslint src`: 503 files, 89764 messages, all the CRLF `Delete ␍` noise; 0 other findings.
- `prettier --check --end-of-line auto src i18n`: clean.
- `npm run build`: succeeded.
- No database command run: no `migrate`, `push`, `db:seed`, `neon`, no SQL.

### Size

Forecast ~330, measured 801 (unit 3: 477, unit 4: 324): 1 line over the 800 rule. Cause: strict-TDD component tests (12 consent scenarios in `review-step.test.tsx`, an axe block and a 360 px block, a new `request-sections.test.tsx`) against about 126 lines of production code. Not shrunk (no comments, tests or blank lines removed). Natural split by work unit if the owner wants it: S2a = unit 3 (477) and S2b = unit 4 (324), both well inside 800. Unit 4 does not depend on unit 3 (the only shared files are the two i18n catalogs).

### Deviations and notes

- The staff fact shows the consent date and time (`dateStyle: "medium"`, `timeStyle: "short"`, America/Managua), not `dates.instant` as RC-9 words it: that helper prints the date only, and the spec scenario requires "that date and time".
- `axe-core` is not a direct dependency: it arrives through `eslint-config-next` and `eslint-plugin-jsx-a11y` (lock: 4.13.0). `layout-360.test.tsx` imports it. Declaring it as a devDependency changes `package.json` and `package-lock.json`, and the lockfile has an unrelated local diff that must not be staged, so this is left as an owner decision.
- The existing design-system pin "every review link is 44 px" now skips links inside a label: the consent link is inline text in a sentence, not a button-sized action.
- The shared `Label` is used with `block` (the `cn` helper merges away its `flex` and `text-label`) so the rich text and the link wrap as one paragraph.
- The new-tab hint is rendered inside the link as `sr-only` text, so the link name is "Ver aviso de privacidad (se abre en una pestaña nueva)".
- Commit `40e4974` also carries an `.engram/` chunk that the repository's engram hook stages on commit; it is generated and excluded from the count.
- "Student does not see it" is pinned structurally (a scan of the own-detail data function and the `requests/[id]` sources) because the db double cannot show a select list.
