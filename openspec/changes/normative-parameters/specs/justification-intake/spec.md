# Delta for Justification Intake

Change `normative-parameters`. Requirements covered: RNF-14, RN-01, RN-23.
Thesis: CU-13, Annex D Table D19. The causes offered (active flag and order) and the
filing window come from `normative-parameters` (NP-11, NP-2). [PG] marks a scenario
that MUST run on a real PostgreSQL. The effect of a saved change on the next
request is proven by unit tests that inject the loader value and by the owner
system test (NP-14), not by a Postgres case (scope cut, 2026-11-27).

## Notes for archive

- Purpose: no edit.
- "Four-step stepper", "Subject eligibility" and the consent requirements are
  unchanged.
- The correction path is unchanged: `student-requests` "Correction validation"
  keeps RN-23 from being re-applied on a correction, whatever the window value.
  A returned request that carries a deactivated cause is not refused by the
  deactivation: only drafts are (spec-level assumption, reported in the spec
  result risks).

## MODIFIED Requirements

### Requirement: Cause and dates rules (RN-01, RN-05, RN-23, RF-01 b)

Traceability: RNF-14, CU-13, Table D19. The cause MUST be one of exactly five, with
fixed codes: maternity/paternity/breastfeeding; cultural or sports activities
representing UAM; academic exchange; medical; other force majeure. The causes
parameter decides which of the five are active and in what order: the cause step
MUST offer only the active causes, in the stored order, and a draft MUST be refused
when its cause is a deactivated one, at the next step save and at submit, with an
error on the cause field that says the cause is no longer available and asks the
student to choose another. A deactivated cause is still valid for existing data. Start and end dates are calendar dates. The end date MUST
be on or after the start date (RN-05). The end date MUST NOT be earlier than
W calendar days before the submission date (RN-23), where W is the filing-window
parameter in force (default 30, range 1 to 365); exactly W days before is
allowed. The message of that error MUST state the value W of the window. Future
dates are allowed, there is no maximum duration, and a late
submission is not rejected (D6; RN-07 signal belongs to another change).
(Previously: the cause list was fixed with no activation or order, and the window was 30 days as a code constant stated in the error copy.)

#### Scenario: Cause outside the list

- GIVEN a submit call with a cause not among the five
- WHEN the server validates it
- THEN submit is blocked with an error on the cause field

#### Scenario: Deactivated cause is not offered

- GIVEN the cause `medica` deactivated and the order `fuerza_mayor` first
- WHEN the student opens the cause step
- THEN `medica` is not offered and the four others are offered in the stored order

#### Scenario: Draft with a deactivated cause (table-driven)

| Moment | Result |
|---|---|
| step save of the cause and dates step | refused, error on the cause field |
| submit | refused, error on the cause field |

- GIVEN a draft saved with `medica` and `medica` then deactivated
- WHEN the student saves the step or submits, as in the row
- THEN the outcome is as shown, the draft stays `borrador` and unchanged, and no audit row is written

#### Scenario: Choosing another cause clears the error

- GIVEN the refused draft above
- WHEN the student picks an active cause and saves
- THEN the save succeeds

#### Scenario: Reactivated cause is accepted again

- GIVEN a draft with `medica` refused while `medica` was deactivated
- WHEN `medica` is reactivated and the student saves
- THEN the save succeeds without changing the cause

#### Scenario: End before start

- GIVEN start 2026-10-10 and end 2026-10-09
- WHEN the student submits
- THEN submit is blocked with an error on the end date

#### Scenario: Window boundary (table-driven, window 30)

| Submission date | End date | Result |
|---|---|---|
| 2026-10-31 | 2026-10-01 | accepted (exactly 30 days) |
| 2026-10-31 | 2026-09-30 | blocked, error on end date |
| 2026-10-06 | 2026-10-20 | accepted (future allowed) |

- GIVEN the submission date and end date in the row, start on or before end
- WHEN the student submits
- THEN the outcome is as shown

#### Scenario: Window boundary follows the parameter (table-driven)

| Window | Submission date | End date | Result |
|---|---|---|---|
| 10 | 2026-10-31 | 2026-10-21 | accepted (exactly 10 days) |
| 10 | 2026-10-31 | 2026-10-20 | blocked, error on end date |
| 60 | 2026-10-31 | 2026-09-01 | accepted (exactly 60 days) |
| 60 | 2026-10-31 | 2026-08-31 | blocked, error on end date |

- GIVEN the window in the row, and start on or before end
- WHEN the student submits or saves the dates step
- THEN the outcome is as shown, with no change to the validation code

#### Scenario: The error states the configured window

- GIVEN a window of 10 and an end date 20 days old
- WHEN the error on the end date renders in `es` and in `en`
- THEN it states 10 days and does not state 30

#### Scenario: A parameter change applies to the next attempt

- GIVEN a draft with an end date 20 days old accepted under window 30
- WHEN the maintainer saves window 10 and the student saves the dates step again
- THEN the save is blocked with an error on the end date

#### Scenario: Invalid stored window falls back to 30 [PG]

- GIVEN a stored window row with value 0
- WHEN the student submits an end date 30 days old
- THEN it is accepted (the default 30 applies) and the read does not fail

#### Scenario: Window evaluated in Managua time

- GIVEN a submit at 2026-11-01 02:00 UTC (2026-10-31 20:00 in Managua)
- WHEN the server computes the submission date
- THEN it is 2026-10-31

### Requirement: Submit blocking, per field (RF-03, RN-01..RN-05, RN-23, RN-25)

Traceability: RNF-14, CU-13, Table D19. Submit MUST be re-validated on the server
regardless of client checks. When
any field is invalid the request MUST NOT be submitted and the response MUST
list every invalid field, each with a message stating the expected correction
(RF-03 e). Fields checked: cause (RN-01; one of the five and currently active),
start and end dates required and
ordered (RN-05, RF-03 a, b), end-date window (RN-23, RF-03 d; the window is the
parameter in force), at least one
subject (D15), group where required (RF-04 c), at least one
finalized supporting document (RN-03, RF-03 c), and the informed consent
(RN-25, RF-03 f; see "Consent required to submit"). A blocked submit MUST leave
the draft in `borrador`, unchanged, with no audit row. The parameters MUST be read
once for the submit and applied to every field check of that submit.
(Previously: the cause was checked against the five without activation, and the window was the constant 30.)

#### Scenario: Required field empty

- GIVEN a draft with no cause
- WHEN the student submits
- THEN nothing is submitted and the cause field shows an error with the fix

#### Scenario: Deactivated cause blocks submit

- GIVEN a valid draft whose cause is deactivated
- WHEN the student submits
- THEN it is blocked with an error on the cause field and nothing is submitted

#### Scenario: Old end date blocks submit under the configured window

- GIVEN window 10 and an otherwise valid draft with an end date 20 days old
- WHEN the student submits
- THEN it is blocked with an error on the end date stating 10 days

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

#### Scenario: Deactivated cause and old end date reported together

- GIVEN a draft with a deactivated cause and an end date older than the window
- WHEN the student submits
- THEN both the cause field and the end date field show their error at once

#### Scenario: Client bypass

- GIVEN a direct action call with invalid data
- WHEN the server processes it
- THEN it is blocked with the same field errors

#### Scenario: Parameters are read once per submit

- GIVEN a submit with the parameter read counted
- WHEN the server validates every field
- THEN the parameters are read once and the same values serve the cause and window checks
