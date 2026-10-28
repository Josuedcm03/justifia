```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:6366e16eda5aaa128ec1678c6daf9ecec8d24b6177d8a3b4d5d3a831219de7bd
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 31/31
scenarios: 158/158
test_command: npx vitest run
test_exit_code: 0
test_output_hash: sha256:8889f7e3b733439fec242623d11717cccd715ff48856daa6ca41f0607d48e11c
build_command: npm run build
build_exit_code: 0
build_output_hash: sha256:1a9f7527591f29a51a600412a6b5c7c465bb9e27b2826ea759299c5e28d8071e
```

## Verification Report

**Change**: escalation
**Version**: N/A (8 delta specs, design ES-1..ES-16, preproposal revision 6)
**Mode**: Standard (vitest)
**Code under verification**: branch `feat/escalation-s5-student-consent`, head `7d6a157` (stack S1..S5), merge base with `main` `23697d9`. Run in a temporary worktree outside the repo (removed afterwards). No database command was run; integration tests stayed skipped (`INTEGRATION_DATABASE_URL` unset); no `.env*` file was read; nothing was checked out in the shared working tree.

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total (tasks.md on tracker `356c197`) | 145 |
| Tasks complete `[x]` | 106 |
| Tasks incomplete | 39 |

The open set is exactly the known owner/PR set: 0.1, 3.3-3.5, 4.1-4.5, 6.3, 8.3, 11.3, 13.2, 14.1-14.3, 15.1-15.10, 16.1-16.13. Every `[x]` item that names a measurable result was re-checked against the code or the run: file existence, the 5990 test count (13.1), the 57 skipped integration tests (12.12), the migration contents (1.12), the eight new audit actions (10.6) and the consent pins (12.5, 12.6). No `[x]` item was found to be undone. Task 12.4 is `[x]` with the placeholder consent date `2026-10-22`; the owner has not confirmed it (SUGGESTION S2).

### Build & Tests Execution
**Tests**: 270 files / 5990 tests passed, 0 failed, 0 skipped (`DATABASE_URL=postgres://u:p@localhost/x npx vitest run`, exit 0, 170 s). Expected 5990: matches.

**Integration config** (`vitest.integration.config.mts`, env unset): 4 files / 57 tests skipped, exit 0. Nothing connected.

**Typecheck**: `npm run typecheck` exit 0. On a fresh worktree it first fails with `LayoutProps` not found until `next build` has generated `.next/types` (environmental); it passed after the build.

**Build**: `npm run build` exit 0 with a dummy `DATABASE_URL` and a dummy 32-character `AUTH_SECRET` (`src/env.ts` requires it; the first build without it exited 1 with a ZodError because no `.env` exists in the worktree and none was read). `/coordination` and `/coordination/[id]` are dynamic routes.

**Lint**: `npx eslint src` exit 1 with 107534 errors; 107533 are the CRLF `Delete ␍` prettier noise of the Windows checkout. The one remaining error is real (W1).

**Format**: `npx prettier --check --end-of-line auto` over the 145 changed source and i18n files: 1 fails, `src/app/privacy/page.test.tsx` (W1). The other 144 are clean.

**Coverage**: not available (not requested).

### Spec Compliance Matrix
Detail level: one row per requirement (31 requirements and 158 scenarios, counted from the `### Requirement:` and `#### Scenario:` headings of the 8 specs). Every scenario was mapped to a passing test file; the test titles of the data, dispatch, answer, queue, document-route and action suites were read, the others were mapped by title and by the task notes. Scenarios are COMPLIANT unless listed under "Not fully proven".

| Spec / Requirement | Code | Covering tests (all passed) | Status |
|---|---|---|---|
| coordination-escalation / Escalate a pendiente request (11 sc.) | `src/lib/data/solicitud-escalation.ts:122-208`, `src/lib/intake/escalation.ts`, `src/app/(dashboard)/review/[id]/escalation-actions.ts:99-121` | `solicitud-escalation.test.ts`, `escalation.test.ts`, `escalation-actions.test.ts`, `escalate-dialog.test.tsx` | compliant, except "Concurrent escalations" (partial) |
| coordination-escalation / One open escalation per request (3) | `src/db/schema.ts`, `drizzle/0011_escalation.sql` (`UX_Escalamiento_Abierto`), `isUniqueViolation` | `migration-escalation.test.ts`, `solicitud-escalation.test.ts`; integration suite skipped | partial (3 scenarios) |
| coordination-escalation / Coordination answer returns to pendiente (7) | `src/lib/data/escalation-answer.ts:49-148`, `coordination/[id]/actions.ts` | `escalation-answer.test.ts`, `actions.test.ts`, `answer-form.test.tsx`, `review/[id]/page.test.tsx` | compliant, except "Concurrent answers" (partial) |
| coordination-escalation / RF-15 absence report (9) | `solicitud-escalation.ts:235-325`, `intake/escalation.ts:137-164` | `solicitud-escalation.test.ts`, `append-only.test.ts`, `report-dialog.test.tsx`, `absence-reports-section.test.tsx` | compliant |
| coordination-escalation / Notification recipients (3) | `src/lib/data/escalamiento.ts:258-278` | `escalamiento.test.ts`, `escalation-dispatch.test.ts` | compliant |
| coordination-escalation / Zero recipients is a visible blocked state (3) | `src/lib/escalation/plan.ts:36-44`, `escalation-dispatch.ts:75-80`, `escalamiento.ts:68-74,193-209` | `plan.test.ts`, `escalation-dispatch.test.ts`, `escalamiento.test.ts`, `coordination-queue.test.ts` | compliant |
| coordination-escalation / Notification outbox, retry, resend (8) | `escalamiento.ts`, `outbox.ts`, `escalation-dispatch.ts`, `src/app/api/cron/remission-retry/route.ts`, `escalation-actions.ts:189-240` | `escalamiento.test.ts`, `escalation-dispatch.test.ts`, `route.test.ts`, `escalation-actions.test.ts` | compliant, except "Concurrent attempts" (partial) |
| coordination-escalation / Notification content and privacy (3) | `src/lib/escalation/message.ts:52-79` | `message.test.ts`, `plan.test.ts`, `coordination/[id]/page.test.tsx` | compliant |
| coordination-escalation / Coordinator view, own career (6) | `coordination-queue.ts`, `coordination-scope*.ts`, `src/app/(dashboard)/coordination/**` | `coordination-queue.test.ts`, `coordination/page.test.tsx`, `[id]/page.test.tsx`, `structure.test.ts` | compliant |
| coordination-escalation / Confidentiality of note and answer (2) | student modules never import the tables; `events.ts` payloads | `student-requests.test.ts`, `requests/[id]/page.test.tsx`, `events.test.ts` | compliant |
| coordination-escalation / UI i18n and accessibility (3) | `i18n/es.json`, `i18n/en.json`, `review/notice-status.ts` | `catalog-parity.test.ts`, `review-messages.test.ts`, `coordination-messages.test.ts`, both `layout-360.test.tsx` | compliant |
| request-review / Review state tabs (4) | `review/page.tsx`, `intake/review-tabs.ts`, `revision-queue.ts` | `review/page.test.tsx`, `review-tabs.test.ts`, `revision-queue.test.ts` | compliant |
| request-review / Escalation controls and history (5) | `escalation-section.tsx`, `review/[id]/page.tsx:138-148` | `escalation-section.test.tsx`, `review/[id]/page.test.tsx`, `solicitud-detail.test.ts` | compliant |
| request-review / Absence reports and notification status (4) | `absence-reports-section.tsx`, `notice-status.ts`, `resend-escalation-button.tsx` | `absence-reports-section.test.tsx`, `notice-status.test.ts`, `resend-escalation-button.test.tsx` | compliant |
| request-review / Escalation UI i18n (1) | locale files | `review-messages.test.ts`, `catalog-parity.test.ts` | compliant |
| request-review / MODIFIED Queue ordering and RN-08 (14) | `intake/business-days.ts:56-76`, `intake/deadline-clock.ts`, `db/clock-start.ts`, `solicitud-correction.ts:106` | `business-days.test.ts`, `deadline-clock.test.ts`, `revision-queue.test.ts`, `solicitud-correction.test.ts`, `escalation-answer.test.ts` | compliant |
| request-review / MODIFIED Staff detail with history (2) | `solicitud-detail.ts`, `review/[id]/page.tsx` | `solicitud-detail.test.ts`, `review/[id]/page.test.tsx` | compliant |
| request-review / MODIFIED State transitions (7) | `intake/transitions.ts:26-28`, `solicitud-decision.ts` (untouched) | `transitions.test.ts`, `solicitud-escalation.test.ts`, `escalation-answer.test.ts` | compliant, except "Decision refused in coordination" (partial) |
| student-requests / MODIFIED Own request detail (9) | `requests/[id]/page.tsx:78-79`, `detail-sections.tsx:127-135` | `requests/[id]/page.test.tsx`, `student-requests.test.ts`, `solicitud-correction.test.ts` | compliant |
| user-roles / Coordinacion access (4) | `src/lib/auth/permissions.ts:136-186`, `src/lib/navigation.ts` | `permissions.test.ts`, `navigation.test.ts`, `app-sidebar.test.tsx`, `review/[id]/actions.test.ts:109` | compliant |
| supporting-documents / MODIFIED Authenticated inline view (15) | `permissions.ts` `canViewDocument`, `documentos.ts:418-440`, `api/intake/documents/[id]/route.ts:67-75` | `documents/[id]/route.test.ts:369-470`, `documentos.test.ts`, `permissions.test.ts` | compliant |
| audit-log / Closed set of escalation events (2) | `src/lib/audit/types.ts:50-57,62-72`, `events.ts:269-420` | `events.test.ts`, `types.test.ts` | compliant |
| audit-log / One audit row per operation (2) | `insertAuditEvents` in each transaction; `outbox.ts:90-107` | `solicitud-escalation.test.ts`, `escalation-answer.test.ts`, `escalamiento.test.ts`, `escalation-dispatch.test.ts` | compliant (see W3) |
| audit-log / Payloads are code-only (2) | `events.ts` builders | `events.test.ts` (leak test) | compliant |
| audit-log / Actor of scheduled notification events (1) | `escalation-dispatch.ts:58` | `escalation-dispatch.test.ts` | compliant |
| audit-log / MODIFIED Scope limited to write events (4) | reads in `request-reads.ts` | `request-reads.test.ts`, both `structure.test.ts` | compliant |
| audit-log / MODIFIED Every document download audited (6) | route, `recordDocumentDownload` | `route.test.ts`, `documentos.test.ts` | compliant |
| audit-log / MODIFIED Staff reads are audited (7) | `review/page.tsx`, `coordination/page.tsx`, `coordination/[id]/page.tsx:54` | `review/page.test.tsx`, `coordination/page.test.tsx`, `[id]/page.test.tsx`, both `structure.test.ts` | compliant |
| audit-log / MODIFIED Review payloads minimise data (4) | `events.ts:242-253` | `events.test.ts` | compliant |
| justification-intake / MODIFIED Consent text and version (7) | `intake/consent.ts`, locale files | `consent.test.ts`, `requests/new/actions.test.ts:577`, `submission.test.ts`, `solicitud-correction.test.ts` | compliant |
| privacy-notice / MODIFIED Required contents (4) | `i18n` `privacy.recipients`, `app/privacy/page.tsx` | `privacy/page.test.tsx`, `consent.test.ts` (notice pin) | compliant |

**Not fully proven (7 scenarios, PARTIAL).** Each depends on a real database behavior that the mocked unit suites cannot exercise. The proof is the opt-in suite `src/lib/data/integration/*escalation*` (57 cases), skipped here by design and scheduled as owner task 14.1.
1. coordination-escalation "Concurrent escalations": unit tests pin the guarded UPDATE, the `conflict` outcome and the unique-violation mapping; the two-writer race exists only in `escalation-race.integration.test.ts` (skipped).
2. "Database rejects a second open escalation": `migration-escalation.test.ts` pins the partial unique index; the rejection itself is in `escalation-constraints.integration.test.ts` (skipped).
3. "Re-escalation after the answer": the index predicate (`RespondidaEn IS NULL`) is pinned in SQL; the behavior is in the skipped suite.
4. "Notices do not block": predicate pinned (`Tipo='sospecha_documento'`); behavior in the skipped suite.
5. "Concurrent answers": guarded UPDATE and `conflict` mapping pinned; real contention not exercised.
6. "Concurrent attempts" (outbox): claim SQL and lease pinned (`escalamiento.test.ts`); a real double claim is not exercised.
7. request-review "Decision refused in coordination": `decideRequest` is unchanged and guarded by `stateBefore`, which `transitions.test.ts` pins to `pendiente`; no test drives `decideRequest` with a coordination state (the existing already-decided case uses `aprobada`).

**Compliance summary**: 158/158 scenarios have a covering test that passed; 151 are fully proven and 7 are PARTIAL (application behavior proven, database-engine behavior pending the phase 14 run). The envelope counts a scenario as complete when a covering test passed, so the 7 PARTIAL ones are inside 158/158 and are carried as warning W2, which is why the verdict is not a plain pass. 0 failing, 0 untested.

### Correctness (Static Evidence)
| Area | Status | Notes |
|---|---|---|
| Authorization and career scoping | Implemented | Secretary actions run `requireRole(...rolesRevisores)` then `resolveRequestScope`; scope `none` or a bad id returns `not_found` (`escalation-actions.ts:65-74`). Coordinator: `requireRole(...rolesCoordinadores)`, scope read from the DB per call (`data/coordination-scope.ts:21-32`), SQL only through `escalationInScope` (student's live `CarreraId`, `none` = `false`). Another career, an answered suspicion, a draft and an unknown id are the same `not_found` / `notFound()` (`escalation-answer.ts:79-94`, `coordination-queue.ts:170-205`). A wrong role gets `/denied` or `/login` (see S1). |
| Student never sees reason, note or answer | Implemented | No student module imports `Escalamiento` or `ReporteInasistencia` (`git grep` over `7d6a157`); the student page renders one neutral key only in `en_revision_coordinacion`; "sospecha" appears only under `review.escalation.reasons` (staff). |
| RN-08 pause in business days | Implemented | `countBusinessDays` (`E <= d < A`) and `addBusinessDays` (`business-days.ts:56-76`); `pausedStartOnAnswer` stores Managua midnight `T06:00:00Z` only when P>0 (`deadline-clock.ts`); the answer writes it in the guarded request UPDATE (`escalation-answer.ts:116-129`); resubmission resets it (`solicitud-correction.ts:106`); queue index and ORDER BY share `effectiveClockStart`; the spec deadline table rows are `it.each` cases in `escalation-answer.test.ts`. |
| Zero-recipient rules (E17) | Implemented | Escalate: no active `coordinacion` account of the live career refuses with the career name and rolls back (`solicitud-escalation.ts:162-170`); accounts without email do not refuse; the report never refuses (no account lookup); recipients are resolved at every send and zero gives `bloqueada/sin_destinatarios` before any mail-config check (`plan.ts:36-44`); cron selects `pendiente` only (`escalamiento.ts:193-209`); a resend may claim `bloqueada` (`escalamiento.ts:68-74`). |
| Outbox claim and retry cap | Implemented | Guarded claim with lease and claim id (`outbox.ts`, `escalamiento.ts:80-106`); completions match on claim id and audit in one transaction (`outbox.ts:90-107`); cron cap `Intentos < MAX_AUTO_ATTEMPTS (8)`, batch 20; `not_configured` gives the attempt back so it never exhausts the cap. |
| Closed audit event set | Implemented | `AUDIT_ACTIONS` gains exactly the eight spec actions (`types.ts:50-57`); entity types gain `Escalamiento` and `Carrera`; payloads are ids, codes and counts. |
| Consent v2 pins | Implemented | `CONSENT_VERSION = "2026-10-22"` (later than `2026-10-20`); the es and en labels equal the spec text verbatim (checked by string); v1 and v2 hashes pinned, current version last; notice subtree pinned; the fix commit `7d6a157` re-pinned the notice and the pin test passes. |
| `APP_BASE_URL` unset | Implemented | `env.ts:28` optional, no platform fallback; the plan returns `not_configured`; dispatch leaves the row `pendiente` with `error_envio` and gives the attempt back (`escalation-dispatch.ts:82-86`); test "leaves the notice pendiente (not_configured) when APP_BASE_URL is unset, sending nothing". |
| Migration | Implemented | `0011_escalation.sql`: 2 tables, 1 nullable `ADD COLUMN`, FKs without cascade, all CHECKs, three indexes, and the single `DROP INDEX "IX_Solicitud_Cola"` plus recreate on the three-way expression; no `UPDATE`, no `ALTER ... TYPE`. Generated, not applied. |
| Requirement traceability | Compliant | RF-01 (d), RF-07 (a, c), RF-10, RF-15, RN-08, RN-15, RN-16, RN-20, RN-25, RNF-01, RNF-02, RNF-04, RNF-06, RNF-07 and RNF-12 all exist in `docs/requirements.md` (RF-10 line 25, RF-15 line 30, RN-20 line 55, changelog 2026-10-22 line 131); the specs and tasks cite them. |

### Coherence (Design)
| Decision | Followed? | Notes |
|---|---|---|
| ES-1 `Escalamiento` table | Yes | One extra CHECK `CK_Escalamiento_NotificacionEstado`; `bloqueada` requires a non-null motive (documented deviations 4, 5). Writers split by `escalamiento-writes.test.ts`; the answer module is an allowed writer of the answer columns (reconciled in 7.7 and 10.4). |
| ES-2 `ReporteInasistencia` append-only | Yes | `append-only.test.ts`; teacher from the request's `Remision` rows in any state. |
| ES-3 live career | Yes | No career column on `Escalamiento`; every read joins the student. |
| ES-4 transitions, `sourceOf` | Yes | Two edges; `stateBefore` uniqueness pinned; `solicitud-decision.ts` untouched. |
| ES-5 RN-08 stored start | Yes | As designed, including `CK_Solicitud_PlazoInicio` and the shared index fragment. |
| ES-6 escalate | Yes | |
| ES-7 excess report | Yes | |
| ES-8 answer | Yes | |
| ES-9 coordinator surface | Yes | Detail keyed by escalation id; the list shows an alert for a coordinator without a career (no rows, no audit). |
| ES-10 recipients and message | Yes | One message, `to` first and `cc` rest; key stable and recipient-sensitive. |
| ES-11 dispatch | Yes | See W3 for where the resend audit row is written. |
| ES-12 secretary UI | Mostly | Dialogs use the `AlertDialog` primitive, not `ConfirmDialog` (documented deviation; S3). |
| ES-13 audit | Yes | |
| ES-14 student visibility | Yes | |
| ES-15 consent v2 | Yes | Date is the owner placeholder. |
| ES-16 migration | Yes | |

### Issues Found
**CRITICAL**: None.

**WARNING**
- W1. Prettier violation introduced by the last commit `7d6a157` in `src/app/privacy/page.test.tsx:135-139`: the ternary passed to `toMatch(...)` is wrapped over three lines but fits on one (`l === "es" ? /coordinación de tu carrera/ : /coordination of your career/,`). `npx prettier --check --end-of-line auto` fails on this file and `npx eslint src` reports it as the only non-CRLF error; Gate set G includes `format:check`. Not tied to a spec scenario. Fix before the S5 PR (format only).
- W2. Seven scenarios are PARTIAL at runtime (Concurrent escalations, Database rejects a second open escalation, Re-escalation after the answer, Notices do not block, Concurrent answers, Concurrent attempts, Decision refused in coordination). The proof is the skipped real-Postgres suite, owner task 14.1. The change must not be archived before that run is green (the tasks already gate on it).
- W3. `escalamiento.notificacion_reenviada` is written at authorization, before the send is attempted: `src/lib/data/escalamiento.ts:239-247` (`authorizeNoticeResend`). The audit-log requirement "One audit row per escalation operation" ties the row to "a resend that attempts a send". If the claim is lost or skipped (`dispatchEscalationNotice` returns `skipped` or `lost`, for example another attempt holds the lease) a row exists with no send attempted. The `enviada` case is correct (no row). Low impact; the remission resend orders it the same way.

**SUGGESTION**
- S1. Spec text conflict to settle at spec sync (task 16.2): `coordination-escalation` "Denied callers" says a student, a `coordinacion`, an unauthenticated caller and others get "the same denial as for a nonexistent id", while `user-roles` says a role denial follows `permission-denied-screen` and only a coordinator asking for another career or an unknown id gets the nonexistent-id outcome. The code follows `user-roles` (`requireRole`: `/denied` or `/login`; `escalation-actions.ts:66`, `coordination/[id]/actions.ts:35`) and the tests assert it. Align the `coordination-escalation` wording when syncing.
- S2. Consent v2 date `2026-10-22` is the placeholder (task 12.4 is `[x]` but the owner never confirmed it) and UAM legal review (16.13) is open; any wording or date change needs a new `CONSENT_VERSION` and new pins.
- S3. Design ES-12 says both dialogs use `ConfirmDialog`; the code uses the `AlertDialog` primitive (`escalate-dialog.tsx`, `report-dialog.tsx`, `answer-form.tsx`). Documented in apply-progress; update `design.md` or note it at archive.
- S4. When `APP_BASE_URL` (or the mail key) is unset, every automatic attempt writes an `escalamiento.notificacion_fallida` row and sets `NotificacionMotivo = error_envio` (`escalation-dispatch.ts:82-86`). Because the attempt is given back, cron adds one audit row per pending notice per run (batch of 20) until the variable is set, and staff see "last attempt failed" although nothing was tried. Consider a distinct, non-audited path or text for "not configured".
- S5. A notice still `pendiente` when the coordinator answers the escalation is retried and sent later; its link then leads to a not-found screen. Consider skipping or closing notices of answered escalations.
- S6. Fresh-checkout gates: typecheck needs a prior `next build` (generated `LayoutProps`) and the build needs `AUTH_SECRET` in the environment. Note it in the instructions of task 16.1 (the owner's checkout has both).

### Verdict
PASS WITH WARNINGS
0 critical, 3 warnings, 6 suggestions. All 5990 tests, typecheck and build are green and every requirement has an implementation and covering tests; what remains is one format fix, seven database-level scenarios whose proof waits for the owner-run real-Postgres suite, and one audit-ordering nuance.

## Key Learnings

1. The escalation change passes 5990 unit tests, typecheck and build, and its only hard lint finding is one prettier wrap in a test file added by the last fix commit.
2. Database-level scenarios such as the partial unique index, races and claim contention cannot be proven by mocked suites, so they stay partial until the real-Postgres run in phase 14.
3. A fresh worktree needs a dummy AUTH_SECRET for the build and a prior build for the generated Next types before typecheck passes.
4. The resend audit row is written when the resend is authorized rather than when a send is attempted, which differs slightly from the audit-log wording.
5. The coordination-escalation and user-roles specs disagree on how a wrong-role caller is denied, and the code follows user-roles.
