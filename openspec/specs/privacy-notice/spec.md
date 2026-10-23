# Privacy Notice Specification

## Purpose

A static, public privacy notice (aviso de privacidad) that the consent
checkbox, login and register link to. Covers RF-01 (d), RF-03 (f), RN-25,
RNF-04 (retention statement), RNF-11. The consent text and checkbox live in
`justification-intake`. Not legal advice: UAM legal review is required before
production (see the draft marker).

## Requirements

### Requirement: Public access (RN-25, D10)

The notice MUST be served at `/privacy` without any session, to anyone, and
MUST contain no per-user or personal data. It MUST also be served, unchanged,
to a signed-in user: a user with a session MUST NOT be redirected away from it
(unlike the login and register pages). Only this route is added to the set of
public routes; every other protected route MUST keep requiring a session. The
notice MUST be linked from the consent checkbox (opening in a new tab, see
`justification-intake`), the login page and the register page (same tab).

#### Scenario: Anonymous visitor

- GIVEN no session
- WHEN `/privacy` is requested
- THEN the notice is returned and the visitor is not redirected to login

#### Scenario: Signed-in user is let through

- GIVEN a signed-in user, of any role
- WHEN `/privacy` is requested
- THEN the notice is returned and the user is not redirected to the dashboard or anywhere else

#### Scenario: Other routes stay protected

- GIVEN no session
- WHEN `/requests` is requested
- THEN the visitor is redirected to login as before

#### Scenario: Links from entry pages

- GIVEN the login page and the register page
- WHEN each renders
- THEN each contains a link to `/privacy` that opens in the same tab

### Requirement: Required contents (RF-01 d, RN-25, RNF-04)

The notice MUST state, in plain language: the controller (Universidad
Americana, UAM) with its domicile and contact office (until the owner supplies
that wording, a visibly marked placeholder is allowed while the draft marker is
shown); the purpose (to process the justification request, nothing
else); the recipients (the teachers of the subjects the request names); the
categories of data processed, marking health data as sensitive; which data is
mandatory to submit a request; the data-subject rights and how to revoke
consent, exercised in writing to the faculty secretary's office; the retention
period (five years, then cancellation); and the notice version and date. The
version shown MUST equal `CONSENT_VERSION` (`"2026-10-20"` for the initial
notice, shown as a date). A test MUST pin the hash of the `es` notice text to
`CONSENT_VERSION` so that editing the notice without a new version fails.

#### Scenario: All facts present (table-driven)

| Fact | Must appear |
|---|---|
| controller UAM | yes |
| purpose | yes |
| recipients: teachers of the affected subjects | yes |
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

### Requirement: Draft marker (R2, D9)

Until UAM approves it, the notice MUST display a visible marker stating that it
is a draft pending UAM review, in both locales, as the first element of the
notice.

#### Scenario: Marker shown

- GIVEN the notice in either locale
- WHEN it renders
- THEN a visible draft-pending-UAM-review statement is present

### Requirement: No mail provider named (R2)

The notice MUST NOT name the email delivery provider or any other third-party
service, in either locale.

#### Scenario: Provider absent

- GIVEN the notice texts in `es` and `en`
- WHEN they are searched for the provider's name
- THEN no match is found

### Requirement: Usability and i18n (RNF-11)

The notice MUST be readable in full at 360 px width with no horizontal
scrolling, MUST pass the automated accessibility check, and MUST exist in both
`i18n/es.json` and `i18n/en.json` with the same keys, rendered in the active
locale.

#### Scenario: 360 px

- GIVEN a 360 px viewport
- WHEN the notice renders
- THEN the document width does not exceed the viewport and the axe check reports no violation

#### Scenario: Translation keys present

- GIVEN the notice message keys
- WHEN `es.json` and `en.json` are compared
- THEN both contain the same keys
