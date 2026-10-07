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

## Slice 3 (Phase 3, PR 3) - Actions, enrollment, audit, permissions

Mode: Strict TDD. Branch: `feat/justification-intake-s3-actions` (from slice 2 branch). Status: 9/9 Phase 3 tasks complete (3.1 and 3.9 were delivered in slice 2 and re-verified here: 117 safety-net tests green).

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 3.1 (slice 2) | `src/lib/auth/permissions.test.ts` | Unit | 117/117 (audit, permissions, intake routes) | done in slice 2 | still green | 5 roles + owner/other/staff | none |
| 3.2 | `src/lib/audit/events.test.ts` | Unit | 19/19 baseline | 2 failed (`solicitudPresentadaEvent` missing, action not registered) | 21/21 | builder shape, registry, no-personal-data scan | prettier |
| 3.3 | `src/lib/data/enrollment.test.ts` | Unit (db double) | N/A (new) | module missing | 7/7 | teacher/no teacher, port filter, null range, empty enrollment, fail-loud, fail-soft ok/degraded; rendered WHERE asserts own student + active enrollment + active group | prettier |
| 3.4/3.5 | `src/lib/data/solicitudes.test.ts` | Unit (db double) | N/A (new) | module missing | 26/26 | resume, create, concurrent create, expired purge, no audit, 30-day cutoff param, save details/subjects, discard x5, submit x7 | prettier |
| (helper) | `src/lib/intake/eligibility.test.ts` | Unit | 10/10 baseline | 3 failed (`resolveGroupChoices` missing) | 13/13 | unambiguous, explicit/ambiguous, unknown | prettier |
| 3.6 | `src/lib/validations/solicitud.test.ts` | Unit | N/A (new) | module missing | 14/14 | valid, boundary 30 days, future, empty, invalid, end<start, too old, subjects, documents | prettier |
| 3.7/3.8 | `src/app/(dashboard)/requests/new/actions.test.ts` | Integration (mocked deps) | N/A (new) | module missing | 40/40 | authz x6 actions, foreign id == missing id, forged payload x2, RN-23 Managua, subjects x8, documents x7, discard x2, submit x12 | prettier |
| 3.9 (slice 2) | `src/app/api/intake/documents/[id]/route.test.ts` | Integration | included in 117 | done in slice 2 | still green | audit order, two downloads, denials write no row | none |

### Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `npx vitest run src/lib src/app src/env.test.ts src/db` -> 995 passed, 5 failed in 3 files NOT touched by this slice (`src/app/denied/page.test.tsx`, `src/app/(dashboard)/users/page.test.tsx`, `src/app/(dashboard)/catalog/import/import-form.test.tsx`: link/focus rendering assertions); all slice 3 files green. `npm run typecheck` clean. eslint: only the CRLF `Delete` noise, no real errors. |
| Runtime harness | N/A: no UI or route in this slice; actions covered by mocked deps and a scripted drizzle double (no real row lock, constraint or transaction rollback exercised) |
| Rollback boundary | Revert `src/app/(dashboard)/requests/`, `src/lib/data/{enrollment,solicitudes}*`, `src/lib/validations/solicitud*`, `solicitudPresentadaEvent` in `src/lib/audit/`, `resolveGroupChoices` in `src/lib/intake/eligibility*`, and the `where` capture in `src/lib/data/test-support/db-double.ts` |

### Size (owner budget rule: production only)

Production about 765 lines (actions 214, solicitudes 350, enrollment 82, validations 77, audit 23, eligibility 19) against the 800 budget. Tests and support about 1,504 lines, reported separately.

### Deviations / notes

- Slice 2 already delivered `canFileRequests`, `canViewDocument`, four document builders and the download audit hook: 3.1 and 3.9 were verified, not rewritten.
- Actions take no draft id: the draft is found through the session user (`getLiveDraft(userId)`), so another student's draft cannot be named. `submitRequestAction()` takes no payload; snapshot comes from the account inside the submit transaction, `PresentadaEn` from the action's single `now` (A5).
- `SolicitudAsignatura` stores only `GrupoId` (NOT NULL), so a draft can only hold a subject once its group is resolved. New pure helper `resolveGroupChoices` fills the single group of an unambiguous subject before saving; an ambiguous subject without a choice returns `group_required` at step 2 and cannot be stored.
- `submitDraft` guards its UPDATE with owner, `borrador`, liveness (30 days) and the validated cause/dates, then re-reads groups and counts valid documents inside the transaction; any drift throws a private sentinel (rollback) and returns `conflict`. This closes the window between validation and write. An account missing CIF, email or career returns `snapshot_incomplete` (otherwise `CK_Solicitud_Presentada` would raise a raw DB error).
- Expired draft not yet swept: `openDraft` purges it (rows plus best-effort blobs, no audit) so the partial unique index does not block the new draft.
- Error shape for every action: `{ ok: false, errors: [{ field, key, asignaturaId? }] }` with `key = intake.errors.<code>`. Codes used beyond slice 1: `no_draft`, `invalid_input`, `dates_required`, `submit_conflict`, `profile_incomplete`, plus the finalize reasons (`unsupported_format`, `too_large`, `empty_file`, `not_found`, `not_allowed`, `too_many_documents`). Slice 4 must add all of them to both i18n files.
- Submit redirects to `/requests/new/confirmation` (page lands in slice 5); discard redirects to `/requests/new`.
- Without valid dates `listEligibleGroups` skips the schedule port (enrollment only), so a draft with no dates reports date errors only.
- `Grupo.DocenteId` is NOT NULL in the current schema; the teacher is left-joined and typed nullable so a future nullable column (or catalog-management) needs no code change (D15).
- Fail-soft read `listEnrollmentFailSoft` returns `{ data, degraded }` for the UI; submit and step 2 use the fail-loud `listEligibleGroups`.
- `src/lib/data/test-support/db-double.ts` now records `where`; tests render it with `PgDialect` to assert ownership, state, cutoff and active-row filters in the SQL.
- `.env.example` shows as modified in the working tree (placeholder lines from slice 2 task 2.1, not from this slice).

### Open items

- Real transaction behaviour (row lock, rollback on audit failure, unique-index race) is covered only by double-based tests; verify against a dev database before merge.
- The three failing test files outside this slice should be confirmed as pre-existing on the base branch.

## Slice 4 (Phase 4, PR 4) - UI primitives, stepper, steps 1-3, i18n, sidebar

Mode: Strict TDD. Branch: `feat/justification-intake-s4-stepper` (from slice 3 branch). Status: 8/8 Phase 4 tasks complete (4.1-4.8).

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 4.1 | `src/components/ui/{checkbox,radio-group,stepper,alert-dialog}.test.tsx` | Component (Testing Library) | N/A (new) | 4 files failed (modules missing) | 14/14 | toggle/keyboard/disabled; none preselected, controlled, arrows; aria-current, earlier links only, first step; open, cancel, action, Escape | prettier |
| 4.7 | `src/i18n/intake-messages.test.ts` | Unit | catalog parity tests green | 5 of 6 failed (no `intake.*`, no `nav.newRequest`) | 6/6 | es+en, 26 error codes, 5 causes, 4 step labels | none |
| 4.8 | `src/components/app-sidebar.test.tsx` | Component | 48/48 | 4 failed (estudiante lists, new item tests) | 54/54 | estudiante only, 4 other roles hidden, current page, English label | prettier |
| 4.2 (pure) | `steps.test.ts` | Unit | N/A (new) | module missing | 22/22 | parse valid/invalid/array/clamp, resume point x3, range x4 | none |
| 4.3 | `intake-stepper.test.tsx` | Component | N/A (new) | module missing | 5/5 | es, en, current + "Paso n de 4", earlier links, first step | none |
| 4.4 | `cause-dates-step.test.tsx` | Component | N/A (new) | module missing | 9/9 | five causes none chosen, resume, save+navigate, empty payload, three errors at once with aria, English, form error, retry clears, pending | prettier |
| 4.5 | `subjects-step.test.tsx` | Component | N/A (new) | module missing | 13/13 (one failed first: Button `render=Link` has role button, replaced by a styled `Link`) | single group, no teacher, ambiguous radio none preselected, resume, no dates, degraded, empty, save payload, untick, per-subject error, step error, back | `BackLink` extracted to form-field |
| 4.6 | `documents-step.test.tsx` | Component (mocked SDK and actions) | N/A (new) | module missing | 21/21 | empty, list, full, upload+finalize, png/jpeg, progress, 6 server reasons + retry, upload failure, 3 prechecks, exact 10 MiB, remove ok/fail, English | `Object.hasOwn` instead of `in` |
| 4.2 | `page.test.tsx` | Integration (mocked dal/data/deps) | N/A (new) | module missing | 17/17 | guard, redirect reads nothing, session user, resume step, explicit step, saved subjects, no dates, degraded, only valid docs, clamp, bad values, fail-soft x2 | async child component inlined (RTL cannot render it) |

### Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `npx vitest run src/components/ui src/components/app-sidebar.test.tsx src/i18n "src/app/(dashboard)/requests/new"` -> 14 files, 218 tests passed. `npm run typecheck` clean. eslint: only the CRLF `Delete` noise. Full `npx vitest run src`: 1193 passed, 5 failed in 3 files NOT touched here (`src/app/denied/page.test.tsx`, `src/app/(dashboard)/users/page.test.tsx`, `src/components/data-table-search.test.tsx`: all `Button render={<Link/>}` exposing role button instead of link) |
| Runtime harness | NOT RUN: `npm run dev` walk of steps 1-3 needs a student session, a dev database with an enrolled student and a dev Blob token (`vercel env pull`); manual pre-merge check |
| Rollback boundary | Revert `src/components/ui/{checkbox,radio-group,stepper,alert-dialog}*`, `src/app/(dashboard)/requests/new/{page,steps,intake-stepper,form-field,cause-dates-step,subjects-step,documents-step,test-support}*`, `intake` and `nav.newRequest` in `i18n/*.json`, `src/i18n/intake-messages.test.ts`, and the `newRequest` item plus tests in `src/components/app-sidebar*` |

### Size (owner budget rule: production only)

Production about 1,356 lines (i18n 172, UI primitives 266, page+steps+stepper 180, form-field 123, step components 602, sidebar 13) against the 800 budget; tests and support about 1,558 lines. Over budget by about 550: the forecast of ~750 assumed leaner steps; no code, comments or tests were cut to fit. Recommend `size:exception` for PR 4, or splitting out the primitives (alert-dialog has no consumer until slice 5, 127 lines).

### Deviations / notes

- Design-system compatibility: only semantic tokens that exist in both systems (`primary`, `foreground`, `muted`, `border`, `destructive`, `card`); no lime/highlight. Active step = `shadow-[inset_0_-3px_0_0_var(--primary)]` plus `aria-current="step"` (not the `.is-current` utility, which still uses lime on this branch). Labels above inputs, errors under fields with `role="alert"`.
- `checkbox.tsx` is an interim primitive (plain base-ui `checked`/`onCheckedChange` API, shadcn style). The teammate's `Checkbox`/`CheckboxGroup` is not on any branch; swap at the final merge (F.3).
- Step 4 (review) is not built: `AVAILABLE_STEPS = 3`; `?step=4` clamps to 3, the stepper lists "Review" as plain text and step 3 has only a Back link. Slice 5 raises the constant and adds the Continue link.
- "Resume at last step": the schema stores no step, so an unqualified visit resumes at the first incomplete step (`defaultStep`: no details -> 1, no subjects -> 2, else 3); `?step=` overrides it.
- The SDK `upload()` throws a generic "Failed to retrieve the client token" and drops the token route's JSON, so the client cannot show `too_many_documents` from a token refusal. The UI instead disables Attach at 5 documents and shows that reason permanently; any other token refusal shows `upload_failed` and the page is re-read (`router.refresh()`).
- Every step test mounts the real catalogs with `onError` throwing, so a missing `intake.*` key fails the test. Error codes `intake.errors.*`: 25 from the actions plus client-only `upload_failed` (26 per locale).
- `draftRange` duplicates the private `rangeOf` of `actions.ts` (a `"use server"` file can only export async functions); same logic, tested.
- `documents-step.tsx` imports `formatFileSize` from `catalog/import/file-dropzone.tsx` (existing exported helper) and defines its own `errorKey` to keep zod out of the client bundle.
- The page redirect for non-students is `requireRole` -> `/denied` (existing guard); the page does not render for other roles.
- Server actions return a key per field; step components render them with the root translator, so any future code only needs an `intake.errors.<code>` entry.
- Base-ui `Select` was not used: the cause is a radio list (five visible options read better at 360 px than a popup).
- No `Field`/`StepShell` own test file: covered through the three step tests (alerts, aria wiring, footer).

### Open items

- Manual runtime walk of steps 1-3 and a real upload against a dev Blob store.
- 360 px behaviour is by construction (stacked cards, full-width buttons, collapsed stepper, truncated names); the per-step no-horizontal-scroll test is task 5.6.
- Three pre-existing failing test files (see above) remain on the base branch.

## Delivery decision (slice 4)

- Owner accepted `size:exception` for PR 4: 1,355 production lines (172 i18n) and 1,556 test lines, no split. Attempt objective reset by the owner (`ji-s4-reset-size-exception-001`).
- Slice 5 forecast (~450) to be re-estimated before starting.

## Slice 5 (Phase 5, PR 5) - Review step, dialogs, confirmation, cron sweep, 360 px

Mode: Strict TDD. Branch: `feat/justification-intake-s5-review` (from slice 4 branch). Status: 5.1, 5.1a, 5.1b, 5.2, 5.3, 5.4, 5.6 complete (5.6 with the manual walk pending); 5.5 PARTIAL (cron done, `regions` pending owner); 5.7 not in scope (archive time).

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 5.1a | `steps.test.ts`, `page.test.tsx`, `documents-step.test.tsx` | Unit + component | steps/page/documents tests green (slice 4) | first run: 10 test files failed (`AVAILABLE_STEPS` 3, no Continue link, no review step, modules missing) | steps + documents + page green | step 4 and 5/99 clamp, Continue es/en, with/without documents | none |
| 5.2 | `submit-dialog.test.tsx`, `discard-dialog.test.tsx` | Component (mocked actions) | `alert-dialog.test.tsx` 4/4 | modules missing | 11/11 | closed until opened, cancel, Escape, confirm once, pending blocks a second run, refusal closes and hands errors over, English | shared `confirm-dialog.tsx` extracted; wrappers are thin |
| 5.1 | `review-step.test.tsx` | Component | N/A (new) | module missing | 11/11 (one fixture bug fixed in the test: two groups shared a number) | all parts shown, missing data, degraded, read-only (no controls), 3 edit links, back link, errors per section/subject/form, no alert before submit | none |
| 5.1 (page) | `page.test.tsx` | Integration (mocked dal/data) | 17/17 | step 4 cases failed | green | only held groups, only valid documents, no dates means no enrollment read | none |
| 5.1b | `confirmation/page.test.tsx` | Integration | N/A (new) | module missing | 3/3 | guard, content + two links, guard redirect reads nothing | none |
| i18n | `src/i18n/intake-messages.test.ts` | Unit | 6/6 | review/confirmation keys missing | green (es + en) | es, en | none |
| 5.3/5.4 (logic) | `src/lib/data/intake-sweep.test.ts` | Unit (scripted db double) | N/A (new) | module missing | 15/15 (one assertion corrected, see notes) | filters (borrador, 30 d, pendiente, 1 h, 24 h), blob failure, row failure, idempotent, full batch continues, no-progress batch stops, fresh/referenced kept, paging, list failure, no audit | prettier |
| 5.3/5.4 (route) | `src/app/api/cron/intake-sweep/route.test.ts` | Integration (mocked sweep/env) | N/A (new) | module missing | 13/13 | 7 bad credentials, secret unset, GET only, counts + headers, counts-only log, failures reported, generic 500 | none |
| 5.5 | `src/lib/intake/vercel-config.test.ts` | Unit (reads JSON) | N/A (new) | 2 failed (no file) | 2/2 | schedule, no `regions` | none |
| 5.6 | `layout-360.test.tsx` | Component (static guard) | steps tests green | NOT seen failing against the real UI: the layout was already built to these rules, so the guards passed first time; the width guard itself is triangulated by a deliberately wide fixture it must flag | 15/15 | 4 steps x (no width over 360, full-row actions), long names truncate/wrap, stepper collapse, both dialogs | prettier |

### Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `npx vitest run "src/app/(dashboard)/requests/new" src/app/api src/lib/data src/lib/intake src/i18n src/components/ui src/components/app-sidebar.test.tsx` -> 48 files; first parallel run 538 passed, 1 failed (`cause-dates-step.test.tsx` "clears old errors once a retry succeeds": untouched file, timing flake under load; passes alone, 9/9). `npm run typecheck` clean. eslint on all touched files: only the CRLF `Delete` noise. |
| Runtime harness | NOT RUN: `npm run dev` at 360 px (steps 1-4, both dialogs, a real submit landing on the confirmation page) and a Bearer call to the cron route need a student session, a dev database and a dev Blob store. Manual pre-merge items. |
| Rollback boundary | Revert `src/app/(dashboard)/requests/new/{review-step,confirm-dialog,submit-dialog,discard-dialog,layout-360}*`, `confirmation/`, the step 4 branch in `page.tsx`, `AVAILABLE_STEPS`/`StepNumber` in `steps.ts`, `ContinueLink` in `form-field.tsx` and the footer in `documents-step.tsx`, `intake.review`/`intake.confirmation` in `i18n/*.json`, `src/lib/data/intake-sweep*`, `src/app/api/cron/`, `vercel.json`, `export` on `cutoffOf` in `solicitudes.ts`, and the `error` support in `test-support/db-double.ts` |

### Size (owner budget rule: production only)

Production about 760 lines (i18n 68, review-step 216, confirm/submit/discard dialogs 161, confirmation page 38, sweep 188, route 46, vercel.json 4, about 40 across page, steps, form-field, documents-step and solicitudes). Within the 800 budget. Tests and test support about 1,326 lines, reported separately.

### Deviations / notes

- Sweep logic lives in `src/lib/data/intake-sweep.ts` (data layer, takes `now` and the store); the route only authenticates, calls it, logs counts and answers. Task 5.3 listed everything under the route test; the route test covers Bearer, counts, log and failure, the data test covers expiry, pendiente, orphans, continue-on-failure, no audit and non-borrador untouched. Same coverage, testable without a database.
- Per draft: select its pathnames, delete the row (guarded by `Estado = borrador`), then delete blobs best effort. A blob failure keeps the draft counted as deleted and adds one failure; the orphan step removes the file later. A batch is 100 drafts; the loop stops on a short batch or a full batch that deleted nothing (a stuck row cannot loop), with a hard cap of 50 batches.
- Pending documents are removed only when their request is still a `borrador` (inner join), in one `DELETE ... WHERE id IN` per batch; a failing batch counts one failure and stops that step.
- Orphans: an old file is deleted only if no `DocumentoRespaldo.Pathname` equals it, looked up per listed page. `uploadedAt <= now - 24 h` counts as old.
- Route: Bearer compared as SHA-256 digests with `timingSafeEqual` (equal length, constant time); a missing `CRON_SECRET` rejects everything (fail closed); only `GET` is exported; 401 body `{error: "unauthorized"}`, 500 body `{error: "sweep_failed"}` without details; response and log carry counts only (`{event: "intake.sweep", draftsDeleted, pendingDocumentsDeleted, orphanBlobsDeleted, failures}`).
- Task 5.5 PARTIAL: `vercel.json` has the cron `0 9 * * *` and no `regions` (a test pins its absence): the Neon region is not known. Blob store creation and region choice are dashboard actions by the owner. Design open question D11 (Hobby region selection) stays open.
- The review step takes subject labels from the fail-soft enrollment read filtered to the groups the draft holds. If enrollment degrades the section says so (reusing `subjects.degraded`) and submit still works because the server re-checks everything. A group that left the enrollment since the draft was saved is simply not listed; submit would report `subject_not_eligible` under the subjects section.
- Review errors are placed by `field`: `causa`, `fechaInicio`, `fechaFin` under cause and dates; `subjects` with `asignaturaId` under that subject; `subjects` without it under the section; `documents` under documents; anything else, including `form`, at the bottom of the card.
- Discard lives on the review step only (next to Submit); earlier steps have no discard control.
- `confirm-dialog.tsx` shares the dialog frame: it ignores close requests while the action runs, a success redirects (server action `redirect`), a refusal closes it and lifts the errors to `ReviewStep`. The slice 4 `AlertDialog` primitive now has its consumer.
- The confirmation page reads no request data (static text, links to `/` and `/requests/new`); there is no request list yet.
- `db-double.ts` gained `error?` on a step (the statement rejects) to script failing items; `cutoffOf` in `solicitudes.ts` is now exported so the sweep and the draft rules share one 30-day cutoff.
- `layout-360.test.tsx` asserts utility class names (the strict TDD module discourages that) because jsdom has no layout; it is explicitly a static guard, not proof of "no horizontal scroll".
- Design-system compatibility: same semantic tokens as slice 4 plus the existing `destructive` button variant; no lime, no new tokens.
- Test script note: the sweep "stops after a full batch" test first asserted `exhausted === false`; the scripted trailing statement is consumed by the next step, so the assertion was corrected to `true` with a comment explaining that a second batch would surface as a 101st failure.

### Open items

- Manual: 360 px walk of steps 1-4 and both dialogs; a real submit landing on `/requests/new/confirmation`; a Bearer call to the cron route on the dev server (the secret comes from the owner's environment, it was never read here).
- Owner: Neon region for `regions` in `vercel.json`; create the Blob store in that region; set `CRON_SECRET` (at least 16 characters) in Vercel.
- Cron data access is covered by doubles only: list pagination, `del` batching and the `DELETE ... IN` statement have not run against Postgres or a Blob store.
- Flaky under parallel load: `cause-dates-step.test.tsx` "clears old errors once a retry succeeds" (not touched here).
- 5.7 (roadmap) is for archive time. Final merge checklist untouched.

## Orchestrator note (slice 5)

- Fixed a race in `cause-dates-step.test.tsx` ("clears old errors once a retry succeeds"): it failed under parallel load because the retry click could land while the button was still disabled. The test now waits for the button to be enabled and asserts the alert removal inside `waitFor`. Focused suite: 539/539 twice.
