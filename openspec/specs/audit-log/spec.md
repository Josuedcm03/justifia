# Audit Log Specification

## Purpose

RNF-02 requires an inalterable record of modifications of personal data. This
capability defines an append-only audit log of write events and of staff reads of
personal data: it is introduced by the catalog import (`catalog-excel-import`,
`imported-account-provisioning`) and is reusable by later changes. Staff opens of
the review queue and of request details, and supporting-document views and
downloads, are audited; a student reading their own requests is not. The log is
immutable at the database level, not merely by application convention, and is
written atomically with the change it describes. Exact table and column names and
the enforcement mechanism are design decisions; this spec constrains only
observable behavior.

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

This capability MUST audit write events and, by explicit exception, the
following reads of personal data: supporting-document reads (`documento.descargado`,
introduced by `justification-intake` D13) and staff opens of the review queue
and of a request detail (`solicitud.consultada`, `solicitud.cola.consultada`). Other reads
of personal data (viewing, exporting, previewing) MUST NOT be required to
produce audit records, a student's reads of their own requests MUST NOT be
audited, and the dry-run preview MUST NOT write any.

#### Scenario: Preview writes no audit record

- GIVEN a valid workbook
- WHEN it is only previewed
- THEN the audit log is unchanged

#### Scenario: Staff read is in scope

- GIVEN an in-scope secretary opening a request detail
- WHEN the audit log is read
- THEN a `solicitud.consultada` row exists

#### Scenario: Student own read is out of scope

- GIVEN a student opening their own request
- WHEN the audit log is read
- THEN no row was added

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

### Requirement: Closed set of request and document events

The audit actions MUST gain exactly these five: `solicitud.presentada`,
`documento.adjuntado`, `documento.eliminado`, `documento.rechazado`,
`documento.descargado`. The audit entity types MUST gain `Solicitud` and
`DocumentoRespaldo`. Actions map to entity types and the entity id is the
affected record's id: `solicitud.presentada` to `Solicitud`;
`documento.adjuntado`, `documento.eliminado`, and `documento.descargado` to
`DocumentoRespaldo`. `documento.rechazado` concerns no persisted document and
MUST use entity type `Solicitud` with the draft's id. There is no event for
draft creation, autosave, discard, expiry, or orphan cleanup (D14).
Events MUST be built only through the central builders. Existing events and
payloads MUST be unchanged; no schema change to the audit log is required.

#### Scenario: Action to entity type (table-driven)

| Action | Entity type |
|---|---|
| `solicitud.presentada` | `Solicitud` |
| `documento.adjuntado`, `documento.eliminado`, `documento.descargado` | `DocumentoRespaldo` |
| `documento.rechazado` | `Solicitud` |

- GIVEN an event of the kind in the row
- WHEN its audit row is read
- THEN action, entity type, and entity id are as shown

#### Scenario: Existing events unchanged

- GIVEN an import apply or a manual catalog write
- WHEN its audit rows are read
- THEN they are identical in shape to those before this change

### Requirement: One audit row per request operation, same transaction (RNF-06)

Each of these MUST write exactly one audit row inside the same transaction as
its data change: successful submit (`solicitud.presentada`), successful
finalize (`documento.adjuntado`), document removal (`documento.eliminado`). A
rejected finalize MUST write one `documento.rechazado` row (nothing else
changes). A blocked, unauthorized, failed, or cancelled operation MUST write no
row and leave no data change. The actor MUST be the session user, never request
input.

#### Scenario: Successful operations (table-driven)

| Operation | Rows added |
|---|---|
| submit valid draft | 1 `solicitud.presentada` |
| finalize accepted | 1 `documento.adjuntado` |
| remove document | 1 `documento.eliminado` |
| finalize rejected (spoofed) | 1 `documento.rechazado` |

- GIVEN an authorized student performing the operation
- WHEN it completes
- THEN exactly the rows in the row exist with the session user as actor

#### Scenario: Operations that leave no row

- GIVEN a blocked submit, an unauthorized call, or a transaction that rolls back
- WHEN the outcome is read
- THEN no audit row exists for it

#### Scenario: Audit failure aborts the change

- GIVEN a submit whose audit insert fails
- WHEN the transaction runs
- THEN the request stays `borrador`

#### Scenario: Actor from the session

- GIVEN a payload claiming another actor
- WHEN a submit succeeds
- THEN the row's actor is the session user

### Requirement: Draft operations are not audited (D14, RNF-06)

Draft creation, autosave of draft fields, confirmed discard, the expiry sweep,
and the orphan blob sweep MUST write no audit row. A `borrador` is not yet a
presented request, and the system-run sweeps have no human actor while
`EventoAuditoria.ActorId` is NOT NULL; auditing of the request starts at
submission. Sweeps MAY emit structured logs with counts only.

Explicit student actions on a supporting document (`documento.adjuntado`,
`documento.eliminado`, `documento.rechazado`) ARE audited from the first file,
even while the request is a `borrador`: the documents carry sensitive data
(RNF-02) and always have a human actor. Document deletions cascaded by discard,
expiry, or sweeps MUST write no audit row.

#### Scenario: Draft lifecycle leaves no row (table-driven)

| Operation | Rows added |
|---|---|
| create draft | 0 |
| autosave a step | 0 |
| confirmed discard | 0 |
| expiry sweep deletes a draft | 0 |
| orphan sweep deletes a blob | 0 |

- GIVEN the operation in the row completes successfully
- WHEN the audit log is read
- THEN the rows added are as shown

### Requirement: Every supporting-document download is audited (D13, RNF-06 a)

Each successful read of a supporting document, in mode `ver` or `descarga`,
by any authorized reader (owning student or in-scope `secretaria`) MUST write
exactly one `documento.descargado` row with entity type `DocumentoRespaldo`,
the document's id as entity id, the reading session user as actor, and the
mode in the payload. The row MUST be written after authorization succeeds and
the stored file is opened, and before any file bytes are sent; if the audit
insert fails, the download MUST fail with no file bytes. A denied, unknown-id,
out-of-scope or failed download (stored file missing or unreadable) MUST write
no row. Repeated downloads MUST each write their own row. The payload MAY carry
the request id and detected content type; it MUST follow the payload
minimisation rules.

#### Scenario: Successful download

- GIVEN the owning student and a `valido` document
- WHEN they download it
- THEN exactly one `documento.descargado` row exists with entity `DocumentoRespaldo`, the document id, and the student as actor

#### Scenario: Two downloads, two rows

- GIVEN the owner downloads the same document twice
- WHEN the audit log is read
- THEN two `documento.descargado` rows exist for it

#### Scenario: No row on denial or failure (table-driven)

| Case | Rows added |
|---|---|
| anonymous caller | 0 |
| another student | 0 |
| out-of-scope secretary | 0 |
| unknown document id | 0 |
| stored file missing | 0 |

- GIVEN the case in the row
- WHEN the download route is called
- THEN no file bytes are returned and the rows added are as shown

#### Scenario: Audit failure blocks the download

- GIVEN an authorized download whose audit insert fails
- WHEN the route runs
- THEN no file bytes are returned

#### Scenario: Staff read carries the mode

- GIVEN an in-scope secretary opening a document in mode `ver` and then `descarga`
- WHEN the audit log is read
- THEN two rows exist with the secretary as actor and modes `ver` and `descarga`

### Requirement: Request and document payloads minimise personal data (RNF-02, RN-02)

Payloads MUST be structured and identify records by stable ids. They MAY carry
counts (subjects, documents), the detected content type, size, and for
`documento.rechazado` the rejection reason code. They MUST NOT carry the
cause, dates, student name, CIF, email, career, file name, file content, or
storage location or URL, nor any credential.

#### Scenario: Submit payload

- GIVEN a submitted request
- WHEN the `solicitud.presentada` payload is serialized and searched
- THEN it contains no cause, date, name, CIF, email, or career value

#### Scenario: Rejection payload

- GIVEN a rejected upload named `diagnosis.pdf`
- WHEN the `documento.rechazado` payload is searched
- THEN it holds the reason code and no file name or location

#### Scenario: Leak check

- GIVEN all events from one intake flow
- WHEN every payload is searched for store URLs, tokens, or hash patterns
- THEN none is found

### Requirement: Closed set of review events (RF-07, RF-08, RNF-06 a)

The audit actions MUST gain exactly these seven: `solicitud.aprobada`,
`solicitud.rechazada`, `solicitud.devuelta`, `solicitud.corregida`,
`solicitud.consultada`, `solicitud.cola.consultada` and `documento.retirado`.
The entity types MUST gain `Facultad`. Mapping: the first five concern entity
type `Solicitud` with the request id as entity id; `solicitud.cola.consultada`
concerns entity type `Facultad` with the caller's `FacultadId` as entity id;
`documento.retirado` concerns entity type `DocumentoRespaldo` with the document
id as entity id and is written when a correction retires a document of a
previous revision. Events MUST be built only through the
central builders. Existing events and payloads MUST be unchanged, except for
the mode field on `documento.descargado`. No schema change to the audit log is
required.

#### Scenario: Action to entity type (table-driven)

| Action | Entity type | Entity id |
|---|---|---|
| `solicitud.aprobada`, `.rechazada`, `.devuelta` | `Solicitud` | request id |
| `solicitud.corregida` | `Solicitud` | request id |
| `solicitud.consultada` | `Solicitud` | request id |
| `solicitud.cola.consultada` | `Facultad` | facultad id |
| `documento.retirado` | `DocumentoRespaldo` | document id |

- GIVEN an event of the kind in the row
- WHEN its audit row is read
- THEN action, entity type and entity id are as shown

### Requirement: One audit row per decision and correction, same transaction (RF-07, RF-08, RNF-06)

A successful decision MUST write exactly one of `solicitud.aprobada`,
`solicitud.rechazada` or `solicitud.devuelta`, and a successful resubmission of
a returned request MUST write exactly one `solicitud.corregida`, each inside
the same transaction as the state change (per "Audit record is written in the
same transaction as its change"). A refused, unauthorized, out-of-scope,
lost-race, validation-failed or rolled-back operation MUST write no row. The
actor MUST be the session user, never request input.

#### Scenario: Successful operations (table-driven)

| Operation | Rows added |
|---|---|
| approve | 1 `solicitud.aprobada` |
| reject (confirmed) | 1 `solicitud.rechazada` |
| return with RN-17 code | 1 `solicitud.devuelta` |
| owner resubmits a returned request | 1 `solicitud.corregida` |

- GIVEN an authorized actor performing the operation
- WHEN it completes
- THEN exactly the rows in the row exist with the session user as actor

#### Scenario: Lost race writes no row

- GIVEN two secretaries deciding the same request at once
- WHEN both complete
- THEN exactly one decision audit row exists

#### Scenario: Nothing written on refusal (table-driven)

| Case |
|---|
| reject with empty text |
| return with a code outside RN-17 |
| decision by another role |
| decision on an out-of-scope request |
| decision on an already decided request |
| the audit insert fails |

- GIVEN the case from the row
- WHEN the action runs
- THEN no audit row exists and the request is unchanged

### Requirement: Staff reads are audited (RNF-06 a, RNF-01)

Each time a `secretaria` in scope successfully opens a request detail the
system MUST write exactly one `solicitud.consultada` row; each time a
`secretaria` successfully opens the queue it MUST write exactly one
`solicitud.cola.consultada` row. A denied, out-of-scope, unknown-id or failed open MUST
write no row. A single page render MUST write one row regardless of framework
prefetch, re-render or navigation caching, and a test MUST cover this
exactly-once behavior. The audit insert MUST NOT be skipped silently: if it
fails, the page MUST NOT return the data. Reads by a student of their own
requests (list, detail, correction screen) MUST NOT be audited.

#### Scenario: Detail open

- GIVEN an in-scope secretary
- WHEN they open a request detail once
- THEN exactly one `solicitud.consultada` row exists with them as actor

#### Scenario: Queue open

- GIVEN an in-scope secretary
- WHEN they open the queue once
- THEN exactly one `solicitud.cola.consultada` row exists

#### Scenario: Prefetch and re-render do not duplicate

- GIVEN a detail link rendered in the queue and a re-render of the page
- WHEN the secretary has not yet opened the detail
- THEN no `solicitud.consultada` row exists; after one open there is exactly one

#### Scenario: Denied open writes nothing

- GIVEN a secretary of facultad A opening a facultad B request, or a student opening the queue
- WHEN the request is processed
- THEN no row is written

#### Scenario: Audit failure blocks the read

- GIVEN an in-scope detail open whose audit insert fails
- WHEN the page runs
- THEN no request data is returned

#### Scenario: Student reads are not audited

- GIVEN a student opening `/requests` and `/requests/[id]` for their own request
- WHEN the audit log is read
- THEN no row was added

### Requirement: Review payloads minimise personal data (RNF-06, RN-02)

Payloads of the review events MUST be structured and identify records by
stable ids. Decision payloads MAY carry the previous and new state, the
template code and, for return, the RN-17 reason code, and counts. Read payloads
MAY carry the request state (`solicitud.consultada`) or the number of
requests listed (`solicitud.cola.consultada`, count only). Payloads MUST NOT carry the
decision text or any free text, student name, CIF, email, career, cause, dates,
file name, or the list of request ids of the queue, nor any credential.
`documento.descargado` payloads MUST carry the mode (`ver` or `descarga`).

#### Scenario: Decision payload has codes, no text

- GIVEN a rejection with a confirmed text containing a diagnosis
- WHEN the `solicitud.rechazada` payload is serialized and searched
- THEN it contains no part of the text, name, CIF, email or date

#### Scenario: Return payload has the code

- GIVEN a return with `fecha_alterada`
- WHEN the `solicitud.devuelta` payload is read
- THEN it carries the code `fecha_alterada` and no free text

#### Scenario: Queue open payload is count only

- GIVEN a queue of three requests
- WHEN `solicitud.cola.consultada` is read
- THEN it carries the count 3 and no request id

#### Scenario: Download mode recorded

- GIVEN a staff attachment download
- WHEN its `documento.descargado` payload is read
- THEN it carries mode `descarga`

### Requirement: Closed set of remission events

The audit actions MUST gain exactly these six: `remision.creada`,
`remision.enviada`, `remision.fallida`, `remision.bloqueada`,
`remision.reenviada`, `documento.formato_especial`. The entity types MUST gain
`Remision` (entity id is the remission id); `documento.formato_especial` is
recorded against the uploaded document (existing entity type `DocumentoRespaldo`,
the document id) once per valid upload, in the upload's transaction. A refused
staff upload MUST reuse the existing `documento.rechazado` event with its
existing payload shape. `remision.creada` MUST be written in the approval transaction,
one per remission. `remision.enviada` MUST be written when a send succeeds,
`remision.fallida` when it fails, `remision.bloqueada` when a blocker is
detected, and `remision.reenviada` when a secretary triggers a resend. Events
MUST be built only through the central builders. Existing events and payloads
MUST be unchanged.

#### Scenario: Approval events
- GIVEN an approval creating two remissions
- WHEN the audit rows are read
- THEN one `solicitud.aprobada` and two `remision.creada` exist, committed together

#### Scenario: Send outcomes (table-driven)

| Outcome | Row |
|---|---|
| send succeeds | `remision.enviada` |
| provider error | `remision.fallida` |
| missing email, missing format, size over limit | `remision.bloqueada` |
| secretary resend | `remision.reenviada` |

- GIVEN the outcome in the row
- WHEN it completes
- THEN the row shown exists with entity type `Remision`

#### Scenario: Format upload audited
- GIVEN a secretary uploading a valid special-format file
- WHEN the upload succeeds
- THEN one `documento.formato_especial` row exists for the document with the secretary as actor
- AND its payload holds only the request id, file type code, size in bytes and the count of unblocked remissions, no file name, name or email

#### Scenario: Refused format audited
- GIVEN a secretary uploading a file whose real format or size is refused
- WHEN the upload is refused
- THEN one `documento.rechazado` row exists with the request id and reason code, and no `documento.formato_especial` row

#### Scenario: No row without an attempt
- GIVEN a denied, out-of-scope or `already_attached` resend or upload, or a retry that finds only `enviada` remissions
- WHEN processed
- THEN no audit row is written

### Requirement: Remission and format-upload payloads are code-only

Remission and `documento.formato_especial` payloads MUST be structured,
identify records by ids, and MAY carry the reason code, attachment count, file
type code, size in bytes, unblocked-remission count and the request id. They MUST NOT carry email
addresses, teacher or student names, CIF, cause, message text, file names,
provider response bodies, storage locations, or any credential.

#### Scenario: Leak check
- GIVEN all remission events of one approval, including a failed send whose provider error contains an email
- WHEN every payload is serialized and searched
- THEN no email, name, cause, file name, URL or token is found

### Requirement: Actor of remission events

Events from a secretary action (approval, resend, format upload) MUST carry the session user
as actor. Events from the scheduled retry have no human session and MUST be
attributed to the approving secretary of the request; the actor MUST never come
from request input.

#### Scenario: Scheduled retry actor
- GIVEN a pending remission retried by the scheduled job
- WHEN its audit row is read
- THEN the actor is the secretary who approved the request

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
