# Delta for Catalog Management

Change `docente-maintenance`. Requirements covered: RF-12 (a), (b); RNF-01 (a),
(b), (c). The behavior of editing, deactivating and reactivating a docente lives
in the new capability `docente-maintenance`; this delta only changes what this
spec pins as read-only. CM-NAV-1, CM-UX-1, CM-I18N-1, CM-NFR-1 to CM-NFR-4 and
CM-AUD-1 are not edited: the new capability restates, for docentes, the
confirmation, copy, serialisation, busy outcome and audit rules (DM-7, DM-10,
DM-14, DM-16, DM-18), and CM-NAV-1 already marks Docentes active on every path
below `/catalog/docentes` by prefix. No scenario of this delta needs PostgreSQL.

## Notes for archive

These edits are outside the requirement blocks below; apply them to the main spec
at archive time.

1. **Purpose** (lines 11-16). Replace the sentence "The module also shows a
   read-only list of docentes that links to the users module." with: "The module
   also shows a list of docentes that links to the users module; it is read-only
   for `administrador` and `coordinacion`, and the `secretaria` edits, deactivates
   and reactivates docentes from it (`docente-maintenance`). Creating a docente
   stays in the users module and the import."
2. **A-GRP-4.** Replace with: "Reactivating a Grupo whose Asignatura or docente is
   inactive is refused (not auto-fixed). Because editing an inactive Grupo is also
   refused, a Grupo whose docente is inactive returns only after the `secretaria`
   reactivates the docente from the Docentes module (`docente-maintenance`), then
   reactivates the Grupo; a re-import no longer reactivates the docente (D3). The
   owner may prefer to allow changing the docente during reactivation.
   *Assumption.*" (Previously: the docente reactivation was assumed to live in a
   users module that does not exist.)
3. **A-DOC-FIELDS.** Replace with: "The Docentes list shows name, `Correo`, state
   and a link to `/users`; for `secretaria` only it also has an actions column
   with an edit link. No `login` (FE-24), no `Cif`, no phone (the phone is shown
   only on the docente edit page), no credential field. *Assumption (data
   minimisation).*"
4. **A-C12.** Replace with: "Closed by `docente-maintenance` D3: the import refuses
   a Grupos row that names an inactive docente (`docente.inactive`) and never
   reactivates a docente. An active Grupo that already names an inactive docente
   (created before this change) is not repaired automatically."
5. **Vocabulary.** Add: "**Docente maintainer**: `secretaria`. Docentes have no
   Carrera or Facultad, so the scoped/unscoped distinction does not apply to them."

## MODIFIED Requirements

### Requirement: CM-ACC-1 Role matrix for every operation

The module MUST be available to the staff roles only. Operations are list, view,
create, edit, deactivate and reactivate on `Asignatura` and on `Grupo`, list on
Docentes, and edit, deactivate and reactivate on a docente (`docente-maintenance`).
The right MUST be a predicate derived from the existing role hierarchy in
`permissions.ts` (the roles for which account creation is available), not a
second hand-written role list. The right to edit, deactivate and reactivate a
docente MUST be its own predicate, derived from the roles that may assign the role
`docente` (`canAssignRole(rol, "docente")`), which admits `secretaria` only.
Authorization MUST be enforced on the server for every entry point, independently
of what the sidebar shows.
(Previously: the only Docentes operation was "list" and there was one predicate.)

#### Scenario: Role matrix (table-driven)

| Role | Asignatura / Grupo (all six operations) | Docentes list | Docente edit, deactivate, reactivate |
|---|---|---|---|
| `administrador` | allowed, all records | allowed | denied |
| `coordinacion` | allowed, only within own `Carrera` (CM-SCOPE) | allowed | denied |
| `secretaria` | allowed, all records | allowed | allowed, every docente |
| `docente` | denied | denied | denied |
| `estudiante` | denied | denied | denied |
| anonymous | denied (to `/login`) | denied (to `/login`) | denied (to `/login`) |

- GIVEN a caller with the role from the row
- WHEN they invoke an operation through its page or its server action,
  including a hand-crafted request
- THEN the outcome is the one in the row, and a denied caller causes no read
  of module data and no write

#### Scenario: Denial destinations

- GIVEN a `docente`, an `estudiante` and an unauthenticated caller
- WHEN each requests `/catalog/asignaturas`
- THEN the first two are redirected to `/denied` and the third to `/login`

#### Scenario: Forced password change comes first

- GIVEN a staff user whose account requires a password change
- WHEN they request any module page or action
- THEN they are sent to the forced password change and nothing is read or written

#### Scenario: Coordinacion can list docentes but not maintain them

- GIVEN a `coordinacion` actor
- WHEN they request `/catalog/docentes` and then `/catalog/docentes/7/edit`
- THEN the list is shown and the edit page redirects to `/denied`, with no docente
  data read for the second request

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
| Docentes | name, email, status |

The Asignaturas "Groups" column (CM-ASG-8) and every action column MUST NOT be
sortable. With no valid `sort` each list MUST keep its existing default order.
Every sorted order MUST end with the record `id` as final tie-break, so no row is
skipped or repeated across pages. Sorting MUST be applied inside the same scoped
query and MUST NOT change the scope, the search results, the total or the page
count. The sort keys are `code`, `name`, `hours`, `status` (Asignaturas) and
`name`, `email`, `status` (Docentes); the Docentes list also still accepts
`login` as a `sort` value, which orders by the stored login, although no column
offers it because the list does not show the login (FE-24). The default is
`code` ascending for Asignaturas and `name` ascending for Docentes, and a valid
`sort` without a valid `dir` is ascending. Rows tied on the chosen column MUST
appear in the list's default order, then by `id`. Names and logins sort with
Spanish-aware collation (accented letters sort with their base letter, case does
not decide); codes sort by the database default; Docentes without a `Correo` (absent or
empty) MUST come last in both directions; `status` ascending means active
first. Because the Docentes default order is by name, accented or
lowercase-initial names may sit in a different place than before this change
(owner confirmation pending, design Open Question 2).

Page size MUST be selectable among 10, 25 and 50 (`size` parameter), with
the same default (10) and the same options as in `/users`; any other value falls
back to 10. The pagination controls MUST offer first, previous, next and last,
with the page status (the current page of the total pages); the total count is
shown once, in the toolbar, and not repeated in the footer (`data-table`
DT-PAG-1, DT-TOOL-1). Changing the search,
the status filter, the sort or the page size MUST return to page 1. The Docentes
list MUST show active and inactive users with role `docente` (default active)
and is not carrera-scoped; it MUST link to `/users` for account management, for
every role that may open it; it MUST NOT expose any credential field (`HashClave`,
a password or a temporary password), nor `Cif`, nor the login (`Login`), nor the
phone, including in the data delivered to the browser. The Docentes list MUST show
exactly three data columns: name, `Correo` and state; it MUST NOT show the login,
because nobody types a "Usuario" to sign in (FE-24). For `secretaria` only, the
list MUST also show a fourth and last column, "Actions", that is not sortable and
holds, in every row (active or inactive), a link to that docente's edit page
`/catalog/docentes/{id}/edit` (`docente-maintenance`). Every other role MUST see
exactly the three data columns and no control that edits, deactivates or
reactivates; the list MUST NOT offer a create control for docentes (creating one
stays in `/users/new` and the import).
(Previously: no sorting existed; page size was "the same as in `/users`" with
only previous and next; the fallback covered `status` and page only. Docentes
also showed a login column, sortable, and the login was delivered to the
browser. Latest edit: the Docentes list was read-only for every role and showed
exactly three columns with no actions column; now the actions column exists for
`secretaria` only, and the phone is named among the data that is never delivered.)

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

#### Scenario: Docentes list is read-only and unscoped for the other roles

- GIVEN a `coordinacion` actor of Carrera X, and separately an `administrador`
- WHEN they open `/catalog/docentes`
- THEN docentes are listed regardless of Carrera, there is no create, edit,
  deactivate or reactivate control and no actions column, and a link to `/users`
  is present
- AND (Previously: the same scenario was titled "Docentes list is read-only and
  unscoped" and named only the `coordinacion` actor)

#### Scenario: Secretaria sees the actions column

- GIVEN a `secretaria`, an active docente with id 7 and an inactive docente with
  id 9
- WHEN she opens `/catalog/docentes` with the filter `all`
- THEN each row has, in a last "Actions" column, a link to
  `/catalog/docentes/7/edit` and `/catalog/docentes/9/edit` respectively
- AND there is no create control and the link to `/users` is present

#### Scenario: Unrecognised status falls back

- GIVEN `status=bogus` on either list
- WHEN the page is opened
- THEN it behaves as `status=active`

#### Scenario: Docentes list carries no credential

- GIVEN the Docentes list rendered for each staff role and its data serialized,
  including the data delivered to the browser
- WHEN searched for `HashClave`, a password, a temporary password, `Cif`, the
  login or the phone
- THEN none is present
- AND (Previously: the phone was not in the list of searched values)

#### Scenario: Docentes list shows no login

- GIVEN docentes whose stored `Login` is "aperez" and whose `Correo` is
  "ana@uni.edu"
- WHEN `/catalog/docentes` is opened by `administrador` or `coordinacion`
- THEN the columns are name, email and status, all sortable, with no login
  column and no action column
- AND "aperez" appears neither in the rows nor in the data delivered to the
  browser, while "ana@uni.edu" does
- AND when it is opened by `secretaria` the columns are the same three, sortable,
  plus the last non-sortable "Actions" column, and still no login column
- AND (Previously: "by an allowed role" and "no action column" for all roles)

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
| Docentes | `name`, `email`, `status` | by that column, ascending |
| Docentes | `login` (accepted in the URL; no column offers it) | by the stored login, ascending |
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
