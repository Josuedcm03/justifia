# Delta for Audit Log

## MODIFIED Requirements

### Requirement: One audit row per enrollment change, same transaction (RNF-06)

Every successful change of an `Inscripcion` made by the enrollment writer,
whether the student or a secretaría acts, MUST write exactly one audit row per
row changed, inside the same transaction as the data change (per "Audit record
is written in the same transaction as its change"). A replace changes two rows
and MUST therefore write two rows, a `inscripcion.desactivada` for the previous
group and an `inscripcion.creada` or `inscripcion.reactivada` for the new one,
committed together. A refused, invalid, unauthorized, no-op, cancelled or failed
operation MUST write no row and leave no data change. The actor MUST be the
authenticated session user who performed the change (the student, or the
secretaría for a staff write), never request input.
(Previously: the writer was the student's and the actor was the student.)

#### Scenario: Successful operations (table-driven)

| Operation | Rows added |
|---|---|
| enroll, no prior row | 1 `inscripcion.creada` |
| enroll, inactive prior row | 1 `inscripcion.reactivada` |
| confirmed drop or staff deactivation | 1 `inscripcion.desactivada` |
| confirmed replace or staff change group, new row | 1 `inscripcion.desactivada`, 1 `inscripcion.creada` |
| confirmed replace or staff change group, inactive prior row of the new group | 1 `inscripcion.desactivada`, 1 `inscripcion.reactivada` |
| staff reactivation | 1 `inscripcion.reactivada` |
| staff create, no prior row | 1 `inscripcion.creada` |

- GIVEN a student or a secretaría performing the operation
- WHEN it succeeds
- THEN exactly the rows shown exist, with the session user as actor

#### Scenario: Operations that leave no row (table-driven)

| Case |
|---|
| enroll in an already active group |
| group not offered (older period, inactive grupo, inactive asignatura) |
| drop or deactivation of an already inactive or foreign enrollment |
| cancelled dialog |
| a role that may not perform the operation |
| out-of-scope student on a staff write |
| the data write fails |
| the audit insert fails |

- GIVEN the case from the row
- WHEN the action runs
- THEN no audit row exists for it and the data is unchanged

#### Scenario: Actor from the session

- GIVEN a payload claiming another actor or student
- WHEN an enrollment change succeeds
- THEN the audit row's actor is the session user

## ADDED Requirements

### Requirement: Staff enrollment events are distinguishable and add nothing (RNF-06, RNF-02, RF-12 a)

A staff write MUST use the same three actions and the entity type `Inscripcion`
of the closed set of enrollment events: no write action, entity type or
`motivo` code is added (the two read actions of the next requirement are the
only additions). The entity id MUST be the student's id, never the staff user's, and
the payload MUST carry the same ids and closed codes as a student write
(`estudianteId`, `grupoId`, and `motivo` where it applies). The staff user is
recorded only as the actor, which is what tells a staff event from a student
event. The payload MUST NOT carry the staff user's id, name or email, the
student's name or CIF, nor a count of requests. Reads are audited by the
separate requirement below (owner decision D10, 2026-11-19).

#### Scenario: Staff and student event shape is identical

- GIVEN a student drop and a staff deactivation of the same group
- WHEN both audit rows are read
- THEN action, entity type, entity id and payload keys match and only the actor differs

#### Scenario: Staff payload has ids and no names

- GIVEN a staff change group with a deactivated and a created row
- WHEN every payload is serialized and searched
- THEN it holds the student id and the group ids and no name, CIF, email, staff id, count of requests or credential

### Requirement: One audit row per staff read of inscriptions (RNF-06 a, RNF-02, RF-12 a) [S1, S3]

Owner decision D10 (2026-11-19): RNF-06 (a) is applied literally to this
capability. Each successful load of the inscriptions list (S1) and each
successful student search of the assign page (S3) MUST write exactly one audit
row, with the session user as actor. Following the scope-read precedent
(`solicitud.cola.consultada`, `solicitud.ranking.consultado`), the entity is the
caller's scope, not a student: entity type `Facultad` and the id of the
secretaria's facultad. The actions are `inscripcion.lista.consultada` and
`inscripcion.estudiantes.consultada`, added to the closed set of audit actions.
The payload MUST carry only closed, non-identifying values: the period, the
status filter, which filters are present (booleans), the page and the number of
rows returned. It MUST NOT carry the search text, any student id, name or CIF,
any group or asignatura id typed as a filter, nor a count of requests. A read
that fails or returns the degraded state MUST write no audit row. The student
search is not bound to a period, so its payload MUST record the period as the
empty string `""` and the status as `active`, and the only filter present is the
search term (`q: true`). A blank search term reads and audits nothing (owner
decision, 2026-11-22).

#### Scenario: List load writes one row without student data

- GIVEN a secretaria of facultad F with search text "Pérez"
- WHEN the inscriptions list loads successfully
- THEN exactly one `inscripcion.lista.consultada` row exists with entity `Facultad` F
- AND its payload holds no search text, no student id and no name or CIF

#### Scenario: Student search writes one row

- GIVEN the assign page in S3
- WHEN a student search returns results
- THEN exactly one `inscripcion.estudiantes.consultada` row exists with entity `Facultad` F
- AND its payload records `periodo` as `""`, `status` as `active` and only `q` as a present filter

#### Scenario: Blank student search writes nothing

- GIVEN the assign page with an empty search term
- WHEN the page renders
- THEN no student is read and no audit row is written

#### Scenario: Degraded read writes nothing

- GIVEN the database is unavailable
- WHEN the list loads in the degraded state
- THEN no audit row is written
