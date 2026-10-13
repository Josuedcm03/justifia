# Apply progress: secretary-review

## S1 Pure domain (branch `feat/secretary-review-s1-domain`)

Status: partial. Tasks 1.1-1.8 and 1.10-1.16 done; 1.9 is the owner STOP gate (open).

| Task | State | Evidence |
|---|---|---|
| 1.1 | done | branch created from the tracker |
| 1.2 | done | `transitions.ts` + test (7 tests) |
| 1.3 | done | `NonWorkingDaysProvider` in `ports.ts` |
| 1.4-1.5 | done | `business-days.ts` + test (26 tests) |
| 1.6 | done | `adapters/constant-calendar.ts` + test (4 tests) |
| 1.7-1.8 | done | `calendar.ts` (pending owner validation) + staleness test |
| 1.9 | OPEN (owner) | holiday lists await the owner's written "yes" |
| 1.10 | done | `return-reasons.ts` + test |
| 1.11-1.12 | done | `decision-templates.ts` + test (17 tests) |
| 1.13 | done | `decision-validation.ts` + test (20 tests) |
| 1.14 | done | `request-scope.ts` + test |
| 1.15 | done | `validateSubmission(..., { filingWindow: false })` + 4 tests |
| 1.16 | done | gates below |

Gates: `npx vitest run src/lib/intake` 24 files / 197 tests green; `npm test` 154 files / 3008 tests green; `tsc --noEmit` clean except stale ignored `.next/types` (pre-existing); eslint and prettier clean on all changed files (repo-wide eslint/format:check show only CRLF noise from untouched files).

Lines vs tracker: production 515, tests 662.
No database command was run.

## S2 Schema, class reader, audit types (branch `feat/secretary-review-s2-schema`, from the tracker @ 7184f37)

Status: partial. Tasks 2.1-2.4 and 2.6-2.10 done; 2.5 is the STOP gate (the migration is never applied here, only in Phase 7).

| Task | State | Evidence |
|---|---|---|
| 2.1 | done | blocker resolved before this slice; `drizzle/` on `origin/main` has no newer migration than 0007 |
| 2.2 | done | `src/db/migration-secretary-review.test.ts` (22 tests); RED confirmed (22 failed, SQL missing) |
| 2.3 | done | `schema.ts`: `Usuario.FacultadId` + `CK_Usuario_Ambito`, `Solicitud.ReenviadaEn` + `CK_Solicitud_Reenvio` + `IX_Solicitud_Cola`, `DocumentoRespaldo.RetiradoEn` + `CK_Documento_Retiro`, `SolicitudRevision`, `SolicitudDecision`; CHECK lists derive from `CAUSAS`, `RETURN_REASONS`, new `DECISION_KINDS` |
| 2.4 | done | `drizzle/0008_secretary_review.sql`; journal `when` 1791852138908 > 0007 `when` 1791672226324 |
| 2.5 | OPEN (STOP) | no `drizzle-kit migrate`/`push`, no SQL against Neon |
| 2.6-2.7 | done | `solicitud-clases.ts` + test (6 tests) |
| 2.8-2.9 | done | 5 builders for 7 actions, `Facultad` entity, `modo` on download; tests in `events.test.ts` and `types.test.ts` |
| 2.10 | done | gates below; drift check `db:generate --name drift_check_tmp` printed "No schema changes, nothing to migrate" and wrote no file |

Side changes forced by the schema (kept minimal): `usuarioConRolColumns` and `createUsuario` return `facultadId` (the `UsuarioConRol` type now requires it; test in `users-data.test.ts`); `recordDocumentDownload` takes an optional `modo` defaulting to `ver` (the route serves inline views today; S3 passes the real mode); `DECISION_KINDS` exported from `decision-templates.ts` and reused by `decision-validation.ts`.

Deviation from design SR-1: `CK_SolicitudDecision_Texto` is null-safe (`Tipo = 'aprobada' OR (Texto IS NOT NULL AND length(btrim(Texto)) > 0)`) because a CHECK evaluating to NULL passes.

Gates: `npx vitest run src/db src/lib/audit src/lib/data/solicitud-clases.test.ts` green; `npm test` 156 files / 3053 tests green; `npx next typegen` + `npm run typecheck` clean; eslint on changed files clean apart from repo-wide CRLF noise; prettier clean on changed files (tasks.md was already unformatted on the tracker).

Lines vs tracker: production 450, tests 608, generated 1435 (SQL 46, snapshot 1382, journal 7). No database command was run.

## S3 Data layer, access, document route, SR-16 (branch `feat/secretary-review-s3-data`, from the tracker @ ddfbe03)

Status: partial. Tasks 3.1-3.15 and 3.17 done; 3.16 is the STOP gate (the integration suite is written and type-checked, NOT run: it needs an owner [CONFIRM] on a disposable Neon branch with migration `0008_secretary_review` applied).

| Task | State | Evidence |
|---|---|---|
| 3.1 | done | `permissions.ts`: `rolesRevisores`, `canReviewRequests`, `canViewDocument(viewer, doc, scope)`; matrix in `permissions.test.ts` (RED: 14 failed first run) |
| 3.2 | done | `request-scope-sql.ts` (`requestInScope`, `requestRowInScope`, EXISTS via aliased Usuario/Carrera, inner join, `none` = `false`) and `request-scope.ts` (`resolveRequestScope`, per-request DB read, no read for non-reviewing roles); 17 tests |
| 3.3-3.4 | done | `revision-queue.ts` `listReviewQueue(scope, now, calendar)` returns `{ rows, calendarLoaded }`; 14 tests; `db-double` records `orderBy` |
| 3.5-3.6 | done | `solicitud-detail.ts` `getRequestDetail(scope, id)` (null for absent/draft/out-of-scope); 13 tests |
| 3.7-3.8 | done | `solicitud-decision.ts` `decideRequest` (guarded UPDATE from the RN-16 table, revision snapshot on return, decision row, audit row, one transaction); 27 tests |
| 3.9 | done | `request-reads.ts` `recordRequestRead(actorId, solicitudId, estado)` and `recordQueueRead(actorId, facultadId, total)`, both React `cache()`; 10 tests |
| 3.10-3.11 | done | route `?modo=ver|descarga` (absent = ver, anything else uniform 404 before the lookup), staff scope via `resolveRequestScope` + `canViewDocument`, `modo` in the audit row; `getDocumentForDownload` returns `estudianteFacultadId`, `solicitudEstado`, `retiradoEn`; `attachmentDisposition` |
| 3.12-3.13 | done | `createStaffAction` derives `FacultadId` via new `getUserFacultadId` (only for `secretaria`; null -> form error `errors.facultadRequired`, nothing created); `facultadId` in `AUDITABLE_USER_FIELDS`; `createUsuario` already persisted `facultadId` (test added) |
| 3.14 | done | `append-only.test.ts` (RED shown with a temporary offender file, then removed) |
| 3.15 | done (written) | `intake-concurrency.integration.test.ts` suite "concurrent decisions on one pending request" for 2 and 6 deciders; `fixtures.ts` gains `addSecretaria()` and cleans decisions and revisions it created |
| 3.16 | OPEN (STOP) | written, run pending owner [CONFIRM] on a disposable Neon branch; branch needs `0008_secretary_review` applied |
| 3.17 | done | gates below |

Deviations from design (all minor): `getRequestDetail` returns `null` instead of a `not_found` outcome object; `decideRequest` re-validates with `validateDecision` and returns `invalid` (defence in depth over the action's own validation); `recordRequestRead` takes primitive arguments (the `cache()` key) instead of a detail object and a `recordQueueRead` sibling was added; new i18n key `users.new.errors.facultadRequired` (es/en) for the SR-16 refusal; `append-only.test.ts` skips `src/lib/data/integration` (disposable-branch fixtures cleanup deletes the history rows a test created); `usuario.creado` import payloads now list `facultadId` among `campos` (spec-intended).

Gates: `npm test` 163 files / 3215 tests green; `npx next typegen` + `npm run typecheck` clean; eslint and prettier clean on changed files apart from repo-wide CRLF noise (checked with CR stripped). No database command was run; the integration suite was not run.

Lines vs tracker: production 753, tests 2356 (including integration fixtures); `.engram` sync chunks added by the pre-commit hook and the openspec docs are excluded.

## S4 Staff review UI (branch `feat/secretary-review-s4-staff-ui`, from the tracker @ 2c17681)

Status: partial. Tasks 4.1-4.10 done; 4.11 is the [CONFIRM] manual harness (owner work on a disposable Neon branch after Phase 7, not run here). Mode: Strict TDD.

| Task | State | Evidence |
|---|---|---|
| 4.1 | done | sidebar `review` entry (`ClipboardCheck`, `canReviewRequests`, `prefetch: false`); sidebar test 94/94 (RED: 4 failed before the entry and the `nav.review` key) |
| 4.2 | done | `review.*` keys in both catalogs (queue, detail, decision, notFound) plus `src/i18n/review-messages.test.ts` (key parity, non-empty text, every template and RN-17 reason labelled, every validation error worded; RED seen with the decision keys missing: 2 failed) |
| 4.3-4.4 | done | `review/page.tsx` + `deadline-badge.tsx`; `page.test.tsx` 28 tests (role guard on the real dal, `none` scope alert and no query, empty state, columns, three badges as text, no cause, calendar note, one queue-read row, stacked cards, `prefetch={false}`); RED: module missing |
| 4.5-4.6 | done | `review/[id]/page.tsx` + `request-sections.tsx` + `not-found.tsx`; `page.test.tsx` 40 tests (guard, malformed id, out-of-scope/draft/unknown identical `notFound()`, sections, View/Download via `?modo`, decision panel only while `pendiente`, history, one audit row, none on a throwing load or derived value, no data on audit failure) |
| 4.7-4.8 | done | `review/[id]/actions.ts` (31 tests) and `decision-dialog.tsx` (21 tests): templates prefilled and editable, reason picks the return template, `/1000` counter, reject two-step (secondary trigger, destructive confirm), cancel/Escape change nothing, field errors `role="alert"`, conflict/not_found banner with a way back, redirect with `?resultado=`, no `revalidatePath` |
| 4.9 | done | `review/structure.test.ts` 17 tests; RED shown with a temporary `layout.tsx` calling `recordRequestRead` and a prefetching `<Link>` (4 failed), then removed |
| 4.10 | done | `review/design-system.test.tsx` 24 tests (source scans: no hard-coded colour, type steps, spacing steps; pins: pills, cards, dialog hierarchy at 44 px, alert pattern, 360 px guards). RED found real off-grid pill spacing (`px-2.5 py-0.5`), fixed to `px-3 py-1` |
| 4.11 | OPEN ([CONFIRM]) | owner walk on a disposable branch; steps are in the S4 report |

Deviations from design (all minor): `conflict`/`not_found` are returned to the dialog as an `alert` banner with a link back (the action redirects only on success, so the detail never re-renders); the success status is shown on the queue (`?resultado=aprobada|rechazada|devuelta`, `role="status"`); the queue renders a `md:hidden` card list plus a `hidden md:block` table (two renderings of the same rows); templates are rendered on the server and passed to the dialogs; template i18n keys replace `.` with `_` (next-intl reads a dot as a path); status pills use the 12/4 spacing steps instead of the 10/2 of the catalog pill; the action payload is parsed with zod and an invalid id answers `not_found`; the sidebar link opts out of prefetch (`prefetch: false` on the nav entry).

Gates: `npm test` 171 files / 3392 tests green; `npx next typegen` + `npm run typecheck` clean; `npm run build` ok (`/review` and `/review/[id]` dynamic); eslint and prettier clean on changed files (CR stripped). No database command was run.

Lines vs tracker: production 1237 code lines (actions 81, dialog 304, detail page 181, sections 390, queue page 200, badge 30, not-found 27, template-key 7, sidebar 17) plus 328 i18n lines; tests 2525. The 1000-line production budget was exceeded (see the S4 report: size:exception or a split at the commit boundaries is recommended).

## S5a Student requests list and detail (branch `feat/secretary-review-s5a-student`, from the tracker @ fbdf2e2)

Status: partial. Tasks 5.1-5.7 done; 5.8 gates done, the 360 px walk is the owner step (not run here). Mode: Strict TDD. Corrections (`correct/` route, EditTarget, resubmit, retire) are S5b and are not implemented; the detail only links to `/requests/[id]/correct`.

| Task | State | Evidence |
|---|---|---|
| 5.1 | done | sidebar `myRequests` (`ListChecks`, `/requests`, `canFileRequests`) between the dashboard and `newRequest`; `isCurrentTopLevel` lets the more specific `/requests/new` own its page so two entries are never current together; sidebar test 103/103 (RED: 6 failed first run; safety net 94/94 before) |
| 5.2 | done | `requests.*` keys (list, detail, history, state labels, RN-17 reasons, not found) plus `nav.myRequests` in both catalogs; `src/i18n/requests-messages.test.ts` 8 tests (RED: 7 failed before the keys) |
| 5.3-5.4 | done | `student-requests.ts` `listOwnRequests(userId)` and `getOwnRequestDetail(userId, id)`; 15 tests (RED: module missing). Owner and `VISIBLE_STATES` in the WHERE, newest first, current documents only (`RetiradoEn IS NULL`), no secretary name or template code, latest decision only while `devuelta`/`rechazada`/`aprobada` (otherwise every decision is history), selects only |
| 5.5-5.6 | done | `requests/page.tsx` (+ `request-card.tsx`, `state-pill.tsx`, `use-request-dates.ts`) and `requests/[id]/page.tsx` (+ `detail-sections.tsx`, `not-found.tsx`); `page.test.tsx` 19 tests and `[id]/page.test.tsx` 30 tests (real dal on a mocked session: other roles to `/denied`, anonymous to `/login`, flagged to the change screen; malformed id, another student's id, draft and unknown id are the same `notFound()`; empty state with New request; state pills as text; reason and text; Correct request only for `devuelta`; no deadline; audit writers never called; Spanish catalog) |
| 5.7 | done | `requests/design-system.test.tsx` 21 tests (token, type, spacing scans of the student modules only; pills; cards; 44 px targets; 360 px guards: no fixed width, no table, full-row actions, wrapping names and text). Mutation check: an offending class in `state-pill.tsx` failed 6 tests, then reverted |
| 5.8 | gates done; walk OWNER | see Gates; the 360 px walk of the list and a returned request is the owner step |

Deviations from design (all minor): the list is one stacked card per request at every width (no `DataTable`, no second rendering), because the student has few rows and one rendering cannot drift at 360 px; the staff detail's `Section` and `Fact` are reused (`Fact` is now exported from `review/[id]/request-sections.tsx`), the student text lives in `requests.*`; the data layer returns `decision` (latest, only while returned or decided) and `historial` (every other decision) instead of one list, so the page holds no rule; retired documents are not shown to the student (the correction slice owns them); `/requests/[id]/correct` does not exist yet, so the Correct request link 404s until S5b; the "alert pattern" of the design-system task has nothing to pin because the screens render no alert.

Gates: `npm test` 176 files / 3494 tests green; `npx next typegen` + `npm run typecheck` clean; `npm run build` ok (`/requests` and `/requests/[id]` dynamic); eslint and prettier clean on changed files (CR stripped). No database command was run.

Lines vs tracker: production 757 code lines (data 166, detail sections 293, detail page 85, list page 53, card 52, pill 28, dates hook 27, not-found 23, sidebar 23, `Fact` export 7) plus 154 i18n lines; tests 1466. Inside the 1000 budget.

## S5b Student correction flow (branch `feat/secretary-review-s5b-correction`, from the tracker @ 69ffdf3)

Status: partial. Tasks 6.1-6.13 done; 6.14 is the [CONFIRM] manual harness (owner work on a disposable Neon branch after Phase 7, not run here). Mode: Strict TDD. No database command was run.

| Task | State | Evidence |
|---|---|---|
| 6.1-6.2 | done | `EditTarget` (`draft` or `correction`), `editableWhere`, `ownedWhere` in `solicitudes.ts`; `getLiveDraft`, `saveDraftDetails`, `saveDraftSubjects`, `getUploadContext`, `finalizeDocument`, `removeDocument` take the target (default draft). A correction matches `Id + EstudianteId + Estado = 'devuelta'`, never `borrador`, no liveness cut-off. The 5-document count and the documents of a correction exclude `RetiradoEn IS NOT NULL`. RED: 12 failed first run (`solicitudes.test.ts` 7, `documentos.test.ts` 5); safety net 74/74 before |
| 6.3-6.4 | done | upload-token route: `solicitudIdOf(pathname)` (new, `pathnames.ts`) names the request, the route asks `getUploadContext` for the correction first and then the live draft, then keeps `isUnderDraftPrefix` and the cap. RED: 15 failed (route 7, pathnames 8) |
| 6.5-6.6 | done | `removeDocument`: a document in the latest revision's `DocumentoIds` is retired (`RetiradoEn`, record and file kept, `documento.retirado`); one uploaded during the correction is deleted (`documento.eliminado`), same transaction as the audit row. RED: 5 failed |
| 6.7-6.8 | done | `solicitud-correction.ts` `resubmitCorrection`: reloads the returned request, `validateSubmission(..., { filingWindow: false })` plus the 5-document cap with every error together, then one transaction: guarded UPDATE (`ReenviadaEn`), drift re-checks, one `solicitud.corregida`; no snapshot written. 22 tests (RED: module missing) including a pin that the SQL guard and the RN-16 table agree |
| 6.9-6.10 | done | `flow.ts` (`StepFlow`), the four steps and the stepper take an optional flow (base path and actions) and default to the new-request flow; `ResubmitDialog`; `FlowSteps` (shared layout of both pages); `step-actions.ts` (step logic shared by the draft and correction actions); `correct/actions.ts` (5 actions, 22 tests); `correct/page.tsx` (15 tests). The detail page confirms `?corrected=1`. RED: 12 component tests failed first run; existing flow tests stayed green (only the draft actions' call assertions gained the target) |
| 6.11 | done | `intake.correction.*`, `intake.errors.not_correctable`, `requests.detail.corrected` in es and en; `src/i18n/correction-messages.test.ts` (7); `requests/correct-design-system.test.tsx` (15; mutation check: an off-scale class in `resubmit-dialog.tsx` failed 3 tests, then reverted) |
| 6.12 | done | tests in `intake-sweep.test.ts` (4): the draft sweep is `borrador` only, a retired document keeps row and blob at 40 days. Neither the route nor the sweep changed. Mutation check: widening the draft filter to `devuelta` fails it |
| 6.13 | done | `docs/roadmap.md` row 2 already says `Armando`; no change |
| 6.14 | OPEN ([CONFIRM]) | owner walk, steps below |

Deviations from design (all minor): `resubmitCorrection` validates (RN-05, eligibility, documents, cap) inside the data function and returns `invalid` with the errors, so the action stays thin (the task asked for these checks in `solicitud-correction.test.ts`); the correction actions take the request id as their first argument and the page binds it (`action.bind(null, id)`), the data layer guards every write by owner and `devuelta`; the shared step logic lives in `new/step-actions.ts` (not a "use server" module, so it is not an endpoint) and the draft actions are wrappers over it; `draftRange` replaces the duplicate `rangeOf` in `new/actions.ts`; the step components default their `flow` locally (the existing tests mock only the action each step uses) instead of a shared `NEW_FLOW`; the correction opens at step 1 (not at the first unfinished step); the load of the correction page is fail-soft with its own message; `requestIdSchema` exported from `validations/solicitud.ts`; the 6.12 test is in `intake-sweep.test.ts` because the route test mocks the sweep.

Gates: targeted `npx vitest run` green per unit; `npm test` 181 files / 3641 tests green; `npx next typegen` + `npm run typecheck` clean; `npm run build` ok (`/requests/[id]/correct` dynamic); eslint and prettier clean on the 44 changed files (CR stripped). No database command was run.

Lines vs tracker: production +981 -233 (net 748; correct actions 98, correct page 118, step-actions 147, solicitud-correction 178, documentos 87, solicitudes 54, review step 29, resubmit dialog 33, flow 23 and the rest); tests +2296; i18n +34 -4. Inside the 1000 budget.

### Combined owner walk: S4 + S5a + S5b (one session, disposable Neon branch with 0008 applied)

Tags: every step that writes to the database is its own [CONFIRM]; nothing here runs before the owner says yes.

Setup (all on a disposable child branch of production, deleted afterwards)
1. [CONFIRM] Create the branch and apply `0008_secretary_review` (direct URL).
2. [CONFIRM] Data: a `secretaria` with `FacultadId` = the pilot facultad (create it as `coordinacion` in /users/new so SR-16 derives it, or the one-off F1 UPDATE); a student whose `CarreraId` is in that facultad with active enrollments in at least two groups of one subject and one more subject, whose schedule has classes in the absence dates; a second student in another facultad.
3. As the student present three requests, A, B and C (use /requests/new). One more from the other-facultad student.

S4, staff (login as the secretaria; 1280 px then 360 px in devtools)
- Sidebar shows "Review"; the queue lists A, B, C oldest first with a deadline badge in text, no cause shown, stacked cards at 360 px and no horizontal scroll; the other-facultad request is absent.
- Open A: the detail renders once and writes one `solicitud.consultada` row; hovering links writes none; View and Download of a document work (download saves the file).
- Approve A (message optional). Reject C: the template text is required and a second confirmation appears. Return B with a reason (RN-17) and a message. The queue then shows the result status line and the three leave the queue.

S5a, student (login as the student)
- Sidebar "My requests"; the list shows A, B, C newest first with state pills; no draft is listed.
- Open B: reason and message are shown with "Correct request"; A and C show no correction link. The other student's request id answers the same not found as a nonexistent id. At 360 px nothing scrolls sideways.

S5b, correction (still as the student)
- "Correct request" on B opens step 1 with the saved cause and dates. Change the end date to more than 30 days ago: it is accepted (RN-23 not re-applied); an end before the start is refused.
- Step 2: change the group or subject; step 3: remove the original document (it disappears from the list), attach a new file, remove that new file (deleted), attach it again; with five current documents the add button is disabled.
- Step 4: the review shows Resubmit and no Discard; confirm. You land on the request with "Your correction was sent", state Pending and no correction link; `/requests/<id>/correct` now answers not found.
- Check at 360 px for each correction step and the dialog.

Back as the secretaria
- Queue order follows `ReenviadaEn`: the resubmitted request now sits after every pending request presented before the resubmission, although it was presented first, and its deadline restarts on the resubmission day.
- Its detail shows the earlier version (the returned data and its documents) and the retired document, which can still be viewed and downloaded.

Read-only checks (`EventoAuditoria` and `Solicitud`, selects only)
- One `solicitud.corregida` for the request, one `documento.retirado` for the retired original, one `documento.eliminado` for the deleted new file, one `solicitud.consultada` per open and none from hover or prefetch.
- `SolicitudRevision` has the single snapshot written at the return; no row of the student ever had `Estado = 'borrador'` during the correction.

Cleanup: [CONFIRM] delete the disposable branch.
