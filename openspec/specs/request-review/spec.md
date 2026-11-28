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
start use Managua dates. The base remission deadline MUST be the N-th business day
strictly after the clock start date, where N is the remission-days parameter in
force (RN-08, RNF-14; default 2; with the default a weekend or holiday
presentation counts from the next business day: presented Saturday, Monday is
day 1 and Tuesday is the deadline); the request is due at the end of that day.
The effective deadline MUST be the base deadline moved later by the number of
business days the request spent in coordination since the clock start. Paused
business days for one answered escalation MUST be the business days `d` with
`E <= d < A`, where `E` is the Managua date of the escalation and `A` the
Managua date of its answer; pauses of several escalations add up, and an
escalation made before the current clock start (a resubmission restarts the
clock) MUST NOT count. A request MUST be flagged "alert" when at most A business
days remain to the effective deadline, where A is the alert-days parameter in force
(RN-08, RNF-14; default 1), and flagged "overdue" when today is after it. Alert
state MUST be computed on read, not stored. Business-day logic MUST be a pure
function using a `NonWorkingDaysProvider` port whose dates are the `calendario`
parameter, and it MUST receive the remission days and the alert days as inputs. The
parameters in force at read time MUST apply to every `pendiente` request, including
those presented before the change; the stored clock start (`PlazoInicioEn`) MUST NOT
be recomputed. The queue MUST show a calendar coverage notice, as text, when the
calendar holds no non-working date of the current Managua year, and MUST NOT show it
otherwise; the rows MUST still be listed. A request in `en_revision_coordinacion`
MUST NOT appear in the queue and MUST NOT be flagged.
(Previously: the deadline was always the second business day and the alert always at one business day left, both code constants; the calendar was a code constant checked by a real-clock test.)

#### Scenario: Ordering

- GIVEN pendiente requests with clock starts Tue, Mon and a resubmitted one with `ReenviadaEn` Wed, none escalated
- WHEN the queue is read
- THEN the order is Mon, Tue, Wed (by the `COALESCE` value)

#### Scenario: Alert and overdue boundaries (table-driven, defaults 2 and 1)

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

- GIVEN no holidays, no escalation, remission days 2, alert days 1 and the row values
- WHEN the queue is read
- THEN the state is as shown

#### Scenario: Remission days change the deadline (table-driven, alert days 1)

| Remission days | Presented | Today | State |
|---|---|---|---|
| 3 | Mon | Mon | none (3 left, deadline Thu) |
| 3 | Mon | Tue | none (2 left) |
| 3 | Mon | Wed | alert (1 left) |
| 3 | Mon | Thu | alert (0 left, due today) |
| 3 | Mon | Fri | overdue |
| 1 | Mon | Mon | alert (1 left, deadline Tue) |
| 1 | Mon | Wed | overdue |

- GIVEN no holidays, no escalation and the row values
- WHEN the queue is read
- THEN the state is as shown

#### Scenario: Alert days change the alert (table-driven, remission days 2, presented Mon)

| Alert days | Today | State |
|---|---|---|
| 0 | Tue | none (1 left) |
| 0 | Wed | alert (0 left, due today) |
| 2 | Mon | alert (2 left) |
| 2 | Thu | overdue |

- GIVEN no holidays and the row values
- WHEN the queue is read
- THEN the state is as shown

#### Scenario: A parameter change applies to the next read

- GIVEN a request presented Monday, remission days 2, and today Tuesday so the request is flagged alert
- WHEN the maintainer saves remission days 3 and the queue is read again
- THEN the same request is not flagged and its deadline is Thursday

#### Scenario: A calendar change moves the deadline

- GIVEN a request presented Monday with deadline Wednesday
- WHEN Tuesday is added to the calendar and the queue is read
- THEN the deadline is Thursday

#### Scenario: Stored clock start is kept

- GIVEN a request whose answered escalation stored `PlazoInicioEn` under the old calendar
- WHEN a date is added to the calendar and the queue is read
- THEN the stored `PlazoInicioEn` is unchanged and the deadline is computed from it with the new calendar

#### Scenario: Holiday skipped

- GIVEN Tuesday is a non-working day and a request presented Monday
- WHEN today is Wednesday
- THEN the request is alert (deadline Thursday), not overdue

#### Scenario: Managua date, not UTC

- GIVEN a request presented at 2026-10-12 02:00 UTC (Sunday 20:00 in Managua)
- WHEN its deadline is computed
- THEN the clock start date is Sunday and the deadline is Tuesday

#### Scenario: Calendar coverage notice

- GIVEN the calendar holds no non-working date of the current Managua year, and one pendiente request
- WHEN the queue is read
- THEN the coverage notice is shown as text and the request is still listed with its state

#### Scenario: No notice when the year is covered

- GIVEN the calendar holds at least one date of the current Managua year
- WHEN the queue is read
- THEN no coverage notice is shown

#### Scenario: The detail uses the same parameters

- GIVEN remission days 3 and the detail of a request presented Monday, opened on Wednesday
- WHEN the staff detail renders its deadline state
- THEN it shows the same deadline as the queue (Thursday) and the alert state of the queue

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

- GIVEN no holidays, remission days 2 and an answered escalation with the row values
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

Spec id MD-26. In addition to the content of "Staff detail with history", the staff detail
MUST show a "Datos leídos del documento" / "Extracted data" section, after the documents
section, with one entry per current (non-retired) student document. When the
request has no such document and the read succeeded, the section MUST be
omitted. The section MUST be visible only to the roles that may open the staff
detail, under the same scope rules, and the access decision MUST live in
`src/lib/auth/permissions.ts`. It MUST NOT be shown to students, to other
roles or in the queue, and the student view MUST NOT receive extracted data or
manual data. For a document whose effective state is `completada` (its
extraction is `completada`, or at least one manual value exists, see
`document-extraction` MD-21) the entry MUST show, with text labels: the name
found in the document, the issuer, the issue date and the rest period, each with
its effective value. A datum whose value is manual MUST carry the text mark
«Ingresado manualmente» / "Entered manually" (RF-14 a, RN-24), never by color
alone; an extracted value carries no mark. The entry MUST also show the
registered document type and the firma and sello marks, each with its state
(`Sin registrar` included). The rest
period MUST show from and to dates with the number of days, a single date with
the number of days when both dates are the same day, or only the number of days
when the document gave no dates. A field without value MUST show the muted text
"no reconocido" and no value (RF-11 b). Dates are calendar dates shown without
time-zone shift. The name MUST be labelled as read from the document, MUST NOT
replace or alter the snapshot name of the request (RN-02) and MUST NOT be
compared with it, whether it is extracted or manual.
(Previously: only extracted values, no manual mark, no document type or marks.)

#### Scenario: Full data shown

- GIVEN a `completada` document with name, issuer, issue date and rest 2026-07-20 to 2026-07-24 (5 days)
- WHEN an in-scope secretary opens the detail
- THEN the four fields show those values, with the days next to the period, and none carries the manual mark

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

#### Scenario: Manual name does not touch the snapshot

- GIVEN a manual name "Z" and snapshot name "Y"
- WHEN the secretary opens the detail
- THEN the student section shows "Y", the data section shows "Z" with the manual mark, and no comparison is shown

#### Scenario: Not for students or other roles

- GIVEN a request with a `completada` document
- WHEN its owner opens `/requests/[id]`, or a user whose role may not review requests (for example `coordinacion`) requests the staff detail
- THEN no extracted data is shown or returned

#### Scenario: RF-14 (a) each datum is marked manual (hoja step a)

- GIVEN a request where the secretary registered name, issuer, issue date and rest period of a document
- WHEN the detail is shown
- THEN each of the four data reads «Ingresado manualmente» next to its value

#### Scenario: Manual value prevails and is marked

- GIVEN extracted issuer "A", manual issuer "B" and extracted issue date
- WHEN the secretary opens the detail
- THEN the issuer reads "B" with the manual mark, the issue date reads the extracted value with no mark, and "A" appears only as the extracted reference in the form

#### Scenario: Clearing removes the mark

- GIVEN a manual issuer that the secretary cleared, over an extracted issuer "A"
- WHEN the detail is shown
- THEN the issuer reads "A" with no manual mark

#### Scenario: Registered values on a failed extraction

- GIVEN a `fallida` row and a manual issue date
- WHEN the secretary opens the detail
- THEN the entry shows the issue date with the manual mark and the other three data as "no reconocido", not the "unavailable" state

#### Scenario: RF-14 (d) type and marks are shown (hoja steps b, d)

- GIVEN a document registered with type `constancia_medica`, firma `Sí` and sello `Sin registrar`
- WHEN the secretary opens the detail
- THEN the entry shows the type "Constancia médica", firma "Sí" and sello "Sin registrar"

### Requirement: Extraction states on the staff detail (RF-11)

Spec id MD-27. A document without effective `completada` data MUST show a state instead of values,
with text and never color alone. The state MUST be decided in this order, the
first match winning: completed data (extraction `completada` or at least one
manual value among the four data, `document-extraction` MD-21); a request that
is not `pendiente`, which
shows "unavailable"; a `fallida` row, which shows "unavailable"; extraction not
configured; and otherwise "extracting". While the request is `pendiente`, a
`pendiente` or `procesando` row, or a missing row for an eligible document,
MUST therefore show an "extracting" state, with no polling. The "unavailable"
state MUST tell staff to review the document themselves, with no retry and no
extraction control; while the request is `pendiente` its only action is the
manual data form (MD-23), and the same holds for the "extracting" state. A
document without effective `completada` data in a request that is not
`pendiente` MUST never show extracting. A `no_aplica` document is not listed.
When extraction is not configured, the section MUST show once, at its top and
in place of the extracting state, the message «Hace falta configurar el
servicio de extracción. Contacte al administrador del sistema.» (`en`
equivalent), which MUST NOT name the environment variable, the address or the
key. While the request is `pendiente`, each current document waiting for the
setting MUST still be listed as an entry that carries its manual data form (RF-14
c) and no per-document state text; once the request is not `pendiente` such
documents are not listed. Completed data and `fallida` entries MUST still show
when extraction is not configured.
(Previously: "unavailable" offered no edit or other action, and documents waiting for the setting were not listed one by one.)

#### Scenario: Extracting

- GIVEN a `pendiente` request whose document row is `procesando` (or not yet created)
- WHEN the secretary opens the detail
- THEN the entry reads "extracting", offers no retry or extraction control and offers the manual data form

#### Scenario: Permanently failed

- GIVEN a `fallida` row
- WHEN the secretary opens the detail
- THEN the entry reads "unavailable, review the document" with no retry control and with the manual data form while the request is `pendiente`

#### Scenario: Not configured

- GIVEN extraction is not configured and two documents waiting in a `pendiente` request
- WHEN the secretary opens the detail
- THEN the configuration message appears once, no extracting state is shown, and each of the two documents is listed with its manual data form
- AND the message does not contain the variable name

#### Scenario: Not configured and not pendiente

- GIVEN extraction is not configured and an `aprobada` request whose document has no manual data
- WHEN the secretary opens the detail
- THEN the configuration message appears once and the waiting document is not listed

#### Scenario: Decided request never extracting

- GIVEN an `aprobada` request with a document row still `pendiente`
- WHEN the secretary opens the detail
- THEN the entry reads "unavailable", not "extracting"

#### Scenario: Manual data comes first in the order

- GIVEN an `aprobada` request whose document row is `fallida` and which has a manual issuer
- WHEN the secretary opens the detail
- THEN the entry shows the manual issuer and not "unavailable"

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
(any of the three motives, E18, FE-9) and the notification status, without a horizontal scroll at
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

Spec id FE-6. The staff detail of a `pendiente` request MUST offer, beside the
decision actions, an "Escalate to coordination" action with a required motive
("Sospecha sobre un documento", "Caso especial (fuera de las causas del
reglamento)" or "Otro", no default preselected, E18), a required note and a
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
(Previously: the motive list had two options, "Sospecha sobre un documento" and "Caso especial (fuera de las causas del reglamento)".)

#### Scenario: Escalate offered when pendiente

- GIVEN a `pendiente` request in scope
- WHEN the secretary opens its detail
- THEN the escalate action is offered beside approve, reject and return

#### Scenario: Three motives offered, none preselected (E18)

- GIVEN the escalate dialog of a `pendiente` request
- WHEN it is opened
- THEN the motives "Sospecha sobre un documento", "Caso especial (fuera de las causas del reglamento)" and "Otro" are offered and none is selected

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

### Requirement: Signals section and suggested verdict on the staff detail (RF-05 a, RF-05 d, RN-15, RNF-01)

Spec id MD-28. Slice S1 (RN-07, RN-09, RN-10, RN-14), S2 adds the RN-26 entry; the
manual-document-data change adds the entries RN-11, RN-12 and RN-13. In addition to
the content of "Staff detail with history", the staff detail of any presented
request (never a `borrador`) MUST show a "Señales de validación" / "Validation
signals" section, after the "Extracted data" section, with: the suggested
verdict in words and a sentence stating that it does not change the state of the
request; one entry per signal with its name and outcome (`present`, `absent`,
`not_evaluable` or, for RN-09 and RN-10 only, `not_applicable`) in words; and
the signals that are `not_evaluable` listed apart from the verdict, each with
its reason as text. A `not_applicable` entry MUST read "No aplica" (`es`), MUST
show no evidence, MUST carry a muted explanation line "La causa declarada
no incluye reposo." (`es`), and MUST NOT be listed apart with the
`not_evaluable` ones. The eight entries MUST keep the fixed order RN-07, RN-09,
RN-10, RN-11, RN-12, RN-13, RN-14, RN-26. The `es` names of the three new
entries MUST be «Firma ausente», «Sello ausente» and «Formato no corresponde a
la causa». A `present` entry of RN-11, RN-12 or RN-13 MAY identify the documents
that raise it by the same label the documents section already uses, and nothing
else; a `not_evaluable` entry with `not_registered` MUST state as text that the
secretary has not registered that datum of the document. The RN-26 entry, when
`present`, MUST show the number of
each matching earlier request inside the secretary's scope as a link to its
staff detail, and nothing else about it. The section MUST be visible only to the
roles that may open the staff detail, under the same scope rules, MUST NOT be
shown in the queue or in any tab, and MUST be shown in every state of the
request, including decided ones. The section MUST offer no action and MUST NOT
alter the decision controls.
(Previously: five entries RN-07, RN-09, RN-10, RN-14, RN-26.)

#### Scenario: Section content

- GIVEN a `pendiente` request with RN-07 `present`, RN-09 `absent`, RN-10 `not_evaluable` with `extraction_pending` and the other signals `absent`
- WHEN an in-scope secretary opens its detail
- THEN the section shows the verdict "review carefully", the eight outcomes in words, and RN-10 listed apart with its reason

#### Scenario: Not applicable entries

- GIVEN a `fuerza_mayor` request whose extraction has rest ending before the issue date, and RN-07, RN-11, RN-12, RN-13, RN-14, RN-26 `absent`
- WHEN an in-scope secretary opens its detail
- THEN RN-09 and RN-10 read "No aplica" with the muted line "La causa declarada no incluye reposo." and no evidence, "fechas incoherentes" is not shown, and the verdict reads "Sin alertas"
- AND neither entry appears among the signals listed apart as not evaluated

#### Scenario: Extracted data section unchanged for a non-rest cause

- GIVEN the same `fuerza_mayor` request
- WHEN the secretary opens its detail
- THEN the extracted-data section still shows the stored rest period exactly as before this change

#### Scenario: Decision controls untouched

- GIVEN a `pendiente` request with the verdict "review carefully"
- WHEN the secretary opens its detail
- THEN approve, reject, return and escalate are offered exactly as without the section

#### Scenario: Shown after the decision

- GIVEN an `aprobada` request
- WHEN the in-scope secretary opens its detail
- THEN the signals section is shown, computed from the current data

#### Scenario: Not in the queue or the tabs

- GIVEN requests with different verdicts
- WHEN the secretary opens each tab of `/review`
- THEN no row shows a signal, an outcome or a verdict

#### Scenario: Reference to an earlier request (S2)

- GIVEN RN-26 `present` with an in-scope earlier request number 41
- WHEN the secretary opens the detail
- THEN the entry shows "41" as a link to the staff detail of 41 and no student name or document name

#### Scenario: Match outside the scope shows no reference (S2)

- GIVEN RN-26 `present` against an earlier request of another facultad
- WHEN the secretary opens the detail
- THEN the entry reads `present` with no number and no link

#### Scenario: Not for other roles

- GIVEN a request with signals
- WHEN its owner opens `/requests/[id]`, or a `coordinacion` of another career, a `docente` or an `administrador` requests the staff detail
- THEN no signal data is shown or returned

#### Scenario: The three manual signals in their names and order

- GIVEN any presented request
- WHEN the secretary opens the detail in `es`
- THEN the entries after RN-10 read «Firma ausente», «Sello ausente» and «Formato no corresponde a la causa», in that order, before the recurrence entry

#### Scenario: Not registered is listed apart with its reason

- GIVEN a `medica` request with RN-07, RN-09, RN-10, RN-14 and RN-26 `absent` and a document whose firma, sello and type are not registered
- WHEN the secretary opens the detail
- THEN the verdict reads "No concluyente", and RN-11, RN-12 and RN-13 are listed apart, each stating as text that the datum is not registered

#### Scenario: RF-14 (d) the registered type is contrasted with the cause (hoja step d)

- GIVEN an `actividad_representativa` request and a secretary who registers type `constancia_medica` for its document
- WHEN the detail is shown after the save
- THEN the entry «Formato no corresponde a la causa» reads `present` and the verdict reads "Revisar con cuidado"

### Requirement: Signals are fail-soft and add no audit row (RF-05, RNF-06)

Slice S1. The signals read MUST be fail-soft: if it fails or throws, in whole or
for any signal, the staff detail MUST still load completely and the section MUST
show a degraded notice in place of the verdict and the entries, with no partial
or stale value and no verdict computed from a subset. Showing the section MUST
add no audit row beyond the existing `solicitud.consultada` and MUST NOT add an
audit event type.

#### Scenario: Read failure

- GIVEN the signals read throws
- WHEN the secretary opens the detail
- THEN the rest of the detail renders, the section shows the degraded notice, and no verdict is shown

#### Scenario: One signal's query fails

- GIVEN the RN-14 history query throws and the other signals succeed
- WHEN the secretary opens the detail
- THEN the degraded notice is shown and no partial verdict appears

#### Scenario: One audit row

- GIVEN a presented request with signals
- WHEN the secretary opens the detail once
- THEN exactly one `solicitud.consultada` row is written and no other

### Requirement: Signals UI i18n (RNF-12)

Slice S1 (RN-26 keys S2). All texts of the signals section (section title,
signal names, outcomes including `not_applicable`, verdict labels, the
display-only sentence, reason labels, the explanation line of a not applicable
signal, the degraded notice and the reference wording) MUST exist in both
`i18n/es.json` and `i18n/en.json` under `review.signals.*` with the same keys.
The `es` text MUST be in neutral professional Spanish with no voseo.

#### Scenario: Translation keys present

- GIVEN the review signals keys
- WHEN `es.json` and `en.json` are compared
- THEN both contain the same keys, including the `not_applicable` outcome and its explanation line

#### Scenario: Verdict wording

- GIVEN the verdict labels
- WHEN each locale is read
- THEN "review carefully", "no alerts" and "inconclusive" exist, with the `es` intents «Revisar con cuidado», «Sin alertas» and «No concluyente»

#### Scenario: Not applicable wording

- GIVEN the `not_applicable` label and its explanation line
- WHEN the `es` locale is read
- THEN they read "No aplica" and "La causa declarada no incluye reposo.", with no voseo, and `en` holds an English text for each

### Requirement: MD-23 Manual data form per document on the staff detail (RF-14 a, b, c, d)

Thesis: RF-14 «(a) La secretaría registra o corrige el nombre del estudiante, el
emisor, la fecha de emisión y el período de reposo… (b) La secretaría marca la
presencia de firma y de sello. (c) Sin datos extraídos por OCR, la solicitud se
resuelve con los datos registrados. (d) La secretaría registra el tipo de
documento presentado…» On the staff detail of a request in `pendiente`, an
in-scope secretary MUST be offered, in the "Datos leídos del documento" section, one manual
data form per current (non-retired) student document, with: the four data (name,
issuer, issue date, and the rest period as from and to dates, with no days
input: the days are derived), the document type (`Constancia médica`, `Constancia institucional`,
`Otro`, or not registered) and the firma and the sello (`Sí`, `No`,
`Sin registrar`). The form MUST be prefilled only with manual values, marks and
type already registered: an extracted value is shown beside the field as a
reference and MUST NOT be prefilled as if it were manual. The form MUST be
offered in every extraction state of the document (completed data, extracting,
unavailable) and also when extraction is not configured (RF-14 c). One save
MUST store the whole form of one document (see `manual-document-data`). A refusal
MUST show a readable error on each invalid field and keep what was typed. Saving
MUST NOT ask for a confirmation dialog, because it is reversible: a value can be
corrected or cleared. The form MUST NOT be offered when the request is not
`pendiente`, to students, to other roles, to out-of-scope secretaries, or in the
queue or any tab. When the extracted-data read is degraded the section MUST show
the degraded notice and no form.

#### Scenario: One form per current document

- GIVEN a `pendiente` request with two current student documents, one retired document and a staff-uploaded special format
- WHEN the in-scope secretary opens the detail
- THEN two forms are offered, one per current student document, and none for the other two

#### Scenario: RF-14 (c) form with extraction not configured (hoja step c)

- GIVEN extraction is not configured and a `pendiente` request with one current document
- WHEN the in-scope secretary opens the detail
- THEN the configuration message appears once at the top of the section and the document's form is offered

#### Scenario: Form in every extraction state (table-driven)

| Extraction of the document | Entry state text | Form |
|---|---|---|
| `completada` | the four data | offered |
| `pendiente` or `procesando`, or no row | extracting | offered |
| `fallida` | unavailable, review the document | offered |
| not configured | none (message once at the top) | offered |

- GIVEN a `pendiente` request with a document in the row
- WHEN the in-scope secretary opens the detail
- THEN the entry and the form are as shown

#### Scenario: Prefill only manual values

- GIVEN a document with extracted issuer "A" and no manual issuer
- WHEN the form is shown
- THEN "A" appears as the extracted reference and the issuer field is empty, so saving without typing leaves the issuer without a manual value

#### Scenario: Form not offered outside pendiente (table-driven)

| Request state or caller | Form |
|---|---|
| `aprobada`, `rechazada`, `devuelta`, `en_revision_coordinacion` | not offered, the values are shown read-only |
| the owner student, a `coordinacion`, a `docente`, an `administrador` | not offered, no manual data shown |

- GIVEN a request and the viewer in the row
- WHEN the viewer requests the staff detail, where the role may open it
- THEN the form is as shown

#### Scenario: Refusal keeps the input

- GIVEN a form with a valid issuer and a rest period whose from date is after its to date
- WHEN the secretary saves it
- THEN a readable error is shown on the rest period, the typed values are kept and nothing is stored

#### Scenario: Saved values are shown after the save

- GIVEN a valid form
- WHEN the secretary saves it
- THEN the detail of the same request shows the saved values, each datum as manual, and the signals computed from them

#### Scenario: Degraded read shows no form

- GIVEN the extracted-data read throws
- WHEN the secretary opens the detail
- THEN the section shows the degraded notice and no form, and the rest of the detail renders

### Requirement: MD-24 The save follows the review structure rule (SR-11)

The manual data action MUST end in a redirect to the same route, the staff
detail of the request (`/review/[id]`), so that the page is rendered once with
the new data. No module of the review directory MUST call `revalidatePath`,
`revalidateTag`, `updateTag`, `router.refresh` or `refresh()`, and the existing
structure test (`review/structure.test.ts`, SR-11 guard 4) MUST stay green with
the new files included in its scan. The detail MUST NOT be prefetched by the form
or by any link it adds (the existing prefetch guard keeps holding).

#### Scenario: No revalidation in the review directory

- GIVEN the review modules after this change, including the manual data action and form
- WHEN the structure test scans them
- THEN no `revalidatePath`, `revalidateTag`, `updateTag`, `router.refresh` or `refresh()` appears

#### Scenario: The action redirects to the same route

- GIVEN a successful save
- WHEN the action ends
- THEN it redirects to the staff detail of the same request, and a refused save returns its errors to the same form

#### Scenario: One open per render

- GIVEN a save followed by the redirect
- WHEN the audit log is read
- THEN the redirected render wrote one `solicitud.consultada` row and the save one `documento.datos_registrados` row

### Requirement: MD-25 Manual data UI i18n (RNF-12)

All texts of the manual data form and marks MUST exist in both `i18n/es.json` and
`i18n/en.json` with the same keys: field labels, the type names, the three mark
states, the "ingresado manualmente" mark, the extracted-reference caption, the
save action, every field error and the signal names and the `not_registered`
reason of RN-11, RN-12 and RN-13. The `es` text MUST be in neutral professional
Spanish with no voseo. The mark MUST read «Ingresado manualmente» in `es` and
"Entered manually" in `en`; the marks read `Sí`, `No`, `Sin registrar` in `es`
and "Yes", "No", "Not registered" in `en`; the types read «Constancia médica»,
«Constancia institucional», «Otro» in `es` and "Medical certificate",
"Institutional certificate", "Other" in `en`. State and mark MUST be conveyed as
text, never by color alone.

#### Scenario: Translation keys present

- GIVEN the manual data keys
- WHEN `es.json` and `en.json` are compared
- THEN both contain the same keys

#### Scenario: Wording

- GIVEN the mark, the three mark states and the three types
- WHEN each locale is read
- THEN they read as stated, with no voseo in `es`

### Requirement: FE-1 The queue states how it is ordered (RF-06 a; RN-08; RNF-10, RNF-12)

The description of the Pendientes tab MUST state that the requests are ordered
by the deadline of their remission to the teacher, soonest first. It MUST NOT
describe the order by presentation age (the earlier wording "de la más antigua a
la más reciente" is replaced), because a resubmitted request, or one that spent
time in coordination, is ordered by its effective deadline. The description MUST
exist in `es` and `en`. The order itself is the one of "Queue ordering and RN-08
alert" and does not change. The descriptions of the other two tabs do not
change.

#### Scenario: Description names the deadline (4.9 RF-06 a)

- GIVEN an in-scope secretary
- WHEN they open `/review` on Pendientes, in `es` and in `en`
- THEN the description says that requests are ordered by remission deadline, soonest first
- AND it contains no wording about the oldest or the newest presentation

#### Scenario: Other tabs keep their descriptions

- GIVEN the En coordinacion and Aprobadas tabs
- WHEN each is opened
- THEN its description is the one it had before this change

#### Scenario: Translation keys present

- GIVEN the Pendientes description keys
- WHEN `es.json` and `en.json` are compared
- THEN both contain the same keys

### Requirement: FE-2 The first request of the queue is marked "Vence primero" (RF-06 a, b; RN-08; RNF-10)

The Pendientes tab MUST mark the first request of the queue with the text mark
"Vence primero" (`en`: "Due first"), in the desktop table and in the cards shown
at 360 px. Exactly one request carries the mark, and none when the queue is
empty. The first request is the one the queue lists first: effective deadline
ascending, then request id ascending when deadlines are equal. The mark follows
the position in the whole queue of the caller's scope, not in a narrowed list:
when the search of the tab hides the first request, no visible row carries the
mark. The mark MUST be text, never color alone, and MUST be part of the row's
accessible name. It MUST be computed on read, MUST NOT change the order, the
alert or the overdue marks, and MUST add no audit row beyond the existing
`solicitud.cola.consultada`. Other tabs MUST NOT show it.

#### Scenario: Only the first row carries the mark (4.9 RF-06 a)

- GIVEN three `pendiente` requests with effective deadlines Wednesday, Thursday and Friday
- WHEN the secretary opens Pendientes
- THEN the Wednesday request is row 1 and carries "Vence primero", and the other two carry no mark

#### Scenario: Equal deadlines (4.9 RF-06 a, b)

- GIVEN two `vencida` requests with the same effective deadline, ids 4 and 7
- WHEN the secretary opens Pendientes
- THEN both show the overdue state, id 4 is row 1 and alone carries "Vence primero"

#### Scenario: The mark follows the effective deadline

- GIVEN request A presented Monday with 3 paused business days and request B presented Tuesday with none
- WHEN the queue is read
- THEN B is row 1 and carries the mark, and A does not

#### Scenario: Search hides the first request

- GIVEN the first request of the queue does not match the search term
- WHEN the secretary searches on Pendientes
- THEN no visible row carries "Vence primero"
- AND with a term that matches the first request, it carries the mark

#### Scenario: Empty queue and other tabs

- GIVEN no `pendiente` request in scope, and separately requests in En coordinacion and Aprobadas
- WHEN each tab is opened
- THEN no mark is shown on any of them

#### Scenario: Mark in both layouts

- GIVEN a queue with several requests
- WHEN it renders as a table at 1280 px and as cards at 360 px
- THEN row 1 carries the mark in both and the page has no horizontal scroll at either width

#### Scenario: Mark adds no audit row

- GIVEN a secretary opening Pendientes once
- WHEN the audit log is read
- THEN one `solicitud.cola.consultada` row exists and no other row

### Requirement: FE-3 Coordination answer banner at the top of the staff detail (RF-16 c, RF-10 a; RN-16, RN-20, RN-08; RNF-10)

When the staff detail shows a request in `pendiente` whose most recent
escalation record (an escalation motive, never a notice) has been answered, the
detail MUST show a banner above every other section of the detail, including the
escalations section and the decision panel. The banner MUST carry the text label
"Respuesta de coordinación" (`en`: "Coordination answer"), the answer text in
full (up to 1000 characters, never truncated), the name of the answering user
and the date and time of the answer in America/Managua. The banner MUST NOT be
shown in any other case: a `pendiente` request with no escalation, a request in
`en_revision_coordinacion` (its open escalation is shown instead), a request in
`aprobada`, `rechazada` or `devuelta`, or a notice. The banner MUST be text,
never color alone, MUST offer no action, and MUST be visible only to the roles
that may open the staff detail, under the same scope rules. It MUST NOT be shown
to students, in the queue or in any tab. It MUST add no audit row beyond the
existing `solicitud.consultada`. Its texts MUST exist in `es` and `en`.

#### Scenario: Banner shows the answer, its author and date (4.9 RF-16 c)

- GIVEN a request returned to `pendiente` by the answer "Verified with the teacher; the document is valid." of coordinator C at 2026-11-09 10:15 Managua
- WHEN the in-scope secretary opens its detail
- THEN a banner labelled "Respuesta de coordinación" shows that text, the name of C and that date and time

#### Scenario: Banner comes first (4.9 RF-16 c)

- GIVEN the same request
- WHEN the detail renders
- THEN the banner precedes the cause and dates section, the escalations section and the decision panel in document order

#### Scenario: Long answer in full (4.9 RF-16 a)

- GIVEN an answer of exactly 1000 characters
- WHEN the secretary opens the detail
- THEN the banner shows all 1000 characters

#### Scenario: When the banner appears (table-driven)

| Request state | Escalation records | Banner |
|---|---|---|
| `pendiente` | most recent answered | shown |
| `pendiente` | none | not shown |
| `en_revision_coordinacion` | most recent open | not shown |
| `aprobada`, `rechazada`, `devuelta` | an answered one | not shown |

- GIVEN a request in the row, opened by an in-scope secretary
- WHEN the detail renders
- THEN the banner is as shown

#### Scenario: Latest answer wins

- GIVEN a request with two answered escalations
- WHEN the secretary opens the detail
- THEN the banner quotes the answer of the later one

#### Scenario: Not for other viewers

- GIVEN a request with the banner condition
- WHEN its owner opens `/requests/[id]`, a secretary of another facultad requests the detail, or the queue is read
- THEN no answer text appears, the secretary of another facultad gets the nonexistent-id outcome, and the queue rows carry no answer

#### Scenario: Banner adds no audit row

- GIVEN a request with the banner condition
- WHEN the secretary opens the detail once
- THEN exactly one `solicitud.consultada` row is written and no other

### Requirement: FE-4 Decision panel copy follows the coordination answer (RF-16 c; RN-20; RNF-10)

When the banner condition of FE-3 holds, the description of the decision panel
MUST state that the coordination has already answered and that the decision is
now the secretary's to take. It MUST NOT tell the secretary to use "Escalar a
coordinación" as the way to obtain the coordination's opinion. In every other
case on a `pendiente` request the description MUST remain the existing copy. The
decision actions, their dialogs and their confirmations MUST NOT change. Both
texts MUST exist in `es` and `en`.

#### Scenario: Copy after an answer (4.9 RF-16 c)

- GIVEN a request returned to `pendiente` by a coordination answer
- WHEN the secretary opens the detail
- THEN the decision panel says the coordination already answered and the decision is the secretary's
- AND it does not tell the secretary to use "Escalar a coordinación" to ask for an opinion

#### Scenario: Copy without an answer

- GIVEN a `pendiente` request that was never escalated
- WHEN the secretary opens the detail
- THEN the decision panel carries the existing copy, which mentions "Escalar a coordinación"

#### Scenario: Decisions unchanged

- GIVEN a request with the banner condition
- WHEN the secretary opens the detail
- THEN approve, reject, return and escalate are offered exactly as without the banner, each with its confirmation

### Requirement: FE-5 The history points to the escalations (RF-16 c, RF-10 a; RN-16, RN-20)

The history of the staff detail (prior revisions and decisions) does not list
escalations, which have their own section. When the request has at least one
escalation record, the history MUST include a pointer that states that the
coordination escalations are listed in the escalations section, gives the number
of escalation records, and links to that section within the page. A request with
no escalation record MUST show no pointer. The pointer MUST NOT carry any note or
answer text, and MUST add no audit row and no audit event type. Its texts MUST
exist in `es` and `en`.

#### Scenario: Pointer with the count (4.9 RF-16 c)

- GIVEN a request with two escalation records (one answered, one answered)
- WHEN the secretary opens the detail
- THEN the history states that escalations are listed in the escalations section and gives the count 2

#### Scenario: The link reaches the section

- GIVEN the pointer
- WHEN the secretary activates its link
- THEN the page position moves to the escalations section of the same detail

#### Scenario: No escalation, no pointer

- GIVEN a request never escalated
- WHEN the secretary opens the detail
- THEN no pointer is shown

#### Scenario: Pointer holds no free text

- GIVEN an escalation with a note and an answer
- WHEN the pointer is rendered
- THEN neither the note nor the answer appears in it
