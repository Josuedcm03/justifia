# Apply Progress: justification-intake

## Slice 1 (Phase 1, PR 1) - Schema, domain, ports

Mode: Strict TDD. Branch: `feat/justification-intake-s1-schema-domain`. Status: 12/13 tasks complete; 1.5 is a STOP gate awaiting user confirmation (migration generated, NOT applied).

### Completed tasks

1.1, 1.2, 1.3, 1.4, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12, 1.13. Task 1.5 intentionally open.

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.2/1.3/1.4 | `src/db/migration-justification-intake.test.ts` | Unit (SQL read) | N/A (new) | Written; 17/17 failed (no SQL file) | Schema + generated SQL; 17/17 pass after aligning assertions to drizzle's qualified-column output | 17 cases over 3 tables | Test helper `flat()` strips drizzle qualifiers |
| 1.6 | `src/lib/intake/signature.test.ts` | Unit | N/A (new) | Written; module missing | 8/8 pass | PDF/PNG/JPEG + truncated, wrong tail, HTML, MZ | prettier only |
| 1.7 | `src/lib/intake/dates.test.ts` | Unit | N/A (new) | Written; module missing | pass | UTC crossing, 06:00 UTC flip, boundary table 30/31 days, leap day | none needed |
| 1.8 | `causes/limits/pathnames.test.ts` | Unit | N/A (new) | Written; modules missing | pass | prefix collision 42/420/4, traversal, nesting, root | none needed |
| 1.9 | `src/lib/intake/submission.test.ts` | Unit | N/A (new) | Written; module missing | pass | per-field, RN-23 table, all-at-once, order | `endErrors` split per field |
| 1.10 | `src/lib/intake/eligibility.test.ts` | Unit | N/A (new) | Written; module missing | pass | ambiguous, wrong group, other subject, duplicate, multi-error | none needed |
| 1.11 | `src/lib/intake/states.test.ts` | Unit | N/A (new) | Written; module missing | pass | visible/hidden/unknown | none needed |
| 1.12 | `src/lib/intake/adapters/permissive-schedule.test.ts` | Unit | N/A (new) | Written; module missing | pass | ids, date-independence, empty | none needed |
| 1.13 | `src/db/pool-options.test.ts` | Unit | N/A (new); `src/db` baseline 6 files green | Written; module missing | pass | production vs dev/test | none needed |

### Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `npx vitest run src/lib/intake src/db` -> 17 files, 140 tests passed |
| Runtime harness | N/A: no runtime surface; migration SQL read by test |
| Rollback boundary | Revert `src/db/schema.ts` additions, `src/db/index.ts`, `src/db/pool-options*.ts`, `drizzle/0005_justification_intake.sql`, `drizzle/meta/0005_snapshot.json` and the `_journal.json` entry, `src/lib/intake/`. Migration is unapplied. |

### Deviations / notes

- Generated migration number is `0005` (provisional; catalog-management owns 0005/0006 off-main; regenerate at final merge, F.2).
- Cause codes (varchar(30)): `maternidad_paternidad`, `actividad_representativa`, `intercambio_academico`, `medica`, `fuerza_mayor`. `schema.ts` derives its CHECKs from `CAUSAS`, `ESTADOS_SOLICITUD`, `MAX_DOCUMENT_BYTES`.
- Extra index `IX_Documento_Solicitud` on `DocumentoRespaldo(SolicitudId)` (not in design; serves the cap count and cascade). Easy to drop.
- `validateSubmission` input shape: `{ causa, fechaInicio, fechaFin, selections: {asignaturaId, grupoId|null}[], eligibleGroups, validDocumentCount }`; errors are `{ field, code, asignaturaId? }` with codes mapped to `intake.errors.<code>` later.
- Pool options extracted to `src/db/pool-options.ts` (pure) so the env branch is testable.
- Open question (D11): `prepare: false` is confirmed as the postgres-js recommendation for PgBouncer transaction mode (`node_modules/postgres/README.md`). Context7 MCP was not available to this executor, so Neon/Vercel docs were not consulted live; Hobby region selection is left to task 5.5.
- Slice size: 1413 changed lines excluding drizzle/meta (780 in tests); over the 800 budget. Recommend `size:exception` or splitting the tests.
- `npm run typecheck` reports only pre-existing errors in `src/lib/import/*` (`exceljs` missing from node_modules); none in touched files.

## Delivery decision (slice 1)

- Owner accepted `size:exception` for PR 1: 1,413 changed lines (780 tests) against the 800-line budget, instead of splitting into 1a/1b. Native attempt objective reset by the owner (request `ji-s1-reset-size-exception-001`).
- Task 1.5 (apply migration) deliberately left open: the migration number `0005` is provisional and collides with catalog-management; apply only after regeneration at the final merge (F.2), with explicit user confirmation.
- Environment note: `exceljs` is declared in package.json but missing from node_modules, so `npm run typecheck` fails in `src/lib/import/*` (pre-existing, untouched by this slice). Run `npm install`.

## Slice 2 (Phase 2, PR 2) - Blob adapter and routes

Mode: Strict TDD. Branch: `feat/justification-intake-s2-documents` (from slice 1 branch). Status: 8/9 tasks complete; 2.1 partial (`.env.example` placeholder lines could not be written: file access denied by the sandbox).

### Completed tasks

2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9. Task 2.1: `@vercel/blob@^2.8.1` installed, `src/env.ts` done and tested; `.env.example` pending (add `BLOB_READ_WRITE_TOKEN=` and `CRON_SECRET=`).

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| (pulled from 3.1) | `src/lib/auth/permissions.test.ts` | Unit | 61/61 baseline with audit | 9 failed (`canFileRequests` missing) | pass | 5 roles + undefined; owner / other student / staff same id | prettier only |
| (pulled from 3.2, document events only) | `src/lib/audit/events.test.ts` | Unit | 19/19 baseline | 6 failed (builders missing) | pass | 4 builders + action registry + payload leak scan | none needed |
| 2.1 | `src/env.test.ts` | Unit | N/A (new) | 2 failed (vars not in schema) | 3/3 | set / unset / too-short secret | `optionalSecret` helper |
| 2.2 | `adapters/vercel-blob-store.test.ts` | Unit (mocked SDK) | N/A (new) | module missing | 12/12 | head, chunk join, short file, cancel, missing, stream, delete, list cursor | none needed |
| 2.3 | `deps.test.ts`, `fakes.test.ts` | Unit | N/A (new) | modules missing | 7/7 | wiring, schedule, missing token propagates; fake store files/list/delete | removed memo + override seam (YAGNI) |
| 2.4/2.5 | `src/app/api/intake/upload-token/route.test.ts` | Integration (mocked deps) | N/A (new) | module missing | 17/17 | 401, 4 roles 403, flagged, bad JSON, no draft, 4 bad paths, cap 5 vs 4, SDK error | prettier |
| 2.6/2.7 | `src/lib/data/documentos.test.ts` | Unit (scripted db double) | N/A (new) | module missing | 26/26 | 3 types, spoof, empty, too_large, exactly 10 MiB, not_found, not_allowed x3, cap, concurrent cap, referenced file, store error, audit error, delete failure, name bound, remove x3, download lookup x2, record x2 | `reject()` helper extracted |
| 2.8/2.9 | `src/app/api/intake/documents/[id]/route.test.ts` | Integration (mocked deps) | N/A (new) | module missing | 20/20 | owner pdf/png, headers, order stream->audit, two downloads, 401 x2, 404 identical, 4 roles, 5 malformed ids, missing file, store error, audit failure cancels stream | prettier |
| (helper) | `content-disposition.test.ts` | Unit | N/A (new) | NOT run separately: test and module written in one step | 4/4 | plain, RFC 5987 encoding, header injection, fallback ext | none |

### Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `npx vitest run src/app/api src/lib/intake src/lib/data src/lib/audit src/lib/auth src/env.test.ts src/db` -> 37 files, 396 tests passed; `npm run typecheck` clean |
| Runtime harness | NOT RUN: needs a dev Blob store token (`vercel env pull`) and a student session; upload spoofed + valid file through the route remains a manual check before merge |
| Rollback boundary | Revert `src/app/api/intake/`, `src/lib/intake/{deps,fakes,content-disposition}*`, `src/lib/intake/adapters/vercel-blob-store*`, `src/lib/data/documentos*`, `src/lib/data/test-support/`, `src/env*`, the document builders in `src/lib/audit/`, `canFileRequests`/`canViewDocument` in `src/lib/auth/permissions*`, and the `@vercel/blob` dependency |

### Deviations / notes

- Audit and permissions pulled forward from slice 3: the slice needs `documento.*` rows (D13, D14) and `canFileRequests`/`canViewDocument`. Slice 3 task 3.1 and 3.2 reduce to `solicitud.presentada` plus verification; 3.9 (download audit hook) is already done here.
- `onUploadCompleted` is NOT passed (design said no-op): the SDK throws on localhost when it is set without a callback URL (`getCallbackUrl`), contradicting "runs on localhost unchanged" (C15). Omitting it is the safe form.
- Claim row uses `TamanoBytes = 1` as placeholder (column is CHECK > 0) until the stored size is read.
- `not_allowed` and `not_found` finalize outcomes write no `documento.rechazado` row (unauthorized call / nothing stored); the four inspected-file reasons do.
- Token route: 401 no session, 403 non-student or flagged account, 400 `{error: reason}` for `no_draft`, `not_allowed`, `too_many_documents`, `bad_request`.
- Download route: flagged session treated as 401; every other denial is the same 404 body.
- Unit-level data tests use a scripted drizzle double (`src/lib/data/test-support/db-double.ts`); it pins statement order, not SQL semantics. Row lock and constraints are covered only by the generated-SQL tests and manual runtime check.
- Pathname well-formedness (uuid shape of the final segment) is not enforced beyond `isUnderDraftPrefix` (design-defined); the client builds the uuid.
- Slice size: about 2,420 changed lines excluding package-lock.json (about 1,440 tests, about 980 production incl. test-support). Over the 800 budget and the ~500 estimate; coherent tasks were finished rather than cutting tests. Recommend `size:exception`.
- `npm run typecheck` is clean now (exceljs present after the earlier install).

## Delivery decision (slice 2)

- Owner accepted `size:exception` for PR 2: 2,423 changed lines (~1,600 tests and test support, ~820 production), no split. Attempt objective reset by the owner (`ji-s2-reset-size-exception-001`).
- New budget rule from slice 3 on: the 800-line budget counts production code only; tests travel in the same PR and are reported separately.
- Open items from slice 2: task 2.1 needs `BLOB_READ_WRITE_TOKEN=` and `CRON_SECRET=` added to `.env.example` by hand (agent access denied); `content-disposition.test.ts` was not seen failing first (TDD slip); `TamanoBytes = 1` placeholder on the claim row should be reviewed at verify; data-layer tests use a drizzle double (no real lock/constraint coverage); runtime check against a dev Blob store is a manual pre-merge item.
