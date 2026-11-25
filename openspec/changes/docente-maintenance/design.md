# Design: Docente Maintenance by the Secretaría

Covers RF-12 (a), (b) for docentes; RNF-01, RNF-06 (a), RNF-12, RNF-13 (b).
Decisions D1 to D5 of `proposal.md` are closed. DB schema: NO.

## Technical Approach

Copy the asignatura pattern: guard, lock-free `addressed` pre-check, zod,
`withCatalogWrite`, result switch, revalidate. Three differences: a
secretaria-only guard with no scope, `Usuario` instead of a catalog table, and a
savepoint around the email UPDATE. D5 is a separate audited account creator with
its own short transaction.

## Architecture Decisions

| # | Decision | Rejected | Why |
|---|---|---|---|
| A1 | New guard `requireDocenteAccess()`; no DB read, no scope | `requireCatalogAccess` | It admits administrador and coordinacion and reads the actor before a denial could happen |
| A2 | `addressedRecord(actorId, rawId, read)` in `action-helpers.ts`; `addressed` becomes a wrapper of it | Passing a fake `{ kind: "all" }` scope | A fake scope states something false; the wrapper leaves the six existing callers untouched. `actionOutcomes`, `fieldErrors` and `revalidateRecord` are reused as they are |
| A3 | New module `src/lib/data/docentes.ts` | Growing `users.ts` (621 lines) | One responsibility; `users.ts` keeps account lists and sign-in reads |
| A4 | UPDATE runs in a savepoint (`tx.transaction`) and `23505` inside it becomes `correo_taken` | `try/catch` on the same handle, as `createGrupo` | Verified in `postgres/src/index.js` (`begin` > `scope`): any failed query of a scope is kept in `uncaughtError` and rethrown when the scope ends, even if the caller caught it. Catching on the same handle would surface as "unexpected". Drizzle maps a nested `transaction` to `client.savepoint`, whose scope has its own `uncaughtError` |
| A5 | New codes `usuario.desactivado`, `usuario.reactivado` | `usuario.actualizado` with `campos: ["activo"]` | Same shape as `asignatura.*` and `grupo.*`; a toggle is found by action without reading JSON; not confusable with `usuario.cancelado` (retention). `Accion` is `varchar(60)` with no CHECK: no migration. Cost: two pinned lists in `types.test.ts` |
| A6 | `UserChangedPayload = CatalogRecordPayload<AuditableUserField> & { rol }` | Optional digest | `AuditOrigin` makes a half-filled manual payload a compile error. Emitted import payloads stay equal key by key (`campos`, `rol`, `origen`, `importacionSha256`); nothing in `src` reads stored `Datos` |
| A7 | D5: new `createStaffUsuario(actorId, data)`; `createUsuario` unchanged and kept for self-registration only | Optional actor on `createUsuario` | An optional actor lets a staff caller silently skip the audit row |
| A8 | Self-registration is NOT audited | Auditing it | D5 names `/users/new` only. `audit-log` requires the actor to be an authenticated session user: none exists at that insert, and the system actor is reserved for retention. A student account is neither a request nor a catalog record (RNF-06 a) |
| A9 | D5 does not take the catalog lock | Taking it | A new account is active and has no grupo, so it cannot break the invariant. Every application writer stores the email in lower case, so `Usuario_Correo_unique` closes concurrent duplicates. The lock would add a "busy" outcome the form does not have |
| A10 | Confirmation inline (`confirmIn` default), not a modal | `confirmIn="dialog"` | `docs/design-system.md` §5 "Two-step confirmation (inline)"; the dialog variant is for controls inside a table cell |
| A11 | List action is an Edit link; the toggle lives on the edit page | Toggle in the row | Same as asignaturas; `guards.test.ts` pins list pages as free of mutating controls |
| A12 | No session invalidation | Per-request `activo` read in `dal.ts` | Out of scope; a docente opens only home, profile and change-password. Recorded residual |

## Access

`src/lib/auth/permissions.ts`:

```ts
export function canManageDocentes(rol: RolUsuario | undefined): boolean {
  return canAssignRole(rol, "docente");
}
export const rolesQueGestionanDocentes: RolUsuario[] =
  rolesUsuario.filter(canManageDocentes);
```

`src/lib/auth/docente-access.ts` (`server-only`):

```ts
export type DocenteAccess = { session: SessionPayload; actorId: number };
export async function requireDocenteAccess(): Promise<DocenteAccess>;
```

`requireRole(...rolesQueGestionanDocentes)` is the first statement, then the
existing subject check (`/^[1-9]\d*$/`, safe integer, throw). Denied callers get
`/login`, `/change-password` or `/denied` with no body read and no data read.
The list page keeps `requireCatalogAccess()` and passes
`canEdit={canManageDocentes(session.rol)}`.

## Data layer: `src/lib/data/docentes.ts`

```ts
export type DocenteDetail = {
  id: number; nombreCompleto: string; correo: string | null;
  telefono: string | null; activo: boolean; gruposActivos: number;
};
export async function getDocenteById(id: number): Promise<DocenteDetail | null>;
export async function updateDocente(
  tx: Transaction, id: number,
  input: { nombreCompleto: string; correo: string; telefono: string | null },
): Promise<DocenteWriteResult>;
export async function setDocenteActivo(
  tx: Transaction, id: number, activo: boolean,
): Promise<DocenteActiveResult>;
```

`src/lib/catalog/types.ts`:

```ts
export type DocenteWriteResult =
  | { kind: "updated"; id: number; campos: readonly AuditableUserField[] }
  | { kind: "unchanged"; id: number }
  | { kind: "not_found" } | { kind: "inactive" } | { kind: "correo_taken" };
export type DocenteActiveResult =
  | { kind: "changed"; id: number; activo: boolean }
  | { kind: "unchanged"; id: number }
  | { kind: "not_found" } | { kind: "has_active_groups"; count: number };
```

**Read by id.** `Usuario` inner join `Rol` where `Usuario.Id = $1 and Rol.Codigo
= 'docente'`, projecting only the six fields; `gruposActivos` is the subquery
`count(*) from Grupo where DocenteId = Usuario.Id and Activo`. A missing id and
another role both give `null`. Fail loud.

**`updateDocente`**, in order:

1. Read the row on `tx` with the role predicate (also `rolId`). None:
   `not_found`. Inactive: `inactive`.
2. `changedFields(["nombreCompleto", "correo", "telefono"], row, input)`; empty:
   `unchanged`. No lookup is made in either case.
3. Only if `correo` changed:
   `select Id from Usuario where lower(Correo) = $correo and Id <> $id limit 1`
   (no role or state filter). Found: `correo_taken`.
4. Savepoint: `update Usuario set <changed fields only> where Id = $id and RolId
   = $rolId returning Id`. `sqlStateOf(error) === "23505"`: `correo_taken`. Any
   other error propagates (a `55P03` while waiting on an uncommitted duplicate
   becomes busy). Zero rows: `not_found`.

`Login`, `HashClave`, `RolId`, `Activo`, `DebeCambiarClave` are never in the SET.
A stored mixed-case email is normalised by the next save and reported as
`correo`. An untouched email with a legacy case-duplicate does not block a name
or phone edit.

**`setDocenteActivo`**: same scoped read; same state: `unchanged`. To deactivate:
`select count(*) from Grupo where DocenteId = $id and Activo` (served by
`IX_Grupo_Docente`); more than zero: `has_active_groups`. Then `update Usuario
set Activo = $activo where Id = $id and RolId = $rolId`. Reactivation has no
precondition and touches no grupo (A2 of the proposal).

**Which grupos count**: every grupo with `Activo`, of any period and whatever the
state of its asignatura. Reactivating an asignatura has no precondition and does
not touch grupos, so ignoring grupos under an inactive asignatura could later
offer a class of an inactive docente. Deactivating a grupo is always allowed, so
the block always has a way out.

### Why count-then-deactivate cannot race

Writers of `Grupo.Activo` or `Grupo.DocenteId` in `src` are `createGrupo`,
`updateGrupo`, `setGrupoActivo` (all through `withCatalogWrite`) and
`runImportApply`. All take `pg_advisory_xact_lock(5005001)` before their first
read; the import re-reads the snapshot and re-plans after it. Under READ
COMMITTED each statement after the lock sees what the previous holder committed,
so one of the two always observes the other:

```
Secretary A (deactivate)           Secretary B (create grupo / import)
  BEGIN; lock ---------------- held
  read docente; count = 0            BEGIN; lock ... waits (5 s, then busy)
  UPDATE Activo=false; audit
  COMMIT (lock released) ----------> lock acquired
                                     read docente: inactive
                                     -> docente_unavailable / docente.inactive
(reverse order: B commits first, A counts 1 -> has_active_groups)
```

`/users/new` and `/register` take no lock: they only insert accounts with no
grupo. For emails the lookup plus the unique constraint closes both orders. No
deadlock: they never wait for the advisory lock, so no wait cycle exists.

## Audit

- `AUDIT_ACTIONS` gains the two codes of A5 (49 in total). They join the
  `usuario.creado | usuario.actualizado` union member (entity `Usuario`).
- `accountCreatedEvent`, `accountUpdatedEvent`: the parameter
  `importacionSha256: string` becomes `origin: AuditOrigin`, spread into `datos`.
  `buildAuditEvents` passes `{ origen: "importacion", importacionSha256 }`.
- New `accountActiveChangedEvent({ usuarioId, rol, activo, origin })`, with
  `campos: ["activo"]`.
- New `docenteWriteEvents(r: DocenteWriteResult | DocenteActiveResult)`: one
  event for `updated` and `changed`, `[]` otherwise, exhaustive `never` default.
- A created account reports the closed list `AUDITABLE_USER_FIELDS` (existing
  reading of "field names only"). No value, name, email or phone can be passed.

## D5: audited staff creation

```ts
// src/lib/data/users.ts
export async function createStaffUsuario(
  actorId: number, data: NuevoUsuarioConRol,
): Promise<UsuarioConRol>;
```

`getRolIdByCodigo` runs BEFORE the transaction, so `RolDesconocidoError` is
thrown as today and no second pool connection is taken while one is held. Then
`db.transaction`: insert through a private `insertUsuario(exec, data, rolId)`
shared with `createUsuario`, then `insertAuditEvents(tx, actorId,
[accountCreatedEvent({ usuarioId, rol, origin: MANUAL_ORIGIN })])` as the last
statement. `debeCambiarClave` and `facultadId` behave as today.

`createStaffAction`: all checks stay in order; only the call changes
(`Number(session.sub)`, as `getUserFacultadId` already does). The catch stays:
rethrow `RolDesconocidoError`, anything else is `errors.duplicate`. Because a
failed audit insert now also lands there, a non-`23505` failure writes one
sanitised line (`usuario.create.failed`, actor, error name, SQLSTATE; no message
or parameter). User-visible behaviour does not change.

Callers of `createUsuario` checked: `users/new/actions.ts` (moves) and
`register/actions.ts` (stays, A8). The import uses `createUsuariosBulk`.

## Validation: `src/lib/validations/docente.ts`

`docenteUpdateSchema`: `nombreCompleto: requiredString("nombre", NOMBRE_MAX)`;
`correo`: string, trim, lower case, min 1 `correo.required`, email
`correo.invalid`, max 160 `correo.tooLong`; `telefono`: absent or blank gives
`null`, else trim and max 30 `telefono.tooLong`. Unknown keys (`login`, `rol`,
`activo`) are stripped. `CATALOG_FIELD_ERROR_KEYS` gains those four keys;
`correo.taken` is emitted by the action (parity list `DUPLICATE_FIELD_ERRORS`).

## Actions: `src/app/(dashboard)/catalog/docentes/actions.ts`

| Step | `updateDocenteAction(_prev: CatalogFormState, formData)` | `setDocenteActivoAction(_prev: ActiveToggleState, formData)` |
|---|---|---|
| 1 | `requireDocenteAccess()` (first await, nothing read before) | same |
| 2 | translations | translations, then closed `intent`, else `gone` |
| 3 | `addressedRecord(actorId, formData.get("id"), getDocenteById)` | same |
| 4 | schema: `invalid` + `fieldErrors` | none |
| 5 | `withCatalogWrite(actorId, tx => updateDocente(...), docenteWriteEvents)` | `setDocenteActivo`, same mapper |
| 6 | `updated`: revalidate, `redirect("/catalog/docentes")`; `unchanged`, `inactive` as named; `not_found`: `gone`; `correo_taken`: `invalid` on `correo` | `changed`: revalidate, `done`; `unchanged`; `not_found`: `gone`; `has_active_groups`: `error` with the count |
| throw | `failure()`: busy or `docentes.errors.unexpected` | same |

`redirect` stays outside any `try`. Revalidation (local helper, both actions),
checked against `revalidatePath.md` of the installed Next (a pattern needs
`type`):

- `revalidateRecord("/catalog/docentes", id)`, `revalidatePath("/users")`,
  `revalidatePath("/catalog/asignaturas")`
- with `"page"`: `/catalog/asignaturas/[id]/edit`,
  `/catalog/asignaturas/[id]/grupos/new`,
  `/catalog/asignaturas/[id]/grupos/[grupoId]/edit`

## Pages and components

| File | Content |
|---|---|
| `catalog/docentes/[id]/edit/page.tsx` (new) | Guard first; `parseRecordId`; malformed, missing and non-docente ids share one `notFound()` (existing `catalog/not-found.tsx`). Breadcrumb with `is-current`, `PageHeader`, form, State section |
| `catalog/docentes/docente-form.tsx` (new) | Modelled on `asignatura-form.tsx`: `onSubmit` + hand dispatch, hidden `id`, `Input` types `text`, `email`, `tel`, `readOnly` when locked, polite live region, `importWins` note. Keyed by `activo` in the page, so a refused edit does not stay locked after a reactivation |
| `catalog/docentes/bound-controls.tsx` (new) | `EditDocenteForm`, `DocenteActiveToggle` |
| `docentes-table.tsx`, `page.tsx` | `canEdit?: boolean` (default false): appends the non-sortable `actions` column with the Edit link, `aria-label` "Editar {nombre}". Other roles keep exactly three columns |

Confirmation (DM-7): `recordLabel` is the name with the email in parentheses (the
name alone when there is no email); the existing `nothingDeleted` line stays, and
`notice` adds that grupos and remissions are kept and the number of active grupos.

States: **inactive**: fields read-only, submit replaced by the reactivate hint.
**Block**: the confirmation's `notice` shows the count read with the page, the
server refusal shows the count read under the lock; both say to reassign current
grupos and deactivate those of closed periods. A link to
`catalogListHref("/catalog/asignaturas", { q: nombreCompleto })` appears while
`gruposActivos > 0`. **Degraded**: the list keeps `DegradedAlert`; the edit read
throws to the route error screen, as every catalog edit page.

Accessibility: `FormField` ties each error by `aria-describedby` with
`role="alert"`; focus returns to the toggle's first step after cancel or answer
(existing `ActiveToggle`); one `h1`, targets `lg` (44 px). 360 px: single column
(`max-w-xl`, `flex-wrap`), `break-words` on name and email, the list scrolls
inside its card. Existing tokens only.

Copy, in both catalogs under `catalog.docentes`: `columns.actions`, `edit`,
`errors.{unexpected,activeGrupos}`,
`form.{nombreLabel,correoLabel,correoHint,correoNote,telefonoLabel,submitSave,submitting}`,
`page.{editTitle,editSubtitle,reactivateHint}`, `breadcrumb.{label,edit}`,
`state.{title,kept,activeGroups,findGroups}`. The three notices of DM-16:
`correoHint` (future remissions go to this address and the docente signs in with
it; the old one stops), `correoNote` (Users keeps showing the earlier login, the
earlier email stays reserved and the import workbook must be updated) and the
existing `importWins`.
`activeGrupos` and `activeGroups` are ICU plurals on `count`.

## Import rule D3: `src/lib/import/plan.ts`

`DocenteIdentity` gains `activo: boolean` (`true` for a new docente,
`existing.activo` in Stage B and in the Stage C fallback). In Stage C, right
after `docente.unresolved` and before the duplicate key check:

```ts
if (!docente.activo) {
  errors.push({ sheet: "Grupos", row: r.row, reason: "docente.inactive", value: CorreoDocente });
  counts.Grupo.error++;
  continue;
}
```

It applies to rows that would create, update, reactivate or leave the grupo
unchanged. Stage B does not change: name and phone are still updated and `activo`
is never written. The preview shows the row error with no other work; the apply
re-plans under the lock and throws `ImportRejectedError`. `apply.ts` does not
change. Copy: `catalog.import.reasons.docente.inactive` (reactivate the docente,
name another one, or remove the row); `ROW_REASONS` gains the key.

## File Changes

| File | Action |
|---|---|
| `src/lib/auth/permissions.ts`, `src/lib/auth/docente-access.ts` | Modify / Create |
| `src/lib/audit/{types,events}.ts`, `src/lib/catalog/{types,action-helpers}.ts` | Modify |
| `src/lib/data/docentes.ts`, `src/lib/validations/docente.ts` | Create |
| `src/lib/data/users.ts`, `src/app/(dashboard)/users/new/actions.ts`, `src/lib/validations/catalog.ts` | Modify |
| `src/app/(dashboard)/catalog/docentes/{actions.ts,bound-controls.tsx,docente-form.tsx,[id]/edit/page.tsx}` | Create |
| `src/app/(dashboard)/catalog/docentes/{page,docentes-table}.tsx`, `src/lib/import/plan.ts`, `i18n/{es,en}.json` | Modify |
| `src/test/access/matrix-table.ts`, `src/lib/data/integration/fixtures.ts` | Modify |
| `docs/{roadmap,requirements}.md` | Modify |

## Testing Strategy (strict TDD: each test fails first)

| Layer | Files | What |
|---|---|---|
| Unit | `permissions.test.ts`, `docente-access.test.ts` (new) | Role table; denial makes no read; malformed subject throws |
| Unit | `audit/{types,events}.test.ts` | Action set; manual and import payload keys; import payload unchanged; one event or none |
| Unit | `validations/docente.test.ts`, `data/docentes.test.ts` (new), `data/users.test.ts` | SQL text and parameters, SET keys, order of checks, savepoint mapping; D5 order: role lookup, insert, audit |
| Action | `docentes/actions.test.ts` (new), `users/new/actions.test.ts`, `catalog/audit-leak.test.ts` | Every outcome, revalidated paths, no value in audit or logs. `expectManualShape` allows `rol` for `Usuario` events |
| UI | `docente-form.test.tsx`, `[id]/edit/page.test.tsx` (new), `docentes-table.test.tsx`, `page.test.tsx` | Locked, block, not-found, cancel changes nothing; column for `secretaria` only |
| Import | `import/plan.test.ts` | Rule over create, update, reactivate, unchanged; new docente passes; docente never reactivated |
| Matrix | `matrix-table.ts` | Page row and actions row with `SECRETARIA`, each in the slice that adds its file (ratchet); `docentes/page.tsx` stays `STAFF` |

Pins changed on purpose: `catalog/guards.test.ts` (page list, `ACTION_SEGMENTS`
and module list gain docentes; the expected guard is chosen per path, and the
docente edit page and actions must not contain `requireCatalogAccess(`),
`types.test.ts`, `catalog-parity.test.ts` (`DOCENTES_KEYS`, field errors,
`ROW_REASONS`, a scan of the new action, page and form sources),
`accountCreatedEvent`/`accountUpdatedEvent` calls in `events.test.ts`.

### Postgres suite: `src/lib/data/integration/docente-maintenance.integration.test.ts`

Same gate as the other suites. Fixtures gain `addDocente({ correo?, activo?,
telefono? })`, `addSubject()`, `docenteId?` in `addGroup`, and `adopt` for grupos
and accounts created by the code under test. `cleanup()` deletes grupos,
asignaturas, docentes and created accounts; the secretaria actor, her facultad
and the append-only audit rows stay (FK), as in the other suites.

1. Edit: fields stored, `Login` and `HashClave` identical, one row;
   `findLoginAccount` finds the new email and not the old one.
2. Mixed-case duplicate against student, staff and inactive rows: `correo_taken`,
   no row, data unchanged.
3. `23505` path on two connections: connection 1 inserts the email and holds its
   transaction; connection 2 runs the edit and blocks; 1 commits; 2 returns
   `correo_taken` (proves A4) and leaves no audit row.
4. Block with count (grupo of another period, grupo under an inactive
   asignatura); toggle both ways; one row each; none on no-op or refusal.
5. Non-docente id: `null` and `not_found`.
6. Rollback: an actor id that does not exist makes the audit insert fail with a
   real FK error; `updateDocente`, `setDocenteActivo` and `createStaffUsuario`
   leave no change.
7. Concurrency, table-driven over grupo create, docente change and grupo
   reactivation, several rounds: a third connection holds the lock, both writers
   start, the lock is released. Exactly one wins and no active grupo has an
   inactive docente.
8. D5: one `usuario.creado` per staff role, origin `manual`, no value in it.

9. Import confirmed after the deactivation: `runImportApply` with a Grupos row of
   an inactive docente throws `ImportRejectedError` and leaves every row count
   unchanged.

The suite never applies an import with effect: it would deactivate every absent
grupo of the branch. The applies with effect (name and phone of an inactive docente
updated without reactivating it, the import wins, the old and the new email in a
workbook, deactivation refused after an import) are the last step of the system
run on the same disposable branch, after everything else.

## Threat Matrix

Shell, subprocess, VCS, executable-file and process boundaries: N/A, none is
touched. Application boundaries, all with RED tests: direct POST by another role
(guard before body read); foreign id of another role (role predicate in read and
UPDATE); mass assignment of `login`, `rol`, `activo` (schema strips, SET pinned);
actor forging (session only); mutation by GET (guards test).

## Migration / Rollout

No migration, dependency or environment variable. Tracker
`feat/docente-maintenance`, stacked PRs, one production deploy.

| PR | Content | Est. lines |
|---|---|---|
| 1 | Audit types and builders, catalog types, validation and field copy, `data/docentes.ts` and unit tests (~710); Postgres suite and fixtures (~250) | ~960 |
| 2 | Guard, helper, actions, matrix actions row, guards and leak pins, action copy (~700); D5 with its tests and integration cases (~200) | ~900 |
| 3 | Edit page, form, toggle, list column, matrix page row, copy (~770); import rule D3 and docs (~160) | ~930 |

The estimates are by analogy. If PR 1 measures over 1000, the Postgres suite
becomes its own test-only PR; if PR 3 does, D3 and docs do. Nothing is reachable
by a user until PR 3.

**Merge gate** (before tracker to `main`, which deploys):

1. Suite and system test RF-12 green on a fresh disposable branch.
2. Read-only on production, result must be 0:

```sql
select count(*) from "Grupo" g join "Usuario" u on u."Id" = g."DocenteId"
where g."Activo" and not u."Activo";
```

If it is not 0, the tracker does not merge. The owner gets the grupo ids (no
personal data) and each grupo is reassigned or deactivated through the existing
screens, which already allow both; then the count is repeated. No direct SQL
write. Informative, not blocking: the number of `lower("Correo")` values that
appear more than once.

**Rollback**: revert PRs in reverse order or the tracker merge. Before a full
revert, reactivate docentes deactivated by mistake. Reverting only D3 reopens
A-C12. Audit rows remain; no reader enumerates `Accion`.

## Residual risks

- Emails of 61 to 160 characters are accepted here but a workbook row with one
  fails with `correo.loginTooLong`, because Stage B derives the Login before it
  matches the account. Loud; no data risk.
- The same-handle `23505` catches in `createAsignatura` and `createGrupo` cannot
  return their result, for the reason in A4. The lock and the prior lookup make
  them unreachable in practice. Not changed here.
- Live session of a deactivated docente (A12); stale `Login`.

## Open Questions

None blocks. Cross-checked with the specs on 2026-11-25; the five differences found
(delivered count, confirmation copy, three notices, unchanged email, proof of the
import scenarios) are resolved in both files.
