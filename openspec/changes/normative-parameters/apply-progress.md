# Apply progress: normative-parameters

## Unit 0: decisions and delivery (2026-11-27)

- Owner decisions, traced to the thesis: D1 causes are activated, deactivated and reordered (no creation, no label editing); D2 the secretaria edits (thesis 4.3, CU-13); D3 RN-07 and RN-08 are separate keys, default 2; D4 the alert is a key, default 1, below the remission deadline; D5 read-time rules use the value in force, filing-time rules apply at the action, no per-request snapshot; D6 file size 1 to 25 MiB with the `CK_Documento_Tamano` ceiling migration; D7 retention is out of RNF-14; D8 scope is the minimum to declare RNF-14 met (five families plus the RN-13 map, one screen). Store exactly as thesis Anexo D Table D19.
- Spec assumption accepted by the orchestrator: a deactivated cause refuses drafts only; corrections of returned requests accept the five codes (as RN-23 is off for corrections).
- Session: execution auto; artifact store openspec; delivery auto-chain with feature-branch-chain; 13-slice plan; review budget 1000 changed lines per PR.
- Standing owner approval: slice PRs of at most 1000 changed lines merge into the tracker `feat/normative-parameters` with all gates green. Merging the tracker to `main`, every Neon command that writes schema or data (including the disposable branch), every deletion and any PR over 1000 lines always need an explicit yes.

## Slice 1: registry and table (PR 1 of 13, branch `feat/normative-parameters-1-registry`; 2026-11-27)

Mode: Strict TDD. Tasks 0.1 to 0.3 and 1.0 to 1.6 done; 1.7 (slice close) is OPEN on the stop line, 1.8 (PR) not assigned.

### Baseline and framework rule (task 0.3)

- Baseline on the tracker tip, `T(src/lib src/app src/i18n src/test src/db)`: 370 test files, 10413 tests, all green (about 232 s).
- Guides read (read-only): `caching-without-cache-components.md`, `revalidatePath.md`, `redirect.md`, `07-mutating-data.md` under `node_modules/next/dist/docs/01-app/`.
- Rule applied for the whole change: React `cache()` only for per-render deduplication; no `unstable_cache` (superseded in 16, and its cache survives across requests and instances), no `use cache` (`cacheComponents` is off), no module-level store, no timer. `revalidatePath` and `redirect` are server-function calls, used in slices 9 and 10. Slice 1 has no Next code (pure module, schema, migration), so nothing else applied.

### Files

| File | Action | Authored lines |
|---|---|---|
| `src/lib/parameters/registry.ts` | Created: keys, types, defaults, schemas, `PARAMETER_REGISTRY`, `resolveParameters` | 213 |
| `src/lib/parameters/defaults.ts` | Created: the 30 dated calendar entries moved from `intake/calendar.ts` (not edited) | 52 |
| `src/lib/parameters/registry.test.ts` | Created: 85 tests | 487 |
| `src/db/schema.ts` | Modified: `parametroNormativo` and its two types | 26 |
| `drizzle/0017_normative_parameters.sql` | Generated plus hand-appended seed INSERT (nine rows) | 24 |
| `drizzle/meta/_journal.json`, `drizzle/meta/0017_snapshot.json` | Generated (excluded from the count) | - |
| `src/db/migration-normative-parameters.test.ts` | Created: 19 tests (migration text and schema definition) | 206 |
| `src/db/migration-escalation-otro.test.ts` | Modified: the "is the last journal entry" assertion became "later entries stay later" | 3 added, 1 removed |

Commits: unit 1 "feat(parameters): add the normative parameter registry and defaults" (registry, defaults, test); unit 2 "feat(db): add the ParametroNormativo table and seed the defaults" (schema, SQL, journal, snapshot, migration test, the escalation-otro test fix, and these progress documents).

### TDD cycle evidence

| Task | RED (written first, failed for the right reason) | GREEN | REFACTOR |
|---|---|---|---|
| 1.1 / 1.2 | `registry.test.ts`: whole file failed, import of `./registry` unresolved (module missing) | `T(parameters/registry)`: 85 passed | prettier reformat, eslint clean, typegen plus typecheck clean; MC-1a, 1b, 1c; commit unit 1 |
| 1.4 / 1.5 | `migration-normative-parameters.test.ts`: 18 of 18 failed (no `_normative_parameters.sql` located, journal entry absent) | `T(migration-normative-parameters)`: 18 passed; after adding the schema-definition test 19 passed | `db:generate` re-run: "No schema changes"; MC-2a, MC-2b; commit unit 2 |

The schema-definition test ("defines the same columns and the same unique constraint in the schema") passed at write time, as it pins the schema just added; its revert-only mutation check is MC-2a.

### Mutation checks (each reverted, `git status` clean of it before every commit)

| Check | Mutation | Failing test |
|---|---|---|
| MC-1a | `tamano_maximo_mib` maximum 25 to 26 | "scalar ranges (NP-2) > tamano_maximo_mib accepts 1 and 25 and refuses the values just outside" |
| MC-1b | `otro` schema as a normal cause set | "type-to-cause map (NP-12) > refuses otro mapped to a cause" |
| MC-1c | an invalid key takes the next key's default | 9 tests: "returns every default and every key as fallback when there are no rows", "takes the default of a missing key ...", and the seven "an invalid <key> takes its own default and changes no other key" cases |
| MC-2a | tenth column `CreadoEn` in the schema, `db:generate -- --name tenth_column` (wrote `0018_tenth_column.sql`, snapshot, journal entry), then reverted with `git restore` plus removal of the two generated files | "defines the same columns and the same unique constraint in the schema" and, because MC-2a ran before deviation 2 below, "is registered once in the journal, right after 0016 ..." (it then still asserted that its entry was the last one; with the final test only the schema-definition test fails) |
| MC-2b | the `alerta_dias` seed row removed from the SQL | "seed > holds exactly the nine keys, each once" and "seed > seeds alerta_dias with the registry default" |

### Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `DATABASE_URL=postgres://u:p@localhost:5432/x npm test -- parameters/ migration-normative-parameters`: 2 files, 104 tests passed |
| Runtime harness | N/A for WU1 (pure module, proven by unit tables). WU2: PG-1 seeds read back is task 14.5; the migration is NOT applied anywhere |
| Rollback boundary | Unit 1: revert the three files under `src/lib/parameters/`, nothing imports them yet. Unit 2: revert schema block, `drizzle/0017_*`, the journal entry and snapshot, and the migration test; the table is additive and ignored by old code (unit 2 as a whole is separable from unit 1 only in that its test imports the registry) |

### Gates (slice close, without `npm run build`, which the orchestrator runs)

- `DATABASE_URL=postgres://u:p@localhost:5432/x npm test` (full, foreground): 402 files, 11047 tests, all passed. A first full run found one failure, `migration-escalation-otro.test.ts` asserting that its entry is the last of the journal; fixed as a deviation below, then the run above was green.
- `npx next typegen` then `npm run typecheck`: clean.
- `npx eslint src --rule '{"prettier/prettier":["error",{"endOfLine":"auto"}]}'`: 0 errors, 1 pre-existing warning (`SidebarGroupLabel` unused in `src/components/app-sidebar.tsx`, not touched).
- `npx prettier --check <touched files> --end-of-line auto`: clean.
- `npm run db:generate` after unit 2: "No schema changes, nothing to migrate". No `drizzle/0017_*` exists on `origin/main` (fetched 2026-11-27; the tree ends at `0016_escalation_otro.sql`). No database command of any kind was run.

### Size (task 1.7): OVER THE STOP LINE

Measured with the task's command (`git diff --numstat feat/normative-parameters HEAD -- . ':(exclude)openspec' ':(exclude)docs' ':(exclude)drizzle/meta'`), including the staged final commit: **1011 added plus 1 deleted = 1012 changed lines** (planned about 760; the registry test alone is 487, as tasks.md 1.1 lists every table). Unit 1 alone is 752, unit 2 alone is 260 (24 SQL, 206 migration test, 26 schema, 4 in the escalation-otro fix). The generated snapshot (2524 lines) and the journal entry are excluded.

Stop line: 1012 is 12 lines over 1000. Per the stop line and the skill, nothing was trimmed (no test, comment or blank line removed). The cut point defined in tasks.md is unit 2 into its own PR: the two units are separate commits, so the cut is exact (unit 1 alone is 752; unit 2 stacks on it). The other option is accepting a `size:exception` of 12 lines. The owner decides; 1.7 stays open until then.

### Deviations from design and tasks

1. `migration-escalation-otro.test.ts` (not in the slice's edit list) changed by 3 added and 1 removed line. Its assertion that its journal entry is the last one cannot hold once any later migration exists, and 0017 is the first. It now asserts that every later entry has a larger `when`.
2. Task 1.4 says the new migration test asserts its entry is "last". That would break the same way when 0018 lands in slice 6 (task 6.4 would then have to edit this file). The test asserts instead that later entries stay later; `when` above 1795216905153 and the position right after `0016_escalation_otro` are unchanged. Task 6.4's "last" for 0018 stays valid until a later migration exists.
3. The migration test also covers the schema definition (`getTableConfig(parametroNormativo)`: four columns with their SQL types, one unique constraint, no check, no foreign key), because the NP-1 scenario "Column set is exactly Table D19" names both the schema and the migration. This is what MC-2a needs to fail on the column test.
4. NP-12 "every type and every one of the five causes MUST be present" is implemented as in the design table: every document type is a key, each set holds only the five codes without repeats, `otro` is exactly empty. A cause that no type maps is accepted (the validation table of the spec has no such case; the default covers all five); RN-13 simply stays raised for it, as it does for `otro`.
5. `resolveParameters` takes the first row of a key if rows repeat (the loader's DISTINCT ON never gives two); a missing key joins `fallback` like an invalid one (NP-4 table: no row gives the default).
6. Calendar descriptions are ASCII ("Anio Nuevo", as in `calendar.ts`), because they travel inside the seed SQL.
7. Calendar validation messages (`date_invalid`, `date_duplicate`, `description_too_long`, `description_empty`), `code_repeated`, `position_repeated`, `no_active_cause` and `cause_repeated` are internal Zod messages for the action of slices 9 to 13 to map to copy; they are not user-facing strings.

### Next

Remaining for this slice: 1.7 (slice close: `npm run build` by the orchestrator, then the owner's decision on the 12 lines) and 1.8 (open and merge the PR to the tracker). Slice 2 starts from this branch once slice 1 is merged.

### Slice 1 close (orchestrator, 2026-11-27)

- `npm run build` with a dummy `DATABASE_URL` and a throwaway `AUTH_SECRET`: green.
- Owner decision on the stop line: one PR with a `size:exception` of 12 lines (1012 changed lines). The two units stay separate commits for review.

## Slice 2: loader (PR 2 of 13, branch `feat/normative-parameters-2-loader`; 2026-11-27)

Mode: Strict TDD. Tasks 2.0 to 2.4 done (unit 3 committed). Tasks 2.5 and 2.6 (unit 4, the Postgres read suite) are NOT started and 2.7 (slice close) is OPEN: unit 3 alone already measures over the stop line, so the work stopped at the cut point defined in tasks.md ("Unit 4 moves out"). No database command of any kind was run.

### Framework rule (task 0.3 rule applied)

- Read again this slice: `node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md` (`unstable_cache` is the opt-in data cache that survives across requests, which NP-5 forbids). The loader uses React `cache()` only: no `unstable_cache`, no `use cache`, no module-level store, no timer, no `revalidate*`.
- React fact verified in `node_modules/react/cjs`: the default (client) build makes `cache()` a pass-through (`return fn.apply(null, arguments)`); only the `react-server` build deduplicates, through the request scope the renderer installs on `ReactSharedInternals.A`. `react-dom/server` renders with the default build, so it cannot prove "one read per render".

### Files

| File | Action | Authored lines |
|---|---|---|
| `src/lib/parameters/loader.ts` | Created ("server-only"): `Executor`, `ParametersRead`, `readInForce`, `loadNormativeParameters`, `getNormativeParameters = cache(...)` | 123 |
| `src/lib/parameters/derive.ts` | Created (pure): `calendarOf`, `deadlineRulesOf`, `timingParamsOf`, `signalParamsOf`, `activeCausesOf`, `filingRulesOf`, `maxDocumentBytesOf`, `intakeLimitsOf` and the types `DeadlineRules`, `TimingParams`, `FilingRules`, `IntakeLimits` | 89 |
| `src/lib/parameters/loader.test.ts` | Created: 25 tests | 664 |
| `src/lib/parameters/derive.test.ts` | Created: 12 tests | 194 |
| `src/lib/parameters/no-constants.test.ts` | Created: 17 tests (the scan, its own detector table, the sources) | 114 |

Commit: unit 3 "feat(parameters): add the fail-soft loader and the derive adapters" (the five files above only). No existing file was edited, no rule code was touched, and nothing imports the loader yet.

### TDD cycle evidence

| Task | RED (written first, failed for the right reason) | GREEN | REFACTOR |
|---|---|---|---|
| 2.1 | `loader.test.ts`: whole file failed, import of `./loader` unresolved (module missing) | `T(parameters/loader)`: 25 passed (after one expectation of the pinned SQL text was corrected to drizzle's emitted `asc`) | prettier, eslint, typegen plus typecheck clean |
| 2.2 | `derive.test.ts`: whole file failed, `./derive` unresolved; `no-constants.test.ts`: the loader and derive entries not found (the detector table passed at write time, as it tests the detector itself) | `T(parameters/derive parameters/no-constants)`: 12 and 17 passed | one typecheck fix in the test (a typed map literal) |
| 2.3 | n/a (GREEN of 2.1 and 2.2) | `T(parameters/)`: 4 files, 139 tests passed (85 registry plus 54 new) | n/a |
| 2.4 | n/a | n/a | MC-3a, MC-3b, MC-3c, each reverted; commit unit 3 |

### Mutation checks (new files staged first; each reverted with `git restore`, `git diff` clean before the commit)

| Check | Mutation | Failing tests |
|---|---|---|
| MC-3a | `readInForce` selects every row not after today (no DISTINCT ON) and the loader keeps only the valid ones, so it scans back to an older valid row | "an invalid newest row with an older valid one gives the default, not the older row; the other keys keep their own rows", the two `readInForce` tests (statement text, rows in force) and the "statement cannot even be built" test (4 failures) |
| MC-3b | `getNormativeParameters` wrapped around a module-level `let memo` | 6 failures: "reads again in the next render, so a saved value is seen by the next request", "reads twice for two renders", "reads on every call outside a render scope", "keeps nothing inside the cached function itself", and in `no-constants.test.ts` "loader.ts uses no data cache, no module-level store and no timer" and "every parameters source is clean" |
| MC-3c | the fallback `code` also carries `JSON.stringify` of the stored value | 6 failures: five rows of the per-key table (the `code` equality) and "the log never carries a stored value: names the key and a code only, whatever the invalid row holds" |

### Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `DATABASE_URL=postgres://u:p@localhost:5432/x npm test -- parameters/`: 4 files, 139 tests passed (loader 25, derive 12, no-constants 17, registry 85) |
| Runtime harness | PG-3 read part runs in unit 4 (task 2.5), which is not started; the loader itself is proven on the in-memory table double and the pinned SQL text |
| Rollback boundary | Revert unit 3: five new files under `src/lib/parameters/`; nothing imports them |

### Gates (without `npm run build`)

- `DATABASE_URL=postgres://u:p@localhost:5432/x npm test` (full, foreground): 405 files, 11101 tests, all passed (slice 1 left 402 files and 11047 tests; plus 3 files and 54 tests).
- `npx next typegen` then `npm run typecheck`: clean.
- `npx eslint src --rule '{"prettier/prettier":["error",{"endOfLine":"auto"}]}'`: 0 errors, the same 1 pre-existing warning (`SidebarGroupLabel` in `src/components/app-sidebar.tsx`).
- `npx prettier --check <touched files> --end-of-line auto`: clean.

### Size (task 2.7 not closed): OVER THE STOP LINE WITH UNIT 3 ALONE

`git diff --numstat feat/normative-parameters HEAD -- . ':(exclude)openspec' ':(exclude)docs' ':(exclude)drizzle/meta'`: **1184 added plus 0 deleted = 1184 changed lines** (planned about 650 for units 3 and 4 together). Per file: loader.test.ts 664, derive.test.ts 194, no-constants.test.ts 114, loader.ts 123, derive.ts 89. Nothing was trimmed. The cut point of tasks.md (unit 4 moves out) cannot bring the slice under 1000 because unit 3 alone is over; unit 4 would add roughly 250 to 350 more lines. Options for the owner: (a) accept a `size:exception` for this PR with unit 3 only (1184) and open unit 4 as its own PR; (b) split unit 3 at a file boundary (derive.ts, derive.test.ts and no-constants.test.ts are 397 lines; the loader and its test are 787), which keeps every PR under 1000 but redoes the 2.1 to 2.3 history as two commits; (c) another cut the owner prefers. Tasks 2.5 to 2.7 stay open until then.

### Deviations from design and tasks

1. `constantCalendar` lives in `src/lib/intake/adapters/constant-calendar.ts`, not in `business-days.ts` as task 2.3 says; `derive.ts` imports it from there (`business-days.ts` was not touched).
2. The "one read per render" cases do not use `react-dom/server`: it renders with the default React build, whose `cache()` is a pass-through, so it can never show deduplication. The test loads the real `react-server` build of React and installs a request scope by hand (the `getCacheForType` shape the renderer provides), so the deduplication logic under test is React's own. Two reads for two renders, a read per call outside a render, and "nothing kept inside the cached function" are asserted too.
3. Fallback log lines: `parameter_invalid { clave, code }` where `code` is the first Zod issue code (`too_big`, `invalid_type`, `custom`, ...) or `no_row` when no row is in force; a missing row is logged too, because NP-4 says every fallback is logged. `parameters_read_failed { code }` is the error name, or `typeof` for a thrown non-Error. Both are `console.error(JSON.stringify(...))` lines with an `event` field (the shape of `logCatalogFailure`).
4. The adapter types `DeadlineRules`, `TimingParams`, `FilingRules` and `IntakeLimits` are defined and exported by `derive.ts` (the design names them but no file owned them). Slice 3 may re-export `TimingParams` from `signals/timing.ts`.
5. `Executor` is an alias of the existing `CatalogExecutor` (`src/lib/data/catalog.ts`), type-only import, so `db` and a transaction both fit.
6. `no-constants.test.ts` is a source-text scan (comments stripped, with a detector table proving it flags each violation) rather than an AST parse, as no test in the repository parses TypeScript.

### Next

Owner decision on the size (options above), then unit 4 (tasks 2.5 and 2.6: the Postgres read suite and its support file, skipped without the INTEGRATION env), then 2.7 (slice close with `npm run build` by the orchestrator) and 2.8 (PR).

### Slice 2 split (orchestrator, 2026-11-27)

- Owner decision: slice 2 ships as two PRs. PR 2a holds unit 3 (loader and derive adapters, 1184 changed lines: 212 code, 972 tests) under a `size:exception`; PR 2b holds unit 4 (the Postgres read suite, tasks 2.5 and 2.6) on its own.
- `npm run build` on PR 2a: green.

## Slice 2b: Postgres read suite (PR 2b, branch `feat/normative-parameters-2b-pg-suite`; 2026-11-27)

Mode: Strict TDD, tests-only unit. Tasks 2.5, 2.6 and 2.7 done; 2.8 (open and merge PR 2b into the tracker) is not assigned to apply. The branch is cut from the tracker, which already holds slice 1 (PR 170) and slice 2a (PR 171). **No database command of any kind was run**: no migrate, push, seed or SQL, and no INTEGRATION env was set to any database. The suite is proven on a disposable Neon branch in task 14.5, with the owner's yes.

### Framework rule

No Next code in this unit (test files only), so no Next guide applied beyond the rule recorded in task 0.3 (React `cache()` only in the loader under test).

### Files

| File | Action | Authored lines |
|---|---|---|
| `src/lib/data/integration/normative-parameters-support.ts` | Created: `SEED_DATE`, `seedValue`, `putRow`, `dropKey`, `restoreSeeds`, `databaseError`, `refusal` and the two SQLSTATE constants | 109 |
| `src/lib/data/integration/normative-parameters.integration.test.ts` | Created: 23 cases in two groups, gated by the decision of `guard.ts` (`INTEGRATION_GATE_MODE`, as every other suite) | 457 |

Commit: unit 4 "test(parameters): add the Postgres read suite" (the two files only). No existing file was edited.

### Cases (23, all skipped without the INTEGRATION env)

- PG-1 (NP-1, NP-16), 5 cases: the nine seed rows as the migration stored them (date `2026-01-01`, value equal to the code default); the loader reads every key from its stored row with `fallback` empty, `degraded` false and no log line; a second row for the same key and day is refused (`23505`, constraint `UQ_ParametroNormativo_Clave_Vigencia`) while another day is accepted; the same refusal for a seeded key on the seed day; a key of 61 characters is refused (`22001`) and one of 60 is accepted.
- PG-3 read part (NP-3, NP-4), 18 cases: rows at -10, -1 and +1 days give the -1 value; a row dated today is in force; today is the Managua date (a row dated the UTC date of 03:00 UTC is not yet in force, it is at 07:00 UTC); `readInForce` returns one row per key, newest first, over real `DISTINCT ON`; the six rows of the NP-4 per-key table (valid, no row, 99 MiB, `"3"`, newest invalid over an older valid 7, only tomorrow), each run with valid non-default rows for the other five scalar keys, which must keep their own values, and `fallback` must be exactly the key under test; six structured-key rows (calendar sorted and a repeated date refused; causes reordered by position and all-inactive refused; a flipped map cell read and `otro` mapped refused); an unknown key `otra_cosa` ignored with no log; the fallback log carries the key and a code (`invalid_type`, `no_row`) and never a sentinel stored value.

### Design of the fixtures

- Every case reads with one fixed instant (`2026-11-28T03:00:00Z`, 2026-11-27 21:00 in Managua), so no case depends on the clock or on midnight, and the Managua date rule is exercised by all of them.
- `restoreSeeds` runs after every case and at the end: it deletes the rows dated after the seed date and the rows of keys outside the registry, and re-inserts a deleted seed row with `ON CONFLICT DO NOTHING`. It never overwrites a seed row that is still there, and it is not run before the first case, so the first run on a fresh branch proves what migration 0017 really stored, and no case can mask a bad seed. Audit rows are not touched (none are written by this unit).
- SQL order is never asserted on keys (the collation of the branch decides it): key lists are compared sorted.

### TDD cycle evidence

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 2.5 | Postgres cases cannot fail or pass in the default run: they are skipped without the env, so, as the Conventions of tasks.md say, their RED/GREEN proof is the run of task 14.5 plus its PG-only mutation checks | the suite compiles against the real loader, registry and schema (typecheck clean) | none |
| 2.6 | n/a | `npm run test:integration -- normative-parameters` without the env: 1 file skipped, 23 tests skipped | prettier, eslint clean; an unused helper (`dropRow`) removed |

PG-only mutation checks to run in task 14.5 (not run here: they need a database): MC-PG-1 drop the unique constraint on the branch inside a transaction that is rolled back (the duplicate case must fail); MC-PG-2 edit `readInForce` to drop `DISTINCT ON` (the one-row-per-key case must fail); MC-PG-3 make the loader scan back to an older valid row (the "newest invalid" case must fail).

### Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `npm run test:integration -- normative-parameters` without the INTEGRATION env: 1 file skipped, 23 tests skipped |
| Runtime harness | Task 14.5 (disposable Neon branch with 0017 applied, the owner's yes for that command) |
| Rollback boundary | Test-only revert of the two files; nothing imports them |

### Gates (without `npm run build`)

- `DATABASE_URL=postgres://u:p@localhost:5432/x npm test` (full, foreground): 405 files, 11101 tests, all passed; identical to slice 2a, so the integration file is not loaded by `npm test`.
- `npx next typegen` then `npm run typecheck`: clean.
- `npx eslint <the two files> --rule '{"prettier/prettier":["error",{"endOfLine":"auto"}]}'`: 0 errors, 0 warnings.
- `npx prettier --check <the two files> --end-of-line auto`: clean.
- `npm run test:integration -- normative-parameters` without the INTEGRATION env: 1 file skipped, 23 tests skipped.

### Size (task 2.7)

`git diff --numstat feat/normative-parameters HEAD -- . ':(exclude)openspec' ':(exclude)docs' ':(exclude)drizzle/meta'`: **566 added plus 0 deleted = 566 changed lines** (109 support, 457 suite; planned 250 to 350 for the unit, about 650 for the whole slice before the split). Under the 1000 stop line; no `size:exception` needed for PR 2b.

### Deviations from design and tasks

1. The suite adds a few cases the task text does not list, all inside PG-1 and PG-3 read: a row dated today, the Managua-versus-UTC date, the real `readInForce` statement, the six structured-key outcomes and the log content on a real read. They are the NP-4 and NP-10 to NP-12 scenarios marked [PG] that need only the loader.
2. `restoreSeeds` restores a deleted seed row but does not overwrite a present one (tasks.md 2.5 says "restore the seeds"); that keeps the first run a proof of the migration's own seed values. No case edits a seed row, so nothing needs overwriting.
3. The support file exports `databaseError` and `refusal` (SQLSTATE and constraint of a refused statement, as the other suites do locally); slices 6 and 8 reuse them for PG-6 and PG-4.

### Next

2.8: open PR 2b to the tracker and merge it under the standing approval (it is under 1000 lines and the gates are green). Then the owner's yes to run the suite on a disposable Neon branch (task 14.5), and slice 3 (task 3.0) from the tracker.

## Slice 3: on-read signals (PR 3 of 13, branch `feat/normative-parameters-3-on-read-signals`; 2026-11-27)

Mode: Strict TDD. Tasks 3.0 to 3.7 done (units 5 and 6 committed); 3.8 (open and merge the PR into the tracker) is not assigned to apply. The branch is cut from the tracker, which already holds slices 1 and 2 (PRs 170, 171, 172). **No database command of any kind was run**: this slice lists no Postgres case (its PG rows are tasks 9.5 and 12.3), and no INTEGRATION env was set.

### Framework rule

No Next API is used in this slice: the changes are in pure rule modules and in one server data module. `loadSignals` reaches the parameters only through `getNormativeParameters` (React `cache()`, the rule recorded in task 0.3: no `unstable_cache`, no `use cache`, no module-level store, no timer). The two pages and the coordination page keep their `loadSignals` calls unchanged.

### Files

| File | Action | Authored lines (added / deleted) |
|---|---|---|
| `src/lib/signals/timing.ts` | Modified: required `timing: TimingParams`; the deadline is `addBusinessDays(absenceTo, timing.lateFilingBusinessDays, calendar)` | 16 / 7 |
| `src/lib/signals/evaluate.ts` | Modified: required `timing` argument passed to RN-07 | 6 / 2 |
| `src/lib/signals/params.ts` | Modified: comment only (the values come from the loader; registry defaults point here; shape and values stable) | 5 / 2 |
| `src/lib/data/signals.ts` | Modified: `resolveInputs`; `loadSignals(input)` builds params, calendar and timing from the loader when the caller passes none; `timing?` added to `LoadSignalsInput`; no constant calendar and no code params left | 50 / 10 |
| `src/lib/signals/timing.test.ts` | Modified: third argument everywhere, new RN-07 days table (6 rows), third-business-day case, own-key case, holiday case, longer deadline reaching an uncovered year | 106 / 0 |
| `src/lib/signals/evaluate.test.ts` | Modified: `evaluateWith` takes timing; 3 new tests (days reach RN-07, only RN-07 changes, shape pin) | 64 / 2 |
| `src/lib/signals/rf-05-e.test.ts` | Modified: the one call site passes the timing | 3 / 1 |
| `src/lib/data/signals.test.ts` | Modified: loader double (`vi.mock` of `@/lib/parameters/loader`), 11 new cases | 221 / 1 |
| `src/lib/parameters/no-constants.test.ts` | Modified: constant-path scan of `src/lib/signals` and of the reader, with its own detector table (15 new tests) | 157 / 0 |

Commits: unit 5 "feat(signals): take the late-filing days as an explicit input" (timing, evaluate, the `rf-05-e` test call site, the interim call site in `data/signals.ts`, their tests); unit 6 "feat(signals): read the recurrence threshold, the map and the late-filing days from the loader" (signals.ts, params.ts, signals.test.ts, no-constants.test.ts). `SignalParams`, `DEFAULT_SIGNAL_PARAMS` and every `issuer.ts` export are untouched in shape and value (pinned by a test).

### TDD cycle evidence

| Task | RED (written first, failed for the right reason) | GREEN | REFACTOR |
|---|---|---|---|
| 3.1 | `timing.test.ts` and `evaluate.test.ts`: 9 failed (3-day and 1-day rows, third business day, own key, longer deadline reaching 2028, evaluate passes the days, only RN-07 changes); the 2-day rows and the shape pin passed at write time | n/a | n/a |
| 3.2 | n/a | `T(signals/ data/signals)`: 15 files, 371 passed with the other signals tests unedited (only the `rf-05-e` call site gained the argument) | n/a |
| 3.3 | n/a | n/a | prettier, eslint, typegen plus typecheck clean; MC-4a and the shape-pin mutation; commit unit 5 |
| 3.4 | `signals.test.ts` and `no-constants.test.ts`: 10 failed (RN-14 threshold, RN-13 flipped cell, RN-07 days, calendar holiday, calendar year, one read, injected wins, loader rejects, and the two reader scans) | n/a | n/a |
| 3.5 | n/a | `T(signals/ data/signals parameters/)`: 19 files, 536 passed | n/a |
| 3.6 | n/a | n/a | prettier, eslint, typegen plus typecheck clean; MC-5a to MC-5f; commit unit 6 |

Passing at write time (pins of existing behaviour, each with a revert-only mutation check below): the 2-day timing rows, the shape pin of `SignalParams`, `DEFAULT_SIGNAL_PARAMS` and the `issuer.ts` exports, "falls back to the default behaviour when the loader read failed", "keeps RN-07 apart from the remission days", "rest signals and marks ignore the active flag", and the scan of the signals rule modules.

### Mutation checks (files staged first; each reverted with `git restore`, `git diff` clean before every commit)

| Check | Mutation | Failing tests |
|---|---|---|
| MC-4a | `evaluateLatePresentation` counts 2 days whatever `timing` says | 9: the 3-day and 1-day rows of `timing.test.ts`, "files on the third business day", "has its own key", "is not evaluable when a longer deadline reaches a year the calendar lacks", and the two `evaluate.test.ts` days cases |
| MC-4b (shape pin) | `lateFilingBusinessDays: 2` added to `DEFAULT_SIGNAL_PARAMS` | "keeps the shape of SignalParams, DEFAULT_SIGNAL_PARAMS and the issuer exports" |
| MC-5a | `loadSignals` passes `DEFAULT_SIGNAL_PARAMS` instead of `signalParamsOf(values)` | "evaluates RN-14 with the threshold in force: 3 by default, 2 once saved", "evaluates RN-13 with the stored map: a flipped cell makes it absent", and the reader scan "holds no constant path" |
| MC-5b | the loader is read twice | "reads the loader once per read" and "lets an injected value win, and reads the loader only for what is missing" |
| MC-5c | rest signals cut to `not_applicable` (`false && admitsRest(...)` in `evaluate.ts`) | "evaluates the rest signals and the marks whatever the active flag of a cause" plus three existing assembly tests |
| MC-5d | `timing.ts` imports `DEFAULT_PARAMETERS` from the registry | "the signals rule modules take no constant path ... imports no registry default, no constant calendar and no RN-08 number" |
| MC-5e | `timingParamsOf` reads `remissionBusinessDays` | "evaluates RN-07 with the late-filing days in force", "keeps RN-07 apart from the remission days of RN-08", "lets an injected value win ...", and `derive.test.ts` "follows the values it is given and nothing else" |
| MC-5f | a `degraded` loader read throws in `resolveInputs` | "falls back to the default behaviour when the loader read failed, and does not throw" |

### Work Unit Evidence

| Evidence | Unit 5 | Unit 6 |
|---|---|---|
| Focused test command and exact result | `DATABASE_URL=postgres://u:p@localhost:5432/x npm test -- signals/timing signals/evaluate`: 2 files, 72 tests passed after GREEN | `DATABASE_URL=postgres://u:p@localhost:5432/x npm test -- signals/ data/signals parameters/`: 19 files, 536 tests passed |
| Runtime harness | N/A: pure functions, proven by the day tables; no runtime boundary | The loader is a scripted double here; the real read against Postgres is the PG-2 signals rows (tasks 9.5 and 12.3) and task 14.5, not run in this slice |
| Rollback boundary | Revert unit 5: timing, evaluate and their tests, the `rf-05-e` call site and the interim default in `data/signals.ts`; RN-07 returns to the constant 2 | Revert unit 6: `data/signals.ts`, `params.ts` (comment), the scans and the loader double; signals return to constants |

### Gates (without `npm run build`)

- `DATABASE_URL=postgres://u:p@localhost:5432/x npm test` (full, foreground): 405 files, 11140 tests, all passed (slice 2b left 405 files and 11101 tests; plus 39 tests, no new file).
- `npx next typegen` then `npm run typecheck`: clean.
- `npx eslint <the nine changed files>` with the `prettier/prettier` rule at `endOfLine: auto`: 0 errors, 0 warnings.
- `npx prettier --check <the nine changed files> --end-of-line auto`: clean.

### Size (task 3.7)

`git diff --numstat feat/normative-parameters HEAD` excluding `openspec`, `docs` and `drizzle/meta`: **628 added plus 25 deleted = 653 changed lines** (planned about 550). Unit 5 alone is 212 (200 added, 12 deleted), unit 6 alone is 447 (431 added, 16 deleted); the lines of `data/signals.ts` written in unit 5 and rewritten in unit 6 do not count twice in the total. Under the 1000 stop line; no `size:exception` needed.

### Deviations from design and tasks

1. Task 3.1 says "`LATE_WINDOW_DAYS` no longer exists". That constant (`src/lib/intake/limits.ts`) is the RN-23 filing window, removed in slice 5 (task 5.2), and RN-07 never read it. The RN-07 number was the private `BUSINESS_DAYS_TO_REMIT` reached through `deadlineOf`, which stays until slice 4. The pin was replaced by two checks that prove the intent: the days table (a 3-day and a 1-day deadline) and a structural scan that no `src/lib/signals` module uses `deadlineOf` or `BUSINESS_DAYS_TO_REMIT` and that `timing.ts` counts `timing.lateFilingBusinessDays`.
2. `evaluateLatePresentation` uses the existing `addBusinessDays(start, days, calendar)` instead of `deadlineOf`, because `deadlineOf` still carries the RN-08 constant until slice 4 and the spec requires that the remission days never move RN-07. Same day-counting semantics and the same calendar as the queue.
3. Task 3.2 says the other signals tests stay unedited; `rf-05-e.test.ts` gained the new required argument at its single call site (3 lines), as typecheck flagged.
4. Between the two commits `loadSignals` carried an interim default (`timingParamsOf(DEFAULT_PARAMETERS)`) so that every commit typechecks and passes; unit 6 removes it, and the final reader imports no registry default (scanned).
5. `loadSignals` now takes the whole input object (the destructured defaults are gone), reads the loader once and only when the caller left params, calendar or timing out, and does it after the other reads, so a request that fails early never costs the extra read. A rejection of the loader itself stays fail-soft (`{ data: null, degraded: true }`, VS-3); the real loader never throws.
6. `TimingParams` is imported as a type from `src/lib/parameters/derive.ts` (a type-only cycle with `derive.ts`, erased at build); it is not re-exported from `timing.ts`.
7. The NP-15 scan covers the signals rule modules as the task says and also the reader `src/lib/data/signals.ts` (no registry default, no constant calendar, no `DEFAULT_SIGNAL_PARAMS`, loader imported), because A11 says no constant path remains.
8. Touched files were written with LF endings (the index is LF); git warns that the working copy converts on checkout. Prettier runs with `--end-of-line auto`.

### Risks and notes for later slices

- `rf-14-support.ts` and `validation-signals.integration.test.ts` call `loadSignals` without injecting anything, so on the disposable Neon branch (task 14.5) they now read the real loader. With 0017 applied they read the nine seeds (defaults); without it the loader fails soft to defaults and logs `parameters_read_failed`.
- The coordination report keeps its own defaults and the `SignalParams`, `DEFAULT_SIGNAL_PARAMS` and `issuer.ts` shapes (pinned by a test).
- Slice 4 deletes `src/lib/intake/calendar.ts`; this slice already removed the import from `src/lib/data/signals.ts`. The review detail page, the review queue page and the coordination action still import it until slice 4.

### Next

3.8: open PR 3 against the tracker and merge it under the standing approval (653 lines, gates green); then slice 4 (task 4.0) from the tracker.
