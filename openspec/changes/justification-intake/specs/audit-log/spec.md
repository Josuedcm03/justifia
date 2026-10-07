# Audit Log Specification (delta)

> Base for this delta: `openspec/changes/catalog-excel-import/specs/audit-log/spec.md`
> plus `openspec/changes/catalog-management/specs/audit-log/spec.md`
> (`openspec/specs/` is empty because those changes are not archived yet).
> Apply after both. Existing requirements are unchanged; this delta only adds.
> Covers RNF-06, RNF-02, RF-01, RF-02, RN-02. Decisions D13, D14 (`preproposal.yaml` rev 6).

## ADDED Requirements

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

Each successful download of a supporting document MUST write exactly one
`documento.descargado` row with entity type `DocumentoRespaldo`, the document's
id as entity id, and the downloading session user as actor. The row MUST be
written after authorization succeeds and the stored file is opened, and before
any file bytes are sent; if the audit insert fails, the download MUST fail with
no file bytes. A denied, unknown-id, or failed download (stored file missing or
unreadable) MUST write no row. Repeated downloads MUST each write their own
row. The payload MAY carry the request id and detected content type; it MUST
follow the payload minimisation rule below.

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
| unknown document id | 0 |
| stored file missing | 0 |

- GIVEN the case in the row
- WHEN the download route is called
- THEN no file bytes are returned and the rows added are as shown

#### Scenario: Audit failure blocks the download

- GIVEN an authorized download whose audit insert fails
- WHEN the route runs
- THEN no file bytes are returned

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

## Decisions applied

- D13: every supporting-document download is audited, because RNF-06 a
  requires exactly one entry per read, decision, and modification.
- D14: draft operations (create, autosave, discard, expiry sweep, orphan
  sweep) write no audit row; auditing of the request starts at submission.
  Explicit student document actions (attach, remove, rejected upload) are
  audited from the first file; cascaded document deletions are not.
