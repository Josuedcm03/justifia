# Proposal: Internal Catalog Bulk Import from Excel (F2)

> **This change TOUCHES THE DATABASE SCHEMA** (four new tables including a
> date-partitioned append-only audit table with immutability triggers, one new `Usuario`
> column, one new UNIQUE constraint) **and creates user accounts**.
> No migration, push or seed may run against Neon without the user's explicit
> per-command confirmation.

## Intent

RF-35 / RNF-10 require the internal catalog (facultades, carreras, asignaturas,
docentes, inscripciones) to be owned by the system and maintained by secretaría
through bulk Excel import, with no external integration. Today only `Facultad`,
`Carrera`, `Rol` and `Usuario` exist: there is no `Asignatura`, `Grupo` or
`Inscripcion`, and no load path at all. Without them RF-03 (auto-resolve
docente/grupo), RF-31 (verify enrollment in the absence period) and RNF-08
(zero manual search) cannot be built. Secretaría's only alternative is
hand-creating every docente one by one at `/users/new` and every student by
self-registration — unusable at institutional scale.

The import is also the first feature that creates personal data in bulk, which
is exactly when RNF-02's write-audit obligation stops being deferrable: an
import that provisions hundreds of accounts with no tamper-proof record of who
ran it, when, from which file, and which accounts it touched is not auditable
after the fact. The audit log therefore ships with the import that needs it,
not after it.

## Scope

### In Scope

- **Schema (migration 0003, additive)**: `Asignatura` (`Codigo` unique,
  `Nombre`, `CarreraId`, `HorasTotales`), `Grupo` (`AsignaturaId`, `Periodo`,
  `NumeroGrupo`, `DocenteId`, `Activo`, UNIQUE(`AsignaturaId`, `Periodo`,
  `NumeroGrupo`)), `Inscripcion` (`EstudianteId`, `GrupoId`, composite PK,
  `Activo`); `Usuario.Correo` gains UNIQUE; `Usuario.DebeCambiarClave` boolean
  NOT NULL default false.
- **Import core (pure, testable)**: single multi-sheet `.xlsx` workbook parsed
  server-side, per-sheet zod validation, a plan/dry-run producing
  create/update/unchanged/deactivate/error counts plus row-level errors, and an
  all-or-nothing `db.transaction` apply returning a structured summary (actor,
  timestamp, file hash, per-entity counts).
- **Append-only audit log (RNF-02, write events only)**: a new audit table
  (`EventoAuditoria`; expected shape: actor `Usuario`, timestamp, action,
  entity type + id, structured payload/summary), **range-partitioned by date
  (yearly)**, created entirely in the hand-written migration **0004**
  (`drizzle-kit generate --custom`; migration 0003 contains no audit object) and
  declared for typing only in `src/db/audit-schema.ts` (not `schema.ts`, so
  drizzle-kit never sees it). It has **database-enforced immutability** —
  triggers that reject `UPDATE`, `DELETE` and `TRUNCATE` on the parent and on
  every child partition — so rows can only be appended. Yearly partitions
  2026-2030 plus a `DEFAULT` partition are pre-created so an insert never fails
  for a missing partition, and so a future retention purge is a partition
  `DROP`/`DETACH` (DDL) rather than a row `DELETE`. The import writes audit rows for **writes only**: one row per
  applied import (actor, file hash, per-entity counts) and one row per account
  created or modified by that import. Audit writes happen **inside the same
  all-or-nothing `db.transaction`** as the data writes, so a failed import
  leaves no audit row. Credentials — temporary passwords, hashes, any secret —
  must never enter an audit payload.
- **Upsert keys**: `Facultad.Nombre`, `Carrera.Nombre`, `Asignatura.Codigo`,
  `Grupo`(Asignatura, Periodo, NumeroGrupo), `Inscripcion` PK,
  docente `Usuario.Correo`, estudiante `Usuario.Cif`.
- **Account provisioning**: the import CREATES docente and estudiante accounts.
  `Login` is derived from the institutional email; each new account gets a
  generated temporary password (bcryptjs, 12 rounds), exported once to
  secretaría with the apply result and never re-shown, and is flagged
  `DebeCambiarClave`. Existing accounts are updated, never re-credentialed.
- **Forced password change**: the flag travels in the session; an authenticated
  user carrying it is redirected to a change-password screen from every guarded
  route until they set their own password.
- **Re-import lifecycle**: "deactivate what is absent" — `Grupo` and
  `Inscripcion` rows missing from a re-import are marked inactive, never
  deleted. Downstream checks (RF-31) read only active rows.
- **Permission**: `canImportCatalog(rol) = canAssignRole(rol, "docente")`, so
  only `secretaria`. Enforced in the sidebar, the page, both server actions and
  the template route handler.
- **UI**: import page (upload → preview → confirm), role-guarded template
  download in dependency order, es/en copy, raised
  `experimental.serverActions.bodySizeLimit`.

### Out of Scope

- **Read-access auditing** — the "cada acceso" half of RNF-02 (logging who
  *consulted* a record) is deferred to its own change. F2 audits writes only.
- Manual per-record CRUD for catalog entities; maintenance is re-import only.
- Deletes of any kind, and deactivation of `Facultad`/`Carrera`/`Asignatura`.
- Password reset / forgot-password flows, email delivery of credentials,
  account activation links.
- Per-carrera or per-facultad scoping of an import; import history persistence;
  CSV or legacy `.xls`.
- Any change to `rolesAsignables`, `rolesVisibles`, `/users/new`, or the
  `roles-lookup-table` specs.

## Capabilities

### New Capabilities

- `academic-catalog`: `Asignatura`/`Grupo`/`Inscripcion` entities, their natural
  keys and integrity rules (docente/estudiante role integrity, period format),
  and the active/inactive lifecycle downstream readers must respect.
- `catalog-excel-import`: who may import, the workbook and template contract,
  file guards, the dry-run report, all-or-nothing apply, upsert keys and
  deactivate-absent semantics.
- `imported-account-provisioning`: how the import creates docente and estudiante
  accounts, identity resolution by email/CIF, temporary-password generation and
  its one-time export, and what happens to accounts that already exist.
- `forced-password-change`: the `DebeCambiarClave` marker, its propagation into
  the session, and the enforcement that blocks the app until the user changes it.
- `audit-log`: the append-only write-audit record — what an audit row contains,
  who the actor is, the database-enforced immutability (no `UPDATE`, no
  `DELETE`), the rule that audit rows are written in the same transaction as the
  data they describe, and the prohibition on credentials in payloads.
  `catalog-excel-import` and `imported-account-provisioning` now **depend on**
  `audit-log`: their apply paths are only correct if the audit rows they owe are
  written atomically with the data.

### Modified Capabilities

- None. The `roles-lookup-table` capabilities are untouched by user decision;
  `canImportCatalog` is a new predicate that only *derives* from `canAssignRole`.

## Approach

Exploration approach 1: **stateless two-step flow**. Upload is parsed and
planned without persisting anything; the user confirms and re-uploads, and the
apply re-parses and re-plans before writing. No server-side draft state, no
temp files, idempotent by construction, and the whole core stays pure functions
over a parsed workbook — which is what makes strict TDD viable here.

Students are deliberately outside the role-assignment hierarchy
(`rolesAsignables`), so the import creates them through its own provisioning
path rather than by widening that hierarchy. `canImportCatalog` is derived from
`canAssignRole(rol, "docente")` so the right to bulk-create docentes can never
drift from the right to create one by hand.

`Login` is derived from the full normalized email (not its local part) so that
`Correo` uniqueness mechanically guarantees `Login` uniqueness; the exact
normalization is a design decision.

Parsing library choice is deferred to design (npm `xlsx` is excluded: stale,
known advisories). Guards regardless of library: `.xlsx` only, `PK` magic
bytes, size and row caps, server-side only, no formula evaluation, and
`requireRole` before FormData is read.

Auditing is **append-only by the database, not by convention**: triggers that
reject `UPDATE`/`DELETE`/`TRUNCATE` (on the partitioned parent and on each
child partition) mean no application bug, no future feature and no ORM
path can rewrite history — the only version of RNF-02 worth having. Audit rows
are written through a small `src/lib/audit` module that accepts the caller's
transaction handle, so the audit and the data it describes commit or roll back
together: a successful import that lost its audit row, and an audit row for an
import that never happened, are both impossible. What `apply()` already computes
(`ImportSummary`: actor, file hash, per-entity counts) becomes the payload, so
the seam the proposal previously left open is now the implementation. Payloads
carry identifiers and counts — never credentials, and no more personal data than
RNF-05/06 justify.

Delivery: the design splits this into **seven** chained slices (the original
three exceeded the budget; partitioning the audit table pushed the schema slice
over it and forced the WU1a/WU1b split). The audit *logic* is folded into
WU2b/WU2c (the writer must sit in the same diff as `apply.ts`); the audit
*schema* is its own self-contained slice, WU1b.

| WU | Content | Est. authored lines | Budget risk |
|---|---|---|---|
| WU1a | Drizzle-generated schema (`Asignatura`/`Grupo`/`Inscripcion`, `usuario` changes), migration 0003 + snapshot + journal, `catalog.ts`, users data additions, `modelo_datos_sql.md` for those entities | ~450 | Low |
| WU1b | `src/db/audit-schema.ts`, hand-written `drizzle/0004_audit_log.sql` (partitioned table, partitions + `DEFAULT`, indexes, FK, CHECK, function, triggers, `REVOKE`s), migration and schema tests, `modelo_datos_sql.md` audit entity and runbook note | ~420 | Med |
| WU2a | Limits, sheets, zod schemas, normalize, guards, types, `parse.ts` + fixtures, xlsx advisory gate | ~610 | Med |
| WU2b | Pure planner + scenario suite, **+ `src/lib/audit` types and event builders with their pure suite** | ~735 (pre-authorised split into `plan.ts` and `audit/*` if it measures over 800) | High |
| WU2c | `temp-password`, `apply.ts`, provisioning, `ImportSummary`, **+ `src/lib/data/audit.ts` and the in-transaction audit writes, no-audit-on-failure tests** | ~585 | Med-High |
| WU3a | Forced password change end to end | ~560 | Med |
| WU3b | Import UI, template route, permission, sidebar, `bodySizeLimit`, i18n | ~660 | Med-High |

**800-line budget risk: High.** WU2b leaves about 65 lines of headroom, WU3b
sits near the limit, and the single schema slice already breached the budget
once before being split — estimates move under pressure. If WU2b measures over
800 at apply time it splits at its seam (`plan.ts` versus `audit/types.ts` +
`events.ts`), costing one extra PR and no redesign; the overflow is never
absorbed into WU2c. WU1b must branch from WU1a because both append to
`drizzle/meta/_journal.json`, even though 0004 has no SQL dependency on 0003.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/db/schema.ts` | Modified | `asignatura`, `grupo`, `inscripcion`; `usuario.correo` unique; `usuario.debeCambiarClave`. Deliberately does NOT import or re-export the audit table |
| `src/db/audit-schema.ts` | New | Typing-only declaration of the partitioned audit table, invisible to drizzle-kit by construction; `0004` is the single source of its DDL |
| `drizzle/0003_*.sql`, `meta/` | New | Additive drizzle-generated migration + snapshot + journal for the catalog entities; contains no audit object |
| `drizzle/0004_audit_log.sql` | New | Hand-written (`--custom`): range-partitioned audit table, yearly partitions 2026-2030 + `DEFAULT` partition, indexes, FK, CHECK, and `UPDATE`/`DELETE`/`TRUNCATE`-rejecting triggers on the parent and every child partition (partition routing and immutability on both levels) |
| `src/lib/audit/*` | New | Append-only writer taking a transaction handle; payload builders; credential-free by construction |
| `src/lib/data/catalog.ts` (new), `src/lib/data/users.ts` | New/Modified | Catalog queries; user lookup by `Correo`, provisioning insert |
| `src/lib/data/audit.ts` | New | Insert-only data layer for audit rows; no update/delete surface |
| `src/lib/import/*` | New | Workbook parsing, per-sheet zod schemas, planner, applier, summary |
| `src/lib/auth/permissions.ts` + test | Modified | `canImportCatalog` derived from `canAssignRole(rol, "docente")` |
| `src/lib/auth/session.ts`, `cookies.ts`, `dal.ts` | Modified | Carry and enforce `debeCambiarClave` |
| `src/app/(auth)/login/actions.ts` | Modified | Session payload gains the flag |
| `src/app/(dashboard)/catalog/import/*` | New | Page, upload form, preview/confirm, server actions |
| `src/app/api/catalog/template/route.ts` | New | Role-guarded template download |
| `src/app/change-password/*` | New | Forced-change screen + action |
| `src/components/app-sidebar.tsx` | Modified | Import item only for `secretaria` |
| `i18n/es.json`, `i18n/en.json` | Modified | Import, template, error and forced-change copy |
| `next.config.ts` | Modified | `experimental.serverActions.bodySizeLimit` |
| `package.json` | Modified | One xlsx parsing dependency (chosen at design) |
| `modelo_datos_sql.md` (repo root) | Modified | New entities + DDL |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `Usuario.Correo` UNIQUE fails on existing duplicate emails | Med | Read-only pre-check `SELECT "Correo", count(*) ... GROUP BY 1 HAVING count(*) > 1` before applying; NULLs stay allowed |
| Temporary passwords leak (exported file, screen, logs) | High impact | Shown once, never persisted in plaintext, never logged, forced change on first login |
| Wrong email in the sheet creates a duplicate docente or hijacks an account | Med | `Correo` is the sole docente key, unique and validated; dry-run shows create vs update per row; all-or-nothing |
| Untrusted `.xlsx` parsing (zip bombs, XXE, formulas) | Med | Extension + magic-byte + size + row caps, no formula evaluation, server-only, maintained library |
| Global `bodySizeLimit` widens the DoS surface for every action | Med | Raise to the smallest workable cap; `requireRole` before reading the body |
| A bad import silently deactivates live groups/enrollments | Med | Dry-run reports deactivation counts explicitly; nothing is deleted; a corrected re-import reactivates |
| Stale enrollments falsely pass RF-31 | Med | `Activo` on `Grupo`/`Inscripcion`; the spec states downstream readers filter on it |
| Forced-change guard causes a redirect loop or locks out logout | Med | The change-password route requires only a session; explicit tests for it and for logout |
| Large workbook exceeds a serverless execution limit | Med | Row caps surfaced as a validation error, not a timeout; measured at design |
| Drizzle drift on the hand-written partitioned audit table: drizzle cannot emit `PARTITION BY`, triggers or per-partition objects | Med | The table is invisible to drizzle-kit by construction (declared in `src/db/audit-schema.ts`, never imported by `schema.ts`, absent from the snapshot; a test pins both), so `generate` cannot emit a conflicting `CREATE TABLE`, `DROP` or diff. New hazard: `drizzle-kit push` would propose DROPping the child partitions (they look like unknown tables) — **never use `push`**. A migration test asserts the immutability triggers on the parent and every partition, so a dropped trigger fails CI, not production |
| Audit write inside the data transaction makes every import fail if auditing fails | Med | Intentional: an unaudited write is worse than a refused one. Kept cheap (one row per import + one per account) so it cannot become the failure mode |
| Audit payloads accumulate personal data beyond what RNF-05/06 justify | Med | Payload is identifiers + counts, credential-free by construction; design fixes the exact field list and a credential-absence test guards it |
| Audit table growth with no retention rule (RNF-06 / Ley 787 obligations) | Med (partly mitigated) | Yearly partitions make a future purge a partition `DROP`/`DETACH` (DDL) instead of a row `DELETE`, so the trigger never has to be weakened. The retention period itself is still unknown and no purge is implemented in F2; the calendar (window ends 2030-12-31, `DEFAULT` partition must stay empty) is watched by a documented manual runbook check, not a scheduler |
| Migrations 0003 and 0004 on shared Neon, the latter creating a partitioned table and triggers | Med | Explicit user confirmation; rehearse both on a Neon branch first, including rejected `UPDATE`/`DELETE`/`TRUNCATE` probes against the parent and a child partition |
| `npm test` regressions from the session-payload change | Med | Session shape change lands with its tests in WU3 |

## Rollback Plan

1. **Before applying**: rehearse migrations 0003 and 0004 on a Neon branch cloned from the
   target; run the `Correo` duplicate pre-check. Take a restore point.
2. **Code-only rollback** (nothing applied): `git revert`; delete the migration
   files and the journal entry. Zero data risk.
3. **Failure during the migration**: drizzle wraps pending migrations in one
   transaction, so a mid-file failure rolls back completely.
4. **After a committed migration**: forward-fix. 0003 is additive, so a
   compensating migration can drop the new tables/columns/constraint without
   losing pre-existing data. **Dropping the audit table is a deliberate,
   user-confirmed act** that destroys the RNF-02 trail. `DROP TABLE` is DDL, so
   it does not need a prior `DROP TRIGGER`: the triggers drop with the table
   (partitions are dependent objects and go with it; the trigger function is
   dropped afterwards). Prefer leaving the table in place even when rolling
   back the import code.
5. **After a bad import**: the apply is all-or-nothing, so a *failed* import
   leaves nothing behind — including no audit row. A *successful but wrong*
   import keeps its audit row permanently; the correction is a new import with
   its own audit row, never an edit of the old one. Correction is by
   re-importing a fixed workbook (absent rows deactivate). Accounts created in
   error are deactivated via `Usuario.Activo`, not deleted. Neon instant
   restore is the last resort and must be taken before the apply.

## Dependencies

- Explicit user confirmation for `drizzle-kit generate`, `drizzle-kit migrate`
  and any seed run.
- A representative sample workbook from secretaría to fix column names, period
  format and real row counts.
- Design must select the xlsx library and verify its advisory status at that
  moment.

## Assumed Defaults to Confirm

| # | Assumed default | If wrong |
|---|---|---|
| 1 | Institution-wide scope; no per-carrera/facultad scoping of an import | Adds a scope selector and a scoped deactivation rule |
| 2 | All-or-nothing: one invalid row aborts the whole apply | Needs partial-apply semantics and a per-row outcome report |
| 3 | One multi-sheet `.xlsx` workbook, sheets in dependency order | Multiple files need a load-order UX |
| 4 | Period format `YYYY-S1` \| `YYYY-S2` only | Changes the `Grupo.Periodo` validation |
| 5 | Maintenance is re-import only; no manual per-record CRUD | Adds CRUD screens (large) |
| 6 | Stateless two-step flow: the user re-uploads to confirm | Server-side draft state and cleanup |
| 7 | Estudiante upsert key is `Cif`; `Login` derived from email when present, else `Cif` | Changes student identity resolution |
| 8 | An account that already exists is updated but keeps its password and is not flagged `DebeCambiarClave` | Re-credentialing on every import |
| 9 | `Asignatura`, `Carrera`, `Facultad` rows absent from a re-import stay active (no `Activo` column) | Adds `Activo` to those tables |
| 10 | `HorasTotales` is required and must be > 0; a missing value is a row error | Needs a default or a nullable column |
| 11 | Import history is not persisted in F2 | Needs a table and a history screen |
| 12 | Temporary credentials are exported as a file to the importer, not emailed | Needs mail delivery (RNF-07 overlap) |
| 13 | Only **write** events are audited in F2; read-access auditing ("cada acceso", RNF-02) is deferred | Needs auditing on every read path — a much larger, cross-cutting change |
| 14 | Audit granularity is one row per import plus one per account created/modified — not one row per catalog row touched | Per-row auditing multiplies volume and changes the retention question |
| 15 | No audit-viewing UI in F2; rows are readable by query only | Needs a screen, a reader permission and pagination |
| 16 | Audit table is partitioned yearly, with partitions 2026-2030 plus a `DEFAULT` partition. Purge and partition renewal are out of scope for F2 (no scheduler; future partitions come from a hand-written migration), but the schema permits both | Different granularity changes the retention resolution and the DDL volume; a known retention period would let a purge procedure be designed |

## Success Criteria

- [ ] `Asignatura`, `Grupo`, `Inscripcion` exist with their natural keys and
      indexes; `Usuario.Correo` is UNIQUE; `Usuario.DebeCambiarClave` exists.
- [ ] A valid workbook produces a dry-run report with per-entity
      create/update/unchanged/deactivate counts and row-level errors, and
      persists nothing.
- [ ] Confirming applies everything in one transaction; an invalid row leaves
      the database untouched.
- [ ] Re-importing the same workbook is a no-op (all "unchanged").
- [ ] A `Grupo`/`Inscripcion` absent from a re-import becomes inactive and is
      not deleted; active-only reads exclude it.
- [ ] New docente and estudiante accounts are created with a temporary password
      exported exactly once, and cannot use the app until they change it.
- [ ] An existing account matched by `Correo`/`Cif` is updated, not duplicated,
      and its password is unchanged.
- [ ] Only `secretaria` can open the import page, call either action or download
      the template; every other role is sent to the denied screen.
- [ ] Uploading a non-`.xlsx`, an oversized or a malformed file fails with a
      clear message and no partial write.
- [ ] A successful import writes one audit row for the import and one per
      account created or modified, with the actor, timestamp, action, entity
      type/id and structured payload populated.
- [ ] An `UPDATE`, a `DELETE` or a `TRUNCATE` against an existing audit row is
      rejected by the database itself, not only by application code — on the
      parent table and when aimed directly at a child partition — proven by a
      test that attempts each.
- [ ] Audit rows route to the partition matching their timestamp year, and an
      insert outside 2026-2030 lands in the `DEFAULT` partition instead of
      failing.
- [ ] A failed import leaves **no** audit row, proving the audit write shares
      the import's transaction.
- [ ] No audit payload contains a temporary password, a hash or any credential —
      asserted by an explicit test over the written rows.
- [ ] `npm test`, `npm run typecheck` and `npm run build` pass; migrations 0003
      and 0004 were rehearsed on a Neon branch before any apply.
