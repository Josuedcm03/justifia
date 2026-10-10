# Audit Log Specification

## Purpose

RNF-02 requires an inalterable record of modifications of personal data. This
capability defines an append-only audit log limited to WRITE events: it is
introduced by the catalog import (`catalog-excel-import`,
`imported-account-provisioning`) and is reusable by later changes. Read-access
auditing is out of scope and deferred. The log is immutable at the database level,
not merely by application convention, and is written atomically with the change it
describes. Exact table and column names and the enforcement mechanism are design
decisions; this spec constrains only observable behavior.

## Requirements

### Requirement: Audit records are append-only and immutable

Audit records MUST be immutable once written. The database MUST reject every
`UPDATE` and every `DELETE` on the audit log, including when issued by the
application's own database role, independently of any application code. Only
`INSERT` and `SELECT` MUST succeed. Rejection MUST NOT depend on the caller being
well behaved.

#### Scenario: Update attempt is rejected

- GIVEN an existing audit record
- WHEN an `UPDATE` is issued against it through the application role
- THEN the database rejects the statement and the record is unchanged

#### Scenario: Delete attempt is rejected

- GIVEN an existing audit record
- WHEN a `DELETE` is issued against it through the application role
- THEN the database rejects the statement and the record still exists

#### Scenario: Bulk delete or truncate is rejected

- GIVEN an audit log with records
- WHEN a bulk `DELETE` without filter, or a `TRUNCATE`, is issued through the
  application role, targeting the log as a whole or any one of its child
  partitions directly
- THEN it is rejected and no record is removed

#### Scenario: Insert still works

- GIVEN the application role
- WHEN a new audit record is inserted
- THEN it succeeds and can be read back

### Requirement: Audit record content

Every audit record MUST carry: the actor (the authenticated user who performed the
action), a timestamp assigned at write time, an action identifier, the entity type
and entity id it concerns, and a structured summary payload. The actor MUST be
derived from the server-side session, never from client input. Records that
describe a whole operation rather than one entity MUST identify that operation as
their entity type.

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

### Requirement: No secrets in audit payloads

Credentials MUST NEVER appear in any audit record: no plaintext password, no
temporary password and no password hash (bcrypt or otherwise), in any field or
nested value of the payload. Personal data in payloads MUST be minimised: a
payload MUST identify people by stable identifiers (entity id, `Cif`) and MUST NOT
copy attributes that are not needed to understand the event.

#### Scenario: Payload-leak check after an import that creates accounts

- GIVEN an apply that created accounts with generated temporary passwords
- WHEN every audit record written by that apply is serialized and searched
- THEN none contains any of the temporary passwords, any `HashClave` value or any
  bcrypt hash pattern

#### Scenario: Personal data is minimised

- GIVEN an audit record for a created or updated account
- WHEN its payload is inspected
- THEN it contains no attribute beyond the identifiers and the changed-field
  names or non-credential values needed to describe the event

#### Scenario: Credential fields are never accepted

- GIVEN a caller attempting to write an audit record whose payload includes a
  credential field
- WHEN the record is built
- THEN the credential is excluded or the write is refused, and it is never
  persisted

### Requirement: Audit record is written in the same transaction as its change

An audit record MUST be written inside the same database transaction as the change
it describes, so that both commit together or neither does. If the transaction
rolls back for any reason, the audit records written within it MUST NOT remain. A
change that writes data MUST NOT succeed without its audit record, and an audit
record MUST NOT exist for a change that did not commit.

#### Scenario: Happy path commits change and audit together

- GIVEN an audited write that succeeds
- WHEN the transaction commits
- THEN the change and its audit record both exist

#### Scenario: Rollback leaves no audit record

- GIVEN an audited write followed by a failure that rolls the transaction back
- WHEN the transaction ends
- THEN neither the change nor any audit record from that transaction exists

#### Scenario: Audit write failure aborts the change

- GIVEN an audited write whose audit insert fails
- WHEN the transaction runs
- THEN the whole transaction rolls back and the change does not persist

#### Scenario: Failed import leaves no audit row

- GIVEN a catalog import apply that fails or is aborted
- WHEN the outcome is returned
- THEN the audit log contains no record from that apply

### Requirement: Scope limited to write events

This capability MUST audit write events only. Reads of personal data (viewing,
exporting, previewing) MUST NOT be required to produce audit records, and the
dry-run preview MUST NOT write any.

#### Scenario: Preview writes no audit record

- GIVEN a valid workbook
- WHEN it is only previewed
- THEN the audit log is unchanged

### Requirement: Closed set of manual catalog events

The set of audit actions MUST gain exactly these eight: `asignatura.creada`,
`asignatura.actualizada`, `asignatura.desactivada`, `asignatura.reactivada`,
`grupo.creado`, `grupo.actualizado`, `grupo.desactivado`, `grupo.reactivado`.
All eight are written by manual writes by staff; `asignatura.reactivada` is
also written by the import apply (see "Import audit"); no import writes any
other of the eight. The set of audit entity types MUST gain
`Asignatura` and `Grupo`. An event with one of these actions MUST identify the
affected record by its id as the entity id and its entity type. Events MUST
continue to be constructible only through the central builders; no other action
or entity type is introduced by this change. Existing events and their payloads
MUST be unchanged, except that the import-level record gains two counts (see
the `catalog-excel-import` delta). No schema change to the audit log is required.

#### Scenario: Action to entity type (table-driven)

| Action | Entity type |
|---|---|
| `asignatura.creada`, `.actualizada`, `.desactivada`, `.reactivada` | `Asignatura` |
| `grupo.creado`, `.actualizado`, `.desactivado`, `.reactivado` | `Grupo` |

- GIVEN a manual write of the kind in the row
- WHEN its audit row is read
- THEN the action and entity type are as shown and the entity id is the id of
  the affected record

#### Scenario: Existing events are unaffected

- GIVEN an import apply that creates accounts
- WHEN its audit rows are read
- THEN the account events are identical in shape to those written before this
  change

### Requirement: One audit row per manual write, in the same transaction

Every successful manual create, update, deactivation and reactivation of an
`Asignatura` or a `Grupo` MUST write exactly one audit row, inside the same
transaction as the data change (per "Audit record is written in the same
transaction as its change"). A refused, invalid, unauthorized, no-op or failed
write MUST write no audit row and leave no data change. The actor MUST be the
authenticated session user, never a value from the request.

#### Scenario: Successful writes (table-driven)

| Write | Audit rows added |
|---|---|
| create Asignatura | 1 (`asignatura.creada`) |
| edit Asignatura with changed fields | 1 (`asignatura.actualizada`) |
| deactivate Asignatura | 1 (`asignatura.desactivada`) |
| reactivate Asignatura | 1 (`asignatura.reactivada`) |
| create Grupo | 1 (`grupo.creado`) |
| edit Grupo with a changed docente, changed days, or both | 1 (`grupo.actualizado`) |
| deactivate Grupo | 1 (`grupo.desactivado`) |
| reactivate Grupo | 1 (`grupo.reactivado`) |

- GIVEN a valid in-scope request by a staff actor
- WHEN the write succeeds
- THEN exactly the audit rows in the row exist for it, with the session user as
  actor

#### Scenario: Writes that must leave no row (table-driven)

| Case |
|---|
| validation failure |
| duplicate key |
| deactivate Asignatura with active groups |
| out-of-scope record |
| unauthorized role |
| edit with no changed field |
| deactivate an already inactive record |
| the data write fails after the audit insert |
| the audit insert fails |
| the write cannot start because catalog writes are busy |

- GIVEN the case from the row
- WHEN the action runs
- THEN no audit row exists for it and the data is unchanged

#### Scenario: Actor from the session

- GIVEN a request whose body claims another actor
- WHEN a manual write succeeds
- THEN the audit row's actor is the session user

### Requirement: Manual event payloads carry field names only

The payload of a manual catalog event MUST be structured data that carries the
discriminator `origen` with value `manual`. For `asignatura.actualizada` and
`grupo.actualizado` it MUST list the names of the fields that changed, and MUST
NOT contain the old or the new values of any field. For
`asignatura.creada` and `grupo.creado` it MUST list field names only. A manual
payload MUST NOT carry a file digest. Where a
payload needs to relate a record to its parent it MUST use stable identifiers
(for example the parent record id), not names or other personal data. No
payload may contain any credential (password, temporary password or hash).
Only a closed list of auditable field names is allowed; a field not on the list
can never be reported as changed. Amendment 2026-10-07: the closed list of
auditable `Grupo` fields MUST include `dias` (the meeting days). A change to the
set of days is reported by the name `dias` only, never by the day values, and
never by the number of days. Two selections of the same set in a different
order are not a change.

#### Scenario: Update lists names, not values

- GIVEN an Asignatura whose `Nombre` and `HorasTotales` are edited
- WHEN its audit payload is read
- THEN it names the two fields and `origen` is `manual`
- AND neither the old nor the new `Nombre` nor hours appear anywhere in it

#### Scenario: Days-only update names `dias` and no day

- GIVEN a Grupo meeting on Monday whose days are edited to Monday and Thursday
  and nothing else changes
- WHEN its audit payload is read
- THEN the field list is exactly `dias` and `origen` is `manual`
- AND the serialized payload contains no day name, day number or count of days

#### Scenario: Created Grupo payload carries no day values

- GIVEN a Grupo created manually with Tuesday and Friday
- WHEN its `grupo.creado` payload is serialized and searched
- THEN it may list the field name `dias` and contains no day value

#### Scenario: Same set in another order is not audited

- GIVEN a Grupo meeting on Monday and Wednesday
- WHEN an edit submits Wednesday and Monday and nothing else changes
- THEN no audit row is written

#### Scenario: Origin discriminator present

- GIVEN any manual catalog event
- WHEN its payload is read
- THEN `origen` equals `manual`

#### Scenario: No values in create, deactivate, reactivate

- GIVEN a created Grupo
- WHEN its payload is serialized and searched
- THEN it contains no `Periodo`, `NumeroGrupo` or docente name or email value

#### Scenario: Payload-leak check

- GIVEN a set of manual catalog events written for a Grupo with a docente
- WHEN every audit payload is serialized and searched for any `HashClave`,
  password or bcrypt pattern
- THEN none is found

### Requirement: Import audit: import-level record plus one event per reactivated Asignatura

The import MUST continue to describe its catalog writes through the single
import-level record. The only per-record catalog events it writes are
`asignatura.reactivada`, one for each `Asignatura` the apply reactivated, so
that a durable record exists of which manual deactivations the import undid.
Each such event MUST be written in the same transaction as the apply, have
entity type `Asignatura` and the reactivated record's id as entity id, and carry
a payload that lists field names only from the closed list (here only `activo`),
no value of any field, the discriminator `origen` with value `importacion`, and
the SHA-256 of the imported file. The payload MUST NOT contain `Codigo`, `Nombre`
or any other cell content, nor any credential. The import MUST NOT write any
other `asignatura.*` or `grupo.*` event; the manual-origin events are otherwise
written only by manual actions.

#### Scenario: Reactivation by import is audited per record

- GIVEN an apply that reactivates asignaturas A and B
- WHEN the audit rows written by it are read
- THEN there are exactly two `asignatura.reactivada` events, one per record id,
  each with entity type `Asignatura`, `origen` `importacion` and the file's
  SHA-256, in addition to the import-level record

#### Scenario: Import emits no other per-record catalog events

- GIVEN an apply that creates, updates, deactivates and reactivates asignaturas
  and grupos
- WHEN the audit rows written by it are read
- THEN the only `asignatura.*` or `grupo.*` actions among them are the
  `asignatura.reactivada` events for the reactivated asignaturas

#### Scenario: No reactivation, no event

- GIVEN an apply that reactivates no asignatura
- WHEN the audit rows written by it are read
- THEN none has an `asignatura.*` or `grupo.*` action

#### Scenario: Import reactivation payload has no values

- GIVEN an `asignatura.reactivada` event written by an import
- WHEN its payload is serialized and searched
- THEN it contains no `Codigo`, `Nombre`, hours or credential value, and the
  origin is distinguishable from a manual event by `origen`

#### Scenario: Event and data change commit together

- GIVEN an apply that fails or rolls back after planning a reactivation
- WHEN the audit log is read
- THEN no `asignatura.reactivada` event and no import-level record exist for it

## Assumptions and open questions

- Assumption (user decision, binding): the append-only audit log for WRITE events
  is in scope of F2; read-access auditing (the "access" half of RNF-02) is
  deferred to a later change.
- Assumption: which application-role privileges are revoked, and whether
  immutability is enforced by triggers, privileges or both, is a design decision;
  the requirement is that the database itself rejects `UPDATE` and `DELETE`.
- Assumption: the application role is also the owner of the log, because the
  same role runs the migrations. Owner-level DDL therefore remains possible
  (for example disabling a trigger, or dropping or detaching a partition), as
  does any superuser action. Immutability is guaranteed against the application's
  data statements (`UPDATE`, `DELETE`, `TRUNCATE`), not against owner-level DDL.
- Assumption: the log's physical organisation MUST permit time-bounded removal
  of old records without row-level DML, so a lawful retention purge never
  requires weakening the immutability guarantee.
- Documented residual: dropping or detaching a time-bounded portion of the log
  (a partition) by the owning role is explicitly NOT rejected by the
  immutability guarantee. This is the intended retention path and also a way to
  erase history; closing it needs a separate, less-privileged application role,
  which is out of scope. The retention period is still unknown, and no purge is
  implemented in F2.
- Assumption: retention, archival and read UI for the audit log are out of scope.
- Assumption: "personal data minimised" allows identifiers and changed-field
  names; the exact allow-list is fixed at design.
