# Academic Catalog Specification

## Purpose

The system owns an internal academic catalog (RF-35, RNF-10) so that downstream
features can resolve docente and group (RF-03), verify enrollment in the absence
period (RF-31) and avoid manual searching (RNF-08). This capability defines the
new entities `Asignatura`, `Grupo` and `Inscripcion`, their natural keys, their
integrity rules and the active/inactive lifecycle that readers MUST respect.
`Facultad` and `Carrera` already exist and are unchanged except where stated.
How rows get into the catalog is specified in `catalog-excel-import`.

| Entity | Natural key | Notes |
|---|---|---|
| `Asignatura` | `Codigo` (unique) | `Nombre`, `CarreraId`, `HorasTotales` |
| `Grupo` | (`AsignaturaId`, `Periodo`, `NumeroGrupo`) | `DocenteId`, `Activo` |
| `Inscripcion` | (`EstudianteId`, `GrupoId`) composite primary key | `Activo`; no period column, the period is that of the `Grupo` |

"Active" means `Activo` is true. `Facultad`, `Carrera` and `Asignatura` have no
`Activo` column.

## Requirements

### Requirement: Asignatura shape and natural key

An `Asignatura` MUST have a unique `Codigo`, a non-empty `Nombre`, an existing
`CarreraId`, `HorasTotales` and an `Activo` state. `HorasTotales` MUST be an
integer greater than zero and MUST NOT be null. The system MUST NOT store two
asignaturas with the same `Codigo`, whether the stored one is active or
inactive.

#### Scenario: Valid asignatura is stored

- GIVEN an existing carrera
- WHEN an asignatura with a new `Codigo`, a `Nombre` and `HorasTotales` 64 is
  stored for it
- THEN it is persisted active and retrievable by `Codigo`

#### Scenario: Duplicate Codigo is rejected

- GIVEN a stored asignatura (active or inactive) with `Codigo` "MAT101"
- WHEN a second asignatura with `Codigo` "MAT101" is stored
- THEN the write is refused and the first row is unchanged

#### Scenario: Non-positive or missing HorasTotales is rejected (table-driven)

| HorasTotales |
|---|
| 0 |
| -8 |
| absent |

- GIVEN otherwise valid asignatura data
- WHEN it is stored with the value from the row
- THEN the write is refused

#### Scenario: Unknown carrera is rejected

- GIVEN a `CarreraId` that does not exist
- WHEN an asignatura referencing it is stored
- THEN the write is refused

### Requirement: Grupo shape, natural key and period format

A `Grupo` MUST reference an existing `Asignatura`, carry a `Periodo`, a
`NumeroGrupo`, a `DocenteId`, an `Activo` flag and an `Origen` (see "Grupo
origin marker"). The combination (`AsignaturaId`, `Periodo`, `NumeroGrupo`)
MUST be unique. `Periodo` MUST match the format `YYYY-S1` or `YYYY-S2`
(four-digit year, then `-S`, then `1` or `2`). Any other value MUST be rejected
by import validation and by manual-form validation.

#### Scenario: Valid periods are accepted (table-driven)

| Periodo |
|---|
| `2026-S1` |
| `2026-S2` |

- GIVEN an otherwise valid group row or form
- WHEN it carries the period from the row
- THEN it passes validation

#### Scenario: Invalid periods are rejected (table-driven)

| Periodo |
|---|
| `2026-S3` |
| `2026-1` |
| `26-S1` |
| `2026S1` |
| `2026-s1` |
| empty |

- GIVEN an otherwise valid group row or form
- WHEN it carries the period from the row
- THEN it fails validation with an error naming the period

#### Scenario: Duplicate natural key is rejected

- GIVEN a stored grupo (active or inactive) for (asignatura A, `2026-S2`, 1)
- WHEN another grupo with the same triple is stored
- THEN the write is refused

#### Scenario: Same group number in another period or asignatura is allowed

- GIVEN a stored grupo for (asignatura A, `2026-S2`, 1)
- WHEN grupos for (A, `2027-S1`, 1) and (B, `2026-S2`, 1) are stored
- THEN both are accepted

### Requirement: Docente role integrity of Grupo.DocenteId

`Grupo.DocenteId` MUST reference a `Usuario` whose role is `docente`. A group
whose docente resolves to a user of any other role, or to no user, MUST be
rejected. This integrity MUST be enforced by the application, not by the
database schema alone.

#### Scenario: Docente user is accepted

- GIVEN a `Usuario` with role `docente`
- WHEN a grupo is stored with that user as `DocenteId`
- THEN it is accepted

#### Scenario: Non-docente user is rejected (table-driven)

| Role of referenced user |
|---|
| `estudiante` |
| `secretaria` |
| `coordinacion` |
| `administrador` |

- GIVEN a `Usuario` with the role from the row
- WHEN a grupo referencing it as `DocenteId` is stored
- THEN the write is refused

#### Scenario: Unknown docente is rejected

- GIVEN a `DocenteId` that matches no `Usuario`
- WHEN a grupo referencing it is stored
- THEN the write is refused

### Requirement: Estudiante role integrity of Inscripcion.EstudianteId

The `Inscripcion` table MUST have the composite key (`EstudianteId`,
`GrupoId`), a foreign key from `EstudianteId` to `Usuario`, a foreign key from
`GrupoId` to `Grupo`, and an `Activo` column. Any writer of `Inscripcion` MUST
ensure that `EstudianteId` references a `Usuario` whose role is `estudiante`,
and MUST NOT store a duplicate (`EstudianteId`, `GrupoId`) pair; this role
integrity MUST be enforced by the application, because the role lives on a
separate lookup table. This change ships no writer of `Inscripcion`: the
Inscripciones sheet was removed from the import by the product owner's scope
reduction to three sheets, so the rule is specified here for the future writer
and is not enforced by any code in this change.

#### Scenario: No code path in this change writes Inscripcion

- GIVEN every production module under `src`
- WHEN it is checked structurally for an insert, update or delete against the
  `inscripcion` table
- THEN none is found; the table is only read

**Deferred behaviour (not a scenario of this change): a future writer enforces
the estudiante role.** Not demonstrable here because no writer exists; it is
written as a note rather than under a scenario heading so that this change's
scenario count holds only what this change can prove. The change that
introduces a writer of `Inscripcion` MUST turn the table below into scenarios
with tests.

| Role of referenced user | Expected result |
|---|---|
| `estudiante` | accepted and active |
| `docente` | refused |
| `secretaria` | refused |
| `coordinacion` | refused |
| `administrador` | refused |

- GIVEN a `Usuario` with the role from the row and an existing grupo
- WHEN a future writer stores an inscripcion referencing it as `EstudianteId`
- THEN the result is the one in the row, and storing the same
  (`EstudianteId`, `GrupoId`) pair twice is refused with exactly one row kept

### Requirement: Active-only reads for downstream consumers

`Grupo`, `Inscripcion` and `Asignatura` rows MUST carry `Activo`. Catalog read
functions intended for downstream consumers (RF-03 docente/grupo resolution,
RF-31 enrollment verification) MUST return only rows where `Activo` is true,
and MUST NOT treat an inactive row as evidence of a current group or
enrollment. A `Grupo` whose `Asignatura` is inactive MUST be treated as not
offered by those readers, even if the `Grupo` itself is active. Inactive rows
MUST remain stored.

(Assumption flagged: the Asignatura condition changes an existing reader. See
`catalog-management` assumption A-RDR-6. The original text covered `Grupo` and
`Inscripcion` only.)

#### Scenario: Inactive enrollment does not verify

- GIVEN an inscripcion of estudiante E in grupo G with `Activo` false
- WHEN enrollment of E in G is queried through the catalog read path
- THEN no enrollment is found

#### Scenario: Inactive grupo is not offered

- GIVEN a grupo with `Activo` false
- WHEN groups are listed through the catalog read path
- THEN that grupo is absent

#### Scenario: Active enrollment in an inactive grupo does not verify

- GIVEN an active inscripcion whose grupo has `Activo` false
- WHEN enrollment is verified through the catalog read path
- THEN no enrollment is found

#### Scenario: Reactivated rows are visible again

- GIVEN an inactive grupo and inscripcion
- WHEN both are set active
- THEN the catalog read path returns them

#### Scenario: Active grupo of an inactive asignatura is hidden

- GIVEN an active grupo whose asignatura has `Activo` false (for example after
  an Asignatura was set inactive by a direct data edit, since the application
  itself never leaves an active Grupo under an inactive Asignatura)
- WHEN groups are listed or enrollment is verified through the catalog read path
- THEN the grupo is absent and no enrollment in it is found

#### Scenario: Reactivating the asignatura restores visibility

- GIVEN the situation above
- WHEN the asignatura is set active
- THEN the grupo is returned again

### Requirement: Additive schema and existing-data safety

The schema change MUST be additive: it adds the three entities, a UNIQUE
constraint on `Usuario.Correo` and a `Usuario.DebeCambiarClave` column (see
`forced-password-change`). It MUST NOT drop, rename or rewrite existing
columns or rows. Nullable `Correo` values MUST remain allowed and MUST NOT
collide with each other under the UNIQUE constraint. The database migration MUST
NOT be applied to a shared database without explicit user confirmation.

#### Scenario: Existing rows survive

- GIVEN a database populated by migrations 0000-0002
- WHEN the change is applied
- THEN every pre-existing `Facultad`, `Carrera`, `Rol` and `Usuario` row is
  unchanged, except that each `Usuario` has `DebeCambiarClave` false

#### Scenario: Duplicate emails block the constraint

- GIVEN two existing users with the same non-null `Correo`
- WHEN the UNIQUE constraint is applied
- THEN the migration fails as a whole and leaves the schema unchanged
- AND a read-only pre-check for duplicates exists to detect this beforehand

#### Scenario: Multiple null emails coexist

- GIVEN several users with null `Correo`
- WHEN the UNIQUE constraint is in force
- THEN all of them remain valid

### Requirement: Asignatura lifecycle

An `Asignatura` MUST carry an `Activo` state. Existing and newly created
asignaturas MUST be active. `Facultad` and `Carrera` MUST NOT have an
active/inactive state. An `Asignatura` MUST NOT be deleted. An import that omits
an `Asignatura` MUST NOT change or remove it, including its `Activo` value.

#### Scenario: Existing asignaturas become active

- GIVEN asignaturas stored before the change
- WHEN the change is applied
- THEN every one of them is active and otherwise unchanged

#### Scenario: Absent asignatura stays unchanged

- GIVEN a stored asignatura, active or inactive
- WHEN a later import omits it
- THEN it remains stored with the same `Activo` value

#### Scenario: Inactive asignatura is retained

- GIVEN an asignatura that was deactivated
- WHEN stored data is inspected
- THEN the row still exists with its `Codigo`, `Nombre`, `CarreraId` and
  `HorasTotales`

### Requirement: Asignatura Codigo is immutable after creation

The `Codigo` of a stored `Asignatura` MUST NOT change. Maintenance that needs a
different code MUST create a new `Asignatura`.

#### Scenario: Update cannot alter the key

- GIVEN a stored asignatura "MAT101"
- WHEN a manual edit tries to set "MAT102"
- THEN the stored `Codigo` is still "MAT101"

### Requirement: Grupo origin marker

A `Grupo` MUST carry an `Origen` of `importacion` or `manual`, set at creation
and never rewritten. Rows existing before this change MUST be `importacion`. A
value other than the two MUST be rejected by the database.

#### Scenario: Origin values (table-driven)

| Origen written | Result |
|---|---|
| `importacion` | accepted |
| `manual` | accepted |
| any other text | rejected |

- GIVEN otherwise valid group data
- WHEN stored with the origin from the row
- THEN the outcome is as shown

#### Scenario: Origin survives updates

- GIVEN a `manual` group
- WHEN the group is updated by any means
- THEN its origin is still `manual`

### Requirement: Manual writes require an active Asignatura and an active docente

A manual create of a `Grupo`, a manual change of its `DocenteId`, and a manual
reactivation of a `Grupo` MUST require that its `Asignatura` is active and that
its docente is an active `Usuario` whose role is `docente`. This is enforced by
the application, on top of "Docente role integrity of Grupo.DocenteId". A manual
deactivation of a `Grupo` and a manual reactivation of an `Asignatura` are never
refused on account of another record's state. The import is not subject to the docente-active check (known gap: an inactive
matched docente still resolves in the import).

#### Scenario: Inactive parents are refused (table-driven)

| Manual write | Parent state | Result |
|---|---|---|
| create Grupo | Asignatura inactive | refused |
| create Grupo | docente inactive | refused |
| change docente | new docente inactive | refused |
| reactivate Grupo | Asignatura inactive | refused |
| reactivate Grupo | docente inactive | refused |

- GIVEN the parent state from the row
- WHEN the manual write is attempted
- THEN it is refused and nothing is stored

### Requirement: Additive schema for catalog management

The schema change of this capability MUST be additive: a boolean `Activo` on
`Asignatura` defaulting to true and an `Origen` on `Grupo` defaulting to
`importacion` constrained to the two values. It MUST NOT drop, rename or
rewrite existing columns or rows beyond those defaults, and MUST NOT require an
audit-table change. The migration MUST NOT be applied to a shared database
without explicit user confirmation for each command, and MUST NOT be applied
with a schema-push command.

#### Scenario: Existing data survives

- GIVEN a database populated by the earlier migrations
- WHEN the migration is applied
- THEN every existing row is unchanged except for the two new column values

#### Scenario: Old code keeps working

- GIVEN the migration applied and the previous code running
- WHEN the import and the catalog readers run
- THEN they behave as before

### Requirement: Grupo meeting days (AC-DIAS)

Amendment 2026-10-07 (owner decision: the days belong to the `Grupo`, not to
the `Asignatura`; two groups of one Asignatura may meet on different days). In
addition to the attributes listed in "Grupo shape, natural key and period
format", a `Grupo` MUST carry a set of meeting days drawn from a closed list of
seven weekdays, Monday to Sunday. The set MUST NOT contain a value twice,
MUST NOT depend on order, MAY be empty, and MUST be presented in week order. A
value outside the seven MUST be rejected by the application. Only days are
stored: no start or end time, no classroom, no per-date calendar. An empty set
means "days not recorded" and is valid for every `Grupo`, including active
ones. The days are part of the `Grupo` row and are not part of its natural key.
Active-only readers (see "Active-only reads for downstream consumers") apply to
the days exactly as to the rest of the `Grupo`.

#### Scenario: Set semantics (table-driven)

| Days written | Days stored and presented |
|---|---|
| Wednesday, Monday | Monday, Wednesday |
| Monday, Monday | Monday |
| none | empty set |
| Monday to Sunday | all seven, in week order |
| a value outside the seven | rejected |

- GIVEN otherwise valid group data
- WHEN stored with the days from the row
- THEN the outcome is as shown

#### Scenario: Days are not part of the natural key

- GIVEN a stored grupo for (A, `2026-S1`, "1") meeting on Monday
- WHEN another grupo for the same triple meeting on Tuesday is stored
- THEN the write is refused as a duplicate

#### Scenario: Two groups of one Asignatura differ in days

- GIVEN grupos (A, `2026-S1`, "1") on Monday and (A, `2026-S1`, "2") on Friday
- WHEN both are stored
- THEN both are accepted and each keeps its own days

### Requirement: Additive schema for meeting days (AC-DIAS-ADD)

Amendment 2026-10-07. The schema change that stores the days MUST be additive:
it adds only what is needed to store the set on `Grupo`, MUST NOT drop, rename
or rewrite any existing column or row, and every `Grupo` existing before it MUST
read as an empty set of days with no manual action. It MUST NOT require an
audit-table change. The migration MUST NOT be applied to a shared database
without explicit user confirmation for each command, MUST NOT be applied with a
schema-push command, and MUST be rehearsed on a fresh database branch under the
same gates as migration `0005` before the shared database. The storage
representation is a design decision.

#### Scenario: Existing data survives

- GIVEN a database populated by the earlier migrations including `0005`
- WHEN the migration is applied
- THEN every existing `Grupo` is unchanged and has an empty set of days
- AND every row of every other table is unchanged

#### Scenario: Old code keeps working

- GIVEN the migration applied and the previous code running
- WHEN the import and the catalog readers run
- THEN they behave as before

## Assumptions and open questions

- Assumption (from proposal): `Asignatura`, `Carrera` and `Facultad` have no
  `Activo` column (default 9).
- Assumption: `Inscripcion` has no period column; the period is derived from its
  `Grupo`.
- Assumption: supporting indexes (period, docente, grupo) are a design concern
  and not asserted here.
- Assumption: role integrity is checked at the application layer because the
  role lives on a separate lookup table; the database MAY add further guards.
- Assumption (scope reduction): no code in this change writes `Inscripcion`, so
  "Estudiante role integrity of Inscripcion.EstudianteId" binds the future
  writer only. The one demonstrable scenario is the structural check that no
  module under `src` inserts, updates or deletes the table; the role and
  duplicate scenarios are deferred until that writer exists.
