# Exploration: backoffice-ui-refresh

## Summary

Search, filter and pagination already work on every list. They are server-side
and URL-driven through `<form method="get">` and real `<Link>`s, so nothing is
broken to "leave functional". The only missing list control is sorting. The
recommended integration is TanStack Table in manual mode, driven by URL params.
The shell refresh plus all migrations will not fit the 800-line review budget:
the estimate is about 1,500–2,300 changed lines.

## Current State

### Shell

The structure is sound; the gaps are polish, orientation and missing pieces.

- `src/app/(dashboard)/layout.tsx` wraps the pages in `SidebarProvider`,
  `AppSidebar`, `SidebarInset` and `DashboardHeader`, then
  `<main><div class="shell">`.
- `src/components/app-sidebar.tsx` is a client component.
  - Items are the dashboard, new request, an "Administration" collapsible group
    (catalog asignaturas, docentes, import, users) and settings.
  - Items are filtered by the same `can*` predicates the pages use, and the
    active item gets a 4px primary bar plus `aria-current`.
  - The header is just the logo and app name.
- `src/components/dashboard-header.tsx` is a server component with a sticky
  64px bar. It holds a sidebar trigger plus the locale switcher, theme toggle
  and user dropdown. It shows no title, breadcrumb or role context.
- `src/components/page-header.tsx` is the shared title, description and action
  block.
- Breadcrumbs exist (`ui/breadcrumb.tsx`) but only on the 5 create/edit pages,
  not on list pages.
- `src/app/(dashboard)/page.tsx` is the dashboard home. It has two metric cards
  (total and active users), the same for every role, and says nothing about
  justifications.

Concrete weaknesses, each with evidence:

1. The nav entry `settings` (`/settings`, in `app-sidebar.tsx`) has no route:
   `src/app/**/settings` does not exist. `app-sidebar.test.tsx` asserts the
   entry exists. This is a dead link.
2. There is no `loading.tsx` or `error.tsx` anywhere under `src/app`. The only
   boundary is `catalog/not-found.tsx`. Every navigation, including URL-driven
   pagination, has no skeleton or pending state. `ui/skeleton.tsx` exists but
   is unused by pages.
3. The header carries no page context, and the sidebar has no user, role or
   institution footer. The user's name and role are only inside the dropdown.
4. The dashboard home is thin and role-agnostic (only the users stats card).
5. The table frame repeats the same pattern
   (`border-border bg-card shadow-soft overflow-hidden rounded-xl border` is
   copy-pasted 4 times).
6. `EmptyOrNoResultsState` is copy-pasted in `users/page.tsx`,
   `asignaturas/page.tsx` and `docentes/page.tsx`. The degraded alert is
   copy-pasted 4 times.

### What `docs/design-system.md` allows or mandates

- It already fixes the white 260px sidebar, the 64px white top bar, the 1440px
  `.shell`, the allowed spacing steps and the type scale.
- It fixes the table style (muted `label-caps` header, horizontal dividers
  only, row hover at primary 5%) and the 44px pagination.
- It fixes a single `shadow-soft` and motion of 150ms/250ms on `--ease-ui`.
- `AGENTS.md` and `openspec/config.yaml` forbid new colours, radii, type sizes
  or spacing steps unless added to the document first. So "better template"
  must be a polish within these tokens, not a redesign, unless the design
  system is updated first.
- The `better-ui` skill rules apply and agree with the design system: motion
  gated behind `prefers-reduced-motion`, transitions that name their
  properties (no `transition-all`), hover styling only on hover-capable
  pointers, press scale 0.96 only where a project convention allows it.

### Inventory of every table and list

| # | Path | Server or client | Columns / actions | Search / filter / sort / pagination today |
|---|---|---|---|---|
| 1 | `src/app/(dashboard)/users/page.tsx` | Server (RSC) | name, login, role, status pill, created date. No row actions. | Search by `q` (GET form, `DataTableSearch`). Page-based pagination (size 10, `DataTablePagination` links). No status filter and no sort (fixed `creadoEn desc, id desc`). |
| 2 | `src/app/(dashboard)/catalog/asignaturas/page.tsx` | Server | code, name (with matching groups list), career, hours, groups, status, Edit link | Search, `StatusFilter` (active/inactive/all, links), pagination (size 10). No sort (fixed `codigo asc`). |
| 3 | `src/app/(dashboard)/catalog/docentes/page.tsx` | Server | name, login, email, status. No row actions. | Search, `StatusFilter`, pagination. No sort (fixed `nombreCompleto asc`). |
| 4 | `src/app/(dashboard)/catalog/asignaturas/asignatura-grupos-section.tsx` (asignatura edit page) | Server, no directive | period, group number, docente, days (`DiasCell`), status, Edit link | None. Bounded list (cap `ASIGNATURA_GRUPOS_MAX` = 100) with a "truncated" note. |
| 5 | `src/app/(dashboard)/catalog/import/import-preview.tsx` (`CountsTable`) | Client (`"use client"`) | 3 fixed rows (Asignatura, Usuario, Grupo) by 6 count columns | None, and none needed. Fixed summary matrix. |
| 6 | `src/app/(dashboard)/catalog/import/workbook-contract.tsx` (`HeaderStrip`) | Server | One-row static header strip of the workbook contract. | Static copy, not a data table. Do not migrate. |
| 7 | `src/app/(dashboard)/profile/page.tsx` | Server | `<dl>` key/value card | Not a table. |

Tables 1–5 render through the shared `src/components/data-table.tsx`, a plain
server component (no directive) that takes
`columns[].cell: (row) => ReactNode`. `ui/table.tsx` is a `"use client"` module
with plain primitives. The `{data, degraded}` shape is handled in each page.

### List-params plumbing

- `src/lib/list-params.ts`: `RawSearchParams`, `firstValue`, `parsePage`,
  `parseQ`, `listHref`.
- `src/lib/users/list-params.ts`: `USERS_PAGE_SIZE = 10`,
  `USERS_SEARCH_MAX = 100`, `parseUsersListParams`, `usersListHref`.
- `src/lib/catalog/list-params.ts`: `CATALOG_PAGE_SIZE`,
  `parseCatalogListParams` (page, q and status; unknown status falls back to
  `active`), `catalogListHref`.
- Data layer: `listUsuarios`, `listDocentes` (`src/lib/data/users.ts`) and
  `listAsignaturas` (`src/lib/data/asignaturas.ts`). Each runs a count query,
  clamps the page with `clampPage`, then queries with `limit` and `offset`. A
  failure returns `{ data: [], total: 0, page: 1, degraded: true }`.
- Search, filter and pagination are therefore 100% server-side and URL-driven,
  and verified by `page.test.tsx` (users, asignaturas, docentes),
  `data-table-search.test.tsx`, `data-table-pagination.test.tsx`,
  `status-filter.test.tsx`, `users/list-params.test.ts` and
  `catalog-parity.test.ts`.

Real gaps against the request:

- No sorting on any list; the order is hard-coded in SQL.
- No page-size choice and no first/last/page-number navigation (only previous
  and next).
- Users has no status or role filter, although `activo` and `rol` exist.
- Search is submit-only (no live search or debounce). That was a deliberate
  decision in `roles-lookup-table` (submits on Enter, works without
  JavaScript).
- No loading feedback on any transition (no `loading.tsx`).

Suggested reframing for the proposal: "preserve all current behaviour, and add
column sorting, a status filter on users and loading state".

### Next.js 16.3.4 documentation facts checked

Source: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/`.

- `use-search-params.md`: the hook is client-only and read-only; server code
  should read the page's `searchParams` prop and pass it down.
- `use-search-params.md`: in a prerendered route the client tree up to the
  nearest `<Suspense>` renders client-side, so wrap any client component using
  it in `<Suspense>`.
- `use-router.md`: `router.push` and `router.replace` accept
  `{ scroll: false }`, the right option for sort, filter and page changes;
  they must not receive untrusted URLs.
- Not read in full: `page.md` and the caching docs. These pages call
  `requireRole` and read `searchParams`, so they should be dynamic; confirm
  during design.

## Affected Areas

- `package.json` — add `@tanstack/react-table` (not a dependency today).
- `src/components/data-table.tsx` and `data-table.test.tsx` — rewritten as a
  client TanStack wrapper.
- `src/components/data-table-pagination.tsx`, `data-table-search.tsx`,
  `status-filter.tsx` and their tests — adapted or re-implemented.
- `src/app/(dashboard)/users/page.tsx` and `page.test.tsx`.
- `src/app/(dashboard)/catalog/asignaturas/page.tsx` and `page.test.tsx`
  (658 lines).
- `src/app/(dashboard)/catalog/docentes/page.tsx` and `page.test.tsx`
  (578 lines).
- `src/app/(dashboard)/catalog/asignaturas/asignatura-grupos-section.tsx` —
  its `labels` prop contains functions (`editLabel`, `diaShort`, `diaLong`),
  which cannot cross a Server to Client boundary as they stand.
- `src/app/(dashboard)/catalog/import/import-preview.tsx` and its test
  (465 lines).
- `src/lib/list-params.ts`, `src/lib/users/list-params.ts`,
  `src/lib/catalog/list-params.ts` and `src/lib/data/*` — if sorting is added
  (whitelist of sortable columns plus `orderBy` in three data functions).
- Shell: `src/app/(dashboard)/layout.tsx`, `src/components/app-sidebar.tsx`
  (+ `app-sidebar.test.tsx`, 726 lines), `dashboard-header.tsx`,
  `page-header.tsx`, `src/app/(dashboard)/page.tsx`, new `loading.tsx` and
  `error.tsx` files.
- `i18n/es.json` and `i18n/en.json` — new keys, always in both files.
- `docs/design-system.md` — any new token or pattern must be added here first.

## Approaches (TanStack integration)

| Approach | Pros | Cons | Effort |
|---|---|---|---|
| **A. Manual mode, URL as state, server fetch** | Keeps the data model (server `limit/offset`, `{data, degraded}`, RBAC and scope in SQL). Adds sorting cleanly. Keeps deep links, back button and shareable URLs. No large data shipped to the client. Fits the existing `parse*ListParams` seam and tests. | Requires a client boundary (`useReactTable` is a hook). Column `cell` functions defined in server pages cannot be passed as props, so column definitions move into client modules using `useTranslations`/`useFormatter`. Page tests need `next/navigation` and next-intl client mocks. No-JS progressive enhancement is lost unless kept deliberately. | Medium–High |
| **B. Fully client-side tables** | Simplest TanStack usage; instant filter and sort. | Ships the full dataset to the browser. Moves search semantics (accent folding, LIKE escaping, scope rules, matching groups) from SQL to JS and duplicates RBAC-scoped queries. Loses `{data, degraded}` and URL state; makes list-params tests obsolete. | High |
| **C. Hybrid (recommended shape of A)** | Manual mode for the 3 server lists; plain client TanStack for the small bounded tables (grupos section, import counts), which need no URL state. One shared `DataTable` client component with a single column-def pattern. | Two usage modes to document. | Medium |

## Recommendation

Choose **C**.

- TanStack in `manualPagination`, `manualFiltering` and `manualSorting` mode for
  the three server lists. The server stays the source of truth; the URL carries
  `page`, `q`, `status` and a new `sort`/`dir` pair.
- Client-only TanStack for the grupos section and the import counts.
- Keep `parse*ListParams`, `catalogListHref` and the `clampPage` guard; extend
  them with a whitelisted `sort` and `dir`.
- Use `router.replace(..., { scroll: false })` inside `startTransition` and
  wrap the toolbar in `<Suspense>`.
- Keep no-JS-friendly behaviour where cheap (the toolbar can stay a real GET
  form).
- Wrap TanStack's `<table>` in the existing `ui/table.tsx` primitives so the
  design system's table style is unchanged.
- Server-render the first paint (rows as plain serializable props) and add a
  `loading.tsx` skeleton.
- Main tradeoff: a new client component boundary. Each column definition moves
  out of the server page into a client module, and page tests must mock
  `next/navigation` and `next-intl`.

"Better template" should concretely cover, all within the existing tokens:

1. Fix or remove the dead `/settings` entry (product call).
2. Add list-page context: breadcrumbs or page title in the top bar.
3. Add a sidebar footer (user name and role) and a clearer brand header.
4. Add `loading.tsx` skeletons and an `error.tsx` boundary for the dashboard
   group.
5. Extract shared `EmptyState`, `DegradedAlert` and `TableCard` to remove the
   copy-pasted markup.
6. Role-aware dashboard home (optional).
7. Polish pass per `better-ui`: reduced-motion gating, named transition
   properties, hover only on hover-capable pointers.
8. Verify 320px and 360px behaviour, 44px targets and visible focus for the new
   table toolbar and sortable headers.

## Size estimate vs the 800-line budget

Changed lines = additions plus deletions, authored text only.

| Slice | Estimate |
|---|---|
| Shell refresh (layout, sidebar, header, loading/error, shared components, i18n, tests) | 400–600 |
| Shared TanStack `DataTable`, toolbar, sort header and pagination (code + tests) | 500–700 |
| Migrate the 3 server lists (pages, column modules, list-params sort, 3 data functions, i18n) | 500–800 |
| Rewrite page tests (users 272, asignaturas 658, docentes 578 lines) | 300–600 |
| Embedded tables (grupos section, import counts) and their tests | 150–300 |
| **Total** | **about 1,500–2,300** |

This is roughly 2–3 times the budget, so it will not plausibly fit one PR
without a `size:exception`. Alternative: three chained slices.

- WU1 shell: about 500 lines.
- WU2 shared TanStack table plus users: about 700 lines.
- WU3 catalog tables, grupos section and import counts: about 700 lines.

## Risks

- The Server to Client boundary is the main technical risk: column `cell`
  functions and `labels` objects holding functions cannot be serialized
  (`DataTableColumn`, `AsignaturaGruposLabels`, the `empty` slot).
- Existing page tests render the async server page directly
  (`render(await UsersPage(...))`) with only `next-intl/server` mocked. Client
  table components bring in `useRouter`, `usePathname`, `useSearchParams` and
  `useTranslations`; a shared test helper is needed.
- Sorting means whitelisting columns in SQL (injection safety) and a stable
  tie-breaker (`id`). Three data functions change; `users-query.test.ts` and
  `users-data.test.ts` may need updates.
- `@tanstack/react-table` is a new dependency and needs an approved install.
- Accessibility: sortable headers need `aria-sort`, a button inside the `th`
  and a visible focus ring; the toolbar must keep 44px targets.
- The i18n parity test (`catalog-parity.test.ts`) and both JSON files must gain
  the new keys.
- `/settings` is tested as present for all roles in `app-sidebar.test.tsx`.
- Windows CRLF causes pre-existing lint noise (see `openspec/config.yaml`).
- There are no E2E tests, so the visual result and 320px/360px behaviour are
  not verifiable without running the app.

## Open product questions

1. Is "better template" a visual polish within the current design system, or a
   structural redesign (which requires updating `docs/design-system.md` first)?
2. New capabilities beyond current behaviour (column sorting, status filter on
   users, page-size selector, live search), or only parity on TanStack?
3. May the toolbar and pagination require JavaScript, or must the no-JS
   fallback remain?
4. `/settings` has no page: build a minimal one, or remove the entry?
5. Should the dashboard home become role-aware?
6. Delivery: one PR with `size:exception`, or chained slices?
7. Confirm the static `HeaderStrip` and the profile `<dl>` do not migrate.

## Process facts

- `docs/roadmap.md` has no row for this change, and it maps to no RF or RN in
  `docs/requirements.md`.
- RNF ids it could cite: **RNF-10** (usability, SUS ≥ 70 per role), **RNF-11**
  (no horizontal scroll from 360px), **RNF-12** (confirmation before
  irreversible actions, only if row actions change) and **RNF-01** (menu shows
  only each role's options, if nav items change). No RNF covers accessibility,
  i18n or table performance; those constraints come from
  `docs/design-system.md` §7 and `openspec/config.yaml`.
- Unarchived changes in `openspec/changes/`:
  - `roles-lookup-table`: apply and verify done (PASS_WITH_WARNINGS,
    2026-09-20), archive pending.
  - `merge-grupo-into-asignatura`: has proposal, design, tasks, spec delta and
    `apply-progress.md` (Phase 0 and 1 only); no `verify-report.md` or
    `state.yaml`. Commit `f873b38` on `main` suggests it was delivered, but
    completion is unconfirmed.
  - Both conflict with the "one change at a time" rule; archiving them first is
    the user's call.

## Ready for Proposal

Yes, once the open product questions are answered (especially 1, 2, 3 and 6).
