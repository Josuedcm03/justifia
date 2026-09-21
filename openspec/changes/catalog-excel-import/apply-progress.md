# Apply Progress: catalog-excel-import

Mode: Strict TDD. Batch 1: Phase 0 + Phase 1 (WU1a). Branch: `feat/catalog-excel-import-wu1a` (base tracker `feat/catalog-excel-import`). Nothing committed.

## Completed

- [x] 0.1 (chain strategy feature-branch-chain and WU2b pre-split accepted per orchestrator preflight)
- [~] 0.2 local tracker + WU1a branches created; artifact commit NOT made (apply must not commit) - user/orchestrator pending
- [x] 0.3 baseline: typecheck clean; `npm test` 201/201 on 2nd run (1st run showed 3 transient failures, not reproducible); `npm run build` OK
- [x] 1.3, 1.4, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12
- [ ] 1.5 RED written (8 failing tests by design) - stays RED until 1.6 runs
- Parked: 1.1, 1.2 (READ-ONLY DB), 1.6 [CONFIRM] generate, 1.13 checkpoint

## TDD Cycle Evidence

| Task | Test file | RED | GREEN | REFACTOR |
|------|-----------|-----|-------|----------|
| 1.3/1.4 | src/db/schema.test.ts | suite failed: `asignatura` export undefined | 18/18 pass | prettier only; test switched to `PgDialect.sqlToQuery` for the CHECK text |
| 1.5/1.6 | src/db/migration-0003.test.ts | 8/8 fail: `drizzle/0003_*.sql not found` | PARKED (needs `npm run db:generate`, [CONFIRM]) | n/a |
| 1.7/1.8 | src/lib/data/catalog.test.ts | suite failed: module absent | 4/4 pass | none needed |
| 1.9/1.10 | src/lib/data/users-data.test.ts | 4/4 fail: functions not exported | 4/4 pass (+27 existing in src/lib/data) | none needed |
| 1.11 | rg check on modelo_datos_sql.md | entries absent | entries present | n/a (docs) |

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused tests | `npx vitest run src/db/schema.test.ts src/lib/data` passes; `migration-0003.test.ts` intentionally red until 1.6 |
| Runtime harness | N/A: DB apply deferred to Phase 6; `toSQL()`/logger proofs cover SQL text only |
| Rollback boundary | revert schema.ts/schema.test.ts, users.ts, catalog.ts, users-data.test.ts, catalog.test.ts, import/types.ts, migration-0003.test.ts, modelo_datos_sql.md hunks |

## Full-suite state at end of batch

`npm test`: 221 passed, 8 failed (all in migration-0003.test.ts, awaiting 1.6). `npm run typecheck` clean. `npm run build` OK. eslint: no real errors (CRLF noise only).

## Parked commands

- 1.1 (READ-ONLY, DB): `SELECT "Correo", count(*) FROM "Usuario" WHERE "Correo" IS NOT NULL GROUP BY 1 HAVING count(*) > 1;`
- 1.2 (READ-ONLY): inspect only the host of `DATABASE_URL` for `-pooler`.
- 1.6 [CONFIRM]: `npm run db:generate` (answer "create" to any rename prompt), then hand-review SQL; expect `migration-0003.test.ts` GREEN.

## Deviations / notes

- Readers named `buildActiveGruposForEstudianteQuery` / `buildActiveEnrollmentQuery` (pure query builders taking a `QueryBuilder`); RF-03 keys on the STUDENT's CIF, so `listActiveGruposForDocente` from the task was renamed. No executing wrappers yet (no consumer in this change).
- `CatalogSnapshot` shape was not defined in design; row types chosen in `src/lib/import/types.ts`.
- `modelo_datos_sql.md` already had `CK_Asignatura_Horas`; only Correo unique, DebeCambiarClave, Grupo/Inscripcion `Activo` and note 3 were added.
- `UsuarioConRol` now carries `debeCambiarClave` (also returned by `createUsuario`).
- prettier normalised three files to LF in the working tree (git autocrlf warns; diff is clean).
- Line count: ~247 modified + ~488 new = ~735 authored vs ~440 estimate (tests dominate); 0003 SQL adds ~50 more. Still under the 800 budget but tight.
