# Delta for Coordination Escalation

Traceability: RF-05 (a), (e), RF-14 (b), (d), RN-11, RN-12, RN-13, RF-10 (c), RNF-01,
RNF-02. Based on the current main text of
`openspec/specs/coordination-escalation/spec.md`. Requirement ids MD-n are stable
and shared by all deltas of this change; for MODIFIED requirements the id is the
first words of the body, the heading keeps the baseline name.

## ADDED Requirements

### Requirement: MD-30 Manual document data is read-only for coordination (RF-10 c, RF-14 b, RF-14 d, D6, RNF-01, RNF-02)

The detail of a request with an open escalation, for a `coordinacion` of the
request's own career, MUST show, apart from the signals section, for each
current non-retired student document, its registered document type
(`Constancia médica`, `Constancia institucional`, `Otro`, or `Sin registrar`) and
its firma and sello marks (`Sí`, `No`, `Sin registrar`) as read-only text, so
that the coordinator can understand the signals RN-11, RN-12 and RN-13 that
open the case (RF-10 c). It MUST NOT show the registered or extracted student
name, issuer, issue date, rest period or days, and MUST NOT offer any control to
register, correct or clear manual data. A `coordinacion` MUST have no action that
writes manual data: a call to the save action is denied and changes nothing
(`manual-document-data` MD-6 and MD-8). The detail of a notice and the
coordinator list MUST show no manual data. The block MUST be fail-soft like the
signals section, MUST add no audit row and no audit event type, and its texts MUST
exist in both locales with the same keys, in words and never by color alone.

#### Scenario: Type and marks shown read-only

- GIVEN an open escalation of career C whose document is registered as `constancia_medica` with firma `No` and sello `Sí`
- WHEN a coordinator of C opens the detail
- THEN the type "Constancia médica", firma "No" and sello "Sí" are shown as text, with no control

#### Scenario: Registered values stay hidden

- GIVEN the same document with a manual name, issuer, issue date and rest period
- WHEN the coordinator opens the detail
- THEN none of those four values appears anywhere in the detail

#### Scenario: Unregistered data reads as such

- GIVEN a document whose type and marks are not registered
- WHEN the coordinator opens the detail
- THEN the type and both marks read `Sin registrar`

#### Scenario: No write path for coordination

- GIVEN a `coordinacion` of the request's career
- WHEN it calls the manual data save action directly
- THEN it is denied with the denied screen and nothing changes

#### Scenario: Notices and the list carry none

- GIVEN a notice of career C and the coordinator list
- WHEN the coordinator opens each
- THEN no type, mark or registered value appears

#### Scenario: Other careers are a nonexistent id

- GIVEN a coordinator of career C and an open escalation of career D
- WHEN they open its detail
- THEN the outcome equals that for a nonexistent id and no manual data is returned

#### Scenario: Read failure

- GIVEN the manual data read throws
- WHEN the coordinator opens the detail
- THEN the rest of the detail and the answer form render and the block shows a degraded notice

## MODIFIED Requirements

### Requirement: Signal outcomes on the open escalation detail (RF-05 a, RN-15, RNF-01, RNF-02)

Spec id MD-29. The detail of a request with an open escalation, for a `coordinacion` of the
request's own career, MUST show a read-only "Señales de validación" section
with, for each of the eight signals (RN-07, RN-09, RN-10, RN-11, RN-12, RN-13,
RN-14, RN-26, in that fixed order), its name and outcome (`present`, `absent`,
`not_evaluable` or, for RN-09 and RN-10 only, `not_applicable`) in words and,
for a `not_evaluable` signal, its reason label (`not_registered` included for
RN-11, RN-12 and RN-13), plus the suggested verdict,
which derives only from those outcomes (`not_applicable` ignored, see
`validation-signals`). A `not_applicable` entry MUST show the same outcome as
the staff detail ("No aplica" in `es`) and its muted explanation line, and no
evidence. The projection MUST contain only outcomes, labels and the verdict: it
MUST NOT contain extracted or manual data values (name, issuer, issue date, rest
period, days, document type, firma or sello mark), document fingerprints,
counts, the ids of the documents that raise a signal, student identity of other
requests, or the number
of any other request. The type and marks that the coordinator sees as read-only
text live in a separate block (see "Manual document data is read-only for
coordination"), not in this projection. For RN-26 `present` it MUST show only `present`, never the
number of the matching request, because the coordinator can open only escalated
requests. The section MUST offer no action, MUST NOT appear on the detail of a
notice (no documents) or in the coordinator list, and MUST NOT change the answer
form or the request state. It MUST be fail-soft like the staff section: on a
read failure the rest of the detail loads and a degraded notice replaces the
section. It MUST add no audit row and no audit event type. All its texts MUST
exist in both locales with the same keys, outcomes in words and never color
alone.
(Previously: five signals, RN-07, RN-09, RN-10, RN-14 and RN-26, and the projection excluded extracted data only.)

#### Scenario: Outcomes and labels only

- GIVEN an open escalation of career C with RN-07 `present`, RN-09 `absent` and RN-14 `not_evaluable` for `no_period`
- WHEN a coordinator of C opens the detail
- THEN the section lists the signals with their outcomes in words and the reason label for RN-14

#### Scenario: Not applicable without evidence

- GIVEN an open escalation of career C for a `fuerza_mayor` request whose extraction has rest ending before the issue date
- WHEN a coordinator of C opens the detail
- THEN RN-09 and RN-10 read "No aplica" with the muted explanation line, exactly as on the staff detail
- AND no issue date, rest period, days or any other extracted value appears

#### Scenario: Verdict shown, no extracted values

- GIVEN a request whose documents have a completed extraction with issuer, dates and days, and RN-07 `present`
- WHEN the coordinator of its career opens the detail
- THEN the section shows the suggested verdict "review carefully" and no extracted value, and the detail still holds only the fields listed in "Coordinator view limited to the own career" and the read-only block of "Manual document data is read-only for coordination"

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

#### Scenario: Manual-data signals as outcomes and labels only (SC-08, SC-14)

- GIVEN an open escalation of career C with RN-12 `present` (SC-08), RN-11 `not_evaluable` with `not_registered` and RN-13 `absent`
- WHEN a coordinator of C opens the detail
- THEN the section lists «Sello ausente» `present`, «Firma ausente» not evaluable with the `not_registered` reason label, and «Formato no corresponde a la causa» `absent`, each in words
- AND the section itself holds no type, mark value or document id
