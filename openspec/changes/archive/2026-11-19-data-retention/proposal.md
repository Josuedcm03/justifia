# Proposal: Data Retention

## Intent

Covers RNF-04 (personal data is cancelled after five years and the
cancellation is audited) and a new RN-27. Thesis Anexo F records the task as
not built, while `/privacy` already promises it. Real data reaches five years
around October 2031, so proof is by simulation. Evidence: `exploration.md`.

## Scope

### In Scope
- RN-27 in `docs/requirements.md`: subject, anchor, meaning of cancellation.
- Due rule (students only): five years since the latest of `Usuario.CreadoEn`
  and the newest `PresentadaEn`/`ReenviadaEn`, and no active enrollment.
- Per-student transaction: anonymize the account, its requests and embedded
  third-party data (`Remision` teacher snapshots, staff free text) with
  "[cancelado]"-style placeholders where a CHECK requires a value, NULL for
  unique nullable columns, unusable hash, `Activo` false, `Login`
  `cancelado-{id}`; delete `DocumentoRespaldo` rows; set `CanceladoEn` /
  `CanceladaEn`; one `usuario.cancelado` audit row (`retencion_5_anios`,
  counts only) by a sentinel system user. Blobs deleted after commit.
- Non-identifying residue stays (state, cause, dates, subjects, consent).
- `/api/cron/retention`, daily `0 11 * * *`, `isScheduler`, `?dry=1`.
- Migration `0014` (drizzle-kit, additive): markers, sentinel, audit
  partitions 2031+.
- Narrow structural-test carve-outs; owner-run integration test that enters
  through the scheduled task itself (`GET /api/cron/retention` with the
  scheduler bearer), as thesis section 4.9 describes the RNF-04 test
  (simulated age over five years; scheduled task; cancellation and audit log).
- Archive: roadmap row; update the RNF-04 verification note.

### Out of Scope
- Staff accounts, last-access timestamp, backups (RNF-08), `/privacy` text.
- Legal review: anonymization as "cancelación" (Ley 787 arts. 19 f, 24) is an
  assumption and a thesis limitation.

## Capabilities

### New Capabilities
- `data-retention`: due rule, cancellation, idempotence, dry run, scheduled
  route.

### Modified Capabilities
- `audit-log`: `usuario.cancelado` event and a system actor (today always a
  human).

## Approach

Exploration Approach 1. `now`-parameterized module modeled on
`intake-sweep.ts`; pure policy; batched; failures counted; orphan sweep is the
Blob safety net. Two stacked PRs (budget 1000 each):
- PR1 (~700): migration, schema, policy, audit event, data module, unit
  tests, carve-outs, RN-27.
- PR2 (~500): route, `vercel.json`, matrix rows, integration test, docs.

## Affected Areas

| Area | Impact |
|------|--------|
| `drizzle/0014_*.sql`, `src/db/` schema | New/Modified |
| `src/lib/data/` retention module and policy | New |
| `src/lib/audit/types.ts`, `events.ts` | Modified |
| `src/app/api/cron/retention/`, `vercel.json` | New/Modified |
| Append-only, cron, route-coverage, matrix tests | Modified |
| `docs/requirements.md`, `docs/roadmap.md` | Modified |

**DB schema: YES.** Applied to production only with the owner's explicit yes,
before PR1 merges.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Enrolled student cancelled | Low | Enrollment guard, boundary tests |
| Test cancels real students | Low | Age fixtures, never shift `now` |
| Carve-outs widen writers | Med | One module, named exemptions |
| Sentinel listed as a user | Med | Design decides |
| Legal meaning unconfirmed | Med | Recorded limitation |

## Rollback Plan

Remove the cron from `vercel.json`, then revert the PRs. Additive columns and
the sentinel may stay. Executed cancellations are irreversible by design.

## Dependencies

- Owner yes for `0014` in production and for the Neon-branch test.

## Success Criteria

- [ ] Aged fixture students anonymized, documents gone, one audit row each
      without personal data.
- [ ] Second run is a no-op; younger student untouched.
- [ ] Audit UPDATE still rejected.
- [ ] `npm test`, `npm run typecheck`, `npx eslint src` green.
