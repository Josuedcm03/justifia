# Exploration: Merge Grupo into Asignatura

Date: 2026-10-09. Base: `feat/sidebar-catalogs` at `d3a3997`.

## Intent

The owner wants two catalogs only, Asignatura and Docente. Today secretaría
maintains Asignatura and Grupo separately although a group has no meaning
without its subject. Each Asignatura row becomes one **class**: a subject code
plus a group number.

## Current state (verified in code)

- **Schema** (`src/db/schema.ts`): `Asignatura` has `Codigo` (UNIQUE), `Nombre`,
  `CarreraId`, `HorasTotales`, `Activo`. `Grupo` has `AsignaturaId`, `Periodo`,
  `NumeroGrupo`, `DocenteId` (NOT NULL), `Activo`, `Origen`, `Dias`, with
  UNIQUE (`AsignaturaId`, `Periodo`, `NumeroGrupo`). `Inscripcion` has the
  composite key (`EstudianteId`, `GrupoId`) and a foreign key to `Grupo`.
- **Migrations**: `drizzle/0000` to `0006_grupo_dias.sql`. The next is `0007`.
  Each recent migration has a structural test (`src/db/migration-000N.test.ts`).
- **Days**: one `smallint` bitmask, Monday = bit 0 to Sunday = bit 6, `0` =
  not recorded, encoded only in `src/lib/catalog/dias.ts`.
- **Unique `Codigo` is assumed** by `asignaturaByCodigo` and
  `asignaturaIdByCodigo` (`src/lib/import/plan.ts`), `idByCodigo`
  (`src/lib/import/apply.ts`), the `codigo_taken` outcome
  (`src/lib/data/asignaturas.ts`, `src/lib/catalog/types.ts`, the Asignatura
  actions and `src/lib/audit/events.ts`), and the `codigo.duplicate` row error.
- **Docente is mandatory today**: the Grupo reads in `src/lib/data/grupos.ts`
  use `innerJoin(usuario, ...)`, and the planner raises `docente.unresolved`
  for a row without a resolvable docente.
- **Import** (`src/lib/import/sheets.ts`): three sheets. `Asignaturas`
  (`Codigo`, `Nombre`, `Carrera`, `HorasTotales`), `Docentes` (`Correo`,
  `Nombre`, optional `Telefono`), `Grupos` (`CodigoAsignatura`, `Periodo`,
  `NumGrupo`, `CorreoDocente`, optional `Dias`). Only Grupo rows are
  deactivated when absent (`deactivateGrupoIds`); Asignatura rows never are.
- **Writes**: every manual catalog write goes through `withCatalogWrite`
  (`src/lib/data/catalog-write.ts`): one advisory lock, one transaction, audit
  rows last.
- **Audit** (`src/lib/audit/types.ts`): four `grupo.*` actions, entity type
  `Grupo`, `AUDITABLE_GRUPO_FIELDS` (includes `periodo`), and an import payload
  keyed by entity name with `gruposManualesDesactivados`.
- **Inscripcion**: no production module writes it; pinned by
  `src/lib/data/inscripcion-writes.test.ts`. `SolicitudDetalle.GrupoId` exists
  only in `modelo_datos_sql.md`.
- **Reach**: 82 files under `src` mention Grupo (1,840 occurrences), including
  the whole `src/app/(dashboard)/catalog/grupos/` tree, the Grupos section of
  the Asignatura edit page, the sidebar, and the import.
- **Specs**: `openspec/specs/` holds `academic-catalog`, `audit-log`,
  `catalog-excel-import`, `forced-password-change` and
  `imported-account-provisioning`. The `catalog-management` capability exists
  only inside its unarchived change folder.

## Approaches compared

| | Approach | Verdict |
|---|---|---|
| A | Full merge: `Asignatura` holds one row per class; `Grupo` is dropped | **Recommended** |
| B | Keep `Grupo`, edit groups inline on the Asignatura page | Rejected: two tables and two import sheets remain; the owner asked for one catalog |
| C | Keep both tables behind a compatibility view | Rejected: hides the duplication, keeps every write path double |

Cost of A: `Nombre`, `CarreraId` and `HorasTotales` are repeated on every row of
one code, so their equality is an application invariant, not a table
constraint.

## Findings that shape the proposal

- **Docente rule in the database**: seven partial unique indexes, one per
  weekday bit, on (`Codigo`, `DocenteId`) where the row is active, has a docente
  and has that bit set. They are not deferrable, so the import must order its
  writes. A pre-check is still needed in `withCatalogWrite` and in the pure
  planner, because a `23505` in the middle of an apply aborts the whole import.
- **Rows without days escape the rule**: a mask of `0` sets no bit.
- **Row identity now spans terms**: with `Periodo` gone, the same row is reused
  when a code and group number return next term.
- **Deactivate-absent widens**: it now covers every class row, so a subject left
  out of the workbook is deactivated.
- **Audit history**: `EventoAuditoria` is append-only. Old `grupo.*` rows keep
  ids of rows that no longer exist; the entity type keeps them distinguishable.
- **Migration `0007`** is hand-written and data-preserving, and irreversible
  once `Grupo` is dropped.

## Size

Exploration estimate: about 120 files and 13,000 to 16,000 changed lines (about
7,000 deleted), which is 16 to 20 review slices at 800 lines.

## Sequencing

`catalog-management` is committed but neither verified nor archived, and has
more than twenty open owner tasks, many about Grupo pages this change deletes.
Recommended: verify and archive it first, waiving the Grupo-only smoke items.

## Not verified

No database was queried. The number of periods, of key collisions once
`Periodo` is dropped, of docente overlaps and of `Inscripcion` rows in
production is unknown until the read-only preflight runs.
