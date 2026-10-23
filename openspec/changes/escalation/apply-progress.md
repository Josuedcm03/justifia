# Apply progress: Escalation

Mode: Strict TDD (vitest). Artifact store: hybrid. Delivery: auto-chain, `feature-branch-chain`, review budget 1000 authored lines.

## Batch S1: Phases 1, 2 and 3 (2026-10-22)

Branches (all pushed): `feat/escalation-s1a-schema` (Phase 1, `e4ef559`), `feat/escalation-s1b-writes` (Phase 2, `28ca0f9`, stacked on S1a), `feat/escalation-s1-data-rules` (both units, the full S1 head). Cut from the tracker `feat/escalation` at `b4f7892`. No PR opened: blocked on owner task 0.1 (migration merge order with `document-extraction`).

### Completed tasks

- Phase 1: 1.1 to 1.13 (schema, generated migration `0011_escalation`, transitions, business-day and clock rules).
- Phase 2: 2.1 to 2.12 (validators, audit builders, escalate and report writes, resubmit reset, append-only pin).
- Phase 3: 3.1 (gates), 3.2 (measure and split).
- Open: 3.3 (re-check again right before the PR), 3.4, 3.5 (PR; blocked on 0.1).

### TDD cycle evidence

| Task | Test file | Layer | Safety net (unaffected at RED) | RED | GREEN | Triangulate | Refactor |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.2/1.3 | `src/lib/intake/transitions.test.ts` | Unit | 5 pre-existing assertions stayed green in the RED run | 11 failed / 5 passed | 16 passed (+`solicitud-decision.test.ts` 55/55) | edges per actor, `sourceOf` none/many/one, every `DECISION_KINDS` | prettier only |
| 1.4/1.5 | `src/lib/intake/business-days.test.ts` | Unit | 26 pre-existing tests green in the RED run | 17 failed / 26 passed | 43 passed | six count rows, holiday, same-day, reverse range; add rows, zero, holiday | none needed |
| 1.6/1.7 | `src/lib/intake/deadline-clock.test.ts` | Unit | N/A (new) | file failed to load (module absent) | 13 passed (one test fixture bug fixed before green) | spec table 3 rows, holiday, two pauses, Managua vs UTC | none needed |
| 1.8-1.12 | `src/db/migration-escalation.test.ts` | Schema (file read) | the other `src/db` files: 154 green | 26 failed / 26 | 26 passed after `db:generate` (`src/db` 14 files / 180 passed) | columns, 12 CHECK bodies, FKs, indexes, only-DROP | none needed |
| 2.1/2.2 | `src/lib/intake/escalation.test.ts` | Unit | N/A (new file) | 35 failed / 1 passed | 36 passed | bounds 0/1/1000/1001, reasons, date today/yesterday/tomorrow/Feb 30, Managua evening | prettier only |
| 2.3/2.4 | `src/lib/audit/events.test.ts`, `types.test.ts` | Unit | `diff.test.ts` and 12 other tests green in the RED run | events file failed to load, types 1 failed | `src/lib/audit` 3 files / 92 passed | three builders, leak test with smuggled text, existing payloads | none needed |
| 2.5-2.7 | `src/lib/data/solicitud-escalation.test.ts` | Data (db double) | N/A (new) | file failed to load | 29 passed (24 report tests still red) | count (0/1/2, null career), 5 non-pendiente states, unique violation x2, rollback x3 | prettier only |
| 2.8/2.9 | same file | Data (db double) | 29 green | 24 failed (`recordExcessReport` not a function) | 53 passed | 5 non-aprobada states, foreign teacher, date/note, two reports, three rollbacks | none needed |
| 2.10 | `src/lib/data/solicitud-correction.test.ts` | Data (db double) | 24 pre-existing tests green in the RED run | 4 failed / 24 passed | 28 passed | `set` shape asserted in three places plus a named test | comment re-wrapped |
| 2.11 | `src/lib/data/append-only.test.ts` | Structural | 8 pre-existing tests green in the RED run | 1 failed / 8 | 11 passed | detection x3 tables, writer scanned | none needed |

Safety net note: the pre-existing test files were not run as a separate baseline before editing; the tests that stayed green in each RED run are the evidence that the unmodified behavior held.

Test summary: 4 new test files (`deadline-clock`, `migration-escalation`, `escalation`, `solicitud-escalation`) and 6 extended (`transitions`, `business-days`, audit `events` and `types`, `solicitud-correction`, `append-only`); `npm test` at the S1 head is 240 files / 5282 tests green. Layers: Unit (pure), Data (scripted db double), Schema (generated SQL read), Structural. No approval tests (no refactor tasks). Pure functions added: `sourceOf`, `countBusinessDays`, `addBusinessDays`, `clockStartOf`, `pausedStartOnAnswer`, `effectiveClockStart`, three validators.

### Work unit evidence

| Evidence | Unit 1 (S1a) | Unit 2 (S1b) |
|---|---|---|
| Focused test command and result | `npx vitest run src/db src/lib` at `e4ef559`: 118 files, 2432 passed | `npx vitest run src/lib/intake src/lib/audit src/lib/data` at `28ca0f9`: 69 files, 1297 passed |
| Runtime harness | N/A: SQL read by test, never applied; real Postgres is unit 10 and phase 14 | N/A: scripted db double; the race and lock are covered by unit 10 |
| Rollback boundary | `schema.ts`, `src/db/clock-start.ts`, `drizzle/0011_escalation.sql`, `drizzle/meta/`, intake rule files | `solicitud-escalation.ts`, `solicitud-correction.ts` reset, audit files, `intake/escalation.ts` validators |

### Gates (combined S1 head)

- `npm test` (dummy `DATABASE_URL`): 240 files, 5282 passed.
- `npm run typecheck`: clean.
- `npx eslint src`: 0 problems other than the CRLF `Delete ␍` noise.
- Prettier (`--end-of-line auto`) on every changed source file: clean.
- `npm run build` (dummy `DATABASE_URL`): ok.
- No `drizzle-kit migrate`/`push`, `db:seed` or SQL write run; `db:generate` ran with a dummy URL (it never connects).

### Measured authored lines vs the tracker

Excluding `openspec/`, `.engram/`, `package-lock.json`, generated SQL and `drizzle/meta/*`:

| Slice | Added | Deleted | Total |
|---|---:|---:|---:|
| S1 combined | 2545 | 25 | 2570 |
| S1a (Phase 1) | 907 | 14 | 921 |
| S1b (Phase 2, vs S1a) | 1642 | 15 | 1657 |

S1b exceeds 1000 after the one allowed split: `size:exception` recommended. It holds the 316-line data module and its 700-line test (every state in the spec tables is a row), so it cannot shrink without dropping tests. If the owner prefers smaller PRs, the next honest cut is inside S1b: validators + audit + resubmit reset + append-only (about 700) and the two data writes (about 1000).

### Deviations from design

1. `src/lib/intake/escalation.ts` is created in unit 1 with the constants only (the schema renders its CHECK lists from them, as `remission/states.ts` does); unit 2 adds the validators (task 2.2 said the file is created there).
2. `countCoordinationAccounts(q, solicitudId)` runs two selects (the student's live career, then the count) and returns `{ carreraNombre, cuentas } | null`; a single joined statement cannot be pinned by the db double.
3. `EscalationField`/`EscalationErrorCode` gain `docente`/`docente_invalid` for the "teacher outside the remissions" refusal.
4. `CK_Escalamiento_MotivoEstado` states `bloqueada` as `NotificacionMotivo IS NOT NULL AND = 'sin_destinatarios'`: a bare equality would let a NULL motive pass the CHECK. A named `CK_Escalamiento_NotificacionEstado` also exists (design listed the outbox CHECKs as "mirroring Remision").
5. `CreadoEn` defaults to `now()` (the writes pass the injected `now` explicitly).
6. The pre-commit hook added `.engram/` sync files to commit `e4ef559` (excluded from the budget).

### Issues and notes

- Two `package-lock.json` changes pre-existed and stay unstaged.
- No Next.js API is used in S1 (no pages, actions or routes), so the Next 16 docs were not needed yet.
- Migration number `0011` is whatever `drizzle-kit` produced; if `document-extraction` merges a `0011` first, regenerate (task 3.3).

### UX observations (for owner decision)

- The report date accepts any past date with no lower bound (spec); a typo such as a wrong year is stored. A soft warning in the S2 dialog for a date before the approval would catch it. DECIDED 2026-10-23: not added; spec behavior kept (UX-06 in the flow backlog).

### Remaining tasks

- [ ] 3.3 re-check `drizzle/` on `main` right before the PR
- [ ] 3.4 open the S1a PR (tracker base), then S1b (S1a base until it merges), with `size:exception` noted for S1b
- [ ] 3.5 merge into the tracker after review
- Not started by instruction: Phase 4 onward, S2.

### Status

27 of the 30 S1 tasks (1.1-1.13, 2.1-2.12, 3.1, 3.2) complete; 3.3 to 3.5 wait on owner task 0.1. Ready for sdd-verify of the S1 code, then PRs once 0.1 is closed.

## Batch S2: Phases 5 and 6 (2026-10-23)

Branches (all pushed): `feat/escalation-s2-secretary-ui` (S2 head `0bc6016`, both units), `feat/escalation-s2a-tabs` (unit 3, `3bebf51`) and `feat/escalation-s2b-detail` (unit 4, `0bc6016`, stacked on S2a). Cut from `origin/feat/escalation-s1b-writes` (28ca0f9) by owner decision 2026-10-23: the S1 PRs are not open yet, so the future PR base of S2 is the S1b branch (S2a base: S1b branch; S2b base: S2a branch), retargeted to the tracker as the S1 PRs merge. No PR opened (instruction). Strict TDD (vitest), artifact store hybrid, auto-chain, `feature-branch-chain`, review budget 1000.

### Completed tasks

- Phase 5: 5.1 to 5.20 (tabs and pause-aware queue, escalation history, escalate and report dialogs and actions, i18n, 360 px and token pins).
- Phase 6: 6.1 (gates), 6.2 (measure and split).
- Open: 6.3 (open the PRs, merge into the tracker), pending as noted above.

### TDD cycle evidence

| Task | Test file | Layer | Safety net (unaffected at RED) | RED | GREEN | Triangulate | Refactor |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 5.5 | `audit/events.test.ts`, `data/request-reads.test.ts` | Unit / Data | 84 of 90 stayed green in the RED run | 6 failed | `src/lib/audit` + request-reads: 4 files / 103 passed | tab code per tab (3 values), leak test with the new key, no id list | none needed |
| tabs selector | `intake/review-tabs.test.ts` | Unit | N/A (new) | module absent | 12 passed | 3 codes, 8 invalid inputs (state without tab, array, number) | none needed |
| 5.3/5.4 queue | `data/revision-queue.test.ts` | Data (db double) | 13 pre-existing tests green in the RED run | 14 failed | 27 passed | three-way order, stored start over resubmission, receipt date kept, `none` scope x3, limit 50, notice send time (1 more RED then green) | none needed |
| 5.4 detail deadline | `data/solicitud-detail.test.ts`, `review/[id]/page.test.tsx` | Data / Page | 19 and 68 stayed green | 2 failed; 1 failed | 21 passed; 69 passed | with and without stored start (Wed 14 Oct: due Wed vs due Mon 19) | none needed |
| 5.7 badge | `review/design-system.test.tsx` | UI | 35 stayed green | 1 failed (`en_pausa`) | 36 passed | four statuses | none needed |
| 5.8 i18n | `i18n/review-messages.test.ts` | Catalog | 20 stayed green | 3 failed, then 2 (reasons, statuses) | `src/i18n` 288 passed | es and en, parity | none needed |
| notice status | `review/notice-status.test.ts` | Unit | N/A (new) | module absent | 5 passed | four texts + two stray-reason rows | none needed |
| 5.6/5.7 page | `review/page.test.tsx` | Page | 30 of 47 stayed green | 17 failed | review folder 14 files / 369 passed | default, invalid x4, each tab, denied x2, none scope x2, load failure, banner (2 failed then green) | prettier only |
| 5.10/5.11 detail | `data/solicitud-detail.test.ts` | Data (db double) | 20 of 28 stayed green | 8 failed | 28 passed | open and answered escalation, report with notice status, where/order of both reads, select-only, no percentage key | prettier re-indented the `Promise.all` block |
| own-request pin | `data/student-requests.test.ts` | Characterization | 26 green | passed at write (the payload did not change) | 27 passed | exact key set, 5 selects, neither new table read | none needed |
| count for the page | `data/solicitud-escalation.test.ts` | Data (db double) | 53 green | 1 failed | 54 passed | same two-select shape on the shared handle | none needed |
| 5.12/5.13 actions | `review/[id]/escalation-actions.test.ts` | Action | N/A (new) | module absent | 56 passed | both actions x 7 denied roles, anonymous, none scope, 7 bad ids, 4 bad payloads, refusals, thrown error, client reason ignored, 6 bad remission ids | none needed |
| 5.14/5.15 section | `escalation-section.test.tsx`, `[id]/page.test.tsx` | UI / Page | 12 new; 79 of 90 page tests stayed green | module absent; 11 failed | 12 passed; 90 passed | open, answered, two escalations, four status rows, es, wrap | none needed |
| 5.16 dialog | `escalate-dialog.test.tsx` | UI | N/A (new) | module absent | 12 passed | availability x3, counter, send, cancel, Escape, 5 refusals | none needed |
| 5.17 report | `report-dialog.test.tsx`, `absence-reports-section.test.tsx` | UI | N/A (new) | modules absent | 10 and 14 passed | options, max date, no percentage field, no teachers, send, nothing chosen, field errors, 3 banners, cancel; list, notice x4, no action, nothing to show | list entry rewritten before green |
| 5.18 i18n | `i18n/review-messages.test.ts` | Catalog | 23 green | 6 failed | 32 passed in the file | sin_coordinacion wording, no voseo, no percentage | none needed |
| 5.19 pins | `review/layout-360.test.tsx`, `design-system.test.tsx` | UI (axe, class pins) | 36 green | characterization: passed at first run except one selector slip in my test | 24 and 45 passed | five views x es and en axe, two open dialogs | none needed |

Safety net note: as in S1, the pre-existing files were not run as a separate baseline; the tests that stayed green in each RED run are the evidence.

Test summary: new files `review-tabs`, `notice-status`, `escalation-actions`, `escalation-section`, `escalate-dialog`, `report-dialog`, `absence-reports-section`, `layout-360`; extended `events`, `request-reads`, `revision-queue`, `solicitud-detail`, `solicitud-escalation`, `student-requests`, `review-messages`, both page tests and `design-system`. `npm test` at the S2 head: 248 files / 5524 tests (S1 head: 240 / 5282). Layers: Unit, Data (db double), Action, UI (Testing Library, axe), Catalog. No approval tests (no refactor tasks). Pure functions added: `reviewTabOf`, `noticeStatusKey`.

### Work unit evidence

| Evidence | Unit 3 (S2a) | Unit 4 (S2b) |
|---|---|---|
| Focused test command and result | `npx vitest run src/lib/data/revision-queue.test.ts src/lib/data/request-reads.test.ts src/lib/data/solicitud-detail.test.ts src/lib/audit src/lib/intake/review-tabs.test.ts "src/app/(dashboard)/review" src/i18n` at `3bebf51`: 27 files / 820 passed | `npx vitest run src/lib src/app src/i18n` at `0bc6016`: 204 files / 4895 passed |
| Runtime harness | N/A here: the `npm run dev` walk of tabs, order and `en_pausa` is owner phase 15 (needs a migrated database; none touched) | N/A here: escalate, E17 unavailable and report walk is owner phase 15 |
| Rollback boundary | `revision-queue.ts`, `review/page.tsx`, `review-tabs.tsx`, `coordination-tab.tsx`, `approved-tab.tsx`, the two table modules, `notice-status.ts`, `deadline-badge.tsx`, `review-tabs.ts`, the `cola.consultada` payload, `solicitud-detail.ts` deadline start, tab keys | `solicitud-detail.ts` history reads, `review/[id]/escalation-*`, `escalate-dialog.tsx`, `report-dialog.tsx`, `absence-reports-section.tsx`, `[id]/page.tsx` wiring, `coordinationAccountsOf`, dialog and report keys |

### Gates (S2 head `0bc6016`, dummy `DATABASE_URL`)

- `npx vitest run src/lib src/app src/i18n`: 204 files, 4895 passed.
- `npm test`: 248 files, 5524 passed.
- `npm run typecheck`: clean.
- `npx eslint src`: 0 problems other than the CRLF `Delete ␍` noise.
- Prettier (`--end-of-line auto`) on every changed file: clean.
- `npm run build`: ok.
- Unit 3 alone (`3bebf51`) was checked with the focused run above, typecheck, eslint and prettier before its commit; the full suite and the build ran on the S2 head only.
- No `drizzle-kit migrate`/`push`, `db:seed`, `neon` command or SQL write run. S2 changes no schema.

### Measured authored lines vs the S1b head 28ca0f9

Excluding `openspec/`, `.engram/` and `package-lock.json` (no generated SQL in S2):

| Slice | Added | Deleted | Total |
|---|---:|---:|---:|
| S2 combined | 4968 | 113 | 5081 |
| S2a (unit 3) | 1687 | 60 | 1747 |
| S2b (unit 4, vs S2a) | 3281 | 53 | 3334 |

Roughly 2900 of the lines are tests (table-driven denial matrices, status rows, es/en, axe), about 230 are the two catalogs and about 1900 are production code. Both halves exceed 1000 after the one allowed split at the unit boundary: `size:exception` recommended for both PRs. Not squeezed. If the owner wants smaller PRs, the next honest cuts are inside S2b: (a) data history reads + section + page wiring, (b) actions + dialogs + the report section; and inside S2a: (a) audit payload + selector + queue data, (b) page + tab components.

### Deviations from design

1. Tasks 5.16 and 5.17 name `ConfirmDialog`; the staff dialogs use the `AlertDialog` primitive like `DecisionDialog`. The `requests/new` `ConfirmDialog` is typed to the intake `ActionResult` and has no form body.
2. Success of the escalate action redirects to `/review?resultado=escalada` (new queue banner key `queue.result.escalada`); a report redirects to the detail. The decision action sets the same precedent, and nothing revalidates (SR-11).
3. `CoordinationQueueRow` carries `enviadaEn` so the tab can show the send time of an `enviada` notice (spec: "sent, with time"); the design list did not name it.
4. The escalate control sits in the decision panel row (beside approve, return and reject) and the E17 text replaces it there; the escalation history section is placed right after the request section.
5. Added `coordinationAccountsOf(solicitudId)` to `solicitud-escalation.ts` so the page reads the count without importing `db`.
6. The resend control for non-`enviada` notices is not in S2: tasks 7.13 (S3) wire it into `escalation-section.tsx`; S2 shows the status texts only.
7. `review/layout-360.test.tsx` is a new file (the review folder had none; its 360 px checks lived in `design-system.test.tsx`).

### Issues and notes

- `listApprovedRequests` joins the approval decision and counts reports with a correlated subquery; the generated SQL was checked by rendering it, but it has not run against Postgres (S5 suite and the walk cover it).
- `package-lock.json` and the owner's `docs/flow-experience-backlog.md` edit stay unstaged and untouched.
- Next.js 16: the page `searchParams` guide matches the pattern already used; no new Next API beyond `redirect` in Server Actions (same as the decision action).

### UX observations (for owner decision)

- Owner decision 2026-10-23: no soft warning in the report dialog when the communicated date is before the approval; spec behavior kept (recorded as UX-06 in the flow backlog).
- The En coordinacion tab shows a muted "Paused" badge and no due date; a request back in Pendientes shows only the shifted due date with no hint why (design observation 1). A "paused N days" note could help.
- The Aprobadas tab shows the latest 50 with a note; an older approval needs its URL until search exists (E14).
- Notification status is a text pill in three places (En coordinacion row, escalation history, report entry); the teacher picker lists teachers whose remission mail is still pending without a delivery hint (design observation 4).
- With no teacher remissioned, the report action is replaced by a note; a secretary may expect to report a teacher the system could not notify.

### Remaining tasks

- [ ] 6.3 open the S2a PR (base: S1b branch) and the S2b PR (base: S2a branch) with `size:exception`, after the S1 PRs; merge into the tracker after review
- Not started by instruction: Phase 7 onward (S3).

### Status

Phase 5 (20 of 20) and 6.1, 6.2 complete; 6.3 waits on the S1 PRs. Cumulative: 27 of 30 S1 tasks + 22 of 23 S2 tasks. Ready for sdd-verify of the S2 code, then PRs.

## Batch S3: Phases 7 and 8 (2026-10-23)

Branches (all pushed): `feat/escalation-s3-notifications` (S3 head `620a040`, both units), `feat/escalation-s3a-notice-outbox` (unit 5, `236a0d8`) and `feat/escalation-s3b-dispatch-cron` (unit 6, `620a040`, stacked on S3a). Cut from `origin/feat/escalation-s2b-detail` (4dd9616) by instruction: the S1 PRs are not open yet, so the future PR base of S3a is the S2b branch (until S2 merges) and of S3b the S3a branch, retargeted to the tracker as the earlier PRs merge. No PR opened (instruction). Strict TDD (vitest), artifact store hybrid, auto-chain, `feature-branch-chain`, review budget 1000 counted on production code only (non-test `src/` plus `i18n/`).

### Completed tasks

- Phase 7: 7.1 to 7.16 (notice plan and message, `APP_BASE_URL`, outbox claim and completions, recipients, audit builders, dispatcher, post-commit `after()`, resend action and control, cron drain of both outboxes, i18n).
- Phase 8: 8.1 (gates), 8.2 (measure and split).
- Open: 8.3 (open the PRs, merge into the tracker), pending as noted above. Task 8.2 of the plan was split in two (measure, then open the PR) so the measure could close.

### TDD cycle evidence

| Task | Test file | Layer | Safety net (unaffected at RED) | RED | GREEN | Triangulate | Refactor |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 7.4 | `src/env.test.ts` | Unit | 5 existing stayed green | 2 failed / 6 passed (the unset case passes by design) | 8 passed | set, empty means unset, non-URL rejected | `unsetWhenEmpty` shared with `optionalSecret` |
| 7.2/7.3 | `escalation/message.test.ts`, `escalation/plan.test.ts`, `mail/idempotency-key.test.ts` | Unit | N/A (new); then `src/lib/remission` stayed green | 3 files failed to load (modules absent) | 19 passed (9, 8, 2); with `src/lib/remission` 8 files / 68 passed | 0, blank, 1 and 3 recipients; recipients checked before config; key stable, recipient-sensitive, wording-insensitive; trailing slash; line breaks collapse; forbidden words | `oneLine` and the idempotency key extracted from the remission files (approval: their tests) |
| 7.11 | `audit/events.test.ts`, `audit/types.test.ts` | Unit | types: 6 of 7 stayed green | events file failed to load; types 1 failed | `src/lib/audit` 4 files / 134 passed with `intake/escalation` | four builders, code-only payloads, smuggled provider text and address dropped, closed action set | none needed |
| 7.5/7.6 | `data/escalamiento.test.ts` | Data (db double) | `remision.test.ts` 37 stayed green after the outbox extraction | module absent | 28 passed | three triggers and their claimable states, lease take-over, completions (sent, failed, give-back, blocked), stale worker, audit rollback, retry select, resend 4 cases, recipients, context | claim, lease and completion extracted to `outbox.ts`; `remision.ts` uses it (SQL-rendering tests unchanged) |
| 7.7 | `data/escalamiento-writes.test.ts` | Structural | N/A (new) | 3 failed (module absent) | 5 passed | write shapes, no foreign writer, allowed writers non-vacuous, outbox and answer columns apart | none needed |
| 7.9/7.10 | `data/escalation-dispatch.test.ts` | Data (module doubles, fake mail) | `remission-dispatch.test.ts` 26 stayed green after `dispatchEach` | module absent | 22 passed (one fixture slip fixed: a default parameter swallowed `undefined`) | success with 1 and 3 recipients, excess note, provider codes x3, no recipient x3 incl. before config, unset base URL, actor session vs cron vs resend, skipped, lost x3, missing context, batch summary and containment | per-row loop extracted to `dispatch-batch.ts`; `remission-dispatch.ts` uses it |
| deps | `escalation/deps.test.ts` | Unit | N/A (new) | module absent | 3 passed | wiring, unset base URL, no store | none needed |
| 7.12/7.13 | `review/[id]/escalation-actions.test.ts` | Action | 68 of 99 stayed green | 31 failed | 99 passed | both actions: scheduled once, run after the response with the creation trigger, four refusal kinds, no scope, thrown write, scheduling failure, failed dispatch; resend: 7 roles, anonymous, none, 7 bad ids, unknown, sent, pending and blocked, 4 outcomes, SR-11, thrown | `after-response.ts` extracted; `remission-actions.ts` uses it (46 tests stayed green) |
| 7.13 | `review/[id]/resend-escalation-button.test.tsx` | UI | `resend-remission-button.test.tsx` 7 stayed green after sharing the control | module absent | 8 passed | named button, in flight, sent, pending and blocked keep the button, two refusals, Spanish | `resend-button.tsx` shared by both wrappers |
| 7.13 | `escalation-section.test.tsx`, `absence-reports-section.test.tsx`, `[id]/page.test.tsx` | UI / Page | 28 of 37 stayed green | 9 failed | 18, 19 and 91 passed (`solicitud-detail.test.ts` 28) | three unsent states, sent, mixed list, Spanish; page: only the resend left in coordination, none once sent | `NoticeDelivery` composes the pill and the control |
| 7.14 | `api/cron/remission-retry/route.test.ts` | Route | 36 of 48 stayed green | 12 failed | 23 passed in the file (cron folder 48) | 5 bad credentials, both outboxes, order, response shape, log line, nothing due, each outbox failing in 4 ways | `drain` and `attempt` helpers; empty summary shared |
| 7.15 | `i18n/review-messages.test.ts` | Catalog | 32 stayed green | 3 failed | 35 passed (`src/i18n` 298) | es and en, neutral wording, no teacher | none needed |

Safety net note: as in S1 and S2, the pre-existing files were not run as a separate baseline before editing, except the remission suites, which were run green (16 files / 301 tests) before the shared extraction and stayed green after each extraction.

Test summary: new files `escalation/{message,plan,deps}`, `mail/idempotency-key`, `data/{escalamiento,escalamiento-writes,escalation-dispatch}`, `resend-escalation-button`; extended `env`, audit `events` and `types`, `escalation-actions`, `escalation-section`, `absence-reports-section`, `page`, `layout-360`, `design-system`, `review-messages`, `route`, `remision`, `solicitud-detail`. `npm test` at the S3 head: 256 files / 5680 tests (S2 simplify head: 248 / 5519). Layers: Unit, Data (db and module doubles), Action, UI (Testing Library, axe in the 360 file), Route, Catalog, Structural. No approval tests were written: the extractions rely on the existing remission suites, which render the SQL and pin the shapes. Pure functions added: `planEscalationNotice`, `buildEscalationMessage`, `mailIdempotencyKey`, `oneLine`, `claimStamp`, `claimRelease`, `sentStamp`, `attemptGivenBack`, `leaseFree`.

### Work unit evidence

| Evidence | Unit 5 (S3a) | Unit 6 (S3b) |
|---|---|---|
| Focused test command and result | `npx vitest run src/lib/escalation src/lib/mail src/lib/data/escalamiento.test.ts src/lib/data/escalamiento-writes.test.ts src/lib/data/remision.test.ts src/lib/data/remission-dispatch.test.ts src/lib/remission src/lib/audit src/env.test.ts src/lib/intake` at `236a0d8`: 47 files, 646 passed | `npx vitest run src/lib/data/escalation-dispatch.test.ts "src/app/(dashboard)/review/[id]" src/app/api/cron` at `620a040`: 18 files, 502 passed |
| Runtime harness | N/A: pure plan plus db double; no real email and no database was used. The real send is owner walk 15.4 with `APP_BASE_URL` and the Resend key set | N/A here: the `npm run dev` walk of resend, blocked and pending texts needs a migrated database and mail keys (owner phase 15); the cron route is covered with doubles |
| Rollback boundary | `src/lib/escalation/{plan,message}.ts`, `src/lib/mail/`, `src/lib/data/escalamiento.ts`, `outbox.ts`, `env.ts`, the four notice audit builders and the shared-helper edits of `remision.ts`, `remission/{plan,message}.ts` | `escalation-dispatch.ts`, `dispatch-batch.ts`, `escalation/deps.ts`, the cron route, `escalation-actions.ts`, `after-response.ts`, `resend-*.tsx`, the section wiring, `DetailReport.escalamientoId`, the resend keys |

### Gates (S3 head `620a040`, dummy `DATABASE_URL`)

- `npx vitest run src/lib src/app src/i18n`: 212 files, 5048 passed.
- `npm test`: 256 files, 5680 passed.
- `npm run typecheck`: clean.
- `npx eslint src`: 0 problems other than the CRLF `Delete ␍` noise.
- Prettier (`--end-of-line auto`) on every changed file: clean.
- `npm run build`: ok.
- S3a alone (`236a0d8`): `npm test` 253 files / 5580 passed, typecheck clean, eslint and prettier clean before its commit.
- No `drizzle-kit migrate`/`push`, `db:seed`, `neon` command or SQL write run. S3 changes no schema (the outbox columns came with S1). No real email was sent; every test uses the fake mail sender.

### Measured authored lines vs the S2b head 4dd9616

Excluding `openspec/`, `.engram/` and `package-lock.json` (no generated SQL in S3). The 1000 budget counts production (non-test `src/`) plus `i18n/`; tests are reviewed but not counted.

| Slice | Production | i18n | Budget total | Tests (not counted) |
|---|---:|---:|---:|---:|
| S3 combined | 1585 (1332 added, 253 deleted) | 28 | 1613 | 2360 (2333 added, 27 deleted) |
| S3a (unit 5) | 925 (810 added, 115 deleted) | 0 | 925 | 1084 |
| S3b (unit 6, vs S3a) | 660 (522 added, 138 deleted) | 28 | 688 | 1276 |

The combined slice was over 1000, so it split once at the unit boundary (the planned `~700` was an underestimate: the escalation data module and dispatcher are about 460 lines with their comments, and sharing the remission mechanics rewrote about 210 lines of remission code). Both halves are under 1000: no `size:exception`. Deletions are 253 of the production count, mostly the remission code that moved into the shared modules.

### Deviations from design

1. The four notification audit builders (task 7.11, listed under unit 6) landed in the unit 5 commit: the guarded completions of 7.6 write their audit rows and cannot compile without them.
2. The structural write-surface test (7.7) is its own file `escalamiento-writes.test.ts` (pattern of `remision-writes.test.ts`), not a block of `escalamiento.test.ts`. It pins creation (`solicitud-escalation.ts`) and the notification updates (`escalamiento.ts`); the answer module joins its allowed list in S4 (task 10.4).
3. The completions are `completeNoticeSent|Failed|Blocked`, because `remision.ts` already exports `completeSent|Failed|Blocked`.
4. Shared mechanics instead of copied ones: `data/outbox.ts` (claim stamp, lease, release, give-back, guarded completion), `data/dispatch-batch.ts` (per-row loop and summary), `lib/mail/{idempotency-key,one-line}.ts`, `review/[id]/after-response.ts`, `review/[id]/resend-button.tsx`. `remision.ts`, `remission-dispatch.ts`, `remission/{plan,message}.ts`, `remission-actions.ts` and `resend-remission-button.tsx` were edited to use them; their existing suites stayed green without changes (one import line in `remision.test.ts`).
5. The resend control also appears on each absence-report entry (not only in the escalation section), because a report's notice can be `bloqueada` too; `DetailReport` gained `escalamientoId`.
6. The notice dependencies come from a new `getEscalationDeps()` (mail port and `APP_BASE_URL`) instead of `getIntakeDeps()`, so a notice builds no document store and a missing Blob token cannot stop it.
7. The cron route answers a generic 500 after BOTH outboxes ran when either failed (before: any failure was a 500 with only the remission batch run); the success body adds `escalamientos`.
8. The plan returns a third kind, `not_configured`, for an unset `APP_BASE_URL` (the task listed `blocked` and `send`); the dispatcher stores it as `pendiente` with `error_envio` and gives the attempt back, like a missing Resend key.
9. The email copy (subject and body wording) is new institutional text written to the spec's field list; it is flagged for owner review below.

### Issues and notes

- Next.js 16: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md` read before using `after()`. It is supported in Server Functions and, as the doc states, runs even when `redirect` is called, which the actions rely on (schedule, then redirect).
- The claim, lease and "send once under concurrent attempts" guarantee is the same guarded `UPDATE ... RETURNING` as the remission; the unit tests pin its SQL, but it has not run against Postgres (the S5 suite covers the escalation race; a two-claim race on the notice outbox is not in that list).
- Two coordinator accounts that share one email address would put the same address in `to` and `cc`; Resend's behavior for that was not verified.
- The `notificacion_reenviada` audit row is written by `authorizeNoticeResend` before the claim, exactly like `remision.reenviada`; a resend whose claim is then lost (another attempt holds the notice) leaves that row although nothing was sent. The spec says the row is for a resend that attempts a send; the remission precedent was followed.
- `.vitest/json/output.json` is a tracked file that the test runs rewrite; it was never staged. `package-lock.json` and the owner's files stay unstaged and untouched.
- `APP_BASE_URL` is an owner Vercel task (15.3). Until it is set, every notice stays `pendiente` with `not_configured`, visible to the secretary, and the resend control is offered.

### UX observations (for owner decision)

- The resend control is visible on a notice whose first send is still in flight (seconds after an escalation); a click sends nothing (the claim is held, so the dispatch is skipped) but the answer reads "it could not be sent, it stays pending", which is misleading for a send that is in flight. A short delay before offering it, or a "first send in progress" state, would avoid that.
- A resend of a `bloqueada` notice for a career that still has no coordinator with an email answers the same blocked text; the text says to reload but not what to fix (an account with an email for the career). A hint that points to the administrator, as the E17 text does, would close the loop.
- After the automatic-retry cap (8 attempts) a notice still reads "Envío pendiente: el último intento falló", the same as one that will be retried tomorrow; the secretary cannot tell that only a manual resend is left. The attempt count is stored but not shown.
- The notice status pill appears in three places (escalation row, report entry and the En coordinacion queue tab) but the resend control only in the first two; on 360 px each of those entries grew by one control. A blocked notice listed in the queue tab needs a click into the request to be resent.
- The email subject for a suspicion reads "Justifia: solicitud N escalada a coordinación" and for an excess report "Justifia: aviso sobre la solicitud N"; the body wording is mine and the owner (and the UAM legal review of task 16.13) should approve it before production.

### Remaining tasks

- [ ] 8.3 open the S3a PR (base: the S2b branch until S2 merges) and the S3b PR (base: the S3a branch), after the S1 PRs and owner task 0.1; merge into the tracker after review
- Not started by instruction: Phase 9 onward (S4).

### Status

Phases 7 (16 of 16) and 8.1, 8.2 complete; 8.3 waits on the S1 PRs. Cumulative: 27 of 30 S1 tasks + 22 of 23 S2 tasks + 18 of 19 S3 tasks. Ready for sdd-verify of the S3 code (independent of S4), then the S4 apply.
