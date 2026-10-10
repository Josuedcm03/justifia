# Catalog Excel Import Specification

## Purpose

Secretaría loads and maintains the actually-bulk-maintained part of the academic
catalog (asignaturas, docentes, grupos) by uploading one multi-sheet `.xlsx`
workbook (RF-35). **Scope reduction (product-owner decision)**: the workbook
covers only these three sheets. `Facultad` and `Carrera` are a small,
rarely-changing catalog loaded by a one-off seed outside this feature (a future,
separate admin screen will let them be CRUD'd); the import never creates or
touches a `Facultad`/`Carrera` row. `Estudiante` accounts and `Inscripcion`
enrollments are **not** bulk-imported at all — secretaría MUST NOT create
student accounts, and enrollment tracking is not this feature's goal. The flow
is stateless and two-step: an upload produces a dry-run report and persists
nothing; confirming re-uploads the file, which is re-parsed and re-planned
before an all-or-nothing apply. No external integration is involved (RNF-10).
The scope is institution-wide.

Sheets, in dependency order:

| Order | Sheet | Natural key |
|---|---|---|
| 1 | Asignaturas | `Asignatura.Codigo` |
| 2 | Docentes | `Usuario.Correo` |
| 3 | Grupos | (`Asignatura`, `Periodo`, `NumeroGrupo`) |

An Asignaturas row's `Carrera` column MUST resolve, by name, to a `Carrera`
that already exists in the database; the import never creates a `Facultad` or
`Carrera` row. An unresolved `Carrera` is a row-level error, the same shape as
any other unresolved natural-key reference in this specification (for example
an unresolved docente reference in Grupos).

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
sidebar. The import entry MUST be a child of the collapsible "Administración"
sidebar group and MUST be present only when the predicate is true. The group
itself is rendered only when at least one of its children is visible, so other
staff roles MAY still see the group because of its other child (the users
entry), but never the import entry.

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
- THEN the contract card containing the file dropzone is rendered
- AND the sidebar shows the import entry inside the "Administración" group

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
the three sheets of the Purpose table, in that order, each with its header row.
Its column names MUST be the ones the importer accepts.

#### Scenario: Secretaria downloads the template

- GIVEN an authenticated `secretaria`
- WHEN they request the template
- THEN they receive a valid `.xlsx` whose sheets, in order, are the three listed
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
- WHEN they drop or pick the file from the row
- THEN a clear error is shown, nothing is persisted, and no plan is produced
- AND an obviously invalid name or size MAY be rejected client-side before any
  request, the server guards remaining the authority

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
row in the workbook or an existing catalog row (including an Asignaturas row's
`Carrera`, which MUST resolve to an existing `Carrera`); docente references
resolving to a docente; duplicate natural keys within one sheet. A Grupos row
whose Asignatura is not declared in the workbook's Asignaturas sheet and is
**inactive** in the database MUST be a row-level error with the reason code
`asignatura.inactive`, naming the Asignatura (its `Codigo`); the import
reactivates only Asignaturas the workbook declares.
A Grupos row whose Asignatura is declared in the workbook MUST NOT be an error
on account of that Asignatura being inactive in the database (the declared
Asignatura is reactivated, see "Natural-key upserts").

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

#### Scenario: Unresolvable reference (table-driven)

| Sheet | Unresolvable reference |
|---|---|
| Asignaturas | `Carrera` name matches no existing carrera |
| Grupos | asignatura code is in neither the workbook nor the database |
| Grupos | asignatura code is only in the database and that asignatura is inactive |

- GIVEN a row with the unresolvable reference from the row
- WHEN it is planned
- THEN that row is an error naming the reference (for the last row, naming the
  Asignatura code)

#### Scenario: Inactive Asignatura outside the workbook (assumption)

- GIVEN an inactive Asignatura "FIS200" in the database, not in the workbook's
  Asignaturas sheet, and a Grupos row for "FIS200"
- WHEN it is planned
- THEN that row is an error with reason `asignatura.inactive` naming "FIS200"
  and "FIS200" is not reactivated

#### Scenario: Inactive Asignatura declared in the workbook is not an error

- GIVEN an inactive Asignatura "MAT101" in the database and a workbook that
  declares "MAT101" in Asignaturas and uses it in Grupos
- WHEN it is planned
- THEN no row is an error on account of the inactive state

#### Scenario: Role integrity violations

- GIVEN a Grupos row whose docente email belongs to an existing non-docente user
- WHEN it is planned
- THEN the row is an error and the grupo is not applicable

#### Scenario: Duplicate key inside one sheet

- GIVEN two Asignaturas rows with the same `Codigo`
- WHEN it is planned
- THEN the duplicate is reported as a row error

#### Scenario: References across sheets in one workbook

- GIVEN an existing carrera, a new asignatura of that carrera and a new grupo of
  that asignatura, all in the same workbook and none in the database except the
  carrera
- WHEN it is planned
- THEN the asignatura and the grupo are valid creates

### Requirement: Dry-run report persists nothing

The preview MUST return a report with, per entity, the counts of `create`,
`update`, `unchanged`, `deactivate` and `error`, plus the row-level errors, and
for accounts the count that would be created, and MUST include the
manual-group and reactivation figures defined in "Preview reports manual-group
deactivations and reactivations". It MUST NOT write to the database, create
accounts, generate credentials to persist, or store the file.

#### Scenario: Preview leaves the database untouched

- GIVEN a valid workbook
- WHEN the secretaria previews it
- THEN the report shows the counts
- AND the number of rows in every table is unchanged afterwards

#### Scenario: Deactivations are explicit in the report

- GIVEN a database with grupos that the workbook omits
- WHEN it is previewed
- THEN the report shows a non-zero `deactivate` count for grupos

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
deactivate. It MUST also carry two further counts, so that the losing side of
the precedence rule stays visible after the preview is gone: the number of
inactive asignaturas the apply reactivated, and the number of manually created
grupos the apply deactivated. These are counts only, with no `Codigo` or other
cell contents. It MUST NOT contain any password, password hash or the file
contents. The returned apply summary MUST carry the same two counts. A dry-run
preview MUST write no audit record. A failed, invalid or aborted apply MUST
write no audit record. Besides this record, the apply writes one
`asignatura.reactivada` event per reactivated Asignatura (see `audit-log`:
origin `importacion`, file digest) and MUST NOT write any other `asignatura.*`
or `grupo.*` audit event.

#### Scenario: Successful apply writes one import audit record

- GIVEN a valid workbook
- WHEN the apply succeeds
- THEN exactly one import-level audit record exists for it, with the actor, the
  file's SHA-256 hash and the per-entity counts equal to the returned summary

#### Scenario: Reactivation is counted in the record

- GIVEN an apply that reactivates 2 asignaturas
- WHEN the import-level audit record is read
- THEN it carries the number 2 for reactivated asignaturas
- AND two `asignatura.reactivada` events exist for it, one per reactivated
  Asignatura

#### Scenario: Manual groups deactivated are counted in the record

- GIVEN an apply that deactivates 5 grupos, 2 of them with origin `manual`
- WHEN the import-level audit record and the returned summary are read
- THEN both carry 2 for manually created grupos deactivated, and the
  `deactivate` count of grupos is 5

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

### Requirement: Natural-key upserts

Rows MUST be matched by natural key: `Asignatura.Codigo`, grupo (`Asignatura`,
`Periodo`, `NumeroGrupo`), docente `Usuario.Correo`. A matching row MUST be
updated in place, never duplicated; a non-matching row MUST be created. A row
whose non-key values equal the stored values MUST be counted as `unchanged` and
MUST NOT be written. An Asignaturas row matching an **inactive** `Asignatura`
MUST reactivate it (`Activo` true) and MUST be counted as `update` even when
name, carrera and hours equal the stored values. A Grupo created by the import
MUST get origin `importacion`; a Grupo updated by the import keeps its existing
origin. `Facultad` and `Carrera` have no upsert key here because the
import never writes them — an Asignatura's `Carrera` is resolved by name against
existing rows only.

#### Scenario: New rows are created

- GIVEN an empty catalog
- WHEN a valid workbook is applied
- THEN each row is created exactly once
- AND each created grupo has origin `importacion`

#### Scenario: Changed values update in place

- GIVEN an existing asignatura "MAT101" with `HorasTotales` 64
- WHEN a workbook carries "MAT101" with 80
- THEN the same row now has 80 and no second row exists

#### Scenario: Docente reassignment

- GIVEN an existing grupo taught by docente D1
- WHEN the workbook lists the same grupo with docente D2
- THEN the grupo is updated to D2 and counted as `update`

#### Scenario: Manually deactivated Asignatura is reactivated

- GIVEN "MAT101" deactivated manually and a workbook with "MAT101" unchanged
- WHEN applied
- THEN "MAT101" is active again, no second row exists and it is counted as
  `update`

#### Scenario: Reactivation does not reactivate its grupos by itself

- GIVEN "MAT101" inactive with inactive grupos not in the workbook
- WHEN a workbook declaring "MAT101" is applied
- THEN the Asignatura is active and those grupos stay inactive

#### Scenario: Manual group keeps its origin

- GIVEN a grupo created manually and a workbook listing it
- WHEN applied
- THEN the grupo is updated if its values differ and its origin is still
  `manual`

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

On apply, active `Grupo` rows absent from the workbook MUST be set inactive
(`Activo` false), regardless of their origin: manually created groups are NOT
exempt. The import MUST NOT delete any row of any entity. Rows for `Facultad`,
`Carrera` and `Asignatura` absent from the workbook MUST be left as they are
(an absent `Asignatura` is never deactivated nor reactivated by the import). A
later import that includes a previously deactivated grupo MUST reactivate it.
Downstream readers (RF-31) consume only active rows, per `academic-catalog`.
`Inscripcion` is out of this import's scope (scope
reduction) and is never written or deactivated by it; its own lifecycle is governed entirely by
`academic-catalog`.

#### Scenario: Absent grupo is deactivated

- GIVEN active grupo G stored and a workbook that omits it
- WHEN applied
- THEN G is inactive and still stored

#### Scenario: Absent manual grupo is deactivated too

- GIVEN an active grupo with origin `manual` that the workbook omits
- WHEN applied
- THEN it is inactive, still stored, and the preview had counted it among the
  manual groups to be deactivated

#### Scenario: Corrected re-import reactivates

- GIVEN an inactive grupo
- WHEN a workbook containing it is applied
- THEN it is active again and counted as `update`

#### Scenario: Catalog parents are not deactivated

- GIVEN stored facultades, carreras and asignaturas
- WHEN a workbook omitting some of them is applied
- THEN they remain present and unchanged, including their `Activo` state

#### Scenario: Nothing is ever deleted

- GIVEN any workbook, valid or not
- WHEN it is applied
- THEN the row count of every table is never lower afterwards

### Requirement: Import UI flow and copy

The import page MUST present upload, then preview, then confirm, with all user
text available in Spanish and English catalogs. Taking a file (by drop or by the
file picker) MUST run the preview immediately; there is no separate submit
control for the upload. Row-level errors MUST be presented in their own block
before the preview, only when the analysed file has errors. A preview with
errors MUST offer no confirm control, and the preview is hidden while another
file is being analysed. The result screen MUST show the
per-entity summary. After an apply that created accounts, it MUST offer the
temporary-credentials export defined in `imported-account-provisioning`.

Before the file input, the upload step MUST display the workbook contract so
`secretaria` can prepare or check the file before selecting it: the three
required sheet names in order (Asignaturas, Docentes, Grupos), each sheet's
required and optional columns from `SHEETS`, and the validation rules that
most commonly reject a file — no `Id` column accepted (natural keys only),
`Carrera` in Asignaturas must already exist in the system, `HorasTotales` must
be a positive integer, `Periodo` must match `YYYY-S1`/`YYYY-S2`, and
`CorreoDocente` in Grupos must match a docente in the same workbook or already
in the system. This is static copy, not derived from parsing an uploaded file.

#### Scenario: Locales

- GIVEN the Spanish and English catalogs
- WHEN every import, template and error message key is compared
- THEN both catalogs contain the same keys

#### Scenario: Contract shown before upload

- GIVEN `secretaria` opens the import page
- WHEN the page renders, before any file is selected
- THEN the three sheet names, their required/optional columns, and the
  validation rules above are visible

### Requirement: Import precedence over manual edits

When the import and manual management (`catalog-management`) have changed the
same row, the import MUST win: its apply writes exactly what it would write if
no manual change had happened, except as stated in the modified requirements
below. Manual field edits on `Asignatura` (name, hours, carrera) and on `Grupo`
(docente, and the meeting days when the workbook has a `Dias` column and the
cell is not empty, see "Days semantics on apply") that the apply overwrites MUST be overwritten silently; the
system is not required to detect or report them. This is an accepted residual
and the preview copy MUST say that manual edits can be replaced (see "Preview
reports manual-group deactivations and reactivations").

#### Scenario: Manual edit is overwritten

- GIVEN an Asignatura whose `Nombre` was changed manually
- WHEN a workbook with the original `Nombre` is applied
- THEN the stored `Nombre` is the workbook's and the row counts as `update`
- AND no extra warning for that overwrite is produced

#### Scenario: Manual docente change is overwritten

- GIVEN a Grupo whose docente was changed manually and a workbook listing
  another docente for it
- WHEN applied
- THEN the docente is the workbook's, counted as `update`

#### Scenario: Apply writes what it wrote before this change

- GIVEN a workbook with no manual groups to deactivate, no inactive
  asignatura declared and no `Dias` column
- WHEN applied before and after this change on the same data
- THEN the resulting rows and the per-entity counts are identical

### Requirement: Preview reports manual-group deactivations and reactivations

The dry-run report MUST state, as one explicit figure, how many of the grupos
it is about to deactivate were created manually (origin `manual`). When that
figure is zero, no warning is shown. When it is above zero, a warning MUST be
shown before confirmation that states the count and that those groups were
created by hand. The warning MUST NOT block confirmation. The preview copy MUST
also state that manual edits of the same records can be replaced by the file's
values. The same report MUST state, before confirmation, how many inactive
asignaturas it is about to reactivate, as reactivations (not as plain updates),
while the `update` count of asignaturas still includes them. It MAY also name
their `Codigo` values (the design carries the count only; see assumptions).
Counts and warnings MUST match
what an apply of the same file against the same data would do. A preview writes
nothing.

On the import screen, row-level errors (including `asignatura.inactive`) stay in
their own block before the preview, as defined for the import page. The new
figures, the warning and the replaced-edit statement belong to the preview,
which holds the counts and, only when the file has no row errors, the confirm
control. The upload has no submit control: taking a file runs the preview.

#### Scenario: Manual groups among deactivations

- GIVEN 5 active grupos absent from the workbook, 2 of them with origin `manual`
- WHEN the workbook is previewed
- THEN the `deactivate` count for grupos is 5 and the report states that 2 of
  them were created manually

#### Scenario: Zero manual groups shows no warning (table-driven)

| Active grupos to deactivate | Of those manual | Warning shown |
|---|---|---|
| 0 | 0 | no |
| 4 | 0 | no |
| 4 | 1 | yes, count 1 |
| 4 | 4 | yes, count 4 |

- GIVEN a database and workbook giving the row's figures
- WHEN previewed
- THEN the warning is as shown

#### Scenario: Warning does not block confirmation

- GIVEN a file with no row errors whose preview shows the manual-groups warning
- WHEN the user looks for the confirm control in that preview
- THEN it is offered, and the warning does not replace or disable it

#### Scenario: Only grupos that will be deactivated are counted

- GIVEN a manual group that is inactive, and a manual group present in the
  workbook
- WHEN previewed
- THEN neither is included in the manual-deactivation count

#### Scenario: Reactivation of an Asignatura is reported

- GIVEN an Asignatura "MAT101" deactivated manually and a workbook declaring it
- WHEN previewed
- THEN the report states one asignatura will be reactivated
- AND the `update` count of asignaturas includes it

#### Scenario: Preview copy mentions replaced manual edits

- GIVEN any preview
- WHEN the report is displayed
- THEN the text states that manual edits of the same records may be replaced

#### Scenario: Preview still writes nothing

- GIVEN a preview that reports manual groups and reactivations
- WHEN it completes
- THEN no table, including the audit log, has changed

### Requirement: Copy for the new preview figures

All new text (manual-group warning, reactivation notice, replaced-edit
statement, the apply-result lines for reactivated asignaturas and deactivated
manual grupos, the row-error reason `asignatura.inactive` and the busy
message) MUST exist in both `es` and `en` with identical keys, and MUST say
what will happen and that the user may cancel.

#### Scenario: Locale parity

- GIVEN the `es` and `en` catalogs
- WHEN their key sets are compared
- THEN they are identical, including the new import keys

### Requirement: Apply reports busy when it cannot start

The apply is serialised with manual catalog writes (see `catalog-management`,
CM-NFR-4), so that it plans from data no manual write can change before it
commits. When the apply cannot start within a bounded wait, it MUST write
nothing (no catalog row, no account, no credential, no import-level record, no
`asignatura.reactivada` event), MUST NOT hang, and MUST tell the user that the
catalog is busy, that nothing was applied and that they can try again. This
outcome MUST be distinguishable from a validation failure and from an
unexpected failure. The mechanism is a design decision and is not specified
here.

#### Scenario: Apply cannot start

- GIVEN a valid workbook with no row errors and a manual catalog write that
  holds the right to write for longer than the bounded wait
- WHEN the user confirms the apply
- THEN the user is told the catalog is busy, nothing was applied and they may
  try again
- AND no table has changed, including the audit log

#### Scenario: Retry after busy

- GIVEN an apply that was reported busy and the manual write has since finished
- WHEN the user confirms again
- THEN the apply runs as it would have without contention

### Requirement: Grupos sheet accepts an optional days column (CEI-DIAS-1)

Amendment 2026-10-07. The `Grupos` sheet MUST accept one further OPTIONAL column,
`Dias`, holding the meeting days of the group. It is optional in the same sense
as the existing optional columns: its absence from a workbook MUST NOT be a
structural error, and its header is matched like the other headers. The
required columns of every sheet are unchanged. The column is read only for the
`Grupos` sheet.

#### Scenario: Workbook without the column is accepted

- GIVEN a workbook whose Grupos sheet has only the four existing columns
- WHEN it is uploaded
- THEN no structural error is raised for `Dias`

#### Scenario: Workbook with the column is accepted

- GIVEN a workbook whose Grupos sheet also has a `Dias` column
- WHEN it is uploaded
- THEN the column is read for every Grupos row

### Requirement: Day tokens in the Dias cell (CEI-DIAS-2)

The `Dias` cell MUST be a list of day tokens separated by commas. Each token,
after trimming whitespace and ignoring case and accents (composed or
decomposed), MUST be exactly one of these, which are the only accepted tokens:

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
segment between or after commas is ignored. A cell with no token denotes the
empty set, which on apply means "no change to the stored days" (see "Days
semantics on apply"). Any other token (English names, ranges such as `Lun-Vie`, other
separators, numbers, or any other text) MUST be a row-level error (see
"Days semantics on apply").

#### Scenario: Accepted spellings (table-driven)

| Cell | Resulting set |
|---|---|
| `Lunes, Miércoles` | Monday, Wednesday |
| `lun,MIE` | Monday, Wednesday |
| `miercoles ,  SABADO` | Wednesday, Saturday |
| `Vie,Lunes,vie` | Monday, Friday |
| `Lunes,,Martes,` | Monday, Tuesday |
| empty cell | empty set (stored days left untouched on apply) |

- GIVEN a Grupos row otherwise valid and the cell from the row
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

- GIVEN a Grupos row otherwise valid and the cell from the row
- WHEN it is planned
- THEN the row is an error

### Requirement: Days semantics on apply (CEI-DIAS-3)

Amendment 2026-10-07, under decisions A-DIAS-IMP-a to -c (A-DIAS-IMP-b decided
by the owner: an empty cell leaves the stored days untouched). The meaning of
the `Dias` column on apply MUST be:

- **Column absent from the workbook**: a matched `Grupo` keeps its stored days
  untouched, and a created `Grupo` gets the empty set.
- **Column present, non-empty cell**: the cell's set replaces the stored days of
  the matched `Grupo`, and is the days of a created `Grupo`. The import wins
  over manual days edits, consistent with "Import precedence over manual
  edits", and such an overwrite is silent.
- **Column present, empty cell** (no token, only blanks or separators): the
  stored days of a matched `Grupo` MUST be left untouched; the import MUST NOT
  clear the days of an existing `Grupo`, so days can only be set or replaced by
  import, never erased. A `Grupo` created from such a row is created with the
  empty set. The preview MUST NOT report a days change for an empty cell.
- **Unrecognised token**: the row MUST be a row-level error with the reason code
  `dias.invalid`, naming the offending token. It is reported with the other
  errors, blocks confirmation and the apply like any other row error, and
  writes nothing.
- **Counting**: when the column is present and the cell is not empty, a row
  whose other values and whose set of days equal the stored ones MUST be counted
  as `unchanged` and not written. A row with a non-empty cell whose only
  difference is the set of days MUST be counted as `update`, in the preview and
  in the apply alike. When the column is absent, or the cell is empty, the days
  play no part in `unchanged` or `update`: a row with an empty cell and no other
  difference MUST be counted as `unchanged`.
- **Groups absent from the workbook** are deactivated as before and their days
  are not changed.
- An import MUST NOT write any per-record `grupo.*` audit event because of the
  days; they are covered by the import-level counts only (see
  "Import-level audit record").

#### Scenario: Column absent keeps stored days

- GIVEN an existing Grupo meeting on Monday and Wednesday and a workbook with no
  `Dias` column that lists it with the same docente
- WHEN applied
- THEN the Grupo still meets on Monday and Wednesday and is counted `unchanged`

#### Scenario: Column absent creates groups without days

- GIVEN a workbook with no `Dias` column listing a new Grupo
- WHEN applied
- THEN the Grupo is created with the empty set of days

#### Scenario: Column present replaces the days

- GIVEN an existing Grupo meeting on Monday and a workbook whose `Dias` cell for
  it is `Martes, Jueves`
- WHEN applied
- THEN the Grupo meets on Tuesday and Thursday only

#### Scenario: Empty cell leaves the stored days untouched

- GIVEN an existing Grupo meeting on Monday and a workbook with a `Dias` column
  whose cell for it is empty, and every other value of the row equal to the
  stored one
- WHEN previewed and applied
- THEN the Grupo still meets on Monday and is counted `unchanged`
- AND the preview reports no days change for it

#### Scenario: Empty cell with another difference keeps the days

- GIVEN an existing Grupo meeting on Monday and a workbook with a `Dias` column
  whose cell for it is empty and whose docente differs from the stored one
- WHEN applied
- THEN the docente is the workbook's, the row is counted `update`, and the Grupo
  still meets on Monday

#### Scenario: Empty cell on a new Grupo creates it without days

- GIVEN a workbook with a `Dias` column and a new Grupo whose cell is empty
- WHEN applied
- THEN the Grupo is created with the empty set of days

#### Scenario: Created Grupo takes the days of the cell

- GIVEN a workbook with a `Dias` column and a new Grupo whose cell is `Lun, Vie`
- WHEN applied
- THEN the Grupo is created meeting on Monday and Friday

#### Scenario: Invalid token blocks everything

- GIVEN a workbook with 200 valid rows and a Grupos row 9 whose `Dias` cell is
  `Lunes, Funday`
- WHEN it is previewed and then confirmed
- THEN the report has one error for Grupos row 9 with reason `dias.invalid`
  naming `Funday`
- AND no confirm control is offered and no row of the workbook is written

#### Scenario: A workbook that changes only days

- GIVEN stored data equal to a workbook in every value except that one Grupo's
  `Dias` cell differs
- WHEN previewed and applied
- THEN the report and the summary show exactly one `update` for grupos and no
  create, no deactivate and no new account
- AND the import-level audit record counts that one update and no per-record
  `grupo.*` event exists

#### Scenario: Same set in another spelling is unchanged

- GIVEN a Grupo stored with Monday and Wednesday and a workbook whose cell is
  `mie, Lunes`
- WHEN previewed
- THEN the row is counted `unchanged`

#### Scenario: Manual days edit is overwritten only when the column is present

- GIVEN a Grupo whose days were changed manually
- WHEN a workbook with the `Dias` column and a non-empty cell, a workbook with
  the column and an empty cell, and a workbook without the column are applied
  to copies of the same data
- THEN the first replaces the manual days with the workbook's, and the second
  and the third leave the manual days unchanged

#### Scenario: Idempotent re-import with the column

- GIVEN a workbook with a `Dias` column already applied successfully
- WHEN the same workbook is applied again
- THEN every entity reports `unchanged` only

#### Scenario: Absent and reactivated groups

- GIVEN an active Grupo with days that the workbook omits, and an inactive Grupo
  that the workbook lists with a non-empty `Dias` cell
- WHEN applied
- THEN the omitted Grupo is inactive with its days unchanged
- AND the listed Grupo is active with the days of its cell

### Requirement: Template and contract document the days column (CEI-DIAS-4)

The downloadable template MUST include the `Dias` column in its `Grupos` sheet,
and its header row MUST still be exactly the columns the importer accepts. The
template, when uploaded unchanged, MUST still parse with zero rows and zero
errors. The contract shown on the import page before upload MUST list `Dias` as
an optional column of `Grupos` and state, in static copy, that it takes the day
names or abbreviations from "Day tokens in the Dias cell" separated by commas,
that leaving the column out keeps the stored days, that a non-empty cell
replaces the stored days, and that an empty cell leaves them untouched (the
import never clears days). All new text (the
contract lines, the `dias.invalid` reason, and any template note) MUST exist in
both `es` and `en` with identical keys.

#### Scenario: Template includes the column

- GIVEN an authenticated `secretaria`
- WHEN they download the template
- THEN its Grupos sheet header contains `Dias` and the file, uploaded
  unchanged, parses with zero rows and zero errors

#### Scenario: Contract mentions the column

- GIVEN `secretaria` opens the import page
- WHEN the page renders before any file is selected
- THEN `Dias` appears among the optional Grupos columns with the rule on days
  and what an absent column or an empty cell does

#### Scenario: Locale parity

- GIVEN the `es` and `en` catalogs
- WHEN their key sets are compared
- THEN they are identical, including the days contract and `dias.invalid` keys

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
- Assumption: row-level catalog writes (asignatura, grupo) are covered by the
  import-level counts; per-row audit records are required only for accounts
  (`imported-account-provisioning`).
- Assumption: maintenance is re-import only; there is no per-record CRUD
  (default 5).
- Assumption: exact sheet and column names are frozen from the real sample
  workbook (`docs/PlantillaCatalogo.xlsx`, 2026-09-22 — headers only, no data
  rows). Size cap and row cap remain provisional defaults, not calibrated
  against real row volume; scenarios reference "the configured maximum".
- Assumption: the spreadsheet library is a design choice; the spec constrains
  only behavior (guards, no formula evaluation, server-side).
- Assumption: a docente row whose email matches an existing user of another role
  is a row error, never a role change.
- **Decision (product-owner scope reduction, supersedes the original 7-sheet
  scope)**: the workbook drops `Facultades`, `Carreras`, `Estudiantes` and
  `Inscripciones`. `Facultad`/`Carrera` rows are loaded by a one-off seed
  maintained outside this change (a future, separate admin screen will let them
  be CRUD'd); the import never creates or updates a `Facultad` or `Carrera` row.
  The import creates no `Estudiante` account and writes no `Inscripcion` row —
  this fully resolves design.md's open risk X5 (secretaría MUST NOT create
  student accounts).
