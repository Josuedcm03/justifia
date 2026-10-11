# Design: Manage Grupos from inside their Asignatura (UI, routing, one read query)

Groups stop being a catalog of their own: they are created and edited under
`/catalog/asignaturas/[id]/grupos/...`, the old URLs redirect, and the
Asignaturas search also finds a subject through its groups' periodo or docente.
`Grupo` stays a table and nothing is migrated.

> **Supersedes the MG series.** Decisions MG-1 to MG-27 and gates MG-G1 to
> MG-G22 (migration `0007`) are void. Decisions here are numbered **UG-1 to
> UG-10**.

> **Size note.** The `sdd-design` skill caps a design at 800 words. The phase
> brief requires ten decisions with rationale, a test plan per decision and a
> file table; the cap is not reachable without deleting them. Deliberate
> deviation, same as the `catalog-management` precedent.

> **Written in parallel with the spec.** Designed against `proposal.md` (B1 to
> B7 binding, U1 to U12 assumed). Section 9 lists what the spec must pin.

Verification labels used below: **[docs]** read in `node_modules/next/dist/docs/`;
**[source]** read in `node_modules/next/dist/` but not documented; **[code]**
read in this repo; **[unverified]** not read or not run.

## 1. Hard constraints (checkable on the diff)

- [ ] No file under `src/db/`, `drizzle/`, `src/lib/intake/`,
      `src/app/(dashboard)/requests/`, and no edit to
      `src/lib/data/solicitudes.ts`.
- [ ] No migration, no schema change, no index, no command against Neon.
- [ ] `src/app/(dashboard)/catalog/import/file-dropzone.tsx`,
      `src/lib/data/grupo-dias.ts` and `src/lib/catalog/dias.ts` keep their
      paths and exports (not in the diff at all).
- [ ] `src/lib/data/grupos.ts` write functions, `src/lib/validations/catalog.ts`
      and `src/lib/audit/events.ts` are not modified.
- [ ] After the last seam, `rg -n "catalog/grupos" src` returns only the
      module folder imports (`actions`, `grupo-form`, `bound-controls`), the
      redirect page, the redirect table and their tests.

## 2. Quick path

1. Search: `buildAsignaturasWhere` gains an `EXISTS` on groups; the list row
   names the matching groups (UG-5, UG-6).
2. Create and edit pages move under the Asignatura; the form fixes the
   Asignatura; the actions land on the Asignatura edit page (UG-1 to UG-3).
3. Old URLs redirect: three config rules and one guarded page (UG-4).
4. The list page, the sidebar entry and their copy go; pins follow (UG-7,
   UG-8); dead data code goes last (UG-9).

## 3. Decisions

### UG-1 Route tree and params

```
catalog/asignaturas/[id]/grupos/new/page.tsx              params { id }
catalog/asignaturas/[id]/grupos/[grupoId]/edit/page.tsx   params { id, grupoId }
catalog/grupos/[id]/edit/page.tsx                         redirect page (UG-4)
```

| Option | Tradeoff | Decision |
|---|---|---|
| Reuse the sibling slug `[id]`, add `[grupoId]` | Matches `asignaturas/[id]/edit`; one name per path position | **Chosen** |
| `[asignaturaId]/grupos/[id]` | Clearer names, but a second slug name at the same position as `[id]/edit`; Next rejects that at build **[unverified]** | Rejected |

`params` is typed inline as `Promise<{ id: string; grupoId: string }>` and
awaited after the guard **[docs: `03-file-conventions/dynamic-routes.md`]**.
The repo's inline typing is kept over the `PageProps<'/route'>` helper.

Both pages follow the existing order **[code: `guards.test.ts`]**:
`await requireCatalogAccess()` first, then the `none` scope state with no read
(CM-SCOPE-2), then the ids.

| Page | Validation, in order | Answer |
|---|---|---|
| new | `parseRecordId(id)` null | `notFound()` |
| new | `getAsignaturaById(scope, id)` null (missing or foreign) or `!activo` | `notFound()` (U11) |
| new | then `listDocenteOptions()` | form |
| edit | either id malformed | `notFound()` |
| edit | `getGrupoById(scope, grupoId)` null | `notFound()` |
| edit | `record.asignaturaId !== id` (**parent check**) | `notFound()` |

The parent check lives in the edit page only, right after the scoped read, and
needs no extra query: `GrupoListItem` already carries `asignaturaId`, `codigo`
and `nombre`. The actions need no such check: update and toggle receive only
the group id and take the parent from the scoped record
(`target.item.asignaturaId`); the URL is never an input to them. A mismatch
answers exactly like a missing id, so nothing is confirmed about other groups.

### UG-2 Form in create mode

| Option | Tradeoff | Decision |
|---|---|---|
| `FixedField` text plus `<input type="hidden" name="asignaturaId">` | Reuses the component edit mode already draws; schema and action untouched | **Chosen** |
| Combobox with one option | No form change; a control that offers no choice | Rejected |

- `GrupoForm` drops `asignaturas`, `asignaturasTruncated` and
  `defaultAsignaturaId`, and gains `asignatura?: { id; codigo; nombre }`.
  `CreateGrupoForm` requires it; `EditGrupoForm` omits it.
- Reused, nothing new: the file's own `FixedField` (`text-label
  text-foreground`, `gap-2`, `py-2 text-base md:text-sm`) and `ERROR_PANEL`
  (the Alert pattern of `docs/design-system.md` section 5).
- `asignaturaId` leaves the `drawn` list, so its error appears in the existing
  `role="status"` region as a stray error.
- Tampering stays safe **[code: `actions.ts`]**: the hidden value passes
  `grupoCreateSchema`, then the scoped, active pre-check, then the
  re-validation inside the transaction. A foreign, missing or inactive id
  answers `asignaturaUnavailable`; an in-scope active id is something the actor
  may already write to. No new capability.

### UG-3 Actions: destination and revalidation

| Action | Parent id source | Revalidate | Then |
|---|---|---|---|
| create | `parsed.data.asignaturaId` (validated, pre-checked) | list, Asignatura edit | `redirect` to Asignatura edit |
| update | `target.item.asignaturaId` (scoped read) | list, Asignatura edit, group edit | `redirect` to Asignatura edit |
| toggle | `target.item.asignaturaId` | list, Asignatura edit, group edit | no redirect |

- `LIST_PATH` is replaced by `ASIGNATURAS_PATH = "/catalog/asignaturas"` and
  one private helper. `revalidateRecord(ASIGNATURAS_PATH, asignaturaId)`
  already covers the list and `/{id}/edit`; the group edit path is one more
  `revalidatePath` with a literal path, so no `type` argument
  **[docs: `04-functions/revalidatePath.md`]**.
- No form field is read to build a path. `redirect()` stays after the result
  `switch`, outside every `try` **[docs: `04-functions/redirect.md`]**.
- Rejected: a hidden `returnTo` field (open redirect surface, trusts input).
- Side benefit: the Asignaturas list is now revalidated when a group changes;
  today it is not, although its "Grupos" column shows active groups.

### UG-4 Old-URL redirects

| Old URL | Mechanism | Destination |
|---|---|---|
| `/catalog/grupos` | config rule | `/catalog/asignaturas?status=active&page=1` |
| `/catalog/grupos/new?asignaturaId=N` | config rule, `has` query | `/catalog/asignaturas/:asignaturaId/grupos/new` |
| `/catalog/grupos/new` (absent or invalid id) | config rule, `missing` query | `/catalog/asignaturas` |
| `/catalog/grupos/{id}/edit` | guarded page, one scoped read | `/catalog/asignaturas/{asignaturaId}/grupos/{id}/edit` |

All temporary (`permanent: false`, and `redirect()`, never
`permanentRedirect`), per U4.

The rules live in a pure module, `src/lib/catalog/legacy-redirects.ts`, that
`next.config.ts` imports by relative path (as it already does for
`./src/lib/import/limits`). Rejected: handling them in `middleware.ts` (mixes
routing into the auth gate and makes the rules untestable as data).

Points the exploration left open:

| Point | Finding | Status |
|---|---|---|
| `has` capture syntax | `value: "(?<asignaturaId>...)"`, used as `:asignaturaId` in the destination | [docs: `05-config/01-next-config-js/redirects.md`] |
| Is the `has` value anchored | Yes, compiled as `^value$`, so `12abc` does not match `\d+` | [source: `shared/lib/router/utils/prepare-destination.js`] |
| Is the request query appended | Yes, always; no documented switch | [docs] |
| Can a carried key be dropped | Not dropped, but a key written in the destination wins over the request's | [source], not run |
| Rule order | First match is not stated in the docs. The two `new` rules are made mutually exclusive with `missing`, so order does not matter | [source] for `missing` semantics |
| Config redirects against `middleware.ts` | `redirects` run before Proxy (middleware) | [docs: `03-file-conventions/proxy.md`, "Execution order"] |

Consequences:

- **`status` and `page` are neutralised, `q` is carried.** A carried `status`
  would filter Asignaturas by a value chosen for groups, and `page` belongs to
  another list. The destination pins both to their defaults. If the manual
  check shows the override does not hold, fall back to plain pass-through.
- The capture rule leaves a harmless `?asignaturaId=N` on the new URL; the
  page reads no search params.
- The `has` pattern mirrors `RECORD_ID_RE`; anything else falls to the
  Asignaturas list (U12).
- An unauthenticated request is redirected by config first, then bounced by
  the middleware to `/login?next=<new path>`. The three rules are string
  rewrites and read nothing, so they disclose nothing.

The one redirect with a data lookup:

```
Browser         Config rules     middleware.ts      grupos/[id]/edit/page      DB
  | GET /catalog/grupos/5/edit        |                    |                   |
  |-------------->| no rule matches   |                    |                   |
  |               |------------------>| no session:        |                   |
  |<-- 307 /login?next=/catalog/grupos/5/edit              |                   |
  |               |                   | session ---------->|                   |
  |               |                   |    requireCatalogAccess() (role gate)  |
  |               |                   |    scope none -> redirect /catalog/asignaturas
  |               |                   |    parseRecordId null -> notFound()    |
  |               |                   |                    | getGrupoById(scope,5)
  |               |                   |                    |------------------>|
  |               |                   |                    |<-- row or null ---|
  |               |                   |    null (missing or foreign) -> notFound()
  |<-- redirect /catalog/asignaturas/{asignaturaId}/grupos/5/edit              |
  | GET new URL: guard again, scoped read again, parent check passes           |
```

`notFound()` and `redirect()` both throw and stay in the render path, outside
any `try` **[docs: `04-functions/not-found.md`, `redirect.md`]**. Comments in
this page must not contain the text `await ` before the guard line: the guard
pin looks at the first occurrence in the file **[code]**.

### UG-5 Extended search query

| Option | Tradeoff | Decision |
|---|---|---|
| `EXISTS` correlated subquery inside the existing `or(...)` | One row per Asignatura by construction; count and page share one `where` | **Chosen** |
| Join `Grupo` and `DISTINCT` / `GROUP BY` | Changes the count statement and the ordering; easy to double count | Rejected |
| Reuse `buildGruposWhere` | Group-rooted, group-status query | Rejected (proposal) |

```ts
// module-private, the ONE definition of "a group matches the term" (B7)
function grupoMatchesTerm(pattern: string): SQL  // Periodo ilike OR docente NombreCompleto ilike

// inside buildAsignaturasWhere, third member of the existing or(...)
sql`exists (select 1 from ${grupo}
            inner join ${usuario} on ${eq(usuario.id, grupo.docenteId)}
            where ${and(eq(grupo.asignaturaId, asignatura.id), grupoMatchesTerm(pattern))})`
```

- **Scope**: the outer `asignaturaInScope(scope)` is still ANDed, and the
  subquery is correlated to the outer row, so a foreign group can never surface
  a foreign Asignatura. Scope `none` stays `false`.
- **Binding and escaping**: `pattern = containsPattern(q)`, bound through
  `ilike()` as today; nothing is interpolated.
- **B7**: `NumeroGrupo` and `Dias` are not in the predicate.
- **U9**: no `Activo` term on the group, so inactive groups match. Flipping U9
  later is one term in `grupoMatchesTerm`.
- The predicate sits in `WHERE`, where columns render table-qualified
  **[code: `asignaturas.test.ts` renders `"Asignatura"."Activo"`]**. It is not
  added as a selected column of the count statement.

**Matched groups on the row: a second query, not an extension of the
aggregate.**

| Option | Tradeoff | Decision |
|---|---|---|
| Second statement, only when `q` is set and the page has rows: groups of the page's ids that satisfy `grupoMatchesTerm`, grouped in code | Typed rows, same predicate function, testable with the existing statement recorder; default view pays nothing | **Chosen** |
| Extend the `string_agg` column into a JSON aggregate with a `limit 3` derived table plus a count subquery | One statement and strictly bounded, but hand-written JSON SQL, driver-dependent decoding **[unverified]**, pattern bound four more times | Rejected |
| One query per row | N+1 | Rejected |

The second statement joins `Asignatura` and `Usuario`, filters with
`inArray(grupo.asignaturaId, pageIds)`, `asignaturaInScope(scope)` and
`grupoMatchesTerm(pattern)`, orders by Asignatura, `Periodo` desc,
`NumeroGrupo`, `Id`, and selects id, periodo, group number, docente name and
`Activo` (no days, no credential). The first
`ASIGNATURA_MATCHES_MAX = 3` per Asignatura are kept and the rest counted
(U10). It runs inside the same `try`, so a failure degrades the list like the
other two statements. It is not exported, so the scope inventory gains no row.

**Cost (expected, not measured; no index may be added).** `ilike '%term%'`
cannot use a b-tree, and a trigram index would need a migration, so it is out
of scope. The `EXISTS` probes `Grupo` by `AsignaturaId`, which leads the
existing unique key, once per candidate Asignatura, in the count and in the
page: about one pass over the in-scope groups per statement, the same order as
the retired `listGrupos`. The second statement reads at most the groups of ten
Asignaturas (`CATALOG_PAGE_SIZE` is 10); it has no `LIMIT`, so a term matching
every group of ten very old subjects reads up to about a thousand narrow rows.
If that is ever measured as a problem, the upgrade is a `row_number()` window.

### UG-6 List row presentation of a group match

- **Where**: in the Name cell, under the subject name. The "Grupos" column
  keeps its meaning (numbers of the active groups).
- **What**: a `<ul>` of up to three lines, `{periodo} · {group label}
  {numeroGrupo} · {docente}`, an inactive group ending in the translated word
  for inactive in parentheses, then one line "+N more" when the total exceeds
  three.
- **Empty case**: no search, or a row that matched only by code or name:
  nothing is rendered, no placeholder.
- **Tokens** (`docs/design-system.md`): `text-label` (3.2, "metadata") in
  `text-muted-foreground` (2.2: 5.43:1 on a card, 5.05:1 on a hovered row),
  `gap-1` (4px, an allowed step in 4.1). No new colour, radius, size or step.
- **Accessibility**: the list has an `aria-label` ("groups matching the
  search"); the inactive state is text, never colour (section 7); the existing
  `role="status"` count announces the result size.
- **Text, not links.** Rejected: a link per matched group. Three stacked 44px
  targets (section 7) would triple the row height; the row's Edit link opens
  the Asignatura, whose section lists the groups.

### UG-7 i18n (`i18n/es.json` and `i18n/en.json`, identical key sets)

| Action | Keys |
|---|---|
| Remove | `nav.catalogGrupos`; all of `catalog.grupos.list.*`; `catalog.asignaturas.grupos.viewAll` |
| Move | `catalog.grupos.list.columns.{periodo,numeroGrupo,docente,dias,status,actions}` and `catalog.grupos.list.edit` to `catalog.asignaturas.grupos.columns.*` and `catalog.asignaturas.grupos.edit` |
| Add | `catalog.asignaturas.matches.{label,item,itemInactive,more}` (`more` is an ICU plural on `count`) |
| Reword, key kept | `catalog.asignaturas.search.{label,placeholder}` and `noResults.hint` (name teacher and period); `catalog.grupos.page.newSubtitle` (no longer "to the catalog"); `catalog.grupos.breadcrumb.edit` (placeholders `{periodo}`, `{numeroGrupo}` only); `catalog.shared.fieldErrors.asignaturaId.{required,invalid}` (today "Select a subject from the list", and there is no list any more) |
| Keep | `catalog.grupos.{errors,form,page,state}.*`, `catalog.grupos.breadcrumb.{label,new}`, `form.asignaturaLabel`, `form.naturalKeyHint` |

The section keys **move** rather than stay: a `list` namespace for a list that
no longer exists misleads, and moving lets the parity test delete its
list-key pins outright instead of keeping a reduced set. Unused after the
change and removed with the combobox: nothing; `form.searchPlaceholder`,
`form.noMatches` and `form.truncated` still serve the docente Combobox.

Breadcrumb of both new pages: `catalog.asignaturas.title` (link to the list),
then the Asignatura code as data (link to its edit page), then the current
segment with `is-current`.

Whether a test pins the current wording of
`shared.fieldErrors.asignaturaId.*` is **[unverified]**.

### UG-8 Structural tests

| Pin | Change |
|---|---|
| `catalog/guards.test.ts` | **No path edit.** Pages are discovered recursively under `asignaturas`, so both new pages are covered; `grupos` stays in `SEGMENTS` so the redirect page stays covered; the actions path is unchanged. **Add** one pin: the discovered page list equals the expected seven paths, so a misplaced or deleted page fails instead of shrinking coverage |
| `catalog/current-marker-usage.test.ts` | `BREADCRUMB_PAGES`: the two `catalog/grupos/...` entries become the two new paths. The exact-list test then also proves the redirect page writes no marker |
| `src/lib/data/catalog-structure.test.ts` | `ACTION_DIRS` unchanged. The pin "keeps the days out of buildGruposWhere" is removed with the function (UG-9) and replaced by a behavioural test on the rendered SQL of `buildAsignaturasWhere` (no `NumeroGrupo`, no `Dias`) |
| `src/lib/data/scope-inventory.test.ts` | `asignaturas.ts` rows unchanged; the named tests they point at keep their names. `grupos.ts` rows for `buildGruposWhere` and `listGrupos` removed (UG-9) |
| `src/i18n/catalog-parity.test.ts` | `GUARDED_SECTIONS` loses `nav.catalogGrupos`. Section describe: key list loses `viewAll`, gains `edit` and `columns.*`. Grupo describe: list-key pins, list translator test and sidebar label test removed; the "nothing else" filter drops `list`; the breadcrumb test drops `codigo`. Source-scan describe: `FILES` becomes the form and the two new pages; the three `list.*` expectations go. New describe for `catalog.asignaturas.matches` |
| `catalog/audit-leak.test.ts` | Unchanged |
| `src/components/app-sidebar.test.tsx` | Grupos cases removed; two characterization cases: both new group paths mark Asignaturas current (prefix rule, no code change) |
| `src/lib/catalog/list-params.test.ts` | The `/catalog/grupos` case is removed |

New source-text pins normalise CRLF (`.replace(/\r\n/g, "\n")`) like
`catalog-structure.test.ts`; path-only pins do not need it.

### UG-9 Dead code

`listGrupos` and `buildGruposWhere` lose their only caller with the list page.

| Option | Consequence | Decision |
|---|---|---|
| Remove, as the last, deletion-only seam | About 310 deleted lines across `grupos.ts`, `grupos.test.ts`, the scope inventory and one structure pin; nothing exported stays untested or uncalled | **Chosen** |
| Leave | Zero lines now; an exported, scope-inventoried, tested query that no route can reach, kept green forever | Rejected |

Being last and deletion-only, the tasks phase may defer it without affecting
any other seam.

### UG-10 Slicing seams (input for the tasks phase; delivery is not decided here)

| Seam | Content | App state after it | Must follow |
|---|---|---|---|
| A. Search | UG-5, UG-6, search copy, `matches` keys | Old Grupos list still there; nothing lost | none |
| B. Create | UG-2, UG-3, new create page, the two `new` config rules, old `grupos/new` page deleted, section "Add" link, pins | Create lives under the Asignatura; old edit page still works and lands on the Asignatura after saving | none |
| C. Edit | New edit page with parent check, old edit path becomes the redirect page, section Edit links, pins | Both flows under the Asignatura | B (recommended) |
| D. Retire | List page deleted, `/catalog/grupos` rule, sidebar entry, `CatalogListBase`, `viewAll`, list copy, parity | Goal state | **A, B and C** |
| E. Dead code | UG-9 | Same behaviour | D |

Hard order: A before D (otherwise the docente lookup is lost in between); B
and C before D (their breadcrumbs stop linking to the list); E after D. Seam B
cannot be split further: the form change breaks the old create page, so its
removal and its redirect rules travel with it.

## 4. Data flow of the list

```
searchParams -> parseCatalogListParams -> listAsignaturas(scope, status, q, page)
   1. count   where = scope AND status AND (codigo OR nombre OR EXISTS group match)
   2. page    same where, order by Codigo, limit 10
   3. matches only if q != "" and rows > 0: groups of those ids matching the term
 -> AsignaturaListItem[] { ..., grupos, gruposCoincidentes[<=3], gruposCoincidentesTotal }
 -> page.tsx: Name cell renders the list when gruposCoincidentes is not empty
```

## 5. Interfaces

```ts
// src/lib/catalog/types.ts
export type AsignaturaGrupoMatch = {
  id: number; periodo: string; numeroGrupo: string;
  docenteNombre: string; activo: boolean;
};
export type AsignaturaListItem = AsignaturaBase & {
  grupos: string | null;
  gruposCoincidentes: AsignaturaGrupoMatch[]; // at most ASIGNATURA_MATCHES_MAX
  gruposCoincidentesTotal: number;            // 0 when there is no search
};

// src/lib/catalog/list-params.ts
export const ASIGNATURA_MATCHES_MAX = 3;
export type CatalogListBase = "/catalog/asignaturas" | "/catalog/docentes";

// src/lib/catalog/legacy-redirects.ts (pure, no alias imports)
export const LEGACY_GRUPOS_REDIRECTS: { source: string; destination: string;
  permanent: false; has?: [...]; missing?: [...] }[];
```

## 6. File changes

| File | Action | Description |
|---|---|---|
| `src/app/(dashboard)/catalog/asignaturas/[id]/grupos/new/page.tsx` (+ test) | Create | Create page (UG-1); `git mv` from `grupos/new/` so the diff reads as a rename |
| `src/app/(dashboard)/catalog/asignaturas/[id]/grupos/[grupoId]/edit/page.tsx` (+ test) | Create | Edit page with parent check; `git mv` from `grupos/[id]/edit/` |
| `src/app/(dashboard)/catalog/grupos/[id]/edit/page.tsx` (+ test) | Create (same path, new content) | Guarded redirect page (UG-4) |
| `src/lib/catalog/legacy-redirects.ts` (+ test) | Create | The three config rules |
| `next.config.ts` | Modify | `redirects()` returns the table |
| `src/app/(dashboard)/catalog/grupos/actions.ts` (+ test) | Modify | UG-3 |
| `src/app/(dashboard)/catalog/grupos/grupo-form.tsx` (+ test), `bound-controls.tsx` | Modify | UG-2 |
| `src/app/(dashboard)/catalog/asignaturas/asignatura-grupos-section.tsx` | Modify | Links repointed; `viewAll` link and `codigo` prop removed |
| `src/app/(dashboard)/catalog/asignaturas/[id]/edit/page.tsx` (+ test) | Modify | Labels from the moved keys; no `tList` |
| `src/app/(dashboard)/catalog/asignaturas/page.tsx` (+ test) | Modify | Matched-groups list (UG-6) |
| `src/lib/data/asignaturas.ts` (+ test) | Modify | UG-5 |
| `src/lib/catalog/types.ts`, `src/lib/catalog/list-params.ts` (+ test) | Modify | Section 5 |
| `src/components/app-sidebar.tsx` (+ test) | Modify | Entry and `UsersRound` import removed |
| `i18n/es.json`, `i18n/en.json` | Modify | UG-7 |
| `catalog/guards.test.ts`, `catalog/current-marker-usage.test.ts`, `src/i18n/catalog-parity.test.ts`, `src/lib/data/catalog-structure.test.ts`, `src/lib/data/scope-inventory.test.ts` | Modify | UG-8 |
| `src/lib/data/grupos.ts`, `src/lib/data/grupos.test.ts` | Modify | UG-9: the two read functions and their tests removed; writes untouched |
| `src/app/(dashboard)/catalog/grupos/page.tsx`, `page.test.tsx` | Delete | The list (B3) |
| `src/app/(dashboard)/catalog/grupos/new/` | Delete | Moved; the URL is served by config rules |

## 7. Testing strategy (Strict TDD: the failing test first)

| Decision | Test file | First failing assertion |
|---|---|---|
| UG-1 | `asignaturas/[id]/grupos/[grupoId]/edit/page.test.tsx` | A group whose `asignaturaId` differs from the route `id` calls `notFound()` once and renders no record text |
| UG-1 | `asignaturas/[id]/grupos/new/page.test.tsx` | Malformed, missing, foreign and inactive Asignatura each call `notFound()`; docente options are not read before that; scope `none` reads nothing |
| UG-2 | `grupos/grupo-form.test.tsx` | Create mode shows the Asignatura as text, posts its id in a hidden field, and has no combobox named `asignaturaId`; an `asignaturaId` error appears in the status region |
| UG-3 | `grupos/actions.test.ts` | Create redirects to `/catalog/asignaturas/{parsed id}/edit`; update posted with a foreign `asignaturaId` still redirects to the record's parent; toggle revalidates the three paths and does not redirect; the source holds no `"/catalog/grupos"` literal |
| UG-4 | `src/lib/catalog/legacy-redirects.test.ts` | Three rules, all `permanent: false`; the `has` value, anchored as Next anchors it, accepts what `parseRecordId` accepts and rejects `abc`, `12abc`, empty; the `missing` value is its complement; the first destination pins `status` and `page` |
| UG-4 | `grupos/[id]/edit/page.test.tsx` | Scoped record redirects to the URL built from `record.asignaturaId`; null and malformed call `notFound()`; scope `none` redirects to the list with no read; source pin (CRLF normalised): no `try` around either call |
| UG-5 | `src/lib/data/asignaturas.test.ts` | Rendered `where` equals the expected text with the `exists (...)` member and four bound, escaped parameters; no `NumeroGrupo` or `Dias` in it; no `Activo` term on the group; the sentinel test sees the scope in all three statements; no third statement when `q` is empty or the page is empty; four matches yield three items and a total of four |
| UG-6 | `asignaturas/page.test.tsx` | A row with matches renders a labelled list with the three lines, the inactive word and "+1 more"; a row without matches renders no list |
| UG-7 | `src/i18n/catalog-parity.test.ts` | Key sets equal in both locales; `matches.more` renders through the real translator for 1 and 7 |
| UG-8 | the pins themselves | Expected page list; marker list |
| UG-9 | `scope-inventory.test.ts` | Exports of `grupos.ts` equal the reduced rows |

Characterization only (cannot be RED, existing behaviour): recursive page
discovery in `guards.test.ts`, and the sidebar prefix rule on the new paths.

Not testable in vitest, checked once at verify with `npm run build`, `npm
start` and `curl -sI`, first without a session and then with one:

| Request | Expected |
|---|---|
| `/catalog/grupos?q=x&status=inactive&page=3` | 307 to `/catalog/asignaturas` with `q=x`, `status=active`, `page=1` |
| `/catalog/grupos/new?asignaturaId=12` | 307 to `/catalog/asignaturas/12/grupos/new` |
| `/catalog/grupos/new`, `?asignaturaId=abc`, `?asignaturaId=12abc` | 307 to `/catalog/asignaturas` |
| `/catalog/grupos/5/edit` without a session | 307 to `/login?next=/catalog/grupos/5/edit` |
| `/catalog/grupos/5/edit` with a session | redirect to the new URL; a foreign id answers 404 |

The build also proves the route tree has no slug conflict and that the
next-intl plugin wrapper keeps `redirects` **[unverified until run]**. These
checks only read; nothing is written to the database.

## 8. Threat matrix

The skill's matrix (documentation-like paths, Git repository selection, commit
state, push state, PR commands): **all N/A**, the change runs no shell,
subprocess or VCS automation. The HTTP routing boundary is covered here:

| Case | Safe behaviour | RED test |
|---|---|---|
| Group opened under another Asignatura's URL | `notFound()`, same as missing | UG-1 edit |
| Tampered hidden `asignaturaId` | Field error, or a write the actor is already allowed | existing action tests, UG-2 |
| Old edit URL for a foreign group | `notFound()`, never a redirect that reveals the parent id | UG-4 page |
| Redirect target built from input | Targets come from validated or scoped values only; no `returnTo` | UG-3 |
| Config redirect before authentication | Pure string rewrite, no read; the destination is gated | manual check |
| Search term as SQL | Escaped and bound | UG-5 |

## 9. Points the spec must pin

- The six validation rows of UG-1, including "inactive Asignatura answers not
  found on the new-group URL" (replaces CM-GRP-8).
- The four redirect rows of UG-4, with `q` carried and `status`, `page` reset.
- Search fields: code, name, group periodo, group docente name; never group
  number or days; groups of any status.
- The matched-groups list: at most three, a count beyond, inactive labelled,
  absent when nothing matched through groups.

## 10. Where the code contradicts the proposal or the exploration

1. **`guards.test.ts` needs no path edits.** The exploration lists `SEGMENTS`
   and `ACTION_SEGMENTS` as must-change; pages are discovered recursively and
   `grupos` must in fact stay listed for the redirect page.
2. **`catalog-structure.test.ts` does change**, although the exploration says
   "only if actions move": it pins `buildGruposWhere` by name and fails if the
   function is removed.
3. **The proposal is inconsistent on dead code**: its table says
   `src/lib/data/grupos.ts` is unchanged, its Open Question 4 recommends
   removal.
4. **"Query carried" cannot be made selective by configuration.** Next passes
   every key through; keys can only be overridden, which UG-4 uses.
5. **Rule order ("placed after the rule above") is not a documented
   guarantee**; UG-4 removes the dependency.
6. **`revalidateRecord` cannot take a group id any more**: it builds
   `{list}/{id}/edit`, which is no longer the group URL shape.
7. **The shared error copy "Select a subject from the list" becomes wrong** in
   create mode; not mentioned by the proposal.
8. **Pre-existing, out of scope**: `middleware.ts` keeps only the pathname in
   `next`, so a signed-out visit to `/catalog/grupos?q=x` loses `q` after
   login.

No assumption U1 to U12 is made impossible by the code.

## 11. Size (estimated, not measured)

The page and form test files were sized, not read in full **[unverified]**.

| Seam | Counted lines if moved files count as new | With renames credited |
|---|---|---|
| A | about 400 | about 400 |
| B | about 850 | about 550 |
| C | about 950 | about 500 |
| D | about 450 (plus two whole-file deletions, 873 raw) | about 450 |
| E | about 310 (deletions) | about 310 |
| **Total** | **about 2,950** | **about 2,200** |

Against the proposal's 2,700 to 2,800: the search costs slightly less than
assumed, UG-9 adds about 310, and the guard pins cost less. No reading of the
numbers fits one 800-line pull request, and seams B and C exceed 800 on their
own unless renames are credited.

## 12. Migration and rollout

No migration required. Rollback is a revert of the pull request or of the
seams, newest first; the redirects are temporary, so nothing is cached by
browsers.

## 13. Open questions for the owner

- [ ] **Reset `status` and `page` on the `/catalog/grupos` redirect, keep
      `q`?** Recommendation: yes (UG-4).
- [ ] **Remove `listGrupos` and `buildGruposWhere` in this change?**
      Recommendation: yes, as the last deletion-only seam; keep them only if a
      cross-subject group list is expected to return (proposal Open Question
      4).
- [ ] **Do renamed files with edits count as changed lines only?** It moves
      seams B and C from over to under 800. Needed by the tasks phase.
- [ ] **U9 and U10 are still unconfirmed** (proposal Open Questions 2 and 3).
      The design follows both recommendations; reversing U9 is one predicate
      term and one copy key.
