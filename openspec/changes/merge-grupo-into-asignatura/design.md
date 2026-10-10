# Design: Merge Grupo into Asignatura (one catalog row per class)

> **DB-touching and DESTRUCTIVE.** This document plans commands; it runs none.
> Migration `0007` rewrites `Asignatura`, re-points `Inscripcion` and drops
> `Grupo`. No migration, Neon branch operation or write SQL may run without the
> owner's explicit confirmation **for that single command**. `drizzle-kit push`
> is never used. Every database step below is tagged `[READ-ONLY]` or
> `[CONFIRM]`. Past the drop, only a Neon branch restore goes back.

> **Size note.** The `sdd-design` skill caps a design at 800 words. This repo's
> precedent (`catalog-management/design.md`, 1,976 lines) and the twelve
> subjects the phase brief requires make that cap unreachable without deleting
> rationale. Project convention wins; the deviation is deliberate.

> **Written in parallel with the delta specs.** `specs/` did not exist when
> this was written. Everything the specs must pin for this design to hold is
> listed in *Points the specs must pin*.

Binding inputs: `proposal.md` (owner decisions D1-D9, approved 2026-10-09;
assumptions A1-A12 accepted as defaults), `exploration.md`, and
`catalog-management/design.md` for the decisions kept or reversed. Decisions
here are numbered **MG-1 to MG-27**. Gates are **MG-G1 to MG-G22**.

**No database was queried.** Row counts, period values, key collisions,
docente overlaps and the real constraint names in production are unknown until
the read-only preflight (section *Preflight*) runs. Three decisions depend on
its result and say so.

---

## Verified findings

### Framework (read in `node_modules/next/dist/docs/`, Next 16.3.4)

| # | Finding | Source | Consequence |
|---|---|---|---|
| N1 | `params` and `searchParams` are Promises; a repeated query key arrives as an array | `03-file-conventions/page.md`, `dynamic-routes.md` | The `new` page awaits `searchParams` after the guard and accepts `codigo` only as a single string |
| N2 | `notFound()` and `redirect()` throw; both stay outside any `try` | `04-functions/not-found.md`, `redirect.md` | Same placement as today |
| N3 | An unmatched URL is answered by the root `app/not-found.js` or `app/global-not-found.js`; a segment `not-found.tsx` only answers a thrown `notFound()` | `03-file-conventions/not-found.md:9,133` | `src/app` has neither root file (glob), so a deleted `/catalog/grupos/**` URL gets the framework default 404, not `catalog/not-found.tsx` (MG-15) |
| N4 | `revalidatePath` with a literal path needs no `type` | `revalidatePath.md` | Actions keep passing literal paths |

### Repository

| # | Finding | Evidence | Consequence |
|---|---|---|---|
| R1 | `drizzle.config.ts` reads **one** schema file, `./src/db/schema.ts` | `drizzle.config.ts:9` | A table declared in another file is invisible to drizzle-kit (as `audit-schema.ts` already is). MG-5 uses this for the transition |
| R2 | The `0004` snapshot produced by `generate --custom` is "a copy of the 0003 snapshot" | `archive/2026-10-04-catalog-excel-import/apply-progress.md:114` | `--custom` does not record a changed `schema.ts`. `0007` therefore cannot use it (MG-6) |
| R3 | Object names in the `0006` snapshot: `Asignatura_Codigo_unique`, `Inscripcion_EstudianteId_GrupoId_pk`, `Inscripcion_GrupoId_Grupo_Id_fk`, `IX_Inscripcion_Grupo`, `Grupo_*` | `drizzle/meta/0006_snapshot.json` | These are the names `0007` drops. Whether production carries the same names is preflight query P11 |
| R4 | `migration-0005.test.ts` imports `GRUPO_ORIGENES`; `migration-0006.test.ts` imports `DIAS_MASK_MAX`; neither counts journal entries | `src/db/migration-0005.test.ts:6`, `migration-0006.test.ts:6` | Only the `0005` import is touched by this change (MG-25) |
| R5 | Unique `Codigo` is assumed by: `asignaturaByCodigo`, `asignaturaIdByCodigo`, `knownAsignaturaCodigos`, `declaredAsignaturaCodigos`, `inactiveAsignaturaCodigos` (`plan.ts:77-93,290`), `idByCodigo` (`apply.ts:66`), the `.limit(1)` lookup and `codigo_taken` (`asignaturas.ts:209-221`), `listAsignaturaOptions`, the row reason `codigo.duplicate`, the copy `shared.fieldErrors.codigo.taken*`, the breadcrumb `breadcrumb.edit {codigo}`, the list `aria-label` `Edit {codigo}`, the toggle `recordLabel`, and both enrollment readers | grep | Each one is named in MG-2 with its replacement |
| R6 | `inscripcion-writes.test.ts` scans `src` only, never `drizzle/` | `src/lib/data/inscripcion-writes.test.ts:14` | The `UPDATE "Inscripcion"` of `0007` does not trip it; the pin stays unchanged and green |
| R7 | The import type web is tight: `ImportPlan` is consumed by `apply.ts`, `import/actions.ts`, `import-preview.tsx`, `summary.ts` and `audit/events.ts`; their tests total about 5,900 lines (`plan.test.ts` 1,649, `apply.test.ts` 1,317, `import/actions.test.ts` 800, `import-form.test.tsx` 799, `import-preview.test.tsx` 465, others) | line counts | The import cannot be flipped in place in slices of 800 lines that stay green. It is built beside the old one (MG-26) |
| R8 | Whole-file deletions above 800 lines exist: `grupos.test.ts` 1,152, `grupos/actions.test.ts` 896, `grupos/[id]/edit/page.test.tsx` 847, `plan.test.ts` 1,649, `apply.test.ts` 1,317 | line counts | Under "deletions counted" a single file must be emptied over two or three slices (MG-26, Open question O1) |
| R9 | `insertAuditEvents` already chunks at `WRITE_CHUNK_ROWS` | `src/lib/data/audit.ts:26` | One audit row per propagated class and per import reactivation needs no new mechanism |
| R10 | `withCatalogWrite` and the import apply share advisory lock `5005001`; a typed result returned after a caught `23505` is the existing backstop pattern | `catalog-write.ts`, `asignaturas.ts:234-239` | Kept unchanged |
| R11 | No application code reads `EventoAuditoria`; `openspec/specs/` holds `academic-catalog`, `audit-log`, `catalog-excel-import`; `catalog-management` is not there | grep, glob | No reader must accept two import payload shapes today (MG-23); MG-27 |

---

## Technical Approach

Four ideas carry the design.

1. **`Asignatura` is the class row.** It gains the group number, the optional
   docente, the days and the origin. `(Codigo, NumeroGrupo)` is the key.
   `Codigo` alone identifies a *subject*, which is now a set of rows, never one
   row.
2. **One pure rule, three callers, seven indexes.** The docente rule is a pure
   function over class rows. The manual write calls it after the lock, the
   import planner calls it over the state the import would leave, and seven
   partial unique indexes are the last line of defence.
3. **The subject is kept equal by one write path.** `Nombre`, `CarreraId` and
   `HorasTotales` are written for every row of a code in the same transaction,
   under the same lock, with one audit row per affected class.
4. **Schema first, cutover last.** The schema and `0007` land early and are
   rehearsed on a Neon branch that becomes the development database. Every
   later slice runs against that branch. Production is migrated once, after
   the last slice, in a maintenance window.

Kept from `catalog-management` without change: `CatalogScope` and
`catalog-scope-sql.ts` as the only place a scope becomes SQL;
`withCatalogWrite` with lock `5005001` and same-transaction audit; pages never
importing Server Actions; lock-free pre-checks (`addressed`); fail-soft lists;
field-names-only audit payloads; the days bitmask and `dias.ts`; "nothing is
deleted". Reversed: Grupo management, the Grupos section, the refusal
"deactivating an Asignatura with active Grupos" (its D4), the mandatory
docente, and the rule that the import never deactivates an Asignatura.

---

## Architecture Decisions

### MG-1. Target columns of the class row

**Choice.** `Asignatura` after `0007`:

| Column | Type | Null | Default | Note |
|---|---|---|---|---|
| `Id` | `bigint` identity | no | | unchanged; existing ids survive |
| `Codigo` | `varchar(32)` | no | | **no longer unique on its own** |
| `Nombre` | `varchar(160)` | no | | subject field (D9) |
| `CarreraId` | `bigint` FK `Carrera` | no | | subject field (D9) |
| `HorasTotales` | `integer` | no | | subject field (D9), `CK_Asignatura_Horas` kept |
| `Activo` | `boolean` | no | `true` | per class |
| `NumeroGrupo` | `varchar(12)` | no | none | the group number (D3); same name, type and length as `Grupo.NumeroGrupo` |
| `DocenteId` | `bigint` FK `Usuario` | **yes** | | optional docente (D5) |
| `Dias` | `smallint` | no | `0` | same bitmask, `CK_Asignatura_Dias` (`between 0 and 127`) |
| `Origen` | `varchar(12)` | no | `'importacion'` | `CK_Asignatura_Origen` (`in ('importacion', 'manual')`), set once (A3) |

New columns are appended in that order, so the auditable field list follows
the column order as it does today.

| Option | Verdict |
|---|---|
| **`NumeroGrupo`** | **Chosen.** The data moves between two columns of the same name and type; `numGrupoSchema` and `NUMERO_GRUPO_MAX` apply unchanged |
| `Grupo` as the column name | Rejected: it is the name of the dropped table, and `asignatura.grupo` reads as a relation |
| A default of `'1'` on `NumeroGrupo` | Rejected: an insert that forgets the group number must fail, not silently create group `1` |
| `DocenteId NOT NULL` with a placeholder account | Rejected by D5 |

### MG-2. The key, and what `Codigo` no longer guarantees

**Choice.** `CONSTRAINT "UQ_Asignatura_Clase" UNIQUE ("Codigo", "NumeroGrupo")`,
declared with an explicit name so the hand-written SQL and the snapshot cannot
disagree on a derived one. `Asignatura_Codigo_unique` is dropped. The
comparison stays exact after trimming, as today: `1` and `01` are two groups.

`Codigo` used to answer "which row". It now answers "which subject". Every
path that assumed one row (finding R5) and what replaces it:

| Path | Replacement |
|---|---|
| `plan.ts` maps keyed by `Codigo` | keyed by `` `${codigo}|${numeroGrupo}` ``; a second map `Codigo -> rows[]` for the subject checks (MG-20) |
| `apply.ts` `idByCodigo` | removed: a class write carries its own id (update) or its full row (create); nothing resolves a parent |
| `createAsignatura` `.limit(1)` lookup, `codigo_taken` | all rows of the code are read; a new subject is refused when any exists; adding a group is a separate entry point (MG-10, MG-17) |
| `listAsignaturaOptions` | deleted with its only caller, the Grupo form |
| row reason `codigo.duplicate` | replaced by `clase.duplicate` (the pair repeats) |
| `breadcrumb.edit`, list `aria-label`, toggle `recordLabel` | all name the code **and** the group number |
| enrollment readers filtering by `Codigo` | return every class of that code the student is enrolled in (MG-24) |
| `grupoRowInScope` | deleted; `asignaturaRowInScope` is the only row predicate |
| `docs/api-institucional/`, `modelo_datos_sql.md` | the mapping note and the DDL are rewritten (MG-25, slice S04) |

### MG-3. The docente rule in the database

**Choice.** Seven partial unique indexes, one per weekday bit:

```sql
CREATE UNIQUE INDEX "UX_Asignatura_Docente_Lunes" ON "Asignatura"
  USING btree ("Codigo", "DocenteId")
  WHERE "Activo" AND "DocenteId" IS NOT NULL AND ("Dias" & 1) <> 0;
-- Martes & 2, Miercoles & 4, Jueves & 8, Viernes & 16, Sabado & 32, Domingo & 64
```

Names: `UX_Asignatura_Docente_` + `Lunes`, `Martes`, `Miercoles`, `Jueves`,
`Viernes`, `Sabado`, `Domingo`. Two rows of one code with the same docente
that both have Monday set collide on the Monday index, and so on for each day.
A row with a null docente, with `Dias = 0`, or inactive is in none of them.
The indexes are not deferrable (a unique *index* cannot be), which fixes the
import write order (MG-21).

One supporting index: `IX_Asignatura_Docente ("DocenteId")`, the successor of
`IX_Grupo_Docente`. The unique constraint serves the `ORDER BY "Codigo"` list
and every lookup by code. No index on `CarreraId` (the documented upgrade path
of `catalog-management` decision 1 still applies).

| Option | Verdict |
|---|---|
| **Seven partial unique indexes** | **Chosen**: plain DDL that drizzle can declare; each violation names its day through the index name |
| An exclusion constraint on a bit string | Rejected: needs `btree_gist`, an operator class for "bits overlap", and a kind of DDL this repository has never reviewed |
| A trigger | Rejected: procedural code for a rule the application already checks; a trigger also hides the conflicting day |
| Application check only | Rejected by the proposal: the database must refuse too |

### MG-4. `Inscripcion` re-pointing

**Choice.** The column `GrupoId` is replaced by **`AsignaturaId`**
(`bigint NOT NULL`, FK `Asignatura.Id`). Primary key
`Inscripcion_EstudianteId_AsignaturaId_pk ("EstudianteId", "AsignaturaId")`,
index `IX_Inscripcion_Asignatura ("AsignaturaId")`, FK
`Inscripcion_AsignaturaId_Asignatura_Id_fk`. `0007` adds the new column,
fills it from the group-to-class mapping, then drops the old one; it does not
rename in place, because the values change (a group id becomes a class id).

**Rejected:** keeping the name `GrupoId` pointing at `Asignatura` (a column
that lies about its target); `ClaseId` (no table or type is called `Clase`).
`SolicitudDetalle.GrupoId` exists only in `modelo_datos_sql.md` and becomes
`AsignaturaId` there.

### MG-5. Drizzle schema, and the legacy table during the transition

**Choice.** `src/db/schema.ts` declares the target `asignatura` and
`inscripcion` and **no `grupo`**:

```ts
export const asignatura = pgTable("Asignatura", {
  id, codigo: varchar("Codigo", { length: 32 }).notNull(),   // .unique() removed
  nombre, carreraId, horasTotales, activo,
  numeroGrupo: varchar("NumeroGrupo", { length: 12 }).notNull(),
  docenteId: bigint("DocenteId", { mode: "number" }).references(() => usuario.id),
  dias: smallint("Dias").notNull().default(0),
  origen: varchar("Origen", { length: 12 }).$type<Origen>().notNull().default("importacion"),
}, (t) => [
  check("CK_Asignatura_Horas", sql`${t.horasTotales} > 0`),
  check("CK_Asignatura_Origen", sql`${t.origen} in ('importacion', 'manual')`),
  check("CK_Asignatura_Dias", sql`${t.dias} between 0 and 127`),
  unique("UQ_Asignatura_Clase").on(t.codigo, t.numeroGrupo),
  index("IX_Asignatura_Docente").on(t.docenteId),
  ...DOCENTE_RULE_INDEXES(t),   // seven uniqueIndex(...).where(...)
]);
```

- The seven indexes are produced by one helper over `DIAS_SEMANA`. The bit is
  written with `sql.raw(String(1 << i))`: an interpolated number would become
  a bind parameter in generated DDL (the rule `catalog-management` D-1
  recorded for the CHECK bounds). `schema.test.ts` pins seven names, seven
  distinct bits and the predicate text.
- **Legacy table.** The `grupo` table object moves, unchanged, to
  `src/db/legacy-grupo.ts`. drizzle-kit does not read that file (R1), so the
  snapshot shows `Grupo` as gone, while the code that still imports `grupo`
  (the old import pipeline, until slice S44) keeps compiling. The file's
  header says: dropped by `0007`, do not query against a migrated database,
  deleted in slice S44.

**Rejected:** deleting every user of `grupo` in the schema slice (far beyond
one review slice); keeping `grupo` exported from `schema.ts` (drizzle-kit
would keep the table in the snapshot and never emit its removal).

### MG-6. Migration `0007`: hand-written body, generated snapshot

**Choice.** The file is `drizzle/0007_merge_grupo_into_asignatura.sql`. It is
produced in three steps, all local:

1. `[CONFIRM]` `npm run db:generate -- --name merge_grupo_into_asignatura`
   with the target `schema.ts`. Not `--custom` (R2). It writes a draft SQL
   file, `drizzle/meta/0007_snapshot.json` (`prevId` = the `0006` snapshot id)
   and journal entry `idx: 7`. Every rename prompt is answered "create",
   never "rename". **The draft SQL is destructive and is never applied**: it
   drops `Grupo` and `Inscripcion.GrupoId` with no backfill.
2. The draft is copied into `apply-progress.md` as text, then the **body of
   the file is replaced** by the hand-written SQL of MG-7. The snapshot and
   the journal are kept as generated. Every object name in the hand-written
   SQL is taken from the draft (constraint, index, FK and PK names), so the
   database the SQL produces is the database the snapshot describes.
3. `[CONFIRM]` Drift check: `npm run db:generate` a second time must answer
   that there is nothing to generate. If it writes a file, that file is
   deleted, the unit stops and the difference is reported.

The migrator hashes the SQL file when it applies it and the journal holds only
the tag and a timestamp, so replacing the body before any apply is consistent.
The file is frozen by its sha256 (working tree and LF) before the rehearsal;
any later edit restarts the gates at MG-G5.

**How the existing migration tests stay valid.** `0000` to `0006`, their
snapshots and journal entries `idx 0-6` are not edited.
`migration-0006.test.ts` is untouched. `migration-0005.test.ts` changes one
thing: its import of `GRUPO_ORIGENES` becomes the literal
`["importacion", "manual"]`, because an applied migration must not follow a
live constant that this change renames (MG-25).

**Rejected.** `generate --custom` plus a hand-edited snapshot JSON (a
hand-written snapshot is unreviewable and the next generate would emit the
whole change again if one key were wrong); applying drizzle's draft and
backfilling in a second migration (the draft drops the data first);
`drizzle-kit push` (forbidden).

### MG-7. Migration `0007`: ordered steps and rules

**One transaction.** The migrator wraps the pending migrations in one
transaction (precedent: `catalog-management` rollback table). The file adds no
transaction control. This is proven, not assumed, by the negative rehearsal
MG-G8.

**Transient columns** live on `Grupo`, which is dropped at the end, so no
temporary table is needed: `M_Rn` (rank inside a colliding key), `M_Primero`
(reuses the parent row), `M_Activo` (activity of the class), `M_ClaseId` (the
class row the group became).

Rules applied by the SQL:

| Rule | Implementation |
|---|---|
| **A2 collision** | `row_number() OVER (PARTITION BY "AsignaturaId", "NumeroGrupo" ORDER BY "Activo" DESC, "Periodo" DESC, "Id" DESC)`. Rank 1 is carried over; the others are not. `Periodo` is compared as text, which is chronological for the stored format (verified by P2) |
| **A4 activity** | `M_Activo = "Grupo"."Activo" AND "Asignatura"."Activo"`, computed before any row is changed |
| **Parent reuse** | For each Asignatura, the carried-over group with the lowest `Id` updates the existing row, so its id and its `asignatura.*` audit history stay valid. Every other carried-over group becomes a new row copying `Codigo`, `Nombre`, `CarreraId`, `HorasTotales` from the parent, which is how D9 starts consistent |
| **A1 no group** | An Asignatura with no Grupo row gets `NumeroGrupo = '1'`, no docente, `Dias = 0`, `Activo` unchanged |
| **Origin** | A carried-over group keeps its `Origen`. A group-less Asignatura is `manual` when an audit row `asignatura.creada` with `Datos->>'origen' = 'manual'` exists for its id, otherwise `importacion`. This is a read of `EventoAuditoria`, never a write |

Statement order (expected shape; names are confirmed against the draft of
MG-6 step 1 and against P11):

```sql
-- 1. Serialise against any running catalog writer (same key as CATALOG_WRITE_LOCK_KEY).
SELECT pg_advisory_xact_lock(5005001);
-- 2. GUARDS (one DO block, RAISE EXCEPTION ... USING ERRCODE = 'P0001'):
--    G-a a group that is not rank 1 has Inscripcion rows
--    G-b two carried-over, active classes of one code share a docente and a day
--    G-c a Periodo outside the expected format, or a NULL where NOT NULL is assumed
--    G-d any FK other than Inscripcion's references "Grupo"
-- 3. EXPAND
ALTER TABLE "Grupo" ADD COLUMN "M_Rn" integer, ADD COLUMN "M_Primero" boolean DEFAULT false NOT NULL,
  ADD COLUMN "M_Activo" boolean, ADD COLUMN "M_ClaseId" bigint;
ALTER TABLE "Asignatura" ADD COLUMN "NumeroGrupo" varchar(12);
ALTER TABLE "Asignatura" ADD COLUMN "DocenteId" bigint;
ALTER TABLE "Asignatura" ADD COLUMN "Dias" smallint DEFAULT 0 NOT NULL;
ALTER TABLE "Asignatura" ADD COLUMN "Origen" varchar(12) DEFAULT 'importacion' NOT NULL;
ALTER TABLE "Inscripcion" ADD COLUMN "AsignaturaId" bigint;
-- 4. RANK (A2, A4) and choose the group that reuses the parent row
UPDATE "Grupo" g SET "M_Rn" = r.rn, "M_Activo" = g."Activo" AND a."Activo"
  FROM (SELECT "Id", row_number() OVER (PARTITION BY "AsignaturaId", "NumeroGrupo"
          ORDER BY "Activo" DESC, "Periodo" DESC, "Id" DESC) AS rn FROM "Grupo") r, "Asignatura" a
  WHERE r."Id" = g."Id" AND a."Id" = g."AsignaturaId";
UPDATE "Grupo" g SET "M_Primero" = true WHERE g."M_Rn" = 1 AND g."Id" =
  (SELECT min(x."Id") FROM "Grupo" x WHERE x."AsignaturaId" = g."AsignaturaId" AND x."M_Rn" = 1);
-- 5. The old key must go before a second row of one code can exist
ALTER TABLE "Asignatura" DROP CONSTRAINT "Asignatura_Codigo_unique";
-- 6. A1: subjects without any group (BEFORE new rows exist, which no Grupo references)
UPDATE "Asignatura" a SET "NumeroGrupo" = '1', "Origen" = CASE WHEN EXISTS (
    SELECT 1 FROM "EventoAuditoria" e WHERE e."EntidadTipo" = 'Asignatura' AND e."EntidadId" = a."Id"
      AND e."Accion" = 'asignatura.creada' AND e."Datos"->>'origen' = 'manual')
    THEN 'manual' ELSE 'importacion' END
  WHERE NOT EXISTS (SELECT 1 FROM "Grupo" g WHERE g."AsignaturaId" = a."Id");
-- 7. BACKFILL: reuse the parent row for one group
UPDATE "Asignatura" a SET "NumeroGrupo" = g."NumeroGrupo", "DocenteId" = g."DocenteId",
    "Dias" = g."Dias", "Origen" = g."Origen", "Activo" = g."M_Activo"
  FROM "Grupo" g WHERE g."AsignaturaId" = a."Id" AND g."M_Primero";
UPDATE "Grupo" SET "M_ClaseId" = "AsignaturaId" WHERE "M_Primero";
-- 8. BACKFILL: one new row per remaining carried-over group, then map it by the new natural key
INSERT INTO "Asignatura" ("Codigo", "Nombre", "CarreraId", "HorasTotales", "Activo",
    "NumeroGrupo", "DocenteId", "Dias", "Origen")
  SELECT a."Codigo", a."Nombre", a."CarreraId", a."HorasTotales", g."M_Activo",
    g."NumeroGrupo", g."DocenteId", g."Dias", g."Origen"
  FROM "Grupo" g JOIN "Asignatura" a ON a."Id" = g."AsignaturaId"
  WHERE g."M_Rn" = 1 AND NOT g."M_Primero" ORDER BY g."Id";
UPDATE "Grupo" g SET "M_ClaseId" = c."Id" FROM "Asignatura" p, "Asignatura" c
  WHERE g."M_Rn" = 1 AND NOT g."M_Primero" AND p."Id" = g."AsignaturaId"
    AND c."Codigo" = p."Codigo" AND c."NumeroGrupo" = g."NumeroGrupo";
-- 9. RE-POINT
UPDATE "Inscripcion" i SET "AsignaturaId" = g."M_ClaseId" FROM "Grupo" g WHERE g."Id" = i."GrupoId";
-- 10. ASSERTIONS (one DO block, same RAISE form):
--    every rank-1 group has M_ClaseId, and that class row equals it field by field;
--    no Asignatura row has a NULL NumeroGrupo; no Inscripcion row has a NULL AsignaturaId;
--    count(Asignatura) = (subjects without group) + (rank-1 groups);
--    no code has more than one distinct (Nombre, CarreraId, HorasTotales).
-- 11. CONTRACT
ALTER TABLE "Asignatura" ALTER COLUMN "NumeroGrupo" SET NOT NULL;
ALTER TABLE "Asignatura" ADD CONSTRAINT "UQ_Asignatura_Clase" UNIQUE ("Codigo", "NumeroGrupo");
ALTER TABLE "Asignatura" ADD CONSTRAINT "Asignatura_DocenteId_Usuario_Id_fk" FOREIGN KEY ("DocenteId") REFERENCES "Usuario" ("Id");
ALTER TABLE "Asignatura" ADD CONSTRAINT "CK_Asignatura_Origen" CHECK ("Origen" in ('importacion', 'manual'));
ALTER TABLE "Asignatura" ADD CONSTRAINT "CK_Asignatura_Dias" CHECK ("Dias" between 0 and 127);
CREATE INDEX "IX_Asignatura_Docente" ON "Asignatura" USING btree ("DocenteId");
-- seven CREATE UNIQUE INDEX "UX_Asignatura_Docente_<Dia>" (MG-3)
ALTER TABLE "Inscripcion" DROP CONSTRAINT "Inscripcion_EstudianteId_GrupoId_pk";
ALTER TABLE "Inscripcion" DROP CONSTRAINT "Inscripcion_GrupoId_Grupo_Id_fk";
DROP INDEX "IX_Inscripcion_Grupo";
ALTER TABLE "Inscripcion" DROP COLUMN "GrupoId";
ALTER TABLE "Inscripcion" ALTER COLUMN "AsignaturaId" SET NOT NULL;
ALTER TABLE "Inscripcion" ADD CONSTRAINT "Inscripcion_EstudianteId_AsignaturaId_pk" PRIMARY KEY ("EstudianteId", "AsignaturaId");
ALTER TABLE "Inscripcion" ADD CONSTRAINT "Inscripcion_AsignaturaId_Asignatura_Id_fk" FOREIGN KEY ("AsignaturaId") REFERENCES "Asignatura" ("Id");
CREATE INDEX "IX_Inscripcion_Asignatura" ON "Inscripcion" USING btree ("AsignaturaId");
-- 12. DROP (no CASCADE: an unexpected dependant must fail the migration)
DROP TABLE "Grupo";
```

**Stop conditions.** The guards make the migration refuse instead of guessing:
a group that would not be carried over but has enrolments (A2); a docente
overlap among the classes that would be active (the owner fixes the pairs with
today's Grupo screens or by deactivating one, then the gates restart); an
unexpected dependant of `Grupo`. The docente guard exists so the failure is a
readable message and not a `23505` from an index build.

**What is deliberately not done:** no `DELETE`, no `TRUNCATE`, no write to
`EventoAuditoria`, no `CASCADE`, no change to `Usuario`, `Carrera`, `Facultad`
or `Rol`.

### MG-8. `Grupo` is dropped inside `0007`; `Periodo` is recorded outside the schema

**Choice.** `DROP TABLE "Grupo"` is the last statement of `0007`. The old data
stays readable on the Neon branch `backup-before-0007`, which is mandatory
here (it was optional for `0005` and `0006`) and is kept until the owner names
a date to delete it. `Periodo` values are recorded in the **rehearsal report**
in `apply-progress.md`: the count of groups per period, and the list of groups
not carried over as `Grupo.Id`, code, period and group number. No docente
name, email or account id appears in the report.

| Option | Verdict |
|---|---|
| **Drop in `0007`, assertions before the drop, backup branch kept** | **Chosen**: one migration, one snapshot, D1 satisfied literally, and the old rows remain queryable where they cost nothing to the application |
| Freeze `Grupo` and drop it in `0008` | Rejected: a table no code may touch, with `Periodo` and the old FK still live, invisible to drizzle-kit, needing a second destructive migration with its own gates; and the branch restore is the rollback either way |
| Copy `Periodo` into a column of `Asignatura` | Rejected by D8 |
| Rename `Grupo` to an archive table | Rejected: same dead table under another name |

### MG-9. Gates

See *Migration / Rollout*. Twenty-two steps, nothing batched, host restated
before every write, twelve of them owner-confirmed database writes.

### MG-10. Data layer: one module

**Choice.** `src/lib/data/asignaturas.ts` is the merged module; `grupos.ts` is
deleted. Signatures are in *Interfaces*.

| Function | Role |
|---|---|
| `buildAsignaturasWhere(scope, { status, q })` | scope + state + search over `Codigo`, `Nombre`, `NumeroGrupo` and the docente name |
| `listAsignaturas(p)` | count + page, `LEFT JOIN "Usuario"`, fail-soft. Order: `Codigo`, `length("NumeroGrupo")`, `NumeroGrupo`, `Id`, so group `2` comes before `10` without a cast |
| `getAsignaturaById(scope, id)` | one class plus `hermanas` (how many **other** rows share its code); not fail-soft; the lock-free pre-check read |
| `getSubjectByCodigo(scope, codigo)` | subject fields and existing group numbers of a code inside the scope; `null` for a missing and a foreign code alike |
| `listCarreraOptions(scope)` | unchanged |
| `createAsignatura(tx, scope, input)` | a class of a **new** code |
| `addGrupo(tx, scope, input)` | a class of an **existing** code; subject fields come from the stored rows |
| `updateAsignatura(tx, scope, id, input, { propagar })` | own fields and, with propagation, the subject fields of every row of the code |
| `setAsignaturaActivo(tx, scope, id, activo)` | deactivate or reactivate |

- `listDocenteOptions` and `listDocentes` stay in `users.ts`, untouched.
- **Where the pre-checks live.** The docente rule and the propagation are
  inside the write functions, on the transaction handle, therefore after the
  lock. The lock-free pre-check (`addressed`) stays in the actions and still
  only answers "gone".
- **`catalog-scope-sql.ts`** keeps `asignaturaInScope` and
  `asignaturaRowInScope`, loses `grupoRowInScope`, and gains
  `asignaturaCodigoInScope(scope, codigo)` (`"Codigo" = $1 AND <scope>`), used
  by the sibling read and the propagation update. It stays the only place a
  scope becomes SQL.

**Rejected.** A new module `clases.ts` (the table, the routes and the audit
actions are all called Asignatura; a second noun would have to be explained
everywhere); one `createAsignatura` that silently copies stored subject fields
when the code exists (a user typing an existing code with another name would
get a record that ignores what they typed).

### MG-11. Result unions and the `23505` mapping

Result kinds are in *Interfaces*. Refusals never throw.

A `23505` is the backstop, read from `error.cause.code` and the constraint
name from `error.cause.constraint_name`:

| Index or constraint | Typed result |
|---|---|
| `UQ_Asignatura_Clase` | `{ kind: "clase_taken", activo: false }` |
| `UX_Asignatura_Docente_<Dia>` | `{ kind: "docente_conflict", conflicto: { numeroGrupo: null, dias: [<dia>] } }` (the day comes from the name; the other group is unknown, so the copy stays generic) |
| any other, or no constraint name | rethrown: generic message, one sanitised log line |

The mapping table lives in one pure module, `src/lib/catalog/constraints.ts`,
whose test pins that its keys are exactly the names `schema.ts` declares. The
normal path never reaches it: every writer holds the lock, so the pre-check
sees every earlier commit. As today, a transaction aborted by a `23505` runs
no further statement and commits nothing; the typed result maps to no audit
event.

### MG-12. Subject-field propagation (D9)

**Transaction shape** (inside `withCatalogWrite`, after the lock):

```
updateAsignatura(tx, scope, id, input, { propagar })
  1  SELECT the row            WHERE "Id" = $1 AND <scope>      0 rows -> not_found
  2  inactive                  -> inactive
  3  own diff      = changedFields(["docenteId", "dias"], row, next)
     subject diff  = changedFields(["nombre", "carreraId", "horasTotales"], row, next)
  4  both empty                -> unchanged                       no write, no audit
  5  SELECT siblings ("Id", subject fields, "NumeroGrupo", "DocenteId", "Dias", "Activo")
       WHERE "Codigo" = row.codigo AND "Id" <> $1                 unscoped on purpose
  6  subject diff non-empty AND siblings > 0 AND NOT propagar
                               -> confirm_propagation { afectadas }   no write, no audit
  7  carrera, docente and docente-rule checks (MG-13)            -> typed refusal
  8  UPDATE the row SET <own diff + subject diff> WHERE "Id" = $1 AND <scope> RETURNING "Id"
  9  subject diff non-empty AND siblings > 0:
       UPDATE "Asignatura" SET nombre, carreraId, horasTotales
         WHERE asignaturaCodigoInScope(scope, row.codigo) AND "Id" <> $1 RETURNING "Id"
       returned count <> siblings read in step 5 -> throw (rollback, logged)
 10  -> updated { id, campos, propagadas: [{ id, campos }] }
```

- **Step 9's count check** is the guard on the invariant itself: if a sibling
  sat outside the actor's scope (which D9 forbids, since all rows of a code
  share one carrera), the scoped update would skip it and leave the subject
  inconsistent. The write fails loud instead.
- **Audit: one row per affected class.** The edited class gets
  `asignatura.actualizada` with its own changed field names. Every sibling
  gets `asignatura.actualizada` with the subject field names that changed and
  `propagadaDesde: <id of the edited class>`. All in the same transaction, in
  one chunked insert (R9).

  | Option | Verdict |
  |---|---|
  | **One per affected class** | **Chosen**: the audit index is `(EntidadTipo, EntidadId, OcurridoEn)`; a row whose name changed with no event of its own would have a silent hole in its history |
  | One for the edit | Rejected: the history of every other class would be wrong by omission; a reader would have to know about propagation to reconstruct it |

- **Confirmation.** The server decides. A first submit that changes a subject
  field of a code with other groups answers `confirm_propagation` and writes
  nothing. The form then shows an inline two-step block (the pattern of
  `active-toggle.tsx`: one sentence naming the consequence, a confirm button
  and a cancel, focus moved to confirm, result announced through `aria-live`).
  Confirm resubmits the same fields plus `propagar=si`. The server re-reads
  everything, so a group added in between is included and counted again.
- **Scope.** A `coordinacion` actor editing a code whose rows are all in their
  carrera propagates normally. They cannot change `carreraId`
  (`carreraIdForWrite`, unchanged), so they cannot move a subject. An
  unscoped actor who changes the carrera moves every row of the code.
- **A second group for an existing code** goes through `addGrupo`: the action
  posts only `codigo`, `numeroGrupo`, `docenteId` and `dias`; `Nombre`,
  `CarreraId` and `HorasTotales` are **copied on the server** from the stored
  rows of that code and shown read-only in the form. If the stored rows of the
  code disagree with each other, the write is refused with the generic
  message and one log line `catalog.subject.inconsistent` (code only): a
  broken invariant is not papered over.

  | Option | Verdict |
  |---|---|
  | **Server copies, form shows read-only** | **Chosen**: there is no submitted value that could drift |
  | Editable fields validated equal to the stored ones | Rejected: a refusal for retyping something the screen already knows |
  | Editable fields that propagate | Rejected: "add a group" would become a hidden bulk edit |

### MG-13. The docente rule: one pure function

`src/lib/catalog/docente-rule.ts` (pure; generic over the docente key, because
the planner knows a docente that does not exist yet only by its email):

```ts
export type ClaseHorario<D> = {
  ref: string;               // numeroGrupo, used only to name a conflict
  docente: D | null;
  dias: number;              // the mask
  activo: boolean;
};
/** First active row of `otras` that shares the candidate's docente and a day. */
export function conflictoDocente<D>(candidata: ClaseHorario<D>, otras: readonly ClaseHorario<D>[]):
  { ref: string; dias: number } | null;
/** Every conflicting pair inside one code; `[]` when the set is valid. */
export function conflictosDocente<D>(clases: readonly ClaseHorario<D>[]):
  { a: string; b: string; dias: number }[];
```

| Caller | Input | When |
|---|---|---|
| `createAsignatura`, `addGrupo` | the candidate and the active rows of its code | always, when the candidate has a docente |
| `updateAsignatura` | the row after the edit and its active siblings | when `docenteId` or `dias` changed |
| `setAsignaturaActivo(true)` | the row and its active siblings | on every reactivation |
| `planImport` | the rows the workbook leaves active, per code | MG-20 |

Edge cases, all tested on the pure function and probed on the indexes (MG-G7):

| Case | Outcome |
|---|---|
| docente null on either row | never a conflict |
| `Dias = 0` on either row | never a conflict (no bit; Open question O4) |
| either row inactive | never a conflict; checked again on reactivation |
| same docente, disjoint days | allowed (D4, D5) |
| same docente, same day, **different codes** | allowed: the rule is per code |
| a days edit that adds a shared day | refused |
| a subject-field propagation | cannot create a conflict: it touches neither docente nor days |
| the docente's account inactive | not this rule: A10 (`docente_unavailable`) handles it on the writes that set a docente |

**Refusal copy contract.** `catalog.shared.refusals.docenteConflict` takes
`{grupo}` and `{dias}` (the long names of the shared days). It names the
conflicting group number and never repeats the docente. The conflicting row
has the same code, therefore the same carrera, therefore it is inside the
actor's scope; the sibling read that feeds the message still carries the scope
predicate, and a conflicting row it does not return produces the generic
variant (`docenteConflictGeneric`) with no group number.

### MG-14. Activation rules

- **Deactivate:** always allowed. The refusal `has_active_groups`, its copy
  and the "active groups" notice of the State section are removed.
- **Reactivate:** the docente, when there is one, must be an active account
  with role `docente` (A10, existing rule), then the docente rule. Refusals:
  `docente_unavailable` (names the docente, as today) and `docente_conflict`
  (MG-13). A class with no docente reactivates with no check.
- The `SET` of `setAsignaturaActivo` names only `activo` (structural pin).
- **Known dead end, carried over from Grupo:** an inactive class whose docente
  is no longer available can be neither reactivated nor edited. The exit that
  exists is the import: a row with a blank `CorreoDocente` clears the docente
  (A6) and reactivates the class. Open question O5 asks whether the form
  should offer "reactivate without docente".

### MG-15. Routes

```
src/app/(dashboard)/catalog/
  asignaturas/page.tsx              kept      list of classes
  asignaturas/new/page.tsx          kept      create, or add a group with ?codigo=
  asignaturas/[id]/edit/page.tsx    kept      form + State; Grupos section removed
  asignaturas/asignatura-form.tsx   rewritten one form, three modes
  asignaturas/actions.ts            rewritten four actions
  asignaturas/asignatura-grupos-section.tsx   DELETED
  grupos/**                         DELETED   eleven files
  docentes/page.tsx, import/**, not-found.tsx, active-toggle.tsx, dias-cell.tsx   kept
```

`/catalog/grupos/**` answers "not found" with no redirect (A11). By N3 that is
the framework's default 404 page for an unmatched URL, shown after
`middleware.ts` has redirected an anonymous visitor to the login. It is not
`catalog/not-found.tsx`. This design adds no catch-all route for it.
**Rejected:** a `catalog/[...rest]/page.tsx` that calls `notFound()` so the
styled page renders (a new route, guard and test for URLs nobody links to); a
redirect (A11).

### MG-16. The Asignaturas list

| Column | Content |
|---|---|
| Code | `Codigo`, `font-medium` |
| Group | `NumeroGrupo` |
| Name | `Nombre` |
| Career | `carreraNombre`, muted |
| Hours | `HorasTotales`, end-aligned, `tabular-nums` |
| Docente | name, or the muted text "no docente" |
| Days | the existing `DiasCell` (short visible, long for assistive technology, "days not set") |
| Status | `StatusPill` |
| Actions | one "Edit" link, `ghost`, `size: "lg"`, `aria-label` naming code and group |

Nine columns in the existing `DataTable`, which already scrolls horizontally.
The old "Groups" column (an aggregate of group numbers) is gone. Search: code,
name, group number, docente name. Filter: status only; no docente or days
filter. Order: MG-10. Rows of one subject repeat its name and career; there is
no row grouping (a grouped table needs a pattern `docs/design-system.md` does
not have). The list still holds links only, so the "GET never mutates" pin of
`guards.test.ts` holds unchanged.

### MG-17. One form, three modes

`asignatura-form.tsx` (`useActionState`, hand-dispatched submit, as today):

| Field | `create` | `add-group` | `edit` |
|---|---|---|---|
| Code | input | text + hidden field | text |
| Group number | input | input | text |
| Name, Career, Hours | inputs (career fixed for `coordinacion`) | **text, read-only** (from the code) | inputs; a change triggers the propagation confirm (MG-12) |
| Docente | `Combobox`, first option "No docente" (value `""`) | same | same |
| Days | `CheckboxGroup`, at least one (A8) | same | same |

- **Immutable after creation:** code and group number (A9). They are rendered
  as text and are absent from the update schema, so a submitted value is
  stripped.
- **Docente.** The existing `Combobox` over `listDocenteOptions()` (active
  docentes), plus one synthetic first item with an empty value. An empty or
  missing `docenteId` is "no docente"; anything else must be a well-formed id
  (`docenteId.invalid`) and an available docente (`docente_unavailable`,
  re-checked in the transaction). The label says the field is optional.
- **Days.** The existing `CheckboxGroup` and `Checkbox`, unchanged. A class
  imported without days must be given at least one day before any manual edit
  saves (the existing owner rule, now on this form).
- **Add another group.** The edit page shows one link, "Add group to this
  subject", to `/catalog/asignaturas/new?codigo=<encoded code>`. The `new`
  page reads `codigo` (a single string, trimmed, at most 32 characters) and
  calls `getSubjectByCodigo(scope, codigo)`. A hit renders `add-group` mode
  with the existing group numbers listed; a miss, a foreign code and a
  malformed value all render plain `create` mode with the same statements, so
  nothing distinguishes them. The form is keyed by the validated code, as
  `grupos/new` does today with `asignaturaId`.
- **Creating with a code that already exists** is refused under the code
  field: inside the scope, `codigo.exists` ("this subject already exists; add
  a group to it from its page"); outside it, the generic `codigo.taken`.
- **State section.** The two-step toggle, without the notice. Refusals of
  MG-14 are shown by the toggle's existing error line.
- **Design system.** No new colour, radius, type size, spacing step or
  primitive. The propagation confirm reuses the two-step pattern already
  documented in `docs/design-system.md` section 5; its confirm button is the
  default variant (it is not destructive). `.is-current` stays on the two
  breadcrumb pages only. Targets keep the 44px floor (`size="lg"`, 44px label
  rows). Errors sit under their field with `role="alert"`; the read-only
  subject fields are text with a visible label, not disabled inputs (a
  disabled Base UI field is not submitted and is skipped by some assistive
  technology).

### MG-18. Sidebar and i18n

- **Sidebar.** The `catalogGrupos` entry is removed. Order becomes
  `catalogAsignaturas`, `catalogDocentes`, `catalogImport`, `users`.
  `app-sidebar.test.tsx` pins the new ordered list for the five roles and the
  single `aria-current`.
- **Removed keys:** `nav.catalogGrupos`; all of `catalog.grupos`;
  `catalog.asignaturas.grupos.*`; `catalog.asignaturas.columns.groups`;
  `catalog.asignaturas.state.activeGroups`;
  `catalog.shared.refusals.activeGrupos`;
  `catalog.shared.refusals.parentInactive.asignatura`;
  `catalog.shared.fieldErrors.asignaturaId.*` and `periodo.*`;
  `catalog.import.entities.Grupo`; the import reasons
  `codigoAsignatura.*`, `periodo.*`, `asignatura.unresolved`,
  `asignatura.inactive`, `grupo.duplicate`, `codigo.duplicate`;
  `catalog.import.preview.manualGroups`;
  `catalog.import.result.manualGruposDeactivated`.
- **Added keys** (identical sets in `es` and `en`):
  `catalog.asignaturas.columns.{group,docente,dias}`, `noDocente`;
  `catalog.asignaturas.form.{numeroGrupoLabel,docenteLabel,docenteNone,diasLabel,diasHint,searchPlaceholder,noMatches,truncated,subjectFromCode,existingGroups}`;
  `catalog.asignaturas.page.{addGroupTitle,addGroupSubtitle,addGroupLink}`;
  `catalog.asignaturas.propagation.{title,body,confirm,cancel}`;
  `catalog.shared.fieldErrors.{codigo.exists,docenteId.invalid}` (the second
  exists) and `numGrupo.taken`, `numGrupo.takenInactive` reworded for "this
  subject" without a period;
  `catalog.shared.refusals.{docenteConflict,docenteConflictGeneric}`;
  import reasons `clase.duplicate`, `asignatura.inconsistent`,
  `docente.overlap`; structural `workbook.oldLayout`;
  `catalog.import.preview.{deactivations,manualClases}`;
  `catalog.import.result.manualClasesDeactivated`; contract rules
  `docenteBlank` and `absentDeactivated`.
- `catalog-parity.test.ts`: `GUARDED_SECTIONS` loses `catalog.grupos`,
  `catalog.grupos.errors` and `nav.catalogGrupos`; the four Grupo describes
  are deleted; `ROW_REASONS`, the list, form and page key pins and the
  entities pin (`["Asignatura", "Usuario"]`) are rewritten.

### MG-19. Import contract and the old layout

**Choice.** Two sheets:

| Sheet | Header must exist | Optional header |
|---|---|---|
| `Asignaturas` | `Codigo`, `Nombre`, `Carrera`, `HorasTotales`, `Grupo`, `CorreoDocente` | `Dias` |
| `Docentes` | `Correo`, `Nombre` | `Telefono` |

- The workbook header of the group number is **`Grupo`** (the proposal's
  name; today's `Grupos` sheet says `NumGrupo`). Its row errors keep the keys
  `numGrupo.*`.
- **`CorreoDocente` is a required header with an optional value.** A blank
  cell means "no docente" and clears a stored one (A6). If the header were
  optional, a workbook that simply lacks the column would clear every docente
  of the catalog; requiring the header makes that a structural error
  (`column.missing`) instead.
- `Dias` keeps today's semantics: `ABSENCE_SIGNIFICANT = { Asignaturas:
  ["Dias"] }`; an absent column and an empty cell both keep the stored days
  (A7); a non-empty cell replaces them; the import never clears days.
- **Old layout.** Before any row is read, `parseWorkbook` looks for a sheet
  named `Grupos` (compared with `normalizeKey`). If present, the workbook is
  refused with the structural reason `workbook.oldLayout`, whose copy names
  the two sheets and the seven columns and points to the template. A workbook
  with no `Grupos` sheet whose `Asignaturas` sheet lacks `Grupo` gets the
  existing `column.missing` naming `Grupo`.

  | Option | Verdict |
  |---|---|
  | **`Grupos` sheet present, then `column.missing`** | **Chosen**: the old template always has the sheet, so every old file gets the specific message; a half-converted file still gets a precise one |
  | Missing `Grupo` column only | Rejected: the old file would be told about one column, not that the layout changed |
  | Ignore a leftover `Grupos` sheet | Rejected: its rows would be silently discarded |

- **Template and card.** `template.ts` and the header strip of
  `workbook-contract.tsx` iterate `SHEETS`, so they follow with no logic
  change. `docs/PlantillaCatalogo.xlsx` and the `.xlsx` fixtures are
  regenerated by `build-fixtures.mjs` (binary files, outside the line count).

### MG-20. Planner

`planImport(workbook, snapshot)` stays one pure function. Stages:

1. **Docentes.** Unchanged logic, extracted to `plan-docentes.ts` so both the
   old and the new planner use it during the transition.
2. **Class rows**, in this order per row, each failure being one row error
   that skips the row:

   | Check | Reason | `value` |
   |---|---|---|
   | row schema | the zod keys (`codigo.*`, `nombre.*`, `carrera.*`, `horasTotales.*`, `numGrupo.*`, `correoDocente.invalid`, `correoDocente.tooLong`, `correo.loginTooLong`) | field name |
   | days tokens | `dias.invalid` | the token |
   | carrera resolves | `carrera.unresolved` | the cell |
   | key repeats in the workbook | `clase.duplicate` | `"<Codigo> <Grupo>"` |
   | docente (non-blank) resolves in the workbook or the snapshot | `docente.unresolved` | the cell |
   | subject fields equal the first valid row of the same code | `asignatura.inconsistent` | the code |

3. **Match** against the snapshot by `(Codigo, Grupo)`: `create` (origin by
   column default), `update` (any of: a subject field differs, the docente
   differs including to or from none, the row was inactive, the cell names
   days that differ from the stored mask) or `unchanged`. A matched inactive
   row is reactivated, as today.
4. **Subject sync.** A stored row of a code the workbook mentions, but whose
   group the workbook does not list, receives the workbook's subject fields
   too (`subjectSyncs`), so D9 holds for inactive rows as well. It is not a
   counted disposition.
5. **Deactivate absent (A5).** Every active stored class the workbook did not
   match goes to `deactivateAsignaturaIds`; `manualClasesToDeactivate` counts
   those with origin `manual`.
6. **Docente rule on the resulting state.** After the apply, the active
   classes of a code are exactly the workbook's valid rows of that code
   (everything else is deactivated by stage 5). The rule is therefore checked
   per code over the workbook rows, each with its **effective** mask: the
   cell's mask when it names a day, otherwise the stored mask of the matched
   row, otherwise `0`. A conflict is the row error `docente.overlap` on the
   later row, with `value` naming the other group number. This one check
   covers "inside the workbook" and "against stored rows" at once.
7. **Caps**, unchanged.

`EntityName` becomes `"Asignatura" | "Usuario"`. The reasons
`asignatura.unresolved` and `asignatura.inactive` disappear: there is no
second sheet that could reference a subject.

### MG-21. Apply order with non-deferrable indexes

A direct swap fails: with group 1 held by X and group 2 by Y on a shared day,
setting group 1 to Y collides with group 2 before group 2 is rewritten. The
apply therefore runs in five phases, each a plain statement group on the one
transaction:

```
runImportApply                              (lock, snapshot re-read and re-plan unchanged)
  A  DEACTIVATE absent     UPDATE ... SET "Activo" = false WHERE "Id" IN (deactivateAsignaturaIds)
  B  CLEAR                 UPDATE ... SET "DocenteId" = NULL WHERE "Id" IN (clearIds)
                           clearIds = matched rows that are active, have a docente,
                                      and whose docente or days will change
  C  USUARIOS              unchanged (new docente accounts get their ids)
  D  INSERT new classes    in their final state
     SUBJECT SYNC          UPDATE subject fields WHERE "Id" IN (subjectSync ids)
  E  ASSIGN                one UPDATE per changed matched row, to its final state
                           (subject fields, docente or NULL, days if named, activo true if reactivated)
  F  AUDIT                 last, same handle
```

Why no phase can collide: at every moment the rows present in the seven
indexes are a subset of the final state. Phase A and B only remove entries.
Rows not yet rewritten in phase E either keep their docente and days (they
already equal their final state) or were cleared in phase B or are inactive.
Inserted rows are final. The final state has no conflict, because the planner
checked it (MG-20 stage 6). `clearIds` is computed by the planner, so the
apply still only executes a plan.

`applyImport` keeps refusing a plan with errors, keeps the `dias` rule "a
falsy mask is never written", and issues no delete.

### MG-22. Preview, summary and the import audit payload

- `ImportPlan`: `writes.{asignaturas, usuarios}`, `deactivateAsignaturaIds`,
  `clearDocenteIds`, `subjectSyncs`, `asignaturasToReactivate`,
  `manualClasesToDeactivate`. `deactivateGrupoIds` and
  `manualGruposToDeactivate` are gone.
- **Preview.** The counts table has two entities. Before the confirm control
  it states, as sentences that say the action can still be cancelled: how
  many classes will be **deactivated** (`counts.Asignatura.deactivate`, the
  figure that protects against an incomplete workbook), how many of those were
  created by hand, and how many classes will be reactivated.
- **Summary and payload.** `ImportSummary` and
  `catalogo.importacion.aplicada` carry `conteos` keyed by the two entities,
  `cuentasCreadas`, `cuentasActualizadas`, `asignaturasReactivadas`,
  `asignaturasManualesDesactivadas`. `gruposManualesDesactivados` is no longer
  written.
- **Per-record events.** As today, each reactivated class gets
  `asignatura.reactivada` with the file digest. Deactivations and updates by
  the import stay counts only, as Grupo deactivations were.
- **Old payloads.** Rows already stored keep the three-entity shape. No code
  reads audit rows (R11), so no reader has to accept both shapes; the two
  shapes are documented in `modelo_datos_sql.md` for the future audit reader.

### MG-23. Audit types

- **Actions emitted for a class:** `asignatura.creada`,
  `asignatura.actualizada`, `asignatura.desactivada`, `asignatura.reactivada`.
  No new action name.
- **`AUDITABLE_ASIGNATURA_FIELDS`** becomes `["codigo", "nombre", "carreraId",
  "horasTotales", "activo", "numeroGrupo", "docenteId", "dias", "origen"]`
  (column order). `created` reports the whole list; `updated` reports
  `changedFields` over `["nombre", "carreraId", "horasTotales", "docenteId",
  "dias"]`; a state change reports `["activo"]`.
- **Payload.** `{ campos } & AuditOrigin`, plus the optional
  `propagadaDesde: number` set only by `asignaturaPropagatedEvent`. It is an
  entity id, like `entidadId`; it is not a field value.
- **`grupo.*`.** The four actions, the entity type `"Grupo"` and
  `AUDITABLE_GRUPO_FIELDS` leave the emit union `AuditEvent`, so no builder can
  produce them. They move to a read-only constant
  `HISTORICAL_AUDIT_ACTIONS` with the note that stored rows carry them and
  that their `EntidadId` values are ids of the dropped `Grupo` table (they
  never meant an `Asignatura` id). `types.test.ts` pins that the two lists are
  disjoint and that no builder returns a historical action.

  | Option | Verdict |
  |---|---|
  | **Out of the emit union, kept as a historical constant** | **Chosen**: emission becomes a compile error and the names stay discoverable for the future reader and its copy |
  | Keep them in `AuditEvent` | Rejected: a builder could still emit an event for a table that no longer exists |
  | Delete every trace | Rejected: the first audit reader would meet action codes the code base cannot name |

- **Leak sweep.** `audit-leak.test.ts` is rewritten over the six actions that
  remain (create, add group, update, state, import preview, import apply),
  with sentinels for the group number, the docente name and email, the days
  (code, long name, mask) and a sibling's group number, and it asserts that a
  propagated edit's events hold field names and ids only.

### MG-24. Snapshot and enrollment readers (`catalog.ts`)

- `loadCatalogSnapshot` projects, for `asignaturas`: `id`, `codigo`, `nombre`,
  `carreraId`, `horasTotales`, `activo`, `numeroGrupo`, `docenteId`, `origen`,
  `dias`. `grupos` is removed from `CatalogSnapshot`. `inscripciones` carries
  `asignaturaId`.
- `buildActiveClasesForEstudianteQuery(qb, { cif, codigoAsignatura })`: the
  classes of a code in which the student is currently enrolled; `Activo`
  required on `Inscripcion` and `Asignatura`; no `periodo` parameter (D8);
  selects `asignaturaId`, `numeroGrupo`, `docenteId` (nullable).
- `buildActiveEnrollmentQuery(qb, { cif, asignaturaId })`: same two activity
  conditions.
- Both still have **no application caller**; only `catalog.test.ts` changes.
  The future Solicitud change inherits two facts recorded here: a class may
  have no docente, and a class row is reused across terms (Open questions O2,
  O3).

### MG-25. Tests under Strict TDD

See *Testing Strategy*.

### MG-26. Delivery plan

See *Delivery Plan*.

### MG-27. Order relative to `catalog-management`

See *Order relative to catalog-management*.

---

## Data Flow

A manual edit that changes a subject field of a code with other groups:

```
form ── POST ──► updateAsignaturaAction
  1  requireCatalogAccess()                       first await; nothing of the body read before it
  2  addressed(id) via getAsignaturaById          lock-free; missing and foreign -> gone
  3  asignaturaUpdateSchema.safeParse             -> invalid
  4  withCatalogWrite(actorId, work, asignaturaWriteEvents)
       lock ─► updateAsignatura(tx, scope, id, data, { propagar: false })
              └─► confirm_propagation { afectadas: 3 }      no write, [] events
  5  state { kind: "confirm", afectadas: 3 }
form shows the two-step block ── confirm ── POST (same fields + propagar=si)
  1-3 as above
  4  lock ─► updateAsignatura(..., { propagar: true })
              UPDATE own row ─► UPDATE siblings (scoped, counted)
              └─► updated { id, campos, propagadas: [3 rows] }
           events: 1 asignatura.actualizada + 3 with propagadaDesde    same tx, last
  5  revalidatePath(list) + redirect(list)        outside try
```

Import apply: the phase diagram of MG-21.

---

## Interfaces / Contracts

```ts
// src/lib/catalog/origen.ts — PURE (renamed in the closing slice; values unchanged)
export const ORIGENES = ["importacion", "manual"] as const;
export type Origen = (typeof ORIGENES)[number];

// src/lib/catalog/constraints.ts — PURE
export const UQ_CLASE = "UQ_Asignatura_Clase";
export const DOCENTE_RULE_INDEX: Readonly<Record<string, DiaSemana>>; // seven names -> day
```

```ts
// src/lib/catalog/types.ts — PURE
export type AsignaturaListItem = {
  id: number; codigo: string; numeroGrupo: string; nombre: string;
  carreraId: number; carreraNombre: string; horasTotales: number;
  docenteId: number | null; docenteNombre: string | null;
  dias: readonly DiaSemana[];            // decoded, week order; the mask never leaves the data layer
  activo: boolean; origen: Origen;
};
export type AsignaturaDetail = AsignaturaListItem & { hermanas: number };
export type SubjectOfCodigo = {
  codigo: string; nombre: string; carreraId: number; carreraNombre: string;
  horasTotales: number; grupos: readonly string[];
};
export type DocenteConflicto = { numeroGrupo: string | null; dias: readonly DiaSemana[] };

export type AsignaturaWriteResult =
  | { kind: "created"; id: number }
  | { kind: "updated"; id: number; campos: readonly AuditableAsignaturaField[];
      propagadas: readonly { id: number; campos: readonly AuditableAsignaturaField[] }[] }
  | { kind: "unchanged"; id: number }
  | { kind: "not_found" }
  | { kind: "inactive" }
  | { kind: "codigo_taken"; inScope: boolean }     // create: the code already exists
  | { kind: "codigo_unavailable" }                 // add group: no row of the code inside the scope
  | { kind: "clase_taken"; activo: boolean }       // (code, group) exists
  | { kind: "carrera_invalid" }
  | { kind: "docente_unavailable" }                // missing, inactive or not a docente
  | { kind: "docente_conflict"; conflicto: DocenteConflicto }
  | { kind: "confirm_propagation"; afectadas: number };
export type AsignaturaActiveResult =
  | { kind: "changed"; id: number; activo: boolean }
  | { kind: "unchanged"; id: number }
  | { kind: "not_found" }
  | { kind: "docente_unavailable" }
  | { kind: "docente_conflict"; conflicto: DocenteConflicto };
// CatalogFormState gains: | { kind: "confirm"; afectadas: number }
```

```ts
// src/lib/data/catalog-scope-sql.ts — server-only
export function asignaturaInScope(scope: CatalogScope): SQL | undefined;        // kept
export function asignaturaRowInScope(scope: CatalogScope, id: number): SQL;     // kept
export function asignaturaCodigoInScope(scope: CatalogScope, codigo: string): SQL;  // new
// grupoRowInScope: removed

// src/lib/data/asignaturas.ts — server-only
export function buildAsignaturasWhere(scope, f: { status; q }): SQL | undefined;
export async function listAsignaturas(p): Promise<CatalogListResult<AsignaturaListItem>>;
export async function getAsignaturaById(scope, id): Promise<AsignaturaDetail | null>;
export async function getSubjectByCodigo(scope, codigo: string): Promise<SubjectOfCodigo | null>;
export async function listCarreraOptions(scope): Promise<{ id: number; nombre: string }[]>;
type Horario = { docenteId: number | null; dias: readonly DiaSemana[] };
export async function createAsignatura(tx, scope, input: Horario & {
  codigo: string; numeroGrupo: string; nombre: string; carreraId?: number; horasTotales: number;
}): Promise<AsignaturaWriteResult>;                       // origen: "manual"
export async function addGrupo(tx, scope, input: Horario & {
  codigo: string; numeroGrupo: string;
}): Promise<AsignaturaWriteResult>;                       // origen: "manual"
export async function updateAsignatura(tx, scope, id: number, input: Horario & {
  nombre: string; carreraId?: number; horasTotales: number;
}, opts: { propagar: boolean }): Promise<AsignaturaWriteResult>;
export async function setAsignaturaActivo(tx, scope, id: number, activo: boolean):
  Promise<AsignaturaActiveResult>;
```

```ts
// src/lib/validations/catalog.ts — PURE
export const asignaturaCreateSchema;   // codigo, numeroGrupo, nombre, carreraId?, horasTotales, docenteId (id | null), dias (>= 1)
export const asignaturaAddGrupoSchema; // codigo, numeroGrupo, docenteId, dias
export const asignaturaUpdateSchema;   // nombre, carreraId?, horasTotales, docenteId, dias   (no codigo, no numeroGrupo)
// grupoCreateSchema, grupoUpdateSchema: removed. CATALOG_FIELD_ERROR_KEYS loses
// asignaturaId.*, periodo.*, docenteId.required.

// src/app/(dashboard)/catalog/asignaturas/actions.ts — every one starts with requireCatalogAccess()
export async function createAsignaturaAction(prev: CatalogFormState, fd: FormData): Promise<CatalogFormState>;
export async function addGrupoAction(prev: CatalogFormState, fd: FormData): Promise<CatalogFormState>;
export async function updateAsignaturaAction(prev: CatalogFormState, fd: FormData): Promise<CatalogFormState>;
export async function setAsignaturaActivoAction(prev: ActiveToggleState, fd: FormData): Promise<ActiveToggleState>;
```

```ts
// src/lib/import/sheets.ts
export const SHEETS = [
  { name: "Asignaturas",
    required: ["Codigo", "Nombre", "Carrera", "HorasTotales", "Grupo", "CorreoDocente"],
    optional: ["Dias"] },
  { name: "Docentes", required: ["Correo", "Nombre"], optional: ["Telefono"] },
] as const;
export const ABSENCE_SIGNIFICANT = { Asignaturas: ["Dias"] };
export const RETIRED_SHEETS = ["Grupos"] as const;        // presence -> workbook.oldLayout

// src/lib/import/types.ts
export type EntityName = "Asignatura" | "Usuario";
export type AsignaturaRow = { id; codigo; numeroGrupo; nombre; carreraId; horasTotales;
  docenteId: number | null; dias: number; origen: Origen; activo: boolean };
export type AsignaturaWrite =
  | { kind: "create"; codigo; numeroGrupo; nombre; carreraId; horasTotales;
      docenteCorreo: string | null; dias?: number }
  | { kind: "update"; id: number; nombre; carreraId; horasTotales;
      docenteCorreo: string | null; reactivated: boolean; dias?: number };
export type ImportPlan = { ok; errors; counts: Record<EntityName, EntityCounts>; accountsToCreate;
  writes: { usuarios: UsuarioWrite[]; asignaturas: AsignaturaWrite[] };
  deactivateAsignaturaIds: number[]; clearDocenteIds: number[];
  subjectSyncs: { ids: number[]; nombre: string; carreraId: number; horasTotales: number }[];
  asignaturasToReactivate: number; manualClasesToDeactivate: number };
```

---

## Testing Strategy

Strict TDD: each row is a failing test first, in the same slice as the code
that turns it green. `vi.mock("server-only", () => ({}))` as established.

| Layer | What | Approach |
|---|---|---|
| Unit, pure | `docente-rule.ts`: every edge case of MG-13; symmetry; a property loop over random small sets comparing `conflictosDocente` with a brute-force pairwise check | Table-driven |
| Unit, pure | `constraints.ts` keys equal the names declared in `schema.ts` | Reads both |
| Unit, SQL text | `migration-0007.test.ts` (below) | `readFileSync` |
| Unit, schema | `schema.test.ts`: the ten columns, `DocenteId` nullable, no unique on `Codigo` alone, `UQ_Asignatura_Clase`, seven indexes with seven distinct bits and the three-part predicate, `Inscripcion` key and index, no `grupo` export | Introspection of the table objects |
| Unit, SQL shape | `asignaturaCodigoInScope` for the three scope kinds; the list where, order and left join; the two readers | `QueryBuilder().toSQL()` |
| Unit, pure | Manual schemas (blank docente is `null`, a `File` or a malformed id is `docenteId.invalid`, days rules unchanged); `changedFields` over the new list; every audit builder; `asignaturaWriteEvents` emits `1 + propagadas.length` events for `updated` and none for every refusal and for `confirm_propagation` | Table-driven, negative type tests |
| Unit, planner | Every scenario of MG-20; the swap case yields `clearDocenteIds`; no write ever carries `dias: 0`; a blank docente on a matched row yields `docenteCorreo: null`; the resulting-state rule with stored masks | Fixtures, no database |
| Integration, `tx` double | Each write: scope sentinel on every statement that names `Asignatura`; no insert when a refusal applies; propagation issues exactly two updates and throws on a count mismatch; `confirm_propagation` issues no update; the `23505` mapping per constraint name | Hand-rolled recording double |
| Integration, `tx` double | `applyImport`: statement order A, B, C, D, E, audit; phase B names only `DocenteId`; no delete | Same double |
| Integration, actions | Guard before any form read; `gone` for missing and foreign; the confirm round trip; refusal copy names the group and no out-of-scope value; `add-group` ignores submitted subject fields | `vi.mock` of guard and data layer |
| Integration, pages | Five-role table; `?codigo=` cases (valid, missing, foreign, malformed, array) render the same statements for every miss; no page imports an actions module | As today |
| Component | The form in three modes; "No docente"; the propagation block (focus, cancel restores, `aria-live`); values kept after `invalid` | Testing Library, real catalogs |
| i18n | Parity and the pinned key lists of MG-18 | Existing parity test |
| E2E | Not available (`openspec/config.yaml`) | |

**`migration-0007.test.ts`** is not an "additive only" test. It pins: one
file matching `0007_*.sql`; the first statement takes the advisory lock with
the literal `5005001`; the guard block precedes the first `ALTER`; the
statement order of MG-7 (the old unique dropped before the `INSERT`, the A1
update before the `INSERT`, the assertions before the contract, `DROP TABLE
"Grupo"` last and exactly once, without `CASCADE`); no `DELETE FROM`, no
`TRUNCATE`, no `INSERT`/`UPDATE`/`DELETE` on `EventoAuditoria`, no transaction
control outside `$$` bodies, no breakpoint inside a `$$` body; seven
`CREATE UNIQUE INDEX` with bits `1, 2, 4, 8, 16, 32, 64`; journal `idx: 7`;
snapshot chained to `0006`; the `0007` snapshot has no `Grupo` table. **The
consistency pin:** every index, constraint, FK and PK name the `0007` snapshot
holds for `Asignatura` and `Inscripcion` and the `0006` snapshot does not is
created by the SQL, and every such name the `0006` snapshot holds and `0007`
does not is dropped by it or belongs to `Grupo`.

**Tests deleted:** `grupos.test.ts`, the five test files under
`catalog/grupos/`, the Grupos-section tests of the Asignatura edit page, the
Grupo cases of `validations/catalog.test.ts`, `events.test.ts` and
`types.test.ts`, the four Grupo describes of `catalog-parity.test.ts`, and the
old `plan.test.ts`, `apply.test.ts`, `sheets.test.ts`, `schemas.test.ts` once
their successors are wired. **Rewritten:** `asignaturas.test.ts`, the
Asignatura action, form and page tests, `catalog.test.ts`, `schema.test.ts`,
`audit-leak.test.ts`, `import/actions.test.ts`, the import component tests,
`template.test.ts`, `parse.test.ts`, `app-sidebar.test.tsx`.

**Structural pins that change on purpose, and how each is proven.** A pin
that only loses entries cannot go RED first; each is proven by a mutation
check recorded in `apply-progress.md` (the offending line is restored
temporarily and the pin must fail).

| Pin | Change | Mutation check |
|---|---|---|
| `catalog-structure.test.ts` | `grupos.ts` and the `grupos` action dir leave the lists; the Grupo describe becomes: `asignaturas.ts` never mentions `inscripcion`, `setAsignaturaActivo` sets only `activo`, `buildAsignaturasWhere` never mentions `dias`; the origin pin stays | add `.delete(`, a second `.transaction(`, `origen` in a `.set(` |
| `scope-inventory.test.ts` | the `grupos.ts` module entry is removed; rows for `getSubjectByCodigo` and `addGrupo` added, `listAsignaturaOptions` removed | export a function with no row |
| `guards.test.ts` | segments `["asignaturas", "docentes"]`; exactly one actions module; a new pin that the directory `catalog/grupos` does not exist (D1) | recreate an empty `grupos/page.tsx` |
| `current-marker-usage.test.ts` | two breadcrumb pages; one form | write the marker in the form |
| `inscripcion-writes.test.ts` | **unchanged** (R6) | none needed; it must stay green in every slice |
| `audit-leak.test.ts` | rewritten (MG-23) | spread a data-layer result into a payload |
| `migration-0005.test.ts` | one import becomes a literal | change one literal |
| a new closing pin | no identifier `grupo` as a table, type or route under `src`, outside `numeroGrupo`, `addGrupo`, copy and the historical audit constant | reintroduce an import of the legacy table |

**Proved only by the Neon rehearsal, not by tests:** that the seven indexes
fire and stay silent as designed; that a unique index is checked per
statement, so phases A-E are needed and sufficient; that
`error.cause.constraint_name` carries the index name; the atomicity of the
migration; the rendered SQL of a multi-row insert with mixed key sets.

**Flake hygiene.** Queries after any interaction are `await
screen.findBy...`; every action promise a test starts is resolved inside
`act`; combobox options are awaited after typing and popup contents are never
read synchronously; the property loop of the rule test uses a fixed seed; no
test depends on the wall clock or on the order of object keys.

---

## Threat Matrix

The standard rows do not apply: the change runs no shell, subprocess, VCS or
PR automation and classifies no file as executable.

| Boundary | Applicability |
|---|---|
| Documentation-like paths; Git repository selection; Commit state; Push state; PR commands | **N/A**, for the reason above |

Boundaries this change has, carried with the same discipline:

| Boundary | Adversarial case | Design response | Planned RED tests |
|---|---|---|---|
| Object reference | A `coordinacion` actor posts a foreign class id, or a foreign `codigo` to `addGrupoAction` | Scope in every statement; `getSubjectByCodigo` answers `null`; `codigo_unavailable` is shown as the same "gone" | Sentinel tests; action tests with foreign ids and codes |
| Cross-scope propagation | An edit that reaches rows outside the actor's carrera | The sibling update carries the scope predicate and the count check fails loud | `tx`-double test with a mismatched count |
| Existence disclosure | `?codigo=` probing; the docente-conflict message | Same statements and markup for every miss; the message names a group only when the scoped read returned it | Page test; action test with an out-of-scope conflict |
| Hand-crafted form | `propagar=si` with no subject change; a submitted `codigo` or `numeroGrupo` on edit; subject fields on add-group; a `File` as `docenteId` | The flag only permits, never causes, a write; the schemas strip or reject | Schema and action tests |
| Mutation by GET | A link that adds a group or changes state | "Add group" is a link to a page; writes exist only as Server Actions | `guards.test.ts`, unchanged |
| Audit payload | A name, email, group number or day in `datos` | Field names from closed lists, plus ids | Leak sweep |
| Mass deactivation | An incomplete workbook | The preview states the count before confirm; nothing is deleted; a re-import reactivates | Preview component test; planner test |
| Destructive migration | Running `0007` on the wrong host, twice, or on changed data | Host restated per command; frozen hash; guards; backup branch; negative rehearsal | `migration-0007.test.ts`; gates |
| Physical delete | Any delete statement in the application | None exists | Structural pin |

---

## Migration / Rollout

### Preflight (read-only; the owner runs it first, on `production`)

`[READ-ONLY]`, no confirmation needed. Results go to `apply-progress.md`
(counts and catalog keys only).

```sql
-- P1 sizes
SELECT (SELECT count(*) FROM "Asignatura") AS asignaturas,
       (SELECT count(*) FROM "Asignatura" WHERE NOT "Activo") AS asignaturas_inactivas,
       (SELECT count(*) FROM "Grupo") AS grupos,
       (SELECT count(*) FROM "Grupo" WHERE "Activo") AS grupos_activos,
       (SELECT count(*) FROM "Inscripcion") AS inscripciones,
       (SELECT count(*) FROM "Asignatura" a WHERE NOT EXISTS
          (SELECT 1 FROM "Grupo" g WHERE g."AsignaturaId" = a."Id")) AS asignaturas_sin_grupo;

-- P2 periods (is text order chronological? is every value in the expected format?)
SELECT "Periodo", count(*) AS grupos, count(*) FILTER (WHERE "Activo") AS activos
FROM "Grupo" GROUP BY 1 ORDER BY 1;

-- P3 key collisions once Periodo is gone, with the A2 verdict per row
WITH r AS (SELECT g.*, row_number() OVER w AS rn, count(*) OVER (PARTITION BY "AsignaturaId", "NumeroGrupo") AS n
           FROM "Grupo" g WINDOW w AS (PARTITION BY "AsignaturaId", "NumeroGrupo"
             ORDER BY "Activo" DESC, "Periodo" DESC, "Id" DESC))
SELECT a."Codigo", r."NumeroGrupo", r."Periodo", r."Id", r."Activo", (r.rn = 1) AS se_conserva,
       (SELECT count(*) FROM "Inscripcion" i WHERE i."GrupoId" = r."Id") AS inscripciones
FROM r JOIN "Asignatura" a ON a."Id" = r."AsignaturaId" WHERE r.n > 1 ORDER BY 1, 2, r.rn;

-- P4 STOP: groups not carried over that have enrolments (must return no row)
--    = P3 filtered to (rn > 1 AND inscripciones > 0)

-- P5 STOP: docente overlaps among the classes that would be active (must return no row)
WITH r AS (SELECT g.*, row_number() OVER (PARTITION BY "AsignaturaId", "NumeroGrupo"
             ORDER BY "Activo" DESC, "Periodo" DESC, "Id" DESC) AS rn FROM "Grupo" g),
     c AS (SELECT r."Id", a."Codigo", r."NumeroGrupo", r."DocenteId", r."Dias"
           FROM r JOIN "Asignatura" a ON a."Id" = r."AsignaturaId"
           WHERE r.rn = 1 AND r."Activo" AND a."Activo")
SELECT x."Codigo", x."NumeroGrupo" AS grupo_a, y."NumeroGrupo" AS grupo_b,
       x."DocenteId", (x."Dias" & y."Dias") AS dias_comunes
FROM c x JOIN c y ON y."Codigo" = x."Codigo" AND y."DocenteId" = x."DocenteId"
                 AND x."Id" < y."Id" AND (x."Dias" & y."Dias") <> 0;

-- P6 active groups with no days recorded (they escape the rule; informational)
SELECT count(*) FROM "Grupo" WHERE "Activo" AND "Dias" = 0;

-- P7 group numbers that differ only by case, spaces or leading zeros (informational)
SELECT a."Codigo", array_agg(DISTINCT g."NumeroGrupo") FROM "Grupo" g
JOIN "Asignatura" a ON a."Id" = g."AsignaturaId"
GROUP BY a."Codigo", ltrim(lower(btrim(g."NumeroGrupo")), '0') HAVING count(DISTINCT g."NumeroGrupo") > 1;

-- P8 groups whose docente is inactive or not a docente (carried over as they are; informational)
SELECT count(*) FROM "Grupo" g JOIN "Usuario" u ON u."Id" = g."DocenteId"
JOIN "Rol" r ON r."Id" = u."RolId" WHERE NOT u."Activo" OR r."Codigo" <> 'docente';

-- P9 audit history that refers to the old shape
SELECT "Accion", count(*) FROM "EventoAuditoria"
WHERE "Accion" LIKE 'grupo.%' OR "Accion" = 'asignatura.creada' GROUP BY 1;

-- P10 migration state (seven rows expected; the last is 0006)
SELECT count(*), max(created_at) FROM drizzle.__drizzle_migrations;

-- P11 STOP unless the names equal finding R3, and nothing else depends on "Grupo"
SELECT conrelid::regclass AS tabla, conname, contype FROM pg_constraint
WHERE conrelid IN ('"Asignatura"'::regclass, '"Grupo"'::regclass, '"Inscripcion"'::regclass)
   OR confrelid = '"Grupo"'::regclass ORDER BY 1, 2;
SELECT tablename, indexname FROM pg_indexes
WHERE tablename IN ('Asignatura', 'Grupo', 'Inscripcion') ORDER BY 1, 2;

-- P12 the expected class rows, as one digest (compared with V2 after the migration)
--     same ranking as P3; one row per (Codigo, NumeroGrupo, DocenteId, Dias, Origen, activo esperado),
--     plus the group-less subjects as group '1'; md5 of the ordered string_agg, and the row count.
```

**Stop conditions before any gate:** a row in P4 or P5; P2 showing a period
whose text order is not chronological; P11 showing a name different from R3 or
another dependant of `Grupo`; P10 not at seven rows. Each stops the change and
goes back to the owner. P3 with rows is not a stop: its list is the "not
carried over" report the owner approves (A2).

### Gates

One step each; nothing batched. **HC** = the target host is read from the
connection string and restated before the command; the command is aborted if a
rehearsal step points at the shared host or a production step does not.

| Gate | Tag | Step |
|---|---|---|
| MG-G1 | `[READ-ONLY]` | Preflight P1-P12 on `production` |
| MG-G2 | `[USER]` | Owner reads the preflight: approves the P3 list, resolves P4/P5 findings (with today's screens, before anything else), confirms A2 |
| MG-G3 | `[CONFIRM]` | Local: `npm run db:generate -- --name merge_grupo_into_asignatura` (MG-6 step 1) |
| MG-G4 | `[CONFIRM]` | Local: the drift check of MG-6 step 3 |
| MG-G5 | `[USER]` + `[READ-ONLY]` | Written approval of the hand-written SQL and the `schema.ts` diff; freeze: sha256 of the file (working tree and LF) |
| MG-G6 | `[CONFIRM]` | **DB write.** Create Neon branch `rehearsal-0007-neg` from `production` |
| MG-G7 | `[CONFIRM]` | **DB write.** On `rehearsal-0007-neg`: one `UPDATE` that makes two active groups of one code share a docente and a day (the violating state for the guard) |
| MG-G8 | `[CONFIRM]` | **DB write (expected to fail).** `npm run db:migrate` against `rehearsal-0007-neg`, HC. It must stop with the guard's message, and afterwards `Asignatura` must have no `NumeroGrupo` column, `Grupo` must exist and the migration table must hold seven rows: this proves the guard and the atomicity |
| MG-G9 | `[CONFIRM]` | **DB write.** Delete `rehearsal-0007-neg` |
| MG-G10 | `[CONFIRM]` | **DB write.** Create a fresh Neon branch `rehearsal-0007` from `production` |
| MG-G11 | `[CONFIRM]` | **DB write.** `npm run db:migrate` against `rehearsal-0007`, HC |
| MG-G12 | `[READ-ONLY]` | Verification V1-V8 on `rehearsal-0007`; the rehearsal report is written |
| MG-G13 | `[CONFIRM]` | **DB write, rolled back.** Probes on `rehearsal-0007`, each in a transaction ending in `ROLLBACK`: each weekday index refuses a same-code, same-docente, same-day pair with `23505`; a null docente, `Dias = 0` and an inactive row do not collide; the same docente on the same day in two codes does not collide; a repeated `(Codigo, NumeroGrupo)` is refused; both CHECKs fire; an insert omitting `Dias`, `Origen`, `Activo` stores the defaults; a direct docente swap fails and the clear-then-assign order succeeds; counts equal before and after |
| MG-G14 | `[USER]` | Owner approves the rehearsal report. `rehearsal-0007` becomes the **development database** of every later slice; each manual smoke that writes to it is its own confirmed step |
| — | | Slices S05 to S48 land (see *Delivery Plan*) |
| MG-G15 | `[CONFIRM]` | **DB write.** Create a fresh branch `rehearsal-0007-final` from `production`, at most one day before the cutover |
| MG-G16 | `[CONFIRM]` | **DB write.** `npm run db:migrate` against `rehearsal-0007-final`, HC; then `[READ-ONLY]` P1-P12 on `production` again and V1-V8 on the branch; any difference from MG-G12 that the owner has not approved stops the cutover |
| MG-G17 | `[USER]` | Maintenance window opens: catalog writes stop (A12) |
| MG-G18 | `[CONFIRM]` | **DB write.** Create `backup-before-0007` from `production` (mandatory) |
| MG-G19 | `[READ-ONLY]` | Pre-apply re-check on `production`: P1, P4, P5, P10, P11; `.env` host equals the shared host; file hash equals MG-G5 |
| MG-G20 | `[CONFIRM]` | **DB write, irreversible.** `npm run db:migrate` against `production`, exact command and host restated first |
| MG-G21 | `[READ-ONLY]` | V1-V8 on `production`; then the smoke: read-only pages as each role and an import **preview** (writes nothing). Any smoke write (one manual edit, one import apply) is its own `[CONFIRM]` |
| MG-G22 | `[CONFIRM]` | **DB writes.** Delete `rehearsal-0007` and `rehearsal-0007-final`. `backup-before-0007` is deleted only on a date the owner names |

**The owner-confirmed commands that write to a database, one by one:** MG-G6,
G7, G8, G9, G10, G11, G13, G15, G16, G18, G20, G22 (two deletions), plus every
smoke write on the development branch or on production. MG-G3 and MG-G4 write
local files only and are still confirmed, as for `0005` and `0006`.

### Verification queries (read-only, after a migrate)

| # | Query | Expected |
|---|---|---|
| V1 | `count(*)` of `Asignatura` | `asignaturas_sin_grupo` + rank-1 groups of P1/P3 |
| V2 | the digest of P12 computed from `Asignatura` | equal to P12 |
| V3 | every pre-migration `Asignatura.Id` still exists | all present |
| V4 | `Asignatura` rows with a NULL `NumeroGrupo`; repeated `(Codigo, NumeroGrupo)` | none |
| V5 | `count(*)` of `Inscripcion`; rows whose `AsignaturaId` has no `Asignatura` | equal to P1; none |
| V6 | P5 rewritten over `Asignatura` | no row |
| V7 | codes with more than one distinct `(Nombre, CarreraId, HorasTotales)` | none |
| V8 | `to_regclass('"Grupo"')` is null; the seven `UX_Asignatura_Docente_*`, `UQ_Asignatura_Clase`, `IX_Asignatura_Docente`, `IX_Inscripcion_Asignatura` exist; eight migration rows, the last with the frozen hash | as stated |

V7 is also the standing consistency query for D9, run again at verify.

### Rollback

| Situation | Action |
|---|---|
| Nothing applied to production | `git revert` the slices in reverse order; delete `0007`, its snapshot and journal entry; delete the rehearsal branches |
| `0007` fails while running | One transaction: nothing remains (proved by MG-G8). Fix, re-freeze, restart at MG-G5 |
| `0007` applied, a defect found inside the window | Restore `production` from `backup-before-0007` (`[CONFIRM]`) and run the previous commit. Nothing is lost: writes were stopped |
| `0007` applied, defect found after the window | The same restore loses every catalog write made since the cutover; prefer a forward fix (a manual write or a re-import) unless the data itself is wrong |
| A slice misbehaves before the cutover | `git revert` of that slice; no applied schema is involved |
| A wrong write after the cutover | Corrected by another write or a re-import; each leaves its own audit row; no audit row is edited |

There is no down migration, by design.

---

## Delivery Plan

**Default, carried over from `catalog-management`:** one branch, chained
review slices of at most 800 changed lines each (additions plus deletions,
generated snapshots and binary `.xlsx` files excluded), split at the seams
below, no `size:exception`. **The owner may choose chained pull requests
instead** (Open question O1); the slice list is the same either way.

**Invariant:** after every slice `npm run typecheck`, `npm test`,
`npx eslint src` and `npm run build` pass.

### The ordering problem

New code needs the new columns on the table objects to compile, so the code
cannot go first. The schema cannot be applied to production first either: the
code on `main` and on today's branch would then fail against it. The answer:

1. **`schema.ts` and `0007` land early** (S02-S04) and are applied only to
   `rehearsal-0007`, which becomes the development database (MG-G14).
2. **From S03 until the cutover, this branch must not run against
   `production`.** Its inserts name `NumeroGrupo`, which production lacks. Any
   `npm run dev` or smoke uses a shell-scoped `DATABASE_URL` pointing at
   `rehearsal-0007`. The failure mode against production would be a
   rolled-back statement (`42703`), not corrupted data, but it is still
   forbidden. This is the ordering rule of `0005` and `0006`, held for the
   whole change instead of one unit.
3. **Production stays on the old schema and the old code** until MG-G20.
4. **Runtime coherence between slices is not promised; green is.** After S03
   the legacy Grupo code compiles against `legacy-grupo.ts` but would fail on
   the development database, where the table is gone. It is deleted next
   (S05-S17), before anything is built on top.

Three build styles, chosen per area:

| Area | Style | Why |
|---|---|---|
| Grupo pages, actions, data, audit | **Remove first** | Nothing replaces these files under the same name; they cannot run on a migrated database; deleting them first shrinks every later slice |
| Asignatura data, actions, pages | **In place**, vertical | Same files, same names; each slice changes a function with its callers |
| Import | **Beside, then switch, then delete, then rename** | R7: the type web cannot flip in place within the budget. The new pipeline lives in `src/lib/import/v2/` until wired, then the old files go and a rename-only slice moves `v2/*` up |

### Slices

Estimates are authored lines including tests and both locale files. Whole-file
deletions are counted at full length; a file longer than 800 lines is emptied
across consecutive slices at a `describe` boundary, tests before the code they
cover (R8).

| # | Slice | Seam and main files | Est. |
|---|---|---|---|
| S01 | Pure docente rule | `catalog/docente-rule.ts`, `catalog/constraints.ts` + tests | 350 |
| S02 | Legacy seam | `grupo` moves to `db/legacy-grupo.ts`; imports re-pointed | 120 |
| S03 | Schema and migration core | `schema.ts`, `schema.test.ts`, `0007` expand/backfill/re-point/contract/drop, core of `migration-0007.test.ts`, journal; forced fixes: `numeroGrupo: "1"` in the two existing inserts (the A1 value), `catalog.ts` readers and `inscripciones` projection | 700 |
| S04 | Migration guards, assertions, documents | guard and assertion blocks test-first, the consistency pin, `modelo_datos_sql.md`, the preflight and verification queries as a runbook file | 480 |
| | *Gates MG-G6 to MG-G14 run here, owner-paced; S05-S17 need no database* | | |
| S05 | Remove the tests that scan Grupo sources | the two parity describes that read `grupos/*.tsx` and `grupos/actions.ts`, the Grupo cases of `audit-leak.test.ts` (must go before the files they read) | 310 |
| S06 | Remove the Grupos section | `asignatura-grupos-section.tsx`, edit page and its tests, parity, copy | 700 |
| S07 | Remove `/catalog/grupos/new` | page + test; its `current-marker-usage` entry | 780 |
| S08 | Remove the sidebar entry and the list page test | `app-sidebar.tsx` + test, `nav.catalogGrupos`, `grupos/page.test.tsx` | 690 |
| S09 | Remove the list page and half the edit page test | `grupos/page.tsx`, first describes of `[id]/edit/page.test.tsx` | 670 |
| S10 | Remove the edit page | rest of its test, `[id]/edit/page.tsx`, `bound-controls.tsx`, marker entry | 610 |
| S11 | Remove the Grupo form test | `grupo-form.test.tsx` | 722 |
| S12 | Remove the Grupo form and the first action tests | `grupo-form.tsx`, first describes of `actions.test.ts` | 774 |
| S13 | Remove the Grupo actions | rest of `actions.test.ts`, `actions.ts`, the `guards.test.ts` module list; the directory is gone | 671 |
| S14 | Copy and pins after the removal | `catalog.grupos` copy, the parity Grupo copy describe, `GUARDED_SECTIONS`, the "no grupos directory" pin, `CatalogListBase` | 420 |
| S15 | Remove the Grupo writes | write functions of `grupos.ts` and their describes; structure and inventory rows | 790 |
| S16 | Remove the Grupo reads | rest of `grupos.ts` and its test, `scope-inventory`, structure describe | 770 |
| S17 | Retire Grupo audit, validation and types | `events.ts`, `types.ts` (historical constant), their tests, Grupo schemas, `grupoRowInScope`, Grupo types, field-error copy | 770 |
| S18 | Audit for class events | widened field list, `asignaturaPropagatedEvent`, result unions, `asignaturaWriteEvents` | 450 |
| S19 | Scope helper and manual schemas | `asignaturaCodigoInScope`, three schemas, field-error keys and copy | 550 |
| S20 | Data reads | where, list, get, `getSubjectByCodigo`, types; forced: the two old columns leave the pages | 650 |
| S21 | Data writes I | `createAsignatura`, `addGrupo`, docente checks, `23505` mapping | 750 |
| S22 | Data writes II | `updateAsignatura` with propagation, `setAsignaturaActivo`, structure pins | 750 |
| S23 | Actions I | create and add-group actions, copy | 700 |
| S24 | Actions II and the leak sweep | update with confirm, state refusals, `audit-leak.test.ts` rewritten | 780 |
| S25 | List page | nine columns, search, order, parity list keys | 700 |
| S26 | Form: create and edit | docente combobox with "No docente", days group, form keys | 650 |
| S27 | Form: add-group mode and the propagation block | read-only subject fields, two-step confirm | 500 |
| S28 | Pages | `new` with `?codigo=`, edit page link and State section, page tests, page keys | 700 |
| | *Owner smoke of the manual screens on the development branch* | | |
| S29 | Import v2: contract | `v2/sheets.ts`, `v2/schemas.ts`, `v2/types.ts` + tests | 600 |
| S30 | Docentes stage extracted | `plan-docentes.ts`, old planner delegates (refactor under green tests) | 250 |
| S31 | Import v2: planner I | row checks, match, create/update/unchanged, counts | 780 |
| S32 | Import v2: planner II | subject sync, deactivate absent, resulting-state rule, `clearDocenteIds`, caps | 700 |
| S33 | Import v2: apply I | phases A-E and their order | 700 |
| S34 | Import v2: apply II | orchestration, summary, import payload, reactivation events | 650 |
| S35 | Parse, template, fixtures | parametric contract, `workbook.oldLayout`, `build-fixtures.mjs`, `template.test.ts` | 600 |
| S36 | Switch I | `import/actions.ts`, state types, snapshot without `grupos` | 750 |
| S37 | Switch II | preview, contract card, errors, import copy, parity | 750 |
| | *Owner smoke of the import on the development branch* | | |
| S38 | Remove old planner tests 1 | first half of `plan.test.ts` | 780 |
| S39 | Remove old planner tests 2 | second half of `plan.test.ts` | 780 |
| S40 | Remove the old planner | rest of `plan.test.ts`, `plan.ts`, old fixtures | 645 |
| S41 | Remove old apply tests 1 | first describes of `apply.test.ts` | 780 |
| S42 | Remove old apply tests 2 | rest of `apply.test.ts` | 537 |
| S43 | Remove old apply and schemas | `apply.ts`, `schemas.ts` + test | 765 |
| S44 | Remove old contract; drop the legacy table file | `sheets.ts` + test, old `types.ts`, `legacy-grupo.ts`, the bridge value of S03 | 560 |
| S45 | Rename `v2/*` into place | rename-only, import paths | 90 |
| S46 | Origin rename and the applied-migration literal | `origen.ts`, `migration-0005.test.ts`, users | 120 |
| S47 | Documents | `docs/api-institucional/README.md`, the two import payload shapes, `docs/PlantillaCatalogo.xlsx` regenerated | 200 |
| S48 | Closing pins | the "no `grupo` identifier" pin, final sweep, records | 150 |
| | *Gates MG-G15 to MG-G22: final rehearsal, cutover, smoke* | | |

**Total: 48 slices, about 28,700 changed lines** (roughly 12,500 added or
rewritten and 16,000 deleted). Twenty slices are removals of code already
reviewed (S05-S17 and S38-S44).

**A removal rule the slices obey:** a test or pin that reads a source file by
path is removed or edited no later than the slice that deletes that file
(`catalog-parity`, `audit-leak`, `guards`, `current-marker-usage`,
`catalog-structure`, `scope-inventory` all do this), otherwise the suite goes
red in between.

**Levers the owner may pull, none decided here:**

- **L1.** Count a whole-file deletion as one review item instead of its line
  count. S05-S17 become five slices and S38-S44 two: **35 slices**. This
  changes the counting rule, so it is the owner's call (O1).
- **L2.** Keep the Hours column out of the list, or drop the per-record
  reactivation events: about 150 lines each.
- **L3.** Skip the origin lookup in the audit table for group-less subjects
  (MG-7): one statement less to rehearse.

---

## Order relative to `catalog-management`

**Recommendation: verify and archive `catalog-management` first, before S01,
waiving the items this change makes moot.** Not in parallel.

Reasons: (1) this change writes REMOVED and MODIFIED deltas, and the
`catalog-management` capability does not exist under `openspec/specs/` until
that change is archived (R11); (2) its verify must run on the tree it
describes, `d3a3997`; from S05 on, the Grupo code it specifies is gone and its
verify would fail; (3) two open changes editing the same specs and the same
files cannot both be archived cleanly.

Its open owner tasks, by what this change does to them:

| Tasks | Verdict |
|---|---|
| 10.15, 12.13, 13.13, 13.14 (Grupo data layer, actions, pages and their smoke) | **Waived**: the code is deleted |
| 19.14, 19.15, 20.13, 20.14 (Grupos section, preselection) | **Waived**: deleted |
| 21.7, 21.8 (Groups column of the list) | **Waived**: the column is replaced |
| 9.12, 9.13, 22.10, 22.11 (Asignatura write smoke, duplicate messages) | **Waived as superseded**: the form, the actions and the messages are rewritten here and smoke-tested after S28 |
| 15.6 (final rehearsal smoke) | **Waived** for its Grupo and three-sheet parts; nothing else remains in it |
| 17.30, 17.31 (import `Dias` on the Grupos sheet) | **Waived as superseded**: the token parser survives and is exercised by the new sheet after S37 |
| 18.11 (checkbox group checkpoint) | **Kept**: the component survives unchanged; a five-minute look |
| 14.10, 14.11 (Docentes read-only smoke) | **Kept**: the page survives unchanged |
| 15.7 (branch housekeeping) | **Kept**: old rehearsal and backup branches should be settled before new ones are created |
| 15.8, 15.9 (verify, archive) | **Kept**: they are this recommendation |

Each waiver is the owner's decision, recorded in that change's `tasks.md` by
the orchestrator with the reason "superseded by `merge-grupo-into-asignatura`".
Fallback if the owner declines: this change's deltas target the unarchived
change folder, and its archive is blocked until the other one closes.

---

## File Changes

| File | Action | Description |
|---|---|---|
| `src/db/schema.ts`, `schema.test.ts` | Modify | Target `asignatura` and `inscripcion`; no `grupo` |
| `src/db/legacy-grupo.ts` | Create, then Delete | Transitional home of the `grupo` table object (S02-S44) |
| `drizzle/0007_merge_grupo_into_asignatura.sql`, `drizzle/meta/0007_snapshot.json`, `_journal.json` | Create/Modify | Hand-written body, generated snapshot and journal |
| `src/db/migration-0007.test.ts` | Create | Structural test |
| `src/db/migration-0005.test.ts` | Modify | One import becomes a literal |
| `modelo_datos_sql.md`, `docs/api-institucional/README.md`, `docs/PlantillaCatalogo.xlsx` | Modify | Data model, mapping note, template |
| `src/lib/catalog/docente-rule.ts`, `constraints.ts` (+tests) | Create | The pure rule; the constraint map |
| `src/lib/catalog/{types,origen,list-params}.ts` | Modify | Class types and results; origin rename; `CatalogListBase` loses `/catalog/grupos`, `ASIGNATURA_GRUPOS_MAX` removed |
| `src/lib/data/asignaturas.ts` (+test) | Modify | The merged module |
| `src/lib/data/grupos.ts` (+test) | Delete | |
| `src/lib/data/catalog-scope-sql.ts`, `catalog.ts` (+tests) | Modify | MG-10, MG-24 |
| `src/lib/data/{catalog-structure,scope-inventory}.test.ts` | Modify | Pins |
| `src/lib/data/catalog-write.ts`, `inscripcion-writes.test.ts`, `users.ts` | Unchanged | |
| `src/lib/validations/catalog.ts` (+test) | Modify | Three class schemas |
| `src/lib/audit/{types,events}.ts` (+tests) | Modify | MG-23 |
| `src/lib/import/{sheets,schemas,types,plan,apply,summary,parse,template}.ts`, `plan-docentes.ts`, fixtures (+tests) | Modify/Create | MG-19 to MG-22, through `v2/` |
| `src/app/(dashboard)/catalog/asignaturas/**` | Modify | List, form, pages, actions; `asignatura-grupos-section.tsx` deleted |
| `src/app/(dashboard)/catalog/grupos/**` | Delete | Eleven files |
| `src/app/(dashboard)/catalog/import/**`, `src/app/api/catalog/template/*` | Modify | Preview, contract card, errors, template test |
| `src/app/(dashboard)/catalog/{guards,audit-leak,current-marker-usage}.test.ts` | Modify | Pins |
| `src/components/app-sidebar.tsx` (+test) | Modify | Entry removed |
| `i18n/es.json`, `i18n/en.json`, `src/i18n/catalog-parity.test.ts` | Modify | MG-18 |

Not modified: `withCatalogWrite`, the guard, `CatalogScope`, `dias.ts`,
`import/dias.ts`, `combobox.tsx`, `checkbox-group.tsx`, `form-field.tsx`,
`active-toggle.tsx`, `dias-cell.tsx`, `docs/design-system.md`, the Docentes
page, the audit table.

---

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| The irreversible migration damages production data | Low, very high impact | Guards and assertions inside the transaction; negative rehearsal; two rehearsals on fresh branches; mandatory backup branch; frozen hash; per-command confirmation |
| Production constraint names differ from the snapshot (R3) | Unknown | P11 is a stop condition before any gate |
| The migrator does not run `0007` atomically | Low | MG-G8 proves it on a throwaway branch before the real rehearsal |
| `generate` without `--custom` emits prompts or a snapshot that later drifts | Med | The drift check MG-G4; the consistency pin in `migration-0007.test.ts` |
| `error.cause.constraint_name` is absent, so a `23505` cannot be told apart | Low-Med | Probed in MG-G13. Without it the backstop falls to the generic message; the pre-check, not the backstop, is the normal path |
| Text order of `Periodo` is not chronological for a stored value | Unknown | P2; guard G-c |
| The branch is run against production between S03 and the cutover | Med | Ordering rule 2; the failure is a rolled-back statement; stated in every checkpoint |
| Production data changes between the first rehearsal and the cutover | Certain over weeks | MG-G15/G16 repeat the rehearsal on a fresh branch within a day; MG-G19 re-checks inside the window |
| Subject fields drift between rows of a code | Low | One write path, the count check, the planner check, the subject sync, V7 as a standing query |
| An incomplete workbook deactivates most of the catalog | Med, high impact | The preview states the count before confirm; nothing is deleted; a re-import reactivates |
| A unique violation aborts an apply | Low | The planner checks the resulting state; the five-phase order |
| Classes with no days escape the rule | Certain | Stated (O4); P6 counts them |
| An inactive class with an unavailable docente is stuck | Low | MG-14; the import exit; O5 |
| Removed URLs show the framework's unstyled 404 | Certain | Accepted by A11; O6 |
| A scope or authorisation check is lost in the rewrite | Med, high impact | Guard, scope-inventory, sentinel and leak tests are carried over slice by slice, never rewritten from memory |
| Nine columns on a narrow viewport | Med | Existing horizontal scroll; checked at 360px in the smoke |
| The combobox's empty-value item misbehaves under jsdom or Base UI | Med | Awaited queries; fallback is a separate "No docente" checkbox that disables the combobox, with no new token |
| Size: 48 slices, about twice the proposal's estimate | Certain | Named seams; twenty slices are removals; lever L1 |
| `catalog-management` left unarchived | Med | MG-27 |

---

## What this design does NOT do

- Build `Solicitud` or `SolicitudDetalle`, or decide who handles a request for
  a class without docente.
- Write `Inscripcion` from any application path, or touch student accounts.
- Keep a term history, a `Periodo` column or an archive table.
- Add hours of the day, classrooms or calendars.
- Edit or deactivate user accounts; the Docentes list stays read-only.
- Manage `Facultad` or `Carrera`.
- Rewrite, delete or migrate audit rows; add an audit reader.
- Physically delete a class row, or add any delete statement.
- Add a Dialog, AlertDialog, Tabs or any new primitive, token or design-system
  entry.
- Add a redirect or a catch-all for the removed URLs.
- Change the lock, the pooling mode, `prepare` or the session.
- Rename `middleware.ts`. Integrate the institutional API.
- Decide the delivery strategy or the counting rule for deletions.

---

## Departures from the proposal

| # | Departure | Why |
|---|---|---|
| P1 | **Size**: about 28,700 changed lines in 48 slices, against 13,000-16,000 in 16-20 | Bottom-up counts from real file lengths; deletions counted in full; the import built beside the old one adds its full deletion later (R7, R8) |
| P2 | **"Build beside, then remove" holds for the import only.** The Grupo pages, actions and data layer are removed before the merged screens are built | They cannot run on a migrated database and nothing replaces them under the same names; every slice still typechecks and passes, which was the stated purpose |
| P3 | **`CorreoDocente` is a required header** with an optional value; the proposal calls the column optional | A workbook lacking the column would otherwise clear every docente (MG-19) |
| P4 | **Stored rows of a mentioned code also receive the subject fields** when their group is absent from the workbook (subject sync) | D9 says every row of a code, and those rows are deactivated, not deleted |
| P5 | **`backup-before-0007` is mandatory** and a negative rehearsal is added | The migration is irreversible; the previous two were additive |
| P6 | **A transitional file `src/db/legacy-grupo.ts`** and a bridge value `numeroGrupo: "1"` in two old inserts exist from S03 to S44 | They keep the tree green between the schema slice and the removal of the old import |
| P7 | **One audit row per propagated class**, with `propagadaDesde` | Proposal question 10, decided in MG-12 |
| P8 | **Work-unit order**: WU7 (removal) moves ahead of WU2-WU5; WU3 (audit) is split around it | Consequence of P2 |
| P9 | Files not in *Affected Areas*: `src/db/legacy-grupo.ts`, `src/lib/catalog/{docente-rule,constraints}.ts`, `src/lib/import/plan-docentes.ts`, `src/lib/import/v2/**` (transitional), `src/db/migration-0005.test.ts`, `docs/api-institucional/README.md` | Consequences of MG-5, MG-11, MG-13, MG-20, MG-26 |
| P10 | The dependency "preflight results before the design is closed" is **not met** | No database was queried in this phase. MG-7 (period order, collision rule), MG-6 (object names) and the stop conditions are written to be confirmed or revised by MG-G1 and MG-G2 |

Nothing here contradicts D1-D9.

---

## Points the specs must pin

1. `(Codigo, NumeroGrupo)` is unique; the group number is mandatory and
   compared exactly after trimming; both are immutable after creation.
2. The docente is optional. The docente rule, with its five non-conflict cases
   (no docente, no days, inactive, disjoint days, different codes), is
   enforced on create, add group, a docente or days edit, reactivation and
   import, and by the database.
3. A refused write for the docente rule names the conflicting group number and
   the shared days, and nothing outside the actor's scope.
4. Deactivating a class is always allowed. Reactivating requires an available
   docente when there is one, and the docente rule.
5. Editing `Nombre`, `CarreraId` or `HorasTotales` of a class whose code has
   other groups requires an explicit confirmation that states how many other
   groups change; without it nothing is written. With it, every row of the
   code changes in one transaction.
6. Exactly one audit row per class changed by a propagated edit, each with
   field names only; the propagated ones name the class the edit came from.
7. Adding a group to an existing code takes `Nombre`, `CarreraId` and
   `HorasTotales` from that code; submitted values for them are ignored.
8. Creating a class with a code that already exists is refused, with a message
   that points to "add a group" only when the code is inside the caller's
   scope.
9. A code outside the caller's scope and a code that does not exist get the
   same answer on the "add group" entry point.
10. The manual form requires at least one day; the import accepts none.
11. Import: two sheets; `CorreoDocente` header required, value optional; a
    blank value clears the docente; `Dias` absent or empty keeps the stored
    days; a `Grupos` sheet refuses the workbook before any row is read with a
    message naming the new layout.
12. Import row errors: `clase.duplicate`, `asignatura.inconsistent`,
    `docente.overlap` (naming the other group), plus the kept ones.
13. Import: every active class absent from the workbook is deactivated, never
    deleted; the preview states that count, and how many were created by hand,
    before the confirm control.
14. Import: the stored rows of a mentioned code whose group is absent receive
    the workbook's subject fields.
15. `grupo.*` events are no longer emitted; stored ones are not changed; their
    entity ids refer to rows that no longer exist.
16. The import audit payload counts two entities and carries
    `asignaturasManualesDesactivadas`.
17. `/catalog/grupos/**` answers "not found"; the sidebar has no Grupos entry.
18. `Inscripcion` references the class row; no application path writes it.
19. `0007` preserves every Asignatura id, carries over every group or lists it
    in the rehearsal report, loses no `Inscripcion` row, and refuses to run on
    a group not carried over that has enrolments or on an existing docente
    overlap.

---

## Could not be verified

- Anything about the data: counts, periods, collisions, overlaps, `Inscripcion`
  rows, stored `grupo.*` audit rows (preflight).
- The real constraint and index names on production (P11).
- That `drizzle-kit generate --custom` copies the previous snapshot (inferred
  from R2; MG-6 does not depend on it, it only avoids it).
- The exact text drizzle-kit emits for the seven partial indexes and for the
  named unique constraint; the hand-written SQL follows the draft.
- That the migrator runs a migration in one transaction (MG-G8).
- That a unique index is checked per statement in the swap case (MG-G13).
- That the driver error exposes `constraint_name` through `error.cause`
  (MG-G13).
- That `db:migrate` reaches Neon through an endpoint on which
  `pg_advisory_xact_lock` inside the migration behaves as it does for the
  application (gate G6 of `catalog-management` proved it for the pooled
  application path).
- The `Combobox` with an empty-value item, under jsdom and in a browser.
- The exact describe boundaries at which the five long test files are split;
  the slice estimates assume roughly even halves.
- Whether anyone other than the developer uses `production` today, which
  decides how strict the maintenance window must be.

---

## Open Questions

### For the owner

- [ ] **O1. Delivery.** One branch with chained review slices of at most 800
      lines (default, 48 slices), or chained pull requests? And: may a
      whole-file deletion count as one review item (lever L1, 35 slices)?
- [ ] **O2.** Who handles a justification request for a class without
      docente? Out of scope here; needed before the Solicitud change.
- [ ] **O3.** With `Periodo` gone, a class row is reused when the same code
      and group return next term. Is it acceptable that the system keeps no
      record of which term a class row described, beyond the audit log and the
      backup branch?
- [ ] **O4.** A class with no days recorded cannot conflict under the docente
      rule. Acceptable, or must a class with a docente have days (which would
      make the import reject such rows)?
- [ ] **O5.** An inactive class whose docente is no longer available can only
      be recovered through the import. Should the State section offer
      "reactivate without docente"?
- [ ] **O6.** Removed `/catalog/grupos` URLs show the framework's default
      "not found" page (A11 as designed). Keep, or add a styled answer?
- [ ] **O7.** Confirm A2 after reading the P3 list: the surviving row of a
      period collision is the active one, otherwise the most recent period.
- [ ] **O8.** Confirm A6: a blank `CorreoDocente` clears the docente; and
      confirm that the header itself is mandatory (departure P3).
- [ ] **O9.** Origin of a subject that has no group today: taken from its
      `asignatura.creada` audit row when one says `manual`, otherwise
      `importacion` (MG-7). Accept, or use `importacion` for all (lever L3)?
- [ ] **O10.** How long is `backup-before-0007` kept?
- [ ] **O11.** The list keeps the Hours column (nine columns). Keep, or drop
      it from the list?
- [ ] **O12.** Waive the `catalog-management` tasks listed in MG-27 and
      archive it before S01?

### For the spec and tasks phases

- [ ] The workbook header is `Grupo` (MG-19); the spec must use the same word.
- [ ] The tasks phase fixes the describe boundaries of the five long test
      files and re-forecasts the slices that depend on them.
- [ ] If the preflight returns rows in P4, P5 or a mismatch in P11, MG-7 is
      revised before S03 is written.
