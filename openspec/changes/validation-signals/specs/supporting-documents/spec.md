# Delta for Supporting Documents

Covers RN-04, RF-02 (b), RN-26, RNF-01, RNF-02. Slice S2 (migration 0013 adds
a nullable fingerprint column to the document record; hashing and
cross-request comparison are pending the UAM legal review and run on
fictitious data). The special-format attach of the secretary shares the
signature check but stores no fingerprint.

## MODIFIED Requirements

### Requirement: Finalize with magic-byte validation (RN-04, RF-02 b, D3, RN-26)

After upload the client MUST call a finalize action. The server MUST read the
stored file's leading bytes itself (not trusting client type or extension or
any upload callback) and accept only these signatures: PDF `%PDF-`; PNG
`89 50 4E 47 0D 0A 1A 0A`; JPEG `FF D8 FF`. It MUST also check the stored size
is at most 10 485 760 bytes and greater than zero. On success the file MUST
become a document record of the draft (storage path, detected type, size) that
also holds the document fingerprint: the SHA-256 of the whole stored content,
as 64 lower-case hexadecimal characters. The fingerprint MUST be computed by the
server from the stored bytes in the same read that feeds the signature and size
checks, never taken from the client. On
any failure the stored file MUST be deleted, no document record created, and a
message naming the reason returned; if the fingerprint cannot be computed
because the stored content cannot be read, finalize MUST fail the same way and
MUST NOT create a record without a fingerprint. Finalize MUST re-check session,
role, and that the file lies under the caller's own draft prefix. A document
attached by the secretary through the special-format upload MUST store no
fingerprint (NULL), and documents recorded before this change keep a NULL
fingerprint; no backfill runs.
(Previously: the document record held no fingerprint.)

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

#### Scenario: Fingerprint stored at finalize

- GIVEN a valid PDF of known content
- WHEN finalize runs
- THEN the document record holds the SHA-256 of that content as 64 lower-case hexadecimal characters

#### Scenario: Same bytes, same fingerprint; changed bytes, different (table-driven)

| Upload | Fingerprint |
|---|---|
| the same file twice (in one draft or in two requests) | equal; both records are accepted, no deduplication |
| the same image re-saved or re-compressed | different |

- GIVEN the two uploads in the row
- WHEN finalize runs for each
- THEN the fingerprints are as shown

#### Scenario: Failed finalize stores no fingerprint

- GIVEN a spoofed, empty or oversized file, or a stored file that cannot be read for hashing
- WHEN finalize runs
- THEN the file is deleted, no record exists, and no fingerprint is stored anywhere

#### Scenario: Staff upload and old documents have no fingerprint

- GIVEN a special-format document attached by the secretary and a document recorded before the change
- WHEN their records are read
- THEN both fingerprints are NULL

## ADDED Requirements

### Requirement: Fingerprint is internal, immutable and checked (RN-26, RNF-01, RNF-02)

Slice S2. The fingerprint MUST be used only for the repeated-document signal
(`validation-signals`). It MUST NOT appear in any page, response, document
view, export, notification, log line or audit payload. The application MUST NOT
update it after finalize, and a soft retirement of the document (RF-08 b) MUST
keep it. The database MUST accept only NULL or exactly 64 lower-case
hexadecimal characters.

#### Scenario: Never exposed

- GIVEN documents with fingerprints
- WHEN the student detail, the staff detail, the coordination detail, the document route, the audit payloads and the notification messages are serialized and searched
- THEN no fingerprint value appears

#### Scenario: Retirement keeps it

- GIVEN a document with fingerprint H retired by a correction
- WHEN its record is read
- THEN the fingerprint is still H

#### Scenario: Database rejects a malformed value (table-driven)

| Value | Result |
|---|---|
| NULL | accepted |
| 64 lower-case hex characters | accepted |
| 63 characters, 65 characters, upper-case hex, or a non-hex character | rejected by the database |

- GIVEN a direct insert of a document with the value in the row
- WHEN the database processes it
- THEN the outcome is as shown
