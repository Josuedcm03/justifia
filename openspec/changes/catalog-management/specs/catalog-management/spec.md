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
`Carrera`. This MUST hold on every list, every form load (including the options
offered in selects) and every action, enforced on the server. Unscoped actors
see and manage all records.

#### Scenario: Lists are limited (table-driven)

| Role | Asignaturas shown | Grupos shown |
|---|---|---|
| `administrador` | all | all |
| `secretaria` | all | all |
| `coordinacion` of Carrera X | only Carrera X | only those of Carrera X asignaturas |

- GIVEN asignaturas and grupos in Carreras X and Y
- WHEN the actor from the row opens each list
- THEN the rows are exactly those in the row, and the total count and page
  count reflect the same limit

#### Scenario: Foreign record by id is not revealed (table-driven)

| Attempt |
|---|
| open the edit page of an Asignatura of another Carrera |
| open the edit page of a Grupo whose Asignatura is in another Carrera |
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

#### Scenario: Selects offer only in-scope options

- GIVEN a `coordinacion` actor opening the create-Grupo form
- WHEN the Asignatura options are loaded
- THEN only active asignaturas of its own Carrera are offered

#### Scenario: Scope follows the stored Carrera

- GIVEN a `coordinacion` actor whose stored `Carrera` was changed from X to Y
- WHEN the next request to the module is made
- THEN lists and writes use Carrera Y, without requiring a new login

### Requirement: CM-SCOPE-2 Coordinacion without a Carrera

A `coordinacion` actor with no stored `Carrera` MUST see an explanatory empty
state on every list instead of data, MUST NOT be offered any option in any
select, and MUST have every write refused with a message stating that the
account has no Carrera assigned and who to ask to fix it.

#### Scenario: Empty state

- GIVEN a `coordinacion` actor with no Carrera
- WHEN they open `/catalog/asignaturas` or `/catalog/grupos`
- THEN no record is listed and an explanatory empty state is shown, distinct
  from the "no results" empty state

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

#### Scenario: Match with an inactive record

- GIVEN an inactive Asignatura "MAT101" inside the actor's scope
- WHEN a create with Codigo "MAT101" is submitted
- THEN it is refused with a message that the code exists but is inactive and
  must be reactivated instead
- AND the existing row stays inactive

#### Scenario: Duplicate of a record outside the actor's scope

- GIVEN a `coordinacion` actor and "MAT101" existing, active or inactive, in
  another Carrera
- WHEN they create "MAT101"
- THEN it is refused with the generic duplicate message, which does not name the
  other Carrera, does not say the record is inactive and does not point to
  reactivation

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

### Requirement: CM-GRP-1 Grupo fields and validation

Creating a `Grupo` MUST validate server-side: `Asignatura` selected by id and
MUST be an existing, active `Asignatura` in the actor's scope; `Periodo` MUST
match `YYYY-S1` or `YYYY-S2` exactly (no trimming, no case change);
`NumeroGrupo` required, trimmed, at most 12 characters, never numerically
normalised; `Docente` selected by id and MUST be an existing, active `Usuario`
with the `docente` role. The meeting days MUST be validated as specified in
CM-GRP-6 (amendment 2026-10-07). A new `Grupo` MUST be created active with
origin `manual`. Messages MUST say what is wrong and what to do.

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

#### Scenario: Match with an inactive Grupo

- GIVEN an inactive Grupo (A, `2026-S1`, "1")
- WHEN a create with the same triple is submitted
- THEN it is refused with a message pointing to reactivation, and the existing
  row stays inactive

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

### Requirement: CM-GRP-7 The Grupos list shows the days

Amendment 2026-10-07. Each row of `/catalog/grupos` MUST show the meeting days
of the Grupo, in week order, using the day names of the user's language (a
short form is acceptable if the full name remains available to assistive
technology). A Grupo with an empty set MUST show a "days not set" text, never
an error and never a blank cell. The days are not part of the search fields of
CM-LST-1 and are not a filter.

#### Scenario: Days are listed in week order

- GIVEN a Grupo stored with Friday and Monday
- WHEN `/catalog/grupos` is opened
- THEN its row shows Monday then Friday

#### Scenario: Empty set shows days not set

- GIVEN a Grupo with no days
- WHEN `/catalog/grupos` is opened
- THEN its row shows the "days not set" text and no error styling or
  announcement

#### Scenario: Both locales

- GIVEN a Grupo meeting on Saturday
- WHEN the list is opened in `es` and in `en`
- THEN the row shows the Saturday name of that language

### Requirement: CM-LST-1 Lists, filters, search and pagination

`/catalog/asignaturas`, `/catalog/grupos` and `/catalog/docentes` MUST be
paged server-side lists. The filter is the `status` query parameter with the
values `active`, `inactive` and `all`; its default MUST be `active`, and an
unrecognised `status` or page value MUST fall back to the default or the nearest
valid page rather than failing.
Each row MUST show its state as a word ("Active"/"Inactive" in the user's
language), not by colour alone. Search `q` (case-insensitive, partial) MUST
cover:

| List | Search fields |
|---|---|
| Asignaturas | `Codigo`, `Nombre` |
| Grupos | asignatura `Codigo` and `Nombre`, `Periodo`, `NumeroGrupo`, docente name |
| Docentes | name, `Correo` |

Page size MUST be the same as in `/users`. The Docentes list MUST show active
and inactive users with role `docente` (default active) and is not
carrera-scoped; it is read-only and MUST link to `/users` for account
management; it MUST NOT expose any credential field (`HashClave`, a password or
a temporary password), nor `Cif`.

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
- AND the same behaviour holds, per the table, for grupos and docentes

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

- GIVEN `status=bogus` on any list
- WHEN the page is opened
- THEN it behaves as `status=active`

#### Scenario: Docentes list carries no credential

- GIVEN the Docentes list rendered and its data serialized
- WHEN searched for `HashClave`, a password, a temporary password or `Cif`
- THEN none is present

#### Scenario: Database unavailable

- GIVEN the database cannot be reached
- WHEN any list is opened by an allowed role
- THEN the page renders with an empty table and a status message that the data
  could not be loaded, as `/users` does, and no raw error is shown

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

The three destinations Asignaturas, Grupos and Docentes MUST be added as further
children of the existing collapsible sidebar "Administración" group, which
already holds "Carga de catálogo" (the import entry) and "Usuarios"; this change
does not create, rename or restructure that group, and the group keeps rendering
only when at least one of its children is visible. The three destinations MUST
be reachable there by the three staff roles, and MUST NOT be shown to `docente`
or `estudiante`. The existing import item MUST keep its current rule (only where
`canImportCatalog` is true). No destination may mark
itself active on `/catalog/import`, and `/catalog/import` MUST NOT mark any new
destination active. Visibility is a convenience only; CM-ACC-1 is the control.

#### Scenario: Visibility per role (table-driven)

| Role | Asignaturas / Grupos / Docentes | Import item |
|---|---|---|
| `administrador` | visible | not visible |
| `coordinacion` | visible | not visible |
| `secretaria` | visible | visible |
| `docente`, `estudiante` | not visible | not visible |

- GIVEN a signed-in user with the role from the row
- WHEN the sidebar renders
- THEN the items are as shown

#### Scenario: Active state is exclusive

- GIVEN the path `/catalog/import`
- WHEN the sidebar renders
- THEN only the import item is marked active (with `aria-current`)

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
