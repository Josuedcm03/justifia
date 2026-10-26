# Delta for Justification Intake

Covers RF-04, RN-21, RN-22, RNF-11. The enrollment the intake reads is now the
one the student declares at `/enrollment` (see `student-enrollment`).

## MODIFIED Requirements

### Requirement: Subject eligibility and group display (RF-04, RN-21, RN-22, D5, D15)

Selectable subjects MUST come from the student's enrollment in the internal
catalog (RN-21) through the `GroupScheduleProvider` port, given the student and
the start and end dates. Only active subjects and groups MUST be offered
(RF-12 b). Selecting a subject MUST show its group and teacher from the
enrollment with no manual search (RF-04 b). A group without a teacher MUST be
shown with a "no teacher assigned" label and MUST NOT block submit (D15). A request MUST accept several
subjects (RF-01 c), each at most once. Server-side submit MUST re-check
eligibility of every selected subject through the port.

Schedule filtering (RN-22, F.4): the `GroupScheduleProvider` adapter reads
`Grupo."Dias"` (weekday bitmask, Monday = bit 0). A group MUST count as having
class when any date in the inclusive range `[start, end]` (America/Managua
calendar dates) falls on one of its set days. A group whose days are not
recorded (mask `0`) MUST count as having class, so a subject is never hidden for
lack of data. Hours, period dates and holidays do not exist in the catalog and
are out of scope for RN-22.

Empty state of step 2: when the step has valid dates and the read did not
degrade but lists no subject, it MUST say why. If the student has no effective
enrollment at all (judged without the date range), the message MUST say that
the student has no enrollment yet and MUST link to `/enrollment`. If the
student has effective enrollments but none has class in the dates, the message
MUST say there is no class in these dates, MUST NOT tell the student to enroll,
and MUST offer the way back to the dates step. The two messages MUST differ.
(Previously: one generic message covered both cases and linked nowhere.)

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

#### Scenario: Subject of an inactive asignatura not offered

- GIVEN an active inscripcion in an active grupo whose asignatura is inactive
- WHEN step 2 lists subjects
- THEN that subject is not offered

#### Scenario: Subject outside enrollment

- GIVEN a subject the student is not enrolled in
- WHEN a submit includes it
- THEN submit is blocked with an error on subjects

#### Scenario: Subject with no class in the date range is not offered (RN-22, RF-04 a)

- GIVEN an enrolled group that meets only on days that no date between the start and end dates falls on
- WHEN step 2 lists subjects
- THEN that subject is not offered

#### Scenario: Subject with class in the date range is offered

- GIVEN an enrolled group that meets on a weekday contained in the date range, including its first or last date
- WHEN step 2 lists subjects
- THEN that subject is offered

#### Scenario: Group with days not recorded is offered

- GIVEN an enrolled group whose meeting days are not recorded (mask `0`)
- WHEN subjects are listed for any valid dates
- THEN its subject is offered

#### Scenario: Subject that loses its class after a date change is rejected at submit

- GIVEN a draft whose selected subject has class in the original dates
- WHEN the dates are changed to a range with no class for its group and the student submits
- THEN submit is blocked with an error on subjects (server re-check through the port)

#### Scenario: Group without teacher

- GIVEN an active group with no teacher assigned
- WHEN the subject is selected
- THEN the group is shown with a "no teacher assigned" label and submit is not blocked (D15)

#### Scenario: No enrollment at all

- GIVEN a student with no effective enrollment and valid dates
- WHEN step 2 renders
- THEN the empty state says the student has no enrollment yet and links to `/enrollment`

#### Scenario: Enrolled but no class in these dates

- GIVEN a student with an effective enrollment whose group has no class in the dates
- WHEN step 2 renders
- THEN the empty state says there is no class in these dates, offers the dates step, and has no link to `/enrollment`

#### Scenario: The two empty states differ

- GIVEN the two situations above
- WHEN the rendered texts are compared
- THEN they are different messages

#### Scenario: Degraded read is not an empty state

- GIVEN a failing enrollment read
- WHEN step 2 renders
- THEN the degraded notice is shown and neither empty message is

## ADDED Requirements

### Requirement: Entry nudge when the student has no enrollment (RF-04, RN-21, RNF-11)

When a student opens the new-request flow (`/requests/new`) and has no
effective enrollment, the page MUST show a notice that subjects come from their
enrollment, with a link to `/enrollment`. The notice MUST NOT block the flow:
the student can still reach every step and the draft is still created or
resumed. When the student has an effective enrollment, or the enrollment read
degrades, the notice MUST NOT appear. The notice MUST be usable at 360 px and
exist in `es` and `en`.

#### Scenario: Notice for a student without enrollment

- GIVEN a student with no effective enrollment
- WHEN they open `/requests/new`
- THEN the notice with the link to `/enrollment` is shown and step 1 is usable

#### Scenario: No notice with enrollment

- GIVEN a student with an effective enrollment
- WHEN they open `/requests/new`
- THEN no enrollment notice is shown

#### Scenario: No notice when the read degrades

- GIVEN a failing enrollment read
- WHEN the student opens `/requests/new`
- THEN the enrollment notice is not shown and the flow stays usable
