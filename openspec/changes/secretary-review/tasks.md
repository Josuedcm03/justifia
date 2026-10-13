# Tasks: Secretary Review

> Strict TDD (vitest): every behavior task is a RED task (failing test) followed by a GREEN task. Test commands: `npx vitest run <paths>`; quality gates per slice: `npm run typecheck`, `npx eslint src` (filter CRLF noise: `| rg -v 'Delete .␍.'`), `npm run format:check`.
> DB rule (`CLAUDE.md`): any task tagged `[CONFIRM]` needs the owner's explicit "yes" for that single command; `[READ-ONLY]` tasks may run unprompted. Slice code and unit tests never touch Neon; the only DB steps before Phase 7 are the opt-in integration run 3.16 and the manual harnesses 4.11 and 6.14, all tagged `[CONFIRM]`.
> Spec IDs: RF-06..RF-08, RN-02, RN-08, RN-15..RN-17, RNF-01, RNF-06, RNF-11, RNF-12 (payload minimisation cites RNF-06 and RN-02; RNF-02 is now encryption in transit and at rest). Decisions SR-1..SR-16 refer to `design.md`.
> UI tasks (S4, S5a, S5b) each end with a design-system check against `docs/design-system.md` (tokens only, 44 px `lg` targets, alert pattern, dialog spec, 360 px), pinned in the slice's `design-system` test.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~5,000 total (range 4,300-5,700), authored; generated migration and snapshot excluded |
| 400-line budget risk | High |
| 1000-line budget risk (session `review_budget_lines`) | Low (the budget counts production lines only, tests excluded; every slice is inside) |
| Chained PRs recommended | Yes |
| Suggested split | S1 -> S2 -> S3 -> S4 -> S5a -> S5b |
| Delivery strategy | ask-on-risk (review_budget_lines=1000, production lines only) |
| Chain strategy | feature-branch-chain |

| Slice | Production | Tests | Total | Budget note |
|-------|-----------:|------:|------:|-------------|
| S1 Pure domain | ~430 | ~570 | ~1,000 | Inside (production ~430) |
| S2 Schema | ~280 | ~400 | ~680 | Inside; plus ~250 generated lines (SQL, snapshot), not counted |
| S3 Data + access | ~600 | ~700 | ~1,300 | Inside (production ~600); no split |
| S4 Staff UI | ~450 | ~400 | ~850 | Inside |
| S5a Student list/detail | ~280 | ~300 | ~580 | Inside |
| S5b Correction | ~500 | ~600 | ~1,100 | Inside (production ~500); no split |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

Chain (decided by the owner): tracker branch `feat/secretary-review`. S1 branches from `feat/secretary-review` as `feat/secretary-review-s1-domain` and its PR targets the tracker; each later slice branches from the previous slice branch and its PR targets that branch. Only the tracker merges to `main`. The 1000-line review budget counts production lines only (tests excluded), so no slice is split.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| S1 | Pure domain: transitions, business days, calendar, templates, scope | PR 1 (base: tracker `feat/secretary-review`) | `npx vitest run src/lib/intake` | N/A: no runtime surface, pure functions | Revert new files under `src/lib/intake/` and the `validateSubmission` option |
| S2 | Schema, generated migration, class reader, audit types | PR 2 (base: S1 branch) | `npx vitest run src/db src/lib/audit src/lib/data/solicitud-clases.test.ts` | N/A: migration SQL read by test, not applied | Revert `schema.ts`, `drizzle/*_secretary_review.sql`, snapshot, journal entry, audit changes (unapplied) |
| S3 | Data layer, scope, document route, SR-16 | PR 3 (base: S2 branch) | `npx vitest run src/lib/data src/lib/auth src/app/api src/app/(dashboard)/users` | Opt-in `npm run test:integration` on a disposable Neon branch (concurrent decisions) | Revert data modules, permissions, route changes; migration stays additive |
| S4 | Staff queue, detail, decision dialog | PR 4 (base: S3 branch) | `npx vitest run src/app/(dashboard)/review src/components/app-sidebar.test.tsx` | `npm run dev`: secretaria walks queue -> detail -> each decision at 1280 px and 360 px | Revert `review/` pages, sidebar entry, `review.*` i18n keys |
| S5a | Student list and detail | PR 5 (base: S4 branch) | `npx vitest run src/app/(dashboard)/requests/page.test.tsx src/app/(dashboard)/requests/[id]` | `npm run dev`: student opens list and a returned request at 360 px | Revert `requests/page.tsx`, `requests/[id]/`, sidebar entry, `requests.*` keys |
| S5b | Correction flow, retire, resubmit | PR 6 (base: S5a branch) | `npx vitest run src/lib/data src/lib/intake src/app/(dashboard)/requests` | `npm run dev`: return a request, correct dates and a document, resubmit; check queue order | Revert correction context, `correct/` route, upload-token change |

## Phase 1: S1 - Pure domain (PR 1)

- [x] 1.1 Branch `feat/secretary-review-s1-domain` from the tracker `feat/secretary-review` (feature-branch-chain); its PR targets the tracker. No DB, no schema in this slice
- [x] 1.2 RED+GREEN: `src/lib/intake/transitions.test.ts` then `transitions.ts`; `canTransition(from,to,actor)` exhaustive over `EstadoSolicitud`, `en_revision_coordinacion` has no edge (RN-15, RN-16, SR-4)
- [x] 1.3 Add `NonWorkingDaysProvider` (`isNonWorkingDay`, `coversYear`) to `src/lib/intake/ports.ts` (SR-5)
- [x] 1.4 RED: `src/lib/intake/business-days.test.ts` table-driven over the spec boundary table (Mon/Tue/Wed/Thu, Fri->Mon, Sat->Mon/Tue/Wed), holiday skipped, Managua date vs UTC (2026-10-12 02:00 UTC = Sunday), year edge, `coversYear` false still computes (RN-08)
- [x] 1.5 GREEN: `src/lib/intake/business-days.ts` `deadlineOf`, `deadlineStatus` (2nd business day strictly after start; `en_plazo`/`por_vencer`/`vencida`)
- [x] 1.6 RED+GREEN: `src/lib/intake/adapters/constant-calendar.test.ts` then `constant-calendar.ts`: `constantCalendar(days: Readonly<Record<number, readonly string[]>>)` receives the holiday record as a parameter and is tested with fixture data only (listed date, unlisted date, `coversYear` true/false, empty year); it does not import `calendar.ts`
- [x] 1.7 Add `src/lib/intake/calendar.ts` (`NON_WORKING_DAYS`, wired as `constantCalendar(NON_WORKING_DAYS)`) with 2026 and 2027 national holidays plus Semana Santa dates as per-year ISO lists (draft values, marked "pending owner validation")
- [x] 1.8 RED+GREEN: calendar staleness test in `src/lib/intake/calendar.test.ts` using the real clock; fails when `NON_WORKING_DAYS[currentYear]` is missing or empty
- [x] 1.9 [OWNER] Owner validates the 2026 and 2027 non-working-day lists in `src/lib/intake/calendar.ts` (national holidays plus any UAM closures); remove the "pending" marker only after the owner's written "yes". STOP: S1 must not merge with unvalidated data **VALIDATED 2026-10-12** by the owner against the UAM academic calendar: whole Semana Santa (Mon-Fri) and Dia de las Madres (30 May) added; 1 and 10 Aug kept; 1 Jan and 25 Dec kept (national, in vacations).
- [x] 1.10 RED+GREEN: `src/lib/intake/return-reasons.test.ts` then `return-reasons.ts` (`fecha_incorrecta`, `fecha_alterada`, `documento_ilegible`; closed list, RN-17)
- [x] 1.11 RED: `src/lib/intake/decision-templates.test.ts`: every placeholder of every template is known, `renderTemplate` fills `{estudiante}`, `{causa}`, `{fechas}` (single day vs range), approve/reject/return coverage (SR-8)
- [x] 1.12 GREEN: `src/lib/intake/decision-templates.ts` (six templates, Spanish) and the date-range formatter
- [x] 1.13 RED+GREEN: `src/lib/intake/decision-validation.test.ts` then `src/lib/intake/decision-validation.ts` `validateDecision` (return needs RN-17 code, reject text trimmed 1..1000 with 1000 ok and 1001 refused, template kind matches `tipo`, unresolved `[...]` marker refused in reject text) (RF-07, RNF-12)
- [x] 1.14 RED+GREEN: `src/lib/intake/request-scope.test.ts` then `request-scope.ts` `requestScopeFor` (secretaria with facultad -> `facultad`; null facultad, other roles, null actor -> `none`) (SR-6, RNF-01)
- [x] 1.15 RED+GREEN: `validateSubmission(input, today, { filingWindow: false })` option in `src/lib/intake/submission.ts` with tests: RN-23 not applied, RN-05 and eligibility still applied (RN-23 not re-applied)
- [x] 1.16 Gates: `npx vitest run src/lib/intake`, typecheck, eslint, format:check; record exact results in the PR body (no DB command run)

## Phase 2: S2 - Schema, class reader, audit types (PR 2) - UNBLOCKED (2026-10-12)

- [x] 2.1 BLOCKER CHECK: RESOLVED 2026-10-12. `merge-grupo-into-asignatura` was archived (PR #15, f873b38) as option A, UI and routing only, with NO schema change: `Grupo` stays and `SolicitudAsignatura.GrupoId` keeps its FK. No `0008` exists, so this change generates the next migration (expected `0008`). New tables still carry no FK to `Grupo`; class reads go through `solicitud-clases.ts`. Before generating, re-check `drizzle/` on `main` for any newer migration and never hand-number
- [x] 2.2 RED: `src/db/migration-secretary-review.test.ts` locates the SQL by the `secretary_review` name; asserts `CK_Usuario_Ambito`, `CK_Solicitud_Reenvio`, `CK_Documento_Retiro`, `SolicitudDecision` CHECKs, `UQ_SolicitudRevision`, partial `IX_Solicitud_Cola`, FKs without `ON DELETE CASCADE`, no `Grupo` reference, additive only (SR-1, SR-2)
- [x] 2.3 GREEN: edit `src/db/schema.ts` per SR-1 (`Usuario.FacultadId`, `Solicitud.ReenviadaEn`, `DocumentoRespaldo.RetiradoEn`, `SolicitudRevision`, `SolicitudDecision`, `IX_Solicitud_Cola`), CHECK lists derived from code constants
- [x] 2.4 Run `npm run db:generate -- --name secretary_review` (generate only; expected `0008_secretary_review.sql`, unless a newer migration landed on `main`); verify the journal `when` is later than the last applied migration's `created_at` (0007 precedent: a lower value is skipped silently)
- [ ] 2.5 STOP [CONFIRM]: do not run `drizzle-kit migrate` or `push`; the migration is applied only in Phase 7
- [x] 2.6 RED: `src/lib/data/solicitud-clases.test.ts`: groups rows by solicitud, `docenteNombre` null allowed, no period returned, empty input -> empty map (SR-3)
- [x] 2.7 GREEN: `src/lib/data/solicitud-clases.ts` `listRequestClasses(q, ids)` joining `SolicitudAsignatura -> Grupo -> Asignatura -> Usuario` (the current schema; `SolicitudAsignatura.GrupoId` still references `Grupo`); the join lives only in this module
- [x] 2.8 RED: `src/lib/audit/events.test.ts`: seven new actions via five builders, table-driven (action -> entity type -> entity id), `Facultad` entity, `documento.descargado` carries `modo`, payload leak tests (no text, name, CIF, email, dates, file names, request id list), existing payloads unchanged (RNF-06, RN-02)
- [x] 2.9 GREEN: `src/lib/audit/types.ts` and `src/lib/audit/events.ts` (`solicitudDecididaEvent`, `solicitudCorregidaEvent`, `solicitudConsultadaEvent`, `solicitudColaConsultadaEvent`, `documentoRetiradoEvent`, `modo` on download)
- [x] 2.10 Gates: `npx vitest run src/db src/lib/audit src/lib/data/solicitud-clases.test.ts`, then `npm run db:generate -- --name drift_check_tmp` must write nothing (drift check, run only if it writes no file; otherwise STOP and ask)

## Phase 3: S3 - Data layer and access control (PR 3) - depends on S2

- [x] 3.1 RED+GREEN: `src/lib/auth/permissions.test.ts` then `permissions.ts`: `rolesRevisores`, `canReviewRequests`, `canViewDocument(viewer, doc, scope)` matrix (owner any state incl. retired; staff only in scope, visible state, `facultad` scope; other roles and `none` denied) (RN-15, RNF-01)
- [x] 3.2 RED+GREEN: `src/lib/data/request-scope-sql.test.ts` then `request-scope-sql.ts` (EXISTS via `Usuario.CarreraId -> Carrera.FacultadId`; `none` renders `false`; student without carrera invisible; snapshot career name never used) and `resolveRequestScope(userId, rol)` reading the DB per request (SR-6)
- [x] 3.3 RED: `src/lib/data/revision-queue.test.ts`: only `pendiente`, in scope, ordered `coalesce(ReenviadaEn, PresentadaEn), Id`, decided requests absent, resubmitted ordering, deadline status per row, `coversYear` flag surfaced
- [x] 3.4 GREEN: `src/lib/data/revision-queue.ts` `listReviewQueue(scope, now, calendar)` using `IX_Solicitud_Cola`, classes via `listRequestClasses`
- [x] 3.5 RED: `src/lib/data/solicitud-detail.test.ts`: staff detail with snapshot, classes, current documents, decisions, prior revisions, retired documents; draft, out-of-scope and unknown id all `not_found`; `devuelta`/decided viewable
- [x] 3.6 GREEN: `src/lib/data/solicitud-detail.ts` `getRequestDetail(scope, id)`
- [x] 3.7 RED: `src/lib/data/solicitud-decision.test.ts`: each of approve/reject/return writes state, one decision row, one audit row; return (`devuelta`) writes the `SolicitudRevision` snapshot of the returned version (`Numero = max+1`, classes, document ids), approve/reject write none; out-of-scope = `not_found`; already decided = `conflict`; audit insert failure rolls everything back; invalid reject text/code refused; actor from session
- [x] 3.8 GREEN: `src/lib/data/solicitud-decision.ts` `decideRequest` (guarded `UPDATE ... WHERE Estado = 'pendiente'` derived from `transitions.ts`, plus a test pinning SQL guard and table agree) (SR-4, SR-7)
- [x] 3.9 RED+GREEN: `src/lib/data/request-reads.test.ts` then `request-reads.ts` `recordRequestRead` wrapped in React `cache()` keyed `(actorId, solicitudId)`; one transaction, one row; queue variant writes count only (SR-11, RNF-06)
- [x] 3.10 RED: `src/app/api/intake/documents/[id]/route.test.ts` additions: `modo` absent = `ver`, `descarga` = attachment with RFC 5987 name, unknown mode -> uniform 404; in-scope secretary 200 + one audit row with mode; retired document visible to staff; out-of-scope, no facultad, `coordinacion`, draft, `pendiente` (unfinalized) file all identical 404 with no audit row; audit failure -> no bytes (SR-12)
- [x] 3.11 GREEN: `src/app/api/intake/documents/[id]/route.ts` and `src/lib/data/documentos.ts` `getDocumentForDownload` (returns `solicitudEstado`, `estudianteFacultadId`, `retiradoEn`); other headers unchanged
- [x] 3.12 RED: `src/app/(dashboard)/users/new/actions.test.ts`: `createStaffAction` derives `FacultadId` from the creating coordinator's `Carrera.FacultadId` for a new `secretaria` (a forged `facultadId` in the payload is ignored); a coordinator without carrera or facultad is refused and nothing is created; no new form field. `src/lib/data/users.test.ts`: `createUsuario` accepts and persists `facultadId`; `src/lib/audit/events.test.ts`: `facultadId` in `AUDITABLE_USER_FIELDS` (SR-16; `staff-account-creation` delta)
- [x] 3.13 GREEN: `createStaffAction` in `src/app/(dashboard)/users/new/actions.ts` deriving `FacultadId` server-side, `createUsuario` in `src/lib/data/users.ts` accepting `facultadId`, `AUDITABLE_USER_FIELDS` in `src/lib/audit/types.ts` (`staff-account-creation` delta)
- [x] 3.14 RED+GREEN: structural test `src/lib/data/append-only.test.ts`: no `update(` or `delete(` on `SolicitudDecision`/`SolicitudRevision` anywhere under `src` (SR-1)
- [x] 3.15 Extend `src/lib/data/integration/intake-concurrency.integration.test.ts`: two concurrent decisions on one `pendiente` request -> one decision row, one audit row, one `conflict` (opt-in suite)
- [x] 3.16 STOP [CONFIRM]: running the 3.15 suite needs the migration on a disposable Neon branch; ask the owner for explicit "yes" for (a) creating the child branch, (b) applying the migration there, (c) running `INTEGRATION_DATABASE_URL=<branch> INTEGRATION_ALLOW_WRITES=1 npm run test:integration`, (d) deleting the branch. Record results here **Written, run pending owner [CONFIRM] on a disposable Neon branch.** The 3.15 suite is written and type-checked but NOT run; the branch needs migration `0008_secretary_review` applied first. **RUN 2026-10-12** (owner-approved) on disposable Neon branch `test-secretary-review` (child of production, deleted after): 0008 applied there (__drizzle_migrations 8 -> 9; production stayed at 8), suite 6/6 on 2 consecutive runs (2 concurrent-decision cases + 4 intake). Doubles as the first rehearsal of 0008.
- [x] 3.17 Gates: `npx vitest run src/lib/data src/lib/auth src/app/api`, typecheck, eslint, format:check

## Phase 4: S4 - Staff UI (PR 4) - depends on S3

> **size:exception (owner decision 2026-10-13):** S4 ships as one PR with 1237 production lines (+328 i18n) against the 1000 budget; the owner declined the S4a/S4b split (247 / 990).

- [x] 4.1 RED+GREEN: `src/components/app-sidebar.test.tsx` then `src/components/app-sidebar.tsx`: `review` entry (`ClipboardCheck`, `visibleTo: canReviewRequests`); hidden for `estudiante`
- [x] 4.2 Add `review.*` keys to `i18n/es.json` and `i18n/en.json` plus key-parity test (RNF-12)
- [x] 4.3 RED: `src/app/(dashboard)/review/page.test.tsx`: role guard, `none` scope shows `alert` banner and no data, empty state, columns, deadline badges with text always present (`warning` "Due within 1 business day", `destructive` "Overdue"), no cause shown, "calendar not loaded" muted note, `Link prefetch={false}`
- [x] 4.4 GREEN: `src/app/(dashboard)/review/page.tsx` (RSC) calling `recordRequestRead` after authorization and data load; stacked cards at 360 px
- [x] 4.5 RED: `src/app/(dashboard)/review/[id]/page.test.tsx`: guard, `notFound()` for out-of-scope/draft/unknown, history section, document View/Download buttons (`size="lg"`), decision panel only when `pendiente`, exactly one audit row per render, render that throws before the event writes none, audit failure -> no data
- [x] 4.6 GREEN: `src/app/(dashboard)/review/[id]/page.tsx` (`PageHeader`, request data, classes, documents, history, decision panel)
- [x] 4.7 RED: `src/app/(dashboard)/review/[id]/decision-dialog.test.tsx` and `actions.test.ts`: template `RadioGroup` prefill and edit, return reason `RadioGroup`, `/1000` counter, reject confirm required (RNF-12), cancel changes nothing, errors with `role="alert"`, `conflict`/`not_found` banner, direct action call with empty reject text refused, action `redirect()`s with a status param, no `revalidatePath` of the detail
- [x] 4.8 GREEN: `decision-dialog.tsx` (AlertDialog; approve default, return `outline`, reject trigger `secondary` with `destructive` confirm, cancel `ghost`, all `lg`) and `actions.ts` (re-check auth/role/scope, `validateDecision`, `decideRequest`)
- [x] 4.9 RED+GREEN: structural test `src/app/(dashboard)/review/structure.test.ts`: the audit write (`recordRequestRead`) is called only from the review `page.tsx` modules, never from a `layout.tsx` or `loading.tsx` (SR-11 amendment, "Main Sync 2026-10-12"); every `<Link>` to `/review` and `/review/[id]` has `prefetch={false}` (SR-11)
- [x] 4.10 Design-system compliance (`docs/design-system.md`): tokens only (no hard-coded colors), type/ink tokens, alert pattern, pill badges, 44 px targets, dialog shadow/padding/buttons, focus rings; 360 px no horizontal scroll; pin in `src/app/(dashboard)/review/design-system.test.tsx`
- [ ] 4.11 [CONFIRM] Manual harness, run only against a disposable Neon branch or an owner-confirmed target; creating or updating any test secretaria/student account is a separate confirmed data step (`npm run dev`, needs migration applied and a secretaria with `FacultadId`, so after Phase 7): walk queue -> detail -> approve/return/reject at 1280 px and 360 px; confirm one `solicitud.consultada` row per open and none on hover/prefetch (read-only query of `EventoAuditoria`)

## Phase 5: S5a - Student list and detail (PR 5) - depends on S4

- [x] 5.1 RED+GREEN: sidebar `myRequests` (`/requests`, `visibleTo: canFileRequests`) in `src/components/app-sidebar.tsx` and its test
- [x] 5.2 Add `requests.*` keys (list, detail, history, state labels, RN-17 reason labels) to `i18n/es.json` and `i18n/en.json` with parity test (RNF-11)
- [x] 5.3 RED: `src/lib/data/student-requests.test.ts`: own `VISIBLE_STATES` only, newest first, owner identity from session, other student's id and unknown id identical, draft id not found, latest decision text and reason, history and revisions, no audit rows
- [x] 5.4 GREEN: `src/lib/data/student-requests.ts` (`listOwnRequests`, `getOwnRequestDetail`; classes via `listRequestClasses`)
- [x] 5.5 RED: `src/app/(dashboard)/requests/page.test.tsx` and `requests/[id]/page.test.tsx`: role guard (secretaria denied), unauthenticated denied, empty state with "New request", state badge, returned request shows reason and text, "Correct request" (`lg`, primary) only when `devuelta`
- [x] 5.6 GREEN: `src/app/(dashboard)/requests/page.tsx` and `src/app/(dashboard)/requests/[id]/page.tsx`
- [x] 5.7 Design-system compliance (`docs/design-system.md`) and 360 px no-horizontal-scroll test for list and detail, pinned in `src/app/(dashboard)/requests/design-system.test.tsx`
- [ ] 5.8 Gates and manual harness: `npx vitest run src/lib/data src/app/(dashboard)/requests`; walk list and a returned request at 360 px **Gates run (S5a); the 360 px walk is the owner step, not run here.**

## Phase 6: S5b - Correction flow (PR 6) - depends on S5a

- [x] 6.1 RED: tests for `EditTarget` (`draft` | `correction`) in `src/lib/data/solicitudes.test.ts` and `documentos.test.ts`: `editableWhere` returns own `devuelta` for correction and never `borrador`; `getLiveDraft`, `saveDraftDetails`, `saveDraftSubjects`, `finalizeDocument`, `removeDocument`, `getUploadContext` accept the target; foreign or non-`devuelta` request refused; finalize re-checks the 5-document cap excluding `RetiradoEn IS NOT NULL` (`supporting-documents` MODIFIED "At most five documents per request")
- [x] 6.2 GREEN: thread `EditTarget` through `src/lib/data/solicitudes.ts` and `src/lib/data/documentos.ts`; cap counts only `RetiradoEn IS NULL`
- [x] 6.3 RED: `src/app/api/intake/upload-token/route.test.ts` additions: token for own `devuelta` request via `solicitudId` in the pathname; foreign/other-state refused; cap ignores retired (`supporting-documents` MODIFIED "Upload authorization and limits" and "At most five documents per request")
- [x] 6.4 GREEN: `src/app/api/intake/upload-token/route.ts` derives the target from the pathname
- [x] 6.5 RED: `src/lib/data/documentos.test.ts`: removing a document in the latest revision's `DocumentoIds` sets `RetiradoEn` (blob kept) and writes `documento.retirado`; removing one uploaded during this correction hard-deletes; retired document excluded from RN-03 count
- [x] 6.6 GREEN: retire vs delete logic in `src/lib/data/documentos.ts` (same transaction as the audit row)
- [x] 6.7 RED: `src/lib/data/solicitud-correction.test.ts`: success keeps the same id, moves to `pendiente`, sets `ReenviadaEn`, writes one `solicitud.corregida` and no new `SolicitudRevision` row (the snapshot written by the return is kept); RN-23 not re-applied (end date 40 days old accepted); RN-05, eligibility via `GroupScheduleProvider`, zero valid documents, 5-document cap refused with all errors together; forged owner/snapshot ignored; concurrent resubmit -> one winner, exactly one `solicitud.corregida`, the loser adds no audit row; failure after the state change or at the audit insert rolls back (no new audit row, state still `devuelta`); no `borrador` row at any point
- [x] 6.8 GREEN: `src/lib/data/solicitud-correction.ts` `resubmitCorrection` (guarded `UPDATE ... WHERE Estado = 'devuelta'`, drift re-checks, student snapshot columns unchanged)
- [x] 6.9 RED: component tests for the four step components with `flow: { basePath, actions }` instead of `FLOW_PATH`, and `src/app/(dashboard)/requests/[id]/correct/page.test.tsx` + `actions.test.ts` (guard, only `devuelta`, step-1 schema without the filing window, redirect to `/requests/[id]?corrected=1`)
- [x] 6.10 GREEN: refactor `src/app/(dashboard)/requests/new/` step components to take `flow`; add `src/app/(dashboard)/requests/[id]/correct/page.tsx` and `actions.ts`; existing `/requests/new` flow stays green
- [x] 6.11 Add correction keys to `i18n/es.json` and `i18n/en.json` with parity test; design-system compliance (`docs/design-system.md`) and 360 px test for the correct screens, pinned in `src/app/(dashboard)/requests/correct-design-system.test.tsx`
- [x] 6.12 RED+GREEN: sweep test `src/app/api/cron/intake-sweep/route.test.ts`: retired document, its row and blob survive the 30-day sweep (SR-14); change the route only if the test fails **Written in `src/lib/data/intake-sweep.test.ts` (the route test mocks the sweep, the filters live in `intake-sweep.ts`); the test passed, so neither the route nor the sweep changed. Mutation check: widening the draft filter to `devuelta` fails it.**
- [x] 6.13 Update `docs/roadmap.md` row 2 owner to Armando (if not already in the working tree diff) **Already `Armando` in the committed roadmap; no change needed.**
- [ ] 6.14 [CONFIRM] Gates and manual harness (after Phase 7), run only against a disposable Neon branch or an owner-confirmed target; creating or updating any test secretaria/student account is a separate confirmed data step: return a request, correct dates and replace a document, resubmit; confirm queue position by `ReenviadaEn`, previous revision and retired document visible to staff

## Phase 7: Migration apply and data steps (owner-run, after S2 merged; before manual harness 4.11/6.14)

- [ ] 7.1 [READ-ONLY] P1: row counts by `Solicitud.Estado`, `DocumentoRespaldo`, `Usuario` by role, list of `secretaria` accounts (`select` only)
- [ ] 7.2 [READ-ONLY] P2: students with a presented request and `CarreraId IS NULL` (would be invisible, SR-6)
- [ ] 7.3 [CONFIRM] B1: create Neon branch `backup-before-secretary-review` from production; STOP and wait for "yes"
- [ ] 7.4 [CONFIRM] M1: `drizzle-kit migrate` over the direct (non-pooler) URL; STOP and wait for "yes" for this exact command
- [ ] 7.5 [READ-ONLY] V1: re-run P1 (counts identical); confirm new columns all NULL and `drizzle.__drizzle_migrations` gained one row with `created_at` equal to the journal `when`
- [ ] 7.6 [CONFIRM] V2: `db:generate` drift check writes nothing
- [ ] 7.7 [CONFIRM] F1 (SR-16 (a)): one-off `UPDATE "Usuario" SET "FacultadId" = <FIA id> WHERE "Id" = <existing secretaria id>`; show the id lookup (read-only) and the exact statement, wait for "yes"; then [READ-ONLY] re-select to confirm exactly one row changed
- [ ] 7.8 [CONFIRM] Delete the backup branch only when the owner says so

## Phase 8: Archive (after S5b merged)

- [ ] 8.1 Spec sync: merge deltas into `openspec/specs/{request-review,student-requests}/spec.md` (new) and `supporting-documents`, `audit-log`, `staff-account-creation` (MODIFIED/ADDED, replacing the "Previously" text); drop change-specific sections
- [ ] 8.2 Edit by hand the base `Purpose` paragraph of `openspec/specs/audit-log/spec.md`: remove "limited to WRITE events" and "Read-access auditing is out of scope and deferred" (the delta amends the Purpose in prose only; the merge does not apply it automatically)
- [ ] 8.3 Update `docs/roadmap.md`: row 2 `Estado` = `archivado`, note the calendar validation date and that secretary-owned templates stay in roadmap #10 (`secretary-templates`)
- [ ] 8.4 Archive the change folder to `openspec/changes/archive/<date>-secretary-review/`; run the full suite (`npm test`, `npm run build`) before closing
