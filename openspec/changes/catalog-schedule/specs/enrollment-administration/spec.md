# Enrollment Administration Specification (new capability)

> Delta type: this whole file is ADDED. There is no base spec for
> `enrollment-administration`.

## Purpose

The secretaría of a facultad lists and maintains the `Inscripcion` rows of the
students of that facultad at `/catalog/inscripciones`: it deactivates,
reactivates, changes the group of and creates inscriptions. This closes RF-12 (a)
("crea, edita y desactiva registros") for inscripciones, which until now only the
student wrote (`student-enrollment`).

Traceability (checked against `docs/requirements.md`): RF-12 (a)(b)(c),
RF-17 (b)(d)(e), RN-21, RNF-01 (a)(c), RNF-02, RNF-06, RNF-12. RN-27 is related
(a staff deactivation can remove a student's last active inscripcion); it is
cited only where a requirement names it. RN-22 (clock-time schedules) and the
docentes maintenance of RF-12 (a) are NOT covered.

D8 (owner, 2026-11-19): RF-17 (a) ("Solo el estudiante autenticado declara o
modifica su inscripción") is read as a rule among students: each student
modifies only their own inscription. It is NOT amended and no requirement text
changes. The secretaría writes under RF-12 (a), which already gives her the
maintenance of inscripciones. Any wording change waits for a thesis revision.

Slices (D1): **S1** read-only list; **S2** deactivate and reactivate; **S3**
change group and create. Each requirement below is tagged with the slices that
deliver it.

Terms (terms of `student-enrollment` apply: effective enrollment, latest
period, offered group):

| Term | Meaning |
|---|---|
| raw state | the `Activo` flag of the `Inscripcion` row alone |
| effective state | raw state active AND the `Grupo` active AND its `Asignatura` active |
| in scope | the student's carrera belongs to the facultad of the signed-in secretaría |
| sibling | another `Inscripcion` of the same student with `Activo` true whose grupo has the same asignatura and the same period as the target group |
| non-draft request | a request of the student in any state other than `borrador` (`devuelta` included) |

Out of scope: schema change, `Origen` or author column, older periods for
create and change group, access for `coordinacion` or `administrador`, xlsx
import of inscripciones, docentes maintenance, RN-22.

## ADDED Requirements

### Requirement: EA-ACC-1 Access and identity (RF-12 a, RNF-01 a c) [S1, S2, S3]

Only an authenticated user whose role satisfies the named predicate
`canManageEnrollments` (role `secretaria` only) MUST be able to open
`/catalog/inscripciones` or call any of its actions. The predicate is distinct
from `canManageCatalog`, whose result for `administrador` and `coordinacion`
MUST NOT change. Every action MUST re-check authentication, role and facultad
scope; the page guard MUST NOT be relied on. The actor MUST come from the
session, never from request input. A denied call MUST return no data, change
nothing and write no audit row.

#### Scenario: Other identities denied (table-driven)

| Identity |
|---|
| `estudiante` |
| `docente` |
| `coordinacion` |
| `administrador` |
| anonymous |
| `secretaria` with a pending password change |

- GIVEN a caller with the identity from the row
- WHEN they open the page or call any action directly
- THEN access is denied, no enrollment data is returned and nothing is written

#### Scenario: Secretaría allowed

- GIVEN a signed-in `secretaria` with a facultad
- WHEN she opens `/catalog/inscripciones`
- THEN the page renders

#### Scenario: Catalog predicate unchanged

- GIVEN the roles `administrador` and `coordinacion`
- WHEN `canManageCatalog` and `canManageEnrollments` are evaluated
- THEN the first is still true for both and the second is false for both

#### Scenario: Forged actor is ignored

- GIVEN an action payload carrying another user as actor
- WHEN the action runs
- THEN any audit row has the session user as actor

### Requirement: EA-SCOPE-1 Facultad scope (RNF-01, RF-12 a) [S1, S2, S3]

The list and every action MUST be limited to inscripciones whose student's
carrera belongs to the facultad of the signed-in secretaría, the same rule as
the review scope of `request-review` (SR-6, `requestScopeFor` and
`requestInScope`). A secretaría without a facultad MUST see and change nothing.
A student without a carrera is never in scope. An action on an out-of-scope or
unknown student or group MUST be refused as not found: nothing is read or
changed and no audit row is written.

#### Scenario: Only own facultad

- GIVEN inscripciones of students of facultad A and of facultad B
- WHEN a secretaría of facultad A lists
- THEN only the facultad A rows appear

#### Scenario: Out-of-scope action refused (table-driven)

| Action |
|---|
| deactivate |
| reactivate |
| change group |
| create |

- GIVEN a student of another facultad
- WHEN the secretaría calls the action from the row directly
- THEN it is refused, nothing changes and no audit row is written

#### Scenario: No facultad, no carrera

- GIVEN a secretaría with no facultad, and separately a student with no carrera
- WHEN the list is read
- THEN the first sees no rows and the second's rows appear for nobody

### Requirement: EA-PII-1 Student identity limits (RNF-01, RNF-02) [S1, S2, S3]

Everything the page, its actions and its student search send to the browser MUST
carry, for a person, the full name and the CIF only. It MUST NOT carry any
student email or phone, nor any docente email or phone, nor any request content,
cause, dates or document data.

#### Scenario: No contact data reaches the browser

- GIVEN students and docentes who have an email and a phone
- WHEN the page data and the rendered output are serialized and searched
- THEN neither any email nor any phone value appears

### Requirement: EA-LIST-1 Inscripciones list (RF-12 a c, RN-21) [S1]

`/catalog/inscripciones` MUST list in-scope inscripciones. Each row MUST show
the student's name and CIF, the asignatura code and name, the period, the group
number and both states: the raw state and the effective state, in text and not
by colour alone. The default view MUST be status active and the latest period.
The list MUST use the shared catalog list frame (paging, table card, one `h1`)
in a stable total order. It MUST NOT render any form or control in S1.

#### Scenario: States shown (table-driven)

| Inscripcion | Grupo | Asignatura | Shown as |
|---|---|---|---|
| active | active | active | active, effective |
| active | inactive | active | active, not effective |
| active | active | inactive | active, not effective |
| inactive | active | active | inactive |

- GIVEN a row with the states from the table
- WHEN the list renders
- THEN it is labelled as shown

#### Scenario: Default view

- GIVEN active and inactive rows in `2026-S1` and `2026-S2`, the latest being `2026-S2`
- WHEN the list opens with no parameters
- THEN only the active rows of `2026-S2` are listed

#### Scenario: Nothing in scope

- GIVEN no inscripcion in scope
- WHEN the list renders
- THEN the shared empty state is shown and no table

### Requirement: EA-FILT-1 Filters (RF-12 c) [S1]

The list MUST filter by: student (name or CIF), asignatura (code or name), group
number, period (default latest) and status (`active` default, or `inactive`).
Filters MUST combine, be held in the URL, and an invalid parameter MUST fall
back to its default. A filter matching nothing MUST show the shared no-results
state with a control that clears the filters.

#### Scenario: Filters combine (table-driven)

| Filter | Value | Keeps |
|---|---|---|
| student | part of a name, or a CIF | that student's rows |
| asignatura | part of a code or name | that asignatura's rows |
| group | a number | that group number |
| period | `2026-S1` | rows of that period |
| status | `inactive` | rows with raw state inactive |

- GIVEN rows in scope
- WHEN the filter from the row is applied, alone or with the others
- THEN only rows matching all applied filters are listed

#### Scenario: Invalid parameter and no results

- GIVEN a period value that does not exist, and separately a student term matching nobody
- WHEN the list renders
- THEN the first falls back to the default period and the second shows the no-results state with a clear control

### Requirement: EA-DEG-1 Degraded read and loud writes (RF-12) [S1, S2, S3]

When the list read fails the page MUST show the shared degraded alert
(`role="status"`) in place of the table, counts and empty states, and offer no
action. A failing write MUST fail loudly: the secretaría sees an error, the data
is unchanged and no audit row exists.

#### Scenario: Read fails

- GIVEN a failing list read
- WHEN the page renders
- THEN the degraded alert is shown and no table, empty state or action is present

#### Scenario: Write fails

- GIVEN any staff write whose data write or audit insert fails
- WHEN the action returns
- THEN an error is shown, the data is unchanged and no audit row exists

### Requirement: EA-DEACT-1 Deactivate with confirmation (RF-12 a b, RF-17 e, RNF-12, RNF-06, RN-27) [S2]

Deactivating MUST require confirmation in a dialog before executing; cancelling
MUST change nothing. A confirmed deactivation MUST set the raw state inactive,
MUST keep the row, and MUST write one `inscripcion.desactivada` with the staff
actor. The dialog MUST state the number of non-draft requests of that student
that name the group and that those requests do not change. A `borrador` MUST
NOT be counted and MUST NOT be revealed: no wording, count or control depends
on its existence. When the row is the student's last row with raw state active,
the dialog MUST say so and that this can make the student eligible for
retention (RN-27); nothing is cancelled automatically. A row of any period MAY
be deactivated.

#### Scenario: Confirm deactivation

- GIVEN an active row in scope
- WHEN the secretaría deactivates it and confirms
- THEN the row is inactive and kept, and one `inscripcion.desactivada` exists with her as actor

#### Scenario: Cancel

- GIVEN the dialog is open
- WHEN she cancels
- THEN the row stays active and no audit row is written

#### Scenario: Request count excludes drafts (table-driven)

| Requests of the student naming the group | Count shown |
|---|---|
| one `pendiente`, one `devuelta` | 2 |
| one `aprobada`, one `rechazada` | 2 |
| only a `borrador` | none, no mention of requests |
| one `pendiente` and a `borrador` | 1 |

- GIVEN the requests from the row
- WHEN the dialog opens
- THEN the count is as shown, with the statement that those requests do not change

#### Scenario: Requests unchanged

- GIVEN a `pendiente` request naming the group
- WHEN the deactivation is confirmed
- THEN the request, its subjects and its state are unchanged

#### Scenario: Last active inscription

- GIVEN a student whose only row with raw state active is this one
- WHEN the dialog opens
- THEN it states the retention effect, and no cancellation occurs on confirm

#### Scenario: Refusals (table-driven)

| Case |
|---|
| row already inactive |
| unknown student or group |
| out-of-scope student |
| non-`estudiante` user id |

- GIVEN the case from the row
- WHEN deactivate is called
- THEN it is refused, nothing changes and no audit row is written

### Requirement: EA-REACT-1 Reactivate (RF-12 a b, RF-17 b, RNF-06) [S2]

Reactivating MUST be one control without a dialog when no sibling exists. It
MUST set the raw state of an inactive row active and write one
`inscripcion.reactivada` with the staff actor. It MUST be allowed only when the
group is an offered group of the latest period. When a sibling exists, EA-SIB-1
applies. Until EA-SIB-1 ships (S3), the list MUST NOT offer reactivation for a
row that has a sibling, and the server MUST refuse it with nothing changed.

#### Scenario: Reactivate an offered group

- GIVEN an inactive row of an offered group and no sibling
- WHEN the secretaría reactivates it
- THEN the row is active and one `inscripcion.reactivada` exists

#### Scenario: Refusals (table-driven)

| Case |
|---|
| group of an older period |
| grupo inactive |
| asignatura inactive |
| row already active |
| out-of-scope or unknown student |

- GIVEN the case from the row
- WHEN reactivate is called
- THEN it is refused, nothing changes and no audit row is written

### Requirement: EA-SIB-1 One active group per asignatura and period; replace with confirmation (RF-17 b, RNF-12) [S3]

A staff activation of a group G (reactivate, change group or create) when the
student has a sibling S MUST replace S: S becomes inactive and G active,
atomically, only after a confirmation that names the replaced group S. Cancelling
MUST change nothing. Other asignaturas and other periods MUST NOT be affected.
The replace MUST write one `inscripcion.desactivada` for S and one
`inscripcion.creada` or `inscripcion.reactivada` for G, with the staff actor.

#### Scenario: Replace after confirm

- GIVEN an active sibling A1 and an inactive row of A2, same asignatura and period
- WHEN the secretaría reactivates A2 and confirms the dialog naming A1
- THEN A1 is inactive, A2 is active and the audit rows are `desactivada` then `reactivada`

#### Scenario: Cancel replace

- GIVEN the dialog naming A1 is open
- WHEN she cancels
- THEN A1 stays active, A2 is unchanged and no audit row is written

#### Scenario: Other asignaturas and periods untouched

- GIVEN active rows in asignatura B and in A for an older period
- WHEN A1 is replaced by A2 in the latest period
- THEN both stay active

### Requirement: EA-CHG-1 Change group (RF-12 a, RF-17 b, RNF-12) [S3]

For an active row in scope whose group is an offered group, the secretaría MUST
be able to change the student to another offered group of the same asignatura
and the latest period. The candidates MUST be those groups only. The change MUST
go through the confirmation of EA-SIB-1 naming the current group. A row whose
group is not an offered group MUST NOT offer the change.

#### Scenario: Change to another group

- GIVEN an active row in A1 and an offered group A2 of the same asignatura
- WHEN she picks A2 and confirms
- THEN A1 is inactive, A2 is active and two audit rows exist with her as actor

#### Scenario: Refusals (table-driven)

| Target |
|---|
| the current group |
| a group of another asignatura |
| a group of an older period |
| an inactive grupo or asignatura |
| a group of an out-of-scope student |

- GIVEN the target from the row
- WHEN change group is called
- THEN it is refused, nothing changes and no audit row is written

### Requirement: EA-CRE-1 Create an inscription (RF-12 a, RN-21, RNF-06) [S3]

The secretaría MUST be able to create an inscripcion for an in-scope active
`estudiante` in an offered group of the latest period. The student search MUST
find only in-scope active students by name or CIF and return name and CIF only.
Creating MUST insert the row active (`inscripcion.creada`), or set an existing
inactive row active (`inscripcion.reactivada`), and MUST change nothing when
the row is already active. A sibling triggers EA-SIB-1.

#### Scenario: Create outcomes (table-driven)

| State when creating | Result |
|---|---|
| offered group, no row | row created active, one `inscripcion.creada` |
| offered group, inactive row | same row active, one `inscripcion.reactivada` |
| offered group, row already active | no change, no audit row |
| not an offered group | refused, no audit row |
| target user is not an active `estudiante` | refused, no audit row |
| cancelled account | not found by the search, refused if forced |

- GIVEN an in-scope student and a group in the state from the row
- WHEN the secretaría creates the inscripcion
- THEN the result is as shown and at most one row exists for the pair

#### Scenario: Search is limited

- GIVEN students of two facultades and a cancelled account
- WHEN she searches by a name or CIF
- THEN only in-scope active students are returned, with name and CIF only

### Requirement: EA-WRITE-1 Staff writer integrity (RF-17 b d, RNF-06) [S2, S3]

Every staff write MUST run in one transaction that first takes the same
per-student lock as the student writer, verifies that the actor is an active
`secretaria` and that the target is an active `estudiante`, applies the data
change and inserts its audit rows. If the data write or an audit insert fails
the whole transaction MUST roll back. Staff and student writes on the same
student MUST serialize, and the last committed write wins. A staff
deactivation MUST NOT block the student from enrolling again. The staff and the
student writers MUST be one module.

#### Scenario: Race with the student

- GIVEN a staff change and a student enrollment racing on the same asignatura and period
- WHEN both complete
- THEN at most one active group of that asignatura and period exists for the student

#### Scenario: Not sticky

- GIVEN a row the secretaría deactivated
- WHEN the student enrolls in the same offered group
- THEN the row is active again

#### Scenario: Atomic failure

- GIVEN a replace whose audit insert fails
- WHEN the transaction ends
- THEN the previous group is still active, the new one unchanged and no audit row exists

#### Scenario: Staff change reaches the student and the intake

- GIVEN a staff deactivation of group G
- WHEN the student opens `/enrollment` and lists subjects at step 2
- THEN G is no longer listed or offered

### Requirement: EA-UI-1 Shared frame, copy and documentation (RF-12, RNF-12) [S1, S2, S3]

The page MUST follow the shared list frame and design tokens
(`docs/design-system.md`), keep the top-bar trail and sidebar entry of
`backoffice-shell`, and take every user-facing string from `i18n/es.json` and
`i18n/en.json` with identical keys. `docs/requirements.md` MUST record that the
enrollment surface uses `canManageEnrollments` (secretaría only) instead of
`canManageCatalog`, without changing the text of RF-12, RF-17 or RN-21 (D8);
`docs/roadmap.md` row 0 MUST list the covered IDs and note the docentes gap and
RN-22 as not covered.

#### Scenario: Key parity

- GIVEN the enrollment-administration message keys
- WHEN `es.json` and `en.json` are compared
- THEN both hold the same keys with non-empty values

#### Scenario: Documents synchronised

- GIVEN the change is applied
- WHEN `docs/requirements.md` and `docs/roadmap.md` are read
- THEN the predicate divergence and the roadmap row are recorded and the RF-12, RF-17 and RN-21 rows are unchanged

## Assumptions and open points

- Deactivation is allowed for a row of any period; reactivation, create and
  change group need an offered group. Confirmed by the owner on 2026-11-19
  (proposal D9).
- The request count counts the student's non-draft requests naming the group,
  not requests of other students.
- Resolved by the owner on 2026-11-19 (proposal D10): opening the list and the
  student search each write one audit row without student data (audit-log
  delta). The original note follows. Opening the list writes no audit row, as catalog and user lists; RNF-06 (a)
  literal wording ("cada lectura") could be argued otherwise.
- Resolved: S2 hides and refuses a reactivation that has a sibling; S3 adds the
  replace path through EA-SIB-1 (design CS-8).
