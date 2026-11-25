# Delta for Catalog Excel Import

Change `docente-maintenance`, slice S4 (D3). Requirements covered: RNF-13 (b) (a
new row error; (a) is unchanged), RF-12 (b). Closes assumption A-C12 of
`catalog-management`. [PG] marks a scenario that MUST run on a real PostgreSQL (see
`docente-maintenance`); unmarked scenarios are provable on the pure planner.

## Notes for archive

- "Import precedence over manual edits" is not edited: it lists Asignatura and
  Grupo edits as examples. The docente name and phone, now editable by hand, are
  overwritten by the import in the same silent way; that is specified in
  `docente-maintenance` DM-13.
- "Deactivate absent, never delete" and "Idempotent re-import" are not edited. A
  re-import of a workbook that lists a docente who was deactivated afterwards now
  fails on the Grupos rows that name that docente (`docente.inactive`); it
  succeeds again once the docente is reactivated or the rows are changed.

## MODIFIED Requirements

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
A Grupos row whose docente resolves to an existing docente that is **inactive**
in the database MUST be a row-level error with the reason code `docente.inactive`,
naming the docente (the email written in the row). This holds even when the same
workbook lists that docente in its Docentes sheet, because the import never
reactivates a docente (see "Natural-key upserts"), and even when the grupo already
exists and nothing else about it would change. A docente that is active in the
database, or created by the same workbook, is not affected.
(Previously: a Grupos row naming an inactive docente resolved normally; this was the
known gap C12 and A-C12 of `catalog-management`.)

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

#### Scenario: Grupos row naming an inactive docente is a row error

- GIVEN an inactive docente "ana@uni.edu" in the database, not listed in the
  workbook's Docentes sheet, and a Grupos row for a new grupo with
  `CorreoDocente` "ana@uni.edu"
- WHEN it is planned
- THEN that row is an error with reason `docente.inactive` naming "ana@uni.edu",
  no grupo is written for it, and the docente stays inactive
- AND the report offers no confirm control

#### Scenario: Listing the inactive docente in the Docentes sheet does not help

- GIVEN the same inactive docente and a workbook that lists "ana@uni.edu" in its
  Docentes sheet (with a different name) and names it in a Grupos row
- WHEN it is planned
- THEN the Grupos row is a `docente.inactive` error
- AND the Docentes row is not an error and is counted `update`

#### Scenario: An unchanged grupo under an inactive docente is also an error

- GIVEN an active grupo whose docente is inactive (created before this change)
  and a workbook that lists the same grupo with the same docente
- WHEN it is planned
- THEN the row is a `docente.inactive` error, even though nothing about the grupo
  would change

#### Scenario: Active and same-workbook docentes are unaffected

- GIVEN an active docente in the database, and a docente created by the same
  workbook, each named by a Grupos row
- WHEN it is planned
- THEN neither row is a `docente.inactive` error

#### Scenario: Docente reactivated before the import

- GIVEN the inactive docente of the first scenario, reactivated by a `secretaria`
- WHEN the same workbook is planned again
- THEN the Grupos row is valid

### Requirement: Natural-key upserts

Rows MUST be matched by natural key: `Asignatura.Codigo`, grupo (`Asignatura`,
`Periodo`, `NumeroGrupo`), docente `Usuario.Correo`. A matching row MUST be
updated in place, never duplicated; a non-matching row MUST be created. A row
whose non-key values equal the stored values MUST be counted as `unchanged` and
MUST NOT be written. An Asignaturas row matching an **inactive** `Asignatura`
MUST reactivate it (`Activo` true) and MUST be counted as `update` even when
name, carrera and hours equal the stored values. A Docentes row matching an
existing docente, active or inactive, MUST update only the name and the phone, in
place, and MUST NOT write `Activo`, `Correo`, `Login`, `HashClave`,
`DebeCambiarClave` or the role; in particular it MUST NOT reactivate an inactive
docente (it is counted `update` when the name or the phone differ, `unchanged`
otherwise). A Grupo created by the import
MUST get origin `importacion`; a Grupo updated by the import keeps its existing
origin. `Facultad` and `Carrera` have no upsert key here because the
import never writes them — an Asignatura's `Carrera` is resolved by name against
existing rows only.
(Previously: nothing said whether a Docentes row could change `Activo`; the
asymmetry with Asignaturas, which the import does reactivate, is intended.)

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

#### Scenario: An inactive docente stays inactive [PG]

- GIVEN a docente deactivated by a `secretaria` and a workbook whose Docentes
  sheet lists the same email with the stored name and phone and no Grupos row for
  that docente
- WHEN applied
- THEN the docente is still inactive and the row is counted `unchanged`

#### Scenario: An inactive docente still gets its name and phone [PG]

- GIVEN the same inactive docente and a workbook that lists a different name and
  phone
- WHEN applied
- THEN the name and phone are updated, counted `update`, and `Activo`, `Correo`,
  `Login` and `HashClave` are unchanged

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
`CorreoDocente` in Grupos must match an active docente in the same workbook or
already in the system. This is static copy, not derived from parsing an uploaded
file. The row error `docente.inactive` MUST have a message in both catalogs that
names the docente's email, says the docente is inactive and that the import does
not reactivate docentes, and tells the `secretaria` to reactivate the docente in
Docentes (`/catalog/docentes`) or to name another docente in the row.
(Previously: the contract said "a docente in the same workbook or already in the
system", without "active", and no message for an inactive docente existed.)

#### Scenario: Locales

- GIVEN the Spanish and English catalogs
- WHEN every import, template and error message key is compared
- THEN both catalogs contain the same keys

#### Scenario: Contract shown before upload

- GIVEN `secretaria` opens the import page
- WHEN the page renders, before any file is selected
- THEN the three sheet names, their required/optional columns, and the
  validation rules above are visible
- AND the rule for `CorreoDocente` says the docente must be active

#### Scenario: Inactive docente message is actionable

- GIVEN a preview with a `docente.inactive` row error for "ana@uni.edu"
- WHEN the errors block renders in either locale
- THEN the message contains "ana@uni.edu", says the docente is inactive and that
  the import does not reactivate it, and says to reactivate it in Docentes or to
  name another docente
