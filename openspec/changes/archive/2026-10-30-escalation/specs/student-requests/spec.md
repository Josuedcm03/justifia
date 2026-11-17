# Delta for Student Requests

Covers RF-07 (c), RF-10, RN-16, RNF-01, RNF-02. The escalation itself is in
`coordination-escalation`; E13: the student sees the state and a neutral
reason label, nothing else.

## MODIFIED Requirements

### Requirement: Own request detail with decision (RF-07 c, RF-08 b, RNF-01)

A student MUST open `/requests/[id]` only for their own non-draft request,
seeing cause, dates, subjects with group and teacher, documents, current
state, and the latest decision text and RN-17 reason when the state is
`devuelta`, `rechazada` or `aprobada`. While the state is
`en_revision_coordinacion`, the detail MUST show the state and a short neutral
reason label (the request is being reviewed by the coordination of the
student's career); the label MUST NOT contain the words "sospecha" or
"suspicion", nor "caso especial" or "special case", the note, the answer, the
author or the identity of any coordinator. The motive of the escalation (E18)
MUST NOT be shown to the student in any form, so a `sospecha_documento` and a
`caso_especial` escalation look identical to the owner (E13). A report or notice recorded on an `aprobada` request (the
excess-absence path) MUST NOT appear in any student view. After a coordination
answer returns the request to `pendiente`, the student MUST see only that
state. The detail MUST keep the history of earlier states and revisions.
Another student's id and an unknown id MUST yield identical denials with no
data. Reads by the student of their own requests MUST NOT be audited.
(Previously: no rule for `en_revision_coordinacion`; an escalated request showed only a state pill.)

#### Scenario: Returned request shows the reason

- GIVEN a request returned with `fecha_incorrecta` and a text
- WHEN the owner opens the detail
- THEN the state, the reason and the text are shown

#### Scenario: Escalated request shows a neutral label

- GIVEN a request in `en_revision_coordinacion` with a staff note and no answer
- WHEN the owner opens the detail
- THEN the state and the neutral reason label are shown
- AND neither the note nor any coordinator is shown

#### Scenario: Answer and note never shown

- GIVEN a request returned to `pendiente` by a coordination answer
- WHEN the owner opens the list and the detail
- THEN only the state `pendiente` is shown and no note or answer text appears anywhere

#### Scenario: Excess-absence report is invisible

- GIVEN an `aprobada` request with a recorded report and notice
- WHEN the owner opens the detail
- THEN the state and the approval decision are shown and nothing about the report, the teacher's communication or the notice

#### Scenario: Neutral wording in both locales

- GIVEN the student-facing label keys
- WHEN `es.json` and `en.json` are read
- THEN both exist and neither text contains "sospecha", "suspicion", "caso especial" or "special case"

#### Scenario: Another student's request

- GIVEN a request of student A
- WHEN student B opens its id
- THEN the response equals that of a nonexistent id and no data is returned

#### Scenario: Own reads leave no audit row

- GIVEN a student opening their list and a detail
- WHEN the audit log is read
- THEN no row was added by those reads

#### Scenario: Draft is not a request

- GIVEN a draft id owned by the student
- WHEN they open `/requests/[id]`
- THEN it is not found (the draft is resumed only through intake)

#### Scenario: Escalated request cannot be corrected

- GIVEN a request in `en_revision_coordinacion`
- WHEN the owner calls the correction action
- THEN it is refused and nothing changes
