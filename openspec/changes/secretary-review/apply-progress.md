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
