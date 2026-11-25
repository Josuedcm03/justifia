# Coordination Escalation Specification

## Purpose

The academic secretary escalates a doubtful `pendiente` request to the career
coordination of the student, records a teacher's excess-absence report on an
`aprobada` request, and the coordination is notified by email and answers
inside the system. Covers RF-10, RF-15, RF-16 (the coordination answer), RN-20; touches RF-07 (a, c), RN-08,
RN-15, RN-16, RN-25 (consent v2, in `justification-intake`), RNF-01, RNF-02,
RNF-06, RNF-07 (outbox pattern), RNF-12. Pilot scope is the Facultad de
Ingenieria y Arquitectura (D0); no catalog data changes. Documented deviation
(changelog 2026-10-22 in `docs/requirements.md`): RF-10 (a) applies only to a
`pendiente` request escalated for `sospecha_documento`, `caso_especial` (E18) or
`otro` (FE-9);
the RF-15 report on an `aprobada` request notifies the coordination (RF-10 b)
but the state stays `aprobada`. Review UI of the secretary is in `request-review`; student view in
`student-requests`; audit actions in `audit-log`; document access in
`supporting-documents`; role matrix in `user-roles`; consent and notice in
`justification-intake` and `privacy-notice`.

Out of scope: search by CIF or name, status panel for non-pending detail,
coordinator reports and dashboards (roadmap #7), other faculties, withdrawing
an escalation, UAM legal review (owner task).

Terms: "escalation record" = one coordination notification record, with reason
`sospecha_documento`, `caso_especial`, `otro` or `exceso_inasistencias`;
"escalation motive" = `sospecha_documento` (suspicion about a document),
`caso_especial` (a case outside the causes of the regulation, for instance a
death in the family or migration paperwork, that the career coordination values)
or `otro` (a reason that fits neither of the other two, described by its note;
FE-9); "open escalation" = a record with an escalation motive not yet answered; "notice" =
an `exceso_inasistencias` record (informational, never open, never answered);
"report" = an RF-15 absence report; "own career" = the coordinator's
`Usuario.CarreraId`; career of a request = `Usuario.CarreraId` of the
student (never the snapshot career name); "today" = current date in
America/Managua.

## Requirements

### Requirement: Escalate a pendiente request (RF-10 a, RN-20, RN-15, RN-16, E18)

Spec id FE-7. Only a `secretaria` in scope MUST be able to escalate, and only a request in
`pendiente`. Escalation MUST carry one escalation motive chosen by the
secretary in the dialog, `sospecha_documento`, `caso_especial` or `otro` (E18);
the server MUST validate it against that closed set and MUST refuse any other
value, including `exceso_inasistencias`, and a missing one. The motive MUST be
required with no default preselected. All three motives MUST behave identically:
the same state change, the same RN-08 pause, the same notice to the
coordination with the same recipients and the same E17 rule, the same answer
and the same return to `pendiente`. A `caso_especial` is a case outside the
causes of the regulation (for instance the death of a close relative or
migration paperwork) that the career coordination values with the teacher. An
`otro` escalation is one whose reason fits neither of the other two motives; its
note is the description of the reason. Escalation MUST also carry a note,
trimmed, of 1 to 1000 characters, enforced by the server, whatever the motive.
It MUST require explicit confirmation in a
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
(Previously: the closed motive set had two members, `sospecha_documento` and `caso_especial`.)

#### Scenario: Successful escalation

- GIVEN a `pendiente` request in scope and a note of 80 characters
- WHEN the secretary confirms the escalation
- THEN the state is `en_revision_coordinacion`, one open escalation exists with the note and the secretary as author
- AND its notification is `pendiente` and one `solicitud.escalada` row exists

#### Scenario: Escalation for a special case (E18)

- GIVEN a `pendiente` request in scope and a note about the death of a close relative
- WHEN the secretary confirms the escalation with the motive `caso_especial`
- THEN the state is `en_revision_coordinacion`, one open escalation with the motive `caso_especial`, the note and the secretary as author exists
- AND its notification is `pendiente` and one `solicitud.escalada` row carries the motive `caso_especial`

#### Scenario: Escalation for another reason (4.9 RF-10 a, b)

- GIVEN a `pendiente` request in scope and a note describing a reason outside the other two motives
- WHEN the secretary confirms the escalation with the motive `otro`
- THEN the state is `en_revision_coordinacion`, one open escalation with the motive `otro`, the note and the secretary as author exists
- AND its notification is `pendiente` and one `solicitud.escalada` row carries the motive `otro`

#### Scenario: Motive is required and closed (table-driven, E18)

| Motive | Result |
|---|---|
| `sospecha_documento` | accepted |
| `caso_especial` | accepted |
| `otro` | accepted |
| missing, empty or not a string | refused, error on motive |
| `exceso_inasistencias` or any other value | refused, error on motive |

- GIVEN an escalation call with the motive in the row and a valid note
- WHEN the server validates it
- THEN the outcome is as shown and a refusal leaves the request `pendiente` with no row

#### Scenario: Note is mandatory for every motive (table-driven, 4.9 RF-10 a, b)

| Motive | Note | Result |
|---|---|---|
| `otro` | empty or whitespace only | refused, error on note |
| `otro` | 1 to 1000 characters | accepted |
| `sospecha_documento` or `caso_especial` | empty or whitespace only | refused, error on note |

- GIVEN an escalation call with the motive and note in the row
- WHEN the server validates it
- THEN the outcome is as shown and a refusal leaves the request `pendiente` with no row and no audit row

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

- GIVEN a direct call with reason `exceso_inasistencias` or no reason, an empty note, or no confirmation flow
- WHEN the server processes it
- THEN it is refused and the request stays `pendiente`

#### Scenario: Concurrent escalations

- GIVEN two secretaries escalating the same `pendiente` request at once
- WHEN both complete
- THEN exactly one succeeds, one escalation and one audit row exist, and the other receives an "already escalated" outcome

#### Scenario: Denied callers

- GIVEN a signed-in student, `coordinacion`, `docente` or `administrador`, or an unauthenticated call
- WHEN they call the escalation action
- THEN a signed-in caller of another role gets the denied screen, an anonymous caller goes to login (as in `user-roles` and `permission-denied-screen`), and nothing changes

#### Scenario: Out-of-scope callers and unknown ids

- GIVEN a `secretaria` of another facultad, a `secretaria` without `FacultadId`, or an unknown id
- WHEN they call the escalation action
- THEN the outcome is the nonexistent-id outcome and nothing changes

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

Spec id FE-8. A request MUST have at most one open escalation at a time, whatever its
motive (`sospecha_documento`, `caso_especial` or `otro`, E18). The database MUST
reject a second open escalation for the same request, of any motive,
independently of application code. Notices are never open and MUST NOT count
against this rule. After an escalation is answered, the same request MAY be
escalated again, with any motive; the secretary is shown a soft notice with the
earlier answer (FE-12) and is not prevented.
(Previously: two motives, and no notice of the earlier answer.)

#### Scenario: Database rejects a second open escalation

- GIVEN a request with an open escalation
- WHEN a second open escalation row for it is inserted directly
- THEN the database rejects the statement

#### Scenario: A second open escalation of any motive is refused (E18, table-driven)

| Open escalation | Second one | Result |
|---|---|---|
| `sospecha_documento` | `sospecha_documento` | refused |
| `sospecha_documento` | `caso_especial` | refused |
| `sospecha_documento` | `otro` | refused |
| `caso_especial` | `sospecha_documento` | refused |
| `caso_especial` | `caso_especial` | refused |
| `caso_especial` | `otro` | refused |
| `otro` | `sospecha_documento` | refused |
| `otro` | `caso_especial` | refused |
| `otro` | `otro` | refused |

- GIVEN a request with the open escalation in the row
- WHEN a second open escalation with the motive in the row is created, by the application or directly in the database
- THEN it is refused and only the first one exists

#### Scenario: Re-escalation with the other motive

- GIVEN a request whose `sospecha_documento` escalation was answered and which is `pendiente` again
- WHEN the secretary escalates it with the motive `caso_especial` or `otro`
- THEN a new open escalation with that motive exists and the earlier one is kept, answered

#### Scenario: Re-escalation after the answer

- GIVEN a request whose escalation was answered and which is `pendiente` again
- WHEN the secretary escalates it again
- THEN a new open escalation exists and the earlier one is kept, answered

#### Scenario: Notices do not block

- GIVEN a request with two notices
- WHEN a rule counting open escalations is evaluated
- THEN the count is zero

### Requirement: Coordination answer returns the request to pendiente (E1, E3, RF-10, RF-16)

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

- GIVEN a signed-in `secretaria`, student, `docente` or `administrador`, or an unauthenticated call
- WHEN they call the answer action
- THEN a signed-in caller of another role gets the denied screen, an anonymous caller goes to login (as in `user-roles` and `permission-denied-screen`), and nothing changes

#### Scenario: Out-of-career callers and unknown ids

- GIVEN a coordinator of another career, a `coordinacion` without `CarreraId`, or an unknown escalation id
- WHEN they call the answer action
- THEN the outcome is the nonexistent-id outcome, a denial returns no data, and nothing changes

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

- GIVEN a signed-in student, `coordinacion`, `docente` or `administrador`, or an unauthenticated call
- WHEN they call the report action
- THEN a signed-in caller of another role gets the denied screen, an anonymous caller goes to login (as in `user-roles` and `permission-denied-screen`), and nothing changes

#### Scenario: Out-of-scope callers and unknown ids

- GIVEN a `secretaria` of another facultad, a `secretaria` without `FacultadId`, or an unknown request id
- WHEN they call the report action
- THEN the outcome is the nonexistent-id outcome and nothing changes

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

Spec id FE-13. When a send attempt resolves no recipient, the notification MUST become
`bloqueada` with reason `sin_destinatarios`, the escalation or notice MUST stand, and the state of the
notification MUST be visible to the in-scope
secretary with text, never color alone. This covers an escalation whose career
has active `coordinacion` accounts none of which has an email, a notice of a
career without recipients, and a career whose accounts were deactivated or lost
their email after the escalation (E17); an escalation of a career with no
active `coordinacion` account is refused instead (see "Escalate a pendiente
request"). A blocked notification MUST NOT hide the escalation from the
coordinator view: a coordinator of the career MUST still see and answer it. A
`bloqueada` notification MUST NOT be retried by the scheduled job; only a
manual resend re-evaluates it. A `coordinacion` account without an email, and so
without a CIF, cannot sign in once sign-in is by CIF or email
(`auth-entry-access` FE-21), and no `Login` fallback exists (FE-25, owner
decision 2026-11-20), so such an account sees and answers nothing until it has
an email; the blocked state is then resolved by giving the account an email and
resending.
(Previously: the coordinator of an email-less account was assumed able to log in and answer.)

#### Scenario: Coordination account without email

- GIVEN a student of career C, which has active `coordinacion` accounts and none with an email
- WHEN the secretary escalates the request
- THEN the request is `en_revision_coordinacion`, the notification is `bloqueada` with `sin_destinatarios`, and one `escalamiento.notificacion_bloqueada` row exists
- AND a coordinator of C who has an email and signs in sees the escalation in the coordinator list and can answer it
- AND an account with no email and no CIF cannot sign in, by any value, because no `Login` fallback exists (`auth-entry-access` FE-21, FE-25)

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
served again on retry. An unavailable mail service MUST leave the notification
`pendiente` and visible, as a failed send. A mail service that is not
configured (no base URL or no sender key) means nothing was attempted: it MUST
leave the notification `pendiente`, MUST NOT count an automatic attempt, MUST
NOT write `escalamiento.notificacion_fallida` and MUST NOT show "last attempt
failed". A notification whose escalation was already answered by the
coordinator MUST NOT be sent by the scheduled job or by a resend, because its
link leads to a record the coordination view no longer shows; a notification
sent before the answer stays `enviada`. An in-scope `secretaria` MUST be
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

#### Scenario: Mail not configured is not a failed attempt

- GIVEN a `pendiente` notification with recipients and a mail service without its base URL or sender key
- WHEN the scheduled job runs, or a secretary resends
- THEN nothing is sent, the notification is `pendiente` with the attempts it had and no failure reason it did not already have
- AND no `escalamiento.notificacion_fallida` row and no `escalamiento.notificacion_reenviada` row is written
- AND once the mail service is configured the next run sends it

#### Scenario: Answered before it was sent

- GIVEN an escalation notification (any of the three motives) still `pendiente` (or retrying) and an escalation the coordinator then answers
- WHEN the scheduled job runs, or a secretary resends
- THEN no message is sent and the notification is unchanged
- AND the staff detail shows that it will not be sent and offers no resend

#### Scenario: Resend whose claim is lost

- GIVEN a `pendiente` notification whose send is held by another attempt
- WHEN a secretary resends
- THEN nothing is sent, the secretary is told a send is in progress, and no `escalamiento.notificacion_reenviada` row exists

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

#### Scenario: Resend after the fix finds the mail unconfigured

- GIVEN a notification `bloqueada` with `sin_destinatarios` and a coordinator account with an email now existing, and a mail service that is not configured
- WHEN the in-scope secretary resends
- THEN the recipients are found, so the notification moves from `bloqueada` to `pendiente` with no reason, and nothing is sent
- AND the attempt is not counted, no `escalamiento.notificacion_fallida` and no `escalamiento.notificacion_reenviada` row is written, and once the mail service is configured the next run sends it

#### Scenario: Resend out of scope

- GIVEN a secretary of facultad A and a notification of facultad B
- WHEN she resends it
- THEN the outcome equals that for a nonexistent id and nothing is sent

### Requirement: Notification content and privacy (E6, RNF-02)

The message MUST be in Spanish and MUST contain only: the request number, the
student's full name and CIF, the career, the reason label, the note of the
escalation or notice, and a link to the request in the system. The reason
label of a `caso_especial` escalation MUST be "Caso especial" and the notice
of both escalation motives MUST follow the same recipients, subject pattern
and rules (E18). It MUST NOT
contain attachments of documents, the cause, dates, document names or content,
health data, or the coordination's answer. The link MUST lead to a page that
requires a session of an authorized coordinator; it MUST NOT carry any token
that grants access without login. The message MUST be multipart: a plain-text
part with exactly the fields above, and an HTML part that carries the same
fields and the same link under the identity of the Universidad Americana (UAM)
and its Facultad de Ingeniería y Arquitectura (FIA). The HTML part MUST escape
every value that comes from data, MUST NOT load a script, a remote resource or
a tracking pixel, and MUST show the brand image as an inline embedded image of
the message; that image is a brand asset, not a supporting document, so the
rule of no document attachments still holds (E6, E18).

#### Scenario: Message fields

- GIVEN an escalation with a note
- WHEN the message is built
- THEN it holds exactly the fields above and no document attachment

#### Scenario: Special-case notice (E18)

- GIVEN a `caso_especial` escalation with a note, in a career with two coordinators with email
- WHEN the notice is built and sent
- THEN both coordinators receive it, its reason label is "Caso especial", and its subject reads "Justifia: solicitud N escalada a coordinación"

#### Scenario: HTML part carries the same data, escaped

- GIVEN an escalation whose student name and note contain `<script>` and `&`
- WHEN the message is built
- THEN the HTML part shows each field, escaped, with no active markup from the data
- AND the plain-text part holds the same fields unescaped

#### Scenario: Link is the same in both parts

- GIVEN a built message
- WHEN the text and the HTML parts are read
- THEN the button of the HTML part and the plain link below it equal the link of the text part

#### Scenario: Inline brand image

- GIVEN a built message
- WHEN its HTML part and attachments are read
- THEN the HTML references the brand image by a content id, the message attaches that image inline under the same content id, and no supporting document is attached

#### Scenario: Excess-absence notice uses the same template

- GIVEN an `exceso_inasistencias` notice
- WHEN the message is built
- THEN the HTML part has the title "Aviso de exceso de inasistencias" and no wording that asks the coordination to answer

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

#### Scenario: Special case in the list and its answer (E18)

- GIVEN an open `caso_especial` escalation of career C and a coordinator of C
- WHEN they open the list, the detail, and submit an answer
- THEN the list and the detail show it with the reason label "Caso especial", the answer closes it and the request is `pendiente`, exactly as for `sospecha_documento`

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

### Requirement: FE-9 Motive `otro` behaves as the other escalation motives (RF-10 a, b; RF-16; RN-20, RN-08, RN-16; RNF-01, RNF-02, RNF-12)

The escalation motive `otro` (`es` label "Otro", `en` label "Other") MUST be an
escalation motive in every respect: the same state change, the same RN-08
pause, the same notice to the coordination with the same recipients and the same
E17 rule, the same answer, the same return to `pendiente`, the same
one-open-escalation rule. Its note is the description of the reason and is
mandatory, as for the other motives. The reason label "Otro" MUST be shown where
the label of an escalation motive is shown: the notification message, the
escalations section of the staff detail, the En coordinacion tab, and the
coordinator list and detail. The subject of the notification message and its
recipients MUST NOT change. The motive MUST NOT be shown to the student in any
form, so an `otro` escalation looks identical to the owner as the other two
(E13). The motive `exceso_inasistencias` MUST remain a notice only and MUST NOT
become selectable. The database MUST accept an `otro` escalation record with a
non-empty note, MUST reject one without a note, and MUST include `otro` in its
one-open-escalation rule, independently of application code. Escalation records
created before this change MUST keep their motive and note unchanged, and the
two original motives MUST keep working after the database change.

#### Scenario: Escalation for another reason (4.9 RF-10 a, b)

- GIVEN a `pendiente` request in scope and a note describing a reason outside the other two motives
- WHEN the secretary confirms the escalation with the motive `otro`
- THEN the state is `en_revision_coordinacion` and one open escalation with the motive `otro`, the note and the secretary as author exists
- AND its notification is `pendiente` and one `solicitud.escalada` row carries the motive `otro`

#### Scenario: Same behavior for the three motives (table-driven)

| Motive | State after | RN-08 pause on answer | Notice recipients | Answer returns to `pendiente` |
|---|---|---|---|---|
| `sospecha_documento` | `en_revision_coordinacion` | counted | active coordinators with email of the career | yes |
| `caso_especial` | `en_revision_coordinacion` | counted | active coordinators with email of the career | yes |
| `otro` | `en_revision_coordinacion` | counted | active coordinators with email of the career | yes |

- GIVEN a `pendiente` request escalated with the motive in the row, answered later
- WHEN each step completes
- THEN the outcome is as shown for every motive

#### Scenario: Label "Otro" where the motive is shown (table-driven)

| Surface | Label shown for `otro` |
|---|---|
| notification message to coordination | Otro (subject "Justifia: solicitud N escalada a coordinación") |
| escalations section of the staff detail | Otro |
| En coordinacion tab | Otro |
| coordinator list and detail | Otro |

- GIVEN an open `otro` escalation of career C with two coordinators with email
- WHEN each surface is rendered in `es`
- THEN the label is as shown, and both coordinators receive the message

#### Scenario: The student sees no motive (E13)

- GIVEN a request in `en_revision_coordinacion` escalated with `otro`, and another escalated with `sospecha_documento`
- WHEN the owner of each opens the list and the detail
- THEN both show the same state and the same neutral label, and neither the motive, the note nor the answer appears

#### Scenario: Database constrains the record (table-driven)

| Direct insert | Database |
|---|---|
| `otro` with a non-empty note | accepts |
| `otro` with no note or an empty one | rejects |
| second open `otro` for a request that has an open escalation of any motive | rejects |

- GIVEN a direct insert of the escalation record in the row
- WHEN the database processes it
- THEN the outcome is as shown

#### Scenario: Earlier records unchanged

- GIVEN escalation records with the motives `sospecha_documento` and `caso_especial` recorded before this change
- WHEN the change is applied
- THEN their motive, note, answer and state are unchanged
- AND a new escalation with either original motive still succeeds

### Requirement: FE-10 The escalate dialog marks the note as required (RF-10 a, b; RN-20; RNF-10, RNF-12)

The escalate dialog MUST label the note field as required, with the text "Nota
para coordinación (obligatoria)" (`en`: "Note for coordination (required)"), and
MUST show a hint with an example of a useful note and the statement that only
staff see it. The label and the hint MUST be visible before the secretary
confirms, with no error shown. When the chosen motive is `otro`, the hint MUST
state that the note is the description of the reason. The server rules for the
note (1 to 1000 characters, trimmed) do not change. All texts MUST exist in
`es` and `en`.

#### Scenario: The note is announced as required (4.9 RF-10 a, b)

- GIVEN the escalate dialog just opened
- WHEN it renders
- THEN the note field is labelled "Nota para coordinación (obligatoria)" and the hint with the example is shown, with no error message

#### Scenario: Hint for `otro`

- GIVEN the escalate dialog
- WHEN the secretary chooses the motive "Otro"
- THEN the hint states that the note is the description of the reason

#### Scenario: Empty note is still refused

- GIVEN the dialog with the motive "Otro" and an empty note
- WHEN the secretary confirms
- THEN no escalation is made and the error on the note is shown (4.9 RF-10 a, b)

#### Scenario: Translation keys present

- GIVEN the dialog label and hint keys
- WHEN `es.json` and `en.json` are compared
- THEN both contain the same keys

### Requirement: FE-11 Dialog messages do not outlive the input they describe (RF-10 a, b; RNF-10, RNF-12)

In the escalate dialog, a field message MUST describe the current state of its
field. The motive error MUST disappear as soon as a motive is chosen; the note
error MUST disappear as soon as the note is edited. Messages for other fields,
and the form-level messages (a conflict, an unexpected failure, the refusal that
names a career without a coordination account), MUST stay until the next
confirmation or until the dialog is reopened. Reopening the dialog MUST start
with no message. The server remains the authority: confirming a form that is
still invalid MUST return the error again.

#### Scenario: Motive error clears after choosing (4.9 RF-10 a, b)

- GIVEN the dialog shows "Seleccione el motivo del escalamiento." after a confirmation with no motive
- WHEN the secretary chooses a motive
- THEN the motive error is no longer shown

#### Scenario: Note error clears on edit

- GIVEN the dialog shows the note error after a confirmation with an empty note
- WHEN the secretary types in the note
- THEN the note error is no longer shown

#### Scenario: A still-invalid form fails again

- GIVEN a motive error that cleared after choosing a motive, and a note that is still empty
- WHEN the secretary confirms
- THEN the note error is shown and nothing is escalated

#### Scenario: Reopening starts clean

- GIVEN a dialog closed with an error showing
- WHEN it is opened again
- THEN no field message is shown

### Requirement: FE-12 The escalate dialog shows the earlier answer; a second escalation stays allowed (RF-16 c, RF-10 a; RN-20, RN-16, RN-08; RNF-10)

When the banner condition of `request-review` FE-3 holds (a `pendiente` request
whose most recent escalation record was answered), the escalate dialog MUST show,
above the motive field, a soft notice that the coordination already answered,
with the answer text, the answering user and the date and time of the answer
(America/Managua). The notice is informational: it MUST NOT use error styling,
MUST NOT disable the confirm action and MUST NOT add a confirmation step.
Escalating again stays allowed (owner decision 2026-11-20): confirming creates a
new open escalation exactly as in "Re-escalation after the answer". The notice
MUST be absent when no answered escalation exists, MUST be visible only to the
in-scope secretary, and MUST add no audit row and no audit event type. Its texts
MUST exist in `es` and `en`.

#### Scenario: Notice shows the answer (4.9 RF-16 c)

- GIVEN a request returned to `pendiente` by an answer of coordinator C
- WHEN the secretary opens the escalate dialog
- THEN a soft notice shows the answer text, the name of C and the answer date and time

#### Scenario: Second escalation proceeds

- GIVEN the same dialog with the notice shown
- WHEN the secretary chooses a motive, writes a note and confirms once
- THEN a new open escalation exists, the earlier one is kept answered, and exactly one more `solicitud.escalada` row exists

#### Scenario: No notice without an earlier answer

- GIVEN a `pendiente` request never escalated
- WHEN the secretary opens the escalate dialog
- THEN no earlier-answer notice is shown

#### Scenario: Notice is not an error

- GIVEN the dialog with the notice shown
- WHEN it renders
- THEN the notice carries an informational status role, the confirm action is enabled and no field error is shown

#### Scenario: Translation keys present

- GIVEN the notice keys
- WHEN `es.json` and `en.json` are compared
- THEN both contain the same keys
