# Student Enrollment Specification (new capability)

## Purpose

A student declares, replaces and drops their own enrollment in groups of the
current offering, at `/enrollment`. This is the stopgap of RN-21 while the
institutional academic register is unavailable: the declaration is
self-declared and unverified (D1), and the secretaria approval gate (RN-15)
remains the control on a wrong group. Covers RF-16 (new), RF-04, RF-12 b, RN-21
(amended), RNF-01, RNF-06, RNF-11, RNF-12. Audit events are specified in the
`audit-log` delta; the writer guard and role integrity of `Inscripcion` in the
`academic-catalog` delta; empty-state and navigation nudges in the
`justification-intake`, `student-requests` and `backoffice-shell` deltas.

Terms:

| Term | Meaning |
|---|---|
| effective enrollment | an `Inscripcion` with `Activo` true whose `Grupo` is active and whose `Asignatura` is active |
| latest period | the greatest `Periodo` among active grupos whose asignatura is active (D3); none when there is no such grupo |
| offered group | an active grupo of an active asignatura whose `Periodo` is the latest period |
| dependent request | a request of the same student in `borrador` or `devuelta` that names the group among its subjects |

Out of scope (D9, D10): staff view or editing of enrollments, an `Origen`
column or any schema change, a secretaria approval queue, past or configurable
periods, institutional API sync.

## ADDED Requirements

### Requirement: Enrollment access and identity (RF-16, RNF-01)

Only an authenticated user with role `estudiante` MUST be able to open
`/enrollment` or call any of its actions, and only for their own enrollments.
Every action MUST re-check authentication and role; the page guard MUST NOT be
relied on. The student identity MUST come from the session, never from request
input. A denied call MUST return no data and change nothing.

#### Scenario: Other roles denied (table-driven)

| Role |
|---|
| `docente` |
| `secretaria` |
| `coordinacion` |
| `administrador` |

- GIVEN a signed-in user with the role from the row
- WHEN they open `/enrollment` or call enroll, replace or drop directly
- THEN access is denied, no enrollment data is returned and nothing is written

#### Scenario: Unauthenticated call

- GIVEN no session
- WHEN `/enrollment` is requested or an action is called
- THEN it is denied and nothing is read or written

#### Scenario: Forged student id is ignored

- GIVEN an enroll payload carrying another student's id
- WHEN the action runs
- THEN the enrollment is written for the session student only

### Requirement: Latest period and offered groups (RF-16, RF-12 b, RN-21)

The system MUST derive the latest period from the catalog at read time (D3);
no period is configured or chosen by the user. Only offered groups MAY be
enrolled in. A group of an older period, an inactive group and a group of an
inactive asignatura MUST NOT be offered.

#### Scenario: Latest period is the greatest among active groups

- GIVEN active grupos in `2026-S1` and `2026-S2` of active asignaturas
- WHEN the page renders
- THEN only groups of `2026-S2` are offered

#### Scenario: Inactive rows do not set the period

- GIVEN an inactive grupo of `2027-S1`, an active grupo of `2027-S1` whose
  asignatura is inactive, and active grupos of `2026-S2`
- WHEN the latest period is derived
- THEN it is `2026-S2`

#### Scenario: No offered group

- GIVEN no active grupo of an active asignatura
- WHEN the page renders
- THEN a localized empty state says no groups are offered yet and no group can
  be enrolled in

### Requirement: Own effective enrollments list (RF-16, RF-04, RN-21)

The page MUST list the student's effective enrollments with, for each, the
asignatura code and name, the period, the group number and the docente name,
ordered by asignatura name then group number. A group without a docente MUST
show a "no teacher assigned" label. Each entry MUST offer a drop control. The
list MUST include effective enrollments of earlier periods whose grupo is
still active. When there are none, an empty state MUST invite the student to
choose groups from the picker.

#### Scenario: Effective enrollments shown

- GIVEN a student with two effective enrollments
- WHEN the page renders
- THEN both are listed with code, name, period, group number and docente name

#### Scenario: Non-effective rows hidden (table-driven)

| Inscripcion | Grupo | Asignatura |
|---|---|---|
| inactive | active | active |
| active | inactive | active |
| active | active | inactive |

- GIVEN an inscripcion of the student with the states from the row
- WHEN the page renders
- THEN it is not listed

#### Scenario: Group without teacher

- GIVEN an effective enrollment in a group with no docente
- WHEN the page renders
- THEN the entry shows the "no teacher assigned" label

#### Scenario: No enrollments

- GIVEN a student with no effective enrollment
- WHEN the page renders
- THEN the empty state is shown and the picker is available

### Requirement: Picker with own carrera first (RF-16, RN-21)

The page MUST offer a picker of offered groups, grouped by asignatura, showing
code, name, group number and docente name. The groups of the student's own
carrera MUST come first. Groups of other carreras MUST be reachable by search
(by asignatura code, asignatura name or carrera name), never hidden. A student
with no carrera MUST see all offered groups in one searchable list. A group the
student is already effectively enrolled in MUST be shown as enrolled and MUST
NOT offer enrolling again.

#### Scenario: Own carrera first

- GIVEN offered groups of the student's carrera and of another carrera
- WHEN the picker renders without a search term
- THEN the own-carrera groups are listed before the others

#### Scenario: Other carrera by search

- GIVEN an offered group of another carrera named "Cálculo"
- WHEN the student searches "Cálculo"
- THEN that group is listed and can be enrolled in

#### Scenario: Search without results

- GIVEN a term that matches no offered group
- WHEN the picker filters
- THEN the shared no-results state shows the term and a control that clears it

#### Scenario: Student without carrera

- GIVEN a student whose account has no carrera
- WHEN the picker renders
- THEN all offered groups are listed in one searchable list

#### Scenario: Already enrolled group

- GIVEN an effective enrollment in group G
- WHEN the picker renders
- THEN G is marked as enrolled and offers no enroll action

### Requirement: Enroll in an offered group (RF-16, RN-21, RNF-06)

Enrolling MUST make the student's `Inscripcion` for the group active, creating
the row when none exists. The server MUST verify that the group is an offered
group and that the enrolling user is an `estudiante`; otherwise nothing is
stored. Enrolling in a group the student is already effectively enrolled in
MUST change nothing. There is no limit on the number of groups per student
(D6). Each change MUST write its audit row per the `audit-log` delta.

#### Scenario: Enroll outcomes (table-driven)

| Group state when enrolling | Result |
|---|---|
| offered, no inscripcion yet | row created active, one `inscripcion.creada` |
| offered, inscripcion inactive | same row set active, one `inscripcion.reactivada` |
| offered, inscripcion already active | no change, no audit row |
| not the latest period | refused, nothing stored, no audit row |
| grupo inactive | refused, nothing stored, no audit row |
| asignatura inactive | refused, nothing stored, no audit row |
| unknown group id | refused, nothing stored, no audit row |

- GIVEN a student and a group in the state from the row
- WHEN they enroll in it
- THEN the result is as shown and exactly one `Inscripcion` row exists for the pair

#### Scenario: No enrollment limit

- GIVEN a student already enrolled in twelve groups of different asignaturas
- WHEN they enroll in another offered group
- THEN it is accepted

#### Scenario: Re-enroll after drop reuses the row

- GIVEN a student who dropped group G
- WHEN they enroll in G again
- THEN the same (`EstudianteId`, `GrupoId`) row is active again and no second row exists

### Requirement: One active group per asignatura and period; replace (RF-16, RNF-12)

A student MUST have at most one active `Inscripcion` per asignatura and period
(D2). Enrolling in an offered group of an asignatura in which the student is
already enrolled for that period MUST replace the previous group: the previous
`Inscripcion` becomes inactive and the new one active, atomically. Before a
replace executes the student MUST confirm in a dialog that names the group
being replaced; cancelling MUST change nothing. A replace MUST NOT affect
enrollments of other asignaturas or of other periods. The rule is enforced by
the application; it MUST hold when two enrollments of the same student race.

#### Scenario: Replace

- GIVEN an effective enrollment in group A1 of asignatura A for `2026-S2`
- WHEN the student enrolls in group A2 of A for `2026-S2` and confirms
- THEN A1 is inactive, A2 is active, and the student has exactly one active
  group of A for the period

#### Scenario: Cancel replace

- GIVEN the replace confirmation dialog is open
- WHEN the student cancels
- THEN A1 stays active and no A2 row is created or changed

#### Scenario: Replace is atomic

- GIVEN a replace in which either the deactivation, the activation or an audit insert fails
- WHEN the transaction ends
- THEN A1 is still active, A2 is unchanged and no audit row from it exists

#### Scenario: Other asignaturas and periods untouched

- GIVEN effective enrollments in group B1 of asignatura B and in group A0 of A for `2026-S1`
- WHEN the student replaces A1 by A2 for `2026-S2`
- THEN B1 and A0 stay active

#### Scenario: Racing enrollments

- GIVEN a student with no group of A and two concurrent enrollments in A1 and A2
- WHEN both complete
- THEN at most one active group of A for the period exists for the student

### Requirement: Drop with confirmation (RF-16, RNF-12, RNF-06)

Dropping MUST require explicit confirmation in a dialog before execution;
cancelling MUST change nothing. A confirmed drop MUST set the student's
`Inscripcion` inactive and MUST NOT delete it (D7). Only the session student's
own effective enrollment MAY be dropped. Requests already presented
(`pendiente`, `aprobada`, `rechazada`, `en_revision_coordinacion`) MUST be
unaffected, because they reference the group, not the enrollment.

#### Scenario: Confirm drop

- GIVEN an effective enrollment in group G
- WHEN the student drops it and confirms
- THEN the `Inscripcion` is inactive, the row still exists, G leaves the list
  and one `inscripcion.desactivada` row is written

#### Scenario: Cancel drop

- GIVEN the confirmation dialog is open
- WHEN the student cancels
- THEN the enrollment stays active and no audit row is written

#### Scenario: Drop refusals (table-driven)

| Case |
|---|
| another student's inscripcion |
| unknown group id |
| inscripcion already inactive |

- GIVEN the case from the row
- WHEN a drop is called
- THEN it is refused, nothing changes and no audit row is written

#### Scenario: Presented requests unaffected

- GIVEN a `pendiente` request naming group G
- WHEN the student drops G and confirms
- THEN the request, its subjects and its state are unchanged

### Requirement: Warning for dependent requests (RF-16, D5)

When the group being dropped or replaced is named by a dependent request, the
confirmation dialog MUST warn that the draft or returned request uses it and
that it can no longer be submitted with that group unless the student enrolls
again. The warning MUST NOT block the action. The request data MUST NOT be
modified by the drop or replace.

#### Scenario: Draft uses the group

- GIVEN a `borrador` request naming group G
- WHEN the student opens the drop dialog for G
- THEN the warning is shown, and confirming still drops G

#### Scenario: Returned request uses the group

- GIVEN a `devuelta` request naming group G
- WHEN the student opens the replace or drop dialog for G
- THEN the warning is shown

#### Scenario: No dependent request, no warning

- GIVEN G is named only by `pendiente` or `aprobada` requests, or by another student's draft
- WHEN the student opens the drop dialog for G
- THEN no warning is shown

#### Scenario: Request data untouched

- GIVEN the warning was shown and the student confirmed the drop
- WHEN the draft is read
- THEN its subjects are unchanged

### Requirement: Enrollment feeds the intake (RF-04, RN-21, RN-22)

The groups a student may name on a request MUST be exactly their effective
enrollments, narrowed by the schedule rule of `justification-intake`. A group
enrolled through this capability MUST be selectable in step 2 as soon as it is
enrolled, and a dropped or replaced group MUST stop being selectable.

#### Scenario: Enrolled group becomes selectable

- GIVEN a student with no enrollment who enrolls in group G, which meets on a weekday inside the request dates
- WHEN they list subjects at step 2
- THEN G's subject is offered with its group and docente

#### Scenario: Dropped group stops being selectable

- GIVEN a student who dropped G
- WHEN they list subjects or submit a request naming G
- THEN G is not offered and the submit is blocked with an error on subjects

### Requirement: Docente contact data is never exposed (RNF-01, RNF-02)

The enrollment page, its picker, its actions and everything sent to the
browser MUST NOT carry any docente email or phone. Only the docente's name MAY
be shown.

#### Scenario: No contact data reaches the student

- GIVEN offered groups whose docentes have an email and a phone
- WHEN the page data and the rendered output are serialized and searched
- THEN neither any email nor any phone value appears

### Requirement: Degraded read and write failure (RF-16)

When the enrollment read fails, the page MUST show the shared degraded alert
(`role="status"`) in place of the list, the picker and any empty state, and MUST
offer no action. A failing write MUST fail loudly: the student sees an error
message, the stored data is unchanged and no audit row exists.

#### Scenario: Read fails

- GIVEN a failing enrollment read
- WHEN the page renders
- THEN the degraded alert is shown, and no list, empty state, picker or action is present

#### Scenario: Write fails

- GIVEN an enroll or drop whose write fails
- WHEN the action returns
- THEN an error is shown, the enrollment is unchanged and no audit row exists

### Requirement: Usable at 360 px and in both locales (RNF-11, RNF-12)

The page, the picker, the drop and replace dialogs and every message MUST be
usable in full at 360 px width with no horizontal scrolling. All user-facing
text MUST exist in both `i18n/es.json` and `i18n/en.json` with identical keys.

#### Scenario: No horizontal scroll

- GIVEN a 360 px viewport
- WHEN the page, the picker and each dialog render
- THEN the document width does not exceed the viewport

#### Scenario: Key parity

- GIVEN the enrollment message keys
- WHEN `es.json` and `en.json` are compared
- THEN both contain the same keys with non-empty values

### Requirement: Requirements documentation is synchronised (RF-16, RN-21, D1)

`docs/requirements.md` MUST list the new functional requirement RF-16 (the
student declares, replaces and drops their own enrollment in groups of the
latest period), carry amended RF-12 (inscripciones are maintained by the
student's own declaration as well as by the secretaria) and amended RN-21
(while the institutional register is unavailable the internal catalog,
including enrollments the student declares, is the source). The changelog MUST
record the change as pending sync to the thesis matrix, and `docs/roadmap.md`
MUST list the change with the IDs it covers. These edits are implementation
work of this change.

#### Scenario: Documents list the new and amended requirements

- GIVEN the change is applied
- WHEN `docs/requirements.md` and `docs/roadmap.md` are read
- THEN RF-16, the amended RF-12 and RN-21, the changelog entry and the roadmap row are present
