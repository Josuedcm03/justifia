# Catalog Management Specification (delta)

> **Prerequisite: `catalog-management` must be archived before this change is
> archived.** The capability `catalog-management` has no main spec yet: it exists
> only as `openspec/changes/catalog-management/specs/catalog-management/spec.md`,
> which becomes `openspec/specs/catalog-management/spec.md` at that archive. This
> delta is written against that file as it stands (with its amendments of
> 2026-10-07, 2026-10-08 and 2026-10-09). Requirement names below are its exact
> titles. "CM-NFR-3 Accessibility floor" is unchanged and not restated.
>
> Vocabulary. A **class** is one `Asignatura` row: a subject code plus a group
> number (decisions D1, D2). A **code** is a `Codigo`; several classes may share it.
> The **subject fields** are `Nombre`, `Carrera` and `HorasTotales`. The
> **docente rule** is "Docente rule: one docente per meeting day within a Codigo"
> of `academic-catalog`. Staff roles, unscoped and scoped actors, "Denied" and
> "Entry point" keep the meaning of the original Purpose. The "scope of a Grupo" of
> that vocabulary no longer exists: the scope of a class is its own `Carrera`.
> Items marked A1-A12 come from the assumed defaults of the proposal, unconfirmed
> by the owner; items marked S5-S8 are spec-level assumptions listed at the end.
>
> Purpose (not a requirement, for the archive editor): the Purpose of the base
> text says staff manage `Asignatura` and `Grupo` records. After this change they
> manage classes (the Asignatura catalog) and read the Docentes list; "Grupo" is
> gone from the module.

## ADDED Requirements

### Requirement: CM-ASG-9 Meeting days of a class in the manual flow (A8)

Each class MUST carry the set of weekdays on which it meets, chosen from a closed
list of seven values: Monday to Sunday. The set has no duplicates, is independent
of the order of selection and is always presented in week order. Only days are
recorded: no start time, end time, classroom or per-date calendar. The create and
edit forms MUST offer a multi-select control that works by keyboard, exposes each
day and its selected state to assistive technology, and shows the selected state in
text or shape and not by colour alone. A manual create or edit MUST be refused,
with nothing written, when no day is selected, with a message saying that at least
one meeting day is required (A8; the import may leave days empty). A value outside
the seven MUST be refused on the server even if the control cannot produce it.
Days follow the class's scope and access rules with no additional rule.
Deactivation and reactivation MUST NOT depend on the days. Day names MUST come from
the `es` and `en` catalogs (CM-I18N-1). A class stored with an empty set of days
(for example one migrated from a subject without groups, or created by the import)
shows no selected day on its edit form without an error, and any edit of it is
refused until a day is selected.

#### Scenario: Create with days

- GIVEN an in-scope actor and valid class data
- WHEN a class is submitted with Wednesday and Monday selected, in that order
- THEN it is created and its days are Monday and Wednesday, shown in week order

#### Scenario: Create without days is refused (A8)

- GIVEN otherwise valid class data and no day selected
- WHEN the create is submitted
- THEN nothing is written, no audit row exists and the days field shows an error
  saying at least one meeting day is required

#### Scenario: Edit changes the days

- GIVEN an active class meeting on Monday
- WHEN the edit selects Monday and Thursday and is submitted
- THEN the class meets on Monday and Thursday

#### Scenario: Class stored with no days

- GIVEN a class with an empty set of days
- WHEN it is opened for edit
- THEN no day is selected, the empty set is not shown as an error, and submitting
  any change without selecting a day is refused as in "Create without days is
  refused"

#### Scenario: Reselecting the same days is a no-change edit

- GIVEN an active class meeting on Monday and Wednesday
- WHEN the edit submits Wednesday and Monday and changes nothing else
- THEN nothing is written, no audit row is created and a "no changes" message is
  shown

#### Scenario: Days-only edit is a real update

- GIVEN an active class and an edit that changes only its days
- WHEN the edit is submitted
- THEN the days are stored, exactly one `asignatura.actualizada` audit row exists
  and its field list contains `dias` and nothing else

#### Scenario: Invalid day value is refused

- GIVEN a hand-crafted request carrying a day value outside the seven
- WHEN the create or edit action runs
- THEN it is refused and nothing is written

#### Scenario: Deactivate and reactivate ignore the days

- GIVEN an inactive class with an empty set of days whose docente, if any, is
  active and causes no docente-rule conflict
- WHEN it is reactivated
- THEN it is active and its days are still empty

#### Scenario: Control is accessible

- GIVEN the class form
- WHEN it is navigated with the keyboard only
- THEN every day can be reached, selected and cleared, and each day exposes its
  name and selected state

### Requirement: CM-ASG-10 Docente of a class and the docente rule in manual writes (D5, D6, A10)

The docente of a class is optional (D5). The create and edit forms MUST offer the
active users with role `docente` and an explicit "no docente" choice, so that a
docente can be left empty on create and cleared on edit. A manual create, an edit
that changes the docente or the days, and a reactivation MUST be refused, with
nothing stored, when the result would break the docente rule (D6). The refusal
MUST name a conflicting group number of the same code (it MAY name all of them),
say that the docente already teaches that group on a shared day, and say what to do
(choose another docente or change the days). For a create or an edit the message
MUST be a field-level error on the docente field, with the submitted values kept;
for a reactivation it is the result message of the action. The check MUST run
inside the write transaction, after the right to write is held. A class without
docente, a class with no recorded days and an inactive class never cause a
conflict. A violation that reaches the database anyway (a race) MUST be reported
with the same refusal, never as a server error, and write no audit row.

#### Scenario: Create conflicting with a sibling is refused

- GIVEN active (MAT101, "1") with D1 on Monday and Wednesday
- WHEN a class (MAT101, "2") with D1 on Wednesday is submitted
- THEN it is refused with an error on the docente field naming group "1"
- AND nothing is stored and no audit row exists

#### Scenario: English refusal text

- GIVEN the refusal above in the `en` locale
- WHEN the message is shown
- THEN it reads "This docente already teaches group 1 of this subject on a shared
  day. Choose another docente or change the days."

#### Scenario: Edit of docente or days is refused when it breaks the rule

- GIVEN active (MAT101, "1") D1 on Monday, (MAT101, "2") D2 on Monday and
  (MAT101, "3") D1 on Tuesday
- WHEN (MAT101, "2") is edited to docente D1, or (MAT101, "3") is edited to add
  Monday
- THEN each edit is refused naming group "1" and the class is unchanged

#### Scenario: Reactivation that would break the rule is refused

- GIVEN inactive (MAT101, "2") with D1 on Monday and active (MAT101, "1") with D1
  on Monday
- WHEN (MAT101, "2") is reactivated
- THEN it is refused with a message naming group "1", it stays inactive and no
  audit row exists

#### Scenario: Same docente without a shared day is allowed

- GIVEN active (MAT101, "1") with D1 on Monday
- WHEN (MAT101, "2") with D1 on Tuesday is created
- THEN it is created

#### Scenario: No docente never conflicts

- GIVEN active (MAT101, "1") with no docente on Monday
- WHEN (MAT101, "2") with no docente on Monday is created
- THEN it is created

#### Scenario: Clearing the docente is allowed

- GIVEN an active class with docente D1
- WHEN the edit chooses "no docente"
- THEN the class has no docente and exactly one audit row names `docenteId`

#### Scenario: Racing creates

- GIVEN two creates that are each valid alone but together break the rule, racing
- WHEN the second one is processed
- THEN it is refused with the docente-rule message, not as a server error, and no
  audit row exists for it

### Requirement: CM-ASG-11 Subject fields propagate to every class of the code (D9)

Editing `Nombre`, `HorasTotales` or `Carrera` of a class whose code has other
class rows MUST update the same fields on EVERY row of that code, active and
inactive, in the same transaction, under the same right to write, and MUST be
audited (see `audit-log`). Editing no subject field touches no other row. Creating
a class for a code that already exists MUST give the new row the subject fields
stored for that code; the values submitted for those three fields are not stored on
the new row and do not change the other rows (S5). Before such a propagating edit
is stored, the user MUST be told how many OTHER class rows of the code will change
and MUST confirm explicitly; the confirmation is part of the request, and a
propagating edit submitted without it MUST be refused with nothing stored. An edit
of a code with a single class needs no confirmation. The confirmation mechanism is
a design decision, MUST be keyboard accessible, and MUST NOT need a new Dialog,
AlertDialog or Tabs primitive. If any row of the code cannot be written, the whole
edit MUST roll back. All rows of a code belong to one `Carrera`, so a scoped actor
never reaches a row outside its scope by propagation.

#### Scenario: Edit reaches every row, active and inactive

- GIVEN code MAT101 with classes "1", "2" (active) and "3" (inactive), all named
  "Calc"
- WHEN class "2" is edited to `Nombre` "Calculus" and the user confirms
- THEN all three rows are named "Calculus" and the list shows the new name

#### Scenario: The user is told how many others change

- GIVEN the same code and an edit of the hours of class "2"
- WHEN the confirmation is shown
- THEN it states that 2 other classes will change and nothing is stored yet

#### Scenario: Unconfirmed propagating edit is refused

- GIVEN the same edit submitted by a hand-crafted request without the confirmation
- WHEN the action runs
- THEN it is refused, no row changes and no audit row exists

#### Scenario: Single-class code needs no confirmation

- GIVEN a code with one class and an edit of its `Nombre`
- WHEN the edit is submitted
- THEN it is stored without a confirmation step

#### Scenario: Edit of docente or days does not propagate

- GIVEN a code with three classes and an edit that changes only the docente of one
- WHEN it is submitted
- THEN only that class changes and no confirmation is asked

#### Scenario: Failure rolls back every row

- GIVEN a propagating edit whose write fails on one sibling
- WHEN the transaction ends
- THEN no row of the code changed and no audit row exists

#### Scenario: A new group takes the stored fields (S5)

- GIVEN a code with stored `Nombre` "Calculus" and 64 hours
- WHEN a class (MAT101, "4") is created submitting `Nombre` "Other" and 80 hours
- THEN the new class and every other row carry "Calculus" and 64 hours

#### Scenario: Carrera moved by an unscoped actor

- GIVEN a `secretaria` editing the `Carrera` of class "1" of a code with three
  classes and confirming
- WHEN the edit is stored
- THEN all three rows belong to the new `Carrera`

### Requirement: CM-ASG-12 The class list shows one row per class

The list at `/catalog/asignaturas` MUST show one row per class with these columns,
in this order: code, group number, name, career, hours, docente, days, status. The
docente cell MUST show the docente's name, or a single hyphen `-` when the class
has no docente. The days cell MUST show the meeting days in week order, using the
day names of the user's language (a short form is acceptable if the full name
remains available to assistive technology); a class with an empty set MUST show a
"days not set" text, never an error and never a blank cell. The status MUST be a
word, not colour alone. Rows are ordered by code ascending, then group number
ascending, then id ascending (S7). The days are not a filter. This requirement
replaces the "Groups" column and the days column of the former Grupos list.

#### Scenario: Row shows every column

- GIVEN an active class (MAT101, "2", "Calculus", carrera X, 64 hours, docente
  Ana, Monday and Wednesday)
- WHEN the list is opened
- THEN its row shows those values in the column order above and the status word

#### Scenario: Class without docente shows a hyphen

- GIVEN a class with no docente
- WHEN the list is opened
- THEN its docente cell is `-`

#### Scenario: Days in week order and empty set

- GIVEN a class stored with Friday and Monday, and a class with no days
- WHEN the list is opened
- THEN the first shows Monday then Friday and the second shows the "days not set"
  text with no error styling or announcement

#### Scenario: Both locales

- GIVEN a class meeting on Saturday
- WHEN the list is opened in `es` and in `en`
- THEN the row shows the Saturday name of that language

#### Scenario: Order

- GIVEN classes (B, "1"), (A, "2"), (A, "1")
- WHEN the list is opened
- THEN the order is (A, "1"), (A, "2"), (B, "1")

### Requirement: CM-ASG-13 Origin of a class

Every class MUST carry an origin that is either `importacion` or `manual` (see
`academic-catalog`). A manual create MUST record `manual`. The origin MUST be set
once at creation and MUST NOT be rewritten by any edit, deactivation or
reactivation, manual or by import. Migrated classes keep the origin of the group
they derive from. This requirement replaces "CM-GRP-5 Origin of a Grupo".

#### Scenario: Origin is recorded and stable

- GIVEN a class created manually
- WHEN it is edited, deactivated, reactivated and then updated by an import that
  lists it
- THEN its origin is still `manual`

#### Scenario: Import-created class

- GIVEN a class created by the import
- WHEN it is later edited by hand
- THEN its origin is still `importacion`

### Requirement: CM-RTE-1 The Grupos routes and sidebar entry are gone (A11)

After this change `/catalog/grupos`, `/catalog/grupos/new` and
`/catalog/grupos/{id}/edit` MUST answer with the application's not-found outcome
for an authenticated staff user, with no redirect to `/catalog/asignaturas` (A11).
The Asignaturas edit page MUST have no Grupos section and no "Add group" link. The
sidebar MUST have no Grupos entry. The Docentes page `/catalog/docentes` is
unchanged. No module serves, links to or builds a Grupo form, list or action.

#### Scenario: Old routes answer not found (table-driven)

| Path |
|---|
| `/catalog/grupos` |
| `/catalog/grupos/new` |
| `/catalog/grupos/42/edit` |

- GIVEN an authenticated `secretaria`
- WHEN the path from the row is requested
- THEN the response is the not-found outcome and not a redirect

#### Scenario: Edit page has no Grupos section

- GIVEN an active class in scope
- WHEN its edit page is opened
- THEN there is no Grupos section and no link to a group form

#### Scenario: Docentes page is unchanged

- GIVEN a staff actor
- WHEN `/catalog/docentes` is opened
- THEN it behaves as specified in "CM-LST-1 Lists, filters, search and
  pagination"

## MODIFIED Requirements

### Requirement: CM-ACC-1 Role matrix for every operation

The module MUST be available to the staff roles only. Operations are list, view,
create, edit, deactivate and reactivate on classes (the Asignatura catalog), and
list on Docentes. The right MUST be a predicate derived from the existing role
hierarchy in `permissions.ts` (the roles for which account creation is available),
not a second hand-written role list. Authorization MUST be enforced on the server
for every entry point, independently of what the sidebar shows.
(Previously: the operations covered `Asignatura` and `Grupo`.)

#### Scenario: Role matrix (table-driven)

| Role | Classes (all six operations) | Docentes list |
|---|---|---|
| `administrador` | allowed, all records | allowed |
| `coordinacion` | allowed, only within own `Carrera` (CM-SCOPE) | allowed |
| `secretaria` | allowed, all records | allowed |
| `docente` | denied | denied |
| `estudiante` | denied | denied |
| anonymous | denied (to `/login`) | denied (to `/login`) |

- GIVEN a caller with the role from the row
- WHEN they invoke an operation through its page or its server action, including a
  hand-crafted request
- THEN the outcome is the one in the row, and a denied caller causes no read of
  module data and no write

#### Scenario: Denial destinations

- GIVEN a `docente`, an `estudiante` and an unauthenticated caller
- WHEN each requests `/catalog/asignaturas`
- THEN the first two are redirected to `/denied` and the third to `/login`

#### Scenario: Forced password change comes first

- GIVEN a staff user whose account requires a password change
- WHEN they request any module page or action
- THEN they are sent to the forced password change and nothing is read or written

### Requirement: CM-ACC-2 Authorization precedes the request body

Every module server action MUST verify authentication, the role predicate and the
actor's scope before reading `FormData` or any submitted field. A denied caller
MUST cause no parsing of input and no write.
(Previously: the example scenario used the create-Grupo form.)

#### Scenario: Denied caller's body is never read

- GIVEN a `docente` submitting a well-formed create-class form
- WHEN the action runs
- THEN the form fields are not read, nothing is written and the caller is
  redirected to `/denied`

### Requirement: CM-SCOPE-1 Carrera scoping of reads and writes

A scoped actor (`coordinacion`) MUST see and change only classes whose own
`Carrera` is the actor's `Carrera`. This MUST hold on every list, every form load
and every action, enforced on the server. Unscoped actors see and manage all
records.
(Previously: also covered `Grupo` records through their `Asignatura`.)

#### Scenario: Lists are limited (table-driven)

| Role | Classes shown |
|---|---|
| `administrador` | all |
| `secretaria` | all |
| `coordinacion` of Carrera X | only Carrera X |

- GIVEN classes in Carreras X and Y
- WHEN the actor from the row opens the list
- THEN the rows are exactly those in the row, and the total count and page count
  reflect the same limit

#### Scenario: Foreign record by id is not revealed (table-driven)

| Attempt |
|---|
| open the edit page of a class of another Carrera |
| submit edit, deactivate or reactivate for such a class |

- GIVEN a `coordinacion` actor and a record outside its Carrera, addressed by a
  guessed or hand-crafted id in the URL or the form
- WHEN the attempt from the row is made
- THEN it is refused with the same outcome as for an id that does not exist
  (not-found page, or the same "not found" form error), on pages and on actions
  alike
- AND the denied screen is not used (it is reserved for role denial), nothing is
  written and no audit row exists

#### Scenario: Scope follows the stored Carrera

- GIVEN a `coordinacion` actor whose stored `Carrera` was changed from X to Y
- WHEN the next request to the module is made
- THEN lists and writes use Carrera Y, without requiring a new login

### Requirement: CM-SCOPE-2 Coordinacion without a Carrera

A `coordinacion` actor with no stored `Carrera` MUST see an explanatory empty state
on the list instead of data, MUST NOT be offered any option in any select, and MUST
have every write refused with a message stating that the account has no Carrera
assigned and who to ask to fix it.
(Previously: also on `/catalog/grupos`.)

#### Scenario: Empty state

- GIVEN a `coordinacion` actor with no Carrera
- WHEN they open `/catalog/asignaturas`
- THEN no record is listed and an explanatory empty state is shown, distinct from
  the "no results" empty state

#### Scenario: Writes refused

- GIVEN the same actor and a hand-crafted create, edit, deactivate or reactivate
  request for any record
- WHEN the action runs
- THEN it is refused with the no-Carrera message and nothing is written

### Requirement: CM-SCOPE-3 Carrera of a created or edited Asignatura

When a scoped actor creates a class, the new row MUST belong to the actor's own
`Carrera`; a request that omits the `Carrera` gets the actor's own, and a request
that names a different `Carrera` MUST be refused with nothing written. A scoped
actor MUST NOT move a class to another `Carrera`: an edit request naming a
different `Carrera` MUST be refused with nothing written (see assumption
A-CARRERA-REFUSE). An unscoped actor MAY choose any existing `Carrera` on create
and on edit; on an edit it applies to every row of the code (CM-ASG-11), and on a
create for an existing code the code's stored `Carrera` is used (CM-ASG-11).
(Previously: the text spoke of an `Asignatura` and had no propagation.)

#### Scenario: Coordinacion creates in own Carrera

- GIVEN a `coordinacion` actor of Carrera X submitting a create form that names no
  Carrera, or names Carrera X
- WHEN the action runs
- THEN the new class belongs to Carrera X

#### Scenario: Coordinacion cannot create in another Carrera

- GIVEN a `coordinacion` actor of Carrera X submitting a create form carrying
  Carrera Y
- WHEN the action runs
- THEN it is refused, nothing is written and no audit row exists

#### Scenario: Coordinacion cannot move a class

- GIVEN a `coordinacion` actor and a class of its Carrera
- WHEN an edit request carries another Carrera
- THEN it is refused, the Carrera is unchanged, nothing is written and no audit
  row exists

#### Scenario: Unscoped actor assigns a Carrera

- GIVEN a `secretaria`
- WHEN they create a class for a new code choosing an existing Carrera
- THEN it is created in that Carrera

### Requirement: CM-ASG-1 Asignatura fields and validation

Creating or editing a class MUST validate server-side with the same rules as the
import: `Codigo` required, trimmed, at most 32 characters; group number required,
trimmed, at most 12 characters, never numerically normalised (D3); `Nombre`
required, trimmed, at most 160 characters; `HorasTotales` required, an integer
greater than zero; `Carrera` MUST be an existing `Carrera` (selected by id, not by
name); the docente is optional and, when given, MUST be selected by id and be an
existing, active `Usuario` with the `docente` role (A10); the meeting days follow
CM-ASG-9. A new class MUST be created active with origin `manual`. For a code that
already exists, the subject fields come from the code (CM-ASG-11). A failure MUST
refuse the write and show, per field, a message saying what is wrong and what to
enter.
(Previously: `Asignatura` fields only; no group number, docente or days.)

#### Scenario: Valid create

- GIVEN a staff actor in scope
- WHEN they submit a new `Codigo`, group number "1", a `Nombre`, `HorasTotales` 64,
  an existing Carrera and Monday
- THEN the class is created active with origin `manual`, no docente, and appears
  in the list

#### Scenario: Valid create with a docente

- GIVEN an active docente
- WHEN the same form also selects that docente
- THEN the class is created with that docente

#### Scenario: Invalid values are refused (table-driven)

| Field | Value |
|---|---|
| `Codigo` | empty / whitespace only |
| `Codigo` | 33 characters |
| group number | empty / whitespace only |
| group number | 13 characters |
| `Nombre` | empty |
| `Nombre` | 161 characters |
| `HorasTotales` | empty |
| `HorasTotales` | 0 |
| `HorasTotales` | -8 |
| `HorasTotales` | 12.5 |
| `HorasTotales` | "abc" |
| `Carrera` | id that does not exist |
| Docente | id that does not exist |
| Docente | user whose role is not `docente` (each of the four other roles) |
| Docente | inactive `docente` |

- GIVEN otherwise valid data
- WHEN submitted with the value from the row
- THEN nothing is written and the field shows an error message

#### Scenario: Values are trimmed

- GIVEN a `Codigo` submitted as "  MAT101 " and a group number as " 1 "
- WHEN the class is created
- THEN it is stored as ("MAT101", "1")

### Requirement: CM-ASG-2 Codigo is immutable and duplicates are refused

`Asignatura.Codigo` and the group number MUST NOT change after creation (A9): the
edit screen MUST show them read-only and the edit action MUST ignore or refuse any
submitted change. Creating a class whose (`Codigo`, group number) equals an
existing active class MUST be refused as a duplicate. If it equals an existing
inactive class, the create MUST also be refused; creation MUST NOT reactivate
implicitly. A duplicate inside the actor's scope MUST be a field-level error on the
group number field, shown with the same treatment as a validation error (values
kept), naming the whole key; for an inactive match it MAY point to reactivating
the existing class. When the code exists only outside the actor's scope (another
`Carrera`), whether the match is active or inactive, the create MUST be refused
with the generic message on the `Codigo` field, which MUST NOT reveal the state,
the `Carrera`, the group numbers or any data of the existing record. A different
group number under an existing in-scope code is NOT a duplicate (D4). Comparison
follows CM-ASG-6.
(Previously: only `Codigo` was immutable and duplicate, the duplicate message was
on the `Codigo` field, and a second row for a code was always refused.)

#### Scenario: Duplicate of an active class

- GIVEN an active class (MAT101, "1")
- WHEN a create with (MAT101, "1") is submitted
- THEN it is refused with a field-level error on the group number field: "A class
  with this subject code and group number already exists."
- AND the first row is unchanged

#### Scenario: Match with an inactive class

- GIVEN an inactive class (MAT101, "1") inside the actor's scope
- WHEN a create with (MAT101, "1") is submitted
- THEN it is refused with the field-level error: "A class with this subject code
  and group number already exists but is inactive. Reactivate it instead of
  creating it again."
- AND the existing row stays inactive

#### Scenario: Code that exists outside the actor's scope

- GIVEN a `coordinacion` actor and "MAT101" existing, with any groups, active or
  inactive, in another Carrera
- WHEN they create (MAT101, "3")
- THEN it is refused with a field-level error on the `Codigo` field: "A subject
  with this code already exists." which does not name the other Carrera, does not
  say any record is inactive and does not point to reactivation

#### Scenario: Another group of an existing code is allowed

- GIVEN an active class (MAT101, "1") in scope
- WHEN a create with (MAT101, "2") is submitted
- THEN it is created

#### Scenario: Key cannot be edited (A9)

- GIVEN a class (MAT101, "1")
- WHEN an edit request carries `Codigo` "MAT102" or group number "2"
- THEN the stored `Codigo` and group number are unchanged

#### Scenario: Concurrent duplicate

- GIVEN two creates of the same new (`Codigo`, group number) racing
- WHEN the second one hits the uniqueness rule
- THEN it is refused with the duplicate message (no server error, no audit row)

### Requirement: CM-ASG-3 Asignatura edit

Editable fields are `Nombre`, `HorasTotales` and (unscoped actors only) `Carrera`,
which apply to every row of the code (CM-ASG-11), and the docente and the meeting
days (CM-ASG-9, CM-ASG-10). The `Codigo` and the group number are not editable
(CM-ASG-2). A new docente MUST satisfy the same rule as on create. Leaving the
current docente unchanged MUST NOT be refused even if that docente has since
become inactive. An edit that changes no field MUST write nothing, write no audit
row and tell the user that nothing changed. An inactive class MUST NOT be
editable: its edit screen MUST present the record read-only with the reactivate
action, so an edit never silently changes a record that is out of use (rows of the
code that are inactive are still updated by a propagating edit of an active row,
CM-ASG-11).
(Previously: only `Nombre`, `HorasTotales` and `Carrera`; the docente and days
were edited on the Grupo.)

#### Scenario: Edit changes fields

- GIVEN an active class in scope
- WHEN its docente and days are changed and submitted
- THEN both are stored and the list shows the new values

#### Scenario: No-op edit

- GIVEN an active class
- WHEN the form is submitted with its current values
- THEN nothing is written, no audit row is created and a "no changes" message is
  shown

#### Scenario: Inactive record is read-only

- GIVEN an inactive class
- WHEN its edit URL is opened or an edit is submitted
- THEN fields are not editable and the edit is refused with a message saying it
  must be reactivated first

#### Scenario: Invalid new docente

- GIVEN an active class
- WHEN the edit selects a non-docente or inactive user
- THEN it is refused and the class is unchanged

#### Scenario: Unchanged inactive docente does not block

- GIVEN an active class whose docente later became inactive
- WHEN the edit changes only the days
- THEN no docente error is raised

### Requirement: CM-ASG-4 Asignatura deactivation

Deactivating a class MUST set `Activo` false and MUST NOT delete it, nor any
`Inscripcion` row referencing it. It MUST be allowed when `Inscripcion` rows exist;
those rows stay unchanged (downstream readers already exclude inactive classes).
It MUST NOT be refused on account of any other class of the code, including the
last active class of the code, and MUST NOT depend on the state of its docente.
There is no cascade. Deactivation MUST be an explicit confirmation step (CM-UX-1).
Deactivating an already inactive class MUST write nothing and no audit row.
(Previously: deactivating an `Asignatura` was refused while it had active groups;
that rule is withdrawn because there is no child entity.)

#### Scenario: Deactivate a class

- GIVEN an active class in scope
- WHEN a staff actor confirms deactivation
- THEN `Activo` is false, the row remains, and the list default no longer shows it

#### Scenario: Deactivate with enrollments

- GIVEN an active class with 12 inscripciones
- WHEN a staff actor in scope confirms deactivation
- THEN the class is inactive and all 12 inscripciones still exist unchanged

#### Scenario: Last active class of a code

- GIVEN a code whose only active class is (MAT101, "1")
- WHEN it is deactivated
- THEN it succeeds

#### Scenario: Already inactive

- GIVEN an inactive class
- WHEN a deactivate request arrives
- THEN nothing is written, no audit row is created and the user is told it is
  already inactive

### Requirement: CM-ASG-5 Asignatura reactivation

An inactive class in scope MAY be reactivated by a staff actor. It MUST set
`Activo` true and MUST be refused, with no write and no audit row, when: the class
is already active; its docente is present and is not an active user with the
`docente` role (A10; message: the docente must be active first); or reactivating it
would break the docente rule (message naming the conflicting group, CM-ASG-10).
Reactivation MUST NOT depend on the days and MUST NOT change any other class.
(Previously: reactivating an `Asignatura` had no precondition and never touched its
groups; a Grupo's reactivation required an active Asignatura and docente.)

#### Scenario: Reactivate

- GIVEN an inactive class in scope with no docente or an active docente, and no
  conflict
- WHEN a staff actor reactivates it
- THEN it is active and no other class changed

#### Scenario: Refusals (table-driven)

| State | Result |
|---|---|
| docente inactive | refused, message names the docente state |
| docente role not `docente` | refused, message names the docente state |
| docente-rule conflict with an active class | refused, message names the conflicting group |
| class already active | refused, nothing written |

- GIVEN an inactive class (the last row: an active one) with the state from the row
- WHEN reactivation is requested
- THEN it is refused and the class keeps its state

#### Scenario: Empty days do not block

- GIVEN an inactive class with an empty set of days and no conflict
- WHEN it is reactivated
- THEN it is active

### Requirement: CM-ASG-6 Codigo comparison rule

`Codigo` and the group number MUST be trimmed and otherwise compared exactly
(case-sensitive, no other normalisation, never numerically), by the same rule the
Excel import uses for its natural key, so that a manually created class and an
imported class can never be two spellings of one class, nor one spelling matched as
two.
(Previously: only `Codigo`.)

#### Scenario: Exact comparison after trimming

- GIVEN a class (MAT101, "1")
- WHEN a create with (" MAT101 ", " 1 ") is submitted
- THEN it is refused as a duplicate of (MAT101, "1")

#### Scenario: Case differs

- GIVEN a class (MAT101, "1")
- WHEN a create with ("mat101", "1") is submitted
- THEN it is treated as a different code, exactly as the import treats it

#### Scenario: Group number is not numerically normalised

- GIVEN a class (MAT101, "1")
- WHEN a create with (MAT101, "01") is submitted
- THEN it is a different class

### Requirement: CM-LST-1 Lists, filters, search and pagination

`/catalog/asignaturas` and `/catalog/docentes` MUST be paged server-side lists. The
filter is the `status` query parameter with the values `active`, `inactive` and
`all`; its default MUST be `active`, and an unrecognised `status` or page value
MUST fall back to the default or the nearest valid page rather than failing. Each
row MUST show its state as a word ("Active"/"Inactive" in the user's language), not
by colour alone. Search `q` (case-insensitive, partial) MUST cover:

| List | Search fields |
|---|---|
| Classes | `Codigo`, `Nombre`, group number, docente name (S6) |
| Docentes | name, `Correo` |

Page size MUST be the same as in `/users`. The Docentes list MUST show active and
inactive users with role `docente` (default active) and is not carrera-scoped; it
is read-only and MUST link to `/users` for account management; it MUST NOT expose
any credential field (`HashClave`, a password or a temporary password), nor `Cif`.
The columns of the class list are defined in CM-ASG-12.
(Previously: three lists, including `/catalog/grupos`, and Asignaturas searched
`Codigo` and `Nombre` only.)

#### Scenario: Default shows active only

- GIVEN active and inactive classes
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

- GIVEN classes ("MAT101", "Calculus", group "1", docente Ana) and ("FIS200",
  "Physics", group "7", docente Luis)
- WHEN `q` is "calc", then "7", then "luis"
- THEN each search returns only the class that matches that field
- AND the same behaviour holds, per the table, for docentes

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
equivalent, never a GET link. Deactivation MUST require an explicit confirmation
step that names the class (its `Codigo`, group number and `Nombre`) and states that
nothing is deleted and that it can be reactivated. A propagating edit has its own
confirmation (CM-ASG-11). The mechanism (page, inline control) is left to design
but MUST NOT need a new Dialog, AlertDialog or Tabs primitive.
(Previously: the confirmation named an Asignatura or a Grupo and showed the number
of active groups; neither exists any more.)

#### Scenario: GET never mutates

- GIVEN any module URL
- WHEN it is requested with GET, including from a link prefetch
- THEN no record changes state

#### Scenario: Confirmation names the class

- GIVEN a staff actor who chose to deactivate (MAT101, "2")
- WHEN the confirmation step is shown
- THEN it names the code, group number and name, states that nothing is deleted
  and that it can be reactivated, and no change has been made yet

#### Scenario: Cancel leaves the record

- GIVEN the confirmation step
- WHEN the user cancels
- THEN the record is unchanged and no audit row exists

### Requirement: CM-NAV-1 Sidebar reachability

The two destinations Asignaturas and Docentes MUST be further children of the
existing collapsible sidebar "Administración" group, which already holds "Carga de
catálogo" (the import entry) and "Usuarios"; this change does not create, rename or
restructure that group, and the group keeps rendering only when at least one of its
children is visible. The Grupos entry MUST be removed (CM-RTE-1). The two
destinations MUST be reachable there by the three staff roles, and MUST NOT be
shown to `docente` or `estudiante`. The existing import item MUST keep its current
rule (only where `canImportCatalog` is true). No destination may mark itself active
on `/catalog/import`, and `/catalog/import` MUST NOT mark any destination active.
Visibility is a convenience only; CM-ACC-1 is the control.
(Previously: three destinations, Asignaturas, Grupos and Docentes.)

#### Scenario: Visibility per role (table-driven)

| Role | Asignaturas / Docentes | Import item |
|---|---|---|
| `administrador` | visible | not visible |
| `coordinacion` | visible | not visible |
| `secretaria` | visible | visible |
| `docente`, `estudiante` | not visible | not visible |

- GIVEN a signed-in user with the role from the row
- WHEN the sidebar renders
- THEN the items are as shown and there is no Grupos entry

#### Scenario: Active state is exclusive

- GIVEN the path `/catalog/import`
- WHEN the sidebar renders
- THEN only the import item is marked active (with `aria-current`)

### Requirement: CM-I18N-1 Copy in both locales

Every user-visible string of the module (labels, headings, statuses, empty states,
validation and refusal messages, confirmation text) MUST come from the `es` and
`en` catalogs, and both catalogs MUST contain identical key sets, with no key left
for the removed Grupos screens. A refusal message MUST say what happened and what
to do next.
(Previously: the refusal table included "deactivate Asignatura with active groups"
and "reactivate Grupo with inactive parent".)

#### Scenario: Key parity

- GIVEN the `es` and `en` catalogs
- WHEN their key sets are compared
- THEN they are identical

#### Scenario: Refusal messages are actionable (table-driven)

| Refusal | Message must say |
|---|---|
| docente rule (CM-ASG-10) | which group conflicts and to choose another docente or change the days |
| create duplicate of inactive class | that it exists inactive and to reactivate it |
| coordinacion without Carrera | that no Carrera is assigned and who to ask |
| reactivate class with inactive docente | that the docente must be active first |
| write cannot start (busy, CM-NFR-4) | that nothing was saved and to try again |
| class submitted without a day (CM-ASG-9) | that at least one meeting day is required and to select one |
| propagating edit confirmation (CM-ASG-11) | how many other classes change and to confirm |

- GIVEN the refusal from the row
- WHEN it is shown in either locale
- THEN it contains the content from the row

#### Scenario: Day names and days messages exist in both locales

- GIVEN the `es` and `en` catalogs
- WHEN the keys for the seven day names (full and short forms, if used), the "days
  not set" text, the days field label and the days error messages are looked up
- THEN each exists in both catalogs and the full key sets remain identical

### Requirement: CM-NFR-1 Nothing is physically deleted

The module MUST NOT issue a `DELETE` or `TRUNCATE` against `Asignatura`,
`Inscripcion`, `Usuario` or the audit log. "Delete" is `Activo` false.
(Previously: also listed `Grupo`, which no longer exists.)

#### Scenario: Row counts never fall

- GIVEN any sequence of create, edit, deactivate and reactivate operations
- WHEN they complete
- THEN the row count of every table is never lower than before

### Requirement: CM-NFR-2 Concurrent edits

Concurrent edits of one record MUST NOT corrupt it: the last committed write wins
and each write produces its own audit row. Preconditions (duplicate key, docente
rule, docente state, subject-field equality across the code) MUST be evaluated
within the transaction that writes.
(Previously: the preconditions were duplicate key, active-groups count and parent
state.)

#### Scenario: Two edits of one record

- GIVEN two users who opened the same class
- WHEN both submit different `Nombre` values and confirm
- THEN the later commit is stored on every row of the code and two audit records
  exist

#### Scenario: Two writes that together break the rule

- GIVEN two edits, each valid alone, that together would give one docente a shared
  day in two classes of one code
- WHEN both are submitted at the same time
- THEN one is stored and the other is refused with the docente-rule message

### Requirement: CM-NFR-4 Busy outcome when a write cannot start

Catalog writers (every manual write and the import apply) are serialised, so that a
precondition checked by a write cannot be invalidated by another writer before it
commits. A manual write that cannot start within a bounded wait MUST be reported to
the user as "busy, nothing was saved, try again". It MUST write nothing and no
audit row, MUST NOT hang, and MUST be distinguishable from a validation, duplicate,
not-found, docente-rule or unexpected-failure outcome. The mechanism used to
serialise is a design decision and is not specified here.
(Previously: the operation list included the Grupo operations.)

#### Scenario: Busy outcome per operation (table-driven)

| Operation |
|---|
| create class |
| edit class (including a propagating edit) |
| deactivate class |
| reactivate class |

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

### Requirement: CM-AUD-1 Audit of manual writes

Every successful manual create, update, deactivation and reactivation of a class
MUST write its audit row in the same transaction (per `audit-log`); a propagating
edit writes the audit rows defined in `audit-log`. A refused, invalid, no-op or
failed write MUST write none. Details are in the `audit-log` delta.
(Previously: covered `Asignatura` and `Grupo`, exactly one row each.)

#### Scenario: One row per write

- GIVEN a successful manual create of a class
- WHEN the audit log is read
- THEN exactly one new row exists for it

#### Scenario: Refusal writes none

- GIVEN a refused create that breaks the docente rule
- WHEN the audit log is read
- THEN no new row exists

## REMOVED Requirements

### Requirement: CM-ASG-7 Grupos section on the Asignatura edit page

(Reason: there are no groups to list; a group is a class row (D1).)
(Migration: none. The edit page lists no children; sibling classes of a code are
found in the class list, searched by code. See also CM-RTE-1.)

### Requirement: CM-ASG-8 Asignaturas list shows the active groups

(Reason: the "Groups" column aggregated child rows that no longer exist.)
(Migration: replaced by "CM-ASG-12 The class list shows one row per class".)

### Requirement: CM-GRP-1 Grupo fields and validation

(Reason: the `Grupo` entity and `Periodo` are removed (D1, D8).)
(Migration: the group number, docente and days validations move to "CM-ASG-1
Asignatura fields and validation" and "CM-ASG-9". The period rules are dropped.)

### Requirement: CM-GRP-2 Editable Grupo fields

(Reason: no `Grupo`.)
(Migration: replaced by "CM-ASG-3 Asignatura edit" and "CM-ASG-2".)

### Requirement: CM-GRP-3 Grupo deactivation

(Reason: no `Grupo`.)
(Migration: replaced by "CM-ASG-4 Asignatura deactivation".)

### Requirement: CM-GRP-4 Grupo reactivation

(Reason: no `Grupo`; the parent-state refusals have no parent.)
(Migration: replaced by "CM-ASG-5 Asignatura reactivation".)

### Requirement: CM-GRP-5 Origin of a Grupo

(Reason: no `Grupo`; the origin is on the class row.)
(Migration: replaced by "CM-ASG-13 Origin of a class".)

### Requirement: CM-GRP-6 Meeting days of a Grupo in the manual flow

(Reason: the days are a field of the class row (D7).)
(Migration: replaced by "CM-ASG-9 Meeting days of a class in the manual flow
(A8)". The rule "at least one day on manual create and edit" is kept as A8.)

### Requirement: CM-GRP-7 The Grupos list shows the days

(Reason: no Grupos list.)
(Migration: the days column moves to "CM-ASG-12".)

### Requirement: CM-GRP-8 Preselected Asignatura on the new Grupo page

(Reason: the page `/catalog/grupos/new` is gone (A11).)
(Migration: none. A "new class for this code" shortcut is not specified; see the
open questions.)

## Assumptions and open questions

Spec-level assumptions (not in the proposal's list, for the owner to confirm):

- **S5.** Creating a class for an existing code silently uses the stored subject
  fields instead of refusing a submitted value that differs.
- **S6.** The class list searches `Codigo`, `Nombre`, group number and docente name.
- **S7.** The class list is ordered by code, group number, id. Group numbers are
  text, so "10" sorts before "2".
- **S8.** The confirmation of a propagating edit is enforced on the server, not
  only in the form.

Carried assumptions (unconfirmed by the owner): **A8** (the form requires at least
one day, the import does not), **A9** (code and group number are immutable),
**A10** (a given docente must be active with role `docente`), **A11** (old routes
answer not found), **A5** and **A3** through the import figures.

Withdrawn from the base text: A-GRP-2, A-GRP-4 (replaced by A10 and D6), A-RDR-6
(moved to `academic-catalog`, now moot), A-ASG7-ORDER, A-ASG7-NOPAGE and
A-GRP8-OPTIONS (their screens are gone). Retained: A-EDIT-INACTIVE (inactive
records are read-only until reactivated), A-NOOP, A-CONC, A-BUSY, A-CARRERA-REFUSE,
A-DOC-FIELDS, A-C12.

Open questions for design:

1. Whether the class form offers a "new class for this code" shortcut that
   pre-fills the subject fields (S5), or refuses a differing submitted value.
2. The confirmation mechanism of a propagating edit (a second step, an inline
   control) and whether the count it shows splits active and inactive rows.
3. Whether one audit row or one per class is written for a propagated edit
   (proposal question 10; see `audit-log`).
4. Where the docente-rule message is placed for an edit that fails because of the
   days (the docente field is specified; design may add the days field).
5. Owner questions still open: 3 (no record of which term a class row described),
   4 (a class with no days escapes the rule), A5, A6.
6. Behaviour of the old `/catalog/grupos` URLs for an unauthenticated visitor:
   this spec states the not-found outcome for an authenticated staff user only.
