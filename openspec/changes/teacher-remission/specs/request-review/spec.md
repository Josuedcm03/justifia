# Delta for Request Review

Covers RF-09 (a, b, c), RN-19, RNF-07. Remission rules live in `teacher-remission`.

## MODIFIED Requirements

### Requirement: Approve (RF-07 a, RN-15, RF-09, RN-19)

Approving MUST set `aprobada` and record a decision with optional text. The
secretary MAY pick a predefined approval template and edit it before
confirming; the final text (possibly empty) MUST be stored in the decision.
The approve confirmation dialog MUST state that the approval is final and
cannot be undone, in the same register as the reject dialog ("El rechazo es
definitivo: ..."), in both `es` and `en` (S6, owner decision 2026-10-13).
Approval MUST NOT add a second confirmation step: the RNF-12 two-step
confirmation applies to rejection only. The approve form MUST offer a
special-format mark (RN-19) only when the cause is `fuerza_mayor`, with a hint
that the signed-and-stamped format is uploaded from the detail right after
approving; the dialog MUST NOT contain a file input, and the secretary never
picks an existing student document. After a marked approval the secretary MUST
land on that request's detail (not the list). Approval MUST create the teacher
remissions in the same transaction (see `teacher-remission`) and MUST succeed
regardless of mail availability.
(Previously: no special-format mark; approval created no remissions.)

#### Scenario: Approve dialog states finality

- GIVEN a `pendiente` request in scope
- WHEN the secretary opens the approve dialog
- THEN the dialog text states that the approval is final and cannot be undone
- AND one confirm action approves the request, with no second confirmation

#### Scenario: Approve without text

- GIVEN a `pendiente` request in scope
- WHEN the secretary approves with empty text
- THEN the state is `aprobada` and the decision stores no text

#### Scenario: Approve with edited template

- GIVEN the approval template prefilled for the request
- WHEN the secretary edits it and confirms
- THEN the stored text is the edited text and the template code is recorded

#### Scenario: Approve marking special format

- GIVEN a `pendiente` request
- WHEN the secretary approves with the special-format mark
- THEN the request is `aprobada`, the mark is stored and the remissions are created `bloqueada` with `formato_especial_faltante`
- AND the secretary lands on the request's detail, where the upload control is shown

#### Scenario: Mark offered only for force majeure

- GIVEN the approve dialog of a request whose cause is not `fuerza_mayor`
- WHEN it is opened
- THEN no special-format mark is offered
- AND for `fuerza_mayor` the mark and its hint are offered, with no file input

#### Scenario: Approval survives mail outage

- GIVEN the mail service is down
- WHEN the secretary approves
- THEN the state is `aprobada` and remissions are `pendiente`

## ADDED Requirements

### Requirement: Remission state and resend on the staff detail (RF-09 c, RNF-07 b)

The staff detail of an `aprobada` request MUST show, per teacher: state
(`pendiente`, `enviada`, `bloqueada`), send time when sent, and the reason code
as readable text when pending or blocked. A resend control MUST be offered for
each non-sent remission and MUST work as stated in `teacher-remission`.
The teacher email recorded at approval MAY be shown to in-scope staff only,
never to students. A
request not `aprobada` MUST show no remission section. State MUST carry text,
never color alone.

#### Scenario: Sent shown with time
- GIVEN an approved request whose remission to T was sent
- WHEN the secretary opens the detail
- THEN T shows `enviada` and the send time

#### Scenario: Blocked with reason and resend
- GIVEN a remission `bloqueada` with `sin_correo`
- WHEN the secretary opens the detail
- THEN the reason is shown and a resend control is offered

#### Scenario: Non-approved request
- GIVEN a `devuelta` request
- WHEN the secretary opens the detail
- THEN no remission section is shown

### Requirement: Special-format upload on the staff detail (RF-09 b, RN-19)

For an `aprobada` special-format request, the staff detail of an in-scope
secretary MUST offer an upload control for the signed-and-stamped format, shown
with the `formato_especial_faltante` reason while no format exists. A refused
file (real format or size) MUST show a readable error and change nothing; an
`already_attached` refusal MUST also show a readable error. The control MUST NOT
be offered for unmarked requests, once a format exists, or to out-of-scope
users. The detail MUST NOT offer choosing one of the student's existing
documents as the format, nor replacing or removing an uploaded format. Once
uploaded, the detail MUST show the format by name with the download link, apart
from the student's documents, and MUST tell the secretary that sending is in
progress and to reload for the result.

#### Scenario: Upload offered while blocked
- GIVEN remissions `bloqueada` with `formato_especial_faltante`
- WHEN the in-scope secretary opens the detail
- THEN the reason and an upload control are shown

#### Scenario: Successful upload
- GIVEN the control and a valid file
- WHEN she uploads
- THEN the format is listed apart from the student's documents and the control disappears
- AND the unblocked remissions show `pendiente` (sending in progress) and, after a reload, `pendiente` or `enviada`

#### Scenario: Refused file
- GIVEN an invalid or oversized file
- WHEN she uploads
- THEN a readable error is shown and the remissions stay blocked

### Requirement: Remission UI i18n

All remission texts and reason labels MUST exist in `i18n/es.json` and
`i18n/en.json` with the same keys.

#### Scenario: Keys present
- GIVEN the remission message keys
- WHEN `es.json` and `en.json` are compared
- THEN both contain the same keys
