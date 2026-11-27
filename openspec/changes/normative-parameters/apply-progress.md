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
