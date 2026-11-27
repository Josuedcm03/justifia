# Delta for Backoffice Shell

Change `normative-parameters`. Requirements covered: RNF-01 (b), RNF-14. Thesis: CU-13,
Annex D Table D19. The sidebar gains one entry for the `secretaria`, the screen of
`normative-parameters`.

## Notes for archive

- Purpose and "Role vocabulary": add the predicate `canManageParameters` to the
  list of predicates the entries use ("Entry visibility uses the same predicates as
  the sidebar"). The predicate lives in `src/lib/auth/permissions.ts` and is true for
  `secretaria` only (`normative-parameters` NP-6).
- Every other requirement is unchanged. The home (BS-HOME-1) gains no shortcut.
- The entry is not audited on render, so it MAY be prefetched like the other
  Administration entries.

## MODIFIED Requirements

### Requirement: BS-NAV-1 Sidebar entries are unchanged

Traceability: RNF-01 (b), RNF-14, CU-13. The sidebar body MUST show the same
entries, in the same order, with the same
group and the same visibility predicates as before the backoffice refresh, and
the same active marker (the 4px bar paired with `aria-current`), with five
additions: the Enrollment entry for `estudiante` (BS-NAV-3); the Escalated
requests entry for `coordinacion`, a top-level entry placed after Review
requests, visible through the `canCoordinate` predicate and not prefetched
because its pages are audited on render (added by the `escalation` change); the
Reports entry for `coordinacion` (RF-17, RNF-01 b), a top-level entry placed
after Escalated requests and before the Administration group, visible through
the `canViewReports` predicate and not prefetched, because its page is audited
on render; the Inscripciones entry for `secretaria` (BS-NAV-4), inside the
Administration group, after Docentes and before Import, visible through the
`canManageEnrollments` predicate; and the Normative parameters entry for
`secretaria` (RNF-14, CU-13), inside the Administration group, after Users (the
last child), visible through the `canManageParameters` predicate, with the label
"Parámetros normativos" (`es`) and "Normative parameters" (`en`), linking to
`/parameters`. The `/settings` entry MUST stay exactly as it
is (D7), including its target. The "Administration" group MUST still render only
when at least one child is visible.
(Previously: four additions, without the Normative parameters entry.)

#### Scenario: Entries per role (table-driven)

| Role | Entries shown |
|---|---|
| `estudiante` | Dashboard, My requests, New request, Enrollment, Settings |
| `docente` | Dashboard, Settings |
| `administrador` | Dashboard, Administration (Asignaturas, Docentes, Users), Settings |
| `coordinacion` | Dashboard, Escalated requests, Reports, Administration (Asignaturas, Docentes, Users), Settings |
| `secretaria` | Dashboard, Review requests, Administration (Asignaturas, Docentes, Inscripciones, Import, Users, Normative parameters), Settings |

- GIVEN a signed-in user with the role from the row
- WHEN the sidebar renders
- THEN exactly the entries in the row are shown, in that order
- AND no Grupos destination is offered (CM-NAV-1)

#### Scenario: Normative parameters entry only for the secretaria

- GIVEN signed-in users of each of the five roles
- WHEN the sidebar renders for each
- THEN only the `secretaria` sees the Normative parameters entry, and its link target is `/parameters`

#### Scenario: Entry label per locale

- GIVEN a `secretaria` in `es` and then in `en`
- WHEN the sidebar renders
- THEN the entry reads "Parámetros normativos" and then "Normative parameters"

#### Scenario: Active marker on the parameters page

- GIVEN a `secretaria` on `/parameters`
- WHEN the sidebar renders
- THEN only the Normative parameters entry is active and carries `aria-current`

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
