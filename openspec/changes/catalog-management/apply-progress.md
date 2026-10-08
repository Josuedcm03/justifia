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

## Batch WU-D1 (16A + 16B code) (2026-10-07)

Mode: Strict TDD. Delivery: option D (one branch, a PR per stretch). Nothing committed or staged. No database command, dev server or build was run. Scope: 16.1, 16.4-16.14. Not done by design: 16.2/16.3 (orchestrator, read-only), **16.15** (`db:generate`, needs the owner's confirmation), 16.16-16.18, all of 16C.

### Completed
- [x] 16.1 Read. Lines changed by 16.7/16.8: `types.ts` (append `"dias"` after `"origen"`), `types.test.ts` (the pinned Grupo array), `events.test.ts` (the `grupoCreatedEvent` expectation spread `[...AUDITABLE_GRUPO_FIELDS]`, the forbidden-key/sentinel sweep, the Grupo builder list). The two credential pins are the `@ts-expect-error` comments in the "credential-leak pins" block (`clave` on `accountUpdatedEvent`; `TemporaryCredential` to `accountCreatedEvent`); `git diff` of `events.test.ts` shows no `ts-expect-error` line, so both are byte-identical.
- [x] 16.4 Baseline at HEAD `ff74e9e`: `git diff --numstat` is zero for `types.ts`, `types.test.ts`, `events.test.ts`, `schema.ts`, `schema.test.ts`, `modelo_datos_sql.md`, `_journal.json`; the only modified file is `tasks.md` (not counted). No untracked file touched by the unit. Suite baseline: 84 files, 1521/1521; typecheck clean.
- [x] 16.5 / 16.6 `src/lib/catalog/dias.ts` + `dias.test.ts` (33 tests)
- [x] 16.7 / 16.8 `AUDITABLE_GRUPO_FIELDS` gains `"dias"` last (one production line); `types.test.ts` array pin and `events.test.ts` extended
- [x] 16.9 Characterization pin proven by mutation (below)
- [x] 16.10 Checkpoint 16A
- [x] 16.11 `schema.test.ts` extended (3 tests)
- [x] 16.12 RED only: `src/db/migration-0006.test.ts` (7 tests). Stays RED until 16.15.
- [x] 16.13 `modelo_datos_sql.md` Grupo block
- [x] 16.14 `src/db/schema.ts` (last code edit of the batch)

### TDD Cycle Evidence
| Task | Test file | RED reason observed | GREEN |
|------|-----------|---------------------|-------|
| 16.5/16.6 | `src/lib/catalog/dias.test.ts` | `@/lib/catalog/dias` unresolved, no tests ran | 33/33 |
| 16.7/16.8 | `src/lib/audit/types.test.ts`, `events.test.ts` | 2 fail: Grupo array lacks `dias`; `grupoCreatedEvent` campos lack `dias` (the new days-only/docente/same-set tests and the sentinel sweep pass on RED because they depend on `changedFields`/builders only; their `"dias"` literals fail `tsc` before the constant widens) | `src/lib/audit` + `src/lib/catalog`: 114/114 |
| 16.9 | same | mutation: `"dias"` moved to the front of the constant failed 2 tests (`lists the Grupo fields in order`, `created: grupo.creado ... full closed field list`); reverted, 114/114 | n/a |
| 16.11/16.14 | `src/db/schema.test.ts` | 3 of 3 new fail (column absent; CHECK absent; check list lacks `CK_Grupo_Dias`) | 25/25 |
| 16.12 | `src/db/migration-0006.test.ts` | 7/7 fail: `expected exactly one drizzle/0006_*.sql, found 0` (5 tests), journal entry `idx: 6` undefined, snapshot `0006` absent | pending 16.15 |

### Work Unit Evidence
| Evidence | Value |
|---|---|
| Focused test command | `npx vitest run src/lib/catalog src/lib/audit src/db`: 15 files, 14 pass, 1 fails (`migration-0006.test.ts`, expected RED); 185 passed, 7 failed |
| Runtime harness | N/A: pure code, `getTableConfig`/`PgDialect` text, fs reads; no database or server touched |
| Rollback boundary | delete `src/lib/catalog/dias.ts`, `dias.test.ts`, `src/db/migration-0006.test.ts`; revert `src/lib/audit/types.ts`, `types.test.ts`, `events.test.ts`, `src/db/schema.ts`, `schema.test.ts`, `modelo_datos_sql.md` |

### V results (build excluded)
- `npm test`: 86 files, 1568 tests: 1561 passed, 7 failed. All 7 are `src/db/migration-0006.test.ts` (the expected 16.12 RED). Baseline 1521 + 47 new (dias 33, events 4, schema 3, migration-0006 7).
- `npm run typecheck`: clean.
- `npx eslint <touched files>`: only the pre-existing CRLF `Delete ␍` noise; new files prettier-clean (`--fix` applied to `dias.ts`, `dias.test.ts` only); two prettier findings in my additions to `schema.test.ts` fixed by hand.

### Authored lines (additions + deletions vs HEAD; `tasks.md` and `apply-progress.md` excluded)
16A: `dias.ts` 52 (new), `dias.test.ts` 115 (new), `events.test.ts` 93 (90/3), `types.test.ts` 1, `types.ts` 1 = **262**.
16B code: `schema.test.ts` 41, `schema.ts` 7 (6/1), `migration-0006.test.ts` 103 (new), `modelo_datos_sql.md` 13 (12/1) = **164**.
Batch total **426** (forecast for the whole unit 400-650, budget 800). Generated `0006` files are not yet emitted.

### Exact `schema.ts` change
Added `smallint` to the `drizzle-orm/pg-core` import, `dias: smallint("Dias").notNull().default(0),` after `origen`, and `check("CK_Grupo_Dias", sql\`${t.dias} between 0 and 127\`)` after `CK_Grupo_Origen`; the `Grupo` doc comment gained three lines about `Dias`.

### Ordering window (16.14)
The tree now declares `grupo.dias`, a column neither the shared database nor `rehearsal-catalog-ui` has. A `next dev` server is listening on port 3100 against `rehearsal-catalog-ui` (PID 29864); it must not run an import apply (the only Grupo insert) until 16.34. It was not touched. Asignatura screens are unaffected.

### Code affected by the new column
- `npm run typecheck` is clean, so no literal `Grupo` row fixture or typed insert needed a change (`NuevoGrupo`/`Grupo` are not used by any test; the import's `GrupoRow`/`GrupoWrite` are separate types).
- `src/lib/import/apply.ts:215` `tx.insert(grupo).values(part)`: `dias` is optional on the insert type (NOT NULL with a default), so it compiles unchanged; at runtime drizzle names the column (`default` for omitted values), so this insert would fail with `42703` against a database without `0006`. This is the ordering-rule risk, no code change.
- `src/lib/import/apply.ts:220,236` updates: `.set` names only given columns; unaffected.
- `src/lib/data/catalog.ts:84` (`loadCatalogSnapshot`) uses an explicit projection; unaffected (no `dias` until Phase 17). The two `innerJoin(grupo, ...)` readers (lines 123, 149) and `asignaturas.ts:320` select explicit columns/count; unaffected.
- No test breaks. No Phase 10 or 17 behaviour was implemented.

### `migration-0005.test.ts` check
Passes unmodified (8/8 in the full run). Its assertions look up `drizzle/0005_*.sql` by pattern `^0005_`, journal `idx === 5` and the `0004` to `0005` snapshot chain; none counts journal entries or files, and `schema.ts` is not read. A `0006` journal entry, `0006_*.sql` or `0006_snapshot.json` cannot affect it (design finding F-I confirmed).

### What `migration-0006.test.ts` expects (for 16.15/16.16)
Exactly one `drizzle/0006_*.sql`, with exactly two statements split on `--> statement-breakpoint`, in order: (1) containing `ALTER TABLE "Grupo" ADD COLUMN "Dias" smallint DEFAULT 0 NOT NULL`; (2) matching `^ALTER TABLE "Grupo" ADD CONSTRAINT "CK_Grupo_Dias" CHECK \(([^;]*)\)\s*;?$` whose body contains `between` and exactly the integers `0` and `127`. No `DROP`, `RENAME`, `ALTER COLUMN`, `UPDATE`, `INSERT`, `DELETE`, `BEGIN`/`COMMIT`/`ROLLBACK`; no `EventoAuditoria`, `Asignatura`, `CK_Grupo_Origen`, `UNIQUE`. Journal entry `idx: 6` with tag `^0006_`; `drizzle/meta/0006_snapshot.json` exists, `prevId` equals the `0005` snapshot `id`, no `EventoAuditoria`. Expected emitted CHECK text: `"Grupo"."Dias" between 0 and 127`. If drizzle-kit emits an equivalent form that the regex rejects, adjust the test in the same batch and record it (16.16).

### Notes and deviations
- 16.11 lists "`schema.ts` still mentions neither `audit-schema` nor `eventoAuditoria`": the pre-existing test in the same file already pins this and still passes, so it was not duplicated.
- The `created` expectation in `events.test.ts` now lists the seven names explicitly instead of spreading the constant, so the test pins the contents rather than mirroring the constant; `AUDITABLE_GRUPO_FIELDS` was dropped from that file's imports (it became unused; the array is pinned in `types.test.ts`).
- No deviation from design or spec.
- Engram persistence: no memory tool available to the executor; the orchestrator should save `sdd/catalog-management/apply-progress` from this file.

## Phase 16B closed except 16.18: orchestrator records (2026-10-07)

- [x] 16.2 DG1 on `production` (`br-restless-hat-ayjwtjqw`, Neon `run_sql`, read-only): 3 Asignatura, 3 Grupo, no `Grupo.Dias` column, 6 migration rows, last hash `160ac32b119960dbc12411bf492036d5c89789c2d1767076eb9f35aaf77152ae`, 4 audit rows. Reference for DG4, DG8a and DG9.
- [x] 16.3 Shared host from `.env` (host part only): `ep-orange-math-ay4rhpc0-pooler.c-5.us-east-2.aws.neon.tech`, equal to 1.2.
- [x] 16.15 `npm run db:generate -- --name grupo_dias` run after the owner's explicit confirmation for that command ("si, ejecuta"). Exit 0, no rename prompt. Emitted `drizzle/0006_grupo_dias.sql`, `drizzle/meta/0006_snapshot.json` and journal entry `idx: 6`, tag `0006_grupo_dias`.
- [x] 16.16 Hand review: exactly two statements, in this order: `ALTER TABLE "Grupo" ADD COLUMN "Dias" smallint DEFAULT 0 NOT NULL`; `ALTER TABLE "Grupo" ADD CONSTRAINT "CK_Grupo_Dias" CHECK ("Grupo"."Dias" between 0 and 127)`. No third statement; nothing touches `EventoAuditoria`, `Asignatura`, `CK_Grupo_Origen` or a unique constraint. The emitted CHECK text equals the expected text, so `migration-0006.test.ts` needed no change.
- [x] 16.17 V without build: `npx vitest run src/db` 8 files, 78/78 (GREEN for 16.12; `migration-0005.test.ts` unmodified and passing); `npm test` 86 files, 1568/1568; `npm run typecheck` clean. WU-D1 authored size by path against HEAD `ff74e9e`: 426 lines of code and tests plus the 2-line migration file and the 7-line journal entry (the generated snapshot is excluded).
- File hash at review time: sha256 `135155163356348b18b7959e5e2720e7f272c2800ff0ed747504012f6e20d2c7`, identical with LF endings (the file is LF).

Open: 16.18 (the owner reviews the `0006` SQL and the `schema.ts` diff and approves the rehearsal in writing). The ordering window opened at 16.14 is still open: the working tree declares `Grupo.Dias`; `production` and `rehearsal-catalog-ui` lack it. A `next dev` process still listens on port 3100 against `rehearsal-catalog-ui`.

## Phase 16C: migration gates on the rehearsal branch (2026-10-07)

- [x] 16.18 The owner reviewed the emitted `0006` SQL shown in the conversation and approved the rehearsal in writing ("daale, metele"), together with the creation of the rehearsal branch.
- [x] 16.19 DG-H freeze: sha256 of `drizzle/0006_grupo_dias.sql` is `135155163356348b18b7959e5e2720e7f272c2800ff0ed747504012f6e20d2c7`, both as it is in the working tree and with LF endings. Any later edit invalidates 16.20-16.33.
- [x] 16.20 DG2: Neon branch `rehearsal-0006` (`br-sweet-fire-ay3vxzm9`) created from `production` (`br-restless-hat-ayjwtjqw`, parent LSN `0/23957B8`) in project `damp-recipe-21839554`. Host `ep-bold-bread-ay8t2nns-pooler.c-5.us-east-2.aws.neon.tech` (pooled), different from the shared host of 16.3. Read-only check on the branch before migrating: 3 Asignatura, 3 Grupo, 6 migration rows, no `Grupo.Dias` (equal to 16.2).
- [x] 16.21 and 16.22 DG3, after the owner's confirmation ("dale") for the migrate and the four probes shown with their SQL: `npm run db:migrate` with a shell-scoped `DATABASE_URL` (`.env` untouched). HC in the same script: the target host must equal the `rehearsal-0006` host and differ from the shared host, and the file hash must equal 16.19, otherwise abort. Exit 0, "migrations applied successfully!".
- [x] 16.23 DG4 on `rehearsal-0006` (read-only): `Grupo.Dias` is `smallint`, `NOT NULL`, default `0`; 0 of 3 Grupo rows with `"Dias" <> 0`; `CK_Grupo_Dias` present in `pg_constraint` as `CHECK ((("Dias" >= 0) AND ("Dias" <= 127)))` (Postgres normalises `between`); `CK_Grupo_Origen` unchanged; 3 Grupo active, 0 with a non-import origin; row counts equal to 16.2; 7 migration rows, the last with hash `135155163356348b18b7959e5e2720e7f272c2800ff0ed747504012f6e20d2c7`, equal to 16.19.
- [x] 16.24-16.27 DG5, one script, four transactions, each ended in `ROLLBACK`; HC printed the `rehearsal-0006` host and the script aborts on any other host.
  - DG5a: `UPDATE "Grupo" SET "Dias" = 128` -> `23514`; `UPDATE ... = -1` -> `23514`; `INSERT` with `128` -> `23514` (each in a savepoint).
  - DG5b: a `Grupo` insert that omits `Dias` stored `Dias = 0`, `Origen = importacion`, `Activo = true`.
  - DG5c: insert with `5` stored `5`; insert with `127` stored `127`; `UPDATE` back to `0` stored `0`.
  - DG5d: on a row with mask `5`, `("Dias" & 1) <> 0` is true, `("Dias" & 2) <> 0` is false, `("Dias" & 4) <> 0` is true; `pg_typeof("Dias")` is `smallint`.
  - Deviation from 16.25's wording, same as 1.20: the parent `Asignatura` (`ZZPROBE0006`) was created inside each rolled-back transaction, but the docente was an existing one.
- [x] 16.28 After the probes: 3 Asignatura, 3 Grupo, 0 Grupo with `"Dias" <> 0`, 0 probe rows. Nothing persisted.
- [x] 16.29 DG4-DG5 outcome: **pass**. DG6 is not repeated: no new locking mechanism; the G6 evidence of 2026-10-04 stands. Unblocks 16.30-16.33.

## Phase 16C: production apply and ordering gate (2026-10-07)

- [x] 16.30 DG7, after the owner's confirmation ("va") for the two commands shown (backup branch, then production migrate): Neon branch `backup-before-0006` (`br-long-queen-ayekh3qf`) created from `production` at parent LSN `0/23958E8`, without a compute endpoint. It holds the pre-`0006` state, including the import applied on 2026-10-06. `backup-before-0005` and `backup-before-0004-audit` were left as they are.
- [x] 16.31 DG8a pre-apply re-check on `production` (read-only): 3 Asignatura, 3 Grupo, no `Grupo.Dias`, 6 migration rows, last hash `160ac32b…52ae`, 4 audit rows (equal to 16.2); `.env` host equal to 16.3; file hash equal to 16.19.
- [x] 16.32 DG8: `npm run db:migrate` with the `.env` URL and no shell override. HC in the same script: abort if `DATABASE_URL` is already set in the shell, if the `.env` host is not `ep-orange-math-ay4rhpc0-pooler.c-5.us-east-2.aws.neon.tech`, or if the file hash differs from 16.19. Exit 0, "migrations applied successfully!". `drizzle-kit push` never used.
- [x] 16.33 DG9 on `production` (read-only): `Grupo.Dias` is `smallint`, `NOT NULL`, default `0`; 0 of 3 Grupo rows with `"Dias" <> 0`; `CK_Grupo_Dias` present as `CHECK ((("Dias" >= 0) AND ("Dias" <= 127)))`; `CK_Grupo_Origen` present; 3 Asignatura, 3 Grupo (3 active, 0 with a non-import origin), 4 audit rows, all equal to 16.2; 7 migration rows; last row hash `135155163356348b18b7959e5e2720e7f272c2800ff0ed747504012f6e20d2c7`, equal to 16.19's LF hash.
- [x] 16.34 **Ordering gate: 0006 applied and verified on production (2026-10-07).** A commit containing 16.14's `schema.ts` change with the three `drizzle/0006*` files may now be merged or deployed, and app write flows against the shared database are safe again. Phase 17 is unblocked. Still without the column: the Neon branch `rehearsal-catalog-ui` (`br-winter-forest-ayk1fa3a`), where a `next dev` process on port 3100 was last seen listening; no import apply and no Grupo screen may run against it until it receives `0006` or is deleted (16.35).

Open in Phase 16: 16.35 (DG10 decisions about `rehearsal-0006` and `rehearsal-catalog-ui`; the owner decides) and 16.36 (WU-D1 checkpoint). Uncommitted at this point: the WU-D1 code and tests, `drizzle/0006_grupo_dias.sql`, `drizzle/meta/0006_snapshot.json`, `drizzle/meta/_journal.json`, `modelo_datos_sql.md`, `tasks.md`, `apply-progress.md`. **The three `drizzle/` files must be committed**: the shared database already records migration 7, and a checkout without them would not match it. Neon branches now: `production`, `rehearsal-0006` (`br-sweet-fire-ay3vxzm9`, has `0006`), `rehearsal-catalog-ui` (lacks `0006`), `backup-before-0006`, `backup-before-0005`, `backup-before-0004-audit`.

## Phase 16 closed (2026-10-07)

- [x] 16.35 DG10 decisions by the owner ("procede borrándola"): `rehearsal-0006` (`br-sweet-fire-ay3vxzm9`, has `0006`) stays as the target of every remaining manual smoke (the rest of 9.12, 13.13, 15.6) and is deleted at 15.7. `rehearsal-catalog-ui` (`br-winter-forest-ayk1fa3a`, lacked `0006`) was deleted with the owner's confirmation and verified absent with `list_branches`; the `next dev` process on port 3100 that pointed at it (PID 29864) was stopped first, and the port is free. The Asignatura `A004` created there during 9.12 is gone with the branch. Remaining Neon branches: `production` (default), `rehearsal-0006`, `backup-before-0006` (`br-long-queen-ayekh3qf`), `backup-before-0005`, `backup-before-0004-audit`.
- [x] 16.36 Checkpoint WU-D1 presented to the owner and approved: the `0006` SQL (two additive statements), the `schema.ts` diff, `src/lib/catalog/dias.ts`, `dias` last in the audit list, and the DG1-DG9 evidence above. Phase 16 is 36/36. After DG8 the rollback policy is forward-fix only.

Note for 9.12: only the manual create was verified before the branch was deleted. The remaining steps of that smoke are to be run on `rehearsal-0006`.

## Batch WU-D3 (Phase 18, tasks 18.1-18.10) (2026-10-07)

Status: 10 of 11 tasks ticked; 18.11 (owner checkpoint) left open. Tree compiling, no failing test.

### 18.1 Read-only record
- `Label` classes: `text-label text-foreground flex items-center gap-2 select-none ...`. Input focus: `focus-visible:border-primary focus-visible:ring-ring/40 focus-visible:ring-3 outline-none` (design-system §7: ring is `--ring`, 2px ring with offset for buttons, border to `primary` for bordered controls). `primary` token drives `accent-primary` (Tailwind `accent-color`). `FormField` hands one id to one control, so it is not reused (F-E).
- Baseline: `i18n/es.json`, `i18n/en.json`, `src/i18n/catalog-parity.test.ts`, `docs/design-system.md` clean against HEAD; Phase 16 files untouched by this batch. Measured by path (new files by `rg -c ""`).

### TDD cycle evidence
| Task | Test file | RED reason observed | GREEN |
|------|-----------|---------------------|-------|
| 18.2/18.3 | `src/components/ui/checkbox.test.tsx` | import of `@/components/ui/checkbox` failed to resolve (module absent) | 6/6 |
| 18.4/18.5 | `src/components/checkbox-group.test.tsx` | import of `@/components/checkbox-group` failed to resolve (module absent) | 18/18 |
| 18.8/18.9 | `src/i18n/catalog-parity.test.ts` | 5 new tests failed: `catalog.shared.dias` absent (`expected [] to deeply equal [Array(15)]`, `MISSING_MESSAGE`) | 81/81 (76 existing + 5 new) |

### Components
- `Checkbox` (`src/components/ui/checkbox.tsx`): native `<input type="checkbox">`, `ComponentProps<"input">`, classes `accent-primary size-5 shrink-0 cursor-pointer outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:...`, merged with `className` through `cn`; no role override, no state.
- `CheckboxGroup` (`src/components/checkbox-group.tsx`, no `"use client"`, uncontrolled): props `id`, `legend`, `name`, `options: readonly {value,label}[]`, `defaultValues?: readonly string[]`, `hint?`, `error?`. Renders `<fieldset id aria-describedby="{id}-hint {id}-error">` (attribute omitted when neither), `legend` with `text-label text-foreground`, one `<label class="... min-h-11 ...">` per option containing `Checkbox` (`id={id}-{value}`, shared `name`, `value`, `defaultChecked`), hint `<p>` and error `<p role="alert">`. No `aria-invalid`/`aria-required` on the fieldset. Submission: one form entry per checked option under `name`; `FormData.getAll(name)` returns the checked values. Checked state survives a re-render that adds `error` (proved).

### Reliability and V
- Two component files x5 consecutive: 24/24 passed in every run (5 of 5), before the parity work and again after the typecheck fix.
- Full suite x3 after 18.7: 88 files, 1592/1592 each (baseline was 86 files / 1568). Full suite x3 after 18.9: 88 files, 1597/1597 each.
- `npm run typecheck`: clean (one TS2339 in my own test, `.checked` on `HTMLElement`, found and fixed before closing). `npx eslint` on the 8 touched/created files: no output. No build (no route or config changed).

### Measure by path (authored lines against HEAD)
After 18.7 (before any locale key): design-system 10, checkbox.tsx 24, checkbox.test.tsx 90, checkbox-group.tsx 73, checkbox-group.test.tsx 229 = 426. Estimate for 18B was ~110, so the 800 budget was not at risk; no stop.
Final: `docs/design-system.md` +10, `i18n/es.json` +21, `i18n/en.json` +21, `src/i18n/catalog-parity.test.ts` +80, and the four new files 24+90+73+229 = **548**.

### Locale keys added (15 per locale, `catalog.shared.dias`)
| Key | es | en |
|-----|----|----|
| long.lunes..domingo | Lunes, Martes, Miércoles, Jueves, Viernes, Sábado, Domingo | Monday ... Sunday |
| short.lunes..domingo | Lun, Mar, Mié, Jue, Vie, Sáb, Dom | Mon, Tue, Wed, Thu, Fri, Sat, Sun |
| notSet | Días sin definir | Days not set |
No days label/hint (13.11) and no `fieldErrors.dias.*` (12.1b) authored. The parity test derives the expected key set from `DIAS_SEMANA`.

### Not provable in jsdom (browser smoke 13.13)
Contrast of the native check mark tinted with `accent-primary` in light and dark themes; the visible focus ring on a native checkbox and the real 44px hit area/wrapping layout of the option row in a narrow viewport; screen-reader announcement of the group name and each state; `min-h-11` is asserted by class only.

### Deviations
None from the design. Choice noted: `notSet` Spanish text is "Días sin definir" (the spec gives no literal). `text-sm` is used for option text (an existing step, as the error text).

## Batch WU3a reads: Grupo reads, GrupoListItem, listDocenteOptions (2026-10-07)

Mode: Strict TDD. Nothing committed or staged. No database touched. Tasks 10.1-10.5 done; **stopped after 10.5 as instructed** (10.6-10.15 not started, unticked).

### Baseline (10.1)
HEAD `ff74e9e`. Tracked files touched were clean at baseline (`catalog/types.ts`, `data/users.ts`, `data/users.test.ts`; `catalog-structure.test.ts` untouched). `grupos.ts` and `grupos.test.ts` absent (new). Role join identified: `usuario.rolId = rol.id` with `rol.codigo = "docente"` (as in `listUsuarios`). `dias.ts` (`decodeDias`/`encodeDias`) and `diff.ts` read.

### Completed
- [x] 10.1 baseline and reading. [x] 10.2 RED `data/grupos.test.ts`. [x] 10.3 GREEN `data/grupos.ts` reads + `GrupoListItem` in `catalog/types.ts`. [x] 10.4 RED `data/users.test.ts` (`listDocenteOptions`). [x] 10.5 GREEN `data/users.ts` `listDocenteOptions`.

Exported reads:
- `buildGruposWhere(scope: CatalogScope, f: { status: CatalogStatusFilter; q: string }): SQL | undefined` (scope via `asignaturaInScope`; q over asignatura Codigo, Nombre, Periodo, NumeroGrupo, docente NombreCompleto; never mentions `Dias`)
- `listGrupos(p: { scope; status; q; page; pageSize }): Promise<CatalogListResult<GrupoListItem>>` (fail-soft; count and page both join Asignatura and Usuario; order: Asignatura.Codigo asc, Periodo desc, NumeroGrupo asc, Grupo.Id asc)
- `getGrupoById(scope: CatalogScope, id: number): Promise<GrupoListItem | null>` (`grupoRowInScope`; not fail-soft; usable as the A-6 pre-check)
- `listDocenteOptions(): Promise<{ id: number; nombreCompleto: string; correo: string | null }[]>` (users.ts; active + role `docente`, ordered NombreCompleto/Id, capped at `CATALOG_OPTIONS_MAX`, not fail-soft)
Types added: `GrupoListItem` (id, asignaturaId, asignaturaCodigo, asignaturaNombre, periodo, numeroGrupo, docenteId, docenteNombre, activo, origen: GrupoOrigen, dias: readonly DiaSemana[]).

### TDD Cycle Evidence
| Task | Test file | RED reason observed | GREEN |
|------|-----------|---------------------|-------|
| 10.2/10.3 | `data/grupos.test.ts` | suite failed to load: module `@/lib/data/grupos` unresolved, no tests ran | 27/27 first run |
| 10.4/10.5 | `data/users.test.ts` | 5 fail: `listDocenteOptions is not a function` | 19/19 after one test-side fix (`eq(activo, true)` emits `"Usuario"."Activo" = $2` with `true`, expectation updated; implementation unchanged) |

### V results (build excluded)
- `npx vitest run src/lib/data src/lib/catalog`: 17 files, 251/251.
- `npm test`: 89 files, 1,629/1,629 (baseline 88 / 1,597; +1 file, +32 tests: 27 grupos, 5 docente options). `npm run typecheck`: clean.
- `npx eslint` on the 5 touched files: only the pre-existing CRLF `Delete ␍` noise; new files normalised with `--fix`; `types.ts`, `users.ts`, `users.test.ts` not auto-fixed.

### Authored lines (by path against HEAD)
`grupos.ts` 140 (new), `grupos.test.ts` 391 (new), `catalog/types.ts` +19, `users.ts` +24 -1, `users.test.ts` +85 -1. **Delta 661** (under 800).
Estimates: create piece (10.6-10.7) about 130 test-heavy: `grupos.ts` +60, `grupos.test.ts` +260 = 320-420; update/toggle/pins (10.8-10.14) `grupos.ts` +110, `grupos.test.ts` +520, structure pin +25, new `scope-inventory.test.ts` about 60: 650-800 (tight; may need a seam at 10.11).

### Notes
- Design choice not in the spec: list order (Periodo desc so the newest period leads a Codigo). Single `usuario` join, no alias needed.
- The mask is decoded in `toItem`, inside the fail-soft `try`: an out-of-range stored mask degrades the list (tested) and throws from `getGrupoById`.
- `catalog-structure.test.ts` 5/5 with `grupos.ts` present (pin unchanged; 10.12 is a later piece).
- Engram persistence: no memory tool for the executor; the orchestrator should save `sdd/catalog-management/apply-progress` from this file.

## Batch WU3a create (10.6-10.7)

### Completed
- [x] 10.6 RED, [x] 10.7 GREEN: `createGrupo(tx, scope, { asignaturaId, periodo, numeroGrupo, docenteId, dias })` in `grupos.ts`.

### TDD Cycle Evidence
- RED: 28 of 55 tests failed with `TypeError: createGrupo is not a function` (module export absent); the 27 read tests still passed.
- GREEN: `grupos.test.ts` 55/55 (28 new test cases counting `it.each` rows). One test failed first for a test-harness reason (the sentinel mock did not cover `asignaturaRowInScope`); fixed by mocking it like the other predicates.

### Statements, in order (design)
1. SELECT `Asignatura` `{id, activo}` WHERE `asignaturaRowInScope(scope, asignaturaId)` (the only one with the scope predicate). Missing, foreign or inactive -> `asignatura_unavailable`.
2. SELECT `Usuario` JOIN `Rol` `{activo, rol}` WHERE `Usuario.Id = docenteId`. Missing, inactive or role other than `docente` -> `docente_unavailable`.
3. SELECT `Grupo` `{activo}` by (`parent.id`, `periodo`, `numeroGrupo`), exact equality, `parent.id` from statement 1 (no scope predicate needed, the parent is proven in scope). Match -> `grupo_taken { activo }`.
4. INSERT `Grupo` `{ asignaturaId: parent.id, periodo, numeroGrupo, docenteId, origen: "manual", dias: encodeDias(dias) }` RETURNING id -> `created`; `23505` -> `grupo_taken { activo: false }` (A-7); anything else rethrown.

### V results (build excluded)
`npx vitest run src/lib/data src/lib/catalog` 17 files, 279/279; `npm test` 89 files, 1657/1657 (baseline 1629 + 28); `npm run typecheck` clean; eslint on both files: no errors beyond the pre-existing CRLF noise.

### Authored lines (delta on the stated baseline)
`grupos.ts` 140 -> 226 (+86; 3 existing import lines modified: schema import, dias import, types import, plus new imports), `grupos.test.ts` 391 -> 647 (+256; the one `grupos` import line and the scope-sql mock were extended). `catalog/types.ts` untouched (19 / 0). **Delta about 342** (budget 800).

### Notes
- `isUniqueViolation` is a private 6-line copy of the one in `asignaturas.ts` (that file is out of scope for this piece); a later unit may extract it to a shared helper.
- The docente role and active flag are checked in code from one joined row (not in the WHERE) so each of the four other roles is tested behaviorally.
- Estimate for 10.8-10.14: `grupos.ts` +110, `grupos.test.ts` +520, structure pin +25, `scope-inventory.test.ts` about 60 = 650-800. No seam needed at 10.11 if the running delta stays under 800; the margin is thin, so re-measure after 10.9 and cut at 10.9 if it exceeds about 450.

## Batch WU3a update/toggle/pins (10.8-10.14) (2026-10-07)

Mode: Strict TDD. Nothing committed or staged. No database touched. Tasks 10.8-10.14 done; 10.15 (checkpoint) left for the owner.

### Completed
- [x] 10.8 RED / [x] 10.9 GREEN `updateGrupo(tx, scope, id, { docenteId, dias })`.
- [x] 10.10 RED / [x] 10.11 GREEN `setGrupoActivo(tx, scope, id, activo)`.
- [x] 10.12 structure pin in `catalog-structure.test.ts`. [x] 10.13 `scope-inventory.test.ts`. [x] 10.14 V.

### Signatures and result kinds
- `updateGrupo(tx, scope, id, input: { docenteId: number; dias: readonly DiaSemana[] }): Promise<GrupoWriteResult>`: `not_found` (missing, foreign, or zero rows from the UPDATE), `inactive` (Grupo inactive, A-1), `unchanged { id }` (docente and encoded mask both equal the stored values), `asignatura_unavailable` / `docente_unavailable` (only when the docente changes), `updated { id, campos }`. No new kind. Never returned here: `created`, `grupo_taken`.
- `setGrupoActivo(tx, scope, id, activo: boolean): Promise<GrupoActiveResult>`: `not_found` (missing, foreign, zero rows), `unchanged { id }` (already in the requested state), `asignatura_unavailable` / `docente_unavailable` (reactivation only), `changed { id, activo }`.

### Statements, in order (scope predicate = `grupoRowInScope` / `asignaturaRowInScope`)
`updateGrupo`: (1) SELECT `Grupo` `{asignaturaId, docenteId, activo, dias}` WHERE `grupoRowInScope` (scoped). If the docente changed: (2) SELECT `Asignatura` `{activo}` WHERE `asignaturaRowInScope(row.asignaturaId)` (scoped), (3) SELECT `Usuario` JOIN `Rol` by id (not scoped; users have no scope). Then (last) UPDATE `Grupo` SET only the changed subset of `docenteId`, `dias` WHERE `grupoRowInScope` RETURNING id (scoped). Days-only: statements 1 and the UPDATE only. Nothing changed: statement 1 only.
`setGrupoActivo`: (1) SELECT `Grupo` `{asignaturaId, docenteId, activo}` (no `dias`) scoped. Reactivation only: (2) and (3) as above, from the Grupo's own ids. Then UPDATE `Grupo` SET `{ activo }` scoped, RETURNING id. Deactivation reads no parent. No statement touches `Inscripcion`.
The shared helper `unavailableParent(tx, scope, asignaturaId, docenteId)` runs the Asignatura check first, then the docente check (`createGrupo` is untouched and keeps its own inline copy).

### TDD Cycle Evidence
| Task | Test file | RED reason observed | GREEN |
|------|-----------|---------------------|-------|
| 10.8/10.9 | `data/grupos.test.ts` (`updateGrupo`) | 25 of 80 fail: `updateGrupo is not a function` (55 older pass) | 80/80 |
| 10.10/10.11 | `data/grupos.test.ts` (`setGrupoActivo`) | 20 of 100 fail: `setGrupoActivo is not a function` (80 older pass) | 100/100 |
| 10.12 | `data/catalog-structure.test.ts` | characterization (passes now, 9/9) | mutations below |
| 10.13 | `data/scope-inventory.test.ts` | characterization (passes now, 16/16) | mutation below |

Mutation checks (each reverted; `grupos.ts` sha256 prefix `dfe08e193337ebe6` identical before and after): `.set(changes)` -> `.set({ origen: "manual" })` failed "never rewrites the Grupo origin marker"; `.set({ activo })` -> `.set({ activo, dias: 0 })` in `setGrupoActivo` failed "keeps the days out of setGrupoActivo"; `inscripcion` added to the schema import failed "never mentions Inscripcion outside comments"; `grupo.dias` added to `buildGruposWhere` failed "keeps the days out of buildGruposWhere"; an appended `export function stubExport() {}` failed the inventory "pairs every exported function with a row" test.

### V results (build excluded)
- `npx vitest run src/lib/data`: 14 files, 276/276.
- `npm test`: 90 files, 1,722/1,722 (baseline 89 / 1,657; +1 file, +65 tests). One earlier full run had one failure, `import-form.test.tsx` "moves focus to the warning heading ..." (a load flake: the file passes alone, 39/39, and the full suite passed on rerun; unrelated files).
- `npm run typecheck`: clean. `npx eslint` on the 4 touched files: no output.

### Authored lines (delta on the stated baseline)
`grupos.ts` 226 -> 351 (+125), `grupos.test.ts` 647 -> 1,053 (+406), `catalog-structure.test.ts` +35 -0 (77 -> 112), `scope-inventory.test.ts` 119 (new). **Delta 685** (budget 800). Intermediate measures: after 10.9 = 319 (83 + 236); after 10.11 = 531 (125 + 406).

### Notes and deviations
- No existing line was modified except three import additions (pure insertions in `grupos.ts` and `grupos.test.ts`). `eslint --fix` was run on the two untracked files; the baseline prefix was confirmed byte-identical afterwards.
- The Asignatura read of a docente change carries the scope predicate although the Grupo read already proved scope (one more guard, consistent with the inventory).
- The inventory pin pairs each export with a named test inside a named describe block of its test file (existence checked by text), covering `asignaturas.ts` too; `createAsignatura` is paired with the `carreraIdForWrite` test because its natural-key lookup is unscoped by design (5.12).
- Engram persistence: no memory tool for the executor; the orchestrator should save `sdd/catalog-management/apply-progress` from this file.


## Batch WU-D2 17A-i (17.1-17.11) (2026-10-07)

### Completed
17.1 (gate: DG9 and 16.34 recorded done, migration `0006` applied and verified on production 2026-10-07; no command), 17.2 (baseline below), 17.3-17.10 (RED then GREEN), 17.11 (checkpoint). 17.12 onward untouched.

### 17.2 baseline
Every file of `src/lib/import/` and `workbook-contract*` clean against HEAD; only `import-form.test.tsx` (7 / 4, not touched). Fixtures needing `dias` later (17.14, not this piece): `makeGrupoRow` plus the literals in `actions.test.ts` and `apply.test.ts` (confirmed by the task, not edited here).

### Token parser
`parseDiasCell(cell: string): { ok: true; mask: number } | { ok: false; token: string }` in `src/lib/import/dias.ts`. Day codes and bit order come from `DIAS_SEMANA`/`encodeDias`; key matching is `normalizeKey`. Samples: `"Lunes, Miércoles"` -> mask 5; `"lun,MIE"` -> 5; `"Vie,Lunes,vie"` -> 17; `"Lunes,,Martes,"` -> 3; `""`/`" , ,"` -> 0; `"Lunes, Funday"` -> `{ ok: false, token: "Funday" }`; `"Lun-Vie"`, `"Lunes;Martes"`, `"Lunes y Martes"`, `"Luness"`, `"1"`, `"Monday"` -> that trimmed segment.

### Absent versus empty
`SHEETS.Grupos.optional = ["Dias"]`; `ABSENCE_SIGNIFICANT = { Grupos: ["Dias"] }`. `parse.ts` omits the key when the header is absent (`cells` has no `Dias`); header present with a blank cell gives `Dias: ""`; non-empty keeps the raw trimmed cell. Telefono (and any other optional column) keeps `""` in both cases.

### TDD Cycle Evidence
| Task | Test file | RED reason | GREEN |
|------|-----------|------------|-------|
| 17.3/17.4 | `dias.test.ts` | module absent (import fails), then one source-pin test adjusted | 45 pass |
| 17.5/17.6 | `sheets.test.ts`, `template.test.ts`, `workbook-contract.test.tsx` | optional `[]` vs `["Dias"]`, `ABSENCE_SIGNIFICANT` undefined, template Grupos header lacks `Dias`, card count 1 vs 2 | 31 pass |
| 17.7/17.8 | `parse.test.ts` | absent header still yielded `Dias: ""` (5 keys vs 4) | 14 pass |
| 17.9/17.10 | `schemas.test.ts` | `Dias` stripped by zod (undefined) | all pass |

### Existing assertions modified
`sheets.test.ts`: `grupos.optional` `[]` -> `["Dias"]` (named by 17.5). `workbook-contract.test.tsx`: "exactly one optional column" count 1 -> 2 (header-literal consequence of 17.5). Nothing else.

### V results
`npx vitest run src/lib/import "src/app/(dashboard)/catalog/import" src/app/api`: 23 files, 497/497. `npm test`: 91 files, 1780/1780. `npm run typecheck`: clean. eslint on touched files: only the pre-existing `Delete ␍` noise (real prettier errors in my edits fixed by hand; `--fix` only on the two new files).

### Authored lines (delta against HEAD)
New: `dias.ts` 47, `dias.test.ts` 105. Tracked (added/removed): `parse.test.ts` 88/0, `workbook-contract.test.tsx` 22/2, `sheets.test.ts` 21/2, `schemas.test.ts` 17/0, `parse.ts` 13/1, `sheets.ts` 10/1, `template.test.ts` 9/0, `schemas.ts` 3/0. Total about 339 (152 new + 187 tracked churn). Estimate: 17A-ii 450-750, 17B 250-450.

### Notes
No locale key authored. Decomposed-accent test literals are literal combining characters. Engram persistence: orchestrator saves from this file.

## Batch WU-D2 17A-ii (17.12-17.20) (2026-10-07)

### Completed
17.12-17.20, all ticked. 17.21 onward untouched (17B).

### Planner rule as implemented (`plan.ts`, Stage C)
Right after `GrupoRowSchema`: `parseDiasCell(Dias ?? "")`; `!ok` -> row error `{ sheet: "Grupos", row, reason: "dias.invalid", value: <first offending token> }`, `counts.Grupo.error++`, `continue` (before the asignatura/docente reference checks, so it wins). Otherwise `mask`. Create: `...(mask > 0 ? { dias: mask } : {})`. Matched: `diasChanged = mask > 0 && mask !== existingGrupo.dias`; write when `docenteChanged || reactivated || diasChanged`; update carries `...(diasChanged ? { dias: mask } : {})`. A plan never carries `dias: 0` nor a `dias` key for an absent column or empty cell. No new count, summary field or event.

### Types
`GrupoRow.dias: number`; `GrupoWrite` create and update each gain `dias?: number`. `loadCatalogSnapshot` projects `dias: grupo.dias`.

### TDD Cycle Evidence
| Task | Test file | RED reason observed | GREEN |
|------|-----------|---------------------|-------|
| 17.12/17.13 | `catalog.test.ts` | projection SQL lacked `"Dias"` (1 failed; the mask-passthrough test passes at runtime against the double and is typed by tsc) | 11 pass |
| 17.14 | fixtures, `actions.test.ts` | characterization: typecheck failed on 2 `actions.test.ts` literals and 4 `makeGrupoRow` call sites, then clean; pre-existing tests unchanged | green |
| 17.15/17.16 | `plan.test.ts` | 2 of 8 failed: update and create writes had no `dias` (the other six assert the "no change / no key" half and pass on old code by design) | 71 pass |
| 17.17/17.18 | `plan.test.ts` | 8 of 14 failed: no `dias.invalid` error (j x7 incl. the six table cells, k); (i), (l)-(p) already green after 17.16 | 85 pass |
| 17.19 | `plan.test.ts` | pin; mutation: `diasChanged: 0` added to the returned plan -> 2 failed (the pin and the (n) JSON check); reverted | 86 pass |

17.16 was deliberately implemented with an interim `mask = ok ? mask : 0` so the `dias.invalid` RED of 17.17 stayed a real RED; the error branch landed in 17.18.

### CEI-DIAS-3 scenario to test
| Scenario | Test (describe "Grupo days, part 1/2") |
|---|---|
| Column absent keeps stored days | "column absent: a matched group keeps its days and is unchanged" |
| Column absent creates groups without days | "column absent: a new group is created with no dias key" |
| Column present replaces the days | "non-empty cell replaces the stored days with an update carrying the mask" |
| Empty cell leaves stored days untouched | "empty cell, every other value equal: unchanged, no write, no days change" |
| Empty cell with another difference keeps the days | "empty cell with a different docente: update keeping the days (no dias key)" |
| Empty cell on a new Grupo | "empty cell on a new group: created with no dias key" |
| Created Grupo takes the days of the cell | "a new group with `Lun, Vie` is created with the Monday + Friday mask" |
| Invalid token blocks everything | "`Lunes, Funday` is a dias.invalid row error ... 200-row workbook" + `it.each` six cells + "...unresolved Asignatura reports dias.invalid only" (confirm control absent is 17.27, 17B) |
| A workbook that changes only days | "a days-only difference is exactly one grupo update and nothing else" (audit record: unchanged `buildAuditEvents`, 17.19 pin) |
| Same set in another spelling is unchanged | "the same set in another spelling and order is unchanged" |
| Manual days edit overwritten only with the column | "a manual days edit is overwritten silently by a non-empty cell, ..." |
| Idempotent re-import | "re-planning the same workbook after applying its writes yields unchanged only" |
| Absent and reactivated groups | "an inactive group is reactivated with the cell's days ..." and "an active group absent from the workbook is deactivated ..." |
| No `dias: 0` (A-11) | "no write of any days scenario carries dias: 0" |

### Existing assertions modified
None. Fixture `makeGrupoRow` defaults `dias: 0` (named by 17.14) and two `GrupoRow` literals in `actions.test.ts` gained `dias: 0`. The task said four literals (`actions.test.ts` x3, `apply.test.ts` x1); `tsc` found only two in `actions.test.ts` and none in `apply.test.ts` (its `docenteId` hits are not `GrupoRow` values).

### Interim state of the apply
`apply.ts` is NOT edited. Until 17B the apply ignores `dias` on a write (the planner already emits it, so a non-empty cell is previewed as an `update` but the days are not persisted yet). Do not run an import apply with a `Dias` column before 17.22.

### V results
`npx vitest run src/lib/import src/lib/data/catalog.test.ts src/lib/audit "src/app/(dashboard)/catalog/import"`: 26 files, 568/568. `npm test`: 91 files, 1805/1805. `npm run typecheck`: clean. eslint on touched files: only the pre-existing `Delete ␍` noise (prettier errors in my lines fixed by hand; no `--fix`).

### Authored lines (delta on the 17A-i baseline; added / removed)
`plan.test.ts` 332/0, `plan.ts` 23/2, `catalog.test.ts` 25/0, `plan-fixtures.ts` 5/5, `types.ts` 6/0, `catalog.ts` 1/0, `actions.test.ts` 2/0. Total 401 (measure after 17.16: 162). 17A-i files unchanged by this piece. Estimate for 17B (17.21-17.29): 250-450.

## Batch WU-D2 17B (17.21-17.29) (2026-10-07)

### Completed
17.21-17.29, all ticked. 17.30 ([USER] preview smoke) and 17.31 (checkpoint) untouched.

### apply.ts (6 added lines, 0 removed)
`writeGrupos`: create values gain `...(w.dias ? { dias: w.dias } : {})` (plus a 3-line comment); the update `.set` gains the same spread (plus a 1-line comment). `dias: 0` is treated as absent. Lock-first order, inserts naming neither `activo` nor `origen`, and the audit payloads are unchanged (asserted for a days-only import: only `catalogo.importacion.aplicada`, no `grupo.*` event, no `dias` text or mask in the payload).

### Mixed rows (how they are written)
Group creates are chunked at `WRITE_CHUNK_ROWS` and each chunk is ONE multi-row `insert(grupo).values(part)`. Rows in a chunk may differ in key set (a row without days has no `dias` key). drizzle 0.45.2 `buildInsertQuery` iterates the table columns for every row and renders a missing/undefined key as `default`, so a row without days gets the column default for THAT row only (no explicit 0, no other row's mask). Pinned by a test that builds the real statement with `drizzle.mock().insert(grupo).values(rows).toSQL()`: rows 1 and 3 carry a parameter, row 2 ends in `default`, params contain no `0`. What only a real database can prove (stored value 0 for the default row, `CK_Grupo_Dias`, the update SET) goes to the rehearsal smoke 15.6.

### Copy (3 keys per locale, 6 entries)
- `catalog.import.reasons.dias.invalid`: es `«{value}» no es un día válido; usa de Lunes a Domingo o de Lun a Dom, separados por comas`; en `"{value}" is not a valid day; use Lunes to Domingo or Lun to Dom, separated by commas`.
- `catalog.import.contract.rules.diasTokens`: es `Dias, en la hoja Grupos, acepta los nombres de los días (Lunes ... Domingo) o sus abreviaturas de tres letras (Lun ... Dom), separados por comas. No distingue mayúsculas ni acentos.`; en `Dias, on the Grupos sheet, takes the Spanish day names (...) or their three-letter abbreviations (...), separated by commas. Case and accents are ignored.`
- `catalog.import.contract.rules.diasEffect`: es `Dias: si omites la columna, se conservan los días guardados de cada grupo. Una celda con días reemplaza los días guardados; una celda vacía los deja como están. La importación nunca quita días.`; en `Dias: if you leave the column out, the stored days of every group are kept. A cell with days replaces the stored days; an empty cell leaves them as they are. The import never removes days.`
Key sets identical in both locales (parity test).

### TDD Cycle Evidence
| Task | Test file | RED reason observed | GREEN |
|------|-----------|---------------------|-------|
| 17.21/17.22 | `apply.test.ts` | 4 of 46 failed: insert values and SET did not name `dias` (create, update, mixed rows, end-to-end through `runImportApply`); the other new tests (no key without days, forged `dias: 0`, drizzle DEFAULT rendering, days-only audit unchanged) pass by design as pins | 46 pass |
| 17.23/17.25 | `catalog-parity.test.ts` | 13 failed: `ROW_REASONS` (es, en), the three keys absent (non-empty, seven rule keys, tokens text, effect text, `{value}`, real translator) | 92 pass |
| 17.24/17.26 | `workbook-contract.test.tsx`, `import-errors.test.tsx` | 5 failed: card rendered 5 rules (not 7); `dias.invalid` rendered the raw code. After 17.25 + 17.26 two still failed (`FORMATTING_ERROR`: `value` not provided) until `import-errors.tsx` passed `value` | 30 pass |
| 17.27 | `import-preview.test.tsx` | characterization pin; mutation `hasErrors ? null :` -> `false ? null :` made 3 tests fail (the new pair and the pre-existing one); reverted | 22 pass |

### Deviations (necessary consequences, minimal)
1. `import-errors.tsx` (7/5): `reasonText` now takes the `RowError` and passes `value: error.value ?? ""` to the translator. Without it, `{value}` in `dias.invalid` throws a FORMATTING_ERROR (no existing reason used a placeholder named `value`). Not named by 17.26 but required by 17.24/17.23.
2. `import-form.test.tsx` (2/2 on its baseline): the pre-existing "lists the five validation rules" asserted `toHaveLength(5)` on `contract.rules`; renamed to "seven" and 7. The same assertion in `workbook-contract.test.tsx` was updated likewise. Both are forced by the two new rule keys.

### 17.29 frozen inputs
A temporary test (deleted) loaded the HEAD versions of `parse/plan/schemas/sheets/...` beside the current ones and compared JSON-identical: parse output and the full `ImportPlan` for `docs/PlantillaCatalogo.xlsx` (header-only: 0 rows in every sheet, plan all zeros) and `__fixtures__/valid.xlsx` (2/2/2 rows; plan against an empty snapshot: 2+2+2 creates; against a snapshot holding them with stored `dias: 5`: 2+2+2 unchanged, no write, days kept). Neither has a `Dias` key; no plan contains `"dias"`. Note: the sample workbook has no data rows, so for it the comparison is structural.

### V results
Focused (`src/lib/import src/lib/audit src/lib/data/catalog.test.ts "src/app/(dashboard)/catalog/import" src/app/api src/i18n`): 28 files, 683/683. `npm test`: 91 files, 1830/1830. `npm run typecheck`: clean. eslint on touched files: only the pre-existing `Delete ␍` noise (my prettier errors fixed by hand, no `--fix`). `npm run build` (port 3100 free beforehand): compiled; routes `/`, `/_not-found`, `/api/catalog/template`, `/catalog/asignaturas`, `/catalog/asignaturas/[id]/edit`, `/catalog/asignaturas/new`, `/catalog/import`, `/change-password`, `/denied`, `/login`, `/profile`, `/register`, `/users`, `/users/new`; Proxy (Middleware).

### Authored lines (delta on the stated baseline; added / removed)
`apply.test.ts` 219/0, `apply.ts` 6/0, `catalog-parity.test.ts` 92/0, `es.json` 6/1, `en.json` 6/1, `workbook-contract.test.tsx` 25/2, `workbook-contract.tsx` 2/0, `import-errors.test.tsx` 22/0, `import-errors.tsx` 7/5, `import-preview.test.tsx` 34/0, `import-form.test.tsx` 2/2. Total 421 added / 11 removed = 432.

### Needs the rehearsal smoke (15.6)
A real apply of a workbook with a `Dias` cell (create stores the mask; mixed rows store 0 for the default row; update replaces; empty cell and absent column keep stored days) and a read-only `SELECT "Dias"`.

## Batch WU3b-2 schema and create (2026-10-07)

Mode: Strict TDD. Nothing committed or staged. No database touched, no dev server. Tasks 12.1, 12.1a, 12.1b, 12.2, 12.3 done; **stopped at the seam (12.3)**; 12.4-12.13 untouched.

### Completed
- [x] 12.1 Read; baseline recorded (`git diff --numstat`: `es.json` 27/1, `en.json` 27/1, `catalog-parity.test.ts` 172/0, `catalog/types.ts` 19/0; `validations/catalog.ts` and `.test.ts` and `guards.test.ts` clean). F-11 proven: the check `\b(formData|fd)\.get\(` did NOT catch `getAll` (RED: 2 of 3 mutation rows failed). `guards.test.ts` now shares one `FORM_READ = /\b(formData|fd)\.get(All)?\(/`, has a scratch-source test for `get`, `getAll`, `fd.getAll`, and an expected-file test pinning both actions modules (RED until 12.3). Shared plumbing candidates for 12.8: `fieldErrors`, `unexpected`, `failure`, the pre-check, `LIST_PATH` revalidate (about 45 duplicated lines between the two action files).
- [x] 12.1a / 12.1b `diasSchema` and both Grupo schemas (see below); two field-error keys authored per locale.
- [x] 12.2 / 12.3 `createGrupoAction` in the new `grupos/actions.ts`.

### Final schemas
- `diasSchema = z.unknown().transform(...)`: `DiaSemana[]` in week order, duplicates collapsed. `[]` -> `dias.required`; a non-array (string, `undefined`, `null`, number), any non-string or File entry, a string outside `DIAS_SEMANA`, or more than seven raw entries -> `dias.invalid`; exactly one issue each.
- `grupoCreateSchema = { asignaturaId, periodo, numeroGrupo, docenteId, dias }`; `grupoUpdateSchema = { docenteId, dias }` (still strips `periodo`, `numeroGrupo`, `asignaturaId`). Inside both Grupo schemas a **missing** `dias` key (`undefined`) is `dias.required` (task text: "missing, `[]` -> `dias.required`"), while the standalone `diasSchema(undefined)` is `dias.invalid` (task text: non-array). One private `diasOf(missing)` factory serves both, so the two literal statements hold.
- Wire format: the action passes `formData.getAll("dias")` after the guard.
- `CATALOG_FIELD_ERROR_KEYS` (17): `codigo.required`, `codigo.tooLong`, `nombre.required`, `nombre.tooLong`, `horasTotales.required`, `horasTotales.invalid`, `carreraId.invalid`, `asignaturaId.required`, `asignaturaId.invalid`, `docenteId.required`, `docenteId.invalid`, `periodo.required`, `periodo.invalid`, `numGrupo.required`, `numGrupo.tooLong`, `dias.required`, `dias.invalid`.

### `createGrupoAction` outcomes
| Outcome | Form state | Message key |
|---|---|---|
| Guard rejects (docente, estudiante, anonymous, flagged) | propagates the guard's throw; no field read | none |
| Scope `none` | `{ kind: "error" }` | `catalog.shared.noCarrera.message` |
| Validation fails | `{ kind: "invalid", fieldErrors }` (first message per field) | `catalog.shared.fieldErrors.<key>`; `numeroGrupo` uses `numGrupo.*`; `dias` uses `dias.required` / `dias.invalid` |
| Pre-check: Asignatura null (missing or foreign) or inactive | `{ kind: "invalid", fieldErrors: { asignaturaId } }`, lock never taken | `shared.fieldErrors.asignaturaId.invalid` (identical for the three) |
| Pre-check read throws | `{ kind: "error" }`, one sanitised `catalog.write.failed` line | `catalog.grupos.errors.unexpected` (resolves after 12.11) |
| `created` | `revalidatePath("/catalog/grupos")`, then `redirect("/catalog/grupos")` outside any `try` | none |
| `grupo_taken` active / inactive | `{ kind: "error" }` | `shared.refusals.duplicate` / `shared.refusals.duplicateInactive` |
| `asignatura_unavailable` (race inside the transaction) | same as the pre-check | `shared.fieldErrors.asignaturaId.invalid` |
| `docente_unavailable` | `{ kind: "invalid", fieldErrors: { docenteId } }` | `shared.fieldErrors.docenteId.invalid` |
| `CatalogBusyError` | `{ kind: "busy" }`, no log | none (the form shows `shared.busy`) |
| Any other thrown error | `{ kind: "error" }` (`withCatalogWrite` logged it once) | `catalog.grupos.errors.unexpected` (resolves after 12.11) |
| Result kind a create cannot produce (`not_found`, `unchanged`, ...) | `{ kind: "error" }` | `catalog.grupos.errors.unexpected` |

The audit event is `grupo.creado` with `datos` equal to `{ origen: "manual", campos: [...the seven field names, dias among them] }`; a serialisation sweep with the day sentinels `lunes` / `miercoles` / `Miércoles` finds none.

### TDD Cycle Evidence
| Task | Test file | RED reason observed | GREEN |
|------|-----------|---------------------|-------|
| 12.1 | `guards.test.ts` | 3 failed: `getAll` / `fd.getAll` before the guard not caught by the old regex (F-11 real); `grupos/actions.ts` missing from the expected list | 14/15 (the expected-list test stays RED until 12.3), then 15/15 |
| 12.1a | `validations/catalog.test.ts`, `i18n/catalog-parity.test.ts` | schema suite failed (`diasSchema` absent, `dias` stripped from the Grupo schemas); 4 parity tests failed `MISSING_MESSAGE ... fieldErrors.dias.*` | n/a |
| 12.1b | same | n/a | 281/281 (`src/lib/validations src/i18n src/lib/import/schemas.test.ts`); Asignatura assertions and the import `schemas.test.ts` untouched |
| 12.2 | `grupos/actions.test.ts` | module `@/app/(dashboard)/catalog/grupos/actions` unresolved, no tests ran | n/a |
| 12.3 | same | n/a | 38/38; mutation: dropping `!parent.activo` from the pre-check failed the inactive-Asignatura test (1 failed, 37 passed), reverted, 38/38 |

### V results
- `npx vitest run src/lib/validations "src/app/(dashboard)/catalog" src/i18n`: 21 files, 707/707.
- `npm test`: 92 files, 1,905/1,905 (baseline 91 / 1,830; +1 file, +75 tests).
- `npm run typecheck`: clean. `npx eslint` on the touched and new files: no output (the new files were normalised with `--fix`; the two tracked schema files were fixed by hand).
- `npm run build`: compiled; routes unchanged (a `"use server"` module adds no route).

### Authored lines (delta on the stated baseline; added / removed)
After 12.1b (the measure point): `validations/catalog.ts` 37/1, `validations/catalog.test.ts` 110/7, `guards.test.ts` 30/1, `catalog-parity.test.ts` 194-172 = 22, `es.json` 31-27 = 4, `en.json` 4, `catalog/types.ts` 0 = **216**. Estimate for 12.2-12.3 was about 560, projecting about 776 (under 800), so the piece continued.
Final: `validations/catalog.ts` 42, `validations/catalog.test.ts` 117, `guards.test.ts` 31, `catalog-parity.test.ts` 22, `es.json` 4, `en.json` 4, `catalog/types.ts` 0 = 220; new `grupos/actions.ts` 134, `grupos/actions.test.ts` 418 = 552. **Total 772** (budget 800, no `size:exception`).

### Locale keys authored (4 entries, `catalog.shared.fieldErrors.dias.*`)
- `required`: es "Selecciona al menos un día de la semana en que se reúne el grupo"; en "Select at least one day of the week on which the group meets".
- `invalid`: es "El valor elegido no es un día de la semana. Selecciona los días de la lista"; en "The selected value is not a day of the week. Select the days from the list".

### Notes and deviations
- No design deviation. `catalog.grupos.errors.unexpected` is referenced by the action and has no locale entry yet; it resolves only after 12.11. Tests use a key-echo translator and do not depend on the text. The parity test that scans action sources covers only `asignaturas/actions.ts`, so nothing fails in between.
- The task text asks the Grupo action to refuse an `asignatura_unavailable`; it is surfaced as a field error on `asignaturaId` with the existing `asignaturaId.invalid` key (identical for missing, foreign and inactive) rather than a new `grupos.errors` key, so 12.10-12.11 need no key for it. Same for `docente_unavailable` (`docenteId.invalid`).
- Estimate for the next piece (12.4-12.9: update, toggle, refactor, leak sweep): actions about 140, `actions.test.ts` about 450, `audit-leak.test.ts` about 220, refactor about 60: roughly 850-950, over 800 if done in one go; the seam is 12.7 (update + toggle, about 650) with 12.8-12.9 after.
- Engram persistence: no memory tool available to the executor; the orchestrator should save `sdd/catalog-management/apply-progress` from this file.

## Batch WU3b-2 update and toggle (2026-10-07)

Mode: Strict TDD. Nothing committed or staged. No database touched, no dev server. Tasks 12.4, 12.5, 12.6, 12.7 done; **stopped after 12.7** (12.8-12.13 untouched). No locale key authored.

### Completed
- [x] 12.4 RED / [x] 12.5 GREEN `updateGrupoAction`. [x] 12.6 RED / [x] 12.7 GREEN `setGrupoActivoAction`. Both in `grupos/actions.ts`, tests in `grupos/actions.test.ts`.

### Design of the actions
- Private `addressed(actorId, scope, rawId)` (same shape as the Asignatura one, duplicated on purpose: the shared helper is 12.8): `parseRecordId`, then the lock-free scoped `getGrupoById` (A-6) outside `withCatalogWrite`; returns `{ id, item } | "gone" | "failed"`. A thrown read is logged once with `logCatalogFailure`. `revalidateGrupo(id)` revalidates the list and the literal `/catalog/grupos/<id>/edit`.
- Hidden field is `id` (not `grupoId` as the task text says): the shared `ActiveToggle` posts `id` and `intent`, and the Asignatura form posts `id`.
- Update order: guard, translator, scope `none`, id + pre-check, `grupoUpdateSchema` on `{ docenteId, dias: getAll("dias") }`, `withCatalogWrite(..., updateGrupo(tx, scope, id, parsed.data), grupoWriteEvents)`, result switch; success revalidates then `redirect` outside `try`.
- Toggle order: guard, translator, scope `none`, intent (closed `deactivate | reactivate`), id + pre-check, write, result switch. It reads no `dias`, never calls `getAll`, and calls `setGrupoActivo(tx, scope, id, activo)` with four arguments.
- `{parent}` label source: the pre-check `getGrupoById` item, which is the group's OWN Asignatura (`asignaturaCodigo - asignaturaNombre`) or docente (`docenteNombre`), read through `grupoRowInScope`. A foreign or missing Grupo answers `gone` before any result exists, so no out-of-scope record can be named. Residual: if the docente changed between the pre-check and the write, the label is the name read at the pre-check, which the actor was still entitled to see.

### Outcome table (`updateGrupoAction` / `setGrupoActivoAction`)
| Outcome | update state / key | toggle state / key |
|---|---|---|
| guard rejects | propagates, nothing read | same |
| scope `none` | `error` `shared.noCarrera.message` | same |
| bad / absent id | `gone`, no read | `gone`, no read |
| unknown intent | n/a | `gone`, no read of the record |
| pre-check null (missing = foreign) | `gone`, no lock | `gone`, no lock |
| pre-check throws | `error` `grupos.errors.unexpected`, one `catalog.write.failed` line | same |
| validation | `invalid`, `shared.fieldErrors.<docenteId.*, dias.required, dias.invalid>` | n/a |
| `updated` | revalidate list + edit, redirect to list; one `grupo.actualizado` (`campos` from the data layer: `["docenteId"]`, `["dias"]`, `["docenteId","dias"]`) | n/a |
| `changed` | n/a | revalidate list + edit, `done { activo }`; one `grupo.desactivado` / `grupo.reactivado`, `campos: ["activo"]` |
| `unchanged` | `{ kind: "unchanged" }` | `{ kind: "unchanged" }` |
| `inactive` | `{ kind: "inactive" }` | n/a |
| `not_found` (in transaction) | `gone` | `gone` |
| `docente_unavailable` | `invalid` `docenteId` -> `shared.fieldErrors.docenteId.invalid` | `error` `shared.refusals.parentInactive.docente` `{ parent: docenteNombre }` |
| `asignatura_unavailable` | `error` `grupos.errors.unexpected` (the edit form has no Asignatura field) | `error` `shared.refusals.parentInactive.asignatura` `{ parent: "<codigo> - <nombre>" }` |
| `created`, `grupo_taken` (impossible) | `error` `grupos.errors.unexpected` | not in `GrupoActiveResult` |
| `CatalogBusyError` | `{ kind: "busy" }`, no log | same |
| other throw | `error` `grupos.errors.unexpected`, one wrapper log line | same |

### TDD Cycle Evidence
| Task | Test file | RED reason observed | GREEN |
|------|-----------|---------------------|-------|
| 12.4/12.5 | `grupos/actions.test.ts` (`updateGrupoAction`) | 32 failed / 38 passed: `updateGrupoAction is not a function` (all new cases; the 38 create cases pass) | 69/69 (after dropping one test-side row: a mocked `created` result legitimately yields a `grupo.creado` event, so asserting "no audit" for it was wrong) |
| 12.6/12.7 | same (`setGrupoActivoAction`) | 24 failed / 69 passed: `setGrupoActivoAction is not a function` | 93/93 |

### V results
- `npx vitest run "src/app/(dashboard)/catalog" src/lib/catalog`: 602/602.
- `npm test`: 92 files, 1,960/1,960 (baseline 1,905; +55). `npm run typecheck`: clean. `npx eslint` on the two files: no output. `npm run build`: passes, routes unchanged.

### Authored lines (delta on the stated baseline: `actions.ts` 134, `actions.test.ts` 418)
After 12.5 (measure point, before 12.6): `actions.ts` 134 -> 233 (+102 -3), `actions.test.ts` 418 -> 688 (+272 -2) = about 379; estimate for the toggle about 60 + 250 projected about 690, under 800, so the piece continued. Final: `actions.ts` 134 -> 303 (+172 -3 = 175), `actions.test.ts` 418 -> 896 (+480 -2 = 482). **Total 657** (budget 800). Existing lines modified: in `actions.ts` the three import lines (type import, `@/lib/data/grupos`, `@/lib/validations/catalog`); in the test the `vi.mock("@/lib/data/grupos", ...)` line and the action import line, plus pure insertions (three `vi.fn()` in the hoisted object, two `expect`s in `expectNothingWritten`, one `mockResolvedValue` in `beforeEach`, the `GRUPO` / `EDIT` fixtures). `guards.test.ts` (30/1) and `catalog/types.ts` (19/0) untouched.

### Notes
- Estimates for the next piece: 12.8 (extract `fieldErrors`, `failure`, `addressed`, `revalidate*`, about 60 duplicated lines; helper about 60 plus edits to both action files about 40 net) about 100; 12.9 `audit-leak.test.ts` about 220; 12.10-12.11 about 80 (test about 60, copy about 8 per locale).
- Key referenced but not authored: `catalog.grupos.errors.unexpected` (create, update, toggle) resolves only after 12.11. No other key is missing; all refusals reuse `catalog.shared.*`.
- Engram persistence: no memory tool available to the executor; the orchestrator should save `sdd/catalog-management/apply-progress` from this file.

## Batch WU3b-2 refactor, leak sweep and copy (2026-10-07)

Mode: Strict TDD. Nothing committed or staged. No database touched, no dev server. Tasks 12.8, 12.9, 12.10, 12.11, 12.12 done; 12.13 (checkpoint) left for the owner.

### 12.8 REFACTOR
- Before: `asignaturas/actions.test.ts` + `grupos/actions.test.ts` + `guards.test.ts`: 3 files, 201/201. After: identical, 201/201. Git blob hashes of the three test files before and after are equal (`032efe20...`, `3f08513b...`, `0d682cc8...`): **no test file was edited**.
- New `src/lib/catalog/action-helpers.ts` (83 lines, `import "server-only"`, NOT a `"use server"` module, imported only by the two action files). Exports: `Translate` (type), `fieldErrors(t, zodError)`, `actionOutcomes(unexpectedKey)` returning `{ unexpected, failure }`, `addressed<T>(actorId, scope, rawId, read)` returning `{ id, item } | "gone" | "failed"`, `revalidateRecord(listPath, id)`.
- Each action file keeps `LIST_PATH`, the schemas, the result switches and the Grupo-only `asignaturaUnavailable`. The entity's message key stays a quoted literal in the action source: `const { unexpected, failure } = actionOutcomes("asignaturas.errors.unexpected")` (and `"grupos.errors.unexpected"`), so the source-scan parity test still sees it. `shared.noCarrera.message` stays inline in every action for the same reason.
- Next docs re-read (`use-server.md`): a `"use server"` file may export only async functions; helpers live in a plain module. Confirmed by `guards.test.ts` ("only async functions are exported") still passing on both files.
- Guard-first proof is unchanged and still source-based: `requireCatalogAccess()` is the first `await` of every exported action and no `formData.get`/`getAll` appears before it (`FORM_READ` regex, 3-row scratch test). The helper module reads no form and performs no authorization, so nothing moved out of the visible order; `addressed(..., formData.get("id"), reader)` is called after the guard in each action.
- Behaviour difference: none. `addressed` is now generic: the Asignatura actions get `{ id, item }` and use only `id`.

### 12.9 Characterization pin (`catalog/audit-leak.test.ts`, new, 506 lines, 23 tests)
- Drives all eight actions: `createAsignaturaAction`, `updateAsignaturaAction`, `setAsignaturaActivoAction`, `createGrupoAction`, `updateGrupoAction`, `setGrupoActivoAction`, `previewAction`, `applyAction`. Real: action modules, `withCatalogWrite`, audit mappers, planner, `applyImport`. Doubles: guards, data layer, `db`, `parseWorkbook`, `createUsuariosBulk`, hash and password generator.
- Per manual action, three cases: a success (exactly one event, `datos` keys exactly `["campos","origen"]`, `origen: "manual"`, every field name in the closed lists), a refusal/no-op (no event), a driver error carrying every sentinel (one sanitised `catalog.write.failed` line). The mocked data results carry extras (`codigo`, `nombre`, `numeroGrupo`, `docenteNombre`, `correo`, `dias: 85`, `diasCount: 4`) so a spread of a result into a payload would leak. Two extra Grupo cases: days created out of order audit only the field name; a days-only update audits exactly `{ campos: ["dias"], origen: "manual" }`. Import: preview (no audit row, no log), apply success (events `catalogo.importacion.aplicada` + `usuario.creado`, `origen` absent or `importacion`; the one-time credential is delivered in the return value only), failing apply (one log line, no audit).
- Sentinels: `ZZ-NOMBRE`, `ZZ-CODIGO`, `ZZ-NUM` (numeroGrupo), `ZZ-DOCENTE NOMBRE`, `zz.docente@zz-correo.edu`, a `$2a$12$ZZ...` bcrypt-looking string and `$2a$`, `ZZ-TEMP-PASSWORD-7Q`, day sentinels `miercoles`, `Miércoles`, `Mié`, `Lunes`, `lunes`; the mask `85` and any `"dias":` key are checked by regex/structure.
- Mutation check (file hash of `src/lib/audit/events.ts` `c4399dd8...` before and after both): (1) adding `nombre: "ZZ-NOMBRE"` to `asignaturaCreatedEvent` -> 1 failed (createAsignatura success); (2) adding `dias: 85` to `grupoUpdatedEvent` -> 2 failed (updateGrupo success, days-only update). Both reverted, hash identical, 23/23.

### 12.10 RED / 12.11 GREEN
- RED (`catalog-parity.test.ts`): `catalog.grupos.errors` added to `GUARDED_SECTIONS`; new describe "Grupo action copy" scans `grupos/actions.ts` for `shared.*|grupos.*` keys; `catalog.grupos.errors` holds exactly `["unexpected"]` with no raw-error wording; the message says it was not saved and to try again. Run: 8 failed / 102 passed (`catalog.grupos.errors exists in both catalogs`, `holds only non-empty strings`, `carries every message key the Grupo action source uses` x2, `hold only the generic message` x2, `generic Grupo error says the change was not saved` x2).
- GREEN: 110/110 after the copy. Refusal contents (which parent, duplicate of inactive, no Carrera, busy) are already asserted in the shared 6.14 tests; the Grupo scan pins that the Grupo actions choose only existing keys.
- Keys authored (2 entries): `catalog.grupos.errors.unexpected`: es "No se pudo guardar el cambio. Inténtalo de nuevo en unos minutos." / en "The change could not be saved. Try again in a few minutes." (same text as the Asignatura one).

### 12.12 V
- `npx vitest run "src/app/(dashboard)/catalog" src/i18n src/lib/audit`: 22 files, 709/709.
- `npm test`: 93 files, 1,993/1,993, run twice (baseline 92 / 1,960; +1 file, +33 tests). `npm run typecheck`: clean (one TS2352 in the new test fixed). `npx eslint` on the 5 touched code/test files: no output. `npm run build`: passes, route list unchanged. `guards.test.ts` covers both `asignaturas/actions.ts` and `grupos/actions.ts`.

### Authored lines (delta on the stated baseline)
`action-helpers.ts` 83 (new); `audit-leak.test.ts` 506 (new); `asignaturas/actions.ts` +24 -66 = 90; `grupos/actions.ts` 303 -> 262 (about +27 -68 = about 95 gross; exact gross not measurable, untracked); `catalog-parity.test.ts` 194 -> 270 = +76; `es.json` 31 -> 36 = +5; `en.json` +5. **Total about 860** against the 800 budget (estimate was about 400).
- Overshoot: `audit-leak.test.ts` is 506 vs about 220 estimated (prettier expands the 6-action x 3-case matrix, the transaction double for the real `applyImport` path, and the import cases). Everything was already complete and green when the total was measured; no scenario was compressed or dropped. Flagged for the owner.

### Open copy point (owner decision, not implemented)
`updateGrupoAction` maps `asignatura_unavailable` (the group's own Asignatura is inactive while the group is active) to the generic `catalog.grupos.errors.unexpected`. A dedicated message would be more actionable ("the Asignatura of this group is inactive; reactivate it first"), but it is new behaviour and was not requested. Left as is.

### Notes
- Engram persistence: no memory tool available to the executor; the orchestrator should save `sdd/catalog-management/apply-progress` from this file.

## Batch WU3b-3 form (2026-10-07) - PARTIAL, RED only

Mode: Strict TDD. Nothing committed or staged. No database, dev server or build touched. Tasks 13.1 and 13.2 done and ticked (13.2 marked "RED only"); **13.3 NOT started** because the budget rule stops here (see "Budget"). 13.4-13.14 untouched. No locale key authored yet; `grupo-form.tsx` does not exist.

### 13.1 Baseline and reusable parts
- Baseline (`git diff --numstat` / `rg -c ""`): `i18n/es.json` 36/1, `i18n/en.json` 36/1, `src/i18n/catalog-parity.test.ts` 270/0; `grupos/` holds only `actions.ts` and `actions.test.ts` (untracked, not part of this piece). New files count in full.
- Reused as-is: `FormField` (text inputs and the two comboboxes, props `id`/`aria-describedby`/`aria-invalid` spread), `Combobox` (`name`, `items {value,label}`, `emptyText`, `truncated`, `truncatedText`, `defaultValue`, `disabled`), `CheckboxGroup` (`id`, `legend`, `name="dias"`, `options`, `defaultValues`, `hint`, `error`; **it has no `disabled` prop**), `Input`, `Button`, `catalog.shared.{dias.long.*, fieldErrors.*, refusals.inactive|unchanged, busy, notFound.*, importWins}`. The `AsignaturaForm` pattern is copied: `useActionState` + hand-dispatched `onSubmit` in `startTransition`, `role="status" aria-live="polite"` region mounted from the start, `FixedField` for text values, `reactivate` slot.
- Field names the form must submit (from `grupos/actions.ts`): `asignaturaId`, `periodo`, `numeroGrupo`, `docenteId`, `dias` (`getAll`), hidden `id` in edit.

### 13.2 RED (`grupos/grupo-form.test.tsx`, new, 588 lines after `eslint --fix`; 19 `it`/`it.each` blocks expanding to 30 tests; `eslint` clean, `tsc` reports only the missing module)
- Run: `npx vitest run "src/app/(dashboard)/catalog/grupos/grupo-form.test.tsx"` -> 1 suite failed, no tests ran: `Failed to resolve import "@/app/(dashboard)/catalog/grupos/grupo-form"`. That is the stated reason (module absent).
- Scenarios (all written; none trimmed): create (en/es render with the seven long day names in `DIAS_SEMANA` order, none checked, `fieldset` + legend, no `FormField` label for `dias`; options given; cap note only for the truncated list and linked through `aria-describedby`; submit sends ids and `getAll("dias")`), edit (en/es: key as text, no key control, hidden `id`, docente prefilled, days `lunes`/`jueves` checked, natural-key hint, import line; submit sends id + docente + days and none of the three key fields; legacy empty set opens with nothing checked and no alert; refusal shown inside the group, linked through `aria-describedby`, description reads hint then message), values kept after `invalid` (three separate tests: text, both combobox selections including the resubmitted ids, checked days), per-field `role="alert"` + `aria-invalid` + `aria-describedby`, stray key error as text, the `unchanged | error | busy | gone | inactive` answers in en and es (text, submit presence, locked docente combobox and days), busy retry, pending state, inactive record (locked, reactivate slot), keyboard (Tab order across seven days, Space check and clear).
- The test fixes the contract the component must meet. Props: `action: GrupoFormAction`, `asignaturas: {id, codigo, nombre}[]`, `docentes: {id, nombreCompleto}[]`, `asignaturasTruncated?`, `docentesTruncated?`, `record?: {id, asignaturaCodigo, asignaturaNombre, periodo, numeroGrupo, docenteId, activo, dias}`, `reactivate?`.

### Budget (why this stops at RED)
- Measured after writing the test: **588 lines** (test only). Component estimate 280-330 (about 300). Copy: 14 keys under `catalog.grupos.form` x 2 locales (about 17 lines each including the wrapper) about 34. Projected total about 588 + 300 + 34 = **about 920**, over the 800 budget with no `size:exception`. No scenario was dropped; per the rule the component (13.3) becomes its own review piece.
- Copy plan for 13.3 (not authored yet; test already holds the exact text), keys under `catalog.grupos.form` identical in both locales; es / en: `asignaturaLabel` Asignatura / Subject; `docenteLabel` Docente / Teacher; `searchPlaceholder` Escribe para buscar / Type to search; `noMatches` Ninguna opción coincide / No options match; `truncated` the two long sentences in the test's `TEXT`; `periodoLabel` Periodo / Period; `periodoHint`; `numeroGrupoLabel` Número de grupo / Group number; `naturalKeyHint`; `diasLabel` Días de la semana / Days of the week; `diasHint` Selecciona al menos un día. / Select at least one day.; `submitCreate` Crear grupo / Create group; `submitSave` Guardar cambios / Save changes; `submitting` Guardando… / Saving…. Reused from `catalog.shared`: `dias.long.*`, `fieldErrors.*`, `refusals.*`, `busy`, `importWins`, `notFound.title`.
- Parity: the existing "carries exactly the list keys" filter will need `form.*` ignored for `grupos` as it was for `asignaturas` (one line), to be reported when 13.3 lands.

### Decisions the component will need (flagged for review)
- `CheckboxGroup` has no `disabled` prop and may not be modified. Plan: wrap it in `<fieldset disabled={locked} className="contents">`, which natively disables the seven checkboxes (the test asserts `toBeDisabled()`, which jest-dom resolves through the ancestor fieldset).
- A docente who is no longer in the options (inactive or beyond the cap) leaves the prefilled combobox empty; a save then answers `docenteId.required`. Acceptable, and the page may decide otherwise in 13.7.

### Authored lines (delta on the stated baseline)
`grupos/grupo-form.test.tsx` 588 (new). Nothing else changed in code or copy. `tasks.md` and `apply-progress.md` excluded.

### Estimates for the next pieces
- 13.3 alone (component about 300 + copy about 34 + parity filter 1) about 335.
- 13.4-13.5 (list page test about 450, page about 170, `list.*` copy about 40): about 660.
- 13.6-13.12 (new/edit page tests about 650, pages about 220, `bound-controls.tsx` about 50, sidebar test and code about 40, parity about 120, copy about 60): about 1,140 -> needs two pieces (pages 13.6-13.7 about 920, sidebar + parity + copy 13.8-13.12 about 220).
- Engram persistence: no memory tool available to the executor; the orchestrator should save `sdd/catalog-management/apply-progress` from this file.

## Batch WU3b-3 form component (2026-10-07) - DONE (13.3)

Mode: Strict TDD. Nothing committed or staged. No database or dev server. 13.3 ticked; 13.2 note updated to done; 13.4-13.14 untouched.

### Decisions applied (orchestrator)
1. `CheckboxGroup` gets an optional `disabled?: boolean` (default false) that sets the native `disabled` on its own `fieldset`. RED first: `checkbox-group.test.tsx` +2 tests (default enabled; disabled group disables every checkbox, submits no entry, keeps legend and hint/error `aria-describedby`); run: 1 failed (`toBeDisabled` on the fieldset), then GREEN. Diff: `+disabled = false` destructured, `+disabled?: boolean` with a one-line doc comment, `+disabled={disabled}` on the `<fieldset>`. One sentence added to the "Checkbox group" entry of `docs/design-system.md`.
2. Missing current docente: `record` carries `docenteNombre`; in edit mode, when `record.docenteId` is not in `docentes`, one extra item (id + stored name) is appended last, so the combobox is prefilled and the original id is submitted. RED first: 3 tests added to `grupo-form.test.tsx` (prefilled and offered as an extra option; days-only edit submits `docenteId` 99; no extra option when already listed). The module did not exist yet, so the RED was confirmed in two steps: module-absent, then (after the component) with the append disabled the two positive tests failed (2 failed, 31 passed) and passed once restored. `RECORD` fixture gained `docenteNombre: "Luis Mora"`; no existing scenario changed.

### Component `grupos/grupo-form.tsx` (265 lines, new)
- Props: `action: GrupoFormAction`, `asignaturas: readonly {id, codigo, nombre}[]`, `docentes: readonly {id, nombreCompleto}[]`, `asignaturasTruncated?`, `docentesTruncated?`, `record?: GrupoFormRecord {id, asignaturaCodigo, asignaturaNombre, periodo, numeroGrupo, docenteId, docenteNombre, activo, dias: readonly DiaSemana[]}`, `reactivate?: ReactNode`. Exports `GrupoFormAction`, `GrupoFormRecord`.
- Copy of the `AsignaturaForm` pattern: `useActionState` + hand-dispatched `onSubmit` in `startTransition`, `role="status" aria-live="polite"` region mounted from the start, local `FixedField` (the Asignatura one is not exported and may not change).
- States: `unchanged` plain text; `error` message in the error panel; `busy` shared copy in the error panel, submit stays; `gone` shared not-found title + message, submit removed; `inactive` (loaded inactive or answered) locks the form: docente combobox and days group disabled, no submit, shared inactive refusal text, `reactivate` slot shown; `invalid` per-field `role="alert"` through `FormField`/`CheckboxGroup`; errors for undrawn fields (key fields in edit) listed as text in the status region; pending shows `submitting` and disables the button.
- Values after `invalid`: text inputs, both comboboxes and the days are all uncontrolled and the form is never reset (hand dispatch), so everything stays; the combobox hidden inputs keep the ids.
- Edit: key shown as text with one hint, no control and no field named `asignaturaId`/`periodo`/`numeroGrupo`; hidden `id`; docente prefilled; days prefilled; import-wins line.

### Copy: 14 keys under `catalog.grupos.form`, identical sets in es and en
`asignaturaLabel` Asignatura / Subject; `docenteLabel` Docente / Teacher; `searchPlaceholder` Escribe para buscar / Type to search; `noMatches` Ninguna opción coincide / No options match; `truncated` (long sentences as in the test `TEXT`); `periodoLabel` Periodo / Period; `periodoHint`; `numeroGrupoLabel` Número de grupo / Group number; `naturalKeyHint`; `diasLabel` Días de la semana / Days of the week; `diasHint` Selecciona al menos un día. / Select at least one day.; `submitCreate` Crear grupo / Create group; `submitSave` Guardar cambios / Save changes; `submitting` Guardando… / Saving…. Parity test untouched: the "carries exactly the list keys" assertion covers only `catalog.asignaturas`, so no filter change was needed.

### Verification
Focused (`grupo-form.test.tsx` + `checkbox-group.test.tsx`): 53/53, run 5 times in a row, all green. `npx vitest run "src/app/(dashboard)/catalog" src/components src/i18n`: 31 files, 843/843. `npm test` twice: 94 files, 2,028/2,028 both times. `npm run typecheck`: clean. `eslint` on the 4 touched code/test files: one prettier error in the new component, fixed with `--fix` (own file); clean after. `npm run build`: passes.

### Authored lines (delta on the stated baseline)
`grupo-form.tsx` 265; `grupo-form.test.tsx` +43; `checkbox-group.tsx` +4; `checkbox-group.test.tsx` +33; `es.json` +16; `en.json` +16; `design-system.md` +2. **Total about 379** against the 800 budget.

### For the browser smoke (13.13)
Real Base UI combobox popup in create and edit; edit of a group whose docente is no longer listed; locked inactive form (days and docente disabled, reactivate control); Tab order across docente then the seven days; focus ring on the days.

## Batch WU3b-3 list page (tasks 13.4-13.5) (2026-10-07) - PARTIAL: 13.4 RED only

### Outcome
13.4 done as RED only; 13.5 (`grupos/page.tsx` and the `catalog.grupos.list` copy) NOT started, held back by the review budget rule (800 changed lines, no `size:exception`).

### Budget measure (taken after writing and prettier-formatting the test, before the page)
- `grupos/page.test.tsx` (new, `rg -c ""`): **625 lines** (after `eslint --fix` on this own file; the Asignaturas test is 471 because Grupos adds the days column block, the order and docente-search checks, and the clamp and no-days-control checks).
- Realistic remaining: `grupos/page.tsx` about 250-270; `catalog.grupos.list` copy about 44 lines per locale (about 88 total). `guards.test.ts` needs no change (pages are discovered by directory). Projected total about 625 + 260 + 88 = **about 975**, over 800, so the piece stops after RED.
- Baselines untouched: `i18n/es.json` and `i18n/en.json` 52/1, `catalog-parity.test.ts` 270/0, `guards.test.ts` 30/1.

### TDD evidence
RED run: `npx vitest run "src/app/(dashboard)/catalog/grupos/page.test.tsx"`: file fails to load, `Failed to resolve import "@/app/(dashboard)/catalog/grupos/page"` (the module is absent), "no tests". This is the stated RED reason.

### What the test pins (for whoever writes 13.5)
- Mocks `@/lib/data/grupos` (`listGrupos`), the real dal and `requireCatalogAccess` on a mocked session and actor, real `es`/`en` catalogs with a throwing `onError`; translator namespace `catalog.grupos.list`.
- Copy the test reads: `catalog.grupos.list.{title, empty, newButton, edit, tableCaption, degraded}`, `noResults.{hint, titleStatus, title}`, `search.clear`, `pagination.{region, previous, next}`, `columns.{code, subject, periodo, numeroGrupo, docente, dias, status, actions}`; and `catalog.shared.{status, filter, noCarrera, dias.notSet}`. The page also needs `subtitle`, `search.{label, placeholder, submit}`, `count` (plural, test expects "1 group"), `pagination.status` ("Page {page} of {pages}").
- Columns in order: Code, Subject, Period, Group, Teacher, Days, Status, Actions. Edit link accessible name: `<edit> <codigo> <periodo> <numeroGrupo>`; href `/catalog/grupos/{id}/edit`.
- Days cell: `<span aria-hidden="true">Mon, Thu</span><span class="sr-only">Monday, Thursday</span>`; empty set: one plain `<span class="text-muted-foreground">` with `catalog.shared.dias.notSet`, no role, `aria-live`, `aria-hidden` or error styling, no `sr-only`. Items rendered in received order. `listGrupos` called with exactly `{scope, status, q, page, pageSize}`.
- Copy plan (not yet written), `catalog.grupos.list`: title Grupos/Groups; subtitle; newButton Nuevo grupo/New group; columns; edit Editar/Edit; empty; noResults.{title,titleStatus,hint}; degraded; search.{label,placeholder,submit,clear}; count; tableCaption; pagination.{region,previous,next,status}.

### Files
Created: `src/app/(dashboard)/catalog/grupos/page.test.tsx`. Modified: `tasks.md` (13.4 ticked as RED only), this file.

### Next
A fresh review piece for 13.5: write `grupos/page.tsx` (mirror `asignaturas/page.tsx`, add the Days column) and the list copy; then run the test 3 times, `guards.test.ts`, V. Estimated delta for that piece: about 350 lines (page 260 + copy 88), under budget on its own.

## Batch WU3b-3 list page GREEN (task 13.5) (2026-10-07) - DONE

Mode: Strict TDD. Nothing committed or staged. No database, dev server or build. 13.5 ticked; 13.4 note updated from "RED only" to done. 13.6-13.14 untouched.

### TDD evidence
- RED re-confirmed: `page.test.tsx` fails to load, module `grupos/page` absent, no tests.
- GREEN: `page.test.tsx` 41/41. Reliability: 3 consecutive runs, 41/41 each time.

### Page `grupos/page.tsx` (275 lines, new)
- Mirrors `asignaturas/page.tsx`: `requireCatalogAccess()` first, scope only from it, `none` shows the shared no-Carrera state with no query and no create button, `parseCatalogListParams`, `listGrupos({scope, status, q, page, pageSize})` (exact object, no days parameter), fail-soft `degraded` notice, `StatusFilter`, `DataTableSearch` (hidden `status`), polite count, `DataTable`, `DataTablePagination`.
- Columns: Code, Subject, Period, Group, Teacher, Days, Status, Actions. Local `DiasCell`: `<span aria-hidden="true">` short names + `<span class="sr-only">` long names, joined by ", " in received (week) order; empty set is one plain `<span class="text-muted-foreground">` with `catalog.shared.dias.notSet`. Edit link `aria-label` = `<edit> <codigo> <periodo> <numeroGrupo>`, href `/catalog/grupos/{id}/edit`. No sidebar entry.
- The open point about `toHaveAccessibleName` on a table cell did not materialise: the cell name is computed from content (aria-hidden span excluded, sr-only included) and the assertion passes as written. No test change.

### Copy: 27 keys under `catalog.grupos.list`, identical sets in es and en (es / en)
`title` Grupos / Groups; `subtitle` Consulta y gestiona los grupos del catálogo. / Browse and manage the groups in the catalog.; `newButton` Nuevo grupo / New group; `columns.code` Código / Code; `columns.subject` Asignatura / Subject; `columns.periodo` Periodo / Period; `columns.numeroGrupo` Grupo / Group; `columns.docente` Docente / Teacher; `columns.dias` Días / Days; `columns.status` Estado / Status; `columns.actions` Acciones / Actions; `edit` Editar / Edit; `empty` Aún no hay grupos activos. / There are no active groups yet.; `noResults.title` Sin resultados para «{q}» / No results for “{q}”; `noResults.titleStatus` No hay grupos con este filtro. / There are no groups with this filter.; `noResults.hint` Prueba con otra asignatura, periodo, grupo o docente, o cambia el filtro de estado. / Try another subject, period, group or teacher, or change the status filter.; `degraded` No se pudieron cargar los grupos. Vuelve a intentarlo en unos minutos. / Could not load the groups. Try again in a few minutes.; `search.label` Buscar grupos / Search groups; `search.placeholder` Asignatura, periodo, grupo o docente / Subject, period, group or teacher; `search.submit` Buscar / Search; `search.clear` Limpiar búsqueda / Clear search; `count` plural (Sin grupos / # grupo / # grupos; No groups / # group / # groups); `tableCaption` Lista de grupos / Groups list; `pagination.region` Paginación de grupos / Groups pagination; `pagination.previous` Anterior / Previous; `pagination.next` Siguiente / Next; `pagination.status` Página {page} de {pages} / Page {page} of {pages}. Everything else reuses `catalog.shared.*`. `catalog-parity.test.ts` and `guards.test.ts` unchanged (the exact-key-set assertion covers only `catalog.asignaturas`; `guards.test.ts` discovers pages by directory and passes).

### Verification
`npx vitest run "src/app/(dashboard)/catalog" src/i18n`: 21 files, 740/740. `npm test`: 95 files, 2,072/2,072. `npm run typecheck`: clean. `npx eslint` on `grupos/page.tsx`: no output. No build.

### Authored lines (delta on the stated baseline)
`grupos/page.tsx` 275 (new); `es.json` 52 -> 89 = +37; `en.json` +37. **Total 349** against the 800 budget (estimate about 350). `page.test.tsx` unchanged (625).

### Estimate for 13.6-13.7 (new/edit pages) [superseded by "Batch WU3b-3 page tests" below]
Tests about 450-550 (new and edit page tests: five-role table, scope, foreign id and unknown id to not-found, docente/asignatura options and truncation, record mapping to `GrupoFormRecord`), pages about 200-250, `bound-controls.tsx` about 50, page copy about 40: about 750-900. Proposed seam: piece A = 13.6 RED for both pages (about 500, the Asignaturas page tests as the template); piece B = 13.7 pages + `bound-controls.tsx` + `page.*`/`breadcrumb.*` copy (about 330). Sidebar (13.8-13.9) and parity/copy (13.10-13.12) stay in their own pieces.

### Notes
- Engram persistence: no memory tool available to the executor; the orchestrator should save `sdd/catalog-management/apply-progress` from this file.

## Batch WU3b-3 page tests (2026-10-07) - PARTIAL: 13.6 RED for the `new` page only

Mode: Strict TDD. Nothing committed or staged. No database, dev server or build. **13.6 is NOT ticked**: only `grupos/new/page.test.tsx` is written. The review-budget rule applies: the `new` test alone measures **522 lines** (after `eslint --fix`), leaving 278 of the 800 budget, and the `edit` test (Asignaturas edit test: 525, plus days, docente, record mapping and prop pins) cannot fit. `grupos/[id]/edit/page.test.tsx` becomes its own piece. 13.7-13.14 untouched; no page, no `bound-controls.tsx`, no locale key.

### RED evidence
`npx vitest run "src/app/(dashboard)/catalog/grupos/new/page.test.tsx"`: 1 suite failed, no tests ran: `Failed to resolve import "@/app/(dashboard)/catalog/grupos/new/page" ... Does the file exist?` (module absent, the stated reason). `npm test`: 96 files, 1 failed (this file) / 95 passed, 2072/2072 tests passed. `npm run typecheck`: only `TS2307 Cannot find module '@/app/(dashboard)/catalog/grupos/new/page'`. `eslint --fix` on the file: no output.

### Module boundaries (mocks) of `new/page.test.tsx`
`server-only`; `next/navigation` (`redirect` throws `REDIRECT:<path>`); `@/lib/auth/cookies` (`getSession`); `@/lib/data/users` (`getCatalogActor`, `listDocenteOptions`); `@/lib/data/asignaturas` (`listAsignaturaOptions`); `@/app/(dashboard)/catalog/grupos/actions` (the three actions); `next-intl/server` `getTranslations` (real catalogs, throwing `onError`; typed namespace `catalog.grupos`, any namespace works). The real `requireCatalogAccess`, `bound-controls` and form render. **`grupos/grupo-form` is wrapped, not replaced**: the mock factory spreads `importOriginal()` and renders the real `GrupoForm` after recording its props in `formPropsSpy`, so tests read exactly what the page passed. The same wrapper technique is proposed for `@/app/(dashboard)/catalog/active-toggle` in the edit test. No test imports `@/db` or `@/env`.

### Scenarios pinned (new page)
- Access: administrador, coordinacion, secretaria render the h1 and the create button; docente and estudiante are sent to `/denied` with no actor read, no option query, no form render; anonymous to `/login`; flagged secretaria/docente to the password change screen first.
- Options: administrador and secretaria call `listAsignaturaOptions({ kind: "all" })` once and `listDocenteOptions()` once with NO argument; the form gets `action === createGrupoAction`, no `record`, `asignaturas` equal to the option list, and the two comboboxes are on screen. The docentes reach the form as exactly `{ id, nombreCompleto }` (the data layer's `correo` is stripped before the client boundary). Coordinacion with Carrera 3 calls `listAsignaturaOptions({ kind: "carrera", carreraId: 3 })` and only the in-scope option is listed in the popup. Coordinacion without a Carrera: `catalog.shared.noCarrera` title and message, the h1, no form render, no option query of either kind, no textbox, combobox, checkbox or button. A rejected option read propagates.
- Cap note (`CATALOG_OPTIONS_MAX` = 2000): 1,999 items -> both flags false/absent and no note; exactly 2,000 Asignaturas -> `asignaturasTruncated === true`, `docentesTruncated` false, one note, linked by `aria-describedby` to the Asignatura combobox only; exactly 2,000 docentes -> the mirror case.
- Structure: breadcrumb (`aria-label`, link to `/catalog/grupos` named `catalog.grupos.list.title`, one `.is-current` + one `aria-current="page"` on the page, nowhere else), one h1 with the subtitle and no skipped level, Spanish render, source scan (page uses `grupos/bound-controls`, imports no `*/actions`).
- Wiring: choose Asignatura and docente, type periodo and numero, check Wednesday then Monday -> `createGrupoAction` receives `asignaturaId` "2", `docenteId` "7", `periodo`, `numeroGrupo`, `getAll("dias")` `["lunes","miercoles"]`.

### Props the `new` page must pass to `GrupoForm` (via `CreateGrupoForm`)
`action` = `createGrupoAction` (bound in `bound-controls.tsx`), `asignaturas` = `listAsignaturaOptions(scope)` result as is, `docentes` = `listDocenteOptions()` mapped to `{ id, nombreCompleto }`, `asignaturasTruncated` / `docentesTruncated` = `length >= CATALOG_OPTIONS_MAX`, no `record`, no `reactivate`.

### Copy the page piece must author (strings fixed in `TEXT` at the top of the test; everything else reuses existing keys: `catalog.grupos.form.*`, `catalog.grupos.list.title`, `catalog.shared.*`)
| Key | es | en |
|---|---|---|
| `catalog.grupos.page.newTitle` | Nuevo grupo | New group |
| `catalog.grupos.page.newSubtitle` | Completa los datos para agregar un grupo al catálogo. | Fill in the details to add a group to the catalog. |
| `catalog.grupos.breadcrumb.label` | Ruta de navegación | Breadcrumb |
| `catalog.grupos.breadcrumb.new` | Nuevo grupo | New group |

The edit piece will add `page.editTitle`, `page.editSubtitle`, `page.reactivateHint`, `breadcrumb.edit` and `state.title` (proposed strings are in the report of this batch and are fixed again in that test).

### Authored lines
`grupos/new/page.test.tsx` 522 (new). Nothing else changed in code or copy. `tasks.md` and `apply-progress.md` excluded.

### Next
1. Piece: `grupos/[id]/edit/page.test.tsx` (RED, own review piece, about 650-700 lines), then tick 13.6 as RED only.
2. Piece: 13.7 pages + `bound-controls.tsx` + page copy.

## Batch WU3b-3 edit test and pages (2026-10-07) - PARTIAL: piece A written and RED, over budget; piece B NOT started

Mode: Strict TDD. Nothing committed or staged. No database, dev server or build.

### Piece A: `grupos/[id]/edit/page.test.tsx` (new)
- **845 lines** after `eslint --fix` on this own file (34 `it`/`it.each` blocks). The 800 budget is exceeded by 45; per the batch rule no scenario was trimmed and the work stopped here. 13.6 is NOT ticked (the orchestrator decides how to account for the overrun).
- RED: `npx vitest run "src/app/(dashboard)/catalog/grupos/[id]/edit/page.test.tsx"`: suite fails, no tests ran: `Failed to resolve import "@/app/(dashboard)/catalog/grupos/[id]/edit/page" ... Does the file exist?`. `npx tsc --noEmit`: only the two missing-module TS2307 errors (`new/page` and `[id]/edit/page`). `eslint`: clean.
- Mocks: as `new/page.test.tsx` plus `notFound`, `@/lib/data/grupos` (`getGrupoById`), and `active-toggle` wrapped (not replaced) with a props spy, like `grupo-form`.
- Copy fixed in the `TEXT` constants (en / es): `page.editTitle` Edit group / Editar grupo; `page.editSubtitle` Update the group's teacher and meeting days. / Actualiza el docente y los días de clase del grupo.; `page.reactivateHint` To edit it, reactivate it first in the Status section. / Para editarlo, primero reactívalo en la sección Estado.; `breadcrumb.label` Breadcrumb / Ruta de navegación; `breadcrumb.edit` "Edit {codigo} {periodo} {numeroGrupo}" / "Editar {codigo} {periodo} {numeroGrupo}"; `state.title` Status / Estado.
- Scenarios: access (3 roles render, docente/estudiante denied without awaiting params and with no read of any kind, anonymous, flagged x2); not found (7 bad ids, missing = foreign, read called with guard scope and parsed id, record read failure and docente read failure propagate, source scan for `params: Promise<{ id: string }>` and no `try {`); scope (coordinacion scope passed, no-Carrera state with no read/no 404/no controls); options (docente query once, Asignaturas never, `asignaturas` = [], e-mail stripped, missing current docente kept under stored name, cap under/at); active record (exact `record` mapping, natural key as text, docente and days prefilled, import note, legacy group with no day checked, State section with pill and deactivate, toggle props, confirmation names the record with no notice, confirm posts id+intent, save posts id, docenteId, days and no key field); inactive (locked docente and days, reactivate hint, plain hint in the slot, single-press reactivate, no nested form); structure (breadcrumb, one h1 and one h2, Spanish render, Spanish hint, source scan).

## Batch WU3b-3 pages GREEN

Task 13.7 done. Both RED page tests pass: 66 tests across the two files, three consecutive runs 66/66. Written: `grupos/bound-controls.tsx` (34 lines, `CreateGrupoForm`, `EditGrupoForm`, `GrupoActiveToggle`), `grupos/new/page.tsx` (86), `grupos/[id]/edit/page.tsx` (147), and locale keys `catalog.grupos.page.{newTitle,newSubtitle,editTitle,editSubtitle,reactivateHint}`, `breadcrumb.{label,new,edit}`, `state.title` in es and en (+15 lines each; i18n numstat 104/1 each).

Test bug fixed (one line): edit test "offers the reactivate control ... single press" asserted `queryByRole("group")` is null, but the days `CheckboxGroup` fieldset is itself role group. Now `queryByRole("group", { name: /MAT101/ })` (the confirmation names the record), same intent, not weakened.

Verification: `npx vitest run "src/app/(dashboard)/catalog" src/i18n` 23 files / 810 tests passed; `npm test` 97 files / 2142 passed; `npm run typecheck` clean; eslint clean on the touched files. Authored delta about 299 lines (pages and controls 267, copy 30, test 2). Needs browser smoke in 13.13: create, edit, inactive lock, reactivate, no-Carrera state, the legacy group with no days.
