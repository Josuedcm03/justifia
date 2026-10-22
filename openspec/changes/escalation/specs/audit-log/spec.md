# Delta for Audit Log

Covers RF-10, RF-15, RN-20, RNF-01, RNF-02, RNF-06. Escalation behavior is in
`coordination-escalation`. No schema change to the audit log is required.

## ADDED Requirements

### Requirement: Closed set of escalation events (RF-10, RF-15, RNF-06 a)

The audit actions MUST gain exactly these eight: `solicitud.escalada`,
`solicitud.escalamiento_resuelto`, `solicitud.reporte_inasistencias`,
`escalamiento.notificacion_enviada`, `escalamiento.notificacion_fallida`,
`escalamiento.notificacion_bloqueada`, `escalamiento.notificacion_reenviada`
and `escalamiento.cola.consultada`. The entity types MUST gain `Escalamiento`
and `Carrera`. Events MUST be built only through the central builders.
Existing events and payloads MUST be unchanged, except as modified below.

#### Scenario: Action to entity type (table-driven)

| Action | Entity type | Entity id |
|---|---|---|
| `solicitud.escalada` | `Solicitud` | request id |
| `solicitud.escalamiento_resuelto` | `Solicitud` | request id |
| `solicitud.reporte_inasistencias` | `Solicitud` | request id |
| `escalamiento.notificacion_enviada`, `.notificacion_fallida`, `.notificacion_bloqueada`, `.notificacion_reenviada` | `Escalamiento` | escalation record id |
| `escalamiento.cola.consultada` | `Carrera` | caller's `CarreraId` |

- GIVEN an event of the kind in the row
- WHEN its audit row is read
- THEN action, entity type and entity id are as shown

#### Scenario: Existing events unchanged

- GIVEN an approval, a decision or a remission send
- WHEN its audit rows are read
- THEN they are identical in shape to those before this change

### Requirement: One audit row per escalation operation, same transaction (RNF-06)

A successful escalation MUST write exactly one `solicitud.escalada`; a
successful coordination answer exactly one `solicitud.escalamiento_resuelto`;
a successful report (with its notice) exactly one `solicitud.reporte_inasistencias`;
each inside the same transaction as its state or data change. A send MUST
write `escalamiento.notificacion_enviada` when it succeeds,
`escalamiento.notificacion_fallida` when it fails,
`escalamiento.notificacion_bloqueada` when no recipient exists, and
`escalamiento.notificacion_reenviada` when a secretary triggers a resend that
attempts a send. A refused, unauthorized, out-of-scope, lost-race,
validation-failed, rolled-back operation, a resend of an `enviada`
notification, or a scheduled run that finds nothing to send MUST write no row.
The actor MUST be the session user, never request input.

#### Scenario: Successful operations (table-driven)

| Operation | Rows added |
|---|---|
| escalate | 1 `solicitud.escalada` |
| coordination answer | 1 `solicitud.escalamiento_resuelto` |
| record report | 1 `solicitud.reporte_inasistencias` |
| send succeeds | 1 `escalamiento.notificacion_enviada` |
| provider error | 1 `escalamiento.notificacion_fallida` |
| no recipient | 1 `escalamiento.notificacion_bloqueada` |
| secretary resend that sends | 1 `escalamiento.notificacion_reenviada` |

- GIVEN an authorized actor performing the operation
- WHEN it completes
- THEN exactly the rows in the row exist with the session user as actor (or the attributed user for the scheduled job)

#### Scenario: Nothing written on refusal (table-driven)

| Case |
|---|
| escalation with empty note |
| escalation of a non-pendiente request |
| escalation refused because the career has no active `coordinacion` account (E17) |
| answer by another career's coordinator |
| report on a non-aprobada request |
| lost race on escalation or answer |
| resend of an `enviada` notification |
| the audit insert fails |

- GIVEN the case from the row
- WHEN the action runs
- THEN no audit row exists and the data is unchanged

### Requirement: Escalation payloads are code-only (RNF-02, RNF-06)

Escalation payloads MUST be structured and identify records by stable ids.
They MAY carry the reason code, the previous and new state, the escalation
record id, the report id, the notification reason code, the number of
recipients and the request id. They MUST NOT carry the note, the answer or any
free text, student, teacher or coordinator names, CIF, email addresses, cause,
dates, message text, provider response bodies or any credential.
`escalamiento.cola.consultada` MUST carry the count only.

#### Scenario: Payloads hold codes only

- GIVEN an escalation with a note naming a diagnosis, an answer, a report naming a teacher, and a failed send whose provider error contains an email
- WHEN every payload of those events is serialized and searched
- THEN no part of the note or answer, no name, CIF, email or date is found

#### Scenario: Escalation payload

- GIVEN a successful escalation
- WHEN its `solicitud.escalada` payload is read
- THEN it carries the reason `sospecha_documento` and the previous and new state

### Requirement: Actor of notification events from the scheduled job

Notification events from a secretary action (escalation, report, resend) MUST
carry the session user as actor. Events from the scheduled retry have no human
session and MUST be attributed to the secretary who created the escalation
record; the actor MUST never come from request input.

#### Scenario: Scheduled retry actor

- GIVEN a `pendiente` notification retried by the scheduled job
- WHEN its audit row is read
- THEN the actor is the secretary who escalated or recorded the report

## MODIFIED Requirements

### Requirement: Scope limited to write events

This capability MUST audit write events and, by explicit exception, the
following reads of personal data: supporting-document reads (`documento.descargado`,
introduced by `justification-intake` D13), staff opens of the review queue
and of a request detail (`solicitud.consultada`, `solicitud.cola.consultada`),
and the coordinator's opens of the escalation list and of an escalated request
detail (`escalamiento.cola.consultada`, `solicitud.consultada`). Other reads
of personal data (viewing, exporting, previewing) MUST NOT be required to
produce audit records, a student's reads of their own requests MUST NOT be
audited, and the dry-run preview MUST NOT write any.
(Previously: the exception covered secretary reads only.)

#### Scenario: Preview writes no audit record

- GIVEN a valid workbook
- WHEN it is only previewed
- THEN the audit log is unchanged

#### Scenario: Staff read is in scope

- GIVEN an in-scope secretary opening a request detail
- WHEN the audit log is read
- THEN a `solicitud.consultada` row exists

#### Scenario: Coordinator read is in scope

- GIVEN a coordinator opening the detail of an escalated request of their career
- WHEN the audit log is read
- THEN a `solicitud.consultada` row exists with the coordinator as actor

#### Scenario: Student own read is out of scope

- GIVEN a student opening their own request
- WHEN the audit log is read
- THEN no row was added

### Requirement: Every supporting-document download is audited (D13, RNF-06 a)

Each successful read of a supporting document, in mode `ver` or `descarga`,
by any authorized reader (owning student, in-scope `secretaria`, or
`coordinacion` of the request's career for a request in coordination) MUST
write exactly one `documento.descargado` row with entity type
`DocumentoRespaldo`, the document's id as entity id, the reading session user
as actor, and the mode in the payload. The row MUST be written after
authorization succeeds and the stored file is opened, and before any file
bytes are sent; if the audit insert fails, the download MUST fail with no file
bytes. A denied, unknown-id, out-of-scope or failed download (stored file
missing or unreadable) MUST write no row. Repeated downloads MUST each write
their own row. The payload MAY carry the request id and detected content type;
it MUST follow the payload minimisation rules.
(Previously: authorized readers were the owning student and the in-scope `secretaria`.)

#### Scenario: Successful download

- GIVEN the owning student and a `valido` document
- WHEN they download it
- THEN exactly one `documento.descargado` row exists with entity `DocumentoRespaldo`, the document id, and the student as actor

#### Scenario: Coordinator read audited

- GIVEN a coordinator of career C and a `valido` document of a request of career C in `en_revision_coordinacion`
- WHEN they open it in mode `ver`
- THEN exactly one `documento.descargado` row exists with the coordinator as actor and mode `ver`

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
| coordinator of another career | 0 |
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

### Requirement: Staff reads are audited (RNF-06 a, RNF-01)

Each time a `secretaria` in scope successfully opens a request detail the
system MUST write exactly one `solicitud.consultada` row; each time a
`secretaria` successfully opens a tab of the review list (Pendientes,
En coordinacion or Aprobadas) it MUST write exactly one
`solicitud.cola.consultada` row. Each time a `coordinacion` of the request's
career successfully opens the detail of a request with an open escalation or a
notice it MUST write exactly one `solicitud.consultada` row, and each time it
successfully opens its escalation list exactly one `escalamiento.cola.consultada`
row. A denied, out-of-scope, unknown-id or failed open MUST write no row. A
single page render MUST write one row regardless of framework prefetch,
re-render or navigation caching, and a test MUST cover this exactly-once
behavior. The audit insert MUST NOT be skipped silently: if it fails, the page
MUST NOT return the data. Reads by a student of their own requests (list,
detail, correction screen) MUST NOT be audited.
(Previously: secretary opens of one queue and the detail only; no coordinator reads, no tabs.)

#### Scenario: Detail open

- GIVEN an in-scope secretary
- WHEN they open a request detail once
- THEN exactly one `solicitud.consultada` row exists with them as actor

#### Scenario: Tab open

- GIVEN an in-scope secretary
- WHEN they open the En coordinacion tab once
- THEN exactly one `solicitud.cola.consultada` row exists

#### Scenario: Coordinator list and detail

- GIVEN a coordinator of career C
- WHEN they open the list once and one escalated detail once
- THEN one `escalamiento.cola.consultada` row (entity `Carrera`) and one `solicitud.consultada` row exist with them as actor

#### Scenario: Prefetch and re-render do not duplicate

- GIVEN a detail link rendered in a tab and a re-render of the page
- WHEN the user has not yet opened the detail
- THEN no `solicitud.consultada` row exists; after one open there is exactly one

#### Scenario: Denied open writes nothing

- GIVEN a secretary of facultad A opening a facultad B request, a coordinator opening a request of another career, or a student opening the queue
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
requests listed together with the tab code (`pendiente`, `en_revision_coordinacion`
or `aprobada`) for `solicitud.cola.consultada` (count and tab code only).
Payloads MUST NOT carry the decision text or any free text, student name, CIF,
email, career, cause, dates, file name, or the list of request ids of the
queue, nor any credential. `documento.descargado` payloads MUST carry the mode
(`ver` or `descarga`).
(Previously: `solicitud.cola.consultada` carried the count only, with no tab code.)

#### Scenario: Decision payload has codes, no text

- GIVEN a rejection with a confirmed text containing a diagnosis
- WHEN the `solicitud.rechazada` payload is serialized and searched
- THEN it contains no part of the text, name, CIF, email or date

#### Scenario: Return payload has the code

- GIVEN a return with `fecha_alterada`
- WHEN the `solicitud.devuelta` payload is read
- THEN it carries the code `fecha_alterada` and no free text

#### Scenario: Tab open payload is count and tab code

- GIVEN a Pendientes tab of three requests
- WHEN `solicitud.cola.consultada` is read
- THEN it carries the count 3 and the tab code `pendiente` and no request id

#### Scenario: Download mode recorded

- GIVEN a staff attachment download
- WHEN its `documento.descargado` payload is read
- THEN it carries mode `descarga`
