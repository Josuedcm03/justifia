# Normative Parameters Specification (new capability)

> Delta type: this whole file is ADDED. There is no base spec for
> `normative-parameters`; `sdd-archive` promotes it to
> `openspec/specs/normative-parameters/spec.md`. Deltas of the consumers sit
> beside it: `request-review`, `validation-signals`, `justification-intake`,
> `supporting-documents`, `audit-log`, `backoffice-shell`.
>
> Scope cuts (owner, 2026-11-27): this spec carries only what is needed to
> declare RNF-14 met. Removed from the earlier text: the 25 MiB ceiling and
> migration 0018 (the range of `tamano_maximo_mib` is 1 to 10 MiB), the
> two-step confirmation of every save, the Reglamento default and the range in
> words on the screen, the per-year date counts, the current-year warning, the
> degraded locked forms, the narrow-width requirement of the staff page and the
> per-family Postgres cases of NP-14. See `proposal.md`, "Scope cuts".

## Purpose

RNF-14: "a change in the deadlines, the calendar of non-business days, the causes,
the recurrence threshold or the maximum file size does not require a new
deployment". This capability turns those five families, plus the RN-13
type-to-cause map, into data stored in the table of thesis Table D19
(`ParametroNormativo`), read on every request with a per-key fallback to the
Reglamento default, and edited by the `secretaria` on one screen (thesis CU-13).
Deactivating a cause asks for confirmation (RNF-12); each change writes one audit
row (RNF-06) and is applied by the next request, with no restart and no deploy.

Requirements covered: RNF-14, RN-01, RN-04, RN-07, RN-08, RN-13, RN-14, RN-23,
RNF-01, RNF-06, RNF-12. Thesis: CU-13, Annex D Table D19, section 5.1 Table 14
("Parametros normativos" module).

Out of scope: creating causes and editing cause labels (codes stay fixed, future
work); the retention period (RNF-04, RN-27); operational constants
(`MAX_DOCUMENTS_PER_DRAFT`, draft expiry, import file limit); the coordination
report (RF-13 c) keeps reading its own defaults; raising the maximum file size
above 10 MiB (it needs a migration of the database check, not part of RNF-14).

Vocabulary:

- **Parameter**: one value addressed by a key of the registry (NP-2).
- **Row in force** of a key: the row with the latest `VigenteDesde` not after today.
- **Today**: the current date in America/Managua (UTC-6, no daylight saving).
- **Default**: the Reglamento baseline value of a key, defined in code (NP-2, NP-15).
- **Maintainer**: a signed-in `secretaria`.
- **[PG]** in a scenario: it MUST be proven on a real PostgreSQL, on a disposable
  branch and never on production, by the integration suite. Scenarios without the
  mark are provable with unit or component tests and doubles.

## Requirements

### Requirement: NP-1 The store is exactly the table of Table D19 (RNF-14; CU-13, Table D19)

The system MUST store parameters in one table `ParametroNormativo` with exactly
these columns: `Id`, `Clave` (varchar 60), `Valor` (jsonb), `VigenteDesde`
(date), and a unique constraint on (`Clave`, `VigenteDesde`). The table MUST
carry no other column (no version, author or timestamp column): who changed what
and when is the audit log's job (NP-9). The table MUST be created by a migration
that is additive: existing tables and rows are untouched by it.

#### Scenario: Column set is exactly Table D19

- GIVEN the schema definition and the migration that creates the table
- WHEN their columns are listed
- THEN they are `Id`, `Clave`, `Valor`, `VigenteDesde` and nothing else, and the
  unique constraint covers `Clave` and `VigenteDesde`

#### Scenario: One row per key and day [PG]

- GIVEN a row for key K with `VigenteDesde` 2026-11-27
- WHEN another row for K with the same date is inserted directly
- THEN the database refuses it, and a row for K with another date is accepted

#### Scenario: Key length [PG]

- GIVEN a key of 61 characters
- WHEN it is inserted directly
- THEN the database refuses it, and a key of 60 characters is accepted

#### Scenario: Migration is additive

- GIVEN the migration text
- WHEN it is scanned for statements that alter or drop an existing table or column
- THEN none is found in the migration that creates `ParametroNormativo`, and this
  change adds no other migration (the document-size check is not touched)

### Requirement: NP-2 A closed registry fixes each key, default and range (RNF-14, RN-01, RN-04, RN-07, RN-08, RN-13, RN-14, RN-23; CU-13, Table D19)

The system MUST hold a closed registry of keys. Each key MUST have a validation
schema, a default and, for scalars, an inclusive integer range. A write or a read
of a key outside the registry MUST be refused (write) or ignored (loader). A
scalar value MUST be a JSON integer: a decimal, a string, a boolean or null MUST
fail validation. The registry MUST be:

| Key | Rule | Meaning | Default | Range |
|---|---|---|---|---|
| `plazo_remision_dias` | RN-08 | business days to remit to the teacher | 2 | 1 to 10 |
| `alerta_dias` | RN-08 | alert when this many business days or fewer remain | 1 | 0 to 10 |
| `presentacion_tardia_dias` | RN-07 | business days after the end date before a filing is late | 2 | 1 to 10 |
| `ventana_presentacion_dias` | RN-23 | calendar days an end date may precede filing | 30 | 1 to 365 |
| `umbral_reincidencia` | RN-14 | requests of one issuer that raise recurrence | 3 | 2 to 20 |
| `tamano_maximo_mib` | RN-04 | maximum document size in MiB (1 MiB = 1 048 576 bytes) | 10 | 1 to 10 |
| `calendario` | RN-08 | non-business dates (NP-10) | the 2026 and 2027 dates of the current calendar | see NP-10 |
| `causas` | RN-01 | active flag and order of the five causes (NP-11) | five causes active, current order | see NP-11 |
| `tipo_documento_causa` | RN-13 | causes each document type corresponds to (NP-12) | the current table | see NP-12 |

#### Scenario: Range boundaries (table-driven)

| Key | Accepted | Refused |
|---|---|---|
| `plazo_remision_dias` | 1, 10 | 0, 11 |
| `alerta_dias` | 0, 10 | -1, 11 |
| `presentacion_tardia_dias` | 1, 10 | 0, 11 |
| `ventana_presentacion_dias` | 1, 365 | 0, 366 |
| `umbral_reincidencia` | 2, 20 | 1, 21 |
| `tamano_maximo_mib` | 1, 10 | 0, 11 |

- GIVEN the validation schema of the key in the row
- WHEN each value is validated
- THEN the accepted values pass and the refused values fail

#### Scenario: The size range ends at the existing database check

- GIVEN the registry maximum of `tamano_maximo_mib` and the document-size check in `src/db/schema.ts` (`CK_Documento_Tamano`, 10 485 760 bytes)
- WHEN a source scan multiplies the registry maximum in MiB by 1 048 576 and reads the number of the check
- THEN both are 10 485 760, so every accepted value can be stored and no migration is needed

#### Scenario: The alert stays below the remission deadline

- GIVEN `plazo_remision_dias` in force is 2
- WHEN a save of `alerta_dias` = 2 is attempted, or a save of `plazo_remision_dias` = 1 while `alerta_dias` in force is 1
- THEN the write is refused with a field error, nothing is written, and no audit row is added
- AND `alerta_dias` = 1 with `plazo_remision_dias` = 2 is accepted

#### Scenario: Only integers

- GIVEN `plazo_remision_dias` validated with `2.5`, `"2"`, `true` and `null`
- WHEN each is validated
- THEN every one fails

#### Scenario: Defaults equal the current baseline (table-driven)

| Key | Default |
|---|---|
| `plazo_remision_dias`, `presentacion_tardia_dias` | 2 |
| `alerta_dias` | 1 |
| `ventana_presentacion_dias` | 30 |
| `umbral_reincidencia` | 3 |
| `tamano_maximo_mib` | 10 |

- GIVEN the registry
- WHEN each default is read
- THEN it equals the value in the row, and every default passes its own schema

#### Scenario: Unknown key

- GIVEN a write addressed to the key `inventada`
- WHEN the server validates it
- THEN it is refused and nothing is written

### Requirement: NP-3 A save is effective from today and history is kept (RNF-14, D5; CU-13, Table D19)

A successful save of a key MUST insert one row for that key with `VigenteDesde`
equal to today in Managua. A second successful save of the same key on the same
day MUST replace that day's row, so that exactly one row exists for the key and
that day. Rows of earlier days MUST be kept untouched. The system MUST NOT delete
rows of earlier days and MUST NOT write a row dated in the future.

#### Scenario: First save of the day [PG]

- GIVEN key `umbral_reincidencia` with its seed row dated before today
- WHEN the maintainer saves 2
- THEN a row with value 2 and `VigenteDesde` today exists, and the seed row is unchanged

#### Scenario: Second save the same day replaces [PG]

- GIVEN a save of `umbral_reincidencia` = 2 today
- WHEN the maintainer saves 4 the same day
- THEN exactly one row exists for the key and today, with value 4

#### Scenario: Next day adds a row, history kept [PG]

- GIVEN a row dated yesterday with value 2
- WHEN the maintainer saves 4 today
- THEN rows exist for yesterday (value 2) and today (value 4)

#### Scenario: Managua date, not UTC

- GIVEN a save made at 2026-11-28 03:00 UTC (2026-11-27 21:00 in Managua)
- WHEN the row is built
- THEN `VigenteDesde` is 2026-11-27

### Requirement: NP-4 The loader validates per key and falls back per key (RNF-14, RN-01, RN-04, RN-07, RN-08, RN-13, RN-14, RN-23; CU-13)

The loader MUST return, for every key of the registry, the value of the row in
force validated by the key's schema. When a key has no row in force, or its row
in force fails validation, or it cannot be read, the loader MUST return the
default of that key and MUST NOT use an older row. A failure of one key MUST NOT
change any other key. If the whole read fails, the loader MUST return every
default and MUST NOT throw. A fallback MUST be logged with the error name and the
key only, never the stored value. Rows of keys outside the registry MUST be ignored.

#### Scenario: Per-key outcome (table-driven)

| State of the key | Value returned |
|---|---|
| valid row in force | that value |
| no row | default |
| row in force invalid (`tamano_maximo_mib` = 99) | default |
| row in force of the wrong type (`umbral_reincidencia` = "3") | default |
| newest row invalid, older row valid | default (not the older row) |
| only a row dated tomorrow | default |

- GIVEN the state in the row, and valid rows for the other keys
- WHEN the loader runs
- THEN the key returns the value shown and the other keys return their own rows [PG]

#### Scenario: Latest row not after today wins [PG]

- GIVEN rows for one key dated 10 days ago (value 2), 1 day ago (value 4) and tomorrow (value 6)
- WHEN the loader runs
- THEN the value is 4

#### Scenario: A failing read is fail-soft

- GIVEN the database read throws
- WHEN the loader runs
- THEN it returns every default, does not throw, and the log line holds the error name and no value

#### Scenario: Unknown keys are ignored [PG]

- GIVEN a row with key `otra_cosa`
- WHEN the loader runs
- THEN the result has exactly the keys of the registry

### Requirement: NP-5 Parameters are read per request and never cached across requests (RNF-14; CU-13)

Every request MUST read the parameters it needs from the database at the page,
action or route boundary. Within one render the loader result MUST be shared
(deduplicated) so one render does not repeat the read. The system MUST NOT keep a
parameter value in memory between two requests (no module-level variable, no
framework data cache, no timed cache). A saved value MUST therefore be visible to
the next request of any server instance.

#### Scenario: Next request sees the change [PG]

- GIVEN a loader call in one request scope, then a save of `alerta_dias` = 2, then a loader call in a new request scope of the same process
- WHEN the second call returns
- THEN it returns 2

#### Scenario: One read per render

- GIVEN two consumers in one render that both ask for the parameters
- WHEN the render runs with the database read counted
- THEN the read happens once

#### Scenario: No cross-request cache

- GIVEN the parameters module
- WHEN it is scanned
- THEN it uses no `unstable_cache`, no `use cache` directive, no module-level store and no timer

### Requirement: NP-6 Only the secretaria edits, enforced on the server (RNF-01; CU-13)

Opening `/parameters` and every write action MUST be available to `secretaria`
only. Any `secretaria` MAY edit, including one whose own `Facultad` is empty, because
parameters have no facultad scope. The role predicate MUST live in
`src/lib/auth/permissions.ts` (`canManageParameters`). Every entry point MUST decide
authentication, forced password change and role before it reads parameter data and
before it reads the request body. The loader read used by consumers is not an entry
point and MUST NOT be gated by role.

#### Scenario: Role matrix (table-driven)

| Identity | Page | Write action |
|---|---|---|
| `secretaria` | allowed | allowed |
| `administrador`, `coordinacion`, `docente`, `estudiante` | denied (`/denied`) | denied (`/denied`) |
| anonymous | denied (`/login`) | denied (`/login`) |
| flagged for password change | `/change-password` | `/change-password` |

- GIVEN the identity in the row
- WHEN it opens the page or calls the action directly, including a hand-crafted request
- THEN the outcome is as shown, and a denied caller causes no parameter read, no body parsing, no write and no audit row

#### Scenario: Secretaria without facultad

- GIVEN a `secretaria` whose `FacultadId` is null
- WHEN she opens `/parameters` and saves a valid value
- THEN both succeed

#### Scenario: The access matrix covers every new entry point

- GIVEN the access matrix of `route-access-coverage`
- WHEN it is read
- THEN it holds one row for `/parameters` and one row per server-action module added, each allowing only `secretaria`, by URL and by direct request

#### Scenario: Consumers are not role-gated

- GIVEN a `estudiante` filing a request and a `coordinacion` reading a report that depend on parameters
- WHEN they run
- THEN the loader serves them without a role check

### Requirement: NP-7 One screen edits the families (CU-13, RNF-14, RN-01, RN-04, RN-07, RN-08, RN-13, RN-14, RN-23; Table D19)

`/parameters` MUST present four sections: deadlines and limits (the six scalar
keys), calendar (NP-10), document type to cause (NP-12) and causes (NP-11). Each
scalar MUST show its value in force. Validation MUST run on the server, show every
field error at once, keep the submitted values and say what to enter, stating the
allowed range (minimum and maximum) in the message. The screen MUST NOT show the
Reglamento default, the range in words, a "default in use" mark, per-year date
counts or a current-year warning, and MUST NOT lock its forms when a read falls
back. Opening the page MUST write no audit row and no data.

#### Scenario: Scalars shown with the value in force

- GIVEN a `secretaria` and `umbral_reincidencia` with value 4
- WHEN she opens the page
- THEN the field shows 4

#### Scenario: Valid save

- GIVEN the scalars form
- WHEN `plazo_remision_dias` = 3 is saved
- THEN the value is stored, the page shows 3 and the next request applies it

#### Scenario: Errors together, values kept (table-driven)

| Field | Submitted | Error |
|---|---|---|
| `plazo_remision_dias` | empty | required |
| `ventana_presentacion_dias` | `abc` | not a whole number |
| `tamano_maximo_mib` | 11 | above the maximum of 10 |
| `umbral_reincidencia` | 1 | below the minimum of 2 |

- GIVEN one submit carrying two of the rows
- WHEN the action answers
- THEN both errors show at once, each message states the allowed range of its field, the typed values are kept and nothing is stored

#### Scenario: Opening the page writes nothing

- GIVEN a `secretaria`
- WHEN she opens `/parameters`
- THEN no parameter row and no audit row is written

### Requirement: NP-8 Deactivating a cause asks for confirmation (RNF-12, RNF-14; CU-13)

RNF-12 asks for a confirmation dialog only to reject a request and to deactivate
a record. Accordingly, a save that deactivates a cause MUST first ask for explicit
confirmation in the application's existing confirmation dialog (the alert dialog
that the review screen uses to reject a request and the catalog uses to deactivate
a record), which MUST name the cause. Cancelling MUST submit nothing: no parameter
row and no audit row. Every other save (the six scalars, the calendar, the
type-to-cause map, and a causes save that only reorders or activates) MUST be
submitted directly: no confirmation step, no hidden confirmation field, no list of
the changes. The server MUST NOT require a confirmation marker.

#### Scenario: Deactivation asks first

- GIVEN `medica` active and the causes form with `medica` unchecked
- WHEN the maintainer presses save
- THEN the confirmation dialog names `medica`, and nothing has been stored yet

#### Scenario: Cancel changes nothing

- GIVEN the confirmation dialog of a deactivation
- WHEN the maintainer cancels
- THEN no action is called, no parameter row and no audit row exists for it, and the form still shows the typed values

#### Scenario: Confirm saves

- GIVEN the confirmation dialog of a deactivation
- WHEN the maintainer confirms
- THEN the causes form is submitted once and the save proceeds as in NP-9

#### Scenario: Other saves are direct

- GIVEN `alerta_dias` changed from 1 to 2, or a causes form that only reorders
- WHEN the maintainer submits the form
- THEN the save runs at once, with no confirmation step, and the outcome is shown

### Requirement: NP-9 A save is one guarded transaction with its audit row (RNF-06, RNF-14; CU-13)

A save MUST run through the catalog write lock and one transaction that
holds the parameter rows and their audit rows (per `audit-log` NP-AUD-1 to
NP-AUD-3). A save that changes several keys MUST write one parameter row and one
audit row per changed key, all in that transaction. A save whose validated value
equals the value in force MUST write nothing, write no audit row and tell the user
that nothing changed. A write that cannot start within the bounded wait MUST
report "busy, nothing was saved, try again", write nothing, and be distinguishable
from validation, no-change and unexpected failure. Busy MUST NOT bypass
authorization. Concurrent saves of one key are last-write-wins and each writes its
own audit row.

#### Scenario: No change writes nothing

- GIVEN `alerta_dias` in force with value 1
- WHEN the maintainer saves 1
- THEN no parameter row and no audit row is written and a "no changes" message shows

#### Scenario: Two keys in one save [PG]

- GIVEN a save changing `alerta_dias` and `umbral_reincidencia`
- WHEN it commits
- THEN two parameter rows and exactly two audit rows exist, one per key

#### Scenario: Audit failure rolls back [PG]

- GIVEN a valid save whose audit insert is made to fail
- WHEN the transaction runs
- THEN the parameter row is not written and no audit row remains

#### Scenario: Busy outcome [PG]

- GIVEN another catalog write holds the lock longer than the bounded wait
- WHEN the maintainer saves a valid value
- THEN she is told it is busy and to try again, and no row of either table is written

#### Scenario: Busy does not bypass authorization

- GIVEN a `coordinacion` submitting a save while catalog writes are busy
- WHEN the action runs
- THEN the caller is redirected to `/denied`, not shown the busy outcome

### Requirement: NP-10 The calendar of non-business days is data (RN-08, RN-07, RNF-14; CU-13, Table D19)

The key `calendario` MUST hold a list of entries, each with an ISO calendar date
and an optional description of at most 120 characters. A date MUST be a real
calendar date and MUST NOT appear twice. The maintainer MUST be able to add and
remove dates. Business-day logic MUST read the list through the existing
`NonWorkingDaysProvider` port: a date in the list is not a business day, and
`coversYear(y)` MUST be true when the list holds at least one date of year `y`
(the review queue keeps its calendar coverage notice, `request-review`). The
screen does not show counts per year and does not warn about the current year. A
save that removes or adds a date changes the deadlines and signals of every
request on the next read (NP-13).

#### Scenario: Added date is not a business day

- GIVEN a `pendiente` request presented Monday with remission days 2 and no listed holidays
- WHEN Tuesday is added to the calendar and the queue is read
- THEN the deadline moves from Wednesday to Thursday

#### Scenario: Removed date becomes a business day

- GIVEN Tuesday listed and the same request
- WHEN Tuesday is removed and the queue is read
- THEN the deadline moves from Thursday back to Wednesday

#### Scenario: Invalid entries are refused (table-driven)

| Entry | Error |
|---|---|
| `2026-02-30` | not a real date |
| `2026-13-01` | not a real date |
| the same date twice | duplicate date |
| a description of 121 characters | description too long |

- GIVEN a calendar save carrying the entry
- WHEN the server validates it
- THEN it is refused with the error shown and nothing is stored

#### Scenario: Description is optional and kept

- GIVEN an entry with no description and another with "Dia del Trabajo"
- WHEN the calendar is saved and reopened
- THEN both are listed, the second with its description

#### Scenario: Coverage by year

- GIVEN a list with 15 dates of 2026 and 15 of 2027
- WHEN the calendar is derived from the list
- THEN `coversYear(2026)` and `coversYear(2027)` are true and `coversYear(2028)` is false

#### Scenario: Default is the current calendar

- GIVEN no row for `calendario`
- WHEN the loader runs
- THEN the list equals the 30 dates of the code default for 2026 and 2027

### Requirement: NP-11 Causes can be activated, deactivated and reordered, never created (RN-01, RNF-14, D1; CU-13, Table D19)

The key `causas` MUST hold exactly the five cause codes of RN-01 (`maternidad_paternidad`,
`actividad_representativa`, `intercambio_academico`, `medica`, `fuerza_mayor`),
each once, with an active flag and a position. The codes are fixed: the screen MUST
NOT offer to add, rename or delete a cause and the value MUST fail validation if it
holds a code outside the five, repeats one or omits one. At least one cause MUST
stay active. Active causes MUST be offered in the stored order wherever a cause is
chosen. A deactivated cause MUST NOT be offered for a new choice and MUST be
refused for a draft (`justification-intake`), but MUST keep rendering, with its
label, in every existing request, decision, remission, report and audit row. The
`Causa` database checks stay unchanged. Behaviour tied to a code (rest causes,
special format) MUST NOT depend on whether the cause is active. Deactivating a
cause asks for confirmation (NP-8).

#### Scenario: Validation of the value (table-driven)

| Value | Result |
|---|---|
| five codes, all active, any order | accepted |
| four active and one inactive | accepted |
| all five inactive | refused, at least one cause must stay active |
| a sixth code | refused |
| a code repeated or omitted | refused |

- GIVEN a causes save with the value in the row
- WHEN the server validates it
- THEN the outcome is as shown

#### Scenario: Deactivated cause leaves the offer

- GIVEN `medica` deactivated
- WHEN the student opens the cause step
- THEN the four other causes are offered and `medica` is not

#### Scenario: Order is respected

- GIVEN the order `fuerza_mayor`, `medica`, then the others
- WHEN the cause options are built
- THEN they appear in that order

#### Scenario: Existing data keeps its cause

- GIVEN a presented request with cause `medica` and `medica` then deactivated
- WHEN the staff detail, the student detail, a decision template and a report row render it
- THEN each still shows the label of `medica`

#### Scenario: Rest and special-format rules ignore the flag

- GIVEN `medica` and `fuerza_mayor` deactivated
- WHEN the rest signals and the special-format mark of existing requests are evaluated
- THEN RN-09 and RN-10 still apply to `medica` requests and the mark is still offered for `fuerza_mayor` requests

#### Scenario: No creation or deletion on the screen

- GIVEN the causes section
- WHEN it renders
- THEN it offers an active toggle and a position for each of the five causes and no add, rename or delete control

### Requirement: NP-12 The type-to-cause map is a parameter and `otro` stays unmapped (RN-13, RNF-14; CU-13, Table D19)

The key `tipo_documento_causa` MUST hold, for each of the document types
`constancia_medica`, `constancia_institucional` and `otro`, the set of causes that
type corresponds to. A set MUST contain only the five codes of RN-01, without
repeats. The set of `otro` MUST be empty and MUST NOT be editable: `otro`
corresponds to no cause (Annex D D11). Every type and every one of the five
causes MUST be present in the value, so the table is exhaustive. The default is
the current table: `constancia_medica` to `medica` and `maternidad_paternidad`;
`constancia_institucional` to `actividad_representativa`, `intercambio_academico`
and `fuerza_mayor`; `otro` to none. The map MUST remain editable for a cause
whatever its active flag.

#### Scenario: Validation of the value (table-driven)

| Value | Result |
|---|---|
| the default | accepted |
| `constancia_medica` also mapped to `fuerza_mayor` | accepted |
| `otro` mapped to `medica` | refused |
| a sixth cause code in a set | refused |
| the type `recibo` | refused |
| a type missing from the value | refused |

- GIVEN a map save with the value in the row
- WHEN the server validates it
- THEN the outcome is as shown

#### Scenario: Toggling a cell flips RN-13 on the next read

- GIVEN a `fuerza_mayor` request with a document registered as `constancia_medica`, RN-13 `present` with the default map
- WHEN the cell (`constancia_medica`, `fuerza_mayor`) is enabled and the signals are read
- THEN RN-13 is `absent`

#### Scenario: `otro` is locked

- GIVEN the map section
- WHEN it renders
- THEN the row of `otro` shows no editable cell and states that it corresponds to no cause

### Requirement: NP-13 Effect on requests already in the system (D5, RN-07, RN-08, RN-13, RN-14, RN-23, RN-04, RNF-14; CU-13)

A parameter change MUST apply as follows, with no per-request snapshot:

| Family | When the new value applies |
|---|---|
| remission days, alert days, late-filing days, recurrence threshold, calendar, type-to-cause map | on every read, to every request in the system, including those presented earlier |
| filing window (RN-23) | at the next step save or submission of a draft; never on a correction |
| maximum size (RN-04) | at the next upload token and the next finalize; stored documents are kept |
| active causes | at the next choice, step save or submission of a draft |

The stored `PlazoInicioEn` of a request MUST NOT be recomputed by a parameter change.
An upload token already issued MUST keep the limit it was issued with until it expires.

#### Scenario: Read-time values reach existing requests

- GIVEN a request presented last week and `plazo_remision_dias` raised from 2 to 3
- WHEN the queue is read
- THEN its deadline is one business day later than before

#### Scenario: Window applies to drafts, not corrections

- GIVEN `ventana_presentacion_dias` lowered from 30 to 10, a draft with an end date 20 days ago, and a returned request whose end date is 20 days ago
- WHEN the draft is saved at step 1 and the correction is resubmitted
- THEN the draft is refused with an error on the end date and the correction is accepted

#### Scenario: Stored documents survive a lower limit [PG]

- GIVEN a stored document of 8 MiB and `tamano_maximo_mib` lowered to 5
- WHEN the request and its documents are read
- THEN the document is still listed and viewable

#### Scenario: Stored clock start is not recomputed [PG]

- GIVEN an answered escalation whose `PlazoInicioEn` was stored under the old calendar
- WHEN a date is added to the calendar
- THEN the stored `PlazoInicioEn` is byte-identical

#### Scenario: Issued token keeps its limit

- GIVEN a token issued with a 10 MiB limit and `tamano_maximo_mib` then lowered to 5
- WHEN the token is used before it expires
- THEN the store applies the 10 MiB it was issued with, and the next token carries 5 MiB

### Requirement: NP-14 Every family is proven to change without a deploy (RNF-14; CU-13)

The proof of RNF-14 is the owner system test, verified by inspection (thesis 5.3
Table 16): on one running build, each family is changed through the screen and
the new behaviour is seen on the next request, with nothing re-imported,
restarted or redeployed. It is backed by the structural proof of NP-5 (no
module-level store, no cross-request cache) and by the Postgres suites of NP-3,
NP-4 and NP-9. There is no Postgres case per family.

#### Scenario: Change then observe (table-driven, owner system test)

| Key written through the screen | Observed on the next request |
|---|---|
| `plazo_remision_dias` 2 to 3 | review queue deadline one business day later |
| `alerta_dias` 1 to 2 | review queue alert one business day earlier |
| `presentacion_tardia_dias` 2 to 3 | RN-07 `absent` for a filing on the third business day |
| `ventana_presentacion_dias` 30 to 10 | end date 20 days old refused on a draft |
| `umbral_reincidencia` 3 to 2 | RN-14 `present` on the 2nd request |
| `tamano_maximo_mib` 10 to 1 | upload of a 2 MiB file refused before upload, stating 1 MB |
| `calendario` plus a date | review queue deadline moves |
| `causas` one deactivated | cause not offered, existing request keeps its label |
| `tipo_documento_causa` one cell | RN-13 flips |

- GIVEN the key in force at its default in a running build
- WHEN the maintainer saves the new value through the screen
- THEN the observed effect holds on the next request and exactly one audit row exists for the save

#### Scenario: Invalid or missing row falls back [PG]

- GIVEN, per key, a row with an invalid value and a deleted row
- WHEN the loader runs (NP-4, read suite)
- THEN the key returns its default and the read does not throw

### Requirement: NP-15 Code constants survive only as defaults (RNF-14)

After this change no rule code MUST read a normative constant directly. The former
constants (remission days, the alert literal, the window, the recurrence threshold,
the type-to-cause table, the five causes list as selectable set, the maximum
size, the calendar) MUST exist only as defaults of the registry that the loader
uses as fallback. Rule code MUST receive its parameters as explicit inputs, loaded
once at the page, action or route boundary.

#### Scenario: Structural check

- GIVEN the source tree
- WHEN a test scans the rule modules (business days, dates, submission, signals, documents, token routes)
- THEN none imports a default constant of the registry except the loader and the registry itself

#### Scenario: Defaults are the only fallback

- GIVEN the loader with every row removed
- WHEN each consumer runs
- THEN its behaviour equals the behaviour before this change

### Requirement: NP-16 The migration seeds the defaults (RNF-14; Table D19)

The migration that creates `ParametroNormativo` MUST insert one row per key of
the registry, with the default as value and a `VigenteDesde` not after the
migration date, so the loader reads data from the first request. This is the only
migration of the change: the document size check `CK_Documento_Tamano` (10 MiB)
is not altered, and it is the upper bound of the range of `tamano_maximo_mib`
(NP-2). The migration MUST be applied to production only after the owner's
explicit confirmation of that command.

#### Scenario: Seed equals defaults [PG]

- GIVEN a disposable branch after the migration
- WHEN the loader runs
- THEN every key returns a value equal to its code default, from a stored row

### Requirement: NP-17 Copy and accessibility (RNF-12, RNF-14; CU-13)

Every text of the screen, its deactivation dialog, its errors and its sidebar entry
MUST exist in `i18n/es.json` and `i18n/en.json` with identical key sets; `es` MUST
be neutral professional Spanish with no voseo. Messages that state a parameter value
(the window in days, the size limit) MUST take the value as a placeholder and MUST
NOT hard-code it. State and errors MUST be text, never colour alone; the page MUST
have one `h1` and errors tied to their fields and announced. The 360 px rule of
RNF-11 applies to student screens: the staff `/parameters` page has no narrow-width
or touch-target requirement and no test for it.

#### Scenario: Key parity

- GIVEN the parameters keys
- WHEN `es.json` and `en.json` are compared
- THEN both contain the same keys

#### Scenario: Messages carry the value

- GIVEN `ventana_presentacion_dias` 10 and `tamano_maximo_mib` 5
- WHEN the end-date-too-old and the file-too-large messages render in `es` and `en`
- THEN they state 10 days and 5 MB, and no message contains the literal 30 or 10 as a limit

#### Scenario: Heading and errors

- GIVEN the page with an invalid submit
- WHEN it renders
- THEN there is exactly one `h1`, no skipped level, and each error is associated with its field
