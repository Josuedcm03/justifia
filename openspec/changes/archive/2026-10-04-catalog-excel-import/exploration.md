# Exploration: catalog-excel-import (F2)

Source requirements: RF-35 (catalog load/maintenance via bulk Excel import by secretaría), RNF-10 (no external integrations). Downstream consumers: RF-03, RF-31, RNF-08.

## Current state (verified in code, branch main @ cbaac00)

- Tables: `Facultad`, `Carrera`, `Rol`, `Usuario` (migrations 0000-0002). `Usuario.HashClave` NOT NULL; `Usuario.Cif` unique nullable; `Usuario.Login` unique. Conventions: PascalCase names, `bigint generatedAlwaysAsIdentity` Ids, inline `.unique()`.
- Missing: `Asignatura`, `Grupo`, `Inscripcion`, any Excel/CSV dependency, import UI, audit table.
- Docente creation: `src/app/(dashboard)/users/new/actions.ts` (`createStaffAction`): `requireRole` -> zod -> `canAssignRole` -> bcryptjs (12 rounds) -> `createUsuario`. Students self-register with `cif` and `carreraId`.
- Permissions: `src/lib/auth/permissions.ts` (`rolesAsignables`: administrador -> coordinacion, coordinacion -> secretaria, secretaria -> docente).
- Data model reference (`modelo_datos_sql.md`): `Asignatura(Codigo unique, Nombre, CarreraId, HorasTotales > 0)`, `Grupo(AsignaturaId, Periodo text e.g. '2026-S2', NumeroGrupo, DocenteId, UNIQUE(AsignaturaId, Periodo, NumeroGrupo))`, `Inscripcion(EstudianteId, GrupoId, composite PK)` with no Periodo column (period comes via Grupo).
- Next.js 16.3.4: Server Action body limit defaults to 1 MB (configurable via `experimental.serverActions.bodySizeLimit`, global not per action).

## Findings

1. **Credentials** are the main design risk: `HashClave` NOT NULL and no reset/first-login flow. Options: (a) unusable hash + activation flow (scope creep), (b) pattern password (weak), (c) temporary password exported once + forced change (new flow), (d) import creates no users, only references existing ones (students self-register; enrollments for unregistered CIFs blocked).
2. **Parsing library** (from prior knowledge, verify versions at design time): `exceljs` (read+write, can produce template; heavy), npm `xlsx` (stale, known advisories: avoid), `read-excel-file` (small, xlsx only), CSV only (does not meet "Excel" in RF-35). Recommendation: `exceljs` if a formatted template is wanted, else `read-excel-file`. Guards: `.xlsx` only, `PK` magic bytes, size cap 2-5 MB, row cap, server-side only, no formula evaluation, `requireRole` before reading FormData.
3. **UX**: role-guarded template download (sheets in dependency order); stateless two-step flow (dry-run report with create/update/unchanged/error counts and row-level errors, then apply); all-or-nothing in one `db.transaction`; natural-key upserts (Facultad.Nombre, Carrera.Nombre, Asignatura.Codigo, Grupo (Asignatura, Periodo, NumeroGrupo), Inscripcion PK, Usuario Cif/Login); no deletes in v1.
4. **Schema**: additive migration 0003 with `asignatura`, `grupo`, `inscripcion`; indexes on `grupo.periodo`, `grupo.docenteId`, `inscripcion.grupoId`; period validated as text in zod; role integrity of `DocenteId`/`EstudianteId` enforced in app code.
5. **Authorization**: `canImportCatalog` in `permissions.ts` (secretaria + administrador recommended); enforce in sidebar, page, every action, and template route handler.
6. **Audit log (RNF-02)**: out of scope for F2 (its own change); `apply()` returns a structured summary (actor, timestamp, file hash, per-entity counts) as a seam, plus a minimal structured server log.

## Approaches

| Approach | Pros | Cons | Effort |
|---|---|---|---|
| 1. Stateless dry-run + apply, single workbook, all-or-nothing (recommended) | Safe, idempotent, pure testable functions, fits strict TDD | Re-upload on confirm; cross-refs must be in one file | High (chainable) |
| 2. Per-entity uploads, immediate apply, partial allowed | Simplest validation | Load-order burden, partial catalogs | Medium |
| 3. CSV only | Minimal attack surface | Fails "Excel" in RF-35 | Low-Medium |

Recommended delivery: three chained work units under the 800-line budget: WU1 schema + migration 0003 + data layer; WU2 pure import core (parse, per-sheet zod, plan/dry-run, transactional apply); WU3 UI (page, upload, preview/confirm, template, permissions, sidebar, i18n, `bodySizeLimit`).

## Risks

- Credentials for imported users; untrusted `.xlsx` parsing; global `bodySizeLimit` widening the DoS surface.
- Wrong key choice for docente `Login`/`Correo` could duplicate or overwrite accounts on re-import.
- Undefined enrollment lifecycle: stale enrollments could falsely pass RF-31.
- No audit trail for bulk modification of personal data (RNF-02) if deferred.
- Migration 0003 on shared Neon requires explicit user confirmation before apply.

## Open product questions

1. Should the import create docente/estudiante users? If yes, how do they get credentials?
2. Which column identifies a docente (email, national id, employee code)? Are student CIFs always present and stable?
3. Who may import: secretaría only, + administrador, or also coordinación?
4. Institution-wide or scoped by carrera/facultad?
5. Period formats needed (`YYYY-S1/S2` only, or others)? Is a "current period" notion needed now for RF-31?
6. On re-import: only add/update, or also deactivate absent rows?
7. All-or-nothing or partial? Import-history record now?
8. One multi-sheet workbook or separate files? Expected max rows/file size?
9. Does "mantener" require manual per-record CRUD in this change, or is re-import the only path?
10. Does institutional data provide `HorasTotales`, and what if missing?
