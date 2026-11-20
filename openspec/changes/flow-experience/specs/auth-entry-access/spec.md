# Delta for Auth Entry Access

Change: `flow-experience` (roadmap row 13), backlog entries UX-20 (link to
"Cambiar contraseña"), UX-21 (sign in with the CIF or the institutional
email) and UX-22 (keep the session signed in). Owner decision 2026-11-20: UX-21
is its own late slice; the `Login` column of `Usuario` is kept, so reverting
restores sign-in by "Usuario" with no data loss. The change affects thesis
Anexo E line 3 ("Todos ingresan con «Usuario» y «Contraseña»"), listed for the
thesis session.

Terms: "identifier" = the single value typed in the sign-in field. "Institutional
email" = the `Usuario.Correo` of the account; it is validated as an email
address, not against a domain. "Normalized email" = trimmed and lower-case.

## ADDED Requirements

### Requirement: FE-20 `/profile` links to Change password (UX-20; RNF-01 b)

`/profile` MUST offer a "Cambiar contraseña" (`en`: "Change password") link to
`/change-password` to every signed-in user of the five roles who can see the
profile. The user menu of the sidebar SHOULD offer the same entry. Following the
link MUST open the voluntary password change, not the denied screen. A flagged
user, who is redirected from `/profile` (AEA-2), is unaffected: the forced change
still applies. An anonymous visitor MUST see no link and MUST NOT reach
`/change-password`. The link texts MUST exist in `es` and `en`.

#### Scenario: Link per role (table-driven)

| Session | Link on `/profile` |
|---|---|
| `estudiante`, `docente`, `coordinacion`, `secretaria`, `administrador` | present, target `/change-password` |

- GIVEN a normal session of the role in the row
- WHEN `/profile` is requested
- THEN the "Cambiar contraseña" link is present and points to `/change-password`

#### Scenario: The link opens the voluntary change

- GIVEN a signed-in user who follows the link
- WHEN `/change-password` is requested
- THEN the change-password form is shown and the user is not sent to the denied screen

#### Scenario: Flagged and anonymous callers

- GIVEN a flagged session, and separately no session
- WHEN `/profile` is requested
- THEN the redirect is `/change-password`, respectively `/login`, with no profile data read and no link rendered

#### Scenario: User menu entry

- GIVEN a signed-in user of any role
- WHEN the user menu opens
- THEN it offers "Cambiar contraseña" pointing to `/change-password`

#### Scenario: Translation keys present

- GIVEN the link keys
- WHEN `es.json` and `en.json` are compared
- THEN both contain the same keys

### Requirement: FE-21 Sign in with the CIF or the institutional email (UX-21; RN-02, RNF-01)

The sign-in form MUST have one identifier field, labelled "CIF o correo
institucional" (`en`: "CIF or institutional email"), and the password. It MUST
NOT show, name or ask for a "Usuario". The identifier MUST be classified by its
content: an identifier that contains `@` is an email, and MUST be trimmed and
matched, ignoring case, against `Usuario.Correo` of any role; any other
identifier is a CIF, and MUST be trimmed, MUST have its spaces and hyphens
removed, and MUST then be matched exactly against the stored `Usuario.Cif`,
which keeps its 20-character limit. No CIF format or digit count is assumed: a
student's CIF is digits only, but the staff CIF has another, unknown format and
is not stored today. The CIF is matched against accounts that have a CIF, which
today means students only. Students MAY use either identifier; every other role
MUST use its email. A value that is neither the email nor the CIF of an active
account MUST fail, except the transitional `Login` fallback of FE-25, which
covers only accounts that would otherwise be locked out. The identifier MUST be
at most 160 characters. After a
successful match the session, the role code, the forced password change and the
safe `next` redirect (AEA-3) MUST behave exactly as before. All texts MUST exist
in `es` and `en`.

#### Scenario: Who can sign in with what (table-driven)

| Identifier typed | Account | Result |
|---|---|---|
| the student's CIF | active `estudiante` | signed in |
| the student's email | active `estudiante` | signed in |
| the email | active `docente`, `coordinacion`, `secretaria` or `administrador` | signed in |
| a CIF-shaped value | any staff account (unless it is the legacy `Login` of an account without email, FE-25) | fails |
| a former "Usuario" | an account that has an email, or a student that has a CIF | fails |
| a former "Usuario" | an active account with no email and no CIF (FE-25 fallback) | signed in |
| the CIF or the email | inactive account | fails |

- GIVEN the account in the row and the correct password
- WHEN the identifier in the row is submitted
- THEN the outcome is as shown

#### Scenario: CIF matching is exact after cleaning, with no assumed format (table-driven)

| Stored `Cif` of an active student | Typed identifier | Result |
|---|---|---|
| `26001234` | `26001234` | signed in |
| `26001234` | `  26-00 1234 ` | signed in |
| `26001234` | `2600123` | fails |
| `2600123456` (10 digits) | `2600123456` | signed in |

- GIVEN the student in the row and the correct password
- WHEN the identifier in the row is submitted
- THEN the outcome is as shown, because the CIF is cleaned of spaces and hyphens and compared exactly, with no digit count assumed

#### Scenario: Student without an email signs in by CIF

- GIVEN an active student with a CIF and no email
- WHEN they submit the CIF and the correct password
- THEN they are signed in

#### Scenario: The form asks no Usuario

- GIVEN the sign-in page in `es` and in `en`
- WHEN it renders, including after a failed attempt
- THEN there is one identifier field labelled with the CIF and the email, and the word "Usuario" does not appear in the form, its hints or its error

#### Scenario: Flag and redirect unchanged

- GIVEN a flagged account that signs in by email, and a normal account with `next=/requests`
- WHEN each signs in
- THEN the flagged one is sent to the forced password change and the other to `/requests`

#### Scenario: Oversized identifier

- GIVEN an identifier of 161 characters
- WHEN it is submitted
- THEN it fails with the generic message of FE-23 and no account is read

#### Scenario: Translation keys present

- GIVEN the sign-in label and message keys
- WHEN `es.json` and `en.json` are compared
- THEN both contain the same keys

### Requirement: FE-22 Email matching ignores case, and an ambiguous identifier fails closed (UX-21; RN-02, RNF-01)

An email identifier MUST be compared with `Usuario.Correo` ignoring case and
surrounding whitespace, so that " Ana.Perez@UNI.edu " matches a stored
"ana.perez@uni.edu" and the reverse. When the identifier matches more than one
account (for instance two legacy emails that differ only by case), the sign-in
MUST fail and MUST NOT pick one. A CIF identifier MUST be compared exactly after
trimming and removing spaces and hyphens, as in FE-21. Every account written
after this change MUST store its email
normalized, so that the stored value never differs from another only by case.
No creation path MUST create a second account whose normalized email equals
that of an existing account: the staff form and self-registration refuse it, and
the catalog import matches the existing account, as in
`imported-account-provisioning`.

#### Scenario: Case and whitespace (table-driven)

| Stored `Correo` | Typed identifier | Result |
|---|---|---|
| `ana.perez@uni.edu` | `Ana.Perez@UNI.edu` | signed in |
| `ana.perez@uni.edu` | `  ana.perez@uni.edu  ` | signed in |
| `Ana.Perez@Uni.edu` (legacy, mixed case) | `ana.perez@uni.edu` | signed in |
| `ana.perez@uni.edu` | `ana.perez@uni.edu.ni` | fails |

- GIVEN an active account with the stored email in the row and the correct password
- WHEN the identifier in the row is submitted
- THEN the outcome is as shown

#### Scenario: Two accounts collide ignoring case

- GIVEN two legacy accounts whose emails are "ana@uni.edu" and "Ana@uni.edu"
- WHEN either email is submitted with the correct password of one of them
- THEN the sign-in fails and no session is issued

#### Scenario: New accounts store the normalized email

- GIVEN a new account created with the email " Ana.Perez@UNI.edu "
- WHEN its stored email is read
- THEN it is "ana.perez@uni.edu"

#### Scenario: Creation refused on a case-only duplicate (table-driven)

| Creation path | Email | Existing email | Result |
|---|---|---|---|
| staff form | `ANA@uni.edu` | `ana@uni.edu` | refused, nothing created |
| self-registration | `Ana@Uni.edu` | `ana@uni.edu` | refused, nothing created |
| catalog import (docente) | ` ana@UNI.edu ` | `ana@uni.edu` | matches the existing account, no second account |

- GIVEN the existing account and the creation in the row
- WHEN it is processed
- THEN the outcome is as shown

### Requirement: FE-23 Sign-in failures are generic (UX-21; RNF-01 a, c)

Every failed sign-in MUST return the same message and the same response shape,
whatever the cause: an unknown identifier, a wrong password, an inactive account,
an ambiguous identifier (FE-22), a CIF used by a non-student, an empty, malformed
or oversized identifier, and a password that fails the length rule. The message
MUST NOT say which part was wrong, whether an account exists or is inactive, or
whether the identifier was taken as a CIF or an email, and MUST NOT use the word
"Usuario". A failure MUST issue no session and set no cookie. The message MUST
exist in `es` and `en`.

#### Scenario: Same response for every cause (table-driven)

| Case | Response |
|---|---|
| email of no account | the generic message |
| email of an active account, wrong password | the generic message |
| CIF of an inactive student | the generic message |
| email shared by two legacy accounts | the generic message |
| staff account typed with a CIF-shaped value | the generic message |
| empty identifier, 161-character identifier, 3-character password | the generic message |

- GIVEN the case in the row
- WHEN it is submitted
- THEN the response is the same message, with no session cookie, and nothing in it tells the cases apart

#### Scenario: Message wording

- GIVEN the generic message in `es` and in `en`
- WHEN it is read
- THEN it does not contain "Usuario", "user", "no existe" or "inactive", and does not name the identifier or the password as the faulty part

### Requirement: FE-24 `/profile` shows no "Usuario" (UX-21; RN-02, RNF-01)

`/profile` MUST NOT show a "Usuario" row. It MUST keep showing the data of the
signed-in account that identifies it: the institutional email when the account
has one and, for a student, the CIF, besides the role, the other fields it showed
and the member-since date. The profile is still read for the signed-in account
only (AEA-2). Texts MUST exist in `es` and `en`.

#### Scenario: No Usuario row (table-driven over roles)

| Session | Rows |
|---|---|
| `estudiante` | email, CIF, role, phone when present, career, member since; no "Usuario" |
| `docente`, `coordinacion`, `secretaria`, `administrador` | email, role, phone when present, member since; no "Usuario" |

- GIVEN a normal session of the role in the row
- WHEN `/profile` is requested
- THEN the rows are as shown

#### Scenario: Still the own data only

- GIVEN a session of each role
- WHEN `/profile` is requested
- THEN only that account's data is read and shown

### Requirement: FE-25 No active account is left without a way to sign in (UX-21; RN-02, RNF-01)

Because the identifier is the CIF or the email, an account that has neither
cannot sign in after this change. Before the slice that introduces the identifier
reaches `main`: (1) a read-only count MUST be taken of the active accounts, other
than the system account and accounts cancelled by retention, that have neither a
`Cif` nor a `Correo`, together with the number of groups of accounts whose emails
collide ignoring case; (2) the count and the ids of the affected accounts, with
no names or emails, MUST be recorded in the merge gate of the change; (3) while
the count is not zero the slice MUST NOT be released unless each listed account
has gained an identifier or the fallback fixed by the design covers it. The
fallback (owner decision 2026-11-20) is transitional: an active account that has
no `Correo` and is not a student with a `Cif` MAY sign in with its stored `Login`
as the identifier, trimmed. It MUST NOT reach any other account: the `Login` of
an account that has an email, or of a student that has a CIF, MUST fail. It MUST
be removed once the read-only count of such accounts is zero. The count MUST
write nothing. The system account and the accounts cancelled by
retention are excluded because they cannot sign in before or after the change.
No account creation path MUST produce an account with neither identifier.

#### Scenario: A locked-out account is counted before release

- GIVEN an active staff account with no `Correo` and no `Cif`, and an active student with a CIF and no email
- WHEN the read-only count runs
- THEN only the staff account is counted and listed by id
- AND the slice is not released while it is listed, until it gains an email or the design's fallback covers it

#### Scenario: Count of zero

- GIVEN no active account without both identifiers and no email collision
- WHEN the count runs
- THEN the result is zero and the slice may be released

#### Scenario: Excluded accounts

- GIVEN the system account and a student cancelled by retention (inactive, with no email and no CIF)
- WHEN the count runs
- THEN neither is counted, and neither can sign in before or after the change

#### Scenario: Such an account signs in only through the fallback

- GIVEN an active account with neither identifier, left as it is, and the change released
- WHEN its stored `Login` is submitted with its former password
- THEN it is signed in through the transitional fallback
- AND any other value submitted for it fails with the generic message of FE-23 and no session is issued

#### Scenario: The fallback reaches only accounts without an identifier (table-driven)

| `Login` typed belongs to | Result |
|---|---|
| an active staff account that has an email | fails |
| an active student that has a CIF and no email | fails |
| an active account with no email that is not a student with a CIF | signed in |
| an inactive account with no email | fails |

- GIVEN the account in the row and the correct password
- WHEN its `Login` is submitted as the identifier
- THEN the outcome is as shown, and the failures use the generic message of FE-23

#### Scenario: Case collisions are counted

- GIVEN two accounts whose emails differ only by case
- WHEN the count runs
- THEN one collision group is reported, with the account ids

#### Scenario: The count writes nothing

- GIVEN the count run
- WHEN accounts and the audit log are compared before and after
- THEN nothing changed

#### Scenario: No creation path yields an account without an identifier (table-driven)

| Creation path | Without email | Without CIF |
|---|---|---|
| staff form | refused, email required | not applicable (staff have no CIF) |
| self-registration | refused, email required | refused, CIF required |
| catalog import (docente) | row error, the email is the key | not applicable |

- GIVEN a creation with the data in the row
- WHEN it is processed
- THEN the outcome is as shown and no account is created

### Requirement: FE-32 The session can be kept signed in for 30 days (UX-22; RNF-01)

The sign-in form MUST offer a checkbox labelled "Mantener la sesión iniciada"
(`en`: "Keep me signed in"), unchecked by default. When it is checked at a
successful sign-in, the session token and the session cookie MUST last 30 days;
when it is not, they MUST last 8 hours, as today. The choice MUST travel with the
session itself, so that every re-issue of the session (the forced and the
voluntary password change) keeps the duration the user chose. Signing out MUST
clear the session cookie whether or not the box was checked. A failed sign-in
MUST issue no session and set no cookie, whatever the box says. A session
created by self-registration keeps the 8-hour duration. The checkbox MUST NOT
change what any role can reach, the forced password change, the safe `next`
redirect or the generic failure of FE-23: the access matrix is unchanged. A
token issued before this change, which carries no such choice, MUST stay valid
and read as unchecked. Its texts MUST exist in `es` and `en`.

#### Scenario: Checked lasts 30 days

- GIVEN valid credentials and the box checked
- WHEN the sign-in succeeds
- THEN the token expires 30 days after it was issued and the cookie `maxAge` is 30 days

#### Scenario: Unchecked lasts 8 hours

- GIVEN valid credentials and the box unchecked or absent
- WHEN the sign-in succeeds
- THEN the token expires 8 hours after it was issued and the cookie `maxAge` is 8 hours

#### Scenario: Sign-out clears it

- GIVEN a session started with the box checked
- WHEN the user signs out
- THEN the session cookie is cleared and `/login` is shown on the next request, as for an 8-hour session

#### Scenario: The forced password change still applies

- GIVEN an account flagged for a password change that signs in with the box checked
- WHEN the sign-in succeeds
- THEN the user is sent to the forced password change and reaches nothing else until it is done
- AND after the change the re-issued session keeps the 30-day duration and no longer carries the flag

#### Scenario: Access matrix unchanged

- GIVEN the access matrix of the five roles
- WHEN the entry points are exercised with a session issued with the box checked and one issued without it
- THEN every outcome is identical and no row is added to or changed in the matrix

#### Scenario: Old tokens and failed attempts

- GIVEN a token issued before this change, and a failed sign-in with the box checked
- WHEN each is used or inspected
- THEN the old token is valid and reads as an 8-hour session, and the failure sets no cookie

## MODIFIED Requirements

### Requirement: AEA-4 `registerAction` characterization (RNF-01 c)

Spec id FE-26. CHARACTERIZATION of current behavior, not desired behavior: the later
`/register` closing change (roadmap point 0.6) MUST edit these pins on purpose.
Today `registerAction` MUST always create the user with role `estudiante`,
MUST NOT apply any guard, and MUST NOT verify the CIF. The registration form MUST
NOT ask for a "Usuario": the account's `Login` MUST be derived by the server from
the normalized email (see `staff-account-creation` FE-27), and a value posted as
`login` MUST be ignored. A derived `Login` that already exists MUST make the
registration fail with the existing duplicate error.
(Previously: the form asked for a "Usuario" and stored it as `Login`.)

#### Scenario: Role is always `estudiante`

- GIVEN a valid form that also posts `rol=administrador`
- WHEN `registerAction` runs
- THEN the created user has role `estudiante`

#### Scenario: No guard, no CIF verification

- GIVEN a valid form with an unverified CIF, with or without a signed-in caller
- WHEN `registerAction` runs
- THEN the account is created without a guard check or CIF lookup

#### Scenario: No Usuario asked, Login derived

- GIVEN a valid registration with the email "Ana.Perez@uni.edu" that also posts `login=other`
- WHEN `registerAction` runs
- THEN the registration form has no "Usuario" field, the account's `Login` is derived from "ana.perez@uni.edu", and the posted `login` is ignored

#### Scenario: Derived Login already taken

- GIVEN an existing account whose `Login` equals the one derived for the new email
- WHEN `registerAction` runs
- THEN no account is created and the duplicate error is returned
