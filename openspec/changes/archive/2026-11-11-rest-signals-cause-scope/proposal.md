# Proposal: Rest Signals Cause Scope

## Intent

NuExtract3 invents a rest period on non-medical documents (10 Nov run: 16
invented fields), so RN-09 fires falsely on work, sports and FIA letters.
Evaluate RN-09/RN-10 only when the declared cause admits rest. Roadmap row
#15; covers RF-05 (a), (b); RN-09, RN-10, RN-15. Must be on `main` before the
Nov 12 tag. Evidence: `exploration.md`, `docs/next-change-rest-signals-cause-scope.md`.

## Scope

### In Scope
- Fourth outcome `not_applicable` (no reason, no evidence), RN-09/RN-10 only.
- `CAUSAS_CON_REPOSO = [medica, maternidad_paternidad]` code constant.
- `SignalInput.causa`; `readRequestBase` reads it, fail-loud on null/invalid.
- Verdict over applicable results only; fixed five-result order kept.
- UI label "No aplica" + muted line "La causa declarada no incluye reposo." (es/en); coordination shows outcome without evidence.
- Docs: RN-09/RN-10 wording + history row; roadmap row 15.

### Out of Scope
- RN-13, RF-14; normative-parameters (#8, RNF-14); NuExtract3 prompt/template.
- Extraction section UI (backlog only if requested); thesis edits.
- `scripts/session-verify.local.ts` expectations (post-merge §9.3; its own union still typechecks).

## Capabilities

### New Capabilities
None

### Modified Capabilities
- `validation-signals`: four outcomes; cause cut for RN-09/RN-10; verdict over applicable results; i18n keys.
- `request-review`: signals section renders `not_applicable`.
- `coordination-escalation`: read-only projection includes `not_applicable`.

## Approach

Cut in `evaluate.ts` (`rest-dates.ts` untouched). `suggestVerdict`: any
applicable `present` → `review_carefully`; ≥1 applicable and all `absent` →
`no_alerts`; else `inconclusive`. Strict TDD, single PR (~430-510 lines).

## Affected Areas

| Area | Impact |
|------|--------|
| `src/lib/signals/{types,evaluate,verdict,coordination-view}.ts` | Modified |
| `src/lib/intake/causes.ts`, `src/lib/data/signals.ts` | Modified |
| `src/app/(dashboard)/review/[id]/signals-section.tsx` (:118) | Modified |
| `i18n/{es,en}.json`, `src/i18n/review-messages.test.ts` | Modified |
| Unit tests + `validation-signals.integration.test.ts` helpers | Modified |
| `docs/requirements.md`, `docs/roadmap.md` | Modified |

**DB schema: NO.** `Solicitud.causa` exists; no migration.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Non-medical stays `inconclusive` when RN-14/RN-26 not evaluable | Med | Criterion 2 states precondition |
| Medical cause + non-medical document still false RN-09 | Med | Accepted; RN-13 scope |
| Integration needs throwaway Neon branch | Low | Per-command user yes |
| Deadline (Nov 12 tag; auto-deploy) | Med | Small single PR |

## Rollback Plan

Revert the merge commit on `main`. Nothing persisted, no schema or data.
Keep the change branch.

## Dependencies

None.

## Success Criteria (brief §6)

- [ ] Non-rest cause with `rest_to` < `issue_date`: no "fechas incoherentes"; RN-09/RN-10 "No aplica".
- [ ] Same request, RN-07/RN-14/RN-26 evaluable and `absent`: `no_alerts` (missing data stays `inconclusive`).
- [ ] `medica` E-02/SC-02 still fires RN-09.
- [ ] `maternidad_paternidad` still evaluates RN-09/RN-10.
- [ ] RN-07, RN-14, RN-26 unchanged for every cause.
- [ ] Coordination shows the same outcome without evidence.
- [ ] Unit + one integration case; existing suites, `tsc`, lint green.
