# Catalog Management Specification (delta)

> Delta against the archived main spec `openspec/specs/catalog-management/spec.md`
> (change `merge-grupo-into-asignatura`, UI and routing only). This file replaces
> the delta of the abandoned "fold Grupo into Asignatura" approach, which is void.
> Every MODIFIED block below carries the full new text of the requirement, as the
> archive step replaces the whole block in the main spec.

## Summary

`Grupo` stays a table and a record type. What changes is where staff reach it:
Grupos stops being a standalone catalog; groups are listed, created and edited
from inside their Asignatura; the retired `/catalog/grupos/**` URLs redirect; and
the Asignaturas search finds an Asignatura through the periodo or docente of its
groups.

| Block | Requirement IDs |
|---|---|
| ADDED | CM-GRP-9, CM-GRP-10, CM-GRP-11, CM-ASG-9, CM-RTE-1 |
| MODIFIED | CM-NAV-1, CM-LST-1, CM-ASG-7, CM-ASG-8, CM-GRP-1, CM-SCOPE-1, CM-SCOPE-2 |
| REMOVED | CM-GRP-7, CM-GRP-8 |
| Reviewed, no delta | CM-ACC-1, CM-ACC-2, CM-GRP-2, CM-GRP-3, CM-GRP-4, CM-UX-1, CM-I18N-1, CM-AUD-1 (see "Reviewed without delta") |

### Traceability to `docs/requirements.md`

| ID | Requirement (checked in `docs/requirements.md`) | Covered by |
|---|---|---|
| RF-12 | Maintain the internal catalog of subjects, groups, schedules, teachers and enrollments | CM-NAV-1, CM-LST-1, CM-ASG-7, CM-ASG-9, CM-GRP-9, CM-GRP-10, CM-GRP-11, CM-RTE-1 |
| RNF-01 | Authorization on the server for every route and action; the menu shows only role options; denial returns no data | CM-NAV-1, CM-GRP-9, CM-GRP-10, CM-RTE-1, CM-SCOPE-1, CM-SCOPE-2 |
| RNF-06 | Audit of catalog operations, one entry per operation | Unchanged; pinned by "What does not change" and CM-GRP-11 |
| RNF-12 | Confirmation before an irreversible action (deactivation shows a confirmation dialog) | CM-GRP-10 (confirmation kept on the new edit route) |
| RNF-13 | Import of the internal catalog from `.xlsx` with a documented template | Untouched; pinned by "What does not change" |

### Assumptions this delta rests on

The owner has seen but not confirmed U1 to U7 and U9 to U12 of the proposal. Each
requirement below that depends on one names it in an "Assumptions" line, so a
change of mind can be traced. B1 to B7 are binding owner decisions. U1 and U3 are
implementation-level and appear in no requirement.

| Assumption | Used by |
|---|---|
| U2 `Periodo` stays a visible form field | CM-GRP-9, CM-GRP-1 |
| U4 redirects are temporary | CM-RTE-1 |
| U5 Asignatura fixed from the route and shown read-only in create mode | CM-GRP-9 |
| U6 after saving, the user returns to the Asignatura edit page | CM-GRP-11 |
| U7 dropped with the list: group status filter, pagination past 100, "New group" with no Asignatura | CM-ASG-7, CM-RTE-1, CM-GRP-9 |
| U9 groups of any status can produce a search match | CM-ASG-9 |
| U10 up to three matching groups plus "+N more" | CM-ASG-9 |
| U11 not found for an unusable parent on the new-group URL and for a parent mismatch on the edit URL | CM-GRP-9, CM-GRP-10 |
| U12 `/catalog/grupos/new` without a valid Asignatura goes to the Asignaturas list | CM-RTE-1 |

## ADDED Requirements

### Requirement: CM-GRP-9 Create a Grupo under its Asignatura

Assumptions: U2, U5, U7, U11.

A `Grupo` MUST be created from `/catalog/asignaturas/{id}/grupos/new`, where
`{id}` is the Asignatura that will own the group. The page MUST apply the access
rules of CM-ACC-1, the scope rules of CM-SCOPE-1 and the no-Carrera state of
CM-SCOPE-2 before reading any module data. The Asignatura MUST be fixed by the
route: the form MUST show its `Codigo` and `Nombre` as read-only text, MUST NOT
offer a selector of Asignaturas, and MUST submit it with the other fields. The
form MUST keep `Periodo`, `NumeroGrupo`, `Docente` and the meeting days as
editable fields (CM-GRP-1, CM-GRP-6). The page MUST answer "not found", with the
same outcome as for an id that does not exist, when `{id}` is malformed, names no
Asignatura, names an Asignatura outside the actor's scope, or names an inactive
Asignatura. The create action MUST keep validating the submitted Asignatura on
the server as specified in CM-GRP-1 and CM-SCOPE-1, so a hand-crafted value is
refused regardless of the route. The breadcrumb MUST lead from the Asignaturas
list through the Asignatura to the page. Reading the route MUST cause no write,
audit row or schema change. There is no entry point to create a group without
first choosing an Asignatura (U7).

#### Scenario: The Asignatura is fixed by the route

- GIVEN an active Asignatura A in the actor's scope
- WHEN `/catalog/asignaturas/{A}/grupos/new` is opened
- THEN the form shows the `Codigo` and `Nombre` of A as read-only text, offers
  no Asignatura selector, and shows `Periodo`, `NumeroGrupo`, `Docente` and the
  days in their usual initial state

#### Scenario: Unusable parent answers not found (table-driven)

| `{id}` in the URL |
|---|
| malformed (`abc`, `0`, `-1`, `1.5`) |
| well-formed but no such Asignatura |
| an inactive Asignatura in scope |
| an Asignatura of another Carrera (actor is `coordinacion`) |

- GIVEN a staff actor, or a `coordinacion` actor for the last row
- WHEN `/catalog/asignaturas/{id}/grupos/new` is opened with the value from the
  row
- THEN the not-found page is shown, the denied screen is not used, and nothing in
  the response distinguishes the cases of the table from one another

#### Scenario: Hand-crafted Asignatura is still validated

- GIVEN the form opened for an active in-scope Asignatura
- WHEN the submitted Asignatura is changed by hand to an inactive, unknown or
  foreign one
- THEN the create is refused as in CM-GRP-1 and CM-SCOPE-1, with no write and no
  audit row

#### Scenario: Breadcrumb names the Asignatura

- GIVEN an active Asignatura A in scope
- WHEN the new-group page of A is opened
- THEN the breadcrumb shows the Asignaturas list, then A, then the page itself,
  and the page has one `h1`

#### Scenario: Roles and scope without access (table-driven)

| Caller |
|---|
| `docente` or `estudiante` |
| anonymous |
| `coordinacion` with no Carrera |

- GIVEN the caller from the row
- WHEN `/catalog/asignaturas/{id}/grupos/new` is opened
- THEN `/denied` is used for the first row, `/login` for the second, and for the
  third the no-Carrera empty state with no form
- AND no Asignatura is read for any of the three

### Requirement: CM-GRP-10 Edit a Grupo under its Asignatura

Assumptions: U11.

An existing `Grupo` MUST be edited from
`/catalog/asignaturas/{id}/grupos/{grupoId}/edit`. The page MUST apply the access
rules of CM-ACC-1, the scope rules of CM-SCOPE-1 and the no-Carrera state of
CM-SCOPE-2 before reading any module data. The page MUST answer "not found", with
the same outcome as for an id that does not exist, when `{id}` or `{grupoId}` is
malformed, when the Grupo does not exist, when the Grupo's Asignatura is outside
the actor's scope, and, as a mandatory rule, when `{id}` is not the Asignatura
that owns the Grupo even though both exist and are in scope. A Grupo MUST never be
shown under an Asignatura that is not its parent. The page MUST NOT require the
parent Asignatura to be active: an inactive Grupo of an inactive Asignatura opens
read-only, and its reactivation is refused as specified in CM-GRP-4. The page
MUST keep the behaviour of CM-GRP-2 (natural key read-only, editable docente and
days, inactive Grupo not editable) and the deactivation and reactivation controls
of CM-GRP-3 and CM-GRP-4, including the confirmation step of CM-UX-1. The
breadcrumb MUST lead from the Asignaturas list through the parent Asignatura to
the page.

#### Scenario: Group opens under its own Asignatura

- GIVEN an in-scope Grupo G owned by Asignatura A
- WHEN `/catalog/asignaturas/{A}/grupos/{G}/edit` is opened
- THEN the edit form of G is shown, with `Asignatura`, `Periodo` and
  `NumeroGrupo` read-only

#### Scenario: Parent mismatch answers not found

- GIVEN a Grupo G owned by Asignatura A, and a different Asignatura B that exists
  and is in the actor's scope
- WHEN `/catalog/asignaturas/{B}/grupos/{G}/edit` is opened
- THEN the not-found page is shown and no data of G is rendered

#### Scenario: Every unusable address answers alike (table-driven)

| Address |
|---|
| `{id}` malformed |
| `{grupoId}` malformed |
| `{grupoId}` names no Grupo |
| Grupo exists but its Asignatura is of another Carrera (actor is `coordinacion`) |
| Grupo and Asignatura both in scope but not parent and child |

- GIVEN a staff actor, or a `coordinacion` actor for the fourth row
- WHEN the edit URL from the row is opened
- THEN the not-found page is shown, the denied screen is not used, and nothing in
  the response distinguishes the rows from one another

#### Scenario: Inactive parent does not block opening

- GIVEN an inactive Grupo whose Asignatura is inactive
- WHEN its edit URL under the correct Asignatura is opened
- THEN the Grupo is shown read-only with the reactivate action, and requesting
  reactivation is refused as in CM-GRP-4

#### Scenario: Deactivation still asks for confirmation (RNF-12)

- GIVEN an active Grupo opened on its edit route
- WHEN a staff actor chooses to deactivate it
- THEN the confirmation step of CM-UX-1 naming the Asignatura, `Periodo` and
  `NumeroGrupo` is shown first, and no change is made until it is confirmed

#### Scenario: Roles and scope without access (table-driven)

| Caller |
|---|
| `docente` or `estudiante` |
| anonymous |
| `coordinacion` with no Carrera |

- GIVEN the caller from the row
- WHEN the edit route is opened
- THEN `/denied`, `/login` and the no-Carrera empty state are used respectively
- AND no Grupo is read for any of the three

### Requirement: CM-GRP-11 Outcome of saving a Grupo

Assumptions: U6.

After a successful create or edit of a `Grupo`, the user MUST be sent to the edit
page of the Grupo's Asignatura (`/catalog/asignaturas/{asignaturaId}/edit`), where
the Grupos section (CM-ASG-7) shows the saved row. The same success MUST make the
Asignatura edit page and the Asignaturas list (`/catalog/asignaturas`) show fresh
data on their next visit, because the Grupos section and the Groups column of
CM-ASG-8 both derive from the saved group. A refused, invalid, busy, duplicate or
no-change submission MUST NOT redirect; it MUST keep the user on the form with the
existing messages. Deactivating or reactivating a Grupo MUST keep the user on the
Grupo edit page and MUST make the Grupo edit page, the Asignatura edit page and
the Asignaturas list show fresh data on their next visit. The Asignatura in the
destination MUST be the owner of the saved Grupo as read on the server. The
audit rows written by these operations are exactly those of CM-AUD-1.

#### Scenario: Create returns to the Asignatura

- GIVEN a valid create submitted from the new-group page of Asignatura A
- WHEN the action succeeds
- THEN the user is sent to `/catalog/asignaturas/{A}/edit` and the Grupos section
  there lists the new group

#### Scenario: Edit returns to the Asignatura

- GIVEN a valid change of docente submitted on the edit route of a Grupo of A
- WHEN the action succeeds
- THEN the user is sent to `/catalog/asignaturas/{A}/edit` and the section shows
  the new docente

#### Scenario: Both pages are refreshed after a write (table-driven)

| Operation | Pages revalidated |
|---|---|
| create | Asignatura edit page of A, `/catalog/asignaturas` |
| edit | Asignatura edit page of A, `/catalog/asignaturas` |
| deactivate | Grupo edit route, Asignatura edit page of A, `/catalog/asignaturas` |
| reactivate | Grupo edit route, Asignatura edit page of A, `/catalog/asignaturas` |

- GIVEN a successful operation from the row on a Grupo of A
- WHEN the action completes
- THEN each page of the row is marked for revalidation
- AND the Groups column of `/catalog/asignaturas` reflects the new active groups
  on its next visit

#### Scenario: No redirect when nothing was saved (table-driven)

| Outcome |
|---|
| validation error |
| duplicate natural key |
| edit with no change |
| busy (CM-NFR-4) |
| refused by scope or role |

- GIVEN a submission with the outcome from the row
- WHEN the action completes
- THEN the user is not redirected to the Asignatura edit page, the existing
  message is shown, and no page is revalidated as if a write had happened

#### Scenario: Toggle stays on the edit page

- GIVEN a confirmed deactivation of a Grupo of A
- WHEN the action succeeds
- THEN the user remains on the Grupo edit route, which now shows the group as
  inactive, and the audit log has one new row for it

### Requirement: CM-ASG-9 Asignaturas search also finds groups by periodo or docente

Assumptions: U9, U10 (B6 and B7 are binding).

The search `q` of `/catalog/asignaturas` (case-insensitive, partial) MUST return
an Asignatura when its `Codigo` or `Nombre` contains the term (as in CM-LST-1), or
when at least one of its `Grupo` rows has a `Periodo` or a docente name that
contains the term. `NumeroGrupo` MUST NOT be a search field (CM-ASG-8). A group
MAY produce a match whatever its own status (active or inactive). The group
condition only widens how an Asignatura is found: scope (CM-SCOPE-1), the
Asignatura `status` filter, the ordering, the page size and the fail-soft
behaviour of CM-LST-1 MUST be unchanged, and the status of a group MUST NOT
filter anything. The result MUST contain one row per Asignatura however many of
its groups match, and the total count and the pagination MUST count Asignaturas.
A group of an Asignatura outside the actor's scope MUST NOT cause that Asignatura
to be returned. When at least one group of a returned Asignatura matches the
term, its row MUST name the matching groups, each with its `Periodo`,
`NumeroGrupo` and docente name; a matching inactive group MUST be labelled as
inactive in words. The row MUST name at most three groups, ordered by period
descending, then group number ascending, then id ascending, and, when more than
three match, MUST add the count of the remaining ones ("+N more", N being the
number of matching groups minus three). A row that matches only through its
`Codigo` or `Nombre`, with no matching group, MUST show no such hint. The
label and the placeholder of the search box MUST tell the user that docente and
periodo are searchable, in both locales (CM-I18N-1). The term MUST be bound as a
parameter, as for the existing fields.

#### Scenario: Match through the docente of a group

- GIVEN Asignatura A with a group whose docente is "Ana Pérez", and no `Codigo` or
  `Nombre` containing "perez"
- WHEN the list is searched for "pérez" (any case)
- THEN A is returned once and its row names that group with its `Periodo`,
  `NumeroGrupo` and docente name

#### Scenario: Match through the periodo of a group

- GIVEN Asignatura A with a group of `2026-S1`, and Asignatura B with groups only
  of `2025-S2`
- WHEN the list is searched for "2026-S1"
- THEN A is returned with that group named in its row, and B is not returned

#### Scenario: Group number does not match

- GIVEN Asignatura A whose only group is numbered "7", whose `Periodo` and docente
  name do not contain "7", and no `Codigo` or `Nombre` containing "7"
- WHEN the list is searched for "7"
- THEN A is not returned

#### Scenario: Term matches both by name and through a group

- GIVEN Asignatura A named "Física I" with a group whose docente is "Física
  Torres", and the term "fís"
- WHEN the list is searched
- THEN A is returned exactly once, the count is 1, and its row names the matching
  group

#### Scenario: Several matching groups give one row and a bounded hint

- GIVEN Asignatura A with five groups of `2026-S1`, in a state where all five
  match "2026-S1"
- WHEN the list is searched for "2026-S1"
- THEN A is one row, the total counts A once, the row names three groups in the
  order period descending, number ascending, id ascending, and shows "+2 more"

#### Scenario: Pagination counts Asignaturas

- GIVEN 12 Asignaturas each with three groups matching the term, and a page size
  of 10
- WHEN the list is searched
- THEN the total is 12, two pages exist, and the first page holds 10 rows

#### Scenario: Match only through an inactive group

- GIVEN an active Asignatura A whose only matching group is inactive
- WHEN the list is searched for that group's docente name, with the default
  `status` filter
- THEN A is returned, the matching group is labelled as inactive in words, and the
  Groups column of A is unchanged by the match (CM-ASG-8)

#### Scenario: The Asignatura status filter still applies

- GIVEN an inactive Asignatura A with an active group that matches the term
- WHEN the list is searched with the default `status` filter, and then with
  `status=all`
- THEN A is absent in the first search and present in the second

#### Scenario: Group of an out-of-scope Asignatura is not revealed

- GIVEN a `coordinacion` actor of Carrera X, and a group of an Asignatura of
  Carrera Y whose docente is "Ana Pérez"
- WHEN the list is searched for "pérez"
- THEN no row, no count and no hint from Carrera Y is present, and the outcome
  is the same as if that group did not exist

#### Scenario: No match

- GIVEN no `Codigo`, `Nombre`, group `Periodo` or docente name contains the term
- WHEN the list is searched
- THEN the "no results" empty state of CM-LST-1 is shown with a way to clear the
  search

#### Scenario: Match by code or name shows no hint

- GIVEN Asignatura A whose `Nombre` contains the term and none of whose groups do
- WHEN the list is searched
- THEN A is returned and its row names no group

#### Scenario: Ordering and failure behaviour are unchanged

- GIVEN a search that matches several Asignaturas, and then the database becoming
  unreachable
- WHEN the list is read each time
- THEN the rows keep the order of CM-LST-1 and, on failure, the degraded notice of
  CM-LST-1 is shown with no raw error

#### Scenario: Search copy names docente and periodo

- GIVEN the `es` and `en` catalogs
- WHEN the label and placeholder of the Asignaturas search are read
- THEN each mentions docente and periodo and the key sets stay identical

### Requirement: CM-RTE-1 Retired Grupos URLs redirect

Assumptions: U4, U7, U12.

The URLs of the retired standalone Grupos catalog MUST NOT show a page of their
own. Each of the following MUST answer with a temporary redirect (never a
permanent one), and the destination MUST then apply its own access rules:

| Retired URL | Redirects to |
|---|---|
| `/catalog/grupos`, with any query string | `/catalog/asignaturas`, with the search term `q` carried and the status filter and page reset to their defaults |
| `/catalog/grupos/new?asignaturaId={N}`, `{N}` made only of digits | `/catalog/asignaturas/{N}/grupos/new` |
| `/catalog/grupos/new`, with no `asignaturaId` or one that is not only digits | `/catalog/asignaturas` |
| `/catalog/grupos/{id}/edit` | `/catalog/asignaturas/{asignaturaId}/grupos/{id}/edit`, where `{asignaturaId}` is the owner of the Grupo |

The first three rows MUST NOT read any data: whether `{N}` names a usable
Asignatura is decided by the destination, which answers as in CM-GRP-9. The
fourth row is the only redirect that needs data. It MUST apply the access rules
of CM-ACC-1 and the scope rules of CM-SCOPE-1 before any Grupo is read; a
`coordinacion` actor with no Carrera MUST be sent to `/catalog/asignaturas`
without any read (CM-SCOPE-2); a malformed id, an unknown Grupo and a Grupo of
another Carrera MUST all answer "not found" with the same outcome, so the response
never reveals whether an out-of-scope group exists; and a found Grupo, active or
inactive, MUST redirect to the destination above, which contains no data beyond
the owner's id. Any other path below `/catalog/grupos` has no redirect and answers
"not found". On the first row the search term `q` MUST be carried, and the
`status` and `page` values MUST NOT be: they were chosen for the Grupos list, and
carried over they would filter and page Asignaturas instead, so the destination
opens with its default status filter on its first page. Query parameters that
reach a new-group or Asignaturas-list destination from the second and third rows
have no effect there: those destinations read none of them.

#### Scenario: Redirect table (table-driven)

| Request | Redirect target |
|---|---|
| `/catalog/grupos` | `/catalog/asignaturas` |
| `/catalog/grupos?q=MAT101&status=all&page=2` | `/catalog/asignaturas` with `q=MAT101`, the default status filter and the first page |
| `/catalog/grupos/new?asignaturaId=12` | `/catalog/asignaturas/12/grupos/new` |
| `/catalog/grupos/new` | `/catalog/asignaturas` |
| `/catalog/grupos/new?asignaturaId=abc` | `/catalog/asignaturas` |
| `/catalog/grupos/new?asignaturaId=` | `/catalog/asignaturas` |

- GIVEN any caller
- WHEN the request from the row is made
- THEN the response is a temporary redirect to the target from the row, with no
  data read

#### Scenario: Redirects are temporary

- GIVEN any of the four redirect shapes
- WHEN the response is inspected
- THEN its status is a temporary one (307) and not a permanent one (308 or 301)

#### Scenario: Edit URL of an in-scope Grupo

- GIVEN a Grupo G owned by Asignatura A, in the actor's scope, active or inactive
- WHEN `/catalog/grupos/{G}/edit` is requested by an allowed staff actor
- THEN the response redirects to `/catalog/asignaturas/{A}/grupos/{G}/edit`

#### Scenario: Edit URL cannot probe out-of-scope groups

- GIVEN a `coordinacion` actor of Carrera X, a Grupo of Carrera Y and an id that
  does not exist
- WHEN `/catalog/grupos/{id}/edit` is requested for each
- THEN both answer the same not-found page, with no redirect and no difference in
  the response

#### Scenario: Edit URL with a malformed id

- GIVEN an allowed staff actor
- WHEN `/catalog/grupos/abc/edit` or `/catalog/grupos/0/edit` is requested
- THEN the not-found page is shown and no Grupo is read

#### Scenario: Denied callers reach no data (table-driven)

| Caller | Outcome on `/catalog/grupos/{id}/edit` |
|---|---|
| `docente` or `estudiante` | `/denied`, no Grupo read |
| anonymous | `/login`, no Grupo read |
| user who must change the password | forced password change, no Grupo read |
| `coordinacion` with no Carrera | `/catalog/asignaturas`, no Grupo read |

- GIVEN the caller from the row
- WHEN the retired edit URL is requested
- THEN the outcome is as shown

#### Scenario: Anonymous caller on a configuration redirect

- GIVEN an unauthenticated caller
- WHEN `/catalog/grupos` or `/catalog/grupos/new?asignaturaId=12` is requested
- THEN the caller ends at `/login` after the redirect, and no module data is
  returned at any step

#### Scenario: Other retired paths answer not found

- GIVEN a staff actor
- WHEN `/catalog/grupos/12` or `/catalog/grupos/12/other` is requested
- THEN the not-found page is shown

## MODIFIED Requirements

### Requirement: CM-NAV-1 Sidebar reachability

Assumptions: none beyond B3 (the Grupos entry is removed by owner decision).

The two destinations Asignaturas and Docentes MUST be added as further children
of the existing collapsible sidebar "Administración" group, which already holds
"Carga de catálogo" (the import entry) and "Usuarios"; this change does not
create, rename or restructure that group, and the group keeps rendering only when
at least one of its children is visible. The sidebar MUST NOT offer a Grupos
destination to any role. The two destinations MUST be reachable there by the
three staff roles, and MUST NOT be shown to `docente` or `estudiante`. The
existing import item MUST keep its current rule (only where `canImportCatalog` is
true). No destination may mark itself active on `/catalog/import`, and
`/catalog/import` MUST NOT mark any destination active. The Asignaturas
destination MUST be marked active on `/catalog/asignaturas` and on every path
below it, including the group routes `/catalog/asignaturas/{id}/grupos/new` and
`/catalog/asignaturas/{id}/grupos/{grupoId}/edit`; the Docentes destination MUST
NOT be marked active on any of them. Visibility is a convenience only; CM-ACC-1
is the control.

#### Scenario: Visibility per role (table-driven)

| Role | Asignaturas / Docentes | Import item |
|---|---|---|
| `administrador` | visible | not visible |
| `coordinacion` | visible | not visible |
| `secretaria` | visible | visible |
| `docente`, `estudiante` | not visible | not visible |

- GIVEN a signed-in user with the role from the row
- WHEN the sidebar renders
- THEN the items are as shown

#### Scenario: No Grupos destination

- GIVEN a signed-in user of each staff role
- WHEN the sidebar renders
- THEN it offers exactly two catalog destinations, Asignaturas and Docentes, and
  none that links to `/catalog/grupos`

#### Scenario: Active state is exclusive

- GIVEN the path `/catalog/import`
- WHEN the sidebar renders
- THEN only the import item is marked active (with `aria-current`)

#### Scenario: Asignaturas is active on the group routes (table-driven)

| Path |
|---|
| `/catalog/asignaturas` |
| `/catalog/asignaturas/3/edit` |
| `/catalog/asignaturas/3/grupos/new` |
| `/catalog/asignaturas/3/grupos/5/edit` |

- GIVEN a staff user on the path from the row
- WHEN the sidebar renders
- THEN only the Asignaturas item is marked active (with `aria-current`) and the
  Docentes item is not

### Requirement: CM-LST-1 Lists, filters, search and pagination

`/catalog/asignaturas` and `/catalog/docentes` MUST be paged server-side lists.
There is no standalone list of Grupos: groups are listed only in the Grupos
section of their Asignatura (CM-ASG-7). The filter is the `status` query
parameter with the values `active`, `inactive` and `all`; its default MUST be
`active`, and an unrecognised `status` or page value MUST fall back to the default
or the nearest valid page rather than failing. Each row MUST show its state as a
word ("Active"/"Inactive" in the user's language), not by colour alone. Search `q`
(case-insensitive, partial) MUST cover:

| List | Search fields |
|---|---|
| Asignaturas | `Codigo`, `Nombre`, and, through the Asignatura's groups, `Periodo` and docente name (CM-ASG-9) |
| Docentes | name, `Correo` |

Page size MUST be the same as in `/users`. The Docentes list MUST show active and
inactive users with role `docente` (default active) and is not carrera-scoped; it
is read-only and MUST link to `/users` for account management; it MUST NOT expose
any credential field (`HashClave`, a password or a temporary password), nor `Cif`.

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

- GIVEN the Docentes list rendered and its data serialized
- WHEN searched for `HashClave`, a password, a temporary password or `Cif`
- THEN none is present

#### Scenario: Database unavailable

- GIVEN the database cannot be reached
- WHEN either list is opened by an allowed role
- THEN the page renders with an empty table and a status message that the data
  could not be loaded, as `/users` does, and no raw error is shown

### Requirement: CM-ASG-7 Grupos section on the Asignatura edit page

Assumptions: U7 (the status filter, pagination past 100 and the link to a list
are gone). Amendment 2026-10-08, revised by this change.

The edit page of an `Asignatura` in scope MUST include a "Grupos" section, placed
between the form and the State section, listing the `Grupo` rows of that
Asignatura, active and inactive, up to a cap of `ASIGNATURA_GRUPOS_MAX = 100`
rows, newest periods first, read under the same catalog scope as the page. Past
the cap the section MUST say that only the newest 100 are shown and MUST NOT link
to any list of groups, since none exists. A failed read of the groups MUST show a
degraded notice inside the section, never the empty state, and MUST NOT fail the
page. The column headers and the "Edit" link text MUST come from the `es` and `en`
catalogs (CM-I18N-1). Each row MUST show the period, the group number, the docente
name, the meeting days and the status as text, and MUST link to
`/catalog/asignaturas/{id}/grupos/{grupoId}/edit`, where `{id}` is the
Asignatura of the page. The meeting days MUST appear in week order, using the day
names of the user's language (a short form is acceptable if the full name remains
available to assistive technology); a Grupo with an empty set MUST show a "days
not set" text, never an error and never a blank cell. The days are neither a
search field nor a filter. Rows MUST be ordered by period descending, then group
number ascending, then id ascending. While the Asignatura is active the section
MUST show an "Add group" link to `/catalog/asignaturas/{id}/grupos/new`, whether
or not the Asignatura already has groups. With no groups the section MUST show an
empty state whose primary action is that link. While the Asignatura is inactive
the section MUST NOT show the link and MUST show a hint that the Asignatura must
be reactivated first (creating a Grupo requires an active Asignatura, CM-GRP-1).
The section is read-only: it embeds no Grupo form and performs no write, audit row
or migration. The page's existing not-found behaviour (CM-SCOPE-1) and no-Carrera
state (CM-SCOPE-2) MUST NOT change.

#### Scenario: Active and inactive groups are listed

- GIVEN an active Asignatura with one active and one inactive Grupo
- WHEN its edit page is opened
- THEN the Grupos section shows both rows with period, group number, docente
  name, days and a textual status, each linking to
  `/catalog/asignaturas/{id}/grupos/{grupoId}/edit`

#### Scenario: Days are listed in week order

- GIVEN a Grupo stored with Friday and Monday
- WHEN the edit page of its Asignatura is opened
- THEN its row shows Monday then Friday

#### Scenario: Empty set shows days not set

- GIVEN a Grupo with no days
- WHEN the edit page of its Asignatura is opened
- THEN its row shows the "days not set" text and no error styling or
  announcement

#### Scenario: Both locales

- GIVEN a Grupo meeting on Saturday
- WHEN the section is rendered in `es` and in `en`
- THEN the row shows the Saturday name of that language

#### Scenario: Empty state

- GIVEN an active Asignatura with no groups
- WHEN its edit page is opened
- THEN the section shows an empty state whose primary action is the "Add group"
  link to `/catalog/asignaturas/{id}/grupos/new`

#### Scenario: Add-group link is always present while active

- GIVEN an active Asignatura that already has groups
- WHEN its edit page is opened
- THEN the "Add group" link to `/catalog/asignaturas/{id}/grupos/new` is shown
  next to the list

#### Scenario: Inactive Asignatura

- GIVEN an inactive Asignatura, with or without groups
- WHEN its edit page is opened
- THEN no "Add group" link is shown and the section shows the hint that the
  Asignatura must be reactivated first; existing groups, if any, are still listed;
  with no groups the section shows the hint and an empty sentence with no action

#### Scenario: More groups than the cap

- GIVEN an Asignatura with more than 100 groups
- WHEN its edit page is opened
- THEN the section lists the 100 newest by period and shows a note that only the
  newest 100 are shown
- AND the section contains no link to `/catalog/grupos` or to any list of groups

#### Scenario: The groups read fails

- GIVEN an Asignatura whose groups cannot be read
- WHEN its edit page is opened
- THEN the page still renders its form and State section, and the Grupos section
  shows the degraded notice, never the empty state

#### Scenario: Scope is unchanged

- GIVEN a `coordinacion` actor with no Carrera, and a `coordinacion` actor
  addressing an Asignatura of another Carrera by id
- WHEN the edit page is opened
- THEN the first sees the no-Carrera state with no Grupos query, and the second
  receives the same not-found outcome as for an id that does not exist; neither
  sees any group

#### Scenario: Roles without catalog access are unchanged

- GIVEN a role denied by CM-ACC-1
- WHEN the edit page is opened
- THEN the denial destination is used as before and no group is read

### Requirement: CM-ASG-8 Asignaturas list shows the active groups

Amendment 2026-10-09, revised by this change (last sentence and one scenario).

The Asignaturas list MUST show a "Groups" column, placed after the hours column
and before the status column. The cell MUST show the group numbers
(`Grupo.NumeroGrupo`) of the Asignatura's active groups: distinct values, sorted
ascending, joined with ", " (for example `1, 2`). Inactive groups MUST NOT be
shown in the cell. When the Asignatura has no active group the cell MUST show a
single hyphen `-`. The value MUST come from the same list query as an aggregated
subquery column, with no extra query per row, and MUST NOT change the scope
predicate, the count query, paging or ordering. Search MUST NOT match on group
numbers; the groups-based search of CM-ASG-9 uses the group `Periodo` and docente
name only. The Asignatura edit page keeps its Grupos section (CM-ASG-7); no list
of Grupos exists.

#### Scenario: Several active groups, sorted and distinct

- GIVEN an Asignatura with active groups numbered "2", "1" and "2" (two periods)
- WHEN the Asignaturas list is opened
- THEN its Groups cell shows `1, 2`

#### Scenario: Inactive groups are excluded

- GIVEN an Asignatura with one active group "1" and one inactive group "2"
- WHEN the Asignaturas list is opened
- THEN its Groups cell shows `1`

#### Scenario: No active group

- GIVEN an Asignatura with no groups, or only inactive ones
- WHEN the Asignaturas list is opened
- THEN its Groups cell shows `-`

#### Scenario: Scope is unchanged

- GIVEN any actor allowed to open the list
- WHEN the list is read
- THEN the rows, the total and the pages are exactly those of CM-SCOPE-1; the
  Groups column adds no row and removes none

#### Scenario: Search does not match group numbers

- GIVEN an Asignatura whose only active group is numbered "7", whose `Periodo` and
  docente name do not contain "7"
- WHEN the list is searched for "7" and no Codigo or Nombre contains "7"
- THEN that Asignatura is not returned

### Requirement: CM-GRP-1 Grupo fields and validation

Assumptions: U2 (`Periodo` stays a visible field).

Creating a `Grupo` MUST validate server-side: `Asignatura` identified by id (on
the create page it is fixed by the route and submitted with the form, CM-GRP-9; a
submitted value is validated regardless of where it came from) and MUST be an
existing, active `Asignatura` in the actor's scope; `Periodo` MUST match
`YYYY-S1` or `YYYY-S2` exactly (no trimming, no case change); `NumeroGrupo`
required, trimmed, at most 12 characters, never numerically normalised; `Docente`
selected by id and MUST be an existing, active `Usuario` with the `docente` role.
The meeting days MUST be validated as specified in CM-GRP-6 (amendment
2026-10-07). A new `Grupo` MUST be created active with origin `manual`. Messages
MUST say what is wrong and what to do.

#### Scenario: Valid create

- GIVEN an active in-scope Asignatura and an active docente
- WHEN a Grupo with `2026-S1`, number " 1 " and at least one meeting day is
  submitted
- THEN it is created active with `NumeroGrupo` "1" and origin `manual`

#### Scenario: Invalid values are refused (table-driven)

| Field | Value |
|---|---|
| `Periodo` | `2026-S3`, `2026-1`, `26-S1`, `2026S1`, `2026-s1`, empty |
| `NumeroGrupo` | empty / whitespace only; 13 characters |
| `Asignatura` | id that does not exist |
| `Asignatura` | inactive |
| `Asignatura` | in another Carrera (actor is `coordinacion`) |
| `Docente` | id that does not exist |
| `Docente` | user whose role is not `docente` (each of the four other roles) |
| `Docente` | inactive `docente` |

- GIVEN otherwise valid data
- WHEN submitted with the value from the row
- THEN nothing is written and an error message is shown

#### Scenario: Duplicate natural key

- GIVEN a Grupo (A, `2026-S1`, "1")
- WHEN a create with the same triple is submitted and the existing Grupo is
  active
- THEN it is refused as a duplicate
- AND (Amendment 2026-10-09) the refusal is a field-level error on the group
  number field that names the whole natural key (Asignatura, period and
  number): "A group with this period and number already exists for the selected
  subject." It is not a form-level panel

#### Scenario: Match with an inactive Grupo

- GIVEN an inactive Grupo (A, `2026-S1`, "1")
- WHEN a create with the same triple is submitted
- THEN it is refused with a message pointing to reactivation, and the existing
  row stays inactive
- AND (Amendment 2026-10-09) that message is the field-level error on the group
  number field: "A group with this period and number already exists for the
  selected subject but is inactive. Reactivate it instead of creating it
  again."

#### Scenario: Same number elsewhere is allowed

- GIVEN a Grupo (A, `2026-S1`, "1")
- WHEN (A, `2026-S2`, "1") and (B, `2026-S1`, "1") are created
- THEN both are accepted

### Requirement: CM-SCOPE-1 Carrera scoping of reads and writes

A scoped actor (`coordinacion`) MUST see and change only `Asignatura` records of
its own `Carrera` and `Grupo` records whose `Asignatura` belongs to that
`Carrera`. This MUST hold on every list, on the Grupos section of the Asignatura
edit page, on every form load (including the options offered in selects), on every
group route (CM-GRP-9, CM-GRP-10), on the retired-URL redirect that reads a Grupo
(CM-RTE-1), on the groups-based search (CM-ASG-9) and on every action, enforced on
the server. Unscoped actors see and manage all records.

#### Scenario: Lists are limited (table-driven)

| Role | Asignaturas shown | Grupos shown in the section of a visible Asignatura |
|---|---|---|
| `administrador` | all | all of that Asignatura |
| `secretaria` | all | all of that Asignatura |
| `coordinacion` of Carrera X | only Carrera X | only for Carrera X Asignaturas |

- GIVEN asignaturas and grupos in Carreras X and Y
- WHEN the actor from the row opens the Asignaturas list and an Asignatura edit
  page
- THEN the rows are exactly those in the row, and the total count and page count
  reflect the same limit

#### Scenario: Foreign record by id is not revealed (table-driven)

| Attempt |
|---|
| open the edit page of an Asignatura of another Carrera |
| open the new-group page of an Asignatura of another Carrera |
| open the edit page of a Grupo whose Asignatura is in another Carrera |
| open the retired `/catalog/grupos/{id}/edit` URL of such a Grupo |
| submit edit, deactivate or reactivate for such an Asignatura |
| submit edit, deactivate or reactivate for such a Grupo |
| submit create-Grupo whose `Asignatura` is in another Carrera |

- GIVEN a `coordinacion` actor and a record outside its Carrera, addressed by a
  guessed or hand-crafted id in the URL or the form
- WHEN the attempt from the row is made
- THEN it is refused with the same outcome as for an id that does not exist
  (not-found page, or the same "not found" form error), on pages and on
  actions alike
- AND the denied screen is not used (it is reserved for role denial), nothing is
  written and no audit row exists

#### Scenario: Create route fixes an in-scope Asignatura

- GIVEN a `coordinacion` actor opening the new-group page of an active
  Asignatura of its own Carrera
- WHEN the page loads
- THEN the Asignatura is the one named by the route and no other Asignatura is
  offered

#### Scenario: Scope follows the stored Carrera

- GIVEN a `coordinacion` actor whose stored `Carrera` was changed from X to Y
- WHEN the next request to the module is made
- THEN lists and writes use Carrera Y, without requiring a new login

### Requirement: CM-SCOPE-2 Coordinacion without a Carrera

A `coordinacion` actor with no stored `Carrera` MUST see an explanatory empty
state on every list and on every group route instead of data, MUST NOT be offered
any option in any select, and MUST have every write refused with a message stating
that the account has no Carrera assigned and who to ask to fix it.

#### Scenario: Empty state

- GIVEN a `coordinacion` actor with no Carrera
- WHEN they open `/catalog/asignaturas`, the new-group page or the edit page of a
  Grupo
- THEN no record is listed, no form is shown, no data is read and an explanatory
  empty state is shown, distinct from the "no results" empty state

#### Scenario: Writes refused

- GIVEN the same actor and a hand-crafted create, edit, deactivate or
  reactivate request for any record
- WHEN the action runs
- THEN it is refused with the no-Carrera message and nothing is written

## REMOVED Requirements

### Requirement: CM-GRP-7 The Grupos list shows the days

(Reason: the standalone `/catalog/grupos` list no longer exists, B3. The rules
about showing days move into the Grupos section of the Asignatura edit page,
CM-ASG-7: week order, the user's language, the "days not set" text, and the days
being neither searched nor filtered.)
(Migration: the three scenarios of this requirement are carried into CM-ASG-7 as
"Days are listed in week order", "Empty set shows days not set" and "Both
locales".)

### Requirement: CM-GRP-8 Preselected Asignatura on the new Grupo page

(Reason: the `asignaturaId` query parameter and its silent-ignore rule belonged to
`/catalog/grupos/new`, which is retired. The Asignatura now comes from the route,
and an unusable one answers "not found" instead of being ignored.)
(Migration: CM-GRP-9 for the new-group page; CM-RTE-1 for the retired URL and its
`asignaturaId` query. The scenario "Preselection does not bypass the create
action" survives as "Hand-crafted Asignatura is still validated" in CM-GRP-9.)

## What does not change

A checklist for review. None of these has a delta, and each MUST keep passing its
existing tests.

- [ ] Role matrix and denial destinations (CM-ACC-1); authorization before the
  request body (CM-ACC-2). The new routes and the retired-URL page add the same
  checks, they do not relax any.
- [ ] Carrera scoping predicate, scope `none` handling, the rule that a foreign
  record looks like a missing one (CM-SCOPE-1, CM-SCOPE-2, CM-SCOPE-3).
- [ ] Group validations, immutable natural key, no-change edits, deactivation,
  reactivation and origin (CM-GRP-2 to CM-GRP-6). CM-GRP-1 changes only in how the
  Asignatura is obtained in the UI, not in what is validated.
- [ ] The deactivation confirmation step (CM-UX-1, RNF-12): same content, same
  mutation by form POST, never a GET.
- [ ] Audit events and one-row-per-write rule (CM-AUD-1, RNF-06): same events,
  same actors; no new event, none removed.
- [ ] Nothing is physically deleted, busy outcome, concurrent edits (CM-NFR-1,
  CM-NFR-2, CM-NFR-4).
- [ ] The Excel import (RNF-13): the workbook, its sheets (including Grupos), the
  screen and the `catalog-excel-import` behaviour are untouched.
- [ ] No schema change, no migration. Nothing under the intake, the request
  screens or their data access changes.
- [ ] Asignatura create, edit, deactivation and reactivation (CM-ASG-1 to
  CM-ASG-6).

## Reviewed without delta

| Requirement | Why no delta |
|---|---|
| CM-ACC-1 | Its operations ("list" on Grupo included) are still all available: Grupo listing now happens in the section of CM-ASG-7. The role matrix scenarios name `/catalog/asignaturas`, which still exists. New routes get their own access scenarios in CM-GRP-9, CM-GRP-10 and CM-RTE-1. |
| CM-ACC-2 | Mentions "create-Grupo form" only as an example action; unaffected. |
| CM-GRP-2, CM-GRP-3, CM-GRP-4 | They specify behaviour of the record, not the page that hosts it. They apply unchanged on the new edit route (CM-GRP-10). |
| CM-UX-1 | States the confirmation, not the route; the mechanism stays on the edit page. Pinned by a scenario in CM-GRP-10. |
| CM-I18N-1 | Key-parity rule is generic and still holds; the new copy is covered by it. The copy-specific scenarios in CM-ASG-9 are additive. |
| CM-AUD-1 | Audit is untouched; CM-GRP-11 only refers to it. |
| CM-NFR-3 | Applies to the new pages by its own wording ("every module screen"). |

## Assumptions and open questions

- **U-list.** See "Assumptions this delta rests on" above. No requirement here
  depends on an assumption that is not named in it.
- **A-SEARCH-HINT-ALWAYS.** The matched-groups hint is shown whenever at least one
  group matches, including when the `Codigo` or `Nombre` also matches. The
  proposal does not say. *Default chosen by this spec.*
- **A-SEARCH-HINT-ORDER.** The hint orders groups like the section does (period
  descending, number ascending, id ascending). *Default chosen by this spec.*
- **A-GRP-EDIT-INACTIVE-PARENT.** The edit route does not require an active parent
  Asignatura, because an inactive Grupo must stay reachable to be reactivated
  (CM-GRP-4). The proposal states the "not found" rule for inactive parents only
  for the new-group URL (U11). *Default chosen by this spec.*
- **A-GRP-TOGGLE-REVALIDATE.** Deactivation and reactivation revalidate the
  Asignatura edit page and the Asignaturas list as well, because the Groups column
  and the section both show group state. The proposal names revalidation only for
  create and edit. *Default chosen by this spec.*
- **A-RTE-STATUS.** The `/catalog/grupos` redirect carries `q` and resets
  `status` and `page` (design UG-4). *Default chosen by the design; the owner has
  seen it and not objected.*
- **A-RTE-OTHER-QUERY.** On `/catalog/grupos/new?asignaturaId={N}` the framework
  passes the request's query string through and offers no way to drop it (design
  UG-4), so other parameters may reach the destination. They have no effect
  there. *Constraint found by the design.*
- **A-RTE-OTHER-PATHS.** Paths under `/catalog/grupos` other than the four shapes
  answer "not found". *Default chosen by this spec.*
- **A-ASG8-SCENARIO.** The scenario "Search does not match group numbers" of
  CM-ASG-8 gains the precondition that the group's `Periodo` and docente name do
  not contain the searched digit, because the new group condition could otherwise
  match it for a reason unrelated to the group number. Its assertion is unchanged.
  If its test fixture uses a periodo or docente name containing the searched
  digit, the fixture must change, not the rule.
- **A-CREATE-TAMPER.** The destination after a create is the Asignatura of the
  group as saved on the server. A hand-crafted submission that names a different
  valid, in-scope Asignatura than the route creates the group there and lands on
  that Asignatura (CM-GRP-1 validates it either way). The proposal does not say
  the action must reject a mismatch with the route. *Default chosen by this spec.*
- **Notes for the archive step.** The main spec's "Assumptions and open
  questions" section mentions the Grupos list and `/catalog/grupos/new` in the
  bullets A-DIAS-NOSEARCH and "Amendment 2026-10-08". They are history, not
  requirements, and are left as they are; add a pointer to this change when
  archiving.
