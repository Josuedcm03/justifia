# Backoffice Shell Specification (new capability)

> Delta type: this whole file is ADDED. There is no base spec for
> `backoffice-shell`. It describes the shared chrome of the `(dashboard)` route
> group and the dashboard home.

## Purpose

The shared frame of every backoffice page: the top bar with its page context,
the sidebar with its brand and identity blocks, the page frame, the loading and
error boundaries, the shared empty, no-results and degraded states, and the
role-aware dashboard home. The sidebar entries, their order and their role
predicates are owned by existing specs (CM-NAV-1 for the catalog destinations)
and MUST NOT change here.

Traceability (checked against `docs/requirements.md`):

- RNF-01 (b), "the menu of each role shows only its options": regression guard
  after the sidebar rewrite.
- RNF-11, "the student screens show no horizontal scroll from 360px width": it
  names student screens, so it is cited only for the shared shell and the
  dashboard home, not for the staff tables.
- RNF-10 is motivation only and is not claimed (verified in the pilot).
- Accessibility cites `docs/design-system.md` section 7; i18n and token rules
  cite `openspec/config.yaml` conventions. Neither is an RNF.

Role vocabulary: staff roles are `administrador`, `coordinacion`, `secretaria`.
`estudiante` and `docente` are the other roles. Entry visibility uses the same
predicates as the sidebar: `canFileRequests` (My requests, New request),
`canReviewRequests` (Review requests), `canManageCatalog` (Asignaturas,
Docentes), `canImportCatalog` (import), `canCreateUsers` (Users).

## Requirements

### Requirement: BS-CTX-1 Top bar shows the page context

Every dashboard page MUST show its location in the top bar, on the leading side,
as a section trail derived from the shared navigation configuration: the menu
group, when the entry has one, as muted text, then the menu entry (for example
"Administration / Subjects"), with the labels the sidebar uses in the user's
language (Q5 decided: section trail, never record names). The trail MUST NOT
contain a record name, code or any data read from the page. Below the `md`
breakpoint only the entry MUST show. The trail is context, not a heading: the
page keeps exactly one `h1`, in the page header. The trail MUST come from the
same configuration that drives the sidebar, so a renamed or added entry cannot
leave them disagreeing; when several entries match a path the most specific one
owns it (`/requests/new` is New request, not a page below My requests); a route
with no menu entry MAY be covered by an explicit context-only entry (the profile
page), and a route with no match MUST render no trail. When the page is the entry itself, the entry MUST be text with
`aria-current="page"`; when the page is below the entry (a create or edit form)
the entry MUST be a link back to it and MUST NOT carry `aria-current`. The trail
is not role-filtered, and it is not a second "you are here" marker: it takes
neither the sidebar bar nor the breadcrumb underline. The in-page breadcrumbs of
the create and edit pages (CM-GRP-9, CM-GRP-10) stay in the page and keep
satisfying their own scenarios.

#### Scenario: Trail per section (table-driven)

| Path | Trail | Entry is |
|---|---|---|
| `/` | Dashboard | text, `aria-current` |
| `/users` | Administration / Users | text, `aria-current` |
| `/catalog/asignaturas` | Administration / Asignaturas entry | text, `aria-current` |
| `/catalog/asignaturas/3/edit` | Administration / Asignaturas entry | link to the list, no `aria-current` |
| `/catalog/asignaturas/3/grupos/5/edit` | Administration / Asignaturas entry | link to the list, no `aria-current` |
| `/catalog/docentes` | Administration / Docentes entry | text, `aria-current` |
| `/requests` | My requests | text, `aria-current` |
| `/requests/42` | My requests | link to the list, no `aria-current` |
| `/requests/new` | New request | text, `aria-current` |
| `/review` | Review requests | text, `aria-current` |
| `/review/42` | Review requests | link to the list, no `aria-current` |
| a route with no entry and no context-only entry | no trail | n/a |

- GIVEN a viewer allowed on the path from the row
- WHEN the page renders in `es` and in `en`
- THEN the top bar shows the trail from the row in that language, with the same
  labels as the sidebar
- AND the page has exactly one `h1`
- AND no record name, code or id appears in the trail

#### Scenario: Narrow viewport

- GIVEN a viewport below `md`
- WHEN a page under Administration renders
- THEN only the entry is shown and nothing overflows horizontally

#### Scenario: Page breadcrumbs unchanged

- GIVEN a create or edit page that has an in-page breadcrumb
- WHEN it renders
- THEN its breadcrumb and its current-page marker are unchanged and the top-bar
  trail adds no second current-page marker of the same kind

### Requirement: BS-NAV-1 Sidebar entries are unchanged

The sidebar body MUST show the same entries, in the same order, with the same
group and the same visibility predicates as before the backoffice refresh, and
the same active marker (the 4px bar paired with `aria-current`), with one
addition: the Enrollment entry for `estudiante` (BS-NAV-3). The `/settings`
entry MUST stay exactly as it is (D7), including its target. The
"Administration" group MUST still render only when at least one child is
visible.
(Previously: no entry was added; the student saw My requests and New request only.)

#### Scenario: Entries per role (table-driven)

| Role | Entries shown |
|---|---|
| `estudiante` | Dashboard, My requests, New request, Enrollment, Settings |
| `docente` | Dashboard, Settings |
| `administrador` | Dashboard, Administration (Asignaturas, Docentes, Users), Settings |
| `coordinacion` | Dashboard, Administration (Asignaturas, Docentes, Users), Settings |
| `secretaria` | Dashboard, Review requests, Administration (Asignaturas, Docentes, Import, Users), Settings |

- GIVEN a signed-in user with the role from the row
- WHEN the sidebar renders
- THEN exactly the entries in the row are shown, in that order
- AND no Grupos destination is offered (CM-NAV-1)

#### Scenario: Settings entry unchanged

- GIVEN any signed-in role
- WHEN the sidebar renders
- THEN the Settings entry is present with its previous label, icon, position and
  `/settings` target

#### Scenario: Active marker

- GIVEN the path `/catalog/asignaturas/3/grupos/new`
- WHEN the sidebar renders
- THEN only the Asignaturas entry is active and carries `aria-current`

#### Scenario: Administration group hidden when empty

- GIVEN a role that sees no Administration child
- WHEN the sidebar renders
- THEN the Administration group is not rendered

### Requirement: BS-NAV-2 Sidebar brand block and identity footer

The sidebar header MUST keep its existing content (logo and application name)
as a documented brand block. The sidebar footer MUST show an identity block with
an initials avatar, the user's name and the user's role, the role in the user's
language. The identity block is informative: it MUST be text only, with no link,
no button and no hover state, it MUST NOT be a menu or open one, and the user
menu MUST remain in the top bar (A2). The initials avatar is decoration and
MUST be hidden from assistive technology (the name carries the meaning). The
block MUST show only data of the authenticated session and MUST NOT make an
additional data query. The sidebar's link lists per role MUST be unchanged by
its presence.

#### Scenario: Identity shown

- GIVEN a signed-in `coordinacion` user named "Ana Perez" in the `es` locale
- WHEN the sidebar renders
- THEN the footer shows the initials "AP", the name "Ana Perez" and the role in
  Spanish

#### Scenario: Role per locale

- GIVEN the same user
- WHEN the locale switches between `es` and `en`
- THEN the role label changes language and the name does not

#### Scenario: Not a menu and no extra read

- GIVEN the rendered footer
- WHEN its structure is inspected
- THEN it contains no link, no button and no trigger with a popup, the avatar is
  hidden from assistive technology, and the user menu is still reachable from the
  top bar
- AND rendering it issues no data query beyond the session

#### Scenario: Name edge cases

- GIVEN a name with one word, and separately a name with extra whitespace
- WHEN the avatar renders
- THEN the initials are one and two characters respectively, never empty or
  `undefined`

### Requirement: BS-FRM-1 Page frame

The pages this change rewrites (home, users, asignaturas, docentes) MUST use
one documented stack inside the shell: page header, then content (table card
for lists), with the existing 32px rhythm between them; other pages keep their
current wrapper. Each dashboard page MUST have exactly one `h1`, rendered by the page
header, and heading levels MUST NOT skip (design system section 7). A list
page's content is the shared table card with a toolbar region, the table and a
footer region; the footer is omitted when the list fits in 10 rows
(`data-table` DT-PAG-1).

#### Scenario: Frame structure

- GIVEN the users, asignaturas and docentes pages with more than 10 results
- WHEN each renders
- THEN each has a page header with one `h1`, followed by one table card whose
  toolbar, table and footer regions appear in that order
- AND with 10 results or fewer the card has no footer region

### Requirement: BS-LOAD-1 Loading skeleton

A client-side navigation between dashboard pages MUST show a loading skeleton in
the content area while the page loads, instead of nothing. The skeleton draws the
page frame (a title, one context line and a table card with rows; the home draws
its count and shortcut cards instead), MUST keep the shell (top bar and sidebar)
in place, MUST be announced as loading to assistive technology (a busy state
with a text label from the catalogs), and MUST not rely on motion: under reduced
motion it MUST be static. The first document load is not covered: the shell
itself waits for the session, and no skeleton is required there. The same
skeleton is what a changed list view shows while it loads when the change stays
on the same route (sort, filter, search, page size or page; DT-PEND-1).

#### Scenario: Skeleton on navigation

- GIVEN a signed-in user on the dashboard
- WHEN they navigate to `/users` and the page has not yet resolved
- THEN the content area shows the skeleton and the shell stays visible

#### Scenario: Skeleton on a same-route list change

- GIVEN a signed-in user on `/users`
- WHEN they change the sort, filter, search, page size or page and the new
  results have not yet resolved
- THEN the content area shows the skeleton in place of the list and the shell
  stays visible

#### Scenario: Skeleton is announced and static under reduced motion

- GIVEN `prefers-reduced-motion: reduce`
- WHEN the skeleton renders
- THEN it exposes a loading label to assistive technology and no motion runs

### Requirement: BS-ERR-1 Route error boundary

An unexpected error thrown while rendering a dashboard page MUST show a
designed error screen inside the shell, with one `h1` (the page that held it is
gone). The screen MUST say that something went wrong and what the user can do,
MUST offer a primary "try again" control that retries and a link to the
dashboard, and MUST NOT show the raw error message or a stack. A short opaque
reference code MAY be shown as muted text for support. The screen MUST be
announced as an alert and move focus to its heading. The retry MUST re-attempt
rendering the same route. `{data, degraded}` remains the normal failure path for
reads: a failed read MUST NOT reach this boundary.

#### Scenario: Unexpected throw

- GIVEN a dashboard page that throws while rendering with the message
  "secret internal detail"
- WHEN the error screen renders
- THEN a localized explanation, a retry control and a link to the dashboard are
  shown, with the screen announced as an alert and focus on its heading
- AND the text "secret internal detail" is not rendered

#### Scenario: Retry

- GIVEN the error screen
- WHEN the user activates retry
- THEN the route re-renders; if it succeeds the page replaces the error screen

#### Scenario: Degraded read does not use the boundary

- GIVEN a list whose read fails
- WHEN the page renders
- THEN the degraded alert is shown and the error boundary is not triggered

#### Scenario: Error screen accessible

- GIVEN the error screen
- WHEN it is inspected
- THEN the retry control is keyboard operable with visible focus and a 44px
  target, and the screen has exactly one `h1`

### Requirement: BS-STATE-1 Shared empty and no-results states

The empty state and the no-results state MUST be one shared component used by
every list. The empty state explains that there is nothing yet and MAY offer the
primary action of the list. The no-results state MUST state that nothing matches
and MUST always include a link that clears the search and filters. Both
states MUST be text, not colour alone. Whether a table or an empty state is
shown is decided by the list as a whole (`data-table` DT-STATE-1), so a table
with no rows is never rendered.

#### Scenario: Empty with a primary action

- GIVEN the users list with no users in scope and no search
- WHEN it renders
- THEN the empty state is shown with the "new user" action

#### Scenario: No results always offers a clear control

- GIVEN a list with a term that matches nothing, and separately one with a
  non-default status that matches nothing
- WHEN each renders
- THEN each shows the no-results state with a clear control
- AND the term, when present, appears in the message

### Requirement: BS-STATE-2 Shared degraded alert

The degraded notice MUST be one shared component used by every list and by any
section whose read can degrade. It MUST be exposed with `role="status"`, state
in text that the data could not be loaded, and not rely on colour alone. When
shown it MUST replace the data region and MUST NOT be accompanied by counts or
by an empty-results message.

#### Scenario: Degraded notice

- GIVEN a read that returns `degraded: true`
- WHEN the page renders
- THEN the shared alert with `role="status"` and localized text is shown
- AND no count and no empty or no-results message is shown

#### Scenario: Used inside a section

- GIVEN the groups read of an Asignatura fails
- WHEN its edit page renders
- THEN the Grupos section shows the same alert and the rest of the page renders

### Requirement: BS-HOME-1 Role-aware dashboard home

The dashboard home MUST show a shortcut card for every menu destination the
viewer's role can see, derived from the same navigation configuration and
predicates as the sidebar, in the sidebar's order (My requests, New request,
Enrollment, Review requests, Asignaturas, Docentes, Import, Users);
the Dashboard entry and the Settings entry are not offered as shortcuts (the
settings route does not exist; D7 freezes the sidebar entry, not a second dead
link). User-count cards (total and active users) MUST show only to roles that
may open `/users`, and MUST use the existing stats read without a new data
query (D9); that read MUST NOT be performed for a role that does not show the
cards. No shortcut MUST lead to a destination the role cannot open. A role with no shortcut and no counts MUST see the page header and
a short localized message instead of an empty area.
(Previously: the student shortcuts were My requests and New request.)

#### Scenario: Home per role (table-driven)

| Role | Shortcut cards | User-count cards |
|---|---|---|
| `estudiante` | My requests, New request, Enrollment | no |
| `docente` | none (message shown) | no |
| `administrador` | Asignaturas, Docentes, Users | yes |
| `coordinacion` | Asignaturas, Docentes, Users | yes |
| `secretaria` | Review requests, Asignaturas, Docentes, Import, Users | yes |

- GIVEN a signed-in user with the role from the row
- WHEN the dashboard home renders
- THEN the cards are exactly as in the row
- AND each shortcut links to the same target as its sidebar entry

#### Scenario: Counts hidden from student and docente

- GIVEN an `estudiante`, and separately a `docente`
- WHEN the home renders
- THEN no total-users or active-users figure is present in the page
- AND the stats read is not performed for that request

#### Scenario: No shortcut to settings

- GIVEN any role
- WHEN the home renders
- THEN no card links to `/settings` and no card links to `/`

#### Scenario: Stats read degrades

- GIVEN a role that sees user-count cards and a failed stats read
- WHEN the home renders
- THEN the degraded alert is shown in place of the figures, not zeros presented as
  real counts

#### Scenario: Predicates stay in step

- GIVEN a change of a sidebar visibility predicate
- WHEN the sidebar and the home render for the affected role
- THEN both show or both hide the destination

### Requirement: BS-RSP-1 Narrow-width behaviour of the shell and the home

The shell (top bar, sidebar sheet, identity block, page frame, loading and error
screens) and the dashboard home MUST show no horizontal scroll from 360px width
(RNF-11, shell and home only) and MUST NOT clip content or controls at 320px.
There is no E2E layer; this is verified manually and by structural tests of the
responsive classes where they exist.

#### Scenario: 360px

- GIVEN a 360px viewport and each role's home
- WHEN the page loads
- THEN the document does not scroll horizontally

#### Scenario: 320px

- GIVEN a 320px viewport
- WHEN the shell and the home render
- THEN no text or control is clipped or overlapped

### Requirement: BS-MOT-1 Motion and interaction states

Any movement, scale or blur introduced by this change MUST run only when the
user has not asked for reduced motion; under reduced motion the change MUST be
shown without movement (an opacity change is acceptable). Transitions MUST name
the properties they change and MUST NOT use `all`; the existing `transition-all`
in the top bar and theme toggle MUST be replaced. Hover-only styling MUST apply
only on hover-capable pointers. A state change MUST leave a static cue (text,
icon or shape) when its animation does not run. Table row hover, sorting, paging
and filtering MUST NOT animate; a list waiting for rows shows the skeleton
instead of dimming (DT-PEND-1). Buttons MUST NOT scale on press (Q7 decided:
no press-scale feedback). The skeleton pulse is the only movement the shell
adds, and it stops under reduced motion.

#### Scenario: Reduced motion

- GIVEN `prefers-reduced-motion: reduce`
- WHEN the skeleton (including the one shown for a pending list change), the
  theme toggle and the sidebar render
- THEN no movement, scale or blur runs and every state is still distinguishable

#### Scenario: No `all` transitions

- GIVEN the shell components changed by this change
- WHEN their styles are inspected
- THEN no `transition: all` and no `transition-all` remains

#### Scenario: Hover only on hover-capable pointers

- GIVEN a touch-only pointer
- WHEN a control is tapped
- THEN no hover style stays latched on it

### Requirement: BS-A11Y-1 Accessibility floor of the shell

The new shell elements MUST meet `docs/design-system.md` section 7: text contrast
4.5:1 (large text and graphics 3:1), visible focus, meaning never by colour
alone, interactive targets of at least 44x44px on touch, one `h1` per screen and
no skipped heading levels. Landmarks (navigation, main, banner) MUST be
labelled where more than one of a kind exists.

#### Scenario: Landmarks and focus

- GIVEN the rendered shell
- WHEN it is navigated by keyboard
- THEN every interactive element is reachable in a logical order with a visible
  focus indicator
- AND the sidebar navigation and the top-bar trail are labelled landmarks

### Requirement: BS-I18N-1 Shell copy in both locales

Every user-visible string of the shell and the home (trail labels, identity
role labels, skeleton label, error text, shared states, shortcut cards, home
message) MUST come from the i18n catalogs and exist in both `es` and `en`, with
identical key sets (`openspec/config.yaml`).

#### Scenario: Key parity

- GIVEN the `es` and `en` catalogs
- WHEN their key sets are compared
- THEN they are identical and every new value is non-empty

### Requirement: BS-DS-1 Design-system constraints

Every non-colour pattern this change introduces (top-bar context, sidebar brand
and footer blocks, table card with toolbar and footer, sortable header,
revised pagination, skeleton, route error state, no-results variant, motion
rules) MUST be described in `docs/design-system.md`. No colour token MUST be
added, removed or altered by this change (D1), and no colour, radius, type
size or spacing step absent from that document MUST be introduced
(`openspec/config.yaml`; D13).

#### Scenario: Colour tokens untouched

- GIVEN `src/app/globals.css` before and after the change
- WHEN the colour token declarations are compared
- THEN they are byte-identical

#### Scenario: Patterns documented

- GIVEN the list of new patterns above
- WHEN `docs/design-system.md` is read
- THEN each has a documented description

### Requirement: BS-NAV-3 Enrollment destination for students

The navigation configuration MUST contain one Enrollment entry targeting
`/enrollment`, placed after New request, visible only to the roles that may
open that page (`estudiante`), through the same predicate the page enforces. It
MUST get its sidebar entry, its dashboard shortcut and its top-bar trail from
that one entry (BS-CTX-1, BS-HOME-1), with a label in both `es` and `en`. No role other than `estudiante` MUST see it.

#### Scenario: Entry and active marker

- GIVEN a signed-in `estudiante` on `/enrollment`
- WHEN the sidebar renders
- THEN the Enrollment entry is present, active and carries `aria-current`
- AND on `/requests/new` it is not active

#### Scenario: Trail

- GIVEN a signed-in `estudiante` on `/enrollment`
- WHEN the top bar renders in `es` and in `en`
- THEN the trail shows the Enrollment label as text with `aria-current`, the page
  has exactly one `h1`, and no record name appears

#### Scenario: Hidden from other roles (table-driven)

| Role |
|---|
| `docente` |
| `secretaria` |
| `coordinacion` |
| `administrador` |

- GIVEN a signed-in user with the role from the row
- WHEN the sidebar and the home render
- THEN no Enrollment entry and no Enrollment shortcut is shown

## Assumptions and open points

Decided in design and stated above: Q5 (section trail, never record names),
Q6 (density unchanged, DT-DENS-1), Q7 (no press scale, BS-MOT-1), Q8
(collation, in `data-table` DT-SORT-1).

Needs owner confirmation (consistent with the design's home section):

- A-HOME-EMPTY: the `docente` role has no shortcut and no count, so it sees one
  short sentence under the page header. The owner may prefer another treatment.
- A-HOME-DEGRADED: the current home ignores the `degraded` flag and shows zeros
  when the stats read fails; this change shows the degraded alert instead,
  consistent with the fail-soft convention (a small behaviour change).
- A-HOME-SCOPE (design Open Question 4, not blocking): the count cards show
  system-wide totals, so a `secretaria` (whose users list is limited to
  `docente`) sees totals that include other roles. D9 forbids a new query, so
  the counts stay as they are; the owner must confirm this is acceptable.

Resolved (design gate V1): the skeleton does show again on a query-only
navigation. BS-LOAD-1 and DT-PEND-1 describe that behaviour, which the owner
accepted on 2026-10-18.
