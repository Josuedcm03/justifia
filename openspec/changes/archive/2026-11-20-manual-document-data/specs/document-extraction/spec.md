# Delta for Document Extraction

Traceability: RF-14 (a), (c), RN-24, RNF-04. Based on the current main text of
`openspec/specs/document-extraction/spec.md`. Requirement ids MD-n are stable and
shared by all deltas of this change.

Purpose amendment (informational, applied at archive): the sentence "Signals,
manual entry (RF-14, RN-24) and the name-match flag belong to
`validation-signals`" is replaced by: signals belong to `validation-signals`,
manual entry (RF-14, RN-24) belongs to `manual-document-data`, and the effective
view of a document, where manual data prevails over extracted data, is defined
here. No existing requirement of this capability changes: the extraction row, its
state machine, its stored data and its logs stay exactly as they are.

## ADDED Requirements

### Requirement: MD-21 Effective view of a document: manual data prevails field by field (RN-24, RF-14 a, RF-14 c, D8, D9)

Thesis: RN-24 «Un dato que la secretaría ingresa o corrige prevalece sobre el
extraído por OCR.» The single read of extracted data used by the staff detail
and by the signals MUST return, for each current document, an effective view
instead of the bare extraction row. For each of the four data (name, issuer,
issue date, rest period, the rest period as one unit) the effective value MUST
be the manual value when one is stored, otherwise the value of an extraction row
in `completada`, otherwise no value. The effective view MUST carry, per datum,
its origin (`manual` or `extracted`) so that the screen can mark manual data.
The effective state of the document MUST be `completada` when its extraction row
is `completada` OR at least one manual value exists among the four data;
otherwise it MUST be the state of the extraction row (`pendiente`, `procesando`,
`fallida`, `no_aplica`) or "no row". A document with no extraction row, or with
extraction not configured, and manual data MUST therefore be `completada`.
The document type and the marks `firma` and `sello` MUST NOT promote the state.
The page and the signals MUST read this same view, so that they cannot disagree.
The same merge MUST apply to the issuer read from the documents of earlier
requests for RN-14 (see `validation-signals`, RN-14). A failure of this read
MUST stay fail-soft as in `request-review`.

#### Scenario: Field-by-field precedence (table-driven)

| Extracted value | Manual value | Effective value, origin |
|---|---|---|
| "A" | none | "A", extracted |
| "A" | "B" | "B", manual |
| none | "B" | "B", manual |
| none | none | no value |

- GIVEN a `completada` extraction row and the issuer values in the row
- WHEN the effective view is read
- THEN the issuer is as shown, and the other data are resolved independently

#### Scenario: Manual data promotes the state

- GIVEN a document whose extraction row is `fallida`, `pendiente`, `procesando` or absent, or extraction not configured, and a manual issue date
- WHEN the effective view is read
- THEN the effective state is `completada`, the issue date is the manual one with origin `manual`, and the other three data have no value

#### Scenario: Marks and type do not promote

- GIVEN a document whose extraction row is `fallida`, with firma `No`, sello `Sí` and type `otro` and no manual datum among the four
- WHEN the effective view is read
- THEN the effective state is `fallida`

#### Scenario: Rest period is one unit

- GIVEN an extracted rest 2026-11-01 to 2026-11-10 and a manual rest 2026-11-09 to 2026-11-09
- WHEN the effective view is read
- THEN the rest period is 2026-11-09 to 2026-11-09 with 1 day, origin `manual`, and no extracted date is mixed in

#### Scenario: Page and signals read the same view

- GIVEN a document with a manual issuer over an extracted one
- WHEN the staff detail and the signals are read
- THEN both use the manual issuer

#### Scenario: Clearing restores the extracted value

- GIVEN a manual issuer over an extracted issuer "A", then cleared
- WHEN the effective view is read
- THEN the issuer is "A" with origin `extracted`

### Requirement: MD-22 Extraction and manual data never write each other (RN-24, RF-11, RNF-04)

Extraction (claim, completion, failure, lease expiry, the daily sweep and any
re-enqueue) MUST NOT read, change or delete manual data, and the save of manual
data MUST NOT change an extraction row (state, attempts, error code, values,
engine, times), MUST NOT register, claim or process any extraction and MUST NOT
call the model server. A result that completes after a manual save MUST NOT
change the effective manual values. Extraction MUST still change no table other
than its own (RN-02, "Stored data and logs"). Deleting a document MUST delete its
manual data with its extraction row, so that neither outlives the document
(RNF-04).

#### Scenario: Late extraction does not overwrite

- GIVEN a row `procesando` and a manual issuer saved meanwhile
- WHEN the extraction completes with another issuer
- THEN the row holds the extracted issuer and the effective issuer is still the manual one

#### Scenario: Manual save leaves the row alone

- GIVEN a row `fallida` with attempts 3 and an error code
- WHEN the secretary saves a manual issue date
- THEN the row is byte-for-byte unchanged, no extraction is queued and no network request is made

#### Scenario: Failure after manual data

- GIVEN a document with manual data whose extraction later fails
- WHEN the row becomes `fallida`
- THEN the manual data is unchanged

#### Scenario: Document deleted

- GIVEN a document with an extraction row and manual data
- WHEN the document is deleted
- THEN the extraction row and the manual data are both deleted
