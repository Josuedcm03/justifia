# Delta for Privacy Notice

Covers RF-01 (d), RF-10 (b), RN-25, RNF-02, RNF-04. The notice must name the
career coordination as a recipient (E6). Not legal advice: the draft marker
stays until UAM approves.

## MODIFIED Requirements

### Requirement: Required contents (RF-01 d, RN-25, RNF-04)

The notice MUST state, in plain language: the controller (Universidad
Americana, UAM) with its domicile and contact office (until the owner supplies
that wording, a visibly marked placeholder is allowed while the draft marker is
shown); the purpose (to process the justification request, nothing
else); the recipients (the teachers of the subjects the request names and, if
the request is escalated, the coordination of the student's career, which
receives a minimal notification by email and consults the request and its
documents inside the system); the categories of data processed, marking health
data as sensitive; which data is mandatory to submit a request; the
data-subject rights and how to revoke consent, exercised in writing to the
faculty secretary's office; the retention period (five years, then
cancellation); and the notice version and date. The version shown MUST equal
`CONSENT_VERSION` (the v2 version of this change). A test MUST pin the hash of
the `es` notice text to `CONSENT_VERSION` so that editing the notice without a
new version fails.
(Previously: the only recipients named were the teachers of the affected subjects; version `2026-10-20`.)

#### Scenario: All facts present (table-driven)

| Fact | Must appear |
|---|---|
| controller UAM | yes |
| purpose | yes |
| recipients: teachers of the affected subjects | yes |
| recipients: career coordination when the request is escalated | yes |
| data categories, health marked sensitive | yes |
| data mandatory to submit | yes |
| rights and written revocation to the faculty secretary's office | yes |
| five-year retention | yes |
| version and date | yes |

- GIVEN the notice in `es` and in `en`
- WHEN each is rendered
- THEN every fact in the table appears

#### Scenario: Version matches the consent

- GIVEN `CONSENT_VERSION`
- WHEN the notice is rendered
- THEN the version it shows equals `CONSENT_VERSION`

#### Scenario: Notice edited without a new version

- GIVEN the `es` notice text is edited and `CONSENT_VERSION` is not
- WHEN the test suite runs
- THEN the hash test fails

#### Scenario: Notice and consent agree on recipients

- GIVEN the v2 consent label and the notice
- WHEN both are read in each locale
- THEN both name the career coordination as a recipient
