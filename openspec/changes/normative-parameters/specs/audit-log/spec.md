# Delta for Audit Log

Change `normative-parameters`. Requirements covered: RNF-06, RNF-14, RNF-12.
Thesis: CU-13, Annex D Table D19. A change of a normative parameter writes one audit
row per changed key (D4: the payload carries the key and its before and after, which
are institutional values, never personal data). [PG] marks a scenario that MUST run
on a real PostgreSQL.

## Notes for archive

- Purpose: no edit.
- "Closed set of manual catalog events", "Closed set of docente maintenance ..." and
  every other closed-set requirement stay as they are; each refers to the change that
  introduced it. The requirement below adds one action and one entity type.
- "Audit record content" says records that describe a whole operation rather than
  one entity identify that operation as their entity type. A parameter row names the
  parameter family as its entity type and carries the key in the payload, so its
  entity id is empty by design, as for other operation-level rows.
- The audit reader (if any) MUST tolerate the new action code and the new entity type.

## ADDED Requirements

### Requirement: NP-AUD-1 Closed set of normative parameter events (RNF-06 a, RNF-14; CU-13, Table D19)

The set of audit actions MUST gain exactly one: `parametro.actualizado`, appended at
the end of the set. The set of audit entity types MUST gain exactly one: `Parametro`.
An event with this action MUST use entity type `Parametro` with no entity id, and
MUST carry the parameter key in its payload (NP-AUD-3). The action MUST be used for
every key of the registry (the six scalars, the calendar, the causes and the
type-to-cause map). Events MUST continue to be constructible only through the
central builders. Existing events and payloads MUST be unchanged, and no schema
change of the audit log is required (the log has no check on action or entity type).

#### Scenario: Action and entity type

- GIVEN a successful save of `umbral_reincidencia`
- WHEN its audit row is read
- THEN the action is `parametro.actualizado`, the entity type is `Parametro` and the entity id is empty

#### Scenario: The set gains exactly one action and one entity type

- GIVEN the closed lists of audit actions and entity types before this change
- WHEN they are compared with the lists after it
- THEN the difference is exactly `parametro.actualizado` in actions and `Parametro` in entity types, and the new action is last in its list

#### Scenario: One action for every family (table-driven)

| Key written | Action |
|---|---|
| `plazo_remision_dias`, `alerta_dias`, `presentacion_tardia_dias`, `ventana_presentacion_dias`, `umbral_reincidencia`, `tamano_maximo_mib` | `parametro.actualizado` |
| `calendario` | `parametro.actualizado` |
| `causas` | `parametro.actualizado` |
| `tipo_documento_causa` | `parametro.actualizado` |

- GIVEN a save of the key in the row
- WHEN its audit row is read
- THEN the action is as shown and the key is in the payload

#### Scenario: Existing events unchanged

- GIVEN a docente edit, a request submit or a manual document data save
- WHEN their audit rows are read
- THEN they are identical in shape to those written before this change

### Requirement: NP-AUD-2 One audit row per changed key, same transaction (RNF-06 a, RNF-14; CU-13)

Every successful change of a parameter key MUST write exactly one audit row, inside
the same transaction as the parameter row (per "Audit record is written in the same
transaction as its change"). A save that changes several keys MUST write one row per
changed key. A second save of the same key on the same day replaces that day's
parameter row but MUST write its own audit row. A refused, invalid, unauthorized,
no-change, busy or failed write MUST write no audit row and leave no data
change. The actor MUST be the authenticated session user, never a value from the
request. Opening `/parameters` and every loader read MUST write no audit row.

#### Scenario: Successful writes (table-driven) [PG]

| Write | Audit rows added |
|---|---|
| one scalar changed | 1 |
| two scalars changed in one save | 2 |
| a calendar save that adds two dates and removes one | 1 (the key `calendario`) |
| a causes save that deactivates one cause and reorders another | 1 (the key `causas`) |
| a map save that changes three cells | 1 (the key `tipo_documento_causa`) |
| same key saved twice the same day | 2 (one per save) |

- GIVEN a valid save by a `secretaria`
- WHEN it commits
- THEN exactly the audit rows in the row exist, with the session user as actor

#### Scenario: Writes that must leave no row (table-driven) [PG]

| Case |
|---|
| validation failure (out of range, not an integer, invalid date, invalid causes or map) |
| value equal to the value in force |
| unauthorized role, anonymous, flagged for password change |
| the write cannot start because catalog writes are busy |
| the parameter write fails |
| the audit insert fails |

- GIVEN the case from the row
- WHEN the action runs
- THEN no audit row and no parameter row exists for it, and the data is unchanged

#### Scenario: Actor from the session

- GIVEN a request whose body claims another actor
- WHEN a parameter save succeeds
- THEN the audit row's actor is the session user

#### Scenario: Audit failure rolls back the change [PG]

- GIVEN a valid save whose audit insert is made to fail
- WHEN the transaction runs
- THEN no parameter row and no audit row from that transaction remains

#### Scenario: Reads write nothing

- GIVEN a `secretaria` opening `/parameters` and a consumer calling the loader
- WHEN the audit log is read
- THEN it gains no row

### Requirement: NP-AUD-3 Parameter payloads carry the key and its before and after, and nothing personal (RNF-06 a, RNF-02, D4; CU-13, Table D19)

The payload of `parametro.actualizado` MUST be structured data with exactly the
fields `clave` (the key), `antes` (the value in force before the save, the default
when no row was in force) and `despues` (the value saved). For a scalar, `antes`
and `despues` are the integers. For `causas`, they are the list of codes with active
flag and position. For `tipo_documento_causa`, they are the table of types to causes. For
`calendario`, they are the list of ISO dates only: the free-text descriptions MUST NOT
appear in the payload. No payload MAY contain a name, an email, a `Cif`, a phone, a
password, a hash, the actor's data or any free text. The payload MUST NOT be read by
any write path.

#### Scenario: Scalar payload

- GIVEN `alerta_dias` changed from 1 to 2
- WHEN the audit payload is read
- THEN it is `{clave: "alerta_dias", antes: 1, despues: 2}` and nothing else

#### Scenario: First change reads the default as before

- GIVEN no row in force for `umbral_reincidencia`
- WHEN it is saved as 2
- THEN `antes` is 3 (the default) and `despues` is 2

#### Scenario: Same-day second save shows the first as before [PG]

- GIVEN `umbral_reincidencia` saved as 2 and then as 4 the same day
- WHEN the two audit payloads are read
- THEN the first has `antes` 3 and `despues` 2, and the second has `antes` 2 and `despues` 4

#### Scenario: Calendar payload carries dates only

- GIVEN a calendar save that adds 2026-12-25 with the description "SENTINEL-DESC"
- WHEN the payload is serialized and searched
- THEN `despues` lists the ISO dates, `SENTINEL-DESC` is not found, and no personal field exists

#### Scenario: Structured shape for causes and map

- GIVEN a causes save and a map save
- WHEN their payloads are read
- THEN `causas` carries codes with flag and position, and the map carries types to cause codes, in the same `clave`, `antes`, `despues` shape

#### Scenario: Payload-leak check [PG]

- GIVEN every parameter event written in one test run, including sentinel descriptions and an actor with a sentinel name and email
- WHEN every payload is serialized and searched for the sentinels, for `HashClave` and for a bcrypt pattern
- THEN none is found
