# Tasks: Escalation

> Strict TDD (vitest): every behavior task is a RED task (failing test) followed by a GREEN task; a unit commit holds its tests and code together. Test command: `npx vitest run <paths>`.
> Gate set G (per slice): `npm test`, `npm run typecheck`, `npx eslint src` (ignore the CRLF `Delete ␍` noise: `| rg -v 'Delete .␍.'`), `npm run format:check` (CRLF: `--end-of-line auto`), `npm run build`. Run `npm test` and `npm run build` with a dummy `DATABASE_URL` (`postgres://u:p@127.0.0.1:9/x`) so no database is targeted.
> DB rule (`CLAUDE.md`): every task tagged `ASK OWNER` needs the owner's explicit "yes" for that single command, never batched, and never against the production endpoint `ep-orange-math` without it. `[LOCAL]` touches no database; `[READ-ONLY]` is a select or CLI status; `[CONFIRM]` writes. Slice code and unit tests never touch Neon. No agent task runs `drizzle-kit migrate`, `drizzle-kit push`, `db:seed` or write SQL.
> Spec IDs: RF-07 (a, c), RF-10, RF-15, RN-08, RN-15, RN-16, RN-20, RN-25/RF-01 (d), RNF-01, RNF-02, RNF-04, RNF-06, RNF-07, RNF-12. Decisions ES-1..ES-16 refer to `design.md`; D0, E1-E17 to `preproposal.yaml` revision 6.
> Skills for apply: `C:\Users\Arnia\.agents\skills\chained-pr\SKILL.md`, `C:\Users\Arnia\.agents\skills\work-unit-commits\SKILL.md`; for the owner DB phases also `C:\justifia\.agents\skills\neon-postgres\SKILL.md` (registry: `C:\justifia\.atl\skill-registry.md`). One commit per work unit (test + code together), Conventional Commits, no AI attribution.
> Never touch: `openspec/changes/backoffice-ui-refresh/`, `docs/flow-experience-backlog.md`, `package-lock.json` (existing unrelated modification stays out of every commit). UX observations in `design.md` are reviewed with the owner first (task 15.9).
> Threat matrix: N/A for shell, subprocess, VCS/PR automation and executable-file classification (design). Routing and access are covered by RNF-01 RED tasks 9.3, 9.6, 9.7, 10.1, 10.5 and 10.9 (no public path is added). Edit authority: a backticked path on a checkbox line is an edit target; read-only references carry `(read-only)`.
> Size note: the `sdd-tasks` cap (530 words) is exceeded on purpose; the repository precedent (`request-consent`, `teacher-remission`) keeps one line per task with spec links.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~4,050 authored total (S1 ~950, S2 ~900, S3 ~700, S4 ~900, S5 ~600 incl. the ~250-line real-Postgres suite); generated SQL, `drizzle/meta/*`, `openspec/`, `.engram/` and `package-lock.json` excluded |
| 400-line budget risk | High: aggregate ~4,050 and every slice above 400 |
| 1000-line budget risk (session `review_budget_lines`) | Medium: S1, S2 and S4 sit within 10% of the budget; each has a named unit-boundary split (S1a/S1b, S2a/S2b, S4a/S4b) |
| Chained PRs recommended | Yes |
| Suggested split | S1 schema and rules -> S2 secretary UI -> S3 notifications -> S4 coordinator -> S5 student, consent v2 and proof suite |
| Delivery strategy | auto-chain (review_budget_lines=1000 per slice PR) |
| Chain strategy | feature-branch-chain |

| Slice | Branch | Content | Authored lines | PR base |
|-------|--------|---------|---------------:|---------|
| Docs | tracker `feat/escalation` | SDD planning documents, one docs commit, before S1 | n/a | tracker to `main` (draft, no-merge) |
| S1 Data and rules | `feat/escalation-s1-data-rules` | Unit 1 schema, generated migration, transitions, RN-08 rules; unit 2 validation, audit, escalate/report writes, resubmit reset | ~950 | tracker |
| S1a Schema (fallback, if S1 > 1000) | `feat/escalation-s1a-schema` | Phase 1 only (unit 1) | ~480 | tracker |
| S1b Writes (fallback) | `feat/escalation-s1b-writes` | Phase 2 only (unit 2) | ~470 | S1a branch until S1a merges, then tracker |
| S2 Secretary UI | `feat/escalation-s2-secretary-ui` | Unit 3 tabs and pause-aware queue; unit 4 staff detail, dialogs, actions | ~900 | tracker |
| S2a / S2b (fallback) | `feat/escalation-s2a-tabs`, `feat/escalation-s2b-detail` | Unit 3 / unit 4 | ~450 / ~450 | tracker / S2a branch until it merges |
| S3 Notifications | `feat/escalation-s3-notifications` | Unit 5 plan, message, env, outbox data; unit 6 dispatch, cron, resend | ~700 | tracker |
| S4 Coordinator | `feat/escalation-s4-coordinator` | Unit 7 scope, permissions, nav, document access; unit 8 pages, answer, audit | ~900 | tracker |
| S4a / S4b (fallback) | `feat/escalation-s4a-scope-access`, `feat/escalation-s4b-pages-answer` | Unit 7 / unit 8 | ~450 / ~450 | tracker / S4a branch until it merges |
| S5 Student, consent v2, proof suite | `feat/escalation-s5-student-consent` | Unit 9 student callout, consent v2, privacy; unit 10 real-Postgres suite | ~600 | tracker |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

Chain: tracker `feat/escalation` exists. Each slice branches from the tracker head after the previous slice merged into it (merge commit); if the previous PR is still open, branch from it, use it as the PR base (clean diff) and retarget to the tracker after it merges. Only the tracker merges to `main`; the tracker is never deleted; merged slice branches are deleted at closeout with the owner's yes. Open the tracker PR as draft/no-merge. Every child PR carries the Chain Context diagram with the current slice marked `📍`, gates, measured size and rollback.

**Split rule (applies to S1, S2, S4):** after Gate set G measure authored lines against the tracker head. At or under 1000, open one PR. Over 1000, split once at the unit boundary into the named fallback branches (one honest slicing pass, never code golf); if a half still exceeds 1000, stop and report with a `size:exception` recommendation.

**Merge gate: the tracker MUST NOT reach `main` before S5, the proof run (phase 14), the owner walk (phase 15) and the production migration (phase 16).** Between S1 and S3 escalations are created with notices `pendiente` and no dispatcher; between S1 and S4 nothing answers them; `main` is untouched meanwhile. S3 and S4 are separable and revertable, but reverting S4 strands open escalations (roll them back to `pendiente` first, see design Rollback).

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Schema, generated migration, transitions, business-day and clock rules | S1 / S1a | `npx vitest run src/db src/lib/intake` | N/A: SQL read by test, not applied; real Postgres in unit 10 and phase 14 | Revert `schema.ts`, `src/db/clock-start.ts`, `drizzle/*_escalation.sql`, `drizzle/meta/`, intake rule files (unapplied) |
| 2 | Note/report validation, audit builders, escalate and report writes, resubmit reset | S1 / S1b | `npx vitest run src/lib/intake src/lib/audit src/lib/data` | N/A: DB double; real-Postgres race in unit 10 | Revert `escalation.ts`, `solicitud-escalation.ts`, `solicitud-correction.ts`, audit files |
| 3 | Review state tabs and pause-aware queue | S2 / S2a | `npx vitest run src/lib/data/revision-queue.test.ts "src/app/(dashboard)/review" src/i18n` | `npm run dev` walk (phase 15): tabs, order, `en_pausa` | Revert `revision-queue.ts`, `page.tsx`, tab/table components, badge, keys |
| 4 | Staff detail history, escalate and report dialogs, actions | S2 / S2b | `npx vitest run src/lib/data/solicitud-detail.test.ts "src/app/(dashboard)/review" src/i18n` | `npm run dev` walk: escalate, E17 unavailable, report | Revert `solicitud-detail.ts`, `review/[id]/escalation-*`, dialogs, keys |
| 5 | Notice plan and message, `APP_BASE_URL`, recipients, outbox claim | S3 | `npx vitest run src/lib/escalation src/lib/data/escalamiento.test.ts src/env.test.ts` | N/A: pure plus DB double | Revert `src/lib/escalation/`, `escalamiento.ts`, `env.ts` |
| 6 | Dispatch, post-commit hook, cron drain, resend | S3 | `npx vitest run src/lib/data/escalation-dispatch.test.ts "src/app/(dashboard)/review/[id]" src/app/api/cron` | `npm run dev` walk: resend, blocked and pending texts | Revert `escalation-dispatch.ts`, cron route, resend action/button, notification audit builders |
| 7 | Coordination scope, permissions, nav, coordinator document access | S4 / S4a | `npx vitest run src/lib/intake/coordination-scope.test.ts src/lib/auth src/lib/navigation.test.ts src/lib/data/documentos.test.ts "src/app/api/intake"` | `npm run dev` walk: document opens for own career only | Revert scope files, `permissions.ts`, `navigation.ts`, `documentos.ts`, document route |
| 8 | Coordinator list, detail, answer, audit closed set | S4 / S4b | `npx vitest run src/lib/data "src/app/(dashboard)/coordination" src/lib/audit src/i18n` | `npm run dev` walk: coordinator list, answer, pause | Revert `coordination/`, `coordination-queue.ts`, `escalation-answer.ts`, keys |
| 9 | Student callout, consent v2 pin, privacy recipients | S5 | `npx vitest run "src/app/(dashboard)/requests" src/lib/intake/consent.test.ts src/app/privacy src/i18n` | `npm run dev` walk: student view, consent v2 text, `/privacy` | Revert student page, `consent.ts`, label and privacy keys |
| 10 | Opt-in real-Postgres suite (CHECKs, partial unique, `PlazoInicio`, queue index, race) | S5 | `npm run typecheck` (suite compiles; excluded from `npm test`) | Phase 14: `INTEGRATION_ALLOW_WRITES=1 npm run test:integration` on a disposable branch | Revert `src/lib/data/integration/*escalation*`, fixtures change |
| 11 | Proof, walk, verify, archive, production migration, tracker merge | tracker docs commits | `npm test` | Phases 14, 15 and 16 (owner) | Revert docs commits; code untouched |

## Phase 0: Planning docs, tracker and owner coordination (before S1)

- [ ] 0.1 [OWNER] Agree the migration merge order with the `document-extraction` teammate before the S1 PR (both target `0011`; the second to merge regenerates, never hand-numbered); record the agreed order and date next to this task
- [ ] 0.2 `[READ-ONLY]` Review `git diff docs/requirements.md`: it must hold only the 2026-10-22 changelog entry (RF-10 (a) deviation); anything else, STOP and ask the owner
- [ ] 0.3 On tracker `feat/escalation`, stage only `openspec/changes/escalation/` and `docs/requirements.md` (if 0.2 is clean) and commit `docs(escalation): add the SDD planning documents` as its own docs commit; stage nothing else
- [ ] 0.4 Push the tracker; open the tracker PR to `main` as draft/no-merge with the chain table and the merge gate (not before S5 and phases 14, 15, 16)
- [ ] 0.5 `[READ-ONLY]` Re-check `drizzle/` on `main` for a migration newer than `0010_request_consent.sql`; if `document-extraction` already merged a `0011`, STOP and tell the owner (task 3.3 then regenerates on rebase)

## Phase 1: S1 - Schema, migration, transitions, RN-08 rules (work unit 1)

- [ ] 1.1 Branch `feat/escalation-s1-data-rules` from the tracker; PR targets the tracker (split names in the forecast)
- [ ] 1.2 RED `src/lib/intake/transitions.test.ts`: `TRANSITIONS` holds `pendiente -> en_revision_coordinacion` (secretaria) and `en_revision_coordinacion -> pendiente` (coordinacion); `sourceOf(to, actor)` returns the single source; `stateBefore` stays unique for every `DECISION_KINDS` entry; no other edge into or out of coordination; `aprobada` never enters it (ES-4; scenarios "Coordination reachable only by escalation", "Approved never escalates")
- [ ] 1.3 GREEN `src/lib/intake/transitions.ts`: two edges, `sourceOf`, header comment drops "no edge"; `solicitud-decision.ts` untouched
- [ ] 1.4 RED `src/lib/intake/business-days.test.ts`: `countBusinessDays(E, A)` counts `E <= d < A` (Mon..Thu = 3; same day 0; Tue..next Mon = 4; holiday inside excluded); `addBusinessDays(S, P)` is the P-th business day strictly after `S` (ES-5; scenario "Holiday inside the pause")
- [ ] 1.5 GREEN `src/lib/intake/business-days.ts`: two pure exports reusing `nextBusinessDay`/`isBusinessDay`; header comment "never stored" becomes "the answer stores the shifted start"
- [ ] 1.6 RED `src/lib/intake/deadline-clock.test.ts`: `clockStartOf` coalesces `PlazoInicioEn`, `ReenviadaEn`, `PresentadaEn`; `pausedStartOnAnswer` returns `null` for P=0, else Managua midnight `${S'}T06:00:00Z`; spec deadline table (Mon/Mon/Thu -> next Mon; Mon/Tue/Tue -> Wed; Mon/Tue/next Mon -> next Tue); two pauses add up; holiday not counted; Managua date, not UTC (RN-08; scenarios "Deadline excludes time in coordination", "Two escalations add up", "Managua date, not UTC")
- [ ] 1.7 GREEN `src/lib/intake/deadline-clock.ts` (pure, uses the injected `NonWorkingDaysProvider`)
- [ ] 1.8 RED `src/db/migration-escalation.test.ts` (pattern of `migration-request-consent.test.ts`): SQL located by name `escalation`; journal `when` after its predecessor; both tables and every ES-1/ES-2 column; each CHECK body (`Tipo`, `Kind` both shapes, `Respuesta`, `SinRespuesta`, outbox state/motive/claim/`Intentos`, `ReporteInasistencia_Nota`, `Solicitud_PlazoInicio`); `UX_Escalamiento_Abierto` unique partial predicate; `IX_Escalamiento_Pendiente`, `IX_Escalamiento_Solicitud`; `PlazoInicioEn` nullable; the only `DROP` is `IX_Solicitud_Cola`, recreated on the three-way expression with its `WHERE`; no `UPDATE`, no `ALTER ... TYPE`, no cascade (ES-1, ES-2, ES-5, ES-16)
- [ ] 1.9 GREEN `src/db/schema.ts`: `Escalamiento` table with indexes and CHECKs (ES-1)
- [ ] 1.10 GREEN `src/db/schema.ts`: `ReporteInasistencia` table, index and CHECK (ES-2)
- [ ] 1.11 GREEN `src/db/schema.ts` and `src/db/clock-start.ts`: `Solicitud.PlazoInicioEn` (timestamptz NULL), `CK_Solicitud_PlazoInicio`, and `IX_Solicitud_Cola` on the one exported `effectiveClockStart` fragment taking the table columns (no `src/lib/data` import); the same fragment feeds `listReviewQueue` in S2 (ES-5)
- [ ] 1.12 `[LOCAL]` `npm run db:generate -- --name escalation` (generate only): expect `drizzle/*_escalation.sql`, `drizzle/meta/*_snapshot.json`, `drizzle/meta/_journal.json`; confirm only `CREATE TABLE`, `ADD COLUMN`, constraints, indexes and the single `DROP INDEX "IX_Solicitud_Cola"` + recreate; anything else, STOP. No `migrate`, no `push`. Re-run 1.8 to green
- [ ] 1.13 Commit unit 1: `feat(escalation): add the escalation schema, migration 00NN and the pause rules`

## Phase 2: S1 - Validation, audit, writes (work unit 2)

- [ ] 2.1 RED `src/lib/intake/escalation.test.ts`: `ESCALATION_KINDS`, `EXCESS_REPORT_STATE = "aprobada"`, fixed reason `sospecha_documento` (any other value refused); note bounds table (empty/whitespace refused, 1000 accepted, 1001 refused, trimmed); answer text same bounds; report date table (today and yesterday accepted; tomorrow, missing, `2026-02-30` refused; "today" is Managua); report note optional, non-blank when given, max 1000 (RN-20; scenarios "Note bounds", "Date bounds", "Client bypass")
- [ ] 2.2 GREEN `src/lib/intake/escalation.ts` (pure validators and constants)
- [ ] 2.3 RED `src/lib/audit/events.test.ts` and `types.test.ts`: entity types gain `Escalamiento` and `Carrera`; builders for `solicitud.escalada` `{escalamientoId, motivo, estadoPrevio, estadoNuevo}`, `solicitud.escalamiento_resuelto`, `solicitud.reporte_inasistencias` `{reporteId, escalamientoId, docenteId}` with entity `Solicitud`; leak test extended (diagnosis note, answer, teacher name, email never in payloads); existing events and pinned lists unchanged (ES-13; scenarios "Payloads hold codes only", "Existing events unchanged")
- [ ] 2.4 GREEN `src/lib/audit/types.ts` and `src/lib/audit/events.ts` (only the three S1 actions and two entity types)
- [ ] 2.5 RED `src/lib/data/solicitud-escalation.test.ts` for `countCoordinationAccounts`: counts active `coordinacion` accounts of the student's live `CarreraId`, email ignored; inactive and other-career excluded (ES-3, E17)
- [ ] 2.6 RED same file for `escalateRequest`: success (guarded UPDATE with `sourceOf('en_revision_coordinacion','secretaria')` AND scope, student's live career read, `Escalamiento` row with notification `pendiente`, one `solicitud.escalada`); non-pendiente table (`aprobada`, `rechazada`, `devuelta`, `borrador`, `en_revision_coordinacion`) refused with nothing written; out-of-scope and unknown id same `not_found`; zero accounts -> `sin_coordinacion` with career name, rollback, no audit; accounts without email -> success; unique violation -> `conflict`; v1 or missing consent does not block; no mail dependency; failure after the state UPDATE, in the insert or in the audit rolls everything back; concurrent loser gets `conflict` (ES-6, E17; scenarios "Successful escalation", "Only from pendiente", "Career without a coordination account is refused", "Failure rolls back", "Legacy consent does not block")
- [ ] 2.7 GREEN `src/lib/data/solicitud-escalation.ts`: `countCoordinationAccounts`, `escalateRequest`
- [ ] 2.8 RED same test file for `recordExcessReport`: locks `aprobada` request in scope `FOR UPDATE`; non-aprobada table (`pendiente`, `devuelta`, `rechazada`, `borrador`, `en_revision_coordinacion`) refused; teacher outside the request's `Remision` rows refused (any delivery state accepted); date and note rules; success inserts report with teacher id and name snapshot, `exceso_inasistencias` record (`EstadoPrevio='aprobada'`, notification `pendiente`), one `solicitud.reporte_inasistencias`, request state and remissions untouched; zero accounts or zero emails still recorded; two reports for one teacher make two rows; no percentage field anywhere; failure rolls back (ES-2, ES-7, E10, E16; scenarios "Successful report", "Teacher outside the remissions", "Append-only", "No percentage")
- [ ] 2.9 GREEN `src/lib/data/solicitud-escalation.ts`: `recordExcessReport`
- [ ] 2.10 RED `src/lib/data/solicitud-correction.test.ts`: `resubmitCorrection`'s `set` adds `plazoInicioEn: null`, so a pause before the resubmission never counts (ES-5; scenario "Escalation before a resubmission is ignored"); GREEN `src/lib/data/solicitud-correction.ts`
- [ ] 2.11 RED+GREEN `src/lib/data/append-only.test.ts`: add `ReporteInasistencia` (insert-only; no update or delete in production sources); test that no function updates or deletes it (ES-2)
- [ ] 2.12 Commit unit 2: `feat(escalation): add the escalate and absence-report writes with audit`

## Phase 3: S1 - Gates and PR

- [ ] 3.1 Gates S1: `npx vitest run src/db src/lib` then Gate set G; record exact results; no DB command run
- [ ] 3.2 Measure authored lines against the tracker (generated SQL, `drizzle/meta/*`, `openspec/`, `.engram/`, `package-lock.json` excluded); target ~950; apply the split rule (S1a = Phase 1, S1b = Phase 2)
- [ ] 3.3 Merge-order gate: re-check `drizzle/` on `main`; if `document-extraction` merged first, rebase, delete this change's `drizzle/*_escalation.sql`, its snapshot and journal entry, re-run `npm run db:generate -- --name escalation` and the migration test; never hand-number
- [ ] 3.4 Open the S1 PR (S1a then S1b if split): Chain Context with `📍`, forecast, gates, measured size, "migration generated, NOT applied", "no UI yet; tracker not to `main` before S5"
- [ ] 3.5 After review, merge into the tracker with a merge commit

## Phase 4: Migration smoke on a disposable branch (owner-run; after S1 merged)

> Every step: ASK OWNER, explicit yes per command. Production is touched read-only only. Connection strings come from the Neon CLI (the `.env` `DATABASE_URL` may be stale).

- [ ] 4.1 ASK OWNER: P1 `[READ-ONLY]` production: count `Solicitud` by `Estado`; `IX_Solicitud_Cola` definition; applied-migration rows; active `coordinacion` accounts per FIA career, split with and without email (counts only; D0 expects email only for Industrial and Sistemas); record the result next to this task
- [ ] 4.2 [OWNER] Decide from 4.1 what to do about FIA careers without a coordination account (E17: their escalations are refused until an administrator creates the account); the walk (15.2) needs one career per case
- [ ] 4.3 ASK OWNER: `[CONFIRM]` create disposable Neon branch `test-escalation-pg` from production
- [ ] 4.4 ASK OWNER: `[CONFIRM]` `npm run db:migrate` against `test-escalation-pg` only (its direct URL), never production; STOP until "yes"
- [ ] 4.5 ASK OWNER: `[READ-ONLY]` on the branch: both tables exist and are empty, `PlazoInicioEn` nullable and NULL, new `IX_Solicitud_Cola` definition, migration count +1. If the DDL fails, STOP: fix the migration in a branch from the tracker before S2 starts

## Phase 5: S2 - Secretary tabs, queue and staff detail (work units 3 and 4)

- [ ] 5.1 Branch `feat/escalation-s2-secretary-ui` from the tracker; PR targets the tracker
- [ ] 5.2 `[READ-ONLY]` Read the page `searchParams` and server-component guides in `node_modules/next/dist/docs/` (read-only) before coding (`AGENTS.md`)
- [ ] 5.3 RED `src/lib/data/revision-queue.test.ts`: `listReviewQueue` orders by the three-way effective start (scenarios "Ordering", "Order follows the effective deadline": B precedes A); `listCoordinationQueue(scope)` in-scope only, escalation time ascending, reason label, `en_pausa`, notification status; `listApprovedRequests(scope)` by approval `DecididaEn` descending, report count, newest 50; `rechazada`, `devuelta`, `borrador` in no tab; out-of-scope absent (ES-12, E14; scenarios "Requests per tab", "Out-of-scope requests absent")
- [ ] 5.4 GREEN `src/lib/data/revision-queue.ts` (uses `effectiveClockStart` from `src/db/clock-start.ts`) and `src/lib/data/solicitud-detail.ts` deadline via `clockStartOf`
- [ ] 5.5 RED+GREEN audit: `src/lib/audit/events.test.ts` then `events.ts`/`types.ts`: `solicitud.cola.consultada` payload `{ total, estado }` (tab code, no ids); previous payload test updated (scenario "Tab open payload is count and tab code")
- [ ] 5.6 RED `src/app/(dashboard)/review/page.test.tsx`: `?estado=pendiente|en_revision_coordinacion|aprobada`, default Pendientes, invalid value falls back; three tab links with `aria-current` and `prefetch={false}`; one `solicitud.cola.consultada` per render with the tab code; alert/overdue marks Pendientes-only; "latest 50" note; non-secretary roles denied with no rows (scenarios "Default tab", "Non-secretary denied", "Tab open")
- [ ] 5.7 GREEN `src/app/(dashboard)/review/page.tsx`, new `review-tabs.tsx`, `coordination-queue-table.tsx`, `approved-queue-table.tsx`; RED+GREEN `deadline-badge.tsx` accepts `DeadlineStatus | "en_pausa"` (muted tone, text label; `DeadlineStatus` unchanged)
- [ ] 5.8 RED+GREEN `src/i18n/review-messages.test.ts` then `i18n/es.json`, `i18n/en.json`: tab, badge and queue keys, same keys in both locales
- [ ] 5.9 Commit unit 3: `feat(escalation): add the review state tabs and the pause-aware queue`
- [ ] 5.10 RED `src/lib/data/solicitud-detail.test.ts`: `getRequestDetail` returns escalation history (reason, note, author, time, answer, answerer, notification status/motive/sent time) and reports (teacher snapshot, date, note, author, time); `getOwnRequestDetail` exposes none of it; detail read adds no audit beyond `solicitud.consultada`; update every `RequestDetail` fixture (ES-12; scenarios "Answer visible to staff", "Student never sees them")
- [ ] 5.11 GREEN `src/lib/data/solicitud-detail.ts`
- [ ] 5.12 RED `src/app/(dashboard)/review/[id]/escalation-actions.test.ts`: `escalateRequestAction` and `recordExcessReportAction` re-check role and scope before parsing; student, `coordinacion`, other-facultad, no-facultad, unauthenticated and unknown id give the same denial; client `motivo` ignored; note and report validation errors; outcomes (`conflict`, `sin_coordinacion` with career name) map to i18n codes; no audit on refusal (scenarios "Denied callers", "Client bypass", "Concurrent escalations")
- [ ] 5.13 GREEN `src/app/(dashboard)/review/[id]/escalation-actions.ts`
- [ ] 5.14 RED `src/app/(dashboard)/review/[id]/escalation-section.test.tsx`: history with note, author, time, answer; notification texts table (`pendiente` pending send, `pendiente` + `error_envio` last attempt failed, `enviada` with time, `bloqueada` no coordination recipient for the career), text never color alone; in `en_revision_coordinacion` the open escalation shows with no approve/reject/return/escalate control; escalate control only when `pendiente`; none on `aprobada`/`rechazada`/`devuelta` (scenarios "In coordination, no controls", "Status texts", "Escalate not offered elsewhere")
- [ ] 5.15 GREEN `escalation-section.tsx`; wire `request-sections.tsx` and `page.tsx` (reads `countCoordinationAccounts`; detail still writes one `solicitud.consultada`)
- [ ] 5.16 RED `escalate-dialog.test.tsx`: required note with counter, `ConfirmDialog` (RNF-12), cancel changes nothing, server errors shown; E17 table (account with email offered; account without email offered; none -> unavailable text names the career and asks to have the administrator create the account); GREEN `escalate-dialog.tsx`
- [ ] 5.17 RED `report-dialog.test.tsx` and `absence-reports-section.test.tsx`: teacher select lists the request's remitted teachers only, date input max today, optional note, `ConfirmDialog`, no percentage or count field, reports listed apart from the remission section, remission section unchanged, no report action unless `aprobada`; GREEN `report-dialog.tsx`, `absence-reports-section.tsx` (scenarios "Report action and list", "Remissions unchanged by a report", "No report action when not approved")
- [ ] 5.18 RED+GREEN `src/i18n/review-messages.test.ts` then both locale files: `review.escalation.*`, `review.report.*`, errors incl. `sin_coordinacion` with `{carrera}` (es neutral, no voseo: "{carrera} no tiene coordinación registrada; solicite al administrador que cree la cuenta."); same keys in both locales (scenarios "Translation keys present", "Refusal message names the career")
- [ ] 5.19 RED+GREEN `src/app/(dashboard)/review/layout-360.test.tsx` and `design-system.test.tsx`: tabs, dialogs and sections at 360 px (no horizontal overflow, axe clean), tokens only per `docs/design-system.md` (read-only)
- [ ] 5.20 Commit unit 4: `feat(escalation): add escalation and absence-report controls to the staff detail`

## Phase 6: S2 - Gates and PR

- [ ] 6.1 Gates S2: `npx vitest run src/lib src/app src/i18n` then Gate set G; record exact results
- [ ] 6.2 Measure against the tracker (target ~900); apply the split rule (S2a = unit 3 `feat/escalation-s2a-tabs`, S2b = unit 4 `feat/escalation-s2b-detail`)
- [ ] 6.3 Open the S2 PR (`📍`, gates, size, "owner walk follows in phase 15"); after review merge into the tracker (merge commit)

## Phase 7: S3 - Notice, outbox, dispatch, cron, resend (work units 5 and 6)

- [ ] 7.1 Branch `feat/escalation-s3-notifications` from the tracker; PR targets the tracker
- [ ] 7.2 RED `src/lib/escalation/plan.test.ts` and `message.test.ts`: zero recipients -> `blocked sin_destinatarios` evaluated before any mail config check; one -> `to`; n -> `to` first, `cc` rest; Spanish message holds exactly request number, student full name and CIF, career, reason label, note (sospecha) or report note when present (exceso), absolute link `${APP_BASE_URL}/coordination/${id}` with no token; no cause, dates, teacher name, document names, attachments or answer; idempotency key `escalamiento-${id}-${sha256(to,cc)[0..16]}` stable and recipient-sensitive; unset base URL -> `not_configured` (ES-10, E6; scenarios "Message fields", "Cause and documents absent", "Link requires login")
- [ ] 7.3 GREEN `src/lib/escalation/plan.ts`, `src/lib/escalation/message.ts`
- [ ] 7.4 RED+GREEN `src/env.test.ts` then `src/env.ts`: `APP_BASE_URL` optional URL (no `VERCEL_PROJECT_PRODUCTION_URL` fallback)
- [ ] 7.5 RED `src/lib/data/escalamiento.test.ts`: `listCoordinationRecipients` returns exactly active `coordinacion` users with email of the student's live career (two active with email, inactive, no-email and other-career excluded; resolved fresh so a later account is included); claim/lease (concurrent claims send once), `completeSent` (`enviada` + `EnviadaEn` once), `completeFailed` (`pendiente` + `error_envio`, `Intentos` +1), `completeBlocked` (`sin_destinatarios`); `selectEscalationRetryCandidates` bounded per run and by max attempts, skips `bloqueada` and `enviada`; `authorizeNoticeResend` scope and state (RNF-07; scenarios "Recipient set", "Current career, not the snapshot", "Account created later", "Concurrent attempts", "Scheduled job skips it")
- [ ] 7.6 GREEN `src/lib/data/escalamiento.ts` (pattern of `remision.ts`)
- [ ] 7.7 RED structural test in `src/lib/data/escalamiento.test.ts`: outbox columns (`NotificacionEstado`, `Intentos`, `ReclamoId`, `ReclamadaEn`, `EnviadaEn`, `ProveedorMensajeId`) are written only by `escalamiento.ts`; creation only by `solicitud-escalation.ts`; answer columns only by `escalation-answer.ts` (reconciles ES-1 and ES-8); GREEN by keeping the writers there
- [ ] 7.8 Commit unit 5: `feat(escalation): add the notice plan, recipients and outbox claim`
- [ ] 7.9 RED `src/lib/data/escalation-dispatch.test.ts`: success -> `enviada` + `escalamiento.notificacion_enviada` `{solicitudId, origen, intentos, destinatarios}`; provider error (message containing an email) -> `pendiente` + `error_envio` + `notificacion_fallida` with code only; zero recipients -> `bloqueada` + `notificacion_bloqueada` and the escalation stays open; recipients gone after escalation same path; unconfigured mail leaves `pendiente`; report notices with no account or no email -> `bloqueada` (both table rows); never throws per row; actor is the session user, `SecretariaId` for cron; `enviada` is never resent (scenarios "Success", "Failed send", "Mail down at escalation", "Report recorded without recipients", "Scheduled retry actor", "Sent is never resent")
- [ ] 7.10 GREEN `src/lib/data/escalation-dispatch.ts`
- [ ] 7.11 RED+GREEN audit: `src/lib/audit/events.test.ts` then `events.ts`/`types.ts`: builders for `escalamiento.notificacion_enviada|fallida|bloqueada|reenviada` (entity `Escalamiento`, payloads per ES-13), leak test for provider errors
- [ ] 7.12 RED `src/app/(dashboard)/review/[id]/escalation-actions.test.ts` additions: escalate and report actions schedule `after(dispatch)` only on success, refusals schedule nothing; `resendEscalationNoticeAction` re-checks role and scope first, unknown or out-of-scope id gets the same denial, `enviada` sends nothing and writes no audit, `pendiente`/`bloqueada` dispatch with origin resend and one `notificacion_reenviada` when a send is attempted (scenarios "Resend after the fix", "Resend out of scope")
- [ ] 7.13 GREEN `escalation-actions.ts` (post-commit `after()` and resend); RED+GREEN `resend-escalation-button.test.tsx` then `resend-escalation-button.tsx` (offered unless `enviada`); wire into `escalation-section.tsx`
- [ ] 7.14 RED `src/app/api/cron/remission-retry/route.test.ts`: no shared secret -> refused, nothing sent; remission batch then escalation batch, each in its own try (a failed remission does not stop the notice); response keeps the remission counts at top level and adds `escalamientos`; `bloqueada` and `enviada` rows skipped (scenarios "Scheduled drain of both outboxes", "Unauthenticated job"); GREEN `src/app/api/cron/remission-retry/route.ts`
- [ ] 7.15 RED+GREEN `src/i18n/review-messages.test.ts` then both locale files: resend and delivery-status keys
- [ ] 7.16 Commit unit 6: `feat(escalation): dispatch coordination notices after commit with cron retry and resend`

## Phase 8: S3 - Gates and PR

- [ ] 8.1 Gates S3: `npx vitest run src/lib src/app src/i18n` then Gate set G; record exact results
- [ ] 8.2 Measure against the tracker (target ~700, under 1000); open the S3 PR (`📍`; note "`APP_BASE_URL` is an owner Vercel task, 15.3"); after review merge into the tracker

## Phase 9: S4 - Coordinator scope, access and document reads (work unit 7)

- [ ] 9.1 Branch `feat/escalation-s4-coordinator` from the tracker; PR targets the tracker
- [ ] 9.2 RED `src/lib/intake/coordination-scope.test.ts`: `coordinationScopeFor` -> `carrera` for `coordinacion` with `CarreraId`; `none` for null career, other roles, inactive (fail closed); GREEN `src/lib/intake/coordination-scope.ts` and `resolveCoordinationScope(userId, rol)` reading `CarreraId`/`Activo` per call (ES-9)
- [ ] 9.3 RED `src/lib/auth/permissions.test.ts`: `rolesCoordinadores`, `canCoordinate`; access matrix table (own career, other career, no career, `secretaria`, `estudiante`/`docente`/`administrador`, anonymous) for coordinator surfaces and for secretary tabs/escalate/report/resend; `coordinacion` cannot call a decision action; GREEN `src/lib/auth/permissions.ts` (RNF-01; scenarios "Access matrix", "Role cannot answer a decision")
- [ ] 9.4 RED `src/lib/navigation.test.ts`: `coordinacion` sees the coordinator entry and no review entry, `secretaria` the reverse, `estudiante` neither, `prefetch: false`; GREEN `src/lib/navigation.ts` (scenario "Menu per role")
- [ ] 9.5 RED `src/lib/data/coordination-scope-sql.test.ts`: `escalationInScope(scope)` is false for `none` and compares the student's live `CarreraId` for `carrera`; scope sentinel; GREEN `src/lib/data/coordination-scope-sql.ts` (ES-3)
- [ ] 9.6 RED `src/lib/data/documentos.test.ts`: `getDocumentForDownload` returns `estudianteCarreraId` and `tieneEscalamientoAbierto`; `canViewDocument(viewer, doc, scope, coordination)` matrix: coordinator allowed only for same career + `en_revision_coordinacion` + open escalation + `valido` + not retired; denied for answered/back in `pendiente`, `aprobada` with a notice, retired, other career, `none`; student and secretary rules unchanged; GREEN `src/lib/data/documentos.ts`
- [ ] 9.7 RED `src/app/api/intake/documents/[id]/route.test.ts`: coordinator of the career streams inline with security headers and one `documento.descargado` (coordinator actor, mode `ver`); every denial in the spec table equals the nonexistent-id response with no bytes and no audit; scope resolved only for `coordinacion`; audit failure blocks bytes; unknown mode refused; GREEN `src/app/api/intake/documents/[id]/route.ts`
- [ ] 9.8 Commit unit 7: `feat(escalation): scope the coordinator to its career and let it read escalated documents`

## Phase 10: S4 - Coordinator view, answer, audit closed set (work unit 8)

- [ ] 10.1 RED `src/lib/data/coordination-queue.test.ts`: list of open escalations of the own career oldest first (a `bloqueada` one still listed) then notices newest first; answered, `borrador`, other careers and `none` excluded; career change takes effect; open detail by escalation id holds student full name, CIF, career, cause, dates, subjects with group and teacher (class data only through the `solicitud-clases` seam), current non-retired documents, reason label, note, time, and never student email, consent or decision history; notice detail holds name, CIF, career, teacher name, communicated date, note and nothing else (scenarios "Own career only", "Notices are informational", "Open escalation detail", "Coordinator without career")
- [ ] 10.2 GREEN `src/lib/data/coordination-queue.ts`
- [ ] 10.3 RED `src/lib/data/escalation-answer.test.ts`: answer bounds table; guarded UPDATE only while open, sospecha and in scope; `Solicitud` UPDATE guarded by `sourceOf('pendiente','coordinacion')` writes `PlazoInicioEn` only when P > 0 (spec table values); zero rows there throws and rolls back; one `solicitud.escalamiento_resuelto`; concurrent loser `conflict`; answered, notice and `pendiente` targets refused; other career equals `not_found`; no `SolicitudDecision` row; failure rolls back (ES-8; scenarios "Successful answer", "Concurrent answers", "Answer on a non-open escalation", "Failure rolls back")
- [ ] 10.4 GREEN `src/lib/data/escalation-answer.ts` (injected `NonWorkingDaysProvider`)
- [ ] 10.5 RED `src/app/(dashboard)/coordination/[id]/actions.test.ts`: `answerEscalationAction` re-checks authentication, role and career before parsing; coordinator of another career, no `CarreraId`, `secretaria`, student and unauthenticated all equal the nonexistent-id outcome with nothing changed; also add to `src/app/(dashboard)/review/[id]/actions.test.ts` that `coordinacion` is denied approve/reject/return; GREEN `src/app/(dashboard)/coordination/[id]/actions.ts`
- [ ] 10.6 RED+GREEN audit: `src/lib/audit/events.test.ts` then `events.ts`/`types.ts`: `escalamiento.cola.consultada` (entity `Carrera`, caller `CarreraId`, count only); closed-set test that `AUDIT_ACTIONS` gains exactly the eight escalation actions and existing events keep their shape; answer text never in payloads (scenarios "Action to entity type", "Not in audit")
- [ ] 10.7 RED `src/app/(dashboard)/coordination/page.test.tsx`: own career only; one `escalamiento.cola.consultada` per render; denied callers and null career write no row and return no data; answered escalation absent; GREEN `src/app/(dashboard)/coordination/page.tsx` and `coordination-list.tsx`
- [ ] 10.8 RED `src/app/(dashboard)/coordination/[id]/page.test.tsx`: open detail fields; exactly one `solicitud.consultada` per render with the coordinator as actor (links `prefetch={false}`); audit failure returns no data; other career, answered, `borrador`, unknown id -> `notFound()` with no row; answer form behind `ConfirmDialog`; notice detail has no form, documents, cause or dates; blocked-notification escalation answerable; GREEN `src/app/(dashboard)/coordination/[id]/page.tsx` and `answer-form.tsx` (scenarios "Coordinator list and detail", "Prefetch and re-render do not duplicate", "Answered escalation leaves the list")
- [ ] 10.9 RED+GREEN structural `src/app/(dashboard)/coordination/structure.test.ts` (pattern of `review/structure.test.ts`): every page and action calls `requireRole(...rolesCoordinadores)` and resolves the scope, and imports no secretary data module (RNF-01)
- [ ] 10.10 RED+GREEN `src/i18n/coordination-messages.test.ts` then both locale files: `coordination.*` keys, same keys in both locales
- [ ] 10.11 RED+GREEN `layout-360.test.tsx` and `design-system.test.tsx` under `src/app/(dashboard)/coordination/`: 360 px, axe clean, tokens only per `docs/design-system.md` (read-only)
- [ ] 10.12 Commit unit 8: `feat(escalation): add the coordinator view and answer`

## Phase 11: S4 - Gates and PR

- [ ] 11.1 Gates S4: `npx vitest run src/lib src/app src/i18n` then Gate set G; record exact results
- [ ] 11.2 Measure against the tracker (target ~900); apply the split rule (S4a = unit 7 `feat/escalation-s4a-scope-access`, S4b = unit 8 `feat/escalation-s4b-pages-answer`)
- [ ] 11.3 Open the S4 PR (`📍`, gates, size, RNF-01 matrix evidence); after review merge into the tracker (merge commit)

## Phase 12: S5 - Student view, consent v2, proof suite (work units 9 and 10)

- [ ] 12.1 Branch `feat/escalation-s5-student-consent` from the tracker; PR targets the tracker
- [ ] 12.2 RED `src/app/(dashboard)/requests/[id]/page.test.tsx` and `solicitud-correction.test.ts`: neutral callout `requests.detail.coordination` only in `en_revision_coordinacion`; no reason code, note, answer or coordinator anywhere; `pendiente` after an answer shows the state only; `aprobada` with a report or notice shows nothing of it; `getOwnRequestDetail` payload unchanged; correction action refused in coordination; es and en texts contain neither "sospecha" nor "suspicion" (ES-14, E13; scenarios "Escalated request shows a neutral label", "Excess-absence report is invisible", "Escalated request cannot be corrected")
- [ ] 12.3 GREEN `src/app/(dashboard)/requests/[id]/page.tsx`, `detail-sections.tsx` and both locale files
- [ ] 12.4 [OWNER] Confirm the consent v2 approval date (ISO, later than `2026-10-20`) for `CONSENT_VERSION`; placeholder `2026-10-22` if not supplied. Record the choice here before the pin in 12.6; a later wording or date change needs a new version and pin
- [ ] 12.5 RED `src/lib/intake/consent.test.ts`: `CONSENT_VERSION` is the v2 date and later than `2026-10-20`; es label with tags stripped equals the spec v2 text and en equals its translation, both naming the career coordination; SHA-256 of the raw es message equals the new `PINNED` entry; v1 `PINNED` hash unchanged, hashes distinct and `CONSENT_VERSION` is the last key; the es `privacy` subtree hash is pinned under the new key (scenarios "Text is the approved one", "Version is new", "Text changed without version change", "Version changed without text change", "Notice edited without a new version")
- [ ] 12.6 GREEN `src/lib/intake/consent.ts`, `intake.review.consent.label` and `privacy.recipients` in `i18n/es.json` and `i18n/en.json` (coordination named as recipient, minimal email plus in-system consultation); compute hashes from the final strings; update fixtures that pin `2026-10-20`
- [ ] 12.7 RED `src/app/privacy/page.test.tsx` and `src/lib/intake/submission.test.ts`/`actions.test.ts`: recipients name the career coordination in both locales; shown version equals `CONSENT_VERSION`; a new request stores v2 and `solicitud.presentada` carries it; a page rendered under `2026-10-20` gets `consent_outdated` with nothing stored; v1 rows untouched and still correctable; GREEN `src/app/privacy/page.tsx`
- [ ] 12.8 Commit unit 9: `feat(consent): name the career coordination as recipient in consent v2 and the notice`
- [ ] 12.9 RED+GREEN `src/lib/data/integration/escalation-constraints.integration.test.ts`: per-CHECK accept/reject table (`Tipo`, `Kind` both shapes, `Respuesta` pairs, `SinRespuesta`, motive/state incl. `sin_destinatarios` only with `bloqueada`, claim pair, `Intentos >= 0`, blank notes), `UX_Escalamiento_Abierto` (second open rejected, allowed after answer, `exceso` alongside open), `CK_Solicitud_PlazoInicio`; each case in a rolled-back transaction; opt-in guard `INTEGRATION_ALLOW_WRITES=1` (pattern of `intake-concurrency.integration.test.ts`)
- [ ] 12.10 RED+GREEN `src/lib/data/integration/queue-index.integration.test.ts`: `EXPLAIN` of the exact `listReviewQueue` ordering with `SET LOCAL enable_seqscan = off` shows an index scan on `IX_Solicitud_Cola` and no Sort node (tiny tables otherwise choose a seq scan)
- [ ] 12.11 RED+GREEN `src/lib/data/integration/escalation-race.integration.test.ts`: `escalateRequest` and `decideRequest` approve on one `pendiente` request concurrently -> exactly one winner, consistent final state (approved with no escalation, or in coordination with no decision), loser gets `conflict`/already decided; extend `src/lib/data/integration/fixtures.ts` cleanup for both new tables in FK order
- [ ] 12.12 `npm run typecheck` and `npx eslint src` prove the suite compiles; no DB run here (phase 14 owner run). Commit unit 10: `test(escalation): add the real-Postgres proof suite`

## Phase 13: S5 - Gates and PR

- [ ] 13.1 Gates S5: `npx vitest run src/lib src/app src/i18n` then Gate set G; record exact results
- [ ] 13.2 Measure against the tracker (target ~600); open the S5 PR (`📍`; "tracker not to `main` before phases 14-16"); after review merge into the tracker (merge commit)

## Phase 14: Real-Postgres proof (owner-run; after S5 merged)

> Disposable branch only, never production. Reuse `test-escalation-pg` from 4.3 (recreate it from production and re-migrate if the migration was regenerated).

- [ ] 14.1 ASK OWNER: `[CONFIRM]` `INTEGRATION_DATABASE_URL=<test-escalation-pg direct URL> INTEGRATION_ALLOW_WRITES=1 npm run test:integration`; record per-case results and counts here
- [ ] 14.2 If any case fails, STOP: fix in a branch from the tracker (new slice PR, regenerate the migration if it is schema), then repeat 4.4-4.5 and 14.1
- [ ] 14.3 ASK OWNER: `[CONFIRM]` delete `test-escalation-pg` once all cases are green; record the date

## Phase 15: Owner prerequisites and manual walk (before verify; after S5 merged)

> Every DB step: ASK OWNER, explicit yes per command. The owner walks; the agent records the result.

- [ ] 15.1 ASK OWNER: `[CONFIRM]` create disposable branch `test-escalation` from production and `npm run db:migrate` on it only; point `.env.development.local` at it (keep the previous file as a `.bak`)
- [ ] 15.2 ASK OWNER: separate data step per account, no seeding without a yes: existing student and secretary practice accounts; `coordinacion` accounts on the walk branch only (one career with an email, one with an account without email, one with none); remitted teachers; student enrollments
- [ ] 15.3 [OWNER] Set `APP_BASE_URL` in Vercel for production, preview and development, and in `.env.development.local` (`http://localhost:3000`); unset leaves notices `pendiente` with `not_configured`. Record the values' scheme and host (not secrets) here
- [ ] 15.4 Walk the secretary at 360 px and desktop, `es` and `en`: tabs (default, bookmark, order); escalate dialog (note required, cancel changes nothing); success moves it to En coordinacion with no decision controls and a status text; E17 unavailable text names the career; account without email succeeds and shows `bloqueada`; resend; report on `aprobada` (remitted teachers only, tomorrow refused, no percentage, remissions unchanged); keyboard only
- [ ] 15.5 Walk the coordinator at 360 px and desktop: only the coordinator menu entry; own career list incl. the blocked-notice escalation; detail fields and document opens inline (audited); no student email, consent or decision history; answer behind confirm removes it from the list; notice shows no form; another career's URL is not found
- [ ] 15.6 Walk the secretary after an answer: request back in Pendientes with a later due date, `en_pausa` while escalated, answer text visible, decision panel offered, deadline equals the spec table case
- [ ] 15.7 Walk the student: neutral callout (no "sospecha"), no note or answer, no trace of a report on an approved request, consent shows the v2 text, `/privacy` names the coordination, a v1 request is still correctable
- [ ] 15.8 ASK OWNER: `[READ-ONLY]` on the walk branch: counts per escalation audit action, one `solicitud.consultada` per open, coordinator `documento.descargado`, no payload with note or answer text; codes and counts only
- [ ] 15.9 [OWNER] Review the six UX observations in `design.md` with the agent; the agent does not edit the flow backlog unless the owner asks
- [ ] 15.10 ASK OWNER: `[CONFIRM]` delete `test-escalation`; record every result and date here

## Phase 16: Closeout and production migration (after phase 15)

- [ ] 16.1 Verify (`sdd-verify`): re-run `npm test`, typecheck, eslint, `npm run format:check`, `npm run build` on the tracker head with the dummy `DATABASE_URL`; check every spec scenario against a test, the proof run (14.1) or the walk record
- [ ] 16.2 Spec sync: merge the deltas into `openspec/specs/{request-review,student-requests,audit-log,justification-intake,privacy-notice,supporting-documents,user-roles}/spec.md` and create `openspec/specs/coordination-escalation/spec.md`; drop change-specific sections; `diff -r` readback
- [ ] 16.3 `docs/roadmap.md` row 6 `Estado` = `archivado`; Notas: UAM legal review of consent v2 and the notice, coordination accounts per FIA career (E17), `APP_BASE_URL`, RF-10 (a) deviation, overlap with `coordination-reports` (#7), merge-order outcome with `document-extraction`
- [ ] 16.4 Teammate note (roadmap Notas, archive report, owner message): migration merge order outcome; whoever merges second regenerates, never hand-numbered
- [ ] 16.5 Archive to `openspec/changes/archive/<date>-escalation/` with `git mv` and an `archive-report.md` (`diff -r` readback); run `npm test` and `npm run build` first (no DB targeted)
- [ ] 16.6 [OWNER] Sync the `docs/requirements.md` changelog (2026-10-22 entry) with the thesis requirements matrix so the RF-10 (a) deviation, E17 and consent v2 match what shipped; the agent edits only on the owner's go
- [ ] 16.7 ASK OWNER: P1 `[READ-ONLY]` production again: counts by `Estado` equal 4.1, applied-migration rows, and `APP_BASE_URL` set (15.3)
- [ ] 16.8 ASK OWNER: B1 `[CONFIRM]` create Neon branch `backup-before-escalation` from production; STOP until "yes"
- [ ] 16.9 ASK OWNER: M1 `[CONFIRM]` `npm run db:migrate` over the production direct URL from the Neon CLI, naming the exact command; never unprompted, never against `ep-orange-math` without the yes
- [ ] 16.10 ASK OWNER: V1 `[READ-ONLY]` P1 counts unchanged; both tables exist and are empty; `PlazoInicioEn` NULL on every row; new `IX_Solicitud_Cola` definition; migrations +1; V2 `[LOCAL]` `db:generate` drift check writes nothing
- [ ] 16.11 [OWNER] Merge the tracker PR into `main` with a merge commit only after S1-S5, 14.1, phase 15 and 16.10; keep `feat/escalation`; delete merged slice branches (as split) with the owner's yes; the failing Vercel preview check is the known non-team-author block
- [ ] 16.12 Record every result and date next to its step; delete `backup-before-escalation` only on the owner's explicit yes after production is stable
- [ ] 16.13 [OWNER] Outside the change: UAM legal review of consent v2 and the privacy notice before production use (joins request-consent 9.7; changed wording means a new `CONSENT_VERSION` and pin)
