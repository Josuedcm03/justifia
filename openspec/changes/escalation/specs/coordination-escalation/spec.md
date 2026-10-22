# Coordination Escalation Specification

## Purpose

The academic secretary escalates a doubtful `pendiente` request to the career
coordination of the student, records a teacher's excess-absence report on an
`aprobada` request, and the coordination is notified by email and answers
inside the system. Covers RF-10, RF-15, RN-20; touches RF-07 (a, c), RN-08,
RN-15, RN-16, RN-25 (consent v2, in `justification-intake`), RNF-01, RNF-02,
RNF-06, RNF-07 (outbox pattern), RNF-12. Pilot scope is the Facultad de
Ingenieria y Arquitectura (D0); no catalog data changes. Documented deviation
(changelog 2026-10-22 in `docs/requirements.md`): RF-10 (a) applies only to a
`pendiente` request escalated for `sospecha_documento`; the RF-15 report on an
`aprobada` request notifies the coordination (RF-10 b) but the state stays
`aprobada`. Review UI of the secretary is in `request-review`; student view in
`student-requests`; audit actions in `audit-log`; document access in
`supporting-documents`; role matrix in `user-roles`; consent and notice in
`justification-intake` and `privacy-notice`.

Out of scope: search by CIF or name, status panel for non-pending detail,
coordinator reports and dashboards (roadmap #7), other faculties, withdrawing
an escalation, UAM legal review (owner task).

Terms: "escalation record" = one coordination notification record, with reason
`sospecha_documento` or `exceso_inasistencias`; "open escalation" = a
`sospecha_documento` record not yet answered; "notice" = an
`exceso_inasistencias` record (informational, never open, never answered);
"report" = an RF-15 absence report; "own career" = the coordinator's
`Usuario.CarreraId`; career of a request = `Usuario.CarreraId` of the
student (never the snapshot career name); "today" = current date in
America/Managua.

## Requirements

### Requirement: Escalate a pendiente request (RF-10 a, RN-20, RN-15, RN-16)

Only a `secretaria` in scope MUST be able to escalate, and only a request in
`pendiente`. Escalation MUST carry the reason `sospecha_documento` (fixed by
the server; any other value MUST be refused) and a note, trimmed, of 1 to 1000
characters, enforced by the server. It MUST require explicit confirmation in a
dialog; cancelling MUST change nothing. In ONE transaction it MUST: move the
request from `pendiente` to `en_revision_coordinacion` with a guarded update
that applies only if the state is still `pendiente`; create the open
escalation record (reason, note, author, time, state before) with its
notification in state `pendiente`; and write one `solicitud.escalada` audit
row. Escalation MUST NOT depend on the consent version of the request and MUST
NOT depend on mail availability. Escalation MUST be refused when the student's
current career has no active `coordinacion` account (E17): the refusal MUST be
an actionable error that names the career and asks to have the administrator
create the coordination account, the request MUST stay `pendiente`, and no
escalation, notification or audit row MUST be written. An active
`coordinacion` account of the career without an email MUST NOT refuse the
escalation (see "Zero recipients is a visible blocked state").

#### Scenario: Successful escalation

- GIVEN a `pendiente` request in scope and a note of 80 characters
- WHEN the secretary confirms the escalation
- THEN the state is `en_revision_coordinacion`, one open escalation exists with the note and the secretary as author
- AND its notification is `pendiente` and one `solicitud.escalada` row exists

#### Scenario: Note bounds (table-driven)

| Note | Result |
|---|---|
| empty or whitespace only | refused, error on note |
| 1000 characters | accepted |
| 1001 characters | refused, error on note |

- GIVEN an escalation call with the note in the row
- WHEN the server validates it
- THEN the outcome is as shown and a refusal leaves the request `pendiente` with no row

#### Scenario: Only from pendiente (table-driven)

| State | Result |
|---|---|
| `aprobada`, `rechazada`, `devuelta`, `borrador`, `en_revision_coordinacion` | refused, nothing changes |

- GIVEN a request in the state in the row
- WHEN an escalation call targets it
- THEN it is refused with no state, escalation or audit change

#### Scenario: Client bypass

- GIVEN a direct call with reason `exceso_inasistencias`, an empty note, or no confirmation flow
- WHEN the server processes it
- THEN it is refused and the request stays `pendiente`

#### Scenario: Concurrent escalations

- GIVEN two secretaries escalating the same `pendiente` request at once
- WHEN both complete
- THEN exactly one succeeds, one escalation and one audit row exist, and the other receives an "already escalated" outcome

#### Scenario: Denied callers

- GIVEN a student, a `coordinacion`, a `secretaria` of another facultad, a `secretaria` without `FacultadId`, an unauthenticated call, or an unknown id
- WHEN they call the escalation action
- THEN the outcome is the same denial as for a nonexistent id and nothing changes

#### Scenario: Legacy consent does not block

- GIVEN a `pendiente` request with consent version v1 or with no consent recorded
- WHEN the secretary escalates it
- THEN the escalation succeeds

#### Scenario: Failure rolls back

- GIVEN a failure after the state update, in the escalation insert or in the audit insert
- WHEN the transaction ends
- THEN the request is `pendiente` with no escalation, notification or audit row

#### Scenario: Career without a coordination account is refused (E17)

- GIVEN a `pendiente` request of a student of career "Ingeniería Civil", which has no active `coordinacion` account (none at all, or only inactive ones)
- WHEN the secretary confirms the escalation
- THEN it is refused with an error naming "Ingeniería Civil" and asking to have the administrator create the coordination account
- AND the request stays `pendiente` and no escalation, notification or audit row exists

#### Scenario: Coordination account without email does not refuse (E17)

- GIVEN a `pendiente` request of a student of career C, which has one active `coordinacion` account with no email
- WHEN the secretary confirms the escalation
- THEN the escalation succeeds and the request is `en_revision_coordinacion`

### Requirement: One open escalation per request (RF-10, RN-20)

A request MUST have at most one open escalation at a time. The database MUST
reject a second open escalation for the same request, independently of
application code. Notices are never open and MUST NOT count against this
rule. After an escalation is answered, the same request MAY be escalated again.

#### Scenario: Database rejects a second open escalation

- GIVEN a request with an open escalation
- WHEN a second open escalation row for it is inserted directly
- THEN the database rejects the statement

#### Scenario: Re-escalation after the answer

- GIVEN a request whose escalation was answered and which is `pendiente` again
- WHEN the secretary escalates it again
- THEN a new open escalation exists and the earlier one is kept, answered

#### Scenario: Notices do not block

- GIVEN a request with two notices
- WHEN a rule counting open escalations is evaluated
- THEN the count is zero

### Requirement: Coordination answer returns the request to pendiente (E1, E3, RF-10)

A `coordinacion` user whose own career equals the request's career MUST be
able to answer an open escalation of it, with a text, trimmed, of 1 to 1000
characters enforced by the server. In ONE transaction the answer MUST: close
the escalation (answer text, answering user, time) with a guarded update that
applies only while it is open; move the request from `en_revision_coordinacion`
to `pendiente`; and write one `solicitud.escalamiento_resuelto` audit row. The
answer MUST NOT approve, reject or return the request: the decision stays with
the secretary through the existing decision panel. The answer MUST NOT restart
the RN-08 clock (see `request-review`). An escalation can be answered once.

#### Scenario: Successful answer

- GIVEN an open escalation of a request of career C and a coordinator of career C
- WHEN they submit an answer text
- THEN the escalation is closed with the text, answerer and time, the request is `pendiente`, and one `solicitud.escalamiento_resuelto` row exists

#### Scenario: Answer bounds (table-driven)

| Text | Result |
|---|---|
| empty or whitespace only | refused, error on text |
| 1000 characters | accepted |
| 1001 characters | refused, error on text |

- GIVEN an answer call with the text in the row
- WHEN the server validates it
- THEN the outcome is as shown and a refusal leaves the request in `en_revision_coordinacion`

#### Scenario: Concurrent answers

- GIVEN two coordinators of the career answering the same escalation at once
- WHEN both complete
- THEN exactly one succeeds, one audit row exists, and the other receives an "already answered" outcome

#### Scenario: Answer on a non-open escalation

- GIVEN an already answered escalation, a notice, or a request in `pendiente`
- WHEN an answer call targets it
- THEN it is refused and nothing changes

#### Scenario: Secretary decides afterwards

- GIVEN a request returned to `pendiente` by an answer
- WHEN the in-scope secretary opens its detail
- THEN the decision actions are offered and the answer text is shown to them

#### Scenario: Denied callers

- GIVEN a coordinator of another career, a `coordinacion` without `CarreraId`, a `secretaria`, a student, or an unauthenticated call
- WHEN they call the answer action
- THEN the outcome equals that for a nonexistent id and nothing changes

#### Scenario: Failure rolls back

- GIVEN a failure after the state update or at the audit insert
- WHEN the transaction ends
- THEN the escalation is still open and the request is in `en_revision_coordinacion`

### Requirement: RF-15 absence report on an approved request (RF-15 a, b, RF-10 b, RN-20)

A `secretaria` in scope MUST be able to record an absence report on a request
in `aprobada` only. A report MUST carry: one teacher chosen from the teachers
that have a remission on that request (teacher id and name snapshot), the
date the teacher communicated it (a calendar date, not later than today), and
an optional note of at most 1000 characters. A teacher outside the request's
remissions MUST be refused. The system MUST NOT compute, ask for or store an
absence percentage. Recording a report MUST be ONE action that, in ONE
transaction, creates the append-only report, creates a notice with its
notification in state `pendiente`, and writes one `solicitud.reporte_inasistencias`
audit row. The request MUST stay `aprobada`; its remissions MUST NOT change.
Reports MUST NOT be updated or deleted by the application, and several
reports for one request MAY exist, each with its own notice. Recording MUST
require explicit confirmation in a dialog. A report MUST be recorded even when
the career has no recipient (no active `coordinacion` account, or none with an
email); its notification then becomes `bloqueada` with `sin_destinatarios`
(E17).

#### Scenario: Successful report

- GIVEN an `aprobada` request with remissions to teachers T1 and T2
- WHEN the secretary records a report for T1 with a date of today and a note
- THEN one report with T1 (id and name snapshot), the date and the author exists, and a notice with a `pendiente` notification exists
- AND the request is still `aprobada`, the remissions are unchanged, and one `solicitud.reporte_inasistencias` row exists

#### Scenario: Not from other states (table-driven)

| State | Result |
|---|---|
| `pendiente`, `devuelta`, `rechazada`, `borrador`, `en_revision_coordinacion` | refused, nothing created |

- GIVEN a request in the state in the row
- WHEN a report call targets it
- THEN it is refused with no report, notice or audit row

#### Scenario: Teacher outside the remissions

- GIVEN a teacher with no remission on the request
- WHEN a report names that teacher
- THEN it is refused with an error on teacher and nothing is stored

#### Scenario: Date bounds (table-driven)

| Date | Result |
|---|---|
| today | accepted |
| yesterday | accepted |
| tomorrow | refused, error on date |
| missing or not a calendar date | refused, error on date |

- GIVEN a report call with the date in the row
- WHEN the server validates it
- THEN the outcome is as shown

#### Scenario: No percentage

- GIVEN the report form and the stored report
- WHEN their fields are inspected
- THEN no percentage or absence count is asked for, computed or stored

#### Scenario: Append-only

- GIVEN a recorded report
- WHEN an application path attempts to update or delete it
- THEN none exists, and a second report for the same teacher creates a second row

#### Scenario: Denied callers

- GIVEN a student, a `coordinacion`, a `secretaria` of another facultad, or an unauthenticated call
- WHEN they call the report action
- THEN the outcome equals that for a nonexistent id and nothing changes

#### Scenario: Failure rolls back

- GIVEN a failure after the report insert or at the audit insert
- WHEN the transaction ends
- THEN no report, notice, notification or audit row exists

#### Scenario: Report recorded without recipients (E17, table-driven)

| Career of the student | Result |
|---|---|
| no active `coordinacion` account | report and notice recorded; notification `bloqueada` with `sin_destinatarios` |
| active `coordinacion` accounts, none with email | report and notice recorded; notification `bloqueada` with `sin_destinatarios` |

- GIVEN an `aprobada` request in scope and the career in the row
- WHEN the secretary records a report
- THEN the result is as shown, the request stays `aprobada`, and one `escalamiento.notificacion_bloqueada` row exists

### Requirement: Notification recipients (RF-10 b, E4)

The recipients of a coordination notification MUST be the users with role
`coordinacion`, active, whose `CarreraId` equals the student's current career
and who have an email. Recipients MUST be resolved when a send is attempted
(including a resend), not frozen at escalation time. A user of another career,
another role, inactive or without email MUST NOT receive it.

#### Scenario: Recipient set

- GIVEN career C with two active coordinators with email, one inactive coordinator, one coordinator without email and one active coordinator of career D
- WHEN a notification for a request of a student of career C is sent
- THEN exactly the two active coordinators with email of career C receive it

#### Scenario: Current career, not the snapshot

- GIVEN a student whose snapshot career names C but whose current `CarreraId` is D
- WHEN a notification is sent
- THEN recipients are resolved for D

#### Scenario: Account created later

- GIVEN a notification blocked for lack of recipients and a coordinator account with email later created for the career
- WHEN a resend is triggered
- THEN the new account is a recipient

### Requirement: Zero recipients is a visible blocked state (D0, E4)

When a send attempt resolves no recipient, the notification MUST become
`bloqueada` with reason `sin_destinatarios`, the escalation or notice MUST
stand, and the state of the notification MUST be visible to the in-scope
secretary with text, never color alone. This covers an escalation whose career
has active `coordinacion` accounts none of which has an email, a notice of a
career without recipients, and a career whose accounts were deactivated or lost
their email after the escalation (E17); an escalation of a career with no
active `coordinacion` account is refused instead (see "Escalate a pendiente
request"). A blocked notification MUST NOT hide the escalation from the
coordinator view: a coordinator of the career MUST still see and answer it. A
`bloqueada` notification MUST NOT be retried by the scheduled job; only a
manual resend re-evaluates it.

#### Scenario: Coordination account without email

- GIVEN a student of career C, which has active `coordinacion` accounts and none with an email
- WHEN the secretary escalates the request
- THEN the request is `en_revision_coordinacion`, the notification is `bloqueada` with `sin_destinatarios`, and one `escalamiento.notificacion_bloqueada` row exists
- AND a coordinator of C who logs in sees the escalation in the coordinator list and can answer it

#### Scenario: Recipients gone after the escalation

- GIVEN an open escalation whose `pendiente` notification has not been sent, and the only coordinator of the career is deactivated
- WHEN a send is attempted
- THEN the notification is `bloqueada` with `sin_destinatarios` and the escalation stays open

#### Scenario: Scheduled job skips it

- GIVEN a notification `bloqueada` with `sin_destinatarios`
- WHEN the scheduled job runs
- THEN no message is sent and the notification is unchanged

### Requirement: Notification outbox, send after commit, retry and resend (RNF-07 pattern)

Each escalation record MUST own exactly one notification with state
`pendiente`, `enviada` or `bloqueada`, and reason codes `sin_destinatarios`
and `error_envio`; `enviada` records the send time. Sending MUST happen after
the creating transaction commits. A send MUST be claimed so concurrent
attempts (post-commit, resend, scheduled job) send at most once. A failed send
MUST leave the notification `pendiente` with `error_envio`. A `pendiente`
notification MUST be retried by the existing `remission-retry` scheduled
route, bounded per run and by a maximum number of automatic attempts, in the
same run that drains teacher remissions; a failure in one outbox MUST NOT stop
the other. The notification is `enviada` only when every recipient's message
was accepted by the mail provider; recipients already served SHOULD NOT be
served again on retry. An unconfigured or unavailable mail service MUST leave
the notification `pendiente` and visible. An in-scope `secretaria` MUST be
able to resend a notification that is not `enviada`; other roles, out-of-scope
or unknown ids MUST yield the same denial, and resending an `enviada`
notification MUST send nothing.

#### Scenario: Success

- GIVEN a `pendiente` notification with recipients and a working mail service
- WHEN it is sent
- THEN it is `enviada` with a send time and one `escalamiento.notificacion_enviada` row exists

#### Scenario: Mail down at escalation

- GIVEN the mail service is unavailable or not configured
- WHEN the secretary escalates
- THEN the request is `en_revision_coordinacion` and the notification is `pendiente`

#### Scenario: Failed send

- GIVEN a provider error during a send
- WHEN the attempt ends
- THEN the notification is `pendiente` with `error_envio` and one `escalamiento.notificacion_fallida` row exists

#### Scenario: Concurrent attempts

- GIVEN two simultaneous send attempts on one notification
- WHEN both complete
- THEN exactly one message set is sent and the send time is set once

#### Scenario: Scheduled drain of both outboxes

- GIVEN a `pendiente` teacher remission and a `pendiente` notification, and the first send fails
- WHEN the scheduled route runs with the shared secret
- THEN the notification is still attempted

#### Scenario: Unauthenticated job

- GIVEN a call to the route without the shared secret
- WHEN processed
- THEN it is refused and nothing is sent

#### Scenario: Sent is never resent

- GIVEN an `enviada` notification
- WHEN the scheduled job runs or a secretary resends
- THEN no message is sent

#### Scenario: Resend after the fix

- GIVEN a notification `bloqueada` with `sin_destinatarios` and a coordinator account now existing
- WHEN the in-scope secretary resends
- THEN it is sent, becomes `enviada`, and one `escalamiento.notificacion_reenviada` row exists

#### Scenario: Resend out of scope

- GIVEN a secretary of facultad A and a notification of facultad B
- WHEN she resends it
- THEN the outcome equals that for a nonexistent id and nothing is sent

### Requirement: Notification content and privacy (E6, RNF-02)

The message MUST be in Spanish and MUST contain only: the request number, the
student's full name and CIF, the career, the reason label, the note of the
escalation or notice, and a link to the request in the system. It MUST NOT
contain attachments, the cause, dates, document names or content, health data,
or the coordination's answer. The link MUST lead to a page that requires a
session of an authorized coordinator; it MUST NOT carry any token that grants
access without login.

#### Scenario: Message fields

- GIVEN an escalation with a note
- WHEN the message is built
- THEN it holds exactly the fields above and no attachment

#### Scenario: Cause and documents absent

- GIVEN a request with a medical cause and two documents
- WHEN the message is built
- THEN no cause, date, document name or document content appears

#### Scenario: Link requires login

- GIVEN the link of a message
- WHEN an unauthenticated visitor opens it
- THEN they are sent to login and no request data is returned

### Requirement: Coordinator view limited to the own career (E1, E10, RNF-01)

A user with role `coordinacion` and a `CarreraId` MUST be able to open a list
of: requests with an open escalation whose career is their own (action
required, oldest first), and notices of requests of their own career
(informational, newest first, no action). A `coordinacion` without `CarreraId`
MUST be denied everything (fail closed). The detail of a request with an open
escalation MUST show the student's full name, CIF and career, the cause, dates,
subjects with group and teacher, the current non-retired documents, the reason
label, the secretary's note and the time of escalation, plus the answer form;
it MUST NOT show the student's email, the consent state or the decision
history. The detail of a notice MUST show the student's full name, CIF and
career, the teacher's name, the communicated date and the note, with no
documents, cause or dates and no answer form. A request of another career,
without an open escalation or notice, a `borrador`, or an unknown id MUST
yield the same denial with no data. Policy MUST live in
`src/lib/auth/permissions.ts`; every route and action MUST re-check
authentication, role and career server-side.

#### Scenario: Own career only

- GIVEN open escalations for careers C and D and a coordinator of C
- WHEN they open the list
- THEN only the escalations of C appear

#### Scenario: Notices are informational

- GIVEN a notice for a request of career C
- WHEN the coordinator of C opens it
- THEN the teacher, communicated date and note are shown, with no documents and no answer form

#### Scenario: Open escalation detail

- GIVEN an open escalation of career C
- WHEN the coordinator of C opens the detail
- THEN the fields above are shown and the student's email, consent and decisions are not

#### Scenario: Another career is a nonexistent id

- GIVEN a coordinator of career C and an open escalation of career D
- WHEN they open its detail or call its answer action
- THEN the outcome equals that for a nonexistent id and no data is returned

#### Scenario: Answered escalation leaves the list

- GIVEN an escalation answered by the coordinator
- WHEN they reopen the list
- THEN it is absent and its detail is not reachable

#### Scenario: Coordinator without career

- GIVEN a `coordinacion` whose `CarreraId` is null
- WHEN they open the list or any detail
- THEN access is denied and no rows are returned

### Requirement: Confidentiality of the note and the answer (E13, RNF-01, RNF-02)

The secretary's note, the report note and the coordination's answer MUST be
visible only to the in-scope `secretaria` and to the `coordinacion` of the
request's own career. They MUST NOT be visible to the student, to other roles,
to the teachers, in the queue tabs, or in any audit payload.

#### Scenario: Student never sees them

- GIVEN a request with an open escalation and an earlier answered one
- WHEN its owner opens the list and the detail
- THEN no note or answer text appears (see `student-requests`)

#### Scenario: Not in audit

- GIVEN an escalation with a note containing a diagnosis and an answer
- WHEN every audit payload of the operation is serialized and searched
- THEN no part of the note or the answer is found

### Requirement: Coordination UI i18n and accessibility (RNF-12)

All user-facing text of the escalation, report, notification-status and
coordinator screens MUST exist in both `i18n/es.json` and `i18n/en.json` with
the same keys. State, reason and delivery status MUST carry text, never color
alone.

#### Scenario: Translation keys present

- GIVEN the escalation message keys
- WHEN `es.json` and `en.json` are compared
- THEN both contain the same keys

#### Scenario: Status carries text

- GIVEN a notification `bloqueada` with `sin_destinatarios`
- WHEN the staff detail renders
- THEN a text label states that no active coordination account with email exists for the career

#### Scenario: Refusal message names the career (E17)

- GIVEN an escalation refused because career "Ingeniería Civil" has no active `coordinacion` account
- WHEN the refusal is shown in each locale
- THEN the text names "Ingeniería Civil" and asks to have the administrator create the account; the `es` text is in neutral professional Spanish with no voseo (intent: «Ingeniería Civil no tiene coordinación registrada; solicite al administrador que cree la cuenta.»)
