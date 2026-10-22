# Delta for Justification Intake

Covers RF-01 (d), RF-10 (b), RN-25, RNF-02. The career coordination becomes a
recipient of the request data when a request is escalated (E6), so the consent
label changes and `CONSENT_VERSION` moves to v2. The wording below is a
proposal pending UAM legal review (joins the open request-consent task 9.7);
a change of wording after review needs a new version again. Requests presented
under v1 keep their v1 consent and are NOT invalidated or backfilled.

## MODIFIED Requirements

### Requirement: Consent text and version (RF-01 d, RN-25)

The system MUST hold one consent text per supported locale, identified by a
single `CONSENT_VERSION`. The version of this change (v2) MUST be a new value,
an ISO date later than `2026-10-20`, fixed when the change is applied. The v2
text in `es` MUST be exactly: «Acepto que la UAM use los datos de esta
solicitud y de mis documentos, incluidos los datos de salud que contengan,
solo para tramitarla, que se envíen a los docentes de las asignaturas
afectadas y que, si la solicitud se escala, la coordinación de mi carrera
pueda consultarlos. Ver aviso de privacidad». The v2 text in `en` MUST be: "I
agree that UAM may use the data in this request and in my documents, including
any health data they contain, only to process it, that they be sent to the
teachers of the affected subjects and that, if the request is escalated, my
career coordination may consult them. View privacy notice". The trailing "Ver
aviso de privacidad" / "View privacy notice" is the link to the privacy
notice. A change to the `es` text MUST require a new `CONSENT_VERSION`; a test
MUST pin the hash of the `es` text to the version and fail when only one
changes. The v1 text and version (`2026-10-20`) remain the record of the
requests presented under them.
(Previously: a single initial text, version `2026-10-20`, naming only the teachers as recipients.)

#### Scenario: Text is the approved one

- GIVEN the v2 `CONSENT_VERSION`
- WHEN the `es` and `en` consent texts are read
- THEN they equal the v2 texts above and both name the career coordination

#### Scenario: Version is new

- GIVEN the v2 `CONSENT_VERSION`
- WHEN it is compared with `2026-10-20`
- THEN it is a different, later ISO date

#### Scenario: Text changed without version change

- GIVEN the `es` text is edited and `CONSENT_VERSION` is not
- WHEN the test suite runs
- THEN the hash test fails

#### Scenario: Version changed without text change

- GIVEN `CONSENT_VERSION` is edited and the `es` text is not
- WHEN the test suite runs
- THEN the hash test fails

#### Scenario: New request stores v2

- GIVEN a valid draft and `consentVersion` equal to the v2 version
- WHEN the student submits
- THEN the request stores the v2 version and `solicitud.presentada` carries it

#### Scenario: Page rendered under v1 is outdated

- GIVEN a review step rendered under `2026-10-20` and the server now at v2
- WHEN the student checks the box and submits
- THEN submit is refused with `consent_outdated` and nothing is stored or audited

#### Scenario: v1 requests untouched

- GIVEN requests presented under `2026-10-20`
- WHEN the change is applied
- THEN their stored consent version and timestamp are unchanged and they remain valid and correctable
