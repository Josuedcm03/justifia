# Apply Progress: Teacher Remission

> Strict TDD (vitest). Re-sliced into the chain S1 foundation, S2 mail-data, S3 dispatch, S4 review-ui (tracker `feat/teacher-remission` at 907cfa0). Units 1-5 were implemented on the former `s1-outbox` branch. Hybrid store: this file plus Engram `sdd/teacher-remission/apply-progress`.
> No database command was run (no `drizzle-kit migrate/push`, no seed, no write SQL, no Neon call). Migration 0009 was only generated locally.

## Status

| Slice | Tasks | State |
|-------|-------|-------|
| S1-S3 (units 1-5) | 1.1-1.6, 2.1-2.8, 3.1-3.5, 4.1-4.10, 5.1-5.3 | Done (31 tasks marked `[x]`), split over S1 (phases 1-2), S2 (phase 3, 4.1-4.6), S3 (4.7-4.10, phase 5) |
| S1 gate stop | 4.11 | PENDING OWNER: needs 0009 on a disposable Neon branch; four separate "yes" answers (create, apply, run, delete) |
| S4 (unit 6) | 6.1-6.3 | Implemented and committed as the first commit of `feat/teacher-remission-s4-review-ui` |
| Not started | 6.4, phases 7-10 | 6.4 (open PRs) not done: no push, no PR. Phase 7 is owner-run. Phases 8-9 (S4 UI and upload) and archive remain |

## Delivery and size (chained-pr, work-unit-commits)

Strategy: auto-chain, `feature-branch-chain`, `review_budget_lines = 2000`. Count = additions + deletions of authored text; generated `drizzle/meta/*`, `.engram/` chunks, `package-lock.json` and `openspec/` excluded. The owner rejected any `size:exception`, so the original single S1 (5,391 lines) was re-sliced into four branches with identical source (`git diff 50067b0 feat/teacher-remission-s3-dispatch -- src` is empty). Old branches `feat/teacher-remission-s1-outbox` and `feat/teacher-remission-s2-review-ui` were never pushed and were deleted after verification.

| Slice | Branch | Commits | Authored lines |
|-------|--------|---------|---------------:|
| S1 foundation | `feat/teacher-remission-s1-foundation` | schema, migration 0009, audit; pure domain | 1,710 |
| S2 mail and data | `feat/teacher-remission-s2-mail-data` | MailSender, Resend adapter, fake, env; `remision.ts` + `getSolicitudClases` | 1,784 |
| S3 dispatch | `feat/teacher-remission-s3-dispatch` | creation in approval + dispatch + concurrency test + write pin; `after()` in `decideAction` | 1,897 |
| S4 review UI | `feat/teacher-remission-s4-review-ui` | retry cron (359 measured); UI and RN-19 upload (phases 8-9, not started, ~1,300 estimated) | ~1,660 estimated |

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

## Work Unit Evidence

| Unit | Focused test command and result | Runtime harness | Rollback boundary |
|------|---------------------------------|-----------------|-------------------|
| 1 | `npx vitest run src/db src/lib/audit src/lib/remission`: 16 files, 228 passed | N/A: the SQL is read by tests, `db:generate` is local only, nothing applied | `src/db/schema.ts`, `drizzle/0009_teacher_remission.sql`, `drizzle/meta/*`, `src/lib/audit/{types,events}*.ts`, `src/lib/remission/states*` (unapplied, no DB effect) |
| 2 | `npx vitest run src/lib/remission`: 5 files, 49 passed | N/A: pure functions | `src/lib/remission/` |
| 3 | `npx vitest run src/lib/intake src/env.test.ts src/app/api/intake`: 30 files, 332 passed | Manual Resend send with a test key: NOT run (needs the owner's key and the UAM IT domain) | Adapter, port, fake, deps, env, `src/lib/intake/adapters/resend-mail-sender*` |
| 4 | `npx vitest run src/lib/data`: 34 files, 731 passed | Opt-in `npm run test:integration` (concurrent claim): NOT run, task 4.11 STOP (needs 0009 on a disposable Neon branch) | `src/lib/data/{remision,remission-dispatch,remision-writes,solicitud-clases,solicitud-decision}*`, `decision-validation*`, integration fixtures/test |
| 5 | `npx vitest run "src/app/(dashboard)/review"`: 8 files, 212 passed | `npm run dev` approve flow: NOT run (the `Remision` table does not exist until 0009 is applied; no DB change allowed). `npm run build` compiled the action | `src/app/(dashboard)/review/[id]/actions.ts` and its test |
| 6 (S2) | `npx vitest run src/app/api/cron`: 3 files, 39 passed | `next start` then `curl` the routes: no header and a wrong secret on `/api/cron/remission-retry` returned `401 {"error":"unauthorized"}`; `/api/cron/intake-sweep` without header `401`. The valid-secret call was not run (it reads `Remision`, not migrated) | `src/app/api/cron/{scheduler-auth*,remission-retry/*}`, `intake-sweep/route.ts`, `vercel.json` |

## Gates (S1, after the move of unit 6)

| Gate | Command | Result |
|------|---------|--------|
| Tests | `npm test` | 221 files, 4,749 tests passed |
| Types | `npm run typecheck` | clean (after `rm -rf .next/types`: stale generated validators from other branches broke `tsc`/`next build` before any change of mine) |
| Lint | `npx eslint src \| rg -v 'Delete .␍.'` | no errors or warnings other than the CRLF noise |
| Format | `npx prettier --check --end-of-line auto src vercel.json` | clean. `npm run format:check` as such fails on every CRLF working-tree file (pre-existing, environment noise) |
| Build | `npm run build` | compiled; S1 has no new route |
| DB | none | no database command was run |

## Deviations and decisions

1. **Re-sliced into four PRs** (no size exception): unit 6 (cron) is the first commit of S4, see Delivery.
2. **Marked approval does not schedule `after()`**: every row is born `bloqueada` (`sin_correo` or `formato_especial_faltante`), and `aprobacion` can claim only `pendiente`, so a dispatch would be a provable no-op. Tasks 5.1 says `after()` on every `aprobada` success; this skips only the marked case. The format upload (S2) dispatches the unblocked rows. Also skipped when the approval created no remission.
3. **`not_configured` gives the attempt back** (`Intentos - 1`): otherwise rows would burn the automatic-attempt cap (8) while the mail env is unset, and the cron would never take over after the rollout. Not in the design; pinned by `remision.test.ts`.
4. **Message wording**: "por motivos {causa}" (the shared `CAUSE_PHRASES` read as "motivos ..."), not the design's "por {causa}". Subject, `RN18_WARNING`, `RN18_DISCRETION_NOTE` and the closing are verbatim from TR-10.
5. **4xx mapping** in the adapter, see Resend verification.
6. **Completions build their own audit events** in `remision.ts` (same transaction), and `dispatchRemission` returns an outcome (`sent`, `failed`, `blocked`, `skipped`, `lost`) for the S2 resend action. Missing approving secretary or request data throws `remission_actor_missing` / `remission_request_missing`: the claim is left to expire and the retry runs again; contained by `dispatchRemissions`.
7. **Payload of `decideAction` is unchanged** in S1: the zod schema strips `formatoEspecial`, so the mark cannot be sent until the S2 dialog and passthrough (task 8.7). The backend path (validation, rollback for another cause, blocked rows, redirect to the detail) is complete and tested.
8. **`.env.example` not updated** (task 3.5): the file is outside the apply agent's permissions. The owner adds `RESEND_API_KEY=` and `MAIL_FROM=` lines.
9. Task 1.4: the journal `when` (1792429485555) is later than 0008's (1791852138908); comparison with Neon's last applied `created_at` was not done (would need a read-only DB query).

## Risks

- Every slice is within 2,000 lines (S4 is an estimate until phases 8-9 are written; if it passes 2,000, cut unit 8 into an S5).
- Gates were run per slice (typecheck + focused tests) and `npm test` at the S3 head: 221 files, 4,749 tests (one unrelated flaky catalog import-form test failed once under load and passed on rerun).
- The concurrency test and the real mail send are unproven until the owner runs 4.11 and the Resend domain exists.
- Until S2: a request marked special-format cannot be created from the UI (no checkbox), and nothing retries or resends a pending remission (cron is on the S2 branch; resend UI is S2).
- `after()` is cut off at the function duration; the 10-minute lease plus the daily cron (S2) are the recovery path.

## Remaining

- 4.11 (owner confirmations and integration run), 6.4 (open the S1 PR to the tracker once the size decision is made), phase 7 (owner-run migration), S2 phases 8-9, archive phase 10.
