# Delta for User Roles

Covers RNF-01 (a, b, c), RF-10, RN-15. The role `coordinacion` gains access to
the coordinator view of `coordination-escalation`, limited to its own career.
The role catalog itself is unchanged: one role per user, session carries the
role code.

## ADDED Requirements

### Requirement: Coordinacion access to escalation surfaces (RNF-01)

Role and career policy for escalation surfaces MUST live in
`src/lib/auth/permissions.ts`. Only a user with role `coordinacion` and a
non-null `CarreraId` MUST open the coordinator list, the coordinator detail,
the coordinator answer action and the document route as reader (c) (see
`supporting-documents`), and only for requests of the student's current career
equal to their own. A `coordinacion` without `CarreraId` MUST be denied every
escalation surface (fail closed). The secretary surfaces of escalation (tabs,
escalate, report, resend) MUST be reachable only by a `secretaria` in scope.
Every route, page and action MUST re-check authentication, role and career
server-side, and a denied call MUST return no data. A role denial follows
`permission-denied-screen` (a signed-in user of another role sees the denied
screen, an anonymous caller goes to login); only a `coordinacion` asking for a
request outside its career, or for an unknown id, gets the nonexistent-id
outcome, so the response never reveals whether such a request exists. The menu MUST show the
coordinator entry only to `coordinacion` and the review entry only to
`secretaria`.

#### Scenario: Access matrix (table-driven)

| Role | Coordinator list, detail, answer | Secretary tabs, escalate, report, resend |
|---|---|---|
| `coordinacion` with career, own career | allowed | denied |
| `coordinacion` with career, other career | denied (nonexistent-id outcome) | denied |
| `coordinacion` without career | denied | denied |
| `secretaria` in scope | denied | allowed |
| `estudiante`, `docente`, `administrador` | denied | denied |
| anonymous | denied | denied |

- GIVEN a caller with the role and career in the row
- WHEN they open the surface by URL or call its action directly
- THEN the outcome is as shown and a denial returns no data

#### Scenario: Menu per role

- GIVEN sessions of `coordinacion`, `secretaria` and `estudiante`
- WHEN the sidebar renders
- THEN `coordinacion` sees the coordinator entry and no review entry, `secretaria` sees the review entry and no coordinator entry, and `estudiante` sees neither

#### Scenario: Career change takes effect

- GIVEN a coordinator whose `CarreraId` is changed from C to D
- WHEN they open the list
- THEN only escalations of career D appear

#### Scenario: Role cannot answer a decision

- GIVEN a `coordinacion` of the career
- WHEN they call a secretary decision action (approve, reject, return)
- THEN access is denied and the request is unchanged
