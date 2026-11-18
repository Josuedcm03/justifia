# Delta for Audit Log

Covers RF-17 (e), RF-13, RNF-06 (a). Slice tags: **[S1]** dashboard view;
**[S2]** detail view; **[S3]** download. Each slice adds its own action; the
closed set below is introduced in S1 with the dashboard action and extended by
S2 and S3. Action names are proposed; the design may rename them but MUST keep
the closed set of three and the mapping.

## MODIFIED Requirements

### Requirement: Scope limited to write events

This capability MUST audit write events and, by explicit exception, the
following reads of personal data: supporting-document reads (`documento.descargado`,
introduced by `justification-intake` D13), staff opens of the review queue
and of a request detail (`solicitud.consultada`, `solicitud.cola.consultada`),
and the coordination report views and downloads (`solicitud.ranking.consultado`,
`solicitud.reporte.consultado`, `solicitud.reporte.descargado`). Other reads
of personal data (viewing, exporting, previewing) MUST NOT be required to
produce audit records, a student's reads of their own requests MUST NOT be
audited, and the dry-run preview MUST NOT write any.
(Previously: the exception list stopped at the supporting-document reads and the staff queue and detail opens.)

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

#### Scenario: Coordination report read is in scope

- GIVEN a coordinator opening the dashboard
- WHEN the audit log is read
- THEN a `solicitud.ranking.consultado` row exists

## ADDED Requirements

### Requirement: Closed set of report events (RF-17 e, RF-13, RNF-06 a) [S1, S2, S3]

The audit actions MUST gain exactly these three: `solicitud.ranking.consultado`
(S1), `solicitud.reporte.consultado` (S2) and `solicitud.reporte.descargado`
(S3). The entity types MUST gain `Carrera`, and each event MUST use it with the
coordinator's `carreraId` as entity id. Events MUST be built only through the
central builders. Existing events and payloads MUST be unchanged, and no schema
change to the audit log is required.

#### Scenario: Action to entity type (table-driven)

| Action | Entity type | Entity id |
|---|---|---|
| `solicitud.ranking.consultado` | `Carrera` | carrera id |
| `solicitud.reporte.consultado` | `Carrera` | carrera id |
| `solicitud.reporte.descargado` | `Carrera` | carrera id |

- GIVEN an event of the kind in the row
- WHEN its audit row is read
- THEN action, entity type and entity id are as shown and the actor is the session user

#### Scenario: Existing events unchanged

- GIVEN a review decision or a document download
- WHEN its audit rows are read
- THEN they are identical in shape to those written before this change

### Requirement: One audit row per report view and download (RNF-06 a) [S1, S2, S3]

Each successful render of the dashboard and of the detail, and each successful
download, MUST write exactly one row of its action. A denied, `none`-scope,
unknown or failed operation MUST write no row. A single render MUST write one
row regardless of prefetch, re-render or navigation caching, and a test MUST
cover it. The row MUST be written after the data load and, for a download,
before any bytes are sent. If the insert fails the page or route MUST NOT return
the data. The actor MUST be the session user, never request input. Repeated
downloads each write their own row.

#### Scenario: Successful operations (table-driven)

| Operation | Rows added |
|---|---|
| open dashboard | 1 `solicitud.ranking.consultado` |
| open detail | 1 `solicitud.reporte.consultado` |
| download workbook | 1 `solicitud.reporte.descargado` |
| download twice | 2 `solicitud.reporte.descargado` |

- GIVEN an in-scope coordinator performing the operation
- WHEN it succeeds
- THEN exactly the rows shown exist with the session user as actor

#### Scenario: Operations that leave no row (table-driven)

| Case |
|---|
| unauthorized role or anonymous caller |
| coordinator without a career |
| the data read fails |
| the audit insert fails (and no data or bytes are returned) |

- GIVEN the case from the row
- WHEN the operation runs
- THEN no audit row exists for it

#### Scenario: Prefetch and re-render do not duplicate

- GIVEN a link to a report page rendered in the sidebar and a re-render of the page
- WHEN the coordinator has not opened it
- THEN no report row exists; after one open there is exactly one

### Requirement: Report payloads are codes and counts only (RNF-06, RN-02) [S1, S2, S3]

Report payloads MUST be structured and MAY carry: the period code, a teacher
id, a cause code, a flag that a student term was used, the total or row count,
the number of entries shown per ranking, and the page. They MUST NOT carry the
student search term, any student name, CIF, email, cause of a named student,
absence dates, request ids, teacher or subject names, the list of entries, nor
any credential.

#### Scenario: Dashboard payload

- GIVEN a dashboard open for `2026-S2` showing rankings of 10, 4 and 7 entries
- WHEN the payload is read
- THEN it holds the period code and the counts and no name, CIF or request id

#### Scenario: Student term never stored

- GIVEN a detail open filtered by the student term "Maria Lopez"
- WHEN the payload is serialized and searched
- THEN the term does not appear and a "student term used" flag is true

#### Scenario: Download payload

- GIVEN a download with a period and cause filter returning 12 requests
- WHEN the payload is read
- THEN it holds the period code, the cause code and the count 12, and no student data
