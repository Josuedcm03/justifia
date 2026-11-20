# Delta for Student Requests

Change: `flow-experience` (roadmap row 13). Tabla 19 rows covered here: RF-07
(5.8:11, 4.9 case RF-07, Anexo F RF-07-c) and RF-08 (5.8:12, 4.9 case RF-08,
Anexo F RF-08 (a to c)). The causes are the kit and the task design, so the
changes are defensive: they help a student tell requests and files apart, and
change no rule. The list order (newest first), the neutral wording for a request
in coordination, and "Students never see validation signals" stay as they are.
Owner decision 2026-11-20: returned and rejected cards show the decision reason;
an approved card shows none (the approval text is template boilerplate, the
detail keeps the full text).

## ADDED Requirements

### Requirement: FE-14 Request cards identify the request (RF-07 c, RF-08 b; RN-16, RN-17; RNF-01, RNF-10, RNF-11)

Each card of `/requests` MUST show: the request number, the state as text, the
presentation date, the absence dates under the explicit label "Fechas de
ausencia" (`en`: "Absence dates") written with the month name so that day and
month cannot be swapped (a range, or a single day when both dates are equal),
and the subject codes of the request's subjects. The list order stays newest
first by presentation date. The card MUST contain only the student's own data and
MUST NOT contain any signal, outcome, verdict, escalation motive, note or answer.
A card of a request in `en_revision_coordinacion` keeps the neutral label. The
cards MUST be usable at 360 px with no horizontal scroll, including a request with
many subjects. All texts MUST exist in `es` and `en`. Reading the list MUST add no
audit row.

#### Scenario: Labelled dates and subjects (4.9 RF-07 c)

- GIVEN a student with two presented requests whose absence dates are 29 to 30 Oct and 1 to 3 Nov, with subjects S1 and S2 respectively
- WHEN they open `/requests`
- THEN each card shows its number, state, presentation date, the line "Fechas de ausencia" with the dates written with the month name, and its own subject codes

#### Scenario: Single-day absence

- GIVEN a request whose start and end dates are the same day
- WHEN its card renders
- THEN the "Fechas de ausencia" line shows that one date

#### Scenario: Order unchanged

- GIVEN three presented requests presented on three different days
- WHEN the list renders
- THEN the newest presentation is first

#### Scenario: No signals or escalation data on the card

- GIVEN a request with signals and an earlier escalation with a note and an answer
- WHEN the owner opens `/requests`
- THEN the card carries no signal, outcome, verdict, motive, note or answer, in the rendered output or in the data sent to the client

#### Scenario: 360 px with many subjects

- GIVEN a request with five subjects and a 360 px viewport
- WHEN the list renders
- THEN the document width does not exceed the viewport

#### Scenario: Translation keys present

- GIVEN the card label keys
- WHEN `es.json` and `en.json` are compared
- THEN both contain the same keys

### Requirement: FE-15 Decided cards show the decision reason (RF-07 c, RN-17; RNF-01, RNF-11)

A card of a request currently in `devuelta` or `rechazada` MUST show the reason
of the latest decision: for `devuelta`, the label of its RN-17 reason code; for
`rechazada`, an excerpt of the decision text. A card in `aprobada` MUST show no
reason and no excerpt, whether or not the approval carries a text (owner
decision 2026-11-20: the approval text is template boilerplate and approved
students do not ask why). An excerpt MUST be at most 140 characters, shortened
with an ellipsis when longer, shown in up to 2 lines, and the complete text
stays on the detail. The reason MUST NOT be shown on a card in `pendiente` or
`en_revision_coordinacion`, including a request corrected and resubmitted after
a return. Reading it MUST be only for the
owner and MUST add no audit row. The cards stay usable at 360 px. Texts MUST
exist in `es` and `en`.

#### Scenario: Returned card shows the reason label (4.9 RF-07 c)

- GIVEN a request returned with `documento_ilegible` and a text
- WHEN the owner opens `/requests`
- THEN its card shows the state and the label of `documento_ilegible`

#### Scenario: Rejected cards show an excerpt (table-driven, 4.9 RF-07 c)

| State | Decision text | Card shows |
|---|---|---|
| `rechazada` | 200 characters | first 140 characters with an ellipsis |
| `rechazada` | 60 characters | the whole text |

- GIVEN a request in the state with the decision text in the row
- WHEN the owner opens `/requests`
- THEN the card shows what the row says, in up to 2 lines

#### Scenario: Approved card shows no excerpt (owner decision 2026-11-20)

| State | Decision text | Card shows |
|---|---|---|
| `aprobada` | 30 characters | no reason line |
| `aprobada` | 200 characters | no reason line |
| `aprobada` | none | no reason line |

- GIVEN a request in `aprobada` with the decision text in the row
- WHEN the owner opens `/requests`
- THEN the card shows the state and no reason line, and neither the card nor the data sent to the client carries the approval text

#### Scenario: No reason while the request is open

- GIVEN a request returned, corrected and resubmitted, now `pendiente`, and a request in `en_revision_coordinacion`
- WHEN the owner opens `/requests`
- THEN neither card shows a decision reason

#### Scenario: Another student's reasons are not read

- GIVEN requests of student A with decisions
- WHEN student B opens `/requests`
- THEN no text of A's decisions appears

### Requirement: FE-16 Attached files are named, with their origin, until the resubmission (RF-08 a, b, c; RN-03, RN-04; RNF-06, RNF-11, RNF-12)

In the correction flow, the documents step, the review step and the resubmit
confirmation dialog MUST each list the current documents (retired ones excluded)
by file name, with the text mark "Nuevo" (`en`: "New") for a document attached
during this correction and "Anterior" (`en`: "Previous") for one kept from the
returned version, which is a document listed in the latest revision snapshot.
The dialog MUST make it possible to see, before confirming, exactly which files
the resubmission will carry. The dialog MUST NOT add a confirmation step or
change what confirming does: it resubmits the same request as in "In-place
correction of a returned request". The marks MUST be text, never color alone.
Long file names MUST wrap, with no horizontal scroll at 360 px. Listing names
MUST NOT read a document through the document route and MUST add no audit row.
Texts MUST exist in `es` and `en`.

#### Scenario: Dialog lists the files with their origin (4.9 RF-08 a, c)

- GIVEN a `devuelta` request whose returned version had D1 and D2, where the owner retired D1 and attached D3
- WHEN the owner opens the resubmit dialog
- THEN it lists D2 marked "Anterior" and D3 marked "Nuevo", and not D1

#### Scenario: Marks also on the documents and review steps

- GIVEN the same correction
- WHEN the owner opens the documents step and the review step
- THEN each lists D2 as "Anterior" and D3 as "Nuevo"

#### Scenario: Confirming resubmits as before (4.9 RF-08 a, c)

- GIVEN the dialog with the file list shown
- WHEN the owner confirms once
- THEN the same request id becomes `pendiente`, no second request exists and one `solicitud.corregida` row is written

#### Scenario: Long names at 360 px

- GIVEN a document whose file name has 120 characters and a 360 px viewport
- WHEN the dialog opens
- THEN the name wraps and the document width does not exceed the viewport

#### Scenario: Listing adds no read or audit row

- GIVEN a correction with two documents
- WHEN the owner opens the steps and the dialog
- THEN no request goes to the document route and no `documento.descargado` row is written

#### Scenario: Translation keys present

- GIVEN the mark and dialog keys
- WHEN `es.json` and `en.json` are compared
- THEN both contain the same keys
