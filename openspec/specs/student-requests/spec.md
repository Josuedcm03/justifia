# Student Requests Specification

## Purpose

A student sees their submitted requests and, when a request is returned for
correction, corrects it in place. Covers RF-07 c, RF-08, RN-16, RN-17, RN-23
(explicitly not re-applied), RNF-01, RNF-02, RNF-06, RNF-11. Creation of the
request is in `justification-intake`; the decision is in `request-review`.

Terms: "own" = owned by the authenticated student; "revision" = snapshot of
the request data written when the request is returned (`devuelta`).

## Requirements

### Requirement: Own requests list (RF-07 c, RNF-01)

A student MUST see a list at `/requests` of their own presented requests
(never `borrador`), with state and presentation date, newest first. The list
MUST be built from the session user only; the student identity MUST NOT come
from request input. Only `estudiante` MAY open it. When the student has no
presented request, the empty state MUST also link to `/enrollment`, because
enrollment is what makes subjects available to a request; the link MUST be
usable at 360 px and its text MUST exist in `es` and `en`.
(Previously: the empty state carried no link to the enrollment page.)

#### Scenario: List own requests

- GIVEN a student with a draft, a `pendiente` and an `aprobada` request
- WHEN they open `/requests`
- THEN the two presented requests are listed with their states and the draft is not

#### Scenario: Other role denied

- GIVEN a user with role `secretaria`
- WHEN they open `/requests`
- THEN access is denied and no data is returned

#### Scenario: Unauthenticated

- GIVEN no session
- WHEN `/requests` is requested
- THEN access is denied and nothing is read

#### Scenario: Empty state links to enrollment

- GIVEN a student with no presented request (a draft alone does not count)
- WHEN they open `/requests`
- THEN the empty state is shown with a link to `/enrollment`

#### Scenario: No empty state with requests

- GIVEN a student with a presented request
- WHEN they open `/requests`
- THEN the list is shown and the empty state is not

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

### Requirement: In-place correction of a returned request (RF-08 a, RF-08 c, RN-16)

While a request is `devuelta`, its owner MUST be able to edit it in place:
cause, dates, subjects (with chosen groups) and documents, then resubmit. The
correction MUST NOT create a new request and MUST NOT reuse or create a
`borrador`. The returned version is already frozen: the return decision
(`request-review`, decision `devuelta`) writes the `SolicitudRevision` snapshot
in its own transaction. Edits apply in place while `devuelta`. Resubmission
MUST, in one transaction: set the state to `pendiente`, set `ReenviadaEn` from
the server clock in America/Managua (restarting the RN-08 clock), and write exactly one
`solicitud.corregida` audit row; it MUST NOT write a new revision snapshot.
Only the owner and only in `devuelta` MAY correct; any other state MUST be
refused with no change.

Guided start (RN-17; S6, owner decision 2026-10-13): when the correction is
opened without an explicit step, it MUST open at the step that matches the
RN-17 code of the latest return decision: `documento_ilegible` and
`fecha_alterada` at the Documents step (step 3), `fecha_incorrecta` at the
Cause and dates step (step 1). The mapping MUST be a pure function over the
closed RN-17 list in `src/lib/intake/return-reasons.ts`. An explicit `?step=`
MUST win over the mapping, and when the reason cannot be read the correction
MUST open at step 1. Every step MUST stay reachable and editable; the reason
MUST NOT lock any field or step. The correction screen MUST show the return
reason label and the secretary's message at the top, read from the session
owner's own latest decision (not audited, like every own read).

#### Scenario: Successful correction

- GIVEN a `devuelta` request with a first revision
- WHEN the owner fixes the dates and resubmits
- THEN the same request id is `pendiente`, `ReenviadaEn` is set, and one `solicitud.corregida` row is written
- AND the revision snapshot written by the return is kept and no new snapshot is written
- AND exactly one request exists for the student

#### Scenario: Not devuelta

- GIVEN a request in `pendiente`, `aprobada` or `rechazada`
- WHEN the owner calls the correction action
- THEN it is refused and nothing changes

#### Scenario: No draft created

- GIVEN a correction in progress
- WHEN the student edits and resubmits
- THEN no row in `borrador` exists for it at any point

#### Scenario: Clock restarts

- GIVEN a request originally presented on Monday, returned and resubmitted on Thursday
- WHEN the queue computes its deadline
- THEN the clock start is Thursday

#### Scenario: Concurrent resubmit

- GIVEN two simultaneous resubmits of one `devuelta` request
- WHEN both complete
- THEN exactly one succeeds and exactly one `solicitud.corregida` row exists
- AND the other is refused and adds no audit row

#### Scenario: Failure rolls back

- GIVEN a failure after the state change or at the audit insert
- WHEN the transaction ends
- THEN no new audit row exists and the state is still `devuelta`

#### Scenario: Illegible document opens at Documents

- GIVEN a request returned with `documento_ilegible`
- WHEN the owner opens `/requests/[id]/correct` without `?step=`
- THEN the Documents step (step 3) is shown
- AND the reason label and the secretary's message are shown at the top

#### Scenario: Altered date opens at Documents

- GIVEN a request returned with `fecha_alterada`
- WHEN the owner opens the correction without `?step=`
- THEN the Documents step (step 3) is shown

#### Scenario: Incorrect date opens at Cause and dates

- GIVEN a request returned with `fecha_incorrecta`
- WHEN the owner opens the correction without `?step=`
- THEN the Cause and dates step (step 1) is shown

#### Scenario: Every step stays reachable

- GIVEN a request returned with `documento_ilegible`, opened at step 3
- WHEN the owner moves to steps 1, 2 and 4 through the stepper or `?step=`
- THEN each step opens with its fields editable, a change saved there is kept, and the resubmit is accepted when valid
- AND the reason banner is shown on every step

#### Scenario: Explicit step wins

- GIVEN a request returned with `documento_ilegible`
- WHEN the owner opens `/requests/[id]/correct?step=2`
- THEN the Subjects step (step 2) is shown

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

### Requirement: Revision history and soft retirement (RF-08 b)

Removing a document of the latest returned revision in a correction MUST
retire it (record and file kept, `RetiradoEn` set, see `supporting-documents`)
rather than delete it, and the previous revision MUST keep its data, subjects
and documents. The student detail MUST show the
earlier states and decisions. A retired document MUST NOT count toward the
5-document cap or toward the current valid documents.

#### Scenario: Replaced document retained

- GIVEN a `devuelta` request with document D1
- WHEN the owner replaces it with D2 and resubmits
- THEN D1 is retired and kept, D2 is current, and the cap counts only D2

#### Scenario: History visible

- GIVEN a request corrected once
- WHEN the owner opens the detail
- THEN the first return, its reason and the earlier revision data are listed

### Requirement: Student screens at 360 px and i18n (RNF-11)

The list, detail and correction screens MUST be usable in full at 360 px width
with no horizontal scrolling, and all user-facing text MUST exist in both
`i18n/es.json` and `i18n/en.json`.

#### Scenario: No horizontal scroll

- GIVEN a 360 px viewport
- WHEN the list, detail and correction screens render
- THEN the document width does not exceed the viewport

#### Scenario: Translation keys present

- GIVEN the student-requests message keys
- WHEN `es.json` and `en.json` are compared
- THEN both contain the same keys

### Requirement: Students never see validation signals (RF-05, RN-26, RNF-01, RNF-02, E13)

No student view, response or notification MUST contain a signal, an outcome, a
reason code, the suggested verdict, a document fingerprint, or any trace that a
document of the student was matched with another request. This MUST hold for the
list, the detail, the correction flow, the upload and finalize results, and the
decision and escalation texts. The student view MUST NOT receive signal data
from the server. A student whose earlier document was reused by someone else
MUST NOT learn of it: the signals of the earlier request never change.

#### Scenario: Detail and list carry no signal data

- GIVEN a presented request whose signals include `present` outcomes
- WHEN its owner opens `/requests` and `/requests/[id]`
- THEN no signal, outcome, reason, verdict or fingerprint appears in the rendered output or the data sent to the client

#### Scenario: Returned and rejected requests

- GIVEN a `devuelta` or `rechazada` request with RN-07 `present`
- WHEN the owner opens the detail
- THEN only the state, the reason and the decision text are shown, and the decision text is whatever the secretary wrote

#### Scenario: Correction and upload results

- GIVEN a student correcting a returned request with a file whose fingerprint matches an earlier request
- WHEN the file is finalized and the correction is submitted
- THEN the result messages are those of the existing flow, with no mention of a repeated document

#### Scenario: Owner of the earlier document

- GIVEN a student E whose document was later reused by another student's request
- WHEN E opens the list and the detail of the earlier request
- THEN nothing indicates the reuse

#### Scenario: Another student's request

- GIVEN a request of student A with signals
- WHEN student B opens its id
- THEN the response equals that of a nonexistent id and no data is returned

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
`rechazada`, an excerpt of the decision text that starts at the reason: when the
text opens with the fixed introduction of the rejection templates, up to the
words that open the reason, the excerpt MUST leave that introduction out. A text
that does not open with it, or has nothing after it, is excerpted from its start
(owner decision 2026-11-24: the introduction alone filled the 140 characters).
A card in `aprobada` MUST show no
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

#### Scenario: The excerpt of a rejection starts at the reason (owner decision 2026-11-24)

| Decision text | Card shows |
|---|---|
| general rejection template, completed with a reason | the text from the reason on |
| document rejection template, unchanged | the text from "el documento de respaldo" on |
| general rejection template, completed with a reason over 140 characters | the first 140 characters of the reason with an ellipsis |
| a text the secretary rewrote | the text from its start |
| the introduction with nothing after it | the text from its start |

- GIVEN a request in `rechazada` with the decision text in the row
- WHEN the owner opens `/requests`
- THEN the card shows what the row says, and the detail still shows the complete text

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
