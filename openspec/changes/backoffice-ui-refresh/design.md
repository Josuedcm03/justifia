# Design: Backoffice UI Refresh (shell redesign and TanStack tables)

> **No database change.** No migration, no seed, no index, no write SQL. Three
> read queries gain `ORDER BY` variants and one gains a status predicate. The
> only database step in this document is one optional `[READ-ONLY]` catalogue
> query (gate S1).

> **Size note.** The `sdd-design` skill caps a design at 800 words. This repo's
> precedent (`archive/2026-10-10-catalog-management/design.md`) and the nine
> decision areas the phase brief requires make that cap unreachable without
> deleting rationale. Project convention wins; the deviation is deliberate.

> **Written in parallel with the delta specs.** `specs/` did not exist when this
> was written. What the specs must pin for this design to hold is listed in
> *Points the specs must pin*.

Binding inputs: `proposal.md` (D1-D13, A1-A9), `exploration.md`,
`docs/design-system.md`, `src/app/globals.css`.

---

## Verified findings

### Framework (read in `node_modules/next/dist/docs/`, Next 16.3.4)

| # | Finding | Source | Consequence |
|---|---|---|---|
| N1 | `searchParams` is a `Promise` of a plain object | `03-file-conventions/page.md:67-79` | Pages keep `await searchParams`; they are dynamic by construction |
| N2 | Layouts do not re-render on navigation and receive no `searchParams` | `layout.md:178-182` | The top-bar page context cannot be computed in `DashboardHeader` (server, inside the layout). It is a client component reading `usePathname()` |
| N3 | `loading.js` wraps `page.js` in `<Suspense>`, not the same-segment `layout.js`. A layout that reads runtime data gets no fallback: without Cache Components "navigation blocks until the layout finishes rendering" | `loading.md:76-93` | `(dashboard)/layout.tsx` calls `requireUser` and `next.config.ts` does not enable Cache Components. The skeleton covers page content only; the first document load still waits for the layout |
| N4 | `error.js` must be a Client Component; props are `error` (with `digest`) and `retry`; "`v16.3.0`: `retry` prop became stable"; `reset` exists but `retry` is preferred. It wraps `loading.js` and `page.js`, not the same-segment layout. Server error messages are replaced by a generic one in production | `error.md:21-31,96,106-121,155-157,331` | `(dashboard)/error.tsx` uses `retry`, never renders `error.message`, shows `error.digest` |
| N5 | `router.push` / `router.replace` accept `{ scroll: false }`; untrusted URLs must never be passed | `use-router.md:44-45,54,120` | Hrefs passed to the router are built only by the pure `*ListHref` builders from parsed, whitelisted state |
| N6 | `useSearchParams` forces client rendering up to the nearest `<Suspense>` in a prerendered route and needs the boundary | `use-search-params.md:82-88,181` | **Not used at all** (decision 4): the server passes the parsed state as props, so no `<Suspense>` is required for it |
| N7 | `<Link onNavigate>` runs only for client-side navigations (not for modifier-key clicks) and `e.preventDefault()` cancels the navigation | `02-components/link.md:453-503` | Paging and filter controls stay real links and still report into the shared transition |
| N8 | **Not documented:** whether the `loading.js` fallback is shown again on a navigation that changes only the query string | searched `loading.md`, `layout.md`, `linking-and-navigating.md`, `streaming.md` | **Unverified.** The design does not depend on it (decision 4); gate V1 observes it |

### Repository (verified with `codegraph_explore` and direct reads)

| # | Finding | Evidence |
|---|---|---|
| R1 | `usuarioConRolColumns` projects `hashClave`, `cif`, `telefono` and `correo`, and `listUsuarios` returns it. Today the server page renders five fields and the rest never leaves the server | `src/lib/data/users.ts:48-61,152-160` |
| R2 | `DataTable` has **six** consumers, not five: the proposal omits `ErrorsTable` | `src/app/(dashboard)/catalog/import/import-errors.tsx:13-63` |
| R3 | The navigation list is a module-private constant inside a client component | `src/components/app-sidebar.tsx:66-100` |
| R4 | `NextIntlClientProvider` in the root layout receives the full message catalog, so client components can call `useTranslations` | `src/app/layout.tsx:35-45` |
| R5 | No `timeZone` is configured for next-intl (`request.ts` returns `locale` and `messages` only) | `src/i18n/request.ts:5-12` |
| R6 | The parity test guards a closed section list that does not include `dashboard`, `users` or any shell key | `src/i18n/catalog-parity.test.ts:21-33` |
| R7 | `current-marker-usage.test.ts` pins `.is-current` to four breadcrumb pages and reads `src/components/status-filter.tsx` and `data-table-search.tsx` by path | `src/app/(dashboard)/catalog/current-marker-usage.test.ts:17-25,63-97` |
| R8 | Page tests render the awaited server page and mock only `next-intl/server` with a key-echo translator | `src/app/(dashboard)/users/page.test.tsx:21-24,49-52` |
| R9 | A provider-based helper with the real catalogs already exists for one feature | `src/app/(dashboard)/requests/new/test-support.tsx` |
| R10 | `getDashboardStats` returns `degraded`, which the home page ignores (it renders zeros) | `src/lib/data/users.ts:178-188`; `src/app/(dashboard)/page.tsx:10-19` |
| R11 | Default orders today: users `creadoEn desc, id desc`; docentes `nombreCompleto asc, id asc`; asignaturas `codigo asc` with no tie-breaker | `users.ts:157,330`; `asignaturas.ts:176` |
| R12 | `TableRow` carries `transition-colors` on hover; `ThemeToggle` uses `transition-all` twice | `src/components/ui/table.tsx:64`; `theme-toggle.tsx:24-25` |
| R13 | The React Compiler is not enabled | `next.config.ts` |
| R14 | No explicit collation exists anywhere in `src` or `drizzle/`; ordering uses the database default | grep `collate` |

---

## Technical Approach

Four ideas carry the design.

1. **The server stays the single parser and the single source of list state.**
   The page parses and whitelists every parameter, fetches, and hands the
   client a plain state object plus plain rows. Client code never reads the
   query string; it only builds the next href with the same pure builder the
   server uses. One parser means one fallback rule.
2. **A sort key is a name, never an expression.** The URL carries a key from a
   closed list. A typed `Record<Key, ...>` on the server maps it to a column
   expression; a key without an expression does not compile, and a value
   outside the list never reaches the map.
3. **One table kit, two modes.** `DataTable` renders through the existing
   `ui/table.tsx` primitives. With a `sorting` prop it is server-driven; without
   it, it is a bounded static table. Toolbar, pagination and pending state are
   separate pieces composed by one `ListTable`.
4. **The navigation config is data shared by three readers**: the sidebar, the
   top-bar context and the dashboard home. Their role filtering is the same
   function call, so they cannot disagree.

---

## Architecture Decisions

### 1. Q5: top-bar page context is a section trail from the navigation config

| Option | Tradeoff | Decision |
|---|---|---|
| **Section trail from the config** ("Administration / Subjects") | No record names; one small client component; no page changes | **Chosen** |
| Full breadcrumb with record names in the top bar | The layout does not re-render and receives no page data (N2). It needs a parallel route slot or a client context written by five pages, plus a data read for the record name in a place that has no scope | Rejected |
| Page title repeated in the top bar | Duplicates the `h1` | Rejected |

- **Single source.** `items` moves out of `app-sidebar.tsx` (R3) into
  `src/lib/navigation.ts`, unchanged in content and order (A1, D7: the
  `settings` entry stays byte-identical in meaning). The module exports the
  list, `isCurrentPath`, `isNavVisible`, `trailFor(pathname)` and
  `shortcutsFor(rol)`. It is imported directly by each reader; predicates are
  never passed as props.
- **`trailFor`** returns the entry whose `href` matches by the existing rule
  (`/` exact, otherwise equal or prefix plus `/`), its group label when it has
  one, and `exact`. `/catalog/asignaturas/12/edit` yields
  "Administration / Subjects" with `exact: false`. A route with no menu entry
  is covered by `NAV_CONTEXT_ONLY` (one entry: `/profile`). No match renders
  nothing.
- **`PageContext`** (`src/components/page-context.tsx`, client) reads
  `usePathname()` and `useTranslations("nav")`. Markup: `nav` with its own
  label, an `ol`, the group as muted text (a group has no route), a chevron,
  then the entry. The entry is text with `aria-current="page"` when `exact`,
  otherwise a link back to the list. Below `md` only the entry shows.
- **It is not a third "you are here" marker.** It takes neither the sidebar
  bar nor the `.is-current` underline; the five create/edit pages keep their
  in-page breadcrumb untouched, so R7 keeps passing as written.
- The trail is not role-filtered: it names where the user already is, and the
  page guard has already run.

### 2. Q6: table density stays at 24px / 16px

**Choice.** Cell padding stays `px-6 py-4`; the header row stays 48px.
**Rejected.** Tightening to 16px / 12px. **Rationale.** D13 keeps spacing as
documented unless a change is justified; rows already hold 44px link targets,
so vertical padding cannot shrink much; the page-size selector answers the
"see more rows" need. A sortable header button is 44px tall and offsets its
own inline padding with a negative margin of the same step, so the label stays
aligned with the cell text.

### 3. Q7: no press-scale feedback

**Choice.** Not added. **Rejected.** `better-ui`'s 0.96 press scale.
**Rationale.** The design system has no such convention and limits motion to
one orchestrated moment per screen; `better-ui` treats a deliberate, consistent
project convention as a preference, not a finding. The rule is written into
section 6 so it is deliberate rather than absent.

### 4. Q8: sort collation and empty emails

| Topic | Choice | Rejected |
|---|---|---|
| Person names and logins | Explicit ICU collation: `"<column>" collate "es-x-icu"` | Database default (R14: unknown; under `C`, accented and lowercase names sort after `Z`); `lower()` only (fixes case, not accents); sorting in JavaScript (breaks server pagination) |
| Codes (`Asignatura.Codigo`, `Rol.Codigo`) | Plain column, database default | Collating identifiers (changes today's default order of the asignaturas list for no reader benefit) |
| Empty emails | `nullif("Correo", '')` with `NULLS LAST` in **both** directions | Postgres default (`NULLS FIRST` on `DESC`): a missing value is not the largest value |
| Status | `asc` means active first | Raw boolean order (inactive first on `asc`) |

- One helper, `src/lib/data/sort-sql.ts`, is the only place the collation name
  is written (`TEXT_SORT_COLLATION`), so the fallback is a one-line change.
- **Unverified, gate S1 `[READ-ONLY]`** before the data-layer slice:
  `select collname from pg_collation where collname = 'es-x-icu'` and
  `select datcollate, datlocprovider from pg_database where datname = current_database()`.
  If the collation is missing, the helper falls back to `lower(column)` under
  the database default and this is recorded in `apply-progress.md`.
- **Flagged consequence for A3.** The docentes default order is by name. If the
  database default collation is not already a Spanish or ICU locale, docentes
  with accented or lowercase-initial names move to their alphabetical place.
  The users and asignaturas defaults do not move. See *Open Questions* 2.

### 5. Shared `DataTable` architecture

**Component API** (`src/components/tables/data-table.tsx`, client):

```ts
type DataTableProps<T> = {
  columns: ColumnDef<T>[];
  rows: readonly T[];
  getRowId: (row: T) => string;
  caption: string;                 // visually hidden
  /** Present = server-driven mode. Absent = bounded mode. */
  sorting?: { sort: ListSort<string>; onSort: (key: string) => void };
  pending?: boolean;
};
```

- **Server-driven mode** (users, asignaturas, docentes):
  `manualSorting`, `manualPagination`, `manualFiltering`, core row model only,
  `state.sorting` derived from the prop. A sortable column has
  `enableSorting: true` and its `id` **is** the URL sort key. The header button
  calls `onSort(column.id)`; TanStack never sorts, pages or filters.
- **Bounded mode** (grupos section, `CountsTable`, `ErrorsTable` per R2):
  no `sorting` prop, sorting disabled table-wide, no toolbar, no footer, no
  URL state, no new capability (A7).
- Zero rows render nothing: the caller renders `EmptyState` instead, so a table
  with no body is never shown (the existing users-listing rule).
- Column presentation (`align`, `className`) travels in `columnDef.meta`,
  typed by one module augmentation of `ColumnMeta`.
- Rendering uses `flexRender` into `Table`, `TableHeader`, `TableRow`,
  `TableHead`, `TableCell`, so the documented style is untouched. `TableRow`
  loses `transition-colors` (R12): the hover tint is instant.

**Sortable header.** A `button` inside the `th`. `aria-sort` is set to
`ascending` or `descending` on the sorted column only and is absent elsewhere.
The button shows the column label and a direction icon (up, down, or a muted
double chevron on an unsorted sortable column); the icon swap is instant. The
caption gains one visually hidden sentence saying that headers with a button
sort the table.

**Column definitions live in client modules**, one per list, next to its page
(`users/users-table.tsx`, `catalog/asignaturas/asignaturas-table.tsx`,
`catalog/docentes/docentes-table.tsx`). Each calls `useTranslations` for
headers, pills and row-action labels, builds its columns in `useMemo`, and
renders the shared `ListTable`. Function-valued `cell` renderers therefore
never cross the server boundary (proposal risk 1).

**Rows are plain DTOs, picked explicitly on the server.**

| List | Row type | Note |
|---|---|---|
| Users | `UserRow { id, nombreCompleto, login, rol, activo, creadoEnLabel }` | **R1: `listUsuarios` gains a list projection without `hashClave`, `cif`, `telefono`, `correo`, and the page picks the six fields.** Passing `result.data` to a client component would serialize password hashes into the response. Both guards are tested |
| Asignaturas | `AsignaturaListItem` | Already plain |
| Docentes | `DocenteListItem` | The page already maps five fields |
| Grupos | `GrupoListItem` | Already plain |

- **Dates are formatted on the server.** `creadoEnLabel` is produced with
  `getFormatter` exactly as today. Without a configured time zone (R5), a
  client `useFormatter` would format in the browser zone and mismatch the
  server render. No `Date` crosses the boundary.

**The grupos section and its function props.** `AsignaturaGruposSection` stays
a server component and keeps the heading, the add link, the hints, the degraded
alert, the empty state and the cap note, all strings. Its table moves to
`asignatura-grupos-table.tsx` (client, bounded mode) with the props
`{ rows, asignaturaId, caption }`. That module obtains the column headers, the
status labels, the edit label and the day names through `useTranslations`
(`catalog.asignaturas.grupos`, `catalog.shared.status`, `catalog.shared.dias`),
the same keys the edit page reads today. `editLabel`, `diaShort` and `diaLong`
are removed from the server-to-client path, and `AsignaturaGruposLabels`
shrinks to the strings the server part still renders. `DiasCell` is hook-free
and is called from the client module unchanged. Row order and the cap note are
untouched (CM-ASG-7).

**The `empty` slot is removed.** The decision "table or empty state" moves to
`ListTable`, which owns the state needed to build the clear control.

### 6. URL state contract

| Parameter | Values | Default (omitted from the URL) |
|---|---|---|
| `q` | trimmed, collapsed, capped at 100 | empty |
| `status` | `active`, `inactive`, `all` | users `all` (D10); catalog `active` |
| `sort` | users `name`, `login`, `role`, `status`, `created`; asignaturas `code`, `name`, `hours`, `status`; docentes `name`, `login`, `email`, `status` (D12) | users `created`; asignaturas `code`; docentes `name` |
| `dir` | `asc`, `desc` | users `desc`; catalog `asc` |
| `size` | `10`, `25`, `50` (D11) | `10` |
| `page` | ASCII digits, at least 1 | `1` |

Written in that order, which the existing `listHref` (`q`, `extra`, `page`)
already produces.

**Parsing and fallbacks** (pure, `src/lib/list-params.ts`):

- Every new parameter is an exact, case-sensitive string match. An array, an
  unknown value, a different case or an empty string is the default. Nothing
  throws.
- `sort` and `dir` resolve together: a valid `sort` with a valid `dir` is used;
  a valid `sort` with a missing or invalid `dir` is `asc`; a missing or invalid
  `sort` is the list's default pair and `dir` is ignored.
- `size` must be one of the three literals as a string; `1000`, `0`, `-5`,
  `10.5` and `010` all become 10.
- `page` and `q` keep each list's current parsing byte for byte.

**Href builders.** `usersListHref` and `catalogListHref` accept the full state
and omit every default. `sort` and `dir` are written together or not at all.
`applyListChange(state, change)` is the one reset rule: any change that is not
a page change returns page 1.

**Navigation.** `ListNavigationProvider` (client) owns
`const [pending, startTransition] = useTransition()` and exposes
`navigate(href, mode)`, which runs
`router.push(href, { scroll: false })` or `router.replace(...)` inside the
transition.

| Control | Element | History |
|---|---|---|
| First, previous, next, last | `Link` with `scroll={false}` and `onNavigate` (N7) | `push` |
| Status filter | same | `push` |
| Search (submit on Enter, D5) | `form` with `onSubmit` | `push` |
| Sort header | `button` | `replace` |
| Page size | native `select` | `replace` |

- Links stay links (design system "Pagination": real links; middle-click and
  open-in-new-tab keep working). `onNavigate` cancels the default navigation
  and calls `navigate`, so every control reports into one pending flag.
- Content changes (page, filter, search) push a history entry, as the links and
  the form do today. Re-arrangements of the same result set (sort, size)
  replace it.
- The search form keeps `method="get"`, `action` and hidden fields for the
  other parameters. D6 specifies no no-JS behaviour; these attributes only make
  a submit that happens before hydration land on the right URL.
- **`<Suspense>` placement.** None is added. No client component reads
  `useSearchParams` (N6), and `(dashboard)/loading.tsx` is the segment
  boundary.

**Pending state.** While `pending` is true: the table card sets `aria-busy`,
the table body drops to 60% opacity over 150ms (`transition-opacity`, opacity
only), and the polite count region reads "Updating…" until the new count
replaces it. Text and `aria-busy` are the static cue; opacity is never the
only channel. Controls stay enabled, because navigation is interruptible.

**Gate V1 (manual, in the table-kit slice).** Observe in `next dev` and in a
production build whether a sort click shows the `loading.tsx` skeleton (N8).
If it does not, nothing changes. If it does, the toolbar unmounts and keyboard
focus is lost; the contingency is a module-level "last control id" in
`list-navigation.tsx`, restored in an effect when the table mounts (about 15
lines). The outcome is recorded in `apply-progress.md`.

### 7. Data layer

```ts
// src/lib/data/sort-sql.ts (server-only)
type SortExpr = (dir: SortDir) => SQL;
export function orderByFor<K extends string>(
  map: Record<K, SortExpr>, sort: ListSort<K>,
  fallback: ListSort<K>, id: AnyPgColumn,
): SQL[];
```

- `orderByFor` returns up to three terms: the chosen key; the list's default
  key in its default direction when it is not the chosen key (so a sort by
  status or role still reads in a sensible order); then `id` in the direction
  of the chosen key. With the default sort this reproduces today's users and
  docentes orders exactly and adds only `id asc` to asignaturas (R11).
- The maps are `satisfies Record<UsersSortKey, SortExpr>` (and the two catalog
  equivalents), declared next to the query they serve. The raw parameter is
  never interpolated; it is only a lookup key that has already been narrowed
  to the union by the parser.
- **Users status predicate.** `buildUsersWhere(viewerRol, q, status)`: the
  role scope stays the first, unconditional term; `status` adds
  `"Activo"` / `not "Activo"` / nothing with `and`. It can only narrow.
  `status` is a required parameter, so no caller can omit it silently.
- **`clampPage` is unchanged.** `pageSize` is one of three literals by the time
  it arrives, so the division is safe. The count query and the page query keep
  sharing one `where`.
- `{ data, degraded }` is preserved on all three functions; the degraded
  result echoes the requested `pageSize`.
- `listMatchingGrupos` and the search predicates are not touched (D3).

### 8. Shell

```
SidebarProvider
  AppSidebar rol nombre                    client; brand block, menu, identity block
  SidebarInset
    DashboardHeader user                   server
      SidebarTrigger · PageContext (client) · locale · theme · user menu
    main > .shell > {children}             loading.tsx and error.tsx wrap children
```

| Piece | Design |
|---|---|
| Brand block | The current `SidebarHeader` content, unchanged, now documented |
| Identity block | `SidebarFooter`: initials avatar (decoration, `aria-hidden`), name, role label from a new `roles.*` namespace. Text only, no link, no button, no hover (A2). The ordered link lists pinned by `app-sidebar.test.tsx` do not change |
| `PageFrame` | `flex flex-col gap-8`; adopted by the pages this change rewrites (home, users, asignaturas, docentes). Other pages keep their identical wrapper |
| `TableCard` | The card frame once (`rounded-xl border shadow-soft overflow-hidden`), with optional `toolbar` and `footer` regions separated by a hairline and padded 24px / 16px. Hook-free, usable from server and client |
| `EmptyState` | `variant: "empty"` (one sentence plus an optional create action) or `"no-results"` (title, hint and a **required** clear link). Hook-free; copy arrives as props |
| `DegradedAlert` | The existing `role="status"` alert markup, extracted |
| `loading.tsx` | Synchronous server component: the page frame drawn with `Skeleton` (title, one context line, a table card with five rows), `aria-busy`, and the existing `common.loading` string visually hidden |
| `error.tsx` | Client. One `h1` (the page that held it is gone), one sentence on what to do, a primary "Try again" button calling `retry()`, a link to the dashboard, and the digest as a reference when present. `role="alert"`; focus moves to the heading. Never renders `error.message` (N4) |
| Dashboard home (D9) | `requireUser()`, then `shortcutsFor(rol)`: every menu leaf the role can see, minus the dashboard itself and minus `settings` (its route does not exist; D7 freezes the sidebar entry, not a second dead link). Each is a link card. The two count cards render only when `canCreateUsers(rol)`, and `getDashboardStats()` is called only then. A degraded read shows `DegradedAlert` instead of zeros (R10). A role with no shortcut sees one sentence |

`initials` moves to `src/lib/initials.ts` and is shared by the header and the
sidebar. `ThemeToggle` replaces `transition-all` with
`transition-[scale,rotate]` (R12).

**Known and unchanged.** The count cards count every account, not the
viewer's visible set. D9 adds no query, so this stays as it is; see *Open
Questions* 4.

### 9. Design-system additions (non-colour only)

**`src/app/globals.css` is not modified at all.** Every pattern below is built
from existing utilities and tokens, so "no colour token added, removed or
altered" (D1) holds by construction and is checked by an empty diff of that
file across the whole chain. Section 2 of `docs/design-system.md` is also left
byte-identical.

Exact text to add in the first commit of the first slice:

**4.2, appended.**

> **Brand block.** The sidebar header is 64px tall, level with the top bar,
> with a hairline under it: the logo at 28px, then the product name on the
> `title` step in `primary`, bold. It holds nothing else.
>
> **Identity block.** The sidebar footer, above a hairline, padded 16px: an
> initials avatar (32px, a pill), the user's name on `body-sm` in semibold and
> the role on the `label` step in muted text, in the user's language. Long
> names truncate. It is information, not a control: it has no hover state and
> no link. The user menu stays in the top bar.

**4.3, the first row of the diagram becomes**
`|  logo     |  menu · section / page        locale / theme / user  |`, and
appended:

> **Page context.** The leading side of the top bar names where the user is:
> the section and the menu entry, taken from the navigation config
> ("Administration / Subjects"), on `body-sm`. The section is muted text; the
> entry is `foreground` in medium weight. On a page below the entry (a create
> or edit form) the entry is a link back to it. Below `md` only the entry
> shows. It is orientation text, not a third "you are here" marker (2.3): it
> takes neither the bar nor the underline, and it carries
> `aria-current="page"` only when the entry is the page itself. The page keeps
> its single `h1`.
>
> **Page frame.** Inside the container, a screen is one vertical stack with a
> 32px gap: the page header, then its cards.

**5, "Table" gains one sentence:** "The row hover tint is instant; it does not
animate." **Then, new entries:**

> **Table card.** A list is one card (12px radius, 1px border, `shadow-soft`,
> clipped) with up to three regions divided by hairlines. The toolbar, padded
> 24px / 16px, holds the search form, the status filter and the result count;
> it wraps on narrow screens. The table follows, edge to edge. The footer,
> padded 24px / 16px, holds the pagination. Controls inside keep their own 8px
> radius: the inset is not even on both axes, so the surfaces are not
> concentric. While new rows load, the card is `aria-busy`, the rows dim to
> 60% opacity and the count reads "Updating…".
>
> **Sortable header.** A sortable column header is a button inside the header
> cell, at least 44px tall, with the column label on `label-caps` and a
> direction icon: up, down, or a muted double chevron when the column is not
> the sorted one. The header cell carries `aria-sort`; the icon is decoration.
> Pressing it sorts ascending, pressing again reverses. One column is sorted
> at a time. The change is instant: nothing animates.
>
> **Loading skeleton.** While a screen loads, its shape is drawn in `secondary`
> blocks on the page frame: a title bar, one line of context and a table card
> with five rows. It is `aria-busy` and names itself for assistive technology.
> The pulse is the only movement and stops under reduced motion.
>
> **Route error.** When a screen fails unexpectedly: one heading, one sentence
> saying what to do, a primary "Try again" button, a link to the dashboard and
> a reference code in muted text. No stack trace, no technical message, no
> apology. A list that fails to load is not this state; it keeps the degraded
> alert.
>
> **Shortcut card.** A card that is a link: the tinted icon chip of the metric
> card, a title on the `title` step and one muted sentence. Hover is `primary`
> at 5%, on hover-capable pointers only; focus is the ring of 7.

**5, "Pagination" is replaced by:**

> **Pagination.** In the footer of the table card. Real links, 44px tall, 8px
> radius, `primary` text with a 5% primary hover: first, previous, next, last.
> At an edge the control is muted text with `aria-disabled`. Between them, the
> page status ("Page 2 of 7"). A rows-per-page select (10, 25, 50), styled as a
> form select at 44px, sits on the leading side. Changing the search, the
> filter, the sort or the page size returns to page 1. The footer is omitted
> when the list fits in the smallest page size.

**5, "Empty state" is replaced by:**

> **Empty state.** One sentence naming what would be here, and the button that
> creates the first one. No illustration, no apology. **No results** is its
> second form, shown when a search or a filter matches nothing: a sentence
> naming the term or the filter, a hint, and always a link that clears it.

**6, appended bullets:**

> - Hover styling applies on hover-capable pointers only.
> - A transition names the properties it changes; never `all`.
> - Row hover, sorting, paging and filtering do not animate. A table that is
>   waiting for rows dims by opacity over `150ms`; opacity is the only
>   property that moves.
> - No press scale on buttons.
> - Motion is never the only signal: a changed state also changes text, an
>   icon or an ARIA state.

### 10. Testing strategy

See *Testing Strategy*.

### 11. PR boundaries and coexistence

See *Work Units and Order*. The three-PR plan at 800 lines each does not hold
on these estimates; this is flagged, not resolved.

---

## Data Flow

A sort click on `/users`:

```
User        SortableHeader     ListTable            Router            UsersPage (server)      DB
 │ click "Name"   │                │                   │                     │                 │
 │───────────────►│ onSort("name") │                   │                     │                 │
 │                │───────────────►│ nextSort → {name, asc}                  │                 │
 │                │                │ applyListChange → page 1                │                 │
 │                │                │ usersListHref(state)                    │                 │
 │                │                │ startTransition(replace(href, {scroll:false}))            │
 │                │                │──────────────────►│  GET ?sort=name&dir=asc               │
 │   aria-busy, rows dim, "Updating…"                  │────────────────────►│ requireRole     │
 │                │                │                   │                     │ parseUsersListParams
 │                │                │                   │                     │ listUsuarios ──►│ count, page
 │                │                │                   │                     │◄────────────────│
 │                │                │                   │◄─ RSC: rows, state ─│ pick UserRow    │
 │   th aria-sort="ascending", new rows, count; focus stays on the button    │                 │
```

An unknown value never errors: `?sort=hashClave&dir=DESC&size=1000` parses to
`{ created, desc, 10 }` and renders the default view.

---

## Interfaces / Contracts

```ts
// src/lib/navigation.ts — shared by sidebar, top bar and home
export const NAV_ITEMS: readonly (NavLink | NavGroup)[];     // today's `items`
export const NAV_CONTEXT_ONLY: readonly { key: string; href: string }[];
export function isCurrentPath(pathname: string, href: string): boolean;
export function isNavVisible(item: NavLink, rol: RolUsuario): boolean;
export function trailFor(pathname: string):
  | { groupKey?: string; key: string; href: string; exact: boolean } | null;
export function shortcutsFor(rol: RolUsuario): readonly NavLink[];

// src/lib/list-params.ts — PURE additions
export const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 10;
export type SortDir = "asc" | "desc";
export type ListSort<K extends string> = { key: K; dir: SortDir };
export type StatusFilterValue = "active" | "inactive" | "all";
export function parseEnum<T extends string>(
  raw: string | string[] | undefined, allowed: readonly T[], fallback: T): T;
export function parsePageSize(raw: string | string[] | undefined): PageSize;
export function parseSort<K extends string>(
  rawSort: string | string[] | undefined, rawDir: string | string[] | undefined,
  keys: readonly K[], fallback: ListSort<K>): ListSort<K>;
export function nextSort<K extends string>(
  current: ListSort<K>, key: K): ListSort<K>;      // same key flips, new key asc
export function applyListChange<S extends { page: number }>(
  state: S, change: Partial<S>): S;                // not a page change -> page 1

// src/lib/users/list-params.ts
export const USERS_SORT_KEYS =
  ["name", "login", "role", "status", "created"] as const;
export const USERS_DEFAULT_SORT = { key: "created", dir: "desc" } as const;
export type UsersListState = {
  page: number; q: string; status: StatusFilterValue;
  sort: ListSort<UsersSortKey>; size: PageSize;
};
export function parseUsersListParams(sp: RawSearchParams | undefined): UsersListState;
export function usersListHref(state: Partial<UsersListState>): string;
// USERS_PAGE_SIZE stays exported, equal to DEFAULT_PAGE_SIZE.

// src/lib/catalog/list-params.ts — same shape per list
export const ASIGNATURAS_SORT_KEYS = ["code", "name", "hours", "status"] as const;
export const DOCENTES_SORT_KEYS = ["name", "login", "email", "status"] as const;
export function parseAsignaturasListParams(sp): CatalogListState<AsignaturasSortKey>;
export function parseDocentesListParams(sp): CatalogListState<DocentesSortKey>;
// catalogListHref(base, state) gains sort and size; CATALOG_PAGE_SIZE stays.

// src/lib/data/users.ts
export function buildUsersWhere(
  viewerRol: RolUsuario | undefined, q: string, status: StatusFilterValue): SQL;
export type ListUsuariosParams = {
  viewerRol: RolUsuario; q: string; status: StatusFilterValue;
  sort: ListSort<UsersSortKey>; page: number; pageSize: PageSize;
};
export type UsuarioListItem = {            // no hashClave, cif, telefono, correo
  id: number; nombreCompleto: string; login: string;
  rol: RolUsuario; activo: boolean; creadoEn: Date;
};

// src/components/tables/list-navigation.tsx — client
export function ListNavigationProvider(p: { children: ReactNode }): JSX.Element;
export function useListNavigation(): {
  pending: boolean; navigate: (href: string, mode: "push" | "replace") => void;
};
```

`ListTable` (client) takes `columns`, `rows`, `getRowId`, `state`, `total`,
`hrefFor(state)`, the status options (or none), the labels and the empty-state
copy, and composes `TableCard`, `TableToolbar`, `DataTable` or `EmptyState`,
and `TablePagination`.

TanStack names used above (`ColumnDef`, `ColumnMeta`, `useReactTable`,
`getCoreRowModel`, `flexRender`, `manualSorting`, `manualPagination`,
`manualFiltering`, `state.sorting`, `enableSorting`, `getIsSorted`) come from
the v8 documentation and are **unverified against an installed copy**.

---

## Testing Strategy

Strict TDD: each row's failing test is written before its implementation.

**Two shared helpers, built first in the table-kit slice** (`src/test/`):

- `navigation-mock.ts`: one hoisted `router` object (`push`, `replace`,
  `refresh`, `prefetch`, `back`, `forward` as spies) plus `usePathname`, used
  as `vi.mock("next/navigation", async () => (await import("@/test/navigation-mock")).module)`,
  and a `next/link` stand-in that renders an `a` and calls `onNavigate` on a
  plain click. Whether the real `next/link` can be clicked in jsdom is decided
  by the first RED test; the stand-in is the fallback.
- `intl.tsx`: `renderWithIntl(ui, locale)` with the **real** catalogs and a
  throwing `onError` (generalised from R9), and `keyEchoIntl`, a `next-intl`
  mock whose `useTranslations` echoes keys.

| Layer | What to test | Approach |
|---|---|---|
| Pure parsing | Every parameter: default, each valid value, array, wrong case, hostile strings (`created;drop table`, `hashClave`, `1000`, `0`, `-5`, `10.5`); `sort`/`dir` pairing; `nextSort`; `applyListChange` reset rule; hrefs omit defaults and keep the canonical order | Unit, table-driven |
| Data layer | `orderByFor` emits the whitelisted expression, the secondary key and the `id` tie-breaker for every key and direction; default sort reproduces today's SQL text; email uses `nullif` and `nulls last` both ways; users `where` keeps the role scope first with a `secretaria` session and every status value; clamp with sizes 25 and 50; the list projection has no `hashClave` | DB-free `QueryBuilder().toSQL()`, the `users-query.test.ts` pattern |
| Navigation config | Entries and order equal the previous sidebar list; `trailFor` for every route including nested and unknown ones; `shortcutsFor` per role excludes the dashboard and `settings` | Unit |
| Table kit | `aria-sort` values and absence; header is a button with the column label; `onSort` called with the column id; bounded mode has no button; zero rows render nothing; pagination edges are `aria-disabled` spans, hrefs for first and last, size select calls `replace` with page reset; search submit calls `push` without `page`; `aria-busy` and "Updating…" while pending; the count region is polite | Testing Library with `renderWithIntl` and the navigation mock |
| List client modules | Columns render the row; row actions keep their accessible names; the status filter marks the selection with `aria-current` | Same |
| Shell | Sidebar link lists per role unchanged; identity block shows name and translated role and contains no link or button; top-bar trail per route with `aria-current`; error screen calls `retry` and never prints the message; skeleton is `aria-busy`; home shows role shortcuts and hides the count cards and skips `getDashboardStats` for non-staff | Testing Library; existing `app-sidebar.test.tsx` extended |
| Pages | Guard first; session role, never a URL value, reaches the list function; the new parameters reach it parsed; hostile values reach it as defaults; props handed to the client table contain exactly the picked keys (R1); degraded shows the alert and no table | Existing async-page tests |
| i18n | New sections join `GUARDED_SECTIONS` (R6) | Existing parity test |
| E2E | None available | Manual checklist: 320px and 360px, keyboard pass, reduced motion, both themes, both brands, gate V1 |

**How the three page tests migrate.** They keep `render(await Page(...))` and
their `next-intl/server` key-echo mock. They add two lines: the navigation
mock and `keyEchoIntl`. Because client labels then echo keys like the server
labels do, assertions written against keys keep their text. Assertions that
change: column headers become buttons where sortable; "previous" and "next"
are joined by "first" and "last"; `listUsuarios` expectations gain `status`,
`sort` and the parsed `pageSize`.

---

## Work Units and Order

Estimates are additions plus deletions of authored text, tests included, lock
file excluded. Confidence is low (about ±25%): in `catalog-management` real
sizes ran well above first estimates, and tests here are roughly half of every
slice.

| Slice | Content | Est. |
|---|---|---|
| **1a Orientation** | `docs/design-system.md` (first commit); `src/lib/navigation.ts` + test; `app-sidebar.tsx` + test (config import, identity block); `page-context.tsx` + test; `dashboard-header.tsx`; `layout.tsx`; `src/lib/initials.ts` + test; `theme-toggle.tsx`; i18n (`nav.context`, `nav.profile`, `roles`); parity list | 600-750 |
| **1b States and home** | `loading.tsx`, `error.tsx` + tests; `table-card.tsx`, `empty-state.tsx`, `degraded-alert.tsx`, `page-frame.tsx` + tests; `(dashboard)/page.tsx` + new test; i18n (`shell`, `dashboard`) | 600-750 |
| **2a URL contract and users data layer** | `list-params.ts` + test; `users/list-params.ts` + test; `data/sort-sql.ts` + test; `data/users.ts` (`listUsuarios`, where, projection) + `users-query.test.ts`; `users/page.tsx` passes the parsed state through (no new control yet) + test. Gate S1 | 500-650 |
| **2b Table core** | `@tanstack/react-table`; `src/test/*`; `tables/list-navigation.tsx`, `tables/data-table.tsx`, `tables/sortable-header.tsx` + tests; `ui/table.tsx`; i18n (`tables` core). Gate V1 | 500-650 |
| **2c Table controls** | `tables/table-toolbar.tsx`, `tables/status-filter.tsx`, `tables/table-pagination.tsx`, `tables/list-table.tsx` + tests; i18n (`tables` controls) | 650-850 |
| **2d Users migration** | `users/users-table.tsx` + test; `users/page.tsx` + `page.test.tsx`; i18n (`users`) | 450-550 |
| **3a Catalog URL contract and data layer** | `catalog/list-params.ts` + test; `data/asignaturas.ts` + test; `listDocentes` + test | 350-450 |
| **3b Asignaturas** | `asignaturas-table.tsx` + test; `page.tsx` + `page.test.tsx`; i18n | 600-750 |
| **3c Docentes** | `docentes-table.tsx` + test; `page.tsx` + `page.test.tsx`; i18n | 450-550 |
| **3d Bounded tables and removal** | `asignatura-grupos-table.tsx` + test; `asignatura-grupos-section.tsx`; edit page + test; `import-preview.tsx`, `import-errors.tsx` + tests; delete `data-table.tsx`, `data-table-pagination.tsx`, `data-table-search.tsx`, `status-filter.tsx` and their four tests; `current-marker-usage.test.ts` paths (R7); remove `catalog.shared.filter` and the per-list pagination keys | 1,100-1,300, of which about 780 are pure deletions |

**Total: about 5,800-7,250 changed lines**, against 1,900-2,600 in the
proposal. Mapped onto the proposal's three PRs: PR 1 = 1a + 1b (1,200-1,500),
PR 2 = 2a-2d (2,100-2,700), PR 3 = 3a-3d (2,500-3,050). **Every one of the
three exceeds 800.** The seams above are the split points; each slice builds,
passes the four checks and can be reverted alone in reverse order.

**Coexistence.** New table code lives in `src/components/tables/`; the four
old components are not edited and keep serving the catalog pages until 3b, 3c
and 3d replace their last consumers. `USERS_PAGE_SIZE`, `CATALOG_PAGE_SIZE`
and `parseCatalogListParams` keep working until 3a. From 2a to 3a the catalog
lists ignore `sort` and `size`, exactly as the previous parsers ignore unknown
parameters. The `ui/table.tsx` edit in 2b applies to old and new tables alike
and is a visual no-op apart from the hover fade.

---

## File Changes

| File | Action | Description |
|---|---|---|
| `docs/design-system.md` | Modify | Decision 9, first commit of 1a |
| `src/lib/navigation.ts` (+ test) | Create | Shared navigation config, trail, shortcuts |
| `src/lib/initials.ts` (+ test) | Create | Moved from `dashboard-header.tsx` |
| `src/components/app-sidebar.tsx` (+ test) | Modify | Imports the config; identity block; entries untouched |
| `src/components/page-context.tsx` (+ test) | Create | Top-bar trail (client) |
| `src/components/dashboard-header.tsx` | Modify | Renders `PageContext`; uses shared `initials` |
| `src/components/theme-toggle.tsx` | Modify | Named transition properties |
| `src/app/(dashboard)/layout.tsx` | Modify | Passes the user name to the sidebar |
| `src/app/(dashboard)/loading.tsx`, `error.tsx` (+ tests) | Create | Boundaries |
| `src/components/table-card.tsx`, `empty-state.tsx`, `degraded-alert.tsx`, `page-frame.tsx` (+ tests) | Create | Shared states and frame |
| `src/app/(dashboard)/page.tsx` (+ test) | Modify / Create | Role-aware home |
| `package.json`, lock file | Modify | `@tanstack/react-table` (owner approval) |
| `src/test/navigation-mock.ts`, `src/test/intl.tsx` | Create | Shared test helpers |
| `src/lib/list-params.ts`, `src/lib/users/list-params.ts`, `src/lib/catalog/list-params.ts` (+ tests) | Modify | Decision 6 |
| `src/lib/data/sort-sql.ts` (+ test) | Create | Whitelist-to-SQL, collation, nulls |
| `src/lib/data/users.ts`, `src/lib/data/asignaturas.ts` (+ tests) | Modify | Decision 7 |
| `src/components/tables/{list-navigation,data-table,sortable-header,table-toolbar,status-filter,table-pagination,list-table}.tsx` (+ tests) | Create | Table kit |
| `src/components/ui/table.tsx` | Modify | Row hover no longer transitions |
| `src/app/(dashboard)/users/users-table.tsx` (+ test), `users/page.tsx` (+ test) | Create / Modify | Users migration |
| `src/app/(dashboard)/catalog/asignaturas/asignaturas-table.tsx`, `catalog/docentes/docentes-table.tsx` (+ tests), both `page.tsx` (+ tests) | Create / Modify | Catalog lists |
| `src/app/(dashboard)/catalog/asignaturas/asignatura-grupos-table.tsx` (+ test), `asignatura-grupos-section.tsx`, `[id]/edit/page.tsx` (+ test) | Create / Modify | Bounded table; function props removed |
| `src/app/(dashboard)/catalog/import/import-preview.tsx`, `import-errors.tsx` (+ tests) | Modify | Bounded mode (R2) |
| `src/components/data-table.tsx`, `data-table-pagination.tsx`, `data-table-search.tsx`, `status-filter.tsx` (+ four tests) | Delete | Replaced by the kit, in 3d |
| `src/app/(dashboard)/catalog/current-marker-usage.test.ts`, `src/i18n/catalog-parity.test.ts` | Modify | Paths and guarded sections |
| `i18n/es.json`, `i18n/en.json` | Modify | `nav.context`, `nav.profile`, `roles`, `shell`, `dashboard`, `tables`, per-list keys; identical key sets |
| `src/app/globals.css` | **Not modified** | Decision 9 |

---

## Points the specs must pin

1. Parameter names `sort`, `dir`, `size`; the value sets, defaults and the
   fallback rules of decision 6, including "a valid `sort` without a valid
   `dir` is ascending".
2. `status asc` means active first; empty emails are last in both directions.
3. The secondary sort key and the `id` tie-breaker of decision 7.
4. `push` for page, filter and search; `replace` for sort and size.
5. The pagination footer is omitted when the total fits in 10 rows.
6. The users list never sends credential or contact fields to the browser
   (R1). This is a new, testable requirement of `users-listing`.
7. `ErrorsTable` migrates in bounded mode with identical rendering (R2);
   `catalog-excel-import` gains no requirement.
8. The home shows no shortcut to `/settings`, and count cards only to roles
   that may open `/users`.
9. The top-bar context shows the section and entry, never a record name.

---

## Threat Matrix

N/A: no shell command, subprocess, VCS or PR automation, executable-file
classification or process-integration boundary. The URL-parameter attack
surface (hostile `sort`, `dir`, `size`, `status`, and scope widening under a
`secretaria` session) is covered by decisions 6 and 7 and by the "Pure
parsing", "Data layer" and "Pages" rows of the testing strategy.

---

## Migration / Rollout

No data migration and no feature flag. Slices merge in the listed order and
revert in reverse order. URLs carrying the new parameters keep working after a
revert, because the previous parsers ignore unknown parameters. Dependency
install precondition (owner approval required, D2 risk): run
`npm view @tanstack/react-table version peerDependencies` (read-only), confirm
the `react` and `react-dom` ranges admit 19.2.8, install the exact version,
then confirm `npm ls react` reports no peer conflict and `npx eslint src`
reports no new `react-hooks` finding on `useReactTable`.

---

## Open Questions

- [ ] **1. Delivery (owner, blocks tasks).** The estimates put all three PRs
      over 800 lines. Choose between about ten slices of 800 or fewer on a
      chain, or three PRs each with an accepted `size:exception`.
- [ ] **2. A3 and collation (owner).** Accept that the docentes default order
      may move for accented or lowercase-initial names, or keep names on the
      database default collation and accept that accented names sort after
      `Z` when the database collation is `C`. Gate S1 tells which case applies.
- [ ] **3. Gate S1** `[READ-ONLY]`: does `es-x-icu` exist in the Neon database?
- [ ] **4. Home counts (owner, not blocking).** The count cards show
      system-wide totals to `secretaria`, who sees only docentes in `/users`.
      Unchanged here; confirm it is acceptable.
- [ ] **5. Gate V1:** does `loading.tsx` re-show on a query-only navigation?
- [ ] **6. Unverified:** the `@tanstack/react-table` peer range against React
      19.2.8, its API names against the installed version, and whether the
      real `next/link` is clickable in jsdom.
