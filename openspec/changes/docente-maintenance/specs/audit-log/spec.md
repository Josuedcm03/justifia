# Delta for Audit Log

Change `docente-maintenance`. Requirements covered: RNF-06 (a), RF-12 (a),
RNF-02. D4 (audit names fields, never values) and D5 (the staff creation form
writes one `usuario.creado` row). [PG] marks a scenario that MUST run on a real
PostgreSQL (see `docente-maintenance`).

## Notes for archive

- Purpose: no edit. It already says the log "is reusable by later changes".
- "Closed set of manual catalog events" stays as it is (eight actions, "no other
  action ... is introduced by this change" refers to that earlier change). The
  new requirements below add two actions and reuse two.
- "Import audit..." and "Account writes are audited without credentials"
  (`imported-account-provisioning`) are not edited: an import's `usuario.creado`
  and `usuario.actualizado` rows keep `origen` `importacion` and the file digest.
- The audit reader (if any) MUST tolerate the new action codes and the `manual`
  origin on `usuario.*` rows.

## ADDED Requirements

### Requirement: DM-AUD-1 Closed set of docente maintenance and staff creation events (RF-12 a, RNF-06 a)

The set of audit actions MUST gain exactly these two: `usuario.desactivado` and
`usuario.reactivado`. Together with two actions that already exist, they describe
the writes of this change:

| Action | Written by | Origin |
|---|---|---|
| `usuario.actualizado` | a manual edit of a docente by a `secretaria` (also by the import, as before) | `manual` (import: `importacion`) |
| `usuario.desactivado` | a manual deactivation of a docente | `manual` |
| `usuario.reactivado` | a manual reactivation of a docente | `manual` |
| `usuario.creado` | the creation of an account at `/users/new`, for every role that form can create (also by the import, as before) | `manual` (import: `importacion`) |

An event with one of these actions MUST identify the affected account by its id as
the entity id, with entity type `Usuario` (existing). The direction of a toggle
MUST be readable from the action alone. Events MUST continue to be constructible
only through the central builders. No new entity type is introduced and no schema
change of the audit log is required. Existing import events and their payloads
MUST be unchanged.

#### Scenario: Action to entity type (table-driven)

| Write | Action | Entity type |
|---|---|---|
| edit of a docente with changed fields | `usuario.actualizado` | `Usuario` |
| deactivation of a docente | `usuario.desactivado` | `Usuario` |
| reactivation of a docente | `usuario.reactivado` | `Usuario` |
| account created at `/users/new` | `usuario.creado` | `Usuario` |

- GIVEN the write from the row
- WHEN its audit row is read
- THEN the action and entity type are as shown and the entity id is the id of the
  affected account

#### Scenario: The set of actions is exactly the old set plus two

- GIVEN the closed list of audit actions before this change
- WHEN it is compared with the list after
- THEN the difference is exactly `usuario.desactivado` and `usuario.reactivado`

#### Scenario: Import events are unaffected [PG]

- GIVEN an import apply that creates one docente and updates another
- WHEN its account audit rows are read
- THEN they are `usuario.creado` and `usuario.actualizado` with `origen`
  `importacion` and the file digest, identical in shape to those written before
  this change

### Requirement: DM-AUD-2 One audit row per docente write and per staff account creation (RF-12 a, RNF-06 a)

Every successful manual edit that changes a field, every successful deactivation
and every successful reactivation of a docente, and every successful creation of
an account at `/users/new`, MUST write exactly one audit row, inside the same
transaction as the data change (per "Audit record is written in the same
transaction as its change"). A refused, invalid, unauthorized, no-op, busy or
failed write MUST write no audit row and leave no data change. The actor MUST be
the authenticated session user, never a value from the request. The page loads of
the edit page and of the creation form write nothing (per "Scope limited to write
events").

#### Scenario: Successful writes (table-driven) [PG]

| Write | Audit rows added |
|---|---|
| edit of a docente with at least one changed field | 1 (`usuario.actualizado`) |
| deactivate a docente | 1 (`usuario.desactivado`) |
| reactivate a docente | 1 (`usuario.reactivado`) |
| create a docente at `/users/new` | 1 (`usuario.creado`) |
| create a coordinacion, as administrador, at `/users/new` | 1 (`usuario.creado`) |
| create a secretaria, as coordinacion, at `/users/new` | 1 (`usuario.creado`) |

- GIVEN a valid request by a caller allowed to do it
- WHEN the write succeeds
- THEN exactly the audit rows in the row exist for it, with the session user as
  actor

#### Scenario: Writes that must leave no row (table-driven) [PG]

| Case |
|---|
| validation failure |
| duplicate email, by lookup or by the unique constraint |
| deactivation refused because of active grupos |
| edit with no changed field |
| edit of an inactive docente |
| deactivate an already inactive docente, reactivate an already active one |
| not found (other role, malformed id, closed intent) |
| unauthorized role |
| the write cannot start because catalog writes are busy |
| the data write fails |
| the audit insert fails |
| account creation refused by a check of `/users/new` (role, career, facultad, email, login collision) |

- GIVEN the case from the row
- WHEN the action runs
- THEN no audit row exists for it and the data is unchanged (for the creation, no
  account exists)

#### Scenario: Actor from the session

- GIVEN a request whose body claims another actor
- WHEN a docente write or an account creation succeeds
- THEN the audit row's actor is the session user

#### Scenario: Audit failure rolls back the change [PG]

- GIVEN a valid docente edit, and separately a valid account creation, whose audit
  insert is made to fail
- WHEN the transaction runs
- THEN the docente is unchanged, respectively no account exists, and no audit row
  from that transaction remains

### Requirement: DM-AUD-3 Docente maintenance and staff creation payloads carry field names only (D4, D5; RNF-02, RNF-05)

The payload of every event of DM-AUD-1 written by a manual write MUST be
structured data that carries the discriminator `origen` with value `manual` and
the role of the account (`docente` for the edit and the toggles; the created role
for `usuario.creado`). A manual payload MUST NOT carry a file digest. For
`usuario.actualizado` it MUST list exactly the names of the fields that changed,
from `nombreCompleto`, `correo` and `telefono`, and MUST NOT contain the old or
the new value of any field. For `usuario.desactivado` and `usuario.reactivado` it
MUST contain no value; it MAY name the field `activo`. For `usuario.creado`
written by the staff form it MUST list field names only, from the closed list of
auditable user fields (including `facultadId` for a created `secretaria`, SR-16),
and no value. No payload MAY contain a name, an email, a phone, a `Login`, a
`Cif`, a password, a temporary password or a hash. Only the closed list of
auditable field names is allowed; a field not on the list can never be reported
as changed.

#### Scenario: Update lists names, not values

- GIVEN a docente whose phone and email are edited and nothing else
- WHEN its `usuario.actualizado` payload is read
- THEN `campos` is exactly `telefono` and `correo` (in any order), `origen` is
  `manual`, the role is `docente`, and there is no digest
- AND neither the old nor the new email or phone appears anywhere in it

#### Scenario: Clearing a phone is a change of `telefono`

- GIVEN a docente with a phone, edited with an empty phone and nothing else
- WHEN the audit payload is read
- THEN `campos` is exactly `telefono` and no value appears

#### Scenario: Toggle payloads carry no value

- GIVEN a deactivation and a reactivation of a docente
- WHEN each payload is serialized and searched
- THEN `origen` is `manual`, and no name, email, phone or login appears

#### Scenario: Created account payload is names only [PG]

- GIVEN a `secretaria` created at `/users/new` by a `coordinacion` with a chosen
  password
- WHEN its `usuario.creado` payload is serialized and searched
- THEN it names fields (including `facultadId`) and the role `secretaria`, has
  `origen` `manual` and no digest, and contains none of the name, email, phone,
  login, password or hash

#### Scenario: Payload-leak check [PG]

- GIVEN every docente event and every staff creation event written in one test run
  with sentinel names, emails, phones and passwords
- WHEN every payload is serialized and searched for the sentinels, for `HashClave`
  and for a bcrypt pattern
- THEN none is found

#### Scenario: Import payload keeps its shape

- GIVEN an import that updates a docente's name
- WHEN its `usuario.actualizado` payload is read
- THEN `origen` is `importacion` and the file digest is present, as before
