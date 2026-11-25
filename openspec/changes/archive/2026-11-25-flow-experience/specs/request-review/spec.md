# Delta for Request Review

Change: `flow-experience` (roadmap row 13). Tabla 19 rows covered here: RF-06
(5.8:14, 4.9 case RF-06, Anexo F RF-06 (a, b)) and RF-16 (5.8:15, 4.9 case
RF-16, Anexo F RF-16-c). The order of the queue and every existing decision
rule stay as they are; this delta only changes what the secretary is told and
shown. RF-10 motive wording is covered by FE-6 and by `coordination-escalation`.

## ADDED Requirements

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

## MODIFIED Requirements

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
