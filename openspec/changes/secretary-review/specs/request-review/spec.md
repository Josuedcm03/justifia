# Request Review Specification

## Purpose

The academic secretary reviews presented requests of their own facultad: a
queue ordered by the remission deadline, a staff detail, and one decision per
request (approve, reject, return for correction). Covers RF-06, RF-07, RN-08,
RN-15, RN-16, RN-17, RNF-01, RNF-02, RNF-06, RNF-12. Correction by the student
lives in `student-requests` (RF-08). Remission to the teacher (RF-09) and
signals (RF-05) are out of scope. Document access for staff is in
`supporting-documents`; audit events in `audit-log`.

Terms: "queue" = requests in `pendiente` visible to the caller; "clock start" =
`COALESCE(ReenviadaEn, PresentadaEn)`; "today" = current date in
America/Managua; "business day" = Monday to Friday that is not in the
non-working-days calendar; "scope" = the caller's `Usuario.FacultadId`.
Facultad of a request = `Carrera.FacultadId` of the student's current
`Usuario.CarreraId` (never the snapshot career name).

## ADDED Requirements

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

The queue MUST list only `pendiente` requests in scope, ordered by clock start
ascending (oldest first). Presentation and clock start use Managua dates. The
remission deadline MUST be the second business day strictly after the clock
start date (so a weekend or holiday presentation counts from the next business
day: presented Saturday, Monday is day 1 and Tuesday is the deadline); the
request is due at the end of that day. A request MUST be flagged "alert" when at most one business day remains
to the deadline and flagged "overdue" when today is after the deadline. Alert
state MUST be computed on read, not stored. Business-day logic MUST be a pure
function using a `NonWorkingDaysProvider` port.

#### Scenario: Ordering

- GIVEN pendiente requests with clock starts Tue, Mon and a resubmitted one with `ReenviadaEn` Wed
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

- GIVEN no holidays and the row values
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

#### Scenario: Decided requests leave the queue

- GIVEN a request that was approved, rejected or returned
- WHEN the queue is read
- THEN it is absent

### Requirement: Staff detail with history (RF-06, RF-08 b, RN-16)

A secretary in scope MUST be able to open a request detail showing: cause,
dates, the student snapshot (name, CIF, career, email), subjects with group and
teacher, current documents, state, alert state, the prior revisions
(snapshots written by each return), the decision history (state, template or
reason code, final text, author and time), and the documents retired by prior
revisions, marked as retired. Class data (group, teacher) MUST be read only
through the `solicitud-clases` seam. The detail of a request in `devuelta` or
decided state MUST be viewable by an in-scope secretary but offers no decision
action.

#### Scenario: Detail of a corrected request

- GIVEN a request returned once and corrected with one document replaced
- WHEN the secretary opens it
- THEN they see the current revision, the first revision snapshot, the earlier return decision with its text, and the replaced document marked retired

#### Scenario: Decision actions only when pendiente

- GIVEN a request in `aprobada`
- WHEN the secretary opens its detail
- THEN no approve, reject or return control is offered

### Requirement: State transitions (RN-15, RN-16, RN-17)

Only a `secretaria` in scope MUST change a request state (RN-15). Allowed
transitions by this change: `pendiente` to `aprobada`, `rechazada` or
`devuelta`. `en_revision_coordinacion` MUST NOT be reachable and MUST NOT be
offered. A transition MUST be a single guarded update that applies only if the
state is still `pendiente`, written in the same transaction as its decision row
and audit row. A decision on a request in any other state MUST fail without
change.

#### Scenario: Concurrent decisions

- GIVEN two secretaries of the facultad deciding the same `pendiente` request at the same time
- WHEN both complete
- THEN exactly one succeeds, one decision row and one audit row exist, and the other receives a "already decided" outcome

#### Scenario: Decide an already decided request

- GIVEN a request in `rechazada`
- WHEN a decision action targets it
- THEN it fails and state, decisions and audit are unchanged

#### Scenario: Coordination state unreachable

- GIVEN any decision input
- WHEN it is processed
- THEN no path leaves a request in `en_revision_coordinacion`

#### Scenario: Failure rolls back

- GIVEN a failure after the state update or in the audit insert
- WHEN the transaction ends
- THEN the request is still `pendiente` with no decision or audit row

### Requirement: Approve (RF-07 a, RN-15)

Approving MUST set `aprobada` and record a decision with optional text. The
secretary MAY pick a predefined approval template and edit it before
confirming; the final text (possibly empty) MUST be stored in the decision.

#### Scenario: Approve without text

- GIVEN a `pendiente` request in scope
- WHEN the secretary approves with empty text
- THEN the state is `aprobada` and the decision stores no text

#### Scenario: Approve with edited template

- GIVEN the approval template prefilled for the request
- WHEN the secretary edits it and confirms
- THEN the stored text is the edited text and the template code is recorded

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
