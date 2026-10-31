# Delta for Backoffice Shell

Covers RF-17 and RF-13 (entry points only), RNF-01 (b). The reports themselves
live in `coordination-reports`. Slice: **[S1]**. The Reports entry points at
`/reports` only; `/reports/requests` is reached from that page, so slice 2 adds
no navigation edit.

## MODIFIED Requirements

### Requirement: BS-NAV-1 Sidebar entries are unchanged

The sidebar body MUST show the same entries, in the same order, with the same
group and the same visibility predicates as before the backoffice refresh, and
the same active marker (the 4px bar paired with `aria-current`), with two
additions: the Enrollment entry for `estudiante` (BS-NAV-3) and the Reports
entry for `coordinacion` (RF-17, RNF-01 b), a top-level entry placed after
Review requests and before the Administration group, visible through the
`canViewReports` predicate. The Reports link MUST NOT be prefetched, because its
page is audited on render. The `/settings`
entry MUST stay exactly as it is (D7), including its target. The
"Administration" group MUST still render only when at least one child is
visible.
(Previously: one addition, the Enrollment entry; `coordinacion` saw no Reports entry.)

#### Scenario: Entries per role (table-driven)

| Role | Entries shown |
|---|---|
| `estudiante` | Dashboard, My requests, New request, Enrollment, Settings |
| `docente` | Dashboard, Settings |
| `administrador` | Dashboard, Administration (Asignaturas, Docentes, Users), Settings |
| `coordinacion` | Dashboard, Reports, Administration (Asignaturas, Docentes, Users), Settings |
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
Enrollment, Review requests, Reports, Asignaturas, Docentes, Import, Users);
the Dashboard entry and the Settings entry are not offered as shortcuts (the
settings route does not exist; D7 freezes the sidebar entry, not a second dead
link). User-count cards (total and active users) MUST show only to roles that
may open `/users`, and MUST use the existing stats read without a new data
query (D9); that read MUST NOT be performed for a role that does not show the
cards. No shortcut MUST lead to a destination the role cannot open. A role with no shortcut and no counts MUST see the page header and
a short localized message instead of an empty area.
(Previously: the shortcut order had no Reports; `coordinacion` had Asignaturas, Docentes, Users.)

#### Scenario: Home per role (table-driven)

| Role | Shortcut cards | User-count cards |
|---|---|---|
| `estudiante` | My requests, New request, Enrollment | no |
| `docente` | none (message shown) | no |
| `administrador` | Asignaturas, Docentes, Users | yes |
| `coordinacion` | Reports, Asignaturas, Docentes, Users | yes |
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

#### Scenario: Reports shortcut only for coordination

- GIVEN any role other than `coordinacion`
- WHEN the home renders
- THEN no Reports card and no link to `/reports` is shown

### Requirement: BS-I18N-1 Shell copy in both locales

Every user-visible string of the shell and the home (trail labels, identity
role labels, skeleton label, error text, shared states, shortcut cards, home
message, and the Reports entry label and shortcut text) MUST come from the i18n
catalogs and exist in both `es` and `en`, with identical key sets
(`openspec/config.yaml`).
(Previously: the Reports entry label and shortcut text were not listed.)

#### Scenario: Key parity

- GIVEN the `es` and `en` catalogs
- WHEN their key sets are compared
- THEN they are identical and every new value is non-empty
- AND the Reports navigation and shortcut keys exist in both
