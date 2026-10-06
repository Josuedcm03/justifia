# Apply progress: catalog-management

## Phase 0: preconditions (2026-10-04)

- [x] 0.1 `catalog-excel-import` work committed by the user and merged to `main` (PR #4, merge commit `30a27a4`; content commit `88f0d14`). Verified by the orchestrator: working tree clean, `src/app/(dashboard)/catalog/`, `src/lib/import/apply.ts`, `src/app/change-password/`, `src/components/ui/collapsible.tsx`, `drizzle/0004_audit_log.sql` and both `openspec/changes/` folders are tracked.
- [x] 0.7 Delivery: option D, one branch with a PR per stretch (user decision).
- [x] 0.8 Branch `feat/sidebar-catalogs` created by the user from `main` (0 commits ahead, 0 behind; no upstream yet).
- [x] 0.9 Baseline on `30a27a4`:
  - `npm test`: 805 tests, 800 passed, 5 failed (57 files, 3 failed). The five failures are the known environment-flaky set and are the reference for later REDs:
    - `src/app/(dashboard)/users/page.test.tsx` > UsersPage > renders users.noResults.* and a clear control when a search has no results
    - `src/app/(dashboard)/users/page.test.tsx` > UsersPage > shows the new-user button to every creator
    - `src/app/denied/page.test.tsx` > DeniedPage > gives the way-back control the 44px touch floor and leaves the global focus ring alone
    - `src/app/denied/page.test.tsx` > DeniedPage > renders one h1, the explanation and a single control leading to /
    - `src/components/data-table-search.test.tsx` > DataTableSearch > renders a clear link to the bare action only when the value is non-empty
  - Also seen failing intermittently in earlier runs, not in this one: `users/page.test.tsx` "guards with exactly rolesQueCreanUsuarios" and `users/new/new-user-form.test.tsx` (role options).
  - `npm run typecheck`: clean.
  - `npm run build`: succeeded; routes `/`, `/api/catalog/template`, `/catalog/import`, `/change-password`, `/denied`, `/login`, `/profile`, `/register`, `/users`, `/users/new`.

Pending in Phase 0: 0.2 to 0.6 (the `catalog-excel-import` manual gates 8.20, 9.25, 9.26, 9.27, its stale checkboxes, and its verify and archive, or a recorded decision to proceed without them), and 0.10 (Next.js docs reading, done by the first apply batch).

## Phase 0 closed except 0.10 (2026-10-04)

The user chose to close `catalog-excel-import` before implementing this change.

- [x] 0.2 `catalog-excel-import` 8.20 run by the user on Neon branch `rehearsal-import-smoke` with the account the rehearsal import created (`jdcano@uamv.edu.ni`): redirect to `/change-password`, one successful change, flag cleared, dashboard reachable. Error paths of the form were not exercised.
- [x] 0.3 9.25 preview smoke run by the user on the same branch.
- [x] 0.4 9.26 real apply run by the user on the same branch through the pooled host without `prepare: false`: 1 Asignatura, 1 docente account, 1 Grupo created; two audit rows in the same transaction in partition 2026; no credential in the server log. An earlier, unplanned test apply on `production` (2026-10-04 04:47 UTC) was kept by the user's decision.
- [x] 0.5 `catalog-excel-import` tasks reconciled to 160/160 (3.17, 4.16 and 6.6 marked skipped, optional).
- [x] 0.6 `sdd-verify`: first run `fail` on the gate, remediated (navigation links exposed as buttons, intermittent tests, the `Inscripcion` requirement reworded as deferred), second run `pass_with_warnings` (`sha256:d2d7c35b…4169`; `npm test` 807/807 exit 0). `sdd-archive` done: main specs now live under `openspec/specs/` (40 requirements, 120 scenarios) and the change is at `openspec/changes/archive/2026-10-04-catalog-excel-import/`.

New baseline for this change (supersedes the 0.9 record above): `npm test` 807/807 passed, exit 0, with no known failing tests; `vitest.setup.ts` sets a 5 s async-utility timeout and `vitest.config.mts` a 15 s test timeout. Any failing test from here on is a real finding.

Follow-up before the first code unit: the four delta specs of this change were written against the pre-archive base. The base changed afterwards (UI wording in `catalog-excel-import`: "Only secretaria may import", "Secretaria opens the page", "Rejected uploads", "Import UI flow and copy"; and `academic-catalog`: the `Inscripcion` requirement reworded with a deferred note). Every `## MODIFIED Requirements` block in this change's deltas that restates one of those requirements in full must be re-based on the current text in `openspec/specs/`, otherwise archiving this change would overwrite the updated wording.

Still open in Phase 0: 0.10 (Next.js docs reading, done by the first apply batch). The Neon branch `rehearsal-import-smoke` still exists.

Neon housekeeping (2026-10-04): branch `rehearsal-import-smoke` (`br-polished-tree-ayn6sdxx`) deleted with the user's confirmation and verified absent. Remaining branches: `production` (default), `backup-before-0004-audit`, `rehearsal-0002-roles`, and the archived `backup-before-0002-roles` and `abort-rehearsal-0002`.

Neon housekeeping, continued (2026-10-04): at the user's request the three branches left from the `roles-lookup-table` migration were deleted and verified absent: `abort-rehearsal-0002` (`br-dry-base-ayngeqfm`), `rehearsal-0002-roles` (`br-rough-band-ayu3kv9t`) and `backup-before-0002-roles` (`br-tiny-bread-aypqu93y`). Remaining: `production` (default) and `backup-before-0004-audit` (kept pending the user's decision; it is the only copy of the pre-`0004` state).

## Batch WU1a-1A: code and tests, no database (2026-10-04)

Mode: Strict TDD. Delivery: option D (one branch, a PR per stretch); WU1a forecast 300-450 lines, under the 800 budget; no `size:exception`. Nothing committed or staged. No database was touched.

### Completed
- [x] 0.10 Next.js docs read (`node_modules/next/dist/docs/`, Next 16.3.4). Citations of N1-N9 re-checked against the installed docs. No deviation; two nuances for later pages and actions:
  - N3: `notFound()` must run in the render path (a component or a function a component `await`s). A call inside an un-awaited promise throws where nothing catches it and no not-found UI renders. Every helper that can call it must be awaited.
  - N4: in a Server Action `redirect` defaults to `push` (everywhere else `replace`); without JS it answers 303 (progressive enhancement). Compatible with the design.
  - N1, N2, N5, N6, N7 confirmed as written. `forbidden.md` is still `version: experimental`.
- [x] 1.3 / 1.4 `src/lib/catalog/origen.ts` + `origen.test.ts`
- [x] 1.5 / 1.6 `src/db/schema.ts` (`Asignatura.activo`, `Grupo.origen`, `CK_Grupo_Origen`) + `schema.test.ts` (4 tests)
- [x] 1.7 RED only: `src/db/migration-0005.test.ts` (8 tests, all fail: `expected exactly one drizzle/0005_*.sql, found 0`). Stays RED until 1.8 (needs the user's per-command confirmation).
- [x] 1.10 / 1.11 `src/lib/data/catalog.ts` readers require `Asignatura.Activo`; `buildActiveEnrollmentQuery` gains the `Asignatura` join
- [x] 1.12 `modelo_datos_sql.md` (Asignatura block, Grupo block + `CK_Grupo_Origen`, note 3)
- [ ] 1.13 not ticked: V is green except the expected 1.7 RED; completes after 1.8.
- Not in this batch: 1.1, 1.2 (orchestrator), 1.8, 1.9, 1.14 onward.

### TDD Cycle Evidence
| Task | Test file | Layer | Safety net | RED | GREEN | Triangulate | Refactor |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.3/1.4 | `src/lib/catalog/origen.test.ts` | Unit | N/A (new) | module unresolved, no tests ran | 3/3 | order, readonly tuple, type rejection | none needed |
| 1.5/1.6 | `src/db/schema.test.ts` | Unit | 18/18 | 3 of 4 new fail (the source-mention pin passes by design) | 22/22 | Activo default, Origen length/default, CHECK list vs constant | none needed |
| 1.7 | `src/db/migration-0005.test.ts` | Unit (fs) | N/A (new) | 8/8 fail, file absent | pending 1.8 | n/a | n/a |
| 1.10/1.11 | `src/lib/data/catalog.test.ts` | Unit (`toSQL`) | 4/4 | 3 new fail, 4 older pass | 7/7 | both readers + WHERE-position check | none needed |

### Work Unit Evidence
| Evidence | Value |
|---|---|
| Focused test command | `npx vitest run src/db src/lib/data/catalog.test.ts src/lib/catalog`: 8 files pass, 1 file fails (migration-0005, expected RED); 70 passed, 8 failed |
| Runtime harness | N/A: no runtime boundary in 1A (pure code, `toSQL`, fs reads); gates G1-G10 are 1.15 onward |
| Rollback boundary | revert `src/lib/catalog/origen*.ts`, `src/db/schema.ts`, `src/db/schema.test.ts`, `src/db/migration-0005.test.ts`, `src/lib/data/catalog.ts` + test, `modelo_datos_sql.md` |

### V results (build excluded)
- `npm test`: 60 files, 825 tests: 817 passed, 8 failed. All 8 are `migration-0005.test.ts` (the expected 1.7 RED). Baseline 807 + 18 new = 825. No other failure.
- `npm run typecheck`: clean.
- `npx eslint <touched files>`: only the pre-existing CRLF `Delete ␍` noise remains; new files prettier-clean.

### Notes for the next batch
- 1.8 `npm run db:generate -- --name catalog_management` needs the user's explicit yes. After it, `migration-0005.test.ts` is the GREEN check (expected statement shape: three statements, `ADD CONSTRAINT "CK_Grupo_Origen" CHECK ("Grupo"."Origen" in ('importacion', 'manual'))`; the test regex tolerates the quoting drizzle-kit emits for that clause only if it matches that shape. If drizzle-kit emits a different but equivalent form, adjust the test in the same batch and record it).
- `schema.ts` now names the new columns. Per the ordering rule, do not run app write flows (import apply) against the shared database before 0005 is applied (G9).
- Engram persistence of this progress was not possible from the apply executor (no memory tool exposed); the orchestrator should save `sdd/catalog-management/apply-progress` from this file.

## Phase 1A: orchestrator records (2026-10-04)

- [x] 1.1 G1 on `production` (`br-restless-hat-ayjwtjqw`, Neon `run_sql`, read-only): `"Asignatura"` 2 rows, `"Grupo"` 2 rows, `drizzle."__drizzle_migrations"` 5 rows, and `information_schema.columns` shows neither `Asignatura.Activo` nor `Grupo.Origen` (0 matches). These counts are the reference for G4 (1.18), the pre-apply re-check (1.30) and G9 (1.32).
- [x] 1.2 Shared host recorded from `.env` `DATABASE_URL` (host part only): `ep-orange-math-ay4rhpc0-pooler.c-5.us-east-2.aws.neon.tech`, pooled. Reference for every HC.
- Orchestrator re-verification of the batch: `npm test` 60 files, 825 tests, 817 passed, 8 failed (all eight in `src/db/migration-0005.test.ts`, the expected 1.7 RED); `npm run typecheck` clean.

### Ordering-rule deviation (needs the user's attention)

Commit `ccdcfe5` ("refactor(design-system): ...", made by the user while this batch was finishing) contains the WU1a code, including the `src/db/schema.ts` columns of task 1.6, together with the Stitch redesign. Gate 1.33 says a commit containing those columns must not be merged or deployed before `0005` is applied and verified on `production` (G9), and option D placed the WU1a commit after G9. Until G9: do not merge or deploy this branch, and do not run app write flows (import apply) against the shared database, because drizzle inserts into `Asignatura` and `Grupo` would name columns that do not exist. The commit also mixes two units, so the WU1a size is measured by path, not by commit.

## Phase 1A closed except 1.14 (2026-10-04)

- [x] 1.8 `npm run db:generate -- --name catalog_management` run after the user's explicit confirmation for that command. No rename prompt appeared. Emitted `drizzle/0005_catalog_management.sql`, `drizzle/meta/0005_snapshot.json` and journal entry `idx: 5`, tag `0005_catalog_management`. `npx vitest run src/db/migration-0005.test.ts`: 8/8 passed (GREEN for 1.7) with no change to the test.
- [x] 1.9 Hand review of the emitted SQL: exactly three statements, in this order: `ALTER TABLE "Asignatura" ADD COLUMN "Activo" boolean DEFAULT true NOT NULL`; `ALTER TABLE "Grupo" ADD COLUMN "Origen" varchar(12) DEFAULT 'importacion' NOT NULL`; `ALTER TABLE "Grupo" ADD CONSTRAINT "CK_Grupo_Origen" CHECK ("Grupo"."Origen" in ('importacion', 'manual'))`. No extra statement; nothing touches `EventoAuditoria`; the snapshot has zero `EventoAuditoria` mentions.
- [x] 1.13 V without build: `npm test` 60 files, 825/825 passed; `npm run typecheck` clean; `npx eslint` on the touched files reports only the known CRLF `Delete ␍` noise.

Open: 1.14 (the user reviews the `0005` SQL and the schema diff and approves the rehearsal in writing). The three generated files are uncommitted.

- [x] 1.14 The user reviewed the emitted `0005` SQL shown in the conversation and approved in writing on 2026-10-04: "sí, ensayá este archivo". File at approval time: `drizzle/0005_catalog_management.sql`, sha256 (working tree) `160ac32b119960dbc12411bf492036d5c89789c2d1767076eb9f35aaf77152ae`. A later edit to the file restarts at 1.15.

## Phase 1B: migration gates (2026-10-04)

- [x] 1.15 G2, after the user's confirmation ("sí, creá la rama"): Neon branch `rehearsal-0005` (`br-square-sea-ay9hw24b`) created from `production` (`br-restless-hat-ayjwtjqw`, parent LSN `0/226EA80`) in project `damp-recipe-21839554`. Its host is `ep-withered-frog-ayvaoc7d-pooler.c-5.us-east-2.aws.neon.tech` (pooled), different from the shared host of 1.2. Read-only check on the branch: 2 Asignatura, 2 Grupo, 5 migration rows, new columns absent (equal to 1.1).
- [x] 1.16 and 1.17 G3, after the user's confirmation ("sí, corré la migración"): `npm run db:migrate` run with a shell-scoped `DATABASE_URL` (`.env` untouched; `drizzle.config.ts` loads `dotenv/config`, which does not override a variable already set). HC: target host `ep-withered-frog-ayvaoc7d-pooler.c-5.us-east-2.aws.neon.tech`, compared in the same command against the shared host of 1.2 with an abort on equality. Exit 0, "migrations applied successfully!".
- [x] 1.18 G4 on `rehearsal-0005` (read-only): `Asignatura.Activo` boolean, NOT NULL, default `true`; `Grupo.Origen` character varying(12), NOT NULL, default `'importacion'`; 0 Asignatura with `NOT "Activo"` out of 2; 0 Grupo with `Origen <> 'importacion'` out of 2; `CK_Grupo_Origen` present in `pg_constraint` as `CHECK ("Origen"::text = ANY (ARRAY['importacion','manual']))`; row counts equal to 1.1; 6 migration rows.
- [x] 1.28 Migration frozen: sha256 of `drizzle/0005_catalog_management.sql` is `160ac32b119960dbc12411bf492036d5c89789c2d1767076eb9f35aaf77152ae` both as it is in the working tree and with LF endings (the file is LF). The last `__drizzle_migrations` row on the branch carries the same hash. Recorded ahead of G6 because the file is unchanged since 1.14; any later edit invalidates 1.15-1.27.
- [x] 1.19-1.22 G5, after the user's confirmation ("sí, corré las pruebas") for the four probes shown with their SQL. One script, four transactions, each ended in `ROLLBACK`; HC printed `ep-withered-frog-ayvaoc7d-pooler...` and the script aborts on the shared host.
  - G5a: `UPDATE "Grupo" SET "Origen" = 'otro'` -> `23514`; `INSERT` with `'otro'` -> `23514` (each in a savepoint).
  - G5b: `Grupo` insert omitting `Origen` stored `importacion`.
  - G5c: `Grupo` insert with `Origen = 'manual'` succeeded and stored `manual`.
  - G5d: `Asignatura` insert omitting `Activo` stored `true`.
  - Nothing persisted: 2 Asignatura and 2 Grupo before and after, 0 probe rows, 0 Grupo with a non-import origin.
  - Deviation from 1.20's wording: the parent `Asignatura` was created inside each rolled-back transaction, but the docente was an existing one (`DocenteId` of an existing Grupo), not a user created in the transaction.
- [x] 1.23 G6a: the branch URL used for the probes is the pooled endpoint (host contains `-pooler`), the same kind as the shared host.
- [x] 1.24-1.26 G6, after the user's confirmation ("sí, corré la prueba del candado"). Two separate postgres.js sessions (`max: 1` each) through the pooled host of `rehearsal-0005`, with the app's own client options (defaults, prepared statements on; `src/db/index.ts` passes only `max: 10`). No table read or written.
  - G6b: session A `BEGIN; SELECT pg_advisory_xact_lock(5005001)` acquired and held.
  - G6c: session B `BEGIN; SET LOCAL lock_timeout = '2s'; SELECT pg_advisory_xact_lock(5005001)` failed with `55P03` after 3,215 ms measured from before the session's first connection, so the figure includes connection setup on top of the 2 s timeout; then rolled back.
  - G6d: A committed; B repeated the same statements and acquired the lock in 359 ms; committed.
- [x] 1.27 G6 outcome: **pass**. `pg_advisory_xact_lock` with `SET LOCAL lock_timeout` works through the pooler with prepared statements on; no `prepare: false` and no `pg_try_advisory_xact_lock` fallback needed. Unblocks 3.15-3.16 and 4.19-4.20.
- [x] 1.29 G7, after the user's confirmation ("sí, creá la rama de respaldo"): Neon branch `backup-before-0005` (`br-damp-voice-ayrjcf33`) created from `production` at parent LSN `0/226EA80`, without a compute endpoint. It holds the pre-`0005` state.
- [x] 1.30 Pre-apply re-check on `production` (read-only): 2 Asignatura, 2 Grupo, 5 migration rows, new columns absent (equal to 1.1); `.env` host `ep-orange-math-ay4rhpc0-pooler.c-5.us-east-2.aws.neon.tech` equals 1.2; file sha256 `160ac32b…52ae` equals 1.28.
- [x] 1.31 G8, after the user's confirmation ("sí, corré la migración en production"): `npm run db:migrate` with the `.env` URL and no shell override. HC in the same command: target host `ep-orange-math-ay4rhpc0-pooler.c-5.us-east-2.aws.neon.tech` equal to 1.2 (abort otherwise) and file sha256 equal to 1.28 (abort otherwise). Exit 0, "migrations applied successfully!". `drizzle-kit push` never used.
- [x] 1.32 G9 on `production` (read-only): `Asignatura.Activo` boolean NOT NULL default `true`; `Grupo.Origen` character varying(12) NOT NULL default `'importacion'`; 0 inactive Asignatura of 2; 0 Grupo with a non-import origin of 2; `CK_Grupo_Origen` present; counts equal to 1.1; 6 migration rows; last row hash `160ac32b119960dbc12411bf492036d5c89789c2d1767076eb9f35aaf77152ae`, equal to 1.28's LF hash.
- [x] 1.33 **Ordering gate: 0005 applied and verified on production (2026-10-04).** The deviation recorded above is resolved: commit `ccdcfe5` (which carries the `schema.ts` columns) may now be merged or deployed, and app write flows against the shared database are safe again. Phase 4 onward is unblocked.

Open in Phase 1: 1.34 (delete `rehearsal-0005` or keep it for the UI write smokes 9.12, 13.13, 15.6; the user's decision) and 1.35 (WU1a checkpoint). Uncommitted at this point: `drizzle/0005_catalog_management.sql`, `drizzle/meta/0005_snapshot.json`, `drizzle/meta/_journal.json`, `tasks.md`, `apply-progress.md`. **The three `drizzle/` files must be committed**: the shared database already records migration 6, and a checkout without them would not match it. Neon branches now: `production`, `rehearsal-0005` (`br-square-sea-ay9hw24b`), `backup-before-0005` (`br-damp-voice-ayrjcf33`), `backup-before-0004-audit`.

## Phase 1 closed (2026-10-04)

- [x] 1.34 G10: the user chose to delete the rehearsal branch ("si ya terminamos de usarla, borrala"). `rehearsal-0005` (`br-square-sea-ay9hw24b`) deleted and verified absent with `list_branches`. Remaining Neon branches: `production` (default), `backup-before-0005` (`br-damp-voice-ayrjcf33`), `backup-before-0004-audit` (`br-still-feather-ay7d87p7`). Each later UI write smoke (9.12, 13.13, 15.6) needs a fresh branch, each creation a [CONFIRM]. The connection string of the deleted branch, which the orchestrator held during the rehearsal, is void.
- [x] 1.35 Checkpoint WU1a presented to the user: the `0005` SQL (three additive statements), the `schema.ts` and reader changes, the `modelo_datos_sql.md` entries and the G1-G9 evidence above. Phase 1 is 35/35. After G8 the rollback policy is forward-fix only.
