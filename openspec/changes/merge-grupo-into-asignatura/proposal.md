# Proposal: Manage Grupos from inside their Asignatura (UI only)

> **This change does NOT touch the database schema.** No migration, no edit to
> `src/db/schema.ts`, no command against Neon. `Grupo` stays a table.
>
> **This version replaces the destructive proposal** (migration `0007` folding
> `Grupo` into `Asignatura`). That plan is abandoned and nothing of it was
> applied. See "What is reversed".

## Intent

Secretaría sees two catalogs, Asignaturas and Grupos, although a group has no
meaning without its subject. The owner wants Grupos to stop being a catalog of
its own in the UI: groups are reached, created and edited only from their
Asignatura. The data model, the import and the justification intake keep
working on `Grupo` exactly as today.

Covers `docs/requirements.md`: **RF-12** (catalog maintenance), **RNF-01**
(server-side authorization on the new routes and the retired URLs), **RNF-06**
(audit, unaffected), **RNF-12** (deactivation confirmation, kept), **RNF-13**
(import, untouched). All five verified against the file.

Roadmap: this change has no row in `docs/roadmap.md`. It refines
`catalog-management`, which the roadmap notes name as covering RF-12 and
RNF-13 and which is archived (`2026-10-10-catalog-management`).

## What is reversed

Why: `justification-intake` (merged in main) depends on `Grupo` as a table
(`SolicitudAsignatura.GrupoId`, `Inscripcion.GrupoId`,
`GroupScheduleProvider.groupsWithClass`), and migration number `0007` is taken
by `0007_justification_intake`.

| Earlier item (2026-10-09) | Status now |
|---|---|
| D1: `Grupo` table and `/catalog/grupos` pages removed | Half kept: the list and sidebar entry go; the table stays; create and edit move under the Asignatura |
| D2 to D9: class row, group-number key, optional docente, docente rule, days on the class row, `Periodo` removed, subject-field propagation | Void |
| A11: old `/catalog/grupos` URLs answer "not found" | Reversed: they redirect |
| A1 to A10, A12, work units WU1 to WU8, schema impact, Neon rollback | Void |
| Dependency "archive `catalog-management` first" | Already satisfied |

## Decisions

**Binding (owner, 2026-10-10)**

| # | Decision |
|---|---|
| B1 | `Grupo` stays a table. No schema change, no migration |
| B2 | Nothing under `src/lib/intake`, `src/lib/data/solicitudes.ts` or `src/app/(dashboard)/requests/` is modified |
| B3 | The "Grupos" sidebar entry and the `/catalog/grupos` list page are removed |
| B4 | Groups are created and edited at `/catalog/asignaturas/[id]/grupos/new` and `/catalog/asignaturas/[id]/grupos/[grupoId]/edit`, reusing the existing form, validations and `src/lib/data/grupos.ts` writes |
| B5 | Old `/catalog/grupos/...` URLs redirect to the matching Asignatura location |
| B6 | The Asignaturas list search covers what the Grupos list search covered, so finding a group by docente or by periodo is not lost |
| B7 | The group match uses `Periodo` and docente name only. `NumeroGrupo` is excluded, so CM-ASG-8's rule that the Asignaturas search does not match group numbers stands (owner, 2026-10-10) |

**Assumed, not confirmed by the owner**

| # | Assumption | If wrong |
|---|---|---|
| U1 | `actions.ts`, `grupo-form.tsx` and `bound-controls.tsx` stay in `catalog/grupos/`; only pages move (exploration approach A1) | About 2,000 more moved test lines and three structural tests to update |
| U2 | `Periodo` stays a visible form field (part of the unique key) | Needs a "current period" rule that does not exist |
| U3 | The Excel import, its sheets and its screen are untouched | Import copy changes too |
| U4 | Redirects are temporary (307) | Permanent ones are cached by browsers indefinitely |
| U5 | In create mode the Asignatura comes from the route and is shown read-only | Combobox kept |
| U6 | After saving a group the user returns to the Asignatura edit page | Another landing page |
| U7 | Dropped with the list: group status filter across asignaturas, pagination past 100 groups, "New group" with no Asignatura chosen. The "latest 100" note stays; its link to the list is removed | These must be rebuilt inside the Asignatura page |
| U8 | Confirmed by the owner on 2026-10-10; now B7 | n/a |
| U9 | Groups of any status can produce a match; an inactive one is labelled as such | Only active groups match |
| U10 | A row matched through groups shows up to three matching groups and a "+N more" count | Another presentation |
| U11 | Not found: a new-group URL of an inactive or out-of-scope Asignatura, and an edit URL whose Asignatura is not the group's parent | Another answer for those URLs |
| U12 | `/catalog/grupos/new` without a valid `asignaturaId` redirects to the Asignaturas list | Another target |

## Search behaviour (B6)

Today (`buildGruposWhere`): `q` is a partial, case-insensitive match on
asignatura `Codigo` and `Nombre`, `Periodo`, `NumeroGrupo` and docente name,
returning one row per group. The Asignaturas list
(`buildAsignaturasWhere`) matches `Codigo` and `Nombre` only.

Intended behaviour:

- **What the user types**: a term in the existing Asignaturas search box,
  whose label and placeholder now name docente and periodo. Example:
  `2026-S1` or part of a teacher's name.
- **What comes back**: the in-scope Asignaturas that pass the Asignatura
  status filter and either match by `Codigo` or `Nombre`, or have at least one
  group whose `Periodo` or docente name contains the term. One row per
  Asignatura; the count and the pagination count Asignaturas.
- **How a group match is visible**: the row names the groups that matched
  (periodo, group number, docente), so the user sees why it was returned. The
  Edit link opens the Asignatura, whose Grupos section lists them.
- **Unchanged**: scope predicate, ordering, page size, fail-soft behaviour,
  parameter binding of the term.

`listGrupos` and `buildGruposWhere` are **not** reused: they build a
group-rooted, group-status query. The new condition lives in
`buildAsignaturasWhere`. Both become unused (Open Question 4).

## Scope

### In Scope

- Create and edit pages under the Asignatura (B4), with the parent check on
  the edit page.
- Form create mode with a fixed Asignatura; actions redirect to and revalidate
  the Asignatura edit page and the Asignaturas list.
- Grupos section links repointed; cap-overflow link removed.
- Redirects for the four old URL shapes (B5).
- Removal of the Grupos list page, the sidebar entry and their copy (B3).
- Asignaturas list search extended (B6).
- `es` and `en` copy with identical key sets; structural, guard and parity
  tests updated.

### Out of Scope (non-goals)

- **Teammate boundary**: the paths in B2, plus `src/db/**` and `drizzle/**`.
- The import, the workbook and `src/lib/import/**`.
- Group validation rules, audit events, carrera scoping and write functions.
- Renaming `middleware.ts` to `proxy.ts`.
- Rebuilding the capabilities listed in U7.
- Designing the delivery slices (tasks phase).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `catalog-management`: CM-NAV-1 (two destinations), CM-LST-1 (Grupos list
  removed; Asignaturas search fields), CM-ASG-7 (section links, cap clause),
  CM-ASG-8 (its "search MUST NOT match on group numbers" clause and the
  "Grupos list unchanged" sentence), CM-GRP-7 (removed), CM-GRP-8 (replaced by
  the route parameter), CM-GRP-1 to CM-GRP-4, CM-SCOPE-1, CM-SCOPE-2, CM-ACC-1,
  CM-UX-1 and CM-I18N-1 (page wording), plus one new requirement for the
  retired-URL redirects.

`academic-catalog`, `audit-log` and `catalog-excel-import` are not modified.

## Approach

Exploration approach A1: add the sub-routes, repoint the section, add the
redirects, then retire the list.

| Old URL | Goes to | How |
|---|---|---|
| `/catalog/grupos` | `/catalog/asignaturas`, query carried | `next.config.ts` `redirects()` |
| `/catalog/grupos/new?asignaturaId=N` | `/catalog/asignaturas/N/grupos/new` | `redirects()` with a query rule |
| `/catalog/grupos/new` | `/catalog/asignaturas` | `redirects()` |
| `/catalog/grupos/{id}/edit` | `/catalog/asignaturas/{asignaturaId}/grupos/{id}/edit` | A guarded page at the old path: one scoped read, then redirect |

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/(dashboard)/catalog/asignaturas/[id]/grupos/new/page.tsx` | New | Create page |
| `src/app/(dashboard)/catalog/asignaturas/[id]/grupos/[grupoId]/edit/page.tsx` | New | Edit page with parent check |
| `src/app/(dashboard)/catalog/grupos/page.tsx`, `new/page.tsx` | Removed | List and old create page |
| `src/app/(dashboard)/catalog/grupos/[id]/edit/page.tsx` | Modified | Becomes the redirect page |
| `src/app/(dashboard)/catalog/grupos/actions.ts`, `grupo-form.tsx` | Modified | Redirect and revalidate targets; fixed Asignatura |
| `src/app/(dashboard)/catalog/asignaturas/asignatura-grupos-section.tsx`, `[id]/edit/page.tsx` | Modified | Links and labels |
| `src/app/(dashboard)/catalog/asignaturas/page.tsx` | Modified | Search copy, matched-groups hint |
| `src/lib/data/asignaturas.ts`, `src/lib/catalog/types.ts` | Modified | `buildAsignaturasWhere`, `listAsignaturas`, list item |
| `src/lib/catalog/list-params.ts` | Modified | `/catalog/grupos` leaves `CatalogListBase` |
| `src/components/app-sidebar.tsx` | Modified | Grupos entry removed |
| `next.config.ts` | Modified | `redirects()` |
| `i18n/es.json`, `i18n/en.json` | Modified | List keys removed, breadcrumb and search copy |
| Colocated tests, `catalog/guards.test.ts`, `catalog/current-marker-usage.test.ts`, `src/i18n/catalog-parity.test.ts`, `src/lib/data/scope-inventory.test.ts` | Modified | Pins follow the new paths |
| `src/lib/data/grupos.ts` | Unchanged | Writes reused; `listGrupos` left in place |

## Size

Estimated, not measured. The exploration counts about 2,300 changed lines
before B6. B6 adds about 450 (query and tests, list item, page and test, copy,
parity). **Revised total: about 2,700 to 2,800 counted lines, against an
800-line single-PR budget. It does not fit one 800-line PR.** The owner
decides at the tasks phase between chained slices and a size exception.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Size is over three times the budget | Certain | Owner decision at the tasks phase |
| A literal reading of B6 would contradict CM-ASG-8 on group numbers | Resolved | B7: group numbers stay out of the match |
| A group shown under the wrong Asignatura URL | Med | Mandatory parent check (U11), tested |
| A scope or guard check lost when pages move | Med, high impact | Guard-first rule and structural pins extended to the new pages |
| Search by a common term returns many rows | Med | Hint shows why each row matched |
| The group condition slows the list query | Low | Small catalog; reviewed in design |
| Carried `status` on the `/catalog/grupos` redirect now filters Asignaturas, not groups | Low | Design decides whether to drop it |
| Structural pins silently stop covering new files | Med | Pins list the new paths explicitly, CRLF normalised |
| `redirects()` query capture and its order against `middleware.ts` | Unverified (read from docs, not run) | Test in design and apply |

## Rollback Plan

UI and query only: revert the pull request (or the slices, newest first). No
data to restore; groups written through the new pages are ordinary `Grupo`
rows. After a revert the old `/catalog/grupos/...` URLs work again at once,
because the redirects are temporary. Bookmarks to the new
`/catalog/asignaturas/{id}/grupos/...` URLs answer "not found" until the
change is re-applied.

## Dependencies

- Owner answer to Open Question 2 before the spec phase closes (Open Question
  1 is answered, see B7).
- The delivery decision at the tasks phase.
- A `docs/design-system.md` check for the read-only Asignatura field and the
  matched-groups hint.

## Cleanup of void artifacts

Later phases replace or remove these files of this change folder; this
proposal does not touch them:

- `specs/academic-catalog/`, `specs/audit-log/`, `specs/catalog-excel-import/`:
  removed (no delta).
- `specs/catalog-management/spec.md`: rewritten from scratch.
- `design.md`, `tasks.md`: rewritten.
- `runbook-0007.md`: not present in the folder; nothing to remove.

## Open Questions

1. **Group number in the search.** Answered by the owner on 2026-10-10: match
   `Periodo` and docente name only (B7). CM-ASG-8's rule on group numbers
   stands.
2. **Inactive groups in the match (U9).** Recommendation: any status, labelled,
   because no group status filter remains anywhere.
3. **Matched-groups hint (U10).** Recommendation: up to three groups plus a
   count.
4. **Unused `listGrupos` and `buildGruposWhere`.** Recommendation: remove them
   with their tests and inventory entries in the last slice; keep them if the
   owner expects a group list to return.
5. **Dropped capabilities (U7).** Recommendation: accept the loss.
6. **`/catalog/grupos/new` without an Asignatura (U12).** Recommendation: the
   Asignaturas list.
7. **Do U1 to U6 stand?** Recommendation: yes to all.

## Success Criteria

- [ ] The diff touches no file under `src/lib/intake`,
      `src/lib/data/solicitudes.ts`, `src/app/(dashboard)/requests/`,
      `src/db/` or `drizzle/`, and the intake test suites pass unchanged.
- [ ] The sidebar shows no Grupos entry for any role; Asignaturas is marked
      current on the new group pages.
- [ ] A group can be created and edited from its Asignatura, and saving
      returns to that Asignatura's edit page with the row visible.
- [ ] Each of the four old URL shapes redirects as in the table, behind the
      same access rules.
- [ ] An edit URL naming the wrong Asignatura answers "not found".
- [ ] Searching the Asignaturas list by a docente name or a periodo returns
      the Asignaturas holding those groups, and each such row names the
      matching groups.
- [ ] Group writes still produce the same audit rows; deactivation still asks
      for confirmation.
- [ ] `es` and `en` have identical key sets.
- [ ] `npm test`, `npm run typecheck`, `npx eslint src` and `npm run build`
      pass.
