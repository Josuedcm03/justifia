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
