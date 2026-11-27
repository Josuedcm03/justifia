# Delta for Supporting Documents

Change `normative-parameters`. Requirements covered: RNF-14, RN-04. Thesis: CU-13,
Annex D Table D19. The maximum document size is the `tamano_maximo_mib` parameter of
`normative-parameters` (NP-2, default 10 MiB, range 1 to 25 MiB). [PG] marks a
scenario that MUST run on a real PostgreSQL.

## Notes for archive

- Purpose: no edit.
- "Several documents per request", "At most five documents per request" and the
  other requirements are unchanged. Operational constants (the five-document cap,
  token validity, extraction limits) stay in code and are not parameters.
- "FE-17 Preview of a chosen file" is unchanged: the preview shows the size, and
  the client pre-check takes the limit from the new requirement below.
- The special-format upload of the secretary (`request-review`, "Special-format
  upload on the staff detail") applies the same limit through the new requirement
  below; its own text is unchanged.
- "MiB" is the unit of the parameter (1 MiB = 1 048 576 bytes). User copy keeps
  the label "MB" it has today and takes the configured number.

## MODIFIED Requirements

### Requirement: Upload authorization and limits (RN-04, D2, RNF-01)

Traceability: RNF-14, CU-13, Table D19. The system MUST issue an upload token only
to an authenticated `estudiante`
who owns a non-expired draft or who owns a request in state `devuelta` (a
correction, see `student-requests`). The token MUST restrict content types to
PDF, PNG, and JPEG, restrict size to at most the maximum size in force
(`tamano_maximo_mib` times 1 048 576 bytes; default 10 485 760), be short-lived,
and bind the file to that draft's or request's storage prefix with an
unguessable name. The size MUST be read when the token is issued, so a change applies to every
token issued after it; a token already issued keeps the limit it carries until it
expires. The token route MUST re-check session, role, ownership and,
for a correction, the `devuelta` state on every call.
(Previously: the size limit was the constant 10 485 760 bytes.)

#### Scenario: Token for own draft

- GIVEN a student with an open draft and the default maximum size
- WHEN they request an upload token
- THEN a token is issued limited to the three types, 10 MB (10 485 760 bytes), a short validity, and that draft's prefix

#### Scenario: Token for own returned request

- GIVEN a student who owns a request in `devuelta` and the default maximum size
- WHEN they request an upload token for that request
- THEN a token is issued limited to the three types, 10 MB, a short validity, and that request's prefix

#### Scenario: Token limit follows the parameter (table-driven)

| `tamano_maximo_mib` | Maximum size in the token |
|---|---|
| 1 | 1 048 576 |
| 5 | 5 242 880 |
| 25 | 26 214 400 |

- GIVEN the parameter in the row and a student with an open draft
- WHEN they request an upload token
- THEN the token's maximum size is as shown

#### Scenario: A parameter change applies to the next token [PG]

- GIVEN a token issued under the default and then `tamano_maximo_mib` saved as 5
- WHEN the student requests another token
- THEN the new token carries 5 242 880 and the first token still carries 10 485 760

#### Scenario: Invalid stored size falls back to 10 MiB [PG]

- GIVEN a stored `tamano_maximo_mib` row with value 99
- WHEN the student requests an upload token
- THEN the token carries 10 485 760 and the route does not fail

#### Scenario: Token denied

- GIVEN no session, a non-student role, another student's draft or request, an expired draft, or an own request that is not `devuelta`
- WHEN a token is requested
- THEN it is denied and no token is issued

#### Scenario: Oversize or wrong type at the store

- GIVEN a valid token under the default maximum size
- WHEN the client uploads 11 MB or declares `text/html`
- THEN the store rejects the upload

### Requirement: Finalize with magic-byte validation (RN-04, RF-02 b, D3, RN-26)

Traceability: RNF-14, CU-13, Table D19. After upload the client MUST call a
finalize action. The server MUST read the
stored file's leading bytes itself (not trusting client type or extension or
any upload callback) and accept only these signatures: PDF `%PDF-`; PNG
`89 50 4E 47 0D 0A 1A 0A`; JPEG `FF D8 FF`. It MUST also check the stored size
is at most the maximum size in force when finalize runs (`tamano_maximo_mib` times
1 048 576 bytes; default 10 485 760) and greater than zero. On success the file MUST
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
fingerprint; no backfill runs. The `too_large` message MUST state the maximum size in
force.
(Previously: the size ceiling was the constant 10 485 760 bytes and the `too_large` copy named 10 MB.)

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
| stored size over the maximum size in force | `too_large` |
| path does not exist | `not_found` |
| stored file cannot be read for hashing (the record is not created, the blob is deleted best effort, and the audit row carries `not_found`) | `not_found` |
| path under another draft's prefix | `not_allowed` |

- GIVEN the case in the row
- WHEN finalize runs
- THEN the reason shown is returned and no document record is created
- AND any stored file for the first two cases is deleted

#### Scenario: Size boundary follows the parameter (table-driven)

| `tamano_maximo_mib` | Stored size (bytes) | Result |
|---|---|---|
| 10 | 10 485 760 | accepted |
| 10 | 10 485 761 | `too_large` |
| 5 | 5 242 880 | accepted |
| 5 | 5 242 881 | `too_large` |
| 25 | 26 214 400 | accepted |
| 1 | 2 097 152 | `too_large` |

- GIVEN a valid PDF of the stored size in the row and the parameter in the row
- WHEN finalize runs
- THEN the outcome is as shown, and a refusal deletes the stored file and creates no record

#### Scenario: Limit lowered between upload and finalize [PG]

- GIVEN a 8 MiB file uploaded under the default limit and `tamano_maximo_mib` then saved as 5
- WHEN finalize runs
- THEN it is rejected with `too_large`, the stored file is deleted and no record exists

#### Scenario: Limit raised between upload and finalize [PG]

- GIVEN a 4 MiB file uploaded under a limit of 5 MiB
- WHEN `tamano_maximo_mib` is saved as 3 and then as 10, and finalize runs after the second save
- THEN the 4 MiB file is accepted (finalize applies the limit in force when it runs)

#### Scenario: The refusal copy states the limit

- GIVEN `tamano_maximo_mib` 5 and a `too_large` rejection
- WHEN the step renders the message in `es` and in `en`
- THEN it states 5 MB and does not state 10 MB

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

- GIVEN a spoofed, empty or oversized file, or a stored file that cannot be read for hashing (rejected with reason `not_found`)
- WHEN finalize runs
- THEN the file is deleted, no record exists, and no fingerprint is stored anywhere

#### Scenario: Staff upload and old documents have no fingerprint

- GIVEN a special-format document attached by the secretary and a document recorded before the change
- WHEN their records are read
- THEN both fingerprints are NULL

## ADDED Requirements

### Requirement: Maximum size reaches every upload path, the client and the database (RN-04, RNF-14, RNF-12; CU-13, Table D19)

The maximum size in force MUST be the single limit of every upload of a supporting
document: the student token route, the secretary token route for the special-format
upload, the finalize of both, and the inspection of the stored file. The browser
checks of the documents step and of the special-format upload, and the size hint
they show, MUST take the maximum size from the server as input; no client module may
hold its own copy of the limit. The database MUST accept a document size greater
than zero and at most 25 MiB (26 214 400 bytes), so every value in the range of
`tamano_maximo_mib` can be stored; the check `CK_Documento_Tamano` is replaced by
that ceiling (migration of slice S3, applied to production only after the owner's
explicit confirmation). Documents already stored MUST NOT be changed, hidden or
refused by a lower limit.

#### Scenario: Secretary token uses the same limit

- GIVEN `tamano_maximo_mib` 5 and an in-scope secretaria uploading the special format of an approved request
- WHEN she requests the upload token
- THEN the token's maximum size is 5 242 880

#### Scenario: Special-format finalize uses the same limit

- GIVEN `tamano_maximo_mib` 5 and a stored 6 MiB special-format file
- WHEN the secretary's finalize inspects it
- THEN it is refused with `too_large`, nothing is attached and the remissions stay blocked

#### Scenario: Client pre-check and hint take the server value (table-driven)

| Screen | Limit given as input | File chosen | Result |
|---|---|---|---|
| documents step | 5 MB | 6 MB | refused before upload, message states 5 MB |
| documents step | 5 MB | 4 MB | accepted for upload |
| special-format upload | 25 MB | 20 MB | accepted for upload |
| special-format upload | 2 MB | 3 MB | refused before upload, message states 2 MB |

- GIVEN the screen rendered with the limit in the row
- WHEN the user chooses the file in the row
- THEN the result is as shown and the hint states the limit

#### Scenario: No client copy of the limit

- GIVEN the two client components
- WHEN their imports are scanned
- THEN neither imports a size constant and the limit arrives only as a prop

#### Scenario: Database ceiling (table-driven) [PG]

| Stored size (bytes) | Result |
|---|---|
| 26 214 400 | accepted |
| 26 214 401 | refused by the check |
| 10 485 761 | accepted |
| 0 | refused by the check |

- GIVEN a document row with the size in the row
- WHEN it is inserted
- THEN the outcome is as shown

#### Scenario: A lower limit does not touch stored documents [PG]

- GIVEN a stored 8 MiB document and `tamano_maximo_mib` saved as 5
- WHEN the request detail and the document view are opened
- THEN the document is listed and served as before and its row is unchanged
