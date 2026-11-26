# Apply Progress: docente-maintenance

## Owner decisions (task 0.2, 2026-11-25)

- D1 to D5 of `proposal.md` confirmed.
- Four stacked slices into the tracker `feat/docente-maintenance` (from main c5ea22e); review budget 1000 changed lines per PR; ask-on-risk; feature-branch-chain; one production deploy.
- Standing approval to open and merge the slice PRs into the tracker without asking for each one, only with every gate green and at most 1000 changed lines.
- STOP after each slice: report and wait for the owner before starting the next one.
- An explicit yes is always required for every Neon command, the merge to `main` and the deploy, any deletion, any PR over 1000 lines and any change of an owner decision. No database command runs without it.

## Log

- 0.1: tracker created from main c5ea22e; planning committed (exploration, proposal, specs, design, tasks) and pushed.
- Early read-only check of production (2026-11-25): 0 active grupos under an inactive docente, 0 emails repeated ignoring case, 0 docentes without email, 4 docentes, all active. The gate repeats it on the day of the merge (6.3).

## Slice 1 (domain), branch `feat/docente-maintenance-1-domain` (base tracker 76574b3), 2026-11-25

Mode: Strict TDD (vitest). Tasks 0.3 and 1.1 to 1.11 done. Task 1.12 (slice close) is NOT closed: the slice measures 1258 changed lines, over the 1000 stop line (see "Size and stop line"). Task 1.0 (branch) was created by the orchestrator and 1.13 (PR) is not started.

### Task 0.3: baseline and Next rule

- Scoped baseline T(src/lib src/app src/i18n src/test) on the tracker tip: 342 test files, 9651 tests; 2 files and 3 tests failed (the visible one is `import-form.test.tsx`, the "credentials.download" link not found) while the machine was loaded by parallel edits. Not reproduced: the two later full runs of the same tree were green.
- Full suite at the slice tip: 394 files, 10510 tests, green (run twice; the first run found the real regression of unit 2 described in the deviations).
- Next docs read (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/`): `revalidatePath.md` (a pattern with a dynamic segment REQUIRES the `type` argument "page"; a literal path omits it; call it in Server Functions) and `redirect.md` (call `redirect` OUTSIDE any `try`/`catch`: it throws). Rule applied in slice 2: literal paths without type, dynamic patterns with "page", `redirect` after the try. Slice 1 touches no Next API.

### TDD cycle evidence

| Unit | Task | RED (test written first, run, failed) | GREEN | MC |
|------|------|----------------------------------------|-------|----|
| 1 | 1.1 | `npm test -- src/lib/audit`: 12 failed, 140 passed (2 files). `accountCreatedEvent` and `accountUpdatedEvent` ignored `origin` (payload came out `origen: "importacion"` with `importacionSha256: undefined`), `accountActiveChangedEvent` and `docenteWriteEvents` "is not a function", `AUDIT_ACTIONS` lacked the two codes | 1.2: `src/lib/audit/{types,events}.ts` plus the result types; T(audit/): 3 files, 152 tests pass; typecheck clean | 1.3 |
| 2 | 1.4 | `docente.test.ts`: "Failed to resolve import @/lib/validations/docente"; `catalog-parity`: 7 failed (key list, `fieldErrors` exact set in es and en, five messages missing in both locales) | 1.5: schema, key list, catalogs; T(validations/docente catalog-parity src/i18n): 10 files, 509 tests pass | 1.6 |
| 3 | 1.7 to 1.9 | `docentes.test.ts`: "Failed to resolve import @/lib/data/docentes" (module missing) | 1.10: `src/lib/data/docentes.ts`; T(data/docentes): 1 file, 31 tests pass | 1.11 |

REFACTOR: none needed (the builders reuse the `AuditOrigin` spread of the asignatura and grupo builders).

### Mutation checks (each applied to the production file, run, reverted with `git restore`; `git status` clean before every commit)

| MC | Mutation | Failing tests |
|----|----------|---------------|
| 1a | the toggle payload carries `importacionSha256` | `accountActiveChangedEvent ... activo false is usuario.desactivado ...` and `... activo true is usuario.reactivado ...`; `docenteWriteEvents ... every payload is the three keys campos, rol and origen: no digest, no value` |
| 1b | `buildAuditEvents` origin without the digest | `buildAuditEvents > importacionSha256 propagates from summary.fileSha256, not re-derived` |
| 1c | `docenteWriteEvents` emits for `unchanged` | `docenteWriteEvents ... gives one event per success and [] per refusal and no-op`; `... every payload is the three keys ...` |
| 2 | schema made loose (`.loose()`, passes `login` through) | `docenteUpdateSchema (DM-3) > strips every key outside the three editable fields` |
| 3a | `if (!activo && false)` skips the active-grupo count | `setDocenteActivo ... deactivation counts the active grupos of any period ...`; `... active grupos refuse with their count and no UPDATE`; `... answers not_found when the deactivating UPDATE returns no row` |
| 3b | email lookup without `Id <> id` | `updateDocente ... looks the email up by lower-case equality, excluding the account itself ...`; `... re-saving an own mixed-case email ... excludes the own row` |
| 3c | savepoint replaced by the same handle | `updateDocente ... updates inside a savepoint, with only the changed fields ...`; `... maps a 23505 raised inside the savepoint to correo_taken` |
| 3d | `login` added to the SET | `updateDocente ... updates inside a savepoint ...`; `... stores all changed fields in one write ...`; `... never puts the login, the hash, the role, the state or the password flag in the SET` |
| 3e (UPDATE) | role predicate dropped from both UPDATEs | `updateDocente ... updates inside a savepoint ...`; `setDocenteActivo ... deactivation counts ...`; `setDocenteActivo ... reactivation runs no count, sets only Activo and carries the role in the WHERE` |
| 3e (read) | role predicate dropped from the reads | `getDocenteById ... reads Usuario joined to Rol ...`; `... is null identically for a missing id and for an account of another role`; `updateDocente ... reads the row first ...`; `setDocenteActivo ... reads the row first ...` |
| 3f | email lookup runs when `correo` is unchanged | `updateDocente ... runs no email lookup when the email is unchanged`; `... updates inside a savepoint ...` |

### Work unit evidence

| Unit | Focused test command and result | Runtime harness | Rollback boundary |
|------|---------------------------------|-----------------|-------------------|
| 1 | `DATABASE_URL=postgres://u:p@localhost:5432/x npm test -- src/lib/audit`: 3 files, 152 tests, pass | N/A: pure builders, no runtime boundary; the Postgres proof is SC-1..SC-7 (task 5.2) | revert `fed07e0`: audit actions, builders, result types; the import payload is key-for-key unchanged |
| 2 | `npm test -- validations/docente validations/catalog catalog-parity src/i18n`: pass (the i18n run is 509 tests; the two validations files 122) | N/A: pure schema and catalogs | revert `c8ba7a2`: schema, key list, catalog strings |
| 3 | `npm test -- data/docentes`: 1 file, 31 tests, pass | Postgres suite SC-1..SC-7 on the disposable branch (task 5.2); not run here (no database command allowed) | revert `af552d9`: two new files, nothing calls them yet |

### Commits

- `fed07e0` feat(audit): add docente toggle actions and origin-aware account events (5 files, 324 changed lines)
- `c8ba7a2` feat(docentes): add the docente edit schema, result types and field errors (7 files, 273 changed lines)
- `af552d9` feat(docentes): add the docente data layer (2 files, 661 changed lines)

### Deviations

1. The result types `DocenteWriteResult` and `DocenteActiveResult` (`src/lib/catalog/types.ts`) are in unit 1, not unit 2 (task 1.5): `docenteWriteEvents` in `events.ts` maps them, so unit 1 does not typecheck without them. The unit 1 commit lists five files (four audit files plus `catalog/types.ts`); the unit 2 commit has no `catalog/types.ts`.
2. The unit 2 commit also holds `src/lib/validations/catalog.test.ts`: its "every listed key can be emitted (the list is exactly the emitted set)" pin went red with the four new keys, found by the first full run. The battery now also feeds `docenteUpdateSchema` (empty input, over-long values, an over-long address). Folded into unit 2 with a fixup and autosquash so every commit is green on its own (local branch, nothing pushed).
3. `events.test.ts`: the existing import assertions that read `datos.importacionSha256` (a field the new union type does not expose without narrowing) now assert `datos` with `toEqual` or `toMatchObject` carrying the same keys and values; the calls of `accountCreatedEvent` and `accountUpdatedEvent` pass `origin`. Meaning unchanged.
4. `getDocenteById`, `updateDocente` and `setDocenteActivo` share one `isDocente` predicate (role code "docente" through the join on `Rol`), so the three reads cannot drift apart.
5. New files were created LF and converted to CRLF to match the working tree; the index holds LF (autocrlf).

### Gate results (slice tip `af552d9`)

- `npm test` (dummy DB): 394 files, 10510 tests, all pass (286 s).
- `npm run typecheck`: clean.
- `npx eslint src` with the prettier end-of-line rule set to auto: 0 errors, 1 warning (`SidebarGroupLabel` unused in `src/components/app-sidebar.tsx`, not touched by this slice). Touched files individually: 0 problems; `npx prettier --check <touched> --end-of-line auto`: clean.
- `npm run build` (dummy DATABASE_URL and AUTH_SECRET): compiled, route table printed.

### Size and stop line

`git diff --numstat 76574b3 HEAD -- . ':(exclude)openspec' ':(exclude)docs'`: 1232 added, 26 deleted, 1258 total (planned about 710). Production code is about 340 of those lines; about 920 are tests (`docentes.test.ts` alone is 487). Over the 1000 stop line: task 1.12 is left open and the PR (1.13) is not opened. The last unit boundary under 1000 is after unit 2 (597 lines); unit 3 alone is 661. The owner decides the cut or a `size:exception`. Tests were not trimmed.

### Orchestrator review of slice 1 (2026-11-25)

- Code read in full; full run repeated at e8f5973: 394 files, 10510 tests, all pass; typecheck clean; 1258 changed lines measured again.
- Six further mutations on `docentes.ts`, `docente.ts` and `events.ts`, all reverted, all killed: count without the active filter, any error mapped to `correo_taken`, inactive docente editable, email not lower-cased, subquery counting inactive grupos, toggle direction swapped.
- Over the 1000 stop line: cut by the owner's yes (2026-11-25) into PR 1a (#155, units 1 and 2, 597 lines, green on its own: 393 files, 10479 tests) and PR 1b (#156, unit 3, 661 lines).
- Standing rule from the owner (2026-11-25): a slice over 1000 lines is cut at unit boundaries into PRs of at most 1000 lines, without touching code or tests, and reported at the pause.

## Slice 2 (actions), branch `feat/docente-maintenance-2-actions` (base tracker 041c475, which holds slice 1), 2026-11-25

Mode: Strict TDD (vitest). Tasks 2.0 to 2.11 done. Task 2.12 (PR) is not started: the orchestrator opens and merges it. The slice measures 1929 changed lines, over the 1000 stop line (see "Size and stop line"). No database command of any kind was run.

### Rule applied for Next

`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md` read again before the actions: a literal path omits `type`, a pattern with a dynamic segment REQUIRES `"page"`. The actions revalidate `/catalog/docentes`, `/catalog/docentes/{id}/edit`, `/users` and `/catalog/asignaturas` as literals and the three Asignatura pattern pages with `"page"`. `redirect` runs after the `try`, never inside it.

### TDD cycle evidence

| Unit | Task | RED (test written first, run, failed) | GREEN | MC |
|------|------|----------------------------------------|-------|----|
| 4 | 2.1 | `npm test -- auth/permissions docente-access`: 2 files failed, 11 tests failed, 157 passed. `canManageDocentes` "is not a function", `rolesQueGestionanDocentes` "is not iterable", `docente-access.ts` missing (ENOENT in the restatement scan, import not resolved in the guard test) | 2.2: `permissions.ts` and `docente-access.ts`; 2 files, 194 tests pass; typecheck clean | 2.3: MC-4a, MC-4b |
| 5 | 2.4 | `action-helpers.test.ts`: 17 failed ("addressedRecord is not a function"), 16 passed at write time (the `addressed` wrapper cases pin existing behaviour, so they carry a revert-only check, MC-A1) | 2.5: `addressedRecord` plus the `addressed` wrapper; T(action-helpers asignaturas/actions grupos/actions): 3 files, 222 tests pass, the existing tests unedited | MC-A1, MC-A2 |
| 5 | 2.6, 2.7, 2.8 | `docentes/actions.test.ts`: "Failed to resolve import ... docentes/actions"; `audit-leak.test.ts`: "Cannot find package ... docentes/actions"; `catalog-parity.test.ts`: ENOENT on the actions source (whole file); `guards.test.ts`: "covers every expected actions module" (2 vs 3 files); `route-coverage.test.ts`: the table lists a stale actions row; `access-matrix.actions.test.ts`: "no module loader for (dashboard)/catalog/docentes/actions.ts" | 2.9: `docentes/actions.ts` and the copy; T(auth/permissions docente-access action-helpers docentes/actions audit-leak catalog/guards access src/i18n catalog-parity): 20 files, 1406 tests pass; typecheck clean | 2.10: MC-5a to MC-5d |

REFACTOR: none needed. Two test-side fixes happened before the commits, both found by the first GREEN run of the new tests: the guard test pinned the absence of the text "requireCatalogAccess" but the guard's doc comment names it (narrowed to the import path and the call), and the "email of 161 characters" row of the action test was built with 158 (fixed to 153 plus the 8-character domain).

### Mutation checks

Each applied to the production file, run, reverted, `git status` clean before every commit. Unit 4's MC-4a was reverted by the exact reverse edit because the unit was not staged yet (a `git restore` would have dropped the unit); the diff was compared with the green one and the focused run repeated (168 tests pass). Every later check was reverted with `git restore` after staging the unit.

| MC | Mutation | Failing tests |
|----|----------|---------------|
| 4a | `canManageDocentes` returns `rol === "secretaria" \|\| rol === "coordinacion"` | `permissions.test.ts`: `canManageDocentes ... denies coordinacion`, `... equals canAssignRole(rol, 'docente') for the five roles and for none`, `... is not the catalog predicate: it is narrower than canManageCatalog`, `rolesQueGestionanDocentes ... is exactly secretaria`; `docente-access.test.ts`: `sends coordinacion to /denied`, `does not look at the subject of a denied caller: the redirect wins` (6 tests) |
| 4b | `await getCatalogActor(0)` before `requireRole` | `docente-access.test.ts`, 23 tests, among them `a denial makes no read > propagates the /login redirect before any other root is touched` (and `/denied`, `/change-password`), `... is a guard with no database read at all: even an admitted caller reads nothing`, `source: requireRole is the first await and nothing is read before it` and every role-table case |
| A1 | `addressed` hands a fixed scope to the reader instead of its own | `action-helpers.test.ts > addressed ... hands the scope and the id to the reader, in that order`; `asignaturas/actions.test.ts > updateAsignaturaAction > pre-check: a missing and a foreign record are the identical gone, without the lock` and `setAsignaturaActivoAction > pre-check: a missing or foreign record is gone without taking the lock, even when busy`; the `updateGrupoAction` pre-check case (8 tests in all) |
| A2 | `addressedRecord` passes a second argument to the reader | `action-helpers.test.ts > addressedRecord ... reads by the id alone: the reader receives no scope and no second argument` |
| 5a | `formData.get("id")` before `requireDocenteAccess()` in `updateDocenteAction` | `guards.test.ts > docentes/actions.ts: every exported action awaits its guard first, before any form read`; in `actions.test.ts` the six denied-identity cases (`administrador`, `coordinacion`, `docente`, `estudiante`, `anonymous`, `flagged`), `a coordinacion with a valid form is denied and writes no row (DM-1)` and `busy does not bypass the guard ...` (42 tests in the three files) |
| 5b (update) | `withCatalogWrite` gets `() => []` instead of `docenteWriteEvents` | `audit-leak.test.ts > updateDocenteAction leaks nothing > a success writes exactly one manual event of field names`; `actions.test.ts > updated: one manual event of field names in the same transaction, after the write`, `the actor is the session user, never a value of the body`, `an audit failure rejects the whole write: generic error, nothing revalidated` |
| 5b (toggle) | same, in `setDocenteActivoAction` | `audit-leak.test.ts` both `setDocenteActivoAction (deactivate / reactivate) leaks nothing > a success writes exactly one manual event`; `actions.test.ts > deactivate / reactivate changes the state, audits one manual event of names only ...`, `the actor is the session user and a crafted activo or actor field is ignored` |
| 5c | intent normalised with `.toLowerCase()` (accepts "DEACTIVATE") | `actions.test.ts > setDocenteActivoAction > an unknown intent (DEACTIVATE) answers gone and writes nothing` and `... (Reactivate) ...` |
| 5d (update) | actor taken from `formData.get("actorId")` | `actions.test.ts > updateDocenteAction > the actor is the session user, never a value of the body` and `mass assignment: login, hashClave, ... never reach the data layer` (the action must read only four keys) |
| 5d (toggle) | same, in `setDocenteActivoAction` | `actions.test.ts > setDocenteActivoAction > the actor is the session user and a crafted activo or actor field is ignored` and `runs in the design order: guard, translations, intent, pre-check, write` |

### Work unit evidence

| Unit | Focused test command and result | Runtime harness | Rollback boundary |
|------|---------------------------------|-----------------|-------------------|
| 4 | `DATABASE_URL=postgres://u:p@localhost:5432/x npm test -- src/lib/auth`: 11 files, 334 tests, pass | The guard runs over the REAL `requireRole` with a doubled session source for the six non-admitted identities and the admitted one; the access matrix covers it end to end from unit 5 (no entry point calls the guard in this unit) | revert `df11aca`: the predicate, the list and the guard; nothing calls them yet |
| 5 | `npm test -- auth/permissions docente-access action-helpers docentes/actions audit-leak catalog/guards access src/i18n catalog-parity`: 20 files, 1406 tests, pass | Access matrix (`access-matrix.actions.test.ts`, the real guard over the seven identities, now with the two new exports) and `route-coverage.test.ts`; the actions run end to end on Postgres only at the system test ST-3 to ST-11 and the suite of slice 4 (no database command allowed here) | revert `f2052d5`: the actions, the helper, the matrix row, the pins and the copy; nothing calls the actions yet (the form is slice 3) |

### Commits

- `df11aca` feat(auth): add the secretaria-only docente access guard (4 files, 310 changed lines)
- `f2052d5` feat(docentes): add the docente edit and toggle actions (10 files, 1619 changed lines)

### Deviations

1. `src/i18n/catalog-parity.test.ts`: the existing pin "pins exactly the Docentes list keys" holds the exact key set of `catalog.docentes`, so it went red on the new copy. Changed minimally: `DOCENTES_KEYS` gained `errors.unexpected` and `errors.activeGrupos` and the title says "list and action keys". Task 3.8 adds the slice 3 keys the same way.
2. `src/app/(dashboard)/catalog/guards.test.ts`: the existing per-file test "every exported action awaits requireCatalogAccess() first, before any form read" now picks the expected guard by path (`expectedGuard`) and is titled "awaits its guard first". For asignaturas and grupos nothing changed in effect. Added "calls only its own guard" (the docente actions never contain `requireCatalogAccess(` and the catalog actions never contain `requireDocenteAccess(`).
3. `docentes/actions.test.ts` runs the REAL `requireDocenteAccess` over the real `requireRole` with a doubled session source; the existing catalog action tests double the guard. It proves the production redirects (`/denied`, `/login`, `/change-password`) and the scenario "coordinacion with a valid form". `audit-leak.test.ts` keeps its doubled `requireRole`, so the real docente guard resolves to its session there.
4. Gap for slice 3 (not fixed here): DM-16 asks that reactivating an already active docente says it is "already active". No catalog holds that text: the shared `ActiveToggle` shows `refusals.unchanged` ("no changes to save") for a reactivation no-op and `refusals.alreadyInactive` for a deactivation no-op, and the design copy list has no key for it. The actions return `{ kind: "unchanged" }` with no text, so slice 2 adds none; the refusal-table parity test says so in a comment. Slice 3 (3.5, the toggle in `bound-controls.tsx` and the `state.*` keys) needs a docente-specific text or a prop on the shared toggle.
5. The "no other source file restates the list" scan of task 2.1 reads `docente-access.ts` and every non-test source under `catalog/docentes` for any role literal; the slice 3 files join it automatically.
6. Unit 5's commit lists `action-helpers.ts` and its new test (tasks 2.4 and 2.5) and the two catalogs next to the actions, the pins and the matrix row; unit 4's commit lists exactly four files.
7. Revalidation is asserted as the exact ordered list of the design: record list, record edit page, `/users`, `/catalog/asignaturas`, then the three pattern pages with `"page"`.
8. New files were created LF and converted to CRLF to match the working tree; the index holds LF (autocrlf).

### Gate results (slice tip `f2052d5`)

- `npm test` (dummy DB): 397 files, 10711 tests, all pass (257 s). Slice 1 tip was 394 files, 10510 tests: +3 files (`docente-access`, `action-helpers`, `docentes/actions`) and +201 tests.
- `npm run typecheck`: clean.
- `npx eslint src` with the prettier end-of-line rule set to auto: 0 errors, 1 warning (`SidebarGroupLabel` unused in `src/components/app-sidebar.tsx`, not touched by this slice). Touched files individually: 0 problems; `npx prettier --check <touched> --end-of-line auto` (including both catalogs): clean.
- `npm run build` (dummy DATABASE_URL and AUTH_SECRET): compiled, route table printed.

### Size and stop line

`git diff --numstat 041c475 HEAD -- . ':(exclude)openspec' ':(exclude)docs'`: 1908 added, 21 deleted, 1929 total (planned about 700). Per unit: unit 4 (`df11aca`) 310, unit 5 (`f2052d5`) 1619. Production code is about 263 of those lines; about 1666 are tests (`docentes/actions.test.ts` alone is 864, `catalog-parity.test.ts` +205, `audit-leak.test.ts` +140, `action-helpers.test.ts` 147). Over the 1000 stop line, and unit 5 alone is over it, so no unit boundary lands under 1000 for the actions. Inside unit 5 the pieces are: helper (tasks 2.4 and 2.5) 175, actions module with its test and copy 1045, pins (audit-leak, guards, parity, matrix) 399. Tests were not trimmed; the cut is left to the owner and the orchestrator.

### Orchestrator review of slice 2 (2026-11-25)

- Code read in full. Full run at the slice tip: 397 files, 10711 tests, all pass; typecheck clean; ESLint 0 errors.
- Nine further mutations, all reverted, all killed: no revalidation after a toggle, `correo_taken` mapped to unexpected, `/users` not revalidated, count 0 in the refusal, intent check removed, safe-integer check removed in the guard, `addressedRecord` returning a null record, `inactive` falling through to the redirect, the Asignaturas edit page not revalidated.
- One reviewer commit (`fix(docentes): point the active-grupos refusal to the Asignaturas search`): the DM-8 refusal now ends with the pointer to the Asignaturas search (CM-ASG-9, a SHOULD of DM-8), red first in `catalog-parity.test.ts`. Slice total 1935 lines.
- Cut by the owner's choice (2026-11-25) into PR 2a (#157: unit 4 plus the `addressedRecord` helper as its own commit, 485 lines, green on its own: 396 files, 10580 tests) and PR 2b (#158: the actions, pins and copy, about 1450 lines, over 1000 with the owner's explicit yes). The 2b branch was rebased onto 2a; its tree is byte-identical to the reviewed tip.
- Open for slice 3: DM-16 "already active" has no copy yet; the toggle of task 3.5 must supply it.

## Slice 3 (interface), branch `feat/docente-maintenance-3-ui` (base tracker b397f74, which holds slices 1 and 2), 2026-11-25

Mode: Strict TDD (vitest). Tasks 3.0 to 3.11 done. Task 3.12 (PR) is not started: the orchestrator opens and merges it. The slice measures 2669 changed lines, over the 1000 stop line (see "Size and stop line"). No database command of any kind was run, no env file was read, the dev server was not started.

### Rule applied for Next

No new Next API was needed beyond the slice 1 and 2 rules: the edit page types `params` as `Promise<{ id: string }>` and awaits it only after the guard, `notFound()` stays in the render path outside any `try`, and the page is a Server Component that never imports an action (it reaches them through the client module `bound-controls.tsx`, as the Asignatura pages do).

### TDD cycle evidence

| Unit | Task | RED (test written first, run, failed) | GREEN | MC |
|------|------|----------------------------------------|-------|----|
| 6 | 3.1 | `catalog/docentes` and `catalog-parity`: 3 files failed, 18 tests failed, 430 passed. `canEdit` ignored by the table (no fourth column, no Edit link), `columns.actions` and `edit` missing in both catalogs (the exact-key pin `DOCENTES_KEYS` and the "scan finds the keys" case failed), the page did not pass `canEdit`. Cases that pin existing behaviour (an explicit `false`, no create control, the empty state) passed at write time | 3.2: table, page, two keys per catalog; T(catalog/docentes app-sidebar catalog/guards catalog-parity access src/i18n auth/permissions): 21 files, 1569 tests pass; typecheck clean | 3.3: MC-6a, MC-6b |
| 7 | 3.4 | `docente-form.test.tsx`: "Failed to resolve import ... docentes/bound-controls" (module missing); `catalog-parity`: ENOENT on `docente-form.tsx` (the new scan list, whole file); `active-toggle.test.tsx`: 2 failed, 23 passed (the new `unchangedText` prop was ignored: the shared "was already inactive" and "no changes" texts came out instead) | 3.5: `docente-form.tsx`, `bound-controls.tsx`, the prop on the shared toggle, 15 keys per catalog; T(catalog/docentes catalog/active-toggle catalog/guards catalog/asignaturas catalog/grupos auth/permissions access src/i18n): 35 files, 2079 tests pass; typecheck clean | 3.6: MC-7 plus four extra checks |
| 8 | 3.7, 3.8 | Page test: "Failed to resolve import ... [id]/edit/page" (module missing). Pins: `guards.test.ts` "discovers exactly the expected catalog pages" (7 vs 8), `current-marker-usage.test.ts` (2), `access-matrix.pages.test.tsx` (2: no module loader for the new row), `catalog-parity` (ENOENT on the new page source), `phone-exposure.test.ts` ("only the edit page, its form and its action carry the phone"), `route-coverage.test.ts` (RAC-2 once the page exists). The sidebar case and the three "selects no phone" cases passed at write time (revert-only checks below) | 3.9: `[id]/edit/page.tsx`, three `page.*` keys per catalog, `requireDocenteAccess` added to the `GUARDS` list of the ratchet; T(catalog/docentes catalog/guards catalog/current-marker app-sidebar catalog-parity route-coverage access-matrix src/i18n navigation): 25 files, 1692 tests pass; typecheck clean | 3.10: MC-8a, 8b, 8c, sidebar and phone pins |

REFACTOR: none needed. Two test-side defects of my own were fixed before the commits, both found by the first GREEN run: the "list delivers no phone" scan first matched the word "phone" in an existing comment of `page.tsx` (narrowed to the column name `telefono`), and the route-coverage ratchet read the word "await" inside a comment of the new page as its first await (`<not a call>`), so the comment was reworded.

### Mutation checks

Each applied to the production file after staging the unit, run, reverted with `git restore`; `git status` clean before every commit.

| MC | Mutation | Failing tests |
|----|----------|---------------|
| 6a | `canEdit` defaults to `true` in `docentes-table.tsx` | `docentes-table.test.tsx`: `DocentesTable is read-only > has no control and no link in the body rows`, `DocentesTable in es/en > has three columns, name, email and status ...`, `... actions column ... > defaults canEdit to false: exactly the three data columns and no link in the body` (es and en; 5 tests) |
| 6b | `page.tsx` passes `canEdit={session.rol !== "estudiante"}` | `page.test.tsx`: `DocentesPage actions column > gives administrador exactly the three data columns and no edit entry`, `... coordinacion ...`, `... keeps the guard first and passes canEdit from the derived predicate, never a role list`, `DocentesPage rows > renders Name, Email and Status, no login column and no actions column (FE-24)`, `DocentesPage is read-only > offers only search, the status filter, pagination and the link to /users`; `permissions.test.ts > no source file of the docente guard or its pages and actions restates a role` (6 tests) |
| 7 | `locked` no longer includes `!record.activo` in `docente-form.tsx` | `docente-form.test.tsx > DocenteForm inactive docente > is read-only, offers no submit and shows the reactivate hint in its place` and `... never submits while locked, whatever is typed` |
| 7b (extra) | `EditDocenteForm` loses its `key` | `docente-form.test.tsx > EditDocenteForm > starts from a clean form when the state flips, so a refused edit does not stay locked after a reactivation` |
| 7c (extra) | the confirmation names the docente without the email in parentheses | `docente-form.test.tsx > DocenteActiveToggle confirmation in en/es > names the docente with the email in parentheses, deletes nothing, keeps grupos and remissions and shows the count` |
| 7d (extra) | the shared toggle ignores `unchangedText` | `active-toggle.test.tsx > ActiveToggle unchangedText > says the supplied text for a no-op deactivation ...` and `... reactivation ...`; `docente-form.test.tsx > DocenteActiveToggle already-in-state answers` (4 tests); 6 in all |
| 7e (extra) | the notice drops the count | `docente-form.test.tsx > DocenteActiveToggle confirmation > ... shows the count`, `shows the count 0/1/4 the page read` (es and en; 8 tests) |
| 8a | `getDocenteById` called before `requireDocenteAccess()` in the edit page | `page.test.tsx > EditDocentePage access > sends estudiante / docente / coordinacion / administrador to /denied without awaiting params or reading anything` and `sends an anonymous caller to /login and reads nothing`; `guards.test.ts > ... [id]/edit/page.tsx calls its guard before any other await`; `route-coverage.test.ts > RAC-2 ... [id]/edit/page.tsx awaits a guard before anything else` (22 tests in all) |
| 8b | the page hands the whole row to `EditDocenteForm` | `page.test.tsx > EditDocentePage delivered data > serializes the id, name, email, phone, state and grupo count, and nothing else` |
| 8c | the confirmation notice has no count (the notice is composed in `bound-controls.tsx`, a unit 7 file) | `page.test.tsx > EditDocentePage active docente > confirming names the docente with the email, states what is kept and shows the count`, `... shows no such link, and says there are none, when no grupo is active`; the `docente-form.test.tsx` count cases (10 tests in the two files) |
| sidebar (revert-only) | `isCurrentPath` narrowed to `pathname === href` in `src/lib/navigation.ts` | `app-sidebar.test.tsx > AppSidebar Docentes item > shows the same items on a docente edit page as on the list, with Docentes current and Asignaturas not`, `AppSidebar Asignaturas item > marks exactly one item current on /catalog/docentes/7/edit, and it is Docentes` (and the existing prefix cases; 15 in all) |
| phone pin (revert-only) a | `listDocenteOptions` selects `telefono` | `phone-exposure.test.ts > ... the grupo docente options read selects no phone` |
| phone pin b | `usuarioListColumns` (the Users list) selects `telefono` | `phone-exposure.test.ts > ... the Users list projection selects no phone` |
| phone pin c | the Docentes list page adds `telefono` to its rows | `page.test.tsx > DocentesPage is read-only > renders and passes on no credential field, even if the data layer returned them`, `DocentesPage actions column > delivers no login, phone, hash or Cif to the browser, even with the column on`; `phone-exposure.test.ts > the Docentes list delivers its four fields without the phone`, `... only the edit page, its form and its action carry the phone` |

### Work unit evidence

| Unit | Focused test command and result | Runtime harness | Rollback boundary |
|------|---------------------------------|-----------------|-------------------|
| 6 | `DATABASE_URL=postgres://u:p@localhost:5432/x npx vitest run catalog/docentes app-sidebar catalog/guards catalog-parity access src/i18n auth/permissions`: 21 files, 1569 tests, pass | The list rendered through the REAL `requireCatalogAccess` and `canManageDocentes` on a doubled session: secretaria four columns, administrador and coordinacion three. The list runs end to end only in the system test ST-1 and ST-11 (no database command allowed here) | revert `0e3e3b6`: the column, the prop and two keys; the list returns to read-only |
| 7 | `npx vitest run catalog/docentes catalog/active-toggle catalog/guards catalog/asignaturas catalog/grupos auth/permissions access src/i18n`: 35 files, 2079 tests, pass | The bound controls render over the real `ActiveToggle` and the real catalogs with the actions doubled (the real ones import the database); the actions themselves were proved in slice 2 | revert `8824fa3`: the form, the bound controls, the optional toggle prop and the keys; nothing renders them yet |
| 8 | `npx vitest run catalog/docentes catalog/guards catalog/current-marker app-sidebar catalog-parity route-coverage access-matrix src/i18n navigation`: 25 files, 1692 tests, pass | Access matrix (`access-matrix.pages.test.tsx`: the REAL guard over the seven identities for the new row) and the page rendered over the real form, toggle and catalogs; the page against Postgres only at ST-3 to ST-12 | revert `8d0eb54`: the page, the `page.*` keys, the matrix row and the pins; the Edit link of unit 6 would then lead to a missing route, so revert unit 6 with it |

### Commits

- `0e3e3b6` feat(docentes): add the actions column for the secretaria (7 files, 326 changed lines)
- `8824fa3` feat(docentes): add the docente form and active toggle (8 files, 1372 changed lines)
- `8d0eb54` feat(docentes): add the docente edit page (11 files, 971 changed lines)

### Deviations

1. DM-16 "already active" (the gap left by slice 2). Choice: an optional prop `unchangedText?: Partial<Record<"deactivate" | "reactivate", string>>` on the shared `ActiveToggle`, which uses it for the no-op answer of the intent it submitted and falls back to the shared `refusals.alreadyInactive` / `refusals.unchanged` for a direction left out. The Asignatura and Grupo toggles pass nothing and behave exactly as before (their existing tests are unedited). The docente toggle supplies two docente-specific keys, `catalog.docentes.state.alreadyActive` ("El docente ya estaba activo. No se hizo ningún cambio." / "The teacher was already active. No changes were made.") and `state.alreadyInactive`, so both rows of the DM-16 table have their own text. Both are pinned in `catalog-parity.test.ts` (exact key set, wording per locale, not the shared "no changes" sentence) and in `docente-form.test.tsx` (the toggle shows the right text for each intent). The slice 2 refusal-table row for the shared `alreadyInactive` text stays; its comment now points to the new pin.
2. Existing pins changed minimally: `docentes-table.test.tsx` (`Object.keys(copy.columns)` now lists `actions`); `guards.test.ts` (the page guard is chosen by path with `expectedPageGuard`, the title of the per-page case is now "calls its guard before any other await", a new "calls only its own guard" case, the page list gains the edit page); `route-coverage.test.ts` (`GUARDS` gains `requireDocenteAccess`, the named helper of the new page, as `requireCatalogAccess` is); `current-marker-usage.test.ts` (`BREADCRUMB_PAGES` gains the edit page: the marker is written there once); `catalog-parity.test.ts` (`DOCENTES_KEYS`, the scan list, the DM-16 comment); `app-sidebar.test.tsx` (one path added to the "exactly one item current" table).
3. The shared `ActiveToggle` inline confirmation (title, nothing-deleted line, notice) gained `break-words`, so a long name plus email inside the confirmation does not clip at 320 px (DM-17). A class addition only; the other two toggles render the same text.
4. `DocenteActiveToggle` composes its own `recordLabel` (name with the email in parentheses, the name alone without email) and `notice` (kept sentence plus the count) from `id`, name, email, state and count, instead of the page passing them as strings as the Asignatura page does. The confirmation logic is then tested in unit 7 and the page hands over data only. It uses `useTranslations("catalog.docentes.state")` in a client component.
5. `EditDocenteForm` carries the `key` of `activo` itself (the design says "keyed by `activo` in the page"): no page can forget it, and the lock-after-reactivation case is a unit 7 test. The page test pins the rendered result.
6. The link to the Asignaturas search (`catalogListHref("/catalog/asignaturas", { q: name })`) sits in the State section while `gruposActivos > 0`, not inside the confirmation: the shared toggle's `notice` is a string. The confirmation notice shows the count and the closed-period hint (design: "both say to reassign current grupos and deactivate those of closed periods").
7. The form carries `max-w-xl` and `w-full` itself (the page does not wrap it); the State section keeps `max-w-xl`. The three notices: `correoHint` is the hint of the email field (tied by `aria-describedby`), `correoNote` and the shared `importWins` are paragraphs under the fields. The email input uses `autoComplete="off"` so the browser does not offer the maintainer's own address.
8. Keys: unit 6 adds `columns.actions` and `edit`, unit 7 adds `form.*`, `state.*` and `breadcrumb.*` (the breadcrumb keys are used only by the page of unit 8), unit 8 adds `page.*`, as tasks 3.2, 3.5 and 3.9 split them. `docs/design-system.md` was not edited (no token, radius, size or step was introduced; slice 3 has no docs).
9. A new test file not listed in the tasks holds the phone pin of task 3.8: `src/app/(dashboard)/catalog/docentes/phone-exposure.test.ts` (source-text checks over the list and option readers, the list page and table, and two ratchets over which files may name `telefono`; the Postgres test support under `integration/` is exempt so slice 4's fixtures do not trip it). The rendered side is in the two page tests.
10. New files were created LF and converted to CRLF to match the working tree (prettier `--end-of-line crlf`); the index holds LF (autocrlf).

### Gate results (slice tip `8d0eb54`)

- `npm test` (dummy DB): 400 files, 10893 tests, all pass (299 s). Slice 2 tip was 397 files, 10711 tests: +3 files (`docente-form`, the edit page and `phone-exposure`) and +182 tests.
- `npm run typecheck`: clean.
- `npx eslint src` with the prettier end-of-line rule set to auto: 0 errors, 1 warning (`SidebarGroupLabel` unused in `src/components/app-sidebar.tsx`, not touched by this slice). `npx prettier --check <every file of the slice> --end-of-line auto`: clean.
- `npm run build` (dummy DATABASE_URL and AUTH_SECRET): compiled; the route table lists `/catalog/docentes` and `/catalog/docentes/[id]/edit`.

### Size and stop line

`git diff --numstat b397f74 HEAD -- . ':(exclude)openspec' ':(exclude)docs'`: 2640 added, 29 deleted, 2669 total (planned about 770). Per unit: unit 6 (`0e3e3b6`) 326, unit 7 (`8824fa3`) 1372, unit 8 (`8d0eb54`) 971. Production code is about 520 of those lines (form 179, bound controls 75, page 118, table and page changes 48, toggle 25, catalogs 58 and the matrix row); about 2150 are tests (`docente-form.test.tsx` 786, the edit page test 623, `catalog-parity.test.ts` +261, `page.test.tsx` +152, `docentes-table.test.tsx` +101, `phone-exposure.test.ts` 89, `active-toggle.test.tsx` +59). Over the 1000 stop line. The last boundary under 1000 is after unit 6 (326); unit 7 alone is over it (1372), and units 6 plus 7 are 1698. Unit 8 (971) fits on its own but depends on units 6 and 7. Tests were not trimmed; the cut is left to the orchestrator and the owner.
