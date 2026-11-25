# Proposal: Docente Maintenance by the Secretaría

## Intent

RF-12 (a) requires the secretaría to create, edit and deactivate docentes.
Today she can create them (`/users/new`, import) but nobody can edit or
deactivate one without the database: `/catalog/docentes` is read-only
(CM-LST-1). A wrong email blocks or misdirects RF-09 remissions, and RF-12 (b)
cannot be shown for docentes. `docs/roadmap.md` row 0 records the gap. Success:
RF-12 (a) and (b) hold for docentes and are proven on Postgres. Evidence:
`exploration.md`.

| ID | Relation |
|---|---|
| RF-12 (a), (b) | Covered for docentes |
| RNF-01 (a), (b), (c) | Secretaria-only guard on every new entry point; menu unchanged; access matrix extended |
| RNF-06 (a) | Exactly one audit row per successful create (form), edit, deactivation or reactivation; (b) unchanged |
| RNF-12 | Deactivation asks for confirmation |
| RNF-13 (b) | New row error (slice 4); (a) unchanged |
| RF-09, RN-18, RN-19 | Not changed: existing remissions keep their snapshot (`teacher-remission`, "Later email change"); later approvals read the live name and email |
| RN-02 | Not changed: only `docente` rows are addressable; student accounts are unreachable |
| RNF-04, RN-27 | Not changed: RN-27 applies to students; deactivation cancels no data; retention reads `Inscripcion.Activo`, so deactivating a grupo does not affect it |

## Scope

### In Scope (owner decisions, 2026-11-25; final)
- **D1** Only `secretaria` edits, deactivates and reactivates, through a
  predicate derived from `canAssignRole(rol, "docente")`. `administrador` and
  `coordinacion` keep the read-only list. Docentes have no facultad: any
  secretary may maintain any docente.
- **D2** Deactivating a docente with active grupos is refused with the count.
  The secretary first reassigns those grupos (grupo edit) or deactivates them.
- **D3** The import never reactivates a docente and refuses, with a row error,
  grupo rows that name an inactive docente. Closes A-C12; own small slice.
- **D4** Editable: name, email, phone. The email is unique case-insensitively
  across every role, excluding self, checked inside the transaction. Audit names
  fields, never values. `Login` and `HashClave` never change. The new email
  signs in at once and the old one stops.
- **D5** (owner, 2026-11-25, with the approval of this proposal) Creating an
  account at `/users/new` writes exactly one `usuario.creado` row in the same
  transaction as the insert, for every staff role created there. No value is
  recorded. Today only the import writes it, so RNF-06 (a) is not met for the
  "create" of RF-12 (a) through the form. Roles, checks and errors of the form
  do not change.
- **Also confirmed**: an inactive docente is read-only until reactivated, as
  asignaturas are; deactivation asks for confirmation (RNF-12).
- Docs: roadmap row 19 (new) and row 0 note; `docs/requirements.md` pending note
  on RF-12 permissions and a history row. No requirement text or count changes.

### Out of Scope
- Password reset; immediate revocation of a live session; editing other roles;
  docente scope by facultad; RN-22 clock hours; thesis edits (listed below).

**DB schema: NO.** No migration, dependency or environment variable.

## Capabilities

### New Capabilities
- `docente-maintenance`: access, edit, email uniqueness, deactivation block,
  confirmation, reactivation, inactive read-only, concurrency, import
  interaction, stale `Login`.

### Modified Capabilities
- `catalog-management`: CM-ACC-1 and CM-LST-1 (actions column for `secretaria`
  only; other roles keep exactly three columns), Purpose, A-GRP-4, A-DOC-FIELDS,
  A-C12.
- `academic-catalog`: "Manual writes require an active Asignatura and an active
  docente" drops the known import gap.
- `catalog-excel-import`: "Per-row validation" gains reason `docente.inactive`;
  "Natural-key upserts" states that a docente is never reactivated; copy.
- `imported-account-provisioning`: "Existing accounts keep their credentials"
  adds that `Activo` never changes (settles its open assumption).
- `audit-log`: closed set and one row per manual docente write and per account
  created by the form (D5).
- `staff-account-creation`: the SR-16 sentence "There is no edit-user screen";
  the audit row of D5.

Checked, no delta: `users-listing` (FE-30 keeps the stored `Login`),
`teacher-remission`, `auth-entry-access`, `route-access-coverage`,
`backoffice-shell` (and CM-NAV-1: prefix match already marks Docentes).

## Approach

Exploration approach 1: `/catalog/docentes/[id]/edit` plus a toggle, copying the
asignatura pattern. A secretaria-only guard (modelled on
`requireEnrollmentAccess`, without scope) runs before the body is read. Writes go
through `withCatalogWrite`: the global advisory lock serialises them with grupo
writes and with the import (`runImportApply` re-plans under the same lock), so
count-then-deactivate cannot race grupo creation. Email: `lower()` lookup on the
transaction handle; `23505` maps to the same field error. Audit reuses
`usuario.actualizado` with `origen: manual`; the toggle codes are a design
choice. Strict TDD.

| Slice (tracker `feat/docente-maintenance`) | Est. lines |
|---|---|
| S1 Predicate, guard, schema, data layer, audit, unit tests, Postgres integration suite | 850-950 |
| S2 Actions, access matrix, `guards.test.ts` and leak pins | 400-500 |
| S3 Edit page, form, toggle, list column, es/en copy | 750-850 |
| S4 Import rule D3 and copy; docs | 200-280 |

D5 adds 100-150 lines, placed by `sdd-tasks`. Total about 2300-2750, by analogy
and not measured. Each slice fits the
1000-line budget. To stay at three PRs, S4 can ride in the S2 PR as separate
commits; `sdd-tasks` decides (ask-on-risk). One production deploy.

## Affected Areas

| Area | Impact |
|---|---|
| `src/lib/auth/permissions.ts`, `src/lib/auth/docente-access.ts` | Modified/New |
| `src/lib/data/users.ts` (`createUsuario`), `src/app/(dashboard)/users/new/actions.ts` | Modified (D5) |
| `src/lib/data/docentes.ts`, `src/lib/data/integration/docente-maintenance.integration.test.ts` | New |
| `src/lib/audit/{types,events}.ts`, `src/lib/catalog/types.ts`, `src/lib/validations/` | Modified |
| `src/app/(dashboard)/catalog/docentes/**` | Modified/New |
| `src/lib/import/plan.ts`, `i18n/{es,en}.json`, `src/test/access/matrix-table.ts` | Modified |
| `docs/{roadmap,requirements}.md` | Modified |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Email edit redirects student documents (RF-09) | Med | Secretaria only; audit row; uniqueness; existing snapshots kept; form copy states the effect. No domain rule, as at creation. Residual: a secretary who set the initial password could also take over the sign-in (existing weakness) |
| Duplicate email locks both accounts out (`findLoginAccount` fails closed on two matches) | Low | In-transaction lookup; all application writers store lower case, so the unique constraint closes concurrent creates |
| Stale `Login` in `/users`; the old email cannot be reused and an import listing it fails with `login.collision` | Med | Specified and stated in copy; loud error, never a silent duplicate; update the workbook |
| Live session of a deactivated docente (8 h, or 30 days) | Low | Docentes open only home, profile and change password; recorded residual |
| Import overwrites name and phone | Med | Existing "import wins" copy on the edit page |
| One inactive-docente row blocks the all-or-nothing import | Med | Row error names the docente and the remedy |
| Last write wins | Low | Accepted (A-CONC); diff inside the transaction |
| Reassigning a past-period grupo rewrites report attribution (reports join `Grupo.DocenteId` live) and redirects pending remissions | Med | Refusal copy suggests deactivating closed-period grupos and reassigning current ones; the Asignaturas search finds grupos by docente |
| Active grupo already under an inactive docente | Low | Read-only count before the tracker merges |

## Rollback Plan

Revert slice PRs in reverse order, or the tracker merge as one; redeploy `main`.
No schema to undo. Edited values and `Activo` remain valid for the previous code;
deactivated docentes stay excluded from grupo options. Reverting only S4 reopens
A-C12 and nothing else. After a full revert, reactivating a docente needs the
database: the rollback checklist reactivates wrongly deactivated ones first.
Audit rows stay; a reader must tolerate any new action code.

## Dependencies

- A fresh disposable Neon branch, owner-confirmed per command, for the
  integration and system runs (`INTEGRATION_DATABASE_URL`,
  `INTEGRATION_ALLOW_WRITES=1`, existing guard). Never production.

## Success Criteria

- [ ] **RF-12 (a), docentes**: a secretary creates (existing form), edits (name,
  email, phone) and deactivates a docente from the interface.
- [ ] **RF-12 (b), docentes**: a deactivated docente is kept, with grupos and
  remissions intact, and leaves every offer: grupo options refuse it, no active
  grupo names it, and no new request can show it.
- [ ] **System test RF-12** (thesis execution sheet), on Postgres on the fresh
  branch: create, edit, sign in with the new email, deactivation refused with the
  count, reassign, confirm deactivation, student request offer checked, import
  row refused, reactivate; `coordinacion` and `administrador` denied by URL and
  by direct request; audit rows counted. Result and commit recorded.
- [ ] **Integration suite on Postgres** green (answers W3 of `catalog-schedule`):
  edit with `Login` and `HashClave` unchanged, mixed-case duplicate refused
  across roles, block with count, toggle and its audit rows, rollback when the
  audit insert fails (also for the account creation of D5), and concurrent grupo creation versus deactivation never
  leaving an active grupo with an inactive docente.
- [ ] RNF-01: matrix denies every other identity with no data read. RNF-06: one
  row per write, none on refusal or no-op, no values. RNF-12: cancel changes
  nothing.
- [ ] `npm test`, `npm run typecheck`, `npx eslint src`, `npm run build` green.

## Thesis Sync (thesis session; locations from the handoff, not verifiable here)

- 5.2 line 33 and Anexo F RF-12-a: docentes are no longer only imported, and
  enrollments no longer only declared by the student.
- 5.3, 5.7 and conclusions: the count 20 of 21, after the execution sheet passes.
- Anexo E: manual steps to edit, deactivate and reactivate. Matriz unaffected.

## Assumptions

- A1: email is required on save (creation rule); it cannot be cleared.
- A2: reactivation has no precondition and reactivates no grupo.
- A3: the import still updates name and phone of an inactive docente; "read-only"
  governs manual edits only.
- A4: opening the edit page writes no audit row (`audit-log`, "Scope limited to
  write events"), as other catalog pages.
- A5: phone is shown only on the edit page; the list stays minimal.
- A6: an inactive docente still receives remissions of requests already filed.
