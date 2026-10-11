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
the URL shows the same page. The default page size is 10 (assumption, see
below). The controls MUST show the current page, the total number of pages and
the total count of results, and previous and next MUST be disabled at the first
and last page respectively. The order MUST be deterministic and stable across
pages, using the user `Id` as a tie-break, so that no row is skipped or repeated
when several users share a creation date.

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
- THEN on page 1 previous is disabled and next is enabled
- AND on page 3 next is disabled and previous is enabled
- AND the controls show the current page, 3 total pages and 25 total results

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

- GIVEN a viewer whose results fit in one page, and separately zero results
- WHEN the list renders
- THEN both previous and next are disabled (single page), or the empty state is
  shown without error (zero results)

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
misleading empty-results message or a count as if the read had succeeded.

#### Scenario: Database unavailable

- GIVEN the database read fails
- WHEN a viewer requests the list
- THEN the page renders with the degraded notice
- AND no unhandled error occurs

#### Scenario: Degraded state with a search or page

- GIVEN the database read fails and the URL carries a page and a search term
- WHEN the list renders
- THEN the degraded notice is shown and the page does not crash

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

## Assumptions and open questions

- Assumption (confirm): default page size is 10.
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
- Assumption: no sorting, per-column filters or export is provided (out of scope).
- Assumption: with zero results the pagination controls MAY be hidden; the empty
  or no-results state is what is required.
- Open (design): submit-on-Enter versus debounced search. The observable rules
  (term in URL, page reset, survives reload) hold either way.
- Open (design): a maximum accepted length for the search term. Hostile or very
  long input MUST NOT error; whether it is truncated or capped is undecided.
- Open (design): whether a table library is adopted; not observable here.
- Assumption: the "new user" button and page header are unchanged and specified
  in `staff-account-creation`.
