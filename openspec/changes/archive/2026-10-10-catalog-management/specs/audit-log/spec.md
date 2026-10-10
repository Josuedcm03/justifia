# Audit Log Specification (delta)

> Base for this delta: `openspec/specs/audit-log/spec.md`
> (archived from `catalog-excel-import` on 2026-10-04). Apply
> this delta after it. Existing requirements are unchanged; this delta only
> adds requirements.

## ADDED Requirements

### Requirement: Closed set of manual catalog events

The set of audit actions MUST gain exactly these eight: `asignatura.creada`,
`asignatura.actualizada`, `asignatura.desactivada`, `asignatura.reactivada`,
`grupo.creado`, `grupo.actualizado`, `grupo.desactivado`, `grupo.reactivado`.
All eight are written by manual writes by staff; `asignatura.reactivada` is
also written by the import apply (see "Import audit"); no import writes any
other of the eight. The set of audit entity types MUST gain
`Asignatura` and `Grupo`. An event with one of these actions MUST identify the
affected record by its id as the entity id and its entity type. Events MUST
continue to be constructible only through the central builders; no other action
or entity type is introduced by this change. Existing events and their payloads
MUST be unchanged, except that the import-level record gains two counts (see
the `catalog-excel-import` delta). No schema change to the audit log is required.

#### Scenario: Action to entity type (table-driven)

| Action | Entity type |
|---|---|
| `asignatura.creada`, `.actualizada`, `.desactivada`, `.reactivada` | `Asignatura` |
| `grupo.creado`, `.actualizado`, `.desactivado`, `.reactivado` | `Grupo` |

- GIVEN a manual write of the kind in the row
- WHEN its audit row is read
- THEN the action and entity type are as shown and the entity id is the id of
  the affected record

#### Scenario: Existing events are unaffected

- GIVEN an import apply that creates accounts
- WHEN its audit rows are read
- THEN the account events are identical in shape to those written before this
  change

### Requirement: One audit row per manual write, in the same transaction

Every successful manual create, update, deactivation and reactivation of an
`Asignatura` or a `Grupo` MUST write exactly one audit row, inside the same
transaction as the data change (per "Audit record is written in the same
transaction as its change"). A refused, invalid, unauthorized, no-op or failed
write MUST write no audit row and leave no data change. The actor MUST be the
authenticated session user, never a value from the request.

#### Scenario: Successful writes (table-driven)

| Write | Audit rows added |
|---|---|
| create Asignatura | 1 (`asignatura.creada`) |
| edit Asignatura with changed fields | 1 (`asignatura.actualizada`) |
| deactivate Asignatura | 1 (`asignatura.desactivada`) |
| reactivate Asignatura | 1 (`asignatura.reactivada`) |
| create Grupo | 1 (`grupo.creado`) |
| edit Grupo with a changed docente, changed days, or both | 1 (`grupo.actualizado`) |
| deactivate Grupo | 1 (`grupo.desactivado`) |
| reactivate Grupo | 1 (`grupo.reactivado`) |

- GIVEN a valid in-scope request by a staff actor
- WHEN the write succeeds
- THEN exactly the audit rows in the row exist for it, with the session user as
  actor

#### Scenario: Writes that must leave no row (table-driven)

| Case |
|---|
| validation failure |
| duplicate key |
| deactivate Asignatura with active groups |
| out-of-scope record |
| unauthorized role |
| edit with no changed field |
| deactivate an already inactive record |
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
discriminator `origen` with value `manual`. For `asignatura.actualizada` and
`grupo.actualizado` it MUST list the names of the fields that changed, and MUST
NOT contain the old or the new values of any field. For
`asignatura.creada` and `grupo.creado` it MUST list field names only. A manual
payload MUST NOT carry a file digest. Where a
payload needs to relate a record to its parent it MUST use stable identifiers
(for example the parent record id), not names or other personal data. No
payload may contain any credential (password, temporary password or hash).
Only a closed list of auditable field names is allowed; a field not on the list
can never be reported as changed. Amendment 2026-10-07: the closed list of
auditable `Grupo` fields MUST include `dias` (the meeting days). A change to the
set of days is reported by the name `dias` only, never by the day values, and
never by the number of days. Two selections of the same set in a different
order are not a change.

#### Scenario: Update lists names, not values

- GIVEN an Asignatura whose `Nombre` and `HorasTotales` are edited
- WHEN its audit payload is read
- THEN it names the two fields and `origen` is `manual`
- AND neither the old nor the new `Nombre` nor hours appear anywhere in it

#### Scenario: Days-only update names `dias` and no day

- GIVEN a Grupo meeting on Monday whose days are edited to Monday and Thursday
  and nothing else changes
- WHEN its audit payload is read
- THEN the field list is exactly `dias` and `origen` is `manual`
- AND the serialized payload contains no day name, day number or count of days

#### Scenario: Created Grupo payload carries no day values

- GIVEN a Grupo created manually with Tuesday and Friday
- WHEN its `grupo.creado` payload is serialized and searched
- THEN it may list the field name `dias` and contains no day value

#### Scenario: Same set in another order is not audited

- GIVEN a Grupo meeting on Monday and Wednesday
- WHEN an edit submits Wednesday and Monday and nothing else changes
- THEN no audit row is written

#### Scenario: Origin discriminator present

- GIVEN any manual catalog event
- WHEN its payload is read
- THEN `origen` equals `manual`

#### Scenario: No values in create, deactivate, reactivate

- GIVEN a created Grupo
- WHEN its payload is serialized and searched
- THEN it contains no `Periodo`, `NumeroGrupo` or docente name or email value

#### Scenario: Payload-leak check

- GIVEN a set of manual catalog events written for a Grupo with a docente
- WHEN every audit payload is serialized and searched for any `HashClave`,
  password or bcrypt pattern
- THEN none is found

### Requirement: Import audit: import-level record plus one event per reactivated Asignatura

The import MUST continue to describe its catalog writes through the single
import-level record. The only per-record catalog events it writes are
`asignatura.reactivada`, one for each `Asignatura` the apply reactivated, so
that a durable record exists of which manual deactivations the import undid.
Each such event MUST be written in the same transaction as the apply, have
entity type `Asignatura` and the reactivated record's id as entity id, and carry
a payload that lists field names only from the closed list (here only `activo`),
no value of any field, the discriminator `origen` with value `importacion`, and
the SHA-256 of the imported file. The payload MUST NOT contain `Codigo`, `Nombre`
or any other cell content, nor any credential. The import MUST NOT write any
other `asignatura.*` or `grupo.*` event; the manual-origin events are otherwise
written only by manual actions.

#### Scenario: Reactivation by import is audited per record

- GIVEN an apply that reactivates asignaturas A and B
- WHEN the audit rows written by it are read
- THEN there are exactly two `asignatura.reactivada` events, one per record id,
  each with entity type `Asignatura`, `origen` `importacion` and the file's
  SHA-256, in addition to the import-level record

#### Scenario: Import emits no other per-record catalog events

- GIVEN an apply that creates, updates, deactivates and reactivates asignaturas
  and grupos
- WHEN the audit rows written by it are read
- THEN the only `asignatura.*` or `grupo.*` actions among them are the
  `asignatura.reactivada` events for the reactivated asignaturas

#### Scenario: No reactivation, no event

- GIVEN an apply that reactivates no asignatura
- WHEN the audit rows written by it are read
- THEN none has an `asignatura.*` or `grupo.*` action

#### Scenario: Import reactivation payload has no values

- GIVEN an `asignatura.reactivada` event written by an import
- WHEN its payload is serialized and searched
- THEN it contains no `Codigo`, `Nombre`, hours or credential value, and the
  origin is distinguishable from a manual event by `origen`

#### Scenario: Event and data change commit together

- GIVEN an apply that fails or rolls back after planning a reactivation
- WHEN the audit log is read
- THEN no `asignatura.reactivada` event and no import-level record exist for it

## Assumptions and open questions

- Assumption (flagged, taken from the design, departure P3, **not confirmed by
  the owner**): an import-driven reactivation of an `Asignatura` is audited with
  one `asignatura.reactivada` event per record (origin `importacion`, file
  digest) in addition to two counters on the import-level record (see the
  `catalog-excel-import` delta). This adds audit rows to imports that
  reactivate; imports that reactivate nothing are unchanged. The owner may
  prefer the import-level record alone.
- Assumption: past-tense Spanish action names follow the existing
  `usuario.creado` style; the exact payload property names are a design
  decision, constrained by this spec only on content. The origin has two
  variants only: `manual` (no digest) and `importacion` (with the file digest).
- Assumption: read access to the audit log is still out of scope.
