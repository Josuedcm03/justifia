# Delta for Backoffice Shell

Covers RNF-01 (b), RNF-11 (shell and home), RF-16. Adds the student's
Enrollment destination to the sidebar, the top-bar trail and the dashboard
shortcuts; the entries of every other role are unchanged.

## MODIFIED Requirements

### Requirement: BS-NAV-1 Sidebar entries are unchanged

The sidebar body MUST show the same entries, in the same order, with the same
group and the same visibility predicates as before the backoffice refresh, and
the same active marker (the 4px bar paired with `aria-current`), with one
addition: the Enrollment entry for `estudiante` (BS-NAV-3). The `/settings`
entry MUST stay exactly as it is (D7), including its target. The
"Administration" group MUST still render only when at least one child is
visible.
(Previously: no entry was added; the student saw My requests and New request only.)

#### Scenario: Entries per role (table-driven)

| Role | Entries shown |
|---|---|
| `estudiante` | Dashboard, My requests, New request, Enrollment, Settings |
| `docente` | Dashboard, Settings |
| `administrador` | Dashboard, Administration (Asignaturas, Docentes, Users), Settings |
| `coordinacion` | Dashboard, Administration (Asignaturas, Docentes, Users), Settings |
| `secretaria` | Dashboard, Review requests, Administration (Asignaturas, Docentes, Import, Users), Settings |

- GIVEN a signed-in user with the role from the row
- WHEN the sidebar renders
- THEN exactly the entries in the row are shown, in that order
- AND no Grupos destination is offered (CM-NAV-1)

#### Scenario: Settings entry unchanged

- GIVEN any signed-in role
- WHEN the sidebar renders
- THEN the Settings entry is present with its previous label, icon, position and
  `/settings` target

#### Scenario: Active marker

- GIVEN the path `/catalog/asignaturas/3/grupos/new`
- WHEN the sidebar renders
- THEN only the Asignaturas entry is active and carries `aria-current`

#### Scenario: Administration group hidden when empty

- GIVEN a role that sees no Administration child
- WHEN the sidebar renders
- THEN the Administration group is not rendered

### Requirement: BS-HOME-1 Role-aware dashboard home

The dashboard home MUST show a shortcut card for every menu destination the
viewer's role can see, derived from the same navigation configuration and
predicates as the sidebar, in the sidebar's order (My requests, New request,
Enrollment, Review requests, Asignaturas, Docentes, Import, Users);
the Dashboard entry and the Settings entry are not offered as shortcuts (the
settings route does not exist; D7 freezes the sidebar entry, not a second dead
link). User-count cards (total and active users) MUST show only to roles that
may open `/users`, and MUST use the existing stats read without a new data
query (D9); that read MUST NOT be performed for a role that does not show the
cards. No shortcut MUST lead to a destination the role cannot open. A role with no shortcut and no counts MUST see the page header and
a short localized message instead of an empty area.
(Previously: the student shortcuts were My requests and New request.)

#### Scenario: Home per role (table-driven)

| Role | Shortcut cards | User-count cards |
|---|---|---|
| `estudiante` | My requests, New request, Enrollment | no |
| `docente` | none (message shown) | no |
| `administrador` | Asignaturas, Docentes, Users | yes |
| `coordinacion` | Asignaturas, Docentes, Users | yes |
| `secretaria` | Review requests, Asignaturas, Docentes, Import, Users | yes |

- GIVEN a signed-in user with the role from the row
- WHEN the dashboard home renders
- THEN the cards are exactly as in the row
- AND each shortcut links to the same target as its sidebar entry

#### Scenario: Counts hidden from student and docente

- GIVEN an `estudiante`, and separately a `docente`
- WHEN the home renders
- THEN no total-users or active-users figure is present in the page
- AND the stats read is not performed for that request

#### Scenario: No shortcut to settings

- GIVEN any role
- WHEN the home renders
- THEN no card links to `/settings` and no card links to `/`

#### Scenario: Stats read degrades

- GIVEN a role that sees user-count cards and a failed stats read
- WHEN the home renders
- THEN the degraded alert is shown in place of the figures, not zeros presented as
  real counts

#### Scenario: Predicates stay in step

- GIVEN a change of a sidebar visibility predicate
- WHEN the sidebar and the home render for the affected role
- THEN both show or both hide the destination

## ADDED Requirements

### Requirement: BS-NAV-3 Enrollment destination for students

The navigation configuration MUST contain one Enrollment entry targeting
`/enrollment`, placed after New request, visible only to the roles that may
open that page (`estudiante`), through the same predicate the page enforces. It
MUST get its sidebar entry, its dashboard shortcut and its top-bar trail from
that one entry (BS-CTX-1, BS-HOME-1), with a label in both `es` and `en`. No role other than `estudiante` MUST see it.

#### Scenario: Entry and active marker

- GIVEN a signed-in `estudiante` on `/enrollment`
- WHEN the sidebar renders
- THEN the Enrollment entry is present, active and carries `aria-current`
- AND on `/requests/new` it is not active

#### Scenario: Trail

- GIVEN a signed-in `estudiante` on `/enrollment`
- WHEN the top bar renders in `es` and in `en`
- THEN the trail shows the Enrollment label as text with `aria-current`, the page
  has exactly one `h1`, and no record name appears

#### Scenario: Hidden from other roles (table-driven)

| Role |
|---|
| `docente` |
| `secretaria` |
| `coordinacion` |
| `administrador` |

- GIVEN a signed-in user with the role from the row
- WHEN the sidebar and the home render
- THEN no Enrollment entry and no Enrollment shortcut is shown
