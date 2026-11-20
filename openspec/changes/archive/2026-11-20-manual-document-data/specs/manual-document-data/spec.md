# Manual Document Data Specification (new capability)

> Delta type: this whole file is ADDED. There is no base spec for `manual-document-data`.

## Purpose

The academic secretary registers or corrects, by hand, the data of a supporting
document that extraction did not give or gave wrongly: student name, issuer,
issue date and rest period (each marked "ingresado manualmente"), whether the
document carries the issuer's firma and sello, and the document type. What the
secretary registers prevails over what OCR extracted (RN-24), works when
extraction failed or is off (RF-14 c), and feeds the signals "firma ausente",
"sello ausente" and "formato no corresponde a la causa" (RN-11, RN-12, RN-13).
The data is display and input for review only: it never decides anything.

Traceability (`docs/requirements.md`, thesis `tesis/04_propuesta/4.2_requisitos.md`):
RF-14 (a), (b), (c), (d); RF-05 (e); RN-11, RN-12, RN-13, RN-24; RNF-14 for the
type-to-cause mapping only (RNF-14 as a whole stays "No cumple": plazos,
calendario, causas, umbral and tamaño remain constants). Touches RNF-01, RNF-02,
RNF-03 (b), RNF-04, RNF-06. The thesis is the acceptance authority: "Un
requisito se aprueba cuando pasa cada inciso de su criterio" (4.9, line 7).
Signals live in `validation-signals`; the effective view and the extraction
state in `document-extraction`; the form and marks on screen in `request-review`;
the read-only view of coordination in `coordination-escalation`; the audit
action in `audit-log`; cancellation in `data-retention`.

Out of scope: RF-12 (a) (catalog-schedule), RF-13 (c), the normative-parameters
table and its edit screen (roadmap row 8), plausibility windows for manual
dates, any comparison of the registered name with the student snapshot.

Terms: "current document" = a non-retired, student-uploaded (not staff-uploaded),
non-special-format document in state `valido` of the request (as in
`validation-signals`); "manual data record" = the one record of a document that
holds its manual name, issuer, issue date and rest period; "datum" = one of the
four: name, issuer, issue date, rest period (the rest period is ONE datum made
of a from date and a to date; its days are derived in code, never entered or
stored); "mark" = the firma or the sello of a document, with the
three states `Sí`, `No`, `Sin registrar`; "type" = the document type, one of
`constancia_medica`, `constancia_institucional`, `otro`, or not registered;
"manual" = a datum with a stored manual value; "pendiente" = request state.

## Requirements

### Requirement: MD-1 Register or correct the four document data (RF-14 a, RN-24)

Thesis criterion (RF-14 a): «La secretaría registra o corrige el nombre del
estudiante, el emisor, la fecha de emisión y el período de reposo, y el detalle
marca cada dato “ingresado manualmente”.» A `secretaria` in scope MUST be able
to register, and later correct, for each current document of a request in
`pendiente`, the four data. Each registered value MUST be stored in the manual
data record of that document, apart from the extraction row and apart from the
request's student snapshot: a registered name MUST NOT replace, alter or be
compared with the snapshot name (RN-02). A datum is manual if and only if a
manual value is stored for it; no other flag exists. The detail marks each
manual datum as such (see `request-review`, MD-26).

#### Scenario: RF-14 (a) register the four data (hoja step a)

- GIVEN a `pendiente` request in scope with one current document and no manual data
- WHEN the secretary registers name "Ana Lopez", issuer "Clinica Santa Fe", issue date 2026-11-05 and rest 2026-11-05 to 2026-11-07
- THEN the document's effective data holds those four values, the rest with 3 days, each as manual
- AND the request's snapshot name is unchanged

#### Scenario: RF-14 (a) correct a registered value (hoja step a)

- GIVEN a document with manual issuer "Clinica Santa Fe"
- WHEN the secretary registers issuer "Clinica Santa Fe S.A."
- THEN the effective issuer is "Clinica Santa Fe S.A." and the other manual values are unchanged

#### Scenario: Correct an extracted value without touching the extraction

- GIVEN a document whose extraction is `completada` with issuer "CLINICA STA FE"
- WHEN the secretary registers issuer "Clinica Santa Fe"
- THEN the effective issuer is the registered one, and the extraction row still holds "CLINICA STA FE"

#### Scenario: Name never reaches the snapshot

- GIVEN a request whose snapshot name is "Y"
- WHEN the secretary registers the document name "X"
- THEN the snapshot name stays "Y" and no comparison between them exists

### Requirement: MD-2 Independent data; clearing reverts to the extracted value (RN-24, D8, D9)

Each datum MUST be independent: registering one MUST NOT require another, and
a document MAY have a manual issuer with an extracted name, issue date and rest
period. The rest period MUST be one unit: a manual rest period replaces the
extracted one entirely and is never mixed with an extracted from, to or days.
Saving a datum empty (after trimming) MUST remove that manual value only, so
the effective value reverts to the extracted one (RN-24 precedence ends with the
manual value); when there is no extracted value the datum has no value and
reads "no reconocido". Saving the value already stored MUST change nothing.

#### Scenario: One manual datum among extracted ones

- GIVEN a `completada` extraction with name, issuer, issue date and rest, and a manual issuer only
- WHEN the effective data is read
- THEN the issuer is the manual one and the other three data are the extracted ones

#### Scenario: Clearing reverts to the extracted value

- GIVEN a manual issuer "B" over an extracted issuer "A"
- WHEN the secretary saves the issuer empty
- THEN the manual value is gone and the effective issuer is "A", without the manual mark

#### Scenario: Clearing without an extracted value

- GIVEN a manual issue date on a document whose extraction is `fallida`
- WHEN the secretary saves the issue date empty
- THEN the issue date has no value and reads "no reconocido"

#### Scenario: Rest period is not mixed

- GIVEN an extracted rest of 3 days with no dates and a manual rest 2026-11-09 to 2026-11-09
- WHEN the effective data is read
- THEN the rest period is 2026-11-09 to 2026-11-09 with 1 day, and no extracted day count is mixed in

### Requirement: MD-3 Structural validation only (RF-14 a, D7)

The server MUST validate every save and MUST enforce structure only. Name MUST
be at most 160 characters and issuer at most 200, both trimmed. An issue date,
a rest-from and a rest-to MUST be real calendar dates. A manual rest period
MUST be entered as dates only (RN-10 and A5 SC-12 compare dates): both rest-from
and rest-to present with from not after to, or neither (no manual rest period).
The days MUST be derived in code, inclusive of both ends, and MUST NOT be entered
or stored. A lone date MUST be refused. No plausibility
window MUST apply (the window of `document-extraction` is not used for manual
values). A refusal of any field MUST refuse the whole save with a readable error
on each invalid field, and nothing MUST be stored.

#### Scenario: Field bounds and forms (table-driven)

| Input | Result |
|---|---|
| name of 160 characters | accepted |
| name of 161 characters | refused, error on name |
| issuer of 200 characters | accepted |
| issuer of 201 characters | refused, error on issuer |
| issue date 2026-02-30 or a non-date text | refused, error on issue date |
| issue date 2024-01-15 (outside the extraction window) | accepted |
| rest 2026-11-09 to 2026-11-09 | accepted, derived 1 day |
| rest 2026-11-05 to 2026-11-07 | accepted, derived 3 days |
| rest from 2026-11-10 to 2026-11-09 | refused, error on rest period |
| rest with only a from date, or only a to date | refused, error on rest period |
| rest from and to both empty | accepted, no manual rest period |

- GIVEN a `pendiente` request in scope and the input in the row
- WHEN the secretary saves it
- THEN the outcome is as shown and a refusal stores nothing

#### Scenario: One invalid field refuses the whole save

- GIVEN a save with a valid issuer and an invalid issue date
- WHEN the server validates it
- THEN the issuer is not stored either, and the error is on the issue date only

### Requirement: MD-4 Document type from a closed set (RF-14 d, D2)

Thesis criterion (RF-14 d): «La secretaría registra el tipo de documento
presentado, para contrastarlo con la causa declarada (RN-13).» The secretary
MUST be able to register, per current document, one type of exactly three:
`constancia_medica`, `constancia_institucional`, `otro` (Anexo D, D11). The
special-format letter of the FIA, the sports letter of the UAM and employer or
foundation letters are all `constancia_institucional`. The server MUST refuse
any other value. "Not registered" MUST be a valid stored state (no value) and
MUST be the state of every document until the secretary registers a type;
saving the type empty MUST return it to not registered. The type is independent
of the four data and of the marks. The contrast with the declared cause is the
signal RN-13 (see `validation-signals`).

#### Scenario: RF-14 (d) register the type (hoja step d)

- GIVEN a `pendiente` request of cause `actividad_representativa` with one current document and no type
- WHEN the secretary registers `constancia_medica`
- THEN the type is saved and the signal "formato no corresponde a la causa" is `present` on the next read

#### Scenario: Closed set (table-driven)

| Type | Result |
|---|---|
| `constancia_medica`, `constancia_institucional`, `otro` | accepted |
| empty | accepted, back to not registered |
| `formato_especial` or any other text | refused, error on type |

- GIVEN a save with the type in the row
- WHEN the server validates it
- THEN the outcome is as shown and a refusal stores nothing

### Requirement: MD-5 Firma and sello marks with three states (RF-14 b, D9)

Thesis criterion (RF-14 b): «La secretaría marca la presencia de firma y de
sello.» The secretary MUST be able to register, per current document and
independently, the firma and the sello, each as `Sí`, `No` or `Sin registrar`.
`Sin registrar` is the state of every document until registered and MUST be
distinguishable from `No` in storage and on screen (Anexo D, D11: "Nulo: aún no
registrado"). Saving a mark as `Sin registrar` MUST return it to that state.
The marks are independent of each other, of the type and of the four data. The
marks and the type MUST NOT change the effective extraction state of a document
(see `document-extraction`, MD-21).

#### Scenario: RF-14 (b) marks are saved (hoja step b)

- GIVEN a `pendiente` request in scope with one current document and no marks
- WHEN the secretary marks firma `Sí` and sello `No`
- THEN both marks are saved and read back as `Sí` and `No`

#### Scenario: Three states stay distinct

- GIVEN a document with firma `No` and sello `Sin registrar`
- WHEN the document is read
- THEN firma reads `No` and sello reads `Sin registrar`, and the two are not equal

#### Scenario: Marks are independent

- GIVEN a document with firma `Sí` and sello `Sí`
- WHEN the secretary changes only the sello to `Sin registrar`
- THEN firma is still `Sí`

### Requirement: MD-6 Editable only while the request is pendiente; coordination is read-only (D6)

Manual data MUST be created, changed or cleared only while the request is in
`pendiente`. The write MUST be guarded in the same transaction by the state: a
save on a request in `aprobada`, `rechazada`, `devuelta`,
`en_revision_coordinacion` or `borrador` MUST be refused with no data change and
no audit row. Manual data of a request in any state remains readable by the
callers of MD-7. A request that returns to `pendiente` (a coordination answer,
or a correction resubmitted by the student) MUST be editable again. A
`coordinacion` MUST have no way to write manual data.

#### Scenario: Editable by state (table-driven)

| Request state | Save |
|---|---|
| `pendiente` | accepted |
| `aprobada`, `rechazada`, `devuelta`, `en_revision_coordinacion`, `borrador` | refused, nothing changes |

- GIVEN a request in the state in the row
- WHEN the in-scope secretary saves manual data
- THEN the outcome is as shown, and a refusal writes no audit row

#### Scenario: Back to pendiente

- GIVEN a request that was escalated, answered by the coordination and is `pendiente` again, with manual data from before
- WHEN the secretary opens it and saves a change
- THEN the change is accepted and the earlier manual data was kept meanwhile

#### Scenario: Decision closes the window

- GIVEN a secretary's save and another secretary's decision on the same request at the same time
- WHEN both complete
- THEN either the save commits before the decision, or it is refused, never after the request left `pendiente`

#### Scenario: Coordination cannot write

- GIVEN a `coordinacion` of the request's career
- WHEN it calls the save action directly
- THEN it is denied and nothing changes

### Requirement: MD-7 Authorization, scope and visibility (RNF-01, RNF-02)

Only an authenticated `secretaria` with a `FacultadId` MUST be able to save
manual data, and only for a current document of a request of her facultad
(facultad of the student's current career). The action MUST re-check
authentication, role and scope on the server. A `secretaria` without
`FacultadId`, a request outside her facultad, an unknown request or document id,
and a document that is not a current document of that request (retired,
staff-uploaded, of another request) MUST yield the nonexistent-id outcome with
no change. Role and scope policy MUST live in `src/lib/auth/permissions.ts`.
Manual data MUST be visible only to the in-scope `secretaria` (all of it) and to
the `coordinacion` of the career of an open escalation (type and marks only,
read-only, see `coordination-escalation`). It MUST NOT be shown or returned to
students, teachers, administrators, other roles, the queue, any tab, or any
notification message.

#### Scenario: Callers (table-driven)

| Caller | Save |
|---|---|
| `secretaria` in scope | accepted |
| `secretaria` of another facultad, or without `FacultadId` | nonexistent-id outcome, nothing changes |
| `coordinacion`, `estudiante`, `docente`, `administrador` | denied screen, nothing changes |
| anonymous | sent to login |

- GIVEN a `pendiente` request and the caller in the row
- WHEN the caller invokes the action
- THEN the outcome is as shown

#### Scenario: Document that is not current

- GIVEN a retired document, a staff-uploaded special-format document and a document of another request
- WHEN the in-scope secretary saves manual data naming each one
- THEN each yields the nonexistent-id outcome and nothing is stored

#### Scenario: Never shown to the student

- GIVEN a request with manual data
- WHEN its owner opens `/requests/[id]` or the list
- THEN no manual value, mark or type is shown or returned

### Requirement: MD-8 Access-matrix row for the save action (RNF-01 c)

The server action that saves manual data MUST have its own row in the access
matrix (`src/test/access/matrix-table.ts`), with `secretaria` as the only
allowed identity. The six other identities (anonymous, flagged and the four
other roles) MUST be denied as documented by `route-access-coverage` RAC-4:
anonymous to `/login`, flagged to `/change-password`, any other role to
`/denied`, and no data module read before the denial. The matrix MUST keep
equalling the tree (RAC-5): a missing row or a stale row fails. The figure
"N entry points x 7 identities" (RAC-7) MUST grow by the new action and stay at
100 % denied.

#### Scenario: Denial matrix over the real guard (table-driven)

| Identity | Outcome |
|---|---|
| `secretaria` | admitted |
| anonymous | redirect `/login` |
| flagged | redirect `/change-password` |
| `estudiante`, `docente`, `coordinacion`, `administrador` | redirect `/denied` |

- GIVEN the save action called by the identity in the row through the real guard
- WHEN the matrix test runs
- THEN the outcome is as shown and every data double (which throws) was not called

#### Scenario: Table equals the tree

- GIVEN the save action exported from its `"use server"` file
- WHEN the matrix and the tree are compared
- THEN the row exists, and removing it, or adding a row with no action, fails the test

### Requirement: MD-9 One transaction per save; no-op writes nothing (RNF-06, RN-15)

A successful save MUST, in ONE transaction: re-check that the request is still
`pendiente`; write the manual data record, the type and the marks of that one
document; and write exactly one audit row (see `audit-log`). A save that changes
nothing (every submitted value equals the stored one) MUST write no data change
and no audit row. A failure after the data write or at the audit insert MUST roll
back everything. The save MUST NOT change the state of the request, MUST NOT
touch the extraction row, and MUST NOT read the signals or the verdict (RN-15:
signals are display-only).

#### Scenario: Success is atomic

- GIVEN a valid save of an issuer and a firma
- WHEN the transaction commits
- THEN the manual issuer, the firma and one audit row exist together, and the request is still `pendiente`

#### Scenario: Failure rolls back

- GIVEN a failure after the data write, or at the audit insert
- WHEN the transaction ends
- THEN no manual value, mark, type or audit row from that save remains

#### Scenario: No-op

- GIVEN a document whose manual data equals the submitted values
- WHEN the secretary saves again
- THEN nothing changes and no audit row is written

#### Scenario: Signals are not read

- GIVEN the signals module replaced by a stub that throws when called
- WHEN the save action runs
- THEN it succeeds and never read a signal or the verdict

### Requirement: MD-10 Resolve with registered data when extraction failed or is off (RF-14 c, RN-24, D9)

Thesis criterion (RF-14 c): «Sin datos extraídos por OCR, la solicitud se
resuelve con los datos registrados.» When the extraction of a document is
`fallida`, `pendiente`, `procesando`, absent, or not configured, the secretary
MUST still be able to register its data and to decide the request with them
(approve, reject, return, escalate), because the decision never depends on
extraction or on signals (RN-15). Registered data MUST be what the detail and
the signals read for that document. Registering MUST NOT start extraction and
MUST NOT make any outbound request.

#### Scenario: RF-14 (c) extraction off, resolve with registered data (hoja step c)

- GIVEN extraction not configured and a `pendiente` request with one current document
- WHEN the secretary registers the four data, a type and the marks, then approves the request
- THEN the request is `aprobada`, and the detail shows the registered data, as manual
- AND no outbound request to any extraction service was made

#### Scenario: Extraction `fallida`, resolve with registered data

- GIVEN a document whose extraction row is `fallida`
- WHEN the secretary registers its issue date and rest period, then returns the request
- THEN the decision succeeds and the detail shows both values, with no "unavailable" state in place of them

#### Scenario: SC-12 forced fallida extraction, then capture gives RN-10 (A5 SC-12)

- GIVEN a `medica` request for 2026-11-09 to 2026-11-10 whose only document has a forced `fallida` extraction, and RN-10 `not_evaluable` with `extraction_failed`
- WHEN the secretary registers rest 2026-11-09 to 2026-11-09
- THEN RN-10 ("fechas no cubiertas") is `present` on the next read, with the verdict "review carefully"

#### Scenario: SC-12 variant, extraction completed with nothing recognized

- GIVEN a `completada` extraction with every datum "no reconocido", and RN-10 `not_evaluable` with `field_missing`
- WHEN the secretary registers rest 2026-11-09 to 2026-11-09
- THEN RN-10 is `present` on the next read

#### Scenario: Decision does not require manual data

- GIVEN a `pendiente` request with no extraction and no manual data
- WHEN the secretary approves it
- THEN the approval succeeds exactly as before this change

### Requirement: MD-11 Manual values are never logged (RNF-02, RNF-03 b)

The system MUST NOT write any manual value (name, issuer, date, rest, type or
mark) to any log, error message, notification or audit payload; logs MAY carry
request or document ids, states, error codes and counts. Saving manual data MUST
NOT send a document or its content to any service.

#### Scenario: No values in logs

- GIVEN a save with name "Ana Lopez" and issuer "Clinica Santa Fe", and a save that fails
- WHEN every log line and error text of both is searched
- THEN neither value appears
