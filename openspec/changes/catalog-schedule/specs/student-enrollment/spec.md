# Delta for Student Enrollment

> The Purpose paragraph of the main spec lists "staff view or editing of
> enrollments" as out of scope (D9). This change supersedes that sentence; the
> archive step SHOULD update it. Requirement text below is otherwise additive.

## ADDED Requirements

### Requirement: Student writes only their own; the secretaría writes under RF-12 (a) (RF-17 a, RF-12 a, RN-21) [S2, S3]

RF-17 (a) is read as a rule among students (D8, owner decision of 2026-11-19):
no student MUST be able to declare, modify or drop another student's
inscription, and `/enrollment` and its actions MUST stay student-only. This
reading does not exclude the secretaría, who maintains inscripciones under
RF-12 (a) through `enrollment-administration`. No requirement text of
`docs/requirements.md` changes. Student and staff writes MUST share one writer
module, one per-student lock and the one-active-group rule; the last committed
write wins; a staff deactivation is not sticky and the student MAY enroll again
in the same offered group. A staff change MUST be visible at once in the
student's `/enrollment` and in the groups the student may name on a request
(RF-04).

#### Scenario: Student cannot touch another student's row

- GIVEN a signed-in student and the inscripcion of another student
- WHEN they call enroll or drop with that student's id
- THEN the call acts on the session student only and the other row is unchanged

#### Scenario: Staff change shows to the student

- GIVEN the secretaría changed a student's group from A1 to A2
- WHEN the student opens `/enrollment` and lists subjects at step 2
- THEN A2 is listed and enrolled, and A1 is not

#### Scenario: Student re-enrolls after a staff deactivation

- GIVEN the secretaría deactivated the row of group G
- WHEN the student enrolls in G, still offered
- THEN the same row is active again and one `inscripcion.reactivada` exists with the student as actor

#### Scenario: Student replace still rules after a staff write

- GIVEN the secretaría created an active row in A2 for a student with no group of A
- WHEN the student enrolls in A1 of the same period and confirms
- THEN A2 is inactive, A1 is active and the student has one active group of A

#### Scenario: Last writer wins

- GIVEN a staff change and a student enrollment on the same asignatura committing one after the other
- WHEN both complete
- THEN the state is that of the later commit and one active group exists
