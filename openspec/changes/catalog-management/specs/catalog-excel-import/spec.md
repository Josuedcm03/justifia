# Catalog Excel Import Specification (delta)

> Base for this delta: `openspec/changes/catalog-excel-import/specs/catalog-excel-import/spec.md`
> (`openspec/specs/` is empty because that change is not archived yet). Apply
> this delta after it. Requirements not named here are unchanged. Precedence
> rule (binding owner decision): the import wins over manual edits and keeps
> its specified behaviour, except for the changes below.

## ADDED Requirements

### Requirement: Import precedence over manual edits

When the import and manual management (`catalog-management`) have changed the
same row, the import MUST win: its apply writes exactly what it would write if
no manual change had happened, except as stated in the modified requirements
below. Manual field edits on `Asignatura` (name, hours, carrera) and on `Grupo`
(docente) that the apply overwrites MUST be overwritten silently; the
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

- GIVEN a workbook with no manual groups to deactivate and no inactive
  asignatura declared
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

- GIVEN a preview with the manual-groups warning and no row errors
- WHEN the user looks for the confirm action
- THEN it is offered

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

### Requirement: Natural-key upserts

Rows MUST be matched by natural key: `Asignatura.Codigo`, grupo (`Asignatura`,
`Periodo`, `NumeroGrupo`), docente `Usuario.Correo`. A matching row MUST be
updated in place, never duplicated; a non-matching row MUST be created. A row
whose non-key values equal the stored values MUST be counted as `unchanged` and
MUST NOT be written. An Asignaturas row matching an **inactive** `Asignatura`
MUST reactivate it (`Activo` true) and MUST be counted as `update` even when
name, carrera and hours equal the stored values. A Grupo created by the import
MUST get origin `importacion`; a Grupo updated by the import keeps its existing
origin. `Facultad` and `Carrera` have no upsert key here because the import
never writes them; an Asignatura's `Carrera` is resolved by name against
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

### Requirement: Deactivate absent, never delete

On apply, active `Grupo` rows absent from the workbook MUST be set inactive
(`Activo` false), regardless of their origin: manually created groups are NOT
exempt. The import MUST NOT delete any row of any entity. Rows for `Facultad`,
`Carrera` and `Asignatura` absent from the workbook MUST be left as they are
(an absent `Asignatura` is never deactivated nor reactivated by the import). A
later import that includes a previously deactivated grupo MUST reactivate it.
Downstream readers (RF-31) consume only active rows, per `academic-catalog`.
`Inscripcion` is out of this import's scope and is never written or
deactivated by it; its own lifecycle is governed entirely by
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

## REMOVED Requirements

None. The statements "maintenance is re-import only; there is no per-record
CRUD (default 5)" and "row-level catalog writes (asignatura, grupo) are
covered by the import-level counts" in the base Assumptions are handled below.

## Assumptions and open questions

- **Withdrawn**: base assumption "maintenance is re-import only; there is no
  per-record CRUD (default 5)". Manual per-record management now exists
  (`catalog-management`).
- **Retained**: the base assumption that row-level catalog writes are covered
  by import-level counts; per-record audit rows by the import remain required
  only for accounts, plus the one exception for reactivated asignaturas below.
- **Assumption (open question 1, not confirmed by the owner)**: a Grupos row for
  an inactive Asignatura that is not declared in the workbook is a row error
  naming the Asignatura, rather than reactivating it silently.
- **Assumption**: a reactivated Asignatura is counted as `update` (as the base
  does for a reactivated Grupo), not as a new entry in the per-entity counts; the
  separate reactivation figure is additional.
- **Assumption (taken from the design, departure P3, not confirmed by the
  owner)**: the import-level audit record and the apply summary carry two
  counts, reactivated asignaturas and deactivated manual grupos, and each
  reactivated Asignatura also gets its own `asignatura.reactivada` audit event
  (see the `audit-log` delta). The earlier text made the second count a SHOULD
  and the per-record event absent; the design makes both firm. Property names
  are a design decision.
- **Assumption (taken from the design, not confirmed by the owner)**: the
  preview states the reactivation count only; naming the `Codigo` values is a
  MAY. The earlier text required the codes.
- **Assumption (taken from the design, not confirmed by the owner)**: the apply
  reports "busy" when it cannot start within a bounded wait (see "Apply reports
  busy when it cannot start"). It is not stated whether the preview is also
  delayed by manual writes; the preview writes nothing either way.
- **Documented residual (accepted by the owner)**: manual field edits
  overwritten by an import are not detected or reported.
- **Known gap, unchanged**: an inactive docente still resolves in the import
  (it never reads `Usuario.Activo`); fixing it belongs to the users module.
