# Document Extraction Specification

## Purpose

After a student submits a request or a correction, the system extracts, from
each eligible supporting document, the student name, issuer, issue date and
rest period, using a model server it deploys and operates. The data helps staff
review; it never decides anything. Covers RF-11 (a, b), RN-02, RNF-01, RNF-02,
RNF-03 (criterion of 2026-10-22), RNF-04. FA-04 applies: no document or text is
ever sent to a third-party OCR or inference service. Showing the data to staff
lives in `request-review`; the re-enqueue step of the daily sweep lives in
`justification-intake`. Signals, manual entry (RF-14, RN-24) and the
name-match flag belong to `validation-signals`.

Terms: "reference date" = Managua calendar date of `COALESCE(ReenviadaEn,
PresentadaEn)` of the document's request; "row" = the one extraction record of
a document; "eligible" = defined in "Eligibility and registration"; "no
reconocido" = the field has no value and is shown as "no reconocido".

## Requirements

### Requirement: Eligibility and registration (RF-11)

Registration MUST be idempotent and MUST give every supporting document of the
request at most one row. A document MUST get a `pendiente` row only when it is
finalized (`valido`), not retired, uploaded by the student (not a staff-uploaded
special format) and has no row. A retired document without a row MUST get a
`no_aplica` row. A retired document MUST never be claimed or processed, and an
existing `pendiente` row of a document retired meanwhile MUST become
`no_aplica` at the next registration. A document whose row exists in any state
(including `completada` and `fallida`) MUST NOT be re-registered or
re-extracted.

#### Scenario: Eligible document registered once

- GIVEN a submitted request with two valid student documents and no rows
- WHEN registration runs twice
- THEN exactly two `pendiente` rows exist

#### Scenario: Retired and staff documents

- GIVEN a retired student document and a staff-uploaded special format
- WHEN registration runs
- THEN the retired one gets `no_aplica` and the special format gets no row

#### Scenario: Correction extracts only new documents

- GIVEN a returned request whose document D1 is `completada`, D2 was replaced by D3
- WHEN the student resubmits
- THEN D3 gets a `pendiente` row, D2 becomes or is `no_aplica`, and D1 is untouched

### Requirement: Triggers after submit and correction (RF-11)

After the transaction of a successful submit and of a successful correction
resubmit has committed, the system MUST register the request's documents and
process the rows that are `pendiente`, one document at a time. Extraction MUST
NOT run inside those transactions, MUST NOT delay their response beyond the
post-commit hand-off, and MUST NOT change their outcome: an extraction or
queueing failure of any kind never rolls back, blocks or reports an error on
the submission or correction. A blocked or failed submit MUST register nothing.

#### Scenario: Model outage does not block submit

- GIVEN the model server is unreachable
- WHEN the student submits a valid draft
- THEN the request is `pendiente` and the student sees the normal confirmation
- AND the rows stay recoverable by the sweep

#### Scenario: Hand-off failure is swallowed

- GIVEN the post-commit hand-off throws
- WHEN a correction is resubmitted
- THEN the correction is stored and no error reaches the student

#### Scenario: Blocked submit registers nothing

- GIVEN a draft with a missing field
- WHEN submit is refused
- THEN no extraction row is created

### Requirement: State machine, claim and lease (RF-11)

A row MUST be in exactly one state: `pendiente`, `procesando`, `completada`,
`fallida` or `no_aplica`. Processing MUST begin with an atomic claim that moves
`pendiente` to `procesando`, records a claim identifier and claim time, and
counts one attempt; of concurrent claims on one row exactly one MUST win.
Completion and failure MUST be written only by the holder of the current claim;
a late writer whose claim was replaced MUST change nothing. A `procesando` row
whose lease has expired (longer than the maximum time one extraction may run)
MUST be reclaimable; if it already used its last attempt it MUST become
`fallida` instead. `completada`, `fallida` and `no_aplica` are final.

#### Scenario: Concurrent claim

- GIVEN one `pendiente` row and two workers
- WHEN both try to claim it
- THEN exactly one proceeds and one attempt is counted

#### Scenario: Expired lease recovered

- GIVEN a `procesando` row with an expired lease and fewer than three attempts
- WHEN the next worker looks for work
- THEN it reclaims the row and the new claim holds the lease

#### Scenario: Stale holder cannot complete

- GIVEN worker A's lease expired and worker B reclaimed the row
- WHEN A finishes
- THEN A's result is discarded and the row is unchanged by A

#### Scenario: Lease expires on the last attempt

- GIVEN a `procesando` row with an expired lease and three attempts used
- WHEN the next worker looks for work
- THEN the row becomes `fallida`

### Requirement: Attempts, retries and not-configured (RF-11)

A failed attempt MUST return the row to `pendiente` with an error code from a
closed set; after the third failed attempt the row MUST become `fallida`. An
error code MUST NOT carry free text from the model, the network or an exception.
When extraction is not configured (see "Engine contract"), the claim MUST be
handed back: the row returns to `pendiente` and the attempt MUST NOT be
counted. A model answer that parses but holds no recognized value is a
successful extraction (`completada`), not a failure. The system MUST NOT retry a
`fallida` row automatically. Per row, the system MUST record state, attempts,
error code, engine identifier and processing time.

#### Scenario: Third failure is final

- GIVEN a row with two failed attempts
- WHEN a third attempt fails
- THEN the row is `fallida` with a closed-set error code and is not retried

#### Scenario: Not configured keeps the attempt

- GIVEN extraction is not configured and a row with one attempt
- WHEN a worker claims it
- THEN no network call is made, the row is `pendiente` and attempts is still 1

#### Scenario: Empty answer completes

- GIVEN the model returns every field empty
- WHEN the attempt ends
- THEN the row is `completada` with all fields without value

### Requirement: Execution budget (RF-11)

Entry points that run extraction (the new-request page, the correction page
and the sweep route) MUST declare a maximum duration of 300 seconds, and a test
MUST pin each value. Processing MUST work under a wall-clock deadline inside
that budget; each model call MUST have a timeout, and a document MUST NOT be
started when its timeout would exceed the remaining budget. Documents not
started stay `pendiente` for the sweep.

#### Scenario: Deadline reached

- GIVEN five `pendiente` rows and a budget that allows only two documents
- WHEN processing runs
- THEN two are processed and three remain `pendiente`

#### Scenario: Duration pinned

- GIVEN the three entry points
- WHEN the configuration test runs
- THEN each declares 300 seconds and the test fails if one changes

### Requirement: Engine contract and configuration (RF-11, RNF-02, RNF-03)

The model server MUST be reached only through one configured address and an
optional bearer key. The system MUST use the NuExtract3 4B model with reasoning
off and temperature 0.2, over an OpenAI-compatible chat API, asking for exactly:
student name, issuer, issue date, rest-from, rest-to and rest-days. The bearer
header MUST be sent only when a key is configured. Extraction is "not
configured" when the address is absent or is a non-HTTPS address whose host is
not loopback (`localhost`, `127.0.0.1`, `::1`); then no request is made and no
document content leaves the system. Neither address nor key may appear in
logs, errors or the UI.

#### Scenario: Bearer only with a key

- GIVEN an address with no key, and then the same address with a key
- WHEN a document is extracted in each case
- THEN the first request has no authorization header and the second carries the bearer

#### Scenario: Plain HTTP to a remote host

- GIVEN an `http://` address whose host is not loopback
- WHEN a worker claims a row
- THEN it is treated as not configured and nothing is sent

#### Scenario: Loopback over HTTP allowed

- GIVEN `http://localhost` as the address
- WHEN a document is extracted
- THEN the request is made

### Requirement: Document preparation (RF-11)

The system MUST prepare each document by kind. Image documents MUST be
orientated by their EXIF data and reduced to a maximum width of 1600 px (never
enlarged) and sent as images. A PDF whose every page has a text layer above a
minimum density MUST be sent as its text. Any other PDF (scanned or mixed) MUST
be rendered page by page, in order, to at most 5 pages and sent as images. An
unreadable or unsupported document MUST fail the attempt with a closed-set code.

#### Scenario: Large rotated photo

- GIVEN a 3200 px wide JPEG with EXIF orientation 6
- WHEN it is prepared
- THEN it is sent upright with width 1600

#### Scenario: Mixed PDF

- GIVEN a PDF with a text page and a scanned page
- WHEN it is prepared
- THEN all pages are rendered and sent as images, not as text

#### Scenario: Page cap

- GIVEN a scanned PDF of 8 pages
- WHEN it is prepared
- THEN only the first 5 pages are sent

### Requirement: Values from text must appear in the text (RF-11 b)

When a PDF is read as text, each returned name, issuer and date MUST be
supported by that text (comparison insensitive to case, accents and spacing; a
date may be written in any common format but its day, month and year must all
be present). A value not supported by the text MUST become no reconocido.

#### Scenario: Invented issuer discarded

- GIVEN text-layer PDF text without the returned issuer
- WHEN the answer is validated
- THEN the issuer is no reconocido and the other supported fields are kept

#### Scenario: Date in another format

- GIVEN the text reads "20/07/2026" and the model returns 2026-07-20
- WHEN the answer is validated
- THEN the issue date is kept

### Requirement: Code-side validation of fields (RF-11 b)

Validation MUST run in code on every answer, whatever the source. A rest
period MUST be recognized only in one of two forms: (a) both rest-from and
rest-to present with from not after to, or (b) a positive whole number of days
(at most 366) and no dates. Any other combination, including a lone date, MUST
make the whole rest period no reconocido. In form (a) the days MUST be
computed in code, inclusive of both ends, ignoring the model's value. Dates
MUST be real calendar dates. Each field MUST be independently recognized or not.

#### Scenario: Days computed inclusive

- GIVEN rest from 2026-07-20 to 2026-07-24 and model days 4
- WHEN validated
- THEN the stored days are 5

#### Scenario: Invented rest discarded

- GIVEN only rest-from equal to the issue date and no rest-to
- WHEN validated
- THEN the whole rest period is no reconocido

#### Scenario: Duration only

- GIVEN no dates and days 3
- WHEN validated
- THEN the rest period is recognized as 3 days with no dates

### Requirement: Plausibility window (RF-11 b)

The issue date and rest-from MUST each lie between one year before the
reference date (same month and day; 29 February maps to 28 February) and the
reference date, both inclusive. Rest-to MUST lie between one year before the
reference date and 30 days after the reference date, both inclusive, so a
request filed while the rest is still running keeps its rest period. An issue
date outside its window is no reconocido; if rest-from or rest-to is outside
its window, the whole rest period is no reconocido. Days-only rest has no dates
and is not affected by the window.

#### Scenario: Window boundaries (table-driven)

| Reference date | Issue date | Result |
|---|---|---|
| 2026-10-22 | 2025-10-22 | kept |
| 2026-10-22 | 2025-10-21 | no reconocido |
| 2026-10-22 | 2026-10-22 | kept |
| 2026-10-22 | 2026-10-23 | no reconocido |

- GIVEN the reference and issue dates in the row
- WHEN the answer is validated
- THEN the issue date outcome is as shown

#### Scenario: Completed year

- GIVEN a handwritten "202_" returned as 2022 with reference date 2026-10-22
- WHEN validated
- THEN the date is no reconocido

#### Scenario: Rest still running at submission

- GIVEN rest from 2026-10-20 to 2026-10-25 and reference date 2026-10-22
- WHEN validated
- THEN the rest period is kept with 6 days

#### Scenario: Rest end outside the window

- GIVEN rest from 2026-10-20 to 2026-11-22 and reference date 2026-10-22
- WHEN validated
- THEN the whole rest period is no reconocido

#### Scenario: Rest start after submission

- GIVEN rest from 2026-10-23 to 2026-10-25 and reference date 2026-10-22
- WHEN validated
- THEN the whole rest period is no reconocido

### Requirement: Stored data and logs (RF-11, RN-02, RNF-02, RNF-04)

A row MUST store only: the validated name, issuer, issue date, rest-from,
rest-to, rest-days, and the control data of "Attempts" (no confidence value and
no name-match value). The system MUST NOT store the document text, the model's
raw answer or any prepared image. It MUST NOT write extracted values, document
text, the address or the key to any log; logs MAY carry row or document ids,
states, error codes and counts. Extraction MUST write no audit row (D14: no
human actor). The extracted name MUST be stored apart from, and never replace,
the request's student snapshot (RN-02). Deleting a document MUST delete its
row, so extracted data never outlives its document (RNF-04).

#### Scenario: No raw content kept

- GIVEN a completed extraction of a text-layer PDF
- WHEN the row and the logs are inspected
- THEN no document text, raw answer or extracted value appears in either

#### Scenario: Snapshot untouched

- GIVEN a request whose snapshot name differs from the extracted name
- WHEN the extraction completes
- THEN the snapshot name is unchanged

#### Scenario: Cascade and no audit

- GIVEN a completed row
- WHEN its document is deleted, and when an extraction ran
- THEN the row is deleted with it and no audit row was written by extraction

### Requirement: Local-execution boundary (RNF-03, FA-04)

Across 10 extractions through the real model adapter, with outbound network
calls intercepted, the only requests that contain a document or its text MUST
go to the host of the configured address; none MUST go to any other host. The
codebase MUST NOT depend on a third-party OCR or inference service SDK, and a
test MUST fail if such a dependency is added.

#### Scenario: Ten extractions, one host

- GIVEN a configured address and 10 documents of mixed kinds
- WHEN all are extracted with outbound fetch intercepted
- THEN every request carrying content targets the configured host

#### Scenario: Third-party SDK added

- GIVEN a dependency on a hosted OCR or inference SDK
- WHEN the guard test runs
- THEN it fails

#### Scenario: Not configured sends nothing

- GIVEN no address configured
- WHEN extraction is attempted
- THEN no outbound request is made
