# Delta for Supporting Documents

Change: `flow-experience` (roadmap row 13). Tabla 19 row RF-08 (5.8:12, 4.9
case RF-08, Anexo F RF-08 (a to c)). Owner decision 2026-11-20: the preview is
client-side only and writes no audit row. The authenticated route, the audit of
every successful read through it (D13) and the validation at finalize are
unchanged.

## ADDED Requirements

### Requirement: FE-17 Preview of a chosen file is client-side and unaudited (RF-08 a, RF-02; RN-03, RN-04; RNF-06, RNF-11, RNF-12)

In the documents step, wherever it renders (new request and correction), a
student who has chosen a file MUST be able to preview its content before
confirming the request: an image as an image and a PDF as a document, together
with its file name and size. The preview MUST be produced in the browser from the
file the student chose. It MUST NOT request the document through the document
route (`/api/intake/documents/<id>`), the store or any other server read, and
therefore MUST write no `documento.descargado` row and no other audit row. A
file whose content the browser cannot render MUST show its name and size only. The
preview MUST NOT replace the server validation of RN-04: a file that finalize
rejects stays rejected with its reason. A document already stored and not held in
the browser (for example after a reload, or one kept from the returned version)
has no client preview; its "View" link keeps its behavior, including the audit
row of D13. The preview MUST have the file name as its text alternative, MUST not
cause horizontal scroll at 360 px, and its texts MUST exist in `es` and `en`.

#### Scenario: Image preview (4.9 RF-08 a)

- GIVEN a student on the documents step who chooses a PNG
- WHEN the file is selected
- THEN a preview of the image is shown with its name and size

#### Scenario: PDF preview (4.9 RF-08 a)

- GIVEN a student who chooses a PDF
- WHEN the file is selected
- THEN a preview of the document is shown with its name and size

#### Scenario: No server read and no audit row (4.9 RF-08 a, c)

- GIVEN a student who chooses a file and previews it, before and after finalizing it
- WHEN the network requests and the audit log are inspected
- THEN no request goes to the document route and no `documento.descargado` row exists for the preview

#### Scenario: Content that cannot be rendered

- GIVEN a chosen file the browser cannot render
- WHEN the file is selected
- THEN the name and size are shown with no broken preview

#### Scenario: Validation still decides

- GIVEN an `.exe` renamed `scan.pdf` that the preview cannot render
- WHEN finalize runs
- THEN it is rejected with `unsupported_format` as in "Finalize with magic-byte validation"

#### Scenario: Stored document keeps its audited view

- GIVEN a stored document in a correction, kept from the returned version
- WHEN the owner activates its "View" link
- THEN the route serves it and exactly one `documento.descargado` row is written

#### Scenario: 360 px

- GIVEN a 360 px viewport and a previewed file
- WHEN the step renders
- THEN the document width does not exceed the viewport

#### Scenario: Translation keys present

- GIVEN the preview keys
- WHEN `es.json` and `en.json` are compared
- THEN both contain the same keys
