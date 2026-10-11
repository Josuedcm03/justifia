# Exploration: Unify Grupos into the Asignatura UI (option A)

> Supersedes the exploration of the destructive approach (migration `0007`
> folding `Grupo` into `Asignatura`). That approach is abandoned: nothing of it
> was applied, `justification-intake` depends on `Grupo` as a table, and the
> number `0007` is taken by `0007_justification_intake`.
>
> Scope of option A: UI and routing only. No schema change, no migration, and
> no edit under `src/lib/intake`, `src/lib/data/solicitudes.ts` or
> `src/app/(dashboard)/requests/`.

## 1. Current state

- `Grupo` is a real table and stays untouched.
- **Standalone catalog** at `src/app/(dashboard)/catalog/grupos/`:
  - `page.tsx` (list), `new/page.tsx`, `[id]/edit/page.tsx`.
  - `actions.ts`, `bound-controls.tsx`, `grupo-form.tsx`.
  - A colocated test beside each file.
- **Asignatura edit page** (`catalog/asignaturas/[id]/edit/page.tsx`) already
  renders `AsignaturaGruposSection`:
  - Rows are read with `listGruposByAsignatura`, fail-soft, capped at 100
    (`ASIGNATURA_GRUPOS_MAX`).
  - It links to `/catalog/grupos/new?asignaturaId=N`, to
    `/catalog/grupos/{id}/edit`, and, past the cap, to
    `/catalog/grupos?status=all&q={codigo}`.
- **Intake independence (verified)**, none of these touch the catalog routes:
  - `src/lib/intake/**` never imports `catalog/grupos/**`,
    `lib/data/grupos.ts` or `lib/data/asignaturas.ts`. It reads group days
    through its own `src/lib/data/grupo-dias.ts` (`listGrupoDias`).
  - `src/lib/data/solicitudes.ts` imports only `db`, `lib/audit`,
    `lib/data/audit` and `lib/intake/*`.
  - `src/app/(dashboard)/requests/**` imports only
    `catalog/import/file-dropzone` (`formatFileSize`) and
    `lib/data/enrollment`.
- **Redirect machinery today:**
  - `middleware.ts` handles auth only (`/login` and `/register` for signed-in
    users, and the `/login?next=` bounce). It is the deprecated Next 16 name
    for `proxy.ts` but still works; this change does not rename it.
  - `next.config.ts` has no `redirects()`.
  - `redirect()` is used only in actions and a few pages.

## 2. Blast radius

### Must change

| File | Change |
|---|---|
| `src/components/app-sidebar.tsx:84-90` | Drop the `catalogGrupos` item. Drop the `UsersRound` import (line 14) if nothing else uses it. |
| `src/components/app-sidebar.test.tsx` | Edit the lines listed below. |
| `src/lib/catalog/list-params.ts:47-48` | Remove `"/catalog/grupos"` from `CatalogListBase`. |
| `src/lib/catalog/list-params.test.ts:90-91` | The `catalogListHref("/catalog/grupos", …)` case becomes invalid. |
| `catalog/asignaturas/asignatura-grupos-section.tsx` | Repoint `addHref` (l.64) and the edit link (l.109). Remove or replace the `viewAll` link (l.158-170). |
| `catalog/asignaturas/[id]/edit/page.tsx:98-165` | Section labels; the `viewAll` label goes if the link goes. |
| `catalog/asignaturas/[id]/edit/page.test.tsx` | Edit lines 637-639, 700, 718, 768, 821, 839-848. Delete the `viewAll` block 821-842. About 80 lines touched. |
| `catalog/grupos/actions.ts` | `LIST_PATH` (l.41), `redirect(LIST_PATH)` (l.131, 196), `revalidatePath` / `revalidateRecord`. See section 4. |
| `catalog/grupos/actions.test.ts` | Lines 329, 598-602 and 813 assert `"/catalog/grupos"` as the revalidate path and redirect target. |
| `catalog/grupos/grupo-form.tsx` | Create mode needs a fixed Asignatura. See section 4. |
| `catalog/grupos/grupo-form.test.tsx` | Combobox and `defaultAsignaturaId` cases rewritten. |
| `catalog/grupos/new/page.tsx` | Move to `asignaturas/[id]/grupos/new/page.tsx` and rewrite. |
| `catalog/grupos/[id]/edit/page.tsx` | Move to `asignaturas/[id]/grupos/[grupoId]/edit/page.tsx`. The old path becomes a small redirect page. |
| `catalog/grupos/new/page.test.tsx`, `[id]/edit/page.test.tsx` | Move and adapt, then add redirect-page tests. |
| `catalog/guards.test.ts` | `SEGMENTS` (l.12) and `ACTION_SEGMENTS` (l.80); the "covers every expected actions module" pin (l.115-120). |
| `catalog/current-marker-usage.test.ts:63-68, 106-113` | `BREADCRUMB_PAGES` and the form pin. The marker is allowed only in listed pages, so the new sub-route pages must be listed. |
| `src/lib/data/catalog-structure.test.ts:19-23` | `ACTION_DIRS`, only if actions move. |
| `catalog/audit-leak.test.ts:91` | Import path of the group actions, only if they move. |
| `src/i18n/catalog-parity.test.ts` | See the list below. |
| `i18n/es.json`, `i18n/en.json` | See the key plan below. |
| `next.config.ts` | Add `redirects()`. |

Sidebar test lines to edit: 137, 146, 155, 207, 218, 229, 356-358, 385, 394,
399, 417, 428, 439-444, 487. Cases at 356-358 and 399 expect Grupos active on
`/catalog/grupos/**` and Asignaturas active on `/catalog/grupos/3/edit`. After
the change, `/catalog/asignaturas/3/grupos/5/edit` should mark Asignaturas,
because `isCurrent` is prefix based.

Parity test pieces to edit:

- `GUARDED_SECTIONS` (l.29-31): remove `catalog.grupos.errors`,
  `nav.catalogGrupos` and `catalog.grupos`, or reduce them to the sections
  that remain.
- Describe at l.604: Grupos section copy.
- Describe at l.722: Grupo action copy. It reads `grupos/actions.ts`, so it
  only changes if the file moves.
- Describe at l.1002: Grupo list, form, page and state copy.
- Describe at l.1200: Grupo page and form copy. It reads
  `DIR = catalog/grupos` and lists files (l.1205, 1240-1251).
- Describe at l.923: day names. Keep it.

### Can stay as is

- `src/lib/data/grupos.ts`: `getGrupoById`, `createGrupo`, `updateGrupo`,
  `setGrupoActivo`, `listGruposByAsignatura`, `getAsignaturaById`,
  `listDocenteOptions`, the scope SQL helpers.
- `grupos.test.ts`, `catalog-scope-sql*`, `src/lib/audit/events.ts`
  (`grupoWriteEvents`), `src/lib/validations/catalog*.ts`,
  `src/lib/catalog/{dias,types,scope,action-helpers}.ts`.
- `catalog/dias-cell.tsx`, `active-toggle.tsx`, `not-found.tsx` (generic, no
  Grupos text).
- Import screen, workbook contract, `src/lib/import/**`, `src/db/**`.
- `middleware.ts`.
- The asignaturas list page (its "Grupos" column is data, not a route).
- `CATALOG_OPTIONS_MAX` and `ASIGNATURA_GRUPOS_MAX` in
  `src/lib/catalog/list-params.ts`.

### Delete

- `catalog/grupos/page.tsx` (248 lines) and `catalog/grupos/page.test.tsx`
  (625 lines): the list.
- `nav.catalogGrupos` in both locales.
- `bound-controls.tsx` and `grupo-form.tsx` stay if actions and the form stay
  in place (recommended, see section 11).
- Dead after the change: `listGrupos` and `buildGruposWhere` in `grupos.ts`
  and their tests. They are used only by the deleted list page.
  `src/lib/data/scope-inventory.test.ts:61-72` pins them, so removing them
  means editing that inventory. Default: keep them (open point 5).

### i18n key plan (`catalog.grupos.*`, es and en)

- **Remove (list only):** `list.title`, `list.subtitle`, `list.newButton`,
  `list.empty`, `list.noResults.*`, `list.search.*`, `list.count`,
  `list.tableCaption`, `list.pagination.*`, `list.degraded`,
  `list.columns.code`, `list.columns.subject`, and `nav.catalogGrupos`.
- **Keep, because the section uses them:**
  `list.columns.{periodo,numeroGrupo,docente,dias,status,actions}` and
  `list.edit`. Alternatively move them under `catalog.asignaturas.grupos.*`.
  Either choice must keep the es and en key sets identical (CM-I18N-1).
- **Keep:** `errors.*`, `form.*`, `page.*`, `state.*`.
- **Change:** `breadcrumb.*`. `page.newSubtitle` says "agregar un grupo al
  catálogo", which becomes inaccurate. `list.title` is currently the
  breadcrumb root link in both pages. The breadcrumb should become
  Asignaturas → {codigo} → New group, or Edit group.
- **Remove:** `catalog.asignaturas.grupos.viewAll`, if the link is dropped.
- `form.naturalKeyHint` and `form.asignaturaLabel` remain valid.

## 3. What the standalone list has that the section lacks

| Capability | Standalone `/catalog/grupos` | Section on Asignatura edit |
|---|---|---|
| Cross-asignatura view | Yes | No, one Asignatura only |
| Search `q` | Asignatura code and name, Periodo, NumeroGrupo, docente name (`buildGruposWhere`) | None |
| Status filter | `active` (default), `inactive`, `all` via `StatusFilter` | None; shows active and inactive together, with a status pill |
| Pagination and total count | Yes, `CATALOG_PAGE_SIZE`, `aria-live` count | None; cap of 100 plus a "latest 100" note |
| Columns | Code, Subject, Periodo, Grupo, Docente, Días, Estado, Edit | Periodo, Grupo, Docente, Días, Estado, Edit |
| Order | code asc, periodo desc, numero asc, id asc | periodo desc, numero asc, id asc |
| Empty versus "no results" states | Both, with a "New group" CTA when unfiltered | Empty state with "Add group" while the Asignatura is active; inactive hint |
| Degraded (fail-soft) state | Notice replaces the filters and table | Notice inside the section |
| Scope `none` (coordinacion without Carrera) | Dedicated no-Carrera state | Handled by the page above the section |
| Carrera scoping | `asignaturaInScope` | Same predicate |
| "New group" without a chosen Asignatura | Yes, via Combobox of Asignaturas | No |
| Active toggle | On the edit page, not the list | On the edit page, not the section |

Lost if nothing is carried over:

1. The docente-centric and periodo-centric lookup ("which groups does teacher
   X have", "all groups of 2026-S1"). The Asignaturas list search covers only
   code and name.
2. The cross-asignatura inactive view.
3. Pagination. The cap of 100 is reached only by a very old Asignatura.
4. A "New group" entry that does not start from an Asignatura.

Two links break: the cap-overflow link
`/catalog/grupos?status=all&q={codigo}` no longer has a target, and the create
CTA with no Asignatura no longer exists.

## 4. How create and edit work today and what changes

### Guards and flow today

- **Pages:**
  - `await requireCatalogAccess()` is the first await (enforced by
    `guards.test.ts`).
  - Scope `none` renders a no-Carrera state with no query.
  - `new` loads `listAsignaturaOptions(scope)` and `listDocenteOptions()`.
  - `edit` loads `getGrupoById(scope, id)`; `notFound()` for a malformed,
    missing or foreign id.
  - `CreateGrupoForm`, `EditGrupoForm` and `GrupoActiveToggle` are client
    components in `bound-controls.tsx`, so pages never import actions. A test
    forbids that.
- **Actions:**
  - Each action awaits `requireCatalogAccess()` before reading `formData`
    (test-enforced) and takes `actorId` and `scope` only from that guard.
  - Create: `grupoCreateSchema` → lock-free `getAsignaturaById(scope, id)`
    pre-check, which must be active →
    `withCatalogWrite(createGrupo, grupoWriteEvents)` →
    `revalidatePath(LIST_PATH)` → `redirect(LIST_PATH)`.
  - Update: `addressed(…getGrupoById)` → `grupoUpdateSchema` (docente and days
    only; any other field is stripped) → write → `revalidateRecord` →
    redirect.
  - Toggle: a closed `intent` of `deactivate` or `reactivate` →
    `setGrupoActivo` → `revalidateRecord`, no redirect. A refused
    reactivation names the inactive parent.
  - Audit rows are written by `withCatalogWrite` through `grupoWriteEvents`.
    Nothing there references routes.
- **`asignaturaId` preselection (CM-GRP-8):** `new/page.tsx` accepts
  `?asignaturaId=` as a convenience only. It is used only if it matches an
  option the form offers; otherwise it is silently ignored.

### What must change under `/catalog/asignaturas/[id]/grupos/...`

**Route shape.** Recommended: `asignaturas/[id]/grupos/new/page.tsx` and
`asignaturas/[id]/grupos/[grupoId]/edit/page.tsx`. The existing
`asignaturas/[id]/edit` already uses the slug `[id]`, so the sibling segment
reuses the same name. No conflict with `/catalog/asignaturas/new`.

**New page.** Replace the options lookup with
`getAsignaturaById(scope, parseRecordId(id))`. Not found → `notFound()`. An
in-scope but inactive Asignatura should also give `notFound()`: it is the same
"unavailable" answer as the action's `asignaturaUnavailable`, and the link is
hidden for inactive Asignaturas anyway. This replaces the silent-ignore rule
of CM-GRP-8 with a route parameter; the spec phase must restate it.

**Edit page.** Load `getGrupoById(scope, grupoId)`, then verify
`record.asignaturaId === asignaturaId` from the URL. A mismatch is
`notFound()`. Without this check any group could be shown under any parent
URL. The breadcrumb names the Asignatura.

**Form.** Create mode today draws an Asignatura Combobox. Under a sub-route it
should show the Asignatura as a `FixedField` plus
`<input type="hidden" name="asignaturaId">`. The schema, the pre-check and the
`asignaturaId.invalid` field error stay unchanged, so tampering still fails
the same way. That removes the props `asignaturas`, `asignaturasTruncated` and
`defaultAsignaturaId` for the create case. Lowest-churn alternative: keep the
Combobox with a single option and `defaultAsignaturaId`; no form change, but
poor UX.

**Actions.** `LIST_PATH` becomes dynamic. The Asignatura id is available
server-side without trusting the form:

- create: `parsed.data.asignaturaId`;
- update and toggle: `target.item.asignaturaId` (`GrupoListItem` has it).

After a successful create or update,
`redirect(/catalog/asignaturas/${asignaturaId}/edit)`, so the user lands on
the Grupos section with the row visible. Revalidate
`/catalog/asignaturas/${asignaturaId}/edit` and `/catalog/asignaturas`. The
current code revalidates only the Grupos list, never the Asignaturas list,
although that list's "Grupos" column shows the active groups. `redirect()`
must stay outside `try`: Next 16 docs confirm it throws, and that in a Server
Action it navigates client-side when JS is available.

**Toggle.** Unchanged; it stays on the edit page. Its confirmation dialog
keeps RNF-12 satisfied.

## 5. Redirect design for old URLs

| Old URL | Target | Mechanism | Data needed |
|---|---|---|---|
| `/catalog/grupos` (any query) | `/catalog/asignaturas` | `next.config.ts` `redirects()` | None. Query values are passed through, so `?q=MAT101&status=all` still means something on the Asignaturas list. `page` also carries; the list clamps it. |
| `/catalog/grupos/new?asignaturaId=N` (N numeric) | `/catalog/asignaturas/N/grupos/new` | `redirects()` with a `has` query rule capturing `(?<asignaturaId>\d+)` | None |
| `/catalog/grupos/new` (no or invalid id) | `/catalog/asignaturas` | `redirects()`, placed after the rule above | None. The user must now pick an Asignatura first. |
| `/catalog/grupos/{id}/edit` | `/catalog/asignaturas/{asignaturaId}/grupos/{id}/edit` | A thin Server Component page at the old path | One scoped read: `getGrupoById(scope, id)` |

**Why the edit redirect needs a page.** The target Asignatura id exists only
in the database, so it cannot be a config redirect. The thin page does:
`requireCatalogAccess()` → scope `none` → `redirect("/catalog/asignaturas")`;
then `parseRecordId` → null → `notFound()`; `getGrupoById` → null →
`notFound()` (foreign and missing look alike, CM-SCOPE-1); otherwise
`redirect` to the new URL. It already passes the `guards.test.ts` rule that
the guard is the first await, and it does not trip the `current-marker-usage`
marker scan.

**Auth ordering.** `redirects` runs before Proxy and middleware. An
unauthenticated user hitting an old URL is first redirected by config, then
bounced to `/login?next=<new path>`. A role-denied user hits the new page's
guard (`/denied`). The thin edit page is the one place an old URL reaches the
data layer, always behind the guard.

**Temporary or permanent.** `permanent: true` (308) is cached by browsers
indefinitely. Recommendation: 307 (`permanent: false`, and `redirect()`, not
`permanentRedirect`) until the route shape is settled.

**Directory side effect.** `catalog/grupos/` survives as a folder with only
`[id]/edit/page.tsx`, plus `actions.ts`, `grupo-form.tsx` and
`bound-controls.tsx` if kept.

## 6. Main specs needing deltas

| Spec | Requirements to delta |
|---|---|
| `catalog-management` | **CM-ASG-7** (Grupos section): links, the cap and "link to Grupos list" clause (l.395, 447), "reuse the Grupos list copy" (l.398), amendment log (l.1215-1220). |
| | **CM-ASG-8** (list shows active groups): l.482 says "the Grupos list [is] unchanged". |
| | **CM-GRP-1** to **CM-GRP-4**: any "page" wording; check redirect and outcome wording. |
| | **CM-GRP-7** (Grupos list shows the days): removed or moved to the section. |
| | **CM-GRP-8** (preselected Asignatura on the new Grupo page): replaced by the route parameter and `notFound` rules. |
| | **CM-LST-1**: the sentence naming `/catalog/grupos` (l.845) and the Grupos row in the search table (l.857). |
| | **CM-NAV-1** (l.958): "three destinations" becomes two. It also holds the role-visibility table and the active-state scenario. |
| | **CM-SCOPE-2** (l.145) and **CM-SCOPE-1** (table row at l.109: edit page of a Grupo in another Carrera). |
| | **CM-ACC-1** (entry points): check the "page" wording. |
| | **CM-I18N-1** (key parity) and **CM-UX-1** (deactivation confirmation, where the toggle lives). |
| `academic-catalog` | None. |
| `catalog-excel-import` | None. Only the Grupos sheet and `Dias` (CEI-DIAS-1) appear; no route references. |
| `audit-log` | None. |

New requirement needed: redirects for retired `/catalog/grupos/**` URLs,
covering the table in section 5. The destructive change's `CM-RTE-1` ("removed
URLs show the framework 404") is reversed, not reused.

## 7. Old change artifacts: what survives

### Valid and worth carrying over

- **tasks Phase 8** (remove `catalog/grupos/**` and the sidebar entry): the
  sidebar item removal; `nav.catalogGrupos` removal from `es`, `en` and
  `GUARDED_SECTIONS`; the RED pins for `app-sidebar.test.tsx`; the final
  `rg -n "catalog/grupos"` leftover sweep (task 8.8). Not valid: the
  "directory does not exist" pin and the file-delete list.
- **tasks Phase 6** (parity and audit-leak describes): only the list-copy
  parity edits apply. The audit-leak Grupo cases stay, because the actions
  stay.
- **tasks "Read this first"**: the V checklist (tests, typecheck, eslint,
  guard suites, build when routes change), the flaky-test hygiene rules, the
  database rule, and the counting rule (a whole deleted file counts as one
  item) if the owner confirms it still applies.
- **Design MG-18** (sidebar entry removal) and the **CM-NAV-1 delta** (two
  destinations).

### Void under option A

- **tasks Phase 7** (remove the Grupos section): this change keeps and extends
  the section.
- **tasks Phases 1-5 and 9-40**: schema, migration `0007`, readers and
  writers, audit for class events, rehearsal gates, planner and apply v2,
  import contract, parse and template, cutover.
- **Proposal**: all merge decisions (D2-D9). Assumption A11 ("`/catalog/grupos`
  URLs answer not found; no redirect") is reversed.
- **Specs**: the `academic-catalog`, `audit-log` and `catalog-excel-import`
  deltas are void and should be removed from the change folder. The
  `catalog-management` delta is rewritten from scratch.
- **Design**: MG-1..MG-27 and the gates MG-G1..MG-G22 (all about the
  migration), and `runbook-0007.md`.

## 8. Intake coupling: what must stay stable

- `src/db/schema.ts`: `Grupo`, `SolicitudAsignatura.GrupoId`,
  `Inscripcion.GrupoId`, the unique key (`AsignaturaId`, `Periodo`,
  `NumeroGrupo`), `DocenteId NOT NULL`.
- `src/lib/data/grupo-dias.ts`: used by intake `deps.ts`.
- `src/lib/catalog/dias.ts` (`encodeDias`, `decodeDias`, `DIAS_SEMANA`):
  imported by intake tests and by `grupos.ts`, `grupo-form.tsx`,
  `dias-cell.tsx`.
- `src/lib/data/enrollment.ts`: used by `requests/new`.
- `catalog/import/file-dropzone.tsx` (`formatFileSize`): imported by
  `requests/new/documents-step.tsx` and `review-step.tsx`. Do not move or
  rename it.
- Shared with the catalog side: `src/lib/data/grupos.ts` write functions,
  `catalog-scope-sql.ts`, `src/lib/validations/catalog*.ts`. The import writes
  `Grupo` rows through `src/lib/import/apply.ts`.

## 9. Requirement IDs in `docs/requirements.md`

- **RF-12**: maintain the internal catalog of subjects, groups, schedules,
  teachers and enrollments. Primary one to cite.
- **RNF-01**: server-side authorization on every route and action; the menu
  shows only role options. The new sub-routes must keep this and the retired
  URLs must not leak data.
- **RNF-06**: audit of catalog operations. Unaffected; cite for traceability.
- **RNF-12**: confirmation of irreversible actions. The deactivation toggle
  stays on the edit page.
- **RNF-13**: Excel import with a documented template. The workbook is
  unchanged.

## 10. Size estimate (changed lines; estimated, not measured)

| Part | Lines |
|---|---|
| Deleted whole: `grupos/page.tsx` (248) and `page.test.tsx` (625) | 873 raw, 2 items under the old counting rule |
| Moved and adapted: new page ~110, its test ~450; edit page ~150, its test ~600 | ~1,300 counted as new |
| New: redirect page ~45 and test ~120; `next.config.ts` redirects ~25 and test ~60 | ~250 |
| Edited in place: `actions.ts` ~25 and test ~80; `grupo-form.tsx` ~40 and test ~120; section and page ~30; edit-page test ~80 | ~375 |
| Sidebar, `list-params`, guards, markers, parity test | ~300 |
| i18n JSON (es and en) | ~80 |
| **Total** | **~2,300 counted** (about 3,300 raw) |

This is well over an 800-line single PR. Possible slices of at most 800:

- **S1 (create):** form fixed-Asignatura mode and tests, action
  redirect/revalidate changes and tests, new page and test. Additive; old
  routes still work.
- **S2 (edit):** edit page and test under the Asignatura, toggle, and the
  section links repointed.
- **S3 (retire):** remove the list, add `redirects()` and the thin edit
  redirect page, sidebar, `list-params`, guard and marker tests, parity, i18n.

Moving actions, form and bound controls too (not recommended) adds about 2,200
lines of renamed tests plus edits to `guards`, `catalog-structure` and
`audit-leak`.

## 11. Approaches

| Approach | Pros | Cons | Effort |
|---|---|---|---|
| **A1. Sub-routes plus redirects, keep `actions` / `form` / `bound-controls` in `catalog/grupos/` (recommended)** | Least churn: `audit-leak`, `catalog-structure` and `guards` action pins keep their paths; actions tests change only in assertions. | `catalog/grupos/` remains as a non-routed module folder next to the redirect page. | Medium |
| **A2. Move everything under `asignaturas/[id]/grupos/`** | Tidy tree; no `grupos` folder left. | About 2,000 more moved lines; three structural tests to update. | High |
| **A3. Keep the `/catalog/grupos` list but hide the sidebar entry** | No functional loss. | Does not meet the owner's goal. | Low |

## 12. Open product points

1. **`Periodo` field.** (a) Keep it visible in the form (recommended): it is
   part of the unique key and validated by `grupoCreateSchema`
   (`AAAA-S1` / `AAAA-S2`), and no rule for a "current period" exists in the
   repo. (b) Hide it with a default: needs a new rule and breaks CM-GRP-1.
2. **Excel import screen.** (a) Leave it untouched (recommended): the sheets,
   `catalog.import.entities.Grupo` and the preview counts describe the real
   data model. (b) Stop presenting Grupos as a separate catalog there:
   cosmetic and misleading, since the workbook still has a Grupos sheet.
3. **Capabilities only the standalone list had.** (a) Drop them: remove the
   cap-overflow link and keep the "latest 100" note. (b) Rebuild a status
   filter and pagination inside the Asignatura page. (c) Extend the
   Asignaturas list search to match docente or periodo through groups: the
   only way to keep "find a group by docente"; touches `listAsignaturas`.
4. **Temporary versus permanent redirects.** Recommend 307.
5. **Dead data code** (`listGrupos`, `buildGruposWhere`, scope-inventory
   entries): keep for now, or remove in S3.

## 13. Risks

- **Review budget.** About 2,300 counted lines against 800.
- **Edit-page parent mismatch.** `getGrupoById` knows nothing about the URL's
  Asignatura, so the explicit parent check is mandatory.
- **Old links.** Redirects cover them, but `/catalog/grupos/new` with no valid
  `asignaturaId` now lands on the Asignaturas list.
- **Silent behaviour change.** CM-GRP-8's silent-ignore becomes `notFound` on
  invalid ids, and an inactive Asignatura's "new" URL becomes `notFound`.
- **Structural tests are source-text pins.** Wrong paths in `guards.test.ts`,
  `current-marker-usage.test.ts` or `catalog-structure.test.ts` may fail late
  or silently stop covering new files.
- **Parity test coupling.** The Grupo describes read source files by path; key
  set changes must stay identical in es and en.
- **Windows CRLF.** New structural pins must normalise CRLF like the existing
  ones.
- **Unverified:** the `redirects()` `has` capture behaviour and its interplay
  with `middleware.ts` were read from docs, not run. `grupo-form.test.tsx`,
  `new/page.test.tsx` and `[id]/edit/page.test.tsx` were sized, not read in
  full. `CM-ACC-1`, `CM-GRP-1` to `CM-GRP-4` and `CM-UX-1` were flagged by
  heading, not read end to end.

## 14. Recommendation

Go with A1: add the sub-routes (create, then edit) with the fixed-Asignatura
form and actions that redirect to the Asignatura edit page; repoint the
section links; add the redirects; then retire the list and the sidebar entry
and clean i18n and tests. Keep `Periodo` visible and the import untouched.
