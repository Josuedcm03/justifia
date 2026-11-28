# Proposal: Normative Parameters (RNF-14)

## Intent

RNF-14: "a change in the deadlines, the calendar of non-business days, the
causes, the recurrence threshold or the maximum file size does not require a new
deployment". Today every one of these is a code constant (inventory in
`exploration.md`), so RNF-14 is "No cumple" and thesis 5.1 Table 14 lists the
"Parámetros normativos" module as absent. Owner scope (D8): exactly what is
needed to declare RNF-14 met: its five families plus the RN-13 type-to-cause
map, edited on one screen (CU-13). Success: each value changes from the running
app and the next request applies it, proven on Postgres.

| ID | Relation |
|---|---|
| RNF-14 | Covered: the five families and the RN-13 map become data |
| RN-01 | The five causes (art. 34) can be activated, deactivated and reordered |
| RN-04 | Maximum size configurable, 1 to 10 MiB (default 10; scope cut 2026-11-27, was 1 to 25) |
| RN-07, RN-08 | Late-filing days, remission days (both default 2) and alert days (default 1) |
| RN-13 | Type-to-cause map is a parameter (`otro` stays mapped to no cause) |
| RN-14 | Recurrence threshold (default 3) |
| RN-23 | Filing window (default 30 calendar days) |
| RNF-01 | Only `secretaria` edits; every other role is denied on the server |
| RNF-06 | One `EventoAuditoria` row per change, key and before/after, no personal data |
| RNF-12 | Deactivating a cause asks for confirmation in the existing alert dialog (scope cut 2026-11-27, was every change) |
| Thesis | CU-13, Anexo D Table D19, 5.1 Table 14 |

## Scope cuts (2026-11-27)

The owner approved eight cuts, under one principle: "just what is necessary to
declare RNF-14 met, no more, no less". The thesis basis is RNF-14's acceptance
(thesis 5.3 Table 16, verified by inspection: a change to the deadlines, the
calendar, the causes, the recurrence threshold or the maximum file size needs no
new deploy); CU-13 in thesis 4.3 is one row (Configure normative parameters,
actor secretaria academica, RNF-14) with no steps; RNF-12 asks a confirmation
dialog only to reject a request and to deactivate a record; RNF-06 asks one audit
entry per catalog modification; RNF-11 (360 px) applies to student screens.

1. `tamano_maximo_mib` is 1 to 10 MiB (default 10). No 25 MiB ceiling, no
   migration 0018, no `DOCUMENT_BYTES_CEILING`; the existing 10 MiB check stays.
   Slice 7 lowers the registry maximum built in slice 1 and pins it to the check.
2. No mutation checks from slice 5 on. Strict TDD stays.
3. Work after slice 8 is two PRs: 9 (access guard and every server action) and 10
   (page, four sections, menu entry, docs), each with a pre-approved size
   exception up to 1500 lines. Ten numbered slices instead of thirteen.
4. The owner system test has seven steps (permission, deadlines with alert, RN-07
   and RN-23, calendar, causes with the RN-13 map, recurrence threshold, maximum
   size, audit) instead of fourteen.
5. No two-step confirmation of every save: no `confirm-changes.tsx`, no hidden
   marker, no diff list, no `unconfirmed` outcome. Only deactivating a cause asks,
   in the existing alert dialog.
6. No extra display: no Reglamento default, no range in words, no per-year date
   badges, no current-year warning, no "default in use" badge, no degraded locked
   forms. Each field shows its value in force; errors state the allowed range.
7. No per-section "effect without redeploy" Postgres cases (the owner system test
   is the proof). The write and audit Postgres cases of slice 8 stay.
8. No 360/320 px or 44 px target tests for the staff page.

## Scope

### In Scope (owner decisions, 2026-11-27; final)
- **Store** exactly Table D19 `ParametroNormativo` (`Id`, `Clave varchar(60)`,
  `Valor jsonb`, `VigenteDesde date`, unique `Clave`+`VigenteDesde`); no extra
  columns. A save inserts the row in force from today (Managua); a second save
  the same day replaces that day's row; history kept.
- **Loader**: per key, latest `VigenteDesde` not after today, validated by the
  key's Zod schema; per-key fallback to the Reglamento default when missing,
  invalid or unreadable. Read per request, React `cache()` dedupe, no
  cross-request cache.
- **Keys**: remission days (RN-08), alert days (RN-08, D4), late-filing days
  (RN-07, D3), filing window (RN-23), recurrence threshold (RN-14), max size MiB
  (RN-04, D6), calendar (date list, optional description, coverage by year),
  causes (active flag and order, D1), type-to-cause map (RN-13).
- **D1 causes**: codes fixed, `Causa` CHECKs stay. A deactivated cause leaves
  new selection, keeps rendering in existing data; a draft carrying it is
  refused at the next save or submit; at least one stays active.
- **D2**: `secretaria` only (CU-13 actor).
- **D5 effect**: on-read rules (RN-07, RN-08 deadline and alert, RN-13, RN-14,
  calendar) use the value in force at read time; filing-time rules (RN-23, size)
  apply at the action; no snapshot; stored `PlazoInicioEn` not recomputed.
- **D6** (revised 2026-11-27): range 1 to 10 MiB; `CK_Documento_Tamano`
  (10 MiB) is not changed; "10 MB" copy takes the value.
- Docs: roadmap row 8, RNF-14 status note.

### Out of Scope
- New causes, cause label editing (future work); retention RNF-04 (D7);
  operational constants (`MAX_DOCUMENTS_PER_DRAFT`, draft TTL, import 5 MiB);
  switching the teammate's RF-13 (c) report to the loader; raising the maximum
  size above 10 MiB; the display and confirmation extras of the scope cuts above.

**DB schema: YES.** Migration `0017` only (table plus seed rows from current
defaults), applied to production only after the owner's explicit yes for that
command.

## Capabilities

### New Capabilities
- `normative-parameters`: store, registry and ranges, effective-date rule,
  loader fallback, secretaria-only screen, confirmation, audit, cause activation
  rules, calendar coverage.

### Modified Capabilities
- `request-review`: "Queue ordering and RN-08 alert" (configured days and alert;
  staleness-test scenario becomes the coverage notice).
- `validation-signals`: RN-07 own key; RN-14 threshold and MD-15 map read from
  parameters (drop "code constant until roadmap #8").
- `justification-intake`: "Cause and dates rules", "Submit blocking" (window,
  active causes, order).
- `supporting-documents`: "Upload authorization and limits", "Finalize" (size
  from parameter).
- `audit-log`: closed set gains parameter actions.
- `backoffice-shell`: BS-NAV-1 gains the secretaria entry.

Checked, no delta: `coordination-escalation` (calendar source only),
`coordination-reports`, `route-access-coverage` (table row, rules unchanged).

## Approach

New `src/lib/parameters/*` (registry, loader, write). Pure rules gain explicit
parameters; the async load happens once at page, action or route boundary.
Calendar keeps `NonWorkingDaysProvider` through `constantCalendar`. Writes reuse
the `withCatalogWrite` lock and transaction with the audit row; audit codes
appended at the end of `AUDIT_ACTIONS`. `DEFAULT_SIGNAL_PARAMS` and `issuer.ts`
exports stay stable. Strict TDD.

| Slice (tracker `feat/normative-parameters`) | Est. lines |
|---|---|
| S1 Migration 0017, schema, registry, loader, fallback, unit and Postgres read tests | 700-850 |
| S2 On-read consumers: deadlines, alert, RN-07, threshold, map, calendar; coverage notice | 750-900 |
| S3 Filing-time consumers: window, causes filter and refusal, size (routes, server, client props, copy); registry maximum lowered to 10 and pinned to the existing check | 800-950 |
| S4 Predicate, audit, write; then the guard and every server action | 850-1500 |
| S5 `/parameters` page, four sections, nav, access matrix; docs | up to 1500 |

Estimates by analogy. `tasks.md` cuts these into ten numbered slices (the design
estimates ran 2x to 3x in practice); slices 9 and 10 carry a pre-approved size
exception up to 1500 lines (owner, 2026-11-27).

## Affected Areas

| Area | Impact |
|---|---|
| `src/db/schema.ts`, `drizzle/0017_*` | Modified/New |
| `src/lib/parameters/**`, `src/app/(dashboard)/parameters/**` | New |
| `src/lib/intake/{business-days,dates,submission,causes,calendar}.ts`, `src/lib/validations/solicitud.ts` | Modified |
| `src/lib/signals/{timing,params,document-type-causes}.ts`, `src/lib/data/{signals,revision-queue,documentos,special-format}.ts` | Modified |
| Upload-token routes, review and coordination pages/actions, `documents-step.tsx`, `special-format-upload.tsx` | Modified |
| `src/lib/audit/{types,events}.ts`, `src/lib/auth/permissions.ts`, `src/lib/navigation.ts`, `i18n/{es,en}.json` | Modified |
| `docs/{roadmap,requirements}.md` | Modified |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Deadline 2026-12-01 vs ~4k lines | High | Slices independent; S1-S3 alone leave defaults working |
| Merge before migration: reads fall back, writes fail | Med | Apply 0017 (owner yes) before S4 reaches `main` |
| RN-15 tension: the deciding role edits its rules | Med | Owner decision (CU-13); audit before/after |
| Concurrent same-day saves (no `Version` in D19) | Low | Lock and transaction; last write wins, audited |
| Lowered size refuses an in-flight upload at finalize | Low | Copy states the current limit |
| Teammate edits audit, i18n, schema, migration number | Med | Append-only; rebase per slice; check `0017` is free |

## Rollback Plan

Revert slice PRs in reverse order or the tracker merge; redeploy `main`. The
table is additive and ignored by old code. Audit rows stay.

## Dependencies

- Disposable Neon branch for integration and system runs (existing guard);
  never production.

## Success Criteria

- [ ] Postgres integration: seeds and the per-key fallback of the loader; the
  write path writes one audit row per changed key, in one transaction.
- [ ] Owner system test (seven steps): each family changed in the running app,
  effect seen on the next request.
- [ ] RNF-01 matrix denies all non-secretaria roles; RNF-12: deactivating a cause
  asks for confirmation and cancel changes nothing.
- [ ] `npm test`, `npm run typecheck`, `npx eslint src`, `npm run build` green.

## Thesis Sync (thesis session)

- 5.1 Table 14: "Parámetros normativos" module built.
- 5.3 Table 16 and Anexo F: RNF-14 row to "Cumple" after the system test.
- CU-13 stays the single row of 4.3 (no steps, so no Anexo E sync; owner,
  2026-11-27). Flag only: the maximum size is configurable from 1 to 10 MiB.
