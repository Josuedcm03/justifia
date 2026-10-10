# Academic Catalog Specification (delta)

> **Prerequisite: `catalog-management` must be archived before this change is
> archived.** This delta is written against the state of
> `openspec/specs/academic-catalog/spec.md` AFTER the delta of
> `openspec/changes/catalog-management/specs/academic-catalog/spec.md` has been
> applied to it. Requirement names below are the exact titles that state will
> carry. Requirements not named here are unchanged. "Additive schema and
> existing-data safety", "Additive schema for catalog management" and "Additive
> schema for meeting days (AC-DIAS-ADD)" describe migrations `0003`, `0005` and
> `0006`, which are already applied; they stay as history.
>
> Vocabulary. A **class** is one `Asignatura` row: one subject code plus one
> group number (decisions D1, D2). A **code** is a `Codigo`; several class rows
> may share it. The **subject fields** are `Nombre`, `CarreraId` and
> `HorasTotales`. Exact column names are design decisions; this spec says "group
> number", "docente", "days" and "origin". Items marked A1-A12 come from the
> assumed defaults of the proposal and are unconfirmed by the owner; items marked
> S1-S2 are spec-level assumptions listed at the end.
>
> Purpose and entity table (not requirements, for the archive editor): the
> Purpose sentence and the entity table of the base spec still name `Grupo`
> (natural key `AsignaturaId`, `Periodo`, `NumeroGrupo`) and `Asignatura`
> (natural key `Codigo`, unique). After this change the table has two rows:
> `Asignatura` (natural key `Codigo` plus group number) and `Inscripcion`
> (composite key: student plus class row). "`Facultad` and `Carrera` have no
> `Activo` column" stays.

## ADDED Requirements

### Requirement: No Grupo entity and no Periodo (D1, D8)

After this change the data model MUST contain no `Grupo` entity and no `Periodo`
anywhere. A class is identified by its code and its group number alone. One term
is current at a time: each term's catalog replaces the previous one, and the
system keeps no record of which term a class row described (a class row is reused
when the same code and group number return in a later term; proposal question 3
is still with the owner).

#### Scenario: Structural absence of Grupo and Periodo

- GIVEN the schema after the migration of this change
- WHEN its tables and columns are inspected
- THEN there is no table `Grupo` and no column named `Periodo` in any table
- AND no foreign key anywhere references a table `Grupo`

#### Scenario: Same code and group number in a later term is the same row

- GIVEN a stored class (MAT101, "1") active this term
- WHEN next term's catalog lists (MAT101, "1") with another docente
- THEN no second row is created; the stored row is the one updated

### Requirement: Docente role integrity of Asignatura.DocenteId (D5)

A class MAY have no docente: its docente is nullable. When it is present it MUST
reference a `Usuario` whose role is `docente`; a value that resolves to a user of
any other role, or to no user, MUST be rejected. This integrity MUST be enforced
by the application, because the role lives on a separate lookup table; the
database MAY add further guards. One docente MAY teach several classes, including
several groups of one code (subject to the docente rule).

#### Scenario: Docente user is accepted

- GIVEN a `Usuario` with role `docente`
- WHEN a class is stored with that user as docente
- THEN it is accepted

#### Scenario: Non-docente user is rejected (table-driven)

| Role of referenced user |
|---|
| `estudiante` |
| `secretaria` |
| `coordinacion` |
| `administrador` |

- GIVEN a `Usuario` with the role from the row
- WHEN a class referencing it as docente is stored
- THEN the write is refused

#### Scenario: Unknown docente is rejected

- GIVEN a docente id that matches no `Usuario`
- WHEN a class referencing it is stored
- THEN the write is refused

#### Scenario: A class without docente is valid

- GIVEN otherwise valid class data and no docente
- WHEN it is stored
- THEN it is accepted, active, with an empty docente

#### Scenario: One docente teaches several groups

- GIVEN classes (MAT101, "1") on Monday and (MAT101, "2") on Tuesday
- WHEN both are stored with the same docente
- THEN both are accepted

### Requirement: Manual writes require an active docente when one is given (A10)

A manual create of a class that names a docente, a manual change of a class's
docente to another user, and a manual reactivation of a class that has a docente
MUST require that the docente is an active `Usuario` whose role is `docente`
(A10). This is enforced by the application, on top of "Docente role integrity of
Asignatura.DocenteId". Leaving the docente empty is always valid. Leaving the
current docente unchanged on an edit MUST NOT be refused even if that docente has
since become inactive. A manual deactivation is never refused on account of the
docente. The import is not subject to the active-docente check (known gap: an
inactive matched docente still resolves in the import; fixing it belongs to the
users module).

#### Scenario: Docente state refusals (table-driven)

| Manual write | Docente state | Result |
|---|---|---|
| create class | inactive | refused |
| create class | none | accepted |
| change docente | new docente inactive | refused |
| change docente | cleared | accepted |
| reactivate class | docente inactive | refused |
| reactivate class | none | not refused on this account |
| deactivate class | docente inactive | accepted |

- GIVEN the docente state from the row
- WHEN the manual write is attempted
- THEN the outcome is as shown and a refusal stores nothing

#### Scenario: Unchanged inactive docente does not block an edit

- GIVEN an active class whose docente later became inactive
- WHEN an edit changes only the days
- THEN no docente error is raised

### Requirement: Class origin marker (A3)

A class MUST carry an `Origen` of `importacion` or `manual`, set at creation and
never rewritten by any later edit, deactivation or reactivation, manual or by
import. A value other than the two MUST be rejected by the database. A migrated
class MUST keep the origin its `Grupo` had. The meaning is the one the `Grupo`
origin had: how the row was created.

#### Scenario: Origin values (table-driven)

| Origen written | Result |
|---|---|
| `importacion` | accepted |
| `manual` | accepted |
| any other text | rejected |

- GIVEN otherwise valid class data
- WHEN stored with the origin from the row
- THEN the outcome is as shown

#### Scenario: Origin survives updates

- GIVEN a `manual` class
- WHEN it is updated by any means, including an import that lists it
- THEN its origin is still `manual`

#### Scenario: Migrated class keeps its group's origin

- GIVEN a `Grupo` with origin `manual` before the migration
- WHEN the migration is applied
- THEN the class row derived from it has origin `manual`

### Requirement: Class meeting days (AC-DIAS)

The meeting days belong to the class row (D7), not to the code: two groups of one
code may meet on different days or on the same day (D4). A class MUST carry a
set of meeting days drawn from a closed list of seven weekdays, Monday to Sunday,
with the semantics and the representation they have today. The set MUST NOT
contain a value twice, MUST NOT depend on order, MAY be empty, and MUST be
presented in week order. A value outside the seven MUST be rejected by the
application. Only days are stored: no start or end time, no classroom, no
per-date calendar. An empty set means "days not recorded" and is valid for every
class, including active ones; a class with no recorded days never conflicts under
the docente rule. The days are part of the class row and not of its key.
Active-only readers apply to the days exactly as to the rest of the class.

#### Scenario: Set semantics (table-driven)

| Days written | Days stored and presented |
|---|---|
| Wednesday, Monday | Monday, Wednesday |
| Monday, Monday | Monday |
| none | empty set |
| Monday to Sunday | all seven, in week order |
| a value outside the seven | rejected |

- GIVEN otherwise valid class data
- WHEN stored with the days from the row
- THEN the outcome is as shown

#### Scenario: Days are not part of the key

- GIVEN a stored class (A, "1") meeting on Monday
- WHEN another class (A, "1") meeting on Tuesday is stored
- THEN the write is refused as a duplicate

#### Scenario: Two groups of one code differ in days

- GIVEN classes (A, "1") on Monday and (A, "2") on Friday
- WHEN both are stored
- THEN both are accepted and each keeps its own days

#### Scenario: Two groups of one code share a day

- GIVEN classes (A, "1") and (A, "2") both on Monday, with different docentes,
  or with no docente on at least one of them
- WHEN both are stored
- THEN both are accepted

### Requirement: Subject fields are identical across the rows of one Codigo (D9)

For every `Codigo`, all stored class rows, active and inactive, MUST carry the
same `Nombre`, `CarreraId` and `HorasTotales`. This is an application invariant,
not a table constraint: every writer (manual create, manual edit, import apply)
MUST preserve it, and the migration MUST start it consistent by copying the
subject fields from the parent `Asignatura` row to every class row derived from
it. A writer that adds a class to an existing code MUST give it the values stored
for that code. A writer that changes a subject field MUST change it on every row
of the code in the same transaction (see `catalog-management` and
`catalog-excel-import`).

#### Scenario: Migration starts consistent

- GIVEN a subject with three groups before the migration
- WHEN the migration is applied
- THEN its three class rows carry the same `Nombre`, `CarreraId` and
  `HorasTotales` as the parent row had

#### Scenario: Read-only consistency query finds no disagreement

- GIVEN a database after the migration and after any sequence of supported
  writes
- WHEN a read-only query groups class rows by `Codigo` and counts distinct
  (`Nombre`, `CarreraId`, `HorasTotales`) combinations
- THEN no `Codigo` has more than one combination

#### Scenario: A new group takes the stored subject fields

- GIVEN a code with stored `Nombre` "Calculus", carrera X and 64 hours
- WHEN a class is added for that code
- THEN the new row carries "Calculus", carrera X and 64 hours

### Requirement: Docente rule: one docente per meeting day within a Codigo (D6)

Two class rows of one `Codigo` that are both active, both have a docente and
share at least one meeting day MUST have different docentes. Equivalently, within
one code a docente MUST NOT be assigned to two active classes that meet on a
common weekday. The rule has no effect when:

- either class has no docente;
- either class has no recorded days (empty set);
- either class is inactive;
- the classes belong to different codes;
- the two classes have the same docente but no shared day.

The rule MUST be evaluated on every manual create, on every edit that changes the
docente or the days, on every reactivation, and by the import over the state the
apply would leave (see `catalog-excel-import`). A write that would violate it
MUST be refused with nothing stored.

#### Scenario: Overlap rule (table-driven)

| Class 1 docente, days | Class 2 docente, days | Result |
|---|---|---|
| D1, Mon+Wed | D1, Wed+Fri | violation |
| D1, Mon | D1, Tue | allowed |
| D1, Mon | D2, Mon | allowed |
| D1, Mon | none, Mon | allowed |
| none, Mon | none, Mon | allowed |
| D1, Mon | D1, no days | allowed |
| D1, Mon | D1, Mon, class 2 inactive | allowed |

- GIVEN two classes of one code, class 1 active, with the values from the row
- WHEN class 2 is stored
- THEN the outcome is as shown

#### Scenario: Another code is independent

- GIVEN D1 teaching (A, "1") on Monday
- WHEN (B, "1") on Monday is stored with D1
- THEN it is accepted

#### Scenario: Reactivation re-checks the rule

- GIVEN an inactive class (A, "2") with D1 on Monday and an active class
  (A, "1") with D1 on Monday
- WHEN (A, "2") is reactivated
- THEN the write is refused and (A, "2") stays inactive

#### Scenario: Docente or days edit re-checks the rule

- GIVEN active classes (A, "1") D1 on Monday, (A, "2") D2 on Monday and
  (A, "3") D1 on Tuesday
- WHEN (A, "2") is edited to docente D1, or (A, "3") is edited to add Monday
- THEN each edit is refused and the class is unchanged

### Requirement: The docente rule is also enforced by the database

The docente rule MUST be enforced by the database as the last line of defence,
independently of any application pre-check, so that a write that bypasses the
application cannot leave two active classes of one code with the same docente on
a shared weekday. The enforcement MUST cover insert and update of the docente,
the days or the active state, and MUST NOT reject any state the rule allows
(empty days, no docente, inactive rows, same docente without a shared day). The
enforcement is not deferrable: statement order inside one transaction matters
(see the apply order in `catalog-excel-import`).

#### Scenario: Direct violating insert is rejected

- GIVEN an active class (A, "1") with D1 on Monday
- WHEN a row (A, "2") active with D1 on Monday and Tuesday is inserted by a
  statement that skips the application
- THEN the database rejects it and no row is added

#### Scenario: Direct violating reactivation is rejected

- GIVEN an inactive class (A, "2") with D1 on Monday and an active (A, "1") with
  D1 on Monday
- WHEN `Activo` of (A, "2") is set true by a direct statement
- THEN the database rejects it

#### Scenario: Allowed states are accepted (table-driven)

| State written |
|---|
| active, no docente, Monday |
| active, D1, no days |
| inactive, D1, Monday |
| active, D1, Tuesday |

- GIVEN an active class (A, "1") with D1 on Monday
- WHEN a second class of code A is stored with the state from the row
- THEN the database accepts it

### Requirement: Merge migration preserves data

The migration of this change MUST turn every existing (`Asignatura`, `Grupo`) pair
into one class row and MUST NOT lose, duplicate or silently alter any other
data. For each `Asignatura`, the existing row MUST be reused for its lowest-id
carried-over `Grupo`, so that its id and its past `asignatura.*` audit rows stay
valid; every other carried-over `Grupo` of that `Asignatura` becomes a new row.
Each class row takes its group number from `NumeroGrupo`, its docente, days and
origin from the `Grupo`, and its subject fields from the parent row. Every
`Inscripcion` row MUST be kept with the same `EstudianteId` and `Activo`, and
MUST point to the class row derived from the `Grupo` it pointed to. Rows of every
other table (`Facultad`, `Carrera`, `Rol`, `Usuario`, the audit log) MUST be
unchanged. After the class rows and `Inscripcion` are in place the `Grupo` table,
with its `Periodo` column and its indexes, MUST be dropped (inside the same
migration or a later one is a design decision). The migration MUST run in one
transaction and roll back whole on any failure.

#### Scenario: One subject, two groups

- GIVEN `Asignatura` row 10 ("MAT101") with `Grupo` rows 7 (number "1") and 9
  (number "2")
- WHEN the migration is applied
- THEN class (MAT101, "1") keeps the id 10 and class (MAT101, "2") is a new row
- AND both carry the subject fields of row 10

#### Scenario: Inscripcion is re-pointed and none is lost

- GIVEN 12 `Inscripcion` rows in `Grupo` 9
- WHEN the migration is applied
- THEN 12 `Inscripcion` rows exist for the same students with the same `Activo`,
  all pointing to the class row derived from `Grupo` 9

#### Scenario: Other tables are untouched

- GIVEN a populated database
- WHEN the migration is applied
- THEN every row of `Facultad`, `Carrera`, `Rol`, `Usuario` and the audit log is
  unchanged

#### Scenario: A failure leaves the schema as before

- GIVEN a migration that fails after some statements ran
- WHEN the transaction ends
- THEN schema and data are exactly as before, including the `Grupo` table

### Requirement: Merge migration key collisions (A2)

Once `Periodo` is gone, two `Grupo` rows of one `Asignatura` with the same
`NumeroGrupo` collide on the class key. For each collision the migration MUST
carry over exactly one row: the active one; when neither or both are active, the
one of the most recent period (A2). The other rows are not carried over and MUST
be listed in the rehearsal report. If a row that is not carried over has
`Inscripcion` rows, the migration MUST stop (A2). If the rule cannot choose (for
example two active rows of the same period), the migration MUST stop and list the
collision (S1).

#### Scenario: Collision resolved by activity

- GIVEN `Grupo` (A, `2025-S2`, "1") active and (A, `2026-S1`, "1") inactive
- WHEN the migration is applied
- THEN the class (A, "1") carries the values of the `2025-S2` row
- AND the other row is listed in the rehearsal report as not carried over

#### Scenario: Collision resolved by period

- GIVEN `Grupo` (A, `2025-S2`, "1") inactive and (A, `2026-S1`, "1") inactive
- WHEN the migration is applied
- THEN the class (A, "1") carries the values of the `2026-S1` row

#### Scenario: Dropped row with enrollments stops the migration

- GIVEN a collision whose non-carried row has 3 `Inscripcion` rows
- WHEN the migration is attempted
- THEN it stops with a report naming the row and changes nothing

#### Scenario: Unresolvable tie stops the migration (S1)

- GIVEN two active `Grupo` rows of one `Asignatura`, the same number and the same
  period
- WHEN the migration is attempted
- THEN it stops, lists the pair and changes nothing

### Requirement: Migrated activity and default group (A4, A1)

A migrated class MUST be active only when both its `Asignatura` and its `Grupo`
were active (A4); otherwise it MUST be inactive. An `Asignatura` with no `Grupo`
MUST become exactly one class with group number `1`, no docente, no days and the
`Asignatura`'s own `Activo` value (A1).

#### Scenario: Activity table (table-driven)

| Asignatura | Grupo | Migrated class |
|---|---|---|
| active | active | active |
| active | inactive | inactive |
| inactive | active | inactive |
| inactive | inactive | inactive |

- GIVEN the states from the row
- WHEN the migration is applied
- THEN the class is as shown

#### Scenario: Subject without groups gets group 1 (A1)

- GIVEN an active `Asignatura` with no `Grupo` rows
- WHEN the migration is applied
- THEN exactly one class (code, "1") exists for it, active, with no docente and
  no days

### Requirement: Migration preflight and stop conditions

A read-only preflight MUST exist and MUST run without any confirmation. It MUST
report: collisions on the class key (A2), pairs of carried-over active classes
that would violate the docente rule, the number of `Inscripcion` rows, and the
number of `Inscripcion` rows pointing to `Grupo` rows that would not be carried
over. The migration MUST refuse to run, changing nothing, while any finding
remains unresolved: an unresolvable collision, a non-carried row with
enrollments, or a docente-rule violation among the rows that would be active. The
refusal MUST list the offending rows. The migration MUST NOT guess.

#### Scenario: Docente overlap stops the migration

- GIVEN active `Grupo` rows (A, `2026-S1`, "1") and (A, `2026-S1`, "2") with the
  same docente and a shared day
- WHEN the migration is attempted
- THEN it stops, changes nothing and names both groups

#### Scenario: Clean data runs

- GIVEN data with no collision and no overlap
- WHEN the preflight runs and then the migration is applied
- THEN the preflight reports no blocking finding and the migration completes

#### Scenario: The preflight writes nothing

- GIVEN any database
- WHEN the preflight runs
- THEN no row, schema object or audit record changes

### Requirement: Audit history survives the merge

The migration MUST NOT insert, update or delete any row of the audit log. Past
`grupo.*` events keep their action, entity type `Grupo` and the ids they carry,
which no longer resolve to a row; past `asignatura.*` events keep their ids,
which resolve to the class row that reused the `Asignatura` row. No audit row
MUST be rewritten to point to a class.

#### Scenario: Audit log is unchanged

- GIVEN an audit log with `asignatura.*` and `grupo.*` events
- WHEN the migration is applied
- THEN the count and the content of every audit row are unchanged

### Requirement: Destructive migration gates (A12)

Migration `0007` is destructive and irreversible once `Grupo` is dropped. It MUST
be hand-written, MUST have a structural test in the style of the tests of `0005`
and `0006`, MUST be rehearsed on a fresh database branch before the shared
database, and MUST NOT be applied, nor any branch operation run, against the
shared database without the owner's explicit confirmation for that command. A
schema-push command MUST NOT be used. The cutover MUST run in a short maintenance
window with catalog writes stopped (A12), after a backup branch taken
immediately before it. There is no down migration; the way back after the drop is
the backup branch.

#### Scenario: Structural test exists

- GIVEN the repository after the change
- WHEN the test suite runs
- THEN a structural test of `0007` runs and checks the class key, the docente
  rule enforcement, the `Inscripcion` re-pointing and the drop of `Grupo`

#### Scenario: Rehearsal report is complete

- GIVEN the rehearsal on a fresh branch
- WHEN its report is read
- THEN every pre-migration group is either carried over or listed as not carried
  over
- AND the `Inscripcion` count after equals the count before

## MODIFIED Requirements

### Requirement: Asignatura shape and natural key

An `Asignatura` row is one class (D2). It MUST have a `Codigo` (non-empty, at
most 32 characters), a mandatory group number (D3: text, trimmed, non-empty, at
most 12 characters, never numerically normalised), a non-empty `Nombre`, an
existing `CarreraId`, `HorasTotales`, an `Activo` state, an `Origen` (see "Class
origin marker (A3)"), an optional docente (see "Docente role integrity of
Asignatura.DocenteId (D5)") and a set of meeting days (see "Class meeting days
(AC-DIAS)"). `HorasTotales` MUST be an integer greater than zero and MUST NOT be
null. The pair (`Codigo`, group number) MUST be unique, whether the stored row is
active or inactive. `Codigo` alone MUST NOT be unique: one code may have several
groups, on different days or on the same day (D4).
(Previously: `Codigo` was unique on its own and there was no group number.)

#### Scenario: Valid class is stored

- GIVEN an existing carrera
- WHEN a class with a new `Codigo`, group number "1", a `Nombre` and
  `HorasTotales` 64 is stored for it
- THEN it is persisted active and retrievable by (`Codigo`, group number)

#### Scenario: Several groups of one code are allowed

- GIVEN a stored class (MAT101, "1")
- WHEN a class (MAT101, "2") with the same subject fields is stored
- THEN both rows exist

#### Scenario: Duplicate code and group number is rejected

- GIVEN a stored class (active or inactive) (MAT101, "1")
- WHEN a second class (MAT101, "1") is stored
- THEN the write is refused and the first row is unchanged

#### Scenario: Same group number under another code is allowed

- GIVEN a stored class (MAT101, "1")
- WHEN (FIS200, "1") is stored
- THEN it is accepted

#### Scenario: Missing or invalid group number is rejected (table-driven)

| Group number |
|---|
| absent |
| empty |
| whitespace only |
| 13 characters |

- GIVEN otherwise valid class data
- WHEN it is stored with the value from the row
- THEN the write is refused

#### Scenario: Non-positive or missing HorasTotales is rejected (table-driven)

| HorasTotales |
|---|
| 0 |
| -8 |
| absent |

- GIVEN otherwise valid class data
- WHEN it is stored with the value from the row
- THEN the write is refused

#### Scenario: Unknown carrera is rejected

- GIVEN a `CarreraId` that does not exist
- WHEN a class referencing it is stored
- THEN the write is refused

### Requirement: Estudiante role integrity of Inscripcion.EstudianteId

The `Inscripcion` table MUST have the composite key (`EstudianteId`, class row
id), a foreign key from `EstudianteId` to `Usuario`, a foreign key from the class
column to `Asignatura`, and an `Activo` column (the class column name is a design
decision; it was `GrupoId`). Any writer of `Inscripcion` MUST ensure that
`EstudianteId` references a `Usuario` whose role is `estudiante`, and MUST NOT
store a duplicate (`EstudianteId`, class row id) pair; this role integrity MUST
be enforced by the application, because the role lives on a separate lookup
table. This change ships no writer of `Inscripcion`, so the rule is specified for
the future writer and is not enforced by any code in this change.
(Previously: the key and the foreign key targeted `Grupo`.)

#### Scenario: No code path in this change writes Inscripcion

- GIVEN every production module under `src`
- WHEN it is checked structurally for an insert, update or delete against the
  `inscripcion` table
- THEN none is found; the table is only read

#### Scenario: Inscripcion targets the class row

- GIVEN the schema after the migration
- WHEN the foreign keys of `Inscripcion` are inspected
- THEN the class column references `Asignatura` and none references `Grupo`

**Deferred behaviour (not a scenario of this change): a future writer enforces
the estudiante role.** The change that introduces a writer of `Inscripcion` MUST
turn the table below into scenarios with tests.

| Role of referenced user | Expected result |
|---|---|
| `estudiante` | accepted and active |
| `docente` | refused |
| `secretaria` | refused |
| `coordinacion` | refused |
| `administrador` | refused |

- GIVEN a `Usuario` with the role from the row and an existing class
- WHEN a future writer stores an inscripcion referencing it as `EstudianteId`
- THEN the result is the one in the row, and storing the same (`EstudianteId`,
  class row id) pair twice is refused with exactly one row kept

### Requirement: Active-only reads for downstream consumers

`Asignatura` (class) and `Inscripcion` rows MUST carry `Activo`. Catalog read
functions intended for downstream consumers (RF-03 docente/class resolution,
RF-31 enrollment verification) MUST return only rows where `Activo` is true, and
MUST NOT treat an inactive row as evidence of a current class or enrollment. An
active class without docente MUST still be returned, with no docente, and MUST
NOT make the reader fail. Inactive rows MUST remain stored.
(Previously: the readers covered `Grupo`, `Inscripcion` and `Asignatura`, and a
`Grupo` of an inactive `Asignatura` was hidden; with one row per class that
parent/child condition no longer exists.)

#### Scenario: Inactive enrollment does not verify

- GIVEN an inscripcion of estudiante E in class C with `Activo` false
- WHEN enrollment of E in C is queried through the catalog read path
- THEN no enrollment is found

#### Scenario: Inactive class is not offered

- GIVEN a class with `Activo` false
- WHEN classes are listed through the catalog read path
- THEN that class is absent

#### Scenario: Active enrollment in an inactive class does not verify

- GIVEN an active inscripcion whose class has `Activo` false
- WHEN enrollment is verified through the catalog read path
- THEN no enrollment is found

#### Scenario: Reactivated rows are visible again

- GIVEN an inactive class and inscripcion
- WHEN both are set active
- THEN the catalog read path returns them

#### Scenario: Active class without docente is returned

- GIVEN an active class with no docente
- WHEN classes are listed through the catalog read path
- THEN the class is returned with no docente and the read does not fail

### Requirement: Asignatura lifecycle

An `Asignatura` (class) MUST carry an `Activo` state. Newly created classes MUST
be active. `Facultad` and `Carrera` MUST NOT have an active/inactive state. A
class MUST NOT be deleted by any application path. Deactivating a class MUST NOT
be refused on account of any other row (the former refusal "while active groups
exist" is gone with the child entity). The import deactivates every class row
absent from the workbook (A5, see `catalog-excel-import`) and reactivates a
listed inactive class.
(Previously: an import that omitted an `Asignatura` never changed it, and an
`Asignatura` could not be deactivated while it had active groups.)

#### Scenario: Newly created class is active

- GIVEN a valid class created by any means
- WHEN stored data is inspected
- THEN `Activo` is true

#### Scenario: Last active class of a code can be deactivated

- GIVEN a code whose only active class is (A, "1")
- WHEN (A, "1") is deactivated
- THEN it is inactive and still stored

#### Scenario: Absent class is deactivated, not deleted (A5)

- GIVEN a stored active class that a later import omits
- WHEN the import is applied
- THEN the class is inactive and still stored with its `Codigo`, group number,
  `Nombre`, `CarreraId`, `HorasTotales`, docente and days

#### Scenario: Inactive class is retained

- GIVEN a class that was deactivated
- WHEN stored data is inspected
- THEN the row still exists with all its values

### Requirement: Asignatura Codigo is immutable after creation

The `Codigo` of a stored class MUST NOT change, and neither MUST its group number
(A9). Maintenance that needs a different code or group number MUST create a new
class.
(Previously: only `Codigo` was immutable.)

#### Scenario: Update cannot alter the code

- GIVEN a stored class (MAT101, "1")
- WHEN a manual edit tries to set the code "MAT102"
- THEN the stored code is still "MAT101"

#### Scenario: Update cannot alter the group number (A9)

- GIVEN a stored class (MAT101, "1")
- WHEN a manual edit tries to set the group number "2"
- THEN the stored group number is still "1"

## REMOVED Requirements

### Requirement: Grupo shape, natural key and period format

(Reason: the `Grupo` entity and `Periodo` are removed (D1, D8). The class key is
(`Codigo`, group number). The `YYYY-S1|S2` period format has no remaining use.)
(Migration: replaced by "Asignatura shape and natural key" (MODIFIED) and "No
Grupo entity and no Periodo (D1, D8)" (ADDED). The period validation scenarios are
dropped without replacement.)

### Requirement: Docente role integrity of Grupo.DocenteId

(Reason: `Grupo.DocenteId` no longer exists, and the docente is now optional.)
(Migration: replaced by "Docente role integrity of Asignatura.DocenteId (D5)".)

### Requirement: Grupo origin marker

(Reason: `Grupo` is removed; the origin moves to the class row (A3).)
(Migration: replaced by "Class origin marker (A3)". Migrated rows keep the origin
of their `Grupo`.)

### Requirement: Grupo meeting days (AC-DIAS)

(Reason: the days are a field of the class row (D7), not of a separate `Grupo`.)
(Migration: replaced by "Class meeting days (AC-DIAS)". The stored bitmask and its
semantics are unchanged; "Additive schema for meeting days (AC-DIAS-ADD)" stays
as the history of migration `0006`.)

### Requirement: Manual writes require an active Asignatura and an active docente

(Reason: there is no parent `Asignatura` any more, so "an active Asignatura" has
no meaning; the docente condition survives and now applies only when a docente is
given.)
(Migration: replaced by "Manual writes require an active docente when one is
given (A10)".)

## Spec-level assumptions

- **S1.** When the A2 rule cannot choose between colliding rows, the migration
  stops instead of picking one. The proposal does not define this case.
- **S2.** An active class without docente is returned by downstream readers
  instead of being hidden. Who handles a request for such a class is out of scope
  (proposal question 2).

## Open questions for design

1. Column names: the group number on `Asignatura`, the re-pointed `Inscripcion`
   column, the docente column.
2. Drop `Grupo` inside `0007`, or in a later migration after a verification
   period (proposal question 7).
3. Which `Origen` the single class of a subject without groups (A1) receives.
4. "Lowest-id group" in the proposal is read here as the lowest-id CARRIED-OVER
   group; confirm when the lowest-id group is a collision loser.
5. How the database enforces the docente rule (the proposal names seven partial
   unique indexes, one per weekday bit) and how the migration orders its
   inserts, updates and the drop against non-deferrable indexes.
6. Form of the preflight: script, SQL file or part of the migration test; its
   output format.
7. Whether the group number also gets a database CHECK (non-empty) besides the
   application validation.
8. Owner questions still open: 3 (no record of which term a class row
   described), 4 (a class with no days escapes the rule), 5 (confirm A2).
