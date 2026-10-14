# Proposal: Backoffice UI Refresh (shell redesign and TanStack tables)

> **This change does NOT touch the database schema.** No migration, no seed and
> no write SQL. Sorting adds `ORDER BY` variants to three existing read queries
> only; no index is added (an index would be a migration and is out of scope).

## Intent

The backoffice works, but it is hard to orient in and its lists are
under-equipped:

- The top bar carries no page context and the sidebar shows no identity; the
  user's name and role exist only inside a dropdown.
- No route under `src/app` has a `loading.tsx` or an `error.tsx`, so every
  navigation, including paging, gives no feedback, and an unexpected error has
  no designed screen.
- The table frame, the empty/no-results state and the degraded alert are
  copy-pasted across pages (four, three and four copies).
- Lists cannot be sorted, the users list cannot be filtered by status, and
  pagination offers only previous/next at a fixed size of 10.
- The dashboard home shows two user-count cards to every role, including
  `estudiante` and `docente`, and nothing a role can act on.

The owner asked for a redesign of the backoffice template and for every data
table to move to TanStack Table, keeping all current list behaviour.

Owner decisions (2026-10-11, binding) are **D1-D8**. Assumed defaults are
**A1-A9** and can be overridden. Open questions are **Q1-Q9**.

## Owner Decisions

| # | Decision |
|---|---|
| D1 | A UI redesign (shell, layout, navigation chrome, components, density, type and spacing where justified), not a polish. The colour palette is institutional: no colour token is added, removed or altered. Every non-colour change is written into `docs/design-system.md` first. |
| D2 | Every data table migrates to `@tanstack/react-table`. Exploration approach C: manual mode with the URL as state and server fetching for users, asignaturas and docentes; plain client TanStack for the grupos section and the import `CountsTable`. `HeaderStrip` and the profile `<dl>` do not migrate. |
| D3 | Existing behaviour is preserved: same SQL search rules, `clampPage`, `{data, degraded}` and RBAC scope. |
| D4 | New capabilities: column sorting (whitelisted columns, stable tie-breaker), a status filter on the users list, a page-size selector and first/last page navigation. |
| D5 | Search stays submit-on-Enter. No live or debounced search. |
| D6 | The tables require JavaScript. No no-JS fallback is specified or tested. |
| D7 | The `/settings` sidebar entry stays exactly as it is. |
| D8 | Three chained PRs, each aimed at the 800-line budget (see Work Units). |
| D9 | Q1 resolved: the dashboard home becomes role-aware, minimally. Shortcut cards per role from the sidebar predicates; user-count cards only for roles that may open `/users`. No new data query. |
| D10 | Q2 resolved: the users status filter defaults to `all`. |
| D11 | Q3 resolved (A6 confirmed): page-size options 10, 25 and 50, default 10, on all three lists. |
| D12 | Q4 resolved (A5 confirmed): sortable columns are users (name, login, role, status, created), asignaturas (code, name, hours, status) and docentes (name, login, email, status). |
| D14 | **Supersedes D8 and Q9.** After the design raised the estimate to about 5,800-7,250 lines, the owner chose a single PR with an accepted size exception. The owner makes the commits and opens the PR; no agent commits, pushes or opens PRs. The design's ten slices remain as the internal implementation order only. |
| D13 | The conservative reading of the redesign is accepted (A9): type scale, spacing steps and radii stay as documented unless design justifies and documents a change first. |

## Scope

### In Scope

**Design system (first commit of PR 1).** `docs/design-system.md` gains, with
no colour change: the top-bar page context and the sidebar brand and footer
blocks (4.2, 4.3); the table card with its toolbar and footer regions, the
sortable header and the revised pagination (5); the loading skeleton, the
route error state and the no-results variant of the empty state (5); and the
motion rules below (6).

**Shell.**

| Element | Today | Proposed |
|---|---|---|
| Top bar | Sidebar trigger, locale, theme, user menu | Adds the page context on the leading side: the section trail derived from the navigation config (for example "Administration / Asignaturas"). The page keeps its single `h1` in `PageHeader`. Below `md` only the current segment shows. |
| Sidebar header | Logo and app name | Unchanged content, restated as a documented brand block. |
| Sidebar body | Dashboard, new request, "Administration" group, settings | Unchanged: same entries, order, predicates, group and active marker. |
| Sidebar footer | None | An identity block: initials avatar, user name and role, in the user's language. |
| Page frame | Each page hand-rolls its stack | One documented stack inside `.shell`: page header, table card, with the existing 32px rhythm. |
| Table card | Toolbar and pagination float outside a copy-pasted frame | One shared card: a toolbar region (search form, status filter, result count), the table, and a footer region (page status, page-size selector, first/previous/next/last). |
| Loading | Nothing | A `(dashboard)/loading.tsx` skeleton built on the unused `ui/skeleton.tsx`, plus a pending state on the table for same-route URL changes. |
| Error | Nothing | A `(dashboard)/error.tsx` that says what happened and offers a retry. `{data, degraded}` stays the normal failure path; the boundary is for unexpected throws. |
| Empty / degraded | Three and four copies | Shared `EmptyState` (empty and no-results, the latter always with a clear control) and `DegradedAlert`. |
| Dashboard home | Two user-count cards for every role | See Q1. |

**Tables.**

- A shared client `DataTable` on TanStack, rendered through the existing
  `ui/table.tsx` primitives so the documented table style is unchanged.
- URL state for the three server lists: `page`, `q`, `status`, and new
  whitelisted sort, direction and page-size parameters. An unknown value falls
  back to the default and never errors. Changing search, filter, sort or page
  size returns to page 1.
- Column definitions move from the server pages into client modules; the
  server page keeps the guard, the parsing and the fetch, and passes rows as
  serializable props.
- The two bounded tables gain no new capability: the grupos section keeps its
  specified order (CM-ASG-7) and its cap note; `CountsTable` stays a fixed
  matrix.

**Constraints applied (non-RNF).** `docs/design-system.md` section 7
(contrast, visible focus, 44px targets, one `h1`, colour never alone) and
`openspec/config.yaml` conventions (design-system tokens only; every string
through next-intl in both `i18n/es.json` and `i18n/en.json`), plus the
`better-ui` rules: motion gated behind `prefers-reduced-motion`, transitions
that name their properties, hover styling only on hover-capable pointers,
concentric radii where nested surfaces share an even inset, shadow for
elevation and borders for structure, no animation on row hover or sort.
Sortable headers are a button inside the `th` with `aria-sort` and a visible
direction indicator.

### Out of Scope

- Any colour token change, including the FIA brand block.
- Live or debounced search (D5); a no-JS fallback (D6).
- `/settings`: the entry stays and still points to a route that does not
  exist. **Known limitation, not fixed here** (D7).
- `HeaderStrip` and the profile `<dl>` (D2).
- New row actions, bulk selection, column visibility, export, role filter.
- Any change to authorization, scope, search semantics, audit or the import.
- Database indexes, schema or data.
- `docs/roadmap.md` (see Roadmap).
- Auth screens and the permission-denied screen.

## Capabilities

### New Capabilities

- `backoffice-shell`: top-bar page context, sidebar brand and identity
  blocks, page frame, loading and error boundaries, shared empty, no-results
  and degraded states, dashboard home.
- `data-table`: the shared table contract: URL state and fallbacks, sorting
  rules and accessibility, toolbar, page-size selector, first/last
  navigation, pending state, the two usage modes (server-driven and bounded).

### Modified Capabilities

- `users-listing`: adds sorting and the status filter; pagination gains
  first/last and a selectable page size (the "default page size is 10" rule
  becomes the default of a set); the assumption "no sorting, per-column
  filters" is withdrawn; default order stays newest first with `Id` tie-break.
- `catalog-management`: CM-LST-1 gains sorting, the page-size selector and
  first/last; "page size MUST be the same as in `/users`" becomes "same
  default and same options". CM-ASG-7, CM-NAV-1 and CM-UX-1 are not modified.

`catalog-excel-import` is not modified (`CountsTable` renders the same data).

## Requirement Traceability

This change covers no RF and no RN. RNF wording was checked in
`docs/requirements.md`:

| ID | Applies to | How |
|---|---|---|
| RNF-01 | Sidebar, new URL parameters | (b) the menu still shows only each role's options after the shell rewrite; (a) sort, status and page-size parameters are parsed on the server and can never widen the session-derived scope. Regression guard. |
| RNF-11 | Shell, dashboard home | The requirement names the **student** screens. Only the shared shell and the home are student-facing here; they must show no horizontal scroll from 360px. The staff tables are not covered by this ID. |
| RNF-10 | Whole change | Motivation only. The roadmap states RNF-10 is verified in the pilot, not in a change; specs must not claim to satisfy it. |

RNF-12 is **not** cited: no row action changes and nothing irreversible is
added. Accessibility and i18n have no RNF; they are cited from the design
system and `openspec/config.yaml` as above.

## Approach

- **Design system before code.** The document is updated in the first commit
  of PR 1; `globals.css` follows it.
- **Manual TanStack.** `manualPagination`, `manualFiltering` and
  `manualSorting`; the server remains the source of truth. `parse*ListParams`,
  the `*ListHref` builders and `clampPage` are extended, not replaced.
- **Sorting is a whitelist.** A column key maps to a fixed column expression
  on the server; the raw parameter never reaches SQL. Every order ends with
  `id` as tie-breaker.
- **Next.js 16.3.4 facts checked in `node_modules/next/dist/docs/`.**
  `searchParams` is a `Promise` and opts the page into dynamic rendering
  (`page.md`). `loading.tsx` wraps the page, not the layout, and shows no
  fallback for a layout that reads request data; this layout calls
  `requireUser` and Cache Components is not enabled in `next.config.ts`
  (`loading.md`). `error.tsx` must be a client component and its recovery prop
  in this version is `retry` (`error.md`). `useSearchParams` consumers need a
  `<Suspense>` boundary and `router.replace` accepts `{ scroll: false }`
  (exploration). Not confirmed from the docs: whether `loading.tsx` shows on a
  query-only navigation. The proposal therefore does not rely on it; table
  pending feedback comes from the transition state. Design must confirm.
- **Tests.** Strict TDD. A shared test helper mocks `next/navigation` and the
  next-intl client so the three page tests keep rendering the async page.

### Work Units

| PR | Content | Est. lines | Rollback boundary |
|---|---|---|---|
| 1 | Design-system update, layout, sidebar footer, top-bar context, `loading.tsx`, `error.tsx`, shared `EmptyState`/`DegradedAlert`/table card, dashboard home, i18n, tests | 550-800 | `git revert`; no dependency added |
| 2 | `@tanstack/react-table`, shared `DataTable`, toolbar, sortable header, pagination with page size and first/last, list-params extension, users list with sorting and status filter, test helper | 650-850 | `git revert`; removes the dependency |
| 3 | Asignaturas and docentes lists, their sort whitelists, grupos section, `CountsTable`, removal of the old table components | 700-950 | `git revert`; old components return |

Total 1,900-2,600 authored lines. In `catalog-management`, real sizes ran well
above first estimates, so budget risk is **High**. Pre-identified seams: the
dashboard home splits out of PR 1; PR 3 splits into server lists and bounded
tables. PR 2 keeps the old table components alive so the catalog pages work
unchanged until PR 3. **The chain strategy (stacked to `main` versus a
feature-branch chain with a tracker) is not decided; it is an open decision
for the tasks phase.**

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `docs/design-system.md` | Modified | Non-colour patterns listed in Scope |
| `src/app/globals.css` | Modified | Only what the document adds; no colour token |
| `src/app/(dashboard)/layout.tsx` | Modified | Page frame, footer and context wiring |
| `src/app/(dashboard)/loading.tsx`, `error.tsx` | New | Boundaries |
| `src/app/(dashboard)/page.tsx` | Modified | Dashboard home (Q1) |
| `src/components/app-sidebar.tsx` + test | Modified | Brand and identity blocks; entries untouched |
| `src/components/dashboard-header.tsx`, `theme-toggle.tsx` | Modified | Page context; `transition-all` replaced by named properties |
| `src/components/` (new shared states and table card) | New | Extracted from the pages |
| `package.json`, lockfile | Modified | `@tanstack/react-table` |
| `src/components/data-table*.tsx`, `status-filter.tsx` + tests | Modified | TanStack wrapper, toolbar, pagination |
| `src/lib/list-params.ts`, `src/lib/users/list-params.ts`, `src/lib/catalog/list-params.ts` + tests | Modified | Sort, direction, page size, users status |
| `src/lib/data/users.ts`, `src/lib/data/asignaturas.ts` + tests | Modified | Whitelisted `orderBy`, users status predicate |
| `src/app/(dashboard)/users/page.tsx` + test | Modified | Client column module |
| `src/app/(dashboard)/catalog/asignaturas/page.tsx`, `asignatura-grupos-section.tsx`, `catalog/docentes/page.tsx`, `catalog/import/import-preview.tsx` + tests | Modified | Migration |
| `i18n/es.json`, `i18n/en.json` | Modified | Identical key sets |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Server-to-client boundary: `cell` functions and `labels` objects holding functions cannot be serialized | High | Column modules are client files using `useTranslations`/`useFormatter`; pages pass plain rows |
| Sort parameter reaches SQL, or a new parameter widens the scope | Low, high impact | Whitelist map on the server; tests with hostile values and with a `secretaria` session |
| Size overrun past 800 lines per PR | High | Seams named above; measure before each PR opens |
| Redesign drifts from the design system or changes a colour | Med | Document first; review checks `globals.css` colour tokens are byte-identical |
| Page tests break under client hooks | High | Shared test helper built first in PR 2 |
| Unstable order with equal sort keys skips or repeats rows | Med | `id` tie-breaker on every order; the existing stable-order scenario is extended per sortable column |
| Sorting on unindexed columns | Low at current scale | Accepted; no index in this change |
| No feedback on query-only navigation | Med | Transition pending state; not dependent on `loading.tsx` |
| No E2E tests: 320px/360px and visual result unverifiable in CI | Certain | Manual check listed in the success criteria |
| Keyboard and screen-reader regressions in the toolbar | Med | Tests for `aria-sort`, names, focus and the polite count region |
| `@tanstack/react-table` peer range against React 19.2.8 | Unverified | Check before install; install needs the owner's approval |
| CRLF lint noise hides real errors | Certain | Use the filtered eslint command in `openspec/config.yaml` |

## Rollback Plan

1. Each PR reverts with `git revert`; none carries schema or data.
2. Reverting PR 3 alone is safe: PR 2 keeps the previous table components.
3. Reverting PR 2 requires PR 3 reverted first; it also removes the
   dependency. URLs carrying the new parameters keep working, because the
   previous parsers ignore unknown parameters.
4. Reverting PR 1 restores the previous shell and the previous
   `docs/design-system.md`; PRs 2 and 3 must be reverted first if they use the
   shared card and states.

## Dependencies

- Owner approval to install `@tanstack/react-table`.
- A chain-strategy decision at the tasks phase.
- Answers to Q1-Q4 before the specs are final.
- Prerequisite satisfied: `openspec/changes/` holds no other open change
  (`roles-lookup-table` and `merge-grupo-into-asignatura` were archived on
  2026-10-11), so the one-change-at-a-time rule holds.

## Roadmap

`docs/roadmap.md` has no row for this change and is not edited here. A row
must be added by the owner. Suggested content, in the document's language:

| # | Change | Cubre | Responsable | Prototipo | Estado |
|---|---|---|---|---|---|
| 9 | `backoffice-ui-refresh` | Transversal de interfaz: RNF-01, RNF-11 (pantallas compartidas); contribuye a RNF-10 | Josué | No | en curso |

## Assumed Defaults to Confirm

| # | Assumed default | If wrong |
|---|---|---|
| A1 | Sidebar entries, order, group and predicates do not change | CM-NAV-1 needs a delta |
| A2 | The identity footer is informative, not a menu; the user menu stays in the top bar | The menu moves and the top bar is redrawn |
| A3 | Default order of each list is unchanged | Existing order scenarios change |
| A4 | Sort is single-column | Multi-sort needs a richer URL contract |
| A5 | Sortable columns: users (name, login, role, status, created); asignaturas (code, name, hours, status); docentes (name, login, email, status). Groups and action columns are not sortable | Whitelists change |
| A6 | Page-size options 10, 25 and 50, default 10, same on all three lists | Different set or per-list sets |
| A7 | The bounded tables gain no sorting | CM-ASG-7 needs a delta |
| A8 | Search remains a form submit; whether paging controls are links or buttons is left to design | — |
| A9 | Type scale, spacing steps and radii stay as documented unless design justifies a change and documents it first | More design-system edits and lines |

## Open Questions

1. **Q1 (owner): role-aware dashboard home.** Not decided. Recommendation:
   yes, minimally. Every role sees shortcut cards for the destinations its
   role can reach, from the same predicates as the sidebar; the user-count
   cards show only to roles that may open `/users`. No new data query.
   Alternative: restyle only and keep the counts for everyone.
2. **Q2 (owner): default of the users status filter.** Recommendation: `all`,
   which preserves today's view. `active` would match the catalog lists but
   changes what `/users` shows by default.
3. **Q3 (owner): page-size options** (A6).
4. **Q4 (owner): which columns are sortable** (A5).
5. **Q5 (design): top-bar context.** Section trail from the navigation config
   (recommended; cheap, no record names) versus moving the full breadcrumb,
   including record names, out of the five create/edit pages.
6. **Q6 (design): table density.** Keep the documented 24px/16px cell padding
   or tighten it using existing steps.
7. **Q7 (design): press-scale feedback.** `better-ui` proposes 0.96; the
   design system has no such convention. Recommendation: do not add it.
8. **Q8 (design): sorting collation** for accented names and the position of
   empty emails.
9. **Q9 (tasks): chain strategy** (D8).

## Success Criteria

- [ ] `docs/design-system.md` documents every non-colour pattern before the
      code that uses it, and the colour tokens in `globals.css` are unchanged.
- [ ] Every dashboard page shows its context in the top bar and the identity
      block in the sidebar; the sidebar entries per role are unchanged.
- [ ] Navigation shows a skeleton; an unexpected error shows a screen with a
      working retry; the degraded notice still appears on a failed read.
- [ ] Users, asignaturas and docentes render through TanStack with search,
      status filter and pagination behaving as specified before this change.
- [ ] Sorting works on the whitelisted columns, survives a reload, is stable
      across pages, and an unknown sort value falls back without error.
- [ ] The users list filters by status; no parameter widens a viewer's scope.
- [ ] Page size is selectable and first/last navigation works; out-of-range
      pages still clamp.
- [ ] Sortable headers expose `aria-sort`; every control is keyboard operable
      with visible focus and a 44px target; no motion ignores
      `prefers-reduced-motion`.
- [ ] The shell and the home show no horizontal scroll at 360px (manual check;
      320px also checked for clipping).
- [ ] `es` and `en` catalogs have identical key sets.
- [ ] `npm test`, `npm run typecheck`, `npx eslint src` and `npm run build`
      pass on each PR.
