# Delta for Imported Account Provisioning

Change `docente-maintenance`, slice S4 (D3). Requirements covered: RF-12 (b),
RNF-13 (b), RNF-05 (passwords untouched). [PG] marks a scenario that MUST run on a
real PostgreSQL (see `docente-maintenance`).

## Notes for archive

- In "Assumptions and open questions", replace the bullet "Assumption: an existing
  account matched by the import that is inactive is updated but not reactivated by
  this change. Confirm at design." with: "Decision (`docente-maintenance`, D3): an
  existing account matched by the import is updated in its non-credential
  attributes only and its `Activo` never changes; an inactive docente is not
  reactivated by the import, and a Grupos row that names it is a row error."
- "Account writes are audited without credentials" is not edited. The audit rows
  the import writes for an inactive docente's name or phone update keep their
  current shape (`origen` `importacion`, with the file digest).

## MODIFIED Requirements

### Requirement: Existing accounts keep their credentials

An account matched by `Correo` MUST be updated only in its non-credential
attributes (for example name and phone). Its `HashClave` MUST NOT change,
`DebeCambiarClave` MUST NOT be set true by the import, no temporary password MUST
be generated for it, its role MUST NOT change, and its `Activo` MUST NOT change
(an inactive account stays inactive and an active one stays active). Its `Correo`
and `Login` MUST NOT be written either.
(Previously: `Activo`, `Correo` and `Login` were not named; the assumption that an
inactive account is not reactivated was left to be confirmed at design.)

#### Scenario: Re-import does not reset a password

- GIVEN a docente created by a previous import who has since set their own
  password
- WHEN the same workbook is imported again
- THEN their `HashClave` is unchanged and `DebeCambiarClave` is false
- AND the export contains no entry for them

#### Scenario: Changed name on an existing account

- GIVEN an existing docente whose name differs in the workbook
- WHEN applied
- THEN the name is updated and counted as `update`, and the password is
  unchanged

#### Scenario: An inactive account is updated but not reactivated [PG]

- GIVEN an inactive docente whose name and phone differ in the workbook
- WHEN applied
- THEN the name and phone are updated, `Activo` is still false, `HashClave` and
  `DebeCambiarClave` are unchanged, no temporary password is generated and the
  export has no entry for the docente

#### Scenario: An active account stays active [PG]

- GIVEN an active docente listed in the workbook
- WHEN applied
- THEN `Activo` is still true and `Correo` and `Login` are unchanged
