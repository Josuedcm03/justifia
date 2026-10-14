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

## Batch H: Slice 3a (Catalog URL contract and data layer)

Mode: Strict TDD. Tasks 3a.2 to 3a.7 done and ticked; 3a.1 was already ticked (OC-6 answered: alphabetical, `TEXT_SORT_COLLATION` for the docentes `name` default). 3a.8 CHECKPOINT left unticked for the owner.

### TDD evidence

| Task | RED | GREEN |
|---|---|---|
| 3a.2 / 3a.3 | `src/lib/catalog/list-params.test.ts`: suite failed at import (new parsers and key tables undefined) | `src/lib/catalog/list-params.ts`: 53 tests pass; compile-time pin for a foreign sort key |
| 3a.4 / 3a.5 | `src/lib/data/asignaturas.test.ts`: 11 failures (sort map, default order plus `id`, `sort` not a known property) | `src/lib/data/asignaturas.ts`: 92 tests pass |
| 3a.6 / 3a.7 | `src/lib/data/users.test.ts` (`listDocentes`): 11 failures (collated default, sort map, `sort` not a known property) | `src/lib/data/users.ts`: whole file passes |

Refactor: none needed beyond a shared `parseCatalogState` helper written during GREEN. The tests stay DB-free (recording `db` doubles and `PgDialect.sqlToQuery`).

### What changed

- `list-params.ts`: `ASIGNATURAS_SORT_KEYS` (code, name, hours, status), `DOCENTES_SORT_KEYS` (name, login, email, status), their default sorts, `CatalogListState<K>`, `parseAsignaturasListParams`, `parseDocentesListParams`, and `catalogListHref` extended with `sort` and `size` (defaults per base omitted; `sort` and `dir` written together, order `q`, `status`, `sort`, `dir`, `size`, `page`; a sort key of the other list is a compile error). `CATALOG_PAGE_SIZE` and `parseCatalogListParams` untouched.
- `asignaturas.ts`: `ASIGNATURAS_SORT_MAP` (name collated, code and hours plain, status active first) and `orderByFor`; `listAsignaturas` takes an optional `sort`. Default order is `Codigo asc, Id asc`. `listMatchingGrupos` and the search predicates are untouched (D3).
- `users.ts`: `DOCENTES_SORT_MAP` (name and login collated, email `nullif(...) nulls last`, status active first) and `orderByFor`; `listDocentes` takes an optional `sort`. Default order is now `name collate "es-x-icu" asc, Id asc`.
- Existing assertions updated: the old "orders by Codigo" test now also expects the `Id` tie-break; the old docentes "orders by name" test now expects the collated name.

### Authored lines by path (git diff --stat, additions / deletions)

| Path | Lines |
|---|---|
| `src/lib/catalog/list-params.ts` | +103 / -8 |
| `src/lib/catalog/list-params.test.ts` | +220 |
| `src/lib/data/asignaturas.ts` | +35 / -1 |
| `src/lib/data/asignaturas.test.ts` | +139 / -1 |
| `src/lib/data/users.ts` | +30 / -2 |
| `src/lib/data/users.test.ts` | +107 / -1 |
| **Total** | 634 added, 13 removed (647 changed), against an estimate of 350 to 450 (+25% = 563): about 13% over the +25% threshold and 41% over the 450 upper bound. About 468 lines are tests |

Cause: the parameterised order tables (8 rows per list), the fallback table, and two locales-free but table-driven href and clamp cases; each was asked for by 3a.2, 3a.4 and 3a.6. Prettier also expands long `it.each` rows. Running total of 1a to 3a: about 9,120 lines.

### Deviations

1. `sort` is optional on `listAsignaturas` and `listDocentes` (users made it required). The catalog pages must keep ignoring `sort` and `size` until 3b and 3c, and an omitted `sort` is exactly today's order; 3b and 3c may make it required once the pages pass it.
2. `pageSize` stays `number` (not `PageSize`) in both list functions: the pages still pass `CATALOG_PAGE_SIZE`, and the parser already narrows `size` to 10, 25 or 50.
3. `catalogListHref` is generic on the base so a sort key of the other list fails to compile; the existing `/catalog/grupos` compile-time pin still holds.
4. The docentes default order changed in SQL (collated) as decided in OC-6 (3a.1). The page still ignores `sort`, so users see the default order only, now alphabetical.
5. The "extra parameters ignored" test spreads an untyped object, because `listAsignaturas` has no parameter that could carry a Carrera other than `scope`.

### Not verified (no database writes, no browser)

That PostgreSQL accepts `collate "es-x-icu"` on `"Asignatura"."Nombre"` and `"Usuario"."Login"` and returns accented names in alphabetical order (SQL text proven only; same carry-over as 2a); that `nullif(...) nulls last` orders real data as specified; stable pagination across equal values against real data; any rendering (3a changes no component).

### V results

`npm test` 171 files, 3,618 tests pass; `npm run typecheck` clean; `npx eslint src` only CRLF `prettier/prettier` findings; `npx prettier --check --end-of-line auto` on the six touched paths clean; `npm run build` compiles; `git diff --stat src/app/globals.css` empty. Source files kept CRLF (verified by byte count); the two OpenSpec files are LF.

### Suggested commit (owner)

`feat(catalog): validated sort and page-size parameters and whitelisted catalog orderings`

## Batch I: Slice 3b (Asignaturas list)

Mode: Strict TDD. Tasks 3b.1 to 3b.5 done and ticked. 3b.6 CHECKPOINT left unticked: V passed, but its [MANUAL] smoke needs a signed-in session and the real database.

### TDD evidence

| Task | RED | GREEN |
|---|---|---|
| 3b.1 | `catalog-parity.test.ts` new describe: suite failed at import (ENOENT on `asignaturas-table.tsx`; the scan of table and page keys had nothing to read) | table and page exist; 242 tests pass across the parity and table files. No locale key was added (see deviation 1) |
| 3b.2 / 3b.3 | `asignaturas-table.test.tsx`: suite failed at import (module missing) | `asignaturas-table.tsx`: all 24 test runs pass (es and en) |
| 3b.4 | `page.test.tsx` updates run against the old page (temporarily restored from HEAD): 17 failures (sort and size not passed, hostile values, no-results clear link, status filter group, pagination, count, header buttons) | new `page.tsx`: 51 tests pass |
| 3b.5 | characterization: `current-marker-usage.test.ts` and the breadcrumb pins pass unchanged; `asignatura-grupos-section.tsx` still imports the old `@/components/data-table` | n/a |

Refactor: none needed; the table mirrors `users-table.tsx`.

### What changed

- `asignaturas-table.tsx` (new, client): `AsignaturaRow` (a `Pick` of `AsignaturaListItem`, no `carreraId`), columns `code`, `name` (with the matching-groups list), `career`, `hours`, `groups`, `status`, `actions`; `enableSorting: true` only on code, name, hours and status; `ListTable` inside `ListNavigationProvider`; hrefs from `catalogListHref`; the groups cell keeps `grupos || "-"` and the edit link keeps its `edit + codigo` name.
- `page.tsx`: `parseAsignaturasListParams`, `sort` and `size` passed to `listAsignaturas` (`pageSize: state.size`), rows picked field by field, `PageFrame`, `DegradedAlert`, the page clamped by the read. The no-Carrera state keeps its own section and has no action.
- `page.test.tsx`: navigation and link stand-ins added; new cases for sort and size forwarding, hostile values, scope never widened, clear link keeping sort and size, degraded with sort and size; old cases that asserted the retired controls were rewritten for the new ones.
- `catalog-parity.test.ts`: one describe scanning the keys the table and the page choose.
- Untouched on purpose: `AsignaturaGruposSection`, `DiasCell`, the old table components, `globals.css`, both locale files.

### Authored lines by path (git diff --numstat, additions / deletions)

| Path | Lines |
|---|---|
| `asignaturas-table.tsx` | +194 |
| `asignaturas-table.test.tsx` | +434 |
| `page.tsx` | +47 / -226 |
| `page.test.tsx` | +144 / -36 |
| `catalog-parity.test.ts` | +82 |
| **Total** | 901 added, 262 removed, against an estimate of 600 to 750 (+25% = 938): 20% over the upper bound and under the +25% threshold. About 660 lines are tests |

Running total of 1a to 3b: about 10,020 lines added.

### Deviations

1. No new locale key. The existing `catalog.asignaturas.noResults.hint` already says "or change the status filter", so it serves the term and the status-only no-results; `noResults.titleStatus` already existed. The parity test pins that the hint names the status filter. Unused keys (`search.submit`, `search.clear`, `count`, `pagination.*`, `catalog.shared.filter`) stay until the 3d.9 sweep; the existing `LIST_KEYS` pin is unchanged.
2. The 3b.1 RED is a whole-file failure of `catalog-parity.test.ts` (the source scan reads the table file), not a per-test failure.
3. The page test uses the real catalogs on the server and the client provider (as before) instead of key echo, so copy assertions stayed real.
4. `sort` is passed explicitly, but stays optional on `listAsignaturas` (3a decision).
5. The count text now comes from `tables.count` ("1 result"), no longer `catalog.asignaturas.count` ("1 subject").
6. New files are LF (like `users-table.tsx`); `page.tsx`, `page.test.tsx` and `catalog-parity.test.ts` kept CRLF (verified by byte count).

### Not verified

Rendering in a browser (sort cycle, status filter, page size, first and last, 320 and 360 px); that the real database accepts the collated `name` order from the page (carry-over from 3a). An attempt to start `next dev` on port 3917 for the unauthenticated redirect check never became reachable, so it was abandoned and no process was left running.

### [MANUAL] smoke checklist for the owner (3b.6)

Signed in as `coordinacion` and as `secretaria`, on `/catalog/asignaturas`:

1. Click Code, Name, Hours, Status headers: first click ascending, second descending; the state word is visible and the URL gets `sort` and `dir`; Career, Groups and Actions have no button.
2. Status filter Active / Inactive / All keeps the sort and size and returns to page 1.
3. Page size 10 / 25 / 50 and First / Previous / Next / Last; the footer is hidden when the total fits 10.
4. Search a docente or period: matching groups listed under the name; a search with no match shows the no-results state and "Clear filters" keeps sort and size.
5. As `coordinacion`, `?carreraId=9&scope=all` shows only the own Carrera.
6. The Edit link of each row opens the edit page; "New" is available and, with an empty catalog, the empty state offers it.

### V results

`npm test` 172 files, 3,658 tests pass; `npm run typecheck` clean; `npx eslint src` reports only CRLF `prettier/prettier` findings (0 of any other rule, checked from the JSON output); `npx prettier --check --end-of-line auto` on the five touched paths clean; `npm run build` compiles; `git diff --stat src/app/globals.css` empty.

### Suggested commit (owner)

`feat(catalog): TanStack asignaturas list with sorting and page-size selector`

## Batch J: Slice 3c (Docentes list)

Mode: Strict TDD. Tasks 3c.1 to 3c.5 done and ticked. 3c.6 CHECKPOINT left unticked: V passed, but its [MANUAL] smoke needs a signed-in session and the real database.

### TDD evidence

| Task | RED | GREEN |
|---|---|---|
| 3c.1 | `catalog-parity.test.ts` Docentes describe now scans `docentes-table.tsx` and `page.tsx`: whole-file failure (ENOENT on the missing table) | table exists; 222 parity tests pass. No locale key was added (see deviation 1) |
| 3c.2 / 3c.3 | `docentes-table.test.tsx`: suite failed at import (module missing) | `docentes-table.tsx`: 18 test runs pass (es and en) |
| 3c.4 | `page.test.tsx` updates against the old page: 20 failures (sort and size not passed, hostile values, header buttons, count, pagination, clear link, status filter group) | new `page.tsx`: whole file passes |
| 3c.5 | characterization with `codegraph_explore` and `rg` (below) | n/a |

Refactor: none needed; the table mirrors `asignaturas-table.tsx`.

### What changed

- `docentes-table.tsx` (new, client): `DocenteRow` (a `Pick` of `DocenteListItem`, five fields), columns `name`, `login`, `email`, `status`, all `enableSorting: true`; the empty Correo renders the existing `noEmail` text; `ListTable` inside `ListNavigationProvider`; no action column and no empty-state action (read-only); hrefs from `catalogListHref`.
- `page.tsx`: `parseDocentesListParams`, `sort` and `size` passed to `listDocentes` (`pageSize: state.size`), rows picked field by field, `PageFrame`, `DegradedAlert`, the page clamped by the read, the `/users` link kept in the header; the inline empty/no-results block is gone. No Carrera scope is read.
- `page.test.tsx`: navigation and link stand-ins; cases for sort and size forwarding, default order, nine hostile values, valid key with a bad direction, unscoped query for a `coordinacion` actor, the clear link keeping sort and size, degraded with sort and size showing only the alert.
- `catalog-parity.test.ts`: the Docentes source scan now covers table and page, plus a pin that the no-results hint names the status filter.
- Untouched on purpose: old table components, `globals.css`, both locale files, `docs/roadmap.md`.

### 3c.5 consumer check

- `parseCatalogListParams` and `CATALOG_PAGE_SIZE`: no consumer left outside `src/lib/catalog/list-params.ts` and its own test (`list-params.test.ts`). The import preview does not use them. Left for 3d.12 as one deletion.
- `catalogListHref`: the old three-field call shape is a subset of the new signature, so no old call site needed a change; remaining non-test consumers are the two new tables and pages plus the old `src/components/status-filter.tsx` (typed by `CatalogListBase`), which 3d deletes.

### Authored lines by path (additions / deletions)

| Path | Lines |
|---|---|
| `docentes-table.tsx` | +128 |
| `docentes-table.test.tsx` | +324 |
| `page.tsx` | +23 / -149 |
| `page.test.tsx` | +135 / -33 |
| `catalog-parity.test.ts` | +51 / -11 |
| **Total** | 661 added, 193 removed, against an estimate of 450 to 550 (+25% = 688): 20% over the upper bound, under the +25% threshold. About 510 lines are tests |

Running total of 1a to 3c: about 10,680 lines added.

### Deviations

1. No new locale key. Every key the table and page choose already existed (`columns.*`, `noEmail`, `empty`, `noResults.*`, `tableCaption`, `search.label`, `search.placeholder`, `degraded`, `usersLink`). `search.submit`, `search.clear`, `count`, `pagination.*` and `catalog.shared.filter` are now unused and wait for the 3d.9 sweep.
2. The "link to /users kept" assertion of 3c.2 lives in `page.test.tsx` (the link belongs to the page header, not the table); the table test asserts there is no link or control in the body and no create action in the empty state.
3. The count text now comes from `tables.count` ("1 result"), no longer `catalog.docentes.count` ("1 teacher").
4. `sort` is passed explicitly but stays optional on `listDocentes` (3a decision).
5. New files are LF; `page.tsx`, `page.test.tsx` and `catalog-parity.test.ts` kept CRLF (verified by byte count).
6. The "Docentes page chooses only keys" parity test used a regex written through a shell heredoc that lost its escapes; fixed before GREEN.

### Not verified

Rendering in a browser (sort cycle, status filter, page size, first and last, 320 and 360 px); that the real database orders the `email` column with empty Correo last and the collated `name` order (carry-over from 3a); an unauthenticated redirect check was not attempted (no dev server started, as instructed).

### [MANUAL] smoke checklist for the owner (3c.6)

Signed in as `administrador`, `coordinacion` and `secretaria`, on `/catalog/docentes`:

1. Click Name, Username, Email, Status headers: first click ascending, second descending; the state word is visible and the URL gets `sort` and `dir`.
2. Sort by Email ascending and descending: teachers without an email ("No email") appear last in both directions.
3. Default order is alphabetical (accented and lowercase-initial names in their alphabetical place).
4. Status filter Active / Inactive / All keeps sort and size and returns to page 1.
5. Page size 10 / 25 / 50 and First / Previous / Next / Last; the footer is hidden when the total fits 10.
6. Search by name or email: a no-match search shows the no-results state and "Clear filters" keeps sort and size.
7. As `coordinacion` of a Carrera, the list is the same as for `administrador` (not scoped); no create, edit or deactivate control exists; the "Manage accounts in Users" link opens `/users`.

### V results

`npm test` 173 files, 3,692 tests pass; `npm run typecheck` clean; `npx eslint src` reports only `prettier/prettier` findings (CRLF noise; no finding of any other rule, checked from the JSON output); `npx prettier --check --end-of-line auto` on the five touched paths clean; `npm run build` compiles; `git diff --stat src/app/globals.css` empty.

### Suggested commit (owner)

`feat(catalog): TanStack docentes list with sorting, email-last ordering and page-size selector`


## Batch K: Slice 3d (Bounded tables and removal of the old components)

Mode: Strict TDD. Tasks 3d.1 to 3d.11 done and ticked. 3d.12 CHECKPOINT left unticked for the owner commit: V passed (below). Nothing committed, staged, pushed or run against the database.

### TDD evidence

| Task | RED | GREEN |
|---|---|---|
| 3d.1 / 3d.2 | `asignatura-grupos-table.test.tsx`: suite failed at import (module missing) | `asignatura-grupos-table.tsx`: 13 test runs pass (es and en) |
| 3d.3 | `asignatura-grupos-section.test.tsx`: 6 of 7 failed against the old section (function props and labels shape: `TypeError` reading `labels.columns.periodo`) | new section: 7 pass; the 64 edit page tests still pass; one wiring test added to `[id]/edit/page.test.tsx` |
| 3d.4 | `import-preview.test.tsx` new describe: 3 failures (`scope="col"` absent on the legacy `DataTable` headers) | `import-preview.tsx` on the bounded `DataTable`: all pass |
| 3d.5 | `import-errors.test.tsx` new describe: 1 failure (`scope="col"`); the order, row 0 dash, reason text and four-column assertions passed at once (characterization of today's behavior) | `import-errors.tsx` migrated: all pass |
| 3d.6 | consumer check (below) | n/a |
| 3d.7 | characterization update, run GREEN before deleting | 10 pass |
| 3d.8 | `npm test` right after deleting: 171 files, 3,686 tests, no stale reference | n/a |
| 3d.9 | `catalog-parity.test.ts`: key-list pins for asignaturas and docentes shortened and a "retired list copy" test added: 6 failures | keys removed from both locale files: 232 i18n tests pass |
| 3d.10 | tests of `parseCatalogListParams` and `CATALOG_PAGE_SIZE` ported to the two new parsers first (status, page, q, round trip) | symbols removed; 147 catalog lib tests pass |
| 3d.11 | `src/components/tables/structure.test.ts` written as a pin (characterization, cannot be RED) | 5 pass |

Refactor: none beyond the migrations. `ErrorsTable` and `CountsTable` build their columns in `useMemo` like the list tables.

### What changed

- `asignatura-grupos-table.tsx` (new, client): `GrupoRow` is a `Pick` of `GrupoListItem` (six fields); props `{ rows, asignaturaId, caption }`; headers, status labels, edit label and day names come from `useTranslations`; `DiasCell` called unchanged; bounded `DataTable` (no `sorting`).
- `asignatura-grupos-section.tsx`: still a server component. `AsignaturaGruposLabels` shrank to `title, add, empty, inactiveHint, tableCaption, truncated, degraded`; `edit`, `editLabel`, `columns`, `statusActive`, `statusInactive`, `diasNotSet`, `diaShort` and `diaLong` no longer travel. The rows are picked field by field. The inline degraded paragraph is now the shared `DegradedAlert` (BS-STATE-2 "Used inside a section").
- `[id]/edit/page.tsx`: the two extra translators and the function props are gone.
- `import-preview.tsx` (`CountsTable`) and `import-errors.tsx` (`ErrorsTable`): moved from the legacy `DataTable` to `src/components/tables/data-table.tsx` in bounded mode. Figures, layout, row key and order unchanged. Header cells now carry `scope="col"`, which the legacy component did not write.
- `current-marker-usage.test.ts` (R7): scans `src/components/tables/status-filter.tsx` and `tables/table-toolbar.tsx` instead of the two legacy files; the four-breadcrumb `.is-current` pin is untouched.
- Deleted: `src/components/{data-table,data-table-pagination,data-table-search,status-filter}.tsx` and their four tests. The pre-existing flaky `data-table-search.test.tsx` disappears with its component.
- i18n: 25 leaf keys removed from each of `es.json` and `en.json` (identical set): `users.search.submit`, `users.search.clear`, `users.count`, `users.pagination.*`, `catalog.asignaturas.{search.submit,search.clear,count,pagination.*}`, `catalog.docentes.{search.submit,search.clear,count,pagination.*}`, `catalog.shared.filter.*`. `GUARDED_SECTIONS` unchanged (no section disappeared).
- `src/lib/catalog/list-params.ts`: removed `parseCatalogListParams`, `CATALOG_PAGE_SIZE`, the private `parseStatus` and the `USERS_PAGE_SIZE` import.

### 3d.6 consumer check

`codegraph_explore` over the four legacy symbols reported callers only in their own tests; it also listed four callers of the legacy `StatusFilter` in `src/components/tables/table-toolbar.tsx`, a name collision with `src/components/tables/status-filter.tsx`. An `rg` over `src` confirmed it: `table-toolbar.tsx` imports `@/components/tables/status-filter`; the only imports of `@/components/{data-table,data-table-pagination,data-table-search,status-filter}` were the four tests deleted in 3d.8. `DataTableColumn`, `getRowKey`, `DataTableSearch` and `DataTablePagination` have no reference left in `src`.

### 3d.9 evidence per key

Each removed key had no `t("...")`, `getTranslations` or literal reference in `src` outside `catalog-parity.test.ts` and `src/test/intl.test.tsx` (the latter uses its own key echo). Checked with `rg` for `search.submit`, `search.clear`, `("count"` (the surviving hits are `tables.count` in the toolbar and pagination and `catalog.import.credentials.count`), `pagination.`, `shared.filter` and `filter.`. Kept on purpose: `search.label`, `search.placeholder` (read by the three list tables), every `noResults.*`, `tableCaption`, `degraded`.

### 3d.10 consumers

`codegraph_explore` and `rg`: `parseCatalogListParams` and `CATALOG_PAGE_SIZE` were referenced only by `src/lib/catalog/list-params.ts` and its test. Both removed with their tests (behavior moved to the two new parsers, see the TDD table). `catalogListHref`, `ASIGNATURA_GRUPOS_MAX` and `CATALOG_OPTIONS_MAX` stay (live consumers).

### 3d.11 DT-DENS-1 "Header height" and BS-MOT-1 "No `all` transitions"

Pinned by `src/components/tables/structure.test.ts` over every non-test source of `src/components` and `src/app`:

- `rg -n "transition-all|transition:\s*all" src/components src/app` finds `src/components/ui/button.tsx:8` and `src/components/ui/sidebar.tsx:293` only, besides tests asserting absence. Both are vendored shadcn primitives that this change does not touch and are not shell components; the pin lists them and fails on any other file. The shell files named by BS-MOT-1 (`theme-toggle`, `dashboard-header`, `app-sidebar`) stay clean (`shell-motion.test.ts`). Replacing the two primitives' `transition-all` is not done here.
- Header: `TableHead` carries `h-12 px-6`; the sortable button is `min-h-11` inside it; no column `meta.className` sets a height or padding.
- Not pinned: `active:translate-y-px` on the vendored `Button` is a 1px nudge, not a scale; Q7 forbids scale only.

### Authored lines by path (additions / deletions)

| Path | Lines |
|---|---|
| `asignatura-grupos-table.tsx` | +119 |
| `asignatura-grupos-table.test.tsx` | +189 |
| `asignatura-grupos-section.tsx` | +25 / -92 |
| `asignatura-grupos-section.test.tsx` | +202 |
| `[id]/edit/page.tsx` | -21 |
| `[id]/edit/page.test.tsx` | +57 |
| `import-preview.tsx` | +25 / -18 |
| `import-preview.test.tsx` | +47 |
| `import-errors.tsx` | +45 / -38 |
| `import-errors.test.tsx` | +59 |
| `current-marker-usage.test.ts` | +3 / -3 |
| `catalog-parity.test.ts` | +27 / -19 |
| `list-params.ts` | +1 / -24 |
| `list-params.test.ts` | +20 / -46 |
| `i18n/en.json`, `i18n/es.json` | +5 / -38 each |
| `src/components/tables/structure.test.ts` | +84 |
| **Deleted files (8)** | **-874** (`data-table` 90 + 124, `data-table-pagination` 76 + 129, `data-table-search` 73 + 195, `status-filter` 53 + 134) |
| **Total** | 913 added (plus 5 in each locale file counted), 337 removed, 874 in deleted files |

Against the 1,100-1,300 estimate (about 780 deletions) the slice is over the +25% threshold (1,625) if counted as added + deleted-file lines (1,787, +37% over the upper bound); counted as added plus removed (1,250) it is inside the range. Deletions were about 94 lines more than estimated (874 against about 780). Roughly 640 of the added lines are tests. Running total of 1a to 3d: about 11,590 lines added.

### Deviations

1. `ErrorsTable` row id stays the old composite key (no index) to keep rendering identical; two identical error rows would still share a key, as before.
2. The RED of 3d.4 and 3d.5 is `scope="col"` plus static-control assertions, because the legacy and the bounded table render the same text and columns; the spec's content scenarios were already satisfied and are pinned as characterization.
3. `git rm` was used briefly and then un-staged: the eight deletions are working-tree deletions only; the index is untouched.
4. `[id]/edit/page.test.tsx` gained one wiring test (section props are data and strings only) written after the page change; the section test carries the RED for that behavior.
5. The catalog list parsers read `page` and `q` through `firstValue` (3a decision, same as the users parser), so a repeated `q` takes its first value; the retired `parseCatalogListParams` returned an empty term for an array. Not changed here; flagged.
6. Files: new files are LF; the modified source and test files and both locale files kept CRLF (verified by byte count). Prettier `--write --end-of-line auto` was run on three files.
7. `DegradedAlert` replaced the inline degraded paragraph of the section (same classes, same `role="status"`); not a listed task step but required by BS-STATE-2 "Used inside a section".

### Not verified

Rendering in a browser (Grupos table at 320 and 360 px, import preview and errors panel); `npx eslint src` reports only `prettier/prettier` findings (CRLF noise, checked from JSON output: no other rule); the `data-table-search.test.tsx` flake is gone with its file, so its cause was not diagnosed. One run of `vitest run "src/app/(dashboard)/catalog"` made under load (concurrent with prettier and the build) showed 1 failed test that did not reproduce in three later runs and two full runs; the failing name was not captured.

### V results

`npm test` 172 files, 3,691 tests pass; `npm run typecheck` clean; `npx eslint src` only `prettier/prettier`; `npx prettier --check --end-of-line auto` on all touched paths clean; `npm run build` compiles all routes; `git diff --stat src/app/globals.css` empty.

### Suggested commit (owner)

`refactor(tables): bounded TanStack tables for grupos and import, remove legacy table components`

## Batch L: Final phase (2026-10-13)

Mode: documentation and verification only. No production code, no test file, no locale file, no `globals.css`, no spec and no `docs/roadmap.md` was edited. Nothing was committed, staged, pushed, branched or installed; no database command was run and no dev server was started. Tasks F.1, F.2, F.3 and F.7 are done. F.4, F.5, F.6 and F.8 are untouched (owner). Housekeeping: 3a.8 (commit `ef14c81`) and 3d.12 (commit `b4178c6`) ticked in `tasks.md`; 2d.5, 2d.6, 3b.6 and 3c.6 stay unticked (manual, owner). 2d.8 also stays unticked because its V1 outcome was never observed (see "Owner open items").

Tree: branch `feature/better-ui`, HEAD `b4178c6`, working tree clean before and after the gates.

### F.1 Gates on the final tree

| Command | Result |
|---|---|
| `npm test` | PASS, rc 0: 172 files, 3,691 tests, 0 failed, 96.08 s. No failure at all, so none outside the 0.8 set. The three 0.8 watch-list files: `denied/page.test.tsx` passed, `users/page.test.tsx` passed, `data-table-search.test.tsx` no longer exists (deleted with its component in 3d.8). Stdout noise only: five "Not implemented: navigation to another Document" lines from jsdom for modifier-key clicks. Baseline 0.8 was 146 files, 2,919 tests |
| `npm run typecheck` | PASS, rc 0 (`tsc --noEmit`) |
| `npx eslint src` (run with `-f json`) | rc 1. 382 files linted, 56,123 messages in 327 files, 56,123 errors and 0 warnings. Every message is `prettier/prettier` "Delete `CR`" (CRLF working tree); 0 findings of any other rule, so by the agreed judge the result is clean. The single `react-hooks/incompatible-library` directive in `tables/data-table.tsx` is in use and reports nothing. Baseline 0.8 was 54,812 messages, all the same kind |
| `npm run format:check` | rc 2: 455 files warned (328 under `src`, the rest `.agents/**`, docs and root config), baseline 461. Cause is CRLF only (`core.autocrlf=true`; index LF, working tree CRLF) |
| `npx prettier --check --end-of-line auto src i18n` (the real judge) | rc 0: "All matched files use Prettier code style!" |
| `npm run build` | PASS, rc 0: "Compiled successfully in 4.7s", TypeScript finished, 20 static pages generated, 23 route lines, all `ƒ` dynamic, plus the proxy. No warning |
| `git status --short` after all gates | empty (clean) |

Pre-existing, not caused by this change: `docs/design-system.md` fails `prettier --check --end-of-line auto` at an old line wrap (already recorded in Batch B; the lines this change added format cleanly).

### F.2 Compliance sweeps

| Sweep | Exact command | Result |
|---|---|---|
| BS-DS-1 colour tokens untouched | `git diff main...HEAD --stat -- src/app/globals.css`, and `git diff --stat -- src/app/globals.css` | Both empty (0 output lines). PASS. Local `main` is stale (merge-base `d118b67`), but the file has no change on either side of the range |
| BS-I18N-1 / DT-I18N-1 key parity | Node script over `i18n/es.json` and `i18n/en.json` (leaf paths, set difference, empty values); plus `src/i18n/catalog-parity.test.ts` inside `npm test` | es 525 leaf keys, en 525; only in es: none; only in en: none; empty values: none. PASS; the parity test file is green |
| BS-MOT-1 no `transition-all` in changed files | `git diff --name-only --diff-filter=AM d118b67 HEAD`, filtered to `^(src\|i18n)/` (123 files), then `rg -l "transition-all\|transition:\s*all"` on each file | Only five TEST files match, all assert absence: `shell-motion.test.ts`, `table-card.test.tsx`, `tables/list-table.test.tsx`, `tables/status-filter.test.tsx`, `tables/structure.test.ts`. No non-test source file changed by this change contains it. PASS |
| Same, whole tree (informational) | `rg -n "transition-all\|transition:\s*all" src --glob '!*.test.*'` | `src/components/ui/button.tsx:8` and `src/components/ui/sidebar.tsx:293`: vendored shadcn primitives, not touched by this change, out of scope per Batch K (pinned by `tables/structure.test.ts`, which fails on any other file) |
| No press scale (DT-DENS-1, informational) | `rg -n "active:[a-z:-]*scale\|scale-9[0-9]" src --glob '!*.test.*'` | No match. The vendored `Button` keeps `active:translate-y-px` (a 1px nudge, not a scale) |
| DT-DATA-1 / UL:fields no `hashClave`, `cif`, `telefono`, `correo` in props to a client table | `rg -n -i "hashClave\|\bcif\b\|telefono\|correo"` over the ten table and page modules (users, asignaturas, docentes, grupos table and section, import-preview, import-errors) | `hashClave`, `cif`, `telefono`: no field reference in any module (only comments in `docentes-table.tsx:23` and `docentes/page.tsx:33`). `correo`: appears ONLY in the Docentes list (`docentes-table.tsx:28,74,75`, `docentes/page.tsx:38`) because Correo is a displayed column of that table (DT-DATA-1 forbids e-mail only "that is not a column of that table"). The users rows are exactly `{ id, nombreCompleto, login, rol, activo, creadoEnLabel }` (`users-table.tsx:24-30`, `users/page.tsx:36-43`). Pinned by `users/page.test.tsx` (table-driven by forbidden field, three roles, with and without an e-mail term), `users-table.test.tsx`, `docentes-table.test.tsx`, `docentes/page.test.tsx` and `users-query.test.ts`. PASS, with the literal wording of the sweep over-broad for Docentes (finding S-1) |
| Every sortable column has a `Record` entry | `rg -n "SORT_MAP\|SORT_KEYS\|Record<\|enableSorting\|id: \""` over the three maps and three tables, plus `tsc` | `USERS_SORT_MAP` (`src/lib/data/users.ts:106`) `satisfies Record<UsersSortKey, SortExpr>`: name, login, role, status, created. `DOCENTES_SORT_MAP` (`users.ts:385`) `satisfies Record<DocentesSortKey, SortExpr>`: name, login, email, status. `ASIGNATURAS_SORT_MAP` (`asignaturas.ts:68`) `satisfies Record<AsignaturasSortKey, SortExpr>`: code, name, hours, status. Columns with `enableSorting: true` carry `id: "<key>" satisfies <SortKey>` and are exactly: users 5, docentes 4, asignaturas 4 (code, name, hours, status). Non-sortable: asignaturas `career`, `groups`, `actions`. A missing entry fails `tsc` (green) and `sort-sql.test.ts` "a map without an entry for every key does not compile". PASS |
| BS-DS-1 patterns documented | read `docs/design-system.md` against the BS-DS-1 list | PASS, table below |

BS-DS-1 pattern coverage in `docs/design-system.md`:

| Pattern (BS-DS-1) | Where documented |
|---|---|
| Top-bar context | section 4.3 "Page context" (line 320); first-row diagram (line 306) |
| Sidebar brand block | section 4.2 "Brand block" (line 289) |
| Sidebar footer (identity block) | section 4.2 "Identity block" (line 293) |
| Page frame | section 4.3 "Page frame" (line 330) |
| Table card with toolbar and footer | section 5 "Table card" (line 372) |
| Sortable header | section 5 "Sortable header" (line 381) |
| Revised pagination (first, last, page size) | section 5 "Pagination" (line 431) |
| Loading skeleton | section 5 "Loading skeleton" (line 388) |
| Route error state | section 5 "Route error" (line 393) |
| No-results variant (and empty state) | section 5 "Empty state" (line 467) |
| Shortcut card (home) | section 5 "Shortcut card" (line 399) |
| Motion rules (named transitions, no row animation, no press scale, hover-capable pointers, motion never the only signal) | section 6 "Motion" (lines 474-492) |

Findings from the sweeps (none requires a code change to pass a gate):

- S-1 (informational): the sweep wording "no `correo` key in props passed to any client table" is wider than DT-DATA-1. The Docentes table legitimately delivers `correo` (a displayed column). The users list does not.
- S-2 (documentation drift, low): `docs/design-system.md` "Sortable header" (lines 381-387) describes only the icon and `aria-sort`. The visible sentence-case state text (Sortable / Ascending / Descending) added by owner decision 2c.0 is not described there. The pattern itself is documented, so BS-DS-1 "Patterns documented" holds; the paragraph should gain one sentence. Closed in Batch M.
- S-3 (informational): the two vendored `transition-all` hits (button, sidebar) remain by design; BS-MOT-1 names only the shell components this change touched.

### F.3 Traceability matrix (for `sdd-verify`)

129 scenarios: 105 covered (C), 22 partial (P), 2 manual only (M). No scenario is without any route.

Legend. **C** covered by automated tests at the level reachable without a database or a browser. **P** partial: the automated part is named and the remainder is named. **M** manual only. "Data" in a P row means the test proves the SQL text or the query shape (DB-free `toSQL()`), never rows read from PostgreSQL.

Test path abbreviations (repository root):

| Abbrev. | Path |
|---|---|
| NAV | `src/lib/navigation.test.ts` |
| INI | `src/lib/initials.test.ts` |
| CTX | `src/components/page-context.test.tsx` |
| SB | `src/components/app-sidebar.test.tsx` |
| MARK | `src/app/(dashboard)/catalog/current-marker-usage.test.ts` |
| LOAD | `src/app/(dashboard)/loading.test.tsx` |
| ERR | `src/app/(dashboard)/error.test.tsx` |
| HOME | `src/app/(dashboard)/page.test.tsx` |
| DEG | `src/components/degraded-alert.test.tsx` |
| EMP | `src/components/empty-state.test.tsx` |
| CARD | `src/components/table-card.test.tsx` |
| FRAME | `src/components/page-frame.test.tsx` |
| MOT | `src/components/shell-motion.test.ts` |
| RSP | `src/components/shell-responsive.test.ts` |
| PAR | `src/i18n/catalog-parity.test.ts` |
| LP | `src/lib/list-params.test.ts` |
| ULP | `src/lib/users/list-params.test.ts` |
| CLP | `src/lib/catalog/list-params.test.ts` |
| SQL | `src/lib/data/sort-sql.test.ts` |
| UQ | `src/lib/data/users-query.test.ts` |
| UD | `src/lib/data/users.test.ts` (`listDocentes`, `buildDocentesWhere`) |
| AD | `src/lib/data/asignaturas.test.ts` |
| DTBL | `src/components/tables/data-table.test.tsx` |
| SH | `src/components/tables/sortable-header.test.tsx` |
| TP | `src/components/tables/table-pagination.test.tsx` |
| TT | `src/components/tables/table-toolbar.test.tsx` |
| LT | `src/components/tables/list-table.test.tsx` |
| LN | `src/components/tables/list-navigation.test.tsx` |
| SF | `src/components/tables/status-filter.test.tsx` |
| STR | `src/components/tables/structure.test.ts` |
| UIT | `src/components/ui/table.test.tsx` |
| UP / UT | `src/app/(dashboard)/users/page.test.tsx` / `users-table.test.tsx` |
| AP / AT | `src/app/(dashboard)/catalog/asignaturas/page.test.tsx` / `asignaturas-table.test.tsx` |
| DP / DOCT | `src/app/(dashboard)/catalog/docentes/page.test.tsx` / `docentes-table.test.tsx` |
| GT / GS / EP | `src/app/(dashboard)/catalog/asignaturas/asignatura-grupos-table.test.tsx` / `asignatura-grupos-section.test.tsx` / `[id]/edit/page.test.tsx` |
| IP / IE | `src/app/(dashboard)/catalog/import/import-preview.test.tsx` / `import-errors.test.tsx` |

#### backoffice-shell (36 scenarios: 26 C, 8 P, 2 M)

| Requirement | Scenario | Coverage (file: test or describe) | Status |
|---|---|---|---|
| BS-CTX-1 | Trail per section | CTX: `it.each(TRAILS)` (8 paths x es/en), "never shows a record name, code or id", unknown routes; NAV: `trailFor (BS-CTX-1)`; MOT: "renders the page context on the leading side" | C |
| BS-CTX-1 | Narrow viewport | CTX: "shows only the entry below md"; RSP: "the top-bar trail keeps only the entry below md" (class level) | P (real 360px: F.4) |
| BS-CTX-1 | Page breadcrumbs unchanged | MARK: describe "current-marker usage (characterization)"; CTX: "takes neither the sidebar bar nor the breadcrumb underline" | C |
| BS-NAV-1 | Entries per role | SB: `AppSidebar entries per role (BS-NAV-1, table-driven)`; NAV: "equals the previous sidebar list in content and order" | C |
| BS-NAV-1 | Settings entry unchanged | NAV: "keeps the settings entry last and pointing at /settings"; SB: entries per role | C |
| BS-NAV-1 | Active marker | SB: "marks only Asignaturas on a nested grupos route"; MARK | C |
| BS-NAV-1 | Administration group hidden when empty | SB: `AppSidebar Administración group trigger`, entries per role for estudiante and docente | C |
| BS-NAV-2 | Identity shown | SB: `AppSidebar identity block (BS-NAV-2)` | C |
| BS-NAV-2 | Role per locale | SB: "changes the role label with the locale and leaves the name alone", "labels the %s role from the roles namespace" | C |
| BS-NAV-2 | Not a menu and no extra read | SB: "is text only: no link, no button and no popup trigger", "hides the initials avatar from assistive technology", "makes no data request" | C (the layout passing `nombre` has no test; the required prop is enforced by `tsc`, Batch B deviation 5) |
| BS-NAV-2 | Name edge cases | INI: `initials (BS-NAV-2 name edge cases)`; SB: one-word and padded names | C |
| BS-FRM-1 | Frame structure | CARD: "renders toolbar, body and footer in that order, divided by hairlines", "omits the toolbar and footer regions when they are not passed"; LT: "draws toolbar, table and footer in that order inside one card"; FRAME; AP and DP: "has exactly one h1 and no skipped levels"; HOME h1 | P: no page test asserts that users, asignaturas, docentes and home wrap their content in `PageFrame`, and `users/page.test.tsx` has no single-`h1` assertion (gap G-5) |
| BS-LOAD-1 | Skeleton on navigation | LOAD: "draws the page frame: title bar, one context line, then a table card of five rows", "keeps the shell out of it", "is built from the Skeleton primitive" | P: component only; whether it shows on a real client navigation is Gate V1 (2d.5) and F.4 |
| BS-LOAD-1 | Announced and static under reduced motion | LOAD: label and `aria-busy` assertions, "pulses only when the user has not asked for reduced motion" (class `motion-safe`) | P (browser reduced-motion check: F.4) |
| BS-ERR-1 | Unexpected throw | ERR: "never renders the raw error message", "renders exactly one h1, announced as an alert", "moves focus to the heading", "links back to the dashboard" | C |
| BS-ERR-1 | Retry | ERR: "calls retry (not reset) from the primary try-again button", "retries from the keyboard with Enter and Space" | P: props level; Next re-rendering the route is not exercised (F.4 last bullet) |
| BS-ERR-1 | Degraded read does not use the boundary | UP: "renders the degraded pill and no misleading count or empty message"; AP and DP: `states (CM-LST-1: Empty states, Database unavailable)` | C |
| BS-ERR-1 | Error screen accessible | ERR: "keeps the retry button at the 44px touch target", Enter and Space, "renders exactly one h1", "adds no main landmark" | C |
| BS-STATE-1 | Empty with a primary action | EMP: "offers the create action as a link when given"; LT: "shows the empty state with the create action and no table"; UT: "shows the empty state with the new-user action and no table" | C |
| BS-STATE-1 | No results always offers a clear control | EMP: "names what matches nothing, hints, and always offers the clear link", "keeps the clear link for a filter-only miss", "rejects a missing clear link at compile time and at runtime"; LT, UT | C |
| BS-STATE-2 | Degraded notice | DEG: `DegradedAlert (BS-STATE-2)`; UP, AP, DP degraded cases | C |
| BS-STATE-2 | Used inside a section | GS: `AsignaturaGruposSection (server part)` degraded case; EP: `Grupos section degraded, cap, scope and structure` | C |
| BS-HOME-1 | Home per role | HOME: `it.each(HOME_PER_ROLE)` (cards and counts for 5 roles), "shows one short sentence, no cards and no links, to a docente" | C |
| BS-HOME-1 | Counts hidden from student and docente | HOME: `it.each([estudiante, docente])` stats read not called | C |
| BS-HOME-1 | No shortcut to settings | HOME: each shortcut href equals its sidebar entry; NAV: "never offers the dashboard or settings to %s" | C |
| BS-HOME-1 | Stats read degrades | HOME: `when the stats read degrades` (three roles, cards kept, no alert for roles that never read) | C |
| BS-HOME-1 | Predicates stay in step | HOME: `stays in step with the sidebar`, "hides Asignaturas and Docentes from both when the catalog predicate flips" | C |
| BS-RSP-1 | 360px | RSP: no fixed pixel widths in shell files; HOME: "keeps the shortcut grid to one column below sm" (class level) | M (F.4: no horizontal scroll) |
| BS-RSP-1 | 320px | RSP: "the loading skeleton and the error screen wrap instead of overflowing"; ERR: "wraps on narrow screens" | M (F.4: no clipping) |
| BS-MOT-1 | Reduced motion | LOAD: motion-safe pulse; CARD: opacity-only dimming; DTBL: "dims the body by opacity only while pending"; MOT: "names the properties the theme toggle icons change" | P (class level; browser check F.4) |
| BS-MOT-1 | No `all` transitions | MOT: `it.each` over `theme-toggle`, `dashboard-header`, `app-sidebar`; STR: "writes no `all` transition outside the two vendored primitives"; CARD, LT, SF: absence assertions | C |
| BS-MOT-1 | Hover only on hover-capable pointers | UIT: hover tint only behind `hover:`; HOME: "tints a shortcut on hover only (hover-capable pointers)" | P (class level; touch pointer F.4) |
| BS-A11Y-1 | Landmarks and focus | CTX: "is a labelled landmark distinct from the sidebar's own", "traps no focus"; SB: `AppSidebar landmark (BS-A11Y-1)` | P (keyboard order and visible focus in a browser: F.4) |
| BS-I18N-1 | Key parity | PAR: `BS-I18N-1: shell copy`, `BS-I18N-1: states and home copy`; F.2 key-set sweep (525 = 525) | C |
| BS-DS-1 | Colour tokens untouched | F.2: empty `git diff main...HEAD --stat -- src/app/globals.css` (no automated test) | C (sweep) |
| BS-DS-1 | Patterns documented | F.2: pattern table above (no automated test) | C (sweep; drift S-2) |

#### data-table (47 scenarios: 39 C, 8 P)

| Requirement | Scenario | Coverage | Status |
|---|---|---|---|
| DT-URL-1 | Fallback table | LP: `parseEnum`, `parsePageSize`, `parseSort` (hostile keys, repeated, other list's key); ULP: `status (UL:status)`, `sort and dir (UL:sort)`, `size (DT-URL-1)`; CLP: `sort fallback`, `dir, size, others` | C |
| DT-URL-1 | Valid values are honoured | ULP: "round-trips every non-default field through parseUsersListParams"; UP: "forwards status, sort, dir and size parsed"; AP, DP: `list params` | C |
| DT-URL-1 | Sort never reaches the query as text | SQL: "falls back to the default order and never interpolates the key", "an inherited property name such as __proto__ is not a map entry"; UQ: sorting describe | C |
| DT-URL-1 | Generated links omit defaults | ULP: `usersListHref - canonical order and omitted defaults`; CLP: `catalogListHref - sort and size`; LP: `listHref` | C |
| DT-URL-1 | Parameters do not change the data scope | UP: hostile-parameter cases and "a denied role is redirected before any read happens"; AP: `scope` and `list params`; DP: `is not Carrera-scoped`; UQ: status inside the scope | C |
| DT-URL-2 | Reset to page 1 | LP: `applyListChange` ("a non-page change wins over an accompanying page value"); LT: "sorts a new column ascending with replace, back on page 1", "pushes a status change back to page 1", "pushes a search without page and keeps the other parameters", "replaces with the chosen page size and page 1"; TT, TP | C |
| DT-URL-2 | Paging keeps the view | LT: "pushes the next page with every other parameter kept"; UP: "page links keep status, sort and size"; TP: hrefs | C |
| DT-URL-3 | Page larger than the new page count | UQ: `clampPage`; UP: "builds the paging links from the page the read clamped to"; AD: `sorting and page size` clamp | C |
| DT-URL-3 | Page clamps for each size | UQ: `clampPage` (sizes 10, 25, 50 with 60 rows) and `it.each([10, 25, 50])`; AD | C |
| DT-NAV-1 | Back after a content change | LN: "pushes without scrolling to the top"; LT: next page, status and search push | P: the `push` call is asserted; the browser Back result is manual (2d.6 item 7) |
| DT-NAV-1 | Back after sort or page size | LN: "replaces without scrolling to the top"; LT: sort and size use `replace` | P: same as above |
| DT-NAV-1 | Links open in a new tab | TP: "links first, previous, next and last to the hrefs the caller built", "leaves modifier-key clicks to the browser and never scrolls"; SF: "renders three real links", "leaves modifier-key clicks to the browser" | C (the real App Router `next/link` is replaced by the stand-in, gate 0.9) |
| DT-SORT-1 | Stable across pages with equal sort keys | SQL: "always ends with the id, in the direction of the chosen key"; UQ: every sort key ends with `Id`; AD and UD: `sorting` describes (both directions) | P (data): SQL text only; no test reads rows from PostgreSQL (gap G-1) |
| DT-SORT-1 | Ties fall back to the default order, then id | SQL: "a catalog-style default (code asc) adds only the id term"; UQ: "ties on a non-default key fall back to newest first, then the id" | C |
| DT-SORT-1 | Accented names sort alphabetically | SQL: `TEXT_SORT_COLLATION`, `collation scope` (name and login collated); S1 (collation exists, owner-run) | P (data): resulting order not executed (gap G-1; manual 2d.6, 3b.6, 3c.6) |
| DT-SORT-1 | Empty emails last in both directions | SQL: `empty e-mails and status` (`nullif`, `nulls last`, asc and desc); UD: `sorting` | P (data): gap G-1 |
| DT-SORT-1 | Status order | SQL: "status ascending means active first (boolean descending)"; AD, UD | P (data): gap G-1 |
| DT-SORT-1 | Header activation cycle | LP: `nextSort`; LT: "sorts a new column ascending with replace, back on page 1", "reverses the direction of the sorted column"; UT: "activating an unsorted header replaces the entry with that column ascending", "activating the active header reverses its direction" | C |
| DT-SORT-1 | Non-sortable columns | DTBL: "gives non-sortable columns no button and no aria-sort"; UT: "makes exactly name, login, role, status and created sortable"; AT and DOCT: `sorting` | C |
| DT-SORT-1 | Sort survives a reload | UT: "follows the URL state", "marks only the sorted column with aria-sort..."; ULP: round trip | C |
| DT-SORT-2 | aria-sort follows the state | DTBL: `aria-sort` table and unknown key; UT: "marks only the sorted column with aria-sort, the default being created descending"; AT, DOCT | C |
| DT-SORT-2 | Keyboard operation | SH: "activates onSort with Enter", "activates onSort with Space", "keeps focus on the same control after activation" | P: unit level; focus after a real route update depends on Gate V1 (2d.5, open) |
| DT-SORT-2 | Direction is not colour alone | SH: "shows a different icon for ascending, descending and unsorted", visible state text in es and en, "keeps the column name as the accessible name in every state"; DTBL: "writes the sort state of every sortable header as visible text" | C |
| DT-TOOL-1 | Search is submit-only | TT: "does nothing while the user types", "submits with Enter as a push to the href the caller built" | C |
| DT-TOOL-1 | Filter and search combine | LT: "keeps the search and the filter usable beside the no-results state", "hands the search form the path and every other parameter"; TT: hidden fields; UQ: "status and search combine inside the same scope" | C |
| DT-TOOL-1 | Count is announced politely | TT: "renders the count in a polite status region", "does not move focus when the count changes" | C |
| DT-PAG-1 | Bounds | TP: `TablePagination bounds (DT-PAG-1)` (3 pages), "exposes an unavailable control as disabled text, not a dead link" | C |
| DT-PAG-1 | First and last navigation | TP: "targets the last page computed from total and size", "pushes the first page with its own href"; UT: "shows the footer with first and last when the total exceeds one page"; UP | C |
| DT-PAG-1 | Page-size selector options | TP: "offers exactly 10, 25 and 50 with the current size selected", "replaces the history entry with the href for the chosen size"; UQ: `it.each([10, 25, 50])` limit | C |
| DT-PAG-1 | Footer omitted when everything fits | UT: "omits the footer when everything fits on one page"; LT: footer for totals 0, 1, 10, 11 | C |
| DT-PAG-1 | One page of a larger size | TP: "shows 1 of 1 with every control unavailable for 20 results at size 25" | C |
| DT-PEND-1 | Update in progress | LT: "is busy and dimmed with the previous rows and enabled controls"; TT: "reads the updating text while pending, then the count again"; DTBL, CARD, LN | C (pending simulated through a suspending child; real router unobserved) |
| DT-PEND-1 | Pending ends | TT: "reads the updating text while pending, then the count again"; LN: "is pending while the navigation is in flight and idle after" | C |
| DT-PEND-1 | Reduced motion | CARD and DTBL: opacity-only dimming plus the static text and busy state | P (browser check F.4) |
| DT-STATE-1 | Three situations | LT: `ListTable empty and no-results (DT-STATE-1)`; UT, AT, DOCT: `states`; UP, AP, DP: degraded cases | C |
| DT-STATE-1 | Degraded with sort and page size | UP: "degraded with every parameter shows the alert only (UL:soft)"; AP and DP: `states` (sort=name&dir=desc&size=25&page=2) | C |
| DT-STATE-1 | Clear link restores the list | LT: "clears only the term and the filter, keeping sort and size, on page 1" (owner decision 2d.0) and two variants; UT | C |
| DT-MODE-1 | Grupos section order and cap unchanged | GT: `bounded mode` (no sort button, no pagination, order as given); GS; EP: `Grupos section rows and links`, `degraded, cap, scope and structure`, `wiring (DT-MODE-1, DT-DATA-1)` | C |
| DT-MODE-1 | CountsTable is a fixed matrix | IP: `CountsTable as a bounded table (DT-MODE-1 fixed matrix, DT-A11Y-1)` | C |
| DT-MODE-1 | Import errors table is unchanged | IE: `ErrorsTable as a bounded table (design R2, DT-MODE-1 unchanged table)` | C |
| DT-DATA-1 | Users rows | UP: `the browser receives only displayed fields (UL:fields)` (table-driven by forbidden field); UT: "renders nothing beyond the six delivered fields, even if a row carried more"; UQ: "the select list never names hashClave, cif, telefono or correo" | C |
| DT-DATA-1 | Docentes rows carry no credential | DOCT: `DocentesTable displayed fields only (DT-DATA-1)`; DP: serialized delivered data; UD: `listDocentes ... carries no credential` | C |
| DT-DATA-1 | Asignaturas and Grupos rows | AT: `displayed fields only (DT-DATA-1)`; GT: `GrupoRow (DT-DATA-1)`; EP: wiring | C |
| DT-DENS-1 | Header height | STR: "keeps the header row at 48px in the one table head primitive", "gives the sortable header button a 44px target inside the 48px row"; DTBL: "keeps the header row at the documented 48px for both kinds of header" | C (class level; the no-press-scale sentence has no test pin, F.2 `rg` sweep only: gap G-6) |
| DT-A11Y-1 | Structure | DTBL: `DataTable structure (DT-A11Y-1)` (caption, `scope="col"`); UT: "names the table and shows each field as text (DT-A11Y-1)"; TP, TT: labelled landmarks | C |
| DT-I18N-1 | Key parity | PAR: `DT-I18N-1: table core copy`, `users list copy`, `Asignaturas table and page copy`, `retired list copy`, `Docentes list copy`; F.2 key-set sweep | C |
| DT-I18N-1 | Copy per locale | UT, AT, DOCT: `describe.each(["es", "en"])`; SH, TP, TT, LT, SF, ERR: es cases | C |

#### users-listing (27 scenarios: 23 C, 4 P)

| Requirement | Scenario | Coverage | Status |
|---|---|---|---|
| UL:sort | Sort by column and direction | ULP: `sort and dir (UL:sort)`; UQ: `buildListUsuariosQuery - sorting (UL:sort)`; SQL: `orderByFor` | C (SQL text) |
| UL:sort | Stable across pages with equal values | UQ: every key ends with `Id`; SQL: "always ends with the id" | P (data): gap G-1 |
| UL:sort | Accented names sort alphabetically | SQL: `collation scope`; UQ: collated name and login | P (data): gap G-1 |
| UL:sort | Ties on the chosen column keep the default order | UQ: "ties on a non-default key fall back to newest first, then the id" | C |
| UL:sort | Unknown sort falls back | ULP: 10 valid and 11 hostile `sort`/`dir` rows; UP: seven hostile-parameter rows | C |
| UL:sort | Sorting does not change the scope | UQ: `buildUsersWhere - status (UL:status, UL:scope)`, "an empty scope stays closed whatever the status"; UP: role from the session | C |
| UL:status | Filter values | ULP: `status (UL:status)`; UQ: `it.each(STATUSES)` exact where text | C |
| UL:status | Filter combines with search and scope | UQ: "status and search combine inside the same scope" | C |
| UL:status | Filter with no results | UP: "words a status-only no-results without the term and clears to the same sort (UL:status)"; UT: "words a filter-only no-results without a search term" | C |
| UL:scope | Hostile and extra parameters | UP: hostile-parameter rows (`sort='; DROP TABLE...'`, `size=9999`, `role=administrador`, `scope=all`); ULP: "ignores extra keys such as rol, role, scope, viewerRol" | C |
| UL:scope | Denied roles stay denied | UP: "a denied role is redirected before any read happens", "runs the guard before the read", "guards with exactly rolesQueCreanUsuarios" | C |
| UL:reset | Reset on each change | LT: reset tests; UT: "offers the status filter as links that keep the view and reset the page"; LP: `applyListChange` | C |
| UL:fields | Delivered rows are picked | UP: `it.each(forbidden)` (hashClave, cif, telefono, correo), "the rendered markup does not carry the secret values either"; UT | C |
| UL:fields | Same guarantee for every viewer | UP: `it.each(cases)` (administrador, secretaria, coordinacion; with and without an e-mail term) | C |
| UL:fields | The list read does not select private fields | UQ: "selects exactly the six displayed columns", "the select list never names hashClave, cif, telefono or correo" | C |
| UL:fields | Search by e-mail still works | UQ: "search by e-mail still builds its predicate"; UP: e-mail-term delivery case | P (data): predicate text only; manual 2d.6 item 5 (gap G-1) |
| UL:pag | Page parameter handling | ULP: `page` describe (absent, `0`, `-1`, `abc`, `2.5`, empty, array); UQ: `clampPage` | C |
| UL:pag | Controls at the bounds | TP: `bounds (DT-PAG-1)`; UT footer | C |
| UL:pag | Page size options | ULP: `size (DT-URL-1)`; UQ: `it.each([10, 25, 50])` | C |
| UL:pag | Page clamps against the chosen size | UQ: `clampPage` with sizes 25 and 50; UP: clamped page links | C |
| UL:pag | First and last navigation | TP; UP: "offers first and last beside previous and next (DT-PAG-1)" | C |
| UL:pag | Stable order across pages with equal creation dates | UQ: "the default sort produces today's order text" (ends with `Id`) | P (data): gap G-1 |
| UL:pag | Page survives a reload | ULP: `usersListHref` round trip | C |
| UL:pag | Single page or no results | UT: "omits the footer when everything fits on one page", empty state; TP: "shows 1 of 1 ... for 20 results at size 25" | C |
| UL:soft | Database unavailable | UP: "renders the degraded pill and no misleading count or empty message"; UQ: `listUsuarios - fail-soft` | C |
| UL:soft | Degraded state with a search or page | UP: degraded cases | C |
| UL:soft | Degraded state with sort, filter and page size | UP: "degraded with every parameter shows the alert only (UL:soft)" | C |

#### catalog-management, CM-LST-1 (19 scenarios: 17 C, 2 P)

| Scenario | Coverage | Status |
|---|---|---|
| Default shows active only | CLP: `defaults`; AP and DP: `list params (CM-LST-1: Default, ...)`; AD | C |
| Filter (table-driven) | AP and DP: `rows (CM-LST-1: Filter, state in words)`; AD: `buildAsignaturasWhere`; UD: `buildDocentesWhere` | C |
| Search | AD: `buildAsignaturasWhere`, `matching groups of a search (CM-ASG-9)`; UD: `buildDocentesWhere` | C |
| Pagination clamps | AD: `listAsignaturas`; UD: `listDocentes`; AP, DP: `list params` | C |
| Empty states | AP, DP: `states`; AT, DOCT: `states (DT-STATE-1, BS-STATE-1)` | C |
| Docentes list is read-only and unscoped | DP: `is not Carrera-scoped`, `is read-only`; DOCT: `is read-only (CM-LST-1, CM-ACC-1)` | C |
| Unrecognised status falls back | CLP: `catalog list parsers - status, page and q`; AP, DP | C |
| Docentes list carries no credential | UD: `listDocentes ... carries no credential`; DP; DOCT | C |
| Database unavailable | AP, DP: `states`; AD, UD: fail-soft cases | C |
| Sortable columns | CLP: `sort keys`; AD and UD: `sorting` (both directions); AT and DOCT: `sorting` | C (SQL text) |
| Unsortable and unknown sort values fall back | CLP: `sort fallback` (groups, actions, hashClave, cif, password, Name, `name;`, empty, other list's key, repeated) | C |
| Collation, empty emails and status order | AD, UD: sort maps; SQL: collation, `nullif ... nulls last`, active first | P (data): gap G-1; manual 3b.6, 3c.6 |
| Footer omitted when everything fits | AT, DOCT: `controls`/`states`; LT | C |
| Stable across pages with equal sort keys | AD, UD: every sorted order ends with `Id` | P (data): gap G-1 |
| Page size options | CLP: `dir, size, others`; AD: sizes 25 and 50 | C |
| First and last navigation and clamping with a size | TP; LT; AD: clamp with sizes | C |
| Reset to page 1 on any view change | AT, DOCT: `controls (CM-LST-1, DT-URL-2, DT-NAV-1)`; LT; LP | C |
| Sort and page size never widen the Carrera scope | AD: scope by Carrera unchanged for a `coordinacion` actor with extra parameters; AP: `scope` and hostile values | C |
| Degraded read keeps the notice with the new parameters | AP and DP: `states` (sort=name&dir=desc&size=25&page=2) | C |

#### Coverage gaps (explicit)

No scenario is without any route. The following are not fully proven by automated tests:

| Gap | Scenarios affected | What is missing | Route to close |
|---|---|---|---|
| G-1 Real-data ordering | DT-SORT-1 stable, accented, empty emails, status order; UL:sort stable and accented; UL:pag stable order; UL:fields search by e-mail; CM-LST-1 collation and stable (10 scenario rows) | Every ordering proof is the SQL text from the DB-free query builder. No test runs a list query against PostgreSQL, so "Álvaro, angel, Beatriz, Zoe", `nulls last` and no skipped row across pages are not demonstrated. S1 confirmed only that `es-x-icu` exists | Owner smoke 2d.6, 3b.6, 3c.6; or a new opt-in real-Postgres suite in the style of `vitest.integration.config.mts` (not in this change) |
| G-2 Browser history and focus | DT-NAV-1 back x2; DT-SORT-2 keyboard focus after update | Calls to `router.push` and `replace` are asserted; the browser Back result and focus retention after a real route update are not. Gate V1 is open | 2d.5 (V1), 2d.6 item 7, F.4 keyboard |
| G-3 Real Next runtime | BS-LOAD-1 navigation, BS-ERR-1 retry, DT-PEND-1 against the real router | Component-level and simulated pending only; the real App Router `next/link` is a stand-in (gate 0.9) | F.4 (error screen, keyboard), 2d.5 |
| G-4 Responsive, motion, touch, themes | BS-RSP-1 x2, BS-MOT-1 reduced motion and hover, BS-A11Y-1 keyboard order, BS-LOAD-1 static skeleton, DT-PEND-1 reduced motion | Class-level structural tests only; no browser or E2E layer exists | F.4 checklist |
| G-5 Page frame use | BS-FRM-1 Frame structure | No page test asserts that users, asignaturas, docentes and home render inside `PageFrame`; `users/page.test.tsx` has no single-`h1` assertion (asignaturas, docentes and home do) | One test per page, a later small change (not blocking). Closed in Batch M. |
| G-6 No press scale | DT-DENS-1 second sentence | No automated pin; only the F.2 `rg` sweep (no match) | Optional one-line assertion in `structure.test.ts` |

### F.7 Final state and size measurements

`git status --short`: empty. `git status -sb`: `## feature/better-ui...origin/feature/better-ui [ahead 4]` (the four commits of slices 3a to 3d are not pushed). Nothing is staged.

`git log --oneline main..HEAD` lists 21 commits because the LOCAL `main` is stale (merge-base `d118b67`; eight earlier commits already merged upstream appear in the list). The 13 commits of this change are `b74f5f3^..HEAD`:

| Commit | Content |
|---|---|
| `b74f5f3` | docs(openspec): add backoffice-ui-refresh change artifacts |
| `5af89f7` | chore(deps): add @tanstack/react-table (Phase 0) |
| `a173b35` | feat(shell): page context, shared navigation config and sidebar identity block (1a) |
| `54fd126` | feat(shell): loading and error boundaries, shared states and role-aware home (1b) |
| `c0bc25a` | feat(users): validated sort, status and page-size parameters with a narrowed list projection (2a) |
| `c47cc2d` | feat(tables): TanStack table core with accessible sortable headers (2b) |
| `e3fc185` | feat(tables): toolbar, status filter, first and last pagination and page-size selector (2c) |
| `d290c0d` | feat(users): TanStack list with sorting, status filter and page-size selector (2d) |
| `7a5ef4d` | docs(openspec): add backoffice-ui-refresh handoff and record OC-6 decision |
| `ef14c81` | feat(catalog): validated sort and page-size parameters and whitelisted catalog orderings (3a) |
| `a19f352` | feat(catalog): TanStack asignaturas list with sorting and page-size selector (3b) |
| `437d56d` | feat(catalog): TanStack docentes list with sorting, email-last ordering and page-size selector (3c) |
| `b4178c6` | refactor(tables): bounded TanStack tables for grupos and import, remove legacy table components (3d) |

Raw `git diff --shortstat <commit>~1 <commit>` per commit (includes the openspec notes and the lock file of that commit):

| Slice | Commit | Raw shortstat |
|---|---|---|
| artifacts | `b74f5f3` | 10 files changed, 3,429 insertions(+) |
| Phase 0 | `5af89f7` | 2 files changed, 35 insertions(+) |
| 1a | `a173b35` | 16 files changed, 1,158 insertions(+), 146 deletions(-) |
| 1b | `54fd126` | 19 files changed, 1,454 insertions(+), 31 deletions(-) |
| 2a | `c0bc25a` | 14 files changed, 1,509 insertions(+), 58 deletions(-) |
| 2b | `c47cc2d` | 20 files changed, 1,661 insertions(+), 13 deletions(-) |
| 2c | `e3fc185` | 20 files changed, 2,021 insertions(+), 15 deletions(-) |
| 2d | `d290c0d` | 15 files changed, 845 insertions(+), 196 deletions(-) |
| handoff | `7a5ef4d` | 2 files changed, 75 insertions(+), 1 deletion(-) |
| 3a | `ef14c81` | 10 files changed, 703 insertions(+), 19 deletions(-) |
| 3b | `a19f352` | 7 files changed, 974 insertions(+), 267 deletions(-) |
| 3c | `437d56d` | 7 files changed, 740 insertions(+), 198 deletions(-) |
| 3d | `b4178c6` | 27 files changed, 1,024 insertions(+), 1,222 deletions(-) |

Per-slice lines excluding `openspec/` notes and `package-lock.json` (`git diff --numstat`, added + deleted, split by kind), compared with the Review Workload Forecast:

| Slice | Commit | Files | Added | Deleted | Changed | Tests | Production src | Locale | Docs | Forecast | Over upper bound |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Phase 0 | `5af89f7` | 1 | 1 | 0 | 1 | 0 | 1 | 0 | 0 | ~30 (lock excluded; lock +34) | n/a |
| 1a | `a173b35` | 16 | 1,158 | 146 | 1,304 | 785 | 417 | 22 | 80 | 600-750 | 1.74x |
| 1b | `54fd126` | 19 | 1,454 | 31 | 1,485 | 1,037 | 408 | 40 | 0 | 600-750 | 1.98x |
| 2a | `c0bc25a` | 12 | 1,384 | 44 | 1,428 | 1,061 | 367 | 0 | 0 | 500-650 | 2.20x |
| 2b | `c47cc2d` | 18 | 1,534 | 2 | 1,536 | 1,185 | 331 | 20 | 0 | 500-650 | 2.36x |
| 2c | `e3fc185` | 18 | 1,878 | 6 | 1,884 | 1,303 | 513 | 68 | 0 | 650-850 | 2.22x |
| 2d | `d290c0d` | 13 | 688 | 189 | 877 | 531 | 342 | 4 | 0 | 450-550 | 1.59x |
| 3a | `ef14c81` | 8 | 642 | 13 | 655 | 468 | 187 | 0 | 0 | 350-450 | 1.46x |
| 3b | `a19f352` | 5 | 901 | 262 | 1,163 | 696 | 467 | 0 | 0 | 600-750 | 1.55x |
| 3c | `437d56d` | 5 | 661 | 193 | 854 | 554 | 300 | 0 | 0 | 450-550 | 1.55x |
| 3d | `b4178c6` | 25 | 913 | 1,211 | 2,124 | 1,338 | 700 | 86 | 0 | 1,100-1,300 (about 780 deletions) | 1.63x |
| **Total** | | 140 | 11,214 | 2,097 | **13,311** | 8,958 | 4,033 | 240 | 80 | 5,800-7,250 | 1.84x |

"Tests" includes `src/test/` helpers; "Production src" is every other path outside `i18n/` and `docs/`.

Reading the table:

- Net change of the whole range `5af89f7~1..b4178c6`, excluding `openspec/` and the lock file: 11,138 insertions and 2,021 deletions (13,159 changed lines). The per-slice sum is higher (13,311) because several files (catalog-parity test, locale files, list-table) are edited by more than one slice.
- Against the forecast the change is 1.8x the upper bound (7,250) and 2.3x the lower bound (5,800); it also passes the +25% stop threshold (9,062) by 47%. Against the 800-line review budget it is about 16.6x.
- Tests are 8,958 lines (67%); production source 4,033 (30%); locale files 240; docs 80. Of slice 3d's 1,211 deleted lines, 874 are the eight legacy files (four components, four tests), which are mechanical.
- Every slice exceeded its upper bound. None was cut because each overrun was measurable only at its seam (see Batches B to K). The single-PR decision (D14) and the accepted `size:exception` stand.

### Owner open items

| Item | What is needed |
|---|---|
| 2d.5 Gate V1 | Observe in `next dev` and in a production build (`npm run build`, `npm start`) whether a sort click or page-size change on `/users` shows the `loading.tsx` skeleton and whether focus survives. Unobserved (no credentials in the apply sessions). Contingency (module-level last control id, RED test first) only if the skeleton does show |
| 2d.6 | Users smoke as `administrador` and `secretaria`: the nine-point checklist in Batch G |
| 3b.6 | Asignaturas smoke as `coordinacion` and `secretaria`: Batch I checklist |
| 3c.6 | Docentes smoke as `administrador`, `coordinacion` and `secretaria`: Batch J checklist |
| 2d.8 | Tick after V1 is recorded (its task text requires the V1 outcome); commit `d290c0d` exists |
| F.4 | The seven-bullet manual checklist (320 and 360px, keyboard, reduced motion, themes and brands, es/en, touch, error screen) |
| F.5 | `docs/roadmap.md` row for this change (owner edit only; not touched here) |
| F.6 | Confirm the spec merge at archive: users-listing "Assumptions withdrawn or changed at archive"; CM-ASG-7, CM-NAV-1, CM-UX-1 unmodified |
| F.8 | Hand off to `sdd-verify` |
| Delivery | Push the four unpushed commits and open the single PR with the `size:exception` justification below |

### PR description draft (ready to paste)

Title: `feat(backoffice): redesigned shell, TanStack tables and sortable server-driven lists`

````
## Summary

Backoffice UI refresh: a role-aware shell (page context in the top bar,
sidebar identity block, loading and error boundaries, shared empty,
no-results and degraded states, role-aware home) and a shared table kit on
TanStack Table v8.21.3 (manual mode) used by the Users, Asignaturas and
Docentes lists. Lists gain validated server-side sorting, a status filter
on Users, a page-size selector (10, 25, 50) and first/last pagination. The
Grupos section and the import tables use the same primitives in bounded mode.
The four legacy table components are removed. No colour token, no schema and
no route changed; no database command is part of this change.

## Slices and commits

| Slice | Commit |
|---|---|
| Phase 0: dependency | 5af89f7 |
| 1a Orientation (page context, navigation config, sidebar identity) | a173b35 |
| 1b States and home (loading, error, shared states, role-aware home) | 54fd126 |
| 2a URL contract and users data layer (narrowed projection) | c0bc25a |
| 2b Table core (sortable header, DataTable) | c47cc2d |
| 2c Table controls (toolbar, status filter, pagination, ListTable) | e3fc185 |
| 2d Users migration | d290c0d |
| 3a Catalog URL contract and data layer | ef14c81 |
| 3b Asignaturas list | a19f352 |
| 3c Docentes list | 437d56d |
| 3d Bounded tables, legacy components removed | b4178c6 |

## Behaviour changes worth reviewing

- Docentes default order is now alphabetical under the es-x-icu collation
  (accented and lowercase-initial names no longer sort after "Z"); owner decision.
- The no-results "clear filters" link clears only the search term and the status,
  keeping sort and page size.
- The Users list read no longer selects hashClave, cif, telefono or correo,
  and the page picks the six displayed fields explicitly.
- The dashboard home shows the degraded alert instead of zeros when the stats
  read fails; the docente home shows one sentence.

## Verified

- npm test: 172 files, 3,691 tests, 0 failed.
- npm run typecheck: clean. npm run build: compiles, all routes dynamic.
- npx eslint src: only prettier CRLF findings from the Windows checkout (no
  other rule); prettier --check --end-of-line auto src i18n: clean.
- src/app/globals.css has an empty diff; es.json and en.json have identical
  525-key sets; no transition-all in changed source files.
- Traceability: 129 spec scenarios mapped to tests (105 covered, 22 partial,
  2 manual only); see openspec/changes/backoffice-ui-refresh/apply-progress.md,
  Batch L.

## Not verified

- No query was executed against PostgreSQL: the collation, empty-email-last and
  stable-paging behaviour is proven as SQL text only.
- No browser run: 320/360px layouts, keyboard order, reduced motion, themes,
  touch hover and the real App Router link behaviour.
- Gate V1: whether the route skeleton shows on a query-only navigation.

## Owner manual items (open)

- 2d.5 (V1), 2d.6 (users smoke), 3b.6 (asignaturas smoke), 3c.6 (docentes smoke).
- F.4 manual checklist; F.5 roadmap row; F.6 spec merge confirmation.

## size:exception

About 13,300 changed lines (about 9,000 are tests, about 870 are deletions of
the legacy table components) against the 800-line budget. The work is one
cross-cutting UI contract (URL state, table kit, shell) that cannot ship
partially without leaving mixed legacy and new tables. It was built and
committed slice by slice (11 implementation commits) so it can be reviewed and
reverted in that order.
````

### Deviations and notes for this batch

1. The F.2 sweep for `correo` is satisfied with the documented exception (S-1).
2. Per-slice measurements use `git diff --numstat` per commit and differ slightly from the figures in earlier batch notes, which were taken before the commits existed (for example 2a: 1,428 against "about 1,420").
3. No gate rewrote a tracked file; the working tree was clean after every gate.
4. `HANDOFF.md` state table updated (commits `ef14c81`, `a19f352`, `437d56d`, `b4178c6`); remaining items are marked owner-only.

## Batch M: gap closure

- G-5 closed: each of `users/page.test.tsx`, `catalog/asignaturas/page.test.tsx`, `catalog/docentes/page.test.tsx` and `page.test.tsx` (home, once per role) now asserts a single `[data-slot="page-frame"]` carrying `flex flex-col gap-8` that contains exactly one `h1`. Mutation proof: temporarily replacing `PageFrame` with a plain `div` in the four pages made 8 of the new tests fail (1 users, 1 asignaturas, 1 docentes, 5 home); the pages were restored afterwards.
- S-2 closed: `docs/design-system.md` "Sortable header" now documents the visible, `aria-hidden` sort-state text, the column-label accessible name, `aria-sort` on the `th` and wrapping on narrow widths.

## Batch N: sort indicator, icon only

Owner decision, supersedes 2c.0 ("sort state is visible text"): the sortable header shows only the icon (ChevronsUpDown / ArrowUp / ArrowDown). No Sortable / Ascending / Descending text.

- RED first: `sortable-header.test.tsx` (text content equals the column label, no `span`, name unchanged, description from `title`, no `flex-wrap`), `data-table.test.tsx` (no header carries state text) and `catalog-parity.test.ts` (`tables` leaf set without `sort.indicator.*`). 8 failures confirmed before any production edit.
- GREEN: removed the `aria-hidden` span and the `flex-wrap` / `whitespace-normal` wrapping from `sortable-header.tsx`; kept `min-h-11`, focus ring, no transition, `title` and `aria-sort`.
- Keys: `tables.sort.indicator.{sortable,ascending,descending}` removed from `i18n/es.json` and `i18n/en.json`; `rg` showed no consumer outside the tests. `tables.sort.{sortable,ascending,descending}` (the description) are kept.
- Docs: `docs/design-system.md` "Sortable header" now states the icon is the only visual indicator and the state lives in `aria-sort` and the description. Section 2 untouched.
- HANDOFF.md: the "visible text" decision bullet was replaced.

## Batch O: home skeleton

Owner request: the shared table skeleton did not match the home.

- Moved `src/app/(dashboard)/page.tsx` and `page.test.tsx` into the `(home)` route group (URL unchanged). Fixed the test import paths (`../../../../i18n`, `@/app/(dashboard)/(home)/page`) and `shell-responsive.test.ts` paths. Page behaviour untouched.
- RED first: `(home)/loading.test.tsx` (module missing) and the new sweeps in `shell-responsive.test.ts` and `shell-motion.test.ts` failed before `(home)/loading.tsx` existed.
- GREEN: `(home)/loading.tsx`: synchronous, aria-busy, hidden `common.loading`, title and subtitle bars, 2 count cards then 4 shortcut cards (role-agnostic, noted in a comment) in the real grid classes. `(dashboard)/loading.tsx` and its test are unchanged.
- Docs: `docs/design-system.md` loading skeleton paragraph mentions the home skeleton.
- Visual result needs the owner in the browser.

## Batch P: footer layout and icon pagination

Owner request: footer layout and icon controls.

- RED first: `table-pagination.test.tsx` (9 failures: DOM order, icons without text, `aria-label` names, no total, `min-h-11 min-w-11`, `sm:grid-cols` layout) before the component changed.
- GREEN: `table-pagination.tsx` is a three-region footer (hidden spacer, centered cluster, size selector last): `flex-col` stacked, `sm:grid-cols-[1fr_auto_1fr]` from `sm`. Controls are `ChevronsLeft`, `ChevronLeft`, `ChevronRight`, `ChevronsRight` (`aria-hidden`), named by `aria-label` from the existing `tables.pagination.*` keys; unavailable ones are `aria-disabled` spans with the same icon, muted. Total count removed from the footer. Hrefs, `navigate(...,"push")`, `scroll={false}`, size `replace` unchanged.
- `list-table.test.tsx`: new test that the count appears once and not in the footer.
- Keys: `tables.count` is still used by the toolbar (`table-toolbar.tsx`), so no i18n key was removed and parity pins are unchanged.
- Docs: `docs/design-system.md` Pagination paragraph rewritten. Section 2 untouched.
- Visual result needs the owner in the browser.

## Batch Q: gate V1 and focus contingency

Owner observation (2026-10-13, `next dev`, `/users`): gate V1 (N8) came out positive for the skeleton. A query-only navigation (sort header, page size) replaces the table with the `(dashboard)/loading.tsx` skeleton, even though `ListNavigationProvider` wraps navigation in `startTransition`. Task 2d.5 contingency implemented.

### Part 1: why the skeleton shows, and what is documented (Next 16.3.4)

- N8 stays undocumented. `loading.md` says `loading.js` "will automatically wrap the `page.js` file ... in a `<Suspense>` boundary" and that "the Fallback UI is prefetched, making navigation immediate"; nothing states whether a search-param-only change re-shows it. `template.md` states only that "Search params do not trigger remounts" for templates; `layout.md` "Query params" says layouts do not re-render on navigation.
- Source (`node_modules/next/dist/client/components/layout-router.js`): `LoadingBoundary` is a plain `<Suspense fallback={loading}>` above `InnerLayoutRouter`. The comment in `OuterLayoutRouter` says search params do not change the state key ("two segments with the same segment path but different search params should have the same state key"), so the boundary instance itself is not remounted by a query change.
- Source (`router-reducer/ppr-navigations.js` lines 158-160): "A search-param-only change is treated as a refresh of the page segment", and a page segment on a same-page navigation is always refetched into a new `CacheNode` whose `rsc` is a pending deferred promise (`use(rsc)` in `InnerLayoutRouter`). Our `startTransition` only wraps the call to `router.push`/`replace`; the router commits its own state through its own `startTransition` (`app-router-instance.js`) and that pending page segment suspends under the `loading` boundary. The skeleton is what React shows for that suspension on this path.
- Honest limit: the exact reason a transition does not hold the old UI here was NOT proven by reading source; it is an inference consistent with the observation. The documentation does not say it.
- Documented mitigation pattern: `02-guides/interactive-apps.md` Step 3 (filter chips) uses `router.push` inside `startTransition` plus a pending attribute, and "dims while the transition runs, without replacing the board with a skeleton"; its Suspense boundaries live inside the page (Step 1), not in a segment `loading.js`. Applied here this would mean: keep `loading.tsx` for real route changes but make the users page synchronous, pass the data promise to an async child under a page-level, unkeyed `<Suspense>` so the old table stays visible, dimmed, with `aria-busy` (DT-PEND-1).
- Risks of that option (not implemented, owner decides): restructures the three list pages (server data fetch moves into a child, `searchParams` promise passed down); the inner boundary behaviour on a query-only navigation is itself not documented and needs the same V1-style observation; error and `notFound` handling moves with it; double fallbacks (skeleton on first load plus inline fallback) need design. Recommendation: keep the skeleton and the focus contingency below for now (cheap, covers DT-SORT-2 and the keyboard path), and spike the page-level `<Suspense>` only if the owner finds the skeleton flash on sort/page-size unacceptable.

### Part 2: focus contingency

- RED first: `list-navigation.test.tsx` (suite failed to load: `sortControlId` missing), `sortable-header.test.tsx` (marker absent), `data-table.test.tsx` (ids absent), `list-table.test.tsx` (focus stays on body after the remount). 4 files failing, 3 test failures plus the unloadable suite.
- GREEN: `list-navigation.tsx` keeps a module-level `activeControl` (`{ id, path }`), written only by `navigate(href, mode, controlId?)` (a call without an id clears it), restored once by a mount effect of the provider (after the list's own effects), and cleared when a transition settles without a remount. Restore rules: only when `document.activeElement` is `body`, only on the same `window.location.pathname`, never on a plain mount, no timers, never read during render (SSR untouched). `SortableHeader` takes `controlId` and exposes `data-list-control`; `DataTable` passes `sort:<column id>`; `ListTable` passes the same id to `navigate`.
- Not covered on purpose: the status filter, the pagination controls and the search form. The same mechanism applies (third argument plus `listControlProps`), but each needs its component and its exact-call assertions changed; left for the owner to ask for after the browser check.
- Keyboard result (focus returning to the header after Enter and the skeleton) must be confirmed by the owner in a browser; jsdom simulates the skeleton with a swapped tree.
- V: `npm test` 3,727 passed; `npm run typecheck` clean; `npx eslint src` only CRLF `prettier/prettier`; `npx prettier --check --end-of-line auto src/components/tables` clean; `npm run build` ok (port 3000 free, no process left); `git diff --stat src/app/globals.css` empty.
- Task 2d.5 ticked as "V1 observed by owner: skeleton shown; contingency implemented". 2d.6 and 2d.8 stay unticked.

## Batch R: review queue migration after merging main

Context: `main` was merged into `feature/better-ui` (bddcc22). `main` added `src/app/(dashboard)/review/page.tsx` (staff queue, RF-06), which imported the legacy `DataTable`/`DataTableColumn` from `@/components/data-table`, deleted in slice 3d. `tsc --noEmit` failed there (TS2307 plus three implicit-any) and Vercel failed the build. It was the only consumer. Owner chose option A: migrate to the new kit, do not restore the legacy component.

- RED first: `review-queue-table.test.tsx` (module `review-queue-table` did not exist; suite failed to load) written before the component.
- GREEN: new client module `review/review-queue-table.tsx` builds the six columns in `useMemo` and renders the bounded `DataTable` (no `sorting`, no pagination, no toolbar; `getRowId` = row id; zero rows render nothing). Same headers (`review.queue.columns.*`), same cell content and classes; end-aligned action column through `meta.align`; `Link` with `prefetch={false}` and the named aria-label.
- The server page computes every display string (received date, due-on text, deadline label, subjects count, resubmitted note, link label and aria-label) and passes plain rows picked field by field (`ReviewQueueTableRow`); the absence cause never leaves the data layer (RNF-06). `DeadlineBadge` has no server-only API, so it is client-safe unchanged.
- Page behaviour and order unchanged: `requireRole`, scope and `noFaculty`, `listReviewQueue` then `recordQueueRead` in the body, `resultado` notice, `calendarNotLoaded`, empty state, mobile card list (`md:hidden`), desktop wrapper (`hidden md:block`).
- `structure.test.ts`: three new pins (no review module imports the legacy component; table is a client module and the page does not build columns; bounded mode). `page.test.tsx` and `design-system.test.tsx` needed no change (every behavioural assertion still holds).
- Removed-symbol grep on the merged tree (`parseCatalogListParams`, `CATALOG_PAGE_SIZE`, `catalog.shared.filter`, `tables.sort.indicator`, `@/components/data-table`): only the removed-keys list in `src/i18n/catalog-parity.test.ts` mentions them.
- OPEN FINDING (not fixed here, owner decides): the merge dropped main's sidebar entries because the sidebar list moved to `src/lib/navigation.ts`. `/review` ("Revision de solicitudes", `prefetch: false`, `canReviewRequests`) and `/requests` ("Mis solicitudes", `canFileRequests`) have no menu entry, and `app-sidebar.test.tsx` (merged to main's expectations) plus the `structure.test.ts` sidebar pin fail. Fixing it touches the frozen sidebar list (D7), home shortcuts (BS-HOME-1) and `navigation.test.ts` characterization, so it needs a decision.
