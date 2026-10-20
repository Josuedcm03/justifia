# Apply Progress: Teacher Remission

> Strict TDD (vitest). Re-sliced into the chain S1 foundation, S2 mail-data, S3 dispatch, S4 review-ui, S5 special-format backend, S6 special-format UI (tracker `feat/teacher-remission` at 907cfa0). All six slices are implemented and committed (top of the chain 9f2b4e3). Units 1-5 were implemented on the former `s1-outbox` branch. Hybrid store: this file plus Engram `sdd/teacher-remission/apply-progress`.
> No database command was run (no `drizzle-kit migrate/push`, no seed, no write SQL, no Neon call). Migration 0009 was only generated locally.

## Status

| Slice | Tasks | State |
|-------|-------|-------|
| S1-S3 (units 1-5) | 1.1-1.6, 2.1-2.8, 3.1-3.5, 4.1-4.10, 5.1-5.3 | Done (31 tasks marked `[x]`), split over S1 (phases 1-2), S2 (phase 3, 4.1-4.6), S3 (4.7-4.10, phase 5) |
| S1 gate stop | 4.11 | PENDING OWNER: needs 0009 on a disposable Neon branch; four separate "yes" answers (create, apply, run, delete) |
| S4 (unit 6) | 6.1-6.3 | Implemented and committed as the first commit of `feat/teacher-remission-s4-review-ui` |
| S4 (unit 7) | 8.1-8.8 | Done and committed (two commits). The upload-error i18n keys of 8.2 moved to S5 (no unused keys in S4) |
| S5 (unit 8, backend) | 9.1-9.6, 9.8 | Done and committed (5 commits); 9.10 gates green on the S5 head, PR not opened |
| S6 (unit 8, UI) | 9.7, 9.9 | Done and committed on `feat/teacher-remission-s6-special-format-ui` (2 commits on the S5 head); gates green, PR not opened |
| Verify | whole change | Ran 2026-10-19 on 9f2b4e3: pass with warnings, 16/16 requirements, 44/44 scenarios, 0 CRITICAL; gates re-run green (`npm test` 229 files, 4,946 tests; typecheck; build; eslint CRLF-only; prettier clean) |
| Remaining (gated) | 4.11, 6.4 and the PR part of 9.10, phase 7, 9.11, phase 10 | No push, no PR yet (six PRs S1-S6). Phase 7 and 9.11 are owner-run. Archive after the PRs merge |

## Delivery and size (chained-pr, work-unit-commits)

Strategy: auto-chain, `feature-branch-chain`, `review_budget_lines = 2000`. Count = additions + deletions of authored text; generated `drizzle/meta/*`, `.engram/` chunks, `package-lock.json` and `openspec/` excluded. The owner rejected any `size:exception`, so the original single S1 (5,391 lines) was re-sliced into four branches (later six, after the S4 and S5 cuts) with identical source (`git diff 50067b0 feat/teacher-remission-s3-dispatch -- src` is empty). Old branches `feat/teacher-remission-s1-outbox` and `feat/teacher-remission-s2-review-ui` were never pushed and were deleted after verification.

| Slice | Branch | Commits | Authored lines |
|-------|--------|---------|---------------:|
| S1 foundation | `feat/teacher-remission-s1-foundation` | schema, migration 0009, audit; pure domain | 1,710 |
| S2 mail and data | `feat/teacher-remission-s2-mail-data` | MailSender, Resend adapter, fake, env; `remision.ts` + `getSolicitudClases` | 1,784 |
| S3 dispatch | `feat/teacher-remission-s3-dispatch` | creation in approval + dispatch + concurrency test + write pin; `after()` in `decideAction` | 1,897 |
| S4 review UI | `feat/teacher-remission-s4-review-ui` | retry cron (359); remission section, resend, dialog mark, i18n (phase 8) | 1,709 measured (`git diff --numstat 06c75d2..HEAD`, excluding `drizzle/meta`, `openspec/`, `.engram/`, `package-lock.json`) |
| S5 special format | `feat/teacher-remission-s5-special-format` | RN-19 upload backend (9.1-9.6, 9.8): token route, `inspectStoredFile`, `attachSpecialFormat`, attach action, student-list exclusion | 1,470 measured (head 734a262) |
| S6 special format UI | `feat/teacher-remission-s6-special-format-ui` | RN-19 upload UI (9.7, 9.9): upload control, section and page wiring, i18n keys, design-system pin | 586 measured (head 9f2b4e3) |

Boundary: `remision-writes.test.ts` scans `remission-dispatch.ts` and `solicitud-decision.ts`, so it ships with S3 (it failed on S2 alone). `.env.example` lines (`RESEND_API_KEY=`, `MAIL_FROM=`) could not be added: the file is outside the apply agent's permissions; the owner adds them with S2.

Each slice branches from the previous one; every PR targets the tracker `feat/teacher-remission`; only the tracker merges to `main`.

## Resend verification (task 3.1)

Context7 was not available in this session (no `resolve-library-id` tool); the official Resend markdown docs were fetched with `curl` (read-only) and read:

| Topic | Finding | URL |
|-------|---------|-----|
| Message size | "Emails can be no larger than 40MB (including attachments after Base64 encoding)"; `attachments` "max 40MB per email, after Base64 encoding". Base64 adds a third: 25 MiB raw is about 35 MB encoded, so the 25 MiB guard stands (no owner stop needed) | https://resend.com/docs/api-reference/emails/send-email , https://resend.com/docs/dashboard/emails/attachments |
| Attachments | `content` is a Base64 string (or buffer) plus `filename`; `content_type` optional (derived from the filename); `path` is the remote alternative. Emails with attachments cannot use the batch endpoint (we send singly) | same |
| Request shape | `POST https://api.resend.com/emails`, `Authorization: Bearer`, JSON `from` (`Name <email>`), `to` (string or array, max 50), `subject`, `cc` array, `text` | https://resend.com/docs/api-reference/emails/send-email |
| Response | `200 { "id": "..." }` | same |
| Idempotency | Header `Idempotency-Key`, unique per request, max 256 chars, kept 24 hours; the same key returns the same response without sending again | https://resend.com/docs/dashboard/emails/idempotency-keys |
| Same key, changed payload | `409 invalid_idempotent_request` (body modified within 24 h). Another request in flight with the key: `409 concurrent_idempotent_requests`. Invalid key length: `400 invalid_idempotency_key` | https://resend.com/docs/api-reference/errors |
| After a failed first attempt | The docs do not say whether a failed first attempt consumes the key. Treated as unknown; the key digest changes with recipient, copy and attachments, so a corrected payload gets a new key | idempotency page (silent) |
| Rate/quota | `429` `rate_limit_exceeded`, `daily_quota_exceeded`, `monthly_quota_exceeded` | errors page |

Adjustment to TR-9/3.2 (not a design.md edit): task 3.2 said "4xx -> rejected". The adapter maps `408`, `409` and `429` to `unavailable` (all clear on a later attempt: lease/key expiry, rate or quota reset) and every other `4xx` to `rejected`. Both leave the row `pendiente` with `error_envio`; only the audit `codigo` differs. No change to the 25 MiB limit or the 20 s timeout.

## TDD Cycle Evidence (Strict TDD)

Safety net: `npx vitest run src/db src/lib/audit` before touching existing files = 14 files, 189/189 passing. Files modified later were covered by the full suite (4,777 passing with unit 6 included, 4,749 after it moved out). Layers: Unit (pure, scripted DB double), Adapter (injected fetch), Component-level route/action tests with `vi.hoisted` mocks. No E2E available.

| Task | Test file (tests) | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-------------------|-------|------------|-----|-------|-------------|----------|
| 1.2/1.3/1.4 | `src/db/migration-teacher-remission.test.ts` (18) | Unit (generated SQL by name) | 189/189 db+audit | Written first | 18/18 after schema + `db:generate` | 18 assertions across tables, CHECK lists vs constants, FKs, indexes, additive-only | Clean |
| 1.5/1.6 | `src/lib/audit/events.test.ts` (70, +14), `types.test.ts` (6) | Unit | 189/189 | Failed first (`remisionCreadaEvent is not a function`, 28 vs 22 action codes) | 228/228 | 7 builders table-driven, creation with/without reason, leak test, existing payloads unchanged | Clean |
| 2.1 | `src/lib/remission/states.test.ts` (9) | Unit | N/A (new) | Written first | 9/9 | 4 triggers, no trigger claims `enviada` | Clean |
| 2.2 | `recipients.test.ts` (9) | Unit | N/A (new) | Written first (import unresolved) | 9/9 | dedupe, null/blank email, mark, gate order, teacherless groups | Clean |
| 2.3 | `limits.test.ts` (5) | Unit | N/A (new) | Written first | 5/5 | at limit ok, +1 byte over, empty | Clean |
| 2.4 | owner decision (no code) | N/A | N/A | N/A | N/A | N/A | N/A |
| 2.5/2.6 | `message.test.ts` (10) | Unit | N/A (new) | Written first | 10/10 | per cause, per teacher isolation, single/multi-day, header-injection guard | removed an unused eslint-disable |
| 2.7/2.8 | `plan.test.ts` (16) | Unit | N/A (new) | Written first | 16/16 | gate order, at/over limit, marked/unmarked selection, key stable/changing | Clean |
| 3.1 | docs verification | N/A | N/A | N/A | Recorded above | N/A | N/A |
| 3.2/3.3 | `resend-mail-sender.test.ts` (22) | Adapter (fake fetch) | N/A (new) | Failed first (module not found) | 22/22 | 4xx, retryable 4xx, 5xx, network, timeout, config, no provider text | Clean |
| 3.4 | `fakes.test.ts` (9, +5), `deps.test.ts` (5, +2) | Unit | existing tests green | Failed first (6 failing) | green | dedupe by key, scripted failure and recovery, deps without mail env | Clean |
| 3.5 | `src/env.test.ts` (5, +2) | Unit | 3/3 | Failed first (value undefined) | 5/5 | set and unset | Clean |
| 4.1 | `solicitud-clases.test.ts` (12, +6) | Unit (DB double) | 6/6 | Failed first | 12/12 | merge, null email, null teacher, empty | Clean |
| 4.2 | `decision-validation.test.ts` (25, +5) | Unit | 20/20 | Failed first | 25/25 | approve ok, unmarked unchanged, reject/return refused | Clean |
| 4.3/4.4 | `solicitud-decision.test.ts` (39, +12, 4 adjusted) | Unit (DB double) | 27/27 | 14 failing first | 39/39 | one/two teachers, same-teacher merge, no email, marked, other cause rollback, reject/return none, audit/insert failure | Prettier re-indent of the `try` wrapper |
| 4.5/4.6 | `remision.test.ts` (34) | Unit (DB double, SQL rendered) | N/A (new) | Failed first (module not found) | 34/34 | 4 triggers x states, lease cutoff, stale completion, unblock, selector, loaders | Test dates asserted as ISO strings |
| 4.7/4.8 | `remission-dispatch.test.ts` (26) | Unit (fake store + fake mail) | N/A (new) | Written first | 26/26 | success, 2 failures, blockers, size guard before download, missing blob, resend refresh, skipped, lost, actor, containment | Id-ordered attachments fixed after a failing triangulation test |
| 4.9 | `remision-writes.test.ts` (4) | Structural pin | N/A | Detection cases fail for a wrong pattern | 4/4 | insert/update/delete/raw SQL shapes | Characterization pin like `inscripcion-writes` (passes on arrival) |
| 4.10 | `intake-concurrency.integration.test.ts` (+2 cases) | Real Postgres, opt-in | N/A | Written | NOT RUN (4.11 stop) | 2 and 6 parallel dispatches | N/A |
| 5.1/5.2 | `actions.test.ts` (46, +13) | Unit (hoisted mocks) | 33/33 | 7 failing first | 46/46 | schedule once, actor captured, deps inside callback, marked/unmarked redirect, no schedule for reject/return/conflict, mail failure contained | Clean |
| 5.3 | gates | | | | See Gates | | |

### Test Summary
- Tests written in S1 (files above): 376 tests across the 20 touched or new test files, all passing. Final S1 suite: 221 files, 4,749 tests passing.
- Layers: Unit, Adapter (injected fake `fetch`), structural pin, hoisted-mock route/action tests; 1 opt-in integration test written, not run.
- Pure functions created: states, recipients, limits, message, plan and the digest.

### S4 additions (unit 7, Strict TDD)

Safety net before touching existing files: `npx vitest run "src/app/(dashboard)/review" src/i18n src/lib/data/remision.test.ts` = 14 files, 506/506 passing.

| Task | Test file (tests added) | Layer | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-------------------------|-------|-----|-------|-------------|----------|
| 8.2 | `src/i18n/review-messages.test.ts` (+4) | Unit (catalogs) | 4 failing (undefined `review.remission`) | 264/264 after keys in es and en | es and en; every state and reason from the constants | Label `sentAt` renamed after a name clash found by the section test |
| 8.3/8.4 (data) | `src/lib/data/remision.test.ts` (+3, `authorizeResend`) | Unit (DB double) | 3 failing (`authorizeResend is not a function`) | 41/41 | pending-before, `enviada` (no audit), unknown/out-of-scope (no audit) | Clean |
| 8.3/8.4 | `remission-actions.test.ts` (21, new) | Unit (hoisted mocks, real dal) | Written first (module missing) | 21/21 | 7 roles, malformed ids, scope none, unknown id, 6 outcomes mapped, no revalidate/redirect, thrown error not leaked | Clean |
| 8.5 | `resend-remission-button.test.tsx` (7, new) | Component | Written first | 7/7 | pending disabled, sent removes control, pendiente/bloqueada keep it, two refusals | Outcome region kept mounted (`role=status`) |
| 8.5/8.6 | `remission-section.test.tsx` (10, new); `page.test.tsx` (+5) | Component and page | 1 + 2 failing first | 10/10; page 59/59 | two teachers, Managua time (03:30Z is the 18th), Reenviar rules, 4 reasons x es/en, no alert when pending, teacherless groups, missing email; page: approved only, load order before the audited read, 3 other states | Nested `li` queries fixed in the test |
| 8.7 | `decision-dialog.test.tsx` (+9); `actions.test.ts` (+5); `page.test.tsx` (+2) | Component and action | 3 + 4 failing first | 35/35, 51/51, 61/61 | fuerza_mayor vs 3 other causes, reject/return, no file input, payload with and without mark, reset on cancel; action: mark kept, absent, refused on reject/return, non-boolean | The page `causa` passthrough was written with the action edit, before the page-level test (two-case test confirms it) |
| 8.8 | `design-system.test.tsx` (+6) | Component (class-level, as the file does) | n/a: pins | 33/33 | 3 pills, card + 360 px single column, alert pattern, 44 px outline button, 44 px checkbox row | Expected `border-border` corrected to `border-primary` (outline variant) |

Tests written in S4: 66 (plus the cron's). Full suite at S4 head: 226 files, 4,850 tests passing.

## Work Unit Evidence

| Unit | Focused test command and result | Runtime harness | Rollback boundary |
|------|---------------------------------|-----------------|-------------------|
| 1 | `npx vitest run src/db src/lib/audit src/lib/remission`: 16 files, 228 passed | N/A: the SQL is read by tests, `db:generate` is local only, nothing applied | `src/db/schema.ts`, `drizzle/0009_teacher_remission.sql`, `drizzle/meta/*`, `src/lib/audit/{types,events}*.ts`, `src/lib/remission/states*` (unapplied, no DB effect) |
| 2 | `npx vitest run src/lib/remission`: 5 files, 49 passed | N/A: pure functions | `src/lib/remission/` |
| 3 | `npx vitest run src/lib/intake src/env.test.ts src/app/api/intake`: 30 files, 332 passed | Manual Resend send with a test key: NOT run (needs the owner's key and the UAM IT domain) | Adapter, port, fake, deps, env, `src/lib/intake/adapters/resend-mail-sender*` |
| 4 | `npx vitest run src/lib/data`: 34 files, 731 passed | Opt-in `npm run test:integration` (concurrent claim): NOT run, task 4.11 STOP (needs 0009 on a disposable Neon branch) | `src/lib/data/{remision,remission-dispatch,remision-writes,solicitud-clases,solicitud-decision}*`, `decision-validation*`, integration fixtures/test |
| 5 | `npx vitest run "src/app/(dashboard)/review"`: 8 files, 212 passed | `npm run dev` approve flow: NOT run (the `Remision` table does not exist until 0009 is applied; no DB change allowed). `npm run build` compiled the action | `src/app/(dashboard)/review/[id]/actions.ts` and its test |
| 7 (S4) | `npx vitest run "src/app/(dashboard)/review" src/i18n src/lib/data/remision.test.ts src/lib/data/remision-writes.test.ts`: 18 files, 560 passed (579 after the dialog and design pins) | `npm run dev` walk at 1280 and 360 px: NOT run (needs 0009 applied on a disposable branch, task 9.11 and 4.11). `npm run build` compiled; `/review/[id]` stays dynamic | `remission-section.tsx`, `resend-remission-button.tsx`, `remission-actions.ts`, `authorizeResend` in `remision.ts`, page wiring, dialog mark and `actions.ts` payload, i18n keys |
| 6 (S4) | `npx vitest run src/app/api/cron`: 3 files, 39 passed | `next start` then `curl` the routes: no header and a wrong secret on `/api/cron/remission-retry` returned `401 {"error":"unauthorized"}`; `/api/cron/intake-sweep` without header `401`. The valid-secret call was not run (it reads `Remision`, not migrated) | `src/app/api/cron/{scheduler-auth*,remission-retry/*}`, `intake-sweep/route.ts`, `vercel.json` |

## Gates (S1, after the move of unit 6)

| Gate | Command | Result |
|------|---------|--------|
| Tests | `npm test` | 221 files, 4,749 tests passed |
| Types | `npm run typecheck` | clean (after `rm -rf .next/types`: stale generated validators from other branches broke `tsc`/`next build` before any change of mine) |
| Lint | `npx eslint src \| rg -v 'Delete .␍.'` | no errors or warnings other than the CRLF noise |
| Format | `npx prettier --check --end-of-line auto src vercel.json` | clean. `npm run format:check` as such fails on every CRLF working-tree file (pre-existing, environment noise) |
| Build | `npm run build` | compiled; S1 has no new route |
| DB | none | no database command was run |

## Gates (S4 head)

| Gate | Command | Result |
|------|---------|--------|
| Tests | `npm test` | 226 files, 4,850 tests passed |
| Types | `npm run typecheck` | clean |
| Lint | `npx eslint src`, lines other than the CRLF `Delete ␍` noise | none |
| Format | `npx prettier --check --end-of-line auto src i18n vercel.json` | clean |
| Build | `npm run build` | compiled |
| DB | none | no database command was run |

Evidence revision (code head `6c91838`): sha256 of `git diff 06c75d2..6c91838` = `ab1a88561eface573ea706aa72e65582568f21619f897f0dc28c968236527871`. The final head also carries this documentation commit; its hash is reported to the orchestrator.

## S5 additions (unit 8 backend, Strict TDD)

Branch `feat/teacher-remission-s5-special-format` from d488171. Measured 1,470 authored lines vs d488171 (`git diff --numstat`, excluding drizzle/meta, openspec, .engram, package-lock.json, .env.example). The upload UI (9.7: component, i18n es/en, section and page wiring, ~540 lines) was written and then moved to S6 because S5 would have reached ~2,010 before the 9.9 pin; no code was shrunk to fit. Until S6 merges there is still no upload control, so a marked approval stays blocked.

| Task | Test file (tests) | Layer | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-------------------|-------|-----|-------|-------------|----------|
| 9.1 | `documentos.test.ts` (+7) | Unit (fake store) | 7 failing (`inspectStoredFile` missing); 45 existing green | 52/52 | pdf/png/jpeg, empty, forged, 10 MiB edge, not_found, store failure | `finalizeDocument` now uses it; existing tests unchanged |
| 9.2/9.3 | `special-format.test.ts` (21, new) | Unit (DB double, fake store) | Written first (module missing) | 21/21 | 2 types, name fallback, denied, 3 bad pathnames, referenced file kept, race, already_attached, unique violation, 2 refusals, blob delete failure, not_found, store failure | Clean |
| 9.4/9.5 | `api/review/special-format-token/route.test.ts` (16, new) | Route (hoisted mocks) | Failed first (module missing) | 16/16 | 401, 403, 6 roles, bad JSON, token limits, no callback, 4 pathnames, neighbour id, scope none, null context, SDK error | Test for a neighbouring id corrected (id comes from the pathname) |
| 9.6 | `remission-actions.test.ts` (+25) | Action | 24 failing first | 46/46 | 6 roles, malformed input, mapped outcomes, after() once, nothing scheduled, scheduling failure contained, attach throw | `scheduleDispatch` split out after a failing test |
| 9.8 | `solicitud-detail.test.ts` (+2), `student-requests.test.ts` (+1) | Unit (DB double) | 4 failing first | 36/36 | marked with format, unmarked | Clean |

Gates at S5 head 0ef2afd: `npm test` 228 files, 4,922 tests passed; `npm run typecheck` clean; `npx eslint src` only the CRLF `Delete` noise; `npx prettier --check --end-of-line auto src i18n vercel.json` clean; `npm run build` compiled (`/api/review/special-format-token` dynamic). No database command run.

Decisions: (1) token route answers 403 only for `debeCambiarClave`; every non-reviewer role gets the uniform `400 not_allowed` (spec reading); (2) action denials are all `not_allowed`, `not_found` means the stored file is missing; (3) a file already referenced by any document row is never deleted by the attach (student evidence), and a unique-violation backstop keeps the file; (4) "marked + format sends only the format" is covered at dispatch level by the existing `remission-dispatch.test.ts`, not duplicated in the action test; (5) i18n RED for the upload keys was written before the keys but not executed on its own.

## S6 additions (unit 8 UI, Strict TDD)

Branch `feat/teacher-remission-s6-special-format-ui` from the S5 head 734a262 (the UI commit was re-applied with cherry-pick because the unrelated working-tree changes blocked `git rebase`). Measured 586 authored lines vs 734a262 (same exclusions).

| Task | Test file (tests) | Layer | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-------------------|-------|-----|-------|-------------|----------|
| 9.7 | `special-format-upload.test.tsx` (14, new); `remission-section.test.tsx` (+3); `page.test.tsx` (+3); `review-messages.test.ts` (+2 cases) | Component, page, catalogs | Written first (module missing; page tests broke when two existing i18n keys were removed by mistake, then restored) | 589/589 on review + i18n | refused empty/oversize/type, 4 server answers, store refusal, es alert, attached format, marked/unmarked/with format on the page | Clean |
| 9.9 | `design-system.test.tsx` (+2) | Component (class-level pins, as 8.8) | n/a: pins, pass on arrival | 35/35 | button 44 px + full width at 360 px, hidden input, catalog alert, attached link wraps | Clean |

Gates at the S6 head: `npm test` 229 files, 4,946 tests passed; typecheck clean; eslint only the CRLF `Delete` noise; prettier `--end-of-line auto` clean; `npm run build` compiled. No database command run. 9.10 PRs and 9.11 owner walk remain.

## Deviations and decisions

1. **Re-sliced into four PRs** (no size exception): unit 6 (cron) is the first commit of S4, see Delivery.
2. **Marked approval does not schedule `after()`**: every row is born `bloqueada` (`sin_correo` or `formato_especial_faltante`), and `aprobacion` can claim only `pendiente`, so a dispatch would be a provable no-op. Tasks 5.1 says `after()` on every `aprobada` success; this skips only the marked case. The format upload (S2) dispatches the unblocked rows. Also skipped when the approval created no remission.
3. **`not_configured` gives the attempt back** (`Intentos - 1`): otherwise rows would burn the automatic-attempt cap (8) while the mail env is unset, and the cron would never take over after the rollout. Not in the design; pinned by `remision.test.ts`.
4. **Message wording**: "por motivos {causa}" (the shared `CAUSE_PHRASES` read as "motivos ..."), not the design's "por {causa}". Subject, `RN18_WARNING`, `RN18_DISCRETION_NOTE` and the closing are verbatim from TR-10.
5. **4xx mapping** in the adapter, see Resend verification.
6. **Completions build their own audit events** in `remision.ts` (same transaction), and `dispatchRemission` returns an outcome (`sent`, `failed`, `blocked`, `skipped`, `lost`) for the S2 resend action. Missing approving secretary or request data throws `remission_actor_missing` / `remission_request_missing`: the claim is left to expire and the retry runs again; contained by `dispatchRemissions`.
7. **Payload of `decideAction` is unchanged** in S1: the zod schema strips `formatoEspecial`, so the mark cannot be sent until the S2 dialog and passthrough (task 8.7). The backend path (validation, rollback for another cause, blocked rows, redirect to the detail) is complete and tested.
8. **`.env.example` not updated** (task 3.5): the file is outside the apply agent's permissions. The owner adds `RESEND_API_KEY=` and `MAIL_FROM=` lines.
10. **S4 cut (no size exception)**: after unit 7 the S4 diff is 1,709 of 2,000 lines and unit 8 (RN-19 upload) is ~1,200, so unit 8 moved to S5 (and its UI later to S6). Until S6 merges, a marked approval stays blocked with `formato_especial_faltante` and the detail shows that reason; the mark is reachable from the dialog now.
11. **Resend authorization**: `authorizeResend` (in `remision.ts`) joins the request and applies `requestInScope`, so an unknown id and an out-of-scope id give the same `null`; it writes `remision.reenviada` (state before the attempt) only when the remission is not `enviada`. Its audit row is committed before the send, so a resend that finds the claim held still leaves the row.
12. **Resend outcome**: the action returns `{ ok, estado, motivo }` (not only `estado`) so the control can say what happened without revalidating the page (SR-11). `skipped` and `lost` map to `pendiente`.
13. **Student views**: the section is built only in `review/[id]/page.tsx` (staff, `requireRole(...rolesRevisores)`); the student detail and list do not import `listRemissions`, so the teacher email never reaches them.
14. Task 1.4: the journal `when` (1792429485555) is later than 0008's (1791852138908); comparison with Neon's last applied `created_at` was not done (would need a read-only DB query).

## Risks

- Every slice is within 2,000 lines, all measured (largest S3 at 1,897; S5 1,470; S6 586).
- Gates were run per slice (typecheck + focused tests); `npm test` at the S3 head: 221 files, 4,749 tests (one unrelated flaky catalog import-form test failed once under load and passed on rerun); at the S4 head: 226 files, 4,850 tests.
- The concurrency test and the real mail send are unproven until the owner runs 4.11 and the Resend domain exists.
- With S4: the dialog marks an approval and the cron plus "Reenviar" retry pending remissions. Until S6 merges there is no upload control, so a marked approval stays blocked.
- `.env.example` shows as modified in the working tree; it is not part of any commit of this apply. The owner commits the `RESEND_API_KEY=` and `MAIL_FROM=` lines on S2 (task 3.5) and confirms the file holds exactly those lines before the mail rollout.
- `after()` is cut off at the function duration; the 10-minute lease plus the daily cron (S2) are the recovery path.

## Remaining

- 4.11 (owner confirmations, then the opt-in integration run on a disposable Neon branch).
- 6.4 and the PR part of 9.10: open the six chain PRs S1-S6 to the tracker (gates already green on the S6 head).
- Phase 7 (owner-run migration 0009 and mail rollout) and 9.11 (owner walk on a disposable branch).
- `.env.example` mail vars (`RESEND_API_KEY=`, `MAIL_FROM=`): pending commit on S2 by the owner.
- Phase 10: spec sync, roadmap, archive.
