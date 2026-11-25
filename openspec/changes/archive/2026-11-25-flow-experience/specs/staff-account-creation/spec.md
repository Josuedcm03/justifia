# Delta for Staff Account Creation

Change: `flow-experience` (roadmap row 13), backlog entry UX-21 (sign in with
the CIF or the institutional email). Staff have no CIF (`Usuario.Cif` is for
students only), so a staff account signs in with its email and must have one. The
role hierarchy, checks (a) and (b), the career rule and the facultad rule are
unchanged. The `Login` column is kept and derived, so no migration is needed.

## ADDED Requirements

### Requirement: FE-27 Account creation asks no "Usuario" and derives Login (UX-21; RN-02, RNF-01)

The staff creation form MUST NOT show or ask for a "Usuario". The server MUST set
the new account's `Login` deterministically from the normalized email (trimmed,
lower-case, the full address), with the same rule as the imported docentes (see
`imported-account-provisioning` "Login derivation"), and MUST ignore any `login`
value in the request. A derived `Login` that equals the `Login` of an existing
account MUST make the creation fail with an ordinary form error, with nothing
created and no suffix added. Accounts that exist before this change MUST keep
their `Login` unchanged. The audit row of the creation keeps its existing shape.
Texts MUST exist in `es` and `en`.

#### Scenario: The form has no Usuario field

- GIVEN an `administrador`, `coordinacion` or `secretaria` opening `/users/new`
- WHEN the form renders
- THEN it has no "Usuario" field and asks for name, email, password and the role-specific fields only

#### Scenario: Login derived from the email

- GIVEN a valid creation with the email "Ana.Perez@uni.edu"
- WHEN it succeeds
- THEN the account's `Login` is derived from "ana.perez@uni.edu" and its email is stored as "ana.perez@uni.edu"

#### Scenario: Posted login ignored

- GIVEN a hand-crafted request that carries `login=other`
- WHEN the account is created
- THEN its `Login` is the derived one

#### Scenario: Derived Login collision

- GIVEN an existing account whose `Login` equals the one derived for the new email
- WHEN the creation is submitted
- THEN no account is created and an ordinary form error is returned, with no redirect to the denied screen

#### Scenario: Existing logins untouched

- GIVEN accounts created before this change with a chosen "Usuario"
- WHEN the change is applied
- THEN their `Login` values are unchanged

### Requirement: FE-28 Staff accounts require a unique email (UX-21; RN-02, RNF-01)

Creating a staff account MUST require an email: a missing or empty email, or one
that is not a valid address of at most 160 characters, MUST make the creation
fail with an ordinary form error, with nothing created and no redirect. The email
MUST be stored normalized. An email equal, ignoring case and surrounding
whitespace, to the email of an existing account MUST make the creation fail the
same way. The rule applies to every role the flow can assign. Accounts created
before this change without an email, which have no CIF either, are not altered
by it; they cannot sign in by any value, their stored `Login` included, because
no fallback exists (`auth-entry-access` FE-21, FE-25). Texts MUST exist in `es`
and `en`.

#### Scenario: Email required and unique (table-driven)

| Email submitted | Existing accounts | Result |
|---|---|---|
| empty or absent | any | refused, error on email |
| `not-an-email` | any | refused, error on email |
| 161 characters | any | refused, error on email |
| `ana@uni.edu` | none with that email | account created |
| `ANA@uni.edu` | one with `ana@uni.edu` | refused, error on email, nothing created |

- GIVEN a creator and otherwise valid data for an allowed role
- WHEN they submit the email in the row
- THEN the outcome is as shown

#### Scenario: Every assignable role needs it

- GIVEN an `administrador` creating a `coordinacion`, a `coordinacion` creating a `secretaria` and a `secretaria` creating a `docente`
- WHEN each submits without an email
- THEN each is refused with an error on the email

#### Scenario: New staff can sign in

- GIVEN a staff account just created with an email and a password
- WHEN its holder submits that email and password at sign-in
- THEN they are signed in (`auth-entry-access` FE-21)

#### Scenario: Older email-less accounts are untouched

- GIVEN an active coordinator account created before this change with no email and no CIF
- WHEN the change is applied
- THEN the account is unchanged and cannot sign in, by its stored `Login` or by any other value, until it has an email
