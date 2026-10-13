# Delta for Audit Log

Covers RF-07, RF-08, RN-02, RN-15, RNF-06 (a: every read, decision and
modification has exactly one entry), RNF-01. Event names below are the
spec-level contract; design may refine identifiers but not the semantics.

Numbering note: payload minimisation cites RNF-06 and RN-02. In the current
`docs/requirements.md`, RNF-02 is encryption in transit and at rest; the
RNF-02 references in the base `audit-log` spec (Purpose and "Request and
document payloads minimise personal data (RNF-02, RN-02)") use the legacy
numbering and are kept verbatim where a MODIFIED header must match.

Amendment of the Purpose: the sentence "limited to WRITE events" and
"Read-access auditing is out of scope and deferred" no longer holds. Since
`justification-intake` (D13) document downloads are audited, and this change
audits staff reads of personal data. The student reading their own data stays
unaudited.

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Scope limited to write events

This capability MUST audit write events and, by explicit exception, the
following reads of personal data: supporting-document reads (`documento.descargado`,
introduced by `justification-intake` D13) and staff opens of the review queue
and of a request detail (`solicitud.consultada`, `solicitud.cola.consultada`). Other reads
of personal data (viewing, exporting, previewing) MUST NOT be required to
produce audit records, a student's reads of their own requests MUST NOT be
audited, and the dry-run preview MUST NOT write any.
(Previously: "Scope limited to write events" — reads were out of scope, with
no exception for document downloads or staff reads.)

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
(Previously: only the owning student read; no mode in the payload.)

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
