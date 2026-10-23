# Users Listing Specification

## Purpose

The users list is a data table scoped by the viewer's role, paginated on the
server and searchable. Who may open the list at all is owned by
`staff-account-creation` (the users module is reserved for `administrador`,
`coordinacion` and `secretaria`) and the redirect for everyone else by
`permission-denied-screen`. This capability specifies what an allowed viewer
sees and how they navigate it.

Viewer scope (user decision):

| Viewer role | Rows visible |
|---|---|
| `administrador` | all users |
| `coordinacion` | all users |
| `secretaria` | only users whose role is `docente` |
| `docente`, `estudiante` | cannot open the list (denied screen) |

Users are shown newest first by creation date (the existing order), with the user
`Id` as a tie-break. This replaces the current fixed cap of 100 rows: every
in-scope user is reachable through pagination.

## Requirements

### Requirement: Viewer scope is enforced by the server inside the query

The rows returned to a viewer MUST be limited to the roles that viewer may see
(table in Purpose). The scope MUST be applied inside the data query, not by
filtering after the fact and not in the browser, so that a viewer never receives
rows outside the scope. The total count, the page contents and every search
result MUST all be computed within the scope. The scope MUST be derived from the
authenticated session and MUST NOT be read from the URL or any request
parameter; a request that tries to widen it MUST have no effect.

#### Scenario: Visible roles per viewer (table-driven)

| Viewer role | Roles present in the results |
|---|---|
| `administrador` | `administrador`, `coordinacion`, `secretaria`, `docente`, `estudiante` |
| `coordinacion` | `administrador`, `coordinacion`, `secretaria`, `docente`, `estudiante` |
| `secretaria` | `docente` only |

- GIVEN stored users of all five roles
- WHEN the viewer from the row loads the list
- THEN the results contain users of exactly the roles in the row, and no others

#### Scenario: Secretaria never receives out-of-scope rows

- GIVEN stored users of all five roles
- WHEN a `secretaria` loads any page of the list, with or without a search term
- THEN the data returned to that request contains only `docente` users
- AND the total count equals the number of stored `docente` users, not of all users

#### Scenario: Docente and estudiante cannot open the list

- GIVEN an authenticated `docente` or `estudiante`
- WHEN they request the list
- THEN no rows are returned or rendered and they are redirected to the
  permission-denied screen

#### Scenario: Attempt to widen the scope through the URL

- GIVEN a `secretaria`
- WHEN they request the list with extra parameters such as `role=administrador`,
  `scope=all` or `rol=`, in any combination with `page` and `q`
- THEN the results are identical to the request without those parameters
- AND only `docente` users are returned

#### Scenario: Unauthenticated request

- GIVEN no session
- WHEN the list is requested
- THEN the caller is sent to login and no rows are returned

### Requirement: Data table content and empty state

The list MUST render the existing columns (name, login, role, status, created
date) as an accessible table: a table with column headers and an accessible name.
Each row MUST show one user. The role column MUST show the role code. When the
viewer's results are empty, an empty state MUST be shown instead of a table with
no rows.

#### Scenario: Columns and rows

- GIVEN a viewer whose scope contains users
- WHEN the list renders
- THEN column headers name, login, role, status and created date are present
- AND each result is one row with those values, the role shown as its code

#### Scenario: Empty scope shows an empty state

- GIVEN a viewer whose scope contains no users and no search term
- WHEN the list renders
- THEN an empty-state message is shown and no table rows are rendered

#### Scenario: Table is programmatically identifiable

- GIVEN the rendered table
- WHEN its structure is inspected
- THEN it has an accessible name and each column header is associated with its
  cells

### Requirement: Server-side pagination

Pagination MUST be performed on the server: a request loads only the rows of the
requested page. The page MUST be kept in the URL, so that reloading or sharing
the URL shows the same page. The page size MUST be selectable among 10, 25 and
50, held in the `size` parameter, with a default of 10 (D11); any other or
invalid value MUST fall back to 10. The footer controls MUST show the page
status (the current page of the total number of pages) and MUST offer first,
previous, next and last; first and previous MUST be unavailable (not operable,
exposed as disabled) at the first page and next and last at the last page. The
total count of results MUST be shown once, in the toolbar, and MUST NOT be
repeated in the footer (`data-table` DT-PAG-1, DT-TOOL-1). The footer holding
these controls MUST be omitted when the viewer's results fit in 10 rows or fewer
(`data-table` DT-PAG-1). The order MUST be deterministic and stable across
pages, using the user `Id` as a tie-break, so that no row is skipped or repeated
when several users share a creation date or any other sort value.
(Previously: the page size was fixed at 10 and only previous and next existed;
the controls showed the page, the total pages and the total count of results.)

#### Scenario: Page parameter handling (table-driven)

Given 25 in-scope users and page size 10 (3 pages):

| `page` value in URL | Page shown |
|---|---|
| absent | 1 |
| `1` | 1 |
| `2` | 2 |
| `3` | 3 (5 rows) |
| `4` | 3 (out of range, clamped to the last page) |
| `999` | 3 (clamped) |
| `0` | 1 |
| `-1` | 1 |
| `abc` | 1 |
| `2.5` | 1 |
| empty string | 1 |

- GIVEN 25 in-scope users
- WHEN the list is requested with the `page` value from the row
- THEN the page shown is the one in the row and no error occurs

#### Scenario: Controls at the bounds

- GIVEN 25 in-scope users
- WHEN page 1 is shown, and separately page 3
- THEN on page 1 first and previous are unavailable and next and last are available
- AND on page 3 next and last are unavailable and first and previous are available
- AND the footer shows the page status "Page <n> of 3" and not the total count
- AND the toolbar shows "25 results" once

#### Scenario: Page size options (table-driven)

| `size` value in URL | Rows per page |
|---|---|
| absent | 10 |
| `10` | 10 |
| `25` | 25 |
| `50` | 50 |
| `5`, `100`, `1000`, `0`, `-5`, `abc`, `10.5`, `010`, empty, repeated | 10 |

- GIVEN 60 in-scope users
- WHEN the list is requested with the value from the row
- THEN each page holds the number of rows in the row, and no error occurs

#### Scenario: Page clamps against the chosen size

- GIVEN 25 in-scope users and `page=3&size=25`
- WHEN the list is requested
- THEN page 1 is shown, the only page

#### Scenario: First and last navigation

- GIVEN 25 in-scope users, page size 10, viewing page 2
- WHEN the user activates last, then first
- THEN page 3 and then page 1 are shown

#### Scenario: Stable order across pages with equal creation dates

- GIVEN 25 in-scope users of which 12 share the same creation timestamp
- WHEN pages 1, 2 and 3 are read in turn
- THEN every user appears exactly once across the three pages
- AND repeating the same request returns the same rows in the same order

#### Scenario: Page survives a reload

- GIVEN a viewer on page 2
- WHEN they reload the URL
- THEN page 2 is shown again

#### Scenario: Single page or no results

- GIVEN a viewer whose results are 10 or fewer, separately 20 results with
  `size=25`, and separately zero results
- WHEN the list renders
- THEN with 10 or fewer results no footer is shown
- AND with 20 results at size 25 the footer shows all four paging controls
  unavailable and the page status "Page 1 of 1"
- AND with zero results the empty state is shown without error and no footer

### Requirement: Search within the viewer scope

The list MUST provide a search over user name and login (and email, assumption)
that is a case-insensitive partial match. Leading and trailing whitespace in the
term MUST be ignored; an empty or whitespace-only term MUST mean no filter. The
term MUST be kept in the URL so it survives a reload. Changing the search term
MUST return the list to page 1. The characters `%` and `_` MUST be matched
literally, and hostile input MUST NOT be able to change the query or cause an
error. Results, the total count and the page count MUST always be within the
viewer scope. When a search has no results, the empty state MUST offer a way to
clear the search.

#### Scenario: Matching rules (table-driven)

Given in-scope users named `Mariana Lopez` (login `mlopez`), `ANA Perez` (login
`aperez`) and `Juan Diaz` (login `jdiaz`):

| Term | Result |
|---|---|
| `ana` | `Mariana Lopez`, `ANA Perez` (case-insensitive, partial) |
| `LOPEZ` | `Mariana Lopez` |
| `jdiaz` | `Juan Diaz` (matches login) |
| `  ana  ` | same as `ana` (whitespace ignored) |
| empty | all in-scope users |
| whitespace only | all in-scope users |
| `zzz` | no results |

- GIVEN the users above
- WHEN the viewer searches for the term from the row
- THEN the results are as in the row

#### Scenario: Wildcard characters are literal (table-driven)

Given in-scope users `Ana 100%` and `Ana Perez`, and login `ana_1` alongside
`anaX1`:

| Term | Result |
|---|---|
| `%` | only `Ana 100%` |
| `_` | only users whose name or login contains an underscore, such as `ana_1` |
| `a%z` | no results unless a name literally contains `a%z` |

- GIVEN the users above
- WHEN the viewer searches for the term from the row
- THEN `%` and `_` behave as ordinary characters and match no other rows

#### Scenario: Hostile input

- GIVEN any viewer
- WHEN they search for `'; DROP TABLE "Usuario"; --` or `\` or a very long term
- THEN the request completes without an error page
- AND no data is altered and only rows literally containing the text, possibly
  none, are returned

#### Scenario: Search never leaves the viewer scope

- GIVEN stored users including an `administrador` named `Admin Root`
- WHEN a `secretaria` searches for `admin`, and separately `root`
- THEN `Admin Root` is not in the results and the total count excludes it
- AND an `administrador` searching for `admin` does see `Admin Root`

#### Scenario: New search returns to page 1

- GIVEN a viewer on page 3 of the unfiltered list
- WHEN they submit a search term
- THEN the URL holds the term and page 1, and page 1 of the filtered results is
  shown

#### Scenario: Term survives a reload

- GIVEN a viewer who searched for `ana`
- WHEN they reload the URL
- THEN the field shows `ana` and the filtered results are shown

#### Scenario: Out-of-range page after filtering

- GIVEN a term with 12 results (2 pages) and a URL asking for `page=5`
- WHEN the list is requested
- THEN page 2 is shown

#### Scenario: No results offers a way to clear

- GIVEN a search term that matches nothing
- WHEN the list renders
- THEN a no-results message that includes the term is shown
- AND a control to clear the search is offered, and activating it shows the
  unfiltered in-scope list from page 1

### Requirement: Fail-soft when the database is unavailable

If the data cannot be read, the list MUST show the existing degraded notice
instead of crashing or rendering an error page. It MUST NOT present a
misleading empty-results message or a count as if the read had succeeded. The
notice MUST also appear when the URL carries any combination of `page`, `q`,
`status`, `sort`, `dir` and `size`.
(Previously: only `page` and `q` were considered.)

#### Scenario: Database unavailable

- GIVEN the database read fails
- WHEN a viewer requests the list
- THEN the page renders with the degraded notice
- AND no unhandled error occurs

#### Scenario: Degraded state with a search or page

- GIVEN the database read fails and the URL carries a page and a search term
- WHEN the list renders
- THEN the degraded notice is shown and the page does not crash

#### Scenario: Degraded state with sort, filter and page size

- GIVEN the database read fails and the URL carries
  `status=inactive&sort=name&dir=desc&size=25&page=2`
- WHEN the list renders
- THEN the degraded notice is shown, with no table, no count and no no-results
  message, and the page does not crash

### Requirement: Accessibility

The search input MUST have a visible label (a placeholder alone is not a label).
The search region and the pagination MUST be landmarks, each with an accessible
label. The current page MUST be marked as current for assistive technology.
Search and pagination controls MUST be at least 44x44px on touch and MUST be
operable by keyboard with a visible focus indicator (design system section 7).
The result count MUST be announced politely to assistive technology when it
changes.

#### Scenario: Labels and landmarks

- GIVEN the rendered list
- WHEN its structure is inspected
- THEN the search input has a visible label
- AND the search region and the pagination are landmarks with accessible labels

#### Scenario: Current page marked

- GIVEN a viewer on page 2 of 3
- WHEN the pagination renders
- THEN page 2 is marked as the current page and no other page is

#### Scenario: Keyboard and touch

- GIVEN a keyboard-only user, and separately a touch viewport
- WHEN they operate the search field, submit, clear, previous and next
- THEN every control is reachable and operable by keyboard with visible focus
- AND every control's touch target is at least 44x44px

#### Scenario: Result count announced

- GIVEN a viewer who changes the search term or page
- WHEN new results load
- THEN the updated result count is exposed in a polite live region and focus is
  not moved by the announcement

### Requirement: Localised copy

All user-facing text of the list, search and pagination (labels, placeholders,
empty and no-results messages, control labels, page and count text) MUST come
from the i18n catalogs and exist in both `es` and `en`. Counts and page numbers
MUST be interpolated, not concatenated.

#### Scenario: Copy in both locales (table-driven)

- GIVEN the `es` locale, and separately the `en` locale
- WHEN the list renders with results, with no results, and degraded
- THEN every visible string appears in that language

#### Scenario: Catalogs stay in sync

- GIVEN the `es` and `en` catalogs
- WHEN the users-list keys are compared
- THEN both define the same keys with non-empty values

### Requirement: Single source of truth for the viewer scope

Which roles a viewer may see MUST be defined once, in the role-permission policy
next to the assignment hierarchy. The list query and the page MUST reuse that
definition. No other file MAY restate which roles each viewer sees.

#### Scenario: Policy matches the table

- GIVEN the policy structure
- WHEN the visible roles are evaluated for each of the five roles
- THEN they equal the table in Purpose (`docente` and `estudiante` see none)

#### Scenario: Viewing right matches module access

- GIVEN each of the five roles
- WHEN "may open the list" and "sees at least one role" are evaluated
- THEN both give the same answer for every role

#### Scenario: Unknown or missing viewer role

- GIVEN an undefined or unrecognized viewer role
- WHEN the visible roles are evaluated
- THEN the result is empty and no rows are returned

### Requirement: Column sorting

The users list MUST be sortable by the columns name, login, role, status and
created date, and by no other. Sorting MUST be single-column and MUST be
expressed as the parameters `sort` (column key) and `dir` (`asc` or `desc`) in
the URL. With no valid `sort` the order MUST remain newest first by creation
date, with the user `Id` as tie-break. Every sorted order MUST end with the user
`Id` as final tie-break so no row is skipped or repeated across pages; rows
tied on the chosen column MUST appear in the default order (newest first), then
by `Id`. Sorting MUST be applied inside the same scoped query, so the rows,
total and page count are those of the viewer's scope. Name and login sort with
Spanish-aware collation (accented letters sort with their base letter, case does
not decide); the role column sorts by the displayed role code under the database
default; `status` ascending means active first. The column keys are `name`,
`login`, `role`, `status` and `created`; the default sort is `created` in
descending direction. Header behaviour and accessibility follow `data-table`
(DT-URL-1, DT-SORT-1, DT-SORT-2).

#### Scenario: Sort by column and direction (table-driven)

| URL | Order of results |
|---|---|
| no `sort` | created date descending, then `Id` |
| `sort=name` | name ascending |
| `sort=name&dir=desc` | name descending |
| `sort=login&dir=asc` | login ascending |
| `sort=role` | role code ascending |
| `sort=status` | active first, then inactive |
| `sort=status&dir=desc` | inactive first, then active |
| `sort=created` | created date ascending (valid `sort`, no `dir`) |
| `sort=created&dir=desc` | created date descending, then `Id` |
| `sort=created&dir=asc` | created date ascending |

- GIVEN in-scope users with distinct values in each column
- WHEN the list is requested with the URL from the row
- THEN the rows are in the order from the row

#### Scenario: Stable across pages with equal values

- GIVEN 25 in-scope users of which 12 share the same role and the same
  creation timestamp
- WHEN pages 1, 2 and 3 are read in turn for `sort=role`, `sort=status` and
  the default order, ascending and descending
- THEN every user appears exactly once across the three pages
- AND repeating the request returns the same rows in the same order

#### Scenario: Accented names sort alphabetically

- GIVEN in-scope users named "Zoe", "Álvaro", "angel" and "Beatriz"
- WHEN the list is requested with `sort=name`
- THEN the order is "Álvaro", "angel", "Beatriz", "Zoe"

#### Scenario: Ties on the chosen column keep the default order

- GIVEN several in-scope users with the same role and different creation dates
- WHEN the list is requested with `sort=role`
- THEN users with the same role appear newest first, and equal timestamps by `Id`

#### Scenario: Unknown sort falls back

| URL | Effective order |
|---|---|
| `sort=password` | default (created descending, then `Id`) |
| `sort=Name` | default |
| `sort=name&dir=sideways` | name ascending |
| `sort=name&sort=login` | default |
| `sort=name&dir=desc&dir=asc` | name ascending |

- GIVEN in-scope users
- WHEN the list is requested with the URL from the row
- THEN the order is the one in the row
- AND no error occurs

#### Scenario: Sorting does not change the scope

- GIVEN a `secretaria`
- WHEN they sort by any column, ascending or descending
- THEN only `docente` users are returned and the total equals the number of
  stored `docente` users

### Requirement: Status filter

The users list MUST provide a status filter with the values `active`,
`inactive` and `all`, held in the `status` parameter. The default MUST be `all`
(D10), so the unfiltered view is the same as before this change. An unknown,
malformed or repeated `status` MUST fall back to `all`. The filter MUST be
applied inside the scoped query together with the search term; the total, the
page count and the rows MUST reflect the filter. Changing the filter MUST return
to page 1. Each row MUST show its status as text, as before.

#### Scenario: Filter values (table-driven)

| `status` | Rows shown (within scope) |
|---|---|
| absent | active and inactive |
| `all` | active and inactive |
| `active` | active only |
| `inactive` | inactive only |
| `bogus`, `ACTIVE`, empty, repeated | active and inactive |

- GIVEN in-scope active and inactive users
- WHEN the list is requested with the value from the row
- THEN the rows are as shown and no error occurs

#### Scenario: Filter combines with search and scope

- GIVEN a `secretaria`, inactive `docente` users and an inactive `administrador`
- WHEN they filter `status=inactive` and search for a term that matches both
- THEN only the inactive `docente` users are returned and the count excludes the
  `administrador`

#### Scenario: Filter with no results

- GIVEN `status=inactive` and no inactive in-scope user
- WHEN the list renders
- THEN the no-results state is shown with a control that clears the filter and
  returns the unfiltered list from page 1

### Requirement: List parameters never widen the viewer scope

The parameters `q`, `status`, `sort`, `dir`, `size` and `page` MUST be
parsed on the server against closed sets of values and MUST NOT affect which
roles a viewer may see. Any other parameter MUST have no effect. The scope MUST
still derive only from the authenticated session.

#### Scenario: Hostile and extra parameters

- GIVEN a `secretaria`
- WHEN they request the list with `sort='; DROP TABLE "Usuario"; --`,
  `status=all&role=administrador`, `size=9999`, `scope=all`, in any
  combination
- THEN the response is identical to the one with the same valid parameters and
  without the extra ones
- AND only `docente` users are returned and no data is altered

#### Scenario: Denied roles stay denied

- GIVEN a `docente` or `estudiante` requesting the list with any of the new
  parameters
- WHEN the request is made
- THEN no rows are read and they are redirected to the permission-denied screen

### Requirement: Changing the view returns to page 1

Submitting a search, changing the status filter, changing the sort column or
direction, and changing the page size MUST each return the users list to page
1, keeping the other parameters (`data-table` DT-URL-2).

#### Scenario: Reset on each change

- GIVEN a viewer on page 3 with `q`, `status`, `sort` and `size` set
- WHEN they submit a new term, change the status, change the sort or change the
  page size
- THEN the URL shows page 1 with the other parameters kept, and page 1 of the new
  view is shown

### Requirement: The browser receives only displayed fields

The rows the users list hands to the browser MUST contain exactly the fields the
table displays (name, login, role, status and the creation date as already
formatted text) plus the user `Id`. They MUST NOT contain the password hash
(`hashClave`), the identity number (`cif`), the phone (`telefono`) or the e-mail
(`correo`), even though the search still matches on e-mail. This MUST hold at
two points: the list read MUST NOT select those fields, and the page MUST pick
the delivered fields explicitly instead of passing the read result through. The
rest of the system, including other consumers of the full user record such as
login and the profile, is unchanged. This requirement cites no RNF: RNF-01 as
worded in `docs/requirements.md` covers denying unauthorized pages and actions,
not the contents of an authorized viewer's rows.

#### Scenario: Delivered rows are picked (table-driven by forbidden field)

| Forbidden in the delivered rows |
|---|
| `hashClave` |
| `cif` |
| `telefono` |
| `correo` |

- GIVEN stored users with all four fields filled, and an `administrador` loading
  the list
- WHEN the props passed to the client table are serialized
- THEN none of the fields in the row appears anywhere in them
- AND each row has exactly name, login, role, status, a creation date label and
  the `Id`

#### Scenario: Same guarantee for every viewer

- GIVEN a `secretaria` and a `coordinacion`
- WHEN each loads the list, with and without a search term that matches on
  e-mail
- THEN the delivered rows have only the displayed fields and the `Id`

#### Scenario: The list read does not select private fields

- GIVEN the query built for the users list
- WHEN its selected columns are inspected
- THEN `hashClave`, `cif`, `telefono` and `correo` are not among them

#### Scenario: Search by e-mail still works

- GIVEN a user whose e-mail contains "ana" and whose name and login do not
- WHEN a viewer in scope searches for "ana"
- THEN that user is listed and no e-mail is delivered in the row

## Assumptions and open questions

- Default page size is 10 and the selectable set is 10, 25 and 50 (D11).
- Assumption (confirm): search also matches email, in addition to the required
  name and login. Email may be empty for some users; those simply do not match on
  it.
- Assumption (confirm): an out-of-range page is clamped to the last page (not an
  error and not the first page).
- Assumption: a non-integer page value such as `2.5` is treated as invalid and
  shows page 1.
- Assumption: the default order stays newest first by creation date with `Id` as
  tie-break (the direction of the tie-break is not observable beyond stability).
- Assumption: the role column still shows the role code (capitalised as today),
  not the catalog `Nombre`.
- Export, a role filter and other per-column filters are out of scope. Sorting and the status filter are in scope (see Column sorting and Status filter).
- Assumption: with zero results the pagination controls MAY be hidden; the empty
  or no-results state is what is required.
- Resolved (D5): search is submit-on-Enter, not debounced. The observable rules
  (term in URL, page reset, survives reload) hold either way.
- Open (design): a maximum accepted length for the search term. Hostile or very
  long input MUST NOT error; whether it is truncated or capped is undecided.
- Resolved: the list uses a TanStack-based table in manual mode; not observable here.
- Assumption: the "new user" button and page header are unchanged and specified
  in `staff-account-creation`.
