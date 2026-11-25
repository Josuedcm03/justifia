# Delta for Users Listing

Change: `flow-experience` (roadmap row 13), backlog entry UX-21. The users list
keeps its `Login` column: the stored `Login` is now a derived value that no
screen asks anyone to type, and the list stays as it is. This delta pins that
nothing else moves, so that hiding "Usuario" in the sign-in, creation, import and
profile screens does not alter scope, columns, sorting, search or the fields
delivered to the browser.

## ADDED Requirements

### Requirement: FE-30 The Login column is retained and derived (UX-21; RN-02, RNF-01)

The users list MUST keep the `Login` column with the stored value of each
account: shown as before, sortable (`sort=login`) and matched by the search as
before. The accounts created before this change keep their `Login` unchanged, and
accounts created after it show the derived `Login` (see `staff-account-creation`
FE-27). The list MUST NOT tell anyone to enter a "Usuario". The rows delivered to
the browser MUST still contain exactly the fields of "The browser receives only
displayed fields": this change adds neither `correo` nor `cif` to them. The
viewer scope, pagination and the other columns MUST NOT change.

#### Scenario: Column shown and sorted as before

- GIVEN in-scope users with distinct `Login` values, some created before and some after this change
- WHEN the list is requested with `sort=login` and `sort=login&dir=desc`
- THEN every row shows its stored `Login` and the order is ascending, respectively descending, as in "Column sorting"

#### Scenario: Search by Login unchanged

- GIVEN a user whose `Login` derived from the email "jdiaz@uni.edu" and whose name does not contain "jdiaz"
- WHEN a viewer in scope searches for "jdiaz"
- THEN that user is listed

#### Scenario: Delivered rows unchanged (table-driven by forbidden field)

| Forbidden in the delivered rows |
|---|
| `hashClave` |
| `cif` |
| `telefono` |
| `correo` |

- GIVEN stored users with all four fields filled, and an `administrador` loading the list
- WHEN the props passed to the client table are serialized
- THEN none of the fields in the row appears and each row has exactly name, login, role, status, a creation date label and the `Id`

#### Scenario: Older logins untouched

- GIVEN accounts created before this change with a chosen "Usuario"
- WHEN the list is read after the change
- THEN their `Login` values are the same as before

#### Scenario: No instruction to type a Usuario

- GIVEN the list, its search field and its empty states in `es` and in `en`
- WHEN they render
- THEN no text asks the viewer to enter or remember a "Usuario"
