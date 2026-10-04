# Academic Catalog Specification (delta)

> Base for this delta: `openspec/changes/catalog-excel-import/specs/academic-catalog/spec.md`
> (`openspec/specs/` is empty because that change is not archived yet). Apply
> this delta after it. Requirements not named here are unchanged. The Purpose
> sentence "`Facultad`, `Carrera` and `Asignatura` have no `Activo` column" and
> the table row for `Grupo` change as described below: `Asignatura` gains
> `Activo`, `Grupo` gains `Origen`.

## ADDED Requirements

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

## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: Facultad, Carrera and Asignatura are never deactivated

(Reason: `Asignatura` now has an active state. The narrower statement for
`Facultad` and `Carrera` is carried by "Asignatura lifecycle" above, which also
keeps the scenario "Absent asignatura stays".)

Migration note for archive: the removed scenario "Absent asignatura stays" is
re-stated under "Asignatura lifecycle" as "Absent asignatura stays unchanged".
`Facultad` and `Carrera` remain without an active state; nothing in this change
gives them one.

## Assumptions and open questions

- Assumption: `Asignatura.Activo` and `Grupo.Origen` are the column names used
  here as vocabulary; the type of `Origen` (text with a CHECK versus boolean) is
  a design decision as long as the two values and the default hold.
- Assumption (flagged): the downstream readers' Asignatura condition (see
  modified "Active-only reads") is new and changes an existing reader.
- The earlier assumption "`Asignatura`, `Carrera` and `Facultad` have no
  `Activo` column (default 9)" is withdrawn for `Asignatura` only.
