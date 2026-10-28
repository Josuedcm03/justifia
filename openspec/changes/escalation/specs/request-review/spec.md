# Delta for Request Review

Covers RF-06, RF-07 (a), RF-10, RF-15, RN-08, RN-15, RN-16, RNF-01, RNF-06,
RNF-12. Escalation, answer, report and notification rules live in
`coordination-escalation`. In this delta "queue" = the Pendientes tab: requests
in `pendiente` visible to the caller. Deadline pause: time a request spends in
coordination does not count toward the RN-08 deadline.

## ADDED Requirements

### Requirement: Review state tabs (RF-06, RF-10, RF-15, E14)

`/review` MUST offer three tabs for the in-scope secretary: Pendientes
(`pendiente`), En coordinacion (`en_revision_coordinacion`) and Aprobadas
(`aprobada`). Pendientes MUST be the default. Each tab MUST list only requests
in scope (facultad of the student's current career) in that state, never a
`borrador`, and each row MUST link to the staff detail. En coordinacion MUST be
ordered by escalation time ascending (oldest first) and show the reason label
and the notification status; Aprobadas MUST be ordered by approval time
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
actions, an "Escalate to coordination" action with a required note and a
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

## MODIFIED Requirements

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
(Previously: ordered by clock start and no pause while in coordination; "queue" listed only pendiente.)

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
(Previously: only `devuelta` and decided states were viewable without a decision action.)

#### Scenario: Detail of a corrected request

- GIVEN a request returned once and corrected with one document replaced
- WHEN the secretary opens it
- THEN they see the current revision, the first revision snapshot, the earlier return decision with its text, and the replaced document marked retired

#### Scenario: Decision actions only when pendiente

- GIVEN a request in `aprobada` or `en_revision_coordinacion`
- WHEN the secretary opens its detail
- THEN no approve, reject or return control is offered

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
(Previously: `en_revision_coordinacion` was unreachable and not offered.)

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
