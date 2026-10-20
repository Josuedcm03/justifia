# Tasks: Teacher Remission

> Strict TDD (vitest): every behavior task is a RED task (failing test) followed by a GREEN task. Test commands: `npx vitest run <paths>`; gates per slice: `npm run typecheck`, `npx eslint src` (filter CRLF noise: `| rg -v 'Delete .␍.'`), `npm run format:check`.
> DB rule (`CLAUDE.md`): tasks tagged `[CONFIRM]` need the owner's explicit "yes" for that single command; `[READ-ONLY]` may run unprompted; `[LOCAL]` touches no database. Slice code and unit tests never touch Neon.
> Spec IDs: RF-09 (a, b, c), RN-18, RN-19, RNF-01, RNF-02, RNF-06, RNF-07 (a, b), RNF-12. Decisions TR-1..TR-16 and D1-D8 refer to `design.md` and `proposal.md`.
> Skills for apply: `C:\Users\Arnia\.agents\skills\chained-pr\SKILL.md`, `C:\Users\Arnia\.agents\skills\work-unit-commits\SKILL.md` (registry: `C:\justifia\.atl\skill-registry.md`). One commit per work unit (test + code together).
> Threat matrix: N/A (design). New HTTP surfaces (token route, cron route, two actions) carry explicit RNF-01 RED tests below.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 9,156 authored total, measured per slice (S1 1,710; S2 1,784; S3 1,897; S4 1,709 with the cron; S5 1,470; S6 586); generated SQL snapshot and `openspec/` excluded |
| 400-line budget risk | High |
| 2000-line budget risk (session `review_budget_lines`) | Every slice is at or under 2,000 (owner rejected any `size:exception`) |
| Chained PRs recommended | Yes |
| Suggested split | S1 foundation -> S2 mail and data -> S3 dispatch -> S4 review UI -> S5 RN-19 upload backend -> S6 RN-19 upload UI |
| Delivery strategy | auto-chain (review_budget_lines=2000 per PR, no exceptions) |
| Chain strategy | feature-branch-chain |

| Slice | Branch | Content | Authored lines | Budget note |
|-------|--------|---------|---------------:|-------------|
| S1 Foundation | `feat/teacher-remission-s1-foundation` | Schema, migration 0009, audit events (unit 1); pure domain (unit 2) | 1,710 measured | Inside |
| S2 Mail and data | `feat/teacher-remission-s2-mail-data` | Mail port, Resend adapter, fake, env (unit 3); data layer `remision.ts` and `getSolicitudClases` (first half of unit 4) | 1,784 measured | Inside |
| S3 Dispatch | `feat/teacher-remission-s3-dispatch` | `remission-dispatch`, creation in the approval transaction, decision validation, concurrency test, write-surface pin (second half of unit 4); `after()` in `decideAction` (unit 5) | 1,897 measured | Inside |
| S4 Review UI | `feat/teacher-remission-s4-review-ui` | Retry cron (unit 6, 359 measured); detail section, resend, dialog mark, i18n (unit 7) | 1,709 measured | Inside (291 lines left; unit 8 needs ~1,200, so it was cut) |
| S5 Special format | `feat/teacher-remission-s5-special-format` | RN-19 upload backend (unit 8): token route, `inspectStoredFile`, `attachSpecialFormat`, attach action, student-list exclusion | 1,470 measured | Inside (head 734a262) |
| S6 Special format UI | `feat/teacher-remission-s6-special-format-ui` | RN-19 upload UI (unit 8): `special-format-upload.tsx`, section and page wiring, upload i18n keys, design-system pin | 586 measured | Inside (head 9f2b4e3) |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

Chain: tracker `feat/teacher-remission`. Each slice branches from the previous one and its PR targets the tracker (retarget as the previous slice merges into it; until then the diff shows the stacked commits). Only the tracker merges to `main`. Until S6 merges, marked requests stay blocked with `formato_especial_faltante` (spec allows it). Boundary notes: the mark and the dispatch rules for the format (backend) live in S3; the dialog checkbox is S4; the upload backend and the student-list filter are S5; the upload control is S6. All schema (including `SubidoPorId`, `FormatoEspecial`) ships in S1 so migration 0009 is one unit. `remision-writes.test.ts` (write-surface pin) lives in S3 because it scans `remission-dispatch.ts` and `solicitud-decision.ts`. The earlier single S1 (5,391 lines) and the S2 branch were replaced by this chain with identical source (`git diff 50067b0 <S3 head> -- src` is empty).

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Schema + generated migration 0009 + audit types/builders | S1 (base: tracker) | `npx vitest run src/db src/lib/audit` | N/A: SQL read by test, not applied | Revert `schema.ts`, `drizzle/0009*`, audit files (unapplied) |
| 2 | Pure domain `src/lib/remission/*` | S1 | `npx vitest run src/lib/remission` | N/A: pure functions | Revert `src/lib/remission/` |
| 3 | Mail port, Resend adapter, fake, env | S2 | `npx vitest run src/lib/intake src/env` | Manual Resend send with a test key (owner, after IT domain) | Revert adapter, port, deps, fake, env |
| 4a | Data layer: `remision.ts`, `getSolicitudClases` | S2 | `npx vitest run src/lib/data/remision src/lib/data/solicitud-clases` | N/A: DB double | Revert `remision.ts`, `solicitud-clases.ts` additions |
| 4b | Dispatch, creation in approval tx, validation, concurrency test | S3 | `npx vitest run src/lib/data src/lib/intake` | Opt-in `npm run test:integration` (concurrent claim) on a disposable branch | Revert dispatch module and decision changes |
| 5 | `decideAction`: `after()` dispatch, redirect when marked | S3 | `npx vitest run "src/app/(dashboard)/review"` | `npm run dev` approve with fake mail env unset: rows stay `pendiente` | Revert `actions.ts` |
| 6 | Retry cron + shared scheduler auth + `vercel.json` | S4 | `npx vitest run src/app/api/cron` | `curl` cron route with and without secret | Revert cron files and `vercel.json` entry |
| 7 | Detail remission section + "Reenviar" + dialog mark + i18n | S4 | `npx vitest run "src/app/(dashboard)/review" src/i18n` | `npm run dev`: approve, open detail, resend at 1280 and 360 px | Revert section, actions, dialog, i18n keys |
| 8 | RN-19 staff upload: token route, `inspectStoredFile`, `attachSpecialFormat`, upload UI, student exclusion | S5 (backend), S6 (UI) | `npx vitest run src/lib/data src/app/api/review "src/app/(dashboard)/review" src/lib/data/student-requests.test.ts` | `npm run dev`: marked approval -> upload format -> sent with only the format | Revert `special-format.ts`, token route, upload UI, filters |

## Phase 1: S1 - Schema, migration, audit (work unit 1)

- [x] 1.1 Branch `feat/teacher-remission-s1-foundation` (was `s1-outbox`, re-sliced) from the tracker `feat/teacher-remission`; PR targets the tracker. Re-check `drizzle/` on `main` for a newer migration than 0008
- [x] 1.2 RED: `src/db/migration-teacher-remission.test.ts` (pattern of `migration-secretary-review.test.ts`): SQL located by `teacher_remission` name; journal `when` later than 0008's; `UQ_Remision_SolicitudDocente`, `CK_Remision_*` (Estado, Motivo, Enviada, MotivoEstado, Correo, Reclamo, Intentos), `CK_Solicitud_FormatoEspecial`, `CK_Documento_FormatoEspecial`, `UX_Documento_FormatoEspecial`, partial `IX_Remision_Pendiente`; FKs without cascade; no `DROP`/`ALTER ... TYPE`; CHECK lists equal the TR-2 constants (TR-1, TR-3)
- [x] 1.3 GREEN: `src/db/schema.ts` per TR-1 (`Remision`, `Solicitud.FormatoEspecial`, `DocumentoRespaldo.SubidoPorId` and `FormatoEspecial`); constants live in `src/lib/remission/states.ts` (task 2.2 first; schema imports it)
- [x] 1.4 [LOCAL] `npm run db:generate -- --name teacher_remission` (generate only; expected `drizzle/0009_teacher_remission.sql`); verify journal `when` is later than the last applied `created_at`. STOP: no `migrate`/`push`
- [x] 1.5 RED: `src/lib/audit/events.test.ts` additions: five remission builders (`remision.creada|enviada|fallida|bloqueada|reenviada`) plus `documento.formato_especial`, table-driven action -> entity type (`Remision`; `DocumentoRespaldo`) -> entity id; payload shapes per TR-13; leak test over every new builder (no email, name, CIF, cause, file name, pathname, provider id, message text, even when the provider error contains an email); existing payloads unchanged (RNF-06)
- [x] 1.6 GREEN: `src/lib/audit/types.ts` (`Remision` entity, six actions) and `src/lib/audit/events.ts` builders

## Phase 2: S1 - Pure domain (work unit 2)

- [x] 2.1 RED+GREEN: `src/lib/remission/states.test.ts` then `states.ts` (`REMISSION_STATES`, `REMISSION_REASONS`, `REMISSION_TRIGGERS`; trigger -> allowed source states: cron and `formato_especial` only `pendiente`, manual `pendiente`+`bloqueada`) (TR-2)
- [x] 2.2 RED+GREEN: `src/lib/remission/recipients.test.ts` then `recipients.ts` `buildRemissionRows`: one row per distinct `DocenteId`, snapshot name/email/groups, null `correo` -> `bloqueada`+`sin_correo`, groups without teacher yield none (RF-09 a, D6)
- [x] 2.3 RED+GREEN: `src/lib/remission/limits.test.ts` then `limits.ts` (`MAX_REMISSION_ATTACHMENT_BYTES` 25 MiB; exactly at limit ok, one byte over refused) (D3)
- [x] 2.4 STOP [OWNER]: owner approved on 2026-10-19 the subject `Justificar la inasistencia de {estudiante}`, `RN18_WARNING` and `RN18_DISCRETION_NOTE` (only for `fuerza_mayor`), as written in design TR-10 (RN-18)
- [x] 2.5 RED: `src/lib/remission/message.test.ts`: Spanish subject/body, cause phrase, `{fechas}` reuse from `decision-templates.ts`, approved `RN18_WARNING` verbatim, student name and CIF, only that teacher's groups (T1 never sees T2's), attachment names, To = snapshot email, CC = student email
- [x] 2.6 GREEN: `src/lib/remission/message.ts` (pure, plain text only)
- [x] 2.7 RED: `src/lib/remission/plan.test.ts`: gate order `sin_correo` -> `formato_especial_faltante` -> `adjuntos_exceden_limite` -> send; unmarked sends only `SubidoPorId IS NULL` valid docs and never a staff upload; marked with format sends only the format; marked without format blocked; idempotency key `remision-{Id}-{digest}` stable for equal payload, changes with recipient/CC/attachment ids or sizes (TR-6, TR-7, RN-19)
- [x] 2.8 GREEN: `src/lib/remission/plan.ts` `planRemission` and the digest helper

## Phase 3: S2 - Mail port, adapter, fake, env (work unit 3)

- [x] 3.1 [READ-ONLY] Verify against current Resend docs (Context7 `resolve-library-id` "resend", then `query-docs`; fall back to official docs if absent): message size limit incl. base64 attachments (design assumes 40 MB), `Idempotency-Key` header semantics (window, behaviour after a failed first attempt, same key with changed payload), `POST /emails` request/response shape, attachment `content` base64 field. Record findings in `apply-progress` and adjust TR-10 / TR-9 if they differ; STOP and tell the owner if the limit differs from 25 MiB raw
- [x] 3.2 RED: `src/lib/intake/adapters/resend-mail-sender.test.ts` with injected fake `fetch`: URL, `Authorization: Bearer`, `Idempotency-Key`, JSON body with base64 attachments and CC, 20 s timeout signal, 2xx -> `{ok, providerId}`, 4xx -> `rejected`, 5xx/abort/network -> `unavailable`, missing `RESEND_API_KEY` or `MAIL_FROM` -> `not_configured` (asserted inside `send`, never at construction)
- [x] 3.3 GREEN: `src/lib/intake/adapters/resend-mail-sender.ts`
- [x] 3.4 RED+GREEN: `MailSender` types in `src/lib/intake/ports.ts`; `createFakeMailSender()` in `src/lib/intake/fakes.ts` (records messages; scriptable failure; dedupes by idempotency key) with its test; `IntakeDeps.mail` in `src/lib/intake/deps.ts` (`getIntakeDeps()` still works with mail env unset)
- [x] 3.5 RED+GREEN: `src/env.ts` `RESEND_API_KEY: optionalSecret(1)` and optional `MAIL_FROM`, with env test; document both in `.env.example` if present (NOT done: the file is outside the apply agent's permissions; the owner adds `RESEND_API_KEY=` and `MAIL_FROM=` lines)

## Phase 4: S2 (4.1-4.6, data layer) and S3 (4.7-4.10, dispatch) (work unit 4)

- [x] 4.1 RED+GREEN: `src/lib/data/solicitud-clases.test.ts` additions then `listRequestTeachers(tx, id)` returning `{ docenteId, nombre, correo, clases }` per teacher (TR-4)
- [x] 4.2 RED: `src/lib/intake/decision-validation.test.ts`: special-format mark accepted only on `aprobada`; refused on reject/return; GREEN: `decision-validation.ts`
- [x] 4.3 RED: `src/lib/data/solicitud-decision.test.ts` additions: approval inserts one `Remision` per distinct teacher plus one `remision.creada` each in the same tx; two groups same teacher -> one row; null email -> `bloqueada`+`sin_correo`; marked + non-`fuerza_mayor` -> rollback, request stays `pendiente`, nothing created; marked sets `FormatoEspecial` and rows are `bloqueada`+`formato_especial_faltante`; reject/return create none; audit or row-insert failure rolls back all; returns `remisionIds` and `formatoEspecial`; later catalog email change does not alter the snapshot
- [x] 4.4 GREEN: `src/lib/data/solicitud-decision.ts` per TR-4
- [x] 4.5 RED: `src/lib/data/remision.test.ts`: guarded claim per trigger (allowed states, expired lease takeover, held lease -> 0 rows, `enviada` never claimed), `Intentos` increments, guarded completion by `ReclamoId` (stale worker writes nothing), `listRemissions`, `unblockSpecialFormat` (only `bloqueada`+`formato_especial_faltante` -> `pendiente`; `sin_correo` stays), cron selector (oldest first, limit 20, `Intentos < 8`, skips held claims)
- [x] 4.6 GREEN: `src/lib/data/remision.ts`
- [x] 4.7 RED: `src/lib/data/remission-dispatch.test.ts` with `createFakeDocumentStore` and fake mail: success -> `enviada`, `EnviadaEn`, `ProveedorMensajeId`, `remision.enviada`; provider failure -> `pendiente`+`error_envio`, `remision.fallida`; `not_configured` -> `pendiente`; blockers -> `bloqueada` + `remision.bloqueada`; size guard before any download; missing blob -> `pendiente`+`error_envio`; manual resend of `sin_correo` refreshes email only if now set; `enviada` resend sends nothing and writes no audit; cron actor = approving secretary (`SolicitudDecision.SecretariaId`); `dispatchRemissions` never throws and logs codes only (RNF-07 a, b)
- [x] 4.8 GREEN: `src/lib/data/remission-dispatch.ts` (`dispatchRemission`, `dispatchRemissions`)
- [x] 4.9 RED+GREEN: structural test `src/lib/data/remision-writes.test.ts`: no `update(remision)`/`insert(remision)` outside `remision.ts`, `solicitud-decision.ts` (insert only) and `remission-dispatch.ts` via `remision.ts` (TR-1)
- [x] 4.10 Extend `src/lib/data/integration/intake-concurrency.integration.test.ts`: two parallel dispatches of one row -> one `send` call, one `EnviadaEn` (opt-in suite)
- [x] 4.11 STOP [CONFIRM] (PENDING OWNER; not run by apply): running 4.10 needs 0009 on a disposable Neon branch; ask the owner for an explicit "yes" separately for (a) creating the child branch, (b) applying 0009 there, (c) `INTEGRATION_DATABASE_URL=<branch> INTEGRATION_ALLOW_WRITES=1 npm run test:integration`, (d) deleting the branch. Record results here **RAN 2026-10-20** (owner-confirmed, each step): (a) branch `test-teacher-remission` (br-withered-cloud-ayn615lh) from production; (b) `db:migrate` applied 0009 there (migrations 9 -> 10, `Remision` empty, three new columns present, read-only check); (c) `test:integration`: 1 file, 8 tests passed in 55 s, including the two concurrent-dispatch cases of 4.10. (d) **DONE 2026-10-20** (owner-confirmed): branch deleted after the 9.11 walk.

## Phase 5: S3 - Approval wiring (work unit 5)

- [x] 5.1 RED: `src/app/(dashboard)/review/[id]/actions.test.ts` additions: on `aprobada` success `after()` is called once with `dispatchRemissions(remisionIds, { trigger: "aprobacion", actorId })`, actorId captured before `after`; marked approval redirects to `/review/{id}`, unmarked to `/review`; reject/return/conflict/invalid schedule nothing; mail failure never changes the outcome
- [x] 5.2 GREEN: `src/app/(dashboard)/review/[id]/actions.ts` (`after` from `next/server`; read `node_modules/next/dist/docs/` `after` guide first, per `AGENTS.md`)
- [x] 5.3 Gates S3: `npx vitest run src/db src/lib src/app/api src/app/(dashboard)/review src/env`, typecheck, eslint, format:check; `npm run build`; record exact results and the measured diff size (generated files excluded) in the PR body; no DB command run

## Phase 6: S4 - Retry cron (work unit 6)

> Re-sliced: work unit 6 ships as the first commit of S4 (`feat(remission): add the scheduled retry of pending remissions`). Tasks 6.1-6.3 are done; 6.4 (open PRs) covers the whole chain.

- [x] 6.1 RED: `src/app/api/cron/scheduler-auth.test.ts`: constant-time Bearer check, fails closed without `CRON_SECRET`; GREEN: extract `scheduler-auth.ts` from `intake-sweep/route.ts`, which now imports it (its existing test stays green)
- [x] 6.2 RED: `src/app/api/cron/remission-retry/route.test.ts`: 401 without/with wrong secret and nothing sent; with secret dispatches only `pendiente` rows (trigger `reintento_automatico`), skips `enviada` and rows at `Intentos >= 8`, bounded to 20, responds with counts only
- [x] 6.3 GREEN: `src/app/api/cron/remission-retry/route.ts` and `vercel.json` entry `{ "path": "/api/cron/remission-retry", "schedule": "0 10 * * *" }` (Hobby-compatible daily; confirm plan with owner, hourly on Pro)
- [x] 6.4 Open the chain PRs to the tracker, one per slice S1-S6 (chained-pr skill): body with forecast, gates, measured size, note that 0009 is generated but NOT applied **DONE 2026-10-20**: PRs #28-#33 (S1-S6) opened against the tracker and merged in order with merge commits; follow-up S7 #34 (resend hidden on `formato_especial_faltante`, found in 9.11) merged; slice branches deleted.

## Phase 7: migration apply (owner-run; after S1 merged, before the 9.11 walk)

- [x] 7.1 [READ-ONLY] P1: counts of `Solicitud` by `Estado`; teachers with `Correo IS NULL` among groups of pending requests **DONE 2026-10-20** (read-only): migrations 9; Solicitud borrador=1; DocumentoRespaldo 0; 0 teachers without `Correo` in pending requests; `Remision` absent.
- [x] 7.2 [CONFIRM] B1: ask the owner, then create Neon branch `backup-before-teacher-remission`; STOP and wait for "yes" **DONE 2026-10-20** (owner-confirmed): branch backup-before-teacher-remission (br-delicate-hall-ayom1nym) from production.
- [x] 7.3 [CONFIRM] M1: ask the owner for an explicit "yes" to this exact command, then `drizzle-kit migrate` over the direct (non-pooler) URL. Never run unprompted **DONE 2026-10-20** (owner-confirmed): db:migrate over the direct URL, "migrations applied successfully".
- [x] 7.4 [READ-ONLY] V1: P1 unchanged; `Solicitud.FormatoEspecial` and `DocumentoRespaldo.FormatoEspecial` all `false`, `SubidoPorId` all NULL, `Remision` empty; migrations count +1 **DONE 2026-10-20** (read-only): migrations 9 -> 10; counts unchanged; `Remision` empty; no `FormatoEspecial` true, `SubidoPorId` all NULL.
- [x] 7.5 [CONFIRM] V2: `db:generate` drift check writes nothing **DONE 2026-10-20** (owner-confirmed): "No schema changes, nothing to migrate", no file written.
- [x] 7.6 Mail rollout (owner/IT, not code): set `RESEND_API_KEY` and `MAIL_FROM` in Vercel only after UAM IT verifies the sender domain; first manual resend, then the cron takes over **DEFERRED to the owner (2026-10-20)**: operational, not a change deliverable; until then remissions stay `pendiente`/`error_envio` and the cron or "Reenviar" sends them once the env is set.

## Phase 8: S4 - Detail remission section and resend (work unit 7)

- [x] 8.1 Branch `feat/teacher-remission-s4-review-ui` from the S3 branch (created early to carry the cron commit); PR targets the tracker
- [x] 8.2 RED: `src/i18n/review-messages.test.ts` additions: `review.remission.*` and `review.decision.approve.specialFormat.*` parity in `es` and `en` (reason sentences for the four codes, states, actions, "no teacher identified"; the upload-error keys `empty_file|too_large|unsupported_format|already_attached|not_allowed` ship with S5 so S4 holds no unused keys); GREEN: add keys to `i18n/es.json` and `i18n/en.json`
- [x] 8.3 RED: `src/app/(dashboard)/review/[id]/remission-actions.test.ts` for `resendRemissionAction`: role guard, `none` scope -> `not_found`, unknown id equals out-of-scope (identical denial, no audit row, nothing sent), `enviada` -> `{ok, estado: "enviada"}` with nothing sent, `pendiente`/`bloqueada` awaits `dispatchRemission` with `reenvio_manual`, writes `remision.reenviada`, no `revalidatePath`/`redirect` (SR-11 exactly-once read)
- [x] 8.4 GREEN: `src/app/(dashboard)/review/[id]/remission-actions.ts` (`resendRemissionAction`)
- [x] 8.5 RED: `src/app/(dashboard)/review/[id]/remission-section.test.tsx`: shown only for `aprobada`, none for `devuelta`; per teacher name, snapshot email, groups, state pill with text, send time in `America/Managua`, reason sentence, "Reenviar" (`outline`, `lg`) hidden when `enviada`, pending state, `role="alert"` on failure, "no teacher identified" for teacherless groups; student views never get the email
- [x] 8.6 GREEN: `remission-section.tsx`; `page.tsx` adds `listRemissions(detail.id)` before `recordRequestRead` (one audit row per render, none for the section)
- [x] 8.7 RED: `decision-dialog.test.tsx` additions: RN-19 checkbox and hint only when `causa = fuerza_mayor`, absent otherwise, no file input anywhere in the dialog; GREEN: `decision-dialog.tsx` and mark passthrough in `actions.ts` payload
- [x] 8.8 Design-system check (`docs/design-system.md`: tokens only, pill badges with text, 44 px targets, alert pattern, 360 px stacked), pinned in `src/app/(dashboard)/review/design-system.test.tsx`

## Phase 9: S5 and S6 - Special-format upload (work unit 8)

> Cut from S4: after unit 7 the S4 diff is 1,709 authored lines against 2,000, and this unit is ~1,200. It ships as S5 (`feat/teacher-remission-s5-special-format`, from the S4 head). Re-sliced again during apply: S5 ships the backend (9.1-9.6, 9.8; 1,470 authored lines, 1,455 of them added) and the upload UI with its i18n keys (9.7, 9.9) moves to S6 `feat/teacher-remission-s6-special-format-ui` (the UI measured ~540 more lines, which would have taken S5 to ~2,010 before the 9.9 pin). S5 and S6 are both implemented and committed (S5 head 734a262, 1,470 lines; S6 head 9f2b4e3, 586 lines); the 9.10 gates are green on the S6 head; opening the PRs is pending (6.4).

- [x] 9.1 RED: `src/lib/data/documentos.test.ts`: existing `finalizeDocument` tests unchanged after extraction; new tests for `inspectStoredFile(pathname, store)` (valid pdf/png/jpeg, empty, oversized, forged type); GREEN: extract `inspectStoredFile` in `src/lib/data/documentos.ts`
- [x] 9.2 RED: `src/lib/data/special-format.test.ts` (`getSpecialFormatContext`, `attachSpecialFormat`): request locked `FOR UPDATE`; in-scope, `aprobada`, marked, no format required, else uniform denial; inserts `valido` document with detected type/real size, `SubidoPorId = actor`, `FormatoEspecial = true`; `unblockSpecialFormat` only `formato_especial_faltante` rows (`sin_correo` stays) plus other `pendiente` ids returned; writes `documento.formato_especial` (payload ids/type/size/count only); second attach and unique violations -> `already_attached`; refused file -> blob deleted best effort, `documento.rechazado`, nothing stored, rows stay blocked; no audit on denied/`already_attached`
- [x] 9.3 GREEN: `src/lib/data/special-format.ts`
- [x] 9.4 RED: `src/app/api/review/special-format-token/route.test.ts`: 401 unauthenticated, 403 `debeCambiarClave`, student/other roles, wrong prefix, out-of-scope, unmarked, not approved, already attached, unknown id all return the same `400 not_allowed` (RNF-01); success token limits (`ALLOWED_CONTENT_TYPES`, `MAX_DOCUMENT_BYTES`, TTL, no random suffix, no overwrite); no `onUploadCompleted`
- [x] 9.5 GREEN: `src/app/api/review/special-format-token/route.ts`
- [x] 9.6 RED: `remission-actions.test.ts` additions for `attachSpecialFormatAction(solicitudId, { pathname, nombreOriginal })`: role/scope/unknown-id denial, error codes mapped, success schedules `after(dispatchRemissions(ids, { trigger: "formato_especial", actorId }))`, returns rows as `pendiente`, no `revalidatePath`/`redirect`; marked + format sends only the format (end to end with fakes); GREEN: `attachSpecialFormatAction` in `remission-actions.ts`
- [x] 9.7 RED: `special-format-upload.test.tsx`: shown only when marked, approved and no format; client pre-check on size; `upload()` to the token route with pathname `intake/{id}/{uuid}.{ext}`, then the action; pending and `role="alert"` error states for each code; "sending in progress, reload" message; after success the format name with download link and control gone; no replace/remove/choose-existing control; GREEN: `special-format-upload.tsx` and its wiring in `remission-section.tsx`
- [x] 9.8 RED: `src/lib/data/solicitud-detail.test.ts` and `student-requests.test.ts`: staff detail exposes `formatoEspecial` and the format apart from student documents (`subidoPorStaff`); student list and detail exclude `SubidoPorId IS NOT NULL`; GREEN: `src/lib/data/solicitud-detail.ts`, `src/lib/data/student-requests.ts`. **DONE 2026-10-19** (S5, 9.1-9.6 and 9.8): five commits 862075b..0ef2afd on `feat/teacher-remission-s5-special-format`, 1,470 authored lines measured vs d488171; gates at 0ef2afd: `npm test` 228 files / 4,922 tests, typecheck, eslint CRLF-only, prettier `--end-of-line auto`, build clean
- [x] 9.9 Design-system and 360 px check for the upload control, pinned in `design-system.test.tsx`. **DONE 2026-10-19** (S6, 9.7 and 9.9): commits c54f38e and 0d5f741 on `feat/teacher-remission-s6-special-format-ui`, 586 authored lines measured vs 734a262; gates at the S6 head: `npm test` 229 files / 4,946 tests, typecheck, eslint CRLF-only, prettier `--end-of-line auto`, build clean
- [x] 9.10 Gates S5 and S6: `npx vitest run src/lib src/app src/i18n`, `npm test`, typecheck, eslint, format:check, `npm run build`; record measured diff size and open the S5 and S6 PRs (base: tracker). Gates DONE 2026-10-19 on the S6 head 9f2b4e3 (re-run by verify): `npm test` 229 files / 4,946 tests, typecheck, eslint CRLF-only, prettier `--end-of-line auto`, build clean; sizes S5 1,470 and S6 586. PR PENDING: opening the PRs is covered by 6.4 (chain of six slices S1-S6) **DONE 2026-10-20**: gates green on the rebased top b28ce03 (`npm test`, typecheck, build exit 0); PRs #32 (S5) and #33 (S6).
- [x] 9.11 [CONFIRM] Owner walk on a disposable Neon branch (0009 applied; seeded accounts are a separate confirmed data step): approve unmarked (fake or real mail) and marked `fuerza_mayor`; upload a format; resend; check 360 px, one `solicitud.consultada` per detail open, no audit row for denied/`already_attached` attempts (read-only query) **WALKED 2026-10-20** by the owner on `test-teacher-remission` (0009 applied; owner-confirmed practice accounts `estudiante.prueba` and `secretaria.prueba` and three enrollments), local dev server with the mail env blank: unmarked approval -> queue, row `pendiente`/`error_envio`, resend kept it pending; marked `fuerza_mayor` approval -> detail, row `bloqueada`/`formato_especial_faltante`; format upload -> row `pendiente` after reload (SR-11); the student does not see the format; 360 px check false. Read-only audit query: 27 events from the two accounts, codes and counts only, one `solicitud.consultada` per detail open. Finding fixed in S7: the resend control was offered on a `formato_especial_faltante` row, where it can change nothing; it is now hidden there (request-review spec + `remission-section.test.tsx`)

## Phase 10: Archive (after S6 merged)

- [x] 10.1 Spec sync: merge deltas into `openspec/specs/{request-review,audit-log}/spec.md` and create `openspec/specs/teacher-remission/spec.md`; drop change-specific sections **DONE 2026-10-20**: `openspec/specs/request-review/spec.md`: MODIFIED `Approve` replaced in place (title now `Approve (RF-07 a, RN-15, RF-09, RN-19)`, the old title matched by the rename), 3 ADDED blocks appended; the `(Previously: ...)` note not merged; the Purpose sentence on RF-09 was edited by hand (remission now lives in `teacher-remission`). `openspec/specs/audit-log/spec.md`: 3 ADDED blocks appended; Purpose checked and left unchanged (remission and format-upload events are write events, already covered). New `openspec/specs/teacher-remission/spec.md`: copied from the delta (9 requirements). Readback: `diff -r` of the new file against its delta is empty; each merged block matches its delta block (`diff -r` empty)
- [x] 10.2 Update `docs/roadmap.md` row 3 `Estado` = `archivado`; note follow-ups (replace/remove wrong format, `printable-forms` #12, `validation-signals` migration source) **DONE 2026-10-20**: row 3 Estado = `archivado` (Responsable unchanged, row 11 untouched); Notas bullet added for `teacher-remission`: mail rollout pending (`RESEND_API_KEY`, `MAIL_FROM` in Vercel after UAM IT verifies the sender domain), wrong special format replacement/removal out of scope, `printable-forms` #12, RN-19 overlap with `validation-signals` (RF-14 d)
- [x] 10.3 Archive the change folder to `openspec/changes/archive/<date>-teacher-remission/`; run `npm test` and `npm run build` first (no DB targeted) **DONE 2026-10-20**: `DATABASE_URL=postgres://u:p@127.0.0.1:9/x`, run one at a time: `npm test` 229 files, 4,947 passed, 0 failed; `npm run build` exit 0. Archive folder `openspec/changes/archive/2026-10-20-teacher-remission/` with the `git mv` and its `diff -r` readback recorded in `archive-report.md`
