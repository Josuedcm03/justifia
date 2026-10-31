# Coordination Reports Specification (new capability)

> Delta type: this whole file is ADDED. There is no base spec for
> `coordination-reports`.

## Purpose

A career coordinator sees which students, teachers and classes of their career
are most affected by justified absences (dashboard), queries the underlying
requests with filters (detail) and downloads them as a workbook (export). The
three views share one career scope, one period definition and one filter
parser, so the same filters give the same rows everywhere.

Traceability (checked against `docs/requirements.md`):

- RF-17 (a-e): dashboard. RF-13 (a, b, d): download, filters, total parity.
- RN-16: the request states. RNF-01: server-side authorization, role menus.
- RNF-06: every view and download is audited, codes and counts only.
- RF-13 (c) recidivism is OUT of scope (follow-up of `validation-signals`, RN-14).
  The student ranking is not RN-14 recidivism: no issuer, no threshold, no signal.

Slice tags: **[S1]** scope, rankings, audit, dashboard, nav (with the
`backoffice-shell` and `audit-log` deltas); **[S2]** detail page; **[S3]**
workbook route. A later slice adds requirements and never edits an earlier slice.

Vocabulary: the report role is `coordinacion`. A *justified class* is one
`SolicitudAsignatura` pair. *Counted states* are `aprobada` and `pendiente`.
*Visible states* are the `VISIBLE_STATES` constant (everything but `borrador`).

## Requirements

### Requirement: CR-ACC-1 Access limited to coordination (RF-17 a, RNF-01) [S1]

The dashboard, the detail and the download MUST be available only to
`coordinacion`, decided on the server by one predicate in
`src/lib/auth/permissions.ts`. Every other role (including `administrador` and
`secretaria`) and an anonymous caller MUST be denied without any report data.
A `coordinacion` user whose `carreraId` is null MUST get scope `none`: a "no
career assigned" state, no data read and no audit row.

#### Scenario: Role matrix (table-driven)

| Role | Dashboard | Detail | Download |
|---|---|---|---|
| `coordinacion` with career | allowed | allowed | allowed |
| `administrador`, `secretaria`, `docente`, `estudiante` | denied | denied | denied |
| anonymous | denied | denied | denied |

- GIVEN a caller with the role from the row
- WHEN each destination is requested by URL or directly
- THEN access is as shown and a denied call returns no report data

#### Scenario: Coordination without a career

- GIVEN a `coordinacion` user with a null `carreraId`
- WHEN they open the dashboard
- THEN the "no career assigned" state is shown, no request is read and no audit row is written

### Requirement: CR-SCOPE-1 Career scope (RF-17 a, RNF-01) [S1]

A request MUST belong to the career of its student's CURRENT `Usuario.CarreraId`
(never a snapshot). A student with no career MUST be invisible. A coordinator
MUST see only requests of their own career, in every view. One shared where
clause MUST feed the rankings, the detail count, the detail page and the export.

#### Scenario: Other career invisible

- GIVEN requests of career A and career B and a coordinator of A
- WHEN any report view is built
- THEN no request, student, teacher or class of B appears in any figure

#### Scenario: Student changes career

- GIVEN a student who moved from career A to B after filing a request
- WHEN each coordinator opens the reports
- THEN the request counts for B and no longer for A (documented limitation)

### Requirement: CR-PERIOD-1 Academic period filter (RF-17 d) [S1]

A period is the code `AAAA-S1` or `AAAA-S2` of `Grupo.Periodo`. A request
belongs to a period when at least one of its pairs is in a group of that
period. The selector MUST list the distinct periods of in-scope requests,
newest first, plus "all periods". The default MUST be the most recent period
with data. An unknown or malformed value MUST fall back to the default.

#### Scenario: Default is the latest period with data

- GIVEN in-scope requests in `2026-S1` and `2026-S2`
- WHEN the dashboard opens without a period
- THEN `2026-S2` is selected and the rankings use only it

#### Scenario: All periods and invalid value

- GIVEN the same data
- WHEN the period is "all", and separately `2026-S9`
- THEN "all" counts every period; the invalid value behaves as the default

#### Scenario: No data at all

- GIVEN an in-scope career with no request pairs
- WHEN the dashboard opens
- THEN the empty state is shown, with no period selected and no error

### Requirement: CR-RANK-1 Counted states (RF-17 c, RN-16) [S1]

Rankings MUST count only requests in `aprobada` or `pendiente`. `rechazada`,
`devuelta`, `en_revision_coordinacion` and `borrador` MUST NOT count.

#### Scenario: Counted states (table-driven)

| State | Counted |
|---|---|
| `aprobada`, `pendiente` | yes |
| `rechazada`, `devuelta`, `en_revision_coordinacion`, `borrador` | no |

- GIVEN one request in the state from the row, with one pair
- WHEN the rankings are built
- THEN the student, teacher and class counts include it only as shown

### Requirement: CR-RANK-2 Three rankings (RF-17 b) [S1]

The dashboard MUST show three rankings: students by number of requests;
teachers (the live `Grupo.DocenteId`) by number of justified classes; classes
(`Grupo` to `Asignatura`) by number of justified classes. Student counts are
distinct requests; teacher and class counts are pairs. With a period selected,
pairs outside that period MUST NOT count for teachers and classes.

#### Scenario: Pairs, not requests, for teachers and classes

- GIVEN one `pendiente` request with two pairs in groups of teacher T and one of subject S
- WHEN the rankings are built
- THEN the student has 1, T has 2 and S has 2

#### Scenario: Period limits pairs

- GIVEN a request with one pair in `2026-S1` and one in `2026-S2`
- WHEN `2026-S1` is selected
- THEN the student counts 1 and only the `2026-S1` pair counts for teacher and class

### Requirement: CR-RANK-3 Top ten and tie-break (RF-17 b) [S1]

Each ranking MUST show at most 10 entries, ordered by count descending, ties
broken by name ascending and then by a stable identifier. An entry MUST show
its name and count; a student entry MUST also show the CIF to tell homonyms apart.

#### Scenario: Cut and tie

- GIVEN 12 students, the 9th to 12th with equal counts
- WHEN the ranking is built
- THEN 10 entries show, and among tied students the alphabetically first names are kept

### Requirement: CR-DASH-1 Dashboard page `/reports` (RF-17) [S1]

`/reports` MUST render the period selector, the three rankings and a link to
`/reports/requests`, with exactly one `h1`. A ranking with no entries MUST show
the shared empty text; a failed read MUST show the shared degraded alert in place
of the rankings and MUST NOT reach the error boundary. The page MUST show no
cause, date or state of any request.

#### Scenario: Degraded read

- GIVEN a ranking query that fails
- WHEN the page renders
- THEN the degraded alert (`role="status"`) is shown instead of figures or zeros

### Requirement: CR-AUDIT-1 Dashboard view audited (RF-17 e, RNF-06) [S1]

Each successful render of `/reports` MUST write exactly one dashboard-view audit
row (see `audit-log`), after the data load, regardless of prefetch or re-render.
A denied, `none`-scope or failed render MUST write no row. If the insert fails
the page MUST NOT return the data. The destinations linking to audited pages
MUST NOT be prefetched.

#### Scenario: Once per open

- GIVEN a coordinator opening `/reports` once, and a re-render without navigation
- WHEN the audit log is read
- THEN exactly one dashboard-view row exists with them as actor

#### Scenario: Audit failure blocks the data

- GIVEN an audit insert that fails
- WHEN the page runs
- THEN no ranking data is returned

### Requirement: CR-LIMIT-1 Documented limitations [S1]

The teacher MUST be the live `Grupo.DocenteId`, not a snapshot; reassigning a
group MUST therefore change past rows. The career MUST be the student's current
career (CR-SCOPE-1). Both MUST be stated in this spec, the design and the
archive notes. No recidivism figure, column or placeholder MAY appear in any view.

#### Scenario: Reassigned group

- GIVEN a counted pair whose group is reassigned from teacher T1 to T2
- WHEN the ranking is built
- THEN the pair counts for T2 and not for T1

### Requirement: CR-I18N-1 Copy in both locales [S1, S2, S3]

Every user-visible string (titles, labels, empty, degraded and no-career texts,
filter labels, workbook headers) MUST exist in `es` and `en` with identical key sets.

#### Scenario: Key parity

- GIVEN the `es` and `en` catalogs
- WHEN the keys are compared
- THEN they are identical and every new value is non-empty

### Requirement: CR-DET-1 Detail rows and columns (RF-13 b) [S2]

`/reports/requests` MUST list one row per in-scope request in a visible state,
whatever its state, with: student name, CIF, cause, state, absence dates,
submission date, and the classes with teacher and period joined in one cell.
Filtering by period or teacher MUST NOT multiply rows. The cause MUST appear
here and never on the dashboard.

#### Scenario: One row per request

- GIVEN a request with three pairs of two teachers
- WHEN the detail lists it
- THEN it is one row whose classes cell holds all three pairs with teacher and period

#### Scenario: Borrador and other careers excluded

- GIVEN a `borrador` and a request of another career
- WHEN the detail lists
- THEN neither appears and `rechazada` or `devuelta` requests do appear

### Requirement: CR-DET-2 Filters (RF-13 b) [S2]

The detail MUST filter by period, teacher, student and cause, combined with AND,
through the same parser as the export. The student filter is a contains-match on
the name or CIF. Period uses CR-PERIOD-1 (no hidden default: absent means all).
A teacher id outside the scope MUST yield zero rows and leak nothing. A cause
outside the five causes MUST be ignored.

#### Scenario: Combined filters

- GIVEN requests that differ in period, teacher, student and cause
- WHEN period, teacher and cause are set together
- THEN only requests matching all three are listed

#### Scenario: Foreign teacher

- GIVEN a teacher id with no pair in the coordinator's career
- WHEN it is used as the teacher filter
- THEN zero rows are shown and no teacher name is disclosed

### Requirement: CR-DET-3 Total, paging and states (RF-13 d) [S2]

The detail MUST show the total number of requests matching the filters (requests,
not pairs), paged, with the page clamped. Empty results MUST show the shared
no-results state with a clear control; a failed read MUST show the degraded alert.

#### Scenario: Total counts requests

- GIVEN 3 matching requests with 7 pairs in all
- WHEN the detail renders
- THEN the total is 3

### Requirement: CR-DET-4 Detail view audited (RNF-06) [S2]

Each successful render of `/reports/requests` MUST write exactly one detail-view
audit row, after the data load, with the same guarantees as CR-AUDIT-1.

#### Scenario: Once per open, none on denial

- GIVEN one successful open, and separately a denied open
- WHEN the audit log is read
- THEN one detail-view row exists for the first and none for the second

### Requirement: CR-XLS-1 Download route (RF-13 a, RNF-01) [S3]

`GET /api/reports/justifications` MUST guard itself (middleware does not cover
`/api`), apply CR-ACC-1, use the same parser and where clause as the detail, and
respond with the xlsx content type, `Content-Disposition: attachment` and
`Cache-Control: private, no-store`. A denied call MUST return no workbook bytes.

#### Scenario: Role matrix and headers

- GIVEN each role of the CR-ACC-1 matrix
- WHEN the route is called
- THEN only an in-career `coordinacion` gets a workbook, with the three headers above

### Requirement: CR-XLS-2 Workbook content (RF-13 a, b) [S3]

The workbook MUST be in the user's locale and hold: a data sheet with one row per
matching request (all pages) with the CR-DET-1 columns; and a summary with the
applied filters and the total. Text cells MUST stay text, so a value beginning
with `=`, `+`, `-` or `@` is never a formula. An empty result MUST still download,
with the headers and total 0.

#### Scenario: Locale, summary, formula-like text

- GIVEN a locale `en`, a filter on period, and a student name `=1+1`
- WHEN the workbook is read back
- THEN headers and labels are English, the summary lists the period and the total, and the name is text

#### Scenario: Empty download

- GIVEN filters matching nothing
- WHEN the route is called
- THEN a workbook with headers and total 0 is returned

### Requirement: CR-XLS-3 Total parity (RF-13 d) [S3]

For the same filters the workbook total, its data row count and the detail's
total MUST be equal. A test MUST prove it with one shared dataset.

#### Scenario: Parity

- GIVEN a dataset and a filter set
- WHEN the detail total and the workbook are produced
- THEN total, summary total and row count are equal

### Requirement: CR-XLS-4 Download audited (RNF-06) [S3]

Each successful download MUST write exactly one download audit row after
authorization and before any bytes are sent; if the insert fails no bytes are
returned. A denied or failed download MUST write no row. Repeated downloads write one row each.

#### Scenario: Audit gate

- GIVEN a successful download, and separately one whose audit insert fails
- WHEN the route runs
- THEN the first writes one row and returns bytes; the second returns none

## Assumptions (spec level)

- A-NONE: scope `none` writes no audit row because nothing is read.
- A-ENT: the career is the audit entity (see `audit-log`); design may confirm.
- A-SORT: ordering of detail rows (newest submission first) is a design choice.
