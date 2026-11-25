# Docente Maintenance Specification (new capability)

> Delta type: this whole file is ADDED. There is no base spec for
> `docente-maintenance`; `sdd-archive` promotes it to
> `openspec/specs/docente-maintenance/spec.md`. It builds on `catalog-management`,
> `academic-catalog`, `audit-log`, `catalog-excel-import`,
> `imported-account-provisioning`, `staff-account-creation` and
> `teacher-remission`, whose deltas for this change sit beside it.

## Purpose

RF-12 (a) says the secretaria "crea, edita y desactiva registros" of the internal
catalog, and RF-12 (b) says a deactivated record "se conserva y deja de ofrecerse
en solicitudes nuevas". For docentes the creation exists (`/users/new` and the
catalog import) but edit and deactivation need the database. This capability lets
the `secretaria` correct a docente's name, email and phone, deactivate a docente
and reactivate one, from `/catalog/docentes`. Nothing is deleted. The module
keeps the invariant that an active `Grupo` never has an inactive docente: a docente
with active grupos cannot be deactivated (D2), and the import never reactivates a
docente nor accepts a grupo row naming an inactive one (D3).

Requirements covered: RF-12 (a), (b); RNF-01 (a), (b), (c); RNF-06 (a); RNF-12;
RNF-13 (b). Rules unchanged and pinned here: RF-09, RN-18, RN-19 (existing
remissions keep their snapshot), RN-02 (only `docente` rows are addressable),
RNF-04 and RN-27 (a docente deactivation touches no enrollment), RNF-05
(passwords untouched).

Vocabulary:

- **Docente**: a `Usuario` whose role is `docente`. A docente has no `Carrera` and
  no `Facultad`.
- **Maintainer**: a signed-in `secretaria`.
- **Edit page**: `/catalog/docentes/{id}/edit`.
- **Active grupos of a docente** (the count of DM-8): the `Grupo` rows with
  `Activo` true whose `DocenteId` is that docente, of any `Periodo` and whatever
  the state of their `Asignatura`.
- **Denied**, **entry point** and **not found**: as in `catalog-management`.
  "Not found" is the same screen, or the same action outcome, as for an id that
  matches no record.
- **Generic sign-in failure**: the single message the sign-in shows for a wrong
  password, an unknown email and an inactive account (`auth-entry-access`).
- **[PG]** in a scenario: it MUST be proven on a real PostgreSQL, on a disposable
  branch and never on production, by the integration suite or by the recorded
  system run. In a table marked [PG], a row that is decided before any database
  write (validation, unauthorized role, malformed id, closed intent) MAY be proven
  by unit tests. A scenario that applies an import with effect is proven by the
  system run, as its last step, because an apply deactivates every absent grupo of
  the branch; the integration suite only runs applies that are rejected. Scenarios
  without the mark are provable with unit or component tests and doubles.

## Requirements

### Requirement: DM-1 Only the secretaria maintains docentes (D1; RF-12 a, RNF-01 a b c)

Editing a docente, deactivating a docente and reactivating a docente MUST be
available to `secretaria` only. The right MUST be a predicate derived from the
existing role hierarchy (the roles that may assign the role `docente`, that is
`canAssignRole(rol, "docente")` in `permissions.ts`), not a second hand-written
role list. Docentes have no `Facultad`, so no scope applies: any `secretaria` may
maintain any docente, including a `secretaria` whose own `Facultad` is empty.
Every entry point (the edit page, the edit action, the deactivate and reactivate
action) MUST decide authentication, forced password change and role before it
reads any docente data and before it reads the request body. The sidebar MUST NOT
change: no new item, and the existing Docentes item stays visible to the three
staff roles (CM-NAV-1). `administrador` and `coordinacion` keep the read-only list.

#### Scenario: Role matrix (table-driven)

| Role | Edit page | Edit action | Deactivate / reactivate action |
|---|---|---|---|
| `secretaria` | allowed | allowed | allowed |
| `administrador` | denied (`/denied`) | denied (`/denied`) | denied (`/denied`) |
| `coordinacion` | denied (`/denied`) | denied (`/denied`) | denied (`/denied`) |
| `docente` | denied (`/denied`) | denied (`/denied`) | denied (`/denied`) |
| `estudiante` | denied (`/denied`) | denied (`/denied`) | denied (`/denied`) |
| anonymous | denied (`/login`) | denied (`/login`) | denied (`/login`) |

- GIVEN a caller with the role from the row and an existing active docente
- WHEN they open the edit page or submit the action, including a hand-crafted
  request
- THEN the outcome is the one in the row, and a denied caller causes no read of
  docente data, no parsing of the body, no write and no audit row

#### Scenario: Denied caller's body and data are never touched

- GIVEN a `coordinacion` submitting a well-formed edit with a valid docente id
- WHEN the action runs
- THEN the form fields are not read, the docente is not looked up, nothing is
  written, no audit row exists and the caller is redirected to `/denied`

#### Scenario: Forced password change comes first

- GIVEN a `secretaria` whose account requires a password change
- WHEN she requests the edit page or any of the actions
- THEN she is sent to the forced password change and nothing is read or written

#### Scenario: The predicate follows the hierarchy

- GIVEN the five roles
- WHEN "may maintain a docente" is evaluated for each
- THEN it equals `canAssignRole(role, "docente")`, so only `secretaria` is true,
  and no other file restates a list of roles for it

#### Scenario: Any secretaria, any facultad

- GIVEN a `secretaria` of facultad A, a `secretaria` with no facultad, and a
  docente
- WHEN each opens the edit page and saves a change
- THEN both succeed

#### Scenario: The menu is unchanged

- GIVEN a staff user
- WHEN the sidebar renders on `/catalog/docentes/7/edit`
- THEN it shows the same items as on `/catalog/docentes`, the Docentes item is
  marked active (with `aria-current`) and the Asignaturas item is not

#### Scenario: The access matrix covers every new entry point

- GIVEN the access matrix of `route-access-coverage`
- WHEN it is read
- THEN it holds one row for the edit page and one row per server-action module
  added for docentes, each denying every identity except `secretaria`, by URL and
  by direct request (RNF-01 c)

### Requirement: DM-2 A docente is read by id and only if it is a docente (RN-02, RNF-01, RNF-02)

The edit page and every action MUST address the record by id through a read that
returns a row only when the account's role is `docente`. A missing record, an
account of any other role and a malformed id MUST give the same "not found"
outcome, with no data of the account and nothing that tells the three cases
apart. The data delivered to the browser for the edit page MUST be the id, name,
email, phone, state and number of active grupos, and nothing else: no `Login`, no `HashClave` or password,
no `Cif`, no role, no `Carrera` or `Facultad`. A student account is unreachable.

#### Scenario: Which ids resolve (table-driven)

| Id | Result |
|---|---|
| an active docente | edit page |
| an inactive docente | edit page, read-only (DM-6) |
| an `estudiante`, `coordinacion`, `secretaria` or `administrador` account | not found |
| an id that matches no account | not found |
| `abc`, `0`, `-3`, `1.5`, `007`, `1e3`, a value beyond the safe integer range | not found |

- GIVEN a `secretaria` and the id from the row
- WHEN she opens `/catalog/docentes/{id}/edit`
- THEN the result is as shown

#### Scenario: No oracle for other roles

- GIVEN the id of a student and the id of an account that does not exist
- WHEN a `secretaria` opens the edit page of each
- THEN the two responses are identical and neither contains any name, email,
  phone or role of the student

#### Scenario: Hand-crafted action on another role

- GIVEN a `secretaria` and the id of a student
- WHEN she submits the edit, deactivate or reactivate action with that id
- THEN the outcome is "not found", nothing is written and no audit row exists

#### Scenario: The page receives only its fields

- GIVEN a docente with a login, a password hash and a CIF
- WHEN the edit page renders and the data handed to the browser is serialized
- THEN it contains the id, name, email, phone, state and number of active grupos,
  and none of the login, the hash, a password, the CIF or the role

### Requirement: DM-3 Editable fields and validation (RF-12 a)

The editable fields of a docente are the name, the email and the phone, and no
others. Validation MUST run on the server and refuse the write with a message
per field that says what is wrong and what to enter. The name is required,
trimmed, at most 160 characters. The email is required (A1), trimmed, stored in
lower case, a valid address, at most 160 characters. The phone is optional,
trimmed, at most 30 characters; an empty phone clears it (stored as no value).
Any other submitted value (`login`, `hashClave`, a password, `rol`, `activo`,
`cif`, `carreraId`, `facultadId`, `debeCambiarClave`) MUST be ignored. All field
errors MUST be shown together and the submitted values kept.

#### Scenario: Invalid values are refused (table-driven)

| Field | Value | Error on |
|---|---|---|
| name | empty or whitespace only | name |
| name | 161 characters | name |
| email | empty or whitespace only | email (required) |
| email | `not-an-email`, `a@`, `a b@uni.edu` | email (invalid) |
| email | 161 characters | email (too long) |
| phone | 31 characters | phone |

- GIVEN an active docente and otherwise valid data
- WHEN submitted with the value from the row
- THEN nothing is written, no audit row exists and the field shows its message

#### Scenario: Boundaries and normalisation (table-driven)

| Submitted | Stored |
|---|---|
| name of exactly 160 characters | accepted as given |
| name `  Ana  Perez ` | `Ana  Perez` (outer spaces trimmed, inner kept) |
| email ` Ana.Perez@UNI.edu ` | `ana.perez@uni.edu` |
| phone of exactly 30 characters | accepted as given |
| phone `  555-0100 ` | `555-0100` |
| phone empty, docente had `555-0100` | no phone |
| phone empty, docente had none | no phone, and no change |

- GIVEN an active docente
- WHEN saved with the value from the row and a change elsewhere to make it a write
- THEN the stored value is as shown

#### Scenario: Only three fields are editable

- GIVEN a hand-crafted edit that also carries `login=x`, `hashClave=y`,
  `rol=administrador`, `activo=false`, `cif=1`, `carreraId=3`, `facultadId=2` and
  `debeCambiarClave=true`
- WHEN it is submitted with a valid new name
- THEN only the name changes and every other stored column is as before

#### Scenario: Errors are together and values kept

- GIVEN an empty name and an invalid email in one submit
- WHEN the action answers
- THEN both fields show their error at once and both submitted values are kept

#### Scenario: An email-less docente needs an email to be saved

- GIVEN an active docente created before the email was required, with no email
- WHEN the edit page opens
- THEN the email field is empty
- AND a save with a new name and no email is refused with the email-required
  error, while a save with a valid new email succeeds

### Requirement: DM-4 The email is unique across every role, ignoring case (RF-12 a, RF-09, RNF-01)

An email MUST NOT be saved when another account, of any role and in any state,
already holds it ignoring case and surrounding spaces. The docente's own account
is excluded from the comparison. The check MUST run inside the write transaction
(CM-NFR-2) and read the submitted value in its stored form. When the database
refuses the write because of its unique constraint (a concurrent writer stored the
same lower-case email first, SQLSTATE `23505`), the outcome MUST be the same field
error as the lookup gives, with nothing written and no audit row. The message MUST
be one generic text on the email field: it MUST NOT say which account, role, name
or state holds the address. An account with no email never matches. A save that
does not change the stored email makes no comparison, so a legacy pair that differs
only in case does not block a name or phone edit.

#### Scenario: Who blocks the email (table-driven)

| Other account holding `ana@uni.edu` | Submitted | Result |
|---|---|---|
| active docente | `ANA@uni.edu` | refused |
| inactive docente | `ana@uni.edu` | refused |
| `estudiante` | ` Ana@Uni.edu ` | refused |
| `coordinacion`, `secretaria` or `administrador` | `ana@uni.edu` | refused |
| none | `ana@uni.edu` | saved |
| an account whose email is empty | `ana@uni.edu` | saved |

- GIVEN a `secretaria` editing another active docente
- WHEN she submits the email from the row
- THEN the outcome is as shown, and a refusal writes nothing and no audit row

#### Scenario: The docente's own email is not a duplicate

- GIVEN a docente whose stored email is `ana@uni.edu`
- WHEN a save submits `ANA@uni.edu` together with a new name
- THEN it is accepted and the email stays `ana@uni.edu`

#### Scenario: A mixed-case legacy row is caught by the lookup [PG]

- GIVEN another account stored with `Ana@Uni.edu`, which the case-sensitive
  database constraint does not see as equal to `ana@uni.edu`
- WHEN a docente is saved with `ana@uni.edu`
- THEN the save is refused with the email error and nothing is written

#### Scenario: Re-saving an own mixed-case email [PG]

- GIVEN a docente stored with `Ana@Uni.edu` and no other account holding that
  address in any case
- WHEN a save submits `ana@uni.edu`
- THEN it is accepted, the stored email is lower case and the change is the field
  `correo`

#### Scenario: Concurrent writers of the same email [PG]

- GIVEN two requests that store `new@uni.edu`, one an edit of a docente and the
  other the creation of an account at `/users/new` (or a student registration)
- WHEN they run at the same time
- THEN exactly one commits; the other is refused with its ordinary duplicate-email
  message (the field error for the edit), with no partial write and no audit row

#### Scenario: Generic message

- GIVEN an email held by a `coordinacion` account
- WHEN a docente is saved with it
- THEN the message does not contain the word coordinacion, any name, or any state

### Requirement: DM-5 Login and credentials never change; sign-in follows the email (RF-12 a, RNF-05, RF-09)

An edit MUST NOT change `Login`, `HashClave`, `DebeCambiarClave`, the role, `Cif`,
`CarreraId`, `FacultadId` or `Activo`. `Login` stays as stored because it is the
key of the live sessions (profile, change password) and of the Users list
(`users-listing` FE-30). Sign-in is by email (`auth-entry-access`): a new email
MUST work at once with the unchanged password, and the old email MUST stop working
with the generic sign-in failure. A live session of the edited docente MUST keep
working.

#### Scenario: Everything but three fields is untouched [PG]

- GIVEN an imported docente with a temporary hash, `DebeCambiarClave` true and a
  stored `Login` equal to the old email
- WHEN a save changes the name, the email and the phone
- THEN every column of the row other than those three is byte-identical to before,
  including `Login`, `HashClave`, `DebeCambiarClave`, role and `Activo`

#### Scenario: New email signs in at once, old email does not [PG]

- GIVEN a docente with email `old@uni.edu` and password P
- WHEN the email is saved as `new@uni.edu` and then each address is submitted at
  sign-in with P
- THEN `new@uni.edu` with P signs in
- AND `old@uni.edu` with P fails with the generic sign-in failure, the same one
  as for a wrong password

#### Scenario: The Users list keeps the stored login [PG]

- GIVEN the email edit above
- WHEN a `secretaria` opens `/users`
- THEN the row of that docente still shows the stored `Login` (`old@uni.edu`)

#### Scenario: A live session survives the edit

- GIVEN a docente with an open session
- WHEN a `secretaria` saves a new email for that docente
- THEN the docente's profile and change-password pages keep resolving for that
  session

### Requirement: DM-6 Outcomes of saving an edit (RF-12 a)

An edit that changes at least one field MUST store all submitted changes in one
write and send the maintainer back to `/catalog/docentes`, where the new values
show. An edit that changes no field MUST write nothing, write no audit row and
tell the user that nothing changed. "No change" is judged on the normalised
values (trimmed, lower-case email) against the stored ones, inside the
transaction. An inactive docente MUST NOT be editable: its edit page MUST show the
three fields read-only together with the reactivate action, and an edit submitted
for it MUST be refused with a message saying to reactivate it first, with nothing
written. The import still updates the name and phone of an inactive docente (A3);
"read-only" governs manual edits only.

#### Scenario: Successful edit

- GIVEN an active docente
- WHEN a valid new name, email and phone are submitted
- THEN all three are stored and the Docentes list shows the new name and email

#### Scenario: No-change submit writes nothing

- GIVEN an active docente `Ana Perez`, `ana@uni.edu`, `555-0100`
- WHEN the form is submitted with those values, or with `  Ana Perez `,
  `ANA@uni.edu` and `555-0100 `
- THEN nothing is written, no audit row exists and a "no changes" message shows

#### Scenario: Inactive docente is read-only

- GIVEN an inactive docente
- WHEN the edit page is opened
- THEN the name, email and phone are not editable, the state is shown as text,
  and a reactivate action is offered

#### Scenario: Edit of an inactive docente is refused

- GIVEN an inactive docente and a hand-crafted valid edit for it
- WHEN the action runs
- THEN it is refused with the "reactivate it first" message, nothing is written
  and no audit row exists

#### Scenario: The docente vanishes between open and submit

- GIVEN an edit form opened for an active docente
- WHEN the account no longer exists, or is no longer a docente, at submit time
- THEN the outcome is "not found" and nothing is written

### Requirement: DM-7 Deactivation asks for confirmation and deletes nothing (RF-12 a b, RNF-12, RNF-04, RN-27)

Deactivating a docente MUST set `Activo` false and MUST NOT delete the account or
change any other column. It MUST be a mutation sent by form POST with a closed
intent (`deactivate` or `reactivate`), never a GET, and any other intent MUST be
"not found" with nothing written. It MUST require an explicit confirmation step
that names the docente (name and email, to tell homonyms apart), states that
nothing is deleted, that their grupos and remissions are kept and that the docente
can be reactivated, and shows the number of active grupos (DM-8); cancelling MUST
leave the record unchanged and write no audit row. Deactivation MUST NOT touch any
`Grupo`, `Inscripcion`, `SolicitudAsignatura` or `remision` row. A docente
deactivated stops being able to start a sign-in (generic sign-in failure); a live
session is not revoked by this change and ends at its normal expiry (recorded
residual: a docente opens only home, profile and change password). Deactivating an
already inactive docente MUST write nothing and write no audit row, and the user
is told it is already inactive.

#### Scenario: GET never mutates

- GIVEN the edit page and the actions
- WHEN they are requested with GET, including a link prefetch
- THEN no record changes state

#### Scenario: Confirmation names the docente

- GIVEN an active docente `Ana Perez`, `ana@uni.edu`, with no active grupo
- WHEN the secretaria chooses to deactivate
- THEN the confirmation names Ana Perez and her email, says nothing is deleted,
  that grupos and remissions are kept and that she can be reactivated
- AND no change has been made yet

#### Scenario: Cancel leaves the record

- GIVEN the confirmation step
- WHEN the user cancels
- THEN `Activo` is unchanged and no audit row exists

#### Scenario: Deactivation with no active grupo

- GIVEN an active docente whose grupos are all inactive, or who has none
- WHEN the secretaria confirms
- THEN `Activo` is false, the row remains, and the default (active) Docentes
  list no longer shows it while the `inactive` filter does

#### Scenario: Deactivation touches nothing else [PG]

- GIVEN an active docente with 4 inactive grupos, 12 inscripciones in them, 2
  filed requests and 3 remissions
- WHEN the docente is deactivated
- THEN every `Grupo`, `Inscripcion`, `SolicitudAsignatura` and `remision` row is
  unchanged, and the docente's other columns are unchanged

#### Scenario: Intent is closed (table-driven)

| `intent` | Result |
|---|---|
| `deactivate` | deactivation |
| `reactivate` | reactivation |
| absent, empty, `delete`, `DEACTIVATE`, `true` | not found, nothing written |

- GIVEN a `secretaria` and an existing docente
- WHEN the toggle action is submitted with the value from the row
- THEN the outcome is as shown

#### Scenario: Already inactive

- GIVEN an inactive docente
- WHEN a deactivate request arrives (for example from a stale tab)
- THEN nothing is written, no audit row exists and the user is told it is already
  inactive

#### Scenario: Sign-in after deactivation

- GIVEN a deactivated docente who submits the correct email and password
- WHEN sign-in runs
- THEN it fails with the generic sign-in failure

### Requirement: DM-8 A docente with active grupos cannot be deactivated (D2; RF-12 b)

Deactivation MUST be refused when the docente has one or more active grupos (as
defined in the Vocabulary). The count and the deactivation MUST be evaluated in
the same transaction, under the catalog write lock (DM-10). The refusal MUST state
how many active grupos there are, MUST say that they must first be reassigned to
another docente (editing each grupo) or deactivated, and MUST suggest deactivating
the grupos of closed periods and reassigning the current ones. It SHOULD point to
the Asignaturas search, which finds grupos by docente name (CM-ASG-9). A refusal
writes nothing, writes no audit row and changes no grupo. There is no cascade.

#### Scenario: Count of active grupos (table-driven)

| Grupos naming the docente | Result |
|---|---|
| none | deactivated |
| 5 inactive | deactivated |
| 3 active | refused, count 3 |
| 2 active and 5 inactive | refused, count 2 |
| 1 active of `2024-S1`, a closed period | refused, count 1 |
| 1 active whose Asignatura is inactive | refused, count 1 |
| 4 active, all naming another docente | deactivated |

- GIVEN an active docente and the grupos from the row
- WHEN the secretaria confirms the deactivation
- THEN the outcome is as shown [PG]

#### Scenario: The refusal message is actionable (table-driven)

| Count | Message must contain |
|---|---|
| 1 | the number 1 in singular wording, the remedy "reassign it or deactivate it first" |
| 3 | the number 3 in plural wording, the remedy "reassign them or deactivate them first" |

- GIVEN a refusal in `es` and in `en`
- WHEN the message is rendered
- THEN it states the count, both remedies and the closed-period versus current
  hint, and contains no name or email of any other account

#### Scenario: A refusal changes nothing [PG]

- GIVEN a docente with 3 active grupos
- WHEN the deactivation is refused
- THEN the docente is still active, the 3 grupos are still active and still name
  the docente (no cascade), and the audit log has no new row

#### Scenario: Reassign, then deactivate [PG]

- GIVEN a docente with 2 active grupos and another active docente
- WHEN the secretaria changes the docente of both grupos in the grupo edit and
  then confirms the deactivation
- THEN the deactivation succeeds and no active grupo names the deactivated docente

#### Scenario: Deactivate the grupos, then the docente [PG]

- GIVEN a docente with 2 active grupos
- WHEN the secretaria deactivates both grupos and then deactivates the docente
- THEN the deactivation succeeds and both grupos stay inactive

### Requirement: DM-9 Reactivation has no precondition (RF-12 a)

An inactive docente MAY be reactivated by a `secretaria`. Reactivation MUST set
`Activo` true, MUST NOT reactivate any grupo, MUST NOT change any other column,
and MUST be refused without a write and without an audit row when the docente is
already active (the user is told). After it, the docente is offered again in the
grupo options and can sign in.

#### Scenario: Reactivate

- GIVEN an inactive docente with 2 inactive grupos
- WHEN a `secretaria` reactivates the docente
- THEN `Activo` is true, both grupos stay inactive, and the docente appears in the
  grupo options and the default Docentes list

#### Scenario: Already active

- GIVEN an active docente
- WHEN a reactivate request arrives
- THEN nothing is written, no audit row exists and the user is told it is already
  active

#### Scenario: Sign-in after reactivation [PG]

- GIVEN a docente deactivated and then reactivated
- WHEN they submit their email and unchanged password
- THEN they sign in

#### Scenario: A grupo can then be reactivated [PG]

- GIVEN an inactive grupo whose docente is inactive, so its reactivation was
  refused (CM-GRP-4)
- WHEN the docente is reactivated and then the grupo is reactivated
- THEN both are active

### Requirement: DM-10 Writes are serialised with every catalog writer (CM-NFR-2, CM-NFR-4; RF-12 b)

Edit, deactivation and reactivation of a docente MUST run through the catalog
write lock, the same one that serialises grupo writes and the import apply, so
that "count the active grupos, then deactivate" cannot interleave with a grupo
create, a change of docente, a grupo reactivation or an import. Whatever the order
of two such writers, the stored result MUST satisfy: no active grupo names an
inactive docente (for writes made through the application after this change).
Concurrent edits of one docente are last-write-wins and each writes its own audit
row. A write that cannot start within the bounded wait MUST report "busy, nothing
was saved, try again", write nothing and no audit row, and be distinguishable from
validation, duplicate, not-found and unexpected-failure outcomes. Busy MUST NOT
bypass authorization.

#### Scenario: Deactivation versus a grupo write, both orders (table-driven) [PG]

| Other writer (docente D has 0 active grupos before) | Order | Result |
|---|---|---|
| create an active grupo naming D | deactivation first | grupo refused (docente inactive); D inactive |
| create an active grupo naming D | grupo first | deactivation refused, count 1; D active |
| change the docente of an active grupo to D | deactivation first | change refused; D inactive |
| change the docente of an active grupo to D | grupo first | deactivation refused, count 1 |
| reactivate an inactive grupo naming D | deactivation first | reactivation refused (docente inactive) |
| reactivate an inactive grupo naming D | grupo first | deactivation refused, count 1 |

- GIVEN the two writers started so that the first holds the lock
- WHEN the second one runs after it
- THEN the outcome is as shown, and in no row does an active grupo end up with an
  inactive docente

#### Scenario: Concurrent run never breaks the invariant [PG]

- GIVEN one docente with no active grupo and many iterations that start a grupo
  creation naming the docente and the docente's deactivation at the same time
- WHEN every iteration has finished
- THEN no iteration left an active grupo with an inactive docente

#### Scenario: Import confirm after a deactivation [PG]

- GIVEN a previewed workbook with no error whose Grupos rows name docente D, and D
  deactivated by a `secretaria` after the preview
- WHEN the import is confirmed
- THEN the re-plan under the lock reports `docente.inactive` for those rows, the
  apply writes nothing and D stays inactive

#### Scenario: Deactivation after an import that created grupos [PG]

- GIVEN an import apply that committed and created an active grupo for D
- WHEN D's deactivation is then confirmed
- THEN it is refused with count 1

#### Scenario: Two edits of one docente [PG]

- GIVEN two users who opened the same docente
- WHEN both submit different names
- THEN the later commit is stored and two audit rows exist

#### Scenario: Two deactivations [PG]

- GIVEN two simultaneous deactivations of the same docente with no active grupo
- WHEN both run
- THEN one writes the change and one audit row, and the other reports "already
  inactive" with no row

#### Scenario: Busy outcome per operation (table-driven) [PG]

| Operation |
|---|
| edit docente |
| deactivate docente |
| reactivate docente |

- GIVEN a valid request by a `secretaria` while another catalog write holds the
  lock longer than the bounded wait
- WHEN the operation from the row is submitted
- THEN the user is told it is busy and to try again, and no record changed and no
  audit row exists

#### Scenario: Busy does not bypass authorization

- GIVEN a `coordinacion` submitting an edit while catalog writes are busy
- WHEN the action runs
- THEN the caller is redirected to `/denied`, not shown the busy outcome

### Requirement: DM-11 A deactivated docente leaves every offer (RF-12 b)

A deactivated docente MUST NOT be offered anywhere a new choice is made. The grupo
form options (create and change of docente) list active docentes only, and a
hand-crafted selection of an inactive docente is refused (`academic-catalog`
"Manual writes require..."). Because deactivation requires no active grupo, no
class taught by the docente is offered to a student starting a new request or
declaring an enrollment. Records that already exist keep showing the docente's
name, read from the live account: filed requests, review screens, reports and
inactive grupos. The data stays: nothing is lost by deactivating.

#### Scenario: Grupo options exclude the inactive docente

- GIVEN an inactive docente `Ana Perez` and an active docente `Beto Ruiz`
- WHEN the options of the grupo create and edit forms are read
- THEN `Beto Ruiz` is offered and `Ana Perez` is not

#### Scenario: A hand-crafted selection is refused

- GIVEN an inactive docente
- WHEN a grupo create, or a change of an active grupo's docente, names that docente
- THEN it is refused and nothing is stored

#### Scenario: The student offer after a deactivation [PG]

- GIVEN a docente whose active grupos were reassigned or deactivated and who was
  then deactivated, and a student with an active enrollment in one of the
  deactivated grupos
- WHEN the student's eligible groups for a new request and the enrollment offer are
  listed
- THEN no group taught by the deactivated docente is offered

#### Scenario: Existing records keep the name

- GIVEN a filed request whose subjects were taught by a docente who was later
  renamed and deactivated
- WHEN a secretaria reads the request, and a report row for it
- THEN both show the live name of the docente, and the request, its subjects and
  its documents are unchanged

#### Scenario: A grupo still under an inactive docente is not repaired

- GIVEN an active grupo that already names an inactive docente (created before
  this change by an import)
- WHEN the change is applied
- THEN the grupo and the docente are unchanged (A9), and reactivating the docente
  clears the inconsistency

### Requirement: DM-12 Existing remissions keep their snapshot (RF-09, RN-18, RN-19)

Editing a docente MUST NOT change any existing `remision` row: its recorded
recipient id, name and email stay as written at approval (`teacher-remission`
"Later email change"). A request approved after the edit MUST read the live name
and email. Deactivating a docente MUST NOT cancel or redirect a remission; a
request already filed whose remission is still to be sent keeps being sent to the
snapshot address (A6).

#### Scenario: Email edit leaves the snapshot [PG]

- GIVEN a remission created for docente T with email `old@uni.edu`
- WHEN T's email is saved as `new@uni.edu`
- THEN the remission still targets `old@uni.edu` and the resend uses the snapshot

#### Scenario: Next approval uses the new data [PG]

- GIVEN the same edit and a second request that names a grupo of T
- WHEN a secretaria approves it
- THEN its remission is addressed to `new@uni.edu` with T's current name

#### Scenario: Deactivation does not stop a pending remission [PG]

- GIVEN a remission of a filed request still `pendiente`, whose docente is then
  deactivated
- WHEN the dispatcher runs
- THEN the remission is sent to its snapshot address

### Requirement: DM-13 Interaction with the catalog import (D3; RNF-13 b)

The import never reactivates a docente and never writes `Activo`, `Correo`,
`Login`, `HashClave`, `DebeCambiarClave` or the role of an existing docente; a
Grupos row that names an inactive docente is a row error (`catalog-excel-import`
"Per-row validation..."). The import still updates the name and phone of a matched
docente, active or not, and wins over a manual edit of those two fields without a
warning (`catalog-excel-import` "Import precedence over manual edits"). Because
`Login` is not rewritten by an email edit, the previous email stays reserved by
`Login` while the account exists: a workbook row or a `/users/new` submit with the
old email as a new account is refused loudly, never silently duplicated.

#### Scenario: Inactive docente: grupo row refused, name still updated [PG]

- GIVEN an inactive docente D whose name differs in the workbook's Docentes sheet
- WHEN a workbook with that Docentes row and a Grupos row naming D is planned
- THEN the Grupos row is a `docente.inactive` error and the Docentes row is
  counted `update`
- AND when the workbook without the Grupos row naming D is applied, D's name is
  updated and D stays inactive

#### Scenario: Import wins over a manual name and phone [PG]

- GIVEN a docente whose name and phone were edited manually and a workbook with
  the earlier name and phone for the same email
- WHEN it is applied
- THEN the name and phone are the workbook's, counted `update`, with no extra
  warning, and the email and `Activo` are unchanged

#### Scenario: The old email in a workbook after an email edit [PG]

- GIVEN a docente created with `old@uni.edu` (so `Login` is `old@uni.edu`) whose
  email was then saved as `new@uni.edu`
- WHEN a workbook lists `old@uni.edu` in its Docentes sheet
- THEN that row is a `login.collision` error, nothing is created and no second
  account exists

#### Scenario: The new email in a workbook matches the account [PG]

- GIVEN the same docente
- WHEN a workbook lists `new@uni.edu` with the stored name and phone
- THEN the row is `unchanged` and no account is created

#### Scenario: The old email on the creation form [PG]

- GIVEN the same docente
- WHEN a `secretaria` submits `/users/new` for a docente with `old@uni.edu`
- THEN no account is created and the ordinary form error is shown, with no
  redirect to the denied screen

### Requirement: DM-14 Audit: one row per successful docente write (RNF-06 a)

Every successful edit (with at least one changed field), deactivation and
reactivation of a docente MUST write exactly one audit row, in the same
transaction as the data change, as specified in `audit-log` DM-AUD-1 to DM-AUD-3.
A refused, invalid, unauthorized, no-op, busy or failed write MUST write none.
Opening the edit page writes no row (A4).

#### Scenario: One row per write (table-driven) [PG]

| Write | Audit rows added |
|---|---|
| edit changing only the phone | 1 (`usuario.actualizado`, one field) |
| edit changing name, email and phone | 1 (`usuario.actualizado`, three fields) |
| deactivate | 1 (`usuario.desactivado`) |
| reactivate | 1 (`usuario.reactivado`) |

- GIVEN a `secretaria` and a docente
- WHEN the write from the row succeeds
- THEN exactly the rows in the row exist, with the session user as actor, entity
  type `Usuario` and the docente's id

#### Scenario: Writes that must leave no row (table-driven) [PG]

| Case |
|---|
| validation failure |
| duplicate email (lookup and `23505`) |
| deactivation refused with active grupos |
| edit with no changed field |
| edit of an inactive docente |
| deactivate an already inactive docente |
| reactivate an already active docente |
| not found (other role, malformed id, closed intent) |
| unauthorized role |
| the write cannot start because catalog writes are busy |
| the data write fails |
| the audit insert fails |

- GIVEN the case from the row
- WHEN the action runs
- THEN no audit row exists for it and the data is as before

#### Scenario: The audit insert fails [PG]

- GIVEN a valid edit and an audit insert that is made to fail
- WHEN the transaction runs
- THEN the docente is unchanged and no audit row exists

#### Scenario: Opening the edit page writes nothing

- GIVEN a `secretaria`
- WHEN she opens the edit page of a docente
- THEN the audit log gains no row

### Requirement: DM-15 Privacy: no email, phone or name in audit rows or logs (RNF-02, RNF-06, RN-02)

No audit row written by a docente write or by the account creation of the staff
form (`staff-account-creation` SAC-AUD-1) MUST contain a name, an email or a phone,
old or new. No log line of a failed write MUST contain them: the catalog failure
line carries the actor id, the error name and the SQLSTATE only. The phone MUST be
shown only on the edit page: no list row, no option of any select, no other screen
and no audit row carries it. Names and emails appear on the confirmation of a
deactivation because it is the page of that record, and in no other new surface.

#### Scenario: Sentinel values never reach the audit log or logs [PG]

- GIVEN a docente edited from `Sentinel Name`, `sentinel-old@uni.edu`, `555-0001`
  to `Other Name`, `sentinel-new@uni.edu`, `555-0002`, then deactivated and
  reactivated, and one more edit forced to fail
- WHEN every audit payload written, and every line logged by the failure, is
  serialized and searched for the six values and for `HashClave`
- THEN none is found

#### Scenario: The phone appears only on the edit page

- GIVEN a docente with phone `555-0002`
- WHEN the Docentes list, the Users list, the grupo options and the edit page are
  rendered and their delivered data serialized
- THEN `555-0002` appears only in the edit page

### Requirement: DM-16 Copy in both locales (CM-I18N-1)

Every user-visible string of the new screens and actions (labels, headings,
states, validation and refusal messages, confirmation text, notices) MUST come
from the `es` and `en` catalogs, with identical key sets. A refusal message MUST
say what happened and what to do next. The edit page MUST carry three notices:
that the email is where remissions for this docente are sent and the address the
docente signs in with; that the Users list keeps showing the earlier login and that
the earlier address stays reserved for as long as the account exists; and that the
next catalog import may replace the name and phone (the existing "import wins"
text).

#### Scenario: Key parity

- GIVEN the `es` and `en` catalogs
- WHEN their key sets are compared
- THEN they are identical, including every key used by the docente actions

#### Scenario: Refusals are actionable (table-driven)

| Refusal | Message must say |
|---|---|
| deactivate with active grupos | how many, to reassign or deactivate them first, and the closed-period hint |
| email already used | that the email is already used by another account and to enter another |
| edit of an inactive docente | that it must be reactivated first |
| deactivate an inactive docente | that it is already inactive |
| reactivate an active docente | that it is already active |
| write cannot start (busy) | that nothing was saved and to try again |
| not found | that the docente no longer exists or cannot be maintained |
| no change | that nothing changed |

- GIVEN the refusal from the row
- WHEN shown in either locale
- THEN it contains the content from the row

#### Scenario: The three notices are on the edit page

- GIVEN an active docente
- WHEN the edit page renders in either locale
- THEN the email-effect notice, the earlier-login notice and the import-wins notice
  are all present

### Requirement: DM-17 Accessibility and narrow width (CM-NFR-3)

The edit page, its confirmation step and the list's actions column MUST meet
`docs/design-system.md` section 7 as the other catalog screens do (the confirmation
is the two-step control in the page of section 5, not a modal): contrast 4.5:1
(3:1 for large text and UI borders), a visible focus ring, meaning never by colour
alone (state is text), targets of at least 44x44 px, one `h1` and no skipped
level, and form errors tied to their fields and announced. At 360 px width the edit
page and its confirmation MUST NOT scroll the page horizontally, and at 320 px they
MUST NOT clip or overlap text or controls. A wide table scrolls inside its own
container as the other catalog lists do. RNF-11 itself is a student-screen rule;
this is the shell floor of `backoffice-shell` BS-RSP-1 applied to the new screens,
verified by structural tests of the responsive classes and manually.

#### Scenario: State is text

- GIVEN a list with active and inactive docentes
- WHEN rendered for a `secretaria`
- THEN every row carries the word "Active" or "Inactive" in the user's language

#### Scenario: Heading structure and errors

- GIVEN the edit page with an invalid submit
- WHEN rendered
- THEN there is exactly one `h1`, no skipped level, and each error is associated
  with its field and announced

#### Scenario: Narrow viewport

- GIVEN a 360 px viewport (and a 320 px one)
- WHEN the edit page and the confirmation are rendered
- THEN the page does not scroll horizontally (360 px) and nothing is clipped
  (320 px)

### Requirement: DM-18 Nothing is deleted and the schema is unchanged (CM-NFR-1)

The module MUST NOT issue a `DELETE` or `TRUNCATE` against `Usuario`, `Grupo`,
`Inscripcion` or the audit log: "deactivate" is `Activo` false. The change MUST
add no migration, column, constraint, dependency or environment variable. It does
not reset a password, does not end a live session, does not edit any role other
than `docente` and does not give docentes a scope by facultad.

#### Scenario: Row counts never fall [PG]

- GIVEN any sequence of edits, deactivations, reactivations and refusals
- WHEN it completes
- THEN the row count of every table is never lower than before

#### Scenario: No schema change

- GIVEN the migrations folder and the schema
- WHEN compared with `main` before this change
- THEN they are identical

## Assumptions and open questions

Carried from the proposal (A1 to A6 stand) and added by this spec.

- **A1.** The email is required on every save and cannot be cleared, as at
  creation (DM-3). A docente with no email can therefore only be saved by giving
  one.
- **A2.** Reactivation has no precondition and reactivates no grupo (DM-9).
- **A3.** The import still updates the name and phone of an inactive docente
  (DM-6, DM-13).
- **A4.** Opening the edit page writes no audit row (DM-14).
- **A5.** The phone is shown only on the edit page; the list stays minimal
  (DM-15).
- **A6.** An inactive docente still receives remissions of requests already filed
  (DM-12).
- **A7 (added).** The two toggle actions are the codes `usuario.desactivado` and
  `usuario.reactivado`. The proposal left the toggle codes to design; this spec
  fixes them because a payload of field names only cannot tell a deactivation from
  a reactivation (see `audit-log` DM-AUD-1). *Assumption.*
- **A8 (added).** Re-saving an own mixed-case email in lower case is a change of
  `correo` (DM-4). *Assumption.*
- **A9 (added).** Active grupos that already name an inactive docente (possible
  before D3) are neither listed nor repaired by this change; the proposal asks for
  a read-only count before the tracker merges. Reactivating the docente is the
  remedy. *Assumption.*
- **A10 (added).** The count of DM-8 includes grupos of every `Periodo` and of
  inactive Asignaturas, because the secretaria can always deactivate such a grupo
  but cannot reassign one whose Asignatura is inactive. *Assumption.*
- **Out of scope.** Password reset, immediate revocation of a live session, editing
  other roles, scope of docentes by facultad, RN-22 clock hours, thesis edits.
