# Delta for Academic Catalog

## MODIFIED Requirements

### Requirement: Estudiante role integrity of Inscripcion.EstudianteId

The `Inscripcion` table MUST have the composite key (`EstudianteId`,
`GrupoId`), a foreign key from `EstudianteId` to `Usuario`, a foreign key from
`GrupoId` to `Grupo`, and an `Activo` column. Any writer of `Inscripcion` MUST
ensure that `EstudianteId` references a `Usuario` whose role is `estudiante`,
and MUST NOT store a duplicate (`EstudianteId`, `GrupoId`) pair; this role
integrity MUST be enforced by the application, in the data layer and not only
by a page or action guard, because the role lives on a separate lookup table.
The only writer of `Inscripcion` is the enrollment writer, one module that
serves the student (`student-enrollment`) and the secretaría
(`enrollment-administration`); the Excel import writes none (the Inscripciones
sheet was removed by the product owner's scope reduction). Whoever the actor
is, the role integrity binds the referenced student, never the actor: a
secretaría acting on a user id whose role is not `estudiante` MUST be refused.
No code MUST delete an `Inscripcion` row: an enrollment ends by setting
`Activo` false.
(Previously: the only writer was the student-enrollment writer and the actor was
always the student.)

#### Scenario: Only the allowlisted writer writes Inscripcion

- GIVEN every production module under `src`
- WHEN it is checked structurally for an insert, update or delete against the
  `inscripcion` table
- THEN only the enrollment writer module contains one, including the staff
  operations
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
- WHEN the writer stores an inscripcion referencing it as `EstudianteId`, as the
  student or as a secretaría
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

#### Scenario: Staff actor is not the referenced student

- GIVEN a secretaría acting for estudiante E
- WHEN the writer stores the inscripcion
- THEN the row references E and never the secretaría
