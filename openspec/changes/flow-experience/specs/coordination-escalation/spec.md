# Delta for Coordination Escalation

Change: `flow-experience` (roadmap row 13). Tabla 19 row RF-10 (5.8:16, 4.9
case RF-10, Anexo F RF-10-a to RF-10-c) and the RF-16 part of row RF-16
(5.8:15, 4.9 case RF-16). Owner decisions of 2026-11-20 applied here: motive
`otro` is added and `caso_especial` is kept; a second escalation after an
answer stays allowed, with a soft notice.

Notes for archive and thesis sync:

- The Purpose and Terms of this capability define the escalation motive as
  `sospecha_documento` or `caso_especial`; they gain `otro` ("a reason that
  fits neither of the other two, described by its note"). Phrases such as
  "either motive" and "both motives" elsewhere in the main specs read as "any
  of the three motives" (FE-9 governs).
- `docs/requirements.md` RN-20 is reworded to list the three motives and the
  excess-absence report. The thesis drift (4.2:89, 5.4:19) goes to the thesis
  sync list, not to this change.

## ADDED Requirements

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

## MODIFIED Requirements

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
