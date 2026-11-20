# Delta for Imported Account Provisioning

Change: `flow-experience` (roadmap row 13), backlog entry UX-21. An imported
docente signs in with the institutional email, so the one-shot credentials export
identifies each account by its email instead of its `Login`. The rules for
identity resolution, `Login` derivation, temporary password generation, flagging
and existing accounts are unchanged; the import already derives `Login` from the
normalized full email and asks the workbook for no "Usuario".

## MODIFIED Requirements

### Requirement: Temporary password is shown once and never persisted or logged

Spec id FE-29. After a successful apply, the temporary credentials (institutional email and
temporary password per newly created account) MUST be delivered to the importer
only in that apply's response, as an exportable file. The file MUST identify
each account by its normalized email, because the email is what the docente
types to sign in; it MUST NOT present the derived `Login` as a "Usuario" to type.
They MUST NOT be stored in plaintext in the database, in any file on the server,
in the session, or in any log, and MUST NOT be re-displayed by any later request.
The credentials MUST NOT be delivered when the apply fails or rolls back. The
preview MUST NOT generate or return any password.
(Previously: the file carried the login and the temporary password per account.)

#### Scenario: Export accompanies the successful apply

- GIVEN an apply that created 3 accounts
- WHEN it succeeds
- THEN the importer receives one export with 3 email and temporary-password pairs

#### Scenario: Export names the account by email

- GIVEN a new docente with the email "Ana.Perez@uni.edu"
- WHEN the export is built
- THEN its row carries "ana.perez@uni.edu" as the sign-in identifier, and no column is labelled "Login" or "Usuario"

#### Scenario: The exported pair signs in

- GIVEN a row of the export and the account it names
- WHEN the email and the temporary password are submitted at sign-in
- THEN the docente is signed in and sent to the forced password change

#### Scenario: Not retrievable afterwards

- GIVEN a completed apply
- WHEN the importer reloads the page or requests the result again
- THEN no password is available anywhere in the application

#### Scenario: Logs are clean

- GIVEN an apply that created accounts
- WHEN the structured server log and any error output are inspected
- THEN they contain no temporary password and no password hash

#### Scenario: No credentials on failure

- GIVEN an apply that rolls back
- WHEN the outcome is returned
- THEN no credentials are present and no account exists

#### Scenario: Preview returns no credentials

- GIVEN a workbook containing new accounts
- WHEN it is only previewed
- THEN the report shows the count of accounts that would be created and no
  password
