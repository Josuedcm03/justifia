# Handoff: backoffice-ui-refresh

Read this file first, then `tasks.md`, `apply-progress.md`, `design.md` and `specs/` in this folder. Everything needed to continue is in the repository; no other memory or tooling is assumed.

## State

- Branch: `feature/better-ui`. Nothing is pushed to `main`.
- Mode: Strict TDD (`npm test`, vitest). One PR with an accepted `size:exception` (D14).
- Package: `@tanstack/react-table@8.21.3` (v8 names; do not move to v9).

| Done | Commit |
|---|---|
| OpenSpec artifacts | `b74f5f3` |
| Phase 0 (dependency) | `5af89f7` |
| 1a Orientation (shell context, navigation, sidebar identity) | `a173b35` |
| 1b States and home | `54fd126` |
| 2a URL contract and users data layer | `c0bc25a` |
| 2b Table core | `c47cc2d` |
| 2c Table controls | `e3fc185` |
| 2d Users migration (code) | `d290c0d` |

Last known green: 171 files, 3,554 tests, `npm run typecheck`, `npm run build`.

## What is left

Work in this order, one slice per pass, committing by slice:

1. **3a** Catalog URL contract and data layer. OC-6 is already answered (below), so 3a.1 needs no stop.
2. **3b** Asignaturas list.
3. **3c** Docentes list.
4. **3d** Bounded tables, deletion of the four legacy table components, i18n key sweep.
5. **Final phase** F.1, F.2, F.3, F.7, then stop for `sdd-verify`.

Use the suggested commit message written in each slice's CHECKPOINT task in `tasks.md`. Stop at every CHECKPOINT: run V, append one batch section to `apply-progress.md` (never overwrite), tick the tasks, report.

## Not yours (leave unticked, list them in `apply-progress.md`)

- 2d.5 gate V1 and 2d.6 users smoke: need a signed-in session and the real database.
- The `[MANUAL]` smoke parts of 3b.6 and 3c.6, and the whole of F.4 (browser, 320/360px, keyboard, themes, reduced motion).
- F.5 (`docs/roadmap.md` row) and F.6 (spec merge confirmation): owner edits. Never edit `docs/roadmap.md`.
- Do not run any database command (migrate, push, seed, SQL writes). Read-only app queries only. See the migration rule in the root `CLAUDE.md`.
- Do not push, open PRs or touch `main`. Do not add `Co-Authored-By` or AI attribution; use conventional commits.

## Decisions already taken (do not reopen)

- TanStack Table v8 pinned (gate T1).
- Collation `es-x-icu` exists in Neon; the database default is `C.UTF-8` (gate S1). `TEXT_SORT_COLLATION = "es-x-icu"`; the `lower(column)` fallback is not used.
- OC-3, OC-4, OC-5 confirmed: docente home shows one sentence and no cards; failed stats read shows `DegradedAlert`, never zeros; secretaria count cards show system-wide totals with no new query (D9).
- **OC-6 answered (owner, 2026-10-12): alphabetical.** The docentes default `name asc` order uses `TEXT_SORT_COLLATION` (`es-x-icu`), so accented and lowercase-initial names sort by their alphabetical position. Same rule as every other collated name column.
- Sort indicator is visible text (`aria-hidden`), the button's accessible name stays the column label.
- No-results "clear filters" link clears only the search term and the status filter, keeps `sort`, `dir` and `size`, and goes to page 1.
- Sortability is opt-in per column (`enableSorting === true`).

## Working rules

- RED test first, then GREEN, then refactor. Behavior-first assertions; class assertions only where the task asks for them.
- Never compose an href inside a component: use the pure builders and `applyListChange`.
- Never pass credential or private fields to a client table (`hashClave`, `cif`, `telefono`, `correo`, passwords): pick the displayed fields explicitly on the server.
- Do not edit `src/app/globals.css` (`git diff --stat src/app/globals.css` must stay empty).
- Next.js here has breaking changes: read the relevant guide in `node_modules/next/dist/docs/` before touching route files.
- Code, comments, tests and docs in English; locale files carry Spanish and English with identical key sets.

## V (run at every checkpoint)

`npm test`, `npm run typecheck`, `npx eslint src`, `npx prettier --check --end-of-line auto <touched paths>`, `npm run build`, and `git diff --stat src/app/globals.css` (empty).

## Known traps

- The working tree is CRLF and the index is LF (`core.autocrlf=true`). The Edit tool can rewrite a CRLF file to LF: after edits, count bytes with a Node script and restore CRLF where the file was CRLF. `grep -c $'\r'` is unreliable in this shell.
- `npx eslint src` and `npm run format:check` report only CRLF `prettier/prettier` noise on this checkout; judge by `--end-of-line auto` and by "no finding of any other kind".
- Under Vitest, `next/link` resolves to the pages implementation: use the stand-in in `src/test/navigation-mock.ts`. `keyEchoIntl` lives in `src/test/key-echo-intl.ts` (a mock factory that imports the mocked module deadlocks).
- Drizzle's `QueryBuilder.toSQL()` proves scope, ordering, collation and projection without a database; do not split `order by` text on `", "` (it breaks `nullif(col, '')`).
- `users.search.*`, `users.count` and `users.pagination.*` are unused after 2d; they are removed in 3d.9.
- Slices run well over their estimates (about 8,470 lines so far, roughly 65% tests). Record per-slice line counts in `apply-progress.md` for the `size:exception` justification; split only at slice seams.
