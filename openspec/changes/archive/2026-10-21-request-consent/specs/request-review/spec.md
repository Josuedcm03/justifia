# Delta for Request Review

Covers RF-01 (d), RN-25, RNF-01, RNF-02, RNF-06, RNF-12. How consent is given
and stored lives in `justification-intake`.

## ADDED Requirements

### Requirement: Consent shown on the staff detail (RF-01 d, RN-25, RNF-01, RNF-02)

In addition to the content of "Staff detail with history", the staff detail of
an in-scope secretary MUST show the consent state of the request: the consent
version and the consent date and time (America/Managua) when recorded, or a
text label stating that no consent is recorded when the request was presented
before this change. The state MUST carry text, never color alone, and MUST NOT
read as an error. The request's original consent MUST remain shown after a
correction and resubmission. The consent MUST NOT be shown to students, to other
roles, or in the queue. Showing it MUST add no audit row beyond the existing
`solicitud.consultada`. Its texts MUST exist in both `i18n/es.json` and
`i18n/en.json` with the same keys.

#### Scenario: Recorded consent

- GIVEN a presented request with consent version `2026-10-20` recorded at 2026-10-21 14:05 Managua
- WHEN an in-scope secretary opens the detail
- THEN the fact reads "Version 2026-10-20, " followed by that date and time in America/Managua

#### Scenario: Legacy request

- GIVEN a request presented before this change (no consent recorded)
- WHEN an in-scope secretary opens the detail
- THEN the text label "Not recorded (presented before consent existed)" (`es` equivalent) is shown as a fact of the student section and no error is signalled

#### Scenario: Corrected request keeps its consent

- GIVEN a request with recorded consent, returned and resubmitted
- WHEN the secretary opens the detail
- THEN the original consent version and date are shown

#### Scenario: Student does not see it

- GIVEN a request with recorded consent
- WHEN its owner opens `/requests/[id]`
- THEN no consent version or date is shown

#### Scenario: Out of scope and audit

- GIVEN a request of another facultad, and an in-scope detail opened once
- WHEN each is requested
- THEN the first is denied as a nonexistent id and the second adds only one `solicitud.consultada` row

#### Scenario: Translation keys present

- GIVEN the consent display keys
- WHEN `es.json` and `en.json` are compared
- THEN both contain the same keys
