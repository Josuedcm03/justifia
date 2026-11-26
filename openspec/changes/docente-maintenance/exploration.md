# Exploration: docente-maintenance (RF-12 a for docentes)

All paths are relative to the repository root (c5ea22e). Line numbers come from the on-disk files I read. Nothing was written, no DB command was run, and no `.env` was read.

### Current State

**1. Data model**
- **Columns.** `Usuario` is `src/db/schema.ts:118-159`: `Login` varchar(60) unique (124), `HashClave` (125), `RolId` (126), `NombreCompleto` (129), `Correo` varchar(160) unique (130), `Telefono` (131), `Cif` unique (132), `CarreraId` (133), `FacultadId` (136), `Activo` (139), `DebeCambiarClave` (140), `CanceladoEn` (146).
- **Checks.** `CK_Usuario_Ambito` (149-152) and `CK_Usuario_Cancelado` (154-157) exist. `CK_Usuario_Cancelado` requires an inactive account with null email, phone and CIF, and only the retention run sets it.
- **Retention.** The retention run only targets students (`src/lib/data/retention.ts:72-80`), so docentes are never cancelled.
- **Email uniqueness is case-sensitive.** `Usuario_Correo_unique` is a plain constraint (`drizzle/0003_late_groot.sql:37`). There is no `lower()` index anywhere in `drizzle/`. A case-insensitive duplicate check is therefore done in code (`getUsuarioByCorreo`, `src/lib/data/users.ts:298-309`, and `src/app/(dashboard)/users/new/actions.ts:66-68`). That function is not transaction-aware and does not exclude the current user.
- **Login is the whole normalized email at creation** (`src/lib/import/normalize.ts:19-27`, `src/app/(dashboard)/users/new/actions.ts:58-61`).
- **A docente has no scope.**
  - The staff form sets `carreraId` only for coordinacion and `facultadId` only for secretaria (`users/new/actions.ts:70-93, 106-107`).
  - The import inserts docentes with no carrera or facultad (`src/lib/import/apply.ts:143-150`).
  - A secretary of any facultad can therefore see and edit every docente. The Docentes list is already unscoped (`catalog/docentes/page.tsx:19-21`).
- **Grupo link.** `Grupo.DocenteId` is a NOT NULL FK to `usuario` (`schema.ts:208-210`) with `IX_Grupo_Docente` (222).
- **Rules for an inactive docente today.**
  - Creating a grupo with an inactive docente is refused (`src/lib/data/grupos.ts:136-144`).
  - Changing a grupo's docente and reactivating a grupo both run `unavailableParent` (183-204, 237-245, 282-290).
  - An edit that leaves the docente unchanged is allowed (210-211).
  - Deactivating a grupo is always free (265-299).
  - The grupo form already handles a current docente who has left the options list (`grupo-form.tsx:101-106`).
  - `listDocenteOptions` filters `activo = true` (`users.ts:406-420`).

**2. Consumers of docente data**

| Consumer | Behaviour today | Evidence |
|---|---|---|
| Grupo form options | Active docentes only, with `correo` shown to tell homonyms apart. | `users.ts:406-420` |
| Remission (RF-09) | Recipients and address are read live at approval, then snapshotted into `remision` (id, name, email). There is no `activo` filter, so an inactive docente still gets a remission. | `solicitud-clases.ts:81-119`, `src/lib/remission/recipients.ts:35-59`, `src/lib/data/remision.ts:52-54` |
| Remission spec | "Later email change: the remission still targets the email recorded at approval." An email edit must not touch existing remissions. | `openspec/specs/teacher-remission/spec.md:36-39` |
| Remission resend | Reads the live email only when the snapshot is null, which is the `sin_correo` case. | `src/lib/data/remission-dispatch.ts:107-116`, `remision.ts:445-454` |
| Absence reports and coordination queue | Use the `remision` / `reporteInasistencia` snapshot, not the live user. | `src/lib/data/solicitud-escalation.ts:274-302`, `src/lib/data/coordination-queue.ts:95,198` |
| Review screens, reports, student enrollment | Join `usuario` live for the name, with no `activo` filter. A rename shows immediately. | `solicitud-clases.ts:33-72`, `src/lib/data/report-requests.ts:122-160`, `src/lib/data/report-rankings.ts:49`, `src/lib/data/enrollment.ts:38-57` |
| Student "offer" | A class is offered when the inscripcion, grupo and asignatura are active. `docente.activo` is not consulted. | `enrollment.ts:26-32`, `src/lib/data/catalog.ts:111-136` |
| `/users` list | The secretary sees only docentes. It searches name, login and email. | `users.ts:164-187`, `src/lib/auth/permissions.ts:89-95` |
| Dashboard stats | Count all and active users. They change by 1 per toggle, which is trivial. | `users.ts:269-279` |
| Import identity | Matches by normalized email, regardless of `activo`. | `src/lib/import/plan.ts:169-176, 202-212` |
| Import update | Writes only `nombreCompleto` and `telefono`. It never writes `activo`, `login` or `correo`, so an inactive docente stays inactive. | `plan.ts:253-276`, `apply.ts:164-171` |
| Import grupo rows | Resolve any existing docente, active or not. This is the known gap A-C12. | `plan.ts:353-360`, `catalog-management/spec.md:1778` |
| Import concurrency | `runImportApply` re-plans under the catalog lock, so it serializes with manual writes. | `apply.ts:344-380` |

- **Import after an email edit.** If `Login` is left as the old email, re-importing the old email gives a loud row error: `existing` is undefined, then `login.collision` (`plan.ts:228-241`). It does not silently create a duplicate docente. If `Login` followed the email, the old email would create a new account with a temporary password.
- **Sign-in.**
  - `findLoginAccount` matches `lower(Correo)` for any role and returns a row only if exactly one matches (`users.ts:339-363`).
  - Inactive accounts get the generic error after a dummy-hash check (`src/app/(auth)/login/actions.ts:33-41`).
  - The new email works immediately, and the old one stops working.
- **Sessions are stateless JWTs** of 8 hours or 30 days (`src/lib/auth/session.ts:48-57`, `cookies.ts:13-17`). `dal.ts:14-39` never re-checks `activo`. A deactivated docente keeps their session until it expires.
- **What a docente can open.** Only home, profile and change-password (`src/test/access/matrix-table.ts:51-52`, `src/lib/navigation.ts:59-136`). The residual risk of a live session is low for docentes.
- **Login must not follow the email.** The session `login` claim is the lookup key for `/profile` (`profile/page.tsx:38`) and `/change-password` (`change-password/actions.ts:49`). Rewriting `Login` would break the live sessions of an edited docente.
- **Credentials.**
  - Staff-created docentes get a password chosen by the secretary and `DebeCambiarClave = false` (`users/new/actions.ts:95-108`).
  - Imported docentes get a temporary password and `DebeCambiarClave = true` (`users.ts:600`).
  - Password reset is not part of RF-12 and is out of scope.

**3. Patterns to copy**
- **Asignatura actions** (`catalog/asignaturas/actions.ts`): `updateAsignaturaAction` (105-165) and `setAsignaturaActivoAction` (167-220).
  - Guard, then `addressed` pre-check, then zod, then `withCatalogWrite`, then a result `switch`.
  - Deactivation uses a closed `intent` field.
  - The toggle result is `done`, `unchanged`, `gone` or `error`.
  - `revalidateRecord` runs on success.
- **Data functions** (`src/lib/data/asignaturas.ts`):
  - `getAsignaturaById` (253-270).
  - `readScopedRow` (387-400).
  - `updateAsignatura` (408-448): the diff runs inside the transaction via `changedFields` (`src/lib/audit/diff.ts`); an inactive row is refused; no change returns `unchanged`.
  - `setAsignaturaActivo` (458-482): counts active grupos and returns `has_active_groups` (471-472).
- **Lock** (`src/lib/data/catalog-write.ts:18-44, 88-110`): one advisory lock, a 5s `lock_timeout`, `55P03` becomes `CatalogBusyError`, and the audit insert is the last statement in the same transaction.
- **Helpers** (`src/lib/catalog/action-helpers.ts`): `actionOutcomes` (37-51), `addressed` (62-77), `revalidateRecord` (80-83), `fieldErrors` (20-30).
- **UI.**
  - Shared `catalog/active-toggle.tsx` (`confirmIn="dialog"` or inline, `notice` prop).
  - `asignaturas/bound-controls.tsx`, `asignatura-form.tsx`, and `[id]/edit/page.tsx` with a state section holding the toggle.
  - The edit form is read-only while the record is inactive.
- **Audit builders** (`src/lib/audit/events.ts`):
  - `asignaturaUpdatedEvent` (737-748), `asignaturaActiveChangedEvent` (750-761), and the result-to-events mapper `asignaturaWriteEvents` (804-840).
  - `MANUAL_ORIGIN` (721) and `AuditOrigin` (`types.ts:361-367`).
- **Enrollment pattern** (`src/lib/auth/enrollment-access.ts:25-40`): a secretary-only guard that runs `requireRole` first. `src/app/(dashboard)/catalog/inscripciones/actions.ts:47-111` binds the id as an argument.
- **Existing audit actions.**
  - `usuario.creado`, `usuario.actualizado` and `usuario.cancelado` exist (`types.ts:23-71`).
  - `AUDITABLE_USER_FIELDS` (116-125) already holds `nombreCompleto`, `correo`, `telefono` and `activo`.
  - `UserChangedPayload` (140-146) is import-only (`origen: "importacion"`, required `importacionSha256`), so it must widen to `AuditOrigin`.
- **No migration for new action codes.** The only constraint on `EventoAuditoria` is `CK_EventoAuditoria_Entidad`, which requires `EntidadId` when the entity is `Usuario` (`src/db/audit-schema.ts:62-65`, `drizzle/0004_audit_log.sql:16`). `Accion` and `EntidadTipo` have no CHECK. `Usuario` is already an entity type.
- **Test files to mirror:** `asignaturas/actions.test.ts` (describes at 114, 359, 642), `src/lib/data/asignaturas.test.ts` (714, 829, 981), `asignatura-form.test.tsx`, `[id]/edit/page.test.tsx`, `catalog/active-toggle.test.tsx`, `catalog/audit-leak.test.ts`.

**4. Who may do it**
- **`canManageCatalog`** equals `canCreateUsers`, so it admits administrador, coordinacion and secretaria (`permissions.ts:33-35, 65-67`).
- **`rolesAsignables`** is `administrador → [coordinacion]`, `coordinacion → [secretaria]`, `secretaria → [docente]` (13-19).
- **`canImportCatalog`** is `canAssignRole(rol, "docente")`, which means secretaria only (52-54).
- **`canManageEnrollments`** is secretaria only (145-154).
- **`requireCatalogAccess`** (`src/lib/auth/catalog-access.ts:23-34`) admits all staff and reads the actor from the DB after `requireRole`. Using it would let coordinacion past the first guard and read data before any denial. A secretary-only guard like `requireEnrollmentAccess` avoids that.
- **Spec text that pins read-only (will change):**
  - `catalog-management/spec.md:9-16`: the module "also shows a read-only list of docentes that links to the users module".
  - CM-ACC-1 (32-56): Docentes is "list" only.
  - CM-LST-1 (855-862): "read-only ... exactly three columns".
  - Scenarios at 906-911 ("no create, edit or deactivate control") and 927-935 ("no action column").
  - CM-NAV-1 (1073-1131).
  - A-DOC-FIELDS (1757-1759).
  - A-GRP-4 (1742-1747) assumed a users-module reactivation "which does not exist yet".
  - `staff-account-creation/spec.md:258`: "no edit-user screen".
- **Roadmap** (`docs/roadmap.md:45-47`, `157-160`): the gap is explicit, and the decision on who may maintain docentes is still open.
- **`route-access-coverage` (RAC-1, RAC-4, RAC-5):**
  - Every new `page.tsx` and every `"use server"` file needs a sibling test.
  - `src/test/access/matrix-table.ts` must gain a row per entry point. The matrix ratchets table against tree in both directions.

**5. Deactivation semantics**
- **What "deja de ofrecerse" means for a docente.** The only offer surface is the grupo form options, which is already enforced. A student's request offer ignores `docente.activo` (`enrollment.ts:26-32`). Allowing deactivation while active grupos exist would leave classes offered to students with an inactive docente, which breaks RF-12 (b).
- **Block (recommended).** Mirror `setAsignaturaActivo` and return `has_active_groups` with a count, with the notice in the confirmation step. Together with the existing create, change and reactivate refusals, the invariant "an active grupo has an active docente" would hold, except for the import gap A-C12.
  - Friction: the secretary must first deactivate each grupo from the asignatura pages.
- **Warn and allow.** Leaves active grupos with an inactive docente. This contradicts RF-12 (b) and the A-GRP-4 philosophy.
- **Cascade.** Deactivating the docente also deactivates their active grupos.
  - It has no precedent: asignatura deactivation never cascades.
  - It is not cleanly reversible, because it would need tracking of which grupos were cascaded.
  - It silently drops students' effective enrollments.
  - Rejected.
- **Existing requests and remissions.**
  - Presented or approved requests keep their `SolicitudAsignatura` rows. Remissions are snapshots and the dispatcher never reads `usuario.activo`.
  - RN-18 and RN-19 are therefore unaffected by deactivation.
  - Pending remissions of a deactivated docente still send to the snapshot address.

### Affected Areas
- `src/lib/auth/permissions.ts`: new predicate and role list derived from `canAssignRole(rol, "docente")`, no second hand-written list.
- `src/lib/auth/docente-access.ts` (new): secretary-only guard with no scope.
- `src/lib/data/users.ts` or a new `src/lib/data/docentes.ts`: read by id; `updateDocente` and `setDocenteActivo` taking `tx`; email uniqueness excluding self, case-insensitive, any role. Prefer a new file, since `users.ts` is already 621 lines.
- `src/lib/audit/types.ts` and `events.ts`: widen `UserChangedPayload` to `AuditOrigin`; add builders and a result-to-events mapper.
- `src/lib/catalog/types.ts`: `DocenteWriteResult`, `DocenteActiveResult` (add `has_active_groups`).
- `src/lib/validations/` plus `catalog.ts` error keys: `docenteUpdateSchema` (name, email lower-cased and trimmed, max 160, phone max 30).
- `src/app/(dashboard)/catalog/docentes/`: new `actions.ts` and `bound-controls.tsx`, new `[id]/edit/page.tsx` and a docente form, and an action column in `docentes-table.tsx` that only the secretary sees.
- `i18n/es.json` and `i18n/en.json` (`catalog.docentes`, `catalog.shared`): the parity test scans action source for key literals (`src/i18n/catalog-parity.test.ts`).
- `src/lib/import/plan.ts` (optional slice): a `docente.inactive` row error for grupo rows that name an inactive docente.
- `openspec/specs/catalog-management/spec.md`: MODIFIED CM-ACC-1, CM-LST-1, the Docentes scenarios, A-DOC-FIELDS, A-GRP-4 and the Purpose paragraph. Also an `audit-log` delta, a delta for `staff-account-creation` and `users-listing` where they say "no edit", and a new `docente-maintenance` capability spec.

**Tests that pin current behaviour and will change on purpose**
- `catalog/docentes/page.test.tsx:349-362` ("no actions column") and `459-490` (the href regex `/new|edit|create|deactivate|reactivate|toggle/i`).
- `catalog/docentes/docentes-table.test.tsx:182-197` (`queryByRole("link")` is absent).
- `catalog/guards.test.ts`:
  - the exact page list (40-56);
  - `ACTION_SEGMENTS` (113);
  - the exact actions-module list (148-153);
  - the "list pages render no form or button" rule (97-107). A client table is fine, as with asignaturas.
- `src/test/access/matrix-table.ts`: one page row plus one actions row.
- `src/lib/audit/types.test.ts:34-92`: the exact action set, if new codes are added.
- `audit-leak.test.ts`: add the new actions to prove that no email, phone or name reaches audit rows or logs.
- `permissions.test.ts` and `navigation.test.ts`, only if predicates are added.

### Approaches

| # | Approach | Pros | Cons | Effort |
|---|---|---|---|---|
| 1 | **Catalog-style edit page** at `/catalog/docentes/[id]/edit`, secretary-only guard, `withCatalogWrite`, block deactivation with active grupos (recommended) | Reuses most patterns; keeps the list at STAFF visibility; same global lock serializes against grupo writes and import | A new guard instead of `requireCatalogAccess`, so `addressed` needs a scope argument or a small variant | Medium |
| 2 | Edit at `/users/[id]/edit`, generic for staff | A natural home for later password reset | Changes the `users` module and `rolesVisibles` semantics; broader blast radius; not in RF-12 | High |
| 3 | Toggle only in the list row (dialog), no edit page | Smallest | Does not close "edita" (email fix, `sin_correo` path) | Low, incomplete |

### Recommendation
Approach 1, with these choices:
- **Fields:** edit name, email and phone only.
- **Login:** keep `Login` untouched.
- **Existing remissions:** never touch them.
- **Deactivation with active grupos:** block it, as asignaturas do.
- **Inactive docentes:** read-only until reactivated, as asignaturas do.
- **Import:** it never reactivates a docente. In a second slice, add a `docente.inactive` row error so the block invariant holds.
- **Audit:** two new codes, `usuario.desactivado` and `usuario.reactivado`, plus reuse of `usuario.actualizado` with a manual origin.
  - `catalogo/AUDITABLE_USER_FIELDS` already contains every field needed.
  - Reusing `usuario.actualizado` with `campos: ["activo"]` for toggles is the smaller alternative: it avoids the `types.test.ts` pin edit at the cost of asymmetry with the asignatura and grupo codes.

**Estimated size** (an estimate by analogy, not measured). Asignatura equivalents are about 750 src lines and about 2650 test lines for their three pages.
- **Slice A, domain:** about 480 src plus 650 tests. Covers guard, permissions, data layer, audit, schema, types, actions, matrix and guards edits.
- **Slice B, UI:** about 330 src plus 500 tests. Covers list column, edit page, form, bound controls, i18n es and en, and spec deltas.
- **Slice C, optional:** about 150 for the import gap.
- **Total:** roughly 1900 to 2200 changed lines. That does not fit one 1000-line PR; two or three slices fit.

### Risks
- **Email edit redirects personal data.** The email is where RF-09 sends student documents. An erroneous or malicious edit redirects future remissions.
  - Mitigations: secretary-only access, a field-name audit row, case-insensitive uniqueness against all roles inside the transaction (the DB constraint is case-sensitive, so the `23505` backstop does not cover mixed-case legacy rows), and no change to existing remissions.
  - The secretary already knows the password of docentes she created, with the flag false (`users/new/actions.ts`). An email change plus that password gives takeover. It is an existing weakness and is only worth noting here.
- **Live sessions of a deactivated docente** last up to 8 hours or 30 days. They are harmless for the docente role today. If deactivation is later extended to staff, a per-request `activo` check will be needed. It would cost a DB read per request and a large test blast radius (`dal.test.ts`, the access harness).
- **Stale `Login`** after an email edit. The `/users` list still shows the old login, and the old email cannot be reused for a new account or an import row, because `login.collision` fires. This is conservative but confusing, so it should be documented in the spec.
- **Import overwrites** name and phone on the next import that lists the docente. The copy `catalog.shared.importWins` ("La próxima importación del catálogo puede reemplazar estos valores.") already says so.
- **Import gap A-C12.** The block rule is not airtight until the import refuses grupo rows naming an inactive docente.
- **Concurrency.** Last-write-wins under the global lock (A-CONC). The diff is computed inside the transaction, so concurrent edits are overwritten without conflict. This is consistent with asignaturas.
- **CM spec "exactly three columns, no action column"** becomes role-dependent: non-secretary roles keep three, the secretary sees an actions column.
- **Same-lock coupling.** `users/new` and register do not take the catalog lock, so a concurrent duplicate-email create could race an edit. The unique constraint is the backstop for same-case duplicates.

### Product decisions for the owner

| # | Fork | Recommended | Consequence |
|---|---|---|---|
| D1 | Who may edit and deactivate: secretaria only, or all staff | Secretaria only, derived from `canAssignRole(rol, "docente")` | Matches RF-12 and the creation hierarchy. Coordinacion and administrador keep a read-only list. The roadmap's pending permission question closes for docentes. |
| D2 | Deactivate a docente with active grupos: block, warn and allow, or cascade | Block, with a count in the confirmation | Keeps the "no active grupo with an inactive docente" invariant and RF-12 (b). The secretary deactivates the grupos first. |
| D3 | Import versus manual deactivation | The import never reactivates a docente, and refuses grupo rows naming an inactive docente | Needs slice C. Otherwise gap A-C12 stays documented. |
| D4 | May the secretary change the docente's email | Yes, with a uniqueness check, an audit row, and no change to existing remissions | Fixes `sin_correo` and typos, which today need the database. The risk is redirected personal data. Read-only email would leave RF-12 (a) incomplete. |
| D5 | Audit shape of the toggle | Two new codes, `usuario.desactivado` and `usuario.reactivado` | A small `types.test.ts` edit. A design choice more than an owner choice. |

### Ready for Proposal
Yes, after the owner answers D1 to D4. D5 is a design detail. Per the pre-proposal gate, those product decisions need explicit confirmation before `sdd-propose`.
