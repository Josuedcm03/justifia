# Supporting Documents Specification

## Purpose

Students attach supporting documents to a draft. Files go directly from the
browser to a private store, are verified server-side by real format, and are
downloadable only by authorized users. Covers RF-02, RF-03 c, RN-03, RN-04,
RNF-01, RNF-02, RNF-06, RNF-09. Decisions D2, D3, D8, D10, D12, D13, D15.
Research: C13, C21,
C28-C31 (direct upload, no native content inspection, signature validation,
`get`/`del`), C32-C33 (sweep, daily cron on Hobby).

## Requirements

### Requirement: Upload authorization and limits (RN-04, D2, RNF-01)

The system MUST issue an upload token only to an authenticated `estudiante`
who owns a non-expired draft. The token MUST restrict content types to PDF,
PNG, and JPEG, restrict size to at most 10 485 760 bytes, be short-lived,
and bind the file to a per-draft storage prefix with an unguessable name.
The token route MUST re-check session, role, and ownership on every call.

#### Scenario: Token for own draft

- GIVEN a student with an open draft
- WHEN they request an upload token
- THEN a token is issued limited to the three types, 10 MB, a short validity, and that draft's prefix

#### Scenario: Token denied

- GIVEN no session, a non-student role, another student's draft, or an expired draft
- WHEN a token is requested
- THEN it is denied and no token is issued

#### Scenario: Oversize or wrong type at the store

- GIVEN a valid token
- WHEN the client uploads 11 MB or declares `text/html`
- THEN the store rejects the upload

### Requirement: Several documents per request (RF-02 a)

A draft MUST accept more than one document. The student MUST be able to remove
a document from the draft; removal MUST delete the stored file and the record.

#### Scenario: Two documents

- GIVEN a draft with one finalized document
- WHEN the student uploads and finalizes another
- THEN the draft lists both

#### Scenario: Remove a document

- GIVEN a draft with two documents
- WHEN the student removes one
- THEN its record and stored file are gone and the other remains

### Requirement: At most five documents per request (D12, RF-02 a)

A draft MUST hold at most 5 documents. The count MUST include every document
record of the draft in state `pendiente` (finalize in progress) or `valido`.
When the draft already holds 5 such documents, the token route MUST NOT issue
an upload token and MUST return the reason `too_many_documents`. Finalize MUST
re-check the cap when it claims its `pendiente` row, so concurrently issued
tokens cannot exceed it; a finalize that would make a sixth document MUST be
rejected with `too_many_documents`, delete the stored file, and create no
document record. Removing a document frees a slot.

#### Scenario: Sixth upload rejected at the token

- GIVEN a draft with 5 `valido` documents
- WHEN the student requests an upload token
- THEN no token is issued and the reason `too_many_documents` is shown

#### Scenario: Pending documents count toward the cap

- GIVEN a draft with 4 `valido` documents and 1 `pendiente` document
- WHEN the student requests an upload token
- THEN no token is issued and the reason `too_many_documents` is shown

#### Scenario: Concurrent finalize beyond the cap

- GIVEN a draft with 4 documents and two tokens issued before either finalize
- WHEN both uploads are finalized at the same time
- THEN exactly one becomes a document, the other is rejected with `too_many_documents`, and its stored file is deleted

#### Scenario: Removal frees a slot

- GIVEN a draft with 5 `valido` documents
- WHEN the student removes one and requests a token
- THEN a token is issued

### Requirement: Finalize with magic-byte validation (RN-04, RF-02 b, D3)

After upload the client MUST call a finalize action. The server MUST read the
stored file's leading bytes itself (not trusting client type or extension or
any upload callback) and accept only these signatures: PDF `%PDF-`; PNG
`89 50 4E 47 0D 0A 1A 0A`; JPEG `FF D8 FF`. It MUST also check the stored size
is at most 10 485 760 bytes and greater than zero. On success the file MUST
become a document record of the draft (storage path, detected type, size). On
any failure the stored file MUST be deleted, no document record created, and a
message naming the reason returned. Finalize MUST re-check session, role, and
that the file lies under the caller's own draft prefix.

Rejection reasons (distinct, translatable): `unsupported_format`, `too_large`,
`empty_file`, `not_found`, `not_allowed`, `too_many_documents` (D12).

#### Scenario: Valid files (table-driven)

| First bytes | Detected type | Result |
|---|---|---|
| `%PDF-1.7` | PDF | accepted |
| `89 50 4E 47 0D 0A 1A 0A` | PNG | accepted |
| `FF D8 FF E0` | JPEG | accepted |

- GIVEN an uploaded file whose leading bytes are in the row
- WHEN finalize runs
- THEN a document record exists with the detected type

#### Scenario: Spoofed file rejected

- GIVEN an `.exe` renamed `scan.pdf` uploaded with `application/pdf`
- WHEN finalize runs
- THEN it is rejected with `unsupported_format`, the stored file is deleted, and no record exists

#### Scenario: Other rejections (table-driven)

| Case | Reason |
|---|---|
| zero-byte file | `empty_file` |
| stored size over 10 MB | `too_large` |
| path does not exist | `not_found` |
| path under another draft's prefix | `not_allowed` |

- GIVEN the case in the row
- WHEN finalize runs
- THEN the reason shown is returned and no document record is created
- AND any stored file for the first two cases is deleted

#### Scenario: Unvalidated file never referenced

- GIVEN an uploaded file on which finalize was never called
- WHEN the draft is submitted
- THEN it is not part of the request and does not count toward RN-03

#### Scenario: Reason shown to the student

- GIVEN a rejected upload
- WHEN the step renders the result
- THEN the message states the reason in the user's language and the student may retry

### Requirement: Authenticated download (RNF-01, RNF-02, RNF-06, D13, D15)

Documents MUST be served only through an authenticated server route that
re-checks session, role, and that the document belongs to a request or draft
of the caller. A document MUST NOT have a public URL, and no stored location
MUST be exposed to clients. The only authorized reader in this change is the
owning student (D15); access by other roles belongs to later changes.
Unauthorized or unknown ids MUST yield identical denials with no file bytes.
Every successful download MUST write exactly one `documento.descargado` audit
row (D13, RNF-06 a; see the `audit-log` delta); a denied or failed download
MUST write none.

#### Scenario: Owner downloads

- GIVEN a student who owns a request with a document
- WHEN they call the download route
- THEN the file is streamed with its detected content type

#### Scenario: Other student denied

- GIVEN a document owned by student A
- WHEN student B or an anonymous caller requests it
- THEN the response is a denial identical to that for a nonexistent id
- AND no audit row is written

#### Scenario: Download is audited (D13)

- GIVEN a student who owns a `valido` document
- WHEN they download it successfully
- THEN exactly one `documento.descargado` row exists for that document with the student as actor

#### Scenario: Failed download not audited

- GIVEN a document whose stored file cannot be read
- WHEN the owner requests it
- THEN no file bytes are returned and no `documento.descargado` row is written

#### Scenario: No public URL

- GIVEN any stored document
- WHEN the page, API responses, and database records are inspected
- THEN none contains a directly fetchable store URL

### Requirement: Orphan blob cleanup (D8, D14)

The cleanup sweep MUST delete stored files under draft prefixes that are not
referenced by any document record and are older than 24 hours. It MUST NOT
delete a referenced file or an unreferenced file younger than 24 hours (a
finalize may be pending). The sweep MUST write no audit row (D14).

#### Scenario: Old orphan removed

- GIVEN an unreferenced file uploaded 25 hours ago
- WHEN the sweep runs
- THEN it is deleted and no audit row is written

#### Scenario: Fresh orphan kept

- GIVEN an unreferenced file uploaded 2 hours ago
- WHEN the sweep runs
- THEN it remains

#### Scenario: Referenced file kept

- GIVEN a finalized file of a live draft or submitted request
- WHEN the sweep runs
- THEN it remains

### Requirement: Storage behind a port (D1, D10)

Document storage MUST be accessed only through a `DocumentStore` port so the
store can be replaced without changing validation, finalize, or download
rules. Domain rules MUST be testable with a fake store.

#### Scenario: Fake store

- GIVEN a fake `DocumentStore`
- WHEN finalize, discard, and sweep rules are tested
- THEN no network or real store is needed
