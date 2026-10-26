# Delta for Academic Catalog

Covers RF-16 (new), RF-04, RF-12 b, RN-21 (amended), RNF-06. Written by
`student-enrollment`: the first and only writer of `Inscripcion`. The final
bullet of the base spec's "Assumptions and open questions" (scope reduction,
no code writes `Inscripcion`) is superseded by this delta.

## MODIFIED Requirements

### Requirement: Estudiante role integrity of Inscripcion.EstudianteId

The `Inscripcion` table MUST have the composite key (`EstudianteId`,
`GrupoId`), a foreign key from `EstudianteId` to `Usuario`, a foreign key from
`GrupoId` to `Grupo`, and an `Activo` column. Any writer of `Inscripcion` MUST
ensure that `EstudianteId` references a `Usuario` whose role is `estudiante`,
and MUST NOT store a duplicate (`EstudianteId`, `GrupoId`) pair; this role
integrity MUST be enforced by the application, in the data layer and not only
by a page or action guard, because the role lives on a separate lookup table.
The only writer of `Inscripcion` is the student-enrollment writer (see
`student-enrollment`); the Excel import writes none (the Inscripciones sheet
was removed by the product owner's scope reduction). No code MUST delete an
`Inscripcion` row: an enrollment ends by setting `Activo` false.
(Previously: the change shipped no writer, so the rule bound a future writer and
the one scenario was the structural check that nothing writes the table.)

#### Scenario: Only the allowlisted writer writes Inscripcion

- GIVEN every production module under `src`
- WHEN it is checked structurally for an insert, update or delete against the
  `inscripcion` table
- THEN only the student-enrollment writer module contains one
- AND no module deletes from the table and the import writes none

#### Scenario: Role of the referenced user (table-driven)

| Role of referenced user | Expected result |
|---|---|
| `estudiante` | accepted and active |
| `docente` | refused |
| `secretaria` | refused |
| `coordinacion` | refused |
| `administrador` | refused |

- GIVEN a `Usuario` with the role from the row and an existing offered grupo
- WHEN the writer stores an inscripcion referencing it as `EstudianteId`
- THEN the result is the one in the row
- AND a refusal stores nothing and writes no audit row

#### Scenario: Duplicate pair keeps one row

- GIVEN an active inscripcion of estudiante E in grupo G
- WHEN the writer stores the same (`EstudianteId`, `GrupoId`) pair again
- THEN exactly one row exists for the pair, unchanged, and no audit row is written

#### Scenario: Inactive pair is reactivated, not duplicated

- GIVEN an inactive inscripcion of E in G
- WHEN the writer stores the pair
- THEN exactly one row exists for the pair and it is active

#### Scenario: Unknown estudiante or grupo is refused

- GIVEN an `EstudianteId` that matches no `Usuario`, or a `GrupoId` that matches no `Grupo`
- WHEN the writer stores the pair
- THEN the write is refused and nothing is stored

### Requirement: Active-only reads for downstream consumers

`Grupo`, `Inscripcion` and `Asignatura` rows MUST carry `Activo`. Catalog read
functions intended for downstream consumers (RF-03 docente/grupo resolution,
RF-31 enrollment verification) MUST return only rows where `Activo` is true,
and MUST NOT treat an inactive row as evidence of a current group or
enrollment. A `Grupo` whose `Asignatura` is inactive MUST be treated as not
offered by those readers, even if the `Grupo` itself is active. Inactive rows
MUST remain stored. The eligible-groups reader that offers subjects to a
request (`justification-intake`) is such a consumer: it MUST return a group only
when its `Inscripcion`, its `Grupo` and its `Asignatura` are all active, and so
MUST the student-enrollment readers of effective enrollments.
(Previously: the eligible-groups reader checked `Inscripcion` and `Grupo` but
not `Asignatura`, which this requirement already demanded.)

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

#### Scenario: Eligible groups require an active asignatura

- GIVEN an active inscripcion of E in an active grupo whose asignatura is inactive
- WHEN the eligible groups of E are listed for a request
- THEN that group is absent, and it returns once the asignatura is set active
