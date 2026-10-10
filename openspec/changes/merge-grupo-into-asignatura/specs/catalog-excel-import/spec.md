# Catalog Excel Import Specification (delta)

> **Prerequisite: `catalog-management` must be archived before this change is
> archived.** This delta is written against the state of
> `openspec/specs/catalog-excel-import/spec.md` AFTER the delta of
> `openspec/changes/catalog-management/specs/catalog-excel-import/spec.md` has
> been applied to it. The requirements "Import precedence over manual edits",
> "Preview reports manual-group deactivations and reactivations", "Copy for the
> new preview figures", "Grupos sheet accepts an optional days column
> (CEI-DIAS-1)", "Day tokens in the Dias cell (CEI-DIAS-2)", "Days semantics on
> apply (CEI-DIAS-3)" and "Template and contract document the days column
> (CEI-DIAS-4)" exist in the main spec only after that archive. Requirements not
> named here are unchanged: "Only secretaria may import", "Authorization precedes
> reading the request body", "File guards", "Stateless confirm re-parses and
> re-plans", "All-or-nothing apply", "Idempotent re-import" and "Apply reports
> busy when it cannot start".
>
> Purpose and sheet table (not requirements, for the archive editor): the Purpose
> sentence names "asignaturas, docentes, grupos" and a table of three sheets. After
> this change there are two sheets: `Asignaturas` (natural key: `Codigo` plus group
> number) and `Docentes` (natural key `Usuario.Correo`). The scope reduction
> (no Facultad, Carrera, Estudiante or Inscripcion sheets) stands.
>
> Vocabulary: a **class** is one `Asignatura` row (code plus group number). A
> **code** is a `Codigo`. The **subject fields** are `Nombre`, `Carrera` and
> `HorasTotales`. Items marked A1-A12 come from the assumed defaults of the
> proposal, unconfirmed by the owner; items marked S1-S4 are spec-level
> assumptions listed at the end. Precedence rule (binding owner decision): the
> import wins over manual edits.

## ADDED Requirements

### Requirement: Workbook has two sheets and one row per class

The workbook MUST contain exactly the sheets `Asignaturas` and `Docentes`, in that
order in the template. Each `Asignaturas` row is one class. Its required columns
are `Codigo`, `Nombre`, `Carrera`, `HorasTotales` and `Grupo` (the group number);
its optional columns are `CorreoDocente` and `Dias`. The `Docentes` sheet is
unchanged: required `Correo` and `Nombre`, optional `Telefono`. Headers are matched
as today (trimmed, case- and accent-insensitive). A missing sheet or a missing
required column MUST be a structural error naming the sheet or the column, with
nothing planned. A missing optional column MUST NOT be an error. No `Id` column is
accepted. Natural keys: class = (`Codigo`, `Grupo`); docente = `Correo`. A sheet
named `Grupos` is not part of the contract and is never read.

#### Scenario: Valid two-sheet workbook is accepted

- GIVEN a workbook with `Asignaturas` (five required columns) and `Docentes`
- WHEN it is uploaded
- THEN it parses and is planned

#### Scenario: Optional columns may be absent

- GIVEN an `Asignaturas` sheet with the five required columns only
- WHEN it is uploaded
- THEN no structural error is raised for `CorreoDocente` or `Dias`

#### Scenario: Missing required column names the column (table-driven)

| Missing column |
|---|
| `Nombre` |
| `Carrera` |
| `HorasTotales` |
| `Codigo` |

- GIVEN a two-sheet workbook lacking the column from the row in `Asignaturas`
- WHEN it is uploaded
- THEN a structural error names the sheet and the column and nothing is planned

#### Scenario: Several groups of one code are separate rows

- GIVEN two `Asignaturas` rows with `Codigo` "MAT101" and `Grupo` "1" and "2"
- WHEN it is planned
- THEN they are two classes and neither is a duplicate of the other

### Requirement: The old three-sheet layout is refused

A workbook in the layout that preceded this change (sheets `Asignaturas` with four
columns, `Docentes`, `Grupos` with `Periodo`) MUST be refused before any row is
read or planned, with nothing written. The refusal MUST use a dedicated message
that states the workbook layout has changed, names the two sheets and the columns
of the new `Asignaturas` sheet, and tells the user to download the new template.
The message MUST be distinguishable from the corrupt-workbook, missing-sheet and
missing-column messages and MUST exist in both `es` and `en`. How the old layout
is recognised is a design decision (open question).

#### Scenario: Old workbook is refused with the layout message

- GIVEN the three-sheet workbook of the previous version, unchanged
- WHEN it is uploaded
- THEN the response is the old-layout refusal naming the new layout and the
  template
- AND no row is planned and nothing is written

#### Scenario: The message is not a generic column error

- GIVEN the same workbook
- WHEN it is uploaded
- THEN the reason is not the generic missing-column or missing-sheet reason

#### Scenario: The new template is not refused

- GIVEN the template downloaded after this change
- WHEN it is uploaded unchanged
- THEN it parses with zero rows and zero errors

### Requirement: Rows of one Codigo must agree on the subject fields (D9)

Within the `Asignaturas` sheet, all rows with the same `Codigo` MUST carry the same
`Nombre` (trimmed text, compared exactly), the same `HorasTotales` and the same
`Carrera` (compared by the carrera it resolves to). If they disagree, EVERY row of
that code MUST be a row-level error naming the `Codigo` and which of the three
fields disagree (S3). The workbook is refused as a whole, as for any row error.

#### Scenario: Disagreement is reported on every row of the code

- GIVEN rows (MAT101, "1", hours 64) and (MAT101, "2", hours 80)
- WHEN it is planned
- THEN both rows are errors naming "MAT101" and the hours field
- AND confirmation is not offered

#### Scenario: Agreement across several groups is accepted

- GIVEN three rows of "MAT101" with identical `Nombre`, `Carrera` and
  `HorasTotales` and groups "1", "2", "3"
- WHEN it is planned
- THEN no subject-field error is raised

#### Scenario: Disagreeing field names are listed (table-driven)

| Differing field |
|---|
| `Nombre` |
| `Carrera` |
| `HorasTotales` |

- GIVEN two rows of one code differing only in the field from the row
- WHEN it is planned
- THEN each row's error names that field and no other

### Requirement: Subject fields of a code are written to every row of the code (D9)

On apply, the subject fields that the workbook declares for a code MUST be written
to every stored class row of that code, active or inactive, whether or not the
workbook lists that row, in the same transaction as the rest of the apply, so that
the invariant of `academic-catalog` ("Subject fields are identical across the
rows of one Codigo") holds afterwards. A workbook row for a new group of an
existing code creates a new row with the workbook's subject fields and writes the
same values to the rest of the code. A code that the workbook does not mention is
not touched except by deactivation. The preview and the apply MUST agree on what
they would write.

#### Scenario: Propagation reaches an omitted row

- GIVEN stored classes (MAT101, "1") and (MAT101, "2"), both with hours 64, and a
  workbook listing only (MAT101, "1") with hours 80
- WHEN applied
- THEN (MAT101, "1") has hours 80
- AND (MAT101, "2") is inactive (A5) and also has hours 80

#### Scenario: A new group of an existing code

- GIVEN stored (MAT101, "1") and a workbook listing (MAT101, "1") and (MAT101, "2")
  with identical subject fields
- WHEN applied
- THEN (MAT101, "2") is created with those fields and (MAT101, "1") is
  `unchanged`

### Requirement: CorreoDocente resolution and blank cell (A6)

`CorreoDocente` is optional. A non-blank value MUST resolve, by the same email
matching the `Docentes` sheet uses, to a docente declared in the workbook's
`Docentes` sheet or to an existing `Usuario` with role `docente`; otherwise the
row MUST be a row-level error naming the email; an email that belongs to an
existing user of another role MUST also be a row error, never a role change. A
blank cell means "no docente" (A6): a created class has no docente, and on a
matched class the stored docente is cleared and the row is counted as `update`. If
the `CorreoDocente` column is absent from the workbook, the stored docente of a
matched class is kept and a created class has none (S4). The import is not subject
to the active-docente check (known gap, unchanged).

#### Scenario: Docente declared in the same workbook

- GIVEN a `Docentes` row for a new docente and an `Asignaturas` row referencing
  its email
- WHEN it is planned
- THEN the class is a valid create with that docente

#### Scenario: Unknown email is an error

- GIVEN an `Asignaturas` row whose `CorreoDocente` matches no docente in the
  workbook or the database
- WHEN it is planned
- THEN the row is an error naming the email

#### Scenario: Email of a non-docente user is an error

- GIVEN an `Asignaturas` row whose email belongs to an existing `secretaria`
- WHEN it is planned
- THEN the row is an error and the class is not applicable

#### Scenario: Blank cell clears the docente (A6)

- GIVEN a stored class with docente D1 and a workbook row for it with a blank
  `CorreoDocente` and every other value equal
- WHEN applied
- THEN the class has no docente and the row is counted `update`

#### Scenario: Blank cell on a new class

- GIVEN a workbook row with a blank `CorreoDocente` for a class that does not
  exist
- WHEN applied
- THEN the class is created with no docente

#### Scenario: Absent column keeps the docente (S4)

- GIVEN a workbook without a `CorreoDocente` column and a stored class with
  docente D1 listed with all other values equal
- WHEN applied
- THEN the docente is still D1 and the row is `unchanged`

### Requirement: Docente rule over the resulting state (D6)

The planner MUST evaluate the docente rule of `academic-catalog` ("Docente rule:
one docente per meeting day within a Codigo") over the state the apply would leave:
every class row that would be active afterwards, with the docente and days it would
have (stored days when `Dias` is absent or the cell is empty, A7). Each pair that
violates the rule MUST make each workbook row involved a row-level error naming the
`Codigo` and both group numbers. Stored active rows that the same apply deactivates
(A5) MUST NOT count. The error blocks confirmation and the apply like any row
error and nothing is written. A class with no docente or with no recorded days
never conflicts.

#### Scenario: Two workbook rows conflict

- GIVEN rows (MAT101, "1", D1, Mon+Wed) and (MAT101, "2", D1, Wed+Fri)
- WHEN it is planned
- THEN both rows are errors naming "MAT101" and groups "1" and "2"

#### Scenario: Same docente without a shared day is valid

- GIVEN rows (MAT101, "1", D1, Mon) and (MAT101, "2", D1, Tue)
- WHEN it is planned
- THEN no docente-rule error is raised

#### Scenario: Swap of docentes is valid

- GIVEN stored (MAT101, "1", D1, Mon) and (MAT101, "2", D2, Mon) and a workbook
  listing them with docentes swapped
- WHEN it is planned and applied
- THEN there is no error and each class has its new docente

#### Scenario: A deactivated stored row does not conflict

- GIVEN a stored active (MAT101, "3", D1, Mon) that the workbook omits, and a
  workbook row (MAT101, "1", D1, Mon)
- WHEN it is planned
- THEN no error is raised, because (MAT101, "3") is deactivated by the same apply

#### Scenario: Kept days take part in the rule

- GIVEN stored (MAT101, "1", D1, Mon), a workbook with a `Dias` column listing
  (MAT101, "1", D1) with an empty cell (so Monday is kept) and a new class
  (MAT101, "2", D1) with `Dias` "Lun"
- WHEN it is planned
- THEN both rows are errors naming "MAT101" and groups "1" and "2"
- AND with the new class's cell empty instead, no error is raised

#### Scenario: No docente or no days never conflicts (table-driven)

| Row 1 | Row 2 |
|---|---|
| no docente, Mon | no docente, Mon |
| D1, Mon | no docente, Mon |
| D1, Mon | D1, no days |

- GIVEN two rows of one code with the values from the row
- WHEN it is planned
- THEN no error is raised

### Requirement: The apply order never trips the database rule

The apply MUST order its writes so that the database enforcement of the docente
rule is satisfied at every statement, because that enforcement is not deferrable.
A workbook the planner accepted MUST NOT fail the apply on the docente rule,
including a workbook that swaps or rotates docentes among groups that share days,
and a workbook that deactivates a class and gives its docente and days to another
class of the same code. A failure of the apply on any other cause remains
all-or-nothing.

#### Scenario: Swap applies in one transaction

- GIVEN stored (A, "1", D1, Mon) and (A, "2", D2, Mon) and a workbook that swaps
  their docentes
- WHEN applied
- THEN it succeeds and no unique violation is raised

#### Scenario: Rotation of three docentes

- GIVEN stored (A, "1", D1, Mon), (A, "2", D2, Mon), (A, "3", D3, Mon) and a
  workbook giving them D2, D3, D1
- WHEN applied
- THEN it succeeds

#### Scenario: Handover from a deactivated class

- GIVEN stored (A, "1", D1, Mon) omitted by the workbook and a workbook row
  (A, "2", D1, Mon) for a new class
- WHEN applied
- THEN (A, "1") is inactive and (A, "2") is created with D1, without error

### Requirement: Asignaturas sheet accepts an optional days column (CEI-DIAS-1)

The `Asignaturas` sheet MUST accept the OPTIONAL column `Dias`, holding the meeting
days of the class. It is optional in the same sense as `CorreoDocente`: its absence
MUST NOT be a structural error, and its header is matched like the other headers.
The required columns of every sheet are as in "Workbook has two sheets and one row
per class". The column is read only for the `Asignaturas` sheet.

#### Scenario: Workbook without the column is accepted

- GIVEN an `Asignaturas` sheet without `Dias`
- WHEN it is uploaded
- THEN no structural error is raised for `Dias`

#### Scenario: Workbook with the column is accepted

- GIVEN an `Asignaturas` sheet with a `Dias` column
- WHEN it is uploaded
- THEN the column is read for every row

## MODIFIED Requirements

### Requirement: Template download

The system MUST offer a template `.xlsx` at a role-guarded route. It MUST contain
the two sheets `Asignaturas` and `Docentes`, in that order, each with its header
row. The `Asignaturas` header row MUST be `Codigo`, `Nombre`, `Carrera`,
`HorasTotales`, `Grupo`, `CorreoDocente`, `Dias`; the `Docentes` header row MUST be
`Correo`, `Nombre`, `Telefono`. Its column names MUST be the ones the importer
accepts.
(Previously: three sheets, `Asignaturas`, `Docentes`, `Grupos`.)

#### Scenario: Secretaria downloads the template

- GIVEN an authenticated `secretaria`
- WHEN they request the template
- THEN they receive a valid `.xlsx` whose sheets, in order, are the two listed
- AND the file, when uploaded unchanged, parses with zero rows and zero errors

#### Scenario: Denied roles get no template

- GIVEN any non-`secretaria` caller
- WHEN they request the template route
- THEN no file is returned and they are denied

### Requirement: Per-row validation with row-level errors

Every sheet MUST be validated row by row. Each failing row MUST produce an error
carrying at least the sheet name, the row number and a reason. The report MUST
list all errors found, not only the first. Validation covers at least: required
fields present (for `Asignaturas`: `Codigo`, `Nombre`, `Carrera`, `HorasTotales`,
`Grupo`); `Grupo` non-empty after trimming and at most 12 characters; `HorasTotales`
integer greater than zero; email syntax for docentes; references resolving to a
row in the workbook or an existing catalog row (including an `Asignaturas` row's
`Carrera`, which MUST resolve to an existing `Carrera`, and its non-blank
`CorreoDocente`, see "CorreoDocente resolution and blank cell (A6)"); duplicate
natural keys within one sheet (a repeated (`Codigo`, `Grupo`) pair in
`Asignaturas`, a repeated `Correo` in `Docentes`); agreement of the subject fields
within a code; valid `Dias` tokens; and the docente rule (see the ADDED
requirements). A repeated `Codigo` with different `Grupo` values is NOT a
duplicate.
(Previously: validated `Periodo` format, a repeated `Codigo` was a duplicate, and
a Grupos row for an inactive Asignatura outside the workbook was an error; the
`Grupos` sheet no longer exists.)

#### Scenario: Invalid rows are reported with location

- GIVEN a workbook where `Asignaturas` row 4 has a 13-character `Grupo` and
  `Asignaturas` row 7 has `HorasTotales` 0
- WHEN it is planned
- THEN the report contains one error for row 4 and one for row 7, each with a
  reason

#### Scenario: Missing required value is a row error (table-driven)

| Missing value |
|---|
| `HorasTotales` |
| `Grupo` |
| `Nombre` |

- GIVEN an `Asignaturas` row without the value from the row
- WHEN it is planned
- THEN that row is an error and no default is applied

#### Scenario: Unresolvable reference (table-driven)

| Sheet | Unresolvable reference |
|---|---|
| Asignaturas | `Carrera` name matches no existing carrera |
| Asignaturas | `CorreoDocente` matches no docente in the workbook or the database |

- GIVEN a row with the unresolvable reference from the row
- WHEN it is planned
- THEN that row is an error naming the reference

#### Scenario: Role integrity violation

- GIVEN an `Asignaturas` row whose `CorreoDocente` belongs to an existing
  non-docente user
- WHEN it is planned
- THEN the row is an error and the class is not applicable

#### Scenario: Duplicate class key inside one sheet

- GIVEN two `Asignaturas` rows with the same `Codigo` and the same `Grupo`
- WHEN it is planned
- THEN the duplicate is reported as a row error on the repeated row

#### Scenario: Same code with different groups is not a duplicate

- GIVEN two `Asignaturas` rows with the same `Codigo` and different `Grupo`
- WHEN it is planned
- THEN no duplicate error is raised

#### Scenario: References across sheets in one workbook

- GIVEN an existing carrera, a new docente in `Docentes` and a new class of that
  carrera referencing that docente, all in the same workbook
- WHEN it is planned
- THEN the docente and the class are valid creates

### Requirement: Dry-run report persists nothing

The preview MUST return a report with, per entity, the counts of `create`,
`update`, `unchanged`, `deactivate` and `error`, plus the row-level errors, and for
accounts the count that would be created. The entities are `Asignatura` (class
rows) and `Usuario`; there is no `Grupo` entity. The report MUST include the
class-deactivation, manual-class and reactivation figures defined in "Preview
reports manual-group deactivations and reactivations". It MUST NOT write to the
database, create accounts, generate credentials to persist, or store the file.
(Previously: the entities were `Asignatura`, `Usuario` and `Grupo`.)

#### Scenario: Preview leaves the database untouched

- GIVEN a valid workbook
- WHEN the secretaria previews it
- THEN the report shows the counts
- AND the number of rows in every table is unchanged afterwards

#### Scenario: Deactivations are explicit in the report (A5)

- GIVEN a database with active classes that the workbook omits, including every
  class of a code that the workbook does not mention
- WHEN it is previewed
- THEN the report shows a non-zero `deactivate` count for `Asignatura` equal to
  the number of those classes

#### Scenario: Preview with errors blocks confirmation

- GIVEN a workbook with at least one row error
- WHEN it is previewed
- THEN the report lists the errors and the UI does not offer confirmation

### Requirement: Natural-key upserts

Rows MUST be matched by natural key: class (`Codigo`, `Grupo`), docente
`Usuario.Correo`. A matching row MUST be updated in place, never duplicated; a
non-matching row MUST be created. A class row compares with the stored class on
`Nombre`, `Carrera`, `HorasTotales`, docente (as resolved or cleared, A6) and, when
`Dias` applies (see CEI-DIAS-3), days. A row whose values equal the stored values
MUST be counted as `unchanged` and MUST NOT be written. A row matching an
**inactive** class MUST reactivate it (`Activo` true) and MUST be counted as
`update` even when every value equals the stored one. A class created by the
import MUST get origin `importacion` (A3); a class updated by the import keeps its
existing origin. `Facultad` and `Carrera` have no upsert key here because the
import never writes them: a class's `Carrera` is resolved by name against existing
rows only. The subject fields of a code are written to every row of the code (see
the ADDED requirement).
(Previously: classes were `Grupo` rows keyed by (`Asignatura`, `Periodo`,
`NumeroGrupo`), and the `Asignatura` was keyed by `Codigo` alone.)

#### Scenario: New rows are created

- GIVEN an empty catalog
- WHEN a valid workbook is applied
- THEN each class is created exactly once
- AND each created class has origin `importacion`

#### Scenario: Changed values update in place

- GIVEN a stored class (MAT101, "1") with `HorasTotales` 64
- WHEN a workbook carries (MAT101, "1") with 80
- THEN the same row now has 80 and no second row exists

#### Scenario: Docente reassignment

- GIVEN a stored class taught by docente D1
- WHEN the workbook lists the same class with docente D2
- THEN the class is updated to D2 and counted as `update`

#### Scenario: Manually deactivated class is reactivated

- GIVEN (MAT101, "1") deactivated manually and a workbook with it unchanged
- WHEN applied
- THEN it is active again, no second row exists and it is counted as `update`

#### Scenario: Manual class keeps its origin

- GIVEN a class created manually and a workbook listing it
- WHEN applied
- THEN it is updated if its values differ and its origin is still `manual`

#### Scenario: New group of an existing code does not touch the others

- GIVEN stored (MAT101, "1") and a workbook listing (MAT101, "1") unchanged and
  (MAT101, "2") new
- WHEN applied
- THEN (MAT101, "2") is created and (MAT101, "1") is `unchanged`

### Requirement: Deactivate absent, never delete

On apply, every active class row absent from the workbook MUST be set inactive
(`Activo` false), regardless of its origin and including every class of a code the
workbook does not mention (A5): the workbook is treated as the complete current
catalog. Manually created classes are NOT exempt. The import MUST NOT delete any
row of any entity. Rows for `Facultad`, `Carrera` and `Usuario` absent from the
workbook MUST be left as they are. A later import that includes a previously
deactivated class MUST reactivate it. Downstream readers (RF-31) consume only
active rows, per `academic-catalog`. `Inscripcion` is out of this import's scope
and is never written or deactivated by it; its own lifecycle is governed entirely
by `academic-catalog`.
(Previously: only `Grupo` rows were deactivated when absent; an absent `Asignatura`
was left as it was.)

#### Scenario: Absent class is deactivated

- GIVEN an active class (MAT101, "2") stored and a workbook that omits it
- WHEN applied
- THEN it is inactive and still stored

#### Scenario: Whole code absent

- GIVEN a code with three active classes and a workbook that does not mention it
- WHEN applied
- THEN the three classes are inactive and still stored

#### Scenario: Absent manual class is deactivated too

- GIVEN an active class with origin `manual` that the workbook omits
- WHEN applied
- THEN it is inactive, still stored, and the preview had counted it among the
  manual classes to be deactivated

#### Scenario: Corrected re-import reactivates

- GIVEN an inactive class
- WHEN a workbook containing it is applied
- THEN it is active again and counted as `update`

#### Scenario: Other entities are not deactivated

- GIVEN stored facultades, carreras and docente accounts
- WHEN a workbook omitting some of them is applied
- THEN they remain present and unchanged

#### Scenario: Nothing is ever deleted

- GIVEN any workbook, valid or not
- WHEN it is applied
- THEN the row count of every table is never lower afterwards

### Requirement: Import-level audit record

A successful apply MUST write exactly one import-level audit record, in the same
transaction as the import (per `audit-log`), with the shape defined in `audit-log`
("Import-level audit payload shape after the merge"): the actor, the SHA-256 hash
of the file, the per-entity counts of create, update, unchanged and deactivate for
`Asignatura` and `Usuario`, the count of accounts created and updated, the number
of inactive classes the apply reactivated, and the number of manually created
classes the apply deactivated. These are counts only, with no `Codigo`, group
number or other cell contents. It MUST NOT contain any password, password hash or
the file contents. The returned apply summary MUST carry the same figures. A
dry-run preview MUST write no audit record. A failed, invalid or aborted apply MUST
write no audit record. Besides this record, the apply writes one
`asignatura.reactivada` event per reactivated class (see `audit-log`) and MUST NOT
write any other `asignatura.*` or any `grupo.*` event.
(Previously: counts for `Asignatura`, `Usuario` and `Grupo`, a count of manually
created grupos deactivated, and one event per reactivated `Asignatura`.)

#### Scenario: Successful apply writes one import audit record

- GIVEN a valid workbook
- WHEN the apply succeeds
- THEN exactly one import-level audit record exists for it, with the actor, the
  file's SHA-256 hash and the per-entity counts equal to the returned summary
- AND its counts have no entry for `Grupo`

#### Scenario: Reactivation is counted in the record

- GIVEN an apply that reactivates 2 classes
- WHEN the import-level audit record is read
- THEN it carries the number 2 for reactivated classes
- AND two `asignatura.reactivada` events exist for it, one per reactivated class

#### Scenario: Manual classes deactivated are counted in the record

- GIVEN an apply that deactivates 5 classes, 2 of them with origin `manual`
- WHEN the import-level audit record and the returned summary are read
- THEN both carry 2 for manually created classes deactivated, and the
  `deactivate` count of `Asignatura` is 5

#### Scenario: Preview writes no audit record

- GIVEN a valid workbook
- WHEN it is only previewed
- THEN the audit log is unchanged

#### Scenario: Aborted apply writes no audit record

- GIVEN a workbook with at least one invalid row, or a write that fails
  mid-apply
- WHEN the apply runs and rolls back
- THEN no import-level audit record and no `asignatura.reactivada` event exists
  for it

#### Scenario: Idempotent re-import is still audited once

- GIVEN a workbook already applied successfully
- WHEN the same workbook is applied again
- THEN exactly one new import-level audit record is written, with zero creates,
  updates, deactivations and reactivations
- AND no `asignatura.reactivada` event is written

#### Scenario: Import audit payload has no secrets

- GIVEN an apply that created accounts
- WHEN the import-level audit record is inspected
- THEN it contains no temporary password, no password hash and no cell contents

### Requirement: Import UI flow and copy

The import page MUST present upload, then preview, then confirm, with all user
text available in Spanish and English catalogs. Taking a file (by drop or by the
file picker) MUST run the preview immediately; there is no separate submit
control for the upload. Row-level errors MUST be presented in their own block
before the preview, only when the analysed file has errors. A preview with errors
MUST offer no confirm control, and the preview is hidden while another file is
being analysed. The result screen MUST show the per-entity summary. After an apply
that created accounts, it MUST offer the temporary-credentials export defined in
`imported-account-provisioning`.

Before the file input, the upload step MUST display the workbook contract so
`secretaria` can prepare or check the file before selecting it: the two required
sheet names in order (Asignaturas, Docentes), each sheet's required and optional
columns from the sheet contract, and the validation rules that most commonly
reject a file: no `Id` column accepted (natural keys only); `Carrera` in
Asignaturas must already exist in the system; `HorasTotales` must be a positive
integer; `Grupo` is required and identifies the class together with `Codigo`; rows
of one `Codigo` must carry the same `Nombre`, `Carrera` and `HorasTotales`;
`CorreoDocente` is optional, must match a docente in the same workbook or already
in the system, and a blank cell removes the docente; a docente cannot teach two
groups of one code on a shared day; classes absent from the file are deactivated.
This is static copy, not derived from parsing an uploaded file.
(Previously: three sheets, the `Periodo` format rule and `CorreoDocente` as a
required column of `Grupos`.)

#### Scenario: Locales

- GIVEN the Spanish and English catalogs
- WHEN every import, template and error message key is compared
- THEN both catalogs contain the same keys

#### Scenario: Contract shown before upload

- GIVEN `secretaria` opens the import page
- WHEN the page renders, before any file is selected
- THEN the two sheet names, their required and optional columns, and the
  validation rules above are visible
- AND no `Grupos` sheet and no `Periodo` rule are mentioned

### Requirement: Import precedence over manual edits

When the import and manual management (`catalog-management`) have changed the same
row, the import MUST win: its apply writes exactly what it would write if no
manual change had happened, except as stated in the modified requirements. Manual
field edits on a class (name, hours, carrera, docente, and the meeting days when
the workbook has a `Dias` column and the cell is not empty, see CEI-DIAS-3) that
the apply overwrites MUST be overwritten silently, including a manual docente that
a blank `CorreoDocente` cell clears (A6); the system is not required to detect or
report them. This is an accepted residual and the preview copy MUST say that
manual edits can be replaced (see "Preview reports manual-group deactivations and
reactivations").
(Previously: the edits covered `Asignatura` name, hours and carrera and the
`Grupo` docente and days.)

#### Scenario: Manual edit is overwritten

- GIVEN a code whose `Nombre` was changed manually
- WHEN a workbook with the original `Nombre` is applied
- THEN the stored `Nombre` is the workbook's on every row of the code and the
  listed rows count as `update`
- AND no extra warning for that overwrite is produced

#### Scenario: Manual docente change is overwritten

- GIVEN a class whose docente was changed manually and a workbook listing another
  docente for it
- WHEN applied
- THEN the docente is the workbook's, counted as `update`

#### Scenario: Manual docente is cleared by a blank cell (A6)

- GIVEN a class whose docente was set manually and a workbook with a blank
  `CorreoDocente` for it
- WHEN applied
- THEN the class has no docente

### Requirement: Preview reports manual-group deactivations and reactivations

The dry-run report MUST state, as explicit figures, how many class rows it is
about to deactivate (A5) and how many of them were created manually (origin
`manual`, A3). When the manual figure is zero, no warning about manual classes is
shown. When it is above zero, a warning MUST be shown before confirmation that
states the count and that those classes were created by hand. When the
deactivation figure is above zero the report MUST say that classes absent from the
file are deactivated, that nothing is deleted and that a later import that lists
them reactivates them. The warning MUST NOT block confirmation. The preview copy
MUST also state that manual edits of the same records can be replaced by the
file's values. The same report MUST state, before confirmation, how many inactive
classes it is about to reactivate, as reactivations (not as plain updates), while
the `update` count of classes still includes them. Counts and warnings MUST match
what an apply of the same file against the same data would do. A preview writes
nothing.

On the import screen, row-level errors stay in their own block before the preview,
as defined for the import page. The new figures, the warning and the replaced-edit
statement belong to the preview, which holds the counts and, only when the file has
no row errors, the confirm control. The upload has no submit control: taking a file
runs the preview.
(Previously: the figures concerned `Grupo` rows and reactivated `Asignatura`
rows, and the deactivation of `Asignatura` rows did not exist.)

#### Scenario: Manual classes among deactivations

- GIVEN 5 active classes absent from the workbook, 2 of them with origin `manual`
- WHEN the workbook is previewed
- THEN the `deactivate` count is 5 and the report states that 2 of them were
  created manually

#### Scenario: Zero manual classes shows no warning (table-driven)

| Active classes to deactivate | Of those manual | Warning shown |
|---|---|---|
| 0 | 0 | no |
| 4 | 0 | no |
| 4 | 1 | yes, count 1 |
| 4 | 4 | yes, count 4 |

- GIVEN a database and workbook giving the row's figures
- WHEN previewed
- THEN the warning is as shown

#### Scenario: Deactivation count is stated

- GIVEN a workbook that omits 7 active classes
- WHEN previewed
- THEN the report states that 7 classes will be deactivated, that nothing is
  deleted and that a later import reactivates them

#### Scenario: Warning does not block confirmation

- GIVEN a file with no row errors whose preview shows the manual-classes warning
- WHEN the user looks for the confirm control in that preview
- THEN it is offered, and the warning does not replace or disable it

#### Scenario: Only classes that will be deactivated are counted

- GIVEN a manual class that is inactive, and a manual class present in the
  workbook
- WHEN previewed
- THEN neither is included in the manual-deactivation count

#### Scenario: Reactivation of a class is reported

- GIVEN a class (MAT101, "1") deactivated manually and a workbook declaring it
- WHEN previewed
- THEN the report states one class will be reactivated
- AND the `update` count of classes includes it

#### Scenario: Preview copy mentions replaced manual edits

- GIVEN any preview
- WHEN the report is displayed
- THEN the text states that manual edits of the same records may be replaced

#### Scenario: Preview still writes nothing

- GIVEN a preview that reports manual classes and reactivations
- WHEN it completes
- THEN no table, including the audit log, has changed

### Requirement: Copy for the new preview figures

All new text (the old-layout refusal, the subject-field disagreement and
docente-rule row reasons, the class-deactivation notice, the manual-class warning,
the reactivation notice, the replaced-edit statement, the apply-result lines for
reactivated and deactivated classes, the days contract lines, the `dias.invalid`
reason and the busy message) MUST exist in both `es` and `en` with identical keys,
and MUST say what will happen and that the user may cancel.
(Previously: the text concerned manual `Grupo` deactivations and reactivated
asignaturas, and the `asignatura.inactive` reason, which no longer exists.)

#### Scenario: Locale parity

- GIVEN the `es` and `en` catalogs
- WHEN their key sets are compared
- THEN they are identical, including the new import keys

### Requirement: Day tokens in the Dias cell (CEI-DIAS-2)

The `Dias` cell MUST be a list of day tokens separated by commas. Each token,
after trimming whitespace and ignoring case and accents (composed or decomposed),
MUST be exactly one of these, which are the only accepted tokens:

| Day | Full name | Abbreviation |
|---|---|---|
| Monday | `Lunes` | `Lun` |
| Tuesday | `Martes` | `Mar` |
| Wednesday | `Miércoles` | `Mié` |
| Thursday | `Jueves` | `Jue` |
| Friday | `Viernes` | `Vie` |
| Saturday | `Sábado` | `Sáb` |
| Sunday | `Domingo` | `Dom` |

The cell denotes a set: a day named twice, or once by its full name and once by
its abbreviation, counts once, and the order of tokens is irrelevant. An empty
segment between or after commas is ignored. A cell with no token denotes the empty
set, which on apply means "no change to the stored days" (see CEI-DIAS-3). Any
other token (English names, ranges such as `Lun-Vie`, other separators, numbers, or
any other text) MUST be a row-level error (see CEI-DIAS-3).
(Previously: identical rule, stated for the `Grupos` sheet.)

#### Scenario: Accepted spellings (table-driven)

| Cell | Resulting set |
|---|---|
| `Lunes, Miércoles` | Monday, Wednesday |
| `lun,MIE` | Monday, Wednesday |
| `miercoles ,  SABADO` | Wednesday, Saturday |
| `Vie,Lunes,vie` | Monday, Friday |
| `Lunes,,Martes,` | Monday, Tuesday |
| empty cell | empty set (stored days left untouched on apply) |

- GIVEN an `Asignaturas` row otherwise valid and the cell from the row
- WHEN it is planned
- THEN the row has the resulting set and no error

#### Scenario: Unrecognised tokens (table-driven)

| Cell |
|---|
| `Monday` |
| `Lunes;Martes` |
| `Lun-Vie` |
| `Lunes y Martes` |
| `Luness` |
| `1` |

- GIVEN an `Asignaturas` row otherwise valid and the cell from the row
- WHEN it is planned
- THEN the row is an error

### Requirement: Days semantics on apply (CEI-DIAS-3)

The meaning of the `Dias` column on apply MUST be (A7, the existing rule carried to
the class row):

- **Column absent from the workbook**: a matched class keeps its stored days
  untouched, and a created class gets the empty set.
- **Column present, non-empty cell**: the cell's set replaces the stored days of
  the matched class, and is the days of a created class. The import wins over
  manual days edits, consistent with "Import precedence over manual edits", and
  such an overwrite is silent.
- **Column present, empty cell** (no token, only blanks or separators): the stored
  days of a matched class MUST be left untouched; the import MUST NOT clear the
  days of an existing class, so days can only be set or replaced by import, never
  erased. A class created from such a row is created with the empty set. The
  preview MUST NOT report a days change for an empty cell.
- **Unrecognised token**: the row MUST be a row-level error with the reason code
  `dias.invalid`, naming the offending token. It is reported with the other errors,
  blocks confirmation and the apply like any other row error, and writes nothing.
- **Counting**: when the column is present and the cell is not empty, a row whose
  other values and whose set of days equal the stored ones MUST be counted as
  `unchanged` and not written. A row with a non-empty cell whose only difference
  is the set of days MUST be counted as `update`, in the preview and in the apply
  alike. When the column is absent, or the cell is empty, the days play no part in
  `unchanged` or `update`.
- **A class with no days** MAY be created by the import (A8); the manual form
  requires at least one day (see `catalog-management`).
- **Classes absent from the workbook** are deactivated (A5) and their days are not
  changed.
- The days that a class would have after the apply (the cell's set, or the stored
  days when kept) are the days used by the docente rule.
- An import MUST NOT write any per-record `asignatura.*` audit event because of
  the days, other than `asignatura.reactivada` for a reactivated class; they are
  covered by the import-level counts only.
(Previously: the same rules for `Grupos` rows and groups.)

#### Scenario: Column absent keeps stored days

- GIVEN a stored class meeting on Monday and Wednesday and a workbook with no
  `Dias` column that lists it with all other values equal
- WHEN applied
- THEN the class still meets on Monday and Wednesday and is counted `unchanged`

#### Scenario: Column absent creates classes without days

- GIVEN a workbook with no `Dias` column listing a new class
- WHEN applied
- THEN the class is created with the empty set of days

#### Scenario: Column present replaces the days

- GIVEN a stored class meeting on Monday and a workbook whose `Dias` cell for it
  is `Martes, Jueves`
- WHEN applied
- THEN the class meets on Tuesday and Thursday only

#### Scenario: Empty cell leaves the stored days untouched

- GIVEN a stored class meeting on Monday and a workbook with a `Dias` column
  whose cell for it is empty, and every other value of the row equal to the
  stored one
- WHEN previewed and applied
- THEN the class still meets on Monday and is counted `unchanged`
- AND the preview reports no days change for it

#### Scenario: Empty cell with another difference keeps the days

- GIVEN a stored class meeting on Monday and a workbook with a `Dias` column whose
  cell for it is empty and whose docente differs from the stored one
- WHEN applied
- THEN the docente is the workbook's, the row is counted `update`, and the class
  still meets on Monday

#### Scenario: Empty cell on a new class creates it without days

- GIVEN a workbook with a `Dias` column and a new class whose cell is empty
- WHEN applied
- THEN the class is created with the empty set of days

#### Scenario: Created class takes the days of the cell

- GIVEN a workbook with a `Dias` column and a new class whose cell is `Lun, Vie`
- WHEN applied
- THEN the class is created meeting on Monday and Friday

#### Scenario: Invalid token blocks everything

- GIVEN a workbook with 200 valid rows and an `Asignaturas` row 9 whose `Dias`
  cell is `Lunes, Funday`
- WHEN it is previewed and then confirmed
- THEN the report has one error for `Asignaturas` row 9 with reason `dias.invalid`
  naming `Funday`
- AND no confirm control is offered and no row of the workbook is written

#### Scenario: A workbook that changes only days

- GIVEN stored data equal to a workbook in every value except that one class's
  `Dias` cell differs
- WHEN previewed and applied
- THEN the report and the summary show exactly one `update` for classes and no
  create, no deactivate and no new account
- AND the import-level audit record counts that one update and no per-record
  `asignatura.*` event exists

#### Scenario: Same set in another spelling is unchanged

- GIVEN a class stored with Monday and Wednesday and a workbook whose cell is
  `mie, Lunes`
- WHEN previewed
- THEN the row is counted `unchanged`

#### Scenario: Manual days edit is overwritten only when the column is present

- GIVEN a class whose days were changed manually
- WHEN a workbook with the `Dias` column and a non-empty cell, a workbook with the
  column and an empty cell, and a workbook without the column are applied to
  copies of the same data
- THEN the first replaces the manual days with the workbook's, and the second and
  the third leave the manual days unchanged

#### Scenario: Idempotent re-import with the column

- GIVEN a workbook with a `Dias` column already applied successfully
- WHEN the same workbook is applied again
- THEN every entity reports `unchanged` only

#### Scenario: Absent and reactivated classes

- GIVEN an active class with days that the workbook omits, and an inactive class
  that the workbook lists with a non-empty `Dias` cell
- WHEN applied
- THEN the omitted class is inactive with its days unchanged
- AND the listed class is active with the days of its cell

### Requirement: Template and contract document the days column (CEI-DIAS-4)

The downloadable template MUST include the `Dias` column in its `Asignaturas`
sheet, and its header row MUST still be exactly the columns the importer accepts.
The template, when uploaded unchanged, MUST still parse with zero rows and zero
errors. The contract shown on the import page before upload MUST list `Dias` as an
optional column of `Asignaturas` and state, in static copy, that it takes the day
names or abbreviations from "Day tokens in the Dias cell (CEI-DIAS-2)" separated by
commas, that leaving the column out keeps the stored days, that a non-empty cell
replaces the stored days, and that an empty cell leaves them untouched (the import
never clears days). All new text (the contract lines, the `dias.invalid` reason,
and any template note) MUST exist in both `es` and `en` with identical keys.
(Previously: the column belonged to the `Grupos` sheet.)

#### Scenario: Template includes the column

- GIVEN an authenticated `secretaria`
- WHEN they download the template
- THEN its `Asignaturas` sheet header contains `Dias` and the file, uploaded
  unchanged, parses with zero rows and zero errors

#### Scenario: Contract mentions the column

- GIVEN `secretaria` opens the import page
- WHEN the page renders before any file is selected
- THEN `Dias` appears among the optional `Asignaturas` columns with the rule on
  days and what an absent column or an empty cell does

#### Scenario: Locale parity

- GIVEN the `es` and `en` catalogs
- WHEN their key sets are compared
- THEN they are identical, including the days contract and `dias.invalid` keys

## REMOVED Requirements

### Requirement: Grupos sheet accepts an optional days column (CEI-DIAS-1)

(Reason: the `Grupos` sheet no longer exists; the days are a column of
`Asignaturas`.)
(Migration: replaced by "Asignaturas sheet accepts an optional days column
(CEI-DIAS-1)", which keeps the same id and the same optional-column semantics.)

## Spec-level assumptions

- **S3.** When rows of one code disagree on a subject field, every row of that code
  is an error (not only the rows that differ from the first).
- **S4.** An absent `CorreoDocente` column keeps the stored docente, by symmetry
  with the absent `Dias` column (A7). The proposal fixes only the blank cell (A6).
- **A5 (unconfirmed).** The workbook is the complete current catalog. With A5, the
  only classes active after an apply are the workbook's, so the docente rule can
  only be violated between workbook rows; the requirement is still written over
  "every row active afterwards" so that it stays correct if A5 becomes an opt-in.
- **A6, A7, A8 (unconfirmed, A7 and A8 carry existing rules).** See the
  requirements that cite them.

## Open questions for design

1. Header of the group-number column: `Grupo` (this spec, from the proposal) versus
   `NumGrupo` (today's sheet header, frozen against the sample workbook).
2. How the old layout is recognised: a `Grupos` sheet present, a missing `Grupo`
   column, or both (proposal question 9). A workbook with the new `Asignaturas`
   sheet and a stray `Grupos` sheet is not decided here.
3. How rows of a code that are only touched by propagation (not listed in the
   workbook, still active or already inactive) are counted in the preview and the
   apply; the two MUST agree.
4. The apply order that satisfies the non-deferrable indexes (proposal question
   12): deactivate and clear before assigning, or another order.
5. Reason codes for the new row errors (subject-field disagreement, docente-rule
   conflict, old layout), and whether the docente-rule error is reported once per
   pair or once per row.
6. Whether the `Docentes` sheet and the credentials export are affected by a class
   referencing a docente declared only in the same workbook (no change intended).
7. Owner questions still open: 6 (confirm A6), and A5 itself, because it widens
   deactivation from groups to whole subjects.
