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
| Handoff and OC-6 decision | `7a5ef4d` |
| 3a Catalog URL contract and data layer | `ef14c81` |
| 3b Asignaturas list | `a19f352` |
| 3c Docentes list | `437d56d` |
| 3d Bounded tables, legacy components removed | `b4178c6` |

Last verified green (2026-10-13, Batch L): 172 files, 3,691 tests, `npm run typecheck`, `npm run build`; `npx prettier --check --end-of-line auto src i18n` clean. The four commits `ef14c81` to `b4178c6` are not pushed (`ahead 4` of `origin/feature/better-ui`).

## What is left

All implementation slices (0 to 3d) and the automated part of the final phase (F.1, F.2, F.3, F.7, recorded in `apply-progress.md` Batch L) are done. Everything that remains is owner-only:

1. 2d.5 Gate V1 and 2d.6 users smoke; 3b.6 asignaturas smoke; 3c.6 docentes smoke (signed-in session and real database). Tick 2d.8 once V1 is recorded.
2. F.4 manual checklist (320/360px, keyboard, reduced motion, themes and brands, es/en, touch, error screen).
3. F.5 `docs/roadmap.md` row and F.6 spec merge confirmation (owner edits).
4. Push the commits, open the single PR (size:exception text and PR draft are in Batch L), then run `sdd-verify` (F.8).
5. Optional follow-ups recorded as gaps in Batch L: a real-Postgres ordering suite (G-1), page-frame and users `h1` assertions (G-5), one sentence in `docs/design-system.md` "Sortable header" about the visible state text (S-2).

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
- Sort indicator is icon only (owner decision, Batch N, supersedes the 2c.0 visible text): the state is exposed by `aria-sort` and the button description, the accessible name stays the column label.
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
- Slices ran well over their estimates (final: about 13,300 changed lines excluding openspec notes and the lock file, 67% tests, against 5,800 to 7,250 forecast). Per-slice counts are in `apply-progress.md` Batch L for the `size:exception` justification.
