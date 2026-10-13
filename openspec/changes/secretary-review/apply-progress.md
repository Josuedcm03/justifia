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
