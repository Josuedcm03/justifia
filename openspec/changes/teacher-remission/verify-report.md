```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:7d86bf238429cb7ee8a58ac925050cffa7198357906170bd17b9e9e816d96049
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 16/16
scenarios: 44/44
test_command: npm test
test_exit_code: 0
test_output_hash: sha256:80840f1ea0d1b8897ba7950cbff58e59f0957f222cb730a596888804de8e544d
build_command: npm run build
build_exit_code: 0
build_output_hash: sha256:95482ef715186f52f3d0ed449547c4cf0d39335abd205fe6bfb038fe7148cc6b
```

## Verification Report

**Change**: teacher-remission (whole change, slices S1-S6; diff `907cfa0..9f2b4e3`)
**Mode**: Strict TDD (vitest)
**Revision**: branch `feat/teacher-remission-s6-special-format-ui` @ 9f2b4e3 (top of the chain off tracker `feat/teacher-remission` @ 907cfa0). `evidence_revision` is the sha256 of `git diff 907cfa0 9f2b4e3`. The working tree carries only the unrelated uncommitted `.env.example` and `package-lock.json` changes (not read, staged or reverted). Verified 2026-10-19.

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 65 (Phases 1-10) |
| Tasks complete | 52 checked |
| Tasks incomplete | 13 |

Incomplete tasks, all deliberately gated and outside the code scope of this verify (reported as gated, not as failures):
- 4.11 STOP [CONFIRM]: Neon integration/concurrency run on a disposable branch, owner-confirmed per command.
- 6.4 and the PR-opening part of 9.10: PRs not yet opened. The 9.10 gates themselves were run in this verify and are green (see below).
- 7.1-7.6 (Phase 7): production migration 0009 and mail rollout (UAM IT DNS). 0009 is generated and NOT applied anywhere.
- 9.11 [CONFIRM]: owner walk on a disposable Neon branch.
- 10.1-10.3 (Phase 10): spec sync, roadmap, archive. Run after this verify.

All code, test and doc tasks of Phases 1-6 (except 4.11, 6.4), 8 and 9.1-9.9 are checked and match the code state (every referenced file exists; no checked task claims work absent from the diff).

### Build & Tests Execution
All gates were run with `DATABASE_URL=postgres://u:p@127.0.0.1:9/x` (non-routable placeholder), one at a time. No database command was run (no migrate/push/seed/Neon call).
- `npm test` (vitest run): exit 0, 229 files, 4946 passed / 0 failed / 0 skipped, 157 s. Matches the apply-progress claim (229 files, 4,946).
- `rm -rf .next/types` then `npx next typegen`: exit 0. (Without typegen, `tsc` fails only on the generated `LayoutProps` global after the stale directory is removed; an environment effect, not a code defect.)
- `npm run typecheck` (tsc --noEmit): exit 0, no errors.
- `npm run build`: exit 0. New dynamic routes `/api/cron/remission-retry` and `/api/review/special-format-token` are present; `/review/[id]` stays dynamic.
- `npx eslint src`: exit 1 only because of 86,595 CRLF `Delete` messages (known Windows gotcha); 0 other errors, 0 warnings after filtering.
- `npx prettier --check --end-of-line auto src i18n vercel.json`: clean.
- Coverage: not available (no tool configured).
- Integration suite (`npm run test:integration`) NOT run by instruction (no database access). The two new real-Postgres cases (2 and 6 parallel dispatches of one row) are written and never executed (task 4.11 gate).

`test_output_hash` and `build_output_hash` are the sha256 of the captured stdout+stderr of each run (the build output includes timings, so it is not reproducible byte for byte).

### Size per slice
Authored lines = additions + deletions, excluding `drizzle/meta`, `openspec`, `.engram`, `package-lock.json`, `.env.example`.

| Slice | Range | Added | Deleted | Total | <= 2000 |
|-------|-------|------:|--------:|------:|---------|
| S1 foundation | 907cfa0..f24a162 | 1708 | 2 | 1710 | Yes |
| S2 mail and data | f24a162..a7b51f0 | 1779 | 5 | 1784 | Yes |
| S3 dispatch | a7b51f0..06c75d2 | 1813 | 84 | 1897 | Yes |
| S4 review UI | 06c75d2..d488171 | 1680 | 29 | 1709 | Yes |
| S5 special format backend | d488171..734a262 | 1455 | 15 | 1470 | Yes |
| S6 special format UI | 734a262..9f2b4e3 | 584 | 2 | 586 | Yes |

The largest slice is S3 at 1,897. Every number matches the apply-progress and tasks.md tables (tasks.md quotes S5 as 1,455, the added figure; the total is 1,470). Whole change: 74 source, i18n and config files, +9,015 / -133 authored.

### TDD Compliance
| Check | Result | Details |
|-------|--------|---------|
| TDD evidence reported | OK | apply-progress has the canonical `TDD Cycle Evidence` table (S1-S3) plus S4, S5, S6 tables with RED/GREEN/TRIANGULATE/REFACTOR columns |
| All tasks have tests | OK | every behavior task has a test file; 36 test files touched; 2.4 and 3.1 are decision/docs tasks by nature |
| RED confirmed (tests exist) | OK | every referenced test file exists; RED outcomes recorded ("module not found", "N failing") |
| GREEN confirmed (tests pass) | OK | all referenced files pass in the full run, 4946/4946 |
| Triangulation adequate | OK | table-driven or multi-case (4 triggers x states, 6 roles, per-cause warnings, 3 file types, 4 server answers, es/en) |
| Safety net for modified files | OK | safety-net counts recorded for modified modules (189/189 db+audit, 33/33, 27/27, 506/506 ...) |

**TDD Compliance**: 6/6 checks passed, with the caveats in WARNINGs 5 and 6 (pins that pass on arrival, one i18n RED not executed alone).

### Test Layer Distribution
| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit (pure, DB-double, adapter with fake fetch) | majority of the change | about 24 of the 36 touched | vitest |
| Component, page, action, route (Testing Library, hoisted mocks) | review UI, actions, token and cron routes, design-system pins | about 12 of the 36 touched | vitest, Testing Library |
| Integration (real Postgres, opt-in) | 2 new cases (it.each over 2 and 6 parallel dispatches) | 1 | vitest, disposable Neon branch (NOT run) |
| E2E | 0 | 0 | not installed (owner walk 9.11 pending) |
| **Total (whole repo)** | **4946** | **229** | |

### Assertion Quality
Scan of the 36 touched test files: no tautologies, no `toBeDefined`/`not.toBeNull` used alone (7 occurrences, all next to value assertions), no assertion-free tests. Loops: `message.test` iterates `Object.keys(CAUSE_PHRASES)` and a fixed list (never empty); `states.test` iterates the trigger constant; the loops at `design-system.test` line 187 and `page.test` line 339 predate this change (git blame) and run over non-empty fixtures; the integration loops iterate the losers of a fixed 2/6-way race.
- The design-system pins assert CSS classes by project convention (`docs/design-system.md` pins, as in secretary-review).
- The data-layer tests are DB-double based (SQL shape and call order, not execution).

**Assertion quality**: 0 CRITICAL, 2 WARNING (class-level pins and mock-heavy DB doubles; both project conventions, see WARNING 6).

### Spec Compliance Matrix
Totals: 16 requirements, 44 scenarios (teacher-remission 9/24, request-review 4/13, audit-log 3/7), equal to the count of `### Requirement:` and `#### Scenario:` headings. A scenario is COMPLIANT when a covering test passed in this run.

| Requirement (capability) | Scenarios | Covering tests | Result |
|---|---|---|---|
| One remission per teacher at approval (TR) | two groups same teacher, several teachers, mail down at approval, later email change (4) | `solicitud-decision.test` (inserts one pending remission per distinct teacher with the snapshot; one remission when two groups share a teacher; rolls back when remission insert or audit fails), `actions.test` (a mail failure never changes the outcome: rejects inside after(), deps cannot be built, after() cannot schedule), `remission-dispatch.test` (provider failures leave pendiente; not_configured) | COMPLIANT x4 (email snapshot proven at insert-values level, see WARNING 10) |
| Message content and recipients (TR) | per-teacher groups (1) | `message.test` (per-teacher groups, cause phrase, CIF, both warnings per cause, student CC, header-injection guard), `plan.test`, `remission-dispatch.test` (sends once with the student in copy) | COMPLIANT x1 |
| Send after commit, idempotent, no double send (TR) | success, concurrent attempts, sent never resent by retry, unauthenticated retry job (4) | `remission-dispatch.test` (completes as enviada with provider id and time; claim matching no row sends nothing and writes no audit), `remision.test` (guarded claim; takeover only of an expired 10 min lease; stale worker writes nothing; `enviada` never claimed; selector oldest first, limit, attempt cap), `remission-retry/route.test` (401 without and with wrong secret, fails closed without a secret, dispatches only due rows, counts only), `scheduler-auth.test`, `resend-mail-sender.test` | COMPLIANT x4 (concurrent attempts at DB-double level only, see WARNING 1) |
| Missing teacher email blocks the remission (TR) | no email (1) | `recipients.test`, `solicitud-decision.test` (blocks sin_correo and audits the reason), `remission-dispatch.test` (blocks sin_correo without reading or sending; manual resend refreshes a now-set email and keeps the blocker otherwise) | COMPLIANT x1 |
| RN-19 special-format gate (TR) | marked without format, format uploaded after block, unmarked request, mark on another cause (4) | `plan.test` (gate order; marked with format sends only the format; unmarked excludes staff uploads), `remission-dispatch.test` (RN-19 selection end to end: only the staff format is sent; a staff upload of an unmarked request is never sent; marked without format is blocked), `solicitud-decision.test` (mark creates rows `formato_especial_faltante`; refused on another cause with state untouched and nothing created; refused on rejection), `decision-validation.test` | COMPLIANT x4 |
| Special-format upload by the secretary (TR) | upload from detail after marked approval, other blockers survive, invalid file, unauthorized or out-of-scope, unmarked or undecided, second upload, not in the student list (7) | `special-format.test` (accepted: lock, insert, unblock and audit in one tx; refused file deleted with `documento.rechazado`; denial writes nothing; already_attached by lock and by unique violation), `remision.test` (unblockSpecialFormat touches only `formato_especial_faltante`, sin_correo stays), `special-format-token/route.test` (401, 403, six non-secretary roles, out-of-scope, unmarked, unapproved, formatted and unknown all the same `not_allowed`), `remission-actions.test` (attach: six roles, malformed input, mapped codes, after() once, rows returned pending), `documentos.test` (`inspectStoredFile`: pdf, png, jpeg, empty, oversize, forged), `student-requests.test` (SubidoPorId IS NULL), `solicitud-detail.test` | COMPLIANT x7 (concurrent second upload at DB-double level only, see WARNING 1; the student list exclusion is asserted on SQL text, see WARNING 6) |
| Out of scope note (TR) | no template generation (1) | no template code exists in the diff; the upload and section tests show only the upload control | COMPLIANT x1 (negative scenario, structural) |
| Attachment size guard (TR) | over limit (1) | `limits.test` (at limit ok, one byte over refused), `plan.test` (gate order), `remission-dispatch.test` (size guard before any download) | COMPLIANT x1 |
| Resend authorization (TR) | out of scope (1) | `remission-actions.test` (six roles to /denied, scope none, unknown equals out-of-scope with nothing sent, malformed ids), `remision.test` (`authorizeResend`: state before the attempt audited, `enviada` writes no audit, unknown or out-of-scope gives null and no audit) | COMPLIANT x1 |
| Approve (RR, MODIFIED) | finality, without text, edited template, marking special format, mark offered only for force majeure, survives mail outage (6) | `decision-dialog.test` (finality and single confirm unchanged; mark and hint only for `fuerza_mayor`, absent for medica, laboral, null, reject and return; no file input; payload with and without the mark; reset on cancel), `page.test` (mark offered or not by cause), `actions.test` (mark passthrough; marked approval redirects to `/review/{id}`, unmarked to the queue; mail failure never changes the outcome), `solicitud-decision.test` | COMPLIANT x6 |
| Remission state and resend on the staff detail (RR) | sent shown with time, blocked with reason and resend, non-approved request (3) | `remission-section.test` (name, snapshot email, groups, state as text; Managua time; Reenviar only while not sent; four reasons in es and en; no alert when pending), `resend-remission-button.test`, `page.test` (remissions of an approved request; none for devuelta, pendiente, rechazada) | COMPLIANT x3 |
| Special-format upload on the staff detail (RR) | upload offered while blocked, successful upload, refused file (3) | `special-format-upload.test` (token route then action under `intake/{id}/`; progress; success shows name and link, sending in progress, control removed; four server answers; store refusal; Spanish alert; no replace or remove), `remission-section.test` (control only when marked and without format), `page.test` (upload on a marked approval; format apart from student documents; none for unmarked) | COMPLIANT x3 |
| Remission UI i18n (RR) | keys present (1) | `review-messages.test` (remission and specialFormat keys in es and en), catalog parity test; 759 keys in each catalog with an empty symmetric difference (confirmed independently) | COMPLIANT x1 |
| Closed set of remission events (AL) | approval events, send outcomes table, format upload audited, refused format audited, no row without an attempt (5) | `events.test` (six builders table-driven action to entity type to id, payload shapes, existing payloads unchanged), `types.test`, `solicitud-decision.test` (remision.creada per row after the approval event, same tx), `remision.test` (completions audited in the guarded tx; stale worker writes nothing), `special-format.test` (documento.formato_especial payload; documento.rechazado on refusal; no audit on denial or already_attached), `remision.test` authorizeResend (no row on denial or `enviada`) | COMPLIANT x5 |
| Remission and format-upload payloads are code-only (AL) | leak check (1) | `events.test` (no payload leaks email, name, CIF, cause, file name, path, provider id or message text; a failure payload stays a closed code even when the provider error carried an email), `remission-dispatch.test` (audit receives only a closed code), `resend-mail-sender.test` (no provider text) | COMPLIANT x1 |
| Actor of remission events (AL) | scheduled retry actor (1) | `remission-dispatch.test` (approving secretary when there is no session; approver never looked up when the actor is supplied; throws when unresolved), `remision.test` (`findApprovingSecretaryId`), `remission-retry/route.test` (no actor taken from the request), `actions.test` (actor captured before `after()`) | COMPLIANT x1 |

**Compliance summary**: 44/44 scenarios COMPLIANT, 0 PARTIAL, 0 FAILING, 0 UNTESTED; 16/16 requirements. Three scenarios are COMPLIANT with caveats (concurrent attempts, concurrent second upload, real mail send), see WARNINGs 1 and 3.

### Correctness (Static Evidence)
| Area | Status | Notes |
|------|--------|-------|
| Transactional creation (RF-09 a) | Implemented | `solicitud-decision.ts` inserts one `Remision` per distinct `DocenteId` and one `remision.creada` each in the approval tx; reject and return create none |
| Guarded claim and completion | Implemented | `remision.ts`: `UPDATE ... WHERE Estado IN (trigger set) AND lease free RETURNING`; completions by `ReclamoId` with the audit row in the same tx |
| Dispatch pipeline | Implemented | `remission-dispatch.ts`: claim, plan, size guard before read, send, guarded completion; `dispatchRemissions` never throws and logs codes only |
| Mail port, Resend adapter, fake | Implemented | injected `fetch`, 20 s timeout, `Idempotency-Key`, config asserted inside `send`; env vars optional |
| RN-19 token route | Implemented | self-authenticating; 401 and 403 distinct; every request-related failure is one `400 not_allowed`; no `onUploadCompleted`; no random suffix; no overwrite |
| RN-19 attach | Implemented | pathname prefix checked before any byte is read; `FOR UPDATE` lock; second format gives `already_attached`; unique-violation backstop; a file already referenced is never deleted |
| Student isolation | Implemented | `getOwnRequestDetail` filters `SubidoPorId IS NULL`; `listRemissions` and `RemissionSection` are used only by the staff `review/[id]` page; nothing under `requests` imports remission code |
| Single writer of `Remision` | Implemented | `update(remision)` only in `remision.ts`; `insert(remision)` only in `solicitud-decision.ts`; pinned by `remision-writes.test` |
| SR-11 exactly-once read | Implemented | no `revalidatePath` or `router.refresh` in the review module or the remission actions (the only repo hits are the catalog actions and the student draft step); `listRemissions` runs before `recordRequestRead`; page test pins that the section adds no audit row |
| Migration 0009 | Implemented, not applied | additive only (1 table, 2 booleans, 1 nullable FK column), no cascade, CHECK lists equal the constants (pinned by `migration-teacher-remission.test`) |
| i18n es/en parity | Implemented | 759 keys in each catalog, symmetric difference empty |

### Coherence (Design)
| Decision | Followed? | Notes |
|---|---|---|
| TR-1 schema | Yes | table, constraints, indexes and the two `DocumentoRespaldo` columns match the generated SQL line by line |
| TR-2 states, reasons, triggers | Yes | constants in `states.ts`; SQL CHECK lists equal them (test) |
| TR-3 migration | Yes | generated as `0009_teacher_remission`; journal `when` pinned later than 0008 (comparison with the last applied `created_at` on Neon not done, deviation 14) |
| TR-4 creation in approval tx | Yes | via `listRequestTeachers`; groups without a teacher yield no row |
| TR-5 mark at approval, upload afterwards | Yes, with deviation 2 | marked approval redirects to the detail; `after()` is deliberately not scheduled for a marked approval because every row is born blocked (provable no-op). Task 5.1 says every `aprobada` success; documented and tested |
| TR-6 claim and idempotency | Yes, with deviation 3 | 10 min lease, key `remision-{id}-{digest}`; `not_configured` gives the attempt back (not in the design; pinned) |
| TR-7 dispatch pipeline | Yes | gate order `sin_correo`, `formato_especial_faltante`, `adjuntos_exceden_limite` |
| TR-8 `after()` | Yes | actor captured before `after`; dependencies built inside the callback; failure contained |
| TR-9 port, adapter | Yes, with deviation 5 | adapter maps 408, 409 and 429 to `unavailable` and other 4xx to `rejected` (task 3.2 said 4xx = rejected); both leave the row pendiente |
| TR-10 message, size guard | Yes, with deviation 4 | subject `Justificar la inasistencia de {estudiante}` exact; `RN18_WARNING` and `RN18_DISCRETION_NOTE` equal the design text character for character and are pinned by test; the discretion note is appended only for `fuerza_mayor`; closing `Gracias de antemano.` exact. The opening reads `por motivos {causa}` (via `CAUSE_PHRASES`) instead of the design `por {causa}`, an accepted wording deviation. 25 MiB guard before any download |
| TR-11 detail actions | Yes | `resendRemissionAction` awaited, `attachSpecialFormatAction` via `after()`; no revalidate or redirect; the same denial for unknown and out-of-scope |
| TR-12 retry cron | Yes | shared constant-time auth, 20 rows, `Intentos < 8`, counts only; `vercel.json` daily `0 10 * * *` (Hobby-compatible; plan unconfirmed) |
| TR-13 audit codes only | Yes | six builders with the exact payload shapes; actor is the session user or the approving secretary |
| TR-14 review detail UI | Yes | section, resend button, upload control, dialog mark, i18n |
| TR-15 staff upload path | Yes | token route, `inspectStoredFile` extraction (existing `finalizeDocument` tests unchanged and green), `attachSpecialFormat` |
| TR-16 storage model | Yes | `DocumentoRespaldo` + `SubidoPorId` + `FormatoEspecial`, student list filtered |
| Accepted deviations in apply-progress | Yes | numbered 1-8 and 10-14 (there is no deviation 9); each is visible in code and tests as described |

### Design-system compliance (docs/design-system.md)
Source scan of `remission-section.tsx`, `special-format-upload.tsx`, `resend-remission-button.tsx` and `decision-dialog.tsx`: no hex colors, no arbitrary px values, no inline styles, no palette utility colors. `design-system.test.tsx` adds 8 cases for this change (three state pills with tint, ink and text; card with a single column at 360 px; catalog alert pattern; Reenviar as a 44 px outline button; upload as a 44 px outline button full width at 360 px with a hidden input and a catalog alert on refusal; attached-format link that wraps long names; 44 px checkbox row with the hint). All pass. The owner 360 px walk is pending (9.11).

### Issues Found
**CRITICAL**: None.

**WARNING**:
1. Real-Postgres proof is missing. The two new integration cases (concurrent dispatch of one row: one `send`, one `EnviadaEn`) are written but never run (task 4.11, owner gate). There is no real-Postgres case at all for a concurrent special-format attach (the design testing strategy lists it). Concurrent attempts and Second upload (concurrently) are judged COMPLIANT on DB-double evidence (the claim matches 0 rows; lock plus unique-violation mapping) and the row-lock mechanism proven in secretary-review; a real run would close them.
2. Migration 0009 is unapplied. The CHECK semantics (`CK_Solicitud_FormatoEspecial`, `CK_Documento_FormatoEspecial`, `CK_Remision_*`) and the order of the mark `UPDATE` inside the approval tx are verified as SQL text and call order only, not executed. This closes with 4.11 and the 9.11 walk.
3. The real Resend send has never been exercised (adapter tested with an injected `fetch`; the sender domain is pending UAM IT; the Resend docs are silent on whether a failed first attempt consumes an idempotency key). The 25 MiB raw guard (about 35 MB encoded against the documented 40 MB) rests on the documentation only.
4. Accepted deviations are not reflected back in `design.md` (the marked-approval `after()` skip against task 5.1, the TR-6 attempt give-back, the TR-9 4xx mapping, the TR-10 wording `por motivos`). They are recorded in apply-progress; the archive should amend the design or carry the note.
5. Strict-TDD evidence caveats: the pins 4.9 (`remision-writes`), 8.8 and 9.9 (design-system) pass on arrival by nature (characterization and class pins); the S5 i18n RED (9.7 keys) was written but not executed on its own; the S6 RED for 9.7 included page tests that broke from a mistaken key removal rather than a clean module-missing failure.
6. Test-quality profile: data-layer tests are DB-double based and mock-heavy (SQL shape and call order, not execution); the student list exclusion is asserted on rendered SQL text (`SubidoPorId is null`); the design-system pins assert CSS classes. All three follow repository precedent.
7. Documentation drift: `tasks.md` (forecast table, chain note `Until S5 merges ...`, S5 row `~1,200 estimated; no code yet`) and `apply-progress.md` (Delivery table row S5 `~1,200 estimated; not started`, Risks `S5 is an estimate`, Remaining `S5: phase 9 ...`) still describe S5 and S6 as not started; measured S5 is 1,470 and S6 is 586. Task 9.10 says the gates were green on the S5 head, while the candidate is the S6 head.
8. The `.env.example` lines for `RESEND_API_KEY=` and `MAIL_FROM=` (task 3.5) are in no commit. The working-tree modification of that file is the owner change and was not inspected (`.env*` is unreadable by instruction). Confirm it holds exactly those lines before the mail rollout.
9. Operational: the cron is daily (Hobby-compatible) and the Vercel plan is unconfirmed (hourly on Pro). Until UAM IT verifies the sender domain and the keys are set, every approval leaves its remissions `pendiente` with `error_envio` (by design, D1); the daily cron keeps retrying without consuming attempts (`not_configured` gives the attempt back).
10. The later email change scenario is proven by the insert values (snapshot recorded at approval) and by the dispatch using the claimed row `Correo`; no test changes the catalog email after a real insert (needs the database).

**SUGGESTION**:
1. Add a concurrent-attach case to the opt-in integration suite and run both new cases at 4.11.
2. Amend `design.md` (or the archive notes) with the four accepted deviations before archiving.
3. Refresh `tasks.md` and `apply-progress.md` (S5 and S6 sizes and state, 9.10) before the PRs are opened.
4. The document route lets the owning student fetch the staff-uploaded format by direct id (`canViewDocument` owner rule, unchanged by design: existing download authorization); the format is only hidden from the student lists. Decide whether the student should be able to open it.
5. Consider a coverage tool for changed files, and CI running the opt-in integration suite against an ephemeral Postgres (carried over from earlier changes).
6. Replacing or removing a wrongly uploaded format is out of scope here; record the follow-up in the roadmap at archive (task 10.2).

### Verdict
PASS WITH WARNINGS. 0 CRITICAL, 10 WARNING, 6 SUGGESTION. Every one of the 44 scenarios (16 requirements) in the three delta specs has a covering test that passed in this run; design decisions TR-1..TR-16 are followed with the recorded deviations; the six slices are each at or under 2,000 authored lines (maximum 1,897); tests, typecheck, build, eslint (CRLF noise only) and prettier are green with no database targeted. The gated tasks (4.11, 6.4, 7.x, the PR part of 9.10, 9.11, 10.x) are owner, PR and archive steps and do not block the next phase; migration 0009 stays unapplied until Phase 7.
