# Tasks: Teacher Remission

> Strict TDD (vitest): every behavior task is a RED task (failing test) followed by a GREEN task. Test commands: `npx vitest run <paths>`; gates per slice: `npm run typecheck`, `npx eslint src` (filter CRLF noise: `| rg -v 'Delete .␍.'`), `npm run format:check`.
> DB rule (`CLAUDE.md`): tasks tagged `[CONFIRM]` need the owner's explicit "yes" for that single command; `[READ-ONLY]` may run unprompted; `[LOCAL]` touches no database. Slice code and unit tests never touch Neon.
> Spec IDs: RF-09 (a, b, c), RN-18, RN-19, RNF-01, RNF-02, RNF-06, RNF-07 (a, b), RNF-12. Decisions TR-1..TR-16 and D1-D8 refer to `design.md` and `proposal.md`.
> Skills for apply: `C:\Users\Arnia\.agents\skills\chained-pr\SKILL.md`, `C:\Users\Arnia\.agents\skills\work-unit-commits\SKILL.md` (registry: `C:\justifia\.atl\skill-registry.md`). One commit per work unit (test + code together).
> Threat matrix: N/A (design). New HTTP surfaces (token route, cron route, two actions) carry explicit RNF-01 RED tests below.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~3,300 total (production ~1,650, tests ~1,650); generated SQL and snapshot excluded |
| 400-line budget risk | High |
| 2000-line budget risk (session `review_budget_lines`) | S1 Medium (~2,000, at the limit), S2 Low (~1,300) |
| Chained PRs recommended | Yes |
| Suggested split | S1 (outbox + dispatch) -> S2 (review UI + RN-19 upload) |
| Delivery strategy | auto-chain (review_budget_lines=2000 per PR) |
| Chain strategy | feature-branch-chain |

| Slice | Production | Tests | Total | Budget note |
|-------|-----------:|------:|------:|-------------|
| S1 Outbox, dispatch, mail, cron | ~1,000 | ~1,000 | ~2,000 | At the limit; contingency: if the measured diff exceeds 2000, move work unit 6 (cron, ~140) to S2 |
| S2 Review UI, resend, RN-19 upload | ~650 | ~650 | ~1,300 | Inside |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

Chain: tracker `feat/teacher-remission`. S1 = `feat/teacher-remission-s1-outbox`, PR base = tracker. S2 = `feat/teacher-remission-s2-review-ui`, branched from S1, PR base = S1 branch so its diff shows only S2 (retarget to the tracker once S1 merges). Only the tracker merges to `main`. Until S2 merges, marked requests stay blocked with `formato_especial_faltante` (spec allows it). Boundary note: the mark and the dispatch rules for the format (backend) live in S1; the dialog checkbox, upload and student-list filter are S2. All schema (including `SubidoPorId`, `FormatoEspecial`) ships in S1 so migration 0009 is one unit.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Schema + generated migration 0009 + audit types/builders | S1 (base: tracker) | `npx vitest run src/db src/lib/audit` | N/A: SQL read by test, not applied | Revert `schema.ts`, `drizzle/0009*`, audit files (unapplied) |
| 2 | Pure domain `src/lib/remission/*` | S1 | `npx vitest run src/lib/remission` | N/A: pure functions | Revert `src/lib/remission/` |
| 3 | Mail port, Resend adapter, fake, env | S1 | `npx vitest run src/lib/intake src/env` | Manual Resend send with a test key (owner, after IT domain) | Revert adapter, port, deps, fake, env |
| 4 | Data: teachers, creation in approval tx, `remision.ts`, dispatch | S1 | `npx vitest run src/lib/data` | Opt-in `npm run test:integration` (concurrent claim) on a disposable branch | Revert data modules and decision changes |
| 5 | `decideAction`: `after()` dispatch, redirect when marked | S1 | `npx vitest run "src/app/(dashboard)/review"` | `npm run dev` approve with fake mail env unset: rows stay `pendiente` | Revert `actions.ts` |
| 6 | Retry cron + shared scheduler auth + `vercel.json` | S1 | `npx vitest run src/app/api/cron` | `curl` cron route with and without secret | Revert cron files and `vercel.json` entry |
| 7 | Detail remission section + "Reenviar" + dialog mark + i18n | S2 (base: S1 branch) | `npx vitest run "src/app/(dashboard)/review" src/i18n` | `npm run dev`: approve, open detail, resend at 1280 and 360 px | Revert section, actions, dialog, i18n keys |
| 8 | RN-19 staff upload: token route, `inspectStoredFile`, `attachSpecialFormat`, upload UI, student exclusion | S2 | `npx vitest run src/lib/data src/app/api/review "src/app/(dashboard)/review" src/lib/data/student-requests.test.ts` | `npm run dev`: marked approval -> upload format -> sent with only the format | Revert `special-format.ts`, token route, upload UI, filters |

## Phase 1: S1 - Schema, migration, audit (work unit 1)

- [ ] 1.1 Branch `feat/teacher-remission-s1-outbox` from the tracker `feat/teacher-remission`; PR targets the tracker. Re-check `drizzle/` on `main` for a newer migration than 0008
- [ ] 1.2 RED: `src/db/migration-teacher-remission.test.ts` (pattern of `migration-secretary-review.test.ts`): SQL located by `teacher_remission` name; journal `when` later than 0008's; `UQ_Remision_SolicitudDocente`, `CK_Remision_*` (Estado, Motivo, Enviada, MotivoEstado, Correo, Reclamo, Intentos), `CK_Solicitud_FormatoEspecial`, `CK_Documento_FormatoEspecial`, `UX_Documento_FormatoEspecial`, partial `IX_Remision_Pendiente`; FKs without cascade; no `DROP`/`ALTER ... TYPE`; CHECK lists equal the TR-2 constants (TR-1, TR-3)
- [ ] 1.3 GREEN: `src/db/schema.ts` per TR-1 (`Remision`, `Solicitud.FormatoEspecial`, `DocumentoRespaldo.SubidoPorId` and `FormatoEspecial`); constants live in `src/lib/remission/states.ts` (task 2.2 first; schema imports it)
- [ ] 1.4 [LOCAL] `npm run db:generate -- --name teacher_remission` (generate only; expected `drizzle/0009_teacher_remission.sql`); verify journal `when` is later than the last applied `created_at`. STOP: no `migrate`/`push`
- [ ] 1.5 RED: `src/lib/audit/events.test.ts` additions: five remission builders (`remision.creada|enviada|fallida|bloqueada|reenviada`) plus `documento.formato_especial`, table-driven action -> entity type (`Remision`; `DocumentoRespaldo`) -> entity id; payload shapes per TR-13; leak test over every new builder (no email, name, CIF, cause, file name, pathname, provider id, message text, even when the provider error contains an email); existing payloads unchanged (RNF-06)
- [ ] 1.6 GREEN: `src/lib/audit/types.ts` (`Remision` entity, six actions) and `src/lib/audit/events.ts` builders

## Phase 2: S1 - Pure domain (work unit 2)

- [ ] 2.1 RED+GREEN: `src/lib/remission/states.test.ts` then `states.ts` (`REMISSION_STATES`, `REMISSION_REASONS`, `REMISSION_TRIGGERS`; trigger -> allowed source states: cron and `formato_especial` only `pendiente`, manual `pendiente`+`bloqueada`) (TR-2)
- [ ] 2.2 RED+GREEN: `src/lib/remission/recipients.test.ts` then `recipients.ts` `buildRemissionRows`: one row per distinct `DocenteId`, snapshot name/email/groups, null `correo` -> `bloqueada`+`sin_correo`, groups without teacher yield none (RF-09 a, D6)
- [ ] 2.3 RED+GREEN: `src/lib/remission/limits.test.ts` then `limits.ts` (`MAX_REMISSION_ATTACHMENT_BYTES` 25 MiB; exactly at limit ok, one byte over refused) (D3)
- [x] 2.4 STOP [OWNER]: owner approved on 2026-10-19 the subject `Justificar la inasistencia de {estudiante}`, `RN18_WARNING` and `RN18_DISCRETION_NOTE` (only for `fuerza_mayor`), as written in design TR-10 (RN-18)
- [ ] 2.5 RED: `src/lib/remission/message.test.ts`: Spanish subject/body, cause phrase, `{fechas}` reuse from `decision-templates.ts`, approved `RN18_WARNING` verbatim, student name and CIF, only that teacher's groups (T1 never sees T2's), attachment names, To = snapshot email, CC = student email
- [ ] 2.6 GREEN: `src/lib/remission/message.ts` (pure, plain text only)
- [ ] 2.7 RED: `src/lib/remission/plan.test.ts`: gate order `sin_correo` -> `formato_especial_faltante` -> `adjuntos_exceden_limite` -> send; unmarked sends only `SubidoPorId IS NULL` valid docs and never a staff upload; marked with format sends only the format; marked without format blocked; idempotency key `remision-{Id}-{digest}` stable for equal payload, changes with recipient/CC/attachment ids or sizes (TR-6, TR-7, RN-19)
- [ ] 2.8 GREEN: `src/lib/remission/plan.ts` `planRemission` and the digest helper

## Phase 3: S1 - Mail port, adapter, fake, env (work unit 3)

- [ ] 3.1 [READ-ONLY] Verify against current Resend docs (Context7 `resolve-library-id` "resend", then `query-docs`; fall back to official docs if absent): message size limit incl. base64 attachments (design assumes 40 MB), `Idempotency-Key` header semantics (window, behaviour after a failed first attempt, same key with changed payload), `POST /emails` request/response shape, attachment `content` base64 field. Record findings in `apply-progress` and adjust TR-10 / TR-9 if they differ; STOP and tell the owner if the limit differs from 25 MiB raw
- [ ] 3.2 RED: `src/lib/intake/adapters/resend-mail-sender.test.ts` with injected fake `fetch`: URL, `Authorization: Bearer`, `Idempotency-Key`, JSON body with base64 attachments and CC, 20 s timeout signal, 2xx -> `{ok, providerId}`, 4xx -> `rejected`, 5xx/abort/network -> `unavailable`, missing `RESEND_API_KEY` or `MAIL_FROM` -> `not_configured` (asserted inside `send`, never at construction)
- [ ] 3.3 GREEN: `src/lib/intake/adapters/resend-mail-sender.ts`
- [ ] 3.4 RED+GREEN: `MailSender` types in `src/lib/intake/ports.ts`; `createFakeMailSender()` in `src/lib/intake/fakes.ts` (records messages; scriptable failure; dedupes by idempotency key) with its test; `IntakeDeps.mail` in `src/lib/intake/deps.ts` (`getIntakeDeps()` still works with mail env unset)
- [ ] 3.5 RED+GREEN: `src/env.ts` `RESEND_API_KEY: optionalSecret(1)` and optional `MAIL_FROM`, with env test; document both in `.env.example` if present

## Phase 4: S1 - Data layer and dispatch (work unit 4)

- [ ] 4.1 RED+GREEN: `src/lib/data/solicitud-clases.test.ts` additions then `listRequestTeachers(tx, id)` returning `{ docenteId, nombre, correo, clases }` per teacher (TR-4)
- [ ] 4.2 RED: `src/lib/intake/decision-validation.test.ts`: special-format mark accepted only on `aprobada`; refused on reject/return; GREEN: `decision-validation.ts`
- [ ] 4.3 RED: `src/lib/data/solicitud-decision.test.ts` additions: approval inserts one `Remision` per distinct teacher plus one `remision.creada` each in the same tx; two groups same teacher -> one row; null email -> `bloqueada`+`sin_correo`; marked + non-`fuerza_mayor` -> rollback, request stays `pendiente`, nothing created; marked sets `FormatoEspecial` and rows are `bloqueada`+`formato_especial_faltante`; reject/return create none; audit or row-insert failure rolls back all; returns `remisionIds` and `formatoEspecial`; later catalog email change does not alter the snapshot
- [ ] 4.4 GREEN: `src/lib/data/solicitud-decision.ts` per TR-4
- [ ] 4.5 RED: `src/lib/data/remision.test.ts`: guarded claim per trigger (allowed states, expired lease takeover, held lease -> 0 rows, `enviada` never claimed), `Intentos` increments, guarded completion by `ReclamoId` (stale worker writes nothing), `listRemissions`, `unblockSpecialFormat` (only `bloqueada`+`formato_especial_faltante` -> `pendiente`; `sin_correo` stays), cron selector (oldest first, limit 20, `Intentos < 8`, skips held claims)
- [ ] 4.6 GREEN: `src/lib/data/remision.ts`
- [ ] 4.7 RED: `src/lib/data/remission-dispatch.test.ts` with `createFakeDocumentStore` and fake mail: success -> `enviada`, `EnviadaEn`, `ProveedorMensajeId`, `remision.enviada`; provider failure -> `pendiente`+`error_envio`, `remision.fallida`; `not_configured` -> `pendiente`; blockers -> `bloqueada` + `remision.bloqueada`; size guard before any download; missing blob -> `pendiente`+`error_envio`; manual resend of `sin_correo` refreshes email only if now set; `enviada` resend sends nothing and writes no audit; cron actor = approving secretary (`SolicitudDecision.SecretariaId`); `dispatchRemissions` never throws and logs codes only (RNF-07 a, b)
- [ ] 4.8 GREEN: `src/lib/data/remission-dispatch.ts` (`dispatchRemission`, `dispatchRemissions`)
- [ ] 4.9 RED+GREEN: structural test `src/lib/data/remision-writes.test.ts`: no `update(remision)`/`insert(remision)` outside `remision.ts`, `solicitud-decision.ts` (insert only) and `remission-dispatch.ts` via `remision.ts` (TR-1)
- [ ] 4.10 Extend `src/lib/data/integration/intake-concurrency.integration.test.ts`: two parallel dispatches of one row -> one `send` call, one `EnviadaEn` (opt-in suite)
- [ ] 4.11 STOP [CONFIRM]: running 4.10 needs 0009 on a disposable Neon branch; ask the owner for an explicit "yes" separately for (a) creating the child branch, (b) applying 0009 there, (c) `INTEGRATION_DATABASE_URL=<branch> INTEGRATION_ALLOW_WRITES=1 npm run test:integration`, (d) deleting the branch. Record results here

## Phase 5: S1 - Approval wiring (work unit 5)

- [ ] 5.1 RED: `src/app/(dashboard)/review/[id]/actions.test.ts` additions: on `aprobada` success `after()` is called once with `dispatchRemissions(remisionIds, { trigger: "aprobacion", actorId })`, actorId captured before `after`; marked approval redirects to `/review/{id}`, unmarked to `/review`; reject/return/conflict/invalid schedule nothing; mail failure never changes the outcome
- [ ] 5.2 GREEN: `src/app/(dashboard)/review/[id]/actions.ts` (`after` from `next/server`; read `node_modules/next/dist/docs/` `after` guide first, per `AGENTS.md`)
- [ ] 5.3 Gates S1: `npx vitest run src/db src/lib src/app/api src/app/(dashboard)/review src/env`, typecheck, eslint, format:check; `npm run build`; record exact results and the measured diff size (generated files excluded) in the PR body; no DB command run

## Phase 6: S1 - Retry cron (work unit 6)

- [ ] 6.1 RED: `src/app/api/cron/scheduler-auth.test.ts`: constant-time Bearer check, fails closed without `CRON_SECRET`; GREEN: extract `scheduler-auth.ts` from `intake-sweep/route.ts`, which now imports it (its existing test stays green)
- [ ] 6.2 RED: `src/app/api/cron/remission-retry/route.test.ts`: 401 without/with wrong secret and nothing sent; with secret dispatches only `pendiente` rows (trigger `reintento_automatico`), skips `enviada` and rows at `Intentos >= 8`, bounded to 20, responds with counts only
- [ ] 6.3 GREEN: `src/app/api/cron/remission-retry/route.ts` and `vercel.json` entry `{ "path": "/api/cron/remission-retry", "schedule": "0 10 * * *" }` (Hobby-compatible daily; confirm plan with owner, hourly on Pro)
- [ ] 6.4 Open S1 PR to the tracker (chained-pr skill): body with forecast, gates, size, note that 0009 is generated but NOT applied

## Phase 7: S1 migration apply (owner-run; after S1 merged, before the S2 walk)

- [ ] 7.1 [READ-ONLY] P1: counts of `Solicitud` by `Estado`; teachers with `Correo IS NULL` among groups of pending requests
- [ ] 7.2 [CONFIRM] B1: ask the owner, then create Neon branch `backup-before-teacher-remission`; STOP and wait for "yes"
- [ ] 7.3 [CONFIRM] M1: ask the owner for an explicit "yes" to this exact command, then `drizzle-kit migrate` over the direct (non-pooler) URL. Never run unprompted
- [ ] 7.4 [READ-ONLY] V1: P1 unchanged; `Solicitud.FormatoEspecial` and `DocumentoRespaldo.FormatoEspecial` all `false`, `SubidoPorId` all NULL, `Remision` empty; migrations count +1
- [ ] 7.5 [CONFIRM] V2: `db:generate` drift check writes nothing
- [ ] 7.6 Mail rollout (owner/IT, not code): set `RESEND_API_KEY` and `MAIL_FROM` in Vercel only after UAM IT verifies the sender domain; first manual resend, then the cron takes over

## Phase 8: S2 - Detail remission section and resend (work unit 7)

- [ ] 8.1 Branch `feat/teacher-remission-s2-review-ui` from the S1 branch; PR base = S1 branch (retarget to tracker after S1 merges)
- [ ] 8.2 RED: `src/i18n/review-messages.test.ts` additions: `review.remission.*` and `review.decision.approve.specialFormat.*` parity in `es` and `en` (reason sentences for the four codes, states, actions, upload errors `empty_file|too_large|unsupported_format|already_attached|not_allowed`, "no teacher identified"); GREEN: add keys to `i18n/es.json` and `i18n/en.json`
- [ ] 8.3 RED: `src/app/(dashboard)/review/[id]/remission-actions.test.ts` for `resendRemissionAction`: role guard, `none` scope -> `not_found`, unknown id equals out-of-scope (identical denial, no audit row, nothing sent), `enviada` -> `{ok, estado: "enviada"}` with nothing sent, `pendiente`/`bloqueada` awaits `dispatchRemission` with `reenvio_manual`, writes `remision.reenviada`, no `revalidatePath`/`redirect` (SR-11 exactly-once read)
- [ ] 8.4 GREEN: `src/app/(dashboard)/review/[id]/remission-actions.ts` (`resendRemissionAction`)
- [ ] 8.5 RED: `src/app/(dashboard)/review/[id]/remission-section.test.tsx`: shown only for `aprobada`, none for `devuelta`; per teacher name, snapshot email, groups, state pill with text, send time in `America/Managua`, reason sentence, "Reenviar" (`outline`, `lg`) hidden when `enviada`, pending state, `role="alert"` on failure, "no teacher identified" for teacherless groups; student views never get the email
- [ ] 8.6 GREEN: `remission-section.tsx`; `page.tsx` adds `listRemissions(detail.id)` before `recordRequestRead` (one audit row per render, none for the section)
- [ ] 8.7 RED: `decision-dialog.test.tsx` additions: RN-19 checkbox and hint only when `causa = fuerza_mayor`, absent otherwise, no file input anywhere in the dialog; GREEN: `decision-dialog.tsx` and mark passthrough in `actions.ts` payload
- [ ] 8.8 Design-system check (`docs/design-system.md`: tokens only, pill badges with text, 44 px targets, alert pattern, 360 px stacked), pinned in `src/app/(dashboard)/review/design-system.test.tsx`

## Phase 9: S2 - Special-format upload (work unit 8)

- [ ] 9.1 RED: `src/lib/data/documentos.test.ts`: existing `finalizeDocument` tests unchanged after extraction; new tests for `inspectStoredFile(pathname, store)` (valid pdf/png/jpeg, empty, oversized, forged type); GREEN: extract `inspectStoredFile` in `src/lib/data/documentos.ts`
- [ ] 9.2 RED: `src/lib/data/special-format.test.ts` (`getSpecialFormatContext`, `attachSpecialFormat`): request locked `FOR UPDATE`; in-scope, `aprobada`, marked, no format required, else uniform denial; inserts `valido` document with detected type/real size, `SubidoPorId = actor`, `FormatoEspecial = true`; `unblockSpecialFormat` only `formato_especial_faltante` rows (`sin_correo` stays) plus other `pendiente` ids returned; writes `documento.formato_especial` (payload ids/type/size/count only); second attach and unique violations -> `already_attached`; refused file -> blob deleted best effort, `documento.rechazado`, nothing stored, rows stay blocked; no audit on denied/`already_attached`
- [ ] 9.3 GREEN: `src/lib/data/special-format.ts`
- [ ] 9.4 RED: `src/app/api/review/special-format-token/route.test.ts`: 401 unauthenticated, 403 `debeCambiarClave`, student/other roles, wrong prefix, out-of-scope, unmarked, not approved, already attached, unknown id all return the same `400 not_allowed` (RNF-01); success token limits (`ALLOWED_CONTENT_TYPES`, `MAX_DOCUMENT_BYTES`, TTL, no random suffix, no overwrite); no `onUploadCompleted`
- [ ] 9.5 GREEN: `src/app/api/review/special-format-token/route.ts`
- [ ] 9.6 RED: `remission-actions.test.ts` additions for `attachSpecialFormatAction(solicitudId, { pathname, nombreOriginal })`: role/scope/unknown-id denial, error codes mapped, success schedules `after(dispatchRemissions(ids, { trigger: "formato_especial", actorId }))`, returns rows as `pendiente`, no `revalidatePath`/`redirect`; marked + format sends only the format (end to end with fakes); GREEN: `attachSpecialFormatAction` in `remission-actions.ts`
- [ ] 9.7 RED: `special-format-upload.test.tsx`: shown only when marked, approved and no format; client pre-check on size; `upload()` to the token route with pathname `intake/{id}/{uuid}.{ext}`, then the action; pending and `role="alert"` error states for each code; "sending in progress, reload" message; after success the format name with download link and control gone; no replace/remove/choose-existing control; GREEN: `special-format-upload.tsx` and its wiring in `remission-section.tsx`
- [ ] 9.8 RED: `src/lib/data/solicitud-detail.test.ts` and `student-requests.test.ts`: staff detail exposes `formatoEspecial` and the format apart from student documents (`subidoPorStaff`); student list and detail exclude `SubidoPorId IS NOT NULL`; GREEN: `src/lib/data/solicitud-detail.ts`, `src/lib/data/student-requests.ts`
- [ ] 9.9 Design-system and 360 px check for the upload control, pinned in `design-system.test.tsx`
- [ ] 9.10 Gates S2: `npx vitest run src/lib src/app src/i18n`, `npm test`, typecheck, eslint, format:check, `npm run build`; record measured diff size and open the S2 PR (base: S1 branch)
- [ ] 9.11 [CONFIRM] Owner walk on a disposable Neon branch (0009 applied; seeded accounts are a separate confirmed data step): approve unmarked (fake or real mail) and marked `fuerza_mayor`; upload a format; resend; check 360 px, one `solicitud.consultada` per detail open, no audit row for denied/`already_attached` attempts (read-only query)

## Phase 10: Archive (after S2 merged)

- [ ] 10.1 Spec sync: merge deltas into `openspec/specs/{request-review,audit-log}/spec.md` and create `openspec/specs/teacher-remission/spec.md`; drop change-specific sections
- [ ] 10.2 Update `docs/roadmap.md` row 3 `Estado` = `archivado`; note follow-ups (replace/remove wrong format, `printable-forms` #12, `validation-signals` migration source)
- [ ] 10.3 Archive the change folder to `openspec/changes/archive/<date>-teacher-remission/`; run `npm test` and `npm run build` first (no DB targeted)
