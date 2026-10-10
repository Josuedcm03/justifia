# Audit Log Specification (delta)

> **Prerequisite: `catalog-management` must be archived before this change is
> archived.** This delta is written against the state of
> `openspec/specs/audit-log/spec.md` AFTER the delta of
> `openspec/changes/catalog-management/specs/audit-log/spec.md` has been applied
> to it. The four requirements modified below ("Closed set of manual catalog
> events", "One audit row per manual write, in the same transaction", "Manual
> event payloads carry field names only", "Import audit: import-level record plus
> one event per reactivated Asignatura") exist in the main spec only after that
> archive. Requirements not named here are unchanged, in particular "Audit records
> are append-only and immutable", "Audit record content", "No secrets in audit
> payloads", "Audit record is written in the same transaction as its change" and
> "Scope limited to write events". No schema change to the audit log is required.
>
> Vocabulary: a **class** is one `Asignatura` row (code plus group number). Items
> marked A1-A12 come from the assumed defaults of the proposal, unconfirmed by the
> owner. Field names such as `nombre` or `docenteId` are the names of the closed
> lists that exist today and are kept; renaming one is a design decision.

## ADDED Requirements

### Requirement: Retired grupo events stay readable

After this change no path MUST write an audit event whose action is `grupo.creado`,
`grupo.actualizado`, `grupo.desactivado` or `grupo.reactivado`, or whose entity
type is `Grupo`, and the central builders for them MUST be removed. Every such
row written before the change MUST remain stored, unmodified and readable with its
action, entity type, entity id and payload. Their entity ids refer to rows that no
longer exist; no row MUST be rewritten, deleted or re-pointed (the audit log is
append-only). Past `asignatura.*` rows keep their ids, which now identify the
class row that reused the `Asignatura` row, so a past `asignatura.*` event
describes a class, not a whole subject.

#### Scenario: No path writes a grupo event

- GIVEN every production module under `src`
- WHEN it is checked structurally for an audit builder or a write that produces a
  `grupo.*` action or entity type `Grupo`
- THEN none is found

#### Scenario: Historical rows are intact

- GIVEN an audit log containing `grupo.creado` and `grupo.actualizado` rows
- WHEN the change is deployed and the log is read
- THEN the rows exist with their original action, entity type, entity id and
  payload

### Requirement: A propagated subject-field edit is audited

When a manual edit changes `Nombre`, `CarreraId` or `HorasTotales` of a class
whose code has other class rows (see `catalog-management`, propagation, D9), the
transaction MUST write audit rows that, taken together, identify by id EVERY class
row of the code whose subject fields changed, active and inactive, and report only
the names of the changed fields, never values, with the discriminator `origen`
equal to `manual`. The audit row or rows MUST be written in the same transaction
as the data change. The number of audit rows written MUST NOT exceed the number of
class rows changed. Whether this is one row listing the ids or one row per class
is a design decision; the set of action names MUST NOT grow beyond what that
decision needs.

#### Scenario: Edit of a code with three classes

- GIVEN code A with classes "1", "2" (active) and "3" (inactive), and an edit of
  the `Nombre` of class "2"
- WHEN the transaction commits
- THEN the audit rows it wrote identify the class rows "1", "2" and "3" by id and
  report only the field name for `Nombre`
- AND no old or new `Nombre` appears in any of them

#### Scenario: Propagation that fails leaves no row

- GIVEN the same edit and a failure while writing one of the sibling rows
- WHEN the transaction rolls back
- THEN no row of the code changed and no audit row exists for it

#### Scenario: Edit of a code with one class is a plain update

- GIVEN a code with one class and an edit of its `HorasTotales`
- WHEN the transaction commits
- THEN exactly one `asignatura.actualizada` row exists for it, naming the hours
  field

### Requirement: Import-level audit payload shape after the merge

The import-level audit record MUST carry the SHA-256 of the file and per-entity
counts of create, update, unchanged and deactivate for exactly two entities:
`Asignatura` (class rows) and `Usuario`. It MUST carry no counts for an entity
`Grupo`, and no figure named after groups. It MUST also carry the count of
accounts created and updated, the count of inactive classes the apply
reactivated, and the count of manually created classes (origin `manual`, A3) the
apply deactivated. These are counts only: no `Codigo`, group number, `Nombre` or
other cell content, and no credential. Import-level records written before this
change keep their old shape (a `Grupo` entry in the counts and a figure for
manually created groups deactivated); whether a reader must accept both shapes is
a design decision.

#### Scenario: New record has two entities

- GIVEN a successful apply
- WHEN the import-level record is read
- THEN its counts have entries for `Asignatura` and `Usuario` and none for
  `Grupo`
- AND it carries the reactivated-classes count and the manual-classes-deactivated
  count

#### Scenario: Old records are untouched

- GIVEN an import-level record written before this change
- WHEN the change is deployed
- THEN the record is unchanged and still readable

## MODIFIED Requirements

### Requirement: Closed set of manual catalog events

The set of audit actions written by manual catalog writes MUST be exactly these
four: `asignatura.creada`, `asignatura.actualizada`, `asignatura.desactivada`,
`asignatura.reactivada`. They are written by manual writes by staff on a class;
`asignatura.reactivada` is also written by the import apply (see "Import audit:
import-level record plus one event per reactivated Asignatura"); no import writes
any other of the four. The entity type of all four MUST be `Asignatura`. The four
`grupo.*` actions and the entity type `Grupo` are retired (see "Retired grupo
events stay readable"). An event with one of the four actions MUST identify the
affected class row by its id as the entity id and its entity type. Events MUST
continue to be constructible only through the central builders; no other action
or entity type is introduced by this change except as a design decision for the
propagated edit (see "A propagated subject-field edit is audited"). Existing
account and import events and their payloads MUST be unchanged, except that the
import-level record has the shape of "Import-level audit payload shape after the
merge". No schema change to the audit log is required.
(Previously: eight actions, four `asignatura.*` and four `grupo.*`, with entity
types `Asignatura` and `Grupo`.)

#### Scenario: Action to entity type (table-driven)

| Action | Entity type |
|---|---|
| `asignatura.creada`, `.actualizada`, `.desactivada`, `.reactivada` | `Asignatura` |

- GIVEN a manual write of the kind in the row on a class
- WHEN its audit row is read
- THEN the action and entity type are as shown and the entity id is the id of
  the class row

#### Scenario: Existing account events are unaffected

- GIVEN an import apply that creates accounts
- WHEN its audit rows are read
- THEN the account events are identical in shape to those written before this
  change

### Requirement: One audit row per manual write, in the same transaction

Every successful manual create, update, deactivation and reactivation of a class
MUST write exactly one audit row, inside the same transaction as the data change
(per "Audit record is written in the same transaction as its change"), except an
edit that also changes the subject fields of other rows of the code, which is
governed by "A propagated subject-field edit is audited". A refused, invalid,
unauthorized, no-op or failed write MUST write no audit row and leave no data
change. The actor MUST be the authenticated session user, never a value from the
request.
(Previously: the requirement covered `Asignatura` and `Grupo` writes, and the
list of cases that leave no row included "deactivate Asignatura with active
groups".)

#### Scenario: Successful writes (table-driven)

| Write | Audit rows added |
|---|---|
| create class | 1 (`asignatura.creada`) |
| edit class with a changed docente, changed days, or both | 1 (`asignatura.actualizada`) |
| edit subject fields of a class whose code has no other row | 1 (`asignatura.actualizada`) |
| deactivate class | 1 (`asignatura.desactivada`) |
| reactivate class | 1 (`asignatura.reactivada`) |

- GIVEN a valid in-scope request by a staff actor
- WHEN the write succeeds
- THEN exactly the audit rows in the row exist for it, with the session user as
  actor

#### Scenario: Writes that must leave no row (table-driven)

| Case |
|---|
| validation failure |
| duplicate code and group number |
| docente-rule refusal |
| docente inactive or not a docente |
| out-of-scope record |
| unauthorized role |
| edit with no changed field |
| deactivate an already inactive class |
| propagating edit submitted without its confirmation |
| the data write fails after the audit insert |
| the audit insert fails |
| the write cannot start because catalog writes are busy |

- GIVEN the case from the row
- WHEN the action runs
- THEN no audit row exists for it and the data is unchanged

#### Scenario: Actor from the session

- GIVEN a request whose body claims another actor
- WHEN a manual write succeeds
- THEN the audit row's actor is the session user

### Requirement: Manual event payloads carry field names only

The payload of a manual catalog event MUST be structured data that carries the
discriminator `origen` with value `manual`. For `asignatura.actualizada` it MUST
list the names of the fields that changed, and MUST NOT contain the old or the new
values of any field. For `asignatura.creada` it MUST list field names only. A
manual payload MUST NOT carry a file digest. A payload MUST NOT carry a name,
email or other personal data; where it needs to relate a record to another it MUST
use stable identifiers (a class row id). No payload may contain any credential.
Only a closed list of auditable field names is allowed; a field not on the list
can never be reported as changed. The closed list of auditable class fields is:
`codigo`, `numeroGrupo`, `nombre`, `carreraId`, `horasTotales`, `docenteId`,
`dias`, `activo`, `origen`. The former `asignaturaId` and `periodo` fields no
longer exist. A change of docente is reported by the name `docenteId` only, never
by the docente's id, name or email. A change to the set of days is reported by the
name `dias` only, never by the day values and never by the number of days. Two
selections of the same set in a different order are not a change.
(Previously: two closed lists, one per entity; the `Grupo` list had
`asignaturaId`, `periodo`, `numeroGrupo`, `docenteId`, `activo`, `origen`, `dias`
and the `Asignatura` list had `codigo`, `nombre`, `carreraId`, `horasTotales`,
`activo`.)

#### Scenario: Update lists names, not values

- GIVEN a class whose `Nombre` and `HorasTotales` are edited
- WHEN its audit payload is read
- THEN it names the two fields and `origen` is `manual`
- AND neither the old nor the new `Nombre` nor hours appear anywhere in it

#### Scenario: Docente change names the field only

- GIVEN a class whose docente is changed from D1 to D2 and nothing else changes
- WHEN its audit payload is read
- THEN the field list is exactly `docenteId`
- AND no docente id, name or email appears in the serialized payload

#### Scenario: Clearing the docente names the field only

- GIVEN a class with a docente whose docente is cleared
- WHEN its audit payload is read
- THEN the field list is exactly `docenteId` and no docente value appears

#### Scenario: Days-only update names `dias` and no day

- GIVEN a class meeting on Monday whose days are edited to Monday and Thursday
  and nothing else changes
- WHEN its audit payload is read
- THEN the field list is exactly `dias` and `origen` is `manual`
- AND the serialized payload contains no day name, day number or count of days

#### Scenario: Same set in another order is not audited

- GIVEN a class meeting on Monday and Wednesday
- WHEN an edit submits Wednesday and Monday and nothing else changes
- THEN no audit row is written

#### Scenario: Created class payload carries no values

- GIVEN a class created manually with a docente and Tuesday and Friday
- WHEN its `asignatura.creada` payload is serialized and searched
- THEN it lists field names from the closed list and contains no `Codigo`, group
  number, `Nombre`, hours, docente value or day value

#### Scenario: Origin discriminator present

- GIVEN any manual catalog event
- WHEN its payload is read
- THEN `origen` equals `manual`

#### Scenario: Payload-leak check

- GIVEN a set of manual catalog events written for a class with a docente
- WHEN every audit payload is serialized and searched for any `HashClave`,
  password or bcrypt pattern
- THEN none is found

### Requirement: Import audit: import-level record plus one event per reactivated Asignatura

The import MUST continue to describe its catalog writes through the single
import-level record. The only per-record catalog events it writes are
`asignatura.reactivada`, one for each class row the apply reactivated, so that a
durable record exists of which manual deactivations the import undid. Each such
event MUST be written in the same transaction as the apply, have entity type
`Asignatura` and the reactivated class row's id as entity id, and carry a payload
that lists field names only from the closed list (here only `activo`), no value
of any field, the discriminator `origen` with value `importacion`, and the
SHA-256 of the imported file. The payload MUST NOT contain `Codigo`, group
number, `Nombre` or any other cell content, nor any credential. The import MUST
NOT write any other `asignatura.*` event and MUST NOT write any `grupo.*` event:
the classes it creates, updates (docente, days, subject fields, including the
propagation of subject fields to sibling rows) and deactivates (A5) are covered by
the import-level counts only.
(Previously: one event per reactivated `Asignatura`; the import wrote no other
`asignatura.*` or `grupo.*` event, and absent groups, not asignaturas, were
deactivated.)

#### Scenario: Reactivation by import is audited per record

- GIVEN an apply that reactivates classes A1 and B1
- WHEN the audit rows written by it are read
- THEN there are exactly two `asignatura.reactivada` events, one per class row id,
  each with entity type `Asignatura`, `origen` `importacion` and the file's
  SHA-256, in addition to the import-level record

#### Scenario: Import emits no other per-record catalog events

- GIVEN an apply that creates, updates, deactivates and reactivates classes
- WHEN the audit rows written by it are read
- THEN the only `asignatura.*` or `grupo.*` actions among them are the
  `asignatura.reactivada` events for the reactivated classes

#### Scenario: No reactivation, no event

- GIVEN an apply that reactivates no class
- WHEN the audit rows written by it are read
- THEN none has an `asignatura.*` or `grupo.*` action

#### Scenario: Import reactivation payload has no values

- GIVEN an `asignatura.reactivada` event written by an import
- WHEN its payload is serialized and searched
- THEN it contains no `Codigo`, group number, `Nombre`, hours or credential
  value, and the origin is distinguishable from a manual event by `origen`

#### Scenario: Event and data change commit together

- GIVEN an apply that fails or rolls back after planning a reactivation
- WHEN the audit log is read
- THEN no `asignatura.reactivada` event and no import-level record exist for it

## REMOVED Requirements

None. The `grupo.*` events are retired by the MODIFIED "Closed set of manual
catalog events" and kept readable by "Retired grupo events stay readable".

## Assumptions and open questions

Open questions for design:

1. **One audit row or one per class for a propagated edit** (proposal question
   10). The requirement "A propagated subject-field edit is audited" holds for
   both; design picks one and whether it needs a new action name.
2. **Both shapes of the import payload** (proposal question 11): whether any audit
   reader must accept the old `Grupo` entry and figure next to the new shape.
3. Whether the closed `AuditEvent` type keeps the `grupo.*` literals and the
   `Grupo` entity type for reading old rows, or whether old rows are read as
   untyped data.
4. Names of the two new counts of the import-level record (reactivated classes,
   manually created classes deactivated) and whether `numeroGrupo` is renamed.

Assumptions recorded here:

- **A3 (unconfirmed).** `Origen` moves to the class row with the same meaning, so
  the import-level figure "manually created classes deactivated" survives under a
  new name. The proposal says the import payload "loses its Grupo figures"; this
  spec removes the figures named after `Grupo` but keeps the manual-origin figure,
  because A3 keeps the origin and its deactivation warning.
- **A5 (unconfirmed).** The import deactivates absent classes; it is counted, not
  audited per record.
- **Carried over, still unconfirmed by the owner:** the per-record
  `asignatura.reactivada` event of an import (departure P3 of `catalog-management`,
  A-AUD-IMP) keeps applying, now to class rows.
