# Catalog Management Specification (new capability)

> Delta type: this whole file is ADDED. There is no base spec for
> `catalog-management`. It builds on the archived change
> `catalog-excel-import` (archived on 2026-10-04), whose specs under
> `openspec/specs/` are the base for the sibling
> deltas.

## Purpose

Staff manage individual `Asignatura` and `Grupo` records from a back-office
"Catálogos" module instead of re-uploading the whole Excel workbook. Records are
never physically deleted: "delete" means `Activo` false. The module also shows a
read-only list of docentes that links to the users module. Because the Excel
import (`catalog-excel-import`) writes the same rows, the import wins on
conflict; its side of that rule is specified in the sibling deltas.

Vocabulary used below:

- **Staff roles**: `administrador`, `coordinacion`, `secretaria`.
- **Unscoped actor**: `administrador` or `secretaria`. **Scoped actor**:
  `coordinacion`, limited to the `Carrera` stored for that user.
- **Scope of a Grupo**: the `Carrera` of its `Asignatura`.
- **Denied**: an unauthenticated caller is sent to `/login`; an authenticated
  caller who is refused is redirected to `/denied`; a user who must change the
  password is first sent to the forced password change, as for every other
  guarded screen.
- **Entry point**: any page, form load or server action of the module.

## Requirements

### Requirement: CM-ACC-1 Role matrix for every operation

The module MUST be available to the staff roles only. Operations are list, view,
create, edit, deactivate and reactivate on `Asignatura` and on `Grupo`, and list
on Docentes. The right MUST be a predicate derived from the existing role
hierarchy in `permissions.ts` (the roles for which account creation is
available), not a second hand-written role list. Authorization MUST be enforced
on the server for every entry point, independently of what the sidebar shows.

#### Scenario: Role matrix (table-driven)

| Role | Asignatura / Grupo (all six operations) | Docentes list |
|---|---|---|
| `administrador` | allowed, all records | allowed |
| `coordinacion` | allowed, only within own `Carrera` (CM-SCOPE) | allowed |
| `secretaria` | allowed, all records | allowed |
| `docente` | denied | denied |
| `estudiante` | denied | denied |
| anonymous | denied (to `/login`) | denied (to `/login`) |

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

### Requirement: CM-ACC-2 Authorization precedes the request body

Every module server action MUST verify authentication, the role predicate and
the actor's scope before reading `FormData` or any submitted field. A denied
caller MUST cause no parsing of input and no write.

#### Scenario: Denied caller's body is never read

- GIVEN a `docente` submitting a well-formed create-Grupo form
- WHEN the action runs
- THEN the form fields are not read, nothing is written and the caller is
  redirected to `/denied`

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

### Requirement: CM-SCOPE-3 Carrera of a created or edited Asignatura

When a scoped actor creates an `Asignatura`, the new row MUST belong to the
actor's own `Carrera`; a request that omits the `Carrera` gets the actor's own,
and a request that names a different `Carrera` MUST be refused with nothing
written. A scoped actor MUST NOT move an `Asignatura` to another `Carrera`: an
edit request naming a different `Carrera` MUST be refused with nothing written
(see assumption A-CARRERA-REFUSE). An unscoped actor MAY choose any existing
`Carrera` on create and on edit.

#### Scenario: Coordinacion creates in own Carrera

- GIVEN a `coordinacion` actor of Carrera X submitting a create form that names
  no Carrera, or names Carrera X
- WHEN the action runs
- THEN the new Asignatura belongs to Carrera X

#### Scenario: Coordinacion cannot create in another Carrera

- GIVEN a `coordinacion` actor of Carrera X submitting a create form carrying
  Carrera Y
- WHEN the action runs
- THEN it is refused, nothing is written and no audit row exists

#### Scenario: Coordinacion cannot move an Asignatura

- GIVEN a `coordinacion` actor and an Asignatura of its Carrera
- WHEN an edit request carries another Carrera
- THEN it is refused, the Carrera is unchanged, nothing is written and no audit
  row exists

#### Scenario: Unscoped actor assigns a Carrera

- GIVEN a `secretaria`
- WHEN they create an Asignatura choosing an existing Carrera
- THEN it is created in that Carrera

### Requirement: CM-ASG-1 Asignatura fields and validation

Creating or editing an `Asignatura` MUST validate server-side with the same
rules as the import: `Codigo` required, trimmed, at most 32 characters;
`Nombre` required, trimmed, at most 160 characters; `HorasTotales` required,
an integer greater than zero; `Carrera` MUST be an existing `Carrera`
(selected by id, not by name). A failure MUST refuse the write and show, per
field, a message saying what is wrong and what to enter.

#### Scenario: Valid create

- GIVEN a staff actor in scope
- WHEN they submit a new `Codigo`, a `Nombre`, `HorasTotales` 64 and an existing
  Carrera
- THEN the Asignatura is created active and appears in the list

#### Scenario: Invalid values are refused (table-driven)

| Field | Value |
|---|---|
| `Codigo` | empty / whitespace only |
| `Codigo` | 33 characters |
| `Nombre` | empty |
| `Nombre` | 161 characters |
| `HorasTotales` | empty |
| `HorasTotales` | 0 |
| `HorasTotales` | -8 |
| `HorasTotales` | 12.5 |
| `HorasTotales` | "abc" |
| `Carrera` | id that does not exist |

- GIVEN otherwise valid data
- WHEN submitted with the value from the row
- THEN nothing is written and the field shows an error message

#### Scenario: Values are trimmed

- GIVEN a `Codigo` submitted as "  MAT101 "
- WHEN the Asignatura is created
- THEN it is stored as "MAT101"

### Requirement: CM-ASG-2 Codigo is immutable and duplicates are refused

`Asignatura.Codigo` MUST NOT change after creation: the edit screen MUST show
it read-only and the edit action MUST ignore or refuse any submitted `Codigo`
change. Creating an `Asignatura` whose `Codigo` equals an existing active
record MUST be refused as a duplicate. If it equals an existing inactive
record, the create MUST also be refused; creation MUST NOT reactivate
implicitly. The refusal message MAY point to reactivating the existing record
only when that record is inside the caller's scope; for a record outside the
caller's scope, whether active or inactive, the message MUST be the generic
duplicate message and MUST NOT reveal its state, its `Carrera` or its data.
Comparison of `Codigo` follows CM-ASG-6.

#### Scenario: Duplicate of an active record

- GIVEN an active Asignatura "MAT101"
- WHEN a create with Codigo "MAT101" is submitted
- THEN it is refused with a duplicate message and the first row is unchanged
- AND (Amendment 2026-10-09) the message is a field-level error on the Codigo
  field, shown under it with the same treatment as a validation error (values
  kept), and it names the conflicting key: "A subject with this code already
  exists." It is not a form-level panel and does not repeat the value

#### Scenario: Match with an inactive record

- GIVEN an inactive Asignatura "MAT101" inside the actor's scope
- WHEN a create with Codigo "MAT101" is submitted
- THEN it is refused with a message that the code exists but is inactive and
  must be reactivated instead
- AND the existing row stays inactive
- AND (Amendment 2026-10-09) that message is the field-level error on the Codigo
  field: "A subject with this code already exists but is inactive. Reactivate it
  instead of creating it again."

#### Scenario: Duplicate of a record outside the actor's scope

- GIVEN a `coordinacion` actor and "MAT101" existing, active or inactive, in
  another Carrera
- WHEN they create "MAT101"
- THEN it is refused with the generic duplicate message, which does not name the
  other Carrera, does not say the record is inactive and does not point to
  reactivation
- AND (Amendment 2026-10-09) that generic message is the same field-level error
  on the Codigo field as the active-duplicate one, with no state wording

#### Scenario: Codigo cannot be edited

- GIVEN an Asignatura "MAT101"
- WHEN an edit request carries Codigo "MAT102"
- THEN the Codigo stays "MAT101"

#### Scenario: Concurrent duplicate

- GIVEN two creates of the same new Codigo racing
- WHEN the second one hits the uniqueness rule
- THEN it is refused with the duplicate message (no server error, no audit row)

### Requirement: CM-ASG-3 Asignatura edit

Editable fields are `Nombre`, `HorasTotales` and (unscoped actors only)
`Carrera`. An edit that changes no field MUST write nothing, write no audit row
and tell the user that nothing changed. An inactive `Asignatura` MUST NOT be
editable: its edit screen MUST present the record read-only with the reactivate
action, so an edit never silently changes a record that is out of use.

#### Scenario: Edit changes fields

- GIVEN an active Asignatura in scope
- WHEN `Nombre` and `HorasTotales` are changed and submitted
- THEN both are stored and the list shows the new values

#### Scenario: No-op edit

- GIVEN an active Asignatura
- WHEN the form is submitted with its current values
- THEN nothing is written, no audit row is created and a "no changes" message
  is shown

#### Scenario: Inactive record is read-only

- GIVEN an inactive Asignatura
- WHEN its edit URL is opened or an edit is submitted
- THEN fields are not editable and the edit is refused with a message saying
  it must be reactivated first

### Requirement: CM-ASG-4 Asignatura deactivation

Deactivating an `Asignatura` MUST set `Activo` false and MUST NOT delete it. It
MUST be refused when the `Asignatura` has one or more active `Grupo` rows; the
message MUST state how many active groups exist and that they must be
deactivated first. There MUST be no cascade. The active-groups check and the
deactivation MUST be evaluated in the same transaction. Deactivation MUST be an
explicit confirmation step (CM-UX-1).

#### Scenario: No active groups

- GIVEN an active Asignatura whose grupos are all inactive or absent
- WHEN a staff actor in scope confirms deactivation
- THEN `Activo` is false, the row remains, and the list default no longer
  shows it

#### Scenario: Refused with active groups

- GIVEN an active Asignatura with 3 active grupos
- WHEN deactivation is confirmed
- THEN it is refused with a message stating there are 3 active groups that must
  be deactivated first
- AND the Asignatura and its grupos are unchanged, with no audit row

#### Scenario: Inactive groups do not block

- GIVEN an Asignatura whose only grupos are inactive
- WHEN it is deactivated
- THEN it succeeds

#### Scenario: Already inactive

- GIVEN an inactive Asignatura
- WHEN a deactivate request arrives
- THEN nothing is written, no audit row is created and the user is told it is
  already inactive

### Requirement: CM-ASG-5 Asignatura reactivation

An inactive `Asignatura` in scope MAY be reactivated by a staff actor, with no
precondition on any other record. It MUST set `Activo` true, MUST NOT reactivate
any of its grupos, and MUST be refused (without a write) when the record is
already active.

#### Scenario: Reactivate

- GIVEN an inactive Asignatura in scope
- WHEN a staff actor reactivates it
- THEN it is active, its grupos keep their previous state

### Requirement: CM-ASG-6 Codigo comparison rule

`Codigo` MUST be trimmed and otherwise compared exactly (case-sensitive, no
other normalisation), by the same rule the Excel import uses for its natural
key, so that a manually created code and an imported code can never be two
spellings of one subject, nor one spelling matched as two.

#### Scenario: Exact comparison after trimming

- GIVEN an Asignatura "MAT101"
- WHEN a create with " MAT101 " is submitted
- THEN it is refused as a duplicate of "MAT101"

#### Scenario: Case differs

- GIVEN an Asignatura "MAT101"
- WHEN a create with "mat101" is submitted
- THEN it is treated as a different code, exactly as the import treats it

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

### Requirement: CM-GRP-2 Editable Grupo fields

After creation only the `Docente`, the meeting days (CM-GRP-6) and the active
state MAY change. `Asignatura`, `Periodo` and `NumeroGrupo` (the natural key)
MUST be immutable: the edit screen MUST show them read-only and the edit action
MUST ignore or refuse any change to them. A new `Docente` MUST satisfy the same
rule as on create. Leaving the current `Docente` unchanged MUST NOT be refused
even if that docente has since become inactive. A no-change edit MUST write
nothing and no audit row. An inactive `Grupo` MUST NOT be editable (reactivate
first).
(Amendment 2026-10-07: "the meeting days" added to the editable fields;
previously only the `Docente` and the active state.)

#### Scenario: Change docente

- GIVEN an active Grupo and another active docente
- WHEN the docente is changed and submitted
- THEN the Grupo has the new docente

#### Scenario: Natural key cannot change

- GIVEN a Grupo (A, `2026-S1`, "1")
- WHEN an edit request carries another Periodo, number or Asignatura
- THEN those values are unchanged

#### Scenario: Invalid new docente

- GIVEN an active Grupo
- WHEN the edit selects a non-docente or inactive user
- THEN it is refused and the Grupo is unchanged

#### Scenario: Unchanged inactive docente does not block

- GIVEN an active Grupo whose docente later became inactive
- WHEN the edit changes nothing about the docente
- THEN no docente error is raised (the edit is a no-change edit)

### Requirement: CM-GRP-3 Grupo deactivation

Deactivating a `Grupo` MUST set `Activo` false and MUST NOT delete it, nor any
`Inscripcion` row referencing it. It MUST be allowed when `Inscripcion` rows
exist; those rows stay unchanged (downstream readers already exclude inactive
groups). It MUST NOT depend on the state of its `Asignatura` or its docente. It
MUST require the explicit confirmation step (CM-UX-1). Deactivating an already
inactive `Grupo` MUST write nothing and no audit row.

#### Scenario: Deactivate with enrollments

- GIVEN an active Grupo with 12 inscripciones
- WHEN a staff actor in scope confirms deactivation
- THEN the Grupo is inactive and all 12 inscripciones still exist unchanged

#### Scenario: Already inactive

- GIVEN an inactive Grupo
- WHEN a deactivate request arrives
- THEN nothing is written and the user is told it is already inactive

### Requirement: CM-GRP-4 Grupo reactivation

An inactive `Grupo` in scope MAY be reactivated. Reactivation MUST be refused,
with no write and no audit row, when its `Asignatura` is inactive (message:
reactivate the Asignatura first) or when its `Docente` is not an active user
with the `docente` role (message: the docente must be active first; see assumption
A-GRP-4).
Reactivating an active Grupo MUST write nothing.

#### Scenario: Reactivate with valid parents

- GIVEN an inactive Grupo whose Asignatura and docente are active
- WHEN it is reactivated
- THEN it is active

#### Scenario: Inactive Asignatura blocks (table-driven)

| State of parent | Result |
|---|---|
| Asignatura inactive | refused, message names the Asignatura |
| Docente inactive | refused, message names the docente |
| Docente role not `docente` | refused, message names the docente |

- GIVEN an inactive Grupo with the parent state from the row
- WHEN reactivation is requested
- THEN it is refused and the Grupo stays inactive

### Requirement: CM-GRP-5 Origin of a Grupo

Every `Grupo` MUST carry an origin that is either `importacion` or `manual`.
Manual create MUST record `manual`. The origin MUST be set once at creation and
MUST NOT be rewritten by any edit, deactivation or reactivation, manual or by
import. Existing rows, created before the origin existed, MUST be `importacion`.

#### Scenario: Origin is recorded and stable

- GIVEN a Grupo created manually
- WHEN it is edited, deactivated, reactivated and then updated by an import that
  lists it
- THEN its origin is still `manual`

#### Scenario: Pre-existing rows

- GIVEN grupos stored before this change
- WHEN the change is applied
- THEN each has origin `importacion`

### Requirement: CM-GRP-6 Meeting days of a Grupo in the manual flow

Amendment 2026-10-07. Each `Grupo` MUST carry the set of weekdays on which it
meets, chosen from a closed list of seven values: Monday, Tuesday, Wednesday,
Thursday, Friday, Saturday, Sunday. The set has no duplicates, is independent
of the order of selection and is always presented in week order (Monday first).
Only days are recorded: there is no start time, end time, classroom or
per-date calendar. The create and edit forms MUST offer a multi-select control
that works by keyboard, exposes each day and its selected state to assistive
technology, and shows the selected state in text or shape and not by colour
alone. Under assumption A-DIAS-REQ, a manual create or edit MUST be refused,
with nothing written, when no day is selected, with a message saying that at
least one meeting day is required. A value outside the seven MUST be refused
on the server even if the control cannot produce it. Days follow the Grupo's
scope and access rules (CM-ACC-1, CM-SCOPE-1) with no additional rule.
Deactivation and reactivation MUST NOT depend on the days. Day names MUST come
from the `es` and `en` catalogs (CM-I18N-1).

#### Scenario: Create with days

- GIVEN an active in-scope Asignatura and an active docente
- WHEN a Grupo is submitted with Wednesday and Monday selected, in that order
- THEN it is created and its days are Monday and Wednesday, shown in week order

#### Scenario: Create without days is refused (A-DIAS-REQ)

- GIVEN otherwise valid Grupo data and no day selected
- WHEN the create is submitted
- THEN nothing is written, no audit row exists and the days field shows an
  error saying at least one meeting day is required

#### Scenario: Edit changes the days

- GIVEN an active Grupo meeting on Monday
- WHEN the edit selects Monday and Thursday and is submitted
- THEN the Grupo meets on Monday and Thursday

#### Scenario: Pre-existing Grupo with no days

- GIVEN a Grupo stored before this amendment, with an empty set of days
- WHEN it is opened for edit
- THEN no day is selected, the empty set is not shown as an error, and
  submitting without selecting a day is refused as in "Create without days is
  refused"

#### Scenario: Reselecting the same days is a no-change edit

- GIVEN an active Grupo meeting on Monday and Wednesday
- WHEN the edit submits Wednesday and Monday and changes nothing else
- THEN nothing is written, no audit row is created and a "no changes" message
  is shown

#### Scenario: Days-only edit is a real update

- GIVEN an active Grupo and an edit that changes only its days
- WHEN the edit is submitted
- THEN the days are stored, exactly one `grupo.actualizado` audit row exists
  and its field list contains `dias` and nothing else

#### Scenario: Invalid day value is refused

- GIVEN a hand-crafted request carrying a day value outside the seven
- WHEN the create or edit action runs
- THEN it is refused and nothing is written

#### Scenario: Deactivate and reactivate ignore the days

- GIVEN an inactive Grupo with an empty set of days whose Asignatura and
  docente are active
- WHEN it is reactivated
- THEN it is active and its days are still empty

#### Scenario: Control is accessible

- GIVEN the Grupo form
- WHEN it is navigated with the keyboard only
- THEN every day can be reached, selected and cleared, and each day exposes
  its name and selected state

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
with the page status (the current page of the total pages); the total count is
shown once, in the toolbar, and not repeated in the footer (`data-table`
DT-PAG-1, DT-TOOL-1). Changing the search,
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

### Requirement: CM-UX-1 Deactivation needs an explicit confirmation

Deactivation (and reactivation) MUST be a mutation submitted by a form POST or
equivalent, never a GET link. Deactivation MUST require an explicit
confirmation step that names the record (for an Asignatura, its `Codigo` and
`Nombre`; for a Grupo, its Asignatura, `Periodo` and `NumeroGrupo`) and states
that nothing is deleted and that it can be reactivated. For an Asignatura the
step MUST show, or the refusal MUST state, the number of active groups. The
mechanism (page, inline control) is left to design but MUST NOT need a new
Dialog, AlertDialog or Tabs primitive.

#### Scenario: GET never mutates

- GIVEN any module URL
- WHEN it is requested with GET, including from a link prefetch
- THEN no record changes state

#### Scenario: Confirmation names the record

- GIVEN a staff actor who chose to deactivate Grupo (MAT101, `2026-S1`, "2")
- WHEN the confirmation step is shown
- THEN it names that record and no change has been made yet

#### Scenario: Cancel leaves the record

- GIVEN the confirmation step
- WHEN the user cancels
- THEN the record is unchanged and no audit row exists

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

### Requirement: CM-I18N-1 Copy in both locales

Every user-visible string of the module (labels, headings, statuses, empty
states, validation and refusal messages, confirmation text) MUST come from the
`es` and `en` catalogs, and both catalogs MUST contain identical key sets. A
refusal message MUST say what happened and what to do next.

#### Scenario: Key parity

- GIVEN the `es` and `en` catalogs
- WHEN their key sets are compared
- THEN they are identical

#### Scenario: Refusal messages are actionable (table-driven)

| Refusal | Message must say |
|---|---|
| deactivate Asignatura with active groups | how many, and to deactivate them first |
| create duplicate of inactive record | that it exists inactive and to reactivate it |
| coordinacion without Carrera | that no Carrera is assigned and who to ask |
| reactivate Grupo with inactive parent | which parent, and to fix it first |
| write cannot start (busy, CM-NFR-4) | that nothing was saved and to try again |
| Grupo submitted without a day (CM-GRP-6) | that at least one meeting day is required and to select one |

- GIVEN the refusal from the row
- WHEN it is shown in either locale
- THEN it contains the content from the row

#### Scenario: Day names and days messages exist in both locales

- GIVEN the `es` and `en` catalogs
- WHEN the keys for the seven day names (full and short forms, if used), the
  "days not set" text, the days field label and the days error messages are
  looked up
- THEN each exists in both catalogs and the full key sets remain identical

### Requirement: CM-NFR-1 Nothing is physically deleted

The module MUST NOT issue a `DELETE` or `TRUNCATE` against `Asignatura`,
`Grupo`, `Inscripcion`, `Usuario` or the audit log. "Delete" is `Activo`
false.

#### Scenario: Row counts never fall

- GIVEN any sequence of create, edit, deactivate and reactivate operations
- WHEN they complete
- THEN the row count of every table is never lower than before

### Requirement: CM-NFR-2 Concurrent edits

Concurrent edits of one record MUST NOT corrupt it: the last committed write
wins and each write produces its own audit row. Preconditions (duplicate key,
active-groups count, parent state) MUST be evaluated within the transaction
that writes.

#### Scenario: Two edits of one record

- GIVEN two users who opened the same Asignatura
- WHEN both submit different `Nombre` values
- THEN the later commit is stored and two audit rows exist

### Requirement: CM-NFR-4 Busy outcome when a write cannot start

Catalog writers (every manual write and the import apply) are serialised, so
that a precondition checked by a write cannot be invalidated by another writer
before it commits. A manual write that cannot start within a bounded wait MUST
be reported to the user as "busy, nothing was saved, try again". It MUST write
nothing and no audit row, MUST NOT hang, and MUST be distinguishable from a
validation, duplicate, not-found or unexpected-failure outcome. The mechanism
used to serialise is a design decision and is not specified here.

#### Scenario: Busy outcome per operation (table-driven)

| Operation |
|---|
| create Asignatura |
| edit Asignatura |
| deactivate Asignatura |
| reactivate Asignatura |
| create Grupo |
| edit Grupo |
| deactivate Grupo |
| reactivate Grupo |

- GIVEN a valid in-scope request by a staff actor, while another catalog write
  holds the right to write for longer than the bounded wait
- WHEN the operation from the row is submitted
- THEN the user is told it is busy and to try again
- AND no record changed and no audit row exists

#### Scenario: Retry succeeds

- GIVEN a write that was reported busy and the other write has since finished
- WHEN the user submits it again
- THEN it succeeds as it would have without contention

#### Scenario: Busy does not bypass authorization

- GIVEN a denied or out-of-scope request while catalog writes are busy
- WHEN it is submitted
- THEN it gets its normal denial or not-found outcome, not the busy outcome

### Requirement: CM-NFR-3 Accessibility floor

Every module screen MUST meet `docs/design-system.md` §7: text contrast 4.5:1
(large text and UI borders 3:1), a visible focus ring, meaning never carried
by colour alone (status always shown as text), touch targets at least
44x44px, one `h1` per screen and no skipped heading levels. Form errors MUST be
associated with their fields and announced.

#### Scenario: Status is text

- GIVEN a list with active and inactive rows
- WHEN rendered
- THEN every row carries a textual state, not only a colour

#### Scenario: Heading structure

- GIVEN any module page
- WHEN rendered
- THEN it has exactly one `h1` and no skipped levels

### Requirement: CM-AUD-1 Audit of manual writes

Every successful manual create, update, deactivation and reactivation of an
`Asignatura` or a `Grupo` MUST write exactly one audit row in the same
transaction (per `audit-log`). A refused, invalid, no-op or failed write MUST
write none. Details are in the `audit-log` delta.

#### Scenario: One row per write

- GIVEN a successful manual create of a Grupo
- WHEN the audit log is read
- THEN exactly one new row exists for it

#### Scenario: Refusal writes none

- GIVEN a refused deactivation of an Asignatura with active groups
- WHEN the audit log is read
- THEN no new row exists

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

## Assumptions and open questions

Each item below was resolved with the recommended default and is open for the
owner to overrule.

- **A-IMP-1 (open question 1).** A workbook Grupo row whose Asignatura is not in
  the workbook's Asignaturas sheet and is inactive in the database is a
  row-level error naming the Asignatura; the import reactivates only what the
  workbook declares. Specified in the `catalog-excel-import` delta.
  *Assumption, not confirmed by the owner.*
- **A-GRP-2 (question 2).** Editable Grupo fields: docente, meeting days (added
  by the 2026-10-07 amendment) and active state only (CM-GRP-2). *Assumption.*
- **A-DUP-3 (question 3).** Create over an inactive natural-key match is
  refused with a pointer to reactivation; over an active match it is a plain
  duplicate (CM-ASG-2, CM-GRP-1). *Assumption.*
- **A-UX-4 (question 4).** Only behaviour is specified for confirmation
  (CM-UX-1); the mechanism is a design decision.
- **A-NAV-5 (question 5).** Only reachability and visibility are specified
  (CM-NAV-1); shape is a design decision.
- **A-RDR-6 (question 6).** An inactive Asignatura hides its Grupos from the
  downstream active-only readers. *Assumption; it changes an existing reader.*
  Specified in the `academic-catalog` delta.
- **A-SCOPE-7 (question 7).** CM-SCOPE-1 requires the stored Carrera to take
  effect without a new login. The design resolves this with a per-request
  database lookup, so the requirement stands. If the design is ever changed to
  keep the Carrera in the session, that scenario is replaced by: the change
  takes effect at the user's next login; a visible degradation the owner would
  have to accept.
- **A-GRP-4.** Reactivating a Grupo whose Asignatura or docente is inactive is
  refused (not auto-fixed). Because editing an inactive Grupo is also refused,
  a Grupo whose docente became inactive can only return through a re-import or
  after the docente is reactivated in the users module (which does not exist
  yet). The owner may prefer to allow changing the docente during reactivation.
  *Assumption.*
- **A-EDIT-INACTIVE.** Inactive records are read-only until reactivated
  (CM-ASG-3, CM-GRP-2). *Assumption introduced by this spec; the design does
  not state it and its write-result unions have no case for "edit of an
  inactive record", so the design must either add one or drop the rule.*
- **A-SCOPE-EDIT.** `coordinacion` cannot move an Asignatura to another Carrera;
  administrador and secretaria can (proposal A11 only fixes the coordinacion
  side). *Assumption.*
- **A-NOOP.** A no-change submit and a repeated deactivation or reactivation
  write nothing and no audit row. *Assumption.*
- **A-DOC-FIELDS.** The Docentes list shows name, `login`, `Correo`, state, and
  a link to `/users`; no `Cif`, no phone, no credential field. *Assumption (data
  minimisation); `login` follows the design's list item.*
- **A-CONC.** Concurrency is last-write-wins; no optimistic version check. The
  simpler option was chosen. Catalog writers are serialised (CM-NFR-4), so a
  precondition checked by a write cannot be invalidated before it commits. This
  replaces the earlier residual that a race between creating an active Grupo and
  deactivating its Asignatura could produce an inconsistent result.
- **A-BUSY.** A write that cannot start within a bounded wait reports "busy, try
  again" and writes nothing (CM-NFR-4). The wait duration and the mechanism are
  design decisions. *Assumption taken from the design; not confirmed by the
  owner.*
- **A-CARRERA-REFUSE.** A `coordinacion` create or edit that names a Carrera
  other than its own is refused, rather than having the value silently ignored
  (CM-SCOPE-3). Proposal A11 is satisfied either way. *Assumption taken from the
  design; not confirmed by the owner.*
- **A-AUD-IMP.** An import-driven reactivation of an Asignatura is audited per
  record, in addition to two counters on the import-level record (see the
  `audit-log` and `catalog-excel-import` deltas). Proposal open question 1 left
  this to the spec. *Assumption taken from the design (departure P3); not
  confirmed by the owner.*
- **A-C12.** An inactive docente can still resolve in the import (known gap C12
  of the exploration); the module does not change that.
- **Amendment 2026-10-07 (meeting days of a Grupo).** Decided by the owner: the
  days belong to the `Grupo`, not to the `Asignatura`; days only, no hours.
  On 2026-10-07 the owner confirmed the items below as written:
  - **A-DIAS-REQ (confirmed by the owner on 2026-10-07).** At least one day is
    required on manual create and edit (CM-GRP-6); editing a pre-existing Grupo
    without days therefore asks for them.
  - **A-DIAS-REACT (confirmed by the owner on 2026-10-07).** Reactivation and
    deactivation never depend on the days.
  - **A-DIAS-NOSEARCH (confirmed by the owner on 2026-10-07).** The days are
    neither searched nor filtered in the Grupos list (CM-GRP-7).
  - The import-side decisions (A-DIAS-IMP-a to -d, with A-DIAS-IMP-b decided by
    the owner: an empty cell leaves stored days untouched, so the import never
    clears days) are in the `catalog-excel-import` delta. Manual edit remains
    the only way to clear or reduce days, subject to A-DIAS-REQ.
  - Out of scope: the justification-request form, validating
    `FechaInasistencia` against the meeting days, hours, and exposing the
    days to students. A later change will read the days to offer only valid
    dates.
- **Amendment 2026-10-08 (Grupos section on the Asignatura edit page).** Decided
  by the owner: the section lists active and inactive groups; "Add group" is
  always shown while the Asignatura is active and never when inactive (a hint
  replaces it); `/catalog/grupos/new` takes an optional `asignaturaId` that is
  ignored silently in every invalid case. No schema, migration, Server Action,
  audit or import change; the create action's redirect is unchanged.
  - **A-ASG7-ORDER.** Row order (period descending, group number ascending, id
    ascending) mirrors the Grupos list; the owner did not specify it. *Assumption.*
  - **A-ASG7-NOPAGE.** The section is not paged or filtered; one Asignatura has
    few groups. The cap is decided: `ASIGNATURA_GRUPOS_MAX = 100` (design A-AGS-1,
    G-1). *Assumption.*
  - **A-GRP8-OPTIONS.** Preselection applies only to an Asignatura the form
    actually offers; the options list is capped (`CATALOG_OPTIONS_MAX`), so an
    otherwise valid Asignatura beyond the cap is not preselected. *Assumption.*
- **Archived change `merge-grupo-into-asignatura` (2026-10-11).** Grupos are managed
  from inside their Asignatura (UI and routing only, no schema change). The bullets
  above that mention the Grupos list, `/catalog/grupos/new` or Amendment 2026-10-08
  are history. The retired list and URLs are covered by CM-RTE-1; the current rules
  are CM-ASG-7, CM-ASG-9, CM-GRP-9, CM-GRP-10 and CM-GRP-11. Change record:
  `openspec/changes/archive/2026-10-11-merge-grupo-into-asignatura/`.
