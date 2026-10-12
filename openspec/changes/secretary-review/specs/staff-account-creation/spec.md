# Delta for Staff Account Creation

Covers RF-06, RN-15, RNF-01, RNF-06. Decision SR-16 of
`secretary-review/design.md` (confirmed 2026-10-11: option (b) for new
accounts plus option (a) once for the existing `secretaria` account).

## ADDED Requirements

### Requirement: New secretaria accounts inherit the creator's facultad (SR-16, RNF-01)

When a `coordinacion` caller creates a `secretaria` account, the server MUST
set the new account's `FacultadId` to the `FacultadId` of the creator's
`Carrera` (via the creator's `Usuario.CarreraId`), read from the database at
creation time. The form MUST NOT gain a facultad field, and any `facultadId`
value in the request input MUST be ignored. A `coordinacion` caller without a
`CarreraId` (so with no derivable facultad) MUST be refused: nothing is created
and an ordinary form error is returned, not a redirect. Accounts of every other
role are created with a null `FacultadId`. `facultadId` MUST be in
`AUDITABLE_USER_FIELDS`, so the account-creation audit row lists it. There is
no edit-user screen, so this covers new accounts only; a `secretaria` account
that already exists receives its `FacultadId` through a one-off, owner-confirmed
`UPDATE` of that single row (tasks 7.7), never through this flow.

#### Scenario: Coordinator creates a secretaria in their facultad

- GIVEN a `coordinacion` whose career belongs to facultad A
- WHEN they create a `secretaria` with otherwise valid data
- THEN the account is created with `FacultadId` = A
- AND the creation audit row lists `facultadId` among the fields

#### Scenario: Forged facultad ignored

- GIVEN a `coordinacion` of facultad A
- WHEN the request carries `facultadId` = B
- THEN the account is created with `FacultadId` = A

#### Scenario: Coordinator without a career refused

- GIVEN a `coordinacion` with no `CarreraId`
- WHEN they submit an otherwise valid `secretaria` account
- THEN no account is created and a form error is returned
- AND there is no redirect to the permission-denied screen

#### Scenario: Other roles get no facultad

- GIVEN an `administrador` creating a `coordinacion`, or a `secretaria` creating a `docente`
- WHEN the account is created
- THEN its `FacultadId` is null

## MODIFIED Requirements

### Requirement: Check (b) - requested role must be assignable by the caller

After parsing and before any persistence, the action MUST verify that the
requested role is in the caller's assignable set. If not, it MUST create
nothing and MUST redirect the caller to the permission-denied screen, exactly as
check (a) does. It MUST NOT return a form error for this refusal, and no
role-not-allowed message is added to the catalogs. This MUST hold for a
hand-crafted request whose role value was never offered by the UI.
(Previously: check (b) returned a dedicated form error and never redirected.)
(Previously: the `coordinacion` -> `secretaria` pair had no extra condition; it
now requires a derivable facultad, see "New secretaria accounts inherit the
creator's facultad".)

#### Scenario: Allowed pairs create the account (table-driven)

| Caller | Requested role | Extra condition |
|---|---|---|
| `administrador` | `coordinacion` | valid existing `carreraId` |
| `coordinacion` | `secretaria` | the caller has a `CarreraId` (its `Carrera.FacultadId` is copied to the new account) |
| `secretaria` | `docente` | none |

- GIVEN an authenticated caller and otherwise valid data
- WHEN they submit the requested role from the row
- THEN the account is created with that role and they are redirected to the
  users list

#### Scenario: Disallowed pairs are redirected to the denied screen (table-driven)

| Caller | Rejected requested roles |
|---|---|
| `administrador` | `administrador`, `secretaria`, `docente` |
| `coordinacion` | `coordinacion`, `docente`, `administrador` |
| `secretaria` | `secretaria`, `coordinacion`, `administrador` |

- GIVEN an authenticated creator and otherwise valid data
- WHEN they submit a rejected role from their row
- THEN no account is created
- AND they are redirected to the permission-denied screen
- AND no form error is returned

#### Scenario: Estudiante target is a validation error, not a redirect

- GIVEN any creator caller
- WHEN they submit role `estudiante`
- THEN no account is created and the generic invalid-data form error is returned
- AND there is no redirect, because the input schema rejects the value as
  invalid data before check (b) runs

#### Scenario: Hand-crafted role outside the UI options

- GIVEN a `secretaria` sending a request built outside the form
- WHEN the role field is `administrador`
- THEN no account is created
- AND the caller is redirected to the permission-denied screen

#### Scenario: Refusal by check (b) is decided before any write

- GIVEN a `secretaria` submitting an otherwise valid request for role
  `coordinacion`
- WHEN check (b) refuses it
- THEN the number of stored accounts is unchanged after the redirect

## Notes

- The base assumption "a `secretaria` created by a `coordinacion` is NOT scoped
  to the coordinator's career" still holds: the new account gets the
  coordinator's facultad, not their career (`CK_Usuario_Ambito` forbids both on
  one row).
