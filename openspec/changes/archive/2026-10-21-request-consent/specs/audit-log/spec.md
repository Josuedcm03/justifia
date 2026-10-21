# Delta for Audit Log

Covers RF-01 (d), RN-25, RNF-02, RNF-06. No new audit action: the consent is
recorded inside the existing `solicitud.presentada` row (one entry per
operation). This is the only change to an existing payload made by
`request-consent`; where earlier requirements say existing payloads "MUST be
unchanged", they refer to the payloads before this change.

## MODIFIED Requirements

### Requirement: Request and document payloads minimise personal data (RNF-02, RN-02, RN-25)

Payloads MUST be structured and identify records by stable ids. They MAY carry
counts (subjects, documents), the detected content type, size, and for
`documento.rechazado` the rejection reason code. The `solicitud.presentada`
payload MUST also carry `consentimientoVersion`, the consent version stored on
the request in the same transaction. They MUST NOT carry the cause, dates,
student name, CIF, email, career, file name, file content, or storage location
or URL, nor any credential, nor the consent text or the consent timestamp.
(Previously: `solicitud.presentada` carried only counts of subjects and documents.)

#### Scenario: Submit payload

- GIVEN a submitted request
- WHEN the `solicitud.presentada` payload is serialized and searched
- THEN it contains no cause, date, name, CIF, email, or career value

#### Scenario: Consent version in the payload

- GIVEN a request submitted with consent version `2026-10-20`
- WHEN the `solicitud.presentada` payload is read
- THEN `consentimientoVersion` equals the version stored on the request
- AND the payload contains no consent text and no consent timestamp

#### Scenario: Blocked submit adds no consent audit

- GIVEN a submit refused with `consent_required` or `consent_outdated`
- WHEN the audit log is read
- THEN no row was added

#### Scenario: Rejection payload

- GIVEN a rejected upload named `diagnosis.pdf`
- WHEN the `documento.rechazado` payload is searched
- THEN it holds the reason code and no file name or location

#### Scenario: Leak check

- GIVEN all events from one intake flow
- WHEN every payload is searched for store URLs, tokens, or hash patterns
- THEN none is found
