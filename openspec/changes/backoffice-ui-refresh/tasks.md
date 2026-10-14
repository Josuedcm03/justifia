# Tasks: Backoffice UI Refresh (shell redesign and TanStack tables)

> Strict TDD. Inside every phase: RED task (test written, run, fails for the stated reason) -> GREEN task -> REFACTOR only when named. A task labelled "characterization pin" cannot be RED; it states how it was proven (mutation check).
>
> **Sources.** `proposal.md` (D1-D14, A1-A9), `design.md` (findings N1-N8, R1-R14; decisions 1-11; gates S1, V1), delta specs `specs/{backoffice-shell,data-table,users-listing,catalog-management}/spec.md`. Requirement IDs are written as in the specs: `BS-*` (backoffice-shell), `DT-*` (data-table), `UL:<requirement>` (users-listing, requirements have no IDs; short names below), `CM-LST-1` (catalog-management).
> **UL short names.** `UL:sort` = Column sorting; `UL:status` = Status filter; `UL:scope` = List parameters never widen the viewer scope; `UL:reset` = Changing the view returns to page 1; `UL:fields` = The browser receives only displayed fields; `UL:pag` = Server-side pagination (modified); `UL:soft` = Fail-soft (modified).
>
> **Tags.** `[GATE]` blocks the tasks named after it. `[OWNER]` needs a decision or action only the owner can give. `[READ-ONLY]` database/registry read allowed by project rules, still announced and confirmed before running through tooling. `[CONFIRM]` needs the owner's explicit "yes" for that exact command. `[MANUAL]` human verification (no E2E layer exists).
>
> **Hard rules for the implementer.**
> - **No database writes of any kind.** No migration, seed, push, `neon` write or write SQL. The only database step is the optional read-only gate S1 (task 0.7).
> - **Agents never commit, push, create branches or open PRs.** The owner commits. Each work unit ends with a `CHECKPOINT` task: stop with all gates green and report. A suggested conventional commit message is given (no AI attribution, no Co-Authored-By). The checkpoint tasks are stop points, not commit instructions.
> - **`src/app/globals.css` and every colour token are never modified.** Checked by an empty diff at every checkpoint (BS-DS-1).
> - **i18n rule.** Every i18n task edits BOTH `i18n/es.json` and `i18n/en.json` with identical key sets and non-empty values (BS-I18N-1, DT-I18N-1). New sections join `GUARDED_SECTIONS` in `src/i18n/catalog-parity.test.ts` first (RED), then the keys land (GREEN). Author only the keys a test strictly renders.
> - **Before writing any Next.js code** re-read the matching guide in `node_modules/next/dist/docs/` (AGENTS.md); the design's findings N1-N8 are the starting point, not a substitute.
> - **Tests never import `@/db` or `@/env`** except schema-only files: `vi.mock("server-only", () => ({}))`, `toSQL()` via `new QueryBuilder()` from `drizzle-orm/pg-core`.
> - **Flaky-test hygiene (FT).** Await async UI (`findBy*`, `waitFor`); no synchronous query after an interaction; render with the real `es`/`en` catalogs and a throwing `onError`; resolve every started promise inside `act`.
> - **V (unit verification)** at every checkpoint: the focused test command of the unit, `npm test`, `npm run typecheck`, `npx eslint src | rg -v 'Delete .␍.'` (CRLF noise is pre-existing; see `openspec/config.yaml` gotchas), `npm run format:check`, and `npm run build` when a route or config changed. "Green" means no failure outside the known flaky set recorded in 0.8.
> - **Coexistence rule.** The four old components (`src/components/data-table.tsx`, `data-table-pagination.tsx`, `data-table-search.tsx`, `status-filter.tsx`) and the old parsers stay alive and unedited until the slice that removes them (3d). Every slice leaves the app working and tests green.
> - **Batch note.** Executors have no memory tool: every `sdd-apply` batch appends a dated section to `openspec/changes/backoffice-ui-refresh/apply-progress.md` (tasks done, RED evidence, V results, authored lines by path, deviations, new locale keys). A task is not done until its batch note exists.

## Delivery

`delivery_strategy: exception-ok`. One single PR with an accepted `size:exception` (D14, supersedes D8 and Q9). Estimated 5,800-7,250 changed lines against the 800-line review budget. There is no chain. The ten slices are the internal implementation order and the natural commit boundaries; the owner makes every commit and opens the PR.

## Review Workload Forecast

| Work unit | Content | Est. changed lines | Tasks |
|---|---|---|---|
| Phase 0 | Verification gates, dependency install, apply-progress | ~30 (lock file excluded) | 11 |
| 1a Orientation | design-system doc, navigation config, sidebar identity, page context, header | 600-750 | 15 |
| 1b States and home | loading, error, shared states, role-aware home | 600-750 | 14 |
| 2a URL contract and users data layer | list-params, sort-sql, users read, page picking | 500-650 | 12 |
| 2b Table core | test helpers, list navigation, DataTable, sortable header | 500-650 | 12 |
| 2c Table controls | toolbar, status filter, pagination, ListTable | 650-850 | 9 |
| 2d Users migration | users table, users page | 450-550 | 8 |
| 3a Catalog URL contract and data layer | catalog list-params, asignaturas and docentes reads | 350-450 | 8 |
| 3b Asignaturas list | table module, page | 600-750 | 6 |
| 3c Docentes list | table module, page | 450-550 | 6 |
| 3d Bounded tables and removal | grupos, counts, errors tables; delete old components | 1,100-1,300 (about 780 pure deletions) | 12 |
| Final | gates, manual checklist, owner follow-ups | ~0 | 8 |
| **Total** | | **5,800-7,250 (+/-25%)** | **121** |

- **Chained PRs recommended:** No. Single PR by owner decision D14.
- **400-line budget risk:** High. The 400 and 800-line budgets are exceeded by roughly 7x to 9x; the overshoot is accepted.
- **Decision needed before apply:** No delivery decision. The size exception is already accepted by the owner (D14), so nothing about delivery blocks `sdd-apply`. The owner product/data confirmations OC-1 to OC-5 below block only the specific tasks that name them, not the whole apply.
- **Measurement.** Nothing is committed during apply, so measure each work unit as a delta by path (`git diff --numstat` for tracked files, `rg -c "" <file>` for untracked) and record it in `apply-progress.md`. If a slice passes its upper estimate by more than 25%, stop at the nearest seam and tell the owner; the single-PR decision still holds.

## Owner checkpoints (blocking, not assumptions)

| ID | Question | First blocks | Fallback if no answer |
|---|---|---|---|
| OC-1 | Approve installing `@tanstack/react-table` at the version chosen in 0.4 (exact, pinned) | 0.6 | Do not install; stop |
| OC-2 | Confirm running the two read-only collation queries on Neon (S1); if the collation is missing, decide the accent-order scenarios | 0.7, then 2a.7 | Fallback `lower(column)`; accent scenarios of DT-SORT-1, UL:sort and CM-LST-1 need an owner decision before 2a.7 |
| OC-3 | A-HOME-EMPTY: the `docente` home shows one short sentence under the header | 1b.9 | Implement the sentence as specified; flag in apply-progress |
| OC-4 | A-HOME-DEGRADED: a failed stats read shows the degraded alert instead of zeros | 1b.9 | Implement as specified (spec scenario "Stats read degrades") |
| OC-5 | A-HOME-SCOPE: home count cards show system-wide totals to `secretaria` (who lists only docentes) | 1b.9 | No new query is allowed (D9); counts stay as they are; record the confirmation |
| OC-6 | Docentes default order may move for accented or lowercase-initial names under Spanish collation (design Open Question 2; outcome depends on S1) | 3a.1 | Keep names on database default collation and record that accented names may sort after `Z` |

OC-3, OC-4, OC-5 are asked together at the start of slice 1b so the home tasks are not interrupted.

---

## Phase 0: Verification gates (before any code)

> No production code, no new test files that stay. Spikes in 0.6 and 0.9 are throwaway: they are deleted before the checkpoint. Outcomes are recorded in `apply-progress.md` (created in 0.1).

- [x] 0.1 Create `openspec/changes/backoffice-ui-refresh/apply-progress.md` with a dated Phase 0 section. Run `codegraph_explore` for the current consumers of `DataTable`, `StatusFilter`, `DataTablePagination`, `DataTableSearch` and `listUsuarios` and record them (design R2 says six `DataTable` consumers including `ErrorsTable`). [GATE for all later phases]
- [x] 0.2 Gate T1 part 1, read-only: run `npm view @tanstack/react-table version peerDependencies dist-tags` and read the current documentation through context7 (and the package docs) for: `useReactTable`, `getCoreRowModel`, `flexRender`, `ColumnDef`, `ColumnMeta` module augmentation, `manualSorting`, `manualPagination`, `manualFiltering`, `state.sorting`, `enableSorting`, `getIsSorted`. The registry reports latest 9.2.8 with `peerDependencies: { react: ">=18" }` (verified 2026-10-11); the design took API names from v8 documentation. Record, per API name, whether it exists unchanged in v9 and what replaced it. (design Interfaces, open question 6)
- [x] 0.3 Confirm that the react and react-dom peer range admits the project's installed React (19.2.x): read `package.json` and `npm ls react react-dom`. Record the result.
- [x] 0.4 [GATE] Decision T1: adopt v9 (and correct every API name in `design.md` "Interfaces / Contracts" with a dated addendum) or pin v8 (latest 8.x with `npm view @tanstack/react-table@8 version`). Record the decision, the exact version to install and the reasons in `apply-progress.md`. No table code (2b onward) is written before this task is done. Fallback: if v9 renames or removes any of the names above in a way that changes the DataTable design, pin v8.
- [x] 0.5 [OWNER] OC-1: ask the owner for explicit approval to install `@tanstack/react-table@<exact version from 0.4>` (changes `package.json` and the lock file). STOP and wait. Do not proceed to 0.6 without a "yes".
- [x] 0.6 After OC-1 only: install the exact approved version (`npm install --save-exact @tanstack/react-table@<version>`). Then `npm ls react` must show no peer conflict. Spike: create a throwaway file `src/test/spike-react-table.tsx` calling `useReactTable` inside a component, run `npx eslint src/test/spike-react-table.tsx` and record whether `react-hooks` rules report anything on it (design unverified item 3; React Compiler is not enabled, R13). Delete the spike. Fallback if the rule fires: record the exact rule and the narrowest `eslint-disable-next-line` justification to use in 2b.8, never a file-wide disable.
- [x] 0.7 [OWNER][READ-ONLY] Gate S1 (OC-2). Ask the owner to confirm, then run only these two read-only queries against the Neon database through available tooling, and record the results without credentials: `select collname from pg_collation where collname = 'es-x-icu'` and `select datcollate, datlocprovider from pg_database where datname = current_database()`. If the collation exists: `TEXT_SORT_COLLATION = "es-x-icu"` in 2a.6. If it is missing: the fallback is `lower(column)` under the database default; record it, and ask the owner to decide the fate of the accent-order scenarios (DT-SORT-1 "Accented names sort alphabetically", UL:sort accented scenario, CM-LST-1 "Collation, empty emails and status order") before 2a.7. Also record whether the database default collation is already Spanish or ICU, because the answer decides OC-6 for the docentes default order. [GATE for 2a.5-2a.8, 3a.1-3a.3]
- [x] 0.8 Baseline: run `npm test`, `npm run typecheck`, `npx eslint src | rg -v 'Delete .␍.'`, `npm run format:check`, `npm run build` on the untouched tree. Record results and the exact names of pre-existing failing or flaky tests (expected set per earlier changes: `denied/page.test.tsx`, `users/page.test.tsx`, `data-table-search.test.tsx`). If a dev server holds `.next` (port 3100 was used earlier), ask the owner to stop it; never kill it.
- [x] 0.9 Spike for the `next/link` question (design unverified item 3): a throwaway test `src/test/spike-link.test.tsx` rendering the real `next/link` with `onNavigate` and `scroll={false}`, clicking it in jsdom and recording whether `onNavigate` fires and whether `preventDefault` cancels it. Mock only `next/navigation`. Delete the spike. Outcome decides, in 2b.2, whether the `next/link` stand-in is needed (fallback: stand-in rendering an `a` that calls `onNavigate` on a plain click).
- [x] 0.10 Record the deferred gate V1 (does `(dashboard)/loading.tsx` re-show on a query-only navigation, N8) as an open item whose observation task is 2d.5, because it needs a real list. Record the baseline `git diff --stat` of `src/app/globals.css` (must be empty at every later checkpoint).
- [x] 0.11 CHECKPOINT: stop. Phase 0 changes only `package.json`, the lock file and `apply-progress.md`. Suggested commit: `chore(deps): add @tanstack/react-table`.

---

## Slice 1a: Orientation (shell context, navigation config, sidebar identity)

Satisfies: BS-CTX-1, BS-NAV-1, BS-NAV-2, BS-MOT-1 (`transition-all` removal), BS-A11Y-1, BS-I18N-1, BS-DS-1, BS-RSP-1 (identity block and top bar).
Estimate 600-750 lines.

- [x] 1a.1 `docs/design-system.md` (BS-DS-1, FIRST task of the first slice): add exactly the text of design decision 9: 4.2 brand block and identity block; 4.3 first-row diagram, page context and page frame; section 5 table sentence, table card, sortable header, loading skeleton, route error, shortcut card, pagination replacement, empty-state replacement (with no-results); section 6 appended bullets (hover-capable pointers, named transitions, no animation on rows, no press scale, motion never the only signal). Leave section 2 byte-identical. Verify `git diff src/app/globals.css` is empty and no colour, radius, type size or spacing step absent from the document is introduced (D13).
- [x] 1a.2 RED `src/lib/navigation.test.ts` (BS-NAV-1, BS-CTX-1, BS-HOME-1 inputs): characterization pin that `NAV_ITEMS` equals today's `items` of `src/components/app-sidebar.tsx` in content and order (read the file first; settings entry byte-identical in meaning, D7); `isCurrentPath` (`/` exact, equal or prefix plus `/`); `isNavVisible` per role; `trailFor` table-driven for every row of the BS-CTX-1 table including nested edit routes, `/profile` via `NAV_CONTEXT_ONLY`, and an unknown route returning null; `shortcutsFor` per role excludes the dashboard and `settings`. Prove the pin with a mutation check (reorder one entry, see it fail).
- [x] 1a.3 GREEN `src/lib/navigation.ts`: move `items` out of `app-sidebar.tsx` unchanged, export `NAV_ITEMS`, `NAV_CONTEXT_ONLY`, `isCurrentPath`, `isNavVisible`, `trailFor`, `shortcutsFor` per design Interfaces. Do not touch `app-sidebar.tsx` yet.
- [x] 1a.4 RED `src/lib/initials.test.ts` (BS-NAV-2 "Name edge cases"): one-word name gives one character, extra whitespace gives two, never empty or `undefined`, moved behaviour equals the current helper in `dashboard-header.tsx`.
- [x] 1a.5 GREEN `src/lib/initials.ts` (extracted from `src/components/dashboard-header.tsx`); `dashboard-header.tsx` imports it. REFACTOR: none other.
- [x] 1a.6 RED `src/i18n/catalog-parity.test.ts`: add `nav` (if not already guarded), `roles` and the future shell sections to `GUARDED_SECTIONS` for the keys of this slice; confirm it fails with the missing keys.
- [x] 1a.7 GREEN `i18n/es.json` and `i18n/en.json` (BS-I18N-1): `nav.context` (group and entry labels used by the trail, same wording as the sidebar), `nav.profile`, a `roles` namespace with one label per `RolUsuario`, and the aria label of the trail landmark. Author only the keys the next tests render; keep key sets identical.
- [x] 1a.8 RED `src/components/app-sidebar.test.tsx` (extend, do not weaken): BS-NAV-1 table-driven link lists per role in order; settings entry unchanged (label, icon, position, `/settings`); active marker on `/catalog/asignaturas/3/grupos/new` marks only Asignaturas with `aria-current`; Administration group hidden when empty; BS-NAV-2 identity footer shows initials "AP", name and role in `es` and in `en`, contains no link and no button and no popup trigger, avatar is `aria-hidden`, no data query. Existing ordered link-list assertions stay unchanged.
- [x] 1a.9 GREEN `src/components/app-sidebar.tsx`: import the config from `src/lib/navigation.ts`, add the `SidebarFooter` identity block (text only, no hover state, truncation for long names) with new prop `nombre`; `src/app/(dashboard)/layout.tsx` passes the user name (name and role come from the session already read by `requireUser`; no extra query). Brand block content unchanged.
- [x] 1a.10 RED `src/components/page-context.test.tsx` (BS-CTX-1): table-driven over the BS-CTX-1 path table in `es` and `en`; entry is text with `aria-current="page"` when exact, a link to the list without `aria-current` otherwise; group is muted text without a link; no record name or id ever appears; no trail for an unknown route; the `nav` has its own accessible label; only the entry shows below `md` (structural class assertion); it takes neither the sidebar bar nor `.is-current`. Use a `usePathname` mock.
- [x] 1a.11 GREEN `src/components/page-context.tsx` (client; `usePathname()` + `useTranslations`), per design decision 1.
- [x] 1a.12 RED structural test (BS-MOT-1 "No `all` transitions", `src/components/shell-motion.test.ts`): reads `theme-toggle.tsx`, `dashboard-header.tsx`, `app-sidebar.tsx` sources and asserts no `transition-all`. Also asserts `dashboard-header.tsx` renders `PageContext`. Then GREEN: `dashboard-header.tsx` renders `PageContext` on the leading side and uses the shared `initials`; `theme-toggle.tsx` replaces both `transition-all` with `transition-[scale,rotate]`; any motion stays under `motion-safe` or the existing reduced-motion rule (BS-MOT-1).
- [x] 1a.13 Landmark and focus check by test (BS-A11Y-1): sidebar `nav` and top-bar trail `nav` carry distinct accessible labels; trail contains no focus trap. Add to `page-context.test.tsx` or the sidebar test. Verify the existing sidebar breadcrumb pins in `src/app/(dashboard)/catalog/current-marker-usage.test.ts` still pass unchanged (R7, the trail adds no `.is-current`).
- [x] 1a.14 REFACTOR: remove dead code left in `app-sidebar.tsx` and `dashboard-header.tsx`; confirm no consumer imports the removed private constant (`codegraph_explore`).
- [x] 1a.15 CHECKPOINT: run V. `git diff src/app/globals.css` empty. Append the 1a batch note. Stop. Suggested commit: `feat(shell): page context, shared navigation config and sidebar identity block`.

---

## Slice 1b: States and home

Satisfies: BS-LOAD-1, BS-ERR-1, BS-STATE-1, BS-STATE-2, BS-FRM-1, BS-HOME-1, BS-RSP-1, BS-MOT-1, BS-A11Y-1, BS-I18N-1.
Estimate 600-750 lines.

- [x] 1b.1 [OWNER] OC-3, OC-4, OC-5: present the three home confirmations together (A-HOME-EMPTY, A-HOME-DEGRADED, A-HOME-SCOPE, wording in the table above) and STOP for answers. Record the answers in `apply-progress.md`. Tasks 1b.2 to 1b.8 do not depend on them and may proceed; 1b.9 may not.
- [x] 1b.2 RED `catalog-parity.test.ts`: add `shell` and `dashboard` to `GUARDED_SECTIONS`; confirm it fails. GREEN: add the keys the next tests render to `i18n/es.json` and `i18n/en.json` (skeleton label reuses `common.loading`; error title, explanation, retry, dashboard link, reference; empty and no-results copy; degraded text; dashboard shortcut titles and descriptions; empty-home sentence).
- [x] 1b.3 RED `src/components/degraded-alert.test.tsx` (BS-STATE-2): `role="status"`, localized text from props or catalog, not colour alone, same markup as the current alert (read an existing copy first). GREEN `src/components/degraded-alert.tsx` (hook-free).
- [x] 1b.4 RED `src/components/empty-state.test.tsx` (BS-STATE-1): variant `empty` (one sentence, optional create action) and `no-results` (title, hint, REQUIRED clear link; the term appears in the message when present; a missing clear link is a type error and a test failure). GREEN `src/components/empty-state.tsx` (hook-free).
- [x] 1b.5 RED `src/components/table-card.test.tsx` (BS-FRM-1, DT-PEND-1 markup, BS-MOT-1): frame classes `rounded-xl border shadow-soft overflow-hidden`; optional `toolbar` and `footer` regions in order with hairlines; footer region absent when not passed; `aria-busy` when pending; rows dim by `transition-opacity` only; no `transition-all`. GREEN `src/components/table-card.tsx` (hook-free).
- [x] 1b.6 RED `src/components/page-frame.test.tsx`: renders a `flex flex-col gap-8` stack. GREEN `src/components/page-frame.tsx`.
- [x] 1b.7 RED `src/app/(dashboard)/loading.test.tsx` (BS-LOAD-1): synchronous server component, `aria-busy`, the `common.loading` text visually hidden, title bar, context line and a table card with five skeleton rows, uses `ui/skeleton.tsx`, pulse is `motion-safe` only. GREEN `loading.tsx`.
- [x] 1b.8 RED `src/app/(dashboard)/error.test.tsx` (BS-ERR-1): given an error with message "secret internal detail" and a digest, it never renders the message, renders one `h1`, `role="alert"`, a primary "Try again" button calling `retry()` (props `error`, `retry`, per N4; not `reset`), a link to the dashboard, the digest as muted text when present, focus moves to the heading, button is 44px and keyboard operable. GREEN `error.tsx` (client component).
- [x] 1b.9 [GATE: OC-3, OC-4, OC-5 answered] RED `src/app/(dashboard)/page.test.tsx` (new; BS-HOME-1): table-driven per role (`estudiante` -> New request only; `docente` -> no cards and the message; `administrador` and `coordinacion` -> Asignaturas, Docentes, Users plus count cards; `secretaria` -> Asignaturas, Docentes, Import, Users plus count cards); each shortcut href equals its sidebar entry; no card links to `/settings` or `/`; `getDashboardStats` is not called for `estudiante` or `docente`; degraded stats read renders `DegradedAlert` and no zeros; one `h1`; a predicate change keeps sidebar and home in step (both read `src/lib/navigation.ts`). Mock `next-intl/server` with the key-echo translator like the other page tests.
- [x] 1b.10 GREEN `src/app/(dashboard)/page.tsx`: `requireUser()`, `shortcutsFor(rol)`, link cards (icon chip, title, one muted sentence, hover tint only on hover-capable pointers), count cards only when `canCreateUsers(rol)` with `getDashboardStats()` called only then, `DegradedAlert` on `degraded`, one sentence for a role with nothing, `PageFrame`.
- [x] 1b.11 RED+GREEN structural responsive test (BS-RSP-1, BS-A11Y-1): shortcut grid collapses to one column below `sm`, no fixed widths in the shell components, skeleton and error screen use wrapping classes. Where no class-level assertion is meaningful, record the item for the manual checklist (F.4).
- [x] 1b.12 Landmarks: `main` stays single; error screen and loading screen do not add a second `h1` beside a page `h1` (they replace the page content). Assert in the existing tests.
- [x] 1b.13 REFACTOR: none unless duplicated markup appears between `degraded-alert` and the three existing page copies (those pages are migrated in 2d, 3b, 3c; do not edit them here).
- [x] 1b.14 CHECKPOINT: run V including `npm run build` (new route-segment files). `git diff src/app/globals.css` empty. Batch note. Stop. Suggested commit: `feat(shell): loading and error boundaries, shared states and role-aware home`.

---

## Slice 2a: URL contract and users data layer

Satisfies: DT-URL-1, DT-URL-2, DT-URL-3, DT-SORT-1 (data), DT-DATA-1 (users), UL:sort, UL:status, UL:scope, UL:reset, UL:fields, UL:pag, UL:soft.
Estimate 500-650 lines. Database: read-only gate S1 is task 0.7 (must be answered before 2a.5).

- [x] 2a.1 RED `src/lib/list-params.test.ts` (DT-URL-1): table-driven `parseEnum`, `parsePageSize` (`0`, `-5`, `5`, `100`, `1000`, `10.5`, `010`, `abc`, empty, `1e1`, repeated -> 10; `10`, `25`, `50` honoured), `parseSort` (the sort/dir pairing rules: valid pair, valid sort with missing or invalid `dir` -> asc, invalid sort -> default pair and `dir` ignored; hostile values `hashClave`, `__proto__`, `name; DROP TABLE x`, 500 characters, other list's key, array), `nextSort` (same key flips, new key asc), `applyListChange` (any non-page change returns page 1; page-only change keeps the rest). Existing `page` and `q` tests unchanged.
- [x] 2a.2 GREEN `src/lib/list-params.ts` additions per design Interfaces (`PAGE_SIZE_OPTIONS`, `PageSize`, `DEFAULT_PAGE_SIZE`, `SortDir`, `ListSort`, `StatusFilterValue`, `parseEnum`, `parsePageSize`, `parseSort`, `nextSort`, `applyListChange`). Existing exports and behaviour of `page` and `q` byte for byte.
- [x] 2a.3 RED `src/lib/users/list-params.test.ts` (DT-URL-1, UL:sort, UL:status): `parseUsersListParams` defaults (`status all`, sort `created desc`, size 10); the fallback tables of DT-URL-1 and UL:sort/UL:status; `usersListHref` omits every default, writes `sort` and `dir` together or not at all, canonical order `q, status, sort, dir, size, page`, equals the DT-URL-1 "Generated links omit defaults" table. Existing tests unchanged.
- [x] 2a.4 GREEN `src/lib/users/list-params.ts`: `USERS_SORT_KEYS`, `USERS_DEFAULT_SORT`, `UsersListState`, extended parser and href builder. `USERS_PAGE_SIZE` stays exported, equal to `DEFAULT_PAGE_SIZE`.
- [x] 2a.5 [GATE: 0.7 answered] RED `src/lib/data/sort-sql.test.ts` (DT-SORT-1, UL:sort): with `new QueryBuilder()`, for every key and both directions `orderByFor` emits the whitelisted expression, then the list default key when it is not the chosen one, then `id` in the chosen direction; a key without a map entry does not compile (type-level `satisfies`); `TEXT_SORT_COLLATION` appears only for name and login columns; codes use the plain column; empty email uses `nullif(..., '')` with `nulls last` in BOTH directions; status `asc` means active first.
- [x] 2a.6 GREEN `src/lib/data/sort-sql.ts` (server-only): `orderByFor`, `TEXT_SORT_COLLATION` as the single place the collation is written (value per 0.7; fallback `lower(column)` is a one-line change), expression helpers.
- [x] 2a.7 [GATE: OC-2 if fallback taken] RED `src/lib/data/users-query.test.ts` (extend; DB-free): `buildUsersWhere(viewerRol, q, status)` keeps the role scope as the first unconditional term for a `secretaria` for every status value; status `active`, `inactive`, `all`; the default sort produces today's SQL text (`creadoEn desc, id desc`); every `USERS_SORT_KEYS` entry with both directions ends with `id`; the list projection contains none of `hashClave`, `cif`, `telefono`, `correo` (UL:fields scenario "The list read does not select private fields") while search by e-mail still builds its predicate (UL:fields "Search by e-mail still works"); `clampPage` with sizes 25 and 50 (DT-URL-3 "Page clamps for each size"); degraded result echoes the requested `pageSize`.
- [x] 2a.8 GREEN `src/lib/data/users.ts`: add `UsuarioListItem`, a narrowed list projection, `buildUsersWhere` with required `status`, `ListUsuariosParams` with `sort` and `pageSize: PageSize`, `orderByFor` with the users map (`name`/`login` collated, `role` plain, `status`, `created`), `{ data, degraded }` preserved. Leave `usuarioConRolColumns` and every other consumer (login, profile) unchanged: check callers with `codegraph_explore` before editing `listUsuarios`.
- [x] 2a.9 RED `src/app/(dashboard)/users/page.test.tsx` (extend; UL:scope, UL:fields, UL:soft, UL:pag): guard runs first; session role, never a URL value, reaches `listUsuarios`; `sort`, `dir`, `status`, `size` reach it parsed; hostile values (`sort='; DROP TABLE "Usuario"; --`, `size=9999`, `role=administrador`, `scope=all`) reach it as defaults; a mocked read result that includes `hashClave`, `cif`, `telefono`, `correo` produces props whose serialization (JSON) contains none of those keys or values, with each row exactly `{ id, nombreCompleto, login, rol, activo, creadoEnLabel }` (table-driven by forbidden field, for `administrador`, `secretaria`, `coordinacion`, with and without an e-mail-matching term); denied roles still redirect without reading; degraded with `status=inactive&sort=name&dir=desc&size=25&page=2` shows the alert, no table, no count. Existing assertions keep passing; update `listUsuarios` call expectations only.
- [x] 2a.10 GREEN `src/app/(dashboard)/users/page.tsx`: parse with `parseUsersListParams`, call the extended `listUsuarios`, build `UserRow[]` by picking the six fields explicitly (date label formatted on the server with `getFormatter` as today), keep rendering with the OLD table components. No new control appears yet.
- [x] 2a.11 Seam check: with `codegraph_explore` confirm no other caller relied on the old `ListUsuariosParams` shape (dashboard stats and any seed or script).
- [x] 2a.12 CHECKPOINT: run V. Record the S1 outcome and whether the fallback is active. Batch note. Stop. Suggested commit: `feat(users): validated sort, status and page-size parameters with a narrowed list projection`.

---

## Slice 2b: Table core

Satisfies: DT-SORT-1 (headers), DT-SORT-2, DT-MODE-1 (primitive), DT-DENS-1, DT-A11Y-1, DT-I18N-1, BS-MOT-1.
Estimate 500-650 lines. The package is already installed (0.6). Use the API names corrected in 0.4.

- [x] 2b.1 RED `src/test/intl.test.tsx`: `renderWithIntl(ui, locale)` renders with the real catalogs and throws on a missing key (generalize `src/app/(dashboard)/requests/new/test-support.tsx`, R9); `keyEchoIntl` echoes keys. GREEN `src/test/intl.tsx`.
- [x] 2b.2 RED+GREEN `src/test/navigation-mock.ts`: one hoisted `router` object with `push`, `replace`, `refresh`, `prefetch`, `back`, `forward` spies plus `usePathname`, consumed through `vi.mock("next/navigation", async () => (await import("@/test/navigation-mock")).module)`. Add the `next/link` stand-in only if 0.9 showed the real link is not clickable in jsdom; otherwise use the real one.
- [x] 2b.3 RED `src/components/tables/list-navigation.test.tsx` (DT-NAV-1, DT-PEND-1): `navigate(href, "push")` calls `router.push(href, { scroll: false })`; `"replace"` calls `router.replace(href, { scroll: false })`; `pending` is true while the transition runs and false after; the hook outside the provider throws a clear error.
- [x] 2b.4 GREEN `src/components/tables/list-navigation.tsx` (client): `ListNavigationProvider`, `useListNavigation` using `useTransition`. The href passed to the router is never built here (only by the pure builders, N5).
- [x] 2b.5 RED `src/components/tables/sortable-header.test.tsx` (DT-SORT-2, DT-DENS-1): a native `button` named by the column label inside the `th`; at least 44px tall with the offsetting negative margin so the label stays aligned (class assertions); direction icon differs for ascending, descending and unsorted-sortable and the column name stays available to assistive technology; Enter and Space activate `onSort` (keyboard via `user-event`); the `th` has `aria-sort` only when it is the sorted column; visible focus class; no `transition` on the header.
- [x] 2b.6 GREEN `src/components/tables/sortable-header.tsx`.
- [x] 2b.7 RED `src/components/tables/data-table.test.tsx` (DT-MODE-1, DT-SORT-1, DT-SORT-2, DT-A11Y-1): server-driven mode with `sorting` calls `onSort(column.id)` and never sorts, pages or filters rows itself; `aria-sort` values per the DT-SORT-2 table; non-sortable columns (actions) have no button and no `aria-sort`; bounded mode (no `sorting` prop) renders no button anywhere; zero rows render nothing; accessible name through the visually hidden caption plus the extra sentence that headers with a button sort the table (only when sortable); `th` with `scope="col"`; `getRowId` is used for keys; column `meta.align`/`className` applied; header row stays 48px.
- [x] 2b.8 GREEN `src/components/tables/data-table.tsx` (client) using `useReactTable` with `manualSorting`, `manualPagination`, `manualFiltering`, core row model only, `state.sorting` derived from the prop, rendering through `Table`, `TableHeader`, `TableRow`, `TableHead`, `TableCell` and `flexRender`; one module augmentation of `ColumnMeta`. Use the v8/v9 names recorded in 0.4. If 0.6 found a `react-hooks` finding, apply the narrow justified disable recorded there.
- [x] 2b.9 RED+GREEN `src/components/ui/table.tsx` (R12): a test (existing table test or a new structural one) asserting `TableRow` has no `transition-colors` and the hover tint is `hover:` only on hover-capable pointers (DT-SORT-2 "no animation", BS-MOT-1). Then remove `transition-colors`. Confirm the four old table components' tests still pass.
- [x] 2b.10 RED `catalog-parity.test.ts`: add `tables` to `GUARDED_SECTIONS`; GREEN `i18n/es.json` and `i18n/en.json` core keys only (sort button labels, caption sentence, sortable/ascending/descending indicator text) (DT-I18N-1).
- [x] 2b.11 Verify the table-card/`DataTable` boundary contract: function-valued `cell` renderers never cross a server boundary (the module is client, columns arrive from client modules, per decision 5). Add a one-line note to `apply-progress.md`.
- [x] 2b.12 CHECKPOINT: run V including `npm run build` (client bundle of the new dependency). Batch note with the 0.6 lint outcome. Stop. Suggested commit: `feat(tables): TanStack table core with accessible sortable headers`.

---

## Slice 2c: Table controls

Satisfies: DT-TOOL-1, DT-PAG-1, DT-NAV-1, DT-URL-2, DT-PEND-1, DT-STATE-1 (table versus empty versus no-results), DT-A11Y-1, DT-I18N-1.
Estimate 650-850 lines.

- [x] 2c.0 [OWNER, from the 2b follow-up] RED+GREEN `sortable-header.tsx`: the sort state is VISIBLE text (`aria-hidden`, so the button name stays the column label); `aria-sort` and the description are unchanged; it wraps on narrow widths; the parity test was extended first for `tables.sort.indicator.*`.
- [x] 2c.1 RED `catalog-parity.test.ts` guarded keys for the controls (toolbar label, search label and button, status filter options and group label, count text with ICU plural, "Updating…", page status "Page {page} of {pages}", rows-per-page label and options, first/previous/next/last labels, clear filters text); GREEN keys in both locale files.
- [x] 2c.2 RED `src/components/tables/status-filter.test.tsx` (DT-TOOL-1, DT-NAV-1): options are real links with real `href`s from `hrefFor`; the selected option has `aria-current`; activating one calls `navigate(href, "push")` through `onNavigate` and cancels default navigation; modifier-key clicks keep the default; `scroll={false}`; the group is labelled; 44px targets. GREEN `status-filter.tsx` in `src/components/tables/`.
- [x] 2c.3 RED `src/components/tables/table-toolbar.test.tsx` (DT-TOOL-1, DT-URL-2, DT-PEND-1): visible label on the input; typing alone changes nothing; submit (Enter) calls `navigate` with `push` and a href without `page` and with the other state kept; form has `method="get"`, `action` and hidden fields for the other parameters (design decision 6); the count region has `role="status"` and `aria-live="polite"` and reads "Updating…" while pending, then the count; focus is not moved by count changes; no literal `%`/`_` handling is changed (search semantics are untouched, D3). GREEN `table-toolbar.tsx`.
- [x] 2c.4 RED `src/components/tables/table-pagination.test.tsx` (DT-PAG-1, DT-NAV-1, DT-URL-2, DT-URL-3): bounds table (page 1/2/3 of 3 -> first/previous/next/last available or `aria-disabled` spans); real `href`s for first, previous, next, last that keep `q`, `status`, `sort`, `dir`, `size` and change only `page`; the current page marked for assistive technology; "1 of 1" page status with all four unavailable for 20 results at size 25; the size `select` offers exactly 10, 25, 50 with the current one selected, has an accessible name, and choosing 25 calls `navigate(href, "replace")` with `size=25` and page reset; `nav` landmark labelled; 44px targets; footer markup omitted by the caller when `total <= 10` (assert on `ListTable` in 2c.5, not here). GREEN `table-pagination.tsx`.
- [x] 2c.5 RED `src/components/tables/list-table.test.tsx` (DT-STATE-1, DT-PAG-1, DT-PEND-1, BS-FRM-1): given rows -> `TableCard` with toolbar, `DataTable`, footer in that order; footer omitted when `total <= 10` including zero; zero rows with no search and default filter -> `EmptyState` empty variant with the create action and no table; zero rows with a term or non-default filter -> no-results variant whose clear link equals the href with only the default state and page 1; `aria-busy` and dimmed rows while `pending`, previous rows stay visible and controls stay enabled; the empty/no-results decision is inside `ListTable` (there is no caller `empty` slot); the degraded case is not handled here (page renders `DegradedAlert` instead of `ListTable`).
- [x] 2c.6 GREEN `src/components/tables/list-table.tsx` composing `TableCard`, `TableToolbar`, `DataTable` or `EmptyState`, and `TablePagination`, with props per design (`columns`, `rows`, `getRowId`, `state`, `total`, `hrefFor(state)`, status options or none, labels, empty-state copy); uses `applyListChange` for every change.
- [x] 2c.7 REFACTOR: dedupe class strings between toolbar and pagination only if a third copy exists; do not touch old components.
- [x] 2c.8 Verify no old component imported the new ones and vice versa (`codegraph_explore`); the new kit has no consumer yet except tests.
- [x] 2c.9 CHECKPOINT: run V. Batch note. Stop. Suggested commit: `feat(tables): toolbar, status filter, first and last pagination and page-size selector`.

---

## Slice 2d: Users migration

Satisfies: UL:sort, UL:status, UL:reset, UL:fields, UL:pag, UL:soft, DT-URL-2, DT-NAV-1, DT-STATE-1, DT-PEND-1, BS-FRM-1, BS-STATE-1, BS-STATE-2.
Estimate 450-550 lines.

- [x] 2d.0 [OWNER, from the 2c follow-up] RED+GREEN `list-table.tsx` and its test: the no-results clear link clears ONLY the search term and the status filter and KEEPS `sort`, `dir` and `size`, returning to page 1; the target state is built with `applyListChange` from the current state (no href composed in the component). Supersedes the literal reading of the 2c.5 wording ("only the default state").
- [x] 2d.1 RED `catalog-parity.test.ts` guarded `users` section keys; GREEN `i18n/es.json` and `i18n/en.json`: column headers and labels, status filter option labels, empty-state copy ("new user" action), no-results copy; reuse existing keys where they exist (check `users.*` first).
- [x] 2d.2 RED `src/app/(dashboard)/users/users-table.test.tsx`: renders `UserRow`s with the real catalogs in `es` and `en`; name, login, role, status shown as text (not colour alone, DT-A11Y-1), created label as delivered; sortable headers exactly name, login, role, status, created; any action column is not sortable and has no `aria-sort`; row actions keep their accessible names; the delivered rows contain only the six fields (DT-DATA-1).
- [x] 2d.3 GREEN `src/app/(dashboard)/users/users-table.tsx` (client): builds columns in `useMemo`, renders `ListTable` inside `ListNavigationProvider`, uses `useTranslations` for headers and labels.
- [x] 2d.4 RED+GREEN `users/page.test.tsx` and `users/page.tsx`: the page renders `PageFrame`, `UsersTable`, `DegradedAlert` on degraded (no table, no count, no no-results), and `EmptyState`/no-results through `ListTable`; assertions move from key-echo column headers to sort buttons where sortable; "first"/"last" joined to previous/next; `listUsuarios` expectations gain `status`, `sort`, parsed `pageSize`; add the navigation mock and `keyEchoIntl` lines (two lines per design). Existing guard-first and denied-role assertions stay.
- [ ] 2d.5 [MANUAL] Gate V1 (N8): in `next dev` and in a production build (`npm run build` then `npm start` on a free port; ask the owner if a server already holds `.next`), observe whether a sort click or page-size change on `/users` shows the `loading.tsx` skeleton. Record the outcome in `apply-progress.md`. If it does NOT show: nothing changes. If it does: keyboard focus on the toolbar is lost; implement the contingency (module-level "last control id" in `list-navigation.tsx`, restored in an effect when the table mounts, about 15 lines) with a RED test first, to hold DT-SORT-2 "focus stays on the same header control".
- [ ] 2d.6 [MANUAL] Users list smoke by the implementer in the dev server as `administrador` and `secretaria`: sort cycle (asc then desc), status filter, size 25/50, first/last, search by e-mail fragment, back-button behaviour (sort/size replace, page/filter/search push). Record observations only; do not run any database write. Seed or data is whatever the dev environment already holds.
- [x] 2d.7 Confirm the old `DataTable`, `DataTablePagination`, `DataTableSearch`, `StatusFilter` are no longer imported by `users/` and still used by the catalog pages and import (`codegraph_explore`).
- [ ] 2d.8 CHECKPOINT: run V including `npm run build`. Batch note including the V1 outcome. Stop. Suggested commit: `feat(users): TanStack list with sorting, status filter and page-size selector`.

---

## Slice 3a: Catalog URL contract and data layer

Satisfies: CM-LST-1 (parameters, ordering, scope, fallbacks), DT-URL-1, DT-URL-3, DT-SORT-1 (data), DT-DATA-1 (docentes, asignaturas).
Estimate 350-450 lines.

- [x] 3a.1 [OWNER] OC-6 ANSWERED (owner, 2026-10-12): alphabetical; the docentes default `name asc` uses `TEXT_SORT_COLLATION` (`es-x-icu`), no stop needed. Original task text: present the docentes default-order consequence with the S1 outcome recorded in 0.7 (whether the database default is already Spanish/ICU) and ask the owner to accept the possible change or choose the alternative (names on the database default, accented names may sort after `Z`). STOP and wait. Record the answer; it decides `TEXT_SORT_COLLATION` use for the docentes `name` default only.
- [x] 3a.2 RED `src/lib/catalog/list-params.test.ts` (CM-LST-1, DT-URL-1): `parseAsignaturasListParams` and `parseDocentesListParams` defaults (`status active`, sort `code asc` / `name asc`, size 10); the fallback tables (`groups`, `actions`, `hashClave`, `cif`, `password`, `Name`, `name;`, empty, `hours` on docentes, `email` on asignaturas, repeated); `dir` rules; `catalogListHref(base, state)` omits defaults and writes `sort` and `dir` together in canonical order. The old `parseCatalogListParams` tests stay unchanged.
- [x] 3a.3 GREEN `src/lib/catalog/list-params.ts`: `ASIGNATURAS_SORT_KEYS`, `DOCENTES_SORT_KEYS`, `CatalogListState<K>`, the two parsers, extended `catalogListHref`. `CATALOG_PAGE_SIZE` and `parseCatalogListParams` stay until 3c.
- [x] 3a.4 RED `src/lib/data/asignaturas.test.ts` (extend; CM-LST-1): sort map for `code`, `name`, `hours`, `status` both directions ends with `id`; default order equals today's `codigo asc` plus `id asc`; `name` collated, `code` plain; scope by Carrera unchanged for a `coordinacion` actor with extra parameters ignored; search fields unchanged (CM-ASG-9); clamp with sizes 25 and 50; degraded echoes `pageSize`.
- [x] 3a.5 GREEN `src/lib/data/asignaturas.ts` list function with the map and `orderByFor`. `listMatchingGrupos` and search predicates untouched (D3).
- [x] 3a.6 RED `listDocentes` tests (existing test file or new `src/lib/data/docentes.test.ts` if none exists): sort map `name`, `login` collated, `email` using `nullif` with `nulls last` in both directions, `status` active first; default `name asc, id asc`; projection and returned items contain no `HashClave`, password, temporary password or `Cif` (CM-LST-1 "Docentes list carries no credential", DT-DATA-1); not Carrera-scoped.
- [x] 3a.7 GREEN `listDocentes` in its data module with the map, `status` filter semantics unchanged, `size` parameter.
- [ ] 3a.8 CHECKPOINT: run V. The catalog pages still use the old table components and ignore `sort` and `size` (parsers unchanged for them), so the app is unchanged for users. Batch note. Stop. Suggested commit: `feat(catalog): validated sort and page-size parameters and whitelisted catalog orderings`.

---

## Slice 3b: Asignaturas list

Satisfies: CM-LST-1 (asignaturas), DT-URL-2, DT-SORT-1/2, DT-PAG-1, DT-STATE-1, DT-DATA-1, BS-FRM-1.
Estimate 600-750 lines.

- [x] 3b.1 RED `catalog-parity.test.ts` and keys for the asignaturas list (headers, hours, groups column label, empty/no-results copy); GREEN in both locale files, reusing existing `catalog.asignaturas.*` keys.
- [x] 3b.2 RED `src/app/(dashboard)/catalog/asignaturas/asignaturas-table.test.tsx`: sortable headers exactly code, name, hours, status; the Groups column and the action column have no button and no `aria-sort`; the `DiasCell`/groups cell content equals today's; status as text; row edit action name kept; `AsignaturaListItem` rows only (DT-DATA-1).
- [x] 3b.3 GREEN `asignaturas-table.tsx` (client) using `ListTable` inside `ListNavigationProvider`.
- [x] 3b.4 RED `asignaturas/page.test.tsx` updates: guard first; `status`, `sort`, `dir`, `size` reach the data function parsed and hostile values reach it as defaults; Carrera scope never widened by `carrera=Y` or `scope=all`; degraded with `sort=name&dir=desc&size=25&page=2` shows `DegradedAlert` only; no results with a term shows the no-results state with a clear link that returns to the default; default status stays `active`. GREEN `asignaturas/page.tsx`: `parseAsignaturasListParams`, `PageFrame`, `AsignaturasTable`, `DegradedAlert`, "new asignatura" action in the empty state.
- [x] 3b.5 Confirm `current-marker-usage.test.ts` and the Asignaturas page breadcrumb pins still pass unchanged; confirm `AsignaturaGruposSection` still uses the old table (3d).
- [ ] 3b.6 CHECKPOINT: run V including `npm run build`. [MANUAL] quick smoke on `/catalog/asignaturas` as `coordinacion` and `secretaria` (sort cycle, status filter, size, first/last). Batch note. Stop. Suggested commit: `feat(catalog): TanStack asignaturas list with sorting and page-size selector`.

---

## Slice 3c: Docentes list

Satisfies: CM-LST-1 (docentes), DT-URL-2, DT-SORT-1/2, DT-PAG-1, DT-STATE-1, DT-DATA-1.
Estimate 450-550 lines.

- [x] 3c.1 RED `catalog-parity.test.ts` and keys for the docentes list; GREEN in both locale files, reusing existing keys.
- [x] 3c.2 RED `catalog/docentes/docentes-table.test.tsx`: sortable headers exactly name, login, email, status; empty email cell renders the existing placeholder (read the current page first) and sorts last; rows contain only displayed fields and the id, serialized props contain no `HashClave`, password, temporary password or `Cif`; link to `/users` kept; no create/edit/deactivate control (read-only).
- [x] 3c.3 GREEN `docentes-table.tsx` (client).
- [x] 3c.4 RED `docentes/page.test.tsx` updates (parameter parsing, hostile values, degraded with new parameters, read-only and unscoped scenario for a `coordinacion` of Carrera X, link to `/users`, serialized delivered data has no credential). GREEN `docentes/page.tsx` using `parseDocentesListParams`, `PageFrame`, `DocentesTable`, `DegradedAlert`.
- [x] 3c.5 Check whether `parseCatalogListParams`, `CATALOG_PAGE_SIZE` and old `catalogListHref` signature still have consumers (`codegraph_explore`). If none outside 3d's import preview, leave removal to 3d.12 for a single reviewable deletion.
- [ ] 3c.6 CHECKPOINT: run V including `npm run build`. [MANUAL] smoke on `/catalog/docentes`. Batch note. Stop. Suggested commit: `feat(catalog): TanStack docentes list with sorting, email-last ordering and page-size selector`.

---

## Slice 3d: Bounded tables and removal of the old components

Satisfies: DT-MODE-1, DT-DATA-1 (Grupos), DT-A11Y-1, DT-I18N-1, CM-ASG-7 (unchanged order and cap, no spec edit), BS-STATE-2 ("Used inside a section").
Estimate 1,100-1,300 lines (about 780 are pure deletions).

- [x] 3d.1 RED `catalog/asignaturas/asignatura-grupos-table.test.tsx` (DT-MODE-1): bounded mode, props `{ rows, asignaturaId, caption }`; headers, status labels, edit label and day names obtained through `useTranslations` (`catalog.asignaturas.grupos`, `catalog.shared.status`, `catalog.shared.dias`); no sort button, no pagination, no toolbar, no URL parameter; row order preserved as given; edit link target preserved; `DiasCell` called unchanged; zero rows render nothing; rows carry only displayed fields and the id.
- [x] 3d.2 GREEN `asignatura-grupos-table.tsx` (client, bounded `DataTable`).
- [x] 3d.3 RED `asignatura-grupos-section` tests (existing or new): section stays a server component rendering heading, add link, hints, `DegradedAlert` ("Used inside a section": groups read fails, rest of the page renders), empty state and the cap note for more than 100 groups with the 100 newest in order period desc, group number asc, id asc (CM-ASG-7); `AsignaturaGruposLabels` shrinks to the strings the server part renders; `editLabel`, `diaShort`, `diaLong` no longer travel to the client. GREEN `asignatura-grupos-section.tsx` and the edit page `[id]/edit/page.tsx` (+ test) wiring.
- [x] 3d.4 RED `catalog/import/import-preview` test (`CountsTable`, DT-MODE-1 "fixed matrix"): same figures and layout as before, column headers and accessible name, no sort or paging. GREEN `import-preview.tsx` migrated to bounded `DataTable`.
- [x] 3d.5 RED `catalog/import/import-errors` test (`ErrorsTable`, design R2, DT-MODE-1 "Import errors table is unchanged"): errors on "Asignaturas" row 4, "Grupos" row 9 reason `dias.invalid` value "Luns", and one workbook-wide error row 0 shown as a dash; four columns sheet/row/reason/value; reason text from the catalog or the raw code; order as reported; no sort or paging. GREEN `import-errors.tsx` migrated. `catalog-excel-import` spec gains no requirement.
- [x] 3d.6 Confirm with `codegraph_explore` that nothing imports `src/components/data-table.tsx`, `data-table-pagination.tsx`, `data-table-search.tsx` or `status-filter.tsx` any more (tests excluded).
- [x] 3d.7 Update `src/app/(dashboard)/catalog/current-marker-usage.test.ts` (R7): it reads `src/components/status-filter.tsx` and `data-table-search.tsx` by path; point it at the new `src/components/tables/*` files or drop only the assertions that referred to the deleted files, keeping the four-breadcrumb `.is-current` pin intact. Run it GREEN before deleting.
- [x] 3d.8 Delete the four old components and their four tests: `src/components/data-table.tsx`, `data-table-pagination.tsx`, `data-table-search.tsx`, `status-filter.tsx` and their `*.test.tsx`. Run `npm test` immediately; fix any stale reference. (The pre-existing flaky `data-table-search.test.tsx` disappears with its component; record it.)
- [x] 3d.9 Remove now-unused i18n keys in BOTH locale files (`catalog.shared.filter`, per-list pagination keys, any key whose last consumer was a deleted component) after proving they are unused with `rg` on `src`; update `GUARDED_SECTIONS` if a section is gone. Parity test stays green.
- [x] 3d.10 Remove `parseCatalogListParams` and the old pagination page-size constants only if `codegraph_explore` shows no consumer; otherwise record why they stay.
- [x] 3d.11 Re-verify DT-DENS-1 "Header height" and BS-MOT-1 "No `all` transitions" over the whole `src/components` and `src/app` trees with a structural test or an `rg` check recorded in `apply-progress.md`.
- [ ] 3d.12 CHECKPOINT: run V including `npm run build`. Batch note. Stop. Suggested commit: `refactor(tables): bounded TanStack tables for grupos and import, remove legacy table components`.

---

## Final phase: Verification and hand-off

- [ ] F.1 Full gates on the final tree: `npm test` (no failure outside the 0.8 set), `npm run typecheck`, `npx eslint src | rg -v 'Delete .␍.'`, `npm run format:check`, `npm run build`. Record exact results.
- [ ] F.2 Compliance sweeps recorded in `apply-progress.md`: `git diff src/app/globals.css` empty (BS-DS-1); `i18n/es.json` and `i18n/en.json` key sets identical (parity test green, DT-I18N-1, BS-I18N-1); no `transition-all` remains in changed files (BS-MOT-1); no `hashClave`, `cif`, `telefono` or `correo` key in any props passed to a client table (DT-DATA-1, UL:fields); every sortable column has a `Record` entry in its sort map; `docs/design-system.md` describes every pattern listed in BS-DS-1.
- [ ] F.3 Traceability matrix in `apply-progress.md`: each BS-*, DT-*, UL:* and CM-LST-1 scenario mapped to the test file (or the manual item) that covers it, for `sdd-verify`.
- [ ] F.4 [MANUAL] Checklist, ticked by the owner or implementer, recorded in `apply-progress.md`:
  - 320px and 360px: no horizontal scroll from 360px on shell and home for each role (BS-RSP-1, RNF-11); no clipping at 320px; staff tables scroll inside their card only.
  - Keyboard: tab order through sidebar, top-bar trail, toolbar, headers, rows, footer; Enter and Space on sort buttons; focus stays on the header after a sort; visible focus everywhere (DT-SORT-2, BS-A11Y-1).
  - Reduced motion (`prefers-reduced-motion: reduce`): skeleton static, pending table shows text and `aria-busy`, theme toggle and sidebar do not move (BS-MOT-1).
  - Light and dark themes, both brands: shell, home, tables, error screen, skeleton, identity block; contrast and focus ring visible.
  - Locale switch `es`/`en`: trail, role label, table strings (DT-I18N-1).
  - Touch pointer: no latched hover styles (BS-MOT-1).
  - Error screen: temporarily throw in a dev-only page to see the screen and the retry (do not commit the throw).
- [ ] F.5 [OWNER] `docs/roadmap.md` needs a row for this change (the proposal suggests: `9 | backoffice-ui-refresh | Transversal de interfaz: RNF-01, RNF-11 (pantallas compartidas); contribuye a RNF-10 | Josué | No | en curso`). This is the owner's edit: no agent edits `docs/roadmap.md`. Remind the owner at archive time to set the status.
- [ ] F.6 [OWNER] Confirm the spec edits that archive will merge: users-listing "Assumptions withdrawn or changed at archive", and that CM-ASG-7, CM-NAV-1, CM-UX-1 are unmodified.
- [ ] F.7 Leave the working tree with all slices uncommitted or committed as the owner prefers; list the final `git status` and the per-slice changed-line measurements (compare with the Review Workload Forecast) in `apply-progress.md` so the owner can fill the `size:exception` justification in the PR.
- [ ] F.8 CHECKPOINT: stop. Hand off to `sdd-verify`. Suggested final commit if the owner squashes the tail: `docs(ui): finalize backoffice refresh verification notes`.

---

## Suggested `sdd-apply` batches

| Batch | Work units | Why | Lines | Stops for the owner |
|---|---|---|---|---|
| A | Phase 0 | Gates; nothing else may start; ends with `package.json` | ~30 | OC-1, OC-2 |
| B | 1a | Shell orientation; independent of TanStack | 600-750 | none |
| C | 1b | States and home | 600-750 | OC-3, OC-4, OC-5 (asked at the start) |
| D | 2a | Users data layer and security projection; needs the S1 answer | 500-650 | OC-2 only if fallback |
| E | 2b + 2c | The table kit in one pass (shared test helpers; no consumer until 2d) | 1,150-1,500 | none |
| F | 2d | First consumer; contains gate V1 and manual smoke | 450-550 | none |
| G | 3a + 3b | Catalog data layer and the asignaturas list | 950-1,200 | OC-6 (start of 3a) |
| H | 3c + 3d | Docentes, bounded tables and deletions | 1,550-1,850 | none |
| I | Final | Gates, matrix, manual checklist | ~0 | F.4, F.5 |

Batches E and H are the largest; if a batch overruns, split at the slice seam (2b | 2c, 3c | 3d), never inside a slice. Commit by slice, in the order above, so the owner can revert in reverse order.

## Risks and dependencies

- Phase 0 is a hard serial dependency: 0.4 decides the table API names for 2b onward; 0.7 decides the sort helper for 2a.5 onward.
- v9 versus v8: if v9 differs in structure, the design's `DataTable` sketch may need a larger addendum, increasing 2b-2c beyond estimate.
- Docentes default order may move (OC-6); the fallback leaves accented names after `Z` when the database collation is `C`.
- Single-PR size (5,800-7,250 lines) with a low-confidence estimate (+/-25%); mitigated by slice checkpoints and per-slice measurements.
- Batch H carries about 780 lines of deletions that look large but are mechanical; review deletions separately with `git diff --stat`.
- No E2E layer: responsive and motion requirements rely on structural tests plus the manual checklist F.4.
