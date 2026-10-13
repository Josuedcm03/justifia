# Delta for Catalog Management

> Change: `backoffice-ui-refresh`. Only CM-LST-1 is modified. CM-ASG-7,
> CM-NAV-1 and CM-UX-1 are NOT modified (the Grupos section keeps its order and
> cap; the sidebar entries and active rules are unchanged; confirmation steps are
> unchanged). Shared table behaviour is owned by `data-table`.
> Traceability: RNF-01 (a), "authorization is verified on the server"
> (regression guard: new parameters never widen the Carrera scope). RNF-10 is
> motivation only. Search stays submit-on-Enter (D5); no no-JS fallback (D6).

## MODIFIED Requirements

### Requirement: CM-LST-1 Lists, filters, search and pagination

`/catalog/asignaturas` and `/catalog/docentes` MUST be paged server-side lists.
There is no standalone list of Grupos: groups are listed only in the Grupos
section of their Asignatura (CM-ASG-7). The filter is the `status` query
parameter with the values `active`, `inactive` and `all`; its default MUST be
`active`, and an unrecognised `status`, page, sort, direction or page-size value
MUST fall back to the default or the nearest valid page rather than failing.
Each row MUST show its state as a word ("Active"/"Inactive" in the user's
language), not by colour alone. Search `q` (case-insensitive, partial) MUST
cover:

| List | Search fields |
|---|---|
| Asignaturas | `Codigo`, `Nombre`, and, through the Asignatura's groups, `Periodo` and docente name (CM-ASG-9) |
| Docentes | name, `Correo` |

Sorting MUST be single-column, held in the `sort` (column key) and `dir`
(`asc` or `desc`) parameters, and MUST be offered only on these columns:

| List | Sortable columns |
|---|---|
| Asignaturas | code, name, hours, status |
| Docentes | name, login, email, status |

The Asignaturas "Groups" column (CM-ASG-8) and every action column MUST NOT be
sortable. With no valid `sort` each list MUST keep its existing default order.
Every sorted order MUST end with the record `id` as final tie-break, so no row is
skipped or repeated across pages. Sorting MUST be applied inside the same scoped
query and MUST NOT change the scope, the search results, the total or the page
count. The sort keys are `code`, `name`, `hours`, `status` (Asignaturas) and
`name`, `login`, `email`, `status` (Docentes); the default is `code` ascending
for Asignaturas and `name` ascending for Docentes, and a valid `sort` without a
valid `dir` is ascending. Rows tied on the chosen column MUST appear in the
list's default order, then by `id`. Names and logins sort with Spanish-aware
collation (accented letters sort with their base letter, case does not decide);
codes sort by the database default; Docentes without a `Correo` (absent or
empty) MUST come last in both directions; `status` ascending means active
first. Because the Docentes default order is by name, accented or
lowercase-initial names may sit in a different place than before this change
(owner confirmation pending, design Open Question 2).

Page size MUST be selectable among 10, 25 and 50 (`size` parameter), with
the same default (10) and the same options as in `/users`; any other value falls
back to 10. The pagination controls MUST offer first, previous, next and last,
with the current page, the total pages and the total count. Changing the search,
the status filter, the sort or the page size MUST return to page 1. The Docentes
list MUST show active and inactive users with role `docente` (default active)
and is not carrera-scoped; it is read-only and MUST link to `/users` for account
management; it MUST NOT expose any credential field (`HashClave`, a password or
a temporary password), nor `Cif`, including in the data delivered to the browser.
(Previously: no sorting existed; page size was "the same as in `/users`" with
only previous and next; the fallback covered `status` and page only.)

#### Scenario: Default shows active only

- GIVEN active and inactive asignaturas
- WHEN `/catalog/asignaturas` is opened without a filter
- THEN only active ones are listed

#### Scenario: Filter (table-driven)

| Filter | Rows shown |
|---|---|
| active | active only |
| inactive | inactive only |
| all | both, each labelled with its state in words |

- GIVEN a mix of rows
- WHEN the filter from the row is chosen
- THEN the rows are as shown

#### Scenario: Search

- GIVEN asignaturas "MAT101 Calculus" and "FIS200 Physics"
- WHEN `q` is "calc"
- THEN only the first is listed
- AND the same behaviour holds, per the table, for docentes; the extra fields of
  the Asignaturas list are specified in CM-ASG-9

#### Scenario: Pagination clamps

- GIVEN 25 rows and a page size of 10
- WHEN page 99, page 0 or page "x" is requested
- THEN the last page, the first page and the first page are shown respectively

#### Scenario: Empty states

- GIVEN no row matches the filter and search
- WHEN the list renders
- THEN a "no results" empty state with a way to clear the filter is shown

#### Scenario: Docentes list is read-only and unscoped

- GIVEN a `coordinacion` actor of Carrera X
- WHEN they open `/catalog/docentes`
- THEN docentes are listed regardless of Carrera, there is no create, edit or
  deactivate control, and a link to `/users` is present

#### Scenario: Unrecognised status falls back

- GIVEN `status=bogus` on either list
- WHEN the page is opened
- THEN it behaves as `status=active`

#### Scenario: Docentes list carries no credential

- GIVEN the Docentes list rendered and its data serialized, including the data
  delivered to the browser
- WHEN searched for `HashClave`, a password, a temporary password or `Cif`
- THEN none is present

#### Scenario: Database unavailable

- GIVEN the database cannot be reached
- WHEN either list is opened by an allowed role
- THEN the page renders the degraded notice, a status message that the data
  could not be loaded, as `/users` does, and no raw error is shown
- AND (Previously: "with an empty table and a status message") no table rows, no
  count and no "no results" message are shown

#### Scenario: Sortable columns (table-driven)

| List | `sort` value | Order |
|---|---|---|
| Asignaturas | `code`, `name`, `hours`, `status` | by that column, ascending |
| Asignaturas | `code` with `dir=desc` | code descending |
| Docentes | `name`, `login`, `email`, `status` | by that column, ascending |
| Docentes | `email` with `dir=desc` | email descending |

- GIVEN rows with distinct values in each column
- WHEN the list is requested with the parameters from the row
- THEN the rows are in the order from the row, and the rows, total and page count
  are those of the unsorted view

#### Scenario: Unsortable and unknown sort values fall back (table-driven)

| `sort` value |
|---|
| `groups` (Asignaturas Groups column) |
| `actions`, `hashClave`, `cif`, `password` |
| `Name`, `NAME`, `name;`, empty |
| `hours` on Docentes, `email` on Asignaturas |
| repeated (`sort=code&sort=name`) |

- GIVEN either list with several pages
- WHEN it is requested with the value from the row
- THEN the list's default order is used and no error occurs
- AND `dir` with a value other than `asc` or `desc` is treated as `asc` when
  `sort` is valid

#### Scenario: Collation, empty emails and status order

- GIVEN docentes "Zoe", "Álvaro", "angel", two with no `Correo`, and a mix of
  active and inactive asignaturas
- WHEN docentes are sorted by `name`, then by `email` in both directions, and
  asignaturas by `status` ascending and descending
- THEN names read "Álvaro", "angel", "Zoe"; docentes without `Correo` are last in
  both email directions; and `status` ascending lists active first, descending
  inactive first

#### Scenario: Footer omitted when everything fits

- GIVEN a view of 10 rows or fewer
- WHEN either list renders
- THEN no pagination footer or page-size selector is shown (`data-table`
  DT-PAG-1)

#### Scenario: Stable across pages with equal sort keys

- GIVEN 25 asignaturas of which 12 share the same hours and the same status, and
  likewise 25 docentes sharing the same status or the same empty email
- WHEN all pages are read for each sortable column, ascending and descending
- THEN every row appears exactly once across the pages
- AND repeating the request returns the same rows in the same order

#### Scenario: Page size options (table-driven)

| `size` value in URL | Rows per page |
|---|---|
| absent | 10 |
| `10`, `25`, `50` | that many |
| `5`, `100`, `1000`, `0`, `-5`, `abc`, `10.5`, `010`, empty, repeated | 10 |

- GIVEN 60 rows in either list
- WHEN it is requested with the value from the row
- THEN each page holds the number of rows in the row, and no error occurs

#### Scenario: First and last navigation and clamping with a size

- GIVEN 25 rows and page size 10 on page 2
- WHEN the user activates last, then first, and separately `page=3&size=25`
  is requested
- THEN page 3 then page 1 are shown, and the second request shows page 1

#### Scenario: Reset to page 1 on any view change

- GIVEN a user on page 3 with a search term, status, sort and page size set
- WHEN they submit a new term, change the status, change the sort or change the
  page size
- THEN page 1 of the new view is shown and the other parameters are kept

#### Scenario: Sort and page size never widen the Carrera scope (RNF-01 a)

- GIVEN a `coordinacion` actor of Carrera X and asignaturas in Carreras X and Y
- WHEN they request `/catalog/asignaturas` with any valid or hostile `sort`,
  `dir`, `status`, `size` and with extra parameters such as `carrera=Y` or
  `scope=all`
- THEN only Carrera X asignaturas are listed and the total reflects only them
- AND the response equals the one without the extra parameters

#### Scenario: Degraded read keeps the notice with the new parameters

- GIVEN the database cannot be reached and the URL carries
  `sort=name&dir=desc&size=25&page=2`
- WHEN either list is opened by an allowed role
- THEN the degraded notice is shown and the page does not crash
