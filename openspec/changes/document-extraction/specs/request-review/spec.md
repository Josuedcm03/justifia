# Delta for Request Review

Covers RF-11 (a, b), RN-02, RNF-01, RNF-06. How the data is extracted lives in
`document-extraction`. Manual entry of data (RF-14, RN-24) and the name-match
signal (RF-05) are out of scope.

## ADDED Requirements

### Requirement: Extracted data section on the staff detail (RF-11 a, RF-11 b, RN-02, RNF-01)

In addition to the content of "Staff detail with history", the staff detail
MUST show a "Datos extraídos" / "Extracted data" section, after the documents
section, with one entry per current (non-retired) student document. When the
request has no such document and the read succeeded, the section MUST be
omitted. The section MUST be visible only to the roles that may open the staff
detail, under the same scope rules, and the access decision MUST live in
`src/lib/auth/permissions.ts`. It MUST NOT be shown to students, to other
roles or in the queue, and the student view MUST NOT receive extracted data.
For a `completada` document the entry MUST show, with text labels: the name
found in the document, the issuer, the issue date and the rest period. The rest
period MUST show from and to dates with the number of days, a single date with
the number of days when both dates are the same day, or only the number of days
when the document gave no dates. A field without value MUST show the muted text
"no reconocido" and no value (RF-11 b). Dates are calendar dates shown without
time-zone shift. The name MUST be labelled as read from the document, MUST NOT
replace or alter the snapshot name of the request (RN-02) and MUST NOT be
compared with it.

#### Scenario: Full data shown

- GIVEN a `completada` document with name, issuer, issue date and rest 2026-07-20 to 2026-07-24 (5 days)
- WHEN an in-scope secretary opens the detail
- THEN the four fields show those values, with the days next to the period

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

#### Scenario: Not for students or other roles

- GIVEN a request with a `completada` document
- WHEN its owner opens `/requests/[id]`, or a user whose role may not review requests (for example `coordinacion`) requests the staff detail
- THEN no extracted data is shown or returned

### Requirement: Extraction states on the staff detail (RF-11)

A document without a `completada` row MUST show a state instead of values,
with text and never color alone. The state MUST be decided in this order, the
first match winning: completed data; a request that is not `pendiente`, which
shows "unavailable"; a `fallida` row, which shows "unavailable"; extraction not
configured; and otherwise "extracting". While the request is `pendiente`, a
`pendiente` or `procesando` row, or a missing row for an eligible document,
MUST therefore show an "extracting" state, with no polling. The "unavailable"
state MUST tell staff to review the document themselves, with no retry, edit or
other action. A document without `completada` data in a request that is not
`pendiente` MUST never show extracting. A `no_aplica` document is not listed.
When extraction is not configured, the section MUST show once, at its top and
in place of the extracting state, the message «Hace falta configurar el
servicio de extracción. Contacte al administrador del sistema.» (`en`
equivalent), which MUST NOT name the environment variable, the address or the
key; documents waiting for the setting are not listed one by one. Completed
data and `fallida` entries MUST still show when extraction is not configured.

#### Scenario: Extracting

- GIVEN a `pendiente` request whose document row is `procesando` (or not yet created)
- WHEN the secretary opens the detail
- THEN the entry reads "extracting" and offers no action

#### Scenario: Permanently failed

- GIVEN a `fallida` row
- WHEN the secretary opens the detail
- THEN the entry reads "unavailable, review the document" and has no retry or edit control

#### Scenario: Not configured

- GIVEN extraction is not configured and two documents waiting
- WHEN the secretary opens the detail
- THEN the configuration message appears once and no extracting state is shown
- AND the message does not contain the variable name

#### Scenario: Decided request never extracting

- GIVEN an `aprobada` request with a document row still `pendiente`
- WHEN the secretary opens the detail
- THEN the entry reads "unavailable", not "extracting"

### Requirement: Extracted data is fail-soft and adds no audit row (RF-11, RNF-06)

The extracted-data read MUST be fail-soft: if it fails or throws, the staff
detail MUST still load completely, and the section MUST show a degraded notice
in place of the entries, with no partial or stale values. Showing the section
MUST add no audit row beyond the existing `solicitud.consultada` and MUST NOT
add an audit event type.

#### Scenario: Read failure

- GIVEN the extracted-data read throws
- WHEN the secretary opens the detail
- THEN the rest of the detail renders and the section shows the degraded notice

#### Scenario: One audit row

- GIVEN a request with extracted data
- WHEN the secretary opens the detail once
- THEN exactly one `solicitud.consultada` row is written and no other

### Requirement: Extraction UI i18n

All texts of the extracted-data section (labels, "no reconocido", extracting,
unavailable, degraded notice, the configuration message and the rest-period
wording) MUST exist in both `i18n/es.json` and `i18n/en.json` with the same
keys.

#### Scenario: Translation keys present

- GIVEN the extraction message keys
- WHEN `es.json` and `en.json` are compared
- THEN both contain the same keys
