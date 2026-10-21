# Delta for Student Requests

Covers RF-03, RF-08, RN-23 and RN-25 (explicitly not re-applied on correction).
How consent is given at first presentation lives in `justification-intake`.

## MODIFIED Requirements

### Requirement: Correction validation (RF-03, RN-01..RN-05, RN-23 and RN-25 not re-applied)

A correction MUST be re-validated on the server with the rules of intake submit
(cause from the five, ordered dates RN-05, at least one subject, group where
required, at least one valid document, at most 5 documents). The RN-23 window
(end date not older than 30 days before submission) MUST NOT be re-applied on
correction, so a request that was inside the window when first presented can
be corrected later. The consent rule (RN-25) MUST NOT be applied on correction
either: the correction screen MUST NOT show the consent checkbox, the
resubmission MUST NOT require a consent value and MUST ignore any it receives
(the correction path opts out of the consent rule explicitly, so no
`consent_required` or `consent_outdated` is ever raised there), and the request's
consent version and timestamp MUST stay exactly as they were, including empty
for a legacy request, which MUST remain correctable. Subject eligibility MUST
be re-checked through the `GroupScheduleProvider` port. All invalid fields MUST
be reported together.
(Previously: only RN-23 was excluded; the consent rule did not exist.)

#### Scenario: RN-23 not re-applied

- GIVEN a request presented with end date 5 days ago, returned, and corrected 40 days after that end date without changing the dates
- WHEN the owner resubmits
- THEN the correction is accepted

#### Scenario: RN-05 still applies

- GIVEN a correction with end date before start date
- WHEN the owner resubmits
- THEN it is blocked with an error on the end date and the request stays `devuelta`

#### Scenario: Subject outside enrollment

- GIVEN a correction adding a subject the student is not enrolled in
- WHEN the owner resubmits
- THEN it is blocked with an error on subjects

#### Scenario: No valid document

- GIVEN a correction that removes all documents
- WHEN the owner resubmits
- THEN it is blocked with an error on documents

#### Scenario: Forged owner

- GIVEN a payload carrying another student's id or a forged snapshot
- WHEN the correction is processed
- THEN identity comes from the session and the original snapshot is kept

#### Scenario: Correction never asks for consent

- GIVEN a returned request with recorded consent
- WHEN the owner reaches the correction review step and resubmits
- THEN no consent checkbox is shown and the resubmission is accepted
- AND the stored consent version and timestamp are unchanged

#### Scenario: Legacy request is correctable

- GIVEN a returned request presented before this change (no consent recorded)
- WHEN the owner corrects and resubmits it
- THEN it is accepted, still has no consent recorded, and no consent error is raised

#### Scenario: Forged consent on correction

- GIVEN a correction payload carrying a `consentVersion`, a consent timestamp or any other consent key
- WHEN the correction is processed
- THEN the value is ignored and the stored consent is unchanged
