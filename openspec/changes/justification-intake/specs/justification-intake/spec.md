# Justification Intake Specification

## Purpose

A student files an absence justification request (RF-01..RF-04). Work happens
in a server-side draft completed through a four-step stepper and submitted as a
`pendiente` request. Covers RF-01, RF-02, RF-03, RF-04, RN-01..RN-06,
RN-21..RN-23, RNF-01, RNF-06, RNF-11, RNF-12. Decisions D1-D15 are in
`preproposal.yaml` (rev 6). Document storage rules live in
`supporting-documents`; audit events in the `audit-log` delta.

Terms: "draft" = request in state `borrador`; "today" = current date in
America/Managua; "submission date" = Managua calendar date of the server
timestamp at submit.

## Requirements

### Requirement: Intake authorization (RNF-01)

Only an authenticated user with role `estudiante` MUST be able to create,
read, edit, discard, or submit a draft, and only their own. Every server
action and route MUST re-check authentication, role, and draft ownership;
page guards MUST NOT be relied on. A denied request MUST return no data about
the draft. Role policy MUST live in `src/lib/auth/permissions.ts`.

#### Scenario: Non-student role denied

- GIVEN an authenticated user with role `secretaria`
- WHEN they call any intake action or open the intake page directly by URL
- THEN access is denied and no draft data is returned

#### Scenario: Another student's draft

- GIVEN student A owns draft X
- WHEN student B calls an action with X's id
- THEN the action is denied with the same outcome as for a nonexistent id

#### Scenario: Unauthenticated call

- GIVEN no session
- WHEN an intake action is called
- THEN it is denied and nothing is read or written

### Requirement: One open draft per student, resume (D8, RF-01)

A student MUST have at most one draft at a time. Opening the intake flow MUST
resume the existing non-expired draft with its saved data and last step;
otherwise it MUST create an empty draft. The one-draft rule MUST hold under
concurrent creation (the later attempt resumes the existing draft, never a
second one). Student identity on a draft MUST come from the session, never
from request input (RF-01 a).

#### Scenario: First visit creates a draft

- GIVEN a student with no draft
- WHEN they open the intake flow
- THEN exactly one empty draft owned by them exists

#### Scenario: Resume

- GIVEN a student with a draft holding cause and dates
- WHEN they open the intake flow again, even from another device
- THEN the same draft opens with those values

#### Scenario: Concurrent creation

- GIVEN a student with no draft
- WHEN two creations run at the same time
- THEN exactly one draft exists and both calls return it

### Requirement: Draft persistence and expiry (D8)

Each step MUST save its data to the draft on the server. A draft inactive for
30 days (no edit, document change, or step save) MUST be treated as expired:
it MUST NOT be resumable or submittable, even before cleanup runs, and the
student MUST then be able to start a new draft. A daily cleanup sweep MUST
delete expired drafts together with their subjects and documents (see
`supporting-documents`). Draft creation, step saves, and expiry MUST write no
audit row (D14); auditing of the request starts at submission. Explicit
document actions are audited per `audit-log` (D14 exception).

#### Scenario: Activity extends life

- GIVEN a draft last saved 29 days ago
- WHEN the student saves a step
- THEN the inactivity clock restarts

#### Scenario: Expired draft not resumable

- GIVEN a draft inactive for 31 days that the sweep has not yet deleted
- WHEN the student opens the intake flow or submits it
- THEN the draft is not resumed or submitted and a new empty draft is created

#### Scenario: Sweep deletes expired drafts only

- GIVEN one draft inactive 31 days and one inactive 5 days
- WHEN the sweep runs
- THEN only the first is deleted and no audit row is written (D14)

### Requirement: Cleanup sweep execution (D8, D10)

The sweep MUST be callable only by the platform scheduler; a call without the
scheduler credential MUST be rejected with no effect. It MUST be idempotent,
MUST continue past a single failing item, and MUST report counts. It MUST NOT
touch requests in any state other than `borrador`.

#### Scenario: Unauthorized sweep call

- GIVEN a request without the scheduler credential
- WHEN it calls the sweep endpoint
- THEN it is rejected and nothing is deleted

#### Scenario: One failure does not stop the sweep

- GIVEN three expired drafts and a blob deletion failing for the second
- WHEN the sweep runs
- THEN the other two are deleted and the failure is reported

#### Scenario: Pending requests untouched

- GIVEN a `pendiente` request older than 30 days
- WHEN the sweep runs
- THEN it still exists

### Requirement: Discard a draft with confirmation (RNF-12, D8, D14)

The student MUST be able to discard their draft. Discard MUST require explicit
confirmation in a dialog before execution; cancelling MUST change nothing.
Discard MUST permanently delete the draft, its subjects, and its documents
(including stored files) and MUST write no audit row (D14). After discard the
student MAY start a new draft.

#### Scenario: Confirm discard

- GIVEN a draft with two documents
- WHEN the student discards it and confirms
- THEN the draft, its subject rows, and both stored files are removed
- AND no audit row is written

#### Scenario: Cancel discard

- GIVEN the confirmation dialog is open
- WHEN the student cancels
- THEN the draft and documents are unchanged

#### Scenario: Discard a submitted request refused

- GIVEN a request in `pendiente`
- WHEN a discard action targets it
- THEN it is refused and the request is unchanged

### Requirement: Four-step stepper (RF-01, RF-02, RF-04)

The flow MUST present four steps in order: (1) cause and dates, (2) affected
subjects, (3) supporting documents, (4) read-only review with submit. The
student MUST be able to move back to any earlier step without losing data.
Step 2 MUST require valid dates from step 1 to list subjects. Step 4 MUST show
cause, dates, each subject with its group and teacher, and the documents, all
non-editable, with per-field errors (see "Submit blocking").

#### Scenario: Navigation keeps data

- GIVEN data entered in steps 1-3
- WHEN the student goes back to step 1 and forward again
- THEN all values remain

#### Scenario: Review is read-only

- GIVEN the student is on step 4
- WHEN the page renders
- THEN no field is editable and each step offers a link to edit it

#### Scenario: Edit from review returns to review

- GIVEN the student opened a step from an edit link of the review (step 4)
- WHEN the student saves that step with Continue
- THEN the student returns to the review without passing through the steps in
  between, and a step opened by normal forward navigation still advances to
  the next step

#### Scenario: Subjects need dates

- GIVEN a draft without valid dates
- WHEN the student opens step 2
- THEN no subject can be selected and a message asks for dates first

### Requirement: Cause and dates rules (RN-01, RN-05, RN-23, RF-01 b)

The cause MUST be one of exactly five: maternity/paternity/breastfeeding;
cultural or sports activities representing UAM; academic exchange; medical;
other force majeure. Start and end dates are calendar dates. The end date MUST
be on or after the start date (RN-05). The end date MUST NOT be earlier than
30 calendar days before the submission date (RN-23); exactly 30 days before is
allowed. Future dates are allowed, there is no maximum duration, and a late
submission is not rejected (D6; RN-07 signal belongs to another change).

#### Scenario: Cause outside the list

- GIVEN a submit call with a cause not among the five
- WHEN the server validates it
- THEN submit is blocked with an error on the cause field

#### Scenario: End before start

- GIVEN start 2026-10-10 and end 2026-10-09
- WHEN the student submits
- THEN submit is blocked with an error on the end date

#### Scenario: Window boundary (table-driven)

| Submission date | End date | Result |
|---|---|---|
| 2026-10-31 | 2026-10-01 | accepted (exactly 30 days) |
| 2026-10-31 | 2026-09-30 | blocked, error on end date |
| 2026-10-06 | 2026-10-20 | accepted (future allowed) |

- GIVEN the submission date and end date in the row, start on or before end
- WHEN the student submits
- THEN the outcome is as shown

#### Scenario: Window evaluated in Managua time

- GIVEN a submit at 2026-11-01 02:00 UTC (2026-10-31 20:00 in Managua)
- WHEN the server computes the submission date
- THEN it is 2026-10-31

### Requirement: Submit blocking, per field (RF-03, RN-01..RN-05, RN-23)

Submit MUST be re-validated on the server regardless of client checks. When
any field is invalid the request MUST NOT be submitted and the response MUST
list every invalid field, each with a message stating the expected correction
(RF-03 e). Fields checked: cause (RN-01), start and end dates required and
ordered (RN-05, RF-03 a, b), end-date window (RN-23, RF-03 d), at least one
subject (D15), group where required (RF-04 c), and at least one
finalized supporting document (RN-03, RF-03 c). A blocked submit MUST leave
the draft in `borrador`, unchanged, with no audit row.

#### Scenario: Required field empty

- GIVEN a draft with no cause
- WHEN the student submits
- THEN nothing is submitted and the cause field shows an error with the fix

#### Scenario: No document

- GIVEN a valid draft with zero finalized documents
- WHEN the student submits
- THEN it is blocked with an error on documents

#### Scenario: No subject

- GIVEN a draft with valid cause, dates, and documents but no subject
- WHEN the student submits
- THEN it is blocked with an error on subjects (D15)

#### Scenario: All errors reported together

- GIVEN a draft with no cause, end before start, and no documents
- WHEN the student submits
- THEN the response lists all three fields at once

#### Scenario: Client bypass

- GIVEN a direct action call with invalid data
- WHEN the server processes it
- THEN it is blocked with the same field errors

### Requirement: Subject eligibility and group display (RF-04, RN-21, RN-22, D5, D15)

Selectable subjects MUST come from the student's enrollment in the internal
catalog (RN-21) through the `GroupScheduleProvider` port, given the student and
the start and end dates. Only active subjects and groups MUST be offered
(RF-12 b). Selecting a subject MUST show its group and teacher from the
enrollment with no manual search (RF-04 b). A group without a teacher MUST be
shown with a "no teacher assigned" label and MUST NOT block submit (D15). A request MUST accept several
subjects (RF-01 c), each at most once. Server-side submit MUST re-check
eligibility of every selected subject through the port.

Temporary behavior (D5): until `catalog-schedule` exists, the adapter MUST treat
every active group in which the student is enrolled as having class on every
date, so dates do not filter subjects. **Real schedule filtering is DEFERRED**
(see Deferred scenarios).

#### Scenario: Group and teacher shown

- GIVEN the student is enrolled in one active group of subject S
- WHEN they select S
- THEN the group and its teacher are shown without further input

#### Scenario: Several subjects

- GIVEN the student selects subjects S1 and S2
- WHEN they submit validly
- THEN the request holds both

#### Scenario: Inactive subject or group not offered

- GIVEN an enrolled subject whose only group is inactive
- WHEN step 2 lists subjects
- THEN that subject is not offered

#### Scenario: Subject outside enrollment

- GIVEN a subject the student is not enrolled in
- WHEN a submit includes it
- THEN submit is blocked with an error on subjects

#### Scenario: Permissive adapter ignores dates

- GIVEN the temporary adapter and any valid dates
- WHEN subjects are listed
- THEN every active enrolled group's subject is offered

#### Scenario: Group without teacher

- GIVEN an active group with no teacher assigned
- WHEN the subject is selected
- THEN the group is shown with a "no teacher assigned" label and submit is not blocked (D15)

### Requirement: Group choice when enrollment is ambiguous (RF-04 c)

If the enrollment does not determine exactly one group for a selected subject,
the system MUST require the student to choose one among the active groups of
that subject; the choice MUST be saved on the draft. Submit without the choice
MUST be blocked with an error on that subject. A chosen group MUST belong to
the subject and be active; otherwise submit is blocked.

#### Scenario: Ambiguous enrollment

- GIVEN enrollment yields two active groups for subject S
- WHEN the student selects S
- THEN a group selector lists active groups of S and none is preselected

#### Scenario: Missing choice blocks submit

- GIVEN S is ambiguous and no group is chosen
- WHEN the student submits
- THEN submit is blocked with an error on S asking to choose a group

#### Scenario: Group of another subject

- GIVEN a submit naming a group that does not belong to S
- WHEN the server validates it
- THEN submit is blocked

### Requirement: Submission transition and timestamps (RN-06, RF-01 a, D7)

A valid submit MUST, in one transaction, move the request from `borrador` to
`pendiente` and assign the presentation date and time on the server in
America/Managua; the client MUST NOT supply or edit it (RN-06). The draft's
subjects (with chosen groups) and finalized documents MUST become the
request's. The request MUST be associated with the authenticated student. Only
`borrador` to `pendiente` is performed by this change; a submitted request MUST
NOT be editable or re-submittable by it. A second submit of the same request
MUST fail without changing it.

#### Scenario: Successful submit

- GIVEN a valid draft
- WHEN the student submits
- THEN the request is `pendiente` with a server timestamp and the student as owner

#### Scenario: Client timestamp ignored

- GIVEN a submit payload carrying a presentation timestamp
- WHEN the request is stored
- THEN the stored timestamp is the server's

#### Scenario: Double submit

- GIVEN two concurrent submits of one draft
- WHEN both complete
- THEN exactly one succeeds and the request is submitted once

#### Scenario: Failure rolls back

- GIVEN a failure during the submit transaction
- WHEN it ends
- THEN the request is still `borrador` and no submit audit row exists

### Requirement: Student snapshot at submit (RN-02, D9)

At submit the system MUST copy the student's full name, CIF, career, and email
from their account onto the request. Later changes to the account MUST NOT
alter the stored snapshot. No snapshot value MUST be accepted from the client.

#### Scenario: Snapshot stored

- GIVEN a student with name, CIF, career, and email
- WHEN they submit
- THEN the request stores those four values

#### Scenario: Account change afterwards

- GIVEN a submitted request
- WHEN the student's email is changed
- THEN the request still shows the original email

#### Scenario: Forged snapshot

- GIVEN a payload with a different name and CIF
- WHEN the request is submitted
- THEN the stored values come from the account

### Requirement: Drafts excluded from listings (D7)

A draft MUST NOT appear in any listing, count, detail view, or query meant for
requests, other than the owner's own resume of it. A single domain helper
defining visible states MUST be used by such queries, and a test MUST fail if a
`borrador` request would be returned by them.

#### Scenario: Draft hidden from lists

- GIVEN a student with a draft and a `pendiente` request
- WHEN request listings are built
- THEN only the `pendiente` request appears

#### Scenario: Draft not readable by id elsewhere

- GIVEN a draft id
- WHEN a request-detail view for other roles is requested
- THEN it is not found

### Requirement: Intake usability at 360 px and i18n (RNF-11, RNF-12)

Every intake screen (stepper, each step, review, confirmation dialog, errors)
MUST be usable in full at 360 px width with no horizontal scrolling. All
user-facing text MUST exist in both `i18n/es.json` and `i18n/en.json`.

#### Scenario: No horizontal scroll

- GIVEN a 360 px viewport
- WHEN each step and the confirmation dialog are rendered
- THEN the document width does not exceed the viewport

#### Scenario: Actions reachable

- GIVEN a 360 px viewport
- WHEN the student uses step navigation, document upload, submit, and discard
- THEN each control is visible and operable

#### Scenario: Translation keys present

- GIVEN the intake message keys
- WHEN `es.json` and `en.json` are compared
- THEN both contain the same keys

## Deferred scenarios (until `catalog-schedule`, D5, RN-22)

Not testable now; MUST be added when the real adapter is delivered:

- Subject with no class between start and end dates is not offered (RN-22, RF-04 a).
- Changing dates removes or flags selected subjects that lose their class.
- A subject whose group has class only outside the date range is rejected at submit.
- The port contract is reconciled with the schedule model.

## Decisions applied

- D12: at most 5 supporting documents per request (see `supporting-documents`).
- D13: every supporting-document download writes one `documento.descargado` audit row (see `audit-log` delta).
- D14: draft create, autosave, discard, expiry, and orphan sweep write no audit row; auditing of the request starts at submission. Explicit student document actions (attach, remove, rejected upload) are audited from the first file; cascaded document deletions are not.
- D15: at least one subject is required to submit; a group without a teacher shows "no teacher assigned" and does not block submit; only the owning student downloads their documents in this change, other roles in later changes.
- Only `estudiante` uses intake; other roles' access to submitted requests belongs to later changes.
