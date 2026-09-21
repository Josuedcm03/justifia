# Catalog Excel Import Specification

## Purpose

Secretaría loads and maintains the academic catalog (facultades, carreras,
asignaturas, docentes, estudiantes, grupos, inscripciones) by uploading one
multi-sheet `.xlsx` workbook (RF-35). The flow is stateless and two-step: an
upload produces a dry-run report and persists nothing; confirming re-uploads the
file, which is re-parsed and re-planned before an all-or-nothing apply. No
external integration is involved (RNF-10). The scope is institution-wide.

Sheets, in dependency order:

| Order | Sheet | Natural key |
|---|---|---|
| 1 | Facultades | `Facultad.Nombre` |
| 2 | Carreras | `Carrera.Nombre` |
| 3 | Asignaturas | `Asignatura.Codigo` |
| 4 | Docentes | `Usuario.Correo` |
| 5 | Estudiantes | `Usuario.Cif` |
| 6 | Grupos | (`Asignatura`, `Periodo`, `NumeroGrupo`) |
| 7 | Inscripciones | (`Estudiante`, `Grupo`) |

Entity rules live in `academic-catalog`; account creation in
`imported-account-provisioning`. "Denied" is as defined in the
`staff-account-creation` and `permission-denied-screen` capabilities: an
unauthenticated caller is sent to login, an authenticated caller who is refused
is redirected to the permission-denied screen.

## Requirements

### Requirement: Only secretaria may import

The right to import MUST be a single predicate `canImportCatalog(rol)` that is
true if and only if `canAssignRole(rol, "docente")` is true, which today means
only `secretaria`. It MUST be derived from that predicate, not from a separate
role list. It MUST be enforced on the server on the import page, the preview
action, the apply action and the template route handler, independently of the
sidebar. The sidebar item MUST be present only when the predicate is true.

#### Scenario: Predicate per role (table-driven)

| Role | canImportCatalog |
|---|---|
| `secretaria` | true |
| `administrador`, `coordinacion`, `docente`, `estudiante` | false |
| undefined / unknown | false |

- GIVEN the role from the row
- WHEN the predicate is evaluated
- THEN it returns the value in the row

#### Scenario: Secretaria opens the page

- GIVEN an authenticated `secretaria`
- WHEN they request the import page
- THEN the upload form is rendered and the sidebar shows the import item

#### Scenario: Other roles are denied on every entry point (table-driven)

| Entry point |
|---|
| import page |
| preview action |
| apply action |
| template download route |

- GIVEN an authenticated `administrador`, `coordinacion`, `docente` or `estudiante`
- WHEN they invoke the entry point from the row, including with a hand-crafted
  request
- THEN nothing is parsed, planned or written, and no template bytes are returned
- AND they are redirected to the permission-denied screen

#### Scenario: Unauthenticated caller

- GIVEN no session
- WHEN the caller invokes any entry point above
- THEN they are sent to login and nothing is parsed or returned

### Requirement: Authorization precedes reading the request body

Both actions MUST verify authentication and `canImportCatalog` before reading the
`FormData` or the uploaded file. A denied caller MUST cause no file access, no
parsing and no write.

#### Scenario: Denied caller's file is never read

- GIVEN a `docente` submitting a valid workbook to either action
- WHEN the action runs
- THEN the file is not read or parsed
- AND the caller is redirected to the permission-denied screen

### Requirement: Template download

The system MUST offer a template `.xlsx` at a role-guarded route. It MUST contain
the seven sheets of the Purpose table, in that order, each with its header row.
Its column names MUST be the ones the importer accepts.

#### Scenario: Secretaria downloads the template

- GIVEN an authenticated `secretaria`
- WHEN they request the template
- THEN they receive a valid `.xlsx` whose sheets, in order, are the seven listed
- AND the file, when uploaded unchanged, parses with zero rows and zero errors

#### Scenario: Denied roles get no template

- GIVEN any non-`secretaria` caller
- WHEN they request the template route
- THEN no file is returned and they are denied

### Requirement: File guards

Before any parsing, the import MUST reject a file that fails any of these, with a
clear user-facing message and no write:

- the file name does not end in `.xlsx` (case-insensitive);
- the first bytes are not the ZIP signature `PK`;
- the size exceeds the configured maximum;
- no file was provided, or it is empty.

While parsing, it MUST reject a workbook that exceeds the configured maximum row
count as a validation error (not a timeout), MUST fail cleanly on a malformed or
corrupt workbook, and MUST NOT evaluate formulas: a formula cell is read as its
stored value or rejected, and is never executed. Parsing MUST occur on the server
only. The server-action body-size limit MUST be raised only as far as the
configured maximum requires.

#### Scenario: Rejected uploads (table-driven)

| Upload | Message concerns |
|---|---|
| `catalog.xls` (legacy) | unsupported type |
| `catalog.csv` | unsupported type |
| `catalog.xlsx` whose bytes are plain text | not a valid workbook |
| `catalog.xlsx` larger than the size cap | file too large |
| empty file | no file / empty |
| corrupt zip named `.xlsx` | not a valid workbook |
| workbook with rows above the row cap | too many rows |

- GIVEN an authenticated `secretaria`
- WHEN they submit the upload from the row
- THEN a clear error is shown, nothing is persisted, and no plan is produced

#### Scenario: Extension check is case-insensitive

- GIVEN a valid workbook named `CATALOG.XLSX`
- WHEN it is uploaded
- THEN it passes the extension guard

#### Scenario: Formulas are never executed

- GIVEN a workbook with a formula cell in a required column
- WHEN it is parsed
- THEN no formula is evaluated and the cell is read as its cached value or
  reported as a row error

#### Scenario: Missing or renamed sheet or header

- GIVEN a workbook lacking a required sheet or a required header column
- WHEN it is uploaded
- THEN a structural error names the missing sheet or column and nothing is
  planned

### Requirement: Per-row validation with row-level errors

Every sheet MUST be validated row by row. Each failing row MUST produce an error
carrying at least the sheet name, the row number and a reason. The report MUST
list all errors found, not only the first. Validation covers at least:
required fields present; `Periodo` format (`YYYY-S1|S2`); `HorasTotales`
integer greater than zero; email syntax for docentes; references resolving to a
row in the workbook or an existing catalog row; docente references resolving to
a docente and estudiante references to an estudiante; duplicate natural keys
within one sheet.

#### Scenario: Invalid rows are reported with location

- GIVEN a workbook where Grupos row 4 has period `2026-S3` and Asignaturas row 7
  has `HorasTotales` 0
- WHEN it is planned
- THEN the report contains one error for Grupos row 4 and one for Asignaturas
  row 7, each with a reason

#### Scenario: HorasTotales missing is a row error

- GIVEN an Asignaturas row without `HorasTotales`
- WHEN it is planned
- THEN that row is an error and no default is applied

#### Scenario: Unresolvable reference

- GIVEN a Grupos row whose asignatura code is in neither the workbook nor the
  database
- WHEN it is planned
- THEN that row is an error naming the reference

#### Scenario: Role integrity violations

- GIVEN a Grupos row whose docente email belongs to an existing non-docente user,
  and an Inscripciones row whose student is an existing non-estudiante user
- WHEN it is planned
- THEN both rows are errors and neither is applicable

#### Scenario: Duplicate key inside one sheet

- GIVEN two Asignaturas rows with the same `Codigo`
- WHEN it is planned
- THEN the duplicate is reported as a row error

#### Scenario: References across sheets in one workbook

- GIVEN a new carrera, a new asignatura of that carrera and a new grupo of that
  asignatura, all in the same workbook and none in the database
- WHEN it is planned
- THEN all three are valid creates

### Requirement: Dry-run report persists nothing

The preview MUST return a report with, per entity, the counts of `create`,
`update`, `unchanged`, `deactivate` and `error`, plus the row-level errors, and
for accounts the count that would be created. It MUST NOT write to the database,
create accounts, generate credentials to persist, or store the file.

#### Scenario: Preview leaves the database untouched

- GIVEN a valid workbook
- WHEN the secretaria previews it
- THEN the report shows the counts
- AND the number of rows in every table is unchanged afterwards

#### Scenario: Deactivations are explicit in the report

- GIVEN a database with grupos that the workbook omits
- WHEN it is previewed
- THEN the report shows a non-zero `deactivate` count for grupos and, separately,
  for inscripciones

#### Scenario: Preview with errors blocks confirmation

- GIVEN a workbook with at least one row error
- WHEN it is previewed
- THEN the report lists the errors and the UI does not offer confirmation

### Requirement: Stateless confirm re-parses and re-plans

Confirming MUST re-upload the file, re-run guards, parsing and planning, and
apply only that fresh plan. The server MUST NOT rely on any state kept from the
preview (no draft, no temp file, no cached plan).

#### Scenario: Database changed between preview and confirm

- GIVEN a preview showing a row as `create`
- WHEN another change makes that row exist before confirmation
- THEN the apply plans it as `update` or `unchanged`, based on the current
  database, and does not duplicate it

#### Scenario: Confirm with a different file

- GIVEN a preview of file A
- WHEN the user confirms by uploading file B
- THEN file B is validated and planned on its own and file A has no effect

### Requirement: All-or-nothing apply

The apply MUST run in a single database transaction. If any row is invalid, or
any write fails, the entire apply MUST roll back and leave the database and all
accounts exactly as before, and no credentials MUST be returned. There is no
partial-apply mode.

#### Scenario: One invalid row aborts everything

- GIVEN a workbook with 200 valid rows and 1 invalid row
- WHEN the secretaria confirms
- THEN nothing is written, no account is created and the errors are reported

#### Scenario: A failure mid-apply rolls back

- GIVEN a valid workbook and a write that fails after some rows were written
- WHEN the apply runs
- THEN every earlier write in that apply is rolled back
- AND no temporary passwords are returned

#### Scenario: Successful apply returns a summary

- GIVEN a valid workbook
- WHEN the apply succeeds
- THEN the result contains the actor, a timestamp, the SHA-256 hash of the file
  and per-entity counts of create, update, unchanged and deactivate
- AND a structured server log line records the same summary without any password
  or password hash

### Requirement: Import-level audit record

A successful apply MUST write exactly one import-level audit record, in the same
transaction as the import (per `audit-log`), carrying the actor, the SHA-256 hash
of the file and the per-entity counts of create, update, unchanged and
deactivate. It MUST NOT contain any password, password hash or the file contents.
A dry-run preview MUST write no audit record. A failed, invalid or aborted apply
MUST write no audit record.

#### Scenario: Successful apply writes one import audit record

- GIVEN a valid workbook
- WHEN the apply succeeds
- THEN exactly one import-level audit record exists for it, with the actor, the
  file's SHA-256 hash and the per-entity counts equal to the returned summary

#### Scenario: Preview writes no audit record

- GIVEN a valid workbook
- WHEN it is only previewed
- THEN the audit log is unchanged

#### Scenario: Aborted apply writes no audit record

- GIVEN a workbook with at least one invalid row, or a write that fails
  mid-apply
- WHEN the apply runs and rolls back
- THEN no import-level audit record exists for it

#### Scenario: Idempotent re-import is still audited once

- GIVEN a workbook already applied successfully
- WHEN the same workbook is applied again
- THEN exactly one new import-level audit record is written, with zero creates,
  updates and deactivations

#### Scenario: Import audit payload has no secrets

- GIVEN an apply that created accounts
- WHEN the import-level audit record is inspected
- THEN it contains no temporary password, no password hash and no cell contents

### Requirement: Natural-key upserts

Rows MUST be matched by natural key: `Facultad.Nombre`, `Carrera.Nombre`,
`Asignatura.Codigo`, grupo (`Asignatura`, `Periodo`, `NumeroGrupo`), inscripcion
(`Estudiante`, `Grupo`), docente `Usuario.Correo`, estudiante `Usuario.Cif`. A
matching row MUST be updated in place, never duplicated; a non-matching row MUST
be created. A row whose non-key values equal the stored values MUST be counted as
`unchanged` and MUST NOT be written.

#### Scenario: New rows are created

- GIVEN an empty catalog
- WHEN a valid workbook is applied
- THEN each row is created exactly once

#### Scenario: Changed values update in place

- GIVEN an existing asignatura "MAT101" with `HorasTotales` 64
- WHEN a workbook carries "MAT101" with 80
- THEN the same row now has 80 and no second row exists

#### Scenario: Docente reassignment

- GIVEN an existing grupo taught by docente D1
- WHEN the workbook lists the same grupo with docente D2
- THEN the grupo is updated to D2 and counted as `update`

### Requirement: Idempotent re-import

Applying the same workbook a second time, with no other database change, MUST
yield only `unchanged` results: zero creates, zero updates, zero deactivations,
zero new accounts and no temporary passwords.

#### Scenario: Second identical import is a no-op

- GIVEN a workbook already applied successfully
- WHEN the same workbook is previewed and then applied again
- THEN every entity reports `unchanged` only
- AND row counts of every catalog and user table, passwords and
  `DebeCambiarClave` values are unchanged (only the audit log gains its
  import-level record)

### Requirement: Deactivate absent, never delete

On apply, active `Grupo` and `Inscripcion` rows absent from the workbook MUST be
set inactive (`Activo` false). The import MUST NOT delete any row of any entity.
Rows for `Facultad`, `Carrera` and `Asignatura` absent from the workbook MUST be
left as they are. A later import that includes a previously deactivated row MUST
reactivate it. Downstream readers (RF-31) consume only active rows, per
`academic-catalog`.

#### Scenario: Absent grupo is deactivated

- GIVEN active grupo G stored and a workbook that omits it
- WHEN applied
- THEN G is inactive and still stored

#### Scenario: Absent inscripcion is deactivated

- GIVEN an active inscripcion and a workbook that omits it
- WHEN applied
- THEN it is inactive, still stored, and enrollment verification no longer finds
  it

#### Scenario: Corrected re-import reactivates

- GIVEN an inactive grupo and inscripcion
- WHEN a workbook containing them is applied
- THEN both are active again and are counted as `update`

#### Scenario: Catalog parents are not deactivated

- GIVEN stored facultades, carreras and asignaturas
- WHEN a workbook omitting some of them is applied
- THEN they remain present and unchanged

#### Scenario: Nothing is ever deleted

- GIVEN any workbook, valid or not
- WHEN it is applied
- THEN the row count of every table is never lower afterwards

### Requirement: Import UI flow and copy

The import page MUST present upload, then preview, then confirm, with all user
text available in Spanish and English catalogs. The result screen MUST show the
per-entity summary. After an apply that created accounts, it MUST offer the
temporary-credentials export defined in `imported-account-provisioning`.

#### Scenario: Locales

- GIVEN the Spanish and English catalogs
- WHEN every import, template and error message key is compared
- THEN both catalogs contain the same keys

## Assumptions and open questions

- Assumption (from proposal): institution-wide scope, one multi-sheet workbook,
  all-or-nothing, stateless two-step flow, and period format `YYYY-S1|S2` only
  (defaults 1-4, 6, 11).
- Assumption (user decision, supersedes the proposal's deferral): the append-only
  audit log (RNF-02) is in scope, limited to WRITE events, and is specified in
  `audit-log`. Read-access auditing is deferred. The audit record is the only
  persisted import history; the uploaded file itself is never stored.
- Assumption: the import-level record is written even when an apply changes
  nothing (idempotent re-import), since it records that the import was run.
- Assumption: row-level catalog writes (facultad, carrera, asignatura, grupo,
  inscripcion) are covered by the import-level counts; per-row audit records are
  required only for accounts (`imported-account-provisioning`).
- Assumption: maintenance is re-import only; there is no per-record CRUD
  (default 5).
- Assumption: exact sheet and column names, size cap and row cap are fixed at
  design, from a real sample workbook. Scenarios reference "the configured
  maximum".
- Assumption: the spreadsheet library is a design choice; the spec constrains
  only behavior (guards, no formula evaluation, server-side).
- Assumption: a docente row whose email matches an existing user of another role
  is a row error, never a role change.
- Assumption: the "Inscripciones" sheet references estudiantes by `Cif` and
  grupos by (`Asignatura` code, `Periodo`, `NumeroGrupo`).
