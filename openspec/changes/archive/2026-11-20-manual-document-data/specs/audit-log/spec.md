# Delta for Audit Log

Traceability: RF-14 (a)-(d), RN-24, RNF-02, RNF-06. Based on the current main text
of `openspec/specs/audit-log/spec.md`. Requirement ids MD-n are stable and shared
by all deltas of this change. No existing requirement changes.

## ADDED Requirements

### Requirement: MD-31 Closed set of manual document data events (RF-14, RNF-06 a)

The audit actions MUST gain exactly one: `documento.datos_registrados`. It MUST
use the existing entity type `DocumentoRespaldo` with the id of the document as
entity id, and MUST be built only through the central builders. The audit entity
types MUST NOT gain any value. Existing events and payloads MUST be unchanged,
and no schema change to the audit log is required.

#### Scenario: Action to entity type

- GIVEN a successful save of manual data for document 41
- WHEN its audit row is read
- THEN the action is `documento.datos_registrados`, the entity type is `DocumentoRespaldo` and the entity id is 41

#### Scenario: Existing events unchanged

- GIVEN a decision, an escalation or a document download
- WHEN its audit rows are read
- THEN they are identical in shape to those written before this change

### Requirement: MD-32 One audit row per manual data save, same transaction (RF-14, RNF-06)

Every successful save of manual data of one document that changes at least one
datum, the type or a mark MUST write exactly one `documento.datos_registrados`
row, inside the same transaction as the data change (per "Audit record is
written in the same transaction as its change"), whatever the number of fields
that changed. A refused, invalid, unauthorized, out-of-scope, no-op, lost-race,
rolled-back or failed save MUST write no audit row and leave no data change. The
actor MUST be the authenticated session user, never request input. Opening the
staff detail MUST keep writing its own `solicitud.consultada` row and no
`documento.datos_registrados` row.

#### Scenario: Successful save (table-driven)

| Save | Audit rows added |
|---|---|
| issuer changed | 1 `documento.datos_registrados` |
| issuer, rest period and firma changed in one save | 1 `documento.datos_registrados` |
| a manual value cleared | 1 `documento.datos_registrados` |
| two documents saved one after the other | 2 `documento.datos_registrados` |

- GIVEN an in-scope secretary saving the data of a document of a `pendiente` request
- WHEN the save succeeds
- THEN exactly the rows shown exist, with the session user as actor

#### Scenario: Saves that must leave no row (table-driven)

| Case |
|---|
| validation failure |
| request not `pendiente` |
| unauthorized role or anonymous caller |
| out-of-scope request, unknown document id, document that is not current |
| no field changed |
| the data write fails after the audit insert |
| the audit insert fails |

- GIVEN the case from the row
- WHEN the action runs
- THEN no audit row exists for it and the data is unchanged

#### Scenario: Actor from the session

- GIVEN a request whose body claims another actor
- WHEN a save succeeds
- THEN the audit row's actor is the session user

#### Scenario: Open and save are separate rows

- GIVEN an in-scope secretary who opens a detail and then saves a datum
- WHEN the audit log is read
- THEN one `solicitud.consultada` row and one `documento.datos_registrados` row exist for them

### Requirement: MD-33 Manual data payload carries field names only (RF-14, RNF-02, RNF-06)

The payload of `documento.datos_registrados` MUST be structured data with
exactly two keys: `solicitudId` (the request id) and `campos`, the names of the
fields that changed, taken from a closed list: `nombreEstudiante`, `emisor`,
`fechaEmision`, `reposo`, `tipoDocumento`, `tieneFirma`, `tieneSello`. The
document is identified by the entity id of the audit row. A field not on the
list can never be reported as changed. A cleared value is reported by its name
like any other change. The payload MUST NOT contain the old or the new value of
any field: no student name, issuer, date, number of days, type code, or mark
state (`Sí`, `No`). It MUST NOT contain a file name, a storage location, any
other personal data or any credential.

#### Scenario: Names, not values

- GIVEN a save of issuer "Clinica Santa Fe", rest 2026-11-05 to 2026-11-07, type `constancia_medica` and firma `No`
- WHEN the payload is read
- THEN it lists `emisor`, `reposo`, `tipoDocumento` and `tieneFirma`
- AND serialized and searched it contains none of those values, no date and no day count

#### Scenario: Cleared value

- GIVEN a manual issuer that the secretary clears
- WHEN the payload is read
- THEN it lists `emisor` and no value

#### Scenario: Closed list

- GIVEN every field of the manual data form
- WHEN the payloads of saves that change each one are read
- THEN each name is on the closed list and no other name appears

#### Scenario: Payload-leak check

- GIVEN all audit rows of a request with manual data, a decision and a detail open
- WHEN every payload is serialized and searched for any manual value, student name, CIF, email or file name
- THEN none is found
