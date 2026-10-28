# Delta for Audit Log

Covers RNF-06 (a, b), RNF-02, RF-16. New events for the student's own
enrollment changes (`student-enrollment`). No existing requirement text
changes, so all three requirements are ADDED.

## ADDED Requirements

### Requirement: Closed set of enrollment events (RNF-06)

The audit actions MUST gain exactly these three: `inscripcion.creada`,
`inscripcion.reactivada`, `inscripcion.desactivada`. The audit entity types
MUST gain `Inscripcion`. An enrollment has a composite key, so the event MUST
use the student id as the entity id and MUST carry the group id in the payload,
so that both halves of the key are recoverable from the row and a student's
enrollment history is served by the entity index. Events MUST be
built only through the central builders. Existing events and their payloads
MUST be unchanged, and no schema change to the audit log is required.

#### Scenario: Action to meaning (table-driven)

| Change | Action | Entity type |
|---|---|---|
| inscripcion row created active | `inscripcion.creada` | `Inscripcion` |
| inactive inscripcion set active | `inscripcion.reactivada` | `Inscripcion` |
| active inscripcion set inactive (drop or replaced) | `inscripcion.desactivada` | `Inscripcion` |

- GIVEN a change of the kind in the row
- WHEN its audit row is read
- THEN the action and entity type are as shown, the entity id is the student id
  and the payload holds the group id

#### Scenario: Existing events unaffected

- GIVEN a manual catalog write or a request submit
- WHEN its audit rows are read
- THEN they are identical in shape to those written before this change

### Requirement: One audit row per enrollment change, same transaction (RNF-06)

Every successful change of an `Inscripcion` made by the student-enrollment
writer MUST write exactly one audit row per row changed, inside the same
transaction as the data change (per "Audit record is written in the same
transaction as its change"). A replace changes two rows and MUST therefore
write two rows, a `inscripcion.desactivada` for the previous group and an
`inscripcion.creada` or `inscripcion.reactivada` for the new one, committed
together. A refused, invalid, unauthorized, no-op, cancelled or failed
operation MUST write no row and leave no data change. The actor MUST be the
authenticated session user, never request input.

#### Scenario: Successful operations (table-driven)

| Operation | Rows added |
|---|---|
| enroll, no prior row | 1 `inscripcion.creada` |
| enroll, inactive prior row | 1 `inscripcion.reactivada` |
| confirmed drop | 1 `inscripcion.desactivada` |
| confirmed replace, new row | 1 `inscripcion.desactivada`, 1 `inscripcion.creada` |
| confirmed replace, inactive prior row of the new group | 1 `inscripcion.desactivada`, 1 `inscripcion.reactivada` |

- GIVEN a student performing the operation
- WHEN it succeeds
- THEN exactly the rows shown exist, with the session user as actor

#### Scenario: Operations that leave no row (table-driven)

| Case |
|---|
| enroll in an already active group |
| group not offered (older period, inactive grupo, inactive asignatura) |
| drop of an already inactive or foreign enrollment |
| cancelled dialog |
| non-student role |
| the data write fails |
| the audit insert fails |

- GIVEN the case from the row
- WHEN the action runs
- THEN no audit row exists for it and the data is unchanged

#### Scenario: Actor from the session

- GIVEN a payload claiming another actor or student
- WHEN an enrollment change succeeds
- THEN the audit row's actor is the session user

### Requirement: Enrollment payloads carry identifiers only (RNF-06, RNF-02)

The payload of an enrollment event MUST be structured data that identifies the
record by stable ids (`estudianteId`, `grupoId`). It MAY carry a closed code
telling whether a deactivation was a drop or a replacement. It MUST NOT carry
the asignatura, the period, the group number, any docente name, email or phone,
the student's name, CIF or email, nor any credential.

#### Scenario: Payload has ids and no names

- GIVEN an enrollment event for a group with a docente
- WHEN the payload is serialized and searched
- THEN it holds the student id and the group id
- AND it contains no `Periodo`, `NumeroGrupo`, asignatura code or name, docente
  name, email or phone, and no student name, CIF or email

#### Scenario: Payload-leak check

- GIVEN all enrollment events of a create, a replace and a drop
- WHEN every payload is searched for password, hash or bcrypt patterns
- THEN none is found
