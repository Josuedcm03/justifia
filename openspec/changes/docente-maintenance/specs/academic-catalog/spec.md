# Delta for Academic Catalog

Change `docente-maintenance`. Requirements covered: RF-12 (b), RNF-13 (b). [PG]
marks a scenario that MUST run on a real PostgreSQL (see `docente-maintenance`).

## Notes for archive

- The Purpose, the entity table and the "Assumptions and open questions" section
  need no edit. Add one assumption bullet: "Invariant kept by the application
  (`docente-maintenance`): no active `Grupo` names an inactive docente. A docente
  with active grupos cannot be deactivated, and the import never reactivates one.
  Active grupos that already named an inactive docente before that change are not
  repaired by it."
- "Active-only reads for downstream consumers" is not edited. The student offer
  still does not consult the docente's `Activo`; the invariant above is what keeps
  a deactivated docente's classes out of it.

## MODIFIED Requirements

### Requirement: Manual writes require an active Asignatura and an active docente

A manual create of a `Grupo`, a manual change of its `DocenteId`, and a manual
reactivation of a `Grupo` MUST require that its `Asignatura` is active and that
its docente is an active `Usuario` whose role is `docente`. This is enforced by
the application, on top of "Docente role integrity of Grupo.DocenteId". A manual
deactivation of a `Grupo` and a manual reactivation of an `Asignatura` are never
refused on account of another record's state. The import is subject to the same
docente rule: a Grupos row that names an inactive docente is a row-level error and
no grupo is written for it (`catalog-excel-import`), and the import never
reactivates a docente. The reverse direction is guarded too: a manual deactivation
of a docente MUST be refused while any active `Grupo` names it
(`docente-maintenance`), so the application never leaves an active `Grupo` with an
inactive docente.
(Previously: "The import is not subject to the docente-active check (known gap: an
inactive matched docente still resolves in the import)", and nothing guarded the
deactivation of a docente because no manual deactivation existed.)

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

#### Scenario: A docente with an active grupo cannot be deactivated [PG]

- GIVEN an active docente named by one active `Grupo`
- WHEN a `secretaria` confirms the deactivation of the docente
- THEN it is refused with the number of active grupos, and the docente and the
  grupo are unchanged

#### Scenario: The import does not reactivate and does not accept an inactive docente [PG]

- GIVEN an inactive docente D and a workbook whose Docentes sheet lists D and
  whose Grupos sheet names D
- WHEN it is planned
- THEN the Grupos row is a row error, no grupo is written for it and D stays
  inactive

#### Scenario: The invariant holds after any order of writers [PG]

- GIVEN a docente D with no active grupo
- WHEN a grupo create naming D and the deactivation of D run in either order
- THEN the stored state has no active grupo naming an inactive docente
