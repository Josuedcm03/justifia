# Delta for Audit Log

Traceability: RNF-04, RN-27 (retention), RNF-06. Based on the current main
text of `openspec/specs/audit-log/spec.md`.

## ADDED Requirements

### Requirement: Closed set of retention events (RNF-04, RN-27, RNF-06)

The audit actions MUST gain exactly one: `usuario.cancelado`. It MUST use entity
type `Usuario` with the cancelled student's id as entity id, and MUST be built
only through the central builders. Its payload MUST be structured and carry only
counts and the closed code `retencion_5_anios`; it MUST NOT carry names, emails,
`Cif`, free text, request ids or any credential. Existing events and payloads
MUST be unchanged, and no schema change to the audit log's structure is required.

#### Scenario: Action to entity type

- GIVEN a student cancelled by the retention run
- WHEN its audit row is read
- THEN the action is `usuario.cancelado`, the entity type is `Usuario` and the entity id is the student id

#### Scenario: Payload has counts and a code

- GIVEN that row
- WHEN its payload is serialized and searched
- THEN it holds counts and `retencion_5_anios` and no name, email, CIF or text

#### Scenario: Existing events unchanged

- GIVEN a manual write or a request submit
- WHEN its audit rows are read
- THEN they are identical in shape to those written before this change

## MODIFIED Requirements

### Requirement: Audit record content

Every audit record MUST carry: the actor, a timestamp assigned at write time, an
action identifier, the entity type and entity id it concerns, and a structured
summary payload. The actor MUST be the authenticated user who performed the
action, derived from the server-side session, never from client input. The only
exception is the scheduled retention run, which has no human session: its
`usuario.cancelado` records MUST carry the system actor, a persisted account that
cannot authenticate (inactive, unusable credential). No other writer MAY use the
system actor. Records that describe a whole operation rather than one entity MUST
identify that operation as their entity type.
(Previously: the actor was always the authenticated user; no system actor existed.)

#### Scenario: Record carries all fields

- GIVEN any audited write
- WHEN its audit record is read
- THEN actor, timestamp, action, entity type, entity id and a structured summary
  are all present and non-empty

#### Scenario: Actor comes from the session

- GIVEN a request whose body claims a different actor
- WHEN the audited write runs
- THEN the record's actor is the authenticated session user

#### Scenario: Structured summary is machine-readable

- GIVEN an audit record
- WHEN its summary is read
- THEN it is structured data, not free text

#### Scenario: Retention rows carry the system actor

- GIVEN a student cancelled by the scheduled run
- WHEN its `usuario.cancelado` row is read
- THEN the actor is the system actor and no session user is involved

#### Scenario: System actor is not usable

- GIVEN the system actor account
- WHEN a login with any password is attempted, or any non-retention writer builds an event
- THEN the login fails and no non-retention row has the system actor
