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

## Batch D: Slice 2a, URL contract and users data layer (2026-10-12)

Mode: Strict TDD. Delivery: `exception-ok` (single PR, accepted `size:exception`, D14). Tasks 2a.1 to 2a.11 done and ticked in `tasks.md`; 2a.12 (CHECKPOINT) is left unticked for the owner's commit. Housekeeping: 0.11, 1a.15 and 1b.14 ticked (owner commits are in: 5af89f7, b74f5f3, a173b35, 54fd126). Nothing was committed, pushed or branched; no database command, no seed and no package install were run (the query-builder tests are DB-free). `src/app/globals.css` untouched.

### Gate S1 outcome (task 0.7, answered before this batch)

- Collation `es-x-icu` EXISTS on the database, so `TEXT_SORT_COLLATION = "es-x-icu"` in `src/lib/data/sort-sql.ts`.
- The `lower(column)` fallback is INACTIVE (not taken). The OC-2 gate of 2a.7 therefore does not apply and no owner decision on the accent-order scenarios was needed; they stand as specified.
- Database default collation is `C.UTF-8` (builtin provider). OC-6 (docentes default order) is a 3a.1 concern and still open; nothing in this slice touches `listDocentes`.

### Tasks

| Task | State | Note |
|---|---|---|
| 2a.1 | done | RED: 65 failed (new exports absent), 20 existing passed |
| 2a.2 | done | `src/lib/list-params.ts` additions; 85/85 |
| 2a.3 | done | RED: 53 failed |
| 2a.4 | done | `src/lib/users/list-params.ts` extended; 191/191 with the catalog parser tests |
| 2a.5 | done | RED: module `@/lib/data/sort-sql` missing |
| 2a.6 | done | `src/lib/data/sort-sql.ts`; 27/27 after one test-only fix (a `split(", ")` that cut inside `nullif(col, '')`) |
| 2a.7 | done | RED: 17 failed (status ignored, sort ignored, projection not narrowed); DB-free |
| 2a.8 | done | `src/lib/data/users.ts`; 48/48; codegraph caller check done first |
| 2a.9 | done | RED: 19 failed, characterization tests passed at RED (guard order, denied, degraded) |
| 2a.10 | done | `src/app/(dashboard)/users/page.tsx`; 34/34, then +1 test with a mutation check, 35/35 |
| 2a.11 | done | Seam check recorded below |
| 2a.12 | pending (owner) | Checkpoint; owner commit |

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED (one line) | GREEN | Triangulation / REFACTOR |
|---|---|---|---|---|---|---|
| 2a.1/2a.2 | `src/lib/list-params.test.ts` | Unit | existing tests of the file green (92/92 across the 5 touched test files before any edit) | 65 failed: `parseEnum`, `parsePageSize`, `parseSort`, `nextSort`, `applyListChange`, constants not exported | 85/85 | Every DT-URL-1 fallback row for `size` and `sort`/`dir` (hostile: `hashClave`, `__proto__`, `constructor`, injection, 500 chars, other list's key, arrays); `applyListChange` page-only vs non-page, no mutation |
| 2a.3/2a.4 | `src/lib/users/list-params.test.ts` | Unit | existing tests green (in the 92/92) | 53 failed (state shape, constants, sort, status, size, href) | 191/191 with list-params and catalog parser tests | Defaults, status table, 10 valid and 11 hostile sort/dir rows, size table, canonical-order href table, sort/dir written together, round trip. Two existing assertions changed (see deviations) |
| 2a.5/2a.6 | `src/lib/data/sort-sql.test.ts` | Unit (query builder, DB-free) | N/A (new) | module missing | 27/27 | 5 expression kinds x 2 directions, default pair reproduces `CreadoEn desc, Id desc`, catalog-style default adds only the id, collation only on name and login, empty e-mail `nulls last` both ways, status asc is active first, hostile and inherited keys fall back, type-level `@ts-expect-error` for an incomplete map |
| 2a.7/2a.8 | `src/lib/data/users-query.test.ts` | Unit (query builder, DB-free) | existing tests green (in the 92/92) | 17 failed: where clause ignored `status`, order ignored `sort`, select list not narrowed | 48/48 | Scope first for every status, exact where text per status, status + search inside scope, empty scope closed per status, 10 sort cases end with `Id`, 6 leading expressions, projection keys and select-list text, e-mail search predicate kept, `clampPage` for 25/50 and 60 rows, `listUsuarios` degraded echoes 10/25/50 |
| 2a.9/2a.10 | `src/app/(dashboard)/users/page.test.tsx` | Component (async page) | existing tests green (in the 92/92) | 19 failed: call shape lacked `status`/`sort`/`size`, rows carried `hashClave`, `cif`, `telefono`, `correo` and no `creadoEnLabel` | 35/35 | 7 hostile-parameter rows, denied role redirect without read, guard before read, degraded with all params, 6 role x term delivery cases, 4 forbidden-field serialization cases, rendered markup check, paging link keeps `status`/`sort`/`size`. Mutation check: removing `status, sort, size` from the page link failed exactly the new link test, restored |
| 2a.11 | n/a | n/a | full suite | n/a | green | Seam check (below) |

Test summary: 3,362 tests in 159 files (3,153 in 158 after 1b); this batch adds 209 tests and 1 file (`sort-sql.test.ts`), all passing. Layers: unit and query-builder (list-params x2, sort-sql, users-query), component (users page). Mocks: `server-only` and `@/db` (query tests, as the project already does), `@/lib/auth/dal`, `@/lib/data/users`, `next-intl/server` and a pass-through spy on `@/components/data-table` (page test).

### 2a.11 Seam check (codegraph_explore plus `rg` across the repo, tests excluded)

- `listUsuarios`: one production caller, `src/app/(dashboard)/users/page.tsx`. No seed, script or other file calls it.
- `ListUsuariosParams`, `UsuarioListResult`: used only inside `src/lib/data/users.ts` and by that page.
- `buildUsersWhere`, `buildListUsuariosQuery`: used only in `users.ts` and `users-query.test.ts`.
- `usuarioConRolColumns` and `UsuarioConRol`: untouched; login, profile and `getUsuarioBy*` still select the full record.
- `getDashboardStats` and `clampPage`: untouched (`asignaturas.ts` imports `clampPage` unchanged).
- `USERS_PAGE_SIZE` stays exported and equals `DEFAULT_PAGE_SIZE`; `CATALOG_PAGE_SIZE` (derived from it) still resolves to 10.
- Conclusion: no other caller relied on the old `ListUsuariosParams` shape.

### Verification at the checkpoint (V)

| Command | Result |
|---|---|
| Focused: `npx vitest run src/lib/list-params.test.ts src/lib/users/list-params.test.ts src/lib/data/sort-sql.test.ts src/lib/data/users-query.test.ts "src/app/(dashboard)/users/page.test.tsx" src/lib/catalog/list-params.test.ts` | all passed (6 files; list-params 85 tests, sort-sql 27, users-query 48, users page 35) |
| `npm test` | 159 files, 3,362 tests, 0 failed. No flaky failure seen |
| `npm run typecheck` | PASS (rc 0) |
| `npx eslint src` (JSON output) | 56,189 reports, every one `prettier/prettier` "Delete `CR`"; 0 findings of any other kind. New files (LF) report 0 |
| `npm run format:check` | CRLF noise only (pre-existing). `npx prettier --check --end-of-line auto` on every touched path: "All matched files use Prettier code style!" |
| `npm run build` | PASS, `/users` listed as dynamic |
| `git diff --stat src/app/globals.css` | empty |

### Authored lines by path (additions / deletions for tracked files; line count for new files)

| Path | Lines |
|---|---|
| `src/lib/list-params.ts` | +72 / -0 |
| `src/lib/users/list-params.ts` | +66 / -6 |
| `src/lib/data/users.ts` | +85 / -11 |
| `src/app/(dashboard)/users/page.tsx` | +37 / -12 |
| `src/lib/data/sort-sql.ts` (new) | 70 |
| `src/lib/list-params.test.ts` | +203 / -1 |
| `src/lib/users/list-params.test.ts` | +202 / -2 |
| `src/lib/data/users-query.test.ts` | +191 / -9 |
| `src/app/(dashboard)/users/page.test.tsx` | +259 / -3 |
| `src/lib/data/sort-sql.test.ts` (new) | 191 |
| **Total** | tracked 1,159 (additions + deletions) + new 261 = **about 1,420**, against an estimate of 500 to 650 (upper bound +118%; the +25% stop threshold is 813). About 75 percent is tests (about 1,070 lines), production code is about 350 |

Flagged for the owner. The overrun was only measurable at the slice seam (the checkpoint), so nothing was cut; the single-PR decision (D14) holds. Running total of 1a, 1b and 2a: about 4,210 lines.

### Locale keys added

None (no UI string in this slice). The old `users.*` keys are still used by the old components.

### Deviations from the design and tasks

1. Two existing assertions in `src/lib/users/list-params.test.ts` changed although the task says existing tests stay unchanged: `toEqual({ page: 2, q: "ana" })` (extra keys ignored) now expects the full default state, and the round-trip test now uses `toMatchObject({ page, q })`. Both asserted the old two-field return shape, which the task itself extends. Their intent (extra keys ignored; page and q round trip) is preserved and the new full-state round trip is added.
2. `users-query.test.ts`: the existing `buildUsersWhere(role, q)` calls gained a third argument `"all"` because `status` is required by design (type-forced), and `toSql` gained an optional `sort`. Behaviour asserted is unchanged (scope, default order, escaping, limit and offset).
3. `buildListUsuariosQuery` now selects `usuarioListColumns` instead of `select()` (all columns), so the proof query and the real read share one projection and one `usersOrderBy`. Its third argument gains an optional `sort`, defaulting to `USERS_DEFAULT_SORT`.
4. `orderByFor` guards with `Object.hasOwn(map, sort.key)` and falls back to the default pair for a key without an own entry. Not in the design text; defence in depth behind the parser, covered by two tests (`__proto__` and an injection string).
5. `sort-sql.ts` exports four expression helpers (`collatedText`, `plainColumn`, `emailLast`, `activeFirst`) and the `SortExpr` type. The design named only `orderByFor` and `TEXT_SORT_COLLATION`; "expression helpers" is in task 2a.6. `emailLast` has no consumer in this slice (docentes uses it in 3a.7); it is proven by its own tests.
6. `users/page.tsx` also passes `status`, `sort` and `size` to the OLD pagination `hrefFor`, so a shared URL with those parameters keeps them while paging (DT-URL-2). The old `DataTableSearch` form still drops them on submit; no control sets them until 2d, so no user-visible regression. `UserRow` is a module-local type in the page (a Next page file may not export it); 2d moves it next to `UsersTable`.
7. `UsuarioListResult.pageSize` stays `number` (the echoed requested value); only the request side is `PageSize`.
8. Slice size is about 1,420 changed lines against the 500 to 650 estimate (see above).

### Not verified (no database, no browser in this run)

The SQL was proven as text through `toSQL()` only: that PostgreSQL accepts `"Usuario"."NombreCompleto" collate "es-x-icu"` and orders "Álvaro, angel, Beatriz, Zoe" as the spec says was NOT executed (no database command was allowed; the collation's existence is the owner-run S1 result). Stable pagination across equal values, the clamp against a real total and the status counts are likewise unexecuted against data. The Next route at runtime (`next dev`) was not exercised beyond `npm run build`. These belong to the 2d.6 manual users smoke.

### Work Unit Evidence (Slice 2a)

| Evidence | Value |
|---|---|
| Focused test command and exact result | `npx vitest run` on the six files above: all passed; full suite 159 files, 3,362 tests |
| Runtime harness | `npm run build`: compiled, `/users` dynamic. Query shape is exercised through the DB-free drizzle `QueryBuilder`; the page through the async component with a real `DataTable`. No database or browser run |
| Rollback boundary | Revert `list-params.ts`, `users/list-params.ts`, `data/users.ts`, `users/page.tsx` and the four test files above, and delete `sort-sql.ts` and `sort-sql.test.ts`. Nothing outside the slice imports the new exports (the catalog parser still uses `USERS_PAGE_SIZE` and `USERS_SEARCH_MAX`, both kept) |

### Suggested commit (owner)

`feat(users): validated sort, status and page-size parameters with a narrowed list projection`

## Batch E: Slice 2b, Table core (2026-10-12)

Mode: Strict TDD. Delivery: `exception-ok` (single PR, accepted `size:exception`, D14). Tasks 2b.1 to 2b.11 done and ticked in `tasks.md`; 2b.12 (CHECKPOINT) is left unticked for the owner's commit. Nothing was committed, pushed or branched; no database command and no package install were run (`@tanstack/react-table@8.21.3` was already installed and committed). `src/app/globals.css` untouched. The old `src/components/data-table.tsx` and its three siblings were not edited and nothing imports the new kit yet except its tests.

### Tasks

| Task | State | Note |
|---|---|---|
| 2b.1 | done | RED: `@/test/intl` missing; GREEN `src/test/intl.tsx` (5/5) |
| 2b.2 | done | RED: `@/test/navigation-mock` missing; GREEN `src/test/navigation-mock.ts` (7/7). The `next/link` stand-in is included (0.9: the real link is not clickable in jsdom) |
| 2b.3 | done | RED: module missing |
| 2b.4 | done | `src/components/tables/list-navigation.tsx`; 6/6 |
| 2b.5 | done | RED: module missing |
| 2b.6 | done | `src/components/tables/sortable-header.tsx`; 18/18 (after the 2b.10 keys, see deviations) |
| 2b.7 | done | RED: module missing |
| 2b.8 | done | `src/components/tables/data-table.tsx`; 24/24 (one test-only fix: `rerender` needed the provider, so `renderWithIntl` now uses a wrapper) |
| 2b.9 | done | RED: 1 failed (`transition-colors` on the row); GREEN: removed it; 4/4, old `data-table.test.tsx` still green |
| 2b.10 | done | RED: 5 failed (`tables` absent); GREEN: 4 keys in each locale; 203/203 |
| 2b.11 | done | Boundary verified and pinned by `client-boundary.test.ts` (note below) |
| 2b.12 | pending (owner) | Checkpoint; owner commit |

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED (one line) | GREEN | Triangulation / REFACTOR |
|---|---|---|---|---|---|---|
| 2b.1 | `src/test/intl.test.tsx` | Unit/component | N/A (new) | `Failed to resolve import "@/test/intl"` | 5/5 | es and en real catalogs, missing key throws (`notARole`), key echo for two namespaces and with values. REFACTOR: provider became a wrapper so `rerender` keeps context (found by the 2b.7 test) |
| 2b.2 | `src/test/navigation-mock.test.tsx` | Component | N/A (new) | `Failed to resolve import "@/test/navigation-mock"` | 7/7 | Shared router spies, pathname set and reset, anchor with real href, `onNavigate` plus `preventDefault`, push with `{scroll:false}`, replace link, modifier click left to the browser |
| 2b.3/2b.4 | `src/components/tables/list-navigation.test.tsx` | Component | N/A (new) | `Failed to resolve import "@/components/tables/list-navigation"` | 6/6 | push, replace, href passthrough, pending true then false through a suspending child inside the transition, controls enabled while pending, throw outside the provider. Mutation check: replaced `startTransition` with a plain call, the 2 pending tests failed; restored, 6/6 |
| 2b.5/2b.6 | `src/components/tables/sortable-header.test.tsx` | Component | N/A (new) | module missing | 18/18 | button in th named by label, 44px and offset classes, end align, aria-sort asc/desc/absent, three distinct icons, name in every state, description text per state in en and es, Enter, Space, click, focus kept, focus ring, no transition |
| 2b.7/2b.8 | `src/components/tables/data-table.test.tsx` | Component | N/A (new) | module missing | 24/24 | `onSort(column.id)` for two columns, rows never reordered or truncated (3 and 25 rows), aria-sort table (3 rows) plus unknown key, action column no button, bounded mode, zero rows, caption plus sentence and without it, `scope="col"`, 48px, `getRowId` as row id and as React key (DOM node kept on reorder), meta align and className, pending dims by opacity only |
| 2b.9 | `src/components/ui/table.test.tsx` | Structural | `data-table.test.tsx` (old kit) green before and after | 1 failed: row class matched `transition` | 4/4 | hover tint only behind `hover:`, divider and muted header kept, headers and cells do not animate |
| 2b.10 | `src/i18n/catalog-parity.test.ts` | Unit | 197 passing before | 5 failed: `tables` missing in both locales, exact key set, wording differs per locale | 203/203 | Exact leaf set equals the four keys in es and en |
| 2b.11 | `src/components/tables/client-boundary.test.ts` | Structural | N/A (new) | n/a: characterization of new code (passed once written) | 5/5 | `"use client"` on the three kit modules and on `ui/table.tsx`; props carry `columns`, no `empty` slot |

Test summary: 75 new tests (3,437 total against 3,362 after 2a), 166 files (159 after 2a), all passing. Layers: unit (intl, parity), component (navigation, header, table), structural (ui table, client boundary). Mocks per file: at most two (`next/navigation`, `next/link`), both through the shared module.

Assertion-quality note: `strict-tdd.md` discourages class-name assertions, but 2b.5 and 2b.9 explicitly require class-level checks (44px with the offsetting margin, no `transition`, hover variant only). They are limited to those tasks; everything else asserts roles, names, attributes and text.

### Verification at the checkpoint (V)

| Command | Result |
|---|---|
| Focused: `npx vitest run src/test src/components/tables src/components/ui/table.test.tsx src/i18n/catalog-parity.test.ts src/components/data-table.test.tsx` | all passed |
| `npm test` | 166 files, 3,437 tests, 0 failed. No flaky failure seen |
| `npm run typecheck` | PASS (rc 0) |
| `npx eslint src` (JSON output) | 56,219 reports, every one `prettier/prettier` "Delete `CR`"; 0 findings of any other kind; the new LF files report 0 |
| `npx prettier --check --end-of-line auto` on `src/test`, `src/components/tables`, `src/components/ui/table.tsx`, `src/components/ui/table.test.tsx`, `src/i18n/catalog-parity.test.ts`, `i18n` | "All matched files use Prettier code style!" (7 new files needed `--write` once) |
| `npm run build` | PASS, `Compiled successfully`, rc 0 |
| `git diff --stat src/app/globals.css` | empty |
| Line endings (byte-level check) | `ui/table.tsx`, `i18n/{es,en}.json`, `catalog-parity.test.ts` stay CRLF (0 bare LF); all new files LF as in earlier slices |

### 0.6 lint outcome applied (task 2b.8)

`useReactTable(...)` raises one `react-hooks/incompatible-library` warning (no error). Handled with a single `// eslint-disable-next-line react-hooks/incompatible-library` on that line, with a three-line justification (React Compiler not enabled; no table value passed to a memoized child). No file-wide disable. After the directive `npx eslint src` reports 0 findings for the file and no "unused directive" warning, so the directive is in use.

### 2b.11 boundary note

Function-valued `cell` renderers never cross a server boundary: `data-table.tsx`, `sortable-header.tsx`, `list-navigation.tsx` and `ui/table.tsx` are client modules (pinned by `client-boundary.test.ts`), columns will be built in client modules next to each page (2d, 3b, 3c) and a server page hands over only plain picked rows.

### Authored lines by path (additions / deletions for tracked files; line count for new files)

| Path | Lines |
|---|---|
| `i18n/es.json`, `i18n/en.json` | +10 each |
| `src/components/ui/table.tsx` | +2 / -2 |
| `src/i18n/catalog-parity.test.ts` | +30 |
| `src/test/intl.tsx` (new) | 50 |
| `src/test/navigation-mock.ts` (new) | 116 |
| `src/components/tables/list-navigation.tsx` (new) | 64 |
| `src/components/tables/sortable-header.tsx` (new) | 72 |
| `src/components/tables/data-table.tsx` (new) | 183 |
| `src/test/intl.test.tsx` (new) | 54 |
| `src/test/navigation-mock.test.tsx` (new) | 144 |
| `src/components/tables/list-navigation.test.tsx` (new) | 192 |
| `src/components/tables/sortable-header.test.tsx` (new) | 181 |
| `src/components/tables/data-table.test.tsx` (new) | 304 |
| `src/components/ui/table.test.tsx` (new) | 70 |
| `src/components/tables/client-boundary.test.ts` (new) | 44 |
| **Total** | tracked 54 + new 1,474 = **about 1,528**, against an estimate of 500 to 650 (upper bound +135%; the +25% stop threshold is 813). Production about 485, tests about 1,040 |

Flagged for the owner. As in earlier slices the overrun was only measurable at the slice seam, so nothing was cut; the single-PR decision (D14) holds. Running total of 1a, 1b, 2a and 2b: about 5,740 lines. Cause: a 24-test table suite and three helper suites that the estimate did not count separately.

### Locale keys added (identical sets in `es.json` and `en.json`)

- `tables.caption.sortable`
- `tables.sort.sortable`, `tables.sort.ascending`, `tables.sort.descending`
- `GUARDED_SECTIONS` gained `tables`.

### Deviations from the design and tasks

1. Order: the 2b.10 RED and keys were done before 2b.6 GREEN, because `SortableHeader` reads `tables.sort.*` and the real-catalog test throws on a missing key. The tick order in `tasks.md` is unchanged.
2. The sort state text ("sortable", "ascending", "descending") is the button's `title`, so it is the accessible description and a pointer tooltip; the button's name stays exactly the column label (spec: "named by the column label"), the icon is `aria-hidden`, and the `th` carries `aria-sort`. There is no separate "sort button label" key for that reason (4 keys). Whether a visible text indicator is wanted is a design call for the owner.
3. Sortability is an explicit opt-in (`columnDef.enableSorting === true` in server-driven mode), not TanStack's `getCanSort()`, which is false for columns without an accessor. Consumers can therefore use plain display columns whose `id` equals the URL sort key. `getIsSorted()` is still used for the state.
4. `pending` (design API) is implemented on `DataTable` as body opacity 60% with `transition-opacity duration-150 ease-ui`; no task line listed it, so tests were added with it.
5. Extra test files beyond the task list: `navigation-mock.test.tsx` (the stand-in is behaviour defined here, so it is tested), `client-boundary.test.ts` (2b.11), and `ui/table.test.tsx` (no table test existed).
6. `renderWithIntl` is built on a React Testing Library `wrapper`, so `rerender` keeps the intl context.
7. The `next/link` stand-in exposes `data-scroll` (not rendered by the real link) only so a test can assert the `scroll` flag; it also calls `router.push` or `router.replace` when `onNavigate` does not cancel, like the real link.
8. The `ColumnMeta` augmentation carries one narrow `eslint-disable-next-line @typescript-eslint/no-unused-vars` (the merged declaration must repeat the library's type parameters).
9. Slice size is about 1,528 changed lines against the 500 to 650 estimate (see above).

### Not verified (no browser, no real router in this run)

Real pixel size of the 44px button and the 48px header row (class-level only); the focus ring appearance; that a screen reader announces the `title` description after the name and does not double-announce it next to `aria-sort`; the pending flag against the real Next router (simulated by a suspending child inside the transition; `router.push` inside `startTransition` is the documented pattern but was not observed); the real App Router `next/link` and its `onNavigate` (stand-in only, per 0.9); reduced-motion behaviour of the 150ms opacity transition (relies on the global rule in `globals.css`); that `@tanstack/react-table` lands correctly in a client bundle (no page imports the kit yet, so `npm run build` does not bundle it; the first real build proof is 2d); Gate V1 (still open, belongs to 2d.5). These belong to the F.4 manual checklist and to 2d.

### Work Unit Evidence (Slice 2b)

| Evidence | Value |
|---|---|
| Focused test command and exact result | `npx vitest run src/test src/components/tables src/components/ui/table.test.tsx src/i18n/catalog-parity.test.ts`: 8 files passed; full suite 166 files, 3,437 tests |
| Runtime harness | `npm run build` compiled successfully, but the kit has no consumer yet so it is not in any bundle; the runtime path is exercised in jsdom with the real catalogs. No browser run |
| Rollback boundary | Revert `ui/table.tsx` (restore `transition-colors`), `i18n/{es,en}.json` (the `tables` block) and `catalog-parity.test.ts` (the `tables` guard and its describe); delete `src/test/`, `src/components/tables/` and `src/components/ui/table.test.tsx`. Nothing outside the slice imports them |

### Suggested commit (owner)

`feat(tables): TanStack table core with accessible sortable headers`

## Batch F: Slice 2c, Table controls (2026-10-12)

Mode: Strict TDD. Delivery: `exception-ok` (single PR, accepted `size:exception`, D14). Tasks 2c.0 to 2c.8 done and ticked in `tasks.md`; 2c.9 (CHECKPOINT) is left unticked for the owner's commit. Housekeeping: 2b.12 ticked (commit c47cc2d exists). Nothing was committed, pushed or branched; no database command and no package install were run. `src/app/globals.css` untouched (empty diff). The four OLD root components were not edited or imported; the new kit has no consumer yet except its tests.

### Owner decision: visible sort state (task 2c.0, follow-up of 2b deviation 2)

The sort-direction indicator in `sortable-header.tsx` is now VISIBLE TEXT (Sortable / Ascending / Descending, Ordenable / Ascendente / Descendente), not only the button `title`.

- The text is an `aria-hidden` span inside the button, so the button's accessible NAME stays exactly the column label (DT-SORT-2, DT-A11Y-1). Assistive technology still gets the state from `aria-sort` on the `th` and from the existing description (`title`, `tables.sort.*` kept unchanged).
- The three icons are kept. The visible text is sentence case (`normal-case`, `text-xs`, muted), so it does not compete with the uppercase label.
- Narrow widths and sizes: the `th` is `whitespace-nowrap`, so the button opts back in with `whitespace-normal` and `flex-wrap`; no width classes were added. `min-h-11` (44px) and the `th` `h-12` (48px, a minimum for the row) are unchanged; on a very narrow column the label and state may stack and the row may grow, which is the intended wrapping.
- Keys: parity test extended FIRST (RED, 3 failures), then `tables.sort.indicator.{sortable,ascending,descending}` added to both locales. The long sentences under `tables.sort.*` were kept for the description; they are too long to show in a header.
- Tests updated: `sortable-header.test.tsx` (+46 lines: visible text per state, `aria-hidden`, name unchanged, es, wrapping classes) and `data-table.test.tsx` (+22: every sortable header carries its state text, non-sortable has none, names unchanged).

### Tasks

| Task | State | Note |
|---|---|---|
| 2b.12 | done (housekeeping) | commit c47cc2d exists |
| 2c.0 | done | RED: 3 parity + 6 component failures; GREEN 262/262 in tables + parity |
| 2c.1 | done | RED: 5 parity failures; 16 new keys in each locale (plus the 3 of 2c.0) |
| 2c.2 | done | RED: module missing; `status-filter.tsx` 11/11 |
| 2c.3 | done | RED: module missing; `table-toolbar.tsx` 22/22 (one test-only fix: `getByLabelText` matched both the form and the input, now `getByRole("searchbox")`) |
| 2c.4 | done | RED: module missing; `table-pagination.tsx` 19/19 |
| 2c.5 | done | RED: module missing, 23 tests |
| 2c.6 | done | `list-table.tsx`; 23/23 after one test-only fix (the unsorted icon also carries `opacity-60`, so the dimming assertion now targets the card body) |
| 2c.7 | done, no change | only two copies of the control class string exist (status filter, pagination), so no dedupe; the third-copy condition did not occur |
| 2c.8 | done | Seam check recorded below |
| 2c.9 | pending (owner) | Checkpoint; owner commit |

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED (one line) | GREEN | Triangulation / REFACTOR |
|---|---|---|---|---|---|---|
| 2c.0 | `sortable-header.test.tsx`, `data-table.test.tsx`, `catalog-parity.test.ts` | Component, unit | 256/256 in `src/components/tables` + parity before any edit | parity 3 failed (`sort.indicator.*` absent); header 5 failed and data-table 1 failed (no visible text, no wrapping classes) | 262/262 | 3 states x en, es, name unchanged, wrapping classes, a table with three sortable headers and one action column |
| 2c.1 | `src/i18n/catalog-parity.test.ts` | Unit | 200 passing before | 5 failed: exact `tables` key set, per-locale wording, ICU shape | 213/213 in `src/i18n` | exact leaf set (24 keys) in es and en; each key differs between locales except the number format; `count` is an ICU plural with two `#`; `status` and `option` interpolate |
| 2c.2 | `status-filter.test.tsx` | Component | N/A (new) | `Failed to resolve import "@/components/tables/status-filter"` | 11/11 | real hrefs x3, `aria-current` for each of 3 selections, labelled group, es, push + default cancelled (2 options), 3 modifier clicks keep default, `scroll={false}`, 44px and no fixed width |
| 2c.3 | `table-toolbar.test.tsx` | Component | N/A (new) | module missing | 22/22 | visible label, GET form and action, hidden fields (no `page`), term follows URL, typing alone is inert, Enter and button, trim and collapse, `%` and `_` untouched, emptied field, maxlength, count for 0, 1, 25, es, updating then count, enabled while pending, focus kept on count change, filter present and absent, group label and wrapping |
| 2c.4 | `table-pagination.test.tsx` | Component | N/A (new) | module missing | 19/19 | bounds table (3 pages), unavailable are `aria-disabled` spans, hrefs for 4 controls, last page from total and size 25, status text, count, "1 of 1" at 20 results size 25, es, push and cancel, first, modifier clicks, select options exactly 10, 25, 50 with current selected, replace for 25 and 50, landmark, 44px, enabled while pending |
| 2c.5/2c.6 | `list-table.test.tsx` | Integration (real provider, router and link stand-ins, real `usersListHref` and `parseUsersListParams`) | N/A (new) | module missing | 23/23 | card order, count, footer for totals 0, 1, 10, 11, 25, page and filter and size hrefs keep the rest, form target, sort new and flip, next page, status, search, size, empty, no-results for term, for status alone, clear href for a fully set state, toolbar kept beside no-results, es, pending busy then idle. Mutation check: replacing `applyListChange` with a plain spread for `size` and `q` failed exactly the search and size tests; restored |
| 2c.7 | n/a | n/a | n/a | n/a | n/a | No third copy of the class strings; nothing changed |
| 2c.8 | n/a | n/a | n/a | n/a | n/a | Seam check below |

Test summary: 3,524 tests in 170 files after this slice (3,437 in 166 after 2b): 87 new tests and 4 new files (the changes in existing test files are additive), all passing. Layers: component (header, filter, toolbar, pagination), integration (list table), unit (parity). Mocks per file: at most three, all through shared modules (`next/navigation`, `next/link`, `list-navigation`).

Assertion-quality note: as in 2b, a limited number of class-level assertions exist where the task names them (44px `h-11`, wrapping `flex-wrap`/`whitespace-normal`, no fixed width, opacity-only dimming). Everything else asserts roles, names, attributes and text.

### 2c.8 Seam check (`rg` plus `codegraph_explore`)

- Nothing under `src` outside `src/components/tables/` and tests imports `@/components/tables/*` (the only textual hit is a comment in `src/test/list-navigation-mock.ts`).
- None of `data-table.tsx`, `data-table-pagination.tsx`, `data-table-search.tsx`, `status-filter.tsx` (root) imports the kit; the kit imports none of them. The two `StatusFilter` components share a name only; `AsignaturasPage` and `DocentesPage` still use the old one.
- `DataTablePagination` still has its six callers (users, asignaturas, docentes pages); untouched.

### New API (for 2d)

- `ListTable<T, K>` props: `columns`, `rows`, `getRowId`, `caption`, `state: ListTableState<K>` (`page`, `q`, `sort`, `size`, optional `status`), `defaultState`, `total`, `hrefFor(state)`, `search { label, placeholder? }`, `empty { message, action? }`, `noResults { title, hint }`. It must render inside `ListNavigationProvider`. `hrefFor={usersListHref}` type-checks as is. The status filter appears when `state.status` is defined.
- Generic strings come from the `tables` namespace (count, updating, page status, first to last, rows per page, clear, status filter labels); list-specific strings (search label, empty and no-results copy, caption) are props.

### Verification at the checkpoint (V)

| Command | Result |
|---|---|
| Focused: `npx vitest run src/components/tables src/i18n` | all passed (8 + files; tables 134 tests) |
| `npm test` | 170 files, 3,524 tests, 0 failed. jsdom prints "Not implemented: navigation to another Document" for modifier-key clicks that leave the default to the browser (noise, not a failure) |
| `npm run typecheck` | PASS (rc 0) |
| `npx eslint src` (JSON output) | 56,279 reports, every one `prettier/prettier` "Delete CR" (pre-existing CRLF); 0 findings of any other kind |
| `npx prettier --check --end-of-line auto` on `src/components/tables`, `src/test`, `src/i18n/catalog-parity.test.ts`, `i18n` | "All matched files use Prettier code style!" |
| `npm run build` | PASS (no consumer imports the kit yet, so it is not in a bundle) |
| `git diff --stat src/app/globals.css` | empty |
| Line endings (byte-level) | `i18n/{es,en}.json` and `catalog-parity.test.ts` stay CRLF (0 bare LF); every other touched or new file is LF as before |

### Authored lines by path (additions + deletions for tracked files; line count for new files)

| Path | Lines |
|---|---|
| `i18n/es.json`, `i18n/en.json` | +33 / -1 each |
| `src/i18n/catalog-parity.test.ts` | +61 / -1 |
| `src/components/tables/sortable-header.tsx` | +14 / -3 |
| `src/components/tables/sortable-header.test.tsx` | +46 |
| `src/components/tables/data-table.test.tsx` | +22 |
| `src/components/tables/client-boundary.test.ts` | +4 |
| `src/components/tables/list-table.tsx` (new) | 176 |
| `src/components/tables/status-filter.tsx` (new) | 66 |
| `src/components/tables/table-pagination.tsx` (new) | 124 |
| `src/components/tables/table-toolbar.tsx` (new) | 122 |
| `src/test/list-navigation-mock.ts` (new) | 29 |
| `src/components/tables/list-table.test.tsx` (new) | 449 |
| `src/components/tables/status-filter.test.tsx` (new) | 148 |
| `src/components/tables/table-pagination.test.tsx` (new) | 269 |
| `src/components/tables/table-toolbar.test.tsx` (new) | 274 |
| **Total** | tracked 219 + new 1,657 = **about 1,876**, against an estimate of 650 to 850 (upper bound +121%; the +25% stop threshold is 1,063). Production about 570 (components 488, header 17, locale files 66), test support 29, tests about 1,280 |

Flagged for the owner. As in earlier slices the overrun was only measurable at the slice seam, so nothing was cut; the single-PR decision (D14) holds. Running total of 1a, 1b, 2a, 2b and 2c: about 7,620 lines. Cause: four component suites with Spanish, pending and modifier-key triangulation, plus an integration suite for `ListTable`, which the estimate did not count separately.

### Locale keys added (identical sets in `es.json` and `en.json`)

- `tables.sort.indicator.{sortable,ascending,descending}` (2c.0)
- `tables.toolbar.label`, `tables.search.submit`
- `tables.filter.{label,active,inactive,all}`
- `tables.count` (ICU plural), `tables.updating`
- `tables.pagination.{region,status,first,previous,next,last}`
- `tables.pageSize.{label,option}`, `tables.clear`

### Deviations from the design and tasks

1. Task 2c.0 is not in the original `tasks.md`; it was added as a ticked line above 2c.1 to record the owner's decision.
2. The no-results state keeps the toolbar (search with the term, status filter, count) in its own card above the state, so the user can refine without leaving; the plain empty state has no toolbar (nothing to search). The task text only fixed the state and the clear link.
3. The clear link goes to `hrefFor(defaultState)`, read literally from "the href with only the default state and page 1": it also resets sort and page size. A friendlier alternative (keep sort and size, clear only `q` and `status`) is a one-line change in `list-table.tsx` and one test; flagged for the owner.
4. `ListTable` takes a `defaultState` prop (not in the design's prop list) so it can tell "filtered" from "empty" and build the clear link without knowing any list's defaults.
5. `TableToolbar` and `TablePagination` additionally render `tables.count` in the footer (DT-PAG-1 asks the footer for the total). The toolbar count stays the only live region.
6. The search cap (100) is a local constant in `table-toolbar.tsx`; the three existing definitions (`USERS_SEARCH_MAX`, catalog) are per-list modules the kit must not import.
7. The page-size control is a native `select` (design decision 6 and design-system "form select at 44px"), not `ui/select.tsx`.
8. The kit's link controls do not use `buttonVariants` (it carries `transition-all` and a press translate, both excluded by design-system rule 6); the toolbar submit still uses `Button size="lg"` as the old search did.
9. Two additive edits to existing tests beyond the task list: `client-boundary.test.ts` lists the four new client modules; `data-table.test.tsx` gained one test for the visible state text (2c.0).
10. A new test-support module `src/test/list-navigation-mock.ts` (29 lines) gives unit tests a controllable `useListNavigation`, in the same pattern as `navigation-mock.ts`; the real provider is exercised by `list-navigation.test.tsx` and the `ListTable` integration test.
11. Slice size is about 1,876 changed lines against the 650 to 850 estimate (see above).

### Not verified (no browser, no real router in this run)

Real pixel size of the 44px controls and the 48px header with the longer content; how the visible state text wraps in a real 320px and 360px viewport (class-level only); that a screen reader reads the header as the label only while `aria-sort` and the description carry the state, without double announcement; the real App Router `next/link` and `onNavigate` (stand-in only, per 0.9); the pending flag and the count region against the real Next router; that `@tanstack/react-table` and the kit land in a client bundle (the first real build proof is 2d, since no page imports them yet); focus retention after a sort when `loading.tsx` shows on a query-only navigation (Gate V1, 2d.5); browser native `select` appearance in both themes and the dark-mode contrast of the muted state text. These belong to the F.4 manual checklist and to 2d.

### Work Unit Evidence (Slice 2c)

| Evidence | Value |
|---|---|
| Focused test command and exact result | `npx vitest run src/components/tables src/i18n`: all passed; full suite 170 files, 3,524 tests |
| Runtime harness | `npm run build` compiled; the kit has no consumer yet, so the runtime path is exercised in jsdom with the real catalogs, the real list-navigation provider, the shared router and link stand-ins and the real users URL builders. No browser run |
| Rollback boundary | Revert `i18n/{es,en}.json` (the `tables` additions), `catalog-parity.test.ts`, `sortable-header.tsx` and its test, the additions to `data-table.test.tsx` and `client-boundary.test.ts`; delete `status-filter`, `table-toolbar`, `table-pagination`, `list-table` (and their tests) in `src/components/tables/` and `src/test/list-navigation-mock.ts`. Nothing outside the slice imports them |

### Suggested commit (owner)

`feat(tables): toolbar, status filter, first and last pagination and page-size selector`

## Batch G: Slice 2d, Users migration (2026-10-12)

Mode: Strict TDD. Delivery: `exception-ok` (single PR, accepted `size:exception`, D14). Tasks 2d.0 (owner decision, added), 2d.1, 2d.2, 2d.3, 2d.4 and 2d.7 done and ticked in `tasks.md`. 2d.5 (gate V1) and 2d.6 (smoke) are NOT done: they need a signed-in session as `administrador` or `secretaria` and no credentials were available (see "Manual tasks"). 2d.8 (CHECKPOINT) is left unticked for the owner. Housekeeping: 2a.12 and 2c.9 ticked (owner commits c0bc25a and e3fc185 exist). Nothing was committed, pushed or branched; no database command, no seed, no migration, no package install were run. `src/app/globals.css` untouched (empty diff). The four OLD root table components and the catalog pages were not edited.

### Owner decision applied first (task 2d.0): the clear link keeps sort and size

Spec check before changing: no scenario states that the clear link equals the all-defaults href. DT-STATE-1 says "a link that clears the search and the filters and returns to page 1"; its scenario "Clear link restores the list" says the unfiltered list is shown from page 1; the users-listing spec says "a control that clears the filter and returns the unfiltered list from page 1"; BS-STATE-1 and CM-LST-1 say "a link / a way to clear". DT-URL-2 lists only changes made by controls. None names sort or size, so there was no conflict and the change was made.

- `list-table.tsx`: the clear href is `hrefFor(applyListChange(state, { q: "", ...(hasStatus && { status: defaultState.status }) }))`. It clears the term and the filter, keeps `sort`, `dir` and `size`, and resets to page 1 through the single reset rule; no href is composed in the component. `defaultState` is now read only for its `status`.
- Test: the old "clears to the default state ... whatever was set" test became "clears only the term and the filter, keeping sort and size, on page 1" (`/users?sort=name&dir=desc&size=25`), plus two new cases (filter-only keeps a non-default sort; term-only keeps the page size). All other `list-table.test.tsx` tests are unchanged and green.
- Deviation record for 2c.5 and Batch F deviation 3: the 2c.5 wording "clear link equals the href with only the default state and page 1" is superseded by this owner decision; the "one-line change" Batch F flagged is the change that was made.

### Tasks

| Task | State | Note |
|---|---|---|
| 2d.0 | done | RED: 3 failed of 25; GREEN 140/140 in `src/components/tables` |
| 2d.1 | done | RED: 5 parity failures; 2 new keys per locale |
| 2d.2 | done | RED: module `users-table` missing; 16 tests |
| 2d.3 | done | `users-table.tsx`; 16/16 |
| 2d.4 | done | RED: 14 failed of 39; GREEN 39/39 |
| 2d.5 | NOT observed (blocked: no credentials) | checklist below |
| 2d.6 | NOT observed (blocked: no credentials) | checklist below |
| 2d.7 | done | seam check below |
| 2d.8 | pending (owner) | Checkpoint; owner commit |

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED (one line) | GREEN | Triangulation / REFACTOR |
|---|---|---|---|---|---|---|
| 2d.0 | `src/components/tables/list-table.test.tsx` | Integration (real provider, link and router stand-ins, real users builders) | 8 files, 137 tests in `src/components/tables` green before | 3 failed: href was `/users` where `/users?sort=name&dir=desc&size=25`, `/users?sort=login&dir=asc` and `/users?size=50` were expected | 140/140 | Three states: term + filter + sort + size + page 4; filter alone with a non-default sort; term alone with size 50 and page 2. The unchanged "term only, defaults" case still yields `/users` |
| 2d.1 | `src/i18n/catalog-parity.test.ts` | Unit | 208 passing before | 5 failed: `users.noResults.titleStatus` and `hintStatus` absent, es and en wording equal (both undefined), title shape | 221/221 in `src/i18n` | `users` joined `GUARDED_SECTIONS` (identical deep key sets, non-empty); every key the table renders is asserted in both locales; the term title carries `{q}`, the status title does not; wording differs per locale |
| 2d.2/2d.3 | `src/app/(dashboard)/users/users-table.test.tsx` | Component (real catalogs, es and en, real provider and kit) | N/A (new) | `Failed to resolve import "@/app/(dashboard)/users/users-table"` | 16/16 | es and en: named table, six fields as text, five buttons named by the catalog labels, exactly five column headers; `aria-sort` on the default column only and following the URL; first activation replaces with the column ascending, second reverses; status links keep `q`, sort and size; footer with last link, and no footer for 2 rows; empty with the new-user action; no-results with term, status-only (en and es) and a clear link that keeps the sort; a row carrying `hashClave`, `cif`, `telefono`, `correo` renders none of them |
| 2d.4 | `src/app/(dashboard)/users/page.test.tsx` | Component (async page, key-echo translators, real `UsersTable` and kit) | 35 passing before | 14 failed: the page still used the old components (rows spy on `UsersTable` never called; clear control named `clear` not `search.clear`; no sort buttons; no first and last; no status-only title) | 39/39 | Guard-first, denied-role, hostile parameters, degraded with every parameter, and the six-field and serialization tests keep their intent (only the spy moved to `UsersTable`); added: status-only no-results with the sort kept, five sortable header buttons, first and last links, paging links built from the clamped page, no search box or clear link when degraded |

Test summary: 3,554 tests in 171 files after this slice (3,524 in 170 after 2c): +30 tests, +1 file, all passing. Layers: unit (parity), component (users table, users page), integration (list table). Mocks in the page test: `@/lib/auth/dal`, `@/lib/data/users`, `next-intl/server`, `next-intl` (key echo), `next/navigation`, `next/link` (shared stand-ins) and a pass-through spy on `UsersTable`. The users table test mocks only the two shared navigation modules.

Assertion-quality note: no class-level assertion was added in this slice.

### 2d.7 Seam check (`codegraph_explore` plus `rg` over `src`, tests excluded)

- `src/app/(dashboard)/users/` imports none of `@/components/data-table`, `data-table-pagination`, `data-table-search`, `status-filter` (`rg` finds no match under the directory).
- Still importing the old components, as intended until 3b, 3c and 3d: `DataTable` by `catalog/asignaturas/page.tsx`, `catalog/docentes/page.tsx`, `asignatura-grupos-section.tsx`, `import-preview.tsx`, `import-errors.tsx`; `DataTablePagination` and `DataTableSearch` by the two catalog list pages; the old `StatusFilter` by the two catalog list pages.
- Codegraph merged the two `StatusFilter` symbols into one name in its blast radius; `table-toolbar.tsx` imports only `@/components/tables/status-filter` (verified by `rg`).
- The new kit's consumer is now `users-table.tsx` (which composes `ListTable`).

### Manual tasks 2d.5 and 2d.6: what was and was not observed

Servers: `next dev -p 3457` was started (ports checked first: nothing listened on 3000 to 3200 or 3457, no `.next/dev/lock`), probed, and stopped by process id (PID 30036 and its children; port 3457 was left with TIME_WAIT sockets only). `npm run build` ran (see V); `npm start` was NOT run because no signed-in session was possible.

Observed (unauthenticated; no database read happened for these):

| Request | Result |
|---|---|
| `GET /users` (dev) | 307 to `/login` in 741 ms: the route guard redirects without a session |
| `GET /login` (dev) | 200 |

NOT observed (blocked: no `administrador` or `secretaria` credentials available to this executor; none were invented, searched for or bypassed):

- Gate V1 (2d.5, N8): whether `(dashboard)/loading.tsx` re-shows on a query-only navigation (sort click, page-size change) in `next dev` AND in `npm run build` + `npm start`. Outcome: UNOBSERVED. The contingency (module-level "last control id" in `list-navigation.tsx`, RED test first) is NOT implemented and stays conditional on the owner observing that the skeleton does show.
- Smoke (2d.6): the whole list below.

Owner observation checklist (run as `administrador`, then as `secretaria`; record only what you see; no database write is involved):

1. V1: open `/users` with at least 11 users. Click a sortable header, then change rows per page. Does the full-page skeleton (`loading.tsx`) appear, or do the previous rows stay with the dimmed "Updating..." state? Repeat in the production build (`npm run build`, then `npm start` on a free port). If the skeleton DOES appear: does keyboard focus stay on the header button or the select after the update? (If not, the 2d.5 contingency is needed.)
2. Sort cycle: click "Name": ascending (`?sort=name&dir=asc`), click again: descending (`dir=desc`). The sorted header shows its direction word; the others show "Sortable". Reload keeps the order.
3. Status filter: Active, Inactive and All keep `q`, sort and size; the page returns to 1; the selected option is marked.
4. Page size 25 and 50 (replaces the history entry, page 1), first and last controls, the footer absent at 10 rows or fewer.
5. Search by an e-mail fragment: a user whose e-mail matches is listed, and no e-mail appears in the row or the page source.
6. No results: a term with no match shows the no-results state with the toolbar above it; "Clear filters" keeps the current sort and size and drops the term and the status (owner decision 2d.0).
7. Back button: sort and page size replace (one Back leaves the list); page, status and search push (Back returns to the previous view).
8. As `secretaria`: only `docente` users in the list and in the total, under every sort and filter.
9. Narrow viewport (360px): the sort-state text wraps inside the header, no horizontal page scroll, the table scrolls inside its card.

### First real client-bundle proof of `@tanstack/react-table`

Until now no page imported the kit, so no build bundled the dependency. After this slice `npm run build` compiles with the kit reachable from `/users`:

- `.next/static/chunks/0irpzc356fo5q.js` (62,252 bytes) contains the TanStack core (`getCoreRowModel` x13, `getHeaderGroups` x6, `getRowModel` x11, `getIsSorted` x3, `manualSorting` x2); no other client chunk contains those names.
- `.next/server/app/(dashboard)/users/page_client-reference-manifest.js` references both `users-table.tsx` and that chunk, and no other route manifest references the chunk, so the library is loaded only by the users route.
- No build warning; the only `react-hooks/incompatible-library` exception is the justified directive already in `data-table.tsx`.

### Verification at the checkpoint (V)

| Command | Result |
|---|---|
| Focused: `npx vitest run "src/app/(dashboard)/users" src/components/tables src/i18n src/test` | all passed |
| `npm test` | 171 files, 3,554 tests, 0 failed. No flaky failure seen (see deviation 5 for the one hang found and fixed) |
| `npm run typecheck` | PASS (rc 0) after one fix: a leaky test fixture cast needed `as unknown as UserRow[]` (vitest does not typecheck) |
| `npx eslint src` (JSON output) | 56,301 reports, every one `prettier/prettier` "Delete CR" (pre-existing CRLF); 0 findings of any other kind |
| `npx prettier --check --end-of-line auto` on `src/app/(dashboard)/users`, `src/test`, `src/components/tables`, `src/i18n`, `i18n` | "All matched files use Prettier code style!" (after one `--write` of the parity test) |
| `npm run build` | PASS, `Compiled successfully`, 22 dynamic routes, `/users` among them |
| `git diff --stat src/app/globals.css` | empty |
| Line endings (byte-level check) | `i18n/{es,en}.json`, `catalog-parity.test.ts`, `users/page.tsx`, `users/page.test.tsx` stay CRLF (0 bare LF); new files, `list-table.tsx`, `list-table.test.tsx` and `intl.tsx` are LF as in earlier slices |

### Authored lines by path (additions / deletions for tracked files with `--ignore-cr-at-eol`; line count for new files)

| Path | Lines |
|---|---|
| `src/components/tables/list-table.tsx` | +14 / -2 |
| `src/components/tables/list-table.test.tsx` | +31 / -2 |
| `i18n/es.json`, `i18n/en.json` | +2 each |
| `src/i18n/catalog-parity.test.ts` | +63 |
| `src/app/(dashboard)/users/page.tsx` (rewritten) | +22 / -162 |
| `src/app/(dashboard)/users/page.test.tsx` | +106 / -7 |
| `src/test/intl.tsx` | +3 / -16 (key echo moved out) |
| `src/app/(dashboard)/users/users-table.tsx` (new) | 134 |
| `src/app/(dashboard)/users/users-table.test.tsx` (new) | 281 |
| `src/test/key-echo-intl.ts` (new) | 22 |
| **Total** | tracked 432 (additions + deletions) + new 437 = **about 869**, against an estimate of 450 to 550 (upper bound +58%; the +25% stop threshold is 688). About 480 lines are tests |

Flagged for the owner. The overrun was only measurable at the slice seam, so nothing was cut; the single-PR decision (D14) holds. Cause: a 281-line component suite in two locales and the page-test additions, none of which the estimate counted separately. Running total of 1a, 1b, 2a, 2b, 2c and 2d: about 8,490 lines.

### Locale keys added (identical sets in `es.json` and `en.json`)

- `users.noResults.titleStatus` ("No hay usuarios con este filtro." / "There are no users with this filter.")
- `users.noResults.hintStatus` ("Prueba con otro estado o quita los filtros." / "Try another status or clear the filters.")
- `GUARDED_SECTIONS` gained `users`.
- Reused: `users.columns.*`, `users.status.*`, `users.tableCaption`, `users.search.label`, `users.search.placeholder`, `users.empty`, `users.newButton`, `users.noResults.title`, `users.noResults.hint`, `users.degraded`.
- Now unused (left in place for the 3d.9 sweep): `users.search.submit`, `users.search.clear`, `users.count`, `users.pagination.*`. The kit uses `tables.*` for those.

### Deviations from the design and tasks

1. Task 2d.0 is not in the original `tasks.md`; it was added as a ticked line above 2d.1 to record the owner decision (same pattern as 2c.0). It supersedes the 2c.5 wording note above.
2. `UsersTable` takes `{ rows, total, state }` and imports `parseUsersListParams` (for the default state) and `usersListHref` (as `hrefFor`) itself, because function props cannot cross the server boundary. The page passes `{ ...state, page: result.page }` so paging links use the page the read clamped to.
3. `UserRow` is exported from `users-table.tsx` (the page type moved next to the table, as 2a deviation 6 planned).
4. The role cell still shows the stored role code (UL:sort: "the displayed role code") with the existing `capitalize` class, not the `roles.*` labels; unchanged from the old page.
5. Test-helper fix: `keyEchoIntl` (2b) deadlocked when installed as documented, because `vi.mock("next-intl", async () => (await import("@/test/intl")).keyEchoIntl)` makes the factory import a module that itself imports the mocked `next-intl`; the page test hung until the 60 s hook timeout. It now lives in `src/test/key-echo-intl.ts` (no `next-intl` import) and `@/test/intl` re-exports it, so `intl.test.tsx` is unchanged. No earlier test had installed it.
6. The users page test replaced the old `DataTable` spy with a spy on `UsersTable`; the "keeps the es and en users-list keys in sync" test kept its prefixes (including the now unused `search.`, `count`, `pagination.`), so it still passes and will need a trim at 3d.9.
7. The delivered-fields guarantee is now proven at two points: the page spy (exactly six keys, serialization) and a component test that a leaky row renders none of the four forbidden values.
8. Tasks 2d.5 and 2d.6 stay unticked (no credentials); 2d.8 is the owner checkpoint.
9. Slice size is about 869 changed lines against the 450 to 550 estimate (see above).

### Not verified (no credentials, no browser, no database writes in this run)

Gate V1 (skeleton on a query-only navigation, in dev and in the production build) and focus retention after it; the whole smoke list above; that Postgres accepts the `collate "es-x-icu"` ordering and returns "Álvaro, angel, Beatriz, Zoe" in that order (carried over from 2a); stable pagination across equal values against real data; the real App Router `next/link` and `onNavigate` and the pending flag against the real router (stand-ins only, per 0.9); real pixel sizes, 320px and 360px wrapping of the visible sort state, focus ring, dark mode contrast. These belong to the owner checklist above and to F.4.

### Work Unit Evidence (Slice 2d)

| Evidence | Value |
|---|---|
| Focused test command and exact result | `npx vitest run "src/app/(dashboard)/users" src/components/tables src/i18n src/test`: all passed; full suite 171 files, 3,554 tests |
| Runtime harness | `npm run build` compiled with the kit in the `/users` client bundle; `next dev -p 3457` answered `/users` with 307 to `/login` and `/login` with 200 (unauthenticated only). Signed-in runtime path unobserved (no credentials) |
| Rollback boundary | Revert `users/page.tsx` and `users/page.test.tsx`, `list-table.tsx` and `list-table.test.tsx` (the clear-link change), `i18n/{es,en}.json` (2 keys), `catalog-parity.test.ts` (the `users` guard and its describe) and `src/test/intl.tsx`; delete `users-table.tsx`, `users-table.test.tsx` and `src/test/key-echo-intl.ts`. Nothing outside the slice imports them |

### Suggested commit (owner)

`feat(users): TanStack list with sorting, status filter and page-size selector`
