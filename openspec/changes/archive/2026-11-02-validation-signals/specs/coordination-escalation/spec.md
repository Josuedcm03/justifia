# Delta for Coordination Escalation

Covers RF-05 (a), RN-15, RN-26, RNF-01, RNF-02, RNF-12. Slice S3. Signal rules
live in `validation-signals`. The existing requirement "Coordinator view
limited to the own career" and "Confidentiality of the note and the answer" are
unchanged: this delta adds one section to the open-escalation detail through a
coordination-safe projection, in the way "Extracted data section" extends the
staff detail. Extracted data (names, issuers, dates, days) stays secretary-only.

## ADDED Requirements

### Requirement: Signal outcomes on the open escalation detail (RF-05 a, RN-15, RNF-01, RNF-02)

The detail of a request with an open escalation, for a `coordinacion` of the
request's own career, MUST show a read-only "Señales de validación" section
with, for each signal, its name and outcome (`present`, `absent`,
`not_evaluable`) in words and, for a `not_evaluable` signal, its reason label,
plus the suggested verdict, which derives only from those outcomes.
The projection MUST contain only outcomes, labels and the verdict: it MUST NOT
contain extracted data (name, issuer, issue date, rest period, days), document
fingerprints, counts, student identity of other requests, or the number of any
other request. For RN-26 `present` it MUST show only `present`, never the
number of the matching request, because the coordinator can open only escalated
requests. The section MUST offer no action, MUST NOT appear on the detail of a
notice (no documents) or in the coordinator list, and MUST NOT change the answer
form or the request state. It MUST be fail-soft like the staff section: on a
read failure the rest of the detail loads and a degraded notice replaces the
section. It MUST add no audit row and no audit event type. All its texts MUST
exist in both locales with the same keys, outcomes in words and never color
alone.

#### Scenario: Outcomes and labels only

- GIVEN an open escalation of career C with RN-07 `present`, RN-09 `absent` and RN-14 `not_evaluable` for `no_period`
- WHEN a coordinator of C opens the detail
- THEN the section lists the three signals with their outcomes in words and the reason label for RN-14

#### Scenario: Verdict shown, no extracted values

- GIVEN a request whose documents have a completed extraction with issuer, dates and days, and RN-07 `present`
- WHEN the coordinator of its career opens the detail
- THEN the section shows the suggested verdict "review carefully" and no extracted value, and the detail still holds only the fields listed in "Coordinator view limited to the own career"

#### Scenario: RN-26 match never gives a reference

- GIVEN RN-26 `present` against an earlier request, of the coordinator's own career or of another
- WHEN the coordinator opens the detail
- THEN the entry reads `present` with no number, no count and no link

#### Scenario: Other careers and ids are a nonexistent id

- GIVEN a coordinator of career C and an open escalation of career D
- WHEN they open its detail
- THEN the outcome equals that for a nonexistent id and no signal data is returned

#### Scenario: Notices and the list carry none

- GIVEN a notice of career C and the coordinator list
- WHEN the coordinator opens each
- THEN no signal, outcome or verdict appears

#### Scenario: Answer unaffected

- GIVEN an open escalation whose RN-26 is `present`
- WHEN the coordinator answers with a valid text
- THEN the escalation closes and the request returns to `pendiente` exactly as without signals

#### Scenario: Read failure

- GIVEN the signals read throws
- WHEN the coordinator opens the detail
- THEN the rest of the detail and the answer form render and the section shows the degraded notice

#### Scenario: No audit row

- GIVEN a coordinator opening an open escalation detail
- WHEN the audit log is read
- THEN the signals section added no row and no event type
