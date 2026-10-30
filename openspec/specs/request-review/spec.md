# Request Review Specification

## Purpose

The academic secretary reviews presented requests of their own facultad: a
queue ordered by the remission deadline, a staff detail, and one decision per
request (approve, reject, return for correction). Covers RF-06, RF-07, RN-08,
RN-15, RN-16, RN-17, RNF-01, RNF-02, RNF-06, RNF-12. Correction by the student
lives in `student-requests` (RF-08). Remission to the teacher (RF-09) lives in `teacher-remission`, and
signals (RF-05) are out of scope. Document access for staff is in
`supporting-documents`; audit events in `audit-log`.

Terms: "queue" = requests in `pendiente` visible to the caller; "clock start" =
`COALESCE(ReenviadaEn, PresentadaEn)`; "today" = current date in
America/Managua; "business day" = Monday to Friday that is not in the
non-working-days calendar; "scope" = the caller's `Usuario.FacultadId`.
Facultad of a request = `Carrera.FacultadId` of the student's current
`Usuario.CarreraId` (never the snapshot career name).

## Requirements

### Requirement: Review authorization and facultad scope (RF-06, RF-07, RN-15, RNF-01)

Only an authenticated user with role `secretaria` MUST be able to open the
queue, open a staff detail, or decide. Every server action, route and page
MUST re-check authentication, role and scope server-side. A `secretaria` MUST
have a `FacultadId`; one without it MUST be denied everything (fail closed). A
request outside the caller's facultad, a `borrador`, or an unknown id MUST
yield the same denial with no data. Role and scope policy MUST live in
`src/lib/auth/permissions.ts`. Other roles (including `estudiante`) MUST be
denied by URL and by direct call.

#### Scenario: Other role denied

- GIVEN a user with role `estudiante` or `coordinacion`
- WHEN they open the queue or detail by URL or call a decision action
- THEN access is denied and no request data is returned

#### Scenario: Out-of-scope facultad

- GIVEN a secretary of facultad A and a `pendiente` request of a student in facultad B
- WHEN they request that detail or decide it
- THEN the outcome is identical to a nonexistent id and nothing changes

#### Scenario: Secretary without facultad

- GIVEN a `secretaria` whose `FacultadId` is null
- WHEN they open the queue
- THEN access is denied and no rows are returned

#### Scenario: Facultad follows the current career

- GIVEN a student whose snapshot career names facultad A but whose `CarreraId` belongs to facultad B
- WHEN scope is evaluated
- THEN the request belongs to facultad B

#### Scenario: Draft never visible

- GIVEN a `borrador` of a student in the caller's facultad
- WHEN the caller requests it by id
- THEN it is not found

### Requirement: Queue ordering and RN-08 alert (RF-06, RN-08)

The queue (Pendientes tab) MUST list only `pendiente` requests in scope,
ordered by effective deadline ascending (soonest first). Presentation and clock
start use Managua dates. The base remission deadline MUST be the second
business day strictly after the clock start date (so a weekend or holiday
presentation counts from the next business day: presented Saturday, Monday is
day 1 and Tuesday is the deadline); the request is due at the end of that day.
The effective deadline MUST be the base deadline moved later by the number of
business days the request spent in coordination since the clock start. Paused
business days for one answered escalation MUST be the business days `d` with
`E <= d < A`, where `E` is the Managua date of the escalation and `A` the
Managua date of its answer; pauses of several escalations add up, and an
escalation made before the current clock start (a resubmission restarts the
clock) MUST NOT count. A request MUST be flagged "alert" when at most one
business day remains to the effective deadline and flagged "overdue" when today
is after it. Alert state MUST be computed on read, not stored. Business-day
logic MUST be a pure function using a `NonWorkingDaysProvider` port. A request
in `en_revision_coordinacion` MUST NOT appear in the queue and MUST NOT be
flagged.

#### Scenario: Ordering

- GIVEN pendiente requests with clock starts Tue, Mon and a resubmitted one with `ReenviadaEn` Wed, none escalated
- WHEN the queue is read
- THEN the order is Mon, Tue, Wed (by the `COALESCE` value)

#### Scenario: Alert and overdue boundaries (table-driven)

| Presented (Managua) | Today | State |
|---|---|---|
| Mon | Mon | none (2 business days left) |
| Mon | Tue | alert (1 left) |
| Mon | Wed | alert (0 left, due today) |
| Mon | Thu | overdue |
| Fri | Mon | alert |
| Sat | Mon | alert (1 left, deadline Tue) |
| Sat | Tue | alert (0 left, due today) |
| Sat | Wed | overdue |

- GIVEN no holidays, no escalation and the row values
- WHEN the queue is read
- THEN the state is as shown

#### Scenario: Holiday skipped

- GIVEN Tuesday is a non-working day and a request presented Monday
- WHEN today is Wednesday
- THEN the request is alert (deadline Thursday), not overdue

#### Scenario: Managua date, not UTC

- GIVEN a request presented at 2026-10-12 02:00 UTC (Sunday 20:00 in Managua)
- WHEN its deadline is computed
- THEN the clock start date is Sunday and the deadline is Tuesday

#### Scenario: Calendar year not loaded

- GIVEN the constant calendar has no entries for the current year
- WHEN the calendar test suite runs
- THEN a test fails, so a stale calendar is detected

#### Scenario: Decided or escalated requests leave the queue

- GIVEN a request that was approved, rejected, returned or escalated
- WHEN the queue is read
- THEN it is absent

#### Scenario: Deadline excludes time in coordination (table-driven)

| Presented | Escalated | Answered | Effective deadline |
|---|---|---|---|
| Mon | Mon | Thu | next Mon (base Wed; paused Mon, Tue, Wed = 3; +3 = Thu, Fri, Mon) |
| Mon | Tue | Tue (same day) | Wed (0 paused) |
| Mon | Tue | next Mon | next Tue (base Wed; paused Tue to Fri = 4, weekend skipped; +4 = Thu, Fri, Mon, Tue) |

- GIVEN no holidays and an answered escalation with the row values
- WHEN the request is back in the queue
- THEN its effective deadline is as shown

#### Scenario: Holiday inside the pause

- GIVEN an escalation spanning a non-working day
- WHEN paused days are counted
- THEN the non-working day is not counted

#### Scenario: Two escalations add up

- GIVEN a request answered after two separate escalations
- WHEN the effective deadline is computed
- THEN the paused business days of both are added

#### Scenario: Escalation before a resubmission is ignored

- GIVEN a request escalated and answered, later returned, corrected and resubmitted
- WHEN the effective deadline is computed
- THEN the earlier pause is not counted and the clock starts at `ReenviadaEn`

#### Scenario: Order follows the effective deadline

- GIVEN request A presented Mon with a paused business day of 3 and request B presented Tue with none
- WHEN the queue is read
- THEN B precedes A

### Requirement: Staff detail with history (RF-06, RF-08 b, RN-16)

A secretary in scope MUST be able to open a request detail showing: cause,
dates, the student snapshot (name, CIF, career, email), subjects with group and
teacher, current documents, state, alert state, the prior revisions
(snapshots written by each return), the decision history (state, template or
reason code, final text, author and time), and the documents retired by prior
revisions, marked as retired. Class data (group, teacher) MUST be read only
through the `solicitud-clases` seam. The detail of a request in `devuelta`, in
`en_revision_coordinacion` or in a decided state MUST be viewable by an
in-scope secretary but offers no decision action.

#### Scenario: Detail of a corrected request

- GIVEN a request returned once and corrected with one document replaced
- WHEN the secretary opens it
- THEN they see the current revision, the first revision snapshot, the earlier return decision with its text, and the replaced document marked retired

#### Scenario: Decision actions only when pendiente

- GIVEN a request in `aprobada` or `en_revision_coordinacion`
- WHEN the secretary opens its detail
- THEN no approve, reject or return control is offered

### Requirement: Changes since the return flagged on the staff detail (RF-06, RF-08 b, RN-16, RN-17)

On the staff detail of a resubmitted request (`ReenviadaEn` set, at least one
`SolicitudRevision`, state not `devuelta`), the secretary MUST see what
changed compared with the latest revision snapshot (the one written by the
last return): for each section (cause and dates, subjects, documents) a
"changed" or "unchanged" mark, and for documents the list of documents
retired since that return and the list of documents added since it. The
comparison MUST be computed on read by a pure function over the snapshot and
the current request (no schema change, nothing stored). Subjects MUST be
compared as a set of (subject, group number); documents as a set of ids
(snapshot `DocumentoIds` vs current non-retired documents). The flags MUST
NOT write any audit row beyond the existing `solicitud.consultada` of the
detail and MUST NOT add a new audit event type. A request with no revision or
without `ReenviadaEn`, and a request currently `devuelta`, MUST show no flags.
Marks MUST carry text, never color alone.

#### Scenario: Unchanged section

- GIVEN a resubmitted request whose cause and dates equal those of the latest revision
- WHEN the secretary opens the detail
- THEN cause and dates is marked "unchanged"

#### Scenario: Changed subjects

- GIVEN a resubmitted request where the student replaced one subject group present in the latest revision
- WHEN the secretary opens the detail
- THEN subjects is marked "changed" and cause and dates keeps its own mark

#### Scenario: Retired and new documents

- GIVEN a request returned with documents D1 and D2, corrected by retiring D1 and adding D3, and resubmitted
- WHEN the secretary opens the detail
- THEN documents is marked "changed", D1 is listed as retired and D3 as added, and D2 is in neither list

#### Scenario: First-time pending request shows no flags

- GIVEN a `pendiente` request that was never returned (no revision, `ReenviadaEn` null)
- WHEN the secretary opens the detail
- THEN no change flags are shown

#### Scenario: Flags add no audit row

- GIVEN a resubmitted request with changes
- WHEN the secretary opens the detail once
- THEN exactly one `solicitud.consultada` row is written and no other audit row

### Requirement: State transitions (RN-15, RN-16, RN-17)

Only a `secretaria` in scope MUST decide a request. Allowed transitions: by a
decision, `pendiente` to `aprobada`, `rechazada` or `devuelta`; by an
escalation, `pendiente` to `en_revision_coordinacion` (a `secretaria` in
scope); by a coordination answer, `en_revision_coordinacion` back to
`pendiente` (a `coordinacion` of the request's career, see
`coordination-escalation`). No other transition into or out of
`en_revision_coordinacion` MUST exist, and an `aprobada` request MUST NOT enter
it. A transition MUST be a single guarded update that applies only if the
state is still the expected source state, written in the same transaction as
its decision or escalation row and audit row. A decision on a request in any
state other than `pendiente` MUST fail without change.

#### Scenario: Concurrent decisions

- GIVEN two secretaries of the facultad deciding the same `pendiente` request at the same time
- WHEN both complete
- THEN exactly one succeeds, one decision row and one audit row exist, and the other receives a "already decided" outcome

#### Scenario: Decide an already decided request

- GIVEN a request in `rechazada`
- WHEN a decision action targets it
- THEN it fails and state, decisions and audit are unchanged

#### Scenario: Decision refused in coordination

- GIVEN a request in `en_revision_coordinacion`
- WHEN a secretary calls approve, reject or return on it
- THEN it fails and state, decisions and audit are unchanged

#### Scenario: Coordination reachable only by escalation

- GIVEN requests in `pendiente`, `aprobada`, `rechazada`, `devuelta` and `borrador`
- WHEN each allowed transition is enumerated
- THEN `en_revision_coordinacion` is entered only from `pendiente` by an escalation and left only to `pendiente` by an answer

#### Scenario: Approved never escalates

- GIVEN an `aprobada` request
- WHEN an escalation or answer call targets it
- THEN it fails and the state stays `aprobada`

#### Scenario: Failure rolls back

- GIVEN a failure after the state update or in the audit insert
- WHEN the transaction ends
- THEN the request is still in its source state with no decision, escalation or audit row

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

### Requirement: Return for correction with RN-17 code (RF-07 b, RN-17)

Returning MUST require exactly one reason code from the closed RN-17 list:
`fecha_incorrecta`, `fecha_alterada`, `documento_ilegible`. Any other value
MUST be refused. The state MUST become `devuelta` and the decision MUST store
the code and the final text. In the same transaction the return MUST write
one `SolicitudRevision` snapshot of the returned version (cause, dates,
classes, current document ids, `Numero` = previous maximum + 1); approve and
reject write none. The student sees the state and the text (RF-07 c).

#### Scenario: Valid return

- GIVEN a `pendiente` request
- WHEN the secretary returns it with `documento_ilegible`
- THEN the state is `devuelta` and the decision stores the code
- AND exactly one new `SolicitudRevision` snapshot exists for the request

#### Scenario: Missing or foreign code

- GIVEN a return with no code or a code outside the list
- WHEN the server validates it
- THEN it is refused with a field error and the request stays `pendiente`

### Requirement: Reject with required text and confirmation (RF-07, RN-17, RNF-12)

Rejecting MUST require non-empty text, trimmed, of at most 1000 characters; the
server MUST enforce the bounds regardless of the client. Rejecting MUST require
explicit confirmation in a dialog before execution; cancelling MUST change
nothing. Rejection is irreversible in this change.

#### Scenario: Confirmed rejection

- GIVEN a reject text of 200 characters
- WHEN the secretary confirms the dialog
- THEN the state is `rechazada` and the decision stores the text

#### Scenario: Text bounds (table-driven)

| Text | Result |
|---|---|
| empty or whitespace only | refused, error on text |
| 1000 characters | accepted |
| 1001 characters | refused, error on text |

- GIVEN a reject call with the text in the row
- WHEN the server validates it
- THEN the outcome is as shown and a refusal leaves the request `pendiente`

#### Scenario: Cancel the dialog

- GIVEN the reject dialog is open
- WHEN the secretary cancels
- THEN no state, decision or audit row changes

#### Scenario: Client bypass

- GIVEN a direct reject action call without confirmation flow and with empty text
- WHEN the server processes it
- THEN it is refused

### Requirement: Predefined editable templates

Decision messages MUST be offered as predefined templates per outcome (and per
return reason), prefilled with request data (student name, cause, date range)
and editable before confirming. Templates MUST be pure domain data testable
without a database. The stored final text MUST be exactly what the secretary
confirmed. The template code and reason code, never the text, are what audit
may carry.

#### Scenario: Prefill

- GIVEN a request of student X for medical cause on given dates
- WHEN the secretary picks the approval template
- THEN the text field is prefilled with X, the cause and the dates and remains editable

#### Scenario: Free text is personal data

- GIVEN a decision with confirmed text
- WHEN the decision is stored
- THEN the text exists only in the decision row and not in any audit payload

### Requirement: Decision data is append-only

Each decision MUST create a new decision row (state, template code, reason
code, text, author, time) that MUST NOT be updated or deleted by the
application. A request MUST keep all its decisions across corrections.

#### Scenario: Two decisions over a correction

- GIVEN a request returned, corrected and then approved
- WHEN its decisions are read
- THEN both rows exist in order

### Requirement: Review UI usability and i18n (RNF-12)

All user-facing text of the review screens MUST exist in both `i18n/es.json`
and `i18n/en.json`. The sidebar MUST show the review entry only to
`secretaria`.

#### Scenario: Translation keys present

- GIVEN the review message keys
- WHEN `es.json` and `en.json` are compared
- THEN both contain the same keys

#### Scenario: Menu per role

- GIVEN a `estudiante` session
- WHEN the sidebar renders
- THEN no review entry is shown

### Requirement: Remission state and resend on the staff detail (RF-09 c, RNF-07 b)

The staff detail of an `aprobada` request MUST show, per teacher: state
(`pendiente`, `enviada`, `bloqueada`), send time when sent, and the reason code
as readable text when pending or blocked. A resend control MUST be offered for
each non-sent remission and MUST work as stated in `teacher-remission`,
except a remission blocked with `formato_especial_faltante`: only the format
upload unblocks it, so no resend control is shown.
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

#### Scenario: Blocked by the missing special format
- GIVEN a remission `bloqueada` with `formato_especial_faltante`
- WHEN the secretary opens the detail
- THEN the reason is shown and no resend control is offered

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

### Requirement: Extracted data section on the staff detail (RF-11 a, RF-11 b, RN-02, RNF-01)

In addition to the content of "Staff detail with history", the staff detail
MUST show a "Datos extraídos" / "Extracted data" section, after the documents
section, with one entry per current (non-retired) student document. When the
request has no such document and the read succeeded, the section MUST be
omitted. The section MUST be visible only to the roles that may open the staff
detail, under the same scope rules, and the access decision MUST live in
`src/lib/auth/permissions.ts`. It MUST NOT be shown to students, to other
roles or in the queue, and the student view MUST NOT receive extracted data.
For a `completada` document the entry MUST show, with text labels: the name
found in the document, the issuer, the issue date and the rest period. The rest
period MUST show from and to dates with the number of days, a single date with
the number of days when both dates are the same day, or only the number of days
when the document gave no dates. A field without value MUST show the muted text
"no reconocido" and no value (RF-11 b). Dates are calendar dates shown without
time-zone shift. The name MUST be labelled as read from the document, MUST NOT
replace or alter the snapshot name of the request (RN-02) and MUST NOT be
compared with it.

#### Scenario: Full data shown

- GIVEN a `completada` document with name, issuer, issue date and rest 2026-07-20 to 2026-07-24 (5 days)
- WHEN an in-scope secretary opens the detail
- THEN the four fields show those values, with the days next to the period

#### Scenario: Unrecognized field

- GIVEN a `completada` document with issuer but no rest period
- WHEN the secretary opens the detail
- THEN the issuer is shown and the rest period reads "no reconocido" with no value

#### Scenario: Days only

- GIVEN a document whose rest period is 3 days with no dates
- WHEN the secretary opens the detail
- THEN the period reads 3 days with no from or to date

#### Scenario: Snapshot name wins

- GIVEN extracted name "X" and snapshot name "Y"
- WHEN the secretary opens the detail
- THEN the student section shows "Y" and the extracted section shows "X" as read from the document

#### Scenario: Not for students or other roles

- GIVEN a request with a `completada` document
- WHEN its owner opens `/requests/[id]`, or a user whose role may not review requests (for example `coordinacion`) requests the staff detail
- THEN no extracted data is shown or returned

### Requirement: Extraction states on the staff detail (RF-11)

A document without a `completada` row MUST show a state instead of values,
with text and never color alone. The state MUST be decided in this order, the
first match winning: completed data; a request that is not `pendiente`, which
shows "unavailable"; a `fallida` row, which shows "unavailable"; extraction not
configured; and otherwise "extracting". While the request is `pendiente`, a
`pendiente` or `procesando` row, or a missing row for an eligible document,
MUST therefore show an "extracting" state, with no polling. The "unavailable"
state MUST tell staff to review the document themselves, with no retry, edit or
other action. A document without `completada` data in a request that is not
`pendiente` MUST never show extracting. A `no_aplica` document is not listed.
When extraction is not configured, the section MUST show once, at its top and
in place of the extracting state, the message «Hace falta configurar el
servicio de extracción. Contacte al administrador del sistema.» (`en`
equivalent), which MUST NOT name the environment variable, the address or the
key; documents waiting for the setting are not listed one by one. Completed
data and `fallida` entries MUST still show when extraction is not configured.

#### Scenario: Extracting

- GIVEN a `pendiente` request whose document row is `procesando` (or not yet created)
- WHEN the secretary opens the detail
- THEN the entry reads "extracting" and offers no action

#### Scenario: Permanently failed

- GIVEN a `fallida` row
- WHEN the secretary opens the detail
- THEN the entry reads "unavailable, review the document" and has no retry or edit control

#### Scenario: Not configured

- GIVEN extraction is not configured and two documents waiting
- WHEN the secretary opens the detail
- THEN the configuration message appears once and no extracting state is shown
- AND the message does not contain the variable name

#### Scenario: Decided request never extracting

- GIVEN an `aprobada` request with a document row still `pendiente`
- WHEN the secretary opens the detail
- THEN the entry reads "unavailable", not "extracting"

### Requirement: Extracted data is fail-soft and adds no audit row (RF-11, RNF-06)

The extracted-data read MUST be fail-soft: if it fails or throws, the staff
detail MUST still load completely, and the section MUST show a degraded notice
in place of the entries, with no partial or stale values. Showing the section
MUST add no audit row beyond the existing `solicitud.consultada` and MUST NOT
add an audit event type.

#### Scenario: Read failure

- GIVEN the extracted-data read throws
- WHEN the secretary opens the detail
- THEN the rest of the detail renders and the section shows the degraded notice

#### Scenario: One audit row

- GIVEN a request with extracted data
- WHEN the secretary opens the detail once
- THEN exactly one `solicitud.consultada` row is written and no other

### Requirement: Extraction UI i18n

All texts of the extracted-data section (labels, "no reconocido", extracting,
unavailable, degraded notice, the configuration message and the rest-period
wording) MUST exist in both `i18n/es.json` and `i18n/en.json` with the same
keys.

#### Scenario: Translation keys present

- GIVEN the extraction message keys
- WHEN `es.json` and `en.json` are compared
- THEN both contain the same keys

### Requirement: Review state tabs (RF-06, RF-10, RF-15, E14)

`/review` MUST offer three tabs for the in-scope secretary: Pendientes
(`pendiente`), En coordinacion (`en_revision_coordinacion`) and Aprobadas
(`aprobada`). Pendientes MUST be the default. Each tab MUST list only requests
in scope (facultad of the student's current career) in that state, never a
`borrador`, and each row MUST link to the staff detail. En coordinacion MUST be
ordered by escalation time ascending (oldest first) and show the reason label
(either motive, E18) and the notification status, without a horizontal scroll at
a desktop width of 1280 px (the deadline pause shown under the escalation time,
the career under the student) and as cards at 360 px; Aprobadas MUST be
ordered by approval time
descending and show the number of recorded reports; only Pendientes shows the
alert and overdue marks. The selected tab MUST be addressable so it can be
bookmarked. `rechazada` and `devuelta` requests appear in no tab. Search by
CIF or name is not part of this change. Opening a tab MUST follow the audit
rules in `audit-log`. All tab texts MUST exist in both locales.

#### Scenario: Default tab

- GIVEN an in-scope secretary
- WHEN they open `/review` with no tab selected
- THEN Pendientes is shown

#### Scenario: Requests per tab (table-driven)

| Request state | Appears in |
|---|---|
| `pendiente` | Pendientes |
| `en_revision_coordinacion` | En coordinacion |
| `aprobada` | Aprobadas |
| `rechazada`, `devuelta`, `borrador` | no tab |

- GIVEN one in-scope request per state in the table
- WHEN each tab is read
- THEN each request appears only where shown

#### Scenario: Out-of-scope requests absent

- GIVEN a coordination request and an approved request of another facultad
- WHEN the secretary opens En coordinacion and Aprobadas
- THEN neither appears

#### Scenario: Non-secretary denied

- GIVEN a `coordinacion`, `estudiante` or `administrador`
- WHEN they open any tab by URL
- THEN access is denied and no rows are returned

### Requirement: Escalation controls and history on the staff detail (RF-10, RN-15, RNF-12)

The staff detail of a `pendiente` request MUST offer, beside the decision
actions, an "Escalate to coordination" action with a required motive
("Sospecha sobre un documento" or "Caso especial (fuera de las causas del
reglamento)", no default preselected, E18), a required note and a
confirmation dialog (see `coordination-escalation`). The staff detail of any
request that has escalation records MUST show their history: reason label,
note, author and time of each, and for an answered escalation the answer, the
answering user and time; these texts are staff-only. A request in
`en_revision_coordinacion` MUST show the open escalation and the notification
status, and MUST offer no approve, reject, return or escalate control. When
the student's current career has no active `coordinacion` account (E17), the
escalate action of a `pendiente` request MUST be shown unavailable with a text
that names the career and asks to have the administrator create the
coordination account; the server refuses the same way (see
`coordination-escalation`). Staff detail reads MUST add no audit row beyond
the existing `solicitud.consultada`.

#### Scenario: Escalate offered when pendiente

- GIVEN a `pendiente` request in scope
- WHEN the secretary opens its detail
- THEN the escalate action is offered beside approve, reject and return

#### Scenario: Motive is required in the dialog (E18)

- GIVEN the escalate dialog with a note and no motive chosen
- WHEN the secretary confirms
- THEN no escalation is made, the error "Seleccione el motivo del escalamiento." is shown on the motive, and choosing "Caso especial (fuera de las causas del reglamento)" then confirming escalates with that motive

#### Scenario: In coordination, no controls

- GIVEN a request in `en_revision_coordinacion`
- WHEN the in-scope secretary opens its detail
- THEN the open escalation, its note and the notification status are shown and no decision or escalate control is offered

#### Scenario: Answer visible to staff

- GIVEN a request returned to `pendiente` by a coordination answer
- WHEN the secretary opens its detail
- THEN the earlier escalation with its note and answer, author and times is listed

#### Scenario: Escalation unavailable without a coordination account (E17, table-driven)

| Career of the student | Escalate action |
|---|---|
| active `coordinacion` account with email | offered |
| active `coordinacion` account, none with email | offered |
| no active `coordinacion` account | unavailable, text names the career and asks to have the administrator create the account |

- GIVEN a `pendiente` request in scope and the career in the row
- WHEN the secretary opens its detail
- THEN the escalate action is as shown

#### Scenario: Escalate not offered elsewhere

- GIVEN a request in `aprobada`, `rechazada` or `devuelta`
- WHEN the secretary opens its detail
- THEN no escalate control is offered

### Requirement: Absence reports and notification status on the staff detail (RF-15, RF-10 b, RNF-07)

The staff detail of an `aprobada` request MUST offer a "Record absence report"
action (teacher chosen from the request's remitted teachers, communicated
date, optional note, confirmation dialog) and MUST list the recorded reports
(teacher name, communicated date, note, author and time), apart from the
remission section. Each escalation record and notice MUST show its
notification status as text: `pendiente` (pending send, with the reason
`error_envio` when a send failed), `enviada` (with send time) or `bloqueada`
(with `sin_destinatarios` stated as no active coordination account with email
for the career). A resend control MUST be offered for every notification that
is not `enviada`. A request not `aprobada` MUST show no report action. A
report MUST NOT alter the remission section.

#### Scenario: Report action and list

- GIVEN an `aprobada` request with remissions to T1 and T2
- WHEN the secretary opens its detail
- THEN the report action offers T1 and T2 only, and previous reports are listed

#### Scenario: Status texts (table-driven)

| Notification | Text shown |
|---|---|
| `pendiente` | pending send |
| `pendiente` with `error_envio` | pending send, last attempt failed |
| `enviada` | sent, with time |
| `bloqueada` with `sin_destinatarios` | no coordination recipient for the career |
| not `enviada`, and its escalation is answered | will not be sent, the coordination already answered |

- GIVEN a notice or escalation with the notification in the row
- WHEN the secretary opens the detail
- THEN the text shown is as in the row and a resend control is offered unless `enviada` or its escalation is answered

#### Scenario: Remissions unchanged by a report

- GIVEN an `aprobada` request with remissions `enviada`
- WHEN a report is recorded
- THEN the remission section shows the same states and times

#### Scenario: No report action when not approved

- GIVEN a `pendiente` request
- WHEN the secretary opens its detail
- THEN no report action is shown

### Requirement: Escalation UI i18n

All texts of the tabs, escalation and report dialogs, histories and
notification status MUST exist in both `i18n/es.json` and `i18n/en.json` with
the same keys.

#### Scenario: Translation keys present

- GIVEN the review escalation keys
- WHEN `es.json` and `en.json` are compared
- THEN both contain the same keys
