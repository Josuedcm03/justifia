# Apply progress: backoffice-ui-refresh

Mode: Strict TDD (Phase 0 writes no production code; the only test file was a throwaway spike, deleted). Delivery: `exception-ok`, single PR with accepted `size:exception` (D14). Artifact store: hybrid.

## Batch A: Phase 0 verification gates (2026-10-11)

### Tasks

| Task | State | Note |
|---|---|---|
| 0.1 | done | Consumers recorded below |
| 0.2 | done | Gate T1 part 1 recorded below |
| 0.3 | done | React peer check recorded below |
| 0.4 | done | Decision T1: pin v8, `@tanstack/react-table@8.21.3` |
| 0.5 | pending (owner) | Exact install command produced under "Owner commands" |
| 0.6 | pending | Needs the package; includes the ESLint `react-hooks` spike |
| 0.7 | pending (owner) | Two read-only queries produced; no database command was run |
| 0.8 | done | Baseline recorded below |
| 0.9 | done | `next/link` spike recorded below |
| 0.10 | done | V1 open item and `globals.css` baseline recorded below |
| 0.11 | pending | Checkpoint; owner action |

### 0.1 Current consumers (codegraph_explore plus `rg`, tests excluded)

- `DataTable` (`src/components/data-table.tsx`), 6 consumers: `src/app/(dashboard)/users/page.tsx`, `src/app/(dashboard)/catalog/asignaturas/page.tsx`, `src/app/(dashboard)/catalog/docentes/page.tsx`, `src/app/(dashboard)/catalog/asignaturas/asignatura-grupos-section.tsx`, `src/app/(dashboard)/catalog/import/import-preview.tsx` (`CountsTable`), `src/app/(dashboard)/catalog/import/import-errors.tsx` (`ErrorsTable`). Matches design R2.
- `DataTablePagination` and `DataTableSearch`: the three list pages only (users, asignaturas, docentes).
- `StatusFilter` (`src/components/status-filter.tsx`): asignaturas and docentes pages only. Its test: `src/components/status-filter.test.tsx`.
- `listUsuarios` (`src/lib/data/users.ts:140`): single production caller, `src/app/(dashboard)/users/page.tsx` (import line 12, call line 63). Doc-comment mentions only in `users.ts` and `asignaturas.ts`. `ListUsuariosParams` (`users.ts:63`) is used only inside `users.ts`.
- Index note: codegraph reported `src/lib/data/asignaturas.ts` as "edited, pending sync" although `git status` shows it unmodified (line-ending noise only); no action.

### 0.2 and 0.4 Gate T1: TanStack Table version

Registry (run 2026-10-11): `@tanstack/react-table` latest `9.2.8`, `peerDependencies { react: '>=18' }`, dist-tags `alpha 9.0.0-alpha.54`, `beta 9.0.0-beta.80`, `latest 9.2.8`. v9.2.8 dependencies: `@tanstack/table-core 9.2.8`, `@tanstack/react-store ^0.11.2`. Latest 8.x: `8.21.3` (`peerDependencies { react: '>=16.8', 'react-dom': '>=16.8' }`, dependency `@tanstack/table-core 8.21.3`).

Sources: tarballs `@tanstack/react-table@9.2.8`, `@tanstack/table-core@9.2.8`, `@tanstack/react-table@8.21.3` and `@tanstack/table-core@8.21.3` downloaded with `npm pack` into the scratchpad (not installed; no change to the repo) and read: published `.d.ts` files and the bundled agent skills `skills/migrate-v8-to-v9/SKILL.md` (react-table and table-core) and `skills/getting-started/SKILL.md`. context7 and WebFetch were not available to this executor. Statements about v9 that come only from those bundled docs are marked "doc".

| API name | v9.2.8 | v8.21.3 | Source |
|---|---|---|---|
| `useReactTable` | CHANGED: replaced by `useTable`; `useReactTable` is not exported from the root (the deprecated bridge `useLegacyTable` lives in `@tanstack/react-table/legacy`) | exists | v9 `dist/index.d.ts`, `dist/useTable.d.ts`, `dist/useLegacyTable.d.ts`; migration skill ("Replace `useReactTable` with `useTable`"); v8 `build/lib/index.d.ts:9` |
| `getCoreRowModel` | CHANGED: removed; the core row model is always created; only a deprecated no-op stub exists in the legacy bridge | exists (`build/lib/utils/getCoreRowModel.d.ts`) | v9 `useLegacyTable.d.ts` ("core row model is always created automatically"); core migration skill ("Remove `getCoreRowModel()`") |
| Feature registration | NEW REQUIREMENT: a stable `features` object (`tableFeatures({...})`) passed to `useTable`; each used feature (sorting, pagination, filtering) must be registered, row-model slots after prerequisite features | not applicable | core migration skill checklist; react-table `getting-started/SKILL.md` |
| `flexRender` | exists unchanged (also `FlexRender` component and `table.FlexRender`) | exists | v9 `dist/index.d.ts` exports; migration skill ("`flexRender` remains supported"); v8 `index.d.ts:8` |
| `ColumnDef` | CHANGED: now needs the `TFeatures` generic (`createColumnHelper<typeof features, Person>()`) | `ColumnDef<TData, TValue>` | getting-started skill; core migration skill ("Add `TFeatures` to unavoidable explicit core types") |
| `ColumnMeta` module augmentation | CHANGED: `interface ColumnMeta<in out TFeatures, in out TData, TValue>` (three generics, was two); augmentation must match | `interface ColumnMeta<TData, TValue>` | v9 `dist/types/ColumnDef.d.ts:17`; v8 `build/lib/types.d.ts:33` |
| `manualSorting` | exists, but requires the row-sorting feature registered | exists | v9 `features/row-sorting/rowSortingFeature.types.d.ts:189`; v8 `RowSorting.d.ts:182` |
| `manualPagination` | exists, but requires the pagination feature registered | exists | v9 `rowPaginationFeature.types.d.ts:24`; v8 `RowPagination.d.ts:32` |
| `manualFiltering` | exists, but requires the column-filtering feature registered | exists | v9 `columnFilteringFeature.types.d.ts:178`; v8 `ColumnFiltering.d.ts:130` |
| `state.sorting` | exists as a state slice; each controlled slice must be paired with its updater callback and the global `onStateChange` is removed; the `state` option itself is UNVERIFIED from a type read (only the doc statement was read) | exists (`SortingState = ColumnSort[]`, `sorting: SortingState`) | v9 react migration skill ("Pair each controlled `state` slice with its updater callback"); v8 `RowSorting.d.ts:9-11` |
| `enableSorting` | exists (column and table level) | exists | v9 `rowSortingFeature.types.d.ts:74,175`; v8 `RowSorting.d.ts:30,156` |
| `getIsSorted` | exists on the column (`column.getIsSorted()` returns `false | SortDirection`), requires the sorting feature registered | exists | v9 `rowSortingFeature.types.d.ts:132`; v8 `RowSorting.d.ts:106` |

Unverified: the exact v9 `TableOptions.state` typing and the exact `tableFeatures` slot names for a manual-only table (not read at type level). They no longer matter because v8 is chosen.

Decision T1 (task 0.4): **pin v8, exact version `8.21.3`.**

Reasons:
1. The documented fallback applies: v9 renames the hook (`useTable`), removes `getCoreRowModel`, adds a mandatory feature-registration model, adds a `TFeatures` generic to `ColumnDef` and `ColumnMeta`, and changes state subscription (`table.state`, `Subscribe`). That changes the `DataTable` design and the `ColumnMeta` augmentation, which would need a design addendum and re-derived 2b-2c estimates.
2. The design and every spec-derived test name in `tasks.md` are written against the v8 names (design lines 180 and 573-575 list `ColumnDef`, `ColumnMeta`, `useReactTable`, `getCoreRowModel`, `flexRender`, `manualSorting`, `manualPagination`).
3. The use here is the simplest one (server-driven: manual sorting, pagination and filtering, core row model only), so v9 gives no benefit for this change, and the v9 bundled docs state that the legacy bridge is deprecated.
4. v8.21.3 is the latest 8.x, peer range `react >=16.8`, which admits React 19.2.8.

Consequence: no change to `design.md` "Interfaces / Contracts" (no addendum written); its names are valid for v8.21.3. Upgrading to v9 later is a separate change.

### 0.3 React peer check

`package.json`: `react 19.2.8`, `react-dom 19.2.8`, `next 16.3.4`. `npm ls react react-dom` shows a single deduped `react@19.2.8` and `react-dom@19.2.8` across the tree (base-ui, testing-library, lucide-react, next-intl, next-themes, next). v8.21.3 peer `react >=16.8, react-dom >=16.8` admits 19.2.8; v9.2.8 peer `react >=18` would too. Result: no peer conflict expected; the install-time confirmation is an owner command.

### 0.8 Baseline on the untouched tree (branch `feature/better-ui`, only the change artifacts untracked)

| Command | Result |
|---|---|
| `npm test` | PASS: 146 files, 2919 tests, 0 failed, 71.8 s. No failing test and no flaky failure observed in this single run, including `denied/page.test.tsx`, `users/page.test.tsx`, `data-table-search.test.tsx` (the expected flaky set did not fail; one run does not prove they are stable) |
| `npm run typecheck` | PASS (rc 0) |
| `npx eslint src` | rc 1, 54,812 errors, all of them `Delete ␍` (prettier CRLF) after filtering; 0 findings once those are excluded (`rg -v 'Delete .␍.'` leaves only file-path headers). Effective result: clean |
| `npm run format:check` | rc 2, 461 files warned (includes non-`src` paths such as `.agents/**`). Cause: the working tree is CRLF (`core.autocrlf=true`, `git ls-files --eol` shows `i/lf w/crlf`) while the index is LF. Proof: `npx prettier --check --end-of-line crlf src` reports "All matched files use Prettier code style!". Pre-existing noise; not a style defect |
| `npm run build` | PASS (rc 0), 22 dynamic routes listed, no warnings of note. No dev server held `.next` (no process listening on 3100 or 3000; `.next` existed and the build succeeded) |

Known flaky set for this change: none observed. Keep the expected set (`denied/page.test.tsx`, `users/page.test.tsx`, `data-table-search.test.tsx`) as the tolerance listed in `tasks.md`. Note for "Green" in later checkpoints: `format:check` fails at baseline for CRLF reasons only; judge it by the prettier CRLF check on the files touched.

### 0.9 `next/link` spike (throwaway `src/test/spike-link.test.tsx`, deleted; `src/test/` directory removed; `git status` shows no leftover)

Real `next/link` rendered in jsdom with `onNavigate` and `scroll={false}`, only `next/navigation` mocked, click via `fireEvent.click`:

| Case | `onNavigate` calls | `router.push` calls |
|---|---|---|
| A: only `next/navigation` mocked (the task's setup) | 0 | n/a |
| B: with `AppRouterContext` provider, `onNavigate` calls `preventDefault` | 0 | 0 |
| C: with `AppRouterContext` provider, no `preventDefault` | 0 | 0 |
| D1: with the pages `RouterContext` provider (`next/dist/shared/lib/router-context.shared-runtime`), `preventDefault` called | 1 | 0 (cancelled) |
| D2: pages `RouterContext`, no `preventDefault` | 1 | 1, `["/users?page=2", {"scroll": false}]` |

Why: under Vitest (Node resolution) `next/link` resolves to the pages implementation `node_modules/next/dist/client/link.js`, which reads `RouterContext` and returns early when there is no router (`if (!router) return;`, line 371). The App Router implementation (`dist/client/app-dir/link.js`, which reads `AppRouterContext` and dispatches through `dispatchNavigateAction`) is aliased only by the Next bundler, so it is not what jsdom tests exercise.

Decision for task 2b.2: **the stand-in IS needed.** In the prescribed setup the real link never calls `onNavigate`, and the only way to make it fire is to provide an internal pages `RouterContext` from `next/dist/shared/lib/...`, which tests the wrong implementation (pages link) against an internal path. Use the fallback: `src/test/navigation-mock.ts` adds a `next/link` stand-in that renders an `a` with the given `href`/props and calls `onNavigate({ preventDefault })` on a plain (non-modifier) click, honouring `preventDefault` like the real link. Keep `scroll={false}` as a pass-through prop assertion only. Real-link behaviour in production stays covered by the Next docs (N7) and the manual smoke.

### 0.10 Open item and baseline

- Gate V1 (does `(dashboard)/loading.tsx` re-show on a query-only navigation, N8): DEFERRED, open. Observation task is 2d.5 (needs a real list, in `next dev` and in a production build).
- Baseline `git diff --stat -- src/app/globals.css`: empty (0 lines). Must stay empty at every checkpoint.

### Files changed in this batch

| File | Action |
|---|---|
| `openspec/changes/backoffice-ui-refresh/apply-progress.md` | Created |
| `openspec/changes/backoffice-ui-refresh/tasks.md` | Checkboxes 0.1, 0.2, 0.3, 0.4, 0.8, 0.9, 0.10 |

No production code, no `package.json`, no lock file, no `docs/`, no `globals.css`, no database command, no install. Authored lines: this document only (no source lines).

### Work Unit Evidence (Phase 0)

| Evidence | Value |
|---|---|
| Focused test command and exact result | Spike `npx vitest run src/test/spike-link.test.tsx`: 5 passed (informational, console output recorded above); then deleted. Baseline `npm test`: 146 files, 2919 tests passed |
| Runtime harness | `npm run build` PASS on the untouched tree; no runtime boundary changed |
| Rollback boundary | Delete `apply-progress.md` and revert the seven checkboxes in `tasks.md`; nothing else changed |

### TDD Cycle Evidence

Not applicable to Phase 0: no production code and no kept test. The only RED-style artifact is the spike, which was an observation (it recorded behaviour rather than asserting it) and was removed.

### Owner commands (run in this order)

1. Approve OC-1 and install (task 0.5, then 0.6):
   `npm install --save-exact @tanstack/react-table@8.21.3`
   Look for: `package.json` gains `"@tanstack/react-table": "8.21.3"` (no caret) and the lock file changes; no `ERESOLVE` and no "peer dep" warning.
2. Peer-conflict check:
   `npm ls react react-dom @tanstack/react-table`
   Look for: `@tanstack/react-table@8.21.3` and `@tanstack/table-core@8.21.3`, every `react@19.2.8` and `react-dom@19.2.8` marked `deduped`, and no line containing `invalid` or `UNMET PEER DEPENDENCY`; exit code 0.
3. Gate S1 (task 0.7), two READ-ONLY queries on the Neon database (run in the Neon console or `psql`; paste only the result rows, no credentials):
   - Query 1: `select collname from pg_collation where collname = 'es-x-icu';`
     - One row `es-x-icu`: the ICU Spanish collation exists, so `TEXT_SORT_COLLATION = "es-x-icu"` in 2a.6.
     - Zero rows: the collation is missing; fallback is `lower(column)` under the database default, and the owner must decide the fate of the accent-order scenarios (DT-SORT-1 "Accented names sort alphabetically", UL:sort accented scenario, CM-LST-1 "Collation, empty emails and status order") before 2a.7.
   - Query 2: `select datcollate, datlocprovider from pg_database where datname = current_database();`
     - `datcollate` like `es_*`/`es-*` or `datlocprovider = 'i'` (ICU): the database default is already Spanish or ICU, so the docentes default order does not change (OC-6 is a no-op).
     - `datcollate` = `C` or `en_US.*` with `datlocprovider = 'c'` (libc): names with accents or lowercase initials sort by the default rules (after `Z` under `C`); OC-6 needs the owner decision at 3a.1.
4. Then tell the agent to continue with the checkpoint (task 0.11 is the owner's commit). Suggested commit: `chore(deps): add @tanstack/react-table`.

### Remaining Phase 0 tasks

0.5 (owner approval), 0.6 (install plus `react-hooks` spike; needs the package), 0.7 (owner-run read-only queries), 0.11 (checkpoint). After 0.6, the `react-hooks` spike must run `useReactTable` (v8 name) inside a component in a throwaway `src/test/spike-react-table.tsx`, run `npx eslint` on it and record the rule outcome.

## Phase 0 close-out (2026-10-11, owner actions and orchestrator spike)

### Task 0.5 / 0.6: install (OC-1 approved and run by the owner)

- The owner ran `npm install --save-exact @tanstack/react-table@8.21.3`. `package.json` and `package-lock.json` are modified.
- `npm ls react react-dom @tanstack/react-table` (owner output): `@tanstack/react-table@8.21.3`; every `react` and `react-dom` entry is `19.2.8` and deduped; no `invalid`, no `UNMET PEER DEPENDENCY`.
- ESLint spike (throwaway `src/test/spike-react-table.tsx`, deleted; `git status` shows no leftover): `npx eslint` reports 0 errors and 1 warning on the `useReactTable(...)` call, rule `react-hooks/incompatible-library` ("Compilation Skipped: Use of incompatible library"). It is a warning, not an error, so lint does not fail. React Compiler is not enabled in this project, so the skipped memoization has no runtime effect today.
- Decision for 2b.8: do not disable the rule file-wide. Either accept the single warning or add one `// eslint-disable-next-line react-hooks/incompatible-library` on the `useReactTable` line with a one-line justification. Do not pass values returned by the table instance to memoized children as stable references.
- `npx tsc --noEmit` on the spike: no errors; the v8 names `useReactTable`, `getCoreRowModel`, `flexRender`, `ColumnDef`, `manualSorting`, `manualPagination`, `manualFiltering`, `getRowId` typecheck against the installed package.

### Task 0.7: gate S1 (OC-2, read-only queries run by the owner on Neon)

- `select collname from pg_collation where collname = 'es-x-icu'` returned one row: `es-x-icu`. The collation exists, so `TEXT_SORT_COLLATION = "es-x-icu"` in 2a.6 and the accent-order scenarios (DT-SORT-1, UL:sort, CM-LST-1) stand as specified. The `lower(column)` fallback is not needed.
- `select datcollate, datlocprovider from pg_database where datname = current_database()` returned `datcollate = C.UTF-8`, `datlocprovider = b` (builtin provider). The database default is code-point order, not Spanish and not ICU.
- Consequence for OC-6: today the docentes default order (`nombreCompleto asc` under `C.UTF-8`) places accented and lowercase-initial names after `Z`. Under `es-x-icu` they move to their alphabetical position, so the docentes default order DOES change for such names. OC-6 is a real owner decision and still blocks 3a.1.

### Remaining in Phase 0

- 0.11 CHECKPOINT: owner commit. Suggested message: `chore(deps): add @tanstack/react-table`.

## Batch B: Slice 1a, Orientation (2026-10-11)

Mode: Strict TDD. Delivery: `exception-ok` (single PR, accepted `size:exception`, D14). Tasks 1a.1 to 1a.14 done and ticked in `tasks.md`; 1a.15 (CHECKPOINT) is left unticked for the owner's commit. Nothing was committed, pushed or branched; no database command and no package install were run.

### Tasks

| Task | State | Note |
|---|---|---|
| 1a.1 | done | `docs/design-system.md` carries the decision-9 text; section 2 untouched; `globals.css` diff empty |
| 1a.2 | done | RED + characterization pin; mutation check recorded below |
| 1a.3 | done | `src/lib/navigation.ts` |
| 1a.4 | done | RED `initials.test.ts` |
| 1a.5 | done | `src/lib/initials.ts`; `dashboard-header.tsx` imports it |
| 1a.6 | done | RED parity (10 failures) |
| 1a.7 | done | 7 new keys in each catalog |
| 1a.8 | done | RED sidebar tests (15 failures) |
| 1a.9 | done | sidebar uses the config, footer identity block, `nav` landmark; layout passes `nombre` |
| 1a.10 | done | RED `page-context.test.tsx` (module missing) |
| 1a.11 | done | `src/components/page-context.tsx` |
| 1a.12 | done | RED `shell-motion.test.ts` (3 failures), then header and toggle edits |
| 1a.13 | done | landmark and focus assertions live in `page-context.test.tsx` and `app-sidebar.test.tsx`; `current-marker-usage.test.ts` passes unchanged (10/10) |
| 1a.14 | done | the private `items`, `isCurrent`, `isVisible` and `initials` are gone from the two components; `rg` finds no importer (they were not exported) |
| 1a.15 | pending (owner) | Checkpoint; owner commit |

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED (one line) | GREEN | Triangulation / REFACTOR |
|---|---|---|---|---|---|---|
| 1a.2/1a.3 | `src/lib/navigation.test.ts` | Unit | N/A (new) | `Failed to resolve import "./navigation"` (module absent) | 42/42 | Tables: all roles x all leaves, 10 trail paths, 4 unknown paths, 5 shortcut roles. Mutation check: moved the `settings` entry first in `NAV_ITEMS`, 2 tests failed (pin + "settings last"), restored, 42/42 |
| 1a.4/1a.5 | `src/lib/initials.test.ts` | Unit | N/A (new) | `Failed to resolve import "./initials"` | 10/10 | Multi-word, one-word, whitespace variants, blank name (moved behaviour: `""`) |
| 1a.6/1a.7 | `src/i18n/catalog-parity.test.ts` | Unit | 172 passing in the file | 10 failed: `nav.profile`, `nav.trailLabel`, `roles` missing in both catalogs + new "one label per RolUsuario" and "trail label differs from sidebar label" | 182/182 | `roles` leaf set equals `rolesUsuario`, both locales |
| 1a.8/1a.9 | `src/components/app-sidebar.test.tsx` | Component | 98 passing before the edit | 15 failed: no `navigation` landmark, no footer (initials, name, role, text-only, aria-hidden, truncation, roles x5) | 115/115 | Entries per role (new table, passes at RED as characterization), settings entry pin, nested grupos marker, es/en role label, long name, one-word and padded names, no `fetch` call |
| 1a.10/1a.11 | `src/components/page-context.test.tsx` | Component | N/A (new) | `Failed to resolve import "@/components/page-context"` | 27/27 | 8 paths x es/en, group not a link, no id/record, 3 unknown routes, no heading, entry-only below md (class), no sidebar bar / `is-current`, labelled landmark, tab in/out, 44px link |
| 1a.12 | `src/components/shell-motion.test.ts` | Structural | `theme-toggle.test.tsx` 1/1 | 3 failed: `transition-all` in `theme-toggle.tsx`, no `[scale,rotate]`, header lacks `PageContext` and still defines `initials` | 5/5 (+ toggle test 1/1) | `dashboard-header.tsx` and `app-sidebar.tsx` no-`all` checks passed at RED (characterization) |
| 1a.13 | (within the two component tests above) | Component | `current-marker-usage.test.ts` 10/10 before and after | n/a (assertions added with 1a.8 and 1a.10) | 10/10 | Distinct landmark labels asserted in both locales |
| 1a.14 | n/a | n/a | full suite | n/a | green | Dead code removed; covered by existing tests |

Test summary: 124 new tests (3043 total against 2919 at baseline), all passing. Layers: unit (navigation, initials, parity), component (sidebar, page context), structural (shell motion). Mock use is minimal (`next/navigation` in the new tests; `next-intl` only in the pre-existing sidebar test).

### Verification at the checkpoint (V)

| Command | Result |
|---|---|
| Focused: navigation, initials, page-context, shell-motion, app-sidebar, theme-toggle, catalog-parity, current-marker-usage | 8 files, 392 tests, all passed |
| `npm test` | 150 files, 3043 tests, 0 failed (baseline 146 files, 2919 tests; +4 files, +124 tests). No flaky failure seen |
| `npm run typecheck` | PASS (rc 0) |
| `npx eslint src` | 54,979 reports, every one `prettier/prettier` "Delete `CR`" (baseline 54,812; the rise is added lines in CRLF files). 0 findings of any other kind. The 7 new files report 0 |
| `npm run format:check` | Still fails on CRLF only: 462 files warned (baseline 461). `npx prettier --check --end-of-line auto src i18n` passes. `docs/design-system.md` was already non-conforming at HEAD (a pre-existing wrap near its line 464); my additions format cleanly. The one extra warning in the count is the generated `.vitest/json/output.json` (written by `npm test`, not a source file) |
| `npm run build` | PASS, `Compiled successfully`; no dev server held `.next` |
| `git diff --stat src/app/globals.css` | empty |

### Authored lines by path (additions / deletions for tracked files; line count for new files)

| Path | Lines |
|---|---|
| `docs/design-system.md` | +75 / -5 |
| `i18n/en.json` | +10 / -1 |
| `i18n/es.json` | +10 / -1 |
| `src/app/(dashboard)/layout.tsx` | +1 / -1 |
| `src/components/app-sidebar.tsx` | +81 / -122 (config moved out; the `<nav>` wrapper re-indents the menu) |
| `src/components/app-sidebar.test.tsx` | +188 / -5 |
| `src/components/dashboard-header.tsx` | +3 / -9 |
| `src/components/theme-toggle.tsx` | +2 / -2 |
| `src/i18n/catalog-parity.test.ts` | +31 / -0 |
| `src/components/page-context.tsx` (new) | 48 |
| `src/components/page-context.test.tsx` (new) | 221 |
| `src/components/shell-motion.test.ts` (new) | 35 |
| `src/lib/initials.ts` (new) | 9 |
| `src/lib/initials.test.ts` (new) | 40 |
| `src/lib/navigation.ts` (new) | 139 |
| `src/lib/navigation.test.ts` (new) | 265 |
| **Total** | tracked 547 (additions + deletions) + new 757 = **1,304**, against an estimate of 600 to 750 (upper bound +74%; the +25% stop threshold is 938) |

The overrun was only measurable at the end of the slice, which is its natural seam, so nothing was cut. About 60 percent of it is tests. Flagged for the owner; the single-PR decision (D14) still holds.

### Locale keys added (identical sets in `es.json` and `en.json`)

- `nav.profile` ("Mi perfil" / "My profile")
- `nav.trailLabel` ("Ubicación de la página" / "Page location")
- `roles.estudiante`, `roles.docente`, `roles.coordinacion`, `roles.secretaria`, `roles.administrador` (wording matches the existing `users.new.roles`)
- `GUARDED_SECTIONS` gained `nav.profile`, `nav.trailLabel`, `roles`.

### Deviations from the design and tasks

1. No `nav.context` namespace. The trail reuses the existing `nav.*` labels (`nav.administration`, `nav.catalogAsignaturas`, ...), which satisfies "same wording as the sidebar" with a single source and no duplicate keys. Only the keys that did not exist (`nav.profile`, `nav.trailLabel`) were added.
2. The sidebar had no `nav` landmark (the menu was a `div` and `ul`). BS-A11Y-1 requires the sidebar navigation to be a labelled landmark, so `AppSidebar` now wraps the menu in `<nav aria-label={t("sectionLabel")}>` inside `SidebarGroupContent`. No existing selector depends on that parent (checked); all 98 prior sidebar tests pass unchanged.
3. The design-system diagram row was written with the exact decision-9 string, which is wider than the box border; the right edge of that one row does not line up with the box. Kept verbatim as instructed (cosmetic, inside a code fence).
4. The identity name carries `title={nombre}` so a truncated long name has a way to reach the full value (the full name is also in the top-bar user menu). Not in the design text; no hover style is involved.
5. No test covers `(dashboard)/layout.tsx` passing `nombre` (the layout is an async server component with `requireUser` and has no test file today). The prop is required, so `npm run typecheck` fails if the layout omits it. Recorded rather than adding a heavy layout test in this slice.
6. Slice size is 1,304 changed lines against the 600 to 750 estimate (see above).

### Not verified (no browser or E2E layer in this run)

Visual result of the top-bar trail, the sidebar footer and the `nav` wrapper; the 320px and 360px layouts (only the `hidden md:flex` class on the group item is asserted); reduced-motion behaviour (the global `prefers-reduced-motion` rule in `globals.css` covers the toggle's `transition-[scale,rotate]`, not exercised); light and dark themes and the FIA brand (no colour token was added, only existing tokens used); touch hover latching; focus-ring appearance; the locale switch in a browser; any contrast measurement. These belong to the F.4 manual checklist.

### Work Unit Evidence (Slice 1a)

| Evidence | Value |
|---|---|
| Focused test command and exact result | `npx vitest run src/lib/navigation.test.ts src/lib/initials.test.ts src/components/page-context.test.tsx src/components/shell-motion.test.ts src/components/app-sidebar.test.tsx src/components/theme-toggle.test.tsx src/i18n/catalog-parity.test.ts "src/app/(dashboard)/catalog/current-marker-usage.test.ts"`: 8 files, 392 tests passed |
| Runtime harness | `npm run build`: compiled successfully, 22 dynamic routes. The shell is exercised in jsdom through the component tests; no browser run |
| Rollback boundary | Revert `docs/design-system.md`, `i18n/{es,en}.json` (7 keys each), `app-sidebar.tsx`, `app-sidebar.test.tsx`, `dashboard-header.tsx`, `theme-toggle.tsx`, `(dashboard)/layout.tsx`, `catalog-parity.test.ts`, and delete the seven new files under `src/lib/` and `src/components/`. Nothing outside the slice depends on them |

### Suggested commit (owner)

`feat(shell): page context, shared navigation config and sidebar identity block`

## Batch C: Slice 1b, States and home (2026-10-12)

Mode: Strict TDD. Delivery: `exception-ok` (single PR, accepted `size:exception`, D14). Tasks 1b.1 to 1b.13 done and ticked in `tasks.md`; 1b.14 (CHECKPOINT) is left unticked for the owner's commit. Nothing was committed, pushed or branched; no database command and no package install were run. `src/app/globals.css` untouched.

### Owner answers (task 1b.1)

| ID | Question | Answer |
|---|---|---|
| OC-3 | A-HOME-EMPTY: `docente` home shows one short sentence under the header, no cards | Confirmed |
| OC-4 | A-HOME-DEGRADED: a failed stats read shows `DegradedAlert`, not zeros | Confirmed |
| OC-5 | A-HOME-SCOPE: count cards show system-wide totals to `secretaria`, no new query (D9) | Confirmed |

### Tasks

| Task | State | Note |
|---|---|---|
| 1b.1 | done | OC-3, OC-4, OC-5 answered "Confirmed" (above) |
| 1b.2 | done | RED parity (10 failures), then keys in both catalogs |
| 1b.3 | done | `src/components/degraded-alert.tsx` |
| 1b.4 | done | `src/components/empty-state.tsx` |
| 1b.5 | done | `src/components/table-card.tsx` |
| 1b.6 | done | `src/components/page-frame.tsx` |
| 1b.7 | done | `src/app/(dashboard)/loading.tsx`; `ui/skeleton.tsx` pulse made `motion-safe` |
| 1b.8 | done | `src/app/(dashboard)/error.tsx` (`retry`, not `reset`) |
| 1b.9 | done | `src/app/(dashboard)/page.test.tsx` (new, 40 tests); RED was 21 failed / 19 passed |
| 1b.10 | done | `src/app/(dashboard)/page.tsx` rewritten |
| 1b.11 | done | `src/components/shell-responsive.test.ts` (structural, 13 tests) |
| 1b.12 | done | no `main` and no second `h1` asserted in loading, error and home tests |
| 1b.13 | done | no refactor: `DegradedAlert` markup equals the three page copies, which migrate in 2d, 3b, 3c and were not edited |
| 1b.14 | pending (owner) | Checkpoint; owner commit |

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED (one line) | GREEN | Triangulation / REFACTOR |
|---|---|---|---|---|---|---|
| 1b.2 | `src/i18n/catalog-parity.test.ts` | Unit | 187 passing before | 10 failed: `shell` missing, `dashboard.shortcuts.*`, `degraded`, `empty` missing, both locales | 197/197 | Shortcut key set derived from `shortcutsFor` over every role (5 keys), real translator renders `shell.error.reference` with `{digest}` |
| 1b.3 | `src/components/degraded-alert.test.tsx` | Component | N/A (new) | `Failed to resolve import "@/components/degraded-alert"` | 5/5 | role, text, markup pin, class merge, no provider |
| 1b.4 | `src/components/empty-state.test.tsx` | Component | N/A (new) | module missing | 7/7 | empty with and without action; no-results with term, filter-only, one link only, missing clear link throws (and `@ts-expect-error`) |
| 1b.5 | `src/components/table-card.test.tsx` | Component | N/A (new) | module missing | 7/7 | frame, region order, footer and toolbar absent, busy and not busy, no `transition-all`, toolbar stays enabled |
| 1b.6 | `src/components/page-frame.test.tsx` | Component | N/A (new) | module missing | 3/3 | stack, child order, class merge |
| 1b.7 | `src/app/(dashboard)/loading.test.tsx` | Component | `ui/sidebar` tests (Skeleton consumer) | module missing; then 1 failed (`motion-safe:animate-pulse` absent) once the component existed | 8/8 | es and en label, structure and order, five rows, no heading, no `main` |
| 1b.8 | `src/app/(dashboard)/error.test.tsx` | Component | N/A (new) | module missing | 12/12 | message never rendered, one h1, alert, focus, retry via click and keyboard (Enter, Space), `reset` not called, 44px, link, digest present and absent, es |
| 1b.9/1b.10 | `src/app/(dashboard)/page.test.tsx` | Component (async page) | N/A (new) | 21 failed, 19 passed against the old page | 40/40 | 5 roles x (cards, counts, h1), stats read called or not, docente sentence, degraded x3 roles, in step with the real sidebar (4 roles + flipped predicate). Mutation check: `shortcutsFor("administrador")` made 10 tests fail; restored. REFACTOR: simplified the empty-sentence condition to `!stats`, 40/40 |
| 1b.11 | `src/components/shell-responsive.test.ts` | Structural | N/A (new) | n/a: characterization of new code and of 1a code (passed once the detector excluded `min-w-0`) | 13/13 | the detector itself is tested (`w-96`, `min-w-[20rem]` flagged; fractions accepted) |
| 1b.12 | (within loading, error and page tests) | Component | n/a | n/a (assertions added to existing tests) | green | `main` absent in all three |
| 1b.13 | n/a | n/a | full suite | n/a | green | None needed |

Test summary: 110 new tests this batch (3,153 total against 3,043 after 1a and 2,919 at baseline), 158 files, all passing.

### Verification at the checkpoint (V)

| Command | Result |
|---|---|
| Focused: parity, degraded-alert, empty-state, table-card, page-frame, loading, error, page, shell-responsive | all passed (each run during its cycle) |
| `npm test` | 158 files, 3,153 tests, 0 failed (after 1a: 150 files, 3,043). No flaky failure seen |
| `npm run typecheck` | PASS (rc 0) |
| `npx eslint src` | 55,118 reports, every one `prettier/prettier` "Delete `CR`" (checked through JSON output: 0 findings of any other kind) |
| `npm run format:check` | Fails on CRLF noise only (pre-existing). `npx prettier --check --end-of-line auto src i18n` passes: "All matched files use Prettier code style!" |
| `npm run build` | PASS, `Compiled successfully`; both new route-segment files compile; 22 dynamic routes |
| `git diff --stat src/app/globals.css` | empty |

### Authored lines by path (this batch only)

| Path | Lines |
|---|---|
| `src/app/(dashboard)/page.tsx` (rewritten) | +83 / -28 |
| `src/components/ui/skeleton.tsx` | +6 / -1 |
| `i18n/es.json`, `i18n/en.json` | +19 / -1 each |
| `src/i18n/catalog-parity.test.ts` | +79 (includes a prettier re-wrap of a few 1a lines) |
| `src/components/degraded-alert.tsx` (new) | 29 |
| `src/components/empty-state.tsx` (new) | 61 |
| `src/components/table-card.tsx` (new) | 69 |
| `src/components/page-frame.tsx` (new) | 17 |
| `src/app/(dashboard)/loading.tsx` (new) | 48 |
| `src/app/(dashboard)/error.tsx` (new) | 66 |
| `src/components/degraded-alert.test.tsx` (new) | 44 |
| `src/components/empty-state.test.tsx` (new) | 99 |
| `src/components/table-card.test.tsx` (new) | 124 |
| `src/components/page-frame.test.tsx` (new) | 45 |
| `src/components/shell-responsive.test.ts` (new) | 67 |
| `src/app/(dashboard)/loading.test.tsx` (new) | 101 |
| `src/app/(dashboard)/error.test.tsx` (new) | 148 |
| `src/app/(dashboard)/page.test.tsx` (new) | 330 |
| **Total** | tracked 111 + 7 + 40 + 79 = 237, new 1,248 = **about 1,485**, against an estimate of 600 to 750 (upper bound +98%; the +25% stop threshold is 938). About 70 percent is tests |

Flagged for the owner. The overrun was only measurable at the slice seam (the checkpoint), so nothing was cut; the single-PR decision (D14) holds. Running total of slices 1a and 1b: about 2,790 lines against 1,200 to 1,500 estimated for the pair.

### Locale keys added (identical sets in `es.json` and `en.json`)

- `shell.error.title`, `shell.error.description`, `shell.error.retry`, `shell.error.dashboardLink`, `shell.error.reference` (`{digest}`)
- `dashboard.degraded`, `dashboard.empty`
- `dashboard.shortcuts.newRequest`, `.catalogAsignaturas`, `.catalogDocentes`, `.catalogImport`, `.users`
- `GUARDED_SECTIONS` gained `shell` and `dashboard`. The skeleton label reuses `common.loading`; shortcut titles reuse the sidebar `nav.*` labels (one source).

### Deviations from the design and tasks

1. No shared empty and no-results copy keys under `shell`. `EmptyState` is hook-free and receives its copy as props; every list already owns its keys (`users.empty`, `users.noResults.*`, `catalog.*`), and a shared set would be dead until a consumer exists. Consumers add their keys in 2c and 2d with the table kit.
2. `ui/skeleton.tsx` was edited (`animate-pulse` became `motion-safe:animate-pulse`). BS-LOAD-1 and BS-MOT-1 require the pulse to stop under reduced motion; the only other consumer of the primitive is the sidebar skeleton. Driven by a RED test in `loading.test.tsx`.
3. `EmptyState` throws at runtime when `no-results` has no clear link (besides the type error). Defensive for non-TypeScript callers; the task asked for a type error and a test failure.
4. `loading.tsx` uses `useTranslations` from `next-intl` in a synchronous server component (the react-server build exists in the installed next-intl). Chosen over `getTranslations` because the boundary must stay synchronous (BS-LOAD-1). The build and the real-catalog test pass; the runtime in `next dev` is not observed.
5. The shell structural test omits `dashboard-header.tsx`: its only match is the user dropdown popup `min-w-56` (a popup, not layout).
6. Count cards render before the shortcut cards (counts first as information, then actions). The design does not fix an order.
7. Slice size is about 1,485 changed lines against the 600 to 750 estimate (see above).

### Not verified (no browser or E2E layer in this run)

Visual result of the shortcut cards, the skeleton and the error screen; 320px and 360px layouts (only class-level pins); reduced-motion behaviour of the skeleton in a browser; hover not latching on touch (Tailwind v4 gates `hover:` behind `(hover: hover)`, relied on, not exercised); focus ring appearance; focus landing on the error heading in a real boundary; that Next renders `error.tsx` with `retry` on a thrown server error (unit-tested with the props only); the locale switch in a browser; contrast. These belong to the F.4 manual checklist. Gate V1 (does `loading.tsx` re-show on a query-only navigation) is still open and belongs to 2d.5.

### Work Unit Evidence (Slice 1b)

| Evidence | Value |
|---|---|
| Focused test command and exact result | `npx vitest run src/i18n/catalog-parity.test.ts src/components/degraded-alert.test.tsx src/components/empty-state.test.tsx src/components/table-card.test.tsx src/components/page-frame.test.tsx src/components/shell-responsive.test.ts "src/app/(dashboard)/loading.test.tsx" "src/app/(dashboard)/error.test.tsx" "src/app/(dashboard)/page.test.tsx"`: all passed; full suite 158 files, 3,153 tests |
| Runtime harness | `npm run build`: compiled successfully with `loading.tsx` and `error.tsx` present, 22 dynamic routes. The home, boundary and states are exercised in jsdom; no browser run |
| Rollback boundary | Revert `(dashboard)/page.tsx`, `ui/skeleton.tsx`, `i18n/{es,en}.json` (the `dashboard` additions and the `shell` block), `catalog-parity.test.ts` (the 1b additions), and delete the 14 new files listed above. Nothing outside the slice depends on them (the three list pages still carry their own degraded alerts and empty states) |

### Suggested commit (owner)

`feat(shell): loading and error boundaries, shared states and role-aware home`
