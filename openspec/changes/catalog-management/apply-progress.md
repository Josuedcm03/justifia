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

## Batch WU1b: audit union, builders, result unions (2026-10-05)

Mode: Strict TDD. Delivery: option D (one branch, a PR per stretch). Nothing committed or staged. No database touched. Phase 2 tasks 2.1-2.11 done; 2.12 (checkpoint) left for the orchestrator.

### Completed
- [x] 2.1 Read `types.ts`, `events.ts`, `events.test.ts`, `data/audit.ts`. The two credential pins are the `@ts-expect-error` comments at `events.test.ts` lines 176 (`clave` on `accountUpdatedEvent`) and 185 (`TemporaryCredential` to `accountCreatedEvent`); both untouched.
- [x] 2.2 / 2.3 `src/lib/audit/diff.ts` + `diff.test.ts` (`changedFields`, `Object.is`, list order, name-union return type)
- [x] 2.4 / 2.5 `src/lib/audit/types.ts` additive widening: `AUDITABLE_ASIGNATURA_FIELDS`, `AUDITABLE_GRUPO_FIELDS`, `AuditOrigin`, eight action codes, entity types `Asignatura`/`Grupo`, two `AuditEvent` members (`entidadId: number`). `usuario.*` member not edited. + `types.test.ts`
- [x] 2.6 / 2.7 `events.ts`: `MANUAL_ORIGIN` and six builders. `created` lists the full closed field list (chosen reading of "field names only"); `activeChanged` lists `["activo"]`. `buildAuditEvents` not edited (F-3).
- [x] 2.8 / 2.9 `src/lib/catalog/types.ts` (new; result unions, plus `{ kind: "inactive" }` on `AsignaturaWriteResult` and `GrupoWriteResult`, amendment A-1) and `asignaturaWriteEvents` / `grupoWriteEvents` (exhaustive `switch` with a `never` default; `[]` for every refusal, `unchanged` and `inactive`).
- [x] 2.10 Characterization pin: existing `events.test.ts` assertions untouched (only the import block was extended; the one removed line in `git diff` is the old `./types` import). Mutation check: adding `hash: "x"` to `asignaturaCreatedEvent` payload failed 2 tests (the sweep "to not include 'hash'" and the created-payload equality); reverted, 40/40 green again.
- [x] 2.11 V without build (below).

### TDD Cycle Evidence
| Task | Test file | RED reason observed | GREEN |
|------|-----------|---------------------|-------|
| 2.2/2.3 | `src/lib/audit/diff.test.ts` | module `./diff` unresolved, no tests ran | 6/6 |
| 2.4/2.5 | `src/lib/audit/types.test.ts` | 3 of 4 fail (constants absent, action list lacks the eight codes); entity-type test is compile-time, proven by `tsc` | 4/4, typecheck clean |
| 2.6/2.7 | `src/lib/audit/events.test.ts` | 13 fail: `MANUAL_ORIGIN` undefined and each builder "is not a function" | 36/36 (file set) |
| 2.8/2.9 | `src/lib/audit/events.test.ts` (new describe) | 4 fail: `asignaturaWriteEvents` / `grupoWriteEvents` "is not a function" | 43/43 (audit + catalog) |
| 2.10 | `events.test.ts` sweep | characterization; mutation `hash` made 2 tests fail, reverted | 40/40 audit |

### V results (build excluded)
- `npx vitest run src/lib/audit src/lib/catalog`: 4 files, 43/43 passed.
- `npm test`: 62 files, 852/852 passed (baseline 825 + 27 new).
- `npm run typecheck`: clean (including the new `@ts-expect-error` pins and the `Record<kind, ...>` exhaustiveness tables).
- `npx eslint src/lib/audit src/lib/catalog`: only the pre-existing CRLF `Delete ␍` noise remains (no other rule fires).

### Authored lines
Tracked diff (additions + deletions): `events.test.ts` 372, `events.ts` 181, `types.ts` 65 = 618; new files: `diff.ts` 12, `diff.test.ts` 53, `types.test.ts` 68, `catalog/types.ts` 46 = 179. Unit total about 797 (under the 800 budget; `tasks.md` bookkeeping excluded). Forecast was 450-700.

### Notes
- `events.test.ts` is now LF in the working tree (an `eslint --fix` normalised the CRLF the checkout had); the index is LF, so the diff is not inflated.
- The ESLint `prettier/prettier` rule also required `types.ts` type aliases in their one-line form; applied by hand.
- Engram persistence: no memory tool available to the executor; the orchestrator should save `sdd/catalog-management/apply-progress` from this file.

## Batch WU1c-A: predicates, scope, scope SQL, getCatalogActor, guard (2026-10-05)

Mode: Strict TDD. Nothing committed or staged. No database touched. Tasks 3.1-3.10 done; **stopped at the seam by the mandatory stop rule** (3.11-3.19 not started; 3.14 and 3.17-3.19 remain with the orchestrator or the next batch).

### Completed
- [x] 3.1 / 3.2 `permissions.ts`: `canManageCatalog` (derived from `canCreateUsers`), `rolesQueGestionanCatalogo`, `isCarreraScopedRole`. `git diff` shows additions only (21 added, 0 removed); `canImportCatalog`, `rolesAsignables`, `rolesVisibles` untouched.
- [x] 3.3 / 3.4 `catalog/scope.ts`: `CatalogScope`, `catalogScopeFor` (derived from the predicates, no second role list), `carreraIdForWrite` (exhaustive `never` default).
- [x] 3.5 / 3.6 `data/catalog-scope-sql.ts`: `asignaturaInScope`, `asignaturaRowInScope`, `grupoRowInScope` (Grupo scoped by a subquery on its Asignatura); unknown kinds throw.
- [x] 3.7 / 3.8 `data/users.ts`: `getCatalogActor` (PK select projecting only `carreraId`, no try/catch).
- [x] 3.9 / 3.10 `auth/catalog-access.ts`: `requireCatalogAccess`; `requireRole` first, strict-integer subject parse (`/^[1-9]d*$/`), no caching.

### TDD Cycle Evidence
| Task | Test file | RED reason observed | GREEN |
|------|-----------|---------------------|-------|
| 3.1/3.2 | `auth/permissions.test.ts` | 14 fail: the three exports "is not a function" | 66/66 |
| 3.3/3.4 | `catalog/scope.test.ts` | module unresolved, no tests ran | 13/13 |
| 3.5/3.6 | `data/catalog-scope-sql.test.ts` | module unresolved, no tests ran | 12/12 (after 4 test-side assertions were narrowed to the `where` text, because the select list also contains column names; implementation unchanged) |
| 3.7/3.8 | `data/users.test.ts` | 4 fail: `getCatalogActor is not a function` | 14/14 |
| 3.9/3.10 | `auth/catalog-access.test.ts` | module unresolved, no tests ran | 14/14 |

### V results (build excluded)
- Focused `npx vitest run src/lib/auth src/lib/catalog src/lib/data src/lib/validations src/lib/import/schemas.test.ts`: 17 files, 256/256.
- `npm test`: 65 files, 912/912 (baseline 852 + 60 new). `npm run typecheck`: clean (one TS error in the first draft of the Grupo subquery, `inArray` with SQL, fixed with a plain `sql` template).
- `npx eslint` on touched files: only the pre-existing CRLF `Delete ␍` noise; the new LF files were normalised with `--fix` (new files only).

### Authored lines (WU1c delta on top of the WU1b baseline)
Tracked: `permissions.test.ts` +44, `permissions.ts` +21, `users.test.ts` +62, `users.ts` +18 = 145. New: `scope.ts` 47, `scope.test.ts` 73, `catalog-scope-sql.ts` 43, `catalog-scope-sql.test.ts` 111, `catalog-access.ts` 34, `catalog-access.test.ts` 113 = 421. **Delta 566.** Estimate for 3.11-3.17: shared field rules and test about 150, `schemas.ts` refactor about 30, write wrapper and test about 330, structural pin about 80: roughly 590, for a unit total near 1,150 (over 800, no `size:exception` granted).

### Notes
- Engram persistence: no memory tool available to the executor; the orchestrator should save `sdd/catalog-management/apply-progress` from this file.

## Batch WU1c-B: shared field rules, write wrapper, structural pin (2026-10-05)

Mode: Strict TDD. Nothing committed or staged. No database touched. Tasks 3.11-3.18 done; 3.19 (checkpoint) left for the orchestrator.

### Completed
- [x] 3.11 / 3.12 `validations/catalog-fields.ts`: caps (`CODIGO_MAX`, `NOMBRE_MAX`, `NUMERO_GRUPO_MAX`), `requiredString`, `horasTotalesSchema`, `numGrupoSchema`, `periodoSchema`, moved unchanged from the import schemas and exported.
- [x] 3.13 `import/schemas.ts` imports the shared rules (+10 / -53 lines, only definitions removed). `schemas.test.ts` (48 tests) passed before and after, unmodified; `git diff` of `schemas.test.ts` and `parse.test.ts` is empty.
- [x] 3.14 [GATE] G6 recorded as pass (task 1.27, evidence in Phase 1B above).
- [x] 3.15 / 3.16 `data/catalog-write.ts`: `CATALOG_WRITE_LOCK_KEY`, `CATALOG_LOCK_TIMEOUT`, `acquireCatalogWriteLock`, `CatalogBusyError`, `withCatalogWrite`, `logCatalogFailure`. Both lock statements are literal SQL via `sql.raw` of constants (the exact form G6 proved; `SET LOCAL` takes no parameters). `55P03` read from `code` or `cause.code` becomes `CatalogBusyError` (not logged, also when raised while acquiring the lock); any other error is logged once (actor, error name, SQLSTATE) and rethrown.
- [x] 3.17 `data/catalog-structure.test.ts` pin. Mutation check: appending `.delete(` to `catalog-write.ts` failed "never deletes a row"; reverted (file identical to before). A `.transaction(` in `catalog-write.ts` correctly stays allowed; the single-opener rule is covered by the offender-list assertion.
- [x] 3.18 V (no build), see results below.

### TDD Cycle Evidence
| Task | Test file | RED reason observed | GREEN |
|------|-----------|---------------------|-------|
| 3.11/3.12 | `validations/catalog-fields.test.ts` | module unresolved, no tests ran | 32/32 |
| 3.13 | `import/schemas.test.ts` (refactor) | n/a: 48/48 before | 48/48 after, unmodified |
| 3.15/3.16 | `data/catalog-write.test.ts` | module unresolved, no tests ran | 11/11 |
| 3.17 | `data/catalog-structure.test.ts` | characterization pin (passes now); mutation check failed 1 test as designed | 4/4 |

### V results (build excluded)
- Focused `npx vitest run src/lib/auth src/lib/catalog src/lib/data src/lib/validations src/lib/import/schemas.test.ts`: 20 files, 303/303. After the lint fixes, `src/lib/data src/lib/validations src/lib/import`: 26 files, 339/339.
- `npm test`: 68 files, 959/959 (baseline 912 + 47 new). `npm run typecheck`: clean (the first draft of the structure test used the regex `s` flag, TS1501 under the project target; replaced).
- `npx eslint` on touched files: only the pre-existing CRLF `Delete ␍` noise on `schemas.ts`; new files normalised with `--fix`.

### Authored lines (WU1c-B delta on top of the WU1c-A baseline)
New: `catalog-fields.ts` 66, `catalog-fields.test.ts` 115, `catalog-write.ts` 110, `catalog-write.test.ts` 239, `catalog-structure.test.ts` 73 = 603. Tracked: `import/schemas.ts` +10 -53 = 63. **Delta 666** (under 800). Unit total with WU1c-A (566): 1,232.

### Notes
- Design deviation: none. `catalog-fields.ts` imports `PERIODO_RE` from `@/lib/import/normalize` (as `schemas.ts` did); it stays there to keep `normalize.ts` untouched.
- Engram persistence: no memory tool available to the executor; the orchestrator should save `sdd/catalog-management/apply-progress` from this file.

## Batch WU4-A: planner, types, summary, audit payload (2026-10-05)

Mode: Strict TDD. Nothing committed or staged. No database touched. Tasks 4.1-4.18 done; **stopped at 4.18 as instructed** (4B, 4.19 onward, not started).

### Completed
- [x] 4.1 [GATE] G9 (task 1.33) and 3.16 recorded as done.
- [x] 4.2 Read the import, catalog and audit sources and tests. Literal snapshot fixtures needing `activo`/`origen`: **11 in `plan.test.ts`** (7 `AsignaturaRow`, 4 `GrupoRow`), now built through `makeAsignaturaRow` / `makeGrupoRow` (new, default-bearing, in `__fixtures__/plan-fixtures.ts`); 4 more in 4B-owned tests (`actions.test.ts` x3, `apply.test.ts` x1). `RowError.value` already carries a referenced code, so `asignatura.inactive` needs no new field.
- [x] 4.3 / 4.4 `loadCatalogSnapshot` projects `Asignatura.Activo` and `Grupo.Origen`; `AsignaturaRow.activo`, `GrupoRow.origen: GrupoOrigen`.
- [x] 4.5 Characterization pin: the pre-existing `plan.test.ts` ran 45/45 after the fixture change, unmodified in behaviour; typecheck clean.
- [x] 4.6 / 4.7 Reactivation: an inactive match is always an `update` with `reactivated: true` (present only when true; absent otherwise so the pre-existing `toEqual` expectations are unchanged), counted under `update`; `ImportPlan.asignaturasToReactivate`.
- [x] 4.8 / 4.9 `asignatura.inactive` row error (value = the Asignatura `Codigo`) for a `Grupos` row whose Asignatura is inactive and not resolved by the workbook's Asignaturas sheet. "Resolved" means the sheet row parsed and passed the carrera check, so an invalid declaring row does not rescue its `Grupos` rows.
- [x] 4.10 / 4.11 `ImportPlan.manualGruposToDeactivate`, derived from `deactivateGrupoIds` (same list the apply executes). Writes never carry `origen`.
- [x] 4.12 Characterization pin: a manual Asignatura name and a manual docente are overwritten as plain updates with no extra key. Mutation check: adding `conflict: true` to the update write failed 4 tests; reverted (no `conflict` in `plan.ts`).
- [x] 4.13 Characterization pin: with no manual groups and no inactive asignatura the writes, counts and deactivations equal the pre-change expectations (the 45 pre-existing tests pass unmodified, plus an explicit equality test).
- [x] 4.14 / 4.15 `ImportSummary.asignaturasReactivated` / `manualGruposDeactivated`; `buildImportSummary` copies them.
- [x] 4.16 / 4.17 Import-level audit payload gains `asignaturasReactivadas` and `gruposManualesDesactivados` (counts only; names follow `cuentasCreadas`). The three credential-pin lines in `events.test.ts` and the `buildAuditEvents` signature are untouched.
- [x] 4.18 Checkpoint 4A.

### TDD Cycle Evidence
| Task | Test file | RED reason observed | GREEN |
|------|-----------|---------------------|-------|
| 4.3/4.4 | `data/catalog.test.ts` | 1 of 2 new fails: select list lacks `"Activo"` | 9/9 |
| 4.5 | `import/plan.test.ts` | characterization (not RED); 4 type errors until fixtures updated | 45/45 unchanged |
| 4.6/4.7 | `import/plan.test.ts` | 5 fail: `reactivated` flag and `asignaturasToReactivate` absent | 50/50 |
| 4.8/4.9 | `import/plan.test.ts` | 2 fail: `asignatura.inactive` not emitted (the other 4 guard existing behaviour) | 56/56 |
| 4.10/4.11 | `import/plan.test.ts` | 9 fail: `manualGruposToDeactivate` undefined | 66/66 |
| 4.12/4.13 | `import/plan.test.ts` | characterization; mutation `conflict: true` failed 4 tests, reverted | 69/69 (then 63/63 after the test block was compacted; same scenarios) |
| 4.14/4.15 | `import/summary.test.ts` | 3 fail: the two fields absent | 13/13 |
| 4.16/4.17 | `audit/events.test.ts` | 3 fail: payload lacks the two counts | 42/42 (audit dir) |

### V results
- `npx vitest run src/lib/import src/lib/audit src/lib/data/catalog.test.ts`: 17 files, 284/284.
- `npm test`: 68 files, 983/983 (baseline 959 + 24 new). `npm run typecheck`: clean.
- `npx eslint` on touched files: only the pre-existing CRLF `Delete ␍` noise; no other rule fires (five prettier line-wrap errors in my new tests were fixed by hand).

### Authored lines (delta on top of the WU1b/WU1c baseline)
Baselines recorded before editing: `events.test.ts` 371/1, `events.ts` 179/2, `audit/types.ts` 64/1. Delta: `events.test.ts` +37 -1, `events.ts` +2, `audit/types.ts` +4 = 44. Previously clean or new-in-this-piece, by full diff: `plan.test.ts` 385+31 = 416, `catalog.test.ts` 58, `plan.ts` 39, `summary.test.ts` 34, `plan-fixtures.ts` 17, `import/types.ts` 15, `catalog.ts` 2, `summary.ts` 2, `data/audit.test.ts` 2 = 585. Minimal 4B-file edits (type-driven): `actions.test.ts` 7, `apply.test.ts` 3, `apply.ts` 2, `import-form.test.tsx` 2, `import-preview.test.tsx` 2 = 16. **Total 645** (under 800; no `size:exception`). Midway the measure had reached about 892 because the first draft of the new `plan.test.ts` scenarios was verbose; it was compacted (shared cell/row helpers, merged near-duplicate cases) before 4.18, same scenarios kept.

### Deviations and notes
- Minimal edits in 4B-owned files only to keep `tsc` green after the type widening (no behaviour change): `apply.ts` `buildImportSummary({...})` now passes `asignaturasReactivated: plan.asignaturasToReactivate` and `manualGruposDeactivated: plan.manualGruposToDeactivate` (2 lines near line 268; 4.19/4.20 still own the lock, the Asignatura `activo: true` write on reactivation and the per-record events; the `activo: true` already at `apply.ts` line 217 belongs to Grupo updates); `apply.test.ts` (`activo: true` in the snapshot literal, the two plan fields in `makePlan`); `actions.test.ts` (`activo`/`origen` on 3 literals, the two plan fields on the `capped` plan, the two summary fields on the fixture summary); `import-form.test.tsx` and `import-preview.test.tsx` (the two summary fields on their fixtures).
- `reactivated` on `AsignaturaWrite` is `reactivated?: true` (absent unless reactivating), not `boolean` as `GrupoWrite` has it, to keep the pre-existing Asignatura update expectations (4.13) unchanged.
- Audit payload property names (`asignaturasReactivadas`, `gruposManualesDesactivados`) are my choice; the spec leaves them to the design and the design names only the summary fields.
- Possible delta-vs-base wording drift: none found that changes behaviour in the requirements implemented here.
- Engram persistence: no memory tool available to the executor; the orchestrator should save `sdd/catalog-management/apply-progress` from this file.

## Batch WU4-B: apply, actions, preview UI, copy (2026-10-05)

Mode: Strict TDD. Nothing committed or staged. No database touched, no app flow run. Tasks 4.19-4.27 done; 4.28 ([USER] smoke) and 4.29 (checkpoint) left open; Phase 5 not started.

### Completed
- [x] 4.19 / 4.20 `apply.ts`: `activo: true` on an Asignatura update only when `reactivated`; `runImportApply` calls `acquireCatalogWriteLock(tx)` first inside the transaction (before the in-transaction snapshot read); `applyImport` appends one `asignatura.reactivada` event per reactivated id (`origen: "importacion"`, `importacionSha256`, `campos: ["activo"]`) after `buildAuditEvents(...)` in the same single audit insert. `apply.test.ts` mocks `catalog-write` (real module spread, `acquireCatalogWriteLock` replaced by a spy that records call order); the lock SQL itself stays proven by `catalog-write.test.ts` and G6.
- [x] 4.21 / 4.22 `actions.ts`: preview arm carries `asignaturasToReactivate` / `manualGruposToDeactivate`; `ApplyState` gains `{ kind: "busy" }` (A-2); a `CatalogBusyError` maps to it with no trace and no summary log. `previewAction` never touches the lock: source pin that `actions.ts` mentions neither `catalog-write` nor `acquireCatalogWriteLock`.
- [x] 4.23 / 4.24 `import-preview.tsx` (reactivation notice, manual-group warning in the existing `warning` / `warning-ink` tokens, replaced-edits statement on every preview, optional `busy` alert, two result lines with zero shown) and `import-form.tsx` (a busy answer keeps the preview and its confirm control; client-side `FlowState`).
- [x] 4.25 / 4.26 copy in `i18n/es.json` and `i18n/en.json`; parity test extended.
- [x] 4.27 V including build.

### TDD Cycle Evidence
| Task | Test file | RED reason observed | GREEN |
|------|-----------|---------------------|-------|
| 4.19/4.20 | `import/apply.test.ts` | 4 fail: `activo` absent from the reactivation update, no `asignatura.reactivada` events, lock not called, busy lock not propagated (other new cases guard existing behaviour and passed) | 38/38 |
| 4.21/4.22 | `catalog/import/actions.test.ts` | 3 fail: two plan fields absent from the preview arm, busy mapped to `error` (summary-with-counts and source pin guard behaviour and passed) | 70/70 |
| 4.23/4.24 | `import-preview.test.tsx`, `import-form.test.tsx` | 7 fail: missing message keys (renderer now throws on a missing key, FT) and absent notice, warning, busy prop and result lines; the form busy test timed out waiting for the alert | 190/190 (catalog/import dir) |
| 4.25/4.26 | `i18n/catalog-parity.test.ts` | 6 fail against the HEAD copies of both locales (restored temporarily): reason list, new keys, cancel and busy wording | 21/21 |

Order note: the copy (4.26) landed together with 4.24 because the component tests render the real catalogs and cannot pass without it; the 4.25 RED was then demonstrated by temporarily restoring the HEAD locale files (restored from a scratch copy afterwards; numstat checked).

### V results
- Focused `npx vitest run src/lib/import src/lib/audit src/lib/data/catalog.test.ts "src/app/(dashboard)/catalog/import" src/i18n`: 26 files, 502/502.
- `npm test`: 68 files, 1008/1008 (baseline 983 + 25 new). `npm run typecheck`: clean.
- `npx eslint` on touched files: only the pre-existing CRLF `Delete ␍` noise on files untouched or still CRLF (`apply.ts`); three real prettier errors in my new code were fixed.
- `npm run build`: compiled; routes `/`, `/_not-found`, `/api/catalog/template`, `/catalog/import`, `/change-password`, `/denied`, `/login`, `/profile`, `/register`, `/users`, `/users/new` (all dynamic) plus Proxy (Middleware).

### Authored lines (delta on top of the WU4-A baseline)
`actions.test.ts` 80, `import-form.test.tsx` 27, `import-preview.test.tsx` 121, `apply.test.ts` 157, `apply.ts` 39 (+33 -6), `actions.ts` 11, `import-preview.tsx` 39, `import-form.tsx` 30 (+23 -7), `i18n/es.json` 11, `i18n/en.json` 11, `catalog-parity.test.ts` 43. `events.ts`, `events.test.ts`, `audit/types.ts` untouched in this piece (0). **Total 569** (budget 800, no `size:exception`). Measured at the natural stops: 287 after 4.22 (apply and actions), 569 at the end.

### New i18n keys (under `catalog.import`)
- `preview.reactivations`: es "{count, plural, one {Se reactivará # asignatura inactiva que aparece en el libro. Puedes cancelar sin confirmar.} other {Se reactivarán # asignaturas inactivas que aparecen en el libro. Puedes cancelar sin confirmar.}}"; en "{count, plural, one {# inactive subject in the workbook will be reactivated. You can cancel by not confirming.} other {# inactive subjects in the workbook will be reactivated. You can cancel by not confirming.}}"
- `preview.manualGroups`: es "{count, plural, one {# de los grupos que se desactivarán fue creado a mano.} other {# de los grupos que se desactivarán fueron creados a mano.}} Al confirmar, también se desactivan. Puedes cancelar sin confirmar."; en "{count, plural, one {# of the groups that will be deactivated was created by hand.} other {# of the groups that will be deactivated were created by hand.}} Confirming deactivates them too. You can cancel by not confirming."
- `preview.replacedEdits`: es "Los cambios hechos a mano en asignaturas o grupos que aparecen en el libro pueden ser reemplazados por los valores del libro. Puedes cancelar sin confirmar."; en "Changes made by hand to subjects or groups that appear in the workbook may be replaced by the workbook's values. You can cancel by not confirming."
- `preview.busy`: es "El catálogo está ocupado con otro cambio. No se aplicó nada. Espera un momento e inténtalo de nuevo, o cancela."; en "The catalog is busy with another change. Nothing was applied. Wait a moment and try again, or cancel."
- `result.asignaturasReactivated`: es "{count, plural, =0 {No se reactivó ninguna asignatura.} one {Se reactivó # asignatura inactiva.} other {Se reactivaron # asignaturas inactivas.}}"; en "{count, plural, =0 {No inactive subject was reactivated.} one {# inactive subject was reactivated.} other {# inactive subjects were reactivated.}}"
- `result.manualGruposDeactivated`: es "{count, plural, =0 {No se desactivó ningún grupo creado a mano.} one {Se desactivó # grupo creado a mano.} other {Se desactivaron # grupos creados a mano.}}"; en "{count, plural, =0 {No group created by hand was deactivated.} one {# group created by hand was deactivated.} other {# groups created by hand were deactivated.}}"
- `reasons.asignatura.inactive`: es "La asignatura está inactiva y no aparece en la hoja Asignaturas del libro. Inclúyela en esa hoja para reactivarla, o quita este grupo"; en "The subject is inactive and is not on the workbook's Asignaturas sheet. Add it to that sheet to reactivate it, or remove this group"

### Deviations and notes
- `CatalogBusyError` is re-exported from `apply.ts` so `actions.ts` imports nothing from `catalog-write.ts` (keeps the task's literal source pin for the preview). In `actions.test.ts` the `@/lib/import/apply` mock gained a `CatalogBusyError` class.
- A busy answer must keep the confirm control, but `ApplyState.busy` carries no preview. `import-form.tsx` therefore keeps the previous preview client-side (`FlowState`, reducer `runFlow`); the server arm stays `{ kind: "busy" }` and nothing extra travels back to the server.
- "Each new text says what will happen and that the user may cancel" is read as: the three pre-confirmation texts (reactivations, manual groups, replaced edits) say it can be cancelled; the busy message says busy, nothing applied, try again, or cancel; result lines and the row-error reason are after-the-fact or corrective and carry no cancel wording.
- The manual-group warning and the busy alert reuse the existing `warning` / `warning-ink` tokens (design system 2.5, inline alerts); no new colour, radius, size or spacing step.
- `renderUi` in `import-preview.test.tsx` now has an `onError` that throws (FT), as the form test already had.
- Files I edited were converted from CRLF to LF to allow exact edits (`core.autocrlf=true`; `git diff --numstat` of baseline files unchanged by the conversion). `prettier --write` was run only on files created or already normalised in this batch (`apply.test.ts`, `actions.ts`, `actions.test.ts`).
- Spec conflicts with the design: none found.
- Engram persistence: no memory tool available to the executor; the orchestrator should save `sdd/catalog-management/apply-progress` from this file.

## Batch WU2a-A: generic and catalog list-params, manual schemas (2026-10-05)

Mode: Strict TDD. Nothing committed or staged. No database touched. Tasks 5.1-5.9 done; **stopped at the seam (5.9) by the mandatory stop rule**: measured delta 739 lines, the data layer (5.10-5.18) is estimated at 900+ more, so the unit would pass 800 without a `size:exception`. 5.10-5.20 not started (5.20 stays with the orchestrator).

### Completed
- [x] 5.1 Read. Exported names of `users/list-params.ts` that must stay: `USERS_PAGE_SIZE`, `USERS_SEARCH_MAX`, `parseUsersListParams`, `usersListHref`.
- [x] 5.2 / 5.3 `src/lib/list-params.ts`: `RawSearchParams`, `firstValue`, `parsePage` (array -> 1), `parseQ(raw, max)` (trim, collapse, cap; array -> ""), `listHref(base, {q, page, extra})` (order q, extra, page; defaults omitted).
- [x] 5.4 REFACTOR `users/list-params.ts` delegates (takes `firstValue` first, so its array behaviour is preserved). `users/list-params.test.ts` unmodified (`git diff` empty), 28/28 before and after.
- [x] 5.5 / 5.6 `src/lib/catalog/list-params.ts`: `CATALOG_PAGE_SIZE = USERS_PAGE_SIZE` (A-4, derived so they cannot drift), `CATALOG_OPTIONS_MAX = 2000`, `parseCatalogListParams`, `catalogListHref`, `CatalogListBase`. `CatalogStatusFilter` was added to `catalog/types.ts` here (not in 5.11) because the pure module needs it; 5.11 adds the remaining list types.
- [x] 5.7 / 5.8 `src/lib/validations/catalog.ts`: `parseRecordId`, `asignaturaCreateSchema`, `asignaturaUpdateSchema` (no `codigo`), `grupoCreateSchema`, `grupoUpdateSchema` (only `docenteId`), `CATALOG_FIELD_ERROR_KEYS` (15 keys). `schemas.test.ts` untouched, 48/48.
- [x] 5.9 Seam measured (below).

### TDD Cycle Evidence
| Task | Test file | RED reason observed | GREEN |
|------|-----------|---------------------|-------|
| 5.2/5.3 | `src/lib/list-params.test.ts` | module unresolved, no tests ran | 20/20 |
| 5.4 | `src/lib/users/list-params.test.ts` | refactor: 28/28 before, unmodified | 28/28 after |
| 5.5/5.6 | `src/lib/catalog/list-params.test.ts` | module unresolved, no tests ran | 19/19 |
| 5.7/5.8 | `src/lib/validations/catalog.test.ts` | module unresolved, no tests ran | 55/55 (after one fix, see Notes) |

### V results (build excluded)
- WU2a focused command `npx vitest run src/lib/data/asignaturas.test.ts src/lib/validations src/lib/catalog src/lib/list-params.test.ts src/lib/users` (the data test file does not exist yet): 8 files, 188/188.
- `npx vitest run src/lib/import/schemas.test.ts`: 48/48.
- `npm test`: 71 files, 1,110/1,110 (baseline 68 / 1,008; +3 files, +102 tests). No failure anywhere.
- `npm run typecheck`: clean.
- `npx eslint` on the 8 touched files: no output (clean; new files normalised with `--fix`, `users/list-params.ts` and `types.ts` not auto-fixed).

### Authored lines (WU2a-A delta on top of the WU4 baseline)
New: `list-params.ts` 48, `list-params.test.ts` 78, `catalog/list-params.ts` 58, `catalog/list-params.test.ts` 118, `validations/catalog.ts` 108, `validations/catalog.test.ts` 287 = 697. Tracked: `users/list-params.ts` +12 -27 = 39; `catalog/types.ts` +3 (46 -> 49, untracked baseline file). **Delta 739.** Estimate for 5.10-5.18: `asignaturas.ts` ~230, `types.ts` additions ~30, `asignaturas.test.ts` ~650-800 (reads, sentinel, create, update, set-active scenarios with recording doubles), structure pin ~10: roughly 920-1,070, for a unit total near 1,700-1,800 (well over 800; no `size:exception` granted).

### Notes
- Design deviation: none. `numeroGrupo` reuses the import's `numGrupoSchema`, so its messages are `numGrupo.required` / `numGrupo.tooLong` (the import key), not `numeroGrupo.*`; `CATALOG_FIELD_ERROR_KEYS` lists them as such.
- Zod 4: an optional id built as `z.unknown().transform(...)` returning `undefined` fails a missing key with "expected nonoptional"; fixed with `.optional()` after the transform (found by the key-set test, first GREEN attempt failed 3 tests).
- Engram persistence: no memory tool available to the executor; the orchestrator should save `sdd/catalog-management/apply-progress` from this file.

## Batch WU2a-B reads: Asignatura reads and list types (2026-10-05)

Mode: Strict TDD. Nothing committed or staged. No database touched. Tasks 5.10-5.11 done; **stopped after 5.11 as instructed** (5.12-5.20 not started).

### Completed
- [x] 5.10 RED `src/lib/data/asignaturas.test.ts` (reads only).
- [x] 5.11 GREEN `src/lib/data/asignaturas.ts` reads; `catalog/types.ts` gains `CatalogListResult<T>`, `AsignaturaListItem`, `AsignaturaDetail` (`CatalogStatusFilter` was added in WU2a-A).

Exported reads:
- `buildAsignaturasWhere(scope: CatalogScope, f: { status: CatalogStatusFilter; q: string }): SQL | undefined`
- `listAsignaturas(p: { scope; status; q; page; pageSize }): Promise<CatalogListResult<AsignaturaListItem>>` (fail-soft `degraded`)
- `getAsignaturaById(scope: CatalogScope, id: number): Promise<AsignaturaDetail | null>` (scope and id in one WHERE, `gruposActivos` as a scalar subquery in the same statement; usable as the A-6 pre-check read)
- `listAsignaturaOptions(scope: CatalogScope): Promise<{ id; codigo; nombre }[]>` (active, scoped, capped at `CATALOG_OPTIONS_MAX`)
- `listCarreraOptions(scope: CatalogScope): Promise<{ id; nombre }[]>` (A-8)

### TDD Cycle Evidence
| Task | Test file | RED reason observed | GREEN |
|------|-----------|---------------------|-------|
| 5.10/5.11 | `data/asignaturas.test.ts` | module `@/lib/data/asignaturas` unresolved, no tests ran | 26/26 (two first-run failures were test-side: `sqlToQuery` also returns `typings`; the render helper now keeps `sql` and `params` only) |

Mutation check on the sentinel: removing `asignaturaInScope(scope)` from `listAsignaturaOptions` failed 4 tests (two direct, two sentinel); reverted.

### V results (build excluded)
- `npx vitest run src/lib/data/asignaturas.test.ts src/lib/data/catalog-structure.test.ts src/lib/catalog`: 5 files, 65/65.
- `npm test`: 72 files, 1,136/1,136 (baseline 71 / 1,110; +1 file, +26 tests). `npm run typecheck`: clean.
- `npx eslint` on the 3 touched files: clean (new files normalised with `--fix`, `types.ts` not auto-fixed).

### Authored lines (WU2a-B delta on top of WU2a-A)
New: `asignaturas.ts` 152, `asignaturas.test.ts` 383. Tracked-baseline `catalog/types.ts` +22 (49 -> 71). **Delta 557** (under 800). Estimate for 5.12-5.18: `asignaturas.ts` about 150, test about 450, structure pin about 5: roughly 600.

### Notes
- Deviation (A-8 detail): `listCarreraOptions` applies the scope in TypeScript (`none` -> `[]` with no statement; `carrera` -> filter by id), not in SQL, because `catalog-scope-sql.ts` is the only place a scope becomes SQL, models Asignatura rows, and must not be modified in this piece. The Carrera table is a handful of names.
- `clampPage` is imported from `data/users.ts` (as the design reuses it); `asignaturas.ts` therefore transitively imports `users.ts`.
- `getAsignaturaById` and `listAsignaturaOptions` are not fail-soft (only the list is, per CM-LST-1); a thrown error reaches the caller.
- Order is `Codigo` only: `Codigo` is unique, so no tie-break is needed.
- Engram persistence: no memory tool available to the executor; the orchestrator should save `sdd/catalog-management/apply-progress` from this file.

## Batch WU2a-B writes: createAsignatura, updateAsignatura, setAsignaturaActivo (2026-10-05)

Mode: Strict TDD. Nothing committed or staged. No database touched. Tasks 5.12-5.19 done in one run (measured 574 lines, no stop point needed); 5.20 (checkpoint) left for the orchestrator.

### Completed
- [x] 5.12 / 5.13 `createAsignatura(tx, scope, input): Promise<AsignaturaWriteResult>`.
- [x] 5.14 / 5.15 `updateAsignatura(tx, scope, id, input): Promise<AsignaturaWriteResult>`.
- [x] 5.16 / 5.17 `setAsignaturaActivo(tx, scope, id, activo): Promise<AsignaturaActiveResult>`.
- [x] 5.18 structure pin: `catalog-structure.test.ts` already listed `asignaturas.ts` in `DATA_MODULES` (WU1c-B); added one explicit test that the module is inspected. Mutation checks: a temporary `.delete(` failed "never deletes a row"; a temporary `.transaction(` failed "opens a transaction only in catalog-write.ts"; both reverted, `asignaturas.ts` hash identical to before the second mutation, 5/5 after.
- [x] 5.19 V (no build), see below.

Result kinds:
- `createAsignatura`: `created { id }`, `carrera_invalid`, `codigo_taken { inScope, activo }`.
- `updateAsignatura`: `updated { id, campos }`, `unchanged { id }`, `not_found`, `inactive` (A-1), `carrera_invalid`.
- `setAsignaturaActivo`: `changed { id, activo }`, `unchanged { id }`, `not_found`, `has_active_groups { count }`.

### TDD Cycle Evidence
| Task | Test file | RED reason observed | GREEN |
|------|-----------|---------------------|-------|
| 5.12/5.13 | `data/asignaturas.test.ts` (`createAsignatura`) | 15 fail: `createAsignatura is not a function` | 15/15 |
| 5.14/5.15 | same (`updateAsignatura`) | 14 fail: `updateAsignatura is not a function` | 14/14 |
| 5.16/5.17 | same (`setAsignaturaActivo`) | 9 fail: `setAsignaturaActivo is not a function` (38 failures in total for the three RED runs, observed together before any GREEN code) | 9/9 after one test-side fix: the expected count predicate was `"Grupo"."Activo"`, drizzle emits `"Grupo"."Activo" = $2` with `true`; implementation unchanged |
| 5.18 | `data/catalog-structure.test.ts` | characterization pin; mutation checks above | 5/5 |

### V results (build excluded)
- WU2a focused command plus `catalog-structure.test.ts`: 10 files, 257/257.
- `npm test`: 72 files, 1,175/1,175 (baseline 1,136; +39 tests: 38 write tests, 1 structure test). `npm run typecheck`: clean.
- `npx eslint` on the 3 touched files: only prettier formatting of my new lines at first; fixed with `--fix` (these are untracked files, as in earlier batches); clean afterwards.
- `git status` shows `src/lib/users/list-params.test.ts` and `src/lib/validations/schemas.test.ts` / `src/lib/import/schemas.test.ts` unmodified.

### Authored lines (WU2a-B writes delta on top of the reads baseline)
`asignaturas.ts` 152 -> 332 (+181 -1: one existing import line changed to a value import of `carreraIdForWrite`, three import lines added inside existing blocks), `asignaturas.test.ts` 383 -> 771 (+388, no existing line modified), `catalog/types.ts` unchanged (71), `catalog-structure.test.ts` 73 -> 77 (+4). **Delta 574** (under 800).

### Notes and deviations
- UNVERIFIED (task 5.13): after a caught `23505` inside the transaction, Postgres marks the transaction aborted, so the `COMMIT` that `db.transaction` issues is an implicit rollback. `createAsignatura` returns `codigo_taken`, `toEvents` returns `[]`, so nothing is audited and nothing is written. Not proven against a real database; the Neon rehearsal should confirm it (and that `db.transaction` does not throw on that implicit rollback instead of resolving).
- The natural-key lookup and the Carrera existence check carry no scope predicate. The lookup is unscoped by design (a duplicate outside the scope must still be refused, task 5.12); the Carrera table has no scope. Every select and update on `Asignatura` by id carries `asignaturaRowInScope`.
- The active-Grupo count in `setAsignaturaActivo` carries no scope predicate of its own: it runs after the scoped read proved the Asignatura is in scope, in the same locked transaction.
- `inScope` for `codigo_taken` is computed in TypeScript from the matching row's carrera (`all` true; `carrera` equal id; `none` false), the same TypeScript-side scope evaluation `listCarreraOptions` uses, since `catalog-scope-sql.ts` must not change.
- `updateAsignatura`: an absent `carreraId` keeps the row's current carrera (it does not go through `carreraIdForWrite`, whose `all` + undefined answer is `null`); a named one goes through `carreraIdForWrite`, and the Carrera existence check runs only when it differs from the current one.
- Test double: `tx` reuses the existing recording `statement` proxy; a queued thenable (`rejecting`) makes one statement throw (a thenable passed to `resolve` is adopted), so the existing proxy was not modified.
- Engram persistence: no memory tool available to the executor; the orchestrator should save `sdd/catalog-management/apply-progress` from this file.

## Batch WU2b-1: shared UI pieces (2026-10-05)

Mode: Strict TDD. Nothing committed or staged. No database touched, no dev server. Tasks 6.1-6.13 done; **stopped at the seam (after 6.13) by the mandatory stop rule**: measured delta 650 lines, and 6.14-6.15 (parity test with parameterised refusal rendering in two locales, plus the full `catalog.shared` copy in both locales) are estimated at about 225 more, so the unit would reach about 875 (> 800, no `size:exception`). 6.14-6.17 not started (6.17 stays with the orchestrator). Tree compiles, all tests green.

### Completed
- [x] 6.1 Read. "You are here" marker: `.is-current` (`globals.css:317`, `text-foreground font-medium` plus an inset 3px `--primary` underline; the sidebar variant is a 4px bar). The filter's pair is `--accent` / `--accent-foreground` (`bg-accent text-accent-foreground`). `buttonVariants` `ghost` + `size: "lg"` gives the 44px (`h-11`) link.
- [x] 6.2 Baseline (characterization) on the exact working tree: `users/page.test.tsx` and `data-table-search.test.tsx`, 2 files, **18/18 passed, no failure**. The "known flaky set" in the tasks header no longer exists (fixed in an earlier change; `vitest.setup.ts` sets a 5 s async-utility timeout). Every later run was judged against "no failure".
- [x] 6.3 / 6.4 `src/components/status-pill.tsx` (`StatusPill({ active, label })`, markup identical to the one in `users/page.tsx`).
- [x] 6.5 `users/page.tsx`: local `StatusPill` removed, import added (numstat 1 / 14: one import line added, the 14-line local function removed because it moved; no other change). `users/` suite 4 files, 32/32, the same result as before.
- [x] 6.6 / 6.7 `src/components/form-field.tsx`.
- [x] 6.8 / 6.9 `src/components/status-filter.tsx`.
- [x] 6.10 / 6.11 `data-table-search.tsx` gains optional `hidden` and `clearHref`; the 6 existing tests are untouched and green.
- [x] 6.12 / 6.13 `src/app/(dashboard)/catalog/not-found.tsx`.

### Component props defined
- `StatusPill({ active: boolean; label: string })`.
- `FormField({ id: string; label: string; hint?: string; error?: string; children: (control: FormFieldControlProps) => ReactNode })`, with `FormFieldControlProps = { id: string; "aria-describedby"?: string; "aria-invalid"?: true }` exported. The control comes from a render function so any input, select trigger or combobox can spread `id`, `aria-describedby` and `aria-invalid`; hint id is `${id}-hint`, error id `${id}-error`; `aria-describedby` lists hint then error; an empty or absent error renders nothing and sets no `aria-invalid`.
- `StatusFilter({ base: CatalogListBase; q: string; status: CatalogStatusFilter })`. Reads `catalog.shared.filter.*` through `useTranslations` (valid in a non-async server component: the `react-server` export of `next-intl` provides it; checked in `node_modules/next-intl/dist/esm/development/index.react-server.js`). Renders a `nav` (`aria-label` from `filter.label`) with three `Link`s in the order active, inactive, all; hrefs from `catalogListHref(base, { q, status })` (no `page`); selected link: `aria-current="true"`, `bg-accent text-accent-foreground` (also on hover); no link carries `is-current`; every link is `h-11`.
- `DataTableSearch` new optional props: `hidden?: Readonly<Record<string, string>>` (one `<input type="hidden">` per entry, before the search box) and `clearHref?: string` (clear control target, default the bare `action`; still shown only when `value` is non-empty).
- `CatalogNotFound()` takes **no props**; `PageHeader` (the one `h1` plus the explanation) and one `Link` to `/` (`buttonVariants({ size: "lg" })`, `h-11`). Server component (`getTranslations("catalog.shared.notFound")`).

### TDD Cycle Evidence
| Task | Test file | RED reason observed | GREEN |
|------|-----------|---------------------|-------|
| 6.2 | `users/page.test.tsx`, `data-table-search.test.tsx` | characterization, not RED | 18/18 baseline |
| 6.3/6.4 | `components/status-pill.test.tsx` | import of `@/components/status-pill` unresolved, no tests ran | 6/6 |
| 6.5 | `users/page.test.tsx` (unchanged) | move: import-only diff plus removed local function | `users/` 32/32 |
| 6.6/6.7 | `components/form-field.test.tsx` | import of `@/components/form-field` unresolved, no tests ran | 7/7 |
| 6.8/6.9 | `components/status-filter.test.tsx` | import of `@/components/status-filter` unresolved, no tests ran (keys `catalog.shared.filter.*` were also absent; authored early with 6.9, see below) | 8/8 |
| 6.10/6.11 | `components/data-table-search.test.tsx` | 2 of 5 new tests fail (hidden inputs absent; clear target is the bare action); the other 3 guard unchanged defaults and passed; all 6 old tests passed | 11/11 |
| 6.12/6.13 | `catalog/not-found.test.tsx` | import of `catalog/not-found` unresolved, no tests ran (keys `catalog.shared.notFound.*` authored early with 6.13) | 5/5 |

### Copy authored early (component tests render the real catalogs; the 6.14 RED is therefore still to be shown)
`catalog.shared` already exists in both locales with only these keys (identical sets):
- `filter.label`: es "Filtrar por estado"; en "Filter by status"
- `filter.active`: es "Activos"; en "Active"
- `filter.inactive`: es "Inactivos"; en "Inactive"
- `filter.all`: es "Todos"; en "All"
- `notFound.title`: es "Este registro no está disponible"; en "This record is not available"
- `notFound.message`: es "Puede que no exista o que no esté disponible para tu cuenta. Vuelve atrás y revisa el listado."; en "It may not exist, or it may not be available to your account. Go back and check the list."
- `notFound.back`: es "Volver al panel"; en "Back to the dashboard"

The rest of `catalog.shared` (status labels, toggle, field errors, refusals, no-carrera, busy, import-wins note) is 6.14-6.15 and is NOT authored.

### V results (build included; 6.16 run on the stop state)
- Focused `npx vitest run src/components "src/app/(dashboard)/catalog/not-found.test.tsx" "src/app/(dashboard)/users" src/i18n`: 14 files, 152/152.
- `npm test`: 76 files, **1,206/1,206** (baseline 72 / 1,175; +4 files, +31 tests: status-pill 6, form-field 7, status-filter 8, data-table-search +5, not-found 5). No failure anywhere.
- `npm run typecheck`: clean (two test-side typing fixes in `not-found.test.tsx`: typed `onError`, namespace cast).
- `npx eslint` on the 11 touched files: only the pre-existing CRLF `Delete ␍` noise on files that were already CRLF (`data-table-search.tsx`, its test, `users/page.tsx`); one real prettier error in my new test lines was fixed; new files normalised with `--fix`.
- `npm run build`: compiled and typechecked; routes `/`, `/_not-found`, `/api/catalog/template`, `/catalog/import`, `/change-password`, `/denied`, `/login`, `/profile`, `/register`, `/users`, `/users/new` (all dynamic) plus Proxy (Middleware). `/users` still builds. `catalog/not-found.tsx` is a special file, so it adds no route row; that it renders inside the dashboard layout is the user's manual check in 6.17.

### Authored lines (delta on top of the WU2a baseline)
New: `status-pill.tsx` 19, `status-pill.test.tsx` 72, `form-field.tsx` 55, `form-field.test.tsx` 80, `status-filter.tsx` 53, `status-filter.test.tsx` 134, `catalog/not-found.tsx` 24, `catalog/not-found.test.tsx` 92 = 529. Tracked: `users/page.tsx` 15 (+1 -14), `data-table-search.tsx` 11 (+10 -1), `data-table-search.test.tsx` 69, `i18n/es.json` 13 (22/2 minus baseline 9/2), `i18n/en.json` 13, `catalog-parity.test.ts` 0 (still 43/0). **Total 650** (budget 800, no `size:exception`). Estimate for 6.14-6.15: parity test about 100 plus the rest of `catalog.shared` about 62 lines per locale (about 125): about 225, so about 875 for the whole piece.

### Notes and deviations
- `FormField` takes a render function for the control instead of a plain `children` node: label, hint and error are tied to the control by `aria-describedby` / `aria-invalid` on the control itself, which a wrapper cannot do for arbitrary (and compound Base UI) controls without `cloneElement`. The tasks do not fix the API; this is the smallest one that satisfies 6.6.
- `StatusFilter` uses `useTranslations` itself (labels from `catalog.shared.filter.*`, per 6.8) instead of receiving labels as props; call sites need only `base`, `q`, `status`.
- 6.5 "import only": the local function had to be deleted for the move to be a move, so the diff is the import line plus the removed function; nothing else in `page.tsx` changed.
- Spec vs design conflicts: none found.
- Files I created were normalised with `eslint --fix`; existing CRLF files were edited with CRLF preserved (numstat of the baseline files matches the deltas above).
- Engram persistence: no memory tool available to the executor; the orchestrator should save `sdd/catalog-management/apply-progress` from this file.

## Batch WU2b-1 shared copy (2026-10-05)

Mode: Strict TDD. Nothing committed or staged. No database touched, no dev server. Tasks 6.14, 6.15 and 6.16 done; 6.17 (checkpoint) stays with the orchestrator. No component, page, action or data module touched.

### Completed
- [x] 6.14 RED `src/i18n/catalog-parity.test.ts` (extended, existing assertions untouched): `catalog.shared` joins `GUARDED_SECTIONS`; `fieldErrors` equals `CATALOG_FIELD_ERROR_KEYS` in both locales; every refusal is rendered through next-intl's `createTranslator` (a missing key or bad placeholder throws) and asserted for its required content; plus presence of status, toggle, noCarrera and importWins keys.
- [x] 6.15 GREEN `i18n/es.json`, `i18n/en.json`: the rest of `catalog.shared`. The seven keys from the previous piece are unchanged.
- [x] 6.16 V including build.

### TDD Cycle Evidence
| Task | Test file | RED reason observed | GREEN |
|------|-----------|---------------------|-------|
| 6.14/6.15 | `src/i18n/catalog-parity.test.ts` | 22 failed / 24 passed (46). Every failure is `MISSING_MESSAGE` or a key-set mismatch for the keys not yet authored (fieldErrors x2, status/toggle/noCarrera/importWins x2, activeGrupos x2, duplicateInactive x2, duplicate x2, noCarrera x2, parentInactive x4, busy x2, inactive x2, unchanged/alreadyInactive x2). The `catalog.shared` GUARDED_SECTIONS cases passed because the seven existing keys are a valid section. | 46/46 after two test-side regex fixes (Spanish "Reactívalo" carries an accent, so the matcher is `/reactívalo/`) |

### V results
- Focused `npx vitest run src/components "src/app/(dashboard)/catalog/not-found.test.tsx" "src/app/(dashboard)/users" src/i18n`: 14 files, 177/177.
- `npm test`: 76 files, 1,231/1,231 (baseline 1,206; +25 tests). No failure.
- `npm run typecheck`: clean.
- `npx eslint src/i18n/catalog-parity.test.ts`: no output (JSON files are not linted).
- `npm run build`: passes; `/users` and all routes build.

### Authored lines (delta on top of the piece baseline)
`i18n/es.json` +63 / -0 (85/2 total vs baseline 22/2), `i18n/en.json` +63 / -0, `catalog-parity.test.ts` +152 / -0 (195/0 vs 43/0). **Total 278** (budget 800).

### New `catalog.shared` keys (es / en)
- `status.active`: Activo / Active; `status.inactive`: Inactivo / Inactive
- `toggle.deactivate`: Desactivar / Deactivate; `toggle.reactivate`: Reactivar / Reactivate
- `toggle.confirmTitle` ({record}): ¿Desactivar {record}? / Deactivate {record}?
- `toggle.nothingDeleted`: No se elimina nada: el registro queda inactivo y puedes reactivarlo cuando quieras. / Nothing is deleted: the record becomes inactive and you can reactivate it whenever you want.
- `toggle.confirm`: Sí, desactivar / Yes, deactivate; `toggle.cancel`: Cancelar / Cancel
- `fieldErrors.*`: the 15 `CATALOG_FIELD_ERROR_KEYS` (nested by dot: codigo, nombre, horasTotales, carreraId, asignaturaId, docenteId, periodo, numGrupo)
- `noCarrera.title`, `noCarrera.message`: no Carrera assigned, ask whoever administers the system
- `busy`: nothing was saved, wait and try again
- `importWins`: The next catalog import can replace these values.
- `refusals.activeGrupos` ({count}, plural), `refusals.duplicate` (generic), `refusals.duplicateInactive`, `refusals.parentInactive.asignatura` / `.docente` ({parent}), `refusals.inactive` (A-1), `refusals.unchanged` and `refusals.alreadyInactive` (A-3)

### Notes and deviations
- Design deviation: none. Refusals live in `catalog.shared.refusals` (as 6.14 asserts); tasks 8.9 / 12.10 mention entity-level `errors` namespaces, which can reference or reuse these.
- Out-of-scope copy not authored: list, form and page text (7.x, 8.x, 9.x). Plain `error`/unexpected message not authored (not named in 6.14-6.15).
- Engram persistence: no memory tool available to the executor; the orchestrator should save `sdd/catalog-management/apply-progress` from this file.

## Batch WU2b-2: list page, guard test, list copy (2026-10-05)

Mode: Strict TDD. Nothing committed or staged. No database touched, no dev server. Tasks 7.1-7.4, 7.7 and 7.8 done; **stopped at the seam by the mandatory stop rule**: measured delta 926 lines (budget 800, no `size:exception`) before 7.5-7.6 (sidebar entry and its test, estimated +70). 7.5, 7.6 and 7.9 not done (7.9 is run on the stop state below, not ticked); 7.10 and 7.11 stay with the user/orchestrator. Tree compiles, all tests green.

### Completed
- [x] 7.1 Read. Mocks reused: the real `dal.ts` over `vi.mock("@/lib/auth/cookies")` and a `next/navigation` `redirect` that throws `REDIRECT:<path>` (import page test); `@/lib/data/users` reduced to `getCatalogActor`; `next-intl/server` `getTranslations` through `createTranslator` with the real catalogs (not-found test); `NextIntlClientProvider` with a throwing `onError` for `StatusFilter` (`useTranslations`).
- [x] 7.2 RED `catalog/guards.test.ts` (structural, `readdirSync`/`readFileSync`).
- [x] 7.3 RED `catalog/asignaturas/page.test.tsx`.
- [x] 7.4 GREEN `catalog/asignaturas/page.tsx`.
- [x] 7.7 RED / 7.8 GREEN `catalog-parity.test.ts` + list copy. **Copy authored before the page test ran** (the page test renders the real catalogs); the 7.7 RED was run first and shown.
- [ ] 7.5 / 7.6 sidebar: NOT started. The `nav.catalogAsignaturas` key is already in both locales (and in `GUARDED_SECTIONS`) but no sidebar entry uses it yet.

### TDD Cycle Evidence
| Task | Test file | RED reason observed | GREEN |
|------|-----------|---------------------|-------|
| 7.2 | `catalog/guards.test.ts` | 1 failed: "discovers at least one page", expected 0 > 0 (no page yet; the per-page `it.each` cases register nothing until a page exists) | 7/7 (1 discovery + guard-first, no-action x1 page, list-page-no-mutation) |
| 7.3 | `catalog/asignaturas/page.test.tsx` | import of `@/app/(dashboard)/catalog/asignaturas/page` unresolved, no tests ran | 35/35 (two first-run failures, see Notes) |
| 7.7/7.8 | `src/i18n/catalog-parity.test.ts` | 10 failed / 48 passed: `catalog.asignaturas` and `nav.catalogAsignaturas` absent (exists, non-empty), exact list-key set x2, parameterised render x2, degraded x2. The "identical key sets" cases passed vacuously (both undefined) | 58/58 (one test-side regex fix: Spanish "No se pudieron") |

### V results (stop state, build included)
- Focused `npx vitest run "src/app/(dashboard)/catalog/asignaturas" "src/app/(dashboard)/catalog/guards.test.ts" src/components/app-sidebar.test.tsx src/i18n`: 4 files, 144/144.
- `npm test`: 78 files, 1,281/1,281 (baseline 76 / 1,231; +2 files, +50 tests). No failure.
- `npm run typecheck`: clean. `npx eslint` on the 3 new files and the parity test: no output (new files normalised with `--fix`).
- `npm run build`: passes; route list `/`, `/_not-found`, `/api/catalog/template`, `/catalog/asignaturas`, `/catalog/import`, `/change-password`, `/denied`, `/login`, `/profile`, `/register`, `/users`, `/users/new`, all dynamic.

### Authored lines (delta on top of the piece baseline)
New: `catalog/guards.test.ts` 75, `catalog/asignaturas/page.tsx` 229, `catalog/asignaturas/page.test.tsx` 471 = 775. Tracked: `i18n/es.json` 121/2 vs 85/2 = +36, `i18n/en.json` +36, `catalog-parity.test.ts` 274/0 vs 195/0 = +79. **Total 926.** Remaining 7.5-7.6: sidebar test about +55, `app-sidebar.tsx` about +8 (CRLF files, counted by full diff), so about 990 for the whole piece.

### New copy (es / en)
- `nav.catalogAsignaturas`: Asignaturas / Subjects
- `catalog.asignaturas.title`: Asignaturas / Subjects; `subtitle`: Consulta y gestiona las asignaturas del catálogo. / Browse and manage the subjects in the catalog.; `newButton`: Nueva asignatura / New subject
- `columns.code|name|career|hours|status|actions`: Código, Nombre, Carrera, Horas, Estado, Acciones / Code, Name, Career, Hours, Status, Actions
- `edit`: Editar / Edit (the link carries `aria-label` "Editar {codigo}")
- `empty`: Aún no hay asignaturas activas. / There are no active subjects yet.
- `noResults.title` ({q}): Sin resultados para «{q}» / No results for “{q}”; `noResults.titleStatus`: No hay asignaturas con este filtro. / There are no subjects with this filter.; `noResults.hint`: Prueba con otro código o nombre, o cambia el filtro de estado. / Try another code or name, or change the status filter.
- `degraded`: No se pudieron cargar las asignaturas. Vuelve a intentarlo en unos minutos. / Could not load the subjects. Try again in a few minutes.
- `search.label|placeholder|submit|clear`: Buscar asignaturas, Código o nombre, Buscar, Limpiar búsqueda / Search subjects, Code or name, Search, Clear search
- `count`: plural, "# asignatura(s)" / "# subject(s)", `=0` "Sin asignaturas" / "No subjects"; `tableCaption`: Lista de asignaturas / Subjects list
- `pagination.region|previous|next|status`: Paginación de asignaturas, Anterior, Siguiente, Página {page} de {pages} / Subjects pagination, Previous, Next, Page {page} of {pages}

### Notes and deviations
- No-carrera copy is not duplicated under `catalog.asignaturas`: the page reuses `catalog.shared.noCarrera.title|message` (task 7.7 lists a no-carrera key; reuse keeps one source and `catalog.shared` is untouched).
- Empty vs no-results: "nothing at all" is the default view (status active, no `q`) with zero rows; any other view with zero rows is "no results" (title with `q` when searching, `titleStatus` otherwise). The status filter nav is the way to clear a status-only filter; the search clear control keeps the status through `clearHref`. A second query to know whether inactive rows exist was not added.
- The search form always carries `status` as a hidden field (including the default `active`).
- The Edit link uses `aria-label` ("Editar MAT101") instead of an `sr-only` span: the span duplicated the code text in the row and the accessible name lost its space.
- The "New" button and the empty-state button link to `/catalog/asignaturas/new`, which does not exist until Phase 9 (the task asks for the create button; no write is reachable in this unit).
- The guard test requires the first `await` in a page to be `await requireCatalogAccess(`, stricter than "before `await searchParams`".
- Test fix during GREEN: `getByText("MAT101")` matched twice with the first Edit-link markup; fixed in the page (aria-label), test unchanged.
- Engram persistence: no memory tool available to the executor; the orchestrator should save `sdd/catalog-management/apply-progress` from this file.

## Batch WU2b-2 sidebar (2026-10-05)

Tasks 7.5, 7.6 and 7.9 done (7.10 USER smoke and 7.11 checkpoint left open).

- 7.5 RED: `app-sidebar.test.tsx` extended (ordered group hrefs per role, flat link list per role, tab order, Asignaturas item describe: link, hidden for docente/estudiante, no bare `/catalog`, exactly one `aria-current` on `/catalog/import`, `/catalog/asignaturas` and `/catalog/asignaturas/12/edit`). Run: 12 failed / 45 passed, every failure from the missing Asignaturas link.
- 7.6 GREEN: `catalogAsignaturas` entry (`BookOpen`, `visibleTo: canManageCatalog`, `/catalog/asignaturas`) placed before `catalogImport`. Locale keys already existed; locale files untouched.
- 7.9 V: focused 4 files / 153 tests passed; `npm test` 1290/1290; typecheck clean; eslint only pre-existing CRLF `Delete` noise; `npm run build` passes, `/catalog/asignaturas` is dynamic.
- Size: app-sidebar.tsx +12/-1, app-sidebar.test.tsx +66/-6 (85 changed lines).
- Rollback boundary: the two sidebar files only.

## Batch WU2c-1: Asignatura server actions, create part (2026-10-06)

Mode: Strict TDD. Nothing committed or staged. No database touched, no dev server. Tasks 8.1-8.4 done; **stopped at the first mandatory measure (after 8.4) by the stop rule**: measured delta 494 lines, and 8.5-8.10 are estimated at about 420 more (update test about 140 and action about 50, toggle test about 100 and action about 45, `types.ts` about 12, copy about 10, parity about 60), so the piece would reach about 910 (> 800, no `size:exception`). 8.5-8.12 not started; 8.11 was run on the stop state only (not ticked); 8.12 stays with the user. Tree compiles, all tests green.

### Completed
- [x] 8.1 Read `users/new/actions.ts` and test, `catalog/import/actions.ts`, the `redirect` and `revalidatePath` guides. N5 confirmed: a literal path such as `/catalog/asignaturas/12/edit` takes no `type`. N4 confirmed: `redirect` defaults to `push` in a Server Action and throws, so it sits outside every `try`. No deviation.
- [x] 8.2 RED `catalog/guards.test.ts` extended (structural): discovery of `actions.ts` under `catalog/{asignaturas,grupos}`, every exported action's first `await` is `await requireCatalogAccess()` with no `formData.get`/`fd.get` before it, and only async functions (and types) are exported (a `"use server"` module).
- [x] 8.3 RED `asignaturas/actions.test.ts` (`createAsignaturaAction`, scenarios a-i of the task).
- [x] 8.4 GREEN `asignaturas/actions.ts` (`createAsignaturaAction`) and `CatalogFormState` in `catalog/types.ts`.
- [ ] 8.5-8.10 not started (resume here: update, then toggle, then copy). 8.12 left for the user.

### Design of the harness and the action (for the next batch)
- `actions.test.ts` mocks `requireCatalogAccess`, `@/lib/data/asignaturas`, `next/navigation` (`redirect` throws `REDIRECT:<path>`), `next/cache`, `@/db` (`transaction` runs `work(tx)` on a recording double) and `@/lib/data/audit` (`insertAuditEvents` is a spy). **`withCatalogWrite` and `asignaturaWriteEvents` are real**, so the lock order, `toEvents`, the `55P03` -> `CatalogBusyError` mapping and the single `catalog.write.failed` log line are exercised (a pass-through double would not prove them). The translator echoes `key` or `key:{values}`; `catalog-parity.test.ts` (8.9) must pin that every key the action source uses exists in both locales (source scan of `actions.ts`).
- `form()` is a `FormData` stand-in whose `get` throws until the guard mock has resolved, used by every test.
- `actions.ts` helpers (private, not exported because of `"use server"`): `fieldErrors(t, zodError)` (first issue per field, key `shared.fieldErrors.<issue.message>`), `unexpected(t)` (`asignaturas.errors.unexpected`), `failure(error, t)` (`CatalogBusyError` -> `busy`, else `unexpected`). Namespace `catalog`, so keys are `shared.*` and `asignaturas.errors.*`.
- Action order: guard, translator, scope `none` -> `error` (`shared.noCarrera.message`) before any field is read, schema parse, `withCatalogWrite(actorId, work, asignaturaWriteEvents)` inside `try`, result switch, `revalidatePath` then `redirect` outside `try`.
- Pre-check of A-6 (8.5/8.7) plan: a private `findInScope(actorId, scope, id)` returning `found | missing | failed` (a thrown read is logged with `logCatalogFailure` because the wrapper is not involved yet, then answers `unexpected`), called before `withCatalogWrite`; `missing` -> `{ kind: "gone" }` without opening a transaction.
- `ActiveToggleState` (`idle | done{activo} | error{message} | gone | busy | unchanged`) is added to `catalog/types.ts` with 8.7/8.8.
- Copy needed by the action source so far: only `catalog.asignaturas.errors.unexpected` (every other message reuses `catalog.shared`); not authored yet (8.10).

### Result kind -> state and message key (`createAsignaturaAction`)
| Data-layer result | State returned | Message key |
|---|---|---|
| `created { id }` | `revalidatePath("/catalog/asignaturas")`, `redirect("/catalog/asignaturas")`; one `asignatura.creada` event (`origen: "manual"`) | n/a |
| `codigo_taken { inScope: true, activo: false }` | `{ kind: "error", message }` | `shared.refusals.duplicateInactive` |
| `codigo_taken` (any other combination) | `{ kind: "error", message }` | `shared.refusals.duplicate` (identical object for out-of-scope active and inactive) |
| `carrera_invalid` | `{ kind: "invalid", fieldErrors: { carreraId } }` | `shared.fieldErrors.carreraId.invalid` |
| `updated`, `unchanged`, `not_found`, `inactive` (impossible for create) | `{ kind: "error", message }` | `asignaturas.errors.unexpected` |
| schema failure | `{ kind: "invalid", fieldErrors }` | `shared.fieldErrors.<key>` per field |
| scope `none` | `{ kind: "error", message }` | `shared.noCarrera.message` |
| `CatalogBusyError` (`55P03`) | `{ kind: "busy" }`, no log, no revalidate/redirect | none (form shows `shared.busy`) |
| any other throw | `{ kind: "error", message }`, one `catalog.write.failed` line from the wrapper | `asignaturas.errors.unexpected` |

### TDD Cycle Evidence
| Task | Test file | RED reason observed | GREEN |
|------|-----------|---------------------|-------|
| 8.2 | `catalog/guards.test.ts` | 1 failed: "discovers at least one actions module", expected 0 > 0 (file absent; the per-file cases register nothing until a module exists) | 7 per-file/structure cases pass with `actions.ts` present |
| 8.3/8.4 | `asignaturas/actions.test.ts` | import of `@/app/(dashboard)/catalog/asignaturas/actions` unresolved, no tests ran | 29/29 (file); 36/36 with `guards.test.ts` |

### V results (stop state)
- Focused `npx vitest run "src/app/(dashboard)/catalog/asignaturas/actions.test.ts" "src/app/(dashboard)/catalog/guards.test.ts" src/lib/catalog src/i18n`: 6 files, 129/129.
- `npm test`: 79 files, 1,322/1,322 (baseline 78 / 1,290; +1 file, +32 tests). No failure.
- `npm run typecheck`: clean. `npx eslint` on the four touched files: no output (new files normalised with `--fix`; `guards.test.ts` and `types.ts` hand-formatted).
- `npm run build`: passes with the new `"use server"` module; route list unchanged (`/catalog/asignaturas` dynamic; no new route).

### Authored lines (delta on top of the piece baseline), measured after 8.4
`asignaturas/actions.ts` 108 (new), `asignaturas/actions.test.ts` 315 (new), `catalog/guards.test.ts` 75 -> 133 (+58), `catalog/types.ts` 71 -> 84 (+13). `i18n/es.json`, `i18n/en.json` (121/2) and `catalog-parity.test.ts` (274/0) untouched. **Total 494** (budget 800, no `size:exception`). Intermediate measures after 8.6 and 8.8: not reached.

### Notes
- Engram persistence: no memory tool available to the executor; the orchestrator should save `sdd/catalog-management/apply-progress` from this file.

## Batch WU2c-1 update/toggle (2026-10-06)

Mode: Strict TDD. Nothing committed or staged. No database touched, no dev server. Tasks 8.5-8.11 done; 8.12 (checkpoint) left for the user. No Phase 9 work. Measured after 8.6 about 420 and after 8.8 about 711 (estimate for the rest about 65, total about 775 < 800), so no stop was needed.

### Completed
- [x] 8.5 RED / 8.6 GREEN `updateAsignaturaAction`.
- [x] 8.7 RED / 8.8 GREEN `setAsignaturaActivoAction`, `ActiveToggleState` in `catalog/types.ts`.
- [x] 8.9 RED / 8.10 GREEN parity test (source scan of `actions.ts`) and `catalog.asignaturas.errors.unexpected` in both locales.
- [x] 8.11 V.

### Design of the actions
- Private helper `addressed(actorId, scope, rawId)`: `parseRecordId`, then the lock-free scoped `getAsignaturaById` (A-6) outside `withCatalogWrite`; returns `{ id } | "gone" | "failed"`. A thrown read is logged once with `logCatalogFailure` and answers the generic error. Private `revalidateAsignatura(id)` revalidates the list and the literal edit path (no `type`, N5).
- Form fields: update reads `id`, `nombre`, `carreraId`, `horasTotales` (no `codigo`); toggle reads `id` and `intent` (`deactivate | reactivate`, mapped to `false | true`; anything else answers `gone` before any read of the record).
- Order in both: guard, translator, scope `none` -> noCarrera error (no field read), [toggle: intent], id + pre-check, [update: schema], `withCatalogWrite(..., asignaturaWriteEvents)` in `try`, result switch. Update success redirects to the list after revalidating (outside `try`); toggle `changed` revalidates and returns `done` (no redirect).
- `ActiveToggleState = idle | done{activo} | error{message} | gone | busy | unchanged`.

### Result kind -> state and message key
| Outcome | `updateAsignaturaAction` | `setAsignaturaActivoAction` |
|---|---|---|
| guard rejects | propagates, nothing read | same |
| scope `none` | `error` `shared.noCarrera.message` | same |
| bad / absent id, pre-check null (missing and foreign alike) | `{ kind: "gone" }`, no lock | same |
| unknown intent | n/a | `{ kind: "gone" }`, no read |
| pre-check read throws | `error` `asignaturas.errors.unexpected`, one `catalog.write.failed` line | same |
| schema failure | `invalid` + `shared.fieldErrors.<key>` | n/a |
| `updated` | revalidate list + edit path, `redirect` to list; one `asignatura.actualizada` event (names only) | n/a |
| `changed { activo }` | n/a | revalidate list + edit path, `done { activo }`; one `asignatura.desactivada` / `asignatura.reactivada`, `campos: ["activo"]` |
| `unchanged` | `{ kind: "unchanged" }` (A-3) | `{ kind: "unchanged" }` (A-3) |
| `inactive` | `{ kind: "inactive" }` (A-1) | n/a (not in `AsignaturaActiveResult`) |
| `not_found` (in transaction) | `{ kind: "gone" }`, identical to the pre-check | same |
| `carrera_invalid` | `invalid` `carreraId` -> `shared.fieldErrors.carreraId.invalid` | n/a |
| `has_active_groups { count }` | n/a | `error` `shared.refusals.activeGrupos` with `{ count }` |
| `created`, `codigo_taken` (impossible for update) | `error` `asignaturas.errors.unexpected` | n/a |
| `CatalogBusyError` | `{ kind: "busy" }`, no log | `{ kind: "busy" }`, no log |
| any other throw | `error` `asignaturas.errors.unexpected`, one wrapper log line | same |

### TDD Cycle Evidence
| Task | Test file | RED reason observed | GREEN |
|------|-----------|---------------------|-------|
| 8.5/8.6 | `asignaturas/actions.test.ts` (`updateAsignaturaAction`) | 31 failed / 29 passed: `updateAsignaturaAction is not a function` (all 31 new cases) | 67/67 with `guards.test.ts` (first run) |
| 8.7/8.8 | same (`setAsignaturaActivoAction`) | 30 failed / 61 passed: `setAsignaturaActivoAction is not a function`; the "use server / no GET" structural case passed at once (characterization of an already true property) | 98/98 with `guards.test.ts` |
| 8.9/8.10 | `src/i18n/catalog-parity.test.ts` | 4 failed / 59 passed: `asignaturas.errors.unexpected: expected 'undefined' to be 'string'` (es, en) and `expected [] to deeply equal ['unexpected']` (es, en) | 63/63 after the two locale entries |

### V results
- Focused `npx vitest run "src/app/(dashboard)/catalog/asignaturas/actions.test.ts" "src/app/(dashboard)/catalog/guards.test.ts" src/lib/catalog src/i18n`: 6 files, 196/196.
- `npm test`: 79 files, 1,389/1,389 (baseline 1,322; +67). Run before the final `eslint --fix` (prettier only); focused set re-run after it: 196/196.
- `npm run typecheck`: clean. `npx eslint` on the 4 touched code files: clean (4 prettier complaints fixed with `--fix` on the two untracked files only; `catalog-parity.test.ts` and `types.ts` needed none).
- `npm run build`: passes; route list unchanged (no route added).

### Authored lines (delta on top of the piece baseline)
`actions.ts` 108 -> 259 (+154 -3: the three data/validation import lines replaced), `actions.test.ts` 315 -> 845 (+532 -2: the `CatalogFormState` type import and the action import line replaced), `catalog/types.ts` 84 -> 95 (+11), `i18n/es.json` +4 -1 (121/2 -> 124/2; the previous `}` gained a comma), `i18n/en.json` +4 -1, `catalog-parity.test.ts` 274 -> 331 (+58 -1: one line of the "exactly the list keys" test replaced by a three-line `filter`). **Total about 770** (budget 800).

### New i18n keys (under `catalog.asignaturas.errors`)
- `unexpected`: es "No se pudo guardar el cambio. Inténtalo de nuevo en unos minutos." / en "The change could not be saved. Try again in a few minutes." Every other message reuses `catalog.shared.*`.

### Notes and deviations
- Modified existing lines: `catalog-parity.test.ts` "%s carries exactly the list keys" now ignores `errors.*` (the list test pins the list keys; the new describe pins `errors`). The create tests are untouched; only the mock table, two imports and the import of the actions were extended.
- Update with scope `none` answers the noCarrera error before reading any field (same as create); the design is silent. A `none` actor sees no record anyway.
- The inactive-edit refusal comes from the in-transaction `updateAsignatura` (`inactive`), not from the pre-check: the pre-check only answers "exists in scope".
- Update success redirects to the list; the task does not state the target, the list matches create and CM-ASG-3 "the list shows the new values".
- Spec vs design conflicts: none. Engram persistence: no memory tool available to the executor; the orchestrator should save `sdd/catalog-management/apply-progress` from this file.

## Batch WU2c-2 toggle (2026-10-06)

Mode: Strict TDD. Nothing committed or staged. No database touched, no dev server. Tasks 9.1, 9.2, 9.3 and 9.8 done. **Stopped after 9.3 + 9.8 by the budget rule**: measured delta 584 lines; the form pair (9.4 test + 9.5 component) is estimated at 300-500 more, which would pass 800. 9.4-9.7, 9.9-9.13 not started. No locale key authored.

### Completed
- [x] 9.1 Read. Step one: `Button variant="secondary" size="lg"` (`bg-secondary`); confirm: `variant="destructive" size="lg"` (`text-destructive-ink`); cancel: `variant="ghost" size="lg"`; all 44px. Note: `docs/design-system.md` §5 calls the Stitch secondary `outline`; the spec/design say the `secondary` variant, which is what is used. Breadcrumb current segment is the `.is-current` class (not used here). `new-user-form.test.tsx` pitfall: the Select popup renders in a portal, so options are read only after `findAllByRole`; the toggle has no popup.
- [x] 9.2 RED `catalog/active-toggle.test.tsx` (22 tests).
- [x] 9.3 GREEN `catalog/active-toggle.tsx` (client).
- [x] 9.8 `docs/design-system.md` §5 "Two-step confirmation (inline)" (English, as the document; no new token).

### Component: `ActiveToggle`
Props: `action: ActiveToggleAction` (`(previous: ActiveToggleState, formData: FormData) => Promise<ActiveToggleState>`, exported type), `id: number`, `recordLabel: string`, `activo: boolean`, `notice?: string` (caller-owned sentence shown in the confirm step, for an Asignatura the active-group count; keeps the component entity-agnostic and needs no new key).
Form: `<form method="post" onSubmit>`; `preventDefault`, then `startTransition(() => dispatch(new FormData(form)))` with `id` and `intent` (`deactivate | reactivate`) set. No `href` anywhere.
Flow: step one pill + secondary button; deactivate reveals a `role="group"` (labelled by the `confirmTitle` sentence naming the record, `nothingDeleted`, `notice`, destructive confirm, ghost cancel) and focuses the confirm; cancel restores focus to step one with no dispatch; reactivate is a single press. The control is disabled while pending.

### State kinds (rendered as text in a `role="status" aria-live="polite"` region that is mounted from the start)
| Kind | Rendering |
|---|---|
| `idle` | empty region |
| `done { activo }` | pill and button flip; region says `catalog.shared.status.active|inactive` |
| `unchanged` | deactivate: `refusals.alreadyInactive`; reactivate: `refusals.unchanged`; pill shows the requested state |
| `error { message }` | the server's message (alert styling, plus text) |
| `busy` | `catalog.shared.busy`, control kept for a retry |
| `gone` | `notFound.title` + `notFound.message`, button removed |

### TDD Cycle Evidence
| Task | Test file | RED reason observed | GREEN | Flakiness (3 runs) |
|---|---|---|---|---|
| 9.2/9.3 | `catalog/active-toggle.test.tsx` | import of `@/app/(dashboard)/catalog/active-toggle` unresolved, no tests ran | 22/22 | 22/22, 22/22, 22/22 |

### V results (9.11 itself NOT ticked)
- `npx vitest run "src/app/(dashboard)/catalog"`: 13 files, 349/349.
- `npm test`: 80 files, 1,411/1,411 (baseline 79 / 1,389; +1 file, +22).
- `npm run typecheck`: clean. `npx eslint` on the two new files: clean (`--fix` applied, new files only).
- `npm run build`: passes; route list unchanged.

### Authored lines (piece delta, measured after 9.3 + 9.8)
`active-toggle.tsx` 214 (new), `active-toggle.test.tsx` 358 (new), `docs/design-system.md` +12/-0. Locale files and `catalog-parity.test.ts` unchanged (124/2, 124/2, 331/0). **Total 584** (budget 800).

### Notes and deviations
- No locale key added. The `done` announcement reuses `status.*` (a dedicated "deactivated" message would need keys: 9.10 may add `toggle.done*` and tighten the text). The count sentence for the confirm step is passed in as `notice` by the page (9.7) with copy from 9.10.
- Estimate for the rest of Phase 9: 9.4 form test about 330, 9.5 form about 200, 9.6 page tests about 300, 9.7 pages about 150, 9.9-9.10 parity and copy about 150: about 1,100-1,200.
- Engram persistence: no memory tool available to the executor; the orchestrator should save `sdd/catalog-management/apply-progress` from this file.

## Batch WU2c-2 form (2026-10-06)

Mode: Strict TDD. Nothing committed or staged. No database touched, no dev server. Tasks 9.4 and 9.5 done. 9.6-9.7, 9.9-9.13 not started (left unchecked).

### Completed
- [x] 9.4 RED `catalog/asignaturas/asignatura-form.test.tsx` (25 tests).
- [x] 9.5 GREEN `catalog/asignaturas/asignatura-form.tsx` (client).

### Component: `AsignaturaForm`
Props: `action: AsignaturaFormAction` (`(previous: CatalogFormState, formData: FormData) => Promise<CatalogFormState>`), `record?: AsignaturaFormRecord` (`{ id, codigo, nombre, horasTotales, carreraId, activo }`; absent means create), `carrera: { kind: "fixed"; nombre } | { kind: "choose"; options: { id, nombre }[] }`, `reactivate?: ReactNode` (shown in place of the submit control while the record is locked). Imports no data-layer module.
- Submit: `<form method="post" noValidate onSubmit>`; `preventDefault`, then `startTransition(() => dispatch(new FormData(form)))`. Fields are uncontrolled (`defaultValue`), so values survive any answer. No form `action` attribute.
- Fields: `codigo` (create only; in edit shown as text with its hint, never an input), `nombre`, `horasTotales` (`type="number"`), `carreraId` Select for `choose`; for `fixed` the Carrera is text and **no `carreraId` is submitted** (the server decides, CM-SCOPE-3). Edit adds a hidden `id` and the muted `catalog.shared.importWins` line.
- Locked (record inactive on load, or the server answered `inactive`): inputs `readOnly`, Select `disabled`, no submit control, `refusals.inactive` shown, `reactivate` slot rendered. The page must pass the slot only for the inactive view; an edit page that always has a State section will already hold the toggle.

### State kind -> rendering (text in a `role="status" aria-live="polite"` region mounted from the start)
| Kind | Rendering |
|---|---|
| `idle` | nothing |
| `invalid` | each message under its field via `FormField` (`role="alert"`, `aria-invalid`, `aria-describedby`); a key for a field the form does not draw (e.g. `carreraId` for a fixed Carrera) goes to the region as an error panel |
| `error { message }` | the message, in the destructive panel (border and text, not colour alone) |
| `gone` | `notFound.title` + `notFound.message`; submit removed |
| `busy` | `shared.busy`; submit stays available for a retry |
| `inactive` | locked, `refusals.inactive` in the error panel, reactivate slot |
| `unchanged` | `refusals.unchanged` |
| pending | submit disabled and relabelled `submitting` |

### TDD Cycle Evidence
| Task | Test file | RED reason observed | GREEN | Flakiness |
|---|---|---|---|---|
| 9.4/9.5 | `asignaturas/asignatura-form.test.tsx` | import of `@/app/(dashboard)/catalog/asignaturas/asignatura-form` unresolved, no tests ran | 25/25 first run | 25/25 x3 in isolation; passed inside the full suite |

Mutation check: `readOnly={false}`, dropping `method="post"` and renaming `horasTotales` failed 7 tests; reverted, 25/25.

### V results
- `npx vitest run "src/app/(dashboard)/catalog" src/i18n`: 15 files, 437/437 (after the parity filter fix below; the first run had 2 failures from that cause).
- `npm test`: 81 files, 1,436/1,436 (baseline 80 / 1,411; +25). The known intermittent `import-form` test did not fail.
- `npm run typecheck`: clean. `npx eslint` on the two new files and `catalog-parity.test.ts`: no output (new files `--fix`ed).
- `npm run build`: passes; routes unchanged (`/catalog/asignaturas` dynamic; the new/edit routes arrive with 9.7).

### Authored lines (delta on top of the toggle-piece baseline)
`asignatura-form.tsx` 254 (new), `asignatura-form.test.tsx` 472 (new), `i18n/es.json` +12 (136/2 vs 124/2), `i18n/en.json` +12, `catalog-parity.test.ts` +2 (333/0 vs 331/0). **Total 752** (budget 800).

### New i18n keys (`catalog.asignaturas.form`, identical sets in both locales; es / en)
- `codigoLabel`: Código / Code
- `codigoHint`: El código no se puede cambiar después de crear la asignatura. / The code cannot be changed after the subject is created.
- `nombreLabel`: Nombre / Name
- `horasLabel`: Horas totales / Total hours
- `carreraLabel`: Carrera / Carrera
- `carreraPlaceholder`: Selecciona una Carrera / Select a Carrera
- `carreraFixedHint`: Se usa tu Carrera. No necesitas elegirla. / Your Carrera is used automatically. You do not need to choose one.
- `submitCreate`: Crear asignatura / Create subject
- `submitSave`: Guardar cambios / Save changes
- `submitting`: Guardando… / Saving…
Reused from `catalog.shared`: `importWins`, `busy`, `notFound.title|message`, `refusals.unchanged|inactive`.

### Deviations and notes
- One existing line of `catalog-parity.test.ts` changed (not extended): the "carries exactly the list keys" filter now also ignores `form.*` (as it already ignored `errors.*`), otherwise the new `form` namespace broke it (2 failures). 9.9 should pin the `form` keys.
- No cancel link: the pages' breadcrumb is the way back (no key added). No new colour, radius, size or spacing step; submit is `size="lg"` (44px).
- Hours input is `type="number"`; `noValidate` so the server's translated messages drive validation.
- Estimate for 9.6-9.7 and 9.9-9.10: pages tests about 300, pages about 150, parity and breadcrumb/toggle copy about 150: about 600.
- Engram persistence: no memory tool available to the executor; the orchestrator should save `sdd/catalog-management/apply-progress` from this file.

## Batch WU2c-2 pages (2026-10-06)

Mode: Strict TDD. Nothing committed or staged. No database touched, no dev server. Tasks 9.6, 9.7, 9.9 and 9.10 done and ticked. 9.11 V was run (below) but is NOT ticked: **the piece measures 1,235 changed lines against the 800 budget** (the order below let the whole piece land before the post-9.7 measure; the orchestrator/user must accept `size:exception` or decide how to cut). 9.12 and 9.13 untouched.

### Completed
- [x] 9.6 RED `asignaturas/new/page.test.tsx`, `asignaturas/[id]/edit/page.test.tsx`.
- [x] 9.9 RED `catalog-parity.test.ts` (run before 9.10; copy was authored only after it failed).
- [x] 9.10 GREEN copy in both locales (needed by the page tests, so it was done before 9.7).
- [x] 9.7 GREEN `new/page.tsx`, `[id]/edit/page.tsx`, plus `asignaturas/bound-controls.tsx`.

### Design
- `guards.test.ts` forbids a page importing `*/actions`, so a client module `bound-controls.tsx` binds each action (`CreateAsignaturaForm`, `EditAsignaturaForm`, `AsignaturaActiveToggle`). Page tests mock the `actions` module.
- Both pages: `requireCatalogAccess()` first; scope `none` -> breadcrumb, header and `catalog.shared.noCarrera` (no read, no form, edit does not 404). Edit: `params: Promise<{ id: string }>` awaited after the guard, `parseRecordId`, `getAsignaturaById(scope, id)`, `notFound()` for a bad id, a missing record and a foreign record, with no `try`. A thrown read propagates.
- Carrera: scope `all` -> `choose` with `listCarreraOptions(scope)`; scope `carrera` -> `fixed` (new: name from `listCarreraOptions`; edit: `record.carreraNombre`, no option query).
- Edit page: breadcrumb (`.is-current` only there), form, State section (`h2`, `ActiveToggle`; `notice` = `state.activeGroups` count sentence while active).

### TDD Cycle Evidence
| Task | Test file | RED reason observed | GREEN | Flakiness (3 runs) |
|---|---|---|---|---|
| 9.6/9.7 | `new/page.test.tsx`, `[id]/edit/page.test.tsx` | both imports unresolved, no tests ran | 50/50 (+ `guards.test.ts`, 61/61) | 50/50 x3 |
| 9.9/9.10 | `catalog-parity.test.ts` | 8 failed / 68 passed: `breadcrumb.edit` unresolved (es, en), `page.reactivateHint` undefined, exact page/breadcrumb/state key sets, active-groups render | 76/76 (two test-side fixes: sorted expected keys, `/react[ií]v/`) | n/a |

### V results
- `npx vitest run "src/app/(dashboard)/catalog" src/i18n`: 17 files, 504/504.
- `npm test`: 83 files, 1,503/1,503 (baseline 81 / 1,436).
- `npm run typecheck`: clean. `npx eslint` on the new files and the parity test: no output.
- `npm run build`: passes; routes include `/catalog/asignaturas/[id]/edit` and `/catalog/asignaturas/new`.

### Authored lines (delta on top of the form-piece baseline)
`new/page.tsx` 78, `new/page.test.tsx` 299, `[id]/edit/page.tsx` 141, `[id]/edit/page.test.tsx` 525, `bound-controls.tsx` 34 (all new = 1,077); `i18n/es.json` +16 (152/2 vs 136/2), `i18n/en.json` +16; `catalog-parity.test.ts` +126 (459/0 vs 333/0; includes one reformatted filter line). **Total 1,235.** `guards.test.ts` unchanged (133).

### New i18n keys (`catalog.asignaturas`; es / en)
- `page.newTitle`: Nueva asignatura / New subject; `page.newSubtitle`: Completa los datos para agregar una asignatura al catálogo. / Fill in the details to add a subject to the catalog.
- `page.editTitle`: Editar asignatura / Edit subject; `page.editSubtitle`: Actualiza los datos de la asignatura. / Update the subject's details.
- `page.reactivateHint`: Para editarla, reactívala primero en la sección Estado. / To edit it, reactivate it first in the Status section.
- `breadcrumb.label`: Ruta de navegación / Breadcrumb; `breadcrumb.new`: Nueva asignatura / New subject; `breadcrumb.edit` ({codigo}): Editar {codigo} / Edit {codigo}
- `state.title`: Estado / Status
- `state.activeGroups` (plural on {count}): es `=0` Esta asignatura no tiene grupos activos. / `one` Esta asignatura tiene # grupo activo. Desactívalo antes de poder desactivar la asignatura. / `other` ...# grupos activos. Desactívalos antes de poder desactivar la asignatura.; en `=0` This subject has no active groups. / `one` This subject has # active group. Deactivate it before you can deactivate the subject. / `other` ...# active groups. Deactivate them before you can deactivate the subject.

### Deviations and notes
- Order: 9.6 RED, 9.9 RED, 9.10, 9.7 (the page tests render the real catalogs). Both REDs were run and shown first.
- `reactivate` is passed to the form as a plain hint (`page.reactivateHint`), not as the toggle: the toggle is a `<form>`, and the slot sits inside the edit `<form>`, which would nest forms. The real reactivate control is the one in the State section (single press); a test pins that no `form` is nested.
- One existing line of `catalog-parity.test.ts` changed: the "carries exactly the list keys" filter also ignores `page.`, `breadcrumb.` and `state.`.
- Toggle copy already lived in `catalog.shared.toggle` (no new key); the parity test now pins its key set and the "nothing is deleted / reactivate" sentence in both locales.
- Engram persistence: no memory tool available to the executor; the orchestrator should save `sdd/catalog-management/apply-progress` from this file.

## Batch WU3b-1: Combobox primitive (2026-10-06)

Mode: Strict TDD. Nothing committed or staged. No database, dev server or build touched. Tasks 11.1, 11.2, 11.3 (not needed), 11.4, 11.5, 11.6 done and ticked; 11.7 (user checkpoint) left unchecked. `package.json` untouched.

### Completed
- [x] 11.1 Read. `ComboboxRoot` takes `name`, `items`, `required`, `disabled`, `value`/`defaultValue`, `onValueChange`, `isItemEqualToValue`; items shaped `{ value, label }` need no `itemToStringLabel`/`itemToStringValue`. A submitted value is produced by a hidden `<input name>` rendered by the root (`serializedValue`); the visible `Combobox.Input` carries no `name` in single-selection mode, so exactly one entry reaches `FormData`. `required` lands on the hidden input (native `checkValidity()` works). The input id is the `id` given to `Combobox.Input`; `aria-describedby`/`aria-invalid` pass through to it.
- [x] 11.2 RED `src/components/ui/combobox.test.tsx` (18 tests).
- [x] 11.3 Not needed: 11.2 reliable; no fallback to `Select`.
- [x] 11.4 GREEN `src/components/ui/combobox.tsx`.
- [x] 11.5 `docs/design-system.md` §5 "Combobox" entry (English, as the document; no new token).
- [x] 11.6 Verification (below).

### Component: `Combobox` (`src/components/ui/combobox.tsx`, client)
Props (`ComboboxProps`): `name: string`; `items: readonly { value: string; label: string }[]` (`value` is the id); `emptyText: string`; `truncated?: boolean` + `truncatedText?: string` (the note under the field is rendered only when both are set, and its id is appended to `aria-describedby`); `placeholder?`; `defaultValue?: string | null` (option `value` preselected on first render; uncontrolled afterwards, so a selection survives parent re-renders); `onValueChange?(value: string | null)`; `required?`; `disabled?`; `className?`; and `id`, `aria-describedby`, `aria-invalid` (the `FormFieldControlProps` from `FormField`, spread directly).
Submission: the chosen option's `value` goes in a Base UI hidden input named `name` (empty string while nothing is chosen; omitted entirely when disabled). Typed text is never submitted.
Styling: `Input` tokens (40px, `rounded-lg`, `border-input`, primary border + ring on focus, `aria-invalid` destructive) and the `SelectContent` popup tokens; options `min-h-11` (44px) with the `accent` pair on `data-highlighted`; decorative chevron. No new colour, radius, size or spacing step.

### TDD Cycle Evidence
| Task | Test file | RED reason observed | GREEN | Flakiness |
|---|---|---|---|---|
| 11.2/11.4 | `components/ui/combobox.test.tsx` | `Failed to resolve import "@/components/ui/combobox"`, no tests ran | 16/18 first run; 18/18 after one test-side fix | 18/18 x5 consecutive (twice: before and after eslint --fix); full suite x3 |

First GREEN run: 2 tests failed, both test-side. While the popup is open Base UI marks the rest of the page `aria-hidden`, so `getByRole("combobox", { name })` cannot find the input after `click` opened it; fixed by using `user.type` directly (it clicks, opens and types) instead of `click` followed by a role query. No sleeps, no retries.
Mutation check: removing `name` and `required` from the root failed 6 tests; reverted, 18/18.

### V results
- `npx vitest run src/components/ui/combobox.test.tsx` x5: 18/18 every time.
- `npm test` x3: 84 files, 1,521/1,521 each time (baseline 83 / 1,503; +1 file, +18 tests).
- `npm run typecheck`: clean. `npx eslint` on the two new files: clean after `--fix` (first run had 4 prettier errors in the new files only).
- `rg -i combobox docs/design-system.md`: hit; `package.json` clean.

### Authored lines
`combobox.tsx` 141 (new), `combobox.test.tsx` 279 (new), `docs/design-system.md` +13 (numstat 25/0 vs baseline 12/0). **Total 433** (forecast 500-800, budget 800).

### Not provable in jsdom (needs a browser check, 13.13)
Real positioning and width of the popup (`--anchor-width`, `--available-height`, collision flipping), scrolling a long list and keeping the highlighted option in view, the focus ring and 44px targets visually, touch behaviour, screen-reader announcement of the empty text and of the option count, and the page behind the popup being made inert. Opening/closing animations are not asserted.

### Notes and deviations
- No deviation from design or spec. Items use `{ value, label }` so the grupo form can map `{ id, ... }` to it.
- A `Trigger` button was deliberately not added (the input opens the popup on click and ArrowDown); a chevron is decoration only.
- Cap note is a `<p>` under the input, not inside the popup, so it is readable without opening the popup and is part of the accessible description.
- Engram persistence: no memory tool available to the executor; the orchestrator should save `sdd/catalog-management/apply-progress` from this file.
