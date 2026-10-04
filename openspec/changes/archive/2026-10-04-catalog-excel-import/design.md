# Design: Internal Catalog Bulk Import from Excel (F2)

> **DB-touching change.** This document plans commands; it runs none. Nothing
> here may be applied to Neon without per-command user confirmation.

> **Size note**: the `sdd-design` skill caps a design at 800 words. This repo's
> own precedent (`openspec/changes/roles-lookup-table/design.md`, 1113 lines)
> and the 26 decisions the phase brief requires — 17 originally, plus 7 added
> when the append-only audit log (RNF-02, write events) moved into scope by
> explicit user decision, plus 2 for the partitioning decision below — make
> that cap unreachable without deleting
> rationale. Project convention wins (skill rule: "use the project's ACTUAL
> patterns"). The deviation is deliberate and recorded.

> **Binding user decision (this revision)**: `EventoAuditoria` is **partitioned
> by date from birth** (`PARTITION BY RANGE ("OcurridoEn")`), so that a future
> Ley 787 / RNF-06 retention limit can be met by detaching or dropping old
> partitions instead of `UPDATE`/`DELETE` on rows. **The purge itself is not
> implemented in F2** — only the schema that makes it possible. Decisions 18,
> 19, 20, 22 and 24 are amended; decisions 25 and 26 are new. Everything else
> is unchanged.

---

## Verified findings

### F1 — The driver is postgres-js over TCP, **not** the Neon serverless HTTP driver

`src/db/index.ts:1-2` is `drizzle-orm/postgres-js` + `postgres(env.DATABASE_URL, { max: 10 })`.
`@neondatabase/serverless` is absent from `package.json`. Consequences:

- `db.transaction()` is a **real interactive** `BEGIN`/`COMMIT`
  (`drizzle-orm/postgres-js/session.js` → `client.begin`), confirmed by the
  `roles-lookup-table` design's finding 1. The single-statement limitation of
  the Neon HTTP driver does **not** apply. All-or-nothing apply is available.
- Open check for WU1a (read-only): if `DATABASE_URL` points at a Neon `-pooler`
  (PgBouncer, transaction mode) endpoint, postgres-js's default prepared
  statements break and `prepare: false` is required. The app works today, so
  the endpoint is almost certainly direct — **verify before the first bulk
  apply**, do not change the connection blindly.

### F2 — `middleware.ts` cannot guard the template route

`middleware.ts:28` matcher is `/((?!api|_next/static|_next/image|favicon.ico|.*\.[\w]+$).*)`.
`api` is excluded, so `/api/catalog/template` is reached with **no** session
check. Every guard for that route must live in the route handler itself. This
is also why the forced-password-change check belongs in `requireUser`
(decision 12) and not in the proxy.

(`middleware.ts` still uses the pre-Next-16 name; Next 16 calls it `proxy.ts`,
`node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md:15`.
Renaming it is **out of scope** — it is a repo-wide migration, tracked in
`openspec/config.yaml` gotchas.)

### F3 — `bodySizeLimit` accepts a raw byte count

`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverActions.md:31,45`:
the option takes "the number of bytes or any string format supported by bytes",
the limit covers the **raw** multipart body including boundaries and part
headers, and "an additional 10–20 KB is a reasonable rule of thumb". So the
limit can be expressed as `MAX_FILE_BYTES + 64 KiB` exactly, which is what the
spec's "raised only as far as the configured maximum requires" asks for.

### F4 — `maxDuration` is a page-level segment export, and it is the only timeout lever

`.../03-file-conventions/02-route-segment-config/maxDuration.md:18`: "If using
Server Actions, set the `maxDuration` at the page level to change the default
timeout of all Server Actions used on the page." This matters because bcrypt at
cost 12 is ~250 ms per hash **single-threaded** (bcryptjs has no worker pool),
so provisioning N accounts costs ~0.25·N seconds of wall clock inside one
request. See decision 5.

### F5 — `server-only` modules are testable; the mock is an established pattern

`src/lib/data/roles.test.ts:3`, `src/lib/data/users-query.test.ts:4`,
`src/lib/auth/dal.test.ts:5` and `src/app/(dashboard)/users/new/actions.test.ts:8`
all open with `vi.mock("server-only", () => ({}))`. Vitest runs in `jsdom`
(`vitest.config.mts:10`) but on Node, so `node:crypto` and `node:buffer` are
available to the pure modules. No test infrastructure change is needed.

### F6 — Session compatibility is already structural

`isSessionPayload` (`src/lib/auth/session.ts:33-43`) validates by presence, not
by exact shape. Adding an **optional** `debeCambiarClave?: boolean` leaves every
JWT issued before this change valid, and `payload.debeCambiarClave === true`
reads `undefined` as "no change required" — which is exactly the
`forced-password-change` scenario *Sessions issued before this change*. No
session version bump, no forced re-login.

### F7 — drizzle cannot express a partitioned table, and `push` would actively fight one

Measured in this repo, not assumed:

- `drizzle-orm@0.45.2` contains **zero** occurrences of `PARTITION BY` or
  `partitionBy`. `pgTable` has no way to declare a partitioned table, a
  partition, or a partition bound. `drizzle-kit@0.31.10`'s only `PARTITION`
  strings belong to its bundled AWS SDK.
- drizzle-kit's introspection selects `c.relkind IN ('r','v','m')`
  (`node_modules/drizzle-kit/bin.cjs:17574,18435,83340,83834`). A partitioned
  **parent** is `relkind = 'p'` → **invisible** to `push`/`pull`. Each **child
  partition** is `relkind = 'r'` → visible as an ordinary table that the schema
  does not declare. So `drizzle-kit push` would propose **dropping**
  `EventoAuditoria_2026 … _default` while never seeing the parent at all.
  `push` was already banned by convention; here it is destructive.
- `generate` never connects to a database: it diffs the code against
  `drizzle/meta/*_snapshot.json`. A table absent from the schema graph is simply
  never mentioned — which is exactly what decision 26 exploits.

---

## Cross-check against the source requirements (the spec phase did not read these)

`modelo_datos_sql.md` (repo root — **not** in `documentacion-justifia/`, where
the brief expected it) and
`…/documentacion-justifia/requisitos_F_NF.md`, read in full for this phase.

| # | Finding | Severity | Resolution |
|---|---|---|---|
| X1 | `modelo_datos_sql.md` §3.1 defines `Grupo` and `Inscripcion` **without** an `Activo` column. The specs add one to both. | Extension, not contradiction | Keep the specs. The deactivate-absent lifecycle is what makes re-import safe and is what RF-31 needs to avoid stale enrollments. **WU1 must update `modelo_datos_sql.md` §3.1** and add a §4 note, exactly as `roles-lookup-table` amended §2. |
| X2 | The model has no `UQ_Usuario_Correo`. The specs add it. | Extension | Keep. It is what mechanically guarantees `Login` uniqueness (decision 7). Document in §3.1. |
| X3 | `Grupo.NumeroGrupo` is `VARCHAR(12)` in the model; spec scenarios write it as `1`, which reads as an integer. | Ambiguity | **Text wins.** `varchar(12)`, compared after `trim()`. `"01"` and `"1"` are therefore *different* groups — surfaced as an open question, because a workbook that mixes both silently creates two sections. |
| X4 | `modelo_datos_sql.md` §4 note 3 says `Grupo`/`Inscripcion` load "por importación (CSV del sistema académico) **o manualmente** cada periodo". RF-35 says Excel; the proposal excludes manual CRUD (default 5). | Contradiction (doc vs requirement) | **RF-35 is authoritative**: Excel, no manual CRUD in F2. WU1 corrects note 3 to say `.xlsx`. The "manual" half is a real future need — recorded as an open question, not built. |
| X5 | RF-35 lists the catalog as "facultades, carreras, asignaturas, **docentes**, inscripciones". It does **not** name *estudiantes* or *grupos*. The specs originally imported 7 sheets including both. | **RESOLVED by scope reduction** (product-owner decision, this revision) | The workbook drops from 7 sheets to 3 — **Asignaturas, Docentes, Grupos only**. `Facultades`, `Carreras`, `Estudiantes` and `Inscripciones` are no longer imported: `Facultad`/`Carrera` are seeded once outside this feature (a future admin screen is a separate initiative), and secretaría MUST NOT create student accounts — this fully resolves the personal-data-footprint concern this row raised. `Asignatura.CarreraId` stays a NOT NULL FK, so the Asignaturas sheet's `Carrera` column now MUST resolve by name to an already-existing `Carrera`; an unresolved reference is a row-level error, consistent with every other unresolved natural-key reference in this design. |
| X6 | RNF-02 requires an **inalterable audit log of every access and modification of personal data**. | **RESOLVED for writes — residual gap for reads** | User decision (binding): the append-only log is **in scope of F2 for WRITE events** (decisions 18–23). `EventoAuditoria` and its DB-enforced immutability trigger land in WU1; the event builders in WU2b and the writer in WU2c, inside the import's own transaction. **Read-access auditing remains deferred**: "every access" also covers every list and detail view of personal data, which is a cross-cutting change to every reader in the app, not an import concern. That residual half is an explicitly accepted gap with a named follow-up, not an oversight. Immutability is enforced only against the application's SQL path — see decision 19 for what is *not* enforceable. |
| X7 | RNF-14 requires the UI in Spanish. The specs require es **and** en catalogs. | No contradiction | `es` satisfies RNF-14; `en` is an existing project convention (`openspec/config.yaml`), kept. |
| X8 | RF-03 resolves docente+grupo "a partir del CIF y la asignatura" — period is not named; RF-31 adds "durante el período". RF-02 handles the >1-active-group case. | Consistent | Index design (decision 11) serves `(Cif, Asignatura.Codigo, Periodo)` and returns **all** matching active groups, so RF-02 can ask which one. It must not silently pick one. |
| X9 | `Asignatura` in the model carries `CK_Asignatura_Horas CHECK ("HorasTotales" > 0)`. The spec requires the write to be *refused*, and the proposal's schema list omits the CHECK. | Omission in the proposal | **Include the CHECK.** The spec scenario "Non-positive or missing HorasTotales is rejected" asks for a refused *write*, not only a refused row. |

---

## Technical Approach

One **pure planner** is the whole design. `planImport(workbook, snapshot)` is a
total function from (parsed rows, a snapshot of the current catalog) to an
`ImportPlan` — every count, every row error, every id to deactivate. The
dry-run is that function and nothing else. The apply is that same function run a
second time *inside* the transaction against a snapshot read inside the
transaction, followed by a dumb writer that executes the plan it was handed.
Nothing else in the change contains a decision, so nothing else needs a database
to be tested — which is what makes strict TDD viable at this size (approach 1 of
the exploration).

Everything impure is pushed to the edges: `parse.ts` (exceljs → plain rows),
`catalog.ts` (snapshot read), `apply.ts` (chunked writes). Credentials never
touch a decision path: they are generated after planning, hashed before the
transaction opens, and returned in the action's value.

The audit log follows the same shape and adds no new one. `src/lib/audit/` is
**pure**: `AuditEvent` values are built from the plan by total functions with no
clock, no id generation and no I/O. The only impure part is
`src/lib/data/audit.ts`, one chunked `INSERT` called by `apply.ts` as the last
statement group **inside the same transaction**, so an import that rolls back
leaves no audit row and an import that commits cannot commit without one.

The audit **table** is the one place where this change deliberately steps
outside the ORM. It is partitioned by date so that a retention limit can later
be met by dropping a time slice rather than deleting rows (decision 25), and
drizzle cannot express that (F7) — so the table is declared in TypeScript for
typing only, and its DDL is one hand-written, fully reviewed migration
(decisions 20, 26). Nothing else in the change leaves drizzle's generator.

Specs: `specs/academic-catalog`, `specs/catalog-excel-import`,
`specs/imported-account-provisioning`, `specs/forced-password-change`,
`specs/audit-log`.

---

## Architecture Decisions

| # | Decision | Alternatives rejected | Rationale |
|---|---|---|---|
| 1 | **`exceljs`, pinned exact, as the single read+write library — conditional on an advisory gate that is a blocking WU2a precondition.** Pre-approved fallback if the gate fails: `read-excel-file` + `write-excel-file`. | npm `xlsx` (SheetJS); `@e965/xlsx` fork; `node-xlsx`; hand-rolling a ZIP+SpreadsheetML reader | npm `xlsx` is excluded by the proposal (stale on the registry, known advisories) and the forks inherit its parser, so they are the same risk with a different name. Among the rest only `exceljs` **writes** as well as reads, and the template (a hard spec requirement) needs a writer — the alternative is two dependencies and two parsers to audit instead of one. Hand-rolling is writing a parser for untrusted input, which is the opposite of the risk posture here. **Honest limitation: this phase has no web or registry tool, so the advisory status could not be verified now.** The gate is therefore written as a task, not asserted as a fact: before the dependency is committed, run `npm audit --omit=dev`, check the GitHub Advisory Database for `exceljs` and its transitive `unzipper`/`archiver`/`saxes` chain, install with `--ignore-scripts`, and pin the exact version. A high/critical finding switches to the fallback pair **without redesign**, because only `parse.ts` and `template.ts` touch the library |
| 2 | **Guards run on `Uint8Array` + filename, in a pure module, in this fixed order**: file present and non-empty → extension `.xlsx` (case-insensitive) → first two bytes are `0x50 0x4B` (`PK`) → size ≤ `MAX_FILE_BYTES`. Only then is the library called; row caps are checked during parsing | MIME type from the browser; sniffing after parsing; letting the library reject; a single combined check | The browser-supplied `File.type` is attacker-controlled and empty on many clients. Checking size *after* handing bytes to a ZIP reader is the zip-bomb hole. Keeping the four checks pure and ordered makes each one a one-line table-driven test, which is exactly the spec's *Rejected uploads* table. The library never sees a file that failed a cheaper check |
| 3 | **Caps: `MAX_FILE_BYTES = 5 MiB`, `MAX_ROWS_PER_SHEET = 10 000`, `MAX_ROWS_TOTAL = 30 000`, `MAX_NEW_ACCOUNTS_PER_APPLY = 250`.** All in one pure `src/lib/import/limits.ts` with **no imports**, so `next.config.ts` can import it too | Hard-coding the limit in `next.config.ts`; no account cap; a cap expressed in the UI only | `Grupos` can still dominate the row count at scale (every asignatura × period can carry several sections), so a per-sheet cap alone would let the total run away; both caps exist. The account cap is the one that is **not** cosmetic: F4 measures ~0.25 s of single-threaded bcrypt per new account, so 250 accounts ≈ 60–70 s of wall clock inside one request. Without the cap a first import of a whole faculty is a guaranteed gateway timeout that the spec explicitly forbids presenting as a timeout. With it, the dry-run reports "too many new accounts, split the workbook" as a *validation* error. A single constants module with zero imports is the only shape `next.config.ts` can consume (it is loaded outside the `@/` alias and outside the app's env validation) |
| 4 | **`bodySizeLimit: MAX_FILE_BYTES + 64 * 1024` (5 308 416 bytes), as a number, derived from decision 3** | `'6mb'`; `'10mb'`; leaving the 1 MB default and chunking the upload | F3 says the limit covers multipart framing and suggests 10–20 KB of slack; 64 KiB is four times that and still a *derived* number, so the config cannot drift from the guard. A round `'6mb'` would grant ~700 KB of unexplained headroom to **every** server action in the app, which is the proposal's own DoS risk. Chunked upload is a protocol the stateless two-step flow does not have and does not need |
| 5 | **`export const maxDuration = 300` on `catalog/import/page.tsx`** (F4), and the dry-run surfaces the new-account count so the operator sees the cost before confirming | Leaving the platform default; a background job/queue; lowering bcrypt cost for temporary passwords | The provisioning cost is real and bounded by decision 3; naming it in the build output is the only lever Next gives. A queue is infrastructure this project does not have and would break the all-or-nothing guarantee. Lowering the cost below 12 contradicts an explicit spec MUST and would weaken exactly the credentials most likely to be written on paper. **Open question: the deployment target is unknown** — 300 s exceeds Vercel Hobby's 60 s ceiling, in which case decision 3's account cap must drop to ~200 |
| 6 | **Sheet and column contract is data, in `src/lib/import/sheets.ts`; headers are matched normalized** (trim → lowercase → strip diacritics); unknown extra columns are ignored; a missing required column is a *structural* error naming sheet and column | Positional columns; exact-string headers; free-form header aliases | Secretaría edits this file in Excel; a trailing space or `Código`/`Codigo` must not destroy an import, but a *renamed* column must fail loudly rather than import nulls. Ignoring extra columns lets the institution keep its own annotations in the same file. Positional matching breaks the moment anyone inserts a column |
| 7 | **`normalizeEmail = trim → toLowerCase`, and `Login` is that whole normalized email.** No dot-stripping, no `+tag` removal. An email longer than `Login`'s 60 chars is a **row error**, never truncated | Local part only; Gmail-style canonicalisation; truncate to 60; suffix on collision | `Correo` is `varchar(160)` and `Login` is `varchar(60)` (`schema.ts:72,78`) — that gap is a real, silent identity hazard the specs do not mention, and truncating would let two distinct institutional mailboxes collapse into one account. Dot/plus canonicalisation is a Gmail policy, not an institutional one; applying it would merge `a.b@uni.edu` and `ab@uni.edu`, which may be two people. Using the full email is what makes `UQ_Usuario_Correo` mechanically imply `Login` uniqueness (proposal, X2) |
| 8 | **Temporary password: 16 characters drawn with `node:crypto.randomInt` from a 32-symbol ambiguity-free alphabet** `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no `0O1IL`), = 80 bits. `generateTemporaryPassword(randomInt = crypto.randomInt)` takes the RNG as a parameter | `Math.random`; `randomBytes` + modulo; a UUID; a memorable word list; including symbols | `Math.random` is not a CSPRNG and must never generate a credential. `randomBytes % 32` happens to be unbiased for 32 but teaches a pattern that is biased for any other alphabet size; `randomInt` is unbiased by contract. A UUID is 122 bits but full of `0`/`1`/`l` and awkward to read aloud from a printed sheet — these passwords *will* be transcribed by hand. Symbols would collide with CSV/Excel quoting (decision 10). 80 bits is far past "unguessable" while staying transcribable. Injecting the RNG makes alphabet/length/uniqueness unit-testable deterministically while the default stays cryptographic |
| 9 | **The one-time export never leaves memory on the server.** `applyAction` returns `credentials: { login, nombreCompleto, clave }[]` in its action result; a **client** component turns that array into a `Blob` and a `URL.createObjectURL` download. No server file, no second request, no URL to replay, no session storage | A server-generated temp file plus a download URL; a signed one-time token; stashing it in the session/cookie; emailing it | Anything with a *URL* is retrievable twice, which the spec forbids outright ("MUST NOT be re-displayed by any later request"). A temp file on the server is plaintext credentials at rest — the exact High-impact risk in the proposal. The session is a JWT in a cookie, i.e. plaintext credentials in the browser's cookie jar *and* in every subsequent request. The action's return value exists only in this one response and in React state; a reload loses it, which is precisely the specified behaviour. Email is RNF-07 territory and explicitly out of scope |
| 10 | **Export format is CSV with a UTF-8 BOM, built by a pure `credentials-csv.ts`, with CSV-injection neutralisation** (`=`, `+`, `-`, `@`, tab, CR are prefixed with `'`) | `.xlsx` built in the browser; `.xlsx` built on the server; JSON; plain text | Building `.xlsx` client-side would ship ~1 MB of `exceljs` into the browser bundle for a file written once; building it server-side re-introduces server-side credential bytes and a second request. The BOM is what makes Excel open UTF-8 CSV with correct accents by double-click. Injection neutralisation is not theoretical: `NombreCompleto` comes from the untrusted workbook and lands in a file the operator will open in Excel; decision 8's alphabet already excludes the dangerous leading characters from the password column |
| 11 | **Indexes (migration 0003)**: `UQ_Grupo_Seccion (AsignaturaId, Periodo, NumeroGrupo)` — also the RF-03 lookup prefix; `IX_Grupo_Docente (DocenteId)`; **partial** `IX_Grupo_Activo (AsignaturaId, Periodo) WHERE "Activo"`; `IX_Inscripcion_Grupo (GrupoId)`. `Inscripcion`'s composite PK covers by-student lookups. **No** partial index on `Inscripcion` | A partial `Inscripcion` index on `(EstudianteId, GrupoId) WHERE Activo`; no partial indexes at all; a covering index per query | RF-03/RF-31 read `Usuario.Cif → Inscripcion(PK, leading EstudianteId) → Grupo(AsignaturaId, Periodo, Activo)`, so the PK already serves the first hop and the partial index serves the second while excluding the deactivated rows the readers must never see. `IX_Inscripcion_Grupo` exists because the PK's leading column is `EstudianteId`, so the roster-of-a-group direction has no index otherwise. The `Inscripcion` partial index is skipped deliberately: the table is the bulk-written one and every extra index is paid on every import, while the PK plus an `Activo` filter is adequate at faculty scale — recorded as the documented upgrade path |
| 12 | **The forced-change redirect lives in `requireUser` (`src/lib/auth/dal.ts`), one line, not in the proxy.** `requireRole` inherits it for free because it calls `requireUser` first (`dal.ts:23`) | A check in `middleware.ts`/`proxy.ts`; a check in `(dashboard)/layout.tsx`; a check repeated in every action; a new `requireChangedPassword` wrapper each caller must remember | F2 proves the proxy **cannot** see `/api/catalog/template`, so a proxy-only check would leave a role-guarded download reachable by a flagged user — a scenario the spec asserts explicitly. A layout check misses server actions entirely (actions do not inherit page guards — `openspec/config.yaml` convention). Repeating it per call site is the drift the project already rejected for role checks. Putting it in `requireUser` also gives the spec's required ordering for free: the flag is checked **before** `requireRole`'s role check, so a flagged user is never shown a role denial first |
| 13 | **The change-password screen is `src/app/change-password/`, a top-level segment outside `(dashboard)`, and it uses `requireUserAllowingPasswordChange()` — a second, sibling DAL function that redirects only the anonymous case.** `PASSWORD_CHANGE_PATH` joins `ACCESS_DENIED_PATH` in `src/lib/auth/routes.ts` | Putting it under `(dashboard)`; a boolean parameter on `requireUser`; an allow-list of exempt paths inside `requireUser`; no guard at all | This is the loop proof and it is **structural**, not argued: the only page reachable while flagged is served by the only guard that cannot emit that redirect, so it cannot redirect to itself. A boolean parameter means one forgotten `true` re-arms the loop; a path allow-list inside `requireUser` requires the DAL to know the current URL, which it does not have. Under `(dashboard)` the layout's own `requireUser` would fire the redirect before the page rendered. It follows the `/denied` precedent (`roles-lookup-table` decision 14) verbatim, including reusing `src/lib/auth/routes.ts` so the string exists once. `logoutAction` (`login/actions.ts:55-58`) calls **no** guard today, so "logout remains reachable" is already true and only needs a test to keep it true |
| 14 | **`SessionPayload.debeCambiarClave?: boolean` — optional, `=== true` at every read.** `isSessionPayload` accepts `undefined \| boolean` | A required field with a session version bump; a DB lookup per guarded request; a separate cookie | F6: optional is what makes every live session survive the deploy, which the spec requires. A required field would log every user out. A per-request DB read is what the spec forbids ("without requiring any extra query per guarded request") and would put a query in front of every page. After a successful change the action re-signs and re-sets the cookie, so the flag clears without re-login |
| 15 | **One planner, run twice; the file hash is evidence, not a lock.** Preview returns `sha256` of the bytes; the confirm form carries it in a hidden field; on apply the server recomputes the hash of the file it actually received and, **if it differs, returns a fresh preview instead of applying** | Rejecting a hash mismatch as an error; trusting the hidden hash; server-side draft state keyed by hash; no hash at all | The spec is explicit that confirming with a different file must plan file B on its own, so a hard reject would contradict it — but silently applying a file the operator never previewed is the worst outcome available. Re-previewing satisfies both. The hidden field is **never trusted as authority**: it is only ever compared against a server-recomputed digest, so a forged value can at most force an extra preview. Any server-side draft keyed by the hash is the state the whole approach exists to avoid |
| 16 | **`applyImport` returns `ImportSummary { actor, at, fileSha256, counts, accountsCreated, accountsUpdated }` and logs exactly that, once, as one structured line.** Credentials and hashes are structurally absent from the type | Logging the plan; logging per row; no log | Making credentials *absent from the type* rather than *filtered before logging* is what makes "logs are clean" a compile-time property instead of a review promise. Per-row logging at 30 000 rows is a denial of service against the log. The summary was designed as the RNF-02 seam and is now **used** as one: the import audit row's payload is this object minus the two fields that became columns (decision 22) |
| 17 | **Six chained work units, not the proposal's three** (see *Work Units*). | The proposal's WU1/WU2/WU3; one PR | Measured against the 800-line budget, the proposal's WU2 and WU3 are each ~1 200–1 450 authored lines. Splitting is not optional |
| 18 | **One table, `EventoAuditoria`**, Spanish PascalCase like every existing table, **partitioned by range on `OcurridoEn`** (decision 25): composite PK **`(Id, OcurridoEn)`**, `Id` identity, `ActorId` bigint **NOT NULL** → `Usuario.Id`, `OcurridoEn` timestamptz NOT NULL `defaultNow()`, `Accion` varchar(60) NOT NULL, `EntidadTipo` varchar(40) NOT NULL, `EntidadId` bigint **nullable**, `Datos` jsonb NOT NULL default `'{}'`. Three indexes, all declared **on the parent** so Postgres propagates them to every partition: `IX_EventoAuditoria_Entidad (EntidadTipo, EntidadId, OcurridoEn DESC)`, `IX_EventoAuditoria_Actor (ActorId, OcurridoEn DESC)`, `IX_EventoAuditoria_Ocurrido (OcurridoEn)` | One table per audited entity; an `EventoAuditoria` + `EventoAuditoriaDetalle` pair; a `text` payload; an enum column for `Accion`; a single index | The three indexes are exactly RNF-02's three read axes — *what happened to this person* (the data-subject request Ley 787 makes answerable), *what did this actor do*, and *what happened in this window* (the retention sweep). Index cost is normally the argument against three, but decision 21 caps an import at ~2 001 audit rows, so the write cost is ~1 % of the `Inscripcion` volume this design already accepts. `Accion` is `varchar`, not a pg enum, for the same reason `Rol.Codigo` is: a new action code must not require a migration. `EntidadId` is nullable because the import event names no row (it *is* the event); a `CHECK` forcing it NOT NULL for `EntidadTipo = 'Usuario'` is the one integrity rule worth encoding. `jsonb` over `text` because RNF-02 reads must filter on payload keys without parsing in the app. **Partitioning forces the rest of this row; they are consequences, not preferences.** Every unique constraint on a partitioned table must contain every partition-key column, so the PK becomes `(Id, OcurridoEn)` and `Id` alone is unique only because one sequence feeds every insert — not because a constraint says so. That is acceptable and even useful here: with no single-column unique key there is **nothing for a future foreign key to reference**, so "nothing references the audit log" stops being a convention and becomes structural. `GENERATED ALWAYS AS IDENTITY` on a **partitioned parent** is version-dependent (believed to need PG 17; older servers reject it outright) and this phase has no database and no documentation tool, so it is written as a **read-only pre-check, not an assertion**: `SELECT current_setting('server_version_num')` runs before WU1b writes `0004` (*Migration / Rollout* step 1). Documented fallback on an older server: `CREATE SEQUENCE "EventoAuditoria_Id_seq"` + `"Id" bigint NOT NULL DEFAULT nextval(…)`, nothing else changed. Because drizzle-kit never sees this table (decision 26), the `.generatedAlwaysAsIdentity()` in TypeScript is **pure typing** and is identical under either SQL form. The `ActorId` FK points *from* a partitioned table *to* a regular one, which every PG version Neon offers supports, and is cloned into each partition. `IX_EventoAuditoria_Ocurrido` is now partly redundant with partition pruning, and is kept anyway: pruning narrows to a whole year, and a data-subject or retention query still scans inside it |
| 19 | **Immutability is enforced by a `BEFORE UPDATE OR DELETE` row trigger *and* a `BEFORE TRUNCATE` statement trigger, both raising `42501`; `REVOKE UPDATE, DELETE, TRUNCATE … FROM PUBLIC` is added as defence in depth and is explicitly NOT the mechanism.** Scope is documented rather than overclaimed | A trigger alone; REVOKE alone; a rules-based `DO INSTEAD NOTHING`; a separate append-only DB role now; application-level "never update" discipline | The app connects with **one** role over postgres-js/TCP (F1), and that role runs the migrations, so it **owns** the table. An owner can re-grant to itself, so `REVOKE` against the owner is a speed bump, not a barrier — stating it as the mechanism would be false. A trigger, by contrast, fires for **every** role including the owner and a superuser, so the application's entire SQL surface — an ORM mistake, an injected `UPDATE`, an operator's ad-hoc statement over the app connection — is genuinely blocked. `TRUNCATE` bypasses row triggers, which is why the second, statement-level trigger exists; a design with only the first would have an open hole. **Not enforceable, and recorded as such**: the owner role can `ALTER TABLE … DISABLE TRIGGER`, `DROP TABLE` or — now — `DROP`/`DETACH PARTITION`, and a Neon branch/instant-restore can rewind the table wholesale. Closing that needs a second Neon role (DDL owner vs. an app role holding only `INSERT`/`SELECT`) — an infrastructure change outside F2, raised as an open question. A rule is worse than a trigger here: rules rewrite queries silently, so a blocked `DELETE` would report success. **Amended by partitioning (decision 25), in both directions.** *In the design's favour*: a row trigger declared once on the parent is **cloned by Postgres into every existing partition and into every partition created or attached later** (BEFORE-row triggers on partitioned parents are supported from PG 13; Neon's floor is 14), so a `DELETE` aimed directly at `EventoAuditoria_2027` is refused exactly like one aimed at the parent — probe 4d is the evidence, not this sentence. *Against it*: `TRUNCATE` triggers are statement-level and are **not** cloned, so `0004` creates one `BEFORE TRUNCATE` trigger **per partition** and attempts one on the parent. Whether a partitioned parent accepts a `TRUNCATE` trigger at all, and whether truncating the parent fires the partitions' own triggers, are **not asserted here**: probe 4e settles both before `0004` is frozen, and `migration-0004.test.ts` turns "every partition has one" into a test-enforced set equality so the next window cannot silently forget it. *And the load-bearing one*: **`DETACH`/`DROP PARTITION` is DDL — no row trigger fires and no `DELETE` is ever issued.** That is exactly why the user's decision produces a lawful retention path, and exactly why it **lowers the friction of unauthorised erasure**: an owner who previously had to `DISABLE TRIGGER` (loud) or `DROP TABLE` (total) can now remove one year with one statement. The trade is accepted — the alternative is permanent unlawful retention — but it promotes the role-separation open question from "an improvement" to **the** thing that actually closes RNF-02 |
| 20 | **`0003` is whatever drizzle generates and contains *no* audit object. The entire audit table — `CREATE TABLE … PARTITION BY RANGE`, its six partitions, the three indexes, the FK, the CHECK, the function, every trigger and the `REVOKE`s — ships in one hand-written `0004_audit_log.sql` created with `drizzle-kit generate --custom`.** Rollback is a compensating `0005` that drops the table (partitions are dependent objects and go with it) and then the function | The previous split (table in the generated `0003`, triggers in `0004`); hand-appending the SQL to the generated `0003`; a `sql\`\`` execution at app start-up; `drizzle-kit push`; creating the table by hand too | Drizzle models no trigger, so this SQL can only be hand-written — but hand-editing a *generated* file means the next `npm run db:generate` review cannot tell authored SQL from emitted SQL, and a regeneration during review would silently drop it. A `--custom` file is authored by contract, independently revertible, and gives `migration-0004.test.ts` a stable target. Both files are still applied in **one** drizzle transaction (all pending migrations are wrapped together — verified in `roles-lookup-table/design.md` finding 1), so "table and trigger arrive together" is preserved. Running DDL at start-up would execute schema changes on every boot with no journal. **Gotcha for the test:** the plpgsql body contains the word `BEGIN`, so `migration-0004.test.ts` **must not** copy `migration-0002.test.ts`'s `expect(sql).not.toMatch(/\bBEGIN\b/i)` verbatim — it must assert no transaction control *outside* the dollar-quoted body, and separately that the body contains no `--> statement-breakpoint` (drizzle splits only on that marker, so a `$$ … $$` body with semicolons is safe). **Why the earlier split is gone**: drizzle physically **cannot emit `PARTITION BY`** (F7), so `0003` cannot create this table correctly at all — the choice is not "generated table + hand-written triggers" any more, it is "hand-written table or wrong table". A self-contained `0004` is also the better review object: one file, one table, every guarantee (partitioning, PK, FK, indexes, immutability, privileges) visible in a single diff, and one stable target for `migration-0004.test.ts`. `0004` depends only on `Usuario`, which predates this change, so it has **no SQL dependency on `0003`** — the only coupling left is the ordering of `drizzle/meta/_journal.json` (decision 24) |
| 21 | **One audit row per affected account (`EntidadTipo = 'Usuario'`, `EntidadId` = the real id), plus exactly one row for the import itself. Never aggregated.** Bounded by a new cap `MAX_ACCOUNT_EVENTS_PER_APPLY = 2 000`, checked in the planner and surfaced as a dry-run validation error | One aggregated row per import ("47 accounts created"); one row per workbook row; per-account rows with no cap; a second cap only in the UI | An aggregated row cannot answer *"what did this system do to my personal data"* — which is the entire point of RNF-02 under Ley 787. A log that can only say "47 accounts" fails the one question it exists to answer, so aggregation is rejected on requirement grounds, not on cost. The cap is what keeps that promise affordable: `MAX_NEW_ACCOUNTS_PER_APPLY = 250` bounds *creations*, but **updates** of already-existing accounts are also personal-data modifications and are bounded only by the 10 000-row `Docentes` sheet (scope reduction: no `Estudiantes` sheet is imported) — up to 10 000 audit rows on a first load. `unchanged` accounts produce **no** row (nothing was modified), so a re-import of the same workbook writes exactly one audit row, which keeps idempotency honest. 2 000 follows decision 3's posture exactly: exceeding it is a *validation* error telling the operator to split the workbook, never a timeout |
| 22 | **A payload records which fields changed, never their values.** Account payload: `{ campos: AuditableUserField[], rol, origen: "importacion", importacionSha256 }`. Import payload: `ImportSummary` minus `actor`/`at` (they are columns). The `AuditEvent` union is **constructible only** through the pure builders in `src/lib/audit/events.ts`, whose parameters are ids, enum field names and a hex digest — no credential, name, email or phone type appears in any signature | Before/after values in the payload; the whole updated row; a free-form `Record<string, unknown>`; filtering credentials out at write time; storing the workbook file name | RNF-05 (minimisation) and Ley 787 both cut the same way: an **append-only** table that copies personal data becomes a second, permanently un-rectifiable copy of it, so the audit row must *point at* the subject (`EntidadId`) instead of duplicating them. `campos: ["telefono"]` answers "your phone number was changed by this import" without storing a phone number. Credentials are then excluded the same way decision 16 excludes them from `ImportSummary` — **structurally, not by filtering**: `AuditEvent` is a closed discriminated union with exact payload types, the builders are its only constructors, and `TemporaryCredential` is not a parameter of any of them, so a leak requires a visible signature change rather than a forgotten `delete`. Two `@ts-expect-error` regression tests pin that, plus one runtime forbidden-key assertion over the fixture matrix as belt and braces. The file **name** is deliberately not stored: it is operator-chosen free text that routinely carries names; `fileSha256` identifies the file without it. **Retention (RNF-06 / Ley 787) is still deliberately unimplemented in F2**, but the table is now *shaped* so a lawful period can be honoured **without ever disabling the trigger**: decision 25 partitions by `OcurridoEn`, so a purge is `DETACH`/`DROP PARTITION` — pure DDL, no `UPDATE`, no `DELETE`, no row rewritten. What remains open is policy, not schema: how long, and who is authorised to drop a partition. The constraints any future purge must satisfy are listed in *Migration / Rollout* §9; listing constraints is not designing a procedure, and F2 must still not invent a period |
| 23 | **The audit `INSERT` is the last statement group inside the existing `db.transaction`, after every entity write, chunked at the same `WRITE_CHUNK_ROWS = 500`.** Nothing about the bcrypt budget or the existing batching changes | Writing audit rows before the entity writes; a second transaction; an `AFTER INSERT` trigger deriving the audit row in the DB; an async/fire-and-forget writer | It must be last because `EntidadId` for a **created** account only exists after that account's `INSERT … RETURNING "Id"` — the same returned ids `Inscripcion` already needs, so no extra read. A second transaction reintroduces exactly the split state the all-or-nothing design exists to prevent; fire-and-forget makes the audit row optional, which an "inalterable log" cannot be. A DB-side `AFTER INSERT` trigger would tax **every** `Usuario` insert in the app, including `/users/new`, and would have no access to the import's file hash. Cost is negligible and worth naming precisely: ≤ 2 001 rows × 6 columns = 5 chunks ≈ tens of milliseconds, against the ~60–70 s of bcrypt that decision 3 already bounds — and the bcrypt runs **outside** the transaction (decision 9's flow), so the transaction is not lengthened by either. The immutability triggers are `BEFORE UPDATE OR DELETE`/`TRUNCATE` only, so they **never fire on `INSERT`** and add nothing to the bulk write path |
| 25 | **`EventoAuditoria` is `PARTITION BY RANGE ("OcurridoEn")` from birth. Granularity is **yearly**. `0004` pre-creates five partitions — `2026 … 2030`, UTC bounds written with an explicit `+00` offset — plus a `DEFAULT` partition so an insert can never fail for a missing partition.** Partitioning exists for **retention**, not for performance | Not partitioning (the previous design); monthly or quarterly partitions; `LIST` partitioning on `Accion`/`EntidadTipo`; no `DEFAULT` partition (fail loudly instead); a `FROM ('2031-01-01') TO (MAXVALUE)` overflow partition instead of `DEFAULT`; creating partitions lazily from the application | **Why partition at all, now**: an append-only table has no lawful erasure path, and RNF-06 / Ley 787 will eventually demand one. Range partitioning on the event time makes a purge a `DROP`/`DETACH PARTITION` — DDL, so the immutability trigger never has to be weakened to satisfy the law. Doing it later is far worse: retrofitting means copying every existing audit row into a new table and renaming, i.e. exactly the mass rewrite of history this design exists to forbid. That asymmetry is why "from birth" is the right call even though no purge ships. **Why yearly, not monthly**: volume does not decide this, because there is barely any — decision 21 caps an apply at 2 001 rows, and at the institution's cadence (≈ 2 periods/year plus corrections, say ≤ 10 applies/year) a year holds ≤ ~20 000 rows, smaller than several tables this schema already has unpartitioned. Partition *size* is therefore irrelevant and the only real axis is **retention resolution vs. operational surface**. Monthly bounds over-retention at ~1 month, but multiplies every object by twelve (60 partitions for a five-year window, each carrying three propagated indexes, its own `TRUNCATE` trigger and its own grants — roughly 300 lines of reviewed DDL against ~40) and multiplies the rate at which the manual task below must be performed; the failure mode of missing that task is the `DEFAULT`-partition trap, which the immutability trigger makes near-unfixable. Yearly bounds over-retention at ≤ 12 months, which a period expressed in years absorbs, and which is revisited when the period is finally known. `LIST` on `Accion` is useless: it does not slice time, and time is the only axis retention has. **Why `DEFAULT`**: decision 23 puts the audit insert *inside* the import transaction, so a missing partition would not fail an audit row — it would fail **the entire import**. `DEFAULT` converts a lapsed window from an outage into a loss of retention granularity, which is the correct direction. A `TO (MAXVALUE)` overflow partition has the same availability property but is strictly worse afterwards: it accumulates silently forever with no signal, whereas `DEFAULT` is one named relation whose `count(*)` is a one-line health check and whose trap announces itself (below). Lazy app-side creation is rejected outright: it would put DDL, under lock, inside a request-scoped transaction, executed by the role that should be losing DDL rights, not gaining reasons to keep them. **The trap, stated not hidden**: once a row for year Y lands in `DEFAULT`, `CREATE TABLE … PARTITION OF … FOR VALUES … Y` fails — Postgres scans `DEFAULT` and refuses if any row would belong to the new partition. Moving those rows out needs `DELETE`, which the trigger rejects, so recovering a lapsed window needs the same named-human maintenance authority as a purge. **What stays manual, honestly**: F2 ships **no scheduler and creates none** — this project has no cron, no queue and no worker (decision 5 already refused to add one), and whether a Neon compute can host `pg_cron` is unverified and out of scope. Future partitions are added by a human-authored migration, exactly like `0004`. The pre-created window buys roughly four years of doing nothing; what is genuinely unsolved is **who watches the calendar**. The entire mitigation is two artefacts, both WU1b tasks: a §4 runbook note in `modelo_datos_sql.md` naming the window's expiry (`2030-12-31`) and the check `SELECT count(*) FROM "EventoAuditoria_default";` (non-zero ⇒ the window lapsed), and an ownership open question. Do not describe this as automated |
| 26 | **`eventoAuditoria` is declared in a new `src/db/audit-schema.ts` that `src/db/schema.ts` deliberately does **not** import or re-export, so drizzle-kit never sees it — the declaration is for typing and query building only, and `0004` is the single source of the DDL.** `src/db/audit-schema.test.ts` pins both halves | Declaring it in `schema.ts` and hand-editing the generated migration; declaring it and relying on `tablesFilter`; not declaring it at all and writing raw SQL at every call site; adding a second `schema` entry to `drizzle.config.ts` | drizzle **cannot** emit `PARTITION BY` (F7), so any table drizzle-kit knows about is a table it will one day try to recreate unpartitioned. Hand-editing generated SQL is what decision 20 already rejected. `tablesFilter` is documented for `push`/`pull`, not for the `generate` snapshot diff, so it would stake a property this design needs to be *certain* about on undocumented behaviour. Hiding the file from `drizzle.config.ts`'s single entry point (`schema: "./src/db/schema.ts"`) gives both halves with no gamble: `db.insert(eventoAuditoria)` stays fully typed and `AuditEvent`-checked, while the snapshot **literally cannot contain** the table, so no future `generate` can emit a conflicting `CREATE TABLE`, a `DROP`, or a silent diff. Raw SQL everywhere would throw away the `$type<AuditEvent["datos"]>()` checking that decision 22 depends on. Two consequences worth naming: (a) `db.query.eventoAuditoria` — the relational API fed by `drizzle(client, { schema })` (`src/db/index.ts:17`) — will not exist; irrelevant, because F2 only inserts and any future reader uses the core builder; (b) `drizzle-kit push` becomes actively destructive rather than merely discouraged, because the child partitions are `relkind = 'r'` and look like unknown droppable tables (F7). Guard: `src/db/audit-schema.test.ts` asserts that `drizzle/meta/0003_snapshot.json` contains no `EventoAuditoria` and that `src/db/schema.ts`'s source mentions neither `audit-schema` nor `eventoAuditoria` — so the day someone "tidies up" by re-exporting it, CI fails before `generate` can do damage |

Decision **24** (how the audit work is sliced across the work units) is stated
in *Work Units and Order*, next to the estimates it depends on.

---

## Data Flow

```
                 ┌─────────────── preview (writes nothing) ───────────────┐
 browser         │                                                        │
   │ FormData    ▼                                                        │
   ├──► previewAction ─► requireRole(secretaria) ─► guards(bytes) ─► parse ─┐
   │                     (BEFORE FormData is read)                         │
   │                                                                       ▼
   │                                    loadCatalogSnapshot(db) ─► planImport(pure)
   │                                                                       │
   │◄────────────── { plan, counts, rowErrors, sha256 } ◄──────────────────┘
   │
   │ confirm (re-uploads the SAME file + hidden sha256)
   ▼
 applyAction ─► requireRole ─► guards ─► parse ─► sha256 recomputed
                                                   │
                        differs? ──► return a fresh preview (decision 15)
                                                   │ equal
                                                   ▼
                     generate temp passwords ─► bcrypt(12)   ◄── OUTSIDE the tx
                                                   │
                                          db.transaction(tx):
                                            snapshot ← tx   (re-read inside)
                                            plan ← planImport(parsed, snapshot)
                                            plan.errors? ──► throw ──► ROLLBACK
                                            Asignatura ▸ Usuario(docente)   ─┐
                                              ▸ Grupo                        │ ids
                                              ▸ deactivate(grupoIds) chunks of 500
                     (Facultad/Carrera are never written — resolved by lookup
                      only; Estudiante/Inscripcion are out of import scope)
                                              ▸ buildAuditEvents(plan, ids) ◄─┘ PURE
                                              ▸ insertAuditEvents(tx, events)
                                                   │ COMMIT
                                                   ▼
                              ImportSummary ──► one structured log line
                              credentials[] ──► action result ──► Blob ──► download
                                                                  (client only)
```

Audit rows are written last, in the same transaction, and never leave it:

```
 plan + returned ids ──► buildAuditEvents (pure, src/lib/audit/events.ts)
                              │   1 × importAplicado  +  N × cuentaCreada/Actualizada
                              ▼
                         AuditEvent[]  ── closed union; no credential type is a
                              │            parameter of any builder (decision 22)
                              ▼
                  insertAuditEvents(tx, events)   chunks of 500
                              │
                              ▼
                    "EventoAuditoria"   PARTITION BY RANGE ("OcurridoEn")
                     (parent, relkind 'p')  ◄── BEFORE UPDATE|DELETE row trigger
                              │                 RAISE 42501, CLONED into every
                              │                 partition (INSERT never fires it)
          ┌───────────────────┼───────────────────┬──────────────┐
          ▼                   ▼                   ▼              ▼
   …_2026   …_2027   …_2028   …_2029   …_2030          …_default
   each: 3 propagated indexes + its own BEFORE TRUNCATE trigger + REVOKEs
   retention later = DROP/DETACH PARTITION (DDL: no trigger, no DELETE)
```

Forced change, every guarded entry point:

```
request ──► requireUser ──► no session ──────────────► /login
                 │
                 ├── debeCambiarClave === true ──────► /change-password
                 │
                 └── else ──► requireRole ──► wrong role ──► /denied
                                     │
                                     └──► page / action / route handler

/change-password ──► requireUserAllowingPasswordChange ──► cannot emit the
                     forced-change redirect ──► no loop, by construction
```

---

## File Changes

| File | Action | Description |
|---|---|---|
| `src/db/schema.ts` | Modify | `asignatura` (+ `CHECK HorasTotales > 0`, X9), `grupo`, `inscripcion`, indexes (decision 11); `usuario.correo` → `.unique()`; `usuario.debeCambiarClave`. **Must not reference the audit table** (decision 26) |
| `drizzle/0003_*.sql`, `drizzle/meta/*` | New | Additive drizzle-generated migration + snapshot + journal entry. **No audit object** (decisions 20, 26) |
| `src/db/audit-schema.ts` | New | `eventoAuditoria` declaration — typing and query building only; never imported by `schema.ts` (decision 26) |
| `src/db/audit-schema.test.ts` | New | Snapshot contains no `EventoAuditoria`; `schema.ts` references neither the file nor the table (decision 26) |
| `drizzle/0004_audit_log.sql` | New | **Hand-written** (`generate --custom`): the whole partitioned table, 5 yearly partitions + `DEFAULT`, 3 partitioned indexes, FK, CHECK, trigger function, parent row trigger, per-partition `TRUNCATE` triggers, `REVOKE`s (decisions 19, 20, 25) |
| `src/db/migration-0004.test.ts` | New | SQL assertions over `0004`: `PARTITION BY RANGE`, contiguous non-overlapping bounds, one `DEFAULT`, trigger-set equality, `42501`, journal entry (decision 20's `BEGIN` gotcha) |
| `modelo_datos_sql.md` | Modify | §3.1 DDL for the three entities + `EventoAuditoria` (partitioned) + `Activo` + `UQ_Usuario_Correo` + `DebeCambiarClave`; §4 note 3 corrected from CSV to `.xlsx` (X1, X2, X4); a §4 note on append-only enforcement, its limits, the partition window's expiry and the `DEFAULT`-occupancy check |
| `src/lib/data/catalog.ts` | New | `loadCatalogSnapshot(exec)`, active-only readers for RF-03/RF-31 |
| `src/lib/audit/types.ts` | New | `AuditAction`, `AuditEntityType`, `AuditableUserField`, the closed `AuditEvent` union — **pure** |
| `src/lib/audit/events.ts` | New | Pure builders; the **only** constructors of `AuditEvent` (decision 22) |
| `src/lib/data/audit.ts` | New | `insertAuditEvents(tx, events)` — `server-only`, chunked, transaction-scoped; imports the table from `@/db/audit-schema` |
| `src/lib/data/users.ts` | Modify | Project `debeCambiarClave` in `usuarioConRolColumns`; `getUsuarioByCorreo`, `getUsuarioByCif`; `setDebeCambiarClave`; `createUsuariosBulk(tx, …)` |
| `src/lib/import/limits.ts` | New | Pure caps, **zero imports** (consumed by `next.config.ts`) |
| `src/lib/import/sheets.ts` | New | Sheet + column contract as data; header normalization |
| `src/lib/import/schemas.ts` | New | Per-sheet zod schemas |
| `src/lib/import/normalize.ts` | New | `normalizeEmail`, `deriveLogin`, `normalizePeriodo`, `normalizeKey` |
| `src/lib/import/guards.ts` | New | Pure file guards (decision 2) |
| `src/lib/import/parse.ts` | New | exceljs → `ParsedWorkbook`; the **only** read-side library import |
| `src/lib/import/plan.ts` | New | `planImport` — pure, the heart |
| `src/lib/import/apply.ts` | New | `applyImport(tx, plan, credentials)`, chunked; calls `buildAuditEvents` + `insertAuditEvents` last, in-tx (decision 23) |
| `src/lib/import/temp-password.ts` | New | CSPRNG generator with injectable RNG |
| `src/lib/import/credentials-csv.ts` | New | Pure CSV + BOM + injection neutralisation |
| `src/lib/import/template.ts` | New | exceljs template builder; the **only** write-side library import |
| `src/lib/import/types.ts` | New | `ParsedWorkbook`, `CatalogSnapshot`, `ImportPlan`, `ImportSummary` |
| `src/lib/auth/permissions.ts` | Modify | `canImportCatalog(rol) = canAssignRole(rol, "docente")` |
| `src/lib/auth/session.ts` | Modify | Optional `debeCambiarClave`; `isSessionPayload` accepts it |
| `src/lib/auth/dal.ts` | Modify | Forced-change redirect in `requireUser`; new `requireUserAllowingPasswordChange` |
| `src/lib/auth/routes.ts` | Modify | `PASSWORD_CHANGE_PATH` |
| `src/app/(auth)/login/actions.ts` | Modify | Session payload carries the flag |
| `src/app/change-password/*` | New | `page.tsx`, `change-password-form.tsx`, `actions.ts` |
| `src/app/(dashboard)/catalog/import/*` | New | `page.tsx` (+ `maxDuration`), `import-form.tsx`, `import-preview.tsx`, `credentials-download.tsx`, `actions.ts` |
| `src/app/api/catalog/template/route.ts` | New | Role-guarded download; guards itself (F2) |
| `src/components/app-sidebar.tsx` | Modify | Import item gated by `canImportCatalog` |
| `i18n/es.json`, `i18n/en.json` | Modify | `catalog.import.*`, `changePassword.*`, `nav.catalog` |
| `next.config.ts` | Modify | `experimental.serverActions.bodySizeLimit` from `limits.ts` |
| `package.json` | Modify | One pinned xlsx dependency, after the decision-1 gate |

---

## Interfaces / Contracts

```ts
// src/lib/import/limits.ts — NO imports; next.config.ts consumes this file
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS_PER_SHEET = 10_000;
export const MAX_ROWS_TOTAL = 30_000;
export const MAX_NEW_ACCOUNTS_PER_APPLY = 250;
/** Bounds the audit rows one apply may write: 1 import row + N account rows
 *  (decision 21). Creations are already capped at 250; UPDATES are not, and
 *  they are personal-data modifications too, so they need their own bound. */
export const MAX_ACCOUNT_EVENTS_PER_APPLY = 2_000;
export const MULTIPART_OVERHEAD_BYTES = 64 * 1024;          // F3
export const SERVER_ACTION_BODY_LIMIT = MAX_FILE_BYTES + MULTIPART_OVERHEAD_BYTES;
export const WRITE_CHUNK_ROWS = 500;                         // ≤ 65 535 bind params
```

```ts
// src/lib/import/sheets.ts — the contract, as data
// Scope reduction (product-owner decision): Facultades, Carreras, Estudiantes
// and Inscripciones are no longer imported. Facultad/Carrera are seeded once
// outside this feature; the import never creates a student account.
// FROZEN against the real sample workbook (task 3.9, docs/PlantillaCatalogo.xlsx,
// 2026-09-22): "Nombre" (not "NombreCompleto") for Docentes, "NumGrupo" (not
// "NumeroGrupo") for Grupos — the file's real headers win over the proposal.
export const SHEETS = [
  { name: "Asignaturas",  required: ["Codigo", "Nombre", "Carrera", "HorasTotales"],       optional: [] },
  { name: "Docentes",     required: ["Correo", "Nombre"],                                  optional: ["Telefono"] },
  { name: "Grupos",       required: ["CodigoAsignatura", "Periodo", "NumGrupo", "CorreoDocente"], optional: [] },
] as const;
// Every cross-sheet reference is a NATURAL KEY. No Id column is ever accepted.
// NOTE: docs/PlantillaCatalogo.xlsx has headers only (0 data rows) — it settles
// column names but NOT real row-count volume; MAX_ROWS_PER_SHEET/MAX_ROWS_TOTAL
// in limits.ts remain provisional defaults, still open per the final section.
// Header match: trim -> toLowerCase -> strip diacritics. Extra columns ignored.
// Asignaturas' "Carrera" column MUST reference an already-existing Carrera
// (looked up by name in the snapshot) — it is never created by the import.
// An unresolved Carrera is a row-level error, same shape as every other
// unresolved natural-key reference in this design (e.g. an unresolved
// docente/asignatura reference in Grupos).
```

```ts
// src/lib/import/types.ts
export type RowError = { sheet: string; row: number; reason: string; value?: string };

export type EntityCounts = {
  create: number; update: number; unchanged: number; deactivate: number; error: number;
};

export type ImportPlan = {
  ok: boolean;                       // false when errors.length > 0
  errors: RowError[];                // ALL of them, never just the first
  counts: Record<EntityName, EntityCounts>;
  accountsToCreate: number;
  writes: { /* per-entity create/update payloads, in dependency order */ };
  deactivateGrupoIds: number[];
  // No `deactivateInscripcionKeys`: Inscripciones is not imported (scope
  // reduction). `Inscripcion` rows stay under academic-catalog's own lifecycle.
};

export type ImportSummary = {
  actor: string; at: string; fileSha256: string;
  counts: Record<EntityName, EntityCounts>;
  accountsCreated: number; accountsUpdated: number;
};
// NOTE: no password, no hash, no credential field exists on this type — that is
// what makes "logs are clean" a compile-time property (decision 16).

export type TemporaryCredential = { login: string; nombreCompleto: string; clave: string };
```

```ts
// src/lib/audit/types.ts — PURE. No db, no clock, no I/O. (decisions 18, 22)
export const AUDIT_ACTIONS = [
  "catalogo.importacion.aplicada",
  "usuario.creado",
  "usuario.actualizado",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditEntityType = "Importacion" | "Usuario";

/** Closed list. A field not named here can never be reported as changed. */
export const AUDITABLE_USER_FIELDS = [
  "nombreCompleto", "correo", "telefono", "cif", "carreraId", "rolId", "activo",
] as const;
export type AuditableUserField = (typeof AUDITABLE_USER_FIELDS)[number];
// `login` and `hashClave` are ABSENT on purpose: `hashClave` is a credential,
// and `login` is never rewritten by an import (decision 7).

type ImportAppliedPayload = {
  archivoSha256: string;
  conteos: Record<EntityName, EntityCounts>;
  cuentasCreadas: number;
  cuentasActualizadas: number;
};

type UserChangedPayload = {
  /** FIELD NAMES ONLY — never values (RNF-05, decision 22). */
  campos: readonly AuditableUserField[];
  rol: RolUsuario;
  origen: "importacion";
  importacionSha256: string;
};

/** Closed discriminated union. Built ONLY by `events.ts`. */
export type AuditEvent =
  | { accion: "catalogo.importacion.aplicada"; entidadTipo: "Importacion";
      entidadId: null; datos: ImportAppliedPayload }
  | { accion: "usuario.creado" | "usuario.actualizado"; entidadTipo: "Usuario";
      entidadId: number; datos: UserChangedPayload };
// `actorId` and `ocurridoEn` are NOT on this type: the actor is supplied by the
// writer from the session, and the timestamp is the column default, so a builder
// cannot forge either one.
```

```ts
// src/lib/audit/events.ts — PURE, total, the ONLY constructors of AuditEvent.
// No parameter here has a credential type; adding one is a visible signature
// change, which is what makes a leak compile-time impossible (decision 22).
export function importAppliedEvent(summary: ImportSummary): AuditEvent;
export function accountCreatedEvent(args: {
  usuarioId: number; rol: RolUsuario; importacionSha256: string;
}): AuditEvent;
export function accountUpdatedEvent(args: {
  usuarioId: number; rol: RolUsuario;
  campos: readonly AuditableUserField[]; importacionSha256: string;
}): AuditEvent;
/** 1 import event + one per created/updated account. `unchanged` → none. */
export function buildAuditEvents(
  summary: ImportSummary,
  touched: { usuarioId: number; rol: RolUsuario;
             kind: "creado" | "actualizado";
             campos: readonly AuditableUserField[] }[],
): AuditEvent[];
```

```ts
// src/lib/data/audit.ts — the ONLY impure audit module. `import "server-only"`.
// `exec` is the TRANSACTION handle, never `db`: an audit row outside the
// import's transaction is a design violation, so the signature forbids it.
export async function insertAuditEvents(
  exec: Transaction, actorId: number, events: AuditEvent[],
): Promise<void>;   // chunked at WRITE_CHUNK_ROWS
```

```ts
// src/db/audit-schema.ts — decisions 18, 26.
// NOT imported by src/db/schema.ts, so drizzle-kit never sees it (F7). This
// declaration produces NO DDL: `drizzle/0004_audit_log.sql` is the only
// definition. Everything here exists to type `db.insert(eventoAuditoria)`.
// Keep the two in sync BY REVIEW — there is no generator to do it for you.
export const eventoAuditoria = pgTable("EventoAuditoria", {
  // Typing only: drizzle omits it from inserts. Whether the column is a real
  // identity or a sequence default is decided by the PG-version pre-check.
  id: bigint("Id", { mode: "number" }).generatedAlwaysAsIdentity(),
  actorId: bigint("ActorId", { mode: "number" }).notNull().references(() => usuario.id),
  ocurridoEn: timestamp("OcurridoEn", { withTimezone: true }).notNull().defaultNow(),
  accion: varchar("Accion", { length: 60 }).$type<AuditAction>().notNull(),
  entidadTipo: varchar("EntidadTipo", { length: 40 }).$type<AuditEntityType>().notNull(),
  entidadId: bigint("EntidadId", { mode: "number" }),      // NULL only for Importacion
  datos: jsonb("Datos").$type<AuditEvent["datos"]>().notNull().default({}),
}, (t) => [
  // Composite PK: a unique constraint on a partitioned table MUST contain every
  // partition-key column (decision 25). `Id` alone is not constrained-unique.
  primaryKey({ columns: [t.id, t.ocurridoEn] }),
  index("IX_EventoAuditoria_Entidad").on(t.entidadTipo, t.entidadId, t.ocurridoEn.desc()),
  index("IX_EventoAuditoria_Actor").on(t.actorId, t.ocurridoEn.desc()),
  index("IX_EventoAuditoria_Ocurrido").on(t.ocurridoEn),
  check("CK_EventoAuditoria_Entidad",
    sql`${t.entidadTipo} <> 'Usuario' OR ${t.entidadId} IS NOT NULL`),
]);
// No `Activo`, no `updatedAt`, no soft-delete column: the table is append-only,
// so a mutable column on it would be a contradiction the trigger would reject.
```

```sql
-- drizzle/0004_audit_log.sql — HAND-WRITTEN (decisions 19, 20, 25, 26).
-- `npx drizzle-kit generate --custom --name audit_log` emits the empty file AND
-- its journal entry. drizzle-kit never sees this table (F7), so this file is its
-- ONLY definition. The $$ body is ONE drizzle statement: drizzle splits only on
-- `--> statement-breakpoint`, never on `;`.
CREATE TABLE "EventoAuditoria" (
  -- Identity on a PARTITIONED parent needs PG 17+. If the read-only pre-check
  -- reports an older server, this single line becomes:
  --   "Id" bigint NOT NULL DEFAULT nextval('"EventoAuditoria_Id_seq"')
  -- preceded by CREATE SEQUENCE. Nothing else in this file changes.
  "Id"          bigint GENERATED ALWAYS AS IDENTITY,
  "ActorId"     bigint      NOT NULL REFERENCES "Usuario"("Id"),
  "OcurridoEn"  timestamptz NOT NULL DEFAULT now(),
  "Accion"      varchar(60) NOT NULL,
  "EntidadTipo" varchar(40) NOT NULL,
  "EntidadId"   bigint,
  "Datos"       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  -- The partition key MUST be part of every unique constraint.
  CONSTRAINT "PK_EventoAuditoria" PRIMARY KEY ("Id", "OcurridoEn"),
  CONSTRAINT "CK_EventoAuditoria_Entidad"
    CHECK ("EntidadTipo" <> 'Usuario' OR "EntidadId" IS NOT NULL)
) PARTITION BY RANGE ("OcurridoEn");
--> statement-breakpoint
-- Bounds carry an explicit +00 offset on purpose: a timestamptz bound literal
-- without one is resolved against the session TimeZone AT DDL TIME and frozen.
-- One statement per year, 2026..2030 (only the first is shown here).
CREATE TABLE "EventoAuditoria_2026" PARTITION OF "EventoAuditoria"
  FOR VALUES FROM ('2026-01-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');
--> statement-breakpoint
-- Availability over granularity: an insert must NEVER fail for a missing
-- partition, because it would abort the whole import (decisions 23, 25).
CREATE TABLE "EventoAuditoria_default" PARTITION OF "EventoAuditoria" DEFAULT;
--> statement-breakpoint
-- Declared once on the parent; Postgres propagates a partitioned index to every
-- existing partition and to every partition created or attached later.
CREATE INDEX "IX_EventoAuditoria_Entidad" ON "EventoAuditoria"
  ("EntidadTipo", "EntidadId", "OcurridoEn" DESC);
--> statement-breakpoint
-- ... IX_EventoAuditoria_Actor, IX_EventoAuditoria_Ocurrido, likewise.
CREATE OR REPLACE FUNCTION "fn_EventoAuditoria_inmutable"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'EventoAuditoria es append-only: % no esta permitido', TG_OP
    USING ERRCODE = '42501';
END;
$$;
--> statement-breakpoint
-- ONE row trigger, on the PARENT only. Postgres clones it into every existing
-- partition and into every partition created or attached later (PG 13+), which
-- is what blocks a DELETE aimed straight at a child. Probe 4d proves it.
CREATE TRIGGER "TR_EventoAuditoria_NoUpdateDelete"
BEFORE UPDATE OR DELETE ON "EventoAuditoria"
FOR EACH ROW EXECUTE FUNCTION "fn_EventoAuditoria_inmutable"();
--> statement-breakpoint
-- TRUNCATE bypasses ROW triggers AND statement triggers are NOT cloned, so this
-- one is repeated for the parent and for EVERY partition, by name. Whether the
-- parent accepts it is settled by probe 4e, not by this comment.
CREATE TRIGGER "TR_EventoAuditoria_NoTruncate"
BEFORE TRUNCATE ON "EventoAuditoria"
FOR EACH STATEMENT EXECUTE FUNCTION "fn_EventoAuditoria_inmutable"();
--> statement-breakpoint
CREATE TRIGGER "TR_EventoAuditoria_2026_NoTruncate"
BEFORE TRUNCATE ON "EventoAuditoria_2026"
FOR EACH STATEMENT EXECUTE FUNCTION "fn_EventoAuditoria_inmutable"();
--> statement-breakpoint
-- ... 2027..2030 and "EventoAuditoria_default", likewise. migration-0004.test.ts
-- asserts this set EQUALS the set of PARTITION OF names, so the next window
-- cannot add a partition and forget its trigger.
--> statement-breakpoint
-- Defence in depth ONLY. The app role owns the table and can re-grant to
-- itself, so this is not the mechanism (decision 19). Privileges are checked on
-- the relation actually named in the statement, so each partition needs its own
-- REVOKE — and a future partition inherits none of this automatically.
REVOKE UPDATE, DELETE, TRUNCATE ON "EventoAuditoria" FROM PUBLIC;
--> statement-breakpoint
REVOKE UPDATE, DELETE, TRUNCATE ON "EventoAuditoria_2026" FROM PUBLIC;
-- ... and so on for every partition.
```

Rollback for `0004` is a compensating `0005`, never an edit to `0004`. Dropping
the parent drops its partitions with it (partitions are dependent objects,
unlike inheritance children — confirmed by probe 4h), and the triggers go with
their tables, so no `DROP TRIGGER` is needed first:

```sql
-- DESTROYS THE RNF-02 TRAIL. Never run without an explicit human decision.
DROP TABLE IF EXISTS "EventoAuditoria";
--> statement-breakpoint
DROP FUNCTION IF EXISTS "fn_EventoAuditoria_inmutable"();
```

```ts
// src/lib/import/plan.ts — PURE. No db, no crypto, no Date.now(), no I/O.
export function planImport(
  workbook: ParsedWorkbook,
  snapshot: CatalogSnapshot,
): ImportPlan;
```

```ts
// src/lib/import/normalize.ts — PURE
export function normalizeEmail(raw: string): string;   // trim -> toLowerCase
export const LOGIN_MAX = 60;                           // schema.ts:72, varchar(60)
/** Returns the normalized email, or a RowError reason when it exceeds LOGIN_MAX.
 *  NEVER truncates and NEVER suffixes (decision 7, spec: "never silently altered"). */
export function deriveLogin(correo: string): { login: string } | { error: "loginTooLong" };
export const PERIODO_RE = /^\d{4}-S[12]$/;             // case-SENSITIVE: `2026-s1` fails
```

```ts
// src/lib/import/temp-password.ts
export const TEMP_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0 O 1 I L
export const TEMP_PASSWORD_LENGTH = 16;                                   // 80 bits
export function generateTemporaryPassword(
  randomInt: (min: number, max: number) => number = nodeRandomInt,
): string;
```

```ts
// src/db/schema.ts — the additions
export const asignatura = pgTable("Asignatura", {
  id: bigint("Id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
  codigo: varchar("Codigo", { length: 32 }).notNull().unique(),
  nombre: varchar("Nombre", { length: 160 }).notNull(),
  carreraId: bigint("CarreraId", { mode: "number" }).notNull().references(() => carrera.id),
  horasTotales: integer("HorasTotales").notNull(),
}, (t) => [check("CK_Asignatura_Horas", sql`${t.horasTotales} > 0`)]);   // X9

export const grupo = pgTable("Grupo", {
  id: bigint("Id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
  asignaturaId: bigint("AsignaturaId", { mode: "number" }).notNull().references(() => asignatura.id),
  periodo: varchar("Periodo", { length: 12 }).notNull(),
  numeroGrupo: varchar("NumeroGrupo", { length: 12 }).notNull(),          // TEXT, X3
  docenteId: bigint("DocenteId", { mode: "number" }).notNull().references(() => usuario.id),
  activo: boolean("Activo").notNull().default(true),                       // X1
}, (t) => [
  unique().on(t.asignaturaId, t.periodo, t.numeroGrupo),
  index("IX_Grupo_Docente").on(t.docenteId),
  index("IX_Grupo_Activo").on(t.asignaturaId, t.periodo).where(sql`${t.activo}`),
]);

export const inscripcion = pgTable("Inscripcion", {
  estudianteId: bigint("EstudianteId", { mode: "number" }).notNull().references(() => usuario.id),
  grupoId: bigint("GrupoId", { mode: "number" }).notNull().references(() => grupo.id),
  activo: boolean("Activo").notNull().default(true),                       // X1
}, (t) => [
  primaryKey({ columns: [t.estudianteId, t.grupoId] }),
  index("IX_Inscripcion_Grupo").on(t.grupoId),
]);

// usuario: correo gains .unique();  + debeCambiarClave
debeCambiarClave: boolean("DebeCambiarClave").notNull().default(false),
```

Constraint naming follows drizzle's **generated** convention (`Grupo_..._unique`),
as migration `0002_roles_lookup_table.sql` already does — deliberately *not* the
`UQ_*` names in `modelo_datos_sql.md`. Hand-named indexes and the CHECK keep the
model's names because drizzle does not generate them.

```ts
// src/lib/auth/session.ts — optional, F6
export type SessionPayload = {
  sub: string; login: string; rol: RolUsuario; nombre: string;
  debeCambiarClave?: boolean;   // absent on every pre-existing JWT => false
};

// src/lib/auth/routes.ts
export const PASSWORD_CHANGE_PATH = "/change-password";

// src/lib/auth/dal.ts
export async function requireUser(): Promise<SessionPayload> {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.debeCambiarClave === true) redirect(PASSWORD_CHANGE_PATH);  // decision 12
  return user;
}
/** ONLY for /change-password and its action. Cannot emit the forced-change
 *  redirect, which is the structural no-loop proof (decision 13). */
export async function requireUserAllowingPasswordChange(): Promise<SessionPayload> {
  const user = await getSession();
  if (!user) redirect("/login");
  return user;
}

// src/lib/auth/permissions.ts — derived, never a second role list
export function canImportCatalog(rol: RolUsuario | undefined): boolean {
  return canAssignRole(rol, "docente");
}
```

```ts
// src/app/(dashboard)/catalog/import/actions.ts
export type PreviewState =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "preview"; counts: …; errors: RowError[]; fileSha256: string };

export type ApplyState =
  | PreviewState                                  // hash mismatch re-previews
  | { kind: "applied"; summary: ImportSummary; credentials: TemporaryCredential[] };

// BOTH actions, first two statements, in this order (spec: authz precedes body):
const session = await requireRole(...);            // also enforces the flag (12)
if (!canImportCatalog(session.rol)) redirect(ACCESS_DENIED_PATH);
// ...only now is formData.get("file") touched.
```

---

## Testing Strategy

Strict TDD: every row below is a RED test written before its implementation.
`npm test` (vitest, jsdom, `vi.mock("server-only", () => ({}))` per F5).

| Layer | What | Approach |
|---|---|---|
| Unit — pure | `guards` (the spec's *Rejected uploads* table, case-insensitive extension, `PK` bytes, size, empty) | Table-driven over `Uint8Array` literals; no files |
| Unit — pure | `normalize`: email casing/whitespace, `deriveLogin` > 60 chars, `PERIODO_RE` valid/invalid tables (incl. `2026-s1`) | Table-driven, direct |
| Unit — pure | `schemas`: required fields, `HorasTotales` 0/−8/absent, email syntax | Table-driven zod `safeParse` |
| Unit — pure | **`planImport`** — the bulk: create/update/unchanged/deactivate counts, all row errors not just the first, cross-sheet references in one workbook, duplicate key in one sheet, role-integrity violations, email-belongs-to-another-account, unresolved Carrera reference on an Asignatura row, login collision, idempotent re-import (all `unchanged`), reactivation, `MAX_NEW_ACCOUNTS` exceeded | Hand-built `ParsedWorkbook` + `CatalogSnapshot` fixtures. **No database, no library, no mocks** |
| Unit — pure | `temp-password`: alphabet membership, length, uniqueness across 1 000 draws, injected-RNG determinism, never equals email/login | Injected `randomInt` + the real one |
| Unit — pure | `credentials-csv`: BOM present, quoting, `=`/`+`/`-`/`@` neutralised, header row | String assertions |
| Unit — pure | `limits`: `SERVER_ACTION_BODY_LIMIT === MAX_FILE_BYTES + 64 KiB` (stops config drift) | Arithmetic assertion |
| Unit — pure | **`audit/events`**: `buildAuditEvents` emits exactly 1 import row + 1 per created/updated account and **0** for `unchanged`; action codes; `entidadId === null` only for `Importacion`; `campos` lists only changed fields and only `AUDITABLE_USER_FIELDS`; `importacionSha256` propagates; no `actorId`/`ocurridoEn` is forged | Hand-built `ImportSummary` + `touched[]` fixtures. No DB, no mocks |
| Unit — pure | **Credentials cannot reach a payload**: two `@ts-expect-error` tests (a `clave` key on a payload literal; `TemporaryCredential` passed to a builder) + a runtime assertion that no built payload's key set intersects `["clave","password","hash","hashClave"]`, over the whole fixture matrix | Negative type tests + a forbidden-key sweep (decision 22) |
| Unit — pure | `limits`: `MAX_ACCOUNT_EVENTS_PER_APPLY` is enforced by the planner as a validation error, not a throw | Planner fixture just over the cap |
| Unit — SQL | **`migration-0004.test.ts`**: `CREATE TABLE "EventoAuditoria" … PARTITION BY RANGE ("OcurridoEn")`; the PK is `("Id", "OcurridoEn")`; **bound arithmetic** — parse every `PARTITION OF … FROM/TO` literal and assert each year's `TO` equals the next year's `FROM`, that every literal carries an explicit `+00`, and that the window covers `2026‑01‑01`…`2031‑01‑01`; exactly **one** `DEFAULT` partition; one `CREATE … FUNCTION`; exactly **one** `BEFORE UPDATE OR DELETE … FOR EACH ROW` trigger and it is on the **parent** (asserting the *absence* of per-partition row triggers documents the reliance on cloning); the set of `BEFORE TRUNCATE` trigger targets **equals** the set of `PARTITION OF` names plus the parent; a `RAISE EXCEPTION` with `ERRCODE = '42501'`; a `REVOKE` per relation; the `$$` body contains **no** `--> statement-breakpoint`; **no transaction control outside the body** (decision 20's `BEGIN` gotcha — this assertion differs from `0002`'s); `_journal.json` has a `0004` entry | `readFileSync` + parsing/regex assertions, in the shape `migration-0002.test.ts` established. The bound and trigger-set assertions are real logic, not string matching: they are what makes the next partition window impossible to get silently wrong |
| Unit — SQL | **`audit-schema.test.ts`** (decision 26): `drizzle/meta/0003_snapshot.json` contains no `EventoAuditoria`; `src/db/schema.ts`'s source text references neither `audit-schema` nor `eventoAuditoria`; `0004_audit_log.sql`'s column list matches the keys declared in `audit-schema.ts` | `readFileSync` over the snapshot, the schema source and the SQL. The third assertion is the only automated link between the hand-written DDL and the hand-written declaration |
| Unit | `canImportCatalog` 5×5 role table + a derivation test asserting it tracks `canAssignRole(rol, "docente")` | Table-driven |
| Unit | `requireUser` flagged → `PASSWORD_CHANGE_PATH`; not flagged → passes; anonymous → `/login`; `requireRole` order (flag beats role denial); `requireUserAllowingPasswordChange` never redirects a flagged user | `vi.mock("next/navigation")` + `@/lib/auth/cookies`, as `dal.test.ts` already does |
| Unit | `isSessionPayload` accepts a payload without the field (F6) and `=== true` semantics | Direct |
| Integration | `parse.ts` against **committed `.xlsx` fixtures**: valid workbook, missing sheet, renamed header, formula cell (cached value, never evaluated), corrupt zip named `.xlsx`, row cap exceeded | Real bytes through the real library; fixtures in `src/lib/import/__fixtures__/` |
| Integration | Template route: `secretaria` gets the 3 sheets (Asignaturas, Docentes, Grupos) in order; **the emitted template re-parses to zero rows and zero errors** (spec); every other role and anonymous get no bytes | Call the route handler directly with a mocked DAL |
| Integration | `apply.ts` writer against a fake `tx` recording statements: dependency order, chunking at 500, deactivations issued, bcrypt happens **outside** the transaction, nothing written when `plan.ok === false` | Hand-rolled `tx` double |
| Integration | **Audit writer**: `insertAuditEvents` receives the **same `tx` handle** as the entity writes and is the **last** group; audit rows carry the ids returned by the account inserts; a throw after the entity writes leaves **zero** audit statements committed; `plan.ok === false` emits none at all; chunking at 500 | Same hand-rolled `tx` double, asserting statement order and handle identity |
| Integration | Both actions: `requireRole` runs before `formData.get`, denied roles parse nothing, hash mismatch re-previews, credentials absent on rollback, preview returns no password | `vi.mock` the DAL + data layer, as `users/new/actions.test.ts` does |
| Integration | Change-password: wrong current password, weak/mismatched new, new equals temporary, success re-signs the session, page renders for a flagged user with no redirect, logout reachable | Testing Library + mocked action |
| Integration | i18n key parity for `catalog.import.*` and `changePassword.*` across `es`/`en` | Deep key-set comparison, as existing parity tests do |
| E2E | — | Not available (`openspec/config.yaml`: `e2e.available: false`) |

**Not covered by tests, by construction** (record, do not paper over): the real
Postgres transaction, the UNIQUE/CHECK constraints, the partial indexes and —
now — **the immutability triggers actually firing**, **partition routing**, and
**trigger cloning into partitions**. There is no integration DB in this project,
so `migration-0004.test.ts` proves the SQL was *written*, not that Postgres
*enforces* it. Their proof is the Neon-branch rehearsal in *Migration / Rollout*
(steps 4b–4h), and that rehearsal is a **task**, not a test. Stating this
plainly matters more here than elsewhere: an audit log whose immutability is
only asserted by a string match is not yet an audit log.

Two of those probes are **blocking preconditions, not confirmations**: the PG
version (step 1) decides which identity form `0004` uses, and probe 4e decides
whether the parent-level `TRUNCATE` trigger exists at all. Both must run before
`migration-0004.test.ts` freezes its assertions, which inverts the usual
RED-first order for those two assertions only. `sdd-tasks` must sequence WU1b
accordingly rather than discovering it mid-apply.

---

## Threat Matrix

| Boundary | Minimum adversarial cases | Applicability | Design response | Planned RED tests |
|---|---|---|---|---|
| Documentation-like paths | `requirements.txt`, executable Markdown, `README.sh` | **N/A** — the change classifies no file as executable; the only file it reads is a `.xlsx` treated as inert data, never executed | — | — |
| Git repository selection | `git -C`, relative/absolute paths | **N/A** — no VCS automation; the change runs no git command | — | — |
| Commit state | staged, `commit -a`, empty index | **N/A** — no commit automation | — | — |
| Push state | tracking branch, first push, refspec | **N/A** — no push automation | — | — |
| PR commands | `--head`, env prefix, composed commands | **N/A** — no PR automation | — | — |

The change has no shell, subprocess, VCS or PR boundary. It **does** have three
boundaries the standard matrix does not model, so they are carried here with the
same discipline — each row is a design requirement that must reach `tasks.md`
unchanged:

| Boundary | Adversarial cases | Design response | Planned RED tests |
|---|---|---|---|
| Untrusted archive parsing | zip bomb; `.xlsx` containing plain text; corrupt central directory; formula cell in a required column; external-reference/XXE-style entity; 10 M-row sheet | Ordered pure guards **before** the library (decision 2); row caps during parsing surfaced as validation, not timeout; cached values read, formulas never evaluated; parsing is server-only | The `guards` table; the `parse.ts` fixture set (corrupt zip, text-as-xlsx, formula cell, row cap) |
| Routing / redirect authority | flagged user hand-crafting a request to a dashboard page, to either action, to `/api/catalog/template`; flagged user on `/change-password`; flagged user hitting logout; pre-flag JWT | Redirect in `requireUser` so `requireRole`, actions **and** the route handler all inherit it (decision 12, F2); `/change-password` served by the guard that cannot emit it (decision 13); `logoutAction` guard-free; optional session field (decision 14) | The `dal` redirect table; the no-loop test; the logout test; the pre-flag-JWT test |
| Credential handling | credentials in a log; in a temp file; re-fetchable via URL; in the session; generated during a preview; surviving a rollback; **in an audit payload**; CSV formula injection via `NombreCompleto` | Credentials absent from `ImportSummary` **and from every `AuditEvent` payload** by type (decisions 16, 22); no builder takes a credential parameter; client-side Blob only (decision 9); CSV neutralisation (decision 10) | "preview returns no password"; "no credentials on rollback"; "summary contains no password/hash"; the two `@ts-expect-error` audit tests + the forbidden-key sweep; CSV-injection table |
| Audit-log integrity | an `UPDATE` that rewrites history; a `DELETE` of an inconvenient row; a `TRUNCATE` that clears the table past row triggers; **the same three aimed directly at a child partition instead of the parent**; **a `DROP`/`DETACH PARTITION` that erases one year as DDL**; **a partition window that lapses so rows pile into `DEFAULT` and become unpurgeable**; an audit row for an import that rolled back; an import that commits with no audit row; a payload that duplicates personal data into an un-erasable table; an unbounded audit write used as a DoS | Row trigger **and** statement trigger, both raising `42501` (decision 19); the writer takes the `tx` handle only and runs last inside it (decision 23); payload stores field **names**, not values (decision 22); `MAX_ACCOUNT_EVENTS_PER_APPLY` as a dry-run validation error (decision 21). The row trigger is cloned into every partition, so child-targeted DML is refused too; `TRUNCATE` triggers are repeated per partition because statement triggers are not cloned; `DEFAULT` keeps inserts alive when the window lapses (decision 25). **Honest limits, both enlarged by partitioning**: the owning role can `DISABLE TRIGGER`/`DROP TABLE` **and can now drop a single year as DDL with no trigger involved**, a lapsed window traps rows in `DEFAULT` where the trigger itself blocks the fix, and a Neon restore can rewind the table — see decision 19, decision 25 and the open questions | `migration-0004.test.ts` (partitioning, bound arithmetic, trigger-set equality, `42501`, `REVOKE`); `audit-schema.test.ts`; the in-tx writer tests (zero rows on rollback, same handle, last position); the forbidden-key sweep; the over-cap planner fixture; Neon-branch rehearsal steps 4b–4h for routing, `DEFAULT`, cloning and the triggers actually firing |

---

## Migration / Rollout

1. **Read-only pre-check** (allowed without confirmation, project CLAUDE.md):
   `SELECT "Correo", count(*) FROM "Usuario" WHERE "Correo" IS NOT NULL GROUP BY 1 HAVING count(*) > 1;`
   Any row blocks `UQ_Usuario_Correo` and must be resolved with the user first.
   Also confirm whether `DATABASE_URL` is a direct or `-pooler` endpoint (F1).
   **And the server version** — `SELECT current_setting('server_version_num');`
   — which decides whether `0004` writes `GENERATED ALWAYS AS IDENTITY` on the
   partitioned parent or the documented `CREATE SEQUENCE` fallback (decision
   18). All three are reads; none needs confirmation. This one **blocks WU1b**:
   `0004` cannot be written before it is known.
2. `npm run db:generate` — **local only**, writes `drizzle/0003_*.sql` + snapshot
   + journal, connects to nothing. Review the emitted SQL by hand and confirm it
   mentions **no** audit object (decision 26 guarantees it; the test proves it).
   Then `npx drizzle-kit generate --custom --name audit_log` — also local, also
   connects to nothing — and hand-write the whole of `0004`.
3. The migration is **purely additive**: `0003` creates three tables, six
   indexes, one CHECK,
   `ALTER TABLE "Usuario" ADD COLUMN "DebeCambiarClave" boolean NOT NULL DEFAULT false`
   (non-rewriting on Postgres 11+) and `ADD CONSTRAINT ... UNIQUE ("Correo")`;
   `0004` creates the partitioned `EventoAuditoria`, its five yearly partitions
   and `DEFAULT`, three partitioned indexes, one FK, one CHECK, one function,
   one parent row trigger, one `TRUNCATE` trigger per relation and the `REVOKE`s.
   No drop, no rename, no rewrite. Multiple NULL `Correo` values stay legal —
   Postgres UNIQUE does not collide NULLs. `0003` and `0004` are applied in the
   **same** drizzle transaction, so the table never exists without its triggers
   and never exists without its partitions.
4. **Rehearse on a Neon branch cloned from the target** before any shared apply.
   The rehearsal is the only proof of the constraints and indexes (see *Testing*).
   Every probe below runs with the **application role** and every result is
   recorded, including the ones expected to succeed.
   4b. **Partition routing**: `INSERT` one row with `OcurridoEn` inside 2026 and
   read `SELECT tableoid::regclass FROM "EventoAuditoria" WHERE …`. It must name
   `EventoAuditoria_2026`.
   4c. **`DEFAULT` partition**: `INSERT` a row with `OcurridoEn = '2099-01-01+00'`.
   It must **succeed** and land in `EventoAuditoria_default`. This is the proof
   that a lapsed window degrades retention, not availability (decision 25).
   4d. **Rejected DML, parent and child**: attempt `UPDATE` and `DELETE` on
   `"EventoAuditoria"` **and** directly on `"EventoAuditoria_2026"`. All four
   must fail with `42501`; the child pair is the only evidence that the parent's
   row trigger was cloned. Any success blocks the change.
   4e. **`TRUNCATE`, and the open question inside it**: attempt
   `TRUNCATE "EventoAuditoria"` and `TRUNCATE "EventoAuditoria_2026"`. Both must
   fail with `42501`. Record **which** trigger refused each, and record whether
   the parent-level `BEFORE TRUNCATE` trigger could be created at all — if the
   parent rejects such a trigger, drop that one statement from `0004` and rely
   on the per-partition triggers, then freeze the test accordingly.
   4f. **Future partitions inherit the guarantee**: create a throwaway
   `EventoAuditoria_2031` partition, insert into it, then attempt `UPDATE` and
   `DELETE` — both must fail (cloning covers partitions created later). Then
   `TRUNCATE` it: this is expected to **succeed**, because its own `TRUNCATE`
   trigger was never created. That success is not a defect, it is the precise
   measurement of the residual hole that `migration-0004.test.ts`'s trigger-set
   assertion exists to prevent in the real window.
   4g. **Ownership limits** (the old 4c, widened): check whether the app role can
   `ALTER TABLE "EventoAuditoria" DISABLE TRIGGER USER` and whether it can
   `ALTER TABLE "EventoAuditoria" DETACH PARTITION "EventoAuditoria_2031"`. Both
   are expected to **succeed** (the role owns the table). Record both — they are
   the evidence for the role-separation open question, and neither is a defect
   of the trigger design.
   4h. **The `DEFAULT` trap, and the rollback path**: with the 2099 row still in
   `DEFAULT`, attempt `CREATE TABLE "EventoAuditoria_2099" PARTITION OF …` — it
   is expected to **fail**, which is the documented trap (decision 25) observed
   rather than asserted. Finally `DROP TABLE "EventoAuditoria"` on the throwaway
   branch and confirm the partitions went with it (the `0005` rollback assumes
   they do).
5. `npm run db:migrate` against the shared instance **only** after explicit,
   per-command user confirmation. Never `db:push`. Drizzle wraps pending
   migrations in one transaction, so a mid-file failure leaves nothing behind
   (verified in `roles-lookup-table/design.md` finding 1).
6. No feature flag: the import page is invisible and server-denied to every role
   but `secretaria`, so the change is inert until it is used.
7. Forward-fix only after commit; 0003/0004 are additive, so a compensating
   `0005` can drop the new objects without touching pre-existing data. Dropping
   the triggers requires table ownership, which the app role has — which is
   precisely decision 19's documented limit, seen from the rollback side.
8. **No retention job ships in F2**, and no scheduler is introduced. Rows
   accumulate at ≤ 2 001 per import (≤ ~20 000 per year at the expected
   cadence). What F2 does ship is the *shape* that makes a lawful purge
   possible later without touching a row (decisions 22, 25).
9. **What a future purge procedure must look like** — constraints only. Naming
   the constraints is not designing the procedure, and the retention period it
   depends on is still unknown, so none of this is built here. Any purge MUST:
   (1) operate **only** at partition granularity — `DETACH`/`DROP PARTITION`,
   never row-level DML, and never by disabling the trigger; (2) act only on a
   partition whose **entire** range is outside the retention window, checked
   against the catalogued partition bounds rather than the partition's name;
   (3) refuse to touch `DEFAULT`, whose range is unbounded by definition, and
   instead report a lapsed window as an incident; (4) write **its own audit
   row** — action, partition dropped, row count, authorising human — into the
   current partition **before** the drop, so the log records its own truncation
   (this is what makes the `ActorId` NOT NULL open question urgent: a purge has
   no session user); (5) be a reviewed migration or a documented runbook step,
   never ad-hoc SQL; (6) `DETACH` and archive rather than `DROP` wherever the
   law requires preservation outside the live system.
10. **The one operational task F2 leaves open, stated plainly**: the partition
   window ends `2030-12-31`. Before then, a human-authored migration must add
   the next window — each new partition needs its `TRUNCATE` trigger and its
   `REVOKE`, neither of which Postgres supplies automatically. There is no cron,
   no queue and no worker in this project, and `pg_cron` on a Neon compute is
   unverified and out of scope. The whole mitigation is a runbook note in
   `modelo_datos_sql.md` §4 carrying the expiry date and the check
   `SELECT count(*) FROM "EventoAuditoria_default";` (non-zero ⇒ the window
   lapsed and rows are already trapped). **Who watches that calendar is an open
   question, not a solved problem.**

---

## Work Units and Order

The proposal's three units do not fit the 800-line review budget (decision 17).
**Seven** chained slices; PR #1 targets the feature branch, each later PR targets
the previous one.

Audit is **folded into the existing slices**, not given a slice of its own for
its *logic* (decision 24 below) — but partitioning pushed the schema slice over
budget, so `WU1` splits in two. The touched slices carry their new estimate.

| WU | Content | Authored lines (est.) | Δ audit | Depends on |
|---|---|---|---|---|
| WU1a | `schema.ts` (three entities + `usuario` changes), `drizzle/0003` + snapshot + journal, `src/lib/data/catalog.ts`, users-data additions, `modelo_datos_sql.md` §3.1/§4 for those entities (X1/X2/X4), schema tests | ~450 | — | — |
| WU1b | `src/db/audit-schema.ts`, **`drizzle/0004_audit_log.sql`** (partitioned table, 5 partitions + `DEFAULT`, indexes, FK, CHECK, function, triggers, `REVOKE`s), `migration-0004.test.ts`, `audit-schema.test.ts`, `modelo_datos_sql.md` audit entity + the append-only/partition/runbook §4 note | ~420 | +420 | WU1a (journal order only) |
| WU2a | `limits` (+`MAX_ACCOUNT_EVENTS_PER_APPLY`), `sheets`, `schemas`, `normalize`, `guards`, `types`, `parse.ts` + `.xlsx` fixtures, the xlsx **advisory gate** and the pinned dependency | ~610 | +10 | — |
| WU2b | `plan.ts` — the pure planner and its full scenario suite; **`src/lib/audit/types.ts` + `events.ts` and their pure suite** (incl. the two `@ts-expect-error` tests and the forbidden-key sweep) | ~735 | +215 | WU1a, WU2a |
| WU2c | `temp-password`, `apply.ts`, provisioning, `ImportSummary` + structured log, **`src/lib/data/audit.ts` + the in-transaction wiring and its `tx`-double tests** | ~585 | +105 | WU1b, WU2b |
| WU3a | Forced password change end to end: session, dal, routes, login action, `/change-password` screen + action, i18n, tests | ~560 | — | WU1a |
| WU3b | Import UI: page (+`maxDuration`), form, preview, credentials download, actions, template route, `canImportCatalog`, sidebar, `bodySizeLimit`, i18n, tests | ~660 | — | WU2c, WU3a |

| # | Decision | Alternatives rejected | Rationale |
|---|---|---|---|
| 24 | **Fold the audit *logic* into WU2b / WU2c, but split the schema slice: `WU1a` (drizzle-generated schema) and `WU1b` (the whole audit migration). Seven slices.** | Keeping one `WU1` at ~850 and taking a `size:exception`; a seventh `WU2d` holding all of the audit work; putting the builders in WU2c too; moving `catalog.ts` out of `WU1` instead of splitting it | The single most important property of this audit log is *"written in the same transaction as the data"*, and a reviewer can only verify that in a diff containing **both** `apply.ts` and `insertAuditEvents` — so the *writer* still must not be sliced away from `apply.ts`, and `WU2d` stays rejected. The *schema* half is the opposite case and partitioning changed it: `0004` grew from ~30 lines of trigger DDL to ~110 lines of partitioned table, partitions, propagated indexes, per-partition triggers and grants, and its test grew a bound-arithmetic and a trigger-set assertion, taking `WU1` to ~850 — **over budget**. Decision 20's old argument ("every migration is reviewed in one place") no longer holds either, because `0004` now depends on nothing in `0003`: it is a self-contained artefact whose only link to `WU1a` is the ordering of `_journal.json`. Reviewing a partitioned append-only log next to three unrelated new entity tables serves nobody. The rejected alternative of moving `catalog.ts` into `WU2c` instead would leave `WU1` at ~730 and push `WU2c` to ~705 — two thin slices instead of two comfortable ones, and it would put a data-layer module in the slice that must stay focused on the transaction. One extra PR is the cheaper price |

Decision needed before apply: **Yes**
Chained PRs recommended: **Yes**
800-line budget risk: **High**

The risk is high for **three** reasons now, and all three must be said. It was
high because the proposal's three units were ~1 200–1 450 lines each; that is
fixed. It is still high because adding audit pushed `WU2b` to ~735 — about
**65 lines of headroom** — and `WU3b` to ~660. And it is high because
partitioning **already breached** the budget once: `WU1` measured ~850 and had
to be split, which is evidence that these estimates move under pressure rather
than an argument that they are now safe. **Mitigation, pre-authorised for
`sdd-tasks`:** if `WU2b` measures over 800 at apply time, split it at its
natural seam — `WU2b-1` `plan.ts` + planner suite, `WU2b-2` `audit/types.ts` +
`events.ts` + suite — which costs one extra PR and no redesign, because the
builders only consume the planner's public output. Do **not** absorb the
overflow into WU2c. `WU1b` has ~380 lines of headroom and is the slice most
likely to grow (probe 4e can add or remove statements), so it absorbs its own
variance.

**Chain risk, which the split increases.** Seven slices — eight if `WU2b`
splits — is the longest chain this repo has attempted, and every parent that
changes forces a retarget or rebase of everything below it. Two concrete
hazards: `WU1a` and `WU1b` both append to `drizzle/meta/_journal.json`, which
conflicts by construction, and both edit `modelo_datos_sql.md` in adjacent
sections. `WU1b` therefore **must** branch from `WU1a` and cannot be reordered
before it, even though its SQL depends on nothing `WU1a` creates. Land the two
back to back before opening `WU2*`.

Note for `sdd-tasks`: `WU2a` and `WU3a` are independent of each other and of the
migration *apply*, so only `WU1a`'s schema file is on the critical path. The
apply (the one confirmation-gated step, `0003` **and** `0004` together) can be
deferred until just before `WU2c`, keeping it off the critical path of the pure
work — the same sequencing argument as `roles-lookup-table` decision 25. Two
exceptions to that deferral: the **read-only** PG-version pre-check (step 1)
blocks the *writing* of `0004`, and the Neon-branch rehearsal (steps 4b–4h) must
run with the apply, never after it.

---

## Open Questions

- [x] **RNF-02 write auditing (X6)** — **RESOLVED** by user decision: the
      append-only log is in scope of F2 for write events (decisions 18–23).
- [ ] **RNF-02 read auditing (X6, residual)**: "every **access**" is still
      unaudited. It is a cross-cutting change to every reader of personal data
      (`/users` list, detail, profile), not an import concern. Confirm it is
      accepted as deferred and gets its own change.
- [ ] **Database role separation (decision 19)**: the app role owns
      `EventoAuditoria`, so it can `DISABLE TRIGGER` or `DROP TABLE`. True
      immutability needs a second Neon role — a DDL/owner role for migrations
      and an app role holding only `INSERT`/`SELECT` on this table. That is an
      infrastructure and `DATABASE_URL` change outside F2. Confirm whether to
      provision it now or accept the documented limit. Rehearsal step 4c
      produces the evidence.
- [ ] **Retention period under Ley 787 / RNF-06 (decisions 22, 25)** — still
      open, and now the *only* open half. The deletion path is solved: the table
      is partitioned by `OcurridoEn`, so a purge is `DROP`/`DETACH PARTITION`
      with no row ever touched and the trigger never disabled. What is not
      solved is **how long**. F2 must not invent a period.
- [ ] **Yearly granularity is a bet on that unknown period (decision 25)**:
      yearly partitions mean a row can be retained up to ~12 months past its
      lawful limit before its partition becomes droppable. That is acceptable
      for a period expressed in years and unacceptable for one expressed in
      months. Confirm the year-granular purge is acceptable — changing
      granularity **after** rows exist means rewriting audit history, the one
      operation this design exists to forbid.
- [ ] **Who runs the purge, and who watches the partition window?** Two distinct
      human owners, and F2 names neither: (a) the authority who may drop a
      partition once a period is agreed, and (b) whoever adds the next partition
      window before `2030-12-31`. There is no scheduler and F2 does not build
      one (*Migration / Rollout* §10). A lapsed window traps rows in `DEFAULT`,
      where the immutability trigger blocks the fix.
- [ ] **PG version and the identity form (decision 18)**: `GENERATED ALWAYS AS
      IDENTITY` on a partitioned parent is believed to require PG 17. This phase
      had no database and no documentation tool, so it is a read-only pre-check
      (step 1) that blocks WU1b, with a documented sequence fallback. Settle it
      before `0004` is written, not while applying it.
- [ ] **Parent-level `TRUNCATE` trigger (decision 19)**: whether a partitioned
      parent accepts a `BEFORE TRUNCATE` statement trigger, and whether
      truncating the parent fires the partitions' own triggers, are unverified.
      Probe 4e settles both and may remove one statement from `0004`.
- [ ] **`MAX_ACCOUNT_EVENTS_PER_APPLY = 2 000` (decision 21)**: chosen from the
      10 000-row sheet caps, not from evidence. The sample workbook settles
      whether a real first load fits, exactly as it settles decision 3's caps.
- [ ] **Is an `unchanged` account really not a modification (decision 21)?**
      Design says yes — no row, so a re-import writes exactly one audit row.
      Confirm that matches the institution's reading of RNF-02.
- [ ] **`ActorId` is NOT NULL (decision 18)**: every F2 audit write has a
      `secretaria` session, so this holds today. A future system/scheduled
      writer (a retention job, a seed) would have no actor and would force
      either a nullable column or a sentinel `Usuario`. Flagged, not solved —
      and **more urgent now**: the purge procedure constrained in *Migration /
      Rollout* §9 must write its own audit row, and a purge has no session user.
- [ ] **Proposal consistency**: `proposal.md` lists the audit log both in
      *In Scope* and, in a stale bullet, under *Out of Scope*. The parallel
      proposal update should remove the latter; this design assumes in-scope.
      Partitioning makes four further parts of `proposal.md` stale — the audit
      table's migration (`0003` → `0004`), its declaration file (`schema.ts` →
      `audit-schema.ts`), the six-unit delivery table (now seven), and the
      rollback claim that a compensating migration must `DROP TRIGGER` before
      `DROP TABLE` (it does not: triggers are dropped with their table).
      `specs/audit-log` needs one addition: its *bulk delete or truncate*
      scenario should name a **child partition** as a target, and its
      assumptions should record that the log's physical organisation must permit
      time-bounded removal without row-level DML, and that `DROP`/`DETACH
      PARTITION` by the owning role is explicitly **not** rejected.
- [x] **RF-35 scope (X5)** — **RESOLVED** by product-owner scope reduction: the
      import creates **no** student accounts, ever. The workbook drops to 3
      sheets (Asignaturas, Docentes, Grupos); Facultades, Carreras, Estudiantes
      and Inscripciones are no longer imported. See the amended X5 row above.
- [ ] **Deployment target (decision 5)**: is `maxDuration = 300` honoured? On a
      60-second platform ceiling, `MAX_NEW_ACCOUNTS_PER_APPLY` must drop to ~200
      and the first bulk load must be split across several workbooks.
- [ ] **`NumeroGrupo` normalization (X3)**: is `"01"` the same section as `"1"`?
      Current design says **no** (text, trimmed only). A sample workbook settles it.
- [ ] **Sample workbook**: the column names in `sheets.ts` are a proposal, not
      evidence. A real file from secretaría is needed before WU2a freezes them,
      along with real row counts to validate decision 3's caps.
- [ ] **Inactive matched account** (`imported-account-provisioning`, open
      assumption): design keeps it inactive — the import updates it but does not
      reactivate. Confirm.
- [ ] **xlsx advisory status (decision 1)**: this phase had no web or registry
      tool. The gate must be executed at WU2a before the dependency is committed.

---

## Post-implementation notes (2026-10-04)

Deviations between this design and what shipped. The decisions and the file
table above are left as written.

- Import form split: `src/app/(dashboard)/catalog/import/import-form.tsx`
  composes `workbook-contract.tsx`, `file-dropzone.tsx` and `import-errors.tsx`
  (plus `import-preview.tsx` and `credentials-download.tsx`).
- Auto-preview: taking a file in `file-dropzone.tsx` (drop or picker) runs the
  preview immediately; there is no submit button. A client-side pre-check
  rejects a non-`.xlsx` name or an oversized file before any request.
- Sidebar i18n: `nav.administration` and `nav.catalogImport` replace
  `nav.catalog` (`src/components/app-sidebar.tsx`).
- Sidebar structure: a collapsible "Administración" group holding the import
  and users entries, built on `src/components/ui/collapsible.tsx`.
- `applyImport(tx, plan, credentials, ctx)` in `src/lib/import/apply.ts` takes
  a fourth argument, `ctx` (`ApplyContext`: snapshot, actor id and login,
  timestamp, file SHA-256).
- `runImportApply` (`src/lib/import/apply.ts`) plans twice: once outside the
  transaction to decide which accounts need credentials, and again inside the
  transaction on a freshly read snapshot.
- `maxDuration` is the literal `300` in
  `src/app/(dashboard)/catalog/import/page.tsx`.
- `src/app/change-password/layout.tsx` was added for the forced-password-change
  screen.
- `logImportFailure` was added in `src/lib/import/summary.ts` and is used by
  `actions.ts`.
- The `Inscripcion` requirement in `specs/academic-catalog` was reworded as
  deferred: no writer ships, because the Inscripciones sheet was cut.
- Migration `0003` was found already applied to the shared instance; `0004`
  (`drizzle/0004_audit_log.sql`) was applied on 2026-10-04.
