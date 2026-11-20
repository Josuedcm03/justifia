# Delta for Request Review

Traceability: RF-14 (a)-(d), RF-05 (e), RN-11, RN-12, RN-13, RN-24, RNF-01,
RNF-12 (i18n), SR-11 (review structure test). Based on the current main text of
`openspec/specs/request-review/spec.md`. Requirement ids MD-n are stable and
shared by all deltas of this change; for MODIFIED requirements the id is the
first words of the body, the heading keeps the baseline name.

Purpose amendment (informational, applied at archive): the secretary can now
register manual document data from the staff detail (RF-14); "signals (RF-05) are
out of scope" of the original purpose was already superseded by the signals
section and stays so. The data model and rules live in `manual-document-data`.

## ADDED Requirements

### Requirement: MD-23 Manual data form per document on the staff detail (RF-14 a, b, c, d)

Thesis: RF-14 «(a) La secretaría registra o corrige el nombre del estudiante, el
emisor, la fecha de emisión y el período de reposo… (b) La secretaría marca la
presencia de firma y de sello. (c) Sin datos extraídos por OCR, la solicitud se
resuelve con los datos registrados. (d) La secretaría registra el tipo de
documento presentado…» On the staff detail of a request in `pendiente`, an
in-scope secretary MUST be offered, in the "Datos extraídos" section, one manual
data form per current (non-retired) student document, with: the four data (name,
issuer, issue date, and the rest period as from and to dates, with no days
input: the days are derived), the document type (`Constancia médica`, `Constancia institucional`,
`Otro`, or not registered) and the firma and the sello (`Sí`, `No`,
`Sin registrar`). The form MUST be prefilled only with manual values, marks and
type already registered: an extracted value is shown beside the field as a
reference and MUST NOT be prefilled as if it were manual. The form MUST be
offered in every extraction state of the document (completed data, extracting,
unavailable) and also when extraction is not configured (RF-14 c). One save
MUST store the whole form of one document (see `manual-document-data`). A refusal
MUST show a readable error on each invalid field and keep what was typed. Saving
MUST NOT ask for a confirmation dialog, because it is reversible: a value can be
corrected or cleared. The form MUST NOT be offered when the request is not
`pendiente`, to students, to other roles, to out-of-scope secretaries, or in the
queue or any tab. When the extracted-data read is degraded the section MUST show
the degraded notice and no form.

#### Scenario: One form per current document

- GIVEN a `pendiente` request with two current student documents, one retired document and a staff-uploaded special format
- WHEN the in-scope secretary opens the detail
- THEN two forms are offered, one per current student document, and none for the other two

#### Scenario: RF-14 (c) form with extraction not configured (hoja step c)

- GIVEN extraction is not configured and a `pendiente` request with one current document
- WHEN the in-scope secretary opens the detail
- THEN the configuration message appears once at the top of the section and the document's form is offered

#### Scenario: Form in every extraction state (table-driven)

| Extraction of the document | Entry state text | Form |
|---|---|---|
| `completada` | the four data | offered |
| `pendiente` or `procesando`, or no row | extracting | offered |
| `fallida` | unavailable, review the document | offered |
| not configured | none (message once at the top) | offered |

- GIVEN a `pendiente` request with a document in the row
- WHEN the in-scope secretary opens the detail
- THEN the entry and the form are as shown

#### Scenario: Prefill only manual values

- GIVEN a document with extracted issuer "A" and no manual issuer
- WHEN the form is shown
- THEN "A" appears as the extracted reference and the issuer field is empty, so saving without typing leaves the issuer without a manual value

#### Scenario: Form not offered outside pendiente (table-driven)

| Request state or caller | Form |
|---|---|
| `aprobada`, `rechazada`, `devuelta`, `en_revision_coordinacion` | not offered, the values are shown read-only |
| the owner student, a `coordinacion`, a `docente`, an `administrador` | not offered, no manual data shown |

- GIVEN a request and the viewer in the row
- WHEN the viewer requests the staff detail, where the role may open it
- THEN the form is as shown

#### Scenario: Refusal keeps the input

- GIVEN a form with a valid issuer and a rest period whose from date is after its to date
- WHEN the secretary saves it
- THEN a readable error is shown on the rest period, the typed values are kept and nothing is stored

#### Scenario: Saved values are shown after the save

- GIVEN a valid form
- WHEN the secretary saves it
- THEN the detail of the same request shows the saved values, each datum as manual, and the signals computed from them

#### Scenario: Degraded read shows no form

- GIVEN the extracted-data read throws
- WHEN the secretary opens the detail
- THEN the section shows the degraded notice and no form, and the rest of the detail renders

### Requirement: MD-24 The save follows the review structure rule (SR-11)

The manual data action MUST end in a redirect to the same route, the staff
detail of the request (`/review/[id]`), so that the page is rendered once with
the new data. No module of the review directory MUST call `revalidatePath`,
`revalidateTag`, `updateTag`, `router.refresh` or `refresh()`, and the existing
structure test (`review/structure.test.ts`, SR-11 guard 4) MUST stay green with
the new files included in its scan. The detail MUST NOT be prefetched by the form
or by any link it adds (the existing prefetch guard keeps holding).

#### Scenario: No revalidation in the review directory

- GIVEN the review modules after this change, including the manual data action and form
- WHEN the structure test scans them
- THEN no `revalidatePath`, `revalidateTag`, `updateTag`, `router.refresh` or `refresh()` appears

#### Scenario: The action redirects to the same route

- GIVEN a successful save
- WHEN the action ends
- THEN it redirects to the staff detail of the same request, and a refused save returns its errors to the same form

#### Scenario: One open per render

- GIVEN a save followed by the redirect
- WHEN the audit log is read
- THEN the redirected render wrote one `solicitud.consultada` row and the save one `documento.datos_registrados` row

### Requirement: MD-25 Manual data UI i18n (RNF-12)

All texts of the manual data form and marks MUST exist in both `i18n/es.json` and
`i18n/en.json` with the same keys: field labels, the type names, the three mark
states, the "ingresado manualmente" mark, the extracted-reference caption, the
save action, every field error and the signal names and the `not_registered`
reason of RN-11, RN-12 and RN-13. The `es` text MUST be in neutral professional
Spanish with no voseo. The mark MUST read «Ingresado manualmente» in `es` and
"Entered manually" in `en`; the marks read `Sí`, `No`, `Sin registrar` in `es`
and "Yes", "No", "Not registered" in `en`; the types read «Constancia médica»,
«Constancia institucional», «Otro» in `es` and "Medical certificate",
"Institutional certificate", "Other" in `en`. State and mark MUST be conveyed as
text, never by color alone.

#### Scenario: Translation keys present

- GIVEN the manual data keys
- WHEN `es.json` and `en.json` are compared
- THEN both contain the same keys

#### Scenario: Wording

- GIVEN the mark, the three mark states and the three types
- WHEN each locale is read
- THEN they read as stated, with no voseo in `es`

## MODIFIED Requirements

### Requirement: Extracted data section on the staff detail (RF-11 a, RF-11 b, RN-02, RNF-01)

Spec id MD-26. In addition to the content of "Staff detail with history", the staff detail
MUST show a "Datos extraídos" / "Extracted data" section, after the documents
section, with one entry per current (non-retired) student document. When the
request has no such document and the read succeeded, the section MUST be
omitted. The section MUST be visible only to the roles that may open the staff
detail, under the same scope rules, and the access decision MUST live in
`src/lib/auth/permissions.ts`. It MUST NOT be shown to students, to other
roles or in the queue, and the student view MUST NOT receive extracted data or
manual data. For a document whose effective state is `completada` (its
extraction is `completada`, or at least one manual value exists, see
`document-extraction` MD-21) the entry MUST show, with text labels: the name
found in the document, the issuer, the issue date and the rest period, each with
its effective value. A datum whose value is manual MUST carry the text mark
«Ingresado manualmente» / "Entered manually" (RF-14 a, RN-24), never by color
alone; an extracted value carries no mark. The entry MUST also show the
registered document type and the firma and sello marks, each with its state
(`Sin registrar` included). The rest
period MUST show from and to dates with the number of days, a single date with
the number of days when both dates are the same day, or only the number of days
when the document gave no dates. A field without value MUST show the muted text
"no reconocido" and no value (RF-11 b). Dates are calendar dates shown without
time-zone shift. The name MUST be labelled as read from the document, MUST NOT
replace or alter the snapshot name of the request (RN-02) and MUST NOT be
compared with it, whether it is extracted or manual.
(Previously: only extracted values, no manual mark, no document type or marks.)

#### Scenario: Full data shown

- GIVEN a `completada` document with name, issuer, issue date and rest 2026-07-20 to 2026-07-24 (5 days)
- WHEN an in-scope secretary opens the detail
- THEN the four fields show those values, with the days next to the period, and none carries the manual mark

#### Scenario: Unrecognized field

- GIVEN a `completada` document with issuer but no rest period
- WHEN the secretary opens the detail
- THEN the issuer is shown and the rest period reads "no reconocido" with no value

#### Scenario: Days only

- GIVEN a document whose rest period is 3 days with no dates
- WHEN the secretary opens the detail
- THEN the period reads 3 days with no from or to date

#### Scenario: Snapshot name wins

- GIVEN extracted name "X" and snapshot name "Y"
- WHEN the secretary opens the detail
- THEN the student section shows "Y" and the extracted section shows "X" as read from the document

#### Scenario: Manual name does not touch the snapshot

- GIVEN a manual name "Z" and snapshot name "Y"
- WHEN the secretary opens the detail
- THEN the student section shows "Y", the data section shows "Z" with the manual mark, and no comparison is shown

#### Scenario: Not for students or other roles

- GIVEN a request with a `completada` document
- WHEN its owner opens `/requests/[id]`, or a user whose role may not review requests (for example `coordinacion`) requests the staff detail
- THEN no extracted data is shown or returned

#### Scenario: RF-14 (a) each datum is marked manual (hoja step a)

- GIVEN a request where the secretary registered name, issuer, issue date and rest period of a document
- WHEN the detail is shown
- THEN each of the four data reads «Ingresado manualmente» next to its value

#### Scenario: Manual value prevails and is marked

- GIVEN extracted issuer "A", manual issuer "B" and extracted issue date
- WHEN the secretary opens the detail
- THEN the issuer reads "B" with the manual mark, the issue date reads the extracted value with no mark, and "A" appears only as the extracted reference in the form

#### Scenario: Clearing removes the mark

- GIVEN a manual issuer that the secretary cleared, over an extracted issuer "A"
- WHEN the detail is shown
- THEN the issuer reads "A" with no manual mark

#### Scenario: Registered values on a failed extraction

- GIVEN a `fallida` row and a manual issue date
- WHEN the secretary opens the detail
- THEN the entry shows the issue date with the manual mark and the other three data as "no reconocido", not the "unavailable" state

#### Scenario: RF-14 (d) type and marks are shown (hoja steps b, d)

- GIVEN a document registered with type `constancia_medica`, firma `Sí` and sello `Sin registrar`
- WHEN the secretary opens the detail
- THEN the entry shows the type "Constancia médica", firma "Sí" and sello "Sin registrar"

### Requirement: Extraction states on the staff detail (RF-11)

Spec id MD-27. A document without effective `completada` data MUST show a state instead of values,
with text and never color alone. The state MUST be decided in this order, the
first match winning: completed data (extraction `completada` or at least one
manual value among the four data, `document-extraction` MD-21); a request that
is not `pendiente`, which
shows "unavailable"; a `fallida` row, which shows "unavailable"; extraction not
configured; and otherwise "extracting". While the request is `pendiente`, a
`pendiente` or `procesando` row, or a missing row for an eligible document,
MUST therefore show an "extracting" state, with no polling. The "unavailable"
state MUST tell staff to review the document themselves, with no retry and no
extraction control; while the request is `pendiente` its only action is the
manual data form (MD-23), and the same holds for the "extracting" state. A
document without effective `completada` data in a request that is not
`pendiente` MUST never show extracting. A `no_aplica` document is not listed.
When extraction is not configured, the section MUST show once, at its top and
in place of the extracting state, the message «Hace falta configurar el
servicio de extracción. Contacte al administrador del sistema.» (`en`
equivalent), which MUST NOT name the environment variable, the address or the
key. While the request is `pendiente`, each current document waiting for the
setting MUST still be listed as an entry that carries its manual data form (RF-14
c) and no per-document state text; once the request is not `pendiente` such
documents are not listed. Completed data and `fallida` entries MUST still show
when extraction is not configured.
(Previously: "unavailable" offered no edit or other action, and documents waiting for the setting were not listed one by one.)

#### Scenario: Extracting

- GIVEN a `pendiente` request whose document row is `procesando` (or not yet created)
- WHEN the secretary opens the detail
- THEN the entry reads "extracting", offers no retry or extraction control and offers the manual data form

#### Scenario: Permanently failed

- GIVEN a `fallida` row
- WHEN the secretary opens the detail
- THEN the entry reads "unavailable, review the document" with no retry control and with the manual data form while the request is `pendiente`

#### Scenario: Not configured

- GIVEN extraction is not configured and two documents waiting in a `pendiente` request
- WHEN the secretary opens the detail
- THEN the configuration message appears once, no extracting state is shown, and each of the two documents is listed with its manual data form
- AND the message does not contain the variable name

#### Scenario: Not configured and not pendiente

- GIVEN extraction is not configured and an `aprobada` request whose document has no manual data
- WHEN the secretary opens the detail
- THEN the configuration message appears once and the waiting document is not listed

#### Scenario: Decided request never extracting

- GIVEN an `aprobada` request with a document row still `pendiente`
- WHEN the secretary opens the detail
- THEN the entry reads "unavailable", not "extracting"

#### Scenario: Manual data comes first in the order

- GIVEN an `aprobada` request whose document row is `fallida` and which has a manual issuer
- WHEN the secretary opens the detail
- THEN the entry shows the manual issuer and not "unavailable"

### Requirement: Signals section and suggested verdict on the staff detail (RF-05 a, RF-05 d, RN-15, RNF-01)

Spec id MD-28. Slice S1 (RN-07, RN-09, RN-10, RN-14), S2 adds the RN-26 entry; the
manual-document-data change adds the entries RN-11, RN-12 and RN-13. In addition to
the content of "Staff detail with history", the staff detail of any presented
request (never a `borrador`) MUST show a "Señales de validación" / "Validation
signals" section, after the "Extracted data" section, with: the suggested
verdict in words and a sentence stating that it does not change the state of the
request; one entry per signal with its name and outcome (`present`, `absent`,
`not_evaluable` or, for RN-09 and RN-10 only, `not_applicable`) in words; and
the signals that are `not_evaluable` listed apart from the verdict, each with
its reason as text. A `not_applicable` entry MUST read "No aplica" (`es`), MUST
show no evidence, MUST carry a muted explanation line "La causa declarada
no incluye reposo." (`es`), and MUST NOT be listed apart with the
`not_evaluable` ones. The eight entries MUST keep the fixed order RN-07, RN-09,
RN-10, RN-11, RN-12, RN-13, RN-14, RN-26. The `es` names of the three new
entries MUST be «Firma ausente», «Sello ausente» and «Formato no corresponde a
la causa». A `present` entry of RN-11, RN-12 or RN-13 MAY identify the documents
that raise it by the same label the documents section already uses, and nothing
else; a `not_evaluable` entry with `not_registered` MUST state as text that the
secretary has not registered that datum of the document. The RN-26 entry, when
`present`, MUST show the number of
each matching earlier request inside the secretary's scope as a link to its
staff detail, and nothing else about it. The section MUST be visible only to the
roles that may open the staff detail, under the same scope rules, MUST NOT be
shown in the queue or in any tab, and MUST be shown in every state of the
request, including decided ones. The section MUST offer no action and MUST NOT
alter the decision controls.
(Previously: five entries RN-07, RN-09, RN-10, RN-14, RN-26.)

#### Scenario: Section content

- GIVEN a `pendiente` request with RN-07 `present`, RN-09 `absent`, RN-10 `not_evaluable` with `extraction_pending` and the other signals `absent`
- WHEN an in-scope secretary opens its detail
- THEN the section shows the verdict "review carefully", the eight outcomes in words, and RN-10 listed apart with its reason

#### Scenario: Not applicable entries

- GIVEN a `fuerza_mayor` request whose extraction has rest ending before the issue date, and RN-07, RN-11, RN-12, RN-13, RN-14, RN-26 `absent`
- WHEN an in-scope secretary opens its detail
- THEN RN-09 and RN-10 read "No aplica" with the muted line "La causa declarada no incluye reposo." and no evidence, "fechas incoherentes" is not shown, and the verdict reads "Sin alertas"
- AND neither entry appears among the signals listed apart as not evaluated

#### Scenario: Extracted data section unchanged for a non-rest cause

- GIVEN the same `fuerza_mayor` request
- WHEN the secretary opens its detail
- THEN the extracted-data section still shows the stored rest period exactly as before this change

#### Scenario: Decision controls untouched

- GIVEN a `pendiente` request with the verdict "review carefully"
- WHEN the secretary opens its detail
- THEN approve, reject, return and escalate are offered exactly as without the section

#### Scenario: Shown after the decision

- GIVEN an `aprobada` request
- WHEN the in-scope secretary opens its detail
- THEN the signals section is shown, computed from the current data

#### Scenario: Not in the queue or the tabs

- GIVEN requests with different verdicts
- WHEN the secretary opens each tab of `/review`
- THEN no row shows a signal, an outcome or a verdict

#### Scenario: Reference to an earlier request (S2)

- GIVEN RN-26 `present` with an in-scope earlier request number 41
- WHEN the secretary opens the detail
- THEN the entry shows "41" as a link to the staff detail of 41 and no student name or document name

#### Scenario: Match outside the scope shows no reference (S2)

- GIVEN RN-26 `present` against an earlier request of another facultad
- WHEN the secretary opens the detail
- THEN the entry reads `present` with no number and no link

#### Scenario: Not for other roles

- GIVEN a request with signals
- WHEN its owner opens `/requests/[id]`, or a `coordinacion` of another career, a `docente` or an `administrador` requests the staff detail
- THEN no signal data is shown or returned

#### Scenario: The three manual signals in their names and order

- GIVEN any presented request
- WHEN the secretary opens the detail in `es`
- THEN the entries after RN-10 read «Firma ausente», «Sello ausente» and «Formato no corresponde a la causa», in that order, before the recurrence entry

#### Scenario: Not registered is listed apart with its reason

- GIVEN a `medica` request with RN-07, RN-09, RN-10, RN-14 and RN-26 `absent` and a document whose firma, sello and type are not registered
- WHEN the secretary opens the detail
- THEN the verdict reads "No concluyente", and RN-11, RN-12 and RN-13 are listed apart, each stating as text that the datum is not registered

#### Scenario: RF-14 (d) the registered type is contrasted with the cause (hoja step d)

- GIVEN an `actividad_representativa` request and a secretary who registers type `constancia_medica` for its document
- WHEN the detail is shown after the save
- THEN the entry «Formato no corresponde a la causa» reads `present` and the verdict reads "Revisar con cuidado"
