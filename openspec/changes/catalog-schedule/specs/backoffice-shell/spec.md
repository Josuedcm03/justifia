# Delta for Backoffice Shell

Traceability: RF-12 (a), RNF-01 (b) ("the menu of each role shows only its
options"). The Inscripciones entry is visible through `canManageEnrollments`
(role `secretaria` only), not through `canManageCatalog`.

## MODIFIED Requirements

### Requirement: BS-NAV-1 Sidebar entries are unchanged

The sidebar body MUST show the same entries, in the same order, with the same
group and the same visibility predicates as before the backoffice refresh, and
the same active marker (the 4px bar paired with `aria-current`), with four
additions: the Enrollment entry for `estudiante` (BS-NAV-3); the Escalated
requests entry for `coordinacion`, a top-level entry placed after Review
requests, visible through the `canCoordinate` predicate and not prefetched
because its pages are audited on render (added by the `escalation` change); the
Reports entry for `coordinacion` (RF-17, RNF-01 b), a top-level entry placed
after Escalated requests and before the Administration group, visible through
the `canViewReports` predicate and not prefetched, because its page is audited
on render; and the Inscripciones entry for `secretaria` (BS-NAV-4), inside the
Administration group, after Docentes and before Import, visible through the
`canManageEnrollments` predicate. The `/settings` entry MUST stay exactly as it
is (D7), including its target. The "Administration" group MUST still render only
when at least one child is visible.
(Previously: three additions, without the Inscripciones entry.)

#### Scenario: Entries per role (table-driven)

| Role | Entries shown |
|---|---|
| `estudiante` | Dashboard, My requests, New request, Enrollment, Settings |
| `docente` | Dashboard, Settings |
| `administrador` | Dashboard, Administration (Asignaturas, Docentes, Users), Settings |
| `coordinacion` | Dashboard, Escalated requests, Reports, Administration (Asignaturas, Docentes, Users), Settings |
| `secretaria` | Dashboard, Review requests, Administration (Asignaturas, Docentes, Inscripciones, Import, Users), Settings |

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

#### Scenario: Reports entry not prefetched

- GIVEN a signed-in `coordinacion` user
- WHEN the sidebar and the home render
- THEN the Reports link and its home shortcut are rendered with prefetch disabled

#### Scenario: Reports routes and active marker

- GIVEN a `coordinacion` user on `/reports`, and separately on `/reports/requests`
- WHEN the sidebar and the top bar render
- THEN Reports is the active entry in both cases
- AND the trail shows Reports as text with `aria-current` on `/reports`, and as a link to it without `aria-current` on `/reports/requests`

### Requirement: BS-HOME-1 Role-aware dashboard home

The dashboard home MUST show a shortcut card for every menu destination the
viewer's role can see, derived from the same navigation configuration and
predicates as the sidebar, in the sidebar's order (My requests, New request,
Enrollment, Review requests, Escalated requests, Reports, Asignaturas,
Docentes, Inscripciones, Import, Users);
the Dashboard entry and the Settings entry are not offered as shortcuts (the
settings route does not exist; D7 freezes the sidebar entry, not a second dead
link). User-count cards (total and active users) MUST show only to roles that
may open `/users`, and MUST use the existing stats read without a new data
query (D9); that read MUST NOT be performed for a role that does not show the
cards. No shortcut MUST lead to a destination the role cannot open. A role with no shortcut and no counts MUST see the page header and
a short localized message instead of an empty area.
(Previously: the order and the secretaria row had no Inscripciones card.)

#### Scenario: Home per role (table-driven)

| Role | Shortcut cards | User-count cards |
|---|---|---|
| `estudiante` | My requests, New request, Enrollment | no |
| `docente` | none (message shown) | no |
| `administrador` | Asignaturas, Docentes, Users | yes |
| `coordinacion` | Escalated requests, Reports, Asignaturas, Docentes, Users | yes |
| `secretaria` | Review requests, Asignaturas, Docentes, Inscripciones, Import, Users | yes |

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

#### Scenario: Reports shortcut only for coordination

- GIVEN any role other than `coordinacion`
- WHEN the home renders
- THEN no Reports card and no link to `/reports` is shown

## ADDED Requirements

### Requirement: BS-NAV-4 Inscripciones destination for the secretaría (RF-12 a, RNF-01 b)

The navigation configuration MUST contain one Inscripciones entry targeting
`/catalog/inscripciones`, in the Administration group, visible only through
`canManageEnrollments`. Its sidebar entry, its dashboard shortcut and its
top-bar trail MUST come from that one entry (BS-CTX-1, BS-HOME-1), with a label
in both `es` and `en` that differs from the student's Enrollment label. No role
other than `secretaria` MUST see it.

#### Scenario: Entry, active marker and trail

- GIVEN a signed-in `secretaria` on `/catalog/inscripciones`
- WHEN the sidebar and the top bar render in `es` and in `en`
- THEN the Inscripciones entry is active with `aria-current`, the trail shows Administration / Inscripciones as text with `aria-current`, and the page has exactly one `h1`

#### Scenario: Hidden from other roles (table-driven)

| Role |
|---|
| `estudiante` |
| `docente` |
| `coordinacion` |
| `administrador` |

- GIVEN a signed-in user with the role from the row
- WHEN the sidebar and the home render
- THEN no Inscripciones entry and no Inscripciones shortcut is shown

#### Scenario: Asignaturas stays the entry of its own paths

- GIVEN a `secretaria` on `/catalog/asignaturas`
- WHEN the sidebar renders
- THEN Asignaturas is active and Inscripciones is not
