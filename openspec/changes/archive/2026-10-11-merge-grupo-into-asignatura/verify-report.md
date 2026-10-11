```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:c1c8020b137fd5ce70b8879ca7320fd074eb251b30865d5c21f436efe63b523e
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 14/14
scenarios: 77/77
test_command: npm test
test_exit_code: 0
test_output_hash: sha256:2c23511a64f3b41cedee0418207dcd05b13596646fa60bde765ba24e2d87237b
build_command: npm run build
build_exit_code: 0
build_output_hash: sha256:c706c4a82f33d0f415e9c58a4394a2f5e5c2a02be7ff64dec9bcda78686acc8a
```

## Verification Report

**Change**: merge-grupo-into-asignatura (re-scoped 2026-10-10 to option A, UI-only)
**Mode**: Strict TDD (full artifact set: proposal, 1 delta spec, design, tasks, apply-progress)
**Repository**: branch feature/better-ui, HEAD 499f1ef4d7264aeab233e8cb6e3805298e1b6298 (contains implementation commit f873b38, merged as PR #15). Working tree: only `tasks.md` modified (task 0.5 ticked); `openspec/changes/backoffice-ui-refresh/` is untracked and unrelated.
**Runtime attempt**: request-id verify-mgia-20261011-actor-1, work unit final-verify (acquired by the orchestrator; not settled by this agent).
**Evidence revision derivation**: sha256 of `HEAD sha | sha256(tasks.md) | test_output_hash | build_output_hash` (hex values, pipe-joined).

### Executive Summary

All 60 tasks are complete and backed by the repository. The full suite passes (146 files, 2919 tests, exit 0), typecheck is clean, the production build succeeds (all new routes present, `/catalog/grupos` list gone, `/catalog/grupos/[id]/edit` kept as the redirect page), and lint shows zero real errors (54,812 findings, every one the documented CRLF "Delete CR" prettier noise). The 14 requirement blocks (5 ADDED, 7 MODIFIED, 2 REMOVED) and 77 scenarios are covered by passing automated tests, by live HTTP redirect checks recorded during apply, or by the owner's manual walk-through. Design decisions UG-1 to UG-10 were followed. There are no CRITICAL findings. Four WARNINGs and three SUGGESTIONs are listed below; none is an unproven core behaviour. **Verdict: PASS WITH WARNINGS.**

### Completeness

| Metric | Value |
|---|---|
| Tasks total | 60 |
| Tasks complete | 60 (zero unchecked boxes in tasks.md) |
| Tasks incomplete | 0 |
| Executor tasks | 57 done and repository-backed |
| Owner tasks | 0.5, 6.9, 6.10 ticked; 0.5 confirmed in conversation 2026-10-11 (the only uncommitted edit), 6.9 and 6.10 reported passing by the owner 2026-10-11 (manual evidence, not machine-verifiable by this phase) |

Repository backing spot-checked in HEAD: `legacy-redirects.ts` (3 rules, all `permanent: false`) and `next.config.ts` `redirects()`; both group pages under `catalog/asignaturas/[id]/grupos/`; the guarded redirect page at `catalog/grupos/[id]/edit/page.tsx`; `actions.ts` with `ASIGNATURAS_PATH`, `revalidateGrupo` and no `LIST_PATH`; `asignaturas.ts` with `grupoMatchesTerm`, the `exists` member and `listMatchingGrupos`; sidebar with no Grupos entry; `catalog/grupos/page.tsx` and `new/` deleted; `listGrupos` and `buildGruposWhere` removed; the `data-table-search.tsx` `key={value}` fix.

### Execution Results (run now, on HEAD plus the tasks.md tick)

```text
$ npm test
Test Files  146 passed (146)
Tests  2919 passed (2919)
Duration  56.94s
Exit code: 0
```

- A vitest-pool notice appeared once: "Timeout terminating forks worker for test files .../grupos/grupo-form.test.tsx". It did not fail any test; the file passed. Neither known-intermittent file (new-user-form.test.tsx, catalog/import/import-form.test.tsx) failed in this run.
- **Typecheck**: `npm run typecheck` (tsc --noEmit), exit 0, no output.
- **Lint**: `npx eslint src` raw run reports 54,812 problems, all prettier/prettier "Delete CR" findings (count of that rule = 54,812). After filtering those rows no problem row remains and a search for the word error prints nothing. Zero real lint errors.
- **Build**: before building, netstat showed nothing listening on :3000 or :3111. `npm run build`, exit 0. Routes include `/catalog/asignaturas`, `/catalog/asignaturas/[id]/edit`, `/catalog/asignaturas/[id]/grupos/[grupoId]/edit`, `/catalog/asignaturas/[id]/grupos/new`, `/catalog/asignaturas/new`, `/catalog/docentes`, `/catalog/grupos/[id]/edit`, `/catalog/import`; `/catalog/grupos` is absent. The shared `[id]` slug beside `[grupoId]` raises no conflict (the UG-1 unverified point is now verified by this build).
- **Coverage**: not configured, informational only.
- **Strict TDD**: apply-progress records RED-first evidence per task (failing reason, then GREEN), mutation proofs for characterization tasks (parent check, guard-first, confirmation label, sidebar prefix rule, has anchoring) and honest notes where a test was green before the code (B7 pin, inactive-parent case). No out-of-order phase was found.

### Spec Compliance Matrix

Spec: `specs/catalog-management/spec.md` (delta). Legend: COMPLIANT = covering automated test passed in this run; COMPLIANT (live) = proven by an HTTP check recorded during apply on `next start` (not re-run here); COMPLIANT (manual) = owner attestation of 2026-10-11; PARTIAL = structural test plus owner check, no executed-data test.

| Requirement | Scenarios | Evidence | Result |
|---|---|---|---|
| CM-GRP-9 Create under Asignatura | fixed by route; unusable-parent table; hand-crafted value; breadcrumb; roles/scope (5) | `asignaturas/[id]/grupos/new/page.test.tsx`, `grupos/grupo-form.test.tsx`, `grupos/actions.test.ts` (tamper cases), `guards.test.ts` | COMPLIANT |
| CM-GRP-10 Edit under Asignatura | opens under own; mismatch not found; unusable table; inactive parent; deactivation confirmation; roles (6) | `.../grupos/[grupoId]/edit/page.test.tsx` (56 tests, parent-check mutation proved), `guards.test.ts` | COMPLIANT |
| CM-GRP-11 Outcome of saving | create returns; edit returns; pages refreshed; no redirect when nothing saved; toggle stays (5) | `grupos/actions.test.ts` (98 tests), `audit-leak.test.ts`; saved row visible end to end is task 6.9 | COMPLIANT (row visible after redirect: manual) |
| CM-ASG-9 Search by groups | docente; periodo; group number; name+group; several groups; pagination; inactive group; status filter; out of scope; no match; code-only no hint; ordering/failure; copy (13) | `lib/data/asignaturas.test.ts`, `asignaturas/page.test.tsx`, `i18n/catalog-parity.test.ts`; row-counting scenarios pinned structurally on rendered SQL (one shared where, exists, capped hint in code) | COMPLIANT for 10; PARTIAL for 3 row-counting scenarios (W1) |
| CM-RTE-1 Retired URLs | redirect table; temporary; edit in scope; cannot probe; malformed id; denied callers; anonymous on config redirect; other paths not found (8) | `lib/catalog/legacy-redirects.test.ts` (47), `grupos/[id]/edit/page.test.tsx` (30), `guards.test.ts`; HTTP 307s recorded in apply (batches 2, 4, phase 6) | COMPLIANT; anonymous config redirect COMPLIANT (live); real 307 of the page redirect and 404 of `/catalog/grupos/12` and `/12/other` COMPLIANT (manual, owner 6.10) |
| CM-NAV-1 Sidebar | visibility per role; no Grupos destination; exclusive active; Asignaturas active on group routes (4) | `components/app-sidebar.test.tsx` (88); prefix rule mutation-proved | COMPLIANT |
| CM-LST-1 Lists | default; filter; search; pagination clamp; empty; docentes read-only; status fallback; no credential; db unavailable (9) | existing list and page tests kept green plus search row via CM-ASG-9 tests | COMPLIANT |
| CM-ASG-7 Grupos section | listed; week order; empty days; locales; empty state; add link; inactive; cap; read fails; scope; roles (11) | `asignaturas/[id]/edit/page.test.tsx` (63), parity test | COMPLIANT |
| CM-ASG-8 Groups column | several groups; inactive excluded; no active; scope unchanged; search ignores group numbers (5) | `asignaturas.test.ts` column tests (unchanged) plus B7 pin (no NumeroGrupo, no Dias in predicate) | COMPLIANT |
| CM-GRP-1 Fields and validation | valid; invalid table; duplicate; inactive match; same number elsewhere (5) | `grupos/actions.test.ts` (unchanged logic, kept green) | COMPLIANT |
| CM-SCOPE-1 Carrera scoping | lists limited; foreign by id; create route fixes Asignatura; scope follows Carrera (4) | `asignaturas.test.ts`, both group page tests, redirect page test, `scope-inventory.test.ts`, actions tests | COMPLIANT |
| CM-SCOPE-2 No Carrera | empty state; writes refused (2) | both group page tests, redirect page test, actions tests | COMPLIANT |
| CM-GRP-7 (REMOVED) | none (migrated into CM-ASG-7) | no list page exists; day scenarios live in CM-ASG-7 tests | COMPLIANT (absence verified) |
| CM-GRP-8 (REMOVED) | none (migrated into CM-GRP-9, CM-RTE-1) | asignaturaId query handled only by config rules; tamper scenario kept in CM-GRP-9 tests | COMPLIANT (absence verified) |

Totals: 14 of 14 requirement blocks and 77 of 77 scenario headers (the spec header count is authoritative; the per-row counts above are indicative). Every scenario has at least one passing runtime check, a recorded live HTTP check or an owner attestation; three scenarios are PARTIAL on executed row counts (W1).

Not-changed checklist: `git diff f873b38~1 f873b38 --name-only` over the intake paths, `src/lib/data/solicitudes.ts`, the requests pages, `src/db`, `drizzle`, `src/lib/validations/catalog.ts`, `src/lib/audit/events.ts`, `src/lib/data/grupo-dias.ts`, `src/lib/catalog/dias.ts` and the import `file-dropzone.tsx` prints nothing. No migration, no schema change. No database command was run by this phase.

### Correctness (static evidence)

| Item | Status | Notes |
|---|---|---|
| New-group page order (guard, scope none, id, scoped read, inactive, docentes) | Implemented | UG-1 |
| Edit page parent check, no `activo` check on parent | Implemented | `record.asignaturaId !== asignaturaId` gives `notFound()` with no extra query |
| Redirect page: `redirect()` and `notFound()` outside `try`, no `permanentRedirect`, target from scoped record only | Implemented | read in source |
| Create and update redirect to Asignatura edit; toggle no redirect; three revalidated paths | Implemented | `actions.ts` lines 45-56, 146-147, 211-212, 260 |
| Search exists member, no group Activo, scope ANDed outside, term bound | Implemented | `asignaturas.ts` lines 57-87 |
| Matched-groups hint: max 3, plus N more, text only | Implemented | third statement only when q is set and the page is non-empty |
| Config redirects `permanent: false`; has pattern mirrors `parseRecordId` | Implemented | refinement noted below |

### Design Coherence

| Decision | Followed? | Notes |
|---|---|---|
| UG-1 route tree, `[id]` + `[grupoId]` | Yes | build proves no slug conflict |
| UG-2 FixedField plus hidden asignaturaId | Yes | form test pins no combobox |
| UG-3 actions, no returnTo, LIST_PATH gone | Yes | source pin: no `/catalog/grupos` literal in `actions.ts` |
| UG-4 config rules plus one guarded page | Yes | status and page override confirmed live (apply batch 4) |
| UG-5 EXISTS plus second statement | Yes | |
| UG-6 Name-cell hint, existing tokens only | Yes | |
| UG-7 i18n move, add, reword, parity | Yes | parity suite green |
| UG-8 structural pins | Yes, with documented deviations | X9 delete branch; `catalog-parity.test.ts` rebuilt after a script error in Batch 4 (S2) |
| UG-9 remove `listGrupos` and `buildGruposWhere` | Yes | no remaining hits |
| UG-10 seam slicing | Followed in the work; delivered as one commit rather than seven | S1 |

Deviation from design, non-breaking: the redirect has-pattern is `[1-9][0-9]{0,14}` (mirrors `parseRecordId`) rather than "digits only", so `0` and `007` fall to the Asignaturas list. This matches the spec intent (U12) and is pinned by tests.

### Issues

**CRITICAL (must fix before archive)**: None.

**WARNING (should fix or accept)**

- W1. Three CM-ASG-9 scenarios (several matching groups give one row, pagination counts Asignaturas, term matches by name and through a group) are verified structurally on rendered SQL and in-code grouping, not on executed data. Per tasks.md X7 this was a planned limitation; the owner walk-through of 2026-10-11 (6.9) attests the real-data behaviour. Covered but not machine-executed.
- W2. Owner tasks 6.9 and 6.10 are manual attestations; this phase cannot reproduce them (no session, no database access by design). The real status code of the page redirect at `/catalog/grupos/{id}/edit` and the 404 for other retired paths for a signed-in user rest on that attestation.
- W3. The post-walk-through fix to `src/components/data-table-search.tsx` (`key={value}`) is covered by a unit test but was not re-checked in a browser after the fix (apply-progress).
- W4. `apply-progress.md` still describes the work as uncommitted, against main d118b67 and an index holding three staged spec deletions. That is a stale snapshot, since the code is in HEAD; not a code defect. The implementation commit also carries a `package-lock.json` change (52 insertions, 23 deletions, removal of peer flags), which apply-progress called a pre-existing modification unrelated to this change.

**SUGGESTION (nice to have)**

- S1. The plan was one PR with `size:exception`, planned as seven commits; it landed as one commit (50 files, 5,987 insertions, 9,193 deletions). Consider recording in the archive notes that per-seam commit history was not preserved.
- S2. `src/i18n/catalog-parity.test.ts` was rebuilt in Batch 4 after an editing-script mistake (about 390 lines restored from git history plus replayed edits, not byte-compared). It passes now; a reviewer should still skim that file diff, as the executor recommended.
- S3. A vitest worker for `grupo-form.test.tsx` hit a termination-timeout notice under full-suite load although the file passed. It is not one of the two known-intermittent files; worth watching.

### Not Verified

- Anything behind a session or the database (rendered pages, real writes, real exists row counts, the 307 and 404 of `/catalog/grupos/{id}/edit` and `/catalog/grupos/12`), by design of this phase and by the DB-write boundary; covered only by owner attestation (6.9, 6.10).
- HTTP redirect behaviour was not re-run in this phase; results come from apply batches 2, 4 and phase 6 (`next start` on :3111, all 307, no 308 or 301).
- Visual rendering and accessibility in a browser.
- Coverage (not configured).

### Verdict

**PASS WITH WARNINGS.** 0 CRITICAL, 4 WARNING, 3 SUGGESTION. Ready for archive. Archive notes: update the main spec history bullets as the delta already instructs, and update the roadmap status for this change.
