# Delta for Justification Intake

Covers RF-01 (d), RF-03 (e, f), RN-25, RNF-02, RNF-06, RNF-11, RNF-12.
Decisions D1-D10 are in `preproposal.yaml` (rev 3). The privacy notice lives in
`privacy-notice`; the audit payload rule in the `audit-log` delta; the
correction flow in the `student-requests` delta.

Terms: "consent" = the student's informed consent to the data use described by
the consent text; "current version" = the `CONSENT_VERSION` the server holds
(`"2026-10-20"` for the initial text; it also identifies the privacy notice
version and date); "consent payload" = the single value the client sends with
submit, `consentVersion` (a string, or `null`); "legacy request" = a request
presented before this change (no consent recorded).

The client sends no separate boolean: it sends the current version string only
while the box is checked and `null` otherwise, and the server decides from that
one value.

## ADDED Requirements

### Requirement: Consent text and version (RF-01 d, RN-25)

The system MUST hold one consent text per supported locale, identified by a
single `CONSENT_VERSION`. The initial text in `es` MUST be exactly: «Acepto que la UAM use
los datos de esta solicitud y de mis documentos, incluidos los datos de salud
que contengan, solo para tramitarla, y que se envíen a los docentes de las
asignaturas afectadas. Ver aviso de privacidad». The initial text in `en` MUST be: "I
agree that UAM may use the data in this request and in my documents, including
any health data they contain, only to process it, and that they be sent to the
teachers of the affected subjects. View privacy notice". The trailing "Ver aviso
de privacidad" / "View privacy notice" is the link to the privacy notice. A
change to the `es` text MUST require a new `CONSENT_VERSION`; a test MUST pin
the hash of the `es` text to the version and fail when only one changes.

#### Scenario: Text is the approved one

- GIVEN `CONSENT_VERSION` `"2026-10-20"` for the initial text
- WHEN the `es` and `en` consent texts are read
- THEN they equal the texts above

#### Scenario: Text changed without version change

- GIVEN the `es` text is edited and `CONSENT_VERSION` is not
- WHEN the test suite runs
- THEN the hash test fails

### Requirement: Consent checkbox on the review step (RF-03 e, RNF-11, RNF-12)

Step 4 (review) of the new-request flow MUST show one unchecked checkbox, above
the submit button, labelled with the consent text of the active locale. The
checkbox state MUST NOT be saved in the draft: every time the review step
opens, including when a draft is resumed, it MUST be unchecked. The submit
button MUST stay enabled whether or not the box is checked, and the client MUST
NOT pre-check the box to block submit: activating submit MUST open the existing
confirmation dialog (RNF-12) in both cases, and the server's answer is the only
consent check. The client MUST send the current `CONSENT_VERSION` as
`consentVersion` when the box is checked and `null` when it is not. A consent
error returned by the server MUST appear under the checkbox, not in the
form-level error block, tied to it programmatically, with the expected
correction; checking the box MUST clear a consent error already shown. The link
MUST open the privacy notice in a new browsing context so the review step, the
checkbox state and the draft stay as they were. The checkbox MUST NOT be shown
in the correction flow (see `student-requests`). At 360 px the label MUST wrap without horizontal
scrolling, and the label and link MUST be keyboard operable and pass the
automated accessibility check. Consent texts and error messages MUST exist in
both `i18n/es.json` and `i18n/en.json`.

#### Scenario: Unchecked on every visit

- GIVEN a student who checked the box and then navigated to step 1 and back
- WHEN a draft is resumed or the review step reopens
- THEN the checkbox is unchecked and nothing about it is stored on the draft

#### Scenario: Submit stays enabled and the dialog opens unchecked

- GIVEN the review step with the box unchecked
- WHEN the student activates the submit button
- THEN the button was enabled and the confirmation dialog opens
- AND on confirming, the client sends `consentVersion` `null`
- AND the server's `consent_required` error renders under the checkbox, tied to it programmatically, and not in the form-level error block

#### Scenario: Checked box sends the version

- GIVEN the review step with the box checked
- WHEN the student confirms the dialog
- THEN the client sends `consentVersion` equal to the current `CONSENT_VERSION`

#### Scenario: Checking clears the consent error

- GIVEN a `consent_required` error shown under the unchecked box
- WHEN the student checks the box
- THEN the consent error is no longer shown

#### Scenario: Link keeps the work

- GIVEN the review step with the box checked
- WHEN the student follows "Ver aviso de privacidad"
- THEN the notice opens in a new tab and the review step still shows the box checked
- AND activating the link does not toggle the checkbox

#### Scenario: 360 px and accessibility

- GIVEN a 360 px viewport and the review step with a consent error showing
- WHEN it renders
- THEN the document width does not exceed the viewport, clicking the label toggles the box, and the axe check reports no violation

#### Scenario: Translation keys present

- GIVEN the consent message keys
- WHEN `es.json` and `en.json` are compared
- THEN both contain the same keys

### Requirement: Consent required to submit (RF-03 f, RN-25)

The submit action MUST receive the consent as one value only, `consentVersion`,
and MUST decide consent from that value alone; there is no separate boolean.
Submit MUST NOT succeed unless `consentVersion` is a string equal to the current
`CONSENT_VERSION`. The server MUST classify the value as follows (fail closed,
including on a direct action call):

| `consentVersion` received | Outcome |
|---|---|
| a string equal to the current version | consent valid |
| absent, `null` or the empty string | `consent_required` |
| any non-string value (boolean, number, object, array) or a payload that cannot be parsed | `consent_required` |
| a non-empty string different from the current version | `consent_outdated` |

A consent error MUST be reported under the field `consent`, together with every
other invalid field of the same submit (RF-03 e). A refusal MUST leave the draft
in `borrador` unchanged, MUST store no consent data and MUST write no audit
row. Any other key in the payload MUST be ignored.

#### Scenario: Box not checked

- GIVEN an otherwise valid draft and an unchecked box (the client sends `consentVersion` `null`)
- WHEN the student submits and confirms the dialog
- THEN submit is blocked with `consent_required` under the field `consent` and the draft stays `borrador`

#### Scenario: Absent, empty or malformed payload (table-driven)

| Payload | Outcome |
|---|---|
| no `consentVersion` key | `consent_required` |
| `consentVersion` `null` | `consent_required` |
| `consentVersion` `""` | `consent_required` |
| `consentVersion` `true`, `1` or an object | `consent_required` |
| payload that is not an object (e.g. `undefined`, a string) | `consent_required` |

- GIVEN a direct action call with the payload in the row and an otherwise valid draft
- WHEN the server processes it
- THEN it is blocked with the outcome shown and nothing is stored or audited

#### Scenario: Consent does not mask other errors

- GIVEN a draft with no documents and the box checked (the client sends the current version)
- WHEN the student submits
- THEN submit is blocked on documents and no consent is recorded

#### Scenario: Consent error beside other errors

- GIVEN a draft with no documents and an unchecked box
- WHEN the student submits
- THEN the response lists the documents error and the `consent` error at once

### Requirement: Consent version check (RN-25)

The client MUST send, as `consentVersion`, the `CONSENT_VERSION` of the text it
showed, and only while the box is checked. If `consentVersion` is a non-empty
string that differs from the current version, submit MUST be refused with
`consent_outdated`, with a message telling the student to reload and read the
updated text; nothing MUST be stored or audited. An absent, `null`, empty or
non-string value is `consent_required`, never `consent_outdated`. The server
MUST store only its own current version, never the received string.

#### Scenario: Matching version

- GIVEN `consentVersion` equal to the current version
- WHEN the student submits a valid draft
- THEN submit proceeds

#### Scenario: Outdated page

- GIVEN a review step rendered under version `"2026-10-20"` and the server now at a later version
- WHEN the student checks the box and submits
- THEN submit is refused with `consent_outdated` under the field `consent` and the draft is unchanged

#### Scenario: Different string

- GIVEN `consentVersion` `"2025-01-01"` or `"x"` with an otherwise valid draft
- WHEN the server processes it
- THEN it is refused with `consent_outdated` and nothing is stored or audited

#### Scenario: Version missing is not outdated

- GIVEN a payload with no `consentVersion` or with `null`
- WHEN the server processes it
- THEN it is refused with `consent_required`, not `consent_outdated`

### Requirement: Consent recorded at submit (RF-01 d, RN-25, RNF-02, RNF-06)

A valid submit MUST, in the same transaction as the `borrador` to `pendiente`
transition, store the current `CONSENT_VERSION` and a consent timestamp assigned
by the server (never supplied by the client) from the same server instant as the
presentation timestamp, so it is not later than it. The instant is stored as a
point in time and displayed in America/Managua. Version and timestamp MUST both be set or both be
empty; the database MUST reject a row with only one, or with a consent
timestamp later than the presentation timestamp. The database MUST NOT require
consent on presented rows: legacy requests keep both values empty, MUST NOT be
backfilled, and remain valid. The `solicitud.presentada` audit row (one per
operation) MUST carry the stored version (see `audit-log`). A rolled-back or
double submit MUST leave no consent data.

#### Scenario: Successful submit stores consent

- GIVEN a valid draft and `consentVersion` equal to the current version
- WHEN the student submits
- THEN the request is `pendiente` with that version and a server timestamp equal to `PresentadaEn` (never later)
- AND exactly one `solicitud.presentada` row exists, carrying the version

#### Scenario: Client timestamp ignored

- GIVEN a payload carrying a consent date or timestamp key beside a valid `consentVersion`
- WHEN the request is stored
- THEN the stored consent timestamp is the server's

#### Scenario: Constraint cases (table-driven)

| Version | Timestamp | Database |
|---|---|---|
| set | set, <= `PresentadaEn` | accepts |
| set | empty | rejects |
| empty | set | rejects |
| set | set, > `PresentadaEn` | rejects |
| empty | empty (presented legacy row) | accepts |

- GIVEN a presented request row with the values in the row
- WHEN it is written
- THEN the database outcome is as shown

#### Scenario: Failure rolls back

- GIVEN a failure during the submit transaction
- WHEN it ends
- THEN the request is `borrador` with no consent data and no audit row

#### Scenario: Legacy requests untouched

- GIVEN requests presented before this change
- WHEN the change is applied
- THEN their consent version and timestamp remain empty

## MODIFIED Requirements

### Requirement: Submit blocking, per field (RF-03, RN-01..RN-05, RN-23, RN-25)

Submit MUST be re-validated on the server regardless of client checks. When
any field is invalid the request MUST NOT be submitted and the response MUST
list every invalid field, each with a message stating the expected correction
(RF-03 e). Fields checked: cause (RN-01), start and end dates required and
ordered (RN-05, RF-03 a, b), end-date window (RN-23, RF-03 d), at least one
subject (D15), group where required (RF-04 c), at least one
finalized supporting document (RN-03, RF-03 c), and the informed consent
(RN-25, RF-03 f; see "Consent required to submit"). A blocked submit MUST leave
the draft in `borrador`, unchanged, with no audit row.
(Previously: the consent was not among the fields checked.)

#### Scenario: Required field empty

- GIVEN a draft with no cause
- WHEN the student submits
- THEN nothing is submitted and the cause field shows an error with the fix

#### Scenario: No document

- GIVEN a valid draft with zero finalized documents
- WHEN the student submits
- THEN it is blocked with an error on documents

#### Scenario: No subject

- GIVEN a draft with valid cause, dates, and documents but no subject
- WHEN the student submits
- THEN it is blocked with an error on subjects (D15)

#### Scenario: All errors reported together

- GIVEN a draft with no cause, end before start, no documents, and no consent
- WHEN the student submits
- THEN the response lists all four fields at once

#### Scenario: Client bypass

- GIVEN a direct action call with invalid data
- WHEN the server processes it
- THEN it is blocked with the same field errors

### Requirement: Four-step stepper (RF-01, RF-02, RF-04, RN-25)

The flow MUST present four steps in order: (1) cause and dates, (2) affected
subjects, (3) supporting documents, (4) review with the consent checkbox and
submit. The student MUST be able to move back to any earlier step without
losing data. Step 2 MUST require valid dates from step 1 to list subjects. Step
4 MUST show cause, dates, each subject with its group and teacher, and the
documents, all non-editable, then the consent checkbox (see "Consent checkbox
on the review step"), with per-field errors (see "Submit blocking").
(Previously: step 4 was fully read-only and had no consent checkbox.)

#### Scenario: Navigation keeps data

- GIVEN data entered in steps 1-3
- WHEN the student goes back to step 1 and forward again
- THEN all values remain

#### Scenario: Review is read-only

- GIVEN the student is on step 4
- WHEN the page renders
- THEN no request data field is editable and each step offers a link to edit it
- AND the consent checkbox is the only input on the page
- AND each valid document shows a "View" link that opens the file inline in a new tab (same as step 3)

#### Scenario: Edit from review returns to review

- GIVEN the student opened a step from an edit link of the review (step 4)
- WHEN the student saves that step with Continue
- THEN the student returns to the review without passing through the steps in
  between, and a step opened by normal forward navigation still advances to
  the next step

#### Scenario: Subjects need dates

- GIVEN a draft without valid dates
- WHEN the student opens step 2
- THEN no subject can be selected and a message asks for dates first
